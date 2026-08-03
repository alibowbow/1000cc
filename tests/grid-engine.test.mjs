import test from "node:test";
import assert from "node:assert/strict";
import {
  createGridSession,
  createIndexRange,
  restoreGridSession,
  selectGridIndex,
} from "../js/grid-engine.js";

function seededRandom(seed = 123456) {
  let value = seed;
  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

test("초기 보드는 목표부터 정확한 범위의 16개 글자를 섞어 담는다", function () {
  const session = createGridSession({
    startIndex: 120,
    endIndex: 160,
    boardSize: 16,
    random: seededRandom(),
  });
  assert.equal(session.targetCursor, 120);
  assert.equal(session.supplyCursor, 136);
  assert.deepEqual(
    session.boardIndexes.slice().sort((a, b) => a - b),
    createIndexRange(120, 136),
  );
  assert.notDeepEqual(session.boardIndexes, createIndexRange(120, 136));
});

test("오답은 targetCursor와 보드 위치를 바꾸지 않는다", function () {
  const session = createGridSession({ startIndex: 0, endIndex: 40, random: seededRandom() });
  const wrong = session.boardIndexes.find((index) => index !== session.targetCursor);
  const result = selectGridIndex(session, wrong);
  assert.equal(result.correct, false);
  assert.equal(result.session.targetCursor, 0);
  assert.deepEqual(result.session.boardIndexes, session.boardIndexes);
});

test("정답은 선택한 칸만 다음 미공급 글자로 교체한다", function () {
  const session = createGridSession({ startIndex: 0, endIndex: 40, random: seededRandom() });
  const slot = session.boardIndexes.indexOf(0);
  const result = selectGridIndex(session, 0);
  assert.equal(result.correct, true);
  assert.equal(result.session.targetCursor, 1);
  assert.equal(result.session.supplyCursor, 17);
  assert.equal(result.changedSlot, slot);
  assert.equal(result.replacementIndex, 16);
  result.session.boardIndexes.forEach(function (index, position) {
    assert.equal(index, position === slot ? 16 : session.boardIndexes[position]);
  });
  assert.equal(new Set(result.session.boardIndexes).size, 16);
});

test("범위 마지막에서는 새 글자를 공급하지 않고 정답 칸만 빈 칸이 된다", function () {
  let session = createGridSession({ startIndex: 980, endIndex: 1000, random: seededRandom() });
  while (session.supplyPosition < session.order.length) {
    session = selectGridIndex(session, session.targetCursor).session;
  }
  const before = session.boardIndexes.slice();
  const slot = before.indexOf(session.targetCursor);
  const result = selectGridIndex(session, session.targetCursor);
  assert.equal(result.replacementIndex, null);
  assert.equal(result.session.boardIndexes[slot], null);
  result.session.boardIndexes.forEach(function (index, position) {
    if (position !== slot) assert.equal(index, before[position]);
  });
});

for (const length of [40, 100, 1000]) {
  test(`${length}자 세션은 다음 버튼 없이 정확히 끝난다`, function () {
    let session = createGridSession({
      startIndex: 0,
      endIndex: length,
      boardSize: 16,
      random: seededRandom(length),
    });
    let correct = 0;
    while (!session.complete) {
      const result = selectGridIndex(session, session.targetCursor);
      assert.equal(result.correct, true);
      session = result.session;
      correct += 1;
    }
    assert.equal(correct, length);
    assert.equal(session.targetPosition, length);
    assert.ok(session.boardIndexes.every((index) => index === null));
  });
}

test("저장된 boardIndexes와 커서로 세션을 그대로 복원한다", function () {
  let session = createGridSession({ startIndex: 300, endIndex: 400, random: seededRandom() });
  for (let count = 0; count < 23; count += 1) {
    session = selectGridIndex(session, session.targetCursor).session;
  }
  const restored = restoreGridSession(JSON.parse(JSON.stringify(session)));
  assert.deepEqual(restored, session);
});

test("복습용 비연속 인덱스도 중복 없이 원래 순서로 학습한다", function () {
  const indexes = [3, 18, 29, 201, 804];
  let session = createGridSession({ indexes, boardSize: 16, random: seededRandom() });
  assert.deepEqual(session.order, indexes);
  const targets = [];
  while (!session.complete) {
    targets.push(session.targetCursor);
    session = selectGridIndex(session, session.targetCursor).session;
  }
  assert.deepEqual(targets, indexes);
});
