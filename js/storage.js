import { restoreGridSession } from "./grid-engine.js";
import { createProgressRecord } from "./progress-engine.js";
import { isPlainObject, toIsoString, uniqueValidIndexes } from "./utils.js";

export const STORAGE_KEY_V1 = "cheonjamun-study-v1";
export const STORAGE_KEY_V2 = "cheonjamun-study-v2";
export const EXPORT_SCHEMA = "1000cc-study-record";

const MODES = ["overview", "passage", "grid", "review"];
const DIFFICULTIES = ["character", "reading", "listening", "none"];

export function createDefaultState() {
  return {
    version: 2,
    ui: {
      mode: "overview",
      selectedIndex: 0,
      rangeStart: 0,
      overviewGroupSize: 4,
      statusFilter: "all",
      search: "",
      highlightWrong: false,
      highlightDue: false,
      revealAnswer: false,
    },
    settings: {
      hideReading: false,
      hideMeaning: false,
      tapToSpeak: true,
      rate: 0.85,
      voiceURI: "",
      readFourOnComplete: true,
      vibrate: true,
      boardSize: 16,
    },
    progress: {},
    grid: {
      lastCursor: 0,
      session: null,
    },
    review: {
      selectedIndexes: [],
      source: "due",
      rangeStart: 0,
    },
  };
}

export function migrateV1(value, now = Date.now()) {
  if (!isPlainObject(value)) throw new Error("v1 학습 기록이 올바르지 않습니다.");
  const next = createDefaultState();
  const modeMap = { browse: "overview", sequence: "grid", listen: "passage" };
  next.ui.mode = modeMap[value.mode] || "overview";
  next.ui.selectedIndex = validIndex(value.selectedIndex, 0);
  next.ui.rangeStart = normalizeRange(value.rangeStart);
  next.settings.hideReading = Boolean(value.hideReading);
  next.settings.hideMeaning = Boolean(value.hideMeaning);
  next.settings.tapToSpeak =
    typeof value.tapToSpeak === "boolean" ? value.tapToSpeak : true;
  next.settings.rate = validRate(value.rate);
  next.settings.voiceURI = typeof value.voiceURI === "string" ? value.voiceURI : "";
  next.grid.lastCursor = clampCursor(value.sequenceCursor);

  const learned = uniqueValidIndexes(value.learned);
  const learnedAt = new Date(now).toISOString();
  learned.forEach(function (index) {
    next.progress[index] = createProgressRecord({
      seenCount: 1,
      correctCount: 1,
      currentStreak: 1,
      masteryLevel: 2,
      lastSeenAt: learnedAt,
      lastCorrectAt: learnedAt,
      dueAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    });
  });
  return next;
}

export function normalizeV2(value) {
  if (!isPlainObject(value) || Number(value.version) !== 2) {
    throw new Error("v2 학습 기록이 올바르지 않습니다.");
  }
  const defaults = createDefaultState();
  const ui = isPlainObject(value.ui) ? value.ui : {};
  const settings = isPlainObject(value.settings) ? value.settings : {};
  const grid = isPlainObject(value.grid) ? value.grid : {};
  const review = isPlainObject(value.review) ? value.review : {};

  defaults.ui.mode = MODES.includes(ui.mode) ? ui.mode : defaults.ui.mode;
  defaults.ui.selectedIndex = validIndex(ui.selectedIndex, 0);
  defaults.ui.rangeStart = normalizeRange(ui.rangeStart);
  defaults.ui.overviewGroupSize = Number(ui.overviewGroupSize) === 8 ? 8 : 4;
  defaults.ui.statusFilter = ["all", "unseen", "learning", "mastered"].includes(ui.statusFilter)
    ? ui.statusFilter
    : "all";
  defaults.ui.search = typeof ui.search === "string" ? ui.search.slice(0, 120) : "";
  defaults.ui.highlightWrong = Boolean(ui.highlightWrong);
  defaults.ui.highlightDue = Boolean(ui.highlightDue);
  defaults.ui.revealAnswer = Boolean(ui.revealAnswer);

  defaults.settings.hideReading = Boolean(settings.hideReading);
  defaults.settings.hideMeaning = Boolean(settings.hideMeaning);
  defaults.settings.tapToSpeak =
    typeof settings.tapToSpeak === "boolean" ? settings.tapToSpeak : true;
  defaults.settings.rate = validRate(settings.rate);
  defaults.settings.voiceURI =
    typeof settings.voiceURI === "string" ? settings.voiceURI.slice(0, 300) : "";
  defaults.settings.readFourOnComplete =
    typeof settings.readFourOnComplete === "boolean" ? settings.readFourOnComplete : true;
  defaults.settings.vibrate =
    typeof settings.vibrate === "boolean" ? settings.vibrate : true;
  defaults.settings.boardSize = Number(settings.boardSize) === 25 ? 25 : 16;

  defaults.progress = normalizeProgress(value.progress);
  defaults.grid.lastCursor = clampCursor(grid.lastCursor);
  defaults.grid.session = grid.session ? normalizeSavedSession(grid.session) : null;
  defaults.review.selectedIndexes = uniqueValidIndexes(review.selectedIndexes);
  defaults.review.source = ["due", "recent", "frequent", "range"].includes(review.source)
    ? review.source
    : "due";
  defaults.review.rangeStart = normalizeRange(review.rangeStart);
  return defaults;
}

export function loadStateFromStorage(storage, now = Date.now()) {
  try {
    const rawV2 = storage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      return { state: normalizeV2(JSON.parse(rawV2)), source: "v2", migrated: false };
    }
  } catch (error) {
    // v2가 손상된 경우 v1 복구를 시도한다.
  }

  try {
    const rawV1 = storage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const state = normalizeV2(migrateV1(JSON.parse(rawV1), now));
      storage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
      return { state, source: "v1", migrated: true };
    }
  } catch (error) {
    // 잘못된 JSON은 기본값으로 안전하게 복구한다.
  }
  return { state: createDefaultState(), source: "default", migrated: false };
}

export function saveStateToStorage(storage, state) {
  const normalized = normalizeV2(state);
  storage.setItem(STORAGE_KEY_V2, JSON.stringify(normalized));
  return normalized;
}

export function clearStoredState(storage) {
  storage.removeItem(STORAGE_KEY_V2);
  storage.removeItem(STORAGE_KEY_V1);
}

export function createExportJson(state, now = Date.now()) {
  return JSON.stringify(
    {
      schema: EXPORT_SCHEMA,
      version: 2,
      exportedAt: new Date(now).toISOString(),
      state: normalizeV2(state),
    },
    null,
    2,
  );
}

export function parseImportJson(text) {
  let payload;
  try {
    payload = JSON.parse(String(text));
  } catch (error) {
    throw new Error("JSON 파일을 읽을 수 없습니다.");
  }
  if (
    !isPlainObject(payload) ||
    payload.schema !== EXPORT_SCHEMA ||
    Number(payload.version) !== 2 ||
    !isPlainObject(payload.state)
  ) {
    throw new Error("1000cc v2 학습 기록 파일이 아닙니다.");
  }
  assertStrictState(payload.state);
  return normalizeV2(payload.state);
}

function normalizeProgress(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  Object.entries(value).forEach(function ([key, record]) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < 1000 && isPlainObject(record)) {
      result[index] = createProgressRecord(record);
    }
  });
  return result;
}

function normalizeSavedSession(value) {
  if (!isPlainObject(value)) return null;
  try {
    const engine = restoreGridSession(value);
    const errorsByTarget = {};
    if (isPlainObject(value.errorsByTarget)) {
      Object.entries(value.errorsByTarget).forEach(function ([key, count]) {
        const index = Number(key);
        if (Number.isInteger(index) && index >= 0 && index < 1000) {
          errorsByTarget[index] = Math.max(0, Math.floor(Number(count) || 0));
        }
      });
    }
    return {
      ...engine,
      active: value.active !== false && !engine.complete,
      paused: Boolean(value.paused),
      difficulty: DIFFICULTIES.includes(value.difficulty) ? value.difficulty : "character",
      scope: typeof value.scope === "string" ? value.scope : "continue",
      reviewMode: Boolean(value.reviewMode),
      correctCount: Math.max(0, Math.floor(Number(value.correctCount) || 0)),
      wrongCount: Math.max(0, Math.floor(Number(value.wrongCount) || 0)),
      wrongIndexes: uniqueValidIndexes(value.wrongIndexes),
      errorsByTarget,
      startedAt: toIsoString(value.startedAt, new Date().toISOString()),
      endedAt: toIsoString(value.endedAt),
    };
  } catch (error) {
    return null;
  }
}

function assertStrictState(value) {
  if (Number(value.version) !== 2) throw new Error("지원하지 않는 기록 버전입니다.");
  if (value.progress !== undefined && !isPlainObject(value.progress)) {
    throw new Error("글자별 학습 기록이 올바르지 않습니다.");
  }
  Object.entries(value.progress || {}).forEach(function ([key, record]) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= 1000 || !isPlainObject(record)) {
      throw new Error("학습 기록에 잘못된 글자 인덱스가 있습니다.");
    }
    ["seenCount", "correctCount", "wrongCount", "currentStreak", "masteryLevel"].forEach(
      function (field) {
        if (record[field] !== undefined && !Number.isFinite(Number(record[field]))) {
          throw new Error("학습 기록 수치가 올바르지 않습니다.");
        }
      },
    );
  });
  if (value.grid && value.grid.session && !normalizeSavedSession(value.grid.session)) {
    throw new Error("저장된 연속 그리드 세션이 올바르지 않습니다.");
  }
}

function validIndex(value, fallback) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < 1000 ? index : fallback;
}

function normalizeRange(value) {
  return Math.min(900, Math.max(0, Math.floor((Number(value) || 0) / 100) * 100));
}

function clampCursor(value) {
  const cursor = Math.floor(Number(value) || 0);
  return Math.min(1000, Math.max(0, cursor));
}

function validRate(value) {
  const rate = Number(value);
  return [0.7, 0.85, 1, 1.15].includes(rate) ? rate : 0.85;
}
