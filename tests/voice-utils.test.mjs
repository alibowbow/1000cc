import test from "node:test";
import assert from "node:assert/strict";
import { TTSManager } from "../js/tts-manager.js";
import {
  isKoreanVoice,
  rankKoreanVoices,
  selectPreferredVoice,
} from "../js/voice-utils.js";

const voices = [
  { name: "English", lang: "en-US", voiceURI: "en", localService: true },
  { name: "Samsung 한국어", lang: "ko-KR", voiceURI: "samsung", localService: true },
  { name: "Google 한국의", lang: "ko-KR", voiceURI: "google", localService: false },
  { name: "Korean Legacy", lang: "ko", voiceURI: "legacy", localService: true },
];

test("ko-KR 계열만 모으고 Google 한국어 음성을 우선한다", function () {
  assert.equal(isKoreanVoice(voices[0]), false);
  assert.equal(isKoreanVoice(voices[1]), true);
  const ranked = rankKoreanVoices(voices);
  assert.deepEqual(ranked.map((voice) => voice.voiceURI), ["google", "samsung", "legacy"]);
});

test("저장된 한국어 음성이 있으면 유지하고 사라지면 우선순위 음성으로 대체한다", function () {
  assert.equal(selectPreferredVoice(voices, "samsung").voiceURI, "samsung");
  assert.equal(selectPreferredVoice(voices, "missing").voiceURI, "google");
});

test("새 재생의 session token은 취소된 이전 utterance의 늦은 onend를 무시한다", function () {
  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.listeners = {};
    }
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
    emit(type, event = {}) {
      if (this.listeners[type]) this.listeners[type](event);
    }
  }
  const synthesis = {
    spoken: [],
    cancelCount: 0,
    getVoices() { return voices; },
    addEventListener() {},
    removeEventListener() {},
    cancel() { this.cancelCount += 1; },
    speak(utterance) { this.spoken.push(utterance); },
  };
  const manager = new TTSManager({ synthesis, Utterance: FakeUtterance });
  manager.start();
  let oldEnded = 0;
  let newEnded = 0;
  manager.speak("첫 음성", { onEnd() { oldEnded += 1; } });
  const oldUtterance = synthesis.spoken.at(-1);
  manager.speak("새 음성", { onEnd() { newEnded += 1; } });
  const newUtterance = synthesis.spoken.at(-1);
  oldUtterance.emit("end");
  assert.equal(oldEnded, 0);
  newUtterance.emit("end");
  assert.equal(newEnded, 1);
  assert.ok(synthesis.cancelCount >= 2);
});
