import { recordSkillAttempt } from "./progress-engine.js?v=1";

export const COUPLET_ORDER_SESSION_KIND = "couplet-order";
export const COUPLET_ORDER_ENGINE_VERSION = 1;

export function createCoupletOrderSession(options = {}) {
  const orderIndexes = normalizeEightIndexes(options.indexes);
  const random = typeof options.random === "function" ? options.random : Math.random;
  const now = resolveNow(options.now);
  let tileIndexes = shuffleCopy(orderIndexes, random);
  if (tileIndexes.every(function (value, index) { return value === orderIndexes[index]; })) {
    tileIndexes = [...tileIndexes.slice(1), tileIndexes[0]];
  }
  const nowIso = new Date(now).toISOString();
  return {
    kind: COUPLET_ORDER_SESSION_KIND,
    engineVersion: COUPLET_ORDER_ENGINE_VERSION,
    phase: "question",
    inputLocked: false,
    coupletIndex: Number.isInteger(options.coupletIndex)
      ? options.coupletIndex
      : Math.floor(orderIndexes[0] / 8),
    orderIndexes,
    tileIndexes,
    placedIndexes: [],
    position: 0,
    expectedIndex: orderIndexes[0],
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
  const completed = position === current.orderIndexes.length;
  // This auxiliary mode deliberately records only contextual order mastery.
  const nextProgress = recordSkillAttempt(progress, current.expectedIndex, "order", { correct, now });
  const attempt = {
    kind: "couplet-order",
    skill: "order",
    correct,
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
      expectedIndex: completed ? null : current.orderIndexes[position],
      feedback: {
        correct,
        expectedIndex: current.expectedIndex,
        selectedIndex,
        position: current.position,
        completed,
        answeredAt: nowIso,
      },
      correctCount: current.correctCount + (correct ? 1 : 0),
      wrongCount: current.wrongCount + (correct ? 0 : 1),
      history: [...current.history, attempt].slice(-40),
    },
    accepted: true,
    correct,
    progress: nextProgress,
    attempt,
  };
}

export function advanceCoupletOrderAfterFeedback(session, options = {}) {
  const current = restoreCoupletOrderSession(session);
  if (current.phase !== "feedback" || !current.feedback) return current;
  if (current.feedback.completed) {
    return {
      ...current,
      phase: "ended",
      inputLocked: true,
      feedback: null,
      endedAt: new Date(resolveNow(options.now)).toISOString(),
    };
  }
  return { ...current, phase: "question", inputLocked: false, feedback: null };
}

export function getCoupletOrderStats(session, options = {}) {
  const current = restoreCoupletOrderSession(session);
  const answered = current.correctCount + current.wrongCount;
  const end = current.endedAt ? new Date(current.endedAt).getTime() : resolveNow(options.now);
  return {
    phase: current.phase,
    position: current.position,
    total: current.orderIndexes.length,
    correctCount: current.correctCount,
    wrongCount: current.wrongCount,
    accuracy: answered > 0 ? current.correctCount / answered : 0,
    elapsedMs: Math.max(0, end - new Date(current.startedAt).getTime()),
  };
}

export function restoreCoupletOrderSession(value) {
  if (
    !value ||
    value.kind !== COUPLET_ORDER_SESSION_KIND ||
    Number(value.engineVersion) !== COUPLET_ORDER_ENGINE_VERSION
  ) {
    throw new Error("현재 8자 순서 복습 저장 형식이 올바르지 않습니다.");
  }
  const orderIndexes = normalizeEightIndexes(value.orderIndexes);
  const tileIndexes = normalizeEightIndexes(value.tileIndexes);
  if (new Set(tileIndexes).size !== 8 || tileIndexes.some(function (index) {
    return !orderIndexes.includes(index);
  })) {
    throw new Error("현재 8자 순서 타일이 원문과 일치하지 않습니다.");
  }
  const placedIndexes = (Array.isArray(value.placedIndexes) ? value.placedIndexes : []).filter(function (
    index,
    position,
    values,
  ) {
    return Number.isInteger(index) && orderIndexes.includes(index) && values.indexOf(index) === position;
  });
  if (!placedIndexes.every(function (index, position) { return index === orderIndexes[position]; })) {
    throw new Error("배치된 8자 순서가 원문과 일치하지 않습니다.");
  }
  const phase = ["question", "feedback", "ended"].includes(value.phase) ? value.phase : null;
  if (!phase) throw new Error("현재 8자 순서 복습 단계가 유효하지 않습니다.");
  const position = placedIndexes.length;
  const expectedIndex = position >= 8 ? null : orderIndexes[position];
  const feedback = value.feedback && typeof value.feedback === "object"
    ? {
        correct: Boolean(value.feedback.correct),
        expectedIndex: Number(value.feedback.expectedIndex),
        selectedIndex: Number(value.feedback.selectedIndex),
        position: Math.max(0, Math.floor(Number(value.feedback.position) || 0)),
        completed: Boolean(value.feedback.completed),
        answeredAt: validIso(value.feedback.answeredAt),
      }
    : null;
  if (phase === "feedback" && !feedback) throw new Error("순서 복습 피드백 값이 없습니다.");
  const endedAt = value.endedAt ? validIso(value.endedAt) : null;
  if (
    phase === "feedback" &&
    (feedback.completed !== (position === 8) || (feedback.completed && !feedback.correct))
  ) {
    throw new Error("순서 복습 피드백의 완료 상태가 배치 순서와 일치하지 않습니다.");
  }
  if (phase === "question" && (position >= 8 || feedback)) {
    throw new Error("순서 복습 문제 단계가 배치 순서와 일치하지 않습니다.");
  }
  if (phase === "ended" && (position !== 8 || !endedAt || feedback)) {
    throw new Error("종료된 순서 복습 저장 값이 완성 상태와 일치하지 않습니다.");
  }
  return {
    kind: COUPLET_ORDER_SESSION_KIND,
    engineVersion: COUPLET_ORDER_ENGINE_VERSION,
    phase,
    inputLocked: phase !== "question",
    coupletIndex: Math.max(0, Math.floor(Number(value.coupletIndex) || 0)),
    orderIndexes,
    tileIndexes,
    placedIndexes,
    position,
    expectedIndex,
    feedback,
    correctCount: Math.max(0, Math.floor(Number(value.correctCount) || 0)),
    wrongCount: Math.max(0, Math.floor(Number(value.wrongCount) || 0)),
    startedAt: validIso(value.startedAt),
    endedAt,
    history: (Array.isArray(value.history) ? value.history : []).filter(function (item) {
      return item && item.kind === "couplet-order";
    }).slice(-40).map(function (item) { return { ...item }; }),
  };
}

function normalizeEightIndexes(value) {
  const indexes = Array.from(new Set((Array.isArray(value) ? value : []).filter(function (index) {
    return Number.isInteger(index) && index >= 0 && index < 1000;
  })));
  if (indexes.length !== 8) throw new RangeError("현재 8자 복습에는 서로 다른 인덱스 8개가 필요합니다.");
  return indexes;
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
  if (!Number.isFinite(timestamp)) throw new Error("순서 복습 날짜 값이 올바르지 않습니다.");
  return new Date(timestamp).toISOString();
}
