(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const TAU = Math.PI * 2;
  const H = 800; // logical playfield height; width follows the screen's aspect
  let W = 600;
  let viewScale = 1;
  let dpr = 1;
  let offX = 0;
  let offY = 0;
  let sprScale = 2;

  const PLAYER_SPEED = 430;
  const PLAYER_HITBOX = 7;
  const START_LIVES = 3;
  const START_BOMBS = 2;
  const MAX_BOMBS = 5;
  const EXTRA_LIFE_EVERY = 40000;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

  function weighted(entries) {
    let total = 0;
    for (const k in entries) total += entries[k];
    let r = Math.random() * total;
    for (const k in entries) {
      r -= entries[k];
      if (r <= 0) return k;
    }
    return Object.keys(entries)[0];
  }

  // The portal loads games in a sandboxed iframe with an opaque origin,
  // where localStorage throws, so the best score falls back to memory.
  const storage = {
    get() {
      try {
        return Number(localStorage.getItem("nebula-strike.best")) || 0;
      } catch {
        return 0;
      }
    },
    set(value) {
      try {
        localStorage.setItem("nebula-strike.best", String(value));
      } catch {}
    },
  };

  // ---------------------------------------------------------------- audio

  let actx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  const lastSfx = {};

  function initAudio() {
    if (actx) {
      if (actx.state === "suspended") actx.resume();
      return;
    }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = 0.32;
      master.connect(actx.destination);
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      actx = null;
    }
  }

  function throttled(name, gap) {
    if (!actx) return true;
    const now = actx.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < gap) return true;
    lastSfx[name] = now;
    return false;
  }

  function tone({ type = "square", f = 440, f2 = 0, dur = 0.1, vol = 0.2, delay = 0 }) {
    if (!actx || muted) return;
    const t = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.4, vol = 0.4, f = 1500, f2 = 100, delay = 0 }) {
    if (!actx || muted) return;
    const t = actx.currentTime + delay;
    const src = actx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(f, t);
    filter.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const sfx = {
    shoot() {
      if (throttled("shoot", 0.075)) return;
      tone({ type: "square", f: 1100, f2: 520, dur: 0.05, vol: 0.035 });
    },
    missile() {
      if (throttled("missile", 0.2)) return;
      noise({ dur: 0.18, vol: 0.08, f: 3000, f2: 600 });
    },
    hit() {
      if (throttled("hit", 0.05)) return;
      tone({ type: "triangle", f: 320, f2: 140, dur: 0.05, vol: 0.06 });
    },
    boom(size) {
      if (throttled("boom", 0.06)) return;
      noise({ dur: 0.25 + size * 0.5, vol: 0.18 + size * 0.25, f: 1800, f2: 60 });
      if (size > 0.6) tone({ type: "sine", f: 140, f2: 30, dur: 0.6, vol: 0.3 });
    },
    gem() {
      if (throttled("gem", 0.04)) return;
      tone({ type: "sine", f: rand(1500, 1900), dur: 0.06, vol: 0.05 });
    },
    pickup() {
      [660, 880, 1320].forEach((f, i) => tone({ type: "triangle", f, dur: 0.12, vol: 0.12, delay: i * 0.06 }));
    },
    bomb() {
      noise({ dur: 1.4, vol: 0.6, f: 900, f2: 40 });
      tone({ type: "sine", f: 110, f2: 25, dur: 1.2, vol: 0.5 });
    },
    hurt() {
      noise({ dur: 0.6, vol: 0.5, f: 2500, f2: 80 });
      tone({ type: "sawtooth", f: 420, f2: 50, dur: 0.6, vol: 0.2 });
    },
    wave() {
      [392, 523, 659, 784].forEach((f, i) => tone({ type: "triangle", f, dur: 0.18, vol: 0.1, delay: i * 0.08 }));
    },
    warn() {
      for (let i = 0; i < 3; i++) {
        tone({ type: "sawtooth", f: 220, f2: 440, dur: 0.35, vol: 0.12, delay: i * 0.5 });
      }
    },
    life() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: "square", f, dur: 0.12, vol: 0.07, delay: i * 0.07 }));
    },
  };

  // -------------------------------------------------------------- sprites

  function makeSprite(w, h, draw, scale = sprScale) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.translate(w / 2, h / 2);
    draw(g);
    return { img: c, w, h };
  }

  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }

  // Mirrors the right half of a symmetric outline (listed top to bottom).
  function sym(right) {
    const pts = right.slice();
    for (let i = right.length - 1; i >= 0; i--) {
      if (right[i][0] !== 0) pts.push([-right[i][0], right[i][1]]);
    }
    return pts;
  }

  const mirrorX = (pts) => pts.map(([x, y]) => [-x, y]);

  function grad(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
    return gr;
  }

  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
  }

  const sprites = {};
  let glowCache = {};

  function glow(color) {
    let s = glowCache[color];
    if (!s) {
      s = makeSprite(32, 32, (g) => {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16);
        gr.addColorStop(0, "#ffffff");
        gr.addColorStop(0.22, color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        circle(g, 0, 0, 16);
        g.fill();
      }, 1.5);
      glowCache[color] = s;
    }
    return s;
  }

  function drawPlayerShip(g) {
    // wings
    g.shadowColor = "#38bdf8";
    g.shadowBlur = 10;
    g.fillStyle = grad(g, -30, 0, 30, 0, ["#1e3a8a", "#3b82f6", "#93c5fd", "#3b82f6", "#1e3a8a"]);
    poly(g, sym([[0, -6], [10, 0], [29, 14], [30, 21], [10, 19], [0, 19]]));
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "#bae6fd";
    g.lineWidth = 1;
    g.stroke();
    // wing tips and stripes
    g.fillStyle = "#f43f5e";
    const stripe = [[17, 10], [28, 17], [28, 20.5], [16, 15]];
    poly(g, stripe);
    g.fill();
    poly(g, mirrorX(stripe));
    g.fill();
    // engine pods
    g.fillStyle = grad(g, 0, 10, 0, 26, ["#64748b", "#1e293b"]);
    g.fillRect(-14, 12, 7, 13);
    g.fillRect(7, 12, 7, 13);
    // hull
    g.fillStyle = grad(g, -9, 0, 9, 0, ["#64748b", "#f8fafc", "#cbd5e1", "#64748b"]);
    poly(g, sym([[0, -29], [4, -20], [8, -2], [9, 15], [6, 25], [0, 23]]));
    g.fill();
    g.strokeStyle = "#0f172a";
    g.lineWidth = 0.8;
    g.stroke();
    // nose cannons
    g.fillStyle = "#94a3b8";
    g.fillRect(-7.5, -14, 2, 8);
    g.fillRect(5.5, -14, 2, 8);
    // cockpit
    g.fillStyle = grad(g, 0, -18, 0, 2, ["#e0f2fe", "#38bdf8", "#075985"]);
    g.beginPath();
    g.ellipse(0, -8, 3.6, 8.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.beginPath();
    g.ellipse(-1, -11, 1, 3, 0, 0, TAU);
    g.fill();
    // panel details
    g.strokeStyle = "rgba(15,23,42,0.5)";
    g.beginPath();
    g.moveTo(-6, 6);
    g.lineTo(6, 6);
    g.moveTo(-6, 12);
    g.lineTo(6, 12);
    g.stroke();
  }

  function makeAsteroid(r, crystal) {
    const size = r * 2 + 10;
    return makeSprite(size, size, (g) => {
      const n = randi(10, 14);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.15, 0.15);
        const rr = r * rand(0.78, 1.04);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
      const stops = crystal ? ["#8b9bb8", "#3b4256", "#141724"] : ["#c2b2a1", "#6e5f53", "#2a221d"];
      stops.forEach((c, i) => gr.addColorStop(i / 2, c));
      g.fillStyle = gr;
      poly(g, pts);
      g.fill();
      g.save();
      g.clip();
      const craters = randi(3, 6);
      for (let i = 0; i < craters; i++) {
        const cx = rand(-r * 0.6, r * 0.6);
        const cy = rand(-r * 0.6, r * 0.6);
        const cr = rand(r * 0.08, r * 0.24);
        g.fillStyle = "rgba(0,0,0,0.3)";
        circle(g, cx, cy, cr);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.16)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(cx, cy, cr, 0.1 * Math.PI, 0.9 * Math.PI);
        g.stroke();
      }
      const sh = g.createRadialGradient(r * 0.55, r * 0.55, 0, r * 0.55, r * 0.55, r * 1.3);
      sh.addColorStop(0, "rgba(0,0,0,0.5)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sh;
      g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      if (crystal) {
        g.shadowColor = "#22d3ee";
        g.shadowBlur = 8;
        for (let i = 0; i < randi(4, 6); i++) {
          const cx = rand(-r * 0.6, r * 0.6);
          const cy = rand(-r * 0.6, r * 0.6);
          const s = rand(r * 0.1, r * 0.22);
          const a = rand(0, TAU);
          g.fillStyle = pick(["#67e8f9", "#a78bfa", "#5eead4"]);
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * s * 1.6, cy + Math.sin(a) * s * 1.6);
          g.lineTo(cx + Math.cos(a + 2) * s, cy + Math.sin(a + 2) * s);
          g.lineTo(cx + Math.cos(a + Math.PI) * s * 0.6, cy + Math.sin(a + Math.PI) * s * 0.6);
          g.lineTo(cx + Math.cos(a - 2) * s, cy + Math.sin(a - 2) * s);
          g.closePath();
          g.fill();
        }
        g.shadowBlur = 0;
      }
      g.restore();
      g.strokeStyle = crystal ? "rgba(103,232,249,0.55)" : "rgba(255,236,214,0.2)";
      g.lineWidth = 1.5;
      poly(g, pts);
      g.stroke();
    });
  }

  const PICKUPS = {
    power: { color: "#f97316", label: "P", name: "POWER UP" },
    shield: { color: "#22d3ee", label: "S", name: "SHIELD" },
    rapid: { color: "#facc15", label: "R", name: "RAPID FIRE" },
    missile: { color: "#e879f9", label: "M", name: "HOMING MISSILES" },
    bomb: { color: "#ef4444", label: "B", name: "+1 BOMB" },
    magnet: { color: "#4ade80", label: "U", name: "GEM MAGNET" },
    double: { color: "#fbbf24", label: "x2", name: "DOUBLE POINTS" },
    life: { color: "#fb7185", label: "♥", name: "EXTRA LIFE" },
  };

  const GEMS = [
    { value: 10, color: "#22d3ee", light: "#cffafe" },
    { value: 25, color: "#a855f7", light: "#f3e8ff" },
    { value: 50, color: "#f59e0b", light: "#fef3c7" },
  ];

  function buildSprites() {
    glowCache = {};
    sprites.player = makeSprite(64, 64, drawPlayerShip);
    sprites.life = makeSprite(64, 64, drawPlayerShip, 0.6);

    sprites.drone = makeSprite(44, 44, (g) => {
      g.shadowColor = "#ef4444";
      g.shadowBlur = 8;
      g.fillStyle = grad(g, 0, -12, 0, 16, ["#450a0a", "#dc2626", "#fca5a5"]);
      poly(g, sym([[0, 17], [7, 6], [19, -4], [17, -11], [7, -6], [0, -13]]));
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#fecaca";
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = "#1c1917";
      poly(g, sym([[0, 8], [5, 0], [0, -8]]));
      g.fill();
      g.shadowColor = "#fde047";
      g.shadowBlur = 8;
      g.fillStyle = "#fde047";
      circle(g, 0, 0, 3);
      g.fill();
    });

    sprites.dart = makeSprite(40, 48, (g) => {
      g.shadowColor = "#a855f7";
      g.shadowBlur = 8;
      g.fillStyle = grad(g, 0, -16, 0, 22, ["#2e1065", "#7e22ce", "#e9d5ff"]);
      poly(g, sym([[0, 22], [5, 4], [16, -15], [12, -16], [4, -8], [0, -15]]));
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#e9d5ff";
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = "#f0abfc";
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(0, 14);
      g.stroke();
      g.fillStyle = "#f5d0fe";
      poly(g, sym([[0, 6], [2.5, 0], [0, -4]]));
      g.fill();
    });

    sprites.gunship = makeSprite(68, 60, (g) => {
      g.fillStyle = "#3f3f46";
      g.fillRect(-21, -2, 6, 22);
      g.fillRect(15, -2, 6, 22);
      g.fillStyle = "#a1a1aa";
      g.fillRect(-20, 16, 4, 6);
      g.fillRect(16, 16, 4, 6);
      g.shadowColor = "#22c55e";
      g.shadowBlur = 10;
      g.fillStyle = grad(g, -28, 0, 28, 0, ["#14532d", "#16a34a", "#86efac", "#16a34a", "#14532d"]);
      poly(g, sym([[0, 22], [10, 17], [13, 4], [27, 0], [29, -12], [14, -15], [10, -23], [0, -21]]));
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#bbf7d0";
      g.lineWidth = 1.2;
      g.stroke();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.beginPath();
      g.moveTo(-24, -6);
      g.lineTo(24, -6);
      g.moveTo(-10, 10);
      g.lineTo(10, 10);
      g.stroke();
      g.fillStyle = grad(g, 0, -12, 0, 8, ["#fef08a", "#ca8a04"]);
      g.beginPath();
      g.ellipse(0, 2, 5, 9, 0, 0, TAU);
      g.fill();
    });

    sprites.hunter = makeSprite(60, 56, (g) => {
      g.shadowColor = "#ec4899";
      g.shadowBlur = 12;
      g.fillStyle = grad(g, 0, -20, 0, 26, ["#1f0a1e", "#831843", "#ec4899"]);
      poly(g, sym([[0, 10], [5, 14], [9, 25], [13, 12], [25, 4], [27, 14], [29, -2], [18, -8], [22, -20], [8, -13], [0, -18]]));
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#f9a8d4";
      g.lineWidth = 1.2;
      g.stroke();
      g.strokeStyle = "rgba(249,168,212,0.5)";
      g.beginPath();
      g.moveTo(-18, -4);
      g.lineTo(-6, 2);
      g.moveTo(18, -4);
      g.lineTo(6, 2);
      g.stroke();
      g.fillStyle = "#0a0a0a";
      g.beginPath();
      g.ellipse(0, 0, 8, 5, 0, 0, TAU);
      g.fill();
    });

    sprites.spinner = makeSprite(68, 68, (g) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        g.fillStyle = "#fb923c";
        g.beginPath();
        g.moveTo(Math.cos(a - 0.3) * 19, Math.sin(a - 0.3) * 19);
        g.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
        g.lineTo(Math.cos(a + 0.3) * 19, Math.sin(a + 0.3) * 19);
        g.closePath();
        g.fill();
        g.strokeStyle = "#ffedd5";
        g.lineWidth = 1;
        g.stroke();
      }
      g.shadowColor = "#f97316";
      g.shadowBlur = 12;
      const gr = g.createRadialGradient(-5, -5, 2, 0, 0, 22);
      gr.addColorStop(0, "#fdba74");
      gr.addColorStop(0.5, "#ea580c");
      gr.addColorStop(1, "#431407");
      g.fillStyle = gr;
      const hex = [];
      for (let i = 0; i < 6; i++) hex.push([Math.cos((i / 6) * TAU + Math.PI / 6) * 21, Math.sin((i / 6) * TAU + Math.PI / 6) * 21]);
      poly(g, hex);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#fed7aa";
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "#1c1917";
      circle(g, 0, 0, 9);
      g.fill();
    });

    sprites.ufo = makeSprite(84, 52, (g) => {
      g.shadowColor = "#fbbf24";
      g.shadowBlur = 14;
      g.fillStyle = grad(g, 0, -6, 0, 16, ["#fef3c7", "#f59e0b", "#78350f"]);
      g.beginPath();
      g.ellipse(0, 6, 38, 12, 0, 0, TAU);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#fde68a";
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = grad(g, 0, -20, 0, 2, ["rgba(236,254,255,0.95)", "rgba(34,211,238,0.75)", "rgba(14,116,144,0.9)"]);
      g.beginPath();
      g.ellipse(0, -2, 16, 15, 0, Math.PI, TAU);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.beginPath();
      g.ellipse(-6, -10, 3, 5, -0.5, 0, TAU);
      g.fill();
      g.fillStyle = "#78350f";
      g.fillRect(-30, 4, 60, 2);
    });

    sprites.boss = makeSprite(244, 184, (g) => {
      g.shadowColor = "#f43f5e";
      g.shadowBlur = 16;
      g.fillStyle = grad(g, 0, -40, 0, 50, ["#52525b", "#27272a", "#18181b"]);
      poly(g, sym([[0, -32], [40, -42], [96, -22], [117, 8], [104, 30], [62, 26], [42, 52], [0, 42]]));
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#fb7185";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "#be123c";
      const accent = [[52, -26], [98, -12], [104, 2], [54, -12]];
      poly(g, accent);
      g.fill();
      poly(g, mirrorX(accent));
      g.fill();
      g.fillStyle = grad(g, -40, 0, 40, 0, ["#3f3f46", "#d4d4d8", "#a1a1aa", "#3f3f46"]);
      poly(g, sym([[0, -78], [22, -62], [35, -20], [39, 30], [25, 72], [0, 86]]));
      g.fill();
      g.strokeStyle = "#18181b";
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.beginPath();
      for (const y of [-40, -12, 40, 62]) {
        g.moveTo(-34, y);
        g.lineTo(34, y);
      }
      g.stroke();
      for (const s of [-1, 1]) {
        g.fillStyle = "#71717a";
        g.fillRect(70 * s - 3.5, 12, 7, 24);
        g.fillStyle = "#27272a";
        circle(g, 70 * s, 12, 13);
        g.fill();
        g.strokeStyle = "#fb7185";
        g.lineWidth = 2;
        g.stroke();
      }
      g.fillStyle = "#0a0a0a";
      circle(g, 0, 12, 19);
      g.fill();
      g.strokeStyle = "#fb7185";
      g.stroke();
      g.fillStyle = grad(g, 0, -60, 0, -32, ["#fef08a", "#f97316"]);
      g.beginPath();
      g.ellipse(0, -46, 8, 14, 0, 0, TAU);
      g.fill();
    });

    sprites.asteroids = { L: [], M: [], S: [] };
    const sizes = { L: 42, M: 26, S: 15 };
    for (const k in sizes) {
      for (let i = 0; i < 5; i++) sprites.asteroids[k].push({ sprite: makeAsteroid(sizes[k], false), crystal: false });
      for (let i = 0; i < 2; i++) sprites.asteroids[k].push({ sprite: makeAsteroid(sizes[k], true), crystal: true });
    }

    sprites.pickups = {};
    for (const k in PICKUPS) {
      const p = PICKUPS[k];
      sprites.pickups[k] = makeSprite(44, 44, (g) => {
        const gr = g.createRadialGradient(0, 0, 8, 0, 0, 21);
        gr.addColorStop(0, p.color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.55;
        g.fillStyle = gr;
        circle(g, 0, 0, 21);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = "#0b1020";
        circle(g, 0, 0, 13);
        g.fill();
        g.shadowColor = p.color;
        g.shadowBlur = 8;
        g.strokeStyle = p.color;
        g.lineWidth = 2.5;
        g.stroke();
        g.fillStyle = "#ffffff";
        g.font = `800 ${p.label.length > 1 ? 11 : 14}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(p.label, 0, 1);
      });
    }

    sprites.gems = GEMS.map((gem) =>
      makeSprite(20, 24, (g) => {
        g.shadowColor = gem.color;
        g.shadowBlur = 8;
        g.fillStyle = grad(g, -6, -9, 6, 9, [gem.light, gem.color, gem.color]);
        poly(g, [[0, -10], [7, -2], [0, 10], [-7, -2]]);
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = "rgba(255,255,255,0.7)";
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(-7, -2);
        g.lineTo(7, -2);
        g.moveTo(0, -10);
        g.lineTo(-2.5, -2);
        g.lineTo(0, 10);
        g.stroke();
      }),
    );

    sprites.bolt = makeSprite(14, 32, (g) => {
      g.shadowColor = "#22d3ee";
      g.shadowBlur = 8;
      g.fillStyle = "#67e8f9";
      g.beginPath();
      g.roundRect(-3, -12, 6, 24, 3);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.roundRect(-1.2, -10, 2.4, 20, 1.2);
      g.fill();
    });

    sprites.missile = makeSprite(12, 22, (g) => {
      g.fillStyle = "#e5e7eb";
      g.beginPath();
      g.roundRect(-2.5, -6, 5, 14, 2);
      g.fill();
      g.fillStyle = "#e879f9";
      poly(g, [[0, -11], [2.5, -6], [-2.5, -6]]);
      g.fill();
      poly(g, [[-2.5, 4], [-5, 9], [-2.5, 8]]);
      g.fill();
      poly(g, [[2.5, 4], [5, 9], [2.5, 8]]);
      g.fill();
    });
  }

  // ------------------------------------------------------------ background

  let nebula = null;
  let nebulaY = 0;
  let stars = [];
  let planet = null;
  let planetTimer = 0;

  function buildBackground() {
    nebula = makeSprite(W, H, (g) => {
      g.translate(-W / 2, -H / 2);
      g.fillStyle = "#03040c";
      g.fillRect(0, 0, W, H);
      const cols = ["124,58,237", "14,165,233", "236,72,153", "20,184,166", "79,70,229"];
      for (let i = 0; i < 16; i++) {
        const x = rand(0, W);
        const y = rand(0, H);
        const r = rand(120, 320);
        const c = pick(cols);
        const a = rand(0.08, 0.2);
        for (const dy of [-H, 0, H]) {
          const gr = g.createRadialGradient(x, y + dy, 0, x, y + dy, r);
          gr.addColorStop(0, `rgba(${c},${a})`);
          gr.addColorStop(0.5, `rgba(${c},${a * 0.4})`);
          gr.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = gr;
          g.fillRect(x - r, y + dy - r, r * 2, r * 2);
        }
      }
      for (let i = 0; i < 320; i++) {
        g.fillStyle = `rgba(255,255,255,${rand(0.08, 0.4)})`;
        g.fillRect(rand(0, W), rand(0, H), 1, 1);
      }
    }, 1);

    stars = [];
    const layers = [
      { n: 70, speed: 25, size: 1, alpha: 0.5 },
      { n: 45, speed: 60, size: 1.5, alpha: 0.75 },
      { n: 18, speed: 130, size: 2.2, alpha: 1 },
    ];
    for (const l of layers) {
      for (let i = 0; i < l.n; i++) {
        stars.push({
          x: rand(0, W),
          y: rand(0, H),
          speed: l.speed * rand(0.8, 1.2),
          size: l.size,
          alpha: l.alpha,
          tw: rand(0, TAU),
          color: pick(["#ffffff", "#ffffff", "#bfdbfe", "#fde68a", "#fbcfe8"]),
        });
      }
    }
    if (planet) planet.x = clamp(planet.x, 0, W);
  }

  function makePlanet() {
    const r = rand(50, 110);
    const hue = pick([[251, 146, 60], [96, 165, 250], [192, 132, 252], [52, 211, 153], [248, 113, 113]]);
    const ringed = Math.random() < 0.5;
    const tilt = rand(-0.5, 0.5);
    const c = (k, a = 1) => `rgba(${hue.map((v) => Math.round(v * k)).join(",")},${a})`;
    const sprite = makeSprite(r * 3.2, r * 3.2, (g) => {
      const atm = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.25);
      atm.addColorStop(0, c(1, 0.35));
      atm.addColorStop(1, c(1, 0));
      g.fillStyle = atm;
      circle(g, 0, 0, r * 1.25);
      g.fill();
      if (ringed) {
        g.save();
        g.rotate(tilt);
        g.strokeStyle = c(1.1, 0.35);
        g.lineWidth = r * 0.16;
        g.beginPath();
        g.ellipse(0, 0, r * 1.5, r * 0.36, 0, Math.PI, TAU);
        g.stroke();
        g.restore();
      }
      const body = g.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r);
      body.addColorStop(0, c(1.25));
      body.addColorStop(0.6, c(0.7));
      body.addColorStop(1, c(0.2));
      g.fillStyle = body;
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      circle(g, 0, 0, r);
      g.clip();
      g.rotate(tilt);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = c(rand(0.5, 1.2), 0.18);
        g.fillRect(-r, rand(-r, r), r * 2, rand(r * 0.05, r * 0.2));
      }
      g.restore();
      const shade = g.createRadialGradient(r * 0.5, r * 0.5, r * 0.2, r * 0.4, r * 0.4, r * 1.4);
      shade.addColorStop(0, "rgba(0,0,0,0.75)");
      shade.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = shade;
      circle(g, 0, 0, r);
      g.fill();
      if (ringed) {
        g.save();
        g.rotate(tilt);
        g.strokeStyle = c(1.1, 0.5);
        g.lineWidth = r * 0.16;
        g.beginPath();
        g.ellipse(0, 0, r * 1.5, r * 0.36, 0, 0, Math.PI);
        g.stroke();
        g.restore();
      }
    }, 1);
    return { x: rand(r, W - r), y: -r * 1.8, vy: rand(8, 14), sprite };
  }

  function updateBackground(dt) {
    nebulaY = (nebulaY + dt * 10) % H;
    for (const s of stars) {
      s.y += s.speed * dt;
      s.tw += dt * 3;
      if (s.y > H + 4) {
        s.y = -4;
        s.x = rand(0, W);
      }
    }
    if (planet) {
      planet.y += planet.vy * dt;
      if (planet.y - planet.sprite.h / 2 > H) {
        planet = null;
        planetTimer = rand(15, 35);
      }
    } else {
      planetTimer -= dt;
      if (planetTimer <= 0) planet = makePlanet();
    }
  }

  function drawBackground() {
    ctx.drawImage(nebula.img, 0, nebulaY, W, H);
    ctx.drawImage(nebula.img, 0, nebulaY - H, W, H);
    if (planet) {
      ctx.drawImage(planet.sprite.img, planet.x - planet.sprite.w / 2, planet.y - planet.sprite.h / 2, planet.sprite.w, planet.sprite.h);
    }
    for (const s of stars) {
      ctx.globalAlpha = s.alpha * (0.65 + 0.35 * Math.sin(s.tw));
      ctx.fillStyle = s.color;
      if (s.size > 2) {
        ctx.fillRect(s.x - 0.5, s.y - s.size * 2, 1, s.size * 4);
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      } else {
        ctx.fillRect(s.x, s.y, s.size, s.size * 1.6);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------------- state

  const ENEMY = {
    drone: { r: 15, hp: 3, score: 100, gems: 1, drop: 0.05, name: "Drone" },
    dart: { r: 14, hp: 2, score: 150, gems: 1, drop: 0.06, name: "Dart" },
    gunship: { r: 25, hp: 14, score: 300, gems: 3, drop: 0.3, name: "Gunship" },
    hunter: { r: 21, hp: 9, score: 400, gems: 3, drop: 0.2, name: "Hunter" },
    spinner: { r: 26, hp: 18, score: 500, gems: 4, drop: 0.35, name: "Spinner" },
    ufo: { r: 30, hp: 12, score: 1500, gems: 10, drop: 1, name: "Gold UFO" },
    asteroidL: { r: 38, hp: 12, score: 50, gems: 1, drop: 0.08 },
    asteroidM: { r: 23, hp: 5, score: 80, gems: 1, drop: 0.03 },
    asteroidS: { r: 13, hp: 2, score: 120, gems: 0, drop: 0.02 },
    boss: { r: 78, hp: 360, score: 10000, gems: 40, drop: 1, name: "Dreadnought" },
  };

  let mode = "title"; // title | playing | paused | dying | over
  let player;
  let bullets = [];
  let missiles = [];
  let eBullets = [];
  let enemies = [];
  let pickups = [];
  let gems = [];
  let particles = [];
  let rings = [];
  let floaters = [];
  let score = 0;
  let best = storage.get();
  let newBest = false;
  let wave = 0;
  let bossWave = false;
  let bossPending = 0;
  let bossCount = 0;
  let waveBudget = 0;
  let spawnTimer = 0;
  let ambientTimer = 0;
  let clearTimer = 0;
  let chain = 0;
  let chainTimer = 0;
  let nextLifeAt = EXTRA_LIFE_EVERY;
  let shake = 0;
  let flash = 0;
  let flashColor = "#ffffff";
  let slowmo = 0;
  let banner = null;
  let deathTimer = 0;
  let overTimer = 0;
  let time = 0;
  let stats = { kills: 0, gems: 0 };

  const startWave = (() => {
    const m = /wave=(\d+)/.exec(location.hash);
    return m ? Math.max(1, Number(m[1])) : 1;
  })();

  function newPlayer() {
    return {
      x: W / 2,
      y: H - 120,
      px: W / 2,
      bank: 0,
      lives: START_LIVES,
      bombs: START_BOMBS,
      power: 1,
      shield: 0,
      invuln: 2,
      fireCd: 0,
      missileCd: 0,
      timers: { rapid: 0, missile: 0, magnet: 0, double: 0 },
      dead: false,
    };
  }

  function startGame() {
    initAudio();
    player = newPlayer();
    bullets = [];
    missiles = [];
    eBullets = [];
    enemies = [];
    pickups = [];
    gems = [];
    particles = [];
    rings = [];
    floaters = [];
    score = 0;
    newBest = false;
    chain = 0;
    chainTimer = 0;
    nextLifeAt = EXTRA_LIFE_EVERY;
    bossCount = Math.floor((startWave - 1) / 5);
    stats = { kills: 0, gems: 0 };
    ambientTimer = 3;
    mode = "playing";
    beginWave(startWave);
  }

  function beginWave(n) {
    wave = n;
    bossWave = n % 5 === 0;
    waveBudget = bossWave ? 0 : 12 + n * 4;
    spawnTimer = 1.6;
    clearTimer = 0;
    if (bossWave) {
      bossPending = 3;
      banner = { title: "WARNING", sub: "A DREADNOUGHT IS INBOUND", t: 3, color: "#f43f5e" };
      sfx.warn();
    } else {
      banner = { title: `WAVE ${n}`, sub: waveSubtitle(n), t: 2.4, color: "#67e8f9" };
      sfx.wave();
    }
  }

  function waveSubtitle(n) {
    if (n === 1) return "CLEAR THE SECTOR";
    if (n === 2) return "DARTS AND GUNSHIPS INCOMING";
    if (n === 3) return "HUNTERS ARE STALKING YOU";
    if (n === 4) return "SPINNER TURRETS DETECTED";
    return pick(["HOLD THE LINE", "THEY KEEP COMING", "DEEPER INTO THE NEBULA", "STAY SHARP, PILOT"]);
  }

  // --------------------------------------------------------------- spawning

  function addEnemy(type, x, y, extra) {
    const d = ENEMY[type];
    const hpScale = type === "boss" ? 1 + bossCount * 0.45 : 1 + (wave - 1) * 0.1;
    const e = {
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      r: d.r,
      hp: Math.ceil(d.hp * hpScale),
      t: 0,
      flash: 0,
      rot: 0,
      fire: rand(1, 2.5),
      entered: false,
      dead: false,
      ...extra,
    };
    e.maxHp = e.hp;
    enemies.push(e);
    return e;
  }

  function spawnAsteroid(size, x, y, vx, vy, ambient) {
    const variant = pick(sprites.asteroids[size]);
    const crystal = variant.crystal;
    return addEnemy(`asteroid${size}`, x, y, {
      vx,
      vy,
      spin: rand(-1.2, 1.2),
      rot: rand(0, TAU),
      sprite: variant.sprite,
      crystal,
      size,
      ambient,
    });
  }

  const GROUPS = {
    droneV: {
      cost: 5,
      minWave: 1,
      weight: 10,
      spawn() {
        const cx = rand(130, W - 130);
        for (let i = 0; i < 5; i++) {
          const off = i - 2;
          addEnemy("drone", cx + off * 44, -30 - Math.abs(off) * 38, {
            mode: "sine",
            baseX: cx + off * 44,
            amp: 34,
            freq: 1.5,
            speed: 105 + wave * 4,
          });
        }
      },
    },
    droneSweep: {
      cost: 6,
      minWave: 1,
      weight: 8,
      spawn() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = rand(60, 220);
        for (let i = 0; i < 6; i++) {
          addEnemy("drone", dir > 0 ? -30 - i * 46 : W + 30 + i * 46, y, {
            mode: "sweep",
            vx: dir * (170 + wave * 5),
            baseY: y,
            phase: i * 0.5,
          });
        }
      },
    },
    asteroids: {
      cost: 3,
      minWave: 1,
      weight: 7,
      spawn() {
        const n = randi(2, 3);
        for (let i = 0; i < n; i++) {
          spawnAsteroid(Math.random() < 0.6 ? "L" : "M", rand(50, W - 50), -50 - i * 70, rand(-40, 40), rand(60, 110) + wave * 3);
        }
      },
    },
    darts: {
      cost: 5,
      minWave: 2,
      weight: 7,
      spawn() {
        for (let i = 0; i < 3; i++) {
          addEnemy("dart", rand(60, W - 60), -30 - i * 40, { phase: "enter", targetY: rand(70, 200), wait: 0.6 + i * 0.3 });
        }
      },
    },
    gunship: {
      cost: 6,
      minWave: 2,
      weight: 6,
      spawn() {
        addEnemy("gunship", rand(100, W - 100), -40, { targetY: rand(90, 220), vx: pick([-1, 1]) * rand(50, 90), life: 13 });
      },
    },
    hunters: {
      cost: 7,
      minWave: 3,
      weight: 6,
      spawn() {
        addEnemy("hunter", W * 0.2, -40, { ang: Math.PI / 2, life: 13 });
        addEnemy("hunter", W * 0.8, -40, { ang: Math.PI / 2, life: 13 });
      },
    },
    spinner: {
      cost: 8,
      minWave: 4,
      weight: 5,
      spawn() {
        addEnemy("spinner", rand(110, W - 110), -40, { targetY: rand(110, 250), life: 14 });
      },
    },
  };

  function spawnGroup() {
    const options = {};
    for (const k in GROUPS) {
      if (wave >= GROUPS[k].minWave) options[k] = GROUPS[k].weight;
    }
    const key = weighted(options);
    GROUPS[key].spawn();
    waveBudget -= GROUPS[key].cost;
    if (wave >= 2 && Math.random() < 0.1) spawnUfo();
  }

  function spawnUfo() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    addEnemy("ufo", dir > 0 ? -50 : W + 50, 0, { vx: dir * 120, baseY: rand(70, 160), ambient: true });
  }

  function updateSpawning(dt) {
    if (mode !== "playing" && mode !== "dying") return;
    ambientTimer -= dt;
    if (ambientTimer <= 0) {
      ambientTimer = rand(3.5, 7);
      spawnAsteroid(pick(["L", "M", "M", "S"]), rand(40, W - 40), -50, rand(-30, 30), rand(50, 90), true);
    }
    if (bossPending > 0) {
      bossPending -= dt;
      if (bossPending <= 0) {
        addEnemy("boss", W / 2, -110, { phase: "enter", atk: 2, pattern: -1, patternT: 0, cd: 0, spin: 0 });
      }
      return;
    }
    if (bossWave) {
      // light escort traffic while the boss is up
      spawnTimer -= dt;
      if (spawnTimer <= 0 && enemies.some((e) => e.type === "boss")) {
        spawnTimer = rand(6, 9);
        GROUPS[pick(["droneSweep", "asteroids"])].spawn();
      }
    } else if (waveBudget > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnGroup();
        spawnTimer = Math.max(1, 2.6 - wave * 0.12) * rand(0.8, 1.2);
      }
      return;
    }
    const remaining = enemies.some((e) => !e.ambient && !e.dead);
    if (!remaining) {
      clearTimer += dt;
      if (clearTimer > 1.2 && mode === "playing") {
        const bonus = wave * 500;
        addScore(bonus, false);
        addFloater(W / 2, H / 2 + 60, `SECTOR CLEAR +${bonus.toLocaleString()}`, "#a7f3d0", 22, 2);
        beginWave(wave + 1);
      }
    }
  }

  // ---------------------------------------------------------------- effects

  function addParticle(p) {
    if (particles.length < 1400) particles.push(p);
  }

  function explode(x, y, size, colors) {
    const n = Math.round(10 + size * 34);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(30, 90 + size * 300);
      const life = rand(0.35, 0.8 + size * 0.4);
      addParticle({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: rand(2, 4 + size * 4),
        color: pick(colors),
        drag: 2.5,
      });
    }
    for (let i = 0; i < 4 + size * 8; i++) {
      const a = rand(0, TAU);
      const s = rand(40, 160 + size * 120);
      addParticle({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.5, 1.2),
        max: 1.2,
        size: rand(1.5, 3.5),
        color: "#9ca3af",
        drag: 1,
        debris: true,
        rot: rand(0, TAU),
        spin: rand(-8, 8),
      });
    }
    addParticle({ x, y, vx: 0, vy: 0, life: 0.18, max: 0.18, size: 30 + size * 70, color: colors[0], drag: 0, flat: true });
    rings.push({ x, y, r: 4, max: 30 + size * 110, life: 0.45, total: 0.45, color: colors[0], width: 2 + size * 5 });
    shake = Math.min(18, shake + size * 7);
    sfx.boom(size);
  }

  function sparks(x, y, color, n = 4) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(60, 220);
      const life = rand(0.15, 0.35);
      addParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: rand(1.5, 3), color, drag: 4 });
    }
  }

  function addFloater(x, y, text, color, size = 16, life = 1) {
    floaters.push({ x, y, text, color, size, life, max: life });
  }

  function addScore(points, combo = true) {
    let mult = combo ? comboMult() : 1;
    if (player && player.timers.double > 0) mult *= 2;
    const gained = Math.round(points * mult);
    score += gained;
    if (player) {
      while (score >= nextLifeAt) {
        nextLifeAt += EXTRA_LIFE_EVERY;
        player.lives = Math.min(9, player.lives + 1);
        addFloater(player.x, player.y - 40, "EXTRA LIFE!", "#fb7185", 20, 1.6);
        sfx.life();
      }
    }
    return gained;
  }

  const comboMult = () => Math.min(10, 1 + Math.floor(chain / 6));

  // -------------------------------------------------------------- shooting

  function enemyBulletSpeed(base) {
    return base * Math.min(1.6, 1 + (wave - 1) * 0.035);
  }

  function shootAngle(x, y, a, speed, color, r = 5) {
    eBullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, color, t: 0 });
  }

  function shootAt(x, y, speed, color, r = 5, spread = 0) {
    const a = Math.atan2(player.y - y, player.x - x) + spread;
    shootAngle(x, y, a, speed, color, r);
  }

  function canShoot(e) {
    return mode === "playing" && !player.dead && e.y > 10 && e.y < H - 140;
  }

  function firePlayer() {
    const p = player;
    const add = (dx, ang, dmg = 1) => {
      bullets.push({ x: p.x + dx, y: p.y - 24, vx: Math.sin(ang) * 950, vy: -Math.cos(ang) * 950, ang, dmg });
    };
    switch (p.power) {
      case 1:
        add(-6.5, 0);
        add(6.5, 0);
        break;
      case 2:
        add(-7, 0);
        add(0, 0);
        add(7, 0);
        break;
      case 3:
        add(-6, 0);
        add(6, 0);
        add(-13, -0.11);
        add(13, 0.11);
        break;
      case 4:
        add(-7, 0);
        add(0, 0, 1.5);
        add(7, 0);
        add(-14, -0.13);
        add(14, 0.13);
        break;
      default:
        add(-7, 0, 1.3);
        add(0, 0, 1.6);
        add(7, 0, 1.3);
        add(-14, -0.12);
        add(14, 0.12);
        add(-20, -0.27);
        add(20, 0.27);
    }
    sfx.shoot();
  }

  function fireMissiles() {
    for (const s of [-1, 1]) {
      missiles.push({ x: player.x + s * 18, y: player.y, vx: s * 220, vy: -120, ang: -Math.PI / 2, life: 3, target: null });
    }
    sfx.missile();
  }

  function useBomb() {
    if (mode !== "playing" || player.dead || player.bombs <= 0) return;
    player.bombs--;
    flash = 0.7;
    flashColor = "#fde68a";
    shake = 22;
    rings.push({ x: player.x, y: player.y, r: 10, max: Math.max(W, H) * 1.1, life: 0.8, total: 0.8, color: "#fde68a", width: 18 });
    rings.push({ x: player.x, y: player.y, r: 10, max: Math.max(W, H) * 0.7, life: 0.6, total: 0.6, color: "#f97316", width: 10 });
    for (const b of eBullets) sparks(b.x, b.y, b.color, 2);
    eBullets = [];
    for (const e of enemies) {
      if (e.dead || e.y < -40) continue;
      damageEnemy(e, e.type === "boss" ? 45 : 30);
    }
    player.invuln = Math.max(player.invuln, 1);
    sfx.bomb();
  }

  // ----------------------------------------------------------------- damage

  function damageEnemy(e, dmg) {
    if (e.dead) return;
    if (e.type === "boss" && e.phase === "enter") dmg *= 0.25;
    e.hp -= dmg;
    e.flash = 0.12;
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    const d = ENEMY[e.type];
    stats.kills++;
    chain++;
    chainTimer = 2.5;
    let points = d.score;
    if (e.crystal) points *= 3;
    if (e.type === "boss") points *= bossCount + 1;
    const gained = addScore(points);
    const mult = comboMult();
    const label = mult > 1 ? `+${gained} x${mult}` : `+${gained}`;
    addFloater(e.x, e.y, label, e.type === "ufo" ? "#fde047" : "#ffffff", e.type === "boss" ? 30 : e.type === "ufo" ? 20 : 14, e.type === "boss" ? 2.2 : 0.9);

    if (e.type.startsWith("asteroid")) {
      const size = e.size === "L" ? 0.5 : e.size === "M" ? 0.3 : 0.15;
      explode(e.x, e.y, size, e.crystal ? ["#67e8f9", "#a78bfa", "#e0f2fe"] : ["#fdba74", "#d6d3d1", "#fef3c7"]);
      if (e.size !== "S") {
        const next = e.size === "L" ? "M" : "S";
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU);
          const child = spawnAsteroid(next, e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, e.vx + Math.cos(a) * 90, Math.max(40, e.vy + Math.sin(a) * 60), e.ambient);
          child.entered = true;
        }
      }
    } else if (e.type === "boss") {
      bossKilled(e);
    } else {
      const palette = {
        drone: ["#f87171", "#fde047", "#ffffff"],
        dart: ["#c084fc", "#f5d0fe", "#ffffff"],
        gunship: ["#4ade80", "#fde047", "#ffffff"],
        hunter: ["#f472b6", "#fb7185", "#ffffff"],
        spinner: ["#fb923c", "#fde047", "#ffffff"],
        ufo: ["#fde047", "#fbbf24", "#ffffff", "#67e8f9"],
      }[e.type];
      explode(e.x, e.y, e.type === "drone" || e.type === "dart" ? 0.35 : 0.7, palette);
    }

    const gemCount = d.gems + (e.crystal ? 5 : 0);
    for (let i = 0; i < gemCount; i++) dropGem(e.x, e.y, e.type === "boss" || e.type === "ufo");
    const drops = e.type === "ufo" ? 2 : e.type === "boss" ? 3 : Math.random() < d.drop * (e.crystal ? 2 : 1) ? 1 : 0;
    for (let i = 0; i < drops; i++) dropPickup(e.x + rand(-20, 20), e.y + rand(-20, 20));
  }

  function bossKilled(e) {
    bossCount++;
    slowmo = 1.2;
    flash = 1;
    flashColor = "#ffffff";
    explode(e.x, e.y, 1.5, ["#f43f5e", "#fde047", "#ffffff", "#fb923c"]);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        if (mode === "title") return;
        explode(e.x + rand(-100, 100), e.y + rand(-60, 60), rand(0.6, 1), ["#f43f5e", "#fde047", "#fb923c", "#ffffff"]);
      }, 120 + i * 140);
    }
    eBullets = [];
    banner = { title: "DREADNOUGHT DESTROYED", sub: "", t: 2.6, color: "#fde047" };
  }

  function dropGem(x, y, rich) {
    const tier = rich ? weighted({ 0: 3, 1: 3, 2: 2 }) : weighted({ 0: 8, 1: 3, 2: 1 });
    const a = rand(0, TAU);
    const s = rand(40, 170);
    gems.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, tier: Number(tier), t: rand(0, TAU), life: 12 });
  }

  function dropPickup(x, y) {
    const weights = { power: 24, shield: 14, rapid: 16, missile: 14, bomb: 10, magnet: 10, double: 10, life: 3 };
    if (player.power < 3) weights.power += 16;
    if (player.power >= 5) weights.power = 4;
    if (player.bombs >= MAX_BOMBS) weights.bomb = 2;
    pickups.push({ x: clamp(x, 30, W - 30), y, type: weighted(weights), t: 0, vy: 70 });
  }

  function collectPickup(k) {
    const p = player;
    const info = PICKUPS[k];
    switch (k) {
      case "power":
        if (p.power >= 5) addScore(2000, false);
        p.power = Math.min(5, p.power + 1);
        break;
      case "shield":
        p.shield = 3;
        break;
      case "bomb":
        p.bombs = Math.min(MAX_BOMBS, p.bombs + 1);
        break;
      case "life":
        p.lives = Math.min(9, p.lives + 1);
        break;
      case "rapid":
        p.timers.rapid = 10;
        break;
      case "missile":
        p.timers.missile = 12;
        break;
      case "magnet":
        p.timers.magnet = 12;
        break;
      case "double":
        p.timers.double = 12;
        break;
    }
    addFloater(p.x, p.y - 44, info.name + (k === "power" ? ` ${p.power === 5 ? "MAX" : "LV " + p.power}` : ""), info.color, 17, 1.3);
    rings.push({ x: p.x, y: p.y, r: 10, max: 70, life: 0.35, total: 0.35, color: info.color, width: 4 });
    sfx.pickup();
  }

  function hurtPlayer() {
    const p = player;
    if (p.dead || p.invuln > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 0.8;
      rings.push({ x: p.x, y: p.y, r: 20, max: 90, life: 0.35, total: 0.35, color: "#22d3ee", width: 5 });
      shake = Math.min(18, shake + 5);
      sfx.hit();
      return;
    }
    p.lives--;
    chain = 0;
    explode(p.x, p.y, 1, ["#38bdf8", "#e0f2fe", "#f43f5e", "#ffffff"]);
    sfx.hurt();
    flash = 0.5;
    flashColor = "#f43f5e";
    for (const b of eBullets) {
      if (dist2(b.x, b.y, p.x, p.y) < 200 * 200) b.dead = true;
    }
    if (p.lives <= 0) {
      p.dead = true;
      mode = "dying";
      deathTimer = 2.2;
      return;
    }
    p.power = Math.max(1, p.power - 1);
    p.invuln = 2.5;
    p.bombs = Math.max(p.bombs, START_BOMBS);
    p.x = W / 2;
    p.y = H - 120;
    pointer.dragging = false;
  }

  // ----------------------------------------------------------------- update

  function updatePlayer(dt) {
    const p = player;
    if (p.dead) return;
    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (mx || my) {
      controlMode = "keys";
      const len = Math.hypot(mx, my);
      p.x += (mx / len) * PLAYER_SPEED * dt;
      p.y += (my / len) * PLAYER_SPEED * dt;
    } else if (controlMode === "mouse" && pointer.has) {
      const k = 1 - Math.exp(-16 * dt);
      p.x += (pointer.x - p.x) * k;
      p.y += (pointer.y - p.y) * k;
    }
    p.x = clamp(p.x, 20, W - 20);
    p.y = clamp(p.y, 40, H - 30);
    const vx = (p.x - p.px) / Math.max(dt, 0.001);
    p.px = p.x;
    p.bank += (clamp(vx / 1400, -0.3, 0.3) - p.bank) * Math.min(1, dt * 10);

    p.invuln = Math.max(0, p.invuln - dt);
    for (const k in p.timers) p.timers[k] = Math.max(0, p.timers[k] - dt);

    p.fireCd -= dt;
    if (p.fireCd <= 0) {
      firePlayer();
      p.fireCd = p.timers.rapid > 0 ? 0.065 : 0.13;
    }
    if (p.timers.missile > 0) {
      p.missileCd -= dt;
      if (p.missileCd <= 0) {
        fireMissiles();
        p.missileCd = 0.5;
      }
    }

    for (const dx of [-10.5, 0, 10.5]) {
      if (Math.random() < 0.6) {
        const life = rand(0.15, 0.3);
        addParticle({
          x: p.x + dx + rand(-1.5, 1.5),
          y: p.y + 26,
          vx: rand(-15, 15),
          vy: rand(160, 260),
          life,
          max: life,
          size: dx === 0 ? 3.2 : 2.4,
          color: Math.random() < 0.5 ? "#38bdf8" : "#a78bfa",
          drag: 1,
        });
      }
    }
  }

  function nearestEnemy(x, y) {
    let bestE = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (e.dead || e.y < 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        bestE = e;
      }
    }
    return bestE;
  }

  function updateBullets(dt) {
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.x < -30 || b.x > W + 30) {
        b.dead = true;
        continue;
      }
      for (const e of enemies) {
        if (e.dead) continue;
        const rr = e.r + 4;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.dead = true;
          damageEnemy(e, b.dmg);
          sparks(b.x, b.y, "#a5f3fc", 2);
          sfx.hit();
          break;
        }
      }
    }
    bullets = bullets.filter((b) => !b.dead);

    for (const m of missiles) {
      m.life -= dt;
      if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y);
      const speed = Math.min(720, Math.hypot(m.vx, m.vy) + 900 * dt);
      let ang = Math.atan2(m.vy, m.vx);
      if (m.target) {
        const want = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        let diff = want - ang;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        ang += clamp(diff, -6 * dt, 6 * dt);
      } else {
        ang += clamp(-Math.PI / 2 - ang, -3 * dt, 3 * dt);
      }
      m.vx = Math.cos(ang) * speed;
      m.vy = Math.sin(ang) * speed;
      m.ang = ang;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (Math.random() < 0.8) {
        addParticle({ x: m.x - m.vx * 0.015, y: m.y - m.vy * 0.015, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.35, max: 0.35, size: 2.6, color: "#f0abfc", drag: 1 });
      }
      if (m.life <= 0 || m.y < -40 || m.y > H + 40 || m.x < -40 || m.x > W + 40) {
        m.dead = true;
        continue;
      }
      for (const e of enemies) {
        if (e.dead) continue;
        const rr = e.r + 5;
        if (dist2(m.x, m.y, e.x, e.y) < rr * rr) {
          m.dead = true;
          damageEnemy(e, 3);
          sparks(m.x, m.y, "#f0abfc", 6);
          break;
        }
      }
    }
    missiles = missiles.filter((m) => !m.dead);

    for (const b of eBullets) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) b.dead = true;
      else if (!player.dead && player.invuln <= 0) {
        const rr = b.r * 0.8 + (player.shield > 0 ? 18 : PLAYER_HITBOX);
        if (dist2(b.x, b.y, player.x, player.y) < rr * rr) {
          b.dead = true;
          hurtPlayer();
        }
      }
    }
    eBullets = eBullets.filter((b) => !b.dead);
  }

  function updateEnemy(e, dt) {
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.fire -= dt;
    const bs = enemyBulletSpeed(1);
    switch (e.type) {
      case "drone":
        if (e.mode === "sine") {
          e.y += e.speed * dt;
          e.x = e.baseX + Math.sin(e.t * e.freq) * e.amp;
        } else {
          e.x += e.vx * dt;
          e.y = e.baseY + Math.sin(e.t * 2 + e.phase) * 30 + e.t * 18;
        }
        if (wave >= 3 && e.fire <= 0) {
          e.fire = rand(2.5, 4.5);
          if (canShoot(e)) shootAt(e.x, e.y + 10, 190 * bs, "#fb7185", 5);
        }
        break;
      case "dart":
        if (e.phase === "enter") {
          e.y += (e.targetY - e.y) * Math.min(1, dt * 3) + 30 * dt;
          if (e.y >= e.targetY - 4) e.phase = "aim";
        } else if (e.phase === "aim") {
          e.wait -= dt;
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          e.rot = a - Math.PI / 2;
          if (e.wait <= 0) {
            e.phase = "dive";
            const s = 470 + wave * 10;
            e.vx = Math.cos(a) * s;
            e.vy = Math.sin(a) * s;
          }
        } else {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (Math.random() < 0.9) {
            addParticle({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 3, color: "#c084fc", drag: 0 });
          }
        }
        break;
      case "gunship":
        if (e.life > 0) {
          e.life -= dt;
          e.y += (e.targetY - e.y) * Math.min(1, dt * 1.5);
          e.x += e.vx * dt;
          if (e.x < 60 || e.x > W - 60) e.vx = -e.vx;
          e.x = clamp(e.x, 60, W - 60);
        } else {
          e.y += 90 * dt;
        }
        if (e.fire <= 0) {
          e.fire = 2.2;
          if (canShoot(e)) {
            for (const s of [-18, 18]) {
              for (const spread of [-0.14, 0, 0.14]) shootAt(e.x + s, e.y + 22, 230 * bs, "#facc15", 5, spread);
            }
          }
        }
        break;
      case "hunter": {
        const leaving = e.t > e.life;
        const want = leaving ? Math.PI / 2 : Math.atan2(player.y - e.y, player.x - e.x);
        let diff = want - e.ang;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        e.ang += clamp(diff, -2.2 * dt, 2.2 * dt);
        const speed = (leaving ? 220 : 150) + wave * 5;
        e.x += Math.cos(e.ang) * speed * dt;
        e.y += Math.sin(e.ang) * speed * dt;
        e.rot = e.ang - Math.PI / 2;
        if (e.fire <= 0) {
          e.fire = rand(2.5, 3.5);
          if (canShoot(e) && !leaving) shootAt(e.x, e.y, 210 * bs, "#f472b6", 6);
        }
        break;
      }
      case "spinner":
        e.rot += dt * 1.6;
        if (e.t < e.life) e.y += (e.targetY - e.y) * Math.min(1, dt * 1.2);
        else e.y += 80 * dt;
        if (e.fire <= 0) {
          e.fire = 2.4;
          if (canShoot(e)) {
            const n = 8 + Math.min(8, wave);
            for (let i = 0; i < n; i++) shootAngle(e.x, e.y, e.rot + (i / n) * TAU, 150 * bs, "#fb923c", 5);
          }
        }
        break;
      case "ufo":
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 2.4) * 18;
        if (Math.random() < 0.5) {
          addParticle({ x: e.x + rand(-30, 30), y: e.y + 12, vx: 0, vy: 60, life: 0.4, max: 0.4, size: 2.5, color: pick(["#fde047", "#67e8f9", "#f472b6"]), drag: 0 });
        }
        break;
      case "boss":
        updateBoss(e, dt);
        break;
      default:
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.spin * dt;
    }

    if (!e.entered && e.y > 0 && e.x > 0 && e.x < W) e.entered = true;
    const off = e.y > H + 90 || e.x < -140 || e.x > W + 140 || e.y < -260;
    if ((e.entered && off) || e.t > 40) e.gone = true;

    if (!player.dead && player.invuln <= 0 && e.type !== "ufo") {
      const rr = e.r * 0.8 + (player.shield > 0 ? 18 : 10);
      if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
        hurtPlayer();
        if (e.type !== "boss") damageEnemy(e, 20);
      }
    }
  }

  function updateBoss(e, dt) {
    const enraged = e.hp < e.maxHp / 2;
    if (e.phase === "enter") {
      e.y += 55 * dt;
      if (e.y >= 160) e.phase = "fight";
      return;
    }
    e.x = W / 2 + Math.sin(e.t * 0.45) * (W / 2 - 150);
    e.y = 160 + Math.sin(e.t * 0.9) * 22;
    e.atk -= dt;
    e.patternT += dt;
    e.cd -= dt;
    if (e.atk <= 0) {
      e.pattern = (e.pattern + 1) % 3;
      e.atk = enraged ? 3.4 : 4.4;
      e.patternT = 0;
      e.cd = 0;
    }
    if (!canShoot(e)) return;
    const bs = enemyBulletSpeed(1);
    const turrets = [
      [e.x - 70, e.y + 34],
      [e.x + 70, e.y + 34],
    ];
    if (e.pattern === 0 && e.patternT < 2.2 && e.cd <= 0) {
      e.cd = enraged ? 0.45 : 0.65;
      const n = enraged ? 9 : 7;
      for (const [tx, ty] of turrets) {
        for (let i = 0; i < n; i++) shootAt(tx, ty, 220 * bs, "#f43f5e", 6, (i - (n - 1) / 2) * 0.12);
      }
    } else if (e.pattern === 1 && e.patternT < 2.8 && e.cd <= 0) {
      e.cd = enraged ? 0.06 : 0.085;
      e.spin += 0.33;
      const arms = enraged ? 3 : 2;
      for (let i = 0; i < arms; i++) shootAngle(e.x, e.y + 12, e.spin + (i / arms) * TAU, 170 * bs, "#a78bfa", 5);
    } else if (e.pattern === 2 && e.cd <= 0 && e.patternT < 2) {
      e.cd = 1;
      for (const [tx, ty] of turrets) {
        addEnemy(enraged ? "hunter" : "dart", tx, ty, enraged ? { ang: Math.PI / 2, life: 9, entered: true } : { phase: "aim", wait: 0.5, entered: true });
      }
      for (let i = -1; i <= 1; i++) shootAt(e.x, e.y + 60, 260 * bs, "#fb7185", 8, i * 0.08);
    }
  }

  function updateLoot(dt) {
    const p = player;
    const magnet = !p.dead && p.timers.magnet > 0;
    for (const g of gems) {
      g.t += dt * 4;
      g.life -= dt;
      const d2 = p.dead ? Infinity : dist2(g.x, g.y, p.x, p.y);
      const pullR = magnet ? 520 : 95;
      if (d2 < pullR * pullR) {
        const d = Math.sqrt(d2) || 1;
        const pull = magnet ? 1300 : 900;
        g.vx += ((p.x - g.x) / d) * pull * dt;
        g.vy += ((p.y - g.y) / d) * pull * dt;
        g.vx *= 1 - Math.min(1, dt * 3);
        g.vy *= 1 - Math.min(1, dt * 3);
      } else {
        g.vx *= 1 - Math.min(1, dt * 2);
        g.vy += (70 - g.vy) * Math.min(1, dt * 2);
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d2 < 24 * 24) {
        g.dead = true;
        stats.gems++;
        const v = GEMS[g.tier].value;
        addScore(v, false);
        sfx.gem();
        sparks(g.x, g.y, GEMS[g.tier].color, 3);
      } else if (g.y > H + 20 || g.life <= 0) g.dead = true;
    }
    gems = gems.filter((g) => !g.dead);

    for (const k of pickups) {
      k.t += dt;
      k.y += k.vy * dt;
      k.x += Math.sin(k.t * 2) * 30 * dt;
      if (!p.dead && dist2(k.x, k.y, p.x, p.y) < 30 * 30) {
        k.dead = true;
        collectPickup(k.type);
      } else if (k.y > H + 30) k.dead = true;
    }
    pickups = pickups.filter((k) => !k.dead);
  }

  function updateEffects(dt) {
    for (const p of particles) {
      p.life -= dt;
      const drag = 1 - Math.min(1, p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const r of rings) {
      r.life -= dt;
      const k = 1 - r.life / r.total;
      r.r = r.max * (1 - Math.pow(1 - k, 3));
    }
    rings = rings.filter((r) => r.life > 0);
    for (const f of floaters) {
      f.life -= dt;
      f.y -= 40 * dt;
    }
    floaters = floaters.filter((f) => f.life > 0);
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt * 1.8);
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
  }

  function update(rawDt) {
    time += rawDt;
    if (slowmo > 0) slowmo -= rawDt;
    const dt = slowmo > 0 ? rawDt * 0.35 : rawDt;
    updateBackground(dt);
    if (mode === "title" || mode === "paused") return;
    if (mode === "over") {
      overTimer += rawDt;
      updateEffects(dt);
      return;
    }

    updatePlayer(dt);
    updateSpawning(dt);
    for (const e of enemies) updateEnemy(e, dt);
    updateBullets(dt);
    updateLoot(dt);
    enemies = enemies.filter((e) => !e.dead && !e.gone);
    if (chainTimer > 0) {
      chainTimer -= dt;
      if (chainTimer <= 0) chain = 0;
    }
    updateEffects(dt);

    if (mode === "dying") {
      deathTimer -= rawDt;
      if (deathTimer <= 0) {
        mode = "over";
        overTimer = 0;
        if (score > best) {
          best = score;
          newBest = true;
          storage.set(best);
        }
      }
    }
  }

  // ----------------------------------------------------------------- render

  function drawImg(s, x, y, w = s.w, h = s.h) {
    ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
  }

  function drawRotated(s, x, y, rot, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(s.img, (-s.w * scale) / 2, (-s.h * scale) / 2, s.w * scale, s.h * scale);
    ctx.restore();
  }

  function spriteFor(e) {
    return e.sprite || sprites[e.type];
  }

  function drawEnemy(e) {
    const s = spriteFor(e);
    if (e.type === "boss") {
      drawImg(s, e.x, e.y);
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.7 + 0.3 * Math.sin(time * 8);
      const enraged = e.hp < e.maxHp / 2;
      drawImg(glow(enraged ? "#f43f5e" : "#fb7185"), e.x, e.y + 12, 70 * pulse, 70 * pulse);
      for (const sx of [-70, 70]) drawImg(glow("#fb7185"), e.x + sx, e.y + 12, 26, 26);
      for (const sx of [-24, 0, 24]) drawImg(glow("#fb923c"), e.x + sx, e.y - 80, 22, 34 + Math.random() * 8);
      ctx.globalCompositeOperation = "source-over";
    } else if (e.rot) {
      drawRotated(s, e.x, e.y, e.rot);
    } else {
      drawImg(s, e.x, e.y);
    }
    if (e.type === "hunter") {
      ctx.globalCompositeOperation = "lighter";
      const eye = 16 + Math.sin(time * 10) * 4;
      drawImg(glow("#ef4444"), e.x, e.y, eye, eye * 0.7);
      ctx.globalCompositeOperation = "source-over";
    } else if (e.type === "spinner") {
      ctx.globalCompositeOperation = "lighter";
      drawImg(glow("#fde047"), e.x, e.y, 22, 22);
      ctx.globalCompositeOperation = "source-over";
    } else if (e.type === "dart" && e.phase === "aim") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30);
      drawImg(glow("#f0abfc"), e.x, e.y, 34, 34);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else if (e.type === "ufo") {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const lx = e.x - 28 + i * 11.2;
        const on = (Math.floor(time * 8) + i) % 3 === 0;
        drawImg(glow(on ? "#fde047" : "#67e8f9"), lx, e.y + 8, on ? 12 : 7, on ? 12 : 7);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    if (e.flash > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, e.flash * 8) * 0.7;
      if (e.rot && e.type !== "boss") drawRotated(s, e.x, e.y, e.rot);
      else drawImg(s, e.x, e.y);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    if (e.type !== "boss" && e.maxHp >= 10 && e.hp < e.maxHp && !e.type.startsWith("asteroid")) {
      const w = e.r * 1.6;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, (w * e.hp) / e.maxHp, 4);
    }
  }

  function drawPlayer() {
    const p = player;
    if (p.dead) return;
    if (p.invuln > 0 && p.shield <= 0 && Math.floor(time * 20) % 2 === 0) return;
    ctx.globalCompositeOperation = "lighter";
    const flick = rand(0.85, 1.15);
    for (const dx of [-10.5, 10.5]) drawImg(glow("#38bdf8"), p.x + dx, p.y + 30, 12, 26 * flick);
    drawImg(glow("#a78bfa"), p.x, p.y + 32, 14, 30 * flick);
    ctx.globalCompositeOperation = "source-over";
    drawRotated(sprites.player, p.x, p.y, p.bank);
    if (p.shield > 0) {
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.6 + 0.4 * Math.sin(time * 6);
      const gr = ctx.createRadialGradient(p.x, p.y, 20, p.x, p.y, 40);
      gr.addColorStop(0, "rgba(34,211,238,0)");
      gr.addColorStop(0.8, `rgba(34,211,238,${0.12 * pulse})`);
      gr.addColorStop(1, `rgba(34,211,238,${0.35 * pulse})`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 40, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(165,243,252,${0.5 + 0.3 * pulse})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < p.shield; i++) {
        const a = time * 2 + (i / 3) * TAU;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 40, a, a + 1.4);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawWorld() {
    for (const g of gems) {
      const s = sprites.gems[g.tier];
      const blink = g.life < 3 && Math.floor(time * 10) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(Math.cos(g.t) * 0.4 + 0.8, 1);
      ctx.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }

    for (const k of pickups) {
      const c = PICKUPS[k.type].color;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 19 + Math.sin(k.t * 5) * 2, k.t * 3, k.t * 3 + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(k.x, k.y, 19 + Math.sin(k.t * 5) * 2, k.t * 3 + Math.PI, k.t * 3 + Math.PI + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      drawImg(sprites.pickups[k.type], k.x, k.y);
    }

    for (const e of enemies) if (e.type === "boss") drawEnemy(e);
    for (const e of enemies) if (e.type !== "boss") drawEnemy(e);

    for (const m of missiles) drawRotated(sprites.missile, m.x, m.y, m.ang + Math.PI / 2);

    ctx.globalCompositeOperation = "lighter";
    for (const b of bullets) {
      if (b.ang) drawRotated(sprites.bolt, b.x, b.y, b.ang, b.dmg > 1 ? 1.25 : 1);
      else drawImg(sprites.bolt, b.x, b.y, sprites.bolt.w * (b.dmg > 1 ? 1.25 : 1), sprites.bolt.h * (b.dmg > 1 ? 1.15 : 1));
    }
    ctx.globalCompositeOperation = "source-over";

    drawPlayer();

    ctx.globalCompositeOperation = "lighter";
    for (const b of eBullets) {
      const s = b.r * 4.6 * (1 + Math.sin(b.t * 18) * 0.08);
      drawImg(glow(b.color), b.x, b.y, s, s);
    }
    for (const p of particles) {
      const k = p.life / p.max;
      if (p.debris) continue;
      if (p.flat) {
        ctx.globalAlpha = k;
        drawImg(glow(p.color), p.x, p.y, p.size * 2, p.size * 2);
        continue;
      }
      ctx.globalAlpha = Math.min(1, k * 1.5);
      const s = p.size * (0.4 + k * 0.8) * 2.4;
      drawImg(glow(p.color), p.x, p.y, s, s);
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      ctx.globalAlpha = r.life / r.total;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (r.life / r.total) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (const p of particles) {
      if (!p.debris) continue;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      text(f.text, f.x, f.y, f.size, f.color, "center", 800, 8);
    }
    ctx.globalAlpha = 1;
  }

  function text(str, x, y, size, color, align = "left", weight = 700, glowBlur = 0) {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    if (glowBlur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glowBlur;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  const bombBtn = () => ({ x: W - 60, y: H - 66, r: 38 });
  const pauseBtn = () => ({ x: W - 30, y: 76, r: 22 });

  function drawHud() {
    const p = player;
    const grd = ctx.createLinearGradient(0, 0, 0, 70);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, 70);

    text(score.toLocaleString(), 18, 26, 28, "#f8fafc", "left", 800, 10);
    text(`BEST ${Math.max(best, score).toLocaleString()}`, W - 16, 22, 13, "#94a3b8", "right", 700);
    text(bossWave ? `WAVE ${wave} • BOSS` : `WAVE ${wave}`, W - 16, 42, 15, bossWave ? "#fb7185" : "#67e8f9", "right", 800);

    const mult = comboMult();
    if (chain > 1) {
      const x = 18;
      text(`${chain} CHAIN`, x, 54, 12, "#cbd5e1", "left", 700);
      if (mult > 1) text(`x${mult}`, x + 78, 54, 16, "#fde047", "left", 900, 10);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x, 64, 110, 3);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(x, 64, 110 * clamp(chainTimer / 2.5, 0, 1), 3);
    }

    // lives, bombs and weapon level along the bottom
    for (let i = 0; i < Math.min(p.lives, 6); i++) drawImg(sprites.life, 30 + i * 30, H - 26, 38, 38);
    if (p.lives > 6) text(`x${p.lives}`, 30 + 6 * 30, H - 26, 14, "#e2e8f0", "left", 800);
    for (let i = 0; i < p.bombs; i++) {
      const bx = 20 + i * 24;
      const by = H - 58;
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2;
      ctx.stroke();
      text("B", bx, by + 1, 10, "#fecaca", "center", 900);
    }
    text("PWR", 18, H - 84, 11, "#fdba74", "left", 800);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < p.power ? "#f97316" : "rgba(255,255,255,0.15)";
      ctx.fillRect(48 + i * 13, H - 89, 10, 10);
    }

    // active boosters
    let y = 92;
    for (const k of ["rapid", "missile", "magnet", "double"]) {
      const t = p.timers[k];
      if (t <= 0) continue;
      const info = PICKUPS[k];
      drawImg(sprites.pickups[k], 26, y, 30, 30);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(44, y - 2, 60, 4);
      ctx.fillStyle = info.color;
      ctx.fillRect(44, y - 2, 60 * Math.min(1, t / 12), 4);
      y += 32;
    }

    const boss = enemies.find((e) => e.type === "boss");
    if (boss) {
      const w = Math.min(W - 120, 460);
      const x = (W - w) / 2;
      text("DREADNOUGHT", W / 2, 76, 12, "#fecdd3", "center", 800, 6);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - 2, 86, w + 4, 10);
      const gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, "#f43f5e");
      gr.addColorStop(1, "#fb923c");
      ctx.fillStyle = gr;
      ctx.fillRect(x, 88, (w * Math.max(0, boss.hp)) / boss.maxHp, 6);
    }

    if (usingTouch) {
      const b = bombBtn();
      ctx.globalAlpha = p.bombs > 0 ? 0.85 : 0.35;
      ctx.fillStyle = "rgba(127,29,29,0.55)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      text("BOMB", b.x, b.y - 6, 13, "#fecaca", "center", 900);
      text(String(p.bombs), b.x, b.y + 12, 15, "#ffffff", "center", 900);
      ctx.globalAlpha = 1;
      const pb = pauseBtn();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, 16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(pb.x - 6, pb.y - 7, 4, 14);
      ctx.fillRect(pb.x + 2, pb.y - 7, 4, 14);
    }

    if (banner) {
      const k = banner.t;
      const a = Math.min(1, k * 2, (3 - Math.min(3, k)) * 4 + 0.2);
      ctx.globalAlpha = clamp(a, 0, 1);
      const pulse = banner.color === "#f43f5e" ? 0.6 + 0.4 * Math.sin(time * 12) : 1;
      ctx.globalAlpha *= pulse;
      text(banner.title, W / 2, H * 0.36, Math.min(54, W / 11), banner.color, "center", 900, 22);
      ctx.globalAlpha = clamp(a, 0, 1);
      if (banner.sub) text(banner.sub, W / 2, H * 0.36 + 42, 15, "#e2e8f0", "center", 700);
      ctx.globalAlpha = 1;
    }
  }

  function drawLogo(y) {
    const size = Math.min(64, W / 8.5);
    ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const gr = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
    gr.addColorStop(0, "#67e8f9");
    gr.addColorStop(0.5, "#a78bfa");
    gr.addColorStop(1, "#f472b6");
    ctx.shadowColor = "#8b5cf6";
    ctx.shadowBlur = 30;
    ctx.fillStyle = gr;
    ctx.fillText("NEBULA", W / 2, y);
    ctx.fillText("STRIKE", W / 2, y + size * 0.95);
    ctx.shadowBlur = 0;
  }

  function drawTitle() {
    drawLogo(120);
    const bob = Math.sin(time * 2) * 6;
    ctx.globalCompositeOperation = "lighter";
    for (const dx of [-10.5, 10.5]) drawImg(glow("#38bdf8"), W / 2 + dx, 300 + bob + 30, 12, 26 * rand(0.85, 1.15));
    drawImg(glow("#a78bfa"), W / 2, 300 + bob + 32, 14, 30 * rand(0.85, 1.15));
    ctx.globalCompositeOperation = "source-over";
    drawImg(sprites.player, W / 2, 300 + bob, 80, 80);

    const roster = [
      ["drone", "Drone", "100"],
      ["dart", "Dart", "150"],
      ["gunship", "Gunship", "300"],
      ["hunter", "Hunter", "400"],
      ["spinner", "Spinner", "500"],
      ["ufo", "Gold UFO", "1,500"],
    ];
    const cols = 3;
    const cellW = Math.min(170, (W - 40) / cols);
    const startX = W / 2 - (cellW * cols) / 2 + cellW / 2;
    text("TARGETS", W / 2, 380, 13, "#94a3b8", "center", 800);
    roster.forEach(([key, name, pts], i) => {
      const cx = startX + (i % cols) * cellW;
      const cy = 430 + Math.floor(i / cols) * 70;
      const s = sprites[key];
      const sc = Math.min(1, 40 / Math.max(s.w, s.h)) * 1.1;
      drawImg(s, cx, cy - 8, s.w * sc, s.h * sc);
      text(name, cx, cy + 20, 12, "#e2e8f0", "center", 700);
      text(pts, cx, cy + 34, 12, "#fde047", "center", 800);
    });

    text("BOOSTERS", W / 2, 572, 13, "#94a3b8", "center", 800);
    const keysList = Object.keys(PICKUPS);
    const gap = Math.min(52, (W - 40) / keysList.length);
    keysList.forEach((k, i) => {
      const x = W / 2 - (gap * (keysList.length - 1)) / 2 + i * gap;
      drawImg(sprites.pickups[k], x, 604, 36, 36);
    });

    const lines = usingTouch
      ? ["Drag anywhere to fly. Guns fire on their own", "Tap BOMB to clear the screen"]
      : ["Mouse or WASD to fly. Guns fire on their own", "Space or right click to bomb • P pause • M mute"];
    text(lines[0], W / 2, 660, Math.min(14, W / 27), "#cbd5e1", "center", 600);
    text(lines[1], W / 2, 682, Math.min(14, W / 27), "#cbd5e1", "center", 600);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
    text(usingTouch ? "TAP TO LAUNCH" : "CLICK OR PRESS ENTER TO LAUNCH", W / 2, 734, Math.min(20, W / 19), "#67e8f9", "center", 900, 16);
    ctx.globalAlpha = 1;
    if (best > 0) text(`BEST ${best.toLocaleString()}`, W / 2, 770, 13, "#94a3b8", "center", 700);
  }

  function drawOverlay(title, color) {
    ctx.fillStyle = "rgba(2,4,12,0.6)";
    ctx.fillRect(0, 0, W, H);
    text(title, W / 2, H * 0.3, Math.min(60, W / 9), color, "center", 900, 24);
  }

  function drawGameOver() {
    drawOverlay("GAME OVER", "#f43f5e");
    text(score.toLocaleString(), W / 2, H * 0.3 + 76, 44, "#f8fafc", "center", 900, 14);
    if (newBest) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 6);
      text("NEW BEST!", W / 2, H * 0.3 + 120, 20, "#fde047", "center", 900, 14);
      ctx.globalAlpha = 1;
    } else {
      text(`BEST ${best.toLocaleString()}`, W / 2, H * 0.3 + 120, 15, "#94a3b8", "center", 700);
    }
    const rows = [
      ["Wave reached", String(wave)],
      ["Enemies destroyed", stats.kills.toLocaleString()],
      ["Gems collected", stats.gems.toLocaleString()],
    ];
    rows.forEach(([k, v], i) => {
      const y = H * 0.3 + 172 + i * 28;
      text(k, W / 2 - 120, y, 15, "#cbd5e1", "left", 600);
      text(v, W / 2 + 120, y, 15, "#f8fafc", "right", 800);
    });
    if (overTimer > 1) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
      text(usingTouch ? "TAP TO FLY AGAIN" : "CLICK OR PRESS ENTER TO FLY AGAIN", W / 2, H * 0.3 + 290, Math.min(18, W / 22), "#67e8f9", "center", 900, 14);
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sx = shake ? rand(-shake, shake) : 0;
    const sy = shake ? rand(-shake, shake) : 0;
    const s = viewScale * dpr;
    ctx.setTransform(s, 0, 0, s, offX * dpr, offY * dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    drawBackground();
    ctx.translate(sx, sy);
    if (mode !== "title") drawWorld();
    ctx.translate(-sx, -sy);

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.8, flash * 0.6);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (mode === "title") drawTitle();
    else {
      drawHud();
      if (mode === "paused") {
        drawOverlay("PAUSED", "#67e8f9");
        text(usingTouch ? "Tap to resume" : "Press P, Esc or click to resume", W / 2, H * 0.3 + 70, 16, "#cbd5e1", "center", 600);
      } else if (mode === "over") drawGameOver();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ input

  const keys = { left: false, right: false, up: false, down: false };
  const pointer = { x: 0, y: 0, has: false, dragging: false, id: null, lx: 0, ly: 0 };
  let controlMode = "mouse";
  let usingTouch = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;

  const KEYMAP = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
  };

  function togglePause() {
    if (mode === "playing") mode = "paused";
    else if (mode === "paused") mode = "playing";
  }

  window.addEventListener("keydown", (e) => {
    initAudio();
    const dir = KEYMAP[e.code];
    if (dir) {
      keys[dir] = true;
      usingTouch = false;
      e.preventDefault();
      return;
    }
    if (e.code === "Space" || e.code === "Enter") e.preventDefault();
    if (e.repeat) return;
    if (mode === "title" || (mode === "over" && overTimer > 1)) {
      if (e.code === "Enter" || e.code === "Space") startGame();
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") togglePause();
    else if (e.code === "KeyM") muted = !muted;
    else if (e.code === "Space" || e.code === "KeyB" || e.code === "KeyX") {
      if (mode === "paused") togglePause();
      else useBomb();
    }
  });

  window.addEventListener("keyup", (e) => {
    const dir = KEYMAP[e.code];
    if (dir) keys[dir] = false;
  });

  function toLogical(e) {
    return { x: (e.clientX - offX) / viewScale, y: (e.clientY - offY) / viewScale };
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    initAudio();
    const p = toLogical(e);
    const touch = e.pointerType !== "mouse";
    usingTouch = touch;
    if (mode === "title") {
      startGame();
      if (!touch) {
        pointer.x = p.x;
        pointer.y = p.y;
        pointer.has = true;
        controlMode = "mouse";
      }
      return;
    }
    if (mode === "over") {
      if (overTimer > 1) startGame();
      return;
    }
    if (mode === "paused") {
      togglePause();
      return;
    }
    if (mode !== "playing") return;
    if (touch) {
      const b = bombBtn();
      if (dist2(p.x, p.y, b.x, b.y) < (b.r + 6) * (b.r + 6)) {
        useBomb();
        return;
      }
      const pb = pauseBtn();
      if (dist2(p.x, p.y, pb.x, pb.y) < pb.r * pb.r) {
        togglePause();
        return;
      }
      pointer.dragging = true;
      pointer.id = e.pointerId;
      pointer.lx = p.x;
      pointer.ly = p.y;
      controlMode = "touch";
    } else if (e.button === 2) {
      useBomb();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = toLogical(e);
    if (e.pointerType === "mouse") {
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.has = true;
      controlMode = "mouse";
      return;
    }
    if (!pointer.dragging || e.pointerId !== pointer.id || mode !== "playing" || player.dead) return;
    player.x = clamp(player.x + (p.x - pointer.lx) * 1.35, 20, W - 20);
    player.y = clamp(player.y + (p.y - pointer.ly) * 1.35, 40, H - 30);
    pointer.lx = p.x;
    pointer.ly = p.y;
  });

  const endDrag = (e) => {
    if (e.pointerId === pointer.id) pointer.dragging = false;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  const autoPause = () => {
    if (mode === "playing") mode = "paused";
    for (const k in keys) keys[k] = false;
  };
  window.addEventListener("blur", autoPause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoPause();
  });

  // ------------------------------------------------------------------- loop

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const oldW = W;
    W = Math.round(clamp((H * cw) / ch, 360, 960));
    viewScale = Math.min(cw / W, ch / H);
    offX = (cw - W * viewScale) / 2;
    offY = (ch - H * viewScale) / 2;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    sprScale = clamp(viewScale * dpr, 1, 3);
    buildSprites();
    buildBackground();
    if (player && oldW !== W) player.x = clamp((player.x / oldW) * W, 20, W - 20);
    for (const e of enemies) if (e.sprite) e.sprite = pick(sprites.asteroids[e.size].filter((v) => v.crystal === e.crystal)).sprite;
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });

  resize();
  planetTimer = 2;
  player = newPlayer();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    canvas.style.cursor = mode === "playing" && controlMode === "mouse" ? "none" : "default";
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
