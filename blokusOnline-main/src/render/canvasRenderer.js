// src/render/canvasRenderer.js
import { BOARD_SIZE } from "../constants.js";

// Simple color map for board fills (used if no image texture is present)
const FILL = {
  red:    "#e74c3c",
  yellow: "#f2c94c",
  blue:   "#2f80ed",
  green:  "#27ae60",
};

// Start point swatches (slightly stronger)
const START_COLORS = {
  red:    "#ff3b30",
  yellow: "#ffd400",
  green:  "#00c853",
  blue:   "#007aff",
};

export function createCanvasRenderer(canvas, state) {
  const ctx = canvas.getContext("2d");

  function ensureCanvasSize() {
    const px = BOARD_SIZE * state.cellSize;
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1;

    for (let i = 0; i <= BOARD_SIZE; i++) {
      // vertical
      ctx.beginPath();
      ctx.moveTo(i * state.cellSize + 0.5, 0.5);
      ctx.lineTo(i * state.cellSize + 0.5, BOARD_SIZE * state.cellSize + 0.5);
      ctx.stroke();

      // horizontal
      ctx.beginPath();
      ctx.moveTo(0.5, i * state.cellSize + 0.5);
      ctx.lineTo(BOARD_SIZE * state.cellSize + 0.5, i * state.cellSize + 0.5);
      ctx.stroke();
    }

    // board border
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, BOARD_SIZE * state.cellSize - 1, BOARD_SIZE * state.cellSize - 1);
    ctx.restore();
  }

  function drawStartDot(color, sp) {
    if (!sp) return;
    const cs = state.cellSize;
    const pad = Math.max(1, Math.floor(cs * 0.08));
    const sz  = Math.max(4, Math.floor(cs * 0.6));
    const px = sp.x * cs + pad;
    const py = sp.y * cs + pad;

    ctx.save();
    ctx.fillStyle = START_COLORS[color] || "#666";
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = Math.max(1, Math.floor(cs * 0.06));
    ctx.fillRect(px, py, sz, sz);
    ctx.strokeRect(px, py, sz, sz);
    ctx.restore();
  }

  function drawBlocksAt(shape, origin, color, imageObj) {
    const cs = state.cellSize;
    ctx.save();
    for (const [dx, dy] of shape) {
      const x = (origin.x + dx) * cs;
      const y = (origin.y + dy) * cs;

      if (imageObj && imageObj.width && imageObj.height) {
        // If a texture image is provided, draw it scaled to the cell
        ctx.drawImage(imageObj, x, y, cs, cs);
      } else {
        // Fallback colored square with a thin stroke
        ctx.fillStyle = FILL[color] || "#888";
        ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.lineWidth = Math.max(1, Math.floor(cs * 0.06));
        ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      }
    }
    ctx.restore();
  }

  function drawPlaced() {
    for (const piece of state.placedPieces) {
      drawBlocksAt(piece.shape, piece.origin, piece.color, piece.imageObj);
    }
  }

  function drawDraggingPreview() {
    const dp = state.draggingPiece;
    if (!dp || !state.previewOrigin) return;

    const cs = state.cellSize;
    const valid = !!state.previewValid;

    ctx.save();
    ctx.globalAlpha = valid ? 0.85 : 0.45;
    // show cells for preview; if invalid, add a red outline box
    drawBlocksAt(dp.shape, state.previewOrigin, dp.color, dp.imageObj);

    if (!valid) {
      ctx.strokeStyle = "#e11d48"; // rose-600
      ctx.lineWidth = Math.max(2, Math.floor(cs * 0.1));
      // outline the union bounding box
      const xs = dp.shape.map(([dx]) => state.previewOrigin.x + dx);
      const ys = dp.shape.map(([,dy]) => state.previewOrigin.y + dy);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      ctx.strokeRect(minX * cs + 0.5, minY * cs + 0.5, (maxX - minX + 1) * cs - 1, (maxY - minY + 1) * cs - 1);
    }

    ctx.restore();
  }

  function maybeDrawStartDot() {
    if (!state.inFirstRound) return;               // only round 1
    const cur = state.currentPlayer;
    const sp = state.startPoint?.[cur];
    drawStartDot(cur, sp);
  }

  // Master frame
  function frame() {
    ensureCanvasSize();
    drawGrid();
    maybeDrawStartDot();
    drawPlaced();
    drawDraggingPreview();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
