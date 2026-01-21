export async function streamGame(context) {
  const {
    gameId,
    getToken,
    gameState,
    makeAnimatedMove,
    resetCapturedPieces,
    updateMoveHistory,
    formatClock,
    setLiveGame,
    setViewForColor,
    setGameResult,
    onChatMessage,
    onChatClear,
    onPlayersChange,
    onClocksChange,
    onAiStatus,
    onDrawStatus,
    getLiveGameId,
    getCurrentUserId,
    getChatGameId,
    setChatGameId,
    getCapturedGameId,
    setCapturedGameId,
    getLiveInitialFen,
    setLiveInitialFen,
    getLiveMoves,
    setLiveMoves,
    setPendingHistoryMoves,
    getMoveQueue,
    setPendingSync,
    setSuppressNextSync,
    setLastGameSummary,
    getLiveClock,
    setLiveClock,
    setPlayerInfo,
    getStreamRetryTimeout,
    setStreamRetryTimeout,
    getStreamHealthInterval,
    setStreamHealthInterval,
    getStreamAbortController,
    setStreamAbortController,
    setLastStreamUpdate,
    getLastStreamUpdate,
    setStreamingGameId
  } = context;

  const token = getToken();
  if (!token) {
    throw new Error("Missing token");
  }
  setStreamingGameId(gameId);
  const existingRetry = getStreamRetryTimeout();
  if (existingRetry) {
    clearTimeout(existingRetry);
    setStreamRetryTimeout(null);
  }
  const existingHealth = getStreamHealthInterval();
  if (existingHealth) {
    clearInterval(existingHealth);
    setStreamHealthInterval(null);
  }
  const existingAbort = getStreamAbortController();
  if (existingAbort) {
    existingAbort.abort();
  }
  const streamAbortController = new AbortController();
  setStreamAbortController(streamAbortController);

  const response = await fetch(`https://lichess.org/api/board/game/stream/${gameId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal: streamAbortController.signal
  });
  if (!response.ok) {
    throw new Error(`Game stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  setLastStreamUpdate(Date.now());

  const healthInterval = setInterval(() => {
    if (!getLiveGameId() || getLiveGameId() !== gameId) {
      return;
    }
    const elapsed = Date.now() - getLastStreamUpdate();
    if (elapsed > 12000) {
      streamAbortController?.abort?.();
    }
  }, 4000);
  setStreamHealthInterval(healthInterval);

  const scheduleRetry = () => {
    if (!getLiveGameId() || getLiveGameId() !== gameId) {
      return;
    }
    if (getStreamRetryTimeout()) {
      return;
    }
    const timeout = setTimeout(() => {
      setStreamRetryTimeout(null);
      streamGame(context).catch(() => {});
    }, 1200);
    setStreamRetryTimeout(timeout);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        scheduleRetry();
        break;
      }
      setLastStreamUpdate(Date.now());
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        let data = null;
        try {
          data = JSON.parse(line);
        } catch (error) {
          continue;
        }
        if (data.type === "gameFull") {
          const initialFen = data.initialFen && data.initialFen !== "startpos" ? data.initialFen : null;
          const moves = data.state?.moves ? data.state.moves.split(" ") : [];
          setLiveInitialFen(initialFen);
          if (getChatGameId() !== gameId) {
            onChatClear();
            setChatGameId(gameId);
          }
          if (getCapturedGameId() !== gameId) {
            resetCapturedPieces();
            setCapturedGameId(gameId);
          }
          setPendingHistoryMoves(moves);
          setLiveMoves(moves.slice());
          getMoveQueue().length = 0;
          setPendingSync(false);
          setSuppressNextSync(false);
          gameState.loadFromMoves({ fen: getLiveInitialFen(), moves });
          setPendingHistoryMoves(null);
          updateMoveHistory();
          setPlayerInfo({ white: data.white, black: data.black });
          let color = null;
          if (data.orientation === "white") {
            color = "w";
          } else if (data.orientation === "black") {
            color = "b";
          } else {
            const userId = getCurrentUserId();
            if (userId) {
              if (data.white?.id === userId) {
                color = "w";
              } else if (data.black?.id === userId) {
                color = "b";
              }
            }
          }
          setLastGameSummary({
            gameId,
            white: data.white
              ? `${data.white.name || data.white.id || "White"}${data.white.rating ? ` ${data.white.rating}` : ""}`
              : "White",
            black: data.black
              ? `${data.black.name || data.black.id || "Black"}${data.black.rating ? ` ${data.black.rating}` : ""}`
              : "Black",
            whiteId: data.white?.id || null,
            blackId: data.black?.id || null,
            rated: data.rated ?? null,
            perfKey: data.perf?.key || data.speed || null,
            playerColor: color,
            whiteRatingDiff: data.white?.ratingDiff ?? null,
            blackRatingDiff: data.black?.ratingDiff ?? null
          });
          const clock = getLiveClock();
          clock.white = data.state?.wtime ?? null;
          clock.black = data.state?.btime ?? null;
          clock.turn = data.state?.turn || (gameState.getTurn() === "w" ? "w" : "b");
          clock.lastUpdate = Date.now();
          setLiveClock(clock);
          onClocksChange({
            white: formatClock(clock.white),
            black: formatClock(clock.black)
          });
          setLiveGame(gameId, color);
          setViewForColor(color);
          if (color) {
            onPlayersChange((prev) => ({
              ...prev,
              playerColor: color
            }));
          }
          onAiStatus("Live");
          if (data.state?.drawOffer) {
            onDrawStatus("Draw offered");
          } else {
            onDrawStatus("");
          }
          if (data.state?.status) {
            setGameResult(data.state.status, data.state.winner, data.state.status);
          }
        } else if (data.type === "chatLine") {
          onChatMessage({
            author: data.username || "Anonymous",
            text: data.text || "",
            room: data.room || "player"
          });
        } else if (data.type === "gameState") {
          const moves = data.moves ? data.moves.split(" ") : [];
          setPendingHistoryMoves(moves);
          const liveMoves = getLiveMoves();
          const hasPrefix = liveMoves.length <= moves.length
            && liveMoves.every((move, index) => move === moves[index]);
          if (hasPrefix) {
            const newMoves = moves.slice(liveMoves.length);
            let appliedAll = true;
            for (const uci of newMoves) {
              if (!uci || uci.length < 4) {
                continue;
              }
              const from = uci.slice(0, 2);
              const to = uci.slice(2, 4);
              const promotion = uci.length > 4 ? uci[4] : undefined;
              const applied = makeAnimatedMove({ from, to, promotion });
              if (!applied) {
                appliedAll = false;
                break;
              }
            }
            if (!appliedAll) {
              getMoveQueue().length = 0;
              setPendingSync(false);
              setSuppressNextSync(false);
              gameState.loadFromMoves({ fen: getLiveInitialFen(), moves });
            }
          } else {
            gameState.loadFromMoves({ fen: getLiveInitialFen(), moves });
          }
          setLiveMoves(moves);
          setPendingHistoryMoves(null);
          updateMoveHistory();
          const clock = getLiveClock();
          clock.white = data.wtime ?? clock.white;
          clock.black = data.btime ?? clock.black;
          clock.turn = data.turn || (gameState.getTurn() === "w" ? "w" : "b");
          clock.lastUpdate = Date.now();
          setLiveClock(clock);
          onClocksChange({
            white: formatClock(clock.white),
            black: formatClock(clock.black)
          });
          if (data.drawOffer) {
            onDrawStatus("Draw offered");
          } else {
            onDrawStatus("");
          }
          if (data.status) {
            setGameResult(data.status, data.winner, data.status);
          }
        }
      }
    }
  } catch (error) {
    scheduleRetry();
  }
}

export async function streamEvents(context) {
  const {
    getToken,
    onIncomingChallenge,
    onAiStatus,
    setLiveGame,
    streamGame,
    getEventAbortController,
    setEventAbortController
  } = context;

  const token = getToken();
  if (!token) {
    return;
  }
  const existingAbort = getEventAbortController();
  if (existingAbort) {
    existingAbort.abort();
  }
  const eventAbortController = new AbortController();
  setEventAbortController(eventAbortController);
  const response = await fetch("https://lichess.org/api/stream/event", {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal: eventAbortController.signal
  });
  if (!response.ok) {
    throw new Error(`Event stream failed: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const data = JSON.parse(line);
      if (data.type === "challenge") {
        const challenge = data.challenge;
        if (challenge?.id) {
          const timeLabel = challenge.timeControl?.type === "clock"
            ? `${Math.round((challenge.timeControl.limit || 0) / 60)} + ${challenge.timeControl.increment || 0}`
            : challenge.timeControl?.type || "Custom";
          onIncomingChallenge({
            id: challenge.id,
            from: challenge.challenger?.name || challenge.challenger?.id || "Anonymous",
            rated: challenge.rated,
            time: timeLabel,
            variant: challenge.variant?.name || "Standard"
          });
        }
      } else if (data.type === "gameStart") {
        const gameId = data.game?.id;
        if (!gameId) {
          continue;
        }
        onAiStatus("Connecting...");
        setLiveGame(gameId);
        streamGame(gameId).catch(() => {
          onAiStatus("Stream failed");
        });
      }
    }
  }
}

export async function ensureAccount({ getToken, onAccountChange, setAccountInfo, setCurrentUserId, fetchAccount }) {
  try {
    const account = await fetchAccount(getToken());
    setAccountInfo(account);
    setCurrentUserId(account?.id || null);
    if (account) {
      onAccountChange({
        id: account.id,
        username: account.username || account.id,
        title: account.title || "",
        perfs: account.perfs || {}
      });
    }
  } catch (error) {
    setCurrentUserId(null);
  }
}
