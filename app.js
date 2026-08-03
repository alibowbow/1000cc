import { COUPLETS, TOTAL_CHARACTERS } from "./data.js";

const STORAGE_KEY = "cheonjamun-study-v1";
const RANGE_SIZE = 100;
const RANGE_NAMES = [
  "첫째 마당",
  "둘째 마당",
  "셋째 마당",
  "넷째 마당",
  "다섯째 마당",
  "여섯째 마당",
  "일곱째 마당",
  "여덟째 마당",
  "아홉째 마당",
  "열째 마당",
];

const characters = COUPLETS.flatMap(function (couplet, coupletIndex) {
  const hanja = Array.from(couplet.hanja);
  const readings = Array.from(couplet.reading.replace(/\s/g, ""));
  return hanja.map(function (character, offset) {
    return {
      character: character,
      reading: readings[offset],
      coupletIndex: coupletIndex,
      offset: offset,
      index: coupletIndex * 8 + offset,
    };
  });
});

const defaults = {
  mode: "browse",
  rangeStart: 0,
  selectedIndex: 0,
  sequenceCursor: 0,
  learned: [],
  hideReading: false,
  hideMeaning: false,
  tapToSpeak: true,
  rate: 0.85,
  voiceURI: "",
};

const restored = loadState();
const state = {
  mode: ["browse", "sequence", "listen"].includes(restored.mode)
    ? restored.mode
    : defaults.mode,
  rangeStart: clampRange(restored.rangeStart),
  selectedIndex: clamp(Number(restored.selectedIndex) || 0, 0, TOTAL_CHARACTERS - 1),
  sequenceCursor: clamp(Number(restored.sequenceCursor) || 0, 0, TOTAL_CHARACTERS),
  learned: new Set(
    Array.isArray(restored.learned)
      ? restored.learned.filter(function (index) {
          return Number.isInteger(index) && index >= 0 && index < TOTAL_CHARACTERS;
        })
      : [],
  ),
  hideReading: Boolean(restored.hideReading),
  hideMeaning: Boolean(restored.hideMeaning),
  tapToSpeak:
    typeof restored.tapToSpeak === "boolean" ? restored.tapToSpeak : defaults.tapToSpeak,
  rate: [0.7, 0.85, 1, 1.15].includes(Number(restored.rate))
    ? Number(restored.rate)
    : defaults.rate,
  voiceURI: typeof restored.voiceURI === "string" ? restored.voiceURI : "",
  speaking: false,
  continuous: false,
};

const elements = {
  characterGrid: document.querySelector("#character-grid"),
  coupletGrid: document.querySelector("#couplet-grid"),
  coupletReading: document.querySelector("#couplet-reading"),
  coupletMeaning: document.querySelector("#couplet-meaning"),
  coupletPosition: document.querySelector("#couplet-position"),
  learnedCount: document.querySelector("#learned-count"),
  learnedProgress: document.querySelector("#learned-progress"),
  rangeLabel: document.querySelector("#range-label"),
  rangeSelect: document.querySelector("#range-select"),
  rangeNav: document.querySelector("#range-nav"),
  modeGuideText: document.querySelector("#mode-guide-text"),
  sequenceReset: document.querySelector("#sequence-reset"),
  toggleReading: document.querySelector("#toggle-reading"),
  toggleMeaning: document.querySelector("#toggle-meaning"),
  previousCouplet: document.querySelector("#previous-couplet"),
  nextCouplet: document.querySelector("#next-couplet"),
  playCouplet: document.querySelector("#play-couplet"),
  stopSpeaking: document.querySelector("#stop-speaking"),
  voiceSelect: document.querySelector("#voice-select"),
  voiceNote: document.querySelector("#voice-note"),
  rateSelect: document.querySelector("#rate-select"),
  markCouplet: document.querySelector("#mark-couplet"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  tapToSpeak: document.querySelector("#tap-to-speak"),
  settingHideReading: document.querySelector("#setting-hide-reading"),
  settingHideMeaning: document.querySelector("#setting-hide-meaning"),
  resetProgress: document.querySelector("#reset-progress"),
  toast: document.querySelector("#toast"),
};

let voices = [];
let toastTimer = 0;

initialize();

function initialize() {
  if (characters.length !== TOTAL_CHARACTERS || COUPLETS.length !== 125) {
    throw new Error("천자문 데이터가 올바르지 않습니다.");
  }

  buildRangeControls();
  bindEvents();
  syncControls();
  renderAll();
  initializeVoices();

  if (state.mode === "sequence" && state.sequenceCursor < TOTAL_CHARACTERS) {
    selectCharacter(state.sequenceCursor, { speak: false, changeRange: true });
  }
}

function loadState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? Object.assign({}, defaults, JSON.parse(saved)) : defaults;
  } catch (error) {
    return defaults;
  }
}

function saveState() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        rangeStart: state.rangeStart,
        selectedIndex: state.selectedIndex,
        sequenceCursor: state.sequenceCursor,
        learned: Array.from(state.learned).sort(function (a, b) {
          return a - b;
        }),
        hideReading: state.hideReading,
        hideMeaning: state.hideMeaning,
        tapToSpeak: state.tapToSpeak,
        rate: state.rate,
        voiceURI: state.voiceURI,
      }),
    );
  } catch (error) {
    showToast("이 브라우저에서는 학습 기록을 저장할 수 없습니다.");
  }
}

function buildRangeControls() {
  const selectFragment = document.createDocumentFragment();
  const navFragment = document.createDocumentFragment();

  RANGE_NAMES.forEach(function (name, rangeIndex) {
    const start = rangeIndex * RANGE_SIZE;
    const end = start + RANGE_SIZE;
    const label = start + 1 + "–" + end;

    const option = document.createElement("option");
    option.value = String(start);
    option.textContent = name + " · " + label;
    selectFragment.append(option);

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rangeStart = String(start);
    button.textContent = label;
    button.setAttribute("aria-label", name + " " + label + "자로 이동");
    navFragment.append(button);
  });

  elements.rangeSelect.append(selectFragment);
  elements.rangeNav.append(navFragment);
}

function bindEvents() {
  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.dataset.mode);
    });
  });

  elements.characterGrid.addEventListener("click", function (event) {
    const button = event.target.closest(".character-cell");
    if (!button) return;
    handleCharacterPress(Number(button.dataset.index), button);
  });

  elements.characterGrid.addEventListener("keydown", handleGridKeyboard);

  elements.rangeSelect.addEventListener("change", function () {
    setRange(Number(elements.rangeSelect.value), true);
  });

  elements.rangeNav.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-range-start]");
    if (!button) return;
    setRange(Number(button.dataset.rangeStart), true);
  });

  elements.toggleReading.addEventListener("click", function () {
    setHiddenState("reading", !state.hideReading);
  });

  elements.toggleMeaning.addEventListener("click", function () {
    setHiddenState("meaning", !state.hideMeaning);
  });

  elements.previousCouplet.addEventListener("click", function () {
    moveCouplet(-1);
  });

  elements.nextCouplet.addEventListener("click", function () {
    moveCouplet(1);
  });

  elements.playCouplet.addEventListener("click", function () {
    if (state.speaking) {
      stopSpeech();
      return;
    }
    state.continuous = state.mode === "listen";
    speakCurrentCouplet();
  });

  elements.stopSpeaking.addEventListener("click", stopSpeech);

  elements.voiceSelect.addEventListener("change", function () {
    state.voiceURI = elements.voiceSelect.value;
    saveState();
  });

  elements.rateSelect.addEventListener("change", function () {
    state.rate = Number(elements.rateSelect.value);
    saveState();
  });

  elements.markCouplet.addEventListener("click", toggleCurrentCoupletLearned);
  elements.sequenceReset.addEventListener("click", resetSequence);

  elements.settingsButton.addEventListener("click", function () {
    syncControls();
    elements.settingsDialog.showModal();
  });

  elements.settingsDialog.addEventListener("click", function (event) {
    if (event.target === elements.settingsDialog) {
      elements.settingsDialog.close();
    }
  });

  elements.tapToSpeak.addEventListener("change", function () {
    state.tapToSpeak = elements.tapToSpeak.checked;
    saveState();
  });

  elements.settingHideReading.addEventListener("change", function () {
    setHiddenState("reading", elements.settingHideReading.checked);
  });

  elements.settingHideMeaning.addEventListener("change", function () {
    setHiddenState("meaning", elements.settingHideMeaning.checked);
  });

  elements.resetProgress.addEventListener("click", function () {
    const confirmed = window.confirm("익힘 표시와 순서 학습 위치를 모두 초기화할까요?");
    if (!confirmed) return;
    state.learned.clear();
    state.sequenceCursor = 0;
    state.selectedIndex = 0;
    setRange(0, false);
    saveState();
    renderAll();
    showToast("학습 기록을 초기화했습니다.");
    elements.settingsDialog.close();
  });

  window.addEventListener("beforeunload", function () {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
}

function renderAll() {
  renderMode();
  renderGrid();
  renderDetail();
  renderProgress();
  renderRangeControls();
  renderVisibility();
}

function renderMode() {
  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  });

  elements.sequenceReset.hidden = state.mode !== "sequence";

  const guides = {
    browse: "글자를 누르면 한글 음을 듣고, 해당 8자 연을 살펴볼 수 있습니다.",
    sequence:
      state.sequenceCursor >= TOTAL_CHARACTERS
        ? "천 글자를 모두 순서대로 눌렀습니다. 처음부터 다시 익힐 수도 있습니다."
        : state.sequenceCursor + 1 + "번째 글자부터 차례로 눌러 보세요. 진도는 자동으로 저장됩니다.",
    listen: "재생하면 선택한 8자 연부터 다음 연으로 이어서 읽습니다. 다시 누르면 멈춥니다.",
  };
  elements.modeGuideText.textContent = guides[state.mode];
}

function renderGrid() {
  const fragment = document.createDocumentFragment();
  const end = Math.min(state.rangeStart + RANGE_SIZE, TOTAL_CHARACTERS);

  for (let index = state.rangeStart; index < end; index += 1) {
    const item = characters[index];
    const button = document.createElement("button");
    const learned = state.learned.has(index);
    const selected = state.selectedIndex === index;
    const next = state.mode === "sequence" && state.sequenceCursor === index;

    button.type = "button";
    button.className = "character-cell";
    button.dataset.index = String(index);
    button.tabIndex =
      selected || state.selectedIndex < state.rangeStart || state.selectedIndex >= end ? 0 : -1;

    if (learned) button.classList.add("is-learned");
    if (selected) button.classList.add("is-selected");
    if (next) button.classList.add("is-next");

    button.setAttribute(
      "aria-label",
      index +
        1 +
        "번째 글자, " +
        item.reading +
        ", " +
        item.character +
        (learned ? ", 익힘" : ", 아직 익히지 않음") +
        (next ? ", 다음 순서" : ""),
    );
    button.setAttribute("aria-pressed", String(selected));

    const number = document.createElement("span");
    number.className = "character-cell__number";
    number.textContent = String(index + 1);

    const hanja = document.createElement("span");
    hanja.className = "character-cell__hanja";
    hanja.lang = "zh-Hant";
    hanja.textContent = item.character;

    const reading = document.createElement("span");
    reading.className = "character-cell__reading";
    reading.textContent = item.reading;

    button.append(number, hanja, reading);
    fragment.append(button);
  }

  elements.characterGrid.replaceChildren(fragment);
  elements.characterGrid.classList.toggle("is-reading-hidden", state.hideReading);
}

function renderDetail() {
  const item = characters[state.selectedIndex];
  const couplet = COUPLETS[item.coupletIndex];
  const hanja = Array.from(couplet.hanja);
  const fragment = document.createDocumentFragment();

  hanja.forEach(function (character, offset) {
    const span = document.createElement("span");
    span.textContent = character;
    if (offset === item.offset) span.classList.add("is-active");
    fragment.append(span);
  });

  elements.coupletGrid.replaceChildren(fragment);
  elements.coupletReading.textContent = couplet.reading;
  elements.coupletMeaning.textContent = couplet.meaning;
  elements.coupletPosition.textContent = item.coupletIndex + 1 + " / " + COUPLETS.length;

  elements.previousCouplet.disabled = item.coupletIndex === 0;
  elements.nextCouplet.disabled = item.coupletIndex === COUPLETS.length - 1;

  const learned = getCoupletIndexes(item.coupletIndex).every(function (index) {
    return state.learned.has(index);
  });
  elements.markCouplet.setAttribute("aria-pressed", String(learned));
  elements.markCouplet.querySelector("span").textContent = learned
    ? "이 8자는 익힘 완료"
    : "이 8자 익힘으로 표시";
}

function renderProgress() {
  elements.learnedCount.textContent = String(state.learned.size);
  elements.learnedProgress.value = state.learned.size;
  elements.learnedProgress.textContent = state.learned.size + " / " + TOTAL_CHARACTERS;
}

function renderRangeControls() {
  const rangeIndex = Math.floor(state.rangeStart / RANGE_SIZE);
  const start = state.rangeStart + 1;
  const end = Math.min(state.rangeStart + RANGE_SIZE, TOTAL_CHARACTERS);

  elements.rangeLabel.textContent = RANGE_NAMES[rangeIndex] + " · " + start + "–" + end;
  elements.rangeSelect.value = String(state.rangeStart);
  elements.rangeNav.querySelectorAll("button").forEach(function (button) {
    button.setAttribute(
      "aria-current",
      String(Number(button.dataset.rangeStart) === state.rangeStart),
    );
  });
}

function renderVisibility() {
  elements.toggleReading.setAttribute("aria-pressed", String(state.hideReading));
  elements.toggleMeaning.setAttribute("aria-pressed", String(state.hideMeaning));
  elements.toggleReading.textContent = state.hideReading ? "음 보이기" : "음 가리기";
  elements.toggleMeaning.textContent = state.hideMeaning ? "풀이 보이기" : "풀이 가리기";

  elements.coupletReading.classList.toggle("is-veiled", state.hideReading);
  elements.coupletMeaning.classList.toggle("is-veiled", state.hideMeaning);
  elements.coupletReading.dataset.veilLabel = "독음을 가렸습니다";
  elements.coupletMeaning.dataset.veilLabel = "풀이를 가렸습니다";
}

function syncControls() {
  elements.tapToSpeak.checked = state.tapToSpeak;
  elements.settingHideReading.checked = state.hideReading;
  elements.settingHideMeaning.checked = state.hideMeaning;
  elements.rateSelect.value = String(state.rate);
}

function handleCharacterPress(index, button) {
  if (state.mode === "sequence") {
    if (state.sequenceCursor >= TOTAL_CHARACTERS) {
      showToast("천 글자를 모두 익혔습니다. ‘순서 처음부터’로 다시 시작할 수 있습니다.");
      return;
    }

    if (index !== state.sequenceCursor) {
      button.classList.remove("is-wrong");
      requestAnimationFrame(function () {
        button.classList.add("is-wrong");
      });
      window.setTimeout(function () {
        button.classList.remove("is-wrong");
      }, 260);
      showToast(state.sequenceCursor + 1 + "번째 글자부터 차례로 눌러 주세요.");
      focusSequenceCursor();
      return;
    }

    state.learned.add(index);
    state.selectedIndex = index;
    state.sequenceCursor = Math.min(TOTAL_CHARACTERS, index + 1);
    speakCharacter(index);
    saveState();

    if (state.sequenceCursor < TOTAL_CHARACTERS) {
      const nextRange = Math.floor(state.sequenceCursor / RANGE_SIZE) * RANGE_SIZE;
      if (nextRange !== state.rangeStart) state.rangeStart = nextRange;
    }

    renderAll();
    if (state.sequenceCursor >= TOTAL_CHARACTERS) {
      showToast("완료! 천 글자를 모두 순서대로 익혔습니다.");
    } else {
      focusSequenceCursor();
    }
    return;
  }

  selectCharacter(index, {
    speak: state.mode === "browse" && state.tapToSpeak,
    changeRange: false,
  });

  if (state.mode === "listen") {
    state.continuous = true;
    speakCurrentCouplet();
  }
}

function handleGridKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }

  const targetCell = event.target.closest(".character-cell");
  const current = Number(targetCell ? targetCell.dataset.index : NaN);
  if (!Number.isInteger(current)) return;

  event.preventDefault();
  const columns = getGridColumnCount();
  const min = state.rangeStart;
  const max = Math.min(state.rangeStart + RANGE_SIZE, TOTAL_CHARACTERS) - 1;
  let next = current;

  if (event.key === "ArrowLeft") next = current - 1;
  if (event.key === "ArrowRight") next = current + 1;
  if (event.key === "ArrowUp") next = current - columns;
  if (event.key === "ArrowDown") next = current + columns;
  if (event.key === "Home") next = min;
  if (event.key === "End") next = max;

  next = clamp(next, min, max);
  selectCharacter(next, { speak: false, changeRange: false });
  focusCell(next);
}

function getGridColumnCount() {
  const value = getComputedStyle(elements.characterGrid).getPropertyValue("--grid-columns");
  return Number.parseInt(value, 10) || 4;
}

function setMode(mode) {
  if (!["browse", "sequence", "listen"].includes(mode)) return;
  stopSpeech();
  state.mode = mode;

  if (mode === "sequence" && state.sequenceCursor < TOTAL_CHARACTERS) {
    state.selectedIndex = state.sequenceCursor;
    state.rangeStart = Math.floor(state.sequenceCursor / RANGE_SIZE) * RANGE_SIZE;
  }

  saveState();
  renderAll();

  if (mode === "sequence") focusSequenceCursor();
  if (mode === "listen") {
    state.continuous = true;
    speakCurrentCouplet();
  }
}

function setRange(start, selectFirst) {
  state.rangeStart = clampRange(start);
  if (selectFirst) state.selectedIndex = state.rangeStart;
  stopSpeech();
  saveState();
  renderAll();
  if (selectFirst) focusCell(state.selectedIndex);
}

function selectCharacter(index, options) {
  const settings = Object.assign({ speak: false, changeRange: false }, options);
  const nextIndex = clamp(index, 0, TOTAL_CHARACTERS - 1);
  state.selectedIndex = nextIndex;

  if (settings.changeRange) {
    state.rangeStart = Math.floor(nextIndex / RANGE_SIZE) * RANGE_SIZE;
  }

  saveState();
  renderGrid();
  renderDetail();
  renderRangeControls();
  renderVisibility();

  if (settings.speak) speakCharacter(nextIndex);
}

function moveCouplet(delta) {
  stopSpeech();
  const currentCouplet = characters[state.selectedIndex].coupletIndex;
  const nextCouplet = clamp(currentCouplet + delta, 0, COUPLETS.length - 1);
  selectCharacter(nextCouplet * 8, { speak: false, changeRange: true });
  focusCell(state.selectedIndex);
}

function toggleCurrentCoupletLearned() {
  const coupletIndex = characters[state.selectedIndex].coupletIndex;
  const indexes = getCoupletIndexes(coupletIndex);
  const allLearned = indexes.every(function (index) {
    return state.learned.has(index);
  });

  indexes.forEach(function (index) {
    if (allLearned) state.learned.delete(index);
    else state.learned.add(index);
  });

  saveState();
  renderGrid();
  renderDetail();
  renderProgress();
  showToast(allLearned ? "이 8자의 익힘 표시를 해제했습니다." : "이 8자를 익힘으로 표시했습니다.");
}

function getCoupletIndexes(coupletIndex) {
  return Array.from({ length: 8 }, function (_, offset) {
    return coupletIndex * 8 + offset;
  });
}

function resetSequence() {
  stopSpeech();
  state.sequenceCursor = 0;
  state.selectedIndex = 0;
  state.rangeStart = 0;
  saveState();
  renderAll();
  focusSequenceCursor();
  showToast("첫 글자부터 순서 익히기를 시작합니다.");
}

function focusSequenceCursor() {
  if (state.sequenceCursor >= TOTAL_CHARACTERS) return;
  window.setTimeout(function () {
    focusCell(state.sequenceCursor);
  }, 0);
}

function focusCell(index) {
  const cell = elements.characterGrid.querySelector('[data-index="' + index + '"]');
  if (cell) cell.focus({ preventScroll: true });
}

function setHiddenState(type, hidden) {
  if (type === "reading") state.hideReading = hidden;
  if (type === "meaning") state.hideMeaning = hidden;
  saveState();
  syncControls();
  renderGrid();
  renderVisibility();
}

function initializeVoices() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    elements.voiceSelect.innerHTML = '<option value="">음성 합성 미지원</option>';
    elements.voiceSelect.disabled = true;
    elements.playCouplet.disabled = true;
    elements.stopSpeaking.disabled = true;
    elements.voiceNote.textContent = "이 브라우저는 음성 합성을 지원하지 않습니다. Chrome을 권장합니다.";
    return;
  }

  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

function loadVoices() {
  const allVoices = window.speechSynthesis.getVoices();
  voices = allVoices
    .filter(function (voice) {
      return /^ko([-_]|$)/i.test(voice.lang);
    })
    .sort(function (a, b) {
      return voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name, "ko");
    });

  const current = state.voiceURI;
  elements.voiceSelect.replaceChildren();

  if (voices.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "브라우저 기본 한국어";
    elements.voiceSelect.append(option);
    elements.voiceNote.textContent =
      "한국어 전용 음성이 없어 브라우저 기본 음성으로 읽습니다. Chrome을 권장합니다.";
    state.voiceURI = "";
    return;
  }

  voices.forEach(function (voice) {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = voice.name + (voice.localService ? "" : " · 온라인");
    elements.voiceSelect.append(option);
  });

  const hasSavedVoice = voices.some(function (voice) {
    return voice.voiceURI === current;
  });
  state.voiceURI = hasSavedVoice ? current : voices[0].voiceURI;
  elements.voiceSelect.value = state.voiceURI;

  const selected = voices.find(function (voice) {
    return voice.voiceURI === state.voiceURI;
  });
  elements.voiceNote.textContent =
    selected && /google/i.test(selected.name)
      ? "Google 한국어 음성을 사용합니다."
      : "설치된 한국어 음성을 사용합니다. Chrome에서는 Google 음성이 우선됩니다.";
  saveState();
}

function voiceScore(voice) {
  let score = 0;
  if (/google/i.test(voice.name)) score += 100;
  if (/한국|korean/i.test(voice.name)) score += 25;
  if (/^ko-KR$/i.test(voice.lang)) score += 10;
  if (voice.localService) score += 2;
  return score;
}

function speakCharacter(index) {
  speak(characters[index].reading, null);
}

function speakCurrentCouplet() {
  const coupletIndex = characters[state.selectedIndex].coupletIndex;
  const couplet = COUPLETS[coupletIndex];
  speak(couplet.reading.replace(" ", ", "), function () {
    if (!state.continuous || state.mode !== "listen") return;
    if (coupletIndex >= COUPLETS.length - 1) {
      state.continuous = false;
      showToast("천자문 끝까지 모두 들었습니다.");
      return;
    }
    selectCharacter((coupletIndex + 1) * 8, { speak: false, changeRange: true });
    window.setTimeout(speakCurrentCouplet, 160);
  });
}

function speak(text, onEnd) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showToast("음성 합성을 지원하지 않는 브라우저입니다. Chrome을 사용해 주세요.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = voices.find(function (voice) {
    return voice.voiceURI === state.voiceURI;
  });

  utterance.lang = "ko-KR";
  utterance.rate = state.rate;
  utterance.pitch = 1;
  if (selectedVoice) utterance.voice = selectedVoice;

  utterance.addEventListener("start", function () {
    state.speaking = true;
    renderSpeechState();
  });

  utterance.addEventListener("end", function () {
    state.speaking = false;
    renderSpeechState();
    if (typeof onEnd === "function") onEnd();
  });

  utterance.addEventListener("error", function (event) {
    state.speaking = false;
    state.continuous = false;
    renderSpeechState();
    if (event.error !== "canceled" && event.error !== "interrupted") {
      showToast("음성을 재생하지 못했습니다. 브라우저 음성 설정을 확인해 주세요.");
    }
  });

  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  state.continuous = false;
  state.speaking = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  renderSpeechState();
}

function renderSpeechState() {
  elements.playCouplet.classList.toggle("is-speaking", state.speaking);
  elements.playCouplet.setAttribute(
    "aria-label",
    state.speaking ? "음성 재생 정지" : "현재 8자 연 듣기",
  );
  elements.stopSpeaking.disabled = !state.speaking;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(function () {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampRange(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = Math.floor(parsed / RANGE_SIZE) * RANGE_SIZE;
  return clamp(normalized, 0, TOTAL_CHARACTERS - RANGE_SIZE);
}
