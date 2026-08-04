import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("125개 기억 그림과 회상 화면은 UI와 오프라인 셸에 함께 연결된다", async function () {
  const [html, app, theme, serviceWorker, seasonalAtlas, ...memoryAtlases] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("theme-folio.css", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    stat(new URL("assets/learning-seasons-atlas.webp", root)),
    ...Array.from({ length: 16 }, function (_, index) {
      return stat(new URL(`assets/memory-atlas-${String(index + 1).padStart(2, "0")}.webp`, root));
    }),
  ]);

  assert.match(html, /theme-folio\.css/);
  assert.match(html, /app\.js\?v=10/);
  assert.match(html, /styles\.css\?v=10/);
  assert.match(html, /memory-scene__art/);
  assert.match(html, /id="passage-memory-image"/);
  assert.match(html, /id="passage-memory-clues"/);
  assert.doesNotMatch(html, /daily-path/);
  assert.doesNotMatch(html, /today-tools/);
  assert.match(app, /memory-atlas-/);
  assert.match(app, /createRandomDailyPick/);
  assert.match(app, /course-engine\.js\?v=10/);
  assert.match(app, /storage\.js\?v=10/);
  assert.match(theme, /learning-seasons-atlas\.webp/);
  assert.match(theme, /\.memory-clue/);
  assert.match(serviceWorker, /theme-folio\.css/);
  assert.match(serviceWorker, /1000cc-static-v10-20260805/);
  assert.match(serviceWorker, /assets\/learning-seasons-atlas\.webp/);
  assert.match(serviceWorker, /assets\/memory-atlas-16\.webp/);
  assert.ok(seasonalAtlas.size > 50_000);
  assert.ok(seasonalAtlas.size < 250_000);
  assert.equal(memoryAtlases.length, 16);
  memoryAtlases.forEach(function (atlas) {
    assert.ok(atlas.size > 100_000);
    assert.ok(atlas.size < 350_000);
  });
});
