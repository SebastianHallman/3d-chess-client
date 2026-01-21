import React from "react";

export default function Login({ visible, status, onLogin }) {
  return (
    <div className="login" style={{ display: visible ? "grid" : "none" }}>
      <div className="login-card">
        <h1>Lichess, but in 3D</h1>
        <p>Authorize to challenge players, solve puzzles, and play live games.</p>
        <button className="login-button" type="button" onClick={onLogin}>
          Continue with Lichess
        </button>
        <p className="login-status">{status}</p>
      </div>
    </div>
  );
}
