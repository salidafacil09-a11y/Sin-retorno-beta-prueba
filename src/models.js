(function (G) {
  'use strict';

  // Personajes con esqueleto: cuerpo redondeado (esferas y cilindros) unido en
  // una sola malla con huesos, así cada personaje es una sola llamada de dibujo.
  // El modelo mira hacia +Z. Su izquierda es +X.

  const U = G.Util;

  // Huesos: [nombre, padre, posición relativa al padre]. 24 huesos: sin cara; los dedos de cada
  // mano van juntos en un hueso (para cerrar la mano o hacer garras).
  // Columna en tres tramos, clavículas para los hombros y dedos del pie para que ruede al pisar.
  const BONES = [
    ['hips', -1, [0, 0.95, 0]],
    ['spine', 0, [0, 0.12, 0]],                 // lumbar
    ['spine2', 1, [0, 0.13, 0]],                // dorsal
    ['chest', 2, [0, 0.13, 0]],                 // pecho
    ['neck', 3, [0, 0.2, 0]],
    ['head', 4, [0, 0.08, 0]],
    ['clavL', 3, [0.035, 0.09, 0]], ['armL', 6, [0.155, 0.02, 0]], ['foreL', 7, [0, -0.28, 0]], ['handL', 8, [0, -0.25, 0]],
    ['clavR', 3, [-0.035, 0.09, 0]], ['armR', 10, [-0.155, 0.02, 0]], ['foreR', 11, [0, -0.28, 0]], ['handR', 12, [0, -0.25, 0]],
    ['legL', 0, [0.1, -0.06, 0]], ['shinL', 14, [0, -0.42, 0]], ['footL', 15, [0, -0.4, 0]], ['toeL', 16, [0, -0.035, 0.1]],
    ['legR', 0, [-0.1, -0.06, 0]], ['shinR', 18, [0, -0.42, 0]], ['footR', 19, [0, -0.4, 0]], ['toeR', 20, [0, -0.035, 0.1]],
    // dedos (los cuatro juntos, como una manopla): para cerrar la mano sobre el arma o hacer garras
    ['fingL', 9, [0, -0.06, 0]], ['fingR', 13, [0, -0.06, 0]],
    // coleta (protagonista): de la goma en la nuca hacia abajo, en dos tramos que se mueven solos
    ['hairA', 5, [0, 0.055, -0.118]], ['hairB', 24, [0, -0.09, -0.02]]
  ];
  const BI = {};
  BONES.forEach((b, i) => { BI[b[0]] = i; });

  // Posición de cada hueso en reposo (en el espacio del modelo)
  const REST = [];
  BONES.forEach((b, i) => {
    const p = b[2];
    REST[i] = b[1] < 0 ? p.slice() : [REST[b[1]][0] + p[0], REST[b[1]][1] + p[1], REST[b[1]][2] + p[2]];
  });

  // Articulaciones: donde la piel se reparte entre el hueso padre (a) y el hijo (b).
  // axis va del padre hacia el hijo; r es el ancho de la zona de mezcla; lim, lo lejos del eje que afecta.
  const JOINTS = [];
  (function () {
    const J = (a, b, p, axis, r, lim) => {
      const l = Math.hypot(axis[0], axis[1], axis[2]);
      JOINTS.push({ a: BI[a], b: BI[b], p, ax: [axis[0] / l, axis[1] / l, axis[2] / l], r, lim });
    };
    const R = (n) => REST[BI[n]];
    J('hips', 'spine', [0, 1.0, 0], [0, 1, 0], 0.06, 0.3);
    J('spine', 'spine2', [0, 1.14, 0], [0, 1, 0], 0.06, 0.3);
    J('spine2', 'chest', [0, 1.26, 0], [0, 1, 0], 0.06, 0.3);
    J('chest', 'neck', [0, 1.49, 0], [0, 1, 0], 0.035, 0.09);
    J('neck', 'head', [0, 1.575, 0], [0, 1, 0], 0.03, 0.12);
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      J('chest', 'clav' + s, [0.11 * sg, 1.43, 0], [sg, 0, 0], 0.06, 0.1);
      J('clav' + s, 'arm' + s, R('arm' + s), [0, -1, 0], 0.06, 0.1);
      J('arm' + s, 'fore' + s, R('fore' + s), [0, -1, 0], 0.05, 0.1);
      J('fore' + s, 'hand' + s, R('hand' + s), [0, -1, 0], 0.03, 0.08);
      J('hand' + s, 'fing' + s, R('fing' + s), [0, -1, 0], 0.018, 0.06);
      J('hips', 'leg' + s, R('leg' + s), [0, -1, 0], 0.07, 0.085);
      J('leg' + s, 'shin' + s, R('shin' + s), [0, -1, 0], 0.05, 0.12);
      J('shin' + s, 'foot' + s, R('foot' + s), [0, -1, 0], 0.03, 0.1);
      J('foot' + s, 'toe' + s, R('toe' + s), [0, -0.33, 0.94], 0.035, 0.1);
    }
  })();

  // Reparte un vértice entre dos huesos según su distancia a la articulación más cercana
  function skinWeight(x, y, z, bone) {
    let best = null, bestT = Infinity;
    for (const j of JOINTS) {
      if (j.a !== bone && j.b !== bone) continue;
      const dx = x - j.p[0], dy = y - j.p[1], dz = z - j.p[2];
      const t = dx * j.ax[0] + dy * j.ax[1] + dz * j.ax[2];
      if (Math.abs(t) > j.r * 1.0001) continue;
      const lx = dx - t * j.ax[0], ly = dy - t * j.ax[1], lz = dz - t * j.ax[2];
      if (Math.hypot(lx, ly, lz) > j.lim) continue;
      if (Math.abs(t) < bestT) { bestT = Math.abs(t); best = { j, t }; }
    }
    if (!best) return null;
    const { j, t } = best;
    const wb = U.smooth((t + j.r) / (2 * j.r));
    return [j.a, 1 - wb, j.b, wb];
  }

  let matPlayer = null, matZombie = null, matWeapon = null;
  function mats() {
    if (!matPlayer) {
      matPlayer = new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true });
      matZombie = new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true });
      matWeapon = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
  }

  // ---------- Protagonista: cuerpo de superficies continuas ----------
  // Torso, cuello, brazos, mangas y piernas son superficies de una sola pieza hechas con secciones
  // (como los anillos de un tubo que cambia de forma), con normales suaves y pesos repartidos a lo
  // largo de la columna y de cada miembro. Así no quedan círculos ni cortes de piezas superpuestas.
  // Ropa: remera blanca gastada de manga corta, venda en el antebrazo izquierdo y en el codo derecho.

  // ruido suave en 3D (suciedad y desgaste de la ropa)
  function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), ux), l(c(0, 1, 0), c(1, 1, 0), ux), uy),
      l(l(c(0, 0, 1), c(1, 0, 1), ux), l(c(0, 1, 1), c(1, 1, 1), ux), uy), uz);
  }
  function fbm(x, y, z) {
    return vnoise(x, y, z) * 0.57 + vnoise(x * 2.07 + 5.1, y * 2.07, z * 2.07) * 0.29 + vnoise(x * 4.3, y * 4.3 + 2.3, z * 4.3) * 0.14;
  }

  // colores en espacio lineal (como los guarda el Mesher)
  const LC = (hex) => { const c = G.Mesher.lin(hex); return [c.r, c.g, c.b]; };
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mulC = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
  const sat = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);

  // interpolación suave de una tabla [v, ...valores] ordenada por v (spline cúbica de Hermite)
  function curve(T, v) {
    const n = T.length;
    if (v <= T[0][0]) return T[0].slice(1);
    if (v >= T[n - 1][0]) return T[n - 1].slice(1);
    let i = 0;
    while (v > T[i + 1][0]) i++;
    const a = T[Math.max(0, i - 1)], b = T[i], c = T[i + 1], d = T[Math.min(n - 1, i + 2)];
    const h = c[0] - b[0], t = (v - b[0]) / h, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const out = [];
    for (let k = 1; k < b.length; k++) {
      // tangentes de Catmull-Rom no uniformes, limitadas para no pasarse de los valores vecinos
      let m0 = (c[k] - a[k]) / Math.max(1e-6, c[0] - a[0]);
      let m1 = (d[k] - b[k]) / Math.max(1e-6, d[0] - b[0]);
      const sl = (c[k] - b[k]) / h;
      if (sl * m0 <= 0) m0 = 0; else m0 = Math.sign(m0) * Math.min(Math.abs(m0), 3 * Math.abs(sl));
      if (sl * m1 <= 0) m1 = 0; else m1 = Math.sign(m1) * Math.min(Math.abs(m1), 3 * Math.abs(sl));
      out.push(h00 * b[k] + h10 * h * m0 + h01 * c[k] + h11 * h * m1);
    }
    return out;
  }

  // Pesos a lo largo de una cadena de huesos. J: [[posición, huesoPadre, huesoHijo, ancho], ...]
  // ordenado por v creciente (de padre a hijo).
  function chainW(v, J) {
    for (const j of J) {
      if (v < j[0] - j[3]) return [[j[1], 1]];
      if (v <= j[0] + j[3]) {
        const t = U.smooth((v - j[0] + j[3]) / (2 * j[3]));
        return [[j[1], 1 - t], [j[2], t]];
      }
    }
    return [[J[J.length - 1][2], 1]];
  }
  function packW(list) {
    const acc = new Map();
    for (const [b, w] of list) if (w > 1e-4) acc.set(b, (acc.get(b) || 0) + w);
    const e = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const s = e.reduce((t, x) => t + x[1], 0) || 1;
    const out = [];
    for (const [b, w] of e) out.push(b, w / s);
    while (out.length < 8) out.push(0, 0);
    return out;
  }

  // Superficie de anillos: rings[j][i] = { p: [x, y, z], c: [r, g, b], w: pesos }.
  // Los anillos son cerrados; capA y capB (opcionales) cierran los extremos con un polo.
  function surface(m, rings, capA, capB) {
    const M = rings.length, N = rings[0].length;
    const P = (i, j) => rings[Math.max(0, Math.min(M - 1, j))][((i % N) + N) % N].p;
    // orientación: que las normales miren hacia afuera del anillo del medio
    const jm = M >> 1;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < N; i++) { const p = P(i, jm); cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= N; cy /= N; cz /= N;
    const nAt = (i, j) => {
      const a = P(i + 1, j), b = P(i - 1, j);
      const jn = j + 1 < M ? j + 1 : j, jp = j - 1 >= 0 ? j - 1 : j;
      let c = P(i, jn), d = P(i, jp);
      // en anillos de los extremos la diferencia se hace con el vecino (y el polo si lo hay)
      if (j === 0 && capA) d = capA.p;
      if (j === M - 1 && capB) c = capB.p;
      const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
      const vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
      return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    };
    let flip = false;
    { const n = nAt(0, jm), p = P(0, jm); flip = (n[0] * (p[0] - cx) + n[1] * (p[1] - cy) + n[2] * (p[2] - cz)) < 0; }
    const NR = [];
    for (let j = 0; j < M; j++) {
      const row = [];
      for (let i = 0; i < N; i++) {
        const n = nAt(i, j);
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        const f = flip ? -1 / l : 1 / l;
        row.push([n[0] * f, n[1] * f, n[2] * f]);
      }
      NR.push(row);
    }
    const V = (i, j) => { const r = rings[j][i % N]; m.vert(r.p, NR[j][i % N], r.c, r.w); };
    const T = (a, b, c) => { if (flip) { V(a[0], a[1]); V(c[0], c[1]); V(b[0], b[1]); } else { V(a[0], a[1]); V(b[0], b[1]); V(c[0], c[1]); } };
    for (let j = 0; j < M - 1; j++) {
      for (let i = 0; i < N; i++) {
        T([i, j], [i + 1, j], [i + 1, j + 1]);
        T([i, j], [i + 1, j + 1], [i, j + 1]);
      }
    }
    const cap = (cp, j, start) => {
      const ring = rings[j];
      let rx = 0, ry = 0, rz = 0;
      for (const r of ring) { rx += r.p[0]; ry += r.p[1]; rz += r.p[2]; }
      rx /= N; ry /= N; rz /= N;
      let nx = cp.p[0] - rx, ny = cp.p[1] - ry, nz = cp.p[2] - rz;
      const l = Math.hypot(nx, ny, nz) || 1;
      const pn = [nx / l, ny / l, nz / l];
      const pole = () => m.vert(cp.p, pn, cp.c, cp.w);
      for (let i = 0; i < N; i++) {
        const k = (i + 1) % N;
        const a = ring[i], b = ring[k];
        // mismo sentido que la tira de triángulos
        const ord = start !== flip;
        pole();
        if (ord) { m.vert(b.p, NR[j][k], b.c, b.w); m.vert(a.p, NR[j][i], a.c, a.w); }
        else { m.vert(a.p, NR[j][i], a.c, a.w); m.vert(b.p, NR[j][k], b.c, b.w); }
      }
    };
    if (capA) cap(capA, 0, true);
    if (capB) cap(capB, M - 1, false);
  }

  // [y, ancho, fondo delante, fondo detrás, desplazamiento z, forma (2 = elipse, más = más cuadrada)]
  const HERO_TT = [
    [0.955, 0.181, 0.12, 0.126, -0.003, 2.4],
    [1.0, 0.173, 0.116, 0.118, -0.002, 2.4],
    [1.06, 0.163, 0.111, 0.108, 0, 2.4],
    [1.12, 0.161, 0.113, 0.104, 0, 2.5],
    [1.18, 0.166, 0.119, 0.106, 0, 2.6],
    [1.24, 0.172, 0.126, 0.11, 0.002, 2.7],
    [1.3, 0.177, 0.129, 0.114, 0.003, 2.8],
    [1.35, 0.183, 0.123, 0.114, 0, 2.8],
    [1.395, 0.188, 0.108, 0.108, -0.006, 2.9],
    [1.425, 0.176, 0.09, 0.092, -0.01, 2.7],
    [1.45, 0.138, 0.075, 0.08, -0.01, 2.4],
    [1.47, 0.1, 0.068, 0.074, -0.009, 2.2],
    [1.485, 0.08, 0.066, 0.072, -0.008, 2.1]
  ];

  // Contorno del torso del protagonista en el plano vertical x (para que las correas de la mochila
  // se apoyen en la remera). Devuelve el frente y la espalda (z) a la altura y, o null si x queda fuera.
  function heroTorsoZ(x, y) {
    const [w, df, db, zc, n] = curve(ACTIVE_P.TT, y);
    const a = Math.abs(x) / w;
    if (a >= 1) return null;
    const k = Math.pow(1 - Math.pow(a, n), 1 / n);
    return { zf: zc + df * k + (ACTIVE_P.bust ? bustBump(x, y) : 0), zb: zc - db * k };
  }

  // ---------- Perfiles de cuerpo (hombre / mujer) ----------
  // Tablas de secciones: torso [y, ancho, fondo delante, fondo detrás, z, forma], cadera igual,
  // brazos y piernas [y, ancho, fondo, z], manga [y, ancho, fondo, z, corrimiento], cuello [y, radio, z]
  const PROF_M = {
    TT: HERO_TT,
    PT: [[0.85, 0.11, 0.07, 0.085, 0, 2.2], [0.88, 0.152, 0.088, 0.106, -0.004, 2.4], [0.925, 0.171, 0.094, 0.116, -0.006, 2.5],
      [0.97, 0.17, 0.098, 0.112, -0.003, 2.5], [1.02, 0.158, 0.098, 0.105, 0, 2.4], [1.05, 0.15, 0.096, 0.099, 0, 2.3]],
    AT: [[0.905, 0.027, 0.031, 0.004], [0.925, 0.029, 0.033, 0.003], [0.97, 0.034, 0.038, 0.001], [1.03, 0.04, 0.044, -0.001],
      [1.08, 0.044, 0.046, -0.002], [1.13, 0.042, 0.043, -0.004], [1.165, 0.04, 0.041, -0.006], [1.21, 0.042, 0.043, 0.0],
      [1.27, 0.046, 0.048, 0.005], [1.33, 0.049, 0.051, 0.006], [1.36, 0.05, 0.051, 0.002], [1.39, 0.046, 0.047, 0.0],
      [1.415, 0.038, 0.039, 0.0], [1.432, 0.026, 0.027, 0.0]],
    ST: [[1.27, 0.0555, 0.057, 0.004, 0], [1.32, 0.056, 0.0575, 0.004, 0], [1.37, 0.0565, 0.058, 0.002, 0.002],
      [1.405, 0.055, 0.056, 0.0, 0.006], [1.428, 0.05, 0.052, -0.002, 0.012], [1.445, 0.041, 0.044, -0.004, 0.019],
      [1.456, 0.026, 0.03, -0.006, 0.025]],
    LT: [[0.125, 0.047, 0.05, 0.0], [0.2, 0.051, 0.054, 0.0], [0.28, 0.057, 0.061, -0.006], [0.35, 0.061, 0.066, -0.01],
      [0.42, 0.06, 0.062, -0.004], [0.48, 0.061, 0.063, 0.006], [0.55, 0.064, 0.066, 0.004], [0.64, 0.072, 0.074, 0.004],
      [0.75, 0.081, 0.082, 0.006], [0.85, 0.087, 0.09, 0.006], [0.93, 0.084, 0.09, 0.002], [0.99, 0.068, 0.076, 0.0]],
    NT: [[1.43, 0.056, -0.006], [1.47, 0.054, -0.004], [1.52, 0.05, 0.0], [1.57, 0.047, 0.006], [1.62, 0.044, 0.01]],
    AX: 0.19, collar: 1, bust: 0, sleeveBot: 1.264, strapX: 0.098, hand: 1
  };
  // Mujer: hombros y cintura más estrechos, caderas y muslos algo más anchos, brazos y cuello más finos,
  // pecho (la remera ajustada cae sobre él), manga corta un poco más corta
  const PROF_F = {
    TT: [[0.955, 0.183, 0.108, 0.128, -0.006, 2.4], [1.0, 0.162, 0.102, 0.114, -0.004, 2.4], [1.06, 0.14, 0.096, 0.099, 0, 2.4],
      [1.12, 0.141, 0.099, 0.095, 0.001, 2.5], [1.18, 0.148, 0.106, 0.097, 0.002, 2.6], [1.24, 0.155, 0.11, 0.101, 0.003, 2.6],
      [1.3, 0.16, 0.11, 0.104, 0.003, 2.7], [1.35, 0.164, 0.105, 0.104, 0, 2.8], [1.395, 0.171, 0.096, 0.098, -0.005, 2.8],
      [1.425, 0.159, 0.083, 0.086, -0.009, 2.6], [1.45, 0.122, 0.07, 0.075, -0.009, 2.4], [1.47, 0.09, 0.062, 0.067, -0.008, 2.2],
      [1.485, 0.073, 0.059, 0.063, -0.007, 2.1]],
    PT: [[0.85, 0.115, 0.07, 0.088, 0, 2.2], [0.88, 0.16, 0.088, 0.112, -0.006, 2.4], [0.925, 0.178, 0.094, 0.124, -0.008, 2.5],
      [0.97, 0.168, 0.094, 0.114, -0.005, 2.5], [1.02, 0.145, 0.092, 0.102, -0.002, 2.4], [1.05, 0.135, 0.09, 0.096, 0, 2.3]],
    AT: [[0.905, 0.024, 0.027, 0.004], [0.925, 0.025, 0.029, 0.003], [0.97, 0.03, 0.033, 0.001], [1.03, 0.035, 0.038, -0.001],
      [1.08, 0.038, 0.039, -0.002], [1.13, 0.036, 0.037, -0.004], [1.165, 0.034, 0.035, -0.006], [1.21, 0.036, 0.037, 0.0],
      [1.27, 0.04, 0.041, 0.004], [1.33, 0.042, 0.043, 0.005], [1.36, 0.042, 0.043, 0.002], [1.388, 0.038, 0.039, 0.0],
      [1.408, 0.03, 0.031, 0.0], [1.42, 0.019, 0.02, 0.0]],
    ST: [[1.29, 0.049, 0.05, 0.004, 0], [1.33, 0.0495, 0.0505, 0.004, 0], [1.37, 0.0495, 0.0505, 0.002, 0.003],
      [1.4, 0.0465, 0.048, 0.0, 0.008], [1.418, 0.04, 0.042, -0.002, 0.014], [1.432, 0.03, 0.033, -0.004, 0.02],
      [1.441, 0.019, 0.022, -0.006, 0.025]],
    LT: [[0.125, 0.043, 0.046, 0.0], [0.2, 0.046, 0.049, 0.0], [0.28, 0.051, 0.056, -0.006], [0.35, 0.055, 0.061, -0.01],
      [0.42, 0.053, 0.056, -0.004], [0.48, 0.053, 0.056, 0.005], [0.55, 0.057, 0.06, 0.004], [0.64, 0.066, 0.068, 0.004],
      [0.75, 0.076, 0.078, 0.006], [0.85, 0.084, 0.088, 0.004], [0.93, 0.083, 0.09, 0.0], [0.99, 0.066, 0.075, 0.0]],
    NT: [[1.43, 0.048, -0.006], [1.47, 0.046, -0.004], [1.52, 0.042, 0.0], [1.57, 0.04, 0.006], [1.62, 0.038, 0.01]],
    AX: 0.178, collar: 0.9, bust: 1, sleeveBot: 1.284, strapX: 0.088, hand: 0.88
  };
  let ACTIVE_P = PROF_M;          // perfil del protagonista (para las correas de la mochila)
  const g2 = (d, s) => Math.exp(-(d * d) / (s * s));
  // pecho: la tela cae sobre él (solo hacia delante)
  function bustBump(x, y) {
    const ax = Math.abs(x);
    return 0.03 * g2(y - 1.262, 0.05) * (0.78 * g2(ax - 0.054, 0.04) + 0.22 * g2(x, 0.06));
  }

  // ---------- Cabeza de una pieza (protagonista e infectados) ----------
  // [y, ancho, fondo delante, fondo detrás, z del centro]
  const HEAD_T = [
    [1.552, 0.03, 0.026, 0.026, 0.056], [1.565, 0.048, 0.036, 0.046, 0.042], [1.58, 0.06, 0.05, 0.066, 0.026],
    [1.6, 0.069, 0.068, 0.083, 0.013], [1.625, 0.072, 0.086, 0.094, 0.006], [1.65, 0.076, 0.092, 0.101, 0.004],
    [1.68, 0.08, 0.094, 0.107, 0.002], [1.71, 0.082, 0.092, 0.11, 0], [1.74, 0.079, 0.086, 0.107, -0.004],
    [1.765, 0.067, 0.07, 0.093, -0.008], [1.785, 0.042, 0.042, 0.058, -0.01], [1.792, 0.024, 0.024, 0.032, -0.01]
  ];
  const HEAD_TOP = 1.798, HEAD_E = 2.2;
  // retoques de la cara (hacia fuera +, hacia dentro -)
  function faceShape(x, y) {
    const ax = Math.abs(x);
    let d = -0.0065 * g2(ax - 0.031, 0.016) * g2(y - 1.684, 0.011);   // cuencas de los ojos
    d += 0.0045 * g2(ax - 0.05, 0.02) * g2(y - 1.655, 0.016);         // pómulos
    d += 0.003 * g2(x, 0.012) * g2(y - 1.574, 0.01);                  // mentón
    d -= 0.002 * g2(x, 0.03) * g2(y - 1.592, 0.006);                  // surco bajo el labio
    return d;
  }
  function headSect(th, y) {
    const [rx, rzf, rzb, zc] = curve(HEAD_T, y);
    const c = Math.cos(th), s = Math.sin(th), e = 2 / HEAD_E;
    let x = rx * Math.sign(c) * Math.pow(Math.abs(c), e);
    let z = zc + (s > 0 ? rzf : rzb) * Math.sign(s) * Math.pow(Math.abs(s), e);
    if (s > 0) { const d = faceShape(x, y) * Math.pow(s, 1.2); x += c * d; z += s * d; }
    return [x, z, zc];
  }
  // z de la cara en (x, y), sin los retoques
  function headFront(x, y) {
    const [rx, rzf, , zc] = curve(HEAD_T, y);
    const a = Math.min(0.999, Math.abs(x) / rx);
    return zc + rzf * Math.pow(1 - Math.pow(a, HEAD_E), 1 / HEAD_E);
  }
  // línea del pelo: frente alta, sobre las orejas a los lados y baja en la nuca
  function hairLine(th) {
    const s = Math.sin(th);
    return s >= 0 ? 1.684 + 0.06 * Math.pow(s, 1.6) : 1.684 - 0.094 * Math.pow(-s, 1.1);
  }

  // Piezas giradas libremente (elipsoides y conos con base propia): para el hongo de los ciegos
  const _gm = new THREE.Matrix4(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3();
  const UGEO = {};
  function unitGeo(key, make) { if (!UGEO[key]) { const g = make(); UGEO[key] = g.index ? g.toNonIndexed() : g; } return UGEO[key]; }
  // elipsoide centrado en c con semiejes X, Y, Z (vectores ya escalados; base de mano derecha)
  function ellB(m, c, X, Y, Z, hex, det, bone) {
    _gm.makeBasis(_gx.fromArray(X), _gy.fromArray(Y), _gz.fromArray(Z)).setPosition(c[0], c[1], c[2]);
    m.add(unitGeo('ico' + det, () => new THREE.IcosahedronGeometry(1, det)), _gm, hex, bone);
  }
  // cono desde la base b en la dirección dir (unitaria), de largo len y radio r
  function spikeB(m, b, dir, len, r, hex, seg, bone) {
    const a = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let p1 = [dir[1] * a[2] - dir[2] * a[1], dir[2] * a[0] - dir[0] * a[2], dir[0] * a[1] - dir[1] * a[0]];
    const l = Math.hypot(p1[0], p1[1], p1[2]) || 1; p1 = p1.map((v) => v / l);
    const p2 = [p1[1] * dir[2] - p1[2] * dir[1], p1[2] * dir[0] - p1[0] * dir[2], p1[0] * dir[1] - p1[1] * dir[0]];
    _gm.makeBasis(_gx.fromArray(p1).multiplyScalar(r), _gy.fromArray(dir).multiplyScalar(len), _gz.fromArray(p2).multiplyScalar(r))
      .setPosition(b[0] + dir[0] * len / 2, b[1] + dir[1] * len / 2, b[2] + dir[2] * len / 2);
    m.add(unitGeo('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg)), _gm, hex, bone);
  }

  // Infectado ciego (diseño propio): una costra de hongo en repisas, como las de los troncos viejos, le tapa
  // los ojos y trepa por la frente hacia el lado izquierdo del cráneo; nódulos en la sien y la nuca, fibras
  // pálidas en la coronilla y raicillas que cuelgan bajo la costra. q: 1 cerca, 0 lejos, -1 muy lejos
  // Temblante: una cresta de bultos de esporas que baja de la coronilla por la nuca hasta la espalda, con
  // pústulas pálidas y carne viva, y dos costras grandes sobre los omóplatos. q: 1 cerca, 0 media distancia
  function tembGrowth(m, o, q) {
    const r = U.mulberry32(((o.seed || 11) % 100000) * 7 + 5);
    const COL = [0x6b5a3a, 0x7d6c45, 0x5a4a30, 0x8f7d52, 0x66603a], PUS = 0xc6b47e, RAW = 0x7a3b2c, DK = 0x3a2e1d;
    // [altura, z de la superficie de la espalda, ancho de la franja, tamaño]
    const ROW = [[1.775, -0.03, 0.05, 0.75], [1.745, -0.08, 0.07, 0.95], [1.69, -0.112, 0.08, 1.05], [1.62, -0.1, 0.07, 0.9],
      [1.55, -0.075, 0.07, 0.95], [1.47, -0.12, 0.13, 1.25], [1.39, -0.145, 0.16, 1.4], [1.31, -0.15, 0.15, 1.35],
      [1.22, -0.145, 0.13, 1.2], [1.13, -0.135, 0.11, 1.05], [1.05, -0.125, 0.08, 0.85]];
    const bone = (y) => y > 1.6 ? BI.head : (y > 1.49 ? BI.neck : (y > 1.27 ? BI.chest : (y > 1.14 ? BI.spine2 : BI.spine)));
    const per = q > 0 ? 4 : 2;
    for (const [y, z, w, s] of ROW) {
      for (let i = 0; i < per; i++) {
        const x = (r() - 0.5) * 2 * w * (i === 0 ? 0.25 : 1);
        const sz = (0.042 + r() * 0.04) * s;
        const zz = z - sz * 0.3, yy = y + (r() - 0.5) * 0.035;
        m.sphere(x, yy, zz, sz * (1 + r() * 0.3), sz * (0.8 + r() * 0.45), sz * (0.85 + r() * 0.55), COL[(r() * COL.length) | 0], q > 0 ? 2 : 1, bone(yy));
        if (q > 0 && r() < 0.55) {
          const ps = sz * (0.32 + r() * 0.22);
          m.sphere(x + (r() - 0.5) * sz, yy + sz * 0.35, zz - sz * 0.62, ps, ps * 0.9, ps, r() < 0.3 ? RAW : PUS, 1, bone(yy));
        }
      }
    }
    // costras grandes sobre los omóplatos y bultos en los hombros
    for (const sg of [1, -1]) {
      m.sphere(0.12 * sg, 1.37, -0.15, 0.12, 0.14, 0.075, DK, q > 0 ? 2 : 1, BI.chest);
      m.sphere(0.19 * sg, 1.45, -0.06, 0.08, 0.065, 0.08, COL[1], 1, BI[sg > 0 ? 'clavL' : 'clavR']);
      if (q > 0) m.sphere(0.16 * sg, 1.49, -0.09, 0.045, 0.045, 0.045, PUS, 1, BI[sg > 0 ? 'clavL' : 'clavR']);
    }
    // racimos asimétricos: el hombro y el brazo izquierdos engullidos, un costado de la barriga, el muslo
    // derecho y la mitad izquierda de la cabeza (le tapa el ojo); placas de costra oscura entre ellos
    const CL = [ // [x, y, z, radio de dispersión, cuántos, tamaño, hueso]
      [0.27, 1.38, 0.0, 0.07, 7, 1.15, 'armL'], [0.28, 1.25, 0.01, 0.055, 6, 1.0, 'armL'], [0.27, 1.05, 0.02, 0.05, 6, 0.9, 'foreL'],
      [0.08, 1.07, 0.15, 0.08, 7, 1.0, 'spine'], [0.16, 1.17, 0.1, 0.05, 4, 0.85, 'spine2'],
      [-0.2, 0.72, 0.04, 0.06, 6, 0.95, 'legR'], [-0.17, 0.58, 0.07, 0.045, 3, 0.8, 'legR'],
      [0.075, 1.71, 0.03, 0.045, 7, 0.9, 'head'], [0.06, 1.62, 0.07, 0.035, 4, 0.75, 'head'], [-0.24, 1.33, -0.02, 0.045, 3, 0.85, 'armR']
    ];
    for (const [cx, cy, cz, rr, n0, sz0, bn] of CL) {
      const n = q > 0 ? n0 : Math.ceil(n0 / 2);
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, b = (r() - 0.5) * 2;
        const x = cx + Math.cos(a) * rr * Math.sqrt(1 - b * b) * (cx > 0 ? 1 : -1) * 0.8 + (cx > 0 ? 0.015 : -0.015);
        const y = cy + b * rr, z = cz + Math.sin(a) * rr;
        const sz = (0.03 + r() * 0.035) * sz0;
        m.sphere(x, y, z, sz * (1 + r() * 0.3), sz * (0.85 + r() * 0.4), sz * (0.9 + r() * 0.4), r() < 0.18 ? DK : COL[(r() * COL.length) | 0], q > 0 ? 2 : 1, BI[bn]);
        if (q > 0 && r() < 0.35) { const ps = sz * 0.4; m.sphere(x + (cx > 0 ? sz * 0.5 : -sz * 0.5), y + sz * 0.3, z + sz * 0.2, ps, ps, ps, r() < 0.4 ? RAW : PUS, 1, BI[bn]); }
      }
    }
  }

  // Hongomorfo (diseño propio): todo el cuerpo cubierto de bultos de hongo color carne tostada, un racimo
  // enorme que le cuelga del costado y el muslo izquierdos, los brazos engullidos y la cabeza abierta de arriba
  // abajo en una corona de láminas, con una raja oscura en medio (por donde muerde). q: 1 cerca, 0 lejos, -1 muy lejos
  function bloatGrowth(m, o, q) {
    const r = U.mulberry32(((o.seed || 5) % 100000) * 11 + 9);
    const COL = [0xc98a5e, 0xb87650, 0xd9a274, 0xa86a44, 0xe0b080, 0xbf8058], DK = 0x6a3a26, RAW = 0x8a2a1c, PALE = 0xe8c8a0, GASH = 0x170705;
    const det = q > 0 ? 2 : (q === 0 ? 1 : 0);
    const pick = () => COL[(r() * COL.length) | 0];
    const lump = (x, y, z, s, bone, col) => m.sphere(x, y, z, s * (0.9 + r() * 0.3), s * (0.82 + r() * 0.3), s * (0.9 + r() * 0.3), col || pick(), det, bone);
    const bone = (y) => y > 1.6 ? BI.head : (y > 1.49 ? BI.neck : (y > 1.27 ? BI.chest : (y > 1.14 ? BI.spine2 : (y > 0.98 ? BI.spine : BI.hips))));
    const N = q > 0 ? 1 : (q === 0 ? 0.45 : 0.2);
    // torso: bultos por todas partes (más gordos en la barriga)
    for (let i = 0, n = Math.round(78 * N); i < n; i++) {
      const y = 0.9 + r() * 0.6, a = r() * Math.PI * 2;
      const belly = y < 1.2 && Math.cos(a) > 0.2;
      const x = Math.sin(a) * (0.27 + (belly ? 0.03 : 0)), z = Math.cos(a) * (0.19 + (belly ? 0.06 : 0));
      lump(x, y, z, 0.042 + r() * 0.05 + (belly ? 0.025 : 0), bone(y));
      if (q > 0 && r() < 0.25) m.sphere(x * 1.12, y + 0.02, z * 1.12, 0.015, 0.015, 0.015, r() < 0.4 ? RAW : PALE, 1, bone(y));
    }
    // racimo que cuelga del costado y el muslo izquierdos (como una bolsa de bultos)
    for (let i = 0, n = Math.round(26 * N); i < n; i++) {
      const y = 0.48 + r() * 0.55, x = 0.2 + r() * 0.12, z = 0.02 + r() * 0.16;
      lump(x, y, z, 0.05 + r() * 0.05, y > 0.9 ? BI.hips : BI.legL);
    }
    // brazos engullidos (el izquierdo más) y piernas
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      for (let i = 0, n = Math.round((sg > 0 ? 18 : 11) * N); i < n; i++) {
        const y = 0.95 + r() * 0.5, a = r() * Math.PI * 2;
        lump(0.19 * sg + Math.cos(a) * 0.07, y, Math.sin(a) * 0.07, 0.035 + r() * 0.035, BI[(y > 1.16 ? 'arm' : 'fore') + A]);
      }
      for (let i = 0, n = Math.round(8 * N); i < n; i++) {
        const y = 0.15 + r() * 0.75, a = r() * Math.PI * 2;
        lump(0.1 * sg + Math.cos(a) * 0.1, y, Math.sin(a) * 0.09, 0.035 + r() * 0.03, BI[(y > 0.48 ? 'leg' : 'shin') + A]);
      }
      // hombros: costras grandes
      m.sphere(0.2 * sg, 1.47, -0.02, 0.11, 0.08, 0.11, DK, det, BI['clav' + A]);
      lump(0.22 * sg, 1.52, 0.02, 0.07, BI['clav' + A]);
    }
    // cabeza: corona de láminas que se abre hacia arriba y a los lados; en medio, la raja
    const H = BI.head;
    m.sphere(0, 1.7, 0.0, 0.12, 0.13, 0.13, DK, det, H);
    for (let i = 0, n = Math.round(30 * N) + 6; i < n; i++) {
      const sg = i % 2 ? 1 : -1, k = r();
      const y = 1.6 + k * 0.36;
      const out = 0.035 + 0.05 * r() + k * 0.08;
      const x = sg * out, z = (r() - 0.5) * 0.18 - k * 0.03;
      const c = [x, y, z], up = [sg * (0.45 + k * 0.5), 1, (r() - 0.5) * 0.4], l = Math.hypot(up[0], up[1], up[2]);
      const Y = up.map((v) => v / l * (0.05 + r() * 0.05));
      const X = [0, 0, 1].map((v) => v * (0.045 + r() * 0.035));
      const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
      const zl = Math.hypot(Z[0], Z[1], Z[2]) || 1;
      ellB(m, c, X, Y, Z.map((v) => v / zl * (0.014 + r() * 0.012)), r() < 0.2 ? PALE : pick(), q > 0 ? 1 : 0, H);
    }
    // la raja y la carne viva alrededor
    m.sphere(0, 1.72, 0.1, 0.016, 0.15, 0.035, GASH, 1, H);
    m.sphere(0, 1.56, 0.1, 0.02, 0.05, 0.03, GASH, 1, BI.neck);
    for (const sg of [1, -1]) m.sphere(0.028 * sg, 1.7, 0.09, 0.014, 0.12, 0.025, RAW, 1, H);
    // fibras pálidas que salen de la corona
    if (q > 0) for (let i = 0; i < 14; i++) {
      const sg = r() < 0.5 ? 1 : -1, b = [sg * (0.05 + r() * 0.1), 1.86 + r() * 0.1, (r() - 0.5) * 0.12];
      const d = [sg * (0.3 + r() * 0.5), 1, (r() - 0.5) * 0.5], l = Math.hypot(d[0], d[1], d[2]);
      spikeB(m, b, d.map((v) => v / l), 0.06 + r() * 0.07, 0.004, PALE, 3, H);
    }
  }

  // Blindado (diseño propio): un acechador cubierto de placas de armadura biológica, negras y rojizas, con
  // bordes de carne viva; casco de placas con una rendija y una cresta de púas por la espalda
  function armorGrowth(m, o, q) {
    const r = U.mulberry32(((o.seed || 3) % 100000) * 17 + 1);
    const PL = [0x1d0e0c, 0x2a1310, 0x3a1612, 0x24100e, 0x4a1a14], RIM = 0x7e2618, RED = 0xc23a22;
    const det = q > 0 ? 2 : (q === 0 ? 1 : 0);
    const pick = () => PL[(r() * PL.length) | 0];
    const plate = (x, y, z, sx, sy, sz, bone, col) => m.sphere(x, y, z, sx, sy, sz, col || pick(), det, bone);
    const bone = (y) => y > 1.6 ? BI.head : (y > 1.49 ? BI.neck : (y > 1.27 ? BI.chest : (y > 1.14 ? BI.spine2 : (y > 0.98 ? BI.spine : BI.hips))));
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      plate(0.075 * sg, 1.34, 0.085, 0.088, 0.078, 0.036, BI.chest);          // pecho
      plate(0.085 * sg, 1.34, -0.085, 0.095, 0.095, 0.036, BI.chest);         // espalda
      plate(0.2 * sg, 1.45, 0.0, 0.078, 0.052, 0.08, BI['clav' + A]);         // hombreras
      if (q > 0) plate(0.21 * sg, 1.47, 0.0, 0.06, 0.03, 0.065, BI['clav' + A], RIM);
      plate(0.19 * sg, 1.3, 0.015, 0.05, 0.1, 0.05, BI['arm' + A]);           // brazo
      plate(0.19 * sg, 1.05, 0.012, 0.045, 0.1, 0.045, BI['fore' + A]);       // antebrazo
      plate(0.19 * sg, 0.87, 0.02, 0.034, 0.03, 0.03, BI['hand' + A]);        // nudillos
      plate(0.1 * sg, 0.74, 0.04, 0.078, 0.13, 0.06, BI['leg' + A]);          // muslo
      plate(0.1 * sg, 0.48, 0.055, 0.055, 0.05, 0.04, BI['shin' + A], RIM);   // rodilla
      plate(0.1 * sg, 0.3, 0.045, 0.05, 0.12, 0.04, BI['shin' + A]);          // espinilla
      plate(0.1 * sg, 0.08, 0.06, 0.05, 0.03, 0.08, BI['foot' + A]);
    }
    // vientre en segmentos (como un caparazón)
    for (let k = 0; k < 4; k++) {
      const y = 1.19 - k * 0.075;
      plate(0, y, 0.088, 0.12 - k * 0.006, 0.032, 0.03, bone(y), k % 2 ? RIM : pick());
      plate(0, y, -0.088, 0.13 - k * 0.006, 0.034, 0.03, bone(y));
    }
    // casco: placas sobre el cráneo, frontal con una rendija rojiza y mandíbula
    const H = BI.head;
    plate(0, 1.735, -0.012, 0.106, 0.088, 0.116, H);
    plate(0, 1.665, 0.072, 0.082, 0.058, 0.05, H);
    for (const sg of [1, -1]) plate(0.035 * sg, 1.692, 0.112, 0.02, 0.005, 0.008, H, RED);
    plate(0, 1.6, 0.05, 0.06, 0.03, 0.055, H, RIM);
    if (q > 0) for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.48; plate(Math.sin(a) * 0.1, 1.78, Math.cos(a) * 0.1 - 0.02, 0.04, 0.02, 0.04, H); }
    // cresta de púas por la columna
    if (q >= 0) for (let k = 0; k < 7; k++) {
      const y = 1.5 - k * 0.075;
      spikeB(m, [0, y, -0.115], [0, 0.35, -0.94], 0.05 + (k < 3 ? 0.03 : 0), 0.016, k % 2 ? RIM : 0x1a0b09, 4, bone(y));
    }
  }

  function blindGrowth(m, o, q) {
    const H = BI.head, r = U.mulberry32(((o.seed || 7) % 100000) * 13 + 3);
    const FUNG = [0x6b5a3a, 0x77663f, 0x5c4c31, 0x857350], RIM = 0xb8a477, DARKF = 0x382d1e, PALE = 0xb0a27c;
    const sq = (y) => 1.68 + (y - 1.68) * 0.94;          // la cabeza está aplastada un 6 % en vertical
    const surf = (th, y, out) => {
      const [x, z, zc] = headSect(th, y);
      const R = Math.hypot(x, z - zc) || 1, nx = x / R, nz = (z - zc) / R;
      return { p: [x + nx * out, sq(y), z + nz * out], nx, nz };
    };
    // fila 0 y 1 (la costra sobre los ojos, lo que más se ve): más detalle; las de arriba, menos
    const shelf = (th, y, w, d, t, a, col, fine) => {
      const s = surf(th, y, 0.002), nx = s.nx, nz = s.nz, ca = Math.cos(a), sa = Math.sin(a);
      const Zt = [nx * ca, -sa, nz * ca], Yt = [nx * sa, ca, nz * sa], T = [nz, 0, -nx];
      const c = [0, 1, 2].map((k) => s.p[k] + Zt[k] * d * 0.42);
      const sc = (v, f) => v.map((e) => e * f);
      ellB(m, c, sc(T, w), sc(Yt, t), sc(Zt, d), col, q > 0 ? (fine === 2 ? 2 : 1) : (q === 0 ? 1 : 0), H);
      if (q > 0) {
        // borde claro y sombra de las láminas por debajo
        if (fine) ellB(m, [0, 1, 2].map((k) => c[k] + Zt[k] * d * 0.5 - Yt[k] * t * 0.2), sc(T, w * 0.93), sc(Yt, t * 0.55), sc(Zt, d * 0.56), RIM, 1, H);
        ellB(m, [0, 1, 2].map((k) => c[k] - Yt[k] * t * 0.75), sc(T, w * 0.9), sc(Yt, t * 0.5), sc(Zt, d * 0.88), DARKF, 0, H);
      }
    };
    const F = Math.PI / 2;    // th = F es el centro de la cara; th < F va hacia su izquierda (x+)
    if (q < 0) {
      shelf(F - 0.15, 1.69, 0.1, 0.045, 0.026, 0.25, FUNG[0]);
      shelf(F - 0.9, 1.74, 0.09, 0.045, 0.03, 0.1, FUNG[2]);
      shelf(F - 2.0, 1.77, 0.08, 0.04, 0.03, 0.2, FUNG[1]);
      return;
    }
    const TIERS = [   // [y, desde, hasta, cuántas, tamaño]: cubre toda la parte alta, más cargada a la izquierda
      [1.674, -1.25, 0.95, 6, 1.45], [1.699, -1.45, 0.85, 6, 1.5], [1.724, -1.7, 0.7, 6, 1.55],
      [1.749, -1.9, 0.45, 5, 1.5], [1.772, -2.2, 0.1, 5, 1.45], [1.792, -2.6, -0.3, 4, 1.35], [1.81, -2.9, -1.2, 3, 1.2]
    ];
    TIERS.forEach(([y, a0, a1, n0, sz], ti) => {
      const n = q > 0 ? n0 : Math.max(1, Math.ceil(n0 / 2));
      for (let i = 0; i < n; i++) {
        const th = F + a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)) + (r() - 0.5) * 0.12;
        const w = (0.024 + r() * 0.011) * sz * (q > 0 ? 1 : 1.5), d = (0.017 + r() * 0.008) * sz * 1.15;
        shelf(th, y + (r() - 0.5) * 0.006, w, d, (0.0065 + r() * 0.0025) * 1.35, 0.12 + r() * 0.3 + ti * 0.04, FUNG[(r() * 4) | 0], ti === 0 ? 2 : (ti === 1 ? 1 : 0));
      }
    });
    // nódulos en la sien izquierda y la nuca
    for (let i = 0, n = q > 0 ? 12 : 5; i < n; i++) {
      const th = -0.7 + r() * 1.6, y = 1.64 + r() * 0.13, rad = 0.009 + r() * 0.015;
      const s = surf(th, y, rad * 0.35);
      m.sphere(s.p[0], s.p[1], s.p[2], rad, rad * 0.85, rad, FUNG[(r() * 4) | 0], q > 0 && i < 5 ? 1 : 0, H);
    }
    if (q <= 0) return;
    // fibras pálidas que salen de la coronilla, hacia arriba y afuera
    for (let i = 0; i < 7; i++) {
      const th = F - 1.55 + r() * 1.3, y = 1.742 + r() * 0.035;
      const s = surf(th, y, -0.002);
      let d = [s.nx * 0.65 + (r() - 0.5) * 0.3, 0.75 + r() * 0.2, s.nz * 0.65 + (r() - 0.5) * 0.3];
      const l = Math.hypot(d[0], d[1], d[2]); d = d.map((v) => v / l);
      spikeB(m, s.p, d, 0.028 + r() * 0.034, 0.0035 + r() * 0.003, PALE, 5, H);
    }
    // raicillas que cuelgan bajo la costra, sobre las mejillas
    for (let i = 0; i < 7; i++) {
      const th = F - 0.95 + r() * 1.6, s = surf(th, 1.668, 0.006);
      const d = [s.nx * 0.25, -1, s.nz * 0.25], l = Math.hypot(d[0], d[1], d[2]);
      spikeB(m, s.p, d.map((v) => v / l), 0.016 + r() * 0.022, 0.0028 + r() * 0.002, i % 2 ? DARKF : 0x4c3f2a, 4, H);
    }
  }

  // Cabeza facetada (o.facet): estilo low poly de caras planas. Pocas caras grandes (frente, pómulos, mandíbula
  // en cuña), rasgos hechos de placas (cejas, ojos, labios) y el pelo en fragmentos angulosos. Las normales
  // por cara las pone facetRange (después de aplastar la cabeza), así cada cara queda de un solo tono
  function facetHead(m, o, q) {
    const H = BI.head, WH = packW([[H, 1]]), SKIN = LC(o.skin);
    const slimK = (y) => (o.slim ? 1 - 0.075 * sat((1.672 - y) / 0.08) : 1);
    // ---- casco de la cabeza: 10 lados y 8 anillos; la mandíbula se estrecha en cuña hacia la barbilla
    {
      const N = q ? 10 : 8, ys = q ? [1.552, 1.578, 1.607, 1.64, 1.672, 1.705, 1.74, 1.772, 1.792] : [1.552, 1.6, 1.66, 1.72, 1.78];
      const rings = [];
      for (const y of ys) {
        const r = [];
        const wedge = 1 - 0.22 * sat((1.62 - y) / 0.07);                 // mentón en punta
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2 + Math.PI / N * 0.5;
          let [x, z] = headSect(th, y);
          x *= slimK(y) * (Math.sin(th) > 0 ? wedge : 1);
          const sh = y < 1.585 && z < 0.05 ? 0.88 : 1;
          r.push({ p: [x, y, z], c: mulC(SKIN, sh), w: WH });
        }
        rings.push(r);
      }
      surface(m, rings, { p: [0, 1.547, 0.05], c: mulC(SKIN, 0.82), w: WH }, { p: [0, HEAD_TOP, -0.01], c: SKIN, w: WH });
    }
    const zf = headFront, dark = (c, f) => U.shade(c, f);
    // ---- orejas: cuñas
    for (const sg of [1, -1]) m.sphere(0.079 * sg, 1.664, -0.004, 0.012, 0.024, 0.017, dark(o.skin, 0.9), 0, H);
    // ---- pelo: casquete bajo (sin huecos) y encima fragmentos angulosos con volumen (melena afro)
    if (o.hair != null) {
      const N = q ? 10 : 8, M = 3, rings = [];
      for (let k = 0; k <= M; k++) {
        const v = (k / M) * 0.96, r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2 + Math.PI / N * 0.5;
          const y0 = hairLine(th), y = y0 + (HEAD_TOP - y0) * v;
          let [x, z, zc] = headSect(th, y);
          x *= slimK(y);
          const R = Math.hypot(x, z - zc) || 1, t = 0.004 + 0.008 * v;
          r.push({ p: [x + x / R * t, y + t * 0.5, z + (z - zc) / R * t], c: LC(dark(o.hair, 0.8 + 0.25 * v)), w: WH });
        }
        rings.push(r);
      }
      surface(m, rings, null, { p: [0, HEAD_TOP + 0.012, -0.012], c: LC(o.hair), w: WH });
      if (o.curls) {
        const rnd = U.mulberry32(7741), C0 = [0, 1.676, -0.012], E = [0.088, 0.122, 0.104];
        const NC = q ? 78 : 26;
        for (let k = 0, made = 0; made < NC && k < NC * 6; k++) {
          const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, rr2 = Math.sqrt(1 - u * u);
          const dx = rr2 * Math.cos(ph), dy = u, dz = rr2 * Math.sin(ph);
          if (dy < -0.7) continue;
          if (dz > 0.15 && dy < 0.52 - 0.35 * Math.abs(dx)) continue;   // la cara despejada
          if (dz > -0.1 && dy < -0.3) continue;
          made++;
          const vol = 1.04 + rnd() * 0.12 + 0.12 * U.smooth(sat((0.55 - dy) / 0.6));
          const side = 1 + 0.28 * Math.max(0, Math.min(1, (0.45 - dy) / 0.6)) * (1 - Math.max(0, dz));
          const c = [C0[0] + dx * E[0] * vol * side, C0[1] + dy * E[1] * vol * (dy > 0 ? 0.92 : 1.05), C0[2] + dz * E[2] * vol * (dz < 0 ? side * 0.95 : 1)];
          // fragmento: un poliedro de 20 caras estirado hacia afuera y girado al azar
          const n = [dx, dy * 0.8, dz], nl = Math.hypot(n[0], n[1], n[2]) || 1;
          const Y = n.map((v) => v / nl);
          let X = [Y[1], -Y[0], 0.3 * (rnd() - 0.5)]; const xl = Math.hypot(X[0], X[1], X[2]) || 1; X = X.map((v) => v / xl);
          const Zv = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
          const sz = (q ? 0.032 : 0.045) + rnd() * 0.014;
          const shc = 0.72 + rnd() * 0.5 + (dy > 0.4 ? 0.15 : 0);
          ellB(m, c, X.map((v) => v * sz * 1.05), Y.map((v) => v * sz * 0.8), Zv.map((v) => v * sz * 0.95), dark(o.hair, shc), 0, H);
        }
      }
    }
    if (!q) return;
    // ---- rasgos en placas: cejas gruesas en cuña, ojos (blanco y pupila), nariz, labios
    for (const sg of [1, -1]) {
      const x = 0.031 * sg, y = 1.684, z = zf(x, y);
      m.box(x, y, z - 0.002, 0.024, 0.011, 0.006, 0xe8e0d2, 0, H, 0, -0.06 * sg);                      // blanco del ojo
      m.box(x * 0.94, y - 0.0005, z + 0.0012, 0.011, 0.011, 0.004, 0x1a120d, 0, H);                   // pupila
      m.box(x * 0.94 + 0.0028 * sg, y + 0.0022, z + 0.0033, 0.0032, 0.0032, 0.002, 0xf4efe6, 0, H);  // brillo
      m.box(x, y + 0.0058, z + 0.0005, 0.025, 0.0032, 0.0065, 0x1a120d, 0, H, 0, -0.06 * sg);        // párpado
      const by = 1.7025, bz = zf(x * 1.05, by);
      m.box(x * 1.05, by, bz + 0.001, 0.03, 0.0072, 0.007, o.brow || dark(o.hair || 0x2a1a12, 1.2), 0, H, 0, -0.1 * sg);   // ceja
    }
    m.sphere(0, 1.662, zf(0, 1.662) + 0.004, 0.0085, 0.019, 0.011, dark(o.skin, 0.95), 0, H);          // nariz
    m.sphere(0, 1.6475, zf(0, 1.6475) + 0.0085, 0.011, 0.007, 0.009, dark(o.skin, 0.88), 0, H);
    const lip = o.lips || 0xa86a62;
    m.box(0, 1.6175, zf(0, 1.6175) + 0.001, 0.036, 0.0065, 0.008, lip, 0, H);                          // labio de arriba
    m.box(0, 1.609, zf(0, 1.609) + 0.0012, 0.03, 0.008, 0.008, dark(lip, 1.08), 0, H);                 // labio de abajo
    m.box(0, 1.6135, zf(0, 1.6135) + 0.0035, 0.032, 0.0018, 0.004, dark(lip, 0.55), 0, H);             // línea de la boca
  }
  // Caras planas: cada triángulo del tramo [v0, v1) toma la normal de su cara y un color medio (un solo tono)
  function facetRange(m, v0, v1) {
    const P = m.pos, Nn = m.nor, Cc = m.col;
    for (let t = v0; t + 2 < v1; t += 3) {
      const a = t * 3, b = a + 3, c = a + 6;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      // misma orientación que las normales que ya tenía (hacia afuera)
      if (nx * (Nn[a] + Nn[b] + Nn[c]) + ny * (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) + nz * (Nn[a + 2] + Nn[b + 2] + Nn[c + 2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      for (const k of [a, b, c]) { Nn[k] = nx / l; Nn[k + 1] = ny / l; Nn[k + 2] = nz / l; }
      for (let j = 0; j < 3; j++) { const avg = (Cc[a + j] + Cc[b + j] + Cc[c + j]) / 3; Cc[a + j] = Cc[b + j] = Cc[c + j] = avg; }
    }
  }

  // Cabeza, pelo (con coleta trenzada si o.braid) y cara
  function heroHead(m, o, q) {
    const Z = !!o.zombie, H = BI.head;
    if (o.facet && !o.zombie) return facetHead(m, o, q);
    const WH = packW([[H, 1]]);
    const SKIN = LC(o.skin);
    const sd = Z ? ((o.seed || 1) % 97) * 3.17 + 11 : 0;
    const ZBLOOD = LC(0x431510), BRUISE = LC(0x5b5263);
    // rostro afinado (o.slim): mandíbula y mejillas más estrechas
    const slimK = (y) => (o.slim ? 1 - 0.075 * sat((1.672 - y) / 0.08) : 1);
    const skinCol = (x, y, z) => {
      let c = mulC(SKIN, 0.95 + 0.08 * fbm(x * 30 + sd, y * 30, z * 30));
      if (Z) {
        c = mixC(c, BRUISE, sat((fbm(x * 14 + sd, y * 14, z * 14) - 0.5) * 2) * 0.55);
        // ojeras hundidas y sangre alrededor de la boca y la barbilla
        c = mulC(c, 1 - 0.3 * g2(Math.abs(x) - 0.031, 0.02) * g2(y - 1.682, 0.016) * sat(z * 20));
        c = mixC(c, ZBLOOD, sat(g2(x, 0.03) * g2(y - 1.595, 0.03) * sat(z * 25) * 1.4 * (0.4 + fbm(x * 40, y * 40 + sd, z * 40))));
        return c;
      }
      // mejillas con algo de color, cuencas algo más oscuras, sombra bajo la mandíbula
      c = mixC(c, LC(0xd08a78), 0.22 * g2(Math.abs(x) - 0.048, 0.022) * g2(y - 1.645, 0.02) * sat(z * 20));
      c = mulC(c, 1 - 0.08 * g2(Math.abs(x) - 0.031, 0.018) * g2(y - 1.684, 0.012) * sat(z * 20));
      if (y < 1.585 && z < 0.05) c = mulC(c, 0.9);
      // piel de anciana (o.old): arrugas en la frente, patas de gallo, surcos junto a la nariz y alguna mancha
      if (o.old && z > 0) {
        const ax = Math.abs(x);
        let w = 0;
        for (const yy of [1.716, 1.729, 1.742]) w += 0.2 * g2(y - yy - 0.004 * Math.cos(x * 40), 0.0022) * sat((0.05 - ax) / 0.02 + 0.6);
        w += 0.22 * g2(ax - 0.057 - (y - 1.686) * 0.3, 0.0025) * g2(y - 1.686, 0.012);              // patas de gallo
        w += 0.28 * g2(ax - 0.019 - (1.655 - y) * 0.42, 0.003) * sat((1.66 - y) / 0.01) * sat((y - 1.6) / 0.012);   // surcos
        w += 0.12 * g2(y - 1.674, 0.004) * g2(ax - 0.031, 0.012);                                     // bolsas bajo los ojos
        c = mulC(c, 1 - w);
        const sp = fbm(x * 70 + 3, y * 70, z * 70);
        if (sp > 0.7) c = mixC(c, LC(0x9a6a4a), (sp - 0.7) * 1.5);
      }
      // barba de unos días: mandíbula, barbilla y bigote (sin tocar los labios)
      if (o.beard != null) {
        const lip = g2(Math.abs(x) * 0.6, 0.02) * g2(y - 1.613, 0.007);
        const k = sat((1.64 - y) / 0.025) * sat((y - 1.548) / 0.01) * sat((z + 0.01) * 18) * (1 - lip) * (0.7 + 0.3 * fbm(x * 90, y * 90, z * 90));
        c = mixC(c, LC(o.beard), 0.55 * k);
      }
      return c;
    };
    // ---- cabeza
    {
      const N = q ? (o.hiRes ? 56 : 32) : 12, rings = [];
      const ys = [];
      const st = q ? (o.hiRes ? 0.0055 : 0.0085) : 0.024;
      for (let y = 1.552; y < 1.79; y += st) ys.push(y);
      ys.push(1.792);
      for (const y of ys) {
        const r = [];
        for (let i = 0; i < N; i++) {
          let [x, z] = headSect((i / N) * Math.PI * 2, y);
          x *= slimK(y);
          r.push({ p: [x, y, z], c: skinCol(x, y, z), w: WH });
        }
        rings.push(r);
      }
      surface(m, rings, { p: [0, 1.547, 0.055], c: mulC(SKIN, 0.85), w: WH }, { p: [0, HEAD_TOP, -0.01], c: SKIN, w: WH });
    }
    // ---- pelo: casquete peinado hacia atrás (los mechones van hacia la coleta) o pelo revuelto de infectado
    if (o.hair != null) {
      const HAIR = LC(o.hair), HL = mulC(HAIR, 1.55);
      const hairCol = (x, y, z, v) => {
        // vetas que salen de la frente y convergen en la coleta (atrás, a la altura de la nuca)
        const phi = Math.atan2(y - 1.665, x);
        let c = mulC(HAIR, 0.74 + 0.36 * vnoise(phi * 7 + 3, v * 1.5, 0.5) + 0.1 * vnoise(phi * 23, v * 4, 2.5));
        c = mixC(c, HL, 0.35 * U.smooth(sat((y - 1.74) / 0.05)) * sat(0.5 + z * 6));        // brillo arriba
        if (Z) {
          if (fbm(x * 30 + sd, y * 30, z * 30) > 0.64) return mulC(skinCol(x, y, z), 0.9);   // calvas y mechones arrancados
          c = mixC(c, LC(0x3a3226), 0.3);
        }
        // rapado a los costados y la nuca (o.buzz), más largo arriba: abajo se ve la piel entre el pelo corto
        if (o.buzz) c = mixC(c, mulC(skinCol(x, y, z), 0.92), 0.8 * U.smooth(sat((1.75 - y) / 0.04)) * (0.8 + 0.2 * fbm(x * 90, y * 90, z * 90)));
        return c;
      };
      const N = q ? (o.hiRes ? 48 : 32) : 12, M = q ? (o.hiRes ? 16 : 12) : 4, rings = [];
      for (let k = 0; k <= M; k++) {
        const v = (k / M) * 0.965;
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          const y0 = hairLine(th), y = y0 + (HEAD_TOP - y0) * v;
          let [x, z, zc] = headSect(th, y);
          x *= slimK(y);
          const phi0 = Math.atan2(y - 1.665, x);
          let t = (Z ? 0.004 : 0.0032) + (Z ? 0.012 : 0.0085) * sat(v * 3.5) + 0.0028 * sat(v * 4) * (vnoise(phi0 * 8 + 1.5, 0.5, 0.5) - 0.35);
          if (o.buzz) t = 0.0018 + 0.0105 * U.smooth(sat((y - 1.735) / 0.04));                       // rapado: pegado abajo, volumen arriba
          if (o.mane) t += 0.006 * sat(v * 3) + 0.004 * vnoise(phi0 * 5, v * 3, 4.5);                   // pelo blanco revuelto
          const R = Math.hypot(x, z - zc) || 1;
          x += x / R * t; z += (z - zc) / R * t;
          const yy = y + t * 0.6 * v + (Z && k === 0 ? (vnoise(i * 0.9, sd, 1) - 0.5) * 0.03 : 0);
          r.push({ p: [x, yy, z], c: hairCol(x, yy, z, v), w: WH });
        }
        rings.push(r);
      }
      surface(m, rings, null, { p: [0, HEAD_TOP + 0.0105, -0.012], c: hairCol(0, HEAD_TOP, -0.01, 1), w: WH });

      if (o.braid) {
        // ---- coleta trenzada corta: cuelga de la goma en la nuca y se mueve sola (huesos hairA y hairB)
        // (o.ponytail: coleta lisa y más larga, hasta media espalda)
        const P = o.ponytail ? [[0, 1.69, -0.112], [0, 1.66, -0.135], [0, 1.6, -0.152], [0, 1.535, -0.16], [0, 1.47, -0.158], [0, 1.41, -0.15], [0, 1.37, -0.14]]
          : [[0, 1.668, -0.113], [0, 1.642, -0.128], [0, 1.603, -0.138], [0, 1.565, -0.141], [0, 1.53, -0.136], [0, 1.508, -0.128]];
        const at = (s) => {
          const f = s * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), u = f - i;
          const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
          const out = [];
          for (let k = 0; k < 3; k++) {
            const m0 = (c[k] - a[k]) / 2, m1 = (d[k] - b[k]) / 2, u2 = u * u, u3 = u2 * u;
            out.push((2 * u3 - 3 * u2 + 1) * b[k] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * c[k] + (u3 - u2) * m1);
          }
          return out;
        };
        const NB = q ? 10 : 6, SB = q ? 30 : 8, rings2 = [];
        const wOf = (s) => { const k = U.smooth(sat((s - 0.3) / 0.35)); return packW([[BI.hairA, 1 - k], [BI.hairB, k]]); };
        for (let k = 0; k <= SB; k++) {
          const s = k / SB;
          const C = at(s), C2 = at(Math.min(1, s + 0.01)), C1 = at(Math.max(0, s - 0.01));
          let tx = C2[0] - C1[0], ty = C2[1] - C1[1], tz = C2[2] - C1[2];
          const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
          // marco: B = eje x, N = T x B
          let nx = 0, ny = tz, nz = -ty;
          const nl = Math.hypot(ny, nz) || 1; ny /= nl; nz /= nl;
          const wave = o.ponytail ? 0 : Math.sin(s * Math.PI * 9);
          const r0 = o.ponytail ? (s < 0.05 ? 0.024 : U.lerp(0.024, 0.006, Math.pow(s, 1.3))) * (1 + 0.15 * Math.sin(s * Math.PI))
            : (s < 0.05 ? 0.022 : U.lerp(0.0175, 0.0075, s)) * (0.8 + 0.2 * Math.abs(wave));
          const cxw = 0.0035 * wave * (s > 0.06 ? 1 : 0);
          const r = [];
          for (let i = 0; i < NB; i++) {
            const ph = (i / NB) * Math.PI * 2;
            const x = C[0] + cxw + Math.cos(ph) * r0, y = C[1] + Math.sin(ph) * r0 * ny, z = C[2] + Math.sin(ph) * r0 * nz;
            const sh = o.ponytail ? 0.8 + 0.2 * Math.abs(Math.cos(ph * 3 + s * 4)) : 0.72 + 0.28 * Math.abs(Math.cos(s * Math.PI * 9 + ph));
            r.push({ p: [x, y, z], c: mulC(hairCol(x, y, z, 0.6), sh), w: wOf(s) });
          }
          rings2.push(r);
        }
        const e0 = at(0), e1 = at(1);
        surface(m, rings2, { p: [e0[0], e0[1] + 0.006, e0[2] + 0.004], c: HAIR, w: wOf(0) }, { p: [e1[0], e1[1] - 0.012, e1[2] + 0.003], c: mulC(HAIR, 0.8), w: wOf(1) });
        // goma del pelo
        if (o.ponytail) m.cyl(0, 1.684, -0.116, 0.0225, 0.0225, 0.013, 0x0c0b0b, q ? 12 : 6, BI.hairA, 0.5);
        else m.cyl(0, 1.66, -0.116, 0.0205, 0.0205, 0.011, 0x1c1714, q ? 12 : 6, BI.hairA, 0.35);
        // mechones sueltos junto a las sienes
        if (q) {
          for (const sg of [1, -1]) {
            const SP = [[0.062 * sg, 1.742, 0.058], [0.074 * sg, 1.718, 0.062], [0.0805 * sg, 1.69, 0.058], [0.0815 * sg, 1.668, 0.05]];
            const rs = [];
            for (let k = 0; k <= 8; k++) {
              const s = k / 8, f = s * 3, i = Math.min(2, Math.floor(f)), u = f - i;
              const C = [0, 1, 2].map((j) => SP[i][j] + (SP[i + 1][j] - SP[i][j]) * u);
              const rr = U.lerp(0.0075, 0.0025, s);
              const r = [];
              for (let j = 0; j < 6; j++) {
                const ph = (j / 6) * Math.PI * 2;
                r.push({ p: [C[0] + Math.cos(ph) * rr, C[1], C[2] + Math.sin(ph) * rr], c: hairCol(C[0], C[1], C[2], 0.3), w: WH });
              }
              rs.push(r);
            }
            surface(m, rs, null, { p: [SP[3][0], SP[3][1] - 0.006, SP[3][2]], c: HAIR, w: WH });
          }
        }
      }
    }
    // ---- pelo rizado con volumen (o.curls): cientos de rizos pequeños sobre el casquete, hasta la mandíbula,
    // dejando la cara despejada (melena corta afro, como la de Di' Arco)
    if (o.curls && o.hair != null && !Z) {
      const rnd = U.mulberry32(7741), C0 = [0, 1.676, -0.012], E = [0.088, 0.122, 0.104];
      const NC = q ? 420 : 110;
      for (let k = 0; k < NC; k++) {
        // dirección al azar (uniforme en la esfera)
        const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, rr2 = Math.sqrt(1 - u * u);
        const dx = rr2 * Math.cos(ph), dy = u, dz = rr2 * Math.sin(ph);
        if (dy < -0.78) continue;                                      // bajo la barbilla
        if (dz > 0.2 && dy < 0.5 - 0.35 * Math.abs(dx)) continue;      // la cara
        if (dz > -0.1 && dy < -0.35) continue;                         // mandíbula y cuello por delante
        // melena corta: poco volumen arriba, más a los lados y atrás, hasta la altura de la mandíbula
        const vol = 1.02 + rnd() * 0.22 + 0.14 * U.smooth(sat((0.55 - dy) / 0.6)) - (dy > 0.8 ? 0.04 : 0);
        const side = 1 + 0.32 * Math.max(0, Math.min(1, (0.45 - dy) / 0.6)) * (1 - Math.max(0, dz));
        const px = C0[0] + dx * E[0] * vol * side, py = C0[1] + dy * E[1] * vol * (dy > 0 ? 0.92 : 1.05), pz = C0[2] + dz * E[2] * vol * (dz < 0 ? side * 0.95 : 1);
        const sz = (q ? 0.017 + rnd() * 0.013 : 0.03 + rnd() * 0.012);
        const sh = 0.7 + rnd() * 0.55 + (dy > 0.4 ? 0.15 : 0);
        m.sphere(px, py, pz, sz, sz * (0.85 + rnd() * 0.3), sz, U.shade(o.hair, sh), q ? 1 : 0, H);
      }
    }
    // ---- melena blanca revuelta (o.mane): mechones gruesos y desordenados que caen por los costados y la nuca
    // hasta el cuello, despejando la cara (la señora Paula)
    if (o.mane && o.hair != null && !Z) {
      const rnd = U.mulberry32(5521), NC = q ? 190 : 40;
      for (let k = 0; k < NC; k++) {
        const th = Math.PI * (0.98 + rnd() * 1.04) + (rnd() < 0.5 ? 0 : 0);   // de un costado al otro por detrás
        const s2 = Math.sin(th), c2 = Math.cos(th);
        if (s2 > 0.15) continue;                                                // nada delante de la cara
        const len = 0.03 + rnd() * 0.035, y = 1.575 + rnd() * (1.725 - 1.575 - len * 0.8);
        const [hx, hz, zc] = headSect(th, Math.max(1.6, Math.min(1.75, y)));
        const R = Math.hypot(hx, hz - zc) || 1;
        const out = 0.006 + rnd() * 0.008 + (y < 1.62 ? 0.006 : 0);
        const px = hx * slimK(y) + hx / R * out, pz = hz + (hz - zc) / R * out;
        const wd = q ? 0.0085 + rnd() * 0.006 : 0.016;
        m.sphere(px, y, pz, wd, len, wd * 0.8, U.shade(o.hair, 0.78 + rnd() * 0.3), q ? 1 : 0, H);
      }
      // dos mechones sueltos que caen por delante de las orejas
      if (q) for (const sg of [1, -1]) m.sphere(0.078 * sg, 1.64, 0.022, 0.009, 0.04, 0.008, U.shade(o.hair, 0.9), 1, H);
    }
    // ---- bandana en la frente (o.bandana: su color): una banda ceñida alrededor de la cabeza, con el nudo y
    // las dos puntas colgando en la nuca
    if (o.bandana != null && !Z) {
      const BC = LC(o.bandana), N = q ? 32 : 12, rings = [];
      const y0 = 1.702, y1 = 1.731;
      for (const y of [y0 - 0.002, y0, (y0 + y1) / 2, y1, y1 + 0.002]) {
        const r = [];
        const edge = y < y0 + 1e-4 || y > y1 - 1e-4;
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          let [x, z, zc] = headSect(th, y);
          x *= slimK(y);
          const t = (edge && (y < y0 || y > y1) ? 0.004 : 0.0085) + (o.hair != null ? 0.0075 : 0);
          const R = Math.hypot(x, z - zc) || 1;
          x += x / R * t; z += (z - zc) / R * t;
          const fold = 0.88 + 0.12 * Math.abs(Math.sin(th * 5 + y * 90));
          r.push({ p: [x, y, z], c: mulC(BC, fold * (edge ? 0.8 : 1)), w: WH });
        }
        rings.push(r);
      }
      surface(m, rings, null, null);
      if (q) {
        const c = U.shade(o.bandana, 0.85);
        m.sphere(0, 1.728, -0.112, 0.018, 0.016, 0.012, c, 1, H);                      // nudo
        m.box(0.012, 1.69, -0.118, 0.022, 0.07, 0.004, c, 0, H, 0.18, 0.12);            // puntas
        m.box(-0.014, 1.686, -0.116, 0.02, 0.078, 0.004, c, 0, H, 0.12, -0.16);
      }
    }
    // ---- orejas, ojos, cejas, nariz y boca
    const skin = o.skin;
    for (const sg of [1, -1]) m.sphere(0.079 * sg, 1.664, -0.004, 0.011, 0.023, 0.016, U.shade(skin, 0.92), q ? 2 : 1, H);
    if (!q) return;
    const zf = headFront;
    for (const sg of [1, -1]) {
      const x = 0.031 * sg, y = 1.684, z = zf(x, y) - 0.0055;
      m.sphere(x, y, z, 0.0115, 0.0068, 0.006, Z ? 0xb8b39a : 0xe6e0d6, 1, H);                       // blanco del ojo
      m.sphere(x * 0.97, y - 0.0003, z + 0.0046, 0.0058, 0.0058, 0.0035, Z ? 0x8f8a76 : 0x3b2b20, 1, H);  // iris
      m.sphere(x, y + 0.0062, z + 0.0012, 0.0125, 0.0026, 0.0055, Z ? 0x5e2c2a : 0x1d1511, 1, H);       // párpado
      if (!Z) m.sphere(x * 1.03, 1.7015, zf(x * 1.03, 1.7015) + 0.0012, 0.016, 0.0025, 0.0044, o.brow || U.shade(o.hair || 0x2a1a12, 1.25), 1, H);   // ceja
    }
    m.sphere(0, 1.666, zf(0, 1.666) + 0.003, 0.0072, 0.017, 0.0092, U.shade(skin, 0.97), 1, H);    // nariz
    m.sphere(0, 1.6475, zf(0, 1.6475) + 0.0092, 0.0088, 0.0078, 0.0082, U.shade(skin, 0.98), 1, H);
    if (Z) m.sphere(0, 1.611, zf(0, 1.611) - 0.001, 0.021, 0.011, 0.008, 0x2a0c0a, 1, H);         // boca abierta
    else {
      m.sphere(0, 1.6175, zf(0, 1.6175) + 0.0012, 0.018, 0.0046, 0.0072, o.lips || 0xa86a62, 1, H);
      m.sphere(0, 1.6088, zf(0, 1.6088) + 0.0016, 0.0158, 0.0056, 0.0074, o.lips || 0xa86a62, 1, H);
    }
  }

  // Coleta con física: la trenza cuelga (gravedad en el espacio de la cabeza) y se queda atrás al acelerar
  const _hq = new THREE.Quaternion(), _hv = new THREE.Vector3(), _hg = new THREE.Vector3();
  const B0 = Math.atan2(-0.22, -0.975);       // dirección de la trenza en reposo (abajo y algo atrás)
  function hairPhysics(h, dt) {
    if (!h.opts.braid) return;
    const st = h.hairSt || (h.hairSt = { p: new THREE.Vector3(), v: new THREE.Vector3(), ok: false, a: 0, wa: 0, g: 0, wg: 0, b: 0, wb: 0, c: 0, wc: 0 });
    dt = Math.min(0.05, Math.max(0.001, dt || 0.016));
    h.root.updateMatrixWorld(true);
    h.head.getWorldPosition(_hv);
    let ax = 0, ay = 0, az = 0;
    if (st.ok) {
      const vx = (_hv.x - st.p.x) / dt, vy = (_hv.y - st.p.y) / dt, vz = (_hv.z - st.p.z) / dt;
      ax = (vx - st.v.x) / dt; ay = (vy - st.v.y) / dt; az = (vz - st.v.z) / dt;
      const al = Math.hypot(ax, ay, az);
      if (al > 40) { const k = 40 / al; ax *= k; ay *= k; az *= k; }
      if (Math.hypot(vx, vy, vz) > 25) { ax = ay = az = 0; st.v.set(0, 0, 0); } else st.v.set(vx, vy, vz);
    }
    st.p.copy(_hv); st.ok = true;
    _hg.set(-ax * 0.11, -9.8 - ay * 0.11, -az * 0.11).normalize();
    h.head.getWorldQuaternion(_hq).invert();
    _hg.applyQuaternion(_hq);
    let ta = Math.atan2(_hg.z, _hg.y) - B0;
    while (ta > Math.PI) ta -= Math.PI * 2;
    while (ta < -Math.PI) ta += Math.PI * 2;
    ta = U.clamp(ta, -0.3, 1.5);                     // hacia el cuello, poco (no lo atraviesa)
    const tg = U.clamp(Math.atan2(_hg.x, -_hg.y), -0.9, 0.9);
    const spring = (k, w, target, K, D) => { const nw = w + ((target - k) * K - w * D) * dt; return [k + nw * dt, nw]; };
    [st.a, st.wa] = spring(st.a, st.wa, ta, 70, 7);
    [st.g, st.wg] = spring(st.g, st.wg, tg, 60, 6);
    // el segundo tramo dobla un poco más y con retraso
    [st.b, st.wb] = spring(st.b, st.wb, (ta - st.a) * 0.9 + ta * 0.15, 90, 8);
    [st.c, st.wc] = spring(st.c, st.wc, (tg - st.g) * 0.9, 80, 7);
    h.hairA.rotation.set(st.a, 0, st.g);
    h.hairB.rotation.set(U.clamp(st.b, -0.4, 1), 0, U.clamp(st.c, -0.6, 0.6));
  }

  // complexión: [ancho del torso y la cadera, grosor de brazos y piernas]. El chaskeado, consumido; el temblante,
  // enorme y deforme; stocky: robusto y ancho de hombros, sin llegar a gordo (Booster)
  function BUILD(o) {
    return o.build === 'gaunt' ? [0.9, 0.84] : (o.build === 'huge' ? [1.48, 1.45] : (o.build === 'giant' ? [1.6, 1.75] : (o.build === 'slim' ? [0.94, 0.9] :
      (o.build === 'stocky' ? [1.12, 1.16] : [1, 1]))));
  }
  const BUILD_W = (o) => BUILD(o)[0];
  function heroBody(m, o, q) {
    // (o.hiRes: la protagonista principal, Di' Arco: malla mucho más densa en todo el cuerpo y las articulaciones)
    const HR = !!(o.hiRes && q);
    const N_T = q ? (HR ? 72 : 36) : 14, N_L = q ? (HR ? 40 : 20) : 9, N_A = q ? (HR ? 32 : 18) : 8;
    const P = o.female ? PROF_F : PROF_M, AX = P.AX;
    if (o.hero && !o.npc) ACTIVE_P = P;          // (los humanos enemigos no cambian el perfil de la protagonista)
    const STEP = q ? (HR ? 0.5 : 1) : 2.4;      // densidad de anillos
    const B = BI;
    const SKIN = LC(o.skin), PANTS = LC(o.pants);
    const TEE = LC(o.shirt), TEE2 = LC(U.shade(o.shirt, 0.86)), GRIME = LC(0x8f826a), YEL = LC(0xc4b791);
    const CLEAN = !!o.tank && !o.zombie;       // (el top negro de Di' Arco: casi sin mugre ni cuello amarillento)
    // top deportivo corto (o.crop: altura del borde): tirantes delante, espalda nadadora y el vientre al aire
    const CROP = o.crop && !o.zombie ? o.crop : 0;
    const braCover = (x, y, z) => {
      if (y < CROP) return false;
      if (y < 1.3) return true;                                     // la banda
      const ax = Math.abs(x);
      if (z >= -0.01) {
        if (y < 1.415 - 0.5 * Math.max(0, ax - 0.06) && ax < 0.17) return true;   // las copas
        return ax > 0.042 && ax < 0.082 && y < 1.5;                                  // tirantes
      }
      // espalda nadadora: los dos tirantes bajan de los hombros y se juntan en el centro, una tira hasta la banda
      if (y < 1.33 - 0.25 * Math.max(0, ax - 0.12)) return true;
      if (y < 1.375) return ax < 0.028;
      return Math.abs(ax - 0.078 * U.smooth(sat((y - 1.375) / 0.105))) < 0.02 && y < 1.5;
    };
    const braCol = (x, y, z) => {
      let c = mulC(TEE, 0.88 + 0.22 * fbm(x * 40 + 2, y * 40, z * 40));
      if (y < CROP + 0.014) c = mulC(c, 0.75);                              // goma del borde
      if (z > 0 && Math.abs(x) < 0.0025 && y < 1.4) c = mixC(c, LC(0x5c5e63), 0.55);   // cremallera
      if (z > 0 && Math.abs(Math.abs(x) - 0.05) < 0.004 && y > 1.3) c = mulC(c, 0.7);  // costuras
      return c;
    };
    const bellyCol = (x, y, z) => {
      let c = mulC(SKIN, 0.93 + 0.1 * fbm(x * 18, y * 18, z * 18));
      if (z > 0) {
        const ax = Math.abs(x);
        // abdominales: línea al medio, tres surcos y los oblicuos; el ombligo
        let d = 0.16 * g2(ax, 0.006) * sat((y - 1.04) / 0.03);
        for (const yy of [1.1, 1.145, 1.19]) d += 0.08 * g2(y - yy, 0.006) * sat((0.07 - ax) / 0.02);
        d += 0.1 * g2(ax - 0.085, 0.01) * sat((1.2 - y) / 0.1);
        d += 0.35 * g2(ax, 0.006) * g2(y - 1.045, 0.007);
        c = mulC(c, 1 - d);
        c = mulC(c, 1 + 0.07 * g2(ax - 0.04, 0.02) * g2(y - 1.15, 0.06));     // brillo sobre el músculo
      }
      return c;
    };
    const BLOOD = LC(0x5e231b), BAND = LC(o.bandCol != null ? o.bandCol : 0xe6e0d2), BAND_D = LC(o.bandCol != null ? U.shade(o.bandCol, 0.7) : 0xa99d84);
    const MUD = LC(0x3e352b);
    // infectados: el mismo cuerpo de una pieza, con ropa rota y ensangrentada, piel amoratada y
    // complexión distinta en cada uno (más flaco o más ancho)
    const Z = !!o.zombie, sd = Z ? ((o.seed || 1) % 97) * 3.17 + 11 : 0;
    // complexión: el chaskeado, consumido (flaco y de brazos finos); el temblante, enorme y deforme
    const build = BUILD(o);
    const bw = (Z ? 0.9 + ((o.seed || 0) % 5) * 0.05 : 1) * build[0];         // ancho del torso y la cadera
    const lw = (Z ? 0.94 + ((o.seed || 0) % 3) * 0.04 : 1) * build[1];         // grosor de brazos y piernas
    const TEAR = o.tear != null ? o.tear : 0.69;       // cuanto más bajo, más rota la ropa (0: sin camisa)
    const SHORT = o.shorts ? 0.74 : 0;                  // pantalón hecho jirones por encima de la rodilla
    const ZBLOOD = LC(0x431510);
    const PAL = o.skinPal;
    const BRUISE = LC(PAL === 'pale' ? 0x3f3a4c : 0x5b5263), ROT = LC(PAL === 'pale' ? 0x77846a : 0x6b6a4a);
    const RAW = LC(0x7e2c22), PUSC = LC(0xc2a868), CRUST = LC(0x6a5232);
    const zskin = (x, y, z) => {
      // piel muerta: manchas amoratadas, venas oscuras y algo de verdín
      let c = mulC(SKIN, 0.9 + 0.16 * fbm(x * 14 + sd, y * 14, z * 14));
      c = mixC(c, BRUISE, sat((fbm(x * 8 + sd, y * 8 + 3, z * 8) - 0.5) * 2.2) * (PAL === 'pale' ? 0.75 : 0.6));
      c = mixC(c, ROT, sat((fbm(x * 5 + 2, y * 5 + sd, z * 5) - 0.55) * 2) * 0.4);
      const v = fbm(x * 45 + sd, y * 45, z * 45);
      if (v > (PAL === 'pale' ? 0.56 : 0.62)) c = mulC(c, 1 - (v - (PAL === 'pale' ? 0.56 : 0.62)) * (PAL === 'pale' ? 2.2 : 1.4));
      if (PAL === 'raw') {
        // carne viva y agrietada, con pústulas y costras de hongo
        c = mixC(c, RAW, sat((fbm(x * 9 + sd, y * 9, z * 9 + 4) - 0.42) * 2.6) * 0.8);
        c = mixC(c, CRUST, sat((fbm(x * 6 + 9, y * 6 + sd, z * 6) - 0.52) * 2.6) * 0.75);
        const pv = fbm(x * 38 + 3, y * 38 + sd, z * 38);
        if (pv > 0.66) c = mixC(c, PUSC, (pv - 0.66) * 2.6);
      }
      return c;
    };
    const zblood = (c, x, y, z, k) => mixC(c, ZBLOOD, sat((fbm(x * 7 + sd * 2, y * 7 + sd, z * 7) - 0.48) * 2.4) * (k || 0.85));

    // ---- cadenas de pesos
    const TJ = [[1.0, B.hips, B.spine, 0.065], [1.14, B.spine, B.spine2, 0.065], [1.26, B.spine2, B.chest, 0.065], [1.515, B.chest, B.neck, 0.03]];
    const NJ = [[1.49, B.chest, B.neck, 0.035], [1.575, B.neck, B.head, 0.03]];
    const torsoW = (x, y) => {
      const base = chainW(y, TJ);
      // hombros y laterales altos del pecho se van con las clavículas (al levantar los brazos)
      const ax = Math.abs(x);
      const k = U.smooth(sat((ax - 0.085) / 0.085)) * U.smooth(sat((y - 1.32) / 0.09)) * 0.8;
      if (k <= 0) return packW(base);
      const cl = x > 0 ? B.clavL : B.clavR;
      // la punta del hombro (por fuera, arriba) sigue también un poco al brazo: al apuntar o levantarlo
      // la piel se estira hasta el deltoides en vez de quedar un pliegue (hueco) entre el torso y el brazo
      const ka = U.smooth(sat((ax - 0.125) / 0.05)) * U.smooth(sat((y - 1.34) / 0.07)) * 0.45;
      if (ka > 0) return packW(base.map(([b, w]) => [b, w * (1 - k)]).concat([[cl, k * (1 - ka)], [x > 0 ? B.armL : B.armR, k * ka]]));
      return packW(base.map(([b, w]) => [b, w * (1 - k)]).concat([[cl, k]]));
    };
    const armJ = (A) => [[-1.462, B['clav' + A], B['arm' + A], 0.075],   // (unión ancha: el hombro se estira sin quebrarse)
       [-1.16, B['arm' + A], B['fore' + A], 0.05], [-0.91, B['fore' + A], B['hand' + A], 0.03]];
    const legJ = (A) => [[-0.89, B.hips, B['leg' + A], 0.07], [-0.47, B['leg' + A], B['shin' + A], 0.05], [-0.07, B['shin' + A], B['foot' + A], 0.03]];

    // sección superelíptica: frente +Z
    const sect = (th, w, df, db, zc, n) => {
      const c = Math.cos(th), s = Math.sin(th), e = 2 / n;
      const x = w * Math.sign(c) * Math.pow(Math.abs(c), e);
      const z = zc + (s > 0 ? df : db) * Math.sign(s) * Math.pow(Math.abs(s), e);
      return [x, z];
    };
    const range = (y0, y1, dy) => {
      const n = Math.max(2, Math.round((y1 - y0) / (dy * STEP)));
      const out = [];
      for (let k = 0; k <= n; k++) out.push(y0 + (y1 - y0) * k / n);
      return out;
    };

    // ===== remera (torso de una pieza) =====
    const TT = P.TT;
    const rag = (i, N, seed) => (vnoise(i * 0.85, seed * 1.7, 0.5) - 0.5) * 1.6 + (hash3(i, seed, 7) - 0.5) * 0.4;   // dobladillo irregular
    // campera abierta (o.jacketIn: color de la remera de abajo; o.shirt es la campera) o chaleco (o.vest: su
    // color, sobre la camisa o.shirt): delante, una abertura que se ensancha hacia el cuello, con los bordes
    // (cremallera o costura) más oscuros. SLV: coloreando una manga (el chaleco no tiene)
    let SLV = false;
    const JIN = o.jacketIn != null && !o.zombie ? LC(o.jacketIn) : null, VEST = o.vest != null && !o.zombie ? LC(o.vest) : null;
    const openW = (y) => 0.022 + 0.05 * U.smooth(sat((y - 1.2) / 0.27));
    const teeCol = (x, y, z, edge) => {
      if (CROP) return braCover(x, y, z) ? braCol(x, y, z) : bellyCol(x, y, z);
      const ax = Math.abs(x);
      if ((JIN || VEST) && !SLV && z > 0 && y > 0.97) {
        const ow = openW(y) * (VEST ? 1.25 : 1);
        if (ax < ow) {
          // lo de abajo: la remera clara (campera) o la camisa (chaleco), con algo de mugre
          const base = JIN || TEE;
          return mixC(mulC(base, 0.9 + 0.15 * fbm(x * 20, y * 20, z * 20)), GRIME, 0.25 * sat(fbm(x * 12 + 4, y * 12, z * 12) * 1.6 - 0.5));
        }
        if (ax < ow + 0.009) return mulC(VEST || TEE, 0.55);                  // borde de la campera o del chaleco
      }
      if (VEST && !SLV) {
        // el chaleco: cuero gastado y oscuro, cortado en la sisa (se ve la camisa en los hombros)
        const sisa = ax > 0.13 + 0.02 * sat((1.36 - y) / 0.1) && y > 1.27;
        if (!sisa) {
          let v = mulC(VEST, 0.8 + 0.35 * fbm(x * 14 + 2, y * 14, z * 14));
          v = mixC(v, LC(0x1c140e), 0.35 * sat(fbm(x * 8, y * 8 + 3, z * 8) * 1.7 - 0.6));
          if (Math.abs(y - 1.0) < 0.01) v = mulC(v, 0.7);
          return v;
        }
      }
      let c = mixC(TEE, TEE2, sat(fbm(x * 9 + 1.3, y * 9, z * 9) * 1.4 - 0.25));
      // mugre: más abajo, en los costados y por manchas
      const low = U.smooth(sat((1.13 - y) / 0.17));
      const n2 = fbm(x * 15 + 3.1, y * 13, z * 15 + 7.7);
      let g = low * 0.32 + sat((n2 - 0.52) * 1.9) * 0.55 + sat((ax - 0.15) / 0.05) * 0.12;
      if (edge) g += 0.22;
      c = mixC(c, GRIME, sat(g) * (CLEAN ? 0.18 : 0.78));
      // axilas y bajo el pecho: sombra suave
      if (ax > 0.12 && y > 1.2 && y < 1.4) c = mulC(c, 1 - 0.16 * U.smooth(sat((ax - 0.12) / 0.06)) * U.smooth(sat(1 - Math.abs(y - 1.31) / 0.09)));
      // cuello amarillento
      if (y > 1.45 && !CLEAN) c = mixC(c, YEL, 0.45 * sat((y - 1.45) / 0.04));
      if (Z) {
        // camisa de infectado: rota (se ve la piel por los desgarros), sucia y ensangrentada
        if (fbm(x * 11 + sd, y * 11, z * 11 + sd) > TEAR) return mulC(zskin(x, y, z), TEAR <= 0 ? 1 : 0.85);
        c = mixC(c, GRIME, 0.35);
        return zblood(c, x, y, z);
      }
      // sangre seca: mancha en el costado bajo izquierdo (delante) y salpicaduras
      const bd = Math.hypot((x - 0.1) / 0.06, (y - 1.05) / 0.08);
      if (CLEAN) return c;
      if (z > 0.02 && bd < 1.4) c = mixC(c, BLOOD, sat((1.4 - bd) * 0.9) * (0.45 + 0.55 * fbm(x * 30, y * 30, z * 30)) * 0.85);
      const sp = fbm(x * 40 + 9, y * 40, z * 40 + 2);
      if (z > 0.05 && y > 1.15 && y < 1.33 && x < 0 && sp > 0.66) c = mixC(c, BLOOD, (sp - 0.66) * 2.2);
      return c;
    };
    {
      // (el top corto lleva tirantes finos: hace falta una malla mucho más fina para que salgan nítidos)
      const N = CROP && q ? 112 : N_T, rings = [];
      const ringT = (y, opts) => {
        const r = [];
        const [w, df, db, zc, n] = curve(TT, y);
        const sc = (opts && opts.sc) || 1;
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          let yy = y + (opts && opts.rag ? rag(i, N, 11) * opts.rag : 0);
          // pliegues de la tela floja en la cintura
          const fold = CROP ? 1 + (y >= CROP && y < CROP + 0.016 ? 0.012 : 0) : 1 + 0.011 * Math.sin(th * 7 + y * 31) * U.smooth(sat((1.16 - y) / 0.16)) +
            0.006 * Math.sin(th * 3 - y * 17) * U.smooth(sat((1.3 - y) / 0.2));
          let [x, z] = sect(th, w * sc * fold * bw, df * sc * fold * bw, db * sc * fold * bw, zc, n);
          if (P.bust && z > zc) z += bustBump(x, yy) * sc * Math.pow(Math.max(0, Math.sin(th)), 1.2);
          r.push({ p: [x, yy, z], c: opts && opts.col ? opts.col(x, yy, z) : teeCol(x, yy, z, opts && opts.edge), w: torsoW(x, yy) });
        }
        return r;
      };
      // labio interior del dobladillo (se apoya en la cadera) y borde gastado
      if (!CROP) {
        rings.push(ringT(0.962, { sc: 0.88, edge: true }));
        rings.push(ringT(0.951, { rag: Z ? 0.03 : 0.009, edge: true, sc: 1.004 }));
      }
      const ysT = CROP && q ? range(0.99, 1.27, 0.014).concat(range(1.278, 1.485, 0.006)) : range(CROP ? 0.99 : 0.962, 1.485, 0.02);
      if (CROP) { ysT.push(CROP - 0.002, CROP + 0.002, CROP + 0.014, CROP + 0.018); ysT.sort((a, b) => a - b); }
      for (const y of ysT) rings.push(ringT(y));
      // cuello redondo de la remera (con ribete) y labio que se cierra sobre el cuello
      const collar = (y, w, d, col) => {
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          const [x, z] = sect(th, w * (Z ? 0.5 + 0.5 * bw : 1), d * (Z ? 0.5 + 0.5 * bw : 1), d + 0.004, -0.006, 2.05);
          r.push({ p: [x, y, z], c: col(x, y, z), w: torsoW(x, y) });
        }
        return r;
      };
      const rib = (x, y, z) => (CROP ? mulC(SKIN, 0.96) : (CLEAN ? mulC(TEE, 0.8) : mixC(mulC(TEE, 0.93), YEL, 0.55)));
      const cs = P.collar;
      if (CROP) {
        // sin cuello de remera: los hombros se cierran lisos sobre el cuello (sin reborde)
        const sk = (x, y, z) => mulC(SKIN, 0.95 + 0.06 * fbm(x * 20, y * 20, z * 20));
        rings.push(collar(1.49, 0.062 * cs, 0.057 * cs, sk));
        rings.push(collar(1.492, 0.05 * cs, 0.047 * cs, sk));
      } else {
        rings.push(collar(1.494, 0.073 * cs, 0.067 * cs, rib));
        rings.push(collar(1.501, 0.066 * cs, 0.061 * cs, rib));
        rings.push(collar(1.498, 0.056 * cs, 0.051 * cs, (x, y, z) => mulC(CLEAN ? TEE : YEL, 0.6)));
        rings.push(collar(1.49, 0.049 * cs, 0.046 * cs, (x, y, z) => mulC(SKIN, 0.55)));
      }
      surface(m, rings, null, null);
    }

    // ===== cadera (pantalón) =====
    const pantsCol = (x, y, z) => {
      let c = mulC(PANTS, 0.9 + 0.2 * fbm(x * 11 + 4, y * 11, z * 11));
      // desgaste más claro delante de los muslos y en las rodillas
      const ax = Math.abs(x);
      const fade = (z > 0 ? 1 : 0.3) * (U.smooth(sat(1 - Math.abs(y - 0.72) / 0.14)) * 0.18 + U.smooth(sat(1 - Math.abs(y - 0.48) / 0.06)) * 0.22);
      c = mixC(c, mulC(PANTS, 1.45), fade * (0.6 + 0.4 * fbm(x * 20, y * 20, z * 20)));
      // barro cerca de las botas y detrás de las rodillas un poco más oscuro
      c = mixC(c, MUD, U.smooth(sat((0.32 - y) / 0.16)) * 0.55 * fbm(x * 18 + 2, y * 18, z * 18 + 5) * 1.5);
      if (z < 0 && Math.abs(y - 0.48) < 0.05) c = mulC(c, 0.85);
      if (ax < 0.04 && y > 0.82 && y < 0.95) c = mulC(c, 0.8);       // entrepierna
      // remiendos (o.patch: color): uno en la rodilla izquierda y otro en el muslo derecho, con puntadas
      if (o.patch != null && !Z && z > 0) {
        const pa = Math.max(Math.abs(x - 0.1) / 0.045, Math.abs(y - 0.5) / 0.05), pb = Math.max(Math.abs(x + 0.11) / 0.035, Math.abs(y - 0.74) / 0.045);
        const pk = Math.min(pa, pb);
        if (pk < 1) c = pk > 0.88 && (Math.floor((x + y) * 300) % 2) ? mulC(LC(0xcfc6aa), 0.8) : mulC(LC(pa < pb ? o.patch : U.shade(o.patch, 1.25)), 0.88 + 0.15 * fbm(x * 40, y * 40, z * 40));
      }
      if (o.dshorts && !Z) {
        // bolsillos de atrás (con su costura) y cintura elástica fruncida
        const px2 = Math.abs(ax - 0.075), py2 = Math.abs(y - 0.88);
        if (z < 0 && px2 < 0.045 && py2 < 0.05) c = mulC(c, px2 > 0.04 || py2 > 0.045 ? 1.35 : 0.88);
        if (z > 0 && Math.abs(ax - 0.13) < 0.004 && y > 0.83 && y < 0.95) c = mulC(c, 1.3);      // bolsillo de delante
        if (y > 0.95) c = mulC(c, 0.82 + 0.18 * Math.abs(Math.sin(Math.atan2(z, x) * 26)));
      }
      if (Z) {
        // pantalón roto en las rodillas y las perneras, con barro y sangre
        if (fbm(x * 10 + sd, y * 10 + 5, z * 10) > 0.71 && y < 0.7) return zskin(x, y, z);
        if (SHORT && y < SHORT + (fbm(x * 30 + sd, 3, z * 30) - 0.5) * 0.12) return zskin(x, y, z);
        c = mixC(c, MUD, 0.25 * fbm(x * 6, y * 6 + sd, z * 6));
        c = zblood(c, x, y, z, 0.6);
      }
      return c;
    };
    {
      const PT = P.PT;
      const N = N_T, rings = [];
      for (const y of range(0.85, 1.05, 0.025)) {
        const [w, df, db, zc, n] = curve(PT, y);
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          const hb = o.baggy ? 1 + 0.07 * U.smooth(sat((0.98 - y) / 0.12)) : (o.dshorts ? 1.06 + (y > 0.95 && y < 1.0 ? 0.035 + 0.01 * Math.sin(th * 26) : 0) : 1);
          const [x, z] = sect(th, w * bw * hb, df * bw * hb, db * bw * hb, zc, n);
          r.push({ p: [x, y, z], c: pantsCol(x, y, z), w: packW(chainW(y, TJ)) });
        }
        rings.push(r);
      }
      surface(m, rings, { p: [0, 0.835, -0.004], c: mulC(PANTS, 0.7), w: packW([[B.hips, 1]]) },
        { p: [0, 1.06, 0], c: PANTS, w: packW(chainW(1.06, TJ)) });
    }

    // ===== cuello =====
    {
      const NT = P.NT;
      const N = N_L, rings = [];
      for (const y of range(1.43, 1.62, 0.025)) {
        const [r0, zc] = curve(NT, y);
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          const nk = o.build === 'stocky' ? 1.22 - 0.12 * sat((y - 1.5) / 0.1) : 1;       // (Booster: cuello de toro)
          const x = Math.cos(th) * r0 * 1.04 * nk, z = zc + Math.sin(th) * r0 * nk;
          let c = Z ? zblood(zskin(x, y, z), x, y, z, 0.5) : mulC(SKIN, 0.97 + 0.06 * fbm(x * 20, y * 20, z * 20));
          if (y > 1.55 && z > 0) c = mulC(c, 1 - 0.18 * sat((y - 1.55) / 0.05));   // sombra de la mandíbula
          r.push({ p: [x, y, z], c, w: packW(chainW(y, NJ)) });
        }
        rings.push(r);
      }
      surface(m, rings, null, null);
    }

    // ===== brazos (piel), mangas y vendas =====
    // [y, ancho, fondo, desplazamiento z]
    const AT = P.AT;
    const armRing = (sg, A, y, extra, colFn, N) => {
      const [rx, rz, zc] = curve(AT, y);
      const ax = AX * sg;
      const r = [];
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2;
        const ex = typeof extra === 'function' ? extra(i, th) : (extra || 0);
        const x = ax + Math.cos(th) * (rx * lw + ex), z = zc + Math.sin(th) * (rz * lw + ex);
        r.push({ p: [x, y, z], c: colFn(x, y, z, i, th), w: packW(chainW(-y, armJ(A))) });
      }
      return r;
    };
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      const J = armJ(A);
      // ---- piel del brazo (de la axila a la muñeca, una sola pieza)
      const skinCol = (x, y, z) => {
        if (Z) {
          // brazos de infectado: sangre seca en manos y antebrazos (de agarrar y morder)
          const c = zskin(x, y, z);
          return mixC(zblood(c, x, y, z, 0.5), ZBLOOD, U.smooth(sat((1.0 - y) / 0.09)) * 0.35 * (0.5 + fbm(x * 20, y * 20 + sd, z * 20)));
        }
        let c = mulC(SKIN, 0.94 + 0.1 * fbm(x * 16 + sg * 3, y * 16, z * 16));
        // codo y nudillos de la muñeca algo más oscuros; tierra en los antebrazos
        if (z < 0) c = mulC(c, 1 - 0.12 * U.smooth(sat(1 - Math.abs(y - 1.165) / 0.035)));
        const d = fbm(x * 22 + 8, y * 22, z * 22 + 1);
        if (y < 1.12 && y > 0.94) c = mixC(c, mulC(MUD, 1.5), sat((d - 0.6) * 1.6) * 0.5);
        // hacia la muñeca vuelve al tono de la mano (que es de un solo color)
        return mixC(c, SKIN, U.smooth(sat((0.95 - y) / 0.03)));
      };
      {
        const rings = [];
        const aTop = AT[AT.length - 1][0];
        for (const y of range(0.905, aTop, 0.025)) rings.push(armRing(sg, A, y, 0, skinCol, N_A));
        surface(m, rings,
          { p: [AX * sg, 0.893, 0.004], c: SKIN, w: packW(chainW(-0.893, J)) },
          { p: [AX * sg, aTop + 0.007, 0], c: mulC(SKIN, 0.9), w: packW(chainW(-aTop - 0.007, J)) });
      }
      // ---- sin mangas (o.tank): el hombro (deltoides) de piel une el brazo con el torso, sin hueco
      if (o.tank && !Z) {
        const ST = P.ST, cx = AX * sg, N = N_L, rings = [];
        const dRing = (y, sc) => {
          const [rx, rz, zc, sh] = curve(ST, y);
          const r = [];
          for (let i = 0; i < N; i++) {
            const th = (i / N) * Math.PI * 2;
            const x = cx - sh * sg * 1.15 + Math.cos(th) * rx * sc * lw, z = zc + Math.sin(th) * rz * sc * lw;
            r.push({ p: [x, y, z], c: skinCol(x, y, z), w: packW(chainW(-y, J)) });
          }
          return r;
        };
        const yTop = ST[ST.length - 1][0];
        for (const y of range(1.3, yTop, 0.012)) rings.push(dRing(y, 0.9 - 0.12 * U.smooth(sat((1.34 - y) / 0.04))));
        surface(m, rings, null, { p: [(AX - 0.03) * sg, yTop + 0.006, -0.006], c: skinCol(AX * sg, 1.45, 0), w: packW(chainW(-1.45, J)) });
        // puente del hombro: una almohadilla elástica sobre la articulación. Lo de arriba y hacia el cuello
        // sigue a la clavícula y lo de abajo y afuera al brazo, así al apuntar o levantar el brazo la piel se
        // estira y tapa el hueco entre el torso y el deltoides (en vez de verse dos piezas separadas)
        {
          const jx = (AX - 0.03) * sg, jy = 1.415, jz = 0.0, RX = 0.052 * lw, RY = 0.052, RZ = 0.058 * lw;
          const NU = 12, NV = 8, pts = [];
          const cl = B['clav' + A], ar = B['arm' + A];
          for (let v = 0; v <= NV; v++) {
            const ph = (v / NV) * Math.PI, row = [];
            for (let u = 0; u < NU; u++) {
              const th = (u / NU) * Math.PI * 2;
              const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
              const x = jx + nx * RX, y = jy + ny * RY, z = jz + nz * RZ;
              const a = U.smooth(sat(0.5 - ny * 0.75 + nx * sg * 0.45));
              const w = packW([[cl, 1 - a], [ar, a]]);
              const l = Math.hypot(nx / RX, ny / RY, nz / RZ) || 1;
              row.push({ p: [x, y, z], n: [nx / RX / l, ny / RY / l, nz / RZ / l], c: skinCol(x, y, z), w });
            }
            pts.push(row);
          }
          const V = (q) => m.vert(q.p, q.n, q.c, q.w);
          for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) {
            const a = pts[v][u], b = pts[v][(u + 1) % NU], c = pts[v + 1][(u + 1) % NU], d = pts[v + 1][u];
            V(a); V(c); V(b); V(a); V(d); V(c);
          }
        }
      }
      // ---- manga corta: de la costura del hombro hasta la mitad del brazo, abierta y floja (o.tank: sin mangas)
      if (!o.tank) {
        SLV = true;
        // [y, ancho, fondo, z, corrimiento hacia el cuello]
        const ST = P.ST;
        // manga larga (algunos infectados): sigue el brazo hasta la muñeca, floja
        const longS = !!o.longSleeves;
        const SL = longS ? AT.filter((r) => r[0] < 1.27 && r[0] > 0.93).map((r) => [r[0], r[1] * lw + 0.012, r[2] * lw + 0.012, r[3], 0]).concat(ST) : ST;
        const yBot = longS ? 0.945 : P.sleeveBot;
        const cx = AX * sg;
        const N = N_L, rings = [];
        const sRing = (y, sc, edge, ragA) => {
          const [rx, rz, zc, sh] = curve(SL, y);
          const r = [];
          for (let i = 0; i < N; i++) {
            const th = (i / N) * Math.PI * 2;
            const yy = y + (ragA ? rag(i, N, sg > 0 ? 21 : 33) * ragA : 0);
            // la manga se separa un poco más del brazo por fuera que por dentro (cae floja)
            const out = Math.cos(th) * sg > 0 ? 1.02 : 0.96;
            const x = cx - sh * sg + Math.cos(th) * rx * sc * out, z = zc + Math.sin(th) * rz * sc;
            let c = teeCol(x, yy + 0.02, z, edge);
            if (Math.cos(th) * sg < -0.3) c = mulC(c, 0.88);         // cara interior, en sombra
            r.push({ p: [x, yy, z], c, w: packW(chainW(-yy, J)) });
          }
          return r;
        };
        rings.push(sRing(yBot + 0.008, longS ? 0.8 : 0.76, true));             // labio interior (toca el brazo)
        rings.push(sRing(yBot, 1.0, true, Z ? 0.02 : 0.007));                  // borde gastado
        const yTop = ST[ST.length - 1][0];
        for (const y of range(yBot + 0.011, yTop, 0.016)) rings.push(sRing(y, 1.0, false));
        surface(m, rings, null, { p: [(AX - 0.028) * sg, yTop + 0.006, -0.006], c: teeCol((AX - 0.002) * sg, 1.476, 0, false), w: packW(chainW(-1.476, J)) });
        SLV = false;
        // puño elástico de la campera (o.cuffs con manga larga)
        if (longS && o.cuffs && !Z) {
          const rs = [];
          for (const y of [0.935, 0.94, 0.965, 0.97]) rs.push(armRing(sg, A, y, (y > 0.937 && y < 0.968) ? 0.017 : 0.012, (x, yy, z) => mulC(TEE, 0.62 + 0.08 * Math.abs(Math.sin(Math.atan2(z, x - AX * sg) * 12))), N_A));
          surface(m, rs, null, null);
        }
      }
      // ---- vendas: izquierda en el antebrazo, derecha alrededor del codo (solo el protagonista)
      if (o.hero && !o.outlineOnly && !o.noBand) {
        // (o.wraps: vendas de boxeo en los dos antebrazos, de la muñeca a medio antebrazo)
        const y0 = o.wraps ? 0.885 : (sg > 0 ? 0.955 : 1.1), y1 = o.wraps ? 1.07 : (sg > 0 ? 1.088 : 1.228);
        const pitch = o.wraps ? 0.019 : 0.026;     // separación entre vueltas
        const seed = sg > 0 ? 3 : 5;
        const bandAt = (i, y) => {
          const u = i / N_A;
          const f = ((y - y0) / pitch + u) % 1;
          return Math.min(f, 1 - f);               // 0 en el borde de cada vuelta, 0.5 al centro
        };
        const thick = (y) => 0.0018 + 0.0062 * U.smooth(sat(Math.min(y - y0, y1 - y) / 0.012));
        const bloodC = sg > 0 ? [AX + 0.015, 1.035, -0.035] : [(AX - 0.015) * sg, 1.17, -0.04];   // donde mancha la herida
        const rings = [];
        for (const y of range(y0, y1, 0.0075)) {
          rings.push(armRing(sg, A, y,
            (i) => thick(y) * (0.75 + 0.25 * U.smooth(sat(bandAt(i, y) * 5))) + (hash3(i, Math.round(y * 400), seed) - 0.5) * 0.0012,
            (x, yy, z, i) => {
              let c = mulC(BAND, 0.8 + 0.2 * U.smooth(sat(bandAt(i, yy) * 5)));
              c = mixC(c, BAND_D, sat((fbm(x * 30 + seed, yy * 30, z * 30) - 0.45) * 1.5) * 0.7);
              const bd = o.wraps ? 9 : Math.hypot((x - bloodC[0] * (sg > 0 ? 1 : 1)) / 0.03, (yy - bloodC[1]) / 0.03, (z - bloodC[2]) / 0.04);
              if (bd < 1.5) c = mixC(c, BLOOD, sat(1.5 - bd) * 0.75 * (0.5 + 0.5 * fbm(x * 60, yy * 60, z * 60)));
              return c;
            }, N_A));
        }
        surface(m, rings, null, null);
        // punta de la venda remetida
        const ty = o.wraps ? 1.055 : (sg > 0 ? 1.07 : 1.205);
        m.box(AX * sg + 0.036 * sg * P.hand, ty, 0.024, 0.006, 0.026, 0.02, o.bandCol != null ? U.shade(o.bandCol, 1.3) : 0xd6cfbf, 0.4 * sg, B['fore' + A], 0, 0.25 * sg);
      }
    }

    // cintas atadas en los brazos (o.armTies: color), por encima del bíceps, con las dos puntas colgando
    if (o.armTies != null && !Z && !o.outlineOnly) {
      for (const sg of [1, -1]) {
        const A = sg > 0 ? 'L' : 'R', rings = [];
        for (const y of [1.296, 1.299, 1.311, 1.314]) rings.push(armRing(sg, A, y, (y > 1.297 && y < 1.313) ? 0.0042 : 0.001, () => LC(o.armTies), N_A));
        surface(m, rings, null, null);
        if (q) {
          const bx = (AX + 0.05) * sg;
          m.sphere(bx, 1.305, -0.006, 0.008, 0.009, 0.008, U.shade(o.armTies, 0.9), 1, B['arm' + A]);       // nudo
          m.box(bx + 0.004 * sg, 1.27, -0.004, 0.005, 0.06, 0.012, o.armTies, 0, B['arm' + A], 0.08, 0.1 * sg);
          m.box(bx + 0.002 * sg, 1.265, -0.014, 0.005, 0.07, 0.011, U.shade(o.armTies, 0.85), 0, B['arm' + A], -0.05, 0.04 * sg);
        }
      }
    }

    // ===== piernas (pantalón de una pieza, de la cadera al tobillo) =====
    const LT = P.LT;
    const baggyK = (y) => 1.2 + 0.32 * U.smooth(sat((0.62 - y) / 0.4)) - 0.12 * U.smooth(sat((0.17 - y) / 0.05)) - 0.12 * U.smooth(sat((y - 0.86) / 0.12));
    // short de jean (o.dshorts: altura del bajo) con el dobladillo vuelto, la pierna al aire y medias altas
    // (o.socks: color) con rayas sobre el tobillo
    // (las medias, distintas en cada pierna: o.sockTop = [izquierda, derecha])
    const DS = o.dshorts && !Z ? o.dshorts : 0, ST2 = o.sockTop || [0.535, 0.535];
    let SOCK_TOP = ST2[0];
    const SOCK = LC(o.socks != null ? o.socks : 0x222224), CUFF = LC(U.shade(o.pants, 1.55));
    const STRIPES = [[0.215, 0.232, LC(0x3a6db8)], [0.236, 0.243, LC(0xd8d6cf)], [0.247, 0.262, LC(0xc49a35)]];
    const dsK = (y) => (y >= DS + 0.035 ? 1.17 - 0.1 * U.smooth(sat((y - 0.86) / 0.12)) : (y >= DS - 0.0005 ? 1.23 : (o.socks != null && y < SOCK_TOP ? (y > SOCK_TOP - 0.018 ? 1.035 : 1.0) : 0.965)));
    const legSkin = (x, y, z) => {
      let c = mulC(SKIN, 0.92 + 0.12 * fbm(x * 16 + 5, y * 16, z * 16));
      if (z > 0) c = mulC(c, 1 + 0.06 * g2(y - 0.6, 0.05));          // brillo del muslo
      return c;
    };
    const dsCol = (x, y, z) => {
      if (y >= DS + 0.035) return pantsCol(x, y, z);
      if (y >= DS - 0.0005) return mulC(CUFF, 0.9 + 0.15 * fbm(x * 30, y * 30, z * 30));      // dobladillo vuelto
      if (o.socks != null && y < SOCK_TOP) {
        for (const st of STRIPES) if (y >= st[0] && y <= st[1]) return st[2];
        return mulC(SOCK, (y > SOCK_TOP - 0.018 ? 0.85 : 1) * (0.92 + 0.12 * fbm(x * 40, y * 40, z * 40)));
      }
      return legSkin(x, y, z);
    };
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      const J = legJ(A);
      const N = N_L, rings = [];
      SOCK_TOP = ST2[sg > 0 ? 0 : 1];
      let ysL = range(0.125, 0.99, 0.034);
      if (DS) {
        ysL = ysL.filter((y) => Math.abs(y - DS) > 0.012 && Math.abs(y - DS - 0.035) > 0.01);
        ysL.push(DS - 0.0015, DS, DS + 0.035, DS + 0.039, SOCK_TOP - 0.019, SOCK_TOP - 0.017, SOCK_TOP, SOCK_TOP + 0.002);
        if (o.socks != null) for (const st of STRIPES) ysL.push(st[0] - 0.0015, st[0], st[1], st[1] + 0.0015);
        ysL.sort((a, b) => a - b);
      }
      for (const y of ysL) {
        const [rx, rz, zc] = curve(LT, y);
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          // pliegues en la corva y sobre la bota
          let wr = 1 + 0.03 * Math.sin(th * 5 + y * 40) * U.smooth(sat(1 - Math.abs(y - 0.24) / 0.06)) * (DS ? 0 : 1);
          if (DS) wr *= dsK(y) * (y > DS ? 1 + 0.02 * Math.sin(th * 5 + y * 30) : 1);
          // vaquero ancho (o.baggy): perneras holgadas que caen rectas, con pliegues, y se amontonan sobre la bota
          if (o.baggy) wr *= baggyK(y) * (1 + 0.035 * Math.sin(th * 4 + y * 23) + 0.05 * Math.sin(th * 3 - y * 9) * U.smooth(sat((0.3 - y) / 0.15)));
          // cargo militar (o.cargo): algo holgado, con pliegues y metido en las botas
          if (o.cargo) wr *= 1.07 + 0.03 * Math.sin(th * 4 + y * 19) - 0.07 * U.smooth(sat((0.24 - y) / 0.08));
          const x = 0.1 * sg + Math.cos(th) * rx * wr * lw, z = zc + Math.sin(th) * rz * wr * lw;
          r.push({ p: [x, y, z], c: DS ? dsCol(x, y, z) : pantsCol(x, y, z), w: packW(chainW(-y, J)) });
        }
        rings.push(r);
      }
      surface(m, rings,
        { p: [0.1 * sg, 0.11, 0], c: DS ? SOCK : PANTS, w: packW(chainW(-0.11, J)) },
        { p: [0.1 * sg, 1.0, 0], c: PANTS, w: packW(chainW(-1.0, J)) });
    }

    // bolsillos cargo a los costados de los muslos, con su tapa y el botón
    if (o.cargo && !Z && !o.outlineOnly) {
      for (const sg of [1, -1]) {
        const A = sg > 0 ? 'L' : 'R', pc = U.shade(o.pants, 0.86), [rx] = curve(LT, 0.64);
        const px = 0.1 * sg + (rx * lw * 1.07 + 0.01) * sg;
        m.box(px, 0.63, 0.004, 0.026, 0.13, 0.1, pc, 0, B['leg' + A]);
        m.box(px + 0.004 * sg, 0.7, 0.004, 0.026, 0.03, 0.104, U.shade(o.pants, 0.72), 0, B['leg' + A]);
        if (q) m.box(px + 0.016 * sg, 0.69, 0.004, 0.006, 0.012, 0.012, 0x2a2a22, 0, B['leg' + A]);
      }
    }
    // férula vieja en el antebrazo izquierdo (o.brace: el brazo que se partió): dos tablillas de plástico
    // gastado, cintas de velcro y el codo vendado
    if (o.brace && !Z && !o.outlineOnly) {
      const sg = 1, A = 'L';
      for (const y of [0.95, 1.0, 1.05, 1.1]) {
        const rs = [];
        for (const yy of [y - 0.012, y - 0.01, y + 0.01, y + 0.012]) rs.push(armRing(sg, A, yy, (yy > y - 0.011 && yy < y + 0.011) ? 0.012 : 0.009, () => LC(0x23221f), N_A));
        surface(m, rs, null, null);
      }
      const rs = [];
      for (const y of range(0.93, 1.13, 0.02)) rs.push(armRing(sg, A, y, (i, th) => 0.006 + 0.003 * Math.abs(Math.sin(th)), (x, yy, z) => mulC(LC(0x5d5a52), 0.85 + 0.2 * fbm(x * 30, yy * 30, z * 30)), N_A));
      surface(m, rs, null, null);
    }
    // correa de la pistolera alrededor del muslo derecho (anillo ceñido)
    if (o.hero && !o.outlineOnly) {
      const J = legJ('R'), N = N_L, rings = [];
      for (const y of range(0.735, 0.765, 0.01)) {
        const [rx, rz, zc] = curve(LT, y);
        const e = 0.004 * U.smooth(sat(Math.min(y - 0.735, 0.765 - y) / 0.006)) + 0.001;
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2;
          const bg = o.baggy ? baggyK(y) * 1.03 : (DS ? dsK(y) * 1.03 : 1);
          const x = -0.1 + Math.cos(th) * (rx * bg + e), z = zc + Math.sin(th) * (rz * bg + e);
          r.push({ p: [x, y, z], c: LC(0x2a2420), w: packW(chainW(-y, J)) });
        }
        rings.push(r);
      }
      surface(m, rings, null, null);
    }
  }

  // ---------- Equipo de los humanos (diseños propios) ----------
  // o.gear: { cap, capBack, beanie, hood, mask, balaclava, hockey, vest, hiviz, armband, quiver, pack, kneepads,
  // belt, scarf } con el color de cada pieza. q: 1 cerca, 0 lejos, -1 muy lejos (solo lo grande)
  function gearGeometry(m, o, q) {
    const g = o.gear, B = BI, D = q > 0 ? 2 : 1, dk = (c, f) => U.shade(c, f);
    const fem = !!o.female, AX = fem ? PROF_F.AX : PROF_M.AX;
    const H = B.head;
    // ---- cabeza
    if (g.balaclava != null) {
      m.sphere(0, 1.676, 0.002, 0.1, 0.128, 0.116, g.balaclava, D + 1, H);
      if (q >= 0) {
        m.box(0, 1.685, 0.104, 0.084, 0.024, 0.016, o.skin, 0, H);                          // abertura de los ojos
        for (const sg of [1, -1]) m.sphere(0.03 * sg, 1.686, 0.113, 0.012, 0.008, 0.005, 0x1a1410, 1, H);
      }
      m.sphere(0, 1.54, -0.005, 0.064, 0.05, 0.066, g.balaclava, D, B.neck);
    }
    if (g.hood != null) {
      m.sphere(0, 1.7, -0.05, 0.123, 0.135, 0.128, g.hood, D + 1, H);
      if (q >= 0) m.sphere(0, 1.705, 0.045, 0.118, 0.13, 0.04, dk(g.hood, 0.8), D, H);    // borde de la capucha
      m.sphere(0, 1.5, -0.06, 0.14, 0.09, 0.11, g.hood, D, B.neck);
    }
    if (g.beanie != null) {
      m.sphere(0, 1.748, -0.008, 0.106, 0.074, 0.115, g.beanie, D + 1, H);
      if (q >= 0) m.sphere(0, 1.716, -0.007, 0.109, 0.022, 0.118, dk(g.beanie, 0.82), D, H);
    }
    if (g.cap != null) {
      const back = !!g.capBack;
      m.sphere(0, 1.742, -0.005, 0.105, 0.068, 0.113, g.cap, D + 1, H);
      m.box(0, 1.738, back ? -0.122 : 0.118, 0.125, 0.012, 0.085, dk(g.cap, 0.85), 0, H, back ? -0.15 : 0.15);
      if (q > 0) m.sphere(0, 1.808, -0.004, 0.012, 0.008, 0.012, dk(g.cap, 0.7), 1, H);
    }
    if (g.mask != null) {
      m.sphere(0, 1.603, 0.032, 0.092, 0.058, 0.098, g.mask, D, H);
      m.sphere(0, 1.552, 0.07, 0.055, 0.045, 0.03, g.mask, 1, B.neck);
    }
    if (g.hockey != null) {
      m.sphere(0, 1.672, 0.084, 0.086, 0.112, 0.045, g.hockey, D + 1, H);
      if (q >= 0) {
        for (const sg of [1, -1]) m.sphere(0.033 * sg, 1.69, 0.124, 0.02, 0.014, 0.008, 0x14100e, 1, H);
        for (const [x, y] of [[0, 1.63], [0.02, 1.61], [-0.02, 1.61], [0, 1.6], [0.045, 1.64], [-0.045, 1.64]]) m.sphere(x, y, 0.126, 0.006, 0.006, 0.004, 0x14100e, 1, H);
        m.sphere(0.03, 1.73, 0.118, 0.012, 0.02, 0.004, 0x7a1612, 1, H);                    // marca roja
        m.sphere(0, 1.705, -0.01, 0.104, 0.012, 0.115, 0x222020, 1, H);                     // correa
      }
    }
    // ---- torso
    if (g.vest != null || g.hiviz != null) {
      const c = g.vest != null ? g.vest : g.hiviz;
      m.sphere(0, 1.3, 0.004, 0.198, 0.145, fem ? 0.152 : 0.142, c, D + 1, B.chest);
      m.sphere(0, 1.13, 0.0, 0.182, 0.105, 0.128, c, D + 1, B.spine2);
      if (g.hiviz != null) {
        const s = 0xd8d8cc;
        m.sphere(0, 1.21, 0.002, 0.2, 0.014, fem ? 0.154 : 0.144, s, D, B.chest);
        m.sphere(0, 1.11, 0.0, 0.186, 0.013, 0.131, s, D, B.spine2);
      } else if (q >= 0) {
        // bolsillos del chaleco
        for (const x of [-0.09, 0, 0.09]) m.box(x, 1.16, 0.122, 0.07, 0.075, 0.035, dk(c, 0.82), 0, B.spine2);
        m.box(0.1, 1.33, 0.14, 0.06, 0.05, 0.03, dk(c, 0.78), 0, B.chest);
      }
    }
    if (g.armband != null) m.sphere(AX, 1.3, 0.006, 0.058, 0.026, 0.058, g.armband, D, B.armL);
    if (g.scarf != null) m.sphere(0, 1.47, 0.0, 0.085, 0.04, 0.08, g.scarf, D, B.chest);
    if (g.belt != null) {
      m.sphere(0, 0.985, 0, 0.19, 0.03, 0.135, g.belt, D, B.hips);
      if (q >= 0) for (const sg of [1, -1]) m.box(0.15 * sg, 0.96, 0.06, 0.05, 0.06, 0.04, dk(g.belt, 0.85), 0, B.hips);
    }
    if (g.quiver != null) {
      m.box(-0.07, 1.3, -0.16, 0.085, 0.5, 0.08, g.quiver, 0, B.chest, 0.1, 0.4);
      if (q >= 0) for (let i = 0; i < 4; i++) m.box(-0.16 + i * 0.016, 1.58 - i * 0.01, -0.19 + i * 0.006, 0.012, 0.09, 0.03, i % 2 ? 0xc8c0a8 : 0x8a2a22, 0, B.chest, 0.1, 0.4);
    }
    if (g.pack != null) {
      const bp = g.pack;
      m.box(0, 1.22, -0.21, 0.32, 0.44, 0.17, bp, 0, B.chest);
      m.sphere(0, 1.44, -0.21, 0.16, 0.06, 0.085, bp, D, B.chest);
      if (q >= 0) {
        m.box(0, 1.1, -0.305, 0.24, 0.16, 0.05, dk(bp, 0.85), 0, B.chest);
        for (const sg of [1, -1]) m.box(0.175 * sg, 1.18, -0.2, 0.05, 0.22, 0.12, dk(bp, 0.9), 0, B.chest);
        m.cyl(0, 1.5, -0.2, 0.06, 0.06, 0.3, 0x4a5a46, 10, B.chest, 0, 0, Math.PI / 2);   // saco de dormir arriba
        for (const sg of [1, -1]) m.box(0.1 * sg, 1.35, 0.12, 0.035, 0.22, 0.02, dk(bp, 0.7), 0, B.chest, -0.15);
      }
    }
    if (g.kneepads != null && q >= 0) for (const sg of [1, -1]) m.sphere(0.1 * sg, 0.48, 0.055, 0.052, 0.058, 0.03, g.kneepads, 1, B['shin' + (sg > 0 ? 'L' : 'R')]);
    // ---- piezas de las variantes (Escorpiones y supervivientes): ropa recogida y apañada durante años
    const SL = (sg) => (sg > 0 ? 'L' : 'R');
    // casco: de obra (con ala corrida) o de moto (más redondo, sin ala)
    if (g.helmet != null) {
      const moto = !!g.moto;
      m.sphere(0, moto ? 1.705 : 1.752, -0.004, moto ? 0.128 : 0.114, moto ? 0.13 : 0.078, moto ? 0.135 : 0.124, g.helmet, D + 1, H);
      if (!moto) m.sphere(0, 1.722, 0.0, 0.13, 0.014, 0.142, dk(g.helmet, 0.9), D, H);
      else if (q >= 0) m.box(0, 1.67, 0.122, 0.13, 0.05, 0.02, 0x1a1c1e, 0, H);              // la boca del casco abierta
    }
    // gafas de soldar o de esquí subidas a la frente
    if (g.goggles != null && q >= 0) {
      m.sphere(0, 1.725, -0.005, 0.11, 0.018, 0.118, 0x2a2622, D, H);
      for (const sg of [1, -1]) { m.sphere(0.036 * sg, 1.73, 0.105, 0.03, 0.024, 0.016, g.goggles, 1, H); m.sphere(0.036 * sg, 1.73, 0.113, 0.022, 0.016, 0.006, 0x1c2a2e, 1, H); }
    }
    // chaqueta abierta (más ancha que la camiseta, con cuello y mangas; se ve la camiseta por delante) y, con
    // coatLong, los faldones de un abrigo largo por los muslos
    if (g.jacket != null) {
      const c = g.jacket;
      m.sphere(0, 1.31, 0.0, 0.205, 0.15, fem ? 0.158 : 0.15, c, D + 1, B.chest);
      m.sphere(0, 1.12, -0.004, 0.188, 0.11, 0.136, c, D + 1, B.spine2);
      m.sphere(0, 1.22, -0.002, 0.2, 0.08, fem ? 0.15 : 0.143, c, D, B.spine2);          // (la costura entre pecho y tripa)
      m.sphere(0, 0.99, -0.004, 0.182, 0.07, 0.132, c, D, B.hips);
      if (q >= 0) {
        m.box(0, 1.2, fem ? 0.162 : 0.152, 0.06, 0.34, 0.012, o.shirt != null ? o.shirt : 0x5a5248, 0, B.chest);   // abierta: la camiseta
        for (const sg of [1, -1]) m.box(0.045 * sg, 1.36, 0.135, 0.05, 0.16, 0.02, dk(c, 0.82), 0, B.chest, 0, -0.35 * sg);   // solapas
      }
      m.sphere(0, 1.47, -0.03, 0.11, 0.045, 0.1, dk(c, 0.9), D, B.chest);                    // cuello
      for (const sg of [1, -1]) {
        m.sphere(AX * sg, 1.32, 0, 0.064, 0.15, 0.064, c, D, B['arm' + SL(sg)]);
        if (!g.rolled) m.sphere(AX * sg, 1.04, 0.005, 0.056, 0.13, 0.056, c, D, B['fore' + SL(sg)]);
        else if (q >= 0) m.sphere(AX * sg, 1.17, 0.003, 0.062, 0.03, 0.062, dk(c, 0.85), 1, B['fore' + SL(sg)]);
      }
      if (g.coatLong) for (const sg of [1, -1]) m.box(0.1 * sg, 0.73, -0.01, 0.17, 0.34, 0.17, dk(c, 0.95), 0, B['leg' + SL(sg)]);
    }
    // hombreras improvisadas (de fútbol americano o de cuero), en un hombro (pads: 1) o en los dos
    if (g.pads != null) for (const sg of (g.padsOne ? [1] : [1, -1])) {
      m.sphere(AX * sg * 0.92, 1.455, 0.0, 0.085, 0.052, 0.09, g.pads, D, B['arm' + SL(sg)]);
      if (q >= 0) m.sphere(AX * sg * 0.95, 1.4, 0.0, 0.074, 0.02, 0.08, dk(g.pads, 0.8), 1, B['arm' + SL(sg)]);
    }
    // placas en el pecho (chapas y matrículas atornilladas a un chaleco)
    if (g.plates != null) {
      m.box(0, 1.34, fem ? 0.168 : 0.158, 0.22, 0.11, 0.016, g.plates, 0, B.chest);
      m.box(0.01, 1.215, 0.15, 0.2, 0.1, 0.016, dk(g.plates, 0.88), 0, B.spine2);
      m.box(0, 1.27, -0.16, 0.24, 0.2, 0.016, dk(g.plates, 0.9), 0, B.chest);
      if (q > 0) for (const [x, y] of [[-0.09, 1.38], [0.09, 1.38], [-0.08, 1.25], [0.08, 1.25]]) m.sphere(x, y, 0.17, 0.007, 0.007, 0.005, 0x2a2a2a, 1, y > 1.3 ? B.chest : B.spine2);
      if (q >= 0) m.box(0.03, 1.34, 0.17, 0.12, 0.03, 0.004, 0xd8d0b8, 0, B.chest);     // una franja de la matrícula
    }
    // canana cruzada (cartuchos o balas), de un hombro a la cadera
    if (g.bando != null) {
      for (const zz of [0.158, -0.158]) m.box(0, 1.24, fem && zz > 0 ? zz + 0.01 : zz, 0.05, 0.56, 0.014, g.bando, 0, B.chest, 0, zz > 0 ? 0.62 : -0.62);
      if (q > 0) for (let i = 0; i < 6; i++) { const t = i / 5 - 0.5; m.box(-t * 0.3, 1.24 + t * 0.4, 0.168, 0.016, 0.03, 0.012, i % 2 ? 0xb8862a : 0x8a2a22, 0, B.chest, 0, 0.62); }
    }
    // bolso cruzado al costado (con la correa por el pecho)
    if (g.satchel != null) {
      m.box(-0.205, 0.97, 0.03, 0.07, 0.17, 0.2, g.satchel, 0, B.hips);
      if (q >= 0) m.box(0, 1.27, 0.152, 0.03, 0.56, 0.01, dk(g.satchel, 0.8), 0, B.chest, 0, -0.62);
    }
    // bolsa en el muslo
    if (g.pouch != null) m.box(0.16, 0.76, 0.02, 0.06, 0.13, 0.11, g.pouch, 0, B.legL);
    // guantes (sin dedos: los nudillos al aire)
    if (g.gloves != null) for (const sg of [1, -1]) m.sphere(AX * sg, 0.875, 0.006, 0.047, 0.055, 0.05, g.gloves, D, B['hand' + SL(sg)]);
    // vendas o trapos atados en los antebrazos
    if (g.rags != null && q >= 0) for (const sg of [1, -1]) m.sphere(AX * sg, 0.98, 0.004, 0.05, 0.07, 0.05, g.rags, 1, B['fore' + SL(sg)]);
    // botas altas (caña hasta media pierna)
    if (g.boots != null) for (const sg of [1, -1]) m.sphere(0.1 * sg, 0.2, 0.012, 0.064, 0.13, 0.07, g.boots, D, B['shin' + SL(sg)]);
  }

  // ---------- Geometría del cuerpo ----------
  // o.lod: 1 = detallado (cerca), 0 = ligero (lejos), -1 = mínimo (muy lejos). o.outlineOnly: solo la silueta.
  // =====================================================================================================
  // Personaje low poly (o.lowpoly): cuerpo de pocas caras planas, cada una de un solo tono (como un modelo
  // low poly hecho a mano). La ropa va pintada en las caras (sin capas encima), la cara es una textura pintada
  // (sin nariz ni ojos modelados) y usa los mismos huesos que el resto, así que todas las animaciones sirven.
  // Pesa mucho menos que el cuerpo continuo del protagonista
  // =====================================================================================================
  const _lpc = new Map();
  function lpCol(hex) { let c = _lpc.get(hex); if (!c) { c = LC(hex); _lpc.set(hex, c); } return c; }
  // Tira de anillos con caras planas. rings[j][i] = { p, w }; col(x, y, z) da el color (hex) de cada cara por su
  // centro. capA / capB: { p, w } para cerrar los extremos. smooth: normales redondeadas (para el contorno)
  function lpStrip(m, rings, col, capA, capB, smooth) {
    const M = rings.length, N = rings[0].length;
    const ctr = rings.map((r) => { let x = 0, y = 0, z = 0; for (const q of r) { x += q.p[0]; y += q.p[1]; z += q.p[2]; } return [x / N, y / N, z / N]; });
    const tri = (A, B, C, ref) => {
      const ux = B.p[0] - A.p[0], uy = B.p[1] - A.p[1], uz = B.p[2] - A.p[2];
      const vx = C.p[0] - A.p[0], vy = C.p[1] - A.p[1], vz = C.p[2] - A.p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const cx = (A.p[0] + B.p[0] + C.p[0]) / 3, cy = (A.p[1] + B.p[1] + C.p[1]) / 3, cz = (A.p[2] + B.p[2] + C.p[2]) / 3;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) return;
      let flip = nx * (cx - ref[0]) + ny * (cy - ref[1]) + nz * (cz - ref[2]) < 0;
      nx /= l; ny /= l; nz /= l;
      if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      const c = lpCol(col(cx, cy, cz));
      const P = flip ? [A, C, B] : [A, B, C];
      for (const q of P) {
        let n = [nx, ny, nz];
        if (smooth) { const dx = q.p[0] - ref[0], dy = q.p[1] - ref[1], dz = q.p[2] - ref[2], dl = Math.hypot(dx, dy, dz) || 1; n = [dx / dl, dy / dl, dz / dl]; }
        m.vert(q.p, n, c, q.w);
      }
    };
    for (let j = 0; j < M - 1; j++) {
      const ref = [(ctr[j][0] + ctr[j + 1][0]) / 2, (ctr[j][1] + ctr[j + 1][1]) / 2, (ctr[j][2] + ctr[j + 1][2]) / 2];
      for (let i = 0; i < N; i++) {
        const a = rings[j][i], b = rings[j][(i + 1) % N], c = rings[j + 1][(i + 1) % N], d = rings[j + 1][i];
        tri(a, b, c, ref); tri(a, c, d, ref);
      }
    }
    if (capA) { const ref = ctr[Math.min(1, M - 1)]; for (let i = 0; i < N; i++) tri(capA, rings[0][(i + 1) % N], rings[0][i], ref); }
    if (capB) { const ref = ctr[Math.max(0, M - 2)]; for (let i = 0; i < N; i++) tri(capB, rings[M - 1][i], rings[M - 1][(i + 1) % N], ref); }
  }
  // sección superelíptica (frente +Z), con los vértices empezando a un costado (x+) y uno en el centro del frente
  function lpSect(i, N, w, df, db, zc, n) {
    const th = (i / N) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), e = 2 / (n || 2);
    return [w * Math.sign(c) * Math.pow(Math.abs(c), e), zc + (s > 0 ? df : db) * Math.sign(s) * Math.pow(Math.abs(s), e)];
  }

  // Cara pintada: ojos, cejas, nariz y boca en una textura (una por combinación de colores)
  const _faceTex = new Map();
  const FACE_BOX = { x0: -0.054, x1: 0.054, y0: 1.585, y1: 1.718 };
  function faceTexture(o) {
    const key = [o.skin, o.hair, o.lips, o.brow, o.eyes].join('_');
    if (_faceTex.has(key)) return _faceTex.get(key);
    const W = 256, H = Math.round(W * (FACE_BOX.y1 - FACE_BOX.y0) / (FACE_BOX.x1 - FACE_BOX.x0));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const X = (x) => (x - FACE_BOX.x0) / (FACE_BOX.x1 - FACE_BOX.x0) * W, Y = (y) => (FACE_BOX.y1 - y) / (FACE_BOX.y1 - FACE_BOX.y0) * H;
    const hex = (h, f) => { const c = new THREE.Color(U.shade(h, f || 1)); return 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')'; };
    const poly = (pts, fill, a) => { g.globalAlpha = a == null ? 1 : a; g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.fill(); g.globalAlpha = 1; };
    const skin = o.skin, brow = o.brow || U.shade(o.hair || 0x2a1a12, 1.1), lips = o.lips || 0xa86a62, iris = o.eyes || 0x3b2618;
    // mejillas (un poco de color) y sombras suaves: cuencas y bajo la nariz
    for (const sg of [1, -1]) {
      poly([[0.036 * sg, 1.655], [0.052 * sg, 1.652], [0.05 * sg, 1.636], [0.034 * sg, 1.64]], hex(0xc87a6a), 0.22);
      poly([[0.016 * sg, 1.692], [0.046 * sg, 1.693], [0.048 * sg, 1.678], [0.018 * sg, 1.676]], hex(skin, 0.82), 0.35);
    }
    for (const sg of [1, -1]) {
      const ex = 0.03 * sg;
      // ceja: cuña angulosa, más gruesa hacia dentro
      poly([[ex - 0.017 * sg, 1.7], [ex + 0.004 * sg, 1.7065], [ex + 0.019 * sg, 1.7025], [ex + 0.018 * sg, 1.699], [ex + 0.003 * sg, 1.7015], [ex - 0.016 * sg, 1.6955]], hex(brow));
      // ojo: almendra (blanco), iris, pupila, brillo y la línea de pestañas arriba
      poly([[ex - 0.0135 * sg, 1.6835], [ex - 0.004 * sg, 1.6885], [ex + 0.008 * sg, 1.688], [ex + 0.0145 * sg, 1.6845], [ex + 0.006 * sg, 1.6795], [ex - 0.006 * sg, 1.6795]], '#ece6dc');
      poly([[ex - 0.0055, 1.6885], [ex + 0.0055, 1.6885], [ex + 0.0065, 1.6835], [ex + 0.004, 1.6795], [ex - 0.004, 1.6795], [ex - 0.0065, 1.6835]], hex(iris));
      poly([[ex - 0.0025, 1.6865], [ex + 0.0025, 1.6865], [ex + 0.003, 1.683], [ex, 1.6808], [ex - 0.003, 1.683]], '#140d0a');
      poly([[ex + 0.0018, 1.6872], [ex + 0.0036, 1.6872], [ex + 0.0036, 1.6856], [ex + 0.0018, 1.6856]], '#f6f1e8');
      poly([[ex - 0.0145 * sg, 1.6835], [ex - 0.004 * sg, 1.6895], [ex + 0.008 * sg, 1.689], [ex + 0.0165 * sg, 1.6855], [ex + 0.0145 * sg, 1.6838], [ex + 0.008 * sg, 1.6872], [ex - 0.004 * sg, 1.6876], [ex - 0.013 * sg, 1.6828]], '#1a110d');
      poly([[ex - 0.012 * sg, 1.6795], [ex + 0.006 * sg, 1.679], [ex + 0.012 * sg, 1.6815], [ex + 0.006 * sg, 1.6782], [ex - 0.006 * sg, 1.6782]], hex(skin, 0.7), 0.5);
    }
    // nariz: solo la sombra de un costado y las fosas
    poly([[-0.004, 1.684], [0.001, 1.684], [-0.002, 1.656], [-0.008, 1.65]], hex(skin, 0.8), 0.45);
    poly([[-0.011, 1.649], [0.011, 1.649], [0.008, 1.6455], [-0.008, 1.6455]], hex(skin, 0.75), 0.5);
    for (const sg of [1, -1]) poly([[0.003 * sg, 1.6475], [0.0075 * sg, 1.648], [0.007 * sg, 1.6462], [0.003 * sg, 1.646]], '#3a2018', 0.7);
    // boca: labio de arriba en arco, el de abajo más lleno y la línea entre los dos
    poly([[-0.0175, 1.6165], [-0.006, 1.6205], [0, 1.619], [0.006, 1.6205], [0.0175, 1.6165], [0, 1.6155]], hex(lips, 0.88));
    poly([[-0.016, 1.6158], [0.016, 1.6158], [0.01, 1.6085], [0, 1.607], [-0.01, 1.6085]], hex(lips, 1.05));
    poly([[-0.006, 1.613], [0.007, 1.6128], [0.004, 1.611], [-0.004, 1.611]], hex(lips, 1.3), 0.5);
    poly([[-0.0185, 1.6165], [0, 1.6158], [0.0185, 1.6165], [0.0175, 1.6152], [0, 1.6147], [-0.0175, 1.6152]], hex(lips, 0.45));
    poly([[-0.008, 1.6025], [0.008, 1.6025], [0.004, 1.5995], [-0.004, 1.5995]], hex(skin, 0.82), 0.35);   // sombra del mentón
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
    _faceTex.set(key, tex);
    return tex;
  }
  // La cara pintada va sobre la cabeza, en el hueso de la cabeza (se mueve con ella)
  function faceDecal(o, headRestY) {
    const NX = 6, NY = 7, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY;
      const x = FACE_BOX.x0 + (FACE_BOX.x1 - FACE_BOX.x0) * u, y = FACE_BOX.y0 + (FACE_BOX.y1 - FACE_BOX.y0) * v;
      const [, z] = lpHead(x, y);
      pos.push(x, y - headRestY, z + 0.0016); uv.push(u, v);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 2, d = a + NX + 1;
      idx.push(a, b, c, a, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ map: faceTexture(o), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'face';
    mesh.renderOrder = 2;
    return mesh;
  }
  // Cabeza low poly: frente de la cara casi plana (para la cara pintada), mandíbula en cuña, cráneo ovalado.
  // [y, ancho, fondo delante, fondo detrás, z del centro]
  const LP_HEAD = [[1.548, 0.012, 0.012, 0.012, 0.05], [1.566, 0.034, 0.058, 0.03, 0.03], [1.59, 0.054, 0.078, 0.05, 0.016],
    [1.625, 0.068, 0.09, 0.075, 0.006], [1.665, 0.076, 0.097, 0.096, 0.002], [1.705, 0.079, 0.096, 0.104, 0.0],
    [1.74, 0.075, 0.088, 0.104, -0.004], [1.77, 0.062, 0.07, 0.092, -0.008], [1.79, 0.038, 0.042, 0.06, -0.01], [1.8, 0.012, 0.014, 0.02, -0.01]];
  // z del frente de la cabeza low poly en (x, y) (sobre el centro de la cara); devuelve [ancho, z]
  function lpHead(x, y) {
    const [w, df, , zc] = curve(LP_HEAD, y);
    const a = Math.min(0.999, Math.abs(x) / w);
    return [w, zc + df * Math.pow(1 - Math.pow(a, 2.4), 1 / 2.4) - 0.0012];
  }

  function lowBody(o) {
    const m = new G.Mesher(true);
    if (o.hero && !o.npc) ACTIVE_P = o.female ? PROF_F : PROF_M;   // (correas de la mochila)
    const far = o.lod === -1, low = o.lod === 0 || far;
    const sm = !!o.outlineOnly;
    const B = BI;
    const SK = o.skin, TOP = o.shirt, PANTS = o.pants, BOOT = o.shoes, HAIR = o.hair;
    const BELT = o.beltCol || 0x1c1a19, CUFF = o.cuff || 0xd9cdb6, STRAP = U.shade(BOOT, 0.62), SOLE = 0x22180f;
    const range = (a, b, n) => { const r = []; for (let k = 0; k <= n; k++) r.push(a + (b - a) * k / n); return r; };
    const pk = (list) => packW(list);
    // ---- pesos
    const TJ = [[1.0, B.hips, B.spine, 0.065], [1.14, B.spine, B.spine2, 0.065], [1.26, B.spine2, B.chest, 0.065], [1.515, B.chest, B.neck, 0.03]];
    const torsoW = (x, y) => {
      let base = chainW(y, TJ);
      const ax = Math.abs(x);
      // hombros y laterales altos del pecho con las clavículas; la punta del hombro, también con el brazo
      const k = U.smooth(sat((ax - 0.085) / 0.085)) * U.smooth(sat((y - 1.32) / 0.09)) * 0.8;
      const ka = U.smooth(sat((ax - 0.15) / 0.03)) * U.smooth(sat((y - 1.38) / 0.05)) * 0.25;
      const sd = x > 0 ? 'L' : 'R';
      let list = base.map(([b, w]) => [b, w * (1 - k)]).concat([[B['clav' + sd], k * (1 - ka)], [B['arm' + sd], k * ka]]);
      // ingle y cadera: la parte baja de los costados sigue a los muslos
      const kl = U.smooth(sat((0.95 - y) / 0.1)) * U.smooth(sat((ax - 0.02) / 0.07)) * 0.65;
      if (kl > 0) list = list.map(([b, w]) => [b, w * (1 - kl)]).concat([[B['leg' + sd], kl]]);
      return pk(list);
    };
    const armW = (y, A) => pk(chainW(-y, [[-1.462, B['clav' + A], B['arm' + A], 0.075], [-1.16, B['arm' + A], B['fore' + A], 0.05], [-0.91, B['fore' + A], B['hand' + A], 0.03], [-0.862, B['hand' + A], B['fing' + A], 0.018]]));
    const legW = (y, A) => pk(chainW(-y, [[-0.89, B.hips, B['leg' + A], 0.07], [-0.47, B['leg' + A], B['shin' + A], 0.05], [-0.07, B['shin' + A], B['foot' + A], 0.03]]));
    const neckW = (y) => pk(chainW(y, [[1.49, B.chest, B.neck, 0.035], [1.575, B.neck, B.head, 0.03]]));
    const WH = pk([[B.head, 1]]);
    const P = PROF_F;
    const F = o.female ? 1 : 0;

    // ---- torso (de la ingle al cuello): 12 lados, con uno en el centro del frente y otro en la espalda
    {
      const NT = far ? 6 : (low ? 8 : 12);
      const T = [[0.86, 0.11, 0.07, 0.088, 0, 2.2], [0.9, 0.162, 0.088, 0.112, -0.006, 2.4], [0.955, 0.178, 0.095, 0.122, -0.008, 2.5],
        [0.995, 0.166, 0.094, 0.114, -0.005, 2.5], [1.04, 0.146, 0.092, 0.102, -0.002, 2.4], [1.08, 0.138, 0.094, 0.097, 0, 2.4],
        [1.16, 0.143, 0.1, 0.096, 0.001, 2.5], [1.24, 0.153, 0.106, 0.1, 0.003, 2.6], [1.3, 0.158, 0.108, 0.103, 0.003, 2.7],
        [1.36, 0.165, 0.102, 0.103, 0, 2.8], [1.405, 0.17, 0.094, 0.097, -0.005, 2.8], [1.432, 0.156, 0.082, 0.085, -0.009, 2.6],
        [1.458, 0.115, 0.068, 0.073, -0.009, 2.4], [1.478, 0.075, 0.06, 0.064, -0.008, 2.2]];
      const ys = far ? [0.86, 0.955, 0.995, 1.08, 1.3, 1.432, 1.478] : (low ? [0.86, 0.9, 0.955, 0.995, 1.08, 1.24, 1.36, 1.432, 1.478] : T.map((r) => r[0]));
      const rings = ys.map((y) => {
        const [w, df, db, zc, n] = curve(T, y);
        const r = [];
        for (let i = 0; i < NT; i++) {
          let [x, z] = lpSect(i, NT, w, df, db, zc, n);
          if (z > zc && F) z += bustBump(x, y) * 1.15;
          // escote: el vértice del centro del frente baja un poco (una V suave)
          const yy = Math.abs(y - 1.36) < 1e-4 && i === NT / 4 ? y - 0.032 : y;
          r.push({ p: [x, yy, z], w: torsoW(x, yy) });
        }
        return r;
      });
      // la musculosa: borde recto con una V suave al frente, un poco más alta en la espalda; los tirantes van aparte
      const topCol = (x, y, z) => {
        if (y < 0.955) return PANTS;
        if (y < 0.995) return BELT;
        if (y < 1.085) return SK;
        if (y > 1.36) return SK;
        return TOP;
      };
      lpStrip(m, rings, topCol, { p: [0, 0.85, 0.0], w: pk([[B.hips, 1]]) }, null, sm);
      // tirantes finos: del borde de delante, por encima del hombro, al de la espalda
      if (!sm) for (const sg of [1, -1]) {
        const x = 0.088 * sg, surf = (y, front) => {
          const [w, df, db, zc, n] = curve(T, y), a = Math.min(0.999, Math.abs(x) / w);
          const k = Math.pow(1 - Math.pow(a, n), 1 / n);
          return front ? zc + df * k + (F ? bustBump(x, y) * 1.15 : 0) + 0.0045 : zc - db * k - 0.0045;
        };
        const yTop = 1.471;
        const pts = [1.352, 1.4, 1.44, 1.462].map((y) => [y, surf(y, true)]).concat([[yTop + 0.006, curve(T, yTop)[3]]], [1.462, 1.44, 1.4, 1.352].map((y) => [y, surf(y, false)]));
        for (let k = 0; k < pts.length - 1; k++) {
          const [y0, z0] = pts[k], [y1, z1] = pts[k + 1], dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dy, dz);
          m.box(x, (y0 + y1) / 2, (z0 + z1) / 2, 0.014, L + 0.008, 0.005, TOP, 0, B.chest, Math.atan2(dz, dy));
        }
      }
      // hebilla del cinturón
      if (!far && !sm) {
        const z = curve(T, 0.975)[1] + 0.006;
        m.box(0, 0.975, z, 0.042, 0.032, 0.008, 0xc9c4b8, 0, B.hips);
        m.box(0, 0.975, z + 0.003, 0.024, 0.014, 0.006, BELT, 0, B.hips);
      }
    }
    // ---- cuello
    {
      const N = low ? 5 : 8, rings = [];
      for (const y of (low ? [1.44, 1.52, 1.6] : [1.44, 1.5, 1.555, 1.6])) {
        const r = [];
        const rad = y < 1.5 ? 0.046 : 0.04;
        for (let i = 0; i < N; i++) { const [x, z] = lpSect(i, N, rad, rad, rad, y < 1.5 ? -0.004 : 0.004, 2); r.push({ p: [x, y, z], w: neckW(y) }); }
        rings.push(r);
      }
      lpStrip(m, rings, () => SK, null, null, sm);
    }
    // ---- cabeza: 12 lados, frente plana para la cara pintada
    {
      const N = far ? 6 : (low ? 8 : 12), ys = low ? [1.548, 1.59, 1.665, 1.74, 1.79] : LP_HEAD.map((r) => r[0]).slice(0, -1);
      const rings = ys.map((y) => {
        const [w, df, db, zc] = curve(LP_HEAD, y), r = [];
        for (let i = 0; i < N; i++) { const [x, z] = lpSect(i, N, w, df, db, zc, 2.4); r.push({ p: [x, y, z], w: WH }); }
        return r;
      });
      lpStrip(m, rings, (x, y, z) => (y < 1.575 && z < 0.04 ? U.shade(SK, 0.9) : SK), null, { p: [0, 1.8, -0.01], w: WH }, sm);
      // orejas: cuñas
      if (!low) for (const sg of [1, -1]) m.box(0.078 * sg, 1.662, -0.004, 0.012, 0.03, 0.02, U.shade(SK, 0.92), 0, B.head);
    }
    // ---- pelo: melena corta (bob) a la altura de la mandíbula, raya al costado y flequillo que cruza la frente
    if (HAIR != null) {
      const N = far ? 8 : (low ? 12 : 18), NV = far ? 2 : (low ? 3 : 5);
      const bottom = (th) => {
        const s = Math.sin(th), c = Math.cos(th);
        const fringe = U.clamp(1.712 - 0.04 * c, 1.672, 1.752);           // flequillo: más bajo hacia su izquierda (x+)
        return U.lerp(1.586 + 0.006 * Math.cos(th * 3), fringe, U.smooth(sat((s - 0.3) / 0.32)));
      };
      const pt = (th, y, t) => {
        const [w, df, db, zc] = curve(LP_HEAD, Math.min(1.799, y));
        const c = Math.cos(th), s = Math.sin(th), e = 2 / 2.4;
        let x = w * Math.sign(c) * Math.pow(Math.abs(c), e), z = zc + (s > 0 ? df : db) * Math.sign(s) * Math.pow(Math.abs(s), e);
        const R = Math.hypot(x, z - zc) || 1;
        return [x + x / R * t, y, z + (z - zc) / R * t];
      };
      const rings = [];
      for (let k = -1; k <= NV; k++) {
        const v = Math.max(0, k) / NV, r = [];
        for (let i = 0; i < N; i++) {
          const th = (i / N) * Math.PI * 2 + Math.PI / N;
          const yb = bottom(th), front = Math.sin(th) > 0.55;
          const y = yb + (1.8 - yb) * Math.pow(v, 0.85);
          // grosor: más cuerpo abajo (las puntas se abren un poco hacia fuera), fino en el flequillo
          let t = front ? 0.009 + 0.004 * v : 0.011 + 0.017 * Math.pow(1 - v, 1.6);
          if (k < 0) t = 0.002;                                                 // borde de dentro (se ve el grosor)
          const p = pt(th, y, t);
          // la raya: un pequeño surco del lado derecho (x-)
          if (k === NV && Math.abs(Math.cos(th) + 0.35) < 0.12) p[1] -= 0.004;
          r.push({ p, w: WH });
        }
        rings.push(r);
      }
      const hairCol = (x, y, z) => {
        const sh = 0.86 + 0.22 * fbm(x * 40 + 3, y * 40, z * 40) + (y > 1.76 ? 0.1 : 0);
        return U.shade(HAIR, sh);
      };
      lpStrip(m, rings, hairCol, null, { p: [0.004, 1.814, -0.012], w: WH }, sm);
      // mechón suelto que cae junto a la mejilla izquierda (como en el modelo)
      if (!low) {
        const rs = [];
        const SP = [[0.062, 1.72, 0.07], [0.074, 1.675, 0.074], [0.079, 1.625, 0.064], [0.078, 1.585, 0.05]];
        SP.forEach((c, k) => {
          const rr = U.lerp(0.012, 0.004, k / (SP.length - 1)), r = [];
          for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; r.push({ p: [c[0] + Math.cos(a) * rr * 0.7, c[1], c[2] + Math.sin(a) * rr], w: WH }); }
          rs.push(r);
        });
        lpStrip(m, rs, () => U.shade(HAIR, 0.95), null, { p: [0.077, 1.57, 0.046], w: WH }, sm);
      }
    }
    // ---- brazos (6 lados) y manos en manopla con el pulgar en cuña
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R', cx = P.AX * sg;
      const AR = [[1.448, 0.018, 0.02, 0.0], [1.43, 0.034, 0.036, 0.0], [1.39, 0.041, 0.042, 0.002], [1.33, 0.042, 0.043, 0.004],
        [1.24, 0.038, 0.04, 0.002], [1.165, 0.033, 0.034, -0.004], [1.1, 0.036, 0.037, -0.002], [1.02, 0.032, 0.034, 0.0], [0.93, 0.024, 0.027, 0.003]];
      const ys = low ? [1.448, 1.39, 1.24, 1.165, 1.02, 0.93] : AR.map((r) => r[0]);
      const NA = low ? 4 : 6;
      const rings = ys.map((y) => {
        const [rx, rz, zc] = curve(AR, y), r = [];
        for (let i = 0; i < NA; i++) { const th = (i / NA) * Math.PI * 2 + Math.PI / NA; r.push({ p: [cx + Math.cos(th) * rx, y, zc + Math.sin(th) * rz], w: armW(y, A) }); }
        return r;
      });
      lpStrip(m, rings, () => SK, null, null, sm);
      // mano: palma plana (de lado), los dedos juntos debajo
      const HR = [[0.935, 0.02, 0.026, 0.004], [0.905, 0.017, 0.036, 0.006], [0.872, 0.016, 0.04, 0.008], [0.842, 0.013, 0.035, 0.01], [0.812, 0.009, 0.026, 0.01]];
      const NHd = low ? 4 : 6;
      const hr = (low ? [HR[0], HR[2], HR[4]] : HR).map(([y, rx, rz, zc]) => {
        const r = [];
        for (let i = 0; i < NHd; i++) { const th = (i / NHd) * Math.PI * 2 + Math.PI / NHd; r.push({ p: [cx + Math.cos(th) * rx, y, zc + Math.sin(th) * rz], w: armW(y, A) }); }
        return r;
      });
      lpStrip(m, hr, () => SK, null, { p: [cx, 0.8, 0.008], w: armW(0.8, A) }, sm);
      if (!low) m.box(cx - 0.004 * sg, 0.885, 0.036, 0.012, 0.034, 0.012, U.shade(SK, 0.96), 0, B['hand' + A], 0.35);   // pulgar
    }
    // ---- piernas: pantalón (8 lados) hasta media pierna y la caña de la bota hasta debajo de la rodilla
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R', cx = 0.095 * sg;
      const LR = [[0.12, 0.043, 0.046, 0.0], [0.2, 0.046, 0.049, 0.0], [0.28, 0.051, 0.056, -0.006], [0.35, 0.055, 0.061, -0.01],
        [0.42, 0.053, 0.056, -0.004], [0.48, 0.053, 0.056, 0.005], [0.55, 0.057, 0.06, 0.004], [0.64, 0.066, 0.068, 0.004],
        [0.75, 0.076, 0.078, 0.006], [0.85, 0.084, 0.088, 0.004], [0.93, 0.083, 0.09, 0.0], [0.99, 0.066, 0.075, 0.0]];
      const BOOT_TOP = 0.515;
      // anillos: más donde cambia el color (borde de la bota y correas)
      const STR = [[0.448, 0.47], [0.355, 0.377], [0.262, 0.284], [0.17, 0.192]];
      let ys = low ? [0.99, 0.85, 0.6, BOOT_TOP + 0.036, BOOT_TOP, 0.12] : [0.99, 0.93, 0.85, 0.75, 0.64, 0.58, BOOT_TOP + 0.035, BOOT_TOP + 0.001, BOOT_TOP, 0.12];
      if (!low) for (const [a, b] of STR) ys.push(a, b);
      ys = ys.sort((a, b) => b - a);
      const NL = far ? 5 : (low ? 6 : 8);
      const rings = ys.map((y, j) => {
        let [rx, rz, zc] = curve(LR, y);
        // la caña de la bota rodea la pierna (un poco más ancha); la vuelta de arriba, algo más abierta
        if (y <= BOOT_TOP + 0.036) { const add = y > BOOT_TOP + 0.0005 ? 0.016 : 0.009; rx += add; rz += add; }
        if (STR.some(([a, b]) => y >= a - 1e-4 && y <= b + 1e-4)) { rx += 0.003; rz += 0.003; }
        const r = [];
        for (let i = 0; i < NL; i++) {
          const th = (i / NL) * Math.PI * 2 + Math.PI / NL;
          r.push({ p: [cx + Math.cos(th) * rx, y, zc + Math.sin(th) * rz], w: legW(y, A) });
        }
        return r;
      });
      const legCol = (x, y, z) => {
        if (y > BOOT_TOP + 0.036) {
          // vaquero azul oscuro gastado: más claro al frente del muslo, en la rodilla y en las costuras
          const wear = (z > 0.02 ? 0.5 * U.smooth(sat((y - 0.6) / 0.15)) * U.smooth(sat((0.9 - y) / 0.08)) : 0) +
            (z > 0.03 ? 0.6 * Math.exp(-Math.pow((y - 0.6) / 0.05, 2)) : 0) + 0.35 * (fbm(x * 30, y * 30, z * 30) - 0.45);
          return U.shade(PANTS, 1 + U.clamp(wear, -0.1, 0.55) * 0.55);
        }
        if (y > BOOT_TOP) return CUFF;
        if (STR.some(([a, b]) => y > a && y < b)) return STRAP;
        return U.shade(BOOT, 0.94 + 0.12 * fbm(x * 25, y * 25, z * 25));
      };
      lpStrip(m, rings, legCol, null, null, sm);
      // hebillas de las correas (por fuera)
      if (!low && !sm) for (const [a, b] of STR) {
        const y = (a + b) / 2, [rx, , zc] = curve(LR, y);
        m.box(cx + (rx + 0.022) * sg, y, zc + 0.01, 0.006, 0.02, 0.016, 0xb7ae9c, 0, B['shin' + A]);
      }
      // pie: prisma de seis lados de la talón a la punta, con la suela oscura y una correa sobre el empeine
      {
        const FR = [[-0.062, 0.034, 0.105], [-0.035, 0.042, 0.13], [0.025, 0.046, 0.105], [0.085, 0.047, 0.078], [0.14, 0.043, 0.06], [0.172, 0.034, 0.046]];
        const fw = (z, y) => {
          const kt = U.smooth(sat((z - 0.07) / 0.05));
          let l = [[B['foot' + A], 1 - kt], [B['toe' + A], kt]];
          const ks = U.smooth(sat((y - 0.085) / 0.04)) * (1 - kt) * 0.6;
          if (ks > 0) l = l.map(([b, w]) => [b, w * (1 - ks)]).concat([[B['shin' + A], ks]]);
          return pk(l);
        };
        const FRl = low ? [FR[0], FR[2], FR[4], FR[5]] : FR;
        const rings2 = FRl.map(([z, w, h]) => {
          const pts = [[-w, 0], [w, 0], [w, h * 0.5], [w * 0.72, h], [-w * 0.72, h], [-w, h * 0.5]];
          return pts.map(([dx, y]) => ({ p: [cx + dx, y, z], w: fw(z, y) }));
        });
        const footCol = (x, y, z) => (y < 0.014 ? SOLE : (z > 0.03 && z < 0.06 && y > 0.04 ? STRAP : U.shade(BOOT, 0.98)));
        const f0 = FRl[0], f1 = FRl[FRl.length - 1];
        lpStrip(m, rings2, footCol, { p: [cx, f0[2] * 0.5, f0[0] - 0.008], w: fw(f0[0], 0.05) }, { p: [cx, f1[2] * 0.42, f1[0] + 0.012], w: fw(f1[0], 0.02) }, sm);
      }
    }
    const g = m.build(skinWeight);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
    return g;
  }


  // =====================================================================================================
  // Personaje de malla (o.mesh): un modelo low poly hecho fuera del juego, con su textura (G.CharMesh, lo genera
  // tools/conv.py). Ya viene en la pose del esqueleto; aquí se le ponen los pesos de los huesos según la parte
  // del cuerpo de cada vértice (los mismos repartos que el cuerpo low poly) y caras planas (un tono por cara)
  // =====================================================================================================
  const _meshMat = new Map();
  function meshMaterial(id, dq, variant) {
    const V = variant && MESH_VARS[id] && MESH_VARS[id][variant - 1];
    const key = id + (V ? '|' + variant : '');
    let m = _meshMat.get(key);
    if (m) return m;
    const D = G.CharMesh && G.CharMesh[id];
    let tex;
    if (V) {
      // variante de color: la textura original recoloreada en un lienzo (ropa, pelo y piel), al cargarse
      tex = new THREE.Texture();
      const img = new Image();
      img.onload = () => { tex.image = recolorTexture(img, D, V, id); tex.needsUpdate = true; };
      img.src = D.tex;
    } else tex = new THREE.TextureLoader().load(D.tex);
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; tex.flipY = true;
    m = new THREE.MeshLambertMaterial({ map: tex, skinning: true });
    // ojos que brillan (los corredores): mapa de emisión
    if (D.emis) { const e = new THREE.TextureLoader().load(D.emis); e.encoding = THREE.sRGBEncoding; e.flipY = true; m.emissiveMap = e; m.emissive = new THREE.Color(0xfff2b0); m.emissiveIntensity = 1.6; }
    if (dq) useDQ(m);
    _meshMat.set(key, m);
    return m;
  }

  // Variantes de color de las mallas de infectados (0 = la original). Se recolorea la textura por zonas de la
  // malla (ver MESH_ZONES): top: remera/campera (torso y brazo hasta la manga), bottom: pantalón, hair: pelo
  // (la parte alta de la cabeza), skin: multiplica la piel (cara, cuello y brazos por debajo de la manga).
  // fungus: gira el tono del hongo (grados; negativo = más rojo) y sat lo satura; onlyHead: solo el de la cabeza.
  // pale: multiplica lo blanco pálido (la piel del temblante). La sangre no cambia
  const MESH_VARS = {
    // el corredor (malla de src/charmesh_corr.js, colores ya desaturados): buzo verde de manga larga y pantalón gris oscuro
    corr: [
      { top: 0x3a4658, bottom: 0x4a4236, hair: 0x1c1a19, skin: [0.72, 0.62, 0.54] },       // buzo azul marino, pantalón marrón, morocho de piel oscura
      { top: 0x6a3a36, bottom: 0x3e4a5e, hair: 0xa08a5c, skin: [1.0, 0.97, 0.93] },        // buzo bordó apagado, vaqueros, rubio pálido
      { top: 0x5a5a58, bottom: 0x5e5440, hair: 0x8a8984, skin: [0.86, 0.78, 0.66] },       // buzo gris, pantalón caqui, canoso, piel morena
      { top: 0x7a6a42, bottom: 0x2e2e30, hair: 0x3a2a1c, skin: [0.95, 0.88, 0.8] }         // buzo mostaza gastado, pantalón negro, castaño
    ],
    chasq3: [
      { top: 0x4a3a2c, bottom: 0x5a5440, skin: [0.9, 0.86, 0.8] },                         // camisa marrón, pantalón caqui
      { top: 0x2c3a52, bottom: 0x2a2a2e, skin: [1.0, 0.95, 0.92] }                          // camisa azul oscuro, pantalón negro
    ],
    // el otro chasqueado hombre (camisa a cuadros: se gira el tono y se conserva el dibujo)
    chasq4: [
      { topHue: 140, topSat: 1.1, bottom: 0x3a3e46, skin: [0.9, 0.86, 0.8] },              // cuadros rojos, pantalón gris
      { topHue: -105, topSat: 0.9, bottom: 0x4a4a36, skin: [1.0, 0.95, 0.92] }             // cuadros verdes, pantalón oliva
    ],
    // el acechador: el chasqueado hombre con el hongo de la cabeza rojizo (siempre una de estas)
    stalk: [
      { fungus: -26, sat: 1.15, onlyHead: true },
      { fungus: -26, sat: 1.15, onlyHead: true, top: 0x4a3a2c, bottom: 0x5a5440 },
      { fungus: -30, sat: 1.2, onlyHead: true, top: 0x2c3a52, bottom: 0x2a2a2e }
    ],
    // el temblante, más rojizo: el hongo tirando a rojo y la piel rosada; y otro grisáceo, con el hongo pálido
    temb: [
      { fungus: -30, sat: 1.2, pale: [1.0, 0.82, 0.8] },
      { fungus: 12, sat: 0.75, pale: [0.84, 0.86, 0.8] }
    ],
    // las chasqueadas
    chasq1: [
      { top: 0x3a4a5a, bottom: 0x3a3a3e, skin: [0.86, 0.8, 0.72] },                        // chaleco azul gris, pantalón gris oscuro
      { top: 0x6a2e2a, bottom: 0x4a4030, skin: [1.0, 0.95, 0.92] }                         // chaleco bordó, pantalón marrón
    ],
    chasq2: [
      { top: 0x5a3a4a, bottom: 0x2e3a52, skin: [1.0, 0.95, 0.92] },                        // musculosa ciruela, short de jean
      { top: 0x8a7a5a, bottom: 0x3a2e24, skin: [0.78, 0.68, 0.58] }                        // musculosa arena, short marrón, piel morena
    ],
    // el blindado: la chasqueada del chaleco, ennegrecida y con el hongo rojo oscuro (siempre esta)
    nemi: [
      { top: 0x141012, bottom: 0x120c0c, skin: [0.42, 0.2, 0.18], feet: true, fungus: -38, sat: 1.35, funV: 0.6 }
    ],
    // los Escorpiones (topHue/botHue: giran el tono de la prenda y conservan su dibujo: cuadros, parches,
    // chaleco encima; topSat/topVal: saturación y brillo). El rojo de los Escorpiones no se toca (keepRed)
    esc0: [
      { topHue: 180, topSat: 0.8, botHue: 30, hair: 0x1c1a19, skin: [0.7, 0.6, 0.52] },                 // remera azul petróleo, pantalón oliva, morocho de piel oscura
      { topHue: -20, topVal: 0.85, botHue: 190, botSat: 0.5, hair: 0xb59a5c, skin: [1.0, 0.97, 0.93] }, // remera bordó, pantalón gris pizarra, rubio
      { topVal: 0.55, topSat: 0.5, botHue: 200, botSat: 0.4, hair: 0x3a2a1c, skin: [0.84, 0.74, 0.62] }  // chaleco oscuro, pantalón gris azulado, castaño de piel morena
    ],
    esc1: [
      { top: 0x1c1c1e, bottom: 0x3a3d40, skin: [0.68, 0.58, 0.5] },        // cuero negro, pantalón gris, piel oscura
      { top: 0x5a4630, bottom: 0x3a4430, skin: [0.95, 0.9, 0.86] },        // cuero marrón claro, pantalón verde militar
      { top: 0x34402e, bottom: 0x5a4a38, skin: [0.84, 0.74, 0.62] }        // campera verde oscura, pantalón marrón, piel morena
    ],
    esc2: [
      { topHue: 200, topSat: 0.9, bottom: 0x3a3e46, hair: 0x3a2a1c },                               // cuadros azules, pantalón gris, castaño
      { topHue: 100, topSat: 0.85, bottom: 0x5a4a38, hair: 0x1c1a19, skin: [0.72, 0.6, 0.5] },       // cuadros verdes, pantalón marrón, morocho
      { topHue: 250, topSat: 0.6, botHue: 180, botSat: 0.5, hair: 0x5a3a22, skin: [0.84, 0.74, 0.62] }  // cuadros violáceos, pantalón gris azulado, castaño
    ],
    escf1: [
      { topHue: 180, topSat: 1.5, topVal: 0.8, botHue: 40, hair: 0x2a1e1a },                                  // campera de jean marrón, pantalón ocre, pelo oscuro
      { topHue: -90, topSat: 0.55, hair: 0xb8402a, skin: [0.76, 0.63, 0.53] },                       // campera verde, pelirroja, piel morena
      { topVal: 0.5, topSat: 0.6, botHue: 180, botSat: 0.6, hair: 0xd8d0b0 }                        // jean oscuro, pantalón gris azulado, platinada
    ],
    escf2: [
      { topHue: 180, topSat: 0.7, botHue: 60, hair: 0x1c1a19, skin: [0.7, 0.58, 0.5] },             // musculosa gris azulada, camuflaje verde, morocha
      { topHue: 90, topSat: 0.8, botHue: -40, botSat: 0.8, hair: 0x8a3a1e, skin: [1.0, 0.96, 0.94] }, // musculosa verde, camuflaje pardo rojizo, pelirroja
      { topVal: 0.45, topSat: 0.5, botHue: 200, botSat: 0.4, hair: 0xd8d0b0 }                         // musculosa negra, camuflaje gris azulado, platinada
    ],
    // el líder: siempre una de las tres
    esclid: [
      { top: 0x1a1a1c, bottom: 0x2a2a2e },        // todo negro
      { top: 0x5a3e2a, bottom: 0x6a5a40 },        // cuero marrón, pantalón caqui
      { top: 0x2e3a28, bottom: 0x3a3a3c }         // campera verde militar, pantalón gris
    ]
  };
  for (const k of ['esc0', 'esc1', 'esc2', 'escf1', 'escf2', 'esclid']) MESH_VARS[k].forEach((v) => { v.keepRed = true; });
  for (const k of ['chasq1', 'chasq2', 'chasq3', 'chasq4', 'nemi']) MESH_VARS[k].forEach((v) => { v.keepFungus = true; });
  MESH_VARS.chasq2.forEach((v) => { v.keepSkin = true; });
  // zonas de cada malla (alturas en reposo): sleeve: hasta dónde baja la manga; hair: desde dónde es pelo u hongo
  const MESH_ZONES = { corr: { sleeve: 0.87, hair: 1.49, face: 1.41, neck: 1.38, waist: 0.97 }, chasq3: { sleeve: 1.18, hair: 1.68 }, stalk: { sleeve: 1.18, hair: 1.68 }, chasq4: { sleeve: 1.02, hair: 1.68, waist: 1.09 },
    chasq1: { sleeve: 1.46, hair: 1.62, waist: 1.02, shorts: 0.29 }, chasq2: { sleeve: 1.46, hair: 1.62, waist: 1.05, shorts: 0.58 },
    nemi: { sleeve: 1.46, hair: 1.62, waist: 1.02, shorts: 0.29 },
    esc0: { sleeve: 1.31, hair: 1.76 }, esc1: { sleeve: 0.97, hair: 1.9 }, esc2: { sleeve: 1.06, hair: 1.73 }, escf1: { sleeve: 0.94, hair: 1.66 },
    escf2: { sleeve: 1.46, hair: 1.74 }, esclid: { sleeve: 0.93, hair: 1.95 } };
  // mapa de zonas sobre la textura (canal rojo): 50 pelo/hongo, 100 cara y cuello, 150 remera, 200 pantalón, 250 piel
  // del brazo; 0 sin tocar (los pies). Se pintan los triángulos de la malla según su altura en reposo
  function zoneMap(D, W, H, Z0) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), d = D.data, P = d.wpos || d.pos, UV = d.uv, I = d.idx, R = d.reg, ZN = Z0 || {};
    const sleeve = ZN.sleeve != null ? ZN.sleeve : 0, hairY = ZN.hair != null ? ZN.hair : 1.68;
    const faceY = ZN.face != null ? ZN.face : 1.53, neckY = ZN.neck != null ? ZN.neck : 1.47, waistY = ZN.waist != null ? ZN.waist : 0.93;      // (cuello de la remera más alto)
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.lineWidth = 3; g.lineJoin = 'round';
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const y = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, x = Math.abs(P[a * 3] + P[b * 3] + P[c * 3]) / 3, arm = R[a] === 1 || R[a] === 2;
      let v = 0;
      if (R[a] === 5 || R[a] === 6 || (y < 0.3 && !arm)) v = 0;                     // (las botas, sin pintar)
      else if (arm) v = y < sleeve ? 250 : 150;
      else if (y > faceY) v = y > hairY ? 50 : 100;
      else if (y > neckY && x < 0.075) v = 100;                                       // (el cuello)
      else v = y > waistY ? 150 : (ZN.shorts && y < ZN.shorts ? 250 : 200);        // (shorts: las piernas desnudas son piel)
      if (!v) continue;
      const col = 'rgb(' + v + ',0,0)';
      g.fillStyle = col; g.strokeStyle = col;
      g.beginPath();
      for (const k of [a, b, c]) g.lineTo(UV[k * 2] * W, (1 - UV[k * 2 + 1]) * H);
      g.closePath(); g.fill(); g.stroke();
    }
    return g.getImageData(0, 0, W, H).data;
  }
  function recolorTexture(img, D, V, id) {
    const W = img.width, H = img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const im = g.getImageData(0, 0, W, H), px = im.data, Z = zoneMap(D, W, H, MESH_ZONES[id]);
    const rgb = (h) => (h == null ? null : [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]);
    const top = rgb(V.top), bot = rgb(V.bottom), hair = rgb(V.hair);
    const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    // la ropa toma el color nuevo con la luz (los pliegues y las manchas) de la original
    // (brillo medio de cada zona en la original: el color nuevo queda con ese brillo de media, y cada píxel
    // más claro u oscuro según su luz)
    const zs = {}, zn = {};
    for (let i = 0; i < px.length; i += 16) { const z = Z[i]; if (!z) continue; zs[z] = (zs[z] || 0) + lum([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255]); zn[z] = (zn[z] || 0) + 1; }
    let zcur = 0;
    const paint = (c, r, gg, b) => { const k = Math.min(1.8, lum([r, gg, b]) / Math.max(0.05, zs[zcur] / zn[zcur])); return [c[0] * k * 0.88 + r * 0.12, c[1] * k * 0.88 + gg * 0.12, c[2] * k * 0.88 + b * 0.12]; };
    const hsv2rgb = (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx > 0 ? (mx - mn) / mx : 0;
      let hue = 0;
      if (mx > mn) { hue = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; hue *= 60; if (hue < 0) hue += 360; }
      const warm = hue < 45 || hue > 335;
      if (warm && sat > 0.45 && mx < 0.75 && r > gg * 1.6) continue;        // sangre: roja intensa (no se toca)
      if (V.keepRed && (hue < 18 || hue > 342) && sat > 0.38 && mx > 0.35) continue;      // (el rojo de los Escorpiones)
      if (V.keepFungus && !V.fungus && hue > 12 && hue < 60 && sat > 0.35 && mx > 0.45) continue;     // (el hongo de los chasqueados: no gira con la ropa)
      if (V.keepSkin && (Z[i] === 150 || Z[i] === 200) && hue > 8 && hue < 40 && sat > 0.15 && sat < 0.55 && mx > 0.55) continue;     // (la panza al aire)
      const z = Z[i];
      zcur = z;
      let out = null;
      // el hongo (anaranjado o amarillo, saturado): gira de tono
      if (V.fungus && hue > 12 && hue < 60 && sat > 0.28 && mx > 0.35 && (!V.onlyHead || z === 50)) {
        const h2 = (hue + V.fungus + 360) % 360;
        out = hsv2rgb(h2, Math.min(1, sat * (V.sat || 1)), mx * (V.funV || 1));
      } else if (V.pale && sat < 0.16 && mx > 0.45) out = [r * V.pale[0], gg * V.pale[1], b * V.pale[2]];
      else if (z === 50 && hair && (mx < 0.72 || !warm)) out = paint(hair, r, gg, b);
      else if ((z === 100 || z === 250 || z === 50 || (z === 0 && V.feet)) && V.skin) out = [r * V.skin[0], gg * V.skin[1], b * V.skin[2]];
      else if (z === 150 && top) out = paint(top, r, gg, b);
      else if (z === 150 && (V.topHue != null || V.topSat || V.topVal)) out = hsv2rgb((hue + (V.topHue || 0) + 360) % 360, Math.min(1, sat * (V.topSat || 1)), Math.min(1, mx * (V.topVal || 1)));
      else if (z === 200 && bot) out = paint(bot, r, gg, b);
      else if (z === 200 && (V.botHue != null || V.botSat || V.botVal)) out = hsv2rgb((hue + (V.botHue || 0) + 360) % 360, Math.min(1, sat * (V.botSat || 1)), Math.min(1, mx * (V.botVal || 1)));
      if (!out) continue;
      px[i] = Math.min(255, out[0] * 255); px[i + 1] = Math.min(255, out[1] * 255); px[i + 2] = Math.min(255, out[2] * 255);
    }
    g.putImageData(im, 0, 0);
    return cv;
  }

  // Piel con cuaterniones duales (los personajes jugables): en vez de mezclar las matrices de los huesos (que en
  // los giros grandes, como al apuntar, aplasta y ensancha hombros y codos y estira el brazo), se mezclan giros y
  // desplazamientos por separado, así la malla conserva el volumen. Los huesos no se escalan nunca (si no, no vale)
  const DQ_PARS = [
    '#ifdef USE_SKINNING',
    'vec4 dqQ( mat4 m ) {',
    '  float tr = m[0][0] + m[1][1] + m[2][2]; float s;',
    '  if ( tr > 0.0 ) { s = sqrt( tr + 1.0 ) * 2.0; return vec4( ( m[1][2] - m[2][1] ) / s, ( m[2][0] - m[0][2] ) / s, ( m[0][1] - m[1][0] ) / s, 0.25 * s ); }',
    '  if ( m[0][0] > m[1][1] && m[0][0] > m[2][2] ) { s = sqrt( 1.0 + m[0][0] - m[1][1] - m[2][2] ) * 2.0; return vec4( 0.25 * s, ( m[1][0] + m[0][1] ) / s, ( m[2][0] + m[0][2] ) / s, ( m[1][2] - m[2][1] ) / s ); }',
    '  if ( m[1][1] > m[2][2] ) { s = sqrt( 1.0 + m[1][1] - m[0][0] - m[2][2] ) * 2.0; return vec4( ( m[1][0] + m[0][1] ) / s, 0.25 * s, ( m[2][1] + m[1][2] ) / s, ( m[2][0] - m[0][2] ) / s ); }',
    '  s = sqrt( 1.0 + m[2][2] - m[0][0] - m[1][1] ) * 2.0; return vec4( ( m[2][0] + m[0][2] ) / s, ( m[2][1] + m[1][2] ) / s, 0.25 * s, ( m[0][1] - m[1][0] ) / s );',
    '}',
    'vec4 dqMul( vec4 a, vec4 b ) { return vec4( a.w * b.xyz + b.w * a.xyz + cross( a.xyz, b.xyz ), a.w * b.w - dot( a.xyz, b.xyz ) ); }',
    'mat4 dqBlend( mat4 A, mat4 B, mat4 C, mat4 D, vec4 w ) {',
    '  vec4 r0 = dqQ( A ), r1 = dqQ( B ), r2 = dqQ( C ), r3 = dqQ( D );',
    '  if ( dot( r0, r1 ) < 0.0 ) r1 = -r1; if ( dot( r0, r2 ) < 0.0 ) r2 = -r2; if ( dot( r0, r3 ) < 0.0 ) r3 = -r3;',
    '  vec4 br = w.x * r0 + w.y * r1 + w.z * r2 + w.w * r3;',
    '  vec4 bd = 0.5 * ( w.x * dqMul( vec4( A[3].xyz, 0.0 ), r0 ) + w.y * dqMul( vec4( B[3].xyz, 0.0 ), r1 ) + w.z * dqMul( vec4( C[3].xyz, 0.0 ), r2 ) + w.w * dqMul( vec4( D[3].xyz, 0.0 ), r3 ) );',
    '  float l = max( length( br ), 1e-6 ); br /= l; bd /= l;',
    '  vec3 t = 2.0 * ( br.w * bd.xyz - bd.w * br.xyz + cross( br.xyz, bd.xyz ) );',
    '  float x = br.x, y = br.y, z = br.z, q = br.w;',
    '  return mat4( 1.0 - 2.0 * ( y * y + z * z ), 2.0 * ( x * y + z * q ), 2.0 * ( x * z - y * q ), 0.0,',
    '    2.0 * ( x * y - z * q ), 1.0 - 2.0 * ( x * x + z * z ), 2.0 * ( y * z + x * q ), 0.0,',
    '    2.0 * ( x * z + y * q ), 2.0 * ( y * z - x * q ), 1.0 - 2.0 * ( x * x + y * y ), 0.0, t, 1.0 );',
    '}',
    '#endif'].join('\n');
  const DQ_BASE = '#include <skinbase_vertex>\n#ifdef USE_SKINNING\n mat4 dqM = dqBlend( bindMatrixInverse * boneMatX * bindMatrix, bindMatrixInverse * boneMatY * bindMatrix, ' +
    'bindMatrixInverse * boneMatZ * bindMatrix, bindMatrixInverse * boneMatW * bindMatrix, skinWeight );\n#endif';
  const DQ_NORMAL = '#ifdef USE_SKINNING\n objectNormal = mat3( dqM ) * objectNormal;\n #ifdef USE_TANGENT\n objectTangent = mat3( dqM ) * objectTangent;\n #endif\n#endif';
  const DQ_VERT = '#ifdef USE_SKINNING\n transformed = ( dqM * vec4( transformed, 1.0 ) ).xyz;\n#endif';
  function useDQ(mat, extra) {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <skinning_pars_vertex>', '#include <skinning_pars_vertex>\n' + DQ_PARS)
        .replace('#include <skinbase_vertex>', DQ_BASE).replace('#include <skinnormal_vertex>', DQ_NORMAL).replace('#include <skinning_vertex>', DQ_VERT);
      if (extra) extra(sh);
    };
    mat.customProgramCacheKey = () => 'dq' + (extra ? '_o' : '');
  }
  // Transición larga entre torso y brazo sobre la propia malla. En la axila y el hombro, los triángulos que unen el
  // brazo con el costado tenían un vértice todo brazo y otro todo torso, y al subir el brazo (apuntar) se estiraban
  // hasta 5 veces su largo. Aquí los pesos del costado alto, la axila y el hombro se promedian con los de sus vecinos
  // varias pasadas, así el cambio se reparte en varios anillos de la malla. El brazo queda rígido (si recibiera peso
  // del pecho, su cara interna se quedaría atrás al levantarlo) y el antebrazo y la mano cuentan como brazo (que no
  // se filtren al costado). Los vértices repetidos por las costuras de la textura cuentan como uno.
  // (ya no se usa en ninguna malla: con las mallas en pose T, mezclar los pesos del brazo con el costado dejaba los
  // hombros cuadrados y un hueco en la axila; queda la mezcla corta del costado, como Di' Arco)
  const POSE_A = new Set();
  function smoothShoulderW(W, WP, R, I, wide) {
    const n = R.length, id = new Int32Array(n), byPos = new Map();
    for (let i = 0; i < n; i++) {
      const key = WP[i * 3].toFixed(3) + ',' + WP[i * 3 + 1].toFixed(3) + ',' + WP[i * 3 + 2].toFixed(3);
      if (!byPos.has(key)) byPos.set(key, i); id[i] = byPos.get(key);
    }
    const nb = new Map();
    const add = (a, b) => { a = id[a]; b = id[b]; if (a === b) return; let s = nb.get(a); if (!s) nb.set(a, s = new Set()); s.add(b); };
    for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; add(a, b); add(b, a); add(b, c); add(c, b); add(a, c); add(c, a); }
    const B = BI, toArm = new Map();
    for (const sd of ['L', 'R']) for (const k of ['fore', 'hand', 'fing']) toArm.set(B[k + sd], B['arm' + sd]);
    // (el borde del torso junto a la axila, desde 1,08 m: en las mallas de pose A la costura está más abajo; y la
    // parte de arriba del brazo, para que la transición quede repartida a los dos lados de la costura)
    // (solo en las mallas importadas en pose A; Di' Arco, la señora Paula y el hongomorfo, como siempre)
    const zone = wide ? (i) => (R[i] === 0 && Math.abs(WP[i * 3]) > 0.07 && WP[i * 3 + 1] > 1.08 && WP[i * 3 + 1] < 1.56) ||
      ((R[i] === 1 || R[i] === 2) && WP[i * 3 + 1] > 1.33)
      : (i) => R[i] === 0 && Math.abs(WP[i * 3]) > 0.07 && WP[i * 3 + 1] > 1.18 && WP[i * 3 + 1] < 1.56;
    const toMap = (w) => { const m = new Map(); for (let k = 0; k < 8; k += 2) if (w[k + 1] > 0) { const bn = toArm.get(w[k]) ?? w[k]; m.set(bn, (m.get(bn) || 0) + w[k + 1]); } return m; };
    const cur = new Map();
    for (let i = 0; i < n; i++) if (id[i] === i) cur.set(i, toMap(W[i]));
    const Z = [...cur.keys()].filter(zone);
    for (let it = 0; it < 8; it++) {
      const nxt = new Map();
      for (const i of Z) {
        const s = nb.get(i); if (!s || !s.size) continue;
        const m = new Map(); for (const [b, w] of cur.get(i)) m.set(b, w * 0.5);
        const f = 0.5 / s.size;
        for (const j of s) for (const [b, w] of cur.get(j)) m.set(b, (m.get(b) || 0) + w * f);
        nxt.set(i, m);
      }
      for (const [i, m] of nxt) cur.set(i, m);
    }
    for (let i = 0; i < n; i++) { const r = id[i]; if (zone(r)) W[i] = packW([...cur.get(r)]); }
  }

  function meshBody(o) {
    const D = G.CharMesh[o.mesh].data, B = BI;
    const P = D.pos, UV = D.uv, I = D.idx, R = D.reg;
    const WP = D.wpos || D.pos;          // (pose T: los pesos se calculan con los brazos y piernas en reposo)
    const TJ = [[1.0, B.hips, B.spine, 0.065], [1.14, B.spine, B.spine2, 0.065], [1.26, B.spine2, B.chest, 0.065], [1.515, B.chest, B.neck, 0.03]];
    const NJ = [[1.49, B.chest, B.neck, 0.035], [1.575, B.neck, B.head, 0.03]];
    const torsoW = (x, y) => {
      const ax0 = Math.abs(x);
      // por encima de 1,47: cuello y cabeza. Pero la parte de arriba de los hombros anchos (lejos del centro, por
      // debajo de la base del cráneo) sigue al hombro: si no, al subir el brazo se estira contra el cuello
      if (y > 1.47) {
        const kn = y > 1.56 ? 1 : U.smooth(sat((0.165 - ax0) / 0.035));
        if (kn >= 1) return packW(chainW(y, NJ));
        const sh = torsoW(x, 1.47), list = [];
        for (let k = 0; k < 8; k += 2) if (sh[k + 1] > 0) list.push([sh[k], sh[k + 1] * (1 - kn)]);
        for (const [bn, w] of chainW(y, NJ)) list.push([bn, w * kn]);
        return packW(list);
      }
      const ax = ax0, sd = x > 0 ? 'L' : 'R';
      const k = U.smooth(sat((ax - 0.085) / 0.085)) * U.smooth(sat((y - 1.32) / 0.09)) * 0.8;
      // el costado junto a la axila sigue al brazo de a poco (transición larga: no se estira de golpe al subirlo)
      const ka = U.smooth(sat((ax - 0.12) / 0.07)) * U.smooth(sat((y - 1.30) / 0.10)) * 0.45;
      let list = chainW(y, TJ).map(([b, w]) => [b, w * (1 - k)]).concat([[B['clav' + sd], k * (1 - ka)], [B['arm' + sd], k * ka]]);
      const kl = U.smooth(sat((0.95 - y) / 0.1)) * U.smooth(sat((ax - 0.02) / 0.07)) * 0.65;
      if (kl > 0) list = list.map(([b, w]) => [b, w * (1 - kl)]).concat([[B['leg' + sd], kl]]);
      return packW(list);
    };
    const armW = (y, A) => packW(chainW(-y, [[-1.43, B['clav' + A], B['arm' + A], 0.11], [-1.16, B['arm' + A], B['fore' + A], 0.05], [-0.91, B['fore' + A], B['hand' + A], 0.03], [-0.862, B['hand' + A], B['fing' + A], 0.018]]));
    const legW = (y, A) => packW(chainW(-y, [[-0.89, B.hips, B['leg' + A], 0.07], [-0.47, B['leg' + A], B['shin' + A], 0.05], [-0.07, B['shin' + A], B['foot' + A], 0.03]]));
    const footW = (y, z, A) => {
      const kt = U.smooth(sat((z - 0.07) / 0.05));
      let l = [[B['foot' + A], 1 - kt], [B['toe' + A], kt]];
      const ks = U.smooth(sat((y - 0.085) / 0.04)) * (1 - kt) * 0.6;
      if (ks > 0) l = l.map(([b, w]) => [b, w * (1 - ks)]).concat([[B['shin' + A], ks]]);
      return packW(l);
    };
    const wOf = (i) => {
      const x = WP[i * 3], y = WP[i * 3 + 1], z = WP[i * 3 + 2], r = R[i];
      if (r === 1 || r === 2) return armW(y, r === 1 ? 'L' : 'R');
      if (r === 3 || r === 4) return legW(y, r === 3 ? 'L' : 'R');
      if (r === 5 || r === 6) return footW(y, z, r === 5 ? 'L' : 'R');
      return torsoW(x, y);
    };
    const W = [];
    // (esqueleto propio: los pesos vienen pintados en el modelo)
    if (D.sw) for (let i = 0; i < R.length; i++) W.push(D.sw.slice(i * 8, i * 8 + 8));
    else { for (let i = 0; i < R.length; i++) W.push(wOf(i)); smoothShoulderW(W, WP, R, I, POSE_A.has(o.mesh)); }
    // caras planas: cada triángulo con sus propios vértices y la normal de la cara (el contorno usa normales suaves)
    const n = I.length, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    let sn = null;
    if (o.outlineOnly) {
      sn = new Float32Array(P.length);
      for (let t = 0; t < n; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const k of [a, b, c]) { sn[k] += nx; sn[k + 1] += ny; sn[k + 2] += nz; }
      }
      // los vértices en la misma posición (costuras de la textura) comparten la normal
      const byPos = new Map();
      for (let k = 0; k < P.length; k += 3) { const key = P[k].toFixed(4) + ',' + P[k + 1].toFixed(4) + ',' + P[k + 2].toFixed(4); const e = byPos.get(key); if (e) { e[0] += sn[k]; e[1] += sn[k + 1]; e[2] += sn[k + 2]; e.push(k); } else byPos.set(key, [sn[k], sn[k + 1], sn[k + 2], k]); }
      for (const e of byPos.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (let j = 3; j < e.length; j++) { sn[e[j]] = e[0] / l; sn[e[j] + 1] = e[1] / l; sn[e[j] + 2] = e[2] / l; } }
    }
    for (let t = 0; t < n; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let j = 0; j < 3; j++) {
        const vi = I[t + j], q = t + j;
        pos[q * 3] = P[vi * 3]; pos[q * 3 + 1] = P[vi * 3 + 1]; pos[q * 3 + 2] = P[vi * 3 + 2];
        uv[q * 2] = UV[vi * 2]; uv[q * 2 + 1] = UV[vi * 2 + 1];
        if (sn) { nor[q * 3] = sn[vi * 3]; nor[q * 3 + 1] = sn[vi * 3 + 1]; nor[q * 3 + 2] = sn[vi * 3 + 2]; }
        else { nor[q * 3] = nx; nor[q * 3 + 1] = ny; nor[q * 3 + 2] = nz; }
        const w = W[vi];
        for (let k = 0; k < 4; k++) { si[q * 4 + k] = w[k * 2] || 0; sw[q * 4 + k] = w[k * 2 + 1] || 0; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
    return g;
  }

  function bodyGeometry(o) {
    if (o.mesh && G.CharMesh && G.CharMesh[o.mesh]) return meshBody(o);
    if (o.lowpoly && !o.zombie) return lowBody(o);
    const m = new G.Mesher(true);
    const far = o.lod === -1;
    const hi = o.lod !== 0 && !far && !o.outlineOnly;
    const D = hi ? ((o.hero || o.zombie) ? 3 : 2) : (far ? 0 : 1);     // detalle de las esferas
    const hq = hi && (!!o.hero || !!o.zombie);   // protagonista e infectados: cabeza, manos y pies con más detalle
    const hero = hi && !!o.hero;          // el protagonista: más polígonos en silueta, articulaciones y ropa
    const C = hero ? 28 : (hi ? 16 : (far ? 6 : 9));    // lados de los cilindros
    const skin = o.skin, shirt = o.shirt, pants = o.pants, shoes = o.shoes || 0x2a2622;
    const sleeve = o.longSleeves ? shirt : skin;
    const detail = !o.outlineOnly && !far;
    const dark = (c, f) => U.shade(c, f);

    // ---- protagonista: torso, cuello, brazos y piernas de una pieza
    // protagonista e infectados: cuerpo de una pieza (también para el contorno amarillo, que sigue su forma)
    const cont = !!o.hero || !!o.zombie;
    if (cont) heroBody(m, o, hi ? 1 : 0);
    if (!cont) {
    // ---- pelvis y torso (tres tramos de columna)
    m.sphere(0, 0.93, 0, 0.165, 0.11, 0.115, pants, hero ? 4 : D, BI.hips);
    m.cyl(0, 1.03, 0, 0.152, 0.15, 0.14, shirt, C, BI.spine);
    m.cyl(0, 1.155, 0, 0.15, 0.162, 0.13, shirt, C, BI.spine2);
    m.cyl(0, 1.27, 0, 0.162, 0.185, 0.14, shirt, C, BI.chest);
    m.sphere(0, 1.35, 0, 0.19, 0.15, 0.115, shirt, hero ? 4 : D, BI.chest);
    if (hi) {
      // pecho, omóplatos y abdomen
      m.sphere(0.075, 1.33, 0.07, 0.085, 0.07, 0.06, shirt, 1, BI.chest);
      m.sphere(-0.075, 1.33, 0.07, 0.085, 0.07, 0.06, shirt, 1, BI.chest);
      m.sphere(0.08, 1.33, -0.07, 0.08, 0.09, 0.05, shirt, 1, BI.chest);
      m.sphere(-0.08, 1.33, -0.07, 0.08, 0.09, 0.05, shirt, 1, BI.chest);
      m.sphere(0, 1.1, 0.045, 0.12, 0.1, 0.11, shirt, 1, BI.spine2);
    }
    // trapecios: dan forma a los hombros (se mueven con las clavículas)
    for (const sg of [1, -1]) {
      m.sphere(0.1 * sg, 1.445, -0.01, 0.085, 0.045, 0.07, shirt, D, BI[sg > 0 ? 'clavL' : 'clavR']);
    }
    // cinturón
    if (detail && o.belt) m.cyl(0, 0.985, 0, 0.158, 0.158, 0.04, o.belt, C, BI.hips);
    // cuello de la camisa o chaqueta
    if (detail && o.collar) m.cyl(0, 1.475, -0.005, 0.07, 0.062, 0.05, o.collar, C, BI.chest);

    // ---- cuello y cabeza
    m.cyl(0, 1.52, 0, 0.05, 0.045, 0.1, skin, C, BI.neck);
    }
    // cabeza: de una pieza (con cara, pelo y coleta) en el protagonista y los infectados
    if (cont) {
      const v0 = m.count;
      heroHead(m, o, hi ? 1 : 0);
      // cara algo más corta y redonda: se aplasta un 6 % en vertical alrededor de los ojos
      for (let i = v0, n = m.count; i < n; i++) { const k = i * 3 + 1; m.pos[k] = 1.68 + (m.pos[k] - 1.68) * 0.94; }
      if (o.facet && !o.zombie) facetRange(m, v0, m.count);
      if (o.blind) blindGrowth(m, o, hi ? 1 : (far ? -1 : 0));
    }
    else {
    m.sphere(0, 1.665, 0.005, 0.1, 0.122, 0.112, skin, hi ? 3 : (far ? 1 : 2), BI.head);
    if (detail) {
      m.sphere(0, 1.605, 0.02, 0.07, 0.045, 0.07, o.beard != null ? o.beard : skin, hq ? 2 : D, BI.head);   // mandíbula
      m.sphere(0, 1.66, 0.108, 0.012, 0.018, 0.012, dark(skin, 0.92), 1, BI.head);            // nariz
      if (hi) {
        m.sphere(0.098, 1.665, 0, 0.014, 0.024, 0.012, dark(skin, 0.95), 1, BI.head);         // orejas
        m.sphere(-0.098, 1.665, 0, 0.014, 0.024, 0.012, dark(skin, 0.95), 1, BI.head);
        m.sphere(0, 1.705, 0.095, 0.06, 0.012, 0.02, dark(skin, 0.9), 1, BI.head);             // ceja
      }
      const eye = o.zombie ? 0xd8d4b8 : 0x1a1612;
      if (!o.facePlate) {
        m.sphere(0.038, 1.69, 0.098, 0.016, 0.012, 0.01, eye, 1, BI.head);
        m.sphere(-0.038, 1.69, 0.098, 0.016, 0.012, 0.01, eye, 1, BI.head);
      } else {
        m.sphere(-0.038, 1.69, 0.098, 0.016, 0.012, 0.01, eye, 1, BI.head);
      }
      if (o.zombie) m.sphere(0, 1.615, 0.1, 0.03, 0.012, 0.012, 0x3a1612, 1, BI.head);   // boca
    }
    if (o.hair != null) {
      m.sphere(0, 1.71, -0.012, 0.108, 0.1, 0.118, o.hair, D, BI.head);
      if (o.longHair && detail) m.sphere(0, 1.6, -0.07, 0.1, 0.12, 0.06, o.hair, 1, BI.head);
    }
    }

    // ---- brazos
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      const x = (o.female ? PROF_F.AX : 0.19) * sg, hs = o.female ? PROF_F.hand : 1;
      if (!cont) {
      m.sphere(x - 0.01 * sg, 1.415, 0, 0.058, 0.06, 0.058, shirt, D, BI['arm' + A]);       // hombro
      m.cyl(x + 0.004 * sg, 1.29, 0, 0.046, 0.054, 0.26, shirt, C, BI['arm' + A]);
      if (hi) m.sphere(x, 1.3, 0.012, 0.045, 0.075, 0.046, shirt, 1, BI['arm' + A]);         // bíceps
      m.sphere(x, 1.16, 0, 0.046, 0.046, 0.046, sleeve, D, BI['fore' + A]);                   // codo
      m.cyl(x, 1.04, 0, 0.037, 0.046, 0.24, sleeve, C, BI['fore' + A]);
      if (hi) m.sphere(x, 1.09, 0.008, 0.044, 0.07, 0.042, sleeve, 1, BI['fore' + A]);        // antebrazo
      if (detail && o.cuffs && o.longSleeves) m.cyl(x, 0.935, 0, 0.041, 0.041, 0.03, dark(shirt, 0.85), C, BI['fore' + A]);
      }
      // mano en forma de manopla con pulgar
      const palm = o.wraps != null && cont ? o.bandCol : skin;          // (vendas de boxeo: la palma vendada, los dedos al aire)
      m.sphere(x, 0.865 + 0.004 * (1 - hs), 0.008, 0.035 * hs * (palm !== skin ? 1.06 : 1), 0.05 * hs, 0.024 * hs * (palm !== skin ? 1.1 : 1), palm, hq ? 2 : D, BI['hand' + A]);
      m.sphere(x, 0.815 + 0.02 * (1 - hs), 0.01, 0.03 * hs, 0.03 * hs, 0.021 * hs, skin, 1, BI['fing' + A]);
      if (hi) m.sphere(x - 0.022 * sg * hs, 0.86, 0.025 * hs, 0.012 * hs, 0.03 * hs, 0.012 * hs, palm, 1, BI['hand' + A]);
    }

    // ---- piernas
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      const x = 0.1 * sg;
      if (!cont) {
      m.cyl(x, 0.69, 0, 0.066, 0.085, 0.44, pants, C, BI['leg' + A]);
      if (hi) m.sphere(x, 0.74, 0.02, 0.075, 0.13, 0.072, pants, 1, BI['leg' + A]);             // muslo
      m.sphere(x, 0.48, 0.008, 0.062, 0.062, 0.064, pants, D, BI['shin' + A]);                   // rodilla
      m.cyl(x, 0.28, 0, 0.046, 0.06, 0.4, pants, C, BI['shin' + A]);
      if (hi) m.sphere(x, 0.36, -0.02, 0.055, 0.1, 0.055, pants, 1, BI['shin' + A]);             // pantorrilla
      if (detail && o.pocket) m.box(x + 0.06 * sg, 0.7, 0.01, 0.03, 0.12, 0.1, dark(pants, 0.85), 0, BI['leg' + A]);
      }
      // zapato: talón, puntera y suela
      m.sphere(x, 0.06, 0.02, 0.055, 0.048, 0.09, shoes, hq ? 2 : D, BI['foot' + A]);
      m.sphere(x, 0.042, 0.12, 0.05, 0.036, 0.062, shoes, hq ? 2 : D, BI['toe' + A]);
      if (hi) {
        // (o.sneakers: zapatillas altas con suela blanca)
        const sole = o.sneakers ? 0xe9e6de : 0x1a1816, sh = o.sneakers ? 0.03 : 0.022;
        m.box(x, sh / 2, 0.03, 0.106, sh, 0.165, sole, 0, BI['foot' + A]);
        m.box(x, sh / 2, 0.13, 0.094, sh, 0.085, sole, 0, BI['toe' + A]);
        if (o.sneakers) {
          m.box(x, 0.004, 0.06, 0.108, 0.006, 0.25, 0x6a6862, 0, BI['foot' + A]);       // la banda gris de la suela
          m.sphere(x, 0.05, 0.14, 0.047, 0.03, 0.05, 0x26262a, 2, BI['toe' + A]);       // puntera
        }
      }
    }

    // ---- protagonista: botas altas con cordones, bolsillo lateral, pistolera y funda de la navaja
    if (hero) {
      for (const sg of [1, -1]) {
        const A = sg > 0 ? 'L' : 'R', lx = 0.1 * sg;
        m.cyl(lx, 0.135, 0.004, 0.058, 0.056, 0.15, shoes, C, BI['shin' + A]);                 // caña de la bota
        m.cyl(lx, 0.215, 0.004, 0.062, 0.062, 0.025, dark(shoes, 0.75), C, BI['shin' + A]);   // borde de la bota
        m.box(lx, 0.15, 0.058, 0.03, 0.09, 0.008, o.sneakers ? 0x55555a : dark(shoes, 0.7), 0, BI['shin' + A]);       // cordones
      }
      if (!o.dshorts) {
        m.box(0.186, 0.68, 0.012, 0.022, 0.12, 0.085, dark(pants, 0.82), 0, BI.legL);            // bolsillo lateral
        m.box(0.186, 0.735, 0.012, 0.026, 0.022, 0.09, dark(pants, 0.7), 0, BI.legL);            // tapa del bolsillo
      } else {
        // cordón de la cintura (las dos puntas colgando delante)
        for (const sg of [1, -1]) m.box(0.012 * sg, 0.945, 0.135, 0.004, 0.06, 0.004, 0xb8b6ae, 0, BI.hips, -0.15, 0.08 * sg);
      }
      const hx = o.dshorts ? -0.212 : -0.196;
      m.box(hx, 0.8, 0.008, 0.032, 0.16, 0.09, 0x2a2622, 0, BI.legR);                      // pistolera en el muslo
      m.box(hx, 0.88, 0.008, 0.034, 0.03, 0.095, 0x3a2a1c, 0, BI.legR);
      m.box(-0.19, 0.93, 0.0, 0.03, 0.03, 0.05, 0x2a2622, 0, BI.hips);                         // enganche al cinto
      m.box(o.female ? 0.176 : 0.19, 0.89, -0.035, 0.026, 0.12, 0.04, 0x3a2a1c, 0, BI.hips);   // funda de la navaja
    }

    // ---- mochila del superviviente
    if (detail && o.backpack) {
      const bp = o.backpack;
      m.box(0, 1.24, -0.2, 0.3, 0.38, 0.14, bp, 0, BI.chest);
      m.sphere(0, 1.42, -0.2, 0.15, 0.06, 0.075, bp, D, BI.chest);
      m.box(0, 1.12, -0.29, 0.22, 0.14, 0.05, dark(bp, 0.85), 0, BI.chest);        // bolsillo
      m.cyl(0, 1.06, -0.2, 0.06, 0.06, 0.26, 0x4a4436, C, BI.chest, 0, 0, Math.PI / 2); // saco de dormir
      for (const sg of [1, -1]) {
        m.box(0.1 * sg, 1.35, 0.1, 0.035, 0.22, 0.02, dark(bp, 0.7), 0, BI.chest, -0.15);   // correas
        m.box(0.11 * sg, 1.2, 0.12, 0.035, 0.12, 0.02, dark(bp, 0.7), 0, BI.chest, 0.1);
      }
    }

    // ---- infectados: ropa rota, manchas y hongos (inspirado, no copiado)
    if (o.zombie && detail) {
      const r = o.blood || U.mulberry32(1);
      for (let i = 0; i < (cont ? 0 : 4); i++) {
        const ang = r() * 6.28, y = 1.05 + r() * 0.4;
        m.sphere(Math.sin(ang) * 0.17, y, Math.cos(ang) * 0.11, 0.06 + r() * 0.05, 0.05 + r() * 0.05, 0.02, 0x5a1a14, 1, y > 1.27 ? BI.chest : (y > 1.12 ? BI.spine2 : BI.spine));
      }
      m.sphere(0.012, 1.607, 0.088, 0.036, 0.016, 0.02, 0x2e0e0b, 1, BI.head);      // boca ensangrentada
      // desgarros: piel a la vista en el torso
      for (let i = 0; i < (cont ? 0 : 2); i++) {
        const ang = r() * 6.28, y = 1.08 + r() * 0.3;
        m.sphere(Math.sin(ang) * 0.158, y, Math.cos(ang) * 0.12, 0.045, 0.06, 0.02, skin, 1, y > 1.27 ? BI.chest : BI.spine2);
      }
      const fl = o.fungus || 0;
      if (fl > 0) {
        const FUN = [0x6d5d3e, 0x7b6a48, 0x5a4b32, 0x8a7a55];
        const n = fl === 1 ? (hi ? 7 : 4) : (hi ? 16 : 8);
        for (let i = 0; i < n; i++) {
          // racimos en cabeza, cuello y hombros
          const where = r();
          let bx, by, bz, bone;
          if (where < 0.5) { const ang = r() * 6.28; bx = Math.sin(ang) * 0.09; by = 1.68 + r() * 0.06; bz = Math.cos(ang) * 0.1 - 0.02; bone = BI.head; }
          else if (where < 0.75) { bx = (r() - 0.5) * 0.1; by = 1.5 + r() * 0.05; bz = -0.04 - r() * 0.03; bone = BI.neck; }
          else { const sg = r() < 0.5 ? 1 : -1; bx = (0.08 + r() * 0.1) * sg; by = 1.42 + r() * 0.05; bz = (r() - 0.5) * 0.1; bone = BI[sg > 0 ? 'clavL' : 'clavR']; }
          const sz = 0.02 + r() * (fl === 2 ? 0.035 : 0.022);
          m.sphere(bx, by, bz, sz * 1.3, sz * 0.8, sz * 1.3, FUN[Math.floor(r() * FUN.length)], 1, bone);
        }
        if (o.facePlate && !o.blind) {
          // placa de hongo que cubre medio rostro, con láminas
          for (let i = 0; i < (hi ? 6 : 3); i++) {
            const yy = 1.64 + i * 0.018;
            m.sphere(0.035 + r() * 0.01, yy, 0.085 - i * 0.004, 0.06 - i * 0.004, 0.012, 0.04, FUN[i % FUN.length], 1, BI.head);
          }
          m.sphere(0.05, 1.68, 0.06, 0.07, 0.07, 0.06, 0x5d4f34, D, BI.head);
        }
      }
    }

    // ---- humanos enemigos: lo que los distingue (gorra, capucha, chaleco, máscara...)
    if (o.gear && !o.outlineOnly) gearGeometry(m, o, hi ? 1 : (far ? -1 : 0));

    if (o.zombie && o.temb && !o.hongo && detail) tembGrowth(m, o, hi ? 1 : 0);
    if (o.zombie && o.hongo) bloatGrowth(m, o, hi ? 1 : (detail ? 0 : -1));
    if (o.zombie && o.nemi) armorGrowth(m, o, hi ? 1 : (detail ? 0 : -1));
    const g = m.build(skinWeight);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
    return g;
  }

  // ---------- Personaje ----------
  function createHumanoid(o) {
    mats();
    const root = new THREE.Group();        // posición en el mundo y orientación
    const body = new THREE.Group();        // se inclina al caer
    root.add(body);

    const bones = BONES.map((b) => {
      const bone = new THREE.Bone();
      bone.name = b[0];
      bone.position.fromArray(b[2]);
      return bone;
    });
    BONES.forEach((b, i) => { if (b[1] >= 0) bones[b[1]].add(bones[i]); });
    // mujer: hombros más juntos (los brazos salen más cerca del cuello)
    if (o.female) { bones[BI.armL].position.x = PROF_F.AX - 0.035; bones[BI.armR].position.x = -(PROF_F.AX - 0.035); }
    if (o.scale) root.scale.setScalar(o.scale);
    // low poly: la cara pintada va en el hueso de la cabeza
    if (o.lowpoly && !o.zombie) bones[BI.head].add(faceDecal(o, REST[BI.head][1]));
    // malla en pose T (G.CharMesh[id].bind): los hombros donde los tiene el modelo
    const CM = o.mesh && G.CharMesh && G.CharMesh[o.mesh], MB = CM && CM.bind;
    // (4,5 cm más adentro que el hombro del modelo; 6,5 hundía los brazos en la cintura: así el brazo cuelga pegado al costado, sin hueco en la axila ni el
    // hombro saliente)
    if (MB && MB.armX) { bones[BI.armL].position.x = MB.armX - 0.045; bones[BI.armR].position.x = -(MB.armX - 0.045); }
    // malla con esqueleto propio (de un .glb, tools/glbconv.py): cada hueso donde lo tiene el modelo
    if (MB && MB.bones) for (const k in MB.bones) if (BI[k] !== undefined) bones[BI[k]].position.fromArray(MB.bones[k]);
    // hombros y cuello a la altura de los de la malla (cuando se le acortó el tronco)
    // brazos más cortos (solo infectados: el agarre de las armas del jugador cuenta con el largo normal)
    if (MB && MB.armK) for (const A of ['L', 'R']) { bones[BI['fore' + A]].position.y *= MB.armK; bones[BI['hand' + A]].position.y *= MB.armK; }
    if (MB && MB.dy) { bones[BI.clavL].position.y += MB.dy; bones[BI.clavR].position.y += MB.dy; bones[BI.neck].position.y += MB.dy; }
    // piernas cortas (el hongomorfo): huesos de las piernas más cortos y la cadera más baja (la pose la vuelve a
    // poner a su altura en cada fotograma: después se le suma hipOff)
    if (MB && MB.legBones) {
      for (const A of ['L', 'R']) { bones[BI['shin' + A]].position.y *= MB.legBones.k; bones[BI['foot' + A]].position.y *= MB.legBones.k; }
      bones[BI.hips].position.y += MB.legBones.off;
    }

    const geoHigh = bodyGeometry(o);
    const mesh = new THREE.SkinnedMesh(geoHigh, CM ? meshMaterial(o.mesh, !!o.hero && !o.zombie, o.meshVar) : (o.zombie ? matZombie : matPlayer));
    mesh.add(bones[0]);
    // se enlaza con los brazos y las piernas como en el modelo (en cruz y abiertas); al volver los huesos a su
    // reposo, la malla baja los brazos y junta las piernas sola
    if (MB) { if (MB.q) bindPoseQ(bones, MB); else bindPoseT(bones, MB); }
    bones[0].updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    if (MB) { for (const b of bones) b.quaternion.set(0, 0, 0, 1); bones[0].updateMatrixWorld(true); }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);

    const rest = bones.map((b) => b.position.clone());
    const h = {
      root, body, mesh, bones, rest, zombie: !!o.zombie, opts: o, geoHigh, geoLow: null, lod: 1, hipOff: MB && MB.legBones ? MB.legBones.off : 0,
      // (esqueleto propio con brazos más cortos o largos: el arma se acerca o se aleja del pecho en proporción)
      // (palm: de la muñeca a la palma; con esqueleto propio, media mano hasta los nudillos)
      palm: MB && MB.bones && MB.bones.fingL ? Math.abs(MB.bones.fingL[1]) * 0.5 : 0.06,
      gunK: MB && MB.bones && MB.bones.foreL && MB.bones.handL && MB.bones.fingL ? (Math.abs(MB.bones.foreL[1]) + Math.abs(MB.bones.handL[1]) + Math.abs(MB.bones.fingL[1]) * 0.5) / 0.59 : 1,
      // (y medido desde su hombro derecho, en el espacio del pecho: el del esqueleto normal es GUN_SH)
      gunS: MB && MB.bones && MB.bones.clavR && MB.bones.armR ? [0, 1, 2].map((i) => MB.bones.clavR[i] + MB.bones.armR[i]) : null,
      weapon: null, weaponId: null
    };
    BONES.forEach((b, i) => { h[b[0]] = bones[i]; });
    return h;
  }

  // Pose de enlace de una malla en pose T: brazo y pierna apuntando hacia donde los tiene el modelo; el pie,
  // derecho (en el mundo) como en el modelo
  const _bpDown = new THREE.Vector3(0, -1, 0), _bpDir = new THREE.Vector3();
  // (esqueleto propio: el giro de cada hueso en la pose del modelo, ya calculado al convertirlo)
  function bindPoseQ(bones, MB) { for (const k in MB.q) if (BI[k] !== undefined) bones[BI[k]].quaternion.fromArray(MB.q[k]); }
  function bindPoseT(bones, MB) {
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R';
      bones[BI['arm' + A]].quaternion.setFromUnitVectors(_bpDown, _bpDir.set(MB.arm[0] * sg, MB.arm[1], 0).normalize());
      const leg = bones[BI['leg' + A]];
      leg.quaternion.setFromUnitVectors(_bpDown, _bpDir.set(MB.leg[0] * sg, MB.leg[1], 0).normalize());
      bones[BI['foot' + A]].quaternion.copy(leg.quaternion).invert();
    }
  }

  // Piernas algo abiertas desde la cadera (mallas que lo piden, como el temblante): las dos piernas giran hacia
  // fuera sobre la cadera (no se ensancha) y el pie se endereza para seguir plano en el suelo
  const _lsR = new THREE.Quaternion(), _lsQ = new THREE.Quaternion(), _lsI = new THREE.Quaternion(), _lsZ = new THREE.Vector3(0, 0, 1);
  function legSpread(h, a) {
    for (const sg of [1, -1]) {
      const A = sg > 0 ? 'L' : 'R', leg = h['leg' + A], foot = h['foot' + A];
      _lsR.setFromAxisAngle(_lsZ, a * sg);
      _lsQ.copy(leg.quaternion).multiply(h['shin' + A].quaternion);          // pierna y rodilla
      _lsI.copy(_lsQ).invert().multiply(_lsR.clone().invert()).multiply(_lsQ);
      foot.quaternion.premultiply(_lsI);
      leg.quaternion.premultiply(_lsR);
    }
  }

  // Contorno amarillo (como al apuntar en el original): una copia de la malla,
  // un poco inflada y vista por dentro, que comparte el esqueleto
  let outlineMat = null, outlineMatDQ = null;
  function setOutline(h, on) {
    if (G.Models && G.Models.outlineOff) on = false;          // (opción: sin contorno en el enemigo marcado)
    if (on && !h.outline) {
      // (los jugables con malla usan la piel de cuaterniones duales: el contorno también, para que no se despegue)
      if (!outlineMatDQ) {
        outlineMatDQ = new THREE.MeshBasicMaterial({ color: 0xf2c230, side: THREE.BackSide, skinning: true });
        outlineMatDQ.toneMapped = false;
        useDQ(outlineMatDQ, (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.03;'); });
      }
      if (!outlineMat) {
        outlineMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, side: THREE.BackSide, skinning: true });
        outlineMat.toneMapped = false;
        outlineMat.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.03;');
        };
      }
      const geo = bodyGeometry(Object.assign({}, h.opts, { outlineOnly: true, blood: null }));
      const dqo = h.opts && h.opts.mesh && h.opts.hero && !h.opts.zombie && G.CharMesh && G.CharMesh[h.opts.mesh];
      const o = new THREE.SkinnedMesh(geo, dqo ? outlineMatDQ : outlineMat);
      o.bind(h.mesh.skeleton, h.mesh.bindMatrix);
      o.frustumCulled = false;
      h.body.add(o);
      h.outline = o;
    }
    if (h.outline) h.outline.visible = !!on;
  }

  // Detalle según la distancia: lejos se usa una malla más ligera con los mismos huesos
  // 1 = cerca, 0 = media distancia, -1 = muy lejos (malla mínima)
  let lodBuiltAt = -1e9;
  function setLOD(h, level, force) {
    if (h.lod === level) return;
    // las mallas hechas fuera (G.CharMesh) ya son ligeras: la misma en todas las distancias
    if (h.opts && h.opts.mesh && G.CharMesh && G.CharMesh[h.opts.mesh]) { h.lod = level; return; }
    // la malla de ese nivel aún no existe: se arma, pero como mucho una cada 80 ms (si salen varios a la vez,
    // los demás esperan con la que tienen; así no se juntan en un mismo fotograma)
    if (!force && ((level === 0 && !h.geoLow) || (level === -1 && !h.geoFar))) {
      const now = performance.now();
      if (now - lodBuiltAt < 80) return;
      lodBuiltAt = now;
    }
    h.lod = level;
    if (level === 0 && !h.geoLow) h.geoLow = bodyGeometry(Object.assign({}, h.opts, { lod: 0 }));
    if (level === -1 && !h.geoFar) h.geoFar = bodyGeometry(Object.assign({}, h.opts, { lod: -1 }));
    h.mesh.geometry = level === 1 ? h.geoHigh : (level === 0 ? h.geoLow : h.geoFar);
  }

  function disposeHumanoid(h) {
    h.geoHigh.dispose();
    if (h.geoLow) h.geoLow.dispose();
    if (h.geoFar) h.geoFar.dispose();
    if (h.outline) h.outline.geometry.dispose();
    h.mesh.skeleton.dispose && h.mesh.skeleton.dispose();
  }

  // Coloca un arma en la mano derecha. Las armas de fuego y el arco van en un soporte
  // (h.gunAnchor) unido al pecho: la pose lo mueve y las manos lo siguen con IK.
  function setWeapon(h, id, opt) {
    const key = (id || '') + (opt && opt.sil ? '_sil' : '');
    if (h.weaponKey === key) return;
    if (h.weapon) { if (h.weapon.parent) h.weapon.parent.remove(h.weapon); h.weapon = null; }
    h.gun = null; h.weaponCat = null;
    h.weaponKey = key;
    h.weaponId = id;
    if (!id || id === 'manos') return;
    mats();
    const wd = G.Weapons.get(id);
    if (wd.cat === 'gun') { setGun(h, id, wd, opt); return; }
    const w = new THREE.Mesh(weaponGeometry(id), matWeapon);
    w.castShadow = true;
    const cat = wd.cat;
    // ángulo en la mano: la lanza apunta hacia abajo en reposo, el resto hacia delante y abajo
    w.rotation.x = cat === 'spear' ? Math.PI - 0.08 : 2.35;
    w.position.set(0, -0.05, 0.015);
    if (cat === 'spear') w.position.y = 0.5;   // se agarra por el medio (la punta queda lejos)
    h.handR.add(w);
    h.weapon = w;
    // dónde va la mano izquierda (distancia desde el agarre de la derecha, a lo largo del mango)
    // (las de dos manos: la izquierda justo encima de la derecha, las dos manos juntas en el mango)
    h.weaponGrip = cat === 'spear' ? 0.12 : (G.Weapons.isLong(wd) ? 0.105 : 0.09);
    h.weaponCat = cat;
  }

  // Arma de fuego o arco. holder: origen en el agarre, cañón hacia +Z, arriba +Y
  const MUZZLE = { pistol: [0, 0.18, -0.036], shotgun: [0, 0.71, -0.039], rifle: [0, 0.74, -0.03], bow: [0, 0.7, 0] };
  // Mallas importadas: dónde queda su palma respecto del agarre (medido con tools/gripgap.py contra Di' Arco): el arma
  // se corre eso dentro de la mano, para que la empuñadura caiga en la palma y no flote debajo del puño
  const MESH_GRIP = { esc0: [-0.01, 0.019, -0.043], esc1: [-0.012, 0.015, -0.06], esc2: [0.005, -0.009, -0.022], escf1: [-0.006, 0.006, -0.043], escf2: [-0.006, 0.006, 0.008], esclid: [-0.025, 0.028, -0.061]};
  function setGun(h, id, wd, opt) {
    if (!h.gunAnchor) {
      h.gunAnchor = new THREE.Group();
      h.chest.add(h.gunAnchor);
    }
    h.gunAnchorOk = false;
    const kind = wd.anim || wd.gun;          // animación: la de la pistola, la escopeta, el rifle o el arco
    const holder = new THREE.Group();
    const bodyId = kind === 'pistol' ? (id === 'pistola' ? (opt && opt.sil ? 'pistola_sil' : 'pistola') : id) : (id + '_body');
    const mesh = new THREE.Mesh(weaponGeometry(bodyId), matWeapon);
    mesh.castShadow = true;
    mesh.rotation.x = Math.PI / 2;         // +Y de la geometría -> +Z (adelante); -Z -> arriba
    holder.add(mesh);
    const go = h.opts && h.opts.mesh && MESH_GRIP[h.opts.mesh];
    if (go) mesh.position.set(go[0], go[1], go[2]);
    const g = { kind, holder, mesh, part: null, arrow: null, string: null, muzzle: new THREE.Object3D() };
    const mz = wd.muzzle || MUZZLE[kind];
    g.muzzle.position.set(mz[0], mz[1] + (opt && opt.sil ? 0.15 : 0), mz[2]);
    mesh.add(g.muzzle);
    if (kind === 'shotgun' && !wd.noPump) {
      g.part = new THREE.Mesh(weaponGeometry('escopeta_pump'), matWeapon);
      g.part.position.set(0, 0.3, -0.016); g.partRest = 0.3;
      mesh.add(g.part);
    } else if (kind === 'rifle') {
      g.part = new THREE.Mesh(weaponGeometry('rifle_bolt'), matWeapon);
      g.part.position.set(0, 0.0, -0.03); g.partRest = 0.0;
      mesh.add(g.part);
    } else if (kind === 'bow') {
      g.arrow = new THREE.Mesh(weaponGeometry('flecha'), matWeapon);
      mesh.add(g.arrow);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.07, -0.56, 0, -0.07, 0, 0, -0.07, 0.56], 3));
      g.string = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xd8d0b8 }));
      g.string.frustumCulled = false;
      mesh.add(g.string);
    }
    h.gunAnchor.add(holder);
    h.weapon = holder;
    h.gun = g;
  }

  // Armas largas a la espalda (hasta dos), cruzadas en diagonal por fuera de la mochila
  const NO_PACKS = true;     // de momento ningún personaje lleva la mochila a la vista (las armas van como en Di' Arco)
  // Mochila chica (opts.miniPack: true o 'gris', 'marron'): low poly, semi cuadrada, gris azulado gastado, más chica que el torso.
  // Va aparte de la mochila grande: no cambia dónde se cuelgan las armas
  // colores: cuerpo, oscuro (solapa, bolsillo, fondo), correas, tapa gastada
  const MINI_COL = { gris: [0x5d6873, 0x48525c, 0x353c43, 0x6c7782], marron: [0x6e5640, 0x564230, 0x3a2e24, 0x80684e] };
  function miniPackGeometry(kind) {
    const col = MINI_COL[kind] || MINI_COL.gris, key = '__miniPack' + (MINI_COL[kind] ? kind : 'gris');
    if (geoCache[key]) return geoCache[key];
    const m = new G.Mesher();
    const [B, D, S, L] = col, MP = MINI_PACK;
    const cx = 0, cy = MP.y, cz = MP.z, w = MP.w, hh = MP.h, d = MP.d;
    m.box(cx, cy, cz, w, hh, d, B);                                         // cuerpo
    m.box(cx, cy + hh * 0.5 - 0.005, cz - 0.004, w * 0.9, 0.03, d * 0.92, L);    // tapa de arriba (más clara, gastada)
    m.box(cx, cy + hh * 0.28, cz - d * 0.5 - 0.004, w * 0.96, hh * 0.32, 0.012, D); // solapa
    m.box(cx, cy - hh * 0.2, cz - d * 0.5 - 0.016, w * 0.62, hh * 0.34, 0.03, D);  // bolsillo de delante
    m.box(cx, cy - hh * 0.06, cz - d * 0.5 - 0.016, 0.03, 0.02, 0.034, S);      // hebilla
    m.box(cx, cy - hh * 0.5 + 0.01, cz, w * 0.94, 0.02, d * 0.9, D);              // fondo
    for (const sg of [-1, 1]) {
      m.box(sg * w * 0.32, cy + hh * 0.1, cz + d * 0.5 + 0.004, 0.035, hh * 0.9, 0.012, S);   // correas contra la espalda
      m.box(sg * w * 0.32, cy + hh * 0.5 + 0.02, cz + d * 0.5 - 0.01, 0.035, 0.03, 0.05, S);  // subiendo al hombro
    }
    return (geoCache[key] = m.build());
  }
  const MINI_PACK = { y: -0.06, z: -0.14, w: 0.17, h: 0.25, d: 0.1 };
  function setMiniPack(h) {
    if (h.mini || !(h.opts && h.opts.miniPack)) return;
    h.mini = new THREE.Mesh(miniPackGeometry(h.opts.miniPack), matWeapon);
    h.mini.castShadow = true;
    h.chest.add(h.mini);
  }
  function setBackpack(h, on) {
    mats(); setMiniPack(h);
    if (NO_PACKS) on = false;
    if (!!h.pack === !!on) return;
    mats();
    if (on) {
      const o = h.opts || {}, P = o.female ? PROF_F : PROF_M;
      if (o.pack === 'mesh') return;                 // (la mochila ya viene en la malla: Tomás)
      h.pack = new THREE.Mesh(packGeometry(o.pack || '', P, BUILD_W(o)), matWeapon);
      h.pack.castShadow = true;
      h.chest.add(h.pack);
    } else { h.chest.remove(h.pack); h.pack = null; }
  }

  // Armas colgadas (no las que van en la mano). list: [{ id, where, sil }] con where 'hip' (pistolera del muslo
  // derecho), 'L'/'R' (a los costados de la mochila, culata arriba junto al hombro y cañón hacia abajo) o 'low'
  // (cuerpo a cuerpo colgando abajo a la derecha de la mochila, cabeza arriba y mango hacia abajo)
  // Cara de fuera del muslo de una malla hecha fuera (G.CharMesh), a la altura de la pistolera, en el reposo:
  // { x: distancia al centro del cuerpo, z: centro del muslo } (reg 3 izquierdo, 4 derecho)
  const _thigh = new Map();
  function meshThigh(o, reg) {
    const D = o && o.mesh && G.CharMesh && G.CharMesh[o.mesh];
    if (!D) return null;
    const key = o.mesh + reg;
    if (_thigh.has(key)) return _thigh.get(key);
    const P = D.data.wpos || D.data.pos, R = D.data.reg;
    let mx = 0, z0 = 9, z1 = -9;
    for (let i = 0; i < R.length; i++) {
      if (R[i] !== reg) continue;
      const y = P[i * 3 + 1];
      if (y < 0.66 || y > 0.86) continue;
      mx = Math.max(mx, Math.abs(P[i * 3])); z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]);
    }
    const r = mx > 0 ? { x: mx, z: (z0 + z1) / 2 } : null;
    _thigh.set(key, r);
    return r;
  }
  // Arma corta enfundada contra el muslo de una malla: de perfil (lo plano contra la pierna), con la cara de dentro
  // tocando la cara de fuera del muslo y centrada de delante a atrás. sg: -1 muslo derecho, 1 izquierdo
  const _hbx = new THREE.Box3(), _hm = new THREE.Matrix4();
  function flushHolster(w, tx, sg) {
    w.rotation.set(0, sg > 0 ? 0 : Math.PI, Math.PI);
    w.geometry.computeBoundingBox();
    _hbx.copy(w.geometry.boundingBox).applyMatrix4(_hm.makeRotationFromEuler(w.rotation));
    const inner = sg > 0 ? _hbx.min.x : -_hbx.max.x;                  // del origen del arma a su cara de dentro
    w.position.x = sg * (tx.x - 0.1 + 0.004 - inner);
    w.position.z = tx.z - (_hbx.min.z + _hbx.max.z) / 2;
  }
  function setBackWeapon(h, list, pack) {
    if (NO_PACKS) pack = false;
    if (!Array.isArray(list)) list = list ? [list] : [];
    list = list.map((e) => (typeof e === 'string' ? { id: e, where: 'L' } : e));
    const key = list.map((e) => e.id + ':' + e.where + (e.sil ? 's' : '')).join('|') + (pack ? '+m' : '');
    if (h.backId === key) return;
    if (h.backs) for (const b of h.backs) if (b.parent) b.parent.remove(b);
    h.backs = [];
    h.backId = key;
    mats();
    for (const e of list) {
      const wd = G.Weapons.get(e.id), gun = wd.cat === 'gun';
      const short = gun && (wd.anim || wd.gun) === 'pistol';
      const geoId = gun ? (short ? (e.id === 'pistola' ? (e.sil ? 'pistola_sil' : 'pistola') : e.id) : e.id + '_body') : e.id;
      let w;
      try { w = new THREE.Mesh(weaponGeometry(geoId), matWeapon); } catch (er) { w = new THREE.Mesh(weaponGeometry(e.id), matWeapon); }
      w.castShadow = true;
      const len = wd.len || 0.9;
      if (e.where === 'hip') {
        // en la pistolera: empuñadura arriba, cañón hacia abajo, pegada al muslo derecho
        // (con malla hecha fuera: pegada a la cara de fuera del muslo de esa malla)
        const tx = meshThigh(h.opts, 4);
        w.rotation.set(0, Math.PI / 2, Math.PI);
        w.position.set(-0.112 - (h.opts && (h.opts.baggy || h.opts.dshorts) ? 0.024 : 0), 0.02, 0.0);
        if (tx) flushHolster(w, tx, -1);
        h.legR.add(w);
      } else if (e.where === 'hipL') {
        // la segunda arma corta: en el muslo izquierdo
        const tx = meshThigh(h.opts, 3);
        w.rotation.set(0, -Math.PI / 2, Math.PI);
        w.position.set(0.112, 0.02, 0.0);
        if (tx) flushHolster(w, tx, 1);
        h.legL.add(w);
      } else if (e.where === 'low') {
        // colgando de la parte de abajo a la derecha de la mochila: cabeza arriba, mango hacia abajo
        w.rotation.set(-0.12, Math.PI / 2, 0.16);
        w.position.set(pack ? -0.17 : -0.13, (pack ? -0.06 : -0.05) - len * 0.86, pack ? -0.25 : -0.17);
        h.chest.add(w);
      } else {
        // a un costado de la mochila: culata arriba (junto al hombro) y cañón hacia abajo, de perfil hacia atrás
        const sg = e.where === 'L' ? 1 : -1, R = G.Models.SIDE_ROT || [0, 0, Math.PI];
        const g = new THREE.Group();
        g.add(w);
        w.rotation.set(R[0], R[1], R[2]);
        // el arco tiene las palas a lo largo de Z: se gira para que cuelgue en vertical (de perfil, como los rifles)
        if (wd.gun === 'bow') { w.rotation.set(Math.PI / 2, 0, 0); w.position.y = -0.06; }
        if (!gun) w.position.y = -len * 0.5;
        g.rotation.set(0.08, 0, -0.1 * sg);
        g.position.set((pack ? 0.205 : 0.15) * sg, gun ? -0.14 : 0.1, pack ? -0.2 : -0.15);
        const bA = !pack && h.opts && h.opts.backAdj;     // (ajuste por personaje sin mochila: [x hacia dentro, y, z hacia la espalda])
        if (bA) { g.position.x -= bA[0] * sg; g.position.y += bA[1]; g.position.z += bA[2]; }
        h.chest.add(g);
        w = g;
      }
      h.backs.push(w);
    }
  }

  // ---------- Poses y animación ----------
  function reset(h) {
    for (let i = 0; i < h.bones.length; i++) {
      h.bones[i].rotation.set(0, 0, 0);
      h.bones[i].position.copy(h.rest[i]);
    }
  }

  const sin = Math.sin, cos = Math.cos, max = Math.max, abs = Math.abs;
  const c01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const easeOut = (t) => { t = c01(t); return 1 - (1 - t) * (1 - t) * (1 - t); };
  const easeIn = (t) => { t = c01(t); return t * t; };

  // Suaviza el paso de una pose a otra: cada hueso persigue su pose objetivo
  // con una inercia corta, así no hay saltos bruscos entre animaciones.
  function blend(h, dt, rate) {
    const n = h.bones.length;
    if (!h.prev) { h.prev = new Float32Array(n * 3 + 1); h.prevOk = false; }
    const k = (h.prevOk && dt != null) ? 1 - Math.exp(-dt * rate) : 1;
    const p = h.prev;
    for (let i = 0; i < n; i++) {
      const r = h.bones[i].rotation, j = i * 3;
      r.x = p[j] + (r.x - p[j]) * k; p[j] = r.x;
      r.y = p[j + 1] + (r.y - p[j + 1]) * k; p[j + 1] = r.y;
      r.z = p[j + 2] + (r.z - p[j + 2]) * k; p[j + 2] = r.z;
    }
    const hp = h.hips.position;
    hp.y = p[n * 3] + (hp.y - p[n * 3]) * (h.prevOk ? k : 1); p[n * 3] = hp.y;
    h.prevOk = true;
  }

  // Ciclo de piernas. p = fase, a = intensidad (0 a 1)
  function legs(h, p, a, run, drag) {
    const amp = (run ? 0.92 : 0.58) * a;
    const ampL = drag ? amp * 0.55 : amp;
    const knee = run ? 1.55 : 0.9;
    h.legL.rotation.x = -sin(p) * ampL;
    h.legR.rotation.x = sin(p) * amp;
    // la rodilla se dobla mientras la pierna avanza
    const fl = max(0, cos(p)), fr = max(0, -cos(p));
    h.shinL.rotation.x = a * (0.08 + knee * fl * fl * (drag ? 0.45 : 1));
    h.shinR.rotation.x = a * (0.08 + knee * fr * fr);
    // el pie se levanta al apoyar el talón y se estira al despegar
    h.footL.rotation.x = a * (-0.25 * max(0, -sin(p)) + 0.3 * fl * 0.5);
    h.footR.rotation.x = a * (-0.25 * max(0, sin(p)) + 0.3 * fr * 0.5);
    // los dedos se doblan al despegar el pie del suelo
    h.toeL.rotation.x = -a * (run ? 0.7 : 0.5) * max(0, -sin(p)) * (drag ? 0.3 : 1);
    h.toeR.rotation.x = -a * (run ? 0.7 : 0.5) * max(0, sin(p));
    // los hombros acompañan el paso
    h.clavL.rotation.y = -sin(p) * (run ? 0.1 : 0.05) * a;
    h.clavR.rotation.y = -sin(p) * (run ? 0.1 : 0.05) * a;
    // cadera: sube al pasar la pierna, baja al apoyar, y se balancea
    h.hips.position.y = 0.95 - 0.02 * a + (run ? 0.035 : 0.018) * a * cos(2 * p);
    h.hips.rotation.y = sin(p) * 0.11 * a;
    h.hips.rotation.z = sin(p) * 0.045 * a;
    h.spine.rotation.z = -sin(p) * 0.03 * a;
    h.chest.rotation.y = -sin(p) * 0.15 * a;
  }

  // Brazos al caminar, con el codo un poco retrasado
  function armSwing(h, p, a, run, side) {
    const A = side === 'L' ? 'L' : 'R';
    const sg = side === 'L' ? 1 : -1;
    const sw = sin(p) * sg;
    h['arm' + A].rotation.x = sw * (run ? 0.75 : 0.42) * a;
    h['arm' + A].rotation.z = sg * (0.07 + (run ? 0.1 : 0) * a);
    const lag = max(0, -sin(p - 0.45) * sg);
    h['fore' + A].rotation.x = run ? -1.25 - 0.25 * lag * a : -0.18 - 0.38 * lag * a;
  }

  // Marcha del jugador según la velocidad (m/s): de paso tranquilo a carrera a fondo.
  // Zancada, flexión de rodilla, braceo, bote de cadera e inclinación crecen con la velocidad.
  // fem: balanceo de cadera más marcado y pasos más juntos
  function gait(h, p, a, spd, crouchRun, fem) {
    const k = U.clamp((spd - 1.2) / 4.2, 0, 1);
    const amp = a * (0.42 + 0.52 * k) * (crouchRun ? 0.62 : 1);
    const knee = 0.75 + 0.95 * k;
    h.legL.rotation.x = -sin(p) * amp; h.legR.rotation.x = sin(p) * amp;
    const fl = max(0, cos(p)), fr = max(0, -cos(p));
    h.shinL.rotation.x = a * (0.08 + knee * fl * fl); h.shinR.rotation.x = a * (0.08 + knee * fr * fr);
    h.footL.rotation.x = a * (-0.25 * max(0, -sin(p)) + 0.15 * fl);
    h.footR.rotation.x = a * (-0.25 * max(0, sin(p)) + 0.15 * fr);
    h.toeL.rotation.x = -a * (0.4 + 0.3 * k) * max(0, -sin(p));
    h.toeR.rotation.x = -a * (0.4 + 0.3 * k) * max(0, sin(p));
    h.hips.position.y = 0.95 - 0.02 * a - 0.03 * k * a + (0.016 + 0.024 * k) * a * cos(2 * p);
    h.hips.rotation.y = sin(p) * (0.13 + 0.05 * k) * a;
    h.hips.rotation.z = sin(p) * (fem ? 0.075 : 0.045) * a * (1 - 0.4 * k);
    if (fem) { h.legL.rotation.z = -0.03 * a; h.legR.rotation.z = 0.03 * a; }
    h.spine.rotation.z = -sin(p) * 0.035 * a;
    h.chest.rotation.y = -sin(p) * (0.16 + 0.08 * k) * a;
    h.clavL.rotation.y = -sin(p) * (0.06 + 0.06 * k) * a; h.clavR.rotation.y = -sin(p) * (0.06 + 0.06 * k) * a;
    // nadie corre recto: el torso se encorva hacia delante (la espalda alta algo redondeada y los hombros
    // adelantados) y la cabeza se levanta para mirar al frente
    h.spine.rotation.x = (0.07 + 0.36 * k) * a;
    h.chest.rotation.x += 0.08 * k * a;
    h.neck.rotation.x = -(0.03 + 0.2 * k) * a;
    h.clavL.rotation.y -= 0.08 * k * a; h.clavR.rotation.y += 0.08 * k * a;
    for (const A of ['L', 'R']) {
      const sg = A === 'L' ? 1 : -1, sw = sin(p) * sg;
      h['arm' + A].rotation.x = sw * (0.35 + 0.55 * k) * a - 0.08 * k * a;
      h['arm' + A].rotation.z = sg * (0.07 + 0.06 * k * a);
      const lag = max(0, -sin(p - 0.45) * sg);
      h['fore' + A].rotation.x = -(0.2 + 1.15 * k) * a - (0.3 + 0.2 * k) * lag * a - 0.12 * (1 - a);
    }
  }

  // Pose del jugador
  // Separación de los brazos para que no atraviesen la cadera, por malla: opts.armOut (jugables) o ARM_OUT
  // (infectados, por id de malla), más ARM_RUN al correr (el braceo pasa junto a los muslos). Medido con
  // tools/armprobe.py: cada malla nueva se mide y se ajusta aquí
  const ARM_OUT = { corr: 0.17, chasq1: 0.13, nemi: 0.13, chasq2: 0.06, chasq3: 0.04, stalk: 0.04, chasq4: 0.08, temb: 0.1,
    esc0: 0.08, esc1: 0.12, esc2: 0.12, escf1: 0.06, escf2: 0.06 }, ARM_RUN = 0.3;
  function armSpread(h, run) {
    const o = h.opts || {};
    if (!o.mesh) return 0;
    const base = o.armOut != null ? o.armOut : (ARM_OUT[o.mesh] || 0);
    return base + (o.armRun != null ? o.armRun : ARM_RUN) * run;
  }
  function posePlayer(h, s) {
    reset(h);
    const a = s.amt, t = s.time || 0;
    const two = !!s.two;
    const armed = s.cat && s.cat !== 'none';

    // ---- movimiento omnidireccional: la cadera gira hacia donde vas y el torso sigue mirando al frente
    let rel = s.rel || 0, p = s.phase, twist = 0;
    if (a > 0.05) {
      if (Math.abs(rel) <= 2.0) twist = Math.max(-0.95, Math.min(0.95, rel));
      else { p = -p; twist = Math.max(-0.8, Math.min(0.8, U.angleDiff(rel, Math.PI * Math.sign(rel)))); }
    }
    // marcha continua según la velocidad real: camina, trota o corre (y corriendo agachado, zancada corta)
    const spd = s.speed != null ? s.speed : (s.run ? 4.3 : 2.1) * a;
    const kRun = U.clamp((spd - 1.2) / 4.2, 0, 1);
    gait(h, p, a, spd, !!(s.run && (s.crouch || 0) > 0.3), !!s.female);
    h.hips.rotation.y += twist * a;
    h.spine.rotation.y -= twist * 0.55 * a;
    h.chest.rotation.y -= twist * 0.45 * a;
    // inclinación al girar (hacia dentro de la curva) y al acelerar o frenar
    const bank = U.clamp((s.turn || 0) * 0.055 * Math.min(1, spd / 3), -0.24, 0.24);
    h.spine.rotation.z -= bank; h.hips.rotation.z -= bank * 0.35; h.neck.rotation.z += bank * 0.55;
    const accL = U.clamp((s.acc || 0) * 0.032, -0.24, 0.17);
    h.spine.rotation.x += accL; h.neck.rotation.x -= accL * 0.55;
    // siempre viva: respiración (jadea después de correr), el peso cambia de pierna, hombros que suben y bajan
    const idle = 1 - a;
    const brth = s.breath || 0, bt = (s.breathT != null ? s.breathT : t * 1.7);
    const bAmp = 1 + 2.4 * brth;
    h.chest.rotation.x += sin(bt) * 0.02 * bAmp * (0.35 + 0.65 * idle);
    h.spine2.rotation.x -= sin(bt) * 0.008 * bAmp * idle;
    h.clavL.rotation.z += sin(bt) * 0.022 * bAmp; h.clavR.rotation.z -= sin(bt) * 0.022 * bAmp;
    h.armL.rotation.z += sin(bt) * 0.01 * idle; h.armR.rotation.z -= sin(bt) * 0.01 * idle;
    if (brth > 0.05) { h.neck.rotation.x += sin(bt) * 0.025 * brth; h.spine.rotation.x += 0.06 * brth * idle; }
    const wsh = (sin(t * 0.43) * 0.75 + sin(t * 0.17 + 1.3) * 0.25) * idle;
    h.hips.rotation.z += wsh * 0.05; h.hips.position.x += wsh * 0.014;
    h.spine.rotation.z -= wsh * 0.035; h.neck.rotation.z -= wsh * 0.02;
    h.legL.rotation.z -= wsh * 0.04; h.legR.rotation.z -= wsh * 0.04;
    h.shinL.rotation.x += max(0, -wsh) * 0.16; h.shinR.rotation.x += max(0, wsh) * 0.16;
    h.footL.rotation.x -= max(0, -wsh) * 0.08; h.footR.rotation.x -= max(0, wsh) * 0.08;

    const gs = s.gun || null;
    if (armed && !gs) {
      if (s.aim) {
        // en guardia
        h.armR.rotation.x = -0.95; h.armR.rotation.z = -0.18;
        h.foreR.rotation.x = -1.15 + sin(t * 2) * 0.03;
        if (two) { h.armL.rotation.x = -0.95; h.armL.rotation.z = -0.52; h.foreL.rotation.x = -1.15; }
        else { h.armL.rotation.x = -0.25; h.foreL.rotation.x = -0.5; }
        h.spine.rotation.x = Math.max(h.spine.rotation.x, 0.12); h.chest.rotation.y -= 0.18;
        h.clavR.rotation.y += 0.16; h.clavR.rotation.z -= 0.08;
        if (two) h.clavL.rotation.y -= 0.22;
      } else if (two) {
        // a dos manos, el arma cruzada por delante
        h.armR.rotation.x = -0.4 + sin(p) * 0.05 * a; h.armR.rotation.z = -0.12;
        h.foreR.rotation.x = -0.95;
        h.armL.rotation.x = -0.5; h.armL.rotation.z = -0.45;
        h.foreL.rotation.x = -1.0;
        h.clavL.rotation.y -= 0.15;
      } else {
        // a una mano, relajada al costado (bracea con el arma al correr)
        h.armR.rotation.x = -0.1 - sin(p) * (0.18 + 0.55 * kRun) * a;
        h.foreR.rotation.x = -0.18 - (0.1 + 1.0 * kRun) * a;
      }
    } else if (!armed && s.aim) {
      h.armL.rotation.x = -0.95; h.armR.rotation.x = -0.95;
      h.foreL.rotation.x = -1.0; h.foreR.rotation.x = -1.0;
    }

    // alerta (infectados cerca u oleada en marcha): rodillas flexionadas, el torso algo adelantado, la navaja
    // (o el arma de una mano) lista delante y la mano izquierda arriba, como para apartar
    const al = (s.alert || 0) * (1 - (s.crouch || 0)) * (s.prone ? 0 : 1);
    if (al > 0.01 && !gs && !s.aim) {
      const st = al * (1 - 0.6 * a);
      h.hips.position.y -= 0.045 * st;
      h.legL.rotation.x -= 0.2 * st; h.shinL.rotation.x += 0.32 * st; h.footL.rotation.x -= 0.1 * st;
      h.legR.rotation.x += 0.05 * st; h.shinR.rotation.x += 0.26 * st; h.footR.rotation.x -= 0.12 * st;
      h.legL.rotation.z += 0.05 * st; h.legR.rotation.z -= 0.05 * st;
      h.spine.rotation.x += 0.12 * al; h.neck.rotation.x -= 0.08 * al;
      if (armed && !two) {
        const ka = al * (1 - 0.75 * kRun * a);      // corriendo a fondo vuelve a bracear
        const sw = sin(t * 1.9) * 0.03;
        h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.62 + sw - sin(p) * 0.15 * a, ka);
        h.armR.rotation.z = U.lerp(h.armR.rotation.z, -0.12, ka);
        h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -1.05, ka);
        h.handR.rotation.x = U.lerp(h.handR.rotation.x, -0.25, ka);
        h.armL.rotation.x = U.lerp(h.armL.rotation.x, -0.45 + sin(p) * 0.3 * a, ka);
        h.armL.rotation.z = U.lerp(h.armL.rotation.z, 0.18, ka);
        h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.95, ka);
      }
    }

    // armas de fuego: al apuntar el torso sigue la mirada (arriba y abajo), los hombros se adelantan
    // y con escopeta o rifle la cabeza se apoya en la culata
    if (gs) {
      const ai = U.smooth(c01(gs.aim)) * (s.climb != null ? 0 : 1) * (1 - (s.prone || 0));
      const pt = s.pitch || 0;
      // apuntando se endereza (el encorvado de la carrera desviaría el arma)
      h.spine.rotation.x -= 0.3 * kRun * a * ai; h.chest.rotation.x -= 0.08 * kRun * a * ai;
      h.spine.rotation.x += pt * 0.4 * ai + 0.05 * ai;
      h.neck.rotation.x += pt * 0.25 * ai;
      if (gs.kind === 'shotgun' || gs.kind === 'rifle') {
        h.neck.rotation.z += 0.14 * ai; h.neck.rotation.y -= 0.1 * ai; h.head.rotation.x += 0.12 * ai;
        h.clavL.rotation.y -= 0.45 * ai; h.clavR.rotation.y += 0.1 * ai; h.chest.rotation.y -= 0.1 * ai;
      } else if (gs.kind === 'pistol') {
        h.clavL.rotation.y -= 0.25 * ai; h.clavR.rotation.y += 0.18 * ai; h.head.rotation.x += 0.06 * ai;
      } else {
        // arco: postura de tiro. Cadera y torso girados a la derecha (el hombro izquierdo hacia el
        // blanco), piernas abiertas, cabeza girada hacia el blanco sobre la flecha y el hombro
        // derecho que sube al tensar
        const dr = c01(gs.draw || 0);
        const yaw = -1.0 * ai;
        h.hips.rotation.y += yaw * 0.45; h.spine.rotation.y += yaw * 0.3; h.chest.rotation.y += yaw * 0.25;
        h.spine.rotation.x -= pt * 0.2 * ai;              // menos cabeceo de columna: lo hacen los brazos
        h.neck.rotation.y -= yaw * 0.45; h.neck.rotation.z -= 0.08 * ai; h.head.rotation.x += 0.08 * ai;
        h.clavR.rotation.z -= 0.12 * ai * dr; h.clavR.rotation.y += 0.12 * ai * dr; h.clavL.rotation.y -= 0.12 * ai;
        const still = 1 - a;
        h.legL.rotation.x -= 0.14 * ai * still; h.legL.rotation.z += 0.1 * ai * still;
        h.legR.rotation.x += 0.1 * ai * still; h.legR.rotation.z -= 0.12 * ai * still;
        h.shinL.rotation.x += 0.08 * ai * still;
      }
    }

    // agachado (sigilo): agachado hondo, torso muy inclinado, cabeza levantada mirando al frente,
    // brazos algo separados y bajos, hombros encogidos
    const c = s.crouch || 0;
    if (c > 0.01) {
      h.hips.position.y -= 0.3 * c;
      h.legL.rotation.x -= 1.1 * c; h.legR.rotation.x -= 1.1 * c;
      h.legL.rotation.z += 0.08 * c; h.legR.rotation.z -= 0.08 * c;
      h.shinL.rotation.x += 1.65 * c; h.shinR.rotation.x += 1.65 * c;
      h.footL.rotation.x -= 0.55 * c; h.footR.rotation.x -= 0.55 * c;
      h.toeL.rotation.x -= 0.25 * c; h.toeR.rotation.x -= 0.25 * c;
      // apuntando un arma de fuego agachada: el torso se queda casi derecho para que el arma siga a la
      // altura de los ojos (igual que de pie)
      const gaim = gs ? U.smooth(c01(gs.aim)) : 0;
      h.spine.rotation.x += 0.55 * c * (1 - 0.85 * gaim);
      h.neck.rotation.x -= 0.32 * c * (1 - 0.85 * gaim); h.head.rotation.x -= 0.12 * c * (1 - gaim);
      h.clavL.rotation.y -= 0.12 * c; h.clavR.rotation.y += 0.12 * c;
      h.clavL.rotation.z += 0.06 * c; h.clavR.rotation.z -= 0.06 * c;
      if (!s.aim && !(armed && two)) {
        const sw2 = sin(p) * 0.18 * a;
        h.armL.rotation.x = U.lerp(h.armL.rotation.x, -0.45 + sw2, c); h.armL.rotation.z = U.lerp(h.armL.rotation.z, 0.24, c);
        h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.85, c);
        if (!armed) {
          h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.45 - sw2, c); h.armR.rotation.z = U.lerp(h.armR.rotation.z, -0.24, c);
          h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -0.85, c);
        }
      }
    }

    // cobertura: pegado a la pared con el hombro, inclinado hacia ella; en una esquina se asoma
    const cvp = s.cover;
    if (cvp && cvp.amt > 0.01) {
      const k = cvp.amt, wl = cvp.wall || 1;
      h.spine.rotation.z -= wl * 0.14 * k;
      h.hips.position.x += wl * 0.04 * k;
      h.neck.rotation.z += wl * 0.1 * k;
      h.clavL.rotation.z += (wl > 0 ? 0.08 : 0) * k; h.clavR.rotation.z -= (wl < 0 ? 0.08 : 0) * k;
      if (cvp.peek && !cvp.aim) {
        // asomarse: el torso y la cabeza salen por la esquina
        h.spine.rotation.z += wl * 0.3 * k;
        h.spine.rotation.x += 0.12 * k;
        h.neck.rotation.z -= wl * 0.12 * k;
        h.head.rotation.y -= wl * 0.25 * k;
      }
      // la mano del lado de la pared se apoya en ella (si no lleva un arma a dos manos)
      if (!s.aim && !(armed && two) && !gs) {
        const A = wl > 0 ? 'L' : 'R';
        h['arm' + A].rotation.x = U.lerp(h['arm' + A].rotation.x, -0.55, k);
        h['arm' + A].rotation.z = U.lerp(h['arm' + A].rotation.z, wl * 0.55, k);
        h['fore' + A].rotation.x = U.lerp(h['fore' + A].rotation.x, -0.9, k);
      }
    }

    // saltito
    if (s.hop) {
      const k = sin(Math.PI * s.hop);
      h.legL.rotation.x -= 0.6 * k; h.shinL.rotation.x += 1.0 * k;
      h.legR.rotation.x -= 0.3 * k; h.shinR.rotation.x += 0.7 * k;
      h.armL.rotation.x -= 0.5 * k; h.armR.rotation.x -= 0.5 * k;
    }

    // guardia de pelea sin arma: piernas algo flexionadas, el pie izquierdo adelante y el hombro derecho atrás
    const gd = (!armed && !gs) ? (s.guard || 0) * (1 - c) : 0;
    if (gd > 0.01) {
      const still = 1 - a * 0.6;
      h.legL.rotation.x -= 0.24 * gd * still; h.legR.rotation.x += 0.14 * gd * still;
      h.shinL.rotation.x += 0.22 * gd * still; h.shinR.rotation.x += 0.28 * gd * still;
      h.footL.rotation.x += 0.04 * gd * still; h.toeR.rotation.x -= 0.12 * gd * still;
      h.hips.position.y -= 0.035 * gd;
      h.hips.rotation.y -= 0.12 * gd * still; h.chest.rotation.y -= 0.1 * gd;
      h.spine.rotation.x += 0.1 * gd; h.neck.rotation.x -= 0.06 * gd;
    }

    if (s.action) action(h, s.action, s.t, two, s);
    if (s.struggle) strugglePose(h, s.struggle, t);
    if (s.bossKill) {
      bossKillPose(h, s.bossKill, t);
      distributeSpine(h);
      blend(h, s.dt, 22);
      if (h.weapon) h.weapon.visible = false;
      hairPhysics(h, s.dt);
      return;
    }
    if (s.dodge != null) dodgePose(h, s.dodge, s.dodgeRel || 0, armed, two);
    if (s.blow && s.blow.react) reactPose(h, s.blow.react, s.blow.t, s.blow.dur, s.blow.fl || 1);
    else if (s.blow) blowPose(h, s.blow, armed, two, !!gs, t);
    if (s.climb != null && s.ledge) {
      // trepar a un contenedor: salta con los brazos arriba, se cuelga del borde, tira y sube una rodilla
      const t = s.climb;
      const reach = U.smooth(c01((t - 0.05) / 0.25)) * (1 - U.smooth(c01((t - 0.55) / 0.35)));
      const pull = U.smooth(c01((t - 0.3) / 0.35));
      const knee = U.smooth(c01((t - 0.5) / 0.25)) * (1 - U.smooth(c01((t - 0.85) / 0.15)));
      h.armL.rotation.x = U.lerp(-0.2, -2.9, reach) + pull * 0.9 * (1 - reach * 0.3); h.armR.rotation.x = h.armL.rotation.x;
      h.armL.rotation.z = 0.15; h.armR.rotation.z = -0.15;
      if (h.foreL) { h.foreL.rotation.x = -0.6 * pull * reach; h.foreR.rotation.x = -0.6 * pull * reach; }
      h.spine.rotation.x = 0.25 * pull + 0.35 * knee;
      h.legL.rotation.x = -1.5 * knee - 0.2 * reach; h.shinL.rotation.x = 1.8 * knee + 0.3 * reach;
      h.legR.rotation.x = -0.5 * knee + 0.25 * reach; h.shinR.rotation.x = 0.9 * knee + 0.4 * reach;
    } else if (s.climb != null) {
      const k = sin(Math.PI * s.climb);
      h.legL.rotation.x = -1.2 * k; h.shinL.rotation.x = 1.4 * k;
      h.legR.rotation.x = -0.4 * k; h.shinR.rotation.x = 0.8 * k;
      h.spine.rotation.x = 0.5 * k;
      h.armL.rotation.x = -1.0 * k; h.armR.rotation.x = -1.0 * k;
    }
    // cayendo desde un contenedor: brazos abiertos y piernas algo flexionadas; al aterrizar, flexión
    if (s.fall > 0) {
      const k = s.fall;
      h.armL.rotation.z = U.lerp(h.armL.rotation.z, 0.9, k); h.armR.rotation.z = U.lerp(h.armR.rotation.z, -0.9, k);
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -0.6, k); h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.6, k);
      h.legL.rotation.x = -0.5 * k; h.shinL.rotation.x = 0.7 * k; h.legR.rotation.x = -0.2 * k; h.shinR.rotation.x = 0.5 * k;
    }
    if (s.land > 0) {
      const k = Math.min(1, s.land / 0.2);
      h.legL.rotation.x -= 0.9 * k; h.shinL.rotation.x += 1.4 * k; h.legR.rotation.x -= 0.9 * k; h.shinR.rotation.x += 1.4 * k;
      h.spine.rotation.x += 0.4 * k;
      if (h.hips) h.hips.position.y -= 0.28 * k;
    }

    // ---- pecho a tierra: el cuerpo se tumba boca abajo y se arrastra
    const pr = s.prone || 0;
    if (pr > 0.01) {
      const q = Math.sin(s.phase), am = a;
      const P = {
        armL: [-2.75 + q * 0.45 * am, 0, 0.35], armR: [-2.75 - q * 0.45 * am, 0, -0.35],
        foreL: [-0.55 - 0.4 * Math.max(0, -q) * am, 0, 0], foreR: [-0.55 - 0.4 * Math.max(0, q) * am, 0, 0],
        legL: [0.05 + q * 0.3 * am, 0, 0.16], legR: [0.05 - q * 0.3 * am, 0, -0.16],
        shinL: [0.15 + 0.7 * Math.max(0, q) * am, 0, 0], shinR: [0.15 + 0.7 * Math.max(0, -q) * am, 0, 0],
        footL: [0.4, 0, 0], footR: [0.4, 0, 0],
        spine: [0, 0, q * 0.06 * am], chest: [0, q * 0.08 * am, 0],
        neck: [-0.7, 0, 0], head: [-0.25, 0, 0], hips: [0, 0, -q * 0.05 * am]
      };
      for (const name in P) {
        const r = h[name].rotation, v = P[name];
        r.x = U.lerp(r.x, v[0], pr); r.y = U.lerp(r.y, v[1], pr); r.z = U.lerp(r.z, v[2], pr);
      }
      h.hips.position.y = U.lerp(h.hips.position.y, 0.95, pr);
    }
    const th = Math.PI / 2 * U.smooth(pr);
    h.body.rotation.x = th;
    h.body.position.set(0, (0.9 - 0.9 * Math.cos(th)) - 0.76 * Math.sin(th), -0.9 * Math.sin(th));

    // la cabeza compensa el giro del cuerpo (mira hacia delante)
    if (pr < 0.5) h.head.rotation.y -= (h.hips.rotation.y + h.spine.rotation.y + h.chest.rotation.y) * 0.6;
    // la cabeza sigue al infectado más cercano; sin ninguno, en reposo mira alrededor
    if (pr < 0.5 && s.climb == null && !s.action) {
      const idl = 1 - a;
      let ly = 0, lp = 0, lw = 0;
      if (s.look) { ly = U.clamp(s.look.yaw, -1.25, 1.25); lp = U.clamp(s.look.pitch, -0.5, 0.6); lw = s.look.w; }
      else { ly = (sin(t * 0.31) * 0.6 + sin(t * 0.13 + 2) * 0.4) * 0.75; lp = 0.05 * sin(t * 0.23); lw = idl * (gs && gs.aim > 0.3 ? 0 : 1); }
      h.neck.rotation.y += ly * 0.45 * lw; h.head.rotation.y += ly * 0.4 * lw;
      h.neck.rotation.x += lp * 0.4 * lw; h.head.rotation.x += lp * 0.35 * lw;
      if (Math.abs(ly) > 0.6) h.chest.rotation.y += (ly - Math.sign(ly) * 0.6) * 0.35 * lw;
    }
    // gestos sueltos en reposo: mirar por encima del hombro, estirar el cuello, sacudir los brazos
    if (s.fidget) {
      const f = s.fidget, k = sin(Math.PI * c01(f.t));
      if (f.kind === 'look') { h.neck.rotation.y += 0.75 * k * f.side; h.head.rotation.y += 0.5 * k * f.side; h.chest.rotation.y += 0.3 * k * f.side; h.spine.rotation.y += 0.1 * k * f.side; }
      else if (f.kind === 'neck') { h.neck.rotation.z += 0.3 * k * sin(f.t * 8); h.head.rotation.x -= 0.18 * k; h.clavL.rotation.z += 0.1 * k; h.clavR.rotation.z -= 0.1 * k; }
      else if (f.kind === 'shake') { h.armL.rotation.z += 0.22 * k * (0.5 + 0.5 * sin(f.t * 30)); h.armR.rotation.z -= 0.18 * k * (0.5 + 0.5 * sin(f.t * 30 + 1)); h.neck.rotation.x -= 0.14 * k; h.clavL.rotation.z += 0.08 * k; h.clavR.rotation.z -= 0.08 * k; }
    }
    // dedos: la mano se cierra sobre lo que agarra; relajada si está libre; abierta al empujar
    {
      const open = s.action === 'shove' || s.action === 'search';
      let cR = armed ? 1.15 : 0.35, cL = armed && two ? 1.0 : 0.3;
      if (gs) {
        cR = gs.kind === 'bow' ? 0.7 : 1.15;
        cL = gs.kind === 'pistol' ? 0.3 + 0.8 * U.smooth(c01(gs.aim)) : 1.05;
      }
      if (s.action === 'grab') { cL = 1.1; cR = s.grabKnife ? 1.15 : 1.0; }
      if (!armed && !gs && (PUNCH_K[s.action] || (!s.action && (s.guard || 0) > 0.3))) { cL = 1.3; cR = 1.3; }
      if (open) { cL = 0.1; cR = armed ? cR : 0.1; }
      h.fingR.rotation.z = cR; h.fingL.rotation.z = -cL;
    }
    if (s.npc) npcPose(h, s.npc, t);
    // tomando un rehén: el torso se agacha un poco detrás de él
    if (s.hostage) { h.spine.rotation.x += 0.08; h.hips.position.y -= 0.03; h.legL.rotation.x -= 0.1; h.shinL.rotation.x += 0.15; }
    // brazos separados del cuerpo: que antebrazos y manos no se metan en la cadera (quieto, caminando y corriendo)
    if (!s.action && s.climb == null && !s.npc) { const ao = armSpread(h, kRun * a); h.armL.rotation.z += ao; h.armR.rotation.z -= ao; }
    distributeSpine(h);
    // saltar una valla, una ventana o un muro bajo: la animación grabada (HumanJumping), sobre la pose de antes
    if (s.climb != null && s.jump && G.Clips && G.Clips.jump) playClip(h, G.Clips.jump, s.jumpT != null ? s.jumpT : s.climb, 0.12);
    blend(h, s.dt, (s.action || s.dodge != null || (s.climb != null && s.jump)) ? 30 : 15);
    if (s.contact && s.contact.m && s.action && EXEC_K[s.action]) headClear(h, s.contact.m, 1, 0.6);
    // recoger del suelo (o de un mueble): la mano derecha va de verdad hasta el objeto y lo agarra
    if (s.pick && (s.action === 'pickup' || s.action === 'pickupHi')) {
      const t0 = 0.16, tc = 0.42, t1 = 0.62;
      const w = s.t <= t0 || s.t >= t1 ? 0 : (s.t < tc ? U.smooth((s.t - t0) / (tc - t0)) : 1 - U.smooth((s.t - tc) / (t1 - tc)));
      if (w > 0.01) {
        h.root.updateMatrixWorld(true);
        _pkT.set(s.pick.x, s.pick.y + 0.04, s.pick.z);
        h.handR.getWorldPosition(_pkH);
        let d = _pkT.distanceTo(_pkH);
        // si queda lejos, se dobla más (cintura y rodillas) para llegar
        if (d > 0.12 && d < 1.4 && s.action === 'pickup') {
          // agacharse lo que haga falta según lo que le falta a la mano para llegar abajo: rodillas, cadera
          // y espalda (como quien recoge algo del suelo con prisa: una rodilla casi al suelo)
          const k = w * U.clamp((d - 0.1) / 0.45, 0, 1);
          h.hips.position.y -= 0.24 * k;
          h.spine.rotation.x += 0.3 * k; h.spine2.rotation.x += 0.12 * k;
          h.legL.rotation.x -= 0.75 * k; h.shinL.rotation.x += 1.05 * k; h.footL.rotation.x -= 0.25 * k;
          h.legR.rotation.x -= 0.2 * k; h.shinR.rotation.x += 1.2 * k; h.footR.rotation.x += 0.1 * k; h.toeR.rotation.x -= 0.5 * k;
          h.root.updateMatrixWorld(true);
          h.handR.getWorldPosition(_pkH); d = _pkT.distanceTo(_pkH);
        }
        if (d < 0.9) { _pkH.lerp(_pkT, w); armIK(h, 'R', _pkH, _pkP.set(-0.4, -0.6, -0.7).normalize(), 1); h.fingR.rotation.z = U.lerp(h.fingR.rotation.z, s.t > tc - 0.04 ? 1.15 : 0.25, w); }
      }
    }
    if (h.weapon && !gs) h.weapon.visible = (s.action !== 'grab' || !!(s.grabKnife && armed && s.cat === 'sblade')) && s.action !== 'search' && s.action !== 'bandage';
    if (s.action === 'grab') { if (gs) gunIK(h, s, gs); grabIK(h, s); }
    else if (s.action === 'bandage') { if (h.weapon) h.weapon.visible = false; bandageIK(h, s); }
    else if (s.action === 'search' || s.action === 'bandage') { if (h.weapon) h.weapon.visible = false; }
    else if (!armed && !gs && PUNCH_K[s.action]) { fistIK(h, s, Math.max(gd, U.smooth(s.t / 0.1))); contactIK(h, s); h._cDone = true; }
    else if (!armed && !gs && !s.action && gd > 0.01 && s.dodge == null && s.climb == null && pr < 0.5) fistIK(h, s, gd);
    else if (gs) gunIK(h, s, gs);
    // mano izquierda sobre el arma cuando se agarra a dos manos
    else if (armed && two && pr < 0.5 && s.climb == null && s.action !== 'shove' && s.action !== 'stomp') { contactIK(h, s); h._cDone = true; if (s.cat !== 'spear') { meleeTwoIK(h, s); twoHandHold(h); } leftHandIK(h); }
    if (!h._cDone && s.contact && !gs && s.action !== 'grab') contactIK(h, s);
    h._cDone = false;
    if (h.grabKnife) h.grabKnife.visible = s.action === 'grab' && !!s.grabKnife && !(armed && s.cat === 'sblade' && !gs);
    if (s.draw) drawIK(h, s.draw);
    hairPhysics(h, s.dt);
  }

  // Poses propias de los humanos enemigos. n: { kind, k (0 a 1) }
  //   kneel   de rodillas con las manos en alto (se rinde o suplica)
  //   held    rehén: de pie, agarrado al brazo que lo sujeta, la cabeza apartada del cañón
  //   hands   de pie con las manos en alto
  function npcPose(h, n, t) {
    const k = c01(n.k == null ? 1 : n.k);
    if (k <= 0) return;
    const L = (b, x, y, z) => { const r = h[b].rotation; r.x = U.lerp(r.x, x, k); r.y = U.lerp(r.y, y, k); r.z = U.lerp(r.z, z, k); };
    const shake = sin(t * 23) * 0.025 + sin(t * 31 + 1) * 0.015;
    if (n.kind === 'kneel') {
      h.hips.position.y = U.lerp(h.hips.position.y, h.hips.position.y - 0.47, k);
      L('hips', 0, 0, 0); L('legL', -0.08, 0, 0.06); L('legR', -0.04, 0, -0.06);
      L('shinL', 1.62, 0, 0); L('shinR', 1.6, 0, 0); L('footL', 0.75, 0, 0); L('footR', 0.75, 0, 0); L('toeL', 0.3, 0, 0); L('toeR', 0.3, 0, 0);
      L('spine', 0.12 + shake, 0, 0); L('spine2', 0.05, 0, 0); L('chest', 0.02, 0, 0); L('neck', 0.18, 0, 0); L('head', 0.1, 0, 0);
      L('armL', -2.55 + shake, 0, 0.42); L('armR', -2.55 - shake, 0, -0.42);
      L('foreL', -0.75, 0, 0); L('foreR', -0.75, 0, 0); L('handL', 0.3, 0, 0); L('handR', 0.3, 0, 0);
      h.fingL.rotation.z = U.lerp(h.fingL.rotation.z, -0.1, k); h.fingR.rotation.z = U.lerp(h.fingR.rotation.z, 0.1, k);
    } else if (n.kind === 'held') {
      L('spine', -0.12, 0, 0); L('neck', -0.1, 0.45, 0.18); L('head', -0.05, 0.2, 0.05);
      L('armL', -1.1 + shake, 0, 0.12); L('armR', -1.15 - shake, 0, -0.1);
      L('foreL', -1.55, 0, 0); L('foreR', -1.5, 0, 0);
      L('legL', -0.12, 0, 0.04); L('shinL', 0.22, 0, 0); L('legR', 0.08, 0, -0.04); L('shinR', 0.18, 0, 0);
      h.hips.position.y -= 0.03 * k;
    } else if (n.kind === 'hands') {
      L('armL', -2.4 + shake, 0, 0.5); L('armR', -2.4 - shake, 0, -0.5);
      L('foreL', -0.9, 0, 0); L('foreR', -0.9, 0, 0);
      L('neck', 0.12, 0, 0);
    }
  }

  // Sacar un arma: la mano derecha va a buscarla a su sitio (pistolera del muslo, por encima del hombro a la
  // espalda, abajo a la derecha de la mochila o la funda de la izquierda) y vuelve con ella
  const _dw = new THREE.Vector3(), _dp = new THREE.Vector3();
  const DRAW_AT = {
    hip: { bone: 'legR', p: [-0.115, -0.04, 0.03], pole: [-1, -0.2, -0.6], tw: 0.12, lean: 0.06 },
    back: { bone: 'chest', p: [-0.2, 0.1, -0.2], pole: [-0.9, 0.7, 0.2], tw: -0.35, lean: -0.04 },
    low: { bone: 'chest', p: [-0.21, -0.3, -0.22], pole: [-1, 0.1, -0.5], tw: -0.28, lean: 0.08 },
    belt: { bone: 'hips', p: [0.16, -0.04, 0.05], pole: [-0.4, -0.3, 1], tw: 0.35, lean: 0.1 }
  };
  // d.phase: 'hold' guarda lo que lleva (la mano va a su sitio y ahí lo suelta), 'draw' va a por lo nuevo (si
  // venía de guardar, sale de ese sitio directo hacia el nuevo, sin volver al frente) y 'ret' vuelve sin nada.
  // Un arma de fuego en la mano acompaña a la mano todo el gesto (no se queda flotando delante del pecho)
  const _dw2 = new THREE.Vector3(), _dp2 = new THREE.Vector3(), _dm = new THREE.Matrix4(), _dm2 = new THREE.Matrix4();
  const _dgp = new THREE.Vector3(), _dgq = new THREE.Quaternion(), _dgs = new THREE.Vector3(), _dhp = new THREE.Vector3(), _dhq = new THREE.Quaternion();
  function drawIK(h, d) {
    const t = d.t, ph = d.phase || 'draw';
    const A = DRAW_AT[d.src] || DRAW_AT.low, H = d.hsrc ? (DRAW_AT[d.hsrc] || DRAW_AT.low) : null;
    let w, mix = 1, fing, wl;
    if (ph === 'hold') {
      w = U.smooth(c01(t / 0.8));
      fing = t < (d.stowAt || 0.88) ? 1.15 : 0.3;
      wl = w;
    } else if (ph === 'ret') {
      w = 1 - U.smooth(c01(t));
      fing = 0.4; wl = w;
    } else {
      w = H ? (t < 0.42 ? 1 : 1 - U.smooth(c01((t - 0.42) / 0.52))) : (t < 0.42 ? U.smooth(c01(t / 0.3)) : 1 - U.smooth(c01((t - 0.42) / 0.52)));
      mix = H ? U.smooth(c01(t / 0.34)) : 1;
      fing = t < 0.4 ? 0.3 : 1.15;
      wl = t < 0.42 ? w : w * 0.6;
    }
    if (w <= 0.001) return;
    const B = H || A;
    const tw = U.lerp(B.tw, A.tw, mix), lean = U.lerp(B.lean, A.lean, mix);
    const back = U.lerp(B === DRAW_AT.back ? 1 : 0, A === DRAW_AT.back ? 1 : 0, mix);
    // arma de fuego en la mano: cómo la lleva la mano ahora (antes de mover el brazo)
    const gun = h.gun && h.weapon && h.weapon.visible !== false ? h.weapon : null;
    if (gun) {
      h.root.updateMatrixWorld(true);
      _dm.copy(h.handR.matrixWorld).invert().multiply(gun.matrixWorld);       // arma respecto a la mano
      gun.matrixWorld.decompose(_dgp, _dgq, _dgs);                               // dónde estaba (sin el gesto)
    }
    h.chest.rotation.y += tw * w; h.spine.rotation.y += tw * 0.4 * w; h.spine.rotation.x += lean * w;
    h.clavR.rotation.z -= 0.15 * w * back;
    h.root.updateMatrixWorld(true);
    h[A.bone].localToWorld(_dw.set(A.p[0], A.p[1], A.p[2]));
    _dp.set(A.pole[0], A.pole[1], A.pole[2]).normalize();
    if (H && mix < 1) {
      h[H.bone].localToWorld(_dw2.set(H.p[0], H.p[1], H.p[2]));
      _dw.lerpVectors(_dw2, _dw, mix);
      _dp.lerpVectors(_dp2.set(H.pole[0], H.pole[1], H.pole[2]).normalize(), _dp, mix).normalize();
    }
    armIK(h, 'R', _dw, _dp, w);
    h.handR.rotation.x += 0.4 * w;
    h.fingR.rotation.z = U.lerp(h.fingR.rotation.z, fing, w);
    if (gun) {
      h.armR.updateMatrixWorld(true);
      _dm2.multiplyMatrices(h.handR.matrixWorld, _dm);
      _dm2.decompose(_dhp, _dhq, _dgs);
      _dgp.lerp(_dhp, w); _dgq.slerp(_dhq, w);
      _dm2.compose(_dgp, _dgq, _dgs.set(1, 1, 1));
      _dm2.premultiply(_dm.copy(gun.parent.matrixWorld).invert());
      _dm2.decompose(gun.position, gun.quaternion, _dgs);
    }
    // la izquierda, mientras la derecha guarda o va a por el arma, cae relajada (no sujeta nada)
    h.armL.quaternion.slerp(_dq.setFromEuler(_de.set(-0.12, 0, 0.14)), wl);
    h.foreL.quaternion.slerp(_dq.setFromEuler(_de.set(-0.35, 0, 0)), wl);
  }
  const _dq = new THREE.Quaternion(), _de = new THREE.Euler();

  // Agarre por la espalda: el brazo izquierdo rodea el cuello; con cuchillo, la derecha apuñala;
  // sin cuchillo, la derecha agarra la muñeca izquierda y estrangula
  const _gL = new THREE.Vector3(), _gR = new THREE.Vector3(), _gp1 = new THREE.Vector3(), _gp2 = new THREE.Vector3();
  const POLE_GL = new THREE.Vector3(1, -0.6, -0.3).normalize(), POLE_GR = new THREE.Vector3(-1, -0.7, -0.2).normalize();
  function grabIK(h, s) {
    const t = s.t;
    const k = win(t, 0, 0.12) * (1 - win(t, 0.86, 1));
    if (k <= 0) return;
    h.root.updateMatrixWorld(true);
    const shake = sin(t * 40) * 0.02 * (1 - win(t, 0.55, 0.8));
    h.chest.localToWorld(_gL.set(-0.1 + shake, 0.24, 0.44));
    armIK(h, 'L', _gL, _gp1.copy(POLE_GL), k);
    if (s.grabKnife) {
      // tres puñaladas al cuello
      let st = 0;
      for (const c of [0.3, 0.45, 0.6]) st = Math.max(st, win(t, c - 0.08, c) * (1 - win(t, c, c + 0.07)));
      h.chest.localToWorld(_gR.set(-0.28 + 0.18 * st, 0.32 - 0.05 * st, 0.12 + 0.28 * st));
      if (!h.grabKnife) {
        mats();
        h.grabKnife = new THREE.Mesh(weaponGeometry('cuchillo_caza'), matWeapon);
        h.grabKnife.rotation.x = 2.35; h.grabKnife.position.set(0, -0.05, 0.015);
        h.handR.add(h.grabKnife);
      }
    } else {
      h.chest.localToWorld(_gR.set(0.02 + shake, 0.22, 0.4));
    }
    armIK(h, 'R', _gR, _gp2.copy(POLE_GR), k);
  }

  // Vendarse: el antebrazo izquierdo delante del cuerpo y la mano derecha dando vueltas alrededor
  const _bL = new THREE.Vector3(), _bR = new THREE.Vector3(), _bdA = new THREE.Vector3(), _bdB = new THREE.Vector3();
  const POLE_BL = new THREE.Vector3(0.8, -1, -0.2).normalize(), POLE_BR = new THREE.Vector3(-0.8, -1, -0.2).normalize();
  // ---- Puños: trayectorias de cada puño en el espacio del pecho (la carga, el golpe y la vuelta),
  // con el codo guiado (afuera y a la altura del hombro en los ganchos). Claves: [t, x, y, z, codo x, y, z, curva]
  // curva del tramo que termina en la clave: 's' suave, 'i' acelera (el golpe), 'o' frena
  const PUNCH_K = { punch1: 1, punch2: 1, punch3: 1 };
  // posiciones en el espacio del cuerpo (pies en el suelo, mirando a +Z); el hombro derecho está en (-0,19; 1,44; 0)
  const FIST_GR = [-0.16, 1.47, 0.25, -0.5, -1, -0.05], FIST_GL = [0.1, 1.5, 0.3, 0.5, -1, -0.05];
  const FIST_TR = {
    punch1: {
      R: [[0, ...FIST_GR, 's'], [0.3, -0.25, 1.46, 0.17, -0.6, -1, -0.3, 'o'], [0.42, 0.0, 1.5, 0.57, -1, 0.1, -0.3, 'i'],
        [0.56, 0.17, 1.45, 0.42, -0.9, -0.2, 0.1, 'o'], [0.95, ...FIST_GR, 's']],
      L: [[0, ...FIST_GL, 's'], [0.3, 0.1, 1.5, 0.34, 0.5, -1, -0.1, 's'], [0.6, 0.1, 1.5, 0.34, 0.5, -1, -0.1, 's'], [0.95, ...FIST_GL, 's']]
    },
    punch3: {
      R: [[0, ...FIST_GR, 's'], [0.3, -0.26, 1.08, 0.1, -0.5, -1, -0.4, 'o'], [0.44, -0.4, 1.3, 0.0, -0.3, -1, -0.5, 's'],
        [0.52, 0.0, 1.5, 0.62, -1, 0.2, -0.2, 'i'], [0.7, 0.2, 1.12, 0.45, -0.7, 0.1, 0.4, 'o'], [0.98, ...FIST_GR, 's']],
      L: [[0, ...FIST_GL, 's'], [0.3, 0.16, 1.2, 0.5, 0.5, -1, 0, 's'], [0.5, 0.12, 1.4, 0.2, 0.7, -1, -0.2, 's'], [0.98, ...FIST_GL, 's']]
    }
  };
  // el gancho de izquierda es el de derecha en espejo
  FIST_TR.punch2 = {
    L: FIST_TR.punch1.R.map((k) => [k[0], -k[1], k[2], k[3], -k[4], k[5], k[6], k[7]]),
    R: FIST_TR.punch1.L.map((k) => [k[0], -k[1], k[2], k[3], -k[4], k[5], k[6], k[7]])
  };
  const _fk = [0, 0, 0, 0, 0, 0];
  function fistTrack(keys, t, out) {
    if (t <= keys[0][0]) { for (let i = 0; i < 6; i++) out[i] = keys[0][i + 1]; return out; }
    for (let k = 1; k < keys.length; k++) {
      const b = keys[k];
      if (t <= b[0] || k === keys.length - 1) {
        const a = keys[k - 1];
        let u = c01((t - a[0]) / (b[0] - a[0]));
        u = b[7] === 'i' ? u * u * u * 0.4 + u * u * 0.6 : (b[7] === 'o' ? 1 - (1 - u) * (1 - u) : U.smooth(u));
        for (let i = 0; i < 6; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * u;
        return out;
      }
    }
    return out;
  }
  const _fT = new THREE.Vector3(), _fP = new THREE.Vector3(), _fq1 = new THREE.Quaternion(), _fq2 = new THREE.Quaternion();
  let HAND_FX = -0.6;
  G.__setHandFx = (v) => { HAND_FX = v; };
  function fistIK(h, s, w) {
    if (w <= 0.001) return;
    h.root.updateMatrixWorld(true);
    const tr = PUNCH_K[s.action] ? FIST_TR[s.action] : null;
    for (const side of ['L', 'R']) {
      const k = tr ? fistTrack(tr[side], s.t, _fk) : (side === 'R' ? FIST_GR : FIST_GL);
      // en guardia los puños se mecen un poco
      const sw = tr ? 0 : Math.sin((s.time || 0) * 2.3 + (side === 'R' ? 0 : 1.7)) * 0.012;
      h.mesh.localToWorld(_fT.set(k[0], k[1] + sw, k[2]));
      // el codo se guía en el espacio del cuerpo (no gira con el torso): se pasa al de la clavícula
      h.mesh.getWorldQuaternion(_fq1);
      h['clav' + side].getWorldQuaternion(_fq2).invert();
      _fP.set(k[3], k[4], k[5]).normalize().applyQuaternion(_fq1).applyQuaternion(_fq2);
      armIK(h, side, _fT, _fP, w);
      h['hand' + side].rotation.set(HAND_FX, 0, side === 'R' ? -0.15 : 0.15);
    }
  }

  function bandageIK(h, s) {
    const t = s.t;
    const k = win(t, 0, 0.12) * (1 - win(t, 0.9, 1));
    if (k <= 0) return;
    h.root.updateMatrixWorld(true);
    h.chest.localToWorld(_bL.set(0.03, -0.16, 0.3));
    armIK(h, 'L', _bL, _bdA.copy(POLE_BL), k);
    const a = t * 40;
    h.chest.localToWorld(_bR.set(0.07 + 0.02 * Math.sin(a), -0.14 + 0.07 * Math.cos(a), 0.3 + 0.07 * Math.sin(a)));
    armIK(h, 'R', _bR, _bdB.copy(POLE_BR), k);
  }

  // Golpe recibido: tirón seco hacia donde empuja el golpe (atrás si viene de frente, de lado si viene
  // de un lado), un paso atrás y los brazos que se levantan para cubrirse. Un mordisco: forcejeo
  function blowPose(h, b, armed, two, gun, time) {
    const u = b.t, e = u * (b.dur || 0.6);
    const pk = e < 0.05 ? U.smooth(e / 0.05) : Math.exp(-(e - 0.05) * 7) * Math.cos((e - 0.05) * 10);
    const env = sin(Math.PI * Math.pow(u, 0.6));
    const fx = cos(b.rel), sx = sin(b.rel);      // de frente (+) / de espaldas (-), izquierda (+) / derecha (-)
    h.spine.rotation.x += -0.4 * fx * pk;
    h.neck.rotation.x += -0.35 * fx * pk;
    h.spine.rotation.z += -0.3 * sx * pk;
    h.chest.rotation.y += -0.4 * sx * pk;
    h.neck.rotation.z += -0.25 * sx * pk;
    h.hips.position.y -= 0.05 * env;
    const st = sin(u * Math.PI * 2) * env;
    h.legL.rotation.x += 0.3 * st * fx; h.legR.rotation.x -= 0.3 * st * fx;
    h.shinL.rotation.x += 0.3 * env; h.shinR.rotation.x += 0.25 * env;
    if (!gun && !(armed && two)) {
      // se cubre con los antebrazos
      const k = env * (b.bite ? 1 : 0.8);
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.25, k); h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -1.5, k);
      h.armL.rotation.z = U.lerp(h.armL.rotation.z, -0.15, k);
      if (!armed) { h.armR.rotation.x = U.lerp(h.armR.rotation.x, -1.2, k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -1.5, k); }
    }
    if (b.bite) {
      // forcejeo: empuja al zombi con los brazos y sacude el torso
      const w = env, q = sin(time * 28), q2 = sin(time * 23 + 1);
      h.chest.rotation.y += 0.18 * q * w; h.spine.rotation.z += 0.08 * q2 * w;
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.45 + 0.15 * q, w); h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.5, w);
      h.armR.rotation.x = U.lerp(h.armR.rotation.x, -1.4 - 0.15 * q2, w); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -0.55, w);
      h.neck.rotation.x -= 0.2 * w;
    }
  }

  // Esquiva: se agacha y se aparta hacia un lado o hacia atrás, con la guardia alta.
  // rel = dirección de la esquiva respecto a donde mira el personaje
  function dodgePose(h, t, rel, armed, two) {
    const k = sin(Math.PI * c01(t * 1.15)) ;
    const fc = cos(rel), sc = sin(rel);            // adelante (+) / atrás (-), izquierda (+) / derecha (-)
    const L = sc >= 0;
    h.hips.position.y -= 0.17 * k;
    h.hips.rotation.y += -sc * 0.25 * k;
    h.spine.rotation.x += 0.3 * k + 0.12 * fc * k;
    h.spine.rotation.z += -sc * 0.32 * k;
    h.neck.rotation.x -= 0.2 * k; h.neck.rotation.z += sc * 0.22 * k;
    // pierna que lleva el paso hacia la esquiva, la otra empuja
    const lead = L ? 'L' : 'R', push = L ? 'R' : 'L';
    h['leg' + lead].rotation.x += (-0.35 - 0.35 * fc) * k; h['leg' + lead].rotation.z += (L ? 1 : -1) * 0.38 * abs(sc) * k;
    h['shin' + lead].rotation.x += 0.75 * k;
    h['leg' + push].rotation.x += (0.15 - 0.25 * fc) * k; h['shin' + push].rotation.x += 0.55 * k;
    h['leg' + push].rotation.z += (L ? 1 : -1) * 0.12 * abs(sc) * k;
    h['toe' + push].rotation.x -= 0.6 * k;
    // guardia: brazos recogidos delante de la cara
    h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.1, k); h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -1.6, k);
    h.armL.rotation.z = U.lerp(h.armL.rotation.z, -0.2, k);
    if (!armed || two) { h.armR.rotation.x = U.lerp(h.armR.rotation.x, -1.0, k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -1.5, k); }
    else { h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.6, k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -1.2, k); }
    h.clavL.rotation.y -= 0.2 * k; h.clavR.rotation.y += 0.2 * k;
  }

  // Reparte la curva y el giro de la columna entre sus tres tramos (espalda más natural)
  // Clip grabado (G.Clips, tools/glbclip.py) en el instante t (0..1): giro de cada hueso y altura de la cadera.
  // ease: lo que tarda en entrar y salir (fracción del clip), mezclándose con la pose que ya tenía
  const _cqA = new THREE.Quaternion(), _cqB = new THREE.Quaternion();
  function playClip(h, C, t, ease) {
    const w = U.smooth(c01(t / ease)) * U.smooth(c01((1 - t) / ease));
    if (w <= 0) return;
    const f = c01(t) * (C.n - 1), i0 = Math.floor(f), i1 = Math.min(C.n - 1, i0 + 1), fr = f - i0;
    for (const k in C.q) {
      const b = h[k], q = C.q[k];
      if (!b) continue;
      _cqA.fromArray(q, i0 * 4); _cqB.fromArray(q, i1 * 4); _cqA.slerp(_cqB, fr);
      b.quaternion.slerp(_cqA, w);
    }
    h.hips.position.y = U.lerp(h.hips.position.y, 0.95 + C.hy[i0] + (C.hy[i1] - C.hy[i0]) * fr, w);
  }
  function distributeSpine(h) {
    const sp = h.spine.rotation, s2 = h.spine2.rotation, ch = h.chest.rotation;
    const bx = sp.x, by = sp.y, bz = sp.z, cy = ch.y;
    sp.x = bx * 0.5; s2.x += bx * 0.5;
    sp.y = by * 0.6; s2.y += by * 0.4 + cy * 0.3; ch.y = cy * 0.7;
    sp.z = bz * 0.6; s2.z += bz * 0.4;
  }

  // ---- IK de dos huesos: lleva una mano a un punto (en el mundo)
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
  const _down = new THREE.Vector3(0, -1, 0);
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
  const POLE = new THREE.Vector3(0.45, -1, -0.35).normalize();
  // side 'L' o 'R'; target en el mundo (se modifica); pole en el espacio de la clavícula; w = peso (0 FK, 1 IK)
  function armIK(h, side, target, pole, w) {
    if (w <= 0.001) return;
    const clav = h['clav' + side], arm = h['arm' + side], fore = h['fore' + side];
    const T = clav.worldToLocal(target);
    const S = arm.position;
    // largos de verdad de los huesos (0,28 y 0,25 + 0,06 hasta la palma en el esqueleto normal; distintos en las
    // mallas con esqueleto propio o brazos acortados)
    const hand = h['hand' + side], fing = h['fing' + side];
    const A = fore.position.length(), B = hand.position.length() + (h.palm || 0.06);
    const v = _v2.copy(T).sub(S);
    let d = v.length();
    if (d < 1e-4) return;
    v.divideScalar(d);
    d = Math.max(0.08, Math.min(A + B - 0.003, d));
    const cosA = U.clamp((A * A + d * d - B * B) / (2 * A * d), -1, 1);
    const ang = Math.acos(cosA);
    const pp = _v3.copy(pole).addScaledVector(v, -v.dot(pole));
    if (pp.lengthSq() < 1e-6) pp.set(0, -1, 0);
    pp.normalize();
    const u = _v4.copy(v).multiplyScalar(Math.cos(ang)).addScaledVector(pp, Math.sin(ang)).normalize();
    _q1.setFromUnitVectors(_down, u);
    const E = u.multiplyScalar(A).add(S);
    const fdir = T.sub(E).normalize().applyQuaternion(_q2.copy(_q1).invert());
    _q3.setFromUnitVectors(_down, fdir);
    if (w >= 0.999) { arm.quaternion.copy(_q1); fore.quaternion.copy(_q3); }
    else {
      _q4.copy(arm.quaternion); arm.quaternion.copy(_q4.slerp(_q1, w));
      _q4.copy(fore.quaternion); fore.quaternion.copy(_q4.slerp(_q3, w));
    }
  }

  // La mano izquierda agarra el mango justo encima de la derecha, con la muñeca girada para que el mango le
  // cruce la palma igual que a la derecha (no queda una mano abierta al lado del arma)
  const _HY = new THREE.Vector3(0, Math.cos(2.35), Math.sin(2.35));     // eje del mango visto desde la mano
  const _aha = new THREE.Vector3(), _ahb = new THREE.Vector3(), _ahq = new THREE.Quaternion(), _ahq2 = new THREE.Quaternion(), _ahq3 = new THREE.Quaternion();
  // gira la mano (en el mundo) lo justo para que su eje de agarre apunte a lo largo de dir
  function alignHand(h, side, dir) {
    const hand = h['hand' + side], fore = h['fore' + side];
    h['arm' + side].updateMatrixWorld(true);
    _aha.copy(_HY).transformDirection(hand.matrixWorld);
    _ahq.setFromUnitVectors(_aha, _ahb.copy(dir).normalize());
    hand.getWorldQuaternion(_ahq2); _ahq2.premultiply(_ahq);
    fore.getWorldQuaternion(_ahq3); _ahq3.invert().multiply(_ahq2);
    hand.quaternion.copy(_ahq3);
  }
  // Agarrar un mango: la palma (donde va el arma en la derecha) sobre el punto T y el mango a lo largo de dir
  // (el IK apunta con la mano recta; tras girar la muñeca se corrige dos veces lo que se desvió la palma)
  const _g0 = new THREE.Vector3(), _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3(), _gacc = new THREE.Vector3();
  const _gqa = new THREE.Quaternion(), _gqf = new THREE.Quaternion(), _gqh = new THREE.Quaternion();
  function gripIK(h, side, T, pole, dir, w) {
    if (w <= 0.001) return;
    const arm = h['arm' + side], fore = h['fore' + side], hand = h['hand' + side];
    _gqa.copy(arm.quaternion); _gqf.copy(fore.quaternion); _gqh.copy(hand.quaternion);
    _g0.copy(T); _gacc.set(0, 0, 0);
    for (let it = 0; it < 3; it++) {
      armIK(h, side, _g1.copy(_g0).add(_gacc), pole, 1);
      alignHand(h, side, dir);
      if (it === 2) break;
      arm.updateMatrixWorld(true);
      hand.localToWorld(_g2.set(0, -0.05, 0.015));
      _gacc.add(_g1.copy(_g0).sub(_g2));
    }
    if (w < 0.999) {
      arm.quaternion.copy(_gqa.slerp(arm.quaternion, w));
      fore.quaternion.copy(_gqf.slerp(fore.quaternion, w));
      hand.quaternion.copy(_gqh.slerp(hand.quaternion, w));
    }
  }
  // Arma de dos manos en pleno golpe: si la izquierda no llega a su sitio en el mango (en la preparación el
  // arma se va muy atrás), la derecha se acerca lo que falte, con el arma en la misma dirección y el codo en
  // el mismo plano: las dos manos siguen juntas en el mango durante todo el golpe
  const _tR = new THREE.Vector3(), _tD = new THREE.Vector3(), _tL = new THREE.Vector3(), _tS = new THREE.Vector3(), _tE = new THREE.Vector3(), _tP = new THREE.Vector3();
  const REACH_L = 0.55;
  function twoHandHold(h) {
    if (!h.weapon || h.weaponCat === 'spear') return;
    h.root.updateMatrixWorld(true);
    h.weapon.getWorldPosition(_tR);
    _tD.set(0, 1, 0).transformDirection(h.weapon.matrixWorld);
    _tL.copy(_tR).addScaledVector(_tD, h.weaponGrip || 0.1);
    h.armL.getWorldPosition(_tS);
    const d = _tL.distanceTo(_tS);
    if (d <= REACH_L) return;
    _tR.addScaledVector(_tL.sub(_tS).normalize(), -(d - REACH_L));
    // el codo derecho se queda en el plano que tenía
    h.foreR.getWorldPosition(_tE);
    h.clavR.worldToLocal(_tE).sub(h.armR.position);
    _tP.copy(_tE).normalize();
    gripIK(h, 'R', _tR, _tP, _tD, 1);
  }
  function leftHandIK(h) {
    if (!h.weapon) return;
    h.root.updateMatrixWorld(true);
    const grip = h.weaponGrip || 0.2;
    const T = h.weapon.localToWorld(_v1.set(0, grip, 0)).clone();
    if (h.weaponCat === 'spear') { armIK(h, 'L', T, POLE, 1); h.handL.rotation.set(0, 0, 0.3); return; }
    gripIK(h, 'L', T, POLE, _v2.set(0, 1, 0).transformDirection(h.weapon.matrixWorld).clone(), 1);
  }

  // ---- Cabezas que no se atraviesan: en un remate cuerpo a cuerpo, si la cabeza de uno se mete en la del otro
  // (o en su pecho), el cuello y la columna la apartan hacia un lado (por encima del hombro del otro), como
  // en un forcejeo real. P: centro de la cabeza del otro (mundo); pref: lado por defecto (+1 izquierda)
  const _hcH = new THREE.Vector3(), _hcX = new THREE.Vector3(), _hcO = new THREE.Vector3(), _hcC = new THREE.Vector3();
  const HEAD_R = 0.235;
  function headClear(h, other, pref, share) {
    if (!other || !other.head) return;
    h.root.updateMatrixWorld(true); other.root.updateMatrixWorld(true);
    other.head.localToWorld(_hcO.set(0, 0.085, 0.02));
    other.chest.localToWorld(_hcC.set(0, 0.07, 0.02));
    for (let it = 0; it < 3; it++) {
      h.head.localToWorld(_hcH.set(0, 0.085, 0.02));
      const dH = _hcH.distanceTo(_hcO) - HEAD_R, dC = _hcH.distanceTo(_hcC) - 0.25;
      const need = -Math.min(dH, dC);
      if (need <= 0.005) return;
      const P = dH < dC ? _hcO : _hcC;
      _hcX.set(1, 0, 0).transformDirection(h.chest.matrixWorld);
      const lat = (_hcH.x - P.x) * _hcX.x + (_hcH.y - P.y) * _hcX.y + (_hcH.z - P.z) * _hcX.z;
      const side = Math.abs(lat) > 0.03 ? Math.sign(lat) : pref;
      // (rotar el cuello en z negativo lleva la cabeza hacia +x, a su izquierda)
      const ang = Math.min(0.55, need * share / 0.13);
      h.neck.rotation.z -= side * ang * 0.55; h.head.rotation.z -= side * ang * 0.2; h.spine2.rotation.z -= side * ang * 0.3;
      h.neck.rotation.y += side * ang * 0.35;
      h.neck.rotation.x -= ang * 0.15;
      h.root.updateMatrixWorld(true);
    }
  }

  // ---- El infectado se aferra a ella durante el remate: las manos a sus brazos (por encima del codo), tirando y
  // temblando, en vez de dejar los brazos al aire o atravesándola. [t0, t1, peso, manos ('LR', 'R', 'L')]
  const CLUTCH = {
    execShove: [[0.04, 0.56, 0.85, 'LR']], execWall: [[0.1, 0.48, 0.75, 'R']], execTable: [[0.02, 0.26, 0.75, 'LR']],
    execRun: [[0.12, 0.42, 0.7, 'LR']], execCombo: [[0.06, 0.36, 0.75, 'LR']], runKill: [[0.27, 0.56, 0.8, 'LR']]
  };
  const _clT = new THREE.Vector3(), _clP = new THREE.Vector3();
  function clutchIK(h, s, t) {
    const L = CLUTCH[s.held.kind], by = s.held.by;
    if (!L || !by) return;
    h.root.updateMatrixWorld(true); by.root.updateMatrixWorld(true);
    for (const e of L) {
      if (s.held.t <= e[0] || s.held.t >= e[1]) continue;
      const w = e[2] * U.smooth((s.held.t - e[0]) / 0.06) * (1 - U.smooth((s.held.t - (e[1] - 0.07)) / 0.07));
      if (w <= 0.001) continue;
      for (const side of e[3]) {
        // su mano derecha va al brazo izquierdo de ella (están cara a cara) y al revés
        const her = by[side === 'R' ? 'armL' : 'armR'];
        her.localToWorld(_clT.set(0, -0.13 + 0.02 * sin(t * 21 + (side === 'R' ? 0 : 1.3)), 0.03));
        _clP.set(side === 'R' ? -0.6 : 0.6, -1, -0.3).normalize();
        armIK(h, side, _clT, _clP, w);
      }
    }
  }

  // ---- Contacto real en golpes y remates: en el momento del impacto la mano (o la punta del arma) va a buscar
  // la parte del cuerpo del infectado que debe alcanzar (sobre la pose del golpe: el IK solo corrige lo que
  // falta). Así el puño o el filo llegan de verdad al cuerpo, sigan donde sigan los dos. Cada evento:
  // [t0, t pico, t1, mano, parte, efector, retención] (t de la acción, 0 a 1). Efector: 'tip' punta del arma (o el
  // puño si no hay arma a la vista), 'fist' puño, 'palm' palma (agarrar o empujar). Retención: 1 = la mano se
  // queda pegada entre el pico y t1 (agarres), 0 = toca y se va (golpes)
  const CPART = {
    head: ['head', 0, 0.085, 0.02, 0.1], neck: ['neck', 0, 0.035, 0.01, 0.06], chest: ['chest', 0, 0.07, 0.02, 0.13],
    ribs: ['spine2', 0, 0.04, 0.02, 0.13], belly: ['spine', 0, 0.05, 0.03, 0.13], hips: ['hips', 0, 0.02, 0, 0.14],
    shR: ['armR', 0, 0.0, 0.0, 0.06], shL: ['armL', 0, 0.0, 0.0, 0.06], jaw: ['head', 0, 0.02, 0.06, 0.06]
  };
  const CONTACT = {
    execShove: [[0.06, 0.12, 0.6, 'L', 'shR', 'palm', 1], [0.17, 0.24, 0.29, 'R', 'belly', 'tip', 0], [0.34, 0.41, 0.47, 'R', 'ribs', 'tip', 0],
      [0.56, 0.64, 0.72, 'R', 'chest', 'palm', 0], [0.58, 0.64, 0.72, 'L', 'chest', 'palm', 0]],
    execWall: [[0.06, 0.13, 0.62, 'L', 'chest', 'palm', 1], [0.15, 0.21, 0.26, 'R', 'ribs', 'tip', 0], [0.28, 0.33, 0.38, 'R', 'chest', 'tip', 0], [0.4, 0.45, 0.53, 'R', 'ribs', 'tip', 0]],
    execTable: [[0.02, 0.06, 0.1, 'R', 'belly', 'tip', 0], [0.08, 0.12, 0.47, 'L', 'neck', 'palm', 1], [0.14, 0.18, 0.23, 'R', 'ribs', 'tip', 0],
      [0.47, 0.5, 0.72, 'L', 'chest', 'palm', 1], [0.51, 0.55, 0.59, 'R', 'neck', 'tip', 0], [0.61, 0.65, 0.7, 'R', 'neck', 'tip', 0]],
    execRun: [[0.05, 0.093, 0.13, 'R', 'chest', 'tip', 0], [0.12, 0.15, 0.42, 'L', 'shR', 'palm', 1],
      [0.16, 0.185, 0.21, 'R', 'belly', 'tip', 0], [0.22, 0.245, 0.27, 'R', 'belly', 'tip', 0], [0.29, 0.31, 0.33, 'R', 'belly', 'tip', 0], [0.35, 0.37, 0.4, 'R', 'belly', 'tip', 0],
      [0.54, 0.58, 0.82, 'L', 'head', 'palm', 1], [0.63, 0.65, 0.67, 'R', 'neck', 'tip', 0], [0.69, 0.71, 0.73, 'R', 'neck', 'tip', 0], [0.75, 0.77, 0.8, 'R', 'neck', 'tip', 0]],
    execCombo: [[0.04, 0.1, 0.7, 'L', 'shR', 'palm', 1], [0.33, 0.39, 0.45, 'R', 'head', 'tip', 0], [0.58, 0.64, 0.7, 'R', 'head', 'tip', 0]],
    runKill: [[0.2, 0.29, 0.36, 'R', 'belly', 'tip', 0], [0.29, 0.34, 0.6, 'L', 'shR', 'palm', 1], [0.55, 0.62, 0.68, 'R', 'ribs', 'tip', 0], [0.8, 0.88, 0.94, 'L', 'chest', 'palm', 0]],
    execHeavy: [[0.33, 0.425, 0.5, 'R', 'head', 'tip', 0]],
    // golpes normales (el pico lo pone el impacto real de la acción)
    kslash1: [[-0.12, 0, 0.08, 'R', 'chest', 'tip', 0]], kslash2: [[-0.12, 0, 0.08, 'R', 'chest', 'tip', 0]], kstab: [[-0.12, 0, 0.08, 'R', 'ribs', 'tip', 0]],
    swing1: [[-0.13, 0, 0.07, 'R', 'head', 'tip', 0]], swing1b: [[-0.13, 0, 0.07, 'R', 'neck', 'tip', 0]], swing2: [[-0.13, 0, 0.07, 'R', 'chest', 'tip', 0]],
    swing2b: [[-0.13, 0, 0.07, 'R', 'chest', 'tip', 0]], overhead: [[-0.14, 0, 0.07, 'R', 'head', 'tip', 0]], slash: [[-0.13, 0, 0.07, 'R', 'chest', 'tip', 0]],
    stab: [[-0.12, 0, 0.08, 'R', 'belly', 'tip', 0]],
    punch1: [[-0.1, 0, 0.07, 'R', 'jaw', 'fist', 0]], punch2: [[-0.1, 0, 0.07, 'L', 'jaw', 'fist', 0]], punch3: [[-0.12, 0, 0.08, 'R', 'head', 'fist', 0]],
    runatk: [[-0.12, 0, 0.07, 'R', 'head', 'tip', 0]], runshove: [[-0.1, 0, 0.1, 'L', 'chest', 'palm', 0], [-0.1, 0, 0.1, 'R', 'chest', 'palm', 0]],
    bash: [[-0.1, 0, 0.08, 'R', 'chest', 'gun', 0]], shove: [[-0.1, 0, 0.1, 'L', 'chest', 'palm', 0], [-0.1, 0, 0.1, 'R', 'chest', 'palm', 0]],
    finisher: [[-0.12, 0, 0.08, 'R', 'head', 'tip', 0]]
  };
  const _cE = new THREE.Vector3(), _cT = new THREE.Vector3(), _cA = new THREE.Vector3(), _cH = new THREE.Vector3(), _cP = new THREE.Vector3(), _cD = new THREE.Vector3();
  const CONTACT_MAX = 0.32;       // lo más que corrige (si falta más, el golpe no llega: fallo de verdad)
  function contactPoint(m, part, from, pen, out) {
    const P = CPART[part];
    const b = m[P[0]];
    if (!b) return null;
    b.localToWorld(out.set(P[1], P[2], P[3]));
    // la cara del cuerpo que mira al atacante (un poco dentro si el arma corta o pincha)
    _cD.copy(from).sub(out); _cD.y *= 0.35;
    const l = _cD.length();
    if (l > 1e-4) out.addScaledVector(_cD, P[4] * (1 - pen) / l);
    return out;
  }
  function contactIK(h, s) {
    const c = s.contact;
    if (!c || !c.m || !s.action || G.__noContact) return;
    const L = CONTACT[s.action];
    if (!L) return;
    const t = s.t, m = c.m;
    h.root.updateMatrixWorld(true); m.root.updateMatrixWorld(true);
    h.chest.getWorldPosition(_cA);
    for (const e of L) {
      // golpes normales: los tiempos van relativos al impacto de la acción
      const rel = !EXEC_K[s.action];
      const t0 = rel ? (c.impact || 0.45) + e[0] : e[0], tc = rel ? (c.impact || 0.45) : e[1], t1 = rel ? (c.impact || 0.45) + e[2] : e[2];
      if (t <= t0 || t >= t1) continue;
      let w = t < tc ? U.smooth((t - t0) / Math.max(1e-3, tc - t0)) : (e[6] ? 1 - U.smooth((t - (t1 - 0.07)) / 0.07) : 1 - U.smooth((t - tc) / Math.max(1e-3, t1 - tc)));
      const miss = !e[6] && c.hitOK === false;
      if (w <= 0.001) continue;
      const side = e[3], eff = e[5];
      const hand = h['hand' + side];
      // efector actual
      const useTip = eff === 'tip' && side === 'R' && h.weapon && h.weapon.visible !== false && !h.gun;
      if (useTip) h.weapon.localToWorld(_cE.set(0, Math.max(0.12, (c.len || 0.3) * 0.82), 0));
      else if (eff === 'gun' && h.weapon) h.weapon.localToWorld(_cE.set(0, 0, 0.25));
      else hand.localToWorld(_cE.set(0, eff === 'palm' ? -0.075 : -0.06, eff === 'palm' ? 0.025 : 0.015));
      const pen = useTip ? (c.blade ? 0.55 : 0.1) : (eff === 'palm' ? 0.05 : 0.15);
      if (!contactPoint(m, e[4], _cA, pen, _cT)) continue;
      // el golpe que falla pasa rozando por delante del hombro (se ve que no entra)
      if (miss) { _cD.subVectors(_cT, _cA); _cD.y = 0; _cD.normalize(); _cT.x += _cD.z * 0.26 * (side === 'R' ? -1 : 1); _cT.z -= _cD.x * 0.26 * (side === 'R' ? -1 : 1); _cT.y += 0.1; }
      // cuánto le falta (con tope: si está demasiado lejos, no estira el brazo a lo imposible)
      _cD.copy(_cT).sub(_cE);
      const dl = _cD.length();
      if (dl > CONTACT_MAX) _cD.multiplyScalar(CONTACT_MAX / dl);
      hand.getWorldPosition(_cH).addScaledVector(_cD, w);
      // el codo en el plano que traía
      h['fore' + side].getWorldPosition(_cP);
      h['clav' + side].worldToLocal(_cP).sub(h['arm' + side].position).normalize();
      const q = hand.quaternion.clone();
      armIK(h, side, _cH, _cP, 1);
      hand.quaternion.copy(q);
      h['arm' + side].updateMatrixWorld(true);
    }
  }
  // (los zarpazos del infectado: la garra al cuerpo o a la cara)
  Object.assign(CONTACT, {
    z_punch1: [[-0.12, 0, 0.08, 'R', 'chest', 'fist', 0]], z_punch2: [[-0.12, 0, 0.08, 'L', 'head', 'fist', 0]],
    z_punch3: [[-0.12, 0, 0.08, 'R', 'shL', 'fist', 0], [-0.12, 0, 0.08, 'L', 'shR', 'fist', 0]],
    z_runatk: [[-0.12, 0, 0.1, 'R', 'chest', 'palm', 0], [-0.12, 0, 0.1, 'L', 'chest', 'palm', 0]]
  });
  const _zc = { action: null, t: 0, contact: null }, _zcc = { m: null, len: 0.2, blade: false, impact: 0.42, hitOK: true };
  const _pkT = new THREE.Vector3(), _pkH = new THREE.Vector3(), _pkP = new THREE.Vector3();
  const EXEC_K = { execShove: 1, execWall: 1, execTable: 1, execRun: 1, execCombo: 1, runKill: 1, execHeavy: 1 };

  // Armas cuerpo a cuerpo de dos manos sin golpear: las dos manos en el mango, el arma por delante en guardia
  // baja (cabeza arriba y algo adelantada); corriendo, apoyada contra el hombro derecho; en guardia, alzada.
  // [x, y, z del agarre de la derecha, y dirección del mango] en el espacio del pecho
  const M2 = {
    rest: [-0.07, -0.34, 0.25, -0.28, 0.85, 0.42],
    run: [-0.1, -0.22, 0.2, -0.3, 0.88, -0.38],
    guard: [-0.05, -0.18, 0.32, -0.12, 0.78, 0.6]
  };
  const _mA = [0, 0, 0, 0, 0, 0], _mB = [0, 0, 0, 0, 0, 0], _mP = new THREE.Vector3(), _mD = new THREE.Vector3();
  const POLE_MR = new THREE.Vector3(-0.6, -1, -0.15).normalize();
  function meleeTwoIK(h, s) {
    if (!h.weapon) return;
    const want = s.action || s.struggle || s.climb != null || (s.prone || 0) > 0.3 || (s.blow && s.blow.react === 'launch') ? 0 : 1;
    const k = s.dt != null ? 1 - Math.exp(-s.dt * 14) : 1;
    h.m2w = h.m2w == null ? want : h.m2w + (want - h.m2w) * k;
    const w = U.smooth(c01(h.m2w));
    if (w <= 0.001) return;
    // carrera y guardia con su propio suavizado (para que no salte al empezar o dejar de correr)
    const rk0 = s.run ? U.smooth(c01(((s.speed || 0) - 3.2) / 1.4)) * (1 - c01((s.crouch || 0) * 2)) : 0;
    const gk0 = Math.max(s.aim && !s.action ? 1 : 0, 0.6 * (s.alert || 0)) * (1 - rk0);
    const k2 = s.dt != null ? 1 - Math.exp(-s.dt * 10) : 1;
    h.m2rk = h.m2rk == null ? rk0 : h.m2rk + (rk0 - h.m2rk) * k2;
    h.m2gk = h.m2gk == null ? gk0 : h.m2gk + (gk0 - h.m2gk) * k2;
    const rk = h.m2rk, gk = h.m2gk;
    lerp6(M2.rest, M2.run, rk, _mA);
    lerp6(_mA, M2.guard, gk, _mB);
    if (rk > 0) _mB[1] += 0.012 * sin((s.phase || 0) * 2) * rk;
    h.root.updateMatrixWorld(true);
    h.chest.localToWorld(_mP.set(_mB[0], _mB[1], _mB[2]));
    _mD.set(_mB[3], _mB[4], _mB[5]).normalize().transformDirection(h.chest.matrixWorld);
    gripIK(h, 'R', _mP, POLE_MR, _mD, w);
  }

  // ---- Armas de fuego: pose del soporte (en el espacio del pecho) y manos con IK
  // [x, y, z, cabeceo, giro, alabeo]; cabeceo positivo = cañón hacia abajo; giro positivo = hacia la izquierda
  // ready: sin apuntar, andando o quieto. run: corriendo
  // pistola: en la mano derecha, abajo junto a la cadera (la izquierda la agarra al apuntar o recargar)
  // armas largas, siempre a dos manos: la culata bajo la axila y el cañón hacia delante y abajo, la izquierda en el guardamanos;
  // corriendo, cruzada en diagonal contra el pecho (cañón arriba a la izquierda), como en el culatazo
  const GP = {
    pistol: { ready: [-0.24, -0.4, 0.16, 1.25, 0.08, 0], aim: [-0.05, 0.2, 0.45, 0, 0.05, 0], load: [-0.05, 0.03, 0.3, 0.35, 0.3, -0.6], L: [0.03, -0.035, 0.0] },
    shotgun: { ready: [-0.15, -0.1, 0.14, 0.48, 0.49, -0.2], run: [-0.13, -0.13, 0.2, -0.6, 1.4, 0.15], aim: [-0.13, 0.155, 0.28, 0, 0.03, 0], load: [-0.07, -0.02, 0.27, 0.3, 0.35, -0.75], L: [0, -0.016, 0.3] },
    rifle: { ready: [-0.15, -0.1, 0.14, 0.48, 0.49, -0.2], run: [-0.13, -0.13, 0.2, -0.6, 1.4, 0.15], aim: [-0.13, 0.155, 0.28, 0, 0.03, 0], load: [-0.08, 0.0, 0.27, 0.2, 0.3, -0.45], L: [0, -0.012, 0.3] },
    bow: { ready: [0.25, -0.3, 0.1, 0.35, 0, 0.1], aim: [0.04, 0.25, 0.5, 0, -0.04, -0.22], load: null, L: [0, 0, 0] }
  };
  const PRONE_GUN = [-0.16, 0.55, 0.12, -1.5, 0, 0];
  // rehén: pistola contra la sien del rehén (que va delante) y la mano izquierda sobre su hombro derecho
  const HOST_GUN = [-0.17, 0.33, 0.24, 0.1, 1.25, 0.2], HOST_ARM = [-0.1, 0.02, 0.47];
  // apuntando con un rehén: el brazo derecho estirado por encima de su hombro derecho
  const HOST_AIM = [-0.26, 0.24, 0.52, 0, 0.12, 0];
  // pecho a tierra apuntando: el arma delante de la cara, apoyada en los codos (en el espacio del pecho
  // tumbado: y = hacia delante, z = hacia el suelo)
  const PRONE_AIM = [-0.09, 0.4, -0.1, -1.5, 0.02, 0];
  const _PA = [0, 0, 0, 0, 0, 0];
  const RECOIL = { pistol: [0.06, 0.45], shotgun: [0.1, 0.58], rifle: [0.08, 0.38], bow: [0, 0] };
  const POLE_R = new THREE.Vector3(-0.5, -1, -0.25).normalize(), POLE_RA = new THREE.Vector3(-1, -0.35, -0.1).normalize();
  const POLE_L = new THREE.Vector3(0.45, -1, -0.2).normalize(), POLE_LA = new THREE.Vector3(0.25, -1, 0.1).normalize();
  const POLE_DRAW = new THREE.Vector3(-0.85, 0.1, 0.45).normalize();   // codo derecho hacia fuera, a la altura del hombro
  const POLE_BOW = new THREE.Vector3(0.6, -1, 0.1).normalize();
  const BOW_DRAW = 0.58;      // cuánto se tensa la cuerda (m): hasta la barbilla
  const _bm1 = new THREE.Matrix4(), _bm2 = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion();
  const _be = new THREE.Euler(0, 0, 0, 'YXZ'), _bp = new THREE.Vector3(), _bp2 = new THREE.Vector3(), _bs = new THREE.Vector3(), _bsh = new THREE.Vector3();
  const _pR = new THREE.Vector3(), _pL = new THREE.Vector3(), _poleR = new THREE.Vector3(), _poleL = new THREE.Vector3();
  const lerp6 = (a, b, k, out) => { for (let i = 0; i < 6; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; };
  const _T = [0, 0, 0, 0, 0, 0], _B = [0, 0, 0, 0, 0, 0], _RB = [0, 0, 0, 0, 0, 0];
  const win = (t, a, b) => U.smooth((t - a) / (b - a));      // 0 antes de a, 1 después de b

  const _amD = new THREE.Vector3(), _amM = new THREE.Vector3(), _amW = new THREE.Vector3(), _amQ = new THREE.Quaternion(), _amI = new THREE.Quaternion(), _amA = new THREE.Quaternion(), _amP = new THREE.Quaternion();
  // hombro derecho del esqueleto normal en el espacio del pecho (clavícula + brazo)
  const GUN_SH = new THREE.Vector3(-0.19, 0.11, 0), _gS = new THREE.Vector3();
  function gunIK(h, s, gs) {
    const g = h.gun;
    if (!g) return;
    const G6 = GP[g.kind];
    const ai = s.climb != null ? 0 : U.smooth(c01(gs.aim));
    // corriendo (de pie): el arma va contra el pecho; el pecho sigue el balanceo de la carrera y los
    // hombros la llevan con él, con un pequeño rebote a cada zancada
    const rk = G6.run && s.run && s.climb == null ? U.smooth(c01(((s.speed || 0) - 3.2) / 1.4)) * (1 - c01((s.crouch || 0) * 2)) : 0;
    // con un rehén: sin apuntar, el cañón contra su sien (la pistola apunta hacia la izquierda)
    const host = !!s.hostage && g.kind === 'pistol';
    const base = host ? HOST_GUN : (rk > 0 ? lerp6(G6.ready, G6.run, rk, _RB) : G6.ready);
    const T = lerp6(base, host ? HOST_AIM : G6.aim, ai, _T);
    if (rk > 0) { const bp = sin((s.phase || 0) * 2); T[1] += 0.014 * bp * rk * (1 - ai); T[3] += 0.05 * bp * rk * (1 - ai); }
    const rw = G6.load ? c01(gs.rw || 0) : 0;
    if (rw > 0) lerp6(T, G6.load, U.smooth(rw), T);
    const cyc = gs.cycle != null && gs.cycle >= 0 ? gs.cycle : -1;
    if (cyc >= 0 && g.kind !== 'bow') { const d = sin(Math.PI * cyc); T[1] -= 0.03 * d; T[3] += 0.12 * d; }
    T[3] += (s.pitch || 0) * 0.6 * ai;
    // agachado sin apuntar: el torso se inclina mucho; el arma larga no acompaña esa inclinación (si no, queda
    // vertical apuntando al suelo entre las piernas): sigue cruzada por delante, con el cañón algo bajo
    if (g.kind !== 'pistol' && g.kind !== 'bow') T[3] -= 0.62 * (s.crouch || 0) * (1 - ai);
    // culatazo / golpe con la pistola
    // (con un arma larga, el empujón también es con el arma cruzada, como el culatazo)
    let bw = 0;
    if (s.action === 'bash' || (s.action === 'shove' && g.kind !== 'pistol' && g.kind !== 'bow')) {
      const t = s.t;
      bw = win(t, 0, 0.12) * (1 - win(t, 0.8, 1));
      const wind = easeOut(t / 0.3), hit = easeIn((t - 0.28) / 0.17), back = U.smooth((t - 0.6) / 0.4);
      const f = hit * (1 - back);
      if (g.kind === 'pistol') {
        _B[0] = -0.2 + 0.14 * f; _B[1] = 0.3 * wind * (1 - hit) - 0.05 * f; _B[2] = 0.12 + 0.3 * f;
        _B[3] = -1.2 * wind * (1 - hit) + 1.0 * f; _B[4] = 0; _B[5] = 0;
      } else {
        _B[0] = -0.02; _B[1] = 0.06 + 0.04 * f; _B[2] = 0.16 - 0.05 * wind * (1 - hit) + 0.28 * f;
        _B[3] = 0; _B[4] = 1.3; _B[5] = 0;
      }
      lerp6(T, _B, bw, T);
    }
    const pr = U.smooth(c01(s.prone || 0));
    if (pr > 0) {
      lerp6(PRONE_GUN, PRONE_AIM, ai, _PA);
      _PA[3] += (s.pitch || 0) * 0.6 * ai;
      if (cyc >= 0 && g.kind !== 'bow') _PA[3] += 0.08 * sin(Math.PI * cyc);
      lerp6(T, _PA, pr, T);
    }

    // suavizado del soporte (el retroceso se suma después, para que sea seco)
    if (!h.gunT || !h.gunAnchorOk) { h.gunT = T.slice(); h.gunAnchorOk = true; }
    const k = s.dt != null ? 1 - Math.exp(-s.dt * 16) : 1;
    for (let i = 0; i < 6; i++) h.gunT[i] += (T[i] - h.gunT[i]) * k;
    const R = h.gunT, rc = RECOIL[g.kind], rec = (gs.recoil || 0) * (1 - pr * 0.5);
    const an = h.gunAnchor;
    an.rotation.order = 'YXZ';
    const gk = h.gunK || 1, gS = h.gunS;
    an.position.set(R[0], R[1] + 0.02 * rec, R[2] - rc[0] * rec);
    // (esqueleto propio: lo que sube el arma sobre el hombro, menos que en proporción: con el cuello corto quedaba
    // delante de la cara)
    if (gS) { an.position.sub(GUN_SH).multiplyScalar(gk); if (an.position.y > 0) an.position.y *= 0.35; an.position.add(_gS.fromArray(gS)); }
    an.rotation.set(R[3], R[4], R[5]);
    // apuntando: el cañón va de verdad hacia lo que se apunta (s.aimAt, en el mundo). La pose del pecho deja
    // unos grados de error (el arma miraba al costado o al suelo); se corrige girando el soporte del arma antes
    // de colocar las manos, así las manos siguen agarrándola. El retroceso se suma después
    const aimK = s.aimAt && !G.__noAimFix && g.kind !== 'bow' ? ai * (1 - c01(gs.rw || 0)) * (1 - pr) : 0;
    if (aimK > 0.01 && s.action !== 'bash' && s.action !== 'shove') {
      h.root.updateMatrixWorld(true);
      g.holder.position.set(0, 0, 0); g.holder.quaternion.identity(); g.holder.updateMatrixWorld(true);
      _amD.set(0, 0, 1).transformDirection(g.holder.matrixWorld);
      g.muzzle.getWorldPosition(_amM);
      _amW.set(s.aimAt.x - _amM.x, s.aimAt.y - _amM.y, s.aimAt.z - _amM.z);
      if (_amW.lengthSq() > 0.25) {
        _amW.normalize();
        _amQ.setFromUnitVectors(_amD, _amW);
        // (como mucho unos 25 grados: si el blanco queda detrás, no se retuerce)
        const ang = 2 * Math.acos(U.clamp(_amQ.w, -1, 1));
        const kk = aimK * (ang > 0.45 ? 0.45 / ang : 1);
        _amQ.slerp(_amI, 1 - kk);
        an.getWorldQuaternion(_amA); _amA.premultiply(_amQ);
        an.parent.getWorldQuaternion(_amP).invert();
        an.quaternion.copy(_amP.multiply(_amA));
      }
    }
    if (rec > 0) an.rotateX(-rc[1] * rec);
    h.weapon.visible = s.action !== 'grab';
    // (el gesto de guardar o sacar la puede haber movido a la mano: cada fotograma vuelve a su soporte)
    g.holder.position.set(0, 0, 0); g.holder.quaternion.identity();
    // Arco apuntando: el arco se coloca en el espacio del personaje (no del pecho), con el brazo
    // izquierdo estirado desde el hombro hacia donde miras, aunque el torso esté girado de perfil
    if (g.kind === 'bow') {
      const wa = ai * (1 - bw) * (1 - pr);
      if (wa > 0.001) {
        h.root.updateMatrixWorld(true);
        const pt = s.pitch || 0;
        // hombro izquierdo en el espacio del personaje
        h.armL.getWorldPosition(_bsh);
        h.root.worldToLocal(_bsh);
        const dx = 0, dy = -Math.sin(pt), dz = Math.cos(pt);
        _bp.set(_bsh.x - 0.07 + dx * 0.6, _bsh.y + 0.07 + dy * 0.6, _bsh.z + dz * 0.6);
        _be.set(pt, 0.03, -0.16);
        _bq.setFromEuler(_be);
        _bm1.compose(_bp, _bq, _bs.set(1, 1, 1));
        _bm1.premultiply(h.root.matrixWorld);
        _bm2.copy(h.chest.matrixWorld).invert().multiply(_bm1);
        _bm2.decompose(_bp2, _bq2, _bs);
        an.position.lerp(_bp2, wa);
        an.quaternion.slerp(_bq2, wa);
      }
      // suavizado propio (el del resto de armas va en ángulos del pecho)
      if (!h.bowP) { h.bowP = an.position.clone(); h.bowQ = an.quaternion.clone(); }
      const kb = s.dt != null ? 1 - Math.exp(-s.dt * 18) : 1;
      h.bowP.lerp(an.position, kb); h.bowQ.slerp(an.quaternion, kb);
      an.position.copy(h.bowP); an.quaternion.copy(h.bowQ);
    } else if (h.bowP) { h.bowP = null; h.bowQ = null; }

    // piezas móviles
    if (g.kind === 'shotgun' && g.part) {
      g.part.position.y = g.partRest - (cyc >= 0 ? 0.1 * sin(Math.PI * cyc) : 0);
    } else if (g.kind === 'rifle') {
      let rot = 0, back = 0;
      if (cyc >= 0) {
        const up = win(cyc, 0.18, 0.32) - win(cyc, 0.72, 0.84);
        const bk = win(cyc, 0.34, 0.52) - win(cyc, 0.54, 0.7);
        rot = up; back = bk;
      }
      rot = Math.max(rot, rw); back = Math.max(back, rw);
      g.part.rotation.y = -1.1 * rot;
      g.part.position.y = g.partRest - 0.08 * back;
    }
    let nockY = -0.07;
    if (g.kind === 'bow') {
      const draw = cyc >= 0 ? 0 : c01(gs.draw || 0);
      nockY = -0.07 - BOW_DRAW * draw;
      const p = g.string.geometry.attributes.position;
      p.setY(1, nockY); p.needsUpdate = true;
      g.arrow.visible = gs.arrow && (cyc < 0 || cyc > 0.8);
      g.arrow.position.y = nockY;
    }

    h.root.updateMatrixWorld(true);
    const hold = (x, y, z) => h.weapon.localToWorld(_pR.set(x, y, z));
    const chestP = (x, y, z, out) => h.chest.localToWorld(out.set(x, y, z));

    // ---- mano derecha
    let wR = 1, poleR = _poleR.copy(POLE_R).lerp(POLE_RA, g.kind === 'pistol' ? ai * 0.3 : ai).normalize();
    let tR;
    if (g.kind === 'bow') {
      wR = Math.max(ai, cyc >= 0 ? 1 : 0, bw);
      tR = hold(-0.015, 0, nockY);
      if (cyc >= 0) {
        const a = _v3.copy(tR);
        const ft = chestP(-0.14, 0.27, -0.06, _pL.clone());
        const qv = chestP(-0.12, 0.34, -0.2, _pL.clone());
        const rest = hold(-0.015, 0, -0.07).clone();
        let p = a.clone().lerp(ft, win(cyc, 0, 0.12));
        p.lerp(qv, win(cyc, 0.12, 0.45));
        p.lerp(rest, win(cyc, 0.45, 0.8));
        tR = _pR.copy(p);
      }
      poleR = _poleR.copy(POLE_DRAW);
    } else {
      tR = hold(0, 0, 0).clone();
      if (g.kind === 'rifle' && cyc >= 0) {
        const knob = g.part.localToWorld(_v3.set(-0.05, 0, 0.004)).clone();
        tR.lerp(knob, win(cyc, 0.04, 0.18) * (1 - win(cyc, 0.84, 0.98)));
      }
      if (g.kind === 'rifle' && rw > 0) {
        const u = gs.ru || 0;
        const pocket = chestP(-0.2, -0.3, 0.1, _v3.clone());
        const port = hold(0, 0.03, 0.04).clone();
        const toPocket = win(u, 0, 0.4) * (1 - win(u, 0.45, 0.85));
        tR.lerp(port.lerp(pocket, toPocket), U.smooth(rw));
      }
    }
    armIK(h, 'R', tR, poleR, wR);

    // ---- mano izquierda
    let wL = 1, tL;
    if (g.kind === 'bow') tL = hold(0, -0.01, 0).clone();
    else {
      tL = hold(G6.L[0], G6.L[1], G6.L[2] + (g.kind === 'shotgun' && cyc >= 0 ? -0.1 * sin(Math.PI * cyc) : 0)).clone();
      if (g.kind === 'pistol') {
        wL = Math.max(ai, rw);
        if (s.action === 'bash') wL *= 1 - bw;
        if (rw > 0) {
          const u = gs.ru || 0;
          const well = hold(0, -0.1, -0.04).clone();
          const pouch = chestP(0.14, -0.36, 0.12, _v3.clone());
          const slideA = hold(0, 0.045, -0.03).clone(), slideB = hold(0, 0.045, -0.1).clone();
          const p = tL.clone().lerp(well, win(u, 0, 0.14));
          p.lerp(pouch, win(u, 0.16, 0.38));
          p.lerp(well, win(u, 0.42, 0.62));
          p.lerp(slideA, win(u, 0.64, 0.74));
          p.lerp(slideB, win(u, 0.76, 0.84));
          p.lerp(tL, win(u, 0.86, 1));
          tL = p;
        }
      }
      if (g.kind === 'shotgun' && rw > 0) {
        const u = gs.ru || 0;
        const belt = chestP(0.06, -0.33, 0.16, _v3.clone());
        const port = hold(0, -0.04, 0.06).clone();
        const p = tL.clone().lerp(belt, win(u, 0, 0.3) * U.smooth(rw));
        p.lerp(port, win(u, 0.4, 0.75) * U.smooth(rw));
        tL = p;
      }
      if (pr > 0.5 || s.climb != null) wL = 0;
      // con un rehén: el brazo izquierdo le rodea el pecho y lo sujeta
      if (host) { wL = 1; tL = chestP(HOST_ARM[0], HOST_ARM[1], HOST_ARM[2], _v3.clone()); }
    }
    const poleL = g.kind === 'bow' ? _poleL.copy(POLE_L).lerp(POLE_BOW, ai).normalize() : _poleL.copy(POLE_L).lerp(POLE_LA, ai).normalize();
    armIK(h, 'L', tL, poleL, wL);
    if (pr > 0.5 && g.kind === 'bow') { /* tumbado: el arco va en la mano izquierda igual */ }
  }

  // ---------- Poses por fotogramas clave ----------
  // Cada acción: claves [t, { hueso: [x, y, z] }, curva]. Con '+' delante el giro se suma a lo que ya
  // tenía el hueso (piernas, columna); sin él, se fija. 'hipsY' baja o sube la cadera.
  // Curva del tramo que termina en la clave: 's' suave, 'i' acelera (el golpe), 'o' frena, 'l' lineal
  const ZERO3 = [0, 0, 0];
  function keyPose(h, K, t) {
    if (!K.bones) {
      const set = new Set();
      for (const k of K.keys) for (const b in k[1]) set.add(b);
      K.bones = [...set];
    }
    const keys = K.keys;
    let i = 1;
    while (i < keys.length - 1 && t > keys[i][0]) i++;
    const a = keys[i - 1], b = keys[i];
    let u = c01((t - a[0]) / Math.max(1e-4, b[0] - a[0]));
    const e = b[2] || 's';
    u = e === 'i' ? u * u * (0.4 + 0.6 * u) : (e === 'o' ? 1 - (1 - u) * (1 - u) : (e === 'l' ? u : U.smooth(u)));
    for (const name of K.bones) {
      const va = a[1][name] || ZERO3, vb = b[1][name] || ZERO3;
      const x = va[0] + (vb[0] - va[0]) * u, y = va[1] + (vb[1] - va[1]) * u, z = va[2] + (vb[2] - va[2]) * u;
      if (name === 'hipsY') { h.hips.position.y += x; continue; }
      const add = name.charAt(0) === '+';
      const bn = h[add ? name.slice(1) : name];
      if (!bn) continue;
      if (add) { bn.rotation.x += x; bn.rotation.y += y; bn.rotation.z += z; }
      else bn.rotation.set(x, y, z);
    }
  }
  // guardia con la navaja (de aquí salen y aquí vuelven los golpes)
  const RDY = { armR: [-0.62, 0, -0.12], foreR: [-1.05, 0, 0], handR: [-0.25, 0, 0], armL: [-0.45, 0, 0.18], foreL: [-0.95, 0, 0] };
  const kp = (o) => Object.assign({}, RDY, o);
  const LEAN = (k) => ({ '+spine': [0.15 * k, 0, 0], hipsY: [-0.03 * k, 0, 0] });
  const KP = {
    // Combo con la navaja (tiempos y trayectorias del vídeo de referencia, poses propias):
    // 1: tajo en diagonal, de arriba a la derecha hacia abajo a la izquierda, con el brazo que sigue de largo
    kslash1: { keys: [
      [0, kp({})],
      [0.3, kp({ armR: [-2.3, 0.2, -0.7], foreR: [-1.2, 0, 0], handR: [0.3, 0.4, 0.3], armL: [-0.75, 0, 0.3], foreL: [-1.2, 0, 0], '+chest': [0.0, -0.5, 0], '+spine': [-0.02, -0.22, 0], '+hips': [0, -0.14, 0], '+legR': [0.05, 0, 0] }), 'o'],
      [0.44, kp(Object.assign({ armR: [-1.35, -0.3, 0.45], foreR: [-0.25, 0, 0], handR: [0, -0.5, 0], armL: [-0.35, 0, 0.5], foreL: [-0.6, 0, 0], '+chest': [0.12, 0.55, 0], '+hips': [0, 0.2, 0], '+legL': [-0.32, 0, 0], '+shinL': [0.28, 0, 0], '+legR': [0.2, 0, 0], '+toeR': [-0.45, 0, 0] }, LEAN(1), { '+spine': [0.18, 0.25, 0] })), 'i'],
      [0.64, kp(Object.assign({ armR: [-0.55, -0.5, 0.85], foreR: [-0.2, 0, 0], handR: [0, -0.3, 0], armL: [-0.4, 0, 0.6], foreL: [-0.8, 0, 0], '+chest': [0.14, 0.72, 0], '+hips': [0, 0.24, 0], '+legL': [-0.34, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [0.2, 0, 0], '+toeR': [-0.4, 0, 0] }, LEAN(1.4), { '+spine': [0.24, 0.3, 0] })), 'o'],
      [1, kp({})]
    ] },
    // 2: revés de izquierda a derecha que termina con el brazo estirado del todo a la derecha y la izquierda
    // levantada para equilibrarse
    kslash2: { keys: [
      [0, kp({})],
      [0.3, kp({ armR: [-1.2, -0.3, 0.75], foreR: [-1.9, 0, 0], handR: [0.2, -0.7, -0.3], armL: [-0.55, 0, 0.35], foreL: [-1.0, 0, 0], '+chest': [0.04, 0.55, 0], '+spine': [0.05, 0.22, 0], '+hips': [0, 0.12, 0] }), 'o'],
      [0.47, kp(Object.assign({ armR: [-1.45, 0.25, -0.9], foreR: [-0.15, 0, 0], handR: [0, 0.55, 0], armL: [-0.7, 0, 0.6], foreL: [-0.7, 0, 0], '+chest': [0.12, -0.55, 0], '+hips': [0, -0.18, 0], '+legR': [-0.25, 0, 0], '+shinR': [0.22, 0, 0], '+legL': [0.18, 0, 0], '+toeL': [-0.4, 0, 0] }, LEAN(1), { '+spine': [0.14, -0.22, 0] })), 'i'],
      [0.66, kp(Object.assign({ armR: [-1.05, 0.35, -1.2], foreR: [-0.05, 0, 0], handR: [0, 0.35, 0], armL: [-0.9, 0, 1.1], foreL: [-0.6, 0, 0], '+chest': [0.12, -0.65, 0], '+hips': [0, -0.2, 0], '+legR': [-0.24, 0, 0], '+shinR': [0.2, 0, 0], '+legL': [0.16, 0, 0] }, LEAN(1), { '+spine': [0.13, -0.24, 0] })), 'o'],
      [1, kp({})]
    ] },
    // 3: estocada de frente al pecho, la saca hacia arriba y atrás por encima del hombro (gran recorrido)
    kstab: { keys: [
      [0, kp({})],
      [0.28, kp({ armR: [-0.4, 0, -0.3], foreR: [-2.0, 0, 0], handR: [-0.8, 0, 0], armL: [-1.2, 0, -0.1], foreL: [-0.8, 0, 0], '+spine': [0.08, -0.1, 0], '+chest': [0, -0.2, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.2, 0, 0] }), 'o'],
      [0.45, kp({ armR: [-1.55, 0.1, 0.05], foreR: [-0.15, 0, 0], handR: [-0.3, 0, 0], armL: [-0.9, 0, 0.3], foreL: [-1.0, 0, 0], '+spine': [0.25, 0.1, 0], '+chest': [0.06, 0.18, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.42, 0, 0], '+legR': [0.28, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.06, 0, 0] }), 'i'],
      [0.68, kp({ armR: [-1.9, -0.2, -0.9], foreR: [-1.3, 0, 0], handR: [0.2, 0, 0], armL: [-0.8, 0, 0.5], foreL: [-0.9, 0, 0], '+spine': [0.12, -0.1, 0], '+chest': [-0.02, -0.4, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [0.2, 0, 0], hipsY: [-0.04, 0, 0] }), 'o'],
      [1, kp({})]
    ] },
    // ---- Remates del vídeo de referencia (tiempos medidos cuadro a cuadro; poses propias) ----
    // ataque en carrera: carga la navaja atrás y abajo, lo ensarta al llegar, lo abre de lado y lo aparta
    runKill: { keys: [
      [0, { '+spine': [0.25, 0, 0], armR: [0.45, 0, -0.25], foreR: [-0.6, 0, 0], handR: [-0.3, 0, 0], armL: [-0.6, 0, 0.2], foreL: [-1.0, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.6, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.4, 0, 0], hipsY: [-0.05, 0, 0] }],
      [0.19, { '+spine': [0.35, -0.1, 0], '+chest': [0, -0.45, 0], armR: [0.75, 0, -0.35], foreR: [-0.9, 0, 0], handR: [-0.4, 0, 0], armL: [-1.1, 0, 0.15], foreL: [-0.6, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.45, 0, 0], '+shinR': [0.5, 0, 0], hipsY: [-0.1, 0, 0] }, 'o'],
      [0.29, { '+spine': [0.45, 0.15, 0], '+chest': [0.05, 0.45, 0], armR: [-1.35, 0, 0.12], foreR: [-0.15, 0, 0], handR: [-0.2, 0, 0], armL: [-1.25, 0, -0.1], foreL: [-0.9, 0, 0], '+legL': [-0.85, 0, 0], '+shinL': [0.75, 0, 0], '+legR': [0.55, 0, 0], '+shinR': [0.25, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.14, 0, 0] }, 'i'],
      [0.43, { '+spine': [0.35, 0.1, 0], '+chest': [0.05, 0.3, 0], armR: [-1.2, 0, 0.15], foreR: [-0.4, 0, 0], handR: [-0.3, 0, 0], armL: [-1.55, 0, -0.25], foreL: [-0.55, 0, 0], '+legL': [-0.8, 0, 0], '+shinL': [0.75, 0, 0], '+legR': [0.5, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.12, 0, 0] }, 'o'],
      [0.55, { '+spine': [0.3, 0.05, 0], '+chest': [0.05, 0.55, 0], armR: [-1.05, 0, 0.45], foreR: [-1.2, 0, 0], handR: [0.2, 0.3, 0], armL: [-1.5, 0, -0.2], foreL: [-0.6, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.45, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.1, 0, 0] }, 's'],
      [0.66, { '+spine': [0.2, -0.1, 0], '+chest': [0, -0.45, 0], armR: [-1.55, 0.2, -0.55], foreR: [-0.5, 0, 0], handR: [0, -0.4, 0], armL: [-1.35, 0, 0.1], foreL: [-0.9, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.08, 0, 0] }, 'i'],
      [0.8, { '+spine': [0.2, -0.1, 0], '+chest': [0, -0.6, 0], armR: [-1.4, 0.3, -0.7], foreR: [-1.0, 0, 0], handR: [0, -0.3, 0], armL: [-1.1, 0, 0.2], foreL: [-1.2, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.07, 0, 0] }, 'o'],
      [0.88, { '+spine': [0.3, 0, 0], '+chest': [0.05, 0.3, 0], armL: [-1.45, 0, -0.05], foreL: [-0.1, 0, 0], armR: [-0.6, 0, -0.3], foreR: [-1.0, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.35, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [1, kp({ '+spine': [0.2, 0, 0] })]
    ] },
    // remate en carrera (a un aturdido): tajo desde arriba, lo sujeta de la muñeca y le apuñala el vientre
    // cuatro veces, se mete bajo él, lo agarra de la cabeza, tres puñaladas al cuello y lo tira al suelo
    execRun: { keys: [
      [0, { '+spine': [0.3, 0, 0], armR: [0.5, 0, -0.3], foreR: [-0.7, 0, 0], armL: [-0.7, 0, 0.25], foreL: [-1.1, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.6, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.4, 0, 0], hipsY: [-0.05, 0, 0] }],
      [0.037, { '+spine': [0.3, 0, 0], '+chest': [0, -0.45, 0], armR: [0.95, 0, -0.3], foreR: [-0.55, 0, 0], handR: [0.25, 0, 0], armL: [-1.35, 0, 0.3], foreL: [-0.35, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.4, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'o'],
      [0.093, { '+spine': [0.45, 0, 0], '+chest': [0.1, 0.5, 0], armR: [-1.2, 0, 0.35], foreR: [-0.3, 0, 0], handR: [-0.3, 0, 0], armL: [-0.6, 0, 0.4], foreL: [-0.8, 0, 0], '+legL': [-0.8, 0, 0], '+shinL': [0.8, 0, 0], '+legR': [0.5, 0, 0], '+shinR': [0.3, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.12, 0, 0] }, 'i'],
      [0.15, { '+spine': [0.35, 0.1, 0], '+chest': [0.05, 0.2, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.5, 0, 0.1], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.1, 0, 0] }, 'o'],
      [0.185, { '+spine': [0.4, 0.12, 0], '+chest': [0.08, 0.35, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.95, 0, 0.15], foreR: [-0.55, 0, 0], handR: [-0.1, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.11, 0, 0] }, 'i'],
      [0.215, { '+spine': [0.36, 0.1, 0], '+chest': [0.05, 0.15, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.45, 0, 0.1], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.1, 0, 0] }, 'o'],
      [0.245, { '+spine': [0.42, 0.12, 0], '+chest': [0.08, 0.35, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.95, 0, 0.15], foreR: [-0.55, 0, 0], handR: [-0.1, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.12, 0, 0] }, 'i'],
      [0.275, { '+spine': [0.38, 0.1, 0], '+chest': [0.05, 0.15, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.45, 0, 0.1], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.11, 0, 0] }, 'o'],
      [0.31, { '+spine': [0.44, 0.12, 0], '+chest': [0.08, 0.35, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.95, 0, 0.15], foreR: [-0.55, 0, 0], handR: [-0.1, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.12, 0, 0] }, 'i'],
      [0.34, { '+spine': [0.4, 0.1, 0], '+chest': [0.05, 0.15, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.45, 0, 0.1], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.12, 0, 0] }, 'o'],
      [0.37, { '+spine': [0.46, 0.12, 0], '+chest': [0.08, 0.35, 0], armL: [-0.9, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.95, 0, 0.15], foreR: [-0.55, 0, 0], handR: [-0.1, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.13, 0, 0] }, 'i'],
      [0.43, { '+spine': [0.55, 0, 0], armL: [-0.7, 0, -0.1], foreL: [-1.2, 0, 0], armR: [-0.5, 0, 0.1], foreR: [-1.5, 0, 0], handR: [-0.4, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.9, 0, 0], '+legR': [-0.3, 0, 0], '+shinR': [0.8, 0, 0], hipsY: [-0.16, 0, 0] }, 'o'],
      [0.52, { '+spine': [0.25, 0, 0], armL: [-1.2, 0, -0.3], foreL: [-1.4, 0, 0], armR: [-0.9, 0, 0.2], foreR: [-1.4, 0, 0], handR: [-0.4, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.6, 0, 0], '+legR': [-0.1, 0, 0], '+shinR': [0.5, 0, 0], hipsY: [-0.1, 0, 0] }, 's'],
      [0.58, { '+spine': [0.05, -0.15, 0], '+chest': [0, -0.15, 0], armL: [-1.75, 0, -0.55], foreL: [-1.7, 0, 0], armR: [-1.25, 0, 0.3], foreR: [-1.6, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.05, 0, 0] }, 'o'],
      [0.65, { '+spine': [0.08, -0.15, 0], '+chest': [0.04, -0.05, 0], armL: [-1.75, 0, -0.55], foreL: [-1.7, 0, 0], armR: [-1.55, 0, 0.45], foreR: [-0.95, 0, 0], handR: [-0.2, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.05, 0, 0] }, 'i'],
      [0.68, { '+spine': [0.05, -0.15, 0], '+chest': [0, -0.15, 0], armL: [-1.75, 0, -0.55], foreL: [-1.7, 0, 0], armR: [-1.25, 0, 0.3], foreR: [-1.6, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.05, 0, 0] }, 'o'],
      [0.71, { '+spine': [0.08, -0.15, 0], '+chest': [0.04, -0.05, 0], armL: [-1.75, 0, -0.55], foreL: [-1.7, 0, 0], armR: [-1.55, 0, 0.45], foreR: [-0.95, 0, 0], handR: [-0.2, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.05, 0, 0] }, 'i'],
      [0.74, { '+spine': [0.05, -0.15, 0], '+chest': [0, -0.15, 0], armL: [-1.75, 0, -0.55], foreL: [-1.7, 0, 0], armR: [-1.25, 0, 0.3], foreR: [-1.6, 0, 0], handR: [-0.6, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.05, 0, 0] }, 'o'],
      [0.77, { '+spine': [0.1, -0.15, 0], '+chest': [0.04, -0.05, 0], armL: [-1.75, 0, -0.55], foreL: [-1.7, 0, 0], armR: [-1.6, 0, 0.45], foreR: [-0.9, 0, 0], handR: [-0.2, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [0.84, { '+spine': [0.4, 0.4, 0], '+hips': [0, 0.3, 0], armL: [-1.3, 0, -0.4], foreL: [-1.5, 0, 0], armR: [-1.0, 0, 0.2], foreR: [-1.3, 0, 0], handR: [-0.4, 0, 0], '+legL': [-0.8, 0, 0], '+shinL': [1.0, 0, 0], '+legR': [-0.4, 0, 0], '+shinR': [1.1, 0, 0], hipsY: [-0.2, 0, 0] }, 'o'],
      [0.93, { '+spine': [0.55, 0.3, 0], '+hips': [0, 0.2, 0], armL: [-0.8, 0, 0.1], foreL: [-1.0, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-1.2, 0, 0], '+legL': [-1.0, 0, 0], '+shinL': [1.4, 0, 0], '+legR': [-0.6, 0, 0], '+shinR': [1.4, 0, 0], hipsY: [-0.3, 0, 0] }, 's'],
      [1, kp({})]
    ] },
    // contra la pared: lo clava con la izquierda y le da tres puñaladas en el pecho
    execWall: { keys: [
      [0, kp({})],
      [0.13, { armL: [-1.5, 0, -0.1], foreL: [-0.35, 0, 0], armR: [-0.7, 0, 0.15], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+spine': [0.25, 0.1, 0], '+chest': [0.05, 0.2, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.06, 0, 0] }, 'o'],
      [0.21, { armL: [-1.5, 0, -0.1], foreL: [-0.35, 0, 0], armR: [-1.25, 0, 0.3], foreR: [-0.5, 0, 0], handR: [-0.15, 0, 0], '+spine': [0.32, 0.15, 0], '+chest': [0.1, 0.4, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.07, 0, 0] }, 'i'],
      [0.27, { armL: [-1.5, 0, -0.1], foreL: [-0.35, 0, 0], armR: [-0.75, 0, 0.15], foreR: [-1.6, 0, 0], handR: [-0.55, 0, 0], '+spine': [0.26, 0.1, 0], '+chest': [0.05, 0.2, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.07, 0, 0] }, 'o'],
      [0.33, { armL: [-1.5, 0, -0.1], foreL: [-0.35, 0, 0], armR: [-1.3, 0, 0.3], foreR: [-0.45, 0, 0], handR: [-0.15, 0, 0], '+spine': [0.34, 0.15, 0], '+chest': [0.1, 0.42, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.08, 0, 0] }, 'i'],
      [0.39, { armL: [-1.5, 0, -0.1], foreL: [-0.35, 0, 0], armR: [-0.75, 0, 0.15], foreR: [-1.6, 0, 0], handR: [-0.55, 0, 0], '+spine': [0.28, 0.1, 0], '+chest': [0.05, 0.2, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.45, { armL: [-1.45, 0, -0.1], foreL: [-0.4, 0, 0], armR: [-1.35, 0, 0.3], foreR: [-0.45, 0, 0], handR: [-0.15, 0, 0], '+spine': [0.36, 0.15, 0], '+chest': [0.1, 0.45, 0], '+legL': [-0.6, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.09, 0, 0] }, 'i'],
      [0.57, { armL: [-1.3, 0, -0.1], foreL: [-0.5, 0, 0], armR: [-1.15, 0, 0.35], foreR: [-0.7, 0, 0], handR: [0, 0.5, 0], '+spine': [0.35, 0.15, 0], '+chest': [0.1, 0.45, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.1, 0, 0] }, 'o'],
      [0.67, { armL: [-0.9, 0, 0.1], foreL: [-0.8, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-1.2, 0, 0], '+spine': [0.1, -0.1, 0], '+legL': [-0.1, 0, 0], '+shinL': [0.2, 0, 0], '+legR': [0.4, 0, 0], '+shinR': [0.2, 0, 0], hipsY: [-0.04, 0, 0] }, 'o'],
      [0.83, kp({ '+chest': [0, -0.3, 0] })],
      [1, kp({})]
    ] },
    // con una mesa detrás: puñalada baja, lo agarra del cuello de la camisa, otra en el pecho, lo empuja y lo
    // estampa de espaldas sobre la mesa, y dos puñaladas al cuello sujetándolo
    execTable: { keys: [
      [0, kp({})],
      [0.06, { armR: [-0.85, 0, 0.15], foreR: [-0.25, 0, 0], handR: [-0.1, 0, 0], '+spine': [0.45, 0.1, 0], '+chest': [0.05, 0.3, 0], armL: [-0.8, 0, 0.3], foreL: [-0.9, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.45, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.12, 0, 0] }, 'i'],
      [0.12, { armL: [-1.6, 0, -0.15], foreL: [-0.7, 0, 0], armR: [-0.6, 0, 0.1], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+spine': [0.3, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.18, { armL: [-1.6, 0, -0.15], foreL: [-0.7, 0, 0], armR: [-1.3, 0, 0.3], foreR: [-0.45, 0, 0], handR: [-0.2, 0, 0], '+spine': [0.35, 0.1, 0], '+chest': [0.1, 0.4, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.35, 0, 0], hipsY: [-0.09, 0, 0] }, 'i'],
      [0.28, { armL: [-1.5, 0, -0.1], foreL: [-0.5, 0, 0], armR: [-0.9, 0, 0.2], foreR: [-1.2, 0, 0], handR: [-0.4, 0, 0], '+spine': [0.4, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.5, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.08, 0, 0] }, 's'],
      [0.43, { armL: [-1.1, 0, -0.1], foreL: [-0.3, 0, 0], armR: [-1.1, 0, 0.25], foreR: [-0.6, 0, 0], handR: [-0.3, 0, 0], '+spine': [0.75, 0, 0], '+neck': [0.1, 0, 0], '+legL': [-0.8, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.55, 0, 0], '+toeR': [-0.6, 0, 0], hipsY: [-0.16, 0, 0] }, 'i'],
      [0.5, { armL: [-1.05, 0, -0.1], foreL: [-0.3, 0, 0], armR: [-1.6, 0, -0.3], foreR: [-1.8, 0, 0], handR: [-0.6, 0, 0], '+spine': [0.65, 0, 0], '+legL': [-0.75, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.5, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.15, 0, 0] }, 'o'],
      [0.55, { armL: [-1.05, 0, -0.1], foreL: [-0.3, 0, 0], armR: [-1.0, 0, 0.25], foreR: [-0.5, 0, 0], handR: [-0.1, 0, 0], '+spine': [0.72, 0, 0], '+legL': [-0.75, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.5, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.16, 0, 0] }, 'i'],
      [0.6, { armL: [-1.05, 0, -0.1], foreL: [-0.3, 0, 0], armR: [-1.6, 0, -0.3], foreR: [-1.8, 0, 0], handR: [-0.6, 0, 0], '+spine': [0.65, 0, 0], '+legL': [-0.75, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.5, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.15, 0, 0] }, 'o'],
      [0.65, { armL: [-1.05, 0, -0.1], foreL: [-0.3, 0, 0], armR: [-1.0, 0, 0.25], foreR: [-0.5, 0, 0], handR: [-0.1, 0, 0], '+spine': [0.74, 0, 0], '+legL': [-0.75, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.5, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.17, 0, 0] }, 'i'],
      [0.77, { armL: [-0.8, 0, 0.1], foreL: [-0.8, 0, 0], armR: [-0.7, 0, 0], foreR: [-1.2, 0, 0], '+spine': [0.3, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'o'],
      [0.9, kp({ '+legL': [0.1, 0, 0], '+legR': [0.35, 0, 0] })],
      [1, kp({})]
    ] },
    // en campo abierto: lo agarra del hombro, dos puñaladas y lo aparta de un empujón con las dos manos
    execShove: { keys: [
      [0, kp({})],
      [0.12, { armL: [-1.55, 0, -0.2], foreL: [-0.5, 0, 0], armR: [-0.65, 0, 0.1], foreR: [-1.75, 0, 0], handR: [-0.6, 0, 0], '+spine': [0.2, 0.1, 0], '+chest': [0, 0.15, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.25, 0, 0], hipsY: [-0.05, 0, 0] }, 'o'],
      [0.24, { armL: [-1.55, 0, -0.2], foreL: [-0.5, 0, 0], armR: [-1.35, 0, 0.35], foreR: [-0.55, 0, 0], handR: [-0.2, 0, 0], '+spine': [0.3, 0.15, 0], '+chest': [0.1, 0.4, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [0.34, { armL: [-1.55, 0, -0.2], foreL: [-0.5, 0, 0], armR: [-0.75, 0, 0.15], foreR: [-1.7, 0, 0], handR: [-0.6, 0, 0], '+spine': [0.22, 0.1, 0], '+chest': [0.05, 0.15, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'o'],
      [0.41, { armL: [-1.55, 0, -0.2], foreL: [-0.5, 0, 0], armR: [-1.5, 0, 0.35], foreR: [-0.6, 0, 0], handR: [-0.2, 0, 0], '+spine': [0.3, 0.15, 0], '+chest': [0.1, 0.42, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [0.52, { armL: [-1.3, 0, -0.1], foreL: [-1.2, 0, 0], armR: [-0.8, 0, 0.3], foreR: [-1.9, 0, 0], handR: [-0.3, 0, 0], '+spine': [0.1, 0, 0], '+chest': [0, -0.1, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], '+shinR': [0.3, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.64, { armL: [-1.55, 0, -0.05], foreL: [-0.05, 0, 0], armR: [-1.5, 0, 0.1], foreR: [-0.15, 0, 0], handR: [-0.2, 0, 0], '+spine': [0.4, 0, 0], '+chest': [0.05, 0.1, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.6, 0, 0], '+legR': [0.5, 0, 0], '+toeR': [-0.55, 0, 0], hipsY: [-0.1, 0, 0] }, 'i'],
      [0.76, { armL: [-1.2, 0, 0], foreL: [-0.3, 0, 0], armR: [-1.15, 0, 0.1], foreR: [-0.4, 0, 0], '+spine': [0.35, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.4, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [1, kp({})]
    ] },
    // remate al final del combo: lo agarra, lo dobla hacia atrás y le clava la navaja desde arriba en la
    // cabeza dos veces; luego tira de él y lo suelta a un lado
    execCombo: { keys: [
      [0, kp({ armR: [-1.6, 0.1, 0.05], foreR: [-0.3, 0, 0], '+spine': [0.2, 0, 0] })],
      [0.1, { armL: [-1.5, 0, -0.2], foreL: [-0.6, 0, 0], armR: [-0.8, 0, 0.1], foreR: [-1.5, 0, 0], handR: [-0.5, 0, 0], '+spine': [0.4, 0, 0], '+legL': [-0.55, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.2, { armL: [-1.3, 0, -0.05], foreL: [-0.2, 0, 0], armR: [-0.9, 0, 0.1], foreR: [-1.4, 0, 0], handR: [-0.5, 0, 0], '+spine': [0.5, 0, 0], '+legL': [-0.75, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.55, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.12, 0, 0] }, 's'],
      [0.27, { armL: [-1.15, 0, -0.05], foreL: [-0.15, 0, 0], armR: [-1.8, 0, -0.35], foreR: [-1.2, 0, 0], handR: [0.2, 0, 0], '+spine': [0.4, -0.1, 0], '+chest': [0, -0.2, 0], '+legL': [-0.75, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.55, 0, 0], hipsY: [-0.12, 0, 0] }, 'o'],
      [0.35, { armL: [-1.15, 0, -0.05], foreL: [-0.15, 0, 0], armR: [-2.9, 0, -0.25], foreR: [-0.9, 0, 0], handR: [0.4, 0, 0], '+spine': [0.15, -0.1, 0], '+chest': [-0.05, -0.25, 0], '+neck': [-0.15, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.65, 0, 0], '+legR': [0.5, 0, 0], hipsY: [-0.1, 0, 0] }, 's'],
      [0.39, { armL: [-1.15, 0, -0.05], foreL: [-0.2, 0, 0], armR: [-2.15, 0, 0.2], foreR: [-0.2, 0, 0], handR: [0.9, 0, 0], '+spine': [0.6, 0.1, 0], '+chest': [0.1, 0.3, 0], '+legL': [-0.8, 0, 0], '+shinL': [0.75, 0, 0], '+legR': [0.55, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.15, 0, 0] }, 'i'],
      [0.52, { armL: [-1.2, 0, 0], foreL: [-0.9, 0, 0], armR: [-1.4, 0, 0.25], foreR: [-0.9, 0, 0], handR: [0.5, 0, 0], '+spine': [0.4, 0.05, 0], '+chest': [0.05, 0.2, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.5, 0, 0], hipsY: [-0.13, 0, 0] }, 'o'],
      [0.6, { armL: [-1.2, 0, 0], foreL: [-0.9, 0, 0], armR: [-2.4, 0, -0.1], foreR: [-1.2, 0, 0], handR: [0.4, 0, 0], '+spine': [0.25, 0, 0], '+chest': [0, -0.1, 0], '+legL': [-0.7, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [0.5, 0, 0], hipsY: [-0.12, 0, 0] }, 's'],
      [0.64, { armL: [-1.2, 0, 0], foreL: [-0.9, 0, 0], armR: [-2.15, 0, 0.2], foreR: [-0.2, 0, 0], handR: [0.9, 0, 0], '+spine': [0.62, 0.1, 0], '+chest': [0.1, 0.3, 0], '+legL': [-0.8, 0, 0], '+shinL': [0.75, 0, 0], '+legR': [0.55, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.15, 0, 0] }, 'i'],
      [0.72, { armL: [-1.0, 0, 0.4], foreL: [-1.2, 0, 0], armR: [-0.9, 0, -0.2], foreR: [-1.3, 0, 0], handR: [0, 0, 0], '+spine': [0.3, 0.4, 0], '+chest': [0, 0.3, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.35, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.85, { armL: [-0.4, 0, 0.3], foreL: [-0.7, 0, 0], armR: [-0.6, 0, -0.15], foreR: [-1.0, 0, 0], '+spine': [0.15, -0.2, 0], '+chest': [0, -0.3, 0], '+legL': [-0.2, 0, 0], '+legR': [0.2, 0, 0], hipsY: [-0.04, 0, 0] }, 's'],
      [1, kp({})]
    ] },
    // lanzamiento rápido (ladrillo o botella) por encima del hombro
    throw: { keys: [
      [0, kp({})],
      [0.32, { armR: [-2.6, 0, -0.35], foreR: [-1.6, 0, 0], handR: [0.3, 0, 0], armL: [-1.2, 0, 0.25], foreL: [-0.3, 0, 0], '+chest': [0, -0.45, 0], '+spine': [-0.08, -0.15, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.2, 0, 0], '+legR': [0.15, 0, 0] }, 'o'],
      [0.46, { armR: [-1.45, 0, 0.1], foreR: [-0.2, 0, 0], handR: [-0.4, 0, 0], armL: [-0.4, 0, 0.35], foreL: [-0.7, 0, 0], '+chest': [0.08, 0.45, 0], '+spine': [0.22, 0.15, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [0.25, 0, 0], '+toeR': [-0.5, 0, 0] }, 'i'],
      [0.7, { armR: [-0.6, 0, 0.3], foreR: [-0.5, 0, 0], armL: [-0.35, 0, 0.3], foreL: [-0.8, 0, 0], '+chest': [0.05, 0.35, 0], '+spine': [0.15, 0.1, 0], '+legL': [-0.2, 0, 0], '+legR': [0.12, 0, 0] }, 'o'],
      [1, kp({})]
    ] },
    // colocar una mina: se agacha de golpe, la deja con las dos manos y aprieta (casi instantáneo)
    plant: { keys: [
      [0, {}],
      [0.38, { '+spine': [0.62, 0, 0], '+neck': [0.2, 0, 0], hipsY: [-0.32, 0, 0], '+legL': [-1.05, 0, 0], '+shinL': [1.45, 0, 0], '+footL': [-0.35, 0, 0], '+legR': [-0.5, 0, 0], '+shinR': [1.15, 0, 0], '+footR': [-0.4, 0, 0], armR: [-0.95, 0, -0.12], foreR: [-0.25, 0, 0], handR: [-0.5, 0, 0], armL: [-0.95, 0, 0.12], foreL: [-0.25, 0, 0], handL: [-0.5, 0, 0] }, 'o'],
      [0.6, { '+spine': [0.68, 0, 0], '+neck': [0.22, 0, 0], hipsY: [-0.34, 0, 0], '+legL': [-1.05, 0, 0], '+shinL': [1.45, 0, 0], '+footL': [-0.35, 0, 0], '+legR': [-0.5, 0, 0], '+shinR': [1.15, 0, 0], '+footR': [-0.4, 0, 0], armR: [-0.8, 0, -0.1], foreR: [-0.15, 0, 0], handR: [-0.7, 0, 0], armL: [-0.8, 0, 0.1], foreL: [-0.15, 0, 0], handL: [-0.7, 0, 0] }, 'l'],
      [1, {}]
    ] },
    // recoger algo del suelo o de una mesa: se agacha rápido y lo coge con la derecha
    pickup: { keys: [
      [0, {}],
      [0.45, { '+spine': [0.5, 0, 0], '+neck': [0.25, 0, 0], hipsY: [-0.24, 0, 0], '+legL': [-0.9, 0, 0], '+shinL': [1.3, 0, 0], '+footL': [-0.35, 0, 0], '+legR': [-0.35, 0, 0], '+shinR': [0.9, 0, 0], '+footR': [-0.4, 0, 0], armR: [-0.85, 0, 0.12], foreR: [-0.3, 0, 0], armL: [-0.3, 0, 0.2], foreL: [-0.6, 0, 0] }, 'o'],
      [1, {}]
    ] },
    // coger algo de una mesa o un mostrador: estira la derecha sin agacharse, de pasada
    pickupHi: { keys: [
      [0, {}],
      [0.42, { '+spine': [0.24, 0.12, 0], '+chest': [0, 0.12, 0], armR: [-1.15, 0, 0.12], foreR: [-0.35, 0, 0], handR: [-0.35, 0, 0], armL: [-0.3, 0, 0.2], foreL: [-0.6, 0, 0], '+legL': [-0.22, 0, 0], '+shinL': [0.22, 0, 0], hipsY: [-0.03, 0, 0] }, 'o'],
      [0.62, { '+spine': [0.12, 0.05, 0], armR: [-0.8, 0, 0.1], foreR: [-0.9, 0, 0], handR: [-0.2, 0, 0], armL: [-0.25, 0, 0.18], foreL: [-0.5, 0, 0] }, 's'],
      [1, {}]
    ] },
    // empujón al soltarse de un agarre: las dos manos al pecho del infectado y ¡fuera!
    shoveoff: { keys: [
      [0, { armL: [-1.3, 0, -0.25], foreL: [-1.2, 0, 0], armR: [-1.25, 0, 0.2], foreR: [-1.3, 0, 0], '+spine': [-0.12, 0, 0] }],
      [0.35, { armL: [-1.5, 0, -0.1], foreL: [-0.1, 0, 0], armR: [-1.5, 0, 0.1], foreR: [-0.15, 0, 0], '+spine': [0.3, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [0.3, 0, 0], '+toeR': [-0.5, 0, 0], hipsY: [-0.04, 0, 0] }, 'i'],
      [1, kp({})]
    ] }
  };

  // El infectado durante los remates: los mismos tiempos que los de ella (KP); la clave t = 1 de execWall y
  // execTable es la pose en la que se queda el cadáver
  const DAZE = { armL: [-1.12, 0, -0.38], foreL: [-2.15, 0, 0], armR: [-1.08, 0, 0.38], foreR: [-2.1, 0, 0], '+spine': [0.3, 0, 0], '+neck': [0.2, 0, 0], hipsY: [-0.06, 0, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.35, 0, 0], '+legR': [-0.15, 0, 0], '+shinR': [0.3, 0, 0] };
  const KZ = {
    // ensartado a la carrera: se encoge con los brazos arriba, le agarra los hombros, la cabeza se va atrás al
    // abrirlo de lado y sale despedido de espaldas
    runKill: { keys: [
      [0, { armL: [-1.3, 0, 0.3], armR: [-1.25, 0, -0.3], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], '+spine': [0.35, 0, 0], '+neck': [-0.25, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.3, 0, 0] }],
      [0.25, { armL: [-1.4, 0, 0.2], armR: [-1.35, 0, -0.2], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], '+spine': [0.35, 0, 0], '+neck': [-0.25, 0, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [0.2, 0, 0], '+shinR': [0.2, 0, 0] }],
      [0.29, { armL: [-1.6, 0, 0.55], armR: [-1.55, 0, -0.55], foreL: [-1.25, 0, 0], foreR: [-1.25, 0, 0], '+spine': [0.3, 0, 0], '+neck': [-0.2, 0, 0], hipsY: [-0.06, 0, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.35, 0, 0], '+legR': [0.2, 0, 0], '+shinR': [0.2, 0, 0] }, 'i'],
      [0.43, { armL: [-1.5, 0, 0.45], armR: [-1.45, 0, -0.45], foreL: [-1.2, 0, 0], foreR: [-1.2, 0, 0], '+spine': [0.25, 0, 0], '+neck': [-0.3, 0, 0], hipsY: [-0.06, 0, 0], '+legL': [-0.15, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [0.15, 0, 0], '+shinR': [0.2, 0, 0] }, 'o'],
      [0.62, { armL: [-1.0, 0, 0.8], armR: [-1.2, 0, -0.5], foreL: [-0.6, 0, 0], foreR: [-0.8, 0, 0], '+spine': [-0.05, 0, 0.1], '+neck': [-0.55, 0.3, 0.3], '+head': [-0.3, 0, 0], hipsY: [-0.05, 0, 0], '+legL': [0.1, 0, 0], '+legR': [-0.1, 0, 0] }, 'i'],
      [0.8, { armL: [-0.7, 0, 0.9], armR: [-0.8, 0, -0.8], foreL: [-0.4, 0, 0], foreR: [-0.5, 0, 0], '+spine': [-0.15, 0, 0.1], '+neck': [-0.3, 0.2, 0.4], hipsY: [-0.06, 0, 0], '+legL': [0.2, 0, 0], '+legR': [-0.1, 0, 0] }, 'o'],
      [1, { armL: [-0.3, 0, 0.8], armR: [-0.4, 0, -0.8], '+spine': [-0.35, 0, 0], '+neck': [-0.4, 0, 0], '+legL': [0.4, 0, 0], '+legR': [-0.2, 0, 0] }, 'i']
    ] },
    // remate en carrera: el tajo le echa la cabeza atrás, se dobla con cada puñalada en el vientre, se le echa
    // encima, la cabeza queda atrapada bajo su brazo (brazos tiesos) y cae arrastrado
    execRun: { keys: [
      [0, DAZE],
      [0.093, { '+neck': [-0.6, 0, 0], '+head': [-0.3, 0, 0], '+spine': [-0.2, 0, 0], armL: [-0.8, 0, 0.9], armR: [-0.9, 0, -0.9], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0], hipsY: [-0.02, 0, 0], '+legL': [0.2, 0, 0], '+legR': [-0.1, 0, 0] }, 'i'],
      [0.15, { armL: [-1.4, 0, 0.2], foreL: [-1.0, 0, 0], armR: [-0.7, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.35, 0, 0], '+neck': [-0.1, 0, 0], hipsY: [-0.04, 0, 0] }, 'o'],
      [0.185, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.62, 0, 0], '+neck': [0.2, 0, 0.1], hipsY: [-0.08, 0, 0] }, 'i'],
      [0.215, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.5, 0, 0], '+neck': [0.05, 0, 0], hipsY: [-0.06, 0, 0] }, 'o'],
      [0.245, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.64, 0, 0], '+neck': [0.22, 0, 0.1], hipsY: [-0.08, 0, 0] }, 'i'],
      [0.275, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.52, 0, 0], '+neck': [0.06, 0, 0], hipsY: [-0.07, 0, 0] }, 'o'],
      [0.31, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.66, 0, 0], '+neck': [0.24, 0, 0.1], hipsY: [-0.09, 0, 0] }, 'i'],
      [0.34, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.55, 0, 0], '+neck': [0.08, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.37, { armL: [-1.5, 0, -0.2], foreL: [-1.1, 0, 0], armR: [-0.6, 0, -0.1], foreR: [-0.4, 0, 0], '+spine': [0.68, 0, 0], '+neck': [0.26, 0, 0.1], hipsY: [-0.1, 0, 0] }, 'i'],
      [0.43, { armL: [-1.2, 0, -0.4], foreL: [-1.3, 0, 0], armR: [-1.0, 0, 0.2], foreR: [-1.0, 0, 0], '+spine': [0.75, 0, 0], '+neck': [0.3, 0, 0], hipsY: [-0.1, 0, 0] }, 'o'],
      [0.52, { armL: [-1.3, 0, -0.1], foreL: [-1.0, 0, 0], armR: [-1.2, 0, 0.1], foreR: [-0.9, 0, 0], '+spine': [0.3, 0, 0], '+neck': [-0.1, 0, 0], hipsY: [-0.06, 0, 0] }, 's'],
      [0.58, { '+neck': [0.2, 0.5, 0.45], '+head': [0.1, 0, 0.2], '+spine': [0.1, 0, 0.25], armL: [-1.05, 0, 0.85], foreL: [-0.6, 0, 0], armR: [-0.95, 0, -0.85], foreR: [-0.6, 0, 0], hipsY: [-0.06, 0, 0] }, 'o'],
      [0.65, { '+neck': [0.25, 0.5, 0.5], '+head': [0.1, 0, 0.2], '+spine': [0, 0, 0.3], armL: [-1.15, 0, 0.95], foreL: [-0.55, 0, 0], armR: [-1.05, 0, -0.95], foreR: [-0.55, 0, 0], hipsY: [-0.07, 0, 0] }, 'i'],
      [0.68, { '+neck': [0.2, 0.5, 0.45], '+head': [0.1, 0, 0.2], '+spine': [0.12, 0, 0.25], armL: [-1.0, 0, 0.8], foreL: [-0.65, 0, 0], armR: [-0.9, 0, -0.8], foreR: [-0.65, 0, 0], hipsY: [-0.07, 0, 0] }, 'o'],
      [0.71, { '+neck': [0.25, 0.5, 0.5], '+head': [0.1, 0, 0.2], '+spine': [0, 0, 0.3], armL: [-1.15, 0, 0.95], foreL: [-0.55, 0, 0], armR: [-1.05, 0, -0.95], foreR: [-0.55, 0, 0], hipsY: [-0.08, 0, 0] }, 'i'],
      [0.74, { '+neck': [0.2, 0.5, 0.45], '+head': [0.1, 0, 0.2], '+spine': [0.12, 0, 0.25], armL: [-1.0, 0, 0.8], foreL: [-0.65, 0, 0], armR: [-0.9, 0, -0.8], foreR: [-0.65, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.77, { '+neck': [0.3, 0.5, 0.5], '+head': [0.15, 0, 0.2], '+spine': [0.05, 0, 0.3], armL: [-1.1, 0, 1.0], foreL: [-0.5, 0, 0], armR: [-1.0, 0, -1.0], foreR: [-0.5, 0, 0], hipsY: [-0.1, 0, 0] }, 'i'],
      [0.84, { '+neck': [0.4, 0.4, 0.4], '+spine': [0.6, 0, 0.3], armL: [-0.8, 0, 0.7], armR: [-0.7, 0, -0.6], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], hipsY: [-0.3, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [1.0, 0, 0], '+legR': [-0.3, 0, 0], '+shinR': [0.9, 0, 0] }, 'o'],
      [1, { '+neck': [0.4, 0.4, 0.4], '+spine': [0.7, 0, 0.3], armL: [-0.6, 0, 0.6], armR: [-0.5, 0, -0.5], hipsY: [-0.35, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [1.1, 0, 0], '+legR': [-0.4, 0, 0], '+shinR': [1.0, 0, 0] }, 's']
    ] },
    // contra la pared: queda clavado de espaldas, un brazo contra la pared y el otro buscándola; con cada
    // puñalada se dobla, y al final se desliza hasta quedar sentado contra la pared (pose de cadáver: t = 1)
    execWall: { keys: [
      [0, DAZE],
      [0.13, { '+spine': [-0.15, 0, 0], '+neck': [-0.25, 0, 0], '+head': [-0.1, 0, 0], armL: [-0.6, 0, 0.6], foreL: [-0.5, 0, 0], armR: [-1.2, 0, -0.2], foreR: [-0.9, 0, 0], hipsY: [-0.04, 0, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.3, 0, 0] }, 'o'],
      [0.21, { '+spine': [0.15, 0, 0], '+neck': [0.25, 0, 0.1], armL: [-0.4, 0, 0.75], foreL: [-0.4, 0, 0], armR: [-1.4, 0, -0.1], foreR: [-1.2, 0, 0], hipsY: [-0.08, 0, 0], '+legL': [-0.25, 0, 0], '+shinL': [0.35, 0, 0] }, 'i'],
      [0.27, { '+spine': [-0.05, 0, 0], '+neck': [0, 0, 0], armL: [-0.5, 0, 0.7], foreL: [-0.45, 0, 0], armR: [-1.3, 0, -0.15], foreR: [-1.0, 0, 0], hipsY: [-0.06, 0, 0], '+legL': [-0.25, 0, 0], '+shinL': [0.35, 0, 0] }, 'o'],
      [0.33, { '+spine': [0.18, 0, 0], '+neck': [0.28, 0, 0.12], armL: [-0.35, 0, 0.8], foreL: [-0.4, 0, 0], armR: [-1.45, 0, -0.1], foreR: [-1.25, 0, 0], hipsY: [-0.09, 0, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.4, 0, 0] }, 'i'],
      [0.39, { '+spine': [0.0, 0, 0], '+neck': [0.05, 0, 0], armL: [-0.45, 0, 0.75], foreL: [-0.45, 0, 0], armR: [-1.25, 0, -0.2], foreR: [-0.9, 0, 0], hipsY: [-0.08, 0, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.4, 0, 0] }, 'o'],
      [0.45, { '+spine': [0.2, 0, 0], '+neck': [0.32, 0, 0.15], armL: [-0.3, 0, 0.8], foreL: [-0.35, 0, 0], armR: [-1.0, 0, -0.3], foreR: [-0.8, 0, 0], hipsY: [-0.11, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.35, 0, 0] }, 'i'],
      [0.57, { '+spine': [0.25, 0, 0], '+neck': [0.45, 0, 0.2], '+head': [0.2, 0, 0], armL: [-0.2, 0, 0.5], foreL: [-0.3, 0, 0], armR: [-0.6, 0, -0.3], foreR: [-0.5, 0, 0], hipsY: [-0.15, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.7, 0, 0], '+legR': [-0.35, 0, 0], '+shinR': [0.65, 0, 0] }, 'o'],
      [1, { '+spine': [0.2, 0, 0.1], '+neck': [0.6, 0.2, 0.3], '+head': [0.3, 0, 0], armL: [-0.1, 0, 0.3], foreL: [-0.3, 0, 0], armR: [-0.15, 0, -0.35], foreR: [-0.3, 0, 0], hipsY: [-0.55, 0, 0], '+legL': [-1.5, 0, 0.2], '+shinL': [1.2, 0, 0], '+legR': [-1.4, 0, -0.2], '+shinR': [1.1, 0, 0] }, 's']
    ] },
    // contra la mesa: se dobla con la puñalada baja, la busca con las manos, sale empujado hacia atrás y queda
    // tumbado de espaldas sobre la mesa con los brazos abiertos (pose de cadáver: t = 1)
    execTable: { keys: [
      [0, DAZE],
      [0.06, { '+spine': [0.5, 0, 0], '+neck': [0.1, 0, 0], armL: [-1.2, 0, 0.3], armR: [-1.1, 0, -0.3], foreL: [-1.0, 0, 0], foreR: [-1.0, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [0.12, { '+spine': [0.3, 0, 0], '+neck': [-0.2, 0, 0], armL: [-1.5, 0, -0.1], armR: [-1.45, 0, 0.1], foreL: [-0.7, 0, 0], foreR: [-0.7, 0, 0], hipsY: [-0.04, 0, 0] }, 'o'],
      [0.18, { '+spine': [0.42, 0, 0], '+neck': [0.1, 0, 0], armL: [-1.5, 0, -0.1], armR: [-1.45, 0, 0.1], foreL: [-0.8, 0, 0], foreR: [-0.8, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [0.28, { '+spine': [-0.3, 0, 0], '+neck': [-0.3, 0, 0], armL: [-1.0, 0, 0.6], armR: [-1.0, 0, -0.6], foreL: [-0.6, 0, 0], foreR: [-0.6, 0, 0], hipsY: [-0.05, 0, 0], '+legL': [0.3, 0, 0], '+legR': [-0.1, 0, 0] }, 's'],
      [0.43, { '+spine': [-1.1, 0, 0], '+neck': [-0.3, 0, 0], '+head': [-0.2, 0, 0], armL: [-0.2, 0, 1.2], armR: [-0.3, 0, -1.2], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], hipsY: [-0.12, 0, 0], '+legL': [-0.25, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [-0.25, 0, 0], '+shinR': [0.3, 0, 0] }, 'i'],
      [0.5, { '+spine': [-1.05, 0, 0], '+neck': [-0.2, 0.2, 0], '+head': [-0.1, 0, 0], armL: [-0.6, 0, 1.0], armR: [-0.7, 0, -1.0], foreL: [-0.8, 0, 0], foreR: [-0.8, 0, 0], hipsY: [-0.12, 0, 0], '+legL': [-0.25, 0, 0], '+shinL': [0.3, 0, 0], '+legR': [-0.25, 0, 0], '+shinR': [0.3, 0, 0] }, 'o'],
      [0.55, { '+spine': [-1.15, 0, 0], '+neck': [-0.5, 0.2, 0.2], '+head': [-0.2, 0, 0], armL: [-0.1, 0, 1.4], armR: [-0.2, 0, -1.3], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], hipsY: [-0.13, 0, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.35, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.3, 0, 0] }, 'i'],
      [0.6, { '+spine': [-1.1, 0, 0], '+neck': [-0.3, 0.2, 0.1], '+head': [-0.15, 0, 0], armL: [-0.5, 0, 1.1], armR: [-0.6, 0, -1.1], foreL: [-0.7, 0, 0], foreR: [-0.7, 0, 0], hipsY: [-0.13, 0, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.35, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.3, 0, 0] }, 'o'],
      [0.65, { '+spine': [-1.2, 0, 0], '+neck': [-0.5, 0.3, 0.2], '+head': [-0.2, 0, 0], armL: [-0.1, 0, 1.35], armR: [-0.1, 0, -1.2], foreL: [-0.25, 0, 0], foreR: [-0.35, 0, 0], hipsY: [-0.14, 0, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.35, 0, 0] }, 'i'],
      [1, { '+spine': [-1.25, 0, 0], '+neck': [-0.5, 0.4, 0], '+head': [-0.2, 0, 0], armL: [-0.1, 0, 1.3], armR: [0, 0, -1.1], foreL: [-0.2, 0, 0], foreR: [-0.4, 0, 0], hipsY: [-0.14, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.35, 0, 0] }, 's']
    ] },
    // empujón: lo agarran, se dobla con cada puñalada y sale despedido de espaldas
    execShove: { keys: [
      [0, DAZE],
      [0.12, { '+spine': [0.1, 0, 0], '+neck': [-0.2, 0, 0], armL: [-1.2, 0, 0.3], armR: [-1.3, 0, -0.1], foreL: [-1.0, 0, 0], foreR: [-0.9, 0, 0], hipsY: [-0.03, 0, 0] }, 'o'],
      [0.24, { '+spine': [0.35, 0, 0], '+neck': [0.3, 0, 0.15], armL: [-0.9, 0, 0.6], armR: [-1.6, 0, -0.2], foreL: [-0.8, 0, 0], foreR: [-1.3, 0, 0], hipsY: [-0.06, 0, 0] }, 'i'],
      [0.34, { '+spine': [0.2, 0, 0], '+neck': [0.05, 0, 0], armL: [-1.0, 0, 0.5], armR: [-1.5, 0, -0.15], foreL: [-0.9, 0, 0], foreR: [-1.2, 0, 0], hipsY: [-0.05, 0, 0] }, 'o'],
      [0.41, { '+spine': [0.38, 0, 0], '+neck': [0.35, 0, 0.2], armL: [-0.8, 0, 0.65], armR: [-1.5, 0, -0.25], foreL: [-0.7, 0, 0], foreR: [-1.3, 0, 0], hipsY: [-0.07, 0, 0] }, 'i'],
      [0.52, { '+spine': [0.3, 0, 0], '+neck': [0.2, 0, 0.1], armL: [-0.6, 0, 0.5], armR: [-0.7, 0, -0.4], foreL: [-0.6, 0, 0], foreR: [-0.6, 0, 0], hipsY: [-0.08, 0, 0] }, 'o'],
      [0.64, { '+spine': [-0.4, 0, 0], '+neck': [-0.5, 0, 0], '+head': [-0.2, 0, 0], armL: [-1.2, 0, 0.9], armR: [-1.3, 0, -0.9], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], hipsY: [-0.04, 0, 0], '+legL': [0.4, 0, 0], '+legR': [-0.3, 0, 0] }, 'i'],
      [1, { '+spine': [-0.5, 0, 0], '+neck': [-0.5, 0, 0], armL: [-1.0, 0, 1.0], armR: [-1.1, 0, -1.0], '+legL': [0.5, 0, 0], '+legR': [-0.3, 0, 0] }, 'o']
    ] },
    // remate del combo: lo doblan hacia atrás, forcejea agarrándole el brazo, cada puñalada en la cabeza le
    // abre los brazos de golpe y al final cuelga flojo
    execCombo: { keys: [
      [0, { '+spine': [0.3, 0, 0], '+neck': [0.2, 0, 0], armL: [-1.2, 0, 0.2], armR: [-1.2, 0, -0.2], foreL: [-0.6, 0, 0], foreR: [-0.6, 0, 0] }],
      [0.1, { '+spine': [0.2, 0, 0], '+neck': [-0.1, 0, 0], armL: [-1.4, 0, 0.2], armR: [-1.4, 0, -0.2], foreL: [-0.8, 0, 0], foreR: [-0.8, 0, 0], hipsY: [-0.03, 0, 0] }, 'o'],
      [0.2, { '+spine': [-0.8, 0, 0], '+neck': [-0.25, 0, 0], armL: [-0.6, 0, 0.9], armR: [-0.7, 0, -0.9], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0], hipsY: [-0.12, 0, 0], '+legL': [-0.3, 0, 0], '+shinL': [0.6, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.5, 0, 0] }, 's'],
      [0.3, { '+spine': [-0.82, 0, 0], '+neck': [-0.15, 0, 0], armL: [-0.85, 0, 0.75], armR: [-0.8, 0, -0.8], foreL: [-1.5, 0, 0], foreR: [-0.6, 0, 0], hipsY: [-0.2, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.85, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.5, 0, 0] }, 's'],
      [0.35, { '+spine': [-0.85, 0, 0], '+neck': [-0.25, 0, 0], armL: [-0.95, 0, 0.7], armR: [-0.9, 0, -0.7], foreL: [-1.5, 0, 0], foreR: [-0.7, 0, 0], hipsY: [-0.2, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.85, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.5, 0, 0] }, 's'],
      [0.39, { '+spine': [-0.9, 0, 0], '+neck': [0.35, 0, 0.2], '+head': [0.2, 0, 0], armL: [-0.4, 0, 1.1], armR: [-0.5, 0, -1.0], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], hipsY: [-0.22, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.9, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.55, 0, 0] }, 'i'],
      [0.52, { '+spine': [-0.75, 0, 0], '+neck': [0.25, 0, 0.15], '+head': [0.1, 0, 0], armL: [-0.55, 0, 1.0], armR: [-0.9, 0, -0.8], foreL: [-1.0, 0, 0], foreR: [-0.9, 0, 0], hipsY: [-0.22, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.9, 0, 0], '+legR': [0.3, 0, 0], '+shinR': [0.55, 0, 0] }, 'o'],
      [0.64, { '+spine': [-0.85, 0, 0], '+neck': [0.45, 0, 0.25], '+head': [0.2, 0, 0], armL: [-0.3, 0, 1.2], armR: [-0.35, 0, -1.2], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], hipsY: [-0.24, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.95, 0, 0], '+legR': [0.25, 0, 0], '+shinR': [0.6, 0, 0] }, 'i'],
      [0.72, { '+spine': [0.4, 0, 0], '+neck': [0.6, 0, 0], armL: [-0.3, 0, 0.3], armR: [-0.3, 0, -0.3], foreL: [-0.2, 0, 0], foreR: [-0.2, 0, 0], hipsY: [-0.2, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.8, 0, 0], '+legR': [-0.3, 0, 0], '+shinR': [0.7, 0, 0] }, 'o'],
      [1, { '+spine': [0.5, 0, 0], '+neck': [0.6, 0, 0], armL: [-0.2, 0, 0.2], armR: [-0.2, 0, -0.2], hipsY: [-0.3, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [1.0, 0, 0], '+legR': [-0.4, 0, 0], '+shinR': [0.9, 0, 0] }, 's']
    ] },
    // golpe con arma: levanta la cabeza aturdido y el golpe se la hunde, se le doblan las piernas
    execHeavy: { keys: [
      [0, DAZE],
      [0.3, { armL: [-1.0, 0, -0.1], foreL: [-1.5, 0, 0], armR: [-0.9, 0, 0.1], foreR: [-1.4, 0, 0], '+spine': [0.15, 0, 0], '+neck': [-0.25, 0, 0], '+head': [-0.1, 0, 0], hipsY: [-0.06, 0, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.35, 0, 0], '+legR': [-0.15, 0, 0], '+shinR': [0.3, 0, 0] }, 'o'],
      [0.43, { armL: [-0.4, 0, 0.45], foreL: [-0.5, 0, 0], armR: [-0.4, 0, -0.45], foreR: [-0.5, 0, 0], '+spine': [0.4, 0, 0], '+neck': [0.55, 0, 0], '+head': [0.3, 0, 0], hipsY: [-0.18, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.8, 0, 0], '+legR': [-0.3, 0, 0], '+shinR': [0.7, 0, 0] }, 'i'],
      [1, { armL: [-0.3, 0, 0.5], foreL: [-0.4, 0, 0], armR: [-0.3, 0, -0.5], foreR: [-0.4, 0, 0], '+spine': [0.5, 0, 0], '+neck': [0.6, 0, 0], '+head': [0.3, 0, 0], hipsY: [-0.26, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [1.0, 0, 0], '+legR': [-0.4, 0, 0], '+shinR': [0.9, 0, 0] }, 'o']
    ] }
  };

  // Forcejeo: un infectado te tiene agarrada; empujas con los antebrazos contra su pecho y su cuello,
  // la cabeza apartada, temblando. prog: cuánto te falta para soltarte (0 a 1)
  // En las manos del hongomorfo: agarrada de la cabeza y en el aire, se aferra a sus brazos y patalea; al final
  // queda colgando, sin fuerza
  function bossKillPose(h, bk, time) {
    const u = bk.t, e = U.smooth(c01(u / 0.08)), limp = U.smooth(c01((u - 0.8) / 0.05));
    const fr = u > 0.42 ? 1.6 : 1, k1 = sin(time * 13 * fr), k2 = sin(time * 11 * fr + 1.3), sh = sin(time * 27) * 0.06;
    const L = (b, x, y, z) => { const r = h[b].rotation; r.x = U.lerp(r.x, x, e); r.y = U.lerp(r.y, y, e); r.z = U.lerp(r.z, z, e); };
    L('armL', U.lerp(-2.05 + sh, -0.25, limp), 0, U.lerp(-0.35, 0.3, limp)); L('foreL', U.lerp(-1.15, -0.15, limp), 0, 0);
    L('armR', U.lerp(-1.95 - sh, -0.25, limp), 0, U.lerp(0.35, -0.3, limp)); L('foreR', U.lerp(-1.2, -0.15, limp), 0, 0);
    L('legL', U.lerp(-0.25 + 0.45 * k1, 0.08, limp), 0, 0.05); L('shinL', U.lerp(0.45 + 0.4 * Math.max(0, k2), 0.15, limp), 0, 0);
    L('legR', U.lerp(-0.2 - 0.45 * k1, 0.02, limp), 0, -0.05); L('shinR', U.lerp(0.45 + 0.4 * Math.max(0, -k2), 0.2, limp), 0, 0);
    L('footL', 0.5, 0, 0); L('footR', 0.5, 0, 0);
    h.spine.rotation.x = U.lerp(-0.28 + sh, 0.3, limp) * e; h.spine.rotation.z = 0.08 * k1 * (1 - limp) * e;
    h.neck.rotation.x = U.lerp(-0.55, 0.65, limp) * e; h.head.rotation.x = U.lerp(-0.3, 0.45, limp) * e;
    h.neck.rotation.z = (0.12 * k2 * (1 - limp) + 0.3 * limp) * e;
  }

  function strugglePose(h, st, time) {
    const g = st.prog || 0, sh = sin(time * 31) * 0.05, sh2 = sin(time * 23 + 1) * 0.04;
    const e = U.smooth(c01(st.t / 0.18));
    const L = (b, x, y, z) => { const r = h[b].rotation; r.x = U.lerp(r.x, x, e); r.y = U.lerp(r.y, y, e); r.z = U.lerp(r.z, z, e); };
    L('armL', -1.35 - 0.15 * g + sh, 0, -0.25); L('foreL', -1.2 + 0.7 * g, 0, 0);
    L('armR', -1.25 - 0.15 * g + sh2, 0, 0.22); L('foreR', -1.3 + 0.75 * g, 0, 0);
    h.spine.rotation.x += (-0.18 + 0.32 * g) * e; h.spine.rotation.z += sh * 0.6 * e;
    h.neck.rotation.y += 0.45 * e; h.neck.rotation.x -= 0.25 * e; h.head.rotation.z += 0.15 * e;
    h.hips.position.y -= 0.07 * e;
    h.legL.rotation.x += -0.4 * e; h.shinL.rotation.x += 0.4 * e;
    h.legR.rotation.x += 0.45 * e; h.shinR.rotation.x += 0.3 * e; h.toeR.rotation.x -= 0.5 * e;
  }

  // Ataques: t de 0 a 1, el golpe ocurre hacia t = 0.45.
  // Preparación rápida, golpe que acelera hasta el impacto y recuperación suave.
  function action(h, kind, t, two, s) {
    if (KP[kind]) { keyPose(h, KP[kind], t); return; }
    if (kind === 'execHeavy') kind = 'overhead';
    const wind = easeOut(t / 0.3);
    const hit = easeIn((t - 0.28) / 0.17);
    const back = U.smooth((t - 0.6) / 0.4);
    if (kind === 'swing2') {
      // golpe horizontal: giro de cadera y torso, con paso adelante
      const tw = -1.15 * wind + 2.15 * hit - 1.0 * back;
      h.hips.rotation.y = tw * 0.25;
      h.spine.rotation.y = tw * 0.35;
      h.chest.rotation.y = tw * 0.45;
      h.spine.rotation.x = 0.08 + 0.1 * hit * (1 - back);
      h.armR.rotation.x = -1.2 - 0.15 * wind * (1 - hit); h.armR.rotation.z = -0.3 + 0.25 * hit;
      h.foreR.rotation.x = -0.45 + 0.15 * hit;
      if (two) { h.armL.rotation.x = -1.15; h.armL.rotation.z = -0.6; h.foreL.rotation.x = -0.55; }
      else { h.armL.rotation.x = 0.3 * hit; h.armL.rotation.z = 0.35 * hit; }
      h.legL.rotation.x += -0.3 * hit * (1 - back);
      h.legR.rotation.x += 0.22 * hit * (1 - back);
      h.shinR.rotation.x += 0.2 * hit * (1 - back);
      h.toeR.rotation.x = -0.45 * hit * (1 - back);
      h.clavR.rotation.z = -0.22 * wind * (1 - hit); h.clavR.rotation.y = 0.25 * hit * (1 - back);
      if (two) h.clavL.rotation.y = -0.3 * hit * (1 - back);
    } else if (kind === 'swing1' || kind === 'floor') {
      // golpe de arriba abajo (o al suelo)
      const low = kind === 'floor';
      const up = -2.6 * wind;
      const down = (low ? 2.2 : 1.6) * hit;
      h.armR.rotation.x = -0.4 + up + down + 0.6 * back;
      h.armR.rotation.z = -0.3 * wind * (1 - hit);
      h.foreR.rotation.x = -0.95 * wind + 0.65 * hit;
      h.handR.rotation.x = 0.85 * hit * (1 - back * 0.6);
      h.spine.rotation.x = (low ? 0.55 : 0.14) * hit * (1 - back * 0.7) - 0.08 * wind * (1 - hit);
      h.chest.rotation.y = -0.4 * wind + 0.65 * hit * (1 - back);
      h.hips.rotation.y = -0.15 * wind + 0.25 * hit * (1 - back);
      if (two) { h.armL.rotation.x = h.armR.rotation.x; h.armL.rotation.z = -0.45; h.foreL.rotation.x = h.foreR.rotation.x - 0.3; }
      else { h.armL.rotation.x = -0.3 * wind + 0.4 * hit; h.armL.rotation.z = 0.2; }
      if (low) { h.legL.rotation.x = -0.5 * hit; h.shinL.rotation.x = 0.6 * hit; h.legR.rotation.x = 0.2 * hit; }
      else { h.legL.rotation.x += -0.2 * hit * (1 - back); }
    } else if (kind === 'swing2b') {
      // revés horizontal: el arma vuelve de izquierda a derecha cruzando el cuerpo
      const tw = 1.0 * wind - 2.0 * hit + 1.0 * back;
      h.hips.rotation.y = tw * 0.22;
      h.spine.rotation.y = tw * 0.35;
      h.chest.rotation.y = tw * 0.45;
      h.spine.rotation.x = 0.1 + 0.08 * hit * (1 - back);
      h.armR.rotation.x = -1.02 + 0.1 * hit; h.armR.rotation.z = 0.45 * wind * (1 - hit) - 0.55 * hit * (1 - back);
      h.foreR.rotation.x = -1.15 * wind * (1 - hit) - 0.35 * hit - 0.4 * back;
      h.handR.rotation.z = -0.4 * hit * (1 - back);
      if (two) { h.armL.rotation.x = -1.2; h.armL.rotation.z = -0.3; h.foreL.rotation.x = -0.7; }
      else { h.armL.rotation.x = -0.2 * wind; h.armL.rotation.z = 0.3 + 0.25 * hit; }
      h.clavR.rotation.y = 0.3 * wind * (1 - hit); h.clavR.rotation.z = -0.15 * hit * (1 - back);
      h.legR.rotation.x += -0.28 * hit * (1 - back); h.shinR.rotation.x += 0.15 * hit * (1 - back);
      h.legL.rotation.x += 0.18 * hit * (1 - back);
      h.toeL.rotation.x = -0.4 * hit * (1 - back);
    } else if (kind === 'swing1b') {
      // revés en diagonal hacia abajo, a una mano
      const tw = 0.9 * wind - 1.7 * hit + 0.8 * back;
      h.chest.rotation.y = tw * 0.5; h.spine.rotation.y = tw * 0.3; h.hips.rotation.y = tw * 0.18;
      h.armR.rotation.x = -1.9 * wind * (1 - hit) - 0.7 * hit - 0.2 * back;
      h.armR.rotation.z = 0.55 * wind * (1 - hit) - 0.45 * hit * (1 - back);
      h.foreR.rotation.x = -1.2 * wind * (1 - hit) - 0.25 * hit;
      h.handR.rotation.x = 0.6 * hit * (1 - back);
      h.spine.rotation.x = 0.06 + 0.16 * hit * (1 - back);
      h.armL.rotation.x = -0.35 * wind + 0.25 * hit; h.armL.rotation.z = 0.25;
      h.legR.rotation.x += -0.22 * hit * (1 - back);
    } else if (kind === 'overhead') {
      // golpe fuerte: levanta el arma por encima de la cabeza y la descarga con todo el cuerpo
      const wind2 = easeOut(t / 0.36);
      const hit2 = easeIn((t - 0.34) / 0.13);
      const up = wind2 * (1 - hit2), f = hit2 * (1 - back);
      h.armR.rotation.x = -0.6 - 2.35 * up - 0.15 * f + 0.3 * back; h.armR.rotation.z = -0.15 * up;
      h.foreR.rotation.x = -1.2 * up - 0.25 * f - 0.4 * back;
      h.handR.rotation.x = -0.4 * up + 0.9 * f;
      h.armL.rotation.x = h.armR.rotation.x; h.armL.rotation.z = -0.4; h.foreL.rotation.x = h.foreR.rotation.x - 0.3;
      h.spine.rotation.x = -0.2 * up + 0.5 * f + 0.1 * back;
      h.neck.rotation.x = 0.15 * up - 0.2 * f;
      h.clavL.rotation.z = 0.2 * up; h.clavR.rotation.z = -0.2 * up;
      h.clavL.rotation.y = -0.2 * f; h.clavR.rotation.y = 0.2 * f;
      h.hips.position.y -= 0.07 * f;
      h.legL.rotation.x += -0.55 * f - 0.15 * up; h.shinL.rotation.x += 0.45 * f;
      h.legR.rotation.x += 0.35 * f; h.shinR.rotation.x += 0.3 * f; h.toeR.rotation.x = -0.55 * f;
    } else if (kind === 'slash') {
      // tajo de revés con el cuchillo
      const tw = 0.8 * wind - 1.6 * hit + 0.8 * back;
      h.chest.rotation.y = tw * 0.5; h.spine.rotation.y = tw * 0.3;
      h.armR.rotation.x = -1.3 + 0.1 * hit; h.armR.rotation.z = 0.65 * wind * (1 - hit) - 0.7 * hit * (1 - back);
      h.foreR.rotation.x = -1.4 * wind * (1 - hit) - 0.2 * hit - 0.5 * back;
      h.handR.rotation.y = 0.5 * wind * (1 - hit) - 0.6 * hit * (1 - back);
      h.armL.rotation.x = -0.6; h.foreL.rotation.x = -1.2; h.armL.rotation.z = 0.2;
      h.spine.rotation.x = 0.12 + 0.1 * hit * (1 - back);
      h.legL.rotation.x += -0.2 * hit * (1 - back);
    } else if (kind === 'stab') {
      h.armR.rotation.x = -0.3 * (1 - hit) - 1.45 * hit * (1 - back) - 0.3 * back;
      h.foreR.rotation.x = -1.7 * wind * (1 - hit) - 0.15 * hit;
      h.handR.rotation.x = 0.75 * hit * (1 - back);
      h.chest.rotation.y = -0.35 * wind + 0.5 * hit * (1 - back);
      h.spine.rotation.x = 0.18 * hit * (1 - back);
      h.legL.rotation.x += -0.25 * hit * (1 - back);
      if (two) { h.armL.rotation.x = h.armR.rotation.x + 0.1; h.armL.rotation.z = -0.4; h.foreL.rotation.x = h.foreR.rotation.x; }
    } else if (kind === 'thrust') {
      const f = hit * (1 - back);
      h.armR.rotation.x = -1.2 - 0.35 * f + 0.2 * wind * (1 - hit); h.armR.rotation.z = -0.1;
      h.foreR.rotation.x = -0.9 * (1 - f) - 0.1;
      h.armL.rotation.x = -1.1 - 0.4 * f; h.armL.rotation.z = -0.45;
      h.foreL.rotation.x = -0.9 * (1 - f) - 0.2;
      h.spine.rotation.x = 0.22 * f - 0.08 * wind * (1 - hit);
      h.legL.rotation.x = -0.55 * f; h.legR.rotation.x = 0.35 * f;
    } else if (kind === 'shove') {
      const f = hit * (1 - back);
      for (const A of ['L', 'R']) {
        h['arm' + A].rotation.x = -0.6 - 0.95 * f;
        h['arm' + A].rotation.z = A === 'L' ? -0.15 : 0.15;
        h['fore' + A].rotation.x = -1.35 * (1 - f) - 0.1;
      }
      h.spine.rotation.x = 0.28 * f - 0.05 * wind * (1 - hit);
      h.legL.rotation.x = -0.5 * f; h.shinL.rotation.x = 0.2 * f;
      h.clavL.rotation.y = -0.35 * f; h.clavR.rotation.y = 0.35 * f;
      h.toeR.rotation.x = -0.4 * f;
    } else if (kind === 'finisher') {
      // remate: se arrodilla junto al zombi caído, levanta el arma y golpea hacia el suelo
      const kneel = U.smooth(t / 0.18) * (1 - U.smooth((t - 0.8) / 0.2));
      const raise = easeOut((t - 0.15) / 0.25);
      const smash = easeIn((t - 0.42) / 0.12);
      const rec = U.smooth((t - 0.66) / 0.2);
      h.hips.position.y -= 0.44 * kneel;
      h.legL.rotation.x = -1.35 * kneel; h.shinL.rotation.x = 1.45 * kneel; h.footL.rotation.x = -0.1 * kneel;
      h.legR.rotation.x = 0.25 * kneel; h.shinR.rotation.x = 1.9 * kneel; h.footR.rotation.x = 0.6 * kneel;
      h.toeR.rotation.x = -0.9 * kneel;
      h.clavR.rotation.z = -0.25 * raise * (1 - smash); h.clavR.rotation.y = 0.3 * smash * (1 - rec);
      let ax = U.lerp(-0.4, -3.0, raise);
      ax = U.lerp(ax, -0.5, smash);
      ax = U.lerp(ax, -0.6, rec);
      h.armR.rotation.x = ax; h.armR.rotation.z = -0.2 * raise * (1 - smash);
      h.foreR.rotation.x = U.lerp(U.lerp(-0.3, -0.85, raise), -0.1, smash);
      h.handR.rotation.x = 0.9 * smash * (1 - rec);
      h.spine.rotation.x = 0.28 * kneel + 0.5 * smash * (1 - rec) - 0.18 * raise * (1 - smash);
      h.chest.rotation.y = -0.3 * raise * (1 - smash);
      h.neck.rotation.x = 0.25 * kneel;
      if (two) { h.armL.rotation.x = ax; h.armL.rotation.z = -0.45; h.foreL.rotation.x = h.foreR.rotation.x - 0.3; }
      else { h.armL.rotation.x = -0.3 * kneel; h.armL.rotation.z = 0.3 * kneel; h.foreL.rotation.x = -0.9 * kneel; }
    } else if (kind === 'runatk' || kind === 'runshove') {
      // ataque en carrera: impulso hacia delante, el brazo izquierdo por delante y el arma
      // arriba detrás de la cabeza; golpe de arriba abajo al llegar y recuperación a trompicones
      const lean = U.smooth(t / 0.12) * (1 - U.smooth((t - 0.6) / 0.4));
      const up = easeOut(t / 0.24) * (1 - easeIn((t - 0.24) / 0.18));
      const f = easeIn((t - 0.24) / 0.18) * (1 - U.smooth((t - 0.55) / 0.45));
      h.spine.rotation.x += 0.3 * lean + 0.35 * f;
      h.hips.position.y -= 0.06 * lean + 0.08 * f;
      // zancada: la izquierda delante, la derecha empuja atrás
      h.legL.rotation.x = -0.9 * lean; h.shinL.rotation.x = 0.7 * lean;
      h.legR.rotation.x = 0.55 * lean; h.shinR.rotation.x = 0.5 * lean + 0.4 * up; h.toeR.rotation.x = -0.6 * lean;
      h.footL.rotation.x = -0.2 * lean;
      if (kind === 'runshove') {
        // placaje con el hombro
        h.spine.rotation.x += 0.25 * (up + f);
        h.armL.rotation.x = -1.2 * lean; h.armR.rotation.x = -1.25 * lean;
        h.armL.rotation.z = -0.25 * lean; h.armR.rotation.z = 0.25 * lean;
        h.foreL.rotation.x = -1.5 * lean + 0.9 * f; h.foreR.rotation.x = -1.5 * lean + 0.9 * f;
        h.clavL.rotation.y = -0.35 * f; h.clavR.rotation.y = 0.35 * f;
        h.chest.rotation.y = -0.3 * up + 0.2 * f;
      } else {
        h.chest.rotation.y = -0.5 * up + 0.55 * f;
        h.spine.rotation.y = -0.2 * up + 0.25 * f;
        // brazo derecho: arriba detrás de la cabeza y abajo con fuerza
        h.armR.rotation.x = -0.5 - 2.3 * up + 0.2 * f;
        h.armR.rotation.z = -0.35 * up;
        h.foreR.rotation.x = -1.3 * up - 0.25 * f;
        h.handR.rotation.x = -0.3 * up + 0.85 * f;
        h.clavR.rotation.z = -0.25 * up; h.clavR.rotation.y = 0.3 * f;
        if (two) { h.armL.rotation.x = h.armR.rotation.x; h.armL.rotation.z = -0.45; h.foreL.rotation.x = h.foreR.rotation.x - 0.3; }
        else {
          // el izquierdo se lanza adelante (como para agarrar) y luego tira hacia abajo
          h.armL.rotation.x = -1.55 * up * lean - 0.5 * f; h.armL.rotation.z = -0.25 * up;
          h.foreL.rotation.x = -0.25 * up - 0.9 * f;
          h.clavL.rotation.y = -0.3 * up;
        }
      }
    } else if (kind === 'bash') {
      // culatazo: paso adelante y empuje con el cuerpo (las manos las pone el IK del arma)
      const f = hit * (1 - back);
      h.spine.rotation.x += 0.22 * f - 0.08 * wind * (1 - hit);
      h.chest.rotation.y += -0.25 * wind * (1 - hit) + 0.2 * f;
      h.legL.rotation.x += -0.45 * f; h.shinL.rotation.x += 0.25 * f;
      h.legR.rotation.x += 0.2 * f; h.toeR.rotation.x = -0.4 * f;
    } else if (kind === 'grab') {
      // agarre por la espalda: rodillas dobladas, el cuerpo tira hacia atrás
      const k = win(t, 0, 0.12) * (1 - win(t, 0.86, 1));
      const pull = sin(t * 23) * 0.05 * (1 - win(t, 0.55, 0.8));
      h.hips.position.y -= 0.12 * k;
      h.legL.rotation.x -= 0.5 * k; h.shinL.rotation.x += 0.6 * k;
      h.legR.rotation.x += 0.15 * k; h.shinR.rotation.x += 0.5 * k; h.toeR.rotation.x -= 0.4 * k;
      h.spine.rotation.x += (-0.14 + pull) * k;
      h.chest.rotation.y += pull * 2 * k;
      h.neck.rotation.x += 0.15 * k;
      h.hips.rotation.z += pull * k;
    } else if (kind === 'search') {
      // registrar: agachado ante un mueble bajo o de pie ante uno alto; las manos rebuscan
      const k = win(t, 0, 0.15) * (1 - win(t, 0.88, 1));
      const low = s && s.searchLow;
      const r1 = sin(t * 26), r2 = sin(t * 26 + 2.1);
      const dig = (1 - win(t, 0.78, 0.88));
      if (low) {
        h.hips.position.y -= 0.42 * k;
        h.legL.rotation.x -= 1.35 * k; h.shinL.rotation.x += 1.9 * k; h.footL.rotation.x -= 0.5 * k;
        h.legR.rotation.x -= 0.5 * k; h.shinR.rotation.x += 2.1 * k; h.footR.rotation.x += 0.3 * k; h.toeR.rotation.x -= 0.8 * k;
        h.spine.rotation.x += 0.55 * k;
        h.armL.rotation.x = U.lerp(h.armL.rotation.x, -0.9 + 0.25 * r1 * dig, k); h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.5 - 0.3 * r2 * dig, k);
        h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.95 + 0.25 * r2 * dig, k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -0.5 - 0.3 * r1 * dig, k);
      } else {
        h.spine.rotation.x += 0.12 * k;
        h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.25 + 0.2 * r1 * dig, k); h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.9 - 0.3 * r2 * dig, k);
        h.armR.rotation.x = U.lerp(h.armR.rotation.x, -1.3 + 0.2 * r2 * dig, k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -0.9 - 0.3 * r1 * dig, k);
      }
      h.armL.rotation.z = U.lerp(h.armL.rotation.z, -0.15, k); h.armR.rotation.z = U.lerp(h.armR.rotation.z, 0.15, k);
      h.neck.rotation.x += 0.35 * k; h.head.rotation.x += 0.15 * k;
      h.clavL.rotation.y -= 0.2 * k; h.clavR.rotation.y += 0.2 * k;
    } else if (kind === 'bandage') {
      // vendarse: el antebrazo izquierdo cruzado delante y la mano derecha dando vueltas con la venda
      const k = win(t, 0, 0.12) * (1 - win(t, 0.9, 1));
      const r1 = sin(t * 34), r2 = cos(t * 34);
      h.spine.rotation.x += 0.18 * k; h.neck.rotation.x += 0.45 * k; h.head.rotation.x += 0.15 * k;
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -0.8, k); h.armL.rotation.z = U.lerp(h.armL.rotation.z, -0.42, k);
      h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -1.45, k);
      h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.85 + 0.16 * r1, k); h.armR.rotation.z = U.lerp(h.armR.rotation.z, 0.38 + 0.08 * r2, k);
      h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -1.25 + 0.22 * r2, k);
      h.clavL.rotation.y -= 0.15 * k; h.clavR.rotation.y += 0.25 * k;
    } else if (kind === 'punch1' || kind === 'punch2') {
      // gancho (1 = derecha, 2 = izquierda): carga girando el torso hacia el lado del puño,
      // descarga girando hacia el otro con el peso adelante, y vuelve a la guardia
      const sg = kind === 'punch1' ? 1 : -1;
      const w = easeOut(t / 0.3), f = easeIn((t - 0.28) / 0.14), b = U.smooth((t - 0.56) / 0.44);
      const tw = sg * (-0.35 * w + 1.0 * f) * (1 - b);
      h.hips.rotation.y += tw * 0.35; h.spine.rotation.y += tw * 0.4; h.chest.rotation.y += tw * 0.5;
      h.spine.rotation.x += 0.06 * w * (1 - f) + 0.16 * f * (1 - b);
      h.spine.rotation.z += -sg * 0.1 * f * (1 - b) + sg * 0.05 * w * (1 - f);
      h.hips.position.y -= 0.03 * (w + f) * (1 - b);
      h.clavR.rotation.y += (sg > 0 ? -0.15 * w * (1 - f) + 0.3 * f * (1 - b) : 0);
      h.clavL.rotation.y += (sg < 0 ? 0.15 * w * (1 - f) - 0.3 * f * (1 - b) : 0);
      // pie de atrás que empuja y gira
      const back = sg > 0 ? 'R' : 'L', front = sg > 0 ? 'L' : 'R';
      h['toe' + back].rotation.x -= 0.45 * f * (1 - b);
      h['leg' + back].rotation.x += 0.12 * f * (1 - b);
      h['leg' + front].rotation.x -= 0.18 * f * (1 - b); h['shin' + front].rotation.x += 0.14 * f * (1 - b);
      h.neck.rotation.x -= 0.05 * f * (1 - b);
    } else if (kind === 'punch3') {
      // golpe fuerte: se agacha y se aparta (esquiva), sube girando con todo el cuerpo y descarga
      // de arriba abajo; termina muy inclinado hacia delante por la inercia
      const duck = U.smooth(t / 0.28) * (1 - U.smooth((t - 0.34) / 0.14));
      const f = easeIn((t - 0.36) / 0.16);
      const fol = f * (1 - U.smooth((t - 0.66) / 0.34));
      const tw = (-0.6 * duck + 0.85 * fol);
      h.hips.rotation.y += tw * 0.35; h.spine.rotation.y += tw * 0.4; h.chest.rotation.y += tw * 0.5;
      h.hips.position.y -= 0.15 * duck + 0.07 * fol;
      const post = U.smooth((t - 0.5) / 0.14) * (1 - U.smooth((t - 0.7) / 0.3));
      h.spine.rotation.x += 0.32 * duck + 0.14 * f * (1 - post) + 0.5 * post;
      h.spine.rotation.z += 0.16 * duck - 0.1 * fol;
      h.neck.rotation.x -= 0.28 * duck + 0.2 * fol;
      h.legL.rotation.x -= 0.55 * duck + 0.55 * fol; h.shinL.rotation.x += 0.85 * duck + 0.5 * fol;
      h.legR.rotation.x -= 0.25 * duck - 0.38 * fol; h.shinR.rotation.x += 0.75 * duck + 0.2 * fol;
      h.footL.rotation.x -= 0.2 * duck;
      h.toeR.rotation.x -= 0.6 * fol;
      h.clavR.rotation.y += -0.2 * duck + 0.38 * fol; h.clavR.rotation.z -= 0.12 * f * (1 - fol * 0.5);
    } else if (kind === 'stomp') {
      const lift = wind * (1 - hit);
      h.legR.rotation.x = -1.25 * lift - 0.3 * hit * (1 - back);
      h.shinR.rotation.x = 1.35 * lift + 0.1;
      h.footR.rotation.x = 0.3 * lift;
      h.spine.rotation.x = 0.28 * (wind + hit) * (1 - back);
      h.armL.rotation.z = 0.5 * wind * (1 - back); h.armR.rotation.z = -0.5 * wind * (1 - back);
      h.legL.rotation.x = 0.15 * lift; h.shinL.rotation.x = 0.35 * lift;
    }
  }

  // Reacción a un golpe (infectados y protagonista): un tirón seco en cabeza y torso que vuelve como un
  // resorte, encima del cuerpo que trastabilla según el tipo de golpe. u: 0 a 1, dur: segundos, fl: lado
  function reactPose(h, kind, u, dur, fl) {
      const e = u * (dur || 0.55);
      const pk = e < 0.06 ? U.smooth(e / 0.06) : Math.exp(-(e - 0.06) * 6) * Math.cos((e - 0.06) * 9);
      const env = sin(Math.PI * Math.pow(u, 0.7));
      const stp = sin(u * Math.PI * 3) * env;
      const L = (r, v, k) => { r.x = U.lerp(r.x, v, k); };
      switch (kind) {
        case 'side':
          h.neck.rotation.z += fl * 0.55 * pk; h.head.rotation.z += fl * 0.3 * pk; h.head.rotation.y -= fl * 0.5 * pk;
          h.chest.rotation.y -= fl * 0.45 * pk; h.spine.rotation.z += fl * 0.38 * env; h.spine.rotation.x += 0.22 * env;
          h.armL.rotation.z += 0.75 * env; h.armR.rotation.z -= 0.75 * env;
          L(h.armL.rotation, -0.35, env); L(h.armR.rotation, -0.35, env);
          h.hips.position.y -= 0.07 * env; h.hips.rotation.z += fl * 0.12 * env;
          h.legL.rotation.x += 0.35 * stp; h.legR.rotation.x -= 0.35 * stp;
          h.shinL.rotation.x += 0.45 * max(0, stp); h.shinR.rotation.x += 0.45 * max(0, -stp);
          h.legL.rotation.z -= fl * 0.12 * env; h.legR.rotation.z -= fl * 0.12 * env;
          break;
        case 'heavy':
          h.neck.rotation.x -= 0.7 * pk; h.head.rotation.x -= 0.45 * pk; h.spine.rotation.z += fl * 0.15 * pk;
          h.spine.rotation.x = U.lerp(h.spine.rotation.x, -0.5, env);
          L(h.armL.rotation, -2.3, env); L(h.armR.rotation, -2.0, env);
          h.armL.rotation.z += 0.55 * env; h.armR.rotation.z -= 0.55 * env;
          L(h.foreL.rotation, -0.6, env); L(h.foreR.rotation, -0.7, env);
          h.hips.position.y -= 0.05 * env;
          h.legL.rotation.x += 0.55 * stp; h.legR.rotation.x -= 0.55 * stp;
          h.shinL.rotation.x += 0.5 * max(0, -stp); h.shinR.rotation.x += 0.5 * max(0, stp);
          break;
        case 'vert':
          h.neck.rotation.x += 0.55 * pk; h.head.rotation.x += 0.3 * pk;
          h.spine.rotation.x += 0.6 * env; h.spine.rotation.z += fl * 0.12 * pk;
          h.hips.position.y -= 0.2 * env;
          h.legL.rotation.x -= 0.6 * env; h.legR.rotation.x -= 0.45 * env;
          h.shinL.rotation.x += 1.0 * env; h.shinR.rotation.x += 0.9 * env;
          h.footL.rotation.x -= 0.3 * env; h.footR.rotation.x -= 0.3 * env;
          L(h.armL.rotation, 0.1, env); L(h.armR.rotation, 0.05, env);
          break;
        case 'stab':
          h.spine.rotation.x += 0.55 * env; h.neck.rotation.x += 0.3 * pk;
          L(h.armL.rotation, -0.7, env); L(h.foreL.rotation, -1.5, env);
          L(h.armR.rotation, -0.6, env); L(h.foreR.rotation, -1.4, env);
          h.hips.position.y -= 0.06 * env;
          h.legL.rotation.x += 0.2 * stp; h.legR.rotation.x -= 0.2 * stp;
          break;
        case 'launch': {
          // te manda lejos: sales trastabillando hacia delante (hacia donde vas), doblada, casi te caes, braceando
          // para no ir al suelo, y te recuperas al final
          const k = U.smooth(c01(u / 0.1)) * (1 - U.smooth(c01((u - 0.62) / 0.38)));
          const deep = sin(Math.PI * c01((u - 0.08) / 0.62));
          const sp = sin(u * Math.PI * 7);
          h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.5 + 0.68 * deep, k) - 0.5 * pk;
          h.spine.rotation.z += fl * 0.22 * k * sin(u * Math.PI * 2);
          h.neck.rotation.x = U.lerp(h.neck.rotation.x, -0.5, k) - 0.4 * pk; h.head.rotation.x -= 0.2 * k;
          h.hips.position.y -= (0.07 + 0.24 * deep) * k;
          L(h.armL.rotation, -1.35 + 0.6 * sin(u * 23), k); h.armL.rotation.z += (0.75 + 0.3 * sin(u * 17)) * k;
          L(h.armR.rotation, -0.85 - 0.5 * deep + 0.45 * sin(u * 19 + 1), k); h.armR.rotation.z -= (0.55 + 0.25 * sin(u * 13)) * k;
          L(h.foreL.rotation, -0.5, k); L(h.foreR.rotation, -0.3, k);
          h.legL.rotation.x += (-0.75 * max(0, sp) + 0.35 * max(0, -sp) - 0.25 * deep) * k;
          h.legR.rotation.x += (-0.75 * max(0, -sp) + 0.35 * max(0, sp) - 0.25 * deep) * k;
          h.shinL.rotation.x += (0.9 * max(0, sp) + 0.3 * deep) * k; h.shinR.rotation.x += (0.9 * max(0, -sp) + 0.3 * deep) * k;
          break;
        }
        case 'wall':
          // latigazo contra la pared: la cabeza va adelante y las rodillas ceden
          h.neck.rotation.x += 0.55 * pk; h.head.rotation.x += 0.25 * pk;
          h.spine.rotation.x += 0.3 * env; h.hips.position.y -= 0.12 * env;
          h.shinL.rotation.x += 0.5 * env; h.shinR.rotation.x += 0.4 * env; h.legL.rotation.x -= 0.3 * env; h.legR.rotation.x -= 0.2 * env;
          L(h.armL.rotation, -0.1, env); L(h.armR.rotation, -0.1, env);
          h.armL.rotation.z += 0.3 * env; h.armR.rotation.z -= 0.3 * env;
          break;
        default:      // empujón, culatazo o disparo: se echa atrás con los brazos abiertos
          h.neck.rotation.x -= 0.45 * pk; h.spine.rotation.z += fl * 0.2 * pk;
          h.spine.rotation.x = U.lerp(h.spine.rotation.x, -0.35, env);
          h.armL.rotation.z += 0.75 * env; h.armR.rotation.z -= 0.75 * env;
          L(h.armL.rotation, -0.6, env); L(h.armR.rotation, -0.6, env);
          h.head.rotation.x -= 0.25 * env;
          h.legL.rotation.x += 0.4 * stp; h.legR.rotation.x -= 0.4 * stp;
      }
  }

  const _zps = { action: null, t: 0, time: 0 };
  // ---- Combo salvaje de los infectados (bestia, no boxeador): garras abiertas, todo el cuerpo detrás del golpe,
  // la cabeza adelantada como para morder, golpe muy rápido y recuperación torpe. Los impactos caen en los mismos
  // tiempos que el juego (punch1 y punch2 a 0,42; punch3 a 0,52; golpe en carrera a 0,42)
  const ZRDY = { armL: [-1.0, 0, 0.35], armR: [-1.0, 0, -0.35], foreL: [-0.9, 0, 0], foreR: [-0.9, 0, 0], handL: [0.3, 0, 0], handR: [0.3, 0, 0] };
  const zk = (o) => Object.assign({}, ZRDY, o);
  const FERAL = {
    // 1: zarpazo en diagonal desde arriba con la derecha: se encabrita, cae con todo el peso y arrastra la garra
    punch1: { keys: [
      [0, zk({ '+spine': [0.12, 0, 0] })],
      [0.27, zk({ armR: [-2.75, 0.3, -0.85], foreR: [-0.95, 0, 0], handR: [0.55, 0, 0], armL: [-0.85, 0, 0.6], foreL: [-1.35, 0, 0], '+chest': [-0.05, -0.55, 0], '+spine': [-0.28, -0.2, 0], '+neck': [-0.35, 0, -0.1], '+head': [-0.15, 0, 0], hipsY: [0.02, 0, 0], '+legR': [0.15, 0, 0] }), 'o'],
      [0.42, zk({ armR: [-0.95, -0.4, 0.6], foreR: [-0.3, 0, 0], handR: [-0.35, 0, 0], armL: [-0.45, 0, 0.75], foreL: [-0.6, 0, 0], '+chest': [0.2, 0.6, 0], '+spine': [0.55, 0.25, 0], '+neck': [0.28, 0, 0], hipsY: [-0.08, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.3, 0, 0], '+toeR': [-0.5, 0, 0] }), 'i'],
      [0.6, zk({ armR: [-0.3, -0.5, 0.95], foreR: [-0.2, 0, 0], handR: [-0.2, 0, 0], armL: [-0.55, 0, 0.95], foreL: [-0.7, 0, 0], '+chest': [0.25, 0.8, 0], '+spine': [0.72, 0.3, 0.1], '+neck': [0.12, 0.2, 0.18], hipsY: [-0.12, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.32, 0, 0], '+toeR': [-0.45, 0, 0] }), 'o'],
      [1, zk({ armR: [-0.85, 0, -0.15], '+spine': [0.3, 0.05, 0.06], '+neck': [-0.12, 0, 0.18] })]
    ] },
    // 2: zarpazo de la izquierda desde fuera, girando el torso, y la cabeza que se lanza a morder
    punch2: { keys: [
      [0, zk({ armR: [-0.6, -0.3, 0.6], '+chest': [0.12, 0.45, 0], '+spine': [0.38, 0.2, 0] })],
      [0.25, zk({ armL: [-1.85, 0.1, 1.15], foreL: [-1.25, 0, 0], handL: [0.5, 0, 0], armR: [-0.7, 0, -0.5], foreR: [-1.2, 0, 0], '+chest': [0, 0.6, 0], '+spine': [0.1, 0.2, 0], '+neck': [-0.25, 0.25, 0.1], hipsY: [-0.02, 0, 0] }), 'o'],
      [0.42, zk({ armL: [-1.25, 0.45, -0.55], foreL: [-0.25, 0, 0], handL: [-0.3, 0, 0], armR: [-0.45, 0, -0.8], foreR: [-0.7, 0, 0], '+chest': [0.15, -0.65, 0], '+spine': [0.55, -0.25, 0], '+neck': [0.35, -0.2, 0], hipsY: [-0.1, 0, 0], '+legR': [-0.45, 0, 0], '+shinR': [0.5, 0, 0], '+legL': [0.3, 0, 0], '+toeL': [-0.5, 0, 0] }), 'i'],
      [0.55, zk({ armL: [-0.9, 0.5, -0.9], foreL: [-0.2, 0, 0], armR: [-0.5, 0, -0.85], foreR: [-0.8, 0, 0], '+chest': [0.18, -0.8, 0], '+spine': [0.62, -0.3, 0], '+neck': [0.55, -0.15, 0], '+head': [0.25, 0, 0], hipsY: [-0.12, 0, 0], '+legR': [-0.48, 0, 0], '+shinR': [0.52, 0, 0], '+legL': [0.3, 0, 0] }), 'i'],
      [0.7, zk({ armL: [-0.7, 0.4, -0.7], armR: [-0.7, 0, -0.6], '+chest': [0.12, -0.6, 0], '+spine': [0.5, -0.2, 0], '+neck': [-0.1, -0.1, 0.1], hipsY: [-0.08, 0, 0], '+legR': [-0.35, 0, 0], '+shinR': [0.4, 0, 0] }), 'o'],
      [1, zk({ '+spine': [0.25, 0, 0], '+neck': [-0.05, 0, -0.12] })]
    ] },
    // 3: se yergue con las dos garras arriba, tiembla de rabia y las descarga juntas como un martillo; queda doblado
    punch3: { keys: [
      [0, zk({ '+spine': [0.2, 0, 0] })],
      [0.33, zk({ armL: [-2.85, 0, 0.45], armR: [-2.85, 0, -0.45], foreL: [-1.05, 0, 0], foreR: [-1.05, 0, 0], handL: [0.5, 0, 0], handR: [0.5, 0, 0], '+spine': [-0.35, 0, 0], '+neck': [-0.5, 0, 0], '+head': [-0.2, 0, 0], hipsY: [0.03, 0, 0], '+legL': [0.08, 0, 0], '+legR': [-0.1, 0, 0] }), 'o'],
      [0.45, zk({ armL: [-3.05, 0, 0.55], armR: [-3.0, 0, -0.55], foreL: [-1.15, 0, 0], foreR: [-1.15, 0, 0], handL: [0.6, 0, 0], handR: [0.6, 0, 0], '+spine': [-0.42, 0, 0], '+neck': [-0.6, 0, 0], '+head': [-0.25, 0, 0], hipsY: [0.04, 0, 0] }), 'l'],
      [0.52, zk({ armL: [-0.75, 0, -0.1], armR: [-0.75, 0, 0.1], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], handL: [-0.5, 0, 0], handR: [-0.5, 0, 0], '+spine': [0.42, 0, 0], '+neck': [0.3, 0, 0], hipsY: [-0.16, 0, 0], '+legL': [-0.6, 0, 0], '+shinL': [0.8, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.6, 0, 0] }), 'i'],
      [0.68, zk({ armL: [-0.25, 0, 0.2], armR: [-0.25, 0, -0.2], foreL: [-0.25, 0, 0], foreR: [-0.25, 0, 0], handL: [-0.3, 0, 0], handR: [-0.3, 0, 0], '+spine': [0.62, 0, 0.1], '+neck': [0.2, 0, 0.1], hipsY: [-0.2, 0, 0], '+legL': [-0.65, 0, 0], '+shinL': [0.85, 0, 0], '+legR': [-0.25, 0, 0], '+shinR': [0.65, 0, 0] }), 'o'],
      [0.86, zk({ armL: [-0.4, 0, 0.3], armR: [-0.4, 0, -0.3], '+spine': [0.8, 0, -0.05], '+neck': [-0.15, 0, -0.1], hipsY: [-0.15, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.6, 0, 0], '+legR': [-0.15, 0, 0], '+shinR': [0.4, 0, 0] })],
      [1, zk({ '+spine': [0.3, 0, 0] })]
    ] },
    // golpe en carrera: se agacha corriendo y salta encima con las dos garras por delante; cae de golpe
    runatk: { keys: [
      [0, { armL: [0.35, 0, 0.45], armR: [0.35, 0, -0.45], foreL: [-0.6, 0, 0], foreR: [-0.6, 0, 0], '+spine': [0.6, 0, 0], '+neck': [-0.35, 0, 0] }],
      [0.25, { armL: [-2.2, 0, 0.8], armR: [-2.2, 0, -0.8], foreL: [-0.9, 0, 0], foreR: [-0.9, 0, 0], handL: [0.5, 0, 0], handR: [0.5, 0, 0], '+spine': [0.42, 0, 0], '+neck': [-0.4, 0, 0], hipsY: [-0.13, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.9, 0, 0], '+legR': [-0.3, 0, 0], '+shinR': [0.85, 0, 0] }, 'o'],
      [0.42, { armL: [-1.0, 0, -0.2], armR: [-1.0, 0, 0.2], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], handL: [-0.4, 0, 0], handR: [-0.4, 0, 0], '+spine': [0.75, 0, 0], '+neck': [0.2, 0, 0], hipsY: [0.07, 0, 0], '+legL': [0.3, 0, 0], '+shinL': [0.9, 0, 0], '+legR': [0.45, 0, 0], '+shinR': [1.1, 0, 0] }, 'i'],
      [0.6, { armL: [-0.3, 0, 0.35], armR: [-0.3, 0, -0.35], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], '+spine': [0.88, 0, 0], '+neck': [0.05, 0, 0], hipsY: [-0.19, 0, 0], '+legL': [-0.7, 0, 0], '+shinL': [1.0, 0, 0], '+legR': [-0.2, 0, 0], '+shinR': [0.9, 0, 0] }, 'o'],
      [1, zk({ '+spine': [0.35, 0, 0] })]
    ] },
    // temblante 1: barrido enorme de oso con la derecha, de lado a lado, con todo el cuerpo
    T_punch1: { keys: [
      [0, zk({ '+spine': [0.15, 0, 0] })],
      [0.3, zk({ armR: [-1.35, -0.1, -1.55], foreR: [-0.45, 0, 0], handR: [0.4, 0, 0], armL: [-0.9, 0, 0.5], foreL: [-1.1, 0, 0], '+chest': [0, -0.75, 0], '+spine': [0.12, -0.32, 0], '+neck': [-0.3, -0.2, 0], hipsY: [-0.05, 0, 0], '+legR': [0.2, 0, 0] }), 'o'],
      [0.42, zk({ armR: [-1.45, 0.35, 0.45], foreR: [-0.3, 0, 0], handR: [-0.2, 0, 0], armL: [-0.55, 0, 0.8], foreL: [-0.6, 0, 0], '+chest': [0.1, 0.65, 0], '+spine': [0.38, 0.3, 0], '+neck': [0.2, 0.2, 0], hipsY: [-0.09, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.25, 0, 0], '+toeR': [-0.4, 0, 0] }), 'i'],
      [0.64, zk({ armR: [-1.0, 0.45, 1.05], foreR: [-0.25, 0, 0], armL: [-0.45, 0, 0.9], '+chest': [0.12, 0.95, 0], '+spine': [0.48, 0.38, 0.05], '+neck': [0.1, 0.3, 0.1], hipsY: [-0.12, 0, 0], '+legL': [-0.45, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.28, 0, 0] }), 'o'],
      [1, zk({ '+spine': [0.25, 0, 0] })]
    ] },
    // temblante 2: manotazo de revés con la izquierda que te lanza por los aires
    T_punch2: { keys: [
      [0, zk({ armR: [-1.0, 0.4, 0.9], '+chest': [0.1, 0.8, 0], '+spine': [0.4, 0.3, 0] })],
      [0.26, zk({ armL: [-1.4, 0.1, 1.6], foreL: [-0.4, 0, 0], handL: [0.4, 0, 0], armR: [-0.8, 0, -0.5], foreR: [-1.1, 0, 0], '+chest': [0, 0.85, 0], '+spine': [0.15, 0.35, 0], '+neck': [-0.3, 0.2, 0], hipsY: [-0.06, 0, 0], '+legL': [0.2, 0, 0] }), 'o'],
      [0.42, zk({ armL: [-1.5, -0.35, -0.45], foreL: [-0.2, 0, 0], handL: [-0.2, 0, 0], armR: [-0.5, 0, -0.85], foreR: [-0.6, 0, 0], '+chest': [0.12, -0.7, 0], '+spine': [0.42, -0.32, 0], '+neck': [0.25, -0.2, 0], hipsY: [-0.1, 0, 0], '+legR': [-0.45, 0, 0], '+shinR': [0.5, 0, 0], '+legL': [0.28, 0, 0], '+toeL': [-0.45, 0, 0] }), 'i'],
      [0.62, zk({ armL: [-1.1, -0.45, -1.1], foreL: [-0.2, 0, 0], armR: [-0.45, 0, -0.95], '+chest': [0.15, -1.0, 0], '+spine': [0.5, -0.4, -0.05], '+neck': [0.1, -0.3, -0.1], hipsY: [-0.13, 0, 0], '+legR': [-0.5, 0, 0], '+shinR': [0.55, 0, 0], '+legL': [0.3, 0, 0] }), 'o'],
      [1, zk({ '+spine': [0.25, 0, 0] })]
    ] },
    // temblante al que intentan eliminar por la espalda: se gira, te agarra del cuello con la derecha, te levanta
    // a pulso y te tira de un manotazo hacia su izquierda
    tthrow: { keys: [
      [0, zk({ '+spine': [0.15, 0, 0] })],
      [0.17, zk({ armR: [-1.55, 0, -0.1], foreR: [-0.35, 0, 0], handR: [0.2, 0, 0], armL: [-0.7, 0, 0.6], foreL: [-1.0, 0, 0], '+spine': [0.3, 0, 0], '+neck': [-0.2, 0, 0], hipsY: [-0.05, 0, 0] }), 'o'],
      [0.3, zk({ armR: [-1.6, 0, -0.05], foreR: [-0.55, 0, 0], handR: [0.1, 0, 0], armL: [-0.6, 0, 0.7], '+spine': [0.2, 0, 0], '+neck': [-0.25, 0, 0] })],
      [0.58, zk({ armR: [-2.45, 0, -0.15], foreR: [-0.45, 0, 0], handR: [0.1, 0, 0], armL: [-0.5, 0, 0.8], foreL: [-0.8, 0, 0], '+spine': [-0.18, 0, 0], '+chest': [0, -0.25, 0], '+neck': [-0.35, 0, 0], hipsY: [-0.04, 0, 0], '+legL': [-0.2, 0, 0], '+shinL': [0.25, 0, 0] })],
      [0.67, zk({ armR: [-1.0, -0.6, 0.95], foreR: [-0.2, 0, 0], handR: [-0.2, 0, 0], armL: [-0.45, 0, 0.9], '+chest': [0.15, 0.75, 0], '+spine': [0.42, 0.32, 0], '+neck': [0.15, 0.25, 0], hipsY: [-0.1, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.45, 0, 0], '+legR': [0.25, 0, 0] }), 'i'],
      [0.85, zk({ armR: [-0.6, -0.5, 1.0], armL: [-0.5, 0, 0.8], '+chest': [0.12, 0.6, 0], '+spine': [0.4, 0.25, 0], hipsY: [-0.08, 0, 0] }), 'o'],
      [1, zk({ '+spine': [0.2, 0, 0] })]
    ] },
    // hongomorfo: se arranca un trozo de hongo del hombro izquierdo con la derecha, lo levanta y lo lanza
    H_rip: { keys: [
      [0, zk({ '+spine': [0.15, 0, 0] })],
      [0.2, zk({ armR: [-1.35, 0.5, 0.75], foreR: [-1.7, 0, 0], handR: [0.4, 0, 0], armL: [-0.4, 0, 0.5], '+chest': [0.05, 0.4, 0], '+spine': [0.25, 0.1, 0], '+neck': [0.2, 0.3, 0.2] }), 'o'],
      [0.33, zk({ armR: [-1.7, -0.2, -0.7], foreR: [-1.1, 0, 0], handR: [0.2, 0, 0], armL: [-0.5, 0, 0.7], '+chest': [0, -0.35, 0], '+spine': [-0.05, -0.1, 0], '+neck': [-0.25, -0.1, 0] }), 'i'],
      [0.52, zk({ armR: [-2.9, 0, -0.45], foreR: [-1.25, 0, 0], handR: [0.5, 0, 0], armL: [-1.0, 0, 0.6], foreL: [-0.6, 0, 0], '+chest': [0, -0.55, 0], '+spine': [-0.28, -0.15, 0], '+neck': [-0.35, 0, 0], '+legL': [-0.35, 0, 0], '+shinL': [0.3, 0, 0], hipsY: [0.02, 0, 0] }), 'o'],
      [0.72, zk({ armR: [-0.95, 0, 0.25], foreR: [-0.15, 0, 0], handR: [-0.3, 0, 0], armL: [-0.4, 0, 0.8], '+chest': [0.1, 0.6, 0], '+spine': [0.55, 0.2, 0], '+neck': [0.15, 0.1, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.5, 0, 0], '+legR': [0.3, 0, 0], hipsY: [-0.1, 0, 0] }), 'i'],
      [0.86, zk({ armR: [-0.45, 0, 0.45], foreR: [-0.2, 0, 0], '+chest': [0.12, 0.55, 0], '+spine': [0.55, 0.2, 0], hipsY: [-0.08, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.4, 0, 0] })],
      [1, zk({ '+spine': [0.2, 0, 0] })]
    ] },
    // hongomorfo: te agarra con las dos manos, te levanta hasta su cara, te muerde y te parte en dos; luego
    // te suelta y mira lo que queda
    H_kill: { keys: [
      [0, zk({})],
      [0.06, zk({ armL: [-1.5, 0, -0.1], armR: [-1.5, 0, 0.1], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0], '+spine': [0.35, 0, 0], '+neck': [-0.1, 0, 0] }), 'i'],
      [0.22, zk({ armL: [-2.05, 0, -0.18], armR: [-2.05, 0, 0.18], foreL: [-1.0, 0, 0], foreR: [-1.0, 0, 0], handL: [0.3, 0, 0], handR: [0.3, 0, 0], '+spine': [-0.12, 0, 0], '+neck': [-0.25, 0, 0], hipsY: [0.02, 0, 0] }), 'o'],
      [0.42, zk({ armL: [-1.85, 0, -0.28], armR: [-1.85, 0, 0.28], foreL: [-1.55, 0, 0], foreR: [-1.55, 0, 0], '+spine': [0.12, 0, 0], '+neck': [0.38, 0, 0], '+head': [0.22, 0, 0] })],
      [0.78, zk({ armL: [-1.8, 0, -0.32], armR: [-1.8, 0, 0.32], foreL: [-1.75, 0, 0], foreR: [-1.75, 0, 0], '+spine': [0.2, 0, 0], '+neck': [0.52, 0, 0], '+head': [0.3, 0, 0] })],
      [0.84, zk({ armL: [-1.6, 0, 1.3], armR: [-1.6, 0, -1.3], foreL: [-0.35, 0, 0], foreR: [-0.35, 0, 0], handL: [-0.3, 0, 0], handR: [-0.3, 0, 0], '+spine': [-0.22, 0, 0], '+neck': [-0.45, 0, 0], '+head': [-0.2, 0, 0], hipsY: [0.03, 0, 0] }), 'i'],
      [1, zk({ armL: [-0.6, 0, 0.55], armR: [-0.6, 0, -0.55], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0], '+spine': [0.45, 0, 0], '+neck': [0.25, 0, 0] }), 'o']
    ] },
    // hongomorfo dormido en la guarida: encorvado, la cabeza colgando, respira
    H_dorm: { keys: [
      [0, { armL: [-0.2, 0, 0.35], armR: [-0.2, 0, -0.35], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], '+spine': [0.38, 0, 0], '+neck': [0.35, 0, 0], '+head': [0.15, 0, 0], hipsY: [-0.04, 0, 0] }],
      [1, { armL: [-0.26, 0, 0.4], armR: [-0.26, 0, -0.4], foreL: [-0.34, 0, 0], foreR: [-0.34, 0, 0], '+spine': [0.3, 0, 0], '+neck': [0.28, 0, 0], '+head': [0.1, 0, 0], hipsY: [-0.02, 0, 0] }]
    ] },
    // chaskeado: zarpazo salvaje con las dos garras desde arriba (el golpe que te deja a su merced)
    bslam: { keys: [
      [0, { armL: [-2.45, 0, 0.9], armR: [-2.4, 0, -0.9], foreL: [-1.1, 0, 0], foreR: [-1.1, 0, 0], handL: [0.5, 0, 0], handR: [0.5, 0, 0], '+spine': [0.15, 0, 0], '+neck': [-0.25, 0, 0.3], hipsY: [-0.04, 0, 0] }],
      [0.38, { armL: [-1.15, 0, -0.05], armR: [-1.1, 0, 0.05], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], handL: [-0.4, 0, 0], handR: [-0.4, 0, 0], '+spine': [0.72, 0, 0], '+neck': [0.32, 0, 0], hipsY: [-0.11, 0, 0], '+legL': [-0.5, 0, 0], '+shinL': [0.55, 0, 0], '+legR': [0.3, 0, 0], '+toeR': [-0.5, 0, 0] }, 'i'],
      [1, { armL: [-1.5, 0, -0.3], armR: [-1.45, 0, 0.3], foreL: [-0.85, 0, 0], foreR: [-0.85, 0, 0], '+spine': [0.38, 0, 0], '+neck': [-0.1, 0, 0], hipsY: [-0.06, 0, 0], '+legL': [-0.4, 0, 0], '+shinL': [0.4, 0, 0], '+legR': [0.3, 0, 0] }, 'o']
    ] }
  };
  // Muñeco de trapo (lo lanza una explosión): cada hueso lleva su propio giro, que simula el cuerpo
  // rb = { hueso: {x, y, z} } (se suma a la pose de reposo). Se marca la pose como válida para el suavizado
  function poseRagdoll(h, rb) {
    reset(h);
    for (const k in rb) { const b = h[k]; if (!b) continue; const a = rb[k]; b.rotation.x += a.x; b.rotation.y += a.y; b.rotation.z += a.z; }
    if (h.prev) {
      for (let i = 0; i < h.bones.length; i++) { const r = h.bones[i].rotation; h.prev[i * 3] = r.x; h.prev[i * 3 + 1] = r.y; h.prev[i * 3 + 2] = r.z; }
      h.prev[h.bones.length * 3] = h.hips.position.y;
    }
  }

  // Pose del zombi
  function poseZombie(h, s) {
    reset(h);
    const t = s.time || 0, seed = s.seed || 0;
    const spr = s.sprint || 0;
    legs(h, s.phase, spr > 0.3 ? Math.max(s.amt, spr) : s.amt, spr > 0.3, s.drag);
    // temblante: pasos pesados de algo enorme (no la zancada del corredor flaco): la pierna se levanta poco, la
    // rodilla apenas se dobla atrás y el peso pasa de un pie al otro con un balanceo de lado a lado
    if (s.temb) {
      const mv = spr > 0.3 ? Math.max(s.amt, spr) : s.amt;
      for (const A of ['L', 'R']) { h['leg' + A].rotation.x *= 0.5; h['shin' + A].rotation.x *= 0.55; h['foot' + A].rotation.x *= 0.5; }
      h.hips.rotation.z += sin(s.phase) * 0.11 * mv; h.hips.position.y -= 0.025 * mv * (1 - Math.abs(cos(s.phase)));
      h.hips.rotation.y += sin(s.phase) * 0.06 * mv;
    }
    // paso torpe: la cadera se tuerce y el torso se balancea
    const sw = sin(s.phase * 0.5 + seed);
    h.hips.rotation.z += sin(s.phase) * 0.08 * s.amt;
    h.spine.rotation.z = sw * 0.07 + s.lean;
    h.spine.rotation.x = 0.14 + 0.05 * sin(s.phase * 2) * s.amt;
    h.neck.rotation.z = 0.25 * s.tilt + sw * 0.05;
    h.neck.rotation.y = sin(t * 0.8 + seed) * 0.18;
    h.head.rotation.x = 0.2 + sin(t * 1.3 + seed * 2) * 0.05;
    // brazos: colgando al vagar, hacia delante al perseguir
    const up = s.chase ? 1 : s.armsUp;
    const lag = sin(s.phase - 0.6);
    h.armL.rotation.x = -0.15 - 1.15 * up + lag * 0.16 + sin(t * 1.1 + seed) * 0.05;
    h.armR.rotation.x = -0.15 - 1.05 * up - lag * 0.16 + sin(t * 1.3 + seed) * 0.05;
    h.armL.rotation.z = 0.12 + 0.05 * sw; h.armR.rotation.z = -0.12 + 0.05 * sw;
    h.foreL.rotation.x = -0.25 - 0.2 * up - 0.1 * max(0, lag);
    h.foreR.rotation.x = -0.3 - 0.2 * up - 0.1 * max(0, -lag);
    if (s.reach > 0) {
      const r = s.reach;
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.55, r);
      h.armR.rotation.x = U.lerp(h.armR.rotation.x, -1.5, r);
      h.armL.rotation.z = -0.15 * r; h.armR.rotation.z = 0.15 * r;
      h.foreL.rotation.x = -0.1; h.foreR.rotation.x = -0.1;
      h.spine.rotation.x = 0.14 + 0.38 * r;
      h.head.rotation.x = 0.35 * r;
    }
    // corredor: carrera encorvada, brazos que se agitan y cabeza adelantada
    if (spr > 0.01) {
      const k = spr, q = sin(s.phase);
      // (el temblante: menos inclinado, los brazos pesados apenas se balancean, abiertos por la panza)
      const TB = s.temb ? 1 : 0, AS = TB ? 0.4 : 1.15;
      // carrera muy encorvada y desbocada: torso hacia delante, cabeza levantada mirándote, brazos sueltos
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, (TB ? 0.34 : 0.72) + 0.06 * sin(s.phase * 2), k);
      h.neck.rotation.x -= (TB ? 0.25 : 0.42) * k; h.head.rotation.x = U.lerp(h.head.rotation.x, -0.22, k);
      h.spine.rotation.z += sin(s.phase) * (TB ? 0.12 : 0.08) * k;
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, (TB ? -0.35 : -0.55) + q * AS, k); h.armR.rotation.x = U.lerp(h.armR.rotation.x, (TB ? -0.35 : -0.55) - q * AS, k);
      h.armL.rotation.z = U.lerp(h.armL.rotation.z, TB ? 0.4 : 0.55, k); h.armR.rotation.z = U.lerp(h.armR.rotation.z, TB ? -0.4 : -0.55, k);
      h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, (TB ? -0.6 : -1.1) - 0.3 * max(0, q), k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, (TB ? -0.6 : -1.1) - 0.3 * max(0, -q), k);
      h.chest.rotation.y += -q * (TB ? 0.1 : 0.25) * k;
    }
    // acechador: agazapado, rodillas dobladas, la cabeza baja y adelantada y los brazos colgando por delante
    if (s.creep > 0) {
      const k = s.creep, q = sin(s.phase);
      h.hips.position.y -= 0.27 * k;
      h.legL.rotation.x -= 0.6 * k; h.legR.rotation.x -= 0.6 * k; h.shinL.rotation.x += 1.05 * k; h.shinR.rotation.x += 1.05 * k;
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.92, k);
      h.neck.rotation.x -= 0.5 * k; h.head.rotation.x -= 0.1 * k;
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -0.55 + 0.15 * q, k); h.armR.rotation.x = U.lerp(h.armR.rotation.x, -0.6 - 0.15 * q, k);
      h.armL.rotation.z = U.lerp(h.armL.rotation.z, 0.2, k); h.armR.rotation.z = U.lerp(h.armR.rotation.z, -0.2, k);
      h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.5, k); h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -0.55, k);
    }
    // acechador agachado (quieto en su escondite): en cuclillas, rodillas abiertas, el torso hacia delante y los
    // antebrazos sobre las rodillas; los pies, planos en el suelo
    if (s.crouch > 0) {
      const k = s.crouch, L = U.lerp;
      h.hips.position.y -= 0.4 * k; h.hips.position.z -= 0.1 * k;
      for (const [A, sg] of [['L', 1], ['R', -1]]) {
        h['leg' + A].rotation.x = L(h['leg' + A].rotation.x, -1.3, k); h['leg' + A].rotation.z = L(h['leg' + A].rotation.z, 0.16 * sg, k);
        h['shin' + A].rotation.x = L(h['shin' + A].rotation.x, 2.0, k);
        h['foot' + A].rotation.x = L(h['foot' + A].rotation.x, -0.7, k);
        h['arm' + A].rotation.x = L(h['arm' + A].rotation.x, -0.85, k); h['arm' + A].rotation.z = L(h['arm' + A].rotation.z, 0.22 * sg, k);
        h['fore' + A].rotation.x = L(h['fore' + A].rotation.x, -0.75, k);
      }
      h.spine.rotation.x = L(h.spine.rotation.x, 0.55, k);
      h.neck.rotation.x -= 0.35 * k; h.head.rotation.x -= 0.1 * k;
    }
    // temblante: encorvado bajo el peso de los bultos, la cabeza hundida entre los hombros y los brazos abiertos
    if (s.temb) {
      h.neck.rotation.x += 0.22; h.head.rotation.x -= 0.12;
      h.spine.rotation.x += 0.1;
      h.armL.rotation.z += 0.22; h.armR.rotation.z -= 0.22;
      h.hips.position.y -= 0.03;
    }
    // embestida del temblante: placaje con el hombro izquierdo por delante, la cabeza gacha y el brazo derecho
    // recogido atrás
    if (s.tackle > 0) {
      const k = s.tackle, q = sin(s.phase);
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.95 + 0.05 * sin(s.phase * 2), k);
      h.spine.rotation.y += 0.38 * k; h.chest.rotation.y += 0.3 * k;
      h.neck.rotation.x = U.lerp(h.neck.rotation.x, 0.05, k); h.head.rotation.x = U.lerp(h.head.rotation.x, -0.25, k);
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.05 + 0.1 * q, k); h.armL.rotation.z = U.lerp(h.armL.rotation.z, -0.15, k);
      h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -1.9, k);
      h.armR.rotation.x = U.lerp(h.armR.rotation.x, 0.35 - 0.35 * q, k); h.armR.rotation.z = U.lerp(h.armR.rotation.z, -0.45, k);
      h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, -1.3, k);
    }
    // carga de la embestida: se agacha, echa el peso atrás y abre los brazos mientras grita
    if (s.tcharge > 0) {
      const k = U.smooth(Math.min(1, s.tcharge * 3)), sh = sin(t * 40) * 0.04;
      h.hips.position.y -= 0.12 * k;
      h.legL.rotation.x += -0.55 * k; h.shinL.rotation.x += 0.75 * k;
      h.legR.rotation.x += 0.25 * k; h.shinR.rotation.x += 0.6 * k;
    }
    // ataque (como en los juegos de referencia): se encoge con las garras arriba y atrás, y se lanza
    // con el cuerpo por delante y los brazos estirados para agarrarte
    if (s.atk != null) {
      const a = s.atk;
      const load = U.smooth(Math.min(1, a / 0.6)) * (1 - U.smooth((a - 0.68) / 0.22));
      const go = U.smooth((a - 0.66) / 0.3);
      h.spine.rotation.x = 0.12 - 0.12 * load + 0.62 * go;
      h.neck.rotation.x = -0.25 * load - 0.1 * go; h.head.rotation.x = 0.1 + 0.2 * go;
      h.hips.position.y -= 0.09 * load + 0.04 * go;
      h.legL.rotation.x += -0.3 * load - 0.6 * go; h.shinL.rotation.x += 0.45 * load + 0.35 * go;
      h.legR.rotation.x += 0.15 * load + 0.45 * go; h.shinR.rotation.x += 0.35 * load + 0.15 * go; h.toeR.rotation.x -= 0.5 * go;
      const wt = Math.min(1, load + go);
      h.armL.rotation.x = U.lerp(h.armL.rotation.x, U.lerp(-2.05, -1.6, go), wt);
      h.armR.rotation.x = U.lerp(h.armR.rotation.x, U.lerp(-2.2, -1.5, go), wt);
      h.armL.rotation.z = U.lerp(h.armL.rotation.z, U.lerp(0.55, -0.1, go), wt);
      h.armR.rotation.z = U.lerp(h.armR.rotation.z, U.lerp(-0.6, 0.1, go), wt);
      h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, U.lerp(-1.3, -0.15, go), wt);
      h.foreR.rotation.x = U.lerp(h.foreR.rotation.x, U.lerp(-1.4, -0.2, go), wt);
      h.chest.rotation.y += -0.25 * load + 0.2 * go;
    }
    // ardiendo: se golpea el cuerpo y agita los brazos para apagar las llamas, la cabeza se sacude; en el
    // suelo (2) patalea mientras rueda
    if (s.burn) {
      const q = t * 11 + seed, k = s.burn === 2 ? 1 : 0.9;
      h.armL.rotation.x = -1.3 + 0.95 * sin(q); h.armR.rotation.x = -1.3 + 0.95 * sin(q + 2.6);
      h.armL.rotation.z = 0.5 + 0.45 * sin(q * 0.7 + 1); h.armR.rotation.z = -0.5 - 0.45 * sin(q * 0.7 + 2.2);
      h.foreL.rotation.x = -1.5 + 0.6 * sin(q * 1.3); h.foreR.rotation.x = -1.5 + 0.6 * sin(q * 1.3 + 1.7);
      h.chest.rotation.y += 0.45 * sin(t * 7 + seed) * k; h.spine.rotation.z += 0.18 * sin(t * 5.3) * k;
      h.neck.rotation.y = 0.5 * sin(t * 9 + 1) * k; h.neck.rotation.x = -0.25 + 0.2 * sin(t * 6.5);
      h.spine.rotation.x += s.burn === 2 ? -0.2 : 0.25;
      if (s.burn === 2) {
        h.legL.rotation.x = -0.6 + 0.6 * sin(t * 9); h.legR.rotation.x = -0.6 + 0.6 * sin(t * 9 + 2);
        h.shinL.rotation.x = 0.9 + 0.5 * sin(t * 9 + 1); h.shinR.rotation.x = 0.9 + 0.5 * sin(t * 9 + 3);
      }
    }
    // golpes del infectado: el combo de puñetazos (gancho de derecha, gancho de izquierda y golpe fuerte)
    // y el ataque en carrera (brazo izquierdo adelante, el derecho arriba y abajo con todo el peso)
    if (s.punch) {
      const pk = s.punch;
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.1, 0.7);
      const F = (s.temb && FERAL['T_' + pk.kind]) || FERAL[pk.kind];
      if (F) {
        keyPose(h, F, pk.t);
        // sin control: la cabeza y el brazo que no golpea rebotan con retraso; el corredor, más frenético
        const fr = s.runner && !s.temb ? 1 : 0.5, j = sin(Math.PI * c01(pk.t / 0.8));
        h.neck.rotation.z += sin(t * 21 + seed) * 0.09 * fr * j; h.neck.rotation.y += sin(t * 17 + seed * 2) * 0.1 * fr * j;
      } else {
        action(h, pk.kind, pk.t, false, _zps);
        if (PUNCH_K[pk.kind]) { _zps.action = pk.kind; _zps.t = pk.t; _zps.time = t; fistIK(h, _zps, Math.min(1, pk.t / 0.08 + 0.3)); }
      }
    }
    if (s.bslam != null) keyPose(h, FERAL.bslam, s.bslam);
    if (s.tthrow != null) { h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.1, 0.7); keyPose(h, FERAL.tthrow, s.tthrow); }
    if (s.hpose && FERAL[s.hpose.kind]) {
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.1, 0.7);
      keyPose(h, FERAL[s.hpose.kind], s.hpose.t);
      // mordiendo: sacudidas violentas de la cabeza y los hombros
      if (s.hpose.kind === 'H_kill' && s.hpose.t > 0.4 && s.hpose.t < 0.82) {
        const j = sin(t * 31) * 0.14, j2 = sin(t * 23 + 1) * 0.1;
        h.neck.rotation.z += j; h.neck.rotation.y += j2; h.spine.rotation.z += j2 * 0.5; h.chest.rotation.y += j * 0.6;
      }
    }
    // tras lanzarse: el brazo derecho barre hacia abajo cruzando el cuerpo; si te alcanzó, el izquierdo
    // se queda agarrado a tu hombro un momento; luego se recupera
    if (s.strike != null) {
      const k = s.strike;
      const sw = U.smooth(k / 0.35) * (1 - U.smooth((k - 0.55) / 0.45));
      const rec = 1 - U.smooth(k);
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.5, rec);
      h.armR.rotation.x = U.lerp(-1.5, -0.45, sw); h.armR.rotation.z = U.lerp(0.1, 0.55, sw);
      h.foreR.rotation.x = -0.25 - 0.4 * sw;
      h.chest.rotation.y += 0.45 * sw; h.spine.rotation.y += 0.15 * sw;
      if (s.strikeHit) {
        const g = 1 - U.smooth((k - 0.45) / 0.35);
        h.armL.rotation.x = U.lerp(h.armL.rotation.x, -1.45, g); h.armL.rotation.z = U.lerp(h.armL.rotation.z, -0.15, g);
        h.foreL.rotation.x = U.lerp(h.foreL.rotation.x, -0.7, g);
      } else {
        // falló: el impulso lo lleva un paso de más
        h.legL.rotation.x -= 0.4 * rec; h.shinL.rotation.x += 0.3 * rec;
      }
      h.legR.rotation.x += 0.3 * rec; h.toeR.rotation.x -= 0.4 * rec;
    }
    // corredor que te acaba de ver: se yergue, echa la cabeza atrás y chilla
    if (s.alert > 0) {
      const k = sin(Math.PI * Math.min(1, s.alert));
      const sh = sin(t * 45) * 0.06 * k;
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, -0.2, k);
      h.neck.rotation.x = -0.45 * k + sh; h.head.rotation.x = -0.35 * k;
      h.armL.rotation.z = 0.9 * k; h.armR.rotation.z = -0.9 * k;
      h.armL.rotation.x = -0.5 * k; h.armR.rotation.x = -0.5 * k;
      h.foreL.rotation.x = -1.2 * k; h.foreR.rotation.x = -1.2 * k;
    }
    if (s.bang) {
      const b = max(0, sin(s.bang * 9));
      h.armL.rotation.x = -1.4 - 0.4 * b; h.armR.rotation.x = -1.4 - 0.4 * max(0, sin(s.bang * 9 + 1.5));
      h.spine.rotation.x = 0.25 + 0.08 * b;
    }
    // reacción a un golpe: un tirón seco en cabeza y torso que vuelve como un resorte, encima del
    // cuerpo que trastabilla (pasos cortos, rodillas que ceden) según el tipo de golpe
    if (s.stagger > 0) reactPose(h, s.react, Math.min(1, s.stagger), s.reactDur || 0.55, s.flinch || 1);
    if (s.grabbed != null) {
      // agarrado por la espalda: forcejea con los brazos hacia atrás y la cabeza echada atrás; al final se afloja
      const g = s.grabbed, fade = 1 - win(g, 0.5, 0.8) * 0.85, limp = win(g, 0.72, 0.95);
      const f1 = sin(t * 13 + seed), f2 = sin(t * 11 + 1.3 + seed);
      h.armL.rotation.x = U.lerp(-2.0 + 0.5 * f1 * fade, -0.3, limp); h.armL.rotation.z = U.lerp(0.5 + 0.25 * f2 * fade, 0.15, limp);
      h.armR.rotation.x = U.lerp(-1.8 + 0.5 * f2 * fade, -0.3, limp); h.armR.rotation.z = U.lerp(-0.5 - 0.25 * f1 * fade, -0.15, limp);
      h.foreL.rotation.x = U.lerp(-1.0, -0.2, limp); h.foreR.rotation.x = U.lerp(-1.1, -0.2, limp);
      h.spine.rotation.x = U.lerp(-0.22, 0.3, limp); h.neck.rotation.x = U.lerp(-0.35, 0.5, limp);
      h.head.rotation.x = U.lerp(-0.25 + 0.12 * f1 * fade, 0.4, limp); h.neck.rotation.z = 0.15 * f2 * fade;
      h.legL.rotation.x = -0.15 + 0.3 * f1 * fade; h.shinL.rotation.x = 0.45;
      h.legR.rotation.x = 0.3 * f2 * fade; h.shinR.rotation.x = 0.35 + 0.3 * limp;
      h.hips.position.y -= 0.1 + 0.1 * limp;
    }
    // ciego: va encorvado, con la cabeza ladeada (escucha) y las manos crispadas a la altura del pecho;
    // al cazar abre los brazos y se lanza con pasos largos
    if (s.blind && s.atk == null && s.strike == null && s.stagger <= 0 && s.held == null && s.grapple == null && !s.stun && s.bslam == null && !s.punch) {
      const q = sin(s.phase), ch = s.chase ? 1 : 0, lis = sin(t * 0.9 + seed);
      h.spine.rotation.x = 0.42 + 0.06 * sin(s.phase * 2) + 0.12 * ch;
      h.spine.rotation.z += 0.06 * q;
      h.neck.rotation.x = -0.12 - 0.12 * ch; h.head.rotation.x = 0.05;
      h.neck.rotation.z = 0.38 * lis * (1 - 0.6 * ch) + 0.08; h.neck.rotation.y = 0.35 * sin(t * 0.55 + seed * 3) * (1 - 0.7 * ch);
      const op = 0.35 + 0.45 * ch;
      h.armL.rotation.x = -0.6 - 0.25 * ch + q * (0.12 + 0.3 * ch); h.armR.rotation.x = -0.65 - 0.25 * ch - q * (0.12 + 0.3 * ch);
      h.armL.rotation.z = op; h.armR.rotation.z = -op;
      h.foreL.rotation.x = -1.55 + 0.5 * ch + 0.12 * sin(t * 6.3 + seed); h.foreR.rotation.x = -1.5 + 0.5 * ch + 0.12 * sin(t * 5.1 + seed);
      h.handL.rotation.x = 0.45; h.handR.rotation.x = 0.45; h.handL.rotation.z = -0.3; h.handR.rotation.z = 0.3;
      h.hips.position.y -= 0.05 + 0.03 * ch;
      h.legL.rotation.x -= 0.12; h.legR.rotation.x -= 0.12; h.shinL.rotation.x += 0.22; h.shinR.rotation.x += 0.22;
    }
    // aturdido (empujado, ladrillazo, esquivado): un latigazo atrás y luego se encoge con las manos en la
    // cara, tambaleándose con pasitos y las rodillas flojas
    if (s.stun) {
      const u = s.stun.t, dur = s.stun.dur || 1.5;
      const k = U.smooth(c01(u / 0.22)) * (1 - U.smooth(c01((u - dur + 0.28) / 0.28)));
      const jolt = Math.exp(-u * 6) * c01(u / 0.05);
      const sw1 = sin(t * 2.6 + seed), sw2 = sin(t * 1.7 + seed * 2), stp = sin(t * 5.5 + seed);
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.4 + 0.08 * sw2, k) - 0.55 * jolt;
      h.spine.rotation.z += 0.13 * sw1 * k; h.spine.rotation.y += 0.12 * sw2 * k;
      h.neck.rotation.x = U.lerp(h.neck.rotation.x, 0.32, k) - 0.5 * jolt; h.head.rotation.x = U.lerp(h.head.rotation.x, 0.18, k) - 0.3 * jolt;
      h.neck.rotation.z = U.lerp(h.neck.rotation.z, 0.28 * sw2, k); h.neck.rotation.y = U.lerp(h.neck.rotation.y, 0.3 * sin(t * 1.3 + seed), k);
      const L = (b, x, y, z) => { const r = h[b].rotation; r.x = U.lerp(r.x, x, k); r.y = U.lerp(r.y, y, k); r.z = U.lerp(r.z, z, k); };
      L('armL', -1.12 + 0.08 * sw1, 0, -0.38); L('foreL', -2.15, 0, 0); L('handL', 0.4, 0, 0);
      L('armR', -1.08 - 0.08 * sw1, 0, 0.38); L('foreR', -2.1, 0, 0); L('handR', 0.4, 0, 0);
      h.armL.rotation.z += 0.9 * jolt; h.armR.rotation.z -= 0.9 * jolt;
      h.hips.position.y -= (0.07 + 0.03 * max(0, sw2)) * k;
      h.hips.rotation.z += 0.06 * sw1 * k;
      h.legL.rotation.x += (-0.25 + 0.22 * stp) * k + 0.35 * jolt; h.legR.rotation.x += (-0.2 - 0.22 * stp) * k + 0.2 * jolt;
      h.shinL.rotation.x += (0.4 + 0.25 * max(0, stp)) * k; h.shinR.rotation.x += (0.38 + 0.25 * max(0, -stp)) * k;
    }
    // forcejeo: te tiene agarrada por los hombros y empuja la cabeza hacia tu cuello para morder
    if (s.grapple != null) {
      const g = s.grapple, e = U.smooth(c01(g / 0.15));
      const bite = s.maul ? Math.pow(max(0, sin(g * 12)), 2) * 1.35 : Math.pow(max(0, sin(g * 8.5)), 3);
      const sh = sin(t * 29 + seed) * 0.05, sh2 = sin(t * 23 + seed) * 0.05;
      const L = (b, x, y, z) => { const r = h[b].rotation; r.x = U.lerp(r.x, x, e); r.y = U.lerp(r.y, y, e); r.z = U.lerp(r.z, z, e); };
      L('armL', -1.5 + sh, 0, -0.42); L('foreL', -0.78, 0, 0);
      L('armR', -1.45 + sh2, 0, 0.42); L('foreR', -0.82, 0, 0);
      h.spine.rotation.x = U.lerp(h.spine.rotation.x, 0.3 + 0.12 * bite, e);
      h.neck.rotation.x = U.lerp(h.neck.rotation.x, -0.15 + 0.38 * bite, e); h.head.rotation.x = U.lerp(h.head.rotation.x, -0.22 + 0.16 * bite, e);
      h.neck.rotation.y += 0.25 * sin(g * 3.1 + seed) * e; h.neck.rotation.z += 0.2 * sin(g * 2.3) * e;
      h.spine.rotation.z += sh * e; h.chest.rotation.y += sh2 * e;
      h.hips.position.y -= 0.05 * e;
      h.legL.rotation.x += -0.45 * e; h.shinL.rotation.x += 0.35 * e;
      h.legR.rotation.x += 0.4 * e; h.shinR.rotation.x += 0.25 * e; h.toeR.rotation.x -= 0.5 * e;
    }
    // remates: el infectado sigue los mismos tiempos que la protagonista (KZ)
    if (s.held && KZ[s.held.kind]) keyPose(h, KZ[s.held.kind], s.held.t);
    if (s.corpse && KZ[s.corpse.kind]) keyPose(h, KZ[s.corpse.kind], s.corpse.t);
    // garras: dedos medio cerrados; se abren al estirarse para agarrar
    let claw = 0.65 + 0.15 * sin(t * 2 + seed) - 0.45 * (s.reach || 0) * (1 - max(0, (s.reach || 0) - 0.85) * 6) + (s.grapple != null ? 0.35 : 0);
    if (s.punch || s.bslam != null || s.tthrow != null) claw = 0.2 + 0.25 * sin(t * 9 + seed);           // garras abiertas al golpear
    h.fingL.rotation.z = -claw; h.fingR.rotation.z = claw;
    // hombros: hacia delante al estirar los brazos
    const reachUp = Math.max(s.chase ? 0.6 : (s.armsUp || 0), s.reach || 0, s.grapple != null ? 0.8 : 0);
    h.clavL.rotation.y = -0.28 * reachUp; h.clavR.rotation.y = 0.28 * reachUp;
    h.clavL.rotation.z = 0.06 * sw; h.clavR.rotation.z = 0.06 * sw;
    if (s.punch) { const fr = s.runner && !s.temb ? 1 : 0.5, j = sin(Math.PI * c01(s.punch.t / 0.8)); h.clavL.rotation.z += sin(t * 13 + seed) * 0.08 * fr * j; h.clavR.rotation.z -= sin(t * 15 + seed) * 0.08 * fr * j; }
    // brazos separados del cuerpo (como en los jugables): que no se metan en la cadera
    if (!s.held && !s.corpse && !s.punch && s.grapple == null) { const ao = armSpread(h, spr); h.armL.rotation.z += ao; h.armR.rotation.z -= ao; }
    distributeSpine(h);
    // saltar una valla o una ventana: la animación grabada (HumanJumping), la misma de los jugables
    if (s.jump != null && G.Clips && G.Clips.jump) playClip(h, G.Clips.jump, s.jump, 0.12);
    blend(h, s.dt, s.punch || s.burn || s.jump != null ? 30 : ((s.stagger > 0 || s.reach > 0.2 || s.grabbed != null || s.grapple != null || s.held) ? 22 : (s.stun ? 14 : 9)));
    // en un remate, su cabeza se aparta de la de ella (por encima de su hombro)
    if (s.held && s.held.by) { clutchIK(h, s, t); headClear(h, s.held.by, 1, 0.6); }
    // sus zarpazos llegan de verdad al cuerpo de ella (como los golpes de ella)
    if (s.punch && s.punch.tgt && !s.temb) {
      _zc.action = 'z_' + s.punch.kind; _zc.t = s.punch.t; _zc.contact = _zcc;
      _zcc.m = s.punch.tgt; _zcc.impact = s.punch.imp || 0.42; _zcc.hitOK = true;
      contactIK(h, _zc);
      headClear(h, s.punch.tgt, 1, 1);
    }
    // espasmos (después de suavizar, para que sean secos)
    const tw = s.twitch || 0;
    if (tw > 0.01) {
      const j = tw * tw, jit = sin(t * 57 + seed) * 0.07 * j;
      switch (s.twitchKind | 0) {
        case 0: h.neck.rotation.z += 0.5 * j + jit; h.head.rotation.x -= 0.35 * j; break;          // cabeza a un lado
        case 1: h.clavL.rotation.z += 0.4 * j; h.armL.rotation.z += 0.35 * j + jit; break;          // hombro que se encoge
        case 2: h.neck.rotation.y += 0.7 * j; h.head.rotation.z -= 0.35 * j + jit; break;           // giro brusco de cabeza
        default: h.spine2.rotation.z -= 0.18 * j; h.chest.rotation.y += 0.3 * j; h.clavR.rotation.z -= 0.35 * j + jit; // sacudida del torso
      }
    }
  }

  // Tumbado: f de 0 (de pie) a 1 (en el suelo). dir = -1 de espaldas, 1 boca abajo
  function poseFall(h, f, dir) {
    const a = dir * Math.PI / 2 * U.smooth(f);
    h.body.rotation.x = a;
    h.body.position.y = 0.12 * U.smooth(f);
    h.body.position.z = 0;
    if (f > 0.5) {
      h.armL.rotation.z = 0.6; h.armR.rotation.z = -0.5;
      h.armL.rotation.x = dir > 0 ? -0.2 : 0.3; h.armR.rotation.x = dir > 0 ? -0.3 : 0.2;
      h.legL.rotation.z = 0.12; h.legR.rotation.z = -0.1;
      h.head.rotation.y = 0.4;
    }
  }

  // ---------- Armas (modelos) ----------
  const geoCache = {};
  // Pieza blanda de la mochila: secciones superelípticas [y, ancho, fondo, forma] centradas en (cx, cz)
  function bagLoft(m, T, cx, cz, N, dy, col, Y, capA, capB) {
    const rings = [];
    const y0 = T[0][0], y1 = T[T.length - 1][0];
    const n = Math.max(2, Math.round((y1 - y0) / dy));
    for (let k = 0; k <= n; k++) {
      const y = y0 + (y1 - y0) * k / n;
      const [w, d, e] = curve(T, y);
      const r = [];
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), q = 2 / e;
        const x = cx + w * Math.sign(c) * Math.pow(Math.abs(c), q), z = cz + d * Math.sign(s) * Math.pow(Math.abs(s), q);
        r.push({ p: [x, y + Y, z], c: col(x, y, z), w: null });
      }
      rings.push(r);
    }
    const cap = (y) => ({ p: [cx, y + Y, cz], c: col(cx, y, cz), w: null });
    surface(m, rings, capA != null ? cap(capA) : null, capB != null ? cap(capB) : null);
  }

  // Cinta de sección rectangular que sigue un camino [y, z] en el plano x (correas)
  function ribbon(m, x, path, wd, th, hex, Y) {
    const c = G.Mesher.lin(hex), col = [c.r, c.g, c.b];
    const F = path.map((p, i) => {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      let ty = b[0] - a[0], tz = b[1] - a[1];
      const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l;
      // normal hacia afuera del cuerpo (perpendicular al camino, en el plano y-z)
      const ny = -tz, nz = ty;
      return { y: p[0] + Y, z: p[1], ny, nz };
    });
    const hw = wd / 2;
    const P = (f, sx, o) => [x + sx * hw, f.y + f.ny * o, f.z + f.nz * o];
    const quad = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) m.vert(v, n, col, null); };
    for (let i = 0; i < F.length - 1; i++) {
      const f = F[i], g = F[i + 1];
      const o0 = 0.002, o1 = 0.002 + th;
      const nOut = [0, (f.ny + g.ny) / 2, (f.nz + g.nz) / 2];
      quad(P(f, -1, o1), P(f, 1, o1), P(g, 1, o1), P(g, -1, o1), nOut);
      quad(P(f, 1, o1), P(f, 1, o0), P(g, 1, o0), P(g, 1, o1), [1, 0, 0]);
      quad(P(f, -1, o0), P(f, -1, o1), P(g, -1, o1), P(g, -1, o0), [-1, 0, 0]);
    }
  }


  // Mochila puesta (en el espacio del hueso del pecho, a 1,33 m del suelo), con un estilo por personaje:
  //   ''      la de lona marrón con el saco de dormir abajo (Vera y los demás)
  //   tomas   mochila de excursión vieja, roja desteñida con el fondo gris, el saco enrollado ARRIBA,
  //           un solo bolsillo con cremallera vertical y una taza colgando de un mosquetón
  //   camo    mochila militar cuadrada de camuflaje (Booster): tapa con dos hebillas, dos portacargadores
  //           a los lados y una cinta con un parche
  //   paula   morral de cuero viejo, chico, con un bidón rojo de combustible atado abajo
  // P: perfil del cuerpo (para que las correas sigan la remera) y bw: ancho del torso (complexión)
  const packCache = {};
  function packGeometry(style, P, bw) {
    const key = (style || 'base') + '|' + (P === PROF_F ? 'F' : 'M') + '|' + bw.toFixed(3);
    if (packCache[key]) return packCache[key];
    const m = new G.Mesher();
    const prevP = ACTIVE_P; ACTIVE_P = P;
    const Y = -1.33;
    // la superficie del torso con la complexión (el ancho y el fondo crecen con bw alrededor del centro)
    const torso = (x, y) => {
      const t = heroTorsoZ(x / bw, y);
      if (!t) return null;
      const zc = curve(P.TT, y)[3];
      return { zf: zc + (t.zf - zc) * bw, zb: zc + (t.zb - zc) * bw };
    };
    ACTIVE_P = PROF_M; const ref = heroTorsoZ(0, 1.2); ACTIVE_P = P;
    const back = torso(0, 1.2), dz = back && ref ? Math.min(0.03, back.zb - ref.zb) : 0;     // la mochila se apoya en la espalda
    const cz = -0.2 + dz;
    const dirty = (base, k) => (x, y, z) => mixC(mulC(LC(base), 0.9 + 0.18 * fbm(x * 16, y * 16 + 2, z * 16)), LC(0x4a3f30), k * sat(fbm(x * 9 + 7, y * 9, z * 9) * 1.6 - 0.6));
    const camo = (x, y, z) => {
      const n1 = fbm(x * 9 + 1, y * 9, z * 9), n2 = fbm(x * 11 + 7, y * 11 + 3, z * 11 + 5);
      let c = LC(0x58603d);
      if (n1 > 0.58) c = LC(0x3a3a2a); else if (n2 > 0.6) c = LC(0x7b6c48); else if (n1 < 0.38) c = LC(0x2b3324);
      return mixC(mulC(c, 0.9 + 0.15 * fbm(x * 30, y * 30, z * 30)), LC(0x4a4434), 0.25 * sat(fbm(x * 7, y * 7 + 4, z * 7) * 1.6 - 0.6));
    };
    let strapCol = 0x4b3f2b, strapTop = 1.36, strapZ = -0.13, ownStraps = false;
    // sección ochavada de caras planas (mochilas low poly, para los personajes de malla)
    const sect = (y, w, d, zc, N) => {
      const r = [];
      for (let i = 0; i < N; i++) {
        const th = (i + 0.5) / N * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        r.push({ p: [w * Math.sign(c) * Math.min(1, Math.abs(c) * 1.3), y + Y, zc + d * Math.sign(sn) * Math.min(1, Math.abs(sn) * 1.3)], w: null });
      }
      return r;
    };
    const ctrAt = (y, zc) => ({ p: [0, y + Y, zc], w: null });
    if (style === 'tomas') {
      // Tomás (malla low poly): mochila roja de caras planas con fondo gris, bolsillo delantero con cremallera,
      // saco de dormir azul enrollado arriba con dos correas. Las correas de hombro ya vienen en su malla
      const R0 = 0x8a3d2e, R1 = 0x7a3428, GR = 0x4a4d50, BL = 0x3d5068, KK = 0x24201c;
      lpStrip(m, [[1.0, 0.115, 0.064], [1.05, 0.14, 0.08], [1.33, 0.142, 0.08], [1.43, 0.11, 0.06]].map(([y, w, d]) => sect(y, w, d, cz, 8)),
        (x, y) => (y - Y < 1.1 ? GR : R0), ctrAt(0.99, cz), ctrAt(1.44, cz));
      lpStrip(m, [[1.1, 0.085, 0.03], [1.14, 0.09, 0.038], [1.3, 0.085, 0.036], [1.34, 0.07, 0.026]].map(([y, w, d]) => sect(y, w, d, cz - 0.092, 8)),
        () => R1, ctrAt(1.095, cz - 0.092), ctrAt(1.345, cz - 0.092));                         // bolsillo delantero
      m.box(0.02, 1.22 + Y, cz - 0.132, 0.006, 0.2, 0.004, 0x1e1d1c);                    // cremallera
      m.box(0.02, 1.32 + Y, cz - 0.134, 0.012, 0.022, 0.006, 0x9a9890);                   // tirador
      m.cyl(0, 1.475 + Y, cz + 0.005, 0.052, 0.052, 0.33, BL, 6, undefined, 0, 0, Math.PI / 2);          // saco de dormir
      for (const sg of [1, -1]) m.cyl(0.1 * sg, 1.475 + Y, cz + 0.005, 0.057, 0.057, 0.02, KK, 6, undefined, 0, 0, Math.PI / 2);
      m.box(-0.13, 1.06 + Y, cz - 0.05, 0.022, 0.08, 0.012, 0x2a2622);                    // cinta de compresión
      strapCol = 0x2e2a28; strapTop = 1.36; ownStraps = true;
    } else if (style === 'camo') {
      // Booster (malla low poly): mochila militar de caras planas en verde oliva, tapa más oscura, dos
      // portacargadores al frente, cintas MOLLE, un parche y cantimploras a los costados
      const O0 = 0x58603d, O1 = 0x4a5134, O2 = 0x3e432c, DK = 0x2d2e22;
      lpStrip(m, [[1.0, 0.15, 0.075], [1.04, 0.165, 0.088], [1.38, 0.162, 0.086], [1.43, 0.13, 0.064]].map(([y, w, d]) => sect(y, w, d, cz - 0.008, 8)),
        (x, y) => (y - Y < 1.06 ? O2 : O0), ctrAt(0.995, cz - 0.008), null);
      lpStrip(m, [[1.33, 0.172, 0.094], [1.42, 0.16, 0.088], [1.455, 0.13, 0.068]].map(([y, w, d]) => sect(y, w, d, cz - 0.008, 8)),
        () => O1, null, ctrAt(1.462, cz - 0.008));                                            // tapa
      for (const sg of [1, -1]) {
        m.box(0.075 * sg, 1.155 + Y, cz - 0.115, 0.1, 0.17, 0.05, O1);                         // portacargador
        m.box(0.075 * sg, 1.235 + Y, cz - 0.143, 0.104, 0.03, 0.008, 0x38392a);                 // tapa del portacargador
        m.box(0.06 * sg, 1.3 + Y, cz - 0.1, 0.03, 0.14, 0.008, DK);                             // correas de la tapa
        m.box(0.06 * sg, 1.235 + Y, cz - 0.15, 0.034, 0.02, 0.01, 0x1b1b18);                    // hebillas
        m.cyl(0.178 * sg, 1.15 + Y, cz, 0.04, 0.04, 0.17, O2, 6);                               // cantimplora
        m.cyl(0.178 * sg, 1.24 + Y, cz, 0.042, 0.042, 0.02, 0x2b2e20, 6);
      }
      for (const yy of [1.3, 1.34]) m.box(0, yy + Y, cz - 0.096, 0.2, 0.012, 0.004, 0x30321f);
      m.box(0, 1.39 + Y, cz - 0.104, 0.06, 0.04, 0.004, 0x6c6a56);                            // parche
      m.box(0, 1.39 + Y, cz - 0.106, 0.044, 0.008, 0.002, 0x8a3226);
      strapCol = 0x33362a; strapTop = 1.36;
    } else if (style === 'vera') {
      // Vera (malla low poly): mochila gris carbón de caras planas. Cuerpo de sección ochavada apoyado en la
      // espalda de la malla, solapa que cae por encima con dos correas y sus hebillas, bolsillos laterales y
      // correas de hombro que siguen el contorno de la malla (medido en src/charmesh_vera.js)
      const C0 = 0x4d5055, C1 = 0x5b5e63, C2 = 0x37393d, BK = 0x8e9194, vz = -0.148;
      const sect = (y, w, d, zc, N) => {
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i + 0.5) / N * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
          r.push({ p: [w * Math.sign(c) * Math.min(1, Math.abs(c) * 1.3), y + Y, zc + d * Math.sign(sn) * Math.min(1, Math.abs(sn) * 1.3)], w: null });
        }
        return r;
      };
      const ctr = (y) => ({ p: [0, y + Y, vz], w: null });
      lpStrip(m, [[1.0, 0.128, 0.06], [1.05, 0.148, 0.072], [1.37, 0.153, 0.075], [1.44, 0.136, 0.064]].map(([y, w, d]) => sect(y, w, d, vz, 8)),
        (x, y) => (y - Y < 1.05 ? C2 : C0), ctr(0.995), null);                                          // cuerpo (arriba lo tapa la solapa)
      lpStrip(m, [[1.27, 0.162, 0.083], [1.41, 0.161, 0.082], [1.465, 0.146, 0.07]].map(([y, w, d]) => sect(y, w, d, vz, 8)),
        () => C1, null, ctr(1.478));                                                               // solapa
      for (const sg of [1, -1]) {
        m.box(0.056 * sg, 1.19 + Y, vz - 0.084, 0.026, 0.2, 0.008, C2);                            // correas de la solapa
        m.box(0.056 * sg, 1.235 + Y, vz - 0.09, 0.036, 0.03, 0.01, BK);                            // hebillas
        m.box(0.164 * sg, 1.14 + Y, vz, 0.032, 0.15, 0.1, C2);                                     // bolsillos laterales
        // correa de hombro: del pecho, por encima del hombro, hasta la mochila
        ribbon(m, 0.085 * sg, [[1.22, 0.1], [1.35, 0.121], [1.47, 0.056], [1.527, -0.022], [1.445, -0.104]], 0.034, 0.006, C2, Y);
      }
      ownStraps = true;
    } else if (style === 'paula') {
      // la señora Paula (malla low poly): mochila de cuero marrón de caras planas, como la de Vera. Cuerpo de
      // sección ochavada, solapa que cae por encima con su correa y hebilla de latón, y el bidón rojo de
      // combustible atado debajo, de lado
      const L0 = 0x5a3b26, L1 = 0x4a3120, L2 = 0x3b2618, ST = 0x2a1d14, BR = 0x9a8a5a, pz = cz + 0.012;
      const sect = (y, w, d, zc, N) => {
        const r = [];
        for (let i = 0; i < N; i++) {
          const th = (i + 0.5) / N * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
          r.push({ p: [w * Math.sign(c) * Math.min(1, Math.abs(c) * 1.3), y + Y, zc + d * Math.sign(sn) * Math.min(1, Math.abs(sn) * 1.3)], w: null });
        }
        return r;
      };
      const ctr = (y) => ({ p: [0, y + Y, pz], w: null });
      lpStrip(m, [[1.13, 0.104, 0.052], [1.17, 0.12, 0.064], [1.36, 0.12, 0.064], [1.41, 0.104, 0.054]].map(([y, w, d]) => sect(y, w, d, pz, 8)),
        (x, y) => (y - Y < 1.17 ? L2 : L0), ctr(1.125), null);                                          // cuerpo (arriba lo tapa la solapa)
      lpStrip(m, [[1.31, 0.128, 0.072], [1.4, 0.126, 0.07], [1.435, 0.108, 0.058]].map(([y, w, d]) => sect(y, w, d, pz, 8)),
        () => L1, null, ctr(1.446));                                                               // solapa
      m.box(0, 1.27 + Y, pz - 0.07, 0.03, 0.1, 0.008, ST);                                       // correa de la solapa
      m.box(0, 1.235 + Y, pz - 0.075, 0.026, 0.022, 0.01, BR);                                   // hebilla de latón
      for (const sg of [1, -1]) m.box(0.126 * sg, 1.24 + Y, pz, 0.016, 0.1, 0.09, L1);           // costuras laterales
      // bidón rojo de combustible atado debajo (de lado), con su tapa y las cintas
      m.box(0, 1.06 + Y, cz + 0.005, 0.24, 0.1, 0.09, 0x8e2a20);
      m.box(0, 1.06 + Y, cz + 0.005, 0.242, 0.03, 0.092, 0x6e1f18);
      m.box(0.13, 1.09 + Y, cz + 0.005, 0.03, 0.026, 0.026, 0x2a2a2a);
      for (const sg of [1, -1]) m.box(0.07 * sg, 1.06 + Y, cz + 0.005, 0.018, 0.106, 0.096, 0x2a221c);
      strapCol = 0x3a2a1e; strapTop = 1.36;
    } else {
          // en el espacio del hueso del pecho (que está a 1,33 m del suelo)
          const bp = 0x6b5a3e;
          // cuerpo de lona redondeado, tapa que cae por encima, bolsillo delantero y laterales,
          // correas con hebillas y saco de dormir enrollado abajo
          const canvas = (x, y, z) => mulC(LC(bp), 0.88 + 0.22 * fbm(x * 14 + 3, y * 14, z * 14));
          bagLoft(m, [[1.02, 0.12, 0.06, 3.2], [1.06, 0.15, 0.075, 3.6], [1.2, 0.156, 0.08, 3.6], [1.34, 0.15, 0.078, 3.4], [1.42, 0.13, 0.07, 3.0], [1.46, 0.09, 0.05, 2.6]],
            0, cz, 20, 0.02, dirty(bp, 0.5), Y, 1.01, 1.47);
          bagLoft(m, [[1.355, 0.16, 0.086, 3.2], [1.43, 0.142, 0.08, 3.0], [1.476, 0.1, 0.06, 2.6]],
            0, cz, 20, 0.02, dirty(0x5b4c34, 0.4), Y, null, 1.49);                                  // tapa
          bagLoft(m, [[1.07, 0.1, 0.028, 3.0], [1.12, 0.115, 0.04, 3.2], [1.22, 0.11, 0.038, 3.2], [1.26, 0.088, 0.028, 3.0]],
            0, cz - 0.092, 16, 0.02, dirty(0x62533a, 0.5), Y, 1.065, 1.265);                              // bolsillo delantero
          for (const sg of [1, -1]) {
            bagLoft(m, [[1.08, 0.03, 0.04, 2.6], [1.12, 0.04, 0.05, 2.8], [1.21, 0.038, 0.048, 2.8], [1.24, 0.03, 0.038, 2.6]],
              0.158 * sg, cz, 12, 0.02, dirty(0x62533a, 0.4), Y, 1.075, 1.245);                       // bolsillos laterales
            m.box(0.06 * sg, 1.3 + Y, cz - 0.087, 0.026, 0.13, 0.006, 0x3e3426);                          // correas de la tapa
            m.box(0.06 * sg, 1.235 + Y, cz - 0.1, 0.034, 0.022, 0.01, 0x2a2622);                           // hebillas
            m.cyl(0.11 * sg, 0.985 + Y, cz + 0.01, 0.062, 0.062, 0.022, 0x2e2822, 14, undefined, 0, 0, Math.PI / 2); // correas del saco
          }
          m.cyl(0, 0.985 + Y, cz + 0.01, 0.056, 0.056, 0.34, 0x4c5a46, 16, undefined, 0, 0, Math.PI / 2);   // saco de dormir
          m.cyl(0, 0.985 + Y, cz + 0.01, 0.035, 0.035, 0.35, 0x3c4838, 12, undefined, 0, 0, Math.PI / 2);
    }
    // correas: cintas que siguen la forma de la remera, del pecho al hombro y bajando a la mochila
    if (!ownStraps) for (const sg of [1, -1]) {
      const x = P.strapX * bw * sg, path = [];
      let top = 1.2;
      while (top < 1.6 && torso(x, top + 0.004)) top += 0.004;
      for (let y = 1.17; y < top; y += 0.025) path.push([y, torso(x, y).zf]);
      for (let k = 0; k <= 4; k++) {                  // por encima del hombro
        const a = (k / 4) * Math.PI, c = torso(x, top - 0.012);
        const zm = (c.zf + c.zb) / 2, rz = (c.zf - c.zb) / 2;
        path.push([top - 0.012 + Math.sin(a) * 0.014, zm + Math.cos(a) * rz]);
      }
      for (let y = top - 0.03; y > strapTop + 0.02; y -= 0.025) path.push([y, torso(x, y).zb]);
      path.push([strapTop, strapZ + dz]);
      ribbon(m, x, path, 0.036, 0.007, strapCol, Y);
      // hebilla y regulador en el pecho
      m.box(x, 1.24 + Y, torso(x, 1.24).zf + 0.009, 0.042, 0.026, 0.008, 0x2a2622);
    }
    ACTIVE_P = prevP;
    return (packCache[key] = m.build());
  }

  function weaponGeometry(id) {
    if (geoCache[id]) return geoCache[id];
    const m = new G.Mesher();
    const WOOD = 0x9a7046, DARKW = 0x6e4e30, METAL = 0x9aa0a6, DARKM = 0x55595e, RED = 0xa8322a, BLACK = 0x26262a, RUST = 0x7a5a3e;
    const nails = (y0, y1, r) => { for (let y = y0; y <= y1; y += 0.07) { m.box(0, y, 0, r * 2 + 0.07, 0.008, 0.008, DARKM); m.box(0, y + 0.035, 0, 0.008, 0.008, r * 2 + 0.07, DARKM); } };
    switch (id) {
      case 'bate': case 'bate_clavos':
        m.cyl(0, 0.2, 0, 0.018, 0.022, 0.4, WOOD, 8);
        m.cyl(0, 0.62, 0, 0.022, 0.036, 0.46, WOOD, 8);
        m.sphere(0, 0.85, 0, 0.036, 0.02, 0.036, WOOD, 1);
        m.cyl(0, 0.02, 0, 0.026, 0.026, 0.03, DARKW, 8);
        if (id === 'bate_clavos') nails(0.55, 0.82, 0.032);
        break;
      case 'golf':
        m.cyl(0, 0.12, 0, 0.016, 0.016, 0.24, BLACK, 8);
        m.cyl(0, 0.6, 0, 0.007, 0.01, 0.76, METAL, 6);
        m.box(0, 0.98, 0.04, 0.03, 0.05, 0.11, DARKM);
        break;
      case 'mazo':
        m.cyl(0, 0.38, 0, 0.018, 0.02, 0.76, WOOD, 8);
        m.box(0, 0.8, 0, 0.09, 0.09, 0.24, DARKM);
        break;
      case 'pala':
        m.cyl(0, 0.45, 0, 0.017, 0.017, 0.9, WOOD, 8);
        m.box(0, 0.04, 0, 0.1, 0.03, 0.03, BLACK);
        m.box(0, 1.0, 0, 0.22, 0.26, 0.012, DARKM);
        break;
      case 'tabla': case 'tabla_clavos':
        m.box(0, 0.5, 0, 0.09, 1.0, 0.025, 0xa98a62);
        if (id === 'tabla_clavos') for (let y = 0.65; y < 0.98; y += 0.08) m.box(0, y, 0, 0.12, 0.008, 0.008, DARKM);
        break;
      case 'palanca':
        m.cyl(0, 0.36, 0, 0.012, 0.012, 0.72, 0x3e3e42, 6);
        m.box(0, 0.73, 0.03, 0.02, 0.02, 0.07, 0x3e3e42, 0, 0, 0.5);
        break;
      case 'martillo':
        m.cyl(0, 0.16, 0, 0.014, 0.017, 0.32, WOOD, 8);
        m.box(0, 0.33, 0.01, 0.03, 0.03, 0.13, DARKM);
        break;
      case 'llave':
        m.box(0, 0.16, 0, 0.026, 0.32, 0.012, METAL);
        m.box(0, 0.34, 0, 0.06, 0.04, 0.02, METAL);
        break;
      case 'sarten':
        m.cyl(0, 0.1, 0, 0.012, 0.014, 0.2, BLACK, 8);
        m.cyl(0, 0.33, 0, 0.12, 0.13, 0.025, 0x3a3a3e, 14, 0, Math.PI / 2, 0, 0);
        break;
      case 'tubo':
        m.cyl(0, 0.31, 0, 0.018, 0.018, 0.62, 0x6c7176, 8);
        break;
      case 'rodillo':
        m.cyl(0, 0.04, 0, 0.012, 0.012, 0.08, WOOD, 6);
        m.cyl(0, 0.22, 0, 0.03, 0.03, 0.28, 0xc9a77c, 10);
        m.cyl(0, 0.4, 0, 0.012, 0.012, 0.08, WOOD, 6);
        break;
      case 'porra':
        m.cyl(0, 0.3, 0, 0.016, 0.019, 0.6, BLACK, 8);
        m.cyl(0, 0.14, 0.04, 0.012, 0.012, 0.09, BLACK, 6, 0, Math.PI / 2, 0, 0);
        break;
      case 'hacha_bombero':
        m.cyl(0, 0.44, 0, 0.018, 0.02, 0.88, RED, 8);
        m.box(0, 0.84, 0.07, 0.022, 0.14, 0.13, METAL);
        m.box(0, 0.84, -0.07, 0.02, 0.05, 0.12, DARKM);
        break;
      case 'hacha_mano':
        // hacha de mano (hachuela): mango corto de madera con la curva del agarre y una cabeza de cuña con
        // filo y un pequeño martillo atrás (antes el mango era el de una herramienta mucho más grande)
        m.cyl(0, 0.135, 0, 0.0145, 0.017, 0.29, WOOD, 8);
        m.cyl(0, 0.0, 0, 0.019, 0.019, 0.022, DARKW, 8);                       // remate del mango
        m.box(0, 0.255, 0.032, 0.022, 0.05, 0.05, DARKM);                        // ojo de la cabeza
        m.box(0, 0.255, 0.075, 0.016, 0.085, 0.045, METAL);                      // cuña
        m.box(0, 0.255, 0.1, 0.008, 0.095, 0.012, 0xc4c9ce);                     // filo
        m.box(0, 0.255, -0.012, 0.024, 0.036, 0.03, DARKM);                      // martillo
        break;
      case 'machete':
        m.cyl(0, 0.07, 0, 0.016, 0.016, 0.14, BLACK, 8);
        m.box(0, 0.4, 0.008, 0.006, 0.52, 0.05, METAL);
        break;
      case 'katana':
        m.cyl(0, 0.13, 0, 0.016, 0.016, 0.26, BLACK, 8);
        m.cyl(0, 0.27, 0, 0.04, 0.04, 0.012, 0xb59a52, 10);
        m.box(0, 0.64, 0.004, 0.005, 0.72, 0.03, 0xc4c9ce);
        break;
      case 'ladrillo': {
        // ladrillo macizo con los cantos gastados y restos de mortero
        const BR = 0x9a4f36;
        m.box(0, 0.03, 0.01, 0.065, 0.1, 0.045, BR);
        m.box(0, 0.03, 0.01, 0.068, 0.092, 0.04, U.shade(BR, 0.88));
        m.box(0.02, 0.078, 0.02, 0.02, 0.006, 0.012, 0xb9b2a2);
        m.box(-0.015, -0.02, -0.005, 0.03, 0.005, 0.02, 0xb2ab9a);
        break;
      }
      case 'botella':
        // botella de vidrio verde oscuro, cuello largo
        m.cyl(0, 0.0, 0, 0.032, 0.032, 0.13, 0x2d5a32, 10);
        m.cyl(0, 0.08, 0, 0.032, 0.013, 0.035, 0x2d5a32, 10);
        m.cyl(0, 0.125, 0, 0.012, 0.012, 0.06, 0x3a6a40, 8);
        m.cyl(0, -0.02, 0, 0.0335, 0.0335, 0.05, 0xc9bf9a, 10);   // etiqueta
        break;
      case 'molotov':
        // molotov: la botella verde con un trapo metido en el cuello que cuelga por un lado
        m.cyl(0, 0.0, 0, 0.032, 0.032, 0.13, 0x2d5a32, 10);
        m.cyl(0, 0.08, 0, 0.032, 0.013, 0.035, 0x2d5a32, 10);
        m.cyl(0, 0.125, 0, 0.012, 0.012, 0.06, 0x3a6a40, 8);
        m.cyl(0, 0.165, 0, 0.016, 0.01, 0.04, 0xc9b98e, 6);
        m.box(0.018, 0.13, 0, 0.022, 0.07, 0.008, 0xb8a37a, 0, undefined, 0.3);
        m.box(0.03, 0.09, 0.005, 0.02, 0.05, 0.007, 0x9a8460, 0, undefined, 0.15);
        break;
      case 'navaja':
        // navaja automática: mango oscuro con remaches y hoja fina con punta
        m.box(0, 0.05, 0, 0.02, 0.105, 0.014, 0x2b2622);
        m.box(0, 0.05, 0.0075, 0.012, 0.08, 0.002, 0x4a4038);
        m.box(0, 0.104, 0, 0.022, 0.008, 0.016, 0x6a6a66);
        m.box(0, 0.15, 0.003, 0.0035, 0.085, 0.02, METAL);
        m.box(0, 0.198, 0.006, 0.003, 0.014, 0.011, METAL);
        break;
      case 'cuchillo':
        m.box(0, 0.06, 0, 0.022, 0.12, 0.016, BLACK);
        m.box(0, 0.2, 0.006, 0.004, 0.17, 0.035, METAL);
        break;
      case 'cuchillo_caza':
        m.box(0, 0.06, 0, 0.026, 0.12, 0.02, DARKW);
        m.box(0, 0.125, 0, 0.05, 0.012, 0.02, DARKM);
        m.box(0, 0.22, 0.006, 0.005, 0.18, 0.04, METAL);
        break;
      case 'destornillador':
        m.cyl(0, 0.05, 0, 0.016, 0.02, 0.1, 0xd0a42a, 8);
        m.cyl(0, 0.18, 0, 0.004, 0.004, 0.16, METAL, 6);
        break;
      case 'cuchilla':
        m.box(0, 0.06, 0, 0.024, 0.12, 0.018, DARKW);
        m.box(0, 0.22, 0.025, 0.005, 0.2, 0.09, METAL);
        break;
      case 'lanza':
        m.cyl(0, 0.75, 0, 0.016, 0.018, 1.5, WOOD, 8);
        m.box(0, 1.52, 0, 0.026, 0.04, 0.026, 0x6b6b6b);
        m.cone(0, 1.62, 0, 0.022, 0.18, METAL, 4);
        break;
      // ---- Armas de fuego: el cañón va a lo largo de +Y, la parte de arriba (miras) hacia -Z,
      // la empuñadura hacia +Z; el origen es donde agarra la mano derecha
      case 'pistola': case 'pistola_sil': {
        const GM = 0x2a2c2f, GM2 = 0x3d4044, GRIP = 0x3b3431;
        m.box(0, 0.07, -0.036, 0.027, 0.21, 0.033, GM);                  // corredera
        m.box(0, 0.045, -0.013, 0.023, 0.15, 0.016, GM2);                // armazón
        m.box(0, -0.025, 0.048, 0.026, 0.042, 0.1, GRIP, 0, 0, 0.3);     // empuñadura
        m.box(0, 0.028, 0.02, 0.006, 0.045, 0.006, GM);                  // guardamonte
        m.box(0, 0.168, -0.056, 0.005, 0.008, 0.007, GM);                // mira delantera
        m.box(0, -0.025, -0.056, 0.016, 0.008, 0.007, GM);               // mira trasera
        if (id === 'pistola_sil') m.cyl(0, 0.25, -0.036, 0.016, 0.016, 0.15, GM2, 10);
        break;
      }
      case 'escopeta': case 'escopeta_body': {
        const GM = 0x2b2c2e, GM2 = 0x45474b, W2 = 0x7a5232;
        m.box(0, 0.06, -0.026, 0.042, 0.2, 0.05, GM);                    // cajón de mecanismos
        m.cyl(0, 0.43, -0.039, 0.011, 0.011, 0.55, GM2, 8);              // cañón
        m.cyl(0, 0.34, -0.013, 0.01, 0.01, 0.38, GM, 8);                 // depósito
        m.box(0, -0.065, 0.025, 0.032, 0.1, 0.042, W2, 0, 0, 0.35);      // garganta
        m.box(0, -0.2, 0.014, 0.036, 0.24, 0.062, W2, 0, 0, -0.08);      // culata
        m.box(0, -0.325, 0.02, 0.039, 0.02, 0.072, BLACK);               // cantonera
        m.box(0, 0.0, 0.012, 0.006, 0.05, 0.006, GM);                    // guardamonte
        m.sphere(0, 0.7, -0.052, 0.004, 0.004, 0.004, METAL, 1);         // punto de mira
        if (id === 'escopeta') m.cyl(0, 0.3, -0.016, 0.022, 0.022, 0.16, W2, 8);
        break;
      }
      case 'revolver': {
        // revólver: tambor, cañón largo con la varilla debajo, empuñadura de madera y el martillo
        const GM = 0x2c2d30, GM2 = 0x4a4d52, WD = 0x6e4428;
        m.box(0, 0.035, -0.028, 0.026, 0.08, 0.036, GM);                 // armazón
        m.cyl(0, 0.04, -0.034, 0.021, 0.021, 0.052, GM2, 8);             // tambor
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; m.box(Math.cos(a) * 0.017, 0.04, -0.034 + Math.sin(a) * 0.017, 0.006, 0.054, 0.006, GM); }
        m.cyl(0, 0.135, -0.042, 0.0095, 0.0095, 0.16, GM2, 8);           // cañón
        m.box(0, 0.12, -0.029, 0.011, 0.11, 0.012, GM);                  // varilla
        m.box(0, -0.028, 0.045, 0.027, 0.045, 0.1, WD, 0, 0, 0.38);      // empuñadura
        m.box(0, -0.012, -0.055, 0.008, 0.022, 0.014, GM);               // martillo
        m.box(0, 0.02, 0.014, 0.006, 0.042, 0.006, GM);                  // guardamonte
        m.box(0, 0.205, -0.056, 0.004, 0.01, 0.008, GM);                 // mira
        break;
      }
      case 'doble': case 'doble_body': {
        // escopeta de doble cañón: dos cañones juntos, guardamanos de madera y la culata
        const GM = 0x2b2c2e, GM2 = 0x45474b, W2 = 0x6e4a2e;
        m.box(0, 0.035, -0.026, 0.046, 0.12, 0.05, GM);                  // báscula
        for (const sx of [-1, 1]) m.cyl(sx * 0.0115, 0.36, -0.036, 0.0115, 0.0115, 0.6, GM2, 8);
        m.box(0, 0.36, -0.05, 0.006, 0.58, 0.008, GM);                   // banda de arriba
        m.box(0, 0.24, -0.016, 0.044, 0.2, 0.03, W2);                    // guardamanos
        m.box(0, -0.06, 0.024, 0.032, 0.1, 0.044, W2, 0, 0, 0.35);       // garganta
        m.box(0, -0.2, 0.014, 0.036, 0.24, 0.062, W2, 0, 0, -0.08);      // culata
        m.box(0, -0.325, 0.02, 0.039, 0.02, 0.072, BLACK);               // cantonera
        m.box(0, 0.0, 0.012, 0.006, 0.05, 0.006, GM);                    // guardamonte
        m.box(0, 0.0, -0.05, 0.01, 0.02, 0.012, GM);                     // martillos
        m.sphere(0, 0.65, -0.055, 0.004, 0.004, 0.004, METAL, 1);
        break;
      }
      case 'subfusil': case 'subfusil_body': {
        // subfusil con silenciador: cajón negro, cargador recto, empuñadura delantera y culata plegable de varilla
        const GM = 0x222326, GM2 = 0x3a3c40;
        m.box(0, 0.08, -0.03, 0.034, 0.26, 0.05, GM);                    // cajón
        m.cyl(0, 0.33, -0.035, 0.019, 0.019, 0.24, GM2, 10);             // silenciador
        m.box(0, 0.1, 0.045, 0.022, 0.035, 0.11, GM2, 0, 0, -0.12);      // cargador
        m.box(0, -0.025, 0.04, 0.026, 0.04, 0.09, GM, 0, 0, 0.3);        // empuñadura
        m.box(0, 0.22, 0.03, 0.022, 0.03, 0.07, GM);                     // empuñadura delantera
        m.box(0, -0.14, -0.022, 0.006, 0.2, 0.006, GM2); m.box(0, -0.14, 0.012, 0.006, 0.2, 0.006, GM2);
        m.box(0, -0.245, -0.005, 0.02, 0.012, 0.05, GM);                 // cantonera
        m.box(0, 0.08, -0.06, 0.012, 0.12, 0.012, GM2);                  // riel
        break;
      }
      case 'lanzallamas': case 'lanzallamas_body': {
        // lanzallamas casero: tubo con boquilla, depósito rojo debajo, manguera, piloto encendido y dos empuñaduras
        const GM = 0x2f3032, GM2 = 0x55585c, RD = 0x9a2a22;
        m.cyl(0, 0.27, -0.03, 0.022, 0.022, 0.62, GM2, 10);              // tubo
        m.cyl(0, 0.6, -0.03, 0.03, 0.026, 0.06, GM, 10);                 // boquilla
        m.box(0, 0.6, -0.065, 0.012, 0.025, 0.014, 0xf0a030);            // piloto
        m.cyl(0, 0.12, 0.05, 0.045, 0.045, 0.26, RD, 12);                // depósito
        m.cyl(0, 0.255, 0.05, 0.02, 0.02, 0.02, GM, 8);
        m.box(0, -0.03, 0.04, 0.026, 0.04, 0.09, GM, 0, 0, 0.3);         // empuñadura
        m.box(0, 0.36, 0.035, 0.024, 0.03, 0.08, GM);                    // empuñadura delantera
        m.box(0, -0.16, -0.02, 0.03, 0.18, 0.05, GM);                    // culata corta
        for (let k = 0; k < 4; k++) m.cyl(0.03, 0.15 + k * 0.05, 0.0 + Math.sin(k) * 0.02, 0.008, 0.008, 0.055, 0x1c1c1c, 6);   // manguera
        break;
      }
      case 'mun_smg':
        // balas de subfusil: un cargador recto
        m.box(0, 0.08, -0.012, 0.03, 0.16, 0.024, 0x3a3c40);
        m.box(0, 0.165, -0.012, 0.018, 0.012, 0.014, 0xc9a24a);
        break;
      case 'mun_gas':
        // combustible: bidón rojo con asa y tapón
        m.box(0, 0.09, -0.05, 0.12, 0.17, 0.1, 0xa8322a);
        m.box(0, 0.19, -0.05, 0.08, 0.02, 0.03, 0x6a1c16);
        m.cyl(0.04, 0.19, -0.05, 0.012, 0.012, 0.03, 0x222222, 8);
        break;
      case 'escopeta_pump':
        m.cyl(0, 0, 0, 0.022, 0.022, 0.16, 0x7a5232, 8);
        for (let k = -2; k <= 2; k++) m.cyl(0, k * 0.025, 0, 0.0235, 0.0235, 0.008, 0x5e3f26, 8);
        break;
      case 'rifle': case 'rifle_body': {
        const GM = 0x2a2b2d, GM2 = 0x3f4245, W2 = 0x86562e;
        m.box(0, 0.14, -0.01, 0.036, 0.56, 0.04, W2);                    // caña de la culata
        m.box(0, -0.21, 0.026, 0.038, 0.24, 0.07, W2, 0, 0, -0.06);      // culata
        m.box(0, -0.335, 0.03, 0.04, 0.02, 0.075, 0x3a2a20);             // cantonera
        m.box(0, -0.06, 0.03, 0.03, 0.09, 0.048, W2, 0, 0, 0.3);         // garganta
        m.cyl(0, 0.52, -0.03, 0.0085, 0.0105, 0.44, GM2, 8);             // cañón
        m.cyl(0, 0.07, -0.03, 0.014, 0.014, 0.22, GM, 8);                // cerrojo (cajón)
        m.box(0, 0.0, 0.012, 0.006, 0.05, 0.006, GM);                    // guardamonte
        m.cyl(0, 0.07, -0.088, 0.015, 0.015, 0.2, BLACK, 10);            // mira telescópica
        m.cyl(0, -0.05, -0.088, 0.021, 0.016, 0.05, BLACK, 10);
        m.cyl(0, 0.19, -0.088, 0.016, 0.023, 0.06, BLACK, 10);
        m.box(0, 0.0, -0.062, 0.012, 0.016, 0.02, GM);
        m.box(0, 0.14, -0.062, 0.012, 0.016, 0.02, GM);
        if (id === 'rifle') { m.box(-0.03, 0.0, -0.03, 0.045, 0.01, 0.01, GM); m.sphere(-0.055, 0.0, -0.026, 0.012, 0.012, 0.012, GM, 1); }
        break;
      }
      case 'rifle_bolt':
        m.box(-0.025, 0, 0, 0.045, 0.01, 0.01, 0x2a2b2d);
        m.sphere(-0.05, 0, 0.004, 0.012, 0.012, 0.012, 0x2a2b2d, 1);
        break;
      case 'arco': case 'arco_body': {
        // origen en la empuñadura (mano izquierda). Palas hacia -Z (arriba) y +Z (abajo); la flecha va por +Y
        const BW = 0x8a5a33, BW2 = 0x5d3c22;
        const pts = [[0, 0], [0.035, 0.17], [0.032, 0.34], [-0.005, 0.47], [-0.07, 0.56]];
        for (const sg of [-1, 1]) {
          for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k], b = pts[k + 1];
            const dy = b[0] - a[0], dz = (b[1] - a[1]) * sg;
            const L = Math.hypot(dy, dz);
            const r0 = 0.016 - k * 0.0025, r1 = 0.016 - (k + 1) * 0.0025;
            m.cyl(0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 * sg, r0, r1, L, BW, 6, 0, Math.atan2(dz, dy));
          }
        }
        m.box(0, 0.005, 0, 0.032, 0.045, 0.12, BW2);                      // empuñadura forrada
        if (id === 'arco') m.box(0, -0.07, 0, 0.003, 0.003, 1.12, 0xd8d0b8); // cuerda (en reposo)
        break;
      }
      case 'flecha':
        m.cyl(0, 0.36, 0, 0.0045, 0.0045, 0.72, 0x9a7a52, 5);
        m.cone(0, 0.745, 0, 0.009, 0.05, METAL, 4);
        for (let k = 0; k < 3; k++) {
          const a = k * Math.PI * 2 / 3;
          m.box(Math.cos(a) * 0.008, 0.07, Math.sin(a) * 0.008, 0.002, 0.09, 0.016, k ? 0xd9d2c0 : 0xb5352a, -a);
        }
        break;
      // ---- Munición y accesorios (en el suelo; -Z queda hacia arriba)
      case 'mun_9mm': case 'mun_cartucho': case 'mun_rifle': case 'mun_revolver': {
        // caja de munición abierta por arriba con los cartuchos asomando (y dos sueltos al lado): que se vea
        // que son balas y no un ladrillo. 9 mm: caja de cartón con las balas de punta de cobre; cartuchos:
        // caja roja con los cartuchos de plástico rojo y culote de latón; rifle: caja verde con balas largas;
        // revólver: caja amarilla con balas cortas de punta redonda
        const T = {
          mun_9mm: { col: 0x8a6b3a, w: 0.09, h: 0.07, d: 0.04, r: 0.0085, len: 0.03, tip: 0.014, n: 4, cs: 0xc9a24a, tp: 0xb06a3a },
          mun_cartucho: { col: 0x9c3528, w: 0.1, h: 0.065, d: 0.045, r: 0.0125, len: 0.05, tip: 0, n: 3, cs: 0xb02a22, tp: 0xc9a24a },
          mun_rifle: { col: 0x4c6a3a, w: 0.085, h: 0.075, d: 0.04, r: 0.0075, len: 0.05, tip: 0.024, n: 4, cs: 0xc9a24a, tp: 0xb06a3a },
          mun_revolver: { col: 0xb58a2a, w: 0.085, h: 0.065, d: 0.04, r: 0.009, len: 0.028, tip: 0.012, n: 4, cs: 0xc9a24a, tp: 0x9a9a92 }
        }[id];
        const zc = -T.d / 2;
        m.box(0, T.h / 2, zc, T.w, T.h, T.d, T.col);                         // la caja
        m.box(0, T.h * 0.42, -T.d - 0.0005, T.w * 0.8, T.h * 0.4, 0.002, 0xe6dcc0);   // etiqueta
        m.box(0, T.h * 0.42, -T.d - 0.0012, T.w * 0.6, 0.007, 0.002, 0x3a2e22);
        m.box(0, T.h - 0.004, zc, T.w + 0.004, 0.008, T.d + 0.004, 0x2a2622);  // borde de la boca
        // cartuchos asomando por la boca de la caja, en fila, bien visibles; y dos sueltos encima
        const shell = (x, y, z, ax) => {
          m.cyl(x, y + T.len / 2, z, T.r, T.r, T.len, T.cs, 10);
          if (id === 'mun_cartucho') m.cyl(x, y + 0.005, z, T.r * 1.1, T.r * 1.1, 0.011, T.tp, 10);
          else m.cone(x, y + T.len + T.tip / 2, z, T.r * 0.95, T.tip, T.tp, 10);
        };
        const step = (T.w - 2 * T.r - 0.006) / (T.n - 1);
        for (let k = 0; k < T.n; k++) shell(-T.w / 2 + T.r + 0.003 + k * step, T.h - 0.014 + (k % 2) * 0.008, zc);
        shell(-T.w * 0.18, T.h * 0.05, -T.d - T.r);
        shell(T.w * 0.22, T.h * 0.12, -T.d - T.r);
        break;
      }
      case 'flecha_exp':
        // flecha explosiva: la misma flecha con una carga atada detrás de la punta (cilindro con cinta roja)
        m.cyl(0, 0.36, 0, 0.0045, 0.0045, 0.72, 0x9a7a52, 5);
        m.cone(0, 0.745, 0, 0.009, 0.05, METAL, 4);
        m.cyl(0, 0.66, 0, 0.016, 0.016, 0.075, 0x5b5d52, 8);
        m.cyl(0, 0.66, 0, 0.0168, 0.0168, 0.016, 0xc6302a, 8);
        for (let k = 0; k < 3; k++) {
          const a = k * Math.PI * 2 / 3;
          m.box(Math.cos(a) * 0.008, 0.07, Math.sin(a) * 0.008, 0.002, 0.09, 0.016, k ? 0xd9d2c0 : 0xc6302a, -a);
        }
        break;
      case 'mun_flecha_exp':
        for (let k = -1; k <= 1; k += 2) {
          m.cyl(k * 0.022, 0.36, -0.012, 0.0045, 0.0045, 0.72, 0x9a7a52, 5);
          m.cone(k * 0.022, 0.745, -0.012, 0.009, 0.05, METAL, 4);
          m.cyl(k * 0.022, 0.66, -0.012, 0.016, 0.016, 0.075, 0x5b5d52, 8);
          m.cyl(k * 0.022, 0.66, -0.012, 0.0168, 0.0168, 0.016, 0xc6302a, 8);
        }
        break;
      case 'mun_flecha':
        for (let k = -1; k <= 1; k++) {
          m.cyl(k * 0.02, 0.36, -0.01, 0.0045, 0.0045, 0.72, 0x9a7a52, 5);
          m.cone(k * 0.02, 0.745, -0.01, 0.009, 0.05, METAL, 4);
          m.box(k * 0.02, 0.07, -0.018, 0.002, 0.09, 0.016, 0xb5352a);
        }
        break;
      case 'silenciador':
        m.cyl(0, 0.08, -0.017, 0.017, 0.017, 0.15, 0x3d4044, 10);
        break;
      // ---- curación y mochila (para los iconos; la mochila puesta va aparte)
      case 'mina': {
        // mina de presión: disco verde oliva con la placa de presión, el botón y un piloto rojo
        const RX = Math.PI / 2;
        m.cyl(0, 0, -0.005, 0.11, 0.115, 0.045, 0x4a4f3a, 18, undefined, RX);
        m.cyl(0, 0, -0.03, 0.08, 0.085, 0.012, 0x3a3d2e, 18, undefined, RX);
        m.cyl(0, 0, -0.04, 0.022, 0.022, 0.012, 0x9a9a88, 10, undefined, RX);
        m.box(0.07, 0, -0.03, 0.014, 0.014, 0.008, 0xd02a20);
        for (const a of [0, 2.09, 4.19]) m.box(Math.cos(a) * 0.105, Math.sin(a) * 0.105, -0.005, 0.02, 0.02, 0.05, 0x2f3226);
        break;
      }
      case 'humo':
        // bomba de humo: bote gris con banda blanca, tapa y palanca con la anilla
        m.cyl(0, 0.06, -0.035, 0.035, 0.035, 0.12, 0x6b6e70, 12);
        m.cyl(0, 0.06, -0.035, 0.0365, 0.0365, 0.02, 0xe2e2dc, 12);
        m.cyl(0, 0.13, -0.035, 0.026, 0.03, 0.02, 0x3a3a3a, 10);
        m.box(0.032, 0.095, -0.035, 0.008, 0.075, 0.02, 0x9a9a9a);
        m.cyl(0.02, 0.15, -0.035, 0.014, 0.014, 0.004, 0xb8b8b0, 10, undefined, Math.PI / 2);
        break;
      case 'polvo':
        // polvo reactivo: tarro amarillo con tapa negra y etiqueta de peligro
        m.cyl(0, 0.05, -0.04, 0.04, 0.04, 0.09, 0xd9c45a, 12);
        m.cyl(0, 0.1, -0.04, 0.042, 0.042, 0.018, 0x222222, 12);
        m.box(0, 0.05, -0.081, 0.04, 0.035, 0.003, 0xf0a020); m.box(0, 0.05, -0.083, 0.012, 0.012, 0.002, 0x111111);
        break;
      case 'clavos':
        // clavos: cajita de cartón abierta con un puñado de clavos asomando (y unos sueltos al lado)
        m.box(0, 0.05, -0.022, 0.1, 0.075, 0.044, 0x9c7a4c);
        m.box(0, 0.05, -0.0445, 0.07, 0.03, 0.002, 0xd8c79a);
        for (let k = 0; k < 7; k++) {
          const xx = -0.035 + k * 0.012, yy = 0.09 + (k % 3) * 0.006;
          m.cyl(xx, yy, -0.03 - (k % 2) * 0.01, 0.0025, 0.0025, 0.05, 0xa8adb2, 5, undefined, 0, 0, (k - 3) * 0.08);
          m.cyl(xx, yy + 0.026, -0.03 - (k % 2) * 0.01, 0.006, 0.006, 0.003, 0xa8adb2, 6);
        }
        m.cyl(0.075, 0.03, -0.006, 0.0025, 0.0025, 0.06, 0x9ca1a6, 5, undefined, 0, 0, 1.2);
        m.cyl(-0.07, 0.11, -0.006, 0.0025, 0.0025, 0.06, 0x9ca1a6, 5, undefined, 0, 0, -0.5);
        break;
      case 'chocolatina':
        // chocolatina: barrita envuelta (papel rojo con banda clara) con un extremo abierto y la onza a la vista
        m.box(0, 0.07, -0.012, 0.055, 0.13, 0.022, 0xb3302a);
        m.box(0, 0.075, -0.0235, 0.056, 0.04, 0.002, 0xe8dcc0);
        m.box(0, 0.145, -0.012, 0.048, 0.022, 0.018, 0x5a3420);
        m.box(0, 0.005, -0.012, 0.06, 0.01, 0.016, 0x9a2822);
        break;
      case 'tijeras':
        // tijeras: dos hojas cruzadas y los mangos rojos
        m.box(0.008, 0.13, -0.012, 0.012, 0.13, 0.004, 0xcfd2d4, 0, undefined, 0, 0.12);
        m.box(-0.008, 0.13, -0.016, 0.012, 0.13, 0.004, 0xbfc2c4, 0, undefined, 0, -0.12);
        m.box(0, 0.06, -0.014, 0.008, 0.008, 0.008, 0x555555);
        m.cyl(0.022, 0.025, -0.014, 0.022, 0.022, 0.008, 0xc8352a, 10, undefined, Math.PI / 2);
        m.cyl(-0.022, 0.025, -0.014, 0.022, 0.022, 0.008, 0xc8352a, 10, undefined, Math.PI / 2);
        break;
      case 'panuelo':
        // pañuelo doblado, con una franja de color
        m.box(0, 0.06, -0.01, 0.12, 0.12, 0.012, 0xe6e0ef);
        m.box(0, 0.06, -0.017, 0.12, 0.02, 0.003, 0x4a6fb8);
        m.box(0.04, 0.09, -0.018, 0.03, 0.03, 0.003, 0xd9d2e4);
        break;
      case 'botiquin':
        // botiquín: caja roja con la cruz blanca, asa arriba y la junta de la tapa
        m.box(0, 0.09, -0.04, 0.14, 0.18, 0.07, 0xc4302a);
        m.box(0, 0.09, -0.04, 0.142, 0.008, 0.072, 0x8a1f1a);
        m.box(0, 0.09, -0.077, 0.095, 0.03, 0.004, 0xf2efe6); m.box(0, 0.09, -0.077, 0.03, 0.095, 0.004, 0xf2efe6);
        m.box(0, 0.192, -0.04, 0.06, 0.016, 0.022, 0x3a3330); m.box(-0.026, 0.184, -0.04, 0.01, 0.014, 0.02, 0x3a3330); m.box(0.026, 0.184, -0.04, 0.01, 0.014, 0.02, 0x3a3330);
        break;
      case 'venda': case 'venda_d':
        m.cyl(0, 0.05, -0.04, 0.04, 0.04, 0.1, 0xe9e4d6, 12);
        m.cyl(0, 0.05, -0.04, 0.015, 0.015, 0.102, 0xb9b2a0, 8);
        m.box(0, 0.16, -0.075, 0.09, 0.14, 0.004, 0xe2dccc, 0, undefined, -0.25);
        if (id === 'venda_d') { m.box(0, 0.05, -0.081, 0.05, 0.016, 0.004, 0xc23b2b); m.box(0, 0.05, -0.081, 0.016, 0.05, 0.004, 0xc23b2b); }
        break;
      case 'alcohol':
        // alcohol de farmacia: botella de plástico blanca y cuadrada, tapa azul y etiqueta con cruz roja
        // (bien distinta de la botella de vidrio verde que se lanza)
        m.box(0, 0.085, -0.04, 0.075, 0.17, 0.05, 0xeceae2);
        m.cyl(0, 0.185, -0.04, 0.03, 0.018, 0.03, 0xeceae2, 10);
        m.cyl(0, 0.212, -0.04, 0.02, 0.02, 0.028, 0x2f6fd0, 10);
        m.box(0, 0.08, -0.066, 0.06, 0.08, 0.004, 0x3d86e0);
        m.box(0, 0.08, -0.069, 0.04, 0.012, 0.003, 0xd8322a); m.box(0, 0.08, -0.069, 0.012, 0.04, 0.003, 0xd8322a);
        break;
      case 'trapo':
        // trapo doblado: dos capas algo torcidas y un pico que cuelga
        m.box(0, 0.08, -0.012, 0.15, 0.13, 0.012, 0xb9ad94, 0, undefined, 0.08);
        m.box(0.005, 0.085, -0.024, 0.14, 0.12, 0.01, 0xc8bea6, 0, undefined, -0.06);
        m.box(0.05, 0.16, -0.03, 0.06, 0.05, 0.008, 0xa89c84, 0, undefined, 0.5);
        break;
      case 'mochila_icon':
        m.box(0, 0.19, -0.07, 0.3, 0.38, 0.14, 0x6b5a3e);
        m.sphere(0, 0.37, -0.07, 0.15, 0.06, 0.075, 0x6b5a3e, 1);
        m.box(0, 0.08, -0.15, 0.22, 0.14, 0.05, 0x5b4d35);
        m.cyl(0, 0.0, -0.07, 0.06, 0.06, 0.26, 0x4a4436, 10, undefined, 0, 0, Math.PI / 2);
        break;
      case 'mochila_worn': return packGeometry('', PROF_M, 1);
      // montón genérico de cosas en el suelo (de pie, +Y arriba): un hatillo de tela con un mango asomando
      case 'monton':
        m.sphere(0, 0.1, 0, 0.2, 0.11, 0.16, 0x6b5a44, 1);
        m.sphere(0.05, 0.19, -0.02, 0.09, 0.07, 0.08, 0x5e4f3b, 1);
        m.sphere(0.06, 0.25, -0.02, 0.035, 0.03, 0.035, 0x4c4032, 1);
        m.cyl(-0.16, 0.12, 0.05, 0.016, 0.016, 0.34, 0x7a5a3e, 6, undefined, 0.2, 0, 1.1);
        m.box(0.14, 0.04, 0.12, 0.12, 0.07, 0.09, 0x8a6b3a, 0.5);
        break;
      default:
        m.cyl(0, 0.3, 0, 0.02, 0.02, 0.6, RUST, 6);
    }
    return (geoCache[id] = m.build());
  }

  G.MESH_VARS = MESH_VARS;
  G.Models = {
    createHumanoid, disposeHumanoid, setWeapon, setBackWeapon, setBackpack, setOutline, setLOD, legSpread,
    posePlayer, poseZombie, poseFall, poseRagdoll, reset,
    weaponGeometry, BI
  };
})(window.Game = window.Game || {});
