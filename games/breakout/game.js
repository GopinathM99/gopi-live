(() => {
  const W = 400;
  const H = 400;
  const PADDLE_W = 72;
  const PADDLE_H = 10;
  const PADDLE_Y = H - 28;
  const PADDLE_SPEED = 6; // px per frame with the keyboard
  const BALL_R = 6;
  const BRICK_COLS = 8;
  const BRICK_ROWS = 6;
  const BRICK_GAP = 4;
  const BRICK_TOP = 48;
  const BRICK_H = 14;
  const BRICK_W = (W - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;
  const ROW_COLORS = ["#f87171", "#f97316", "#facc15", "#4ade80", "#5eead4", "#60a5fa"];
  const START_LIVES = 3;

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const bestEl = document.getElementById("best");
  const messageEl = document.getElementById("message");

  // The portal loads games in a sandboxed iframe with an opaque origin,
  // where localStorage throws, so the best score falls back to memory.
  const storage = {
    get() {
      try {
        return Number(localStorage.getItem("breakout.best")) || 0;
      } catch {
        return 0;
      }
    },
    set(value) {
      try {
        localStorage.setItem("breakout.best", String(value));
      } catch {}
    },
  };

  let paddleX, ball, bricks, score, lives, level, best, state, lastTime;
  const keys = { left: false, right: false };

  function newGame() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    buildBricks();
    resetBall();
    updateHud();
  }

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_GAP + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          color: ROW_COLORS[r],
          points: (BRICK_ROWS - r) * 10,
          alive: true,
        });
      }
    }
  }

  function ballSpeed() {
    return 4 + (level - 1) * 0.6; // px per 60fps frame
  }

  function resetBall() {
    paddleX = (W - PADDLE_W) / 2;
    ball = { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true };
  }

  function launch() {
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI; // within 45° of straight up
    const s = ballSpeed();
    ball.vx = Math.sin(angle) * s;
    ball.vy = -Math.cos(angle) * s;
    ball.stuck = false;
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
    levelEl.textContent = String(level);
  }

  function setState(next) {
    state = next;
    if (state === "running") {
      messageEl.textContent = "";
      lastTime = performance.now();
    } else if (state === "paused") {
      messageEl.textContent = "Paused. Press Space or tap to resume";
    } else if (state === "over") {
      messageEl.textContent = `Game over. Score ${score}. Press Space or tap to play again`;
    } else {
      messageEl.textContent = "Press Space or tap to launch";
    }
    draw();
  }

  function primary() {
    if (state === "running") {
      if (ball.stuck) launch();
      else setState("paused");
    } else if (state === "over") {
      newGame();
      setState("ready");
    } else if (state === "ready") {
      launch();
      setState("running");
    } else {
      setState("running");
    }
  }

  function loseLife() {
    lives -= 1;
    updateHud();
    if (lives <= 0) {
      if (score > best) {
        best = score;
        bestEl.textContent = String(best);
        storage.set(best);
      }
      setState("over");
    } else {
      resetBall();
      setState("ready");
    }
  }

  function step(dt) {
    if (keys.left) paddleX -= PADDLE_SPEED * dt;
    if (keys.right) paddleX += PADDLE_SPEED * dt;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));

    if (ball.stuck) {
      ball.x = paddleX + PADDLE_W / 2;
      return;
    }

    // Move in small substeps so a fast ball can't tunnel through a brick.
    const steps = Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / (BALL_R / 2));
    for (let i = 0; i < steps; i++) {
      ball.x += (ball.vx * dt) / steps;
      ball.y += (ball.vy * dt) / steps;
      if (collide()) return;
    }
  }

  // Returns true when the ball was lost, so the caller stops moving it.
  function collide() {
    if (ball.x < BALL_R) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x > W - BALL_R) {
      ball.x = W - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y < BALL_R) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }
    if (ball.y > H + BALL_R) {
      loseLife();
      return true;
    }

    // Paddle: the further from center it hits, the steeper the bounce.
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
      ball.x >= paddleX - BALL_R &&
      ball.x <= paddleX + PADDLE_W + BALL_R
    ) {
      const offset = (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      const angle = Math.max(-1, Math.min(1, offset)) * (Math.PI / 3);
      const s = ballSpeed();
      ball.vx = Math.sin(angle) * s;
      ball.vy = -Math.cos(angle) * s;
      ball.y = PADDLE_Y - BALL_R;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      const nearestX = Math.max(b.x, Math.min(ball.x, b.x + BRICK_W));
      const nearestY = Math.max(b.y, Math.min(ball.y, b.y + BRICK_H));
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

      b.alive = false;
      score += b.points;
      updateHud();
      // Bounce off whichever face the ball is mostly overlapping.
      const overlapX = BALL_R - Math.abs(dx);
      const overlapY = BALL_R - Math.abs(dy);
      if (dx !== 0 && (dy === 0 || overlapX < overlapY)) ball.vx = Math.sign(dx) * Math.abs(ball.vx);
      else ball.vy = (dy !== 0 ? Math.sign(dy) : -Math.sign(ball.vy)) * Math.abs(ball.vy);

      if (bricks.every((br) => !br.alive)) {
        level += 1;
        buildBricks();
        resetBall();
        updateHud();
        setState("ready");
        messageEl.textContent = `Level ${level}! Press Space or tap to launch`;
        return true;
      }
      break; // one brick per substep keeps bounces predictable
    }
    return false;
  }

  function frame(now) {
    if (state === "running") {
      // dt is in 60fps frames, capped so a background tab doesn't teleport the ball.
      const dt = Math.min(3, (now - lastTime) / (1000 / 60));
      lastTime = now;
      step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  function draw() {
    ctx.fillStyle = "#111823";
    ctx.fillRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 3);
      ctx.fill();
    }

    ctx.fillStyle = "#e7e9ee";
    ctx.beginPath();
    ctx.roundRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H, 5);
    ctx.fill();

    ctx.fillStyle = "#99f6e4";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    if (state === "paused" || state === "over") {
      ctx.fillStyle = "rgba(11, 15, 20, 0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = state === "over" ? "#f97316" : "#e7e9ee";
      ctx.font = "700 26px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state === "over" ? "GAME OVER" : "PAUSED", W / 2, H / 2 + 60);
      ctx.textAlign = "left";
    }
  }

  // Moving the mouse or dragging a finger puts the paddle under the pointer.
  function pointerToPaddle(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    if (ball.stuck) ball.x = paddleX + PADDLE_W / 2;
    if (state !== "running") draw();
  }

  let pointerStart = null;
  window.addEventListener("pointerdown", (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
    if (state === "running" || state === "ready") pointerToPaddle(e);
  });
  window.addEventListener("pointermove", (e) => {
    if (state !== "running" && state !== "ready") return;
    // Mice steer just by hovering; touch and pens steer while pressed.
    if (e.pointerType === "mouse" || pointerStart) pointerToPaddle(e);
  });
  window.addEventListener("pointerup", (e) => {
    if (!pointerStart) return;
    const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    pointerStart = null;
    // A drag only steers; a tap launches, pauses, or restarts.
    if (moved < 12) primary();
  });

  const KEYS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      primary();
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "running") setState("paused");
      else if (state === "paused") setState("running");
      return;
    }
    const k = KEYS[e.code];
    if (!k) return;
    e.preventDefault();
    keys[k] = true;
    // Let the keyboard line up the paddle before launching, too.
    if (state === "ready") setState("running");
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYS[e.code];
    if (k) keys[k] = false;
  });
  window.addEventListener("blur", () => {
    keys.left = keys.right = false;
  });

  // Take keyboard focus so arrow keys work without clicking into the iframe first.
  window.focus();

  best = storage.get();
  bestEl.textContent = String(best);
  newGame();
  setState("ready");
  requestAnimationFrame(frame);
})();
