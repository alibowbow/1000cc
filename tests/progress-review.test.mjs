import test from "node:test";
import assert from "node:assert/strict";
import {
  createProgressRecord,
  getDueIndexes,
  getMasteredCount,
  recordAttempt,
} from "../js/progress-engine.js";
import { DAY_MS, calculateDueAt } from "../js/review-scheduler.js";

test("숙련도별 복습 예정 간격은 0·1·3·7·30일이다", function () {
  const start = Date.UTC(2026, 7, 4);
  assert.equal(new Date(calculateDueAt(1, start)).getTime(), start);
  assert.equal(new Date(calculateDueAt(2, start)).getTime(), start + DAY_MS);
  assert.equal(new Date(calculateDueAt(3, start)).getTime(), start + 3 * DAY_MS);
  assert.equal(new Date(calculateDueAt(4, start)).getTime(), start + 7 * DAY_MS);
  assert.equal(new Date(calculateDueAt(5, start)).getTime(), start + 30 * DAY_MS);
});

test("정답 연속과 복습 정답으로 숙련도가 2→3→4→5로 오른다", function () {
  const now = Date.UTC(2026, 7, 4);
  let progress = {};
  progress = recordAttempt(progress, 0, { correct: true, now });
  assert.equal(progress[0].masteryLevel, 2);
  progress = recordAttempt(progress, 0, { correct: true, now: now + 1 });
  assert.equal(progress[0].masteryLevel, 3);
  progress = recordAttempt(progress, 0, { correct: true, review: true, now: now + 2 });
  assert.equal(progress[0].masteryLevel, 4);
  progress = recordAttempt(progress, 0, { correct: true, review: true, now: now + 3 });
  assert.equal(progress[0].masteryLevel, 5);
  assert.equal(getMasteredCount(progress), 1);
});

test("오답은 진행을 올리지 않고 숙련도를 한 단계 낮춰 즉시 복습 예정으로 만든다", function () {
  const now = Date.UTC(2026, 7, 4);
  const progress = {
    12: createProgressRecord({ masteryLevel: 4, seenCount: 4, correctCount: 4 }),
  };
  const next = recordAttempt(progress, 12, { correct: false, now });
  assert.equal(next[12].masteryLevel, 3);
  assert.equal(next[12].wrongCount, 1);
  assert.equal(next[12].currentStreak, 0);
  assert.deepEqual(getDueIndexes(next, now), [12]);
});
