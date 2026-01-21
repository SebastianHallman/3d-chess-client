export function createLiveGameManager({
  getToken,
  fetchGameSummary,
  resetPuzzleAttempt,
  setPuzzleMode,
  onPuzzleStatus,
  onPuzzleRating,
  onResultChange,
  onMenuVisibility,
  onGameEnd,
  onPlayersChange,
  clockTicker,
  getLiveGameId,
  setLiveGameId,
  getLastGameSummary,
  setLastGameSummary,
  getLastResultGameId,
  setLastResultGameId,
  setSpinAngle
}) {
  async function setGameResult(status, winner, reason) {
    if (status !== "mate" && status !== "resign" && status !== "draw" && status !== "outoftime") {
      return;
    }
    let resultText = "Draw";
    if (status !== "draw") {
      const winnerLabel = winner === "white" ? "White" : winner === "black" ? "Black" : "Unknown";
      const reasonLabel = reason ? ` (${reason})` : "";
      resultText = `${winnerLabel} wins${reasonLabel}`;
    }
    const resultGameId = getLiveGameId() || getLastGameSummary()?.gameId || null;
    if (resultGameId && resultGameId === getLastResultGameId()) {
      return;
    }
    setLastResultGameId(resultGameId);
    onResultChange(resultText);
    const baseSummary = getLastGameSummary() || {
      gameId: resultGameId,
      white: "White",
      black: "Black",
      whiteRatingDiff: null,
      blackRatingDiff: null
    };
    const fetchRatingDiffWithRetry = async (gameId, attempts = 4) => {
      let delay = 700;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const ratingInfo = await fetchGameSummary(getToken(), gameId);
          if (ratingInfo?.whiteRatingDiff != null || ratingInfo?.blackRatingDiff != null) {
            return ratingInfo;
          }
        } catch (error) {
          if (attempt === attempts - 1) {
            throw error;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.6;
      }
      return null;
    };

    const finalize = async () => {
      let summary = {
        ...baseSummary,
        resultText,
        status,
        winner
      };
      if (summary.gameId && (summary.whiteRatingDiff == null || summary.blackRatingDiff == null)) {
        try {
          const ratingInfo = await fetchRatingDiffWithRetry(summary.gameId);
          if (ratingInfo) {
            summary = {
              ...summary,
              ...ratingInfo
            };
            setLastGameSummary(summary);
          }
        } catch (error) {
          console.warn("Game summary fetch failed", error);
        }
      }
      onGameEnd(summary);
    };
    finalize();
    if (getLiveGameId()) {
      setLiveGameId(null);
      clockTicker.stop();
      setSpinAngle(0);
    }
  }

  function setLiveGame(id, color = null, setLiveGameColor = () => {}) {
    resetPuzzleAttempt();
    setLiveGameId(id);
    setLiveGameColor(color);
    if (id) {
      setPuzzleMode([]);
      onPuzzleStatus("Inactive");
      onPuzzleRating("--");
      onResultChange("--");
      clockTicker.start();
    } else {
      clockTicker.stop();
    }
    onMenuVisibility(!id);
    if (!id) {
      setSpinAngle(0);
    }
  }

  function setPlayerInfo({ white, black }) {
    const whiteName = white ? `${white.name || white.id || "White"}${white.rating ? ` ${white.rating}` : ""}` : "--";
    const blackName = black ? `${black.name || black.id || "Black"}${black.rating ? ` ${black.rating}` : ""}` : "--";
    onPlayersChange((prev) => ({
      ...prev,
      white: whiteName,
      black: blackName
    }));
  }

  return {
    setLiveGame,
    setGameResult,
    setPlayerInfo
  };
}
