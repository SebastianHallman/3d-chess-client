export function createSelectionManager({
  boardSquaresById,
  moveHighlightSquares,
  setSquareMaterial,
  refreshSquareMaterial,
  invalidMaterial,
  gameState,
  getSelectedSquare: externalGetSelectedSquare,
  setSelectedSquare: externalSetSelectedSquare
}) {
  let selectedSquare = null;
  const readSelected = externalGetSelectedSquare || (() => selectedSquare);
  const writeSelected = externalSetSelectedSquare || ((value) => { selectedSquare = value; });

  function getSelectedSquare() {
    return readSelected();
  }

  function setSelectedSquare(next) {
    writeSelected(next);
  }

  function clearSelection() {
    const current = readSelected();
    if (!current) {
      return;
    }
    const previous = current;
    writeSelected(null);
    refreshSquareMaterial(previous);
  }

  function clearMoveHighlights() {
    const squares = Array.from(moveHighlightSquares);
    moveHighlightSquares.clear();
    for (const square of squares) {
      refreshSquareMaterial(square);
    }
  }

  function setMoveHighlights(squareIds) {
    clearMoveHighlights();
    for (const squareId of squareIds) {
      const square = boardSquaresById.get(squareId);
      if (!square) {
        continue;
      }
      moveHighlightSquares.add(square);
      refreshSquareMaterial(square);
    }
  }

  function flashInvalidMove(targetSquare) {
    const current = readSelected();
    if (current) {
      setSquareMaterial(current, invalidMaterial);
    }
    if (targetSquare && targetSquare !== current) {
      setSquareMaterial(targetSquare, invalidMaterial);
    }
    window.setTimeout(() => {
      const next = readSelected();
      if (next) {
        refreshSquareMaterial(next);
      }
      if (targetSquare && targetSquare !== next) {
        refreshSquareMaterial(targetSquare);
      }
    }, 220);
  }

  function isLegalDestination(from, to) {
    if (!from || !to) {
      return false;
    }
    const moves = gameState.getMoves(from);
    return moves.some((move) => move.to === to);
  }

  return {
    getSelectedSquare,
    setSelectedSquare,
    clearSelection,
    clearMoveHighlights,
    setMoveHighlights,
    flashInvalidMove,
    isLegalDestination
  };
}
