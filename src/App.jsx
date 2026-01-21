import React, { useEffect, useMemo, useRef, useState } from "react";
import { createGameController } from "./game/controller.js";
import Login from "./components/Login.jsx";
import Menu from "./components/Menu.jsx";
import WinScreen from "./components/WinScreen.jsx";
import ProfileCard from "./components/ProfileCard.jsx";
import IncomingChallenge from "./components/IncomingChallenge.jsx";
import GameSidePanel from "./components/GameSidePanel.jsx";
import PromotionPicker from "./components/PromotionPicker.jsx";

const lichessConfig = {
  clientId: "mtqkБpnb",
  redirectUri: window.location.origin + "/",
  scope: "challenge:write board:play puzzle:read puzzle:write",
  oauthUrl: "https://lichess.org/oauth",
  tokenUrl: "https://lichess.org/api/token"
};

export default function App() {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);

  const [authed, setAuthed] = useState(false);
  const [loginStatus, setLoginStatus] = useState("");
  const [turn, setTurn] = useState("White");
  const [players, setPlayers] = useState({ white: "--", black: "--", playerColor: "w" });
  const [clocks, setClocks] = useState({ white: "--:--", black: "--:--" });
  const [puzzleStatus, setPuzzleStatus] = useState("Ready");
  const [puzzleRating, setPuzzleRating] = useState("--");
  const [puzzleSolution, setPuzzleSolution] = useState([]);
  const [aiStatus, setAiStatus] = useState("Idle");
  const [result, setResult] = useState("--");
  const [drawStatus, setDrawStatus] = useState("");
  const [menuVisible, setMenuVisible] = useState(true);
  const [menuMode, setMenuMode] = useState("root");
  const [rated, setRated] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [winSummary, setWinSummary] = useState(null);
  const [showWin, setShowWin] = useState(false);
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState(null);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [promotionRequest, setPromotionRequest] = useState(null);
  const puzzleUserRating = account?.perfs?.puzzle?.rating;
  const puzzleUserRatingLabel = Number.isFinite(puzzleUserRating) ? String(puzzleUserRating) : "--";

  const controllerCallbacks = useMemo(
    () => ({
      config: lichessConfig,
      onAuthChange: setAuthed,
      onLoginStatus: setLoginStatus,
      onTurnChange: setTurn,
      onPlayersChange: setPlayers,
      onClocksChange: setClocks,
      onPuzzleStatus: setPuzzleStatus,
      onPuzzleSolution: setPuzzleSolution,
      onPuzzleRating: setPuzzleRating,
      onPromotionRequest: setPromotionRequest,
      onAiStatus: setAiStatus,
      onDrawStatus: setDrawStatus,
      onResultChange: setResult,
      onMoveHistoryChange: setMoveHistory,
      onChatMessage: (message) => {
        if (!message?.text) {
          return;
        }
        setChatMessages((prev) => {
          const next = {
            id: `${Date.now()}-${prev.length}`,
            author: message.author || "Anonymous",
            text: message.text,
            room: message.room || "player"
          };
          const last = prev[prev.length - 1];
          if (last?.local && last.text === next.text) {
            return [...prev.slice(0, -1), { ...next }];
          }
          return [...prev, next];
        });
      },
      onChatClear: () => setChatMessages([]),
      onMenuVisibility: setMenuVisible,
      onGameEnd: (summary) => {
        setWinSummary(summary);
        setShowWin(true);
      },
      onAccountChange: setAccount,
      onIncomingChallenge: setIncomingChallenge
    }),
    []
  );

  useEffect(() => {
    const controller = createGameController(controllerCallbacks);
    controllerRef.current = controller;
    controller.init(canvasRef.current);
    controller
      .handleRedirect()
      .catch(() => {})
      .finally(() => {
        if (controller.isLoggedIn()) {
          controller.startAuthStreams().catch(() => {});
        }
      });

    return () => {
      controller.destroy();
    };
  }, [controllerCallbacks]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setIncomingChallenge(null);
    }
  }, [authed]);

  const handleLogin = async () => {
    setLoginStatus("");
    try {
      await controllerRef.current.login();
    } catch (error) {
      setLoginStatus("Missing Lichess config.");
    }
  };

  const handleLogout = () => {
    controllerRef.current.logout();
    setShowWin(false);
  };

  const handlePuzzle = () => {
    controllerRef.current.startPuzzle();
    setMenuMode("puzzles");
  };

  const handleBackToMenuFromPuzzle = () => {
    controllerRef.current.exitPuzzle?.();
    setMenuMode("root");
  };

  const handleChallengeUser = (timeControl) => {
    if (!opponent.trim()) {
      setAiStatus("Missing user");
      return;
    }
    controllerRef.current.challengeUser(opponent.trim(), { ...timeControl, rated });
    setShowWin(false);
  };

  const handleChallengeOpen = (timeControl) => {
    controllerRef.current.challengeOpen({ ...timeControl, rated });
    setShowWin(false);
  };

  const handleRematch = () => {
    if (!winSummary?.gameId) {
      return;
    }
    controllerRef.current.rematch(winSummary.gameId).catch(() => {});
    setShowWin(false);
  };

  const handleBackToMenu = () => {
    setShowWin(false);
    setMenuMode("root");
    setMenuVisible(true);
  };

  const handleSendChat = (text) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        author: "You",
        text,
        room: "player",
        local: true
      }
    ]);
    controllerRef.current
      .sendChatMessage(text)
      .catch(() => {});
  };

  const handlePromotionPick = (piece) => {
    setPromotionRequest(null);
    controllerRef.current.confirmPromotion(piece);
  };

  const handlePromotionCancel = () => {
    setPromotionRequest(null);
    controllerRef.current.cancelPromotion();
  };

  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleProfileToggle = () => {
    controllerRef.current
      .getStatus()
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  };

  const handleAcceptChallenge = () => {
    if (!incomingChallenge?.id) {
      return;
    }
    controllerRef.current
      .acceptChallenge(incomingChallenge.id)
      .then(() => setIncomingChallenge(null))
      .catch(() => setIncomingChallenge(null));
  };

  const handleDeclineChallenge = () => {
    if (!incomingChallenge?.id) {
      return;
    }
    controllerRef.current
      .declineChallenge(incomingChallenge.id)
      .then(() => setIncomingChallenge(null))
      .catch(() => setIncomingChallenge(null));
  };

  return (
    <>
      <Login visible={!authed} status={loginStatus} onLogin={handleLogin} />

      <div className="game">
        <button className="fullscreen-button" type="button" onClick={handleToggleFullscreen}>
          {isFullscreen ? "<>" : "<>"}
        </button>
        {authed ? (
          <>
            <ProfileCard
              account={account}
              status={status}
              onToggle={handleProfileToggle}
              onLogout={handleLogout}
            />
            <IncomingChallenge
              visible={Boolean(incomingChallenge)}
              challenge={incomingChallenge}
              onAccept={handleAcceptChallenge}
              onDecline={handleDeclineChallenge}
            />
            <Menu
              visible={menuVisible}
              mode={menuMode}
              rated={rated}
              puzzleStatus={puzzleStatus}
              puzzleRating={puzzleRating}
              aiStatus={aiStatus}
              opponent={opponent}
              onRatedToggle={() => setRated((prev) => !prev)}
              onModeChange={setMenuMode}
              onOpponentChange={setOpponent}
              onChallengeOpen={handleChallengeOpen}
              onChallengeUser={handleChallengeUser}
              onPuzzle={handlePuzzle}
            />

            <WinScreen
              visible={showWin}
              summary={winSummary}
              onRematch={handleRematch}
              onBack={handleBackToMenu}
            />

        {menuVisible ? null : (
          <>
            <GameSidePanel
              white={players.white}
              black={players.black}
              whiteClock={clocks.white}
              blackClock={clocks.black}
              playerColor={players.playerColor}
              result={result}
              moveHistory={moveHistory}
              chatMessages={chatMessages}
              showPuzzleRating={menuMode === "puzzles"}
              puzzleRating={puzzleUserRatingLabel}
              showPuzzleOutcome={menuMode === "puzzles" && (puzzleStatus === "Solved" || puzzleStatus === "Failed")}
              puzzleOutcome={puzzleStatus}
              onNextPuzzle={handlePuzzle}
              showPuzzleSolution={menuMode === "puzzles" && puzzleStatus === "Failed"}
              puzzleSolution={puzzleSolution}
              canChat={authed && menuMode !== "puzzles"}
              hideTime={menuMode === "puzzles"}
              hideChat={menuMode === "puzzles"}
              hideActions={menuMode === "puzzles"}
              showPuzzleBack={menuMode === "puzzles"}
              onBackToMenu={handleBackToMenuFromPuzzle}
              drawStatus={drawStatus}
              onOfferDraw={
                menuMode === "puzzles"
                  ? null
                  : () => controllerRef.current.offerDrawCurrentGame().catch(() => {})
              }
              onDeclineDraw={
                menuMode === "puzzles" || drawStatus !== "Draw offered"
                  ? null
                  : () => controllerRef.current.declineDrawCurrentGame().catch(() => {})
              }
              onResign={
                menuMode === "puzzles"
                  ? null
                  : () => controllerRef.current.resignCurrentGame().catch(() => {})
              }
              onSendChat={handleSendChat}
            />
          </>
        )}
          </>
        ) : null}

        <canvas className="scene" ref={canvasRef} />
        {promotionRequest ? (
          <PromotionPicker
            request={promotionRequest}
            onPick={handlePromotionPick}
            onCancel={handlePromotionCancel}
          />
        ) : null}
      </div>
    </>
  );
}
