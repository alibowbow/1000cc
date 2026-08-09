export const SOUND_EFFECT_CUES = Object.freeze([
  "tap",
  "correct",
  "wrong",
  "round-complete",
  "game-complete",
]);

// Softness comes from the short envelope and rounded timbre, not from making
// the signal nearly silent. The previous recipe peaked around -31 dBFS and
// disappeared on small phone speakers. These cues land around -20 to -17 dBFS
// in the phone-friendly mid range while still leaving generous headroom.
const MASTER_GAIN = 0.46;
const SPEECH_DUCK_RATIO = 0.42;
const SILENCE = 0.0001;

const RECIPES = Object.freeze({
  tap: [
    note({ type: "triangle", frequency: 760, endFrequency: 650, duration: 0.09, peak: 0.24, filter: 2600 }),
  ],
  correct: [
    note({ frequency: 660, endFrequency: 670, duration: 0.2, peak: 0.27, filter: 2700 }),
    note({ type: "triangle", frequency: 880, endFrequency: 890, offset: 0.055, duration: 0.22, peak: 0.22, filter: 3200 }),
  ],
  wrong: [
    note({ type: "triangle", frequency: 620, endFrequency: 440, duration: 0.22, peak: 0.28, filter: 2200 }),
  ],
  "round-complete": [
    note({ frequency: 660, endFrequency: 668, duration: 0.23, peak: 0.22, filter: 2700 }),
    note({ frequency: 825, endFrequency: 835, offset: 0.06, duration: 0.25, peak: 0.21, filter: 3000 }),
    note({ type: "triangle", frequency: 990, endFrequency: 1002, offset: 0.12, duration: 0.27, peak: 0.19, filter: 3400 }),
  ],
  "game-complete": [
    note({ frequency: 660, endFrequency: 668, duration: 0.24, peak: 0.2, filter: 2700 }),
    note({ frequency: 825, endFrequency: 835, offset: 0.07, duration: 0.26, peak: 0.21, filter: 3000 }),
    note({ type: "triangle", frequency: 990, endFrequency: 1002, offset: 0.14, duration: 0.28, peak: 0.2, filter: 3400 }),
    note({ type: "triangle", frequency: 1175, endFrequency: 1188, offset: 0.24, duration: 0.3, peak: 0.18, filter: 3800 }),
  ],
});

const REDUCED_MOTION_RECIPES = Object.freeze({
  "round-complete": [
    note({ frequency: 740, endFrequency: 748, duration: 0.18, peak: 0.24, filter: 2800 }),
  ],
  "game-complete": [
    note({ frequency: 740, endFrequency: 748, duration: 0.19, peak: 0.23, filter: 2800 }),
    note({ type: "triangle", frequency: 920, endFrequency: 930, offset: 0.06, duration: 0.2, peak: 0.2, filter: 3200 }),
  ],
});

/**
 * Small, asset-free game sounds. A generated PCM WAV uses the phone's ordinary
 * media pipeline first; Web Audio stays ready as a fallback for browsers that
 * reject the media element. Both paths are created only from a user gesture.
 */
export class SoundEffects {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.contextFactory = typeof options.contextFactory === "function"
      ? options.contextFactory
      : createBrowserAudioContext;
    this.audioFactory = typeof options.audioFactory === "function"
      ? options.audioFactory
      : createBrowserAudioElement;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.context = null;
    this.masterGain = null;
    this.primed = false;
    this.speechActive = false;
    this.resumePromise = null;
    this.pendingCue = null;
    this.mediaPlayers = new Map();
    this.generation = 0;
    this.activeVoices = new Set();
  }

  setEnabled(enabled) {
    const next = Boolean(enabled);
    if (this.enabled === next) return this.enabled;
    this.enabled = next;
    this.generation += 1;
    if (!next) {
      this.pendingCue = null;
      this.stopMediaPlayers();
    }
    this.updateMasterGain(next ? 0.06 : 0.02);
    this.updateMediaVolume();
    return this.enabled;
  }

  setSpeechActive(active) {
    const next = Boolean(active);
    if (this.speechActive === next) return this.speechActive;
    this.speechActive = next;
    this.updateMasterGain(next ? 0.025 : 0.06);
    this.updateMediaVolume();
    return this.speechActive;
  }

  play(cue) {
    if (!this.enabled || !SOUND_EFFECT_CUES.includes(cue)) return false;
    // Prepare Web Audio synchronously in the same user gesture so a rejected
    // media play can fall back without losing the activation window.
    this.unlock();
    if (this.playMediaCue(cue)) return true;
    return this.playWebAudioCue(cue);
  }

  playWebAudioCue(cue) {
    const context = this.ensureContext();
    if (!context || context.state === "closed") return false;
    const generation = this.generation;

    if (context.state === "running" || typeof context.resume !== "function") {
      return this.renderCue(cue, context, generation);
    }

    // Keep this cue until the current resume attempt really reaches running.
    // If it remains blocked, the media path handles this click instead.
    this.pendingCue = { cue, generation };
    this.primed = false;
    this.primeContext(context);
    this.resumeContext(context).then((running) => {
      if (running) this.flushPendingCue(context);
    });
    return true;
  }

  async test(cue = "correct") {
    if (!this.enabled || !SOUND_EFFECT_CUES.includes(cue)) return false;
    this.unlock();
    const player = this.ensureMediaPlayer(cue);
    if (player) {
      try {
        resetMediaPlayer(player, this.targetMediaVolume());
        const started = player.play();
        if (started && typeof started.then === "function") await started;
        return true;
      } catch (error) {
        // Fall through to the already-unlocked Web Audio path.
      }
    }
    const context = this.ensureContext();
    if (!context || context.state === "closed") return false;
    this.pendingCue = null;
    if (context.state !== "running" && typeof context.resume === "function") {
      this.primed = false;
      this.primeContext(context);
      const running = await this.resumeContext(context);
      if (!running) return false;
    }
    return this.renderCue(cue, context, this.generation);
  }

  playMediaCue(cue) {
    const player = this.ensureMediaPlayer(cue);
    if (!player) return false;
    try {
      resetMediaPlayer(player, this.targetMediaVolume());
      const started = player.play();
      if (started && typeof started.catch === "function") {
        started.catch(() => {
          if (this.enabled) this.playWebAudioCue(cue);
        });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  ensureMediaPlayer(cue) {
    if (this.mediaPlayers.has(cue)) return this.mediaPlayers.get(cue);
    const recipe = this.reducedMotion && REDUCED_MOTION_RECIPES[cue]
      ? REDUCED_MOTION_RECIPES[cue]
      : RECIPES[cue];
    if (!recipe) return null;
    try {
      const player = this.audioFactory(cue);
      if (!player || typeof player.play !== "function") return null;
      player.preload = "auto";
      player.src = createCueWaveDataUri(recipe);
      player.volume = this.targetMediaVolume();
      this.mediaPlayers.set(cue, player);
      return player;
    } catch (error) {
      return null;
    }
  }

  targetMediaVolume() {
    if (!this.enabled) return 0;
    return this.speechActive ? 0.55 : 1;
  }

  updateMediaVolume() {
    const volume = this.targetMediaVolume();
    this.mediaPlayers.forEach(function (player) {
      try {
        player.volume = volume;
      } catch (error) {
        // A read-only test double or released media element needs no update.
      }
    });
  }

  stopMediaPlayers() {
    this.mediaPlayers.forEach(function (player) {
      try {
        if (typeof player.pause === "function") player.pause();
        player.currentTime = 0;
      } catch (error) {
        // A player that has not loaded yet is already silent.
      }
    });
  }

  /**
   * Prime Web Audio from pointerdown/keydown, before the later click handler.
   * Some mobile browsers only unlock a newly-created context while the user
   * activation is still synchronous. The silent pulse is created once and is
   * never routed at an audible gain.
   */
  unlock() {
    if (!this.enabled) return false;
    const context = this.ensureContext();
    if (!context || context.state === "closed") return false;
    if (context.state === "running") {
      this.primed = true;
      this.flushPendingCue(context);
      return true;
    }
    this.primed = false;
    this.primeContext(context);
    this.resumeContext(context).then((running) => {
      if (running) this.flushPendingCue(context);
    });
    return true;
  }

  resumeContext(context) {
    if (context.state === "running") return Promise.resolve(true);
    if (typeof context.resume !== "function") {
      return Promise.resolve(typeof context.state !== "string");
    }
    if (this.resumePromise) return this.resumePromise;
    try {
      // resume() must be invoked synchronously while user activation is live.
      this.resumePromise = Promise.resolve(context.resume())
        .then(() => context.state === "running")
        .catch(function () { return false; })
        .then((running) => {
          this.primed = running;
          if (!running) this.pendingCue = null;
          return running;
        })
        .finally(() => {
          this.resumePromise = null;
        });
    } catch (error) {
      this.resumePromise = null;
      this.primed = false;
      return Promise.resolve(false);
    }
    return this.resumePromise;
  }

  flushPendingCue(context) {
    const pending = this.pendingCue;
    if (!pending || context !== this.context || context.state !== "running") return false;
    this.pendingCue = null;
    return this.renderCue(pending.cue, context, pending.generation);
  }

  async suspend() {
    this.generation += 1;
    this.stopMediaPlayers();
    const context = this.context;
    if (!context || context.state === "closed" || typeof context.suspend !== "function") {
      return false;
    }
    if (context.state === "suspended") return true;
    try {
      await context.suspend();
      return true;
    } catch (error) {
      return false;
    }
  }

  ensureContext() {
    if (this.context && this.context.state !== "closed") return this.context;
    this.context = null;
    this.masterGain = null;
    this.primed = false;
    try {
      const context = this.contextFactory();
      if (!context || typeof context.createGain !== "function" || !context.destination) return null;
      const masterGain = context.createGain();
      setValue(masterGain.gain, this.targetMasterGain(), currentTime(context));
      masterGain.connect(context.destination);
      this.context = context;
      this.masterGain = masterGain;
      return context;
    } catch (error) {
      this.context = null;
      this.masterGain = null;
      this.primed = false;
      return null;
    }
  }

  primeContext(context) {
    if (this.primed || context !== this.context || !this.masterGain) return false;
    try {
      const oscillator = context.createOscillator();
      const silentGain = context.createGain();
      const now = currentTime(context);
      setValue(silentGain.gain, 0, now);
      oscillator.connect(silentGain);
      silentGain.connect(this.masterGain);
      oscillator.start(now);
      oscillator.stop(now + 0.012);
      const cleanUp = () => {
        disconnect(oscillator);
        disconnect(silentGain);
      };
      if (typeof oscillator.addEventListener === "function") {
        oscillator.addEventListener("ended", cleanUp, { once: true });
      } else {
        oscillator.onended = cleanUp;
      }
      if (context.state === "running") this.primed = true;
      return true;
    } catch (error) {
      // A failed silent pulse must not prevent the actual cue from trying.
      return false;
    }
  }

  renderCue(cue, context, generation) {
    if (
      generation !== this.generation ||
      !this.enabled ||
      context !== this.context ||
      !this.masterGain
    ) {
      return false;
    }
    const recipe = this.reducedMotion && REDUCED_MOTION_RECIPES[cue]
      ? REDUCED_MOTION_RECIPES[cue]
      : RECIPES[cue];
    if (!recipe) return false;

    try {
      const startedAt = currentTime(context) + 0.006;
      recipe.forEach((entry) => this.renderNote(context, entry, startedAt));
      return true;
    } catch (error) {
      return false;
    }
  }

  renderNote(context, entry, startedAt) {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    const filter = typeof context.createBiquadFilter === "function"
      ? context.createBiquadFilter()
      : null;
    const start = startedAt + entry.offset;
    const attackEnd = start + Math.min(0.015, entry.duration * 0.24);
    const end = start + entry.duration;

    oscillator.type = entry.type;
    setValue(oscillator.frequency, entry.frequency, start);
    exponentialRamp(oscillator.frequency, entry.endFrequency, end);
    setValue(voiceGain.gain, SILENCE, start);
    exponentialRamp(voiceGain.gain, entry.peak, attackEnd);
    exponentialRamp(voiceGain.gain, SILENCE, end);

    if (filter) {
      filter.type = "lowpass";
      setValue(filter.frequency, entry.filter, start);
      if (filter.Q) setValue(filter.Q, 0.45, start);
      oscillator.connect(filter);
      filter.connect(voiceGain);
    } else {
      oscillator.connect(voiceGain);
    }
    voiceGain.connect(this.masterGain);

    const voice = { oscillator, voiceGain, filter };
    this.activeVoices.add(voice);
    const cleanUp = () => {
      this.activeVoices.delete(voice);
      disconnect(oscillator);
      disconnect(filter);
      disconnect(voiceGain);
    };
    if (typeof oscillator.addEventListener === "function") {
      oscillator.addEventListener("ended", cleanUp, { once: true });
    } else {
      oscillator.onended = cleanUp;
    }
    oscillator.start(start);
    oscillator.stop(end + 0.025);
  }

  updateMasterGain(duration) {
    if (!this.context || !this.masterGain) return;
    const now = currentTime(this.context);
    const parameter = this.masterGain.gain;
    const target = this.targetMasterGain();
    try {
      if (typeof parameter.cancelScheduledValues === "function") {
        parameter.cancelScheduledValues(now);
      }
      setValue(parameter, finiteValue(parameter.value, target), now);
      linearRamp(parameter, target, now + duration);
    } catch (error) {
      parameter.value = target;
    }
  }

  targetMasterGain() {
    if (!this.enabled) return 0;
    return this.speechActive ? MASTER_GAIN * SPEECH_DUCK_RATIO : MASTER_GAIN;
  }
}

function note(options) {
  return Object.freeze({
    type: options.type || "sine",
    frequency: options.frequency,
    endFrequency: options.endFrequency || options.frequency,
    offset: options.offset || 0,
    duration: options.duration,
    peak: options.peak,
    filter: options.filter,
  });
}

function createBrowserAudioContext() {
  const AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (typeof AudioContextConstructor !== "function") return null;
  try {
    return new AudioContextConstructor({ latencyHint: "interactive" });
  } catch (error) {
    try {
      return new AudioContextConstructor();
    } catch (fallbackError) {
      return null;
    }
  }
}

function createBrowserAudioElement() {
  if (typeof globalThis.Audio !== "function") return null;
  try {
    return new globalThis.Audio();
  } catch (error) {
    return null;
  }
}

function createCueWaveDataUri(recipe) {
  const sampleRate = 22050;
  const duration = Math.max(...recipe.map(function (entry) {
    return entry.offset + entry.duration;
  })) + 0.025;
  const sampleCount = Math.max(1, Math.ceil(duration * sampleRate));
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const mixed = recipe.reduce(function (sum, entry) {
      const localTime = time - entry.offset;
      if (localTime < 0 || localTime >= entry.duration) return sum;
      const attack = Math.min(0.014, entry.duration * 0.24);
      const envelope = localTime < attack
        ? localTime / Math.max(attack, 0.001)
        : Math.pow(
          Math.max(0, (entry.duration - localTime) / Math.max(entry.duration - attack, 0.001)),
          1.65,
        );
      const sweep = (entry.endFrequency - entry.frequency) / entry.duration;
      const phase = 2 * Math.PI * (
        entry.frequency * localTime + 0.5 * sweep * localTime * localTime
      );
      const waveform = entry.type === "triangle"
        ? (2 / Math.PI) * Math.asin(Math.sin(phase))
        : Math.sin(phase);
      return sum + waveform * envelope * entry.peak * MASTER_GAIN;
    }, 0);
    const sample = Math.max(-0.92, Math.min(0.92, mixed));
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function bytesToBase64(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] : 0;
    const third = hasThird ? bytes[index + 2] : 0;
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 3) << 4) | (second >> 4)];
    encoded += hasSecond ? alphabet[((second & 15) << 2) | (third >> 6)] : "=";
    encoded += hasThird ? alphabet[third & 63] : "=";
  }
  return encoded;
}

function resetMediaPlayer(player, volume) {
  if (typeof player.pause === "function") player.pause();
  try {
    player.currentTime = 0;
  } catch (error) {
    // A newly assigned data URI can reject seeking until metadata is ready.
  }
  player.volume = volume;
}

function currentTime(context) {
  return Number.isFinite(Number(context && context.currentTime)) ? Number(context.currentTime) : 0;
}

function finiteValue(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function setValue(parameter, value, time) {
  if (typeof parameter.setValueAtTime === "function") parameter.setValueAtTime(value, time);
  else parameter.value = value;
}

function linearRamp(parameter, value, time) {
  if (typeof parameter.linearRampToValueAtTime === "function") {
    parameter.linearRampToValueAtTime(value, time);
  } else {
    setValue(parameter, value, time);
  }
}

function exponentialRamp(parameter, value, time) {
  if (typeof parameter.exponentialRampToValueAtTime === "function") {
    parameter.exponentialRampToValueAtTime(Math.max(SILENCE, value), time);
  } else {
    linearRamp(parameter, value, time);
  }
}

function disconnect(node) {
  if (!node || typeof node.disconnect !== "function") return;
  try {
    node.disconnect();
  } catch (error) {
    // Already-disconnected nodes need no further cleanup.
  }
}
