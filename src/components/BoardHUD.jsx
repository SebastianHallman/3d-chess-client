import React from "react";

export default function BoardHUD({
  white,
  black,
  whiteClock,
  blackClock,
  result,
  drawStatus,
  playerColor = "w",
  onResign,
  onOfferDraw,
  onDeclineDraw
}) {
  const bottomLabel = playerColor === "b" ? black : white;
  const bottomClock = playerColor === "b" ? blackClock : whiteClock;
  const topLabel = playerColor === "b" ? white : black;
  const topClock = playerColor === "b" ? whiteClock : blackClock;
  return (
    <div className="board-ui">
      <div className="board-side board-side--black">
        <div className="board-name">{topLabel}</div>
        <div className="board-clock">{topClock}</div>
      </div>
      <div className="board-side board-side--white">
        <div className="board-name">{bottomLabel}</div>
        <div className="board-clock">{bottomClock}</div>
      </div>
      <div className="board-result">{result}</div>
      {onOfferDraw || onResign ? (
        <div className="board-actions">
          {drawStatus ? <div className="board-draw-status">{drawStatus}</div> : null}
          {onOfferDraw ? (
            <button className="hud-button muted" type="button" onClick={onOfferDraw}>
              Offer draw
            </button>
          ) : null}
          {onDeclineDraw ? (
            <button className="hud-button muted" type="button" onClick={onDeclineDraw}>
              Decline draw
            </button>
          ) : null}
          {onResign ? (
            <button className="hud-button" type="button" onClick={onResign}>
              Resign
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
