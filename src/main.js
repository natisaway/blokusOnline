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
    turnBanner.innerHTML = `Blue’s turn<br><span class="hint">Press Enter when done</span>`;
    host.appendChild(turnBanner);
  }

  // --- Instructions modal helpers ---
  const modalSeenKey = "blokus.instructions.seen";
  const modalEl = document.getElementById("instructionsModal");

  function openInstructions() {
    if (!modalEl) return;
    modalEl.removeAttribute("hidden");
    modalEl.setAttribute("aria-hidden", "false");
    modalEl.style.display = "flex"; // matches CSS centering (flexbox)
  }

  function closeInstructions() {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.style.display = "none";
    modalEl.setAttribute("hidden", "");
    try { localStorage.setItem(modalSeenKey, "1"); } catch {}
  }

  (function ensureInstructionsOnce() {
    if (!modalEl) return;

    // open on first visit
    let seen = "0";
    try { seen = localStorage.getItem(modalSeenKey) || "0"; } catch {}
    if (seen !== "1") openInstructions();

    // close button
    const closeBtn =
      modalEl.querySelector("[data-close]") ||
      modalEl.querySelector(".close") ||
      modalEl.querySelector("button");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeInstructions();
      });
    }

    // click backdrop to close
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) closeInstructions();
    });

    // wire footer/toolbar button to always open
    document.getElementById("instructionsBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      openInstructions();
    });
  })();

  // --- Helpers ---
  const colorName = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : "");

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

  function everyonePlacedFirst() {
    return boardState.turnOrder.every((c) => boardState.firstPlaced[c]);
  }

  function refreshActionButton() {
    if (!actionBtn) return;
    const cur = boardState.currentPlayer;

    if (everyonePlacedFirst() && boardState.firstPlaced[cur]) {
      actionBtn.textContent = "Forfeit Turn";
      actionBtn.title = "Skip the rest of your turns in this game";
      actionBtn.onclick = (e) => {
        e.preventDefault();
        boardState.forfeitCurrentPlayer();
      };
    } else {
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
  attachKeyboard(openInstructions, closeInstructions); // R/F/V/Enter + ?/I + Esc
  attachCanvasInput(canvas);

  // --- Renderer + textures ---
  createCanvasRenderer(canvas, boardState);
  const images = await loadTextures();

  function startDragFromPanel(piece, clientX, clientY, offsetX, offsetY, wrapper) {
    boardState.startDrag(piece, clientX, clientY, offsetX, offsetY, wrapper);
  }

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

    requestAnimationFrame(() => {
      renderAllPieces(panels, currentPieceSizes, images, startDragFromPanel);
      positionBanner();
    });
  }

  subscribe(() => {
    if (boardState.draggingPiece) return;
    renderAllPieces(panels, currentPieceSizes, images, startDragFromPanel);
    positionBanner();
  });

  refreshActionButton();

  window.addEventListener(
    "resize",
    () => {
      layout();
      positionBanner();
    },
    { passive: true }
  );

  layout();
})();
