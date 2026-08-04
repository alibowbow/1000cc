import { CHARACTERS, getCouplet } from "./data-model.js";
import { MEMORY_SCENES, MODERN_VOCABULARY_BY_DAY } from "./lesson-content.js";
import { SKILL_KEYS, createProgressRecord, getWeakestSkill } from "./progress-engine.js";

export const COURSE_DAYS = 125;
export const LESSON_SIZE = 8;
export const DAILY_REVIEW_LIMIT = 6;

export const SKILL_LABELS = Object.freeze({
  reading: "독음",
  meaning: "뜻",
  reverse: "역방향",
  order: "순서",
  listening: "듣기",
});

const UNHELPFUL_DEFINITION =
  /이름|성씨|지명|고을|중국의|나라의|왕조|사람을 이르는 말|옛말|방언|북한어|산 이름|외몽골|고비 사막|귀족 사회|관직과 작위|그날의 간지|찼다가 기운다는 뜻/;

export function getLesson(dayIndex) {
  const safeDay = Math.min(COURSE_DAYS - 1, Math.max(0, Math.floor(Number(dayIndex) || 0)));
  const couplet = getCouplet(safeDay);
  return {
    dayIndex: safeDay,
    dayNumber: safeDay + 1,
    indexes: couplet.items.map(function (item) { return item.index; }),
    items: couplet.items,
    couplet,
    memoryScene: MEMORY_SCENES[safeDay],
    vocabulary: selectModernVocabulary(
      couplet.items,
      4,
      MODERN_VOCABULARY_BY_DAY[safeDay],
    ),
    confusableNotes: getConfusableNotes(couplet.items),
  };
}

export function getCurrentCourseDay(completedDays) {
  const completed = completedDays && typeof completedDays === "object" ? completedDays : {};
  for (let day = 0; day < COURSE_DAYS; day += 1) {
    if (!completed[day]) return day;
  }
  return COURSE_DAYS - 1;
}

export function getCourseStats(course, now = Date.now()) {
  const completedDays = course?.completedDays && typeof course.completedDays === "object"
    ? course.completedDays
    : {};
  const completed = Object.keys(completedDays).filter(function (key) {
    const day = Number(key);
    return Number.isInteger(day) && day >= 0 && day < COURSE_DAYS && completedDays[key]?.completedAt;
  }).length;
  return {
    completed,
    currentDay: completed >= COURSE_DAYS ? COURSE_DAYS - 1 : getCurrentCourseDay(completedDays),
    percent: Math.round((completed / COURSE_DAYS) * 100),
    streak: calculateCompletionStreak(completedDays, now),
    complete: completed >= COURSE_DAYS,
  };
}

export function createDailyLessonState(dayIndex, progress, now = Date.now()) {
  const lesson = getLesson(dayIndex);
  return {
    dayIndex: lesson.dayIndex,
    startedAt: new Date(now).toISOString(),
    stage: "lesson",
    // v2 내보내기 형식과 진행 중이던 기록의 호환을 위해 필드는 남기되,
    // 복습은 오늘의 학습 흐름에서 분리한다.
    reviewItems: [],
    reviewResults: {},
    lessonOpened: false,
    recallMode: "reading",
    recallCursor: 0,
    recallResults: { reading: {}, meaning: {}, reverse: {} },
    gridSession: null,
    gridWrongCount: 0,
    gridStartedAt: null,
    vocabularyOpened: false,
  };
}

export function createRandomDailyPick(completedDays, options = {}) {
  const completed = completedDays && typeof completedDays === "object" ? completedDays : {};
  const incomplete = Array.from({ length: COURSE_DAYS }, function (_, dayIndex) {
    return dayIndex;
  }).filter(function (dayIndex) {
    return !completed[dayIndex]?.completedAt;
  });
  const pool = incomplete.length > 0
    ? incomplete
    : Array.from({ length: COURSE_DAYS }, function (_, dayIndex) { return dayIndex; });
  const excludeDay = Number(options.excludeDay);
  const candidates = pool.length > 1 && Number.isInteger(excludeDay)
    ? pool.filter(function (dayIndex) { return dayIndex !== excludeDay; })
    : pool;
  const random = Math.min(0.999999999, Math.max(0, Number(options.random) || 0));
  const dayIndex = candidates[Math.floor(random * candidates.length)] || 0;
  return {
    dateKey: localDayKey(Number(options.now) || Date.now()),
    dayIndex,
  };
}

export function getRandomDailyPick(course, now = Date.now()) {
  const pick = course?.dailyPick;
  if (
    !pick ||
    pick.dateKey !== localDayKey(now) ||
    !Number.isInteger(pick.dayIndex) ||
    pick.dayIndex < 0 ||
    pick.dayIndex >= COURSE_DAYS
  ) {
    return null;
  }
  return pick.dayIndex;
}

export function getAdaptiveReviewItems(progress, excludedIndexes = [], options = {}) {
  const now = Number(options.now) || Date.now();
  const limit = Math.max(0, Math.min(20, Number(options.limit) || DAILY_REVIEW_LIMIT));
  const excluded = new Set(excludedIndexes);
  const candidates = Object.entries(progress || {})
    .map(function ([key, value]) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= 1000 || excluded.has(index)) return null;
      const record = createProgressRecord(value);
      const skill = getWeakestSkill(record);
      const dimension = record.skills[skill];
      const dueTime = new Date(dimension.dueAt || record.dueAt || 0).getTime();
      const wrongRate = dimension.wrongCount / Math.max(1, dimension.seenCount);
      return {
        index,
        skill,
        due: Boolean(dueTime && dueTime <= now),
        dueTime,
        masteryLevel: dimension.masteryLevel,
        wrongRate,
        lastSeenTime: new Date(dimension.lastSeenAt || record.lastSeenAt || 0).getTime(),
      };
    })
    .filter(Boolean)
    .filter(function (item) {
      return item.due || item.wrongRate > 0 || item.masteryLevel < 3;
    })
    .sort(function (left, right) {
      return (
        Number(right.due) - Number(left.due) ||
        left.masteryLevel - right.masteryLevel ||
        right.wrongRate - left.wrongRate ||
        left.dueTime - right.dueTime ||
        left.lastSeenTime - right.lastSeenTime
      );
    });
  return candidates.slice(0, limit).map(function ({ index, skill }) {
    return { index, skill };
  });
}

export function selectModernVocabulary(items, limit = 4, preferredWords = []) {
  const lessonCharacters = new Set(items.map(function (item) { return item.character; }));
  const seen = new Set();
  const candidates = [];
  items.forEach(function (item) {
    item.relatedWords.forEach(function (word) {
      if (seen.has(word.word) || !isReadingAlignedWord(item, word)) return;
      if (UNHELPFUL_DEFINITION.test(word.definition)) return;
      seen.add(word.word);
      const originCharacters = Array.from(word.origin);
      const lessonCharacterCount = originCharacters.filter(function (character) {
        return lessonCharacters.has(character);
      }).length;
      candidates.push({
        ...word,
        character: item.character,
        reading: item.reading,
        score:
          (originCharacters.length - 2) * 4 +
          Math.max(0, word.word.length - 2) * 2 +
          Math.max(0, word.definition.length - 70) / 20 -
          lessonCharacterCount * 7,
      });
    });
  });
  const ranked = candidates.sort(function (left, right) {
      return left.score - right.score || left.word.localeCompare(right.word, "ko");
    });
  const selected = [];
  preferredWords.forEach(function (preferred) {
    const match = ranked.find(function (word) { return word.word === preferred; });
    if (match && !selected.includes(match) && selected.length < limit) selected.push(match);
  });
  const usedCharacters = new Set();
  selected.forEach(function (word) { usedCharacters.add(word.character); });
  ranked.forEach(function (word) {
    if (selected.length >= limit || usedCharacters.has(word.character)) return;
    usedCharacters.add(word.character);
    selected.push(word);
  });
  ranked.forEach(function (word) {
    if (selected.length >= limit || selected.includes(word)) return;
    selected.push(word);
  });
  return selected
    .map(function ({ score, ...word }) { return word; });
}

export function isReadingAlignedWord(item, word) {
  const origin = Array.from(word.origin || "");
  const syllables = Array.from(word.word || "");
  if (origin.length !== syllables.length) return false;
  return origin.some(function (character, position) {
    return character === item.character && syllables[position] === item.reading;
  });
}

export function getConfusableNotes(items, limit = 2) {
  const notes = [];
  const used = new Set();
  items.forEach(function (item) {
    const inLesson = items.find(function (candidate) {
      return candidate.index !== item.index && candidate.reading === item.reading;
    });
    const pair = inLesson || CHARACTERS.find(function (candidate) {
      return candidate.index !== item.index && candidate.reading === item.reading;
    });
    if (!pair) return;
    const key = [item.character, pair.character].sort().join("");
    if (used.has(key)) return;
    used.add(key);
    notes.push({
      reading: item.reading,
      first: { character: item.character, gloss: item.gloss },
      second: { character: pair.character, gloss: pair.gloss },
      inLesson: Boolean(inLesson),
    });
  });
  return notes.slice(0, limit);
}

export function getDailyCompletion(activeLesson) {
  if (!activeLesson) return { lesson: false, recall: false, grid: false, vocabulary: false };
  const recallDone = ["reading", "meaning", "reverse"].every(function (skill) {
    return Object.keys(activeLesson.recallResults[skill] || {}).length >= LESSON_SIZE;
  });
  return {
    lesson: Boolean(activeLesson.lessonOpened),
    recall: recallDone,
    grid: Boolean(activeLesson.gridSession?.complete),
    vocabulary: Boolean(activeLesson.vocabularyOpened),
  };
}

export function nextDailyStage(activeLesson) {
  const completed = getDailyCompletion(activeLesson);
  if (!completed.lesson) return "lesson";
  if (!completed.recall) return "recall";
  if (!completed.grid) return "grid";
  if (!completed.vocabulary) return "vocabulary";
  return "complete";
}

export function parseChallengeDay(search) {
  const params = new URLSearchParams(String(search || ""));
  const value = Number(params.get("challenge"));
  return Number.isInteger(value) && value >= 1 && value <= COURSE_DAYS ? value - 1 : null;
}

export function createChallengeUrl(locationLike, dayIndex) {
  const url = new URL(locationLike.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("challenge", String(Math.min(124, Math.max(0, dayIndex)) + 1));
  return url.toString();
}

export function isBetterScore(candidate, current) {
  if (!current) return true;
  if (candidate.accuracy !== current.accuracy) return candidate.accuracy > current.accuracy;
  return candidate.duration < current.duration;
}

function calculateCompletionStreak(completedDays, now) {
  const dates = new Set(
    Object.values(completedDays || {})
      .map(function (entry) { return entry?.completedAt ? localDayKey(entry.completedAt) : null; })
      .filter(Boolean),
  );
  if (dates.size === 0) return 0;
  const cursor = new Date(now);
  if (!dates.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function localDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export { SKILL_KEYS };
