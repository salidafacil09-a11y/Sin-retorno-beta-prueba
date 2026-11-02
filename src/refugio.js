(function (G) {
  'use strict';

  // Refugio del modo Retorno (diseño propio, inspirado en el escondite de los modos sin retorno):
  //   - mesa del mapa con el corcho: eliges el siguiente enfrentamiento (5 y el jefe final, «próximamente»)
  //   - cofre de recompensas: lo que ganaste en el último enfrentamiento
  //   - puesto de comercio: se compra con monedas (lo que hay a la venta cambia tras cada enfrentamiento)
  //   - banco de mejoras: se mejora el arma con piezas; vista desde arriba del arma en el tapete y las manos
  //     trabajando en ella
  //   - mesa de fabricación: abre la mochila
  // En el refugio se puede apuntar pero no disparar ni golpear.
  // También aquí: G.Props (objetos con los que se interactúa con ∆ / T: las estaciones del refugio) y el cofre de
  // suministros que aparece tras las oleadas del asalto (lo de dentro se coge suelto, sin menús).

  const U = G.Util;
  const el = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;

  // ================= Objetos con los que se interactúa =================
  const Props = {
    list: [],
    add(p) { p.lv = p.lv || 0; this.list.push(p); return p; },
    remove(p) {
      const i = this.list.indexOf(p);
      if (i >= 0) this.list.splice(i, 1);
      if (p.dispose) p.dispose();
    },
    clear() { while (this.list.length) this.remove(this.list[this.list.length - 1]); }
  };
  G.Props = Props;

  let scene = null, player = null, camera = null, onMsg = null;
  let root = null, hud = null, marks = null;
  let panel = null;           // 'mapa' | 'tienda' | 'banco' | null
  let inside = false, packWas = false;
  const msg = (m, k) => { if (onMsg) onMsg(m, k); };
  const ICONS = {
    coin: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 5.5 V14.5 M7.6 7.6 Q10 6 12.2 7.4 Q8 10 12.4 12.4 Q10 14 7.6 12.4"/></svg>',
    gear: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 L11.3 4.6 L13.7 4 L14.2 6.4 L16.5 7.2 L15.6 9.5 L17 11.5 L15 12.9 L15.2 15.3 L12.8 15.4 L11.6 17.5 L10 16 L8.4 17.5 L7.2 15.4 L4.8 15.3 L5 12.9 L3 11.5 L4.4 9.5 L3.5 7.2 L5.8 6.4 L6.3 4 L8.7 4.6 Z"/><circle cx="10" cy="10" r="2.6"/></svg>',
    x: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><path d="M6.8 6.8 L13.2 13.2 M13.2 6.8 L6.8 13.2"/></svg>',
    o: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><circle cx="10" cy="10" r="4"/></svg>',
    asalto: '<path d="M-9 -6 L0 -1 L9 -6 M-9 0 L0 5 L9 0 M-9 6 L0 11 L9 6" />',
    caza: '<path d="M-7 -9 L7 -9 L0 0 L7 9 L-7 9 L0 0 Z" />',
    escuadron: '<g transform="translate(-11.5 -11.5) scale(0.72)"><path d="M16 13 Q20 15 19 21 Q16 24 13 21 Q12 15 16 13 Z M16 13 Q16 9 18 7 Q21 5 22 8 Q22 10 20 10 L21 12 M14 22 Q11 24 10 27 L8 26 M10 27 L11 29 M18 22 Q21 24 22 27 L24 26 M22 27 L21 29 M13 16 L9 14 M13 18 L9 18 M13 20 L9 21 M19 16 L23 14 M19 18 L23 18 M19 20 L23 21" /></g>',      // (los Escorpiones)
    saqueo: '<path d="M-8 -8 L8 -8 L8 8 L-8 8 Z M-4 0 A4 4 0 1 0 4 0 A4 4 0 1 0 -4 0 M0 -4 L0 -2 M-8 9 L-6 11 M8 9 L6 11" />',
    resistencia: '<path d="M0 -10 L8 -6 L8 1 Q8 7 0 11 Q-8 7 -8 1 L-8 -6 Z M-3 0 L0 3 L4 -3" />',
    liberacion: '<path d="M-8 -9 L-8 9 M-3 -9 L-3 9 M2 -9 L2 1 M7 -9 L7 9 M-9 -9 L8 -9 M-9 9 L8 9 M2 1 L8 5" />',
    boss: '<path d="M-9 4 Q-9 -10 0 -10 Q9 -10 9 4 L6 4 L6 9 L-6 9 L-6 4 Z M-4 -2 A2.4 2.4 0 1 0 -4 -1.9 M4 -2 A2.4 2.4 0 1 0 4 -1.9" />',
    home: '<path d="M-9 1 L0 -8 L9 1 M-6 -1 L-6 8 L6 8 L6 -1" />',
    check: '<path d="M-6 0 L-2 5 L7 -5" />',
    // suplementos: una pastilla (cápsula)
    pill: '<svg viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(-45 10 10)"><rect x="4" y="7" width="12" height="6" rx="3"/><path d="M10 7 V13"/></g></svg>',
    // piezas: una llave inglesa
    wrench: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13.6 3.2 A4 4 0 0 0 9.2 8.4 L3.6 14 A1.6 1.6 0 0 0 6 16.4 L11.6 10.8 A4 4 0 0 0 16.8 6.4 L14.4 8.8 L12 8 L11.2 5.6 Z"/></svg>'
  };

  // ================= Avisos de zona =================
  // Un icono sin texto encima de un sitio (de dónde salen los infectados, dónde está el cofre): se ve a través
  // de las paredes y a cualquier distancia (pegado al borde si queda fuera de la pantalla) unos 5 segundos
  const PING_T = 5;
  const PING_ICON = {
    zombi: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M10 13 Q16 6 22 13 L22 18 Q19 21 16 21 Q13 21 10 18 Z"/><path d="M12.5 15 L14.5 16 M19.5 15 L17.5 16"/><path d="M8 25 L12 21 M13 26 L15.5 22 M18 26 L17 22"/></svg>',
    // los Escorpiones (humanos): su logo
    escorpion: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M16 13 Q20 15 19 21 Q16 24 13 21 Q12 15 16 13 Z M16 13 Q16 9 18 7 Q21 5 22 8 Q22 10 20 10 L21 12 M14 22 Q11 24 10 27 L8 26 M10 27 L11 29 M18 22 Q21 24 22 27 L24 26 M22 27 L21 29 M13 16 L9 14 M13 18 L9 18 M13 20 L9 21 M19 16 L23 14 M19 18 L23 18 M19 20 L23 21"/></svg>',
    chest: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M8 13 Q8 9 12 9 L20 9 Q24 9 24 13 L24 23 L8 23 Z"/><path d="M8 14 L24 14"/><path d="M14.5 13 L17.5 13 L17.5 17 L14.5 17 Z"/></svg>'
  };
  const pings = [];
  const PING_LOGO = PING_ICON.escorpion;
  function ping(x, z, kind, dur) {
    if (!marks) return;
    const mark = document.createElement('div');
    mark.className = 'rf-mark ping ' + (kind === 'zombi' || kind === 'escorpion' ? kind : 'chest');
    mark.innerHTML = '<em>' + (PING_ICON[kind] || PING_ICON.zombi) + '</em>';
    marks.appendChild(mark);
    pings.push({ x, z, y: G.World.groundY(x, z, 0) + 1.3, mark, t: dur || PING_T, end: performance.now() + (dur || PING_T) * 1000, kind: 'ping' });
  }
  function clearPings() { while (pings.length) pings.pop().mark.remove(); }

  // ================= Cofre de suministros (asalto) =================
  // Un cofre grande de madera, abierto: lo que trae se ve dentro en 3D y se coge pieza a pieza (como cualquier
  // objeto suelto, con ∆ / T), sin menús. Al aparecer se marca unos 5 segundos con un icono a través de las paredes
  let chestGeo = null, chestMat = null;
  let glintTex = null;
  function glintTexture() {
    if (glintTex) return glintTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,220,150,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glintTex = new THREE.CanvasTexture(c);
    return glintTex;
  }
  const chests = [];
  function chestGeometry() {
    if (chestGeo) return chestGeo;
    const m = new G.Mesher();
    const W = 1.15, D = 0.66, H = 0.5, t = 0.05;
    const wood = 0x6b4a2b, dark = 0x4a321d, iron = 0x2c2d2f;
    m.box(0, 0.05, 0, W, 0.1, D, dark);                                        // fondo
    m.box(0, H / 2, D / 2 - t / 2, W, H, t, wood);                             // frente
    m.box(0, H / 2, -D / 2 + t / 2, W, H, t, wood);                            // detrás
    for (const sx of [-1, 1]) m.box(sx * (W / 2 - t / 2), H / 2, 0, t, H, D, wood);
    // tablones (líneas oscuras) y herrajes
    for (const y of [0.17, 0.34]) { m.box(0, y, D / 2 + 0.002, W, 0.012, 0.006, dark); m.box(0, y, -D / 2 - 0.002, W, 0.012, 0.006, dark); }
    for (const sx of [-1, 1]) {
      m.box(sx * (W / 2 - 0.09), H / 2, D / 2 + 0.006, 0.06, H, 0.012, iron);
      m.box(sx * (W / 2 - 0.09), H / 2, -D / 2 - 0.006, 0.06, H, 0.012, iron);
      m.box(sx * (W / 2 + 0.006), H / 2, 0, 0.012, H, 0.06, iron);
      m.box(sx * (W / 2 + 0.01), H * 0.62, 0, 0.02, 0.05, 0.2, iron);       // asas
    }
    m.box(0, H - 0.08, D / 2 + 0.012, 0.12, 0.12, 0.02, 0x8a7a50);           // cerradura
    // tapa abierta hacia atrás (casi vertical)
    const lid = -1.25;
    const ly = H + Math.sin(-lid) * 0.0, lz = -D / 2;
    m.box(0, ly + 0.3, lz - 0.05, W, 0.6, 0.06, wood, 0, undefined, 0);
    m.box(0, ly + 0.3, lz - 0.085, W, 0.012, 0.012, dark);
    for (const sx of [-1, 1]) m.box(sx * (W / 2 - 0.09), ly + 0.3, lz - 0.09, 0.06, 0.6, 0.012, iron);
    chestGeo = m.build();
    return chestGeo;
  }
  // sitios dentro del cofre (en local: x a lo ancho, z a lo hondo)
  const SLOTS = [[-0.33, 0.12], [0, 0.12], [0.33, 0.12], [-0.33, -0.12], [0, -0.12], [0.33, -0.12], [-0.17, 0], [0.17, 0]];
  function spawnCase(x, z, items) {
    if (!chestMat) chestMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(chestGeometry(), chestMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    const y = G.World.groundY(x, z, 0);
    // de cara a la jugadora (el frente hacia ella)
    const P = player, rot = P ? Math.atan2(P.pos.x - x, P.pos.z - z) : Math.random() * TAU;
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    // lo de dentro: objetos de verdad, que se cogen uno a uno
    const picks = [];
    const c = Math.cos(rot), sn = Math.sin(rot);
    items.slice(0, SLOTS.length).forEach((it, k) => {
      const id = G.Pickups.KINDS && G.Pickups.KINDS[it.id] ? it.id : null;
      if (!id) return;
      const [lx, lz] = SLOTS[k];
      const wx = x + lx * c + lz * sn, wz = z - lx * sn + lz * c;
      const pk = G.Pickups.add(id, it.cond || 1, { x: wx, y: y + 0.1, z: wz, lv: 0 });
      pk.chest = true;
      picks.push(pk);
    });
    const mark = document.createElement('div');
    mark.className = 'rf-mark ping chest';
    mark.innerHTML = '<em>' + PING_ICON.chest + '</em>';
    marks.appendChild(mark);
    const ch = {
      x, z, y: y + 0.2, mesh: g, mark, picks, pingT: PING_T, pingEnd: performance.now() + PING_T * 1000,
      dispose() { if (g.parent) g.parent.remove(g); mark.remove(); }
    };
    chests.push(ch);
    if (G.Audio) G.Audio.play('pickup');
    return ch;
  }
  function clearChests() { while (chests.length) chests.pop().dispose(); }

  // ================= Estaciones del refugio =================
  const ST_NAME = { mapa: 'Mapa', cofre: 'Recompensas', tienda: 'Comercio', banco: 'Mejoras', fabricar: 'Fabricar', mapas: 'Mapas' };
  function buildStations() {
    for (const s of G.World.stations) {
      const mark = document.createElement('div');
      mark.className = 'rf-mark st';
      mark.innerHTML = '<i></i><b>' + ST_NAME[s.id] + '</b>';
      marks.appendChild(mark);
      let glint = null, lid = null;
      if (s.id === 'cofre') {
        glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
        glint.material.toneMapped = false; glint.scale.setScalar(0.45);
        glint.position.set(s.cx, s.top + 0.25, s.cz);
        scene.add(glint);
        lid = crateLid(s.f);
      }
      Props.add({
        x: s.cx, z: s.cz, y: s.top, fx: s.x, fz: s.z, label: s.label, reach: 1.9, kind: 'station', id: s.id, mark, glint, lid, t: 0,
        // el cofre sin nada que recoger no se usa (está abierto y vacío)
        off: s.id === 'cofre' ? () => !G.Run.pending || crate.opening > 0 || panel === 'cofre' : null,
        use(pl) { return useStation(s.id, pl); },
        dispose() { mark.remove(); if (glint) { if (glint.parent) glint.parent.remove(glint); glint.material.dispose(); } if (lid) { scene.remove(lid.hinge); if (crate.lid === lid) crate.lid = null; } }
      });
    }
  }
  // ---------- Arma de un desafío difícil ----------
  // Rara: aparece tumbada encima de un mueble bajo del refugio (unas cajas) y se coge con ∆ / T
  let shelfMat = null;
  function buildShelf() {
    const id = G.Run.shelf;
    if (!id || !player) return;
    const W = G.World, list = W.furnNear(player.pos.x, player.pos.z, 9, 0).map((q) => q.f);
    const f = list.find((q) => q.type === 'cajas') || list.find((q) => q.h < 1.0 && !G.World.stations.some((s) => s.f === q));
    if (!f) return;
    if (!shelfMat) shelfMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const x = (f.x0 + f.x1) / 2, z = (f.z0 + f.z1) / 2, y = f.y + 0.04 + f.h;
    const g = new THREE.Group();
    const m = new THREE.Mesh(G.Models.weaponGeometry(id), shelfMat);
    m.rotation.x = Math.PI / 2;            // tumbada
    m.castShadow = true;
    g.add(m);
    g.position.set(x, y + 0.01, z);
    g.rotation.y = Math.atan2(f.fx, f.fz) + Math.PI / 2;
    scene.add(g);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    glint.material.toneMapped = false; glint.scale.setScalar(0.4); glint.position.set(x, y + 0.12, z);
    scene.add(glint);
    const mark = document.createElement('div');
    mark.className = 'rf-mark st has';
    mark.innerHTML = '<i></i><b>' + G.Weapons.get(id).name + '</b>';
    marks.appendChild(mark);
    const p = Props.add({
      x, z, y, label: 'Coger ' + G.Weapons.get(id).name.toLowerCase(), reach: 1.8, kind: 'station', id: 'arma', mark, glint, t: 0,
      use(pl) { const r = G.Run.takeShelf(pl); Props.remove(p); renderHud(); return r; },
      dispose() { scene.remove(g); scene.remove(glint); glint.material.dispose(); mark.remove(); }
    });
  }

  // ---------- Cofre de recompensas ----------
  // Una caja grande de transporte. Sin nada que recoger está abierta y vacía; al volver de un enfrentamiento
  // está cerrada y llena: al abrirla se levanta la tapa y aparece el resumen (piezas, suplementos y monedas)
  const crate = { lid: null, open: 1, opening: 0, takeT: 0 };
  let lidMat = null;
  function crateLid(f) {
    const T = G.Furniture.T.cofre, W = T.w, D = T.d, H = f.h;
    if (!lidMat) lidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const ry = Math.atan2(f.fx, f.fz), cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    const hinge = new THREE.Group();
    hinge.position.set(cx - Math.sin(ry) * D / 2, f.y + 0.04 + H, cz - Math.cos(ry) * D / 2);
    hinge.rotation.order = 'YXZ';
    hinge.rotation.y = ry;
    // tapa (de la bisagra hacia delante)
    const m = new G.Mesher();
    const SH = 0x8f7b55, SD = 0x6f5f42, IN = 0x2f2b24;
    m.box(0, 0.035, D / 2, W, 0.07, D, SH);
    m.box(0, 0.001, D / 2, W - 0.09, 0.004, D - 0.09, IN);
    for (const xx of [-0.36, 0, 0.36]) m.box(xx * W, 0.072, D / 2, 0.06, 0.012, D - 0.06, SD);
    m.box(0, 0.072, D / 2, W - 0.08, 0.012, 0.05, SD);
    for (const sx of [-0.25, 0.25]) m.box(sx * W, 0.02, D + 0.012, 0.07, 0.05, 0.02, 0x3a3630);
    m.box(0, 0.05, D + 0.005, 0.32, 0.03, 0.012, 0x2a2826);
    const lid = new THREE.Mesh(m.build(), lidMat);
    lid.castShadow = true;
    hinge.add(lid);
    // lo de dentro: bultos de suministros (se ven al abrirla mientras hay algo que recoger)
    const c = new G.Mesher();
    const iy = -H + 0.07;
    c.box(-0.38, iy + 0.06, D / 2 + 0.02, 0.36, 0.12, 0.42, 0xc9c2a8);
    c.box(-0.38, iy + 0.125, D / 2 + 0.02, 0.3, 0.01, 0.36, 0x9f9a86);
    c.box(0.02, iy + 0.05, D / 2 - 0.06, 0.3, 0.1, 0.26, 0x6b7258);
    c.box(0.02, iy + 0.05, D / 2 + 0.16, 0.26, 0.08, 0.16, 0xd8d0b8);
    for (let k = 0; k < 4; k++) c.cyl(0.32 + (k % 2) * 0.11, iy + 0.07, D / 2 - 0.08 + Math.floor(k / 2) * 0.13, 0.04, 0.04, 0.14, k % 2 ? 0xe8e4da : 0xd6d0c2, 10);
    c.box(0.36, iy + 0.03, D / 2 + 0.17, 0.3, 0.06, 0.12, 0x8a5a3a);
    const stuff = new THREE.Mesh(c.build(), lidMat);
    hinge.add(stuff);
    scene.add(hinge);
    crate.lid = { hinge, lid, stuff };
    crate.open = G.Run.pending ? 0 : 1;
    crate.opening = 0;
    lid.rotation.x = -1.45 * crate.open;
    stuff.visible = !!G.Run.pending;
    return crate.lid;
  }
  function updateCrate(dt) {
    if (!crate.lid) return;
    if (crate.opening > 0) {
      crate.opening -= dt;
      if (crate.opening <= 0) { crate.opening = 0; open('cofre'); }
    }
    const want = (!G.Run.pending || crate.opening > 0 || panel === 'cofre') ? 1 : 0;
    crate.open += (want - crate.open) * Math.min(1, dt * (want ? 5 : 8));
    crate.lid.lid.rotation.x = -1.45 * U.smooth(Math.max(0, Math.min(1, crate.open)));
    crate.lid.stuff.visible = !!G.Run.pending || (panel === 'cofre');
    // (con el reloj de verdad: el resumen no espera a que el juego vaya a más fotogramas)
    if (crate.takeT > 0 && performance.now() >= crate.takeT) { crate.takeT = 0; close(); }
    if (curT > 0 && performance.now() >= curT) { curT = 0; if (cur && panel !== 'cofre') cur.classList.add('hidden'); }
  }
  // contadores de abajo a la derecha (piezas, suplementos, monedas): se ven al abrir el cofre y un rato después
  let cur = null, curT = 0;
  function renderCur(add) {
    if (!cur) { cur = document.createElement('div'); cur.id = 'rf-cur'; document.body.appendChild(cur); }
    const R = G.Run, row = (k, v, a, ic) => '<div class="r ' + k + (v ? '' : ' zero') + (a ? ' add' : '') + '">' + (a ? '<em>+' + a + '</em>' : '') + '<b>' + v + '</b><i>' + ic + '</i>' + (a ? '<u></u>' : '') + '</div>';
    cur.innerHTML = row('p', R.piezas, add && add.piezas, ICONS.wrench) + row('s', R.suplementos, add && add.suplementos, ICONS.pill) + row('c', R.monedas, add && add.monedas, ICONS.coin);
    cur.classList.remove('hidden');
  }
  function takeRewards() {
    if (crate.takeT > 0) return;
    const got = G.Run.takeRewards(player);
    if (!got) { close(); return; }
    renderCur(got);
    curT = performance.now() + 5000;
    const pn = root.querySelector('.rf-rewp');
    if (pn) pn.classList.add('taken');
    crate.takeT = performance.now() + 1400;
    if (G.Audio) G.Audio.play('pickup');
    setTimeout(() => msg('Tienes ' + G.Run.suplementos + ' suplementos.', 'good'), 1500);
    renderHud();
  }

  function useStation(id, pl) {
    if (id === 'cofre') {
      if (!G.Run.pending) return null;
      // se levanta la tapa y después aparece el resumen
      crate.opening = 0.55;
      if (G.Audio) G.Audio.play('pickup');
      return null;
    }
    if (id === 'fabricar') { G.Backpack.open(pl); return null; }
    open(id);
    return null;
  }

  // ================= Marcadores en pantalla =================
  const _v = new THREE.Vector3();
  function placeMark(p, show, dist, edge) {
    const m = p.mark;
    if (!m) return;
    if (!show) { if (!m.classList.contains('hidden')) m.classList.add('hidden'); return; }
    _v.set(p.x, (p.y || 0) + (p.kind === 'station' ? 0.75 : 0.55), p.z).project(camera);
    const W = window.innerWidth, H = window.innerHeight;
    let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
    const behind = _v.z > 1;
    const off = behind || sx < 20 || sx > W - 20 || sy < 20 || sy > H - 20;
    if (off && !edge) { m.classList.add('hidden'); return; }
    if (off) {
      // fuera de la pantalla: pegado al borde, en la dirección en que está
      let ax = sx - W / 2, ay = sy - H / 2;
      if (behind) { ax = -ax; ay = -ay; }
      const k = Math.min((W / 2 - 40) / Math.max(1, Math.abs(ax)), (H / 2 - 40) / Math.max(1, Math.abs(ay)));
      sx = W / 2 + ax * k; sy = H / 2 + ay * k;
    }
    m.classList.remove('hidden');
    m.classList.toggle('edge', off);
    const sp = m.querySelector('span');
    if (sp) { const t = Math.round(dist) + ' m'; if (sp.textContent !== t) sp.textContent = t; }
    m.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px) translate(-50%,-100%)';
  }

  // ================= HUD del refugio =================
  function renderHud() {
    if (!hud) return;
    const R = G.Run;
    const k = R.active ? (R.done ? 'Jefe final' : 'Enfrentamiento ' + (R.step + 1) + ' de ' + R.STEPS) + (R.daily ? ' · partida diaria' : '') : '';
    const h = '<div class="rf-title"><b>Refugio</b><span>' + k + '</span></div>' +
      '<div class="rf-money"><span class="c">' + ICONS.coin + '<b>' + R.monedas + '</b></span><span class="p">' + ICONS.wrench + '<b>' + R.piezas + '</b></span><span class="s">' + ICONS.pill + '<b>' + R.suplementos + '</b></span></div>';
    if (hud._h !== h) { hud._h = h; hud.innerHTML = h; }
  }

  // ================= Paneles =================
  const sel = { mapa: 0, tienda: 0, banco: 0, up: 0, mapas: 0 };
  function open(id) {
    if (panel) close(false);
    panel = id;
    root.className = 'rf-' + id;
    root.classList.remove('hidden');
    document.body.classList.add('rf-open');
    if (player) { player.aiming = false; if (G.Input.setAim) G.Input.setAim(false); }
    if (!G.Input.isTouch && G.Input.pointerLocked && document.exitPointerLock) document.exitPointerLock();
    if (id === 'mapa') { const A = G.Run.allowed(); if (A.indexOf(sel.mapa) < 0) sel.mapa = A.length ? A[0] : 0; }
    if (id === 'banco') { Bench.enter(); sel.up = 0; }
    if (id === 'cofre') { renderCur(null); curT = 0; }
    render();
    if (G.Audio) G.Audio.play('pickup');
  }
  function close(relock) {
    if (!panel) return;
    if (panel === 'banco') Bench.leave();
    if (panel === 'cofre' && !curT && cur) cur.classList.add('hidden');
    panel = null;
    root.classList.add('hidden');
    root.innerHTML = '';
    document.body.classList.remove('rf-open');
    if (relock !== false && !G.Input.isTouch && G.Input.enabled && G.Input.requestLock) G.Input.requestLock();
    renderHud();
  }

  function head(title) {
    const R = G.Run;
    const money = R.free ? '<span class="rf-money rf-free">Modo libre · todo gratis</span>'
      : '<span class="rf-money"><span class="c">' + ICONS.coin + '<b>' + R.monedas + '</b></span><span class="p">' + ICONS.gear + '<b>' + R.piezas + '</b></span></span>';
    return '<div class="rf-head"><b>' + title + '</b>' + money +
      '<button type="button" class="rf-x" data-a="close" aria-label="Cerrar">&#x2715;</button></div>';
  }
  function foot(okLabel) {
    return '<div class="rf-foot">' + (okLabel ? '<button type="button" data-a="ok">' + ICONS.x + okLabel + '</button>' : '') +
      '<button type="button" data-a="close">' + ICONS.o + 'Volver</button></div>';
  }

  function render() {
    if (!panel) return;
    if (panel === 'mapa') renderMap();
    else if (panel === 'tienda') renderShop();
    else if (panel === 'banco') renderBench();
    else if (panel === 'cofre') renderReward();
    else if (panel === 'mapas') renderMapas();
  }

  // ---------- Modo libre: el panel de los mapas ----------
  // Una lista con los mapas (sin plano); se elige y se viaja allí (con lo que llevas)
  const TRYIDS = { asalto_h: 1, caza_h: 1, saqueo: 1, resistencia: 1, huida: 1, huida_h: 1, liberacion: 1 };
  const mapasList = () => [['libre', 'Campo de pruebas', 'El campo con el comercio y el banco de mejoras gratis.']].concat(
    G.Maps.listAll().map((id) => [id, G.Maps.get(id).name, G.Maps.get(id).boss ? 'El mapa del jefe final, para recorrerlo tranquilo (sin el jefe).' : 'Mapa de los enfrentamientos de Retorno.']),
    // prueba de la batalla final: como al llegar al jefe en Retorno, con lo que llevas
    [['asalto_h', 'Asalto · Escorpiones', 'Prueba el asalto contra los Escorpiones en un mapa al azar: dos oleadas de saqueadores y, al final, el grupo del que escape. Llegas con lo que llevas y lo que gastes ya no es infinito; al terminar vuelves al modo libre con tu equipo de antes.'],
      ['caza_h', 'Caza · Escorpiones', 'Prueba la caza contra los Escorpiones en un mapa al azar: aguanta hasta el regreso mientras te buscan (como mucho ocho). Llegas con lo que llevas y lo que gastes ya no es infinito; al terminar vuelves al modo libre con tu equipo de antes.'],
      ['saqueo', 'Saqueo', 'Prueba el saqueo en un mapa al azar: los Escorpiones protegen una caja fuerte; tienes 3 min 30 s para abrirla. Llegas con lo que llevas y lo que gastes ya no es infinito; al terminar vuelves al modo libre con tu equipo de antes.'],
      ['resistencia', 'Resistencia', 'Prueba la resistencia en un mapa al azar: aguanta las oleadas de infectados protegiendo a tu compañero. Llegas con lo que llevas y lo que gastes ya no es infinito; al terminar vuelves al modo libre con tu equipo de antes.'],
      ['huida', 'Huida · infectados', 'Prueba la huida (el asalto impostor) en un mapa al azar: empieza como un asalto contra infectados, pero en la 2.ª oleada llegan los Escorpiones, pelean contra los infectados y el ruido atrae a más. Se acaba cuando no queda nadie; luego recoges el botín y sales por donde entraste.'],
      ['huida_h', 'Huida · Escorpiones', 'Prueba la huida contra los Escorpiones: en la 2.ª oleada llega una horda de infectados que se lanza contra todos. Los escorpiones mordidos se levantan convertidos en corredores.'],
      ['liberacion', 'Liberación', 'Prueba la liberación en la Red del Capitolio: cuélate, encuentra las celdas de tus dos compañeros y sácalos con vida por donde entraste. Puedes liberar a varios a la vez (cada celda abre a todos los que tiene dentro) y a los Supervivientes de otras celdas, si quieres. Ojo con los chasqueadores encadenados: si te oyen, chillan y dan la alarma.'],
      ['jefe', 'Batalla final', 'Prueba la batalla final como en Retorno: llegas al salón recreativo con lo que llevas, y la munición y lo que gastes ya no son infinitos. Al terminar vuelves al modo libre con tu equipo de antes.']]);
  function renderMapas() {
    const L = mapasList(), cur = G.World.layout;
    sel.mapas = Math.max(0, Math.min(L.length - 1, sel.mapas));
    // lista (sin vistas previas): nombre a la izquierda y, a la derecha, la descripción del elegido
    const rows = L.map(([id, name], i) => '<li><button type="button" class="rf-mc' + (i === sel.mapas ? ' sel' : '') + (id === cur ? ' cur' : '') + '" data-i="' + i + '">' +
      '<b>' + name + '</b>' + (id === cur ? '<small>Estás aquí</small>' : '') + '</button></li>').join('');
    const s = L[sel.mapas];
    root.innerHTML = '<div class="rf-pan rf-mapas">' + head('Mapas') + '<div class="rf-mbody"><ul class="rf-mrow">' + rows + '</ul>' +
      '<div class="rf-mside"><b>' + s[1] + '</b><p class="rf-mdesc">' + s[2] + '</p></div></div>' + foot(s[0] === cur ? null : (s[0] === 'jefe' || TRYIDS[s[0]] ? 'Empezar' : 'Ir a este mapa')) + '</div>';
    const on = root.querySelector('.rf-mc.sel');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  // ---------- Recompensas (al abrir el cofre) ----------
  function renderReward() {
    const p = G.Run.pending;
    if (!p) { root.innerHTML = ''; return; }
    const row = (i, ic, txt) => '<li style="animation-delay:' + (0.25 + i * 0.35).toFixed(2) + 's"><i>' + ic + '</i>' + txt + '</li>';
    root.innerHTML = '<div class="rf-rewp"><b class="t">Recompensas de enfrentamiento</b><span class="sub">' + (p.place || '') + ' &nbsp;- ' + (G.Run.TYPES[p.type] ? G.Run.TYPES[p.type].name : '') + '</span>' +
      '<ul>' + row(0, ICONS.wrench, p.piezas + ' Piezas') + row(1, ICONS.pill, p.suplementos + ' Suplementos') + row(2, ICONS.coin, p.monedas + ' Monedas') + '</ul>' +
      (p.mult > 1 ? '<p class="mul" style="animation-delay:1.1s">Desafíos' + (p.chals && p.chals.length ? ': ' + p.chals.join(', ') : '') + ' &nbsp;<b>×' + String(p.mult).replace('.', ',') + '</b></p>' : '') +
      '<div class="ln"></div><button type="button" data-a="ok">' + ICONS.x + 'Tomar</button></div>';
  }

  // ---------- Mapa ----------
  function renderMap() {
    const R = G.Run, st = R.st, N = R.STEPS;
    // dos líneas: la de arriba (0) y la de abajo (1); sus desvíos van por fuera (más arriba y más abajo)
    const dx = N > 5 ? 92 : 100, x0 = 84, W = x0 + 56 + dx * N, H = 330, MY = 164;
    const colX = (k) => x0 + dx * k;
    const rowOf = (n, i) => { const L = n.line != null ? n.line : i; return n.sub ? (L === 0 ? 46 : 282) : (L === 0 ? 122 : 206); };
    const allowed = R.allowed();
    if (allowed.length && allowed.indexOf(sel.mapa) < 0) sel.mapa = allowed[0];
    // lo que todavía se puede alcanzar (desde lo que se puede elegir ahora)
    const reach = {};
    if (!R.done) {
      for (const i of allowed) reach[st.step + ':' + i] = true;
      for (let k = st.step + 1; k < N; k++) st.map[k].forEach((n, i) => { if (R.preds(k, i).some((j) => reach[(k - 1) + ':' + j])) reach[k + ':' + i] = true; });
    }
    const chosen = (k, i) => k < st.step && st.path[k] === i;
    let svg = '<svg class="rf-route" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    // papel: cuadrícula y manchas
    for (let x = 20; x < W; x += 40) svg += '<line class="g" x1="' + x + '" y1="10" x2="' + x + '" y2="' + (H - 10) + '"/>';
    for (let y = 20; y < H; y += 40) svg += '<line class="g" x1="10" y1="' + y + '" x2="' + (W - 10) + '" y2="' + y + '"/>';
    svg += '<path class="river" d="M10 ' + (H - 70) + ' C ' + W * 0.22 + ' ' + (H - 110) + ', ' + W * 0.34 + ' ' + (H - 30) + ', ' + W * 0.52 + ' ' + (H - 80) + ' S ' + W * 0.81 + ' ' + (H - 140) + ', ' + (W - 10) + ' ' + (H - 106) + '"/>';
    // caminos: los ya hechos, los que salen de donde estás y los que quedan por delante (los de la otra línea, apagados)
    const seg = (cls, x1, y1, x2, y2) => { svg += '<line class="ln' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>'; };
    for (let k = 0; k < N; k++) {
      st.map[k].forEach((n, i) => {
        for (const j of R.preds(k, i)) {
          const px = j < 0 ? 22 : colX(k - 1), py = j < 0 ? MY : rowOf(st.map[k - 1][j], j);
          const fromDone = j < 0 ? true : chosen(k - 1, j);
          let cls;
          if (chosen(k, i) && fromDone) cls = ' done';
          else if (k === st.step && fromDone && allowed.indexOf(i) >= 0) cls = ' on';
          else if (reach[k + ':' + i] && (j < 0 || reach[(k - 1) + ':' + j] || fromDone)) cls = '';
          else cls = ' off';
          if (cls === ' off' && k <= st.step) continue;
          seg(cls, px, py, colX(k), rowOf(n, i));
        }
      });
    }
    for (const j of R.bossPreds()) {
      const n = st.map[N - 1][j], on = R.done && chosen(N - 1, j);
      seg(on ? ' on' : (reach[(N - 1) + ':' + j] ? '' : ' off'), colX(N - 1), rowOf(n, j), colX(N) - 24, MY);
    }
    // refugio
    svg += '<g class="nd home" transform="translate(22 ' + MY + ')"><circle r="14"/><g class="ic">' + ICONS.home + '</g></g>';
    for (let k = 0; k < N; k++) {
      st.map[k].forEach((n, i) => {
        const done = k < st.step, cur = k === st.step, ok = cur && allowed.indexOf(i) >= 0, ch = chosen(k, i);
        const cls = ch ? 'done' : (done ? 'skip' : (ok ? 'cur' + (sel.mapa === i ? ' sel' : '') : (reach[k + ':' + i] ? 'fut' : 'skip')));
        svg += '<g class="nd ' + cls + (n.sub ? ' sub' : '') + ' t-' + n.type + '" data-i="' + (ok ? i : -1) + '" transform="translate(' + colX(k) + ' ' + rowOf(n, i) + ')">' +
          '<circle r="' + (n.sub ? 17 : 19) + '"/><g class="ic">' + (ch ? ICONS.check : (n.humans && n.type !== 'saqueo' && n.type !== 'liberacion' ? ICONS.escuadron : (ICONS[n.type] || ICONS.asalto))) + '</g>' +
          '<text y="' + (n.sub ? 33 : 36) + '">' + (R.TYPES[n.type === 'escuadron' ? 'saqueo' : n.type] || R.TYPES.asalto).name + '</text></g>';
      });
      svg += '<text class="col" x="' + colX(k) + '" y="16">' + (k + 1) + '</text>';
    }
    const bx = colX(N);
    svg += '<g class="nd boss' + (R.done ? ' cur sel' : '') + '" transform="translate(' + bx + ' ' + MY + ')"><circle r="23"/><g class="ic">' + ICONS.boss + '</g><text y="42">Jefe final</text></g>';
    svg += '</svg>';

    let side;
    if (R.done) {
      side = '<h3>Jefe final</h3><p class="rf-kicker">Salón recreativo · el hongomorfo</p>' +
        '<p>Un salón de máquinas abandonado. Tienes un rato para saquearlo y fabricar curas, molotovs y minas antes de que el hongomorfo derribe la pared de la trastienda.</p>' +
        '<p class="rf-foes">Si te alcanza, te mata. Lanza trozos de hongo que revientan en esporas y atraviesa las paredes. Cuando le quede la mitad de la vida, algo más saldrá de su guarida.</p>' +
        '<p class="rf-warn">Si mueres, la carrera termina.</p>' +
        '<div class="rf-tot"><span>Puntaje total</span><b>' + st.totals.score + '</b><span>Infectados eliminados</span><b>' + st.totals.kills + '</b></div>';
    } else {
      const n = st.map[st.step][sel.mapa], T = R.typeInfo(n);
      const lineTxt = st.lines ? (n.line === 0 ? 'Línea de arriba' : 'Línea de abajo') + (n.sub ? ' · desvío' : '') : '';
      const how = !st.lines ? '' : (st.step === 0 ? '<p class="rf-line">Al elegir el primer enfrentamiento quedas en esa línea hasta el jefe final: ya no puedes pasarte a la otra. Cada línea tiene un desvío de dos enfrentamientos seguidos, por si lo que viene no te convence.</p>'
        : (n.sub && st.step === st.subAt[n.line] ? '<p class="rf-line">Desvío: son dos enfrentamientos seguidos y luego vuelves a tu línea.</p>' : ''));
      side = '<h3>' + T.name + '</h3>' + (lineTxt ? '<p class="rf-kicker rf-lk">' + lineTxt + '</p>' : '') + '<p class="rf-kicker">' + (G.Run.mapName(n) + ' · ') + 'Enfrentamiento ' + (st.step + 1) + ' de ' + R.STEPS + ({ caza: ' · ' + Math.round(n.time / 60 * 10) / 10 + ' min', saqueo: ' · 3 min 30 s', resistencia: ' · ' + Math.round((n.time || 210) / 60 * 10) / 10 + ' min' }[n.type] || ' · 3 oleadas') + (n.humans ? ' · Escorpiones' : (n.type === 'resistencia' ? ' · infectados' : '')) + '</p>' +
        how + '<p>' + T.text + '</p><p class="rf-foes">' + T.foes + '</p>' +
        '<div class="rf-rew"><span>Recompensa</span><b class="c">' + ICONS.coin + n.monedas + '</b><b class="p">' + ICONS.wrench + n.piezas + '</b><b class="s">' + ICONS.pill + (n.suplementos != null ? n.suplementos : '') + '</b><small>Te espera en el cofre del refugio</small></div>' +
        '<p class="rf-warn">Si sales a mitad de un enfrentamiento, la carrera se pierde.</p>';
    }
    root.innerHTML = '<div class="rf-pan rf-mapp">' + head('Mapa') + '<div class="rf-body"><div class="rf-paper">' + svg + '</div><div class="rf-side">' + side + '</div></div>' +
      foot('Iniciar enfrentamiento') + '</div>';
  }

  // ---------- Comercio ----------
  // Arriba a la derecha: el nombre del puesto y tus monedas, una fila con lo que hay a la venta (4 cosas y los
  // dados para volver a sortearlas) y, debajo, lo elegido con su precio y para qué sirve
  const DICE = '<svg viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate(-12 18 26)"><rect x="6" y="14" width="22" height="22" rx="4"/><circle cx="12" cy="20" r="1.8"/><circle cx="22" cy="30" r="1.8"/><circle cx="17" cy="25" r="1.8"/></g><g transform="rotate(14 32 22)"><rect x="22" y="10" width="20" height="20" rx="4"/><circle cx="27" cy="15" r="1.7"/><circle cx="37" cy="25" r="1.7"/><circle cx="37" cy="15" r="1.7"/><circle cx="27" cy="25" r="1.7"/></g></svg>';
  function renderShop() {
    const R = G.Run, list = R.shopList(), dice = !R.free;
    const n = list.length + (dice ? 1 : 0);
    sel.tienda = Math.min(sel.tienda, Math.max(0, n - 1));
    let cards = '';
    list.forEach((o, i) => {
      const u = G.Icons ? G.Icons.white(o.icon) : null, sold = o.left <= 0;
      cards += '<button type="button" class="rf-sc' + (i === sel.tienda ? ' sel' : '') + (sold ? ' sold' : '') + '" data-i="' + i + '">' +
        (u ? '<img alt="" src="' + u + '">' : '') + (o.n > 1 && !sold ? '<small>' + o.n + '</small>' : '') + (sold ? '<em>Vendido</em>' : '') + '</button>';
    });
    if (dice) cards += '<button type="button" class="rf-sc dice' + (sel.tienda === list.length ? ' sel' : '') + '" data-i="' + list.length + '">' + DICE + '</button>';
    let name = '', price = '', desc = '', no = null;
    if (dice && sel.tienda === list.length) {
      name = 'Volver a sortear el puesto de comercio'; price = R.REROLL;
      desc = 'Vuelve a sortear lo que hay a la venta en el <b>puesto de comercio</b>. Se renueva solo después de cada enfrentamiento.';
      no = R.rerollWhyNot();
    } else {
      const o = list[sel.tienda];
      if (o) {
        name = o.name + (o.n > 1 ? ' x' + o.n : ''); price = R.free ? 'Gratis' : o.price;
        const have = o.weapon ? null : (o.id === 'molotov' ? (player.items.molotov || 0) : (G.Weapons.ammoOfItem(o.id) ? player.ammo[G.Weapons.ammoOfItem(o.id)] : (player.items[o.id] || 0)));
        desc = (o.desc || '') + (have != null ? ' Llevas ' + have + '.' : '');
        no = o.left <= 0 ? 'Vendido' : R.whyNot(o, player);
      }
    }
    const money = R.free ? '<span class="m free">Modo libre · gratis</span>' : '<span class="m"><b>' + R.monedas + '</b>' + ICONS.coin + '</span>';
    root.innerHTML = '<div class="rf-shop2"><div class="hd"><span>Puesto de comercio</span>' + money + '</div>' +
      '<div class="row">' + cards + '</div>' +
      '<div class="inf"><div class="nm"><b>' + name + '</b>' + (price !== '' ? '<span>' + (typeof price === 'number' ? price + ICONS.coin : price) + '</span>' : '') + '</div>' +
      '<p>' + desc + '</p>' + (no ? '<p class="rf-no">' + no + '</p>' : '') + '</div>' +
      '<div class="ft"><button type="button" data-a="ok">' + ICONS.x + 'Comprar</button><button type="button" data-a="close">' + ICONS.o + 'Atrás</button></div></div>' +
      (R.free ? '' : '<div class="rf-shint">Lo que hay en el puesto de comercio cambia después de cada enfrentamiento</div>');
  }

  // ---------- Banco de mejoras ----------
  function benchGuns() {
    const out = [];
    for (const s of player.hands.concat(player.stored)) if (s && (G.Weapons.UPGRADES[s.id] || G.Weapons.get(s.id).special) && out.indexOf(s.id) < 0) out.push(s.id);
    return out;
  }
  function renderBench() {
    const R = G.Run, guns = benchGuns();
    sel.banco = Math.min(sel.banco, Math.max(0, guns.length - 1));
    const wid = guns[sel.banco];
    Bench.setWeapon(wid);
    let left = '';
    guns.forEach((id, i) => {
      const u = G.Icons ? G.Icons.white(id) : null;
      const ups = G.Weapons.UPGRADES[id] || [], n = ups.filter((x) => R.upgraded(id, x.id)).length;
      left += '<button type="button" class="rf-gun' + (i === sel.banco ? ' sel' : '') + '" data-g="' + i + '"><span class="ic">' + (u ? '<img alt="" src="' + u + '">' : '') + '</span><span class="nm">' + G.Weapons.get(id).name + '</span><span class="pips">' + ups.map((x) => '<i class="' + (R.upgraded(id, x.id) ? 'on' : '') + '"></i>').join('') + '</span><small>' + n + '/' + ups.length + '</small></button>';
    });
    const ups = wid ? (G.Weapons.UPGRADES[wid] || []) : [];
    sel.up = Math.min(sel.up, Math.max(0, ups.length - 1));
    let right = '';
    ups.forEach((u, i) => {
      const no = R.upgradeWhyNot(wid, u), done = R.upgraded(wid, u.id);
      right += '<button type="button" class="rf-up' + (i === sel.up ? ' sel' : '') + (done ? ' done' : (no ? ' off' : '')) + '" data-u="' + i + '"><span class="nm">' + u.name + '</span>' +
        '<span class="cost">' + (done ? 'Mejorada' : (R.free ? 'Gratis' : ICONS.gear + u.cost)) + '</span></button>';
    });
    const u = ups[sel.up];
    const w = wid ? G.Weapons.get(wid) : null;
    let info = '';
    if (w && w.special) info = '<p class="rf-udesc">Arma especial: no se puede mejorar.</p>';
    if (u) {
      const no = R.upgradeWhyNot(wid, u);
      info = '<p class="rf-udesc">' + u.desc + '</p>' + (no && no !== 'Mejorada' ? '<p class="rf-no">' + no + '</p>' : '');
    }
    const stats = w ? '<div class="rf-stats">' + statRow('Daño', (w.dmg[0] + w.dmg[1]) / 2 * (w.pellets || 1), 7) + statRow('Cadencia', 1 / w.fire, 4.5) +
      statRow('Estabilidad', w.gun === 'bow' ? 1 : 1 / ((w.kickMul || 1) + (w.swayMul || 1) - 1), 1) + (w.gun === 'bow' ? statRow('Alcance', w.range, 75) : statRow('Capacidad', w.mag, 12, w.mag)) + '</div>' : '';
    root.innerHTML = '<div class="rf-pan rf-benchp">' + head('Banco de mejoras') + '<div class="rf-body"><div class="rf-guns">' + left + '</div><div class="rf-mid"></div>' +
      '<div class="rf-ups"><h3>' + (w ? w.name : '') + '</h3>' + stats + '<div class="rf-uplist">' + right + '</div>' + info + '</div></div>' +
      foot(u && !R.upgraded(wid, u.id) ? 'Mejorar' : null) + '</div>';
  }
  function statRow(name, v, max, label) {
    const k = Math.max(0.04, Math.min(1, v / max));
    return '<div class="rf-stat"><span>' + name + '</span><i><b style="width:' + Math.round(k * 100) + '%"></b></i>' + (label != null ? '<em>' + label + '</em>' : '') + '</div>';
  }

  // ---------- Acciones ----------
  function confirm() {
    const R = G.Run;
    if (panel === 'mapas') {
      const s = mapasList()[sel.mapas];
      if (!s || s[0] === G.World.layout) return;
      close(false);
      if (Refugio.onTravel) Refugio.onTravel(s[0]);
      return;
    }
    if (panel === 'mapa') {
      if (R.done) { close(false); if (Refugio.onStartEncounter) Refugio.onStartEncounter('boss'); return; }
      const i = sel.mapa;
      if (R.allowed().indexOf(i) < 0) return;
      close(false);
      if (Refugio.onStartEncounter) Refugio.onStartEncounter(i);
    } else if (panel === 'cofre') {
      takeRewards();
    } else if (panel === 'tienda') {
      const list = R.shopList();
      if (!R.free && sel.tienda === list.length) {
        const r = R.reroll(player);
        if (r) msg(r.msg, r.fail ? 'warn' : 'good');
        if (r && r.fail) nudge();
        render();
        return;
      }
      const o = list[sel.tienda];
      if (!o) return;
      const r = R.buy(o.id, player);
      if (r) msg(r.msg, r.fail ? 'warn' : 'good');
      if (r && r.fail) nudge();
      render();
    } else if (panel === 'banco') {
      const wid = benchGuns()[sel.banco], u = wid && (G.Weapons.UPGRADES[wid] || [])[sel.up];
      if (!u || Bench.busy) return;
      const r = R.upgrade(wid, u.id, player);
      if (!r) return;
      if (r.fail) { msg(r.msg, 'warn'); nudge(); return; }
      Bench.play(u.id, () => { msg(r.msg, 'good'); render(); });
      render();
    }
  }
  function nudge() { const b = root.querySelector('.rf-no, .rf-foot'); if (b) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); } }

  function onClick(e) {
    const t = e.target.closest('[data-a],[data-i],[data-g],[data-u]');
    if (!t || !panel) return;
    e.preventDefault(); e.stopPropagation();
    if (t.dataset.a === 'close') { close(); return; }
    if (t.dataset.a === 'ok') { confirm(); return; }
    if (t.dataset.g != null) { if (Bench.busy) return; sel.banco = +t.dataset.g; sel.up = 0; render(); return; }
    if (t.dataset.u != null) { if (Bench.busy) return; const i = +t.dataset.u; if (sel.up === i) confirm(); else { sel.up = i; render(); } return; }
    if (t.dataset.i != null) {
      const i = +t.dataset.i;
      if (i < 0) return;
      if (panel === 'mapa') { if (sel.mapa === i) confirm(); else { sel.mapa = i; render(); } }
      else if (panel === 'mapas') { if (sel.mapas === i) confirm(); else { sel.mapas = i; if (G.Audio) G.Audio.play('ui'); render(); } }
      else if (panel === 'tienda') { if (sel.tienda === i) confirm(); else { sel.tienda = i; if (G.Audio) G.Audio.play('ui'); render(); } }
    }
  }
  function move(dx, dy) {
    if (panel === 'mapa') {
      const A = G.Run.allowed();
      if ((dy || dx) && A.length > 1) {
        // (de arriba abajo, como se ven en el mapa)
        const col = G.Run.choices(), y = (i) => { const n = col[i], L = n.line != null ? n.line : i; return n.sub ? (L ? 3 : 0) : (L ? 2 : 1); };
        A.sort((a, b) => y(a) - y(b));
        const at = Math.max(0, A.indexOf(sel.mapa));
        sel.mapa = A[(at + (dy || dx) + A.length) % A.length]; render();
      }
    }
    else if (panel === 'mapas') { const n = mapasList().length; sel.mapas = (sel.mapas + (dx || dy) + n) % n; render(); }
    else if (panel === 'tienda') {
      const n = G.Run.shopList().length + (G.Run.free ? 0 : 1); if (!n) return;
      sel.tienda = U.clamp(sel.tienda + dx + dy * 5, 0, n - 1); render();
    } else if (panel === 'banco' && !Bench.busy) {
      if (dx) { const n = benchGuns().length; sel.banco = (sel.banco + dx + n) % n; sel.up = 0; }
      if (dy) { const wid = benchGuns()[sel.banco], n = Math.max(1, wid ? (G.Weapons.UPGRADES[wid] || []).length : 1); sel.up = (sel.up + dy + n) % n; }
      render();
    }
  }
  function onKey(e) {
    if (!panel) return;
    const c = e.code;
    let used = true;
    if (c === 'Escape' || c === 'Backspace') close();
    else if (c === 'Enter' || c === 'Space') confirm();
    else if (c === 'ArrowLeft' || c === 'KeyA') move(-1, 0);
    else if (c === 'ArrowRight' || c === 'KeyD') move(1, 0);
    else if (c === 'ArrowUp' || c === 'KeyW') move(0, -1);
    else if (c === 'ArrowDown' || c === 'KeyS') move(0, 1);
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  let padPrev = [];
  function pollPad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads(); let p = null;
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { p = pads[i]; break; }
    if (!p) return;
    const now = G.PadUI ? G.PadUI.buttons() : p.buttons.map((b) => !!(b && b.pressed));     // (stick y repetición)
    const prev = padPrev;                   // (lo de antes: comparar con padPrev ya cambiado no detectaba nada)
    const edge = (i) => now[i] && !prev[i];
    padPrev = now;
    if (!panel) return;
    if (edge(0)) confirm(); else if (edge(1)) close();
    else if (edge(14)) move(-1, 0); else if (edge(15)) move(1, 0); else if (edge(12)) move(0, -1); else if (edge(13)) move(0, 1);
  }

  // ================= Banco de mejoras en 3D =================
  // Vista desde arriba: el arma tumbada en el tapete verde, herramientas alrededor y las dos manos (con los
  // colores del personaje). Al mejorar, la izquierda sujeta el arma, la derecha trabaja con el destornillador
  // y aparece la pieza nueva (las mejoras se ven en el arma: cargador largo, cinta en la empuñadura, freno de
  // boca, muelle pulido...)
  const Bench = {
    sc: null, cam: null, gun: null, wid: null, parts: null, hands: null, tool: null, anim: null, t: 0, busy: false, on: false,
    build() {
      if (this.sc) return;
      const sc = new THREE.Scene();
      sc.background = new THREE.Color(0x0b0a09);
      sc.add(new THREE.HemisphereLight(0xfff0dc, 0x2a2018, 0.75));
      const key = new THREE.DirectionalLight(0xffe6c4, 0.95); key.position.set(-0.6, 2.2, -0.4); sc.add(key);
      const fill = new THREE.DirectionalLight(0x9fb4c8, 0.25); fill.position.set(1, 1.2, 1.4); sc.add(fill);
      // mesa (vetas) y tapete con cuadrícula
      const wood = document.createElement('canvas'); wood.width = 512; wood.height = 256;
      let x = wood.getContext('2d');
      x.fillStyle = '#4a3624'; x.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 90; i++) { x.strokeStyle = 'rgba(' + (20 + Math.random() * 40 | 0) + ',' + (12 + Math.random() * 25 | 0) + ',8,' + (0.15 + Math.random() * 0.25) + ')'; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const y = Math.random() * 256; x.moveTo(0, y); x.bezierCurveTo(170, y + (Math.random() - 0.5) * 20, 340, y + (Math.random() - 0.5) * 20, 512, y + (Math.random() - 0.5) * 14); x.stroke(); }
      for (let k = 1; k < 4; k++) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, k * 64 - 1, 512, 2); }
      const tw = new THREE.CanvasTexture(wood); tw.encoding = THREE.sRGBEncoding;
      const table = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), new THREE.MeshLambertMaterial({ map: tw }));
      table.rotation.x = -Math.PI / 2; sc.add(table);
      const mc = document.createElement('canvas'); mc.width = 512; mc.height = 340;
      x = mc.getContext('2d');
      x.fillStyle = '#25503f'; x.fillRect(0, 0, 512, 340);
      x.strokeStyle = 'rgba(160,215,190,0.28)'; x.lineWidth = 1;
      for (let i = 0; i <= 512; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 340); x.stroke(); }
      for (let i = 0; i <= 340; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
      x.strokeStyle = 'rgba(190,235,215,0.5)'; x.lineWidth = 2;
      for (let i = 0; i <= 512; i += 80) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 340); x.stroke(); }
      x.fillStyle = 'rgba(200,240,220,0.55)'; x.font = '12px sans-serif';
      for (let i = 0; i <= 512; i += 80) x.fillText(String(i / 16), i + 3, 14);
      x.strokeStyle = 'rgba(200,240,220,0.35)'; x.beginPath(); x.arc(420, 260, 50, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(370, 260); x.lineTo(470, 260); x.moveTo(420, 210); x.lineTo(420, 310); x.stroke();
      const tm = new THREE.CanvasTexture(mc); tm.encoding = THREE.sRGBEncoding;
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshLambertMaterial({ map: tm }));
      mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.002, -0.02); sc.add(mat);
      this.vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
      // herramientas y piezas sueltas alrededor
      const m = new G.Mesher();
      m.box(0.62, 0.008, -0.34, 0.2, 0.012, 0.03, 0x9aa0a6, 0.4); m.box(0.5, 0.012, -0.3, 0.07, 0.022, 0.036, 0xa8322a, 0.4);
      m.cyl(-0.62, 0.012, 0.36, 0.03, 0.03, 0.02, 0x8a8f94, 10); m.cyl(-0.55, 0.012, 0.4, 0.02, 0.02, 0.02, 0x8a8f94, 8);
      for (let k = 0; k < 6; k++) m.box(-0.66 + k * 0.025, 0.004, -0.38 + (k % 2) * 0.02, 0.012, 0.006, 0.006, 0xc2a24a, k);
      m.box(0.66, 0.01, 0.3, 0.12, 0.02, 0.08, 0x3d4a5a);
      m.cyl(0.4, 0.04, 0.42, 0.04, 0.035, 0.08, 0x6a6e72, 10);
      const tools = new THREE.Mesh(m.build(), this.vmat); sc.add(tools);
      const cam = new THREE.PerspectiveCamera(34, 1, 0.05, 10);
      this.sc = sc; this.cam = cam;
      this.hands = { L: this.hand(-1), R: this.hand(1) };
      sc.add(this.hands.L.g); sc.add(this.hands.R.g);
      // destornillador (en la mano derecha al trabajar)
      const tsm = new G.Mesher();
      tsm.cyl(0, 0, -0.05, 0.014, 0.016, 0.1, 0xc9452f, 8, undefined, Math.PI / 2);
      tsm.cyl(0, 0, -0.15, 0.004, 0.004, 0.1, 0xb8bcc0, 6, undefined, Math.PI / 2);
      this.tool = new THREE.Mesh(tsm.build(), this.vmat);
      this.hands.R.grip.add(this.tool);
      this.tool.visible = false;
      this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      this.flash.material.toneMapped = false; this.flash.scale.setScalar(0.18);
      sc.add(this.flash);
    },
    // mano y antebrazo (la palma hacia abajo, los dedos hacia -Z); colores del personaje
    hand(side) {
      const ch = G.Player.CHARS[player ? player.charId : 'vera'] || G.Player.CHARS.vera;
      const skin = ch.opts.skin, dark = U.shade(skin, 0.82), band = ch.opts.bandCol != null ? ch.opts.bandCol : 0xd9d2bf;
      const m = new G.Mesher();
      m.cyl(0, 0, 0.2, 0.034, 0.042, 0.3, skin, 10, undefined, Math.PI / 2);
      if (side < 0) m.cyl(0, 0, 0.16, 0.037, 0.044, 0.12, band, 10, undefined, Math.PI / 2);
      m.box(0, 0, 0.0, 0.085, 0.032, 0.1, skin);
      for (let f = 0; f < 4; f++) {
        const fx = (-0.03 + f * 0.02) * side;
        m.box(fx, -0.002, -0.075 - (f === 1 || f === 2 ? 0.006 : 0), 0.017, 0.02, 0.06, f % 2 ? skin : dark);
      }
      m.box(-0.052 * side, -0.004, -0.02, 0.02, 0.02, 0.055, skin, -0.6 * side);
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(m.build(), this.vmat);
      g.add(mesh);
      const grip = new THREE.Group(); grip.position.set(0.0, -0.01, -0.08); g.add(grip);
      return { g, grip, side, p: new THREE.Vector3(), r: 0 };
    },
    setWeapon(id) {
      this.build();
      if (!id) { if (this.gun) this.gun.visible = false; return; }
      // (mientras se anima una mejora, la pieza nueva la pone la animación)
      if (this.wid === id && this.gun && (this.busy || this.partsKey === this.key(id))) return;
      if (this.gun) { this.sc.remove(this.gun); }
      this.wid = id;
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(G.Models.weaponGeometry(id), this.vmat);
      // tumbada de lado: a lo largo hacia la derecha y la parte de arriba hacia el fondo
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)));
      mesh.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(mesh), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
      mesh.position.set(-c.x, -bb.min.y + 0.004, -c.z);
      g.add(mesh);
      this.size = s; this.len = s.x;
      // piezas de las mejoras (se ven en el arma)
      this.parts = new THREE.Group(); g.add(this.parts);
      this.buildParts(id);
      this.gun = g;
      this.sc.add(g);
      g.position.set(0, 0, 0.0);
      this.slide = 1;
    },
    key(id) { const up = (G.Run.st && G.Run.st.up[id]) || {}; return Object.keys(up).sort().join(','); },
    // Dónde va cada pieza y cómo es (en el sistema del arma tumbada: x a lo largo, z hacia la cámara)
    partInfo(id) {
      const L = this.len, s = this.size, y = s.y + 0.006, short = G.Weapons.isShort(G.Weapons.get(id));
      const gx = -L * 0.5 + (short ? L * 0.25 : L * 0.3);       // empuñadura / cargador
      const P = {};
      if (id === 'arco') {
        P.alcance = { at: [0.0, y, -0.02], style: 'arco', geo: (m) => { m.cyl(0.02, y, 0.02, 0.006, 0.006, 0.22, 0x2a2a2a, 6, undefined, Math.PI / 2); m.cyl(0.02, y, 0.13, 0.014, 0.014, 0.03, 0x8a8f94, 8, undefined, Math.PI / 2); m.box(-0.03, y, -0.03, 0.02, 0.006, 0.04, 0xd9b23a); } };
        return P;
      }
      P.capacidad = { at: [gx + L * 0.06, y * 0.5, s.z * 0.5 + 0.02], style: 'cargador',
        geo: (m) => m.box(gx + L * 0.06, y * 0.5, s.z * 0.5 + (short ? 0.03 : 0.045), short ? 0.03 : 0.05, y, short ? 0.06 : 0.09, id === 'revolver' ? 0x8a6b3a : 0x2c2e30) };
      P.estabilidad = { at: [gx - L * 0.02, y, 0.0], style: 'cinta', geo: (m) => m.box(gx - L * 0.02, y, 0.0, short ? 0.035 : 0.07, 0.004, s.z * 0.55, 0x6e5034) };
      P.retroceso = { at: [L * 0.5 + 0.012, y * 0.6, -s.z * 0.1], style: 'boca', geo: (m) => m.box(L * 0.5 + 0.012, y * 0.6, -s.z * 0.1, 0.035, y * 0.9, Math.min(0.03, s.z * 0.5), 0x3a3d40) };
      P.cadencia = { at: [0.0, y, -s.z * 0.3], style: 'tornillo', geo: (m) => m.box(0.0, y, -s.z * 0.3, L * 0.3, 0.004, 0.008, 0xd8dcdf) };
      P.dano = { at: [L * 0.3, y, -s.z * 0.1], style: 'boca', geo: (m) => m.box(L * 0.3, y, -s.z * 0.1, L * 0.3, 0.005, 0.012, 0x6b7a5a) };
      P.recarga = { at: [-L * 0.12, y, -s.z * 0.15], style: 'tornillo', geo: (m) => { m.box(-L * 0.12, y, -s.z * 0.15, 0.05, 0.005, 0.012, 0xd8dcdf); m.cyl(-L * 0.12 + 0.03, y, -s.z * 0.15, 0.008, 0.008, 0.006, 0xc9a24a, 8); } };
      return P;
    },
    buildParts(id, except) {
      while (this.parts.children.length) this.parts.remove(this.parts.children[0]);
      const up = (G.Run.st && G.Run.st.up[id]) || {};
      this.partsKey = this.key(id);
      this.info = this.partInfo(id);
      const m = new G.Mesher();
      for (const k in this.info) if (up[k] && k !== except) this.info[k].geo(m);
      if (m.count) { try { this.parts.add(new THREE.Mesh(m.build(), this.vmat)); } catch (e) { /* sin piezas */ } }
    },
    // la pieza nueva sola (para la animación), con el origen en su sitio para poder girarla o estirarla
    newPart(id, uid) {
      const I = this.partInfo(id)[uid];
      if (!I) return null;
      const m = new G.Mesher(); I.geo(m);
      const mesh = new THREE.Mesh(m.build(), this.vmat);
      const g = new THREE.Group();
      g.position.set(I.at[0], I.at[1], I.at[2]);
      mesh.position.set(-I.at[0], -I.at[1], -I.at[2]);
      g.add(mesh);
      return { g, I };
    },
    enter() {
      this.build();
      // las manos con los colores del personaje de ahora
      if (this.handsChar !== player.charId) {
        this.handsChar = player.charId;
        for (const k of ['L', 'R']) { const h = this.hands[k]; this.sc.remove(h.g); }
        this.hands = { L: this.hand(-1), R: this.hand(1) };
        this.sc.add(this.hands.L.g); this.sc.add(this.hands.R.g);
        this.hands.R.grip.add(this.tool);
      }
      this.on = true; this.busy = false; this.anim = null; this.slide = 1;
    },
    leave() { if (this.anim && this.anim.np) this.gun.remove(this.anim.np.g); this.on = false; this.busy = false; this.anim = null; this.tool.visible = false; },
    // Anima la mejora (unos 2,6 s, basada en la del vídeo de la pistola). Según la pieza:
    //   cargador  la derecha trae el cargador nuevo desde abajo y lo encaja de un empujón
    //   cinta     la derecha da vueltas alrededor de la empuñadura y la cinta se va enrollando
    //   boca      la derecha trae la pieza por delante del cañón y la enrosca (gira sobre sí misma)
    //   tornillo  la derecha trabaja con el destornillador sobre la pieza
    //   arco      la derecha acerca la mira y el estabilizador y los aprieta
    // La izquierda siempre sujeta el arma por la culata o la empuñadura.
    play(uid, done) {
      this.busy = true;
      if (this.gun) this.buildParts(this.wid, uid);
      const np = this.gun ? this.newPart(this.wid, uid) : null;
      if (np) { np.g.visible = false; this.gun.add(np.g); }
      this.anim = { t: 0, uid, done, ticks: 0, np, style: np ? np.I.style : 'tornillo' };
    },
    render(renderer, dt) {
      this.build();
      const t = (this.t += dt);
      const W = window.innerWidth, H = window.innerHeight, asp = W / H;
      // cámara desde arriba, algo inclinada; más cerca para las armas cortas
      const L = this.len || 0.6, d = 0.8 + L * 0.9;
      this.cam.aspect = asp; this.cam.fov = asp < 1 ? 52 : 34; this.cam.updateProjectionMatrix();
      this.cam.position.set(0.0 + Math.sin(t * 0.2) * 0.01, d * 1.0, d * 0.42);
      this.cam.lookAt(0, 0, 0.03);
      // el arma entra deslizándose al cambiarla
      if (this.gun) { this.slide = Math.max(0, this.slide - dt * 3.5); this.gun.position.x = -this.slide * this.slide * 0.9; this.gun.visible = true; }
      // manos: en reposo abajo, a los lados (respiran un poco)
      const HL = this.hands.L, HR = this.hands.R, s = Math.max(0.6, Math.min(1.4, L * 1.4));
      const restL = new THREE.Vector3(-0.3 * s - 0.08, 0.04, 0.38 * s + 0.12), restR = new THREE.Vector3(0.3 * s + 0.08, 0.04, 0.4 * s + 0.12);
      let pl = restL.clone(), pr = restR.clone(), rl = -0.5, rr = 0.5, tl = 0, twist = 0, toolOn = false;
      pl.y += Math.sin(t * 1.4) * 0.004; pr.y += Math.sin(t * 1.4 + 1) * 0.004;
      const A = this.anim;
      if (A) {
        A.t += dt;
        const k = A.t, st = A.style, np = A.np;
        const sz = this.size || new THREE.Vector3(0.6, 0.03, 0.1);
        const holdP = new THREE.Vector3(-L * 0.32, sz.y + 0.015, sz.z * 0.25);
        const tgt = np ? new THREE.Vector3(np.I.at[0], np.I.at[1], np.I.at[2]) : new THREE.Vector3(0.05, 0.04, 0);
        const inn = U.smooth(Math.min(1, k / 0.45)), out = U.smooth(Math.max(0, Math.min(1, (k - 2.1) / 0.45)));
        const w = inn * (1 - out);
        pl.lerp(holdP, w); rl = U.lerp(-0.5, -0.95, w);
        // mano derecha: dónde trabaja y con qué
        let RR = 0.62, reach = 0.29, work = tgt.clone();
        const carry = st === 'cargador' || st === 'boca' || st === 'arco';      // trae la pieza en la mano
        if (st === 'tornillo') toolOn = k > 0.3 && k < 2.4;
        // posición de la pieza nueva (antes de colocarse va con la mano)
        let place = U.smooth(Math.max(0, Math.min(1, (k - 0.5) / 0.9)));
        if (np) {
          np.g.visible = k > 0.25;
          np.g.scale.set(1, 1, 1); np.g.rotation.set(0, 0, 0);
          np.g.position.set(np.I.at[0], np.I.at[1], np.I.at[2]);
        }
        if (st === 'cargador') {
          // viene desde abajo (hacia la cámara) y entra de un empujón
          const off = (1 - place) * 0.28;
          if (np) np.g.position.z += off; work.z += off;
          reach = 0.12; RR = 0.3;
          if (k > 1.4 && !A.click) { A.click = true; if (G.Audio) G.Audio.play('magIn'); }
        } else if (st === 'boca' || st === 'arco') {
          // llega por delante y se enrosca
          const off = (1 - place) * 0.3;
          if (np) { np.g.position.x += off; if (st === 'boca') np.g.rotation.x = (1 - place) * 9 + Math.sin(k * 12) * 0.2 * (k < 1.6 ? 1 : 0); }
          work.x += off; reach = 0.16; RR = 0.9;
          if (k > 0.6 && k < 1.6) { twist = Math.sin(k * 14) * 0.5; A.ticks += dt; if (A.ticks > 0.25) { A.ticks = 0; if (G.Audio) G.Audio.play('dry'); } }
        } else if (st === 'cinta') {
          // vueltas alrededor de la empuñadura: la cinta crece
          const sp = Math.max(0, Math.min(1, (k - 0.45) / 1.2));
          if (np) np.g.scale.set(0.05 + 0.95 * sp, 1, 1);
          if (k > 0.45 && k < 1.65) { const a = (k - 0.45) * 11; work.x += Math.cos(a) * 0.03; work.z += Math.sin(a) * 0.03; work.y += 0.01 * Math.sin(a); A.ticks += dt; if (A.ticks > 0.3) { A.ticks = 0; if (G.Audio) G.Audio.play('rustle'); } }
          reach = 0.14; RR = 0.5;
        } else {
          // destornillador
          if (k > 0.5 && k < 2.0) {
            twist = Math.sin((k - 0.5) * 18) * 0.6;
            work.x += Math.sin((k - 0.5) * 9) * 0.006; work.z += Math.cos((k - 0.5) * 9) * 0.004;
            A.ticks += dt;
            if (A.ticks > 0.32) { A.ticks = 0; if (G.Audio) G.Audio.play(Math.random() < 0.5 ? 'dry' : 'shellIn'); }
          }
          if (np) np.g.visible = k > 1.4;
        }
        const workP = work.add(new THREE.Vector3(Math.sin(RR) * reach, 0.03, Math.cos(RR) * reach));
        pr.lerp(workP, w); rr = U.lerp(0.5, RR, w);
        if (carry && np && k < 0.5) np.g.visible = false;
        if (k > 1.5 && !A.placed) {
          A.placed = true;
          this.flash.position.copy(tgt).add(this.gun.position); this.flash.position.y += 0.02;
          this.flashT = 0.6;
          if (G.Audio && st !== 'cargador') G.Audio.play('magIn');
        }
        tl = w;
        if (k >= 2.6) {
          this.anim = null; this.busy = false;
          if (np) this.gun.remove(np.g);
          this.buildParts(this.wid);
          if (A.done) A.done();
        }
      }
      this.flashT = Math.max(0, (this.flashT || 0) - dt);
      this.flash.material.opacity = Math.min(1, this.flashT * 2.4);
      HL.g.position.copy(pl); HL.g.rotation.set(0, rl, 0);
      HR.g.position.copy(pr); HR.g.rotation.set(0, rr, twist * 0.2);
      this.tool.visible = toolOn;
      this.tool.rotation.z = twist;
      if (tl) HL.g.rotation.x = -0.15 * tl;
      renderer.render(this.sc, this.cam);
    }
  };

  // ================= Bucle =================
  function update(dt) {
    pollPad();
    const P = player;
    if (!P || !camera) return;
    // marcadores: estaciones cerca (dentro del refugio)
    for (const p of Props.list) {
      const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
      if (p.kind === 'station') {
        const show = !panel && d < 7.5 && !(G.Loot.isOpen || G.Backpack.isOpen);
        placeMark(p, show, d, false);
        if (p.glint) { const has = p.id === 'arma' || (!!G.Run.pending && panel !== 'cofre'); p.glint.visible = has; if (has) { p.t += dt; p.glint.material.opacity = 0.35 + 0.25 * Math.sin(p.t * 3); } }
        if (p.mark && p.id === 'cofre') { p.mark.classList.toggle('has', !!G.Run.pending); if (p.off && p.off()) placeMark(p, false, d, false); }
      }
    }
    // cofres de suministros: el icono solo los primeros 5 segundos
    for (const ch of chests) {
      // no se puede atravesar: empuja a la jugadora fuera de la caja
      const c = Math.cos(ch.mesh.rotation.y), sn = Math.sin(ch.mesh.rotation.y);
      const rx = P.pos.x - ch.x, rz = P.pos.z - ch.z;
      const lx = rx * c - rz * sn, lz = rx * sn + rz * c;
      const hx = 0.575 + 0.28, hz = 0.33 + 0.28;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz && (P.lv || 0) === 0) {
        const ox = hx - Math.abs(lx), oz = hz - Math.abs(lz);
        let nx = lx, nz = lz;
        if (ox < oz) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
        P.pos.x = ch.x + nx * c + nz * sn; P.pos.z = ch.z - nx * sn + nz * c;
      }
      ch.pingT = Math.max(0, (ch.pingEnd - performance.now()) / 1000);
      placeMark(ch, ch.pingT > 0 && !panel, Math.hypot(ch.x - P.pos.x, ch.z - P.pos.z), true);
      if (ch.pingT > 0) ch.mark.style.opacity = Math.min(1, ch.pingT / 0.8).toFixed(2);
    }
    updateCrate(dt);
    // avisos de zona (dónde aparecieron los infectados): unos segundos, a través de las paredes
    for (let i = pings.length - 1; i >= 0; i--) {
      const q = pings[i];
      q.t = (q.end - performance.now()) / 1000;
      if (q.t <= 0) { q.mark.remove(); pings.splice(i, 1); continue; }
      placeMark(q, !panel, Math.hypot(q.x - P.pos.x, q.z - P.pos.z), true);
      q.mark.style.opacity = Math.min(1, q.t / 0.8).toFixed(2);
    }
    // cofre de recompensas: al cerrarlo se guarda lo que cogiste
    // al cerrar la mochila (fabricaste algo) también
    if (inside && packWas && !G.Backpack.isOpen) G.Run.keep(P);
    packWas = G.Backpack.isOpen;
    if (inside) renderHud();
  }

  const Refugio = {
    PING_LOGO,
    onStartEncounter: null, onFinishRun: null, onTravel: null,
    init(sc, pl, cam) {
      scene = sc; player = pl; camera = cam;
      root = document.createElement('div'); root.id = 'rf'; root.className = 'hidden';
      document.body.appendChild(root);
      hud = document.createElement('div'); hud.id = 'rf-hud'; hud.className = 'hidden';
      document.body.appendChild(hud);
      marks = document.createElement('div'); marks.id = 'rf-marks';
      document.body.appendChild(marks);
      root.addEventListener('click', onClick);
      root.addEventListener('pointerdown', (e) => e.stopPropagation());
      window.addEventListener('keydown', onKey, true);
    },
    set onMessage(fn) { onMsg = fn; },
    // al entrar al refugio (el mundo ya está generado con la distribución 'refugio')
    // free: el modo libre (solo el comercio y el banco, gratis; sin el HUD del refugio)
    enter(free) {
      Props.clear();
      inside = !free;
      buildStations();
      if (!free) { hud.classList.remove('hidden'); renderHud(); buildShelf(); }
    },
    leave() {
      close(false);
      if (cur) cur.classList.add('hidden');
      inside = false;
      Props.clear();
      hud.classList.add('hidden');
    },
    // al reiniciar el mundo
    clear() { close(false); Props.clear(); clearPings(); clearChests(); },
    get chests() { return chests; },
    ping,
    update,
    open, close,
    get inside() { return inside; },
    get panelOpen() { return !!panel; },
    get panel() { return panel; },
    get wants3d() { return panel === 'banco'; },
    render3d(renderer, dt) { Bench.render(renderer, dt); },
    spawnCase,
    Bench
  };
  G.Refugio = Refugio;
})(window.Game = window.Game || {});
