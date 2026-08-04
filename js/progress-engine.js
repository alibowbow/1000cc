import { calculateDueAt, getDueIndexes } from "./review-scheduler.js";
import { clamp, toIsoString } from "./utils.js";

export const SKILL_KEYS = Object.freeze(["reading", "meaning", "reverse", "order", "listening"]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createSkillRecord(overrides = {}, fallback = {}) {
  const lastCorrectAt = toIsoString(overrides.lastCorrectAt, toIsoString(fallback.lastCorrectAt));
  const fallbackDay = lastCorrectAt ? lastCorrectAt.slice(0, 10) : null;
  const correctDays = Array.isArray(overrides.correctDays)
    ? Array.from(
        new Set(
          overrides.correctDays
            .map(function (value) { return String(value); })
            .filter(function (value) { return DATE_PATTERN.test(value); }),
        ),
      ).slice(-30)
    : fallbackDay
      ? [fallbackDay]
      : [];

  return {
    seenCount: Math.max(0, Number(overrides.seenCount ?? fallback.seenCount) || 0),
    correctCount: Math.max(0, Number(overrides.correctCount ?? fallback.correctCount) || 0),
    wrongCount: Math.max(0, Number(overrides.wrongCount ?? fallback.wrongCount) || 0),
    currentStreak: Math.max(0, Number(overrides.currentStreak ?? fallback.currentStreak) || 0),
    masteryLevel: clamp(
      Math.floor(Number(overrides.masteryLevel ?? fallback.masteryLevel) || 0),
      0,
      5,
    ),
    lastSeenAt: toIsoString(overrides.lastSeenAt, toIsoString(fallback.lastSeenAt)),
    lastCorrectAt,
    lastWrongAt: toIsoString(overrides.lastWrongAt, toIsoString(fallback.lastWrongAt)),
    dueAt: toIsoString(overrides.dueAt, toIsoString(fallback.dueAt)),
    correctDays,
  };
}

export function createProgressRecord(overrides = {}) {
  const base = {
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
  const savedSkills = overrides.skills && typeof overrides.skills === "object"
    ? overrides.skills
    : null;
  const skills = {};
  SKILL_KEYS.forEach(function (skill) {
    skills[skill] = createSkillRecord(savedSkills ? savedSkills[skill] : {}, savedSkills ? {} : base);
  });
  return {
    ...base,
    skills,
    lastPracticedSkill: SKILL_KEYS.includes(overrides.lastPracticedSkill)
      ? overrides.lastPracticedSkill
      : null,
  };
}

export function recordSkillAttempt(progress, index, skill, options = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= 1000) {
    throw new RangeError("학습 기록 인덱스가 올바르지 않습니다.");
  }
  if (!SKILL_KEYS.includes(skill)) {
    throw new RangeError("학습 영역이 올바르지 않습니다.");
  }

  const correct = Boolean(options.correct);
  const now = Number(options.now) || Date.now();
  const nowIso = new Date(now).toISOString();
  const day = nowIso.slice(0, 10);
  const nextProgress = Object.assign({}, progress);
  const record = createProgressRecord(progress && progress[index]);
  const dimension = createSkillRecord(record.skills[skill]);

  record.seenCount += 1;
  record.lastSeenAt = nowIso;
  record.lastPracticedSkill = skill;
  dimension.seenCount += 1;
  dimension.lastSeenAt = nowIso;

  if (correct) {
    record.correctCount += 1;
    record.currentStreak += 1;
    record.lastCorrectAt = nowIso;
    dimension.correctCount += 1;
    dimension.currentStreak += 1;
    dimension.lastCorrectAt = nowIso;
    if (!dimension.correctDays.includes(day)) {
      dimension.correctDays.push(day);
      dimension.correctDays = dimension.correctDays.slice(-30);
    }
    const repeatedLevel = masteryFromDistinctDays(dimension.correctDays.length);
    dimension.masteryLevel = Math.max(dimension.masteryLevel, repeatedLevel);
    dimension.dueAt = calculateDueAt(dimension.masteryLevel, now);
  } else {
    record.wrongCount += 1;
    record.currentStreak = 0;
    record.lastWrongAt = nowIso;
    dimension.wrongCount += 1;
    dimension.currentStreak = 0;
    dimension.lastWrongAt = nowIso;
    dimension.masteryLevel = Math.max(1, dimension.masteryLevel - 1);
    dimension.dueAt = nowIso;
  }

  record.skills[skill] = dimension;
  record.masteryLevel = aggregateSkillMastery(record.skills, record.seenCount);
  record.dueAt = earliestDueAt(record.skills) || nowIso;
  nextProgress[index] = record;
  return nextProgress;
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

export function getWeakestSkill(record) {
  const normalized = createProgressRecord(record);
  const practiced = SKILL_KEYS.filter(function (skill) {
    return normalized.skills[skill].seenCount > 0;
  });
  const candidates = practiced.length > 0 ? practiced : SKILL_KEYS;
  return candidates.slice().sort(function (left, right) {
    const a = normalized.skills[left];
    const b = normalized.skills[right];
    return (
      a.masteryLevel - b.masteryLevel ||
      b.wrongCount - a.wrongCount ||
      new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime() ||
      a.correctCount - b.correctCount
    );
  })[0];
}

export function getSkillMastery(record, skill) {
  if (!SKILL_KEYS.includes(skill)) return 0;
  return createProgressRecord(record).skills[skill].masteryLevel;
}

function masteryFromDistinctDays(count) {
  if (count <= 0) return 1;
  if (count === 1) return 2;
  if (count === 2) return 3;
  if (count < 5) return 4;
  return 5;
}

function aggregateSkillMastery(skills, seenCount) {
  const total = SKILL_KEYS.reduce(function (sum, skill) {
    return sum + createSkillRecord(skills[skill]).masteryLevel;
  }, 0);
  return Math.max(seenCount > 0 ? 1 : 0, Math.floor(total / SKILL_KEYS.length));
}

function earliestDueAt(skills) {
  return SKILL_KEYS.map(function (skill) {
    return createSkillRecord(skills[skill]).dueAt;
  })
    .filter(Boolean)
    .sort()[0] || null;
}

export { getDueIndexes };
