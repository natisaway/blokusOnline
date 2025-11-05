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

/* =========================== UI ELEMENT LAYOUT  =========================== */
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

  /* =========================== PLAYER COUNT SELECTION MODAL  =========================== */
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

  boardState.localPlayers = ["blue"];
  boardState.emit();
  setupPlayerModal();

    /* =========================== INITIAL RENDER + TEXTURES  =========================== */
  const textures = await loadTextures();
  boardState.textures = textures;

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

    /* =========================== RESPONSIVE LAYOUT  =========================== */
    solveLayout(canvas, panels, {
    titleEl: document.querySelector("h1"),
    buttonsEl: document.querySelector(".button-container"),
  });

    /* =========================== INPUT HANDLERS  =========================== */
    attachCanvasInput(canvas, boardState, renderer);
  attachKeyboard(boardState, renderer);
  subscribe(() => renderer(boardState));

    /* =========================== SCORE UPDATER  =========================== */
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

    /* =========================== TURN BANNER UPDATE  =========================== */
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

    /* =========================== TURN FLOW CONTROL  =========================== */
    const forfeitedPlayers = new Set();

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

    /* =========================== FORFEIT HANDLER  =========================== */
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

    /* =========================== AI-AUTOPLAY AFTER LOCAL FORFEIT  =========================== */
    function continueAIOnly() {
    btnForfeit.style.display = "none";
    btnConfirm.disabled = true;
    updateTurnBanner("blue", "AI autoplay in progress...");

    const activeAIs = boardState.turnOrder.filter(
      (c) => boardState.isAI(c) && !forfeitedPlayers.has(c)
    );

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

    function nextAIIndex(currentIndex) {
      for (let i = 1; i <= activeAIs.length; i++) {
        const next = (currentIndex + i) % activeAIs.length;
        const color = activeAIs[next];
        if (!forfeitedPlayers.has(color)) return next;
      }
      return -1;
    }

    let currentIndex = 0;

    function step() {
      const color = activeAIs[currentIndex];

      if (forfeitedPlayers.has(color)) {
        currentIndex = nextAIIndex(currentIndex);
        return setTimeout(step, 200);
      }

      if (!hasValidMove(color)) {
        forfeitedPlayers.add(color);
        currentIndex = nextAIIndex(currentIndex);
        return setTimeout(step, 200);
      }

      boardState.currentTurnIndex = boardState.turnOrder.indexOf(color);
      updateTurnBanner(color);
      aiPlayByStyle(color);
      boardState.emit();
      currentIndex = nextAIIndex(currentIndex);
      setTimeout(step, 700);
    }

    step();
  }

    /* =========================== BUTTON ACTIONS  =========================== */
    btnConfirm.addEventListener("click", handleEndTurn);
  btnForfeit.addEventListener("click", handleForfeit);

    /* =========================== RESET GAME  =========================== */
    btnReset.addEventListener("click", () => {
      console.log("Resetting full game...");
      window.location.reload();
    });
    

    /* =========================== INSTRUCTIONS MODAL  =========================== */
    btnInstructions.addEventListener("click", () =>
    document.getElementById("instructionsModal")?.setAttribute("aria-hidden", "false")
  );
  document.getElementById("closeModal")?.addEventListener("click", () =>
    document.getElementById("instructionsModal")?.setAttribute("aria-hidden", "true")
  );

    /* =========================== GAME START  =========================== */
    function startGame() {
    forfeitedPlayers.clear();
    renderer(boardState);
    updateTurnBanner("blue", "Blue's turn");
    updateScores();
    runTurnCycle();
  }
})();
