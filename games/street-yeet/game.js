(() => {
  const T = window.THREE;

  // ---------------------------------------------------------------------------
  // Tuning
  // ---------------------------------------------------------------------------
  const GRAVITY = 38;
  const WALK_SPEED = 7;
  const RUN_SPEED = 13;
  const BOUND = 57; // the player stays inside |x|, |z| <= BOUND
  const ROAD_IN = 38; // the road is the square ring between ROAD_IN and ROAD_OUT
  const ROAD_OUT = 52;
  const CHARGE_TIME = 1.1; // seconds to a full charge
  const SWING_TIME = 0.42;
  const IMPACT_AT = 0.07; // seconds into the swing when the fist connects
  const GONE_DIST = 210; // flying things this far away become a twinkle
  const RESPAWN_PROP = 7;
  const RESPAWN_BUILDING = 14;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerpAngle = (a, b, t) => {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  // The portal loads games in a sandboxed iframe with an opaque origin,
  // where localStorage throws, so the best yeet falls back to memory.
  const storage = {
    get() {
      try {
        return JSON.parse(localStorage.getItem("street-yeet.best")) || null;
      } catch {
        return null;
      }
    },
    set(value) {
      try {
        localStorage.setItem("street-yeet.best", JSON.stringify(value));
      } catch {}
    },
  };

  // ---------------------------------------------------------------------------
  // Renderer, scene, lights
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;

  const SKY = 0x9bd8ff;
  const scene = new T.Scene();
  scene.background = new T.Color(SKY);
  scene.fog = new T.Fog(SKY, 80, 250);

  const camera = new T.PerspectiveCamera(60, 1, 0.1, 2000);

  scene.add(new T.HemisphereLight(0xdff3ff, 0x6b5a44, 1.6));
  const sun = new T.DirectionalLight(0xfff1d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // A cartoon moon, for the yeets that go all the way.
  const moon = new T.Mesh(
    new T.IcosahedronGeometry(30, 1),
    new T.MeshBasicMaterial({ color: 0xf5f3e6, fog: false }),
  );
  moon.position.set(-500, 420, 900);
  scene.add(moon);

  // ---------------------------------------------------------------------------
  // Geometry and material helpers
  // ---------------------------------------------------------------------------
  const matCache = new Map();
  function mat(color) {
    if (!matCache.has(color)) matCache.set(color, new T.MeshLambertMaterial({ color }));
    return matCache.get(color);
  }
  const geoCache = new Map();
  function cached(key, make) {
    if (!geoCache.has(key)) {
      const geo = make();
      geo.computeVertexNormals(); // non-indexed, so this gives flat shading
      geoCache.set(key, geo);
    }
    return geoCache.get(key);
  }
  const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, seg = 8) =>
    cached(`c${rt},${rb},${h},${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg).toNonIndexed());
  const ico = (r, detail = 0) => cached(`i${r},${detail}`, () => new T.IcosahedronGeometry(r, detail));
  const cone = (r, h, seg = 8) => cached(`k${r},${h},${seg}`, () => new T.ConeGeometry(r, h, seg).toNonIndexed());

  function part(geo, color, x, y, z, parent) {
    const m = new T.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  // Merges a group of static parts into one vertex-coloured mesh, so a lamp
  // or a bench costs one draw call instead of six.
  const bakedMat = new T.MeshLambertMaterial({ vertexColors: true });
  function bake(group) {
    group.updateMatrixWorld(true);
    const pos = [];
    const nor = [];
    const col = [];
    const v = new T.Vector3();
    const n = new T.Vector3();
    const nm = new T.Matrix3();
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry;
      const p = g.attributes.position;
      const q = g.attributes.normal;
      const c = obj.material.color;
      nm.getNormalMatrix(obj.matrixWorld);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(obj.matrixWorld);
        n.fromBufferAttribute(q, i).applyMatrix3(nm).normalize();
        pos.push(v.x, v.y, v.z);
        nor.push(n.x, n.y, n.z);
        col.push(c.r, c.g, c.b);
      }
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, bakedMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const out = new T.Group();
    out.add(mesh);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Models. Every model's origin is on the ground, facing +z.
  // ---------------------------------------------------------------------------
  const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4226];
  const SHIRTS = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308, 0xa855f7, 0xf97316, 0x14b8a6, 0xec4899, 0xf8fafc];
  const PANTS = [0x1e3a8a, 0x374151, 0x111827, 0x78350f, 0x065f46, 0x9ca3af];
  const HAIRS = [0x1f1300, 0x3b2314, 0x7c4a1e, 0xd6b25e, 0x9ca3af, 0xb91c1c];
  const CAR_COLORS = [0xef4444, 0x2563eb, 0xfacc15, 0x10b981, 0xf8fafc, 0x111827, 0xf97316, 0x7c3aed];
  const NAMES = [
    "Kevin", "Brenda", "Gary", "Linda", "Doug", "Tiffany", "Steve", "Karen", "Chad", "Doris",
    "Barry", "Pam", "Todd", "Gloria", "Dwayne", "Marge", "Nigel", "Priya", "Sven", "Yolanda",
  ];

  function limb(x, y, z, parent) {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  function buildPerson() {
    const g = new T.Group();
    const skin = pick(SKINS);
    const shirt = pick(SHIRTS);
    const pants = pick(PANTS);
    const legL = limb(-0.16, 0.85, 0, g);
    const legR = limb(0.16, 0.85, 0, g);
    for (const leg of [legL, legR]) {
      part(box(0.24, 0.85, 0.26), pants, 0, -0.42, 0, leg);
      part(box(0.26, 0.12, 0.38), 0x1f2937, 0, -0.8, 0.05, leg);
    }
    part(box(0.62, 0.8, 0.36), shirt, 0, 1.25, 0, g);
    const armL = limb(-0.42, 1.6, 0, g);
    const armR = limb(0.42, 1.6, 0, g);
    for (const arm of [armL, armR]) {
      part(box(0.2, 0.62, 0.22), shirt, 0, -0.3, 0, arm);
      part(box(0.18, 0.16, 0.2), skin, 0, -0.7, 0, arm);
    }
    part(box(0.42, 0.42, 0.42), skin, 0, 1.9, 0, g);
    part(box(0.46, 0.14, 0.46), pick(HAIRS), 0, 2.15, -0.02, g);
    part(box(0.07, 0.07, 0.04), 0x111111, -0.1, 1.95, 0.21, g);
    part(box(0.07, 0.07, 0.04), 0x111111, 0.1, 1.95, 0.21, g);
    g.userData.limbs = { legL, legR, armL, armR };
    return g;
  }

  function buildDog() {
    const g = new T.Group();
    const fur = pick([0x8b5a2b, 0xd4a373, 0x2b2b2b, 0xf5f5f4]);
    part(box(0.42, 0.36, 0.85), fur, 0, 0.55, 0, g);
    part(box(0.36, 0.34, 0.38), fur, 0, 0.82, 0.5, g);
    part(box(0.2, 0.16, 0.22), 0x3f2a1d, 0, 0.75, 0.75, g);
    part(box(0.08, 0.16, 0.1), 0x3f2a1d, -0.14, 1.02, 0.45, g);
    part(box(0.08, 0.16, 0.1), 0x3f2a1d, 0.14, 1.02, 0.45, g);
    const tail = limb(0, 0.68, -0.42, g);
    part(box(0.08, 0.08, 0.35), fur, 0, 0.08, -0.12, tail);
    tail.rotation.x = -0.6;
    const legs = [];
    for (const [x, z] of [[-0.14, 0.3], [0.14, 0.3], [-0.14, -0.3], [0.14, -0.3]]) {
      const l = limb(x, 0.4, z, g);
      part(box(0.11, 0.4, 0.11), fur, 0, -0.2, 0, l);
      legs.push(l);
    }
    g.userData.limbs = { legL: legs[0], legR: legs[1], legL2: legs[3], legR2: legs[2], tail };
    return g;
  }

  function buildPigeon() {
    const g = new T.Group();
    const body = part(ico(0.2), 0x8b8f99, 0, 0.22, 0, g);
    body.scale.set(0.9, 0.8, 1.3);
    part(ico(0.11), 0x5b6170, 0, 0.42, 0.18, g);
    part(box(0.05, 0.05, 0.1), 0xf59e0b, 0, 0.41, 0.3, g);
    part(box(0.03, 0.14, 0.03), 0xf87171, -0.06, 0.06, 0, g);
    part(box(0.03, 0.14, 0.03), 0xf87171, 0.06, 0.06, 0, g);
    return g;
  }

  function buildCow() {
    const g = new T.Group();
    part(box(1.1, 0.9, 2.0), 0xf8fafc, 0, 1.15, 0, g);
    part(box(0.5, 0.5, 0.05), 0x111111, 0.3, 1.25, 1.0, g);
    part(box(0.05, 0.5, 0.6), 0x111111, 0.56, 1.2, -0.3, g);
    part(box(0.05, 0.4, 0.5), 0x111111, -0.56, 1.3, 0.4, g);
    part(box(0.6, 0.05, 0.6), 0x111111, -0.1, 1.61, -0.4, g);
    part(box(0.6, 0.6, 0.7), 0xf8fafc, 0, 1.55, 1.25, g);
    part(box(0.5, 0.3, 0.2), 0xf9a8d4, 0, 1.4, 1.62, g);
    part(box(0.08, 0.2, 0.08), 0xe7e5e4, -0.25, 1.95, 1.2, g);
    part(box(0.08, 0.2, 0.08), 0xe7e5e4, 0.25, 1.95, 1.2, g);
    part(box(0.35, 0.15, 0.3), 0xf9a8d4, 0, 0.66, -0.3, g);
    for (const [x, z] of [[-0.38, 0.75], [0.38, 0.75], [-0.38, -0.75], [0.38, -0.75]]) {
      part(box(0.25, 0.75, 0.25), 0xf8fafc, x, 0.37, z, g);
    }
    return bake(g);
  }

  function buildCar() {
    const g = new T.Group();
    const color = pick(CAR_COLORS);
    part(box(1.9, 0.7, 4.0), color, 0, 0.7, 0, g);
    part(box(1.7, 0.62, 2.1), color, 0, 1.35, -0.25, g);
    part(box(1.72, 0.44, 0.05), 0x1e293b, 0, 1.36, 0.82, g);
    part(box(1.72, 0.44, 0.05), 0x1e293b, 0, 1.36, -1.32, g);
    part(box(1.74, 0.4, 1.6), 0x1e293b, 0, 1.38, -0.25, g);
    part(box(0.35, 0.18, 0.06), 0xfef9c3, -0.6, 0.78, 2.0, g);
    part(box(0.35, 0.18, 0.06), 0xfef9c3, 0.6, 0.78, 2.0, g);
    part(box(0.35, 0.18, 0.06), 0xdc2626, -0.6, 0.78, -2.0, g);
    part(box(0.35, 0.18, 0.06), 0xdc2626, 0.6, 0.78, -2.0, g);
    for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
      const w = part(cyl(0.4, 0.4, 0.32, 10), 0x111111, x, 0.4, z, g);
      w.rotation.z = Math.PI / 2;
    }
    return bake(g);
  }

  function buildHydrant() {
    const g = new T.Group();
    part(cyl(0.22, 0.26, 0.75, 7), 0xdc2626, 0, 0.37, 0, g);
    part(cyl(0.12, 0.22, 0.2, 7), 0xb91c1c, 0, 0.84, 0, g);
    part(box(0.6, 0.14, 0.14), 0xb91c1c, 0, 0.55, 0, g);
    return bake(g);
  }

  function buildTrashCan() {
    const g = new T.Group();
    part(cyl(0.42, 0.36, 1.0, 8), 0x2f6b3f, 0, 0.5, 0, g);
    part(cyl(0.46, 0.46, 0.1, 8), 0x1f4d2c, 0, 1.05, 0, g);
    part(box(0.25, 0.08, 0.08), 0x1f4d2c, 0, 1.14, 0, g);
    return bake(g);
  }

  function buildMailbox() {
    const g = new T.Group();
    part(box(0.6, 0.8, 0.55), 0x1d4ed8, 0, 0.95, 0, g);
    part(box(0.62, 0.12, 0.57), 0x1e3a8a, 0, 1.41, 0, g);
    part(box(0.36, 0.06, 0.04), 0x0f172a, 0, 1.15, 0.28, g);
    part(box(0.1, 0.55, 0.1), 0x1e3a8a, -0.22, 0.27, 0, g);
    part(box(0.1, 0.55, 0.1), 0x1e3a8a, 0.22, 0.27, 0, g);
    return bake(g);
  }

  function buildBench() {
    const g = new T.Group();
    part(box(1.8, 0.1, 0.5), 0xa16207, 0, 0.5, 0, g);
    part(box(1.8, 0.45, 0.08), 0xa16207, 0, 0.82, -0.22, g);
    part(box(0.1, 0.5, 0.45), 0x27272a, -0.8, 0.25, 0, g);
    part(box(0.1, 0.5, 0.45), 0x27272a, 0.8, 0.25, 0, g);
    return bake(g);
  }

  function buildLamp() {
    const g = new T.Group();
    part(cyl(0.08, 0.12, 4.6, 6), 0x334155, 0, 2.3, 0, g);
    part(box(0.08, 0.08, 1.0), 0x334155, 0, 4.5, 0.45, g);
    part(box(0.45, 0.16, 0.55), 0x334155, 0, 4.42, 0.95, g);
    part(box(0.35, 0.06, 0.45), 0xfff7b0, 0, 4.32, 0.95, g);
    return bake(g);
  }

  function buildTree() {
    const g = new T.Group();
    part(cyl(0.18, 0.26, 1.7, 5), 0x7c4a1e, 0, 0.85, 0, g);
    part(ico(1.3), pick([0x4d9a3a, 0x3f8f45, 0x5aa83c]), 0, 2.6, 0, g);
    part(ico(0.9), 0x6bbf4a, 0.45, 3.35, 0.2, g);
    return bake(g);
  }

  function buildCone() {
    const g = new T.Group();
    part(box(0.6, 0.06, 0.6), 0xea580c, 0, 0.03, 0, g);
    part(cone(0.28, 0.8, 8), 0xf97316, 0, 0.45, 0, g);
    part(cyl(0.15, 0.19, 0.13, 8), 0xf8fafc, 0, 0.5, 0, g);
    return bake(g);
  }

  function buildPhoneBooth() {
    const g = new T.Group();
    part(box(1.0, 2.4, 1.0), 0xc81e1e, 0, 1.2, 0, g);
    part(box(0.75, 1.5, 0.04), 0xbfe3f5, 0, 1.4, 0.5, g);
    part(box(1.1, 0.15, 1.1), 0x991b1b, 0, 2.47, 0, g);
    part(box(0.6, 0.12, 0.05), 0xf8fafc, 0, 2.25, 0.51, g);
    return bake(g);
  }

  function buildHotDogCart() {
    const g = new T.Group();
    part(box(1.7, 0.9, 0.9), 0xd4d4d8, 0, 0.95, 0, g);
    part(box(1.75, 0.08, 0.95), 0x71717a, 0, 1.43, 0, g);
    for (const x of [-0.6, 0.6]) {
      const w = part(cyl(0.32, 0.32, 0.12, 10), 0x18181b, x, 0.32, 0.45, g);
      w.rotation.x = Math.PI / 2;
    }
    part(cyl(0.04, 0.04, 1.4, 5), 0x71717a, 0, 2.1, 0, g);
    part(cone(1.2, 0.45, 8), 0xef4444, 0, 2.9, 0, g);
    part(cone(0.6, 0.23, 8), 0xfacc15, 0, 3.06, 0, g);
    // A giant fibreglass hot dog on the roof, as is tradition.
    part(box(1.2, 0.22, 0.4), 0xe9b872, 0, 1.6, 0, g);
    const sausage = part(cyl(0.13, 0.13, 1.45, 7), 0xb4432c, 0, 1.75, 0, g);
    sausage.rotation.z = Math.PI / 2;
    part(box(1.1, 0.04, 0.06), 0xfacc15, 0, 1.89, 0, g);
    return bake(g);
  }

  function buildPortaPotty() {
    const g = new T.Group();
    part(box(1.15, 2.2, 1.15), 0x2563eb, 0, 1.1, 0, g);
    part(box(1.25, 0.14, 1.25), 0xf8fafc, 0, 2.27, 0, g);
    part(box(0.8, 1.8, 0.05), 0x1d4ed8, 0, 1.0, 0.58, g);
    part(box(0.3, 0.1, 0.05), 0x16a34a, 0.2, 1.7, 0.61, g);
    return bake(g);
  }

  function buildFountain() {
    const g = new T.Group();
    part(cyl(2.6, 2.8, 0.6, 10), 0x9ca3af, 0, 0.3, 0, g);
    part(cyl(2.3, 2.3, 0.1, 10), 0x60a5fa, 0, 0.6, 0, g);
    part(cyl(0.3, 0.45, 1.6, 6), 0x9ca3af, 0, 1.2, 0, g);
    part(cyl(0.9, 0.4, 0.3, 8), 0x9ca3af, 0, 2.0, 0, g);
    part(cyl(0.75, 0.75, 0.06, 8), 0x93c5fd, 0, 2.15, 0, g);
    return bake(g);
  }

  function buildPiano() {
    const g = new T.Group();
    part(box(1.5, 0.5, 1.9), 0x111111, 0, 1.0, 0, g);
    const lid = part(box(1.5, 0.05, 1.7), 0x18181b, 0, 1.6, -0.2, g);
    lid.rotation.x = -0.45;
    part(box(1.4, 0.08, 0.3), 0xf8fafc, 0, 1.0, 1.05, g);
    for (let i = 0; i < 6; i++) part(box(0.08, 0.05, 0.18), 0x111111, -0.55 + i * 0.22, 1.06, 1.0, g);
    for (const [x, z] of [[-0.6, 0.8], [0.6, 0.8], [0, -0.8]]) part(box(0.14, 0.75, 0.14), 0x111111, x, 0.37, z, g);
    return bake(g);
  }

  function buildVending() {
    const g = new T.Group();
    part(box(1.1, 2.1, 0.9), 0xdc2626, 0, 1.05, 0, g);
    part(box(0.7, 1.3, 0.05), 0x1e293b, -0.12, 1.3, 0.46, g);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        part(box(0.14, 0.2, 0.04), pick([0xfacc15, 0x22c55e, 0x3b82f6, 0xf97316]), -0.34 + c * 0.22, 1.8 - r * 0.3, 0.48, g);
      }
    }
    part(box(0.2, 0.5, 0.05), 0xd4d4d8, 0.38, 1.4, 0.46, g);
    return bake(g);
  }

  // Building facades are a procedural canvas texture, tinted per building.
  function makeWindowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        const lit = Math.random() < 0.3;
        x.fillStyle = lit ? "#fff6c4" : "#3b4a5c";
        x.fillRect(col * 32 + 7, r * 32 + 6, 18, 20);
        x.fillStyle = "rgba(255,255,255,0.25)";
        x.fillRect(col * 32 + 7, r * 32 + 6, 18, 3);
      }
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.magFilter = T.NearestFilter;
    return tex;
  }
  const windowTextures = [makeWindowTexture(), makeWindowTexture(), makeWindowTexture()];
  const BUILDING_TINTS = [0xc2410c, 0xb45309, 0x9a3412, 0x64748b, 0x94a3b8, 0xd6d3d1, 0x7c6f64, 0x0f766e, 0x6d28d9, 0xbe8a60];

  function facade(width, height, tint) {
    const tex = pick(windowTextures).clone();
    tex.repeat.set(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
    tex.needsUpdate = true;
    return new T.MeshLambertMaterial({ map: tex, color: tint });
  }

  function buildBuilding(w, h, d) {
    const g = new T.Group();
    const tint = pick(BUILDING_TINTS);
    const sideX = facade(d, h, tint);
    const sideZ = facade(w, h, tint);
    const roof = mat(0x4b5563);
    const body = new T.Mesh(new T.BoxGeometry(w, h, d), [sideX, sideX, roof, roof, sideZ, sideZ]);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    part(box(w + 0.4, 0.5, d + 0.4), 0x374151, 0, h + 0.25, 0, g);
    if (Math.random() < 0.6) part(box(2, 1.6, 2), 0x9ca3af, rand(-w / 4, w / 4), h + 1.3, rand(-d / 4, d / 4), g);
    if (Math.random() < 0.4) {
      part(cyl(0.9, 0.9, 1.6, 8), 0x92400e, rand(-w / 4, w / 4), h + 2.5, rand(-d / 4, d / 4), g);
    }
    return g;
  }

  // The hero: a stocky brawler with one normal arm and one ludicrous fist.
  function buildHero() {
    const g = new T.Group();
    const body = new T.Group();
    g.add(body);
    const legL = limb(-0.3, 1.05, 0, body);
    const legR = limb(0.3, 1.05, 0, body);
    for (const leg of [legL, legR]) {
      part(box(0.42, 1.05, 0.45), 0x1e3a8a, 0, -0.52, 0, leg);
      part(box(0.46, 0.2, 0.62), 0x111827, 0, -0.98, 0.08, leg);
    }
    part(box(1.1, 0.35, 0.65), 0x1e3a8a, 0, 1.15, 0, body);
    const torso = limb(0, 1.3, 0, body);
    part(box(1.2, 1.2, 0.75), 0xf8fafc, 0, 0.6, 0, torso);
    part(box(1.22, 0.3, 0.77), 0xef4444, 0, 0.95, 0, torso);
    part(box(0.56, 0.56, 0.56), 0xe0ac69, 0, 1.55, 0.02, torso);
    part(box(0.6, 0.2, 0.6), 0x111827, 0, 1.87, -0.02, torso);
    part(box(0.62, 0.08, 0.32), 0x111827, 0, 1.78, 0.3, torso); // cap brim
    part(box(0.36, 0.08, 0.04), 0x111111, 0, 1.62, 0.3, torso); // sunglasses
    // Facing +z, the hero's right side is -x.
    const armL = limb(0.75, 1.0, 0, torso);
    part(box(0.3, 0.85, 0.32), 0xe0ac69, 0, -0.38, 0, armL);
    part(box(0.32, 0.3, 0.32), 0xe0ac69, 0, -0.88, 0, armL);
    const armR = limb(-0.8, 1.05, 0, torso);
    part(box(0.48, 0.7, 0.5), 0xe0ac69, 0, -0.3, 0, armR);
    part(box(0.56, 0.6, 0.56), 0xd59a5c, 0, -0.85, 0, armR);
    const fist = new T.Group();
    fist.position.set(0, -1.55, 0.05);
    armR.add(fist);
    const fistMat = new T.MeshLambertMaterial({ color: 0xe0ac69, emissive: 0x000000 });
    const knuckles = new T.Mesh(ico(0.85, 1), fistMat);
    knuckles.scale.set(1, 0.95, 1.1);
    knuckles.castShadow = true;
    fist.add(knuckles);
    part(box(0.5, 0.18, 0.5), 0xef4444, 0, 0.72, 0, fist); // wristband
    g.userData = { body, torso, legL, legR, armL, armR, fist, fistMat };
    return g;
  }

  // ---------------------------------------------------------------------------
  // The city block
  // ---------------------------------------------------------------------------
  function flatQuad(w, d, color, x, z, y = 0.01) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat(color));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  flatQuad(1200, 1200, 0x6b8f4e, 0, 0, 0);
  // Road ring and the sidewalks either side of it.
  for (const s of [-1, 1]) {
    flatQuad(ROAD_OUT * 2 + 10, 14, 0x3a3f47, 0, s * 45, 0.02);
    flatQuad(14, ROAD_OUT * 2 + 10, 0x3a3f47, s * 45, 0, 0.021);
    flatQuad(ROAD_IN * 2, 5, 0xbdb6a8, 0, s * 35.5, 0.02);
    flatQuad(5, ROAD_IN * 2 - 10, 0xbdb6a8, s * 35.5, 0, 0.02);
    flatQuad(ROAD_OUT * 2 + 14, 6, 0xbdb6a8, 0, s * 55, 0.02);
    flatQuad(6, ROAD_OUT * 2 + 2, 0xbdb6a8, s * 55, 0, 0.02);
  }
  // Lane dashes and crosswalks.
  for (let t = -48; t <= 48; t += 6) {
    for (const s of [-1, 1]) {
      flatQuad(2.6, 0.25, 0xfacc15, t, s * 45, 0.03);
      flatQuad(0.25, 2.6, 0xfacc15, s * 45, t, 0.031);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        flatQuad(0.9, 4, 0xf8fafc, sx * 30 + (i - 2.5) * 1.6 * sx * -1, sz * 45, 0.032);
        flatQuad(4, 0.9, 0xf8fafc, sx * 45, sz * 30 + (i - 2.5) * 1.6, 0.033);
      }
    }
  }
  // The plaza in the middle of the block.
  flatQuad(66, 66, 0x7fb069, 0, 0, 0.015);
  flatQuad(26, 66, 0xd6cfc0, 0, 0, 0.018);
  flatQuad(66, 26, 0xd6cfc0, 0, 0, 0.019);

  // ---------------------------------------------------------------------------
  // Entities: everything that can be yeeted
  // ---------------------------------------------------------------------------
  const entities = [];
  const colliders = []; // building footprints the player and walkers can't enter

  function perim(h, s) {
    const L = 8 * h;
    s = ((s % L) + L) % L;
    const side = Math.floor(s / (2 * h));
    const t = s - side * 2 * h - h;
    if (side === 0) return [t, -h];
    if (side === 1) return [h, t];
    if (side === 2) return [-t, h];
    return [-h, -t];
  }

  function addEntity(kind, group, opts) {
    const e = {
      kind,
      group,
      name: opts.name,
      radius: opts.radius,
      height: opts.height,
      mass: opts.mass || 1,
      state: "idle",
      home: { x: opts.x, z: opts.z, yaw: opts.yaw || 0 },
      vel: new T.Vector3(),
      spin: new T.Vector3(),
      t: 0,
      respawnAt: 0,
      ai: opts.ai || null,
      collider: null,
      phase: Math.random() * 10,
    };
    group.position.set(opts.x, 0, opts.z);
    group.rotation.y = e.home.yaw;
    scene.add(group);
    entities.push(e);
    return e;
  }

  // Outer ring of buildings that closes the block in.
  function addBuilding(cx, cz, w, d, h) {
    const e = addEntity("building", buildBuilding(w, h, d), {
      name: "A whole building",
      radius: Math.max(w, d) / 2,
      height: h,
      mass: 40,
      x: cx,
      z: cz,
    });
    e.w = w;
    e.d = d;
    e.collider = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, on: true };
    colliders.push(e.collider);
    return e;
  }
  for (const side of [0, 1, 2, 3]) {
    let t = -78;
    while (t < 78) {
      const w = rand(9, 16);
      const d = rand(10, 16);
      const h = rand(9, 38);
      const along = t + w / 2;
      const across = 58.5 + d / 2;
      if (side === 0) addBuilding(along, -across, w, d, h);
      if (side === 1) addBuilding(across, along, d, w, h);
      if (side === 2) addBuilding(-along, across, w, d, h);
      if (side === 3) addBuilding(-across, -along, d, w, h);
      t += w + rand(0.3, 1.5);
    }
  }
  // Four buildings on the corners of the block, around the plaza.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = rand(14, 17);
      const d = rand(14, 17);
      addBuilding(sx * (14 + w / 2), sz * (14 + d / 2), w, d, rand(12, 30));
    }
  }

  function addProp(kind, build, name, x, z, yaw, radius, height, mass) {
    return addEntity(kind, build(), { name, x, z, yaw, radius, height, mass });
  }

  // Sidewalk furniture along the inner (35.5) and outer (54.5) rings.
  for (let s = 4; s < 8 * 37; s += 18.5) {
    const [x, z] = perim(37.4, s);
    addProp("lamp", buildLamp, "A street lamp", x, z, Math.atan2(-x, -z), 0.3, 4.6, 2);
  }
  for (let s = 12; s < 8 * 53.6; s += 26.8) {
    const [x, z] = perim(53.6, s);
    addProp("lamp", buildLamp, "A street lamp", x, z, Math.atan2(x, z), 0.3, 4.6, 2);
  }
  const sidewalkSpots = [];
  for (let i = 0; i < 26; i++) {
    const outer = i % 2 === 0;
    const h = outer ? rand(54.2, 56.2) : rand(34, 36.6);
    sidewalkSpots.push(perim(h, rand(0, 8 * h)));
  }
  const furniture = [
    ["hydrant", buildHydrant, "A fire hydrant", 0.35, 1, 1.5],
    ["hydrant", buildHydrant, "A fire hydrant", 0.35, 1, 1.5],
    ["hydrant", buildHydrant, "A fire hydrant", 0.35, 1, 1.5],
    ["hydrant", buildHydrant, "A fire hydrant", 0.35, 1, 1.5],
    ["trash", buildTrashCan, "A trash can", 0.45, 1.1, 1],
    ["trash", buildTrashCan, "A trash can", 0.45, 1.1, 1],
    ["trash", buildTrashCan, "A trash can", 0.45, 1.1, 1],
    ["trash", buildTrashCan, "A trash can", 0.45, 1.1, 1],
    ["trash", buildTrashCan, "A trash can", 0.45, 1.1, 1],
    ["mailbox", buildMailbox, "A mailbox", 0.4, 1.5, 1.5],
    ["mailbox", buildMailbox, "A mailbox", 0.4, 1.5, 1.5],
    ["mailbox", buildMailbox, "A mailbox", 0.4, 1.5, 1.5],
    ["booth", buildPhoneBooth, "A phone booth", 0.7, 2.5, 4],
    ["booth", buildPhoneBooth, "A phone booth", 0.7, 2.5, 4],
    ["cart", buildHotDogCart, "The hot dog cart", 1.0, 3, 4],
    ["potty", buildPortaPotty, "A porta-potty (occupied?)", 0.8, 2.3, 4],
    ["vending", buildVending, "A vending machine", 0.75, 2.1, 5],
    ["vending", buildVending, "A vending machine", 0.75, 2.1, 5],
  ];
  furniture.forEach(([kind, build, name, r, h, m], i) => {
    const [x, z] = sidewalkSpots[i];
    addProp(kind, build, name, x, z, rand(0, Math.PI * 2), r, h, m);
  });

  // The plaza: trees, benches, a fountain, a piano and, for reasons, a cow.
  for (const [x, z] of [[-10, -6], [10, -6], [-10, 6], [10, 6], [-6, -24], [6, -24], [-6, 24], [6, 24], [-24, -6], [24, 6]]) {
    addProp("tree", buildTree, "A tree", x, z, rand(0, 6), 0.4, 4, 3);
  }
  for (const [x, z, yaw] of [[-4, -11, 0], [4, -11, 0], [-4, 11, Math.PI], [4, 11, Math.PI], [-11, 0, Math.PI / 2], [11, 0, -Math.PI / 2]]) {
    addProp("bench", buildBench, "A park bench", x, z, yaw, 0.9, 1, 2);
  }
  addProp("fountain", buildFountain, "The fountain", 0, 0, 0, 2.8, 2.2, 15);
  addProp("piano", buildPiano, "A grand piano", -20, 4, 0.6, 1.1, 1.6, 6);
  addProp("cow", buildCow, "A cow (why was there a cow?)", 18, -20, 2.2, 1.0, 2, 6);
  for (let i = 0; i < 6; i++) {
    const [x, z] = perim(rand(39.5, 50.5), rand(0, 360));
    addProp("cone", buildCone, "A traffic cone", x, z, rand(0, 6), 0.3, 0.8, 0.5);
  }
  for (let i = 0; i < 12; i++) {
    const cx = i < 6 ? -4 : 5;
    const cz = i < 6 ? -18 : 17;
    addProp("pigeon", buildPigeon, "A pigeon", cx + rand(-2.5, 2.5), cz + rand(-2.5, 2.5), rand(0, 6), 0.2, 0.5, 0.2);
  }

  // Walkers follow a square loop and panic when the fist comes out.
  const RINGS = [35.5, 54.5, 9];
  for (let i = 0; i < 16; i++) {
    const ring = RINGS[i % 3];
    const s = rand(0, 8 * ring);
    const [x, z] = perim(ring, s);
    const e = addEntity("person", buildPerson(), {
      name: pick(NAMES),
      x,
      z,
      radius: 0.4,
      height: 2.2,
      mass: 1,
      ai: { ring, s, dir: Math.random() < 0.5 ? 1 : -1, speed: rand(1.3, 2.1), panic: 0 },
    });
    e.ai.speedBase = e.ai.speed;
  }
  for (let i = 0; i < 4; i++) {
    const ring = i < 2 ? 34.5 : 55.5;
    const s = rand(0, 8 * ring);
    const [x, z] = perim(ring, s);
    addEntity("dog", buildDog(), {
      name: pick(["A very good dog", "A corgi-adjacent dog", "Sir Barksalot", "Biscuit the dog"]),
      x,
      z,
      radius: 0.45,
      height: 1,
      mass: 0.6,
      ai: { ring, s, dir: Math.random() < 0.5 ? 1 : -1, speed: rand(2.4, 3.2), panic: 0 },
    });
  }

  // Cars lap the road, clockwise on the inner lane, the other way outside.
  const LANES = [
    { h: 41.5, dir: 1 },
    { h: 48.5, dir: -1 },
  ];
  for (let i = 0; i < 8; i++) {
    const lane = LANES[i % 2];
    const s = (i >> 1) * 2 * lane.h + rand(0, lane.h);
    const [x, z] = perim(lane.h, s);
    addEntity("car", buildCar(), {
      name: pick(["A sedan", "Someone's car", "A taxi", "A hatchback", "A double-parked SUV"]),
      x,
      z,
      radius: 1.4,
      height: 1.8,
      mass: 8,
      ai: { lane, s, speed: 0, max: rand(9, 13), honked: 0, blocked: 0 },
    });
  }

  // ---------------------------------------------------------------------------
  // The player
  // ---------------------------------------------------------------------------
  const hero = buildHero();
  scene.add(hero);
  const H = hero.userData;
  const player = {
    pos: new T.Vector3(0, 0, -35.5),
    yaw: Math.PI / 2,
    vel: new T.Vector3(),
    lunge: 0,
    walk: 0,
    charging: false,
    charge: 0,
    swingT: -1,
    swingCharge: 0,
    windAngle: 0,
    hitDone: false,
  };
  let camYaw = Math.PI / 2;
  let camPitch = 0.32;
  const camPos = new T.Vector3();
  let shake = 0;
  let hitStop = 0;
  let fovKick = 0;

  function pushOut(pos, r) {
    for (const c of colliders) {
      if (!c.on) continue;
      const cx = clamp(pos.x, c.minX, c.maxX);
      const cz = clamp(pos.z, c.minZ, c.maxZ);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        // Inside the footprint: leave by the nearest wall.
        const exits = [
          [pos.x - c.minX, -1, 0],
          [c.maxX - pos.x, 1, 0],
          [pos.z - c.minZ, 0, -1],
          [c.maxZ - pos.z, 0, 1],
        ].sort((a, b) => a[0] - b[0]);
        const [dist, ex, ez] = exits[0];
        pos.x += ex * (dist + r);
        pos.z += ez * (dist + r);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Audio, all synthesised
  // ---------------------------------------------------------------------------
  let audio = null;
  let muted = false;
  let noiseBuf = null;
  function initAudio() {
    if (audio) return;
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      audio = null;
    }
  }
  function envGain(start, peak, dur) {
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(audio.destination);
    return g;
  }
  const sfx = {
    whoosh(power) {
      if (!audio || muted) return;
      const t = audio.currentTime;
      const src = audio.createBufferSource();
      src.buffer = noiseBuf;
      const f = audio.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(2400 + power * 2000, t + 0.22);
      src.connect(f).connect(envGain(t, 0.35 + power * 0.25, 0.3));
      src.start(t);
      src.stop(t + 0.32);
    },
    thump(power) {
      if (!audio || muted) return;
      const t = audio.currentTime;
      const o = audio.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      o.connect(envGain(t, 0.9, 0.3 + power * 0.2));
      o.start(t);
      o.stop(t + 0.55);
      const src = audio.createBufferSource();
      src.buffer = noiseBuf;
      const f = audio.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1400;
      src.connect(f).connect(envGain(t, 0.5, 0.12));
      src.start(t);
      src.stop(t + 0.15);
    },
    scream() {
      if (!audio || muted) return;
      const t = audio.currentTime;
      const o = audio.createOscillator();
      o.type = "sawtooth";
      const base = rand(420, 700);
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.35, t + 1.1);
      const vib = audio.createOscillator();
      vib.frequency.value = 9;
      const vibGain = audio.createGain();
      vibGain.gain.value = 25;
      vib.connect(vibGain).connect(o.frequency);
      const f = audio.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1600;
      o.connect(f).connect(envGain(t, 0.07, 1.1));
      o.start(t);
      vib.start(t);
      o.stop(t + 1.15);
      vib.stop(t + 1.15);
    },
    ding() {
      if (!audio || muted) return;
      const t = audio.currentTime;
      for (const [freq, delay] of [[1568, 0], [2093, 0.07]]) {
        const o = audio.createOscillator();
        o.type = "triangle";
        o.frequency.value = freq;
        o.connect(envGain(t + delay, 0.12, 0.5));
        o.start(t + delay);
        o.stop(t + delay + 0.55);
      }
    },
    honk() {
      if (!audio || muted) return;
      const t = audio.currentTime;
      for (const freq of [370, 466]) {
        const o = audio.createOscillator();
        o.type = "square";
        o.frequency.value = freq;
        const f = audio.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 1200;
        o.connect(f).connect(envGain(t, 0.05, 0.35));
        o.start(t);
        o.stop(t + 0.4);
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Particles and twinkles
  // ---------------------------------------------------------------------------
  const debrisGeo = new T.TetrahedronGeometry(0.22);
  const debrisMats = [0xfacc15, 0xf97316, 0xf8fafc, 0x9ca3af].map((c) => new T.MeshBasicMaterial({ color: c }));
  const debris = [];
  for (let i = 0; i < 90; i++) {
    const m = new T.Mesh(debrisGeo, debrisMats[i % debrisMats.length]);
    m.visible = false;
    scene.add(m);
    debris.push({ mesh: m, vel: new T.Vector3(), life: 0 });
  }
  let debrisNext = 0;
  function burst(pos, count, power) {
    for (let i = 0; i < count; i++) {
      const p = debris[debrisNext];
      debrisNext = (debrisNext + 1) % debris.length;
      p.mesh.position.copy(pos);
      p.mesh.visible = true;
      p.mesh.scale.setScalar(rand(0.6, 1.6));
      p.vel.set(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(rand(6, 14) * (1 + power));
      p.life = rand(0.4, 0.8);
    }
  }

  function makeStarTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.translate(32, 32);
    x.fillStyle = "#fffbe0";
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 30 : 7;
      const a = (i / 8) * Math.PI * 2;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }
  const starMat = new T.SpriteMaterial({ map: makeStarTexture(), fog: false, transparent: true, depthWrite: false });
  const twinkles = [];
  function twinkle(worldPos) {
    const dir = worldPos.clone().sub(camera.position).normalize();
    if (dir.y < 0.05) dir.y = 0.05;
    dir.normalize();
    const s = new T.Sprite(starMat.clone());
    s.position.copy(camera.position).addScaledVector(dir, 160);
    scene.add(s);
    twinkles.push({ sprite: s, t: 0 });
    sfx.ding();
  }

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------
  const stats = { yeets: 0, total: 0, best: storage.get() };
  const yeetsEl = document.getElementById("yeets");
  const totalEl = document.getElementById("total");
  const bestEl = document.getElementById("best");
  const banner = document.getElementById("banner");
  const bannerTitle = banner.querySelector(".banner-title");
  const bannerDetail = banner.querySelector(".banner-detail");
  const bannerWhere = banner.querySelector(".banner-where");

  function fmtKm(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 100) return `${km.toFixed(1)} km`;
    return `${Math.round(km).toLocaleString("en-US")} km`;
  }
  function whereLanded(km) {
    if (km >= 384400) return "Landed ON THE MOON";
    if (km >= 40075) return "Lapped the entire planet";
    if (km >= 5000) return "Now on another continent";
    if (km >= 800) return "Now in another country";
    if (km >= 100) return "Crossed state lines";
    if (km >= 15) return "Next town over";
    if (km >= 2) return "Clear across town";
    return "Down the street (weak, honestly)";
  }
  function renderStats() {
    yeetsEl.textContent = stats.yeets;
    totalEl.textContent = fmtKm(stats.total);
    bestEl.textContent = stats.best ? fmtKm(stats.best.km) : "0 m";
  }
  renderStats();

  let swingCombo = null; // {count, best, name, crit, max, time}
  function showBanner() {
    const c = swingCombo;
    const titles = ["YEET!", "DOUBLE YEET!", "TRIPLE YEET!", "QUAD YEET!"];
    let title = c.count <= 4 ? titles[c.count - 1] : `${c.count}x MEGA YEET!`;
    if (c.crit) title = c.count > 1 ? `CRITICAL ${title}` : "CRITICAL YEET!";
    else if (c.max && c.count === 1) title = "MAX POWER YEET!";
    bannerTitle.textContent = title;
    bannerDetail.textContent = `${c.name} → ${fmtKm(c.best)}`;
    bannerWhere.textContent = whereLanded(c.best);
    banner.classList.remove("show");
    void banner.offsetWidth; // restart the animation
    banner.classList.add("show");
  }

  function yeetDistanceKm(e, power, crit) {
    // Wildly unrealistic on purpose: a tap reaches across town, a full
    // charge reaches other continents, a critical one can reach the moon.
    const exp = rand(-0.2, 0.75) + power * 3.4 - Math.log10(1 + e.mass) * 0.35;
    return Math.pow(10, exp) * (crit ? rand(25, 60) : 1);
  }

  // ---------------------------------------------------------------------------
  // Yeeting
  // ---------------------------------------------------------------------------
  const tmpV = new T.Vector3();

  function yeet(e, dirX, dirZ, power, chained) {
    if (e.state === "fly" || e.state === "gone") return;
    e.state = "fly";
    e.t = 0;
    const spread = rand(-0.3, 0.3);
    const cs = Math.cos(spread);
    const sn = Math.sin(spread);
    const dx = dirX * cs - dirZ * sn;
    const dz = dirX * sn + dirZ * cs;
    const heavy = e.kind === "building" ? 0.6 : 1;
    const hSpeed = (55 + power * 85 + rand(0, 25)) * heavy;
    const vSpeed = (30 + power * 45 + rand(0, 20)) * heavy;
    e.vel.set(dx * hSpeed, vSpeed, dz * hSpeed);
    e.spin.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(6, 16) * (e.kind === "building" ? 0.3 : 1));
    if (e.collider) e.collider.on = false;
    if (e.kind === "person") sfx.scream();

    const crit = !chained && Math.random() < 0.07 + power * 0.08;
    const km = yeetDistanceKm(e, power, crit);
    e.km = km;
    stats.yeets += 1;
    stats.total += km;
    const name = e.name;
    if (!stats.best || km > stats.best.km) {
      stats.best = { km, name };
      storage.set(stats.best);
    }
    renderStats();

    const now = performance.now();
    if (!swingCombo || now - swingCombo.time > 1500) {
      swingCombo = { count: 0, best: 0, name: "", crit: false, max: false, time: now };
    }
    swingCombo.count += 1;
    if (km > swingCombo.best) {
      swingCombo.best = km;
      swingCombo.name = name;
    }
    swingCombo.crit = swingCombo.crit || crit;
    swingCombo.max = swingCombo.max || power > 0.95;
    showBanner();
  }

  function fistPoint(out) {
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    return out.set(player.pos.x + fx * 2.0, 1.3, player.pos.z + fz * 2.0);
  }

  function impact(power) {
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const fist = fistPoint(new T.Vector3());
    const reach = 2.4 + power * 2.8;
    let hits = 0;
    for (const e of entities) {
      if (e.state === "fly" || e.state === "gone" || e.state === "rising") continue;
      let dx;
      let dz;
      if (e.collider) {
        const c = e.collider;
        dx = clamp(fist.x, c.minX, c.maxX) - fist.x;
        dz = clamp(fist.z, c.minZ, c.maxZ) - fist.z;
        if (Math.hypot(dx, dz) > reach) continue;
      } else {
        const p = e.group.position;
        dx = p.x - fist.x;
        dz = p.z - fist.z;
        if (Math.hypot(dx, dz) - e.radius > reach) continue;
        // Only things in front of the hero, give or take.
        const px = p.x - player.pos.x;
        const pz = p.z - player.pos.z;
        const pd = Math.hypot(px, pz);
        if (pd > 1.2 && (px * fx + pz * fz) / pd < 0.15) continue;
      }
      yeet(e, fx, fz, power, false);
      hits += 1;
    }
    sfx.whoosh(power);
    if (hits > 0) {
      sfx.thump(power);
      burst(fist, 14 + Math.round(power * 16), power);
      shake = 0.35 + power * 0.6;
      hitStop = 0.05 + power * 0.07;
      fovKick = 6 + power * 10;
    } else {
      shake = Math.max(shake, 0.08);
    }
    // Everyone nearby panics.
    for (const e of entities) {
      if (!e.ai || e.ai.panic === undefined || e.state !== "idle") continue;
      if (e.group.position.distanceTo(player.pos) < 22) e.ai.panic = rand(2, 3.5);
    }
  }

  function startCharge() {
    if (!started) return;
    initAudio();
    if (player.charging || (player.swingT >= 0 && player.swingT < 0.3)) return;
    player.charging = true;
    player.charge = 0;
  }
  function releaseCharge() {
    if (!player.charging) return;
    player.charging = false;
    player.swingCharge = clamp(player.charge / CHARGE_TIME, 0, 1);
    player.swingT = 0;
    player.hitDone = false;
    player.lunge = 9 + player.swingCharge * 8;
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const keys = new Set();
  let started = false;
  let locked = false;
  let lockFailed = false;
  const overlay = document.getElementById("overlay");
  const hint = document.getElementById("hint");
  const chargeEl = document.getElementById("charge");
  const chargeFill = document.getElementById("charge-fill");
  const muteBtn = document.getElementById("mute");
  const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isTouch) document.body.classList.add("touch");

  function setHint() {
    if (!started) hint.textContent = "";
    else if (isTouch) hint.textContent = "";
    else if (!locked && !lockFailed) hint.textContent = "Click to grab the mouse for looking around";
    else if (!locked) hint.textContent = "Drag to look around";
    else hint.textContent = "Esc releases the mouse";
  }

  document.getElementById("start").addEventListener("click", (ev) => {
    ev.stopPropagation();
    started = true;
    overlay.classList.add("hidden");
    initAudio();
    if (audio && audio.state === "suspended") audio.resume();
    if (!isTouch) requestLock();
    setHint();
    window.focus();
  });

  function requestLock() {
    if (lockFailed || !canvas.requestPointerLock) {
      lockFailed = true;
      return;
    }
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {
        lockFailed = true;
        setHint();
      });
    } catch {
      lockFailed = true;
    }
  }
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    setHint();
  });
  document.addEventListener("pointerlockerror", () => {
    lockFailed = true;
    setHint();
  });

  function toggleMute() {
    muted = !muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
  }
  muteBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleMute();
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) {
      if (ev.code === "Space") ev.preventDefault();
      return;
    }
    keys.add(ev.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.code)) ev.preventDefault();
    if (!started && (ev.code === "Enter" || ev.code === "Space")) {
      document.getElementById("start").click();
      return;
    }
    if (ev.code === "Space" || ev.code === "KeyJ" || ev.code === "KeyF") startCharge();
    if (ev.code === "KeyM") toggleMute();
  });
  window.addEventListener("keyup", (ev) => {
    keys.delete(ev.code);
    if (ev.code === "Space" || ev.code === "KeyJ" || ev.code === "KeyF") releaseCharge();
  });
  window.addEventListener("blur", () => {
    keys.clear();
    releaseCharge();
  });

  // Mouse
  let dragging = false;
  canvas.addEventListener("mousedown", (ev) => {
    if (!started || isTouch) return;
    if (!locked && !lockFailed) {
      requestLock();
      return;
    }
    if (ev.button === 0) startCharge();
    if (!locked) dragging = true;
  });
  window.addEventListener("mouseup", (ev) => {
    dragging = false;
    if (ev.button === 0) releaseCharge();
  });
  window.addEventListener("mousemove", (ev) => {
    if (!started) return;
    if (locked || dragging) {
      camYaw -= ev.movementX * 0.0028;
      camPitch = clamp(camPitch + ev.movementY * 0.0022, -0.05, 1.0);
    }
  });
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

  // Touch: a floating stick on the left half, look-drag on the right half.
  const stickEl = document.getElementById("stick");
  const knobEl = document.getElementById("knob");
  const yeetBtn = document.getElementById("yeet-btn");
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const look = { id: null, x: 0, y: 0 };
  canvas.addEventListener(
    "touchstart",
    (ev) => {
      ev.preventDefault();
      if (!started) return;
      initAudio();
      for (const t of ev.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && stick.id === null) {
          stick.id = t.identifier;
          stick.ox = t.clientX;
          stick.oy = t.clientY;
          stick.x = stick.y = 0;
          stickEl.style.left = `${t.clientX}px`;
          stickEl.style.top = `${t.clientY}px`;
          stickEl.classList.add("active");
          knobEl.style.transform = "translate(0px, 0px)";
        } else if (look.id === null) {
          look.id = t.identifier;
          look.x = t.clientX;
          look.y = t.clientY;
        }
      }
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchmove",
    (ev) => {
      ev.preventDefault();
      for (const t of ev.changedTouches) {
        if (t.identifier === stick.id) {
          let dx = t.clientX - stick.ox;
          let dy = t.clientY - stick.oy;
          const d = Math.hypot(dx, dy);
          if (d > 50) {
            dx = (dx / d) * 50;
            dy = (dy / d) * 50;
          }
          stick.x = dx / 50;
          stick.y = dy / 50;
          knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === look.id) {
          camYaw -= (t.clientX - look.x) * 0.006;
          camPitch = clamp(camPitch + (t.clientY - look.y) * 0.004, -0.05, 1.0);
          look.x = t.clientX;
          look.y = t.clientY;
        }
      }
    },
    { passive: false },
  );
  function endTouch(ev) {
    for (const t of ev.changedTouches) {
      if (t.identifier === stick.id) {
        stick.id = null;
        stick.x = stick.y = 0;
        stickEl.classList.remove("active");
      } else if (t.identifier === look.id) {
        look.id = null;
      }
    }
  }
  canvas.addEventListener("touchend", endTouch);
  canvas.addEventListener("touchcancel", endTouch);
  yeetBtn.addEventListener(
    "touchstart",
    (ev) => {
      ev.preventDefault();
      yeetBtn.classList.add("down");
      startCharge();
    },
    { passive: false },
  );
  const yeetUp = (ev) => {
    ev.preventDefault();
    yeetBtn.classList.remove("down");
    releaseCharge();
  };
  yeetBtn.addEventListener("touchend", yeetUp, { passive: false });
  yeetBtn.addEventListener("touchcancel", yeetUp, { passive: false });

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function updatePlayer(dt) {
    // Movement relative to the camera.
    let ix = 0;
    let iy = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) iy += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) iy -= 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
    if (stick.id !== null) {
      ix += stick.x;
      iy -= stick.y;
    }
    if (keys.has("KeyQ")) camYaw += 2.2 * dt;
    if (keys.has("KeyE")) camYaw -= 2.2 * dt;
    const mag = Math.min(1, Math.hypot(ix, iy));
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight") || (stick.id !== null && mag > 0.92);
    const busy = player.charging || (player.swingT >= 0 && player.swingT < SWING_TIME);
    let speed = (running ? RUN_SPEED : WALK_SPEED) * mag;
    if (player.charging) speed *= 0.45;

    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    let mx = 0;
    let mz = 0;
    if (mag > 0.01) {
      const n = Math.hypot(ix, iy);
      mx = (fx * iy - fz * ix) / n;
      mz = (fz * iy + fx * ix) / n;
    }
    player.vel.x = mx * speed;
    player.vel.z = mz * speed;

    // Face where you're walking, or where the camera points when swinging.
    if (busy) player.yaw = lerpAngle(player.yaw, camYaw, Math.min(1, dt * 14));
    else if (mag > 0.01) player.yaw = lerpAngle(player.yaw, Math.atan2(mx, mz), Math.min(1, dt * 12));

    player.pos.x += player.vel.x * dt + Math.sin(player.yaw) * player.lunge * dt;
    player.pos.z += player.vel.z * dt + Math.cos(player.yaw) * player.lunge * dt;
    player.lunge = Math.max(0, player.lunge - dt * 60);
    player.pos.x = clamp(player.pos.x, -BOUND, BOUND);
    player.pos.z = clamp(player.pos.z, -BOUND, BOUND);
    pushOut(player.pos, 0.8);
    // Bump gently into props that are standing still.
    for (const e of entities) {
      if (e.collider || e.state !== "idle" || e.radius < 0.3) continue;
      const p = e.group.position;
      const dx = player.pos.x - p.x;
      const dz = player.pos.z - p.z;
      const min = e.radius + 0.7;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        player.pos.x = p.x + (dx / d) * min;
        player.pos.z = p.z + (dz / d) * min;
      }
    }

    // Charging and swinging.
    if (player.charging) player.charge = Math.min(CHARGE_TIME, player.charge + dt);
    const c = player.charging ? player.charge / CHARGE_TIME : 0;
    chargeEl.classList.toggle("show", player.charging);
    chargeFill.style.width = `${Math.round(c * 100)}%`;

    if (player.swingT >= 0) {
      player.swingT += dt;
      if (!player.hitDone && player.swingT >= IMPACT_AT) {
        player.hitDone = true;
        impact(player.swingCharge);
      }
      if (player.swingT > SWING_TIME) player.swingT = -1;
    }

    // Animation.
    const moving = Math.hypot(player.vel.x, player.vel.z);
    player.walk += dt * (moving > 0.1 ? 4 + moving * 0.7 : 0);
    const sw = moving > 0.1 ? Math.sin(player.walk) : 0;
    H.legL.rotation.x = sw * 0.7;
    H.legR.rotation.x = -sw * 0.7;
    H.armL.rotation.x = -sw * 0.6;
    H.body.position.y = moving > 0.1 ? Math.abs(Math.cos(player.walk)) * 0.12 : 0;

    let arm = sw * 0.15; // the big arm swings a little as he walks
    let twist = 0;
    let fistScale = 1;
    if (player.charging) {
      const wobble = Math.sin(performance.now() * 0.05) * 0.04 * c;
      arm = 0.6 + c * 1.0 + wobble;
      twist = -0.35 - c * 0.35;
      fistScale = 1 + c * 0.45;
      player.windAngle = arm;
    } else if (player.swingT >= 0) {
      const t = player.swingT;
      const strike = Math.min(1, t / IMPACT_AT);
      const ease = 1 - Math.pow(1 - strike, 3);
      const from = player.windAngle || 0.6;
      const peak = -2.1;
      if (t <= IMPACT_AT) arm = from + (peak - from) * ease;
      else arm = peak + (0 - peak) * Math.min(1, (t - IMPACT_AT) / (SWING_TIME - IMPACT_AT)) ** 2;
      twist = t <= IMPACT_AT ? -0.5 + 0.9 * ease : 0.4 * (1 - (t - IMPACT_AT) / (SWING_TIME - IMPACT_AT));
      fistScale = 1 + player.swingCharge * 0.45 * (1 - Math.min(1, t / SWING_TIME));
    } else {
      player.windAngle = 0;
    }
    H.armR.rotation.x = arm;
    H.armR.rotation.z = player.swingT >= 0 && player.swingT <= IMPACT_AT ? 0.2 : 0;
    H.torso.rotation.y = twist;
    H.fist.scale.setScalar(fistScale);
    H.fistMat.emissive.setRGB(c * 0.6, c * 0.25, 0);

    hero.position.copy(player.pos);
    hero.rotation.y = player.yaw;
  }

  function steerWalker(e, dt) {
    const ai = e.ai;
    const p = e.group.position;
    let vx = 0;
    let vz = 0;
    let speed = ai.speed;
    if (ai.panic > 0) {
      ai.panic -= dt;
      const dx = p.x - player.pos.x;
      const dz = p.z - player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      vx = dx / d;
      vz = dz / d;
      speed = ai.speed * 2.8;
    } else {
      const [tx, tz] = perim(ai.ring, ai.s + ai.dir * 2);
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) ai.s += ai.dir * 2;
      if (d > 0.01) {
        vx = dx / d;
        vz = dz / d;
      }
    }
    p.x = clamp(p.x + vx * speed * dt, -BOUND - 0.5, BOUND + 0.5);
    p.z = clamp(p.z + vz * speed * dt, -BOUND - 0.5, BOUND + 0.5);
    pushOut(p, e.radius);
    if (vx || vz) e.group.rotation.y = lerpAngle(e.group.rotation.y, Math.atan2(vx, vz), Math.min(1, dt * 10));

    e.phase += dt * speed * 3.2;
    const L = e.group.userData.limbs;
    const s = Math.sin(e.phase);
    L.legL.rotation.x = s * 0.6;
    L.legR.rotation.x = -s * 0.6;
    if (L.legL2) {
      L.legL2.rotation.x = -s * 0.6;
      L.legR2.rotation.x = s * 0.6;
      L.tail.rotation.y = Math.sin(e.phase * 2.5) * 0.6;
    }
    if (L.armL) {
      if (ai.panic > 0) {
        L.armL.rotation.set(0, 0, -2.6 + s * 0.3);
        L.armR.rotation.set(0, 0, 2.6 - s * 0.3);
      } else {
        L.armL.rotation.set(-s * 0.5, 0, 0);
        L.armR.rotation.set(s * 0.5, 0, 0);
      }
    }
  }

  function driveCar(e, dt) {
    const ai = e.ai;
    const p = e.group.position;
    const fx = Math.sin(e.group.rotation.y);
    const fz = Math.cos(e.group.rotation.y);
    // Brake for the hero and for cars ahead in the same lane.
    let blocked = false;
    const px = player.pos.x - p.x;
    const pz = player.pos.z - p.z;
    const ahead = px * fx + pz * fz;
    if (ahead > 0 && ahead < 8 && Math.abs(px * fz - pz * fx) < 2.2) blocked = "hero";
    if (!blocked) {
      for (const o of entities) {
        if (o === e || o.kind !== "car" || o.state !== "idle" || o.ai.lane !== ai.lane) continue;
        const ox = o.group.position.x - p.x;
        const oz = o.group.position.z - p.z;
        const a = ox * fx + oz * fz;
        if (a > 0 && a < 8 && Math.abs(ox * fz - oz * fx) < 2) {
          blocked = "car";
          break;
        }
      }
    }
    const target = blocked ? 0 : ai.max;
    ai.speed += clamp(target - ai.speed, -30 * dt, 8 * dt);
    if (blocked === "hero") {
      ai.blocked += dt;
      if (ai.blocked > 1.2 && performance.now() - ai.honked > 2500) {
        ai.honked = performance.now();
        sfx.honk();
      }
    } else {
      ai.blocked = 0;
    }
    ai.s += ai.lane.dir * ai.speed * dt;
    const [x, z] = perim(ai.lane.h, ai.s);
    const [nx, nz] = perim(ai.lane.h, ai.s + ai.lane.dir * 3);
    p.x = x;
    p.z = z;
    e.group.rotation.y = lerpAngle(e.group.rotation.y, Math.atan2(nx - x, nz - z), Math.min(1, dt * 6));
  }

  function respawn(e) {
    const g = e.group;
    g.visible = true;
    g.rotation.set(0, e.home.yaw, 0);
    g.scale.setScalar(1);
    e.vel.set(0, 0, 0);
    if (e.kind === "person" || e.kind === "dog") {
      // A fresh pedestrian wanders in from somewhere else on the loop.
      e.ai.s = rand(0, 8 * e.ai.ring);
      const [x, z] = perim(e.ai.ring, e.ai.s);
      g.position.set(x, 0, z);
      e.ai.panic = 0;
      if (e.kind === "person") e.name = pick(NAMES);
      for (const l of Object.values(g.userData.limbs)) l.rotation.set(0, 0, 0);
    } else if (e.kind === "car") {
      e.ai.s = rand(0, 8 * e.ai.lane.h);
      e.ai.speed = 0;
      const [x, z] = perim(e.ai.lane.h, e.ai.s);
      g.position.set(x, 0, z);
    } else {
      g.position.set(e.home.x, 0, e.home.z);
    }
    if (e.kind === "building") {
      e.state = "rising";
      e.t = 0;
      g.position.y = -e.height - 2;
      e.collider.on = true;
    } else {
      e.state = "popping";
      e.t = 0;
      g.scale.setScalar(0.01);
    }
  }

  function updateEntities(dt, now) {
    for (const e of entities) {
      const g = e.group;
      if (e.state === "idle") {
        if (e.kind === "person" || e.kind === "dog") steerWalker(e, dt);
        else if (e.kind === "car") driveCar(e, dt);
        else if (e.kind === "pigeon") {
          e.phase += dt;
          g.position.y = Math.max(0, Math.sin(e.phase * 3) * 0.08);
          if (Math.random() < dt * 0.6) g.rotation.y += rand(-1.2, 1.2);
        }
      } else if (e.state === "fly") {
        e.t += dt;
        e.vel.y -= GRAVITY * 0.35 * dt; // they barely come down, by design
        g.position.addScaledVector(e.vel, dt);
        g.rotation.x += e.spin.x * dt;
        g.rotation.y += e.spin.y * dt;
        g.rotation.z += e.spin.z * dt;
        const L = g.userData.limbs;
        if (L && L.armL) {
          const f = Math.sin(e.t * 28);
          L.armL.rotation.set(f, 0, -2.4);
          L.armR.rotation.set(-f, 0, 2.4);
          L.legL.rotation.x = f * 0.9;
          L.legR.rotation.x = -f * 0.9;
        }
        // Early in the flight, whatever it smacks into gets yeeted too.
        if (e.t < 0.7 && e.kind !== "pigeon") {
          for (const o of entities) {
            if (o === e || o.state !== "idle" || o.collider) continue;
            const op = o.group.position;
            if (g.position.y > o.height + e.radius) continue;
            const reach = o.radius + e.radius + 0.4;
            const dx = op.x - g.position.x;
            const dz = op.z - g.position.z;
            if (dx * dx + dz * dz < reach * reach) {
              const sp = Math.hypot(e.vel.x, e.vel.z) || 1;
              yeet(o, e.vel.x / sp, e.vel.z / sp, 0.5, true);
              burst(tmpV.copy(op).setY(1), 8, 0.3);
            }
          }
        }
        const far = Math.hypot(g.position.x - player.pos.x, g.position.z - player.pos.z);
        if (far > GONE_DIST || g.position.y > 160 || e.t > 6) {
          twinkle(g.position);
          e.state = "gone";
          g.visible = false;
          e.respawnAt = now + (e.kind === "building" ? RESPAWN_BUILDING : RESPAWN_PROP) * 1000 * rand(0.8, 1.3);
        }
      } else if (e.state === "gone") {
        if (now >= e.respawnAt) {
          // Props don't pop back in on top of the hero.
          const d = Math.hypot(e.home.x - player.pos.x, e.home.z - player.pos.z);
          if (e.ai || e.kind === "building" || d > e.radius + 2) respawn(e);
        }
      } else if (e.state === "popping") {
        e.t += dt;
        const k = Math.min(1, e.t / 0.35);
        g.scale.setScalar(Math.max(0.01, k) * (1 + Math.sin(k * Math.PI) * 0.25));
        if (k >= 1) {
          g.scale.setScalar(1);
          e.state = "idle";
        }
      } else if (e.state === "rising") {
        e.t += dt;
        const k = Math.min(1, e.t / 1.8);
        g.position.y = (-e.height - 2) * (1 - k) * (1 - k);
        g.position.x = e.home.x + (k < 1 ? rand(-0.15, 0.15) : 0);
        if (k >= 1) e.state = "idle";
      }
    }
  }

  function updateFx(dt) {
    for (const p of debris) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 9;
      p.mesh.rotation.y += dt * 7;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vel.y *= -0.4;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (let i = twinkles.length - 1; i >= 0; i--) {
      const tw = twinkles[i];
      tw.t += dt;
      const k = tw.t / 0.9;
      const size = 9 * Math.sin(Math.min(1, k) * Math.PI) + 1;
      tw.sprite.scale.set(size, size, 1);
      tw.sprite.material.rotation = tw.t * 4;
      tw.sprite.material.opacity = 1 - Math.max(0, k - 0.6) / 0.4;
      if (k >= 1) {
        scene.remove(tw.sprite);
        tw.sprite.material.dispose();
        twinkles.splice(i, 1);
      }
    }
  }

  function updateCamera(dt) {
    const target = tmpV.set(player.pos.x, 2.4 + H.body.position.y, player.pos.z);
    const dist = 9.5;
    const cp = Math.cos(camPitch);
    const desired = new T.Vector3(
      target.x - Math.sin(camYaw) * dist * cp,
      target.y + Math.sin(camPitch) * dist + 1.2,
      target.z - Math.cos(camYaw) * dist * cp,
    );
    desired.y = Math.max(0.6, desired.y);
    camPos.lerp(desired, Math.min(1, dt * 12));
    camera.position.copy(camPos);
    if (shake > 0) {
      camera.position.x += rand(-1, 1) * shake;
      camera.position.y += rand(-1, 1) * shake;
      camera.position.z += rand(-1, 1) * shake;
      shake = Math.max(0, shake - dt * 2.2);
    }
    camera.lookAt(target.x + Math.sin(camYaw) * 3, target.y + 0.4, target.z + Math.cos(camYaw) * 3);
    fovKick = Math.max(0, fovKick - dt * 30);
    const fov = (camera.aspect < 1 ? 74 : 62) + fovKick; // wider in portrait
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    sun.position.set(player.pos.x + 30, 60, player.pos.z + 20);
    sun.target.position.set(player.pos.x, 0, player.pos.z);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let last = performance.now();
  camPos.set(player.pos.x - Math.sin(camYaw) * 9, 5, player.pos.z - Math.cos(camYaw) * 9);
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (hitStop > 0) {
      hitStop -= dt;
      dt *= 0.08;
    }
    if (started) updatePlayer(dt);
    else {
      camYaw += dt * 0.15; // slow attract-mode orbit behind the title
      hero.position.copy(player.pos);
      hero.rotation.y = player.yaw;
    }
    updateEntities(dt, now);
    updateFx(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Exposed for automated smoke tests; harmless in play.
  window.__streetYeet = { entities, player, stats, yeet };
})();
