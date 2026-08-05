import {
  CHARACTERS,
  COUPLETS,
  TOTAL_CHARACTERS,
  findCharacterIndexes,
  getCharacterStudyDetails,
  getCouplet,
  getPhrase,
} from "./js/data-model.js";
import { createGridSession, getSessionProgress, selectGridIndex } from "./js/grid-engine.js?v=12";
import {
  createChallengeUrl,
  createRandomDailyPick,
  getLesson,
  getRandomDailyPick,
  isBetterScore,
  parseChallengeDay,
} from "./js/course-engine.js?v=12";
import { recordSkillAttempt } from "./js/progress-engine.js";
import {
  createOverviewCell,
  createPassageCharacter,
  renderBoardCellElement,
} from "./js/render.js";
import {
  loadStateFromStorage,
  saveStateToStorage,
} from "./js/storage.js?v=12";
import { createStore } from "./js/state.js";
import { TTSManager } from "./js/tts-manager.js?v=12";
import { formatDuration } from "./js/utils.js";

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

const loaded = loadStateFromStorage(window.localStorage);
const store = createStore(loaded.state, function (value) {
  try {
    saveStateToStorage(window.localStorage, value);
  } catch (error) {
    showToast("이 브라우저에서는 앱 데이터를 저장할 수 없습니다.");
  }
});
let appState = store.get();
let passageContinuous = false;
let speechState = { speaking: false, kind: "" };
let overviewRevealedIndexes = new Set();
let toastTimer = 0;
let completionTimer = 0;
let renderedSessionKey = "";
let memoryClueRevealed = new Set();
let renderedMemoryDay = -1;
let sharedChallengeDay = parseChallengeDay(window.location.search);
let sharedChallengeSession = null;
let sharedChallengeStartedAt = 0;
let sharedChallengeWrong = 0;

const elements = {
  brandHome: document.querySelector("#brand-home"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  screens: Array.from(document.querySelectorAll("[data-screen]")),
  sharedChallenge: document.querySelector("#shared-challenge"),
  sharedChallengeDay: document.querySelector("#shared-challenge-day"),
  sharedChallengeMeaning: document.querySelector("#shared-challenge-meaning"),
  sharedChallengePhrase: document.querySelector("#shared-challenge-phrase"),
  startSharedChallenge: document.querySelector("#start-shared-challenge"),
  sharedChallengePlay: document.querySelector("#shared-challenge-play"),
  sharedChallengeTarget: document.querySelector("#shared-challenge-target"),
  sharedChallengeProgress: document.querySelector("#shared-challenge-progress"),
  sharedChallengeWrong: document.querySelector("#shared-challenge-wrong"),
  sharedChallengeBoard: document.querySelector("#shared-challenge-board"),
  sharedChallengeResult: document.querySelector("#shared-challenge-result"),
  sharedChallengeTime: document.querySelector("#shared-challenge-time"),
  sharedChallengeAccuracy: document.querySelector("#shared-challenge-accuracy"),
  retrySharedChallenge: document.querySelector("#retry-shared-challenge"),
  shareSharedChallenge: document.querySelector("#share-shared-challenge"),
  sharedChallengeAnnouncement: document.querySelector("#shared-challenge-announcement"),
  todayDashboard: document.querySelector("#today-dashboard"),
  todayRangeCopy: document.querySelector("#today-range-copy"),
  todayCharacters: document.querySelector("#today-characters"),
  todayMeaning: document.querySelector("#today-meaning"),
  todayMemoryScene: document.querySelector("#today-memory-scene"),
  todayMemoryArt: document.querySelector("#open-today-memory"),
  shuffleTodayLesson: document.querySelector("#shuffle-today-lesson"),
  shareTodayChallenge: document.querySelector("#share-today-challenge"),
  openTodayPassage: document.querySelector("#open-today-passage"),
  overviewRangeLabel: document.querySelector("#overview-range-label"),
  overviewRange: document.querySelector("#overview-range"),
  overviewSearchForm: document.querySelector("#overview-search-form"),
  overviewSearch: document.querySelector("#overview-search"),
  overviewGrid: document.querySelector("#overview-grid"),
  overviewEmpty: document.querySelector("#overview-empty"),
  overviewResetFilters: document.querySelector("#overview-reset-filters"),
  overviewResultCount: document.querySelector("#overview-result-count"),
  overviewToggleMeaning: document.querySelector("#overview-toggle-meaning"),
  overviewAnnouncement: document.querySelector("#overview-announcement"),
  clearSearch: document.querySelector("#clear-search"),
  previousCouplet: document.querySelector("#previous-couplet"),
  nextCouplet: document.querySelector("#next-couplet"),
  coupletPosition: document.querySelector("#couplet-position"),
  passageScreen: document.querySelector("#screen-passage"),
  passageCard: document.querySelector("#passage-card"),
  phraseGrids: Array.from(document.querySelectorAll("[data-phrase-grid]")),
  coupletMeaning: document.querySelector("#couplet-meaning"),
  playCouplet: document.querySelector("#play-couplet"),
  continuousListen: document.querySelector("#continuous-listen"),
  toggleReading: document.querySelector("#toggle-reading"),
  toggleMeaning: document.querySelector("#toggle-meaning"),
  revealAnswer: document.querySelector("#reveal-answer"),
  selectedCharacter: document.querySelector("#selected-character"),
  selectedGloss: document.querySelector("#selected-gloss"),
  selectedReading: document.querySelector("#selected-reading"),
  selectedRadical: document.querySelector("#selected-radical"),
  selectedStrokes: document.querySelector("#selected-strokes"),
  relatedWordsSection: document.querySelector("#related-words-section"),
  selectedRelatedWords: document.querySelector("#selected-related-words"),
  passageMemoryImage: document.querySelector("#passage-memory-image"),
  passageMemoryClues: document.querySelector("#passage-memory-clues"),
  passageMemoryScene: document.querySelector("#passage-memory-scene"),
  passageMemoryReveal: document.querySelector("#passage-memory-reveal"),
  resetMemoryClues: document.querySelector("#reset-memory-clues"),
  gridSetup: document.querySelector("#grid-setup"),
  gridSession: document.querySelector("#grid-session"),
  sessionResult: document.querySelector("#session-result"),
  gridChallengeBest: document.querySelector("#grid-challenge-best"),
  startGridChallenge: document.querySelector("#start-grid-challenge"),
  sessionForm: document.querySelector("#session-form"),
  sessionScope: document.querySelector("#session-scope"),
  customStartField: document.querySelector("#custom-start-field"),
  sessionStart: document.querySelector("#session-start"),
  sessionDifficulty: document.querySelector("#session-difficulty"),
  sessionBoardSize: document.querySelector("#session-board-size"),
  resumeSession: document.querySelector("#resume-session"),
  resumeSessionDetail: document.querySelector("#resume-session-detail"),
  gridOverallProgress: document.querySelector("#grid-overall-progress"),
  gridSessionProgress: document.querySelector("#grid-session-progress"),
  gridAccuracy: document.querySelector("#grid-accuracy"),
  gridWrongCount: document.querySelector("#grid-wrong-count"),
  pauseSession: document.querySelector("#pause-session"),
  targetPanel: document.querySelector("#target-panel"),
  targetPrompt: document.querySelector("#target-prompt"),
  targetPosition: document.querySelector("#target-position"),
  continuousBoard: document.querySelector("#continuous-board"),
  currentPhraseProgress: document.querySelector("#current-phrase-progress"),
  completionStrip: document.querySelector("#completion-strip"),
  completionTitle: document.querySelector("#completion-title"),
  completionCopy: document.querySelector("#completion-copy"),
  replayTarget: document.querySelector("#replay-target"),
  showHint: document.querySelector("#show-hint"),
  restartSession: document.querySelector("#restart-session"),
  endSession: document.querySelector("#end-session"),
  gridAnnouncement: document.querySelector("#grid-announcement"),
  resultLearned: document.querySelector("#result-learned"),
  resultAccuracy: document.querySelector("#result-accuracy"),
  resultWrong: document.querySelector("#result-wrong"),
  resultTime: document.querySelector("#result-time"),
  resultCharacters: document.querySelector("#result-characters"),
  retryWrong: document.querySelector("#retry-wrong"),
  closeResult: document.querySelector("#close-result"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  voiceSelect: document.querySelector("#voice-select"),
  rateSelect: document.querySelector("#rate-select"),
  voiceNote: document.querySelector("#voice-note"),
  settingTapToSpeak: document.querySelector("#setting-tap-to-speak"),
  settingReadFour: document.querySelector("#setting-read-four"),
  settingVibrate: document.querySelector("#setting-vibrate"),
  toast: document.querySelector("#toast"),
};

const tts = new TTSManager();
tts.voiceURI = appState.settings.voiceURI;
tts.rate = appState.settings.rate;
tts.onVoicesChange = renderVoiceControls;
tts.onStateChange = function (nextSpeechState) {
  speechState = nextSpeechState;
  renderSpeechState();
};
tts.onVoiceFallback = function (voice) {
  commit(function (state) {
    state.settings.voiceURI = voice ? voice.voiceURI : "";
  });
  syncSettingsControls();
  renderVoiceNote();
  showToast(
    voice
      ? `${voice.name} 목소리로 다시 재생합니다.`
      : "브라우저 기본 한국어 목소리로 다시 재생합니다.",
  );
};

initialize();

function initialize() {
  if (CHARACTERS.length !== 1000 || COUPLETS.length !== 125) {
    throw new Error("천자문 데이터가 올바르지 않습니다.");
  }
  buildRangeControls();
  bindEvents();
  tts.start();
  tts.configure(appState.settings);
  syncSettingsControls();
  renderApp();
  updateTtsAvailability();
  registerServiceWorker();

  if (loaded.migrated) {
    showToast("기존 설정과 게임 기록을 불러왔습니다.");
  }
}

function commit(mutator) {
  mutator(appState);
  appState = store.update(appState);
  return appState;
}

function buildRangeControls() {
  const overviewFragment = document.createDocumentFragment();

  RANGE_NAMES.forEach(function (name, rangeIndex) {
    const start = rangeIndex * RANGE_SIZE;
    const label = `${name} · ${start + 1}–${start + RANGE_SIZE}`;
    const overviewOption = new Option(label, String(start));
    overviewFragment.append(overviewOption);
  });

  elements.overviewRange.append(overviewFragment);
}

function bindEvents() {
  elements.brandHome.addEventListener("click", goHome);
  elements.modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.dataset.mode);
    });
  });
  elements.shareTodayChallenge.addEventListener("click", shareTodayLesson);
  elements.shuffleTodayLesson.addEventListener("click", shuffleTodayLesson);
  elements.todayMemoryArt.addEventListener("click", openTodayMemoryStudy);
  elements.openTodayPassage.addEventListener("click", openTodayPassage);
  elements.todayCharacters.addEventListener("click", speakDailyCharacter);

  elements.startSharedChallenge.addEventListener("click", startSharedChallenge);
  elements.retrySharedChallenge.addEventListener("click", startSharedChallenge);
  elements.shareSharedChallenge.addEventListener("click", shareTodayLesson);
  elements.sharedChallengeBoard.addEventListener("click", handleSharedChallengeClick);
  elements.sharedChallengeBoard.addEventListener("keydown", handleCompactBoardKeyboard);

  elements.overviewSearchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    commit(function (state) {
      state.ui.search = elements.overviewSearch.value.trim();
    });
    renderOverview();
  });
  elements.clearSearch.addEventListener("click", clearOverviewSearch);
  elements.overviewResetFilters.addEventListener("click", resetOverviewFilters);
  elements.overviewRange.addEventListener("change", function () {
    setOverviewRange(Number(elements.overviewRange.value));
  });
  elements.overviewToggleMeaning.addEventListener("click", function () {
    const willHide = !appState.settings.hideOverviewMeaning;
    overviewRevealedIndexes = new Set();
    commit(function (state) {
      state.settings.hideOverviewMeaning = willHide;
    });
    renderOverview();
    elements.overviewAnnouncement.textContent = willHide
      ? "모든 글자의 뜻을 가렸습니다. 한자를 누르면 해당 글자의 뜻을 듣고 확인할 수 있습니다."
      : "모든 글자의 뜻을 표시했습니다.";
  });
  elements.overviewGrid.addEventListener("click", handleInfiniteOverviewClick);

  elements.previousCouplet.addEventListener("click", function () {
    moveCouplet(-1);
  });
  elements.nextCouplet.addEventListener("click", function () {
    moveCouplet(1);
  });
  elements.phraseGrids.forEach(function (grid) {
    grid.addEventListener("click", handlePassageCharacterClick);
    grid.addEventListener("keydown", handleFourGridKeyboard);
  });
  elements.playCouplet.addEventListener("click", playCurrentCouplet);
  elements.continuousListen.addEventListener("click", toggleContinuousListening);
  elements.passageMemoryClues.addEventListener("click", toggleMemoryClue);
  elements.resetMemoryClues.addEventListener("click", resetMemoryClues);
  elements.toggleReading.addEventListener("click", function () {
    commit(function (state) {
      state.settings.hideReading = !state.settings.hideReading;
      state.ui.revealAnswer = false;
    });
    renderPassage();
    syncSettingsControls();
  });
  elements.toggleMeaning.addEventListener("click", function () {
    commit(function (state) {
      state.settings.hideMeaning = !state.settings.hideMeaning;
      state.ui.revealAnswer = false;
    });
    renderPassage();
    syncSettingsControls();
  });
  elements.revealAnswer.addEventListener("click", function () {
    commit(function (state) {
      state.ui.revealAnswer = true;
    });
    renderPassageVisibility();
  });

  elements.sessionScope.addEventListener("change", renderCustomStartField);
  elements.sessionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    startStandardGridSession();
  });
  elements.startGridChallenge.addEventListener("click", startGridChallenge);
  elements.resumeSession.addEventListener("click", function () {
    renderGridScreen();
  });
  elements.continuousBoard.addEventListener("click", handleBoardClick);
  elements.continuousBoard.addEventListener("keydown", handleBoardKeyboard);
  elements.pauseSession.addEventListener("click", toggleSessionPause);
  elements.replayTarget.addEventListener("click", speakGridTarget);
  elements.showHint.addEventListener("click", revealGridHint);
  elements.restartSession.addEventListener("click", restartGridSession);
  elements.endSession.addEventListener("click", endGridSession);
  elements.retryWrong.addEventListener("click", retryWrongCharacters);
  elements.closeResult.addEventListener("click", closeSessionResult);

  elements.settingsButton.addEventListener("click", function () {
    syncSettingsControls();
    elements.settingsDialog.showModal();
  });
  elements.settingsDialog.addEventListener("click", function (event) {
    if (event.target === elements.settingsDialog) elements.settingsDialog.close();
  });
  elements.voiceSelect.addEventListener("change", function () {
    commit(function (state) {
      state.settings.voiceURI = elements.voiceSelect.value;
    });
    tts.configure(appState.settings);
    renderVoiceNote();
  });
  elements.rateSelect.addEventListener("change", function () {
    commit(function (state) {
      state.settings.rate = Number(elements.rateSelect.value);
    });
    tts.configure(appState.settings);
  });
  elements.settingTapToSpeak.addEventListener("change", function () {
    commit(function (state) {
      state.settings.tapToSpeak = elements.settingTapToSpeak.checked;
    });
  });
  elements.settingReadFour.addEventListener("change", function () {
    commit(function (state) {
      state.settings.readFourOnComplete = elements.settingReadFour.checked;
    });
  });
  elements.settingVibrate.addEventListener("change", function () {
    commit(function (state) {
      state.settings.vibrate = elements.settingVibrate.checked;
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopAllSpeech();
  });
  window.addEventListener("pagehide", stopAllSpeech);
}

function renderApp() {
  renderModes();
  if (sharedChallengeDay !== null || appState.ui.mode === "today") renderTodayScreen();
  if (appState.ui.mode === "overview") renderOverview();
  if (appState.ui.mode === "passage") renderPassage();
  if (appState.ui.mode === "grid") renderGridScreen();
}

function renderModes() {
  const visibleMode = sharedChallengeDay !== null ? "today" : appState.ui.mode;
  elements.modeButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === visibleMode));
  });
  elements.screens.forEach(function (screen) {
    screen.hidden = screen.dataset.screen !== visibleMode;
  });
}

function goHome(event) {
  event.preventDefault();
  stopAllSpeech();
  leaveChallengeView();
  overviewRevealedIndexes = new Set();
  commit(function (state) {
    state.ui.mode = "today";
    state.ui.search = "";
    state.ui.revealAnswer = false;
  });
  renderApp();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setMode(mode) {
  if (!["today", "overview", "passage", "grid"].includes(mode)) return;
  if (sharedChallengeDay !== null) leaveChallengeView();
  if (mode !== appState.ui.mode) stopAllSpeech();
  commit(function (state) {
    state.ui.mode = mode;
    state.ui.revealAnswer = false;
  });
  renderApp();
}

function renderTodayScreen() {
  if (sharedChallengeDay !== null) {
    elements.sharedChallenge.hidden = false;
    elements.todayDashboard.hidden = true;
    renderSharedChallenge();
    return;
  }

  elements.sharedChallenge.hidden = true;
  elements.todayDashboard.hidden = false;
  const dayIndex = getOrCreateTodayLessonDay();
  const lesson = getLesson(dayIndex);
  elements.todayDashboard.dataset.sceneQuarter = String(
    Math.min(3, Math.floor(dayIndex / 32)),
  );
  elements.todayRangeCopy.textContent = `${dayIndex * 8 + 1}–${dayIndex * 8 + 8}자 · ${lesson.couplet.data.reading}`;
  elements.todayMeaning.textContent = lesson.couplet.data.meaning;
  elements.todayMemoryScene.textContent = lesson.memoryScene;
  applyMemoryAtlas(elements.todayMemoryArt, dayIndex);
  elements.todayMemoryArt.dataset.dayIndex = String(dayIndex);

  renderTodayCharacters(lesson);
  elements.shuffleTodayLesson.title = "125개 8자 연에서 다른 연을 무작위로 고릅니다.";
}

function getOrCreateTodayLessonDay(options = {}) {
  const stored = options.force ? null : getRandomDailyPick(appState.course);
  if (stored !== null) return stored;
  const previous = appState.course.dailyPick?.dayIndex;
  const pick = createRandomDailyPick({}, {
    now: Date.now(),
    random: secureRandomUnit(),
    excludeDay: options.excludeDay ?? previous,
  });
  commit(function (state) {
    state.course.dailyPick = pick;
  });
  return pick.dayIndex;
}

function secureRandomUnit() {
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
}

function shuffleTodayLesson() {
  const previous = appState.course.dailyPick?.dayIndex;
  getOrCreateTodayLessonDay({ force: true, excludeDay: previous });
  renderApp();
  window.scrollTo({ top: 0, behavior: "auto" });
  showToast("다른 8자를 무작위로 골랐습니다.");
}

function openTodayPassage() {
  const dayIndex = Number(elements.todayMemoryArt.dataset.dayIndex);
  if (!Number.isInteger(dayIndex)) return;
  openPassage(dayIndex * 8, false);
}

function openTodayMemoryStudy() {
  const dayIndex = Number(elements.todayMemoryArt.dataset.dayIndex);
  if (!Number.isInteger(dayIndex)) return;
  openPassage(dayIndex * 8, false);
  window.setTimeout(function () {
    document.querySelector(".memory-study")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, 0);
}

function renderTodayCharacters(lesson) {
  const fragment = document.createDocumentFragment();
  lesson.items.forEach(function (item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "today-character";
    button.dataset.index = String(item.index);
    button.setAttribute("aria-label", `${item.contextHun} 듣기`);
    button.innerHTML =
      `<span class="today-character__hanja" lang="zh-Hant">${item.character}</span>` +
      `<span class="today-character__reading">${item.contextHun}</span>`;
    fragment.append(button);
  });
  elements.todayCharacters.replaceChildren(fragment);
}

function speakDailyCharacter(event) {
  const button = event.target.closest("[data-index]");
  if (!button) return;
  const item = CHARACTERS[Number(button.dataset.index)];
  if (!item) return;
  tts.speak(item.contextHun, { kind: "daily-character", onError: handleTtsError });
}

async function shareTodayLesson() {
  const dayIndex = sharedChallengeDay ?? getOrCreateTodayLessonDay();
  const lesson = getLesson(dayIndex);
  const url = createChallengeUrl(window.location, dayIndex);
  const shareData = {
    title: "천자문 · 오늘의 8자 도전",
    text: `${lesson.couplet.data.hanja} — ${lesson.couplet.data.meaning}`,
    url,
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast("회원가입 없이 푸는 도전 링크를 복사했습니다.");
    } else {
      window.prompt("도전 링크를 복사하세요.", url);
    }
  } catch (error) {
    if (error && error.name !== "AbortError") {
      showToast("공유하지 못했습니다. 다시 시도해 주세요.");
    }
  }
}

function renderCompactBoard(container, session) {
  const fragment = document.createDocumentFragment();
  session.boardIndexes.forEach(function (index, slot) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "board-cell";
    button.dataset.slot = String(slot);
    renderBoardCellElement(button, Number.isInteger(index) ? CHARACTERS[index] : null);
    fragment.append(button);
  });
  container.replaceChildren(fragment);
}

function renderSharedChallenge() {
  const lesson = getLesson(sharedChallengeDay);
  elements.sharedChallengeDay.textContent = String(lesson.dayNumber);
  elements.sharedChallengeMeaning.textContent = lesson.couplet.data.meaning;
  const phraseFragment = document.createDocumentFragment();
  lesson.items.forEach(function (item) {
    const span = document.createElement("span");
    span.textContent = item.character;
    phraseFragment.append(span);
  });
  elements.sharedChallengePhrase.replaceChildren(phraseFragment);
  elements.startSharedChallenge.hidden = Boolean(sharedChallengeSession);
  elements.sharedChallengePlay.hidden = !sharedChallengeSession || sharedChallengeSession.complete;
  elements.sharedChallengeResult.hidden = !sharedChallengeSession?.complete;
  if (sharedChallengeSession && !sharedChallengeSession.complete) {
    renderCompactBoard(elements.sharedChallengeBoard, sharedChallengeSession);
    updateSharedChallengeStatus();
  }
}

function startSharedChallenge() {
  const lesson = getLesson(sharedChallengeDay);
  sharedChallengeSession = createGridSession({ indexes: lesson.indexes, boardSize: 8 });
  sharedChallengeStartedAt = Date.now();
  sharedChallengeWrong = 0;
  elements.sharedChallengeResult.hidden = true;
  elements.startSharedChallenge.hidden = true;
  elements.sharedChallengePlay.hidden = false;
  renderCompactBoard(elements.sharedChallengeBoard, sharedChallengeSession);
  updateSharedChallengeStatus();
  focusFirstCompactBoardCell(elements.sharedChallengeBoard);
}

function updateSharedChallengeStatus() {
  const session = sharedChallengeSession;
  if (!session) return;
  const correct = session.targetPosition;
  elements.sharedChallengeTarget.textContent = session.complete
    ? "완료"
    : CHARACTERS[session.targetCursor].reading;
  elements.sharedChallengeProgress.textContent = `${correct} / 8`;
  elements.sharedChallengeWrong.textContent = String(sharedChallengeWrong);
}

function handleSharedChallengeClick(event) {
  const button = event.target.closest(".board-cell");
  if (!button || button.disabled || !sharedChallengeSession || sharedChallengeSession.complete) return;
  const selectedIndex = Number(button.dataset.index);
  if (!Number.isInteger(selectedIndex)) return;
  const targetIndex = sharedChallengeSession.targetCursor;
  const result = selectGridIndex(sharedChallengeSession, selectedIndex);
  if (!result.correct) {
    sharedChallengeWrong += 1;
    button.classList.remove("is-wrong");
    requestAnimationFrame(function () { button.classList.add("is-wrong"); });
    window.setTimeout(function () { button.classList.remove("is-wrong"); }, 260);
    updateSharedChallengeStatus();
    elements.sharedChallengeAnnouncement.textContent = "오답입니다. 글자 배치는 바뀌지 않았습니다.";
    return;
  }
  const item = CHARACTERS[targetIndex];
  sharedChallengeSession = result.session;
  button.classList.add("is-correct");
  button.dataset.index = "";
  window.setTimeout(function () {
    if (button.isConnected) {
      renderBoardCellElement(
        button,
        Number.isInteger(result.replacementIndex) ? CHARACTERS[result.replacementIndex] : null,
      );
    }
  }, 120);
  tts.speak(item.reading, { kind: "shared-grid-feedback", onError: handleTtsError });
  updateSharedChallengeStatus();
  elements.sharedChallengeAnnouncement.textContent = result.completed
    ? `정답, ${item.reading}. 도전을 완료했습니다.`
    : `정답, ${item.reading}. 다음 글자를 찾으세요.`;
  if (result.completed) finishSharedChallenge();
}

function finishSharedChallenge() {
  const duration = Math.max(0, Date.now() - sharedChallengeStartedAt);
  const accuracy = Math.round((8 / (8 + sharedChallengeWrong)) * 100);
  elements.sharedChallengePlay.hidden = true;
  elements.sharedChallengeResult.hidden = false;
  elements.sharedChallengeTime.textContent = formatDuration(duration);
  elements.sharedChallengeAccuracy.textContent = `${accuracy}%`;
}

function handleCompactBoardKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }
  const button = event.target.closest(".board-cell");
  if (!button) return;
  event.preventDefault();
  const buttons = Array.from(event.currentTarget.querySelectorAll(".board-cell:not(:disabled)"));
  const current = buttons.indexOf(button);
  let next = current;
  if (event.key === "ArrowLeft") next -= 1;
  if (event.key === "ArrowRight") next += 1;
  if (event.key === "ArrowUp") next -= 4;
  if (event.key === "ArrowDown") next += 4;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  buttons[Math.min(buttons.length - 1, Math.max(0, next))]?.focus();
}

function focusFirstCompactBoardCell(container) {
  window.setTimeout(function () {
    container.querySelector(".board-cell:not(:disabled)")?.focus({ preventScroll: true });
  }, 0);
}

function leaveChallengeView() {
  if (sharedChallengeDay === null) return;
  sharedChallengeDay = null;
  sharedChallengeSession = null;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  window.history.replaceState({}, "", url);
}

function renderOverview() {
  const query = appState.ui.search.trim();
  const indexes = query
    ? findCharacterIndexes(query)
    : Array.from({ length: TOTAL_CHARACTERS }, function (_, index) { return index; });
  const fragment = document.createDocumentFragment();

  indexes.forEach(function (index) {
    const item = CHARACTERS[index];
    fragment.append(
      createOverviewCell(item, {
        selected: index === appState.ui.selectedIndex,
        concealMeaning:
          appState.settings.hideOverviewMeaning && !overviewRevealedIndexes.has(index),
        meaningToggle: appState.settings.hideOverviewMeaning,
        revealed: overviewRevealedIndexes.has(index),
      }),
    );
  });

  elements.overviewGrid.replaceChildren(fragment);
  elements.overviewGrid.classList.toggle(
    "is-meaning-hidden",
    appState.settings.hideOverviewMeaning,
  );
  elements.overviewEmpty.hidden = indexes.length > 0;
  elements.overviewGrid.hidden = indexes.length === 0;
  elements.clearSearch.hidden = !query;
  elements.overviewSearch.value = query;
  elements.overviewRange.value = String(appState.ui.rangeStart);
  elements.overviewRangeLabel.textContent = query
    ? `검색 · “${query}”`
    : "1–1,000 · 한 글자씩";
  elements.overviewResultCount.textContent = query ? `${indexes.length}개 결과` : "";
  elements.overviewToggleMeaning.setAttribute(
    "aria-pressed",
    String(appState.settings.hideOverviewMeaning),
  );
}

function handleInfiniteOverviewClick(event) {
  const cell = event.target.closest(".overview-cell");
  if (!cell) return;
  const index = Number(cell.dataset.index);
  const item = CHARACTERS[index];
  if (!item) return;

  const meaningIsRevealed =
    appState.settings.hideOverviewMeaning && !overviewRevealedIndexes.has(index);
  if (appState.settings.hideOverviewMeaning) {
    if (meaningIsRevealed) overviewRevealedIndexes.add(index);
    else overviewRevealedIndexes.delete(index);
  }
  commit(function (state) {
    state.ui.selectedIndex = index;
    state.ui.rangeStart = Math.floor(index / RANGE_SIZE) * RANGE_SIZE;
  });

  elements.overviewGrid.querySelectorAll(".overview-cell.is-selected").forEach(function (button) {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
  cell.classList.add("is-selected");
  cell.classList.toggle("is-revealed", meaningIsRevealed);
  cell.setAttribute("aria-pressed", "true");
  if (appState.settings.hideOverviewMeaning) {
    cell.setAttribute("aria-expanded", String(meaningIsRevealed));
  } else {
    cell.removeAttribute("aria-expanded");
  }
  const meaning = cell.querySelector(".overview-cell__meaning");
  if (meaning) {
    meaning.setAttribute(
      "aria-hidden",
      String(!meaningIsRevealed && appState.settings.hideOverviewMeaning),
    );
  }
  cell.setAttribute(
    "aria-label",
    appState.settings.hideOverviewMeaning
      ? meaningIsRevealed
        ? `${item.number}번째, ${item.contextHun}, 다시 누르면 뜻 가림`
        : `${item.number}번째 글자 ${item.character}, 뜻 가림, 눌러서 확인`
      : `${item.number}번째, ${item.contextHun}`,
  );
  elements.overviewAnnouncement.textContent = appState.settings.hideOverviewMeaning
    ? meaningIsRevealed
      ? `${item.contextHun}. 같은 글자를 다시 누르면 뜻을 가립니다.`
      : `${item.character}의 뜻을 다시 가렸습니다.`
    : `${item.contextHun}.`;

  if (appState.settings.tapToSpeak) {
    tts.speak(item.contextHun, { kind: "character", onError: handleTtsError });
  }
}

function openPassage(index, speak) {
  stopAllSpeech();
  commit(function (state) {
    state.ui.selectedIndex = index;
    state.ui.rangeStart = Math.floor(index / 100) * 100;
    state.ui.mode = "passage";
    state.ui.revealAnswer = false;
  });
  renderApp();
  if (speak) {
    tts.speak(CHARACTERS[index].contextHun, { kind: "character", onError: handleTtsError });
  }
}

function clearOverviewSearch() {
  commit(function (state) {
    state.ui.search = "";
  });
  renderOverview();
}

function resetOverviewFilters() {
  commit(function (state) {
    state.ui.search = "";
    state.ui.statusFilter = "all";
  });
  renderOverview();
}

function setOverviewRange(start) {
  stopAllSpeech();
  commit(function (state) {
    state.ui.rangeStart = Math.min(900, Math.max(0, start));
    state.ui.selectedIndex = state.ui.rangeStart;
    state.ui.search = "";
  });
  renderOverview();
  focusOverviewCell(appState.ui.selectedIndex);
}

function focusOverviewCell(index) {
  window.setTimeout(function () {
    const cell = elements.overviewGrid.querySelector(`[data-index="${index}"]`);
    if (!cell) return;
    cell.focus({ preventScroll: true });
    cell.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  }, 0);
}

function renderPassage() {
  const selected = CHARACTERS[appState.ui.selectedIndex];
  const details = getCharacterStudyDetails(selected.index);
  const couplet = details.couplet;
  elements.coupletPosition.textContent = `${couplet.index + 1} / 125`;
  elements.previousCouplet.disabled = couplet.index === 0;
  elements.nextCouplet.disabled = couplet.index === 124;
  elements.coupletMeaning.textContent = couplet.data.meaning;

  [couplet.firstPhrase, couplet.secondPhrase].forEach(function (phrase, phraseOffset) {
    const grid = elements.phraseGrids[phraseOffset];
    const fragment = document.createDocumentFragment();
    phrase.items.forEach(function (item) {
      fragment.append(
        createPassageCharacter(item, {
          selected: item.index === selected.index,
          concealReading: appState.settings.hideReading && !appState.ui.revealAnswer,
        }),
      );
    });
    grid.replaceChildren(fragment);
  });

  elements.selectedCharacter.textContent = selected.character;
  elements.selectedGloss.textContent = selected.gloss;
  elements.selectedReading.textContent = selected.reading;
  elements.selectedRadical.textContent = details.radical;
  elements.selectedStrokes.textContent = String(details.totalStrokes);

  const relatedWordsFragment = document.createDocumentFragment();
  details.relatedWords.forEach(function (word) {
    const entry = document.createElement("li");
    entry.className = "related-word";

    const term = document.createElement("span");
    term.className = "related-word__term";
    const reading = document.createElement("strong");
    reading.textContent = word.word;
    const origin = document.createElement("span");
    origin.lang = "zh-Hant";
    origin.textContent = word.origin;
    term.append(reading, origin);

    const definition = document.createElement("span");
    definition.className = "related-word__definition";
    definition.textContent = word.definition;
    entry.append(term, definition);
    relatedWordsFragment.append(entry);
  });
  elements.selectedRelatedWords.replaceChildren(relatedWordsFragment);
  elements.relatedWordsSection.hidden = details.relatedWords.length === 0;
  renderPassageMemory(couplet);
  renderPassageVisibility();
  renderSpeechState();
}

function applyMemoryAtlas(element, dayIndex) {
  if (!element) return;
  const sheet = Math.floor(dayIndex / 8) + 1;
  const cell = dayIndex % 8;
  const column = cell % 4;
  const row = Math.floor(cell / 4);
  element.style.backgroundImage = `url("./assets/memory-atlas-${String(sheet).padStart(2, "0")}.webp")`;
  element.style.backgroundSize = "400% 200%";
  element.style.backgroundPosition = `${(column / 3) * 100}% ${row * 100}%`;
}

function renderPassageMemory(couplet) {
  const lesson = getLesson(couplet.index);
  if (renderedMemoryDay !== lesson.dayIndex) {
    renderedMemoryDay = lesson.dayIndex;
    memoryClueRevealed = new Set();
  }
  applyMemoryAtlas(elements.passageMemoryImage, lesson.dayIndex);
  elements.passageMemoryScene.textContent = lesson.memoryScene;

  const clues = document.createDocumentFragment();
  for (let pairIndex = 0; pairIndex < 4; pairIndex += 1) {
    const pair = lesson.items.slice(pairIndex * 2, pairIndex * 2 + 2);
    const revealed = memoryClueRevealed.has(pairIndex);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-clue";
    button.dataset.memoryClue = String(pairIndex);
    button.dataset.position = String(pairIndex + 1);
    button.setAttribute("aria-pressed", String(revealed));
    button.setAttribute(
      "aria-label",
      revealed
        ? `${pair.map(function (item) { return item.contextHun; }).join(", ")}, 다시 가리기`
        : `${pairIndex + 1}번째 그림 단서 보기`,
    );
    if (revealed) {
      const characters = document.createElement("strong");
      characters.lang = "zh-Hant";
      characters.textContent = pair.map(function (item) { return item.character; }).join("");
      const readings = document.createElement("span");
      readings.textContent = pair.map(function (item) { return item.contextHun; }).join(" · ");
      button.append(characters, readings);
    } else {
      button.textContent = String(pairIndex + 1);
    }
    clues.append(button);
  }
  elements.passageMemoryClues.replaceChildren(clues);
  renderMemoryReveal(lesson);
}

function renderMemoryReveal(lesson) {
  if (memoryClueRevealed.size === 0) {
    elements.passageMemoryReveal.textContent = "그림 속 단서를 눌러 두 글자씩 떠올려 보세요.";
    return;
  }
  const fragment = document.createDocumentFragment();
  Array.from(memoryClueRevealed).sort().forEach(function (pairIndex) {
    const pair = lesson.items.slice(pairIndex * 2, pairIndex * 2 + 2);
    const line = document.createElement("p");
    const characters = document.createElement("strong");
    characters.lang = "zh-Hant";
    characters.textContent = pair.map(function (item) { return item.character; }).join("");
    const copy = document.createElement("span");
    copy.textContent = pair.map(function (item) { return item.contextHun; }).join(" · ");
    line.append(characters, copy);
    fragment.append(line);
  });
  elements.passageMemoryReveal.replaceChildren(fragment);
}

function toggleMemoryClue(event) {
  const button = event.target.closest("[data-memory-clue]");
  if (!button) return;
  const pairIndex = Number(button.dataset.memoryClue);
  if (!Number.isInteger(pairIndex) || pairIndex < 0 || pairIndex > 3) return;
  if (memoryClueRevealed.has(pairIndex)) memoryClueRevealed.delete(pairIndex);
  else memoryClueRevealed.add(pairIndex);
  const couplet = getCouplet(CHARACTERS[appState.ui.selectedIndex].coupletIndex);
  const target = couplet.items[pairIndex * 2];
  commit(function (state) {
    state.ui.selectedIndex = target.index;
  });
  renderPassage();
}

function resetMemoryClues() {
  memoryClueRevealed = new Set();
  renderPassage();
  elements.passageMemoryClues.querySelector("button")?.focus();
}

function renderPassageVisibility() {
  const reveal = appState.ui.revealAnswer;
  const concealReading = appState.settings.hideReading && !reveal;
  const concealMeaning = appState.settings.hideMeaning && !reveal;
  elements.passageScreen.classList.toggle("is-reading-hidden", appState.settings.hideReading);
  elements.passageScreen.classList.toggle("is-meaning-hidden", appState.settings.hideMeaning);
  elements.passageScreen.classList.toggle("is-answer-revealed", reveal);
  elements.toggleReading.setAttribute("aria-pressed", String(appState.settings.hideReading));
  elements.toggleMeaning.setAttribute("aria-pressed", String(appState.settings.hideMeaning));
  elements.revealAnswer.hidden = !(
    (appState.settings.hideReading || appState.settings.hideMeaning) && !reveal
  );
  elements.coupletMeaning.setAttribute("aria-hidden", String(concealMeaning));
  elements.selectedGloss.setAttribute("aria-hidden", String(concealMeaning));
  elements.selectedReading.setAttribute("aria-hidden", String(concealReading));
  elements.selectedRelatedWords
    .querySelectorAll(".related-word__definition")
    .forEach(function (definition) {
      definition.setAttribute("aria-hidden", String(concealMeaning));
    });
}

function handlePassageCharacterClick(event) {
  const button = event.target.closest(".phrase-character");
  if (!button) return;
  const index = Number(button.dataset.index);
  commit(function (state) {
    state.ui.selectedIndex = index;
  });
  renderPassage();
  if (appState.settings.tapToSpeak) {
    tts.speak(CHARACTERS[index].contextHun, { kind: "character", onError: handleTtsError });
  }
}

function handleFourGridKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const button = event.target.closest(".phrase-character");
  if (!button) return;
  event.preventDefault();
  const buttons = Array.from(event.currentTarget.querySelectorAll(".phrase-character"));
  const position = buttons.indexOf(button);
  let next = position;
  if (event.key === "ArrowLeft") next = Math.max(0, position - 1);
  if (event.key === "ArrowRight") next = Math.min(buttons.length - 1, position + 1);
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  buttons[next].focus();
}

function moveCouplet(delta) {
  stopAllSpeech();
  const current = CHARACTERS[appState.ui.selectedIndex].coupletIndex;
  const next = Math.min(124, Math.max(0, current + delta));
  commit(function (state) {
    state.ui.selectedIndex = next * 8;
    state.ui.rangeStart = Math.floor(state.ui.selectedIndex / 100) * 100;
    state.ui.revealAnswer = false;
  });
  renderPassage();
}

function playCurrentCouplet() {
  if (speechState.speaking && speechState.kind === "couplet") {
    stopAllSpeech();
    return;
  }
  passageContinuous = false;
  const couplet = getCouplet(CHARACTERS[appState.ui.selectedIndex].coupletIndex);
  tts.speak(couplet.data.reading.replace(" ", ", "), {
    kind: "couplet",
    onError: handleTtsError,
  });
}

function toggleContinuousListening() {
  if (passageContinuous) {
    stopAllSpeech();
    return;
  }
  const startCouplet = CHARACTERS[appState.ui.selectedIndex].coupletIndex;
  passageContinuous = true;
  elements.continuousListen.setAttribute("aria-pressed", "true");
  tts.speakSequence(
    COUPLETS.slice(startCouplet).map(function (couplet) {
      return couplet.reading.replace(" ", ", ");
    }),
    {
      kind: "continuous",
      onItem: function (offset) {
        const coupletIndex = startCouplet + offset;
        commit(function (state) {
          state.ui.selectedIndex = coupletIndex * 8;
          state.ui.rangeStart = Math.floor(state.ui.selectedIndex / 100) * 100;
          state.ui.revealAnswer = false;
        });
        renderPassage();
        keepPassageInView();
      },
      onEnd: function () {
        passageContinuous = false;
        renderSpeechState();
        showToast("천자문 끝까지 연속 듣기를 마쳤습니다.");
      },
      onError: handleTtsError,
    },
  );
}

function keepPassageInView() {
  const rect = elements.passageCard.getBoundingClientRect();
  if (rect.top < 54 || rect.top > window.innerHeight - 120) {
    elements.passageCard.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }
}

function renderGridScreen() {
  const session = appState.grid.session;
  if (session && session.active) {
    elements.gridSetup.hidden = true;
    elements.sessionResult.hidden = true;
    elements.gridSession.hidden = false;
    const sessionKey = `${session.startedAt}-${session.startIndex}-${session.boardSize}`;
    if (renderedSessionKey !== sessionKey) {
      renderContinuousBoard(session);
      renderedSessionKey = sessionKey;
    }
    renderGridSessionStatus();
    return;
  }
  if (session && session.endedAt) {
    elements.gridSetup.hidden = true;
    elements.gridSession.hidden = true;
    elements.sessionResult.hidden = false;
    renderSessionResult(session);
    return;
  }
  elements.gridSetup.hidden = false;
  elements.gridSession.hidden = true;
  elements.sessionResult.hidden = true;
  elements.sessionBoardSize.value = String(appState.settings.boardSize);
  elements.resumeSession.hidden = true;
  renderGridChallengeBest();
  renderCustomStartField();
}

function renderCustomStartField() {
  elements.customStartField.hidden = elements.sessionScope.value !== "custom";
}

function startStandardGridSession() {
  stopAllSpeech();
  const scope = elements.sessionScope.value;
  const range = resolveSessionRange(scope);
  const boardSize = Number(elements.sessionBoardSize.value);
  const engine = createGridSession({
    startIndex: range.startIndex,
    endIndex: range.endIndex,
    boardSize,
  });
  const session = createSessionMetadata(engine, {
    difficulty: elements.sessionDifficulty.value,
    scope,
    reviewMode: false,
  });
  commit(function (state) {
    state.settings.boardSize = boardSize;
    state.grid.session = session;
    state.grid.lastCursor = range.startIndex;
  });
  renderedSessionKey = "";
  renderGridScreen();
  if (session.difficulty === "listening") speakGridTarget();
  focusFirstBoardCell();
}

function getGridChallengeStart() {
  const cursor = appState.grid.lastCursor >= TOTAL_CHARACTERS ? 0 : appState.grid.lastCursor;
  return Math.min(960, Math.max(0, cursor));
}

function renderGridChallengeBest() {
  const best = appState.grid.bestScores[getGridChallengeStart()];
  elements.gridChallengeBest.textContent = best
    ? `${best.accuracy}% · ${formatDuration(best.duration)}`
    : "아직 없음";
}

function startGridChallenge() {
  stopAllSpeech();
  const startIndex = getGridChallengeStart();
  const boardSize = appState.settings.boardSize;
  const engine = createGridSession({
    startIndex,
    endIndex: startIndex + 40,
    boardSize,
  });
  const session = createSessionMetadata(engine, {
    difficulty: "none",
    scope: "challenge",
    reviewMode: false,
    challengeMode: true,
  });
  commit(function (state) {
    state.grid.session = session;
    state.grid.lastCursor = startIndex;
  });
  renderedSessionKey = "";
  renderGridScreen();
  focusFirstBoardCell();
}

function resolveSessionRange(scope) {
  const cursor = appState.grid.lastCursor >= 1000 ? 0 : appState.grid.lastCursor;
  if (scope === "current") {
    return { startIndex: appState.ui.rangeStart, endIndex: appState.ui.rangeStart + 100 };
  }
  if (scope === "1000") return { startIndex: 0, endIndex: 1000 };
  if (["40", "100", "200"].includes(scope)) {
    const length = Number(scope);
    const startIndex = Math.min(cursor, 1000 - length);
    return { startIndex, endIndex: startIndex + length };
  }
  if (scope === "custom") {
    const startIndex = Math.min(999, Math.max(0, Number(elements.sessionStart.value) - 1 || 0));
    return { startIndex, endIndex: Math.min(1000, startIndex + 100) };
  }
  return { startIndex: cursor, endIndex: 1000 };
}

function createSessionMetadata(engine, options) {
  return {
    ...engine,
    active: true,
    paused: false,
    difficulty: options.difficulty,
    scope: options.scope,
    reviewMode: Boolean(options.reviewMode),
    challengeMode: Boolean(options.challengeMode),
    correctCount: 0,
    wrongCount: 0,
    wrongIndexes: [],
    errorsByTarget: {},
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

function renderContinuousBoard(session) {
  const fragment = document.createDocumentFragment();
  session.boardIndexes.forEach(function (index, slot) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "board-cell";
    button.dataset.slot = String(slot);
    renderBoardCellElement(button, Number.isInteger(index) ? CHARACTERS[index] : null);
    fragment.append(button);
  });
  elements.continuousBoard.dataset.size = String(session.boardSize);
  elements.continuousBoard.replaceChildren(fragment);
}

function handleBoardClick(event) {
  const button = event.target.closest(".board-cell");
  if (!button || button.disabled) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) return;
  answerGrid(index, button);
}

function answerGrid(selectedIndex, button) {
  const session = appState.grid.session;
  if (!session || !session.active || session.paused || session.complete) return;
  const targetIndex = session.targetCursor;
  const result = selectGridIndex(session, selectedIndex);

  if (!result.correct) {
    handleWrongGridAnswer(targetIndex, button);
    return;
  }

  const completedItem = CHARACTERS[targetIndex];
  const completedFour = (targetIndex + 1) % 4 === 0;
  const completedEight = (targetIndex + 1) % 8 === 0;
  const previousMetadata = session;
  const nextSession = {
    ...previousMetadata,
    ...result.session,
    correctCount: previousMetadata.correctCount + 1,
  };
  const nextCursor = result.completed
    ? Math.min(1000, targetIndex + 1)
    : result.session.targetCursor;

  commit(function (state) {
    state.progress = recordSkillAttempt(state.progress, targetIndex, "order", { correct: true });
    if (session.difficulty === "listening") {
      state.progress = recordSkillAttempt(state.progress, targetIndex, "listening", { correct: true });
    }
    state.grid.session = nextSession;
    state.grid.lastCursor = nextCursor;
  });

  button.classList.add("is-correct");
  button.dataset.index = "";
  button.setAttribute("aria-label", `정답, ${completedItem.reading}`);
  window.setTimeout(function () {
    if (button.isConnected) {
      renderBoardCellElement(
        button,
        Number.isInteger(result.replacementIndex) ? CHARACTERS[result.replacementIndex] : null,
      );
    }
  }, 140);

  if (
    appState.settings.vibrate &&
    navigator.vibrate &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigator.vibrate(10);
  }

  showGridCompletion(completedItem, completedFour, completedEight);
  playGridFeedback(completedItem, completedFour, result.completed);
  renderGridSessionStatus();
  elements.gridAnnouncement.textContent = result.completed
    ? `정답, ${completedItem.reading}. 세션을 완료했습니다.`
    : `정답, ${completedItem.reading}. 다음 글자를 찾으세요.`;

  if (result.completed) {
    const endedAt = new Date().toISOString();
    const completedSession = appState.grid.session;
    const attempts = completedSession.correctCount + completedSession.wrongCount;
    const candidate = {
      accuracy: attempts > 0
        ? Math.round((completedSession.correctCount / attempts) * 100)
        : 100,
      duration: Math.max(
        0,
        new Date(endedAt).getTime() - new Date(completedSession.startedAt).getTime(),
      ),
      completedAt: endedAt,
    };
    commit(function (state) {
      state.grid.session.active = false;
      state.grid.session.endedAt = endedAt;
      if (
        state.grid.session.challengeMode &&
        isBetterScore(candidate, state.grid.bestScores[state.grid.session.startIndex])
      ) {
        state.grid.bestScores[state.grid.session.startIndex] = candidate;
      }
    });
    window.setTimeout(function () {
      renderedSessionKey = "";
      renderGridScreen();
    }, 180);
  }
}

function handleWrongGridAnswer(targetIndex, button) {
  const session = appState.grid.session;
  const errors = (session.errorsByTarget[targetIndex] || 0) + 1;
  commit(function (state) {
    state.progress = recordSkillAttempt(state.progress, targetIndex, "order", { correct: false });
    if (session.difficulty === "listening") {
      state.progress = recordSkillAttempt(state.progress, targetIndex, "listening", { correct: false });
    }
    state.grid.session.wrongCount += 1;
    state.grid.session.errorsByTarget[targetIndex] = errors;
    if (!state.grid.session.wrongIndexes.includes(targetIndex)) {
      state.grid.session.wrongIndexes.push(targetIndex);
    }
  });
  button.classList.remove("is-wrong");
  requestAnimationFrame(function () {
    button.classList.add("is-wrong");
  });
  window.setTimeout(function () {
    button.classList.remove("is-wrong");
  }, 260);
  renderGridSessionStatus();
  elements.gridAnnouncement.textContent =
    errors >= 3
      ? "오답입니다. 진행 위치는 그대로입니다. 원하면 힌트 버튼을 누르세요."
      : "오답입니다. 진행 위치와 글자 배치는 바뀌지 않았습니다.";
}

function renderGridSessionStatus() {
  const session = appState.grid.session;
  if (!session) return;
  const progress = getSessionProgress(session);
  const attempts = session.correctCount + session.wrongCount;
  const accuracy = attempts > 0 ? Math.round((session.correctCount / attempts) * 100) : null;
  const target = session.complete ? null : CHARACTERS[session.targetCursor];
  elements.gridSession.classList.toggle("is-paused", session.paused);
  elements.gridOverallProgress.textContent = session.complete
    ? `${Math.min(1000, session.endIndex)} / 1,000`
    : `${session.targetCursor + 1} / 1,000`;
  elements.gridSessionProgress.textContent = `${progress.completed} / ${progress.total}`;
  elements.gridAccuracy.textContent = accuracy === null ? "—" : `${accuracy}%`;
  elements.gridWrongCount.textContent = String(session.wrongCount);
  elements.pauseSession.textContent = session.paused ? "계속하기" : "일시정지";
  elements.pauseSession.setAttribute("aria-pressed", String(session.paused));

  if (target) {
    renderGridTarget(target, session);
    renderCurrentPhraseProgress(target.index, session);
    const errors = session.errorsByTarget[target.index] || 0;
    elements.showHint.hidden = errors < 3;
    elements.replayTarget.hidden = session.difficulty !== "listening";
  }
}

function renderGridTarget(target, session) {
  elements.targetPanel.classList.toggle(
    "is-concealed",
    session.difficulty === "listening" || session.difficulty === "none",
  );
  if (session.difficulty === "character") {
    elements.targetPrompt.textContent = `${target.character} · ${target.reading}`;
  } else if (session.difficulty === "reading") {
    elements.targetPrompt.textContent = target.reading;
  } else if (session.difficulty === "listening") {
    elements.targetPrompt.textContent = "소리를 듣고 찾으세요";
  } else {
    elements.targetPrompt.textContent = "순서를 기억해 찾으세요";
  }
  elements.targetPosition.textContent = `전체 ${target.number}번째`;
}

function renderCurrentPhraseProgress(targetIndex, session) {
  const phraseStart = Math.floor(targetIndex / 4) * 4;
  const text = CHARACTERS.slice(phraseStart, phraseStart + 4)
    .map(function (item) {
      const completed =
        session.order.includes(item.index) &&
        session.order.indexOf(item.index) < session.targetPosition;
      return completed ? item.character : "□";
    })
    .join(" ");
  elements.currentPhraseProgress.textContent = text;
}

function showGridCompletion(item, completedFour, completedEight) {
  window.clearTimeout(completionTimer);
  if (!completedFour && !completedEight) {
    elements.completionStrip.hidden = true;
    return;
  }
  if (completedEight) {
    const couplet = getCouplet(item.coupletIndex);
    elements.completionTitle.textContent = couplet.data.hanja;
    elements.completionCopy.textContent = couplet.data.meaning;
  } else {
    const phrase = getPhrase(item.index);
    elements.completionTitle.textContent = phrase.hanja;
    elements.completionCopy.textContent = phrase.reading;
  }
  elements.completionStrip.hidden = false;
  completionTimer = window.setTimeout(function () {
    elements.completionStrip.hidden = true;
  }, 3200);
}

function playGridFeedback(item, completedFour, sessionCompleted) {
  const session = appState.grid.session;
  const queue = [item.reading];
  if (completedFour && appState.settings.readFourOnComplete) {
    queue.push(getPhrase(item.index).reading);
  }
  if (session.difficulty === "listening" && !sessionCompleted && !session.complete) {
    queue.push(CHARACTERS[session.targetCursor].reading);
  }
  tts.speakSequence(queue, { kind: "grid-feedback", onError: handleTtsError });
}

function speakGridTarget() {
  const session = appState.grid.session;
  if (!session || session.complete) return;
  tts.speak(CHARACTERS[session.targetCursor].reading, {
    kind: "grid-target",
    onError: handleTtsError,
  });
}

function revealGridHint() {
  const session = appState.grid.session;
  if (!session || (session.errorsByTarget[session.targetCursor] || 0) < 3) return;
  const button = elements.continuousBoard.querySelector(
    `[data-index="${session.targetCursor}"]`,
  );
  if (!button) return;
  button.classList.add("is-hint");
  button.focus({ preventScroll: true });
  elements.gridAnnouncement.textContent = `힌트: ${CHARACTERS[session.targetCursor].character} 글자 위치를 표시했습니다.`;
  window.setTimeout(function () {
    button.classList.remove("is-hint");
  }, 1400);
}

function toggleSessionPause() {
  const session = appState.grid.session;
  if (!session || !session.active) return;
  stopAllSpeech();
  commit(function (state) {
    state.grid.session.paused = !state.grid.session.paused;
  });
  renderGridSessionStatus();
  if (!appState.grid.session.paused && appState.grid.session.difficulty === "listening") {
    speakGridTarget();
  }
}

function restartGridSession() {
  const session = appState.grid.session;
  if (!session) return;
  const confirmed = window.confirm("이번 세션을 같은 범위의 첫 글자부터 다시 시작할까요?");
  if (!confirmed) return;
  stopAllSpeech();
  const engine = createGridSession({
    indexes: session.order,
    boardSize: session.boardSize,
  });
  const restarted = createSessionMetadata(engine, {
    difficulty: session.difficulty,
    scope: session.scope,
    reviewMode: session.reviewMode,
    challengeMode: session.challengeMode,
  });
  commit(function (state) {
    state.grid.session = restarted;
    state.grid.lastCursor = restarted.targetCursor;
  });
  renderedSessionKey = "";
  renderGridScreen();
  if (restarted.difficulty === "listening") speakGridTarget();
  focusFirstBoardCell();
}

function endGridSession() {
  const session = appState.grid.session;
  if (!session) return;
  stopAllSpeech();
  commit(function (state) {
    state.grid.session.active = false;
    state.grid.session.endedAt = new Date().toISOString();
  });
  renderedSessionKey = "";
  renderGridScreen();
}

function renderSessionResult(session) {
  const attempts = session.correctCount + session.wrongCount;
  const accuracy = attempts > 0 ? Math.round((session.correctCount / attempts) * 100) : 0;
  const elapsed = new Date(session.endedAt || Date.now()).getTime() - new Date(session.startedAt).getTime();
  elements.resultLearned.textContent = String(session.correctCount);
  elements.resultAccuracy.textContent = `${accuracy}%`;
  elements.resultWrong.textContent = String(session.wrongCount);
  elements.resultTime.textContent = formatDuration(elapsed);
  elements.resultCharacters.replaceChildren();
  session.wrongIndexes.forEach(function (index) {
    const item = CHARACTERS[index];
    const span = document.createElement("span");
    span.className = "result-character";
    span.innerHTML = `<strong lang="zh-Hant">${item.character}</strong><small>${item.reading}</small>`;
    span.title = item.contextHun;
    elements.resultCharacters.append(span);
  });
  elements.retryWrong.disabled = session.wrongIndexes.length === 0;
}

function retryWrongCharacters() {
  const session = appState.grid.session;
  if (!session || session.wrongIndexes.length === 0) return;
  const indexes = Array.from(new Set(session.wrongIndexes));
  const engine = createGridSession({
    indexes,
    boardSize: session.boardSize,
  });
  const retrySession = createSessionMetadata(engine, {
    difficulty: session.difficulty,
    scope: "wrong",
    reviewMode: false,
  });
  commit(function (state) {
    state.grid.session = retrySession;
    state.grid.lastCursor = indexes[0];
    state.ui.mode = "grid";
  });
  renderedSessionKey = "";
  renderGridScreen();
  if (retrySession.difficulty === "listening") speakGridTarget();
  focusFirstBoardCell();
}

function closeSessionResult() {
  commit(function (state) {
    state.grid.session = null;
  });
  renderGridScreen();
}

function handleBoardKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }
  const button = event.target.closest(".board-cell");
  if (!button) return;
  event.preventDefault();
  const buttons = Array.from(elements.continuousBoard.querySelectorAll(".board-cell:not(:disabled)"));
  const current = buttons.indexOf(button);
  const columns = Number(appState.grid.session.boardSize) === 25 ? 5 : 4;
  let next = current;
  if (event.key === "ArrowLeft") next = current - 1;
  if (event.key === "ArrowRight") next = current + 1;
  if (event.key === "ArrowUp") next = current - columns;
  if (event.key === "ArrowDown") next = current + columns;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  next = Math.min(buttons.length - 1, Math.max(0, next));
  buttons[next].focus();
}

function focusFirstBoardCell() {
  window.setTimeout(function () {
    const button = elements.continuousBoard.querySelector(".board-cell:not(:disabled)");
    if (button) button.focus({ preventScroll: true });
  }, 0);
}

function renderVoiceControls() {
  const voices = tts.voices;
  elements.voiceSelect.replaceChildren();
  if (!tts.supported) {
    elements.voiceSelect.append(new Option("음성 합성 미지원", ""));
    elements.voiceSelect.disabled = true;
    renderVoiceNote();
    return;
  }
  elements.voiceSelect.disabled = false;
  if (voices.length === 0) {
    elements.voiceSelect.append(new Option("브라우저 기본 한국어", ""));
  } else {
    voices.forEach(function (voice) {
      elements.voiceSelect.append(
        new Option(
          `${voice.name}${voice.localService ? "" : " · 온라인"}`,
          voice.voiceURI,
        ),
      );
    });
  }
  const selected = tts.configure(appState.settings);
  commit(function (state) {
    state.settings.voiceURI = selected ? selected.voiceURI : "";
  });
  elements.voiceSelect.value = appState.settings.voiceURI;
  renderVoiceNote();
}

function renderVoiceNote() {
  if (!tts.supported) {
    elements.voiceNote.textContent =
      "이 브라우저는 음성 합성을 지원하지 않습니다. 다른 보기와 게임은 그대로 사용할 수 있습니다.";
    return;
  }
  const selected = tts.voices.find(function (voice) {
    return voice.voiceURI === appState.settings.voiceURI;
  });
  if (!selected) {
    elements.voiceNote.textContent =
      "전용 한국어 음성이 없어 ko-KR 언어로 브라우저 기본 음성을 요청합니다.";
  } else if (/google/i.test(selected.name)) {
    elements.voiceNote.textContent = "사용 가능한 Google 한국어 음성을 우선 선택했습니다.";
  } else {
    elements.voiceNote.textContent =
      "Google 한국어 음성이 없어 설치된 한국어 음성을 사용합니다.";
  }
}

function syncSettingsControls() {
  elements.settingTapToSpeak.checked = appState.settings.tapToSpeak;
  elements.settingReadFour.checked = appState.settings.readFourOnComplete;
  elements.settingVibrate.checked = appState.settings.vibrate;
  elements.rateSelect.value = String(appState.settings.rate);
  elements.voiceSelect.value = appState.settings.voiceURI;
}

function updateTtsAvailability() {
  document.querySelectorAll("[data-tts]").forEach(function (button) {
    button.disabled = !tts.supported;
  });
  elements.voiceSelect.disabled = !tts.supported;
  renderVoiceNote();
}

function renderSpeechState() {
  elements.playCouplet.classList.toggle(
    "is-speaking",
    speechState.speaking && speechState.kind === "couplet",
  );
  elements.playCouplet.querySelector("span").textContent =
    speechState.speaking && speechState.kind === "couplet" ? "재생 정지" : "8자 연 듣기";
  elements.continuousListen.setAttribute("aria-pressed", String(passageContinuous));
}

function stopAllSpeech() {
  passageContinuous = false;
  tts.cancel();
  renderSpeechState();
}

function handleTtsError() {
  passageContinuous = false;
  renderSpeechState();
  showToast("음성을 재생하지 못했습니다. 브라우저의 음성 설정을 확인해 주세요.");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(function () {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(function (registration) {
        registration.update();
      })
      .catch(function () {
        // 오프라인 등록 실패가 앱 실행을 막지 않게 한다.
      });
  });
}
