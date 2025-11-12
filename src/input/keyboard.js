import { boardState } from "../state/boardState.js";

/**
 * Rebuilds shape from original base + rotation/flip each keypress.
 * Prevents cumulative distortion and cross-player interference.
 */
function applyTransformsFromBase(piece) {
  if (!piece.originalShape) return piece.shape;
  const base = JSON.parse(JSON.stringify(piece.originalShape));
  let shape = base;

  if (piece.flippedH) {
    const maxX = Math.max(...shape.map(([x]) => x));
    shape = shape.map(([x, y]) => [maxX - x, y]);
  }
  if (piece.flippedV) {
    const maxY = Math.max(...shape.map(([, y]) => y));
    shape = shape.map(([x, y]) => [x, maxY - y]);
  }

  const rot = ((piece.rotation || 0) % 360 + 360) % 360;
  const turns = Math.round(rot / 90) % 4;
  for (let i = 0; i < turns; i++) {
    shape = shape.map(([x, y]) => [-y, x]);
    const xs = shape.map(([xx]) => xx);
    const ys = shape.map(([, yy]) => yy);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    shape = shape.map(([xx, yy]) => [xx - minX, yy - minY]);
  }

  return shape;
}

export function attachKeyboard(openInstructions, closeInstructions) {
  window.addEventListener("keydown", (e) => {
    const dp = boardState.draggingPiece;
    const key = e.key.toLowerCase();

    // instructions
    if (key === "?" || key === "i") {
      e.preventDefault();
      openInstructions?.();
      return;
    }
    if (key === "escape") {
      e.preventDefault();
      boardState.cancelDrag?.();
      return;
    }

    if (!dp || !boardState.isLocal(dp.color)) return;

    let changed = false;
    switch (key) {
      case "r":
        e.preventDefault();
        dp.rotation = ((dp.rotation || 0) + 90) % 360;
        dp.shape = applyTransformsFromBase(dp);
        changed = true;
        break;
      case "f":
        e.preventDefault();
        dp.flippedH = !dp.flippedH;
        dp.shape = applyTransformsFromBase(dp);
        changed = true;
        break;
      case "v":
        e.preventDefault();
        dp.flippedV = !dp.flippedV;
        dp.shape = applyTransformsFromBase(dp);
        changed = true;
        break;
      case "delete":
      case "backspace":
        e.preventDefault();
        boardState.cancelDrag?.();
        changed = true;
        break;
    }
    if (changed) boardState.emit?.();
  });
}
