import React, { useState } from "react";

export default function ProfileCard({ account, status, onToggle, onLogout }) {
  const [open, setOpen] = useState(false);

  if (!account) {
    return null;
  }

  const handleClick = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      onToggle?.();
    }
  };

  const statusText = status?.playing
    ? "In game"
    : status?.online
    ? "Online"
    : status
    ? "Offline"
    : "Unknown";

  const perfs = account.perfs || {};
  const perfList = [
    { key: "bullet", label: "Bullet" },
    { key: "blitz", label: "Blitz" },
    { key: "rapid", label: "Rapid" },
    { key: "classical", label: "Classical" }
  ].filter((perf) => perfs[perf.key]?.games);

  return (
    <div className="profile-card">
      <button className="profile-button" type="button" onClick={handleClick}>
        <span className="profile-name">
          {account.title ? `${account.title} ` : ""}
          {account.username}
        </span>
        <span className="profile-dot" />
      </button>
      {open ? (
        <div className="profile-panel">
          <div className="profile-row">
            <span>Status</span>
            <span>{statusText}</span>
          </div>
          {perfList.map((perf) => (
            <div className="profile-row" key={perf.key}>
              <span>{perf.label}</span>
              <span>{perfs[perf.key]?.rating}</span>
            </div>
          ))}
          <button className="profile-logout" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
