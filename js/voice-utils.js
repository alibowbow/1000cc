export function isKoreanVoice(voice) {
  return Boolean(voice && /^ko(?:[-_]|$)/i.test(String(voice.lang || "")));
}

export function voicePriority(voice) {
  let score = 0;
  if (/google/i.test(String(voice && voice.name))) score += 100;
  if (/한국|korean/i.test(String(voice && voice.name))) score += 25;
  if (/^ko-KR$/i.test(String(voice && voice.lang))) score += 10;
  if (voice && voice.localService) score += 2;
  return score;
}

export function rankKoreanVoices(voices) {
  return (Array.isArray(voices) ? voices : [])
    .filter(isKoreanVoice)
    .slice()
    .sort(function (left, right) {
      return (
        voicePriority(right) - voicePriority(left) ||
        String(left.name).localeCompare(String(right.name), "ko")
      );
    });
}

export function selectPreferredVoice(voices, savedVoiceURI = "") {
  const ranked = rankKoreanVoices(voices);
  const saved = ranked.find(function (voice) {
    return voice.voiceURI === savedVoiceURI;
  });
  return saved || ranked[0] || null;
}
