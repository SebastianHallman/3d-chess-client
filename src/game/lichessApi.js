const API_BASE = "https://lichess.org/api";

function requireToken(token) {
  if (!token) {
    throw new Error("Missing token");
  }
  return token;
}

export async function fetchAccount(token) {
  if (!token) {
    return null;
  }
  const response = await fetch(`${API_BASE}/account`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error(`Account request failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchStatus(userId) {
  if (!userId) {
    return null;
  }
  const response = await fetch(`${API_BASE}/users/status?ids=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error(`Status request failed: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data[0] : null;
}

export async function fetchNowPlaying(token) {
  const safeToken = requireToken(token);
  const response = await fetch(`${API_BASE}/account/playing`, {
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Now playing request failed: ${response.status}`);
  }
  return response.json();
}

export async function challengeStockfish(token, { level = 3 } = {}) {
  const safeToken = requireToken(token);
  const body = new URLSearchParams({
    level: String(level),
    rated: "false"
  });
  const response = await fetch(`${API_BASE}/challenge/ai`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`AI challenge failed: ${response.status}`);
  }
  return response.json();
}

export async function challengeUser(token, username, { minutes, increment, rated = false } = {}) {
  const safeToken = requireToken(token);
  const limit = Math.max(60, Math.min(60 * 180, Math.round((minutes || 5) * 60)));
  const inc = Math.max(0, Math.min(60, Math.round(increment || 0)));
  const body = new URLSearchParams({
    rated: rated ? "true" : "false",
    "clock.limit": String(limit),
    "clock.increment": String(inc)
  });
  const response = await fetch(`${API_BASE}/challenge/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`User challenge failed: ${response.status} ${details}`);
  }
  return response.json();
}

export async function challengeOpen(token, { minutes, increment, rated = false } = {}) {
  const safeToken = requireToken(token);
  const limit = Math.max(60, Math.min(60 * 180, Math.round((minutes || 5) * 60)));
  const inc = Math.max(0, Math.min(60, Math.round(increment || 0)));
  const body = new URLSearchParams({
    rated: rated ? "true" : "false",
    "clock.limit": String(limit),
    "clock.increment": String(inc)
  });
  const response = await fetch(`${API_BASE}/challenge/open`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Open challenge failed: ${response.status} ${details}`);
  }
  return response.json();
}

export async function seekGame(token, { minutes, increment, rated = false } = {}) {
  const safeToken = requireToken(token);
  const limit = Math.max(60, Math.min(60 * 180, Math.round((minutes || 5) * 60)));
  const inc = Math.max(0, Math.min(60, Math.round(increment || 0)));
  const body = new URLSearchParams({
    rated: rated ? "true" : "false",
    time: String(Math.round(limit / 60)),
    increment: String(inc),
    variant: "standard",
    color: "random"
  });
  const response = await fetch(`${API_BASE}/board/seek`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Seek failed: ${response.status} ${details}`);
  }
  return response.text();
}

export async function sendMoveToLichess(token, gameId, uci) {
  const safeToken = requireToken(token);
  const response = await fetch(`${API_BASE}/board/game/${gameId}/move/${uci}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Move rejected: ${response.status}`);
  }
  return response.text();
}

export async function requestRematch(token, gameId) {
  const safeToken = requireToken(token);
  const response = await fetch(`${API_BASE}/board/game/${gameId}/rematch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Rematch failed: ${response.status} ${details}`);
  }
  return response.json();
}

export async function acceptChallenge(token, challengeId) {
  const safeToken = requireToken(token);
  const response = await fetch(`${API_BASE}/challenge/${challengeId}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Accept failed: ${response.status} ${details}`);
  }
  return response.json();
}

export async function declineChallenge(token, challengeId) {
  const safeToken = requireToken(token);
  const response = await fetch(`${API_BASE}/challenge/${challengeId}/decline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Decline failed: ${response.status} ${details}`);
  }
  return response.json();
}

export async function resignGame(token, gameId) {
  const safeToken = requireToken(token);
  const response = await fetch(`${API_BASE}/board/game/${gameId}/resign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resign failed: ${response.status} ${details}`);
  }
  return response.text();
}

export async function offerDraw(token, gameId, decision = "yes") {
  const safeToken = requireToken(token);
  const normalizedDecision = decision === "no" ? "no" : "yes";
  const response = await fetch(`${API_BASE}/board/game/${gameId}/draw/${normalizedDecision}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Draw offer failed: ${response.status} ${details}`);
  }
  return response.text();
}

export async function sendChatMessage(token, gameId, { room = "player", text } = {}) {
  const safeToken = requireToken(token);
  if (!text) {
    throw new Error("Missing chat text");
  }
  const body = new URLSearchParams({
    room,
    text
  });
  const response = await fetch(`${API_BASE}/board/game/${gameId}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Chat send failed: ${response.status} ${details}`);
  }
  return response.text();
}

export async function submitPuzzleBatch(
  token,
  { angle = "mix", solutions = [], nb = 0 } = {}
) {
  const safeToken = requireToken(token);
  if (!Array.isArray(solutions) || solutions.length === 0) {
    throw new Error("Missing puzzle solutions");
  }
  const url = new URL(`${API_BASE}/puzzle/batch/${encodeURIComponent(angle)}`);
  if (Number.isInteger(nb)) {
    url.searchParams.set("nb", String(Math.max(0, Math.min(50, nb))));
  }
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${safeToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ solutions })
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Puzzle batch failed: ${response.status} ${details}`);
  }
  return response.json();
}

export async function fetchGameSummary(token, gameId) {
  if (!gameId) {
    return null;
  }
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = `${API_BASE}/game/export/${gameId}?pgnInJson=true&moves=false&clocks=false&evals=false&opening=false`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Game export failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    whiteRatingDiff: data?.players?.white?.ratingDiff ?? null,
    blackRatingDiff: data?.players?.black?.ratingDiff ?? null
  };
}
