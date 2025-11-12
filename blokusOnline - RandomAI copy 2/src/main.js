// src/main.js
// Fully patched Blokus main entry file

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
  console.log("🎮 Initializing Blokus...");

  /* ---------------- DOM ELEMENTS ---------------- */
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

  /* ============================================================
     PLAYER MODAL SETUP
  ============================================================ */
  function setupPlayerModal() {
    if (!playerSelectModal) return;
    playerSelectModal.hidden = false;

    const playerButtons = playerSelectModal.querySelectorAll("button[data-count]");
    playerButtons.forEach((b) => b.classList.remove("active"));
    const firstBtn = playerSelectModal.querySelector('button[data-count="1"]');
    if (firstBtn) firstBtn.classList.add("active");

    closePlayerSelect.replaceWith(closePlayerSelect.cloneNode(true));
    const newCloseBtn = document.getElementById("closePlayerSelect");

    playerButtons.forEach((btn) => {
      btn.onclick = () => {
        const count = parseInt(btn.dataset.count);
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

  /* ============================================================
     INITIAL PLAYER CONFIGURATION
  ============================================================ */
  boardState.localPlayers = ["blue"];
  boardState.emit();
  setupPlayerModal();

  /* ============================================================
     LOAD TEXTURES
  ============================================================ */
  const textures = await loadTextures();
  boardState.textures = textures;

  /* ============================================================
     RENDERERS + SUBSCRIPTIONS
  ============================================================ */
  const renderer = createCanvasRenderer(canvas, boardState);
  renderAllPieces(panels, boardState.pieceSize, textures, boardState.startDrag);

  subscribe(() => {
    renderer(boardState);
    renderAllPieces(
      panels,
      boardState.pieceSize,
      boardState.textures,
      boardState.startDrag
    );
  });

  /* ============================================================
     RESPONSIVE LAYOUT
  ============================================================ */
  solveLayout(canvas, panels, {
    titleEl: document.querySelector("h1"),
    buttonsEl: document.querySelector(".button-container"),
  });

  /* ============================================================
     INPUT + KEYBOARD
  ============================================================ */
  attachCanvasInput(canvas, boardState, renderer);
  attachKeyboard(boardState, renderer);
  subscribe(() => renderer(boardState));

  /* ============================================================
     SCORE TRACKING
  ============================================================ */
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
      if (scoreMap[color]) scoreMap[color].textContent = remaining;
    });
  }
  subscribe(() => updateScores());

  /* ============================================================
     TURN BANNER + FORFEIT
  ============================================================ */
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
    text.textContent = `${color[0].toUpperCase() + color.slice(1)} forfeits`;
    sub.style.display = "none";
  }

  const forfeitedPlayers = new Set();

  /* ============================================================
     TURN + AI CYCLE
  ============================================================ */
  async function runTurnCycle() {
    const current = boardState.currentPlayer;
    if (forfeitedPlayers.has(current)) {
      boardState.endTurn();
      return runTurnCycle();
    }

    updateTurnBanner(current);

    if (boardState.isAI(current)) {
      const success = aiPlayByStyle(current);
      if (!success) forfeitedPlayers.add(current);
      await new Promise((r) => setTimeout(r, 900));
      boardState.endTurn();
      return runTurnCycle();
    }

    updateTurnBanner(current);
  }

  async function handleEndTurn() {
    const current = boardState.currentPlayer;
    if (!boardState.isLocal(current)) return;
    boardState.endTurn();
    await runTurnCycle();
  }

  /* ============================================================
     FORFEIT HANDLING
  ============================================================ */
  let pendingForfeit = false;
  async function handleForfeit() {
    const current = boardState.currentPlayer;
    if (!boardState.isLocal(current) || pendingForfeit) return;
    pendingForfeit = true;
    forfeitModal.hidden = false;

    return new Promise((resolve) => {
      const confirmYes = () => finish(true);
      const cancel = () => finish(false);
      function finish(choice) {
        forfeitModal.hidden = true;
        confirmForfeitYes.removeEventListener("click", confirmYes);
        confirmForfeitNo.removeEventListener("click", cancel);
        pendingForfeit = false;
        resolve(choice);
      }
      confirmForfeitYes.addEventListener("click", confirmYes);
      confirmForfeitNo.addEventListener("click", cancel);
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

  /* ============================================================
     FINAL SCOREBOARD
  ============================================================ */
  function showFinalScoreboard() {
    const results = Object.keys(boardState.availablePieces).map((color) => {
      const remaining = boardState.availablePieces[color]
        .map((p) => p.length)
        .reduce((a, b) => a + b, 0);
      return { color, score: remaining };
    });
    results.sort((a, b) => a.score - b.score);
    const summary = results.map(r => `${r.color.toUpperCase()}: ${r.score}`).join("\n");
    alert("🏁 Final Scores:\n\n" + summary);
  }

  /* ============================================================
     CONTINUE AI-ONLY MODE
  ============================================================ */
  function continueAIOnly() {
    btnForfeit.style.display = "none";
    btnConfirm.disabled = true;
    updateTurnBanner("blue", "AI autoplay in progress...");

    const aiList = boardState.turnOrder.filter(c => boardState.isAI(c));

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
        await new Promise(r => setTimeout(r, 500));
      }

      const allOut = aiList.every(c => forfeitedPlayers.has(c));
      if (allOut || !moved) {
        showFinalScoreboard();
        return;
      }

      await new Promise(r => setTimeout(r, 500));
      aiLoop();
    }

    aiLoop();
  }

  /* ============================================================
     BUTTON EVENTS
  ============================================================ */
  btnConfirm.addEventListener("click", handleEndTurn);
  btnForfeit.addEventListener("click", handleForfeit);

  btnReset.addEventListener("click", () => {
    forfeitedPlayers.clear();
    boardState.reset();
    renderAllPieces(panels, boardState.pieceSize, boardState.textures, boardState.startDrag);
    renderer(boardState);
    updateScores();
    setupPlayerModal();
  });

  btnInstructions.addEventListener("click", () => {
    const modal = document.getElementById("instructionsModal");
    if (modal) modal.hidden = false;
  });

  document.getElementById("closeModal")?.addEventListener("click", () => {
    const modal = document.getElementById("instructionsModal");
    if (modal) modal.hidden = true;
  });

  /* ============================================================
     START GAME
  ============================================================ */
  function startGame() {
    console.log("🚀 Starting Blokus (Blue = Local, 3 AIs)");
    renderer(boardState);
    updateScores();
    runTurnCycle();
  }
})();
