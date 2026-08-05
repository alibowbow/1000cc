import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("순지 필사판과 반응형 조선 서첩 v28 학습 모드가 오프라인 셸에 함께 연결된다", async function () {
  const atlasAssetPaths = [
    "assets/joseon-folio-spread.webp",
    "assets/joseon-folio-single.webp",
    "assets/sunji-fiber-tile.webp",
    "assets/study-canvas-atmosphere.webp",
    "assets/hanji-ivory-tile.webp",
    "assets/hanji-gray-tile.webp",
    "assets/hanji-charcoal-tile.webp",
    "assets/ink-wash-tile.webp",
    "assets/ui-listen.webp",
    "assets/ui-shuffle.webp",
    "assets/ui-share.webp",
    "assets/ui-settings.webp",
    "assets/ui-single.webp",
    "assets/ui-eight.webp",
    "assets/ui-quiz.webp",
    "assets/ui-bookmark.webp",
    "assets/ui-bamboo.webp",
    "assets/ui-mountains.webp",
  ];
  const [html, app, styles, theme, passageTheme, compactTheme, serviceWorker, storage, seasonalAtlas, titleFont, titleHanjaFont, atlasAssets, memoryAtlases] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("theme-folio.css", root), "utf8"),
    readFile(new URL("passage-folio-v25.css", root), "utf8"),
    readFile(new URL("compact-sunji-v26.css", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("js/storage.js", root), "utf8"),
    stat(new URL("assets/learning-seasons-atlas.webp", root)),
    stat(new URL("assets/cheonjamun-title.woff", root)),
    stat(new URL("assets/cheonjamun-hanja.woff", root)),
    Promise.all(atlasAssetPaths.map(function (path) { return stat(new URL(path, root)); })),
    Promise.all(Array.from({ length: 16 }, function (_, index) {
      return stat(new URL(`assets/memory-atlas-${String(index + 1).padStart(2, "0")}.webp`, root));
    })),
  ]);

  assert.match(html, /theme-folio\.css/);
  assert.match(html, /theme-folio\.css\?v=26/);
  assert.match(html, /passage-folio-v25\.css\?v=26/);
  assert.match(html, /compact-sunji-v26\.css\?v=28/);
  assert.match(html, /app\.js\?v=28/);
  assert.match(html, /styles\.css\?v=24/);
  assert.equal((html.match(/data-mode=/g) || []).length, 4);
  assert.match(html, />1자 보기</);
  assert.match(html, />8자 보기</);
  assert.match(html, />그림 기억</);
  assert.match(html, /id="memory-title">그림으로 기억하기</);
  assert.doesNotMatch(html, /암묵지/);
  assert.match(html, />한자 맞추기</);
  assert.match(html, /aria-label="설정 열기"/);
  assert.match(html, /id="couplet-position" aria-live="polite"/);
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
  assert.match(html, /id="today-range-reading"/);
  assert.doesNotMatch(html, />\s*전체 뜻\s*</);
  assert.doesNotMatch(html, />\s*기억 그림\s*</);
  assert.doesNotMatch(html, /id="today-meaning"/);
  assert.match(html, />8자 듣기</);
  assert.match(html, /memory-scene__art/);
  assert.ok(
    html.indexOf('id="today-characters"') < html.indexOf('id="today-memory-scene"') &&
      html.indexOf('id="today-memory-scene"') < html.indexOf('class="memory-scene"'),
    "8자 뜻풀이는 그림 칸이 아니라 8자 선택판 바로 아래에 있어야 합니다.",
  );
  assert.ok(
    html.indexOf('class="today-actions"') < html.indexOf('class="memory-scene"'),
    "오늘의 행동 버튼은 8자 학습 묶음 안에 있어야 합니다.",
  );
  assert.match(html, /data-screen="memory"/);
  assert.match(html, /id="memory-image"/);
  assert.match(html, /id="memory-clues"/);
  assert.match(html, /id="memory-progress"/);
  assert.match(html, /id="memory-pairs"/);
  assert.match(html, /id="memory-answer"/);
  assert.doesNotMatch(html, /id="memory-heading-reading"/);
  assert.doesNotMatch(html, /id="passage-pairs"/);
  assert.doesNotMatch(html, />두 글자 흐름</);
  assert.match(html, />정답 확인</);
  assert.match(html, /class="matching-launch"/);
  assert.match(html, /class="matching-choices"/);
  assert.match(html, /class="shared-match-board"/);
  assert.doesNotMatch(html, /class="memory-study"/);
  assert.ok(
    html.indexOf('class="character-inspector"') < html.indexOf('data-screen="memory"'),
    "8자 선택 글자 정보와 그림 기억 화면은 서로 분리되어야 합니다.",
  );
  assert.doesNotMatch(html, /daily-path/);
  assert.doesNotMatch(html, /today-tools/);
  assert.doesNotMatch(html, /course-rail/);
  assert.doesNotMatch(html, /data-screen="review"/);
  assert.match(app, /memory-atlas-/);
  assert.match(app, /createRandomDailyPick/);
  assert.match(app, /createRandomDailyPick\(\{\}/);
  assert.doesNotMatch(app, /elements\.revealAnswer/);
  assert.doesNotMatch(app, /passagePairs/);
  assert.match(app, /course-engine\.js\?v=24/);
  assert.match(app, /matching-engine\.js\?v=24/);
  assert.match(app, /storage\.js\?v=24/);
  assert.match(app, /tts-manager\.js\?v=24/);
  assert.match(app, /document\.body\.dataset\.sceneQuarter/);
  assert.match(app, /createOverviewIndexes\(rangeStart, overviewPageSize, TOTAL_CHARACTERS\)/);
  assert.match(app, /createOverviewRangeStarts\(overviewPageSize, TOTAL_CHARACTERS\)/);
  assert.match(app, /todayDashboard\.dataset\.courseQuarter/);
  assert.match(storage, /matching-engine\.js\?v=24/);
  assert.match(app, /function renderMemoryMode\(\)/);
  assert.doesNotMatch(app, /elements\.passagePairs\.replaceChildren/);
  assert.match(app, /memoryClueRevealed\.size === 4/);
  assert.doesNotMatch(app, /memoryHeadingReading/);
  assert.match(app, /createOverviewIndexes/);
  assert.match(app, /shuffleOverviewIndexes/);
  assert.match(app, /shuffleOverviewIndexes\(indexes, secureRandomUnit\)/);
  assert.match(app, /state\.ui\.mode = "memory"/);
  assert.doesNotMatch(app, /todayMeaning/);
  assert.match(app, /document\.body\.dataset\.screen = sharedChallengeDay !== null \? "challenge" : visibleMode/);
  assert.match(app, /selectedGloss\.removeAttribute\("aria-hidden"\)/);
  assert.match(app, /selectedReading\.removeAttribute\("aria-hidden"\)/);
  assert.match(app, /definition\.removeAttribute\("aria-hidden"\)/);
  assert.doesNotMatch(styles, /\.is-meaning-hidden[^{}]*#selected-gloss/);
  assert.doesNotMatch(styles, /\.is-reading-hidden[^{}]*#selected-reading/);
  assert.match(theme, /learning-seasons-atlas\.webp/);
  assert.match(theme, /ImageGen folio atlas/);
  assert.match(theme, /hanji-ivory-tile\.webp/);
  assert.match(theme, /hanji-charcoal-tile\.webp/);
  assert.match(theme, /ui-listen\.webp/);
  assert.match(theme, /ui-shuffle\.webp/);
  assert.match(theme, /ui-share\.webp/);
  assert.match(theme, /ui-settings\.webp/);
  assert.match(theme, /ui-single\.webp/);
  assert.match(theme, /ui-eight\.webp/);
  assert.match(theme, /ui-quiz\.webp/);
  assert.match(theme, /\.memory-clue/);
  assert.match(theme, /v25 · 펼친 조선 서첩/);
  assert.match(theme, /joseon-folio-spread\.webp/);
  assert.doesNotMatch(theme, /seodang-study-room\.webp/);
  assert.match(passageTheme, /font-size:\s*clamp\(2\.85rem, 68cqi, 4\.65rem\)/);
  assert.match(theme, /@media \(max-width: 1080px\)/);
  assert.match(theme, /v24 · keep the masthead title/);
  assert.match(theme, /font-family:\s*"Cheonjamun Title"/);
  assert.match(theme, /font-family:\s*"Cheonjamun Hanja"/);
  assert.match(theme, /\.brand\s*\{[\s\S]*flex-wrap:\s*nowrap;[\s\S]*white-space:\s*nowrap;[\s\S]*word-break:\s*keep-all/);
  assert.match(theme, /\.brand__ko\s*\{[\s\S]*letter-spacing:\s*0/);
  assert.match(theme, /@media \(min-width:\s*661px\) and \(max-width:\s*820px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 48px/);
  assert.match(theme, /\.tacit-stage/);
  assert.match(theme, /\.tacit-visual/);
  assert.match(theme, /\.tacit-pairs/);
  assert.match(theme, /\.tacit-stage\s*\{[\s\S]*align-content:\s*center/);
  assert.match(theme, /\.tacit-visual-panel\s*\{[\s\S]*aspect-ratio:\s*3 \/ 4;[\s\S]*container-type:\s*size/);
  assert.match(theme, /\.tacit-visual\s*\{[\s\S]*width:\s*min\(100%, calc\(100cqh \* 3 \/ 4\)\);[\s\S]*height:\s*auto;[\s\S]*aspect-ratio:\s*3 \/ 4/);
  assert.match(theme, /body\[data-screen="memory"\][\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden/);
  assert.match(theme, /body\[data-screen="memory"\] \.app-shell[\s\S]*flex:\s*1 1 0;[\s\S]*overflow:\s*hidden/);
  assert.match(theme, /#screen-memory:not\(\[hidden\]\)[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(theme, /\.tacit-recall\s*\{[\s\S]*position:\s*absolute;[\s\S]*height:\s*clamp\(214px, 28dvh, 236px\)/);
  assert.doesNotMatch(passageTheme, /#screen-passage #passage-pairs/);
  assert.doesNotMatch(theme, /#screen-passage #passage-pairs/);
  assert.match(theme, /\.memory-scene__art[\s\S]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(theme, /Compact 8-character view/);
  assert.doesNotMatch(theme, /\.related-words\[open\]/);
  assert.match(theme, /\.matching-choices/);
  assert.match(theme, /Mobile one-screen home and bottom navigation/);
  assert.match(theme, /\.primary-nav\s*\{[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/);
  assert.match(theme, /body\[data-screen="today"\][\s\S]*overflow:\s*hidden/);
  assert.match(theme, /\.today-stage\s*\{[\s\S]*grid-template-rows:\s*auto auto auto minmax\(112px, 1fr\) auto/);
  assert.match(theme, /\.memory-scene__art\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*100%;/);
  assert.doesNotMatch(theme, /\.memory-scene__art\s*\{\s*width:\s*(?:46|62)px/);
  assert.match(theme, /\.today-hero__heading > :first-child[\s\S]*padding-left:\s*clamp\(30px, 3vw, 42px\)/);
  assert.match(theme, /\.overview-cell__meaning\s*\{[\s\S]*font-size:\s*clamp\(0\.82rem, 1\.45vw, 0\.94rem\)/);
  assert.match(theme, /\.today-hero__range > strong\s*\{[\s\S]*font-size:\s*clamp\(1\.08rem, 1\.75vw, 1\.38rem\)/);
  assert.match(passageTheme, /#screen-passage \.passage-actions button\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(compactTheme, /--sunji-fiber-image:\s*url\("\.\/assets\/sunji-fiber-tile\.webp"\)/);
  assert.match(compactTheme, /--folio-single-image:\s*url\("\.\/assets\/joseon-folio-single\.webp"\)/);
  assert.match(compactTheme, /--study-atmosphere-image:\s*url\("\.\/assets\/study-canvas-atmosphere\.webp"\)/);
  assert.match(compactTheme, /#screen-overview \.overview-grid\s*\{[\s\S]*repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(compactTheme, /@media \(max-width: 660px\)[\s\S]*#screen-overview \.overview-grid[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(compactTheme, /\.overview-cell__reading\s*\{[\s\S]*color:\s*var\(--cinnabar-deep\)/);
  assert.match(compactTheme, /#shuffle-today-lesson svg\s*\{[\s\S]*display:\s*block/);
  assert.match(html, /id="overview-shuffle"/);
  assert.match(
    compactTheme,
    /#screen-overview[\s\S]*\.overview-grid\.is-meaning-hidden[\s\S]*\.overview-cell:not\(\.is-revealed\)[\s\S]*\.overview-cell__meaning\s*\{[\s\S]*color:\s*transparent/,
  );
  assert.match(compactTheme, /@media \(max-width: 660px\) and \(orientation: portrait\)/);
  assert.match(compactTheme, /aspect-ratio:\s*9 \/ 16/);
  assert.match(compactTheme, /aspect-ratio:\s*3 \/ 2/);
  assert.match(compactTheme, /background-size:\s*auto, contain, 512px 512px/);
  assert.match(passageTheme, /grid-template-areas:[\s\S]*"folio-header folio-header"[\s\S]*"sequence sequence"[\s\S]*"main inspector"/);
  assert.match(passageTheme, /#screen-passage \.passage-sequence\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 20px minmax\(0, 1fr\)/);
  assert.match(passageTheme, /#screen-passage \.character-inspector\s*\{[\s\S]*top:\s*auto/);
  const passageInspectorRule = passageTheme.match(
    /#screen-passage \.character-inspector\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(passageInspectorRule);
  assert.match(passageInspectorRule, /background:\s*none/);
  assert.doesNotMatch(passageInspectorRule, /ui-bamboo\.webp/);
  assert.doesNotMatch(theme, /#screen-passage \.passage-card::after,\s*#screen-grid \.matching-launch::after/);
  assert.match(theme, /\.today-actions \.primary-action\s*\{[\s\S]*min-width:\s*118px[\s\S]*min-height:\s*40px/);
  assert.match(theme, /--mobile-nav-height:\s*58px/);
  assert.match(serviceWorker, /theme-folio\.css/);
  assert.match(theme, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(serviceWorker, /1000cc-static-v28-20260806/);
  assert.match(serviceWorker, /assets\/cheonjamun-title\.woff/);
  assert.match(serviceWorker, /assets\/cheonjamun-hanja\.woff/);
  assert.match(serviceWorker, /matching-engine\.js\?v=24/);
  assert.doesNotMatch(serviceWorker, /grid-engine/);
  assert.match(serviceWorker, /tts-manager\.js\?v=24/);
  assert.match(serviceWorker, /assets\/learning-seasons-atlas\.webp/);
  assert.match(serviceWorker, /passage-folio-v25\.css\?v=26/);
  assert.match(serviceWorker, /compact-sunji-v26\.css\?v=28/);
  assert.match(serviceWorker, /app\.js\?v=28/);
  assert.match(serviceWorker, /overview-layout\.js\?v=28/);
  assert.match(serviceWorker, /render\.js\?v=28/);
  assert.match(serviceWorker, /assets\/joseon-folio-spread\.webp/);
  assert.match(serviceWorker, /assets\/joseon-folio-single\.webp/);
  assert.match(serviceWorker, /assets\/sunji-fiber-tile\.webp/);
  assert.match(serviceWorker, /assets\/study-canvas-atmosphere\.webp/);
  assert.doesNotMatch(serviceWorker, /assets\/seodang-study-room\.webp/);
  assert.doesNotMatch(serviceWorker, /assets\/ui-asset-atlas-v1\.webp/);
  assert.doesNotMatch(serviceWorker, /assets\/ui-directions\.webp/);
  assert.match(serviceWorker, /assets\/hanji-ivory-tile\.webp/);
  assert.match(serviceWorker, /assets\/ui-listen\.webp/);
  assert.match(serviceWorker, /assets\/memory-atlas-16\.webp/);
  assert.ok(seasonalAtlas.size > 50_000);
  assert.ok(seasonalAtlas.size < 250_000);
  assert.ok(titleFont.size > 1_000);
  assert.ok(titleFont.size < 20_000);
  assert.ok(titleHanjaFont.size > 1_000);
  assert.ok(titleHanjaFont.size < 20_000);
  assert.equal(atlasAssets.length, atlasAssetPaths.length);
  atlasAssets.forEach(function (asset) {
    assert.ok(asset.size > 2_000);
    assert.ok(asset.size < 180_000);
  });
  assert.equal(memoryAtlases.length, 16);
  memoryAtlases.forEach(function (atlas) {
    assert.ok(atlas.size > 100_000);
    assert.ok(atlas.size < 350_000);
  });
});
