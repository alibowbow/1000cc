export function renderRecognitionBoard(container, options = {}) {
  const indexes = Array.isArray(options.boardIndexes) ? options.boardIndexes : [];
  const characters = Array.isArray(options.characters) ? options.characters : [];
  const selectedIndex = Number.isInteger(options.selectedIndex) ? options.selectedIndex : null;
  const correctIndex = Number.isInteger(options.correctIndex) ? options.correctIndex : null;
  const changedSlot = Number.isInteger(options.changedSlot) ? options.changedSlot : -1;
  const disabled = Boolean(options.disabled);
  const requestedFocusIndex = Number.isInteger(options.focusIndex) ? options.focusIndex : indexes[0];
  const focusIndex = indexes.includes(requestedFocusIndex) ? requestedFocusIndex : indexes[0];
  const columns = getRecognitionColumns(indexes.length);
  const fragment = document.createDocumentFragment();

  for (let rowStart = 0; rowStart < indexes.length; rowStart += columns) {
    const row = document.createElement("div");
    row.className = "recognition-grid-row";
    row.setAttribute("role", "row");
    indexes.slice(rowStart, rowStart + columns).forEach(function (index, column) {
      const slot = rowStart + column;
      const item = characters[index];
      if (!item) return;
      const cell = document.createElement("div");
      const button = document.createElement("button");
      cell.className = "recognition-gridcell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-rowindex", String(Math.floor(slot / columns) + 1));
      cell.setAttribute("aria-colindex", String(column + 1));
      button.type = "button";
      button.className = "recognition-cell";
      button.dataset.index = String(index);
      button.dataset.slot = String(slot);
      button.setAttribute("aria-label", `후보 한자 ${item.character}`);
      button.tabIndex = index === focusIndex ? 0 : -1;
      button.disabled = disabled;
      if (index === selectedIndex && index !== correctIndex) button.classList.add("is-wrong");
      if (index === correctIndex) {
        button.classList.add("is-correct");
        button.setAttribute("aria-label", `정답 한자 ${item.character}`);
      }
      if (slot === changedSlot) button.classList.add("is-replaced");
      const glyph = document.createElement("span");
      glyph.className = "recognition-cell__hanja";
      glyph.lang = "zh-Hant";
      glyph.textContent = item.character;
      button.append(glyph);
      cell.append(button);
      row.append(cell);
    });
    fragment.append(row);
  }

  container.dataset.size = String(indexes.length);
  container.setAttribute("aria-label", `한자 후보 ${indexes.length}칸`);
  container.setAttribute("aria-rowcount", String(Math.ceil(indexes.length / columns)));
  container.setAttribute("aria-colcount", String(columns));
  container.replaceChildren(fragment);
}

export function renderRecallChoices(container, recall, options = {}) {
  const choices = Array.isArray(recall && recall.choices) ? recall.choices : [];
  const selectedChoice = Number.isInteger(options.selectedChoice) ? options.selectedChoice : -1;
  const correctChoice = Number.isInteger(options.correctChoice) ? options.correctChoice : -1;
  const disabled = Boolean(options.disabled);
  const fragment = document.createDocumentFragment();

  choices.forEach(function (choice, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.choice = String(index);
    button.textContent = typeof choice === "string" ? choice : choice.label;
    button.tabIndex = index === 0 ? 0 : -1;
    button.disabled = disabled;
    if (index === selectedChoice && index !== correctChoice) button.classList.add("is-wrong");
    if (index === correctChoice) button.classList.add("is-correct");
    fragment.append(button);
  });
  container.replaceChildren(fragment);
}

export function renderCoupletOrderBoard(container, session, characters, options = {}) {
  const indexes = Array.isArray(session && session.tileIndexes) ? session.tileIndexes : [];
  const selected = new Set(Array.isArray(session && session.placedIndexes) ? session.placedIndexes : []);
  const wrongIndex = Number.isInteger(options.wrongIndex) ? options.wrongIndex : null;
  const requestedFocusSlot = Number.isInteger(options.focusSlot) ? options.focusSlot : 0;
  const firstAvailableSlot = indexes.findIndex(function (index) { return !selected.has(index); });
  const focusSlot = indexes[requestedFocusSlot] !== undefined && !selected.has(indexes[requestedFocusSlot])
    ? requestedFocusSlot
    : firstAvailableSlot;
  const columns = 4;
  const fragment = document.createDocumentFragment();

  for (let rowStart = 0; rowStart < indexes.length; rowStart += columns) {
    const row = document.createElement("div");
    row.className = "recognition-grid-row";
    row.setAttribute("role", "row");
    indexes.slice(rowStart, rowStart + columns).forEach(function (index, column) {
      const slot = rowStart + column;
      const item = characters[index];
      if (!item) return;
      const cell = document.createElement("div");
      const button = document.createElement("button");
      cell.className = "recognition-gridcell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-rowindex", String(Math.floor(slot / columns) + 1));
      cell.setAttribute("aria-colindex", String(column + 1));
      button.type = "button";
      button.className = "recognition-cell";
      button.dataset.index = String(index);
      button.dataset.slot = String(slot);
      button.setAttribute("aria-label", `순서 후보 ${item.character}`);
      button.setAttribute("aria-pressed", String(selected.has(index)));
      button.tabIndex = slot === focusSlot ? 0 : -1;
      button.disabled = selected.has(index) || Boolean(options.disabled);
      if (index === wrongIndex) button.classList.add("is-wrong");
      const glyph = document.createElement("span");
      glyph.className = "recognition-cell__hanja";
      glyph.lang = "zh-Hant";
      glyph.textContent = item.character;
      button.append(glyph);
      cell.append(button);
      row.append(cell);
    });
    fragment.append(row);
  }
  container.setAttribute("aria-rowcount", "2");
  container.setAttribute("aria-colcount", "4");
  container.replaceChildren(fragment);
}

export function getRecognitionColumns(boardSize) {
  return Number(boardSize) === 25 ? 5 : 4;
}

export function describeCharacterDifference(correct, selected) {
  if (!correct || !selected) return "두 글자의 모양과 훈음을 함께 비교해 보세요.";
  if (correct.reading !== selected.reading) {
    if (correct.radical === selected.radical) {
      return `같은 ${correct.radical} 부수이지만 독음이 ${selected.reading}와 ${correct.reading}으로 다릅니다.`;
    }
    return `독음이 ${selected.reading}와 ${correct.reading}으로 다릅니다.`;
  }
  if (correct.radical === selected.radical) {
    const difference = Math.abs(Number(correct.totalStrokes) - Number(selected.totalStrokes));
    if (difference > 0) return `같은 독음과 부수지만 총획이 ${difference}획 차이 납니다.`;
    return "독음과 획수가 비슷하니 뜻과 글자 모양을 함께 구별해 보세요.";
  }
  if (correct.gloss && selected.gloss && correct.gloss !== selected.gloss) {
    return `독음은 같지만 뜻이 ‘${selected.gloss}’와 ‘${correct.gloss}’으로 다릅니다.`;
  }
  return "부수와 획수, 뜻을 함께 비교해 보세요.";
}
