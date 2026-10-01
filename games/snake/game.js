(() => {
  const GRID = 20;
  const CELL = 20; // canvas is GRID * CELL = 400px square
  const TICK_MS = 110;

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("message");

  // The portal loads games in a sandboxed iframe with an opaque origin,
  // where localStorage throws, so the best score falls back to memory.
  const storage = {
    get() {
      try {
        return Number(localStorage.getItem("snake.best")) || 0;
      } catch {
        return 0;
      }
    },
    set(value) {
      try {
        localStorage.setItem("snake.best", String(value));
      } catch {}
    },
  };

  let snake, dir, queuedDirs, food, score, best, state, timer;

  function reset() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    queuedDirs = [];
    score = 0;
    scoreEl.textContent = "0";
    placeFood();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function setState(next) {
    state = next;
    clearInterval(timer);
    if (state === "running") {
      timer = setInterval(step, TICK_MS);
      messageEl.textContent = "";
    } else if (state === "paused") {
      messageEl.textContent = "Paused. Press Space or tap to resume";
    } else if (state === "over") {
      messageEl.textContent = `Game over. Score ${score}. Press Space or tap to play again`;
    } else {
      messageEl.textContent = "Press Space or tap to start";
    }
  }

  function step() {
    const next = queuedDirs.shift();
    if (next) dir = next;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    // The tail moves out of the way this tick unless we are eating.
    const eating = head.x === food.x && head.y === food.y;
    const body = eating ? snake : snake.slice(0, -1);
    const hitSelf = body.some((s) => s.x === head.x && s.y === head.y);

    if (hitWall || hitSelf) {
      if (score > best) {
        best = score;
        bestEl.textContent = String(best);
        storage.set(best);
      }
      setState("over");
      draw();
      return;
    }

    snake.unshift(head);
    if (eating) {
      score += 1;
      scoreEl.textContent = String(score);
      if (snake.length === GRID * GRID) {
        setState("over");
      } else {
        placeFood();
      }
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    ctx.fillStyle = "#111823";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#99f6e4" : "#5eead4";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function turn(x, y) {
    // Compare against the last queued turn so quick double-taps can't reverse.
    const last = queuedDirs[queuedDirs.length - 1] || dir;
    if (last.x === -x && last.y === -y) return;
    if (last.x === x && last.y === y) return;
    if (queuedDirs.length < 3) queuedDirs.push({ x, y });
    if (state === "ready") setState("running");
  }

  function togglePlay() {
    if (state === "running") setState("paused");
    else if (state === "over") {
      reset();
      draw();
      setState("running");
    } else setState("running");
  }

  const KEYS = {
    ArrowUp: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
    ArrowLeft: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0],
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
      return;
    }
    const d = KEYS[e.code];
    if (!d) return;
    e.preventDefault();
    if (state === "running" || state === "ready") turn(d[0], d[1]);
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
      togglePlay();
    } else if (state === "running" || state === "ready") {
      if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0);
      else turn(0, Math.sign(dy));
    }
  });

  // Take keyboard focus so arrow keys work without clicking into the iframe first.
  window.focus();

  best = storage.get();
  bestEl.textContent = String(best);
  reset();
  draw();
  setState("ready");
})();
