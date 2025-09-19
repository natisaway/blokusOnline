const BOARD_SIZE = 20;
const PIECE_SCALE = 1.15;
const shrinkPercent = 0.3 * PIECE_SCALE;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

// Panels
const panels = {
  red: document.getElementById("red-panel"),
  blue: document.getElementById("blue-panel"),
  yellow: document.getElementById("yellow-panel"),
  green: document.getElementById("green-panel")
};

// Board state
let placedPieces = [];
let draggingPiece = null;
let dragPos = { x: 0, y: 0 };
let mouseOffset = { x: 0, y: 0 };
let draggingWrapper = null;
let highlightedPieceIndex = null;

// Load textures
const textures = {
  red: "images/piece4.PNG",
  blue: "images/piece2.PNG",
  yellow: "images/piece3.PNG",
  green: "images/piece1.PNG"
};
const images = {};
let loadedCount = 0;
for (const key in textures) {
  images[key] = new Image();
  images[key].src = textures[key];
  images[key].onload = () => {
    loadedCount++;
    if (loadedCount === Object.keys(textures).length) onResize();
  };
}

// Shapes
const basePieces = [
  [[0,0]], [[0,0],[1,0]], [[0,0],[1,0],[2,0]], [[0,0],[0,1],[1,0]],
  [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[1,0],[1,1],[2,1]], [[0,0],[1,0],[2,0],[1,1]], [[0,0],[1,0],[2,0],[3,0],[4,0]],
  [[0,0],[0,1],[0,2],[0,3],[1,0]], [[0,0],[2,0],[0,1],[1,1],[2,1]], [[0,0],[0,1],[0,2],[1,0],[2,0]],
  [[0,0],[1,0],[1,1],[2,1],[2,2]], [[0,0],[1,0],[1,1],[2,1],[3,1]], [[0,0],[1,0],[0,1],[1,1],[2,0]],
  [[0,0],[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[2,1],[1,2]], [[1,0],[2,0],[0,1],[1,1],[1,2]],
  [[0,0],[1,0],[2,0],[1,1],[1,2]], [[0,0],[1,0],[2,0],[3,0],[2,1]]
];

// Responsive sizing
function calculateSizes() {
  const topHeight = panels.yellow.offsetHeight || 100;
  const bottomHeight = panels.green.offsetHeight || 100;
  const sideWidth = Math.max(panels.red.offsetWidth || 150, panels.blue.offsetWidth || 150);
  const buffer = 40;
  const availableHeight = window.innerHeight - topHeight - bottomHeight - buffer;
  const availableWidth = window.innerWidth - sideWidth * 2 - buffer;
  const boardSizePx = Math.min(availableHeight, availableWidth);
  canvas.width = boardSizePx;
  canvas.height = boardSizePx;
  window.CELL_SIZE = boardSizePx / BOARD_SIZE;
  window.PIECE_SIZE = window.CELL_SIZE * shrinkPercent;
}

// Render all pieces in panels
function renderAllPieces() {
  for (const key in panels) panels[key].innerHTML = "";

  const players = [{ color: "red" }, { color: "blue" }, { color: "yellow" }, { color: "green" }];
  players.forEach(player => {
    const panel = panels[player.color];
    basePieces.forEach(shape => {
      const cols = Math.max(...shape.map(c => c[0])) + 1;
      const rows = Math.max(...shape.map(c => c[1])) + 1;
      const size = window.PIECE_SIZE;

      const pieceCanvas = document.createElement("canvas");
      pieceCanvas.width = cols * size;
      pieceCanvas.height = rows * size;
      pieceCanvas.setAttribute("draggable","false");

      const pieceCtx = pieceCanvas.getContext("2d");
      shape.forEach(([x, y]) => {
        pieceCtx.drawImage(images[player.color],0,0,images[player.color].width,images[player.color].height,
          x*size, y*size, size, size);
        pieceCtx.strokeStyle="#000";
        pieceCtx.strokeRect(x*size, y*size, size, size);
      });

      const pieceWrapper = document.createElement("div");
      pieceWrapper.classList.add("piece-wrapper");
      pieceWrapper.style.margin = "3px";
      pieceWrapper.appendChild(pieceCanvas);
      panel.appendChild(pieceWrapper);

      pieceCanvas.addEventListener("mousedown", e => {
        draggingPiece = {
          shape: shape.map(([x, y]) => [x, y]),
          imageObj: images[player.color],
          color: player.color,
          currentRotation: 0,
          targetRotation: 0
        };
        dragPos.x = e.clientX;
        dragPos.y = e.clientY;
        mouseOffset.x = e.offsetX;
        mouseOffset.y = e.offsetY;
        draggingWrapper = pieceWrapper;
        pieceWrapper.style.visibility = "hidden";
      });
    });
  });

  drawBoard();
}

// Draw board
function drawBoard() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Grid
  ctx.strokeStyle="#ccc";
  for(let i=0;i<=BOARD_SIZE;i++){
    ctx.beginPath();
    ctx.moveTo(i*window.CELL_SIZE,0);
    ctx.lineTo(i*window.CELL_SIZE,BOARD_SIZE*window.CELL_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0,i*window.CELL_SIZE);
    ctx.lineTo(BOARD_SIZE*window.CELL_SIZE,i*window.CELL_SIZE);
    ctx.stroke();
  }

  // Placed pieces
  placedPieces.forEach((piece,idx)=>{
    piece.shape.forEach(([dx,dy])=>{
      const x = (piece.origin.x+dx)*window.CELL_SIZE;
      const y = (piece.origin.y+dy)*window.CELL_SIZE;
      ctx.drawImage(piece.imageObj,0,0,piece.imageObj.width,piece.imageObj.height,
        x,y,window.CELL_SIZE,window.CELL_SIZE);
      ctx.strokeStyle="#000";
      ctx.strokeRect(x,y,window.CELL_SIZE,window.CELL_SIZE);
    });
    if(highlightedPieceIndex===idx){
      ctx.strokeStyle="yellow";
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.rect(piece.origin.x*window.CELL_SIZE,piece.origin.y*window.CELL_SIZE,
        Math.max(...piece.shape.map(s=>s[0]))*window.CELL_SIZE+window.CELL_SIZE,
        Math.max(...piece.shape.map(s=>s[1]))*window.CELL_SIZE+window.CELL_SIZE);
      ctx.stroke();
      ctx.lineWidth=1;
    }
  });

  // Dragging piece
  if(draggingPiece){
    const rect = canvas.getBoundingClientRect();
    const mouseX = dragPos.x-rect.left-mouseOffset.x;
    const mouseY = dragPos.y-rect.top-mouseOffset.y;
    draggingPiece.currentRotation = draggingPiece.targetRotation;
    const cos = Math.round(Math.cos(draggingPiece.currentRotation));
    const sin = Math.round(Math.sin(draggingPiece.currentRotation));
    const rotatedShape = draggingPiece.shape.map(([x,y])=>[x*cos-y*sin, x*sin+y*cos]);
    const minX = Math.min(...rotatedShape.map(p=>p[0]));
    const minY = Math.min(...rotatedShape.map(p=>p[1]));
    const normalizedShape = rotatedShape.map(([x,y])=>[x-minX, y-minY]);
    normalizedShape.forEach(([dx,dy])=>{
      const x = mouseX+dx*window.CELL_SIZE;
      const y = mouseY+dy*window.CELL_SIZE;
      ctx.drawImage(draggingPiece.imageObj,0,0,draggingPiece.imageObj.width,draggingPiece.imageObj.height,
        x,y,window.CELL_SIZE,window.CELL_SIZE);
      ctx.strokeStyle="#000";
      ctx.strokeRect(x,y,window.CELL_SIZE,window.CELL_SIZE);
    });
  }

  requestAnimationFrame(drawBoard);
}

// Mouse move
canvas.addEventListener("mousemove", e => {
  if(!draggingPiece) return;
  dragPos.x=e.clientX;
  dragPos.y=e.clientY;
});

// Mouse up (drop piece)
canvas.addEventListener("mouseup", e=>{
  if(!draggingPiece) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX=e.clientX-rect.left-mouseOffset.x;
  const mouseY=e.clientY-rect.top-mouseOffset.y;
  const cos=Math.round(Math.cos(draggingPiece.currentRotation));
  const sin=Math.round(Math.sin(draggingPiece.currentRotation));
  let rotatedShape = draggingPiece.shape.map(([x,y])=>[x*cos-y*sin, x*sin+y*cos]);
  const minX=Math.min(...rotatedShape.map(p=>p[0]));
  const minY=Math.min(...rotatedShape.map(p=>p[1]));
  rotatedShape = rotatedShape.map(([x,y])=>[x-minX,y-minY]);
  const snapX=Math.round(mouseX/window.CELL_SIZE);
  const snapY=Math.round(mouseY/window.CELL_SIZE);

  let valid=true;
  rotatedShape.forEach(([dx,dy])=>{
    const x=snapX+dx;
    const y=snapY+dy;
    if(x<0||x>=BOARD_SIZE||y<0||y>=BOARD_SIZE) valid=false;
  });

  if(valid){
    placedPieces.push({ shape:rotatedShape, origin:{x:snapX,y:snapY}, imageObj:draggingPiece.imageObj, color:draggingPiece.color });
  }else if(draggingWrapper){
    draggingWrapper.style.visibility="visible";
  }

  draggingPiece=null;
  draggingWrapper=null;
});

// Pick up piece from board
canvas.addEventListener("mousedown", e=>{
  if(draggingPiece) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX=e.clientX-rect.left;
  const mouseY=e.clientY-rect.top;
  const gridX=Math.floor(mouseX/window.CELL_SIZE);
  const gridY=Math.floor(mouseY/window.CELL_SIZE);

  for(let i=placedPieces.length-1;i>=0;i--){
    const piece=placedPieces[i];
    if(piece.shape.some(([dx,dy])=>piece.origin.x+dx===gridX && piece.origin.y+dy===gridY)){
      placedPieces.splice(i,1);
      draggingPiece={ shape:piece.shape.map(([x,y])=>[x,y]), imageObj:piece.imageObj, color:piece.color, currentRotation:0, targetRotation:0 };
      dragPos.x=e.clientX;
      dragPos.y=e.clientY;
      mouseOffset.x=window.CELL_SIZE/2;
      mouseOffset.y=window.CELL_SIZE/2;
      break;
    }
  }
});

// Reset
document.getElementById("resetBtn").addEventListener("click",()=>{
  placedPieces=[];
  draggingPiece=null;
  highlightedPieceIndex=null;
  renderAllPieces();
});

// Instructions modal
const instructionsBtn=document.getElementById("instructionsBtn");
const modal=document.getElementById("instructionsModal");
const closeModal=document.getElementById("closeModal");
instructionsBtn.addEventListener("click",()=>modal.style.display="flex");
closeModal.addEventListener("click",()=>modal.style.display="none");
window.addEventListener("click",e=>{if(e.target===modal) modal.style.display="none";});

// Keyboard controls
window.addEventListener("keydown", e=>{
  if(modal.style.display==="flex") return;

  // Delete highlighted
  if((e.key==="Delete"||e.key==="Backspace")&&highlightedPieceIndex!==null){
    const removed=placedPieces.splice(highlightedPieceIndex,1)[0];
    highlightedPieceIndex=null;
    const panel=panels[removed.color];
    if(panel){
      [...panel.querySelectorAll(".piece-wrapper")].forEach(wrapper=>{
        if(wrapper.style.visibility==="hidden") wrapper.style.visibility="visible";
      });
    }
    return;
  }

  // Highlight with Enter
  if(e.key==="Enter"){
    const rect = canvas.getBoundingClientRect();
    const mouseX = dragPos.x - rect.left;
    const mouseY = dragPos.y - rect.top;
    const gridX = Math.floor(mouseX/window.CELL_SIZE);
    const gridY = Math.floor(mouseY/window.CELL_SIZE);
    highlightedPieceIndex=null;
    for(let i=placedPieces.length-1;i>=0;i--){
      const piece=placedPieces[i];
      if(piece.shape.some(([dx,dy])=>piece.origin.x+dx===gridX && piece.origin.y+dy===gridY)){
        highlightedPieceIndex=i;
        break;
      }
    }
    return;
  }

  if((e.key==="Delete"||e.key==="Backspace")&&highlightedPieceIndex===null){
    document.getElementById("resetBtn").click();
    return;
  }

  if(!draggingPiece) return;

  const rotate90=()=>{ draggingPiece.currentRotation+=Math.PI/2; draggingPiece.targetRotation=draggingPiece.currentRotation; };
  const flipX=()=>{ const maxX=Math.max(...draggingPiece.shape.map(c=>c[0])); draggingPiece.shape=draggingPiece.shape.map(([x,y])=>[maxX-x,y]); };
  const flipY=()=>{ const maxY=Math.max(...draggingPiece.shape.map(c=>c[1])); draggingPiece.shape=draggingPiece.shape.map(([x,y])=>[x,maxY-y]); };

  if(e.key==="r"||e.key==="R") rotate90();
  else if(e.key==="f"||e.key==="F") flipX();
  else if(e.key==="v"||e.key==="V") flipY();
});

// Resize
function onResize(){ calculateSizes(); renderAllPieces(); }
window.addEventListener("resize",onResize);
window.addEventListener("load",()=>{ onResize(); requestAnimationFrame(drawBoard); });
