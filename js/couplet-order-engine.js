import { recordSkillAttempt } from "./progress-engine.js?v=1";

export const COUPLET_ORDER_SESSION_KIND = "couplet-order";
export const COUPLET_ORDER_ENGINE_VERSION = 2;
export const DEFAULT_COUPLET_ORDER_SET_COUNT = 10;

const TOTAL_COUPLETS = 125;
const CHARACTERS_PER_COUPLET = 8;
const MAX_HISTORY = 240;

export function selectRandomCoupletIndexes(
  totalCouplets = TOTAL_COUPLETS,
  setCount = DEFAULT_COUPLET_ORDER_SET_COUNT,
  random = Math.random,
) {
  const total = Math.floor(Number(totalCouplets));
  const requested = Math.floor(Number(setCount));
  if (!Number.isInteger(total) || total < 1 || total > TOTAL_COUPLETS) {
    throw new RangeError("랜덤 8자 순서 게임의 전체 연 수가 올바르지 않습니다.");
  }
  if (!Number.isInteger(requested) || requested < 1 || requested > total) {
    throw new RangeError("랜덤 8자 순서 게임의 세트 수가 올바르지 않습니다.");
  }
  return shuffleCopy(
    Array.from({ length: total }, function (_, index) { return index; }),
    typeof random === "function" ? random : Math.random,
  ).slice(0, requested);
}

export function createCoupletOrderSession(options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const now = resolveNow(options.now);
  const coupletIndexes = resolveInitialCoupletIndexes(options, random);
  const rounds = coupletIndexes.map(function (coupletIndex) {
    return createRound(coupletIndex, random);
  });
  const firstRound = rounds[0];
  const nowIso = new Date(now).toISOString();
  return {
    kind: COUPLET_ORDER_SESSION_KIND,
    engineVersion: COUPLET_ORDER_ENGINE_VERSION,
    phase: "question",
    inputLocked: false,
    endReason: null,
    coupletIndexes,
    rounds,
    roundIndex: 0,
    roundCount: rounds.length,
    coupletIndex: firstRound.coupletIndex,
    orderIndexes: firstRound.orderIndexes.slice(),
    tileIndexes: firstRound.tileIndexes.slice(),
    placedIndexes: [],
    position: 0,
    expectedIndex: firstRound.orderIndexes[0],
    feedback: null,
    correctCount: 0,
    wrongCount: 0,
    startedAt: nowIso,
    endedAt: null,
    history: [],
  };
}

export function submitCoupletOrderAnswer(session, selectedIndex, options = {}) {
  const current = restoreCoupletOrderSession(session);
  const progress = options.progress && typeof options.progress === "object" ? options.progress : {};
  if (current.phase !== "question" || current.inputLocked) {
    return {
      session: current,
      accepted: false,
      correct: null,
      progress,
      attempt: null,
      reason: "phase-locked",
    };
  }
  if (!current.tileIndexes.includes(selectedIndex) || current.placedIndexes.includes(selectedIndex)) {
    throw new RangeError("선택한 8자 순서 타일이 올바르지 않습니다.");
  }
  const now = resolveNow(options.now);
  const nowIso = new Date(now).toISOString();
  const correct = selectedIndex === current.expectedIndex;
  const placedIndexes = correct
    ? [...current.placedIndexes, selectedIndex]
    : current.placedIndexes.slice();
  const position = placedIndexes.length;
  const roundCompleted = position === current.orderIndexes.length;
  const sessionCompleted = roundCompleted && current.roundIndex === current.roundCount - 1;
  const nextProgress = recordSkillAttempt(progress, current.expectedIndex, "order", { correct, now });
  const attempt = {
    kind: "couplet-order",
    skill: "order",
    correct,
    roundIndex: current.roundIndex,
    coupletIndex: current.coupletIndex,
    expectedIndex: current.expectedIndex,
    selectedIndex,
    position: current.position,
    answeredAt: nowIso,
  };
  return {
    session: {
      ...current,
      phase: "feedback",
      inputLocked: true,
      placedIndexes,
      position,
      expectedIndex: roundCompleted ? null : current.orderIndexes[position],
      feedback: {
        correct,
        roundIndex: current.roundIndex,
        coupletIndex: current.coupletIndex,
        expectedIndex: current.expectedIndex,
        selectedIndex,
        position: current.position,
        roundCompleted,
        sessionCompleted,
        answeredAt: nowIso,
      },
      correctCount: current.correctCount + (correct ? 1 : 0),
      wrongCount: current.wrongCount + (correct ? 0 : 1),
      history: [...current.history, attempt].slice(-MAX_HISTORY),
    },
    accepted: true,
    correct,
    roundCompleted,
    sessionCompleted,
    progress: nextProgress,
    attempt,
  };
}

export function advanceCoupletOrderAfterFeedback(session, options = {}) {
  const current = restoreCoupletOrderSession(session);
  if (current.phase !== "feedback" || !current.feedback) return current;
  if (current.feedback.sessionCompleted) {
    return {
      ...current,
      phase: "ended",
      inputLocked: true,
      endReason: "completed",
      feedback: null,
      endedAt: new Date(resolveNow(options.now)).toISOString(),
    };
  }
  if (current.feedback.roundCompleted) {
    const nextRoundIndex = current.roundIndex + 1;
    const nextRound = current.rounds[nextRoundIndex];
    return {
      ...current,
      phase: "question",
      inputLocked: false,
      roundIndex: nextRoundIndex,
      coupletIndex: nextRound.coupletIndex,
      orderIndexes: nextRound.orderIndexes.slice(),
      tileIndexes: nextRound.tileIndexes.slice(),
      placedIndexes: [],
      position: 0,
      expectedIndex: nextRound.orderIndexes[0],
      feedback: null,
    };
  }
  return { ...current, phase: "question", inputLocked: false, feedback: null };
}

export function endCoupletOrderSession(session, options = {}) {
  const current = restoreCoupletOrderSession(session);
  if (current.phase === "ended") return current;
  return {
    ...current,
    phase: "ended",
    inputLocked: true,
    endReason: "quit",
    feedback: null,
    endedAt: new Date(resolveNow(options.now)).toISOString(),
  };
}

export function getCoupletOrderStats(session, options = {}) {
  const current = restoreCoupletOrderSession(session);
  const answered = current.correctCount + current.wrongCount;
  const end = current.endedAt ? new Date(current.endedAt).getTime() : resolveNow(options.now);
  const completedRounds = current.roundIndex + (current.position === CHARACTERS_PER_COUPLET ? 1 : 0);
  return {
    phase: current.phase,
    round: current.roundIndex + 1,
    roundIndex: current.roundIndex,
    roundCount: current.roundCount,
    completedRounds,
    position: current.position,
    total: current.orderIndexes.length,
    completedCharacters: current.roundIndex * CHARACTERS_PER_COUPLET + current.position,
    totalCharacters: current.roundCount * CHARACTERS_PER_COUPLET,
    correctCount: current.correctCount,
    wrongCount: current.wrongCount,
    accuracy: answered > 0 ? current.correctCount / answered : 0,
    elapsedMs: Math.max(0, end - new Date(current.startedAt).getTime()),
  };
}

export function restoreCoupletOrderSession(value) {
  if (!value || value.kind !== COUPLET_ORDER_SESSION_KIND) {
    throw new Error("랜덤 8자 순서 게임 저장 형식이 올바르지 않습니다.");
  }
  if (Number(value.engineVersion) === 1) return restoreLegacySession(value);
  if (Number(value.engineVersion) !== COUPLET_ORDER_ENGINE_VERSION) {
    throw new Error("랜덤 8자 순서 게임 저장 형식이 올바르지 않습니다.");
  }

  const rounds = normalizeRounds(value.rounds);
  const coupletIndexes = rounds.map(function (round) { return round.coupletIndex; });
  if (
    Array.isArray(value.coupletIndexes) &&
    !sameIndexes(value.coupletIndexes, coupletIndexes)
  ) {
    throw new Error("랜덤 8자 순서 게임의 세트 목록이 일치하지 않습니다.");
  }
  const roundIndex = Math.floor(Number(value.roundIndex));
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= rounds.length) {
    throw new Error("랜덤 8자 순서 게임의 현재 세트가 올바르지 않습니다.");
  }
  const currentRound = rounds[roundIndex];
  if (Number(value.coupletIndex) !== currentRound.coupletIndex) {
    throw new Error("랜덤 8자 순서 게임의 현재 연이 일치하지 않습니다.");
  }
  if (!sameIndexes(value.orderIndexes, currentRound.orderIndexes)) {
    throw new Error("랜덤 8자 순서 게임의 원문 순서가 일치하지 않습니다.");
  }
  if (!sameIndexes(value.tileIndexes, currentRound.tileIndexes)) {
    throw new Error("랜덤 8자 순서 게임의 타일 순서가 일치하지 않습니다.");
  }

  const placedIndexes = normalizePlacedIndexes(value.placedIndexes, currentRound.orderIndexes);
  const position = placedIndexes.length;
  const expectedIndex = position >= CHARACTERS_PER_COUPLET
    ? null
    : currentRound.orderIndexes[position];
  const phase = ["question", "feedback", "ended"].includes(value.phase) ? value.phase : null;
  if (!phase) throw new Error("랜덤 8자 순서 게임 단계가 유효하지 않습니다.");
  const feedback = normalizeFeedback(value.feedback);
  if (phase === "feedback" && !feedback) {
    throw new Error("랜덤 8자 순서 게임 피드백 값이 없습니다.");
  }
  if (feedback) {
    const roundCompleted = position === CHARACTERS_PER_COUPLET;
    const sessionCompleted = roundCompleted && roundIndex === rounds.length - 1;
    if (
      feedback.roundIndex !== roundIndex ||
      feedback.coupletIndex !== currentRound.coupletIndex ||
      feedback.roundCompleted !== roundCompleted ||
      feedback.sessionCompleted !== sessionCompleted ||
      (roundCompleted && !feedback.correct)
    ) {
      throw new Error("랜덤 8자 순서 게임 피드백의 완료 상태가 일치하지 않습니다.");
    }
  }
  if (phase === "question" && (position >= CHARACTERS_PER_COUPLET || feedback)) {
    throw new Error("랜덤 8자 순서 게임 문제 단계가 배치 순서와 일치하지 않습니다.");
  }

  const endReason = phase === "ended" && ["completed", "quit"].includes(value.endReason)
    ? value.endReason
    : null;
  const endedAt = value.endedAt ? validIso(value.endedAt) : null;
  if (phase === "ended") {
    if (!endReason || !endedAt || feedback) {
      throw new Error("종료된 랜덤 8자 순서 게임 값이 올바르지 않습니다.");
    }
    if (
      endReason === "completed" &&
      (roundIndex !== rounds.length - 1 || position !== CHARACTERS_PER_COUPLET)
    ) {
      throw new Error("완료된 랜덤 8자 순서 게임이 10세트를 모두 마치지 않았습니다.");
    }
  } else if (value.endedAt || value.endReason) {
    throw new Error("진행 중인 랜덤 8자 순서 게임에 종료 값이 있습니다.");
  }

  return {
    kind: COUPLET_ORDER_SESSION_KIND,
    engineVersion: COUPLET_ORDER_ENGINE_VERSION,
    phase,
    inputLocked: phase !== "question",
    endReason,
    coupletIndexes,
    rounds,
    roundIndex,
    roundCount: rounds.length,
    coupletIndex: currentRound.coupletIndex,
    orderIndexes: currentRound.orderIndexes.slice(),
    tileIndexes: currentRound.tileIndexes.slice(),
    placedIndexes,
    position,
    expectedIndex,
    feedback: phase === "feedback" ? feedback : null,
    correctCount: Math.max(0, Math.floor(Number(value.correctCount) || 0)),
    wrongCount: Math.max(0, Math.floor(Number(value.wrongCount) || 0)),
    startedAt: validIso(value.startedAt),
    endedAt,
    history: normalizeHistory(value.history),
  };
}

function restoreLegacySession(value) {
  const orderIndexes = normalizeEightIndexes(value.orderIndexes);
  const coupletIndex = Number.isInteger(value.coupletIndex)
    ? value.coupletIndex
    : Math.floor(orderIndexes[0] / CHARACTERS_PER_COUPLET);
  if (!sameIndexes(orderIndexes, indexesForCouplet(coupletIndex))) {
    throw new Error("기존 8자 순서 복습 원문이 올바르지 않습니다.");
  }
  const tileIndexes = normalizeTileIndexes(value.tileIndexes, orderIndexes);
  const placedIndexes = normalizePlacedIndexes(value.placedIndexes, orderIndexes);
  const position = placedIndexes.length;
  const phase = ["question", "feedback", "ended"].includes(value.phase) ? value.phase : null;
  if (!phase) throw new Error("기존 8자 순서 복습 단계가 유효하지 않습니다.");
  const oldFeedback = value.feedback && typeof value.feedback === "object"
    ? {
        correct: Boolean(value.feedback.correct),
        roundIndex: 0,
        coupletIndex,
        expectedIndex: Number(value.feedback.expectedIndex),
        selectedIndex: Number(value.feedback.selectedIndex),
        position: Math.max(0, Math.floor(Number(value.feedback.position) || 0)),
        roundCompleted: Boolean(value.feedback.completed),
        sessionCompleted: Boolean(value.feedback.completed),
        answeredAt: validIso(value.feedback.answeredAt),
      }
    : null;
  if (phase === "feedback" && !oldFeedback) {
    throw new Error("기존 8자 순서 복습 피드백 값이 없습니다.");
  }
  if (phase === "question" && (position >= CHARACTERS_PER_COUPLET || oldFeedback)) {
    throw new Error("기존 8자 순서 복습 문제 단계가 올바르지 않습니다.");
  }
  if (
    oldFeedback &&
    (oldFeedback.roundCompleted !== (position === CHARACTERS_PER_COUPLET) ||
      (oldFeedback.roundCompleted && !oldFeedback.correct))
  ) {
    throw new Error("기존 8자 순서 복습 피드백 완료 상태가 올바르지 않습니다.");
  }
  const endedAt = value.endedAt ? validIso(value.endedAt) : null;
  if (phase === "ended" && (position !== CHARACTERS_PER_COUPLET || !endedAt || oldFeedback)) {
    throw new Error("종료된 기존 8자 순서 복습 값이 올바르지 않습니다.");
  }
  return {
    kind: COUPLET_ORDER_SESSION_KIND,
    engineVersion: COUPLET_ORDER_ENGINE_VERSION,
    phase,
    inputLocked: phase !== "question",
    endReason: phase === "ended" ? "completed" : null,
    coupletIndexes: [coupletIndex],
    rounds: [{ coupletIndex, orderIndexes: orderIndexes.slice(), tileIndexes: tileIndexes.slice() }],
    roundIndex: 0,
    roundCount: 1,
    coupletIndex,
    orderIndexes,
    tileIndexes,
    placedIndexes,
    position,
    expectedIndex: position >= CHARACTERS_PER_COUPLET ? null : orderIndexes[position],
    feedback: phase === "feedback" ? oldFeedback : null,
    correctCount: Math.max(0, Math.floor(Number(value.correctCount) || 0)),
    wrongCount: Math.max(0, Math.floor(Number(value.wrongCount) || 0)),
    startedAt: validIso(value.startedAt),
    endedAt,
    history: normalizeHistory(value.history),
  };
}

function resolveInitialCoupletIndexes(options, random) {
  if (Array.isArray(options.coupletIndexes)) {
    return normalizeCoupletIndexes(options.coupletIndexes);
  }
  if (Array.isArray(options.indexes)) {
    const indexes = normalizeEightIndexes(options.indexes);
    const coupletIndex = Number.isInteger(options.coupletIndex)
      ? options.coupletIndex
      : Math.floor(indexes[0] / CHARACTERS_PER_COUPLET);
    if (!sameIndexes(indexes, indexesForCouplet(coupletIndex))) {
      throw new RangeError("8자 원문 인덱스가 연의 순서와 일치하지 않습니다.");
    }
    return [coupletIndex];
  }
  return selectRandomCoupletIndexes(
    Number.isInteger(options.totalCouplets) ? options.totalCouplets : TOTAL_COUPLETS,
    Number.isInteger(options.setCount) ? options.setCount : DEFAULT_COUPLET_ORDER_SET_COUNT,
    random,
  );
}

function createRound(coupletIndex, random) {
  const orderIndexes = indexesForCouplet(coupletIndex);
  let tileIndexes = shuffleCopy(orderIndexes, random);
  if (sameIndexes(tileIndexes, orderIndexes)) {
    tileIndexes = [...tileIndexes.slice(1), tileIndexes[0]];
  }
  return { coupletIndex, orderIndexes, tileIndexes };
}

function normalizeRounds(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > TOTAL_COUPLETS) {
    throw new Error("랜덤 8자 순서 게임의 세트 목록이 올바르지 않습니다.");
  }
  const seen = new Set();
  return value.map(function (round) {
    if (!round || typeof round !== "object") {
      throw new Error("랜덤 8자 순서 게임 세트 값이 올바르지 않습니다.");
    }
    const coupletIndex = Math.floor(Number(round.coupletIndex));
    if (
      !Number.isInteger(coupletIndex) ||
      coupletIndex < 0 ||
      coupletIndex >= TOTAL_COUPLETS ||
      seen.has(coupletIndex)
    ) {
      throw new Error("랜덤 8자 순서 게임에는 서로 다른 연이 필요합니다.");
    }
    seen.add(coupletIndex);
    const orderIndexes = normalizeEightIndexes(round.orderIndexes);
    if (!sameIndexes(orderIndexes, indexesForCouplet(coupletIndex))) {
      throw new Error("랜덤 8자 순서 게임 세트의 원문이 올바르지 않습니다.");
    }
    const tileIndexes = normalizeTileIndexes(round.tileIndexes, orderIndexes);
    return { coupletIndex, orderIndexes, tileIndexes };
  });
}

function normalizeCoupletIndexes(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > TOTAL_COUPLETS) {
    throw new RangeError("랜덤 8자 순서 게임에는 한 세트 이상의 연이 필요합니다.");
  }
  const indexes = value.map(function (index) { return Math.floor(Number(index)); });
  if (indexes.some(function (index) {
    return !Number.isInteger(index) || index < 0 || index >= TOTAL_COUPLETS;
  }) || new Set(indexes).size !== indexes.length) {
    throw new RangeError("랜덤 8자 순서 게임에는 서로 다른 유효한 연이 필요합니다.");
  }
  return indexes;
}

function normalizeEightIndexes(value) {
  const indexes = Array.isArray(value) ? value.slice() : [];
  if (
    indexes.length !== CHARACTERS_PER_COUPLET ||
    indexes.some(function (index) {
      return !Number.isInteger(index) || index < 0 || index >= TOTAL_COUPLETS * CHARACTERS_PER_COUPLET;
    }) ||
    new Set(indexes).size !== CHARACTERS_PER_COUPLET
  ) {
    throw new RangeError("8자 순서 게임에는 서로 다른 인덱스 8개가 필요합니다.");
  }
  return indexes;
}

function normalizeTileIndexes(value, orderIndexes) {
  const tileIndexes = normalizeEightIndexes(value);
  if (tileIndexes.some(function (index) { return !orderIndexes.includes(index); })) {
    throw new Error("8자 순서 타일이 원문과 일치하지 않습니다.");
  }
  return tileIndexes;
}

function normalizePlacedIndexes(value, orderIndexes) {
  const placedIndexes = Array.isArray(value) ? value.slice() : [];
  if (
    placedIndexes.length > CHARACTERS_PER_COUPLET ||
    placedIndexes.some(function (index, position) {
      return !Number.isInteger(index) || index !== orderIndexes[position];
    })
  ) {
    throw new Error("배치된 8자 순서가 원문과 일치하지 않습니다.");
  }
  return placedIndexes;
}

function normalizeFeedback(value) {
  if (!value || typeof value !== "object") return null;
  return {
    correct: Boolean(value.correct),
    roundIndex: Math.max(0, Math.floor(Number(value.roundIndex) || 0)),
    coupletIndex: Math.max(0, Math.floor(Number(value.coupletIndex) || 0)),
    expectedIndex: Number(value.expectedIndex),
    selectedIndex: Number(value.selectedIndex),
    position: Math.max(0, Math.floor(Number(value.position) || 0)),
    roundCompleted: Boolean(value.roundCompleted),
    sessionCompleted: Boolean(value.sessionCompleted),
    answeredAt: validIso(value.answeredAt),
  };
}

function normalizeHistory(value) {
  return (Array.isArray(value) ? value : []).filter(function (item) {
    return item && item.kind === "couplet-order";
  }).slice(-MAX_HISTORY).map(function (item) { return { ...item }; });
}

function indexesForCouplet(coupletIndex) {
  const value = Math.floor(Number(coupletIndex));
  if (!Number.isInteger(value) || value < 0 || value >= TOTAL_COUPLETS) {
    throw new RangeError("8자 연 번호가 올바르지 않습니다.");
  }
  return Array.from({ length: CHARACTERS_PER_COUPLET }, function (_, offset) {
    return value * CHARACTERS_PER_COUPLET + offset;
  });
}

function sameIndexes(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every(
    function (value, index) { return value === right[index]; },
  );
}

function shuffleCopy(values, random) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = Number(random());
    const sample = !Number.isFinite(value) || value <= 0
      ? 0
      : value >= 1
        ? 1 - Number.EPSILON
        : value;
    const target = Math.floor(sample * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function validIso(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("순서 게임 날짜 값이 올바르지 않습니다.");
  return new Date(timestamp).toISOString();
}
