// src/state/boardState.js
import { BOARD_SIZE } from "../constants.js";
import { BASE_PIECES } from "../pieces.js";

/* ---------------- subscription bus ---------------- */
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(); } catch {} } }

/* ---------------- geometry helpers ---------------- */
const rot90  = ([x,y]) => [ y, -x];
const rot180 = ([x,y]) => [-x, -y];
const rot270 = ([x,y]) => [-y,  x];
const flipH  = ([x,y]) => [-x,  y];

function translateToOrigin(shape) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([,y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return shape.map(([x,y]) => [x - minX, y - minY]);
}
function sortCells(shape) {
  return shape.slice().sort((a,b) => (a[0]-b[0]) || (a[1]-b[1]));
}
function transformNormalize(shape, fn) {
  return sortCells(translateToOrigin(shape.map(fn)));
}
function all8Orientations(shape) {
  const s0 = shape.map(([x,y]) => [x,y]);
  const s1 = s0.map(rot90);
  const s2 = s0.map(rot180);
  const s3 = s0.map(rot270);
  const f0 = s0.map(flipH);
  const f1 = s1.map(flipH);
  const f2 = s2.map(flipH);
  const f3 = s3.map(flipH);
  return [s0,s1,s2,s3,f0,f1,f2,f3];
}

/* -------- orientation-invariant canonicalization -------- */
function canon8(shape) {
  let best = null, bestKey = null;
  for (const o of all8Orientations(shape)) {
    const c = sortCells(translateToOrigin(o));
    const k = JSON.stringify(c);
    if (bestKey == null || k < bestKey) { best = c; bestKey = k; }
  }
  return best;
}
function hash8(shape) { return JSON.stringify(canon8(shape)); }
function uniqueCanon8(shapes) {
  const seen = new Set(), out = [];
  for (const s of shapes) {
    const k = hash8(s);
    if (!seen.has(k)) { seen.add(k); out.push(canon8(s)); }
  }
  return out;
}
function uniqueOrientations(shape) {
  const seen = new Set(), out = [];
  for (const o of all8Orientations(shape)) {
    const n = sortCells(translateToOrigin(o));
    const k = JSON.stringify(n);
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  }
  return out;
}
function hashPlacement(color, shape, origin) {
  const cells = shape.map(([dx,dy]) => [origin.x + dx, origin.y + dy])
                     .sort((a,b) => (a[0]-b[0]) || (a[1]-b[1]));
  return `${color}:${JSON.stringify(cells)}`;
}

/* =========================== STATE =========================== */
export const boardState = {
  /* sizing */
  cellSize: 24,
  pieceSize: 14,
  setCellSizes(cell, piece) { this.cellSize = cell; this.pieceSize = piece; emit(); },

  /* inventory */
  availablePieces: {
    yellow: uniqueCanon8(BASE_PIECES),
    red:    uniqueCanon8(BASE_PIECES),
    blue:   uniqueCanon8(BASE_PIECES),
    green:  uniqueCanon8(BASE_PIECES),
  },

  /* placed on board */
  placedPieces: [],
  _placedKeys: new Set(),

  /* drag state */
  draggingPiece: null,
  dragPos: { x: 0, y: 0 },
  mouseOffset: { x: 0, y: 0 },
  previewOrigin: null,
  previewValid: false,

  /* turn state */
  turnOrder: ["blue", "yellow", "red", "green"],
  currentTurnIndex: 0,
  get currentPlayer() { return this.turnOrder[this.currentTurnIndex]; },

  /* per-turn rules */
  placedThisTurn: false,
  turnLocked: false, // 🔒 prevents more than one piece per turn

  /* progression */
  firstPlaced: { blue: false, yellow: false, red: false, green: false },
  forfeited:   { blue: false, yellow: false, red: false, green: false },

  /* start corners */
  startPoint: {
    red:    { x: 0, y: 0 },
    yellow: { x: BOARD_SIZE - 1, y: 0 },
    green:  { x: 0, y: BOARD_SIZE - 1 },
    blue:   { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
  },

  _allForfeited() { return this.turnOrder.every(c => this.forfeited[c]); },
  _allFirstPlaced() { return this.turnOrder.every(c => this.firstPlaced[c]); },
  get inFirstRound() { return !this._allFirstPlaced(); },

  _advanceToNextPlayer() {
    let next = this.currentTurnIndex;
    for (let i = 0; i < this.turnOrder.length; i++) {
      next = (next + 1) % this.turnOrder.length;
      const color = this.turnOrder[next];
      if (!this.forfeited[color]) {
        this.currentTurnIndex = next;
        this.placedThisTurn = false;
        this.turnLocked = false; // 🔓 unlock for next player
        emit();
        return true;
      }
    }
    return false;
  },

  endTurn() {
    if (this.draggingPiece) return;
    const cur = this.currentPlayer;
    if (!this.placedThisTurn) return;
    if (!this.firstPlaced[cur]) return;
    if (!this._advanceToNextPlayer()) this.reset();
  },

forfeitCurrentPlayer() {
  if (this.draggingPiece) return;
  const cur = this.currentPlayer;
  if (!this.firstPlaced[cur]) return;
  if (!this._allFirstPlaced()) return;
  if (this.forfeited[cur]) return;

  this.cancelDrag?.();
  this.forfeited[cur] = true;

  // ❌ Remove auto-reset. Let gameOverModal handle end of game.
  // if (this._allForfeited()) { this.reset(); return; }

  // advance to next player only if game not over
  if (!this._allForfeited()) {
    if (!this._advanceToNextPlayer()) this.reset();
  }

  emit();
},


  startDrag: () => {},
  cancelDrag: () => {},

  /* allow Delete/Backspace to return dragging piece to panel */
  returnDraggingToPanel() {
    this.cancelDrag?.();
    const dp = this.draggingPiece;
    if (!dp) return;
    if (dp.source === "board") {
      this.markPieceUnused(dp.color, dp.shape);
      if (dp.originalPlacement) {
        const { shape: s, origin: o, color } = dp.originalPlacement;
        const key = hashPlacement(color, s, o);
        this._placedKeys.delete(key);
      }
    }
    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;

    const cur = this.currentPlayer;
    const stillHasPiece = this.placedPieces.some(p => p.color === cur);
    if (!stillHasPiece) {
      this.placedThisTurn = false;
      this.turnLocked = false;
    }

    emit();
  },

  removeAt(gridX, gridY) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY)
    );
    if (idx === -1) return false;
    const piece = this.placedPieces[idx];
    if (piece.color !== this.currentPlayer) return false;

    const key = hashPlacement(piece.color, piece.shape, piece.origin);
    this._placedKeys.delete(key);
    this.placedPieces.splice(idx, 1);
    this.markPieceUnused(piece.color, piece.shape);

    this.placedThisTurn = false;
    this.turnLocked = false;
    emit();
    return true;
  },

  markPieceUsed(color, shape) {
    const key = hash8(shape);
    const arr = this.availablePieces[color];
    const idx = arr.findIndex(s => hash8(s) === key);
    if (idx !== -1) arr.splice(idx, 1);
  },
  markPieceUnused(color, shape) {
    const arr = this.availablePieces[color];
    const k = hash8(shape);
    if (!arr.some(s => hash8(s) === k)) arr.push(canon8(shape));
  },

  /* ---------------- placement rules ---------------- */
    /* ---------------- placement rules ---------------- */
  canPlace(shape, origin) {
    if (!shape || !origin) return false;

    // ---- 1. Bounds check ----
    for (const [dx, dy] of shape) {
      const x = origin.x + dx, y = origin.y + dy;
      if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return false;
    }

    // ---- 2. Overlap and same-color edge contact ----
    for (const placed of this.placedPieces) {
      for (const [dx, dy] of shape) {
        const x = origin.x + dx, y = origin.y + dy;

        // direct overlap
        if (
          placed.shape.some(
            ([px, py]) =>
              placed.origin.x + px === x && placed.origin.y + py === y
          )
        ) {
          return false;
        }

        // no edge contact with same color
        const dragColor = this.draggingPiece?.color;
        if (placed.color === dragColor) {
          if (
            placed.shape.some(
              ([px, py]) =>
                Math.abs(placed.origin.x + px - x) +
                  Math.abs(placed.origin.y + py - y) ===
                1
            )
          ) {
            return false;
          }
        }
      }
    }

    // ---- 3. Corner rule enforcement ----
    const color = this.draggingPiece?.color;
    const hasSameColor = this.placedPieces.some((p) => p.color === color);

    // 🧩 FIRST MOVE RULE: must cover your starting corner
    if (color && !this.firstPlaced[color]) {
      const sp = this.startPoint[color];
      // snap any floating drag origins to integer cells before comparing
      const ox = Math.round(origin.x);
      const oy = Math.round(origin.y);

      const coversCorner = shape.some(([dx, dy]) => {
        const gx = ox + dx;
        const gy = oy + dy;
        return gx === sp.x && gy === sp.y;
      });

      // ensure placement fully inside board (in case rounding shifted)
      if (ox < 0 || oy < 0 || ox >= BOARD_SIZE || oy >= BOARD_SIZE) return false;
      if (!coversCorner) return false; // reject if not covering the corner
    }

    // ---- 4. Later moves must corner-touch own color ----
    if (color && hasSameColor) {
      let cornerTouch = false;
      for (const placed of this.placedPieces) {
        if (placed.color !== color) continue;
        for (const [dx, dy] of shape) {
          const x = origin.x + dx;
          const y = origin.y + dy;
          if (
            placed.shape.some(
              ([px, py]) =>
                Math.abs(placed.origin.x + px - x) === 1 &&
                Math.abs(placed.origin.y + py - y) === 1
            )
          ) {
            cornerTouch = true;
            break;
          }
        }
        if (cornerTouch) break;
      }
      if (!cornerTouch) return false;
    }

    return true;
  },

  canPickUpAt(gridX, gridY) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY)
    );
    if (idx === -1) return false;
    return !this.draggingPiece && this.placedPieces[idx].color === this.currentPlayer;
  },

  pickUpAt(gridX, gridY) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY)
    );
    if (idx === -1) return null;
    const piece = this.placedPieces[idx];
    if (piece.color !== this.currentPlayer) return null;

    this._placedKeys.delete(hashPlacement(piece.color, piece.shape, piece.origin));
    this.placedPieces.splice(idx, 1);

    this.draggingPiece = {
      shape: piece.shape.map(([x,y]) => [x,y]),
      imageObj: piece.imageObj,
      color: piece.color,
      currentRotation: 0,
      source: "board",
      originalPlacement: {
        shape: piece.shape.map(([x,y]) => [x,y]),
        origin: { ...piece.origin },
        imageObj: piece.imageObj,
        color: piece.color,
      },
    };

    this.placedThisTurn = false;
    this.turnLocked = false;
    emit();
    return this.draggingPiece;
  },

  dropAt(gridX, gridY, shape) {
    const origin = { x: gridX, y: gridY };
    const valid = this.canPlace(shape, origin);

    if (valid && this.draggingPiece) {
      const color = this.draggingPiece.color;
      const placeKey = hashPlacement(color, shape, origin);
      if (this._placedKeys.has(placeKey)) {
        this.draggingPiece = null; this.previewOrigin = null; this.previewValid = false; emit(); return true;
      }
      this._placedKeys.add(placeKey);

      this.placedPieces.push({
        shape: shape.map(([x,y]) => [x,y]),
        origin,
        imageObj: this.draggingPiece.imageObj,
        color,
      });

      if (this.draggingPiece.source === "panel") {
        this.markPieceUsed(color, this.draggingPiece.shape);
      }

      if (!this.firstPlaced[color]) this.firstPlaced[color] = true;
      this.placedThisTurn = true;
      this.turnLocked = true;

      this.draggingPiece = null;
      this.previewOrigin = null;
      this.previewValid = false;
      emit();
      return true;
    }

    if (!valid && this.draggingPiece?.source === "board" && this.draggingPiece.originalPlacement) {
      const { shape: s, origin: o, imageObj, color } = this.draggingPiece.originalPlacement;
      const key = hashPlacement(color, s, o);
      if (!this._placedKeys.has(key)) this._placedKeys.add(key);
      this.placedPieces.push({ shape: s.map(([x,y]) => [x,y]), origin: { ...o }, imageObj, color });
      this.draggingPiece = null; this.previewOrigin = null; this.previewValid = false; emit();
      return false;
    }

    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
    return false;
  },

  rotateDragging() {
    if (!this.draggingPiece) return;
    this.draggingPiece.shape = transformNormalize(this.draggingPiece.shape, rot90);
    this.previewValid = false;
    emit();
  },
  flipDraggingH() {
    if (!this.draggingPiece) return;
    this.draggingPiece.shape = transformNormalize(this.draggingPiece.shape, flipH);
    this.previewValid = false;
    emit();
  },
  flipDraggingV() {
    if (!this.draggingPiece) return;
    this.draggingPiece.shape = transformNormalize(this.draggingPiece.shape, ([x,y]) => [x, -y]);
    this.previewValid = false;
    emit();
  },

  countPiecesLeft(color) { return this.availablePieces[color]?.length ?? 0; },

  hasAnyMove(color) {
    const avail = this.availablePieces[color] || [];
    if (avail.length === 0) return false;
    const prev = this.draggingPiece;
    try {
      for (const base of avail) {
        for (const orient of uniqueOrientations(base)) {
          this.draggingPiece = { color, shape: orient };
          const maxDx = Math.max(...orient.map(([x]) => x));
          const maxDy = Math.max(...orient.map(([,y]) => y));
          for (let y = 0; y <= BOARD_SIZE - 1 - maxDy; y++) {
            for (let x = 0; x <= BOARD_SIZE - 1 - maxDx; x++) {
              if (this.canPlace(orient, { x, y })) return true;
            }
          }
        }
      }
      return false;
    } finally {
      this.draggingPiece = prev;
    }
  },

  reset() {
    this.currentTurnIndex = 0;
    this.placedThisTurn = false;
    this.turnLocked = false;
    this.firstPlaced = { blue: false, yellow: false, red: false, green: false };
    this.forfeited   = { blue: false, yellow: false, red: false, green: false };
    this.placedPieces = [];
    this._placedKeys.clear();

    this.availablePieces = {
      yellow: uniqueCanon8(BASE_PIECES),
      red:    uniqueCanon8(BASE_PIECES),
      blue:   uniqueCanon8(BASE_PIECES),
      green:  uniqueCanon8(BASE_PIECES),
    };

    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
  },

  emit,
};
