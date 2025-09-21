import { loadTextures } from "./textures.js";
import { renderAllPieces } from "./render/panelsRenderer.js";
import { createCanvasRenderer } from "./render/canvasRenderer.js";
import { solveLayout } from "./layout/responsive.js";
import { attachCanvasInput } from "./input/dragDrop.js";
import { attachKeyboard } from "./input/keyboard.js";
import { boardState } from "./state/boardState.js";

(async function init() {
  // DOM refs
  const canvas = document.getElementById("board");
  const panels = {
    red: document.getElementById("red-panel"),
    blue: document.getElementById("blue-panel"),
    yellow: document.getElementById("yellow-panel"),
    green: document.getElementById("green-panel"),
  };

  // Modal
  const modal = document.getElementById("instructionsModal");
  document.getElementById("instructionsBtn")
    .addEventListener("click", () => (modal.style.display = "flex"));
  document.getElementById("closeModal")
    .addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // Input and rendering bootstrap
  attachKeyboard(modal);
  attachCanvasInput(canvas);
  createCanvasRenderer(canvas, boardState);

  const images = await loadTextures();

  // Drag helper
  function startDragFromPanel(piece, clientX, clientY, offsetX, offsetY, wrapper) {
    boardState.startDrag(piece, clientX, clientY, offsetX, offsetY, wrapper);
  }

  // Layout and first render
  function layout() {
    // compute sizes, apply canvas, update state
    const pack = solveLayout(canvas, panels, {
      titleEl: document.querySelector("h1"),
      buttonsEl: document.querySelector(".button-container"),
    });
    boardState.setCellSizes(pack.cellSize, pack.pieceSize);

    // render after size applies
    requestAnimationFrame(() => {
      renderAllPieces(panels, pack.panelPieceSizes, images, startDragFromPanel);
    });
  }

  // Events
  window.addEventListener("resize", layout, { passive: true });
  document.getElementById("resetBtn").addEventListener("click", () => {
    boardState.reset();
    layout();
  });

  layout(); // initial

  // ensure unfinished drags return to panel
  window.addEventListener("mouseup", () => {
    if (boardState.draggingPiece) boardState.cancelDrag();
  });
})();
