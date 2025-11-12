// src/state/boardState.js
import { BOARD_SIZE } from "../constants.js";
import { BASE_PIECES } from "../pieces.js";
import { isValidPlacement } from "./boardRules.js";

/* ---------------- subscription bus ---------------- */
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) {
    try { fn(); } catch {}
  }
}

/* ---------------- helpers ---------------- */
function normalize(shape) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return shape.map(([x, y]) => [x - minX, y - minY]);
}
function cloneShape(shape) {
  return shape.map(([x, y]) => [x, y]);
}
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* =========================== STATE =========================== */
export const boardState = {
  /* sizes */
  cellSize: 24,
  pieceSize: 14,
  textures: {},

  /* piece inventory */
  availablePieces: {
    yellow: BASE_PIECES.map(normalize),
    red: BASE_PIECES.map(normalize),
    blue: BASE_PIECES.map(normalize),
    green: BASE_PIECES.map(normalize),
  },

  /* placed + dragging */
  placedPieces: [],
  draggingPiece: null,
  previewOrigin: null,
  previewValid: false,

  /* turn flow */
  turnOrder: ["blue", "yellow", "red", "green"],
  currentTurnIndex: 0,
  get currentPlayer() {
    return this.turnOrder[this.currentTurnIndex];
  },

  /* PLAYER MODES ---------------------------- */
  localPlayers: ["blue"],

  /** returns true if given color is controlled locally */
  isLocal(color) {
    return this.localPlayers.includes(color);
  },

  /** returns true if given color is AI controlled */
  isAI(color) {
    return !this.localPlayers.includes(color);
  },

  /** toggle a color between local/AI manually */
  togglePlayerMode(color) {
    if (this.isLocal(color)) {
      this.localPlayers = this.localPlayers.filter((c) => c !== color);
    } else {
      this.localPlayers.push(color);
    }
    console.log(`Toggled ${color}:`, this.isLocal(color) ? "LOCAL" : "AI");
    emit();
  },

  /** ✅ set number of local players (1–4)
   * preserves order: blue → yellow → red → green */
  setLocalPlayers(count = 1) {
    const order = ["blue", "yellow", "red", "green"];
    this.localPlayers = order.slice(0, Math.min(4, Math.max(1, count)));
    console.log(
      `🎮 Local players: ${this.localPlayers.join(", ")} | AIs: ${order
        .filter((c) => !this.localPlayers.includes(c))
        .join(", ")}`
    );
    emit();
  },

  /* start points */
  startPoint: {
    red: { x: 0, y: 0 },
    yellow: { x: BOARD_SIZE - 1, y: 0 },
    green: { x: 0, y: BOARD_SIZE - 1 },
    blue: { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
  },

  /* ---------------- placement ---------------- */
  canPlace(shape, origin, colorOverride = null) {
    const color = colorOverride || this.currentPlayer;
    const tiles = shape.map(([x, y]) => ({ x, y }));
    const board = this.buildBoardMatrix();
    return isValidPlacement({ tiles }, color, board, origin.x, origin.y);
  },

  buildBoardMatrix() {
    const board = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(null)
    );
    for (const p of this.placedPieces) {
      for (const [dx, dy] of p.shape) {
        const gx = p.origin.x + dx;
        const gy = p.origin.y + dy;
        if (gx >= 0 && gy >= 0 && gx < BOARD_SIZE && gy < BOARD_SIZE) {
          board[gy][gx] = p.color;
        }
      }
    }
    return board;
  },

  dropAt(x, y, shape, imageObj) {
    const color = this.currentPlayer;
    const origin = { x, y };
    if (!this.canPlace(shape, origin, color)) return false;

    const usedImage = imageObj || this.draggingPiece?.imageObj || this.textures[color];

    this.placedPieces.push({
      shape: cloneShape(shape),
      origin,
      color,
      imageObj: usedImage,
      rotation: this.draggingPiece?.rotation || 0,
      flippedH: this.draggingPiece?.flippedH || false,
      flippedV: this.draggingPiece?.flippedV || false,
    });

    this.markPieceUsed(color, shape);
    this.resetDragTransform(this.draggingPiece);
    emit();
    return true;
  },

  markPieceUsed(color, shape) {
    const idx = this.availablePieces[color].findIndex(
      (p) => JSON.stringify(p) === JSON.stringify(shape)
    );
    if (idx !== -1) this.availablePieces[color].splice(idx, 1);
  },

  /* ---------------- pickup ---------------- */
  pickUpAt(gx, gy) {
    for (let i = this.placedPieces.length - 1; i >= 0; i--) {
      const p = this.placedPieces[i];
      for (const [dx, dy] of p.shape) {
        if (p.origin.x + dx === gx && p.origin.y + dy === gy) {
          this.placedPieces.splice(i, 1);
          emit();
          return { ...p, shape: normalize(p.shape) };
        }
      }
    }
    return null;
  },

  /* ---------------- turn flow ---------------- */
  endTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    emit();
  },

  /* ---------------- reset ---------------- */
  reset() {
    const copy = (arr) => JSON.parse(JSON.stringify(arr));
    this.availablePieces = {
      yellow: copy(BASE_PIECES).map(normalize),
      red: copy(BASE_PIECES).map(normalize),
      blue: copy(BASE_PIECES).map(normalize),
      green: copy(BASE_PIECES).map(normalize),
    };
    Object.keys(this.availablePieces).forEach((c) => shuffleArray(this.availablePieces[c]));

    this.placedPieces = [];
    this.currentTurnIndex = 0;
    // 🔹 Do NOT overwrite localPlayers (keep user selection)
    this.resetDragTransform();
    emit();
  },

  resetDragTransform(piece = null) {
    if (piece) {
      piece.rotation = 0;
      piece.flippedH = false;
      piece.flippedV = false;
      if (piece.originalShape)
        piece.shape = piece.originalShape.map(([x, y]) => [x, y]);
    }
    this.draggingPiece = null;
  },

  emit,
};
