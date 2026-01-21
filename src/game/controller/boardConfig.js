export function createBoardConfig() {
  const boardSize = 8;
  const squareSize = 1;
  const captureLayout = {
    perColumn: 8,
    spacing: 0.8,
    columnOffset: 0.7,
    xOffset: boardSize / 2 + 1.4,
    zStart: boardSize / 2 - 0.4,
    yOffset: 0.05
  };

  const cameraDistance = 12;
  const cameraHeight = 10;
  const cameraTargets = {
    white: [0, 0, 0],
    black: [0, 0, 0]
  };
  const cameraPositions = {
    white: [0, cameraHeight, cameraDistance],
    black: [0, cameraHeight, -cameraDistance]
  };

  return {
    boardSize,
    squareSize,
    captureLayout,
    cameraDistance,
    cameraHeight,
    cameraTargets,
    cameraPositions
  };
}
