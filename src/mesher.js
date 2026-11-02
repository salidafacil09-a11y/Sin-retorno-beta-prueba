(function (G) {
  'use strict';

  // Acumula muchas piezas (cajas, cilindros, esferas, triángulos) en UNA sola
  // geometría con colores por vértice. Así un chunk entero o un personaje se
  // dibuja con muy pocas llamadas de dibujo, que es lo que más cuesta en móviles.

  const colorCache = new Map();
  function lin(hex) {
    let c = colorCache.get(hex);
    if (!c) { c = new THREE.Color(hex).convertSRGBToLinear(); colorCache.set(hex, c); }
    return c;
  }

  const prims = {};
  function prim(key, make) {
    if (!prims[key]) { const g = make(); prims[key] = g.index ? g.toNonIndexed() : g; }
    return prims[key];
  }

  const _m = new THREE.Matrix4();
  const _n = new THREE.Matrix3();
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _e = new THREE.Euler();

  // Junta los vértices exactamente iguales (posición, normal, color, huesos y pesos) y pone un índice
  function weld(g) {
    const names = ['position', 'normal', 'color', 'skinIndex', 'skinWeight'];
    const A = names.map((k) => g.attributes[k]);
    const n = A[0].count;
    const P = A[0].array, N = A[1].array;
    const pu = new Uint32Array(P.buffer, P.byteOffset, P.length), nu = new Uint32Array(N.buffer, N.byteOffset, N.length);
    const same = (a, b) => {
      for (const at of A) {
        const s = at.itemSize, r = at.array;
        for (let k = 0; k < s; k++) if (r[a * s + k] !== r[b * s + k]) return false;
      }
      return true;
    };
    const buckets = new Map();
    const remap = new Uint32Array(n), firsts = [];
    for (let i = 0; i < n; i++) {
      const h = (Math.imul(pu[i * 3], 73856093) ^ Math.imul(pu[i * 3 + 1], 19349663) ^ Math.imul(pu[i * 3 + 2], 83492791) ^ Math.imul(nu[i * 3] ^ nu[i * 3 + 2], 2654435761)) | 0;
      let b = buckets.get(h), found = -1;
      if (b) { for (let j = 0; j < b.length; j++) if (same(b[j], i)) { found = b[j]; break; } }
      if (found < 0) {
        if (b) b.push(i); else buckets.set(h, [i]);
        remap[i] = firsts.length; firsts.push(i);
      } else remap[i] = remap[found];
    }
    const m = firsts.length;
    if (m > n * 0.9) return;                  // (casi nada repetido: no vale la pena)
    for (let a = 0; a < A.length; a++) {
      const at = A[a], s = at.itemSize, src = at.array;
      const dst = new src.constructor(m * s);
      for (let j = 0; j < m; j++) { const o = firsts[j] * s; for (let k = 0; k < s; k++) dst[j * s + k] = src[o + k]; }
      g.setAttribute(names[a], new THREE.BufferAttribute(dst, s, at.normalized));
    }
    const index = m < 65536 ? new Uint16Array(n) : new Uint32Array(n);
    for (let i = 0; i < n; i++) index[i] = remap[i];
    g.setIndex(new THREE.BufferAttribute(index, 1));
  }

  // Mallas del mundo (suelo de una zona, paredes, techos, muebles): se arman triángulo a triángulo, así que cada
  // vértice se repite varias veces (una caja son 36 en vez de 24; un cilindro o una esfera, mucho más). Esto junta
  // los idénticos (misma posición, normal, color y textura, bit a bit) y pone un índice: se ve exactamente igual,
  // con bastantes menos vértices que la tarjeta gráfica tiene que procesar (y que iluminar: el material Lambert
  // calcula la luz en cada vértice). Usa solo tablas numéricas para no causar tirones al armar una zona.
  // NO usar en mallas cuyos vértices se editan por posición (las paredes derribables y las máquinas rompibles).
  function weldStatic(g) {
    if (!g || g.index || !g.attributes || !g.attributes.position) return g;
    const names = ['position', 'normal', 'color', 'uv'].filter((k) => g.attributes[k]);
    const at = names.map((k) => g.attributes[k]);
    for (const a of at) if (Object.prototype.toString.call(a.array) !== '[object Float32Array]' || a.count !== at[0].count) return g;
    const n = at[0].count;
    let stride = 0;
    for (const a of at) stride += a.itemSize;
    // una fila de bits por vértice con todos sus atributos: se compara y se calcula el hash sobre ella
    const K = new Uint32Array(n * stride);
    let off = 0;
    for (const a of at) {
      const s = a.itemSize, U = new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length);
      for (let i = 0; i < n; i++) for (let k = 0; k < s; k++) K[i * stride + off + k] = U[i * s + k];
      off += s;
    }
    let size = 1;
    while (size < n * 2) size <<= 1;
    const mask = size - 1, table = new Int32Array(size).fill(-1);
    const remap = new Uint32Array(n), firsts = [];
    for (let i = 0; i < n; i++) {
      const o = i * stride;
      // (hash tipo murmur3: los números «redondos» tienen ceros en los bits bajos y un hash simple los amontonaría)
      let h = 0;
      for (let k = 0; k < stride; k++) {
        let w = Math.imul(K[o + k], 0xcc9e2d51);
        w = (w << 15) | (w >>> 17);
        w = Math.imul(w, 0x1b873593);
        h ^= w;
        h = (h << 13) | (h >>> 19);
        h = (Math.imul(h, 5) + 0xe6546b64) | 0;
      }
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
      let slot = h & mask, found = -1;
      for (;;) {
        const t = table[slot];
        if (t < 0) break;
        const q = t * stride;
        let eq = true;
        for (let k = 0; k < stride; k++) if (K[q + k] !== K[o + k]) { eq = false; break; }
        if (eq) { found = t; break; }
        slot = (slot + 1) & mask;
      }
      if (found < 0) { table[slot] = i; remap[i] = firsts.length; firsts.push(i); } else remap[i] = remap[found];
    }
    const m = firsts.length;
    if (m > n * 0.9 || m >= 65536) return g;          // (casi nada repetido, o no cabe en índices de 16 bits)
    const names2 = names;
    for (let a = 0; a < at.length; a++) {
      const s = at[a].itemSize, src = at[a].array, dst = new Float32Array(m * s);
      for (let j = 0; j < m; j++) { const o = firsts[j] * s; for (let k = 0; k < s; k++) dst[j * s + k] = src[o + k]; }
      g.setAttribute(names2[a], new THREE.BufferAttribute(dst, s, at[a].normalized));
    }
    const index = new Uint16Array(n);
    for (let i = 0; i < n; i++) index[i] = remap[i];
    g.setIndex(new THREE.BufferAttribute(index, 1));
    return g;
  }

  // Lo mismo para una malla que ya viene con índice y en listas sueltas {p, n, col, uv, idx} (el suelo): las
  // esquinas que comparten dos casillas vecinas pasan a ser un solo vértice. Solo se juntan los idénticos en
  // posición, normal, color y coordenadas de textura.
  function dedupeIndexed(P) {
    const n = P.p.length / 3;
    const buckets = new Map(), remap = new Int32Array(n), first = [];
    const same = (a, b) => P.n[a * 3] === P.n[b * 3] && P.n[a * 3 + 1] === P.n[b * 3 + 1] && P.n[a * 3 + 2] === P.n[b * 3 + 2] &&
      P.col[a * 3] === P.col[b * 3] && P.col[a * 3 + 1] === P.col[b * 3 + 1] && P.col[a * 3 + 2] === P.col[b * 3 + 2] &&
      P.uv[a * 2] === P.uv[b * 2] && P.uv[a * 2 + 1] === P.uv[b * 2 + 1];
    for (let i = 0; i < n; i++) {
      const key = P.p[i * 3] + '|' + P.p[i * 3 + 1] + '|' + P.p[i * 3 + 2];
      const b = buckets.get(key);
      let f = -1;
      if (b) { for (let j = 0; j < b.length; j++) if (same(b[j], i)) { f = b[j]; break; } }
      if (f < 0) {
        if (b) b.push(i); else buckets.set(key, [i]);
        remap[i] = first.length; first.push(i);
      } else remap[i] = remap[f];
    }
    const m = first.length;
    if (m === n) return P;
    const p = new Array(m * 3), nn = new Array(m * 3), col = new Array(m * 3), uv = new Array(m * 2);
    for (let j = 0; j < m; j++) {
      const o = first[j];
      p[j * 3] = P.p[o * 3]; p[j * 3 + 1] = P.p[o * 3 + 1]; p[j * 3 + 2] = P.p[o * 3 + 2];
      nn[j * 3] = P.n[o * 3]; nn[j * 3 + 1] = P.n[o * 3 + 1]; nn[j * 3 + 2] = P.n[o * 3 + 2];
      col[j * 3] = P.col[o * 3]; col[j * 3 + 1] = P.col[o * 3 + 1]; col[j * 3 + 2] = P.col[o * 3 + 2];
      uv[j * 2] = P.uv[o * 2]; uv[j * 2 + 1] = P.uv[o * 2 + 1];
    }
    for (let k = 0; k < P.idx.length; k++) P.idx[k] = remap[P.idx[k]];
    P.p = p; P.n = nn; P.col = col; P.uv = uv;
    return P;
  }

  class Mesher {
    constructor(skinned) {
      this.pos = [];
      this.nor = [];
      this.col = [];
      this.skinned = !!skinned;
      this.si = [];
      this.ws = null;       // pesos explícitos por vértice (superficies continuas del protagonista)
      this.oy = 0;          // desplazamiento vertical de todo lo que se añade (altura del terreno o de la base de un edificio)
    }

    // Añade una geometría de Three.js transformada por "matrix"
    add(geo, matrix, hex, bone, jitter) {
      const c = lin(hex);
      const p = geo.attributes.position.array;
      const n = geo.attributes.normal.array;
      _n.getNormalMatrix(matrix);
      const jr = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
      for (let i = 0; i < p.length; i += 3) {
        _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(matrix);
        this.pos.push(_v.x, _v.y, _v.z);
        _v.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_n).normalize();
        this.nor.push(_v.x, _v.y, _v.z);
        this.col.push(c.r * jr, c.g * jr, c.b * jr);
        if (this.skinned) this.si.push(bone | 0);
      }
    }

    mat(x, y, z, sx, sy, sz, rx, ry, rz) {
      _e.set(rx || 0, ry || 0, rz || 0);
      _q.setFromEuler(_e);
      _p.set(x, y + this.oy, z);
      _s.set(sx, sy, sz);
      return _m.compose(_p, _q, _s);
    }

    // Caja centrada en (x, y, z)
    box(x, y, z, w, h, d, hex, ry, bone, rx, rz) {
      const g = prim('box', () => new THREE.BoxGeometry(1, 1, 1));
      this.add(g, this.mat(x, y, z, w, h, d, rx, ry, rz), hex, bone);
    }

    // Cilindro vertical centrado; r0 abajo, r1 arriba
    cyl(x, y, z, r0, r1, h, hex, seg, bone, rx, ry, rz) {
      seg = seg || 8;
      const key = 'cyl' + seg + '_' + (r0 / r1).toFixed(3);
      const g = prim(key, () => new THREE.CylinderGeometry(r1 / Math.max(r0, r1), r0 / Math.max(r0, r1), 1, seg));
      const s = Math.max(r0, r1);
      this.add(g, this.mat(x, y, z, s, h, s, rx, ry, rz), hex, bone);
    }

    // Esfera (o elipsoide) centrada
    sphere(x, y, z, sx, sy, sz, hex, detail, bone) {
      detail = detail || 1;
      const g = prim('ico' + detail, () => new THREE.IcosahedronGeometry(1, detail));
      this.add(g, this.mat(x, y, z, sx, sy, sz), hex, bone);
    }

    // Cono (para copas de árbol o puntas)
    cone(x, y, z, r, h, hex, seg, rx, ry, rz, bone) {
      seg = seg || 7;
      const g = prim('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg));
      this.add(g, this.mat(x, y, z, r, h, r, rx, ry, rz), hex, bone);
    }

    // Triángulo con normal calculada
    tri(a, b, c, hex) {
      const col = lin(hex);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (const p of [a, b, c]) {
        this.pos.push(p[0], p[1] + this.oy, p[2]);
        this.nor.push(nx, ny, nz);
        this.col.push(col.r, col.g, col.b);
        if (this.skinned) this.si.push(0);
      }
    }

    quad(a, b, c, d, hex) {
      this.tri(a, b, c, hex);
      this.tri(a, c, d, hex);
    }

    // Vértice suelto con normal, color lineal [r, g, b] y pesos [hueso, peso, ...] (hasta 4 huesos).
    // Se usa para superficies continuas (torso, brazos y piernas de una pieza) con normales suaves.
    vert(p, n, c, w) {
      this.pos.push(p[0], p[1] + this.oy, p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(c[0], c[1], c[2]);
      if (this.skinned) {
        if (!this.ws) this.ws = [];
        this.ws[this.si.length] = w;
        this.si.push(w[0] | 0);
      }
    }

    get count() {
      return this.pos.length / 3;
    }

    // weightFn(x, y, z, hueso) puede devolver [huesoA, pesoA, huesoB, pesoB] para
    // repartir un vértice entre dos huesos (piel suave en las articulaciones)
    build(weightFn) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      if (this.skinned) {
        const n = this.si.length;
        const idx = new Uint16Array(n * 4);
        const w = new Float32Array(n * 4);
        const P = this.pos;
        for (let i = 0; i < n; i++) {
          const ew = this.ws && this.ws[i];
          if (ew) {
            for (let k = 0; k < 4; k++) { idx[i * 4 + k] = ew[k * 2] || 0; w[i * 4 + k] = ew[k * 2 + 1] || 0; }
            continue;
          }
          const r = weightFn ? weightFn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], this.si[i]) : null;
          if (r) { idx[i * 4] = r[0]; w[i * 4] = r[1]; idx[i * 4 + 1] = r[2]; w[i * 4 + 1] = r[3]; }
          else { idx[i * 4] = this.si[i]; w[i * 4] = 1; }
        }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
        // personajes: los vértices repetidos (idénticos en todo) se juntan en uno y se dibuja con índices. Las
        // piezas se añaden triángulo a triángulo, así que cada vértice salía unas 6 veces: la tarjeta gráfica
        // calculaba los huesos de cada copia (también en las sombras). Se ve exactamente igual
        weld(g);
      }
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    }
  }

  G.Mesher = Mesher;
  G.Mesher.lin = lin;
  G.Mesher.weldStatic = weldStatic;
  G.Mesher.dedupeIndexed = dedupeIndexed;
})(window.Game = window.Game || {});
