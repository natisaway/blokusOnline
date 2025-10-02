// src/input/dragDrop.js
import { BOARD_SIZE } from "../constants.js";
import { boardState } from "../state/boardState.js";

/* ---------------- local normalize (panel tiles -> drag shape) ----------------
   pieces.js doesn’t export a normalize; this keeps drag shapes tidy.
   Note: boardState uses orientation-invariant canonicalization for inventory,
   so using this simple normalize here is fine for dragging math.
-------------------------------------------------------------------------------*/
function normalize(shape) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return shape
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

/* ---------------- client -> grid helpers ---------------- */
function clientToGrid(clientX, clientY, wrapperEl, cellSize, mouseOffset) {
  const rect = wrapperEl.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left - mouseOffset.x) / cellSize);
  const y = Math.floor((clientY - rect.top - mouseOffset.y) / cellSize);
  return { x, y };
}

/* ---------- rAF-coalesced emit to minimize drag lag ---------- */
let rafPending = false;
function scheduleEmit() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    boardState.emit?.();
  });
}

/* ---------------- live preview updater ----------------
   No snapping: player can freely move; first-corner rule enforced on drop.
---------------------------------------------------------*/
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

  // Optional gentle clamp so preview doesn’t jitter outside board too wildly
  // (kept simple; boardState.canPlace still does hard validation)
  const maxCell = BOARD_SIZE - 1;
  if (origin.x < -10) origin.x = -10;
  if (origin.y < -10) origin.y = -10;
  if (origin.x > maxCell + 10) origin.x = maxCell + 10;
  if (origin.y > maxCell + 10) origin.y = maxCell + 10;

  boardState.previewOrigin = origin;

  // canPlace looks at boardState.draggingPiece?.color; since dp === draggingPiece, OK.
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

/* Click-to-place: sticky drag stays until the user clicks the board */
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
      // Invalid from board -> revert to original placement (dropAt handles revert)
      boardState.dropAt(origin.x, origin.y, dp.shape);
      cleanup();
      return;
    }
  }

  // Valid -> place and end drag
  const placed = boardState.dropAt(origin.x, origin.y, dp.shape);
  if (placed) cleanup();
}

/* ---------------- teardown ---------------- */
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

/* ================= Drag API exposed via boardState =================
   Keeps compatibility with earlier code: panels call startDrag, Escape/Cancel
   calls cancelDrag, and keyboard handlers can rely on draggingPiece state.
=====================================================================*/
boardState.startDrag = function startDrag(
  piece,
  clientX,
  clientY,
  offsetX,
  offsetY /* , wrapperEl */
) {
  // Enforce turn order when starting a drag from a panel
  const srcColor = piece.color;
  const src = piece.source || "panel";
  if (src === "panel" && srcColor !== boardState.currentPlayer) {
    return; // ignore attempts to drag out-of-turn
  }

  // Always anchor to the main board canvas for coordinate conversion
  const boardCanvas = document.getElementById("board");

  const normShape = normalize(piece.shape);
  boardState.draggingPiece = {
    ...piece,
    shape: normShape,
    wrapperEl: boardCanvas, // use board canvas as the reference surface
    source: piece.source || "panel",
    originalPlacement: piece.originalPlacement ?? null, // retained if picked from board
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

/* ================= Panel & Canvas wiring helpers ================= */
export function attachPanelDrag(panelEl, color) {
  panelEl.querySelectorAll("[data-piece]").forEach((node) => {
    // Mouse
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

    // Touch
    node.addEventListener(
      "touchstart",
      (e) => {
        if (color !== boardState.currentPlayer) {
          e.preventDefault();
          e.stopPropagation();
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
        { x: 0, y: 0 } // hover has no drag offset
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

/* -------- Board pickups: click a cell with your piece to pick it up -------- */
export function attachBoardPickup(canvasEl) {
  setBoardHoverHandlers(canvasEl);

  canvasEl.addEventListener("mousedown", (e) => {
    // Don’t start a new pickup while dragging
    if (boardState.draggingPiece) return;

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

    // Preserve exact pixel offset (touch)
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

/* Optional: convenience helper (not used in sticky mode but kept for parity) */
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

/* Named export expected by main.js */
export function attachCanvasInput(canvasEl) {
  // Wire board pickups and hover cursor to the canvas.
  attachBoardPickup(canvasEl);
}
