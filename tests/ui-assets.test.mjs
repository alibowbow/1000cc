import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("서책 테마와 수묵 아틀라스는 화면과 오프라인 셸에 함께 연결된다", async function () {
  const [html, theme, serviceWorker, atlas] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("theme-folio.css", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    stat(new URL("assets/learning-seasons-atlas.webp", root)),
  ]);

  assert.match(html, /theme-folio\.css/);
  assert.match(html, /memory-scene__art/);
  assert.match(theme, /learning-seasons-atlas\.webp/);
  assert.match(theme, /data-course-quarter="3"/);
  assert.match(serviceWorker, /theme-folio\.css/);
  assert.match(serviceWorker, /assets\/learning-seasons-atlas\.webp/);
  assert.ok(atlas.size > 50_000);
  assert.ok(atlas.size < 250_000);
});
