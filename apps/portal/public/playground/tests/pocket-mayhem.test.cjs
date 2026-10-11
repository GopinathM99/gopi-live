const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, UPGRADES, LIMIT, BOSS_TIMES, nextXP, seedFor } = require('../games/pocket-mayhem/engine.js');
const bot = require('./helpers/pocket-bot.cjs');
const step = (g, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.step(1 / 60, input); };
function empty(options) { const g = new Game({ seed: 11, ...options }); g.enemies = []; g.spawnClock = g.crateClock = 1e6; return g; }
function upgrade(g, id) { g.phase = 'upgrade'; g.choices = [id]; assert.equal(g.choose(id), true); }

test('daily seeds replay identically with the same actions and diverge on another day', () => {
  const a = new Game({ seed: seedFor('2026-10-11') }), b = new Game({ seed: seedFor('2026-10-11') });
  for (let i = 0; i < 1800; i++) {
    const input = { x: Math.sin(i / 190), z: Math.cos(i / 190), dash: i % 251 === 0 };
    for (const g of [a, b]) { if (g.phase === 'upgrade') g.choose(g.choices[0]); g.step(1 / 60, input); }
  }
  assert.deepEqual(a.player, b.player); assert.deepEqual(a.enemies, b.enemies); assert.deepEqual(a.ranks, b.ranks);
  assert.notEqual(seedFor('2026-10-11'), seedFor('2026-10-12'));
});

test('diagonal walking is normalized and remembered heading keeps a full-speed dash', () => {
  const straight = empty(), diagonal = empty();
  step(straight, 1, { x: 1 }); step(diagonal, 1, { x: 1, z: 1 });
  assert.ok(Math.abs(straight.player.x - Math.hypot(diagonal.player.x, diagonal.player.z)) < 1e-8);
  const before = { ...diagonal.player };
  assert.equal(diagonal.dash(0, 0), true); step(diagonal, .1);
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - before.x, diagonal.player.z - before.z) - 2.7) < 1e-8);
  assert.equal(diagonal.dash(1, 0), false);
  diagonal.player.x = LIMIT - .01; step(diagonal, 2, { x: 1, z: 0 });
  assert.equal(diagonal.player.x, LIMIT);
});

test('dashes block damage; shields absorb hits and recover after a quiet interval', () => {
  const g = empty(); upgrade(g, 'plating'); g.player.invincible = 0;
  const hp = g.player.hp; g.hurt(9);
  assert.equal(g.player.hp, hp); assert.equal(g.player.shield, 5);
  step(g, 1); g.hurt(10); assert.equal(g.player.hp, hp - 5);
  step(g, 1); g.dash(1, 0); g.hurt(100); assert.equal(g.player.hp, hp - 5);
  step(g, 10); assert.equal(g.player.shield, g.stats.shield);
});

test('pause, upgrade, and results freeze simulation and reject active abilities', () => {
  for (const phase of ['paused', 'upgrade', 'over', 'victory']) {
    const g = new Game({ seed: 2 }); g.phase = phase; g.player.charge = 100;
    const before = JSON.stringify(g);
    step(g, 2, { x: 1, dash: true, surge: true });
    assert.equal(g.dash(1, 0), false); assert.equal(g.surge(), false);
    assert.equal(JSON.stringify(g), before);
  }
});

test('level choices are distinct, exclude capped items, and limit rerolls', () => {
  const g = empty(); g.ranks.blaster = 4; g.ranks.saws = 4;
  g.player.xp = nextXP(g.player.level); g.levelUp();
  assert.equal(g.phase, 'upgrade'); assert.equal(g.player.level, 2);
  for (let i = 0; i < 3; i++) {
    assert.equal(new Set(g.choices).size, g.choices.length);
    assert.ok(!g.choices.includes('blaster') && !g.choices.includes('saws'));
    if (i < 2) assert.equal(g.reroll(), true);
  }
  assert.equal(g.reroll(), false); assert.equal(g.choose('invented'), false);
  const choice = g.choices[0]; assert.equal(g.choose(choice), true); assert.equal(g.choose(choice), false);
  assert.equal(g.phase, 'playing');
});

test('each weapon evolves only when both recipe requirements are met', () => {
  for (const [weapon, boost] of [['blaster','battery'],['rockets','power'],['saws','magnet'],['spark','battery']]) {
    const g = empty(); g.ranks[weapon] = 3; g.ranks[boost] = 1;
    upgrade(g, weapon); assert.equal(g.evolved(weapon), false);
    upgrade(g, boost); assert.equal(g.evolved(weapon), true);
    const evolvedEvents = g.events.filter(e => e.type === 'evolution').length;
    upgrade(g, 'plating'); assert.equal(g.events.filter(e => e.type === 'evolution').length, evolvedEvents);
  }
});

test('a fully upgraded build can still level up and repair', () => {
  const g = empty(); for (const u of UPGRADES) if (u.id !== 'repair') g.ranks[u.id] = u.max;
  g.player.hp = g.stats.maxHp; g.player.xp = 1000; g.levelUp();
  assert.deepEqual(g.choices, ['repair']); assert.equal(g.reroll(), true);
  assert.equal(g.choose('repair'), true); assert.equal(g.player.hp, g.stats.maxHp);
});

test('XP merging conserves rewards and magnet pickups collect distant batteries', () => {
  const g = empty(); for (let i = 0; i < 500; i++) g.addGem(12 + i % 4, 12, 2);
  assert.ok(g.gems.length <= 160); assert.equal(g.gems.reduce((n, gem) => n + gem.value, 0), 1000);
  g.addGem(0, 0, 1, 'magnet'); g.step(1 / 60);
  assert.ok(g.gems.every(gem => gem.pull)); step(g, 2);
  const remaining = g.gems.reduce((n, gem) => n + gem.value, 0);
  assert.equal(g.player.xp + nextXP(1) + remaining, 1000);
  assert.equal(g.phase, 'upgrade');
});

test('auto-fire, homing rockets, saws, and lightning each kill reachable targets', () => {
  for (const weapon of ['blaster', 'rockets', 'saws', 'spark']) {
    const g = empty(); g.ranks[weapon] = 1; g.fireClock = 1000;
    const e = g.spawn('nibbler', 0, weapon === 'saws' ? 2.8 : 5); e.spawn = 0; e.stun = 100;
    if (weapon === 'blaster') g.fireClock = 0;
    if (weapon === 'rockets') g.rocketClock = 0;
    if (weapon === 'spark') g.sparkClock = 0;
    step(g, 5); assert.equal(g.kills, 1, weapon);
    assert.ok(g.damageDone >= 24, weapon);
  }
});

test('charged Overdrive heals, clears hostile projectiles, and boosts weapons temporarily', () => {
  const g = empty(); const base = g.stats; g.player.hp = 40; g.player.charge = 100;
  g.enemyShot(5, 0, -1, 0, 10); assert.equal(g.surge(), true);
  assert.equal(g.bullets.length, 0); assert.equal(g.player.hp, 52); assert.equal(g.player.charge, 0);
  assert.ok(g.stats.damage > base.damage && g.stats.rate > base.rate);
  assert.equal(g.surge(), false); step(g, 9.1); assert.equal(g.stats.damage, base.damage);
});

test('fatal damage wins over a repair pickup in the same frame', () => {
  const g = empty(); g.player.hp = 1; g.player.invincible = 0; g.fireClock = 1000;
  const enemy = g.spawn('bruiser', 0, 0); enemy.spawn = 0;
  g.addGem(0, 0, 100, 'heal'); g.step(1 / 60);
  assert.equal(g.phase, 'over'); assert.equal(g.player.hp, 0);
});

test('bosses arrive in order, final defeat wins, and overtime continues the same build', () => {
  const g = empty();
  for (const [tier, time] of BOSS_TIMES.entries()) {
    g.time = time - .01; g.step(1 / 60); assert.equal(g.boss.tier, tier);
    g.boss.spawn = 0; g.damageEnemy(g.boss, 1e6);
    assert.equal(g.bossKills, tier + 1);
  }
  assert.equal(g.phase, 'victory'); const ranks = { ...g.ranks };
  assert.equal(g.continueEndless(), true); assert.deepEqual(g.ranks, ranks);
  assert.equal(g.player.hp, g.stats.maxHp); assert.equal(g.continueEndless(), false);
  g.time = g.endlessBossAt; g.step(1 / 60); assert.equal(g.boss.tier, 2);
  g.boss.spawn = 0; g.damageEnemy(g.boss, 1e6); assert.equal(g.phase, 'playing');
});

test('Cozy reduces damage while preserving the same movement and upgrade rules', () => {
  const a = empty(), b = empty({ difficulty: 'cozy' });
  for (const g of [a, b]) { g.player.invincible = 0; g.hurt(20); }
  assert.equal(a.player.hp, 80); assert.equal(b.player.hp, 89);
  assert.equal(a.stats.speed, b.stats.speed); assert.deepEqual(a.ranks, b.ranks);
});

test('all three starting robots can complete seeded full-length runs without health cheats', () => {
  for (const pilot of ['zip', 'orbit', 'bolt']) {
    const g = new Game({ seed: 99, pilot }); let firstUpgrade = 0;
    for (let i = 0; i < 60 * 650 && !['over', 'victory'].includes(g.phase); i++) {
      if (g.phase === 'upgrade') { firstUpgrade ||= g.time; g.choose(bot.choose(g)); }
      g.step(1 / 60, bot.controls(g));
      assert.ok(g.enemies.length <= 95 && g.shots.length <= 140 && g.bullets.length <= 180);
      assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.hp));
    }
    assert.equal(g.phase, 'victory', pilot); assert.equal(g.bossKills, 3);
    assert.ok(firstUpgrade < 30, `${pilot} gets an early upgrade`);
    assert.ok(g.evolutions.size > 0 && g.player.hp > 0);
  }
});
