const DEFAULT_MAX_PAIRS = 120;
const DEFAULT_HALF_LIFE_DAYS = 90;

export function createConfusionPairKey(correctIndex, selectedIndex) {
  assertIndex(correctIndex);
  assertIndex(selectedIndex);
  return `${correctIndex}:${selectedIndex}`;
}

export function normalizeConfusionPairs(value, options = {}) {
  const maxPairs = positiveInteger(options.maxPairs, DEFAULT_MAX_PAIRS);
  const normalized = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;
  Object.entries(value).forEach(function ([key, pair]) {
    if (!pair || typeof pair !== "object") return;
    const [keyCorrect, keySelected] = String(key).split(":").map(Number);
    const correctIndex = Number.isInteger(pair.correctIndex) ? pair.correctIndex : keyCorrect;
    const selectedIndex = Number.isInteger(pair.selectedIndex) ? pair.selectedIndex : keySelected;
    if (!isIndex(correctIndex) || !isIndex(selectedIndex) || correctIndex === selectedIndex) return;
    const canonicalKey = createConfusionPairKey(correctIndex, selectedIndex);
    normalized[canonicalKey] = {
      correctIndex,
      selectedIndex,
      count: Math.max(1, Math.floor(Number(pair.count) || 1)),
      firstAt: toIso(pair.firstAt || pair.lastAt),
      lastAt: toIso(pair.lastAt || pair.firstAt),
      reviewedCount: Math.max(0, Math.floor(Number(pair.reviewedCount) || 0)),
      lastReviewedAt: toIso(pair.lastReviewedAt),
      lastReviewCorrect: pair.lastReviewCorrect === null || pair.lastReviewCorrect === undefined
        ? null
        : Boolean(pair.lastReviewCorrect),
      occurrences: normalizeOccurrences(pair.occurrences),
    };
  });
  return pruneConfusionPairs(normalized, maxPairs);
}

export function recordConfusionPair(confusionPairs, event, options = {}) {
  const correctIndex = Number(event && event.correctIndex);
  const selectedIndex = Number(event && event.selectedIndex);
  assertIndex(correctIndex);
  assertIndex(selectedIndex);
  if (correctIndex === selectedIndex) return normalizeConfusionPairs(confusionPairs, options);
  const nowIso = new Date(resolveNow(options.now)).toISOString();
  const pairs = normalizeConfusionPairs(confusionPairs, options);
  const key = createConfusionPairKey(correctIndex, selectedIndex);
  const previous = pairs[key];
  const occurrence = {
    at: nowIso,
    promptType: cleanString(event.promptType),
    selectedSlot: integerOrNull(event.selectedSlot),
    targetSlot: integerOrNull(event.targetSlot),
    replayDueQuestion: integerOrNull(event.replayDueQuestion),
  };
  pairs[key] = {
    correctIndex,
    selectedIndex,
    count: (previous ? previous.count : 0) + 1,
    firstAt: previous && previous.firstAt ? previous.firstAt : nowIso,
    lastAt: nowIso,
    reviewedCount: previous ? previous.reviewedCount : 0,
    lastReviewedAt: previous ? previous.lastReviewedAt : null,
    lastReviewCorrect: previous ? previous.lastReviewCorrect : null,
    occurrences: [...(previous ? previous.occurrences : []), occurrence].slice(-10),
  };
  return pruneConfusionPairs(pairs, positiveInteger(options.maxPairs, DEFAULT_MAX_PAIRS));
}

export function recordConfusionReview(confusionPairs, pairKey, outcome, options = {}) {
  const pairs = normalizeConfusionPairs(confusionPairs, options);
  if (!pairKey || !pairs[pairKey]) return pairs;
  const pair = pairs[pairKey];
  pairs[pairKey] = {
    ...pair,
    reviewedCount: pair.reviewedCount + 1,
    lastReviewedAt: new Date(resolveNow(options.now)).toISOString(),
    lastReviewCorrect: Boolean(outcome && outcome.correct),
  };
  return pairs;
}

export function getConfusionStrength(confusionPairs, correctIndex, candidateIndex, options = {}) {
  const pairs = normalizeConfusionPairs(confusionPairs, { maxPairs: Number.MAX_SAFE_INTEGER });
  const direct = pairs[`${correctIndex}:${candidateIndex}`];
  const reverse = pairs[`${candidateIndex}:${correctIndex}`];
  const now = resolveNow(options.now);
  return pairStrength(direct, now, options) + pairStrength(reverse, now, options) * 0.35;
}

export function getConfusedIndexes(confusionPairs, correctIndex, options = {}) {
  const pairs = normalizeConfusionPairs(confusionPairs, { maxPairs: Number.MAX_SAFE_INTEGER });
  return Object.values(pairs)
    .filter(function (pair) { return pair.correctIndex === correctIndex; })
    .sort(function (left, right) {
      return getConfusionStrength(pairs, correctIndex, right.selectedIndex, options)
        - getConfusionStrength(pairs, correctIndex, left.selectedIndex, options);
    })
    .map(function (pair) { return pair.selectedIndex; });
}

function pairStrength(pair, now, options) {
  if (!pair) return 0;
  const halfLifeDays = Number(options.halfLifeDays) > 0
    ? Number(options.halfLifeDays)
    : DEFAULT_HALF_LIFE_DAYS;
  const lastAt = pair.lastAt ? new Date(pair.lastAt).getTime() : now;
  const ageDays = Math.max(0, (now - lastAt) / (24 * 60 * 60 * 1000));
  const decay = Math.pow(0.5, ageDays / halfLifeDays);
  return Math.log2(pair.count + 1) * decay;
}

function pruneConfusionPairs(pairs, maxPairs) {
  return Object.fromEntries(
    Object.entries(pairs)
      .sort(function ([, left], [, right]) {
        return right.count - left.count || String(right.lastAt || "").localeCompare(left.lastAt || "");
      })
      .slice(0, maxPairs),
  );
}

function normalizeOccurrences(value) {
  return (Array.isArray(value) ? value : []).map(function (item) {
    return {
      at: toIso(item && item.at),
      promptType: cleanString(item && item.promptType),
      selectedSlot: integerOrNull(item && item.selectedSlot),
      targetSlot: integerOrNull(item && item.targetSlot),
      replayDueQuestion: integerOrNull(item && item.replayDueQuestion),
    };
  }).slice(-10);
}

function assertIndex(value) {
  if (!isIndex(value)) throw new RangeError("혼동 쌍의 글자 인덱스가 올바르지 않습니다.");
}

function isIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < 1000;
}

function positiveInteger(value, fallback) {
  const numeric = Math.floor(Number(value));
  return numeric > 0 ? numeric : fallback;
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

function cleanString(value) {
  return typeof value === "string" && value ? value : null;
}

function toIso(value) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}
