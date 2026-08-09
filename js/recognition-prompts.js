export const GRID_PROMPT_TYPES = Object.freeze(["hun-to-character", "gloss-to-character"]);
export const RECALL_PROMPT_TYPES = Object.freeze(["character-to-reading", "character-to-meaning"]);
export const GRID_PROMPT_WEIGHTS = Object.freeze({ hun: 60, gloss: 25 });

export class AmbiguousRecognitionPromptError extends Error {
  constructor(targetIndex) {
    super(`보드에서 ${targetIndex}번 글자를 유일하게 식별할 훈음 또는 뜻 프롬프트가 없습니다.`);
    this.name = "AmbiguousRecognitionPromptError";
    this.targetIndex = targetIndex;
  }
}

export function isHunPromptSafe(targetIndex, boardIndexes, characterData) {
  const target = getItem(characterData, targetIndex);
  if (!target) return false;
  const targetHun = normalizeLabel(target.contextHun || target.hun || target.reading);
  if (!targetHun) return false;
  return (boardIndexes || []).every(function (index) {
    if (index === targetIndex) return true;
    const candidate = getItem(characterData, index);
    return !candidate || normalizeLabel(
      candidate.contextHun || candidate.hun || candidate.reading,
    ) !== targetHun;
  });
}

export function isMeaningPromptSafe(targetIndex, boardIndexes, characterData) {
  const target = getItem(characterData, targetIndex);
  if (!target) return false;
  const targetGloss = normalizeLabel(target.gloss);
  if (!targetGloss) return false;
  return (boardIndexes || []).every(function (index) {
    if (index === targetIndex) return true;
    const candidate = getItem(characterData, index);
    return !candidate || normalizeLabel(candidate.gloss) !== targetGloss;
  });
}

export function createGridPrompt(options = {}) {
  const target = getItem(options.characterData, options.targetIndex);
  if (!target) throw new RangeError("그리드 프롬프트의 정답 글자가 없습니다.");
  const meaningSafe = isMeaningPromptSafe(
    target.index,
    options.boardIndexes,
    options.characterData,
  );
  const hunSafe = isHunPromptSafe(
    target.index,
    options.boardIndexes,
    options.characterData,
  );
  if (!hunSafe && !meaningSafe) throw new AmbiguousRecognitionPromptError(target.index);
  let type = GRID_PROMPT_TYPES.includes(options.preferredType)
    ? options.preferredType
    : chooseGridPromptType(options.random);

  if (GRID_PROMPT_TYPES.includes(options.avoidType)) {
    const alternate = options.avoidType === "hun-to-character"
      ? "gloss-to-character"
      : "hun-to-character";
    if (
      (alternate === "gloss-to-character" && meaningSafe) ||
      (alternate === "hun-to-character" && hunSafe)
    ) type = alternate;
  }
  if (type === "gloss-to-character" && !meaningSafe) type = "hun-to-character";
  if (type === "hun-to-character" && !hunSafe) type = "gloss-to-character";

  return {
    kind: "grid",
    type,
    targetIndex: target.index,
    text: type === "gloss-to-character"
      ? String(target.gloss || "").trim()
      : String(target.contextHun || target.hun || target.reading || "").trim(),
  };
}

/**
 * The 60:25 spec weights are normalized here because reverse prompts are
 * scheduled as separate recall cards rather than returned by this function.
 */
export function chooseGridPromptType(random = Math.random) {
  const total = GRID_PROMPT_WEIGHTS.hun + GRID_PROMPT_WEIGHTS.gloss;
  const hunShare = GRID_PROMPT_WEIGHTS.hun / total;
  return sample(random) < hunShare ? "hun-to-character" : "gloss-to-character";
}

export function createRecallPrompt(options = {}) {
  const target = getItem(options.characterData, options.targetIndex);
  if (!target) throw new RangeError("역방향 확인의 정답 글자가 없습니다.");
  const type = RECALL_PROMPT_TYPES.includes(options.type)
    ? options.type
    : sample(options.random) < 0.5
      ? "character-to-reading"
      : "character-to-meaning";
  const choiceCount = Math.max(2, Math.floor(Number(options.choiceCount) || 4));
  const candidateIndexes = uniqueIndexes([
    ...(options.candidateIndexes || []),
    ...options.characterData.map(function (item) { return item.index; }),
  ]);
  const choices = [];
  const usedLabels = new Set();

  function addChoice(index) {
    const item = getItem(options.characterData, index);
    if (!item) return;
    const label = getRecallLabel(item, type);
    const normalized = normalizeLabel(label);
    if (!normalized || usedLabels.has(normalized)) return;
    usedLabels.add(normalized);
    choices.push({ index: item.index, label });
  }

  addChoice(target.index);
  shuffleCopy(candidateIndexes.filter(function (index) { return index !== target.index; }), options.random)
    .forEach(function (index) {
      if (choices.length < choiceCount) addChoice(index);
    });
  if (choices.length < choiceCount) {
    throw new RangeError(`서로 다른 역방향 선택지 ${choiceCount}개를 만들 수 없습니다.`);
  }

  return {
    kind: "recall",
    type,
    targetIndex: target.index,
    promptText: target.character,
    choices: shuffleCopy(choices.slice(0, choiceCount), options.random),
    correctIndex: target.index,
  };
}

export function getRecallSkill(promptType) {
  if (promptType === "character-to-reading") return "reading";
  if (promptType === "character-to-meaning") return "meaning";
  return null;
}

export function createCandidateSignature(boardIndexes) {
  return uniqueIndexes(boardIndexes).sort(function (left, right) { return left - right; }).join(",");
}

function getRecallLabel(item, type) {
  if (type === "character-to-meaning") return String(item.gloss || item.meaning || "").trim();
  return String(item.contextHun || item.hun || item.reading || "").trim();
}

function getItem(data, index) {
  if (!Array.isArray(data)) return null;
  const direct = data[index];
  if (direct && direct.index === index) return direct;
  return data.find(function (item) { return item && item.index === index; }) || null;
}

function normalizeLabel(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ko").replace(/[\s·,._-]+/g, "");
}

function uniqueIndexes(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Number.isInteger)));
}

function shuffleCopy(values, random = Math.random) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(sample(random) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function sample(random = Math.random) {
  const value = Number((typeof random === "function" ? random : Math.random)());
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 - Number.EPSILON : value;
}
