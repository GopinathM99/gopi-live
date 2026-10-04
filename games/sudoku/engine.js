/* Shared, dependency-free puzzle logic. Works in a browser or Node tests. */
(function (root) {
  "use strict";
  const LEVELS = {
    easy: { label: "Easy", clues: 46, description: "A gentle place to begin." },
    medium: { label: "Medium", clues: 38, description: "Settle into your rhythm." },
    hard: { label: "Hard", clues: 31, description: "A little deeper thinking." },
    expert: { label: "Expert", clues: 26, description: "Make every possibility count." },
  };
  const peers = Array.from({ length: 81 }, (_, i) => Array.from({ length: 81 }, (_, j) => j).filter(j => j !== i &&
    (Math.floor(i / 9) === Math.floor(j / 9) || i % 9 === j % 9 ||
      Math.floor(i / 27) === Math.floor(j / 27) && Math.floor(i % 9 / 3) === Math.floor(j % 9 / 3))));
  const units = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({ length: 9 }, (_, n) => k * 9 + n));
    units.push(Array.from({ length: 9 }, (_, n) => n * 9 + k));
    units.push(Array.from({ length: 9 }, (_, n) => Math.floor(k / 3) * 27 + k % 3 * 3 + Math.floor(n / 3) * 9 + n % 3));
  }
  function random(seed) {
    let a = seed >>> 0;
    return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(items, rng) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function candidates(board, i) {
    if (board[i]) return [];
    const used = new Set(peers[i].map(j => board[j]));
    return [1,2,3,4,5,6,7,8,9].filter(n => !used.has(n));
  }
  function countSolutions(input, limit = 2) {
    const board = [...input], rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
    if (board.length !== 81 || board.some(n => !Number.isInteger(n) || n < 0 || n > 9)) return 0;
    for (let i = 0; i < 81; i++) {
      if (!board[i]) continue;
      const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3), bit = 1 << board[i];
      if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }
    let count = 0;
    function search() {
      let index = -1, mask = 0, best = 10;
      for (let i = 0; i < 81; i++) if (!board[i]) {
        const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const m = 0x3fe & ~(rows[r] | cols[c] | boxes[b]);
        let bits = m, size = 0;
        while (bits) { bits &= bits - 1; size++; }
        if (!size) return;
        if (size < best) { best = size; index = i; mask = m; if (size === 1) break; }
      }
      if (index < 0) { count++; return; }
      const r = Math.floor(index / 9), c = index % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      while (mask && count < limit) {
        const bit = mask & -mask; mask -= bit;
        board[index] = Math.log2(bit); rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        search();
        board[index] = 0; rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
      }
    }
    search(); return count;
  }
  function generate(level, seed) {
    const rng = random(seed), spec = LEVELS[level];
    if (!spec) throw new Error("Unknown difficulty");
    const groups = () => shuffle([0,1,2], rng).flatMap(g => shuffle([0,1,2], rng).map(n => g * 3 + n));
    const rows = groups(), cols = groups(), digits = shuffle([1,2,3,4,5,6,7,8,9], rng);
    const solution = rows.flatMap(r => cols.map(c => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
    let puzzle = [...solution], best = 81;
    for (let attempt = 0; attempt < 8; attempt++) {
      const trial = [...solution]; let clues = 81;
      for (const i of shuffle(Array.from({ length: 81 }, (_, j) => j), rng)) {
        const value = trial[i]; trial[i] = 0;
        if (countSolutions(trial) !== 1) trial[i] = value; else clues--;
        if (clues === spec.clues) break;
      }
      if (clues < best) { best = clues; puzzle = trial; }
      if (best === spec.clues) break;
    }
    return { puzzle, solution };
  }
  function dailySeed(date) {
    return [...date].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
  }
  const api = { LEVELS, peers, units, candidates, countSolutions, generate, dailySeed };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Sudoku = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
