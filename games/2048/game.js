(() => {
  const SIZE = 4;
  const COLORS = {
    2: "#99f6e4",
    4: "#5eead4",
    8: "#fdba74",
    16: "#fb923c",
    32: "#f97316",
    64: "#ea580c",
    128: "#fde68a",
    256: "#fcd34d",
    512: "#fbbf24",
    1024: "#f59e0b",
    2048: "#facc15",
  };

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("message");

  // The portal loads games in a sandboxed iframe with an opaque origin,
  // where localStorage throws, so the best score falls back to memory.
  const storage = {
    get() {
      try {
        return Number(localStorage.getItem("2048.best")) || 0;
      } catch {
        return 0;
      }
    },
    set(value) {
      try {
        localStorage.setItem("2048.best", String(value));
      } catch {}
    },
  };

  // Each line lists cell indices starting from the edge the tiles slide toward.
  const LINES = { left: [], right: [], up: [], down: [] };
  for (let i = 0; i < SIZE; i++) {
    const row = [];
    const col = [];
    for (let j = 0; j < SIZE; j++) {
      row.push(i * SIZE + j);
      col.push(j * SIZE + i);
    }
    LINES.left.push(row);
    LINES.right.push([...row].reverse());
    LINES.up.push(col);
    LINES.down.push([...col].reverse());
  }

  const cells = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = document.createElement("div");
    el.className = "cell";
    boardEl.appendChild(el);
    cells.push(el);
  }

  let grid, score, best, state, won;

  function reset() {
    grid = new Array(SIZE * SIZE).fill(0);
    score = 0;
    won = false;
    state = "playing";
    scoreEl.textContent = "0";
    messageEl.textContent = "Use the arrow keys or swipe to slide the tiles";
    const fresh = [addTile(), addTile()];
    render(fresh, []);
  }

  function addTile() {
    const empty = [];
    grid.forEach((v, i) => v === 0 && empty.push(i));
    if (empty.length === 0) return -1;
    const i = empty[Math.floor(Math.random() * empty.length)];
    grid[i] = Math.random() < 0.9 ? 2 : 4;
    return i;
  }

  function move(direction) {
    if (state !== "playing") return;
    let moved = false;
    let justWon = false;
    const merged = [];

    for (const line of LINES[direction]) {
      const values = line.map((i) => grid[i]).filter((v) => v !== 0);
      const out = [];
      for (let k = 0; k < values.length; k++) {
        if (values[k] === values[k + 1]) {
          const v = values[k] * 2;
          out.push(v);
          score += v;
          if (v === 2048 && !won) {
            won = true;
            justWon = true;
          }
          merged.push(line[out.length - 1]);
          k++;
        } else {
          out.push(values[k]);
        }
      }
      line.forEach((cellIndex, k) => {
        const v = out[k] || 0;
        if (grid[cellIndex] !== v) moved = true;
        grid[cellIndex] = v;
      });
    }

    if (!moved) return;

    const fresh = addTile();
    scoreEl.textContent = String(score);
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      storage.set(best);
    }
    render([fresh], merged);

    if (justWon) {
      messageEl.textContent = "You made 2048! Keep going for a higher score";
    }
    if (!canMove()) {
      state = "over";
      messageEl.textContent = `No moves left. Score ${score}. Press Space or tap to play again`;
    }
  }

  function canMove() {
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 0) return true;
      const x = i % SIZE;
      if (x < SIZE - 1 && grid[i] === grid[i + 1]) return true;
      if (i + SIZE < grid.length && grid[i] === grid[i + SIZE]) return true;
    }
    return false;
  }

  function render(fresh, merged) {
    grid.forEach((v, i) => {
      const el = cells[i];
      el.textContent = v ? String(v) : "";
      el.style.background = v ? COLORS[v] || "#e7e9ee" : "";
      const digits = String(v).length;
      el.className = "cell" + (digits === 3 ? " long" : digits >= 4 ? " longer" : "");
      // Restart the CSS animation by forcing a reflow before adding the class.
      if (fresh.includes(i) || merged.includes(i)) {
        void el.offsetWidth;
        el.classList.add(fresh.includes(i) ? "new" : "merged");
      }
    });
  }

  const KEYS = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "over") reset();
      return;
    }
    if (e.code === "KeyN") {
      reset();
      return;
    }
    const d = KEYS[e.code];
    if (!d) return;
    e.preventDefault();
    move(d);
  });

  let touchStart = null;
  window.addEventListener("pointerdown", (e) => {
    touchStart = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("pointerup", (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      if (state === "over") reset();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  });

  // Take keyboard focus so arrow keys work without clicking into the iframe first.
  window.focus();

  best = storage.get();
  bestEl.textContent = String(best);
  reset();
})();
