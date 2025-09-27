// src/main.js
import { loadTextures } from "./textures.js";
import { createCanvasRenderer } from "./render/canvasRenderer.js";
import { renderAllPieces } from "./render/panelsRenderer.js";
import { subscribe, boardState } from "./state/boardState.js";
import { solveLayout } from "./layout/responsive.js";
import { attachCanvasInput } from "./input/dragDrop.js";
import { attachKeyboard } from "./input/keyboard.js";

(async function init() {
  //DOM refs
  const canvas = document.getElementById("board");
  const panels = {
    red: document.getElementById("red-panel"),
    blue: document.getElementById("blue-panel"),
    yellow: document.getElementById("yellow-panel"),
    green: document.getElementById("green-panel"),
  };

  //modal
  const modal = document.getElementById("instructionsModal");
  document.getElementById("instructionsBtn")
    .addEventListener("click", () => (modal.style.display = "flex"));
  document.getElementById("closeModal")
    .addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  //input and board renderer
  attachKeyboard(modal);
  attachCanvasInput(canvas);           
  createCanvasRenderer(canvas, boardState);

  const images = await loadTextures();

  function startDragFromPanel(piece, clientX, clientY, offsetX, offsetY, wrapper) {
    boardState.startDrag(piece, clientX, clientY, offsetX, offsetY, wrapper);
  }
  let currentPieceSizes = 14;
  // Layout and first render
  function layout() {
    const pack = solveLayout(canvas, panels, {
      titleEl: document.querySelector("h1"),
      buttonsEl: document.querySelector(".button-container"),
    });
    if (typeof boardState.setCellSizes === "function") {
      boardState.setCellSizes(pack.cellSize, pack.pieceSize);
    }
    currentPieceSizes = pack.pieceSize;
    requestAnimationFrame(() => {
      renderAllPieces(panels, currentPieceSizes, images, startDragFromPanel);
    });
  }
  subscribe(() => renderAllPieces(panels, currentPieceSizes, images, startDragFromPanel));

  layout(); 
})();
