export function createMoveHistoryTracker({ gameState, onMoveHistoryChange }) {
  let displayedMoveHistory = [];

  function isSameHistory(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  function updateMoveHistory() {
    if (typeof onMoveHistoryChange !== "function") {
      return;
    }
    const history = gameState.getPgnMoves();
    if (history.length === 0 && displayedMoveHistory.length > 0) {
      return;
    }
    if (isSameHistory(history, displayedMoveHistory)) {
      return;
    }
    displayedMoveHistory = history;
    onMoveHistoryChange(history);
  }

  function setDisplayedHistory(next) {
    displayedMoveHistory = Array.isArray(next) ? next : [];
  }

  function reset() {
    displayedMoveHistory = [];
  }

  function getDisplayedHistory() {
    return displayedMoveHistory;
  }

  return {
    updateMoveHistory,
    setDisplayedHistory,
    reset,
    getDisplayedHistory
  };
}
