import * as THREE from "three";

export function createSceneInteraction(params) {
  const {
    listen,
    renderer,
    camera,
    controls,
    tableGroup,
    boardGroup,
    piecesGroup,
    boardSquaresById,
    isInteractionEnabled,
    getPointerFromEvent,
    pickSquare,
    pickPiece,
    getDragIntersection,
    refreshSquareMaterial,
    clearSelection,
    clearMoveHighlights,
    setMoveHighlights,
    flashInvalidMove,
    isLegalDestination,
    attemptMove,
    placePieceOnSquare,
    gameState,
    getLiveGameId,
    getLiveGameColor,
    getSelectedSquare,
    setSelectedSquare,
    getHoveredSquare,
    setHoveredSquare,
    getDragState,
    setDragState,
    getDragJustEnded,
    setDragJustEnded,
    getCameraSide,
    setCameraSide,
    getBaseRotationY,
    setBaseRotationY,
    getSpinAngle,
    setSpinAngle,
    cameraPositions,
    cameraTargets,
    updateBoardLabelsForColor
  } = params;

  const pointer = new THREE.Vector2();
  const dragLift = 0.25;
  let animationHandle = null;

  const updateDragPosition = (event) => {
    const dragState = getDragState();
    if (!dragState) {
      return;
    }
    getPointerFromEvent(event, pointer, renderer);
    const height = (dragState.baseY ?? 0.45) + dragLift;
    const hit = getDragIntersection(pointer, height, camera);
    if (!hit) {
      return;
    }
    const piece = dragState.piece;
    const next = new THREE.Vector3(hit.x, height, hit.z);
    if (dragState.lastPos) {
      const dx = next.x - dragState.lastPos.x;
      const dz = next.z - dragState.lastPos.z;
      piece.rotation.y = dragState.baseRotY ?? 0;
      piece.rotation.x = THREE.MathUtils.clamp(-dz * 2.5, -0.35, 0.35);
      piece.rotation.z = THREE.MathUtils.clamp(dx * 2.5, -0.35, 0.35);
      dragState.lastPos.copy(next);
    } else {
      dragState.lastPos = next.clone();
    }
    piece.position.copy(next);
  };

  const handlePointerMove = (event) => {
    if (!isInteractionEnabled()) {
      return;
    }
    if (getDragState()) {
      updateDragPosition(event);
      return;
    }
    getPointerFromEvent(event, pointer, renderer);
    const square = pickSquare(pointer, { camera, boardGroup });
    if (square === getHoveredSquare()) {
      return;
    }
    const previous = getHoveredSquare();
    setHoveredSquare(square);
    if (previous) {
      refreshSquareMaterial(previous);
    }
    if (square) {
      refreshSquareMaterial(square);
    }
  };

  const handlePointerDown = (event) => {
    if (!isInteractionEnabled()) {
      return;
    }
    if (getDragState()) {
      return;
    }
    getPointerFromEvent(event, pointer, renderer);
    const piece = pickPiece(pointer, { camera, piecesGroup });
    if (!piece) {
      return;
    }
    const squareId = piece.userData.squareId;
    if (!squareId) {
      return;
    }
    const isLiveGame = Boolean(getLiveGameId());
    const liveGameColor = getLiveGameColor();
    if (isLiveGame && liveGameColor && gameState.getTurn() !== liveGameColor) {
      return;
    }
    const pieceInfo = gameState.getPiece(squareId);
    if (!pieceInfo || pieceInfo.color !== gameState.getTurn()) {
      return;
    }
    clearSelection();
    clearMoveHighlights();
    const nextSelected = boardSquaresById.get(squareId) || null;
    setSelectedSquare(nextSelected);
    if (nextSelected) {
      refreshSquareMaterial(nextSelected);
    }
    const moves = gameState.getMoves(squareId);
    setMoveHighlights(moves.map((move) => move.to));
    setDragState({
      piece,
      fromSquare: squareId,
      baseY: piece.userData.baseY ?? 0.45,
      baseRotY: piece.rotation.y,
      lastPos: null
    });
    updateDragPosition(event);
  };

  const handlePointerUp = (event) => {
    const dragState = getDragState();
    if (!dragState) {
      return;
    }
    getPointerFromEvent(event, pointer, renderer);
    const dropSquare = pickSquare(pointer, { camera, boardGroup });
    const toSquareId = dropSquare?.userData?.squareId || null;
    const fromSquareId = dragState.fromSquare;
    const piece = dragState.piece;
    piece.rotation.x = 0;
    piece.rotation.z = 0;
    piece.rotation.y = dragState.baseRotY ?? 0;
    setDragState(null);
    setDragJustEnded(true);
    window.setTimeout(() => {
      setDragJustEnded(false);
    }, 80);
    clearSelection();
    clearMoveHighlights();
    if (!toSquareId || !isLegalDestination(fromSquareId, toSquareId)) {
      if (toSquareId) {
        flashInvalidMove(boardSquaresById.get(toSquareId));
      }
      placePieceOnSquare(piece, fromSquareId);
      return;
    }
    const didMove = attemptMove(fromSquareId, toSquareId);
    if (!didMove) {
      placePieceOnSquare(piece, fromSquareId);
    }
  };

  const handleClick = (event) => {
    if (!isInteractionEnabled()) {
      return;
    }
    if (getDragState() || getDragJustEnded()) {
      return;
    }
    getPointerFromEvent(event, pointer, renderer);
    const square = pickSquare(pointer, { camera, boardGroup });
    if (!square) {
      clearSelection();
      clearMoveHighlights();
      return;
    }
    const squareId = square.userData.squareId;
    const isLiveGame = Boolean(getLiveGameId());
    const liveGameColor = getLiveGameColor();
    if (!getSelectedSquare()) {
      if (isLiveGame && liveGameColor && gameState.getTurn() !== liveGameColor) {
        return;
      }
      const piece = gameState.getPiece(squareId);
      if (!piece || piece.color !== gameState.getTurn()) {
        return;
      }
      setSelectedSquare(square);
      refreshSquareMaterial(square);
      const moves = gameState.getMoves(squareId);
      setMoveHighlights(moves.map((move) => move.to));
      return;
    }

    if (square === getSelectedSquare()) {
      clearSelection();
      clearMoveHighlights();
      return;
    }

    const nextPiece = gameState.getPiece(squareId);
    if (nextPiece && nextPiece.color === gameState.getTurn()) {
      clearSelection();
      clearMoveHighlights();
      setSelectedSquare(square);
      refreshSquareMaterial(square);
      const moves = gameState.getMoves(squareId);
      setMoveHighlights(moves.map((move) => move.to));
      return;
    }

    const from = getSelectedSquare()?.userData?.squareId;
    const to = squareId;
    clearSelection();
    clearMoveHighlights();
    attemptMove(from, to);
  };

  const handleKeydown = (event) => {
    if (event.key.toLowerCase() !== "f") {
      return;
    }
    const nextSide = getCameraSide() === "white" ? "black" : "white";
    setCameraSide(nextSide);
    setBaseRotationY(0);
    if (tableGroup) {
      tableGroup.rotation.y = getBaseRotationY() + (isInteractionEnabled() ? 0 : getSpinAngle());
    }
    camera.position.copy(cameraPositions[nextSide]);
    controls.target.copy(cameraTargets[nextSide]);
    updateBoardLabelsForColor(nextSide === "black" ? "b" : "w");
  };

  const animate = () => {
    if (tableGroup) {
      if (!isInteractionEnabled()) {
        setSpinAngle(getSpinAngle() + 0.002);
        tableGroup.rotation.y = getBaseRotationY() + getSpinAngle();
      } else {
        setSpinAngle(0);
        tableGroup.rotation.y = getBaseRotationY();
      }
    }
    controls.update();
    renderer.render(tableGroup.parent, camera);
    animationHandle = window.requestAnimationFrame(animate);
  };

  const start = () => {
    listen(window, "pointermove", handlePointerMove);
    listen(window, "pointerdown", handlePointerDown);
    listen(window, "pointerup", handlePointerUp);
    listen(window, "pointerleave", handlePointerUp);
    listen(window, "click", handleClick);
    listen(window, "keydown", handleKeydown);
    animate();
  };

  const stop = () => {
    if (animationHandle) {
      window.cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
  };

  return { start, stop };
}
