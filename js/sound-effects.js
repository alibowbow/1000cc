export const SOUND_EFFECT_CUES = Object.freeze([
  "tap",
  "correct",
  "wrong",
  "round-complete",
  "game-complete",
]);

const MASTER_GAIN = 0.045;
const SPEECH_DUCK_RATIO = 0.08;
const SILENCE = 0.0001;

const RECIPES = Object.freeze({
  tap: [
    note({ type: "triangle", frequency: 310, endFrequency: 285, duration: 0.06, peak: 0.11, filter: 900 }),
  ],
  correct: [
    note({ frequency: 523.25, endFrequency: 532, duration: 0.16, peak: 0.16, filter: 1900 }),
    note({ frequency: 659.25, endFrequency: 667, offset: 0.045, duration: 0.17, peak: 0.12, filter: 2100 }),
  ],
  wrong: [
    note({ type: "triangle", frequency: 210, endFrequency: 168, duration: 0.15, peak: 0.12, filter: 540 }),
  ],
  "round-complete": [
    note({ frequency: 392, endFrequency: 396, duration: 0.21, peak: 0.11, filter: 1800 }),
    note({ frequency: 523.25, endFrequency: 528, offset: 0.055, duration: 0.22, peak: 0.11, filter: 2000 }),
    note({ frequency: 659.25, endFrequency: 665, offset: 0.11, duration: 0.23, peak: 0.1, filter: 2200 }),
  ],
  "game-complete": [
    note({ frequency: 392, endFrequency: 396, duration: 0.24, peak: 0.1, filter: 1800 }),
    note({ frequency: 523.25, endFrequency: 528, offset: 0.07, duration: 0.25, peak: 0.11, filter: 2000 }),
    note({ frequency: 659.25, endFrequency: 665, offset: 0.14, duration: 0.26, peak: 0.11, filter: 2200 }),
    note({ frequency: 783.99, endFrequency: 790, offset: 0.24, duration: 0.29, peak: 0.1, filter: 2400 }),
  ],
});

const REDUCED_MOTION_RECIPES = Object.freeze({
  "round-complete": [
    note({ frequency: 523.25, endFrequency: 528, duration: 0.16, peak: 0.12, filter: 1900 }),
  ],
  "game-complete": [
    note({ frequency: 523.25, endFrequency: 528, duration: 0.17, peak: 0.12, filter: 1900 }),
    note({ frequency: 659.25, endFrequency: 665, offset: 0.055, duration: 0.18, peak: 0.1, filter: 2100 }),
  ],
});

/**
 * Small, asset-free game sounds. The AudioContext is deliberately created only
 * from play(), so callers can keep construction at module scope without
 * triggering browser autoplay restrictions.
 */
export class SoundEffects {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.contextFactory = typeof options.contextFactory === "function"
      ? options.contextFactory
      : createBrowserAudioContext;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.context = null;
    this.masterGain = null;
    this.speechActive = false;
    this.resumePromise = null;
    this.generation = 0;
    this.activeVoices = new Set();
  }

  setEnabled(enabled) {
    const next = Boolean(enabled);
    if (this.enabled === next) return this.enabled;
    this.enabled = next;
    this.generation += 1;
    this.updateMasterGain(next ? 0.06 : 0.02);
    return this.enabled;
  }

  setSpeechActive(active) {
    const next = Boolean(active);
    if (this.speechActive === next) return this.speechActive;
    this.speechActive = next;
    this.generation += 1;
    this.updateMasterGain(next ? 0.025 : 0.06);
    return this.speechActive;
  }

  play(cue) {
    if (!this.enabled || this.speechActive || !SOUND_EFFECT_CUES.includes(cue)) return false;
    const context = this.ensureContext();
    if (!context || context.state === "closed") return false;
    const generation = this.generation;

    if (context.state === "running" || typeof context.resume !== "function") {
      return this.renderCue(cue, context, generation);
    }

    if (!this.resumePromise) {
      try {
        // Calling resume synchronously from play() keeps the first cue inside
        // the browser's user-activation window. Rejections are intentionally
        // consumed: sound support must never block the learning game.
        this.resumePromise = Promise.resolve(context.resume())
          .catch(function () { return false; })
          .finally(() => {
            this.resumePromise = null;
          });
      } catch (error) {
        this.resumePromise = null;
        return false;
      }
    }

    this.resumePromise.then((resumed) => {
      if (resumed === false || context.state === "closed") return;
      this.renderCue(cue, context, generation);
    }).catch(function () {
      // A defensive final catch for non-standard AudioContext implementations.
    });
    return true;
  }

  async suspend() {
    this.generation += 1;
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
      return null;
    }
  }

  renderCue(cue, context, generation) {
    if (
      generation !== this.generation ||
      !this.enabled ||
      this.speechActive ||
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
