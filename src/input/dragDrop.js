import { BOARD_SIZE } from "../constants.js";
import { normalize } from "../utils/geometry.js";
import { boardState } from "../state/boardState.js";

// helpers 
function inBounds(shape, origin) {
  return shape.every(([dx, dy]) => {
    const x = origin.x + dx, y = origin.y + dy;
    return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
  });
}
function overlaps(shape, origin, placed) {
  const taken = new Set();
  (placed || []).forEach(p => {
    p.shape.forEach(([dx, dy]) => taken.add(`${p.origin.x + dx}:${p.origin.y + dy}`));
  });
  return shape.some(([dx, dy]) => taken.has(`${origin.x + dx}:${origin.y + dy}`));
}
function canPlaceDefault(shape, origin) {
  return inBounds(shape, origin) && !overlaps(shape, origin, boardState.placedPieces);
}
function clientToCell(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left - (boardState.mouseOffset?.x || 0);
  const py = clientY - rect.top  - (boardState.mouseOffset?.y || 0);
  return { x: Math.floor(px / boardState.cellSize), y: Math.floor(py / boardState.cellSize) };
}

//setup 
export function attachCanvasInput(canvas) {
  boardState.placedPieces ||= [];
  boardState.availablePieces ||= { yellow: [], red: [], blue: [], green: [] };

  boardState.draggingPiece ??= null;
  boardState.dragPos       ??= { x: 0, y: 0 };
  boardState.mouseOffset   ??= { x: 0, y: 0 };
  boardState.previewOrigin ??= null;
  boardState.previewValid  ??= false;

  function updatePreview(clientX, clientY) {
    if (!boardState.draggingPiece) return;
    const origin = clientToCell(canvas, clientX, clientY);
    boardState.previewOrigin = origin;

    const shape = boardState.draggingPiece.shape;
    const ok = (typeof boardState.canPlace === "function")
      ? boardState.canPlace(shape, origin)
      : canPlaceDefault(shape, origin);

    boardState.previewValid = ok;
  }

  function placeViaBoardStateOrFallback(endClientX, endClientY) {
    const dp = boardState.draggingPiece;
    if (!dp) return false;

    const origin = boardState.previewOrigin || clientToCell(canvas, endClientX, endClientY);

    if (typeof boardState.dropAt === "function") {
      boardState.dropAt(origin.x, origin.y, dp.shape);
      return true;
    }

    // Fallback placement
    const valid = canPlaceDefault(dp.shape, origin);
    if (valid) {
      boardState.placedPieces.push({
        shape: dp.shape.map(([x,y]) => [x,y]),
        origin,
        color: dp.color,
        imageObj: dp.imageObj,
      });
      boardState.emit?.();
      return true;
    } else if (dp.source === "board" && dp.originalPlacement) {
      // return piece on invalid drag move
      const op = dp.originalPlacement;
      boardState.placedPieces.push({
        shape: op.shape.map(([x,y]) => [x,y]),
        origin: { ...op.origin },
        color: op.color,
        imageObj: op.imageObj,
      });
      boardState.emit?.();
      return false;
    }
    return false;
  }

  function cancelDrag() {
    // If canceled and piece came from board, put it back
    if (boardState.draggingPiece?.source === "board" && boardState.draggingPiece.originalPlacement) {
      const op = boardState.draggingPiece.originalPlacement;
      boardState.placedPieces.push({
        shape: op.shape.map(([x,y]) => [x,y]),
        origin: { ...op.origin },
        color: op.color,
        imageObj: op.imageObj,
      });
    }

    boardState.draggingPiece = null;
    boardState.previewOrigin = null;
    boardState.previewValid = false;
    boardState.mouseOffset = { x: 0, y: 0 };

    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  }

  function onMouseMove(e) {
    if (!boardState.draggingPiece) return;
    e.preventDefault();
    boardState.dragPos = { x: e.clientX, y: e.clientY };
    updatePreview(e.clientX, e.clientY);
  }
  function onMouseUp(e) {
    if (!boardState.draggingPiece) return;
    e.preventDefault();
    placeViaBoardStateOrFallback(e.clientX, e.clientY);
    cancelDrag();
  }
  function onTouchMove(e) {
    if (!boardState.draggingPiece) return;
    const t = e.touches[0]; if (!t) return;
    e.preventDefault();
    boardState.dragPos = { x: t.clientX, y: t.clientY };
    updatePreview(t.clientX, t.clientY);
  }
  function onTouchEnd(e) {
    if (!boardState.draggingPiece) return;
    const t = e.changedTouches[0];
    const x = t ? t.clientX : boardState.dragPos.x;
    const y = t ? t.clientY : boardState.dragPos.y;
    placeViaBoardStateOrFallback(x, y);
    cancelDrag();
  }

  boardState.startDrag = function startDrag(piece, clientX, clientY, offsetX, offsetY, wrapperEl) {
    const normShape = normalize(piece.shape);
    boardState.draggingPiece = {
      ...piece,
      shape: normShape,
      wrapperEl,
      source: piece.source || "panel",
      originalPlacement: null,
    };
    boardState.dragPos = { x: clientX, y: clientY };
    boardState.mouseOffset = { x: offsetX, y: offsetY };
    updatePreview(clientX, clientY);

    window.addEventListener("mousemove", onMouseMove, { passive: false });
    window.addEventListener("mouseup", onMouseUp, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
  };

  boardState.cancelDrag = cancelDrag;

  // Pick up from board (keeps it used until Space or Delete)
  canvas.addEventListener("mousedown", (e) => {
    if (boardState.draggingPiece) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cell = { x: Math.floor(px / boardState.cellSize), y: Math.floor(py / boardState.cellSize) };

    const picked = boardState.pickUpAt(cell.x, cell.y);
    if (!picked) return;

    boardState.startDrag({ ...picked, source: "board" }, e.clientX, e.clientY, 0, 0, null);
  });
}
