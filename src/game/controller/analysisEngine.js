import { Chess } from "chess.js";

const ENGINE_FILES = [
  "stockfish/stockfish-17.1-lite-single-03e3232.js",
  "stockfish/stockfish-17.1-asm-341ff22.js"
];
const MULTI_PV = 3;
const MAX_DEPTH = 16;
const PV_LIMIT = 8;
const INIT_TIMEOUT_MS = 7000;

function formatScore(score) {
  if (!score) {
    return "";
  }
  if (score.type === "mate") {
    const sign = score.value > 0 ? "+" : "";
    return `${sign}#${score.value}`;
  }
  if (score.type === "cp") {
    const value = (score.value / 100).toFixed(2);
    return value.startsWith("-") ? value : `+${value}`;
  }
  return "";
}

function pvToSan(fen, pvMoves) {
  if (!fen || !Array.isArray(pvMoves) || pvMoves.length === 0) {
    return "";
  }
  const chess = new Chess(fen);
  const sanMoves = [];
  for (const uci of pvMoves) {
    if (!uci || uci.length < 4) {
      break;
    }
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    let move = null;
    try {
      move = chess.move({ from, to, promotion });
    } catch (error) {
      break;
    }
    if (!move) {
      break;
    }
    sanMoves.push(move.san);
    if (sanMoves.length >= PV_LIMIT) {
      break;
    }
  }
  return sanMoves.join(" ");
}

function getEnginePath(file) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${file}`.replace(/([^:]\/)\/+/g, "$1");
}

function parseScore(parts) {
  const scoreIndex = parts.indexOf("score");
  if (scoreIndex === -1) {
    return null;
  }
  const type = parts[scoreIndex + 1];
  const value = Number(parts[scoreIndex + 2]);
  if ((type === "cp" || type === "mate") && Number.isFinite(value)) {
    return { type, value };
  }
  return null;
}

export function createAnalysisEngine({ onLines, onStatus = () => {} }) {
  let worker = null;
  let ready = false;
  let failed = false;
  let engineFileIndex = 0;
  let currentFen = null;
  let queuedFen = null;
  let linesByPv = new Map();
  let initTimer = null;

  onStatus("idle");

  const emitLines = () => {
    const lines = Array.from(linesByPv.values())
      .sort((a, b) => a.multipv - b.multipv)
      .slice(0, MULTI_PV);
    onLines(lines);
  };

  const resetLines = () => {
    linesByPv = new Map();
    onLines([]);
  };

  const teardownWorker = () => {
    if (initTimer) {
      clearTimeout(initTimer);
      initTimer = null;
    }
    if (worker) {
      try {
        worker.terminate();
      } catch (error) {}
    }
    worker = null;
    ready = false;
  };

  const tryFallbackEngine = (reason, details = null) => {
    if (engineFileIndex >= ENGINE_FILES.length - 1) {
      return false;
    }
    if (details) {
      console.warn(reason, details);
    } else {
      console.warn(reason);
    }
    engineFileIndex += 1;
    failed = false;
    teardownWorker();
    onStatus("loading");
    return true;
  };

  const failEngine = (reason, details = null) => {
    if (tryFallbackEngine(reason, details)) {
      if (queuedFen || currentFen) {
        const nextFen = queuedFen || currentFen;
        queuedFen = nextFen;
        ensureWorker();
      }
      return;
    }
    if (details) {
      console.error(reason, details);
    } else {
      console.error(reason);
    }
    failed = true;
    teardownWorker();
    onStatus("error");
  };

  const handleInfoLine = (line) => {
    const parts = line.split(" ");
    const pvIndex = parts.indexOf("pv");
    if (pvIndex === -1) {
      return;
    }
    const mpIndex = parts.indexOf("multipv");
    const multipv = mpIndex !== -1 ? Number(parts[mpIndex + 1]) : 1;
    if (!Number.isFinite(multipv)) {
      return;
    }
    const depthIndex = parts.indexOf("depth");
    const depth = depthIndex !== -1 ? Number(parts[depthIndex + 1]) : null;
    const score = parseScore(parts);
    const pvMoves = parts.slice(pvIndex + 1);
    const lineText = pvToSan(currentFen, pvMoves);
    if (!lineText) {
      return;
    }
    const existing = linesByPv.get(multipv);
    if (existing && Number.isFinite(depth) && Number.isFinite(existing.depth) && depth < existing.depth) {
      return;
    }
    linesByPv.set(multipv, {
      multipv,
      depth,
      score: formatScore(score),
      line: lineText
    });
    emitLines();
  };

  const handleBestMoveLine = (line) => {
    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      return;
    }
    const bestmove = parts[1];
    if (!bestmove || bestmove === "(none)") {
      return;
    }
    const ponderIndex = parts.indexOf("ponder");
    const ponder = ponderIndex !== -1 ? parts[ponderIndex + 1] : null;
    const pvMoves = ponder ? [bestmove, ponder] : [bestmove];
    const lineText = pvToSan(currentFen, pvMoves);
    if (!lineText) {
      return;
    }
    const existing = linesByPv.get(1);
    linesByPv.set(1, {
      multipv: 1,
      depth: existing?.depth ?? null,
      score: existing?.score ?? "",
      line: lineText
    });
    emitLines();
    onStatus("ready");
  };

  const handleWorkerLine = (line) => {
    if (!line) {
      return;
    }
    if (line === "uciok") {
      worker.postMessage(`setoption name MultiPV value ${MULTI_PV}`);
      worker.postMessage("isready");
      return;
    }
    if (line === "readyok") {
      ready = true;
      failed = false;
      if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
      }
      onStatus("ready");
      if (queuedFen) {
        const fen = queuedFen;
        queuedFen = null;
        analyze(fen);
      }
      return;
    }
    if (line.startsWith("info ")) {
      onStatus("searching");
      handleInfoLine(line);
      return;
    }
    if (line.startsWith("bestmove ")) {
      handleBestMoveLine(line);
      return;
    }
    if (line.includes("failed to load wasm") || line.includes("Aborted(")) {
      failEngine("Stockfish wasm error", {
        line,
        enginePath: getEnginePath(ENGINE_FILES[engineFileIndex]),
        engineFile: ENGINE_FILES[engineFileIndex]
      });
    }
  };

  const createWorker = () => {
    const engineFile = ENGINE_FILES[engineFileIndex];
    const enginePath = getEnginePath(engineFile);
    try {
      return new Worker(enginePath, { type: "classic" });
    } catch (classicError) {
      try {
        return new Worker(enginePath);
      } catch (defaultError) {
        failEngine("Stockfish worker init failed", {
          enginePath,
          engineFile,
          classicError,
          defaultError
        });
        return null;
      }
    }
  };

  const ensureWorker = () => {
    if (failed) {
      onStatus("error");
      return false;
    }
    if (worker) {
      return true;
    }
    onStatus("loading");
    worker = createWorker();
    if (!worker) {
      return false;
    }
    const engineFile = ENGINE_FILES[engineFileIndex];
    const enginePath = getEnginePath(engineFile);
    worker.onerror = (event) => {
      failEngine("Stockfish worker runtime error", {
        enginePath,
        engineFile,
        message: event?.message,
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
        error: event?.error
      });
    };
    worker.onmessageerror = (event) => {
      failEngine("Stockfish worker message error", { enginePath, engineFile, event });
    };
    worker.onmessage = (event) => {
      try {
        const text = String(event?.data ?? "");
        if (!text) {
          return;
        }
        const lines = text.split(/\r?\n/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }
          handleWorkerLine(line);
        }
      } catch (error) {
        console.warn("Stockfish message parse ignored", error);
      }
    };
    initTimer = setTimeout(() => {
      if (!ready) {
        failEngine("Stockfish init timeout: no readyok", { enginePath, engineFile });
      }
    }, INIT_TIMEOUT_MS);
    try {
      worker.postMessage("uci");
    } catch (error) {
      failEngine("Stockfish command send failed", { enginePath, engineFile, error });
      return false;
    }
    return true;
  };

  const analyze = (fen) => {
    if (!fen) {
      return;
    }
    if (!ensureWorker()) {
      return;
    }
    if (!ready) {
      queuedFen = fen;
      onStatus("loading");
      return;
    }
    currentFen = fen;
    resetLines();
    try {
      worker.postMessage("stop");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${MAX_DEPTH}`);
      onStatus("searching");
    } catch (error) {
      failEngine("Stockfish search command failed", { error });
    }
  };

  const stop = () => {
    teardownWorker();
    failed = false;
    engineFileIndex = 0;
    currentFen = null;
    queuedFen = null;
    onStatus("idle");
    resetLines();
  };

  return {
    analyze,
    stop
  };
}
