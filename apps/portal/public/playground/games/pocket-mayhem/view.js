/* Procedural toybox artwork. All meshes and textures are made locally. */
(function (root) {
  'use strict';
  const T = root.THREE;
  class View {
    constructor(canvas, { reducedMotion = false } = {}) {
      this.reducedMotion = reducedMotion;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.scene = new T.Scene();
      this.scene.background = new T.Color('#112634');
      this.scene.fog = new T.Fog('#112634', 55, 115);
      this.camera = new T.OrthographicCamera(-24, 24, 18, -18, .1, 150);
      this.scene.add(new T.HemisphereLight('#def6f3', '#35475d', 1.8));
      const sun = new T.DirectionalLight('#fff3d6', 2.5);
      sun.position.set(-15, 25, 18); this.scene.add(sun);
      const rim = new T.DirectionalLight('#a4baff', 1.1);
      rim.position.set(20, 10, -20); this.scene.add(rim);
      this.dummy = new T.Object3D();
      this.color = new T.Color();
      this.follow = new T.Vector3();
      this.look = new T.Vector3();
      this.particles = [];
      this.rings = [];
      this.lines = [];
      this.shake = 0;
      this.visualTime = 0;
      this.buildArena();
      this.robot = this.makeRobot();
      this.scene.add(this.robot);
      const solid = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .37, metalness: .06 });
      const glow = new T.MeshBasicMaterial({ color: '#ffffff' });
      this.bodies = this.batch(new T.BoxGeometry(1, 1, 1), solid, 110);
      this.heads = this.batch(new T.BoxGeometry(1, 1, 1), solid, 110);
      this.eyes = this.batch(new T.BoxGeometry(1, 1, 1), glow, 220);
      this.feet = this.batch(new T.BoxGeometry(1, 1, 1), solid, 220);
      this.shadow = this.batch(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: '#071923', transparent: true, opacity: .32, depthWrite: false }), 112);
      this.pop = this.batch(new T.SphereGeometry(1, 7, 5), new T.MeshBasicMaterial({ color: '#f1ffac' }), 145);
      this.rockets = this.batch(new T.ConeGeometry(.24, .8, 6), new T.MeshStandardMaterial({ color: '#ffb279', emissive: '#ff6633', emissiveIntensity: .5 }), 40);
      this.hostile = this.batch(new T.SphereGeometry(.26, 8, 6), new T.MeshBasicMaterial({ color: '#ff746f' }), 185);
      this.gems = this.batch(new T.OctahedronGeometry(.18), new T.MeshStandardMaterial({ color: '#ffffff', roughness: .2, metalness: .2, emissive: '#6bbdce', emissiveIntensity: .3 }), 240);
      this.saw = this.batch(new T.CylinderGeometry(.48, .48, .13, 8), new T.MeshStandardMaterial({ color: '#c9a0ff', metalness: .4, roughness: .2, emissive: '#5a2c95', emissiveIntensity: .3 }), 8);
      this.bits = this.batch(new T.BoxGeometry(.13, .13, .13), glow, 350);
      this.warnings = this.batch(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: '#ff8470', transparent: true, opacity: .3, depthWrite: false, side: T.DoubleSide }), 110);
      this.warnRings = this.batch(new T.RingGeometry(.88, 1, 48), new T.MeshBasicMaterial({ color: '#ff756b', transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false }), 5);
      this.playerRing = new T.Mesh(new T.RingGeometry(.85, 1.04, 40), new T.MeshBasicMaterial({ color: '#d5f67d', transparent: true, opacity: .65, side: T.DoubleSide, depthWrite: false }));
      this.playerRing.rotation.x = -Math.PI / 2; this.playerRing.position.y = .06; this.scene.add(this.playerRing);
      this.shield = new T.Mesh(new T.SphereGeometry(1.02, 16, 12), new T.MeshBasicMaterial({ color: '#a5ecff', transparent: true, opacity: .12, depthWrite: false, wireframe: true }));
      this.scene.add(this.shield);
      this.resize();
    }

    material(color, roughness = .6) { return new T.MeshStandardMaterial({ color, roughness }); }
    mesh(geometry, material, x, y, z, parent = this.scene) {
      const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    }
    box(x, y, z, w, h, d, color, parent) { return this.mesh(new T.BoxGeometry(w, h, d), this.material(color), x, y, z, parent); }
    batch(geometry, material, count) {
      const mesh = new T.InstancedMesh(geometry, material, count);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; this.scene.add(mesh); return mesh;
    }
    place(batch, i, x, y, z, sx = 1, sy = 1, sz = 1, angle = 0, color, flat = false) {
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(flat ? -Math.PI / 2 : 0, flat ? 0 : angle, flat ? angle : 0);
      this.dummy.scale.set(sx, sy, sz); this.dummy.updateMatrix(); batch.setMatrixAt(i, this.dummy.matrix);
      if (color) batch.setColorAt(i, this.color.set(color));
    }
    finish(batch, count) { batch.count = count; batch.instanceMatrix.needsUpdate = true; if (batch.instanceColor) batch.instanceColor.needsUpdate = true; }

    buildArena() {
      this.box(0, -.75, 0, 100, .8, 100, '#112634');
      this.box(0, -.25, 0, 50, .6, 50, '#1f4858');
      this.box(0, -.06, 0, 47.8, .3, 47.8, '#1c414e');
      const grid = new T.GridHelper(48, 24, '#719f9a', '#568887'); grid.position.y = .105;
      grid.material.transparent = true; grid.material.opacity = .15; this.scene.add(grid);
      const colors = ['#d2e29a', '#df9bab', '#9fbce1', '#9fd9cb'];
      for (let i = -5; i <= 5; i++) {
        const c = colors[(i + 8) % colors.length];
        this.box(i * 4.5, .24, -24.5, 4.35, .45, .65, c);
        this.box(i * 4.5, .24, 24.5, 4.35, .45, .65, c);
        this.box(-24.5, .24, i * 4.5, .65, .45, 4.35, c);
        this.box(24.5, .24, i * 4.5, .65, .45, 4.35, c);
      }
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext('2d'); ctx.textAlign = 'center'; ctx.fillStyle = '#abc9b1'; ctx.globalAlpha = .17;
      ctx.font = '900 140px Arial'; ctx.fillText('POCKET', 512, 410); ctx.fillText('MAYHEM', 512, 550);
      ctx.font = '700 27px Arial'; ctx.fillText('SMALL ROBOT. BIG PROBLEMS.', 512, 630);
      ctx.strokeStyle = '#c1dbbb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(512, 500, 410, 0, Math.PI * 2); ctx.stroke();
      const stamp = this.mesh(new T.PlaneGeometry(26, 26), new T.MeshBasicMaterial({ map: new T.CanvasTexture(canvas), transparent: true, depthWrite: false }), 0, .115, 0);
      stamp.rotation.x = -Math.PI / 2;
      // Toys outside the playable border give the arena a tabletop scale.
      for (const [x, z, c] of [[-29, -14, '#d4a7d8'], [29, 11, '#99c6db'], [-27, 22, '#e8b07d'], [20, -29, '#bdd789'], [-8, -29, '#df99a0'], [27, -22, '#e8ca89']]) {
        const group = new T.Group(); group.position.set(x, 0, z); group.rotation.y = x * .2; this.scene.add(group);
        this.box(0, .85, 0, 3, 1.7, 3, c, group);
        this.box(.3, 2.2, -.2, 2.3, 1.1, 2.3, '#a5beb8', group);
        const top = this.mesh(new T.TorusGeometry(.8, .22, 8, 16), this.material(c), .3, 3.15, -.2, group); top.rotation.x = Math.PI / 2;
      }
      for (const [x, z] of [[-19, -19], [19, 19], [-19, 19], [19, -19]]) {
        const ring = this.mesh(new T.RingGeometry(1.9, 2.02, 40), new T.MeshBasicMaterial({ color: '#b4d1b1', transparent: true, opacity: .24, side: T.DoubleSide }), x, .12, z);
        ring.rotation.x = -Math.PI / 2;
      }
    }

    makeRobot() {
      const group = new T.Group();
      this.robotBody = this.box(0, .83, 0, .9, .9, .66, '#d5f67d', group);
      this.robotHead = this.box(0, 1.38, .04, 1.04, .58, .76, '#e0f69b', group);
      this.box(0, 1.38, .435, .78, .3, .045, '#192e3b', group);
      const eyes = new T.MeshBasicMaterial({ color: '#f5ffdc' });
      this.mesh(new T.BoxGeometry(.14, .1, .045), eyes, -.22, 1.4, .47, group);
      this.mesh(new T.BoxGeometry(.14, .1, .045), eyes, .22, 1.4, .47, group);
      this.box(-.6, .92, 0, .22, .5, .28, '#657d74', group);
      this.box(.6, .92, .15, .24, .5, .5, '#657d74', group);
      this.gun = this.box(.62, 1.03, .43, .24, .22, .52, '#f0d88d', group);
      this.leftFoot = this.box(-.25, .25, .04, .36, .35, .52, '#193440', group);
      this.rightFoot = this.box(.25, .25, .04, .36, .35, .52, '#193440', group);
      this.mesh(new T.CylinderGeometry(.025, .025, .26, 6), this.material('#a3c9bc'), 0, 1.83, 0, group);
      this.antenna = this.mesh(new T.SphereGeometry(.085, 8, 6), new T.MeshBasicMaterial({ color: '#d5f67d' }), 0, 2.01, 0, group);
      return group;
    }

    resize() {
      const width = this.renderer.domElement.clientWidth || innerWidth, height = this.renderer.domElement.clientHeight || innerHeight;
      this.renderer.setSize(width, height, false);
      const aspect = width / height, vertical = aspect < 1 ? 22 / aspect : 29;
      this.camera.left = -vertical * aspect / 2; this.camera.right = vertical * aspect / 2;
      this.camera.top = vertical / 2; this.camera.bottom = -vertical / 2; this.camera.updateProjectionMatrix();
    }

    event(event) {
      if (event.type === 'hurt') this.shake = this.reducedMotion ? 0 : .35;
      if (event.type === 'surge' || event.type === 'bossDown') this.shake = this.reducedMotion ? 0 : .55;
      if (event.type === 'ring') {
        const mesh = this.mesh(new T.RingGeometry(.88, 1, 48), new T.MeshBasicMaterial({ color: event.color, transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }), event.x, .2, event.z);
        mesh.rotation.x = -Math.PI / 2; this.rings.push({ mesh, radius: event.radius, life: .5, max: .5 });
      }
      if (event.type === 'burst' || event.type === 'dash' || event.type === 'critical') {
        const count = this.reducedMotion ? 3 : event.type === 'burst' ? 16 : 6;
        for (let i = 0; i < count && this.particles.length < 340; i++) {
          const a = Math.random() * Math.PI * 2, speed = (event.size || 1) * (2 + Math.random() * 4);
          this.particles.push({ x: event.x, y: .7, z: event.z, vx: Math.sin(a) * speed, vy: 2 + Math.random() * 4, vz: Math.cos(a) * speed, life: .4 + Math.random() * .4, max: .8, color: event.color || '#eaffad' });
        }
      }
      if (event.type === 'lightning') {
        const vertices = [];
        for (let i = 0; i <= 5; i++) {
          const t = i / 5, wiggle = i && i < 5 ? (Math.random() - .5) * .8 : 0;
          vertices.push(event.x + (event.tx - event.x) * t + wiggle, .9, event.z + (event.tz - event.z) * t + wiggle);
        }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        const line = new T.Line(geometry, new T.LineBasicMaterial({ color: '#a2fff1', transparent: true, opacity: 1 }));
        this.scene.add(line); this.lines.push({ mesh: line, life: .16 });
      }
    }

    draw(game, dt, { attract = false, moving = false } = {}) {
      this.visualTime += dt;
      const t = this.visualTime, p = game.player, palette = PocketEngine.PILOTS[game.pilot].color;
      this.robotBody.material.color.set(palette); this.robotHead.material.color.set(palette);
      this.robot.position.set(attract ? 8 : p.x, Math.sin(t * (moving ? 16 : 3)) * (moving ? .07 : .03), attract ? 3 : p.z);
      this.robot.rotation.y = attract ? Math.sin(t * .3) * .4 + .5 : p.angle;
      this.robot.scale.setScalar(attract ? 3.3 : 1);
      this.robot.visible = attract || p.invincible <= 0 || p.dash > 0 || Math.floor(t * 18) % 2 === 0;
      this.leftFoot.position.z = .04 + (moving ? Math.sin(t * 16) * .18 : 0);
      this.rightFoot.position.z = .04 - (moving ? Math.sin(t * 16) * .18 : 0);
      this.playerRing.position.set(this.robot.position.x, .13, this.robot.position.z);
      this.playerRing.scale.setScalar(attract ? 3.4 : p.surge > 0 ? 1.35 : 1);
      this.playerRing.material.color.set(p.surge > 0 ? '#fcf5a3' : palette);
      this.shield.visible = !attract && p.shield > 0;
      this.shield.position.set(p.x, .95, p.z); this.shield.rotation.y = t * .4;
      this.follow.lerp(new T.Vector3(attract ? 0 : p.x * .82, 0, attract ? 0 : p.z * .82), Math.min(1, dt * 5));
      this.shake = Math.max(0, this.shake - dt * 1.8);
      const sx = (Math.random() - .5) * this.shake, sz = (Math.random() - .5) * this.shake;
      this.camera.position.set(this.follow.x + sx, 28, this.follow.z + 29 + sz);
      this.camera.lookAt(this.follow.x, 0, this.follow.z - 2);
      let body = 0, head = 0, eye = 0, feet = 0, shadow = 0, warning = 0, warnRing = 0;
      this.place(this.shadow, shadow++, this.robot.position.x, .14, this.robot.position.z, attract ? 1.9 : .75, attract ? 1.9 : .75, 1, 0, undefined, true);
      for (const e of game.enemies) {
        if (body >= 110) break;
        const type = e.type, boss = type === 'boss', crate = type === 'crate';
        const radius = e.radius, size = boss ? 3.3 : radius * 1.6;
        const grow = attract ? 1 : Math.max(.08, 1 - e.spawn / (boss ? 1.6 : .8));
        const bob = crate ? 0 : Math.abs(Math.sin((attract ? t : game.time) * (type === 'skitter' ? 15 : 7) + e.id)) * .11;
        const color = e.flash > 0 && !attract ? '#fff8d5' : PocketEngine.TYPES[type].color;
        const angle = attract ? e.id * 2.4 + t * .1 : e.angle;
        this.place(this.shadow, shadow++, e.x, .14, e.z, radius * 1.1, radius * 1.1, 1, 0, undefined, true);
        const height = crate ? 1.0 : boss ? 2.6 : type === 'bruiser' ? 1.35 : type === 'skitter' ? .42 : .75;
        this.place(this.bodies, body++, e.x, height * grow / 2 + .22 + bob, e.z, size * grow, height * grow, size * grow * .83, angle, color);
        if (crate) {
          this.place(this.heads, head++, e.x, 1.05 * grow, e.z, .18, .08, 1.1, angle, '#f3ffcf');
          this.place(this.eyes, eye++, e.x, 1.1 * grow, e.z, .8, .07, .18, angle, '#f3ffcf');
          continue;
        }
        const sn = Math.sin(angle), cs = Math.cos(angle), face = size * .425;
        this.place(this.heads, head++, e.x + sn * face, height * .73 * grow + .25 + bob, e.z + cs * face, size * .72 * grow, height * .31 * grow, .08 * grow, angle, '#233647');
        for (const side of [-1, 1]) {
          this.place(this.eyes, eye++, e.x + sn * (face + .05) + cs * size * .19 * side, height * .75 * grow + .25 + bob, e.z + cs * (face + .05) - sn * size * .19 * side, size * .12 * grow, height * .11 * grow, .08, angle, boss ? '#ffed9a' : '#fff4d3');
          this.place(this.feet, feet++, e.x + cs * size * .27 * side, .21 + Math.max(0, Math.sin(t * 10 + side * Math.PI + e.id) * .07), e.z - sn * size * .27 * side, size * .26, .29 * grow, size * .5, angle, '#263b4b');
        }
        if (!attract && e.mode === 'warn') {
          if (boss) this.place(this.warnRings, warnRing++, e.x, .16, e.z, 4.7, 4.7, 1, 0, undefined, true);
          else {
            const dx = type === 'charger' ? e.dx : (p.x - e.x) / (Math.hypot(p.x - e.x, p.z - e.z) || 1);
            const dz = type === 'charger' ? e.dz : (p.z - e.z) / (Math.hypot(p.x - e.x, p.z - e.z) || 1);
            this.place(this.warnings, warning++, e.x + dx * 4, .155, e.z + dz * 4, type === 'charger' ? 1.2 : .16, 8, 1, -Math.atan2(dx, dz), undefined, true);
          }
        }
      }
      for (const [batch, count] of [[this.bodies, body], [this.heads, head], [this.eyes, eye], [this.feet, feet], [this.shadow, shadow], [this.warnings, warning], [this.warnRings, warnRing]]) this.finish(batch, count);
      let pop = 0, rockets = 0;
      for (const shot of game.shots) {
        if (shot.type === 'rocket') {
          if (rockets >= 40) continue;
          this.dummy.position.set(shot.x, 1.05, shot.z); this.dummy.rotation.set(Math.PI / 2, 0, -Math.atan2(shot.vx, shot.vz)); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.rockets.setMatrixAt(rockets++, this.dummy.matrix);
        } else if (pop < 145) this.place(this.pop, pop++, shot.x, .95, shot.z, .15, .15, .28, Math.atan2(shot.vx, shot.vz));
      }
      this.finish(this.pop, pop); this.finish(this.rockets, rockets);
      let hostile = 0;
      for (const b of game.bullets) if (hostile < 185) this.place(this.hostile, hostile++, b.x, .8, b.z);
      this.finish(this.hostile, hostile);
      let gems = 0;
      for (const gem of game.gems) {
        if (gems >= 240) break;
        const s = gem.kind === 'xp' ? Math.min(2, .9 + Math.sqrt(gem.value) * .15) : 2.2;
        this.place(this.gems, gems++, gem.x, .38 + Math.sin(t * 3 + gem.id) * .1, gem.z, s, s, s, t, gem.kind === 'xp' ? '#9df4f2' : gem.kind === 'heal' ? '#ffa3b4' : '#e7ff91');
      }
      this.finish(this.gems, gems);
      const saws = game.saws();
      saws.forEach((s, i) => this.place(this.saw, i, s.x, .85, s.z, 1, 1, 1, t * 8)); this.finish(this.saw, saws.length);
      this.particles = this.particles.filter(bit => bit.life > 0);
      this.particles.forEach((bit, i) => {
        bit.life -= dt; bit.x += bit.vx * dt; bit.z += bit.vz * dt; bit.y += bit.vy * dt; bit.vy -= dt * 12;
        const s = Math.max(.02, bit.life / bit.max * 1.8);
        this.place(this.bits, i, bit.x, Math.max(.16, bit.y), bit.z, s, s, s, bit.life * 8, bit.color);
      }); this.finish(this.bits, this.particles.length);
      for (const ring of this.rings) {
        ring.life -= dt; const s = ring.radius * (1 - ring.life / ring.max);
        ring.mesh.scale.setScalar(s); ring.mesh.material.opacity = Math.max(0, ring.life / ring.max * .8);
      }
      for (const line of this.lines) { line.life -= dt; line.mesh.material.opacity = Math.max(0, line.life / .16); }
      for (const list of [this.rings, this.lines]) {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) {
          this.scene.remove(list[i].mesh); list[i].mesh.geometry.dispose(); list[i].mesh.material.dispose(); list.splice(i, 1);
        }
      }
      this.renderer.render(this.scene, this.camera);
    }
  }
  root.PocketView = View;
})(globalThis);
