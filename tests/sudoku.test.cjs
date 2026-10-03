const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS, peers, units, candidates, countSolutions, generate, dailySeed } = require('../games/sudoku/engine.js');

test('each difficulty generates valid puzzles with one solution and the intended clue range', () => {
  for (const [level, spec] of Object.entries(LEVELS)) {
    for (let seed = 1; seed <= 20; seed++) {
      const { puzzle, solution } = generate(level, seed);
      assert.equal(countSolutions(puzzle), 1, `${level}, seed ${seed}`);
      for (const unit of units) assert.deepEqual(unit.map(i => solution[i]).sort(), [1,2,3,4,5,6,7,8,9]);
      assert.ok(puzzle.every((n, i) => n === 0 || n === solution[i]));
      const clues = puzzle.filter(Boolean).length;
      assert.ok(clues >= spec.clues && clues <= spec.clues + 2, `${level}: ${clues} clues`);
    }
  }
});
test('daily puzzle is reproducible, and different dates and seeds vary the puzzle', () => {
  const seed = dailySeed('2026-10-03');
  assert.deepEqual(generate('medium', seed), generate('medium', seed));
  assert.notDeepEqual(generate('medium', seed).puzzle, generate('medium', dailySeed('2026-10-04')).puzzle);
});
test('solver rejects contradictions and distinguishes multiple solutions', () => {
  const invalid = Array(81).fill(0); invalid[0] = invalid[1] = 1;
  assert.equal(countSolutions(invalid), 0);
  assert.equal(countSolutions(Array(81).fill(0)), 2);
  assert.equal(countSolutions([1,2]), 0);
});
test('candidates exclude every row, column and box peer', () => {
  assert.equal(peers[40].length, 20);
  const board = Array(81).fill(0); board[36] = 1; board[4] = 2; board[30] = 3;
  assert.deepEqual(candidates(board, 40), [4,5,6,7,8,9]);
  board[40] = 4; assert.deepEqual(candidates(board, 40), []);
});
