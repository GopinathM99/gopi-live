(() => {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 24; // board is 240x480; the side panel fills the rest of the canvas
  const PANEL_X = COLS * CELL + 16;
  const LINE_POINTS = [0, 100, 300, 500, 800];

  const PIECES = {
    I: { color: "#5eead4", cells: [[0, 1], [1, 1], [2, 1], [3, 1]], size: 4 },
    O: { color: "#facc15", cells: [[1, 0], [2, 0], [1, 1], [2, 1]], size: 4 },
    T: { color: "#c084fc", cells: [[1, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
    S: { color: "#4ade80", cells: [[1, 0], [2, 0], [0, 1], [1, 1]], size: 3 },
    Z: { color: "#f87171", cells: [[0, 0], [1, 0], [1, 1], [2, 1]], size: 3 },
    J: { color: "#60a5fa", cells: [[0, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
    L: { color: "#f97316", cells: [[2, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
  };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("message");

  // The portal loads games in a sandboxed iframe with an opaque origin,
  // where localStorage throws, so the best score falls back to memory.
  const storage = {
    get() {
      try {
        return Number(localStorage.getItem("blocks.best")) || 0;
      } catch {
        return 0;
      }
    },
    set(value) {
      try {
        localStorage.setItem("blocks.best", String(value));
      } catch {}
    },
  };

  let board, piece, nextType, bag, score, lines, level, best, state, dropAcc, lastTime;

  function reset() {
    board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    dropAcc = 0;
    nextType = takeFromBag();
    spawn();
    updateHud();
  }

  // 7-bag randomizer: every piece shows up once per seven, so droughts stay short.
  function takeFromBag() {
    if (bag.length === 0) {
      bag = Object.keys(PIECES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function spawn() {
    const type = nextType;
    nextType = takeFromBag();
    const def = PIECES[type];
    piece = {
      type,
      cells: def.cells.map(([x, y]) => [x, y]),
      size: def.size,
      x: Math.floor((COLS - def.size) / 2),
      y: type === "I" ? -1 : 0,
    };
    if (collides(piece.cells, piece.x, piece.y)) {
      gameOver();
    }
  }

  function collides(cells, px, py) {
    return cells.some(([cx, cy]) => {
      const x = px + cx;
      const y = py + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      return y >= 0 && board[y][x] !== null;
    });
  }

  function tryMove(dx, dy) {
    if (!collides(piece.cells, piece.x + dx, piece.y + dy)) {
      piece.x += dx;
      piece.y += dy;
      return true;
    }
    return false;
  }

  function rotate() {
    if (piece.type === "O") return;
    // Rotate clockwise inside the piece's bounding box.
    const n = piece.size - 1;
    const rotated = piece.cells.map(([x, y]) => [n - y, x]);
    // Simple wall kicks: nudge sideways, then up, so rotating against a wall or floor works.
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
      if (!collides(rotated, piece.x + dx, piece.y + dy)) {
        piece.cells = rotated;
        piece.x += dx;
        piece.y += dy;
        return;
      }
    }
  }

  function softDrop() {
    if (tryMove(0, 1)) {
      score += 1;
      dropAcc = 0;
    } else {
      lock();
    }
    updateHud();
  }

  function hardDrop() {
    let dist = 0;
    while (tryMove(0, 1)) dist++;
    score += dist * 2;
    lock();
    updateHud();
  }

  function lock() {
    const color = PIECES[piece.type].color;
    for (const [cx, cy] of piece.cells) {
      const y = piece.y + cy;
      if (y < 0) {
        gameOver();
        return;
      }
      board[y][piece.x + cx] = color;
    }

    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((c) => c !== null)) {
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
        y++; // re-check the row that just moved down into this slot
      }
    }
    if (cleared) {
      score += LINE_POINTS[cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
    }
    dropAcc = 0;
    spawn();
  }

  function dropInterval() {
    return Math.max(70, 800 - (level - 1) * 75);
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
  }

  function gameOver() {
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      storage.set(best);
    }
    setState("over");
  }

  function setState(next) {
    state = next;
    if (state === "running") {
      messageEl.textContent = "";
      lastTime = performance.now();
    } else if (state === "paused") {
      messageEl.textContent = "Paused. Press P or tap to resume";
    } else if (state === "over") {
      messageEl.textContent = `Game over. Score ${score}. Press Enter or tap to play again`;
    } else {
      messageEl.textContent = "Press Enter or tap to start";
    }
    draw();
  }

  function startOrToggle() {
    if (state === "running") setState("paused");
    else if (state === "over") {
      reset();
      setState("running");
    } else setState("running");
  }

  function frame(now) {
    if (state === "running") {
      dropAcc += now - lastTime;
      lastTime = now;
      if (dropAcc >= dropInterval()) {
        dropAcc = 0;
        if (!tryMove(0, 1)) lock();
      }
      draw();
    }
    requestAnimationFrame(frame);
  }

  function drawCell(x, y, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.fillStyle = "#111823";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Board well and faint grid.
    ctx.fillStyle = "#0d131c";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = "#16202e";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(x * CELL, y * CELL, board[y][x]);
      }
    }

    if (state !== "over") {
      const color = PIECES[piece.type].color;
      let ghostY = piece.y;
      while (!collides(piece.cells, piece.x, ghostY + 1)) ghostY++;
      for (const [cx, cy] of piece.cells) {
        if (ghostY + cy >= 0) drawCell((piece.x + cx) * CELL, (ghostY + cy) * CELL, color, 0.2);
      }
      for (const [cx, cy] of piece.cells) {
        if (piece.y + cy >= 0) drawCell((piece.x + cx) * CELL, (piece.y + cy) * CELL, color);
      }
    }

    // Side panel: next piece preview.
    ctx.fillStyle = "#9aa1b2";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", (PANEL_X - 8 + canvas.width) / 2, 24);
    ctx.textAlign = "left";
    // Center the preview in the panel at a slightly smaller scale.
    const next = PIECES[nextType];
    const s = CELL * 0.7;
    const xs = next.cells.map(([cx]) => cx);
    const ys = next.cells.map(([, cy]) => cy);
    const offX = PANEL_X - 8 + (canvas.width - PANEL_X + 8 - (Math.max(...xs) - Math.min(...xs) + 1) * s) / 2;
    const offY = 40 + (2 - (Math.max(...ys) - Math.min(...ys) + 1)) * s / 2;
    ctx.fillStyle = next.color;
    for (const [cx, cy] of next.cells) {
      ctx.fillRect(offX + (cx - Math.min(...xs)) * s + 1, offY + (cy - Math.min(...ys)) * s + 1, s - 2, s - 2);
    }

    if (state === "paused" || state === "ready") {
      ctx.fillStyle = "rgba(11, 15, 20, 0.6)";
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = "#e7e9ee";
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state === "paused" ? "PAUSED" : "BLOCKS", (COLS * CELL) / 2, (ROWS * CELL) / 2);
      ctx.textAlign = "left";
    } else if (state === "over") {
      ctx.fillStyle = "rgba(11, 15, 20, 0.6)";
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = "#f97316";
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", (COLS * CELL) / 2, (ROWS * CELL) / 2);
      ctx.textAlign = "left";
    }
  }

  function act(action) {
    if (action === "pause") {
      startOrToggle();
      return;
    }
    if (state !== "running") {
      if (state !== "paused") startOrToggle();
      return;
    }
    if (action === "left") tryMove(-1, 0);
    else if (action === "right") tryMove(1, 0);
    else if (action === "down") softDrop();
    else if (action === "rotate") rotate();
    else if (action === "drop") hardDrop();
    draw();
  }

  const KEYS = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowDown: "down",
    KeyS: "down",
    ArrowUp: "rotate",
    KeyW: "rotate",
    KeyX: "rotate",
    Space: "drop",
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" || e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (e.code === "Enter" && state === "running") return;
      if (e.code === "Escape" && state !== "running") return;
      startOrToggle();
      return;
    }
    const action = KEYS[e.code];
    if (!action) return;
    e.preventDefault();
    // Holding a key auto-repeats moves, but a held drop or rotate shouldn't fire again.
    if (e.repeat && (action === "drop" || action === "rotate")) return;
    if (state === "running") act(action);
  });

  // Touch buttons repeat while held, like a held arrow key.
  let repeatTimer = null;
  function stopRepeat() {
    clearTimeout(repeatTimer);
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  document.querySelectorAll(".pad button").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      act(action);
      stopRepeat();
      if (action === "left" || action === "right" || action === "down") {
        repeatTimer = setTimeout(() => {
          repeatTimer = setInterval(() => act(action), 60);
        }, 180);
      }
    });
    btn.addEventListener("pointerup", stopRepeat);
    btn.addEventListener("pointerleave", stopRepeat);
    btn.addEventListener("pointercancel", stopRepeat);
  });

  // Tapping the board rotates while playing; otherwise it starts, resumes, or restarts.
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "running") act("rotate");
    else startOrToggle();
  });

  // Take keyboard focus so arrow keys work without clicking into the iframe first.
  window.focus();

  best = storage.get();
  bestEl.textContent = String(best);
  reset();
  setState("ready");
  requestAnimationFrame(frame);
})();
