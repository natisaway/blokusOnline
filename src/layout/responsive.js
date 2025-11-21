import { SHRINK_PERCENT } from "../constants.js";

// layout 
const MAX_COLS_PER_PIECE = 5;
const MAX_ROWS_PER_PIECE = 5;
const PANEL_TO_CELL = 0.82;
const MID_GAP = 24;
const COL_GAP = 10;
const ROW_GAP = 12;

/* computes the best piece size based on target width, height, and board cell */
function pieceSizeForGrid(targetW, targetH, cell) {
  const byBoard = cell * PANEL_TO_CELL;
  const byWidth = (targetW - COL_GAP * 6) / (7 * MAX_COLS_PER_PIECE);
  const byHeight = (targetH - ROW_GAP * 2) / (3 * MAX_ROWS_PER_PIECE);
  return Math.max(8, Math.min(byBoard, byWidth, byHeight));
}

/* responsive layout computation for board + panels */
export function solveLayout(
  canvas,
  panels = {},
  { titleEl = null, buttonsEl = null } = {}
) {
  if (!canvas) {
    console.warn("⚠️ solveLayout called before canvas exists — skipping");
    return {
      boardSize: 600,
      cellSize: 30,
      pieceSize: 20,
      panelPieceSizes: { red: 14, blue: 14, yellow: 14, green: 14 },
      metrics: { sideW: 220, sideH: 600, stripH: 110 },
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const titleH = titleEl?.offsetHeight || 42;
  const buttonsH = buttonsEl?.offsetHeight || 46;

  let lo = 300;
  let hi = Math.min(vw, vh) - 30;
  let bestPack = null;

  for (let i = 0; i < 24; i++) {
    const board = (lo + hi) / 2;
    const cell = board / 20;

    let sideW = Math.max(140, Math.min(0.22 * vw, 420));
    const sideH = board;

    // strip height
    const stripPiece = pieceSizeForGrid(Math.min(vw * 0.9, board), 9999, cell);
    const stripTilesH = 3 * MAX_ROWS_PER_PIECE * stripPiece + ROW_GAP * 2;
    const stripH = Math.max(
      stripTilesH,
      Math.max(96, Math.min(0.24 * vh, 0.26 * board))
    );

    const sidePiece = pieceSizeForGrid(sideW, sideH, cell);
    sideW = 7 * MAX_COLS_PER_PIECE * sidePiece + COL_GAP * 6;

    const totalW = board + 2 * sideW + MID_GAP;
    const totalH = titleH + stripH + board + stripH + buttonsH;

    const fits = totalW <= vw && totalH <= vh;
    if (fits) {
      bestPack = {
        boardSize: board,
        cellSize: cell,
        pieceSize: Math.max(12, cell * SHRINK_PERCENT),
        panelPieceSizes: {
          red: sidePiece,
          blue: sidePiece,
          yellow: stripPiece,
          green: stripPiece,
        },
        metrics: { sideW, sideH, stripH },
      };
      lo = board;
    } else {
      hi = board;
    }
  }

  const pack =
    bestPack || {
      boardSize: lo,
      cellSize: lo / 20,
      pieceSize: Math.max(12, (lo / 20) * SHRINK_PERCENT),
      panelPieceSizes: { red: 14, blue: 14, yellow: 14, green: 14 },
      metrics: { sideW: 220, sideH: lo, stripH: 110 },
    };

  // apply to canvas
  canvas.width = pack.boardSize;
  canvas.height = pack.boardSize;
  canvas.style.width = `${pack.boardSize}px`;
  canvas.style.height = `${pack.boardSize}px`;

  // css variables
  const root = document.documentElement.style;
  root.setProperty("--sideW", `${Math.round(pack.metrics.sideW)}px`);
  root.setProperty("--stripH", `${Math.round(pack.metrics.stripH)}px`);
  root.setProperty("--boardW", `${Math.round(pack.boardSize)}px`);

  return pack;
}
