"use strict";

const PIECE_SYMBOLS = {
  wK: "\u2654", wQ: "\u2655", wR: "\u2656", wB: "\u2657", wN: "\u2658", wP: "\u2659",
  bK: "\u265A", bQ: "\u265B", bR: "\u265C", bB: "\u265D", bN: "\u265E", bP: "\u265F"
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
const MATE_SCORE = 1000000;

const AI_LEVELS = {
  easy: { label: "Easy", timeLimitMs: 320, baseDepth: 2, maxDepth: 3, qDepth: 1, jitter: 70, useBook: false, aspiration: false },
  medium: { label: "Medium", timeLimitMs: 2600, baseDepth: 5, maxDepth: 7, qDepth: 3, jitter: 0, useBook: true, aspiration: true },
  hard: { label: "Hard", timeLimitMs: 6000, baseDepth: 6, maxDepth: 9, qDepth: 5, jitter: 0, useBook: true, aspiration: true }
};

const BLACK_OPENING_BOOK = {
  "e2e4": ["e7e5", "c7c5", "e7e6"],
  "d2d4": ["d7d5", "g8f6"],
  "c2c4": ["e7e5", "g8f6"],
  "g1f3": ["d7d5", "g8f6"],
  "e2e4 e7e5 g1f3": ["b8c6", "g8f6"],
  "e2e4 c7c5 g1f3": ["d7d6", "b8c6"],
  "d2d4 d7d5 c2c4": ["e7e6", "c7c6"],
  "e2e4 e7e5 g1f3 b8c6 f1c4": ["g8f6", "f8c5"],
  "e2e4 e7e5 g1f3 b8c6 f1b5": ["a7a6", "g8f6"]
};

const PST = {
  P: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  N: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,5,5,0,-20,-40],[-30,5,10,15,15,10,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,10,15,15,10,0,-30],[-40,-20,0,0,0,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  B: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,5,0,0,0,0,5,-10],[-10,10,10,10,10,10,10,-10],[-10,0,10,10,10,10,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,5,10,10,5,0,-10],[-10,0,0,0,0,0,0,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  R: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  Q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  K: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
};

const boardEl = document.getElementById("board");
const turnLabelEl = document.getElementById("turnLabel");
const levelLabelEl = document.getElementById("levelLabel");
const statusLabelEl = document.getElementById("statusLabel");
const whiteWinPctEl = document.getElementById("whiteWinPct");
const blackWinPctEl = document.getElementById("blackWinPct");
const whiteAdvFillEl = document.getElementById("whiteAdvFill");
const whiteClockEl = document.getElementById("whiteClock");
const blackClockEl = document.getElementById("blackClock");
const whiteClockCardEl = document.getElementById("whiteClockCard");
const blackClockCardEl = document.getElementById("blackClockCard");
const capturedByWhiteEl = document.getElementById("capturedByWhite");
const capturedByBlackEl = document.getElementById("capturedByBlack");
const levelSelectEl = document.getElementById("levelSelect");
const timeSelectEl = document.getElementById("timeSelect");
const newGameBtn = document.getElementById("newGameBtn");
const resignBtn = document.getElementById("resignBtn");
const gameOverModalEl = document.getElementById("gameOverModal");
const modalTitleEl = document.getElementById("modalTitle");
const modalTextEl = document.getElementById("modalText");
const modalNewGameBtnEl = document.getElementById("modalNewGameBtn");
const modalCloseBtnEl = document.getElementById("modalCloseBtn");

let state;
let aiTable = new Map();
let killerMoves = {};
let historyHeuristic = {};
let clockIntervalId = null;
let aiClockIntervalId = null;
let audioCtx = null;
let aiTurnToken = 0;

function createInitialState(level, timeControlSec) {
  return {
    board: [
      ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
      ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
      ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
    ],
    turn: "w",
    selected: null,
    legalMovesForSelected: [],
    inCheck: { w: false, b: false },
    gameOver: false,
    status: "White to move",
    aiThinking: false,
    capturedByWhite: [],
    capturedByBlack: [],
    enPassant: null,
    castlingRights: { w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } },
    lastMove: null,
    level,
    timeControlSec,
    clocks: { w: timeControlSec, b: timeControlSec },
    lastTickMs: Date.now(),
    moveHistory: []
  };
}

function cloneState(s) {
  return {
    ...s,
    board: s.board.map((r) => r.slice()),
    inCheck: { ...s.inCheck },
    selected: s.selected ? { ...s.selected } : null,
    legalMovesForSelected: s.legalMovesForSelected.map((m) => ({ ...m })),
    capturedByWhite: s.capturedByWhite.slice(),
    capturedByBlack: s.capturedByBlack.slice(),
    enPassant: s.enPassant ? { ...s.enPassant } : null,
    castlingRights: { w: { ...s.castlingRights.w }, b: { ...s.castlingRights.b } },
    lastMove: s.lastMove ? { ...s.lastMove } : null,
    clocks: { ...s.clocks },
    moveHistory: s.moveHistory.slice()
  };
}

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function colorOf(piece) { return piece ? piece[0] : null; }
function typeOf(piece) { return piece ? piece[1] : null; }
function opponent(color) { return color === "w" ? "b" : "w"; }

function formatClock(seconds) {
  const sec = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateClockUI() {
  whiteClockEl.textContent = formatClock(state.clocks.w);
  blackClockEl.textContent = formatClock(state.clocks.b);
  whiteClockCardEl.classList.toggle("active", !state.gameOver && state.turn === "w");
  blackClockCardEl.classList.toggle("active", !state.gameOver && state.turn === "b");
  whiteClockCardEl.classList.toggle("low-time", state.clocks.w <= 20);
  blackClockCardEl.classList.toggle("low-time", state.clocks.b <= 20);
}

function updateAdvantageBar() {
  const score = evaluateQuickForBlack(state.board);
  const blackPct = scoreToWinProbability(score);
  const whitePct = 100 - blackPct;
  whiteWinPctEl.textContent = `White ${whitePct}%`;
  blackWinPctEl.textContent = `Black ${blackPct}%`;
  whiteAdvFillEl.style.width = `${whitePct}%`;
}

function scoreToWinProbability(evalForBlack) {
  const x = Math.max(-1600, Math.min(1600, evalForBlack));
  const black = 100 / (1 + Math.exp(-x / 230));
  return Math.round(black);
}

function evaluateQuickForBlack(board) {
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[typeOf(p)] || 0;
      score += colorOf(p) === "b" ? val : -val;
    }
  }
  if (isKingInCheck(board, "w")) score += 120;
  if (isKingInCheck(board, "b")) score -= 120;
  return score;
}

function stopClockTicker() {
  if (clockIntervalId) {
    clearInterval(clockIntervalId);
    clockIntervalId = null;
  }
}

function stopAiClockTicker() {
  if (aiClockIntervalId) {
    clearInterval(aiClockIntervalId);
    aiClockIntervalId = null;
  }
}

function startClockTicker() {
  stopClockTicker();
  stopAiClockTicker();
  state.lastTickMs = Date.now();
  updateClockUI();
  clockIntervalId = setInterval(() => {
    if (state.gameOver) return;
    const now = Date.now();
    const elapsed = (now - state.lastTickMs) / 1000;
    state.lastTickMs = now;
    state.clocks[state.turn] = Math.max(0, state.clocks[state.turn] - elapsed);
    updateClockUI();

    if (state.clocks[state.turn] <= 0) {
      if (state.turn === "w") {
        endGame("White flagged. Black wins.", "Black Wins on Time", "White ran out of time.");
      } else {
        endGame("Black flagged. White wins.", "White Wins on Time", "Black ran out of time.");
      }
    }
  }, 200);
}

function render() {
  boardEl.innerHTML = "";
  const checkedKing = findKing(state.board, state.turn);
  const showCheck = checkedKing && isSquareAttacked(state.board, checkedKing.r, checkedKing.c, opponent(state.turn));

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = document.createElement("div");
      sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.row = String(r);
      sq.dataset.col = String(c);

      const piece = state.board[r][c];
      if (piece) sq.textContent = PIECE_SYMBOLS[piece];
      if (state.selected && state.selected.r === r && state.selected.c === c) sq.classList.add("selected");
      const legal = state.legalMovesForSelected.find((m) => m.toR === r && m.toC === c);
      if (legal) sq.classList.add(legal.capture ? "capture" : "legal");
      if (showCheck && checkedKing.r === r && checkedKing.c === c) sq.classList.add("in-check");
      if (state.lastMove && ((state.lastMove.fromR === r && state.lastMove.fromC === c) || (state.lastMove.toR === r && state.lastMove.toC === c))) {
        sq.classList.add("last-move");
      }

      if (c === 0) {
        const rank = document.createElement("span");
        rank.className = "coord rank";
        rank.textContent = String(8 - r);
        sq.appendChild(rank);
      }
      if (r === 7) {
        const file = document.createElement("span");
        file.className = "coord file";
        file.textContent = FILES[c];
        sq.appendChild(file);
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }

  turnLabelEl.textContent = state.turn === "w" ? "White" : "Black";
  levelLabelEl.textContent = AI_LEVELS[state.level].label;
  statusLabelEl.textContent = state.status;
  capturedByWhiteEl.textContent = state.capturedByWhite.map((p) => PIECE_SYMBOLS[p]).join(" ");
  capturedByBlackEl.textContent = state.capturedByBlack.map((p) => PIECE_SYMBOLS[p]).join(" ");
  resignBtn.disabled = state.gameOver || state.aiThinking;
  levelSelectEl.disabled = state.aiThinking;
  timeSelectEl.disabled = state.aiThinking;
  updateAdvantageBar();
  updateClockUI();
}

function showGameOverModal(title, text) {
  modalTitleEl.textContent = title;
  modalTextEl.textContent = text;
  gameOverModalEl.classList.remove("hidden");
  gameOverModalEl.setAttribute("aria-hidden", "false");
}

function hideGameOverModal() {
  gameOverModalEl.classList.add("hidden");
  gameOverModalEl.setAttribute("aria-hidden", "true");
}

function endGame(statusText, modalTitle, modalText) {
  if (state.gameOver) return;
  state.gameOver = true;
  state.aiThinking = false;
  stopClockTicker();
  state.status = statusText;
  render();
  showGameOverModal(modalTitle, modalText || statusText);
}

function onSquareClick(e) {
  if (state.gameOver || state.aiThinking || state.turn !== "w") return;

  const square = e.currentTarget;
  const r = Number(square.dataset.row);
  const c = Number(square.dataset.col);
  const piece = state.board[r][c];

  if (state.selected) {
    const legal = state.legalMovesForSelected.find((m) => m.toR === r && m.toC === c);
    if (legal) {
      applyMove(state, legal);
      afterMoveFlow();
      return;
    }
  }

  if (piece && colorOf(piece) === "w") {
    state.selected = { r, c };
    state.legalMovesForSelected = generateLegalMovesForPiece(state, r, c, "w");
  } else {
    state.selected = null;
    state.legalMovesForSelected = [];
  }

  render();
}

function afterMoveFlow() {
  if (state.gameOver) return;
  state.selected = null;
  state.legalMovesForSelected = [];

  const currentColor = state.turn;
  const opp = opponent(currentColor);
  state.inCheck.w = isKingInCheck(state.board, "w");
  state.inCheck.b = isKingInCheck(state.board, "b");

  const oppMoves = generateAllLegalMoves(state, opp);
  const oppInCheck = isKingInCheck(state.board, opp);

  if (oppMoves.length === 0) {
    if (oppInCheck) {
      if (opp === "w") endGame("Checkmate. Black wins.", "Checkmate", "Black wins by checkmate.");
      else endGame("Checkmate. White wins.", "Checkmate", "White wins by checkmate.");
    } else {
      endGame("Draw by stalemate.", "Draw", "Stalemate.");
    }
    return;
  }

  if (oppInCheck) state.status = "Check";
  else if (isInsufficientMaterial(state.board)) {
    endGame("Draw by insufficient material.", "Draw", "Insufficient material.");
    return;
  } else state.status = opp === "w" ? "White to move" : "Black to move";

  state.turn = opp;
  state.lastTickMs = Date.now();
  render();
  if (!state.gameOver && state.turn === "b") runAiMove();
}

function runAiMove() {
  if (state.aiThinking || state.gameOver) return;
  aiTurnToken += 1;
  const token = aiTurnToken;
  const blackClockAtStart = state.clocks.b;
  const thinkStartedAt = performance.now();
  state.aiThinking = true;
  stopClockTicker();
  stopAiClockTicker();
  aiClockIntervalId = setInterval(() => {
    if (!state.aiThinking || state.gameOver) return;
    const elapsed = (performance.now() - thinkStartedAt) / 1000;
    state.clocks.b = Math.max(0, blackClockAtStart - elapsed);
    updateClockUI();
  }, 90);
  state.status = state.inCheck.b ? `Black (${AI_LEVELS[state.level].label}) is in check...` : `Black (${AI_LEVELS[state.level].label}) is thinking`;
  render();

  chooseAiMoveAsync(state, token).then((move) => {
    if (token !== aiTurnToken) return;
    stopAiClockTicker();

    // Guarantee Black clock decreases even if heavy search blocks timer callbacks.
    const thinkElapsedSec = (performance.now() - thinkStartedAt) / 1000;
    state.clocks.b = Math.max(0, blackClockAtStart - thinkElapsedSec);
    updateClockUI();

    if (state.clocks.b <= 0) {
      endGame("Black flagged. White wins.", "White Wins on Time", "Black ran out of time.");
      return;
    }

    if (state.gameOver) {
      state.aiThinking = false;
      render();
      return;
    }

    if (!move) {
      if (isKingInCheck(state.board, "b")) endGame("Checkmate. White wins.", "Checkmate", "White wins by checkmate.");
      else endGame("Draw by stalemate.", "Draw", "Stalemate.");
      return;
    }

    applyMove(state, move);
    state.aiThinking = false;
    afterMoveFlow();
    if (!state.gameOver && !clockIntervalId) startClockTicker();
  });
}

function generateLegalMovesForPiece(s, r, c, color) {
  const piece = s.board[r][c];
  if (!piece || colorOf(piece) !== color) return [];
  const pseudo = generatePseudoMoves(s, r, c, piece);
  const legal = [];

  for (const m of pseudo) {
    const testState = cloneState(s);
    applyMove(testState, m, true);
    if (!isKingInCheck(testState.board, color)) legal.push(m);
  }
  return legal;
}

function generateAllLegalMoves(s, color) {
  const moves = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = s.board[r][c];
      if (piece && colorOf(piece) === color) moves.push(...generateLegalMovesForPiece(s, r, c, color));
    }
  }
  return moves;
}

function generatePseudoMoves(s, r, c, piece) {
  const color = colorOf(piece);
  const type = typeOf(piece);
  const moves = [];

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoteRow = color === "w" ? 0 : 7;
    const oneR = r + dir;

    if (inBounds(oneR, c) && !s.board[oneR][c]) {
      moves.push(makeMoveObj(r, c, oneR, c, piece, null, oneR === promoteRow ? "Q" : null));
      const twoR = r + dir * 2;
      if (r === startRow && !s.board[twoR][c]) moves.push(makeMoveObj(r, c, twoR, c, piece));
    }

    for (const dc of [-1, 1]) {
      const cr = r + dir;
      const cc = c + dc;
      if (!inBounds(cr, cc)) continue;
      const target = s.board[cr][cc];
      if (target && colorOf(target) !== color) moves.push(makeMoveObj(r, c, cr, cc, piece, target, cr === promoteRow ? "Q" : null));
    }

    if (s.enPassant) {
      const ep = s.enPassant;
      if (ep.byColor !== color && ep.targetR === r + dir && Math.abs(ep.targetC - c) === 1) {
        const capturedPawn = s.board[r][ep.targetC];
        if (capturedPawn && colorOf(capturedPawn) !== color && typeOf(capturedPawn) === "P") {
          moves.push({ fromR: r, fromC: c, toR: ep.targetR, toC: ep.targetC, piece, capture: capturedPawn, enPassant: true });
        }
      }
    }
    return moves;
  }

  if (type === "N") {
    const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of jumps) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = s.board[nr][nc];
      if (!target || colorOf(target) !== color) moves.push(makeMoveObj(r, c, nr, nc, piece, target || null));
    }
    return moves;
  }

  const directions = [];
  if (type === "B" || type === "Q") directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
  if (type === "R" || type === "Q") directions.push([-1,0],[1,0],[0,-1],[0,1]);

  if (type === "K") {
    directions.push([-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]);
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = s.board[nr][nc];
      if (!target || colorOf(target) !== color) moves.push(makeMoveObj(r, c, nr, nc, piece, target || null));
    }

    const rights = s.castlingRights[color];
    const homeRow = color === "w" ? 7 : 0;
    const enemy = opponent(color);

    if (r === homeRow && c === 4 && !isSquareAttacked(s.board, homeRow, 4, enemy)) {
      if (rights.kingSide && !s.board[homeRow][5] && !s.board[homeRow][6]) {
        if (!isSquareAttacked(s.board, homeRow, 5, enemy) && !isSquareAttacked(s.board, homeRow, 6, enemy)) {
          if (s.board[homeRow][7] === `${color}R`) moves.push({ fromR: r, fromC: c, toR: homeRow, toC: 6, piece, castle: "king" });
        }
      }
      if (rights.queenSide && !s.board[homeRow][1] && !s.board[homeRow][2] && !s.board[homeRow][3]) {
        if (!isSquareAttacked(s.board, homeRow, 3, enemy) && !isSquareAttacked(s.board, homeRow, 2, enemy)) {
          if (s.board[homeRow][0] === `${color}R`) moves.push({ fromR: r, fromC: c, toR: homeRow, toC: 2, piece, castle: "queen" });
        }
      }
    }
    return moves;
  }

  for (const [dr, dc] of directions) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = s.board[nr][nc];
      if (!target) moves.push(makeMoveObj(r, c, nr, nc, piece));
      else {
        if (colorOf(target) !== color) moves.push(makeMoveObj(r, c, nr, nc, piece, target));
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return moves;
}

function makeMoveObj(fromR, fromC, toR, toC, piece, capture = null, promotion = null) {
  return { fromR, fromC, toR, toC, piece, capture, promotion };
}

function applyMove(s, move, simulation = false) {
  const board = s.board;
  const movingPiece = board[move.fromR][move.fromC];
  const color = colorOf(movingPiece);
  let capturedPiece = null;

  if (move.enPassant) {
    capturedPiece = board[move.fromR][move.toC];
    board[move.fromR][move.toC] = null;
  } else if (board[move.toR][move.toC]) capturedPiece = board[move.toR][move.toC];

  board[move.fromR][move.fromC] = null;
  board[move.toR][move.toC] = movingPiece;

  if (move.castle === "king") {
    const row = color === "w" ? 7 : 0;
    board[row][5] = board[row][7];
    board[row][7] = null;
  } else if (move.castle === "queen") {
    const row = color === "w" ? 7 : 0;
    board[row][3] = board[row][0];
    board[row][0] = null;
  }

  if (typeOf(movingPiece) === "P" && (move.toR === 0 || move.toR === 7)) board[move.toR][move.toC] = `${color}${move.promotion || "Q"}`;

  if (typeOf(movingPiece) === "K") {
    s.castlingRights[color].kingSide = false;
    s.castlingRights[color].queenSide = false;
  }
  if (typeOf(movingPiece) === "R") {
    if (color === "w" && move.fromR === 7 && move.fromC === 0) s.castlingRights.w.queenSide = false;
    if (color === "w" && move.fromR === 7 && move.fromC === 7) s.castlingRights.w.kingSide = false;
    if (color === "b" && move.fromR === 0 && move.fromC === 0) s.castlingRights.b.queenSide = false;
    if (color === "b" && move.fromR === 0 && move.fromC === 7) s.castlingRights.b.kingSide = false;
  }

  if (capturedPiece && typeOf(capturedPiece) === "R") {
    if (move.toR === 7 && move.toC === 0) s.castlingRights.w.queenSide = false;
    if (move.toR === 7 && move.toC === 7) s.castlingRights.w.kingSide = false;
    if (move.toR === 0 && move.toC === 0) s.castlingRights.b.queenSide = false;
    if (move.toR === 0 && move.toC === 7) s.castlingRights.b.kingSide = false;
  }

  s.enPassant = null;
  if (typeOf(movingPiece) === "P" && Math.abs(move.toR - move.fromR) === 2) s.enPassant = { byColor: color, targetR: (move.fromR + move.toR) / 2, targetC: move.fromC };

  if (!simulation && capturedPiece) {
    if (color === "w") s.capturedByWhite.push(capturedPiece);
    else s.capturedByBlack.push(capturedPiece);
  }
  if (!simulation) {
    s.moveHistory.push(moveToUci(move));
    s.lastMove = { fromR: move.fromR, fromC: move.fromC, toR: move.toR, toC: move.toC };
    playMoveSound(Boolean(capturedPiece));
  } else {
    s.turn = opponent(s.turn);
  }
}

function moveToUci(move) {
  const from = `${FILES[move.fromC]}${8 - move.fromR}`;
  const to = `${FILES[move.toC]}${8 - move.toR}`;
  const promo = move.promotion ? move.promotion.toLowerCase() : "";
  return `${from}${to}${promo}`;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) if (board[r][c] === `${color}K`) return { r, c };
  return null;
}

function isKingInCheck(board, color) {
  const king = findKing(board, color);
  return king ? isSquareAttacked(board, king.r, king.c, opponent(color)) : false;
}

function isSquareAttacked(board, targetR, targetC, byColor) {
  const pawnDir = byColor === "w" ? -1 : 1;
  const pawnRow = targetR - pawnDir;
  for (const dc of [-1, 1]) {
    const c = targetC + dc;
    if (inBounds(pawnRow, c) && board[pawnRow][c] === `${byColor}P`) return true;
  }

  const knightDeltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knightDeltas) {
    const r = targetR + dr;
    const c = targetC + dc;
    if (inBounds(r, c) && board[r][c] === `${byColor}N`) return true;
  }

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = targetR + dr;
      const c = targetC + dc;
      if (inBounds(r, c) && board[r][c] === `${byColor}K`) return true;
    }
  }

  const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr, dc] of diagDirs) {
    let r = targetR + dr;
    let c = targetC + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (colorOf(p) === byColor && (typeOf(p) === "B" || typeOf(p) === "Q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  const straightDirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr, dc] of straightDirs) {
    let r = targetR + dr;
    let c = targetC + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (colorOf(p) === byColor && (typeOf(p) === "R" || typeOf(p) === "Q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function isInsufficientMaterial(board) {
  const pieces = [];
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) if (board[r][c]) pieces.push(board[r][c]);
  if (pieces.length === 2) return true;
  if (pieces.length === 3) return pieces.filter((p) => ["B", "N"].includes(typeOf(p))).length === 1;
  return false;
}

async function chooseAiMoveAsync(s, token) {
  const legal = generateAllLegalMoves(s, "b");
  if (legal.length === 0) return null;
  const cfg = AI_LEVELS[s.level] || AI_LEVELS.medium;

  if (cfg.useBook) {
    const bookMove = chooseOpeningBookMove(s, legal);
    if (bookMove) return bookMove;
  }

  const start = performance.now();
  if (aiTable.size > 140000) aiTable = new Map();
  if (Object.keys(killerMoves).length > 1500) killerMoves = {};
  if (Object.keys(historyHeuristic).length > 35000) historyHeuristic = {};

  const dynamicMaxDepth = legal.length <= 16 ? cfg.maxDepth : Math.max(cfg.baseDepth, cfg.maxDepth - 1);
  let bestMove = legal[0];
  let bestScore = -Infinity;

  for (let depth = 1; depth <= dynamicMaxDepth; depth += 1) {
    if (token !== aiTurnToken || state.gameOver) return null;
    if (performance.now() - start > cfg.timeLimitMs) break;
    let result;

    if (cfg.aspiration && Number.isFinite(bestScore) && depth >= 3) {
      const margin = 60 + depth * 8;
      result = searchRoot(s, depth, start, cfg.timeLimitMs, cfg, bestScore - margin, bestScore + margin);
      if (result.completed && (result.score <= bestScore - margin || result.score >= bestScore + margin)) {
        result = searchRoot(s, depth, start, cfg.timeLimitMs, cfg, -Infinity, Infinity);
      }
    } else {
      result = searchRoot(s, depth, start, cfg.timeLimitMs, cfg, -Infinity, Infinity);
    }

    if (!result || !result.completed) break;
    bestMove = result.move || bestMove;
    bestScore = result.score;

    if (depth >= 2) {
      state.status = `Black (${cfg.label}) thinking... depth ${depth}`;
      render();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (cfg.jitter > 0) {
    const candidates = [];
    for (const m of legal) {
      const test = cloneState(s);
      applyMove(test, m, true);
      const score = evaluateBoardForBlack(test);
      if (score >= bestScore - cfg.jitter) candidates.push(m);
    }
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return bestMove;
}

function chooseOpeningBookMove(s, legalMoves) {
  if (!s.moveHistory || s.moveHistory.length > 14) return null;
  const history = s.moveHistory.join(" ");
  let options = BLACK_OPENING_BOOK[history];

  if (!options) {
    for (let len = Math.min(7, s.moveHistory.length); len >= 1; len -= 1) {
      const key = s.moveHistory.slice(0, len).join(" ");
      if (BLACK_OPENING_BOOK[key]) {
        options = BLACK_OPENING_BOOK[key];
        break;
      }
    }
  }

  if (!options || options.length === 0) return null;
  const legalByUci = new Map(legalMoves.map((m) => [moveToUci(m), m]));
  const candidates = options.map((uci) => legalByUci.get(uci)).filter(Boolean);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function searchRoot(s, depth, startTime, timeLimitMs, cfg, alphaInit = -Infinity, betaInit = Infinity) {
  const moves = generateAllLegalMoves(s, "b");
  orderMoves(s, moves, "b", 0, getHashMove(s, "b", depth));
  let alpha = alphaInit;
  let beta = betaInit;
  let bestMove = null;
  let bestScore = -Infinity;

  for (const move of moves) {
    if (performance.now() - startTime > timeLimitMs) return { completed: false, move: bestMove, score: bestScore };
    const test = cloneState(s);
    applyMove(test, move, true);
    const ext = shouldExtend(move, test) ? 1 : 0;
    const score = minimax(test, depth - 1 + ext, alpha, beta, "w", startTime, timeLimitMs, cfg, 1);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
  }
  return { completed: true, move: bestMove, score: bestScore };
}

function minimax(s, depth, alpha, beta, toMove, startTime, timeLimitMs, cfg, ply) {
  if (performance.now() - startTime > timeLimitMs) return evaluateBoardForBlack(s);

  const alpha0 = alpha;
  const beta0 = beta;
  const probe = probeTransposition(s, toMove, depth, alpha, beta);
  if (probe.hit) return probe.score;

  const moves = generateAllLegalMoves(s, toMove);
  if (moves.length === 0) {
    const terminal = isKingInCheck(s.board, toMove) ? (toMove === "b" ? -MATE_SCORE + ply : MATE_SCORE - ply) : 0;
    storeTransposition(s, toMove, depth, terminal, "exact", null);
    return terminal;
  }

  if (depth <= 0) {
    const q = quiescence(s, alpha, beta, toMove, startTime, timeLimitMs, cfg.qDepth);
    storeTransposition(s, toMove, depth, q, "exact", null);
    return q;
  }

  if (depth >= 3 && !isKingInCheck(s.board, toMove) && hasNonPawnMaterial(s.board, toMove)) {
    const nullState = cloneState(s);
    nullState.turn = opponent(nullState.turn);
    nullState.enPassant = null;
    const reduction = 2;
    const nullScore = minimax(
      nullState,
      depth - 1 - reduction,
      alpha,
      beta,
      opponent(toMove),
      startTime,
      timeLimitMs,
      cfg,
      ply + 1
    );
    if (toMove === "b" && nullScore >= beta) return nullScore;
    if (toMove === "w" && nullScore <= alpha) return nullScore;
  }

  orderMoves(s, moves, toMove, ply, getHashMove(s, toMove, depth));
  let bestMove = null;

  if (toMove === "b") {
    let best = -Infinity;
    for (let i = 0; i < moves.length; i += 1) {
      const move = moves[i];
      const test = cloneState(s);
      applyMove(test, move, true);
      const ext = shouldExtend(move, test) ? 1 : 0;
      let score;
      const canReduce = depth >= 3 && i >= 4 && ext === 0 && !move.capture && !move.promotion && !isKingInCheck(s.board, "b");
      if (canReduce) {
        score = minimax(test, depth - 2, alpha, beta, "w", startTime, timeLimitMs, cfg, ply + 1);
        if (score > alpha) {
          score = minimax(test, depth - 1, alpha, beta, "w", startTime, timeLimitMs, cfg, ply + 1);
        }
      } else {
        score = minimax(test, depth - 1 + ext, alpha, beta, "w", startTime, timeLimitMs, cfg, ply + 1);
      }
      if (score > best) {
        best = score;
        bestMove = move;
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        onBetaCutoff(move, ply, depth);
        break;
      }
    }
    storeTransposition(s, toMove, depth, best, best <= alpha0 ? "upper" : best >= beta0 ? "lower" : "exact", bestMove);
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const test = cloneState(s);
    applyMove(test, move, true);
    const ext = shouldExtend(move, test) ? 1 : 0;
    let score;
    const canReduce = depth >= 3 && i >= 4 && ext === 0 && !move.capture && !move.promotion && !isKingInCheck(s.board, "w");
    if (canReduce) {
      score = minimax(test, depth - 2, alpha, beta, "b", startTime, timeLimitMs, cfg, ply + 1);
      if (score < beta) {
        score = minimax(test, depth - 1, alpha, beta, "b", startTime, timeLimitMs, cfg, ply + 1);
      }
    } else {
      score = minimax(test, depth - 1 + ext, alpha, beta, "b", startTime, timeLimitMs, cfg, ply + 1);
    }
    if (score < best) {
      best = score;
      bestMove = move;
    }
    if (best < beta) beta = best;
    if (alpha >= beta) {
      onBetaCutoff(move, ply, depth);
      break;
    }
  }
  storeTransposition(s, toMove, depth, best, best <= alpha0 ? "upper" : best >= beta0 ? "lower" : "exact", bestMove);
  return best;
}

function quiescence(s, alpha, beta, toMove, startTime, timeLimitMs, depthLeft) {
  if (performance.now() - startTime > timeLimitMs) return evaluateBoardForBlack(s);
  const stand = evaluateBoardForBlack(s);

  if (toMove === "b") {
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
  } else {
    if (stand <= alpha) return alpha;
    if (stand < beta) beta = stand;
  }
  if (depthLeft <= 0) return stand;

  const moves = generateAllLegalMoves(s, toMove).filter((m) => m.capture || m.promotion);
  if (moves.length === 0) return stand;
  orderMoves(s, moves, toMove, 0, null);

  if (toMove === "b") {
    let best = stand;
    for (const move of moves) {
      const test = cloneState(s);
      applyMove(test, move, true);
      const score = quiescence(test, alpha, beta, "w", startTime, timeLimitMs, depthLeft - 1);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = stand;
  for (const move of moves) {
    const test = cloneState(s);
    applyMove(test, move, true);
    const score = quiescence(test, alpha, beta, "b", startTime, timeLimitMs, depthLeft - 1);
    if (score < best) best = score;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

function shouldExtend(move, positionAfterMove) {
  if (move.capture || move.promotion) return true;
  return isKingInCheck(positionAfterMove.board, positionAfterMove.turn);
}

function moveKey(move) {
  return `${move.fromR}${move.fromC}${move.toR}${move.toC}${move.promotion || ""}${move.castle || ""}${move.enPassant ? "e" : ""}`;
}

function onBetaCutoff(move, ply, depth) {
  if (move.capture) return;
  const key = moveKey(move);
  if (!killerMoves[ply]) killerMoves[ply] = [];
  if (!killerMoves[ply].includes(key)) {
    killerMoves[ply].unshift(key);
    killerMoves[ply] = killerMoves[ply].slice(0, 2);
  }
  const hKey = `${move.piece || "x"}_${move.toR}_${move.toC}`;
  historyHeuristic[hKey] = (historyHeuristic[hKey] || 0) + depth * depth;
}

function orderMoves(s, moves, sideToMove, ply, hashMove) {
  const hashKey = hashMove ? moveKey(hashMove) : null;
  const scored = moves.map((m) => {
    let score = 0;
    const key = moveKey(m);
    if (hashKey && key === hashKey) score += 90000;
    if (m.capture) {
      const victim = PIECE_VALUES[typeOf(m.capture)] || 0;
      const attacker = PIECE_VALUES[typeOf(s.board[m.fromR][m.fromC])] || 0;
      score += 12000 + victim - attacker;
    }
    if (m.promotion) score += 9000;
    if (m.castle) score += 800;
    if (m.enPassant) score += 700;
    const killers = killerMoves[ply] || [];
    if (!m.capture && killers.includes(key)) score += 6000;
    score += historyHeuristic[`${m.piece || "x"}_${m.toR}_${m.toC}`] || 0;
    const test = cloneState(s);
    applyMove(test, m, true);
    if (isKingInCheck(test.board, opponent(sideToMove))) score += 1800;
    if (isSquareAttacked(test.board, m.toR, m.toC, opponent(sideToMove))) score -= 120;
    return { m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  for (let i = 0; i < scored.length; i += 1) moves[i] = scored[i].m;
}

function boardHash(s, toMove) {
  const rows = s.board.map((r) => r.map((x) => x || "..").join("")).join("/");
  const castling = `${s.castlingRights.w.kingSide ? "K" : ""}${s.castlingRights.w.queenSide ? "Q" : ""}${s.castlingRights.b.kingSide ? "k" : ""}${s.castlingRights.b.queenSide ? "q" : ""}` || "-";
  const ep = s.enPassant ? `${s.enPassant.targetR}${s.enPassant.targetC}` : "-";
  return `${rows}|${toMove}|${castling}|${ep}`;
}

function probeTransposition(s, toMove, depth, alpha, beta) {
  const entry = aiTable.get(boardHash(s, toMove));
  if (!entry || entry.depth < depth) return { hit: false, score: 0 };
  if (entry.flag === "exact") return { hit: true, score: entry.score };
  if (entry.flag === "lower" && entry.score >= beta) return { hit: true, score: entry.score };
  if (entry.flag === "upper" && entry.score <= alpha) return { hit: true, score: entry.score };
  return { hit: false, score: 0 };
}

function storeTransposition(s, toMove, depth, score, flag, bestMove) {
  aiTable.set(boardHash(s, toMove), { depth, score, flag, bestMove: bestMove ? { ...bestMove } : null });
}

function getHashMove(s, toMove, depth) {
  const entry = aiTable.get(boardHash(s, toMove));
  if (!entry || !entry.bestMove || entry.depth < depth) return null;
  return entry.bestMove;
}

function evaluateBoardForBlack(s) {
  let score = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  let whiteQueens = 0;
  let blackQueens = 0;
  const pawnFilesW = Array(8).fill(0);
  const pawnFilesB = Array(8).fill(0);
  const whitePawns = [];
  const blackPawns = [];

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = s.board[r][c];
      if (!p) continue;
      const color = colorOf(p);
      const type = typeOf(p);
      const base = PIECE_VALUES[type] || 0;
      const pst = pieceSquare(type, color, r, c);
      const val = base + pst;
      if (color === "b") {
        score += val;
        if (type === "B") blackBishops += 1;
        if (type === "Q") blackQueens += 1;
        if (type === "P") {
          pawnFilesB[c] += 1;
          blackPawns.push({ r, c });
        }
      } else {
        score -= val;
        if (type === "B") whiteBishops += 1;
        if (type === "Q") whiteQueens += 1;
        if (type === "P") {
          pawnFilesW[c] += 1;
          whitePawns.push({ r, c });
        }
      }
    }
  }

  if (blackBishops >= 2) score += 42;
  if (whiteBishops >= 2) score -= 42;
  score += (countPseudoMobility(s, "b") - countPseudoMobility(s, "w")) * 3;

  score += evaluatePawnStructure(blackPawns, whitePawns, pawnFilesB, pawnFilesW);
  score += evaluatePassedPawns(blackPawns, whitePawns);
  score += evaluateRookFiles(s.board, pawnFilesB, pawnFilesW);

  if (isKingInCheck(s.board, "w")) score += 50;
  if (isKingInCheck(s.board, "b")) score -= 50;
  score += evaluateKingSafety(s.board, "b", blackQueens, whiteQueens);
  score -= evaluateKingSafety(s.board, "w", whiteQueens, blackQueens);

  if (isSimpleEndgame(s.board)) {
    const bk = findKing(s.board, "b");
    const wk = findKing(s.board, "w");
    if (bk) score += kingCentralBonus(bk.r, bk.c);
    if (wk) score -= kingCentralBonus(wk.r, wk.c);
  }
  return score;
}

function pieceSquare(type, color, r, c) {
  const table = PST[type];
  if (!table) return 0;
  return table[color === "w" ? r : 7 - r][c];
}

function isSimpleEndgame(board) {
  let nonKing = 0;
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
    const p = board[r][c];
    if (p && typeOf(p) !== "K") nonKing += PIECE_VALUES[typeOf(p)] || 0;
  }
  return nonKing <= 2600;
}

function kingCentralBonus(r, c) {
  const d = Math.abs(3.5 - r) + Math.abs(3.5 - c);
  return Math.round((7 - d) * 4);
}

function countPseudoMobility(s, color) {
  let mobility = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = s.board[r][c];
      if (p && colorOf(p) === color) mobility += generatePseudoMoves(s, r, c, p).length;
    }
  }
  return mobility;
}

function evaluatePawnStructure(blackPawns, whitePawns, pawnFilesB, pawnFilesW) {
  let score = 0;

  for (const p of blackPawns) {
    if (pawnFilesB[p.c] > 1) score -= 12;
    const isolated = (p.c === 0 || pawnFilesB[p.c - 1] === 0) && (p.c === 7 || pawnFilesB[p.c + 1] === 0);
    if (isolated) score -= 14;
  }

  for (const p of whitePawns) {
    if (pawnFilesW[p.c] > 1) score += 12;
    const isolated = (p.c === 0 || pawnFilesW[p.c - 1] === 0) && (p.c === 7 || pawnFilesW[p.c + 1] === 0);
    if (isolated) score += 14;
  }
  return score;
}

function evaluatePassedPawns(blackPawns, whitePawns) {
  let score = 0;

  for (const p of blackPawns) {
    let blocked = false;
    for (const wp of whitePawns) {
      if (Math.abs(wp.c - p.c) <= 1 && wp.r > p.r) {
        blocked = true;
        break;
      }
    }
    if (!blocked) score += (p.r - 1) * 9;
  }

  for (const p of whitePawns) {
    let blocked = false;
    for (const bp of blackPawns) {
      if (Math.abs(bp.c - p.c) <= 1 && bp.r < p.r) {
        blocked = true;
        break;
      }
    }
    if (!blocked) score -= (6 - p.r) * 9;
  }

  return score;
}

function evaluateRookFiles(board, pawnFilesB, pawnFilesW) {
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (!p || typeOf(p) !== "R") continue;
      const ownPawns = colorOf(p) === "b" ? pawnFilesB[c] : pawnFilesW[c];
      const oppPawns = colorOf(p) === "b" ? pawnFilesW[c] : pawnFilesB[c];
      if (ownPawns === 0 && oppPawns === 0) score += colorOf(p) === "b" ? 22 : -22;
      else if (ownPawns === 0) score += colorOf(p) === "b" ? 10 : -10;
    }
  }
  return score;
}

function evaluateKingSafety(board, color, ownQueens, oppQueens) {
  const king = findKing(board, color);
  if (!king) return 0;

  const around = color === "w" ? [[-1, -1], [-1, 0], [-1, 1]] : [[1, -1], [1, 0], [1, 1]];
  let pawnShield = 0;
  for (const [dr, dc] of around) {
    const r = king.r + dr;
    const c = king.c + dc;
    if (!inBounds(r, c)) continue;
    if (board[r][c] === `${color}P`) pawnShield += 1;
  }

  let score = pawnShield * 10;
  if (ownQueens === 0 && oppQueens === 0) score += 8;
  if (oppQueens > 0 && pawnShield <= 1) score -= 25;
  return score;
}

function hasNonPawnMaterial(board, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (!p || colorOf(p) !== color) continue;
      const t = typeOf(p);
      if (t !== "P" && t !== "K") return true;
    }
  }
  return false;
}

function playMoveSound(isCapture) {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = isCapture ? "triangle" : "sine";
    osc.frequency.setValueAtTime(isCapture ? 420 : 700, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isCapture ? 0.2 : 0.12));

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + (isCapture ? 0.22 : 0.14));
  } catch (_) {
    // Ignore audio failures in restricted environments.
  }
}

function startNewGame() {
  aiTurnToken += 1;
  const level = levelSelectEl.value in AI_LEVELS ? levelSelectEl.value : "medium";
  const seconds = Number(timeSelectEl.value) || 300;
  state = createInitialState(level, seconds);
  aiTable = new Map();
  killerMoves = {};
  historyHeuristic = {};
  hideGameOverModal();
  stopAiClockTicker();
  stopClockTicker();
  startClockTicker();
  render();
}

newGameBtn.addEventListener("click", startNewGame);
resignBtn.addEventListener("click", () => {
  if (state.gameOver) return;
  endGame("White resigned. Black wins.", "Black Wins", "White resigned.");
});

levelSelectEl.addEventListener("change", () => {
  if (!state) return;
  state.level = levelSelectEl.value in AI_LEVELS ? levelSelectEl.value : "medium";
  if (!state.gameOver) {
    state.status = `Level switched to ${AI_LEVELS[state.level].label}.`;
    render();
  }
});

timeSelectEl.addEventListener("change", () => {
  if (!state || state.gameOver) return;
  state.status = "Time control will apply on New Game.";
  render();
});

modalNewGameBtnEl.addEventListener("click", () => {
  startNewGame();
});

modalCloseBtnEl.addEventListener("click", () => {
  hideGameOverModal();
});

gameOverModalEl.addEventListener("click", (e) => {
  if (e.target === gameOverModalEl) hideGameOverModal();
});

startNewGame();
