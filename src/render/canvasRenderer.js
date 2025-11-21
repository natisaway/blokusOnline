import { BOARD_SIZE } from "../constants.js";

/**
 * EVENT-DRIVEN CANVAS RENDERER
 * ----------------------------
 * - No infinite animation loop.
 * - Redraws ONLY when boardState.emit() is triggered.
 * - Drag preview updated only during mousemove.
 */

const FILL = {
  red: "#e74c3c",
  yellow: "#f2c94c",
  blue: "#2f80ed",
  green: "#27ae60",
};

const START_COLORS = {
  red: "#ff3b30",
  yellow: "#ffd400",
  green: "#00c853",
  blue: "#007aff",
};

export function createCanvasRenderer(canvas, state) {
  const ctx = canvas.getContext("2d");

  /* ---------------- sizing ---------------- */
  function ensureCanvasSize() {
    const px = BOARD_SIZE * state.cellSize;
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
  }

  /* ---------------- grid ---------------- */
  function drawGrid() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1;

    for (let i = 0; i <= BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * state.cellSize + 0.5, 0.5);
      ctx.lineTo(i * state.cellSize + 0.5, BOARD_SIZE * state.cellSize + 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0.5, i * state.cellSize + 0.5);
      ctx.lineTo(BOARD_SIZE * state.cellSize + 0.5, i * state.cellSize + 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      0.5,
      0.5,
      BOARD_SIZE * state.cellSize - 1,
      BOARD_SIZE * state.cellSize - 1
    );

    ctx.restore();
  }

  /* ---------------- start squares ---------------- */
  function drawStartSquare(color, sp) {
    if (!sp) return;
    const cs = state.cellSize;
    const x = sp.x * cs;
    const y = sp.y * cs;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = START_COLORS[color];
    ctx.fillRect(x, y, cs, cs);

    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = START_COLORS[color];
    ctx.lineWidth = Math.max(1, Math.floor(cs * 0.08));
    ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);

    ctx.restore();
  }

  function drawAllStartSquares() {
    if (!state.startPoint) return;
    for (const [color, sp] of Object.entries(state.startPoint)) {
      drawStartSquare(color, sp);
    }
  }

  /* ---------------- placed pieces ---------------- */
  function drawBlocksAt(shape, origin, color, imageObj) {
    const cs = state.cellSize;
    ctx.save();
    for (const [dx, dy] of shape) {
      const x = (origin.x + dx) * cs;
      const y = (origin.y + dy) * cs;

      if (imageObj?.width) {
        ctx.drawImage(imageObj, x, y, cs, cs);
      } else {
        ctx.fillStyle = FILL[color];
        ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.lineWidth = Math.max(1, Math.floor(cs * 0.06));
        ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      }
    }
    ctx.restore();
  }

  function drawPlaced() {
    if (!state.placedPieces) return;
    for (const p of state.placedPieces) {
      drawBlocksAt(p.shape, p.origin, p.color, p.imageObj);
    }
  }

  /* ---------------- preview ---------------- */
  function drawPreview() {
    const dp = state.draggingPiece;
    if (!dp || !state.previewOrigin) return;

    const cs = state.cellSize;
    const origin = state.previewOrigin;
    const valid = state.previewValid;

    ctx.save();
    ctx.globalAlpha = valid ? 0.6 : 0.3;
    ctx.strokeStyle = valid ? "#000" : "#f00";
    ctx.lineWidth = Math.max(1, Math.floor(cs * 0.08));

    for (const [dx, dy] of dp.shape) {
      const x = (origin.x + dx) * cs;
      const y = (origin.y + dy) * cs;

      if (dp.imageObj?.width) {
        ctx.drawImage(dp.imageObj, x, y, cs, cs);
      } else {
        ctx.fillStyle = valid ? FILL[dp.color] : "#aaa";
        ctx.fillRect(x, y, cs, cs);
        ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      }
    }

    ctx.restore();
  }

  /* ---------------- MAIN DRAW ---------------- */
  function render(updatedState = state) {
    state = updatedState;
    ensureCanvasSize();

    drawGrid();
    drawAllStartSquares();
    drawPlaced();
    drawPreview();
  }

  return render;
}
