import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";
import { GameState } from "./game/state.js";
import {
  createLoginUrl,
  handleRedirectCallback,
  isLoggedIn,
  logout,
  getToken
} from "./auth/lichess.js";

const lichessConfig = {
  clientId: "mtqköpnb",
  redirectUri: window.location.origin + "/",
  scope: "challenge:write board:play puzzle:read",
  oauthUrl: "https://lichess.org/oauth",
  tokenUrl: "https://lichess.org/api/token"
};

const app = document.querySelector("#app");

const loginView = document.createElement("div");
loginView.className = "login";
loginView.innerHTML = `
  <div class="login-card">
    <h1>3D Chess</h1>
    <p>Connect your Lichess account to play.</p>
    <button class="login-button" type="button" data-login>Login with Lichess</button>
    <p class="login-status" data-login-status></p>
  </div>
`;
app.appendChild(loginView);

const gameView = document.createElement("div");
gameView.className = "game";
gameView.innerHTML = `
  <div class="menu" data-menu>
    <div class="hud-title">3D Chess</div>
    <div class="hud-row">
      <span class="hud-label">Turn</span>
      <span class="hud-value" data-turn>White</span>
    </div>
    <div class="hud-row">
      <span class="hud-label">Minutes</span>
      <input class="hud-input" type="number" min="1" max="180" step="1" value="5" data-minutes />
    </div>
    <div class="hud-row">
      <span class="hud-label">Increment</span>
      <input class="hud-input" type="number" min="0" max="60" step="1" value="5" data-increment />
    </div>
    <div class="hud-row">
      <span class="hud-label">Opponent</span>
      <input class="hud-input" type="text" placeholder="lichess username" data-opponent />
    </div>
    <div class="hud-row">
      <span class="hud-label">Puzzle</span>
      <span class="hud-value" data-puzzle-status>Ready</span>
    </div>
    <div class="hud-row">
      <span class="hud-label">Stockfish</span>
      <span class="hud-value" data-ai-status>Idle</span>
    </div>
    <button class="hud-button" type="button" data-puzzle>New puzzle</button>
    <button class="hud-button" type="button" data-ai>Challenge Stockfish</button>
    <button class="hud-button" type="button" data-challenge-user>Challenge User</button>
    <button class="hud-button" type="button" data-challenge-open>Open Challenge</button>
    <button class="hud-button muted" type="button" data-logout>Logout</button>
  </div>
  <div class="board-ui">
    <div class="board-side board-side--black">
      <div class="board-name" data-black-name>--</div>
      <div class="board-clock" data-black-clock>--:--</div>
    </div>
    <div class="board-side board-side--white">
      <div class="board-name" data-white-name>--</div>
      <div class="board-clock" data-white-clock>--:--</div>
    </div>
    <div class="board-result" data-result>--</div>
  </div>
`;
app.appendChild(gameView);

const canvas = document.createElement("canvas");
canvas.className = "scene";
gameView.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2efe9);

const tableGroup = new THREE.Group();
scene.add(tableGroup);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
const cameraDistance = 12;
const cameraHeight = 10;
const cameraTargets = {
  white: new THREE.Vector3(0, 0, 0),
  black: new THREE.Vector3(0, 0, 0)
};
const cameraPositions = {
  white: new THREE.Vector3(0, cameraHeight, cameraDistance),
  black: new THREE.Vector3(0, cameraHeight, -cameraDistance)
};
let cameraSide = "white";
camera.position.copy(cameraPositions[cameraSide]);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(cameraTargets[cameraSide]);
controls.enableRotate = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(8, 12, 6);
scene.add(keyLight);

const boardGroup = new THREE.Group();
const squareSize = 1;
const boardSize = 8;
const lightSquare = new THREE.MeshStandardMaterial({ color: 0xf1e7d0 });
const darkSquare = new THREE.MeshStandardMaterial({ color: 0x7a5c3e });
const moveMaterial = new THREE.MeshStandardMaterial({ color: 0xc9d8a5 });
const boardSquaresById = new Map();

for (let z = 0; z < boardSize; z += 1) {
  for (let x = 0; x < boardSize; x += 1) {
    const isDark = (x + z) % 2 === 1;
    const square = new THREE.Mesh(
      new THREE.BoxGeometry(squareSize, 0.15, squareSize),
      isDark ? darkSquare : lightSquare
    );
    square.position.set(
      x - boardSize / 2 + squareSize / 2,
      0,
      z - boardSize / 2 + squareSize / 2
    );
    const rank = boardSize - 1 - z;
    const squareId = coordsToSquare(x, rank);
    square.userData = { file: x, rank, type: "square", isDark, squareId };
    boardSquaresById.set(squareId, square);
    boardGroup.add(square);
  }
}

const boardBase = new THREE.Mesh(
  new THREE.BoxGeometry(boardSize + 0.8, 0.4, boardSize + 0.8),
  new THREE.MeshStandardMaterial({ color: 0x4a3523 })
);
boardBase.position.y = -0.25;
boardBase.userData = { type: "base" };
boardGroup.add(boardBase);
tableGroup.add(boardGroup);

const hoverMaterial = new THREE.MeshStandardMaterial({ color: 0xd3b47b });
const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x9bb5e5 });
const invalidMaterial = new THREE.MeshStandardMaterial({ color: 0xd66c6c });
let hoveredSquare = null;
let selectedSquare = null;
const moveHighlightSquares = new Set();

function setSquareMaterial(square, material) {
  square.material = material;
}

function resetSquareMaterial(square) {
  square.material = square.userData.isDark ? darkSquare : lightSquare;
}

function refreshSquareMaterial(square) {
  if (square === selectedSquare) {
    setSquareMaterial(square, selectedMaterial);
    return;
  }
  if (square === hoveredSquare) {
    setSquareMaterial(square, hoverMaterial);
    return;
  }
  if (moveHighlightSquares.has(square)) {
    setSquareMaterial(square, moveMaterial);
    return;
  }
  resetSquareMaterial(square);
}

function flashInvalidMove(targetSquare) {
  if (selectedSquare) {
    setSquareMaterial(selectedSquare, invalidMaterial);
  }
  if (targetSquare && targetSquare !== selectedSquare) {
    setSquareMaterial(targetSquare, invalidMaterial);
  }
  window.setTimeout(() => {
    if (selectedSquare) {
      refreshSquareMaterial(selectedSquare);
    }
    if (targetSquare && targetSquare !== selectedSquare) {
      refreshSquareMaterial(targetSquare);
    }
  }, 220);
}

function clearSelection() {
  if (!selectedSquare) {
    return;
  }
  const previous = selectedSquare;
  selectedSquare = null;
  refreshSquareMaterial(previous);
}

function clearMoveHighlights() {
  const squares = Array.from(moveHighlightSquares);
  moveHighlightSquares.clear();
  for (const square of squares) {
    refreshSquareMaterial(square);
  }
}

function setMoveHighlights(squareIds) {
  clearMoveHighlights();
  for (const squareId of squareIds) {
    const square = boardSquaresById.get(squareId);
    if (!square) {
      continue;
    }
    moveHighlightSquares.add(square);
    refreshSquareMaterial(square);
  }
}

function createLabelSprite(text) {
  const size = 128;
  const canvasLabel = document.createElement("canvas");
  canvasLabel.width = size;
  canvasLabel.height = size;
  const context = canvasLabel.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.fillStyle = "rgba(0, 0, 0, 0)";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#2c1f16";
  context.font = "bold 64px 'Trebuchet MS'";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvasLabel);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.5, 0.5);
  return sprite;
}

const labelsGroup = new THREE.Group();
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
for (let file = 0; file < boardSize; file += 1) {
  const label = createLabelSprite(files[file]);
  const { x } = boardToWorld(file, 0);
  label.position.set(x, 0.25, boardSize / 2 + 0.7);
  labelsGroup.add(label);
}
for (let rank = 0; rank < boardSize; rank += 1) {
  const label = createLabelSprite(String(rank + 1));
  const { z } = boardToWorld(0, rank);
  label.position.set(-boardSize / 2 - 0.7, 0.25, z);
  labelsGroup.add(label);
}
tableGroup.add(labelsGroup);

const piecesGroup = new THREE.Group();
tableGroup.add(piecesGroup);

const pieceMaterials = {
  w: new THREE.MeshStandardMaterial({ color: 0xf5f0e6 }),
  b: new THREE.MeshStandardMaterial({ color: 0x2c1f16 })
};

function createPrimitivePiece(type, color) {
  const material = pieceMaterials[color];
  const group = new THREE.Group();
  let geometry;
  switch (type) {
    case "p":
      geometry = new THREE.CylinderGeometry(0.22, 0.3, 0.5, 24);
      break;
    case "r":
      geometry = new THREE.CylinderGeometry(0.32, 0.36, 0.7, 24);
      break;
    case "n":
      geometry = new THREE.CylinderGeometry(0.28, 0.34, 0.75, 24);
      break;
    case "b":
      geometry = new THREE.ConeGeometry(0.28, 0.9, 24);
      break;
    case "q":
      geometry = new THREE.ConeGeometry(0.38, 1.15, 24);
      break;
    case "k":
      geometry = new THREE.CylinderGeometry(0.34, 0.42, 1.2, 24);
      break;
    default:
      geometry = new THREE.BoxGeometry(0.4, 0.6, 0.4);
      break;
  }
  const base = new THREE.Mesh(geometry, material);
  base.castShadow = false;
  group.add(base);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.4, 0.12, 24),
    material
  );
  pedestal.position.y = -0.35;
  group.add(pedestal);

  if (type === "p") {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), material);
    head.position.y = 0.4;
    group.add(head);
  } else if (type === "r") {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), material);
    cap.position.y = 0.42;
    group.add(cap);
  } else if (type === "n") {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 16), material);
    neck.position.y = 0.48;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.2), material);
    head.position.set(0.08, 0.68, 0.1);
    group.add(head);
  } else if (type === "b") {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), material);
    orb.position.y = 0.55;
    group.add(orb);
  } else if (type === "q") {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 16, 24), material);
    crown.position.y = 0.62;
    crown.rotation.x = Math.PI / 2;
    group.add(crown);
  } else if (type === "k") {
    const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), material);
    crossVert.position.y = 0.76;
    group.add(crossVert);
    const crossHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.08), material);
    crossHoriz.position.y = 0.86;
    group.add(crossHoriz);
  }

  return group;
}

function boardToWorld(file, rank) {
  return {
    x: file - boardSize / 2 + squareSize / 2,
    z: boardSize / 2 - squareSize / 2 - rank
  };
}

function coordsToSquare(file, rank) {
  const fileChar = String.fromCharCode("a".charCodeAt(0) + file);
  return `${fileChar}${rank + 1}`;
}

function squareToCoords(square) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  return { file, rank };
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    child.geometry?.dispose?.();
  }
}

const gameState = new GameState();
const pieceMeshes = new Map();
const menuPanel = gameView.querySelector("[data-menu]");
const turnLabel = gameView.querySelector("[data-turn]");
const whiteNameLabel = gameView.querySelector("[data-white-name]");
const blackNameLabel = gameView.querySelector("[data-black-name]");
const whiteClockLabel = gameView.querySelector("[data-white-clock]");
const blackClockLabel = gameView.querySelector("[data-black-clock]");
const puzzleButton = gameView.querySelector("[data-puzzle]");
const puzzleStatus = gameView.querySelector("[data-puzzle-status]");
const aiButton = gameView.querySelector("[data-ai]");
const aiStatus = gameView.querySelector("[data-ai-status]");
const resultLabel = gameView.querySelector("[data-result]");
const minutesInput = gameView.querySelector("[data-minutes]");
const incrementInput = gameView.querySelector("[data-increment]");
const opponentInput = gameView.querySelector("[data-opponent]");
const challengeUserButton = gameView.querySelector("[data-challenge-user]");
const challengeOpenButton = gameView.querySelector("[data-challenge-open]");
const loginButton = loginView.querySelector("[data-login]");
const loginStatus = loginView.querySelector("[data-login-status]");
const logoutButton = gameView.querySelector("[data-logout]");

const samplePuzzles = [
  "r1bq1rk1/pp3ppp/2nbpn2/2pp4/2P5/2NP1NP1/PP2PPBP/R1BQ1RK1 w - - 0 9",
  "8/8/8/2k5/8/5K2/6P1/8 w - - 0 1",
  "r3k2r/pppq1ppp/2n1bn2/3p4/3P4/2N1PN2/PPQ2PPP/R1B1KB1R w KQkq - 0 8"
];

let puzzleMode = false;
let puzzleSolution = [];
let puzzleIndex = 0;
let liveGameId = null;
let liveGameColor = null;
let currentUserId = null;
let streamAbortController = null;
let liveInitialTime = null;
let liveIncrement = null;
let liveInitialFen = null;
let eventAbortController = null;

function setPuzzleMode(solution = []) {
  puzzleMode = Array.isArray(solution) && solution.length > 0;
  puzzleSolution = puzzleMode ? solution.slice() : [];
  puzzleIndex = 0;
}

function getExpectedPuzzleMove() {
  if (!puzzleMode) {
    return null;
  }
  return puzzleSolution[puzzleIndex] || null;
}

function applyPuzzleMove(moveUci) {
  if (!moveUci || moveUci.length < 4) {
    return false;
  }
  const from = moveUci.slice(0, 2);
  const to = moveUci.slice(2, 4);
  const promotion = moveUci.length > 4 ? moveUci[4] : undefined;
  try {
    return Boolean(gameState.makeMove({ from, to, promotion }));
  } catch (error) {
    return false;
  }
}

async function fetchRandomPuzzle() {
  const headers = {};
  const token = getToken();
  let endpoint = "https://lichess.org/api/puzzle/daily";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    endpoint = "https://lichess.org/api/puzzle/next";
  }
  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    throw new Error(`Puzzle request failed: ${response.status}`);
  }
  return response.json();
}

async function fetchAccount() {
  const token = getToken();
  if (!token) {
    return null;
  }
  const response = await fetch("https://lichess.org/api/account", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error(`Account request failed: ${response.status}`);
  }
  return response.json();
}

async function challengeStockfish({ level = 3 } = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("Missing token");
  }
  const body = new URLSearchParams({
    level: String(level),
    rated: "false"
  });
  const response = await fetch("https://lichess.org/api/challenge/ai", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`AI challenge failed: ${response.status}`);
  }
  return response.json();
}

function getTimeControl() {
  const minutes = Number(minutesInput.value || 5);
  const increment = Number(incrementInput.value || 0);
  return {
    limit: Math.max(60, Math.min(60 * 180, Math.round(minutes * 60))),
    increment: Math.max(0, Math.min(60, Math.round(increment)))
  };
}

async function challengeUser(username) {
  const token = getToken();
  if (!token) {
    throw new Error("Missing token");
  }
  const { limit, increment } = getTimeControl();
  const body = new URLSearchParams({
    rated: "false",
    "clock.limit": String(limit),
    "clock.increment": String(increment)
  });
  const response = await fetch(`https://lichess.org/api/challenge/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`User challenge failed: ${response.status}`);
  }
  return response.json();
}

async function challengeOpen() {
  const token = getToken();
  if (!token) {
    throw new Error("Missing token");
  }
  const { limit, increment } = getTimeControl();
  const body = new URLSearchParams({
    rated: "false",
    "clock.limit": String(limit),
    "clock.increment": String(increment)
  });
  const response = await fetch("https://lichess.org/api/challenge/open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`Open challenge failed: ${response.status}`);
  }
  return response.json();
}

async function sendMoveToLichess(gameId, uci) {
  const token = getToken();
  if (!token) {
    throw new Error("Missing token");
  }
  const response = await fetch(`https://lichess.org/api/board/game/${gameId}/move/${uci}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error(`Move rejected: ${response.status}`);
  }
  return response.text();
}

function setLiveGame(id, color = null) {
  liveGameId = id;
  liveGameColor = color;
  if (id) {
    setPuzzleMode([]);
    puzzleStatus.textContent = "Inactive";
    resultLabel.textContent = "--";
  }
  updateMenuVisibility();
}

function setGameResult(status, winner, reason) {
  if (status !== "mate" && status !== "resign" && status !== "draw" && status !== "outoftime") {
    return;
  }
  if (status === "draw") {
    resultLabel.textContent = "Draw";
  } else {
    const winnerLabel = winner === "white" ? "White" : winner === "black" ? "Black" : "Unknown";
    const reasonLabel = reason ? ` (${reason})` : "";
    resultLabel.textContent = `${winnerLabel} wins${reasonLabel}`;
  }
  if (liveGameId) {
    liveGameId = null;
    updateMenuVisibility();
  }
}

function setViewForColor(color) {
  if (color === "b") {
    tableGroup.rotation.y = Math.PI;
    cameraSide = "black";
  } else {
    tableGroup.rotation.y = 0;
    cameraSide = "white";
  }
  camera.position.copy(cameraPositions[cameraSide]);
  controls.target.copy(cameraTargets[cameraSide]);
}

function updateMenuVisibility() {
  if (!menuPanel) {
    return;
  }
  if (liveGameId) {
    menuPanel.classList.add("menu--hidden");
  } else {
    menuPanel.classList.remove("menu--hidden");
  }
}

function formatClock(ms) {
  if (typeof ms !== "number") {
    return "--:--";
  }
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function setPlayerInfo({ white, black, initial, increment }) {
  if (white) {
    const name = white.name || white.id || "White";
    const rating = white.rating ? ` ${white.rating}` : "";
    whiteNameLabel.textContent = `${name}${rating}`;
  }
  if (black) {
    const name = black.name || black.id || "Black";
    const rating = black.rating ? ` ${black.rating}` : "";
    blackNameLabel.textContent = `${name}${rating}`;
  }
  liveInitialTime = typeof initial === "number" ? initial : liveInitialTime;
  liveIncrement = typeof increment === "number" ? increment : liveIncrement;
}

async function ensureAccount() {
  try {
    const account = await fetchAccount();
    currentUserId = account?.id || null;
  } catch (error) {
    console.warn(error);
    currentUserId = null;
  }
}

async function streamGame(gameId) {
  const token = getToken();
  if (!token) {
    throw new Error("Missing token");
  }
  if (streamAbortController) {
    streamAbortController.abort();
  }
  streamAbortController = new AbortController();

  const response = await fetch(`https://lichess.org/api/board/game/stream/${gameId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal: streamAbortController.signal
  });
  if (!response.ok) {
    throw new Error(`Game stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const data = JSON.parse(line);
      if (data.type === "gameFull") {
        const initialFen = data.initialFen && data.initialFen !== "startpos" ? data.initialFen : null;
        const moves = data.state?.moves ? data.state.moves.split(" ") : [];
        liveInitialFen = initialFen;
        gameState.loadFromMoves({ fen: liveInitialFen, moves });
        setPlayerInfo({
          white: data.white,
          black: data.black,
          initial: data.clock?.initial,
          increment: data.clock?.increment
        });
        whiteClockLabel.textContent = formatClock(data.state?.wtime);
        blackClockLabel.textContent = formatClock(data.state?.btime);
        if (currentUserId) {
          if (data.white?.id === currentUserId) {
            setLiveGame(gameId, "w");
          } else if (data.black?.id === currentUserId) {
            setLiveGame(gameId, "b");
          } else {
            setLiveGame(gameId, null);
          }
        } else {
          setLiveGame(gameId, null);
        }
        setViewForColor(liveGameColor);
        aiStatus.textContent = "Live";
        if (data.state?.status) {
          setGameResult(data.state.status, data.state.winner, data.state.status);
        }
      } else if (data.type === "gameState") {
        const moves = data.moves ? data.moves.split(" ") : [];
        gameState.loadFromMoves({ fen: liveInitialFen, moves });
        whiteClockLabel.textContent = formatClock(data.wtime);
        blackClockLabel.textContent = formatClock(data.btime);
        if (data.status) {
          setGameResult(data.status, data.winner, data.status);
        }
      }
    }
  }
}

async function streamEvents() {
  const token = getToken();
  if (!token) {
    return;
  }
  if (eventAbortController) {
    eventAbortController.abort();
  }
  eventAbortController = new AbortController();
  const response = await fetch("https://lichess.org/api/stream/event", {
    headers: {
      Authorization: `Bearer ${token}`
    },
    signal: eventAbortController.signal
  });
  if (!response.ok) {
    throw new Error(`Event stream failed: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const data = JSON.parse(line);
      if (data.type === "gameStart") {
        const gameId = data.game?.id;
        if (!gameId) {
          continue;
        }
        aiStatus.textContent = "Connecting...";
        setLiveGame(gameId);
        streamGame(gameId).catch((error) => {
          console.warn(error);
          aiStatus.textContent = "Stream failed";
        });
      }
    }
  }
}

function syncPieces() {
  clearGroup(piecesGroup);
  pieceMeshes.clear();
  const board = gameState.getBoard();
  for (let row = 0; row < board.length; row += 1) {
    const rank = 7 - row;
    for (let file = 0; file < board[row].length; file += 1) {
      const piece = board[row][file];
      if (!piece) {
        continue;
      }
      const mesh = createPrimitivePiece(piece.type, piece.color);
      const { x, z } = boardToWorld(file, rank);
      mesh.position.set(x, 0.45, z);
      const square = coordsToSquare(file, rank);
      mesh.userData = { square, type: piece.type, color: piece.color };
      piecesGroup.add(mesh);
      pieceMeshes.set(square, mesh);
    }
  }
}

syncPieces();
turnLabel.textContent = gameState.getTurn() === "w" ? "White" : "Black";

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0xe8e3da })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
scene.add(ground);

function handleResize() {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener("resize", handleResize);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickSquare() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(boardGroup.children);
  const hit = hits.find((entry) => entry.object.userData?.type === "square");
  return hit ? hit.object : null;
}

window.addEventListener("pointermove", (event) => {
  updatePointer(event);
  const square = pickSquare();
  if (square === hoveredSquare) {
    return;
  }
  const previous = hoveredSquare;
  hoveredSquare = square;
  if (previous) {
    refreshSquareMaterial(previous);
  }
  if (hoveredSquare) {
    refreshSquareMaterial(hoveredSquare);
  }
});

window.addEventListener("click", (event) => {
  updatePointer(event);
  const square = pickSquare();
  if (!square) {
    clearSelection();
    clearMoveHighlights();
    return;
  }
  const squareId = square.userData.squareId;
  const isLiveGame = Boolean(liveGameId);
  if (!selectedSquare) {
    if (isLiveGame && liveGameColor && gameState.getTurn() !== liveGameColor) {
      return;
    }
    const piece = gameState.getPiece(squareId);
    if (!piece || piece.color !== gameState.getTurn()) {
      return;
    }
    selectedSquare = square;
    refreshSquareMaterial(selectedSquare);
    const moves = gameState.getMoves(squareId);
    setMoveHighlights(moves.map((move) => move.to));
    return;
  }

  if (square === selectedSquare) {
    clearSelection();
    clearMoveHighlights();
    return;
  }

  const nextPiece = gameState.getPiece(squareId);
  if (nextPiece && nextPiece.color === gameState.getTurn()) {
    clearSelection();
    clearMoveHighlights();
    selectedSquare = square;
    refreshSquareMaterial(selectedSquare);
    const moves = gameState.getMoves(squareId);
    setMoveHighlights(moves.map((move) => move.to));
    return;
  }

  const from = selectedSquare.userData.squareId;
  const to = squareId;
  const expected = getExpectedPuzzleMove();
  if (expected) {
    const promotion = expected.length > 4 ? expected[4] : undefined;
    if (expected.slice(0, 2) !== from || expected.slice(2, 4) !== to) {
      flashInvalidMove(square);
      return;
    }
    const move = gameState.makeMove({ from, to, promotion });
    clearSelection();
    clearMoveHighlights();
    if (!move) {
      return;
    }
    puzzleIndex += 1;
    const responseMove = puzzleSolution[puzzleIndex];
    if (responseMove) {
      const applied = applyPuzzleMove(responseMove);
      if (applied) {
        puzzleIndex += 1;
      } else {
        console.warn("Failed to apply puzzle response move");
      }
    }
    if (puzzleIndex >= puzzleSolution.length) {
      puzzleStatus.textContent = "Solved";
    }
    return;
  }
  const move = gameState.makeMove({ from, to, promotion: "q" });
  clearSelection();
  clearMoveHighlights();
  if (!move) {
    return;
  }
  if (isLiveGame && liveGameId) {
    const uci = `${move.from}${move.to}${move.promotion || ""}`;
    sendMoveToLichess(liveGameId, uci).catch((error) => {
      console.warn(error);
      aiStatus.textContent = "Move failed";
    });
  }
});

gameState.onChange(() => {
  syncPieces();
  turnLabel.textContent = gameState.getTurn() === "w" ? "White" : "Black";
});

puzzleButton.addEventListener("click", () => {
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
  if (eventAbortController) {
    eventAbortController.abort();
    eventAbortController = null;
  }
  setLiveGame(null);
  puzzleStatus.textContent = "Loading...";
  fetchRandomPuzzle()
    .then((data) => {
      let ok = false;
      const initialPly = data?.puzzle?.initialPly;
      const solution = data?.puzzle?.solution || [];
      if (data?.game?.pgn && Number.isInteger(initialPly)) {
        const attemptLoad = (ply) => {
          if (ply < 0) {
            return false;
          }
          try {
            const loaded = gameState.loadPgnToPly(data.game.pgn, ply);
            if (!loaded) {
              return false;
            }
            if (solution.length === 0) {
              return true;
            }
            return gameState.isMoveLegalUci(solution[0]);
          } catch (error) {
            return false;
          }
        };
        const offsets = [0, 1, -1, 2, -2];
        for (const offset of offsets) {
          if (attemptLoad(initialPly + offset)) {
            ok = true;
            break;
          }
        }
      } else if (data?.puzzle?.fen) {
        ok = gameState.loadPosition(data.puzzle.fen);
      } else if (data?.game?.fen) {
        ok = gameState.loadPosition(data.game.fen);
      }
      if (!ok) {
        throw new Error("Failed to load puzzle position");
      }
      setPuzzleMode(data?.puzzle?.solution);
      puzzleStatus.textContent = `#${data.puzzle?.id || "daily"}`;
      if (data?.puzzle?.solution?.length) {
        console.log("Puzzle loaded", {
          id: data.puzzle.id,
          initialPly: data.puzzle.initialPly,
          firstMove: data.puzzle.solution[0],
          turn: gameState.getTurn()
        });
      }
    })
    .catch((error) => {
      console.warn(error);
      puzzleStatus.textContent = "Failed";
      const fallback = samplePuzzles[Math.floor(Math.random() * samplePuzzles.length)];
      gameState.loadPosition(fallback);
      setPuzzleMode([]);
    });
});

aiButton.addEventListener("click", () => {
  aiStatus.textContent = "Sending...";
  challengeStockfish({ level: 3 })
    .then((data) => {
      const gameId = data?.game?.id || data?.challenge?.id || data?.id;
      if (!gameId) {
        aiStatus.textContent = "Failed";
        return;
      }
      aiStatus.textContent = "Connecting...";
      setLiveGame(gameId);
      streamGame(gameId).catch((error) => {
        console.warn(error);
        aiStatus.textContent = "Stream failed";
      });
    })
    .catch((error) => {
      console.warn(error);
      aiStatus.textContent = "Denied";
    });
});

challengeUserButton.addEventListener("click", () => {
  const username = opponentInput.value.trim();
  if (!username) {
    aiStatus.textContent = "Missing user";
    return;
  }
  aiStatus.textContent = "Sending...";
  challengeUser(username)
    .then((data) => {
      const gameId = data?.challenge?.id || data?.game?.id;
      if (!gameId) {
        aiStatus.textContent = "Sent";
        return;
      }
      aiStatus.textContent = "Waiting...";
    })
    .catch((error) => {
      console.warn(error);
      aiStatus.textContent = "Denied";
    });
});

challengeOpenButton.addEventListener("click", () => {
  aiStatus.textContent = "Opening...";
  challengeOpen()
    .then((data) => {
      const challengeId = data?.challenge?.id;
      if (challengeId) {
        aiStatus.textContent = "Open";
      } else {
        aiStatus.textContent = "Sent";
      }
    })
    .catch((error) => {
      console.warn(error);
      aiStatus.textContent = "Denied";
    });
});

loginButton.addEventListener("click", async () => {
  try {
    loginStatus.textContent = "";
    const url = await createLoginUrl(lichessConfig);
    window.location.assign(url);
  } catch (error) {
    console.warn(error);
    loginStatus.textContent = "Missing Lichess config.";
  }
});

logoutButton.addEventListener("click", () => {
  logout();
  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
  if (eventAbortController) {
    eventAbortController.abort();
    eventAbortController = null;
  }
  setLiveGame(null);
  currentUserId = null;
  liveInitialFen = null;
  updateAuthView();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "f") {
    return;
  }
  cameraSide = cameraSide === "white" ? "black" : "white";
  camera.position.copy(cameraPositions[cameraSide]);
  controls.target.copy(cameraTargets[cameraSide]);
});

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateAuthView() {
  const authed = isLoggedIn();
  loginView.style.display = authed ? "none" : "grid";
  gameView.style.display = authed ? "block" : "none";
  if (authed) {
    handleResize();
    ensureAccount();
    streamEvents().catch((error) => {
      console.warn(error);
    });
  } else {
    whiteNameLabel.textContent = "--";
    blackNameLabel.textContent = "--";
    whiteClockLabel.textContent = "--:--";
    blackClockLabel.textContent = "--:--";
    resultLabel.textContent = "--";
  }
}

handleRedirectCallback(lichessConfig)
  .catch((error) => {
    console.warn(error);
  })
  .then((result) => {
    if (!result || result.status === "no_code") {
      return;
    }
    if (result.status === "error") {
      loginStatus.textContent = "Login canceled or rejected.";
    } else if (result.status === "invalid_state") {
      loginStatus.textContent = "Login expired. Please try again.";
    } else if (result.status === "missing_verifier") {
      loginStatus.textContent = "Login failed. Please retry.";
    }
  })
  .finally(() => {
    updateAuthView();
  });

animate();
