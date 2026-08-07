import {
  CHARACTERS,
  COUPLETS,
  TOTAL_CHARACTERS,
  findCharacterIndexes,
  getCharacterStudyDetails,
  getCouplet,
} from "./js/data-model.js";
import {
  createMatchingSession,
  getMatchingProgress,
  selectMatchingChoice,
} from "./js/matching-engine.js?v=24";
import {
  createChallengeUrl,
  createRandomDailyPick,
  getLesson,
  getRandomDailyPick,
  parseChallengeDay,
} from "./js/course-engine.js?v=24";
import {
  createOverviewIndexes,
  createOverviewRangeStarts,
  getOverviewPageSize,
  normalizeOverviewRangeStart,
  shuffleOverviewIndexes,
} from "./js/overview-layout.js?v=28";
import { recordSkillAttempt } from "./js/progress-engine.js";
import { createOverviewCell, createPassageCharacter } from "./js/render.js?v=29";
import {
  loadStateFromStorage,
  saveStateToStorage,
} from "./js/storage.js?v=24";
import { createStore } from "./js/state.js";
import { TTSManager } from "./js/tts-manager.js?v=24";
import { formatDuration } from "./js/utils.js";

const OVERVIEW_COMPACT_QUERY =
  "(max-width: 660px), (max-width: 920px) and (max-height: 520px)";

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
  matchingRangeCopy: document.querySelector("#matching-range-copy"),
  startCurrentMatch: document.querySelector("#start-current-match"),
  startRandomMatch: document.querySelector("#start-random-match"),
  gridSessionProgress: document.querySelector("#grid-session-progress"),
  gridAccuracy: document.querySelector("#grid-accuracy"),
  gridWrongCount: document.querySelector("#grid-wrong-count"),
  targetPanel: document.querySelector("#target-panel"),
  targetPrompt: document.querySelector("#target-prompt"),
  targetPosition: document.querySelector("#target-position"),
  continuousBoard: document.querySelector("#continuous-board"),
  matchingFeedback: document.querySelector("#matching-feedback"),
  replayTarget: document.querySelector("#replay-target"),
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
  elements.startCurrentMatch.addEventListener("click", startCurrentMatchingGame);
  elements.startRandomMatch.addEventListener("click", startRandomMatchingGame);
  elements.continuousBoard.addEventListener("click", handleMatchingChoiceClick);
  elements.continuousBoard.addEventListener("keydown", handleMatchingChoiceKeyboard);
  elements.replayTarget.addEventListener("click", speakGridTarget);
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
    definition.textContent = word.definition;
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
  tts.speak(couplet.data.reading.replace(" ", ", "), {
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
  if (session && session.active) {
    elements.gridSetup.hidden = true;
    elements.sessionResult.hidden = true;
    elements.gridSession.hidden = false;
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
  renderMatchingLaunch();
}

function renderMatchingLaunch() {
  const selected = CHARACTERS[appState.ui.selectedIndex];
  const couplet = getCouplet(selected.coupletIndex);
  elements.matchingRangeCopy.textContent = `현재 8자 · ${couplet.data.hanja}`;
}

function startCurrentMatchingGame() {
  const selected = CHARACTERS[appState.ui.selectedIndex];
  const indexes = getCouplet(selected.coupletIndex).items.map(function (item) { return item.index; });
  startMatchingSession(indexes, "current");
}

function startRandomMatchingGame() {
  const couplet = getCouplet(Math.floor(Math.random() * COUPLETS.length));
  startMatchingSession(couplet.items.map(function (item) { return item.index; }), "random");
}

function startMatchingSession(indexes, scope) {
  stopAllSpeech();
  window.clearTimeout(matchingAdvanceTimer);
  matchingTransitioning = false;
  const session = createMatchingSessionMetadata(
    createMatchingSession({ indexes, choiceCount: 4 }),
    scope,
  );
  commit(function (state) {
    state.grid.session = session;
    state.grid.lastCursor = indexes[0];
  });
  renderGridScreen();
  focusFirstMatchingChoice();
}

function createMatchingSessionMetadata(engine, scope) {
  return {
    ...engine,
    active: true,
    scope,
    correctCount: 0,
    wrongCount: 0,
    wrongIndexes: [],
    errorsByTarget: {},
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
}

function renderMatchingChoices(session) {
  const fragment = document.createDocumentFragment();
  session.choiceIndexes.forEach(function (index) {
    const item = CHARACTERS[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-choice";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `후보 한자 ${item.character}`);
    button.innerHTML = `<span lang="zh-Hant">${item.character}</span>`;
    fragment.append(button);
  });
  elements.continuousBoard.replaceChildren(fragment);
}

function handleMatchingChoiceClick(event) {
  const button = event.target.closest(".match-choice");
  if (!button || button.disabled || matchingTransitioning) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) return;
  answerMatchingChoice(index, button);
}

function answerMatchingChoice(selectedIndex, button) {
  const session = appState.grid.session;
  if (!session || !session.active || session.complete) return;
  const targetIndex = session.targetIndex;
  const result = selectMatchingChoice(session, selectedIndex);

  if (!result.correct) {
    handleWrongMatchingAnswer(targetIndex, button);
    return;
  }

  const item = CHARACTERS[targetIndex];
  const nextSession = {
    ...session,
    ...result.session,
    correctCount: session.correctCount + 1,
  };
  const endedAt = result.completed ? new Date().toISOString() : null;

  commit(function (state) {
    state.progress = recordSkillAttempt(state.progress, targetIndex, "reverse", { correct: true });
    state.grid.session = {
      ...nextSession,
      active: !result.completed,
      endedAt,
    };
    state.grid.lastCursor = result.session.targetIndex ?? targetIndex;
  });

  matchingTransitioning = true;
  button.classList.add("is-correct");
  button.setAttribute("aria-label", `정답, ${item.contextHun}`);
  elements.continuousBoard.querySelectorAll(".match-choice").forEach(function (choice) {
    choice.disabled = true;
  });
  elements.matchingFeedback.textContent = `정답 · ${item.contextHun}`;

  if (
    appState.settings.vibrate &&
    navigator.vibrate &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigator.vibrate(10);
  }

  tts.speak(item.contextHun, { kind: "matching-feedback", onError: handleTtsError });
  elements.gridAnnouncement.textContent = result.completed
    ? `정답, ${item.contextHun}. 8문제를 모두 마쳤습니다.`
    : `정답, ${item.contextHun}. 다음 문제를 보여 줍니다.`;

  matchingAdvanceTimer = window.setTimeout(function () {
    matchingTransitioning = false;
    renderGridScreen();
    if (!result.completed) focusFirstMatchingChoice();
  }, 260);
}

function handleWrongMatchingAnswer(targetIndex, button) {
  const session = appState.grid.session;
  const errors = (session.errorsByTarget[targetIndex] || 0) + 1;
  commit(function (state) {
    state.progress = recordSkillAttempt(state.progress, targetIndex, "reverse", { correct: false });
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
  elements.gridWrongCount.textContent = String(appState.grid.session.wrongCount);
  const attempts = appState.grid.session.correctCount + appState.grid.session.wrongCount;
  elements.gridAccuracy.textContent = `${Math.round((appState.grid.session.correctCount / attempts) * 100)}%`;
  elements.matchingFeedback.textContent = "다시 살펴보고 고르세요.";
  elements.gridAnnouncement.textContent = "오답입니다. 같은 문제에서 다시 고를 수 있습니다.";
}

function renderGridSessionStatus() {
  const session = appState.grid.session;
  if (!session) return;
  const progress = getMatchingProgress(session);
  const attempts = session.correctCount + session.wrongCount;
  const accuracy = attempts > 0 ? Math.round((session.correctCount / attempts) * 100) : null;
  const target = session.complete ? null : CHARACTERS[session.targetIndex];
  elements.gridSessionProgress.textContent = `${Math.min(progress.total, progress.completed + 1)} / ${progress.total}`;
  elements.gridAccuracy.textContent = accuracy === null ? "—" : `${accuracy}%`;
  elements.gridWrongCount.textContent = String(session.wrongCount);

  if (target) {
    renderMatchingTarget(target, progress);
    renderMatchingChoices(session);
    elements.matchingFeedback.textContent = "맞는 한자를 고르세요.";
  }
}

function renderMatchingTarget(target, progress) {
  elements.targetPanel.classList.remove("is-concealed");
  elements.targetPrompt.textContent = target.contextHun;
  elements.targetPosition.textContent = `문제 ${progress.completed + 1} / ${progress.total}`;
}

function speakGridTarget() {
  const session = appState.grid.session;
  if (!session || session.complete) return;
  tts.speak(CHARACTERS[session.targetIndex].contextHun, {
    kind: "matching-target",
    onError: handleTtsError,
  });
}

function restartGridSession() {
  const session = appState.grid.session;
  if (!session) return;
  const confirmed = window.confirm("이번 게임을 처음부터 다시 시작할까요?");
  if (!confirmed) return;
  stopAllSpeech();
  window.clearTimeout(matchingAdvanceTimer);
  matchingTransitioning = false;
  const restarted = createMatchingSessionMetadata(
    createMatchingSession({ indexes: session.questionIndexes, choiceCount: session.choiceCount }),
    session.scope,
  );
  commit(function (state) {
    state.grid.session = restarted;
    state.grid.lastCursor = restarted.targetIndex;
  });
  renderGridScreen();
  focusFirstMatchingChoice();
}

function endGridSession() {
  const session = appState.grid.session;
  if (!session) return;
  stopAllSpeech();
  window.clearTimeout(matchingAdvanceTimer);
  matchingTransitioning = false;
  commit(function (state) {
    state.grid.session.active = false;
    state.grid.session.endedAt = new Date().toISOString();
  });
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
  startMatchingSession(indexes, "wrong");
}

function closeSessionResult() {
  commit(function (state) {
    state.grid.session = null;
  });
  renderGridScreen();
}

function handleMatchingChoiceKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }
  const button = event.target.closest(".match-choice");
  if (!button) return;
  event.preventDefault();
  const buttons = Array.from(elements.continuousBoard.querySelectorAll(".match-choice:not(:disabled)"));
  const current = buttons.indexOf(button);
  const columns = 2;
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

function focusFirstMatchingChoice() {
  window.setTimeout(function () {
    const button = elements.continuousBoard.querySelector(".match-choice:not(:disabled)");
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
