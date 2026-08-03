export const DAY_MS = 24 * 60 * 60 * 1000;
export const MASTERY_INTERVAL_DAYS = Object.freeze([0, 0, 1, 3, 7, 30]);

export function calculateDueAt(masteryLevel, from = Date.now()) {
  const level = Math.min(5, Math.max(0, Number(masteryLevel) || 0));
  if (level === 0) return null;
  return new Date(Number(from) + MASTERY_INTERVAL_DAYS[level] * DAY_MS).toISOString();
}

export function isDue(record, now = Date.now()) {
  if (!record || !record.dueAt) return false;
  const dueTime = new Date(record.dueAt).getTime();
  return Number.isFinite(dueTime) && dueTime <= Number(now);
}

export function getDueIndexes(progress, now = Date.now()) {
  return Object.entries(progress || {})
    .filter(function ([, record]) {
      return isDue(record, now);
    })
    .map(function ([index]) {
      return Number(index);
    })
    .filter(Number.isInteger)
    .sort(function (a, b) {
      return new Date(progress[a].dueAt).getTime() - new Date(progress[b].dueAt).getTime();
    });
}
