import { BOARD_SIZE } from "../constants.js";
import { BASE_PIECES } from "../pieces.js";

// subscriptions
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

/* ---------------- Canonicalization & Hashing ----------------
   We must compare panel inventory pieces with the shape we drag.
   Drag shapes are normalized in dragDrop.js, so do the same for:
   - inventory initialization,
   - comparisons (markPieceUsed),
   - re-adding (markPieceUnused).
---------------------------------------------------------------- */
function canonShape(shape) {
  // translate so minX/minY = 0, then sort
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return shape
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}
function hashCanon(shape) {
  return JSON.stringify(canonShape(shape));
}
function hashPlacement(color, shape, origin) {
  // absolute occupied cells for this placement
  const cells = shape
    .map(([dx, dy]) => [origin.x + dx, origin.y + dy])
    .sort((a, b) => (a[0]-b[0]) || (a[1]-b[1]));
  return `${color}:${JSON.stringify(cells)}`;
}

export const boardState = {
  cellSize: 24,
  pieceSize: 14,
  setCellSizes(cell, piece) {
    this.cellSize = cell;
    this.pieceSize = piece;
    emit();
  },

  // inventory (panel) — store as CANONICAL from the start
  availablePieces: {
    yellow: BASE_PIECES.map(s => canonShape(s)),
    red:    BASE_PIECES.map(s => canonShape(s)),
    blue:   BASE_PIECES.map(s => canonShape(s)),
    green:  BASE_PIECES.map(s => canonShape(s)),
  },

  // board placements
  placedPieces: [],
  _placedKeys: new Set(), // de-dupe of placements (e.g., fast double click)

  // drag/ghost state
  draggingPiece: null,
  dragPos: { x: 0, y: 0 },
  mouseOffset: { x: 0, y: 0 },
  previewOrigin: null,
  previewValid: false,

  // --- turn state ---
  turnOrder: ["blue", "yellow", "red", "green"],
  currentTurnIndex: 0,
  get currentPlayer() {
    return this.turnOrder[this.currentTurnIndex];
  },

  // --- per-player progression ---
  firstPlaced: { blue: false, yellow: false, red: false, green: false },
  forfeited:   { blue: false, yellow: false, red: false, green: false },

  // start points (grid coords)
  startPoint: {
    red:    { x: 0, y: 0 },
    yellow: { x: BOARD_SIZE - 1, y: 0 },
    green:  { x: 0, y: BOARD_SIZE - 1 },
    blue:   { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
  },

  _allForfeited() {
    return this.turnOrder.every(c => this.forfeited[c]);
  },
  _allFirstPlaced() {
    return this.turnOrder.every(c => this.firstPlaced[c]);
  },
  get inFirstRound() {
    return !this._allFirstPlaced();
  },

  endTurn() {
    const cur = this.currentPlayer;
    if (!this.firstPlaced[cur]) return; // must place first piece (on start)
    // advance to next non-forfeited player
    let next = this.currentTurnIndex;
    for (let i = 0; i < this.turnOrder.length; i++) {
      next = (next + 1) % this.turnOrder.length;
      const color = this.turnOrder[next];
      if (!this.forfeited[color]) {
        this.currentTurnIndex = next;
        emit();
        return;
      }
    }
    this.reset();
  },

  // Forfeit allowed only after round 1 is complete for all
  forfeitCurrentPlayer() {
    const cur = this.currentPlayer;
    if (!this.firstPlaced[cur]) return;
    if (!this._allFirstPlaced()) return;
    if (this.forfeited[cur]) return;

    this.cancelDrag?.();
    this.forfeited[cur] = true;

    if (this._allForfeited()) {
      this.reset();
      return;
    }

    // advance to next non-forfeited player
    let next = this.currentTurnIndex;
    for (let i = 0; i < this.turnOrder.length; i++) {
      next = (next + 1) % this.turnOrder.length;
      const color = this.turnOrder[next];
      if (!this.forfeited[color]) {
        this.currentTurnIndex = next;
        emit();
        return;
      }
    }
    emit();
  },

  startDrag: () => {},
  cancelDrag: () => {},

  // -------- inventory helpers (always compare/push canonical) ----------
  markPieceUsed(color, shape) {
    const key = hashCanon(shape);                 // shape from drag (already canon), hashed
    const arr = this.availablePieces[color];
    const idx = arr.findIndex(s => hashCanon(s) === key);
    if (idx !== -1) arr.splice(idx, 1);           // remove exactly once
  },
  markPieceUnused(color, shape) {
    this.availablePieces[color].push(canonShape(shape));
  },

  // ------------------------- rules / geometry --------------------------
  canPlace(shape, origin) {
    if (!shape || !origin) return false;

    // bounds
    for (const [dx, dy] of shape) {
      const x = origin.x + dx, y = origin.y + dy;
      if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return false;
    }

    // overlap + edge-adjacency (same color)
    for (const placed of this.placedPieces) {
      for (const [dx, dy] of shape) {
        const x = origin.x + dx, y = origin.y + dy;
        // direct overlap
        if (placed.shape.some(([px, py]) => placed.origin.x + px === x && placed.origin.y + py === y)) {
          return false;
        }
        // no edge contact with same color
        const draggingColor = this.draggingPiece?.color;
        if (placed.color === draggingColor) {
          if (placed.shape.some(([px, py]) =>
            (Math.abs((placed.origin.x + px) - x) + Math.abs((placed.origin.y + py) - y)) === 1
          )) return false;
        }
      }
    }

    // first piece must cover the start corner
    const color = this.draggingPiece?.color;
    const hasSameColor = this.placedPieces.some(p => p.color === color);

    if (color && !this.firstPlaced[color] && !hasSameColor) {
      const sp = this.startPoint[color];
      const coversStart = shape.some(([dx, dy]) => origin.x + dx === sp.x && origin.y + dy === sp.y);
      if (!coversStart) return false;
      return true; // corner rule does not apply to first piece
    }

    // later pieces must corner-touch own color (no edge touch)
    if (color && hasSameColor) {
      let cornerTouch = false;
      for (const placed of this.placedPieces) {
        if (placed.color !== color) continue;
        for (const [dx, dy] of shape) {
          const x = origin.x + dx, y = origin.y + dy;
          if (placed.shape.some(([px, py]) =>
            Math.abs((placed.origin.x + px) - x) === 1 &&
            Math.abs((placed.origin.y + py) - y) === 1
          )) { cornerTouch = true; break; }
        }
        if (cornerTouch) break;
      }
      if (!cornerTouch) return false;
    }

    return true;
  },

  // hover check
  canPickUpAt(gridX, gridY) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY)
    );
    if (idx === -1) return false;
    return this.placedPieces[idx].color === this.currentPlayer;
  },

  // board pickup
  pickUpAt(gridX, gridY) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY)
    );
    if (idx === -1) return null;
    if (this.placedPieces[idx].color !== this.currentPlayer) return null;

    const piece = this.placedPieces[idx];

    // clear de-dupe key for this placement so it can be placed again later
    const key = hashPlacement(piece.color, piece.shape, piece.origin);
    this._placedKeys.delete(key);

    this.placedPieces.splice(idx, 1);

    this.draggingPiece = {
      shape: piece.shape.map(([x, y]) => [x, y]),
      imageObj: piece.imageObj,
      color: piece.color,
      currentRotation: 0,
      source: "board",
      originalPlacement: {
        shape: piece.shape.map(([x, y]) => [x, y]),
        origin: { ...piece.origin },
        imageObj: piece.imageObj,
        color: piece.color,
      },
    };
    emit();
    return this.draggingPiece;
  },

  // drop/place
  dropAt(gridX, gridY, shape) {
    const origin = { x: gridX, y: gridY };
    const valid = this.canPlace(shape, origin);

    if (valid && this.draggingPiece) {
      const color = this.draggingPiece.color;

      // de-dupe: prevent identical placement twice (e.g., fast double click)
      const placeKey = hashPlacement(color, shape, origin);
      if (this._placedKeys.has(placeKey)) {
        this.draggingPiece = null;
        this.previewOrigin = null;
        this.previewValid = false;
        emit();
        return true;
      }
      this._placedKeys.add(placeKey);

      this.placedPieces.push({
        shape: shape.map(([x, y]) => [x, y]),
        origin,
        imageObj: this.draggingPiece.imageObj,
        color,
      });

      // Remove from panel only if drag started from panel
      if (this.draggingPiece.source === "panel") {
        this.markPieceUsed(color, this.draggingPiece.shape);
      }

      if (!this.firstPlaced[color]) {
        this.firstPlaced[color] = true;
      }

      this.draggingPiece = null;
      this.previewOrigin = null;
      this.previewValid = false;
      emit();
      return true;
    }

    // invalid from board -> revert to original
    if (!valid && this.draggingPiece?.source === "board" && this.draggingPiece.originalPlacement) {
      const { shape: s, origin: o, imageObj, color } = this.draggingPiece.originalPlacement;
      const key = hashPlacement(color, s, o);
      if (!this._placedKeys.has(key)) this._placedKeys.add(key);
      this.placedPieces.push({
        shape: s.map(([x, y]) => [x, y]),
        origin: { ...o },
        imageObj,
        color,
      });
      this.draggingPiece = null;
      this.previewOrigin = null;
      this.previewValid = false;
      emit();
      return false;
    }

    // invalid from panel -> cancel (returns to panel visually)
    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
    return false;
  },

  // transforms during drag
  rotateDragging() {
    if (!this.draggingPiece) return;
    this.draggingPiece.shape = this.draggingPiece.shape.map(([x, y]) => [y, -x]);
    emit();
  },
  flipDraggingH() {
    if (!this.draggingPiece) return;
    this.draggingPiece.shape = this.draggingPiece.shape.map(([x, y]) => [-x, y]);
    emit();
  },
  flipDraggingV() {
    if (!this.draggingPiece) return;
    this.draggingPiece.shape = this.draggingPiece.shape.map(([x, y]) => [x, -y]);
    emit();
  },

  reset() {
    this.currentTurnIndex = 0; // Blue starts
    this.firstPlaced = { blue: false, yellow: false, red: false, green: false };
    this.forfeited   = { blue: false, yellow: false, red: false, green: false };

    this.placedPieces = [];
    this._placedKeys.clear();

    // Rebuild inventory canonically
    this.availablePieces = {
      yellow: BASE_PIECES.map(s => canonShape(s)),
      red:    BASE_PIECES.map(s => canonShape(s)),
      blue:   BASE_PIECES.map(s => canonShape(s)),
      green:  BASE_PIECES.map(s => canonShape(s)),
    };

    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
  },

  emit,
};
