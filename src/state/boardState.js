
import { BOARD_SIZE } from "../constants.js";

const listeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());

// Board & drag state 
export const boardState = {
  placedPieces: [],
  draggingPiece: null,
  selectedPiece: null,
  dragPos: { x: 0, y: 0 },
  mouseOffset: { x: 0, y: 0 },
  draggingWrapper: null,
  highlightedIndex: null,
  cellSize: 24,
  pieceSize: 18,

  // Sizing 
  setCellSizes(cell, piece) {
    this.cellSize = cell;
    this.pieceSize = piece;
    emit();
  },

  // Drag lifecycle
  startDrag(piece, x, y, offx, offy, wrapper) {
    this.draggingPiece = { ...piece, currentRotation: 0 };
    this.selectedPiece = this.draggingPiece;
    this.dragPos.x = x;
    this.dragPos.y = y;
    this.mouseOffset.x = offx;
    this.mouseOffset.y = offy;
    this.draggingWrapper = wrapper || null;

    if (wrapper) wrapper.style.visibility = "hidden";
    emit();
  },

  updateDrag(x, y) {
    if (!this.draggingPiece) return;
    this.dragPos.x = x;
    this.dragPos.y = y;
    emit();
  },

  cancelDrag() {
    if (this.draggingWrapper) this.draggingWrapper.style.visibility = "visible";
    this.draggingPiece = null;
    this.draggingWrapper = null;
    this.selectedPiece = null;
    emit();
  },

  // Drop / placement
  dropAt(gridX, gridY, shape) {
    let valid = true;

    for (const [dx, dy] of shape) {
      const x = gridX + dx;
      const y = gridY + dy;
      if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
        valid = false;
        break;
      }
    }

    if (valid) {
      this.placedPieces.push({
        shape,
        origin: { x: gridX, y: gridY },
        imageObj: this.draggingPiece.imageObj,
        color: this.draggingPiece.color
      });
    } else if (this.draggingWrapper) {
      this.draggingWrapper.style.visibility = "visible";
    }

    this.draggingPiece = null;
    this.draggingWrapper = null;
    this.selectedPiece = null;
    emit();
  },

  // Pick up a placed piece
  pickUpAt(gridX, gridY) {
    for (let i = this.placedPieces.length - 1; i >= 0; i--) {
      const p = this.placedPieces[i];
      const coversCell = p.shape.some(
        ([dx, dy]) => p.origin.x + dx === gridX && p.origin.y + dy === gridY
      );
      if (coversCell) {
        this.placedPieces.splice(i, 1);
        const picked = {
          shape: p.shape.map(([x, y]) => [x, y]),
          imageObj: p.imageObj,
          color: p.color,
          currentRotation: 0
        };
        this.draggingPiece = picked;
        this.selectedPiece = picked;
        this.mouseOffset.x = this.cellSize / 2;
        this.mouseOffset.y = this.cellSize / 2;
        emit();
        return true;
      }
    }
    return false;
  },

  returnPieceToPile(piece) {
    if (!piece) return;
    this.draggingPiece = null;
    this.selectedPiece = null;
    this.draggingWrapper = null;
    emit();
  },

  reset() {
    this.placedPieces = [];
    this.draggingPiece = null;
    this.selectedPiece = null;
    this.highlightedIndex = null;
    emit();
  }
};