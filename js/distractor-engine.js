import { getConfusionStrength } from "./confusion-engine.js?v=1";

export const DEFAULT_DISTRACTOR_SIGNALS = Object.freeze({
  confusion: 12,
  sameReading: 10,
  sameRadical: 6,
  closeStrokes: 4,
  similarMeaning: 3,
  sameCouplet: 2,
  recentBoardPenalty: 3,
});

export function calculateDistractorScore(target, candidate, options = {}) {
  if (!target || !candidate || target.index === candidate.index) return -Infinity;
  const signals = { ...DEFAULT_DISTRACTOR_SIGNALS, ...(options.signals || {}) };
  let score = 0;
  const confusion = getConfusionStrength(
    options.confusionPairs,
    target.index,
    candidate.index,
    { now: options.now },
  );
  score += confusion * signals.confusion;
  if (sameText(target.reading, candidate.reading)) score += signals.sameReading;
  if (sameText(target.radical, candidate.radical)) score += signals.sameRadical;

  const strokeDifference = Math.abs(Number(target.totalStrokes) - Number(candidate.totalStrokes));
  if (Number.isFinite(strokeDifference) && strokeDifference <= 2) {
    score += signals.closeStrokes * (1 - strokeDifference / 4);
  }

  if (meaningSimilarity(target, candidate) > 0) {
    score += signals.similarMeaning * meaningSimilarity(target, candidate);
  }
  if (getCoupletIndex(target) === getCoupletIndex(candidate)) score += signals.sameCouplet;
  if ((options.recentBoardIndexes || []).includes(candidate.index)) {
    score -= signals.recentBoardPenalty;
  }
  return score;
}

export function rankDistractorIndexes(options = {}) {
  const data = requireCharacterData(options.characterData);
  const target = getItem(data, options.targetIndex);
  if (!target) throw new RangeError("정답 글자 인덱스가 데이터에 없습니다.");
  const excluded = new Set([target.index, ...uniqueIndexes(options.excludeIndexes)]);
  const candidateIndexes = Array.isArray(options.candidateIndexes)
    ? uniqueIndexes(options.candidateIndexes)
    : data.map(function (item) { return item.index; });
  const random = typeof options.random === "function" ? options.random : Math.random;

  return candidateIndexes
    .filter(function (index) {
      const candidate = getItem(data, index);
      return candidate && !excluded.has(index) && candidate.character !== target.character;
    })
    .map(function (index) {
      return {
        index,
        score: calculateDistractorScore(target, getItem(data, index), options),
        tie: safeRandom(random),
      };
    })
    .sort(function (left, right) {
      return right.score - left.score || left.tie - right.tie || left.index - right.index;
    })
    .map(function (entry) { return entry.index; });
}

/**
 * Pick unique smart distractors while capping the target's couplet to one peer.
 * A board-wide cap of two glyphs per couplet also keeps every reservoir member
 * eligible to become the next target under the same rule.
 */
export function selectDistractorIndexes(options = {}) {
  const count = Math.max(0, Math.floor(Number(options.count) || 0));
  if (count === 0) return [];
  const data = requireCharacterData(options.characterData);
  const target = getItem(data, options.targetIndex);
  if (!target) throw new RangeError("정답 글자 인덱스가 데이터에 없습니다.");
  const existing = uniqueIndexes(options.existingIndexes).filter(function (index) {
    return Boolean(getItem(data, index));
  });
  const selected = [];
  const usedIndexes = new Set([target.index, ...existing, ...uniqueIndexes(options.excludeIndexes)]);
  const usedGlyphs = new Set([target.character]);
  existing.forEach(function (index) { usedGlyphs.add(getItem(data, index).character); });
  const coupletCounts = countCouplets([target.index, ...existing], data);
  const targetCouplet = getCoupletIndex(target);
  const maxTargetPeers = Number.isInteger(options.maxTargetCoupletPeers)
    ? Math.max(0, options.maxTargetCoupletPeers)
    : 1;
  const maxPerCouplet = Number.isInteger(options.maxPerCouplet)
    ? Math.max(1, options.maxPerCouplet)
    : 2;
  const ranked = rankDistractorIndexes({ ...options, excludeIndexes: Array.from(usedIndexes) });

  function trySelect(index, relaxCoupletCap) {
    const item = getItem(data, index);
    if (!item || usedIndexes.has(index) || usedGlyphs.has(item.character)) return false;
    const couplet = getCoupletIndex(item);
    const countInCouplet = coupletCounts.get(couplet) || 0;
    if (!relaxCoupletCap && countInCouplet >= maxPerCouplet) return false;
    if (
      couplet === targetCouplet &&
      countInCouplet - 1 >= maxTargetPeers
    ) return false;
    selected.push(index);
    usedIndexes.add(index);
    usedGlyphs.add(item.character);
    coupletCounts.set(couplet, countInCouplet + 1);
    return true;
  }

  for (const index of ranked) {
    trySelect(index, false);
    if (selected.length === count) return selected;
  }
  // The target-couplet cap is never relaxed; only the global diversity cap is.
  for (const index of ranked) {
    trySelect(index, true);
    if (selected.length === count) return selected;
  }
  throw new RangeError(`서로 다른 한자 후보 ${count}개를 만들 수 없습니다.`);
}

export function calculateDistractorDifficulty(options = {}) {
  const data = requireCharacterData(options.characterData);
  const target = getItem(data, options.targetIndex);
  if (!target) return 0;
  const scores = uniqueIndexes(options.boardIndexes)
    .filter(function (index) { return index !== target.index; })
    .map(function (index) {
      return calculateDistractorScore(target, getItem(data, index), options);
    })
    .filter(Number.isFinite);
  if (scores.length === 0) return 0;
  const average = scores.reduce(function (sum, value) { return sum + value; }, 0) / scores.length;
  return Math.max(0, Math.min(1, average / 12));
}

function meaningSimilarity(left, right) {
  const a = normalizeText(left.gloss || left.meaning);
  const b = normalizeText(right.gloss || right.meaning);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.7;
  const aTokens = new Set(a.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const bTokens = new Set(b.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  aTokens.forEach(function (token) { if (bTokens.has(token)) overlap += 1; });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function countCouplets(indexes, data) {
  const counts = new Map();
  indexes.forEach(function (index) {
    const item = getItem(data, index);
    if (!item) return;
    const couplet = getCoupletIndex(item);
    counts.set(couplet, (counts.get(couplet) || 0) + 1);
  });
  return counts;
}

function getCoupletIndex(item) {
  return Number.isInteger(item.coupletIndex) ? item.coupletIndex : Math.floor(item.index / 8);
}

function getItem(data, index) {
  const direct = data[index];
  if (direct && direct.index === index) return direct;
  return data.find(function (item) { return item.index === index; });
}

function requireCharacterData(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("characterData 배열이 필요합니다.");
  }
  return value;
}

function uniqueIndexes(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(function (value) {
    return Number.isInteger(value) && value >= 0;
  })));
}

function sameText(left, right) {
  const a = normalizeText(left);
  return Boolean(a) && a === normalizeText(right);
}

function normalizeText(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ko");
}

function safeRandom(random) {
  const value = Number(random());
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 - Number.EPSILON : value;
}
