import { BOARD_SIZE } from "../constants.js";
import { bounds, normalize } from "../utils/geometry.js";

// Initializes canvas 
export function createCanvasRenderer(canvas, state) {
  const ctx = canvas.getContext("2d");

  // Draws the empty grid lines on the board
  function drawGrid() {
    ctx.strokeStyle = "#ccc";
    for (let i = 0; i <= BOARD_SIZE; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * state.cellSize, 0);
      ctx.lineTo(i * state.cellSize, BOARD_SIZE * state.cellSize);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * state.cellSize);
      ctx.lineTo(BOARD_SIZE * state.cellSize, i * state.cellSize);
      ctx.stroke();
    }
  }

  //  Draws all placed pieces on the board
  function drawPlaced() {
    state.placedPieces.forEach((piece, idx) => {
      piece.shape.forEach(([dx, dy]) => {
        const x = (piece.origin.x + dx) * state.cellSize;
        const y = (piece.origin.y + dy) * state.cellSize;

      
        ctx.drawImage(
          piece.imageObj,
          0, 0, piece.imageObj.width, piece.imageObj.height,
          x, y, state.cellSize, state.cellSize
        );

        ctx.strokeStyle = "#000";
        ctx.strokeRect(x, y, state.cellSize, state.cellSize);
      });

      if (state.highlightedIndex === idx) {
        const b = bounds(piece.shape);
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          piece.origin.x * state.cellSize,
          piece.origin.y * state.cellSize,
          (b.maxX - b.minX + 1) * state.cellSize,
          (b.maxY - b.minY + 1) * state.cellSize
        );
        ctx.lineWidth = 1;
      }
    });
  }

  //  Renders the piece currently being dragged
  function drawDragging() {
    const dp = state.draggingPiece;
    if (!dp) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = state.dragPos.x - rect.left - state.mouseOffset.x;
    const mouseY = state.dragPos.y - rect.top - state.mouseOffset.y;
    const norm = normalize(dp.shape);

    norm.forEach(([dx, dy]) => {
      const x = mouseX + dx * state.cellSize;
      const y = mouseY + dy * state.cellSize;

      ctx.drawImage(
        dp.imageObj,
        0, 0, dp.imageObj.width, dp.imageObj.height,
        x, y, state.cellSize, state.cellSize
      );


      ctx.strokeStyle = "#000";
      ctx.strokeRect(x, y, state.cellSize, state.cellSize);
    });
  }

  // Clears and redraws everything
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawPlaced();
    drawDragging();
    requestAnimationFrame(frame);
  }

  // Start the animation loop
  requestAnimationFrame(frame);
}
