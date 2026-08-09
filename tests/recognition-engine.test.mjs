import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdaptiveWeight,
  getEligibleCharacterIndexes,
  selectTargetIndex,
} from "../js/adaptive-selector.js";
import {
  calculateDistractorScore,
  selectDistractorIndexes,
} from "../js/distractor-engine.js";
import {
  createConfusionPairKey,
  getConfusionStrength,
  recordConfusionPair,
} from "../js/confusion-engine.js";
import {
  AmbiguousRecognitionPromptError,
  createGridPrompt,
  isHunPromptSafe,
  isMeaningPromptSafe,
} from "../js/recognition-prompts.js";
import {
  advanceAfterFeedback,
  createRecognitionSession,
  endRecognitionSession,
  getRecognitionStats,
  pauseRecognitionSession,
  restoreRecognitionSession,
  resumeRecognitionSession,
  submitGridAnswer,
  submitRecallAnswer,
} from "../js/recognition-engine.js";
import {
  advanceCoupletOrderAfterFeedback,
  createCoupletOrderSession,
  getCoupletOrderStats,
  restoreCoupletOrderSession,
  submitCoupletOrderAnswer,
} from "../js/couplet-order-engine.js";

const BASE_NOW = Date.UTC(2026, 7, 9, 4, 0, 0);
const CHARACTER_DATA = createCharacterData();

function createCharacterData() {
  return Array.from({ length: 1000 }, function (_, index) {
    return Object.freeze({
      index,
      character: String.fromCodePoint(0x4e00 + index),
      reading: `음${index % 31}`,
      hun: `뜻${index} 음${index % 31}`,
      contextHun: `뜻${index} 음${index % 31}`,
      gloss: `뜻${index}`,
      coupletIndex: Math.floor(index / 8),
      radical: `부수${index % 23}`,
      totalStrokes: 3 + (index % 18),
      couplet: `묶음${Math.floor(index / 8)}`,
    });
  });
}

function seededRandom(seed = 1234567) {
  let value = seed;
  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function makeOptions(seed = 100) {
  return {
    characterData: CHARACTER_DATA,
    random: seededRandom(seed),
    now: BASE_NOW,
  };
}

function answerCorrect(session, state, options) {
  const answer = submitGridAnswer(session, session.targetSlot, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  state.progress = answer.progress;
  state.confusionPairs = answer.confusionPairs;
  const next = advanceAfterFeedback(answer.session, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  return { answer, session: next };
}

test("완전 랜덤 선택기는 1,000자를 모두 조건부 균등 표본으로 삼는다", function () {
  assert.equal(getEligibleCharacterIndexes(CHARACTER_DATA).length, 1000);
  let cursor = 0;
  const exactStrata = function () {
    const value = (cursor + 0.5) / 1000;
    cursor += 1;
    return value;
  };
  const selected = Array.from({ length: 1000 }, function () {
    return selectTargetIndex({
      mode: "random1000",
      characterData: CHARACTER_DATA,
      random: exactStrata,
    });
  });
  assert.equal(new Set(selected).size, 1000);
  assert.deepEqual(selected, Array.from({ length: 1000 }, function (_, index) { return index; }));

  const random = seededRandom(77);
  const buckets = [0, 0, 0, 0];
  for (let draw = 0; draw < 20000; draw += 1) {
    const index = selectTargetIndex({ mode: "random1000", characterData: CHARACTER_DATA, random });
    buckets[Math.floor(index / 250)] += 1;
  }
  buckets.forEach(function (count) {
    assert.ok(count > 4700 && count < 5300, `bucket count ${count}`);
  });
});

test("적응형 가중치는 기한 초과·오답·낮은 숙련도를 우선한다", function () {
  const progress = {
    10: {
      skills: {
        reverse: {
          seenCount: 10,
          correctCount: 3,
          wrongCount: 7,
          masteryLevel: 1,
          currentStreak: 0,
          dueAt: new Date(BASE_NOW - 7 * 86400000).toISOString(),
          lastWrongAt: new Date(BASE_NOW - 86400000).toISOString(),
        },
      },
    },
    11: {
      skills: {
        reverse: {
          seenCount: 20,
          correctCount: 20,
          wrongCount: 0,
          masteryLevel: 5,
          currentStreak: 8,
          dueAt: new Date(BASE_NOW + 30 * 86400000).toISOString(),
        },
      },
    },
  };
  const weak = calculateAdaptiveWeight(10, { progress, now: BASE_NOW });
  const mastered = calculateAdaptiveWeight(11, { progress, now: BASE_NOW });
  assert.ok(weak > mastered * 10, `${weak} should greatly exceed ${mastered}`);

  const random = seededRandom(222);
  let weakSelections = 0;
  for (let draw = 0; draw < 1000; draw += 1) {
    if (selectTargetIndex({
      mode: "adaptive",
      characterData: CHARACTER_DATA,
      candidateIndexes: [10, 11],
      progress,
      random,
      now: BASE_NOW,
    }) === 10) weakSelections += 1;
  }
  assert.ok(weakSelections > 900, `weak selections: ${weakSelections}`);
});

test("취약 모드는 명시한 취약 글자 안에서만 고른다", function () {
  const random = seededRandom(3);
  const seen = new Set();
  for (let draw = 0; draw < 100; draw += 1) {
    seen.add(selectTargetIndex({
      mode: "weak",
      characterData: CHARACTER_DATA,
      weakIndexes: [42, 77, 991],
      random,
      now: BASE_NOW,
    }));
  }
  assert.deepEqual([...seen].sort(function (a, b) { return a - b; }), [42, 77, 991]);
});

test("취약 글자가 하나뿐이어도 정답 슬롯은 새 reservoir 글자로 교체된다", function () {
  const options = {
    characterData: CHARACTER_DATA,
    mode: "weak",
    weakIndexes: [42],
    random: function () { return 0; },
    now: BASE_NOW,
  };
  const session = createRecognitionSession(options);
  assert.equal(session.targetIndex, 42);
  const answer = submitGridAnswer(session, session.targetSlot, {
    ...options,
    progress: {},
    confusionPairs: {},
  });
  const next = advanceAfterFeedback(answer.session, {
    ...options,
    progress: answer.progress,
    confusionPairs: answer.confusionPairs,
  });
  assert.notDeepEqual(next.boardIndexes, session.boardIndexes);
  assert.ok(!next.boardIndexes.includes(42));
  assert.notEqual(next.targetIndex, 42);
});

test("스마트 후보는 혼동 쌍을 강화하고 같은 8자 묶음 동료를 하나로 제한한다", function () {
  const confusionPairs = recordConfusionPair({}, {
    correctIndex: 0,
    selectedIndex: 500,
    promptType: "hun-to-character",
    selectedSlot: 4,
    targetSlot: 7,
  }, { now: BASE_NOW });
  const distractors = selectDistractorIndexes({
    targetIndex: 0,
    count: 24,
    characterData: CHARACTER_DATA,
    confusionPairs,
    random: seededRandom(9),
    now: BASE_NOW,
  });
  assert.equal(distractors.length, 24);
  assert.equal(new Set(distractors).size, 24);
  assert.ok(distractors.includes(500));
  assert.ok(distractors.filter(function (index) { return Math.floor(index / 8) === 0; }).length <= 1);
  assert.ok(
    calculateDistractorScore(CHARACTER_DATA[0], CHARACTER_DATA[500], {
      confusionPairs,
      now: BASE_NOW,
    }) > calculateDistractorScore(CHARACTER_DATA[0], CHARACTER_DATA[501], { now: BASE_NOW }),
  );
  assert.ok(getConfusionStrength(confusionPairs, 0, 500, { now: BASE_NOW }) > 0);
  assert.equal(createConfusionPairKey(0, 500), "0:500");
});

test("뜻 또는 훈음이 보드에서 중복되면 안전한 방향으로 전환하고 둘 다 중복이면 거부한다", function () {
  const data = CHARACTER_DATA.slice();
  data[1] = { ...data[1], gloss: data[0].gloss };
  let prompt = createGridPrompt({
    targetIndex: 0,
    boardIndexes: [0, 1, 2, 3],
    characterData: data,
    preferredType: "gloss-to-character",
  });
  assert.equal(prompt.type, "hun-to-character");
  assert.equal(isMeaningPromptSafe(0, [0, 1, 2, 3], data), false);
  assert.equal(isHunPromptSafe(0, [0, 1, 2, 3], data), true);

  data[2] = { ...data[2], contextHun: data[0].contextHun, hun: data[0].hun };
  prompt = createGridPrompt({
    targetIndex: 0,
    boardIndexes: [0, 2, 3, 4],
    characterData: data,
    preferredType: "hun-to-character",
  });
  assert.equal(prompt.type, "gloss-to-character");
  assert.throws(function () {
    createGridPrompt({
      targetIndex: 0,
      boardIndexes: [0, 1, 2, 3],
      characterData: data,
    });
  }, AmbiguousRecognitionPromptError);
});

test("세션 생성기는 훈음과 뜻이 모두 같은 강한 혼동 후보를 보드에서 자동 수리한다", function () {
  const data = CHARACTER_DATA.slice();
  data[1] = {
    ...data[1],
    reading: data[0].reading,
    contextHun: data[0].contextHun,
    hun: data[0].hun,
    gloss: data[0].gloss,
  };
  const confusionPairs = recordConfusionPair({}, {
    correctIndex: 0,
    selectedIndex: 1,
  }, { now: BASE_NOW });
  const session = createRecognitionSession({
    characterData: data,
    confusionPairs,
    random: function () { return 0; },
    now: BASE_NOW,
  });
  assert.equal(session.targetIndex, 0);
  assert.ok(
    isHunPromptSafe(0, session.boardIndexes, data)
      || isMeaningPromptSafe(0, session.boardIndexes, data),
  );
  assert.doesNotThrow(function () {
    createGridPrompt({
      targetIndex: 0,
      boardIndexes: session.boardIndexes,
      characterData: data,
      random: function () { return 0; },
    });
  });
});

test("16칸과 25칸 세션은 고유 글리프와 정확히 하나의 정답을 유지한다", function () {
  [16, 25].forEach(function (boardSize) {
    const session = createRecognitionSession({
      ...makeOptions(boardSize),
      mode: "adaptive",
      boardSize,
    });
    assert.equal(session.kind, "recognition-grid");
    assert.equal(session.engineVersion, 2);
    assert.equal(session.phase, "question");
    assert.equal(session.boardIndexes.length, boardSize);
    assert.equal(new Set(session.boardIndexes).size, boardSize);
    assert.equal(session.boardIndexes.filter(function (index) {
      return index === session.targetIndex;
    }).length, 1);
    assert.equal(session.boardIndexes[session.targetSlot], session.targetIndex);
    const coupletPeers = session.boardIndexes.filter(function (index) {
      return Math.floor(index / 8) === Math.floor(session.targetIndex / 8) && index !== session.targetIndex;
    });
    assert.ok(coupletPeers.length <= 1);
  });
});

test("정답은 피드백을 잠그고 advance에서 정답 슬롯 하나만 교체한다", function () {
  const options = makeOptions(41);
  const state = { progress: {}, confusionPairs: {} };
  const session = createRecognitionSession(options);
  const before = session.boardIndexes.slice();
  const answer = submitGridAnswer(session, session.targetSlot, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  assert.equal(answer.accepted, true);
  assert.equal(answer.correct, true);
  assert.equal(answer.session.phase, "feedback");
  assert.deepEqual(answer.session.boardIndexes, before);
  const duplicate = submitGridAnswer(answer.session, session.targetSlot, {
    ...options,
    progress: answer.progress,
    confusionPairs: answer.confusionPairs,
  });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.session.answeredGridCount, 1);

  const next = advanceAfterFeedback(answer.session, {
    ...options,
    progress: answer.progress,
    confusionPairs: answer.confusionPairs,
  });
  const changedSlots = next.boardIndexes.map(function (index, slot) {
    return index === before[slot] ? -1 : slot;
  }).filter(function (slot) { return slot >= 0; });
  assert.deepEqual(changedSlots, [session.targetSlot]);
  assert.ok(!next.boardIndexes.includes(session.targetIndex));
  assert.ok(next.boardIndexes.includes(next.targetIndex));
  assert.equal(next.phase, "question");
});

test("네 문제마다 셔플하고 여덟 문제마다 약 30% 후보 교체와 recall을 예약한다", function () {
  const options = makeOptions(61);
  const state = { progress: {}, confusionPairs: {} };
  let session = createRecognitionSession(options);
  for (let question = 1; question <= 8; question += 1) {
    const result = answerCorrect(session, state, options);
    session = result.session;
    if (question < 4) assert.equal(session.lastBoardChange.shuffled, false);
    if (question === 4) {
      assert.equal(session.lastBoardChange.shuffled, true);
      assert.equal(session.lastShuffleAt, 4);
      assert.equal(session.lastBoardChange.refreshedSlots.length, 0);
    }
  }
  assert.equal(session.phase, "recall");
  assert.equal(session.lastShuffleAt, 8);
  assert.equal(session.lastRefreshAt, 8);
  assert.equal(session.lastBoardChange.shuffled, true);
  assert.equal(session.lastBoardChange.refreshedSlots.length, 5);
  assert.equal(session.recall.kind, "recall");
  assert.equal(session.recall.choices.length, 4);
  assert.equal(new Set(session.recall.choices.map(function (choice) { return choice.label; })).size, 4);
});

test("오답은 즉시 종료되고 3~5문제 뒤 다른 위치·후보로 재출제되며 혼동 쌍을 남긴다", function () {
  const options = makeOptions(91);
  const state = { progress: {}, confusionPairs: {} };
  let session = createRecognitionSession(options);
  const originalTarget = session.targetIndex;
  const originalSlot = session.targetSlot;
  const originalSignature = [...session.boardIndexes].sort(function (a, b) { return a - b; }).join(",");
  const wrongSlot = session.targetSlot === 0 ? 1 : 0;
  const selectedIndex = session.boardIndexes[wrongSlot];
  const wrong = submitGridAnswer(session, wrongSlot, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  state.progress = wrong.progress;
  state.confusionPairs = wrong.confusionPairs;
  assert.equal(wrong.correct, false);
  assert.equal(wrong.session.phase, "feedback");
  assert.equal(wrong.session.delayedReviews.length, 1);
  const dueQuestion = wrong.session.delayedReviews[0].dueQuestion;
  assert.ok(dueQuestion >= 4 && dueQuestion <= 6);
  assert.equal(state.confusionPairs[`${originalTarget}:${selectedIndex}`].count, 1);
  assert.equal(state.progress[originalTarget].skills.reverse.wrongCount, 1);

  session = advanceAfterFeedback(wrong.session, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  assert.ok(!session.boardIndexes.includes(originalTarget));
  while (session.targetIndex !== originalTarget) {
    assert.ok(session.questionNumber < dueQuestion);
    const result = answerCorrect(session, state, options);
    session = result.session;
  }
  assert.equal(session.questionNumber, dueQuestion);
  assert.ok(session.questionNumber - 1 >= 3 && session.questionNumber - 1 <= 5);
  assert.notEqual(session.targetSlot, originalSlot);
  assert.notEqual(
    [...session.boardIndexes].sort(function (a, b) { return a - b; }).join(","),
    originalSignature,
  );
  assert.equal(session.currentReview.targetIndex, originalTarget);
  assert.notEqual(session.prompt.type, wrong.session.prompt.type);
});

test("오답 일정이 연속으로 겹쳐도 모든 재출제는 원문제의 3~5문제 뒤에 나온다", function () {
  const options = makeOptions(1);
  const state = { progress: {}, confusionPairs: {} };
  const scheduledAt = new Map();
  let session = createRecognitionSession(options);
  let replayCount = 0;
  for (let answered = 0; answered < 40; answered += 1) {
    if (session.currentReview) {
      const originalQuestion = scheduledAt.get(session.currentReview.id);
      assert.ok(originalQuestion !== undefined);
      const distance = session.questionNumber - originalQuestion;
      assert.ok(distance >= 3 && distance <= 5, `${session.currentReview.id}: ${distance}`);
      replayCount += 1;
    }
    const wrongSlot = session.targetSlot === 0 ? 1 : 0;
    const result = submitGridAnswer(session, wrongSlot, {
      ...options,
      progress: state.progress,
      confusionPairs: state.confusionPairs,
    });
    state.progress = result.progress;
    state.confusionPairs = result.confusionPairs;
    const scheduledId = result.session.feedback.scheduledReviewId;
    scheduledAt.set(scheduledId, session.questionNumber);
    session = advanceAfterFeedback(result.session, {
      ...options,
      progress: state.progress,
      confusionPairs: state.confusionPairs,
    });
    if (session.phase === "recall") {
      const recall = submitRecallAnswer(session, session.recall.correctIndex, {
        ...options,
        progress: state.progress,
        confusionPairs: state.confusionPairs,
      });
      state.progress = recall.progress;
      session = advanceAfterFeedback(recall.session, options);
    }
  }
  assert.ok(replayCount > 20);
});

test("여덟 번째 그리드 뒤 역방향 카드는 reading/meaning만 기록하고 오답 콤보를 끊는다", function () {
  const options = makeOptions(121);
  const state = { progress: {}, confusionPairs: {} };
  let session = createRecognitionSession(options);
  for (let question = 0; question < 8; question += 1) {
    session = answerCorrect(session, state, options).session;
  }
  assert.equal(session.phase, "recall");
  assert.ok(session.combo > 0);
  const targetIndex = session.recall.targetIndex;
  const skill = session.recall.type === "character-to-reading" ? "reading" : "meaning";
  const reverseSeenBefore = state.progress[targetIndex].skills.reverse.seenCount;
  const wrongChoice = session.recall.choices.find(function (choice) {
    return choice.index !== session.recall.correctIndex;
  });
  const recall = submitRecallAnswer(session, wrongChoice.index, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  state.progress = recall.progress;
  assert.equal(recall.accepted, true);
  assert.equal(recall.correct, false);
  assert.equal(recall.attempt.skill, skill);
  assert.equal(recall.session.combo, 0);
  assert.equal(state.progress[targetIndex].skills[skill].wrongCount, 1);
  assert.equal(state.progress[targetIndex].skills.reverse.seenCount, reverseSeenBefore);
  session = advanceAfterFeedback(recall.session, options);
  assert.equal(session.phase, "question");
  assert.equal(session.recall, null);
});

test("세션은 question, feedback, recall, paused, ended 상태를 JSON으로 복원한다", function () {
  const options = makeOptions(151);
  const state = { progress: {}, confusionPairs: {} };
  let session = createRecognitionSession(options);
  assert.deepEqual(
    restoreRecognitionSession(JSON.parse(JSON.stringify(session)), options),
    session,
  );
  const answer = submitGridAnswer(session, session.targetSlot, {
    ...options,
    progress: state.progress,
    confusionPairs: state.confusionPairs,
  });
  assert.deepEqual(
    restoreRecognitionSession(JSON.parse(JSON.stringify(answer.session)), options),
    answer.session,
  );
  session = advanceAfterFeedback(answer.session, {
    ...options,
    progress: answer.progress,
    confusionPairs: answer.confusionPairs,
  });
  const paused = pauseRecognitionSession(session, { ...options, now: BASE_NOW + 1000 });
  assert.equal(paused.phase, "paused");
  assert.equal(restoreRecognitionSession(JSON.parse(JSON.stringify(paused)), options).phase, "paused");
  const resumed = resumeRecognitionSession(paused, { ...options, now: BASE_NOW + 5000 });
  assert.equal(resumed.phase, "question");
  assert.equal(resumed.totalPausedMs, 4000);
  const ended = endRecognitionSession(resumed, { ...options, now: BASE_NOW + 10000 });
  assert.equal(ended.phase, "ended");
  assert.equal(restoreRecognitionSession(JSON.parse(JSON.stringify(ended)), options).phase, "ended");
  assert.equal(getRecognitionStats(ended).elapsedMs, 6000);

  session = resumed;
  state.progress = answer.progress;
  state.confusionPairs = answer.confusionPairs;
  while (session.answeredGridCount < 8) session = answerCorrect(session, state, options).session;
  assert.equal(session.phase, "recall");
  assert.equal(restoreRecognitionSession(JSON.parse(JSON.stringify(session)), options).phase, "recall");
});

test("복원 경계는 잘못된 recall·paused·ended 상태를 거부한다", function () {
  const options = makeOptions(171);
  const state = { progress: {}, confusionPairs: {} };
  let session = createRecognitionSession(options);
  while (session.answeredGridCount < 8) session = answerCorrect(session, state, options).session;
  const bogusType = JSON.parse(JSON.stringify(session));
  bogusType.recall.type = "bogus";
  assert.throws(function () { restoreRecognitionSession(bogusType, options); });
  const bogusAnswer = JSON.parse(JSON.stringify(session));
  bogusAnswer.recall.correctIndex = bogusAnswer.recall.choices.find(function (choice) {
    return choice.index !== bogusAnswer.recall.targetIndex;
  }).index;
  assert.throws(function () { restoreRecognitionSession(bogusAnswer, options); });

  const paused = pauseRecognitionSession(session, { ...options, now: BASE_NOW + 1000 });
  const missingPausedAt = { ...paused, pausedAt: null };
  assert.throws(function () { restoreRecognitionSession(missingPausedAt, options); });
  const ended = endRecognitionSession(session, { ...options, now: BASE_NOW + 2000 });
  const missingEndedAt = { ...ended, endedAt: null };
  assert.throws(function () { restoreRecognitionSession(missingEndedAt, options); });
});

test("완전 랜덤 정답 성공은 후보 구성과 randomMode 메타데이터를 진척시킨다", function () {
  const options = { ...makeOptions(181), mode: "random1000" };
  const session = createRecognitionSession(options);
  const answer = submitGridAnswer(session, session.targetSlot, {
    ...options,
    progress: {},
    confusionPairs: {},
  });
  const reverse = answer.progress[session.targetIndex].skills.reverse;
  assert.equal(reverse.randomCorrectCount, 1);
  assert.equal(reverse.candidateSignatures.length, 1);
});

test("현재 8자 순서 API는 order만 기록하고 JSON 복원과 완료 통계를 제공한다", function () {
  const options = { indexes: [80, 81, 82, 83, 84, 85, 86, 87], random: seededRandom(201), now: BASE_NOW };
  let session = createCoupletOrderSession(options);
  let progress = {};
  assert.equal(session.kind, "couplet-order");
  assert.equal(session.tileIndexes.length, 8);
  assert.notDeepEqual(session.tileIndexes, session.orderIndexes);
  assert.deepEqual(restoreCoupletOrderSession(JSON.parse(JSON.stringify(session))), session);

  while (session.phase !== "ended") {
    const expected = session.expectedIndex;
    const answer = submitCoupletOrderAnswer(session, expected, { progress, now: BASE_NOW });
    progress = answer.progress;
    assert.equal(answer.attempt.skill, "order");
    assert.equal(progress[expected].skills.order.correctCount, 1);
    assert.equal(progress[expected].skills.reverse.seenCount, 0);
    session = advanceCoupletOrderAfterFeedback(answer.session, { now: BASE_NOW + 1000 });
  }
  const stats = getCoupletOrderStats(session);
  assert.equal(stats.position, 8);
  assert.equal(stats.correctCount, 8);
  assert.equal(stats.wrongCount, 0);
  assert.equal(stats.accuracy, 1);
  assert.equal(restoreCoupletOrderSession(JSON.parse(JSON.stringify(session))).phase, "ended");
});

test("현재 8자 복원은 조기 완료 feedback과 미완성 ended 상태를 거부한다", function () {
  const options = { indexes: [0, 1, 2, 3, 4, 5, 6, 7], random: seededRandom(211), now: BASE_NOW };
  const session = createCoupletOrderSession(options);
  const answer = submitCoupletOrderAnswer(session, session.expectedIndex, { progress: {}, now: BASE_NOW });
  const earlyFeedback = JSON.parse(JSON.stringify(answer.session));
  earlyFeedback.feedback.completed = true;
  assert.throws(function () { restoreCoupletOrderSession(earlyFeedback); });
  const earlyEnded = {
    ...session,
    phase: "ended",
    inputLocked: true,
    endedAt: new Date(BASE_NOW + 1000).toISOString(),
  };
  assert.throws(function () { restoreCoupletOrderSession(earlyEnded); });
});
