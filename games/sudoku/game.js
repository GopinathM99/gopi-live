(() => {
  "use strict";
  const { LEVELS, peers, units, candidates, generate, dailySeed, countSolutions } = Sudoku;
  const $ = id => document.getElementById(id);
  const storageKey = "gopi.sudoku.v1";
  const cells = [], keys = [];
  let state, selected = -1, notesMode = false, checking = true, history = [], busy = false;
  let lastTick = performance.now(), modalDismiss = null;
  const today = () => new Date().toISOString().slice(0, 10);
  const time = seconds => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const announce = message => { $("message").textContent = message; };
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Sandboxed games have no storage access. */ }
  }
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey));
      const validDigits = a => Array.isArray(a) && a.length === 81 && a.every(n => Number.isInteger(n) && n >= 0 && n <= 9);
      if (!s || !LEVELS[s.level] || !validDigits(s.puzzle) || !validDigits(s.board) || !validDigits(s.solution) || s.solution.includes(0) ||
        !Array.isArray(s.notes) || s.notes.length !== 81 || s.notes.some(a => !Array.isArray(a) || a.length > 9 || a.some(n => !Number.isInteger(n) || n < 1 || n > 9)) ||
        !Number.isFinite(s.elapsed) || s.elapsed < 0 || !Number.isInteger(s.hints) || s.hints < 0 || s.hints > 3 ||
        !(s.daily === null || typeof s.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.daily)) ||
        s.puzzle.some((n, i) => n && (n !== s.solution[i] || n !== s.board[i])) || countSolutions(s.solution) !== 1 || countSolutions(s.puzzle) !== 1) return false;
      s.won = s.board.every((n, i) => n === s.solution[i]);
      state = s; return true;
    } catch { return false; }
  }
  for (let r = 0; r < 9; r++) {
    const row = document.createElement("div"); row.setAttribute("role", "row");
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c, cell = document.createElement("button");
      cell.className = "cell"; cell.type = "button"; cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-rowindex", r + 1); cell.setAttribute("aria-colindex", c + 1);
      cell.dataset.index = i;
      cell.addEventListener("click", () => select(i));
      cell.addEventListener("focus", () => { if (selected !== i && state) { selected = i; render(); } });
      cells.push(cell); row.append(cell);
    }
    $("board").append(row);
  }
  for (let n = 1; n <= 9; n++) {
    const button = document.createElement("button"); button.type = "button";
    button.addEventListener("click", () => enter(n)); keys.push(button); $("keypad").append(button);
  }
  function select(i) {
    if (busy || state.won) return;
    selected = i; render();
  }
  function render() {
    if (!state) return;
    const value = state.board[selected], related = new Set(peers[selected] || []);
    cells.forEach((cell, i) => {
      const n = state.board[i], fixed = !!state.puzzle[i], wrong = checking && n && n !== state.solution[i];
      cell.className = ["cell", fixed ? "given" : "user", related.has(i) ? "peer" : "", value && n === value ? "match" : "", i === selected ? "selected" : "", wrong ? "wrong" : ""].filter(Boolean).join(" ");
      cell.tabIndex = i === (selected < 0 ? 0 : selected) ? 0 : -1;
      cell.setAttribute("aria-selected", String(i === selected)); cell.setAttribute("aria-readonly", String(fixed));
      cell.setAttribute("aria-invalid", String(!!wrong));
      const label = `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${n ? n + (fixed ? ", given" : "") : "empty"}${wrong ? ", incorrect" : ""}${!n && state.notes[i].length ? ", notes " + state.notes[i].join(", ") : ""}`;
      cell.setAttribute("aria-label", label);
      if (n) cell.innerHTML = `<span class="value">${n}</span>`;
      else if (state.notes[i].length) cell.innerHTML = `<span class="pencil" aria-hidden="true">${Array.from({ length: 9 }, (_, j) => `<span>${state.notes[i].includes(j + 1) ? j + 1 : ""}</span>`).join("")}</span>`;
      else cell.replaceChildren();
    });
    keys.forEach((button, j) => {
      const n = j + 1, remaining = Math.max(0, 9 - state.board.filter(v => v === n).length);
      button.innerHTML = `${n}<small aria-hidden="true">${remaining ? "·".repeat(Math.min(remaining, 3)) : "✓"}</small>`;
      button.classList.toggle("complete", remaining === 0);
      button.setAttribute("aria-label", `Enter ${n}, ${remaining} remaining`);
      button.disabled = state.won || busy;
    });
    const total = state.puzzle.filter(n => !n).length, filled = state.board.filter((n, i) => n && !state.puzzle[i]).length;
    $("filled").textContent = filled; $("total").textContent = total;
    $("progress-fill").style.width = `${filled / total * 100}%`;
    $("progress").setAttribute("aria-valuenow", Math.round(filled / total * 100));
    $("progress-label").textContent = state.won ? "Beautifully done." : filled === total ? "Check your numbers." : filled > total * .75 ? "Coming together." : filled > total * .35 ? "Finding your flow." : "Take your time.";
    $("level-badge").textContent = LEVELS[state.level].label.toUpperCase();
    $("difficulty").value = state.level;
    $("puzzle-kind").textContent = state.daily ? `Daily · ${state.daily.slice(5).replace("-", "/")}` : "Your moment of focus";
    $("timer").textContent = time(state.elapsed);
    $("notes").setAttribute("aria-pressed", String(notesMode)); $("notes-label").textContent = notesMode ? "ON" : "OFF";
    $("notes").disabled = state.won;
    $("hint-count").textContent = state.hints; $("hint").disabled = state.hints === 0 || state.won || busy;
    $("undo").disabled = !history.length || state.won; $("erase").disabled = selected < 0 || !!state.puzzle[selected] || state.won;
    $("pause").disabled = state.won;
    $("check").setAttribute("aria-pressed", String(checking)); $("check").innerHTML = `Mistake check <b>${checking ? "ON" : "OFF"}</b>`;
  }
  function snapshot() {
    history.push({ board: [...state.board], notes: state.notes.map(a => [...a]) });
    if (history.length > 200) history.shift();
  }
  function enter(n) {
    if (busy || state.won || $("modal").open) return;
    if (selected < 0) { announce("Choose a square first, then a number."); return; }
    if (state.puzzle[selected]) { announce("That number is a clue. Try an empty square."); return; }
    if (notesMode && n) {
      if (state.board[selected]) { announce("Erase this number before adding pencil notes."); return; }
      snapshot();
      const notes = state.notes[selected];
      state.notes[selected] = notes.includes(n) ? notes.filter(v => v !== n) : [...notes, n].sort();
      announce("Pencil notes are possibilities, not commitments.");
    } else {
      if (state.board[selected] === n && (n || !state.notes[selected].length)) return;
      snapshot(); state.board[selected] = n; state.notes[selected] = [];
      if (n) for (const peer of peers[selected]) state.notes[peer] = state.notes[peer].filter(v => v !== n);
      announce(n && checking && n !== state.solution[selected] ? "Not quite. Try another possibility — there’s no penalty." : n ? "One square closer." : "A fresh start for this square.");
    }
    afterMove();
  }
  function afterMove() {
    state.won = state.board.every((n, i) => n === state.solution[i]);
    render(); cells[selected]?.classList.add("pop"); save();
    if (state.won) { celebrate(Array.from({ length: 81 }, (_, i) => i)); victory(); }
    else {
      const completed = units.filter(unit => unit.includes(selected) && unit.every(i => state.board[i] === state.solution[i]));
      if (completed.length) { celebrate([...new Set(completed.flat())]); announce("A perfect little piece of the puzzle."); }
    }
  }
  function celebrate(indices) {
    indices.forEach((i, order) => { cells[i].style.setProperty("--delay", `${order * 13}ms`); cells[i].classList.add("celebrate"); });
  }
  function hint() {
    if (!state.hints || state.won || busy) return;
    let index = state.board.findIndex((n, i) => n && n !== state.solution[i]), reason;
    if (index >= 0) reason = "A small course correction: this square needs";
    else {
      const empty = state.board.map((n, i) => n ? -1 : i).filter(i => i >= 0);
      index = empty.find(i => candidates(state.board, i).length === 1);
      if (index !== undefined) reason = "Looking at this row, column, and box, the only possibility is";
      else {
        index = empty.includes(selected) ? selected : empty[0];
        reason = "A little boost. The solution for this square is";
      }
    }
    if (index === undefined) return;
    selected = index; snapshot(); const value = state.solution[index];
    state.board[index] = value; state.notes[index] = []; state.hints--;
    peers[index].forEach(i => { state.notes[i] = state.notes[i].filter(n => n !== value); });
    afterMove(); announce(`${reason} ${value}. ${state.hints} hint${state.hints === 1 ? "" : "s"} left.`);
  }
  function closeModal() {
    $("modal").close(); document.body.classList.remove("modal-open"); lastTick = performance.now();
    const callback = modalDismiss; modalDismiss = null; callback?.();
  }
  function modal({ title, eyebrow = "A MOMENT FOR YOU", symbol = "✳", body, actions, dismiss }) {
    if ($("modal").open) closeModal();
    $("modal-title").textContent = title; $("modal-eyebrow").textContent = eyebrow; $("modal-symbol").textContent = symbol;
    $("modal-body").innerHTML = body; $("modal-actions").replaceChildren(); modalDismiss = dismiss || null;
    actions.forEach(({ label, action, secondary }) => {
      const button = document.createElement("button"); button.className = secondary ? "secondary" : "primary"; button.textContent = label;
      button.addEventListener("click", () => { closeModal(); action?.(); }); $("modal-actions").append(button);
    });
    document.body.classList.add("modal-open"); $("modal").showModal(); save();
  }
  $("modal").addEventListener("cancel", event => { event.preventDefault(); closeModal(); });
  function victory() {
    announce("Puzzle complete. Beautifully done!");
    for (let i = 0; i < 32; i++) {
      const particle = document.createElement("i"); particle.className = "confetti";
      particle.style.cssText = `--left:${Math.random() * 100}%;--delay:${Math.random() * .3}s;--drift:${Math.random() * 120 - 60}px;--color:${["#b4d57e", "#e4c87e", "#6a9c77"][i % 3]}`;
      $("particles").append(particle);
    }
    setTimeout(() => {
      $("particles").replaceChildren();
      if (!state.won) return;
      modal({ title: "Everything in its place.", eyebrow: state.daily ? "DAILY RITUAL COMPLETE" : "A LITTLE WELL-EARNED CLARITY", symbol: "✧", body: `<p>You found your way, one square at a time.<br>Take a breath. That one’s yours.</p><div class="win-stats"><div><b>${time(state.elapsed)}</b><span>Your time</span></div><div><b>${LEVELS[state.level].label}</b><span>Challenge</span></div><div><b>${3 - state.hints}</b><span>Hints used</span></div></div>`, actions: [{ label: "Find a new flow", action: () => start(state.level) }, { label: "Admire your puzzle", secondary: true }] });
    }, 1400);
  }
  function start(level, daily = null) {
    if (busy) return;
    busy = true; announce("Making room for a new puzzle…"); $("new-game").disabled = true; $("daily").disabled = true; $("difficulty").disabled = true;
    setTimeout(() => {
      try {
        const seed = daily ? dailySeed(daily) : crypto.getRandomValues(new Uint32Array(1))[0];
        const { puzzle, solution } = generate(level, seed);
        state = { level, daily, puzzle, solution, board: [...puzzle], notes: Array.from({ length: 81 }, () => []), elapsed: 0, hints: 3, won: false };
        history = []; notesMode = false; selected = -1; lastTick = performance.now();
        $("particles").replaceChildren();
        $("daily-date").textContent = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) + " · Medium";
        document.querySelector(".app").classList.remove("enter"); void $("board").offsetWidth; document.querySelector(".app").classList.add("enter");
        announce(daily ? "Today’s shared puzzle. A small ritual, just for you." : LEVELS[level].description + " Pick a square to begin."); save();
      } finally { busy = false; $("new-game").disabled = false; $("daily").disabled = false; $("difficulty").disabled = false; render(); }
    }, 30);
  }
  function requestNew(level, daily = null) {
    if (busy) return;
    const progress = state.board.some((n, i) => n !== state.puzzle[i]) || state.notes.some(a => a.length);
    $("difficulty").value = state.level;
    if (daily && state.daily === daily) { announce(state.won ? "Today’s ritual is complete. Come back tomorrow, or try a new puzzle." : "You’re already playing today’s ritual."); return; }
    if (!progress || state.won) { start(level, daily); return; }
    modal({ title: "A fresh page?", eyebrow: daily ? "YOUR DAILY RITUAL" : `${LEVELS[level].label.toUpperCase()} CHALLENGE`, body: "<p>This will replace your current puzzle and pencil notes. Ready for something new?</p>", actions: [{ label: daily ? "Start today’s puzzle" : "Start new puzzle", action: () => start(level, daily) }, { label: "Keep playing", secondary: true }] });
  }
  function pause() {
    if (state.won || busy || $("modal").open) return;
    modal({ title: "Take a little breath.", eyebrow: "NO RUSH. YOU’RE DOING GREAT.", symbol: "✳", body: "<p>Your puzzle and timer are on pause.<br>Pick up right where you left off.</p>", actions: [{ label: "Back to my flow" }] });
  }
  function undo() {
    if (!history.length || state.won || busy) return;
    const previous = history.pop(); state.board = previous.board; state.notes = previous.notes;
    render(); save(); announce("Last move undone.");
  }
  $("notes").addEventListener("click", () => { notesMode = !notesMode; render(); announce(notesMode ? "Pencil mode on. Add or remove possible numbers." : "Pencil mode off. Place your numbers."); });
  $("erase").addEventListener("click", () => enter(0)); $("undo").addEventListener("click", undo); $("hint").addEventListener("click", hint);
  $("pause").addEventListener("click", pause);
  $("new-game").addEventListener("click", () => requestNew(state.level));
  $("daily").addEventListener("click", () => requestNew("medium", today()));
  $("difficulty").addEventListener("change", event => requestNew(event.target.value));
  $("check").addEventListener("click", () => { checking = !checking; render(); announce(checking ? "Mistakes are gently highlighted. No penalties, ever." : "Mistake checking off. Trust your reasoning."); });
  $("help").addEventListener("click", () => modal({ title: "A simple kind of magic.", eyebrow: "HOW TO PLAY", body: "<p>Fill each row, column, and 3 × 3 box with the numbers <strong>1 through 9</strong>, without repeats.</p><ul><li>Choose a square, then tap or type a number.</li><li>Use Notes to pencil in possibilities.</li><li>Matching numbers and related squares light up.</li><li>Three hints per puzzle give you a gentle nudge.</li><li>Arrow keys move, N toggles notes, Backspace erases, Ctrl/Cmd + Z undoes, and Space pauses.</li></ul><p>The daily puzzle is the same for everyone, refreshed at midnight UTC. There’s no time limit.</p>", actions: [{ label: "Let’s find a little clarity" }] }));
  document.addEventListener("keydown", event => {
    if (!state || busy || $("modal").open || event.target.tagName === "SELECT" || event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
    if (event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (/^[1-9]$/.test(key)) { event.preventDefault(); enter(Number(key)); }
    else if (key === "Backspace" || key === "Delete" || key === "0") { event.preventDefault(); enter(0); }
    else if (key.toLowerCase() === "n" && !state.won) { event.preventDefault(); $("notes").click(); }
    else if (key.startsWith("Arrow") && !state.won) {
      event.preventDefault();
      const index = Math.max(0, selected), row = Math.floor(index / 9), col = index % 9;
      const r = Math.max(0, Math.min(8, row + (key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0)));
      const c = Math.max(0, Math.min(8, col + (key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0)));
      select(r * 9 + c); cells[selected].focus({ preventScroll: true });
    } else if (key === " " && (event.target === document.body || event.target.closest("#board"))) { event.preventDefault(); pause(); }
  });
  setInterval(() => {
    const now = performance.now(), delta = (now - lastTick) / 1000; lastTick = now;
    if (!state || state.won || busy || document.hidden || $("modal").open) return;
    state.elapsed += delta; $("timer").textContent = time(state.elapsed); save();
  }, 1000);
  document.addEventListener("visibilitychange", () => { lastTick = performance.now(); if (document.hidden && state) { save(); pause(); } });
  window.addEventListener("pagehide", save);
  $("daily-date").textContent = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) + " · Medium";
  if (restore()) { render(); announce(state.won ? "Welcome back. Your completed puzzle is waiting to be admired." : "Welcome back. Let’s pick up where you left off."); }
  else start("easy");
})();
