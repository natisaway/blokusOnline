import { BOARD_SIZE } from "../constants.js";
import { boardState } from "../state/boardState.js";
import { normalize } from "../utils/geometry.js";

/* convert screen (client) coordinates to board grid coordinates */
function clientToGrid(clientX, clientY, wrapperEl, cellSize, mouseOffset) {
  const rect = wrapperEl.getBoundingClientRect();
  const x = Math.round((clientX - rect.left - mouseOffset.x) / cellSize);
  const y = Math.round((clientY - rect.top - mouseOffset.y) / cellSize);
  return { x, y };
}

let rafPending = false;
/* state updates to animation frames */
function scheduleEmit() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    boardState.emit?.();
  });
}

/* update drag preview position + validity */
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

  /* clamp to safe drag bounds around board */
  origin.x = Math.max(-10, Math.min(BOARD_SIZE + 10, origin.x));
  origin.y = Math.max(-10, Math.min(BOARD_SIZE + 10, origin.y));

  boardState.previewOrigin = origin;
  boardState.previewValid = boardState.canPlace(dp.shape, origin);
  scheduleEmit();
}

/* return piece to player's piece pool if the drop fails */
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

/* reset drag state and event listeners */
function cleanup(returnToPanel = false) {
  const boardCanvas = document.getElementById("board");
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("touchend", onTouchEnd);

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

boardState.cancelDrag = function () {
  cleanup(true);
};


/* mouse drag movement handler */
function onMouseMove(e) {
  e.preventDefault();
  const dp = boardState.draggingPiece;
  if (!dp) return;
  boardState.dragPos = { x: e.clientX, y: e.clientY };
  updatePreview(e.clientX, e.clientY);
}

/* touch drag movement handler */
function onTouchMove(e) {
  const t = e.touches[0];
  if (!t) return;
  const dp = boardState.draggingPiece;
  if (!dp) return;
  boardState.dragPos = { x: t.clientX, y: t.clientY };
  updatePreview(t.clientX, t.clientY);
}

/* attempt to place the piece at the target position */
function handleDrop(x, y) {
  const dp = boardState.draggingPiece;
  if (!dp) return false;

  const origin = { x, y };
  const can = boardState.canPlace(dp.shape, origin);
  if (!can) {
    cleanup(true);
    return false;
  }

  const placed = boardState.dropAt(origin.x, origin.y, dp.shape, dp.imageObj);
  cleanup(!placed);
  return placed;
}

/* mouse drop handler */
function onMouseUp(e) {
  const dp = boardState.draggingPiece;
  if (!dp) return;

  const origin = clientToGrid(
    e.clientX,
    e.clientY,
    dp.wrapperEl,
    boardState.cellSize,
    boardState.mouseOffset
  );
  handleDrop(origin.x, origin.y);
}

/* touch drop handler */
function onTouchEnd(e) {
  const dp = boardState.draggingPiece;
  if (!dp) return;
  const touch = e.changedTouches[0];
  if (!touch) return;

  const origin = clientToGrid(
    touch.clientX,
    touch.clientY,
    dp.wrapperEl,
    boardState.cellSize,
    boardState.mouseOffset
  );
  handleDrop(origin.x, origin.y);
}

/* begin dragging a piece from panel or board */
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
  piece.fromReposition = src === "board";

  /* only allow dragging own piece on own turn */
  if (src === "panel" && (!boardState.isLocal(color) || color !== boardState.currentPlayer)) {
    console.log(`Cannot drag ${color} piece — not current local player`);
    return;
  }

  if (boardState.draggingPiece) {
    console.log("Already dragging a piece — drop or cancel first");
    return;
  }

  /* prevent drag if turn is locked */
  if (src === "panel" && boardState.turnLocked) return;

  /* remove piece from panel list if dragging from panel */
  if (src === "panel") {
    const arr = boardState.availablePieces[color];
    const idx = arr.findIndex((p) => JSON.stringify(p) === JSON.stringify(piece.shape));
    if (idx !== -1) arr.splice(idx, 1);
  }

  const boardCanvas = document.getElementById("board");
  const clonedShape = JSON.parse(JSON.stringify(piece.shape));

  /* create drag state object */
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

  /* attach temporary drag listeners */
  window.addEventListener("mousemove", onMouseMove, { passive: false });
  window.addEventListener("mouseup", onMouseUp, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: false });

  document.body.classList.add("dragging");
  boardCanvas.classList.add("dragging");
  boardCanvas.style.cursor = "grabbing";

  boardState.emit?.();
};

/* enable picking up pieces from the board */
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

/* attach all canvas input handlers */
export function attachCanvasInput(canvasEl) {
  attachBoardPickup(canvasEl);
}
