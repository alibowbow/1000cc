import test from "node:test";
import assert from "node:assert/strict";
import { COUPLETS, TOTAL_CHARACTERS } from "../data.js";

test("천자문 데이터는 8자 125연, 총 1000자로 구성된다", function () {
  assert.equal(COUPLETS.length, 125);
  assert.equal(TOTAL_CHARACTERS, 1000);
  assert.ok(
    COUPLETS.every(function (couplet) {
      return Array.from(couplet.hanja).length === 8;
    }),
  );
});

test("각 한자에는 대응하는 한글 독음이 있다", function () {
  const readingCount = COUPLETS.reduce(function (total, couplet) {
    return total + Array.from(couplet.reading.replace(/\s/g, "")).length;
  }, 0);
  assert.equal(readingCount, 1000);
  assert.ok(
    COUPLETS.every(function (couplet) {
      return /^[가-힣]{4}\s[가-힣]{4}$/.test(couplet.reading);
    }),
  );
});

test("첫 구와 마지막 구의 순서가 보존된다", function () {
  assert.equal(COUPLETS[0].hanja, "天地玄黃宇宙洪荒");
  assert.equal(COUPLETS[0].reading, "천지현황 우주홍황");
  assert.equal(COUPLETS.at(-1).hanja, "謂語助者焉哉乎也");
  assert.equal(COUPLETS.at(-1).reading, "위어조자 언재호야");
});
