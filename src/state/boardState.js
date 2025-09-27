import { BOARD_SIZE } from "../constants.js";
import { BASE_PIECES } from "../pieces.js";

//subscriptions                                                      

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

//shape helpers                                                      

function normalizeShape(shape) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return shape
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}
function shapeKey(shape) {
  return JSON.stringify(normalizeShape(shape));
}

// state 
export const boardState = {
  cellSize: 24,
  pieceSize: 14,
  setCellSizes(cell, piece) {
    this.cellSize = cell;
    this.pieceSize = piece;
    emit();
  },

  /* inventory drives the panels (available vs used) */
  availablePieces: {
    yellow: BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
    red:    BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
    blue:   BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
    green:  BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
  },

  /* board placements */
  placedPieces: [], 

  // drag/ghost state
  draggingPiece: null,           
  dragPos: { x: 0, y: 0 },
  mouseOffset: { x: 0, y: 0 },
  previewOrigin: null,         
  previewValid: false,


  startDrag: () => {},
  cancelDrag: () => {},

  // availability helpers 
  markPieceUsed(color, shape) {
    const key = shapeKey(shape);
    this.availablePieces[color] =
      (this.availablePieces[color] || []).filter(s => shapeKey(s) !== key);
    emit();
  },
  markPieceReturned(color, shape) {
    const key = shapeKey(shape);
    const list = this.availablePieces[color] || (this.availablePieces[color] = []);
    if (!list.some(s => shapeKey(s) === key)) {
      list.push(shape.map(([x, y]) => [x, y]));
      emit();
    }
  },

  //placement rules
  canPlace(shape, origin) {
    for (const [dx, dy] of shape) {
      const x = origin.x + dx, y = origin.y + dy;
      if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return false;
    }
    const taken = new Set();
    for (const p of this.placedPieces) {
      for (const [dx, dy] of p.shape) {
        taken.add(`${p.origin.x + dx}:${p.origin.y + dy}`);
      }
    }
    for (const [dx, dy] of shape) {
      if (taken.has(`${origin.x + dx}:${origin.y + dy}`)) return false;
    }
    return true;
  },

  //pick up / drop 

  pickUpAt(gridX, gridY) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY)
    );
    if (idx === -1) return null;

    const piece = this.placedPieces[idx];
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
        color: piece.color,
        imageObj: piece.imageObj,
      },
    };
    this.previewOrigin = null;
    this.previewValid = false;

    emit();
    return this.draggingPiece;
  },

  dropAt(gridX, gridY, shape) {
    const origin = { x: gridX, y: gridY };
    const valid = this.canPlace(shape, origin);

    if (valid && this.draggingPiece) {
      this.placedPieces.push({
        shape: shape.map(([x, y]) => [x, y]),
        origin,
        imageObj: this.draggingPiece.imageObj,
        color: this.draggingPiece.color,
      });

      // Hide from panels only when the drag came from a panel
      if (this.draggingPiece.source === "panel") {
        this.markPieceUsed(this.draggingPiece.color, shape);
      }
    } else if (this.draggingPiece?.source === "board" && this.draggingPiece.originalPlacement) {
      // Invalid drop from board, return
      const op = this.draggingPiece.originalPlacement;
      this.placedPieces.push({
        shape: op.shape.map(([x, y]) => [x, y]),
        origin: { ...op.origin },
        imageObj: op.imageObj,
        color: op.color,
      });
    }
    // If source=panel and invalid, do nothing 

    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
  },

  //spacebar function
  returnAt(x, y) {
    const idx = this.placedPieces.findIndex(p =>
      p.shape.some(([dx, dy]) => p.origin.x + dx === x && p.origin.y + dy === y)
    );
    if (idx === -1) return false;
    const piece = this.placedPieces[idx];
    this.placedPieces.splice(idx, 1);
    this.markPieceReturned(piece.color, piece.shape);
    this.previewOrigin = null;
    this.previewValid = false;
    this.draggingPiece = null;
    emit();
    return true;
  },
  returnLast() {
    if (!this.placedPieces.length) return false;
    const piece = this.placedPieces.pop();
    this.markPieceReturned(piece.color, piece.shape);
    this.previewOrigin = null;
    this.previewValid = false;
    this.draggingPiece = null;
    emit();
    return true;
  },
  returnDragging() {
    if (!this.draggingPiece) return false;
    const dp = this.draggingPiece;
    this.markPieceReturned(dp.color, dp.shape);
    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
    return true;
  },

  //rotation / flip while dragging 
  _transform(fn) {
    if (!this.draggingPiece) return;
    // transform
    const shape = this.draggingPiece.shape.map(([x, y]) => fn(x, y));
    const xs = shape.map(([x]) => x);
    const ys = shape.map(([, y]) => y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    this.draggingPiece.shape = shape
      .map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    emit();
  },
  rotateDraggingCW()  { this._transform((x, y) => [ y, -x]); },
  rotateDraggingCCW() { this._transform((x, y) => [-y,  x]); },
  flipDraggingH()     { this._transform((x, y) => [-x,  y]); },
  flipDraggingV()     { this._transform((x, y) => [ x, -y]); },

  //lifecycle
  reset() {
    this.placedPieces = [];
    this.availablePieces = {
      yellow: BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
      red:    BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
      blue:   BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
      green:  BASE_PIECES.map(s => s.map(([x, y]) => [x, y])),
    };
    this.draggingPiece = null;
    this.previewOrigin = null;
    this.previewValid = false;
    emit();
  },

  emit, 
};
