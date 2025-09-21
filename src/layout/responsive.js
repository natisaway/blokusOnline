// /src/layout/responsive.js
// Solve the layout so everything fits *without scrollbars* and the board is
// sandwiched between Yellow (top) and Green (bottom); Red/Blue centered at sides.

import { SHRINK_PERCENT } from "../constants.js";

/* Tuning constants (keep in sync with CSS comments if you change) */
const MAX_COLS_PER_PIECE = 5;
const MAX_ROWS_PER_PIECE = 5;
const PANEL_TO_CELL = 0.82; // visual proportion of panel tile vs board cell
const MID_GAP = 24;         // must match CSS --midGap
const COL_GAP = 10;         // must match .piece-grid column-gap
const ROW_GAP = 12;         // must match .piece-grid row-gap

function pieceSizeForGrid(targetW, targetH, cell) {
  const byBoard  = cell * PANEL_TO_CELL;
  const byWidth  = (targetW - (COL_GAP * 6)) / (7 * MAX_COLS_PER_PIECE);
  const byHeight = (targetH - (ROW_GAP * 2)) / (3 * MAX_ROWS_PER_PIECE);
  return Math.max(8, Math.min(byBoard, byWidth, byHeight));
}

/**
 * Solve to fit viewport with no scrollbars.
 * Returns board & per-panel sizes and also pushes CSS vars --sideW, --stripH, --boardW.
 */
export function solveLayout(canvas, panels, { titleEl, buttonsEl }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const titleH   = titleEl?.offsetHeight   || 42;
  const buttonsH = buttonsEl?.offsetHeight || 46;

  let lo = 300;
  let hi = Math.min(vw, vh) - 30; // reserve some buffer
  let bestPack = null;

  for (let i = 0; i < 24; i++) {
    const board = (lo + hi) / 2;
    const cell  = board / 20;

    let sideW   = Math.max(140, Math.min(0.22 * vw, 420));
    const sideH = board;
    
    const stripPiece = pieceSizeForGrid(Math.min(vw * 0.9, board), 9999, cell); // temp strip height
    const stripTilesH = 3 * MAX_ROWS_PER_PIECE * stripPiece + (ROW_GAP * 2);
    const stripH = Math.max(stripTilesH, Math.max(96, Math.min(0.24 * vh, 0.26 * board)));

    const sidePiece = pieceSizeForGrid(sideW, sideH, cell);
    sideW = 7 * MAX_COLS_PER_PIECE * sidePiece + (COL_GAP * 6);

    const totalW = board + 2 * sideW + MID_GAP;
    const totalH = titleH + stripH + board + stripH + buttonsH;

    const fits = totalW <= vw && totalH <= vh;
    if (fits) {
      bestPack = {
        boardSize: board,
        cellSize: cell,
        pieceSize: Math.max(12, cell * SHRINK_PERCENT),
        panelPieceSizes: {
          red: sidePiece, blue: sidePiece, yellow: stripPiece, green: stripPiece
        },
        metrics: { sideW, sideH, stripH }
      };
      lo = board;
    } else {
      hi = board;
    }
  }

  const pack = bestPack || {
    boardSize: lo,
    cellSize: lo / 20,
    pieceSize: Math.max(12, (lo / 20) * SHRINK_PERCENT),
    panelPieceSizes: { red: 14, blue: 14, yellow: 14, green: 14 },
    metrics: { sideW: 220, sideH: lo, stripH: 110 }
  };

  // Apply to canvas
  canvas.width = pack.boardSize;
  canvas.height = pack.boardSize;

  // IMPORTANT: Apply visible size too so CSS layout knows
  canvas.style.width = `${pack.boardSize}px`;
  canvas.style.height = `${pack.boardSize}px`;

  // Update CSS variables
  const root = document.documentElement.style;
  root.setProperty("--sideW", `${Math.round(pack.metrics.sideW)}px`);
  root.setProperty("--stripH", `${Math.round(pack.metrics.stripH)}px`);
  root.setProperty("--boardW", `${Math.round(pack.boardSize)}px`);

  return pack;
}
