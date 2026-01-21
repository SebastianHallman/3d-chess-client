export function createBoardMaterialManager({
  lightSquare,
  darkSquare,
  moveMaterial,
  hoverMaterial,
  selectedMaterial,
  invalidMaterial,
  moveHighlightSquares,
  getSelectedSquare,
  getHoveredSquare
}) {
  function setSquareMaterial(square, material) {
    square.material = material;
  }

  function resetSquareMaterial(square) {
    square.material = square.userData.isDark ? darkSquare : lightSquare;
  }

  function refreshSquareMaterial(square) {
    if (square === getSelectedSquare()) {
      setSquareMaterial(square, selectedMaterial);
      return;
    }
    if (square === getHoveredSquare()) {
      setSquareMaterial(square, hoverMaterial);
      return;
    }
    if (moveHighlightSquares.has(square)) {
      setSquareMaterial(square, moveMaterial);
      return;
    }
    resetSquareMaterial(square);
  }

  return {
    setSquareMaterial,
    resetSquareMaterial,
    refreshSquareMaterial,
    invalidMaterial
  };
}
