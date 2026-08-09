import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const recognitionModuleVersions = {
  "js/adaptive-selector.js": 1,
  "js/confusion-engine.js": 1,
  "js/distractor-engine.js": 1,
  "js/recognition-engine.js": 1,
  "js/recognition-prompts.js": 1,
  "js/recognition-renderer.js": 1,
  "js/recognition-score.js": 1,
  "js/couplet-order-engine.js": 2,
  "js/sound-effects.js": 2,
};
const recognitionModulePaths = Object.keys(recognitionModuleVersions);

test("순지 필사판·반응형 조선 서첩·무한 한자 찾기 v38이 오프라인 셸에 함께 연결된다", async function () {
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
  const [html, app, dataModel, courseEngine, render, styles, theme, passageTheme, compactTheme, recognitionTheme, serviceWorker, storage, seasonalAtlas, titleFont, titleHanjaFont, atlasAssets, memoryAtlases, recognitionModules] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("js/data-model.js", root), "utf8"),
    readFile(new URL("js/course-engine.js", root), "utf8"),
    readFile(new URL("js/render.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("theme-folio.css", root), "utf8"),
    readFile(new URL("passage-folio-v25.css", root), "utf8"),
    readFile(new URL("compact-sunji-v26.css", root), "utf8"),
    readFile(new URL("styles/recognition-game.css", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("js/storage.js", root), "utf8"),
    stat(new URL("assets/learning-seasons-atlas.webp", root)),
    stat(new URL("assets/cheonjamun-title.woff", root)),
    stat(new URL("assets/cheonjamun-hanja.woff", root)),
    Promise.all(atlasAssetPaths.map(function (path) { return stat(new URL(path, root)); })),
    Promise.all(Array.from({ length: 16 }, function (_, index) {
      return stat(new URL(`assets/memory-atlas-${String(index + 1).padStart(2, "0")}.webp`, root));
    })),
    Promise.all(recognitionModulePaths.map(async function (path) {
      return [path, await readFile(new URL(path, root), "utf8")];
    })),
  ]);
  const recognitionSources = Object.fromEntries(recognitionModules);
  const recognitionModuleGraph = `${app}\n${Object.values(recognitionSources).join("\n")}`;

  assert.match(html, /theme-folio\.css/);
  assert.match(html, /theme-folio\.css\?v=27/);
  assert.match(html, /passage-folio-v25\.css\?v=26/);
  assert.match(html, /compact-sunji-v26\.css\?v=31/);
  assert.match(html, /styles\/recognition-game\.css\?v=3/);
  assert.match(html, /manifest\.webmanifest\?v=25/);
  assert.match(html, /app\.js\?v=38/);
  assert.match(html, /styles\.css\?v=25/);
  assert.match(styles, /html\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/);
  assert.match(styles, /body\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/);
  assert.doesNotMatch(styles, /(?:html|body)\s*\{[^}]*min-width:\s*320px/);
  assert.equal((html.match(/data-mode=/g) || []).length, 4);
  assert.match(html, />1자 보기</);
  assert.match(html, />8자 보기</);
  assert.match(html, />그림 기억</);
  assert.match(html, /id="memory-title">그림으로 기억하기</);
  assert.doesNotMatch(html, /암묵지/);
  assert.match(html, />한자 맞추기</);
  assert.match(html, /aria-label="설정 열기"/);
  assert.match(html, /id="couplet-position" aria-live="polite"/);
  assert.match(html, /id="couplet-meaning-title">8자 문맥 풀이/);
  assert.match(html, /id="passage-commentary" role="note" aria-labelledby="passage-commentary-title"/);
  assert.match(html, /id="passage-commentary-title">해설/);
  assert.match(html, /id="couplet-explanation"/);
  assert.ok(html.indexOf('id="couplet-meaning"') < html.indexOf('id="couplet-explanation"'));
  assert.ok(html.indexOf('id="couplet-explanation"') < html.indexOf('class="passage-actions"'));
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
  assert.match(html, /id="open-today-passage"[^>]*>상세 보기<\/button>/);
  assert.doesNotMatch(html, />8자로 보기<\/button>/);
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
  assert.match(html, /id="grid-title">무한 한자 찾기/);
  assert.match(html, /id="start-adaptive-match"/);
  assert.match(html, /id="start-random-match"/);
  assert.match(html, /id="start-order-match"/);
  assert.match(html, />랜덤 8자 순서 맞추기</);
  assert.match(html, />10세트 · 80글자</);
  assert.match(html, /id="setting-sound-effects"/);
  assert.match(html, /class="recognition-board"/);
  assert.match(html, /id="recognition-recall"/);
  assert.match(html, /id="recognition-order"/);
  assert.doesNotMatch(html, /id="replay-target"/);
  assert.doesNotMatch(html, /class="matching-(?:launch|choices)"/);
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
  assert.match(app, /course-engine\.js\?v=25/);
  assert.match(app, /data-model\.js\?v=35/);
  assert.match(dataModel, /lesson-content\.js\?v=35/);
  assert.match(courseEngine, /data-model\.js\?v=35/);
  assert.match(courseEngine, /lesson-content\.js\?v=35/);
  assert.match(app, /elements\.coupletExplanation\.textContent = couplet\.explanation/);
  assert.match(app, /elements\.passageCommentary\.setAttribute\("aria-hidden", String\(concealMeaning\)\)/);
  assert.match(app, /typeof word\.characterReading === "string"/);
  assert.match(app, /characterReading && characterReading !== selected\.reading/);
  assert.match(app, /이 말에서는 ‘\$\{characterReading\}’로 읽음/);
  assert.match(app, /matching-engine\.js\?v=24/);
  assert.match(app, /storage\.js\?v=27/);
  assert.match(app, /sound-effects\.js\?v=2/);
  assert.match(app, /tts-manager\.js\?v=26/);
  assert.match(app, /startAdaptiveMatch\.addEventListener\("click", startAdaptiveMatchingGame\)/);
  assert.match(app, /startOrderMatch\.addEventListener\("click", startRandomOrderGame\)/);
  assert.match(app, /endSession\.addEventListener\("click", exitGridSession\)/);
  assert.match(app, /selectRandomCoupletIndexes\(COUPLETS\.length, 10\)/);
  assert.match(app, /submitGridAnswer\(session, selectedSlot/);
  assert.match(app, /submitRecallAnswer\(session, choice\.index/);
  assert.match(app, /submitCoupletOrderAnswer\(session, selectedIndex/);
  assert.match(app, /pauseRecognitionSession/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(app, /replayTarget|gridWrongCount|resultWrong|speakGridTarget/);
  recognitionModulePaths.forEach(function (path) {
    const filename = path.split("/").at(-1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      recognitionModuleGraph,
      new RegExp(`(?:\\./js/|\\./)${filename}\\?v=${recognitionModuleVersions[path]}`),
    );
  });
  assert.match(app, /speakSequence\(createCoupletSpeechItems\(couplet\.data\)/);
  assert.match(app, /continuousSpeechItems/);
  assert.match(app, /if \(position % 2 !== 0\) return/);
  assert.match(app, /document\.body\.dataset\.sceneQuarter/);
  assert.match(app, /createOverviewIndexes\(rangeStart, overviewPageSize, TOTAL_CHARACTERS\)/);
  assert.match(app, /createOverviewRangeStarts\(overviewPageSize, TOTAL_CHARACTERS\)/);
  assert.match(app, /todayDashboard\.dataset\.courseQuarter/);
  assert.match(app, /elements\.todayMemoryScene\.textContent = lesson\.couplet\.data\.meaning/);
  assert.doesNotMatch(app, /elements\.todayMemoryScene\.textContent = lesson\.memoryScene/);
  assert.match(storage, /matching-engine\.js\?v=24/);
  assert.match(storage, /confusion-engine\.js\?v=1/);
  assert.match(app, /function renderMemoryMode\(\)/);
  assert.doesNotMatch(app, /elements\.passagePairs\.replaceChildren/);
  assert.match(app, /memoryClueRevealed\.size === 4/);
  assert.doesNotMatch(app, /memoryHeadingReading/);
  assert.match(app, /createOverviewIndexes/);
  assert.match(app, /shuffleOverviewIndexes/);
  assert.match(app, /shuffleOverviewIndexes\(indexes, secureRandomUnit\)/);
  assert.match(app, /function toggleOverviewShuffle\(\)/);
  assert.match(app, /isShuffled \? "원래 배열" : "랜덤 배열"/);
  assert.match(app, /concealNumber: isShuffled/);
  assert.match(render, /options\.concealNumber/);
  assert.match(render, /const numberPrefix = options\.concealNumber/);
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
  assert.match(compactTheme, /#screen-passage \.passage-commentary/);
  assert.match(compactTheme, /#screen-passage \.passage-meaning \.passage-commentary p/);
  assert.match(compactTheme, /overflow-wrap:\s*anywhere/);
  assert.match(compactTheme, /min-height:\s*max-content/);
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
  assert.match(recognitionTheme, /--recognition-canvas:/);
  assert.match(recognitionTheme, /\.recognition-board\[data-size="25"\]/);
  assert.match(recognitionTheme, /grid-template-columns:\s*repeat\(var\(--board-columns\)/);
  assert.match(recognitionTheme, /@media \(max-width: 360px\)/);
  assert.match(recognitionTheme, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(recognitionTheme, /\.recognition-feedback\s*\{[^}]*position:\s*fixed;/s);
  assert.match(recognitionTheme, /bottom:\s*calc\(var\(--mobile-nav-height, 66px\)/);
  assert.match(recognitionTheme, /max-height:\s*calc\(\s*100dvh/s);
  assert.match(recognitionTheme, /sunji-fiber-tile\.webp/);
  assert.doesNotMatch(recognitionTheme, /hanji-charcoal-tile\.webp/);
  assert.match(recognitionTheme, /--recognition-canvas:\s*#eee7d7/);
  assert.match(recognitionTheme, /hanji-ivory-tile\.webp/);
  assert.match(recognitionSources["js/adaptive-selector.js"], /export function selectTargetIndex/);
  assert.match(recognitionSources["js/confusion-engine.js"], /export function recordConfusionPair/);
  assert.match(recognitionSources["js/distractor-engine.js"], /export function selectDistractorIndexes/);
  assert.match(recognitionSources["js/recognition-engine.js"], /export function createRecognitionSession/);
  assert.match(recognitionSources["js/recognition-prompts.js"], /export function createGridPrompt/);
  assert.match(recognitionSources["js/recognition-renderer.js"], /export function renderRecognitionBoard/);
  assert.match(recognitionSources["js/recognition-score.js"], /export function scoreGridAnswer/);
  assert.match(recognitionSources["js/couplet-order-engine.js"], /export function createCoupletOrderSession/);
  assert.match(theme, /Mobile one-screen home and bottom navigation/);
  assert.match(theme, /\.primary-nav\s*\{[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/);
  assert.match(theme, /\.primary-nav\s*\{[\s\S]*background:\s*#f7f3eb;[\s\S]*touch-action:\s*auto/);
  assert.match(theme, /\.primary-nav button\s*\{[\s\S]*touch-action:\s*auto/);
  assert.doesNotMatch(theme, /\.primary-nav\s*\{[^}]*backdrop-filter/);
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
  assert.match(
    compactTheme,
    /#screen-passage \.related-words\s*\{[\s\S]*background-color:\s*#f5ead4;[\s\S]*var\(--sunji-fiber-image\)/,
  );
  assert.match(
    compactTheme,
    /#screen-passage \.related-word__definition\s*\{[\s\S]*font-size:\s*clamp\(0\.86rem, 1\.05vw, 0\.92rem\);[\s\S]*line-height:\s*1\.55/,
  );
  assert.match(
    compactTheme,
    /@media \(max-width: 660px\) and \(orientation: portrait\)[\s\S]*#screen-passage \.related-word__definition\s*\{[\s\S]*font-size:\s*clamp\(0\.82rem, 3\.5vw, 0\.9rem\);[\s\S]*line-height:\s*1\.5/,
  );
  assert.match(compactTheme, /#shuffle-today-lesson svg\s*\{[\s\S]*display:\s*block/);
  assert.match(html, /id="overview-shuffle"/);
  assert.match(
    compactTheme,
    /#screen-overview[\s\S]*\.overview-grid\.is-meaning-hidden[\s\S]*\.overview-cell:not\(\.is-revealed\)[\s\S]*\.overview-cell__meaning\s*\{[\s\S]*color:\s*transparent/,
  );
  assert.match(compactTheme, /@media \(max-width: 660px\) and \(orientation: portrait\)/);
  assert.match(
    compactTheme,
    /@media \(max-width: 660px\) and \(orientation: portrait\)[\s\S]*#screen-passage \.passage-card\s*\{[\s\S]*aspect-ratio:\s*auto;[\s\S]*min-height:\s*min\(calc\(177\.78vw - 28px\), 736px\)/,
  );
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
  assert.match(serviceWorker, /theme-folio\.css\?v=27/);
  assert.match(theme, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(serviceWorker, /1000cc-static-v40-20260809/);
  assert.match(serviceWorker, /styles\.css\?v=25/);
  assert.match(serviceWorker, /compact-sunji-v26\.css\?v=31/);
  assert.match(serviceWorker, /styles\/recognition-game\.css\?v=3/);
  assert.match(serviceWorker, /app\.js\?v=38/);
  assert.match(serviceWorker, /manifest\.webmanifest\?v=25/);
  assert.match(serviceWorker, /data-model\.js\?v=35/);
  assert.match(serviceWorker, /course-engine\.js\?v=25/);
  assert.match(serviceWorker, /lesson-content\.js\?v=35/);
  assert.match(serviceWorker, /review-scheduler\.js/);
  assert.match(serviceWorker, /assets\/cheonjamun-title\.woff/);
  assert.match(serviceWorker, /assets\/cheonjamun-hanja\.woff/);
  assert.match(serviceWorker, /matching-engine\.js\?v=24/);
  assert.doesNotMatch(serviceWorker, /grid-engine/);
  assert.match(serviceWorker, /progress-engine\.js\?v=1/);
  recognitionModulePaths.forEach(function (path) {
    assert.ok(
      serviceWorker.includes(`./${path}?v=${recognitionModuleVersions[path]}`),
      `${path}는 오프라인 앱 셸에 포함되어야 합니다.`,
    );
  });
  assert.match(serviceWorker, /tts-manager\.js\?v=26/);
  assert.match(serviceWorker, /assets\/learning-seasons-atlas\.webp/);
  assert.match(serviceWorker, /passage-folio-v25\.css\?v=26/);
  assert.match(serviceWorker, /compact-sunji-v26\.css\?v=31/);
  assert.match(serviceWorker, /app\.js\?v=38/);
  assert.match(serviceWorker, /data-model\.js\?v=35/);
  assert.match(serviceWorker, /character-word-supplements\.js\?v=34/);
  assert.match(serviceWorker, /storage\.js\?v=27/);
  assert.match(serviceWorker, /request\.destination === "script"/);
  const scriptNetworkFirst = serviceWorker.match(
    /if \(request\.destination === "script"\) \{[\s\S]*?event\.respondWith\([\s\S]*?fetch\(request\)[\s\S]*?\.catch\(function \(\) \{[\s\S]*?caches\.match\(request\)[\s\S]*?return;/,
  );
  assert.ok(scriptNetworkFirst, "자바스크립트 모듈은 네트워크 우선·캐시 대체 전략이어야 합니다.");
  assert.match(serviceWorker, /overview-layout\.js\?v=28/);
  assert.match(serviceWorker, /render\.js\?v=29/);
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
