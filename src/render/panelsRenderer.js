import { BASE_PIECES } from "../pieces.js";

// Renders all pieces
export function renderAllPieces(panels, pieceSizes, images, startDrag) {
  // Clear all panels before re-rendering
  Object.values(panels).forEach(p => (p.innerHTML = ""));

  ["yellow", "red", "blue", "green"].forEach(color => {
    const panel = panels[color]; 

    // Create a container grid for the pieces
    const grid = document.createElement("div");
    grid.className = "piece-grid";
    panel.appendChild(grid);

    const size = typeof pieceSizes === "number" ? pieceSizes : (pieceSizes[color] ?? 14);

    BASE_PIECES.forEach(shape => {
      const pieceCanvas = renderPieceCanvas(shape, color, size, images, startDrag);
      grid.appendChild(pieceCanvas);
    });
  });
}


function renderPieceCanvas(shape, color, pieceSize, images, startDrag) {
  // Determine dimensions needed for canvas
  const cols = Math.max(...shape.map(c => c[0])) + 1;
  const rows = Math.max(...shape.map(c => c[1])) + 1;

  // Create canvas element and size it to fit the shape
  const c = document.createElement("canvas");
  c.width = Math.max(1, cols * pieceSize);
  c.height = Math.max(1, rows * pieceSize);
  c.setAttribute("draggable", "false");

  const ctx = c.getContext("2d");

  // Draw each square of the piece
  shape.forEach(([x, y]) => {
    const dx = x * pieceSize;
    const dy = y * pieceSize;

    ctx.fillStyle = "#fafafa";
    ctx.fillRect(dx, dy, pieceSize, pieceSize);

    const img = images[color];
    if (img && img.width && img.height) {
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, pieceSize, pieceSize);
    }

    ctx.strokeStyle = "#000";
    ctx.strokeRect(dx, dy, pieceSize, pieceSize);
  });

  // Create a wrapper div around the canvas
  const wrapper = document.createElement("div");
  wrapper.className = "piece-wrapper";
  wrapper.style.margin = "2px";
  wrapper.appendChild(c);

  // Handle mouse to start dragging piece
  c.addEventListener("mousedown", e => {
    startDrag(
      {
        shape: shape.map(([x, y]) => [x, y]), 
        imageObj: images[color],
        color,
        currentRotation: 0
      },
      e.clientX, e.clientY, e.offsetX, e.offsetY,
      wrapper 
    );
  });

  return wrapper;
}
