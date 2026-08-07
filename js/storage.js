import { restoreMatchingSession } from "./matching-engine.js?v=24";
import { createProgressRecord } from "./progress-engine.js";
import { isPlainObject, toIsoString, uniqueValidIndexes } from "./utils.js";

export const STORAGE_KEY_V1 = "cheonjamun-study-v1";
export const STORAGE_KEY_V2 = "cheonjamun-study-v2";
export const EXPORT_SCHEMA = "1000cc-study-record";

const MODES = ["today", "overview", "passage", "memory", "grid"];
const DIFFICULTIES = ["character", "reading", "listening", "none"];
const SKILLS = ["reading", "meaning", "reverse", "order", "listening"];

export function createDefaultState() {
  return {
    version: 2,
    ui: {
      mode: "today",
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
      hideOverviewMeaning: false,
      tapToSpeak: true,
      rate: 0.85,
      voiceURI: "",
      vibrate: true,
      boardSize: 16,
    },
    progress: {},
    grid: {
      lastCursor: 0,
      session: null,
      bestScores: {},
    },
    review: {
      selectedIndexes: [],
      source: "due",
      rangeStart: 0,
    },
    course: {
      completedDays: {},
      activeLesson: null,
      challengeBest: {},
      dailyPick: null,
    },
  };
}

export function migrateV1(value, now = Date.now()) {
  if (!isPlainObject(value)) throw new Error("v1 학습 기록이 올바르지 않습니다.");
  const next = createDefaultState();
  // 기존 진도와 마지막 위치는 보존하되, 새 125일 과정의 첫 진입점은 오늘의 학습으로 통일한다.
  next.ui.mode = "today";
  next.ui.selectedIndex = validIndex(value.selectedIndex, 0);
  next.ui.rangeStart = normalizeOverviewRange(value.rangeStart);
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
  const course = isPlainObject(value.course) ? value.course : null;

  defaults.ui.mode = MODES.includes(ui.mode) ? ui.mode : "today";
  defaults.ui.selectedIndex = validIndex(ui.selectedIndex, 0);
  defaults.ui.rangeStart = normalizeOverviewRange(ui.rangeStart);
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
  defaults.settings.hideOverviewMeaning = Boolean(settings.hideOverviewMeaning);
  defaults.settings.tapToSpeak =
    typeof settings.tapToSpeak === "boolean" ? settings.tapToSpeak : true;
  defaults.settings.rate = validRate(settings.rate);
  defaults.settings.voiceURI =
    typeof settings.voiceURI === "string" ? settings.voiceURI.slice(0, 300) : "";
  defaults.settings.vibrate =
    typeof settings.vibrate === "boolean" ? settings.vibrate : true;
  defaults.settings.boardSize = Number(settings.boardSize) === 25 ? 25 : 16;

  defaults.progress = normalizeProgress(value.progress);
  defaults.grid.lastCursor = clampCursor(grid.lastCursor);
  defaults.grid.session = grid.session ? normalizeSavedSession(grid.session) : null;
  defaults.grid.bestScores = normalizeBestScores(grid.bestScores);
  defaults.review.selectedIndexes = uniqueValidIndexes(review.selectedIndexes);
  defaults.review.source = ["due", "recent", "frequent", "range"].includes(review.source)
    ? review.source
    : "due";
  defaults.review.rangeStart = normalizeRange(review.rangeStart);
  defaults.course.completedDays = normalizeCompletedDays(course?.completedDays);
  defaults.course.activeLesson = null;
  defaults.course.challengeBest = normalizeBestScores(course?.challengeBest, 125);
  defaults.course.dailyPick = normalizeDailyPick(course?.dailyPick);
  return defaults;
}

export function loadStateFromStorage(storage, now = Date.now()) {
  try {
    const rawV2 = storage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const state = prepareHomepageEntry(normalizeV2(JSON.parse(rawV2)));
      return { state, source: "v2", migrated: false };
    }
  } catch (error) {
    // v2가 손상된 경우 v1 복구를 시도한다.
  }

  try {
    const rawV1 = storage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const state = prepareHomepageEntry(
        normalizeV2(migrateV1(JSON.parse(rawV1), now)),
      );
      storage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
      return { state, source: "v1", migrated: true };
    }
  } catch (error) {
    // 잘못된 JSON은 기본값으로 안전하게 복구한다.
  }
  return { state: createDefaultState(), source: "default", migrated: false };
}

function prepareHomepageEntry(state) {
  // 학습 위치와 설정은 유지하되, 일반 방문은 항상 홈에서 시작한다.
  state.ui.mode = "today";
  state.ui.revealAnswer = false;
  return state;
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
    const engine = restoreMatchingSession(value);
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
      scope: typeof value.scope === "string" ? value.scope : "continue",
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

function normalizeActiveLesson(value) {
  if (!isPlainObject(value)) return null;
  const dayIndex = Number(value.dayIndex);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 125) return null;
  const reviewItems = Array.isArray(value.reviewItems)
    ? value.reviewItems
        .map(function (item) {
          if (!isPlainObject(item)) return null;
          const index = Number(item.index);
          if (!Number.isInteger(index) || index < 0 || index >= 1000 || !SKILLS.includes(item.skill)) {
            return null;
          }
          return { index, skill: item.skill };
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];
  let gridSession = null;
  if (value.gridSession) {
    try {
      gridSession = restoreMatchingSession(value.gridSession);
    } catch (error) {
      gridSession = null;
    }
  }
  return {
    dayIndex,
    startedAt: toIsoString(value.startedAt, new Date().toISOString()),
    stage: value.stage === "review"
      ? "lesson"
      : ["lesson", "recall", "grid", "vocabulary", "complete"].includes(value.stage)
        ? value.stage
        : "lesson",
    reviewItems,
    reviewResults: normalizeResultMap(value.reviewResults),
    lessonOpened: Boolean(value.lessonOpened),
    recallMode: ["reading", "meaning", "reverse"].includes(value.recallMode)
      ? value.recallMode
      : "reading",
    recallCursor: Math.min(7, Math.max(0, Math.floor(Number(value.recallCursor) || 0))),
    recallResults: {
      reading: normalizeResultMap(value.recallResults?.reading),
      meaning: normalizeResultMap(value.recallResults?.meaning),
      reverse: normalizeResultMap(value.recallResults?.reverse),
    },
    gridSession,
    gridWrongCount: Math.max(0, Math.floor(Number(value.gridWrongCount) || 0)),
    gridStartedAt: toIsoString(value.gridStartedAt),
    vocabularyOpened: Boolean(value.vocabularyOpened),
  };
}

function normalizeDailyPick(value) {
  if (!isPlainObject(value)) return null;
  const dayIndex = Number(value.dayIndex);
  const dateKey = typeof value.dateKey === "string" ? value.dateKey : "";
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= 125) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return { dateKey, dayIndex };
}

function normalizeResultMap(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  Object.entries(value).forEach(function ([key, answer]) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < 1000 && ["correct", "wrong"].includes(answer)) {
      result[index] = answer;
    }
  });
  return result;
}

function normalizeCompletedDays(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  Object.entries(value).forEach(function ([key, entry]) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 0 || day >= 125 || !isPlainObject(entry)) return;
    const completedAt = toIsoString(entry.completedAt);
    if (!completedAt) return;
    result[day] = {
      completedAt,
      duration: Math.max(0, Math.floor(Number(entry.duration) || 0)),
      accuracy: Math.min(100, Math.max(0, Math.round(Number(entry.accuracy) || 0))),
      wrongCount: Math.max(0, Math.floor(Number(entry.wrongCount) || 0)),
    };
  });
  return result;
}

function normalizeBestScores(value, maximumKey = 1000) {
  if (!isPlainObject(value)) return {};
  const result = {};
  Object.entries(value).forEach(function ([key, score]) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= maximumKey || !isPlainObject(score)) return;
    result[index] = {
      accuracy: Math.min(100, Math.max(0, Math.round(Number(score.accuracy) || 0))),
      duration: Math.max(0, Math.floor(Number(score.duration) || 0)),
      completedAt: toIsoString(score.completedAt),
    };
  });
  return result;
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
    throw new Error("저장된 한자 맞추기 게임 세션이 올바르지 않습니다.");
  }
  if (value.course?.activeLesson && !normalizeActiveLesson(value.course.activeLesson)) {
    throw new Error("저장된 오늘의 학습 기록이 올바르지 않습니다.");
  }
}

function validIndex(value, fallback) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < 1000 ? index : fallback;
}

function normalizeRange(value) {
  return Math.min(900, Math.max(0, Math.floor((Number(value) || 0) / 100) * 100));
}

function normalizeOverviewRange(value) {
  return Math.min(999, Math.max(0, Math.floor(Number(value) || 0)));
}

function clampCursor(value) {
  const cursor = Math.floor(Number(value) || 0);
  return Math.min(1000, Math.max(0, cursor));
}

function validRate(value) {
  const rate = Number(value);
  return [0.7, 0.85, 1, 1.15].includes(rate) ? rate : 0.85;
}
