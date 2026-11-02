(function (G) {
  'use strict';

  // Objetos sueltos y arrojables (inspirado en el vídeo de referencia, con diseño y números propios)
  // - Los objetos aparecen encima de mesas, mostradores y escritorios, o en el suelo, repartidos por el mapa.
  //   Brillan un poco; de cerca muestran su icono blanco y se cogen con ∆ / T de pasada (un gesto rápido,
  //   sin pararse: si está en una mesa, estira el brazo; si está en el suelo, se agacha).
  // - Arrojables: ladrillo y botella. Solo se lleva uno. G, la cruceta arriba o el botón Lanzar lo tiran
  //   con un lanzamiento rápido al infectado fijado (el más centrado delante); si no hay ninguno, hacia
  //   donde miras. Al darle queda aturdido unos segundos (listo para rematarlo). Al caer hace ruido.

  const U = G.Util;
  const KINDS = {
    mun_9mm: { name: 'balas de 9 mm', n: [2, 4], w: 3, lift: 0 },
    mun_cartucho: { name: 'cartuchos', n: [1, 3], w: 0, lift: 0 },
    mun_rifle: { name: 'balas de rifle', n: [1, 2], w: 0, lift: 0 },
    mun_flecha: { name: 'flechas', n: [1, 3], w: 0, lift: 0.01 },
    mun_revolver: { name: 'balas de revólver', n: [1, 3], w: 0, lift: 0 },
    mun_smg: { name: 'balas de subfusil', n: [1, 3], w: 0, lift: 0.002 },     // (pocas: es la mejor arma)
    mun_gas: { name: 'combustible', n: [10, 20], w: 0, lift: 0 },
    mun_flecha_exp: { name: 'flechas explosivas', n: [1, 2], w: 0, lift: 0.01 },
    clavos: { name: 'clavos', n: [1, 2], w: 0.6, lift: 0.004 },
    chocolatina: { name: 'chocolatina', n: [1, 1], w: 0, lift: 0.012, eat: true },   // la sueltan los infectados: cura un poco al cogerla
    venda: { name: 'venda', n: [1, 1], w: 0.3, lift: 0 },            // rara: lo normal es fabricarla
    alcohol: { name: 'alcohol', n: [1, 1], w: 2.4, lift: 0.025 },
    trapo: { name: 'trapo', n: [1, 1], w: 1.3, lift: 0.01 },
    ladrillo: { name: 'Ladrillo', n: [1, 1], w: 2, lift: 0.034, thr: true },
    botella: { name: 'Botella', n: [1, 1], w: 2, lift: 0.035, thr: true },
    molotov: { name: 'Molotov', n: [1, 1], w: 0, lift: 0.035, thr: true },      // se fabrica: alcohol + trapo
    humo: { name: 'Bomba de humo', n: [1, 1], w: 0, lift: 0.035, thr: true },    // se fabrica: polvo reactivo + trapo
    polvo: { name: 'polvo reactivo', n: [1, 1], w: 0.25, lift: 0.045 },          // escaso
    tijeras: { name: 'tijeras', n: [1, 1], w: 0.6, lift: 0.004 },
    panuelo: { name: 'pañuelo', n: [1, 1], w: 0.7, lift: 0.006 },
    mina: { name: 'mina', n: [1, 1], w: 0.05, lift: 0.025 }                       // rarísima: lo normal es fabricarla
  };
  // armas largas de cuerpo a cuerpo tiradas en sitios concretos de los mapas (junto a bancos de trabajo,
  // cobertizos, hogueras, barricadas, vehículos...): se cogen como un arma (cambian la que llevas, que queda en
  // el suelo) y vienen algo gastadas
  const LONG_W = { hacha_bombero: 1, mazo: 0.8, pala: 1.2, tabla_clavos: 1.2, tabla: 0.7, machete: 1, lanza: 0.9, katana: 0.3 };
  // (todas las de cuerpo a cuerpo se pueden dejar en el suelo: la que sueltas al coger otra)
  for (const w of G.Weapons.LIST) if (w.cat !== 'gun' && w.cat !== 'none' && w.id !== 'puños' && !KINDS[w.id]) KINDS[w.id] = { name: w.name, n: [1, 1], w: 0, lift: 0.045, weapon: true };
  // dónde dejarlas: al lado de estos muebles
  const MELEE_AT = { banco: 1, tablero: 1, cobertizo: 1, fogata: 1, barricada: 1, tarima: 1, tablas: 1, refugio_lona: 1, palets: 1, camion: 1, camioneta: 1,
    coche: 1, patrulla: 1, ambulancia: 1, escombro_grande: 1, bidones: 1, estante: 1, estanteria: 1, mostrador: 1, carrito: 1, cubos: 1, galpon: 1, montacargas: 1 };
  // munición de las armas que llevas en las manos (reparto de un peso total entre sus tipos de bala)
  function ammoWeights(player, total) {
    const o = {};
    const guns = player ? player.hands.filter(Boolean).map((s) => G.Weapons.get(s.id)).filter((w) => G.Weapons.isGun(w) && G.Weapons.AMMO[w.ammo]) : [];
    const ids = [];
    for (const w of guns) { const id = G.Weapons.AMMO[w.ammo].item; if (KINDS[id] && ids.indexOf(id) < 0) ids.push(id); }
    // (la señora Paula: el combustible sale bastante más a menudo)
    const fuel = player && player.perks ? player.perks.fuel : 1;
    let sum = 0;
    for (const id of ids) sum += id === 'mun_gas' ? fuel : 1;
    for (const id of ids) o[id] = total * (id === 'mun_gas' ? fuel : 1) / sum * (id === 'mun_gas' && fuel > 1 ? Math.min(1.6, 0.6 + 0.5 * ids.length) : 1);
    return o;
  }
  // mina colocada: tarda en armarse; la pisa un infectado y revienta (la jugadora no la activa y la puede recoger)
  const MINE_ARM = 0.8, MINE_TRIG = 0.55;
  const TABLES = { mesita: 1, comoda: 1, encimera: 1, mesa: 1, escritorio: 1, mostrador: 1, banco: 1, mueble_tv: 1, cajas: 1, carrito: 1, fregadero: 1, hockey: 1, maquina_rota: 1 };
  const REACH = 1.55;            // distancia para cogerlo
  const ICON_D = 6;              // a esta distancia se ve el icono
  const GLINT_D = 16;            // y el brillo
  const THROW_SPEED = 15, GRAV = 9.8;

  // munición con color (para distinguirla de un vistazo); lo demás, en blanco
  const TINT = { mun_9mm: '#f0b43c', mun_cartucho: '#f0b43c', mun_rifle: '#f0b43c', mun_flecha: '#f0b43c', mun_revolver: '#f0b43c', mun_smg: '#f0b43c', mun_gas: '#f0b43c', mun_flecha_exp: '#f0b43c', alcohol: '#8fd3ff', chocolatina: '#ffb08a' };
  const tintCache = {};
  function tinted(id, url, cb) {
    if (tintCache[id]) { cb(tintCache[id]); return; }
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      // conserva el sombreado del icono blanco y lo tiñe
      x.globalCompositeOperation = 'multiply'; x.fillStyle = TINT[id]; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
      try { tintCache[id] = c.toDataURL('image/png'); } catch (e) { tintCache[id] = url; }
      cb(tintCache[id]);
    };
    im.onerror = () => cb(url);
    im.src = url;
  }

  let arc = null, arcGeo = null, landMark = null, arcPts = null;
  const ARC_N = 96;
  let scene = null, mat = null, glintTex = null, layer = null, lockEl = null;
  const items = [];              // { id, n, x, y, z, lv, mesh, glint, el }
  const flying = [];             // proyectiles en vuelo
  let points = null;             // posibles sitios (se calculan una vez por mundo)
  const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3();

  function texGlint() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.18, 'rgba(255,245,210,0.55)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    // destello en cruz
    x.fillStyle = 'rgba(255,255,245,0.85)';
    x.fillRect(31, 4, 2, 56); x.fillRect(4, 31, 56, 2);
    return new THREE.CanvasTexture(c);
  }

  function init(sc) {
    scene = sc;
    mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    glintTex = texGlint();
    layer = document.getElementById('picks');
    lockEl = document.getElementById('thr-lock');
    // las luces del fuego y de las explosiones se crean ya (crearlas en mitad de la partida da tirones)
    setTimeout(() => { Fire.ensureLight(); Boom.init(); }, 0);
    // línea de trayectoria (botella o ladrillo apuntando, y flechas): una cinta verde agua semitransparente
    // que mira a la cámara, y una marca donde cae
    const N = ARC_N;
    arcPts = new Float32Array(N * 3);
    arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx = [];
    for (let k = 0; k < N - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    arcGeo.setIndex(idx);
    arcGeo.setDrawRange(0, 0);
    arc = new THREE.Mesh(arcGeo, new THREE.MeshBasicMaterial({ color: 0x5ff0cf, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    arc.frustumCulled = false; arc.visible = false; arc.renderOrder = 5;
    scene.add(arc);
    landMark = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0x5ff0cf, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    landMark.rotation.x = -Math.PI / 2; landMark.visible = false; landMark.renderOrder = 5;
    scene.add(landMark);
  }

  // A dónde va un lanzamiento sin blanco: hacia donde mira la cámara, al suelo o a lo que haya (máx. 16 m)
  function freeAim(player) {
    const C = G.Camera;
    _o.copy(C.pos); _d.copy(C.dir).normalize();
    let t = 16;
    if (_d.y < -0.02) t = Math.min(t, (_o.y - player.y) / -_d.y);
    return _o.clone().addScaledVector(_d, Math.max(4, t));
  }
  function throwVel(start, aim) {
    const dx = aim.x - start.x, dz = aim.z - start.z, dh = Math.hypot(dx, dz) || 0.01;
    const T = Math.max(0.15, dh / THROW_SPEED);
    return new THREE.Vector3(dx / T, (aim.y - start.y + 0.5 * GRAV * T * T) / T, dz / T);
  }
  // simula una trayectoria con gravedad g desde start con velocidad v; guarda los puntos (cada ~0,35 m) y
  // dónde para (suelo, mueble, pared). Devuelve el número de puntos
  const _a0 = new THREE.Vector3(), _a1 = new THREE.Vector3(), _av = new THREE.Vector3();
  function simPath(start, v, g, lv, maxT) {
    const W = G.World;
    _a1.copy(start); _av.copy(v);
    const sp = Math.max(1, _av.length()), dt = Math.min(0.03, 0.35 / sp);
    let n = 0, land = null;
    arcPts[0] = _a1.x; arcPts[1] = _a1.y; arcPts[2] = _a1.z; n = 1;
    for (let t = 0; t < maxT && n < ARC_N; t += dt) {
      _a0.copy(_a1);
      _av.y -= g * dt; _a1.addScaledVector(_av, dt);
      if (W.lineHit(_a0.x, _a0.z, _a1.x, _a1.z, W.blocksSightEdge, lv) >= 0) { land = null; break; }
      const gy0 = W.groundY(_a1.x, _a1.z, lv), gy = gy0 + Math.max(0, W.furnTop(_a1.x, _a1.z, lv) - gy0);
      if (_a1.y <= gy) { _a1.y = gy; land = _a1.clone(); arcPts[n * 3] = _a1.x; arcPts[n * 3 + 1] = _a1.y + 0.02; arcPts[n * 3 + 2] = _a1.z; n++; break; }
      arcPts[n * 3] = _a1.x; arcPts[n * 3 + 1] = _a1.y; arcPts[n * 3 + 2] = _a1.z; n++;
    }
    return { n, land };
  }
  // dibuja la cinta con los n puntos de arcPts (ancho según la distancia a la cámara)
  function drawArc(n, land, camera) {
    if (n < 2) { arc.visible = false; landMark.visible = false; return; }
    const pos = arcGeo.attributes.position.array, cp = camera.position;
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
      const tx = arcPts[b * 3] - arcPts[a * 3], ty = arcPts[b * 3 + 1] - arcPts[a * 3 + 1], tz = arcPts[b * 3 + 2] - arcPts[a * 3 + 2];
      const vx = cp.x - arcPts[k * 3], vy = cp.y - arcPts[k * 3 + 1], vz = cp.z - arcPts[k * 3 + 2];
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
      const dist = Math.hypot(vx, vy, vz), sl = Math.hypot(sx, sy, sz) || 1;
      const w = (0.012 + 0.0025 * dist) / sl;
      sx *= w; sy *= w; sz *= w;
      pos[k * 6] = arcPts[k * 3] + sx; pos[k * 6 + 1] = arcPts[k * 3 + 1] + sy; pos[k * 6 + 2] = arcPts[k * 3 + 2] + sz;
      pos[k * 6 + 3] = arcPts[k * 3] - sx; pos[k * 6 + 4] = arcPts[k * 3 + 1] - sy; pos[k * 6 + 5] = arcPts[k * 3 + 2] - sz;
    }
    arcGeo.attributes.position.needsUpdate = true;
    arcGeo.setDrawRange(0, (n - 1) * 6);
    arc.visible = true;
    if (land) { landMark.position.set(land.x, land.y + 0.03, land.z); landMark.visible = true; } else landMark.visible = false;
  }
  function hideArc() { if (arc) { arc.visible = false; landMark.visible = false; } }
  // botella o ladrillo en la mano y apuntando: desde la mano
  function updateArc(player, camera) {
    const h = player.model;
    h.root.updateMatrixWorld(true);
    const start = h.handR.getWorldPosition(new THREE.Vector3());
    const r = simPath(start, throwVel(start, freeAim(player)), GRAV, player.lv || 0, 3);
    drawArc(r.n, r.land, camera);
  }


  // ---------- Sitios donde pueden aparecer ----------
  function findPoints() {
    const W = G.World, out = [];
    const CS = W.CS, A0 = W.ARENA_MIN, A1 = W.ARENA_MAX;
    const c0 = Math.floor(A0 / CS), c1 = Math.floor((A1 - 1) / CS);
    const rng = U.mulberry32(((W.stats().seed || 1) % 100000) + 77);
    for (let cz = c0; cz <= c1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const c = W.chunkAt(cx, cz);
        for (const f of c.furn) {
          if (!TABLES[f.type] || (f.x1 - f.x0) < 0.35 || (f.z1 - f.z0) < 0.3) continue;
          const x = U.lerp(f.x0 + 0.12, f.x1 - 0.12, rng()), z = U.lerp(f.z0 + 0.1, f.z1 - 0.1, rng());
          // que no haya otro mueble encima (una estantería, por ejemplo)
          if (W.furnTop(x, z, f.lv || 0) > f.y + f.h + 0.1) continue;
          out.push({ x, z, y: f.y + f.h, lv: f.lv || 0, table: true });
        }
      }
    }
    // en el suelo: dentro y fuera de los edificios, lejos de las paredes
    for (let i = 0, tries = 0; i < 70 && tries < 900; tries++) {
      const x = U.lerp(A0 + 3, A1 - 3, rng()), z = U.lerp(A0 + 3, A1 - 3, rng());
      if (W.circleBlocked(x, z, 0.45, 0) || W.furnTop(x, z, 0, 0.3) > 0) continue;
      out.push({ x, z, y: W.groundY(x, z, 0), lv: 0, table: false, indoor: W.isIndoor(Math.floor(x), Math.floor(z), 0) });
      i++;
    }
    return out;
  }

  function pickKind(rng, weights) {
    let tot = 0;
    for (const k in weights) tot += weights[k];
    let r = rng() * tot;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return 'mun_9mm';
  }

  function makeMesh(id) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(G.Models.weaponGeometry(id), mat);
    m.rotation.x = Math.PI / 2;            // tumbado: lo que en el modelo es -Z queda arriba
    m.position.y = KINDS[id].lift || 0;
    m.castShadow = false;            // objetos pequeños: su sombra no se nota y cuesta
    g.add(m);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    s.material.toneMapped = false;
    s.scale.setScalar(0.22);
    s.position.y = 0.09;
    g.add(s);
    return { group: g, glint: s };
  }

  function add(id, n, p) {
    const k = KINDS[id];
    const it = { id, n: n != null ? n : k.n[0] + Math.floor(Math.random() * (k.n[1] - k.n[0] + 1)), x: p.x, y: p.y, z: p.z, lv: p.lv || 0, ph: Math.random() * 6 };
    const mm = makeMesh(id);
    it.mesh = mm.group; it.glint = mm.glint;
    it.mesh.position.set(p.x, p.y + 0.004, p.z);
    it.mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(it.mesh);
    if (layer) {
      const u = G.Icons.white(id);
      const d = document.createElement('div');
      d.className = 'pk hidden k-' + id + (id.indexOf('mun') === 0 ? ' k-mun' : '');
      d.innerHTML = (u ? '<img alt="">' : '') + (it.n > 1 ? '<span>' + it.n + '</span>' : '') + '<em>MAX</em><i></i>';
      if (u) {
        const img = d.querySelector('img');
        if (TINT[id]) tinted(id, u, (t) => { img.src = t; }); else img.src = u;
      }
      layer.appendChild(d);
      it.el = d;
    }
    items.push(it);
    return it;
  }

  function removeAt(i) {
    const it = items[i];
    if (it.mesh.parent) it.mesh.parent.remove(it.mesh);
    it.glint.material.dispose();
    if (it.el) it.el.remove();
    items.splice(i, 1);
  }

  function clear() {
    while (items.length) removeAt(items.length - 1);
    for (const f of flying) if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
    flying.length = 0;
    Fire.clear();
    Boom.clear();
    Spores.clear();
    if (G.Gore) G.Gore.clear();
  }

  // n objetos repartidos (al menos a 5 m entre sí y a 4 m de la protagonista), con pesos por tipo
  function spawn(n, opts) {
    opts = opts || {};
    if (!points) points = findPoints();
    const P = G.debug && G.debug.player;
    const rng = Math.random;
    let weights = opts.weights || { _ammo: 3, venda: KINDS.venda.w, alcohol: KINDS.alcohol.w, trapo: KINDS.trapo.w, ladrillo: KINDS.ladrillo.w, botella: KINDS.botella.w,
      polvo: KINDS.polvo.w, clavos: KINDS.clavos.w, mina: KINDS.mina.w };
    // _ammo: ese peso, repartido entre la munición de las armas que llevas (y nada si no llevas ninguna)
    if (weights._ammo != null) {
      const w2 = Object.assign({}, weights), am = ammoWeights(P, weights._ammo);
      delete w2._ammo;
      for (const k in am) w2[k] = (w2[k] || 0) + am[k];
      weights = w2;
    }
    if (!Object.keys(weights).length) return 0;
    let made = 0;
    for (let tries = 0; made < n && tries < n * 30; tries++) {
      const p = points[Math.floor(rng() * points.length)];
      if (!p) break;
      if (P && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < (opts.near != null ? opts.near : 4)) continue;
      // area: solo dentro de ese rectángulo (la sala del jefe); gap: separación entre objetos
      const A = opts.area;
      if (A && (p.x < A.x0 || p.x > A.x1 || p.z < A.z0 || p.z > A.z1)) continue;
      if (items.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < (opts.gap || 4.5))) continue;
      const id = pickKind(rng, weights);
      // los arrojables caen más en el suelo y en la calle; lo demás, más en las mesas
      if (KINDS[id].thr && p.table && rng() < 0.5) continue;
      if (!KINDS[id].thr && !p.table && rng() < 0.4) continue;
      // la munición, con algo más de balas que antes
      const k = KINDS[id];
      add(id, id.indexOf('mun_') === 0 ? k.n[0] + 1 + Math.floor(rng() * (k.n[1] - k.n[0] + 1)) : null, p);
      made++;
    }
    return made;
  }

  // Lo que suelta un infectado al morir (modo Retorno): a veces nada, a veces munición de un arma que llevas,
  // materiales o una chocolatina. Cae en el suelo junto al cuerpo
  // (los infectados ya no sueltan chocolatinas: son ocasionales, solo en algún cofre)
  const DROP_W = { ammo: 34, trapo: 16, alcohol: 15, clavos: 12, polvo: 6 };
  function drop(z, player, chance, n) {
    if (Math.random() >= (chance == null ? 0.45 : chance)) return 0;
    let made = 0;
    for (let k = 0; k < (n || 1); k++) {
      let id = pickKind(Math.random, DROP_W);
      if (id === 'ammo') {
        // (solo de las armas que llevas en las manos; sin ninguna, un material)
        const guns = player ? player.hands.filter(Boolean).map((s) => G.Weapons.get(s.id)).filter((w) => G.Weapons.isGun(w) && G.Weapons.AMMO[w.ammo] && KINDS[G.Weapons.AMMO[w.ammo].item]) : [];
        if (!guns.length) { id = 'trapo'; } else {
          const w = guns[Math.floor(Math.random() * guns.length)];
          id = G.Weapons.AMMO[w.ammo].item;
        }
      }
      const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.45;
      let x = z.pos.x + Math.sin(a) * r, zz = z.pos.z + Math.cos(a) * r;
      if (G.World.circleBlocked(x, zz, 0.12, z.lv || 0)) { x = z.pos.x; zz = z.pos.z; }
      const n1 = id === 'mun_9mm' ? 2 + Math.floor(Math.random() * 2) : (KINDS[id].n[0] + Math.floor(Math.random() * (KINDS[id].n[1] - KINDS[id].n[0] + 1)));
      add(id, n1, { x, y: G.World.groundY(x, zz, z.lv || 0), z: zz, lv: z.lv || 0 });
      made++;
    }
    return made;
  }

  // n armas largas de cuerpo a cuerpo junto a muebles concretos del mapa (sin repetir sitio, lejos de ti)
  function spawnMelee(n) {
    const W = G.World, CS = W.CS, A0 = W.ARENA_MIN, A1 = W.ARENA_MAX, P = G.debug && G.debug.player;
    const c0 = Math.floor(A0 / CS), c1 = Math.floor((A1 - 1) / CS), spots = [];
    for (let cz = c0; cz <= c1; cz++) for (let cx = c0; cx <= c1; cx++) {
      for (const f of W.chunkAt(cx, cz).furn) {
        if (!MELEE_AT[f.type] || f.gone || (f.lv || 0)) continue;
        const cxm = (f.x0 + f.x1) / 2, czm = (f.z0 + f.z1) / 2;
        if (cxm < A0 + 1 || cxm > A1 - 1 || czm < A0 + 1 || czm > A1 - 1) continue;
        // delante del mueble (o a un costado), en el suelo libre
        const hw = (f.x1 - f.x0) / 2, hd = (f.z1 - f.z0) / 2;
        for (const [ox, oz] of [[f.fx, f.fz], [f.fz, -f.fx], [-f.fz, f.fx], [-f.fx, -f.fz]]) {
          const x = cxm + ox * (Math.abs(ox) * hw + 0.55), z = czm + oz * (Math.abs(oz) * hd + 0.55);
          if (W.circleBlocked(x, z, 0.3, 0) || W.furnTop(x, z, 0, 0.3) > 0.15) continue;
          if (P && Math.hypot(x - P.pos.x, z - P.pos.z) < 6) continue;
          spots.push({ x, z, y: W.groundY(x, z, 0), lv: 0 });
          break;
        }
      }
    }
    let made = 0;
    while (made < n && spots.length) {
      const p = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      if (items.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 6)) continue;
      const it = add(pickKind(Math.random, LONG_W), 1, p);
      it.cond = 0.45 + Math.random() * 0.45;
      it.mesh.rotation.y = Math.random() * Math.PI * 2;
      made++;
    }
    return made;
  }
  // durante la pelea: si hay poca munición tuya en el suelo, aparece algo más (lejos de ti)
  let refillT = 0;
  function refillAmmo(dt, player) {
    refillT -= dt;
    if (refillT > 0) return;
    refillT = 28 + Math.random() * 14;
    const am = ammoWeights(player, 1);
    const have = items.filter((it) => am[it.id] != null).length;
    if (!Object.keys(am).length || have >= 3) return;
    spawn(have ? 1 : 2, { weights: am, near: 9, gap: 3 });
  }

  // Al reiniciar el mundo
  function reset() { clear(); points = null; refillT = 20; }
  // un humano saquea algo del suelo: lo quita y devuelve { id, n } (lo suelta al morir)
  function take(it) {
    const i = items.indexOf(it);
    if (i < 0 || it.armed) return null;
    const r = { id: it.id, n: it.n };
    removeAt(i);
    return r;
  }

  // ---------- Coger ----------
  // el objeto más cercano que se puede coger (al alcance y sin pared en medio)
  function near(player) {
    let best = null, bd = REACH;
    for (const it of items) {
      if ((it.lv || 0) !== (player.lv || 0)) continue;
      const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
      if (d < bd && Math.abs(it.y - player.y) < 1.6) { bd = d; best = it; }
    }
    if (best && !G.World.hasLOS(player.pos.x, player.pos.z, best.x, best.z, player.lv)) best = null;
    return best;
  }
  function label(it) {
    const k = KINDS[it.id];
    if (k.weapon) return 'Coger: ' + k.name.toLowerCase();
    return 'Coger ' + (k.thr ? k.name.toLowerCase() : (it.n > 1 ? it.n + ' ' : '') + k.name);
  }

  // un paso hacia lo que recoge: la mano tiene que llegar de verdad al objeto (no lo agarra a un metro)
  function pickStep(player, it) {
    const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z) - 0.5;
    return d > 0.05 ? { len: Math.min(1.2, d), done: 0 } : null;
  }
  function startPickup(player, it) {
    if (!it || player.busy() || player.struggle) return null;
    const k = KINDS[it.id];
    if (k.weapon) {
      const hi = it.y - player.y > 0.45;
      player.action = { kind: hi ? 'pickupHi' : 'pickup', t: 0, dur: hi ? 0.5 : 0.62, impact: 0.42, face: Math.atan2(it.x - player.pos.x, it.z - player.pos.z), item: it, done: false, step: pickStep(player, it) };
      return null;
    }
    // la molotov va aparte: llevando molotovs puedes coger igual una botella o un ladrillo
    if (k.thr && it.id !== 'molotov' && it.id !== 'humo' && player.throwable) return 'Ya llevas ' + (player.throwable === 'ladrillo' ? 'un ladrillo' : 'una botella') + ' (lánzalo antes)';
    if (k.eat && player.itemRoom(it.id) <= 0) return 'Tienes la vida llena';
    if (!k.thr && player.itemRoom(it.id) <= 0) return 'No te cabe más ' + k.name;
    if ((it.id === 'molotov' || it.id === 'humo') && player.fullOf(it.id)) return 'No te caben más: ' + k.name.toLowerCase();
    const hi = it.y - player.y > 0.45;
    player.action = { kind: hi ? 'pickupHi' : 'pickup', t: 0, dur: hi ? 0.5 : 0.62, impact: 0.42, face: Math.atan2(it.x - player.pos.x, it.z - player.pos.z), item: it, done: false, step: pickStep(player, it) };
    return null;
  }

  function collect(player, a, quiet) {
    const it = a.item, i = items.indexOf(it);
    if (i < 0) return null;
    const k = KINDS[it.id];
    let msg;
    if (G.Audio) G.Audio.play('pickup');
    if (k.weapon) {
      // un arma: cambia la que llevabas de ese tipo (la vieja queda en el suelo, donde estaba esta)
      const at = { x: it.x, y: it.y, z: it.z, lv: it.lv };
      removeAt(i);
      const r = player.pickUp(it.id, it.cond != null ? it.cond : 0.7, 1);
      if (!r || !r.ok) { add(it.id, 1, at).cond = it.cond; msg = 'No tienes sitio para ' + k.name.toLowerCase(); }
      else {
        msg = 'Cogiste: ' + k.name.toLowerCase();
        if (r.old && KINDS[r.old.id] && KINDS[r.old.id].weapon) { const o = add(r.old.id, 1, at); o.cond = r.old.cond; }
        // con las manos libres, el arma queda en la mano hasta terminar de incorporarse (luego la guarda)
        if (G.Weapons.kindOf(it.id) === 0 && player.cur === -1 && player.hands[0] && player.hands[0].id === it.id) player.pickHold = { w: G.Weapons.get(it.id) };
      }
      if (Pickups.onMessage && !quiet) Pickups.onMessage(msg, 'good');
      if (G.Mode && G.Mode.stats) G.Mode.stats.picked++;
      return msg;
    }
    if (k.thr && (it.id === 'molotov' || it.id === 'humo')) {
      player.items[it.id] = (player.items[it.id] || 0) + 1;
      msg = KINDS[it.id].name + ' (' + player.items[it.id] + ')';
      removeAt(i);
    } else if (k.thr) {
      if (player.throwable) return;
      player.throwable = it.id;
      player.equip(-2);                        // se pone en la mano (se cambia con la cruz de armas)
      msg = (it.id === 'ladrillo' ? 'Ladrillo' : 'Botella') + ' en la mano: apunta para ver dónde cae y ataca para lanzar' + (it.id === 'ladrillo' ? 'lo' : 'la');
      removeAt(i);
    } else {
      const r = player.takeItem(it.id, it.n);
      msg = r.msg;
      if (r.left > 0) { it.n = r.left; const s = it.el && it.el.querySelector('span'); if (s) s.textContent = it.n; }
      else removeAt(i);
    }
    if (Pickups.onMessage && !quiet) Pickups.onMessage(msg, 'good');
    if (G.Mode && G.Mode.stats) G.Mode.stats.picked++;
    return msg;
  }

  // Mantener Recoger: coge de una vez todo lo que se puede coger y está delante (al alcance, a la vista)
  function collectAll(player, fx, fz) {
    if (!player || player.dead || player.struggle) return 0;
    const fa = Math.atan2(fx, fz), got = [];
    const list = items.filter((it) => {
      if ((it.lv || 0) !== (player.lv || 0)) return false;
      const dx = it.x - player.pos.x, dz = it.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d > REACH * 1.2 || Math.abs(it.y - player.y) > 1.6) return false;
      if (d > 0.45 && Math.abs(U.angleDiff(Math.atan2(dx, dz), fa)) > 1.25) return false;
      return G.World.hasLOS(player.pos.x, player.pos.z, it.x, it.z, player.lv);
    });
    for (const it of list) {
      const k = KINDS[it.id];
      if (k.weapon) continue;              // (las armas, de una en una)
      if (k.thr && it.id !== 'molotov' && it.id !== 'humo' && player.throwable) continue;
      if (k.eat && player.itemRoom(it.id) <= 0) continue;
      if (!k.thr && player.itemRoom(it.id) <= 0) continue;
      if ((it.id === 'molotov' || it.id === 'humo') && player.fullOf(it.id)) continue;
      const n0 = it.n;
      if (collect(player, { item: it }, true)) got.push((n0 > 1 ? n0 + ' ' : '') + k.name.toLowerCase());
    }
    if (got.length) {
      if (!player.busy()) player.action = { kind: 'pickup', t: 0, dur: 0.62, impact: 0.42, face: fa, item: null, done: false };
      if (Pickups.onMessage) Pickups.onMessage('Cogiste: ' + got.join(', '), 'good');
    }
    return got.length;
  }

  // ---------- Lanzar ----------
  // infectado fijado: el más centrado hacia donde miras, hasta 15 m, a la vista
  function lockTarget(player, zombies, camYaw) {
    let best = null, bs = Infinity;
    for (const z of zombies) {
      if (!z.alive || !z.standing || (z.lv || 0) !== (player.lv || 0) || z.state === 'held' || z.state === 'grapple') continue;
      const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d > 15 || d < 0.8) continue;
      const a = Math.abs(U.angleDiff(Math.atan2(dx, dz), camYaw));
      if (a > 0.75) continue;
      const s = a * 6 + d * 0.25;
      if (s < bs && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bs = s; best = z; }
    }
    return best;
  }

  function startThrow(player, zombies, camYaw) {
    const id = player.inHandThr || player.throwable;
    if (!id) return null;
    if (player.busy() || player.struggle || player.dead || player.climb) return null;
    // apuntando con él en la mano: va por la parábola que ves; si no, al infectado fijado (si hay)
    const tgt = player.aiming && player.holdingThr ? null : lockTarget(player, zombies, camYaw);
    const face = tgt ? Math.atan2(tgt.pos.x - player.pos.x, tgt.pos.z - player.pos.z) : camYaw;
    // apuntando: el punto al que va se fija ya (la parábola que ves), aunque al soltar la cámara se aleje
    const aimPt = !tgt && player.aiming ? freeAim(player).clone() : null;
    player.action = { kind: 'throw', t: 0, dur: 0.78, impact: 0.46, face, item: id, target: tgt, aimPt, done: false };
    if (player.stance === 'prone') player.stance = 'crouch';
    return null;
  }

  // Coloca la mina que llevas en la mano delante de los pies
  function placeMine(player) {
    if (!(player.items.mina > 0)) return;
    const W = G.World, f = player.facing, lv = player.lv || 0;
    let x = player.pos.x + Math.sin(f) * 0.5, z = player.pos.z + Math.cos(f) * 0.5;
    if (W.circleBlocked(x, z, 0.1, lv)) { x = player.pos.x; z = player.pos.z; }
    const it = add('mina', 1, { x, y: W.groundY(x, z, lv), z, lv });
    it.armed = true; it.armT = MINE_ARM;
    player.items.mina--;
    if (G.Audio) G.Audio.play('magIn', { x, z, lv });
    if (!player.items.mina && player.cur === -5) { const b = player.prev; player.equip(b >= 0 && player.hands[b] ? b : -1); }
    else player.refreshModel();
  }
  function updateMines(dt, zombies) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!it.armed) continue;
      if (it.armT > 0) { it.armT -= dt; continue; }
      for (const z of zombies) {
        if (!z.alive || (z.lv || 0) !== it.lv) continue;
        if (Math.hypot(z.pos.x - it.x, z.pos.z - it.z) < MINE_TRIG) {
          const x = it.x, y = it.y, zz = it.z, lv = it.lv;
          removeAt(i);
          Boom.explode(x, y + 0.15, zz, lv, null, { mine: true });
          break;
        }
      }
    }
  }

  // suelta el proyectil desde la mano (lo llama Combat en el momento del lanzamiento)
  function release(player, a) {
    const id = a.item;
    if (!id) return;
    if (id === 'molotov' || id === 'humo') { if (!(player.items[id] > 0)) return; player.items[id]--; }
    else { if (player.throwable !== id) return; player.throwable = null; }
    if (G.Audio) G.Audio.play('throwIt');
    if ((player.cur === -2 || player.cur === -4 || player.cur === -6) && !player.inHandThr) { const b = player.prev; player.equip(b >= 0 && player.hands[b] ? b : -1); if (player.aiming && G.Input && G.Input.setAim) G.Input.setAim(false); }
    const h = player.model;
    h.root.updateMatrixWorld(true);
    const start = h.handR.getWorldPosition(new THREE.Vector3());
    let aim;
    const z = a.target;
    if (z && z.alive) {
      // a la cabeza, donde va a estar cuando llegue
      const d0 = Math.hypot(z.pos.x - start.x, z.pos.z - start.z);
      const T = Math.max(0.12, d0 / THROW_SPEED);
      const vx = (z.speedNow || 0) * Math.sin(z.facing), vz = (z.speedNow || 0) * Math.cos(z.facing);
      aim = new THREE.Vector3(z.pos.x + vx * T * 0.8, z.y + 1.5, z.pos.z + vz * T * 0.8);
    } else aim = a.aimPt || freeAim(player);       // donde marcaba la parábola (o hacia donde mira la cámara)
    const v = throwVel(start, aim);
    const mesh = new THREE.Mesh(G.Models.weaponGeometry(id), mat);
    mesh.castShadow = true;
    mesh.position.copy(start);
    scene.add(mesh);
    const fl = { id, mesh, p: start, v, spin: new THREE.Vector3(8 + Math.random() * 6, Math.random() * 4, 3), life: 0, lv: player.lv || 0, target: z };
    if (id === 'molotov') fl.flame = Fire.sprite(mesh, 0, 0.17, 0, 0.16);      // el trapo va encendido
    flying.push(fl);
    G.World.emit(player.pos.x, player.pos.z, 2, player.lv);
    if (G.Mode && G.Mode.stats) G.Mode.stats.thrown++;
  }

  function impact(f, p, d, z) {
    if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
    if (f.flame) Fire.detachSprite(f.flame);
    if (f.id === 'humo') {
      // bomba de humo: nube gris que aturde (sin daño)
      Spores.burst(p.x, G.World.groundY(p.x, p.z, f.lv), p.z, f.lv, SMOKE_R, null, G.debug && G.debug.player, false, false, true);
      return;
    }
    if (f.id === 'molotov') {
      // se rompe y prende: un charco de fuego donde cae (o a los pies del infectado al que le dio)
      if (G.Guns && G.Guns.burst) G.Guns.burst(p, d, false, 8);
      if (G.Audio) G.Audio.play('molotov', { x: p.x, z: p.z, lv: f.lv });
      G.World.emit(p.x, p.z, 12, f.lv);
      const W = G.World, gx = z ? z.pos.x : p.x, gz = z ? z.pos.z : p.z;
      Fire.spawn(gx, W.groundY(gx, gz, f.lv), gz, f.lv, z);
      if (G.Camera.hitFx) G.Camera.hitFx(0.2, 1);
      return;
    }
    const brick = f.id === 'ladrillo';
    if (G.Guns && G.Guns.burst) G.Guns.burst(p, d, false, brick ? 7 : 10);
    if (G.Audio) G.Audio.play(brick ? 'brick' : 'bottle', { x: p.x, z: p.z, lv: f.lv });
    // el golpe se oye: atrae a los que no te han visto (sirve de distracción)
    G.World.emit(p.x, p.z, brick ? 18 : 22, f.lv);
    if (z) {
      z.takeHit(brick ? 0.45 : 0.3, 0.2, d.x, d.z, false, 1, 'side', 'body');
      if (z.alive && !z.temb) {
        z.stun(z.blind ? 1.7 : 2.6, d.x, d.z, 1.6);
        if (G.Mode && G.Mode.stats) G.Mode.stats.stun++;
      }
      if (G.Combat.onHit) G.Combat.onHit(z.alive ? 'hit' : 'kill', false);
      if (G.Camera.hitFx) G.Camera.hitFx(0.25, 1);
      if (Pickups.onMessage) Pickups.onMessage('¡Aturdido! Remátalo', 'good');
    }
  }

  function updateFlying(dt, zombies) {
    const W = G.World;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.life += dt;
      const p0 = f.p.clone();
      f.v.y -= GRAV * dt;
      f.p.addScaledVector(f.v, dt);
      const seg = f.p.clone().sub(p0), L = seg.length() || 1e-4;
      _d.copy(seg).divideScalar(L);
      let done = false;
      // infectados
      let bz = null, bt = Infinity;
      for (const z of zombies) {
        if (!z.alive || (z.lv || 0) !== f.lv) continue;
        if (Math.abs(z.pos.x - p0.x) > L + 1.5 || Math.abs(z.pos.z - p0.z) > L + 1.5) continue;
        const h = G.Guns.hitZombie(z, p0, _d);
        if (h && h.t <= L + 0.15 && h.t < bt) { bt = h.t; bz = z; }
      }
      const fw = W.lineHit(p0.x, p0.z, f.p.x, f.p.z, W.blocksSightEdge, f.lv);
      const tW = fw >= 0 ? fw * L : Infinity;
      const gy = W.groundY(f.p.x, f.p.z, f.lv) + Math.max(0, W.furnTop(f.p.x, f.p.z, f.lv) - W.groundY(f.p.x, f.p.z, f.lv));
      const tG = f.p.y < gy ? L * (p0.y - gy) / Math.max(1e-4, p0.y - f.p.y) : Infinity;
      if (bz && bt <= tW && bt <= tG) { impact(f, p0.clone().addScaledVector(_d, bt), _d.clone(), bz); done = true; }
      else if (tW < Infinity || tG < Infinity) { impact(f, p0.clone().addScaledVector(_d, Math.max(0, Math.min(tW, tG) - 0.05)), _d.clone(), null); done = true; }
      else if (f.life > 4) { if (f.mesh.parent) f.mesh.parent.remove(f.mesh); done = true; }
      if (done) { flying.splice(i, 1); continue; }
      f.mesh.position.copy(f.p);
      f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt;
    }
  }

  // ---------- Cada fotograma ----------
  function update(dt, player, zombies, camera, camYaw, playing) {
    updateFlying(dt, zombies);
    if (dt > 0) updateMines(dt, zombies);
    Fire.update(dt, player, zombies);
    Boom.update(dt);
    Spores.update(dt, player);
    const t = performance.now() / 1000;
    const Wd = window.innerWidth, H = window.innerHeight;
    const pick = playing && !player.dead ? near(player) : null;
    for (const it of items) {
      const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
      const sameLv = (it.lv || 0) === (player.lv || 0);
      // brillo que late (más fuerte de cerca)
      const gl = sameLv && d < GLINT_D;
      it.glint.visible = gl;
      if (gl) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + it.ph);
        it.glint.material.opacity = (0.25 + 0.55 * pulse) * Math.min(1, (GLINT_D - d) / 4);
        it.glint.scale.setScalar(0.16 + 0.1 * pulse);
      }
      if (!it.el) continue;
      const show = playing && sameLv && d < ICON_D;
      if (!show) { if (!it.el.classList.contains('hidden')) it.el.classList.add('hidden'); continue; }
      _v.set(it.x, it.y + 0.28, it.z).project(camera);
      let sx = (_v.x * 0.5 + 0.5) * Wd, sy = (-_v.y * 0.5 + 0.5) * H;
      const behind = _v.z > 1;
      const off = behind || sx < 24 || sx > Wd - 24 || sy < 24 || sy > H - 24;
      if (off) {
        // fuera de la pantalla: en el borde, hacia donde está
        if (d > 4) { it.el.classList.add('hidden'); continue; }
        let ax = sx - Wd / 2, ay = sy - H / 2;
        if (behind) { ax = -ax; ay = -ay; }
        const k = Math.min((Wd / 2 - 30) / Math.max(1, Math.abs(ax)), (H / 2 - 30) / Math.max(1, Math.abs(ay)));
        sx = Wd / 2 + ax * k; sy = H / 2 + ay * k;
      }
      it.el.classList.remove('hidden');
      it.el.classList.toggle('edge', off);
      it.el.classList.toggle('near', it === pick);
      // ya no te cabe más: MAX en rojo sobre el icono
      const full = player.fullOf(it.id);
      if (full !== !!it.full) { it.full = full; it.el.classList.toggle('max', full); }
      it.el.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px) translate(-50%,-50%)';
      it.el.style.opacity = off ? 0.75 : Math.min(1, (ICON_D - d) / 1.5).toFixed(2);
    }
    // blanco fijado mientras llevas un arrojable: un circulito verde agua en su cabeza (el tiro va solo a
    // él, no hace falta parábola); sin blanco, la parábola marca dónde cae
    const free = playing && !player.dead && !player.struggle && !player.action;
    const carrying = free && player.holdingThr && !player.aiming;      // solo con él en la mano
    const lz = carrying ? lockTarget(player, zombies, camYaw) : null;
    // la línea solo al apuntar: con la botella o el ladrillo en la mano, o con el arco
    const bow = free && player.aiming && player.weapon.gun === 'bow' && G.Guns && G.Guns.bowPath;
    if (free && player.aiming && player.holdingThr) updateArc(player, camera);
    else if (bow) { const r = G.Guns.bowPath(player, zombies, arcPts, ARC_N, simPath); if (r) drawArc(r.n, r.land, camera); else hideArc(); }
    else hideArc();
    if (lockEl) {
      const z = lz;
      if (z) {
        z.model.head.getWorldPosition(_v); _v.y += 0.03;
        _v.project(camera);
        if (_v.z < 1) {
          lockEl.classList.remove('hidden');
          lockEl.style.transform = 'translate(' + Math.round((_v.x * 0.5 + 0.5) * Wd) + 'px,' + Math.round((-_v.y * 0.5 + 0.5) * H) + 'px) translate(-50%,-50%)';
        } else lockEl.classList.add('hidden');
      } else lockEl.classList.add('hidden');
    }
    return pick;
  }


  // ---------- Fuego (molotov) ----------
  // Un charco de fuego de FIRE_R m que dura FIRE_T s: prende a los infectados que toca (se queman y pierden
  // vida unos segundos; al impacto el más cercano cae y se revuelca) y te quema si lo pisas
  const FIRE_R = 2.0, FIRE_T = 7, FIRE_HURT = 9, ROLL_D = 1.6;
  const Fire = (() => {
    let tex = null, light = null;
    const zones = [], burners = [], loose = [];
    function flameTex() {
      const c = document.createElement('canvas'); c.width = 32; c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(16, 46, 2, 16, 40, 30);
      g.addColorStop(0, 'rgba(255,250,215,1)'); g.addColorStop(0.22, 'rgba(255,200,60,1)');
      g.addColorStop(0.55, 'rgba(245,110,20,0.85)'); g.addColorStop(1, 'rgba(170,35,0,0)');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(16, 2); x.quadraticCurveTo(30, 34, 26, 52); x.quadraticCurveTo(16, 64, 6, 52); x.quadraticCurveTo(2, 34, 16, 2); x.fill();
      return new THREE.CanvasTexture(c);
    }
    function mat() {
      if (!tex) tex = flameTex();
      const m = new THREE.SpriteMaterial({ map: tex, blending: THREE.NormalBlending, depthWrite: false, transparent: true, opacity: 0.92 });
      m.toneMapped = false;
      return m;
    }
    function ensureLight() {
      // una sola luz que se reutiliza (crear luces nuevas en mitad de la partida da tirones)
      if (light || !scene) return;
      light = new THREE.PointLight(0xff7a2a, 0, 9, 2);
      scene.add(light);
    }
    // una llama suelta pegada a un objeto (o hueso)
    function sprite(parent, x, y, z, size) {
      const sp = new THREE.Sprite(mat());
      sp.position.set(x, y, z); sp.scale.set(size * 0.6, size, 1);
      sp.userData.base = size; sp.userData.ph = Math.random() * 6;
      parent.add(sp); loose.push(sp);
      return sp;
    }
    function detachSprite(sp) {
      if (sp.parent) sp.parent.remove(sp);
      const i = loose.indexOf(sp); if (i >= 0) loose.splice(i, 1);
      sp.material.dispose();
    }
    function spawn(x, y, z, lv, hitZ) {
      ensureLight();
      const g = new THREE.Group(); g.position.set(x, y, z);
      const fl = [];
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * FIRE_R * 0.9;
        const sp = new THREE.Sprite(mat());
        sp.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
        sp.userData.base = 0.75 + Math.random() * 0.8; sp.userData.ph = Math.random() * 6;
        sp.center.set(0.5, 0.05);
        g.add(sp); fl.push(sp);
      }
      // mancha quemada en el suelo (se queda un rato después)
      const scorch = new THREE.Mesh(new THREE.CircleGeometry(FIRE_R * 1.05, 24), new THREE.MeshBasicMaterial({ color: 0x120c08, transparent: true, opacity: 0.55, depthWrite: false }));
      scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.02; scorch.renderOrder = 2;
      g.add(scorch);
      scene.add(g);
      const zone = { x, y, z, lv: lv || 0, t: 0, g, fl, scorch, first: true, hitZ };
      zones.push(zone);
      if (zones.length > 3) kill(zones[0]);
    }
    function kill(zn) {
      if (zn.g.parent) zn.g.parent.remove(zn.g);
      for (const sp of zn.fl) sp.material.dispose();
      zn.scorch.geometry.dispose(); zn.scorch.material.dispose();
      const i = zones.indexOf(zn); if (i >= 0) zones.splice(i, 1);
    }
    // llamas en el cuerpo de un infectado que arde
    function attach(z) {
      if (burners.some((b) => b.z === z)) return;
      const h = z.model, sp = [];
      if (!h || !h.chest) return;
      for (const [bone, y, sz] of [['chest', 0.08, 0.85], ['hips', 0.02, 0.7], ['head', 0.1, 0.55], ['armL', -0.12, 0.45], ['armR', -0.12, 0.45], ['legL', -0.2, 0.45]]) {
        const s2 = new THREE.Sprite(mat());
        s2.position.set(0, y, 0.05); s2.scale.set(sz * 0.6, sz, 1);
        s2.userData.base = sz; s2.userData.ph = Math.random() * 6;
        h[bone].add(s2); sp.push(s2);
      }
      burners.push({ z, sp });
    }
    function clear() {
      while (zones.length) kill(zones[0]);
      for (const b of burners) for (const s2 of b.sp) { if (s2.parent) s2.parent.remove(s2); s2.material.dispose(); }
      burners.length = 0;
      for (const sp of loose.slice()) detachSprite(sp);
      if (light) light.intensity = 0;
    }
    function flick(sp, t, k) {
      const u = sp.userData, f = 0.75 + 0.3 * Math.sin(t * 13 + u.ph) + 0.15 * Math.sin(t * 29 + u.ph * 2);
      sp.scale.set(u.base * 0.6 * (0.9 + 0.2 * Math.sin(t * 17 + u.ph)), u.base * f * k, 1);
      sp.material.opacity = 0.92 * Math.min(1, k * 1.5);
    }
    function update(dt, player, zombies) {
      const t = performance.now() / 1000;
      let li = 0, lp = null;
      for (let i = zones.length - 1; i >= 0; i--) {
        const zn = zones[i];
        zn.t += dt;
        const life = zn.t / FIRE_T;
        if (life >= 1) {
          // las llamas se apagan; la mancha se desvanece despacio
          for (const sp of zn.fl) sp.visible = false;
          zn.scorch.material.opacity = Math.max(0, 0.55 * (1 - (zn.t - FIRE_T) / 15));
          if (zn.t > FIRE_T + 15) kill(zn);
          continue;
        }
        const k = Math.min(1, zn.t * 4) * (1 - U.smooth((life - 0.75) / 0.25));
        for (const sp of zn.fl) flick(sp, t, k);
        if (k > li) { li = k; lp = zn; }
        if (dt <= 0) continue;
        // quién arde: al caer, el más cercano (o al que le dio) cae y se revuelca; el resto se sacude
        const near = [];
        for (const z of zombies) {
          if (!z.alive || (z.lv || 0) !== zn.lv) continue;
          const d = Math.hypot(z.pos.x - zn.x, z.pos.z - zn.z);
          if (d < FIRE_R) near.push({ z, d });
        }
        if (zn.first) {
          zn.first = false;
          near.sort((a, b) => a.d - b.d);
          let rolled = false;
          for (const n of near) {
            const roll = !rolled && (n.z === zn.hitZ || n.d < ROLL_D);
            if (roll) rolled = true;
            n.z.ignite(player, roll, zn);
          }
          if (near.length && Pickups.onMessage) Pickups.onMessage(near.length > 1 ? '¡Arden ' + near.length + '!' : '¡Arde!', 'good');
        } else {
          // los que entran en el fuego después también prenden
          for (const n of near) if ((!(n.z.burnT > 0) || (n.z.temb && !(n.z.fireZones && n.z.fireZones.indexOf(zn) >= 0))) && k > 0.3) n.z.ignite(player, false, zn);
        }
        // y a ti te quema si estás dentro
        if (!player.dead && (player.lv || 0) === zn.lv && Math.hypot(player.pos.x - zn.x, player.pos.z - zn.z) < FIRE_R * 0.9 && k > 0.3) {
          player.damage(FIRE_HURT * dt, 'Te quemaste.');
          player.hurt = Math.max(player.hurt || 0, 0.25);
        }
      }
      // la luz, en el fuego más vivo
      if (light) {
        if (lp) { light.position.set(lp.x, lp.y + 0.9, lp.z); light.intensity = 2.6 * li * (0.85 + 0.15 * Math.sin(t * 21) + 0.08 * Math.sin(t * 37)); }
        else light.intensity = 0;
      }
      // llamas en los cuerpos
      for (let i = burners.length - 1; i >= 0; i--) {
        const b = burners[i], z = b.z;
        const gone = !z.model || !z.model.root.parent;
        const k = gone ? 0 : Math.min(1, (z.burnT || 0) / 1.2);
        if (k <= 0) {
          for (const s2 of b.sp) { if (s2.parent) s2.parent.remove(s2); s2.material.dispose(); }
          burners.splice(i, 1); continue;
        }
        for (const s2 of b.sp) flick(s2, t, k);
      }
      for (const sp of loose) flick(sp, t, 1);
    }
    return { spawn, attach, sprite, detachSprite, update, clear, ensureLight, texture: () => { if (!tex) tex = flameTex(); return tex; }, get zones() { return zones; } };
  })();
  G.Fire = Fire;


  // ---------- Explosión (flecha explosiva) ----------
  // Un fogonazo con bola de fuego, humo y tierra. Los infectados a menos de BOOM_KILL m mueren y salen
  // volando como muñecos de trapo; hasta BOOM_R m salen despedidos con menos fuerza y pierden vida (si
  // aguantan, se levantan). A ti te hace daño y te tira atrás si estás cerca
  const BOOM_GORE = 1.6;        // a menos de esto de la explosión, el infectado revienta en pedazos
  const BOOM_R = 4.5, BOOM_KILL = 2.4, BOOM_DMG = 2.2, BOOM_HURT = 45, BOOM_HURT_R = 4;
  // mina: explosión un 35 % más grande (mismo daño): mata a todos los de dentro; los de justo fuera, aturdidos
  const MINE_SCALE = 1.35, MINE_STUN = 2.5;
  // bomba de humo: radio de la nube
  const SMOKE_R = 3.8, SMOKE_STUN = 3.2;
  const Boom = (() => {
    let light = null, lightT = 0, smokeTex = null;
    const parts = [];
    function init() {
      if (light || !scene) return;
      light = new THREE.PointLight(0xffb060, 0, 20, 2);
      scene.add(light);
    }
    function smoke() {
      if (smokeTex) return smokeTex;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(90,86,80,0.85)'); g.addColorStop(0.6, 'rgba(70,66,62,0.45)'); g.addColorStop(1, 'rgba(60,58,55,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      smokeTex = new THREE.CanvasTexture(c);
      return smokeTex;
    }
    function part(map, add, pos, v, s0, s1, dur, op) {
      const m = new THREE.SpriteMaterial({ map, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true, opacity: op });
      m.toneMapped = !add;
      const sp = new THREE.Sprite(m);
      sp.position.copy(pos); sp.scale.setScalar(s0);
      scene.add(sp);
      parts.push({ sp, v, s0, s1, t: 0, dur, op });
    }
    function explode(x, y, z, lv, hitZ, opts) {
      init();
      const P = G.debug && G.debug.player;
      const c = new THREE.Vector3(x, y, z);
      const mine = !!(opts && opts.mine), S = mine ? MINE_SCALE : 1;
      // fogonazo, bola de fuego, humo y tierra
      if (light) { light.position.set(x, y + 1, z); light.intensity = 10; lightT = 0.4; }
      const ft = Fire.texture();
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2, sp = (2.5 + Math.random() * 5) * S;
        const v = new THREE.Vector3(Math.sin(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1.5, Math.cos(a) * Math.cos(e) * sp);
        part(ft, false, c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6)), v, 0.8 * S, (2.6 + Math.random()) * S, 0.45 + Math.random() * 0.2, 1);
      }
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.6;
        part(smoke(), false, c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2)),
          new THREE.Vector3(Math.sin(a) * sp, 1 + Math.random() * 1.4, Math.cos(a) * sp), 1.2, 3.5 + Math.random() * 1.5, 2 + Math.random() * 1.2, 0.8);
      }
      if (G.Guns && G.Guns.burst) G.Guns.burst(c, new THREE.Vector3(0, 1, 0), false, 18);
      if (G.Audio) G.Audio.explosion(x, z, lv);
      // marca negra en el suelo
      const sc = new THREE.Mesh(new THREE.CircleGeometry(1.7 * S, 22), new THREE.MeshBasicMaterial({ color: 0x0c0907, transparent: true, opacity: 0.7, depthWrite: false }));
      sc.rotation.x = -Math.PI / 2; sc.position.set(x, G.World.groundY(x, z, lv) + 0.025, z); sc.renderOrder = 2;
      scene.add(sc);
      parts.push({ sp: sc, scorch: true, t: 0, dur: 30, op: 0.7 });
      G.World.emit(x, z, 32 * S, lv);
      // la cámara acusa la onda según lo cerca que estés
      const cp = G.Camera.pos, dc = cp ? Math.hypot(cp.x - x, cp.z - z) : 10;
      if (G.Camera.shake) G.Camera.shake(Math.max(0.22, Math.min(1.4, (1.5 - dc / 12) * 1.4 * S)));
      if (G.Camera.wobble) G.Camera.wobble(Math.max(0.25, Math.min(1.4, (1.6 - dc / 10) * S)));
      // infectados: muertos y volando (cerca) o despedidos (más lejos)
      const zs = G.Population ? G.Population.list : [];
      let kills = 0;
      for (const q of zs) {
        if (!q.alive || (q.lv || 0) !== lv) continue;
        const d = Math.hypot(q.pos.x - x, q.pos.z - z);
        // mina: los que se quedan fuera por poco, aturdidos
        if (mine && d > BOOM_R * S && d < BOOM_R * S + MINE_STUN && q.standing) { q.stun(2.8, q.pos.x - x, q.pos.z - z, 2.5); continue; }
        if (d > BOOM_R * S && q !== hitZ) continue;
        const k = q === hitZ || mine ? 1 : Math.max(0.15, 1 - d / BOOM_R);
        // el temblante no sale volando: si la flecha le da (o revienta a su lado) muere; más lejos, pierde vida
        if (q.temb) {
          const res = q.takeHit(0, 0, q.pos.x - x, q.pos.z - z, false, 1, 'boom', 'body', { w: 'boom', k: q === hitZ || mine || d < BOOM_KILL ? 1 : k });
          if (res === 'kill') kills++;
          continue;
        }
        q.hp -= BOOM_DMG * k;
        const kill = q === hitZ || mine || d < BOOM_KILL || q.hp <= 0;
        if (kill) kills++;
        // encima de la explosión: revienta en pedazos; el resto sale volando como un muñeco de trapo
        if ((q === hitZ || d < BOOM_GORE * S) && G.Gore) { G.Gore.explode(q, q.pos.x - x + (Math.random() - 0.5) * 0.3, q.pos.z - z + (Math.random() - 0.5) * 0.3, 1.2, 'explosion'); continue; }
        q.launch(q.pos.x - x + (Math.random() - 0.5) * 0.2, q.pos.z - z + (Math.random() - 0.5) * 0.2, k, kill, P);
      }
      if (kills && G.Combat && G.Combat.onHit) for (let i = 0; i < kills; i++) G.Combat.onHit('kill', true);
      if (kills > 1 && Pickups.onMessage) Pickups.onMessage('¡' + kills + ' por los aires!', 'good');
      // a ti: daño y te tira atrás
      if (P && !P.dead && (P.lv || 0) === lv) {
        const d = Math.hypot(P.pos.x - x, P.pos.z - z);
        if (d < BOOM_HURT_R * S) {
          const k = 1 - d / (BOOM_HURT_R * S);
          P.damage(BOOM_HURT * k, 'Te alcanzó tu propia explosión.');
          if (!P.dead && P.takePunch) P.takePunch({ pos: { x, z } }, 'heavy', 0, 2 + 4 * k);
          if (G.Camera.hurtFx) G.Camera.hurtFx(1.3 * k + 0.3, 0);
        }
      }
    }
    function update(dt) {
      if (light && lightT > 0) { lightT -= dt; light.intensity = Math.max(0, 10 * (lightT / 0.4)); if (lightT <= 0) light.intensity = 0; }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        const u = p.t / p.dur;
        if (u >= 1) {
          if (p.sp.parent) p.sp.parent.remove(p.sp);
          if (p.sp.geometry && p.scorch) p.sp.geometry.dispose();
          p.sp.material.dispose();
          parts.splice(i, 1); continue;
        }
        if (p.scorch) { p.sp.material.opacity = p.op * (1 - U.smooth((u - 0.6) / 0.4)); continue; }
        p.v.multiplyScalar(Math.max(0, 1 - dt * 2.2));
        p.sp.position.addScaledVector(p.v, dt);
        p.sp.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - (1 - u) * (1 - u)));
        p.sp.material.opacity = p.op * (1 - u) * (u < 0.1 ? u / 0.1 : 1);
      }
    }
    function clear() {
      for (const p of parts) { if (p.sp.parent) p.sp.parent.remove(p.sp); p.sp.material.dispose(); }
      parts.length = 0;
      if (light) light.intensity = 0;
    }
    return { init, explode, update, clear };
  })();
  G.Boom = Boom;

  // ---------- Explosión de esporas (temblante) ----------
  // Una media esfera de esporas que crece de golpe y se disipa, con nubecillas que se esparcen y una mancha en
  // el suelo. Te hace daño y te empuja si estás dentro; a los demás infectados los hace trastabillar
  const SPORE_DMG = 18;
  const Spores = (() => {
    const list = [];
    let tex = null, geo = null;
    function puffTex() {
      if (tex) return tex;
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(206,200,128,0.9)'); g.addColorStop(0.55, 'rgba(160,160,90,0.5)'); g.addColorStop(1, 'rgba(120,125,70,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      tex = new THREE.CanvasTexture(c);
      return tex;
    }
    // smoke: bomba de humo (gris, sin daño: aturde a los infectados y a ti, si estás muy cerca, te deja grogui)
    // opt: { dmg, dur } multiplican el daño y lo que dura la nube (los trozos que lanza el hongomorfo)
    function burst(x, y, z, lv, r, src, player, pop, wall, smoke, opt) {
      opt = opt || {};
      const W = G.World;
      const gy = W.groundY(x, z, lv);
      if (scene) {
        if (!geo) geo = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: smoke ? 0xb4b4b0 : 0xa9b35e, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
        const inner = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: smoke ? 0x7a7a78 : 0x7c8440, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
        for (const m of [outer, inner]) { m.position.set(x, gy, z); m.scale.setScalar(0.2); m.renderOrder = 4; scene.add(m); }
        const stain = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 26), new THREE.MeshBasicMaterial({ color: smoke ? 0x3a3a38 : 0x4f5527, transparent: true, opacity: smoke ? 0.3 : 0.5, depthWrite: false }));
        stain.rotation.x = -Math.PI / 2; stain.position.set(x, gy + 0.03, z); stain.renderOrder = 2; scene.add(stain);
        const puffs = [];
        const t = puffTex();
        if (t) for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2, e = Math.random() * 1.1;
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8, color: smoke ? 0xc8c8c8 : 0xffffff }));
          sp.position.set(x, gy + 0.4 + Math.random() * 0.6, z); sp.scale.setScalar(0.5);
          scene.add(sp);
          const v = (r * 1.6) * (0.6 + Math.random() * 0.5);
          puffs.push({ sp, vx: Math.sin(a) * Math.cos(e) * v, vy: Math.sin(e) * v * 0.5 + 0.3, vz: Math.cos(a) * Math.cos(e) * v, s0: 0.5 + Math.random() * 0.4 });
        }
        list.push({ outer, inner, stain, puffs, r, t: 0, x, z, lv, tick: 0.5, smoke: !!smoke, stunned: smoke ? new Set() : null, T: SPORE_T * (opt.dur || 1), dmgK: opt.dmg || 1 });
      }
      if (smoke) { smokeBurst(x, z, lv, r, player, opt.cover); if (opt.cover && list.length) list[list.length - 1].cover = true; return; }
      if (G.Audio) G.Audio.play('sporeBurst', { x, z, lv, big: !!(wall || pop || opt.dmg) });
      W.emit(x, z, 20, lv);
      // cámara: sacudida y tambaleo según lo cerca que estés
      const cp = G.Camera.pos, dc = cp ? Math.hypot(cp.x - x, cp.z - z) : 10;
      if (G.Camera.shake) G.Camera.shake(Math.max(0.14, Math.min(0.95, (1.1 - dc / 12) * 1.35)));
      if (G.Camera.wobble) G.Camera.wobble(Math.max(0.15, Math.min(1, 1.4 - dc / 10)));
      // a ti: daño y empujón
      if (player && !player.dead && (player.lv || 0) === lv) {
        const d = Math.hypot(player.pos.x - x, player.pos.z - z);
        if (d < r) {
          const k = 1 - d / r * 0.6;
          player.damage(SPORE_DMG * k * (wall ? 1.3 : 1) * (opt.dmg || 1), 'Te reventó encima una nube de esporas.');
          if (!player.dead && player.takePunch) player.takePunch({ pos: { x, z } }, 'heavy', 0, 3 + 4 * k);
          if (G.Camera.hurtFx) G.Camera.hurtFx(0.8 * k + 0.3, 0);
          if (G.Combat && G.Combat.stats) G.Combat.stats.hurt += SPORE_DMG * k * (opt.dmg || 1);
        }
      }
      // a los demás: trastabillan hacia fuera
      for (const q of (G.Population ? G.Population.list : [])) {
        if (q === src || !q.alive || !q.standing || q.temb || q.nemi || (q.lv || 0) !== lv) continue;
        const d = Math.hypot(q.pos.x - x, q.pos.z - z);
        if (d < r && q.doStagger) q.doStagger(q.pos.x - x, q.pos.z - z, 2 + 3 * (1 - d / r));
      }
    }
    // bomba de humo: estampido seco, aturde a los infectados de dentro y, si estás muy cerca, a ti
    // cover: el humo de los humanos (solo tapa la vista; a ellos no los aturde)
    function smokeBurst(x, z, lv, r, player, cover) {
      if (G.Audio) G.Audio.play('smokePop', { x, z, lv });
      if (!cover) G.World.emit(x, z, 9, lv);
      const cp = G.Camera.pos, dc = cp ? Math.hypot(cp.x - x, cp.z - z) : 10;
      if (G.Camera.shake) G.Camera.shake(Math.max(0.1, Math.min(0.6, 0.9 - dc / 14)));
      if (cover) {
        if (player && !player.dead && (player.lv || 0) === lv && Math.hypot(player.pos.x - x, player.pos.z - z) < r * 0.6 && G.Daze) G.Daze.start(0.45);
        return;
      }
      for (const q of (G.Population ? G.Population.list : [])) {
        if (!q.alive || !q.standing || (q.lv || 0) !== lv) continue;
        const d = Math.hypot(q.pos.x - x, q.pos.z - z);
        if (d < r) q.stun(SMOKE_STUN, q.pos.x - x, q.pos.z - z, 1.2);
      }
      const b = list[list.length - 1];
      if (b && b.smoke) for (const q of (G.Population ? G.Population.list : [])) if (Math.hypot(q.pos.x - x, q.pos.z - z) < r) b.stunned.add(q);
      if (player && !player.dead && (player.lv || 0) === lv) {
        const d = Math.hypot(player.pos.x - x, player.pos.z - z);
        if (d < r * 1.1 && G.Daze) G.Daze.start(1 - d / (r * 1.1) * 0.5);
      }
    }
    function dispose(b) {
      for (const m of [b.outer, b.inner, b.stain]) { if (m.parent) m.parent.remove(m); m.material.dispose(); }
      b.stain.geometry.dispose();
      for (const p of b.puffs) { if (p.sp.parent) p.sp.parent.remove(p.sp); p.sp.material.dispose(); }
    }
    // la nube se queda SPORE_T s: dentro, daño leve cada SPORE_TICK s
    const SPORE_T = 8.6, SPORE_TICK = 0.5, SPORE_TICK_DMG = 1.5;
    function update(dt, player) {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.t += dt;
        const g = 1 - Math.pow(1 - Math.min(1, b.t / 0.32), 3);           // crece de golpe
        const sc = 0.2 + (b.r - 0.2) * g;
        const br = 1 + 0.015 * Math.sin(b.t * 2.2);                     // la nube "respira"
        b.outer.scale.set(sc * br, sc * 0.85 * br, sc * br); b.inner.scale.set(sc * 0.82, sc * 0.7, sc * 0.82);
        // fogonazo al principio, luego una neblina que se queda y al final se disipa
        const haze = b.t < 0.35 ? 1 : (b.t < b.T ? 0.6 : Math.max(0, 0.6 * (1 - (b.t - b.T) / 1.2)));
        b.outer.material.opacity = 0.5 * haze; b.inner.material.opacity = 0.32 * haze;
        b.outer.visible = b.inner.visible = haze > 0;
        b.stain.material.opacity = 0.5 * Math.max(0, 1 - Math.max(0, b.t - b.T) / 8);
        for (const p of b.puffs) {
          const f = Math.exp(-dt * 2.5);
          p.vx *= f; p.vz *= f; p.vy = p.vy * f + 0.03 * dt;
          const px = p.sp.position.x + p.vx * dt, pz = p.sp.position.z + p.vz * dt;
          if (Math.hypot(px - b.x, pz - b.z) < b.r * 0.9) { p.sp.position.x = px; p.sp.position.z = pz; } else { p.vx = p.vz = 0; }
          p.sp.position.y = Math.min(p.sp.position.y + p.vy * dt, (b.outer.position.y || 0) + b.r * 0.7);
          p.sp.scale.setScalar(Math.min(p.s0 + b.t * 0.9, 1.6));
          p.sp.material.opacity = 0.55 * (b.t < b.T ? Math.min(1, 0.4 + b.t) : Math.max(0, 1 - (b.t - b.T) / 1.2));
        }
        // humo: los que entran en los primeros segundos también se quedan aturdidos (una vez)
        if (b.smoke) {
          if (b.t < 5 && !b.cover) for (const q of (G.Population ? G.Population.list : [])) {
            if (!q.alive || !q.standing || b.stunned.has(q) || (q.lv || 0) !== b.lv) continue;
            if (Math.hypot(q.pos.x - b.x, q.pos.z - b.z) < b.r * 0.9) { b.stunned.add(q); q.stun(SMOKE_STUN * 0.7); }
          }
        } else
        // dentro de la nube: daño leve a ratos
        if (player && !player.dead && b.t < b.T + 0.4 && (player.lv || 0) === b.lv && Math.hypot(player.pos.x - b.x, player.pos.z - b.z) < b.r * 0.95) {
          b.tick -= dt;
          if (b.tick <= 0) {
            b.tick = SPORE_TICK;
            player.damage(SPORE_TICK_DMG * b.dmgK, 'Las esporas te ahogaron.');
            player.hurt = Math.max(player.hurt || 0, 0.18);
            if (G.Combat && G.Combat.stats) G.Combat.stats.hurt += SPORE_TICK_DMG * b.dmgK;
          }
        } else b.tick = Math.min(b.tick, SPORE_TICK);
        if (b.t > b.T + 10) { dispose(b); list.splice(i, 1); }
      }
    }
    function clear() { for (const b of list) dispose(b); list.length = 0; }
    return { burst, update, clear };
  })();
  G.Spores = Spores;

  const Pickups = {
    onMessage: null, KINDS,
    KINDS, init, reset, clear, spawn, spawnMelee, refillAmmo, ammoWeights, add, take, drop, near, collectAll, label, startPickup, collect, lockTarget, startThrow, release, update, placeMine,
    get count() { return items.length; },
    get list() { return items; }
  };
  G.Pickups = Pickups;
})(window.Game = window.Game || {});
