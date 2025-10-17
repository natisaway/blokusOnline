// src/state/gameOverModal.js
import { boardState, subscribe } from "./boardState.js";

/**
 * Shows a modal listing player rankings when all have forfeited.
 * Scoring is golf-style: fewer squares left = better.
 */
export function initGameOverModal() {
  if (document.getElementById("game-over-modal")) return;

  const modal = document.createElement("div");
  modal.id = "game-over-modal";
  Object.assign(modal.style, {
    display: "none",
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.55)",
    zIndex: "2000",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Scribble, Arial, sans-serif",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px 28px",
    textAlign: "center",
    boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
    minWidth: "320px",
    maxWidth: "90vw",
  });

  const title = document.createElement("h2");
  title.textContent = "Game Over!";
  Object.assign(title.style, {
    marginBottom: "14px",
    fontFamily: "ScribbleHand, Scribble, Arial, sans-serif",
    fontWeight: "700",
  });

  const list = document.createElement("ol");
  list.id = "final-scores";
  Object.assign(list.style, {
    listStyle: "none",
    padding: "0",
    margin: "0 0 18px 0",
    fontSize: "1.1rem",
  });

  // Buttons row
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.justifyContent = "center";
  btnRow.style.gap = "10px";

  const playAgain = document.createElement("button");
  playAgain.textContent = "Play Again";
  Object.assign(playAgain.style, baseBtnStyle("#dcfce7"));
  playAgain.onclick = () => {
    modal.style.display = "none";
    boardState.reset();
  };

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  Object.assign(closeBtn.style, baseBtnStyle("#f3f4f6"));
  closeBtn.onclick = () => (modal.style.display = "none");

  btnRow.append(playAgain, closeBtn);
  card.append(title, list, btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);

  subscribe(() => {
    if (boardState._allForfeited()) showResults();
  });

  function showResults() {
    const COLORS = ["blue", "yellow", "red", "green"];
    const scores = COLORS.map((color) => ({
      color,
      squares: countSquaresLeft(color),
    }));
    scores.sort((a, b) => a.squares - b.squares);

    list.innerHTML = "";
    scores.forEach(({ color, squares }, i) => {
      const rank = i + 1;
      const item = document.createElement("li");
      item.innerHTML = `<strong style="
          font-family:'ScribbleHand', Scribble, Arial, sans-serif;
          font-size:1.1em;
          color:#0f172a;
        ">${rank}. ${capitalize(color)}</strong> — ${squares} squares left`;

      if (i === 0) {
        item.style.background = "#dcfce7";
        item.style.border = "2px solid #4ade80";
        item.style.borderRadius = "8px";
        item.style.padding = "4px 8px";
        item.style.margin = "4px 0";
      } else {
        item.style.padding = "2px 0";
      }
      list.appendChild(item);
    });

    modal.style.display = "flex";
  }
}

/* -------- Helpers -------- */
function baseBtnStyle(bg) {
  return {
    padding: "6px 16px",
    border: "2px solid #000",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "Scribble, Arial, sans-serif",
    fontWeight: "bold",
    background: bg,
  };
}

function countSquaresLeft(color) {
  const list = boardState.availablePieces[color] || [];
  return list.reduce((acc, shape) => acc + shape.length, 0);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
