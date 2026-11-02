(function (G) {
  'use strict';

  // Vegetación: árboles y pinos con tronco y ramas en 3D y hojas en láminas 2D con
  // transparencia; de lejos, cada árbol es una sola lámina que mira a la cámara.
  // Arbustos de láminas cruzadas y hierba alta al estilo de los shooters de móvil
  // (láminas cruzadas instanciadas que se encogen a lo lejos). Todo se mece con el viento.

  const U = G.Util;
  let R = null;
  const uTime = { value: 0 };
  let swapT = 0;

  // ---------- Texturas dibujadas en un canvas ----------
  function canvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }
  function tex(cv) {
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 2;
    return t;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Racimo de hojas: muchas hojitas en un círculo, más claras arriba
  function leafCanvas(size, n, leafW, seed, hue) {
    const cv = canvas(size, size), g = cv.getContext('2d');
    const r = rng(seed), C = size / 2;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * C * 0.9;
      const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
      const lit = 1 - (y / size) * 0.55 + (r() - 0.5) * 0.25;
      const hh = hue + (r() - 0.5) * 18, sat = 32 + r() * 18, li = 14 + lit * 22;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI * 2);
      g.fillStyle = 'hsl(' + hh + ',' + sat + '%,' + li + '%)';
      g.beginPath();
      g.ellipse(0, 0, leafW, leafW * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      // nervio claro
      g.strokeStyle = 'hsla(' + hh + ',' + sat + '%,' + (li + 10) + '%,0.6)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-leafW * 0.8, 0); g.lineTo(leafW * 0.8, 0); g.stroke();
      g.restore();
    }
    return cv;
  }

  // Rama de pino: tallos con muchas agujas cortas y densas (u = desde el tronco hacia fuera)
  function pineCanvas() {
    const W = 256, H = 128, cv = canvas(W, H), g = cv.getContext('2d');
    const r = rng(77);
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const y0 = H / 2 + (k - 1) * 26 + (r() - 0.5) * 8;
      const pt = (t) => [t * W * 0.95, H / 2 + (y0 - H / 2) * Math.min(1, t * 1.6) + 4 * t];
      g.strokeStyle = '#3a2c1e'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, H / 2);
      for (let t = 0.05; t <= 1; t += 0.05) { const p = pt(t); g.lineTo(p[0], p[1]); }
      g.stroke();
      for (let i = 0; i < 260; i++) {
        const t = Math.pow(r(), 0.8) * 0.98;
        const [x, y] = pt(t);
        const len = (1 - t * 0.5) * (10 + r() * 14);
        const a = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.9);
        const li = 13 + r() * 16 + (y < H / 2 ? 5 : 0);
        g.strokeStyle = 'hsl(' + (120 + r() * 25) + ',' + (28 + r() * 18) + '%,' + li + '%)';
        g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
    }
    return cv;
  }

  // Hierba: hojas finas desde abajo, de verde a amarillo en las puntas
  function grassCanvas() {
    const W = 128, H = 128, cv = canvas(W, H), g = cv.getContext('2d');
    const r = rng(31);
    for (let i = 0; i < 46; i++) {
      const x = 6 + r() * (W - 12), h = H * (0.45 + r() * 0.55), bend = (r() - 0.5) * 30;
      const grad = g.createLinearGradient(0, H, 0, H - h);
      const hue = 70 + r() * 30;
      grad.addColorStop(0, 'hsl(' + (hue + 10) + ',35%,16%)');
      grad.addColorStop(1, 'hsl(' + (hue - 15) + ',45%,' + (38 + r() * 14) + '%)');
      g.fillStyle = grad;
      const w = 2 + r() * 2.5;
      g.beginPath();
      g.moveTo(x - w, H);
      g.quadraticCurveTo(x - w * 0.5 + bend * 0.5, H - h * 0.5, x + bend, H - h);
      g.quadraticCurveTo(x + w * 0.5 + bend * 0.5, H - h * 0.5, x + w, H);
      g.fill();
    }
    return cv;
  }

  // Láminas para los árboles lejanos (copiadas de las texturas de cerca)
  function treeImpostor(leaf) {
    const W = 128, H = 192, cv = canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#4e3b2a';
    g.beginPath(); g.moveTo(W / 2 - 7, H); g.lineTo(W / 2 - 4, H * 0.45); g.lineTo(W / 2 + 4, H * 0.45); g.lineTo(W / 2 + 7, H); g.fill();
    const r = rng(5);
    for (let i = 0; i < 9; i++) {
      const s = 54 + r() * 30;
      g.drawImage(leaf, W / 2 - s / 2 + (r() - 0.5) * 50, 8 + r() * 70, s, s);
    }
    return cv;
  }
  function pineImpostor(pine) {
    const W = 128, H = 224, cv = canvas(W, H), g = cv.getContext('2d');
    g.fillStyle = '#3e2f22';
    g.fillRect(W / 2 - 4, H * 0.5, 8, H * 0.5);
    for (let k = 0; k < 7; k++) {
      const y = H * 0.7 - k * 21, w = 112 - k * 13;
      for (const sg of [-1, 1]) {
        g.save();
        g.translate(W / 2, y);
        g.scale(sg, 1);
        g.rotate(0.35);
        g.drawImage(pine, 0, -16, w / 2 + 6, 34);
        g.restore();
      }
    }
    return cv;
  }

  // ---------- Viento ----------
  // k: cuánto se mueve según la altura (y + off) · fade: hierba que se encoge a lo lejos
  function windMat(mat, k, off, fade) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      if (fade) sh.uniforms.uFade = fade;
      sh.vertexShader = 'uniform float uTime;\n' + (fade ? 'uniform vec2 uFade;\n' : '') + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        '  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
        '#else',
        '  vec3 ip = vec3(0.0);',
        '#endif',
        fade ? '  float fd = 1.0 - smoothstep(uFade.x, uFade.y, distance(ip.xz, cameraPosition.xz));\n  transformed *= vec3(mix(0.4, 1.0, fd), fd, mix(0.4, 1.0, fd));' : '',
        '  float ph = uTime * 1.7 + ip.x * 0.37 + ip.z * 0.29;',
        '  float wk = max(0.0, transformed.y + ' + off.toFixed(2) + ') * ' + k.toFixed(3) + ';',
        '  transformed.x += (sin(ph) + 0.35 * sin(ph * 2.3)) * wk;',
        '  transformed.z += cos(ph * 0.8) * wk * 0.6;'
      ].join('\n'));
    };
    // ¡Importante! Three.js reutiliza el sombreador compilado si el texto de onBeforeCompile es igual, y aquí lo es
    // para todos (cambian solo los números de dentro). Sin una clave propia, copas, pinos, arbustos y hierba alta
    // acababan con el sombreador del primero que se compilaba: si era la hierba (que se aplasta con la distancia),
    // las copas de los árboles a media distancia se veían aplastadas (troncos pelados)
    const key = 'wind_' + k.toFixed(3) + '_' + off.toFixed(2) + (fade ? '_fade' : '');
    mat.customProgramCacheKey = () => key;
    return mat;
  }

  // Lámina que mira siempre a la cámara (girando solo en vertical)
  function billboardMat(map) {
    const mat = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <project_vertex>', [
          'vec4 bc = vec4(0.0, 0.0, 0.0, 1.0);',
          'float bs = 1.0;',
          '#ifdef USE_INSTANCING',
          '  bc = instanceMatrix * bc; bs = length(instanceMatrix[0].xyz);',
          '#endif',
          'vec3 toC = cameraPosition - bc.xyz; toC.y = 0.0; toC = normalize(toC + vec3(1e-4, 0.0, 0.0));',
          'vec3 rgt = vec3(toC.z, 0.0, -toC.x);',
          'vec3 wp = bc.xyz + rgt * transformed.x * bs + vec3(0.0, transformed.y * bs, 0.0);',
          'vec4 mvPosition = viewMatrix * vec4(wp, 1.0);',
          'gl_Position = projectionMatrix * mvPosition;'
        ].join('\n'));
    };
    return mat;
  }

  // ---------- Geometrías ----------
  // Láminas sueltas: cada una [cx, cy, cz, tamaño, giro, inclinación]. Normales hacia fuera
  // del centro (así la copa se ilumina como un volumen y no como planos sueltos)
  function cardsGeo(cards, center) {
    const pos = [], nor = [], uv = [], idx = [];
    const e = new THREE.Euler(), q = new THREE.Quaternion(), v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [cx, cy, cz, s, yaw, tilt] of cards) {
      e.set(tilt, yaw, 0, 'YXZ'); q.setFromEuler(e);
      const b = pos.length / 3;
      for (const [ux, uy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        v.set((ux - 0.5) * s, (uy - 0.5) * s, 0).applyQuaternion(q).add(new THREE.Vector3(cx, cy, cz));
        pos.push(v.x, v.y, v.z);
        n.copy(v).sub(center); n.y += 0.35 * n.length(); n.normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(ux, uy);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  function crownGeo() {
    const r = rng(11), cards = [];
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      cards.push([Math.cos(a) * d * 1.15, (r() - 0.45) * 1.5, Math.sin(a) * d * 1.15, 1.7 + r() * 0.7, r() * Math.PI, (r() - 0.5) * 1.1]);
    }
    cards.push([0, 0.75, 0, 1.9, 0, -1.35], [0, -0.2, 0, 2.3, 0.8, -1.5]);
    return cardsGeo(cards, new THREE.Vector3(0, -0.4, 0));
  }

  function bushGeo() {
    const cards = [];
    for (let i = 0; i < 3; i++) cards.push([0, 0.48, 0, 1.15, i * Math.PI / 3, 0]);
    cards.push([0.15, 0.62, 0.1, 0.95, 0.4, -1.1], [-0.2, 0.4, -0.1, 0.9, 1.9, 0.6]);
    return cardsGeo(cards, new THREE.Vector3(0, 0.1, 0));
  }

  // Copa del pino: pisos de ramas que salen del tronco y caen un poco
  function pineCrownGeo() {
    const pos = [], nor = [], uv = [], idx = [];
    const quad = (a, b, c, d) => {
      const base = pos.length / 3;
      for (const [p, u, v] of [[a, 0, 0], [b, 1, 0], [c, 1, 1], [d, 0, 1]]) {
        pos.push(p[0], p[1], p[2]);
        const n = new THREE.Vector3(p[0], 0.9, p[2]).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(u, v);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const layers = 7;
    for (let L = 0; L < layers; L++) {
      const y = 2.4 + L * 0.55, rad = 1.95 - L * 0.23, n = L < layers - 2 ? 7 : 5;
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI * 2 / n + L * 0.7;
        const ca = Math.cos(a), sa = Math.sin(a);
        const px = -sa, pz = ca;                    // perpendicular
        const wi = 0.18, wo = rad * 0.55;
        const drop = 0.22 * rad;
        quad([px * -wi, y + 0.1, pz * -wi], [ca * rad + px * -wo, y - drop, sa * rad + pz * -wo],
             [ca * rad + px * wo, y - drop, sa * rad + pz * wo], [px * wi, y + 0.1, pz * wi]);
      }
    }
    // punta
    for (const a of [0, Math.PI / 2]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      quad([-ca * 0.4, 5.7, -sa * 0.4], [ca * 0.4, 5.7, sa * 0.4], [ca * 0.05, 6.8, sa * 0.05], [-ca * 0.05, 6.8, -sa * 0.05]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  // Tronco con ramas (árbol de hoja ancha) y tronco recto (pino)
  function trunkGeo(pine) {
    const m = new G.Mesher();
    const BARK = 0x5b4532;
    if (pine) {
      m.cyl(0, 3.2, 0, 0.18, 0.05, 6.4, 0x4a3828, 7);
    } else {
      m.cyl(0, 1.75, 0, 0.21, 0.13, 3.5, BARK, 7);
      const r = rng(3);
      for (let i = 0; i < 4; i++) {
        const tilt = 0.75 + r() * 0.35, az = i * Math.PI / 2 + r() * 0.6, L = 1.0 + r() * 0.35, y0 = 2.3 + i * 0.28;
        const dx = Math.sin(tilt) * Math.cos(az), dy = Math.cos(tilt), dz = -Math.sin(tilt) * Math.sin(az);
        m.cyl(dx * L / 2, y0 + dy * L / 2, dz * L / 2, 0.075, 0.03, L, U.shade(BARK, 0.92), 5, undefined, 0, az, -tilt);
      }
    }
    return m.build();
  }

  function grassGeo() {
    const cards = [];
    for (let i = 0; i < 2; i++) cards.push([0, 0.36, 0, 0.75, i * Math.PI / 2 + 0.4, 0]);
    const g = cardsGeo(cards, new THREE.Vector3(0, -2, 0));
    // las láminas de hierba son más anchas que altas: estira en horizontal
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * 1.25); p.setZ(i, p.getZ(i) * 1.25); }
    return g;
  }

  // ---------- Recursos compartidos ----------
  function init() {
    const leaf = leafCanvas(256, 300, 9, 1, 100), bushLeaf = leafCanvas(256, 340, 8, 2, 92), pine = pineCanvas(), grass = grassCanvas();
    const lam = (map, extra) => new THREE.MeshLambertMaterial(Object.assign({ map, alphaTest: 0.5, side: THREE.DoubleSide }, extra || {}));
    const depth = (map) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    const leafT = tex(leaf), bushT = tex(bushLeaf), pineT = tex(pine), grassT = tex(grass);
    R = {
      crownGeo: crownGeo(), pineGeo: pineCrownGeo(), bushGeo: bushGeo(), grassGeo: grassGeo(),
      trunkT: trunkGeo(false), trunkP: trunkGeo(true),
      bbTree: (() => { const g = new THREE.PlaneGeometry(4.4, 6.6); g.translate(0, 3.3, 0); return g; })(),
      bbPine: (() => { const g = new THREE.PlaneGeometry(4.2, 7.6); g.translate(0, 3.8, 0); return g; })(),
      bark: new THREE.MeshLambertMaterial({ vertexColors: true }),
      crown: windMat(lam(leafT), 0.035, 1.6),
      pine: windMat(lam(pineT), 0.012, 0),
      bush: windMat(lam(bushT), 0.06, 0),
      grassFade: { value: new THREE.Vector2(20, 30) },
      crownDepth: depth(leafT), pineDepth: depth(pineT),
      bbTreeMat: billboardMat(tex(treeImpostor(leaf))),
      bbPineMat: billboardMat(tex(pineImpostor(pine)))
    };
    R.grass = windMat(lam(grassT), 0.16, 0, R.grassFade);
    // otoño (mapas con autumn): hojas anaranjadas (se tiñen de rojo, amarillo o pardo por árbol) y hierba seca
    const leafA = leafCanvas(256, 300, 9, 1, 34), bushA = leafCanvas(256, 340, 8, 2, 30);
    const leafAT = tex(leafA);
    R.crownAut = windMat(lam(leafAT), 0.035, 1.6);
    R.crownAutDepth = depth(leafAT);
    R.bushAut = windMat(lam(tex(bushA)), 0.06, 0);
    R.bbTreeAut = billboardMat(tex(treeImpostor(leafA)));
  }

  // ---------- Construcción por chunk ----------
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  function inst(geo, mat, n, shadow) {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    im.count = n;
    im.castShadow = !!shadow; im.receiveShadow = false;
    im.frustumCulled = false;
    return im;
  }

  // trees, pines, bushes: [[X, Z], ...] · devuelve lo que necesita update()
  function build(c, group, trees, pines, bushes, px, pz) {
    if (!R) init();
    const Wd = G.World, CS = Wd.CS;
    const v = { list: [], meshes: [], box: new THREE.Box3(new THREE.Vector3(c.cx * CS, -15, c.cz * CS), new THREE.Vector3(c.cx * CS + CS, 25, c.cz * CS + CS)) };
    const q = G.Quality ? G.Quality.cur : { treeFar: 30, grass: 1 };
    const mp = G.Maps && G.World.layout && G.Maps.get(G.World.layout), aut = !!(mp && mp.autumn);
    const AUT = [[1.25, 0.72, 0.5], [1.2, 1.0, 0.55], [1.0, 0.82, 0.62], [1.3, 0.6, 0.45], [0.9, 0.95, 0.6]];
    // árboles de hoja ancha y pinos
    const kinds = [
      { arr: trees, trunk: R.trunkT, crown: R.crownGeo, cmat: aut ? R.crownAut : R.crown, cdepth: aut ? R.crownAutDepth : R.crownDepth, bb: R.bbTree, bbm: aut ? R.bbTreeAut : R.bbTreeMat, pine: false },
      { arr: pines, trunk: R.trunkP, crown: R.pineGeo, cmat: R.pine, cdepth: R.pineDepth, bb: R.bbPine, bbm: R.bbPineMat, pine: true }
    ];
    for (const k of kinds) {
      const n = k.arr.length;
      if (!n) continue;
      const trunk = inst(k.trunk, R.bark, n, true);
      const crown = inst(k.crown, k.cmat, n, true);
      crown.customDepthMaterial = k.cdepth;
      const bb = inst(k.bb, k.bbm, n, false);
      k.arr.forEach(([X, Z], i) => {
        const h1 = Wd.hash(Math.floor(X), Math.floor(Z), k.pine ? 43 : 41), h2 = Wd.hash(Math.floor(X), Math.floor(Z), k.pine ? 44 : 42);
        const s = k.pine ? 0.9 + h1 * 0.45 : 0.85 + h1 * 0.4;
        const rec = { X, Z, Y: Wd.terrainAt(X, Z) - 0.05, s, rot: h2 * 6.28, pine: k.pine, i, trunk, crown, bb, near: null };
        trunk.setColorAt(i, col.setRGB(0.85 + h2 * 0.3, 0.85 + h2 * 0.25, 0.85 + h2 * 0.2));
        const g = 0.8 + h1 * 0.35;
        if (aut && !k.pine) { const t = AUT[Math.floor(h2 * AUT.length) % AUT.length]; crown.setColorAt(i, col.setRGB(t[0] * g, t[1] * g, t[2] * g)); bb.setColorAt(i, col.setRGB(t[0] * g, t[1] * g, t[2] * g)); }
        else { crown.setColorAt(i, col.setRGB(g * (0.95 + h2 * 0.1), g, g * (0.9 + h2 * 0.15))); bb.setColorAt(i, col.setRGB(g, g, g)); }
        v.list.push(rec);
        place(rec, Math.hypot(X - px, Z - pz) < q.treeFar);
      });
      for (const im of [trunk, crown, bb]) { if (im.instanceColor) im.instanceColor.needsUpdate = true; group.add(im); v.meshes.push(im); }
    }

    // arbustos
    if (bushes.length) {
      const bm = inst(R.bushGeo, aut ? R.bushAut : R.bush, bushes.length, false);
      bushes.forEach(([X, Z], i) => {
        const h = Wd.hash(Math.floor(X), Math.floor(Z), 31), h2 = Wd.hash(Math.floor(X), Math.floor(Z), 32);
        const s = 0.85 + h * 0.6;
        dummy.position.set(X + (h2 - 0.5) * 0.3, Wd.terrainAt(X, Z) - 0.03, Z + (h - 0.5) * 0.3); dummy.rotation.set(0, h2 * 6.28, 0); dummy.scale.set(s, s * (0.8 + h2 * 0.4), s);
        dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix);
        if (aut) { const t = AUT[Math.floor(h * AUT.length) % AUT.length]; bm.setColorAt(i, col.setRGB(t[0] * (0.8 + h2 * 0.3), t[1] * (0.8 + h2 * 0.3), t[2] * 0.9)); }
        else bm.setColorAt(i, col.setRGB(0.8 + h * 0.3, 0.85 + h2 * 0.25, 0.75 + h * 0.2));
      });
      bm.instanceMatrix.needsUpdate = true; bm.instanceColor.needsUpdate = true;
      group.add(bm); v.meshes.push(bm);
    }

    // hierba alta: se generan matas para la calidad máxima en orden aleatorio y se dibujan
    // tantas como pida la calidad (cambiar la calidad no obliga a reconstruir)
    if (c.tall) {
      const tufts = [];
      const ox = c.cx * CS, oz = c.cz * CS;
      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          if (!c.tall[z * CS + x]) continue;
          for (let k = 0; k < 3; k++) {
            const a = Wd.hash(ox + x, oz + z, 70 + k), b = Wd.hash(ox + x, oz + z, 80 + k);
            tufts.push([ox + x + 0.1 + a * 0.8, oz + z + 0.1 + b * 0.8, a * 6.28 + k, 0.8 + b * 0.5, Wd.hash(ox + x, oz + z, 90 + k)]);
          }
        }
      }
      if (tufts.length) {
        tufts.sort((p, q2) => p[4] - q2[4]);
        const gm = inst(R.grassGeo, R.grass, tufts.length, false);
        tufts.forEach(([X, Z, r, s, h], i) => {
          dummy.position.set(X, Wd.terrainAt(X, Z) - 0.02, Z); dummy.rotation.set(0, r, 0); dummy.scale.set(s, s * (0.85 + h * 0.4), s);
          dummy.updateMatrix(); gm.setMatrixAt(i, dummy.matrix);
          if (aut) gm.setColorAt(i, col.setRGB(1.45 + h * 0.3, 1.2 + h * 0.2, 0.55 + h * 0.15));          // (hierba seca)
          else gm.setColorAt(i, col.setRGB(0.85 + h * 0.3, 0.88 + h * 0.2, 0.8 + h * 0.15));
        });
        gm.instanceMatrix.needsUpdate = true; gm.instanceColor.needsUpdate = true;
        gm.userData.total = tufts.length;
        gm.count = Math.round(tufts.length * q.grass);
        group.add(gm); v.meshes.push(gm);
        v.grass = gm;
      }
    }
    return v;
  }

  // Cerca: tronco y copa 3D; lejos: lámina
  function place(r, near) {
    if (r.near === near) return false;
    r.near = near;
    if (near) {
      dummy.position.set(r.X, r.Y, r.Z); dummy.rotation.set(0, r.rot, 0); dummy.scale.set(r.s, r.s, r.s);
      dummy.updateMatrix(); r.trunk.setMatrixAt(r.i, dummy.matrix);
      if (r.pine) { r.crown.setMatrixAt(r.i, dummy.matrix); }
      else {
        dummy.position.set(r.X, r.Y + 3.75 * r.s, r.Z); dummy.scale.set(r.s * 1.12, r.s * 1.05, r.s * 1.12);
        dummy.updateMatrix(); r.crown.setMatrixAt(r.i, dummy.matrix);
      }
      r.bb.setMatrixAt(r.i, ZERO);
    } else {
      r.trunk.setMatrixAt(r.i, ZERO); r.crown.setMatrixAt(r.i, ZERO);
      dummy.position.set(r.X, r.Y, r.Z); dummy.rotation.set(0, 0, 0); dummy.scale.set(r.s, r.s, r.s);
      dummy.updateMatrix(); r.bb.setMatrixAt(r.i, dummy.matrix);
    }
    r.trunk.instanceMatrix.needsUpdate = true; r.crown.instanceMatrix.needsUpdate = true; r.bb.instanceMatrix.needsUpdate = true;
    return true;
  }

  // Viento cada fotograma; cambio cerca/lejos unas veces por segundo.
  // Las láminas instanciadas no se recortan solas: se ocultan los chunks fuera de cámara
  // (los árboles cercanos se quedan, por sus sombras) y la hierba de los chunks lejanos
  const frustum = new THREE.Frustum(), _pm = new THREE.Matrix4();
  function update(dt, px, pz, chunks, camera) {
    if (!R) return;
    uTime.value += dt;
    if (camera) {
      camera.updateMatrixWorld();
      _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(_pm);
      const gf = (G.Quality ? G.Quality.cur.grassFar : 30) + 2;
      chunks.forEach((c) => {
        const v = c.view && c.view.veg;
        if (!v) return;
        const b = v.box;
        const dx = Math.max(b.min.x - px, 0, px - b.max.x), dz = Math.max(b.min.z - pz, 0, pz - b.max.z);
        const dd = Math.hypot(dx, dz);
        const inView = frustum.intersectsBox(b);
        for (const m of v.meshes) {
          const vis = m === v.grass ? inView && dd < gf : (inView || dd < 18);
          if (m.visible !== vis) m.visible = vis;
        }
      });
    }
    swapT -= dt;
    if (swapT > 0) return;
    swapT = 0.3;
    const q = G.Quality ? G.Quality.cur : { treeFar: 30, grass: 1, grassFar: 30 };
    const gf = q.grassFar || 30;
    R.grassFade.value.set(gf * 0.65, gf);
    const far = q.treeFar;
    chunks.forEach((c) => {
      const v = c.view && c.view.veg;
      if (!v) return;
      for (const r of v.list) {
        const d = Math.hypot(r.X - px, r.Z - pz);
        place(r, r.near ? d < far + 1.5 : d < far - 1.5);
      }
      if (v.grass) {
        const n = Math.round(v.grass.userData.total * q.grass);
        if (v.grass.count !== n) v.grass.count = n;
      }
    });
  }

  G.Vegetation = { build, update, init, inView: (box) => frustum.intersectsBox(box) };
})(window.Game = window.Game || {});
