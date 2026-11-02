(function (G) {
  'use strict';

  // Sonido: todo sintetizado en el momento con Web Audio (sin archivos). Cada sonido es una "receta" que monta
  // osciladores, ruido filtrado y envolventes. Los disparos y las explosiones llevan varias capas (chasquido,
  // cuerpo distorsionado, golpe grave y cola de eco) y aplastan un instante al resto de sonidos para que
  // se sientan contundentes.
  // Canales con su volumen: general, zombis, disparos (y explosiones), ambiente y efectos (golpes, pasos...).
  // Sonido en el espacio: volumen por distancia, a izquierda o derecha según la cámara y apagado si hay
  // una pared en medio.

  const KEY = 'ceniza.audio';
  const CATS = ['zombies', 'guns', 'amb', 'fx'];
  const DEF = { master: 0.85, zombies: 0.85, guns: 0.9, amb: 0.7, fx: 0.85 };
  const MAX_VOICES = 34;

  let ctx = null, ready = false;
  let master = null, muffle = null, comp = null, limit = null;
  const bus = {}, duckG = {}, revIn = {};
  let revOut = null, revRoomIn = null, revRoom = null, revOutIn = null;
  const buf = {};
  const curves = {};
  let active = 0, zVox = 0;
  let vol = Object.assign({}, DEF);
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) for (const k in DEF) if (typeof s[k] === 'number') vol[k] = Math.max(0, Math.min(1, s[k])); } catch (e) { /* sin almacenamiento */ }

  // oyente: posición del jugador y orientación de la cámara
  const L = { x: 0, z: 0, lv: 0, rx: 1, rz: 0, indoor: false };

  // ---------- Arranque (el navegador solo deja sonar después de un toque o una tecla) ----------
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC({ latencyHint: 'interactive' });
        build();
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  function init() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const go = () => unlock();
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('touchend', go, true);
    window.addEventListener('keydown', go, true);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) { /* nada */ }
      });
    }
  }

  function build() {
    const sr = ctx.sampleRate;
    // ruidos base (blanco, rosa y marrón), 2 s cada uno
    const n = sr * 2;
    const w = ctx.createBuffer(1, n, sr), p = ctx.createBuffer(1, n, sr), b = ctx.createBuffer(1, n, sr);
    const wd = w.getChannelData(0), pd = p.getChannelData(0), bd = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.random() * 2 - 1;
      wd[i] = r;
      b0 = 0.99886 * b0 + r * 0.0555179; b1 = 0.99332 * b1 + r * 0.0750759; b2 = 0.969 * b2 + r * 0.153852;
      b3 = 0.8665 * b3 + r * 0.3104856; b4 = 0.55 * b4 + r * 0.5329522; b5 = -0.7616 * b5 - r * 0.016898;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + r * 0.5362) * 0.11; b6 = r * 0.115926;
      last = (last + 0.02 * r) / 1.02; bd[i] = last * 3.5;
    }
    buf.white = w; buf.pink = p; buf.brown = b;

    // cadena final: volumen general -> filtro (aturdimiento de una explosión) -> compresor -> limitador
    master = ctx.createGain(); master.gain.value = vol.master;
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.002; comp.release.value = 0.25;
    limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -1; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.08;
    const makeup = ctx.createGain(); makeup.gain.value = 1.0;
    master.connect(muffle); muffle.connect(comp); comp.connect(makeup); makeup.connect(limit); limit.connect(ctx.destination);

    // ecos: exterior (cola larga, como el eco de un disparo en la calle) e interior (habitación)
    revOut = ctx.createConvolver(); revOut.buffer = impulse(1.2, 4, false);
    revRoom = ctx.createConvolver(); revRoom.buffer = impulse(0.7, 3.5, false);
    revOutIn = ctx.createGain(); revRoomIn = ctx.createGain(); revRoomIn.gain.value = 0;
    revOutIn.connect(revOut); revRoomIn.connect(revRoom);
    revOut.connect(master); revRoom.connect(master);

    for (const c of CATS) {
      bus[c] = ctx.createGain(); bus[c].gain.value = vol[c];
      duckG[c] = ctx.createGain();
      bus[c].connect(duckG[c]); duckG[c].connect(master);
      revIn[c] = ctx.createGain(); revIn[c].gain.value = vol[c];
      revIn[c].connect(revOutIn); revIn[c].connect(revRoomIn);
    }
    ready = true;
  }

  // respuesta de un eco: ruido que se apaga (con algunos rebotes marcados en exterior)
  function impulse(sec, decay, slap) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec);
    const ir = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (slap ? 0.55 : 0.8);
      }
      if (slap) {
        // rebotes en las fachadas: unos golpes de eco separados
        for (const [at, g] of [[0.11, 0.5], [0.23, 0.32], [0.41, 0.22], [0.66, 0.12]]) {
          const i0 = Math.floor(sr * (at + ch * 0.013));
          for (let k = 0; k < sr * 0.05 && i0 + k < n; k++) d[i0 + k] += (Math.random() * 2 - 1) * g * Math.exp(-k / (sr * 0.012));
        }
      }
    }
    return ir;
  }

  // ---------- Piezas para las recetas ----------
  const R = (a, b) => a + Math.random() * (b - a);
  function noise(type, t0, dur, rate) {
    const s = ctx.createBufferSource();
    s.buffer = buf[type || 'white']; s.loop = true;
    if (rate) s.playbackRate.value = rate;
    s.start(t0, Math.random() * 1.6); s.stop(t0 + dur + 0.05);
    return s;
  }
  function osc(type, f, t0, dur) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function filt(type, f, Q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q != null) b.Q.value = Q; return b; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; }
  // ataque lineal y caída exponencial
  function env(g, t0, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.0005, a));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.0005, a) + d);
  }
  function sweep(param, t0, f0, f1, dur) { param.setValueAtTime(f0, t0); param.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur); }
  function chain() { for (let i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }
  function shaper(drive) {
    const k = Math.round(drive * 10);
    if (!curves[k]) {
      const n = 1024, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
      curves[k] = c;
    }
    const s = ctx.createWaveShaper(); s.curve = curves[k]; s.oversample = '2x';
    return s;
  }
  // capa de ruido filtrado con envolvente
  function nz(dest, t, o) {
    const s = noise(o.n || 'white', t, (o.a || 0.001) + o.d + 0.05, o.rate);
    const f = filt(o.f || 'bandpass', o.fq || 1000, o.q);
    if (o.f1) sweep(f.frequency, t, o.fq, o.f1, o.fd || o.d);
    const g = gain(0);
    env(g, t, o.a || 0.001, o.g, o.d);
    if (o.drive) chain(s, f, shaper(o.drive), g, dest); else chain(s, f, g, dest);
  }
  // capa tonal con barrido de tono
  function tone(dest, t, o) {
    const s = osc(o.type || 'sine', o.f0, t, (o.a || 0.001) + o.d + 0.05);
    if (o.f1) sweep(s.frequency, t, o.f0, o.f1, o.fd || o.d);
    const g = gain(0);
    env(g, t, o.a || 0.001, o.g, o.d);
    chain(s, g, dest);
  }
  const click = (dest, t, fq, g, d) => nz(dest, t, { fq, q: 1.8, g, d: d || 0.015, a: 0.0004 });

  // ---------- Voz de infectado: fuente áspera + formantes (como una garganta) ----------
  // o: f0, dur, ct (curva de tono), fm (formantes [f1,f2,f3]), fm2 (formantes al final), nm (aire), am/amd
  // (traqueteo de la garganta), dist (aspereza), g (volumen), vib
  function vox(dest, t, o) {
    const dur = o.dur;
    const s = ctx.createOscillator(); s.type = 'sawtooth';
    const ct = new Float32Array(o.ct.length);
    for (let i = 0; i < ct.length; i++) ct[i] = Math.max(20, o.f0 * o.ct[i] * (1 + (Math.random() - 0.5) * 0.06));
    s.frequency.setValueCurveAtTime(ct, t, dur);
    if (o.vib) {
      const lv = osc('sine', o.vibR || 5.5, t, dur), lg = gain(o.f0 * o.vib);
      chain(lv, lg); lg.connect(s.frequency);
    }
    s.start(t); s.stop(t + dur + 0.05);
    const src = gain(1);
    s.connect(src);
    if (o.nm) { const nn = noise('pink', t, dur); const ng = gain(o.nm * 3); chain(nn, ng, src); }
    const sh = shaper(o.dist || 2);
    src.connect(sh);
    const sum = gain(1);
    const fm = o.fm || [500, 950, 2500], fm2 = o.fm2 || fm;
    const qs = [5, 7, 9], gs = [1, 0.55, 0.28];
    for (let i = 0; i < 3; i++) {
      const f = filt('bandpass', fm[i], qs[i]);
      if (fm2[i] !== fm[i]) { f.frequency.setValueAtTime(fm[i], t); f.frequency.linearRampToValueAtTime(fm2[i], t + dur); }
      const g = gain(gs[i] * 2.2);
      chain(sh, f, g, sum);
    }
    const am = gain(1);
    if (o.am) {
      am.gain.value = 1 - (o.amd || 0.5) / 2;
      const lo = osc(o.amSq ? 'square' : 'sine', o.am, t, dur), lg = gain((o.amd || 0.5) / 2);
      chain(lo, lg); lg.connect(am.gain);
    }
    const e = gain(0);
    const pk = o.g;
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(pk, t + Math.min(0.08, dur * 0.2));
    e.gain.setValueAtTime(pk * 0.85, t + dur * 0.7);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(sum, am, e, dest);
  }

  // ---------- Recetas ----------
  // cada una: cat (canal), wet (eco), ref (distancia a la que suena entero), roll, pri (prioridad),
  // fn(dest, t, o) -> duración
  const SFX = {};

  // --- disparos ---
  // Sucios y brutos: todas las capas pasan juntas por una saturación fuerte (se ensucian entre sí), con
  // graves realzados y un "crujido" digital. Sin eco: el estruendo es un retumbo grave continuo que se apaga
  function dirt(d, drive, lo, k) {
    const sh = shaper(drive);
    const ls = filt('lowshelf', 170); ls.gain.value = lo == null ? 7 : lo;
    const pk = filt('peaking', 2600, 0.9); pk.gain.value = 4;
    const g = gain(k || 0.8);
    chain(sh, ls, pk, g, d);
    return sh;
  }
  function crushed(d, t, o) {
    const s = noise('white', t, o.d + 0.05), f = filt('bandpass', o.fq || 1800, 0.6), c = ctx.createWaveShaper(), g = gain(0);
    const key = 'c' + (o.lv || 5);
    if (!curves[key]) { const n = 1024, cc = new Float32Array(n), q = o.lv || 5; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cc[i] = Math.round(x * 3 * q) / q / 3 * 1.5; } curves[key] = cc; }
    c.curve = curves[key];
    env(g, t, 0.0008, o.g, o.d);
    chain(s, f, c, g, d);
  }
  SFX.pistol = { cat: 'guns', wet: 0, pri: 3, fn(d0, t) {
    const v = R(0.94, 1.06), d = dirt(d0, 4.5, 7, 0.75);
    nz(d, t, { f: 'highpass', fq: 2200 * v, g: 1.2, d: 0.04, a: 0.0004 });                       // chasquido
    nz(d, t, { fq: 950 * v, q: 0.6, g: 1.3, d: 0.15, drive: 6 });                                // cuerpo
    crushed(d, t, { fq: 1600, g: 0.7, d: 0.1, lv: 4 });                                           // grano
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 520, g: 1.4, d: 0.28, a: 0.002 });                  // golpe de aire
    tone(d, t, { f0: 170 * v, f1: 40, fd: 0.12, g: 1.5, d: 0.2 });                               // pegada grave
    nz(d, t + 0.01, { n: 'brown', f: 'lowpass', fq: 220, g: 0.55, d: 0.45, a: 0.02 });           // retumbo corto
    click(d0, t + 0.05, 4200, 0.25, 0.012);                                                       // corredera
    click(d0, t + 0.08, 2600, 0.18, 0.015);
    if (Math.random() < 0.85) tink(d0, t + R(0.35, 0.55));                                       // casquillo al suelo
    return 0.9;
  } };
  SFX.pistolSil = { cat: 'guns', wet: 0, pri: 3, fn(d0, t) {
    const d = dirt(d0, 2.5, 4, 0.8);
    nz(d, t, { f: 'lowpass', fq: 1500, g: 0.75, d: 0.07 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 320, g: 0.65, d: 0.1, a: 0.002 });
    tone(d, t, { f0: 120, f1: 50, g: 0.45, d: 0.08 });
    click(d0, t + 0.01, 3600, 0.38, 0.014);
    click(d0, t + 0.05, 2400, 0.3, 0.016);
    if (Math.random() < 0.85) tink(d0, t + R(0.35, 0.55));
    return 0.8;
  } };
  SFX.shotgun = { cat: 'guns', wet: 0, pri: 3, fn(d0, t) {
    const v = R(0.94, 1.06), d = dirt(d0, 7, 9, 0.7);
    nz(d, t, { f: 'highpass', fq: 1500 * v, g: 1.4, d: 0.06, a: 0.0004 });
    nz(d, t, { f: 'lowpass', fq: 7000, f1: 380, fd: 0.3, g: 1.6, d: 0.4, drive: 9 });
    crushed(d, t, { fq: 1200, g: 1.0, d: 0.22, lv: 3 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 700, g: 2.0, d: 0.6, a: 0.003 });
    tone(d, t, { f0: 120 * v, f1: 28, fd: 0.35, g: 2.1, d: 0.45 });
    tone(d, t, { f0: 50, g: 1.0, d: 0.6, a: 0.006 });
    nz(d, t + 0.02, { n: 'brown', f: 'lowpass', fq: 200, g: 1.0, d: 1.1, a: 0.04 });            // estruendo que se apaga
    // corredera: atrás y adelante
    pump(d0, t + 0.3);
    return 1.3;
  } };
  SFX.rifle = { cat: 'guns', wet: 0, pri: 3, fn(d0, t) {
    const v = R(0.96, 1.04), d = dirt(d0, 6, 8, 0.72);
    nz(d, t, { f: 'highpass', fq: 2800 * v, g: 1.7, d: 0.028, a: 0.0003 });                     // estampido
    tone(d, t, { type: 'square', f0: 1700, f1: 700, g: 0.35, d: 0.015 });
    nz(d, t, { fq: 760 * v, q: 0.5, g: 1.5, d: 0.24, drive: 8 });
    crushed(d, t, { fq: 1400, g: 0.9, d: 0.16, lv: 3 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 750, g: 1.9, d: 0.6, a: 0.002 });
    tone(d, t, { f0: 150 * v, f1: 32, fd: 0.32, g: 2.1, d: 0.4 });
    nz(d, t + 0.02, { n: 'brown', f: 'lowpass', fq: 190, g: 1.1, d: 1.4, a: 0.05 });            // estruendo que se apaga
    bolt(d0, t + 0.5);
    return 1.7;
  } };
  // revólver: más grave y seco que la pistola, sin corredera; el tambor gira con un clic
  SFX.revolver = { cat: 'guns', wet: 0, pri: 3, fn(d0, t) {
    const v = R(0.95, 1.05), d = dirt(d0, 5.5, 8, 0.72);
    nz(d, t, { f: 'highpass', fq: 1900 * v, g: 1.4, d: 0.05, a: 0.0004 });
    nz(d, t, { fq: 700 * v, q: 0.55, g: 1.5, d: 0.2, drive: 7 });
    crushed(d, t, { fq: 1300, g: 0.8, d: 0.14, lv: 3 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 600, g: 1.7, d: 0.42, a: 0.002 });
    tone(d, t, { f0: 140 * v, f1: 34, fd: 0.2, g: 1.8, d: 0.3 });
    nz(d, t + 0.015, { n: 'brown', f: 'lowpass', fq: 210, g: 0.8, d: 0.8, a: 0.03 });
    click(d0, t + 0.32, 2400, 0.4, 0.02); click(d0, t + 0.36, 3400, 0.25, 0.015);
    return 1.1;
  } };
  // doble cañón: más estruendo que la escopeta de corredera y sin bombear
  SFX.double = { cat: 'guns', wet: 0, pri: 3, fn(d0, t) {
    const v = R(0.93, 1.03), d = dirt(d0, 8, 10, 0.7);
    nz(d, t, { f: 'highpass', fq: 1300 * v, g: 1.6, d: 0.07, a: 0.0004 });
    nz(d, t, { f: 'lowpass', fq: 6500, f1: 320, fd: 0.35, g: 1.9, d: 0.45, drive: 10 });
    crushed(d, t, { fq: 1000, g: 1.1, d: 0.26, lv: 3 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 650, g: 2.3, d: 0.7, a: 0.003 });
    tone(d, t, { f0: 105 * v, f1: 26, fd: 0.4, g: 2.3, d: 0.5 });
    tone(d, t, { f0: 46, g: 1.1, d: 0.7, a: 0.006 });
    nz(d, t + 0.02, { n: 'brown', f: 'lowpass', fq: 190, g: 1.2, d: 1.3, a: 0.04 });
    return 1.4;
  } };
  // subfusil con silenciador: un golpe sordo y el mecanismo
  SFX.smg = { cat: 'guns', wet: 0, pri: 2, fn(d0, t) {
    const d = dirt(d0, 2, 3, 0.85);
    nz(d, t, { f: 'lowpass', fq: 1800, g: 0.55, d: 0.04 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 360, g: 0.5, d: 0.07, a: 0.002 });
    tone(d, t, { f0: 140, f1: 60, g: 0.3, d: 0.05 });
    click(d0, t + 0.006, 3800, 0.3, 0.01);
    if (Math.random() < 0.3) tink(d0, t + R(0.3, 0.5));
    return 0.3;
  } };
  // lanzallamas: soplido de gas que ruge
  SFX.flame = { cat: 'guns', wet: 0.05, pri: 1, fn(d, t) {
    nz(d, t, { n: 'brown', f: 'lowpass', fq: R(380, 520), g: 0.9, d: 0.22, a: 0.03 });
    nz(d, t, { fq: R(900, 1300), q: 0.6, g: 0.35, d: 0.2, a: 0.03 });
    nz(d, t + 0.02, { f: 'highpass', fq: 3500, g: 0.1, d: 0.16, a: 0.02 });
    return 0.25;
  } };
  function pump(d, t) {
    nz(d, t, { fq: 1300, f1: 2300, q: 1, g: 0.14, d: 0.09, a: 0.03 });
    click(d, t + 0.02, 2200, 0.55, 0.03); nz(d, t + 0.02, { fq: 520, q: 1, g: 0.45, d: 0.05 });
    nz(d, t + 0.12, { fq: 2300, f1: 1300, q: 1, g: 0.12, d: 0.08, a: 0.02 });
    click(d, t + 0.19, 2500, 0.6, 0.03); nz(d, t + 0.19, { fq: 600, q: 1, g: 0.5, d: 0.05 });
    tink(d, t + 0.55);
  }
  function bolt(d, t) {
    click(d, t, 1800, 0.45, 0.025);
    nz(d, t + 0.06, { fq: 2400, f1: 3200, q: 1.5, g: 0.18, d: 0.08, a: 0.02 });
    click(d, t + 0.14, 3000, 0.35, 0.02);
    nz(d, t + 0.24, { fq: 3200, f1: 2200, q: 1.5, g: 0.18, d: 0.07, a: 0.02 });
    click(d, t + 0.33, 1700, 0.55, 0.03);
    tink(d, t + 0.6);
  }
  // casquillo de latón que rebota
  function tink(d, t) {
    const f = R(3600, 5200);
    tone(d, t, { f0: f, g: 0.06, d: 0.09 });
    tone(d, t + 0.09, { f0: f * 1.02, g: 0.035, d: 0.07 });
    tone(d, t + 0.16, { f0: f * 0.98, g: 0.02, d: 0.05 });
  }
  SFX.ui = { cat: 'fx', wet: 0, pri: 1, fn(d, t) { click(d, t, 3000, 0.18, 0.008); return 0.05; } };
  // bala que pasa silbando a tu lado
  SFX.whiz = { cat: 'guns', wet: 0.05, pri: 2, fn(d, t) {
    nz(d, t, { fq: R(2600, 3600), f1: R(900, 1300), fd: 0.12, q: 2.2, g: 0.35, d: 0.13, a: 0.01 });
    nz(d, t + 0.01, { f: 'highpass', fq: 5000, g: 0.08, d: 0.06 });
    return 0.2;
  } };
  SFX.dry = { cat: 'guns', wet: 0.05, pri: 2, fn(d, t) { click(d, t, 3200, 0.45, 0.012); tone(d, t, { f0: 1900, g: 0.08, d: 0.01 }); return 0.1; } };
  SFX.magOut = { cat: 'guns', wet: 0.05, pri: 1, fn(d, t) { click(d, t, 2800, 0.4, 0.02); nz(d, t + 0.05, { fq: 1400, q: 1, g: 0.15, d: 0.08, a: 0.02 }); return 0.2; } };
  SFX.magIn = { cat: 'guns', wet: 0.05, pri: 1, fn(d, t) { click(d, t, 1600, 0.6, 0.035); nz(d, t, { n: 'brown', f: 'lowpass', fq: 420, g: 0.45, d: 0.05 }); return 0.15; } };
  SFX.slide = { cat: 'guns', wet: 0.08, pri: 1, fn(d, t) { click(d, t, 3000, 0.5, 0.02); nz(d, t + 0.02, { fq: 2000, q: 1, g: 0.14, d: 0.06 }); click(d, t + 0.1, 2200, 0.6, 0.025); return 0.2; } };
  SFX.shellIn = { cat: 'guns', wet: 0.05, pri: 1, fn(d, t) { click(d, t, 2100, 0.45, 0.03); tone(d, t, { f0: 360, f1: 250, g: 0.18, d: 0.04 }); tone(d, t + 0.005, { f0: 3300, g: 0.04, d: 0.06 }); return 0.12; } };

  // --- arco ---
  SFX.bowDraw = { cat: 'guns', wet: 0.05, pri: 1, fn(d, t) {
    // madera y cuerda que crujen al tensar
    const s = noise('white', t, 0.8), f = filt('bandpass', 950, 9), g = gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.15); g.gain.setValueAtTime(0.85, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    const am = gain(0.5), lo = osc('square', 22, t, 0.8), lg = gain(0.5);
    lo.frequency.linearRampToValueAtTime(38, t + 0.7);
    chain(lo, lg); lg.connect(am.gain);
    chain(s, f, am, g, d);
    return 0.85;
  } };
  SFX.bowRelease = { cat: 'guns', wet: 0.08, pri: 3, fn(d, t, o) {
    const p = 0.6 + (o.k || 0.5) * 0.6;
    tone(d, t, { type: 'triangle', f0: 150, f1: 92, fd: 0.25, g: 0.7 * p, d: 0.3 });
    tone(d, t, { f0: 300, f1: 190, fd: 0.2, g: 0.3 * p, d: 0.22 });
    tone(d, t, { f0: 95, f1: 60, g: 0.6 * p, d: 0.08 });
    nz(d, t, { f: 'highpass', fq: 2600, g: 0.35 * p, d: 0.09 });
    nz(d, t + 0.02, { fq: 900, f1: 2400, q: 1, g: 0.18 * p, d: 0.18, a: 0.03 });
    return 0.45;
  } };
  SFX.arrowHit = { cat: 'guns', wet: 0.2, ref: 3, pri: 2, fn(d, t, o) {
    if (o.flesh) { nz(d, t, { fq: 900, f1: 300, q: 2.5, g: 0.6, d: 0.1 }); tone(d, t, { f0: 140, f1: 70, g: 0.6, d: 0.08 }); }
    else { tone(d, t, { f0: 280, f1: 140, g: 0.6, d: 0.07 }); nz(d, t, { fq: 1300, q: 1.2, g: 0.45, d: 0.05 }); tone(d, t + 0.005, { f0: 520, g: 0.12, d: 0.12 }); }
    return 0.25;
  } };

  // --- impactos de bala ---
  SFX.hitFlesh = { cat: 'guns', wet: 0.15, ref: 3, pri: 2, fn(d, t, o) {
    nz(d, t, { fq: 750, q: 1, g: 0.75, d: 0.06 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 260, g: 0.6, d: 0.09 });
    if (o.head) { click(d, t, 3200, 0.55, 0.02); nz(d, t + 0.01, { fq: 1200, f1: 400, q: 3, g: 0.5, d: 0.14 }); }
    return 0.25;
  } };
  SFX.hitWall = { cat: 'guns', wet: 0.1, ref: 4, pri: 1, fn(d, t) {
    nz(d, t, { fq: R(2200, 3600), q: 2, g: 0.45, d: 0.035 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 500, g: 0.25, d: 0.05 });
    if (Math.random() < 0.3) tone(d, t + 0.01, { f0: R(2600, 3400), f1: R(1100, 1500), fd: 0.28, g: 0.07, d: 0.3, a: 0.01 });   // rebote
    return 0.4;
  } };

  // --- explosiones ---
  SFX.explosion = { cat: 'guns', wet: 0, ref: 14, roll: 0.5, pri: 4, fn(d0, t) {
    const d = dirt(d0, 9, 10, 0.6);
    nz(d, t, { f: 'highpass', fq: 500, g: 1.8, d: 0.1, a: 0.0005 });
    nz(d, t, { f: 'lowpass', fq: 9000, f1: 220, fd: 1.0, g: 2.0, d: 1.2, drive: 10, a: 0.003 });         // bola de fuego
    crushed(d, t, { fq: 900, g: 1.2, d: 0.5, lv: 3 });
    crushed(d, t + 0.05, { fq: 2400, g: 0.6, d: 0.35, lv: 2 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 480, g: 2.6, d: 1.8, a: 0.005 });                          // estruendo
    tone(d, t, { f0: 70, f1: 20, fd: 1.3, g: 2.8, d: 1.5, a: 0.003 });                                  // onda grave
    tone(d, t, { f0: 150, f1: 42, fd: 0.35, g: 1.6, d: 0.4 });
    nz(d, t + 0.05, { n: 'brown', f: 'lowpass', fq: 160, g: 1.6, d: 3.0, a: 0.15 });                   // retumbo que se apaga
    // escombros y tierra cayendo
    for (let i = 0; i < 16; i++) click(d0, t + R(0.18, 1.7), R(1400, 5200), R(0.08, 0.28), R(0.015, 0.05));
    for (let i = 0; i < 5; i++) nz(d0, t + R(0.35, 1.3), { n: 'brown', f: 'lowpass', fq: 320, g: R(0.15, 0.35), d: 0.08 });
    return 3.4;
  } };
  SFX.ring = { cat: 'guns', wet: 0, pri: 4, fn(d, t) { tone(d, t, { f0: 3900, g: 0.045, d: 2.6, a: 0.05 }); tone(d, t, { f0: 3920, g: 0.03, d: 2.2, a: 0.05 }); return 2.8; } };
  // bomba de humo: estampido seco y el siseo del humo saliendo
  SFX.smokePop = { cat: 'guns', wet: 0, ref: 5, roll: 0.7, pri: 3, fn(d, t) {
    nz(d, t, { f: 'highpass', fq: 1200, g: 1.2, d: 0.06, a: 0.0005 });
    tone(d, t, { f0: 160, f1: 60, g: 1.1, d: 0.14 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 500, g: 0.8, d: 0.2 });
    nz(d, t + 0.05, { fq: 3500, f1: 2200, q: 0.7, g: 0.45, d: 2.4, a: 0.1 });
    return 2.6;
  } };
  // pitido agudo del aturdimiento por la bomba de humo
  SFX.ring2 = { cat: 'guns', wet: 0, pri: 4, fn(d, t, o) {
    const dur = o.dur || 2.5;
    tone(d, t, { f0: 6600, g: 0.05, d: dur, a: 0.03 }); tone(d, t, { f0: 6640, g: 0.035, d: dur * 0.9, a: 0.03 }); tone(d, t, { f0: 3310, g: 0.02, d: dur * 0.6, a: 0.05 });
    return dur + 0.2;
  } };
  SFX.molotov = { cat: 'guns', wet: 0.1, ref: 4, pri: 3, fn(d, t) {
    glass(d, t, 9, 0.7);
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 600, g: 0.5, d: 0.12 });
    // ¡fuuum! la gasolina prende
    const s = noise('white', t + 0.05, 1.3), f = filt('lowpass', 180), g = gain(0);
    sweep(f.frequency, t + 0.05, 180, 2600, 0.35);
    f.frequency.exponentialRampToValueAtTime(700, t + 1.2);
    g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.linearRampToValueAtTime(1.1, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    chain(s, f, shaper(3), g, d);
    nz(d, t + 0.05, { n: 'brown', f: 'lowpass', fq: 220, g: 1.2, d: 0.9, a: 0.15 });
    return 1.5;
  } };

  // --- vidrio ---
  function glass(d, t, n, k) {
    nz(d, t, { f: 'highpass', fq: 2600, g: 0.8 * k, d: 0.12 });
    nz(d, t, { fq: 1500, q: 0.7, g: 0.35 * k, d: 0.08 });
    for (let i = 0; i < n; i++) tone(d, t + R(0, 0.45) * Math.random(), { f0: R(2400, 7500), g: R(0.04, 0.16) * k, d: R(0.04, 0.3), a: 0.0005 });
  }
  SFX.glass = { cat: 'fx', wet: 0.4, ref: 4, pri: 2, fn(d, t) { glass(d, t, 18, 1); return 0.9; } };
  SFX.bottle = { cat: 'fx', wet: 0.35, ref: 4, pri: 2, fn(d, t) { glass(d, t, 10, 0.8); nz(d, t, { n: 'brown', f: 'lowpass', fq: 500, g: 0.4, d: 0.08 }); return 0.7; } };
  SFX.brick = { cat: 'fx', wet: 0.3, ref: 4, pri: 2, fn(d, t) { tone(d, t, { f0: 120, f1: 60, g: 0.9, d: 0.12 }); nz(d, t, { fq: 900, q: 0.8, g: 0.6, d: 0.08 }); click(d, t + 0.01, 2800, 0.3, 0.02); return 0.3; } };

  // --- cuerpo a cuerpo ---
  SFX.whoosh = { cat: 'fx', wet: 0.05, pri: 1, fn(d, t, o) {
    const w = o.w == null ? 0.5 : o.w, f0 = 450 + (1 - w) * 700;
    const s = noise('white', t, 0.3), f = filt('bandpass', f0, 1.3), g = gain(0);
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f0 * 3, t + 0.09); f.frequency.exponentialRampToValueAtTime(f0 * 1.2, t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 + 0.3 * w, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    chain(s, f, g, d);
    return 0.3;
  } };
  SFX.hitBlunt = { cat: 'fx', wet: 0.12, ref: 3, pri: 2, fn(d, t, o) {
    const k = o.heavy ? 1.3 : 1;
    tone(d, t, { f0: 115, f1: 52, g: 1.1 * k, d: 0.15 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 650, g: 0.95 * k, d: 0.11 });
    nz(d, t, { fq: 1500, q: 1, g: 0.45 * k, d: 0.035 });
    if (o.heavy || Math.random() < 0.35) click(d, t + 0.008, 3400, 0.5, 0.018);              // crujido de hueso
    return 0.3;
  } };
  SFX.hitBlade = { cat: 'fx', wet: 0.1, ref: 3, pri: 2, fn(d, t, o) {
    nz(d, t, { fq: 4600, f1: 2400, q: 2.5, g: 0.8, d: 0.05 });                                   // tajo
    nz(d, t + 0.01, { fq: 1500, f1: 330, q: 3, g: 1.4 * (o.heavy ? 1.3 : 1), d: 0.13 });        // carne
    tone(d, t, { f0: 120, f1: 60, g: 0.5, d: 0.07 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 300, g: 0.45, d: 0.07 });
    return 0.3;
  } };
  SFX.hitPunch = { cat: 'fx', wet: 0.1, ref: 3, pri: 2, fn(d, t, o) {
    const k = o.heavy ? 1.35 : 1;
    tone(d, t, { f0: 135, f1: 62, g: 0.95 * k, d: 0.1 });
    nz(d, t, { f: 'lowpass', fq: 1800, g: 0.6 * k, d: 0.055 });
    nz(d, t, { f: 'highpass', fq: 1900, g: 0.32, d: 0.016 });
    return 0.2;
  } };
  SFX.stomp = { cat: 'fx', wet: 0.12, ref: 3, pri: 2, fn(d, t) {
    tone(d, t, { f0: 85, f1: 40, g: 1.3, d: 0.18 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 500, g: 0.9, d: 0.12 });
    for (let i = 0; i < 5; i++) click(d, t + R(0, 0.06), R(1800, 3600), 0.3, 0.015);
    return 0.3;
  } };
  SFX.gore = { cat: 'fx', wet: 0.15, ref: 3, pri: 3, fn(d, t, o) {
    const n = o.big ? 5 : 3;
    for (let i = 0; i < n; i++) nz(d, t + R(0, o.big ? 0.3 : 0.15), { fq: R(1200, 1900), f1: R(250, 400), q: 3, g: R(0.45, 0.75), d: R(0.1, 0.2) });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 320, g: 1.0, d: 0.16 });
    tone(d, t, { f0: 95, f1: 45, g: 0.9, d: 0.14 });
    for (let i = 0; i < 4; i++) click(d, t + R(0, 0.1), R(2200, 3800), 0.35, 0.015);
    return 0.6;
  } };

  // --- puertas y ventanas ---
  function creak(d, t, dur, g) {
    const s = osc('sawtooth', R(65, 85), t, dur), f = filt('bandpass', R(800, 1100), 6), e = gain(0);
    s.frequency.linearRampToValueAtTime(R(90, 120), t + dur);
    const am = gain(0.4), lo = osc('square', R(18, 26), t, dur), lg = gain(0.4);
    lo.frequency.linearRampToValueAtTime(R(32, 45), t + dur);
    chain(lo, lg); lg.connect(am.gain);
    g *= 2.5;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.08); e.gain.setValueAtTime(g * 0.8, t + dur * 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(s, f, am, e, d);
  }
  SFX.doorOpen = { cat: 'fx', wet: 0.3, ref: 3, pri: 1, fn(d, t) { click(d, t, 2400, 0.35, 0.02); creak(d, t + 0.04, R(0.5, 0.8), 0.22); return 0.9; } };
  SFX.doorClose = { cat: 'fx', wet: 0.3, ref: 3, pri: 1, fn(d, t) { creak(d, t, 0.3, 0.12); tone(d, t + 0.3, { f0: 95, f1: 60, g: 0.7, d: 0.12 }); nz(d, t + 0.3, { n: 'brown', f: 'lowpass', fq: 500, g: 0.5, d: 0.1 }); click(d, t + 0.31, 2400, 0.35, 0.02); return 0.6; } };
  SFX.doorKick = { cat: 'fx', wet: 0.35, ref: 4, pri: 2, fn(d, t) { tone(d, t, { f0: 100, f1: 50, g: 1.1, d: 0.15 }); nz(d, t, { n: 'brown', f: 'lowpass', fq: 600, g: 0.9, d: 0.15 }); nz(d, t, { fq: 1700, q: 0.8, g: 0.5, d: 0.08 }); creak(d, t + 0.08, 0.35, 0.12); return 0.6; } };
  SFX.window = { cat: 'fx', wet: 0.25, ref: 3, pri: 1, fn(d, t) { nz(d, t, { fq: 1400, f1: 2200, q: 2, g: 0.2, d: 0.3, a: 0.06 }); click(d, t + 0.32, 2000, 0.35, 0.02); return 0.45; } };

  // --- jugador ---
  SFX.step = { cat: 'fx', wet: 0.08, pri: 0, fn(d, t, o) {
    const w = (o.w || 0.6) * 0.45;
    if (o.wood) {
      tone(d, t, { f0: R(100, 125), f1: 70, g: 0.32 * w, d: 0.055 });
      nz(d, t, { fq: R(800, 1000), q: 1.4, g: 0.14 * w, d: 0.04 });
      if (Math.random() < 0.12) creak(d, t + 0.02, 0.18, 0.04 * w);
    } else {
      nz(d, t, { fq: R(1900, 2600), q: 0.6, g: 0.16 * w, d: 0.06, a: 0.004 });
      nz(d, t + 0.018, { fq: R(2500, 3400), q: 0.8, g: 0.08 * w, d: 0.05, a: 0.003 });
      nz(d, t, { n: 'brown', f: 'lowpass', fq: 300, g: 0.18 * w, d: 0.05 });
    }
    return 0.2;
  } };
  SFX.dodge = { cat: 'fx', wet: 0.05, pri: 1, fn(d, t) { SFX.whoosh.fn(d, t, { w: 0.8 }); nz(d, t, { fq: 1400, q: 0.5, g: 0.12, d: 0.2, a: 0.04 }); nz(d, t + 0.35, { n: 'brown', f: 'lowpass', fq: 300, g: 0.4, d: 0.08 }); return 0.5; } };
  SFX.land = { cat: 'fx', wet: 0.1, pri: 1, fn(d, t) { nz(d, t, { n: 'brown', f: 'lowpass', fq: 320, g: 0.6, d: 0.1 }); nz(d, t, { fq: 1800, q: 0.6, g: 0.12, d: 0.06 }); return 0.2; } };
  SFX.rip = { cat: 'fx', wet: 0.05, pri: 1, fn(d, t) {
    const s = noise('white', t, 0.45), f = filt('bandpass', 2800, 1), am = gain(0.5), lo = osc('square', 65, t, 0.45), lg = gain(0.5), g = gain(0);
    chain(lo, lg); lg.connect(am.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.03); g.gain.setValueAtTime(0.35, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    chain(s, f, am, g, d);
    return 0.5;
  } };
  SFX.rustle = { cat: 'fx', wet: 0.03, pri: 0, fn(d, t) { nz(d, t, { fq: R(1500, 2200), q: 0.7, g: 0.12, d: 0.16, a: 0.06 }); return 0.25; } };
  SFX.pickup = { cat: 'fx', wet: 0.05, pri: 1, fn(d, t) { nz(d, t, { fq: 1700, q: 0.7, g: 0.16, d: 0.15, a: 0.04 }); tone(d, t + 0.08, { f0: R(2200, 2800), g: 0.09, d: 0.1 }); return 0.3; } };
  SFX.throwIt = { cat: 'fx', wet: 0.05, pri: 1, fn(d, t) { SFX.whoosh.fn(d, t, { w: 0.4 }); return 0.3; } };
  // voz de la protagonista (o de Tomás)
  function pv(o, base) { return o.female ? base * 1.85 : base; }
  SFX.pHurt = { cat: 'fx', wet: 0.06, pri: 3, fn(d, t, o) {
    vox(d, t, { f0: pv(o, 125), dur: R(0.2, 0.3), ct: [1.3, 1.15, 0.95, 0.8], fm: o.female ? [850, 1500, 2900] : [700, 1150, 2600], nm: 0.35, dist: 2, g: 0.5, vib: 0 });
    return 0.35;
  } };
  // humanos enemigos al recibir un golpe: un quejido de voz (no la palabra «agh» leída por la voz sintética)
  SFX.hHurt = { cat: 'fx', wet: 0.12, ref: 3, roll: 1, pri: 2, fn(d, t, o) {
    const fem = !!o.female, j = R(0.88, 1.12), hard = !!o.hard;
    const dur = hard ? R(0.32, 0.45) : R(0.18, 0.28);
    vox(d, t, { f0: (fem ? 225 : 118) * j, dur, ct: hard ? [1.25, 1.35, 1.15, 0.9, 0.7] : [1.2, 1.15, 0.95, 0.8], fm: fem ? [820, 1450, 2900] : [660, 1120, 2550],
      fm2: fem ? [700, 1250, 2800] : [520, 960, 2400], nm: 0.45, dist: hard ? 2.6 : 2, g: hard ? 0.55 : 0.45, vib: 0.02 });
    nz(d, t + 0.01, { n: 'pink', fq: fem ? 1700 : 1250, q: 1.2, g: 0.12, d: dur * 0.8, a: 0.01 });
    return dur + 0.1;
  } };
  SFX.pStrain = { cat: 'fx', wet: 0.04, pri: 2, fn(d, t, o) {
    vox(d, t, { f0: pv(o, 115), dur: 0.16, ct: [1, 1.1, 0.95], fm: o.female ? [750, 1300, 2800] : [600, 1050, 2500], nm: 0.5, dist: 3, g: 0.35 });
    return 0.2;
  } };
  SFX.pDeath = { cat: 'fx', wet: 0.15, pri: 4, fn(d, t, o) {
    vox(d, t, { f0: pv(o, 135), dur: 1.0, ct: [1.4, 1.3, 1.1, 0.85, 0.6], fm: o.female ? [850, 1450, 2900] : [700, 1100, 2600], fm2: [450, 900, 2400], nm: 0.45, dist: 3, g: 0.6, vib: 0.03 });
    return 1.2;
  } };
  SFX.pEffort = { cat: 'fx', wet: 0.04, pri: 1, fn(d, t, o) {
    vox(d, t, { f0: pv(o, 120), dur: 0.14, ct: [1.05, 1.1, 0.9], fm: o.female ? [700, 1250, 2800] : [550, 1000, 2500], nm: 0.6, dist: 1.5, g: 0.22 });
    return 0.18;
  } };
  // gemido de esfuerzo al golpear o esquivar (k: 'atk' corto, 'heavy' el golpe fuerte, 'dodge' seco)
  SFX.pGrunt = { cat: 'fx', wet: 0.04, pri: 2, fn(d, t, o) {
    const k = o.k || 'atk', fem = !!o.female, j = R(0.93, 1.08);
    const heavy = k === 'heavy', dodge = k === 'dodge';
    const dur = heavy ? R(0.26, 0.34) : (dodge ? R(0.12, 0.16) : R(0.15, 0.21));
    const fm = fem ? (heavy ? [820, 1400, 2950] : [760, 1300, 2850]) : (heavy ? [640, 1120, 2550] : [580, 1040, 2500]);
    vox(d, t, { f0: pv(o, (heavy ? 128 : 118) * j), dur, ct: heavy ? [1.0, 1.18, 1.1, 0.88, 0.7] : (dodge ? [1.15, 1.05, 0.8] : [1.05, 1.12, 0.9, 0.75]),
      fm, fm2: fem ? [680, 1200, 2800] : [520, 980, 2450], nm: dodge ? 0.85 : 0.55, dist: heavy ? 2.6 : 1.8, g: heavy ? 0.42 : (dodge ? 0.26 : 0.3) });
    // el aire que sale con el golpe
    nz(d, t + 0.01, { n: 'pink', fq: fem ? 1700 : 1300, q: 1.2, g: heavy ? 0.16 : 0.11, d: dur * 0.9, a: 0.01 });
    return dur + 0.08;
  } };
  // jadeo tras correr mucho: inspiración rápida y espiración con algo de voz (k: lo agitada que estás)
  SFX.pPant = { cat: 'fx', wet: 0.03, pri: 1, fn(d, t, o) {
    const k = Math.max(0.35, Math.min(1, o.k || 0.5)), fem = !!o.female;
    const fi = fem ? 1.25 : 1;
    const tin = R(0.14, 0.2), gap = R(0.02, 0.05), tout = R(0.22, 0.3);
    nz(d, t, { n: 'pink', fq: 1500 * fi, f1: 2300 * fi, q: 1.2, g: 0.42 * k, d: tin, a: tin * 0.6 });
    nz(d, t + tin + gap, { n: 'pink', fq: 1150 * fi, f1: 750 * fi, q: 1.0, g: 0.55 * k, d: tout, a: 0.02 });
    if (k > 0.55) vox(d, t + tin + gap, { f0: pv(o, 105), dur: tout * 0.8, ct: [1, 0.95, 0.85], fm: fem ? [700, 1250, 2800] : [520, 980, 2450], nm: 1.0, dist: 1.2, g: 0.14 * k });
    return tin + gap + tout + 0.05;
  } };

  // --- infectados ---
  // cada uno tiene su voz (más grave o más aguda, garganta distinta)
  function zv(z) {
    if (!z._vox) {
      const s = (z.look && z.look.seed) || Math.random() * 1e6;
      const r = (k) => { const x = Math.sin(s * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
      const fem = !!(z.look && z.look.female);
      // el temblante: garganta enorme, voz grave y rota
      z._vox = z.hongo ? { f0: 33 + r(1) * 4, fk: 0.62 + r(2) * 0.04 } : z.nemi ? { f0: 120 + r(1) * 20, fk: 1.25 }
        : z.temb ? { f0: 42 + r(1) * 8, fk: 0.72 + r(2) * 0.06 }
        : { f0: (fem ? 135 : 82) * (0.85 + r(1) * 0.35), fk: (fem ? 1.15 : 1) * (0.9 + r(2) * 0.2) };
    }
    return z._vox;
  }
  const fmk = (k, a) => a.map((f) => f * k);
  SFX.zGroan = { cat: 'zombies', wet: 0.35, ref: 2.5, roll: 1.1, pri: 0, zv: true, fn(d, t, o) {
    const v = o.v, dur = R(1.1, 2.1);
    vox(d, t, { f0: v.f0, dur, ct: [0.9, 1.05, 1.0, 0.92, 0.8, 0.7], fm: fmk(v.fk, [430, 880, 2350]), fm2: fmk(v.fk, [620, 1000, 2500]), nm: 0.35, dist: 2.5, g: 0.42, vib: 0.04, vibR: R(3, 6) });
    return dur + 0.1;
  } };
  SFX.zGrowl = { cat: 'zombies', wet: 0.25, ref: 2.5, roll: 1.1, pri: 1, zv: true, fn(d, t, o) {
    const v = o.v, dur = R(0.55, 1.0);
    vox(d, t, { f0: v.f0 * 0.78, dur, ct: [0.95, 1.1, 1.05, 0.9], fm: fmk(v.fk, [650, 1100, 2600]), nm: 0.55, dist: 4, g: 0.5, am: R(24, 34), amd: 0.7 });
    return dur + 0.1;
  } };
  SFX.zNotice = { cat: 'zombies', wet: 0.3, ref: 2.5, roll: 1, pri: 2, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 1.05, dur: 0.55, ct: [0.85, 0.95, 1.15, 1.3], fm: fmk(v.fk, [480, 900, 2400]), nm: 0.45, dist: 2.5, g: 0.45, am: 20, amd: 0.3 });
    return 0.65;
  } };
  SFX.zAlert = { cat: 'zombies', wet: 0.5, ref: 3.5, roll: 0.9, pri: 3, zv: true, fn(d, t, o) {
    const v = o.v, run = o.runner, dur = run ? 1.25 : 1.0;
    vox(d, t, { f0: v.f0 * (run ? 2.5 : 1.3), dur, ct: run ? [1, 1.35, 1.6, 1.5, 1.25, 0.9] : [1, 1.45, 1.6, 1.35, 1.0], fm: fmk(v.fk, run ? [820, 1350, 2900] : [700, 1150, 2650]),
      nm: run ? 0.7 : 0.6, dist: run ? 10 : 7, g: run ? 0.85 : 0.75, am: run ? 0 : 33, amd: 0.35, vib: run ? 0.05 : 0.02, vibR: 7 });
    return dur + 0.1;
  } };
  SFX.zAttack = { cat: 'zombies', wet: 0.2, ref: 2.5, pri: 3, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 1.15, dur: 0.42, ct: [1, 1.35, 1.2, 0.9], fm: fmk(v.fk, [720, 1200, 2700]), nm: 0.65, dist: 6, g: 0.6, am: R(36, 46), amd: 0.5 });
    return 0.5;
  } };
  SFX.zPain = { cat: 'zombies', wet: 0.2, ref: 2.5, pri: 2, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 1.4, dur: R(0.24, 0.34), ct: [1.3, 1.05, 0.85], fm: fmk(v.fk, [520, 950, 2450]), nm: 0.45, dist: 3, g: 0.5 });
    return 0.4;
  } };
  SFX.zDeath = { cat: 'zombies', wet: 0.3, ref: 2.5, pri: 3, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 0.95, dur: 1.4, ct: [1.15, 0.95, 0.75, 0.55, 0.42], fm: fmk(v.fk, [520, 920, 2400]), fm2: fmk(v.fk, [300, 700, 2100]), nm: 0.5, dist: 3, g: 0.55, am: 15, amd: 0.6 });
    // gorgoteo
    for (let i = 0; i < 7; i++) { const tt = t + R(0.3, 1.3), f = R(260, 800); tone(d, tt, { f0: f, f1: f * 1.6, fd: 0.03, g: 0.07, d: 0.035 }); }
    return 1.5;
  } };
  SFX.zBurn = { cat: 'zombies', wet: 0.35, ref: 3, pri: 3, zv: true, fn(d, t, o) {
    const v = o.v, dur = R(1.2, 1.7);
    vox(d, t, { f0: v.f0 * 2.2, dur, ct: [1, 1.3, 1.1, 1.4, 1.2, 0.95], fm: fmk(v.fk, [800, 1300, 2900]), nm: 0.6, dist: 9, g: 0.75, vib: 0.12, vibR: 9 });
    return dur + 0.1;
  } };
  SFX.zBite = { cat: 'zombies', wet: 0.15, ref: 2.5, pri: 3, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 1.05, dur: 0.7, ct: [1, 1.25, 1.1, 1.2, 0.9], fm: fmk(v.fk, [680, 1150, 2650]), nm: 0.7, dist: 6, g: 0.6, am: 42, amd: 0.6 });
    for (const k of [0.25, 0.5]) { click(d, t + k, 1300, 0.45, 0.04); nz(d, t + k, { fq: 900, f1: 300, q: 3, g: 0.3, d: 0.08 }); }
    return 0.8;
  } };
  // --- acechador: respiración ronca y chasquidos de la garganta (muy bajo: la pista de que está cerca) ---
  SFX.sBreath = { cat: 'zombies', wet: 0.15, ref: 2, roll: 1.4, pri: 1, fn(d, t) {
    nz(d, t, { n: 'pink', fq: 900, f1: 1500, q: 2, g: 0.22, d: 0.55, a: 0.3 });
    nz(d, t + 0.75, { n: 'pink', fq: 1300, f1: 700, q: 2, g: 0.16, d: 0.45, a: 0.1 });
    for (let i = 0; i < 3; i++) click(d, t + 0.6 + i * R(0.06, 0.1), R(1800, 2600), 0.12, 0.01);
    return 1.4;
  } };

  // --- temblante ---
  // grito mientras carga la embestida: grave, rasgado, sube de tono y retumba
  SFX.tScream = { cat: 'zombies', wet: 0.2, ref: 5, roll: 0.7, pri: 4, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 1.1, dur: 1.15, ct: [0.9, 1.2, 1.5, 1.7, 1.75, 1.5], fm: fmk(v.fk, [560, 980, 2400]), fm2: fmk(v.fk, [720, 1150, 2600]), nm: 0.85, dist: 12, g: 1.0, am: 27, amd: 0.45, vib: 0.05, vibR: 6 });
    vox(d, t + 0.02, { f0: v.f0 * 2.05, dur: 1.05, ct: [0.9, 1.15, 1.35, 1.45, 1.3], fm: fmk(v.fk, [800, 1300, 2800]), nm: 0.6, dist: 9, g: 0.45 });
    tone(d, t, { f0: 52, f1: 38, fd: 1.1, g: 0.6, d: 1.1, a: 0.15 });
    return 1.3;
  } };
  SFX.tRoar = { cat: 'zombies', wet: 0.2, ref: 5, roll: 0.7, pri: 4, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 1.3, dur: 1.0, ct: [1.5, 1.75, 1.6, 1.2, 0.9], fm: fmk(v.fk, [700, 1150, 2600]), nm: 0.8, dist: 12, g: 1.0, am: 31, amd: 0.5 });
    vox(d, t, { f0: v.f0 * 2.4, dur: 0.85, ct: [1.3, 1.45, 1.2, 0.9], fm: fmk(v.fk, [850, 1350, 2900]), nm: 0.6, dist: 8, g: 0.4 });
    return 1.1;
  } };
  // --- hongomorfo ---
  // grito atroz: un rugido grave y rasgado, debajo un chillido agudo que se quiebra y un retumbo que tiembla
  SFX.hRoar = { cat: 'zombies', wet: 0.35, ref: 8, roll: 0.5, pri: 5, zv: true, fn(d, t, o) {
    const v = o.v, dur = 2.1;
    vox(d, t, { f0: v.f0 * 1.15, dur, ct: [0.9, 1.3, 1.65, 1.8, 1.7, 1.45, 1.1, 0.8], fm: fmk(v.fk, [520, 900, 2300]), fm2: fmk(v.fk, [700, 1150, 2600]), nm: 1.0, dist: 16, g: 1.15, am: 23, amd: 0.6, vib: 0.07, vibR: 5 });
    vox(d, t + 0.05, { f0: v.f0 * 5.2, dur: dur * 0.9, ct: [0.9, 1.2, 1.45, 1.3, 1.5, 1.2, 0.9], fm: fmk(v.fk, [1100, 1900, 3400]), nm: 0.8, dist: 14, g: 0.5, vib: 0.12, vibR: 11 });
    vox(d, t + 0.02, { f0: v.f0 * 2.2, dur: dur * 0.95, ct: [1, 1.4, 1.6, 1.5, 1.2], fm: fmk(v.fk, [760, 1250, 2800]), nm: 0.7, dist: 10, g: 0.5, am: 31, amd: 0.5 });
    tone(d, t, { f0: 44, f1: 30, fd: dur, g: 0.9, d: dur, a: 0.2 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 260, g: 0.8, d: dur * 0.9, a: 0.25 });
    for (let i = 0; i < 10; i++) click(d, t + R(0.1, 1.8), R(600, 1600), R(0.15, 0.3), R(0.02, 0.05));     // gorgoteo de la garganta
    return dur + 0.3;
  } };
  // se arranca un trozo de hongo: desgarro húmedo y crujido
  SFX.hRip = { cat: 'zombies', wet: 0.15, ref: 4, pri: 3, fn(d, t) {
    nz(d, t, { fq: 900, f1: 2600, q: 1.2, g: 0.7, d: 0.35, a: 0.05 });
    nz(d, t + 0.05, { n: 'brown', f: 'lowpass', fq: 600, g: 0.8, d: 0.25 });
    for (let i = 0; i < 9; i++) click(d, t + R(0, 0.35), R(1200, 3600), R(0.25, 0.5), R(0.008, 0.025));
    for (let i = 0; i < 5; i++) { const tt = t + R(0.3, 0.7), f = R(300, 800); tone(d, tt, { f0: f, f1: f * 1.6, fd: 0.03, g: 0.08, d: 0.04 }); }
    return 0.8;
  } };
  // pared que se viene abajo: golpe sordo, ladrillos y yeso que caen, polvo
  SFX.wallBreak = { cat: 'guns', wet: 0.3, ref: 8, roll: 0.5, pri: 5, fn(d0, t, o) {
    const k = o.big ? 1.2 : 1, d = dirt(d0, 2.5, 7, 0.85);
    tone(d, t, { f0: 85, f1: 34, fd: 0.4, g: 1.8 * k, d: 0.5 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 520, g: 1.7 * k, d: 0.6 });
    nz(d, t, { fq: 1500, q: 0.6, g: 0.8 * k, d: 0.25 });
    for (let i = 0; i < 26; i++) click(d0, t + R(0.03, 1.3) * (i < 12 ? 0.5 : 1), R(500, 2400), R(0.2, 0.55), R(0.02, 0.07));
    nz(d0, t + 0.2, { n: 'pink', fq: 900, q: 0.5, g: 0.35, d: 1.4, a: 0.2 });
    return 1.9;
  } };
  // --- blindado: chasquidos secos (como placas que rozan), siseo húmedo y un chillido que hiela ---
  SFX.nClick = { cat: 'zombies', wet: 0.4, ref: 5, roll: 0.8, pri: 2, fn(d, t) {
    const n = 4 + Math.floor(R(0, 4));
    for (let i = 0; i < n; i++) { const tt = t + i * R(0.05, 0.11); click(d, tt, R(1700, 3200), R(0.35, 0.6), R(0.008, 0.016)); tone(d, tt, { f0: R(1900, 2600), g: 0.05, d: 0.03 }); }
    nz(d, t + n * 0.08, { n: 'pink', fq: 2600, f1: 1400, q: 2.5, g: 0.18, d: 0.5, a: 0.08 });
    return 1.0;
  } };
  // chasqueado: ecolocalización. Ráfagas de chasquidos de garganta, graves y huecos (resuenan como en un tubo),
  // que se aceleran y se frenan, sobre un gorgoteo ronco y con mucho eco. Cuando ya te tiene (o.hunt): más largos,
  // más seguidos y rematados con un chillido ahogado
  SFX.bClick = { cat: 'zombies', wet: 0.6, ref: 5, roll: 0.75, pri: 2, zv: true, fn(d, t, o) {
    const v = o.v, hunt = !!o.hunt;
    const n = hunt ? 7 + Math.floor(R(0, 5)) : 4 + Math.floor(R(0, 4));
    let tt = t, gap = hunt ? 0.075 : 0.12;
    for (let i = 0; i < n; i++) {
      const f = R(850, 1450);
      click(d, tt, f, R(0.55, 0.85), R(0.012, 0.022));                         // el chasquido
      nz(d, tt, { fq: f * 0.52, q: 8, g: 0.38, d: 0.06, a: 0.001 });            // la resonancia hueca
      tone(d, tt, { f0: R(150, 210), f1: 70, g: 0.28, d: 0.05 });               // el golpe grave en el pecho
      tt += gap * R(0.7, 1.3); gap *= hunt ? 0.9 : 1.06;
    }
    vox(d, t + 0.04, { f0: v.f0 * 0.5, dur: tt - t + 0.3, ct: [0.9, 1, 0.85, 1.05, 0.8], fm: [350, 760, 2000], nm: 0.95, dist: 8, g: hunt ? 0.36 : 0.22, am: R(30, 45), amd: 0.9, amSq: true });
    if (hunt) vox(d, tt + 0.05, { f0: v.f0 * 2.6, dur: 0.45, ct: [1, 1.4, 1.2, 0.9], fm: [1100, 2000, 3400], nm: 0.95, dist: 14, g: 0.32, vib: 0.12, vibR: 11 });
    return tt - t + 0.6;
  } };
  SFX.nGrowl = { cat: 'zombies', wet: 0.45, ref: 4, roll: 0.9, pri: 2, zv: true, fn(d, t, o) {
    const v = o.v, dur = R(0.9, 1.4);
    vox(d, t, { f0: v.f0 * 0.45, dur, ct: [0.9, 1.0, 0.85, 1.05, 0.8], fm: [380, 800, 2100], nm: 0.9, dist: 10, g: 0.5, am: R(38, 52), amd: 0.85, amSq: true });
    return dur + 0.1;
  } };
  SFX.nShriek = { cat: 'zombies', wet: 0.5, ref: 6, roll: 0.6, pri: 4, zv: true, fn(d, t, o) {
    const v = o.v;
    vox(d, t, { f0: v.f0 * 3.4, dur: 1.15, ct: [1.2, 1.7, 2.1, 1.9, 2.2, 1.5], fm: [1300, 2300, 3900], nm: 0.9, dist: 18, g: 0.85, vib: 0.18, vibR: 13 });
    vox(d, t + 0.03, { f0: v.f0 * 1.1, dur: 1.0, ct: [1, 1.3, 1.1, 0.8], fm: [600, 1100, 2600], nm: 0.8, dist: 12, g: 0.45, am: 47, amd: 0.8, amSq: true });
    for (let i = 0; i < 6; i++) click(d, t + R(0, 0.9), R(2500, 4500), 0.3, 0.01);
    return 1.3;
  } };
  SFX.tackle = { cat: 'fx', wet: 0.05, pri: 4, fn(d, t) {
    tone(d, t, { f0: 95, f1: 38, fd: 0.25, g: 1.6, d: 0.3 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 450, g: 1.4, d: 0.3 });
    nz(d, t, { fq: 1300, q: 0.7, g: 0.5, d: 0.08 });
    for (let i = 0; i < 4; i++) click(d, t + R(0, 0.05), R(2500, 4000), 0.35, 0.015);
    return 0.45;
  } };
  // explosión de esporas: como reventar una sandía (cáscara que cruje, pulpa que estalla y salpica)
  SFX.sporeBurst = { cat: 'guns', wet: 0, ref: 6, roll: 0.6, pri: 4, fn(d0, t, o) {
    const k = o.big ? 1.25 : 1;
    const d = dirt(d0, 3, 6, 0.85);
    for (let i = 0; i < 12; i++) click(d, t + R(0, 0.035), R(1500, 4200), R(0.3, 0.6) * k, R(0.006, 0.02));      // la cáscara
    tone(d, t, { f0: 150, f1: 42, fd: 0.2, g: 1.7 * k, d: 0.28 });                                                 // golpe sordo
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 650, g: 1.6 * k, d: 0.3 });
    for (let i = 0; i < 7; i++) nz(d, t + R(0.005, 0.14), { fq: R(1300, 2500), f1: R(180, 380), q: 3.5, g: R(0.6, 1.05) * k, d: R(0.12, 0.28) });   // pulpa
    nz(d, t + 0.02, { f: 'highpass', fq: 2400, g: 0.5 * k, d: 0.4, a: 0.01 });                                   // salpicadura
    for (let i = 0; i < 9; i++) { const tt = t + R(0.15, 0.9), f = R(280, 900); tone(d0, tt, { f0: f, f1: f * 1.7, fd: 0.03, g: 0.08, d: 0.04 }); }  // goteo
    nz(d0, t + 0.04, { n: 'pink', fq: 650, q: 0.6, g: 0.45 * k, d: 1.1, a: 0.1 });                               // soplo de esporas
    return 1.4;
  } };

  SFX.zStep = { cat: 'zombies', wet: 0.1, ref: 2, roll: 1.3, pri: 0, fn(d, t, o) {
    const w = (o.w || 0.6) * 0.6;
    if (o.heavy) { tone(d, t, { f0: 70, f1: 40, g: 0.55 * w, d: 0.1 }); }
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 360, g: 0.4 * w, d: 0.07, a: 0.003 });
    nz(d, t, { fq: R(550, 750), q: 1, g: 0.14 * w, d: 0.05 });
    if (o.drag) nz(d, t + 0.05, { fq: 520, f1: 340, q: 0.8, g: 0.12, d: 0.25, a: 0.08 });     // arrastra el pie
    return o.drag ? 0.4 : 0.15;
  } };
  SFX.bang = { cat: 'zombies', wet: 0.4, ref: 3, pri: 2, fn(d, t) {
    tone(d, t, { f0: R(80, 95), f1: 55, g: 1.1, d: 0.16 });
    nz(d, t, { n: 'brown', f: 'lowpass', fq: 520, g: 1.0, d: 0.18 });
    nz(d, t, { fq: 900, q: 1, g: 0.45, d: 0.06 });
    if (Math.random() < 0.5) creak(d, t + 0.05, 0.25, 0.06);
    return 0.4;
  } };
  SFX.doorBreak = { cat: 'zombies', wet: 0.5, ref: 4, pri: 3, fn(d, t) {
    SFX.bang.fn(d, t);
    nz(d, t + 0.02, { fq: 1800, q: 0.8, g: 1.0, d: 0.28 });
    for (let i = 0; i < 9; i++) click(d, t + R(0.05, 0.7), R(800, 2600), R(0.15, 0.35), R(0.02, 0.05));
    tone(d, t + 0.15, { f0: 70, f1: 40, g: 0.8, d: 0.25 });
    return 1.0;
  } };

  // --- fuego ---
  SFX.crackle = { cat: 'fx', wet: 0.08, ref: 2, roll: 1.2, pri: 0, fn(d, t) { click(d, t, R(1800, 5200), R(0.12, 0.35), R(0.008, 0.02)); return 0.05; } };

  // --- ambiente (sueltos y lejanos) ---
  SFX.crow = { cat: 'amb', wet: 0.6, pri: 0, fn(d, t) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const tt = t + i * R(0.38, 0.5), dur = R(0.22, 0.3);
      const s = osc('sawtooth', R(480, 560), tt, dur); s.frequency.linearRampToValueAtTime(R(380, 440), tt + dur);
      const f1 = filt('bandpass', 1150, 3), f2 = filt('bandpass', 2300, 4), g = gain(0), sh = shaper(4);
      const am = gain(0.6), lo = osc('square', 55, tt, dur), lg = gain(0.4); chain(lo, lg); lg.connect(am.gain);
      env(g, tt, 0.02, 0.22, dur);
      chain(s, sh, f1, am, g, d); sh.connect(f2); f2.connect(am);
    }
    return 1.8;
  } };
  SFX.farMoan = { cat: 'amb', wet: 1.0, pri: 0, fn(d, t) {
    const lp = filt('lowpass', 650); lp.connect(d);
    vox(lp, t, { f0: R(70, 110), dur: R(1.8, 2.8), ct: [0.9, 1.1, 1.2, 1.0, 0.8, 0.7], fm: [450, 900, 2300], fm2: [650, 1050, 2400], nm: 0.4, dist: 3, g: 0.5, vib: 0.05, vibR: 4 });
    return 3.0;
  } };
  SFX.clang = { cat: 'amb', wet: 0.9, pri: 0, fn(d, t) {
    const lp = filt('lowpass', 2600); lp.connect(d);
    const b = R(250, 380);
    for (const [k, g, dd] of [[1, 0.2, 1.6], [2.39, 0.12, 1.1], [3.83, 0.08, 0.8], [5.55, 0.05, 0.5]]) tone(lp, t, { f0: b * k, g, d: dd, a: 0.002 });
    nz(lp, t, { fq: 1200, q: 1, g: 0.2, d: 0.04 });
    return 2.0;
  } };
  SFX.creakFar = { cat: 'amb', wet: 0.7, pri: 0, fn(d, t) { creak(d, t, R(0.8, 1.4), 0.15); return 1.6; } };
  SFX.gust = { cat: 'amb', wet: 0.2, pri: 0, fn(d, t) {
    const dur = R(2, 3.5), s = noise('white', t, dur), f = filt('highpass', 2500), g = gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(R(0.06, 0.1), t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(s, f, g, d);
    return dur + 0.1;
  } };

  // ---------- Reproducir ----------
  // o: { x, z, lv (posición; sin ella suena "en ti"), vol, pan, ...parámetros de la receta }
  function play(name, o) {
    if (!ready || ctx.state !== 'running') return false;
    const S = SFX[name];
    if (!S) return false;
    o = o || {};
    const pri = S.pri || 0;
    if (active >= MAX_VOICES && pri < 3) return false;
    if (active >= MAX_VOICES - 8 && pri < 1) return false;
    let g = o.vol == null ? 1 : o.vol, pan = o.pan || 0, occl = false;
    if (o.x != null) {
      const dx = o.x - L.x, dz = o.z - L.z, d = Math.hypot(dx, dz);
      const ref = S.ref || 2.5, roll = S.roll || 1;
      if (d > ref) g *= ref / (ref + roll * (d - ref));
      if (g < 0.015) return false;
      if (d > 0.4) pan = Math.max(-0.85, Math.min(0.85, (dx * L.rx + dz * L.rz) / d));
      const lv = o.lv || 0;
      if (lv !== L.lv) { occl = true; g *= 0.6; }
      else if (d > 1.5 && G.World && G.World.hasLOS && !G.World.hasLOS(L.x, L.z, o.x, o.z, lv)) { occl = true; g *= 0.65; }
    }
    if (S.zv && o.z0) o.v = zv(o.z0);
    if (S.zv && !o.v) o.v = { f0: 85, fk: 1 };
    const t = ctx.currentTime + 0.005 + (o.delay || 0);
    const vin = gain(1);
    let tail = vin;
    if (occl) { const lp = filt('lowpass', 750, 0.7); vin.connect(lp); tail = lp; }
    let pn = null;
    if (ctx.createStereoPanner && pan) { pn = ctx.createStereoPanner(); pn.pan.value = pan; tail.connect(pn); tail = pn; }
    const out = gain(g);
    tail.connect(out);
    out.connect(bus[S.cat]);
    let wet = null;
    if (S.wet) { wet = gain(S.wet * (occl ? 1.4 : 1)); out.connect(wet); wet.connect(revIn[S.cat]); }
    let dur = 0.5;
    try { dur = S.fn(vin, t, o) || 0.5; } catch (e) { dur = 0.1; }
    active++;
    if (G.Audio.onPlay) G.Audio.onPlay(name);
    if (S.cat === 'zombies' && S.zv) zVox++;
    const zvx = S.cat === 'zombies' && S.zv;
    setTimeout(() => {
      active--; if (zvx) zVox--;
      try { out.disconnect(); if (wet) wet.disconnect(); } catch (e) { /* nada */ }
    }, (dur + (o.delay || 0) + 0.25) * 1000);
    return true;
  }

  // agacha un momento los demás canales (el disparo o la explosión manda)
  function duck(depth, rec, cats) {
    if (!ready) return;
    const t = ctx.currentTime;
    for (const c of cats || ['zombies', 'amb', 'fx']) {
      const p = duckG[c].gain;
      p.cancelScheduledValues(t); p.setValueAtTime(Math.max(0.05, p.value), t);
      p.linearRampToValueAtTime(depth, t + 0.01); p.linearRampToValueAtTime(1, t + 0.01 + rec);
    }
  }

  // ---------- Atajos para el juego ----------
  function shot(gun, sil) {
    if (gun === 'pistol') { play(sil ? 'pistolSil' : 'pistol'); if (!sil) duck(0.45, 0.35); }
    else if (gun === 'shotgun') { play('shotgun'); duck(0.3, 0.55); }
    else if (gun === 'rifle') { play('rifle'); duck(0.28, 0.6); }
    else if (gun === 'revolver') { play('revolver'); duck(0.35, 0.45); }
    else if (gun === 'double') { play('double'); duck(0.25, 0.6); }
    else if (gun === 'smg') play('smg');
    else if (gun === 'flame') play('flame');
  }
  function explosion(x, z, lv) {
    play('explosion', { x, z, lv });
    if (!ready) return;
    const d = Math.hypot(x - L.x, z - L.z);
    duck(0.12, 2.2);
    if (d < 11 && (lv || 0) === L.lv) {
      // te deja aturdido: todo suena apagado un par de segundos y un pitido en los oídos
      const t = ctx.currentTime, k = 1 - d / 11;
      muffle.frequency.cancelScheduledValues(t);
      muffle.frequency.setValueAtTime(300 + 900 * (1 - k), t + 0.05);
      muffle.frequency.exponentialRampToValueAtTime(20000, t + 1.2 + 2.2 * k);
      play('ring', { vol: 0.5 + k });
    }
  }

  // aturdido por la bomba de humo: todo apagado y un pitido agudo (más corto que el de una explosión)
  function daze(k, dur) {
    if (!ready) return;
    const t = ctx.currentTime;
    muffle.frequency.cancelScheduledValues(t);
    muffle.frequency.setValueAtTime(500 + 700 * (1 - k), t + 0.02);
    muffle.frequency.exponentialRampToValueAtTime(20000, t + dur);
    duck(0.25, dur * 0.8);
    play('ring2', { vol: 0.6 + 0.6 * k, dur });
  }

  // ---------- Bucles: viento, zumbido de fondo y fuego ----------
  let loops = null;
  function startLoops() {
    if (loops || !ready) return;
    const t = ctx.currentTime;
    const amb = gain(0);
    const lp = filt('lowpass', 3000, 0.5);
    amb.connect(lp); lp.connect(bus.amb);
    // viento: dos capas de ruido rosa con filtro y volumen que ondulan despacio (izquierda y derecha)
    for (const [p, r1, r2] of [[-0.6, 0.071, 0.113], [0.6, 0.053, 0.089]]) {
      const s = ctx.createBufferSource(); s.buffer = buf.pink; s.loop = true; s.start(t, Math.random());
      const f = filt('bandpass', 480, 0.8);
      const l1 = ctx.createOscillator(); l1.frequency.value = r1; const l1g = gain(260); chain(l1, l1g); l1g.connect(f.frequency); l1.start(t);
      const g = gain(0.55);
      const l2 = ctx.createOscillator(); l2.frequency.value = r2; const l2g = gain(0.35); chain(l2, l2g); l2g.connect(g.gain); l2.start(t);
      const n = s;
      let tail = chain(n, f, g);
      if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = p; tail.connect(pn); tail = pn; }
      tail.connect(amb);
    }
    // zumbido grave casi imperceptible (inquietud)
    const drone = gain(0.022);
    for (const f of [55, 55.6, 82.4]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(drone); o.start(t); }
    drone.connect(amb);
    // fuego: un rugido continuo cuyo volumen depende del fuego más cercano
    const fs = ctx.createBufferSource(); fs.buffer = buf.brown; fs.loop = true; fs.start(t);
    const ff = filt('lowpass', 900, 0.7), fg = gain(0);
    const fs2 = ctx.createBufferSource(); fs2.buffer = buf.white; fs2.loop = true; fs2.start(t, 0.7);
    const ff2 = filt('bandpass', 2500, 0.6), fg2 = gain(0.12);
    chain(fs, ff, fg); chain(fs2, ff2, fg2, fg);
    let ftail = fg, fpan = null;
    if (ctx.createStereoPanner) { fpan = ctx.createStereoPanner(); fg.connect(fpan); ftail = fpan; }
    ftail.connect(bus.fx);
    loops = { amb, lp, fire: fg, fpan };
  }

  // ---------- Cada fotograma ----------
  let ambT = 6, alive = false;
  const P = { step: 0, dodging: null, healing: null, dead: false, sn: 0, health: -1, blow: null, climb: null, hurtCD: 0, rust: 0, draw: 0 };
  function update(dt, player, zombies, playing) {
    if (!ready) return;
    if (ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (!loops) startLoops();
    // oyente
    if (player) {
      L.x = player.pos.x; L.z = player.pos.z; L.lv = player.lv || 0;
      const C = G.Camera, f = C && C.forward ? C.forward() : null;
      if (f) { const yaw = Math.atan2(f.x, f.z); L.rx = -Math.cos(yaw); L.rz = Math.sin(yaw); }
      const W = G.World;
      L.indoor = !!(W && W.isIndoor && W.isIndoor(Math.floor(L.x), Math.floor(L.z), L.lv));
    }
    // ecos y viento según dónde estés
    revOutIn.gain.setTargetAtTime(L.indoor ? 0.25 : 1, t, 0.3);
    revRoomIn.gain.setTargetAtTime(L.indoor ? 0.9 : 0, t, 0.3);
    loops.amb.gain.setTargetAtTime(playing ? (L.indoor ? 0.35 : 1) : 0, t, playing ? 0.8 : 0.2);
    loops.lp.frequency.setTargetAtTime(L.indoor ? 500 : 3000, t, 0.5);
    // fuego
    let fv = 0, fp = 0;
    if (playing && G.Fire && G.Fire.zones) {
      for (const zn of G.Fire.zones) {
        const dx = zn.x - L.x, dz = zn.z - L.z, d = Math.hypot(dx, dz), k = 3 / (3 + Math.max(0, d - 2));
        if (k > fv) { fv = k; fp = d > 0.5 ? (dx * L.rx + dz * L.rz) / d : 0; }
        if (d < 25 && Math.random() < dt * 14 * k) play('crackle', { x: zn.x + R(-1, 1), z: zn.z + R(-1, 1), lv: zn.lv });
      }
    }
    loops.fire.gain.setTargetAtTime(fv * 0.5, t, 0.15);
    if (loops.fpan) loops.fpan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, fp)), t, 0.15);
    if (!playing || !player) { alive = false; return; }
    if (!alive) { alive = true; P.health = player.health; P.dead = player.dead; P.step = 0; }

    // ambiente suelto: cuervos, gemidos lejanos, metal, crujidos, ráfagas
    ambT -= dt;
    if (ambT <= 0) {
      ambT = R(7, 20);
      const r = Math.random(), pan = R(-0.8, 0.8);
      if (L.indoor) play(r < 0.5 ? 'creakFar' : 'farMoan', { vol: 0.5, pan });
      else if (r < 0.28) play('crow', { vol: R(0.4, 0.8), pan });
      else if (r < 0.55) play('farMoan', { vol: R(0.5, 0.9), pan });
      else if (r < 0.7) play('clang', { vol: R(0.3, 0.6), pan });
      else if (r < 0.82) play('creakFar', { vol: 0.5, pan });
      else play('gust', { vol: 1, pan });
    }

    // --- jugador ---
    const fem = !!player.female;
    if (!player.dead) {
      const sp = player.speedNow || 0;
      if (sp > 0.35 && !player.climb && !player.struggle) {
        P.step += sp * dt;
        const run = player.running, crouch = player.stance === 'crouch' || player.stance === 'prone';
        const stride = run ? 1.45 : (crouch ? 0.62 : 0.82);
        if (P.step >= stride) { P.step = 0; play('step', { wood: L.indoor, w: run ? 1 : (crouch ? 0.35 : 0.62) }); }
      } else P.step = Math.min(P.step, 0.4);
      if (player.dodging && !P.dodging) { play('dodge'); if (Math.random() < 0.8) play('pGrunt', { k: 'dodge', female: fem }); }
      // gemido de esfuerzo con cada golpe (justo antes del impacto; el fuerte, más marcado)
      const ac = player.action;
      if (ac && ac !== P.act && (ac.weapon || ac.punch || ac.kind === 'shove' || ac.kind === 'stomp') && GRUNT_K[ac.kind] !== false) {
        const heavy = !!(ac.heavy || ac.kind === 'runatk' || ac.kind === 'finisher' || ac.exec || ac.kind === 'stomp');
        if (heavy || Math.random() < 0.75) play('pGrunt', { k: heavy ? 'heavy' : 'atk', female: fem, delay: Math.max(0, (ac.impact || 0.45) * (ac.dur || 0.5) - 0.12) });
      }
      P.act = ac;
      // jadeo: tras correr un buen rato se agita (dos respiraciones por ciclo); se calma poco a poco
      const lf = player.lf, br = lf ? lf.breath : 0;
      if (lf && br > 0.4 && !player.struggle) {
        const ph = Math.floor(lf.bt / Math.PI);
        if (P.bph != null && ph !== P.bph) play('pPant', { k: (br - 0.3) / 0.7, female: fem });
        P.bph = ph;
      } else P.bph = null;
      if (player.healing && !P.healing) play('rip');
      if (player.healing) { P.rust -= dt; if (P.rust <= 0) { P.rust = R(0.6, 1.1); play('rustle'); } }
      if (player.climb && !P.climb) play('pEffort', { female: fem });
      if (!player.climb && P.climb) play('land');
      const st = player.struggle;
      if (st && st.n > P.sn) play('pStrain', { female: fem });
      P.sn = st ? st.n : 0;
      if (player.blow && player.blow !== P.blow) play('hitPunch', { heavy: player.blow.react === 'heavy' });
    }
    P.hurtCD -= dt;
    if (P.health >= 0 && player.health < P.health - 3 && !player.dead && P.hurtCD <= 0) { P.hurtCD = 0.45; play('pHurt', { female: fem }); }
    if (player.dead && !P.dead) play('pDeath', { female: fem });
    P.dodging = player.dodging; P.healing = player.healing; P.dead = player.dead; P.health = player.health;
    P.blow = player.blow; P.climb = player.climb;

    // --- infectados (y humanos) ---
    for (const z of zombies || []) { if (z.human) human(z, dt); else zombie(z, dt); }
  }

  // humanos enemigos: pasos (botas), quejidos al recibir un golpe (como la protagonista, con su voz)
  function human(z, dt) {
    let A = z._au;
    if (!A) A = z._au = { hp: z.hp, step: 0, cd: 0 };
    const d = Math.hypot(z.pos.x - L.x, z.pos.z - L.z);
    A.cd -= dt;
    const at = { x: z.pos.x, z: z.pos.z, lv: z.lv || 0 };
    if (z.alive && z.hp < A.hp - 0.01 && A.cd <= 0 && d < 40) { A.cd = 0.4; play('pHurt', Object.assign({ female: !!z.female, vol: 0.85 }, at)); }
    A.hp = z.hp;
    if (!z.alive || d > 22) return;
    const sp = z.speedNow || 0;
    if (sp > 0.3 && z.standing) {
      A.step += sp * dt;
      const crouch = (z.crouchAmt || 0) > 0.5;
      const stride = sp > 3.2 ? 1.4 : (crouch ? 0.62 : 0.82);
      if (A.step >= stride) { A.step = 0; play('step', Object.assign({ wood: false, w: (sp > 3.2 ? 0.9 : (crouch ? 0.25 : 0.5)) }, at)); }
    }
  }

  const GRUNT_K = { search: false, bandage: false, pack: false, pickup: false, pickupHi: false, plant: false, throw: false, grab: false, shoveoff: false };
  const AWARE = { stalk: 1, hide: 1, ambush: 1, chase: 1, attack: 1, recover: 1, alert: 1, combo: 1, runatk: 1, bang: 1, tcharge: 1, tdash: 1, troar: 1 };
  function zombie(z, dt) {
    let A = z._au;
    if (!A) A = z._au = { st: z.state, hp: z.hp, t: R(1, 8), step: 0, cd: 0, alertCD: 0, gib: false };
    const d = Math.hypot(z.pos.x - L.x, z.pos.z - L.z);
    const st = z.state, prev = A.st;
    A.cd -= dt; A.alertCD -= dt;
    const at = { x: z.pos.x, z: z.pos.z, lv: z.lv || 0, z0: z };
    const near = d < 40;
    if (st !== prev && near && z.hongo) {
      if (st === 'hburst' || st === 'hkill') play('hRoar', at);
      else if (st === 'tcharge' || st === 'troar') play(Math.random() < 0.5 ? 'hRoar' : 'tScream', at);
      else if (st === 'hgrab') play('tRoar', at);
      else if (st === 'dead') play('hRoar', Object.assign({ vol: 0.8 }, at));
      A.st = st; A.hp = z.hp; return;
    }
    if (st !== prev && near && z.nemi && (st === 'ambush' || st === 'alert' || (st === 'chase' && prev !== 'recover'))) { play('nShriek', at); A.st = st; return; }
    if (st !== prev && near) {
      if (st === 'dead') { if (z.gibbed) play('gore', Object.assign({ big: true }, at)); else play('zDeath', at); }
      else if (st === 'sus') play('zNotice', at);
      else if (AWARE[st] && !AWARE[prev] && A.alertCD <= 0 && (st === 'alert' || st === 'chase')) { A.alertCD = 8; play('zAlert', Object.assign({ runner: !!z.runner && !z.temb }, at)); }
      else if ((st === 'attack' || st === 'combo' || st === 'runatk') && A.cd <= 0) { A.cd = 0.7; play('zAttack', at); }
      else if (st === 'grapple') play('zBite', at);
      else if (st === 'tcharge') play('tScream', at);
      else if (st === 'bslam') play('zAttack', at);
      else if (st === 'ambush') play('zAttack', Object.assign({ vol: 0.7 }, at));
      else if (st === 'troar') play('tRoar', at);
      else if ((st === 'burning' || st === 'burnroll') && prev !== 'burning' && prev !== 'burnroll') { A.t = R(1.5, 2.5); play('zBurn', at); }
      else if (st === 'stun' && A.cd <= 0) { A.cd = 0.4; play('zPain', at); }
    } else if (st === 'dead' && z.gibbed && !A.gib && near) play('gore', Object.assign({ big: true }, at));
    if (z.gibbed) A.gib = true;
    // golpe recibido: se queja
    if (z.alive && z.hp < A.hp - 0.01 && A.cd <= 0) { A.cd = 0.35; if (near) play('zPain', at); }
    A.st = st; A.hp = z.hp;
    if (!z.alive || !near) return;
    // gruñidos sueltos
    A.t -= dt;
    // acechador al acecho: en silencio, solo una respiración ronca y bajita si está cerca
    if (z.hongo) {
      if (A.t <= 0) { A.t = R(2.5, 4.5); if (z.state !== 'hdorm' || d < 12) play('zGrowl', at); }
    } else if (z.nemi && (st === 'stalk' || st === 'hide' || st === 'ambush')) {
      // el blindado: chasquidos y gruñidos desde donde se esconde (se oye de lejos: no sabes por dónde vendrá)
      if (A.t <= 0) { A.t = R(2.2, 4.2); if (d < 20 && st !== 'ambush') play(Math.random() < 0.65 ? 'nClick' : 'nGrowl', at); }
    } else if (z.blind && st !== 'burning' && st !== 'burnroll' && st !== 'grapple' && st !== 'held' && st !== 'grabbed') {
      // chasqueado: chasquea todo el rato (ecolocalización); más seguido y furioso si ya te tiene
      const hunt = !!z.locked || !!AWARE[st];
      if (A.t <= 0) { A.t = hunt ? R(0.9, 1.7) : R(2.4, 4.8); if (d < 32) play('bClick', Object.assign({ hunt }, at)); }
    } else if (z.stalker && (st === 'stalk' || st === 'hide' || st === 'ambush')) {
      if (A.t <= 0) { A.t = R(2.5, 4.5); if (d < 9 && st !== 'ambush') play('sBreath', at); }
    } else if (A.t <= 0) {
      if (st === 'burning' || st === 'burnroll') { A.t = R(1.8, 2.8); play('zBurn', at); }
      else if (AWARE[st]) { A.t = R(1.4, 3.2); if (zVox < 4 && d < 30) play('zGrowl', at); }
      else if (st !== 'grapple' && st !== 'held' && st !== 'grabbed') { A.t = R(5, 12); if (zVox < 3 && d < 28) play('zGroan', at); }
      else A.t = 1;
    }
    // pasos
    const sp = z.speedNow || 0;
    if (sp > 0.25 && d < 16 && z.standing) {
      A.step += sp * dt;
      const stride = sp > 2.2 ? 1.3 : 0.72;
      if (A.step >= stride) { A.step = 0; play('zStep', Object.assign({ w: (sp > 2.2 ? 1 : 0.55) * (z.hongo ? 3.2 : (z.temb ? 2 : 1)), heavy: !!z.temb, drag: !z.runner && sp < 1.6 && z.look && z.look.drag && Math.random() < 0.6 }, at)); }
    }
  }

  // ---------- Volumen ----------
  function setVol(k, v) {
    if (!(k in DEF)) return;
    vol[k] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(KEY, JSON.stringify(vol)); } catch (e) { /* sin almacenamiento */ }
    if (!ready) return;
    const t = ctx.currentTime;
    if (k === 'master') master.gain.setTargetAtTime(vol.master, t, 0.03);
    else { bus[k].gain.setTargetAtTime(vol[k], t, 0.03); revIn[k].gain.setTargetAtTime(vol[k], t, 0.03); }
  }
  // un sonido de muestra al mover el control
  function preview(k) {
    unlock();
    if (!ready) return;
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* nada */ } }
    setTimeout(() => {
      if (k === 'zombies') play('zAlert', { v: { f0: 85, fk: 1 } });
      else if (k === 'guns' || k === 'master') shot('shotgun');
      else if (k === 'amb') play('crow', { vol: 0.8 });
      else play('hitBlunt');
    }, 30);
  }

  // pruebas: dibuja una receta sin sonar y devuelve su pico y su volumen medio
  async function measure(name, o) {
    unlock();
    if (!ready) return null;
    const save = ctx, sr = 44100, oc = new OfflineAudioContext(1, sr * 4, sr);
    ctx = oc;
    const d = oc.createGain(); d.connect(oc.destination);
    o = o || {}; if (SFX[name].zv && !o.v) o.v = { f0: 85, fk: 1 };
    try { SFX[name].fn(d, 0, o); } finally { ctx = save; }
    const r = await oc.startRendering(), x = r.getChannelData(0);
    let pk = 0, ss = 0, n = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; if (a > 1e-4) { ss += a * a; n++; } }
    return { peak: +pk.toFixed(3), rms: +Math.sqrt(ss / Math.max(1, n)).toFixed(3), len: +(n / sr).toFixed(2), nan: x.some((v) => !isFinite(v)) };
  }

  init();
  G.Audio = {
    measure, list: () => Object.keys(SFX),
    play, shot, explosion, duck, daze, update, setVol, preview, unlock,
    get vol() { return vol; },
    DEF,
    get ready() { return ready; },
    get active() { return active; }
  };
})(window.Game = window.Game || {});
