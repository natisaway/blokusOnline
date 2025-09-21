// src/input/keyboard.js
import { rotate90, flipX, flipY } from "../utils/geometry.js";
import { boardState } from "../state/boardState.js";

export function attachKeyboard(modalEl) {
  window.addEventListener("keydown", (e) => {
    if (modalEl && modalEl.style.display === "flex") return;

    // Delete / Return to pile
    if (e.key === "Delete" || e.key === "Backspace") {
      if (boardState.draggingPiece) {
        boardState.cancelDrag();
      } else if (boardState.selectedPiece) {
        boardState.returnPieceToPile(boardState.selectedPiece);
      }
      return;
    }

    if (!boardState.draggingPiece) return;

    // Rotate
    if (e.key === "r" || e.key === "R") {
      boardState.draggingPiece.shape = rotate90(boardState.draggingPiece.shape);
      boardState.draggingPiece.currentRotation += Math.PI / 2;

    // Flip Horizontal
    } else if (e.key === "f" || e.key === "F") {
      boardState.draggingPiece.shape = flipX(boardState.draggingPiece.shape);

    // Flip Vertical
    } else if (e.key === "v" || e.key === "V") {
      boardState.draggingPiece.shape = flipY(boardState.draggingPiece.shape);
    }
  });
}
