import React from "react";

export default function WinScreen({ visible, summary, onRematch, onBack }) {
  if (!visible || !summary) {
    return null;
  }

  const whiteDiff = summary.whiteRatingDiff;
  const blackDiff = summary.blackRatingDiff;

  const formatDiff = (diff) => {
    if (diff == null) {
      return "";
    }
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff}`;
  };

  const diffClass = (diff) => {
    if (diff == null) {
      return "win-diff win-diff--neutral";
    }
    if (diff > 0) {
      return "win-diff win-diff--up";
    }
    if (diff < 0) {
      return "win-diff win-diff--down";
    }
    return "win-diff win-diff--neutral";
  };

  return (
    <div className="win-screen">
      <div className="win-card">
        <h2>{summary.resultText}</h2>
        <div className="win-row">
          <span>{summary.white}</span>
          <span className={diffClass(whiteDiff)}>{formatDiff(whiteDiff)}</span>
        </div>
        <div className="win-row">
          <span>{summary.black}</span>
          <span className={diffClass(blackDiff)}>{formatDiff(blackDiff)}</span>
        </div>
        <div className="win-actions">
          <button className="hud-button" type="button" onClick={onRematch}>
            Rematch
          </button>
          <button className="hud-button muted" type="button" onClick={onBack}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}
