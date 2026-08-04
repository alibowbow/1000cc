import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COUPLETS } from "../data.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../character-content.js");
const characters = Array.from(COUPLETS.map((couplet) => couplet.hanja).join(""));
const characterSet = new Set(characters);
const readings = Array.from(COUPLETS.map((couplet) => couplet.reading.replace(/\s/g, "")).join(""));
const readingByCharacter = new Map(characters.map(function (character, index) {
  return [character, readings[index]];
}));
const candidates = new Map(characters.map((character) => [character, []]));
const sourceHeaders = {
  "User-Agent": "1000cc-content-builder/1.0 (https://github.com/alibowbow/1000cc)",
};

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function pushCandidate(character, candidate) {
  const list = candidates.get(character);
  const origin = Array.from(candidate.origin);
  const syllables = Array.from(candidate.word);
  const contextReading = readingByCharacter.get(character);
  if (
    origin.length !== syllables.length ||
    !origin.some(function (originCharacter, position) {
      return originCharacter === character && syllables[position] === contextReading;
    }) ||
    /이름|성씨|지명|고을|중국의|나라의|왕조|사람을 이르는 말|옛말|방언|북한어|산 이름/.test(
      candidate.definition,
    )
  ) {
    return;
  }
  if (!list || list.some((item) => item.word === candidate.word && item.origin === candidate.origin)) return;
  list.push(candidate);
  list.sort((left, right) => left.score - right.score || left.word.localeCompare(right.word, "ko"));
  if (list.length > 16) list.length = 16;
}

function addBasicDictionaryEntry(xml) {
  const origin = decodeXml(xml.match(/<feat att="origin" val="([^"]*)"\s*\/>/)?.[1]).trim();
  if (!origin || !/^\p{Script=Han}+$/u.test(origin) || Array.from(origin).length < 2) return;

  const lemma = xml.match(/<Lemma>([\s\S]*?)<\/Lemma>/)?.[1] || "";
  const word = decodeXml(lemma.match(/<feat att="writtenForm" val="([^"]*)"\s*\/>/)?.[1]).trim();
  if (!/^[가-힣]{2,5}$/.test(word)) return;

  const definition = decodeXml(xml.match(/<feat att="definition" val="([^"]+)"\s*\/>/)?.[1]).trim();
  const level = decodeXml(xml.match(/<feat att="vocabularyLevel" val="([^"]+)"\s*\/>/)?.[1]).trim();
  if (!definition || !["초급", "중급", "고급"].includes(level)) return;

  const originCharacters = Array.from(origin);
  const baseScore = { 초급: 0, 중급: 10, 고급: 20 }[level];
  for (const character of new Set(originCharacters.filter((item) => characterSet.has(item)))) {
    pushCandidate(character, {
      word,
      origin,
      definition,
      source: "한국어기초사전",
      score:
        baseScore +
        Math.max(0, originCharacters.length - 2) * 4 +
        Math.max(0, word.length - 2) * 2 +
        Math.max(0, originCharacters.indexOf(character)) * 2,
    });
  }
}

function addStandardDictionaryEntry(xml) {
  if (!/<word_type>한자어<\/word_type>/.test(xml)) return;
  const rawWord = xml.match(/<word><!\[CDATA\[([\s\S]*?)\]\]><\/word>/)?.[1] || "";
  const word = decodeXml(rawWord).replace(/[-^]/g, "").trim();
  if (!/^[가-힣]{2,5}$/.test(word)) return;

  const origins = [];
  for (const match of xml.matchAll(/<original_language_info>([\s\S]*?)<\/original_language_info>/g)) {
    const block = match[1];
    if (!/<language_type><!\[CDATA\[한자\]\]><\/language_type>/.test(block)) continue;
    const origin = decodeXml(
      block.match(/<original_language><!\[CDATA\[([\s\S]*?)\]\]><\/original_language>/)?.[1],
    ).trim();
    if (origin) origins.push(origin);
  }

  const origin = origins.join("");
  const originCharacters = Array.from(origin);
  if (!origin || !/^\p{Script=Han}+$/u.test(origin) || originCharacters.length < 2 || originCharacters.length > 5) return;

  const definition = decodeXml(
    xml.match(/<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/)?.[1],
  )
    .replace(/<[^>]+>/g, "")
    .trim();
  if (
    !definition ||
    /의 어근\.?$|낮잡아 이르는 말|옛말|방언|북한어|[「」]|\[[^\]]+\]/.test(definition)
  ) return;

  for (const character of new Set(originCharacters.filter((item) => characterSet.has(item)))) {
    pushCandidate(character, {
      word,
      origin,
      definition,
      source: "표준국어대사전",
      score:
        50 +
        Math.max(0, originCharacters.length - 2) * 4 +
        Math.max(0, word.length - 2) * 2 +
        Math.max(0, originCharacters.indexOf(character)) * 2 +
        (definition.length > 120 ? 6 : 0) +
        (/옛말|방언|북한어|이름|성씨|지명/.test(definition) ? 18 : 0),
    });
  }
}

async function streamXml(url, closingTag, handler) {
  const response = await fetch(url, { headers: sourceHeaders });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const openingTag = closingTag === "</item>" ? "<item>" : "<LexicalEntry";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let end;
    while ((end = buffer.indexOf(closingTag)) >= 0) {
      const close = end + closingTag.length;
      const start = buffer.lastIndexOf(openingTag, end);
      if (start >= 0) handler(buffer.slice(start, close));
      buffer = buffer.slice(close);
    }
    if (done) break;
    if (buffer.length > 2_000_000) {
      const start = buffer.lastIndexOf(openingTag);
      buffer = start >= 0 ? buffer.slice(start) : "";
    }
  }
}

async function runPool(items, workerCount, worker) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, next));
}

async function loadVocabulary() {
  const basicFiles = Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(3, "0"));
  await runPool(basicFiles, 3, async function (file) {
    await streamXml(
      `https://raw.githubusercontent.com/spellcheck-ko/korean-dict-nikl/master/krdict/${file}.xml`,
      "</LexicalEntry>",
      addBasicDictionaryEntry,
    );
  });

  const listingResponse = await fetch(
    "https://api.github.com/repos/spellcheck-ko/korean-dict-nikl/contents/stdict",
    { headers: sourceHeaders },
  );
  const listing = await listingResponse.json();
  const standardFiles = listing.filter((item) => item.name.endsWith(".xml")).map((item) => item.name);
  await runPool(standardFiles, 10, async function (file) {
    await streamXml(
      `https://raw.githubusercontent.com/spellcheck-ko/korean-dict-nikl/master/stdict/${file}`,
      "</item>",
      addStandardDictionaryEntry,
    );
  });
}

async function loadCharacterForms() {
  const workspace = await mkdtemp(join(tmpdir(), "1000cc-unihan-"));
  const zipPath = join(workspace, "Unihan.zip");
  const response = await fetch("https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip", {
    headers: sourceHeaders,
  });
  if (!response.ok) throw new Error(`Unihan: ${response.status}`);
  await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  const raw = execFileSync("unzip", ["-p", zipPath, "Unihan_IRGSources.txt"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  const data = new Map();
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [codePoint, field, value] = line.split("\t");
    if (field !== "kRSUnicode" && field !== "kTotalStrokes") continue;
    const character = String.fromCodePoint(Number.parseInt(codePoint.slice(2), 16));
    if (!characterSet.has(character)) continue;
    const record = data.get(character) || {};
    if (field === "kRSUnicode") record.radicalNumber = Number.parseInt(value.split(/[.'\s]/)[0], 10);
    if (field === "kTotalStrokes") record.totalStrokes = Number.parseInt(value, 10);
    data.set(character, record);
  }

  const radicals = Array.from(
    "一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨靑非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠",
  );
  if (radicals.length !== 214) throw new Error(`부수표 길이 오류: ${radicals.length}`);

  return characters.map(function (character) {
    const record = data.get(character);
    if (!record?.radicalNumber || !record?.totalStrokes) {
      throw new Error(`${character}의 Unicode 부수·획수 정보가 없습니다.`);
    }
    return [character, radicals[record.radicalNumber - 1], record.totalStrokes];
  });
}

function selectWords(character) {
  const selected = [];
  const definitions = new Set();
  for (const candidate of candidates.get(character)) {
    if (definitions.has(candidate.definition)) continue;
    selected.push({
      word: candidate.word,
      origin: candidate.origin,
      definition: candidate.definition,
    });
    definitions.add(candidate.definition);
    if (selected.length === 2) break;
  }
  return selected;
}

function createModule(forms) {
  const words = Object.fromEntries(
    characters
      .map((character) => [character, selectWords(character)])
      .filter(([, entries]) => entries.length > 0),
  );
  return `/**
 * Generated character-learning content.
 *
 * Form data: Unicode 17.0 Unihan Database (Unicode License v3).
 * Vocabulary definitions: 국립국어원 한국어기초사전·표준국어대사전
 * (CC BY-SA 2.0 KR). Dictionary examples and media are not included.
 */

export const CHARACTER_CONTENT_SOURCES = Object.freeze({
  unihan: "https://www.unicode.org/reports/tr38/",
  krdict: "https://krdict.korean.go.kr/",
  stdict: "https://stdict.korean.go.kr/",
});

export const CHARACTER_FORMS = Object.freeze(${JSON.stringify(forms, null, 2)});

export const CHARACTER_WORDS = Object.freeze(${JSON.stringify(words, null, 2)});
`;
}

await loadVocabulary();
const forms = await loadCharacterForms();
await writeFile(outputPath, createModule(forms), "utf8");

const wordCoverage = characters.filter((character) => selectWords(character).length > 0).length;
console.log(`character-content.js: form ${forms.length}/1000, vocabulary ${wordCoverage}/1000`);
