import React, { useMemo, useState } from "react";

function formatMoveRows(moves) {
  const normalizeEntry = (entry, index) => {
    if (!entry) {
      return null;
    }
    if (typeof entry === "string") {
      return {
        san: entry,
        ply: index + 1,
        selected: false,
        savedLines: []
      };
    }
    if (typeof entry === "object") {
      return {
        san: entry.san || "",
        ply: Number.isFinite(entry.ply) ? entry.ply : index + 1,
        selected: Boolean(entry.selected),
        savedLines: Array.isArray(entry.savedLines) ? entry.savedLines : [],
        branchStarts: Array.isArray(entry.branchStarts) ? entry.branchStarts : []
      };
    }
    return null;
  };

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    const white = normalizeEntry(moves[i], i);
    const black = normalizeEntry(moves[i + 1], i + 1);
    rows.push({
      number: Math.floor(i / 2) + 1,
      white,
      black
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
  showAnalysisControls = false,
  onAnalysisPrev,
  onAnalysisNext,
  onAnalysisReset,
  onExitAnalysis,
  analysisLines = [],
  analysisStatus = "idle",
  onAnalysisBranchSelect,
  onMoveHistorySelect,
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
  const analysisEmptyMessage =
    analysisStatus === "error"
      ? "Engine failed to load."
      : analysisStatus === "loading"
        ? "Engine loading..."
        : analysisStatus === "searching"
          ? "Engine searching..."
          : analysisStatus === "ready"
            ? "No principal variation yet."
            : "Start analysis to see lines.";

  const getBranchLabelsForEntry = (entry) => {
    if (!entry || !Array.isArray(entry.branchStarts) || entry.branchStarts.length === 0) {
      return [];
    }
    const byLabel = new Map();
    for (const branch of entry.branchStarts) {
      const label = String(branch?.label || "").trim();
      if (!label) {
        continue;
      }
      if (entry.san && label === entry.san) {
        continue;
      }
      const existing = byLabel.get(label);
      if (!existing) {
        byLabel.set(label, {
          index: branch.index,
          label,
          ply: Number.isFinite(branch?.ply) ? branch.ply : 0
        });
        continue;
      }
      const nextPly = Number.isFinite(branch?.ply) ? branch.ply : 0;
      if (nextPly > existing.ply) {
        byLabel.set(label, {
          index: branch.index,
          label,
          ply: nextPly
        });
      }
    }
    return Array.from(byLabel.values());
  };

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
      {showAnalysisControls ? (
        <section className="side-panel-section">
          <div className="side-panel-title">Analysis</div>
          <div className="side-panel-actions">
            <button
              className="hud-button muted side-panel-action-btn"
              type="button"
              onClick={onAnalysisPrev}
            >
              Back move
            </button>
            <button
              className="hud-button muted side-panel-action-btn"
              type="button"
              onClick={onAnalysisNext}
            >
              Forward move
            </button>
            <button className="hud-button side-panel-action-btn" type="button" onClick={onAnalysisReset}>
              Reset
            </button>
            {onExitAnalysis ? (
              <button className="hud-button muted side-panel-action-btn" type="button" onClick={onExitAnalysis}>
                Back to menu
              </button>
            ) : null}
          </div>
          <div className="side-panel-engine">
            {analysisLines.length === 0 ? (
              <div className="side-panel-empty">{analysisEmptyMessage}</div>
            ) : (
              <div className="side-panel-engine-lines">
                {analysisLines.map((line) => (
                  <div className="side-panel-engine-line" key={`pv-${line.multipv}`}>
                    <span className="side-panel-engine-score">{line.score || "--"}</span>
                    <span className="side-panel-engine-pv">{line.line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                  <div className="side-panel-move">
                    {row.white?.san && onMoveHistorySelect ? (
                      <button
                        className={`side-panel-move-btn${row.white.selected ? " is-active" : ""}`}
                        type="button"
                        onClick={() => onMoveHistorySelect?.(row.white.ply)}
                      >
                        {row.white.san}
                      </button>
                    ) : row.white?.san ? (
                      <span>{row.white.san}</span>
                    ) : null}
                    {getBranchLabelsForEntry(row.white).length > 0 ? (
                      <div className="side-panel-branch-list">
                        {getBranchLabelsForEntry(row.white).map((branch) => (
                          <button
                            key={`w-branch-${row.white.ply}-${branch.index}`}
                            className="side-panel-branch-chip"
                            type="button"
                            onClick={() => onAnalysisBranchSelect?.(branch.index)}
                          >
                            {branch.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="side-panel-move">
                    {row.black?.san && onMoveHistorySelect ? (
                      <button
                        className={`side-panel-move-btn${row.black.selected ? " is-active" : ""}`}
                        type="button"
                        onClick={() => onMoveHistorySelect?.(row.black.ply)}
                      >
                        {row.black.san}
                      </button>
                    ) : row.black?.san ? (
                      <span>{row.black.san}</span>
                    ) : null}
                    {getBranchLabelsForEntry(row.black).length > 0 ? (
                      <div className="side-panel-branch-list">
                        {getBranchLabelsForEntry(row.black).map((branch) => (
                          <button
                            key={`b-branch-${row.black.ply}-${branch.index}`}
                            className="side-panel-branch-chip"
                            type="button"
                            onClick={() => onAnalysisBranchSelect?.(branch.index)}
                          >
                            {branch.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
