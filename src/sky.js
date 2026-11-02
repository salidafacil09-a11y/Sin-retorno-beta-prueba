(function (G) {
  'use strict';

  // Ciclo de día y noche y clima de los mapas (todos menos el del jefe final y el refugio).
  //
  // La hora avanza sola (un día entero dura DAY_LEN segundos) y cada enfrentamiento empieza a una hora al azar;
  // el clima se elige al empezar cada enfrentamiento según el mapa y dura hasta el final (la nieve, solo en el
  // supermercado). Cada fotograma se
  // recalcula la luz a partir de la del mapa (su «mood»): el cielo, el sol (y la luna), la luz ambiente y la
  // niebla. Los enemigos lo notan: de noche los infectados ven peor pero oyen más y salen más (los acechadores ya
  // no se esconden del sol); de día, contra los Escorpiones, vienen más; la lluvia tapa los ruidos y la niebla
  // la vista (ver sight/hear y G.Mode).
  //
  // Con la calidad «Muy alta», partículas en el aire alrededor de la cámara: polvo, arena, polvo que levanta
  // el viento, hojas secas, hojas, lluvia y nieve.
  const U = G.Util;
  const DAY_LEN = 720;                 // segundos por día (12 minutos)
  const BLEND = 18;                    // segundos que tarda en cambiar

  // climas posibles de cada mapa (los repetidos salen más)
  const CLIMA = {
    terminal: ['despejado', 'despejado', 'nublado', 'lluvia', 'niebla', 'viento'],
    barrio: ['nublado', 'nublado', 'lluvia', 'niebla', 'despejado'],
    barrio_completo: ['nublado', 'nublado', 'lluvia', 'niebla', 'despejado'],
    servicio: ['despejado', 'nublado', 'lluvia', 'viento', 'niebla'],
    super: ['nieve', 'nieve', 'nublado', 'ventisca'],
    playa: ['despejado', 'despejado', 'viento', 'nublado', 'lluvia'],
    oceanside: ['despejado', 'niebla', 'niebla', 'nublado', 'viento', 'despejado'],      // (la bruma del mar, por las mañanas)
    capitolio: ['despejado', 'despejado', 'viento', 'nublado', 'niebla']
  };
  // sun: luz del sol · sky: color del cielo y cuánto se mezcla · fog: niebla (menos = más cerca) ·
  // sight/hear: cuánto ven y oyen los enemigos · acc: puntería de los humanos · part: partículas
  const WX = {
    despejado: { label: 'Despejado', sun: 1, hemi: 1, sky: [0xffffff, 0], fog: 1, sight: 1, hear: 1, acc: 1, part: null },
    nublado: { label: 'Nublado', sun: 0.5, hemi: 0.9, sky: [0x8c9094, 0.45], fog: 0.9, sight: 0.95, hear: 1, acc: 1, part: null },
    lluvia: { label: 'Lluvia', sun: 0.28, hemi: 0.78, sky: [0x5c636a, 0.62], fog: 0.66, sight: 0.75, hear: 0.62, acc: 0.85, part: 'lluvia', on: 'Empieza a llover: tapa los ruidos (y te oyen menos)' },
    niebla: { label: 'Niebla', sun: 0.4, hemi: 0.95, sky: [0xb4b8b4, 0.72], fog: 0.42, sight: 0.55, hear: 1, acc: 0.8, part: null, on: 'Entra la niebla: casi no se ve nada a lo lejos' },
    viento: { label: 'Viento', sun: 0.9, hemi: 1, sky: [0xc8b49a, 0.22], fog: 0.82, sight: 0.9, hear: 0.78, acc: 0.88, part: 'viento', on: 'Se levanta viento' },
    nieve: { label: 'Nieve', sun: 0.5, hemi: 0.95, sky: [0xd2d8de, 0.5], fog: 0.75, sight: 0.85, hear: 0.9, acc: 0.95, part: 'nieve' },
    ventisca: { label: 'Ventisca', sun: 0.3, hemi: 0.9, sky: [0xe2e6ea, 0.7], fog: 0.5, sight: 0.6, hear: 0.7, acc: 0.8, part: 'nieve', heavy: true, on: 'Ventisca: no se ve a dos pasos' }
  };
  const NIGHT_SKY = 0x0b1120, DUSK = 0xf09a62, MOON = 0x9fb4e6, NIGHT_HEMI = 0x7c90c4;

  const C = (h) => new THREE.Color(h);
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  let active = false, layout = null;
  let hour = 12, wx = 'despejado', prevWx = 'despejado', blend = 1;
  let base = null;                     // la luz del mapa: { sky, hemi, hemiG, hemiI, sun, sunI }
  let fogBase = { near: 16, far: 58 };
  let wasNight = null;
  let night = 0;                       // 0 de día, 1 de noche (con el amanecer y el atardecer en medio)
  let cache = { sight: 1, hear: 1, acc: 1, fog: 1 };
  let fill = null;                     // de noche, una luz suave alrededor (los ojos que se acostumbran)

  // ---- hora ----
  function dayK(h) {
    // 0 de noche, 1 de día: amanece de 5:30 a 7:00 y anochece de 18:45 a 20:15
    if (h < 5.5 || h > 20.25) return 0;
    if (h < 7) return U.smooth((h - 5.5) / 1.5);
    if (h > 18.75) return U.smooth(1 - (h - 18.75) / 1.5);
    return 1;
  }
  function goldK(h) { return Math.max(0, 1 - Math.abs(h - 6.6) / 1.3, 1 - Math.abs(h - 19.2) / 1.3); }
  const pickWx = (list, not) => { let w; for (let i = 0; i < 6; i++) { w = list[Math.floor(Math.random() * list.length)]; if (w !== not) break; } return w; };

  const Sky = {
    // la luz de relleno de la noche, desde el principio (apagada): ver setFill
    init(scene) { setFill(0, scene); },
    DAY_LEN, WX, CLIMA,
    get active() { return active; },
    get hour() { return hour; },
    get weather() { return wx; },
    get night() { return active && night > 0.5; },
    get nightK() { return active ? night : 0; },
    get label() { return active ? (WX[wx].label + ' · ' + Sky.clock()) : ''; },
    onMessage: null,
    clock() { const h = Math.floor(hour), m = Math.floor((hour - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; },

    // Al cambiar de mapa (setLighting): la luz del mapa como base, hora y clima nuevos
    reset(id, mood) {
      const m = G.Maps && G.Maps.get(id);
      active = !!(m && !m.boss && mood);
      layout = id;
      wasNight = null;
      if (!active) { base = null; Particles.clear(); setFill(0); return; }
      base = { sky: C(mood.sky), hemi: C(mood.hemi[0]), hemiG: C(mood.hemi[1]), hemiI: mood.hemi[2], sun: C(mood.sun[0]), sunI: mood.sun[1] };
      // hora: casi siempre de día (desde media mañana a la tarde); una de cada cuatro, de noche o al caer
      const r = Math.random();
      hour = r < 0.72 ? 8 + Math.random() * 9.5 : (r < 0.86 ? 18.2 + Math.random() * 1.4 : (Math.random() < 0.5 ? 21 + Math.random() * 3 : Math.random() * 4.5));
      const list = CLIMA[id] || ['despejado', 'nublado'];
      wx = prevWx = pickWx(list); blend = 1;
      night = 1 - dayK(hour);
      Particles.setup(id);
    },
    // para pruebas: fijar la hora y el clima
    set(h, w) { if (h != null) hour = ((h % 24) + 24) % 24; if (w && WX[w]) { prevWx = wx = w; blend = 1; } night = 1 - dayK(hour); wasNight = null; Particles.snap = true; },
    setFogBase(n, f) { fogBase = { near: n, far: f }; },

    update(dt) {
      if (!active) return;
      hour = (hour + dt * 24 / DAY_LEN) % 24;
      night = 1 - dayK(hour);
      if (blend < 1) blend = Math.min(1, blend + dt / BLEND);
      // (el clima no cambia en medio del enfrentamiento: el que toca al empezar dura hasta el final)
      const isN = night > 0.5;
      if (wasNight !== null && isN !== wasNight && Sky.onMessage) {
        Sky.onMessage(isN ? 'Anochece: salen más infectados y los acechadores ya no se esconden' : 'Amanece');
      }
      wasNight = isN;
    },

    // ---- mezcla de los dos climas (el que se va y el que llega) ----
    mixWx(k) { const a = WX[prevWx][k], b = WX[wx][k]; return a + (b - a) * blend; },

    // Cada fotograma, después de la luz del mapa: cielo, sol, luna, ambiente y niebla
    apply(o) {
      if (!active || !base) return;
      const day = 1 - night, gold = goldK(hour) * (1 - night * 0.5);
      const sunW = Sky.mixWx('sun'), hemiW = Sky.mixWx('hemi'), fogW = Sky.mixWx('fog');
      // el cielo: el del mapa, con el clima, el tono del amanecer o atardecer y la noche
      const skyOf = (w) => tmpA.copy(base.sky).lerp(C(WX[w].sky[0]), WX[w].sky[1]);
      const sky = skyOf(prevWx).clone().lerp(skyOf(wx), blend);
      sky.lerp(tmpB.setHex(DUSK), gold * 0.32 * Math.max(0.3, sunW));
      sky.lerp(tmpB.setHex(NIGHT_SKY), night * 0.9);
      o.scene.background.copy(sky).convertSRGBToLinear();
      // el horizonte (montes, edificios lejanos): más oscuro de noche y del color del cielo con mal tiempo
      if (G.Maps && G.Maps.skyTint) {
        const wmix = WX[prevWx].sky[1] + (WX[wx].sky[1] - WX[prevWx].sky[1]) * blend;
        G.Maps.skyTint((0.25 + 0.75 * day) * (0.75 + 0.25 * sunW), tmpB.copy(sky), Math.min(0.8, wmix * 0.6 + night * 0.4));
      }
      if (o.scene.fog) {
        o.scene.fog.color.copy(o.scene.background);
        const fk = fogW * (1 - night * 0.38);
        o.scene.fog.near = fogBase.near * Math.max(0.35, fk); o.scene.fog.far = fogBase.far * fk;
      }
      // luz ambiente: más azul y más baja de noche (pero se ve: la luna)
      o.hemi.color.copy(base.hemi).lerp(tmpB.setHex(NIGHT_HEMI), night * 0.7);
      o.hemi.groundColor.copy(base.hemiG).multiplyScalar(1 - night * 0.6);
      o.hemi.intensity = base.hemiI * hemiW * (0.36 + 0.64 * day);
      // el sol (o la luna): de día con el clima; al amanecer y atardecer, cálido; de noche, la luna fría
      o.sun.color.copy(base.sun).lerp(tmpB.setHex(DUSK), gold * 0.4).lerp(tmpB.setHex(MOON), night);
      o.sun.intensity = base.sunI * sunW * day + night * 0.2 * (0.5 + sunW * 0.5);
      // de noche, una luz suave alrededor de la cámara
      setFill(night * (0.55 + (1 - hemiW) * 0.3), o.scene, o.at);
      cache = { sight: Sky.mixWx('sight'), hear: Sky.mixWx('hear'), acc: Sky.mixWx('acc'), fog: fogW };
    },
    // de dónde viene la luz (para el sol del juego): gira con la hora; de noche, la luna del otro lado
    sunOffset() {
      if (!active) return [-16, 32, 11];
      const day = night < 0.5;
      const t = day ? U.clamp((hour - 5.5) / 14.75, 0, 1) : ((hour + 24 - 20.25) % 24) / 9.25;
      const a = (t - 0.5) * 2.0;                 // de -1 rad (mañana) a +1 (tarde)
      const elev = 34 - Math.abs(a) * 12;
      return [Math.sin(a) * 26 * (day ? -1 : 1), elev, 11 + Math.cos(a) * 4];
    },

    // ---- lo que notan los enemigos ----
    // cuánto ven: zombis de noche algo menos (se guían por el oído); los humanos, bastante menos
    sight(human) {
      if (!active) return 1;
      const nk = human ? 1 - night * 0.42 : 1 - night * 0.2;
      return cache.sight * nk;
    },
    // cuánto oyen: la lluvia y el viento tapan los ruidos; de noche, los infectados oyen más
    hear(human) {
      if (!active) return 1;
      return cache.hear * (human ? 1 : 1 + night * 0.25);
    },
    // puntería de los humanos (lluvia, niebla, viento; de noche, peor)
    acc() { return active ? cache.acc * (1 - night * 0.18) : 1; },
    // cuántos enemigos más: de noche, infectados; de día, Escorpiones
    enemyMul(humans) {
      if (!active) return 1;
      if (humans) return night < 0.5 ? 1.2 : 1;
      return night >= 0.5 ? 1.3 : 1;
    },
    // de noche los infectados se mueven algo más (más activos); con nieve o lluvia fuerte, algo menos
    speedMul() {
      if (!active) return 1;
      const w = WX[wx];
      return (1 + night * 0.08) * (w.part === 'nieve' ? (w.heavy ? 0.9 : 0.95) : 1);
    },

    update3d(dt, camera, target) { if (active) Particles.update(dt, camera, target, Sky); }
  };

  function setFill(k, scene, at) {
    // (se crea de una vez, aunque sea de día: una luz nueva en mitad del juego obliga a recompilar todos los
    // materiales, y eso da un tirón al caer la noche)
    if (!fill && scene) {
      fill = new THREE.PointLight(0x9ab0e0, 0, 9, 1.6);
      scene.add(fill);
    }
    if (!fill) return;
    if (scene && fill.parent !== scene) scene.add(fill);
    fill.intensity = k * 0.9;
    fill.visible = k > 0.01;
    if (at) fill.position.set(at.x, at.y + 2.6, at.z);
  }

  // =====================================================================================================
  // Partículas (calidad «Muy alta»): capas de puntos alrededor de la cámara que se reciclan al salir de la caja
  // =====================================================================================================
  const BOX = 15, TOP = 11;
  let dotTex = null, leafTex = null;
  function texDot() {
    if (dotTex) return dotTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const x = cv.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    dotTex = new THREE.CanvasTexture(cv);
    return dotTex;
  }
  function texLeaf() {
    if (leafTex) return leafTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(16, 16, 13, 7, 0.6, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(6, 23); x.lineTo(26, 9); x.stroke();
    leafTex = new THREE.CanvasTexture(cv);
    return leafTex;
  }

  // tipos de capa: n (cuántas), size, colores, caída (vy), viento (cuánto las arrastra), vaivén, altura, opacidad
  const KIND = {
    polvo: { n: 260, size: 0.07, cols: [0xfff2d8, 0xe8dcc4], vy: [-0.05, 0.05], drift: 0.25, sway: 0.25, h: [0.2, 5], op: 0.55 },
    arena: { n: 420, size: 0.065, cols: [0xe0c49a, 0xd4b48a, 0xc8a87c], vy: [-0.2, 0.15], drift: 2.2, sway: 0.4, h: [0, 1.4], op: 0.75 },
    viento: { n: 520, size: 0.08, cols: [0xc8b498, 0xb4a084, 0xd8c8b0], vy: [-0.3, 0.3], drift: 6.5, sway: 0.8, h: [0, 4], op: 0.6 },
    hojas_secas: { n: 70, size: 0.3, cols: [0xb4642a, 0xc88a3a, 0x8a4a22, 0xd4a040], vy: [-0.9, -0.45], drift: 0.9, sway: 1.2, h: [0, 9], op: 1, leaf: true },
    hojas: { n: 50, size: 0.26, cols: [0x6a8a3a, 0x8aa04a, 0xb4a040], vy: [-0.8, -0.4], drift: 0.8, sway: 1.1, h: [0, 9], op: 1, leaf: true },
    nieve: { n: 1600, size: 0.12, cols: [0xffffff, 0xf0f4f8], vy: [-1.4, -0.8], drift: 1.1, sway: 0.5, h: [0, 11], op: 0.95 },
    lluvia: { n: 1100, rain: true, cols: [0xb8c4d0], vy: [-17, -14], drift: 1.2, h: [0, 11], op: 0.42 }
  };
  // qué capas lleva cada mapa siempre (y las del clima se suman)
  const AMB = {
    terminal: ['polvo'], barrio: ['polvo', 'hojas'], barrio_completo: ['polvo', 'hojas'], servicio: ['polvo', 'hojas'],
    super: ['polvo', 'nieve'], playa: ['polvo', 'arena', 'hojas_secas'], oceanside: ['polvo', 'arena'], capitolio: ['polvo', 'hojas_secas']
  };

  const Particles = {
    layers: [], group: null, mapId: null,
    on() { return !!(G.Quality && G.Quality.cur && G.Quality.cur.particles); },
    clear() {
      for (const L of this.layers) { L.obj.geometry.dispose(); L.obj.material.dispose(); if (L.obj.parent) L.obj.parent.remove(L.obj); }
      this.layers = [];
    },
    setup(id) { this.clear(); this.mapId = id; },
    layer(kind, scene) {
      const K = KIND[kind], n = K.n;
      const pos = new Float32Array(n * (K.rain ? 6 : 3)), col = new Float32Array(n * (K.rain ? 6 : 3));
      const vel = new Float32Array(n * 3), ph = new Float32Array(n);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        c.setHex(K.cols[i % K.cols.length]);
        const reps = K.rain ? 2 : 1;
        for (let r = 0; r < reps; r++) { const k = (i * reps + r) * 3; col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
        vel[i * 3] = (Math.random() - 0.5) * 0.3; vel[i * 3 + 1] = K.vy[0] + Math.random() * (K.vy[1] - K.vy[0]); vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        ph[i] = Math.random() * 100;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      let obj;
      if (K.rain) {
        obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: K.op, depthWrite: false, fog: true }));
      } else {
        obj = new THREE.Points(geo, new THREE.PointsMaterial({ size: K.size, map: K.leaf ? texLeaf() : texDot(), vertexColors: true, transparent: true, opacity: K.op, depthWrite: false, sizeAttenuation: true, alphaTest: K.leaf ? 0.4 : 0.02 }));
      }
      obj.frustumCulled = false; obj.renderOrder = 5;
      scene.add(obj);
      const L = { kind, K, obj, pos, vel, ph, n, init: false, k: 0 };
      this.layers.push(L);
      return L;
    },
    // las capas que tocan ahora (las del mapa y las del clima), con cuánto se ven (k: 0 a 1)
    wanted(S) {
      const want = {};
      for (const k of AMB[this.mapId] || ['polvo']) want[k] = 1;
      const add = (w, f) => {
        const p = WX[w].part; if (!p || f <= 0) return;
        if (p === 'viento') { want.viento = Math.max(want.viento || 0, f); if (want.arena) want.arena = 1; want.hojas_secas = want.hojas_secas ? 1 : 0; if (this.mapId !== 'playa' && this.mapId !== 'super') want.hojas = Math.max(want.hojas || 0, f); }
        else want[p] = Math.max(want[p] || 0, f * (WX[w].heavy ? 1 : 0.75));
      };
      add(S.WXprev(), 1 - S.blendK()); add(S.WXcur(), S.blendK());
      // con lluvia, menos polvo y arena; con nieve en el súper, la base siempre
      if (want.lluvia) { if (want.polvo) want.polvo *= 1 - want.lluvia * 0.8; if (want.arena) want.arena *= 1 - want.lluvia * 0.9; }
      return want;
    },
    update(dt, camera, target, S) {
      if (!this.on()) { if (this.layers.length) this.clear(); return; }
      const scene = target.scene;
      const want = this.wanted(S);
      for (const k in want) if (want[k] > 0.01 && !this.layers.some((L) => L.kind === k)) this.layer(k, scene);
      const wind = S.WXcur() === 'viento' || S.WXcur() === 'ventisca' ? 1 : (S.WXcur() === 'lluvia' ? 0.5 : 0.25);
      const wx = 0.8 * wind, wz = 0.35 * wind;          // de dónde sopla
      const cx = target.x, cz = target.z, cy = target.y;
      const t = performance.now() / 1000;
      for (const L of this.layers) {
        const K = L.K, want0 = want[L.kind] || 0;
        L.k = this.snap ? want0 : L.k + (want0 - L.k) * Math.min(1, dt * 0.6);
        L.obj.visible = L.k > 0.02;
        if (!L.obj.visible) continue;
        L.obj.material.opacity = K.op * Math.min(1, L.k * 1.2);
        const pos = L.pos, vel = L.vel, n = L.n;
        // cuántas se ven (las de más, al fondo bajo el suelo)
        const live = Math.floor(n * Math.min(1, L.k));
        const hy0 = K.h[0], hy1 = K.h[1];
        const st = K.rain ? 6 : 3;
        for (let i = 0; i < n; i++) {
          const p = i * st;
          let x = pos[p], y = pos[p + 1], z = pos[p + 2];
          if (!L.init || i >= live || Math.abs(x - cx) > BOX * 2 || Math.abs(z - cz) > BOX * 2 || Math.abs(y - cy) > 30) {     // (al empezar o tras un salto lejos)
            x = cx + (Math.random() * 2 - 1) * BOX; z = cz + (Math.random() * 2 - 1) * BOX;
            y = i >= live ? -50 : cy + hy0 + Math.random() * (hy1 - hy0);
          } else {
            const s = L.ph[i];
            const sw = K.sway ? Math.sin(t * 1.3 + s) * K.sway : 0;
            x += (vel[i * 3] + wx * K.drift + sw * 0.6) * dt;
            z += (vel[i * 3 + 2] + wz * K.drift + Math.cos(t * 1.1 + s) * (K.sway || 0) * 0.5) * dt;
            y += (vel[i * 3 + 1] + (K.drift > 2 ? Math.sin(t * 2 + s) * 0.4 : 0)) * dt;
            // fuera de la caja: vuelve por el otro lado (y arriba si cayó)
            if (x < cx - BOX) x += BOX * 2; else if (x > cx + BOX) x -= BOX * 2;
            if (z < cz - BOX) z += BOX * 2; else if (z > cz + BOX) z -= BOX * 2;
            if (y < cy + hy0 - 0.3 || y < cy - 2) { y = cy + hy1 - Math.random() * 1.5; if (hy1 < 3) y = cy + hy0 + Math.random() * (hy1 - hy0); }
            else if (y > cy + hy1 + 0.5) y = cy + hy0;
          }
          pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
          if (K.rain) { pos[p + 3] = x - (wx * K.drift) * 0.04; pos[p + 4] = y + 0.55; pos[p + 5] = z - (wz * K.drift) * 0.04; }
        }
        L.init = true;
        L.obj.geometry.attributes.position.needsUpdate = true;
      }
      this.snap = false;
    }
  };
  Sky.WXcur = () => wx;
  Sky.WXprev = () => prevWx;
  Sky.blendK = () => blend;
  Sky.Particles = Particles;

  G.Sky = Sky;
})(window.Game = window.Game || {});
