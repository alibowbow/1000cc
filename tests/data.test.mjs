import test from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_FORMS, CHARACTER_WORDS } from "../character-content.js";
import { CHARACTER_HUN } from "../character-meta.js";
import {
  CHARACTERS,
  COUPLETS,
  TOTAL_CHARACTERS,
  getCouplet,
  getCharacterStudyDetails,
  getHunSound,
  findCharacterIndexes,
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

test("1,000자 부수·총획 정보는 원문과 같은 순서로 대응한다", function () {
  assert.equal(CHARACTER_FORMS.length, 1000);
  CHARACTER_FORMS.forEach(function ([character, radical, totalStrokes], index) {
    assert.equal(character, CHARACTERS[index].character);
    assert.match(radical, /^\p{Script=Han}$/u);
    assert.ok(Number.isInteger(totalStrokes) && totalStrokes > 0);
    assert.equal(CHARACTERS[index].radical, radical);
    assert.equal(CHARACTERS[index].totalStrokes, totalStrokes);
  });
  assert.deepEqual(CHARACTER_FORMS[0], ["天", "大", 4]);
  assert.deepEqual(CHARACTER_FORMS[1], ["地", "土", 6]);
});

test("관련 한자어는 실제 표제어·한자·사전 정의를 빈 값 없이 제공한다", function () {
  assert.ok(Object.keys(CHARACTER_WORDS).length >= 950);
  Object.entries(CHARACTER_WORDS).forEach(function ([character, words]) {
    assert.ok(words.length >= 1 && words.length <= 2);
    words.forEach(function (word) {
      assert.match(word.word, /^[가-힣]{2,5}$/);
      assert.match(word.origin, /^\p{Script=Han}{2,5}$/u);
      assert.ok(word.origin.includes(character));
      assert.ok(word.definition.trim());
      assert.doesNotMatch(word.definition, /TODO|임시 문구|뜻은 .*입니다|이 글귀에서는/i);
    });
  });
  assert.deepEqual(CHARACTER_WORDS.天[0], {
    word: "천국",
    origin: "天國",
    definition: "하늘에 있다는, 평화롭고 모두가 행복해하는 이상적인 세상.",
  });
});

test("선택 글자 학습 정보는 훈음·짜임·실제 한자어를 제공한다", function () {
  const first = getCharacterStudyDetails(0);
  assert.equal(first.item.contextHun, "하늘 천");
  assert.equal(first.radical, "大");
  assert.equal(first.totalStrokes, 4);
  assert.equal(first.relatedWords[0].word, "천국");
  assert.equal(first.relatedWords[0].origin, "天國");

  const last = getCharacterStudyDetails(999);
  assert.equal(last.item.contextHun, "어조사 야");
  assert.ok(last.radical);
  assert.ok(last.totalStrokes > 0);
});

test("전체 보기 검색은 관련 한자어와 사전 뜻까지 찾는다", function () {
  assert.ok(findCharacterIndexes("천국").includes(0));
  assert.ok(findCharacterIndexes("평화롭고 모두가 행복").includes(0));
  assert.ok(findCharacterIndexes("天國").includes(0));
});
