/* Pocket Mayhem simulation. No DOM, rendering, storage, or network dependencies. */
(function (root) {
  'use strict';
  const LIMIT = 23, RUN_TIME = 480;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function random(seed) {
    let n = seed >>> 0;
    return () => {
      n += 0x6D2B79F5;
      let t = Math.imul(n ^ n >>> 15, 1 | n);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedFor(text) {
    let n = 2166136261;
    for (const letter of String(text)) n = Math.imul(n ^ letter.charCodeAt(0), 16777619);
    return n >>> 0;
  }
  const UPGRADES = [
    { id: 'blaster', name: 'Pop cannon', icon: '✦', color: '#d5f67d', max: 4, kind: 'WEAPON', description: 'More shots. More punch. Higher ranks pierce through toys.', evolution: 'Rank 4 + Overclock 2 → Confetti cannon' },
    { id: 'rockets', name: 'Pocket rockets', icon: '→', color: '#ffb279', max: 4, kind: 'WEAPON', description: 'Homing rockets explode into a crowd-clearing splash.', evolution: 'Rank 4 + Power cell 2 → Firework party' },
    { id: 'saws', name: 'Satellite saws', icon: '✳', color: '#d8a6ff', max: 4, kind: 'WEAPON', description: 'Orbiting blades turn close calls into spare parts.', evolution: 'Rank 4 + Big magnet 2 → Saturn rings' },
    { id: 'spark', name: 'Chain reaction', icon: 'ϟ', color: '#88e9e4', max: 4, kind: 'WEAPON', description: 'Lightning jumps between toys. More ranks, more jumps.', evolution: 'Rank 4 + Overclock 2 → Thunderstorm' },
    { id: 'battery', name: 'Overclock', icon: '»', color: '#d5f67d', max: 3, kind: 'BOOST', description: 'Guns, rockets, and lightning fire 16% faster per rank.' },
    { id: 'power', name: 'Power cell', icon: '▣', color: '#ffb279', max: 3, kind: 'BOOST', description: 'Every weapon deals 25% more damage per rank.' },
    { id: 'magnet', name: 'Big magnet', icon: '∪', color: '#88e9e4', max: 3, kind: 'BOOST', description: 'Collect batteries from farther away. Move 5% faster.' },
    { id: 'plating', name: 'Bubble wrap', icon: '◈', color: '#d8a6ff', max: 3, kind: 'DEFENSE', description: '+25 max health, an instant repair, and a recharging shield.' },
    { id: 'nova', name: 'Dash smash', icon: '◎', color: '#ffb279', max: 3, kind: 'DASH', description: 'Dashing blasts nearby toys. Dash cooldown gets shorter.' },
    { id: 'lucky', name: 'Lucky circuit', icon: '✧', color: '#d5f67d', max: 3, kind: 'BOOST', description: '+12% critical chance. Critical hits deal double damage.' },
    { id: 'repair', name: 'Quick repair', icon: '+', color: '#ff9bad', max: Infinity, kind: 'REPAIR', description: 'Restore 45% health now. Get straight back to making trouble.' }
  ];
  const PILOTS = {
    zip: { name: 'Zip', role: 'THE ALL-ROUNDER', color: '#d5f67d', description: 'Extra cannon power. A little extra speed.', ranks: { blaster: 2 }, speed: .45, hp: 100 },
    orbit: { name: 'Orbit', role: 'THE CLOSE CALL', color: '#d8a6ff', description: 'Start with satellite saws and a tougher shell.', ranks: { blaster: 1, saws: 1 }, speed: 0, hp: 120 },
    bolt: { name: 'Bolt', role: 'THE CHAIN REACTION', color: '#88e9e4', description: 'Start with lightning. Make friends with crowds.', ranks: { blaster: 1, spark: 1 }, speed: .15, hp: 100 }
  };
  const TYPES = {
    nibbler: { hp: 24, speed: 1.7, radius: .52, damage: 9, xp: 1, color: '#ee8fc5' },
    skitter: { hp: 15, speed: 3.25, radius: .36, damage: 6, xp: 1, color: '#ffba74' },
    bruiser: { hp: 110, speed: 1.05, radius: .9, damage: 17, xp: 5, color: '#bb9bea' },
    spitter: { hp: 45, speed: 1.65, radius: .58, damage: 9, xp: 3, color: '#69cfc7' },
    charger: { hp: 64, speed: 1.6, radius: .65, damage: 13, xp: 3, color: '#ff7972' },
    boss: { hp: 800, speed: 1.2, radius: 1.9, damage: 22, xp: 35, color: '#ffd071' },
    crate: { hp: 24, speed: 0, radius: .65, damage: 0, xp: 12, color: '#d7f48a' }
  };
  const nextXP = level => 7 + Math.floor(level * 4 + level ** 1.5);
  const BOSS_TIMES = [150, 300, RUN_TIME];
  const BOSS_NAMES = ['THE WIND-UP WARDEN', 'CAPTAIN CLATTER', 'THE TOYBOX TYRANT'];

  class Game {
    constructor({ seed = Date.now(), pilot = 'zip', difficulty = 'standard' } = {}) {
      this.seed = seed >>> 0;
      this.rng = random(this.seed);
      this.pilot = Object.hasOwn(PILOTS, pilot) ? pilot : 'zip';
      this.difficulty = difficulty === 'cozy' ? 'cozy' : 'standard';
      this.phase = 'playing';
      this.time = 0;
      this.kills = 0;
      this.bossKills = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.comboTime = 0;
      this.id = 0;
      this.ranks = Object.fromEntries(UPGRADES.filter(u => u.id !== 'repair').map(u => [u.id, 0]));
      Object.assign(this.ranks, PILOTS[this.pilot].ranks);
      this.player = { x: 0, z: 0, hp: PILOTS[this.pilot].hp, shield: 0, angle: 0, level: 1, xp: 0, invincible: 1, dash: 0, dashCooldown: 0, dx: 0, dz: -1, surge: 0, charge: 0 };
      this.enemies = [];
      this.shots = [];
      this.bullets = [];
      this.gems = [];
      this.events = [];
      this.choices = [];
      this.evolutions = new Set();
      this.spawnClock = .5;
      this.crateClock = 18;
      this.fireClock = 0;
      this.rocketClock = 1;
      this.sparkClock = 1.1;
      this.shieldClock = 0;
      this.bossIndex = 0;
      this.endless = false;
      this.endlessBossAt = RUN_TIME + 90;
      this.hitsTaken = 0;
      this.damageDone = 0;
      this.rerolls = 2;
      this.spawn('crate', 5, -5);
      for (let i = 0; i < 4; i++) this.spawn('nibbler');
    }

    get stats() {
      const r = this.ranks, p = this.player;
      return {
        maxHp: PILOTS[this.pilot].hp + r.plating * 25,
        speed: (5.2 + PILOTS[this.pilot].speed) * (1 + r.magnet * .05) * (p.surge > 0 ? 1.12 : 1),
        damage: (1 + r.power * .25) * (p.surge > 0 ? 1.45 : 1),
        rate: (1 + r.battery * .16) * (p.surge > 0 ? 1.7 : 1),
        magnet: 2.3 + r.magnet * 1.6,
        critical: .06 + r.lucky * .12,
        dashCooldown: 3.1 - r.nova * .35,
        shield: r.plating * 14
      };
    }

    get score() { return Math.floor(this.kills * 15 + this.time * 3 + this.bossKills * 1200 + this.bestCombo * 20); }
    get boss() { return this.enemies.find(e => e.type === 'boss' && e.hp > 0); }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    evolved(id) { return this.evolutions.has(id); }

    spawn(type, x, z, tier = 0) {
      const data = TYPES[type];
      if (!data) return null;
      if (x === undefined || z === undefined) {
        let attempts = 0;
        do {
          const angle = this.rng() * Math.PI * 2, range = 13 + this.rng() * 7;
          x = clamp(this.player.x + Math.cos(angle) * range, -LIMIT + 1, LIMIT - 1);
          z = clamp(this.player.z + Math.sin(angle) * range, -LIMIT + 1, LIMIT - 1);
        } while (Math.hypot(x - this.player.x, z - this.player.z) < 8 && attempts++ < 20);
      }
      const scale = 1 + this.time / 420;
      const hp = type === 'boss' ? [2200, 7500, 36000][Math.min(2, tier)] * (this.endless ? 1 + (this.time - RUN_TIME) / 200 : 1) : data.hp * (type === 'crate' ? 1 : scale);
      const e = { id: ++this.id, type, x, z, hp, maxHp: hp, radius: data.radius, angle: 0, age: 0, spawn: .8, flash: 0, stun: 0, kx: 0, kz: 0, attack: 2 + this.rng(), mode: 'hunt', dx: 0, dz: 1, sawHit: 0, dashHit: 0, tier, name: BOSS_NAMES[Math.min(2, tier)] };
      this.enemies.push(e);
      if (type === 'boss') { e.spawn = 1.6; this.emit('boss', { name: e.name, x, z }); }
      return e;
    }

    damageEnemy(e, amount, knockback = 0, critical = false) {
      if (!e || e.hp <= 0 || e.spawn > 0) return;
      const damage = amount * this.stats.damage * (critical ? 2 : 1);
      e.hp -= damage;
      this.damageDone += damage;
      e.flash = .12;
      if (knockback && e.type !== 'boss') {
        const d = distance(e, this.player) || 1;
        e.kx += (e.x - this.player.x) / d * knockback;
        e.kz += (e.z - this.player.z) / d * knockback;
      }
      if (critical) this.emit('critical', { x: e.x, z: e.z });
      if (e.hp <= 0) this.kill(e);
    }

    kill(e) {
      const crate = e.type === 'crate', boss = e.type === 'boss';
      if (!crate) {
        this.kills++;
        this.combo = this.comboTime > 0 ? this.combo + 1 : 1;
        this.comboTime = 3;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.player.charge = Math.min(100, this.player.charge + (boss ? 28 : 3));
      }
      this.addGem(e.x, e.z, TYPES[e.type].xp, 'xp');
      if (crate || boss || this.rng() < .025) this.addGem(e.x + .8, e.z, boss ? 35 : 18, 'heal');
      if (boss || (crate && this.rng() < .4)) this.addGem(e.x - .8, e.z, 1, 'magnet');
      this.emit('burst', { x: e.x, z: e.z, color: TYPES[e.type].color, size: boss ? 2.5 : crate ? 1.1 : .6 });
      if (boss) {
        this.bossKills++;
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 30);
        this.bullets = [];
        this.emit('bossDown', { name: e.name });
        if (e.tier === 2 && !this.endless) { this.phase = 'victory'; this.emit('victory'); }
      }
    }

    addGem(x, z, value, kind = 'xp') {
      if (this.gems.length >= 160 && kind === 'xp') {
        let nearest = null, best = Infinity;
        for (const gem of this.gems) {
          const d = Math.hypot(gem.x - x, gem.z - z);
          if (gem.kind === 'xp' && d < best) { nearest = gem; best = d; }
        }
        if (nearest) { nearest.value += value; return; }
      }
      this.gems.push({ id: ++this.id, x, z, value, kind, age: 0, pull: false });
    }

    hurt(amount) {
      const p = this.player;
      if (p.invincible > 0 || p.dash > 0 || this.phase !== 'playing') return;
      let damage = amount * (this.difficulty === 'cozy' ? .55 : 1);
      const shield = Math.min(p.shield, damage);
      p.shield -= shield;
      damage -= shield;
      p.hp = Math.max(0, p.hp - damage);
      p.invincible = .85;
      this.shieldClock = 0;
      this.hitsTaken++;
      this.emit('hurt', { damage });
      if (p.hp <= 0) { this.phase = 'over'; this.emit('over'); }
    }

    dash(x, z) {
      const p = this.player;
      if (p.dashCooldown > 0 || this.phase !== 'playing') return false;
      const length = Math.hypot(x, z);
      if (length > .05) { p.dx = x / length; p.dz = z / length; }
      p.dash = .22;
      p.dashCooldown = this.stats.dashCooldown;
      this.emit('dash', { x: p.x, z: p.z });
      for (const e of this.enemies) e.dashHit = 0;
      if (this.ranks.nova) this.explode(p.x, p.z, 3.1 + this.ranks.nova * .5, 28 + this.ranks.nova * 20, '#ffb279');
      return true;
    }

    surge() {
      const p = this.player;
      if (p.charge < 100 || this.phase !== 'playing') return false;
      p.charge = 0;
      p.surge = 9;
      p.invincible = Math.max(p.invincible, 1);
      p.hp = Math.min(this.stats.maxHp, p.hp + 12);
      this.bullets = [];
      this.explode(p.x, p.z, 5, 45, '#d5f67d');
      this.emit('surge');
      return true;
    }

    explode(x, z, radius, damage, color = '#ffb279') {
      this.emit('ring', { x, z, radius, color });
      for (const e of this.enemies) if (e.hp > 0 && Math.hypot(e.x - x, e.z - z) < radius + e.radius) this.damageEnemy(e, damage, 5);
    }

    nearest(from = this.player, range = 18, exclude = new Set()) {
      let closest = null, best = range;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.spawn > 0 || exclude.has(e.id)) continue;
        const d = distance(from, e) + (e.type === 'crate' ? 7 : 0);
        if (d < best) { closest = e; best = d; }
      }
      return closest;
    }

    fire() {
      const p = this.player, target = this.nearest();
      if (!target) return;
      const angle = Math.atan2(target.x - p.x, target.z - p.z), rank = this.ranks.blaster;
      p.angle = angle;
      const count = rank >= 4 ? 3 : rank >= 2 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const a = angle + (i - (count - 1) / 2) * .12;
        this.shots.push({ id: ++this.id, x: p.x, z: p.z, vx: Math.sin(a) * 22, vz: Math.cos(a) * 22, life: .95, type: 'pop', damage: 15 + rank * 3, radius: .24, pierce: rank >= 3 ? 2 : 1, hits: new Set(), bounce: this.evolved('blaster') ? 3 : 0 });
      }
      this.emit('shoot');
    }

    rockets() {
      const target = this.nearest(this.player, 21);
      if (!target) return;
      const rank = this.ranks.rockets, count = this.evolved('rockets') ? 3 : rank >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const a = this.player.angle + (i - (count - 1) / 2) * .65;
        this.shots.push({ id: ++this.id, x: this.player.x, z: this.player.z, vx: Math.sin(a) * 8, vz: Math.cos(a) * 8, life: 3, type: 'rocket', damage: 34 + rank * 15, radius: .34, splash: 2.2 + rank * .28, target: target.id, hits: new Set() });
      }
      this.emit('rocket');
    }

    lightning() {
      let from = this.player;
      const hits = new Set(), rank = this.ranks.spark, evolved = this.evolved('spark');
      for (let i = 0; i < (evolved ? 10 : rank + 2); i++) {
        const target = this.nearest(from, i === 0 ? 12 : evolved ? 7 : 5.5, hits);
        if (!target) break;
        this.emit('lightning', { x: from.x, z: from.z, tx: target.x, tz: target.z });
        this.damageEnemy(target, 12 + rank * 10, .8);
        if (evolved) target.stun = .8;
        hits.add(target.id);
        from = target;
      }
      if (hits.size) this.emit('zap');
    }

    saws() {
      if (!this.ranks.saws) return [];
      const count = this.evolved('saws') ? 7 : this.ranks.saws + 1;
      const radius = this.evolved('saws') ? 4.2 : 2.6 + this.ranks.saws * .2;
      return Array.from({ length: count }, (_, i) => {
        const angle = this.time * 2.6 + i / count * Math.PI * 2;
        return { x: this.player.x + Math.sin(angle) * radius, z: this.player.z + Math.cos(angle) * radius, angle };
      });
    }

    getChoices() {
      const pool = UPGRADES.filter(u => u.id === 'repair' ? this.player.hp < this.stats.maxHp * .65 : this.ranks[u.id] < u.max);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      return pool.slice(0, 3).map(u => u.id);
    }

    levelUp() {
      if (this.phase !== 'playing' || this.player.xp < nextXP(this.player.level)) return;
      this.player.xp -= nextXP(this.player.level);
      this.player.level++;
      this.choices = this.getChoices();
      if (!this.choices.length) this.choices = ['repair'];
      this.phase = 'upgrade';
      this.emit('level');
    }

    reroll() {
      if (this.phase !== 'upgrade' || this.rerolls <= 0) return false;
      this.rerolls--;
      this.choices = this.getChoices();
      if (!this.choices.length) this.choices = ['repair'];
      return true;
    }

    choose(id) {
      if (this.phase !== 'upgrade' || !this.choices.includes(id)) return false;
      const upgrade = UPGRADES.find(u => u.id === id);
      if (!upgrade || (id !== 'repair' && this.ranks[id] >= upgrade.max)) return false;
      if (id === 'repair') this.player.hp = Math.min(this.stats.maxHp, this.player.hp + this.stats.maxHp * .45);
      else {
        this.ranks[id]++;
        if (id === 'plating') { this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 35); this.player.shield = this.stats.shield; }
      }
      for (const [weapon, boost] of [['blaster', 'battery'], ['rockets', 'power'], ['saws', 'magnet'], ['spark', 'battery']]) {
        if (this.ranks[weapon] >= 4 && this.ranks[boost] >= 2 && !this.evolved(weapon)) {
          this.evolutions.add(weapon);
          this.emit('evolution', { weapon });
        }
      }
      this.phase = 'playing';
      this.player.invincible = Math.max(.6, this.player.invincible);
      this.choices = [];
      return true;
    }

    continueEndless() {
      if (this.phase !== 'victory') return false;
      this.endless = true;
      this.phase = 'playing';
      this.player.hp = this.stats.maxHp;
      this.player.invincible = 3;
      this.endlessBossAt = this.time + 90;
      return true;
    }

    step(dt, input = {}) {
      if (this.phase !== 'playing') return;
      dt = clamp(dt, 0, 1 / 30);
      this.events = [];
      this.time += dt;
      const p = this.player, stats = this.stats;
      this.comboTime = Math.max(0, this.comboTime - dt);
      if (!this.comboTime) this.combo = 0;
      p.invincible = Math.max(0, p.invincible - dt);
      p.surge = Math.max(0, p.surge - dt);
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      p.dash = Math.max(0, p.dash - dt);
      this.shieldClock += dt;
      if (this.shieldClock > 8) p.shield = Math.min(stats.shield, p.shield + dt * 8);
      let x = Number.isFinite(input.x) ? input.x : 0, z = Number.isFinite(input.z) ? input.z : 0;
      const length = Math.hypot(x, z);
      if (length > 1) { x /= length; z /= length; }
      if (input.dash) this.dash(x, z);
      if (input.surge) this.surge();
      if (p.dash > 0) { x = p.dx; z = p.dz; }
      else if (length > .05) { const heading = Math.hypot(x, z); p.dx = x / heading; p.dz = z / heading; }
      p.x = clamp(p.x + x * (p.dash > 0 ? 27 : stats.speed) * dt, -LIMIT, LIMIT);
      p.z = clamp(p.z + z * (p.dash > 0 ? 27 : stats.speed) * dt, -LIMIT, LIMIT);
      if (length > .05 && !this.nearest(p, 15)) p.angle = Math.atan2(x, z);

      this.spawnClock -= dt;
      if (this.spawnClock <= 0) {
        this.spawnClock = Math.max(.2, .95 - this.time / 650) * (this.difficulty === 'cozy' ? 1.2 : 1);
        const cap = Math.min(85, 22 + this.time / 8);
        if (this.enemies.filter(e => e.type !== 'crate').length < cap) {
          const roll = this.rng();
          const type = this.time > 85 && roll < .15 ? 'charger' : this.time > 45 && roll < .3 ? 'spitter' : this.time > 25 && roll < .44 ? 'bruiser' : this.time > 12 && roll < .66 ? 'skitter' : 'nibbler';
          this.spawn(type);
          if (this.time > 210 && this.rng() < .4) this.spawn('skitter');
        }
      }
      this.crateClock -= dt;
      if (this.crateClock <= 0) {
        this.crateClock = 25;
        if (this.enemies.filter(e => e.type === 'crate').length < 5) this.spawn('crate');
      }
      if (!this.boss && this.bossIndex < BOSS_TIMES.length && this.time >= BOSS_TIMES[this.bossIndex]) {
        this.spawn('boss', undefined, undefined, this.bossIndex++);
      } else if (this.endless && !this.boss && this.time >= this.endlessBossAt) {
        this.spawn('boss', undefined, undefined, 2);
        this.endlessBossAt = this.time + 100;
      }

      this.fireClock -= dt;
      if (this.fireClock <= 0) { this.fire(); this.fireClock = Math.max(.11, .42 - this.ranks.blaster * .035) / stats.rate; }
      this.rocketClock -= dt;
      if (this.ranks.rockets && this.rocketClock <= 0) { this.rockets(); this.rocketClock = (2.8 - this.ranks.rockets * .3) / stats.rate; }
      this.sparkClock -= dt;
      if (this.ranks.spark && this.sparkClock <= 0) { this.lightning(); this.sparkClock = (2.1 - this.ranks.spark * .18) / stats.rate; }
      const saws = this.saws();

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        e.age += dt;
        e.spawn = Math.max(0, e.spawn - dt);
        e.flash = Math.max(0, e.flash - dt);
        e.stun = Math.max(0, e.stun - dt);
        e.sawHit = Math.max(0, e.sawHit - dt);
        if (e.spawn > 0) continue;
        let dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || .01;
        dx /= d; dz /= d;
        e.angle = Math.atan2(dx, dz);
        let vx = dx * TYPES[e.type].speed, vz = dz * TYPES[e.type].speed;
        if (e.type === 'spitter') {
          if (d < 8) { vx *= -1; vz *= -1; } else if (d < 11) { vx *= .15; vz *= .15; }
          e.attack -= dt;
          e.mode = e.attack < .8 ? 'warn' : 'hunt';
          if (e.attack <= 0) {
            this.enemyShot(e.x, e.z, dx * 6, dz * 6, 9);
            e.attack = 3.8;
          }
        }
        if (e.type === 'charger') {
          e.attack -= dt;
          if (e.attack <= 0 && e.mode === 'hunt') { e.mode = 'warn'; e.attack = .9; e.dx = dx; e.dz = dz; }
          else if (e.attack <= 0 && e.mode === 'warn') { e.mode = 'charge'; e.attack = .75; this.emit('charge', { x: e.x, z: e.z }); }
          else if (e.attack <= 0 && e.mode === 'charge') { e.mode = 'hunt'; e.attack = 3.2; }
          if (e.mode === 'warn') { vx = vz = 0; }
          if (e.mode === 'charge') { vx = e.dx * 12; vz = e.dz * 12; e.angle = Math.atan2(e.dx, e.dz); }
        }
        if (e.type === 'boss') {
          e.attack -= dt;
          if (e.mode === 'hunt' && e.attack < 1.2) { e.mode = 'warn'; }
          if (e.mode === 'warn') { vx *= .15; vz *= .15; }
          if (e.attack <= 0) {
            const count = 10 + e.tier * 3, offset = Math.atan2(dz, dx);
            for (let i = 0; i < count; i++) {
              const a = offset + i / count * Math.PI * 2;
              this.enemyShot(e.x, e.z, Math.cos(a) * (4.2 + e.tier * .5), Math.sin(a) * (4.2 + e.tier * .5), 12 + e.tier * 2);
            }
            // Later bosses add aimed fans and reinforcements to the radial stomp.
            if (e.tier >= 1) for (const angle of [-.2, 0, .2]) {
              const a = offset + angle;
              this.enemyShot(e.x, e.z, Math.cos(a) * 8, Math.sin(a) * 8, 15);
            }
            if (e.tier >= 2 && this.enemies.length < 80) {
              for (let i = 0; i < 2; i++) this.spawn('charger');
            }
            this.emit('ring', { x: e.x, z: e.z, radius: 4.7, color: '#ff7972' });
            if (d < 4.7) this.hurt(20 + e.tier * 4);
            if (this.phase === 'over') return;
            e.attack = e.hp < e.maxHp / 2 ? 2.9 : 4;
            e.mode = 'hunt';
          }
          if (e.hp < e.maxHp / 2) { vx *= 1.55; vz *= 1.55; }
        }
        // Soft separation avoids unreadable piles without blocking escape paths.
        if (e.type !== 'crate') for (const other of this.enemies) {
          if (other === e || other.hp <= 0 || other.type === 'crate') continue;
          const ox = e.x - other.x, oz = e.z - other.z, gap = Math.hypot(ox, oz), min = (e.radius + other.radius) * .82;
          if (gap > .01 && gap < min) { vx += ox / gap * (min - gap) * 2; vz += oz / gap * (min - gap) * 2; }
        }
        if (e.stun > 0) { vx *= .15; vz *= .15; }
        e.x = clamp(e.x + (vx + e.kx) * dt, -LIMIT, LIMIT);
        e.z = clamp(e.z + (vz + e.kz) * dt, -LIMIT, LIMIT);
        e.kx *= Math.exp(-dt * 10); e.kz *= Math.exp(-dt * 10);
        d = distance(e, p);
        if (d < e.radius + .55) {
          if (p.dash > 0 && !e.dashHit) { e.dashHit = 1; this.damageEnemy(e, 35 + this.ranks.nova * 15, 8); }
          else if (e.type !== 'crate') this.hurt(TYPES[e.type].damage);
          if (this.phase === 'over') return;
        }
        if (!e.sawHit && saws.some(s => distance(s, e) < e.radius + .55)) {
          this.damageEnemy(e, 12 + this.ranks.saws * 5, .6);
          e.sawHit = .32;
          if (this.evolved('saws')) e.stun = .5;
        }
      }

      if (this.phase === 'over') return;

      for (const shot of this.shots) {
        shot.life -= dt;
        if (shot.type === 'rocket') {
          let target = this.enemies.find(e => e.id === shot.target && e.hp > 0);
          if (!target) target = this.nearest(shot, 22);
          if (target) {
            const d = distance(shot, target) || 1;
            shot.vx += ((target.x - shot.x) / d * 13 - shot.vx) * Math.min(1, dt * 7);
            shot.vz += ((target.z - shot.z) / d * 13 - shot.vz) * Math.min(1, dt * 7);
          }
        }
        shot.x += shot.vx * dt; shot.z += shot.vz * dt;
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.spawn > 0 || shot.hits.has(e.id) || distance(shot, e) > e.radius + shot.radius) continue;
          if (shot.type === 'rocket') { this.explode(shot.x, shot.z, shot.splash, shot.damage); shot.life = 0; break; }
          this.damageEnemy(e, shot.damage, 1.2, this.rng() < stats.critical);
          shot.hits.add(e.id);
          shot.pierce--;
          if (shot.bounce > 0) {
            const next = this.nearest(e, 9, shot.hits);
            if (next) {
              const d = distance(shot, next) || 1;
              shot.vx = (next.x - shot.x) / d * 22; shot.vz = (next.z - shot.z) / d * 22;
              shot.bounce--; shot.pierce++; shot.life = .7;
            }
          }
          if (shot.pierce <= 0) { shot.life = 0; break; }
        }
      }
      for (const bullet of this.bullets) {
        bullet.x += bullet.vx * dt; bullet.z += bullet.vz * dt; bullet.life -= dt;
        if (distance(bullet, p) < .72) { this.hurt(bullet.damage); bullet.life = 0; }
        if (this.phase === 'over') return;
      }
      for (const gem of this.gems) {
        gem.age += dt;
        const d = distance(gem, p);
        if (d < (gem.kind === 'xp' ? stats.magnet : 1.8) || gem.pull) {
          const move = Math.min(d, (gem.pull ? 20 : 12) * dt);
          gem.x += (p.x - gem.x) / (d || 1) * move; gem.z += (p.z - gem.z) / (d || 1) * move;
        }
        if (distance(gem, p) < .8) {
          if (gem.kind === 'xp') { p.xp += gem.value; this.emit('pickup'); }
          if (gem.kind === 'heal') { p.hp = Math.min(stats.maxHp, p.hp + gem.value); this.emit('heal'); }
          if (gem.kind === 'magnet') { for (const other of this.gems) if (other.kind === 'xp') other.pull = true; this.emit('magnet'); }
          gem.taken = true;
        }
      }
      this.enemies = this.enemies.filter(e => e.hp > 0);
      this.shots = this.shots.filter(s => s.life > 0).slice(-140);
      this.bullets = this.bullets.filter(b => b.life > 0 && Math.abs(b.x) < LIMIT + 4 && Math.abs(b.z) < LIMIT + 4).slice(-180);
      this.gems = this.gems.filter(g => !g.taken && (g.kind === 'xp' || g.age < 45));
      this.levelUp();
    }

    enemyShot(x, z, vx, vz, damage) {
      this.bullets.push({ id: ++this.id, x, z, vx, vz, damage, life: 7 });
    }
  }
  const api = { Game, UPGRADES, PILOTS, TYPES, LIMIT, RUN_TIME, BOSS_TIMES, nextXP, seedFor, random, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketEngine = api;
})(globalThis);
