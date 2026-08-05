import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("모바일 하단 메뉴와 큰 기억 그림은 v18 오프라인 셸에 함께 연결된다", async function () {
  const [html, app, styles, theme, serviceWorker, seasonalAtlas, ...memoryAtlases] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("theme-folio.css", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    stat(new URL("assets/learning-seasons-atlas.webp", root)),
    ...Array.from({ length: 16 }, function (_, index) {
      return stat(new URL(`assets/memory-atlas-${String(index + 1).padStart(2, "0")}.webp`, root));
    }),
  ]);

  assert.match(html, /theme-folio\.css/);
  assert.match(html, /app\.js\?v=18/);
  assert.match(html, /styles\.css\?v=18/);
  assert.equal((html.match(/data-mode=/g) || []).length, 3);
  assert.match(html, />1자 보기</);
  assert.match(html, />8자 보기</);
  assert.match(html, />한자 맞추기</);
  assert.match(html, /aria-label="설정 열기"/);
  const settingsButtonMarkup = html.match(/<button[^>]+id="settings-button"[\s\S]*?<\/button>/)?.[0];
  assert.ok(settingsButtonMarkup);
  assert.doesNotMatch(settingsButtonMarkup, />\s*설정\s*</);
  assert.doesNotMatch(html, />순서 게임</);
  assert.doesNotMatch(html, /id="reveal-answer"/);
  assert.doesNotMatch(html, />\s*정답 보기\s*</);
  assert.match(html, /<section class="related-words"/);
  assert.doesNotMatch(html, /<details class="related-words"/);
  assert.match(html, />\s*랜덤 8자\s*</);
  assert.doesNotMatch(html, />\s*다른 8자\s*</);
  assert.match(html, /memory-scene__art/);
  assert.match(html, /id="passage-memory-image"/);
  assert.match(html, /id="passage-memory-clues"/);
  assert.match(html, /class="matching-launch"/);
  assert.match(html, /class="matching-choices"/);
  assert.match(html, /class="shared-match-board"/);
  assert.ok(
    html.indexOf('class="character-inspector"') < html.indexOf('class="memory-study"'),
    "선택 글자 정보는 기억 그림보다 먼저 배치되어야 합니다.",
  );
  assert.doesNotMatch(html, /daily-path/);
  assert.doesNotMatch(html, /today-tools/);
  assert.doesNotMatch(html, /course-rail/);
  assert.doesNotMatch(html, /data-screen="review"/);
  assert.match(app, /memory-atlas-/);
  assert.match(app, /createRandomDailyPick/);
  assert.match(app, /createRandomDailyPick\(\{\}/);
  assert.doesNotMatch(app, /elements\.revealAnswer/);
  assert.match(app, /course-engine\.js\?v=18/);
  assert.match(app, /matching-engine\.js\?v=18/);
  assert.match(app, /storage\.js\?v=18/);
  assert.match(app, /tts-manager\.js\?v=18/);
  assert.match(app, /document\.body\.dataset\.screen = sharedChallengeDay !== null \? "challenge" : visibleMode/);
  assert.match(app, /selectedGloss\.removeAttribute\("aria-hidden"\)/);
  assert.match(app, /selectedReading\.removeAttribute\("aria-hidden"\)/);
  assert.match(app, /definition\.removeAttribute\("aria-hidden"\)/);
  assert.doesNotMatch(styles, /\.is-meaning-hidden[^{}]*#selected-gloss/);
  assert.doesNotMatch(styles, /\.is-reading-hidden[^{}]*#selected-reading/);
  assert.match(theme, /learning-seasons-atlas\.webp/);
  assert.match(theme, /\.memory-clue/);
  assert.match(theme, /\.memory-scene__art[\s\S]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(theme, /Compact 8-character view/);
  assert.doesNotMatch(theme, /\.related-words\[open\]/);
  assert.match(theme, /\.matching-choices/);
  assert.match(theme, /Mobile one-screen home and bottom navigation/);
  assert.match(theme, /\.primary-nav\s*\{[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/);
  assert.match(theme, /body\[data-screen="today"\][\s\S]*overflow:\s*hidden/);
  assert.match(theme, /\.today-stage\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(132px, 1fr\)/);
  assert.match(theme, /\.memory-scene__art\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*100%;/);
  assert.doesNotMatch(theme, /\.memory-scene__art\s*\{\s*width:\s*(?:46|62)px/);
  assert.match(theme, /\.today-hero__heading > :first-child[\s\S]*padding-left:\s*clamp\(30px, 3vw, 42px\)/);
  assert.match(theme, /\.overview-cell__meaning\s*\{[\s\S]*font-size:\s*clamp\(0\.82rem, 1\.45vw, 0\.94rem\)/);
  assert.match(serviceWorker, /theme-folio\.css/);
  assert.match(serviceWorker, /1000cc-static-v18-20260805/);
  assert.match(serviceWorker, /matching-engine\.js\?v=18/);
  assert.doesNotMatch(serviceWorker, /grid-engine/);
  assert.match(serviceWorker, /tts-manager\.js\?v=18/);
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
