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

      // End turn with Enter
      if (e.key === "Enter") {
        e.preventDefault();
        boardState.endTurn?.();
        return;
      }

      // Return-to-panel shortcuts: Space or Delete/Backspace
      if (isSpace || isDelete) {
        e.preventDefault();
        // if dragging from panel, cancel -> panel; if from board, cancel returns to original placement
        boardState.cancelDrag?.();
        return;
      }

      // Only transform while dragging
      if (!boardState.draggingPiece) {
        return;
      }

      // Rotate (R)
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        boardState.rotateDragging?.();
        return;
      }
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
