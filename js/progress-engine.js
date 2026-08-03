import { calculateDueAt, getDueIndexes } from "./review-scheduler.js";
import { clamp, toIsoString } from "./utils.js";

export function createProgressRecord(overrides = {}) {
  return {
    seenCount: Math.max(0, Number(overrides.seenCount) || 0),
    correctCount: Math.max(0, Number(overrides.correctCount) || 0),
    wrongCount: Math.max(0, Number(overrides.wrongCount) || 0),
    currentStreak: Math.max(0, Number(overrides.currentStreak) || 0),
    masteryLevel: clamp(Math.floor(Number(overrides.masteryLevel) || 0), 0, 5),
    lastSeenAt: toIsoString(overrides.lastSeenAt),
    lastCorrectAt: toIsoString(overrides.lastCorrectAt),
    lastWrongAt: toIsoString(overrides.lastWrongAt),
    dueAt: toIsoString(overrides.dueAt),
  };
}

export function recordAttempt(progress, index, options = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= 1000) {
    throw new RangeError("학습 기록 인덱스가 올바르지 않습니다.");
  }

  const correct = Boolean(options.correct);
  const review = Boolean(options.review);
  const now = Number(options.now) || Date.now();
  const nowIso = new Date(now).toISOString();
  const nextProgress = Object.assign({}, progress);
  const record = createProgressRecord(progress && progress[index]);

  record.seenCount += 1;
  record.lastSeenAt = nowIso;

  if (correct) {
    record.correctCount += 1;
    record.currentStreak += 1;
    record.lastCorrectAt = nowIso;

    if (record.masteryLevel < 2) {
      record.masteryLevel = 2;
    } else if (record.masteryLevel === 2 && record.currentStreak >= 2) {
      record.masteryLevel = 3;
    } else if (review && record.masteryLevel >= 3) {
      record.masteryLevel = Math.min(5, record.masteryLevel + 1);
    }
    record.dueAt = calculateDueAt(record.masteryLevel, now);
  } else {
    record.wrongCount += 1;
    record.currentStreak = 0;
    record.lastWrongAt = nowIso;
    record.masteryLevel = Math.max(1, record.masteryLevel - 1);
    record.dueAt = nowIso;
  }

  nextProgress[index] = record;
  return nextProgress;
}

export function getMasteredCount(progress, minimumLevel = 3) {
  return Object.values(progress || {}).filter(function (record) {
    return createProgressRecord(record).masteryLevel >= minimumLevel;
  }).length;
}

export function getRecentWrongIndexes(progress, limit = 40) {
  return Object.entries(progress || {})
    .filter(function ([, record]) {
      return Boolean(record && record.lastWrongAt);
    })
    .sort(function ([, left], [, right]) {
      return new Date(right.lastWrongAt).getTime() - new Date(left.lastWrongAt).getTime();
    })
    .slice(0, limit)
    .map(function ([index]) {
      return Number(index);
    });
}

export function getFrequentWrongIndexes(progress, limit = 40) {
  return Object.entries(progress || {})
    .filter(function ([, record]) {
      return Number(record && record.wrongCount) > 0;
    })
    .sort(function ([, left], [, right]) {
      const leftRate = left.wrongCount / Math.max(1, left.seenCount);
      const rightRate = right.wrongCount / Math.max(1, right.seenCount);
      return rightRate - leftRate || right.wrongCount - left.wrongCount;
    })
    .slice(0, limit)
    .map(function ([index]) {
      return Number(index);
    });
}

export { getDueIndexes };
