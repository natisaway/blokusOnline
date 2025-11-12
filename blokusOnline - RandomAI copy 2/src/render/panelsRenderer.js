// src/render/panelsRenderer.js
import { boardState } from "../state/boardState.js";

export function renderAllPieces(panels, pieceSize, textures = {}, startDrag = () => {}) {
  const colors = ["yellow", "red", "blue", "green"];

  colors.forEach((color) => {
    const panel = panels[color];
    if (!panel) return;

    panel.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "piece-grid";
    if (color === "yellow" || color === "green") grid.style.paddingBottom = "18px";
    panel.appendChild(grid);

    const available = boardState.availablePieces[color] || [];
    for (const [index, shape] of available.entries()) {
      const pieceWrapper = document.createElement("div");
      pieceWrapper.className = "piece-wrapper";
      pieceWrapper.dataset.piece = JSON.stringify(shape);

      const textureImg = textures?.[color] || null;
      const canvas = createPieceCanvas(shape, pieceSize, color, textureImg);
      pieceWrapper.appendChild(canvas);

      pieceWrapper.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDrag({ shape, color, imageObj: textureImg, source: "panel" },
          e.clientX, e.clientY, 8, 8, panel);
      });

      pieceWrapper.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        if (!t) return;
        startDrag({ shape, color, imageObj: textureImg, source: "panel" },
          t.clientX, t.clientY, 8, 8, panel);
      });

      grid.appendChild(pieceWrapper);
    }
  });
}

export function createPieceCanvas(shape, cellSize, color, textureImg) {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const pad = 2;

  const canvas = document.createElement("canvas");
  canvas.width = cols * cellSize + pad * 2;
  canvas.height = rows * cellSize + pad * 2;
  const ctx = canvas.getContext("2d");

  for (const [x, y] of shape) {
    const dx = (x - minX) * cellSize + pad;
    const dy = (y - minY) * cellSize + pad;

    if (textureImg?.width) {
      ctx.drawImage(textureImg, dx, dy, cellSize, cellSize);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, cellSize, cellSize);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, cellSize, cellSize);
    }
  }

  return canvas;
}
