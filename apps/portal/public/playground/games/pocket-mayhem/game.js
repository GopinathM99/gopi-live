(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { Game, PILOTS, UPGRADES, nextXP, seedFor, RUN_TIME, clamp } = PocketEngine;
  const screens = ['menu', 'upgrade', 'paused', 'results', 'guide', 'error'];
  const savedKey = 'gopi-pocket-mayhem-v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = new PocketSound();
  const evolutionNames = { blaster: 'Confetti cannon', rockets: 'Firework party', saws: 'Saturn rings', spark: 'Thunderstorm' };
  const keys = new Set();
  const stick = { x: 0, z: 0, id: null };
  const profile = { best: 0, wins: 0, runs: 0, kills: 0, sound: true, pilot: 'zip' };
  let persistent = true, selectedPilot = 'zip', game, view, state = 'loading';
  let last = performance.now(), accumulator = 0, hudClock = 0, toastTime = 0, hurtTime = 0;
  let dashRequested = false, surgeRequested = false, loadoutSignature = '', renderedState = '', slowFrames = 0;

  try {
    const saved = JSON.parse(localStorage.getItem(savedKey));
    if (saved && typeof saved === 'object') {
      for (const key of ['best', 'wins', 'runs', 'kills']) if (Number.isFinite(saved[key])) profile[key] = clamp(Math.floor(saved[key]), 0, 1e9);
      if (typeof saved.sound === 'boolean') profile.sound = saved.sound;
      if (Object.hasOwn(PILOTS, saved.pilot)) profile.pilot = saved.pilot;
    }
  } catch { persistent = false; }
  selectedPilot = profile.pilot;
  sound.enabled = profile.sound;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function timeLabel(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`; }
  function save() {
    try { localStorage.setItem(savedKey, JSON.stringify(profile)); }
    catch { persistent = false; }
  }
  function clearInput() {
    keys.clear(); stick.x = stick.z = 0; stick.id = null; dashRequested = surgeRequested = false;
    $('stick-knob').style.transform = '';
  }
  function announce(message) { $('announcement').textContent = message; }
  function show(next) {
    state = next;
    document.body.dataset.state = next;
    for (const id of screens) $(id).hidden = id !== next;
    $('hud').hidden = ['menu', 'guide', 'error', 'loading'].includes(next);
    $('hud').inert = next !== 'playing';
    clearInput();
    accumulator = 0;
    last = performance.now();
    if (next === 'playing') $('world').focus({ preventScroll: true });
    else requestAnimationFrame(() => $(next)?.querySelector('button:not(:disabled), a, input')?.focus({ preventScroll: true }));
  }
  function toast(kicker, title, seconds = 3) {
    $('toast-kicker').textContent = kicker; $('toast-title').textContent = title;
    $('toast').hidden = false; toastTime = seconds; announce(`${kicker}. ${title}`);
  }
  function renderPilots() {
    $('pilots').replaceChildren();
    for (const [id, pilot] of Object.entries(PILOTS)) {
      const button = node('button', 'pilot'); button.type = 'button'; button.dataset.pilot = id;
      button.style.setProperty('--pilot', pilot.color);
      button.setAttribute('aria-pressed', String(id === selectedPilot));
      const icon = node('span', 'pilot-icon'); icon.setAttribute('aria-hidden', 'true');
      const label = node('span'); label.append(node('b', '', pilot.name), node('small', '', id === 'zip' ? 'POP CANNON' : id === 'orbit' ? 'ORBIT SAWS' : 'LIGHTNING'));
      button.append(icon, label);
      button.addEventListener('click', () => {
        selectedPilot = id; profile.pilot = id; save(); renderPilots();
        $('pilots').querySelector(`[data-pilot="${id}"]`).focus();
        if (state === 'menu') game = new Game({ pilot: id, seed: 17 });
      });
      $('pilots').append(button);
    }
    $('pilot-note').textContent = PILOTS[selectedPilot].description;
  }
  function soundLabels() {
    $('sound').setAttribute('aria-pressed', String(sound.enabled));
    $('sound').setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Enable sound');
    $('sound').textContent = sound.enabled ? '♪' : '♩';
    $('menu-sound').setAttribute('aria-pressed', String(sound.enabled));
    $('menu-sound').textContent = sound.enabled ? 'Sound on ♪' : 'Sound off ♩';
  }
  function toggleSound() {
    sound.init(); sound.enabled = !sound.enabled; profile.sound = sound.enabled; save(); soundLabels();
  }
  function showMenu() {
    game = new Game({ pilot: selectedPilot, seed: 17 });
    $('personal-best').replaceChildren(document.createTextNode(persistent ? 'PERSONAL BEST' : 'BEST THIS VISIT'), node('b', '', profile.best ? profile.best.toLocaleString() : '—'));
    show('menu'); renderPilots();
  }
  function start() {
    sound.init();
    const daily = $('daily').checked;
    const seed = daily ? seedFor(`pocket-mayhem-${new Date().toISOString().slice(0, 10)}`) : cryptoSeed();
    game = new Game({ seed, pilot: selectedPilot, difficulty: $('difficulty').value });
    game.daily = daily;
    game.record = { kills: 0, won: false, counted: false };
    view.particles = [];
    loadoutSignature = '';
    $('pilot-name').textContent = PILOTS[selectedPilot].name.toUpperCase();
    $('first-tip').hidden = false; $('damage-flash').classList.remove('hit');
    show('playing'); updateHUD();
    toast('WELCOME TO THE TOYBOX', 'Stay small. Cause problems.', 2.5);
  }
  function cryptoSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
    catch { return Date.now() >>> 0; }
  }
  function pause() {
    if (state === 'playing') {
      game.phase = 'paused'; buildChips($('pause-build')); show('paused'); announce('Game paused.');
    } else if (state === 'paused') {
      game.phase = 'playing'; show('playing'); sound.init(); announce('Game resumed.');
    }
  }
  function buildChips(container) {
    container.replaceChildren();
    for (const upgrade of UPGRADES) if (game.ranks[upgrade.id]) {
      const chip = node('span', '', `${upgrade.icon} ${game.evolved(upgrade.id) ? evolutionNames[upgrade.id] : upgrade.name} ${game.ranks[upgrade.id]}`);
      chip.style.setProperty('--chip', upgrade.color); container.append(chip);
    }
  }
  function renderUpgrade() {
    $('upgrade-cards').replaceChildren();
    game.choices.forEach((id, index) => {
      const upgrade = UPGRADES.find(u => u.id === id), rank = game.ranks[id] || 0;
      const card = node('button', 'upgrade-card'); card.dataset.upgrade = id;
      card.style.setProperty('--card', upgrade.color);
      card.append(node('span', 'card-key', String(index + 1)), node('span', 'card-icon', upgrade.icon));
      card.append(node('span', 'card-kind', `${upgrade.kind} · ${id === 'repair' ? 'INSTANT' : rank ? `RANK ${rank} → ${rank + 1}` : 'NEW TOY'}`));
      card.append(node('b', '', upgrade.name), node('span', 'card-description', upgrade.description));
      if (upgrade.evolution) card.append(node('span', 'card-recipe', upgrade.evolution));
      card.addEventListener('click', () => chooseUpgrade(id));
      $('upgrade-cards').append(card);
    });
    $('upgrade-level').textContent = `LEVEL ${game.player.level} · MAKE IT COUNT`;
    $('reroll').disabled = game.rerolls <= 0;
    $('reroll').replaceChildren(document.createTextNode('Remix choices '), node('span', '', `${game.rerolls} left`));
  }
  function chooseUpgrade(id) {
    if (!game.choose(id)) return;
    sound.init(); show('playing'); processEvents();
    sound.event('heal'); updateHUD();
  }
  function recordResult(won) {
    const record = game.record;
    if (!record.counted) { profile.runs++; record.counted = true; }
    profile.kills += Math.max(0, game.kills - record.kills); record.kills = game.kills;
    if (won && !record.won) { profile.wins++; record.won = true; }
    const best = game.score > profile.best;
    profile.best = Math.max(profile.best, game.score); save();
    return best;
  }
  function results(won) {
    const newBest = recordResult(won);
    $('result-kicker').textContent = won ? 'THE TOYBOX IS YOURS' : 'A BEAUTIFUL LITTLE DISASTER';
    $('result-title').textContent = won ? 'Tiny robot. Total legend.' : game.time > 240 ? 'That was a good kind of chaos.' : 'One little robot. One more idea.';
    $('result-copy').textContent = won ? 'All three bosses recycled. Bank the win, or take your build into endless overtime.' : game.evolutions.size ? 'That evolved build had teeth. Try a new combination, or give this one another run.' : 'Try pairing a rank-four weapon with its boost to unlock an evolution. The next combination could be ridiculous.';
    $('result-score').textContent = game.score.toLocaleString();
    $('result-best').textContent = `${newBest ? 'NEW PERSONAL BEST · ' : 'PERSONAL BEST · '}${profile.best.toLocaleString()}${persistent ? '' : ' · this visit'}`;
    $('result-time').textContent = timeLabel(game.time); $('result-kills').textContent = game.kills;
    $('result-level').textContent = game.player.level; $('result-bosses').textContent = game.bossKills;
    $('endless').hidden = !won; buildChips($('result-build')); show('results');
    announce(won ? `You won with ${game.score} points.` : `Run finished at ${timeLabel(game.time)} with ${game.score} points.`);
  }
  function processEvents() {
    const events = game.events; game.events = [];
    for (const event of events) {
      view.event(event); sound.event(event.type);
      if (event.type === 'hurt') { hurtTime = .2; $('damage-flash').classList.add('hit'); }
      if (event.type === 'boss') toast('BIG TOY. BIG ATTITUDE.', event.name, 3);
      if (event.type === 'bossDown') toast('EXCELLENT RECYCLING', 'Boss down. Keep the good ideas.', 3);
      if (event.type === 'evolution') toast('WEAPON EVOLVED', evolutionNames[event.weapon], 4);
      if (event.type === 'surge') toast('NINE SECONDS. ZERO RESTRAINT.', 'OVERDRIVE!', 1.8);
      if (event.type === 'magnet') toast('COME TO THE ROBOT', 'Battery sweep!', 1.5);
      if (event.type === 'heal') announce('Health repaired.');
    }
  }
  function updateHUD() {
    const p = game.player, stats = game.stats;
    $('health-label').textContent = `${Math.ceil(p.hp)} / ${stats.maxHp}`;
    $('health-fill').style.width = `${p.hp / stats.maxHp * 100}%`;
    $('health-fill').style.background = p.hp < stats.maxHp * .3 ? '#ff9892' : 'var(--lime)';
    $('level-label').textContent = `LV ${p.level}`;
    $('xp-fill').style.width = `${Math.min(100, p.xp / nextXP(p.level) * 100)}%`;
    $('shield-label').textContent = p.shield > 0 ? `◈ ${Math.ceil(p.shield)}` : '';
    $('timer').textContent = timeLabel(game.time);
    $('goal-label').textContent = game.endless ? 'ENDLESS OVERTIME' : game.time >= RUN_TIME ? 'BEAT THE FINAL BOSS' : 'FINAL BOSS AT 08:00';
    $('zone-label').textContent = p.surge > 0 ? 'OVERDRIVE ACTIVE' : game.daily ? 'TOYBOX / DAILY REMIX' : 'TOYBOX / SURVIVE';
    $('kills').textContent = game.kills;
    $('combo').textContent = game.combo >= 5 ? `${game.combo}× GOOD TROUBLE` : '';
    $('dash').disabled = p.dashCooldown > 0;
    $('dash').classList.toggle('ready', p.dashCooldown <= 0);
    $('dash').style.setProperty('--charge', `${(1 - p.dashCooldown / stats.dashCooldown) * 100}%`);
    $('dash-label').textContent = p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}s` : 'DASH';
    $('surge').disabled = p.charge < 100;
    $('surge').classList.toggle('ready', p.charge >= 100);
    $('surge').style.setProperty('--charge', `${p.charge}%`);
    $('surge-label').textContent = p.surge > 0 ? `${Math.ceil(p.surge)}s` : p.charge >= 100 ? 'READY' : `${Math.floor(p.charge)}%`;
    $('first-tip').hidden = game.time > 18 || p.level > 1;
    const boss = game.boss;
    $('boss-hud').hidden = !boss;
    if (boss) {
      $('boss-name').textContent = boss.name;
      $('boss-health').textContent = `${Math.ceil(boss.hp / boss.maxHp * 100)}%`;
      $('boss-fill').style.width = `${boss.hp / boss.maxHp * 100}%`;
    }
    const signature = JSON.stringify(game.ranks) + [...game.evolutions].join(',');
    if (signature !== loadoutSignature) {
      loadoutSignature = signature; $('loadout').replaceChildren();
      for (const u of UPGRADES) if (game.ranks[u.id]) {
        const chip = node('div', `loadout-chip${game.evolved(u.id) ? ' evolved' : ''}`);
        chip.style.setProperty('--chip', u.color); chip.title = `${game.evolved(u.id) ? evolutionNames[u.id] : u.name} · Rank ${game.ranks[u.id]}`;
        chip.setAttribute('aria-label', chip.title); chip.append(document.createTextNode(u.icon), node('small', '', game.evolved(u.id) ? 'EVO' : '●'.repeat(game.ranks[u.id])));
        $('loadout').append(chip);
      }
    }
  }

  function input() {
    return {
      x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x,
      z: (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stick.z,
      dash: dashRequested || keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight'),
      surge: surgeRequested || keys.has('KeyF')
    };
  }
  function frame(now) {
    if (state === 'error') return;
    const realDt = Math.min(.1, (now - last) / 1000); last = now;
    let moving = false;
    if (state === 'playing') {
      accumulator += realDt;
      while (accumulator >= 1 / 60 && state === 'playing') {
        const controls = input(); moving = !!(controls.x || controls.z);
        game.step(1 / 60, controls); accumulator -= 1 / 60;
        dashRequested = surgeRequested = false; processEvents();
        if (game.phase === 'upgrade') { renderUpgrade(); show('upgrade'); announce(`Level ${game.player.level}. Choose an upgrade. Time is paused.`); }
        if (game.phase === 'victory' || game.phase === 'over') results(game.phase === 'victory');
      }
      hudClock += realDt;
      if (hudClock > .08) { updateHUD(); hudClock = 0; }
      toastTime -= realDt; if (toastTime <= 0) $('toast').hidden = true;
      hurtTime -= realDt; if (hurtTime <= 0) $('damage-flash').classList.remove('hit');
    }
    const attract = state === 'menu' || state === 'guide';
    if (state === 'playing' || attract || renderedState !== state) {
      view.draw(game, state === 'playing' || attract ? realDt : 0, { attract, moving });
      renderedState = state;
    }
    sound.tick(state === 'playing', game.player.surge > 0);
    if (state === 'playing' && realDt > .035) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 90 && view.renderer.getPixelRatio() > 1) { view.renderer.setPixelRatio(1); view.resize(); slowFrames = 0; }
    requestAnimationFrame(frame);
  }

  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('restart').addEventListener('click', start);
  $('change-pilot').addEventListener('click', showMenu);
  $('pause').addEventListener('click', pause);
  $('resume').addEventListener('click', pause);
  $('menu-sound').addEventListener('click', toggleSound);
  $('sound').addEventListener('click', toggleSound);
  $('dash').addEventListener('click', () => { if (state === 'playing') dashRequested = true; });
  $('surge').addEventListener('click', () => { if (state === 'playing') surgeRequested = true; });
  // Browsers do not reliably synthesize clicks for a second touch while the
  // movement thumb is held. Activate abilities on that finger's pointerdown.
  for (const id of ['dash', 'surge']) $(id).addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || state !== 'playing' || $(id).disabled) return;
    event.preventDefault();
    if (id === 'dash') dashRequested = true;
    else surgeRequested = true;
  });
  $('reroll').addEventListener('click', () => { if (game.reroll()) { renderUpgrade(); $('upgrade-cards').querySelector('button')?.focus(); } });
  $('guide-open').addEventListener('click', () => show('guide'));
  $('guide-close').addEventListener('click', () => show('menu'));
  $('endless').addEventListener('click', () => {
    if (game.continueEndless()) { sound.init(); show('playing'); toast('YOU ASKED FOR IT', 'Endless overtime.', 3); }
  });
  $('reload').addEventListener('click', () => location.reload());
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { toast('FULLSCREEN UNAVAILABLE', 'Your browser is already the arena.', 2); }
  });

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Tab' && screens.includes(state) && state !== 'menu') {
      const items = [...$(state).querySelectorAll('button:not(:disabled):not([hidden]),a[href],select,input')].filter(el => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0], end = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
    }
    if (event.code === 'KeyM' && !event.repeat) { toggleSound(); return; }
    if (['KeyP', 'Escape'].includes(event.code) && !event.repeat) {
      if (state === 'playing' || state === 'paused') { event.preventDefault(); pause(); return; }
      if (state === 'guide') { show('menu'); return; }
    }
    if (state === 'upgrade' && !event.repeat && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      event.preventDefault(); chooseUpgrade(game.choices[Number(event.code.slice(-1)) - 1]); return;
    }
    if (state !== 'playing') return;
    if (event.code === 'Space' && event.target.tagName === 'BUTTON') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyF'].includes(event.code)) {
      event.preventDefault(); keys.add(event.code);
    }
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  function moveStick(event) {
    if (event.pointerId !== stick.id) return;
    const rect = $('joystick').getBoundingClientRect(), dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + 63);
    const distance = Math.hypot(dx, dy), scale = distance > 38 ? 38 / distance : 1;
    stick.x = dx * scale / 38; stick.z = dy * scale / 38;
    $('stick-knob').style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }
  $('joystick').addEventListener('pointerdown', event => {
    if (state !== 'playing' || stick.id !== null) return;
    event.preventDefault(); stick.id = event.pointerId; $('joystick').setPointerCapture(event.pointerId); moveStick(event);
  });
  $('joystick').addEventListener('pointermove', moveStick);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(type, event => {
    if (event.pointerId === stick.id) { stick.id = null; stick.x = stick.z = 0; $('stick-knob').style.transform = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') pause();
    clearInput(); last = performance.now();
  });
  window.addEventListener('blur', () => { clearInput(); if (state === 'playing') pause(); });
  window.addEventListener('resize', () => { view?.resize(); renderedState = ''; });
  $('world').addEventListener('webglcontextlost', event => {
    event.preventDefault(); if (game) game.phase = 'paused';
    $('error-copy').textContent = 'The browser paused its 3D graphics. Reload to start a fresh run, or try closing other graphics-heavy tabs.';
    show('error');
  });
  soundLabels(); renderPilots();
  try { view = new PocketView($('world'), { reducedMotion }); showMenu(); requestAnimationFrame(frame); }
  catch (error) { show('error'); console.error('Pocket Mayhem could not initialize WebGL:', error.message); }
})();
