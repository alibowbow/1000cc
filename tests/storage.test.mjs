import test from "node:test";
import assert from "node:assert/strict";
import { createGridSession } from "../js/grid-engine.js";
import {
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  createDefaultState,
  createExportJson,
  loadStateFromStorage,
  parseImportJson,
  saveStateToStorage,
} from "../js/storage.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); },
  };
}

test("v1 learned·sequenceCursor·음성·가리기 설정을 v2로 안전하게 이관한다", function () {
  const v1 = {
    mode: "sequence",
    selectedIndex: 77,
    rangeStart: 0,
    sequenceCursor: 83,
    learned: [0, 1, 77],
    hideReading: true,
    hideMeaning: true,
    tapToSpeak: false,
    rate: 1,
    voiceURI: "voice-ko",
  };
  const storage = memoryStorage({ [STORAGE_KEY_V1]: JSON.stringify(v1) });
  const loaded = loadStateFromStorage(storage, Date.UTC(2026, 7, 4));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.state.ui.mode, "grid");
  assert.equal(loaded.state.grid.lastCursor, 83);
  assert.equal(loaded.state.progress[77].masteryLevel, 2);
  assert.equal(loaded.state.settings.hideReading, true);
  assert.equal(loaded.state.settings.hideMeaning, true);
  assert.equal(loaded.state.settings.tapToSpeak, false);
  assert.equal(loaded.state.settings.rate, 1);
  assert.equal(loaded.state.settings.voiceURI, "voice-ko");
  assert.ok(storage.dump()[STORAGE_KEY_V2]);
});

test("완료된 v1 sequenceCursor 1000도 손실 없이 보존한다", function () {
  const storage = memoryStorage({
    [STORAGE_KEY_V1]: JSON.stringify({ sequenceCursor: 1000, learned: [] }),
  });
  const loaded = loadStateFromStorage(storage);
  assert.equal(loaded.state.grid.lastCursor, 1000);
});

test("잘못된 localStorage JSON은 앱을 깨뜨리지 않고 기본값으로 복구한다", function () {
  const storage = memoryStorage({
    [STORAGE_KEY_V2]: "{broken",
    [STORAGE_KEY_V1]: "also broken",
  });
  const loaded = loadStateFromStorage(storage);
  assert.equal(loaded.source, "default");
  assert.deepEqual(loaded.state, createDefaultState());
});

test("진행 중 boardIndexes를 포함한 v2 세션을 저장하고 복원한다", function () {
  const storage = memoryStorage();
  const state = createDefaultState();
  state.grid.session = {
    ...createGridSession({ startIndex: 40, endIndex: 80, boardSize: 16 }),
    active: true,
    paused: false,
    difficulty: "reading",
    scope: "40",
    reviewMode: false,
    correctCount: 0,
    wrongCount: 0,
    wrongIndexes: [],
    errorsByTarget: {},
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  saveStateToStorage(storage, state);
  const loaded = loadStateFromStorage(storage);
  assert.deepEqual(loaded.state.grid.session.boardIndexes, state.grid.session.boardIndexes);
  assert.equal(loaded.state.grid.session.targetCursor, 40);
  assert.equal(loaded.state.grid.session.supplyCursor, 56);
});

test("학습 기록 JSON은 왕복 가능하고 잘못된 인덱스는 거부한다", function () {
  const state = createDefaultState();
  state.progress[8] = {
    seenCount: 1,
    correctCount: 1,
    wrongCount: 0,
    currentStreak: 1,
    masteryLevel: 2,
    lastSeenAt: null,
    lastCorrectAt: null,
    lastWrongAt: null,
    dueAt: null,
  };
  assert.deepEqual(parseImportJson(createExportJson(state)).progress[8], state.progress[8]);
  const invalid = JSON.parse(createExportJson(state));
  invalid.state.progress[1001] = {};
  assert.throws(() => parseImportJson(JSON.stringify(invalid)), /인덱스/);
  assert.throws(() => parseImportJson("{}"), /v2 학습 기록/);
});
