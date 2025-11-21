import { BOARD_SIZE } from "../constants.js";
import { BASE_PIECES } from "../pieces.js";
import { isValidPlacement } from "./boardRules.js";

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {}
  }
}

/* =========================== HELPERS =========================== */
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

  /* per-turn placement tracking */
  piecePlacedThisTurn: false,

  /* turn flow */
  turnOrder: ["blue", "yellow", "red", "green"],
  currentTurnIndex: 0,
  get currentPlayer() {
    return this.turnOrder[this.currentTurnIndex];
  },

  /* =========================== PLAYER MODES =========================== */
  localPlayers: ["blue"],

  isLocal(color) {
    return this.localPlayers.includes(color);
  },
  isAI(color) {
    return !this.localPlayers.includes(color);
  },
  togglePlayerMode(color) {
    if (this.isLocal(color)) {
      this.localPlayers = this.localPlayers.filter((c) => c !== color);
    } else {
      this.localPlayers.push(color);
    }
    emit();
  },

  /* start points */
  startPoint: {
    red: { x: 0, y: 0 },
    yellow: { x: BOARD_SIZE - 1, y: 0 },
    green: { x: 0, y: BOARD_SIZE - 1 },
    blue: { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
  },

  /* =========================== PLACEMENT =========================== */
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

    /* prevents multiple piece placement, but allows repositioning of piece on board */
    if (
      this.isLocal(color) &&
      this.piecePlacedThisTurn &&
      !this.draggingPiece?.fromReposition
    ) {
      console.log(`${color} already finalized a piece this turn.`);
      return false;
    }

    const origin = { x, y };
    if (!this.canPlace(shape, origin, color)) return false;

    const usedImage =
      imageObj || this.draggingPiece?.imageObj || this.textures[color];

    /* allow repositioning and remove previous unfinalized piece */
    if (this.isLocal(color) && this.piecePlacedThisTurn) {
      const lastIndex = this.placedPieces.findIndex(
        (p) => p.color === color && !p.finalized
      );
      if (lastIndex !== -1) this.placedPieces.splice(lastIndex, 1);
    }

    this.placedPieces.push({
      shape: cloneShape(shape),
      origin,
      color,
      imageObj: usedImage,
      rotation: this.draggingPiece?.rotation || 0,
      flippedH: this.draggingPiece?.flippedH || false,
      flippedV: this.draggingPiece?.flippedV || false,
      finalized: false,
    });

    this.markPieceUsed(color, shape);
    this.resetDragTransform(this.draggingPiece);

    if (this.isLocal(color)) {
      this.piecePlacedThisTurn = true;
    }

    emit();
    return true;
  },

  markPieceUsed(color, shape) {
    const idx = this.availablePieces[color].findIndex(
      (p) => JSON.stringify(p) === JSON.stringify(shape)
    );
    if (idx !== -1) this.availablePieces[color].splice(idx, 1);
  },

  /* =========================== PICKUP =========================== */
  pickUpAt(gx, gy) {
    for (let i = this.placedPieces.length - 1; i >= 0; i--) {
      const p = this.placedPieces[i];

      /* check if grid position overlaps any tile in this piece */
      for (const [dx, dy] of p.shape) {
        if (p.origin.x + dx === gx && p.origin.y + dy === gy) {
          /* only allow pickup by the player whose turn it is */
          if (p.color !== this.currentPlayer) return null;

          /* don't allow pickup after finalized move */
          if (p.finalized) return null;

          /* remove it from board to allow repositioning */
          this.placedPieces.splice(i, 1);
          this.piecePlacedThisTurn = false; // allow dropping again this turn
          this.emit();

          /* return a draggable version of the same piece */
return { ...p, shape: normalize(p.shape), source: "board", fromReposition: true };
        }
      }
    }
    return null;
  },

  /* =========================== TURN FLOW =========================== */
  endTurn() {
    /* lock any unfinalized pieces for this player */
    const color = this.currentPlayer;
    for (const p of this.placedPieces) {
      if (p.color === color) p.finalized = true;
    }

    this.piecePlacedThisTurn = false;
    this.currentTurnIndex =
      (this.currentTurnIndex + 1) % this.turnOrder.length;
    emit();
  },

  /* =========================== RESET =========================== */
  reset() {
    const copy = (arr) => JSON.parse(JSON.stringify(arr));
    this.availablePieces = {
      yellow: copy(BASE_PIECES).map(normalize),
      red: copy(BASE_PIECES).map(normalize),
      blue: copy(BASE_PIECES).map(normalize),
      green: copy(BASE_PIECES).map(normalize),
    };
    Object.keys(this.availablePieces).forEach((c) =>
      this.availablePieces[c].sort(() => Math.random() - 0.5)
    );
    this.placedPieces = [];
    this.currentTurnIndex = 0;
    this.localPlayers = ["blue"];
    this.piecePlacedThisTurn = false;
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
