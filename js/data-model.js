import { COUPLETS, TOTAL_CHARACTERS } from "../data.js";
import { CHARACTER_HUN } from "../character-meta.js";
import { CHARACTER_FORMS, CHARACTER_WORDS } from "../character-content.js";
import { normalizeSearch } from "./utils.js";

const CONTEXT_HUN_OVERRIDES = new Map([
  [169, "허물 과"],
  [238, "이 시"],
  [242, "섬길 사"],
]);

export function getHunOptions(hun) {
  return String(hun)
    .split("/")
    .map(function (option) {
      return option.trim();
    })
    .filter(Boolean);
}

export function getHunSound(hun) {
  return String(hun).trim().split(/\s+/).at(-1) || "";
}

export function getHunGloss(hun) {
  const words = String(hun).trim().split(/\s+/);
  return words.slice(0, -1).join(" ");
}

export function selectContextHun(hun, reading, index = -1) {
  if (CONTEXT_HUN_OVERRIDES.has(index)) return CONTEXT_HUN_OVERRIDES.get(index);
  const options = getHunOptions(hun);
  const selected =
    options.find(function (option) {
      return getHunSound(option) === reading;
    }) || options[0];
  if (!selected) return `독음 ${reading}`;
  if (getHunSound(selected) === reading) return selected;
  return `${getHunGloss(selected)} ${reading}`.trim();
}

export const CHARACTERS = Object.freeze(
  COUPLETS.flatMap(function (couplet, coupletIndex) {
    const hanja = Array.from(couplet.hanja);
    const readings = Array.from(couplet.reading.replace(/\s/g, ""));
    return hanja.map(function (character, offset) {
      const index = coupletIndex * 8 + offset;
      const hun = CHARACTER_HUN[index];
      const contextHun = selectContextHun(hun, readings[offset], index);
      const form = CHARACTER_FORMS[index];
      if (!form || form[0] !== character) {
        throw new Error(`${index + 1}번째 글자의 부수·획수 정보가 원문과 일치하지 않습니다.`);
      }
      const phraseStart = Math.floor(index / 4) * 4;
      return Object.freeze({
        index,
        number: index + 1,
        character,
        reading: readings[offset],
        hun,
        contextHun,
        gloss: getHunGloss(contextHun),
        coupletIndex,
        offset,
        phraseIndex: Math.floor(index / 4),
        phraseStart,
        phrase: Array.from(couplet.hanja).slice(offset < 4 ? 0 : 4, offset < 4 ? 4 : 8).join(""),
        phraseReading: Array.from(couplet.reading.replace(/\s/g, ""))
          .slice(offset < 4 ? 0 : 4, offset < 4 ? 4 : 8)
          .join(" "),
        couplet: couplet.hanja,
        coupletReading: couplet.reading,
        meaning: couplet.meaning,
        radical: form[1],
        totalStrokes: form[2],
        relatedWords: Object.freeze(CHARACTER_WORDS[character] || []),
      });
    });
  }),
);

if (CHARACTERS.length !== TOTAL_CHARACTERS || CHARACTER_HUN.length !== TOTAL_CHARACTERS) {
  throw new Error("천자문 글자 메타데이터가 1,000자와 일치하지 않습니다.");
}

export function getPhrase(startIndex) {
  const start = Math.floor(Number(startIndex) / 4) * 4;
  const items = CHARACTERS.slice(start, start + 4);
  return {
    startIndex: start,
    items,
    hanja: items.map(function (item) {
      return item.character;
    }).join(""),
    reading: items.map(function (item) {
      return item.reading;
    }).join(" "),
  };
}

export function getCouplet(coupletIndex) {
  const index = Math.min(124, Math.max(0, Math.floor(Number(coupletIndex) || 0)));
  const startIndex = index * 8;
  return {
    index,
    startIndex,
    data: COUPLETS[index],
    firstPhrase: getPhrase(startIndex),
    secondPhrase: getPhrase(startIndex + 4),
    items: CHARACTERS.slice(startIndex, startIndex + 8),
  };
}

export function getCharacterStudyDetails(index) {
  const safeIndex = Math.min(TOTAL_CHARACTERS - 1, Math.max(0, Math.floor(Number(index) || 0)));
  const item = CHARACTERS[safeIndex];
  const phrase = getPhrase(item.phraseStart);
  const couplet = getCouplet(item.coupletIndex);
  return {
    item,
    couplet,
    phrase,
    radical: item.radical,
    totalStrokes: item.totalStrokes,
    relatedWords: item.relatedWords,
  };
}

export function findCharacterIndexes(query) {
  const raw = String(query || "").trim();
  if (!raw) return CHARACTERS.map(function (item) { return item.index; });
  if (/^\d{1,4}$/.test(raw)) {
    const number = Number(raw);
    return number >= 1 && number <= TOTAL_CHARACTERS ? [number - 1] : [];
  }
  const needle = normalizeSearch(raw);
  return CHARACTERS.filter(function (item) {
    return [
      item.character,
      item.reading,
      item.hun,
      item.contextHun,
      item.phrase,
      item.phraseReading,
      item.couplet,
      item.coupletReading,
      item.meaning,
      ...item.relatedWords.flatMap(function (word) {
        return [word.word, word.origin, word.definition];
      }),
      String(item.number),
    ].some(function (value) {
      return normalizeSearch(value).includes(needle);
    });
  }).map(function (item) {
    return item.index;
  });
}

export { COUPLETS, TOTAL_CHARACTERS };
