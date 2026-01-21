export function boardToWorld(file, rank, boardSize, squareSize) {
  return {
    x: file - boardSize / 2 + squareSize / 2,
    z: boardSize / 2 - squareSize / 2 - rank
  };
}

export function squareToCoords(squareId, boardSize) {
  if (!squareId || squareId.length < 2) {
    return null;
  }
  const fileChar = squareId[0].toLowerCase();
  const rankChar = squareId[1];
  const file = fileChar.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(rankChar) - 1;
  if (Number.isNaN(rank) || file < 0 || file >= boardSize || rank < 0 || rank >= boardSize) {
    return null;
  }
  return { file, rank };
}

export function coordsToSquare(file, rank) {
  const fileChar = String.fromCharCode("a".charCodeAt(0) + file);
  return `${fileChar}${rank + 1}`;
}

export function getCapturePosition(color, index, captureLayout) {
  const isWhite = color === "w";
  const column = Math.floor(index / captureLayout.perColumn);
  const slot = index % captureLayout.perColumn;
  const direction = isWhite ? 1 : -1;
  const xBase = direction * captureLayout.xOffset;
  return {
    x: xBase + direction * column * captureLayout.columnOffset,
    y: captureLayout.yOffset,
    z: captureLayout.zStart - slot * captureLayout.spacing
  };
}
