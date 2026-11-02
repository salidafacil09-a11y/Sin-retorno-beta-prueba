(function (G) {
  'use strict';

  // Armas de fuego y arco.
  // - Hay que apuntar (clic derecho / LT / botón de mira) para disparar; sin apuntar, atacar da navajazos.
  // - La bala sale del centro de la pantalla (la mira) y la detienen las paredes y las puertas cerradas.
  // - A la cabeza hace el triple de daño; a las piernas derriba más. La escopeta dispara 7 perdigones.
  // - La retícula se abre al moverte y al disparar y se cierra si te quedas quieto.
  // - Cada disparo hace mucho ruido (el arco casi nada; la pistola con silenciador, poco).
  // - El arco se tensa solo mientras apuntas; cuanto más tenso, más lejos y más daño.
  //   Las flechas vuelan con caída y muchas se pueden recuperar del suelo o del cadáver.

  const U = G.Util;
  // Retroceso: la mira sube al disparar (KICK) y parte de esa subida se queda (RECOIL_KEEP: hay que bajarla
  // tú) con un leve tirón de lado (RECOIL_SIDE). Pistola el más bajo, escopeta medio alto, rifle alto, arco nada
  // (revolver: revólver · double: doble cañón · smg: subfusil · flame: lanzallamas)
  const KICK = { pistol: 0.035, shotgun: 0.1, rifle: 0.15, bow: 0, revolver: 0.075, double: 0.13, smg: 0.012, flame: 0 };
  const RECOIL_KEEP = { pistol: 0.35, shotgun: 0.45, rifle: 0.5, bow: 0, revolver: 0.4, double: 0.45, smg: 0.55, flame: 0 };
  const RECOIL_SIDE = { pistol: 0.008, shotgun: 0.02, rifle: 0.025, bow: 0, revolver: 0.014, double: 0.026, smg: 0.007, flame: 0 };
  const BLOOM = { pistol: 0.7, shotgun: 1.0, rifle: 1.0, bow: 0.2, revolver: 0.9, double: 1.1, smg: 0.22, flame: 0 };
  const SHAKE = { pistol: 0.1, shotgun: 0.3, rifle: 0.26, bow: 0, revolver: 0.17, double: 0.4, smg: 0.035, flame: 0.015 };
  const SG = { shotgun: 1, double: 1 };      // de perdigones (se abren y pierden fuerza con la distancia)
  const CYCLE = { shotgun: 0.55, rifle: 0.85, bow: 0.75 };                       // corredera, cerrojo, coger flecha
  const DRAW_TIME = 0.8;
  const ARROW_SPEED = [22, 52], ARROW_G = 6;
  const SIL_SHOTS = 20;
  const GORE_D = 3.5;            // la escopeta revienta al infectado si le das en el pecho a menos de esto (m)

  let scene = null;
  let light = null, flash = null;
  const tracers = [], parts = [], arrows = [];
  const mists = [], smokes = [], decals = [], shells = [];
  let decalN = 0;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

  function flashTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.25, 'rgba(255,200,110,0.9)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, r = i % 2 ? 12 : 32;
      x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    x.fill();
    return new THREE.CanvasTexture(c);
  }

  // Nube (sangre o humo): degradado radial con bordes irregulares
  function puffTexture(r, g, b) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const cx = 32 + (Math.random() - 0.5) * 22, cy = 32 + (Math.random() - 0.5) * 22, rr = 10 + Math.random() * 14;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0.55)');
      gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(c);
  }
  // Charco de sangre visto desde arriba: manchas que se juntan y salpicaduras alrededor
  function poolTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(70,6,5,0.92)';
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.28, d = Math.random() * 26, rr = 10 + Math.random() * 18;
      x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, 6.28); x.fill();
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.28, d = 38 + Math.random() * 22, rr = 1.5 + Math.random() * 4;
      x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, 6.28); x.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  // ---------- Geometría de los impactos ----------
  // Rayo contra esfera: devuelve t o -1
  function raySphere(o, d, cx, cy, cz, r) {
    const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const c = ox * ox + oy * oy + oz * oz - r * r;
    const disc = b * b - c;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : (c < 0 ? 0 : -1);
  }
  // Rayo contra cilindro vertical (cx, cz, radio r, de y0 a y1)
  function rayCyl(o, d, cx, cz, r, y0, y1) {
    const ox = o.x - cx, oz = o.z - cz;
    const a = d.x * d.x + d.z * d.z;
    let lo, hi;
    if (a < 1e-9) {
      if (ox * ox + oz * oz > r * r) return -1;
      lo = -Infinity; hi = Infinity;
    } else {
      const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r;
      const disc = b * b - a * c;
      if (disc < 0) return -1;
      const sq = Math.sqrt(disc);
      lo = (-b - sq) / a; hi = (-b + sq) / a;
    }
    if (Math.abs(d.y) < 1e-9) { if (o.y < y0 || o.y > y1) return -1; }
    else {
      let s0 = (y0 - o.y) / d.y, s1 = (y1 - o.y) / d.y;
      if (s0 > s1) { const k = s0; s0 = s1; s1 = k; }
      lo = Math.max(lo, s0); hi = Math.min(hi, s1);
    }
    if (lo > hi || hi < 0) return -1;
    return Math.max(0, lo);
  }

  // Dónde le da un rayo a un zombi: { t, part: 'head' | 'body' | 'legs' } o null
  const _hzH = new THREE.Vector3(), _hzC = new THREE.Vector3();
  function hitZombie(z, o, d) {
    if (!z.alive) return null;
    const y = z.y + (z.lift || 0);
    let best = null;
    const take = (t, part) => { if (t >= 0 && (!best || t < best.t)) best = { t, part }; };
    if (z.fall > 0.5 || z.downed) {
      // tumbado: tres esferas a lo largo del cuerpo
      const dir = z.fallDir || -1;
      const ax = Math.sin(z.facing) * dir, az = Math.cos(z.facing) * dir;
      take(raySphere(o, d, z.pos.x + ax * 0.45, y + 0.16, z.pos.z + az * 0.45, 0.2), 'legs');
      take(raySphere(o, d, z.pos.x + ax * 1.0, y + 0.18, z.pos.z + az * 1.0, 0.26), 'body');
      take(raySphere(o, d, z.pos.x + ax * 1.55, y + 0.16, z.pos.z + az * 1.55, 0.16), 'head');
    } else if (z.model && z.model.head) {
      // de pie: la cabeza y el pecho donde están de verdad (los corredores van muy inclinados)
      const h = z.model, b = z.bulk || 1;
      h.head.updateWorldMatrix(true, false);
      h.head.localToWorld(_hzH.set(0, 0.06, 0.015));
      h.chest.getWorldPosition(_hzC);
      take(raySphere(o, d, _hzH.x, _hzH.y + (z.hongo ? 0.08 : 0), _hzH.z, 0.14 * (z.hongo ? 1.9 : (b > 1 ? 1.15 : 1))), 'head');
      take(rayCyl(o, d, (_hzC.x + z.pos.x) / 2, (_hzC.z + z.pos.z) / 2, 0.26 * b, y + 0.85 * b, Math.max(y + 1.1, _hzH.y - 0.12 * b)), 'body');
      take(rayCyl(o, d, z.pos.x, z.pos.z, 0.2 * b, y + 0.05, y + 0.85 * b), 'legs');
    } else {
      const fx = Math.sin(z.facing) * 0.07, fz = Math.cos(z.facing) * 0.07;   // la cabeza va algo adelantada
      take(raySphere(o, d, z.pos.x + fx, y + 1.6, z.pos.z + fz, 0.15), 'head');
      take(rayCyl(o, d, z.pos.x, z.pos.z, 0.25, y + 0.85, y + 1.48), 'body');
      take(rayCyl(o, d, z.pos.x, z.pos.z, 0.2, y + 0.05, y + 0.85), 'legs');
    }
    return best;
  }

  // Desvía una dirección al azar dentro de un cono
  function perturb(d, spread, out) {
    const a = spread * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    _u.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize();
    _w.copy(d).cross(_u);
    return out.copy(d).multiplyScalar(Math.cos(a))
      .addScaledVector(_u, Math.sin(a) * Math.cos(th)).addScaledVector(_w, Math.sin(a) * Math.sin(th)).normalize();
  }


  // ---------- Desmembramiento ----------
  // Un escopetazo al pecho a quemarropa o una explosión encima: el infectado revienta y la cabeza, los
  // brazos, las piernas y trozos salen volando (rebotan, dejan sangre y se quedan un rato en el suelo)
  const Gore = (() => {
    const pieces = [];
    const MAX = 140;
    let geo = null;
    const mats = new Map();
    function mat(c) {
      if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c }));
      return mats.get(c);
    }
    function geos() {
      if (geo) return geo;
      geo = {
        head: new THREE.SphereGeometry(0.11, 12, 9),
        hair: new THREE.SphereGeometry(0.117, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
        arm: new THREE.CylinderGeometry(0.048, 0.038, 0.6, 9),
        hand: new THREE.SphereGeometry(0.045, 8, 6),
        leg: new THREE.CylinderGeometry(0.07, 0.05, 0.85, 9),
        shoe: new THREE.BoxGeometry(0.1, 0.07, 0.24),
        stump: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 9),
        torso: new THREE.BoxGeometry(0.34, 0.36, 0.2),
        chunk: new THREE.DodecahedronGeometry(0.045, 0)
      };
      return geo;
    }
    const RED = 0x7a1612, MEAT = 0x9b2a24;
    function piece(kind, look) {
      const g = geos(), grp = new THREE.Group();
      const add = (geom, c, x, y, z, rx) => { const m = new THREE.Mesh(geom, mat(c)); m.position.set(x || 0, y || 0, z || 0); if (rx) m.rotation.x = rx; m.castShadow = true; grp.add(m); return m; };
      if (kind === 'head') {
        add(g.head, look.skin);
        if (look.hair != null) add(g.hair, look.hair, 0, 0.01, -0.005);
        add(g.stump, RED, 0, -0.1, 0);
      } else if (kind === 'arm') {
        add(g.arm, look.longSleeves ? look.shirt : look.skin);
        add(g.hand, look.skin, 0, -0.32, 0);
        add(g.stump, RED, 0, 0.3, 0);
      } else if (kind === 'leg') {
        add(g.leg, look.pants);
        add(g.shoe, look.shoes || 0x2a2622, 0, -0.44, 0.05);
        add(g.stump, RED, 0, 0.425, 0);
      } else if (kind === 'torso') {
        add(g.torso, look.shirt);
        add(g.stump, RED, 0, 0.18, 0).scale.set(2.6, 1, 1.6);
      } else add(g.chunk, Math.random() < 0.5 ? RED : MEAT);
      return grp;
    }
    function explode(z, dx, dz, k, why) {
      if (!scene || !z || z.gibbed) return;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      // muere en el acto y el cuerpo desaparece: quedan los trozos
      if (z.alive) { z.hp = 0; z.killedBy = why || 'gore'; z.die(-1); }
      z.fall = 1; z.gibbed = true; z.rag = null; z.burnT = 0;
      z.model.root.visible = false;
      const look = z.look, f = z.facing, rx = -Math.cos(f), rz = Math.sin(f);
      const base = new THREE.Vector3(z.pos.x, z.y, z.pos.z);
      const list = [['head', 0, 1.62, 1.3], ['arm', 0.24, 1.3, 1], ['arm', -0.24, 1.3, 1], ['leg', 0.1, 0.55, 0.8], ['leg', -0.1, 0.55, 0.8], ['torso', 0, 1.1, 0.6]];
      for (let i = 0; i < 9; i++) list.push(['chunk', (Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.6, 1.2]);
      for (const [kind, side, y, up] of list) {
        const m = piece(kind, look);
        const p = base.clone().add(new THREE.Vector3(rx * side, y, rz * side));
        m.position.copy(p);
        m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        scene.add(m);
        const sp = (2 + 4.5 * k) * (0.6 + Math.random() * 0.6);
        const lat = (Math.random() - 0.5) * 3 + side * 6;
        const v = new THREE.Vector3(dx * sp + rx * lat, (2.5 + 4 * k) * up * (0.7 + Math.random() * 0.6), dz * sp + rz * lat);
        const w = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
        const half = kind === 'leg' ? 0.07 : (kind === 'arm' ? 0.05 : (kind === 'torso' ? 0.1 : (kind === 'head' ? 0.1 : 0.04)));
        pieces.push({ m, v, w, half, lv: z.lv || 0, t: 0, rest: false, blood: kind !== 'chunk' });
        while (pieces.length > MAX) kill(pieces[0]);
      }
      // nube de sangre y charco grande
      const c = new THREE.Vector3(z.pos.x, z.y + 1.2, z.pos.z);
      for (let i = 0; i < 3; i++) Guns.burst(c, new THREE.Vector3(dx, 0.6, dz), true, 12);
      Guns.decal(z.pos.x + dx * 0.4, z.pos.z + dz * 0.4, 0.75, z.lv || 0);
    }
    function kill(pc) {
      if (pc.m.parent) pc.m.parent.remove(pc.m);
      const i = pieces.indexOf(pc); if (i >= 0) pieces.splice(i, 1);
    }
    function update(dt) {
      if (dt <= 0) return;
      const W = G.World;
      for (let i = pieces.length - 1; i >= 0; i--) {
        const pc = pieces[i];
        pc.t += dt;
        if (pc.t > 45) { pc.m.position.y -= dt * 0.05; if (pc.t > 50) kill(pc); continue; }
        if (pc.rest) continue;
        pc.v.y -= 9.8 * dt;
        const p = pc.m.position, x0 = p.x, z0 = p.z;
        if (W.lineHit(x0, z0, x0 + pc.v.x * dt, z0 + pc.v.z * dt, W.blocksSightEdge, pc.lv) >= 0) { pc.v.x *= -0.35; pc.v.z *= -0.35; }
        p.addScaledVector(pc.v, dt);
        pc.m.rotation.x += pc.w.x * dt; pc.m.rotation.y += pc.w.y * dt; pc.m.rotation.z += pc.w.z * dt;
        const gy = W.groundY(p.x, p.z, pc.lv) + pc.half;
        if (p.y <= gy) {
          p.y = gy;
          if (pc.v.y < -1.5) {
            // rebota y deja sangre
            if (pc.blood) Guns.decal(p.x, p.z, 0.16 + Math.random() * 0.1, pc.lv);
            pc.v.y *= -0.3; pc.v.x *= 0.55; pc.v.z *= 0.55; pc.w.multiplyScalar(0.5);
          } else {
            pc.v.y = 0; pc.v.x *= Math.max(0, 1 - dt * 7); pc.v.z *= Math.max(0, 1 - dt * 7); pc.w.multiplyScalar(Math.max(0, 1 - dt * 6));
            if (Math.hypot(pc.v.x, pc.v.z) < 0.08 && pc.t > 0.4) {
              pc.rest = true;
              // queda tumbado: alarga los trozos alargados en el suelo
              if (pc.half > 0.045) { pc.m.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3; pc.m.rotation.z = Math.random() * 6; }
            }
          }
        }
      }
    }
    function clear() { while (pieces.length) kill(pieces[0]); }
    return { explode, update, clear };
  })();
  G.Gore = Gore;

  // ---------- Lanzallamas ----------
  // Un chorro de llamas (sprites que salen de la boquilla, crecen y se apagan) y, a los infectados que
  // alcanza dentro de un cono de unos 7 m, fuego: arden y se sacuden (los muy cercanos caen y se revuelcan).
  // Al temblante cada medio segundo de chorro le cuenta como una molotov más. Gasta combustible.
  const Flame = (() => {
    const N = 70, pool = [], _d = new THREE.Vector3(), _o = new THREE.Vector3();
    let soundT = 0, lastTok = null, tokT = 0, on = 0;
    function ensure() {
      if (pool.length || !scene) return;
      const tex = G.Fire && G.Fire.texture ? G.Fire.texture() : null;
      for (let i = 0; i < N; i++) {
        const m = new THREE.SpriteMaterial({ map: tex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
        m.toneMapped = false;
        const sp = new THREE.Sprite(m);
        sp.visible = false;
        scene.add(sp);
        pool.push({ sp, v: new THREE.Vector3(), life: 0, max: 1, s0: 0.1 });
      }
    }
    function emit(p, d, k) {
      const q = pool.find((x) => x.life <= 0);
      if (!q) return;
      q.life = q.max = 0.42 + Math.random() * 0.18;
      q.sp.position.copy(p);
      q.v.copy(d).multiplyScalar(10 + Math.random() * 3);
      q.v.x += (Math.random() - 0.5) * 1.4; q.v.y += (Math.random() - 0.3) * 1.0; q.v.z += (Math.random() - 0.5) * 1.4;
      q.s0 = 0.12 + Math.random() * 0.08;
      q.sp.visible = true;
      q.sp.material.rotation = Math.random() * 6.28;
    }
    function fire(player, zombies, guns) {
      ensure();
      const w = player.weapon, s = player.slot, g = player.gun;
      const r = guns.ray(player);
      const muzzle = guns.muzzlePos(player).clone();
      // hacia donde apuntas (a la altura de la boquilla)
      const c = guns.cast(player, zombies, r.o, r.d, r.tMin, w.range);
      _d.copy(c.point).sub(muzzle);
      if (_d.lengthSq() < 0.5) _d.copy(r.d);
      _d.normalize();
      for (let k = 0; k < 3; k++) { _o.copy(muzzle).addScaledVector(_d, k * 0.15); emit(_o, _d, k); }
      s.mag = Math.max(0, s.mag - 1);
      g.cooldown = w.fire * (player.perks ? player.perks.fire : 1);
      g.recoil = Math.max(g.recoil, 0.25);
      on = 0.12;
      // la luz del fogonazo, naranja, un poco por delante
      if (light) { light.position.copy(muzzle).addScaledVector(_d, 1.5); light.intensity = 2.6 * (0.8 + 0.3 * Math.random()); guns.flashT = 0.1; }
      // quién arde: dentro del cono, a la vista y en tu planta
      const now = performance.now() / 1000;
      if (!lastTok || now - tokT > 0.5) { lastTok = { src: 'flame' }; tokT = now; }
      const fx = _d.x, fz = _d.z, fl = Math.hypot(fx, fz) || 1;
      for (const z of zombies) {
        if (!z.alive || (z.lv || 0) !== (player.lv || 0)) continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.hypot(dx, dz);
        if (d > w.range + 0.4 || d < 0.05) continue;
        const cosA = (dx * fx + dz * fz) / (d * fl);
        const lim = Math.cos(Math.min(0.75, 0.18 + 0.7 / d));
        if (cosA < lim) continue;
        if (!G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) continue;
        if (z.temb) { z.ignite(player, false, lastTok); }
        else {
          if (!(z.burnT > 0) || z.state !== 'burning') z.ignite(player, d < 1.8 && Math.random() < 0.35, lastTok);
          z.hp -= U.lerp(w.dmg[0], w.dmg[1], Math.random()) * (player.perks ? player.perks.flame : 1);     // (la señora Paula: algo más)
          if (z.hp <= 0 && z.alive) { z.hp = 0; z.killedBy = 'fire'; if (z.endCombo) z.endCombo(player); z.die(Math.random() < 0.5 ? 1 : -1); if (G.Mode && G.Mode.bark) G.Mode.bark('burn'); if (guns.onHit) guns.onHit('kill', false); }
        }
      }
      // el fuego que cae al suelo delante también te quema si te metes (no: el chorro no deja charco)
      G.World.emit(player.pos.x, player.pos.z, w.noise, player.lv);
      soundT -= w.fire;
      if (soundT <= 0) { soundT = 0.16; if (G.Audio) G.Audio.shot('flame', false); }
      if (G.Camera.shake) G.Camera.shake(0.012);
    }
    function update(dt, player, held) {
      on = Math.max(0, on - dt);
      for (const q of pool) {
        if (q.life <= 0) continue;
        q.life -= dt;
        if (q.life <= 0) { q.sp.visible = false; q.sp.material.opacity = 0; continue; }
        const k = 1 - q.life / q.max;
        q.v.multiplyScalar(Math.max(0, 1 - dt * 2.2));
        q.v.y += dt * 2.4;                       // las llamas suben
        q.sp.position.addScaledVector(q.v, dt);
        const sc = q.s0 + k * 0.9;
        q.sp.scale.set(sc, sc * 1.1, 1);
        q.sp.material.opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.85;
        q.sp.material.color.setRGB(1, 0.75 - 0.35 * k, 0.4 - 0.3 * k);
      }
    }
    function clear() { for (const q of pool) { q.life = 0; q.sp.visible = false; } }
    return { fire, update, clear };
  })();

  const Guns = {
    onMessage: null,
    onHit: null,

    msg(t, k) { if (this.onMessage) this.onMessage(t, k); },

    init(sc) {
      scene = sc;
      light = new THREE.PointLight(0xffc27a, 0, 7, 2);
      scene.add(light);
      flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flash.material.toneMapped = false;
      flash.visible = false;
      scene.add(flash);
      for (let i = 0; i < 8; i++) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false }));
        l.material.toneMapped = false;
        l.frustumCulled = false;
        l.visible = false;
        scene.add(l);
        tracers.push({ line: l, life: 0 });
      }
      // nubes de sangre al impactar, humo del disparo, charcos en el suelo y casquillos
      const tBlood = puffTexture(120, 8, 6), tSmoke = puffTexture(190, 186, 176), tPool = poolTexture();
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tBlood, transparent: true, depthWrite: false, opacity: 0 }));
        m.visible = false; scene.add(m); mists.push({ m, life: 0, max: 1, size: 0.4 });
      }
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tSmoke, transparent: true, depthWrite: false, opacity: 0 }));
        m.visible = false; scene.add(m); smokes.push({ m, life: 0, max: 1, size: 0.2, v: new THREE.Vector3() });
      }
      const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      for (let i = 0; i < 24; i++) {
        const mt = new THREE.MeshBasicMaterial({ map: tPool, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const m = new THREE.Mesh(pg, mt);
        m.visible = false; m.renderOrder = 1; scene.add(m); decals.push({ m, age: 0, r: 0.3, on: false });
      }
      const sg = new THREE.CylinderGeometry(0.0048, 0.0048, 0.02, 6).rotateZ(Math.PI / 2);
      const sm = new THREE.MeshLambertMaterial({ color: 0xb8913c });
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(sg, sm);
        m.visible = false; scene.add(m); shells.push({ m, v: new THREE.Vector3(), life: 0, bounced: 0 });
      }
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mBlood = new THREE.MeshBasicMaterial({ color: 0x6e0d0d });
      const mDust = new THREE.MeshBasicMaterial({ color: 0xb4a994 });
      for (let i = 0; i < 60; i++) {
        const m = new THREE.Mesh(geo, i % 3 ? mBlood : mDust);
        m.visible = false;
        scene.add(m);
        parts.push({ m, v: new THREE.Vector3(), life: 0, blood: !!(i % 3) });
      }
    },

    reset() {
      Flame.clear();
      for (const a of arrows) if (a.mesh.parent) a.mesh.parent.remove(a.mesh);
      arrows.length = 0;
      for (const p of parts) { p.life = 0; p.m.visible = false; }
      for (const d of decals) { d.on = false; d.m.visible = false; }
      for (const q of mists.concat(smokes, shells)) { q.life = 0; q.m.visible = false; }
    },

    // ---------- Entrada ----------
    // Devuelve true si la acción se usó para el arma de fuego
    handleInput(player, input, zombies) {
      const w = player.weapon;
      if (!G.Weapons.isGun(w) || player.dead) return false;
      const aiming = player.aiming;
      if (input.reload) { this.startReload(player); return true; }
      // subfusil y lanzallamas: mientras mantienes Atacar apuntando, dispara solo
      if (w.auto && aiming && (input.attack || input.attackHeld)) {
        if (!player.busy()) this.tryFire(player, zombies);
        return true;
      }
      if (input.attack && aiming) {
        if (!player.busy()) this.tryFire(player, zombies);
        return true;
      }
      return false;
    },

    // Las armas de fuego no se gastan ni se rompen nunca (ya no tienen estado)
    wearGun(player, w, s) { if (s) { s.cond = 1; s.broken = false; } },

    startReload(player) {
      const w = player.weapon, s = player.slot, g = player.gun;
      if (!s || w.gun === 'bow' || g.reload || s.broken || player.hostage) return;      // (con un rehén, una mano: no se recarga)
      // durante la corredera o el cerrojo, la recarga empieza en cuanto terminan
      if (g.cycle || player.busy()) { g.wantReload = true; return; }
      g.wantReload = false;
      if (s.mag >= w.mag) return;
      if (player.ammo[w.ammo] <= 0) { this.msg('No te quedan ' + G.Weapons.AMMO[w.ammo].name, 'warn'); return; }
      g.reload = { u: 0, dur: w.reload * (player.perks && player.perks.fire < 1 ? 0.85 : 1), per: !!w.perShell };
      if (G.Audio) G.Audio.play(w.perShell ? 'slide' : 'magOut');
      if (G.Humans) G.Humans.playerReload(player);
      // recargar deja de apuntar (vuelve a apuntar si lo pides otra vez, o al terminar si mantienes el botón)
      player.reloadNoAim = true;
      if (G.Input && G.Input.setAim) G.Input.setAim(false);
    },

    tryFire(player, zombies) {
      const w = player.weapon, s = player.slot, g = player.gun;
      if (g.cooldown > 0 || g.cycle || g.aim < 0.6) return;
      if (s.broken) s.broken = false;          // (las armas de fuego ya no se rompen)
      if (g.reload) {
        // con la escopeta y el rifle se puede cortar la recarga para disparar
        if (g.reload.per && s.mag > 0) g.reload = null; else return;
      }
      if (w.gun === 'bow') {
        if (!s.mag) { if (!player.ammo.flecha && !player.ammo.flecha_exp) this.msg('No te quedan flechas', 'warn'); return; }
        if (g.draw < 0.15) return;
        this.shootArrow(player, zombies);
        return;
      }
      if (s.mag <= 0) {
        g.cooldown = 0.3;
        if (G.Audio && w.gun !== 'flame') G.Audio.play('dry');
        // el clic se oye: los humanos cercanos saben que estás sin balas
        if (w.gun !== 'flame' && G.Humans) G.Humans.dryFire(player);
        if (player.hostage) return;
        if (player.ammo[w.ammo] > 0) this.startReload(player);
        else this.msg('Sin munición', 'warn');
        return;
      }
      if (w.gun === 'flame') { Flame.fire(player, zombies, this); return; }
      this.fire(player, zombies);
    },

    // Dispersión actual (radianes): crece al moverte, correr y disparar
    // Tamaño del círculo de la mira: la pistola usa el del rifle (más chico que su dispersión real) y la
    // escopeta uno algo más cerrado que el reparto de los perdigones; los dos se abren al moverte o correr
    VIEW_SPREAD: { pistol: 0.004, shotgun: 0.042, revolver: 0.004, double: 0.05 },
    viewSpread(player) {
      const w = player.weapon, s = this.spreadNow(player);
      const b = this.VIEW_SPREAD[w.gun];
      return b && s ? s * b / w.spread : s;
    },

    spreadNow(player) {
      const w = player.weapon, g = player.gun;
      if (!G.Weapons.isGun(w)) return 0;
      let s = w.spread * (1 + (g.bloom * 2.2 + player.moveAmt * (player.crouching ? 0.8 : 1.4) + (player.running ? 2 : 0)) * (SG[w.gun] ? 0.35 : 1));
      if (player.crouching) s *= 0.8;
      if (w.gun === 'bow') s *= 1 + (1 - g.draw) * 3;
      s *= 1 + (1 - g.aim) * 2;
      return s;
    },

    // Origen y dirección del disparo (el centro de la pantalla) y desde dónde cuenta
    ray(player) {
      const C = G.Camera;
      _o.copy(C.pos);
      _d.copy(C.dir).normalize();
      // no puede darle a lo que está entre la cámara y el personaje
      const px = player.pos.x - _o.x, py = player.y + 1.3 - _o.y, pz = player.pos.z - _o.z;
      const tMin = Math.max(0, px * _d.x + py * _d.y + pz * _d.z - 0.25);
      return { o: _o, d: _d, tMin };
    },

    // Lanza un rayo: { t, z, part, point }
    cast(player, zombies, o, d, tMin, range) {
      const W = G.World;
      let tEnd = range;
      // paredes y puertas cerradas (desde el personaje hacia delante)
      const sx = o.x + d.x * tMin, sz = o.z + d.z * tMin;
      const ex = o.x + d.x * range, ez = o.z + d.z * range;
      const f = W.lineHit(sx, sz, ex, ez, W.blocksSightEdge, player.lv);
      let what = null;
      if (f >= 0) { tEnd = tMin + f * (range - tMin); what = 'wall'; }
      // suelo y lomas: se recorre el rayo a pasos de medio metro
      {
        const step = 0.5;
        for (let t = Math.max(tMin, 0.5); t < tEnd; t += step) {
          const x = o.x + d.x * t, z = o.z + d.z * t, y = o.y + d.y * t;
          // arriba solo cuenta el suelo de la planta dentro del edificio; fuera, el terreno
          const gAt = (gx, gz) => (player.lv && W.bldAt(Math.floor(gx), Math.floor(gz), player.lv)) ? W.groundY(gx, gz, player.lv) : W.groundY(gx, gz, 0);
          const gy = gAt(x, z);
          if (y < gy) {
            // afina entre el paso anterior y este
            let a = t - step, b = t;
            for (let k = 0; k < 5; k++) { const m = (a + b) / 2; if (o.y + d.y * m < gAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
            if (b > tMin) { tEnd = b; what = 'ground'; }
            break;
          }
        }
      }
      let bz = null, part = null;
      const hos = player.hostage ? player.hostage.h : null;
      for (const z of zombies) {
        if (!z.alive || (z.lv || 0) !== (player.lv || 0) || z === hos) continue;
        const dx = z.pos.x - o.x, dz = z.pos.z - o.z;
        if (dx * dx + dz * dz > (range + 2) * (range + 2)) continue;
        const h = hitZombie(z, o, d);
        if (h && h.t > tMin && h.t < tEnd) { tEnd = h.t; bz = z; part = h.part; what = 'zombie'; }
      }
      return { t: tEnd, z: bz, part, what, point: new THREE.Vector3(o.x + d.x * tEnd, o.y + d.y * tEnd, o.z + d.z * tEnd) };
    },

    // Zombi justo en la mira (para el contorno amarillo)
    rayTarget(player, zombies) {
      const w = player.weapon;
      if (!G.Weapons.isGun(w)) return null;
      const r = this.ray(player);
      const c = this.cast(player, zombies, r.o, r.d, r.tMin, w.range);
      return c.z || this.assistTarget(player, zombies, r, w.range);
    },

    // Ayuda a apuntar (más en móvil): si un zombi está casi en la mira, el disparo se va hacia él
    assistTarget(player, zombies, r, range) {
      const lim = G.Input.isTouch ? 0.07 : 0.03;
      let best = null, bestA = lim;
      for (const z of zombies) {
        if (!z.alive || z.fall > 0.5 || (player.hostage && player.hostage.h === z)) continue;
        const cx = z.pos.x - r.o.x, cy = z.y + 1.25 - r.o.y, cz = z.pos.z - r.o.z;
        const L = Math.hypot(cx, cy, cz);
        if (L > range || L < 0.5) continue;
        const a = Math.acos(U.clamp((cx * r.d.x + cy * r.d.y + cz * r.d.z) / L, -1, 1));
        if (a < bestA && (z.lv || 0) === (player.lv || 0) && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bestA = a; best = z; }
      }
      return best;
    },

    fire(player, zombies) {
      const w = player.weapon, s = player.slot, g = player.gun;
      const r = this.ray(player);
      const o = r.o.clone(), dir = r.d.clone();
      // ayuda a apuntar: si no hay nadie en la mira pero sí casi, corrige un poco
      const direct = this.cast(player, zombies, o, dir, r.tMin, w.range);
      if (!direct.z) {
        const az = this.assistTarget(player, zombies, { o, d: dir }, w.range);
        if (az) {
          const tp = new THREE.Vector3(az.pos.x, az.y + 1.25, az.pos.z).sub(o).normalize();
          dir.lerp(tp, 0.85).normalize();
        }
      }
      const spread = this.spreadNow(player);
      const muzzle = this.muzzlePos(player);
      const hits = new Map();
      const dd = new THREE.Vector3();
      for (let i = 0; i < (w.pellets || 1); i++) {
        perturb(dir, spread, dd);
        const c = this.cast(player, zombies, o, dd, r.tMin, w.range);
        if (i < 3) this.tracer(muzzle, c.point);
        if (c.z) {
          const dist = c.t - r.tMin;
          // del cuello para abajo, daño normal; en la cabeza, muerte en el acto (lo decide takeHit)
          let dmg = U.lerp(w.dmg[0], w.dmg[1], Math.random());
          if (SG[w.gun] && dist > 6) dmg *= Math.max(0.25, 1 - (dist - 6) / 16);
          const hz = hits.get(c.z) || { dmg: 0, head: false, legs: false, n: 0, dist, point: c.point };
          hz.dmg += dmg; hz.n++; hz.head = hz.head || c.part === 'head'; hz.legs = hz.legs || c.part === 'legs';
          hits.set(c.z, hz);
          this.burst(c.point, dd, true, c.part === 'head' ? 9 : 4);
        } else if (c.what) {
          this.burst(c.point, dd, false, 3);
          if (G.Audio && i < 2) G.Audio.play('hitWall', { x: c.point.x, z: c.point.z, lv: player.lv, delay: Math.min(0.15, c.t / 340) });
        }
      }
      for (const [z, h] of hits) {
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        if (G.Audio) G.Audio.play('hitFlesh', { x: z.pos.x, z: z.pos.z, lv: z.lv, head: h.head, delay: 0.02 });
        // escopetazo al pecho a quemarropa: revienta
        if (SG[w.gun] && h.dist < GORE_D && !h.head && h.n >= 4 && z.alive && !z.temb) {
          Gore.explode(z, dx, dz, 1 - h.dist / GORE_D * 0.5, 'gun');
          const ms = G.Mode && G.Mode.stats;
          if (ms) ms.hits++;
          if (this.onHit) this.onHit('kill', true);
          continue;
        }
        let knock = w.knock + (h.legs ? 0.35 : 0) + (SG[w.gun] && h.dist < 4 ? 0.45 : 0);
        const behind = G.Combat.behind(player, z);
        const res = z.takeHit(h.dmg, knock, dx, dz, behind, Math.random() < 0.5 ? 1 : -1, 'shot', h.head ? 'head' : (h.legs && h.n <= 1 ? 'legs' : 'body'), { w: w.gun, dist: h.dist, n: h.n, up: !!w.dmgUp });
        if (res === 'kill') z.killedBy = 'gun';
        const ms = G.Mode && G.Mode.stats;
        if (ms) { ms.hits++; if (h.head && res === 'kill') ms.head++; }
        this.blood(z, h, dd);
        if (this.onHit) this.onHit(res, h.head);
      }
      // los humanos a los que les pasa la bala cerca se cubren
      if (G.Humans) G.Humans.onPlayerShot(player, o, dir, direct.t);
      // los vidrios de las ventanas cerradas que cruza el disparo se rompen
      const far = direct.t;
      G.World.breakWindowsAlong(o.x + dir.x * r.tMin, o.z + dir.z * r.tMin, o.x + dir.x * far, o.z + dir.z * far, player.lv);
      // efectos, ruido y retroceso
      if (G.Mode && G.Mode.stats) G.Mode.stats.shots++;
      s.mag--;
      this.wearGun(player, w, s);
      const sil = !!s.sil || !!w.silenced;
      this.muzzleFlash(muzzle, sil ? 0.35 : (SG[w.gun] ? 1.4 : 1), w.gun);
      if (G.Audio) G.Audio.shot(w.gun, sil);
      G.World.emit(player.pos.x, player.pos.z, w.noise * (s.sil ? 0.22 : 1), player.lv);
      if (s.sil) {
        s.sil--;
        if (s.sil <= 0) { s.sil = 0; player.refreshModel(); this.msg('El silenciador se rompió', 'warn'); }
      }
      // el subfusil usa la postura de la escopeta: con su retroceso entero en cada bala de la ráfaga se
      // sacudía muchísimo; solo un toque seco
      g.recoil = w.gun === 'smg' ? Math.max(g.recoil, 0.2) : 1;
      g.bloom = Math.min(3, g.bloom + BLOOM[w.gun]);
      g.cooldown = w.fire * (player.perks ? player.perks.fire : 1);
      if (CYCLE[w.gun] && !w.noPump) g.cycle = { t: 0, dur: CYCLE[w.gun] };
      // sin las mejoras de Estabilidad y Retroceso el arma retrocede mucho más (kickMul)
      const crouch = (player.crouching ? 0.75 : 1) * (w.kickMul || 1);
      if (G.Camera.kick) G.Camera.kick(KICK[w.gun] * crouch);
      if (G.Camera.recoil) G.Camera.recoil(KICK[w.gun] * RECOIL_KEEP[w.gun] * crouch, RECOIL_SIDE[w.gun] * crouch);
      if (G.Camera.shake) G.Camera.shake(SHAKE[w.gun] * Math.min(1.6, w.kickMul || 1));
    },

    // Trayectoria de la flecha que verías al soltar (para la línea del arco): sale del arco hacia donde
    // apuntas y cae con la gravedad
    bowPath(player, zombies, pts, N, sim) {
      const w = player.weapon, s = player.slot, g = player.gun;
      if (w.gun !== 'bow' || !s || s.broken) return null;
      const r = this.ray(player);
      const o = r.o.clone(), dir = r.d.clone();
      const c = this.cast(player, zombies, o, dir, r.tMin, w.range);
      const start = this.muzzlePos(player).clone();
      const speed = U.lerp(ARROW_SPEED[0], ARROW_SPEED[1], g.draw) * (w.arrowMul || 1);
      const v = c.point.clone().sub(start).normalize().multiplyScalar(speed);
      return sim(start, v, ARROW_G, player.lv || 0, 2.5);
    },

    shootArrow(player, zombies) {
      const w = player.weapon, s = player.slot, g = player.gun;
      const r = this.ray(player);
      const o = r.o.clone(), dir = r.d.clone();
      perturb(dir, this.spreadNow(player), dir);
      const c = this.cast(player, zombies, o, dir, r.tMin, w.range);
      const start = this.muzzlePos(player).clone();
      const draw = g.draw;
      const speed = U.lerp(ARROW_SPEED[0], ARROW_SPEED[1], draw) * (w.arrowMul || 1);
      const to = c.point.clone().sub(start);
      const dist = to.length();
      const v = to.normalize().multiplyScalar(speed);
      // sin compensar la caída: la línea verde del arco muestra por dónde va de verdad
      if (!scene) return;
      if (!this.arrowMat) this.arrowMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const exp = !!s.exp;
      const mesh = new THREE.Mesh(G.Models.weaponGeometry(exp ? 'flecha_exp' : 'flecha'), this.arrowMat);
      mesh.position.copy(start);
      scene.add(mesh);
      arrows.push({ mesh, p: start, v, life: 0, lv: player.lv, dmg: U.lerp(w.dmg[0], w.dmg[1], draw), knock: w.knock + 0.2 * draw, exp });
      s.mag = 0; s.exp = false;
      if (G.Audio) G.Audio.play('bowRelease', { k: draw });
      this.wearGun(player, w, s);
      g.draw = 0;
      g.recoil = 0.5;
      g.cycle = { t: 0, dur: CYCLE.bow };
      g.cooldown = w.fire * (player.perks ? player.perks.fire : 1);
      G.World.emit(player.pos.x, player.pos.z, w.noise, player.lv);

    },

    // Punta del cañón (o del arco) en el mundo
    muzzlePos(player) {
      const g = player.model.gun;
      if (!g) return _p.set(player.pos.x, player.y + 1.4, player.pos.z);
      player.model.root.updateMatrixWorld(true);
      return g.muzzle.getWorldPosition(_p);
    },

    // ---------- Efectos ----------
    // fogonazo grande y breve (como en el vídeo), humo que se queda un momento y el casquillo que sale
    muzzleFlash(p, size, gun) {
      if (!light) return;
      light.position.copy(p);
      light.intensity = 4.5 * size;
      flash.position.copy(p);
      flash.scale.setScalar(0.55 * size * (0.85 + Math.random() * 0.3));
      flash.material.rotation = Math.random() * Math.PI;
      flash.visible = size > 0.5;
      this.flashT = 0.055;
      const sm = smokes.find((q) => q.life <= 0) || smokes[0];
      if (sm) {
        sm.life = sm.max = 0.7; sm.size = 0.16 * size; sm.m.visible = true; sm.m.position.copy(p);
        sm.v.set((Math.random() - 0.5) * 0.3, 0.35, (Math.random() - 0.5) * 0.3).addScaledVector(G.Camera.dir, 0.5);
      }
      if (gun === 'pistol' || gun === 'rifle') this.eject(p, gun === 'rifle' ? 0.18 : 0.1);
    },

    // fogonazo de un arma de los humanos (la misma luz, sin casquillo ni humo)
    npcFlash(p, size) {
      if (!light) return;
      light.position.copy(p);
      light.intensity = Math.max(light.intensity, 3.2 * size);
      flash.position.copy(p);
      flash.scale.setScalar(0.5 * size * (0.85 + Math.random() * 0.3));
      flash.material.rotation = Math.random() * Math.PI;
      flash.visible = size > 0.5;
      this.flashT = 0.05;
    },

    // casquillo: sale por la derecha y algo hacia atrás, rebota y se queda en el suelo un rato
    eject(p, back) {
      const sh = shells.find((q) => q.life <= 0) || shells[0];
      if (!sh) return;
      const f = G.Camera.forward(), r = G.Camera.right();
      sh.m.position.set(p.x - f.x * back, p.y - 0.02, p.z - f.z * back);
      sh.v.set(r.x * (1.3 + Math.random() * 0.6) - f.x * 0.4, 1.6 + Math.random() * 0.8, r.z * (1.3 + Math.random() * 0.6) - f.z * 0.4);
      sh.life = 3; sh.bounced = 0; sh.m.visible = true;
      sh.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    },

    // sangre de un disparo: nube roja que se abre en el impacto y un charco bajo el infectado
    blood(z, h, d) {
      const head = h.head;
      const ms = mists.find((q) => q.life <= 0) || mists[0];
      if (ms && h.point) {
        ms.life = ms.max = head ? 0.5 : 0.38; ms.size = head ? 0.55 : 0.36;
        ms.m.position.copy(h.point).addScaledVector(d, 0.12); ms.m.visible = true;
        ms.m.material.rotation = Math.random() * 6.28;
      }
      this.decal(z.pos.x + d.x * 0.35, z.pos.z + d.z * 0.35, head ? 0.42 : 0.26, z.lv || 0);
    },

    // charco de sangre en el suelo (se reutilizan los más viejos)
    decal(x, zz, r, lv) {
      if (!decals.length) return;
      const dc = decals[decalN++ % decals.length];
      dc.on = true; dc.age = 0; dc.r = r * (0.85 + Math.random() * 0.3);
      dc.m.visible = true;
      dc.m.position.set(x, G.World.groundY(x, zz, lv || 0) + 0.012, zz);
      dc.m.rotation.y = Math.random() * 6.28;
      dc.m.scale.setScalar(0.01);
    },

    tracer(a, b) {
      if (!tracers.length) return;
      const t = tracers.find((x) => x.life <= 0) || tracers[0];
      const p = t.line.geometry.attributes.position;
      // la estela empieza un poco por delante del cañón
      const k = Math.min(1, 0.6 / Math.max(0.6, a.distanceTo(b)));
      p.setXYZ(0, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      p.setXYZ(1, b.x, b.y, b.z);
      p.needsUpdate = true;
      t.line.visible = true;
      t.line.material.opacity = 0.75;
      t.life = 0.07;
    },

    // Salpicadura de sangre (zombi) o polvo (pared o suelo)
    burst(p, d, blood, n) {
      for (let i = 0; i < n; i++) {
        const q = parts.find((x) => x.life <= 0 && x.blood === blood);
        if (!q) break;
        q.life = 0.35 + Math.random() * 0.25;
        q.m.visible = true;
        q.m.position.copy(p);
        const s = (blood ? 0.022 : 0.016) * (0.7 + Math.random() * 0.8);
        q.m.scale.setScalar(s);
        q.v.set((Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.5) * 2.4);
        if (blood) q.v.addScaledVector(d, 2.5); else q.v.addScaledVector(d, -1.5);
      }
    },

    // ---------- Actualización ----------
    update(dt, player, zombies) {
      Gore.update(dt);
      const g = player.gun, w = player.weapon, s = player.slot;
      const isGun = G.Weapons.isGun(w) && !!s;
      g.recoil = Math.max(0, g.recoil - dt * 9);
      g.bloom = Math.max(0, g.bloom - dt * (player.moveAmt > 0.2 ? 1.2 : 2.2));
      g.cooldown = Math.max(0, (g.cooldown || 0) - dt);
      g.aim += ((isGun && player.aiming && !player.busy() ? 1 : 0) - g.aim) * Math.min(1, dt * 9);
      if (isGun) {
        // corredera, cerrojo o coger otra flecha
        if (g.cycle) {
          g.cycle.t += dt / g.cycle.dur;
          if (g.cycle.t >= 1) g.cycle = null;
        }
        // cargador vacío y balas en el inventario: recarga sola
        if (w.gun !== 'bow' && s.mag <= 0 && !g.reload && !g.wantReload && !s.broken && player.ammo[w.ammo] > 0) g.wantReload = true;
        if (g.wantReload && !g.cycle && !player.busy()) this.startReload(player);
        // recarga
        if (g.reload) {
          if (player.dodging || player.action || player.climb) g.reload = null;
          else {
            const u0 = g.reload.u;
            g.reload.u += dt / g.reload.dur;
            if (!g.reload.per && u0 < 0.55 && g.reload.u >= 0.55 && G.Audio) G.Audio.play('magIn');
            if (g.reload.u >= 1) {
              const have = player.ammo[w.ammo];
              if (g.reload.per) {
                if (have > 0 && s.mag < w.mag) { s.mag++; player.ammo[w.ammo]--; if (G.Audio) G.Audio.play('shellIn'); }
                if (s.mag >= w.mag || player.ammo[w.ammo] <= 0) g.reload = null; else g.reload.u = 0;
              } else {
                const n = Math.min(w.mag - s.mag, have);
                s.mag += n; player.ammo[w.ammo] -= n;
                g.reload = null;
                if (G.Audio) G.Audio.play('slide');
              }
            }
          }
        }
        g.rw += ((g.reload ? 1 : 0) - g.rw) * Math.min(1, dt * 7);
        g.ru = g.reload ? g.reload.u : 0;
        // arco: coger flecha y tensar
        if (w.gun === 'bow') {
          if (!s.mag && !g.cycle) {
            // coge una explosiva si las tienes elegidas (y quedan); si no, una normal
            if (player.arrowExp && player.ammo.flecha_exp > 0) { s.mag = 1; s.exp = true; player.ammo.flecha_exp--; }
            else if (player.ammo.flecha > 0) { s.mag = 1; s.exp = false; player.ammo.flecha--; if (player.arrowExp) player.arrowExp = false; }
          }
          if (player.aiming && s.mag && !g.cycle && g.aim > 0.7) {
            if (g.draw === 0 && G.Audio) G.Audio.play('bowDraw');
            g.draw = Math.min(1, g.draw + dt / DRAW_TIME);
          } else g.draw = Math.max(0, g.draw - dt * 4);
          g.arrow = s.mag > 0;
        }
      } else {
        g.reload = null; g.cycle = null; g.draw = 0; g.rw = 0; g.wantReload = false;
      }

      Flame.update(dt, player, isGun && w.gun === 'flame');
      this.updateFx(dt, zombies);
    },

    updateFx(dt, zombies) {
      if (!light) return;
      if (this.flashT > 0) {
        this.flashT -= dt;
        if (this.flashT <= 0) { light.intensity = 0; flash.visible = false; }
        else light.intensity *= 0.6;
      }
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.75;
        if (t.life <= 0) t.line.visible = false;
      }
      for (const q of mists) {
        if (q.life <= 0) continue;
        q.life -= dt;
        const u = 1 - Math.max(0, q.life) / q.max;
        q.m.scale.setScalar(q.size * (0.5 + 1.6 * Math.sqrt(u)));
        q.m.material.opacity = 0.85 * (1 - u * u);
        q.m.position.y -= dt * 0.25;
        if (q.life <= 0) q.m.visible = false;
      }
      for (const q of smokes) {
        if (q.life <= 0) continue;
        q.life -= dt;
        const u = 1 - Math.max(0, q.life) / q.max;
        q.m.position.addScaledVector(q.v, dt);
        q.m.scale.setScalar(q.size * (1 + 2.2 * u));
        q.m.material.opacity = 0.32 * (1 - u);
        if (q.life <= 0) q.m.visible = false;
      }
      for (const q of shells) {
        if (q.life <= 0) continue;
        q.life -= dt;
        const p = q.m.position;
        if (q.bounced < 2) {
          q.v.y -= 9.8 * dt;
          p.addScaledVector(q.v, dt);
          q.m.rotation.x += dt * 22; q.m.rotation.z += dt * 14;
          const gy = G.World.groundY(p.x, p.z, 0) + 0.005;
          if (p.y < gy) { p.y = gy; q.v.y = -q.v.y * 0.35; q.v.x *= 0.4; q.v.z *= 0.4; q.bounced++; if (q.bounced >= 2) q.m.rotation.x = 0; }
        }
        if (q.life <= 0) q.m.visible = false;
      }
      for (const dc of decals) {
        if (!dc.on) continue;
        dc.age += dt;
        // crece en un segundo; a los 45 s se desvanece
        dc.m.scale.setScalar(dc.r * 2 * Math.min(1, 0.3 + dc.age * 0.9));
        dc.m.material.opacity = Math.min(0.9, dc.age * 6) * (dc.age > 45 ? Math.max(0, 1 - (dc.age - 45) / 5) : 1);
        if (dc.age > 50) { dc.on = false; dc.m.visible = false; }
      }
      for (const q of parts) {
        if (q.life <= 0) continue;
        q.life -= dt;
        q.v.y -= 9 * dt;
        q.m.position.addScaledVector(q.v, dt);
        if (q.m.position.y < 0.01) { q.m.position.y = 0.01; q.v.set(0, 0, 0); }
        if (q.life <= 0) q.m.visible = false;
      }
      this.updateArrows(dt, zombies);
    },

    updateArrows(dt, zombies) {
      const W = G.World;
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];
        a.life += dt;
        const p0 = a.p.clone();
        a.v.y -= ARROW_G * dt;
        a.p.addScaledVector(a.v, dt);
        const seg = a.p.clone().sub(p0);
        const L = seg.length();
        const d = seg.divideScalar(L || 1);
        let done = false;
        // zombis
        let bz = null, bh = null;
        for (const z of zombies) {
          if (!z.alive || (z.lv || 0) !== (a.lv || 0)) continue;
          if (Math.abs(z.pos.x - p0.x) > L + 2 || Math.abs(z.pos.z - p0.z) > L + 2) continue;
          const h = hitZombie(z, p0, d);
          if (h && h.t <= L && (!bh || h.t < bh.t)) { bz = z; bh = h; }
        }
        // vidrio de una ventana cerrada: se rompe y la flecha sigue
        W.breakWindowsAlong(p0.x, p0.z, a.p.x, a.p.z, a.lv);
        // pared o suelo
        const f = W.lineHit(p0.x, p0.z, a.p.x, a.p.z, W.blocksSightEdge, a.lv);
        const tWall = f >= 0 ? f * L : Infinity;
        const gy = W.groundY(a.p.x, a.p.z, a.lv);
        const tGround = a.p.y < gy ? L * (p0.y - gy) / Math.max(1e-4, p0.y - a.p.y) : Infinity;
        if (a.exp && ((bz && bh.t < tWall && bh.t < tGround) || tWall < Infinity || tGround < Infinity)) {
          // flecha explosiva: revienta donde clava (en el infectado, contra la pared o en el suelo)
          const t = bz && bh.t < tWall && bh.t < tGround ? bh.t : Math.max(0, Math.min(tWall, tGround) - 0.08);
          a.p.copy(p0).addScaledVector(d, t);
          scene.remove(a.mesh);
          if (G.Boom) G.Boom.explode(a.p.x, Math.max(a.p.y, W.groundY(a.p.x, a.p.z, a.lv) + 0.2), a.p.z, a.lv || 0, bz);
          done = true;
        } else if (bz && bh.t < tWall && bh.t < tGround) {
          a.p.copy(p0).addScaledVector(d, bh.t);
          const dmg = a.dmg;
          const res = bz.takeHit(dmg, a.knock, d.x, d.z, G.Combat.behind({ pos: { x: p0.x, z: p0.z } }, bz), 1, 'shot', bh.part === 'head' ? 'head' : (bh.part === 'legs' ? 'legs' : 'body'), { w: 'bow' });
          if (this.onHit) this.onHit(res, bh.part === 'head');
          if (G.Audio) G.Audio.play('arrowHit', { x: a.p.x, z: a.p.z, lv: a.lv, flesh: true });
          G.World.emit(a.p.x, a.p.z, 4, a.lv);
          this.burst(a.p, d, true, bh.part === 'head' ? 7 : 4);
          // la flecha se queda clavada: se recupera del cadáver (si no se rompe)
          this.orient(a);
          bz.model.body.attach(a.mesh);
          a.mesh.userData.arrow = true;
          if (Math.random() < 0.75) bz.arrowsIn = (bz.arrowsIn || 0) + 1;
          done = true;
        } else if (tWall < Infinity || tGround < Infinity) {
          const t = Math.min(tWall, tGround);
          a.p.copy(p0).addScaledVector(d, Math.max(0, t - 0.05));
          this.burst(a.p, d, false, 2);
          if (G.Audio) G.Audio.play('arrowHit', { x: a.p.x, z: a.p.z, lv: a.lv });
          G.World.emit(a.p.x, a.p.z, 7, a.lv);                   // la flecha que se clava hace ruido donde cae
          // en el suelo o contra la pared: a veces se rompe; si no, se puede recoger
          if (Math.random() < 0.7) W.dropItem(a.p.x - d.x * 0.3, a.p.z - d.z * 0.3, 'mun_flecha', 1, a.lv);
          scene.remove(a.mesh);
          done = true;
        } else if (a.life > 4) { scene.remove(a.mesh); done = true; }
        if (!done) this.orient(a);
        if (done) arrows.splice(i, 1);
      }
      // flechas clavadas en zombis muertos: se recogen del suelo
      for (const z of zombies) {
        if (z.alive || !z.arrowsIn || z.fall < 1) continue;
        const dir = z.fallDir || -1;
        W.dropItem(z.pos.x + Math.sin(z.facing) * dir * 1.0, z.pos.z + Math.cos(z.facing) * dir * 1.0, 'mun_flecha', z.arrowsIn, z.lv);
        z.arrowsIn = 0;
        for (const c of z.model.body.children.slice()) if (c.userData.arrow) z.model.body.remove(c);
      }
    },

    // la flecha mira hacia donde vuela; la punta queda en a.p (un poco hundida al clavarse)
    orient(a) {
      _w.copy(a.v).normalize();
      a.mesh.position.copy(a.p).addScaledVector(_w, -0.62);
      _q.setFromUnitVectors(_up, _w);
      a.mesh.quaternion.copy(_q);
    }
  };

  Guns.hitZombie = hitZombie;
  Guns.rayCyl = rayCyl;
  Guns.raySphere = raySphere;
  G.Guns = Guns;
})(window.Game = window.Game || {});
