import { clamp, shuffleCopy, uniqueValidIndexes } from "./utils.js";

const TOTAL_CHARACTERS = 1000;
const DEFAULT_CHOICE_COUNT = 4;

export function createMatchingSession(options = {}) {
  const suppliedIndexes = uniqueValidIndexes(options.indexes, TOTAL_CHARACTERS);
  const startIndex = clamp(Math.floor(Number(options.startIndex) || 0), 0, TOTAL_CHARACTERS - 1);
  const endIndex = clamp(
    Math.floor(Number(options.endIndex) || startIndex + 8),
    startIndex + 1,
    TOTAL_CHARACTERS,
  );
  const questionIndexes = suppliedIndexes.length > 0
    ? suppliedIndexes
    : Array.from({ length: endIndex - startIndex }, function (_, offset) {
        return startIndex + offset;
      });
  const choiceCount = normalizeChoiceCount(options.choiceCount);
  const targetIndex = questionIndexes[0];

  return {
    engineVersion: 1,
    questionIndexes,
    startIndex: questionIndexes[0],
    endIndex: Math.max(...questionIndexes) + 1,
    choiceCount,
    questionPosition: 0,
    targetIndex,
    choiceIndexes: createChoiceIndexes(questionIndexes, targetIndex, choiceCount, options.random),
    complete: false,
  };
}

export function selectMatchingChoice(session, selectedIndex, options = {}) {
  const current = restoreMatchingSession(session);
  if (current.complete) {
    return {
      session: current,
      correct: false,
      completed: current.complete,
    };
  }

  const correct = selectedIndex === current.targetIndex;
  const questionPosition = current.questionPosition + 1;
  const complete = questionPosition >= current.questionIndexes.length;
  const targetIndex = complete ? null : current.questionIndexes[questionPosition];

  return {
    session: {
      ...current,
      questionPosition,
      targetIndex,
      choiceIndexes: complete
        ? []
        : createChoiceIndexes(
            current.questionIndexes,
            targetIndex,
            current.choiceCount,
            options.random,
          ),
      complete,
    },
    correct,
    completed: complete,
  };
}

export function restoreMatchingSession(value) {
  if (!value || Number(value.engineVersion) !== 1) {
    throw new Error("한자 맞추기 게임 저장 형식이 올바르지 않습니다.");
  }

  const questionIndexes = uniqueValidIndexes(value.questionIndexes, TOTAL_CHARACTERS);
  const choiceCount = normalizeChoiceCount(value.choiceCount);
  const questionPosition = Number(value.questionPosition);

  if (
    questionIndexes.length === 0 ||
    !Number.isInteger(questionPosition) ||
    questionPosition < 0 ||
    questionPosition > questionIndexes.length
  ) {
    throw new Error("한자 맞추기 게임 저장 값이 유효하지 않습니다.");
  }

  const complete = questionPosition >= questionIndexes.length;
  const targetIndex = complete ? null : questionIndexes[questionPosition];
  const choiceIndexes = complete ? [] : uniqueValidIndexes(value.choiceIndexes, TOTAL_CHARACTERS);

  if (
    !complete &&
    (choiceIndexes.length !== choiceCount || !choiceIndexes.includes(targetIndex))
  ) {
    throw new Error("한자 맞추기 후보가 현재 문제와 일치하지 않습니다.");
  }

  return {
    engineVersion: 1,
    questionIndexes,
    startIndex: questionIndexes[0],
    endIndex: Math.max(...questionIndexes) + 1,
    choiceCount,
    questionPosition,
    targetIndex,
    choiceIndexes,
    complete,
  };
}

export function getMatchingProgress(session) {
  const current = restoreMatchingSession(session);
  return {
    completed: current.questionPosition,
    total: current.questionIndexes.length,
    remaining: current.questionIndexes.length - current.questionPosition,
  };
}

function createChoiceIndexes(questionIndexes, targetIndex, choiceCount, random = Math.random) {
  const candidates = questionIndexes.filter(function (index) {
    return index !== targetIndex;
  });
  const distractors = shuffleCopy(candidates, random).slice(0, choiceCount - 1);

  if (distractors.length < choiceCount - 1) {
    for (let index = 0; index < TOTAL_CHARACTERS && distractors.length < choiceCount - 1; index += 1) {
      if (index !== targetIndex && !distractors.includes(index)) distractors.push(index);
    }
  }

  return shuffleCopy([targetIndex, ...distractors], random);
}

function normalizeChoiceCount(value) {
  return Number(value) === 6 ? 6 : DEFAULT_CHOICE_COUNT;
}
