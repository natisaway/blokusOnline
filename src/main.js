import { loadTextures } from "./textures.js";
import { createCanvasRenderer } from "./render/canvasRenderer.js";
import { renderAllPieces } from "./render/panelsRenderer.js";
import { subscribe, boardState } from "./state/boardState.js";
import { solveLayout } from "./layout/responsive.js";
import { attachCanvasInput } from "./input/dragDrop.js";
import { attachKeyboard } from "./input/keyboard.js";

(async function init() {
  // --- DOM refs ---
  const canvas = document.getElementById("board");

  const panels = {
    red: document.getElementById("red-panel"),
    blue: document.getElementById("blue-panel"),
    yellow: document.getElementById("yellow-panel"),
    green: document.getElementById("green-panel"),
  };

  const modal = document.getElementById("instructionsModal") || document.body;
  const actionBtn = document.getElementById("resetBtn"); // reused as Reset/Forfeit

  // --- Banner host & element (absolute-positioned above Blue) ---
  const host =
    panels.blue?.parentElement || canvas?.parentElement || document.body;
  if (host && getComputedStyle(host).position === "static") {
    host.style.position = "relative"; // create positioning context
  }

  let turnBanner = document.getElementById("turn-banner");
  if (!turnBanner) {
    turnBanner = document.createElement("div");
    turnBanner.id = "turn-banner";
    // Two-line content (title + hint)
    turnBanner.innerHTML = `Blue’s turn<br><span class="hint">Press Enter when done</span>`;
    host.appendChild(turnBanner); // positioned via JS
  }

  // --- Helpers ---
  const colorName = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : "");

  // Position the banner centered above the Blue panel with a 10px gap
  function positionBanner() {
    const blue = panels.blue;
    if (!blue || !turnBanner) return;

    const blueRect = blue.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();

    const gap = 10;
    const top = blueRect.top - hostRect.top - turnBanner.offsetHeight - gap;
    const left =
      blueRect.left - hostRect.left + (blueRect.width - turnBanner.offsetWidth) / 2;

    turnBanner.style.top = `${Math.round(top)}px`;
    turnBanner.style.left = `${Math.round(left)}px`;
  }

  // Forfeit button should only appear AFTER all players placed one piece
  function everyonePlacedFirst() {
    return boardState.turnOrder.every((c) => boardState.firstPlaced[c]);
  }

  function refreshActionButton() {
    if (!actionBtn) return;
    const cur = boardState.currentPlayer;

    if (everyonePlacedFirst() && boardState.firstPlaced[cur]) {
      // Show Forfeit only after round 1 is complete for ALL players
      actionBtn.textContent = "Forfeit Turn";
      actionBtn.title = "Skip the rest of your turns in this game";
      actionBtn.onclick = (e) => {
        e.preventDefault();
        boardState.forfeitCurrentPlayer();
      };
    } else {
      // Before everyone places their first piece: keep as Reset
      actionBtn.textContent = "Reset";
      actionBtn.title = "Reset the whole board";
      actionBtn.onclick = (e) => {
        e.preventDefault();
        boardState.cancelDrag?.();
        boardState.reset();
        layout();
      };
    }
  }

  // --- Input wiring ---
  attachKeyboard(modal);
  attachCanvasInput(canvas);

  // --- Renderer + textures ---
  createCanvasRenderer(canvas, boardState);
  const images = await loadTextures();

  // Panels ask us to start drags; we relay to boardState
  function startDragFromPanel(piece, clientX, clientY, offsetX, offsetY, wrapper) {
    boardState.startDrag(piece, clientX, clientY, offsetX, offsetY, wrapper);
  }

  // --- Turn highlighting + banner text/tint + action button mode ---
  function applyTurnStyles() {
    const order = ["blue", "yellow", "red", "green"];
    for (const color of order) {
      const el = panels[color];
      if (!el) continue;
      const isActive =
        color === boardState.currentPlayer && !boardState.forfeited[color];
      el.setAttribute("data-panel", "");
      el.setAttribute("data-active", isActive ? "true" : "false");
    }

    const cur = boardState.currentPlayer;
    turnBanner.innerHTML = `${colorName(cur)}’s turn<br><span class="hint">Press Enter when done</span>`;
    turnBanner.setAttribute("data-color", cur);
    positionBanner();

    refreshActionButton();
  }
  applyTurnStyles();
  subscribe(applyTurnStyles);

  // --- Layout + panel rendering ---
  let currentPieceSizes = 14;

  function layout() {
    const pack = solveLayout(canvas, panels, {
      titleEl: document.querySelector("h1"),
      buttonsEl: document.querySelector(".button-container"),
    });

    boardState.setCellSizes?.(pack.cellSize, pack.pieceSize);
    currentPieceSizes = pack.pieceSize;

    // Render panels after layout and ensure banner is placed
    requestAnimationFrame(() => {
      renderAllPieces(panels, currentPieceSizes, images, startDragFromPanel);
      positionBanner();
    });
  }

  // Re-render panels only when NOT dragging (lag guard)
  subscribe(() => {
    if (boardState.draggingPiece) return;
    renderAllPieces(panels, currentPieceSizes, images, startDragFromPanel);
    positionBanner();
  });

  // Initial wiring for the action button
  refreshActionButton();

  // --- Window resize ---
  window.addEventListener(
    "resize",
    () => {
      layout();
      positionBanner();
    },
    { passive: true }
  );

  // Initial layout
  layout();
})();
