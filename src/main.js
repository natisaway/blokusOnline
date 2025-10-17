// src/main.js
import { loadTextures } from "./textures.js";
import { createCanvasRenderer } from "./render/canvasRenderer.js";
import { renderAllPieces } from "./render/panelsRenderer.js";
import { subscribe, boardState } from "./state/boardState.js";
import { solveLayout } from "./layout/responsive.js";
import { attachCanvasInput } from "./input/dragDrop.js";
import { attachKeyboard } from "./input/keyboard.js";
import { initScoreCounter } from "./state/scoreCounter.js";
import { initGameOverModal } from "./state/gameOverModal.js";

(async function init() {
  // --- DOM refs ---
  const canvas = document.getElementById("board");

  const panels = {
    red: document.getElementById("red-panel"),
    blue: document.getElementById("blue-panel"),
    yellow: document.getElementById("yellow-panel"),
    green: document.getElementById("green-panel"),
  };

  const actionBtn = document.getElementById("resetBtn"); // now forfeit only

  // --- Banner host & element ---
  const host =
    panels.blue?.parentElement || canvas?.parentElement || document.body;
  if (host && getComputedStyle(host).position === "static") {
    host.style.position = "relative";
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
    modalEl.style.display = "flex";
  }

  function closeInstructions() {
    if (!modalEl) return;
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.style.display = "none";
    modalEl.setAttribute("hidden", "");
    try { localStorage.setItem(modalSeenKey, "1"); } catch {}
  }

  function bindInstructionTriggers() {
    const clickOpen = (e) => { e.preventDefault(); openInstructions(); };
    const direct =
      document.getElementById("instructionsBtn") ||
      document.querySelector('[data-open="instructions"]') ||
      Array.from(document.querySelectorAll("button, a")).find((el) => {
        const t = (el.textContent || "").trim();
        const id = el.id || "";
        const cls = el.className || "";
        return /instructions/i.test(t) || /instruction/i.test(id) || /instruction/i.test(cls);
      });

    if (direct && !direct.__instrBound) {
      direct.addEventListener("click", clickOpen);
      direct.__instrBound = true;
    }

    if (!document.__instrDelegated) {
      document.addEventListener("click", (e) => {
        const el = e.target.closest("button, a");
        if (!el) return;
        const t = (el.textContent || "").trim();
        const id = el.id || "";
        const cls = el.className || "";
        if (/instructions/i.test(t) || /instruction/i.test(id) || /instruction/i.test(cls)) {
          e.preventDefault();
          openInstructions();
        }
      });
      document.__instrDelegated = true;
    }
  }

  (function ensureInstructionsOnce() {
    if (!modalEl) return;
    let seen = "0";
    try { seen = localStorage.getItem(modalSeenKey) || "0"; } catch {}
    if (seen !== "1") openInstructions();

    const closeBtn =
      modalEl.querySelector("[data-close]") ||
      modalEl.querySelector(".close") ||
      modalEl.querySelector("button.close");
    if (closeBtn && !closeBtn.__instrCloseBound) {
      closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeInstructions(); });
      closeBtn.__instrCloseBound = true;
    }

    if (!modalEl.__instrBackdropBound) {
      modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) closeInstructions();
      });
      modalEl.__instrBackdropBound = true;
    }
  })();

  bindInstructionTriggers();
  document.addEventListener("DOMContentLoaded", bindInstructionTriggers);

  // --- Keyboard wiring ---
  attachKeyboard(openInstructions, closeInstructions);

  // --- Helpers ---
  const colorName = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : "");

  // Position the banner centered above Blue panel
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

  // --- Action Button (Forfeit Only) ---
  function refreshActionButton() {
    if (!actionBtn) return;
    const cur = boardState.currentPlayer;

    actionBtn.textContent = "Forfeit Turn";
    actionBtn.title = "End your participation for the rest of the game";
    actionBtn.onclick = (e) => {
      e.preventDefault();
      boardState.forfeitCurrentPlayer();
    };
  }

  // --- Input wiring ---
  attachCanvasInput(canvas);

  // --- Renderer + textures ---
  createCanvasRenderer(canvas, boardState);
  const images = await loadTextures();

  // Panels ask to start drags
  function startDragFromPanel(piece, clientX, clientY, offsetX, offsetY, wrapper) {
    boardState.startDrag(piece, clientX, clientY, offsetX, offsetY, wrapper);
  }

  // --- Turn highlighting + banner ---
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

  // --- Initialize everything ---
  layout();
  initScoreCounter();
  initGameOverModal(); // 🎉 show modal when all forfeited
})();
