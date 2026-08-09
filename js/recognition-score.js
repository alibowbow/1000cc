export function createRecognitionScore(value = {}) {
  return {
    score: Math.max(0, Math.floor(Number(value.score) || 0)),
    combo: Math.max(0, Math.floor(Number(value.combo) || 0)),
    bestCombo: Math.max(0, Math.floor(Number(value.bestCombo) || 0)),
  };
}

export function scoreGridAnswer(scoreState, outcome = {}) {
  const current = createRecognitionScore(scoreState);
  if (!outcome.correct) return { ...current, combo: 0 };
  const combo = current.combo + 1;
  const modeBonus = outcome.mode === "random1000" ? 25 : outcome.mode === "weak" ? 10 : 0;
  const difficultyBonus = Math.round(clamp(Number(outcome.distractorDifficulty) || 0, 0, 1) * 40);
  const replayBonus = outcome.replay ? 15 : 0;
  const comboBonus = Math.min(100, Math.max(0, combo - 1) * 5);
  const earned = 100 + modeBonus + difficultyBonus + replayBonus + comboBonus;
  return {
    score: current.score + earned,
    combo,
    bestCombo: Math.max(current.bestCombo, combo),
  };
}

export function scoreRecallAnswer(scoreState, outcome = {}) {
  const current = createRecognitionScore(scoreState);
  if (!outcome.correct) return { ...current, combo: 0 };
  return { ...current, score: current.score + 80 + Math.min(50, current.combo * 5) };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
