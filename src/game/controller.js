import * as THREE from "three";
import { GameState } from "./state.js";
import {
  createLoginUrl,
  handleRedirectCallback,
  isLoggedIn,
  logout as clearAuth,
  getToken
} from "../auth/lichess.js";
import * as lichessApi from "./lichessApi.js";
import { createPuzzleFetcher } from "./controller/puzzles.js";
import { createPieceAssets } from "./controller/pieces.js";
import {
  boardToWorld as boardToWorldCoord,
  coordsToSquare,
  getCapturePosition as getCapturePositionCoord,
  squareToCoords as squareToCoordsCoord
} from "./controller/coords.js";
import { createMoveHistoryTracker } from "./controller/history.js";
import {
  createLabelSprite,
  createLabelTexture,
  updateBoardLabelsForColor as updateLabelsForColor
} from "./controller/labels.js";
import {
  getDragIntersection,
  getPointerFromEvent,
  pickPiece,
  pickSquare
} from "./controller/input.js";
import { createMoveAnimator } from "./controller/moves.js";
import { createSceneCore } from "./controller/scene.js";
import { createSceneInteraction } from "./controller/interaction.js";
import { createClockTicker } from "./controller/clocks.js";
import { createSelectionManager } from "./controller/selection.js";
import { createPuzzleFlow } from "./controller/puzzleFlow.js";
import { createGameStateSync } from "./controller/stateSync.js";
import { createLiveGameManager } from "./controller/liveGame.js";
import { createViewManager } from "./controller/view.js";
import { createBoardMaterialManager } from "./controller/materials.js";
import { createBoardMaterials } from "./controller/boardMaterials.js";
import { createBoardConfig } from "./controller/boardConfig.js";
import {
  ensureAccount as ensureAccountFn,
  streamEvents as streamEventsFn,
  streamGame as streamGameFn
} from "./controller/streaming.js";

const DEFAULT_CONFIG = {
  clientId: "",
  redirectUri: "",
  scope: "challenge:write board:play puzzle:read puzzle:write",
  oauthUrl: "https://lichess.org/oauth",
  tokenUrl: "https://lichess.org/api/token"
};

export function createGameController({
  config,
  onAuthChange = () => {},
  onLoginStatus = () => {},
  onTurnChange = () => {},
  onPlayersChange = () => {},
  onClocksChange = () => {},
  onPuzzleStatus = () => {},
  onPuzzleSolution = () => {},
  onPuzzleRating = () => {},
  onPromotionRequest = () => {},
  onAiStatus = () => {},
  onDrawStatus = () => {},
  onResultChange = () => {},
  onMoveHistoryChange = () => {},
  onChatMessage = () => {},
  onChatClear = () => {},
  onMenuVisibility = () => {},
  onGameEnd = () => {},
  onAccountChange = () => {},
  onIncomingChallenge = () => {}
} = {}) {
  const lichessConfig = { ...DEFAULT_CONFIG, ...config };
  const gameState = new GameState();
  const puzzleFetcher = createPuzzleFetcher({ getToken });

  let renderer = null;
  let scene = null;
  let tableGroup = null;
  let camera = null;
  let controls = null;
  let boardGroup = null;
  let labelsGroup = null;
  let piecesGroup = null;
  let capturedWhiteGroup = null;
  let capturedBlackGroup = null;
  let interactionManager = null;

  const boardSquaresById = new Map();
  const moveHighlightSquares = new Set();
  const {
    boardSize,
    squareSize,
    captureLayout,
    cameraTargets,
    cameraPositions
  } = createBoardConfig();
  const boardToWorld = (file, rank) => boardToWorldCoord(file, rank, boardSize, squareSize);
  const squareToCoords = (squareId) => squareToCoordsCoord(squareId, boardSize);
  const getCapturePosition = (color, index) =>
    getCapturePositionCoord(color, index, captureLayout);
  const updateBoardLabelsForColor = (color) =>
    updateLabelsForColor({
      labelsGroup,
      boardSize,
      boardToWorld,
      color,
      createTexture: createLabelTexture
    });

  const {
    lightSquare,
    darkSquare,
    moveMaterial,
    hoverMaterial,
    selectedMaterial,
    invalidMaterial
  } = createBoardMaterials();

  const pieceAssets = createPieceAssets();

  const cameraTargetVectors = {
    white: new THREE.Vector3(...cameraTargets.white),
    black: new THREE.Vector3(...cameraTargets.black)
  };
  const cameraPositionVectors = {
    white: new THREE.Vector3(...cameraPositions.white),
    black: new THREE.Vector3(...cameraPositions.black)
  };
  let cameraSide = "white";

  let hoveredSquare = null;
  let selectedSquare = null;
  let dragState = null;
  let dragJustEnded = false;
  const { loadPieceModels, createModelPiece, createPrimitivePiece, disposeObject } = pieceAssets;
  let isSceneActive = false;
  let suppressNextSync = false;
  let isAnimatingMove = false;
  let pendingSync = false;
  const piecesBySquare = new Map();
  const moveQueue = [];
  const capturedPieces = {
    w: [],
    b: []
  };

  let liveGameId = null;
  let liveGameColor = null;
  let currentUserId = null;
  let liveInitialFen = null;
  let liveMoves = [];
  let pendingHistoryMoves = null;
  let streamingGameId = null;
  let streamRetryTimeout = null;
  let streamHealthInterval = null;
  let lastStreamUpdate = 0;
  let chatGameId = null;
  let capturedGameId = null;
  const moveHistory = createMoveHistoryTracker({ gameState, onMoveHistoryChange });
  let streamAbortController = null;
  let eventAbortController = null;
  let liveClock = { white: null, black: null, turn: "w", lastUpdate: 0 };
  let lastGameSummary = null;
  let lastResultGameId = null;
  let baseRotationY = 0;
  let spinAngle = 0;
  let accountInfo = null;
  let pendingPromotion = null;

  const windowListeners = [];

  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    windowListeners.push({ target, event, handler });
  }

  function teardownListeners() {
    for (const { target, event, handler } of windowListeners) {
      target.removeEventListener(event, handler);
    }
    windowListeners.length = 0;
  }

  function requireToken() {
    const token = getToken();
    if (!token) {
      throw new Error("Missing token");
    }
    return token;
  }

  const puzzleFlow = createPuzzleFlow({
    getToken,
    isLoggedIn,
    submitPuzzleBatch: lichessApi.submitPuzzleBatch,
    ensureAccount,
    onPuzzleSolution,
    onPuzzleStatus,
    onPuzzleRating,
    onMenuVisibility
  });
  const {
    setPuzzleMode,
    resetPuzzleAttempt,
    beginPuzzleAttempt,
    submitPuzzleAttempt,
    getExpectedPuzzleMove,
    applyPuzzleMove,
    handlePuzzleMoveResult,
    isInteractionEnabled,
    beginPuzzleUi,
    resetPuzzleUiOnFailure
  } = puzzleFlow;


  const viewManager = createViewManager({
    cameraPositions: cameraPositionVectors,
    cameraTargets: cameraTargetVectors,
    updateBoardLabelsForColor,
    getCameraSide: () => cameraSide,
    setCameraSide: (value) => { cameraSide = value; },
    setBaseRotationY: (value) => { baseRotationY = value; },
    getSpinAngle: () => spinAngle,
    getTableGroup: () => tableGroup,
    getCamera: () => camera,
    getControls: () => controls
  });
  const { setViewForColor } = viewManager;

  const clockTicker = createClockTicker({
    onClocksChange,
    getLiveGameId: () => liveGameId,
    getLiveClock: () => liveClock,
    setLiveClock: (value) => { liveClock = value; }
  });
  const { formatClock } = clockTicker;

  const liveGameManager = createLiveGameManager({
    getToken,
    fetchGameSummary: lichessApi.fetchGameSummary,
    resetPuzzleAttempt,
    setPuzzleMode,
    onPuzzleStatus,
    onPuzzleRating,
    onResultChange,
    onMenuVisibility,
    onGameEnd: handleGameEndWithAccount,
    onPlayersChange,
    clockTicker,
    getLiveGameId: () => liveGameId,
    setLiveGameId: (value) => { liveGameId = value; },
    getLastGameSummary: () => lastGameSummary,
    setLastGameSummary: (value) => { lastGameSummary = value; },
    getLastResultGameId: () => lastResultGameId,
    setLastResultGameId: (value) => { lastResultGameId = value; },
    setSpinAngle: (value) => { spinAngle = value; }
  });
  const { setLiveGame, setGameResult, setPlayerInfo } = liveGameManager;

  const squareMaterials = createBoardMaterialManager({
    lightSquare,
    darkSquare,
    moveMaterial,
    hoverMaterial,
    selectedMaterial,
    invalidMaterial,
    moveHighlightSquares,
    getSelectedSquare: () => selectedSquare,
    getHoveredSquare: () => hoveredSquare
  });
  const { setSquareMaterial, resetSquareMaterial, refreshSquareMaterial } = squareMaterials;

  const selection = createSelectionManager({
    boardSquaresById,
    moveHighlightSquares,
    setSquareMaterial,
    refreshSquareMaterial,
    invalidMaterial,
    gameState,
    getSelectedSquare: () => selectedSquare,
    setSelectedSquare: (value) => { selectedSquare = value; }
  });
  const {
    getSelectedSquare,
    setSelectedSquare,
    clearSelection,
    clearMoveHighlights,
    setMoveHighlights,
    flashInvalidMove,
    isLegalDestination
  } = selection;

  function getPromotionOptions(from, to) {
    const piece = gameState.getPiece(from);
    if (!piece || piece.type !== "p") {
      return [];
    }
    const moves = gameState.getMoves(from);
    const promotions = moves
      .filter((move) => move.to === to && move.promotion)
      .map((move) => move.promotion);
    return Array.from(new Set(promotions));
  }

  function requestPromotion(from, to, options) {
    const color = gameState.getTurn();
    pendingPromotion = { from, to, options, color };
    onPromotionRequest({ from, to, options: options.slice(), color });
  }

  function executeMove(from, to, promotion) {
    const puzzleResult = handlePuzzleMoveResult({
      from,
      to,
      promotion,
      makeAnimatedMove
    });
    if (puzzleResult?.handled) {
      if (puzzleResult.failed) {
        flashInvalidMove(boardSquaresById.get(to));
        spinAngle = 0;
      }
      if (puzzleResult.solved) {
        spinAngle = 0;
      }
      return true;
    }

    const move = makeAnimatedMove({ from, to, promotion });
    if (!move) {
      return false;
    }
    if (liveGameId) {
      const uci = `${move.from}${move.to}${move.promotion || ""}`;
      lichessApi.sendMoveToLichess(getToken(), liveGameId, uci).catch(() => {
        onAiStatus("Move failed");
      });
    }
    return true;
  }

  function attemptMove(from, to) {
    if (!from || !to || from === to) {
      return false;
    }
    const promotionOptions = getPromotionOptions(from, to);
    if (promotionOptions.length > 0) {
      if (promotionOptions.length === 1) {
        return executeMove(from, to, promotionOptions[0]);
      }
      requestPromotion(from, to, promotionOptions);
      return false;
    }
    return executeMove(from, to, undefined);
  }

  function clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children.pop();
      disposeObject(child);
    }
  }

  function syncPieces() {
    if (!piecesGroup) {
      return;
    }
    piecesBySquare.clear();
    clearGroup(piecesGroup);
    const board = gameState.getBoard();
    for (let row = 0; row < board.length; row += 1) {
      const rank = 7 - row;
      for (let file = 0; file < board[row].length; file += 1) {
        const piece = board[row][file];
        if (!piece) {
          continue;
        }
        const mesh = createModelPiece(piece.type, piece.color)
          || createPrimitivePiece(piece.type, piece.color);
        const { x, z } = boardToWorld(file, rank);
        const baseY = mesh.userData.baseY ?? 0.45;
        const squareId = coordsToSquare(file, rank);
        mesh.position.set(x, baseY, z);
        mesh.userData.squareId = squareId;
        mesh.userData.type = piece.type;
        mesh.userData.color = piece.color;
        if (piece.type === "n" && piece.color === "w") {
          mesh.rotation.y = Math.PI;
        } else {
          mesh.rotation.y = 0;
        }
        piecesGroup.add(mesh);
        piecesBySquare.set(squareId, mesh);
      }
    }
  }

  function resetCapturedPieces() {
    for (const color of ["w", "b"]) {
      const group = color === "w" ? capturedWhiteGroup : capturedBlackGroup;
      if (group) {
        clearGroup(group);
      }
      capturedPieces[color].length = 0;
    }
  }

  function addCapturedPiece(mesh, color) {
    if (!mesh) {
      return;
    }
    const list = capturedPieces[color] ?? capturedPieces.b;
    const group = color === "w" ? capturedWhiteGroup : capturedBlackGroup;
    list.push(mesh);
    const index = list.length - 1;
    const { x, y, z } = getCapturePosition(color, index);
    const baseY = mesh.userData.baseY ?? 0.45;
    mesh.position.set(x, baseY + y, z);
    group?.add(mesh);
  }

  const moveAnimator = createMoveAnimator({
    gameState,
    boardToWorld,
    squareToCoords,
    coordsToSquare,
    piecesBySquare,
    getPiecesGroup: () => piecesGroup,
    syncPieces,
    addCapturedPiece,
    createModelPiece,
    createPrimitivePiece,
    placePieceOnSquare,
    getMoveQueue: () => moveQueue,
    getIsAnimatingMove: () => isAnimatingMove,
    setIsAnimatingMove: (value) => { isAnimatingMove = value; },
    getPendingSync: () => pendingSync,
    setPendingSync: (value) => { pendingSync = value; },
    setSuppressNextSync: (value) => { suppressNextSync = value; }
  });
  const { makeAnimatedMove } = moveAnimator;

  function placePieceOnSquare(mesh, squareId) {
    const coords = squareToCoords(squareId);
    if (!coords) {
      return;
    }
    const { x, z } = boardToWorld(coords.file, coords.rank);
    const baseY = mesh.userData.baseY ?? 0.45;
    mesh.position.set(x, baseY, z);
    mesh.userData.squareId = squareId;
  }

  async function streamGame(gameId) {
    return streamGameFn({
      gameId,
      getToken,
      gameState,
      makeAnimatedMove,
      resetCapturedPieces,
      updateMoveHistory: moveHistory.updateMoveHistory,
      formatClock,
      setLiveGame,
      setViewForColor,
      setGameResult,
      onChatMessage,
      onChatClear,
      onPlayersChange,
      onClocksChange,
      onAiStatus,
      onDrawStatus,
      getLiveGameId: () => liveGameId,
      getCurrentUserId: () => currentUserId,
      getChatGameId: () => chatGameId,
      setChatGameId: (value) => { chatGameId = value; },
      getCapturedGameId: () => capturedGameId,
      setCapturedGameId: (value) => { capturedGameId = value; },
      getLiveInitialFen: () => liveInitialFen,
      setLiveInitialFen: (value) => { liveInitialFen = value; },
      getLiveMoves: () => liveMoves,
      setLiveMoves: (value) => { liveMoves = value; },
      setPendingHistoryMoves: (value) => { pendingHistoryMoves = value; },
      getMoveQueue: () => moveQueue,
      setPendingSync: (value) => { pendingSync = value; },
      setSuppressNextSync: (value) => { suppressNextSync = value; },
      setLastGameSummary: (value) => { lastGameSummary = value; },
      getLiveClock: () => liveClock,
      setLiveClock: (value) => { liveClock = value; },
      setPlayerInfo,
      getStreamRetryTimeout: () => streamRetryTimeout,
      setStreamRetryTimeout: (value) => { streamRetryTimeout = value; },
      getStreamHealthInterval: () => streamHealthInterval,
      setStreamHealthInterval: (value) => { streamHealthInterval = value; },
      getStreamAbortController: () => streamAbortController,
      setStreamAbortController: (value) => { streamAbortController = value; },
      setLastStreamUpdate: (value) => { lastStreamUpdate = value; },
      getLastStreamUpdate: () => lastStreamUpdate,
      setStreamingGameId: (value) => { streamingGameId = value; }
    });
  }

  async function streamEvents() {
    return streamEventsFn({
      getToken,
      onIncomingChallenge,
      onAiStatus,
      setLiveGame,
      streamGame,
      getEventAbortController: () => eventAbortController,
      setEventAbortController: (value) => { eventAbortController = value; }
    });
  }

  async function ensureAccount() {
    return ensureAccountFn({
      getToken,
      onAccountChange,
      setAccountInfo: (value) => { accountInfo = value; },
      setCurrentUserId: (value) => { currentUserId = value; },
      fetchAccount: lichessApi.fetchAccount
    });
  }

  function getPerfRating(perfs, key) {
    const rating = perfs?.[key]?.rating;
    return Number.isFinite(rating) ? rating : null;
  }

  function selectRatingDiff(prevAccount, nextAccount, summary) {
    if (!nextAccount || summary?.rated === false) {
      return null;
    }
    const prevPerfs = prevAccount?.perfs || {};
    const nextPerfs = nextAccount?.perfs || {};
    const preferredKey = summary?.perfKey;
    if (preferredKey) {
      const prevRating = getPerfRating(prevPerfs, preferredKey);
      const nextRating = getPerfRating(nextPerfs, preferredKey);
      if (prevRating != null && nextRating != null) {
        return { key: preferredKey, diff: nextRating - prevRating };
      }
    }
    const allKeys = new Set([...Object.keys(prevPerfs), ...Object.keys(nextPerfs)]);
    const changes = [];
    for (const key of allKeys) {
      const prevRating = getPerfRating(prevPerfs, key);
      const nextRating = getPerfRating(nextPerfs, key);
      if (prevRating == null || nextRating == null) {
        continue;
      }
      const diff = nextRating - prevRating;
      if (diff !== 0) {
        changes.push({ key, diff });
      }
    }
    if (changes.length === 0) {
      return null;
    }
    let best = changes[0];
    for (const change of changes) {
      if (Math.abs(change.diff) > Math.abs(best.diff)) {
        best = change;
      }
    }
    return best;
  }

  function resolvePlayerSide(summary, account) {
    const accountId = account?.id;
    if (accountId && summary?.whiteId === accountId) {
      return "white";
    }
    if (accountId && summary?.blackId === accountId) {
      return "black";
    }
    if (summary?.playerColor === "w") {
      return "white";
    }
    if (summary?.playerColor === "b") {
      return "black";
    }
    return null;
  }

  function handleGameEndWithAccount(summary) {
    const previousAccount = accountInfo;
    onGameEnd(summary);
    const finalize = async () => {
      if (!summary || !isLoggedIn()) {
        return;
      }
      await ensureAccount();
      const nextAccount = accountInfo;
      const ratingChange = selectRatingDiff(previousAccount, nextAccount, summary);
      if (!ratingChange) {
        return;
      }
      const side = resolvePlayerSide(summary, nextAccount);
      if (!side) {
        return;
      }
      if (side === "white" && summary.whiteRatingDiff != null) {
        return;
      }
      if (side === "black" && summary.blackRatingDiff != null) {
        return;
      }
      const updatedSummary = {
        ...summary,
        ...(side === "white"
          ? { whiteRatingDiff: ratingChange.diff }
          : { blackRatingDiff: ratingChange.diff })
      };
      onGameEnd(updatedSummary);
    };
    finalize().catch(() => {});
  }

  function handleResize() {
    if (!renderer || !camera) {
      return;
    }
    const { innerWidth, innerHeight } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  function initScene(canvas) {
    const sceneCore = createSceneCore({
      canvas,
      cameraPositions: cameraPositionVectors,
      cameraTargets: cameraTargetVectors,
      cameraSide,
      boardSize,
      squareSize,
      lightSquare,
      darkSquare,
      createLabelSprite,
      boardToWorld,
      coordsToSquare,
      updateBoardLabelsForColor,
      boardSquaresById
    });
    renderer = sceneCore.renderer;
    scene = sceneCore.scene;
    tableGroup = sceneCore.tableGroup;
    camera = sceneCore.camera;
    controls = sceneCore.controls;
    boardGroup = sceneCore.boardGroup;
    labelsGroup = sceneCore.labelsGroup;
    piecesGroup = sceneCore.piecesGroup;
    capturedWhiteGroup = sceneCore.capturedWhiteGroup;
    capturedBlackGroup = sceneCore.capturedBlackGroup;
    isSceneActive = true;

    syncPieces();
    resetCapturedPieces();
    loadPieceModels().then((models) => {
      if (!isSceneActive || !models) {
        return;
      }
      syncPieces();
    });
    onTurnChange(gameState.getTurn() === "w" ? "White" : "Black");

    interactionManager = createSceneInteraction({
      listen,
      renderer,
      camera,
      controls,
      tableGroup,
      boardGroup,
      piecesGroup,
      boardSquaresById,
      isInteractionEnabled: () => isInteractionEnabled(liveGameId),
      getPointerFromEvent,
      pickSquare,
      pickPiece,
      getDragIntersection,
      refreshSquareMaterial,
      clearSelection,
      clearMoveHighlights,
      setMoveHighlights,
      flashInvalidMove,
      isLegalDestination,
      attemptMove,
      placePieceOnSquare,
      gameState,
      getLiveGameId: () => liveGameId,
      getLiveGameColor: () => liveGameColor,
      getSelectedSquare,
      setSelectedSquare,
      getHoveredSquare: () => hoveredSquare,
      setHoveredSquare: (value) => { hoveredSquare = value; },
      getDragState: () => dragState,
      setDragState: (value) => { dragState = value; },
      getDragJustEnded: () => dragJustEnded,
      setDragJustEnded: (value) => { dragJustEnded = value; },
      getCameraSide: () => cameraSide,
      setCameraSide: (value) => { cameraSide = value; },
      getBaseRotationY: () => baseRotationY,
      setBaseRotationY: (value) => { baseRotationY = value; },
      getSpinAngle: () => spinAngle,
      setSpinAngle: (value) => { spinAngle = value; },
      cameraPositions: cameraPositionVectors,
      cameraTargets: cameraTargetVectors,
      updateBoardLabelsForColor
    });
    listen(window, "resize", handleResize);
    interactionManager.start();
  }

  function destroyScene() {
    interactionManager?.stop?.();
    interactionManager = null;
    isSceneActive = false;
    teardownListeners();
    controls?.dispose?.();
    renderer?.dispose?.();
    renderer = null;
    scene = null;
    tableGroup = null;
    camera = null;
    controls = null;
    boardGroup = null;
    labelsGroup = null;
    piecesGroup = null;
    capturedWhiteGroup = null;
    capturedBlackGroup = null;
    clockTicker.stop();
  }

  function abortStreams() {
    if (streamAbortController) {
      streamAbortController.abort();
      streamAbortController = null;
    }
    if (eventAbortController) {
      eventAbortController.abort();
      eventAbortController = null;
    }
    if (streamRetryTimeout) {
      clearTimeout(streamRetryTimeout);
      streamRetryTimeout = null;
    }
    if (streamHealthInterval) {
      clearInterval(streamHealthInterval);
      streamHealthInterval = null;
    }
    streamingGameId = null;
      clockTicker.stop();
  }

  const handleStateSync = createGameStateSync({
    gameState,
    moveHistory,
    onTurnChange,
    syncPieces,
    getSuppressNextSync: () => suppressNextSync,
    setSuppressNextSync: (value) => { suppressNextSync = value; },
    getIsAnimatingMove: () => isAnimatingMove,
    getMoveQueue: () => moveQueue,
    setPendingSync: (value) => { pendingSync = value; }
  });
  gameState.onChange(handleStateSync);

  function exitPuzzle() {
    resetPuzzleAttempt();
    setPuzzleMode([]);
    onPuzzleStatus("Ready");
    onPuzzleRating("--");
    onPuzzleSolution([]);
    onMenuVisibility(true);
  }

  return {
    init(canvas) {
      initScene(canvas);
      onMenuVisibility(!liveGameId);
      onAuthChange(isLoggedIn());
      onPlayersChange({ white: "--", black: "--", playerColor: "w" });
      onClocksChange({ white: "--:--", black: "--:--" });
      onDrawStatus("");
      onResultChange("--");
      onMoveHistoryChange([]);
      onPuzzleRating("--");
      onPuzzleSolution([]);
      moveHistory.reset();
      onChatClear();
    },
    destroy() {
      abortStreams();
      destroyScene();
    },
    isLoggedIn() {
      return isLoggedIn();
    },
    async handleRedirect() {
      const result = await handleRedirectCallback(lichessConfig);
      if (!result || result.status === "no_code") {
        onAuthChange(isLoggedIn());
        return result;
      }
      if (result.status === "error") {
        onLoginStatus("Login canceled or rejected.");
      } else if (result.status === "invalid_state") {
        onLoginStatus("Login expired. Please try again.");
      } else if (result.status === "missing_verifier") {
        onLoginStatus("Login failed. Please retry.");
      }
      onAuthChange(isLoggedIn());
      if (isLoggedIn()) {
        await ensureAccount();
        streamEvents().catch(() => {});
      }
      return result;
    },
    async login() {
      const url = await createLoginUrl(lichessConfig);
      window.location.assign(url);
    },
    logout() {
      clearAuth();
      abortStreams();
      setLiveGame(null);
      currentUserId = null;
      liveInitialFen = null;
      moveHistory.reset();
      onChatClear();
      onAuthChange(false);
      onPlayersChange({ white: "--", black: "--", playerColor: "w" });
      onClocksChange({ white: "--:--", black: "--:--" });
      onDrawStatus("");
      onResultChange("--");
      onPuzzleRating("--");
      onPuzzleSolution([]);
      onMenuVisibility(true);
    },
    async startPuzzle() {
      abortStreams();
      setLiveGame(null);
      onPuzzleStatus("Loading...");
      onPuzzleRating("--");
        onPuzzleSolution([]);
      onMenuVisibility(false);
      onDrawStatus("");
      spinAngle = 0;
      resetCapturedPieces();
      moveHistory.reset();
      onChatClear();
      try {
        const { data, repeated, requiresAuth } = await puzzleFetcher.fetchRandomPuzzle();
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
        const puzzleLabel = data?.puzzle?.id ? `#${data.puzzle.id}` : "#daily";
        beginPuzzleUi({
          puzzleId: data?.puzzle?.id || null,
          solution: data?.puzzle?.solution,
          rating: data?.puzzle?.rating,
          label: puzzleLabel,
          requiresAuth,
          repeated
        });
        setViewForColor(gameState.getTurn() === "b" ? "b" : "w");
      } catch (error) {
        if (error?.message?.toLowerCase?.().includes("rate limited") || error?.message?.includes("429")) {
          onPuzzleStatus("Rate limited. Try again soon.");
        } else {
          onPuzzleStatus("Failed");
        }
        resetPuzzleUiOnFailure();
      }
    },
    exitPuzzle() {
      exitPuzzle();
    },
    async challengeStockfish() {
      onAiStatus("Sending...");
      try {
        const data = await lichessApi.challengeStockfish(requireToken(), { level: 3 });
        const gameId = data?.game?.id || data?.challenge?.id || data?.id;
        if (!gameId) {
          onAiStatus("Failed");
          return;
        }
        onAiStatus("Connecting...");
        setLiveGame(gameId);
        streamGame(gameId).catch(() => {
          onAiStatus("Stream failed");
        });
      } catch (error) {
        onAiStatus("Denied");
      }
    },
    async challengeUser(username, timeControl) {
      onAiStatus("Sending...");
      try {
        const data = await lichessApi.challengeUser(requireToken(), username, timeControl);
        const challengeId = data?.challenge?.id || data?.id;
        onAiStatus(challengeId ? `Sent ${challengeId}` : "Waiting...");
      } catch (error) {
        console.warn(error);
        onAiStatus("Denied");
      }
    },
    async challengeOpen(timeControl) {
      onAiStatus("Seeking...");
      try {
        await lichessApi.seekGame(requireToken(), timeControl);
        onAiStatus("Seeking...");
      } catch (error) {
        console.warn(error);
        onAiStatus("Denied");
      }
    },
    async startAuthStreams() {
      if (!isLoggedIn()) {
        return;
      }
      await ensureAccount();
      try {
        const playing = await lichessApi.fetchNowPlaying(getToken());
        const activeGame = Array.isArray(playing?.nowPlaying)
          ? playing.nowPlaying.find((entry) => entry?.gameId)
          : null;
        if (activeGame?.gameId) {
          onAiStatus("Connecting...");
          setLiveGame(activeGame.gameId);
          streamGame(activeGame.gameId).catch(() => {
            onAiStatus("Stream failed");
          });
        }
      } catch (error) {
        console.warn("Now playing fetch failed", error);
      }
      streamEvents().catch(() => {});
    },
    getAccount() {
      return accountInfo;
    },
    async getStatus() {
      return lichessApi.fetchStatus(currentUserId);
    },
    async rematch(gameId) {
      const data = await lichessApi.requestRematch(requireToken(), gameId);
      const nextGameId = data?.game?.id || data?.challenge?.id || data?.id;
      if (!nextGameId) {
        throw new Error("Rematch unavailable");
      }
      onAiStatus("Connecting...");
      setLiveGame(nextGameId);
      streamGame(nextGameId).catch(() => {
        onAiStatus("Stream failed");
      });
    },
    async acceptChallenge(challengeId) {
      await lichessApi.acceptChallenge(requireToken(), challengeId);
    },
    async declineChallenge(challengeId) {
      await lichessApi.declineChallenge(requireToken(), challengeId);
    },
    async resignCurrentGame() {
      if (!liveGameId) {
        throw new Error("No active game");
      }
      await lichessApi.resignGame(requireToken(), liveGameId);
    },
    async offerDrawCurrentGame() {
      if (!liveGameId) {
        throw new Error("No active game");
      }
      onDrawStatus("Offering...");
      try {
        await lichessApi.offerDraw(requireToken(), liveGameId, "yes");
        onDrawStatus("Draw offered");
      } catch (error) {
        console.warn(error);
        onDrawStatus("Draw failed");
      }
    },
    async declineDrawCurrentGame() {
      if (!liveGameId) {
        throw new Error("No active game");
      }
      onDrawStatus("Declining...");
      try {
        await lichessApi.offerDraw(requireToken(), liveGameId, "no");
        onDrawStatus("");
      } catch (error) {
        console.warn(error);
        onDrawStatus("Decline failed");
      }
    },
    async sendChatMessage(text, room = "player") {
      if (!liveGameId) {
        throw new Error("No active game");
      }
      await lichessApi.sendChatMessage(requireToken(), liveGameId, { room, text });
    },
    confirmPromotion(piece) {
      if (!pendingPromotion) {
        return false;
      }
      const { from, to, options } = pendingPromotion;
      pendingPromotion = null;
      const choice = options.includes(piece) ? piece : options[0];
      return executeMove(from, to, choice);
    },
    cancelPromotion() {
      if (!pendingPromotion) {
        return false;
      }
      pendingPromotion = null;
      onPromotionRequest(null);
      return true;
    }
  };
}
