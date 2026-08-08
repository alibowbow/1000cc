import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatchingSession,
  getMatchingProgress,
  restoreMatchingSession,
  selectMatchingChoice,
} from "../js/matching-engine.js";

function seededRandom(seed = 123456) {
  let value = seed;
  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

test("첫 문제는 현재 8자 중 네 후보에 정답을 포함한다", function () {
  const session = createMatchingSession({
    indexes: [40, 41, 42, 43, 44, 45, 46, 47],
    random: seededRandom(),
  });
  assert.equal(session.targetIndex, 40);
  assert.equal(session.choiceIndexes.length, 4);
  assert.ok(session.choiceIndexes.includes(40));
  assert.ok(session.choiceIndexes.every((index) => session.questionIndexes.includes(index)));
});

test("오답도 다음 훈음 문제와 새 네 후보를 만든다", function () {
  const session = createMatchingSession({
    indexes: [0, 1, 2, 3, 4, 5, 6, 7],
    random: seededRandom(),
  });
  const wrong = session.choiceIndexes.find((index) => index !== session.targetIndex);
  const result = selectMatchingChoice(session, wrong, { random: seededRandom(10) });
  assert.equal(result.correct, false);
  assert.equal(result.session.questionPosition, 1);
  assert.equal(result.session.targetIndex, 1);
  assert.equal(result.session.choiceIndexes.length, 4);
  assert.ok(result.session.choiceIndexes.includes(1));
});

test("정답을 맞히면 다음 훈음 문제와 새 네 후보를 만든다", function () {
  const session = createMatchingSession({
    indexes: [10, 11, 12, 13, 14, 15, 16, 17],
    random: seededRandom(),
  });
  const result = selectMatchingChoice(session, 10, { random: seededRandom(99) });
  assert.equal(result.correct, true);
  assert.equal(result.session.questionPosition, 1);
  assert.equal(result.session.targetIndex, 11);
  assert.equal(result.session.choiceIndexes.length, 4);
  assert.ok(result.session.choiceIndexes.includes(11));
});

test("8문제를 모두 맞히면 게임을 끝내고 저장 상태를 복원한다", function () {
  let session = createMatchingSession({
    indexes: [20, 21, 22, 23, 24, 25, 26, 27],
    random: seededRandom(),
  });
  while (!session.complete) {
    session = selectMatchingChoice(session, session.targetIndex, { random: seededRandom(session.questionPosition + 1) }).session;
  }
  assert.equal(session.questionPosition, 8);
  assert.equal(session.targetIndex, null);
  assert.deepEqual(session.choiceIndexes, []);
  assert.deepEqual(getMatchingProgress(session), { completed: 8, total: 8, remaining: 0 });
  assert.deepEqual(restoreMatchingSession(JSON.parse(JSON.stringify(session))), session);
});
