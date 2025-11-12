import { BOARD_SIZE } from "../constants.js";
import { boardState } from "./boardState.js";


/**
 * Check whether a proposed placement of a piece is valid according to Blokus rules.
 * - Must stay within board bounds.
 * - Must not overlap existing tiles.
 * - Must not touch same-color tiles edge-to-edge.
 * - Must touch at least one same-color tile at a corner (except on first move).
 */
export function isValidPlacement(piece, color, board, x, y) {
  const tiles = piece.tiles || piece; // Support both piece objects and plain shape arrays
  let touchesCorner = false;

  for (const t of tiles) {
    const gx = x + t.x ?? x + t[0];
    const gy = y + t.y ?? y + t[1];

    // --- 1️⃣ Out of bounds check ---
    if (gx < 0 || gy < 0 || gx >= BOARD_SIZE || gy >= BOARD_SIZE) {
      return false;
    }

    const existing = board[gy][gx];
    if (existing) return false; // overlap

    // --- 2️⃣ Check neighboring cells ---
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

    // Edge adjacency forbidden for same color
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

    // Corner adjacency required (for later moves)
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

  // --- 3️⃣ First-move exception ---
  const firstMove = !boardState.placedPieces.some((p) => p.color === color);
  if (firstMove) {
    const start = boardState.startPoint[color];
    return tiles.some((t) => x + (t.x ?? t[0]) === start.x && y + (t.y ?? t[1]) === start.y);
  }

  // --- 4️⃣ Must touch corner (after first move) ---
  return touchesCorner;
}

// Keep legacy compatibility
export { isValidPlacement as canPlace };
