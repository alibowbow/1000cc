export const OVERVIEW_DESKTOP_PAGE_SIZE = 200;
export const OVERVIEW_MOBILE_PAGE_SIZE = 40;

export function getOverviewPageSize(compact) {
  return compact ? OVERVIEW_MOBILE_PAGE_SIZE : OVERVIEW_DESKTOP_PAGE_SIZE;
}

export function normalizeOverviewRangeStart(value, pageSize, totalCharacters = 1000) {
  const safeTotal = Math.max(1, Math.floor(Number(totalCharacters) || 1));
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || safeTotal));
  const index = Math.min(safeTotal - 1, Math.max(0, Math.floor(Number(value) || 0)));
  return Math.floor(index / safePageSize) * safePageSize;
}

export function createOverviewRangeStarts(pageSize, totalCharacters = 1000) {
  const safeTotal = Math.max(1, Math.floor(Number(totalCharacters) || 1));
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || safeTotal));
  return Array.from(
    { length: Math.ceil(safeTotal / safePageSize) },
    function (_, pageIndex) { return pageIndex * safePageSize; },
  );
}

export function createOverviewIndexes(rangeStart, pageSize, totalCharacters = 1000) {
  const safeTotal = Math.max(1, Math.floor(Number(totalCharacters) || 1));
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || safeTotal));
  const start = normalizeOverviewRangeStart(rangeStart, safePageSize, safeTotal);
  return Array.from(
    { length: Math.min(safePageSize, safeTotal - start) },
    function (_, offset) { return start + offset; },
  );
}

export function shuffleOverviewIndexes(indexes, random = Math.random) {
  const shuffled = Array.from(indexes || []);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = Math.min(0.999999999, Math.max(0, Number(random()) || 0));
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (
    shuffled.length > 1 &&
    shuffled.every(function (value, index) { return value === indexes[index]; })
  ) {
    shuffled.push(shuffled.shift());
  }
  return shuffled;
}
