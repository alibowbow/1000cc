const DAY_MS = 24 * 60 * 60 * 1000;

export const RECOGNITION_MODES = Object.freeze(["adaptive", "random1000", "weak"]);

export const DEFAULT_ADAPTIVE_WEIGHTS = Object.freeze({
  base: 1,
  unseenBonus: 4,
  dueBonus: 7,
  overduePerDay: 0.35,
  overdueCap: 5,
  wrongCount: 1.4,
  wrongCountCap: 9,
  wrongRate: 5,
  recentWrongBonus: 5,
  recentWrongWindowDays: 30,
  lowMastery: 1.35,
  streakPenalty: 0.7,
  minimum: 0.05,
});

/**
 * Return the recognition (`reverse`) dimension while remaining compatible with
 * both the v2 progress shape and small test/application-specific records.
 */
export function getRecognitionRecord(progress, index) {
  const record = progress && (progress[index] ?? progress[String(index)]);
  if (!record || typeof record !== "object") return {};
  if (record.skills && typeof record.skills.reverse === "object") {
    return record.skills.reverse;
  }
  if (record.reverse && typeof record.reverse === "object") return record.reverse;
  return record;
}

export function calculateAdaptiveWeight(index, options = {}) {
  const now = resolveNow(options.now);
  const weights = { ...DEFAULT_ADAPTIVE_WEIGHTS, ...(options.weights || {}) };
  const record = getRecognitionRecord(options.progress, index);
  const seenCount = nonNegative(record.seenCount);
  const correctCount = nonNegative(record.correctCount);
  const wrongCount = nonNegative(record.wrongCount);
  const masteryLevel = clamp(Math.floor(nonNegative(record.masteryLevel)), 0, 5);
  const currentStreak = nonNegative(record.currentStreak);
  let weight = weights.base;

  if (seenCount === 0) {
    weight += weights.unseenBonus;
  } else {
    weight += (5 - masteryLevel) * weights.lowMastery;
  }

  const dueAt = toTimestamp(record.dueAt);
  if (dueAt !== null && dueAt <= now) {
    const overdueDays = Math.max(0, (now - dueAt) / DAY_MS);
    weight += weights.dueBonus;
    weight += Math.min(weights.overdueCap, overdueDays * weights.overduePerDay);
  }

  weight += Math.min(weights.wrongCountCap, wrongCount * weights.wrongCount);
  if (seenCount > 0) weight += (wrongCount / seenCount) * weights.wrongRate;

  const lastWrongAt = toTimestamp(record.lastWrongAt);
  if (lastWrongAt !== null && lastWrongAt <= now) {
    const ageDays = (now - lastWrongAt) / DAY_MS;
    if (ageDays <= weights.recentWrongWindowDays) {
      weight += weights.recentWrongBonus * (1 - ageDays / weights.recentWrongWindowDays);
    }
  }

  if (correctCount > 0 && currentStreak > 0) {
    weight -= Math.min(weight * 0.8, currentStreak * weights.streakPenalty);
  }

  if ((options.recentTargets || []).includes(index)) {
    weight *= 0.05;
  }
  return Math.max(weights.minimum, Number.isFinite(weight) ? weight : weights.minimum);
}

export function getEligibleCharacterIndexes(characterData, options = {}) {
  if (!Array.isArray(characterData) || characterData.length === 0) return [];
  const validIndexes = new Set(
    characterData.map(function (item, position) {
      return Number.isInteger(item && item.index) ? item.index : position;
    }),
  );
  const supplied = Array.isArray(options.candidateIndexes)
    ? uniqueIndexes(options.candidateIndexes).filter(function (index) {
        return validIndexes.has(index);
      })
    : Array.from(validIndexes);
  const excluded = new Set(uniqueIndexes(options.excludeIndexes));
  let eligible = supplied.filter(function (index) {
    return !excluded.has(index);
  });

  if (options.mode === "weak") {
    const explicitWeak = new Set(uniqueIndexes(options.weakIndexes));
    const weakPool = eligible.filter(function (index) {
      if (explicitWeak.size > 0) return explicitWeak.has(index);
      const record = getRecognitionRecord(options.progress, index);
      return nonNegative(record.wrongCount) > 0 || (
        nonNegative(record.seenCount) > 0 && nonNegative(record.masteryLevel) < 3
      );
    });
    if (weakPool.length > 0) eligible = weakPool;
  }

  const recent = new Set(uniqueIndexes(options.recentTargets));
  const withoutRecent = eligible.filter(function (index) {
    return !recent.has(index);
  });
  // A repetition window should never make a small reservoir impossible to use.
  return withoutRecent.length > 0 ? withoutRecent : eligible;
}

/**
 * Select a target. `random1000` is a truly uniform choice over the eligible
 * indexes; adaptive and weak modes use the versioned recognition weights.
 */
export function selectTargetIndex(options = {}) {
  const mode = RECOGNITION_MODES.includes(options.mode) ? options.mode : "adaptive";
  const now = resolveNow(options.now);
  const candidates = getEligibleCharacterIndexes(options.characterData, {
    ...options,
    mode,
  });
  if (candidates.length === 0) return null;
  const random = normalizeRandom(options.random);
  if (mode === "random1000") {
    return candidates[Math.floor(sample(random) * candidates.length)];
  }
  return weightedChoice(
    candidates,
    function (index) {
      let weight = calculateAdaptiveWeight(index, { ...options, now });
      if (mode === "weak") {
        const record = getRecognitionRecord(options.progress, index);
        weight *= 1 + Math.min(6, nonNegative(record.wrongCount));
      }
      return weight;
    },
    random,
  );
}

export function weightedChoice(values, getWeight, random = Math.random) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const weights = values.map(function (value) {
    const weight = Number(getWeight(value));
    return Number.isFinite(weight) && weight > 0 ? weight : 0;
  });
  const total = weights.reduce(function (sum, weight) { return sum + weight; }, 0);
  if (total <= 0) return values[Math.floor(sample(normalizeRandom(random)) * values.length)];
  let cursor = sample(normalizeRandom(random)) * total;
  for (let index = 0; index < values.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return values[index];
  }
  return values.at(-1);
}

function uniqueIndexes(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter(function (value) {
    if (!Number.isInteger(value) || value < 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizeRandom(random) {
  return typeof random === "function" ? random : Math.random;
}

function sample(random) {
  const value = Number(random());
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1 - Number.EPSILON;
  return value;
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function toTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function nonNegative(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
