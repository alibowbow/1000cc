import test from "node:test";
import assert from "node:assert/strict";
import {
  COUPLET_MEANING_PAUSE_MS,
  COUPLET_READING_PAUSE_MS,
  createCoupletSpeechItems,
  TTSManager,
} from "../js/tts-manager.js";
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

test("8자 듣기는 독음 뒤에 문맥 풀이를 이어서 구성한다", function () {
  assert.deepEqual(
    createCoupletSpeechItems({
      reading: "천지현황 우주홍황",
      meaning: "하늘은 검고 땅은 누르며, 우주는 넓고도 거칠다.",
    }),
    [
      { text: "천지현황, 우주홍황", pauseAfterMs: COUPLET_READING_PAUSE_MS },
      {
        text: "하늘은 검고 땅은 누르며, 우주는 넓고도 거칠다.",
        pauseAfterMs: COUPLET_MEANING_PAUSE_MS,
      },
    ],
  );
});

function createSpeechHarness(options = {}) {
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
    resumeCount: 0,
    speaking: Boolean(options.speaking),
    pending: Boolean(options.pending),
    paused: Boolean(options.paused),
    getVoices() { return typeof options.getVoices === "function" ? options.getVoices() : voices; },
    addEventListener() {},
    removeEventListener() {},
    cancel() { this.cancelCount += 1; },
    resume() { this.resumeCount += 1; this.paused = false; },
    speak(utterance) { this.spoken.push(utterance); this.speaking = true; },
  };
  const scheduledDelays = [];
  const scheduledCallbacks = [];
  const clearedSchedules = [];
  const manager = new TTSManager({
    synthesis,
    Utterance: FakeUtterance,
    schedule(callback, delayMs) {
      scheduledDelays.push(delayMs);
      if (options.manualSchedule) {
        scheduledCallbacks.push(callback);
        return scheduledCallbacks.length;
      }
      callback();
      return scheduledDelays.length;
    },
    clearSchedule(timer) { clearedSchedules.push(timer); },
  });
  manager.start();
  return {
    manager,
    synthesis,
    scheduledDelays,
    scheduledCallbacks,
    clearedSchedules,
  };
}

test("대기 중인 엔진은 취소하지 않고, 일시 정지 상태만 해제한 뒤 바로 재생한다", function () {
  const { manager, synthesis } = createSpeechHarness({ paused: true });
  manager.speak("하늘 천");
  assert.equal(synthesis.cancelCount, 0);
  assert.equal(synthesis.resumeCount, 1);
  assert.equal(synthesis.spoken[0].text, "하늘 천");
});

test("페이지 로드 뒤 늦게 준비된 한국어 음성을 재생 직전에 다시 불러온다", function () {
  let ready = false;
  const { manager, synthesis } = createSpeechHarness({
    getVoices() { return ready ? voices : []; },
  });
  ready = true;
  manager.speak("검을 현");
  assert.equal(synthesis.spoken[0].voice.voiceURI, "google");
});

test("8자 독음 뒤 충분히 쉰 다음 문맥 풀이를 재생한다", function () {
  const { manager, synthesis, scheduledDelays } = createSpeechHarness();
  let ended = 0;
  manager.speakSequence(
    createCoupletSpeechItems({
      reading: "천지현황 우주홍황",
      meaning: "하늘은 검고 땅은 누르며, 우주는 넓고도 거칠다.",
    }),
    { onEnd() { ended += 1; } },
  );

  assert.equal(synthesis.spoken.length, 1);
  assert.equal(synthesis.spoken[0].text, "천지현황, 우주홍황");
  synthesis.spoken[0].emit("end");
  assert.equal(scheduledDelays.at(-1), COUPLET_READING_PAUSE_MS);
  assert.equal(synthesis.spoken.length, 2);
  assert.equal(synthesis.spoken[1].text, "하늘은 검고 땅은 누르며, 우주는 넓고도 거칠다.");
  synthesis.spoken[1].emit("end");
  assert.equal(ended, 1);
});

test("연속 듣기는 풀이가 끝난 뒤에도 쉰 다음 다음 8자로 넘어간다", function () {
  const { manager, synthesis, scheduledDelays } = createSpeechHarness();
  const items = [
    ...createCoupletSpeechItems({ reading: "천지현황 우주홍황", meaning: "첫 풀이." }),
    ...createCoupletSpeechItems({ reading: "일월영측 진숙열장", meaning: "둘째 풀이." }),
  ];
  manager.speakSequence(items);

  synthesis.spoken[0].emit("end");
  synthesis.spoken[1].emit("end");
  assert.deepEqual(scheduledDelays.slice(-2), [
    COUPLET_READING_PAUSE_MS,
    COUPLET_MEANING_PAUSE_MS,
  ]);
  assert.equal(synthesis.spoken[2].text, "일월영측, 진숙열장");
});

test("쉼 대기 중 재생 정지를 누르면 다음 음성이 시작되지 않는다", function () {
  const {
    manager,
    synthesis,
    scheduledCallbacks,
    clearedSchedules,
  } = createSpeechHarness({ manualSchedule: true });
  manager.speakSequence(
    createCoupletSpeechItems({ reading: "천지현황 우주홍황", meaning: "첫 풀이." }),
  );

  synthesis.spoken[0].emit("end");
  assert.equal(scheduledCallbacks.length, 1);
  manager.cancel();
  assert.deepEqual(clearedSchedules, [1]);
  scheduledCallbacks[0]();
  assert.equal(synthesis.spoken.length, 1);
});

test("새 재생의 session token은 취소된 이전 utterance의 늦은 onend를 무시한다", function () {
  const { manager, synthesis } = createSpeechHarness();
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
  assert.equal(synthesis.cancelCount, 1);
});

test("선택한 음성이 실패하면 다른 한국어 음성으로 한 번 자동 재시도한다", function () {
  const { manager, synthesis } = createSpeechHarness();
  let failed = 0;
  let fallbackVoice = "";
  manager.onVoiceFallback = function (voice) {
    fallbackVoice = voice ? voice.voiceURI : "";
  };
  manager.speak("하늘 천", { onError() { failed += 1; } });
  const first = synthesis.spoken[0];
  assert.equal(first.voice.voiceURI, "google");
  first.emit("error", { error: "network" });
  assert.equal(synthesis.spoken.length, 2);
  assert.equal(synthesis.spoken[1].voice.voiceURI, "samsung");
  assert.equal(fallbackVoice, "samsung");
  assert.equal(failed, 0);
});

test("기기 음성이 취소되거나 중단돼도 재생 상태를 반드시 해제한다", function () {
  ["canceled", "interrupted"].forEach(function (error) {
    const { manager, synthesis } = createSpeechHarness();
    const states = [];
    manager.onStateChange = function (state) { states.push(state.speaking); };
    manager.speak("하늘 천");
    synthesis.spoken[0].emit("error", { error });
    assert.deepEqual(states, [true, false], `${error} 뒤 speaking 상태가 남아서는 안 된다`);
  });
});

test("utterance는 종료될 때까지 강한 참조로 유지한다", function () {
  const { manager, synthesis } = createSpeechHarness();
  manager.speak("땅 지");
  const utterance = synthesis.spoken[0];
  assert.equal(manager.activeUtterances.has(utterance), true);
  utterance.emit("end");
  assert.equal(manager.activeUtterances.has(utterance), false);
});
