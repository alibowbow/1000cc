import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

function createFakeElement() {
  const attributes = new Map();
  return {
    className: "",
    classList: { add() {} },
    dataset: {},
    innerHTML: "",
    title: "",
    type: "",
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
  };
}

test("랜덤 배열 버튼은 원래 배열 복귀 동작으로 전환된다", async function () {
  const [app, html, serviceWorker] = await Promise.all([
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
  ]);

  assert.match(app, /overviewShuffle\.addEventListener\("click", toggleOverviewShuffle\)/);
  assert.match(app, /if \(isShuffled\) \{[\s\S]*resetOverviewShuffle\(\);[\s\S]*renderOverview\(\);[\s\S]*원래 순서로 되돌렸습니다/);
  assert.match(app, /isShuffled \? "원래 배열" : "랜덤 배열"/);
  assert.match(app, /concealNumber: isShuffled/);
  assert.doesNotMatch(app, /function shuffleOverviewGrid\(\)/);
  assert.match(html, /id="overview-shuffle"[^>]*aria-pressed="false"/);
  assert.match(html, /app\.js\?v=34/);
  assert.match(serviceWorker, /1000cc-static-v35-20260807/);
  assert.match(serviceWorker, /render\.js\?v=29/);
});

test("랜덤 배열에서는 순번을 화면과 읽기 안내에서 숨긴다", async function () {
  globalThis.document = {
    createElement: createFakeElement,
  };
  const { createOverviewCell } = await import("../js/render.js");
  const item = {
    index: 7,
    number: 8,
    character: "荒",
    contextHun: "거칠 황",
    gloss: "거칠",
    reading: "황",
  };
  const baseOptions = {
    concealMeaning: false,
    meaningToggle: false,
    revealed: false,
    selected: false,
  };

  const shuffledCell = createOverviewCell(item, {
    ...baseOptions,
    concealNumber: true,
  });
  assert.doesNotMatch(shuffledCell.innerHTML, /overview-cell__number/);
  assert.doesNotMatch(shuffledCell.getAttribute("aria-label"), /8번째/);

  const restoredCell = createOverviewCell(item, {
    ...baseOptions,
    concealNumber: false,
  });
  assert.match(restoredCell.innerHTML, /overview-cell__number">8/);
  assert.match(restoredCell.getAttribute("aria-label"), /8번째/);
});
