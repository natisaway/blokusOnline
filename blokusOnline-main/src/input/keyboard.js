// src/input/keyboard.js
// Global keyboard bindings (ignored while typing in inputs/contenteditable).
// Keys:
//   R = rotate 90° CCW
//   F = flip horizontal
//   V = flip vertical
//   Delete / Backspace = return currently dragged piece to panel
//   Enter = end turn
//   ? or I = open instructions
//   Esc = close instructions

import { boardState } from "../state/boardState.js";

let bound = false;

function isTyping(el) {
  if (!el) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

export function attachKeyboard(openInstructions, closeInstructions) {
  if (bound) return;
  bound = true;

  window.addEventListener(
    "keydown",
    (e) => {
      if (isTyping(e.target)) return;

      const k = e.key;

      // --- return piece while dragging ---
      if (k === "Delete" || k === "Backspace") {
        if (boardState.draggingPiece) {
          e.preventDefault();           // prevent browser back nav on Backspace
          boardState.returnDraggingToPanel();
        }
        return;
      }

      if (k === "Enter") {
        e.preventDefault();
        boardState.endTurn();
        return;
      }

      if (k === "r" || k === "R") {
        e.preventDefault();
        boardState.rotateDragging();
        return;
      }

      if (k === "f" || k === "F") {
        e.preventDefault();
        boardState.flipDraggingH();
        return;
      }

      if (k === "v" || k === "V") {
        e.preventDefault();
        boardState.flipDraggingV();
        return;
      }

      if (k === "?" || k === "i" || k === "I") {
        e.preventDefault();
        openInstructions?.();
        return;
      }

      if (k === "Escape") {
        e.preventDefault();
        closeInstructions?.();
        return;
      }
    },
    { passive: false }
  );
}

export default attachKeyboard;
