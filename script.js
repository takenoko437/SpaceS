(function () {
  "use strict";

  const SIZE = 5;

  // ---------- 五十音マッピング ----------
  // 一番右の列(c=4)があ行。左へ向かって か・さ・た・な 行が並ぶ。
  // 縦(上から)は各行内の あ・い・う・え・お 段の順。
  const COLUMN_CHARS = [
    ["な", "に", "ぬ", "ね", "の"], // c=0
    ["た", "ち", "つ", "て", "と"], // c=1
    ["さ", "し", "す", "せ", "そ"], // c=2
    ["か", "き", "く", "け", "こ"], // c=3
    ["あ", "い", "う", "え", "お"]  // c=4
  ];

  function hiraganaAt(r, c) {
    return COLUMN_CHARS[c][r];
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  // ---------- 盤面 ----------
  // board[r][c] = null か、{kind, promoted, r, c, isKing?} のオブジェクト
  const board = [];
  for (let r = 0; r < SIZE; r++) {
    board.push(new Array(SIZE).fill(null));
  }

  // 敵玉：初期状態で「す」の位置に固定配置。動かせない・成れない。
  const KING = { kind: "king", promoted: false, r: 2, c: 2, isKing: true };
  board[KING.r][KING.c] = KING;

  // ---------- 持ち駒の定義 ----------
  // kind: 'gin'(銀) または 'kaku'(角)
  const stock = [
    { kind: "gin", promoted: false, placed: false },
    { kind: "gin", promoted: false, placed: false },
    { kind: "kaku", promoted: false, placed: false }
  ];

  function pieceLabel(piece) {
    if (piece.isKing) return "〇";
    if (piece.kind === "gin") return piece.promoted ? "🥇" : "🥈";
    return piece.promoted ? "🐎" : "∠"; // kaku
  }

  let selectedIdx = null; // 選択中の持ち駒のインデックス
  let gameOver = false;

  // ---------- DOM構築 ----------
  const boardEl = document.getElementById("board");
  const cellEls = [];
  for (let r = 0; r < SIZE; r++) {
    const rowEls = [];
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.addEventListener("click", () => onCellClick(r, c));
      boardEl.appendChild(cell);
      rowEls.push(cell);
    }
    cellEls.push(rowEls);
  }

  const stockListEl = document.getElementById("stock-list");
  const stockEls = stock.map((piece, idx) => {
    const btn = document.createElement("button");
    btn.className = "stock-btn";
    btn.addEventListener("click", () => onStockClick(idx));
    stockListEl.appendChild(btn);
    return btn;
  });

  const bigSquareEl = document.getElementById("big-square");
  bigSquareEl.addEventListener("click", onBigSquareClick);

  const clearImg = document.getElementById("clear-img");

  // ---------- 操作 ----------
  function onStockClick(idx) {
    if (gameOver) return;
    const piece = stock[idx];
    if (piece.placed) return;

    if (selectedIdx === idx) {
      selectedIdx = null; // もう一度押したら選択解除
    } else {
      selectedIdx = idx;
    }
    render();
  }

  function onCellClick(r, c) {
    if (gameOver) return;
    if (selectedIdx === null) return;
    if (board[r][c]) return; // 既に駒(敵玉含む)がある

    const piece = stock[selectedIdx];
    piece.placed = true;
    piece.r = r;
    piece.c = c;
    board[r][c] = piece;
    selectedIdx = null;

    render();
  }

  function onBigSquareClick() {
    if (gameOver) return;
    if (selectedIdx === null) return;
    const piece = stock[selectedIdx];
    if (piece.placed) return;
    piece.promoted = true; // 銀→金、角→馬 （一方通行）
    render();
  }

  // ---------- 駒の攻撃範囲(利き)の計算 ----------
  // 戻り値: そのマスが Set のキー "r,c" として登録される
  function addAttack(set, r, c) {
    set.add(r + "," + c);
  }

  function attackSquaresFor(piece) {
    const set = new Set();
    const { r, c, kind, promoted } = piece;

    if (kind === "gin" && !promoted) {
      // 銀将：単騎5方向
      const deltas = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [1, -1],
        [1, 1]
      ];
      deltas.forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (inBounds(nr, nc)) addAttack(set, nr, nc);
      });
      return set;
    }

    if (kind === "gin" && promoted) {
      // 成銀＝金将の動き：単騎6方向
      const deltas = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, 0]
      ];
      deltas.forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (inBounds(nr, nc)) addAttack(set, nr, nc);
      });
      return set;
    }

    // 角(角行)・馬(竜馬)：斜め4方向へ、駒にぶつかるまで滑る
    const diagDirs = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];
    diagDirs.forEach(([dr, dc]) => {
      let nr = r + dr,
        nc = c + dc;
      while (inBounds(nr, nc)) {
        addAttack(set, nr, nc);
        if (board[nr][nc]) break; // 駒があればそこで止まる(その駒のマスは含む)
        nr += dr;
        nc += dc;
      }
    });

    if (kind === "kaku" && promoted) {
      // 馬(竜馬)：角の動き＋上下左右に1マス
      const ortho = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ];
      ortho.forEach(([dr, dc]) => {
        const nr = r + dr,
          nc = c + dc;
        if (inBounds(nr, nc)) addAttack(set, nr, nc);
      });
    }

    return set;
  }

  function unionAttackSquares() {
    const all = new Set();
    stock.forEach((piece) => {
      if (!piece.placed) return;
      attackSquaresFor(piece).forEach((key) => all.add(key));
    });
    return all;
  }

  // ---------- 王手・逃げ場所の判定 ----------
  function attackedSquaresExcluding(excludePiece) {
    const set = new Set();
    stock.forEach((piece) => {
      if (!piece.placed) return;
      if (piece === excludePiece) return;
      attackSquaresFor(piece).forEach((key) => set.add(key));
    });
    return set;
  }

  function computeCheckStatus() {
    const attacked = unionAttackSquares();
    const kingKey = KING.r + "," + KING.c;
    const inCheck = attacked.has(kingKey);
    if (!inCheck) return { inCheck: false, escapeSquares: [] };

    const kingMoves = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1]
    ];

    const escapes = [];
    kingMoves.forEach(([dr, dc]) => {
      const nr = KING.r + dr,
        nc = KING.c + dc;
      if (!inBounds(nr, nc)) return;

      const occupant = board[nr][nc]; // 敵玉はこちらの駒を取って移動できる

      // 玉が動くと、元いたマス(KING.r, KING.c)を塞いでいた効果も無くなる。
      // (それまで玉自身に遮られていた駒の利きが、玉が居なくなることで奥まで伸びる)
      // 取った場合はその駒も盤上から一時的に取り除いて利きを再計算する。
      const originalKingSquare = board[KING.r][KING.c];
      board[KING.r][KING.c] = null;
      if (occupant) board[nr][nc] = null;

      const attackedHere = attackedSquaresExcluding(occupant);

      board[KING.r][KING.c] = originalKingSquare;
      if (occupant) board[nr][nc] = occupant;

      if (!attackedHere.has(nr + "," + nc)) {
        escapes.push({ r: nr, c: nc });
      }
    });

    return { inCheck: true, escapeSquares: escapes };
  }

  function sortSquares(squares) {
    // 五十音表で後ろから： c 昇順(な→た→さ→か→あ)、同じcなら r 降順(お段→あ段)
    return squares.slice().sort((a, b) => {
      if (a.c !== b.c) return a.c - b.c;
      return b.r - a.r;
    });
  }

  // ---------- 描画 ----------
  function render() {
    // 盤面
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cellEl = cellEls[r][c];
        const piece = board[r][c];
        cellEl.classList.remove("occupied", "piece-red", "king-cell");
        if (piece) {
          cellEl.textContent = pieceLabel(piece);
          cellEl.classList.add("occupied");
          if (piece.isKing) cellEl.classList.add("king-cell");
          else if (piece.promoted) cellEl.classList.add("piece-red");
        } else {
          cellEl.textContent = "";
        }
      }
    }

    // 持ち駒
    stock.forEach((piece, idx) => {
      const el = stockEls[idx];
      el.classList.toggle("selected", selectedIdx === idx);
      el.classList.toggle("promoted", piece.promoted && !piece.placed);
      el.classList.toggle("consumed", piece.placed);
      el.textContent = piece.placed ? "✕" : pieceLabel(piece);
    });

    updateStatus();
  }

  function updateStatus() {
    const { inCheck, escapeSquares } = computeCheckStatus();

    if (!inCheck) {
      bigSquareEl.textContent = "";
      return;
    }

    const sorted = sortSquares(escapeSquares);
    const chars = sorted.map(({ r, c }) => hiraganaAt(r, c));

    let text;
    if (chars.length >= 4) {
      text = "多数";
    } else if (chars.length === 0) {
      text = "";
    } else {
      text = chars.join("か");
    }

    bigSquareEl.textContent = text;

    if (text === "しかく") {
      gameOver = true;
      setTimeout(() => {
        clearImg.classList.add("show");
      }, 50);
    }
  }

  render();
})();
