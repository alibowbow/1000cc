import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createOverviewIndexes,
  createOverviewRangeStarts,
  getOverviewPageSize,
  normalizeOverviewRangeStart,
  shuffleOverviewIndexes,
} from "../js/overview-layout.js";

test("1자 보기는 데스크톱 200자, 모바일 40자 단위를 사용한다", function () {
  assert.equal(getOverviewPageSize(false), 200);
  assert.equal(getOverviewPageSize(true), 40);
  assert.deepEqual(createOverviewRangeStarts(200), [0, 200, 400, 600, 800]);
  assert.equal(createOverviewRangeStarts(40).length, 25);
  assert.equal(createOverviewRangeStarts(40).at(-1), 960);
});

test("현재 글자가 속한 반응형 필사판 범위를 정확히 계산한다", function () {
  assert.equal(normalizeOverviewRangeStart(399, 200), 200);
  assert.equal(normalizeOverviewRangeStart(999, 200), 800);
  assert.equal(normalizeOverviewRangeStart(399, 40), 360);
  assert.equal(normalizeOverviewRangeStart(999, 40), 960);
  assert.deepEqual(createOverviewIndexes(800, 200), Array.from({ length: 200 }, (_, i) => i + 800));
  assert.deepEqual(createOverviewIndexes(960, 40), Array.from({ length: 40 }, (_, i) => i + 960));
});

test("랜덤 배열은 글자를 빠뜨리거나 중복하지 않고 원래 순서를 바꾼다", function () {
  const original = [0, 1, 2, 3, 4, 5, 6, 7];
  const shuffled = shuffleOverviewIndexes(original, function () { return 0; });
  assert.notDeepEqual(shuffled, original);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), original);
  assert.deepEqual(original, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("1자 뜻은 뜻풀이와 독음을 분리해 독음만 강조한다", async function () {
  const renderSource = await readFile(new URL("../js/render.js", import.meta.url), "utf8");
  assert.match(renderSource, /overview-cell__gloss/);
  assert.match(renderSource, /overview-cell__reading/);
  assert.match(renderSource, /\$\{item\.gloss\}/);
  assert.match(renderSource, /\$\{item\.reading\}/);
});
