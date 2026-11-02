(function (G) {
  'use strict';

  // Mundo infinito por chunks de 32x32 casillas (1 casilla = 1 metro).
  //
  // Las paredes son FINAS y van en las aristas entre casillas (como en el original):
  //   eN[casilla] = arista norte de la casilla, eW[casilla] = arista oeste.
  // Los datos de cada chunk se generan una vez y se conservan siempre (también los
  // cambios: puertas abiertas o rotas, luces, objetos recogidos). Los modelos 3D
  // solo existen cerca del jugador.

  const B = G.Buildings;
  const E = B.E, F = B.F;
  const U = G.Util;

  const CS = 32, SHIFT = 5, MASK = 31;
  const WALL_H = 2.7, DOOR_H = 2.1, WIN_LO = 0.9, WIN_HI = 2.05;
  const FLOOR_H = 3.0;           // altura de una planta (el piso de arriba empieza aquí)
  const WALL_T = 0.12, HT = WALL_T / 2;
  const FENCE_H = 1.15;
  const O = { NONE: 0, TREE: 1, PINE: 2, LAMP: 3, BUSH: 4 };

  // ---- Mundo de pruebas (beta de mecánicas, rumbo a un modo tipo "sin retorno"):
  // pequeño, plano y cerrado con una valla. El mundo infinito sigue en el código: SMALL = false.
  const SMALL = true;
  const NO_TALL = true;           // sin hierba alta en ningún mapa
  // el hongomorfo (BIG) no cabe por puertas, arcos ni ventanas: solo pasa por donde no hay arista (paredes derribadas)
  let BIG = false;
  const bigWalk = (e) => e !== E.NONE;
  const ARENA = 1;                         // chunks de -ARENA a ARENA: 3 x 3 = 96 x 96 m
  // Campo de pruebas (beta de mecánicas): sin casas, árboles, calles ni farolas; un cuadrado de
  // 40 x 40 m con unos pocos muros, un coche, mesas y cajas para probar coberturas, remates contra
  // la pared y objetos encima de las mesas. FIELD = false vuelve al pueblo de 96 x 96 m
  const FIELD = true;
  const FIELD_MIN = -4, FIELD_MAX = 36;
  // borde del mapa (cambia con el mapa: el campo de pruebas, el refugio o uno de los mapas de G.Maps)
  let AMIN = FIELD ? FIELD_MIN : -ARENA * CS, AMAX = FIELD ? FIELD_MAX : (ARENA + 1) * CS;
  let BND = null;            // [x0, z0, x1, z1]: área jugable del mapa (si la define)
  const LOOT = false;                      // botín en casas, muebles y suelo (guardado para después)
  const AUTO_ZOMBIES = false;              // zombis que aparecen solos (en pruebas se sacan con el botón)
  G.LOOT_ON = LOOT;
  function isMap(id) { return !!(G.Maps && G.Maps.get(id)); }
  function inArena(cx, cz) { return !SMALL || (Math.abs(cx) <= ARENA && Math.abs(cz) <= ARENA); }
  const DATA_RADIUS = 2;
  const MESH_RADIUS = 1;
  const KEEP_RADIUS = 2;

  let SEED = 1337;
  const CHUNK_SALT = 0xb9bcd352 | 0;   // sal de los chunks (se cancela con la de main)
  let scene = null;
  let R = null;              // recursos compartidos (materiales, geometrías)
  const chunks = new Map();
  const buildQueue = [];
  let lastCX = NaN, lastCZ = NaN, lastChunk = null;
  let lastPCX = NaN, lastPCZ = NaN;
  const animDoors = [];
  let spawnPoint = { x: 16.5, z: 16.5 };
  // Distribución del mapa: 'campo' (el campo de pruebas, donde se juegan los enfrentamientos) o 'refugio'
  // (el escondite del modo Retorno: un edificio cerrado, sin salida, en medio del campo)
  let layout = 'campo';        // (o 'libre': el campo del modo libre, con comercio y banco de mejoras gratis)
  const REFUGE_AT = { ox: 9, oz: 11 };          // esquina del refugio dentro del chunk (0, 0)
  let spawnCrate = null;
  let building = null;
  // ¿Puede aparecer esta arma? (lo pone main: no salen armas que ya llevas ni si no te caben)
  let owns = () => true;        // chunk que se está construyendo por etapas { c, it }      // mueble de la sala inicial donde está la palanca
  const listeners = [];      // avisos de ruido al romper puertas o ventanas

  // ---------- Aleatoriedad determinista ----------
  function hash(a, b, salt) {
    let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) +
            Math.imul(salt | 0, 1442695041) + Math.imul(SEED | 0, 1103515245);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  function vnoise(x, z, salt) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = x - x0, fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hash(x0, z0, salt), b = hash(x0 + 1, z0, salt);
    const c = hash(x0, z0 + 1, salt), d = hash(x0 + 1, z0 + 1, salt);
    const top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return top + (bot - top) * sz;
  }

  function chunkSeed(cx, cz) {
    return (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(SEED | 0, 83492791)) >>> 0;
  }

  function isTown(cx, cz) {
    if (FIELD) return false;
    if (cx === 0 && cz === 0) return true;
    if (SMALL) return false;                 // en el mundo de pruebas solo el centro es pueblo
    return vnoise(cx / 2.2 + 0.5, cz / 2.2 + 0.5, 3) > 0.6;
  }
  // ---------- Terreno ----------
  // Altura del suelo por ruido (igual en todos los chunks: no hay cortes entre zonas).
  // Fuera del pueblo: lomas de 4 a 8 m y algún cerro de hasta 9 m; en el pueblo, casi plano
  // (1 o 2 m de diferencia de punta a punta). Pequeñas irregularidades en todas partes.
  const townCache = new Map();
  function townF(cx, cz) {
    const k = cx * 100003 + cz;
    let v = townCache.get(k);
    if (v === undefined) { v = isTown(cx, cz) ? 1 : 0; townCache.set(k, v); }
    return v;
  }
  // 0 en pleno campo, 1 en el pueblo (y en sus bordes): las lomas empiezan dentro del chunk de campo
  function townness(x, z) {
    const fx = x / CS - 0.5, fz = z / CS - 0.5;
    const cx0 = Math.floor(fx), cz0 = Math.floor(fz), tx = fx - cx0, tz = fz - cz0;
    const a = townF(cx0, cz0), b = townF(cx0 + 1, cz0), c = townF(cx0, cz0 + 1), d = townF(cx0 + 1, cz0 + 1);
    const t = (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
    return U.smooth(Math.min(1, t * 2));
  }
  const HILL = 3.0, HILL2 = 1.1, CERRO = 6.5;
  function rawHeight(x, z) {
    // mapas con relieve propio (desniveles del suelo)
    if (FIELD && isMap(layout)) { const mh = G.Maps.get(layout).height; if (mh) return mh(x, z); }
    if (SMALL) return 0;                     // mundo de pruebas: plano
    const big = vnoise(x / 75, z / 75, 101) - 0.5;
    const mid = vnoise(x / 34, z / 34, 102) - 0.5;
    const small = (vnoise(x / 4.5, z / 4.5, 104) - 0.5) * 0.24;
    const t = townness(x, z);
    const town = big * 1.8 + small * 0.4;
    if (t >= 0.999) return town;
    const cr = Math.max(0, vnoise(x / 60, z / 60, 103) - 0.6) / 0.4;
    const country = big * 2 * HILL + mid * 2 * HILL2 + cr * cr * (3 - 2 * cr) * CERRO + small;
    return country + (town - country) * t;
  }

  function hEdge(cx, cz) { return !FIELD && (isTown(cx, cz) || isTown(cx + 1, cz) || hash(cx, cz, 11) < 0.3); }
  function vEdge(cx, cz) { return !FIELD && (isTown(cx, cz) || isTown(cx, cz + 1) || hash(cx, cz, 12) < 0.3); }

  // Punto libre de muebles cerca de (x, z) (busca en espiral); null si no hay
  function freeSpot(c, x, z, lv) {
    const hit = (px, pz) => c.furn.some((f) => (f.lv || 0) === lv && px > f.x0 - 0.35 && px < f.x1 + 0.35 && pz > f.z0 - 0.35 && pz < f.z1 + 0.35);
    if (!hit(x, z)) return { x, z };
    for (let r = 0.5; r <= 2.5; r += 0.5) {
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos(a * Math.PI / 4) * r, pz = z + Math.sin(a * Math.PI / 4) * r;
        const lx = Math.floor(px) - c.cx * CS, lz = Math.floor(pz) - c.cz * CS;
        if (lx < 0 || lz < 0 || lx >= CS || lz >= CS) continue;
        const L = lv ? c.up : c;
        if (!L || L.bld[lz * CS + lx] !== (lay(c, lv) || c).bld[(Math.floor(z) - c.cz * CS) * CS + (Math.floor(x) - c.cx * CS)]) continue;
        if (!hit(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  // Parque de bomberos: portones grandes en la cochera y dos camiones viejos dentro
  function fireStation(c, b, tl, rng) {
    const ox = c.cx * CS, oz = c.cz * CS;
    const f = b.bp.front;
    const n = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[f];
    const xs = tl.map((q) => q[0]), zs = tl.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
    // portones: cada puerta de la fachada de la cochera pasa a ser una abertura de 3 casillas
    const idxL = (x, z) => z * CS + x;
    if (n[1]) {
      const zl = n[1] > 0 ? z1 : z0;
      for (let x = x0; x < x1; x++) {
        if (c.eN[idxL(x, zl)] === E.DOOR) for (const k of [-1, 0, 1]) if (x + k >= x0 && x + k < x1) c.eN[idxL(x + k, zl)] = E.GATE;
      }
    } else {
      const xl = n[0] > 0 ? x1 : x0;
      for (let z = z0; z < z1; z++) {
        if (c.eW[idxL(xl, z)] === E.DOOR) for (const k of [-1, 0, 1]) if (z + k >= z0 && z + k < z1) c.eW[idxL(xl, z + k)] = E.GATE;
      }
    }
    // dos camiones mirando a los portones
    const across = n[1] ? x1 - x0 : z1 - z0;
    for (const t of (b.trucks === 1 ? [0.27] : [0.27, 0.73])) {          // (b.trucks: en algún mapa se llevaron uno)
      const a = (n[1] ? x0 : z0) + across * t;
      const mid = (n[1] ? (z0 + z1) / 2 : (x0 + x1) / 2) + (n[1] ? n[1] : n[0]) * 0.6;
      const xc = n[1] ? a : mid, zc = n[1] ? mid : a;
      G.Furniture.addVehicle(c, 'camion', ox + xc, oz + zc, n[0], n[1], rng, 0, b.baseY);
    }
  }

  // Coche patrulla o ambulancia aparcado en la calle, delante del edificio
  function parkOutside(c, b, type, rng) {
    const n = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[b.bp.front];
    const lx = b.ox + b.w / 2, lz = b.oz + b.h / 2;
    for (let k = 1; k < 12; k++) {
      const tx = Math.floor(lx + n[0] * (b.w / 2 * Math.abs(n[0]) + b.h / 2 * Math.abs(n[1]) + k - 0.5));
      const tz = Math.floor(lz + n[1] * (b.h / 2 * Math.abs(n[1]) + b.w / 2 * Math.abs(n[0]) + k - 0.5));
      if (tx < 1 || tz < 1 || tx >= CS - 1 || tz >= CS - 1) return;
      if (c.ground[tz * CS + tx] !== F.ROAD) continue;
      // en paralelo a la calle, algo apartado de la puerta
      const side = rng() < 0.5 ? -1 : 1;
      const px = tx + 0.5 + (n[1] ? side * 3 : 0), pz = tz + 0.5 + (n[0] ? side * 3 : 0);
      const fx = n[1] ? side : 0, fz = n[0] ? side : 0;
      G.Furniture.addVehicle(c, type, c.cx * CS + px, c.cz * CS + pz, fx, fz, rng, 0, c.thLocal(px, pz));
      return;
    }
  }

  // Campo de pruebas: muros sueltos de hormigón (coberturas y remates contra la pared), un coche
  // patrulla, mesas, un mostrador y cajas (los objetos sueltos aparecen encima). Todo en el chunk (0, 0)
  function fieldProps(c, rng) {
    const CSx = CS;
    const wallN = (x0, x1, z) => { for (let x = x0; x < x1; x++) c.eN[z * CSx + x] = E.WALL; };   // muro a lo largo de x
    const wallW = (z0, z1, x) => { for (let z = z0; z < z1; z++) c.eW[z * CSx + x] = E.WALL; };   // muro a lo largo de z
    wallN(7, 12, 9); wallW(9, 13, 7);          // esquina en L (arriba a la izquierda)
    wallW(17, 22, 25);                          // muro largo a la derecha
    wallN(13, 17, 26);                          // muro corto abajo
    wallN(20, 23, 6); wallW(6, 8, 23);          // rincón pequeño (arriba a la derecha)
    const T = G.Furniture.T;
    const put = (type, cx0, cz0, fx, fz) => {
      const t = T[type], along = Math.abs(fz) > 0.5;
      const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
      c.furn.push({ type, lv: 0, x0: cx0 - hw, x1: cx0 + hw, z0: cz0 - hd, z1: cz0 + hd, y: 0, h: t.h, fx, fz, solid: true, cont: null, seed: Math.floor(rng() * 1e9) });
    };
    put('mesa', 11.5, 20.5, 0, 1);
    put('mostrador', 20.5, 29.2, 0, -1);
    put('escritorio', 4.2, 15.5, 1, 0);
    put('cajas', 27.5, 12.5, 0, 1);
    put('cajas', 5.5, 24.5, 0, 1);
    put('banco', 30.5, 24.5, -1, 0);
    G.Furniture.addVehicle(c, 'patrulla', 17.5, 8.5, 1, 0, rng, 0, 0);
    const car = c.furn[c.furn.length - 1]; car.cont = null;
  }

  // Refugio: la mesa del mapa (con el corcho), el cofre de recompensas, el puesto de comercio, el banco de
  // mejoras (en la armería) y la mesa de fabricación (en la despensa), más algo de ambiente. Todas las luces
  // encendidas
  const REFUGE_STATIONS = [];
  function refugeProps(c, rng) {
    const T = G.Furniture.T, X = REFUGE_AT.ox, Z = REFUGE_AT.oz;
    const put = (type, cx0, cz0, fx, fz) => {
      const t = T[type], along = Math.abs(fz) > 0.5;
      const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
      const f = { type, lv: 0, x0: cx0 - hw, x1: cx0 + hw, z0: cz0 - hd, z1: cz0 + hd, y: 0, h: t.h, fx, fz, solid: true, cont: null, seed: Math.floor(rng() * 1e9) };
      c.furn.push(f);
      return f;
    };
    REFUGE_STATIONS.length = 0;
    const st = (id, f, label) => { const fp = G.Furniture.frontPoint(f); REFUGE_STATIONS.push({ id, f, label, x: fp.x, z: fp.z, cx: (f.x0 + f.x1) / 2, cz: (f.z0 + f.z1) / 2, top: f.y + f.h }); };
    // una sola sala (11 x 9): el mapa contra la pared del fondo, el comercio y el cofre a la izquierda, el banco
    // de mejoras y la mesa de fabricar a la derecha, el sofá y los armarios contra la pared de la entrada
    st('mapa', put('mesa_mapa', X + 5.5, Z + 0.47, 0, 1), 'Ver el mapa');
    st('tienda', put('puesto', X + 0.32, Z + 3.0, 1, 0), 'Comerciar');
    st('cofre', put('cofre', X + 0.36, Z + 6.0, 1, 0), 'Abrir las recompensas');
    st('banco', put('banco_mej', X + 10.58, Z + 3.0, -1, 0), 'Mejorar armas');
    st('fabricar', put('banco', X + 10.63, Z + 6.0, -1, 0), 'Fabricar (mochila)');
    put('cajas', X + 0.5, Z + 0.5, 0, 1);
    put('cajas', X + 10.5, Z + 0.5, 0, 1);
    put('sofa', X + 5.5, Z + 8.55, 0, -1);
    put('armero', X + 2.4, Z + 8.73, 0, -1);
    put('estante', X + 8.6, Z + 8.7, 0, -1);
    put('taquilla', X + 10.73, Z + 8.0, -1, 0);
    put('estanteria', X + 0.2, Z + 8.0, 1, 0);
    // más luz: dos lámparas más en el techo (solo luz, sin suelo propio)
    const b = c.buildings.find((q) => q.kind === 'refugio');
    if (b && b.rooms.length === 1) {
      const r0 = b.rooms[0];
      for (const dx of [-2.9, 2.9]) {
        b.rooms.push(Object.assign({}, r0, { light: { x: r0.light.x + dx, y: r0.light.y, z: r0.light.z }, on: true, tiles: 0, extra: true }));
      }
    }
  }

  // Modo libre: un puesto de comercio y un banco de mejoras en el campo (todo gratis)
  function libreProps(c, rng) {
    const T = G.Furniture.T;
    const put = (type, cx0, cz0, fx, fz) => {
      const t = T[type], along = Math.abs(fz) > 0.5;
      const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
      const f = { type, lv: 0, x0: cx0 - hw, x1: cx0 + hw, z0: cz0 - hd, z1: cz0 + hd, y: 0, h: t.h, fx, fz, solid: true, cont: null, seed: Math.floor(rng() * 1e9) };
      c.furn.push(f);
      return f;
    };
    REFUGE_STATIONS.length = 0;
    const st = (id, f, label) => { const fp = G.Furniture.frontPoint(f); REFUGE_STATIONS.push({ id, f, label, x: fp.x, z: fp.z, cx: (f.x0 + f.x1) / 2, cz: (f.z0 + f.z1) / 2, top: f.y + f.h }); };
    st('tienda', put('puesto', 8.5, 25.0, 0, -1), 'Comerciar (gratis)');
    st('banco', put('banco_mej', 24.5, 25.0, 0, -1), 'Mejorar armas (gratis)');
    st('mapas', put('tablero', 16.5, 25.2, 0, -1), 'Elegir mapa');
  }
  // modo libre en uno de los mapas: el panel de los mapas (para cambiar de mapa) en la pared que diga el mapa
  let freeMode = false;
  function mapBoard(c, rng) {
    const m = G.Maps.get(layout), b = m && m.board;
    if (!freeMode || !b) return;
    const t = G.Furniture.T.tablero, along = Math.abs(b.fz) > 0.5;
    const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
    const f = { type: 'tablero', lv: 0, x0: b.x - hw, x1: b.x + hw, z0: b.z - hd, z1: b.z + hd, y: 0, h: t.h, fx: b.fx, fz: b.fz, solid: true, cont: null, seed: Math.floor(rng() * 1e9) };
    c.furn.push(f);
    REFUGE_STATIONS.length = 0;
    const fp = G.Furniture.frontPoint(f);
    REFUGE_STATIONS.push({ id: 'mapas', f, label: 'Elegir mapa', x: fp.x, z: fp.z, cx: b.x, cz: b.z, top: t.h });
  }

  // ---------- Generación ----------
  function generateChunk(cx, cz) {
    const N = CS * CS;
    const c = {
      cx, cz,
      ground: new Uint8Array(N), obj: new Uint8Array(N),
      eN: new Uint8Array(N), eW: new Uint8Array(N),
      bld: new Uint8Array(N), rm: new Uint8Array(N),
      buildings: [], items: [], spawns: [], furn: [], fidx: null, fblock: null,
      sleepers: [], corpses: [], populated: false,
      group: null, queued: false, view: null,
      edgeHP: new Map(), town: isTown(cx, cz), inside: inArena(cx, cz),
      up: null,                  // planta de arriba (solo si hay casas de dos pisos)
      deck: null,                // techos por los que se camina (contenedores): altura en decímetros
      stairMap: null, stairs: [],
      th: new Float32Array((CS + 1) * (CS + 1))   // altura del terreno en las esquinas de las casillas
    };
    for (let z = 0; z <= CS; z++) for (let x = 0; x <= CS; x++) c.th[z * (CS + 1) + x] = rawHeight(cx * CS + x, cz * CS + z);
    // altura del terreno dentro de este chunk mientras se genera (coordenadas locales)
    const thLocal = (lx, lz) => {
      const ix = Math.max(0, Math.min(CS - 1, Math.floor(lx))), iz = Math.max(0, Math.min(CS - 1, Math.floor(lz)));
      const tx = lx - ix, tz = lz - iz, R = CS + 1;
      const a = c.th[iz * R + ix], b = c.th[iz * R + ix + 1], d = c.th[(iz + 1) * R + ix], e = c.th[(iz + 1) * R + ix + 1];
      return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
    };
    c.thLocal = thLocal;
    const rng = U.mulberry32(chunkSeed(cx, cz));
    const roads = {
      e: hEdge(cx, cz), w: hEdge(cx - 1, cz),
      s: vEdge(cx, cz), n: vEdge(cx, cz - 1)
    };
    roads.any = roads.e || roads.w || roads.s || roads.n;
    c.roads = roads;
    const idx = (x, z) => z * CS + x;
    const inb = (x, z) => x >= 0 && z >= 0 && x < CS && z < CS;

    // Carreteras
    if (roads.any) {
      for (let r = 15; r <= 16; r++) {
        c.ground[idx(15, r)] = F.ROAD; c.ground[idx(16, r)] = F.ROAD;
        for (let i = 0; i < CS; i++) {
          if (roads.w && i <= 14) c.ground[idx(i, r)] = F.ROAD;
          if (roads.e && i >= 17) c.ground[idx(i, r)] = F.ROAD;
          if (roads.n && i <= 14) c.ground[idx(r, i)] = F.ROAD;
          if (roads.s && i >= 17) c.ground[idx(r, i)] = F.ROAD;
        }
      }
    }
    // Aceras en pueblos
    if (c.town) {
      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          if (c.ground[idx(x, z)] !== F.GRASS) continue;
          let near = false;
          for (let dz = -1; dz <= 1 && !near; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (inb(x + dx, z + dz) && c.ground[idx(x + dx, z + dz)] === F.ROAD) { near = true; break; }
            }
          }
          if (near) c.ground[idx(x, z)] = F.SIDEWALK;
        }
      }
    }

    // ----- Edificios -----
    const lots = [];
    // Lotes de 13x13 en cada cuadrante, con la calle en dos lados
    for (const qx of [0, 1]) {
      for (const qz of [0, 1]) {
        const fronts = [];
        if (qz === 0 && (qx === 0 ? roads.w : roads.e)) fronts.push('S');
        if (qz === 1 && (qx === 0 ? roads.w : roads.e)) fronts.push('N');
        if (qx === 0 && (qz === 0 ? roads.n : roads.s)) fronts.push('E');
        if (qx === 1 && (qz === 0 ? roads.n : roads.s)) fronts.push('W');
        lots.push({ x0: qx ? 18 : 1, z0: qz ? 18 : 1, qx, qz, fronts });
      }
    }

    const placeBuilding = (lot, id, front, opts) => {
      const bp = B.make(id, rng, front);
      const yard = 1 + Math.floor(rng() * 2);
      const free = (span, size) => Math.max(0, span - size);
      let ox, oz;
      const W = bp.w, H = bp.h;
      // El frente queda a "yard" casillas del borde del lote que da a la calle
      if (front === 'S') { oz = lot.z0 + 13 - yard - H; ox = lot.x0 + Math.floor(rng() * (free(13, W) + 1)); }
      else if (front === 'N') { oz = lot.z0 + yard; ox = lot.x0 + Math.floor(rng() * (free(13, W) + 1)); }
      else if (front === 'E') { ox = lot.x0 + 13 - yard - W; oz = lot.z0 + Math.floor(rng() * (free(13, H) + 1)); }
      else { ox = lot.x0 + yard; oz = lot.z0 + Math.floor(rng() * (free(13, H) + 1)); }
      ox = U.clamp(ox, lot.x0, lot.x0 + 13 - W);
      oz = U.clamp(oz, lot.z0, lot.z0 + 13 - H);
      if (opts && opts.at) { ox = opts.at.ox; oz = opts.at.oz; }
      else if (opts && opts.center) {
        // fuera del pueblo: posición libre en el lote
        ox = lot.x0 + Math.floor(rng() * (free(13, W) + 1));
        oz = lot.z0 + Math.floor(rng() * (free(13, H) + 1));
      }
      const bi = c.buildings.length;
      // base nivelada: la media del terreno bajo el edificio (lo que sobra o falta lo tapa el zócalo)
      let hs = 0, hn = 0;
      for (let z = 0; z <= H; z++) for (let x = 0; x <= W; x++) { hs += c.th[(oz + z) * (CS + 1) + ox + x]; hn++; }
      const baseY = hs / hn + 0.05;
      const b = {
        id, kind: bp.def.kind, bp, ox, oz, baseY,
        x0: cx * CS + ox, z0: cz * CS + oz, w: W, h: H,
        roof: bp.def.roof, siding: bp.siding, roofColor: bp.roofColor,
        wallH: bp.def.wallH || WALL_H,          // alto de las paredes (las naves de los mapas, más altas)
        rooms: []
      };
      c.buildings.push(b);
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          const r = bp.tiles[z * W + x];
          if (r < 0) continue;
          const i = idx(ox + x, oz + z);
          c.ground[i] = bp.rooms[r].floor;
          c.bld[i] = bi + 1;
          c.rm[i] = r + 1;
        }
      }
      for (let z = 0; z <= H; z++) {
        for (let x = 0; x < W; x++) {
          const v = bp.hE[z * W + x];
          if (v && inb(ox + x, oz + z)) c.eN[idx(ox + x, oz + z)] = v;
        }
      }
      for (let z = 0; z < H; z++) {
        for (let x = 0; x <= W; x++) {
          const v = bp.vE[z * (W + 1) + x];
          if (v && inb(ox + x, oz + z)) c.eW[idx(ox + x, oz + z)] = v;
        }
      }
      const addRooms = (list, lv) => {
        for (const r of list) {
          b.rooms.push({
            type: r.type, name: r.name, wall: r.wall, b, lv,
            light: { x: cx * CS + ox + r.cx, y: baseY + lv * FLOOR_H + (bp.def.wallH || WALL_H) - 0.12, z: cz * CS + oz + r.cz },
            on: layout === 'refugio' || rng() < 0.4,
            sw: null      // sin interruptores: cada luz aparece encendida o apagada al azar
          });
        }
      };
      addRooms(bp.rooms, 0);
      b.floors = 1;
      if (bp.up) {
        // planta de arriba: mismas casillas, sus propias paredes y habitaciones
        b.floors = 2;
        if (!c.up) c.up = { eN: new Uint8Array(N), eW: new Uint8Array(N), bld: new Uint8Array(N), rm: new Uint8Array(N), ground: new Uint8Array(N) };
        if (!c.stairMap) c.stairMap = new Uint8Array(N);
        const U1 = c.up, base = bp.rooms.length;
        for (let z = 0; z < H; z++) {
          for (let x = 0; x < W; x++) {
            const r = bp.up.tiles[z * W + x];
            if (r < 0) continue;
            const i = idx(ox + x, oz + z);
            U1.ground[i] = bp.up.rooms[r].floor;
            U1.bld[i] = bi + 1;
            U1.rm[i] = base + r + 1;
          }
        }
        for (let z = 0; z <= H; z++) {
          for (let x = 0; x < W; x++) {
            const v = bp.up.hE[z * W + x];
            if (v && inb(ox + x, oz + z)) U1.eN[idx(ox + x, oz + z)] = v;
          }
        }
        for (let z = 0; z < H; z++) {
          for (let x = 0; x <= W; x++) {
            const v = bp.up.vE[z * (W + 1) + x];
            if (v && inb(ox + x, oz + z)) U1.eW[idx(ox + x, oz + z)] = v;
          }
        }
        addRooms(bp.up.rooms, 1);
        const st = bp.stair;
        const S = { x: cx * CS + ox + st.x, z: cz * CS + oz + st.z, dx: st.dx, dz: st.dz, len: st.len, b };
        c.stairs.push(S);
        b.stair = S;
        for (let k = 0; k < st.len; k++) c.stairMap[idx(ox + st.x + st.dx * k, oz + st.z + st.dz * k)] = c.stairs.length;
      }
      lot.used = { ox, oz, W, H, b };
      return b;
    };

    if (c.town && c.inside) {
      // edificios especiales: la comisaría es la más frecuente (mitad de las veces)
      const specialQ = rng() < 0.15 ? Math.floor(rng() * 4) : -1;
      const sr = rng();
      const specialId = sr < 0.5 ? 'policia' : (sr < 0.75 ? 'bomberos' : 'hospital');
      lots.forEach((lot, qi) => {
        if (!lot.fronts.length) return;
        const spawnLot = cx === 0 && cz === 0 && qi === 0;
        if (!spawnLot && rng() > 0.88) return;
        const front = spawnLot ? 'S' : U.pick(rng, lot.fronts);
        let id;
        if (spawnLot) id = 'casa1';
        else if (qi === specialQ) id = specialId;
        else {
          // casas de una planta, de dos pisos y tiendas de comida
          const r = rng();
          id = r < 0.13 ? U.pick(rng, B.SHOPS) : (r < 0.4 ? U.pick(rng, B.TWO) : U.pick(rng, B.COMMON));
        }
        placeBuilding(lot, id, front);
      });
    } else if (FIELD) {
      /* campo de pruebas: sin edificios (en el modo refugio, solo el refugio) */
      if (layout === 'refugio' && cx === 0 && cz === 0) placeBuilding(lots[0], 'refugio', 'S', { at: REFUGE_AT });
    } else if (c.inside && roads.any && rng() < 0.25) {
      const cand = lots.filter((l) => l.fronts.length);
      const lot = U.pick(rng, cand);
      placeBuilding(lot, rng() < 0.6 ? 'cabana' : 'casa4', U.pick(rng, lot.fronts));
    } else if (c.inside && !roads.any && rng() < 0.12) {
      const lot = U.pick(rng, lots);
      placeBuilding(lot, 'cabana', U.pick(rng, ['N', 'S', 'E', 'W']), { center: true });
    }

    // ----- Terreno nivelado alrededor de los edificios: 1 casilla a la altura de la base y otra de transición
    for (const b of c.buildings) {
      const R = CS + 1;
      for (let z = b.oz - 2; z <= b.oz + b.h + 2; z++) {
        for (let x = b.ox - 2; x <= b.ox + b.w + 2; x++) {
          if (x <= 0 || z <= 0 || x >= CS || z >= CS) continue;
          const d = Math.max(b.ox - x, x - (b.ox + b.w), b.oz - z, z - (b.oz + b.h), 0);
          const i = z * R + x;
          if (d <= 1) c.th[i] = b.baseY - 0.05;
          else c.th[i] = (c.th[i] + b.baseY - 0.05) / 2;
        }
      }
    }

    // ----- Valla del borde del mundo de pruebas (no se puede saltar) -----
    const noFence = isMap(layout) && (G.Maps.get(layout).fence === 'none' || G.Maps.get(layout).perimeter === false);   // (perimeter false: el borde lo pone el mapa)      // (la playa: el borde son el mar, rocas y árboles)
    if (SMALL && !noFence) {
      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          const wx = cx * CS + x, wz = cz * CS + z;
          if ((wx === AMIN || wx === AMAX) && wz >= AMIN && wz < AMAX) c.eW[idx(x, z)] = E.FENCE;
          if ((wz === AMIN || wz === AMAX) && wx >= AMIN && wx < AMAX) c.eN[idx(x, z)] = E.FENCE;
        }
      }
    }

    // ----- Vallas alrededor de los patios (no en el frente) -----
    if (c.town) {
      for (const lot of lots) {
        if (!lot.used || lot.used.b.kind !== 'casa' || rng() > 0.55) continue;
        const front = lot.used.b.bp.front;
        const x0 = lot.x0, z0 = lot.z0, x1 = lot.x0 + 13, z1 = lot.z0 + 13;
        const gate = Math.floor(rng() * 13);
        const fence = (o, x, z) => {
          const i = idx(x, z);
          const arr = o === 'N' ? c.eN : c.eW;
          if (arr[i] === E.NONE && c.bld[i] === 0) arr[i] = E.FENCE;
        };
        for (let k = 0; k < 13; k++) {
          if (front !== 'N' && k !== gate) fence('N', x0 + k, z0);
          if (front !== 'S' && k !== gate) fence('N', x0 + k, z1);
          if (front !== 'W' && k !== gate) fence('W', x0, z0 + k);
          if (front !== 'E' && k !== gate) fence('W', x1, z0 + k);
        }
      }
    }

    // ----- Farolas -----
    if (roads.any) {
      const lamp = (x, z) => {
        if (!inb(x, z)) return;
        const i = idx(x, z);
        const g = c.ground[i];
        if (c.bld[i] || g === F.ROAD) return;
        c.obj[i] = O.LAMP;
      };
      if (c.town) {
        for (const k of [4, 11, 20, 27]) {
          if ((k < 15 ? roads.w : roads.e)) lamp(k, (k % 2) ? 14 : 17);
          if ((k < 15 ? roads.n : roads.s)) lamp((k % 2) ? 17 : 14, k);
        }
      } else if (rng() < 0.35) {
        if (roads.w || roads.e) lamp(roads.w ? 6 : 25, 14);
        else lamp(14, roads.n ? 6 : 25);
      }
    }

    // ----- Árboles y arbustos -----
    const nearBuildingOrRoad = (x, z, rb, rr) => {
      const r = Math.max(rb, rr);
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, zz = z + dz;
          if (!inb(xx, zz)) continue;
          const i = idx(xx, zz);
          const d = Math.max(Math.abs(dx), Math.abs(dz));
          if (c.bld[i] && d <= rb) return true;
          const g = c.ground[i];
          if ((g === F.ROAD || g === F.SIDEWALK) && d <= rr) return true;
          if (c.obj[i] === O.LAMP && d <= 1) return true;
          if (d <= 1 && (c.eN[i] || c.eW[i])) return true;
        }
      }
      return false;
    };
    for (let z = 0; z < CS && !FIELD; z++) {
      for (let x = 0; x < CS; x++) {
        const i = idx(x, z);
        if (c.ground[i] !== F.GRASS || c.obj[i]) continue;
        let p;
        const n = vnoise((cx * CS + x) / 18, (cz * CS + z) / 18, 5);
        if (c.town) p = 0.012;
        else if (!c.inside) p = 0.07;        // fuera del mundo de pruebas: bosque
        else p = n < 0.42 ? 0.01 : Math.min(0.17, 0.02 + (n - 0.42) * 0.55);
        const r = rng();
        if (r < p) {
          if (nearBuildingOrRoad(x, z, 3, 1)) continue;
          // no dos árboles pegados
          let crowd = false;
          for (let dz = -1; dz <= 0 && !crowd; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (inb(x + dx, z + dz) && (c.obj[idx(x + dx, z + dz)] === O.TREE || c.obj[idx(x + dx, z + dz)] === O.PINE)) { crowd = true; break; }
            }
          }
          if (crowd) continue;
          const pineBias = vnoise((cx * CS + x) / 40, (cz * CS + z) / 40, 9);
          c.obj[i] = rng() < pineBias ? O.PINE : O.TREE;
        } else if (r < p + (c.town ? 0.02 : 0.03)) {
          if (!nearBuildingOrRoad(x, z, 0, 0)) c.obj[i] = O.BUSH;
        }
      }
    }

    // ----- Hierba alta: manchas en el césped (más fuera del pueblo). Sirve para esconderse:
    // tumbado dentro casi no te ven. Solo usa ruido determinista (no cambia el resto del mundo)
    c.tall = new Uint8Array(CS * CS);
    // (quitada: la hierba alta molestaba a la vista. Queda solo la hierba corta del suelo)
    if (NO_TALL) { /* nada */ } else for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const i = idx(x, z);
        if (c.ground[i] !== F.GRASS || c.obj[i] === O.LAMP) continue;
        const wx = cx * CS + x, wz = cz * CS + z;
        // campo de pruebas: solo dos manchas fijas de hierba alta, dentro de la valla
        if (FIELD) { if ((layout === 'campo' || layout === 'libre') && (Math.hypot(wx - 6.5, wz - 29) < 3.6 || Math.hypot(wx - 29, wz + 0.5) < 3.2)) c.tall[i] = 1; continue; }
        const n = vnoise(wx / 11, wz / 11, 61) * 0.75 + vnoise(wx / 3.5, wz / 3.5, 62) * 0.25;
        if (n > (c.town ? 0.64 : 0.5) && !nearBuildingOrRoad(x, z, 0, 0)) c.tall[i] = 1;
      }
    }

    // ----- Mapas hechos a mano (G.Maps): suelo, muros, edificios, contenedores, árboles, hierba y muebles -----
    const mapApi = {
      placeBuilding: (id, ox, oz, front) => placeBuilding({ x0: 0, z0: 0, fronts: [front] }, id, front, { at: { ox, oz } })
    };
    if (FIELD && isMap(layout)) G.Maps.apply(layout, c, cx, cz, rng, mapApi, 'base');

    // ----- Muebles (y lo que hay dentro), portones y vehículos -----
    for (const b of c.buildings) {
      b.rooms.forEach((room, ri) => {
        if (room.type === 'escalera') return;
        const plan = room.lv ? b.bp.up : b.bp, rIdx = room.lv ? ri - b.bp.rooms.length : ri;
        const tl = [];
        for (let z = 0; z < b.h; z++) for (let x = 0; x < b.w; x++) if (plan.tiles[z * b.w + x] === rIdx) tl.push([b.ox + x, b.oz + z]);
        room.tiles = tl.length;
        G.Furniture.furnishRoom(c, b, room, room.lv || 0, tl, rng, CS, E);
        if (b.kind === 'bomberos' && room.type === 'cochera') fireStation(c, b, tl, rng);
      });
      if (b.kind === 'policia' || b.kind === 'hospital') parkOutside(c, b, b.kind === 'policia' ? 'patrulla' : 'ambulancia', rng);
    }
    if (FIELD && cx === 0 && cz === 0 && (layout === 'campo' || layout === 'libre')) fieldProps(c, rng);
    if (FIELD && cx === 0 && cz === 0 && layout === 'libre') libreProps(c, rng);
    if (FIELD && cx === 0 && cz === 0 && layout === 'refugio') refugeProps(c, rng);
    if (FIELD && isMap(layout)) G.Maps.apply(layout, c, cx, cz, rng, mapApi, 'props');
    if (FIELD && isMap(layout) && cx === 0 && cz === 0) mapBoard(c, rng);
    G.Furniture.indexChunk(c, CS);

    // ----- Botín suelto: en el suelo solo quedan armas de fuego largas; el resto va a algún mueble de la habitación -----
    for (let bi = 0; LOOT && bi < c.buildings.length; bi++) {
      const b = c.buildings[bi];
      b.rooms.forEach((room, ri) => {
        if (room.type === 'escalera' || rng() < 0.5) return;
        const loot = G.Weapons.lootFor(room.type, b.kind, rng);
        if (!loot.length) return;
        const tiles = [];
        const plan = room.lv ? b.bp.up : b.bp, rIdx = room.lv ? ri - b.bp.rooms.length : ri;
        for (let z = 0; z < b.h; z++) {
          for (let x = 0; x < b.w; x++) {
            if (plan.tiles[z * b.w + x] === rIdx) tiles.push([b.ox + x, b.oz + z]);
          }
        }
        if (!tiles.length) return;
        let conts = null;
        const common = b.kind === 'casa' && b.floors !== 2;
        for (const id of loot) {
          if (common && G.Weapons.commonHouseCut(id) && rng() >= G.Weapons.COMMON_KEEP) continue;
          if (G.Weapons.hasModel(id)) {
            if (!owns(id)) continue;    // no sale un arma que no te cabe o que ya llevas
            const t = U.pick(rng, tiles);
            c.items.push({
              x: cx * CS + t[0] + 0.25 + rng() * 0.5,
              z: cz * CS + t[1] + 0.25 + rng() * 0.5,
              rot: rng() * Math.PI * 2, id, cond: itemCond(id, rng), lv: room.lv
            });
          } else {
            if (!conts) conts = roomContainers(c, tiles, room.lv || 0);
            if (conts.length) U.pick(rng, conts).cont.items.push(id);
          }
        }
      });
    }

    // ----- Punto de inicio: dentro de la casa del chunk (0, 0) -----
    if (layout === 'refugio' && cx === 0 && cz === 0) {
      spawnPoint = { x: REFUGE_AT.ox + 5.5, z: REFUGE_AT.oz + 5.0 };
    } else if (cx === 0 && cz === 0 && c.buildings.length && !isMap(layout)) {
      const b = c.buildings[0];
      const ri = b.rooms.findIndex((r) => r.type === 'sala');
      const r = b.rooms[ri >= 0 ? ri : 0];
      spawnPoint = freeSpot(c, r.light.x, r.light.z, 0) || { x: r.light.x, z: r.light.z };
      r.on = true;
      // un arma garantizada para empezar: una palanca dentro de un mueble de la sala (o en un montón)
      const rt = [];
      const plan0 = b.bp, rIdx0 = ri >= 0 ? ri : 0;
      for (let z = 0; z < b.h; z++) for (let x = 0; x < b.w; x++) if (plan0.tiles[z * b.w + x] === rIdx0) rt.push([b.ox + x, b.oz + z]);
      const sc = roomContainers(c, rt, 0).filter((f) => !G.Furniture.T[f.type].tall);
      if (!LOOT) { /* sin botín: el arma inicial también queda guardada */ }
      else if (sc.length) { sc[0].cont.items.unshift({ id: 'palanca', cond: 0.8 }); spawnCrate = sc[0]; }
      else c.items.push({ x: r.light.x + 0.9, z: r.light.z - 0.6, rot: 0.6, id: 'monton', pile: [{ id: 'palanca', cond: 0.8 }], lv: 0 });
      if (location.search.indexOf('armas') !== -1) {
        // modo de prueba: las armas de fuego largas alrededor del inicio y todo lo demás en un montón
        const pile = [];
        const all = G.Weapons.LIST.map((w) => w.id).concat(['mun_9mm', 'mun_9mm', 'mun_cartucho', 'mun_cartucho', 'mun_rifle', 'mun_flecha', 'mun_flecha', 'silenciador']);
        let k = 0;
        all.forEach((id) => {
          const w = G.Weapons.get(id);
          const cond = G.Weapons.isItem(id) ? 12 : (G.Weapons.isGun(w) ? w.mag : 1);
          if (!G.Weapons.hasModel(id)) { pile.push({ id, cond }); return; }
          const a = (k++ / 3) * Math.PI * 2;
          c.items.push({ x: spawnPoint.x + Math.cos(a) * 1.4, z: spawnPoint.z + Math.sin(a) * 1.4, rot: a, id, cond, lv: 0 });
        });
        c.items.push({ x: spawnPoint.x + 0.8, z: spawnPoint.z + 0.3, rot: 0, id: 'monton', pile, lv: 0 });
      }
    }

    // ----- Zombis -----
    // La mayoría de chunks tienen pocos zombis; unos pocos (HORDE_CHANCE) tienen muchos.
    // Los que aparecen dentro de casas se quedan en su habitación hasta oír un ruido.
    const HORDE_CHANCE = 0.13;
    c.horde = rng() < HORDE_CHANCE;
    if (!AUTO_ZOMBIES || !c.inside) return c;
    const addSpawn = (x, z, indoor, lv) => {
      const i = idx(Math.floor(x - cx * CS), Math.floor(z - cz * CS));
      if (!lv && (c.obj[i] === O.TREE || c.obj[i] === O.PINE || c.obj[i] === O.LAMP)) return;
      if (c.stairMap && c.stairMap[i]) return;
      const p = freeSpot(c, x, z, lv || 0);
      if (!p) return;
      c.spawns.push({ x: p.x, z: p.z, indoor: !!indoor, lv: lv || 0 });
    };
    let outdoor;
    if (c.horde) outdoor = c.town ? 3 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
    else outdoor = c.town ? (rng() < 0.57 ? 1 : 0) : (rng() < 0.14 ? 1 : 0);
    for (let k = 0; k < outdoor; k++) {
      for (let t = 0; t < 20; t++) {
        const x = 1 + Math.floor(rng() * (CS - 2)), z = 1 + Math.floor(rng() * (CS - 2));
        const i = idx(x, z);
        if (c.bld[i] || c.obj[i]) continue;
        addSpawn(cx * CS + x + 0.5, cz * CS + z + 0.5, false);
        break;
      }
    }
    for (const b of c.buildings) {
      let n;
      if (b.kind === 'casa') n = c.horde ? (rng() < 0.62 ? 1 + Math.floor(rng() * 2) : 0) : (rng() < 0.33 ? 1 : 0);
      else if (b.kind === 'cabana') n = rng() < (c.horde ? 0.5 : 0.15) ? 1 : 0;
      else n = c.horde ? 3 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
      if (b.floors === 2 && n > 0) n++;
      if (b.kind === 'tienda') n = c.horde ? 2 + Math.floor(rng() * 3) : (rng() < 0.6 ? 1 : 0);
      const roomsOk = b.rooms.filter((r) => r.type !== 'escalera');
      for (let k = 0; k < n; k++) {
        const r = U.pick(rng, roomsOk);
        addSpawn(r.light.x + (rng() - 0.5) * 0.6, r.light.z + (rng() - 0.5) * 0.6, true, r.lv);
      }
    }

    return c;
  }

  // ---------- Acceso ----------
  function chunkAt(cx, cz) {
    if (cx === lastCX && cz === lastCZ) return lastChunk;
    const key = ((cx & 0xffff) << 16) | (cz & 0xffff);
    let c = chunks.get(key);
    if (!c) { c = generateChunk(cx, cz); chunks.set(key, c); }
    lastCX = cx; lastCZ = cz; lastChunk = c;
    return c;
  }
  const li = (x, z) => ((z & MASK) << SHIFT) | (x & MASK);
  const ch = (x, z) => chunkAt(x >> SHIFT, z >> SHIFT);

  // lv = planta (0 = baja, 1 = arriba). Fuera de los edificios de dos pisos, arriba no hay nada.
  const lay = (c, lv) => (lv ? c.up : c);
  function ground(x, z, lv) { const L = lay(ch(x, z), lv); return L ? L.ground[li(x, z)] : 0; }
  function obj(x, z, lv) { return lv ? 0 : ch(x, z).obj[li(x, z)]; }
  function eN(x, z, lv) { const L = lay(ch(x, z), lv); return L ? L.eN[li(x, z)] : 0; }
  function eW(x, z, lv) { const L = lay(ch(x, z), lv); return L ? L.eW[li(x, z)] : 0; }
  function bldAt(x, z, lv) {
    const c = ch(x, z), L = lay(c, lv);
    const b = L ? L.bld[li(x, z)] : 0;
    return b ? c.buildings[b - 1] : null;
  }
  function roomAt(x, z, lv) {
    const c = ch(x, z), L = lay(c, lv);
    if (!L) return null;
    const i = li(x, z);
    return L.bld[i] ? c.buildings[L.bld[i] - 1].rooms[L.rm[i] - 1] : null;
  }
  // ¿Le da el sol? Al aire libre (o bajo un techo roto), de día; a la sombra de un árbol, no. Dentro de los
  // edificios con techo y en los mapas cerrados (el salón recreativo), nunca
  function sunlit(x, z, lv) {
    const X = Math.floor(x), Z = Math.floor(z);
    if (isMap(layout)) { const m = G.Maps.get(layout); if (m && m.mood && m.mood.sun && m.mood.sun[1] < 0.2) return false; }
    if (layout === 'refugio') return false;
    if (isIndoor(X, Z, lv || 0) && !openSky(X, Z, lv || 0)) return false;
    if (!lv) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const o = obj(X + dx, Z + dz, 0); if (o === O.TREE || o === O.PINE) return false; }
    return true;
  }
  // ¿casilla de un edificio sin techo encima? (ruinas; la terraza, en el piso de arriba)
  function openSky(x, z, lv) {
    const b = bldAt(Math.floor(x), Math.floor(z), lv || 0);
    if (!b) return false;
    if (b.roof === 'none') return true;
    const R = b.bp && b.bp.def.openUp;
    if (!R || (lv || 0) !== (b.floors || 1) - 1) return false;
    const lx = Math.floor(x) - b.x0, lz = Math.floor(z) - b.z0;
    return R.some(([ox, oz, ow, oh]) => lx >= ox && lx < ox + ow && lz >= oz && lz < oz + oh);
  }
  function isIndoor(x, z, lv) { const L = lay(ch(x, z), lv); return !!L && L.bld[li(x, z)] !== 0; }
  // ¿Hierba alta en esta casilla? (solo en la planta baja)
  function tallAt(x, z, lv) {
    if (lv) return false;
    const c = ch(Math.floor(x), Math.floor(z));
    return !!(c.tall && c.tall[(Math.floor(z) - c.cz * CS) * CS + (Math.floor(x) - c.cx * CS)]);
  }

  function solidObj(o) { return o === O.TREE || o === O.PINE || o === O.LAMP; }

  // ---------- Escaleras ----------
  function stairAt(x, z) {
    const c = ch(Math.floor(x), Math.floor(z));
    if (!c.stairMap) return null;
    const k = c.stairMap[li(Math.floor(x), Math.floor(z))];
    return k ? c.stairs[k - 1] : null;
  }
  // 0 al pie de la escalera, 1 arriba
  function stairProgress(s, x, z) {
    const bx = s.x + 0.5 - s.dx * 0.5, bz = s.z + 0.5 - s.dz * 0.5;
    return U.clamp(((x - bx) * s.dx + (z - bz) * s.dz) / s.len, 0, 1);
  }
  // En qué planta está algo que estaba en "lv" y ahora está en (x, z): en la escalera cambia a mitad
  function levelAt(x, z, lv) {
    const s = stairAt(x, z);
    if (!s) return lv || 0;
    return stairProgress(s, x, z) > 0.5 ? 1 : 0;
  }

  // Altura del suelo (aceras y suelos interiores un poco más altos; arriba, la planta alta)
  // Altura del terreno (fuera de los edificios) en cualquier punto
  function terrainAt(x, z) {
    const c = ch(Math.floor(x), Math.floor(z));
    const lx = x - c.cx * CS, lz = z - c.cz * CS, R = CS + 1;
    const ix = Math.min(CS - 1, Math.floor(lx)), iz = Math.min(CS - 1, Math.floor(lz));
    const tx = lx - ix, tz = lz - iz;
    const a = c.th[iz * R + ix], b = c.th[iz * R + ix + 1], d = c.th[(iz + 1) * R + ix], e = c.th[(iz + 1) * R + ix + 1];
    return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
  }
  // Suelo base de una casilla: la base del edificio si estás dentro, el terreno si no
  function baseAt(x, z, lv) {
    const b = bldAt(Math.floor(x), Math.floor(z), lv || 0) || (lv ? null : null);
    if (b) return b.baseY;
    return terrainAt(x, z);
  }
  function groundY(x, z, lv) {
    const s = stairAt(x, z);
    if (s) return (s.b ? s.b.baseY : 0) + 0.04 + stairProgress(s, x, z) * FLOOR_H;
    if (lv) { const b = bldAt(Math.floor(x), Math.floor(z), lv); return (b ? b.baseY : 0) + FLOOR_H + 0.04; }
    const tx = Math.floor(x), tz = Math.floor(z);
    const g = ground(tx, tz);
    if (g >= 10) { const b = bldAt(tx, tz, 0); if (b) return b.baseY + 0.04; }
    return terrainAt(x, z) + (g === F.SIDEWALK ? 0.1 : 0);
  }

  // ---------- Cobertura ----------
  // 2 = alta (pared, puerta cerrada) · 1 = baja (valla, barandilla, ventana: se puede disparar por encima)
  function coverKind(e) {
    if (e === E.WALL || e === E.DOOR || e === E.CONT) return 2;
    if (e === E.FENCE || e === E.RAIL || e === E.WIN || e === E.WIN_OPEN || e === E.WIN_BROKEN) return 1;
    return 0;
  }
  // Pared o valla más cercana a (x, z) a menos de r metros: normal hacia el jugador y dirección a lo largo
  function coverNear(x, z, lv, r) {
    let best = null;
    const tx = Math.floor(x), tz = Math.floor(z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const X = tx + dx, Z = tz + dz;
        let k = coverKind(eN(X, Z, lv));
        if (k) {
          const cx = U.clamp(x, X, X + 1), d = Math.hypot(x - cx, z - Z);
          if (d < r && (!best || d < best.d)) best = { o: 'N', line: Z, low: k === 1, d, nx: 0, nz: z >= Z ? 1 : -1, tx: 1, tz: 0, cx, cz: Z };
        }
        k = coverKind(eW(X, Z, lv));
        if (k) {
          const cz = U.clamp(z, Z, Z + 1), d = Math.hypot(x - X, z - cz);
          if (d < r && (!best || d < best.d)) best = { o: 'W', line: X, low: k === 1, d, nx: x >= X ? 1 : -1, nz: 0, tx: 0, tz: 1, cx: X, cz };
        }
      }
    }
    return best;
  }
  // ¿Sigue la cobertura en esa línea a la altura s (coordenada a lo largo)? Si no, hay una esquina
  function coverAlong(cv, s, lv) {
    return coverKind(cv.o === 'N' ? eN(Math.floor(s), cv.line, lv) : eW(cv.line, Math.floor(s), lv)) > 0;
  }

  // ¿Tapa el terreno la línea entre dos puntos (con sus alturas)? Para la vista sobre lomas
  function terrainBlocks(x0, z0, y0, x1, z1, y1) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 2) return false;
    const n = Math.ceil(L / 1.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (terrainAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) > y0 + (y1 - y0) * t) return true;
    }
    return false;
  }

  // Arista entre dos casillas vecinas (ortogonales)
  function edgeBetween(x0, z0, x1, z1, lv) {
    if (x1 === x0 + 1) return eW(x1, z0, lv);
    if (x1 === x0 - 1) return eW(x0, z0, lv);
    if (z1 === z0 + 1) return eN(x0, z1, lv);
    return eN(x0, z0, lv);
  }
  function edgeRefBetween(x0, z0, x1, z1, lv) {
    lv = lv || 0;
    if (x1 === x0 + 1) return { o: 'W', x: x1, z: z0, lv };
    if (x1 === x0 - 1) return { o: 'W', x: x0, z: z0, lv };
    if (z1 === z0 + 1) return { o: 'N', x: x0, z: z1, lv };
    return { o: 'N', x: x0, z: z0, lv };
  }
  function edgeGet(ref) { return ref.o === 'N' ? eN(ref.x, ref.z, ref.lv) : eW(ref.x, ref.z, ref.lv); }

  // ---------- Techos por los que se camina (contenedores) ----------
  // Altura (m) del techo transitable en (x, z), 0 si no hay. Un punto dentro de la planta de un contenedor
  // cerrado solo puede ser alguien encima: desde ahí (o hacia ahí) los costados de contenedor no tapan
  function deckAt(x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    const c = ch(tx, tz);
    return c.deck ? c.deck[li(tx, tz)] / 10 : 0;
  }
  const elevTest = (test) => (e) => e !== E.CONT && test(e);
  // dentro de un contenedor abierto: altura de su techo (para la cámara); 0 si no
  function roofAt(x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    const c = ch(tx, tz);
    return c.croof ? c.croof[li(tx, tz)] / 10 : 0;
  }
  // Altura (sobre el suelo) de lo más alto en lo que se puede estar de pie en (x, z): el techo de un contenedor o
  // la parte de arriba de un mueble, vehículo o caja (si es lo bastante ancho para pisarlo); 0 si nada
  function standTop(x, z, lv) {
    let top = lv ? 0 : deckAt(x, z);
    const list = furnAt(Math.floor(x), Math.floor(z), lv || 0);
    if (list) {
      const c = ch(Math.floor(x), Math.floor(z));
      const gy = groundY(x, z, lv || 0) - 0.04;
      for (const k of list) {
        const f = c.furn[k];
        if (!f.solid || f.h > 3.05) continue;          // (hasta el techo de un camión)
        // lo estrecho (un muro bajo, una valla caída) cuenta algo más ancho: así se puede saltar
        let fx0 = f.x0, fx1 = f.x1, fz0 = f.z0, fz1 = f.z1;
        if (fx1 - fx0 < 0.45) { const m = (fx0 + fx1) / 2; fx0 = m - 0.25; fx1 = m + 0.25; }
        if (fz1 - fz0 < 0.45) { const m = (fz0 + fz1) / 2; fz0 = m - 0.25; fz1 = m + 0.25; }
        if (Math.min(f.x1 - f.x0, f.z1 - f.z0) < 0.45 && f.h > 1.3) continue;   // (postes y tabiques altos, no)
        if (x < fx0 + 0.02 || x > fx1 - 0.02 || z < fz0 + 0.02 || z > fz1 - 0.02) continue;
        top = Math.max(top, f.y + f.h - gy);
      }
    }
    return top;
  }
  // el mueble más alto que pisa un círculo (para saber cuánto ocupa lo que hay delante)
  function furnUnder(x, z, lv) {
    const list = furnAt(Math.floor(x), Math.floor(z), lv || 0);
    if (!list) return null;
    const c = ch(Math.floor(x), Math.floor(z));
    let best = null;
    for (const k of list) {
      const f = c.furn[k];
      if (!f.solid) continue;
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      if (!best || f.y + f.h > best.y + best.h) best = f;
    }
    return best;
  }
  function wallHAt(x, z, lv) { const b = bldAt(Math.floor(x), Math.floor(z), lv || 0); return (b && b.wallH) || WALL_H; }

  // ---------- Muebles (colisión) ----------
  // c.furn: lista de muebles; c.fidx[lv]: casilla -> índices de muebles que la tocan;
  // c.fblock[lv]: casilla ocupada del todo (los zombis la rodean)
  function furnAt(x, z, lv) {
    const c = ch(x, z);
    const m = c.fidx && c.fidx[lv || 0];
    if (!m) return null;
    return m.get(li(x, z)) || null;
  }
  function furnTile(x, z, lv) {
    const c = ch(x, z);
    const fb = c.fblock && c.fblock[lv || 0];
    return !!fb && fb[li(x, z)] === 1;
  }
  function furnBlocked(x, z, r, lv, elev) {
    let gy0 = null;
    const tx0 = Math.floor(x - r), tx1 = Math.floor(x + r), tz0 = Math.floor(z - r), tz1 = Math.floor(z + r);
    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const list = furnAt(tx, tz, lv);
        if (!list) continue;
        const c = ch(tx, tz);
        for (const k of list) {
          const f = c.furn[k];
          if (!f.solid) continue;
          if (elev && f.y + f.h - (gy0 == null ? (gy0 = groundY(x, z, lv) - 0.04) : gy0) <= elev + 0.35) continue;      // por encima (desde un techo; el relieve cuenta)
          const px = U.clamp(x, f.x0, f.x1), pz = U.clamp(z, f.z0, f.z1);
          if ((px - x) * (px - x) + (pz - z) * (pz - z) < r * r) return true;
        }
      }
    }
    return false;
  }
  // Altura del mueble más alto que hay en (x, z) (0 si ninguno)
  function furnTop(x, z, lv, r) {
    r = r || 0;
    const list = furnAt(Math.floor(x), Math.floor(z), lv);
    if (!list) return 0;
    const c = ch(Math.floor(x), Math.floor(z));
    let top = 0;
    for (const k of list) {
      const f = c.furn[k];
      if (x > f.x0 - r && x < f.x1 + r && z > f.z0 - r && z < f.z1 + r) top = Math.max(top, f.y + f.h + 0.05);
    }
    return top;
  }

  // Muebles cerca de un punto (para registrar)
  function furnNear(x, z, r, lv) {
    const out = [];
    const cx0 = Math.floor((x - r) / CS), cx1 = Math.floor((x + r) / CS);
    const cz0 = Math.floor((z - r) / CS), cz1 = Math.floor((z + r) / CS);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = chunkAt(cx, cz);
        for (const f of c.furn) {
          if ((f.lv || 0) !== (lv || 0)) continue;
          const px = U.clamp(x, f.x0, f.x1), pz = U.clamp(z, f.z0, f.z1);
          if (Math.hypot(px - x, pz - z) <= r) out.push({ c, f });
        }
      }
    }
    return out;
  }

  // ---------- Colisiones ----------
  // noFurn: sin contar los muebles (la cámara los comprueba con su altura)
  // elev: altura de los pies sobre el suelo (encima de un contenedor): los costados de contenedor y lo que
  // queda por debajo no estorban; un techo más alto (otra fila apilada) sí
  function circleBlocked(x, z, r, lv, noFurn, elev) {
    // borde del mundo de pruebas: nada sale (tampoco saltando la valla)
    if (SMALL && (x - r < AMIN + 0.02 || x + r > AMAX - 0.02 || z - r < AMIN + 0.02 || z + r > AMAX - 0.02)) return true;
    // límite del área jugable del mapa (fuera no se puede ir: ni tú ni ellos)
    if (BND && (x - r < BND[0] || x + r > BND[2] || z - r < BND[1] || z + r > BND[3])) return true;
    // Objetos sólidos (troncos, farolas)
    const x0 = Math.floor(x - r - 0.5), x1 = Math.floor(x + r + 0.5);
    const z0 = Math.floor(z - r - 0.5), z1 = Math.floor(z + r + 0.5);
    if (!noFurn && furnBlocked(x, z, r, lv, elev)) return true;
    if (!(elev > 0.3) && deckAt(x, z) > 0) return true;        // dentro de un contenedor cerrado (desde el suelo)
    if (elev > 0.3) {
      for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++) {
        for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) if (deckAt(tx + 0.5, tz + 0.5) > elev + 0.4) return true;
      }
    }
    const walk = BIG ? bigWalk : elev > 0.3 ? (e) => e !== E.CONT && e !== E.FENCE && B.blocksWalk(e) : B.blocksWalk;
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        const o = obj(tx, tz, lv);
        if (!solidObj(o)) continue;
        const rr = o === O.LAMP ? 0.12 : 0.3;
        const dx = tx + 0.5 - x, dz = tz + 0.5 - z;
        if (dx * dx + dz * dz < (r + rr) * (r + rr)) return true;
      }
    }
    const rr = (r + HT) * (r + HT);
    // Aristas horizontales (líneas z = L)
    const lz0 = Math.ceil(z - r - HT), lz1 = Math.floor(z + r + HT);
    const tx0 = Math.floor(x - r - HT), tx1 = Math.floor(x + r + HT);
    for (let L = lz0; L <= lz1; L++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!walk(eN(tx, L, lv))) continue;
        const px = U.clamp(x, tx - HT, tx + 1 + HT) - x, pz = L - z;
        if (px * px + pz * pz < rr) return true;
      }
    }
    // Aristas verticales (líneas x = L)
    const lx0 = Math.ceil(x - r - HT), lx1 = Math.floor(x + r + HT);
    const tz0 = Math.floor(z - r - HT), tz1 = Math.floor(z + r + HT);
    for (let L = lx0; L <= lx1; L++) {
      for (let tz = tz0; tz <= tz1; tz++) {
        if (!walk(eW(L, tz, lv))) continue;
        const px = L - x, pz = U.clamp(z, tz - HT, tz + 1 + HT) - z;
        if (px * px + pz * pz < rr) return true;
      }
    }
    return false;
  }

  // Muebles con cajones o puertas dentro de una habitación (casillas locales del chunk)
  function roomContainers(c, tiles, lv) {
    const set = new Set(tiles.map(([x, z]) => (c.cz * CS + z) * 100003 + c.cx * CS + x));
    return c.furn.filter((f) => f.cont && (f.lv || 0) === lv && !G.Furniture.T[f.type].vehicle &&
      set.has(Math.floor((f.z0 + f.z1) / 2) * 100003 + Math.floor((f.x0 + f.x1) / 2)));
  }

  // Estado con el que aparece un objeto: desgaste del arma, balas en el cargador o cantidad
  function itemCond(id, rng) {
    if (G.Weapons.isItem(id)) return G.Weapons.stackSize(id, rng);
    const w = G.Weapons.get(id);
    if (G.Weapons.isGun(w)) return Math.max(w.gun === 'bow' ? 0 : 1, Math.floor(rng() * (w.mag + 1)));
    return 0.5 + rng() * 0.5;
  }

  // Como lineBlocked, pero devuelve en qué fracción del segmento (0 a 1) está la primera
  // arista que cumple test, o -1 si no hay ninguna (para balas y flechas)
  function lineHit(x0, z0, x1, z1, test, lv) {
    if (deckAt(x0, z0) > 0 || deckAt(x1, z1) > 0) test = elevTest(test);
    let tx = Math.floor(x0), tz = Math.floor(z0);
    const ex = Math.floor(x1), ez = Math.floor(z1);
    const dx = x1 - x0, dz = z1 - z0;
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    let tMaxX = adx > 1e-9 ? (sx > 0 ? tx + 1 - x0 : x0 - tx) / adx : Infinity;
    let tMaxZ = adz > 1e-9 ? (sz > 0 ? tz + 1 - z0 : z0 - tz) / adz : Infinity;
    const tdx = adx > 1e-9 ? 1 / adx : Infinity, tdz = adz > 1e-9 ? 1 / adz : Infinity;
    let steps = Math.abs(ex - tx) + Math.abs(ez - tz) + 2;
    while (steps-- > 0) {
      if (tx === ex && tz === ez) return -1;
      if (tMaxX < tMaxZ) {
        if (tMaxX > 1) return -1;
        if (test(eW(sx > 0 ? tx + 1 : tx, tz, lv))) return tMaxX;
        tx += sx; tMaxX += tdx;
      } else {
        if (tMaxZ > 1) return -1;
        if (test(eN(tx, sz > 0 ? tz + 1 : tz, lv))) return tMaxZ;
        tz += sz; tMaxZ += tdz;
      }
    }
    return -1;
  }

  // noFurn: atraviesa los muebles (el hongomorfo atascado se abre paso a empujones)
  function move(pos, dx, dz, r, lv, elev, noFurn) {
    if (!circleBlocked(pos.x + dx, pos.z + dz, r, lv, !!noFurn, elev)) { pos.x += dx; pos.z += dz; return; }
    if (!circleBlocked(pos.x + dx, pos.z, r, lv, !!noFurn, elev)) pos.x += dx;
    if (!circleBlocked(pos.x, pos.z + dz, r, lv, !!noFurn, elev)) pos.z += dz;
  }

  // Recorre las aristas que cruza un segmento; test(arista) == true detiene
  function lineBlocked(x0, z0, x1, z1, test, lv) {
    if (deckAt(x0, z0) > 0 || deckAt(x1, z1) > 0) test = elevTest(test);
    let tx = Math.floor(x0), tz = Math.floor(z0);
    const ex = Math.floor(x1), ez = Math.floor(z1);
    const dx = x1 - x0, dz = z1 - z0;
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    let tMaxX = adx > 1e-9 ? (sx > 0 ? tx + 1 - x0 : x0 - tx) / adx : Infinity;
    let tMaxZ = adz > 1e-9 ? (sz > 0 ? tz + 1 - z0 : z0 - tz) / adz : Infinity;
    const tdx = adx > 1e-9 ? 1 / adx : Infinity, tdz = adz > 1e-9 ? 1 / adz : Infinity;
    let steps = Math.abs(ex - tx) + Math.abs(ez - tz) + 2;
    while (steps-- > 0) {
      if (tx === ex && tz === ez) return false;
      if (tMaxX < tMaxZ) {
        if (tMaxX > 1) return false;
        if (test(eW(sx > 0 ? tx + 1 : tx, tz, lv))) return true;
        tx += sx; tMaxX += tdx;
      } else {
        if (tMaxZ > 1) return false;
        if (test(eN(tx, sz > 0 ? tz + 1 : tz, lv))) return true;
        tz += sz; tMaxZ += tdz;
      }
    }
    return false;
  }

  // ¿Algo tapa la línea entre dos puntos (con altura)? Paredes y además lo que hay por medio: muebles, cajas,
  // coches, contenedores, troncos y farolas (si la línea pasa por debajo de su altura). sight: también los
  // arbustos (tapan la vista a quien está agachado, no las balas). Devuelve en qué fracción (0 a 1) choca, o -1
  function coverHit(x0, z0, y0, x1, z1, y1, lv, sight) {
    lv = lv || 0;
    let best = lineHit(x0, z0, x1, z1, B.blocksSight, lv);
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 0.9) return best;
    const n = Math.ceil(L / 0.18);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (best >= 0 && t >= best) break;
      const d = t * L;
      if (d < 0.45 || L - d < 0.42) continue;          // (lo que tiene pegado cada uno no cuenta)
      const x = x0 + dx * t, z = z0 + dz * t, y = y0 + (y1 - y0) * t;
      const tx = Math.floor(x), tz = Math.floor(z);
      let gy = null;
      const rel = () => y - (gy == null ? (gy = groundY(x, z, lv)) : gy);
      if (!lv) {
        const o = obj(tx, tz, 0);
        if (o === O.TREE || o === O.PINE || o === O.LAMP) {
          const rr = o === O.LAMP ? 0.1 : 0.24, ex = tx + 0.5 - x, ez = tz + 0.5 - z;
          if (ex * ex + ez * ez < rr * rr) return t;
        } else if (sight && o === O.BUSH && rel() < 1.05) {
          const ex = tx + 0.5 - x, ez = tz + 0.5 - z;
          if (ex * ex + ez * ez < 0.42 * 0.42) return t;
        }
        const dk = deckAt(x, z);
        if (dk > 0 && rel() < dk) return t;
      }
      const list = furnAt(tx, tz, lv);
      if (!list) continue;
      const c = ch(tx, tz);
      for (const k of list) {
        const f = c.furn[k];
        if (!f || f.gone || f.h < 0.35 || (!f.solid && !sight)) continue;
        if (G.Furniture.T[f.type] && G.Furniture.T[f.type].thru && (sight || Math.random() < 0.7)) continue;      // (rejas: se ve y casi siempre se dispara a través)
        if (x < f.x0 - 0.02 || x > f.x1 + 0.02 || z < f.z0 - 0.02 || z > f.z1 + 0.02) continue;
        if (rel() < f.h) return t;
      }
    }
    return best;
  }

  function hasLOS(x0, z0, x1, z1, lv) {
    return !lineBlocked(x0, z0, x1, z1, B.blocksSight, lv);
  }

  function hasClearLine(x0, z0, x1, z1, lv) {
    if (lineBlocked(x0, z0, x1, z1, BIG ? bigWalk : B.blocksWalk, lv)) return false;
    const dx = x1 - x0, dz = z1 - z0;
    const n = Math.ceil(Math.hypot(dx, dz) / 0.3);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (circleBlocked(x0 + dx * t, z0 + dz * t, 0.26, lv)) return false;
    }
    return true;
  }

  // ---------- Zona jugable ----------
  // Casillas a las que se llega andando desde (sx, sz) dentro del mapa (puertas sí; climb: también saltando
  // ventanas y vallas). Devuelve { ox, oz, w, h, d } con d = distancia en casillas (-1 si no se llega)
  function reach(sx, sz, climb, lv) {
    lv = lv || 0;
    const x0 = Math.floor(AMIN), z0 = Math.floor(AMIN), w = Math.ceil(AMAX) - x0, h = Math.ceil(AMAX) - z0;
    const d = new Int16Array(w * h).fill(-1);
    const free = (x, z) => x >= x0 && z >= z0 && x < x0 + w && z < z0 + h && !solidObj(obj(x, z, lv)) && !furnTile(x, z, lv) && !(deckAt(x + 0.5, z + 0.5) > 0);
    const ok = (e) => e === E.NONE || e === E.DOOR || e === E.DOOR_OPEN || e === E.DOOR_BROKEN || e === E.ARCH || e === E.GATE ||
      (climb && (e === E.WIN || e === E.WIN_OPEN || e === E.WIN_BROKEN || e === E.FENCE));
    const qx = new Int16Array(w * h), qz = new Int16Array(w * h);
    let a = 0, b = 0;
    const s0x = Math.floor(sx), s0z = Math.floor(sz);
    if (!free(s0x, s0z)) return { ox: x0, oz: z0, w, h, d };
    d[(s0z - z0) * w + (s0x - x0)] = 0; qx[b] = s0x; qz[b] = s0z; b++;
    while (a < b) {
      const cx = qx[a], cz = qz[a]; a++;
      const cd = d[(cz - z0) * w + (cx - x0)];
      for (const [ddx, ddz] of ORTHO) {
        const nx = cx + ddx, nz = cz + ddz;
        if (!free(nx, nz)) continue;
        const i = (nz - z0) * w + (nx - x0);
        if (d[i] >= 0) continue;
        if (!ok(edgeBetween(cx, cz, nx, nz, lv))) continue;
        d[i] = cd + 1; qx[b] = nx; qz[b] = nz; b++;
      }
    }
    return { ox: x0, oz: z0, w, h, d };
  }

  // ---------- A* local (ventana 112x112: cubre un mapa entero; antes 48x48 y, si la meta caía fuera, el
  // infectado iba en línea recta y se atascaba) ----------
  const PW = 112, PH = 56;
  // casillas que un mueble ocupa en parte (no del todo: no salen en furnTile) pero donde no cabe un cuerpo en el
  // centro: también se evitan (antes se intentaba pasar y se quedaba pegado al mueble). -1 sin mirar, 0 libre, 1 no
  const soft = new Int8Array(PW * PW);
  const gScore = new Float32Array(PW * PW);
  const cameFrom = new Int32Array(PW * PW);
  const closed = new Uint8Array(PW * PW);
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Coste extra de cruzar una arista para un zombi (Infinity = imposible)
  function crossCost(e, lv) {
    if (BIG) return e === E.NONE ? 0 : Infinity;
    if (e === E.NONE || e === E.DOOR_OPEN || e === E.DOOR_BROKEN || e === E.ARCH || e === E.GATE) return 0;
    if (e === E.WALL || e === E.RAIL || e === E.CONT) return Infinity;
    if (lv && (e === E.WIN || e === E.WIN_OPEN || e === E.WIN_BROKEN)) return Infinity;   // arriba no se salta por la ventana
    if (e === E.DOOR) return 7;
    if (e === E.WIN) return 9;
    return 4;   // ventana abierta o rota, valla: trepar
  }

  function findPath(sx, sz, tx, tz, maxNodes, lv, noSoft) {
    const r0 = findPath0(sx, sz, tx, tz, maxNodes, lv, noSoft);
    // (si por los huecos estrechos junto a los muebles no hay camino, se prueba otra vez sin evitarlos)
    return r0 || noSoft ? r0 : findPath0(sx, sz, tx, tz, maxNodes, lv, true);
  }
  function findPath0(sx, sz, tx, tz, maxNodes, lv, noSoft) {
    maxNodes = maxNodes || 3000;
    const sX = Math.floor(sx), sZ = Math.floor(sz);
    let tX = Math.floor(tx), tZ = Math.floor(tz);
    const ox = sX - PH, oz = sZ - PH;
    // meta fuera de la ventana: se acerca por la línea recta hasta su borde
    if (tX - ox < 1 || tZ - oz < 1 || tX - ox >= PW - 1 || tZ - oz >= PW - 1) {
      const k = (PH - 2) / Math.max(Math.abs(tX - sX), Math.abs(tZ - sZ), 1);
      tX = sX + Math.round((tX - sX) * k); tZ = sZ + Math.round((tZ - sZ) * k);
    }
    soft.fill(-1);
    const blk = (x, z) => {
      if (solidObj(obj(x, z, lv)) || furnTile(x, z, lv)) return true;
      const li2 = (z - oz) * PW + (x - ox);
      if (noSoft || li2 < 0 || li2 >= PW * PW) return false;
      if (soft[li2] < 0) soft[li2] = furnBlocked(x + 0.5, z + 0.5, 0.22, lv) ? 1 : 0;
      return soft[li2] === 1;
    };
    // meta ocupada (dentro de un mueble, un tronco): la casilla libre más cercana
    if (blk(tX, tZ)) {
      let found = false;
      for (let r = 1; r <= 3 && !found; r++) {
        for (let dz = -r; dz <= r && !found; dz++) for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!blk(tX + dx, tZ + dz)) { tX += dx; tZ += dz; found = true; }
        }
      }
      if (!found) return null;
    }
    const ltx = tX - ox, ltz = tZ - oz;
    if (ltx < 0 || ltz < 0 || ltx >= PW || ltz >= PW) return null;
    if (sX === tX && sZ === tZ) return [];
    gScore.fill(Infinity);
    cameFrom.fill(-1);
    closed.fill(0);
    const heap = [];
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    };
    const h = (x, z) => {
      const dx = Math.abs(x - ltx), dz = Math.abs(z - ltz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    const si = PH * PW + PH;
    gScore[si] = 0;
    push(h(PH, PH), si);
    let expanded = 0;
    while (heap.length) {
      const ci = pop()[1];
      if (closed[ci]) continue;
      closed[ci] = 1;
      const cx = ci % PW, cz = (ci / PW) | 0;
      if (cx === ltx && cz === ltz) {
        const out = [];
        let i = ci;
        while (i !== si) {
          out.push({ x: ox + (i % PW) + 0.5, z: oz + ((i / PW) | 0) + 0.5 });
          i = cameFrom[i];
        }
        out.reverse();
        return out;
      }
      if (++expanded > maxNodes) return null;
      const wx = ox + cx, wz = oz + cz;
      for (const d of ORTHO) {
        const nx = cx + d[0], nz = cz + d[1];
        if (nx < 0 || nz < 0 || nx >= PW || nz >= PW) continue;
        if (blk(wx + d[0], wz + d[1])) continue;
        const cc = crossCost(edgeBetween(wx, wz, wx + d[0], wz + d[1], lv), lv);
        if (cc === Infinity) continue;
        const ni = nz * PW + nx;
        if (closed[ni]) continue;
        const ng = gScore[ci] + 1 + cc;
        if (ng < gScore[ni]) { gScore[ni] = ng; cameFrom[ni] = ci; push(ng + h(nx, nz), ni); }
      }
      for (const d of DIAG) {
        const nx = cx + d[0], nz = cz + d[1];
        if (nx < 0 || nz < 0 || nx >= PW || nz >= PW) continue;
        const ax = wx + d[0], az = wz + d[1];
        if (blk(ax, az) || blk(ax, wz) || blk(wx, az)) continue;
        if (crossCost(edgeBetween(wx, wz, ax, wz, lv)) !== 0 || crossCost(edgeBetween(ax, wz, ax, az, lv)) !== 0 ||
            crossCost(edgeBetween(wx, wz, wx, az, lv)) !== 0 || crossCost(edgeBetween(wx, az, ax, az, lv)) !== 0) continue;
        const ni = nz * PW + nx;
        if (closed[ni]) continue;
        const ng = gScore[ci] + 1.414;
        if (ng < gScore[ni]) { gScore[ni] = ng; cameFrom[ni] = ci; push(ng + h(nx, nz), ni); }
      }
    }
    return null;
  }

  // ---------- Cambios en puertas y ventanas ----------
  function setEdge(ref, v) {
    const c = ch(ref.x, ref.z);
    const L = lay(c, ref.lv);
    if (!L) return;
    const arr = ref.o === 'N' ? L.eN : L.eW;
    const i = li(ref.x, ref.z);
    const old = arr[i];
    arr[i] = v;
    // una ventana que se rompe deja vidrios en el marco (cortan al saltar, hasta quitarlos)
    if (v === E.WIN_BROKEN && old !== E.WIN_BROKEN) (c.glass || (c.glass = new Set())).add(edgeKey(ref));
    if (c.view) G.WorldView.edgeChanged(c, ref, old, v);
  }

  function hasGlass(ref) { const c = ch(ref.x, ref.z); return !!(c.glass && c.glass.has(edgeKey(ref))); }
  function clearGlass(ref) { const c = ch(ref.x, ref.z); if (c.glass) c.glass.delete(edgeKey(ref)); }

  // Arista que se cruza en el punto (px, pz) yendo en la dirección (dx, dz), o null
  function edgeAt(px, pz, dx, dz, lv) {
    const e = 0.04, l = Math.hypot(dx, dz) || 1;
    const ax = Math.floor(px - dx / l * e), az = Math.floor(pz - dz / l * e);
    const bx = Math.floor(px + dx / l * e), bz = Math.floor(pz + dz / l * e);
    if ((ax === bx) === (az === bz)) return null;           // misma casilla o esquina
    return edgeRefBetween(ax, az, bx, bz, lv);
  }

  // Rompe una ventana cerrada (disparo, golpe): ruido de cristales
  function shatter(ref) {
    if (edgeGet(ref) !== E.WIN) return false;
    setEdge(ref, E.WIN_BROKEN);
    emit(ref.o === 'N' ? ref.x + 0.5 : ref.x, ref.o === 'N' ? ref.z : ref.z + 0.5, 14, ref.lv);
    if (G.Audio) G.Audio.play('glass', { x: ref.o === 'N' ? ref.x + 0.5 : ref.x, z: ref.o === 'N' ? ref.z : ref.z + 0.5, lv: ref.lv });
    return true;
  }

  // Ventanas cerradas que cruza un disparo o una flecha entre dos puntos: se rompen
  function breakWindowsAlong(x0, z0, x1, z1, lv) {
    let n = 0, sx = x0, sz = z0;
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 1e-3) return 0;
    for (let k = 0; k < 4; k++) {
      const f = lineHit(sx, sz, x1, z1, (e) => e === E.WIN, lv);
      if (f < 0) break;
      const px = sx + (x1 - sx) * f, pz = sz + (z1 - sz) * f;
      const ref = edgeAt(px, pz, dx, dz, lv);
      if (ref && shatter(ref)) n++;
      sx = px + dx / L * 0.06; sz = pz + dz / L * 0.06;
    }
    return n;
  }

  function edgeKey(ref) { return ref.o + ref.x + ',' + ref.z + (ref.lv ? 'u' : ''); }

  // Hoja de una puerta abierta como segmento [x0, z0, x1, z1] (o null si no está abierta)
  function doorLeaf(o, x, z, lv) {
    const e = o === 'N' ? eN(x, z, lv) : eW(x, z, lv);
    if (e !== E.DOOR_OPEN) return null;
    const ax = o === 'N' ? x : x - 1, az = o === 'N' ? z - 1 : z;
    const swing = (isIndoor(ax, az, lv) && !isIndoor(x, z, lv)) ? -1 : 1;
    if (o === 'N') return [x + 0.07, z, x + 0.07, z + swing * 0.86];
    return [x, z + 0.07, x + swing * 0.86, z + 0.07];
  }

  function nearDoorLeaf(px, pz, r, lv) {
    const tx0 = Math.floor(px) - 1, tz0 = Math.floor(pz) - 1;
    for (let tz = tz0; tz <= tz0 + 2; tz++) {
      for (let tx = tx0; tx <= tx0 + 2; tx++) {
        for (const o of ['N', 'W']) {
          const L = doorLeaf(o, tx, tz, lv);
          if (!L) continue;
          const vx = L[2] - L[0], vz = L[3] - L[1];
          const t = U.clamp(((px - L[0]) * vx + (pz - L[1]) * vz) / (vx * vx + vz * vz), 0, 1);
          if (Math.hypot(L[0] + vx * t - px, L[1] + vz * t - pz) < r) return true;
        }
      }
    }
    return false;
  }

  // Daño de un zombi a una puerta o ventana. Devuelve true si se rompe.
  function damageEdge(ref, amount) {
    const c = ch(ref.x, ref.z);
    const k = edgeKey(ref);
    const e = edgeGet(ref);
    const max = e === E.DOOR ? 12 : 3;
    const hp = (c.edgeHP.has(k) ? c.edgeHP.get(k) : max) - amount;
    c.edgeHP.set(k, hp);
    if (hp > 0) return false;
    setEdge(ref, e === E.DOOR ? E.DOOR_BROKEN : E.WIN_BROKEN);
    emit(ref.o === 'N' ? ref.x + 0.5 : ref.x, ref.o === 'N' ? ref.z : ref.z + 0.5, e === E.DOOR ? 10 : 14, ref.lv);
    if (G.Audio) G.Audio.play(e === E.DOOR ? 'doorBreak' : 'glass', { x: ref.o === 'N' ? ref.x + 0.5 : ref.x, z: ref.o === 'N' ? ref.z : ref.z + 0.5, lv: ref.lv });
    return true;
  }

  // ---------- Paredes que se derriban (jefe final) ----------
  // Solo las interiores (las dos casillas dentro del mismo edificio) de un edificio que lo permita, abajo
  function breakableEdge(ref) {
    if (!ref || ref.lv) return false;
    const e = edgeGet(ref);
    if (e !== E.WALL && e !== E.DOOR && e !== E.DOOR_OPEN && e !== E.DOOR_BROKEN && e !== E.WIN && e !== E.WIN_OPEN && e !== E.WIN_BROKEN) return false;
    const bx = ref.o === 'N' ? ref.x : ref.x - 1, bz = ref.o === 'N' ? ref.z - 1 : ref.z;
    const b1 = bldAt(ref.x, ref.z, 0), b2 = bldAt(bx, bz, 0);
    if (b1 && b1 === b2) return !!(b1.bp && b1.bp.def.breakable);
    // las de fuera, solo en los edificios que lo permiten (el salón recreativo: así se abre el exterior)
    if (!!b1 === !!b2) return false;
    const b = b1 || b2;
    return !!(b.bp && b.bp.def.breakable && b.bp.def.breakOut);
  }
  // ¿es una pared de fuera (un lado dentro de un edificio y el otro no)?
  function outerEdge(ref) {
    const bx = ref.o === 'N' ? ref.x : ref.x - 1, bz = ref.o === 'N' ? ref.z - 1 : ref.z;
    return !bldAt(ref.x, ref.z, 0) !== !bldAt(bx, bz, 0);
  }
  // la derriba: la arista desaparece y el trozo del mundo se vuelve a dibujar (al final del fotograma, una vez)
  const rebuildSet = new Set();
  function breakWall(ref) {
    if (!breakableEdge(ref)) return false;
    const c = ch(ref.x, ref.z);
    const vis = c.view && G.WorldView.hideEdge(c, ref);      // antes de cambiar la arista (busca sus vértices)
    setEdge(ref, E.NONE);
    if (c.view && !vis) rebuildSet.add(c);
    return true;
  }
  // el hongomorfo destroza un mueble del salón (máquinas): deja de estar (colisión, rutas y dibujo)
  function smashFurn(c, f) {
    if (!c || !f || f.gone) return false;
    f.gone = true; f.solid = false; f.h = 0; f.y = -5;
    G.Furniture.indexChunk(c, CS);
    if (c.view) G.WorldView.hideFurn(c, f);
    return true;
  }
  function flushRebuilds() {
    if (!rebuildSet.size) return;
    for (const c of rebuildSet) {
      const old = c.view;
      if (!old) continue;
      c.view = null;
      G.WorldView.build(c);              // el nuevo ya está en la escena antes de quitar el viejo (sin parpadeo)
      G.WorldView.dispose({ view: old });
    }
    rebuildSet.clear();
  }

  function emit(x, z, radius, lv) {
    for (let i = 0; i < listeners.length; i++) listeners[i](x, z, radius, lv || 0);
  }

  function toggleLight(room) {
    room.on = !room.on;
    const c = ch(Math.floor(room.light.x), Math.floor(room.light.z));
    if (c.view) G.WorldView.lightChanged(c, room);
  }

  // ---------- Objetos en el suelo ----------
  function itemsNear(x, z, r, lv) {
    const out = [];
    const cx0 = Math.floor((x - r) / CS), cx1 = Math.floor((x + r) / CS);
    const cz0 = Math.floor((z - r) / CS), cz1 = Math.floor((z + r) / CS);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = chunkAt(cx, cz);
        for (const it of c.items) {
          if ((it.lv || 0) === (lv || 0) && Math.hypot(it.x - x, it.z - z) <= r) out.push({ c, it });
        }
      }
    }
    return out;
  }

  function removeItem(c, it) {
    const i = c.items.indexOf(it);
    if (i >= 0) c.items.splice(i, 1);
    if (c.view) G.WorldView.itemRemoved(c, it);
  }

  function dropItem(x, z, id, cond, lv) {
    const c = ch(Math.floor(x), Math.floor(z));
    const it = { x, z, rot: Math.random() * 6.28, id, cond, lv: lv || 0 };
    c.items.push(it);
    if (c.view) G.WorldView.itemAdded(c, it);
    return it;
  }

  // Lo que suelta el jugador: las armas de fuego largas quedan a la vista; lo demás va a un montón
  // (si ya hay uno a menos de 1 m, se añade a ese)
  function dropLoot(x, z, id, cond, lv) {
    if (G.Weapons.hasModel(id)) return dropItem(x, z, id, cond, lv);
    for (const { it } of itemsNear(x, z, 1.0, lv)) if (it.pile) { it.pile.push({ id, cond }); return it; }
    const c = ch(Math.floor(x), Math.floor(z));
    const it = { x, z, rot: Math.random() * 6.28, id: 'monton', pile: [{ id, cond }], lv: lv || 0 };
    c.items.push(it);
    if (c.view) G.WorldView.itemAdded(c, it);
    return it;
  }

  // ---------- Gestión de chunks ----------
  function init(sceneRef, seed) {
    scene = sceneRef;
    if (seed != null) SEED = (seed ^ (G.__s | 0) ^ CHUNK_SALT) | 0;
    G.WorldView.init(scene);
  }

  function reset(seed) {
    REFUGE_STATIONS.length = 0;
    chunks.forEach((c) => { if (c.view) G.WorldView.dispose(c); });
    chunks.clear();
    buildQueue.length = 0;
    if (building) { building.it.return(); building = null; }
    rebuildSet.clear();
    lastCX = lastCZ = NaN; lastChunk = null;
    lastPCX = lastPCZ = NaN;
    SEED = (seed ^ (G.__s | 0) ^ CHUNK_SALT) | 0;
    chunkAt(0, 0);   // fija el punto de inicio
  }

  // Mapa cerrado: las zonas que lo cubren (con un margen de MESH_RADIUS alrededor). null en el mundo abierto
  function finiteRange() {
    if (!isMap(layout)) return null;
    return [Math.floor(AMIN / CS) - MESH_RADIUS, Math.floor(AMIN / CS) - MESH_RADIUS, Math.floor((AMAX - 1e-3) / CS) + MESH_RADIUS, Math.floor((AMAX - 1e-3) / CS) + MESH_RADIUS];
  }
  // en un mapa cerrado se ven las mismas zonas que antes (las de alrededor); el resto, armadas pero ocultas
  function showNear(pcx, pcz) {
    if (!isMap(layout)) return;
    chunks.forEach((c) => {
      if (!c.view) return;
      const vis = Math.abs(c.cx - pcx) <= MESH_RADIUS && Math.abs(c.cz - pcz) <= MESH_RADIUS;
      if (c.view.group.visible !== vis) c.view.group.visible = vis;
    });
  }
  // todas las zonas a la vista un momento (para subirlas a la tarjeta gráfica detrás de la pantalla de carga)
  function showAll(on) {
    chunks.forEach((c) => { if (c.view) c.view.group.visible = true; });
    if (!on) showNear(lastPCX, lastPCZ);
  }

  function update(px, pz, immediate, dt) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    if (pcx !== lastPCX || pcz !== lastPCZ) {
      lastPCX = pcx; lastPCZ = pcz;
      for (let dz = -DATA_RADIUS; dz <= DATA_RADIUS; dz++) {
        for (let dx = -DATA_RADIUS; dx <= DATA_RADIUS; dx++) chunkAt(pcx + dx, pcz + dz);
      }
      if (scene) {
        const fr = finiteRange();
        if (fr) {
          // mapa cerrado: se arman todas sus zonas de una vez (al cargar, detrás de la pantalla de carga) y no se
          // tiran nunca; al moverse solo se muestran u ocultan (así no se arma nada en mitad del juego)
          for (let cz = fr[1] - 1; cz <= fr[3] + 1; cz++) for (let cx = fr[0] - 1; cx <= fr[2] + 1; cx++) chunkAt(cx, cz);
          for (let cz = fr[1]; cz <= fr[3]; cz++) {
            for (let cx = fr[0]; cx <= fr[2]; cx++) {
              const c = chunkAt(cx, cz);
              if (!c.view && !c.queued) { c.queued = true; buildQueue.push(c); }
            }
          }
        } else {
          for (let dz = -MESH_RADIUS; dz <= MESH_RADIUS; dz++) {
            for (let dx = -MESH_RADIUS; dx <= MESH_RADIUS; dx++) {
              const c = chunkAt(pcx + dx, pcz + dz);
              if (!c.view && !c.queued) { c.queued = true; buildQueue.push(c); }
            }
          }
          chunks.forEach((c) => {
            if (c.view && (Math.abs(c.cx - pcx) > KEEP_RADIUS || Math.abs(c.cz - pcz) > KEEP_RADIUS)) {
              G.WorldView.dispose(c);
            }
          });
        }
        showNear(pcx, pcz);
      }
    }
    if (!scene) return;
    // Construcción por etapas con un tope de milisegundos por fotograma (sin tirones al cargar zonas)
    const limit = immediate ? Infinity : (G.Quality ? G.Quality.cur.buildMs : 5);
    const fin = isMap(layout);
    let built = false;
    const rebuilt = rebuildSet.size > 0;
    const t0 = performance.now();
    for (;;) {
      if (!building) {
        if (!buildQueue.length) break;
        let bi = 0, bd = Infinity;
        for (let i = 0; i < buildQueue.length; i++) {
          const c = buildQueue[i];
          const d = Math.abs(c.cx - pcx) + Math.abs(c.cz - pcz);
          if (d < bd) { bd = d; bi = i; }
        }
        const c = buildQueue.splice(bi, 1)[0];
        if (c.view || (!fin && (Math.abs(c.cx - pcx) > KEEP_RADIUS || Math.abs(c.cz - pcz) > KEEP_RADIUS))) { c.queued = false; continue; }
        building = { c, it: G.WorldView.buildSteps(c) };
      }
      const c = building.c;
      if (!fin && (Math.abs(c.cx - pcx) > KEEP_RADIUS || Math.abs(c.cz - pcz) > KEEP_RADIUS)) {
        // ya no hace falta: se abandona (aún no estaba en la escena)
        building.it.return();
        building = null; c.queued = false;
        continue;
      }
      if (building.it.next().done) { building = null; c.queued = false; built = true; }
      if (performance.now() - t0 >= limit) break;
    }
    flushRebuilds();
    if (built || rebuilt) showNear(pcx, pcz);
    G.WorldView.update(dt || 0, px, pz, chunks);
  }

  G.World = {
    openSky, sunlit,
    setBig(v) { BIG = !!v; },
    CHUNK_SALT,
    CS, E, F, O, WALL_H, DOOR_H, WIN_LO, WIN_HI, WALL_T, FENCE_H, FLOOR_H,
    get SPAWN() { return spawnPoint; },
    get layout() { return layout; },
    setLayout(name) {
      layout = name === 'refugio' || name === 'libre' || isMap(name) ? name : 'campo';
      const m = isMap(layout) ? G.Maps.get(layout) : null;
      AMIN = m ? m.min : FIELD_MIN; AMAX = m ? m.max : FIELD_MAX;
      BND = m && m.bounds ? m.bounds : null;
      spawnPoint = m ? { x: m.spawn.x, z: m.spawn.z } : { x: 16.5, z: 16.5 };
    },
    standTop, furnUnder, wallHAt, roofAt,
    setFree(v) { freeMode = !!v; },
    get fenceStyle() { return isMap(layout) ? (G.Maps.get(layout).fence || 'wood') : 'wood'; },
    get mapName() { return isMap(layout) ? G.Maps.get(layout).name : null; },
    get stations() { return REFUGE_STATIONS; },
    init, reset, update, chunkAt, hash, vnoise, SMALL, get ARENA_MIN() { return AMIN; }, get ARENA_MAX() { return AMAX; }, deckAt,
    ground, obj, eN, eW, bldAt, roomAt, isIndoor, groundY, solidObj, tallAt, terrainAt, baseAt, terrainBlocks, rawHeight,
    coverNear, coverAlong, stairAt, stairProgress, levelAt,
    furnAt, furnTile, furnNear, furnTop,
    edgeBetween, edgeRefBetween, edgeGet, setEdge, damageEdge, edgeKey, breakableEdge, outerEdge, breakWall, smashFurn,
    circleBlocked, move, lineBlocked, lineHit, coverHit, reach, hasLOS, get bounds() { return BND; }, hasClearLine, findPath, crossCost,
    blocksWalkEdge: B.blocksWalk, climbableEdge: B.climbable, blocksSightEdge: B.blocksSight,
    toggleLight, itemsNear, removeItem, dropItem, dropLoot, itemCond, doorLeaf, nearDoorLeaf,
    get spawnCrate() { return spawnCrate; },
    setSpawnCheck(fn) { owns = fn || (() => true); },
    hasGlass, clearGlass, edgeAt, shatter, breakWindowsAlong,
    onNoise(fn) { listeners.push(fn); },
    emit,
    forEachChunk(fn) { chunks.forEach(fn); },
    showAll,
    stats() {
      let built = 0;
      chunks.forEach((c) => { if (c.view) built++; });
      return { generated: chunks.size, built, seed: SEED };
    }
  };
})(window.Game = window.Game || {});
