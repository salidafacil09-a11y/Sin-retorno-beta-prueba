(function (G) {
  'use strict';

  // Calidad gráfica: Baja, Media, Alta o Auto (empieza según el aparato y baja sola si va lento).
  // Se guarda en el navegador. ?calidad=baja en la dirección la fuerza sin guardarla.
  //
  // pr: resolución máxima (pixel ratio) · shadows: sombras del sol · shadowMap/shadowSize: detalle y
  // tamaño de la zona con sombra · fog/far: niebla y distancia de dibujado · lights: luces de
  // habitación a la vez · interior: a qué distancia se dibujan muebles y tabiques de una casa ·
  // grass/grassFar: densidad de hierba alta y hasta dónde se ve · treeFar: a partir de dónde un árbol es una lámina plana ·
  // lod: distancias de los 3 niveles de detalle de los zombis · shadowZ: hasta dónde proyectan
  // sombra los zombis · animFar: cada cuántos fotogramas se anima un zombi lejano ·
  // buildMs: milisegundos por fotograma para construir zonas nuevas · hiN: cuántos infectados (los más cercanos)
  // llevan el cuerpo con todo el detalle · particles: partículas en el aire (polvo,
  // arena, hojas, lluvia, nieve: ver sky.js). «Muy alta» es «Alta» con partículas; el modo Auto no llega a ella
  const PRESETS = {
    baja: { name: 'Baja', pr: 1, shadows: false, shadowMap: 512, shadowSize: 14, fog: [12, 42], far: 50, lights: 1, interior: 10, grass: 0.35, grassFar: 16, treeFar: 16, lod: [10, 20], shadowZ: 0, animFar: 3, buildMs: 3, hiN: 2 },
    media: { name: 'Media', pr: 1.25, shadows: true, shadowMap: 1024, shadowSize: 16, fog: [15, 52], far: 70, lights: 2, interior: 14, grass: 0.65, grassFar: 24, treeFar: 22, lod: [14, 28], shadowZ: 14, animFar: 2, buildMs: 4, hiN: 3 },
    alta: { name: 'Alta', pr: 2, shadows: true, shadowMap: 2048, shadowSize: 22, fog: [16, 58], far: 95, lights: 4, interior: 18, grass: 1, grassFar: 30, treeFar: 30, lod: [18, 36], shadowZ: 22, animFar: 2, buildMs: 6, hiN: 5 },
    muy: { name: 'Muy alta', pr: 2, shadows: true, shadowMap: 2048, shadowSize: 22, fog: [16, 58], far: 95, lights: 4, interior: 18, grass: 1, grassFar: 30, treeFar: 30, lod: [18, 36], shadowZ: 22, animFar: 2, buildMs: 6, particles: true, hiN: 6 }
  };
  const ORDER = ['baja', 'media', 'alta', 'muy'];
  const KEY = 'ceniza.calidad', KEY30 = 'ceniza.fps30';
  const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)) &&
    (() => { try { return window.matchMedia('(pointer: coarse)').matches || !window.matchMedia('(any-pointer: fine)').matches; } catch (e) { return true; } })();

  const store = {
    get(k) { try { return window.localStorage ? localStorage.getItem(k) : null; } catch (e) { return null; } },
    set(k, v) { try { if (window.localStorage) localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };

  const forced = (typeof location !== 'undefined' && /[?&]calidad=(baja|media|alta|muy)/.exec(location.search)) || null;
  let level = forced ? forced[1] : (store.get(KEY) || 'auto');
  if (level !== 'auto' && !PRESETS[level]) level = 'auto';
  let autoLevel = isTouch ? 'media' : 'alta';
  let fps30 = store.get(KEY30) === '1';
  const listeners = [];

  // Sombras (apartado propio en las opciones): 'auto' sigue a la calidad; si no, se elige aparte. chars: si los
  // infectados y los humanos proyectan sombra; half: el mapa de sombras se rehace cada 2 fotogramas (cuesta la
  // mitad; las sombras de lo que se mueve van un poco a saltos)
  const KEYSH = 'ceniza.sombras';
  const SHADOW = {
    off: { shadows: false, shadowZ: 0 },
    baja: { shadows: true, shadowMap: 512, shadowSize: 14, shadowZ: 8 },
    media: { shadows: true, shadowMap: 1024, shadowSize: 16, shadowZ: 14 },
    alta: { shadows: true, shadowMap: 2048, shadowSize: 22, shadowZ: 22 }
  };
  const shadow = (() => { try { const o = JSON.parse(store.get(KEYSH) || '{}'); return { lvl: SHADOW[o.lvl] ? o.lvl : 'auto', chars: o.chars !== false, half: !!o.half }; } catch (e) { return { lvl: 'auto', chars: true, half: false }; } })();
  let curCache = null, curBase = null;
  function effective(base) {
    if (shadow.lvl === 'auto' && shadow.chars) return base;
    if (curBase === base && curCache) return curCache;
    const o = Object.assign({}, base, shadow.lvl === 'auto' ? {} : SHADOW[shadow.lvl]);
    if (!shadow.chars) o.shadowZ = 0;
    curBase = base; curCache = o;
    return o;
  }

  // medición para el modo Auto
  let accT = 0, accN = 0, grace = 5;

  const Q = {
    PRESETS, ORDER,
    get level() { return level; },
    get active() { return level === 'auto' ? autoLevel : level; },
    get cur() { return effective(PRESETS[level === 'auto' ? autoLevel : level]); },
    get shadow() { return shadow; },
    setShadow(k, v) {
      if (k === 'lvl' && v !== 'auto' && !SHADOW[v]) return;
      shadow[k] = k === 'lvl' ? v : !!v;
      curCache = null;
      store.set(KEYSH, JSON.stringify(shadow));
      Q.changed();
    },
    get fps30() { return fps30; },
    set(l) {
      if (l !== 'auto' && !PRESETS[l]) return;
      level = l;
      if (!forced) store.set(KEY, l);
      if (l === 'auto') autoLevel = isTouch ? 'media' : 'alta';
      grace = 5; accT = accN = 0;
      Q.changed();
    },
    setFps30(on) { fps30 = !!on; store.set(KEY30, on ? '1' : '0'); Q.changed(); },
    onChange(fn) { listeners.push(fn); },
    changed(msg) { for (const fn of listeners) fn(msg); },
    // Cada fotograma de juego: en Auto, si va por debajo de ~24 fps unos segundos, baja un escalón
    sample(dt) {
      if (level !== 'auto' || dt <= 0) return;
      if (grace > 0) { grace -= dt; return; }
      accT += dt; accN++;
      if (accT < 5) return;
      const fps = accN / accT;
      accT = accN = 0;
      const limit = fps30 ? 22 : 24;
      const i = ORDER.indexOf(autoLevel);
      if (fps < limit && i > 0) {
        autoLevel = ORDER[i - 1];
        grace = 6;
        Q.changed('Calidad automática: ' + PRESETS[autoLevel].name + ' (para ir más fluido)');
      }
    }
  };

  G.Quality = Q;
})(window.Game = window.Game || {});
