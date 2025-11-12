// src/input/dragDrop.js
import { BOARD_SIZE } from "../constants.js";
import { boardState } from "../state/boardState.js";
import { normalize } from "../utils/geometry.js";

/* ---------------- helpers ---------------- */
function clientToGrid(clientX, clientY, wrapperEl, cellSize, mouseOffset) {
  const rect = wrapperEl.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left - mouseOffset.x) / cellSize);
  const y = Math.floor((clientY - rect.top - mouseOffset.y) / cellSize);
  return { x, y };
}

let rafPending = false;
function scheduleEmit() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    boardState.emit?.();
  });
}

/* ---------------- preview updater ---------------- */
function updatePreview(clientX, clientY) {
  const dp = boardState.draggingPiece;
  if (!dp) {
    boardState.previewOrigin = null;
    boardState.previewValid = false;
    scheduleEmit();
    return;
  }

  const origin = clientToGrid(
    clientX,
    clientY,
    dp.wrapperEl,
    boardState.cellSize,
    boardState.mouseOffset
  );

  origin.x = Math.max(-10, Math.min(BOARD_SIZE + 10, origin.x));
  origin.y = Math.max(-10, Math.min(BOARD_SIZE + 10, origin.y));

  boardState.previewOrigin = origin;
  boardState.previewValid = boardState.canPlace(dp.shape, origin);
  scheduleEmit();
}

/* ---------------- cleanup / auto-return ---------------- */
function autoReturnPiece() {
  const dp = boardState.draggingPiece;
  if (!dp) return;

  const color = dp.color;
  const norm = normalize(dp.originalShape || dp.shape);
  const list = boardState.availablePieces[color];
  if (!list.some((p) => JSON.stringify(p) === JSON.stringify(norm))) {
    list.push(norm);
  }
}

function cleanup(returnToPanel = false) {
  const boardCanvas = document.getElementById("board");

  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("touchmove", onTouchMove);
  boardCanvas?.removeEventListener("click", onBoardClick);

  document.body.classList.remove("dragging");
  if (boardCanvas) {
    boardCanvas.classList.remove("dragging");
    boardCanvas.style.cursor = "default";
  }

  if (returnToPanel && boardState.draggingPiece) {
    autoReturnPiece();
  }

  boardState.draggingPiece = null;
  boardState.previewOrigin = null;
  boardState.previewValid = false;
  boardState.dragPos = null;
  boardState.mouseOffset = null;

  boardState.emit?.();
}

/* ---------------- pointer handlers ---------------- */
function onMouseMove(e) {
  e.preventDefault();
  const dp = boardState.draggingPiece;
  if (!dp) return;
  boardState.dragPos = { x: e.clientX, y: e.clientY };
  updatePreview(e.clientX, e.clientY);
}

function onTouchMove(e) {
  const t = e.touches[0];
  if (!t) return;
  const dp = boardState.draggingPiece;
  if (!dp) return;
  boardState.dragPos = { x: t.clientX, y: t.clientY };
  updatePreview(t.clientX, t.clientY);
}

/* Click-to-place */
function onBoardClick(e) {
  const dp = boardState.draggingPiece;
  if (!dp) return;
  const origin = clientToGrid(
    e.clientX,
    e.clientY,
    dp.wrapperEl,
    boardState.cellSize,
    boardState.mouseOffset
  );
  const can = boardState.canPlace(dp.shape, origin);

  if (!can) return cleanup(true);
  const placed = boardState.dropAt(origin.x, origin.y, dp.shape, dp.imageObj);
  if (placed) cleanup(false);
  else cleanup(true);
}

/* =================== DRAG ENTRY =================== */
boardState.startDrag = function startDrag(
  piece,
  clientX,
  clientY,
  offsetX,
  offsetY,
  wrapper
) {
  const color = piece.color;
  const src = piece.source || "panel";

  // ✅ Allow only the current local player's pieces
  if (src === "panel" && (!boardState.isLocal(color) || color !== boardState.currentPlayer)) {
    console.log(`⛔ Cannot drag ${color} piece — not current local player`);
    return;
  }

  // ✅ Prevent dragging during locked states (if any)
  if (src === "panel" && boardState.turnLocked) return;

  // ✅ Remove the piece from its list (so it disappears while dragging)
  if (src === "panel") {
    const arr = boardState.availablePieces[color];
    const idx = arr.findIndex((p) => JSON.stringify(p) === JSON.stringify(piece.shape));
    if (idx !== -1) arr.splice(idx, 1);
  }

  const boardCanvas = document.getElementById("board");
  const clonedShape = JSON.parse(JSON.stringify(piece.shape));

  boardState.draggingPiece = {
    ...piece,
    shape: clonedShape,
    originalShape: JSON.parse(JSON.stringify(clonedShape)),
    wrapperEl: boardCanvas,
    source: src,
    rotation: 0,
    flippedH: false,
    flippedV: false,
  };

  boardState.dragPos = { x: clientX, y: clientY };
  boardState.mouseOffset = { x: offsetX, y: offsetY };

  updatePreview(clientX, clientY);

  window.addEventListener("mousemove", onMouseMove, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  boardCanvas.addEventListener("click", onBoardClick, { passive: false });

  document.body.classList.add("dragging");
  boardCanvas.classList.add("dragging");
  boardCanvas.style.cursor = "grabbing";

  // ✅ Trigger re-render (piece disappears from panel)
  boardState.emit?.();
};

boardState.cancelDrag = function cancelDrag() {
  cleanup(true);
};

/* ================= Canvas wiring ================= */
export function attachBoardPickup(canvasEl) {
  canvasEl.addEventListener("mousedown", (e) => {
    if (boardState.draggingPiece) return;
    const rect = canvasEl.getBoundingClientRect();
    const cell = boardState.cellSize;
    const gx = Math.floor((e.clientX - rect.left) / cell);
    const gy = Math.floor((e.clientY - rect.top) / cell);
    const picked = boardState.pickUpAt?.(gx, gy);
    if (!picked) return;
    if (picked.color !== boardState.currentPlayer || picked.finalized) return;

    const offsetX = e.clientX - (rect.left + gx * cell);
    const offsetY = e.clientY - (rect.top + gy * cell);
    boardState.startDrag(
      { ...picked, source: "board" },
      e.clientX,
      e.clientY,
      offsetX,
      offsetY
    );
  });
}

export function attachCanvasInput(canvasEl) {
  attachBoardPickup(canvasEl);
}
