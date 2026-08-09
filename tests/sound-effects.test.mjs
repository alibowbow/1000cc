import test from "node:test";
import assert from "node:assert/strict";
import { SOUND_EFFECT_CUES, SoundEffects } from "../js/sound-effects.js";

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ kind: "set", value, time });
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ kind: "linear", value, time });
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ kind: "exponential", value, time });
  }

  cancelScheduledValues(time) {
    this.events.push({ kind: "cancel", time });
  }
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam(1);
  }
}

class FakeFilter extends FakeNode {
  constructor() {
    super();
    this.type = "";
    this.frequency = new FakeAudioParam();
    this.Q = new FakeAudioParam();
  }
}

class FakeOscillator extends FakeNode {
  constructor() {
    super();
    this.type = "sine";
    this.frequency = new FakeAudioParam();
    this.startedAt = null;
    this.stoppedAt = null;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  start(time) {
    this.startedAt = time;
  }

  stop(time) {
    this.stoppedAt = time;
  }
}

class FakeAudioContext {
  constructor(options = {}) {
    this.currentTime = 4;
    this.state = options.state || "running";
    this.destination = new FakeNode();
    this.gains = [];
    this.filters = [];
    this.oscillators = [];
    this.resumeCount = 0;
    this.suspendCount = 0;
    this.rejectResume = Boolean(options.rejectResume);
    this.resumeState = options.resumeState || "running";
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createBiquadFilter() {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  resume() {
    this.resumeCount += 1;
    if (this.rejectResume) return Promise.reject(new Error("blocked"));
    this.state = this.resumeState;
    return Promise.resolve();
  }

  suspend() {
    this.suspendCount += 1;
    this.state = "suspended";
    return Promise.resolve();
  }
}

class FakeMediaPlayer {
  constructor(options = {}) {
    this.currentTime = 0;
    this.pauseCount = 0;
    this.playCount = 0;
    this.preload = "";
    this.rejectPlay = Boolean(options.rejectPlay);
    this.src = "";
    this.volume = 1;
  }

  pause() {
    this.pauseCount += 1;
  }

  play() {
    this.playCount += 1;
    return this.rejectPlay
      ? Promise.reject(new Error("media-blocked"))
      : Promise.resolve();
  }
}

function flushMicrotasks() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

test("오디오 컨텍스트는 지원되는 첫 재생에서만 생성된다", function () {
  let createCount = 0;
  const context = new FakeAudioContext();
  const sound = new SoundEffects({
    enabled: false,
    contextFactory() {
      createCount += 1;
      return context;
    },
  });

  assert.equal(createCount, 0);
  assert.equal(sound.play("tap"), false);
  assert.equal(sound.play("unknown"), false);
  assert.equal(createCount, 0);
  sound.setEnabled(true);
  assert.equal(sound.play("tap"), true);
  assert.equal(createCount, 1);
  assert.equal(context.oscillators.length, 1);
  assert.equal(sound.play("tap"), true);
  assert.equal(createCount, 1);
});

test("지원되지 않거나 생성에 실패한 환경에서도 게임을 막지 않는다", function () {
  const unsupported = new SoundEffects({ contextFactory() { return null; } });
  const failed = new SoundEffects({ contextFactory() { throw new Error("unavailable"); } });
  assert.equal(unsupported.play("correct"), false);
  assert.equal(failed.play("wrong"), false);
});

test("중단된 컨텍스트는 사용자 재생 안에서 한 번 재개한 뒤 효과음을 만든다", async function () {
  const context = new FakeAudioContext({ state: "suspended" });
  const sound = new SoundEffects({ contextFactory() { return context; } });

  assert.equal(sound.play("correct"), true);
  assert.equal(context.resumeCount, 1);
  assert.equal(context.filters.length, 2);
  await flushMicrotasks();
  assert.equal(context.state, "running");

  assert.equal(sound.play("tap"), true);
  assert.equal(context.resumeCount, 1);
  assert.equal(context.filters.length, 3);
});

test("컨텍스트 재개 거부는 삼키고 다음 사용자 동작에서 다시 시도한다", async function () {
  const context = new FakeAudioContext({ state: "suspended", rejectResume: true });
  const sound = new SoundEffects({ contextFactory() { return context; } });

  assert.equal(sound.play("game-complete"), true);
  await flushMicrotasks();
  assert.equal(context.resumeCount, 1);
  assert.equal(context.filters.length, 0, "무음 프라임만 만들고 실제 큐는 만들지 않는다");

  context.rejectResume = false;
  assert.equal(sound.play("tap"), true);
  await flushMicrotasks();
  assert.equal(context.resumeCount, 2);
  assert.equal(context.filters.length, 1);
});

test("다섯 효과음은 휴대폰에서도 들리면서 부드러운 출력 범위를 지킨다", function () {
  const expectedVoices = {
    tap: 1,
    correct: 2,
    wrong: 1,
    "round-complete": 3,
    "game-complete": 4,
  };

  assert.deepEqual(SOUND_EFFECT_CUES, Object.keys(expectedVoices));
  Object.entries(expectedVoices).forEach(function ([cue, voiceCount]) {
    const context = new FakeAudioContext();
    const sound = new SoundEffects({ contextFactory() { return context; } });
    assert.equal(sound.play(cue), true);
    assert.equal(context.oscillators.length, voiceCount);
    assert.equal(context.gains.length, voiceCount + 1, "마스터 게인 하나와 음별 게인을 사용한다");
    assert.equal(context.gains[0].connections[0], context.destination, "마스터 출력은 실제 목적지에 연결된다");
    context.filters.forEach(function (filter, index) {
      assert.equal(context.oscillators[index].connections[0], filter);
      assert.equal(filter.connections[0], context.gains[index + 1]);
      assert.equal(context.gains[index + 1].connections[0], context.gains[0]);
    });
    const masterPeak = context.gains[0].gain.events[0].value;
    assert.ok(masterPeak >= 0.45 && masterPeak <= 0.47);
    let cuePeak = 0;
    context.gains.slice(1).forEach(function (gain) {
      const peak = Math.max(...gain.gain.events.map(function (event) { return event.value; }));
      assert.ok(peak <= 0.28, `${cue}의 음별 피크가 과도하지 않아야 한다`);
      cuePeak = Math.max(cuePeak, peak * masterPeak);
    });
    assert.ok(cuePeak >= 0.08 && cuePeak <= 0.14, `${cue}의 실효 출력이 작거나 과도하지 않아야 한다`);
    context.oscillators.forEach(function (oscillator) {
      assert.ok(oscillator.stoppedAt - oscillator.startedAt < 0.35);
    });
  });
});

test("음성 합성 중에도 효과음은 작게 들리고 종료 뒤 원래 출력으로 돌아온다", function () {
  const context = new FakeAudioContext();
  const sound = new SoundEffects({ contextFactory() { return context; } });
  sound.play("tap");
  const master = context.gains[0].gain;

  assert.equal(sound.setSpeechActive(true), true);
  assert.equal(sound.play("correct"), true);
  assert.equal(context.filters.length, 3);
  assert.ok(master.events.some(function (event) {
    return event.kind === "linear" && event.value > 0.19 && event.value < 0.2;
  }));

  assert.equal(sound.setSpeechActive(false), false);
  assert.equal(sound.play("correct"), true);
  assert.equal(context.filters.length, 5);
  assert.ok(master.events.some(function (event) {
    return event.kind === "linear" && event.value === 0.46;
  }));
});

test("첫 사용자 동작은 무음 펄스로 모바일 오디오를 깨우고 실제 큐를 이어 재생한다", async function () {
  const context = new FakeAudioContext({ state: "suspended" });
  const sound = new SoundEffects({ contextFactory() { return context; } });

  assert.equal(sound.unlock(), true);
  assert.equal(context.resumeCount, 1);
  assert.equal(context.oscillators.length, 1, "한 번만 무음 펄스를 만든다");
  assert.equal(Math.max(...context.gains[1].gain.events.map(function (event) { return event.value; })), 0);
  await flushMicrotasks();

  assert.equal(sound.unlock(), true);
  assert.equal(context.oscillators.length, 1, "이미 깨어난 컨텍스트는 다시 프라임하지 않는다");
  assert.equal(sound.play("correct"), true);
  assert.equal(context.oscillators.length, 3);
});

test("재개 뒤에도 interrupted인 컨텍스트는 큐를 만들지 않고 다음 동작에서 재시도한다", async function () {
  const context = new FakeAudioContext({ state: "interrupted", resumeState: "interrupted" });
  const sound = new SoundEffects({ contextFactory() { return context; } });

  assert.equal(sound.play("correct"), true);
  await flushMicrotasks();
  assert.equal(context.filters.length, 0);

  context.resumeState = "running";
  assert.equal(sound.unlock(), true);
  await flushMicrotasks();
  assert.equal(context.state, "running");
  assert.equal(sound.play("correct"), true);
  assert.equal(context.filters.length, 2, "재개 뒤 정답음 두 개를 만든다");
});

test("효과음 설정을 끄면 새 음을 막고 다시 켜면 같은 컨텍스트를 사용한다", function () {
  const context = new FakeAudioContext();
  const sound = new SoundEffects({ contextFactory() { return context; } });
  sound.play("tap");
  sound.setEnabled(false);
  assert.equal(sound.play("wrong"), false);
  assert.equal(context.oscillators.length, 1);
  sound.setEnabled(true);
  assert.equal(sound.play("wrong"), true);
  assert.equal(context.oscillators.length, 2);
});

test("동작 줄이기에서는 완료 효과의 길이와 음 수를 줄인다", function () {
  const roundContext = new FakeAudioContext();
  const round = new SoundEffects({
    contextFactory() { return roundContext; },
    reducedMotion: true,
  });
  round.play("round-complete");
  assert.equal(roundContext.oscillators.length, 1);

  const gameContext = new FakeAudioContext();
  const game = new SoundEffects({
    contextFactory() { return gameContext; },
    reducedMotion: true,
  });
  game.play("game-complete");
  assert.equal(gameContext.oscillators.length, 2);
  assert.ok(gameContext.oscillators.every(function (oscillator) {
    return oscillator.stoppedAt - oscillator.startedAt < 0.23;
  }));
});

test("백그라운드 전환은 컨텍스트를 닫지 않고 안전하게 중단한다", async function () {
  const context = new FakeAudioContext();
  const sound = new SoundEffects({ contextFactory() { return context; } });
  assert.equal(await sound.suspend(), false, "아직 생성되지 않은 컨텍스트에는 할 일이 없다");
  sound.play("tap");
  assert.equal(await sound.suspend(), true);
  assert.equal(context.suspendCount, 1);
  assert.equal(context.state, "suspended");
  assert.equal(sound.play("tap"), true);
  await flushMicrotasks();
  assert.equal(context.resumeCount, 1);
  assert.equal(context.filters.length, 2);
});

test("브라우저 미디어 경로는 실제 PCM WAV를 한 번 재생하고 Web Audio와 겹치지 않는다", async function () {
  const context = new FakeAudioContext();
  const players = [];
  const sound = new SoundEffects({
    contextFactory() { return context; },
    audioFactory() {
      const player = new FakeMediaPlayer();
      players.push(player);
      return player;
    },
  });

  assert.equal(sound.play("correct"), true);
  await flushMicrotasks();
  assert.equal(players.length, 1);
  assert.equal(players[0].playCount, 1);
  assert.equal(context.filters.length, 0, "미디어가 재생되면 Web Audio 큐를 중복 생성하지 않는다");
  assert.match(players[0].src, /^data:audio\/wav;base64,/);

  const wav = Buffer.from(players[0].src.split(",")[1], "base64");
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(20), 1, "PCM 포맷");
  assert.equal(wav.readUInt16LE(22), 1, "모노");
  assert.equal(wav.readUInt32LE(24), 22050);
  assert.equal(wav.readUInt16LE(34), 16, "16비트");
  let peak = 0;
  let energy = 0;
  let samples = 0;
  for (let offset = 44; offset + 1 < wav.length; offset += 2) {
    const sample = wav.readInt16LE(offset) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
    samples += 1;
  }
  const rms = Math.sqrt(energy / samples);
  assert.ok(peak >= 0.1 && peak <= 0.3, `PCM 피크 ${peak}는 휴대폰 가청 범위여야 한다`);
  assert.ok(rms >= 0.02, `PCM RMS ${rms}는 실제 비무음 신호여야 한다`);
});

test("미디어 재생이 거부되면 준비된 Web Audio로 정확히 한 번 대체한다", async function () {
  const context = new FakeAudioContext();
  const player = new FakeMediaPlayer({ rejectPlay: true });
  const sound = new SoundEffects({
    contextFactory() { return context; },
    audioFactory() { return player; },
  });

  assert.equal(sound.play("correct"), true);
  await flushMicrotasks();
  assert.equal(player.playCount, 1);
  assert.equal(context.filters.length, 2);
});

test("다섯 미디어 큐의 실제 PCM 피크와 RMS가 휴대폰 가청 범위에 있다", async function () {
  const players = new Map();
  const sound = new SoundEffects({
    contextFactory() { return null; },
    audioFactory(cue) {
      const player = new FakeMediaPlayer();
      players.set(cue, player);
      return player;
    },
  });

  for (const cue of SOUND_EFFECT_CUES) {
    assert.equal(sound.play(cue), true);
    await flushMicrotasks();
    const wav = Buffer.from(players.get(cue).src.split(",")[1], "base64");
    let peak = 0;
    let energy = 0;
    let samples = 0;
    for (let offset = 44; offset + 1 < wav.length; offset += 2) {
      const sample = wav.readInt16LE(offset) / 32768;
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
      samples += 1;
    }
    const rms = Math.sqrt(energy / samples);
    assert.ok(peak >= 0.09 && peak <= 0.2, `${cue} PCM 피크 ${peak}`);
    assert.ok(rms >= 0.02 && rms <= 0.07, `${cue} PCM RMS ${rms}`);
  }
});

test("같은 미디어 큐를 다시 누르면 처음부터 재생하고 끄면 즉시 멈춘다", async function () {
  const context = new FakeAudioContext();
  const player = new FakeMediaPlayer();
  const sound = new SoundEffects({
    contextFactory() { return context; },
    audioFactory() { return player; },
  });

  sound.play("tap");
  player.currentTime = 0.05;
  sound.play("tap");
  await flushMicrotasks();
  assert.equal(player.playCount, 2);
  assert.equal(player.currentTime, 0);
  sound.setEnabled(false);
  assert.ok(player.pauseCount >= 3);
  assert.equal(player.volume, 0);
});
