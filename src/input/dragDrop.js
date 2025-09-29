import { BOARD_SIZE } from "../constants.js";
import { boardState } from "../state/boardState.js";

// Local normalize (pieces.js does not export one)
function normalize(shape) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return shape
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

function clientToGrid(clientX, clientY, wrapperEl, cellSize, mouseOffset) {
  const rect = wrapperEl.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left - mouseOffset.x) / cellSize);
  const y = Math.floor((clientY - rect.top - mouseOffset.y) / cellSize);
  return { x, y };
}

/* ---------- rAF-coalesced emit to avoid drag lag ---------- */
let rafPending = false;
function scheduleEmit() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    boardState.emit?.();
  });
}

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
  boardState.previewOrigin = origin;
  boardState.previewValid = boardState.canPlace(dp.shape, origin);
  scheduleEmit();
}

/* ---------- pointer handlers ---------- */
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

/* Click-to-place: stick to mouse until user clicks the board */
function onBoardClick(e) {
  const dp = boardState.draggingPiece;
  if (!dp) return;

  const rect = dp.wrapperEl.getBoundingClientRect();
  const inside =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;
  if (!inside) return; // ignore non-board clicks

  const origin = clientToGrid(
    e.clientX,
    e.clientY,
    dp.wrapperEl,
    boardState.cellSize,
    boardState.mouseOffset
  );

  // Check validity BEFORE attempting to place (captures OOB too)
  const can = boardState.canPlace(dp.shape, origin);

  if (!can) {
    if (dp.source === "panel") {
      // Invalid from panel -> return to panel (stop dragging)
      boardState.draggingPiece = null;
      boardState.previewOrigin = null;
      boardState.previewValid = false;
      boardState.emit?.();
      cleanup();
      return;
    } else {
      // Invalid from board -> revert to original placement and stop dragging
      // dropAt handles revert when invalid and source was "board"
      boardState.dropAt(origin.x, origin.y, dp.shape);
      cleanup();
      return;
    }
  }

  // Valid -> place and end drag
  const placed = boardState.dropAt(origin.x, origin.y, dp.shape);
  if (placed) cleanup();
}

function cleanup() {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("touchmove", onTouchMove);

  const boardCanvas = document.getElementById("board");
  boardCanvas?.removeEventListener("click", onBoardClick);

  // restore cursor/state
  document.body.classList.remove("dragging");
  if (boardCanvas) {
    boardCanvas.classList.remove("dragging");
    boardCanvas.style.cursor = "";
  }
}

/* ========== Drag API wired into boardState ========== */
boardState.startDrag = function startDrag(piece, clientX, clientY, offsetX, offsetY /*, wrapperEl */) {
  // Enforce turn order when starting a drag from a panel
  const srcColor = piece.color;
  const src = piece.source || "panel";
  if (src === "panel" && srcColor !== boardState.currentPlayer) {
    return; // ignore attempts to drag out-of-turn
  }

  // ALWAYS use the main board canvas for coordinate conversion
  const boardCanvas = document.getElementById("board");

  const normShape = normalize(piece.shape);
  boardState.draggingPiece = {
    ...piece,
    shape: normShape,
    wrapperEl: boardCanvas, // do not use panel tile as wrapper
    source: piece.source || "panel",
    // keep original placement if we picked from the board (so invalid drops can revert)
    originalPlacement: piece.originalPlacement ?? null,
  };
  boardState.dragPos = { x: clientX, y: clientY };
  boardState.mouseOffset = { x: offsetX, y: offsetY };
  updatePreview(clientX, clientY);

  // Sticky mode: move with mouse/touch, place on CLICK (no mouseup placement)
  window.addEventListener("mousemove", onMouseMove, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  boardCanvas.addEventListener("click", onBoardClick, { passive: false });

  // Cursor: grabbing while dragging
  document.body.classList.add("dragging");
  boardCanvas.classList.add("dragging");
  boardCanvas.style.cursor = "grabbing";
};

boardState.cancelDrag = cleanup;

/* ========== Panel and Canvas wiring helpers ========== */

// Panels should call this to start a drag
export function attachPanelDrag(panelEl, color) {
  panelEl.querySelectorAll("[data-piece]").forEach((node) => {
    node.addEventListener(
      "mousedown",
      (e) => {
        // HARD LOCK: ignore other colors on wrong turn
        if (color !== boardState.currentPlayer) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const shape = JSON.parse(node.getAttribute("data-piece"));
        const wrapperEl = document.querySelector("[data-board-wrapper]");
        // A small offset from panel tiles so the cursor isn't exactly on the tile corner
        boardState.startDrag(
          { shape, color, imageObj: node, source: "panel" },
          e.clientX,
          e.clientY,
          8,
          8,
          wrapperEl
        );
      },
      { passive: false }
    );

    node.addEventListener(
      "touchstart",
      (e) => {
        // HARD LOCK: ignore other colors on wrong turn
        if (color !== boardState.currentPlayer) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const t = e.touches[0];
        const shape = JSON.parse(node.getAttribute("data-piece"));
        const wrapperEl = document.querySelector("[data-board-wrapper]");
        boardState.startDrag(
          { shape, color, imageObj: node, source: "panel" },
          t.clientX,
          t.clientY,
          8,
          8,
          wrapperEl
        );
      },
      { passive: false }
    );
  });
}

/* ---- Hover cursor on the board: show grab over your pieces ---- */
let hoverRAF = null;
function setBoardHoverHandlers(canvasEl) {
  function requestHover(e) {
    const x = e.clientX;
    const y = e.clientY;
    if (hoverRAF) return;
    hoverRAF = requestAnimationFrame(() => {
      hoverRAF = null;
      // If dragging, always show grabbing
      if (boardState.draggingPiece) {
        canvasEl.style.cursor = "grabbing";
        return;
      }
      const { x: gx, y: gy } = clientToGrid(
        x,
        y,
        canvasEl,
        boardState.cellSize,
        { x: 0, y: 0 } // only for hover, no drag offset
      );
      const can = boardState.canPickUpAt?.(gx, gy);
      canvasEl.style.cursor = can ? "grab" : "";
    });
  }

  canvasEl.addEventListener("mousemove", requestHover, { passive: true });
  canvasEl.addEventListener(
    "mouseleave",
    () => {
      if (!boardState.draggingPiece) canvasEl.style.cursor = "";
    },
    { passive: true }
  );
}

// Board pickups (click to pick up your own piece)
export function attachBoardPickup(canvasEl) {
  // Hover intent: show 'grab' when you can pick up
  setBoardHoverHandlers(canvasEl);

  canvasEl.addEventListener("mousedown", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const cell = boardState.cellSize;

    // Grid coords where the mouse went down
    const gx = Math.floor((e.clientX - rect.left) / cell);
    const gy = Math.floor((e.clientY - rect.top) / cell);

    const picked = boardState.pickUpAt(gx, gy);
    if (!picked) return;

    // Preserve exact pixel offset inside the clicked cell
    const offsetX = e.clientX - (rect.left + gx * cell);
    const offsetY = e.clientY - (rect.top + gy * cell);

    boardState.startDrag(
      { ...picked, source: "board" },
      e.clientX,
      e.clientY,
      offsetX,
      offsetY,
      canvasEl
    );
  });

  canvasEl.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    const rect = canvasEl.getBoundingClientRect();
    const cell = boardState.cellSize;

    const gx = Math.floor((t.clientX - rect.left) / cell);
    const gy = Math.floor((t.clientY - rect.top) / cell);

    const picked = boardState.pickUpAt(gx, gy);
    if (!picked) return;

    // Preserve exact pixel offset (touch)
    const offsetX = t.clientX - (rect.left + gx * cell);
    const offsetY = t.clientY - (rect.top + gy * cell);

    boardState.startDrag(
      { ...picked, source: "board" },
      t.clientX,
      t.clientY,
      offsetX,
      offsetY,
      canvasEl
    );
  });
}

// Optional: click-to-drop convenience (not used in sticky mode)
export function attachClickToDrop(boardWrapperEl) {
  boardWrapperEl.addEventListener("click", (e) => {
    if (!boardState.draggingPiece) return;
    boardState.startDrag(
      { ...boardState.draggingPiece, source: "board" },
      e.clientX,
      e.clientY,
      0,
      0,
      null
    );
  });
}

/* Named export expected by main.js */
export function attachCanvasInput(canvasEl) {
  // Wire board pickups and hover cursor to the canvas.
  attachBoardPickup(canvasEl);
}
