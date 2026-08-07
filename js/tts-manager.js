import { rankKoreanVoices, selectPreferredVoice } from "./voice-utils.js";

export const COUPLET_READING_PAUSE_MS = 1200;
export const COUPLET_MEANING_PAUSE_MS = 800;

export function createCoupletSpeechItems(couplet = {}) {
  const reading = String(couplet.reading || "").trim().replace(/\s+/g, ", ");
  const meaning = String(couplet.meaning || "").trim();
  return [
    { text: reading, pauseAfterMs: COUPLET_READING_PAUSE_MS },
    { text: meaning, pauseAfterMs: COUPLET_MEANING_PAUSE_MS },
  ].filter(function (item) {
    return Boolean(item.text);
  });
}

function normalizeSpeechItem(item) {
  const source = item && typeof item === "object" ? item : { text: item };
  const pauseAfterMs = Number(source.pauseAfterMs);
  return {
    text: String(source.text || "").trim(),
    pauseAfterMs: Number.isFinite(pauseAfterMs) ? Math.max(0, pauseAfterMs) : 0,
  };
}

export class TTSManager {
  constructor(options = {}) {
    this.synthesis = options.synthesis || globalThis.speechSynthesis || null;
    this.Utterance = options.Utterance || globalThis.SpeechSynthesisUtterance || null;
    this.voices = [];
    this.voiceURI = "";
    this.rate = 0.85;
    this.sessionToken = 0;
    this.activeUtterances = new Set();
    this.pendingSpeakTimer = null;
    this.cancelDelay = Number.isFinite(options.cancelDelay) ? options.cancelDelay : 40;
    this.schedule = options.schedule || globalThis.setTimeout.bind(globalThis);
    this.clearSchedule = options.clearSchedule || globalThis.clearTimeout.bind(globalThis);
    this.onStateChange = null;
    this.onVoicesChange = null;
    this.onVoiceFallback = null;
    this.boundVoicesChanged = this.refreshVoices.bind(this);
  }

  get supported() {
    return Boolean(this.synthesis && this.Utterance);
  }

  start() {
    if (!this.supported) return [];
    this.refreshVoices();
    if (typeof this.synthesis.addEventListener === "function") {
      this.synthesis.addEventListener("voiceschanged", this.boundVoicesChanged);
    }
    return this.voices;
  }

  dispose() {
    this.cancel();
    if (this.synthesis && typeof this.synthesis.removeEventListener === "function") {
      this.synthesis.removeEventListener("voiceschanged", this.boundVoicesChanged);
    }
  }

  configure(options = {}) {
    if (typeof options.voiceURI === "string") this.voiceURI = options.voiceURI;
    if ([0.7, 0.85, 1, 1.15].includes(Number(options.rate))) {
      this.rate = Number(options.rate);
    }
    const selected = selectPreferredVoice(this.voices, this.voiceURI);
    this.voiceURI = selected ? selected.voiceURI : "";
    return selected;
  }

  refreshVoices(options = {}) {
    if (!this.supported) return [];
    const notify = options.notify !== false;
    let available = [];
    try {
      available = Array.from(this.synthesis.getVoices() || []);
    } catch (error) {
      available = [];
    }
    this.voices = rankKoreanVoices(available);
    this.configure({ voiceURI: this.voiceURI, rate: this.rate });
    if (notify && typeof this.onVoicesChange === "function") this.onVoicesChange(this.voices);
    return this.voices;
  }

  cancel() {
    this.sessionToken += 1;
    this.clearPendingSpeech();
    this.activeUtterances.clear();
    if (this.synthesis && typeof this.synthesis.cancel === "function") {
      this.synthesis.cancel();
    }
    this.resumeEngine();
    this.emitState(false);
  }

  speak(text, options = {}) {
    if (!this.supported || !String(text).trim()) return false;
    const token = ++this.sessionToken;
    this.clearPendingSpeech();
    this.refreshVoices({ notify: false });
    const shouldDefer = this.resetBusyEngine();
    this.resumeEngine();
    this.emitState(true, options.kind || "single");
    this.queueSpeech(String(text), token, {
      kind: options.kind || "single",
      onEnd: options.onEnd,
      onError: options.onError,
      retryCount: 0,
    }, shouldDefer ? this.cancelDelay : 0);
    return true;
  }

  speakSequence(items, options = {}) {
    const queue = (Array.isArray(items) ? items : [])
      .map(normalizeSpeechItem)
      .filter(function (item) {
        return Boolean(item.text);
      });
    if (!this.supported || queue.length === 0) return false;
    const token = ++this.sessionToken;
    let position = 0;
    this.clearPendingSpeech();
    this.refreshVoices({ notify: false });
    const shouldDefer = this.resetBusyEngine();
    this.resumeEngine();
    this.emitState(true, options.kind || "sequence");

    const speakNext = (delayMs = 0) => {
      if (token !== this.sessionToken) return;
      if (position >= queue.length) {
        this.emitState(false);
        if (typeof options.onEnd === "function") options.onEnd();
        return;
      }
      const item = queue[position];
      if (typeof options.onItem === "function") options.onItem(position, item);
      this.queueSpeech(item.text, token, {
        kind: options.kind || "sequence",
        onEnd: function () {
          position += 1;
          const nextDelayMs = position < queue.length ? item.pauseAfterMs : 0;
          speakNext(nextDelayMs);
        },
        onError: options.onError,
        keepSpeakingState: true,
        retryCount: 0,
      }, delayMs);
    };

    speakNext(shouldDefer ? this.cancelDelay : 0);
    return true;
  }

  clearPendingSpeech() {
    if (this.pendingSpeakTimer !== null) {
      this.clearSchedule(this.pendingSpeakTimer);
      this.pendingSpeakTimer = null;
    }
  }

  resetBusyEngine() {
    const busy = Boolean(this.synthesis.speaking || this.synthesis.pending);
    if (busy && typeof this.synthesis.cancel === "function") {
      this.synthesis.cancel();
    }
    return busy;
  }

  resumeEngine() {
    if (this.synthesis && this.synthesis.paused && typeof this.synthesis.resume === "function") {
      this.synthesis.resume();
    }
  }

  queueSpeech(text, token, options, delayMs = 0) {
    let fired = false;
    const run = () => {
      fired = true;
      this.pendingSpeakTimer = null;
      if (token === this.sessionToken) this.speakWithToken(text, token, options);
    };
    const normalizedDelay = Math.max(0, Number(delayMs) || 0);
    if (normalizedDelay === 0) {
      run();
      return;
    }
    const timer = this.schedule(run, normalizedDelay);
    if (!fired) this.pendingSpeakTimer = timer;
  }

  speakWithToken(text, token, options) {
    const utterance = new this.Utterance(text);
    const candidates = this.voices.filter(function (candidate) {
      return candidate.voiceURI !== options.excludedVoiceURI;
    });
    const voice = options.forceDefaultVoice
      ? null
      : selectPreferredVoice(candidates, this.voiceURI);
    utterance.lang = "ko-KR";
    utterance.rate = this.rate;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;

    const handleEnd = () => {
      this.activeUtterances.delete(utterance);
      if (token !== this.sessionToken) return;
      if (!options.keepSpeakingState) this.emitState(false);
      if (typeof options.onEnd === "function") options.onEnd();
    };
    const handleError = (event) => {
      this.activeUtterances.delete(utterance);
      if (token !== this.sessionToken) return;
      const error = String(event && event.error || "synthesis-failed");
      if (error === "canceled" || error === "interrupted") return;

      if ((options.retryCount || 0) < 1) {
        this.refreshVoices({ notify: false });
        const alternatives = this.voices.filter(function (candidate) {
          return candidate.voiceURI !== (voice && voice.voiceURI);
        });
        const fallback = alternatives.find(function (candidate) {
          return candidate.localService;
        }) || alternatives[0] || null;
        if (voice || fallback) {
          this.voiceURI = fallback ? fallback.voiceURI : "";
          if (typeof this.onVoiceFallback === "function") this.onVoiceFallback(fallback);
          this.resumeEngine();
          this.queueSpeech(text, token, {
            ...options,
            retryCount: 1,
            excludedVoiceURI: voice ? voice.voiceURI : "",
            forceDefaultVoice: !fallback,
          }, this.cancelDelay);
          return;
        }
      }

      this.emitState(false);
      if (typeof options.onError === "function") options.onError(event || { error });
    };

    if (typeof utterance.addEventListener === "function") {
      utterance.addEventListener("end", handleEnd);
      utterance.addEventListener("error", handleError);
    } else {
      utterance.onend = handleEnd;
      utterance.onerror = handleError;
    }
    this.activeUtterances.add(utterance);
    try {
      this.synthesis.speak(utterance);
    } catch (error) {
      handleError({ error: "synthesis-failed", cause: error });
    }
  }

  emitState(speaking, kind = "") {
    if (typeof this.onStateChange === "function") {
      this.onStateChange({ speaking: Boolean(speaking), kind });
    }
  }
}
