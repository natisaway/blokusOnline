import { BOARD_SIZE } from "../constants.js";
import { boardState } from "./boardState.js";

export function isValidPlacement(piece, color, board, x, y) {
  const tiles = piece.tiles || piece; 
  let touchesCorner = false;

  for (const t of tiles) {
    const gx = x + t.x ?? x + t[0];
    const gy = y + t.y ?? y + t[1];

  /* ---------------- out of bounds check ---------------- */
  if (gx < 0 || gy < 0 || gx >= BOARD_SIZE || gy >= BOARD_SIZE) {
      return false;
    }

    const existing = board[gy][gx];
    if (existing) return false; // overlap

  /* ---------------- check neighboring cells ---------------- */
  const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const corners = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

  /* ---------------- edges for same color do not touch---------------- */
  for (const [dx, dy] of dirs) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < BOARD_SIZE &&
        ny < BOARD_SIZE &&
        board[ny][nx] === color
      ) {
        return false;
      }
    }

  /* ---------------- corner to corner requirement after 1st move ---------------- */
  for (const [dx, dy] of corners) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < BOARD_SIZE &&
        ny < BOARD_SIZE &&
        board[ny][nx] === color
      ) {
        touchesCorner = true;
      }
    }
  }

  /* ---------------- expectation for first move ---------------- */
  const firstMove = !boardState.placedPieces.some((p) => p.color === color);
  if (firstMove) {
    const start = boardState.startPoint[color];
    return tiles.some((t) => x + (t.x ?? t[0]) === start.x && y + (t.y ?? t[1]) === start.y);
  }

  /* ---------------- then corner requirement after 1st move ---------------- */
  return touchesCorner;
}
export { isValidPlacement as canPlace };
