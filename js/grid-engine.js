import { clamp, shuffleCopy, uniqueValidIndexes } from "./utils.js";

export function createIndexRange(startIndex, endIndex) {
  const start = clamp(Math.floor(Number(startIndex) || 0), 0, 1000);
  const end = clamp(Math.floor(Number(endIndex) || 0), start, 1000);
  return Array.from({ length: end - start }, function (_, offset) {
    return start + offset;
  });
}

export function createGridSession(options = {}) {
  const boardSize = [8, 16, 25].includes(Number(options.boardSize))
    ? Number(options.boardSize)
    : 16;
  const startIndex = clamp(Math.floor(Number(options.startIndex) || 0), 0, 999);
  const endIndex = clamp(
    Math.floor(Number(options.endIndex) || 1000),
    startIndex + 1,
    1000,
  );
  const suppliedOrder = Array.isArray(options.indexes)
    ? uniqueValidIndexes(options.indexes)
    : createIndexRange(startIndex, endIndex);
  const order = suppliedOrder.length > 0 ? suppliedOrder : [startIndex];
  const sessionEndIndex = Array.isArray(options.indexes)
    ? Math.min(1000, Math.max(...order) + 1)
    : endIndex;
  const liveCount = Math.min(boardSize, order.length);
  const boardIndexes = shuffleCopy(order.slice(0, liveCount), options.random);

  while (boardIndexes.length < boardSize) boardIndexes.push(null);

  return {
    engineVersion: 1,
    order,
    startIndex: order[0],
    endIndex: sessionEndIndex,
    boardSize,
    boardIndexes,
    targetPosition: 0,
    supplyPosition: liveCount,
    targetCursor: order[0],
    supplyCursor: order[liveCount] ?? sessionEndIndex,
    complete: false,
  };
}

export function selectGridIndex(session, selectedIndex) {
  const current = restoreGridSession(session);
  if (current.complete || selectedIndex !== current.targetCursor) {
    return {
      session: current,
      correct: false,
      changedSlot: -1,
      replacementIndex: null,
      completed: current.complete,
    };
  }

  const changedSlot = current.boardIndexes.indexOf(selectedIndex);
  if (changedSlot < 0) {
    throw new Error("현재 목표 글자가 보드에 없습니다.");
  }

  const boardIndexes = current.boardIndexes.slice();
  const replacementIndex =
    current.supplyPosition < current.order.length
      ? current.order[current.supplyPosition]
      : null;
  boardIndexes[changedSlot] = replacementIndex;

  const targetPosition = current.targetPosition + 1;
  const supplyPosition =
    replacementIndex === null ? current.supplyPosition : current.supplyPosition + 1;
  const complete = targetPosition >= current.order.length;
  const targetCursor = current.order[targetPosition] ?? current.endIndex;
  const supplyCursor = current.order[supplyPosition] ?? current.endIndex;

  return {
    session: {
      ...current,
      boardIndexes,
      targetPosition,
      supplyPosition,
      targetCursor,
      supplyCursor,
      complete,
    },
    correct: true,
    changedSlot,
    replacementIndex,
    completed: complete,
  };
}

export function restoreGridSession(value) {
  if (!value || value.engineVersion !== 1) {
    throw new Error("연속 그리드 저장 형식이 올바르지 않습니다.");
  }

  const order = uniqueValidIndexes(value.order);
  const boardSize = Number(value.boardSize);
  const targetPosition = Number(value.targetPosition);
  const supplyPosition = Number(value.supplyPosition);

  if (
    order.length === 0 ||
    ![8, 16, 25].includes(boardSize) ||
    !Number.isInteger(targetPosition) ||
    !Number.isInteger(supplyPosition) ||
    targetPosition < 0 ||
    targetPosition > order.length ||
    supplyPosition < targetPosition ||
    supplyPosition > order.length ||
    !Array.isArray(value.boardIndexes) ||
    value.boardIndexes.length !== boardSize
  ) {
    throw new Error("연속 그리드 저장 값이 유효하지 않습니다.");
  }

  const boardIndexes = value.boardIndexes.map(function (index) {
    if (index === null) return null;
    if (!Number.isInteger(index) || !order.includes(index)) {
      throw new Error("보드에 범위를 벗어난 글자가 있습니다.");
    }
    return index;
  });
  const activeSet = order.slice(targetPosition, supplyPosition).sort(function (a, b) {
    return a - b;
  });
  const boardSet = boardIndexes
    .filter(Number.isInteger)
    .slice()
    .sort(function (a, b) {
      return a - b;
    });

  if (
    activeSet.length !== boardSet.length ||
    activeSet.some(function (index, position) {
      return index !== boardSet[position];
    })
  ) {
    throw new Error("보드 상태와 공급 위치가 일치하지 않습니다.");
  }

  const endIndex = clamp(Math.floor(Number(value.endIndex) || 1000), 1, 1000);
  const complete = targetPosition >= order.length;
  const expectedTarget = order[targetPosition] ?? endIndex;
  const expectedSupply = order[supplyPosition] ?? endIndex;

  if (
    Number(value.targetCursor) !== expectedTarget ||
    Number(value.supplyCursor) !== expectedSupply ||
    Boolean(value.complete) !== complete
  ) {
    throw new Error("연속 그리드 커서가 저장된 보드와 일치하지 않습니다.");
  }

  return {
    engineVersion: 1,
    order,
    startIndex: order[0],
    endIndex,
    boardSize,
    boardIndexes,
    targetPosition,
    supplyPosition,
    targetCursor: expectedTarget,
    supplyCursor: expectedSupply,
    complete,
  };
}

export function getSessionProgress(session) {
  const current = restoreGridSession(session);
  return {
    completed: current.targetPosition,
    total: current.order.length,
    remaining: current.order.length - current.targetPosition,
  };
}
