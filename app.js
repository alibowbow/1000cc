import {
  CHARACTERS,
  COUPLETS,
  TOTAL_CHARACTERS,
  findCharacterIndexes,
  getCouplet,
  getPhrase,
} from "./js/data-model.js";
import { createGridSession, getSessionProgress, selectGridIndex } from "./js/grid-engine.js";
import {
  getDueIndexes,
  getFrequentWrongIndexes,
  getMasteredCount,
  getRecentWrongIndexes,
  recordAttempt,
} from "./js/progress-engine.js";
import {
  createOverviewCell,
  createPassageCharacter,
  createReviewItem,
  renderBoardCellElement,
} from "./js/render.js";
import {
  clearStoredState,
  createDefaultState,
  createExportJson,
  loadStateFromStorage,
  parseImportJson,
  saveStateToStorage,
} from "./js/storage.js";
import { createStore } from "./js/state.js";
import { TTSManager } from "./js/tts-manager.js";
import { downloadTextFile, formatDuration } from "./js/utils.js";

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
    showToast("이 브라우저에서는 학습 기록을 저장할 수 없습니다.");
  }
});
let appState = store.get();
let passageContinuous = false;
let speechState = { speaking: false, kind: "" };
let overviewRevealedIndexes = new Set();
let toastTimer = 0;
let completionTimer = 0;
let renderedSessionKey = "";

const elements = {
  masteredCount: document.querySelector("#mastered-count"),
  masteryProgress: document.querySelector("#mastery-progress"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  screens: Array.from(document.querySelectorAll("[data-screen]")),
  overviewRangeLabel: document.querySelector("#overview-range-label"),
  overviewRange: document.querySelector("#overview-range"),
  overviewRangeNav: document.querySelector("#overview-range-nav"),
  overviewStatusFilter: document.querySelector("#overview-status-filter"),
  overviewSearchForm: document.querySelector("#overview-search-form"),
  overviewSearch: document.querySelector("#overview-search"),
  overviewGrid: document.querySelector("#overview-grid"),
  overviewEmpty: document.querySelector("#overview-empty"),
  overviewResetFilters: document.querySelector("#overview-reset-filters"),
  overviewResultCount: document.querySelector("#overview-result-count"),
  overviewToggleMeaning: document.querySelector("#overview-toggle-meaning"),
  overviewAnnouncement: document.querySelector("#overview-announcement"),
  clearSearch: document.querySelector("#clear-search"),
  goCurrentPosition: document.querySelector("#go-current-position"),
  highlightWrong: document.querySelector("#highlight-wrong"),
  highlightDue: document.querySelector("#highlight-due"),
  previousCouplet: document.querySelector("#previous-couplet"),
  nextCouplet: document.querySelector("#next-couplet"),
  coupletPosition: document.querySelector("#couplet-position"),
  passageScreen: document.querySelector("#screen-passage"),
  passageCard: document.querySelector("#passage-card"),
  phraseGrids: Array.from(document.querySelectorAll("[data-phrase-grid]")),
  phrasePlayButtons: Array.from(document.querySelectorAll("[data-play-phrase]")),
  coupletMeaning: document.querySelector("#couplet-meaning"),
  playCouplet: document.querySelector("#play-couplet"),
  continuousListen: document.querySelector("#continuous-listen"),
  markCouplet: document.querySelector("#mark-couplet"),
  toggleReading: document.querySelector("#toggle-reading"),
  toggleMeaning: document.querySelector("#toggle-meaning"),
  revealAnswer: document.querySelector("#reveal-answer"),
  selectedNumber: document.querySelector("#selected-number"),
  selectedCharacter: document.querySelector("#selected-character"),
  selectedHun: document.querySelector("#selected-hun"),
  selectedGloss: document.querySelector("#selected-gloss"),
  selectedPhrase: document.querySelector("#selected-phrase"),
  selectedCouplet: document.querySelector("#selected-couplet"),
  selectedContext: document.querySelector("#selected-context"),
  playCharacter: document.querySelector("#play-character"),
  playCharacterLabel: document.querySelector("#play-character-label"),
  gridSetup: document.querySelector("#grid-setup"),
  gridSession: document.querySelector("#grid-session"),
  sessionResult: document.querySelector("#session-result"),
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
  reviewResult: document.querySelector("#review-result"),
  closeResult: document.querySelector("#close-result"),
  reviewSourceButtons: Array.from(document.querySelectorAll("[data-review-source]")),
  reviewRange: document.querySelector("#review-range"),
  reviewList: document.querySelector("#review-list"),
  reviewEmpty: document.querySelector("#review-empty"),
  reviewSelectedCount: document.querySelector("#review-selected-count"),
  reviewSelectAll: document.querySelector("#review-select-all"),
  reviewClearSelection: document.querySelector("#review-clear-selection"),
  startReviewGrid: document.querySelector("#start-review-grid"),
  dueCount: document.querySelector("#due-count"),
  recentWrongCount: document.querySelector("#recent-wrong-count"),
  frequentWrongCount: document.querySelector("#frequent-wrong-count"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  voiceSelect: document.querySelector("#voice-select"),
  rateSelect: document.querySelector("#rate-select"),
  voiceNote: document.querySelector("#voice-note"),
  settingTapToSpeak: document.querySelector("#setting-tap-to-speak"),
  settingReadFour: document.querySelector("#setting-read-four"),
  settingVibrate: document.querySelector("#setting-vibrate"),
  exportProgress: document.querySelector("#export-progress"),
  importProgress: document.querySelector("#import-progress"),
  importProgressFile: document.querySelector("#import-progress-file"),
  resetProgress: document.querySelector("#reset-progress"),
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
    showToast("기존 학습 진도를 새 숙련도 기록으로 안전하게 옮겼습니다.");
  }
}

function commit(mutator) {
  mutator(appState);
  appState = store.update(appState);
  return appState;
}

function replaceState(nextState) {
  appState = store.update(nextState);
  return appState;
}

function buildRangeControls() {
  const overviewFragment = document.createDocumentFragment();
  const reviewFragment = document.createDocumentFragment();
  const navFragment = document.createDocumentFragment();

  RANGE_NAMES.forEach(function (name, rangeIndex) {
    const start = rangeIndex * RANGE_SIZE;
    const label = `${name} · ${start + 1}–${start + RANGE_SIZE}`;
    const overviewOption = new Option(label, String(start));
    const reviewOption = new Option(label, String(start));
    overviewFragment.append(overviewOption);
    reviewFragment.append(reviewOption);

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rangeStart = String(start);
    button.textContent = `${start + 1}–${start + RANGE_SIZE}`;
    button.setAttribute("aria-label", `${label}로 이동`);
    navFragment.append(button);
  });

  elements.overviewRange.append(overviewFragment);
  elements.reviewRange.append(reviewFragment);
  elements.overviewRangeNav.append(navFragment);
}

function bindEvents() {
  elements.modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.dataset.mode);
    });
  });

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
  elements.overviewStatusFilter.addEventListener("change", function () {
    commit(function (state) {
      state.ui.statusFilter = elements.overviewStatusFilter.value;
    });
    renderOverview();
  });
  document.querySelectorAll("[data-group-size]").forEach(function (button) {
    button.addEventListener("click", function () {
      commit(function (state) {
        state.ui.overviewGroupSize = Number(button.dataset.groupSize);
      });
      renderOverview();
    });
  });
  elements.highlightWrong.addEventListener("click", function () {
    commit(function (state) {
      state.ui.highlightWrong = !state.ui.highlightWrong;
    });
    renderOverview();
  });
  elements.highlightDue.addEventListener("click", function () {
    commit(function (state) {
      state.ui.highlightDue = !state.ui.highlightDue;
    });
    renderOverview();
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
  elements.goCurrentPosition.addEventListener("click", function () {
    const cursor = Math.min(999, appState.grid.lastCursor);
    commit(function (state) {
      state.ui.search = "";
      state.ui.rangeStart = Math.floor(cursor / 100) * 100;
      state.ui.selectedIndex = cursor;
    });
    renderOverview();
    focusOverviewCell(cursor);
  });
  elements.overviewRangeNav.addEventListener("click", function (event) {
    const button = event.target.closest("[data-range-start]");
    if (button) setOverviewRange(Number(button.dataset.rangeStart));
  });
  elements.overviewGrid.addEventListener("click", handleOverviewClick);

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
  elements.phrasePlayButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      playPhrase(Number(button.dataset.playPhrase));
    });
  });
  elements.playCharacter.addEventListener("click", function () {
    tts.speak(CHARACTERS[appState.ui.selectedIndex].contextHun, {
      kind: "character",
      onError: handleTtsError,
    });
  });
  elements.playCouplet.addEventListener("click", playCurrentCouplet);
  elements.continuousListen.addEventListener("click", toggleContinuousListening);
  elements.markCouplet.addEventListener("click", markCurrentCouplet);
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
  elements.reviewResult.addEventListener("click", openResultReview);
  elements.closeResult.addEventListener("click", closeSessionResult);

  elements.reviewSourceButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      commit(function (state) {
        state.review.source = button.dataset.reviewSource;
        state.review.selectedIndexes = [];
      });
      renderReview();
    });
  });
  elements.reviewRange.addEventListener("change", function () {
    commit(function (state) {
      state.review.rangeStart = Number(elements.reviewRange.value);
      state.review.source = "range";
      state.review.selectedIndexes = [];
    });
    renderReview();
  });
  elements.reviewList.addEventListener("click", handleReviewItemClick);
  elements.reviewSelectAll.addEventListener("click", selectAllReviewItems);
  elements.reviewClearSelection.addEventListener("click", function () {
    commit(function (state) {
      state.review.selectedIndexes = [];
    });
    renderReview();
  });
  elements.startReviewGrid.addEventListener("click", startReviewGridSession);

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
  elements.exportProgress.addEventListener("click", exportProgress);
  elements.importProgress.addEventListener("click", function () {
    elements.importProgressFile.click();
  });
  elements.importProgressFile.addEventListener("change", importProgress);
  elements.resetProgress.addEventListener("click", resetAllProgress);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopAllSpeech();
  });
  window.addEventListener("pagehide", stopAllSpeech);
}

function renderApp() {
  renderHeader();
  renderModes();
  if (appState.ui.mode === "overview") renderOverview();
  if (appState.ui.mode === "passage") renderPassage();
  if (appState.ui.mode === "grid") renderGridScreen();
  if (appState.ui.mode === "review") renderReview();
}

function renderHeader() {
  const mastered = getMasteredCount(appState.progress);
  elements.masteredCount.textContent = String(mastered);
  elements.masteryProgress.value = mastered;
  elements.masteryProgress.textContent = `${mastered} / 1000`;
}

function renderModes() {
  elements.modeButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === appState.ui.mode));
  });
  elements.screens.forEach(function (screen) {
    screen.hidden = screen.dataset.screen !== appState.ui.mode;
  });
}

function setMode(mode) {
  if (!["overview", "passage", "grid", "review"].includes(mode)) return;
  if (mode !== appState.ui.mode) stopAllSpeech();
  commit(function (state) {
    state.ui.mode = mode;
    state.ui.revealAnswer = false;
  });
  renderApp();
}

function renderOverview() {
  const rangeStart = appState.ui.rangeStart;
  const rangeEnd = rangeStart + RANGE_SIZE;
  const rangeIndex = rangeStart / RANGE_SIZE;
  const query = appState.ui.search;
  const searchIndexes = query
    ? findCharacterIndexes(query)
    : Array.from({ length: RANGE_SIZE }, function (_, offset) {
        return rangeStart + offset;
      });
  const eligible = searchIndexes.filter(matchesStatusFilter);
  const groupSize = appState.ui.overviewGroupSize;
  const maxGroupCount = Math.ceil(100 / groupSize);
  const groupStarts = [];
  const groupSeen = new Set();

  eligible.forEach(function (index) {
    const start = Math.floor(index / groupSize) * groupSize;
    if (!groupSeen.has(start) && groupStarts.length < maxGroupCount) {
      groupSeen.add(start);
      groupStarts.push(start);
    }
  });
  groupStarts.sort(function (a, b) { return a - b; });

  elements.overviewGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  const eligibleSet = new Set(eligible);
  const recentSet = new Set(getRecentWrongIndexes(appState.progress, 1000));
  const dueSet = new Set(getDueIndexes(appState.progress));

  groupStarts.forEach(function (groupStart) {
    const groupEnd = Math.min(TOTAL_CHARACTERS, groupStart + groupSize);
    let items = CHARACTERS.slice(groupStart, groupEnd);
    if (!query) {
      items = items.filter(function (item) {
        return item.index >= rangeStart && item.index < rangeEnd;
      });
    }
    if (items.length === 0) return;

    const group = document.createElement("section");
    group.className = "overview-group";
    group.dataset.size = String(groupSize);

    const open = document.createElement("button");
    open.type = "button";
    open.className = "overview-group__open";
    open.dataset.openPassage = String(groupStart);
    const groupHanja = items.map(function (item) { return item.character; }).join("");
    const groupReading = items.map(function (item) { return item.reading; }).join(" ");
    open.innerHTML = `<strong lang="zh-Hant">${groupHanja}</strong><span>구절 학습 →</span>`;
    open.setAttribute("aria-label", `${groupHanja}, ${groupReading}, 구절 학습으로 이동`);

    const cells = document.createElement("div");
    cells.className = "overview-cells";
    items.forEach(function (item) {
      const record = appState.progress[item.index];
      const cell = createOverviewCell(item, {
        selected: item.index === appState.ui.selectedIndex,
        masteryLevel: record ? record.masteryLevel : 0,
        concealMeaning:
          appState.settings.hideOverviewMeaning && !overviewRevealedIndexes.has(item.index),
        revealed: overviewRevealedIndexes.has(item.index),
        contextOnly: !eligibleSet.has(item.index),
        recentWrong: appState.ui.highlightWrong && recentSet.has(item.index),
        due: appState.ui.highlightDue && dueSet.has(item.index),
      });
      cells.append(cell);
    });
    group.append(open, cells);
    fragment.append(group);
  });

  elements.overviewGrid.append(fragment);
  elements.overviewGrid.classList.toggle(
    "is-meaning-hidden",
    appState.settings.hideOverviewMeaning,
  );
  elements.overviewEmpty.hidden = eligible.length > 0;
  elements.overviewGrid.hidden = eligible.length === 0;
  elements.overviewRangeNav.hidden = Boolean(query);
  elements.clearSearch.hidden = !query;
  elements.overviewSearch.value = query;
  elements.overviewRange.value = String(rangeStart);
  elements.overviewStatusFilter.value = appState.ui.statusFilter;
  elements.overviewRangeLabel.textContent =
    query
      ? `검색 · “${query}”`
      : `${RANGE_NAMES[rangeIndex]} · ${rangeStart + 1}–${rangeEnd}`;
  elements.overviewResultCount.textContent =
    query || appState.ui.statusFilter !== "all"
      ? eligible.length > 100
        ? `${eligible.length}개 결과 중 앞 문맥 100자를 표시합니다.`
        : `${eligible.length}개 결과`
      : "";
  elements.highlightWrong.setAttribute("aria-pressed", String(appState.ui.highlightWrong));
  elements.highlightDue.setAttribute("aria-pressed", String(appState.ui.highlightDue));
  elements.overviewToggleMeaning.setAttribute(
    "aria-pressed",
    String(appState.settings.hideOverviewMeaning),
  );
  document.querySelectorAll("[data-group-size]").forEach(function (button) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.groupSize) === groupSize));
  });
  elements.overviewRangeNav.querySelectorAll("button").forEach(function (button) {
    button.setAttribute(
      "aria-current",
      String(Number(button.dataset.rangeStart) === rangeStart),
    );
  });
}

function matchesStatusFilter(index) {
  const level = appState.progress[index] ? appState.progress[index].masteryLevel : 0;
  if (appState.ui.statusFilter === "unseen") return level === 0;
  if (appState.ui.statusFilter === "learning") return level >= 1 && level <= 2;
  if (appState.ui.statusFilter === "mastered") return level >= 3;
  return true;
}

function handleOverviewClick(event) {
  const open = event.target.closest("[data-open-passage]");
  if (open) {
    openPassage(Number(open.dataset.openPassage), false);
    return;
  }
  const cell = event.target.closest(".overview-cell");
  if (!cell) return;
  const index = Number(cell.dataset.index);
  const item = CHARACTERS[index];
  if (!item) return;

  overviewRevealedIndexes.add(index);
  commit(function (state) {
    state.ui.selectedIndex = index;
  });

  elements.overviewGrid.querySelectorAll(".overview-cell.is-selected").forEach(function (button) {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
  cell.classList.add("is-selected", "is-revealed");
  cell.setAttribute("aria-pressed", "true");
  cell.title = item.contextHun;
  cell.setAttribute(
    "aria-label",
    `${item.number}번째, ${item.contextHun}, 숙련도 ${appState.progress[index]?.masteryLevel || 0}단계`,
  );
  const meaning = cell.querySelector(".overview-cell__meaning");
  if (meaning) meaning.removeAttribute("aria-hidden");
  elements.overviewAnnouncement.textContent = `${item.contextHun}.`;

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
    if (cell) cell.focus({ preventScroll: true });
  }, 0);
}

function renderPassage() {
  const selected = CHARACTERS[appState.ui.selectedIndex];
  const couplet = getCouplet(selected.coupletIndex);
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

  elements.selectedNumber.textContent = String(selected.number);
  elements.selectedCharacter.textContent = selected.character;
  elements.selectedHun.textContent = selected.contextHun;
  elements.selectedGloss.textContent = `기본 뜻은 ‘${selected.gloss}’입니다. 이 글귀에서는 ‘${selected.reading}’으로 읽습니다.`;
  elements.selectedPhrase.textContent = selected.phrase;
  elements.selectedCouplet.textContent = selected.couplet;
  elements.selectedContext.textContent = selected.meaning;
  elements.playCharacterLabel.textContent = `${selected.contextHun} 듣기`;
  elements.playCharacter.setAttribute("aria-label", `${selected.contextHun} 듣기`);

  const allRecorded = couplet.items.every(function (item) {
    return appState.progress[item.index] && appState.progress[item.index].masteryLevel >= 2;
  });
  elements.markCouplet.classList.toggle("is-complete", allRecorded);
  elements.markCouplet.querySelector("span").textContent = allRecorded
    ? "8자 학습 기록 완료"
    : "8자 학습 기록";
  renderPassageVisibility();
  renderSpeechState();
}

function renderPassageVisibility() {
  const reveal = appState.ui.revealAnswer;
  elements.passageScreen.classList.toggle("is-reading-hidden", appState.settings.hideReading);
  elements.passageScreen.classList.toggle("is-meaning-hidden", appState.settings.hideMeaning);
  elements.passageScreen.classList.toggle("is-answer-revealed", reveal);
  elements.toggleReading.setAttribute("aria-pressed", String(appState.settings.hideReading));
  elements.toggleMeaning.setAttribute("aria-pressed", String(appState.settings.hideMeaning));
  elements.revealAnswer.hidden = !(
    (appState.settings.hideReading || appState.settings.hideMeaning) && !reveal
  );
  elements.coupletMeaning.setAttribute(
    "aria-hidden",
    String(appState.settings.hideMeaning && !reveal),
  );
  elements.selectedHun.setAttribute(
    "aria-hidden",
    String(appState.settings.hideReading && !reveal),
  );
  elements.selectedGloss.setAttribute(
    "aria-hidden",
    String(appState.settings.hideMeaning && !reveal),
  );
  elements.selectedContext.setAttribute(
    "aria-hidden",
    String(appState.settings.hideMeaning && !reveal),
  );
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

function playPhrase(phraseOffset) {
  const couplet = getCouplet(CHARACTERS[appState.ui.selectedIndex].coupletIndex);
  const phrase = phraseOffset === 0 ? couplet.firstPhrase : couplet.secondPhrase;
  tts.speak(phrase.reading, { kind: "phrase", onError: handleTtsError });
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

function markCurrentCouplet() {
  const couplet = getCouplet(CHARACTERS[appState.ui.selectedIndex].coupletIndex);
  let changed = false;
  commit(function (state) {
    couplet.items.forEach(function (item) {
      const level = state.progress[item.index] ? state.progress[item.index].masteryLevel : 0;
      if (level < 2) {
        state.progress = recordAttempt(state.progress, item.index, {
          correct: true,
          difficulty: "character",
        });
        changed = true;
      }
    });
  });
  renderHeader();
  renderPassage();
  showToast(changed ? "이 8자를 학습 중 단계로 기록했습니다." : "이미 학습 기록에 반영된 8자입니다.");
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
    state.progress = recordAttempt(state.progress, targetIndex, {
      correct: true,
      difficulty: session.difficulty,
      review: session.reviewMode,
    });
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
  renderHeader();
  renderGridSessionStatus();
  elements.gridAnnouncement.textContent = result.completed
    ? `정답, ${completedItem.reading}. 세션을 완료했습니다.`
    : `정답, ${completedItem.reading}. 다음 글자를 찾으세요.`;

  if (result.completed) {
    commit(function (state) {
      state.grid.session.active = false;
      state.grid.session.endedAt = new Date().toISOString();
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
    state.progress = recordAttempt(state.progress, targetIndex, {
      correct: false,
      difficulty: session.difficulty,
      review: session.reviewMode,
    });
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
  renderHeader();
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
  elements.reviewResult.disabled = session.wrongIndexes.length === 0;
}

function openResultReview() {
  const session = appState.grid.session;
  if (!session || session.wrongIndexes.length === 0) return;
  commit(function (state) {
    state.review.selectedIndexes = session.wrongIndexes.slice();
    state.review.source = "recent";
    state.ui.mode = "review";
    state.grid.session = null;
  });
  renderApp();
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

function renderReview() {
  const due = getDueIndexes(appState.progress);
  const recent = getRecentWrongIndexes(appState.progress);
  const frequent = getFrequentWrongIndexes(appState.progress);
  elements.dueCount.textContent = String(due.length);
  elements.recentWrongCount.textContent = String(recent.length);
  elements.frequentWrongCount.textContent = String(frequent.length);
  elements.reviewRange.value = String(appState.review.rangeStart);
  elements.reviewSourceButtons.forEach(function (button) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.reviewSource === appState.review.source),
    );
  });

  const indexes = getReviewSourceIndexes(due, recent, frequent);
  const selected = new Set(appState.review.selectedIndexes);
  const fragment = document.createDocumentFragment();
  indexes.forEach(function (index) {
    const item = CHARACTERS[index];
    const record = appState.progress[index];
    const level = record ? record.masteryLevel : 0;
    fragment.append(
      createReviewItem(item, {
        masteryLevel: level,
        selected: selected.has(index),
      }),
    );
  });
  elements.reviewList.replaceChildren(fragment);
  elements.reviewList.hidden = indexes.length === 0;
  elements.reviewEmpty.hidden = indexes.length > 0;
  elements.reviewSelectedCount.textContent = String(selected.size);
  elements.startReviewGrid.disabled = selected.size === 0;
  elements.reviewSelectAll.disabled = indexes.length === 0;
}

function getReviewSourceIndexes(due, recent, frequent) {
  if (appState.review.source === "recent") return recent;
  if (appState.review.source === "frequent") return frequent;
  if (appState.review.source === "range") {
    return Array.from({ length: 100 }, function (_, offset) {
      return appState.review.rangeStart + offset;
    });
  }
  return due;
}

function handleReviewItemClick(event) {
  const button = event.target.closest(".review-item");
  if (!button) return;
  const index = Number(button.dataset.index);
  commit(function (state) {
    const selected = new Set(state.review.selectedIndexes);
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    state.review.selectedIndexes = Array.from(selected).sort(function (a, b) { return a - b; });
  });
  renderReview();
}

function selectAllReviewItems() {
  const indexes = Array.from(elements.reviewList.querySelectorAll(".review-item")).map(function (button) {
    return Number(button.dataset.index);
  });
  commit(function (state) {
    state.review.selectedIndexes = indexes;
  });
  renderReview();
}

function startReviewGridSession() {
  const indexes = appState.review.selectedIndexes.slice().sort(function (a, b) { return a - b; });
  if (indexes.length === 0) return;
  stopAllSpeech();
  const engine = createGridSession({
    indexes,
    boardSize: appState.settings.boardSize,
  });
  const session = createSessionMetadata(engine, {
    difficulty: "reading",
    scope: "review",
    reviewMode: true,
  });
  commit(function (state) {
    state.grid.session = session;
    state.grid.lastCursor = session.targetCursor;
    state.ui.mode = "grid";
  });
  renderedSessionKey = "";
  renderApp();
  focusFirstBoardCell();
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
      "이 브라우저는 음성 합성을 지원하지 않습니다. 다른 학습 기능은 그대로 사용할 수 있습니다.";
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

function exportProgress() {
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`1000cc-study-${date}.json`, createExportJson(appState));
  showToast("학습 기록 JSON을 내보냈습니다.");
}

async function importProgress() {
  const file = elements.importProgressFile.files && elements.importProgressFile.files[0];
  if (!file) return;
  try {
    const imported = parseImportJson(await file.text());
    stopAllSpeech();
    replaceState(imported);
    tts.voiceURI = appState.settings.voiceURI;
    tts.rate = appState.settings.rate;
    tts.configure(appState.settings);
    renderedSessionKey = "";
    syncSettingsControls();
    renderApp();
    showToast("학습 기록을 안전하게 불러왔습니다.");
    elements.settingsDialog.close();
  } catch (error) {
    showToast(error.message || "학습 기록을 불러오지 못했습니다.");
  } finally {
    elements.importProgressFile.value = "";
  }
}

function resetAllProgress() {
  const confirmed = window.confirm("모든 학습 기록과 진행 중인 세션을 초기화할까요?");
  if (!confirmed) return;
  stopAllSpeech();
  clearStoredState(window.localStorage);
  replaceState(createDefaultState());
  renderedSessionKey = "";
  syncSettingsControls();
  renderApp();
  elements.settingsDialog.close();
  showToast("모든 학습 기록을 초기화했습니다.");
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
        // 오프라인 등록 실패가 학습 기능을 막지 않게 한다.
      });
  });
}
