
import { boardState } from "../state/boardState.js";
/**
 * Render all panels.
 * @param {{yellow:HTMLElement, red:HTMLElement, blue:HTMLElement, green:HTMLElement}} panels
 * @param {number|Object} pieceSizes - single number or per-color map
 * @param {{yellow:HTMLImageElement, red:HTMLImageElement, blue:HTMLImageElement, green:HTMLImageElement}} images
 * @param {(piece, clientX:number, clientY:number, offsetX:number, offsetY:number, wrapperEl:HTMLElement)=>void} startDrag
 */
export function renderAllPieces(panels, pieceSizes, images, startDrag) {
  // Clear targets
  Object.values(panels).forEach((el) => (el.innerHTML = ""));

  ["yellow", "red", "blue", "green"].forEach((color) => {
    const panel = panels[color];
    if (!panel) return;

    // Panel content grid 
    const grid = document.createElement("div");
    grid.className = "piece-grid";

    // Ensure last row never clips
    if (color === "yellow" || color === "green") {
      grid.style.paddingBottom = "18px";
    }

    panel.appendChild(grid);

    const size =
      typeof pieceSizes === "number" ? pieceSizes : (pieceSizes[color] ?? 14);

    // Render only available shapes
    const list = (boardState.availablePieces?.[color] || []);
    list.forEach((shape, index) => {
      const wrapper = createPieceCanvas(
        { id: `${color}-${index}`, shape, color, imageObj: images[color] },
        size,
        startDrag
      );
      grid.appendChild(wrapper);
    });
  });
}

// canvas tile for a single shape
function createPieceCanvas(piece, pieceSize, startDrag) {
  const { shape, color, imageObj } = piece;

  // Compute bounding box
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const padding = 2;
  const w = cols * pieceSize + padding * 2;
  const h = rows * pieceSize + padding * 2;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.setAttribute("draggable", "false"); 

  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // draw each cell
  shape.forEach(([x, y]) => {
    const dx = (x - minX) * pieceSize + padding;
    const dy = (y - minY) * pieceSize + padding;

    if (imageObj) {
      ctx.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, dx, dy, pieceSize, pieceSize);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, pieceSize, pieceSize);
      ctx.strokeStyle = "#000";
      ctx.strokeRect(dx, dy, pieceSize, pieceSize);
    }
  });

  // wrapper so we can hide/show while placed
  const wrapper = document.createElement("div");
  wrapper.className = "piece-wrapper";
  wrapper.style.margin = "2px";
  wrapper.dataset.pieceId = piece.id;
  wrapper.appendChild(c);

  // Begin drag from panel
  c.addEventListener("mousedown", (e) => {
    e.preventDefault();      
    e.stopPropagation();     

    startDrag(
      {
        id: piece.id,
        shape: piece.shape.map(([x, y]) => [x, y]),
        imageObj: piece.imageObj,
        color: piece.color,
        currentRotation: 0,
      },
      e.clientX,
      e.clientY,
      e.offsetX,
      e.offsetY,
      wrapper
    );
  });

  return wrapper;
}
