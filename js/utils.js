export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function shuffleCopy(values, random = Math.random) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function uniqueValidIndexes(values, total = 1000) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter(function (value) {
    if (!Number.isInteger(value) || value < 0 || value >= total || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/[\s·,._-]+/g, "");
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toIsoString(value, fallback = null) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function downloadTextFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 0);
}
