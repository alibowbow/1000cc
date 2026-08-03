import test from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_HUN } from "../character-meta.js";
import {
  CHARACTERS,
  COUPLETS,
  TOTAL_CHARACTERS,
  getCouplet,
  getHunSound,
} from "../js/data-model.js";

test("천자문 데이터는 8자 125연, 총 1,000자로 구성된다", function () {
  assert.equal(COUPLETS.length, 125);
  assert.equal(TOTAL_CHARACTERS, 1000);
  assert.equal(CHARACTERS.length, 1000);
  assert.ok(COUPLETS.every((couplet) => Array.from(couplet.hanja).length === 8));
});

test("독음은 각 연마다 공백 제외 정확히 8개의 한글 음절이다", function () {
  const readings = COUPLETS.map((couplet) => couplet.reading.replace(/\s/g, "")).join("");
  assert.equal(Array.from(readings).length, 1000);
  assert.match(readings, /^[가-힣]{1000}$/);
  assert.ok(COUPLETS.every((couplet) => /^[가-힣]{4}\s[가-힣]{4}$/.test(couplet.reading)));
});

test("첫 구와 마지막 구의 순서가 보존된다", function () {
  assert.equal(COUPLETS[0].hanja, "天地玄黃宇宙洪荒");
  assert.equal(COUPLETS[0].reading, "천지현황 우주홍황");
  assert.equal(COUPLETS.at(-1).hanja, "謂語助者焉哉乎也");
  assert.equal(COUPLETS.at(-1).reading, "위어조자 언재호야");
});

test("원문 1,000자는 중복이나 누락 없이 보존된다", function () {
  const source = COUPLETS.map((couplet) => couplet.hanja).join("");
  assert.equal(Array.from(source).length, 1000);
  assert.equal(new Set(Array.from(source)).size, 1000);
});

test("풀이는 각주·출처 잔여물 없이 완결된 문장이다", function () {
  COUPLETS.forEach(function (couplet) {
    assert.doesNotMatch(couplet.meaning, /\[\d+\]|출처|위키|\s{2,}/);
    assert.match(couplet.meaning, /[.!?]$/);
  });
});

test("각 8자 연은 앞뒤 4자구와 독음으로 정확히 분리된다", function () {
  COUPLETS.forEach(function (couplet, index) {
    const split = getCouplet(index);
    assert.equal(split.firstPhrase.hanja.length, 4);
    assert.equal(split.secondPhrase.hanja.length, 4);
    assert.equal(split.firstPhrase.hanja + split.secondPhrase.hanja, couplet.hanja);
    assert.equal(
      (split.firstPhrase.reading + split.secondPhrase.reading).replace(/\s/g, ""),
      couplet.reading.replace(/\s/g, ""),
    );
  });
});

test("1,000자 훈음은 원문·독음의 같은 인덱스에 빈 값 없이 대응한다", function () {
  assert.equal(CHARACTER_HUN.length, 1000);
  assert.equal(CHARACTERS.length, CHARACTER_HUN.length);
  CHARACTERS.forEach(function (item, index) {
    const couplet = COUPLETS[Math.floor(index / 8)];
    const character = Array.from(couplet.hanja)[index % 8];
    const reading = Array.from(couplet.reading.replace(/\s/g, ""))[index % 8];
    assert.equal(item.index, index);
    assert.equal(item.character, character);
    assert.equal(item.reading, reading);
    assert.ok(item.hun.trim());
    assert.ok(item.contextHun.trim());
    assert.equal(getHunSound(item.contextHun), item.reading);
    assert.doesNotMatch(item.hun, /TODO|임시|미상|undefined|null/i);
  });
  assert.equal(CHARACTERS[0].contextHun, "하늘 천");
  assert.equal(CHARACTERS[1].contextHun, "땅 지");
  assert.equal(CHARACTERS.at(-1).contextHun, "어조사 야");
});
