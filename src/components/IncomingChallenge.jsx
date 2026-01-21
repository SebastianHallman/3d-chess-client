import React, { useEffect, useState } from "react";

export default function IncomingChallenge({ visible, challenge, onAccept, onDecline }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!visible) {
      setActive(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setActive(true);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible || !challenge) {
    return null;
  }

  const className = active ? "challenge-card challenge-card--in" : "challenge-card";

  return (
    <div className="challenge-wrap">
      <div className={className}>
        <div className="challenge-title">Incoming challenge</div>
        <div className="challenge-row">
          <span>{challenge.from}</span>
          <span>{challenge.time}</span>
        </div>
        <div className="challenge-actions">
          <button className="hud-button" type="button" onClick={onAccept}>
            Accept
          </button>
          <button className="hud-button muted" type="button" onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
