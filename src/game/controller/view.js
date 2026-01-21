export function createViewManager({
  cameraPositions,
  cameraTargets,
  updateBoardLabelsForColor,
  getCameraSide,
  setCameraSide,
  setBaseRotationY,
  getSpinAngle,
  getTableGroup,
  getCamera,
  getControls
}) {
  function setViewForColor(color) {
    const tableGroup = getTableGroup();
    const camera = getCamera();
    const controls = getControls();
    if (!tableGroup || !camera || !controls) {
      return;
    }
    if (color === "b") {
      setCameraSide("black");
    } else {
      setCameraSide("white");
    }
    setBaseRotationY(0);
    const baseRotationY = 0;
    tableGroup.rotation.y = baseRotationY + getSpinAngle();
    const cameraSide = getCameraSide();
    camera.position.copy(cameraPositions[cameraSide]);
    controls.target.copy(cameraTargets[cameraSide]);
    updateBoardLabelsForColor(cameraSide === "black" ? "b" : "w");
  }

  return { setViewForColor };
}
