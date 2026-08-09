import { RECOGNITION_MODES, selectTargetIndex } from "./adaptive-selector.js?v=1";
import {
  calculateDistractorDifficulty,
  selectDistractorIndexes,
} from "./distractor-engine.js?v=1";
import {
  createConfusionPairKey,
  normalizeConfusionPairs,
  recordConfusionPair,
  recordConfusionReview,
} from "./confusion-engine.js?v=1";
import {
  createCandidateSignature,
  createGridPrompt,
  createRecallPrompt,
  getRecallSkill,
  isHunPromptSafe,
  isMeaningPromptSafe,
  RECALL_PROMPT_TYPES,
} from "./recognition-prompts.js?v=1";
import {
  createRecognitionScore,
  scoreGridAnswer,
  scoreRecallAnswer,
} from "./recognition-score.js?v=1";
import { recordSkillAttempt } from "./progress-engine.js?v=1";

export const RECOGNITION_ENGINE_VERSION = 2;
export const RECOGNITION_SESSION_KIND = "recognition-grid";
export const RECOGNITION_PHASES = Object.freeze([
  "question",
  "recall",
  "feedback",
  "paused",
  "ended",
]);
export const RECOGNITION_BOARD_SIZES = Object.freeze([16, 25]);

const RECENT_TARGET_LIMIT = 12;
const HISTORY_LIMIT = 60;
const REFRESH_RATIO = 0.3;

/**
 * Create a persistent 16- or 25-cell recognition reservoir.
 * `characterData`, `random`, and `now` are dependencies supplied by the caller;
 * the returned value contains data only and is safe to JSON serialize.
 */
export function createRecognitionSession(options = {}) {
  const boardSize = RECOGNITION_BOARD_SIZES.includes(Number(options.boardSize))
    ? Number(options.boardSize)
    : 16;
  const characterData = requireCharacterData(options.characterData, boardSize);
  const mode = normalizeMode(options.mode);
  const random = getRandom(options.random);
  const now = resolveNow(options.now);
  const weakIndexes = validIndexes(options.weakIndexes, characterData);
  const targetIndex = selectTargetIndex({
    characterData,
    progress: options.progress,
    mode,
    weakIndexes,
    random,
    now,
  });
  if (targetIndex === null) throw new RangeError("첫 정답 글자를 선택할 수 없습니다.");

  const distractors = mode === "random1000"
    ? selectUniformBoardIndexes({
        characterData,
        count: boardSize - 1,
        targetIndex,
        excludeIndexes: [targetIndex],
        random,
      })
    : selectDistractorIndexes({
        characterData,
        targetIndex,
        count: boardSize - 1,
        confusionPairs: options.confusionPairs,
        random,
        now,
      });
  let boardIndexes = shuffleEnsuringChange([targetIndex, ...distractors], random, false);
  boardIndexes = repairTargetPromptAmbiguity({
    session: { mode, weakIndexes, recentTargets: [targetIndex] },
    boardIndexes,
    targetIndex,
    characterData,
    progress: options.progress,
    queuedTargetIndexes: [],
    random,
    now,
  }).boardIndexes;
  const targetSlot = boardIndexes.indexOf(targetIndex);
  const prompt = createGridPrompt({
    targetIndex,
    boardIndexes,
    characterData,
    random,
  });
  const score = createRecognitionScore();
  const nowIso = new Date(now).toISOString();

  return {
    kind: RECOGNITION_SESSION_KIND,
    engineVersion: RECOGNITION_ENGINE_VERSION,
    phase: "question",
    inputLocked: false,
    mode,
    boardSize,
    boardIndexes,
    targetIndex,
    targetSlot,
    prompt,
    recall: null,
    feedback: null,
    currentReview: null,
    delayedReviews: [],
    reviewSequence: 0,
    weakIndexes,
    recentTargets: [targetIndex],
    answeredGridCount: 0,
    correctCount: 0,
    wrongCount: 0,
    recallAnsweredCount: 0,
    recallCorrectCount: 0,
    recallWrongCount: 0,
    score: score.score,
    combo: score.combo,
    bestCombo: score.bestCombo,
    questionNumber: 1,
    questionToken: 1,
    boardRevision: 0,
    lastShuffleAt: 0,
    lastRefreshAt: 0,
    lastBoardChange: {
      reason: "initial",
      replacedSlots: [],
      refreshedSlots: [],
      shuffled: false,
      replayInsertedSlot: null,
    },
    startedAt: nowIso,
    questionStartedAt: nowIso,
    pausedAt: null,
    pausedFromPhase: null,
    totalPausedMs: 0,
    endedAt: null,
    history: [],
  };
}

export function submitGridAnswer(session, selectedSlot, options = {}) {
  const current = restoreRecognitionSession(session, options);
  const progress = options.progress && typeof options.progress === "object" ? options.progress : {};
  let confusionPairs = normalizeConfusionPairs(options.confusionPairs);
  if (current.phase !== "question" || current.inputLocked) {
    return ignoredSubmission(current, progress, confusionPairs, "phase-locked");
  }
  if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot >= current.boardSize) {
    throw new RangeError("선택한 보드 칸이 올바르지 않습니다.");
  }

  const characterData = requireCharacterData(options.characterData, current.boardSize);
  const random = getRandom(options.random);
  const now = resolveNow(options.now);
  const nowIso = new Date(now).toISOString();
  const selectedIndex = current.boardIndexes[selectedSlot];
  const correct = selectedIndex === current.targetIndex;
  const answeredGridCount = current.answeredGridCount + 1;
  const replay = Boolean(current.currentReview);
  const difficulty = calculateDistractorDifficulty({
    targetIndex: current.targetIndex,
    boardIndexes: current.boardIndexes,
    characterData,
    confusionPairs,
    now,
  });
  const score = scoreGridAnswer(current, {
    correct,
    mode: current.mode,
    distractorDifficulty: difficulty,
    replay,
  });
  const nextProgress = recordSkillAttempt(progress, current.targetIndex, "reverse", {
    correct,
    now,
    randomMode: current.mode === "random1000",
    candidateSignature: createCandidateSignature(current.boardIndexes),
    promptType: current.prompt.type,
  });
  let delayedReviews = current.delayedReviews.slice();
  let reviewSequence = current.reviewSequence;
  let scheduledReview = null;

  if (current.currentReview && current.currentReview.sourcePairKey) {
    confusionPairs = recordConfusionReview(
      confusionPairs,
      current.currentReview.sourcePairKey,
      { correct },
      { now },
    );
  }

  if (!correct) {
    const delay = 3 + Math.floor(safeRandom(random) * 3);
    const dueQuestion = chooseUnoccupiedReviewQuestion(
      answeredGridCount,
      delay,
      delayedReviews,
    );
    reviewSequence += 1;
    const sourcePairKey = createConfusionPairKey(current.targetIndex, selectedIndex);
    scheduledReview = {
      id: `review-${reviewSequence}-${current.targetIndex}`,
      targetIndex: current.targetIndex,
      dueQuestion,
      previousSlot: current.targetSlot,
      previousCandidateSignature: createCandidateSignature(current.boardIndexes),
      previousPromptType: current.prompt.type,
      attempts: current.currentReview ? current.currentReview.attempts + 1 : 1,
      sourcePairKey,
      scheduledAt: nowIso,
    };
    delayedReviews.push(scheduledReview);
    delayedReviews.sort(compareReviews);
    confusionPairs = recordConfusionPair(
      confusionPairs,
      {
        correctIndex: current.targetIndex,
        selectedIndex,
        promptType: current.prompt.type,
        selectedSlot,
        targetSlot: current.targetSlot,
        replayDueQuestion: dueQuestion,
      },
      { now },
    );
  }

  const attempt = {
    kind: "grid",
    accepted: true,
    correct,
    skill: "reverse",
    targetIndex: current.targetIndex,
    selectedIndex,
    targetSlot: current.targetSlot,
    selectedSlot,
    promptType: current.prompt.type,
    replay,
    answeredAt: nowIso,
  };
  const feedback = {
    source: "grid",
    correct,
    targetIndex: current.targetIndex,
    selectedIndex,
    targetSlot: current.targetSlot,
    selectedSlot,
    promptType: current.prompt.type,
    candidateSignature: createCandidateSignature(current.boardIndexes),
    scheduledReviewId: scheduledReview ? scheduledReview.id : null,
    answeredAt: nowIso,
  };
  const nextSession = {
    ...current,
    phase: "feedback",
    inputLocked: true,
    feedback,
    delayedReviews,
    reviewSequence,
    answeredGridCount,
    correctCount: current.correctCount + (correct ? 1 : 0),
    wrongCount: current.wrongCount + (correct ? 0 : 1),
    score: score.score,
    combo: score.combo,
    bestCombo: score.bestCombo,
    history: appendHistory(current.history, attempt),
  };
  return {
    session: nextSession,
    accepted: true,
    correct,
    progress: nextProgress,
    confusionPairs,
    attempt,
  };
}

export function submitRecallAnswer(session, selectedIndex, options = {}) {
  const current = restoreRecognitionSession(session, options);
  const progress = options.progress && typeof options.progress === "object" ? options.progress : {};
  const confusionPairs = normalizeConfusionPairs(options.confusionPairs);
  if (current.phase !== "recall" || current.inputLocked || !current.recall) {
    return ignoredSubmission(current, progress, confusionPairs, "phase-locked");
  }
  if (!current.recall.choices.some(function (choice) { return choice.index === selectedIndex; })) {
    throw new RangeError("역방향 확인 선택지가 올바르지 않습니다.");
  }
  const now = resolveNow(options.now);
  const nowIso = new Date(now).toISOString();
  const correct = selectedIndex === current.recall.correctIndex;
  const skill = getRecallSkill(current.recall.type);
  const nextProgress = recordSkillAttempt(progress, current.recall.targetIndex, skill, {
    correct,
    now,
    promptType: current.recall.type,
  });
  const score = scoreRecallAnswer(current, { correct });
  const attempt = {
    kind: "recall",
    accepted: true,
    correct,
    skill,
    targetIndex: current.recall.targetIndex,
    selectedIndex,
    promptType: current.recall.type,
    answeredAt: nowIso,
  };
  return {
    session: {
      ...current,
      phase: "feedback",
      inputLocked: true,
      feedback: {
        source: "recall",
        correct,
        targetIndex: current.recall.targetIndex,
        selectedIndex,
        promptType: current.recall.type,
        answeredAt: nowIso,
      },
      recallAnsweredCount: current.recallAnsweredCount + 1,
      recallCorrectCount: current.recallCorrectCount + (correct ? 1 : 0),
      recallWrongCount: current.recallWrongCount + (correct ? 0 : 1),
      score: score.score,
      combo: score.combo,
      bestCombo: score.bestCombo,
      history: appendHistory(current.history, attempt),
    },
    accepted: true,
    correct,
    progress: nextProgress,
    confusionPairs,
    attempt,
  };
}

/**
 * Finish a feedback transaction. Grid feedback replaces the revealed slot,
 * chooses the next target from the live board, then applies the 4/8 cadence.
 * Recall feedback simply reveals the already-prepared next grid question.
 */
export function advanceAfterFeedback(session, options = {}) {
  const current = restoreRecognitionSession(session, options);
  if (current.phase !== "feedback" || !current.feedback) return current;
  const now = resolveNow(options.now);
  const nowIso = new Date(now).toISOString();

  if (current.feedback.source === "recall") {
    return {
      ...current,
      phase: "question",
      inputLocked: false,
      feedback: null,
      recall: null,
      questionStartedAt: nowIso,
    };
  }

  const characterData = requireCharacterData(options.characterData, current.boardSize);
  const random = getRandom(options.random);
  const progress = options.progress && typeof options.progress === "object" ? options.progress : {};
  const confusionPairs = normalizeConfusionPairs(options.confusionPairs);
  let boardIndexes = current.boardIndexes.slice();
  const answeredSlot = current.feedback.targetSlot;
  const queuedTargetIndexes = current.delayedReviews.map(function (review) { return review.targetIndex; });
  boardIndexes[answeredSlot] = selectReservoirReplacement({
    session: current,
    boardIndexes,
    removedSlot: answeredSlot,
    characterData,
    progress,
    confusionPairs,
    queuedTargetIndexes,
    random,
    now,
  });

  let delayedReviews = current.delayedReviews.slice();
  let currentReview = null;
  let nextTargetIndex;
  let replayInsertedSlot = null;
  const dueIndex = delayedReviews.findIndex(function (review) {
    return review.dueQuestion <= current.answeredGridCount + 1;
  });

  if (dueIndex >= 0) {
    currentReview = delayedReviews[dueIndex];
    delayedReviews.splice(dueIndex, 1);
    const inserted = insertReplayTarget({
      boardIndexes,
      review: currentReview,
      characterData,
      random,
    });
    boardIndexes = inserted.boardIndexes;
    replayInsertedSlot = inserted.slot;
    nextTargetIndex = currentReview.targetIndex;
  } else {
    const resolvableBoardTargets = boardIndexes.filter(function (index) {
      return isHunPromptSafe(index, boardIndexes, characterData)
        || isMeaningPromptSafe(index, boardIndexes, characterData);
    });
    nextTargetIndex = selectTargetIndex({
      characterData,
      candidateIndexes: resolvableBoardTargets.length > 0 ? resolvableBoardTargets : boardIndexes,
      progress,
      mode: current.mode,
      weakIndexes: current.weakIndexes,
      recentTargets: current.recentTargets,
      random,
      now,
    });
    if (nextTargetIndex === null) nextTargetIndex = boardIndexes[0];
  }

  let refreshedSlots = [];
  const refreshDue = current.answeredGridCount > 0 && current.answeredGridCount % 8 === 0;
  if (refreshDue) {
    const refreshed = refreshDistractors({
      session: current,
      boardIndexes,
      targetIndex: nextTargetIndex,
      characterData,
      progress,
      confusionPairs,
      excludeIndexes: delayedReviews.map(function (review) { return review.targetIndex; }),
      random,
      now,
    });
    boardIndexes = refreshed.boardIndexes;
    refreshedSlots = refreshed.slots;
  }

  const repaired = repairTargetPromptAmbiguity({
    session: current,
    boardIndexes,
    targetIndex: nextTargetIndex,
    characterData,
    progress,
    queuedTargetIndexes: delayedReviews.map(function (review) { return review.targetIndex; }),
    requiredType: currentReview
      ? currentReview.previousPromptType === "hun-to-character"
        ? "gloss-to-character"
        : "hun-to-character"
      : null,
    random,
    now,
  });
  boardIndexes = repaired.boardIndexes;
  refreshedSlots = Array.from(new Set([...refreshedSlots, ...repaired.slots]));

  const shuffleDue = current.answeredGridCount > 0 && current.answeredGridCount % 4 === 0;
  if (shuffleDue) boardIndexes = shuffleEnsuringChange(boardIndexes, random, true);

  if (currentReview) {
    boardIndexes = ensureReplayDifference({
      session: current,
      boardIndexes,
      review: currentReview,
      targetIndex: nextTargetIndex,
      characterData,
      progress,
      confusionPairs,
      delayedReviews,
      random,
      now,
    });
    let slot = boardIndexes.indexOf(nextTargetIndex);
    if (slot === currentReview.previousSlot) {
      const swapSlot = chooseDifferentSlot(boardIndexes.length, slot, random);
      [boardIndexes[slot], boardIndexes[swapSlot]] = [boardIndexes[swapSlot], boardIndexes[slot]];
      slot = swapSlot;
    }
    replayInsertedSlot = slot;
  }

  assertBoardInvariant(boardIndexes, current.boardSize, characterData);
  const targetSlot = boardIndexes.indexOf(nextTargetIndex);
  const prompt = createGridPrompt({
    targetIndex: nextTargetIndex,
    boardIndexes,
    characterData,
    random,
    preferredType: currentReview
      ? currentReview.previousPromptType === "hun-to-character"
        ? "gloss-to-character"
        : "hun-to-character"
      : null,
    avoidType: currentReview ? currentReview.previousPromptType : null,
  });
  const recentTargets = [...current.recentTargets, nextTargetIndex].slice(-RECENT_TARGET_LIMIT);
  const recall = refreshDue
    ? createRecallPrompt({
        targetIndex: current.feedback.targetIndex,
        candidateIndexes: current.boardIndexes,
        characterData,
        random,
      })
    : null;

  return {
    ...current,
    phase: recall ? "recall" : "question",
    inputLocked: false,
    boardIndexes,
    targetIndex: nextTargetIndex,
    targetSlot,
    prompt,
    recall,
    feedback: null,
    currentReview,
    delayedReviews,
    recentTargets,
    questionNumber: current.answeredGridCount + 1,
    questionToken: current.questionToken + 1,
    boardRevision: current.boardRevision + 1,
    lastShuffleAt: shuffleDue ? current.answeredGridCount : current.lastShuffleAt,
    lastRefreshAt: refreshDue ? current.answeredGridCount : current.lastRefreshAt,
    lastBoardChange: {
      reason: current.feedback.correct ? "correct" : "wrong",
      replacedSlots: [answeredSlot],
      refreshedSlots,
      shuffled: shuffleDue,
      replayInsertedSlot,
    },
    questionStartedAt: nowIso,
  };
}

export function pauseRecognitionSession(session, options = {}) {
  const current = restoreRecognitionSession(session, options);
  if (current.phase === "paused" || current.phase === "ended") return current;
  const now = resolveNow(options.now);
  return {
    ...current,
    phase: "paused",
    inputLocked: true,
    pausedAt: new Date(now).toISOString(),
    pausedFromPhase: current.phase,
  };
}

export function resumeRecognitionSession(session, options = {}) {
  const current = restoreRecognitionSession(session, options);
  if (current.phase !== "paused") return current;
  const now = resolveNow(options.now);
  const pausedAt = new Date(current.pausedAt).getTime();
  const resumedPhase = ["question", "recall", "feedback"].includes(current.pausedFromPhase)
    ? current.pausedFromPhase
    : "question";
  return {
    ...current,
    phase: resumedPhase,
    inputLocked: resumedPhase === "feedback",
    pausedAt: null,
    pausedFromPhase: null,
    totalPausedMs: current.totalPausedMs + Math.max(0, now - pausedAt),
    questionStartedAt: resumedPhase === "question" ? new Date(now).toISOString() : current.questionStartedAt,
  };
}

export function endRecognitionSession(session, options = {}) {
  const current = restoreRecognitionSession(session, options);
  if (current.phase === "ended") return current;
  const now = resolveNow(options.now);
  const pausedAt = current.phase === "paused" ? new Date(current.pausedAt).getTime() : null;
  return {
    ...current,
    phase: "ended",
    inputLocked: true,
    endedAt: new Date(now).toISOString(),
    totalPausedMs: current.totalPausedMs + (
      pausedAt === null ? 0 : Math.max(0, now - pausedAt)
    ),
    pausedAt: null,
    pausedFromPhase: null,
  };
}

export function getRecognitionStats(session, options = {}) {
  const now = session.phase === "ended" && session.endedAt
    ? new Date(session.endedAt).getTime()
    : resolveNow(options.now);
  const startedAt = new Date(session.startedAt).getTime();
  const activePauseMs = session.phase === "paused" && session.pausedAt
    ? Math.max(0, now - new Date(session.pausedAt).getTime())
    : 0;
  const answered = Math.max(0, Number(session.answeredGridCount) || 0);
  const correct = Math.max(0, Number(session.correctCount) || 0);
  return {
    mode: session.mode,
    phase: session.phase,
    answeredGridCount: answered,
    correctCount: correct,
    wrongCount: Math.max(0, Number(session.wrongCount) || 0),
    accuracy: answered > 0 ? correct / answered : 0,
    recallAnsweredCount: Math.max(0, Number(session.recallAnsweredCount) || 0),
    recallCorrectCount: Math.max(0, Number(session.recallCorrectCount) || 0),
    score: Math.max(0, Number(session.score) || 0),
    combo: Math.max(0, Number(session.combo) || 0),
    bestCombo: Math.max(0, Number(session.bestCombo) || 0),
    pendingReviewCount: Array.isArray(session.delayedReviews) ? session.delayedReviews.length : 0,
    elapsedMs: Math.max(0, now - startedAt - (Number(session.totalPausedMs) || 0) - activePauseMs),
  };
}

/** Validate and canonicalize an engine-v2 JSON value without consuming RNG. */
export function restoreRecognitionSession(value, options = {}) {
  if (!value || value.kind !== RECOGNITION_SESSION_KIND || Number(value.engineVersion) !== 2) {
    throw new Error("무한 한자 찾기 저장 형식이 올바르지 않습니다.");
  }
  const phase = RECOGNITION_PHASES.includes(value.phase) ? value.phase : null;
  const boardSize = Number(value.boardSize);
  if (!phase || !RECOGNITION_BOARD_SIZES.includes(boardSize)) {
    throw new Error("무한 한자 찾기 저장 상태가 유효하지 않습니다.");
  }
  const characterData = requireCharacterData(options.characterData, boardSize);
  const boardIndexes = validIndexes(value.boardIndexes, characterData);
  assertBoardInvariant(boardIndexes, boardSize, characterData);
  const targetIndex = Number(value.targetIndex);
  const targetSlot = Number(value.targetSlot);
  if (
    !Number.isInteger(targetIndex) ||
    !Number.isInteger(targetSlot) ||
    targetSlot < 0 ||
    targetSlot >= boardSize ||
    boardIndexes[targetSlot] !== targetIndex ||
    boardIndexes.filter(function (index) { return index === targetIndex; }).length !== 1
  ) {
    throw new Error("저장된 정답이 보드와 일치하지 않습니다.");
  }
  if (!value.prompt || value.prompt.targetIndex !== targetIndex || value.prompt.kind !== "grid") {
    throw new Error("저장된 문제 프롬프트가 정답과 일치하지 않습니다.");
  }
  const feedback = normalizeFeedback(value.feedback);
  if (phase === "feedback" && !feedback) {
    throw new Error("피드백 단계의 저장 값이 없습니다.");
  }
  const recall = normalizeRecall(value.recall, characterData);
  if (phase === "recall" && !recall) {
    throw new Error("역방향 확인 단계의 저장 값이 없습니다.");
  }
  const delayedReviews = normalizeDelayedReviews(value.delayedReviews, characterData);
  const score = createRecognitionScore(value);
  const pausedAt = value.pausedAt ? validIso(value.pausedAt) : null;
  const pausedFromPhase = ["question", "recall", "feedback"].includes(value.pausedFromPhase)
    ? value.pausedFromPhase
    : null;
  const endedAt = value.endedAt ? validIso(value.endedAt) : null;
  if (phase === "paused" && (!pausedAt || !pausedFromPhase)) {
    throw new Error("일시 정지 단계의 저장 값이 없습니다.");
  }
  if (phase === "ended" && !endedAt) {
    throw new Error("종료된 세션의 종료 시각이 없습니다.");
  }
  if (
    (phase === "recall" || pausedFromPhase === "recall") && !recall ||
    (feedback && feedback.source === "recall" && !recall)
  ) {
    throw new Error("역방향 확인 단계의 문제 값이 없습니다.");
  }

  return {
    kind: RECOGNITION_SESSION_KIND,
    engineVersion: RECOGNITION_ENGINE_VERSION,
    phase,
    inputLocked: phase === "feedback" || phase === "paused" || phase === "ended",
    mode: normalizeMode(value.mode),
    boardSize,
    boardIndexes,
    targetIndex,
    targetSlot,
    prompt: {
      kind: "grid",
      type: String(value.prompt.type),
      targetIndex,
      text: String(value.prompt.text || ""),
    },
    recall,
    feedback,
    currentReview: normalizeReview(value.currentReview, characterData),
    delayedReviews,
    reviewSequence: nonNegativeInteger(value.reviewSequence),
    weakIndexes: validIndexes(value.weakIndexes, characterData),
    recentTargets: validIndexes(value.recentTargets, characterData).slice(-RECENT_TARGET_LIMIT),
    answeredGridCount: nonNegativeInteger(value.answeredGridCount),
    correctCount: nonNegativeInteger(value.correctCount),
    wrongCount: nonNegativeInteger(value.wrongCount),
    recallAnsweredCount: nonNegativeInteger(value.recallAnsweredCount),
    recallCorrectCount: nonNegativeInteger(value.recallCorrectCount),
    recallWrongCount: nonNegativeInteger(value.recallWrongCount),
    score: score.score,
    combo: score.combo,
    bestCombo: score.bestCombo,
    questionNumber: Math.max(1, nonNegativeInteger(value.questionNumber)),
    questionToken: Math.max(1, nonNegativeInteger(value.questionToken)),
    boardRevision: nonNegativeInteger(value.boardRevision),
    lastShuffleAt: nonNegativeInteger(value.lastShuffleAt),
    lastRefreshAt: nonNegativeInteger(value.lastRefreshAt),
    lastBoardChange: normalizeBoardChange(value.lastBoardChange),
    startedAt: validIso(value.startedAt),
    questionStartedAt: validIso(value.questionStartedAt),
    pausedAt,
    pausedFromPhase,
    totalPausedMs: Math.max(0, Number(value.totalPausedMs) || 0),
    endedAt,
    history: normalizeHistory(value.history),
  };
}

function refreshDistractors(options) {
  const board = options.boardIndexes.slice();
  const targetSlot = board.indexOf(options.targetIndex);
  const count = Math.max(1, Math.round((board.length - 1) * REFRESH_RATIO));
  const slots = shuffleCopy(
    board.map(function (_, slot) { return slot; }).filter(function (slot) { return slot !== targetSlot; }),
    options.random,
  ).slice(0, count);
  const retained = board.filter(function (_, slot) { return !slots.includes(slot); });
  let replacements;
  if (options.session.mode === "random1000") {
    replacements = selectUniformBoardIndexes({
      characterData: options.characterData,
      count,
      targetIndex: options.targetIndex,
      existingIndexes: retained.filter(function (index) { return index !== options.targetIndex; }),
      excludeIndexes: [...board, ...(options.excludeIndexes || [])],
      random: options.random,
    });
  } else {
    replacements = selectDistractorIndexes({
      characterData: options.characterData,
      targetIndex: options.targetIndex,
      count,
      existingIndexes: retained.filter(function (index) { return index !== options.targetIndex; }),
      excludeIndexes: [...board, ...(options.excludeIndexes || [])],
      confusionPairs: options.confusionPairs,
      random: options.random,
      now: options.now,
    });
  }
  slots.forEach(function (slot, position) { board[slot] = replacements[position]; });
  return { boardIndexes: board, slots };
}

function selectReservoirReplacement(options) {
  const retained = options.boardIndexes.filter(function (_, slot) { return slot !== options.removedSlot; });
  const removedIndex = options.boardIndexes[options.removedSlot];
  const retainedGlyphs = new Set(retained.map(function (index) {
    return getItem(options.characterData, index).character;
  }));
  const candidateIndexes = options.characterData
    .map(function (item) { return item.index; })
    .filter(function (index) {
      const item = getItem(options.characterData, index);
      return index !== removedIndex
        && !retained.includes(index)
        && !options.queuedTargetIndexes.includes(index)
        && !retainedGlyphs.has(item.character)
        && respectsCoupletCap(index, retained, options.characterData)
        && (!options.candidateFilter || options.candidateFilter(item, index));
    });
  let selected = selectTargetIndex({
    characterData: options.characterData,
    candidateIndexes,
    progress: options.progress,
    mode: options.session.mode,
    weakIndexes: options.session.weakIndexes,
    recentTargets: options.session.recentTargets,
    random: options.random,
    now: options.now,
  });
  if (selected === null) {
    selected = selectTargetIndex({
      characterData: options.characterData,
      candidateIndexes,
      progress: options.progress,
      mode: options.session.mode === "random1000" ? "random1000" : "adaptive",
      recentTargets: options.session.recentTargets,
      random: options.random,
      now: options.now,
    });
  }
  if (selected === null) throw new RangeError("보드에 넣을 새 글자를 선택할 수 없습니다.");
  return selected;
}

function repairTargetPromptAmbiguity(options) {
  let board = options.boardIndexes.slice();
  const replacedSlots = [];
  let guard = board.length * 2;
  function needsRepair() {
    if (options.requiredType === "hun-to-character") {
      return !isHunPromptSafe(options.targetIndex, board, options.characterData);
    }
    if (options.requiredType === "gloss-to-character") {
      return !isMeaningPromptSafe(options.targetIndex, board, options.characterData);
    }
    return !isHunPromptSafe(options.targetIndex, board, options.characterData)
      && !isMeaningPromptSafe(options.targetIndex, board, options.characterData);
  }
  while (needsRepair()) {
    if (guard <= 0) {
      throw new RangeError("훈음과 뜻이 모두 겹치지 않는 보드를 만들 수 없습니다.");
    }
    guard -= 1;
    const target = getItem(options.characterData, options.targetIndex);
    const targetHun = normalizePromptLabel(target.contextHun || target.hun || target.reading);
    const targetGloss = normalizePromptLabel(target.gloss);
    const hunConflictSlots = board.map(function (index, slot) {
      if (index === options.targetIndex) return -1;
      const item = getItem(options.characterData, index);
      return normalizePromptLabel(item.contextHun || item.hun || item.reading) === targetHun ? slot : -1;
    }).filter(function (slot) { return slot >= 0; });
    const glossConflictSlots = board.map(function (index, slot) {
      if (index === options.targetIndex) return -1;
      const item = getItem(options.characterData, index);
      return normalizePromptLabel(item.gloss) === targetGloss ? slot : -1;
    }).filter(function (slot) { return slot >= 0; });
    const repairHun = options.requiredType === "hun-to-character"
      ? true
      : options.requiredType === "gloss-to-character"
        ? false
        : hunConflictSlots.length <= glossConflictSlots.length;
    const slot = (repairHun ? hunConflictSlots : glossConflictSlots)[0];
    board[slot] = selectReservoirReplacement({
      session: options.session,
      boardIndexes: board,
      removedSlot: slot,
      characterData: options.characterData,
      progress: options.progress,
      queuedTargetIndexes: options.queuedTargetIndexes || [],
      random: options.random,
      now: options.now,
      candidateFilter: function (item) {
        return repairHun
          ? normalizePromptLabel(item.contextHun || item.hun || item.reading) !== targetHun
          : normalizePromptLabel(item.gloss) !== targetGloss;
      },
    });
    replacedSlots.push(slot);
  }
  return { boardIndexes: board, slots: replacedSlots };
}

function insertReplayTarget(options) {
  const board = options.boardIndexes.slice();
  const target = getItem(options.characterData, options.review.targetIndex);
  const duplicateSlots = board
    .map(function (index, slot) {
      const item = getItem(options.characterData, index);
      return item.character === target.character ? slot : -1;
    })
    .filter(function (slot) { return slot >= 0; });
  duplicateSlots.forEach(function (slot) {
    board[slot] = null;
  });
  const targetCouplet = getCoupletIndex(target);
  const peerSlots = board
    .map(function (index, slot) {
      const item = index === null ? null : getItem(options.characterData, index);
      return item && getCoupletIndex(item) === targetCouplet ? slot : -1;
    })
    .filter(function (slot) { return slot >= 0; });
  let candidateSlots = board.map(function (_, slot) { return slot; }).filter(function (slot) {
    return slot !== options.review.previousSlot;
  });
  if (peerSlots.length >= 2) {
    const removablePeers = peerSlots.filter(function (slot) { return slot !== options.review.previousSlot; });
    if (removablePeers.length > 0) candidateSlots = removablePeers;
  }
  if (duplicateSlots.length > 0) {
    const usableDuplicates = duplicateSlots.filter(function (slot) {
      return slot !== options.review.previousSlot;
    });
    if (usableDuplicates.length > 0) candidateSlots = usableDuplicates;
  }
  const slot = candidateSlots[Math.floor(safeRandom(options.random) * candidateSlots.length)];
  board[slot] = options.review.targetIndex;
  // A duplicate glyph at the forbidden old slot is filled by swapping in the
  // value displaced at the replay slot when possible. Actual 1000cc data has no
  // duplicate glyphs; this branch keeps custom data safe.
  const nullSlot = board.indexOf(null);
  if (nullSlot >= 0) {
    const fallbackSlot = board.findIndex(function (index, indexSlot) {
      return indexSlot !== slot && index !== null;
    });
    board[nullSlot] = board[fallbackSlot];
    board[fallbackSlot] = null;
    throw new RangeError("중복 글리프 데이터로 재출제 보드를 만들 수 없습니다.");
  }
  return { boardIndexes: board, slot };
}

function ensureReplayDifference(options) {
  if (createCandidateSignature(options.boardIndexes) !== options.review.previousCandidateSignature) {
    return options.boardIndexes;
  }
  const board = options.boardIndexes.slice();
  const targetSlot = board.indexOf(options.targetIndex);
  const replaceSlot = board.findIndex(function (_, slot) { return slot !== targetSlot; });
  board[replaceSlot] = selectReservoirReplacement({
    session: options.session,
    boardIndexes: board,
    removedSlot: replaceSlot,
    characterData: options.characterData,
    progress: options.progress,
    confusionPairs: options.confusionPairs,
    queuedTargetIndexes: options.delayedReviews.map(function (review) { return review.targetIndex; }),
    random: options.random,
    now: options.now,
  });
  return board;
}

function selectUniformBoardIndexes(options) {
  const existing = validIndexes(options.existingIndexes, options.characterData);
  const excluded = new Set(validIndexes(options.excludeIndexes, options.characterData));
  const used = new Set(existing);
  if (Number.isInteger(options.targetIndex)) used.add(options.targetIndex);
  const usedGlyphs = new Set(Array.from(used).map(function (index) {
    return getItem(options.characterData, index).character;
  }));
  const result = [];
  const candidates = shuffleCopy(
    options.characterData.map(function (item) { return item.index; }),
    options.random,
  );
  for (const index of candidates) {
    const item = getItem(options.characterData, index);
    if (
      excluded.has(index) ||
      used.has(index) ||
      usedGlyphs.has(item.character) ||
      !respectsCoupletCap(index, [...used], options.characterData)
    ) continue;
    result.push(index);
    used.add(index);
    usedGlyphs.add(item.character);
    if (result.length === options.count) return result;
  }
  throw new RangeError(`무작위 보드 후보 ${options.count}개를 만들 수 없습니다.`);
}

function respectsCoupletCap(index, boardIndexes, characterData) {
  const couplet = getCoupletIndex(getItem(characterData, index));
  return boardIndexes.filter(function (boardIndex) {
    return getCoupletIndex(getItem(characterData, boardIndex)) === couplet;
  }).length < 2;
}

function assertBoardInvariant(boardIndexes, boardSize, characterData) {
  if (!Array.isArray(boardIndexes) || boardIndexes.length !== boardSize) {
    throw new Error("저장된 보드 크기가 유효하지 않습니다.");
  }
  if (new Set(boardIndexes).size !== boardSize) {
    throw new Error("보드의 한자 인덱스가 중복되었습니다.");
  }
  const glyphs = boardIndexes.map(function (index) {
    const item = getItem(characterData, index);
    if (!item) throw new Error("보드 글자가 characterData에 없습니다.");
    return item.character;
  });
  if (new Set(glyphs).size !== boardSize) {
    throw new Error("보드의 한자 글리프가 중복되었습니다.");
  }
  const counts = new Map();
  boardIndexes.forEach(function (index) {
    const couplet = getCoupletIndex(getItem(characterData, index));
    counts.set(couplet, (counts.get(couplet) || 0) + 1);
  });
  if (Array.from(counts.values()).some(function (count) { return count > 2; })) {
    throw new Error("한 보드에 같은 8자 묶음 후보가 지나치게 많습니다.");
  }
}

function normalizeDelayedReviews(value, characterData) {
  return (Array.isArray(value) ? value : [])
    .map(function (review) { return normalizeReview(review, characterData); })
    .filter(Boolean)
    .sort(compareReviews);
}

function normalizeReview(review, characterData) {
  if (!review || typeof review !== "object" || !getItem(characterData, review.targetIndex)) return null;
  const dueQuestion = Math.max(1, nonNegativeInteger(review.dueQuestion));
  return {
    id: String(review.id || `review-${dueQuestion}-${review.targetIndex}`),
    targetIndex: review.targetIndex,
    dueQuestion,
    previousSlot: nonNegativeInteger(review.previousSlot),
    previousCandidateSignature: String(review.previousCandidateSignature || ""),
    previousPromptType: String(review.previousPromptType || "hun-to-character"),
    attempts: Math.max(1, nonNegativeInteger(review.attempts)),
    sourcePairKey: review.sourcePairKey ? String(review.sourcePairKey) : null,
    scheduledAt: review.scheduledAt ? validIso(review.scheduledAt) : null,
  };
}

function normalizeRecall(value, characterData) {
  if (
    !value ||
    typeof value !== "object" ||
    value.kind !== "recall" ||
    !RECALL_PROMPT_TYPES.includes(value.type) ||
    !getItem(characterData, value.targetIndex) ||
    value.correctIndex !== value.targetIndex
  ) return null;
  const choices = (Array.isArray(value.choices) ? value.choices : [])
    .filter(function (choice) { return choice && getItem(characterData, choice.index); })
    .map(function (choice) { return { index: choice.index, label: String(choice.label || "") }; });
  const choiceIndexes = new Set(choices.map(function (choice) { return choice.index; }));
  const choiceLabels = new Set(choices.map(function (choice) {
    return normalizePromptLabel(choice.label);
  }));
  if (
    choices.length < 2 ||
    choiceIndexes.size !== choices.length ||
    choiceLabels.size !== choices.length ||
    choiceLabels.has("") ||
    !choiceIndexes.has(value.correctIndex)
  ) {
    return null;
  }
  return {
    kind: "recall",
    type: String(value.type),
    targetIndex: value.targetIndex,
    promptText: String(value.promptText || ""),
    choices,
    correctIndex: value.correctIndex,
  };
}

function normalizeFeedback(value) {
  if (!value || typeof value !== "object" || !["grid", "recall"].includes(value.source)) return null;
  return {
    ...value,
    source: value.source,
    correct: Boolean(value.correct),
    targetIndex: Number(value.targetIndex),
    selectedIndex: Number(value.selectedIndex),
    promptType: String(value.promptType || ""),
    answeredAt: validIso(value.answeredAt),
  };
}

function normalizeBoardChange(value) {
  return {
    reason: String(value && value.reason || "restored"),
    replacedSlots: uniqueNonNegativeIntegers(value && value.replacedSlots),
    refreshedSlots: uniqueNonNegativeIntegers(value && value.refreshedSlots),
    shuffled: Boolean(value && value.shuffled),
    replayInsertedSlot: Number.isInteger(value && value.replayInsertedSlot)
      ? value.replayInsertedSlot
      : null,
  };
}

function normalizeHistory(value) {
  return (Array.isArray(value) ? value : []).filter(function (item) {
    return item && typeof item === "object" && ["grid", "recall"].includes(item.kind);
  }).slice(-HISTORY_LIMIT).map(function (item) { return { ...item }; });
}

function appendHistory(history, event) {
  return [...normalizeHistory(history), event].slice(-HISTORY_LIMIT);
}

function ignoredSubmission(session, progress, confusionPairs, reason) {
  return {
    session,
    accepted: false,
    correct: null,
    progress,
    confusionPairs,
    attempt: null,
    reason,
  };
}

function compareReviews(left, right) {
  return left.dueQuestion - right.dueQuestion || String(left.id).localeCompare(String(right.id));
}

function chooseUnoccupiedReviewQuestion(answeredGridCount, preferredDelay, delayedReviews) {
  const occupied = new Set(delayedReviews.map(function (review) { return review.dueQuestion; }));
  const delays = [preferredDelay, 3, 4, 5].filter(function (delay, position, values) {
    return values.indexOf(delay) === position;
  });
  const availableDelay = delays.find(function (delay) {
    return !occupied.has(answeredGridCount + delay);
  });
  // With one answer and at most one newly scheduled review per grid question,
  // the three-slot window always has capacity. Keep a defensive fallback for a
  // hand-edited/corrupt queue; restoration still preserves its data safely.
  return answeredGridCount + (availableDelay || preferredDelay);
}

function requireCharacterData(value, minimumLength) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new TypeError(`최소 ${minimumLength}자의 characterData 배열이 필요합니다.`);
  }
  const indexes = new Set();
  value.forEach(function (item, position) {
    if (!item || typeof item !== "object") throw new TypeError("characterData 항목이 올바르지 않습니다.");
    const index = Number.isInteger(item.index) ? item.index : position;
    if (index < 0 || index >= 1000 || indexes.has(index) || !String(item.character || "")) {
      throw new TypeError("characterData의 인덱스 또는 한자가 올바르지 않습니다.");
    }
    indexes.add(index);
  });
  return value;
}

function getItem(data, index) {
  const direct = data[index];
  if (direct && direct.index === index) return direct;
  return data.find(function (item, position) {
    return (Number.isInteger(item.index) ? item.index : position) === index;
  }) || null;
}

function getCoupletIndex(item) {
  return Number.isInteger(item.coupletIndex) ? item.coupletIndex : Math.floor(item.index / 8);
}

function validIndexes(values, characterData) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach(function (value) {
    if (!Number.isInteger(value) || seen.has(value) || !getItem(characterData, value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

function normalizeMode(value) {
  return RECOGNITION_MODES.includes(value) ? value : "adaptive";
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function getRandom(random) {
  return typeof random === "function" ? random : Math.random;
}

function safeRandom(random) {
  const value = Number(random());
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 - Number.EPSILON : value;
}

function shuffleCopy(values, random) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(safeRandom(random) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function shuffleEnsuringChange(values, random, requireChange) {
  const shuffled = shuffleCopy(values, random);
  if (
    requireChange &&
    shuffled.length > 1 &&
    shuffled.every(function (value, index) { return value === values[index]; })
  ) {
    shuffled.push(shuffled.shift());
  }
  return shuffled;
}

function chooseDifferentSlot(length, forbiddenSlot, random) {
  const slots = Array.from({ length }, function (_, slot) { return slot; }).filter(function (slot) {
    return slot !== forbiddenSlot;
  });
  return slots[Math.floor(safeRandom(random) * slots.length)];
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function uniqueNonNegativeIntegers(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(function (value) {
    return Number.isInteger(value) && value >= 0;
  })));
}

function validIso(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("세션의 날짜 값이 올바르지 않습니다.");
  return new Date(timestamp).toISOString();
}

function normalizePromptLabel(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ko").replace(/[\s·,._-]+/g, "");
}
