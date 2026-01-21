import * as THREE from "three";

export function createMoveAnimator({
  gameState,
  boardToWorld,
  squareToCoords,
  coordsToSquare,
  piecesBySquare,
  getPiecesGroup,
  syncPieces,
  addCapturedPiece,
  createModelPiece,
  createPrimitivePiece,
  placePieceOnSquare,
  getMoveQueue,
  getIsAnimatingMove,
  setIsAnimatingMove,
  getPendingSync,
  setPendingSync,
  setSuppressNextSync
}) {
  function takePieceAt(squareId) {
    const mesh = piecesBySquare.get(squareId);
    if (!mesh) {
      return null;
    }
    piecesBySquare.delete(squareId);
    getPiecesGroup()?.remove(mesh);
    return mesh;
  }

  function handleCastling(move) {
    if (!move || !move.flags || (!move.flags.includes("k") && !move.flags.includes("q"))) {
      return;
    }
    const isWhite = move.color === "w";
    const from = move.flags.includes("k")
      ? (isWhite ? "h1" : "h8")
      : (isWhite ? "a1" : "a8");
    const to = move.flags.includes("k")
      ? (isWhite ? "f1" : "f8")
      : (isWhite ? "d1" : "d8");
    const rook = piecesBySquare.get(from);
    if (!rook) {
      return;
    }
    piecesBySquare.delete(from);
    piecesBySquare.set(to, rook);
    placePieceOnSquare(rook, to);
  }

  function animateMove(move) {
    return new Promise((resolve) => {
      const piecesGroup = getPiecesGroup();
      if (!move || !piecesGroup) {
        resolve();
        return;
      }
      if (piecesBySquare.size === 0) {
        syncPieces();
      }
      const fromSquare = move.from;
      const toSquare = move.to;
      const moving = piecesBySquare.get(fromSquare);
      if (!moving) {
        syncPieces();
        resolve();
        return;
      }

      const enPassant = move.flags?.includes("e");
      if (enPassant) {
        const fromCoords = squareToCoords(fromSquare);
        const toCoords = squareToCoords(toSquare);
        if (fromCoords && toCoords) {
          const capturedSquare = coordsToSquare(toCoords.file, fromCoords.rank);
          const captured = takePieceAt(capturedSquare);
          if (captured) {
            addCapturedPiece(captured, captured.userData.color);
          }
        }
      } else {
        const captured = takePieceAt(toSquare);
        if (captured) {
          addCapturedPiece(captured, captured.userData.color);
        }
      }

      piecesBySquare.delete(fromSquare);
      piecesBySquare.set(toSquare, moving);
      moving.userData.squareId = toSquare;

      const start = moving.position.clone();
      const toCoords = squareToCoords(toSquare);
      if (!toCoords) {
        syncPieces();
        resolve();
        return;
      }
      const { x, z } = boardToWorld(toCoords.file, toCoords.rank);
      const endY = moving.userData.baseY ?? 0.45;
      const end = new THREE.Vector3(x, endY, z);
      const duration = 260;
      const arcHeight = 0.18;
      const startTime = performance.now();
      setIsAnimatingMove(true);

      const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const y = start.y + (end.y - start.y) * ease + Math.sin(Math.PI * ease) * arcHeight;
        moving.position.set(
          THREE.MathUtils.lerp(start.x, end.x, ease),
          y,
          THREE.MathUtils.lerp(start.z, end.z, ease)
        );
        if (t < 1) {
          window.requestAnimationFrame(step);
          return;
        }
        moving.position.copy(end);
        setIsAnimatingMove(false);

        if (move.promotion) {
          const captured = takePieceAt(toSquare);
          if (captured) {
            addCapturedPiece(captured, captured.userData.color);
          }
          const promoted = createModelPiece(move.promotion, move.color)
            || createPrimitivePiece(move.promotion, move.color);
          promoted.userData.type = move.promotion;
          promoted.userData.color = move.color;
          if (move.promotion === "n" && move.color === "w") {
            promoted.rotation.y = Math.PI;
          }
          placePieceOnSquare(promoted, toSquare);
          piecesGroup.add(promoted);
          piecesBySquare.set(toSquare, promoted);
        }

        handleCastling(move);

        if (getPendingSync()) {
          setPendingSync(false);
          syncPieces();
        }
        resolve();
      };

      window.requestAnimationFrame(step);
    });
  }

  function runNextMove() {
    if (getIsAnimatingMove() || getMoveQueue().length === 0) {
      return;
    }
    const nextMove = getMoveQueue().shift();
    animateMove(nextMove).then(() => {
      runNextMove();
    });
  }

  function enqueueAnimatedMove(move) {
    if (!move) {
      return;
    }
    getMoveQueue().push(move);
    if (!getIsAnimatingMove()) {
      runNextMove();
    }
  }

  function makeAnimatedMove(move) {
    setSuppressNextSync(true);
    const result = gameState.makeMove(move);
    if (!result) {
      setSuppressNextSync(false);
      return null;
    }
    enqueueAnimatedMove(result);
    return result;
  }

  return {
    makeAnimatedMove,
    enqueueAnimatedMove,
    runNextMove,
    animateMove,
    handleCastling,
    takePieceAt
  };
}
