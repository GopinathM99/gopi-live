// A deterministic, all-seeing movement bot for simulation regression checks.
// This proves the run is completable; it does not model human difficulty.
function choose(game) {
  const score = id => id === 'repair' ? (game.player.hp < game.stats.maxHp * .45 ? 30 : 0)
    : id === 'plating' ? (game.player.hp < game.stats.maxHp * .5 ? 25 : 8)
    : ({ rockets: 16, spark: 15, saws: 13, blaster: 14, battery: 12, power: 11, magnet: 10, nova: 6, lucky: 5 })[id];
  return [...game.choices].sort((a, b) => score(b) - score(a))[0];
}
function controls(game) {
  const p = game.player;
  let target, best = Infinity;
  for (const gem of game.gems) {
    const d = Math.hypot(gem.x - p.x, gem.z - p.z);
    const penalty = game.enemies.reduce((n, e) => n + (Math.hypot(e.x - gem.x, e.z - gem.z) < 3 ? 6 : 0), 0);
    if (d + penalty < best) { target = gem; best = d + penalty; }
  }
  target ||= { x: Math.sin(game.time * .12) * 13, z: Math.cos(game.time * .12) * 13 };
  let x = target.x - p.x, z = target.z - p.z;
  const d = Math.hypot(x, z) || 1; x /= d; z /= d;
  let close = Infinity;
  for (const e of game.enemies) {
    if (e.type === 'crate') continue;
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
    close = Math.min(close, dist - e.radius);
    const influence = Math.max(0, (e.radius + 2.6 - dist) / (e.radius + 2.6)) * 3;
    x += dx / (dist || 1) * influence; z += dz / (dist || 1) * influence;
  }
  for (const b of game.bullets) {
    const dx = p.x - b.x, dz = p.z - b.z, dist = Math.hypot(dx, dz);
    if (dist < 2) { x += dx / (dist || 1) * (2 - dist); z += dz / (dist || 1) * (2 - dist); }
  }
  return { x, z, dash: close < 1.3, surge: p.charge >= 100 };
}
module.exports = { choose, controls };
