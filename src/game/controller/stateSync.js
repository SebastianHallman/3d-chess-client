export function createGameStateSync({
  gameState,
  moveHistory,
  onTurnChange,
  syncPieces,
  getSuppressNextSync,
  setSuppressNextSync,
  getIsAnimatingMove,
  getMoveQueue,
  setPendingSync
}) {
  return () => {
    moveHistory.updateMoveHistory();
    if (getSuppressNextSync()) {
      setSuppressNextSync(false);
      onTurnChange(gameState.getTurn() === "w" ? "White" : "Black");
      return;
    }
    if (getIsAnimatingMove()) {
      setPendingSync(true);
      onTurnChange(gameState.getTurn() === "w" ? "White" : "Black");
      return;
    }
    if (getMoveQueue().length > 0) {
      setPendingSync(true);
      onTurnChange(gameState.getTurn() === "w" ? "White" : "Black");
      return;
    }
    syncPieces();
    onTurnChange(gameState.getTurn() === "w" ? "White" : "Black");
  };
}
