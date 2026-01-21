import React, { useMemo, useState } from "react";

function formatMoveRows(moves) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i] || "",
      black: moves[i + 1] || ""
    });
  }
  return rows;
}

function toMoveList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }
  return [];
}

export default function GameSidePanel({
  white = "--",
  black = "--",
  whiteClock = "--:--",
  blackClock = "--:--",
  playerColor = "w",
  result = "--",
  moveHistory = [],
  chatMessages = [],
  showPuzzleRating = false,
  puzzleRating = "--",
  showPuzzleOutcome = false,
  puzzleOutcome = "",
  onNextPuzzle,
  showPuzzleSolution = false,
  puzzleSolution = "",
  showPuzzleBack = false,
  onBackToMenu,
  canChat = false,
  hideTime = false,
  hideChat = false,
  hideActions = false,
  drawStatus = "",
  onOfferDraw,
  onDeclineDraw,
  onResign,
  onSendChat
}) {
  const [draft, setDraft] = useState("");
  const rows = useMemo(() => formatMoveRows(moveHistory), [moveHistory]);
  const solutionMoves = useMemo(() => toMoveList(puzzleSolution), [puzzleSolution]);
  const solutionRows = useMemo(() => formatMoveRows(solutionMoves), [solutionMoves]);
  const bottomLabel = playerColor === "b" ? black : white;
  const bottomClock = playerColor === "b" ? blackClock : whiteClock;
  const topLabel = playerColor === "b" ? white : black;
  const topClock = playerColor === "b" ? whiteClock : blackClock;

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    if (!canChat) {
      return;
    }
    onSendChat?.(trimmed);
    setDraft("");
  };

  return (
    <aside className="side-panel">
      {hideTime ? null : (
        <section className="side-panel-section">
          <div className="side-panel-title">Game Time</div>
          <div className="side-panel-time">
            <div className="side-panel-time-row">
              <span className="side-panel-time-label">{topLabel}</span>
              <span className="side-panel-time-clock">{topClock}</span>
            </div>
            <div className="side-panel-time-row">
              <span className="side-panel-time-label">{bottomLabel}</span>
              <span className="side-panel-time-clock">{bottomClock}</span>
            </div>
            {result && result !== "--" ? (
              <div className="side-panel-result">{result}</div>
            ) : null}
          </div>
        </section>
      )}
      {showPuzzleRating ? (
        <section className="side-panel-section">
          <div className="side-panel-title">Puzzle Rating</div>
          <div className="side-panel-time">
            <div className="side-panel-time-row">
              <span className="side-panel-time-label">Current</span>
              <span className="side-panel-time-clock">{puzzleRating}</span>
            </div>
          </div>
        </section>
      ) : null}
      {showPuzzleOutcome ? (
        <section className="side-panel-section">
          <div className="side-panel-title">Puzzle Result</div>
          <div className="side-panel-time">
            <div className="side-panel-time-row">
              <span className="side-panel-time-label">Status</span>
              <span className="side-panel-time-clock">{puzzleOutcome}</span>
            </div>
          </div>
          {onNextPuzzle ? (
            <button className="hud-button side-panel-action-btn" type="button" onClick={onNextPuzzle}>
              Next puzzle
            </button>
          ) : null}
        </section>
      ) : null}
      {showPuzzleSolution ? (
        <section className="side-panel-section">
          <div className="side-panel-title">Solution</div>
          <div className="side-panel-solution">
            {solutionRows.length === 0 ? (
              <div className="side-panel-empty">No solution available.</div>
            ) : (
              <div className="side-panel-move-grid">
                {solutionRows.map((row) => (
                  <div className="side-panel-move-row" key={`solution-${row.number}`}>
                    <div className="side-panel-move-number">{row.number}.</div>
                    <div className="side-panel-move">{row.white}</div>
                    <div className="side-panel-move">{row.black}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
      {showPuzzleBack && onBackToMenu ? (
        <section className="side-panel-section">
          <div className="side-panel-title">Puzzle Menu</div>
          <button className="hud-button muted side-panel-action-btn" type="button" onClick={onBackToMenu}>
            Back to menu
          </button>
        </section>
      ) : null}
      <section className="side-panel-section">
        <div className="side-panel-title">Move History</div>
        <div className="side-panel-moves">
          {rows.length === 0 ? (
            <div className="side-panel-empty">No moves yet.</div>
          ) : (
            <div className="side-panel-move-grid">
              {rows.map((row) => (
                <div className="side-panel-move-row" key={`move-${row.number}`}>
                  <div className="side-panel-move-number">{row.number}.</div>
                  <div className="side-panel-move">{row.white}</div>
                  <div className="side-panel-move">{row.black}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {hideChat ? null : (
        <section className="side-panel-section">
          <div className="side-panel-title">Chat</div>
          <div className="side-panel-chat">
            {chatMessages.length === 0 ? (
              <div className="side-panel-empty">No messages yet.</div>
            ) : (
              <div className="side-panel-chat-list">
                {chatMessages.map((message) => (
                  <div className="side-panel-chat-item" key={message.id}>
                    <span className="side-panel-chat-author">{message.author}:</span>
                    <span className="side-panel-chat-text">{message.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <form className="side-panel-chat-form" onSubmit={handleSubmit}>
            <input
              className="side-panel-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={canChat ? "Type a message" : "Chat available in live games"}
              disabled={!canChat}
            />
            <button className="hud-button side-panel-chat-send" type="submit" disabled={!canChat}>
              Send
            </button>
          </form>
        </section>
      )}

      {hideActions ? null : (
        <section className="side-panel-section">
          <div className="side-panel-title">Game Actions</div>
          <div className="side-panel-actions">
            {drawStatus ? <div className="side-panel-status">{drawStatus}</div> : null}
            {onOfferDraw ? (
              <button className="hud-button muted side-panel-action-btn" type="button" onClick={onOfferDraw}>
                Offer draw
              </button>
            ) : null}
            {onDeclineDraw ? (
              <button className="hud-button muted side-panel-action-btn" type="button" onClick={onDeclineDraw}>
                Decline draw
              </button>
            ) : null}
            {onResign ? (
              <button className="hud-button side-panel-action-btn" type="button" onClick={onResign}>
                Resign
              </button>
            ) : null}
          </div>
        </section>
      )}
    </aside>
  );
}
