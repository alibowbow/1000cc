import test from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_DAYS,
  createChallengeUrl,
  createDailyLessonState,
  getCourseStats,
  getLesson,
  isBetterScore,
  isReadingAlignedWord,
  parseChallengeDay,
} from "../js/course-engine.js";
import { MEMORY_SCENES, MODERN_VOCABULARY_BY_DAY } from "../js/lesson-content.js";
import { recordSkillAttempt } from "../js/progress-engine.js";

test("125일 과정은 매일 8자·전체 뜻·고유한 기억 장면·현대 어휘를 제공한다", function () {
  assert.equal(COURSE_DAYS, 125);
  assert.equal(MEMORY_SCENES.length, 125);
  assert.equal(new Set(MEMORY_SCENES).size, 125);
  for (let day = 0; day < COURSE_DAYS; day += 1) {
    const lesson = getLesson(day);
    assert.equal(lesson.items.length, 8);
    assert.ok(lesson.couplet.data.meaning.length > 10);
    assert.ok(lesson.memoryScene.length > 15);
    assert.equal(lesson.vocabulary.length, 4);
    assert.deepEqual(
      lesson.vocabulary.map(function (word) { return word.word; }),
      MODERN_VOCABULARY_BY_DAY[day],
    );
    lesson.vocabulary.forEach(function (word) {
      const source = lesson.items.find(function (item) {
        return item.character === word.character;
      });
      assert.ok(source);
      assert.equal(isReadingAlignedWord(source, word), true);
    });
  }
  assert.deepEqual(getLesson(1).vocabulary.map(function (word) { return word.word; }), [
    "일기",
    "월급",
    "열차",
    "긴장",
  ]);
  assert.deepEqual(getLesson(75).vocabulary.map(function (word) { return word.word; }), [
    "선전",
    "위협",
    "백사장",
    "단풍",
  ]);
});

test("오늘 복습은 새 8자를 제외하고 약한 학습 영역을 자동 선택한다", function () {
  const now = Date.UTC(2026, 7, 4, 1);
  let progress = {};
  progress = recordSkillAttempt(progress, 0, "reading", { correct: false, now });
  progress = recordSkillAttempt(progress, 1, "meaning", { correct: false, now });
  progress = recordSkillAttempt(progress, 8, "reverse", { correct: false, now });
  const daily = createDailyLessonState(0, progress, now + 1000);
  assert.deepEqual(daily.reviewItems.map(function (item) { return item.index; }).sort(), [8]);
  assert.equal(daily.reviewItems[0].skill, "reverse");
});

test("숙련은 서로 다른 날짜의 영역별 정답을 요구한다", function () {
  const day = Date.UTC(2026, 7, 1);
  let progress = {};
  progress = recordSkillAttempt(progress, 0, "reading", { correct: true, now: day });
  progress = recordSkillAttempt(progress, 0, "reading", { correct: true, now: day + 1000 });
  assert.equal(progress[0].skills.reading.masteryLevel, 2);
  progress = recordSkillAttempt(progress, 0, "reading", {
    correct: true,
    now: day + 24 * 60 * 60 * 1000,
  });
  assert.equal(progress[0].skills.reading.masteryLevel, 3);
});

test("회원가입 없는 오늘의 8자 도전 링크는 1일부터 125일까지만 허용한다", function () {
  const url = createChallengeUrl({ href: "https://alibowbow.github.io/1000cc/?old=1" }, 7);
  assert.equal(new URL(url).search, "?challenge=8");
  assert.equal(parseChallengeDay("?challenge=8"), 7);
  assert.equal(parseChallengeDay("?challenge=126"), null);
});

test("완료 기록으로 현재 과정 일차와 연속 학습일을 계산한다", function () {
  const now = new Date(2026, 7, 4, 9).getTime();
  const course = {
    completedDays: {
      0: { completedAt: new Date(2026, 7, 3, 9).toISOString() },
      1: { completedAt: new Date(2026, 7, 4, 8).toISOString() },
    },
  };
  const stats = getCourseStats(course, now);
  assert.equal(stats.completed, 2);
  assert.equal(stats.currentDay, 2);
  assert.equal(stats.streak, 2);
});

test("챌린지 최고 기록은 정답률을 먼저, 같은 정답률에서는 시간을 비교한다", function () {
  const current = { accuracy: 95, duration: 30000 };
  assert.equal(isBetterScore({ accuracy: 100, duration: 60000 }, current), true);
  assert.equal(isBetterScore({ accuracy: 95, duration: 25000 }, current), true);
  assert.equal(isBetterScore({ accuracy: 90, duration: 10000 }, current), false);
});
