import { normalize } from "../utils/geometry.js";
import { boardState } from "../state/boardState.js";

export function attachCanvasInput(canvas){
  // Updates drag position
  canvas.addEventListener("mousemove", (e) => {
    if (!boardState.draggingPiece) return;
    boardState.updateDrag(e.clientX, e.clientY);
  });

  // Snap and drop piece
  canvas.addEventListener("mouseup", (e) => {
    if (!boardState.draggingPiece) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - boardState.mouseOffset.x;
    const mouseY = e.clientY - rect.top - boardState.mouseOffset.y;
    // Stabilize shape as it snaps to nearest square
    const norm = normalize(boardState.draggingPiece.shape);
    const snapX = Math.round(mouseX / boardState.cellSize);
    const snapY = Math.round(mouseY / boardState.cellSize);
    // Piece placement attempt
    boardState.dropAt(snapX, snapY, norm);
  });
  // Pick up piece already placed
  canvas.addEventListener("mousedown", (e) => {
    if (boardState.draggingPiece) return;

    const rect = canvas.getBoundingClientRect();
    const gridX = Math.floor((e.clientX - rect.left) / boardState.cellSize);
    const gridY = Math.floor((e.clientY - rect.top) / boardState.cellSize);
    // Pick up piece at position
    const picked = boardState.pickUpAt(gridX, gridY);
    if (picked) boardState.updateDrag(e.clientX, e.clientY);
  });
}
