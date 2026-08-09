import {
  CHARACTERS,
  COUPLETS,
  TOTAL_CHARACTERS,
  findCharacterIndexes,
  getCharacterStudyDetails,
  getCouplet,
} from "./js/data-model.js?v=35";
import {
  createMatchingSession,
  selectMatchingChoice,
} from "./js/matching-engine.js?v=24";
import {
  createChallengeUrl,
  createRandomDailyPick,
  getLesson,
  getRandomDailyPick,
  parseChallengeDay,
} from "./js/course-engine.js?v=25";
import {
  createOverviewIndexes,
  createOverviewRangeStarts,
  getOverviewPageSize,
  normalizeOverviewRangeStart,
  shuffleOverviewIndexes,
} from "./js/overview-layout.js?v=28";
import { isIndependentRecognitionConfident } from "./js/progress-engine.js?v=1";
import { createOverviewCell, createPassageCharacter } from "./js/render.js?v=29";
import {
  advanceAfterFeedback,
  createRecognitionSession,
  endRecognitionSession,
  getRecognitionStats,
  pauseRecognitionSession,
  resumeRecognitionSession,
  submitGridAnswer,
  submitRecallAnswer,
} from "./js/recognition-engine.js?v=1";
import {
  advanceCoupletOrderAfterFeedback,
  createCoupletOrderSession,
  getCoupletOrderStats,
  selectRandomCoupletIndexes,
  submitCoupletOrderAnswer,
} from "./js/couplet-order-engine.js?v=2";
import {
  describeCharacterDifference,
  getRecognitionColumns,
  renderCoupletOrderBoard,
  renderRecallChoices,
  renderRecognitionBoard,
} from "./js/recognition-renderer.js?v=1";
import {
  loadStateFromStorage,
  saveStateToStorage,
} from "./js/storage.js?v=27";
import { SoundEffects } from "./js/sound-effects.js?v=1";
import { createStore } from "./js/state.js";
import { createCoupletSpeechItems, TTSManager } from "./js/tts-manager.js?v=26";
import { formatDuration } from "./js/utils.js";

const OVERVIEW_COMPACT_QUERY =
  "(max-width: 660px), (max-width: 920px) and (max-height: 520px)";
const RECOGNITION_WIDE_QUERY = "(min-width: 760px) and (min-height: 660px)";
const WEAK_REVIEW_DURATION_MS = 60 * 1000;

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
const overviewCompactMedia = window.matchMedia(OVERVIEW_COMPACT_QUERY);
let overviewPageSize = getOverviewPageSize(overviewCompactMedia.matches);
let overviewShuffleKey = "";
let overviewShuffledIndexes = [];
let toastTimer = 0;
let matchingAdvanceTimer = 0;
let matchingTransitioning = false;
let weakReviewTimer = 0;
let recognitionFocusSlot = 0;
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
  todayRangePosition: document.querySelector("#today-range-position"),
  todayRangeReading: document.querySelector("#today-range-reading"),
  todayCharacters: document.querySelector("#today-characters"),
  todayMemoryScene: document.querySelector("#today-memory-scene"),
  todayMemoryArt: document.querySelector("#open-today-memory"),
  shuffleTodayLesson: document.querySelector("#shuffle-today-lesson"),
  shareTodayChallenge: document.querySelector("#share-today-challenge"),
  openTodayPassage: document.querySelector("#open-today-passage"),
  overviewRangeLabel: document.querySelector("#overview-range-label"),
  overviewRangeCaption: document.querySelector("#overview-range-caption"),
  overviewRange: document.querySelector("#overview-range"),
  overviewSearchForm: document.querySelector("#overview-search-form"),
  overviewSearch: document.querySelector("#overview-search"),
  overviewGrid: document.querySelector("#overview-grid"),
  overviewEmpty: document.querySelector("#overview-empty"),
  overviewResetFilters: document.querySelector("#overview-reset-filters"),
  overviewResultCount: document.querySelector("#overview-result-count"),
  overviewToggleMeaning: document.querySelector("#overview-toggle-meaning"),
  overviewShuffle: document.querySelector("#overview-shuffle"),
  overviewAnnouncement: document.querySelector("#overview-announcement"),
  clearSearch: document.querySelector("#clear-search"),
  previousCouplet: document.querySelector("#previous-couplet"),
  nextCouplet: document.querySelector("#next-couplet"),
  coupletPosition: document.querySelector("#couplet-position"),
  passageScreen: document.querySelector("#screen-passage"),
  passageCard: document.querySelector("#passage-card"),
  phraseGrids: Array.from(document.querySelectorAll("[data-phrase-grid]")),
  coupletMeaning: document.querySelector("#couplet-meaning"),
  passageCommentary: document.querySelector("#passage-commentary"),
  coupletExplanation: document.querySelector("#couplet-explanation"),
  playCouplet: document.querySelector("#play-couplet"),
  continuousListen: document.querySelector("#continuous-listen"),
  toggleReading: document.querySelector("#toggle-reading"),
  toggleMeaning: document.querySelector("#toggle-meaning"),
  selectedCharacter: document.querySelector("#selected-character"),
  selectedGloss: document.querySelector("#selected-gloss"),
  selectedReading: document.querySelector("#selected-reading"),
  selectedRadical: document.querySelector("#selected-radical"),
  selectedStrokes: document.querySelector("#selected-strokes"),
  relatedWordsSection: document.querySelector("#related-words-section"),
  selectedRelatedWords: document.querySelector("#selected-related-words"),
  openPassageMemory: document.querySelector("#open-passage-memory"),
  previousMemory: document.querySelector("#previous-memory"),
  nextMemory: document.querySelector("#next-memory"),
  memoryPosition: document.querySelector("#memory-position"),
  memoryImage: document.querySelector("#memory-image"),
  memoryClues: document.querySelector("#memory-clues"),
  memorySceneCopy: document.querySelector("#memory-scene-copy"),
  memoryProgress: document.querySelector("#memory-progress"),
  memoryInstruction: document.querySelector("#memory-instruction"),
  memoryPairs: document.querySelector("#memory-pairs"),
  memoryAnswer: document.querySelector("#memory-answer"),
  memoryAnswerLock: document.querySelector("#memory-answer-lock"),
  memoryAnswerHanja: document.querySelector("#memory-answer-hanja"),
  memoryAnswerReading: document.querySelector("#memory-answer-reading"),
  memoryAnswerMeaning: document.querySelector("#memory-answer-meaning"),
  memoryAnnouncement: document.querySelector("#memory-announcement"),
  resetMemoryClues: document.querySelector("#reset-memory-clues"),
  revealMemoryAnswer: document.querySelector("#reveal-memory-answer"),
  playMemoryCouplet: document.querySelector("#play-memory-couplet"),
  gridSetup: document.querySelector("#grid-setup"),
  gridSession: document.querySelector("#grid-session"),
  sessionResult: document.querySelector("#session-result"),
  startAdaptiveMatch: document.querySelector("#start-adaptive-match"),
  startOrderMatch: document.querySelector("#start-order-match"),
  startRandomMatch: document.querySelector("#start-random-match"),
  gridModeLabel: document.querySelector("#grid-mode-label"),
  gridProgressLabel: document.querySelector("#grid-progress-label"),
  gridSessionProgress: document.querySelector("#grid-session-progress"),
  gridComboLabel: document.querySelector("#grid-combo-label"),
  gridCombo: document.querySelector("#grid-combo"),
  gridAccuracy: document.querySelector("#grid-accuracy"),
  gridScore: document.querySelector("#grid-score"),
  targetPanel: document.querySelector("#target-panel"),
  targetType: document.querySelector("#target-type"),
  targetPrompt: document.querySelector("#target-prompt"),
  targetPosition: document.querySelector("#target-position"),
  continuousBoard: document.querySelector("#continuous-board"),
  matchingFeedback: document.querySelector("#matching-feedback"),
  feedbackMark: document.querySelector("#feedback-mark"),
  feedbackStatus: document.querySelector("#feedback-status"),
  feedbackAnswer: document.querySelector("#feedback-answer"),
  feedbackGloss: document.querySelector("#feedback-gloss"),
  feedbackComparison: document.querySelector("#feedback-comparison"),
  feedbackSelected: document.querySelector("#feedback-selected"),
  feedbackCorrect: document.querySelector("#feedback-correct"),
  feedbackDifference: document.querySelector("#feedback-difference"),
  feedbackContext: document.querySelector("#feedback-context"),
  openAnswerContext: document.querySelector("#open-answer-context"),
  recognitionRecall: document.querySelector("#recognition-recall"),
  recallCharacter: document.querySelector("#recall-character"),
  recallPrompt: document.querySelector("#recall-prompt"),
  recallChoices: document.querySelector("#recall-choices"),
  recognitionOrder: document.querySelector("#recognition-order"),
  orderInstruction: document.querySelector("#order-instruction"),
  orderAnswer: document.querySelector("#order-answer"),
  orderBoard: document.querySelector("#order-board"),
  pauseSession: document.querySelector("#pause-session"),
  recognitionPause: document.querySelector("#recognition-pause"),
  resumeSession: document.querySelector("#resume-session"),
  restartSession: document.querySelector("#restart-session"),
  endSession: document.querySelector("#end-session"),
  gridAnnouncement: document.querySelector("#grid-announcement"),
  resultLearnedLabel: document.querySelector("#result-learned-label"),
  resultLearned: document.querySelector("#result-learned"),
  resultAccuracy: document.querySelector("#result-accuracy"),
  resultComboLabel: document.querySelector("#result-combo-label"),
  resultCombo: document.querySelector("#result-combo"),
  resultScore: document.querySelector("#result-score"),
  resultTime: document.querySelector("#result-time"),
  resultConfident: document.querySelector("#result-confident"),
  resultCharacters: document.querySelector("#result-characters"),
  resultMode: document.querySelector("#result-mode"),
  resultTitle: document.querySelector("#result-title"),
  resultConfidentLabel: document.querySelector("#result-confident-label"),
  resultCharactersLabel: document.querySelector("#result-characters-label"),
  resultConfusionsLabel: document.querySelector("#result-confusions-label"),
  resultConfusions: document.querySelector("#result-confusions"),
  retryWrong: document.querySelector("#retry-wrong"),
  shareResult: document.querySelector("#share-result"),
  closeResult: document.querySelector("#close-result"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  voiceSelect: document.querySelector("#voice-select"),
  rateSelect: document.querySelector("#rate-select"),
  voiceNote: document.querySelector("#voice-note"),
  settingTapToSpeak: document.querySelector("#setting-tap-to-speak"),
  settingVibrate: document.querySelector("#setting-vibrate"),
  settingSoundEffects: document.querySelector("#setting-sound-effects"),
  toast: document.querySelector("#toast"),
};

const soundEffects = new SoundEffects({
  enabled: appState.settings.soundEffects,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});
const tts = new TTSManager();
tts.voiceURI = appState.settings.voiceURI;
tts.rate = appState.settings.rate;
tts.onVoicesChange = renderVoiceControls;
tts.onStateChange = function (nextSpeechState) {
  speechState = nextSpeechState;
  soundEffects.setSpeechActive(nextSpeechState.speaking);
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
  normalizeOverviewStateForViewport(appState.ui.selectedIndex);
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
  const starts = createOverviewRangeStarts(overviewPageSize, TOTAL_CHARACTERS);

  starts.forEach(function (start, rangeIndex) {
    const end = Math.min(start + overviewPageSize, TOTAL_CHARACTERS);
    const label = `${rangeIndex + 1}장 · ${start + 1}–${end}자`;
    const overviewOption = new Option(label, String(start));
    overviewFragment.append(overviewOption);
  });

  elements.overviewRange.replaceChildren(overviewFragment);
  elements.overviewRangeCaption.textContent = `${overviewPageSize}자 필사판`;
  elements.overviewRange.setAttribute(
    "aria-label",
    `${overviewPageSize}자 단위 필사판 선택`,
  );
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
    resetOverviewShuffle();
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
  elements.overviewShuffle.addEventListener("click", toggleOverviewShuffle);
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
  if (typeof overviewCompactMedia.addEventListener === "function") {
    overviewCompactMedia.addEventListener("change", handleOverviewViewportChange);
  } else {
    overviewCompactMedia.addListener(handleOverviewViewportChange);
  }

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
  elements.openPassageMemory.addEventListener("click", openCurrentMemoryStudy);
  elements.previousMemory.addEventListener("click", function () {
    moveMemoryCouplet(-1);
  });
  elements.nextMemory.addEventListener("click", function () {
    moveMemoryCouplet(1);
  });
  elements.memoryClues.addEventListener("click", toggleMemoryClue);
  elements.resetMemoryClues.addEventListener("click", resetMemoryClues);
  elements.revealMemoryAnswer.addEventListener("click", revealAllMemoryClues);
  elements.playMemoryCouplet.addEventListener("click", playMemoryCouplet);
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
  elements.startAdaptiveMatch.addEventListener("click", startAdaptiveMatchingGame);
  elements.startOrderMatch.addEventListener("click", startRandomOrderGame);
  elements.startRandomMatch.addEventListener("click", startRandomMatchingGame);
  elements.continuousBoard.addEventListener("click", handleMatchingChoiceClick);
  elements.continuousBoard.addEventListener("keydown", handleMatchingChoiceKeyboard);
  elements.recallChoices.addEventListener("click", handleRecallChoiceClick);
  elements.recallChoices.addEventListener("keydown", handleRecallChoiceKeyboard);
  elements.orderBoard.addEventListener("click", handleOrderChoiceClick);
  elements.orderBoard.addEventListener("keydown", handleOrderChoiceKeyboard);
  elements.pauseSession.addEventListener("click", pauseGridSession);
  elements.resumeSession.addEventListener("click", resumeGridSession);
  elements.openAnswerContext.addEventListener("click", openGridAnswerContext);
  elements.restartSession.addEventListener("click", restartGridSession);
  elements.endSession.addEventListener("click", exitGridSession);
  elements.retryWrong.addEventListener("click", retryWrongCharacters);
  elements.shareResult.addEventListener("click", shareRecognitionResult);
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
  elements.settingVibrate.addEventListener("change", function () {
    commit(function (state) {
      state.settings.vibrate = elements.settingVibrate.checked;
    });
  });
  elements.settingSoundEffects.addEventListener("change", function () {
    commit(function (state) {
      state.settings.soundEffects = elements.settingSoundEffects.checked;
    });
    soundEffects.setEnabled(appState.settings.soundEffects);
    if (appState.settings.soundEffects) soundEffects.play("tap");
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) return;
    stopAllSpeech();
    soundEffects.suspend();
    pauseGridSession({ render: false });
  });
  window.addEventListener("pagehide", function () {
    stopAllSpeech();
    soundEffects.suspend();
    pauseGridSession({ render: false });
  });
}

function renderApp() {
  renderModes();
  if (sharedChallengeDay !== null || appState.ui.mode === "today") renderTodayScreen();
  if (appState.ui.mode === "overview") renderOverview();
  if (appState.ui.mode === "passage") renderPassage();
  if (appState.ui.mode === "memory") renderMemoryMode();
  if (appState.ui.mode === "grid") renderGridScreen();
}

function renderModes() {
  const visibleMode = sharedChallengeDay !== null ? "today" : appState.ui.mode;
  setSceneQuarter(
    sharedChallengeDay !== null
      ? sharedChallengeDay
      : Math.floor(appState.ui.selectedIndex / 8),
  );
  document.body.dataset.screen = sharedChallengeDay !== null ? "challenge" : visibleMode;
  elements.modeButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === visibleMode));
  });
  elements.screens.forEach(function (screen) {
    screen.hidden = screen.dataset.screen !== visibleMode;
  });
}

function setSceneQuarter(dayIndex) {
  const quarter = Math.min(3, Math.max(0, Math.floor(dayIndex / 32)));
  document.body.dataset.sceneQuarter = String(quarter);
  elements.todayDashboard.dataset.courseQuarter = String(quarter);
}

function goHome(event) {
  event.preventDefault();
  stopAllSpeech();
  pauseGridForNavigation();
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
  if (!["today", "overview", "passage", "memory", "grid"].includes(mode)) return;
  if (sharedChallengeDay !== null) leaveChallengeView();
  if (mode !== appState.ui.mode) stopAllSpeech();
  if (appState.ui.mode === "grid" && mode !== "grid") pauseGridForNavigation();
  commit(function (state) {
    state.ui.mode = mode;
    state.ui.revealAnswer = false;
  });
  renderApp();
  if (mode === "grid") focusRecognitionInput();
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
  setSceneQuarter(dayIndex);
  elements.todayRangePosition.textContent = `${dayIndex * 8 + 1}–${dayIndex * 8 + 8}자`;
  elements.todayRangeReading.textContent = lesson.couplet.data.reading;
  elements.todayMemoryScene.textContent = lesson.couplet.data.meaning;
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
  showToast("랜덤 8자를 골랐습니다.");
}

function openTodayPassage() {
  const dayIndex = Number(elements.todayMemoryArt.dataset.dayIndex);
  if (!Number.isInteger(dayIndex)) return;
  openPassage(dayIndex * 8, false);
}

function openTodayMemoryStudy() {
  const dayIndex = Number(elements.todayMemoryArt.dataset.dayIndex);
  if (!Number.isInteger(dayIndex)) return;
  openMemory(dayIndex * 8);
}

function openCurrentMemoryStudy() {
  openMemory(appState.ui.selectedIndex);
}

function openMemory(index) {
  stopAllSpeech();
  memoryClueRevealed = new Set();
  renderedMemoryDay = -1;
  commit(function (state) {
    state.ui.selectedIndex = index;
    state.ui.rangeStart = normalizeOverviewRangeStart(index, overviewPageSize, TOTAL_CHARACTERS);
    state.ui.mode = "memory";
    state.ui.revealAnswer = false;
  });
  renderApp();
  window.scrollTo({ top: 0, behavior: "auto" });
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

function renderSharedMatchingChoices(container, session) {
  const fragment = document.createDocumentFragment();
  session.choiceIndexes.forEach(function (index) {
    const item = CHARACTERS[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shared-match-choice";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `후보 한자 ${item.character}`);
    button.innerHTML = `<span lang="zh-Hant">${item.character}</span>`;
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
    renderSharedMatchingChoices(elements.sharedChallengeBoard, sharedChallengeSession);
    updateSharedChallengeStatus();
  }
}

function startSharedChallenge() {
  const lesson = getLesson(sharedChallengeDay);
  sharedChallengeSession = createMatchingSession({ indexes: lesson.indexes, choiceCount: 4 });
  sharedChallengeStartedAt = Date.now();
  sharedChallengeWrong = 0;
  elements.sharedChallengeResult.hidden = true;
  elements.startSharedChallenge.hidden = true;
  elements.sharedChallengePlay.hidden = false;
  renderSharedMatchingChoices(elements.sharedChallengeBoard, sharedChallengeSession);
  updateSharedChallengeStatus();
  focusFirstSharedMatchingChoice();
}

function updateSharedChallengeStatus() {
  const session = sharedChallengeSession;
  if (!session) return;
  elements.sharedChallengeTarget.textContent = session.complete
    ? "완료"
    : CHARACTERS[session.targetIndex].contextHun;
  elements.sharedChallengeProgress.textContent = `${Math.min(8, session.questionPosition + 1)} / 8`;
  elements.sharedChallengeWrong.textContent = String(sharedChallengeWrong);
}

function handleSharedChallengeClick(event) {
  const button = event.target.closest(".shared-match-choice");
  if (!button || button.disabled || !sharedChallengeSession || sharedChallengeSession.complete) return;
  const selectedIndex = Number(button.dataset.index);
  if (!Number.isInteger(selectedIndex)) return;
  const targetIndex = sharedChallengeSession.targetIndex;
  const result = selectMatchingChoice(sharedChallengeSession, selectedIndex);
  if (!result.correct) {
    sharedChallengeWrong += 1;
    button.classList.remove("is-wrong");
    requestAnimationFrame(function () { button.classList.add("is-wrong"); });
    window.setTimeout(function () { button.classList.remove("is-wrong"); }, 260);
    updateSharedChallengeStatus();
    elements.sharedChallengeAnnouncement.textContent = "오답입니다. 같은 문제에서 다시 고를 수 있습니다.";
    return;
  }
  const item = CHARACTERS[targetIndex];
  sharedChallengeSession = result.session;
  button.classList.add("is-correct");
  elements.sharedChallengeBoard.querySelectorAll(".shared-match-choice").forEach(function (choice) {
    choice.disabled = true;
  });
  window.setTimeout(function () {
    if (result.completed) finishSharedChallenge();
    else {
      renderSharedMatchingChoices(elements.sharedChallengeBoard, sharedChallengeSession);
      updateSharedChallengeStatus();
      focusFirstSharedMatchingChoice();
    }
  }, 220);
  tts.speak(item.contextHun, { kind: "shared-matching-feedback", onError: handleTtsError });
  updateSharedChallengeStatus();
  elements.sharedChallengeAnnouncement.textContent = result.completed
    ? `정답, ${item.contextHun}. 도전을 완료했습니다.`
    : `정답, ${item.contextHun}. 다음 문제를 보여 줍니다.`;
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
  const button = event.target.closest(".shared-match-choice");
  if (!button) return;
  event.preventDefault();
  const buttons = Array.from(event.currentTarget.querySelectorAll(".shared-match-choice:not(:disabled)"));
  const current = buttons.indexOf(button);
  let next = current;
  if (event.key === "ArrowLeft") next -= 1;
  if (event.key === "ArrowRight") next += 1;
  if (event.key === "ArrowUp") next -= 2;
  if (event.key === "ArrowDown") next += 2;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  buttons[Math.min(buttons.length - 1, Math.max(0, next))]?.focus();
}

function focusFirstSharedMatchingChoice() {
  window.setTimeout(function () {
    elements.sharedChallengeBoard
      .querySelector(".shared-match-choice:not(:disabled)")
      ?.focus({ preventScroll: true });
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
  const rangeStart = normalizeOverviewRangeStart(
    appState.ui.rangeStart,
    overviewPageSize,
    TOTAL_CHARACTERS,
  );
  const baseIndexes = query
    ? findCharacterIndexes(query)
    : createOverviewIndexes(rangeStart, overviewPageSize, TOTAL_CHARACTERS);
  const shuffleKey = getOverviewShuffleKey(query, rangeStart);
  const isShuffled =
    overviewShuffleKey === shuffleKey &&
    overviewShuffledIndexes.length === baseIndexes.length;
  const indexes = isShuffled ? overviewShuffledIndexes : baseIndexes;
  if (!isShuffled) resetOverviewShuffle();
  const fragment = document.createDocumentFragment();

  indexes.forEach(function (index) {
    const item = CHARACTERS[index];
    fragment.append(
      createOverviewCell(item, {
        selected: index === appState.ui.selectedIndex,
        concealNumber: isShuffled,
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
  elements.overviewRange.value = String(rangeStart);
  elements.overviewRangeLabel.textContent = query
    ? `검색 · “${query}”`
    : `${rangeStart + 1}–${Math.min(rangeStart + overviewPageSize, TOTAL_CHARACTERS)} · 순지 필사판`;
  elements.overviewResultCount.textContent = query
    ? `${indexes.length}개 결과`
    : `${Math.floor(rangeStart / overviewPageSize) + 1} / ${Math.ceil(TOTAL_CHARACTERS / overviewPageSize)}장`;
  elements.overviewToggleMeaning.setAttribute(
    "aria-pressed",
    String(appState.settings.hideOverviewMeaning),
  );
  elements.overviewShuffle.classList.toggle("is-shuffled", isShuffled);
  elements.overviewShuffle.setAttribute("aria-pressed", String(isShuffled));
  elements.overviewShuffle.querySelector("span").textContent =
    isShuffled ? "원래 배열" : "랜덤 배열";
  elements.overviewShuffle.setAttribute(
    "aria-label",
    isShuffled ? "원래 순서로 돌아가기" : "현재 글자를 무작위로 배열",
  );
}

function getOverviewShuffleKey(query, rangeStart) {
  return `${overviewPageSize}:${rangeStart}:${query}`;
}

function resetOverviewShuffle() {
  overviewShuffleKey = "";
  overviewShuffledIndexes = [];
}

function toggleOverviewShuffle() {
  const query = appState.ui.search.trim();
  const rangeStart = normalizeOverviewRangeStart(
    appState.ui.rangeStart,
    overviewPageSize,
    TOTAL_CHARACTERS,
  );
  const indexes = query
    ? findCharacterIndexes(query)
    : createOverviewIndexes(rangeStart, overviewPageSize, TOTAL_CHARACTERS);
  const shuffleKey = getOverviewShuffleKey(query, rangeStart);
  const isShuffled =
    overviewShuffleKey === shuffleKey &&
    overviewShuffledIndexes.length === indexes.length;

  if (isShuffled) {
    resetOverviewShuffle();
    renderOverview();
    elements.overviewAnnouncement.textContent =
      `현재 ${indexes.length}자를 원래 순서로 되돌렸습니다. 순번도 다시 표시됩니다.`;
    return;
  }

  if (indexes.length < 2) {
    elements.overviewAnnouncement.textContent = "섞을 글자가 두 개 이상 필요합니다.";
    return;
  }
  overviewShuffleKey = shuffleKey;
  overviewShuffledIndexes = shuffleOverviewIndexes(indexes, secureRandomUnit);
  renderOverview();
  elements.overviewAnnouncement.textContent =
    `현재 ${indexes.length}자를 무작위로 배열했습니다. 순번은 숨겼으며 원래 배열 버튼으로 되돌릴 수 있습니다.`;
}

function normalizeOverviewStateForViewport(anchorIndex) {
  const rangeStart = normalizeOverviewRangeStart(
    anchorIndex,
    overviewPageSize,
    TOTAL_CHARACTERS,
  );
  if (rangeStart === appState.ui.rangeStart) return;
  commit(function (state) {
    state.ui.rangeStart = rangeStart;
  });
}

function handleOverviewViewportChange(event) {
  const nextPageSize = getOverviewPageSize(event.matches);
  if (nextPageSize === overviewPageSize) return;
  overviewPageSize = nextPageSize;
  overviewRevealedIndexes = new Set();
  resetOverviewShuffle();
  normalizeOverviewStateForViewport(appState.ui.selectedIndex);
  buildRangeControls();
  if (appState.ui.mode === "overview") renderOverview();
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
    state.ui.rangeStart = normalizeOverviewRangeStart(index, overviewPageSize, TOTAL_CHARACTERS);
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
    state.ui.rangeStart = normalizeOverviewRangeStart(index, overviewPageSize, TOTAL_CHARACTERS);
    state.ui.mode = "passage";
    state.ui.revealAnswer = false;
  });
  renderApp();
  if (speak) {
    tts.speak(CHARACTERS[index].contextHun, { kind: "character", onError: handleTtsError });
  }
}

function clearOverviewSearch() {
  resetOverviewShuffle();
  commit(function (state) {
    state.ui.search = "";
  });
  renderOverview();
}

function resetOverviewFilters() {
  resetOverviewShuffle();
  commit(function (state) {
    state.ui.search = "";
    state.ui.statusFilter = "all";
  });
  renderOverview();
}

function setOverviewRange(start) {
  stopAllSpeech();
  resetOverviewShuffle();
  const rangeStart = normalizeOverviewRangeStart(start, overviewPageSize, TOTAL_CHARACTERS);
  commit(function (state) {
    state.ui.rangeStart = rangeStart;
    state.ui.selectedIndex = rangeStart;
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
    const gridTop = elements.overviewGrid.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({
      top: Math.max(0, gridTop),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
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
  elements.coupletExplanation.textContent = couplet.explanation;

  [couplet.firstPhrase, couplet.secondPhrase].forEach(function (phrase, phraseOffset) {
    const grid = elements.phraseGrids[phraseOffset];
    const fragment = document.createDocumentFragment();
    phrase.items.forEach(function (item) {
      fragment.append(
        createPassageCharacter(item, {
          selected: item.index === selected.index,
          concealReading: appState.settings.hideReading,
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
    const characterReading = typeof word.characterReading === "string"
      ? word.characterReading.trim()
      : "";
    definition.textContent = characterReading && characterReading !== selected.reading
      ? `이 말에서는 ‘${characterReading}’로 읽음. ${word.definition}`
      : word.definition;
    entry.append(term, definition);
    relatedWordsFragment.append(entry);
  });
  elements.selectedRelatedWords.replaceChildren(relatedWordsFragment);
  elements.relatedWordsSection.hidden = details.relatedWords.length === 0;
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

function renderMemoryMode() {
  const couplet = getCouplet(CHARACTERS[appState.ui.selectedIndex].coupletIndex);
  const lesson = getLesson(couplet.index);
  if (renderedMemoryDay !== lesson.dayIndex) {
    renderedMemoryDay = lesson.dayIndex;
    memoryClueRevealed = new Set();
  }

  elements.memoryPosition.textContent = `${lesson.dayNumber} / 125`;
  elements.previousMemory.disabled = couplet.index === 0;
  elements.nextMemory.disabled = couplet.index === 124;
  applyMemoryAtlas(elements.memoryImage, lesson.dayIndex);
  elements.memorySceneCopy.textContent = lesson.memoryScene;

  const clueFragment = document.createDocumentFragment();
  const pairFragment = document.createDocumentFragment();
  for (let pairIndex = 0; pairIndex < 4; pairIndex += 1) {
    const pair = lesson.items.slice(pairIndex * 2, pairIndex * 2 + 2);
    const revealed = memoryClueRevealed.has(pairIndex);
    const charactersText = pair.map(function (item) { return item.character; }).join("");
    const readingsText = pair.map(function (item) { return item.contextHun; }).join(" · ");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-clue";
    button.dataset.memoryClue = String(pairIndex);
    button.dataset.position = String(pairIndex + 1);
    button.setAttribute("aria-pressed", String(revealed));
    button.setAttribute(
      "aria-label",
      revealed ? `${readingsText}, 다시 가리기` : `${pairIndex + 1}번째 그림 단서 보기`,
    );
    if (revealed) {
      const characters = document.createElement("strong");
      characters.lang = "zh-Hant";
      characters.textContent = charactersText;
      button.append(characters);
    } else {
      button.textContent = String(pairIndex + 1);
    }
    clueFragment.append(button);

    const item = document.createElement("li");
    item.className = `tacit-pair${revealed ? " is-revealed" : ""}`;
    const index = document.createElement("span");
    index.className = "tacit-pair__index";
    index.textContent = String(pairIndex + 1);
    const pairCharacters = document.createElement("strong");
    pairCharacters.lang = "zh-Hant";
    pairCharacters.textContent = revealed ? charactersText : "••";
    const pairReading = document.createElement("small");
    pairReading.textContent = revealed ? readingsText : "두 글자";
    item.append(index, pairCharacters, pairReading);
    pairFragment.append(item);
  }
  elements.memoryClues.replaceChildren(clueFragment);
  elements.memoryPairs.replaceChildren(pairFragment);

  const complete = memoryClueRevealed.size === 4;
  elements.memoryProgress.textContent = `${memoryClueRevealed.size} / 4`;
  elements.memoryInstruction.textContent = complete
    ? "네 장면 단서가 하나의 8자로 이어졌습니다."
    : memoryClueRevealed.size === 0
      ? "그림 속 번호를 눌러 두 글자씩 떠올려 보세요."
      : `남은 ${4 - memoryClueRevealed.size}개 단서를 그림에서 찾아보세요.`;
  elements.memoryAnswer.hidden = !complete;
  elements.memoryAnswerLock.hidden = complete;
  elements.memoryAnswerHanja.textContent = couplet.data.hanja;
  elements.memoryAnswerReading.textContent = couplet.data.reading;
  elements.memoryAnswerMeaning.textContent = couplet.data.meaning;
  elements.revealMemoryAnswer.disabled = complete;
  elements.revealMemoryAnswer.textContent = complete ? "8자 완성" : "정답 확인";
  renderSpeechState();
}

function toggleMemoryClue(event) {
  const button = event.target.closest("[data-memory-clue]");
  if (!button) return;
  const pairIndex = Number(button.dataset.memoryClue);
  if (!Number.isInteger(pairIndex) || pairIndex < 0 || pairIndex > 3) return;
  if (memoryClueRevealed.has(pairIndex)) memoryClueRevealed.delete(pairIndex);
  else memoryClueRevealed.add(pairIndex);
  renderMemoryMode();
  elements.memoryAnnouncement.textContent = memoryClueRevealed.has(pairIndex)
    ? `${pairIndex + 1}번째 두 글자 단서를 확인했습니다.`
    : `${pairIndex + 1}번째 두 글자 단서를 다시 가렸습니다.`;
  elements.memoryClues.querySelector(`[data-memory-clue="${pairIndex}"]`)?.focus();
}

function resetMemoryClues() {
  memoryClueRevealed = new Set();
  renderMemoryMode();
  elements.memoryAnnouncement.textContent = "모든 단서를 가리고 그림만 남겼습니다.";
  elements.memoryClues.querySelector("button")?.focus();
}

function revealAllMemoryClues() {
  memoryClueRevealed = new Set([0, 1, 2, 3]);
  renderMemoryMode();
  elements.memoryAnnouncement.textContent = "네 단서와 8자 원문을 모두 확인했습니다.";
}

function moveMemoryCouplet(delta) {
  stopAllSpeech();
  const current = CHARACTERS[appState.ui.selectedIndex].coupletIndex;
  const next = Math.min(124, Math.max(0, current + delta));
  memoryClueRevealed = new Set();
  renderedMemoryDay = -1;
  commit(function (state) {
    state.ui.selectedIndex = next * 8;
    state.ui.rangeStart = normalizeOverviewRangeStart(
      state.ui.selectedIndex,
      overviewPageSize,
      TOTAL_CHARACTERS,
    );
    state.ui.revealAnswer = false;
  });
  renderMemoryMode();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function playMemoryCouplet() {
  if (speechState.speaking && speechState.kind === "memory-couplet") {
    stopAllSpeech();
    return;
  }
  const couplet = getCouplet(CHARACTERS[appState.ui.selectedIndex].coupletIndex);
  tts.speakSequence(createCoupletSpeechItems(couplet.data), {
    kind: "memory-couplet",
    onError: handleTtsError,
  });
}

function renderPassageVisibility() {
  const concealMeaning = appState.settings.hideMeaning;
  elements.passageScreen.classList.toggle("is-reading-hidden", appState.settings.hideReading);
  elements.passageScreen.classList.toggle("is-meaning-hidden", appState.settings.hideMeaning);
  elements.passageScreen.classList.remove("is-answer-revealed");
  elements.toggleReading.setAttribute("aria-pressed", String(appState.settings.hideReading));
  elements.toggleMeaning.setAttribute("aria-pressed", String(appState.settings.hideMeaning));
  elements.coupletMeaning.setAttribute("aria-hidden", String(concealMeaning));
  elements.passageCommentary.setAttribute("aria-hidden", String(concealMeaning));
  elements.selectedGloss.removeAttribute("aria-hidden");
  elements.selectedReading.removeAttribute("aria-hidden");
  elements.selectedRelatedWords
    .querySelectorAll(".related-word__definition")
    .forEach(function (definition) {
      definition.removeAttribute("aria-hidden");
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
  focusPassageCharacter(index);
  if (appState.settings.tapToSpeak) {
    tts.speak(CHARACTERS[index].contextHun, { kind: "character", onError: handleTtsError });
  }
}

function focusPassageCharacter(index) {
  window.setTimeout(function () {
    const button = elements.passageScreen.querySelector(`.phrase-character[data-index="${index}"]`);
    if (button) button.focus({ preventScroll: true });
  }, 0);
}

function handleFourGridKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const button = event.target.closest(".phrase-character");
  if (!button) return;
  event.preventDefault();
  const buttons = elements.phraseGrids.flatMap(function (grid) {
    return Array.from(grid.querySelectorAll(".phrase-character"));
  });
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
    state.ui.rangeStart = normalizeOverviewRangeStart(
      state.ui.selectedIndex,
      overviewPageSize,
      TOTAL_CHARACTERS,
    );
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
  tts.speakSequence(createCoupletSpeechItems(couplet.data), {
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
  const continuousSpeechItems = COUPLETS.slice(startCouplet).flatMap(function (couplet) {
    return createCoupletSpeechItems(couplet);
  });
  passageContinuous = true;
  elements.continuousListen.setAttribute("aria-pressed", "true");
  tts.speakSequence(
    continuousSpeechItems,
    {
      kind: "continuous",
      onItem: function (position) {
        if (position % 2 !== 0) return;
        const coupletIndex = startCouplet + (position / 2);
        commit(function (state) {
          state.ui.selectedIndex = coupletIndex * 8;
          state.ui.rangeStart = normalizeOverviewRangeStart(
            state.ui.selectedIndex,
            overviewPageSize,
            TOTAL_CHARACTERS,
          );
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
  if (isEndedGridSession(session)) {
    elements.gridSetup.hidden = true;
    elements.gridSession.hidden = true;
    elements.sessionResult.hidden = false;
    renderSessionResult(session);
    return;
  }
  if (isRecognitionSession(session) || isCoupletOrderSession(session)) {
    elements.gridSetup.hidden = true;
    elements.sessionResult.hidden = true;
    elements.gridSession.hidden = false;
    if (isRecognitionSession(session)) renderRecognitionSession(session);
    else renderCoupletOrderSession(session);
    scheduleWeakReviewEnd();
    return;
  }
  elements.gridSetup.hidden = false;
  elements.gridSession.hidden = true;
  elements.sessionResult.hidden = true;
}

function startAdaptiveMatchingGame() {
  startRecognitionGame("adaptive");
}

function startRandomOrderGame() {
  stopAllSpeech();
  clearGridTimers();
  recognitionFocusSlot = 0;
  const session = createCoupletOrderSession({
    coupletIndexes: selectRandomCoupletIndexes(COUPLETS.length, 10),
  });
  commit(function (state) {
    state.grid.session = session;
    state.grid.lastCursor = 0;
  });
  soundEffects.play("tap");
  renderGridScreen();
  focusRecognitionInput();
}

function startRandomMatchingGame() {
  startRecognitionGame("random1000");
}

function startRecognitionGame(mode, weakIndexes = []) {
  stopAllSpeech();
  clearGridTimers();
  recognitionFocusSlot = 0;
  const boardSize = window.matchMedia(RECOGNITION_WIDE_QUERY).matches ? 25 : 16;
  const session = createRecognitionSession({
    mode,
    boardSize,
    characterData: CHARACTERS,
    progress: appState.progress,
    confusionPairs: appState.grid.confusionPairs,
    weakIndexes,
  });
  commit(function (state) {
    state.grid.session = session;
    state.grid.lastCursor = 0;
    state.settings.boardSize = boardSize;
  });
  soundEffects.play("tap");
  renderGridScreen();
  focusRecognitionInput();
  scheduleWeakReviewEnd();
}

function isRecognitionSession(session) {
  return Boolean(session && session.kind === "recognition-grid" && session.phase !== "ended");
}

function isCoupletOrderSession(session) {
  return Boolean(session && session.kind === "couplet-order" && session.phase !== "ended");
}

function isEndedGridSession(session) {
  return Boolean(
    session &&
    ["recognition-grid", "couplet-order"].includes(session.kind) &&
    session.phase === "ended",
  );
}

function getRecognitionModeLabel(mode) {
  return {
    adaptive: "맞춤 연습",
    random1000: "완전 랜덤",
    weak: "취약 글자 1분 복습",
  }[mode] || "맞춤 연습";
}

function renderRecognitionSession(session) {
  const stats = getRecognitionStats(session);
  const viewPhase = session.phase === "paused" ? session.pausedFromPhase : session.phase;
  const feedbackSource = session.feedback && session.feedback.source;
  const showsGrid = viewPhase === "question" || (viewPhase === "feedback" && feedbackSource === "grid");
  const showsRecall = viewPhase === "recall" || (viewPhase === "feedback" && feedbackSource === "recall");
  const paused = session.phase === "paused";

  elements.gridModeLabel.textContent = getRecognitionModeLabel(session.mode);
  elements.gridProgressLabel.textContent = "문제";
  elements.gridSessionProgress.textContent = String(stats.answeredGridCount);
  elements.gridComboLabel.textContent = "콤보";
  elements.gridCombo.textContent = `×${stats.combo}`;
  elements.gridAccuracy.textContent = stats.answeredGridCount > 0
    ? `${Math.round(stats.accuracy * 100)}%`
    : "—";
  elements.gridScore.textContent = stats.score.toLocaleString("ko-KR");
  elements.pauseSession.hidden = false;
  elements.pauseSession.disabled = paused;
  elements.pauseSession.setAttribute("aria-pressed", String(paused));
  elements.gridSession.classList.toggle("is-paused", paused);
  elements.gridSession.classList.toggle("is-locked", session.inputLocked);
  elements.recognitionPause.hidden = !paused;
  elements.targetPanel.hidden = !showsGrid;
  elements.continuousBoard.hidden = !showsGrid;
  elements.recognitionRecall.hidden = !showsRecall;
  elements.recognitionOrder.hidden = true;
  elements.matchingFeedback.hidden = viewPhase !== "feedback";

  if (showsGrid) {
    elements.targetType.textContent = session.prompt.type === "gloss-to-character"
      ? "뜻에서 찾기"
      : "훈음에서 찾기";
    elements.targetPrompt.textContent = session.prompt.text;
    elements.targetPosition.textContent = session.currentReview
      ? "1,000자 전범위 · 지연 복습"
      : "1,000자 전범위";
    const gridFeedback = viewPhase === "feedback" && feedbackSource === "grid"
      ? session.feedback
      : null;
    const focusIndex = session.boardIndexes[
      Math.min(session.boardSize - 1, Math.max(0, recognitionFocusSlot))
    ];
    renderRecognitionBoard(elements.continuousBoard, {
      boardIndexes: session.boardIndexes,
      characters: CHARACTERS,
      selectedIndex: gridFeedback ? gridFeedback.selectedIndex : null,
      correctIndex: gridFeedback ? gridFeedback.targetIndex : null,
      changedSlot: viewPhase === "question" ? session.lastBoardChange.replacedSlots[0] : -1,
      disabled: session.inputLocked,
      focusIndex,
    });
    elements.continuousBoard.classList.toggle(
      "is-shuffling",
      viewPhase === "question" && session.lastBoardChange.shuffled,
    );
  }

  if (showsRecall && session.recall) {
    const recallFeedback = viewPhase === "feedback" && feedbackSource === "recall"
      ? session.feedback
      : null;
    const selectedChoice = recallFeedback
      ? session.recall.choices.findIndex(function (choice) {
          return choice.index === recallFeedback.selectedIndex;
        })
      : -1;
    const correctChoice = recallFeedback
      ? session.recall.choices.findIndex(function (choice) {
          return choice.index === session.recall.correctIndex;
        })
      : -1;
    elements.recallCharacter.textContent = CHARACTERS[session.recall.targetIndex].character;
    elements.recallPrompt.textContent = session.recall.type === "character-to-meaning"
      ? "이 글자의 뜻은?"
      : "이 글자의 훈음은?";
    renderRecallChoices(elements.recallChoices, session.recall, {
      selectedChoice,
      correctChoice,
      disabled: session.inputLocked,
    });
  }

  if (viewPhase === "feedback") renderRecognitionFeedback(session);
  setRecognitionPlayInert(paused);
}

function handleMatchingChoiceClick(event) {
  const button = event.target.closest(".recognition-cell");
  if (!button || button.disabled || matchingTransitioning) return;
  const slot = Number(button.dataset.slot);
  if (!Number.isInteger(slot)) return;
  answerMatchingChoice(slot);
}

function answerMatchingChoice(selectedSlot) {
  const session = appState.grid.session;
  if (!isRecognitionSession(session) || session.phase !== "question") return;
  const result = submitGridAnswer(session, selectedSlot, {
    characterData: CHARACTERS,
    progress: appState.progress,
    confusionPairs: appState.grid.confusionPairs,
  });
  if (!result.accepted) return;
  recognitionFocusSlot = selectedSlot;

  commit(function (state) {
    state.progress = result.progress;
    state.grid.confusionPairs = result.confusionPairs;
    state.grid.session = result.session;
    state.grid.lastCursor = selectedSlot;
  });

  matchingTransitioning = true;
  const item = CHARACTERS[result.attempt.targetIndex];
  soundEffects.play(result.correct ? "correct" : "wrong");
  renderGridScreen();
  if (
    result.correct &&
    appState.settings.vibrate &&
    navigator.vibrate &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigator.vibrate(10);
  }
  elements.gridAnnouncement.textContent = result.correct
    ? `정답, ${item.contextHun}. 잠시 뒤 다음 문제로 이어집니다.`
    : `오답입니다. 정답은 ${item.contextHun}입니다. 몇 문제 뒤 다시 나옵니다.`;
  scheduleGridAdvance(result.correct ? 950 : 1300);
}

function handleRecallChoiceClick(event) {
  const button = event.target.closest("button[data-choice]");
  const session = appState.grid.session;
  if (!button || button.disabled || !isRecognitionSession(session) || session.phase !== "recall") return;
  const choice = session.recall.choices[Number(button.dataset.choice)];
  if (!choice) return;
  const result = submitRecallAnswer(session, choice.index, {
    characterData: CHARACTERS,
    progress: appState.progress,
    confusionPairs: appState.grid.confusionPairs,
  });
  if (!result.accepted) return;
  commit(function (state) {
    state.progress = result.progress;
    state.grid.confusionPairs = result.confusionPairs;
    state.grid.session = result.session;
  });
  matchingTransitioning = true;
  soundEffects.play(result.correct ? "correct" : "wrong");
  renderGridScreen();
  const item = CHARACTERS[result.attempt.targetIndex];
  elements.gridAnnouncement.textContent = result.correct
    ? `역방향 확인 정답, ${item.contextHun}.`
    : `역방향 확인 오답입니다. ${item.contextHun}을 기억해 두세요.`;
  scheduleGridAdvance(result.correct ? 900 : 1200);
}

function handleOrderChoiceClick(event) {
  const button = event.target.closest(".recognition-cell");
  const session = appState.grid.session;
  if (!button || button.disabled || matchingTransitioning || !isCoupletOrderSession(session)) return;
  const selectedIndex = Number(button.dataset.index);
  if (!Number.isInteger(selectedIndex)) return;
  const result = submitCoupletOrderAnswer(session, selectedIndex, {
    progress: appState.progress,
  });
  if (!result.accepted) return;
  recognitionFocusSlot = Number(button.dataset.slot) || 0;
  commit(function (state) {
    state.progress = result.progress;
    state.grid.session = result.session;
    state.grid.lastCursor = recognitionFocusSlot;
  });
  matchingTransitioning = true;
  soundEffects.play(
    !result.correct
      ? "wrong"
      : result.sessionCompleted
        ? "game-complete"
        : result.roundCompleted
          ? "round-complete"
          : "correct",
  );
  renderGridScreen();
  const expected = CHARACTERS[result.attempt.expectedIndex];
  elements.gridAnnouncement.textContent = result.correct
    ? `맞았습니다. ${expected.contextHun}.`
    : `순서가 다릅니다. 다음 글자는 ${expected.contextHun}입니다.`;
  scheduleGridAdvance(result.correct ? 520 : 950);
}

function scheduleGridAdvance(delay) {
  window.clearTimeout(matchingAdvanceTimer);
  matchingAdvanceTimer = window.setTimeout(function () {
    const session = appState.grid.session;
    if (isRecognitionSession(session) && session.phase === "feedback") {
      const next = advanceAfterFeedback(session, {
        characterData: CHARACTERS,
        progress: appState.progress,
        confusionPairs: appState.grid.confusionPairs,
      });
      commit(function (state) {
        state.grid.session = next;
        state.grid.lastCursor = next.targetSlot;
      });
      recognitionFocusSlot = Math.min(next.boardSize - 1, Math.max(0, next.targetSlot));
    } else if (isCoupletOrderSession(session) && session.phase === "feedback") {
      const next = advanceCoupletOrderAfterFeedback(session);
      commit(function (state) {
        state.grid.session = next;
        if (next.phase === "ended") appendRecentRun(state, next);
      });
      if (next.roundIndex !== session.roundIndex) {
        recognitionFocusSlot = 0;
      }
    }
    matchingTransitioning = false;
    renderGridScreen();
    focusRecognitionInput();
  }, delay);
}

function renderRecognitionFeedback(session) {
  const feedback = session.feedback;
  if (!feedback) return;
  const target = CHARACTERS[feedback.targetIndex];
  const selected = CHARACTERS[feedback.selectedIndex];
  const correct = feedback.correct;
  elements.matchingFeedback.classList.toggle("is-wrong", !correct);
  elements.feedbackMark.textContent = correct ? "✓" : "×";
  elements.feedbackStatus.textContent = correct ? "정답" : "오답 · 정답 확인";
  elements.feedbackAnswer.textContent = `${target.character} · ${target.contextHun}`;
  elements.feedbackGloss.textContent = target.gloss || target.meaning || "";
  elements.feedbackComparison.hidden = correct;
  if (!correct && selected) {
    elements.feedbackSelected.textContent = `${selected.character} · ${selected.contextHun}`;
    elements.feedbackCorrect.textContent = `${target.character} · ${target.contextHun}`;
    elements.feedbackDifference.textContent = describeCharacterDifference(target, selected);
  }
  const couplet = getCouplet(target.coupletIndex);
  elements.feedbackContext.textContent = couplet.data.hanja;
  elements.openAnswerContext.hidden = false;
  elements.openAnswerContext.disabled = false;
}

function renderCoupletOrderSession(session) {
  const stats = getCoupletOrderStats(session);
  const couplet = getCouplet(session.coupletIndex);
  elements.gridModeLabel.textContent = "랜덤 8자 순서";
  elements.gridProgressLabel.textContent = "세트";
  elements.gridSessionProgress.textContent = `${stats.round} / ${stats.roundCount}`;
  elements.gridComboLabel.textContent = "현재 순서";
  elements.gridCombo.textContent = `${stats.position} / ${stats.total}`;
  elements.gridAccuracy.textContent = session.correctCount + session.wrongCount > 0
    ? `${Math.round(stats.accuracy * 100)}%`
    : "—";
  elements.gridScore.textContent = (session.correctCount * 100).toLocaleString("ko-KR");
  elements.pauseSession.hidden = true;
  elements.gridSession.classList.remove("is-paused");
  elements.gridSession.classList.toggle("is-locked", session.inputLocked);
  elements.recognitionPause.hidden = true;
  elements.targetPanel.hidden = true;
  elements.continuousBoard.hidden = true;
  elements.recognitionRecall.hidden = true;
  elements.recognitionOrder.hidden = false;
  elements.orderInstruction.textContent = `${stats.round}세트 / ${stats.roundCount} · 원문 순서대로 누르세요`;
  elements.orderAnswer.textContent = session.placedIndexes.map(function (index) {
    return CHARACTERS[index].character;
  }).join("");
  const wrongIndex = session.phase === "feedback" && !session.feedback.correct
    ? session.feedback.selectedIndex
    : null;
  renderCoupletOrderBoard(elements.orderBoard, session, CHARACTERS, {
    wrongIndex,
    disabled: session.inputLocked,
    focusSlot: recognitionFocusSlot,
  });
  elements.matchingFeedback.hidden = session.phase !== "feedback";
  if (session.phase === "feedback") {
    const target = CHARACTERS[session.feedback.expectedIndex];
    const selected = CHARACTERS[session.feedback.selectedIndex];
    elements.matchingFeedback.classList.toggle("is-wrong", !session.feedback.correct);
    elements.feedbackMark.textContent = session.feedback.correct ? "✓" : "×";
    elements.feedbackStatus.textContent = session.feedback.correct ? "순서 정답" : "다음 글자 확인";
    elements.feedbackAnswer.textContent = `${target.character} · ${target.contextHun}`;
    elements.feedbackGloss.textContent = `${stats.round}세트 · ${session.feedback.position + 1}번째 글자`;
    elements.feedbackComparison.hidden = session.feedback.correct;
    if (!session.feedback.correct) {
      elements.feedbackSelected.textContent = `${selected.character} · ${selected.contextHun}`;
      elements.feedbackCorrect.textContent = `${target.character} · ${target.contextHun}`;
      elements.feedbackDifference.textContent = "원문 순서에서 다음에 오는 글자를 다시 확인해 보세요.";
    }
    elements.feedbackContext.textContent = couplet.data.hanja;
    elements.openAnswerContext.hidden = true;
  }
  setRecognitionPlayInert(false);
}

function pauseGridForNavigation() {
  const session = appState.grid.session;
  if (!isRecognitionSession(session) || session.phase === "paused") return;
  clearGridTimers();
  commit(function (state) {
    state.grid.session = pauseRecognitionSession(state.grid.session, {
      characterData: CHARACTERS,
    });
  });
}

function pauseGridSession(options = {}) {
  const shouldRender = !options || options.render !== false;
  const session = appState.grid.session;
  if (!isRecognitionSession(session) || session.phase === "paused") return;
  clearGridTimers();
  commit(function (state) {
    state.grid.session = pauseRecognitionSession(state.grid.session, {
      characterData: CHARACTERS,
    });
  });
  if (shouldRender) {
    renderGridScreen();
    elements.resumeSession.focus({ preventScroll: true });
  }
}

function resumeGridSession() {
  const session = appState.grid.session;
  if (!isRecognitionSession(session) || session.phase !== "paused") return;
  const next = resumeRecognitionSession(session, { characterData: CHARACTERS });
  commit(function (state) {
    state.grid.session = next;
  });
  renderGridScreen();
  if (next.phase === "feedback") scheduleGridAdvance(next.feedback.correct ? 900 : 1200);
  focusRecognitionInput();
  scheduleWeakReviewEnd();
}

function endGridSession() {
  const session = appState.grid.session;
  if (!isRecognitionSession(session)) return;
  clearGridTimers();
  const ended = endRecognitionSession(session, { characterData: CHARACTERS });
  commit(function (state) {
    state.grid.session = ended;
    appendRecentRun(state, ended);
  });
  renderGridScreen();
  focusRecognitionInput();
}

function exitGridSession() {
  const session = appState.grid.session;
  if (!isRecognitionSession(session) && !isCoupletOrderSession(session)) return;
  if (isRecognitionSession(session)) {
    endGridSession();
    return;
  }
  clearGridTimers();
  commit(function (state) {
    state.grid.session = null;
  });
  soundEffects.play("tap");
  renderGridScreen();
  elements.startOrderMatch.focus({ preventScroll: true });
}

function renderSessionResult(session) {
  const orderMode = session.kind === "couplet-order";
  const stats = orderMode ? getCoupletOrderStats(session) : getRecognitionStats(session);
  const wrongIndexes = getSessionWrongIndexes(session);
  const confidentIndexes = orderMode ? [] : getSessionConfidentIndexes(session);
  elements.resultMode.textContent = orderMode ? "랜덤 8자 순서 완료" : `${getRecognitionModeLabel(session.mode)} 기록`;
  elements.resultTitle.textContent = orderMode ? "10세트를 모두 완성했습니다" : "이번 연습에서 달라진 것";
  elements.resultLearnedLabel.textContent = orderMode ? "완료 세트" : "푼 문제";
  elements.resultLearned.textContent = orderMode
    ? `${stats.completedRounds} / ${stats.roundCount}`
    : String(stats.answeredGridCount);
  elements.resultAccuracy.textContent = `${Math.round(stats.accuracy * 100)}%`;
  elements.resultComboLabel.textContent = orderMode ? "맞춘 글자" : "최고 콤보";
  elements.resultCombo.textContent = orderMode ? String(stats.correctCount) : `×${stats.bestCombo}`;
  elements.resultScore.textContent = (orderMode ? session.correctCount * 100 : stats.score).toLocaleString("ko-KR");
  elements.resultTime.textContent = formatDuration(stats.elapsedMs);
  elements.resultConfidentLabel.textContent = orderMode ? "완성한 순서" : "확실해진 글자";
  elements.resultCharactersLabel.textContent = orderMode ? "헷갈린 글자" : "다시 나올 글자";
  elements.resultConfusionsLabel.textContent = orderMode ? "다시 볼 비교" : "새로 발견한 혼동";
  if (orderMode) {
    renderOrderCompletion(elements.resultConfident, stats);
  } else {
    renderResultCharacters(elements.resultConfident, confidentIndexes, "아직 조건을 모두 채운 글자는 없습니다.");
  }
  renderResultCharacters(
    elements.resultCharacters,
    wrongIndexes,
    orderMode ? "틀린 순서 없이 완주했습니다." : "다시 나올 글자가 없습니다.",
  );
  renderResultConfusions(session);
  elements.retryWrong.disabled = wrongIndexes.length === 0;
  elements.resultTitle.tabIndex = -1;
}

function retryWrongCharacters() {
  const session = appState.grid.session;
  if (!isEndedGridSession(session)) return;
  const indexes = getSessionWrongIndexes(session);
  if (indexes.length === 0) return;
  startRecognitionGame("weak", indexes);
}

function restartGridSession() {
  const session = appState.grid.session;
  if (!isEndedGridSession(session)) return;
  if (session.kind === "couplet-order") {
    startRandomOrderGame();
    return;
  }
  startRecognitionGame(session.mode, session.weakIndexes);
}

function closeSessionResult() {
  clearGridTimers();
  commit(function (state) {
    state.grid.session = null;
  });
  renderGridScreen();
  elements.startAdaptiveMatch.focus({ preventScroll: true });
}

function handleMatchingChoiceKeyboard(event) {
  const session = appState.grid.session;
  if (!isRecognitionSession(session)) return;
  moveRecognitionFocus(event, elements.continuousBoard, getRecognitionColumns(session.boardSize));
}

function handleRecallChoiceKeyboard(event) {
  moveRecognitionFocus(event, elements.recallChoices, 2, "button:not(:disabled)");
}

function handleOrderChoiceKeyboard(event) {
  moveRecognitionFocus(event, elements.orderBoard, 4);
}

function moveRecognitionFocus(event, container, columns, selector = ".recognition-cell:not(:disabled)") {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const button = event.target.closest("button");
  if (!button) return;
  const buttons = Array.from(container.querySelectorAll(selector));
  const current = buttons.indexOf(button);
  if (current < 0 || buttons.length === 0) return;
  event.preventDefault();
  let next = current;
  if (event.key === "ArrowLeft") next -= 1;
  if (event.key === "ArrowRight") next += 1;
  if (event.key === "ArrowUp") next -= columns;
  if (event.key === "ArrowDown") next += columns;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  next = Math.min(buttons.length - 1, Math.max(0, next));
  buttons.forEach(function (candidate, index) { candidate.tabIndex = index === next ? 0 : -1; });
  buttons[next].focus({ preventScroll: true });
  if (Number.isInteger(Number(buttons[next].dataset.slot))) {
    recognitionFocusSlot = Number(buttons[next].dataset.slot);
  }
}

function focusRecognitionInput() {
  window.setTimeout(function () {
    const session = appState.grid.session;
    if (isEndedGridSession(session)) {
      elements.resultTitle.focus({ preventScroll: true });
      return;
    }
    if (isRecognitionSession(session)) {
      if (session.phase === "paused") {
        elements.resumeSession.focus({ preventScroll: true });
        return;
      }
      if (session.phase === "recall") {
        elements.recallChoices.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
        return;
      }
      elements.continuousBoard.querySelector(".recognition-cell[tabindex='0']:not(:disabled)")
        ?.focus({ preventScroll: true });
      return;
    }
    if (isCoupletOrderSession(session)) {
      elements.orderBoard.querySelector(".recognition-cell:not(:disabled)")?.focus({ preventScroll: true });
    }
  }, 0);
}

function setRecognitionPlayInert(paused) {
  [
    elements.targetPanel,
    elements.continuousBoard,
    elements.recognitionRecall,
    elements.recognitionOrder,
    elements.matchingFeedback,
  ].forEach(function (element) {
    element.inert = paused;
    if (paused) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  });
}

function openGridAnswerContext() {
  const session = appState.grid.session;
  if (!isRecognitionSession(session) || !session.feedback) return;
  const targetIndex = session.feedback.targetIndex;
  pauseGridForNavigation();
  commit(function (state) {
    state.ui.selectedIndex = targetIndex;
    state.ui.rangeStart = normalizeOverviewRangeStart(
      targetIndex,
      overviewPageSize,
      TOTAL_CHARACTERS,
    );
    state.ui.revealAnswer = false;
    state.ui.mode = "passage";
  });
  renderApp();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function getSessionWrongIndexes(session) {
  const values = (Array.isArray(session && session.history) ? session.history : [])
    .filter(function (attempt) { return attempt && attempt.correct === false; })
    .map(function (attempt) {
      return Number.isInteger(attempt.targetIndex) ? attempt.targetIndex : attempt.expectedIndex;
    })
    .filter(Number.isInteger);
  return Array.from(new Set(values));
}

function getSessionConfidentIndexes(session) {
  const correctIndexes = Array.from(new Set(
    (Array.isArray(session.history) ? session.history : [])
      .filter(function (attempt) { return attempt.kind === "grid" && attempt.correct; })
      .map(function (attempt) { return attempt.targetIndex; }),
  ));
  return correctIndexes.filter(function (index) {
    return isIndependentRecognitionConfident(appState.progress[index], {
      recentConfusionCount: getCharacterConfusionCount(index),
    });
  });
}

function getCharacterConfusionCount(index) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return Object.values(appState.grid.confusionPairs || {}).reduce(function (sum, pair) {
    const lastAt = pair && pair.lastAt ? new Date(pair.lastAt).getTime() : 0;
    return sum + (
      pair &&
      lastAt >= cutoff &&
      (pair.correctIndex === index || pair.selectedIndex === index)
        ? Math.max(0, Number(pair.count) || 0)
        : 0
    );
  }, 0);
}

function renderResultCharacters(container, indexes, emptyText) {
  const fragment = document.createDocumentFragment();
  indexes.slice(0, 12).forEach(function (index) {
    const item = CHARACTERS[index];
    if (!item) return;
    const span = document.createElement("span");
    const glyph = document.createElement("strong");
    const reading = document.createElement("small");
    span.className = "result-character";
    span.title = item.contextHun;
    glyph.lang = "zh-Hant";
    glyph.textContent = item.character;
    reading.textContent = item.reading;
    span.append(glyph, reading);
    fragment.append(span);
  });
  if (fragment.childNodes.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = emptyText;
    fragment.append(empty);
  }
  container.replaceChildren(fragment);
}

function renderOrderCompletion(container, stats) {
  const summary = document.createElement("p");
  summary.className = "recognition-order-summary";
  summary.textContent = `${stats.completedRounds}개 8자 세트 · ${stats.totalCharacters}글자 완성`;
  container.replaceChildren(summary);
}

function renderResultConfusions(session) {
  const pairs = [];
  const seen = new Set();
  (Array.isArray(session.history) ? session.history : []).forEach(function (attempt) {
    const correctIndex = attempt.kind === "couplet-order"
      ? attempt.expectedIndex
      : attempt.targetIndex;
    if (
      !["grid", "couplet-order"].includes(attempt.kind) ||
      attempt.correct ||
      !Number.isInteger(correctIndex) ||
      !Number.isInteger(attempt.selectedIndex)
    ) return;
    const key = `${correctIndex}:${attempt.selectedIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([correctIndex, attempt.selectedIndex]);
  });
  const fragment = document.createDocumentFragment();
  pairs.slice(-4).forEach(function ([correctIndex, selectedIndex]) {
    const correct = CHARACTERS[correctIndex];
    const selected = CHARACTERS[selectedIndex];
    const row = document.createElement("div");
    const left = document.createElement("strong");
    const arrow = document.createElement("span");
    const right = document.createElement("strong");
    row.className = "recognition-confusion";
    left.textContent = `${selected.character} ${selected.contextHun}`;
    arrow.textContent = "↔";
    right.textContent = `${correct.character} ${correct.contextHun}`;
    row.append(left, arrow, right);
    fragment.append(row);
  });
  if (fragment.childNodes.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "이번에는 새 혼동이 없었습니다.";
    fragment.append(empty);
  }
  elements.resultConfusions.replaceChildren(fragment);
}

function appendRecentRun(state, session) {
  const orderMode = session.kind === "couplet-order";
  const stats = orderMode ? getCoupletOrderStats(session) : getRecognitionStats(session);
  state.grid.recentRuns = [
    ...(state.grid.recentRuns || []),
    {
      mode: orderMode ? "order10" : session.mode,
      answeredCount: orderMode ? stats.completedCharacters : stats.answeredGridCount,
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      bestCombo: orderMode ? stats.completedRounds : stats.bestCombo,
      score: orderMode ? session.correctCount * 100 : stats.score,
      duration: stats.elapsedMs,
      completedAt: session.endedAt,
    },
  ].slice(-30);
}

function scheduleWeakReviewEnd() {
  window.clearTimeout(weakReviewTimer);
  weakReviewTimer = 0;
  const session = appState.grid.session;
  if (!isRecognitionSession(session) || session.mode !== "weak" || session.phase === "paused") return;
  const remaining = WEAK_REVIEW_DURATION_MS - getRecognitionStats(session).elapsedMs;
  if (remaining <= 0) {
    endGridSession();
    return;
  }
  weakReviewTimer = window.setTimeout(endGridSession, remaining);
}

function clearGridTimers() {
  window.clearTimeout(matchingAdvanceTimer);
  window.clearTimeout(weakReviewTimer);
  matchingAdvanceTimer = 0;
  weakReviewTimer = 0;
  matchingTransitioning = false;
}

async function shareRecognitionResult() {
  const session = appState.grid.session;
  if (!isEndedGridSession(session)) return;
  const orderMode = session.kind === "couplet-order";
  const stats = orderMode ? getCoupletOrderStats(session) : getRecognitionStats(session);
  const answered = orderMode ? stats.correctCount + stats.wrongCount : stats.answeredGridCount;
  const text = orderMode
    ? `1000cc 랜덤 8자 순서 · ${stats.completedRounds}/${stats.roundCount}세트 · ${answered}회 선택 · 정답률 ${Math.round(stats.accuracy * 100)}%`
    : `1000cc ${getRecognitionModeLabel(session.mode)} · ${answered}문제 · 정답률 ${Math.round(stats.accuracy * 100)}%`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "1000cc 한자 맞추기", text, url: window.location.href });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      showToast("결과를 복사했습니다.");
    } else {
      window.prompt("결과를 복사하세요.", text);
    }
  } catch (error) {
    if (error && error.name !== "AbortError") showToast("결과를 공유하지 못했습니다.");
  }
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
  elements.settingVibrate.checked = appState.settings.vibrate;
  elements.settingSoundEffects.checked = appState.settings.soundEffects;
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
  const passageSpeaking = speechState.speaking && speechState.kind === "couplet";
  const memorySpeaking = speechState.speaking && speechState.kind === "memory-couplet";
  elements.playCouplet.classList.toggle(
    "is-speaking",
    passageSpeaking,
  );
  elements.playCouplet.querySelector("span").textContent =
    passageSpeaking ? "재생 정지" : "8자 듣기";
  elements.playMemoryCouplet.classList.toggle("is-speaking", memorySpeaking);
  elements.playMemoryCouplet.textContent = memorySpeaking ? "재생 정지" : "8자 듣기";
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
