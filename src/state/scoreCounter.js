// src/state/scoreCounter.js
import { boardState, subscribe } from "./boardState.js";

/**
 * ScoreCounter: shows total remaining squares (not pieces) per color.
 * Example display: "Blue: 84 squares left"
 */
export function initScoreCounter() {
  // 🧩 Prevent duplicates — only build once
  let existing = document.getElementById("score-counter");
  if (existing) return;

  // --- Container setup ---
  const container = document.createElement("div");
  container.id = "score-counter";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(4, 1fr)";
  container.style.gap = "8px";
  container.style.margin = "12px auto 18px auto";
  container.style.maxWidth = "720px";
  container.style.textAlign = "center";
  container.style.fontFamily = "Scribble, Arial, sans-serif";

  // Dock right below main game area if possible
  const anchor =
    document.getElementById("game-container")?.parentElement || document.body;
  anchor.appendChild(container);

  // --- Define color order ---
  const COLORS = ["blue", "yellow", "red", "green"];
  const elements = {};

  // --- Create color boxes ---
  for (const color of COLORS) {
    const el = document.createElement("div");
    el.className = "score-tile";
    el.dataset.color = color;
    Object.assign(el.style, {
      padding: "6px 10px",
      borderRadius: "10px",
      fontSize: "1rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      border: "2px solid transparent",
      transition: "all 0.25s ease",
      background: colorBackground(color),
      color: "#1e293b",
    });

    // Use ScribbleHand for color name, Scribble for counter text
    el.innerHTML = `
      <span style="
        font-family: 'ScribbleHand', Arial, sans-serif;
        font-weight: 700;
        color: #0f172a;
        font-size: 1.1em;
        letter-spacing: 0.4px;
      ">
        ${capitalize(color)}
      </span>: — squares left
    `;

    container.appendChild(el);
    elements[color] = el;
  }

  // --- Update function ---
  function updateScores() {
    const active = boardState.currentPlayer;
    for (const color of COLORS) {
      const squares = countSquaresLeft(color);
      const el = elements[color];

      el.innerHTML = `
        <span style="
          font-family: 'ScribbleHand', Arial, sans-serif;
          font-weight: 700;
          color: #0f172a;
          font-size: 1.1em;
          letter-spacing: 0.4px;
        ">
          ${capitalize(color)}
        </span>: ${squares} squares left
      `;

      // Highlight active player's color
      if (color === active) {
        el.style.boxShadow = `0 0 8px 2px ${glowColor(color)}`;
        el.style.borderColor = glowColor(color);
        el.style.transform = "scale(1.04)";
      } else {
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)";
        el.style.borderColor = "transparent";
        el.style.transform = "scale(1.0)";
      }
    }
  }

  // --- Listen for state changes ---
  subscribe(updateScores);
  updateScores(); // initial draw
}

/* -------- Helpers -------- */
function countSquaresLeft(color) {
  const list = boardState.availablePieces[color] || [];
  return list.reduce((acc, shape) => acc + shape.length, 0);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function colorBackground(color) {
  switch (color) {
    case "red":
      return "#ffe2e2";
    case "yellow":
      return "#fff7c2";
    case "blue":
      return "#dbeafe";
    case "green":
      return "#dcfce7";
    default:
      return "#f3f4f6";
  }
}

function glowColor(color) {
  switch (color) {
    case "red":
      return "#f87171";
    case "yellow":
      return "#facc15";
    case "blue":
      return "#60a5fa";
    case "green":
      return "#4ade80";
    default:
      return "#94a3b8";
  }
}
