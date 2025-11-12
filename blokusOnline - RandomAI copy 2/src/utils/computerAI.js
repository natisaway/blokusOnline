// src/utils/computerAI.js
import { boardState } from "../state/boardState.js";
import { BOARD_SIZE } from "../constants.js";
import { isValidPlacement } from "../state/boardRules.js";

/**
 * =============================================
 * BLENDED AI SYSTEM (Randomized & Optimized)
 * =============================================
 *  - Yellow: MinMax (heuristic search)
 *  - Red: Greedy (best immediate placement)
 *  - Green: Defensive (corner-based with randomness)
 *  - Blue: Human player
 *  Adds randomness so AI games differ every run.
 */

// --- Utility ---
function cloneBoardMatrix() {
  const b = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null)
  );
  for (const piece of boardState.placedPieces) {
    for (const [dx, dy] of piece.shape) {
      const gx = piece.origin.x + dx;
      const gy = piece.origin.y + dy;
      if (gx >= 0 && gy >= 0 && gx < BOARD_SIZE && gy < BOARD_SIZE) {
        b[gy][gx] = piece.color;
      }
    }
  }
  return b;
}

// --- Heuristic scoring ---
function scoreBoard(color, board) {
  let myCount = 0;
  let openCorners = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === color) myCount++;
      if (board[y][x] == null) {
        const dirs = [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ];
        for (const [dx, dy] of dirs) {
          const nx = x + dx,
            ny = y + dy;
          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < BOARD_SIZE &&
            ny < BOARD_SIZE &&
            board[ny][nx] === color
          ) {
            openCorners++;
            break;
          }
        }
      }
    }
  }
  return myCount + openCorners * 0.3;
}

// --- Find all valid moves (randomized order) ---
function findAllValidMoves(color) {
  const board = cloneBoardMatrix();
  const available = [...(boardState.availablePieces[color] || [])];
  const moves = [];

  // 🔀 Shuffle available pieces to make AI less deterministic
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  for (const shape of available) {
    // Randomize search direction
    const yOrder =
      Math.random() > 0.5
        ? [...Array(BOARD_SIZE).keys()]
        : [...Array(BOARD_SIZE).keys()].reverse();
    const xOrder =
      Math.random() > 0.5
        ? [...Array(BOARD_SIZE).keys()]
        : [...Array(BOARD_SIZE).keys()].reverse();

    for (const y of yOrder) {
      for (const x of xOrder) {
        const pieceObj = { tiles: shape.map(([dx, dy]) => ({ x: dx, y: dy })) };
        if (isValidPlacement(pieceObj, color, board, x, y)) {
          moves.push({ shape, x, y });
        }
      }
    }
  }

  // Randomize final move order for tie-breaking
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }

  return moves;
}

// --- Simulate placement ---
function simulatePlacement(board, move, color) {
  const newBoard = board.map((r) => [...r]);
  for (const [dx, dy] of move.shape) {
    const gx = move.x + dx;
    const gy = move.y + dy;
    if (gx >= 0 && gy >= 0 && gx < BOARD_SIZE && gy < BOARD_SIZE)
      newBoard[gy][gx] = color;
  }
  return newBoard;
}

// --- Pick one of the top few moves at random ---
function pickRandomTop(moves, scores, topN = 3) {
  const combined = moves.map((m, i) => ({ move: m, score: scores[i] }));
  combined.sort((a, b) => b.score - a.score);
  const topMoves = combined.slice(0, Math.min(topN, combined.length));
  const choice = topMoves[Math.floor(Math.random() * topMoves.length)];
  return choice.move;
}

/* =====================================================
   STRATEGY 1: YELLOW (MinMax with small random bias)
===================================================== */
function minmax(color, depth = 2, alpha = -Infinity, beta = Infinity) {
  const board = cloneBoardMatrix();

  function maximize(b, d, a, be) {
    if (d === 0) return scoreBoard(color, b);
    let value = -Infinity;
    const moves = findAllValidMoves(color);
    for (const move of moves) {
      const newB = simulatePlacement(b, move, color);
      const score = minimize(newB, d - 1, a, be);
      value = Math.max(value, score);
      a = Math.max(a, value);
      if (a >= be) break;
    }
    return value;
  }

  function minimize(b, d, a, be) {
    if (d === 0) return scoreBoard(color, b);
    let value = Infinity;
    const oppColors = ["red", "green", "blue", "yellow"].filter(
      (c) => c !== color
    );
    for (const opp of oppColors) {
      const moves = findAllValidMoves(opp);
      for (const move of moves) {
        const newB = simulatePlacement(b, move, opp);
        const score = maximize(newB, d - 1, a, be);
        value = Math.min(value, score);
        be = Math.min(be, value);
        if (a >= be) break;
      }
    }
    return value;
  }

  const allMoves = findAllValidMoves(color);
  if (!allMoves.length) return null;

  const evaluations = allMoves.map((move) => {
    const sim = simulatePlacement(board, move, color);
    const val = minimize(sim, depth - 1, alpha, beta);
    // Random bias for tie-breaking
    return val + Math.random() * 0.4;
  });

  return pickRandomTop(allMoves, evaluations, 2);
}

/* =====================================================
   STRATEGY 2: RED (Greedy with tie-break randomness)
===================================================== */
function greedy(color) {
  const board = cloneBoardMatrix();
  const moves = findAllValidMoves(color);
  if (!moves.length) return null;

  const scores = moves.map((m) => {
    const sim = simulatePlacement(board, m, color);
    return scoreBoard(color, sim) + Math.random() * 0.4;
  });

  return pickRandomTop(moves, scores, 3);
}

/* =====================================================
   STRATEGY 3: GREEN (Defensive with random variety)
===================================================== */
function defensive(color) {
  const board = cloneBoardMatrix();
  const moves = findAllValidMoves(color);
  if (!moves.length) return null;

  const start = boardState.startPoint[color];

  function evaluate(move) {
    const sim = simulatePlacement(board, move, color);
    let score = 0;
    const dist = Math.hypot(move.x - start.x, move.y - start.y);
    const turnCount = boardState.placedPieces.filter(
      (p) => p.color === color
    ).length;
    const cornerWeight = turnCount < 5 ? 0.6 : 0.3;
    score -= dist * cornerWeight;
    const pieceSize = move.shape.length;
    score += pieceSize * 3.0;
    score += scoreBoard(color, sim) * 0.4;

    // Randomly alter behavior a little
    score += (Math.random() - 0.5) * 3;

    let crowdPenalty = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = move.x + dx,
          gy = move.y + dy;
        if (gx >= 0 && gy >= 0 && gx < BOARD_SIZE && gy < BOARD_SIZE) {
          const cell = board[gy][gx];
          if (cell && cell !== color) crowdPenalty += 1;
        }
      }
    }
    score -= crowdPenalty * 0.6;
    if (
      move.x < 0 ||
      move.y < 0 ||
      move.x >= BOARD_SIZE - 4 ||
      move.y >= BOARD_SIZE - 4
    )
      score -= 1.0;

    return score;
  }

  const scored = moves.map((m) => ({ m, s: evaluate(m) }));
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(Math.random() * top.length)].m;
}

/* =====================================================
   STRATEGY 4: BLUE (Local / Human)
===================================================== */
function skip() {
  return null;
}

/* =====================================================
   MAIN AI DISPATCH
===================================================== */
export function aiPlayByStyle(color) {
  if (boardState.isLocal(color)) return false;
  const textures = boardState.textures || {};
  const image = textures[color];

  let move = null;
  switch (color) {
    case "yellow":
      move = minmax(color, 2);
      break;
    case "red":
      move = greedy(color);
      break;
    case "green":
      move = defensive(color);
      break;
    default:
      move = skip();
      break;
  }

  if (!move) {
    console.warn(`${color} has no valid move.`);
    return false;
  }

  const success = boardState.dropAt(move.x, move.y, move.shape, image);
  if (success)
    console.log(`🤖 ${color} placed at (${move.x}, ${move.y})`);
  else console.warn(`${color} failed to place a piece.`);
  return success;
}

export { aiPlayByStyle as aiTakeTurn };
