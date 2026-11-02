(function (G) {
  'use strict';

  // Efectos del jefe final (diseño propio):
  //  - Paredes derribadas: el hongomorfo atraviesa las paredes interiores del salón recreativo. El trozo de pared
  //    desaparece del todo y salen cascotes y polvo; los cascotes se quedan unos 5-6 s en el suelo y se van.
  //  - Trozos de hongo: se arranca bultos del cuerpo y los lanza en parábola; al caer revientan en una nube de
  //    esporas más grande, que dura más y hace más daño que la del temblante.
  //  - Los huecos que quedan sirven de escondite al blindado (hideBonus).

  const U = G.Util;
  const GRAV = 9.8;
  let scene = null;
  const debris = [], dust = [], chunks = [], holes = [];
  let boxGeo = null, dustTex = null;
  const mats = {};
  const mat = (hex) => mats[hex] || (mats[hex] = new THREE.MeshLambertMaterial({ color: hex }));

  function init(sc) { scene = sc; }

  function dustTexture() {
    if (dustTex) return dustTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(170,160,150,0.85)'); g.addColorStop(0.6, 'rgba(130,122,114,0.4)'); g.addColorStop(1, 'rgba(110,104,98,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    dustTex = new THREE.CanvasTexture(c);
    return dustTex;
  }

  // ---------- Paredes ----------
  // centro de una arista y su normal (hacia dónde atraviesa)
  const edgeMid = (ref) => (ref.o === 'N' ? { x: ref.x + 0.5, z: ref.z } : { x: ref.x, z: ref.z + 0.5 });

  // Derriba la arista ref y las vecinas en la misma línea (half a cada lado). ux, uz: hacia dónde salen los
  // cascotes. Devuelve cuántas cayeron
  function breakAround(ref, half, ux, uz, quiet) {
    const W = G.World;
    let n = 0;
    const done = [];
    for (let k = -half; k <= half; k++) {
      const r = ref.o === 'N' ? { o: 'N', x: ref.x + k, z: ref.z, lv: 0 } : { o: 'W', x: ref.x, z: ref.z + k, lv: 0 };
      if (!W.breakableEdge(r)) continue;
      const wallHex = wallColor(r);
      if (W.breakWall(r)) { n++; done.push({ r, wallHex }); }
    }
    if (!n) return 0;
    for (const d of done) {
      const m = edgeMid(d.r);
      holes.push({ x: m.x, z: m.z });
      spawnDebris(m.x, m.z, d.r.o, ux, uz, d.wallHex);
    }
    const c = edgeMid(ref);
    W.emit(c.x, c.z, 26, 0);
    // una pared de fuera: se abre el exterior
    const out = done.find((d) => W.outerEdge(d.r));
    if (out && G.Mode && G.Mode.onExteriorOpen) { const m = edgeMid(out.r); G.Mode.onExteriorOpen(m.x, m.z, ux, uz); }
    if (!quiet) {
      if (G.Audio) G.Audio.play('wallBreak', { x: c.x, z: c.z, lv: 0, big: n >= 3 });
      const cp = G.Camera.pos, dc = cp ? Math.hypot(cp.x - c.x, cp.z - c.z) : 8;
      if (G.Camera.shake) G.Camera.shake(Math.max(0.2, Math.min(0.9, 1.1 - dc / 14)));
    }
    return n;
  }
  function wallColor(ref) {
    const W = G.World;
    const r = W.roomAt(ref.x, ref.z, 0) || W.roomAt(ref.o === 'N' ? ref.x : ref.x - 1, ref.o === 'N' ? ref.z - 1 : ref.z, 0);
    return r && r.wall ? r.wall : 0x6a6460;
  }

  // ¿Hay una pared que se pueda derribar justo delante (de p hacia u, a menos de "ahead" m)? Devuelve la arista
  function wallAhead(x, z, ux, uz, ahead) {
    const W = G.World;
    const x1 = x + ux * ahead, z1 = z + uz * ahead;
    const f = W.lineHit(x, z, x1, z1, (e) => e !== W.E.NONE, 0);     // (una puerta abierta tampoco le deja pasar)
    if (f < 0) return null;
    const px = x + (x1 - x) * f, pz = z + (z1 - z) * f;
    const ref = W.edgeAt(px, pz, ux, uz, 0);
    return ref && W.breakableEdge(ref) ? ref : null;
  }
  // la embestida del hongomorfo choca contra una pared: la atraviesa (3 o 4 tramos)
  function smash(x, z, ux, uz) {
    const ref = wallAhead(x, z, ux, uz, 1.3);
    if (!ref) return 0;
    return breakAround(ref, Math.random() < 0.5 ? 1 : 2, ux, uz);
  }

  function spawnDebris(x, z, o, ux, uz, wallHex) {
    if (!scene) return;
    if (!boxGeo) boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cols = [wallHex, U.shade(wallHex, 0.7), 0x6e6862, 0x56514c, 0x3e3a36];
    for (let i = 0; i < 7; i++) {
      const s = 0.07 + Math.random() * 0.17;
      const m = new THREE.Mesh(boxGeo, mat(cols[i % cols.length]));
      m.scale.set(s * (0.8 + Math.random() * 0.8), s * (0.6 + Math.random() * 0.6), s * (0.8 + Math.random() * 0.8));
      const along = (Math.random() - 0.5) * 0.9;
      m.position.set(x + (o === 'N' ? along : 0), 0.3 + Math.random() * 2.6, z + (o === 'N' ? 0 : along));
      m.castShadow = false; m.receiveShadow = false;
      scene.add(m);
      const sp = 2.5 + Math.random() * 4.5;
      debris.push({ m, vx: ux * sp + (Math.random() - 0.5) * 2.5, vz: uz * sp + (Math.random() - 0.5) * 2.5, vy: 1 + Math.random() * 3.5,
        wx: (Math.random() - 0.5) * 12, wz: (Math.random() - 0.5) * 12, t: 0, life: 5 + Math.random() * 1.2, s0: m.scale.clone(), rest: false });
    }
    // polvo
    const tex = dustTexture();
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.7 }));
      sp.position.set(x + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 2.2, z + (Math.random() - 0.5) * 0.8);
      sp.scale.setScalar(0.8);
      scene.add(sp);
      dust.push({ sp, vx: ux * (0.6 + Math.random()) + (Math.random() - 0.5), vz: uz * (0.6 + Math.random()) + (Math.random() - 0.5), t: 0, life: 1.6 + Math.random() * 1.2 });
    }
  }

  // ---------- Trozos de hongo lanzados ----------
  // z: quien lanza (sale de su mano derecha), (tx, tz): a dónde. opts: nube más fuerte y larga
  const CHUNK_COL = [0xc98a5e, 0xb87650, 0xd9a274, 0x9a5a3c];
  const _hp = new THREE.Vector3();
  function throwChunk(z, tx, tz, player) {
    if (!scene) return;
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const r = 0.09 + Math.random() * 0.1;
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(CHUNK_COL[i % CHUNK_COL.length]));
      s.position.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.18);
      g.add(s);
    }
    const blood = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(0x6a1a12)); blood.position.set(0, -0.1, 0); g.add(blood);
    let sx = z.pos.x, sy = (z.y || 0) + 2.6, sz = z.pos.z;
    if (z.model && z.model.handR) { z.model.root.updateMatrixWorld(true); z.model.handR.getWorldPosition(_hp); sx = _hp.x; sy = _hp.y; sz = _hp.z; }
    const W = G.World, gy = W.groundY(tx, tz, 0);
    // vuelo largo y alto (da tiempo a ver dónde cae y apartarse)
    const d = Math.hypot(tx - sx, tz - sz), T = U.clamp(d / 6.5, 1.25, 2.2);
    const vx = (tx - sx) / T, vz = (tz - sz) / T, vy = (gy + 0.2 - sy) / T + 0.5 * GRAV * T;
    g.position.set(sx, sy, sz);
    scene.add(g);
    // aviso en el suelo: un círculo que se cierra donde va a caer
    const mk = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 32), new THREE.MeshBasicMaterial({ color: 0xd8a24a, transparent: true, opacity: 0.0, depthWrite: false }));
    mk.rotation.x = -Math.PI / 2; mk.position.set(tx, gy + 0.06, tz); mk.renderOrder = 3;
    scene.add(mk);
    chunks.push({ g, mk, T, vx, vy, vz, t: 0, src: z, player, lv: z.lv || 0 });
    if (G.Audio) G.Audio.play('throwIt');
  }
  function burstChunk(c, x, y, z) {
    if (c.mk) { if (c.mk.parent) c.mk.parent.remove(c.mk); c.mk.geometry.dispose(); c.mk.material.dispose(); }
    if (c.g.parent) c.g.parent.remove(c.g);
    c.g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    if (G.Spores) G.Spores.burst(x, y, z, c.lv, 3.9, c.src, c.player, false, false, false, { dmg: 1.7, dur: 1.65 });
    if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(x, y + 0.3, z), new THREE.Vector3(0, 1, 0), true, 10);
  }

  // ---------- Cada fotograma ----------
  function update(dt) {
    const W = G.World;
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i], m = d.m;
      d.t += dt;
      if (!d.rest) {
        d.vy -= GRAV * dt;
        const nx = m.position.x + d.vx * dt, nz = m.position.z + d.vz * dt;
        // contra otra pared: rebota
        if (W.lineHit(m.position.x, m.position.z, nx, nz, (e) => W.blocksWalkEdge(e), 0) >= 0) { d.vx *= -0.3; d.vz *= -0.3; }
        else { m.position.x = nx; m.position.z = nz; }
        m.position.y += d.vy * dt;
        m.rotation.x += d.wx * dt; m.rotation.z += d.wz * dt;
        const floor = W.groundY(m.position.x, m.position.z, 0) + 0.05 + m.scale.y * 0.4;
        if (m.position.y < floor) {
          m.position.y = floor;
          if (d.vy < -2) { d.vy = -d.vy * 0.28; d.vx *= 0.5; d.vz *= 0.5; d.wx *= 0.5; d.wz *= 0.5; }
          else { d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; if (Math.hypot(d.vx, d.vz) < 0.3) { d.rest = true; m.rotation.x = Math.round(m.rotation.x / (Math.PI / 2)) * Math.PI / 2; m.rotation.z = Math.round(m.rotation.z / (Math.PI / 2)) * Math.PI / 2; } }
        }
      }
      // al final se encogen y se hunden en el suelo
      const left = d.life - d.t;
      if (left < 0.7) { const k = Math.max(0.001, left / 0.7); m.scale.set(d.s0.x * k, d.s0.y * k, d.s0.z * k); m.position.y -= dt * 0.15; }
      if (left <= 0) { scene.remove(m); debris.splice(i, 1); }
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.t += dt;
      const k = p.t / p.life;
      p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += 0.25 * dt;
      p.vx *= Math.exp(-dt * 1.5); p.vz *= Math.exp(-dt * 1.5);
      p.sp.scale.setScalar(0.8 + k * 2.6);
      p.sp.material.opacity = 0.7 * (1 - k);
      if (k >= 1) { scene.remove(p.sp); p.sp.material.dispose(); dust.splice(i, 1); }
    }
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i], g = c.g;
      c.t += dt;
      const ox = g.position.x, oz = g.position.z;
      c.vy -= GRAV * dt;
      const nx = ox + c.vx * dt, nz = oz + c.vz * dt, ny = g.position.y + c.vy * dt;
      g.rotation.x += dt * 9; g.rotation.y += dt * 6;
      if (c.mk) { const k = Math.min(1, c.t / c.T); c.mk.scale.setScalar(3.9 * (1 - 0.55 * k)); c.mk.material.opacity = 0.25 + 0.45 * k * (0.6 + 0.4 * Math.sin(c.t * 14)); }
      // contra una pared, en el suelo o encima de ella: revienta
      if (W.lineHit(ox, oz, nx, nz, W.blocksSightEdge, c.lv) >= 0) { chunks.splice(i, 1); burstChunk(c, ox, Math.max(W.groundY(ox, oz, c.lv), ny - 1), oz); continue; }
      g.position.set(nx, ny, nz);
      const gy = Math.max(W.groundY(nx, nz, c.lv), W.furnTop(nx, nz, c.lv, 0.1) || 0);
      const P = c.player, hitP = P && !P.dead && Math.hypot(P.pos.x - nx, P.pos.z - nz) < 0.6 && ny < P.y + 1.8 && ny > P.y;
      if (ny <= gy + 0.1 || hitP || c.t > 4) { chunks.splice(i, 1); burstChunk(c, nx, W.groundY(nx, nz, c.lv), nz); }
    }
  }

  function clear() {
    for (const d of debris) scene && scene.remove(d.m);
    for (const p of dust) { if (scene) scene.remove(p.sp); p.sp.material.dispose(); }
    for (const c of chunks) if (scene) { scene.remove(c.g); if (c.mk) scene.remove(c.mk); }
    debris.length = 0; dust.length = 0; chunks.length = 0; holes.length = 0;
  }

  // escondites para el blindado: junto a los huecos de las paredes y en los cuartos que se abrieron
  function hideBonus(x, z) {
    let s = 0;
    for (const h of holes) { const d = Math.hypot(h.x - x, h.z - z); if (d < 4) s += (4 - d) * 0.9; }
    const r = G.World.roomAt(Math.floor(x), Math.floor(z), 0);
    if (r && r.type !== 'arcade' && holes.length) s += 2.2;
    return Math.min(s, 6);
  }

  // el hongomorfo destroza una máquina del salón al pasar (o al embestir): cascotes, cristales y un estruendo
  const MACH_COLS = [0x2a2338, 0x3a2f55, 0x1c1a24, 0x6a5a8a];
  function smashFurn(c, f, ux, uz) {
    const W = G.World;
    if (!W.smashFurn(c, f)) return false;
    const x = (f.x0 + f.x1) / 2, z = (f.z0 + f.z1) / 2;
    if (G.Maps && G.Maps.killDecor) G.Maps.killDecor(x, z);
    spawnDebris(x, z, Math.abs(ux) > Math.abs(uz) ? 'W' : 'N', ux, uz, MACH_COLS[Math.floor(Math.random() * MACH_COLS.length)]);
    W.emit(x, z, 18, 0);
    if (G.Audio) { G.Audio.play('wallBreak', { x, z, lv: 0, big: false }); G.Audio.play('glass', { x, z, lv: 0 }); }
    const cp = G.Camera.pos, dc = cp ? Math.hypot(cp.x - x, cp.z - z) : 8;
    if (G.Camera.shake) G.Camera.shake(Math.max(0.1, Math.min(0.5, 0.7 - dc / 16)));
    if (G.Mode && G.Mode.bossEvent) G.Mode.bossEvent('machine');
    return true;
  }
  G.BossFx = { init, update, clear, smash, smashFurn, breakAround, wallAhead, throwChunk, hideBonus, get holes() { return holes; } };
})(window.Game = window.Game || {});
