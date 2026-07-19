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

  // ---------- 持ち駒の定義 ----------
  // kind: 'kei'(桂 / 表示は「馬」) または 'fu'(歩)
  const stock = [
    { kind: "kei", promoted: false, placed: false },
    { kind: "kei", promoted: false, placed: false },
    { kind: "fu", promoted: false, placed: false },
    { kind: "fu", promoted: false, placed: false },
    { kind: "fu", promoted: false, placed: false }
  ];

  function pieceLabel(piece) {
    if (piece.kind === "kei") return piece.promoted ? "金" : "馬";
    return piece.promoted ? "と" : "歩";
  }

  function isRed(piece) {
    return piece.promoted;
  }

  // ---------- 盤面 ----------
  // board[r][c] = null または stock配列の要素への参照
  const board = [];
  for (let r = 0; r < SIZE; r++) {
    board.push(new Array(SIZE).fill(null));
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
    if (board[r][c]) return; // 既に駒がある

    const piece = stock[selectedIdx];
    piece.placed = true;
    piece.r = r;
    piece.c = c;
    board[r][c] = piece;
    selectedIdx = null;

    render();
    checkAllPlaced();
  }

  function onBigSquareClick() {
    if (gameOver) return;
    if (selectedIdx === null) return;
    const piece = stock[selectedIdx];
    if (piece.placed) return;
    piece.promoted = true; // 桂→金、歩→と （一方通行）
    render();
  }

  // ---------- 可動域の計算 ----------
  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function destinationsFor(piece) {
    const { r, c } = piece;
    let deltas;
    if (piece.kind === "kei" && !piece.promoted) {
      // 桂馬：2つ前進して左右どちらかに1つ
      deltas = [
        [-2, -1],
        [-2, 1]
      ];
    } else if (piece.kind === "fu" && !piece.promoted) {
      // 歩兵：1つ前進のみ
      deltas = [[-1, 0]];
    } else {
      // 金将の動き（桂→金、歩→と はどちらも金と同じ動き）
      deltas = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, 0]
      ];
    }

    const result = [];
    deltas.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) return;
      if (board[nr][nc]) return; // 他の駒がいるマスへは行けない
      result.push([nr, nc]);
    });
    return result;
  }

  function computeReachableChars() {
    const squareSet = new Set();
    stock.forEach((piece) => {
      if (!piece.placed) return;
      destinationsFor(piece).forEach(([r, c]) => {
        squareSet.add(r + "," + c);
      });
    });

    const squares = Array.from(squareSet).map((key) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c };
    });

    // 五十音表で後ろから： c 昇順(な→た→さ→か→あ)、同じcなら r 降順(お段→あ段)
    squares.sort((a, b) => {
      if (a.c !== b.c) return a.c - b.c;
      return b.r - a.r;
    });

    return squares.map(({ r, c }) => hiraganaAt(r, c));
  }

  // ---------- 描画 ----------
  function render() {
    // 盤面
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cellEl = cellEls[r][c];
        const piece = board[r][c];
        if (piece) {
          cellEl.textContent = pieceLabel(piece);
          cellEl.classList.add("occupied");
          cellEl.classList.toggle("piece-red", isRed(piece));
        } else {
          cellEl.textContent = "";
          cellEl.classList.remove("occupied", "piece-red");
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
  }

  function checkAllPlaced() {
    const allPlaced = stock.every((p) => p.placed);
    if (!allPlaced) {
      bigSquareEl.textContent = "";
      bigSquareEl.classList.remove("result-red");
      return;
    }

    const chars = computeReachableChars();
    let text;
    if (chars.length >= 4) {
      text = "多数";
    } else if (chars.length === 0) {
      text = "";
    } else {
      text = chars.join("か");
    }

    bigSquareEl.textContent = text;
    bigSquareEl.classList.remove("result-red");

    if (text === "しかく") {
      gameOver = true;
      setTimeout(() => {
        clearImg.classList.add("show");
      }, 50);
    }
  }

  render();
})();
