import React, { useState } from "react";

const timeControls = [
  { label: "1 + 0", minutes: 1, increment: 0, speed: "Bullet" },
  { label: "2 + 1", minutes: 2, increment: 1, speed: "Bullet" },
  { label: "3 + 0", minutes: 3, increment: 0, speed: "Blitz" },
  { label: "3 + 2", minutes: 3, increment: 2, speed: "Blitz" },
  { label: "5 + 0", minutes: 5, increment: 0, speed: "Blitz" },
  { label: "5 + 3", minutes: 5, increment: 3, speed: "Blitz" },
  { label: "10 + 0", minutes: 10, increment: 0, speed: "Rapid" },
  { label: "10 + 5", minutes: 10, increment: 5, speed: "Rapid" },
  { label: "15 + 10", minutes: 15, increment: 10, speed: "Rapid" },
  { label: "30 + 0", minutes: 30, increment: 0, speed: "Classical" },
  { label: "30 + 20", minutes: 30, increment: 20, speed: "Classical" }
];
const randomTimeControls = timeControls.filter((tc) => tc.speed !== "Bullet" && tc.speed !== "Blitz");
const userTimeControls = timeControls.filter((tc) => tc.speed !== "Bullet");

export default function Menu({
  visible,
  mode,
  rated,
  puzzleStatus,
  puzzleRating,
  aiStatus,
  opponent,
  onRatedToggle,
  onModeChange,
  onOpponentChange,
  onChallengeOpen,
  onChallengeUser,
  onPuzzle,
  onAnalysis
}) {
  const menuClass = visible ? "menu" : "menu menu--hidden";
  const [customMinutes, setCustomMinutes] = useState(10);
  const [customIncrement, setCustomIncrement] = useState(0);

  const parseNumber = (value, fallback = 0) => {
    const next = Number.parseInt(value, 10);
    if (Number.isNaN(next)) {
      return fallback;
    }
    return Math.max(0, next);
  };

  const renderTimeControls = (list, onSelect) => (
    <div className="menu-grid">
      {list.map((tc) => (
        <button
          key={tc.label}
          className="menu-tile"
          type="button"
          onClick={() => onSelect(tc)}
        >
          <span className="menu-tile-time">{tc.label}</span>
          <span className="menu-tile-speed">{tc.speed}</span>
        </button>
      ))}
      <div className="menu-tile menu-tile--ghost menu-tile--custom">
        <span className="menu-tile-time">Custom</span>
        <div className="hud-row menu-custom-row">
          <input
            className="hud-input menu-custom-input"
            type="number"
            min="1"
            value={customMinutes}
            onChange={(event) => setCustomMinutes(parseNumber(event.target.value, 10))}
            aria-label="Custom minutes"
          />
          <input
            className="hud-input menu-custom-input"
            type="number"
            min="0"
            value={customIncrement}
            onChange={(event) => setCustomIncrement(parseNumber(event.target.value, 0))}
            aria-label="Custom increment"
          />
        </div>
        <button
          className="hud-button menu-custom-button"
          type="button"
          onClick={() => onSelect({ minutes: customMinutes, increment: customIncrement })}
        >
          Start
        </button>
      </div>
    </div>
  );

  return (
    <div className={menuClass}>
      <div className="hud-title">3D Chess</div>

      {mode === "root" && (
        <div className="menu-grid">
          <button className="menu-tile" type="button" onClick={() => onModeChange("random")}>
            <span className="menu-tile-time">Play random</span>
            <span className="menu-tile-speed">Open challenge</span>
          </button>
          <button className="menu-tile" type="button" onClick={() => onModeChange("user")}>
            <span className="menu-tile-time">Play user</span>
            <span className="menu-tile-speed">Direct challenge</span>
          </button>
          <button className="menu-tile" type="button" onClick={onPuzzle}>
            <span className="menu-tile-time">Puzzles</span>
            <span className="menu-tile-speed">Daily or next</span>
          </button>
          <button className="menu-tile" type="button" onClick={onAnalysis}>
            <span className="menu-tile-time">Analysis board</span>
            <span className="menu-tile-speed">Free play</span>
          </button>
        </div>
      )}

      {mode === "random" && (
        <>
          <div className="hud-row">
            <span className="hud-label">Rated</span>
            <label className="toggle">
              <input type="checkbox" checked={rated} onChange={onRatedToggle} />
              <span className="toggle-track" />
            </label>
          </div>
          <div className="hud-row">
            <span className="hud-label">Status</span>
            <span className="hud-value">{aiStatus}</span>
          </div>
          {renderTimeControls(randomTimeControls, onChallengeOpen)}
          <button className="hud-button muted" type="button" onClick={() => onModeChange("root")}>
            Back
          </button>
        </>
      )}

      {mode === "user" && (
        <>
          <div className="hud-row">
            <span className="hud-label">Opponent</span>
            <input
              className="hud-input"
              type="text"
              placeholder="lichess username"
              value={opponent}
              onChange={(event) => onOpponentChange(event.target.value)}
            />
          </div>
          <div className="hud-row">
            <span className="hud-label">Rated</span>
            <label className="toggle">
              <input type="checkbox" checked={rated} onChange={onRatedToggle} />
              <span className="toggle-track" />
            </label>
          </div>
          <div className="hud-row">
            <span className="hud-label">Status</span>
            <span className="hud-value">{aiStatus}</span>
          </div>
          {renderTimeControls(userTimeControls, onChallengeUser)}
          <button className="hud-button muted" type="button" onClick={() => onModeChange("root")}>
            Back
          </button>
        </>
      )}

      {mode === "puzzles" && (
        <>
          <div className="hud-row">
            <span className="hud-label">Puzzle</span>
            <span className="hud-value">{puzzleStatus}</span>
          </div>
          <div className="hud-row">
            <span className="hud-label">Rating</span>
            <span className="hud-value">{puzzleRating}</span>
          </div>
          <button className="hud-button" type="button" onClick={onPuzzle}>
            Next puzzle
          </button>
          <button className="hud-button muted" type="button" onClick={() => onModeChange("root")}>
            Back
          </button>
        </>
      )}

    </div>
  );
}
