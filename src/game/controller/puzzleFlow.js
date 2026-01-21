export function createPuzzleFlow({
  getToken,
  isLoggedIn,
  submitPuzzleBatch,
  ensureAccount,
  onPuzzleSolution,
  onPuzzleStatus,
  onPuzzleRating,
  onMenuVisibility
}) {
  let puzzleMode = false;
  let puzzleSolution = [];
  let puzzleIndex = 0;
  let currentPuzzleId = null;
  let puzzleAttemptSubmitted = false;

  function setPuzzleMode(solution = []) {
    puzzleMode = Array.isArray(solution) && solution.length > 0;
    puzzleSolution = puzzleMode ? solution.slice() : [];
    puzzleIndex = 0;
  }

  function resetPuzzleAttempt({ keepSolution = false } = {}) {
    currentPuzzleId = null;
    puzzleAttemptSubmitted = false;
    if (!keepSolution) {
      onPuzzleSolution([]);
    }
  }

  function beginPuzzleAttempt(puzzleId) {
    currentPuzzleId = puzzleId || null;
    puzzleAttemptSubmitted = false;
  }

  function submitPuzzleAttempt(win) {
    if (!currentPuzzleId || puzzleAttemptSubmitted || !isLoggedIn()) {
      return;
    }
    const token = getToken();
    if (!token) {
      return;
    }
    puzzleAttemptSubmitted = true;
    const solutions = [{ id: currentPuzzleId, win: Boolean(win), rated: true }];
    submitPuzzleBatch(token, { angle: "mix", solutions })
      .then(() => ensureAccount())
      .catch((error) => {
        console.warn("Puzzle batch submit failed", error);
      });
  }

  function getExpectedPuzzleMove() {
    if (!puzzleMode) {
      return null;
    }
    return puzzleSolution[puzzleIndex] || null;
  }

  function applyPuzzleMove(moveUci, makeAnimatedMove) {
    if (!moveUci || moveUci.length < 4) {
      return null;
    }
    const from = moveUci.slice(0, 2);
    const to = moveUci.slice(2, 4);
    const promotion = moveUci.length > 4 ? moveUci[4] : undefined;
    try {
      return makeAnimatedMove({ from, to, promotion });
    } catch (error) {
      return null;
    }
  }

  function handlePuzzleMoveResult({ from, to, promotion, makeAnimatedMove }) {
    const expected = getExpectedPuzzleMove();
    if (!expected) {
      return { handled: false };
    }
    const expectedPromotion = expected.length > 4 ? expected[4] : undefined;
    const isPromotionMatch = expectedPromotion ? promotion === expectedPromotion : true;
    const isCorrect =
      expected.slice(0, 2) === from && expected.slice(2, 4) === to && isPromotionMatch;
    const move = makeAnimatedMove({ from, to, promotion });
    if (!move) {
      return { handled: true, success: false, failed: true };
    }
    if (!isCorrect) {
      submitPuzzleAttempt(false);
      resetPuzzleAttempt({ keepSolution: true });
      setPuzzleMode([]);
      onPuzzleStatus("Failed");
      return { handled: true, success: false, failed: true };
    }
    puzzleIndex += 1;
    const responseMove = puzzleSolution[puzzleIndex];
    if (responseMove) {
      const applied = applyPuzzleMove(responseMove, makeAnimatedMove);
      if (applied) {
        puzzleIndex += 1;
      }
    }
    if (puzzleIndex >= puzzleSolution.length) {
      onPuzzleStatus("Solved");
      submitPuzzleAttempt(true);
      resetPuzzleAttempt();
      return { handled: true, success: true, solved: true };
    }
    return { handled: true, success: true };
  }

  function isInteractionEnabled(liveGameId) {
    return Boolean(liveGameId) || puzzleMode;
  }

  function beginPuzzleUi({ puzzleId, solution, rating, label, requiresAuth, repeated }) {
    beginPuzzleAttempt(puzzleId);
    setPuzzleMode(solution);
    onPuzzleSolution(Array.isArray(solution) ? solution : []);
    onPuzzleRating(Number.isFinite(rating) ? String(rating) : "--");
    if (requiresAuth && repeated) {
      onPuzzleStatus(`${label} (login for new puzzles)`);
    } else {
      onPuzzleStatus(label);
    }
  }

  function resetPuzzleUiOnFailure() {
    onPuzzleRating("--");
    onPuzzleSolution([]);
    onMenuVisibility(true);
  }

  return {
    setPuzzleMode,
    resetPuzzleAttempt,
    beginPuzzleAttempt,
    submitPuzzleAttempt,
    getExpectedPuzzleMove,
    applyPuzzleMove,
    handlePuzzleMoveResult,
    isInteractionEnabled,
    beginPuzzleUi,
    resetPuzzleUiOnFailure
  };
}
