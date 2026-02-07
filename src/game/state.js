import { Chess } from "chess.js";

export class GameState {
  constructor() {
    this.chess = new Chess();
    this.listeners = new Set();
  }

  getBoard() {
    return this.chess.board();
  }

  getTurn() {
    return this.chess.turn();
  }

  getPiece(square) {
    return this.chess.get(square);
  }

  getMoves(square) {
    return this.chess.moves({ square, verbose: true });
  }

  getHistory() {
    try {
      return this.chess.history({ verbose: true });
    } catch (error) {
      return this.chess.history();
    }
  }

  getFen() {
    return this.chess.fen();
  }

  getPgnMoves() {
    const pgn = this.chess.pgn();
    if (!pgn) {
      return [];
    }
    const movesOnly = pgn
      .split("\n")
      .filter((line) => !line.trim().startsWith("["))
      .join(" ");
    const tokens = movesOnly
      .replace(/\{[^}]*\}/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\d+\.(\.\.)?/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ");
    return tokens.filter(
      (token) =>
        token &&
        token !== "1-0" &&
        token !== "0-1" &&
        token !== "1/2-1/2" &&
        token !== "*"
    );
  }

  loadPosition(fen) {
    const ok = this.chess.load(fen);
    if (ok) {
      this.emit();
    }
    return ok;
  }

  loadFromMoves({ fen = null, moves = [] } = {}) {
    this.chess.reset();
    if (fen) {
      const loaded = this.chess.load(fen);
      if (!loaded) {
        return false;
      }
    }
    for (const uci of moves) {
      if (!uci || uci.length < 4) {
        return false;
      }
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      try {
        const move = this.chess.move({ from, to, promotion });
        if (!move) {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    this.emit();
    return true;
  }

  loadPgnToPly(pgn, ply) {
    const loaded = this.chess.loadPgn(pgn);
    if (loaded) {
      while (this.chess.history().length > ply) {
        this.chess.undo();
      }
      if (this.chess.history().length !== ply) {
        return false;
      }
      this.emit();
      return true;
    }

    this.chess.reset();
    const tokens = pgn
      .replace(/\{[^}]*\}/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\d+\.(\.\.)?/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ");

    const moves = tokens.filter(
      (token) =>
        token &&
        token !== "1-0" &&
        token !== "0-1" &&
        token !== "1/2-1/2" &&
        token !== "*"
    );

    for (const san of moves) {
      const move = this.chess.move(san, { sloppy: true });
      if (!move) {
        return false;
      }
    }

    while (this.chess.history().length > ply) {
      this.chess.undo();
    }
    if (this.chess.history().length !== ply) {
      return false;
    }
    this.emit();
    return true;
  }

  isMoveLegalUci(uci) {
    if (!uci || uci.length < 4) {
      return false;
    }
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    try {
      const move = this.chess.move({ from, to, promotion });
      if (!move) {
        return false;
      }
      this.chess.undo();
      return true;
    } catch (error) {
      return false;
    }
  }

  makeMove(move) {
    const result = this.chess.move(move);
    if (result) {
      this.emit();
    }
    return result;
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }
}
