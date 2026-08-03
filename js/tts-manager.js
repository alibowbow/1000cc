import { rankKoreanVoices, selectPreferredVoice } from "./voice-utils.js";

export class TTSManager {
  constructor(options = {}) {
    this.synthesis = options.synthesis || globalThis.speechSynthesis || null;
    this.Utterance = options.Utterance || globalThis.SpeechSynthesisUtterance || null;
    this.voices = [];
    this.voiceURI = "";
    this.rate = 0.85;
    this.sessionToken = 0;
    this.onStateChange = null;
    this.onVoicesChange = null;
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

  refreshVoices() {
    if (!this.supported) return [];
    this.voices = rankKoreanVoices(this.synthesis.getVoices());
    this.configure({ voiceURI: this.voiceURI, rate: this.rate });
    if (typeof this.onVoicesChange === "function") this.onVoicesChange(this.voices);
    return this.voices;
  }

  cancel() {
    this.sessionToken += 1;
    if (this.synthesis && typeof this.synthesis.cancel === "function") {
      this.synthesis.cancel();
    }
    this.emitState(false);
  }

  speak(text, options = {}) {
    if (!this.supported || !String(text).trim()) return false;
    const token = ++this.sessionToken;
    this.synthesis.cancel();
    this.emitState(true, options.kind || "single");
    this.speakWithToken(String(text), token, {
      kind: options.kind || "single",
      onEnd: options.onEnd,
      onError: options.onError,
    });
    return true;
  }

  speakSequence(items, options = {}) {
    const queue = (Array.isArray(items) ? items : []).map(String).filter(Boolean);
    if (!this.supported || queue.length === 0) return false;
    const token = ++this.sessionToken;
    let position = 0;
    this.synthesis.cancel();
    this.emitState(true, options.kind || "sequence");

    const speakNext = () => {
      if (token !== this.sessionToken) return;
      if (position >= queue.length) {
        this.emitState(false);
        if (typeof options.onEnd === "function") options.onEnd();
        return;
      }
      if (typeof options.onItem === "function") options.onItem(position);
      this.speakWithToken(queue[position], token, {
        kind: options.kind || "sequence",
        onEnd: function () {
          position += 1;
          speakNext();
        },
        onError: options.onError,
        keepSpeakingState: true,
      });
    };

    speakNext();
    return true;
  }

  speakWithToken(text, token, options) {
    const utterance = new this.Utterance(text);
    const voice = selectPreferredVoice(this.voices, this.voiceURI);
    utterance.lang = "ko-KR";
    utterance.rate = this.rate;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;

    const handleEnd = () => {
      if (token !== this.sessionToken) return;
      if (!options.keepSpeakingState) this.emitState(false);
      if (typeof options.onEnd === "function") options.onEnd();
    };
    const handleError = (event) => {
      if (token !== this.sessionToken) return;
      this.emitState(false);
      if (
        typeof options.onError === "function" &&
        event &&
        event.error !== "canceled" &&
        event.error !== "interrupted"
      ) {
        options.onError(event);
      }
    };

    if (typeof utterance.addEventListener === "function") {
      utterance.addEventListener("end", handleEnd);
      utterance.addEventListener("error", handleError);
    } else {
      utterance.onend = handleEnd;
      utterance.onerror = handleError;
    }
    this.synthesis.speak(utterance);
  }

  emitState(speaking, kind = "") {
    if (typeof this.onStateChange === "function") {
      this.onStateChange({ speaking: Boolean(speaking), kind });
    }
  }
}
