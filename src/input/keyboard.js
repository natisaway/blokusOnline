import { boardState } from "../state/boardState.js";
export function attachKeyboard(modalEl) {

  window.addEventListener(
    "keydown",
    (e) => {
      const isSpace =
        e.code === "Space" || e.key === " ";
      const isDelete =
        e.key === "Delete" ||
        e.code === "Delete" ||
        e.key === "Backspace" ||
        e.code === "Backspace";

      // Return-to-panel shortcuts: Space or Delete/Backspace
      if (isSpace || isDelete) {
        e.preventDefault();

        if (boardState.draggingPiece) {
          boardState.returnDragging?.();
          boardState.cancelDrag?.(); 
        } else {
          boardState.returnLast?.();
        }
        return;
      }

      // Only transform while dragging
      if (!boardState.draggingPiece) return;

      // Rotate: R
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        boardState.rotateDraggingCW?.();
        return;
      }

      // Flip: F = Horizontal, V = Vertical
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        boardState.flipDraggingH?.();
        return;
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        boardState.flipDraggingV?.();
        return;
      }
    },
    { passive: false }
  );
}
