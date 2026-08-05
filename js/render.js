export function createOverviewCell(item, options) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "overview-cell";
  button.dataset.index = String(item.index);
  button.title = options.concealMeaning
    ? `${item.character} · 눌러서 뜻과 읽기 확인`
    : options.meaningToggle
      ? `${item.contextHun} · 다시 눌러 뜻 가리기`
      : item.contextHun;
  button.setAttribute("aria-pressed", String(options.selected));
  if (options.meaningToggle) button.setAttribute("aria-expanded", String(options.revealed));
  if (options.selected) button.classList.add("is-selected");
  if (options.revealed) button.classList.add("is-revealed");
  button.setAttribute(
    "aria-label",
    options.meaningToggle
      ? options.revealed
        ? `${item.number}번째, ${item.contextHun}, 다시 누르면 뜻 가림`
        : `${item.number}번째 글자 ${item.character}, 뜻 가림, 눌러서 확인`
      : `${item.number}번째, ${item.contextHun}`,
  );
  button.innerHTML =
    `<span class="overview-cell__number">${item.number}</span>` +
    `<span class="overview-cell__hanja" lang="zh-Hant">${item.character}</span>` +
    `<span class="overview-cell__meaning"${options.concealMeaning ? ' aria-hidden="true"' : ""}>${item.contextHun}</span>`;
  return button;
}

export function createPassageCharacter(item, options) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "phrase-character";
  button.dataset.index = String(item.index);
  button.setAttribute("aria-pressed", String(options.selected));
  if (options.selected) button.classList.add("is-selected");
  button.setAttribute(
    "aria-label",
    options.concealReading
      ? `${item.number}번째 글자 ${item.character}`
      : `${item.number}번째 글자, ${item.contextHun}`,
  );
  button.innerHTML =
    `<span class="phrase-character__hanja" lang="zh-Hant">${item.character}</span>` +
    `<span class="phrase-character__reading">${item.reading}</span>`;
  return button;
}

export function renderBoardCellElement(button, item) {
  button.classList.remove("is-correct", "is-wrong", "is-hint", "is-empty");
  if (!item) {
    button.dataset.index = "";
    button.disabled = true;
    button.classList.add("is-empty");
    button.replaceChildren();
    button.setAttribute("aria-label", "빈 칸");
    return;
  }
  button.disabled = false;
  button.dataset.index = String(item.index);
  button.innerHTML = `<span class="board-cell__hanja" lang="zh-Hant">${item.character}</span>`;
  button.setAttribute("aria-label", `후보 글자 ${item.character}, ${item.number}번째`);
}

export function createReviewItem(item, options) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "review-item";
  button.dataset.index = String(item.index);
  button.setAttribute("aria-pressed", String(options.selected));
  button.setAttribute(
    "aria-label",
    `${item.contextHun}, 숙련도 ${options.masteryLevel}단계${options.selected ? ", 선택됨" : ""}`,
  );
  button.innerHTML =
    `<span class="review-item__number">${item.number}</span>` +
    `<span class="review-item__hanja" lang="zh-Hant">${item.character}</span>` +
    `<span class="review-item__meta">${item.reading} · <b class="review-item__level">${options.masteryLevel}단계</b></span>`;
  return button;
}
