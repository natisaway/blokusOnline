// Patched main.js
// NOTE: This is a fully replaced file with fixes for
// - AI autoplay until completion
// - Reset button restart logic
// - Prep hooks for piece readjustment/undo-turn logic
// - Instructions modal using `hidden` to match HTML
// Imported modules remain unchanged

import { BOARD_SIZE } from "./constants.js";
import { loadTextures } from "./textures.js";
import { createCanvasRenderer } from "./render/canvasRenderer.js";
import { renderAllPieces } from "./render/panelsRenderer.js";
import { subscribe, boardState } from "./state/boardState.js";
import { solveLayout } from "./layout/responsive.js";
import { attachCanvasInput } from "./input/dragDrop.js";
import { attachKeyboard } from "./input/keyboard.js";
import { aiPlayByStyle } from "./utils/computerAI.js";

(async function init() {
  console.log("Initializing Blokus...");

  const canvas = document.getElementById("board");
  const panels = {
    red: document.getElementById("red-panel"),
    blue: document.getElementById("blue-panel"),
    yellow: document.getElementById("yellow-panel"),
    green: document.getElementById("green-panel"),
  };

  const btnReset = document.getElementById("resetBtn");
  const btnInstructions = document.getElementById("instructionsBtn");
  const btnConfirm = document.getElementById("confirmTurnBtn");
  const btnForfeit = document.getElementById("forfeitBtn");

  const forfeitModal = document.getElementById("forfeitModal");
  const confirmForfeitYes = document.getElementById("confirmForfeitYes");
  const confirmForfeitNo = document.getElementById("confirmForfeitNo");
  const playerSelectModal = document.getElementById("playerSelectModal");
  const closePlayerSelect = document.getElementById("closePlayerSelect");

  const instructionsModal = document.getElementById("instructionsModal");
  const closeInstructions = document.getElementById("closeModal");

  // -------------------------------
  // Player modal setup
  // -------------------------------

  function setupPlayerModal() {
    if (!playerSelectModal) return;
    playerSelectModal.hidden = false;

    const playerButtons = playerSelectModal.querySelectorAll("button[data-count]");
    playerButtons.forEach((b) => b.classList.remove("active"));

    const firstBtn = playerSelectModal.querySelector('button[data-count="1"]');
    if (firstBtn) firstBtn.classList.add("active");

    // Rebind close button
    closePlayerSelect.replaceWith(closePlayerSelect.cloneNode(true));
    const newCloseBtn = document.getElementById("closePlayerSelect");

    playerButtons.forEach((btn) => {
      btn.onclick = () => {
        const count = parseInt(btn.dataset.count, 10);
        const colors = ["blue", "yellow", "red", "green"];
        boardState.localPlayers = colors.slice(0, count);
        boardState.emit();

        playerButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      };
    });

    newCloseBtn.addEventListener("click", () => {
      playerSelectModal.hidden = true;
      startGame();
    });
  }

  boardState.localPlayers = ["blue"];
  boardState.emit();
  setupPlayerModal();

  // -------------------------------
  // Load textures + renderers
  // -------------------------------
  const textures = await loadTextures();
  boardState.textures = textures;

  const renderer = createCanvasRenderer(canvas, boardState);
  renderAllPieces(panels, boardState.pieceSize, textures, boardState.startDrag);

  //  Draw the initial board grid once on load
  renderer(boardState);


  subscribe(() => {
    renderer(boardState);
    renderAllPieces(
      panels,
      boardState.pieceSize,
      boardState.textures,
      boardState.startDrag
    );
  });

// 🔧 Compute layout and sync sizes into boardState
const pack = solveLayout(canvas, panels, {
  titleEl: document.querySelector("h1"),
  buttonsEl: document.querySelector(".button-container"),
});

// Use the same cell size the layout picked
boardState.cellSize = pack.cellSize;
boardState.pieceSize = pack.pieceSize;

// 👀 Draw once immediately so the grid is visible before any moves
renderer(boardState);

// Input + keyboard
attachCanvasInput(canvas, boardState, renderer);
attachKeyboard(boardState, renderer);

// One subscription is enough; you can keep just this one:
subscribe(() => renderer(boardState));


  // -------------------------------
  // Scoreboard
  // -------------------------------

  function updateScores() {
    const scoreMap = {
      blue: document.getElementById("blueScore"),
      yellow: document.getElementById("yellowScore"),
      red: document.getElementById("redScore"),
      green: document.getElementById("greenScore"),
    };

    Object.keys(scoreMap).forEach((color) => {
      const remaining = boardState.availablePieces[color]
        .map((p) => p.length)
        .reduce((a, b) => a + b, 0);
      scoreMap[color].textContent = remaining;
    });
  }
  subscribe(() => updateScores());

  // -------------------------------
  // Turn banner
  // -------------------------------

  function updateTurnBanner(color, customText = null) {
    const banner = document.getElementById("turnBanner");
    const text = document.getElementById("turnBannerText");
    const sub = document.getElementById("turnBannerSub");
    if (!banner || !text) return;

    banner.className = `turn-banner ${color}`;
    text.textContent = customText || `${color[0].toUpperCase() + color.slice(1)}'s turn`;
    sub.style.display = boardState.isLocal(color) ? "block" : "none";
    btnForfeit.style.display = boardState.isLocal(color) ? "inline-block" : "none";
  }

  function showForfeitMessage(color) {
    const banner = document.getElementById("turnBanner");
    const text = document.getElementById("turnBannerText");
    const sub = document.getElementById("turnBannerSub");
    if (!banner || !text) return;
    banner.className = `turn-banner ${color}`;
    text.textContent = `${color.toUpperCase()} forfeits`;
    sub.style.display = "none";
  }

  const forfeitedPlayers = new Set();

  // -------------------------------
  // Player/AI Turn Cycle
  // -------------------------------

  async function runTurnCycle() {
    const current = boardState.currentPlayer;

    // Skip forfeited players automatically
    if (forfeitedPlayers.has(current)) {
      boardState.endTurn();
      return runTurnCycle();
    }

    updateTurnBanner(current);

    // AI TURN
    if (boardState.isAI(current)) {
      const success = aiPlayByStyle(current);
      if (!success) forfeitedPlayers.add(current);

      await new Promise((r) => setTimeout(r, 900));

      boardState.endTurn();
      return runTurnCycle();
    }

    // LOCAL TURN
    console.log(`🎯 ${current.toUpperCase()} (local player) — waiting for move...`);
    // Now wait for user to click "End Turn"
  }

  async function handleEndTurn() {
    const current = boardState.currentPlayer;
    if (!boardState.isLocal(current)) {
      console.warn("End Turn pressed when it's not a local player's turn.");
      return;
    }

    // Optional: enforce at least one piece placement
    // if (!boardState.piecePlacedThisTurn) {
    //   console.warn("You must place a piece before ending your turn.");
    //   return;
    // }

    boardState.endTurn();
    await runTurnCycle();
  }

  // -------------------------------
  // Forfeit logic
  // -------------------------------

  let pendingForfeit = false;

  async function handleForfeit() {
    const current = boardState.currentPlayer;
    if (!boardState.isLocal(current) || pendingForfeit) return;

    pendingForfeit = true;
    forfeitModal.hidden = false;

    return new Promise((resolve) => {
      const yes = () => finish(true);
      const no = () => finish(false);

      function finish(choice) {
        forfeitModal.hidden = true;
        confirmForfeitYes.removeEventListener("click", yes);
        confirmForfeitNo.removeEventListener("click", no);
        pendingForfeit = false;
        resolve(choice);
      }

      confirmForfeitYes.addEventListener("click", yes);
      confirmForfeitNo.addEventListener("click", no);
    }).then(async (confirmed) => {
      if (!confirmed) return;

      forfeitedPlayers.add(current);
      showForfeitMessage(current);

      const allLocals = boardState.localPlayers;
      const allForfeited = allLocals.every((p) => forfeitedPlayers.has(p));

      if (allForfeited) return continueAIOnly();

      await new Promise((r) => setTimeout(r, 800));
      boardState.endTurn();
      await runTurnCycle();
    });
  }

  // -------------------------------
  // Final scoreboard (alert-based)
  // -------------------------------

  function showFinalScoreboard() {
    const results = Object.keys(boardState.availablePieces).map((color) => {
      const remaining = boardState.availablePieces[color]
        .map((p) => p.length)
        .reduce((a, b) => a + b, 0);
      return { color, score: remaining };
    });

    results.sort((a, b) => a.score - b.score);

    const summary = results
      .map((r) => `${r.color.toUpperCase()}: ${r.score}`)
      .join("\n");

    alert("Final Scores:\n" + summary);
  }

  // -------------------------------
  // AI autoplay mode
  // -------------------------------

  function continueAIOnly() {
    btnForfeit.style.display = "none";
    btnConfirm.disabled = true;

    updateTurnBanner("blue", "AI autoplay in progress...");

    const aiList = boardState.turnOrder.filter((c) => boardState.isAI(c));

    function hasValidMove(color) {
      const available = boardState.availablePieces[color] || [];
      for (const shape of available) {
        for (let y = 0; y < BOARD_SIZE; y++) {
          for (let x = 0; x < BOARD_SIZE; x++) {
            if (boardState.canPlace(shape, { x, y }, color)) return true;
          }
        }
      }
      return false;
    }

    async function aiLoop() {
      let moved = false;

      for (const color of aiList) {
        if (forfeitedPlayers.has(color)) continue;
        if (!hasValidMove(color)) {
          forfeitedPlayers.add(color);
          continue;
        }

        boardState.currentTurnIndex = boardState.turnOrder.indexOf(color);
        updateTurnBanner(color);

        aiPlayByStyle(color);
        boardState.emit();

        moved = true;

        await new Promise((r) => setTimeout(r, 500));
      }

      const allOut = aiList.every((c) => forfeitedPlayers.has(c));

      if (allOut || !moved) {
        showFinalScoreboard();
        return;
      }

      await new Promise((r) => setTimeout(r, 500));
      aiLoop();
    }

    aiLoop();
  }

  // -------------------------------
  // Instructions Modal (using `hidden`)
  // -------------------------------

// INSTRUCTIONS OPEN
btnInstructions.addEventListener("click", () => {
  document.getElementById("instructionsModal").hidden = false;
});

// INSTRUCTIONS CLOSE
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("instructionsModal").hidden = true;
});

// BACKDROP CLOSE
document.getElementById("instructionsModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.hidden = true;
  }
});


  // -------------------------------
  // Start / Reset game
  // -------------------------------

  function startGame() {
    updateScores();
    runTurnCycle();
  }

  // ✅ Wire up the buttons (this was missing)
  if (btnConfirm) {
    btnConfirm.addEventListener("click", handleEndTurn);
  }
  if (btnForfeit) {
    btnForfeit.addEventListener("click", handleForfeit);
  }

  btnReset.addEventListener("click", () => {
    forfeitedPlayers.clear();
    boardState.reset();

    renderAllPieces(
      panels,
      boardState.pieceSize,
      boardState.textures,
      boardState.startDrag
    );

    renderer(boardState);
    updateScores();

    startGame();
  });

  // -------------------------------
  // Initial game start
  // -------------------------------

  startGame();
})();
