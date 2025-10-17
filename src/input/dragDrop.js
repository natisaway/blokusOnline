// src/input/dragDrop.js
import { BOARD_SIZE } from "../constants.js";
import { boardState } from "../state/boardState.js";

/* ---------------- local normalize ---------------- */
function normalize(shape) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return shape
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

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

  origin.x = Math.round(origin.x);
  origin.y = Math.round(origin.y);

  const maxCell = BOARD_SIZE - 1;
  if (origin.x < -10) origin.x = -10;
  if (origin.y < -10) origin.y = -10;
  if (origin.x > maxCell + 10) origin.x = maxCell + 10;
  if (origin.y > maxCell + 10) origin.y = maxCell + 10;

  boardState.previewOrigin = origin;
  boardState.previewValid = boardState.canPlace(dp.shape, origin);
  scheduleEmit();
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

  const rect = dp.wrapperEl.getBoundingClientRect();
  const inside =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;
  if (!inside) return;

  const origin = clientToGrid(
    e.clientX,
    e.clientY,
    dp.wrapperEl,
    boardState.cellSize,
    boardState.mouseOffset
  );

  const can = boardState.canPlace(dp.shape, origin);
  if (!can) {
    if (dp.source === "panel") {
      boardState.draggingPiece = null;
      boardState.previewOrigin = null;
      boardState.previewValid = false;
      boardState.emit?.();
      cleanup();
      return;
    } else {
      boardState.dropAt(origin.x, origin.y, dp.shape);
      cleanup();
      return;
    }
  }

  const placed = boardState.dropAt(origin.x, origin.y, dp.shape);
  if (placed) cleanup();
}

/* ---------------- teardown ---------------- */
function cleanup() {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("touchmove", onTouchMove);
  const boardCanvas = document.getElementById("board");
  boardCanvas?.removeEventListener("click", onBoardClick);
  document.body.classList.remove("dragging");
  if (boardCanvas) {
    boardCanvas.classList.remove("dragging");
    boardCanvas.style.cursor = "";
  }
}

/* =================== DRAG ENTRY =================== */
boardState.startDrag = function startDrag(
  piece,
  clientX,
  clientY,
  offsetX,
  offsetY
) {
  const srcColor = piece.color;
  const src = piece.source || "panel";

  // 🧩 1. Enforce turn color
  if (src === "panel" && srcColor !== boardState.currentPlayer) return;

  // 🧩 2. Prevent multiple placements per turn
  if (src === "panel" && boardState.turnLocked) {
    console.warn("You already placed a piece this turn. End turn or undo first.");
    return;
  }

  const boardCanvas = document.getElementById("board");
  const normShape = normalize(piece.shape);

  boardState.draggingPiece = {
    ...piece,
    shape: normShape,
    wrapperEl: boardCanvas,
    source: piece.source || "panel",
    originalPlacement: piece.originalPlacement ?? null,
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
};

boardState.cancelDrag = cleanup;

/* ================= Panel & Canvas wiring ================= */
export function attachPanelDrag(panelEl, color) {
  panelEl.querySelectorAll("[data-piece]").forEach((node) => {
    node.addEventListener(
      "mousedown",
      (e) => {
        if (color !== boardState.currentPlayer) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // 🧩 Block new drags if locked
        if (boardState.turnLocked) {
          e.preventDefault();
          e.stopPropagation();
          console.warn("You already placed a piece this turn.");
          return;
        }

        const shape = JSON.parse(node.getAttribute("data-piece"));
        boardState.startDrag(
          { shape, color, imageObj: node, source: "panel" },
          e.clientX,
          e.clientY,
          8,
          8
        );
      },
      { passive: false }
    );

    node.addEventListener(
      "touchstart",
      (e) => {
        if (color !== boardState.currentPlayer) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (boardState.turnLocked) {
          e.preventDefault();
          e.stopPropagation();
          console.warn("You already placed a piece this turn.");
          return;
        }
        const t = e.touches[0];
        if (!t) return;
        const shape = JSON.parse(node.getAttribute("data-piece"));
        boardState.startDrag(
          { shape, color, imageObj: node, source: "panel" },
          t.clientX,
          t.clientY,
          8,
          8
        );
      },
      { passive: false }
    );
  });
}

/* Hover + pickup logic (unchanged) */
let hoverRAF = null;
function setBoardHoverHandlers(canvasEl) {
  function requestHover(e) {
    const x = e.clientX;
    const y = e.clientY;
    if (hoverRAF) return;
    hoverRAF = requestAnimationFrame(() => {
      hoverRAF = null;
      if (boardState.draggingPiece) {
        canvasEl.style.cursor = "grabbing";
        return;
      }
      const { x: gx, y: gy } = clientToGrid(x, y, canvasEl, boardState.cellSize, { x: 0, y: 0 });
      const can = boardState.canPickUpAt?.(gx, gy);
      canvasEl.style.cursor = can ? "grab" : "";
    });
  }
  canvasEl.addEventListener("mousemove", requestHover, { passive: true });
  canvasEl.addEventListener("mouseleave", () => {
    if (!boardState.draggingPiece) canvasEl.style.cursor = "";
  }, { passive: true });
}

export function attachBoardPickup(canvasEl) {
  setBoardHoverHandlers(canvasEl);

  canvasEl.addEventListener("mousedown", (e) => {
    if (boardState.draggingPiece) return;
    const rect = canvasEl.getBoundingClientRect();
    const cell = boardState.cellSize;
    const gx = Math.floor((e.clientX - rect.left) / cell);
    const gy = Math.floor((e.clientY - rect.top) / cell);
    const picked = boardState.pickUpAt(gx, gy);
    if (!picked) return;
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

  canvasEl.addEventListener("touchstart", (e) => {
    if (boardState.draggingPiece) return;
    const t = e.touches[0];
    if (!t) return;
    const rect = canvasEl.getBoundingClientRect();
    const cell = boardState.cellSize;
    const gx = Math.floor((t.clientX - rect.left) / cell);
    const gy = Math.floor((t.clientY - rect.top) / cell);
    const picked = boardState.pickUpAt(gx, gy);
    if (!picked) return;
    const offsetX = t.clientX - (rect.left + gx * cell);
    const offsetY = t.clientY - (rect.top + gy * cell);
    boardState.startDrag(
      { ...picked, source: "board" },
      t.clientX,
      t.clientY,
      offsetX,
      offsetY
    );
  });
}

export function attachClickToDrop(boardWrapperEl) {
  boardWrapperEl.addEventListener("click", (e) => {
    if (!boardState.draggingPiece) return;
    boardState.startDrag(
      { ...boardState.draggingPiece, source: "board" },
      e.clientX,
      e.clientY,
      0,
      0
    );
  });
}

export function attachCanvasInput(canvasEl) {
  attachBoardPickup(canvasEl);
}
