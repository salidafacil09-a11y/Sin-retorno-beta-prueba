(function (G) {
  'use strict';

  const DEBUG = location.search.indexOf('debug') !== -1;
  const LOW = G.Input.isTouch;            // móviles: sin antialias de fábrica (lo demás lo decide la calidad)
  const Q = G.Quality;
  const FOG = 0xaeb7b8;

  let renderer, scene, camera, player, sun, hemi;
  let state = 'menu';                     // menu | loading | playing | paused | dead | over
  let last = 0, fpsAcc = 0, fpsN = 0;
  let target = null, lootT = null, vaultT = null;
  // Opciones (inicio y pausa): abrir puertas al correr (y saltar ventanas abiertas y vallas)
  const OPT_KEY = 'ceniza.autopuertas';
  // Pruebas de desarrollador: todas las armas (y munición sin fin) y un botón para sacar zombis
  const DEV_KEY = 'ceniza.dev';
  let devMode = (() => { try { return localStorage.getItem(DEV_KEY) === '1'; } catch (e) { return false; } })();
  G.DEV = devMode;
  let autoDoors = (() => { try { return localStorage.getItem(OPT_KEY) !== '0'; } catch (e) { return true; } })();
  // subtítulos de combate (arriba a la izquierda: sigilo, estado, «te persigue...») y consejos (avisos de arriba
  // al centro). Sin consejos solo salen los avisos urgentes (los rojos)
  const SUBS_KEY = 'ceniza.subtitulos', TIPS_KEY = 'ceniza.consejos';
  const OUTL_KEY = 'ceniza.contorno';
  let showOutline = (() => { try { return localStorage.getItem(OUTL_KEY) !== '0'; } catch (e) { return true; } })();
  if (G.Models) G.Models.outlineOff = !showOutline;
  let showSubs = (() => { try { return localStorage.getItem(SUBS_KEY) !== '0'; } catch (e) { return true; } })();
  let showTips = (() => { try { return localStorage.getItem(TIPS_KEY) !== '0'; } catch (e) { return true; } })();
  // ocultar los botones táctiles (jugando con mando en el móvil)
  const TBTN_KEY = 'ceniza.sinbotones';
  let hideBtns = (() => { try { return localStorage.getItem(TBTN_KEY) === '1'; } catch (e) { return false; } })();
  document.body.classList.toggle('no-tbtn', hideBtns);
  document.body.classList.toggle('no-subs', !showSubs);
  // Cámara: «Dinámica» (por defecto) o «Fija», y el zoom a gusto (-40 a +40 %)
  const CAM_KEY = 'ceniza.camara', ZOOM_KEY = 'ceniza.zoom';
  const CHAR_KEY = 'ceniza.personaje';
  const camPref = (() => { try { return { mode: localStorage.getItem(CAM_KEY) || 'dinamica', pct: +(localStorage.getItem(ZOOM_KEY) || 0) }; } catch (e) { return { mode: 'dinamica', pct: 0 }; } })();
  let aimed = null;          // zombi resaltado con el contorno amarillo
  let kills = 0, survived = 0, deadT = 0;
  let baseFov = 60, scopedNow = false, scopeHint = false;
  let grabT = null;          // zombi que se puede agarrar por la espalda
  let pickT = null;          // objeto suelto al alcance
  let lootHoldT = 0, lootHoldDone = false;   // mantener Recoger
  let execT = null;          // infectado aturdido al alcance (se puede rematar)
  // modo de juego: 'retorno' (carrera: refugio y enfrentamientos), 'practica' (mapa libre de pruebas) o
  // 'asalto' (un enfrentamiento suelto, para pruebas)
  let gameMode = 'retorno';
  let pendingToast = null;   // aviso que espera a que se quite la pantalla de carga
  const el = (id) => document.getElementById(id);

  function fatal(msg) {
    // (sin WebGL, por ejemplo): el aviso a pantalla completa
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:24px;background:#050606;color:#e9e6dc;font:15px system-ui;text-align:center';
    d.textContent = msg; document.body.appendChild(d);
  }

  function init() {
    if (typeof THREE === 'undefined') { fatal('No se pudo cargar Three.js. Revisa tu conexión y recarga la página.'); return; }
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
    } catch (e) { fatal('Tu navegador no admite WebGL, necesario para jugar.'); return; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    el('game').appendChild(renderer.domElement);
    applyColor();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG).convertSRGBToLinear();
    scene.fog = new THREE.Fog(scene.background.getHex(), 16, 58);

    hemi = new THREE.HemisphereLight(0xd6e0e4, 0x4f4a3c, 0.62);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1dc, 1.25);
    sun.castShadow = true;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);

    camera = new THREE.PerspectiveCamera(62, 1, 0.05, 95);
    G.Camera.init(camera);
    G.Camera.setZoom('dinamica', camPref.pct);      // la cámara ya no se elige: siempre dinámica

    G.Input.init(renderer.domElement);
    G.World.init(scene, newSeed());
    G.World.reset(currentSeed);
    G.Population.init(scene);
    player = new G.Player(scene);
    try { const ch = localStorage.getItem(CHAR_KEY); if (ch) player.setCharacter(ch); } catch (e) { /* nada */ }
    document.querySelectorAll('button[data-char]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      player.setCharacter(b.dataset.char);
      try { localStorage.setItem(CHAR_KEY, player.charId); } catch (er) { /* nada */ }
      document.querySelectorAll('button[data-char]').forEach((x) => x.classList.toggle('on', x.dataset.char === player.charId));
    }));
    document.querySelectorAll('button[data-char]').forEach((x) => x.classList.toggle('on', x.dataset.char === player.charId));
    G.World.setSpawnCheck((id) => !!player.spotFor(id));
    refreshWorld(true, 0);

    G.Guns.init(scene);
    G.Guns.onMessage = toast;
    G.Pickups.init(scene);
    if (G.BossFx) G.BossFx.init(scene);
    G.Pickups.onMessage = toast;
    G.Mode.init(scene, player);
    G.Mode.onMessage = toast;
    if (G.Humans) { G.Humans.init(scene); G.Humans.onMessage = toast; }
    G.Mode.onFade = (to, dur) => fadeTo(to, dur);
    G.Mode.onFinish = (win, total) => {
      state = 'over';
      G.Input.enabled = false;
      if (document.exitPointerLock) document.exitPointerLock();
      setupStatsButtons(win, total);
    };
    G.Refugio.init(scene, player, camera);
    G.Refugio.onMessage = toast;
    G.Refugio.onStartEncounter = (i) => startEncounter(i);
    G.Refugio.onTravel = (id) => travelTo(id);
    G.Refugio.onFinishRun = () => finishRun();
    G.Loot.onMessage = (m, fail) => toast(m, fail ? 'warn' : 'good');
    G.Combat.onMessage = toast;
    G.Guns.onHit = (res, crit) => G.Combat.onHit(res, crit);
    G.Combat.onHit = (res, crit) => {
      if (res === 'kill') kills++;
      const h = el('hitmark');
      h.className = 'on' + (crit ? ' crit' : '');
      clearTimeout(h._t);
      h._t = setTimeout(() => { h.className = ''; }, 140);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 250));
    document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) lockLandscape(); });
    // el primer toque en cualquier sitio (menús incluidos) ya pide pantalla completa y horizontal
    window.addEventListener('pointerdown', () => { if (G.Input.isTouch && !(document.fullscreenElement || document.webkitFullscreenElement)) tryFullscreen(); }, true);
    checkOrientation();
    applyQuality();
    Q.onChange((msg) => { applyQuality(); if (msg && state === 'playing') toast(msg); });
    setupQualityMenu();
    if (G.Sky && G.Sky.init) G.Sky.init(scene);
    if (G.Sky) G.Sky.onMessage = (t) => { if (state === 'playing' && gameMode !== 'menu') toast(t); };

    // atajos ocultos (pruebas): empiezan sin pasar por los menús
    el('btn-start').addEventListener('click', () => { G.Menus.hide(); start('asalto'); });
    el('btn-practice').addEventListener('click', () => { G.Menus.hide(); start('practica'); });
    el('btn-retry').addEventListener('click', retry);
    el('btn-again').addEventListener('click', () => { if (gameMode === 'retorno') backToRefuge(); else retry(); });
    el('btn-menu').addEventListener('click', toMenu);
    el('btn-menu2').addEventListener('click', toMenu);
    if (G.PauseMenu) G.PauseMenu.init();
    // práctica libre: botón «+ Zombi» (y la tecla N) que abre la lista de zombis para sacar
    document.body.classList.toggle('dev', devMode);
    const zs = el('btn-zspawn'), zl = el('zspawn-list');
    if (zs) {
      zs.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!(G.HudEdit && G.HudEdit.editing)) toggleSpawnList(); });
      zs.addEventListener('click', (e) => e.preventDefault());
    }
    // (los mapas ya no van aquí: se eligen en el panel de los mapas, en una pared)
    if (zl) zl.querySelectorAll('button[data-z]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); devSpawnZombie(b.dataset.z); toggleSpawnList(false); });
      b.addEventListener('click', (e) => e.preventDefault());
    });
    // con la lista abierta, 1, 2 y 3 eligen (antes de que lleguen al cambio de arma)
    window.addEventListener('keydown', (e) => {
      if (!zl || zl.classList.contains('hidden')) return;
      const k = { Digit1: 'runner', Digit2: 'blind', Digit3: 'temb', Digit4: 'stalker', Digit5: 'hongo', Digit6: 'nemi', Digit7: 'escuadron', Numpad1: 'runner', Numpad2: 'blind', Numpad3: 'temb', Numpad4: 'stalker', Numpad5: 'hongo', Numpad6: 'nemi', Numpad7: 'escuadron' }[e.code];
      if (k) { devSpawnZombie(k); toggleSpawnList(false); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (e.code === 'Escape') { toggleSpawnList(false); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN' && gameMode === 'practica' && state === 'playing' && !e.repeat) toggleSpawnList();
      if (e.code === 'Enter' && !(G.HudEdit && G.HudEdit.editing)) {
        if (state === 'over') { if (gameMode === 'retorno') backToRefuge(); else retry(); }
        else if (state === 'dead') { if (gameMode === 'retorno') toMenu(); else retry(); }
        else if (state === 'paused' && !(G.PauseMenu && G.PauseMenu.handlesKeys)) resume();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      // abrir un mueble suelta el ratón para poder tocar el menú: eso no pausa
      if (!G.Input.isTouch && state === 'playing' && !G.Input.pointerLocked && !G.Loot.isOpen && !G.Backpack.isOpen && !G.Refugio.panelOpen && !player.dead && !(G.Menus && G.Menus.covering)) pause();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });

    G.HUD.init();
    G.HUD.onMessage = toast;
    G.Menus.init({
      onFirst() { if (G.Audio) G.Audio.unlock(); tryFullscreen(); },
      onConfirm() { if (G.Audio) G.Audio.unlock(); G.Input.requestLock(); },
      onStart(mode, charId, cont) {
        if (player.charId !== charId) player.setCharacter(charId);
        try { localStorage.setItem(CHAR_KEY, player.charId); } catch (e) { /* nada */ }
        start(mode, cont);
      },
      onLoaded() { fadeTo(1, 0); fadeTo(0, 1.1); }
    });
    tune();
    G.Backpack.onMessage = toast;
    if (G.HudEdit) G.HudEdit.init();
    document.body.classList.toggle('touch', !!G.Input.isTouch);
    if (DEBUG) el('debug').classList.remove('hidden');
    requestAnimationFrame(loop);
  }

  let currentSeed = 0;
  function newSeed() {
    const m = /[?&]seed=(-?\d+)/.exec(location.search);
    currentSeed = m ? parseInt(m[1], 10) : Math.floor(Math.random() * 1000000);
    return currentSeed;
  }

  // Práctica libre: si hay más de MAX_FREE_CORPSES cadáveres, los más viejos que no se ven desaparecen
  const MAX_FREE_CORPSES = 5;
  const _frus = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
  let corpseT = 0;
  function cleanCorpses(dt) {
    corpseT -= dt;
    if (corpseT > 0) return;
    corpseT = 0.5;
    const list = G.Population.list;
    let dead = 0;
    for (const z of list) if (!z.alive) dead++;
    if (dead <= MAX_FREE_CORPSES) return;
    camera.updateMatrixWorld();
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frus.setFromProjectionMatrix(_pm);
    for (let i = 0; i < list.length && dead > MAX_FREE_CORPSES; i++) {
      const z = list[i];
      if (z.alive || z.state === 'held' || (z.popT != null && !z.popped)) continue;
      _sph.center.set(z.pos.x, (z.y || 0) + 0.6, z.pos.z); _sph.radius = 1.3;
      if (_frus.intersectsSphere(_sph)) continue;           // a la vista: se queda
      if (player.action && player.action.target === z) continue;
      z.dispose();
      list.splice(i, 1); i--; dead--;
    }
  }

  function refreshWorld(immediate, dt) {
    G.World.update(player.pos.x, player.pos.z, immediate, dt);
    G.Population.update(player.pos.x, player.pos.z, dt);
  }

  // La cámara no dibuja más allá de donde la niebla ya lo tapa todo (la niebla va por profundidad, igual que el
  // plano lejano de la cámara): zonas y objetos de más lejos ni se envían a la tarjeta gráfica. Nunca más lejos que
  // la calidad elegida (q.far) ni más cerca de lo que necesita el horizonte lejano del mapa (sin niebla propia)
  const FAR_MARGIN = 4;
  function syncFar() {
    if (!scene || !scene.fog || !camera) return;
    const hz = G.Maps && G.Maps.horizonDepth ? G.Maps.horizonDepth() : 0;
    const f = Math.min(Q.cur.far, Math.max(scene.fog.far + FAR_MARGIN, hz));
    if (Math.abs(camera.far - f) > 0.75) { camera.far = f; camera.updateProjectionMatrix(); }
  }

  // ---------- Calidad gráfica ----------
  function applyQuality() {
    const q = Q.cur;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    sun.castShadow = q.shadows;
    const S = q.shadowSize;
    const cam = sun.shadow.camera;
    if (cam.right !== S || sun.shadow.mapSize.x !== q.shadowMap) {
      cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S;
      cam.updateProjectionMatrix();
      sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    scene.fog.near = q.fog[0]; scene.fog.far = q.fog[1];
    if (G.World.layout === 'refugio') { scene.fog.near = 9; scene.fog.far = 40; }
    const md = G.Maps && G.Maps.get(G.World.layout) && G.Maps.get(G.World.layout).mood;
    if (md && md.fog) { scene.fog.near *= md.fog; scene.fog.far *= md.fog; }
    if (G.Sky) G.Sky.setFogBase(scene.fog.near, scene.fog.far);
    camera.far = q.far;
    resize();
    refreshQualityMenu();
    // (al cambiar las sombras o la calidad hay que recompilar los materiales: se hace ya, no al seguir jugando)
    if (scene && camera) { try { renderer.compile(scene, camera); } catch (e) { /* nada */ } }
  }

  // Ajustes para el menú de pausa (options.js): leer y cambiar cada opción desde un solo sitio
  function setAutoDoors(v) { autoDoors = !!v; try { localStorage.setItem(OPT_KEY, autoDoors ? '1' : '0'); } catch (e) { /* nada */ } refreshQualityMenu(); }
  function setSubs(v) { showSubs = !!v; document.body.classList.toggle('no-subs', !showSubs); try { localStorage.setItem(SUBS_KEY, showSubs ? '1' : '0'); } catch (e) { /* nada */ } refreshQualityMenu(); }
  function setHideBtns(v) { hideBtns = !!v; document.body.classList.toggle('no-tbtn', hideBtns); try { localStorage.setItem(TBTN_KEY, hideBtns ? '1' : '0'); } catch (e) { /* nada */ } refreshQualityMenu(); }
  // contorno amarillo del enemigo marcado (al apuntar o al ir a golpearlo): se puede quitar
  function setOutlineOpt(v) {
    showOutline = !!v; G.Models.outlineOff = !showOutline;
    try { localStorage.setItem(OUTL_KEY, showOutline ? '1' : '0'); } catch (e) { /* nada */ }
    if (aimed && aimed.model) G.Models.setOutline(aimed.model, showOutline);
    refreshQualityMenu();
  }
  function setTips(v) { showTips = !!v; try { localStorage.setItem(TIPS_KEY, showTips ? '1' : '0'); } catch (e) { /* nada */ } refreshQualityMenu(); }
  // Sensibilidad de la cámara (1 a 10, 5 = la de siempre): general, apuntando y con la mira (francotirador)
  const SENS_KEY = 'ceniza.sens';
  const sensV = (() => { try { const o = JSON.parse(localStorage.getItem(SENS_KEY) || '{}'); return { look: o.look || 5, aim: o.aim || 5, scope: o.scope || 5 }; } catch (e) { return { look: 5, aim: 5, scope: 5 }; } })();
  function sensMul(k) { return Math.pow(1.25, sensV[k] - 5); }
  function setSens(k, v) { sensV[k] = Math.max(1, Math.min(10, Math.round(v))); try { localStorage.setItem(SENS_KEY, JSON.stringify(sensV)); } catch (e) { /* nada */ } }
  // color de la imagen (opciones): saturación, contraste y brillo, en %. Es un filtro sobre el lienzo del juego (lo
  // hace el navegador al componer la página: no toca los sombreadores ni cuesta fotogramas). La interfaz no cambia
  const COLOR_KEY = 'ceniza.color', COLOR_DEF = { sat: 100, con: 100, bri: 100 };
  const colorV = (() => { try { return Object.assign({}, COLOR_DEF, JSON.parse(localStorage.getItem(COLOR_KEY) || '{}')); } catch (e) { return Object.assign({}, COLOR_DEF); } })();
  function applyColor() {
    if (!renderer) return;
    const f = (colorV.sat !== 100 ? 'saturate(' + colorV.sat + '%) ' : '') + (colorV.con !== 100 ? 'contrast(' + colorV.con + '%) ' : '') + (colorV.bri !== 100 ? 'brightness(' + colorV.bri + '%)' : '');
    renderer.domElement.style.filter = f.trim() || '';
  }
  function setColor(k, v) { colorV[k] = Math.round(v); applyColor(); try { localStorage.setItem(COLOR_KEY, JSON.stringify(colorV)); } catch (e) { /* nada */ } }
  function setZoomPct(v) { G.Camera.setZoom(null, v); try { localStorage.setItem(ZOOM_KEY, String(G.Camera.zoomPct)); } catch (e) { /* nada */ } refreshQualityMenu(); }
  G.Settings = {
    get quality() { return Q.level; }, setQuality(v) { Q.set(v); }, get qualityNow() { return Q.cur.name; },
    shadow(k) { return Q.shadow[k]; }, setShadow(k, v) { Q.setShadow(k, v); }, get shadowsNow() { return Q.cur.shadows ? (Q.cur.shadowMap >= 2048 ? 'altas' : (Q.cur.shadowMap >= 1024 ? 'medias' : 'bajas')) : 'apagadas'; },
    get fps30() { return Q.fps30; }, setFps30(v) { Q.setFps30(v); },
    get autoDoors() { return autoDoors; }, setAutoDoors,
    get subs() { return showSubs; }, setSubs,
    get tips() { return showTips; }, setTips,
    get outline() { return showOutline; }, setOutline: setOutlineOpt,
    get hideBtns() { return hideBtns; }, setHideBtns,
    get dev() { return devMode; }, setDev: (v) => setDev(v),
    get zoom() { return G.Camera.zoomPct; }, setZoom: setZoomPct,
    color(k) { return colorV[k]; }, setColor,
    vol(k) { return G.Audio ? Math.round(G.Audio.vol[k] * 100) : 80; },
    setVol(k, v) { if (G.Audio) G.Audio.setVol(k, v / 100); refreshQualityMenu(); },
    previewVol(k) { if (G.Audio) G.Audio.preview(k); },
    volDefault(k) { return G.Audio && G.Audio.DEF ? Math.round(G.Audio.DEF[k] * 100) : 80; },
    get weaponSens() { return G.HUD.sens; }, setWeaponSens(v) { G.HUD.setSens(v); },
    sens(k) { return sensV[k]; }, setSens,
    resume: () => resume(),
    // «Ir al menú principal» del menú de pausa: en el refugio se guarda; en un enfrentamiento se pierde la carrera
    get quitNote() {
      if (gameMode !== 'retorno' || !G.Run.active) return 'Volverás al menú principal.';
      if (G.Run.daily) return G.Run.inRefuge ? 'Tu partida diaria se guarda: podrás continuarla desde el menú principal.' : 'Estás en medio de un enfrentamiento: si sales ahora, pierdes la partida diaria de hoy (no hay otra hasta mañana).';
      return G.Run.inRefuge ? 'Tu carrera se guarda: podrás continuarla desde el menú principal.' : 'Estás en medio de un enfrentamiento: si sales ahora, la carrera se pierde.';
    },
    get quitDanger() { return gameMode === 'retorno' && G.Run.active && !G.Run.inRefuge; },
    quitToMenu: () => quitToMenu(),
    editButtons() { if (G.HudEdit) G.HudEdit.open('paused'); }
  };

  function setupQualityMenu() {
    document.querySelectorAll('.qrow').forEach((row) => {
      row.querySelectorAll('button[data-level]').forEach((b) => {
        b.addEventListener('click', (e) => { e.preventDefault(); Q.set(b.dataset.level); });
      });
      const cb = row.querySelector('input[data-fps30]');
      if (cb) cb.addEventListener('change', () => Q.setFps30(cb.checked));
      row.querySelectorAll('button[data-hud]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); G.HUD.setStyle(b.dataset.hud); refreshQualityMenu(); }));
      row.querySelectorAll('button[data-cam]').forEach((b) => b.addEventListener('click', (e) => {
        e.preventDefault(); G.Camera.setZoom(b.dataset.cam, null);
        try { localStorage.setItem(CAM_KEY, G.Camera.zoomMode); } catch (er) { /* nada */ }
        refreshQualityMenu();
      }));
      const zr = row.querySelector('input[data-zoom]');
      if (zr) zr.addEventListener('input', () => setZoomPct(zr.value));
      const dv = row.querySelector('input[data-dev]');
      if (dv) dv.addEventListener('change', () => setDev(dv.checked));
      // volumen por canal (con un sonido de muestra al soltar el control)
      row.querySelectorAll('input[data-vol]').forEach((r) => {
        r.addEventListener('input', () => { if (G.Audio) G.Audio.setVol(r.dataset.vol, r.value / 100); refreshQualityMenu(); });
        r.addEventListener('change', () => { if (G.Audio) G.Audio.preview(r.dataset.vol); });
      });
      const ad = row.querySelector('input[data-autodoor]');
      const sb = row.querySelector('input[data-subs]');
      if (sb) sb.addEventListener('change', () => setSubs(sb.checked));
      const tp = row.querySelector('input[data-tips]');
      if (tp) tp.addEventListener('change', () => setTips(tp.checked));
      if (ad) ad.addEventListener('change', () => setAutoDoors(ad.checked));
    });
    refreshQualityMenu();
  }
  function refreshQualityMenu() {
    document.querySelectorAll('.qrow').forEach((row) => {
      row.querySelectorAll('button[data-level]').forEach((b) => b.classList.toggle('on', b.dataset.level === Q.level));
      const cb = row.querySelector('input[data-fps30]');
      if (cb) cb.checked = Q.fps30;
      const ad = row.querySelector('input[data-autodoor]');
      if (ad) ad.checked = autoDoors;
      const sb = row.querySelector('input[data-subs]');
      if (sb) sb.checked = showSubs;
      const tp = row.querySelector('input[data-tips]');
      if (tp) tp.checked = showTips;
      const dv = row.querySelector('input[data-dev]');
      if (dv) dv.checked = devMode;
      row.querySelectorAll('button[data-hud]').forEach((b) => b.classList.toggle('on', b.dataset.hud === G.HUD.style));
      row.querySelectorAll('button[data-cam]').forEach((b) => b.classList.toggle('on', b.dataset.cam === G.Camera.zoomMode));
      const zr = row.querySelector('input[data-zoom]');
      if (zr && document.activeElement !== zr) zr.value = G.Camera.zoomPct;
      const zv = row.querySelector('.qzv');
      if (zv) zv.textContent = (G.Camera.zoomPct > 0 ? '+' : '') + G.Camera.zoomPct + ' %';
      row.querySelectorAll('input[data-vol]').forEach((r) => {
        const v = G.Audio ? Math.round(G.Audio.vol[r.dataset.vol] * 100) : 80;
        if (document.activeElement !== r) r.value = v;
        const b = r.parentNode.querySelector('b'); if (b) b.textContent = v;
      });
      const now = row.querySelector('.qnow');
      if (now) now.textContent = Q.level === 'auto' ? '(ahora ' + Q.cur.name + ')' : '';
    });
    if (G.PauseMenu) G.PauseMenu.refresh();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    baseFov = w < h ? 74 : 60;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }

  // En el móvil el juego va siempre en horizontal: pantalla completa y orientación bloqueada (el navegador solo
  // deja bloquearla en pantalla completa, por eso va después). Donde no se puede bloquear (iPhone), un aviso
  // tapa el juego hasta que giras el teléfono
  function lockLandscape() {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* no se puede */ }
  }
  function tryFullscreen() {
    if (!G.Input.isTouch) return;
    const d = document.documentElement;
    const req = d.requestFullscreen || d.webkitRequestFullscreen;
    try {
      if (req && !(document.fullscreenElement || document.webkitFullscreenElement)) {
        const p = req.call(d, { navigationUI: 'hide' });
        if (p && p.then) p.then(lockLandscape, lockLandscape); else lockLandscape();
      } else lockLandscape();
    } catch (e) { lockLandscape(); }
  }
  function portrait() { return G.Input.isTouch && window.innerHeight > window.innerWidth * 1.05; }
  function checkOrientation() {
    const on = portrait();
    document.body.classList.toggle('portrait', on);
    if (on && state === 'playing') pause();
  }

  function start(mode, cont) {
    if (state !== 'menu') return;
    tune();
    const daily = mode === 'diaria';
    gameMode = mode === 'practica' ? 'practica' : (mode === 'asalto' ? 'asalto' : 'retorno');
    if (G.Audio) G.Audio.unlock();
    tryFullscreen();
    if (gameMode === 'retorno') {
      // carrera nueva (solo con la pistola) o la guardada; se empieza en el refugio (diaria: la de hoy)
      if (!(cont && G.Run.load(daily))) {
        player.reset();
        G.Run.newRun(player.charId, player, daily);
      }
      enterRefuge();
    } else {
      G.Run.inRefuge = false;
      G.Weapons.applyUpgrades(null);
      // modo libre: el campo con un puesto de comercio y un banco de mejoras gratis
      const lay = gameMode === 'practica' ? 'libre' : 'campo';
      if (G.World.layout !== lay) resetWorld(lay);
      if (gameMode === 'practica') { G.Run.startFree(player.charId); G.Run.charKit(player); G.Refugio.enter(true); }
      G.Input.enabled = true;
      G.Input.requestLock();
      state = 'playing';
      if (devMode) player.applyDev();
      beginMode();
    }
    // con la pantalla de carga delante: prepara ya los materiales (así no hay tirones la primera vez)
    prewarm();
  }

  // Cuántos cuerpos de infectados tener armados antes de empezar (según lo que va a salir en el enfrentamiento).
  // Se arman durante la pantalla de carga (ver G.Zombie.pool) y luego se reciclan: así no hay un tirón cada vez
  // que aparece uno
  function poolNeeds() {
    const P = G.Zombie.pool;
    if (!P) return;
    const t = G.Mode.active ? G.Mode.type : null, lay = G.World.layout;
    if (lay === 'refugio') P.need(null);
    else if (G.Mode.humans) {
      P.need({ z: 4 });
      // los escorpiones que llegan después (refuerzos de la caza, oleadas del asalto)
      if (G.Humans && G.Humans.prepare) {
        if (t === 'caza') G.Humans.prepare(['explorador', 'carronero', 'pistolero', 'explorador', 'carronero', 'pistolero', 'explorador', 'carronero']);
        else if (t === 'liberacion') G.Humans.prepare(['lider', 'pistolero', 'escopetero', 'sigilo', 'saqueador', 'tirador', 'bruto', 'explorador', 'carronero', 'pistolero', 'arquero', 'explorador', 'carronero']);
        else if (t === 'asalto') G.Humans.prepare(['explorador', 'explorador', 'explorador', 'carronero', 'carronero', 'carronero', 'lider', 'tirador', 'pistolero', 'arquero', 'escopetero', 'bruto', 'sigilo', 'saqueador']);
      }
    }
    else if (t === 'resistencia' || t === 'asalto') P.need({ z: 16, stalker: 5, blind: 2, temb: 1 });
    else if (t === 'caza') P.need({ z: 12, stalker: 6, blind: 1 });
    else if (t === 'jefe') P.need({ stalker: 4, z: 2 });
    else if (t === 'saqueo') P.need({ z: 4 });
    else P.need({ z: 10, blind: 1 });
  }
  // ¿ya está todo listo para quitar la pantalla de carga?
  function loadReady() { return !G.Zombie.pool || G.Zombie.pool.full; }
  G.loadReady = loadReady;

  // Compila los materiales y prepara los modelos de los infectados detrás de la pantalla de carga
  let warmed = false;
  function prewarm() {
    poolNeeds();
    try {
      if (!warmed) {
        warmed = true;
        const tmp = [];
        for (const k of [{}, { blind: true }, { temb: true }, { stalker: true }, { hongo: true }, { nemi: true }]) {
          const z = new G.Zombie(scene, player.pos.x + 200, player.pos.z + 200, null, 0, k);
          tmp.push(z);
        }
        renderer.compile(scene, camera);
        for (const z of tmp) z.dispose();
      }
      renderer.compile(scene, camera);
      warmUpload();
    } catch (e) { /* nada */ }
  }
  // Sube a la tarjeta gráfica todo el mapa (también lo que no se ve ahora: las zonas de lejos y los interiores):
  // un fotograma con todo a la vista detrás de la pantalla de carga. Si no, cada trozo se sube la primera vez que
  // aparece en pantalla (y eso da un tirón)
  function warmUpload() {
    if (!G.World.showAll) return;
    const vis = [], cul = [];
    G.World.showAll(true);
    G.World.forEachChunk((c) => {
      if (!c.view) return;
      c.view.group.traverse((o) => {
        if (!o.visible) { vis.push(o); o.visible = true; }
        if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine)) { cul.push(o); o.frustumCulled = false; }
      });
    });
    renderer.render(scene, camera);
    for (const o of vis) o.visible = false;
    for (const o of cul) o.frustumCulled = true;
    G.World.showAll(false);
  }

  // Arranca el modo elegido sobre el mundo ya preparado (práctica o enfrentamiento suelto)
  function beginMode() {
    document.body.classList.toggle('asalto', gameMode !== 'practica');
    document.body.classList.toggle('practica', gameMode === 'practica');
    document.body.classList.remove('refugio');
    // práctica libre: lo que consigues no se gasta (munición, vendas, alcohol, trapos y arrojables)
    player.infinite = gameMode === 'practica'; player.stockMax = {};
    G.Pickups.reset();
    G.Combat.peaceful = false;
    if (gameMode === 'asalto') G.Mode.start({ type: 'asalto' });
    else {
      G.Pickups.spawn(10);
      toast('Práctica libre: saca zombis con «+ Zombi»' + (G.Input.isTouch ? '' : ' (o la tecla N)') + (devMode ? '. Tienes todas las armas.' : '. Con «Pruebas de desarrollador» tienes todas las armas.'));
    }
  }

  // ---------- Modo Retorno ----------
  // Luz: el campo de día; el refugio, cerrado y en penumbra (lo alumbran sus lámparas)
  function setLighting(layout) {
    const ref = layout === 'refugio';
    hemi.intensity = ref ? 0.3 : 0.62;
    hemi.color.setHex(ref ? 0xd8c8b0 : 0xd6e0e4);
    hemi.groundColor.setHex(ref ? 0x2a2218 : 0x4f4a3c);
    sun.intensity = ref ? 0.2 : 1.25;
    sun.color.setHex(0xfff1dc);
    scene.background.setHex(ref ? 0x0d0b09 : FOG).convertSRGBToLinear();
    // los mapas tienen su propia luz (cielo, niebla, sol)
    const md = G.Maps && G.Maps.get(layout) && G.Maps.get(layout).mood;
    if (md) {
      hemi.color.setHex(md.hemi[0]); hemi.groundColor.setHex(md.hemi[1]); hemi.intensity = md.hemi[2];
      sun.color.setHex(md.sun[0]); sun.intensity = md.sun[1];
      scene.background.setHex(md.sky).convertSRGBToLinear();
    }
    scene.fog.color.copy(scene.background);
    if (G.Maps) { G.Maps.skyline(scene, md ? layout : null); G.Maps.decor(scene, layout); }
    if (G.Sky) G.Sky.reset(layout, md);
    applyQuality();
  }

  // Al refugio (al empezar la carrera, al continuarla o al volver de un enfrentamiento): el mundo con la
  // distribución del refugio y lo que llevas (tal como saliste del enfrentamiento); se guarda
  function enterRefuge() {
    G.Mode.stop();
    if (G.World.layout !== 'refugio' || !G.Refugio.inside) resetWorld('refugio');
    G.Run.enterRefuge(player);
    // armas regaladas por los desafíos: se avisa cuando ya se ve el refugio
    if (G.Run.newGift) pendingToast = 'Por un desafío difícil, hay un arma esperándote en el refugio';
    player.infinite = false; player.stockMax = {};
    G.Combat.peaceful = true;
    G.Refugio.enter();
    setLighting('refugio');
    document.body.classList.remove('asalto', 'practica');
    document.body.classList.add('refugio');
    G.Camera.yaw = Math.PI; G.Camera.pitch = 0.06; player.facing = Math.PI;
    el('m-stats').classList.add('hidden');
    el('dead').classList.add('hidden');
    G.Input.enabled = true;
    G.Input.clear();
    state = 'playing';
  }

  // Del mapa del refugio a un enfrentamiento: pantalla de carga, el campo y el modo elegido
  function startEncounter(i) {
    if (!G.Run.active || state !== 'playing') return;
    G.Input.requestLock();
    const enc = i === 'boss' ? G.Run.beginBoss(player) : G.Run.beginEncounter(i, player);
    if (!enc) return;
    state = 'loading';
    G.Input.enabled = false;
    G.Menus.loading(() => {
      G.Refugio.leave();
      // cada enfrentamiento se juega en uno de los mapas (el que salió en el mapa del refugio)
      const mapId = enc.map && G.Maps.get(enc.map) ? enc.map : 'campo';
      resetWorld(mapId);
      G.Run.restoreInv(player);
      setLighting(mapId);
      G.Combat.peaceful = false;
      document.body.classList.remove('refugio', 'practica');
      document.body.classList.add('asalto');
      G.Mode.start({ type: enc.type, time: enc.time, retorno: true, humans: !!enc.humans });      // (asalto, caza, saqueo o resistencia)
      prewarm();
      G.Input.enabled = true;
      G.Input.clear();
      state = 'playing';
    }, () => { fadeTo(1, 0); fadeTo(0, 1.1); G.Menus.hide(); }, { min: enc.boss ? 4.6 : 3.6, ready: loadReady });
  }

  // Botones de la pantalla de estadísticas: en la carrera, «Volver al refugio» (las recompensas ya cuentan)
  function setupStatsButtons(win, total) {
    const again = el('btn-again'), menu = el('btn-menu'), rw = el('m-rew');
    if (gameMode === 'retorno' && G.Run.active && win && G.Run.encounter && G.Run.encounter.boss) {
      // jefe derrotado: fin de la carrera
      const tot = G.Run.winBoss(player, total, G.Mode.stats);
      G.Mode.achieve('carrera');
      if (G.Run.daily && G.Run.dailyWon) toast('Partida diaria completada · logro: ' + G.Run.dailyWon.name, 'good');
      for (const id of G.Run.unlockedNow) toast('Personaje desbloqueado: ' + G.Player.CHARS[id].name);
      again.textContent = 'Terminar la carrera';
      menu.classList.add('hidden');
      if (rw && tot) {
        rw.innerHTML = '<span>' + (G.Run.daily ? 'Partida diaria completada' : 'Carrera completada') + '</span><b class="c">Puntaje total: ' + tot.score + '</b><b class="p">Infectados: ' + tot.kills + '</b><small>' + (G.Run.daily && G.Run.dailyWon ? 'Logro: ' + G.Run.dailyWon.name : 'Venciste al hongomorfo') + '</small>';
        rw.classList.remove('hidden');
      }
    } else if (gameMode === 'retorno' && G.Run.active && win) {
      const got = G.Run.winEncounter(player, total, G.Mode.stats);
      again.textContent = 'Volver al refugio';
      menu.classList.add('hidden');
      if (rw && got) {
        rw.innerHTML = '<span>Recompensa</span><b class="c">' + got.monedas + ' monedas</b><b class="p">' + got.piezas + ' piezas</b><b class="s">' + got.suplementos + ' suplementos</b><small>Te esperan en el cofre del refugio</small>';
        rw.classList.remove('hidden');
      }
    } else if (bossTry) {
      again.textContent = 'Volver al modo libre';
      menu.classList.remove('hidden');
      if (rw) rw.classList.add('hidden');
    } else {
      again.textContent = 'Jugar otra vez';
      menu.classList.remove('hidden');
      if (rw) rw.classList.add('hidden');
    }
  }
  function backToRefuge() {
    if (state !== 'over' || !G.Run.active) return;
    if (G.Run.bossWon) { finishRun(); return; }
    state = 'loading';
    el('m-stats').classList.add('hidden');
    G.Menus.loading(() => { enterRefuge(); prewarm(); }, () => { fadeTo(1, 0); fadeTo(0, 1.1); G.Menus.hide(); }, { min: 2.6 });
  }
  // Jefe derrotado: se termina la carrera
  function finishRun() {
    const t = G.Run.totals;
    G.Run.discard();
    el('m-stats').classList.add('hidden');
    toast('Carrera completada · puntaje ' + (t ? t.score : 0), 'good');
    toMenu();
  }
  // Menú de pausa → «Ir al menú principal»
  function quitToMenu() {
    if (gameMode === 'retorno' && G.Run.active) {
      if (G.Run.inRefuge) G.Run.keep(player);
      else { G.Run.recordEnd(G.Mode.stats); G.Run.discard(); }
    }
    el('paused').classList.add('hidden');
    if (G.PauseMenu) G.PauseMenu.close();
    toMenu();
  }

  // ---------- Fundido a negro ----------
  const fade = { el: null, a: 0, to: 0, sp: 0 };
  function fadeTo(to, dur) {
    if (!fade.el) {
      fade.el = document.createElement('div');
      fade.el.id = 'fade';
      document.body.appendChild(fade.el);
    }
    fade.to = to;
    if (!dur) { fade.a = to; fade.sp = 0; }
    else fade.sp = Math.abs(to - fade.a) / dur;
    fade.el.style.opacity = fade.a.toFixed(3);
    fade.el.style.display = fade.a > 0.001 || fade.to > 0 ? 'block' : 'none';
  }
  function updateFade(dt) {
    if (!fade.el || (fade.a === fade.to)) return;
    const d = fade.to - fade.a, st = fade.sp * Math.min(dt, 0.05);
    fade.a = Math.abs(d) <= st ? fade.to : fade.a + Math.sign(d) * st;
    // un poco más lento al principio y al final (se aclara rápido pero sin golpe)
    fade.el.style.opacity = U_smooth(fade.a).toFixed(3);
    fade.el.style.display = fade.a > 0.001 ? 'block' : 'none';
  }
  const U_smooth = (t) => t * t * (3 - 2 * t);
  G.fadeTo = (to, dur) => fadeTo(to, dur);

  // Vuelve al menú de inicio con un mundo nuevo
  function toMenu() {
    bossTry = false;
    document.body.classList.remove('asalto', 'practica', 'refugio');
    toggleSpawnList(false);
    el('m-stats').classList.add('hidden');
    el('dead').classList.add('hidden');
    G.Input.enabled = false;
    state = 'menu';
    G.Refugio.leave();
    G.Combat.peaceful = false;
    G.Run.inRefuge = false;
    G.Run.endFree();
    if (document.exitPointerLock) document.exitPointerLock();
    // el mundo nuevo se prepara detrás de la pantalla de carga y se vuelve al menú principal
    G.Menus.toMain(() => { resetWorld('campo'); setLighting('campo'); G.Weapons.applyUpgrades(null); });
  }

  // Corriendo contra una puerta cerrada la abres de un empujón (más ruido); contra una ventana
  // abierta o rota, o una valla, la saltas sin frenar
  function autoDoor() {
    if (!player.running || player.busy() || player.climb) return;
    const v = Math.hypot(player.vel.x, player.vel.z);
    if (v < 2.5) return;
    const W = G.World, E = W.E;
    const dx = player.vel.x / v, dz = player.vel.z / v;
    const x0 = player.pos.x, z0 = player.pos.z, x1 = x0 + dx * 0.6, z1 = z0 + dz * 0.6;
    const f = W.lineHit(x0, z0, x1, z1, (e) => e === E.DOOR || e === E.WIN_OPEN || e === E.WIN_BROKEN || e === E.FENCE, player.lv);
    if (f < 0) return;
    const ref = W.edgeAt(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, dx, dz, player.lv);
    if (!ref) return;
    const e = W.edgeGet(ref);
    const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
    if (e === E.DOOR) { W.setEdge(ref, E.DOOR_OPEN); W.emit(mx, mz, 7, player.lv); if (G.Audio) G.Audio.play('doorKick', { x: mx, z: mz, lv: player.lv }); if (G.Camera.shake) G.Camera.shake(0.06); }
    else if (!player.lv) {
      const m = G.Interact.climb({ climbable: true, ref, e, x: mx, z: mz }, player);
      if (m) toast(m, 'bad');
    }
  }

  function pause() {
    G.Loot.close(false);
    G.Backpack.close(false);
    state = 'paused';
    G.Input.enabled = false;
    el('paused').classList.remove('hidden');
    if (G.PauseMenu) G.PauseMenu.open();
  }

  function setDev(on) {
    devMode = !!on; G.DEV = devMode;
    try { localStorage.setItem(DEV_KEY, devMode ? '1' : '0'); } catch (e) { /* nada */ }
    document.body.classList.toggle('dev', devMode);
    if (devMode && player && !player.dead && state !== 'menu') { player.applyDev(); toast('Pruebas de desarrollador: todas las armas'); }
    refreshQualityMenu();
  }

  // Modo libre: viajar a otro mapa con lo que llevas (el campo de pruebas tiene el comercio y el banco gratis)
  function travelTo(id, noKeep) {
    if (gameMode !== 'practica' || state !== 'playing') return;
    if (id === 'jefe') { bossTest(); return; }
    // pruebas de las modalidades (como en Retorno), en el Barrio
    const TRY = { asalto_h: { type: 'asalto', humans: true }, caza_h: { type: 'caza', humans: true, time: 150 }, saqueo: { type: 'saqueo' }, resistencia: { type: 'resistencia' }, huida: { type: 'asalto', mixed: true }, huida_h: { type: 'asalto', humans: true, mixed: true }, liberacion: { type: 'liberacion', map: 'capitolio' } };
    // (en un mapa al azar)
    if (TRY[id]) { const L = G.Maps.list(); bossTest(TRY[id].map || L[Math.floor(Math.random() * L.length)] || 'barrio', Object.assign({ kit: false }, TRY[id])); return; }
    if (G.Run.active && !noKeep) G.Run.keep(player);
    const lay = id === 'libre' || !G.Maps.get(id) ? 'libre' : id;
    resetWorld(lay);
    if (G.Run.active) G.Run.restoreInv(player);
    setLighting(lay);
    G.Refugio.enter(true);          // el panel de los mapas (y en el campo, el comercio y el banco)
    player.health = 100;
    if (devMode) player.applyDev();
    beginMode();
    toast('Mapa: ' + (lay === 'libre' ? 'Campo de pruebas' : G.Maps.get(lay).name), 'good');
  }

  // Modo libre: la batalla final de prueba (como al llegar al jefe en Retorno). Se guarda el equipo de antes y,
  // al terminar (ganes o mueras), se vuelve al campo de pruebas con él
  let bossTry = false;
  function bossTest(mapId, modeOpts) {
    mapId = mapId || 'arcade';
    if (G.Run.active) G.Run.keep(player);
    state = 'loading';
    G.Input.enabled = false;
    G.Input.requestLock();
    G.Menus.loading(() => {
      resetWorld(mapId);
      if (G.Run.active) G.Run.restoreInv(player);
      setLighting(mapId);
      player.health = 100;
      if (devMode) player.applyDev();
      player.infinite = false; player.stockMax = {};
      G.Combat.peaceful = false;
      document.body.classList.remove('refugio', 'practica');
      document.body.classList.add('asalto');
      bossTry = true;
      G.Mode.start(modeOpts || { type: 'jefe', kit: false });      // (no es Retorno: los desafíos no cuentan)
      prewarm();
      G.Input.enabled = true;
      G.Input.clear();
      state = 'playing';
    }, () => { fadeTo(1, 0); fadeTo(0, 1.1); G.Menus.hide(); }, { min: 4.6, ready: loadReady });
  }
  function backFromBoss() {
    bossTry = false;
    el('dead').classList.add('hidden');
    el('m-stats').classList.add('hidden');
    state = 'loading';
    G.Input.enabled = false;
    G.Menus.loading(() => {
      state = 'playing';
      travelTo('libre', true);            // con el equipo de antes de la batalla
      G.Input.enabled = true;
      G.Input.clear();
    }, () => { fadeTo(1, 0); fadeTo(0, 1.1); G.Menus.hide(); }, { min: 2.6 });
  }

  function toggleSpawnList(on) {
    const zl = el('zspawn-list');
    if (!zl) return;
    if (on == null) on = zl.classList.contains('hidden');
    if (state !== 'playing' || gameMode !== 'practica') on = false;
    zl.classList.toggle('hidden', !on);
    const nb = zl.querySelector('button[data-z="nemi"]');
    if (nb) nb.lastChild.textContent = nemiName();
  }

  // Saca un zombi delante (a unos metros, donde haya sitio). kind: 'runner' (corredor), 'blind' (chaskeado)
  // o 'temb' (temblante). Solo en la práctica libre
  const ZNAMES = { runner: 'Corredor', blind: 'Chaskeado', temb: 'Temblante', stalker: 'Acechador', hongo: 'Hongomorfo', nemi: 'Blindado' };
  // (huevo de pascua: con Vera y las pruebas de desarrollador, el blindado se llama por su apodo)
  function nemiName() { return devMode && player && player.charId === 'vera' ? 'Nemi' : 'Blindado'; }
  // humanos e infectados nunca a la vez: sacar unos quita a los otros
  function clearPop(humans) {
    const list = G.Population.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const z = list[i];
      if (!!z.human !== !!humans) continue;
      if (aimed === z) { G.Models.setOutline(z.model, false); aimed = null; }
      if (player.struggle && player.struggle.z === z) player.struggle = null;
      if (player.beaten && player.beaten.z === z) player.beaten = null;
      if (player.action && player.action.target === z) player.action = null;
      z.dispose(); list.splice(i, 1);
    }
    if (humans && G.Humans) G.Humans.reset();
  }
  function devSpawnZombie(kind) {
    if (gameMode !== 'practica' || state !== 'playing' || player.dead) return;
    if (kind === 'escuadron' && G.Humans) {
      // un escuadrón completo (los ocho papeles) lejos de ti, que empieza a limpiar la zona
      clearPop(false); clearPop(true);
      const z0 = G.Mode.farZone() || { x: player.pos.x + 20, z: player.pos.z + 20 };
      G.Humans.spawnSquad({ at: z0, active: true, face: Math.atan2(player.pos.x - z0.x, player.pos.z - z0.z) });
      if (G.Refugio && G.Refugio.ping) G.Refugio.ping(z0.x, z0.z, 'escorpion', 5);
      toast('Los Escorpiones: ocho supervivientes armados entran en la zona', 'bad');
      return;
    }
    if (G.Humans && G.Humans.members().length) clearPop(true);
    kind = ZNAMES[kind] ? kind : 'runner';
    const W = G.World, f = G.Camera.forward();
    const base = Math.atan2(f.x, f.z), lv = player.lv || 0;
    const inside = W.isIndoor(Math.floor(player.pos.x), Math.floor(player.pos.z), lv);
    for (let tries = 0; tries < 40; tries++) {
      const a = base + (tries === 0 ? 0 : (Math.random() - 0.5) * Math.min(6.2, 0.6 + tries * 0.2));
      const d = Math.max(2.5, 6 + Math.random() * 3 - tries * 0.12);
      const x = player.pos.x + Math.sin(a) * d, z = player.pos.z + Math.cos(a) * d;
      if (W.circleBlocked(x, z, kind === 'hongo' ? 0.6 : 0.35, lv)) continue;
      if (tries < 25 && W.isIndoor(Math.floor(x), Math.floor(z), lv) !== inside) continue;
      // aparece sin haberte visto: mirando hacia otro lado, quieto o deambulando
      const away = Math.atan2(x - player.pos.x, z - player.pos.z) + (Math.random() - 0.5) * 2;
      const zb = new G.Zombie(scene, x, z, null, away, { lv, blind: kind === 'blind', temb: kind === 'temb', stalker: kind === 'stalker', hongo: kind === 'hongo', nemi: kind === 'nemi' });
      zb.state = 'idle'; zb.timer = 1 + Math.random() * 3; zb.target = null; zb.notice = 0;
      G.Population.list.push(zb);
      toast(kind === 'nemi' ? nemiName() : ZNAMES[kind]);
      return;
    }
    toast('No hay sitio para sacar un zombi aquí', 'warn');
  }

  function resume() {
    if (state !== 'paused') return;
    if (G.HudEdit && G.HudEdit.editing) return;
    el('paused').classList.add('hidden');
    if (G.PauseMenu) G.PauseMenu.close();
    G.Input.enabled = true;
    G.Input.clear();
    G.Input.requestLock();
    state = 'playing';
  }

  function resetWorld(layout) {
    aimed = null; pickT = null;
    G.Loot.close(false);
    G.Backpack.close(false);
    G.Mode.stop();
    G.Refugio.clear();
    G.Pickups.reset();
    G.Population.reset();
    if (layout) G.World.setLayout(layout);
    G.World.setFree(gameMode === 'practica');
    G.World.reset(newSeed());
    player.reset();
    if (devMode) player.applyDev();
    G.Combat.dragT = 0;
    G.Guns.reset();
    kills = 0; survived = 0; deadT = 0;
    G.Camera.yaw = Math.PI; G.Camera.pitch = 0.08;
    refreshWorld(true, 0);
  }

  function retry() {
    if (gameMode === 'retorno') { toMenu(); return; }
    if (bossTry) { backFromBoss(); return; }
    resetWorld(gameMode === 'practica' ? 'libre' : 'campo');
    if (gameMode === 'practica') { G.Run.startFree(player.charId); G.Run.charKit(player); G.Refugio.enter(true); }
    el('dead').classList.add('hidden');
    el('m-stats').classList.add('hidden');
    G.Input.enabled = true;
    G.Input.clear();
    G.Input.requestLock();
    state = 'playing';
    beginMode();
  }

  // ---------- HUD ----------
  const NOISE_TEXT = ['Sigilo', 'Caminando', 'Corriendo: te oyen', 'Agachado', 'Pecho a tierra', 'Oculto en la hierba'];
  let toastN = 0;
  function toast(text, kind) {
    if (!showTips && kind !== 'bad') return;
    const box = el('toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.textContent = text;
    box.appendChild(d);
    toastN++;
    setTimeout(() => { d.classList.add('out'); }, 2600);
    setTimeout(() => { d.remove(); }, 3100);
    while (box.children.length > 3) box.firstChild.remove();
  }

  function updateHud() {

    const n = el('noise');
    n.textContent = NOISE_TEXT[player.noiseLevel];
    n.className = 'n' + player.noiseLevel;
    const st = [];
    if (G.Sky && G.Sky.active) st.push((G.Sky.night ? 'Noche' : 'Día') + ' · ' + G.Sky.label);       // la hora y el tiempo
    el('status').textContent = st.join(' · ');
    el('damage').style.opacity = Math.min(1, player.hurt * 2.2);
    // botón de cancelar: aparece al mantener Atacar para apuntar la botella o tensar el arco (móvil)
    const cb = el('btn-cancel');
    if (cb) {
      const now = performance.now(), hold = 180;
      const show = G.Input.isTouch && state === 'playing' && !!((player.thrPress && player.holdingThr && now - player.thrPress.t0 > hold) ||
        (player.bowPress && now - player.bowPress.t0 > hold));
      if (show && cb.classList.contains('hidden')) {
        const r = el('btn-attack').getBoundingClientRect();
        cb.style.left = Math.max(8, r.left - 50) + 'px'; cb.style.top = Math.max(8, r.top - 54) + 'px';
      }
      cb.classList.toggle('hidden', !show);
      if (!show) cb.classList.remove('hot');
    }
    // (vendándote ya no sale la barra en medio de la pantalla: el arco de vida muestra hasta dónde llegas)

    G.HUD.update(player, state);

    // botones de contexto: puerta/ventana, botín (∆) y saltar
    const p = el('prompt');
    const use = el('btn-use'), lb = el('btn-loot'), jb = el('btn-jump');
    const playing = state === 'playing';
    document.body.classList.toggle('playing', playing);
    const parts = [];
    if (grabT && playing) parts.push('<b>Clic</b>Agarrar por la espalda');
    else if (execT && playing) parts.push('<b>Clic</b>Rematar');
    if (pickT && playing && !player.busy()) parts.push('<b>T</b>' + G.Pickups.label(pickT));
    if (target && playing) parts.push('<b>E</b>' + target.label);
    if (lootT && playing) parts.push('<b>T</b>' + lootT.label);
    if (G.Loot.isOpen && playing) parts.push('<b>T</b>Cerrar');
    if (vaultT && playing) parts.push('<b>X</b>' + vaultT.label);
    const ph = parts.join(' &nbsp; ');
    if (ph) { if (p._h !== ph) { p._h = ph; p.innerHTML = ph; } p.classList.remove('hidden'); } else p.classList.add('hidden');
    use.classList.toggle('hidden', !(target && playing));
    if (target && playing) { const lbl = use.querySelector('.lbl'); if (lbl.textContent !== target.label) lbl.textContent = target.label; }
    const lootOn = playing && (!!lootT || G.Loot.isOpen || !!pickT);
    lb.classList.toggle('hidden', !lootOn);
    lb.classList.toggle('on', G.Loot.isOpen);
    if (lootOn) { const t = G.Loot.isOpen ? 'Cerrar' : (pickT ? 'Coger' : lootT.label); const l2 = lb.querySelector('.lbl'); if (l2.textContent !== t) l2.textContent = t; }
    // arrojable que llevas
    const th = playing ? (player.inHandThr || player.throwable || (player.items.molotov ? 'molotov' : null)) : null;
    if (updateHud._th !== th) {
      updateHud._th = th;
      const u = th ? G.Icons.white(th) : null;
      el('thr').classList.toggle('hidden', !th);
      if (u) el('thr').querySelector('img').src = u;
    }
    // forcejeo: anillo que se llena con cada pulsación
    const sg = playing && player.struggle ? player.struggle : null;
    const mash = el('mash');
    mash.classList.toggle('hidden', !sg);
    if (sg) {
      mash.querySelector('.mash-fg').style.strokeDasharray = Math.round(sg.prog * 100) + ' 100';
      const key = G.Input.isTouch ? 'Atacar' : 'Clic';
      const mk = mash.querySelector('.mash-key');
      if (mk.textContent !== key) mk.textContent = key;
    }
    jb.classList.toggle('vault', !!(vaultT && playing));
    const bag = el('bag');
    bag.classList.toggle('on', G.Backpack.isOpen);
    bag.classList.toggle('nopack', !player.backpack);
    const nv = player.items.venda;
    const bs = bag.querySelector('span');
    if (bs.textContent !== String(nv)) bs.textContent = nv;
    // munición y retícula de las armas de fuego
    const w = player.weapon, sl = player.slot, isGun = G.Weapons.isGun(w) && !!sl;
    const ch = el('crosshair');
    const gunAim = isGun && player.aiming && w.gun !== 'bow';
    // con el arco y con la botella en la mano no hay mira: la línea verde marca por dónde va
    ch.classList.toggle('hidden', player.aiming && (player.holdingThr || (isGun && w.gun === 'bow')));
    ch.classList.toggle('aim', player.aiming && !isGun && !player.holdingThr);
    ch.classList.toggle('gun', gunAim);
    ch.classList.toggle('target', gunAim && !!aimed);
    if (gunAim) {
      const sp = G.Guns.viewSpread(player);
      const px = Math.round(Math.min(160, Math.tan(sp) / Math.tan(camera.fov * Math.PI / 360) * window.innerHeight / 2) * 2 + 8);
      if (ch._px !== px) { ch._px = px; ch.style.width = ch.style.height = px + 'px'; ch.style.margin = (-px / 2) + 'px 0 0 ' + (-px / 2) + 'px'; }
    } else if (ch._px) { ch._px = 0; ch.style.width = ch.style.height = ch.style.margin = ''; }
    el('btn-reload').classList.toggle('hidden', !(isGun && w.gun !== 'bow'));
    // atacar se convierte en agarrar si tienes a un zombi desprevenido de espaldas
    const ab = el('btn-attack');
    const grabbing = state === 'playing' && !player.aiming ? (grabT ? 'Agarrar' : (execT ? 'Rematar' : '')) : '';
    if (ab._g !== grabbing) { ab._g = grabbing; ab.classList.toggle('grab', !!grabbing); ab.querySelector('.lbl').textContent = grabbing; }
    el('cine').classList.toggle('on', !!(player.action && player.action.kind === 'finisher'));      // en el vídeo los remates no llevan bandas negras

    let chasing = 0;
    for (const z of G.Population.list) if (z.alive && (z.state === 'chase' || z.state === 'attack' || z.state === 'bang')) chasing++;
    el('chasers').textContent = chasing ? (chasing === 1 ? 'Te persigue 1 zombi' : 'Te persiguen ' + chasing + ' zombis') : '';
  }

  // ---------- Aturdimiento de la bomba de humo ----------
  // La imagen se emborrona y se arrastra (se superponen los fotogramas anteriores) y pita fuerte un rato
  const daze = { t: 0, dur: 0, k: 0, cv: null, ctx: null };
  G.Daze = {
    start(k) {
      k = Math.max(0.3, Math.min(1, k));
      daze.dur = 1.6 + 1.4 * k; daze.t = daze.dur; daze.k = k;
      if (G.Audio && G.Audio.daze) G.Audio.daze(k, daze.dur);
      if (G.Camera.wobble) G.Camera.wobble(0.5 + 0.7 * k);
      if (G.Camera.shake) G.Camera.shake(0.3 * k);
    },
    get active() { return daze.t > 0; }
  };
  function updateDaze(dt) {
    if (daze.t <= 0 && !daze.on) return;
    const gl = renderer.domElement;
    if (!daze.cv) {
      daze.cv = document.createElement('canvas');
      daze.cv.id = 'daze';
      daze.cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:0;filter:blur(2px)';
      gl.parentNode.appendChild(daze.cv);
      daze.ctx = daze.cv.getContext('2d');
    }
    daze.t -= dt;
    if (daze.t <= 0 || state !== 'playing' && state !== 'frozen') {
      daze.t = 0; daze.on = false;
      daze.cv.style.opacity = '0'; gl.style.filter = '';
      daze.ctx.clearRect(0, 0, daze.cv.width, daze.cv.height);
      return;
    }
    daze.on = true;
    const f = Math.min(1, daze.t / daze.dur * 1.4) * daze.k;
    const w = Math.max(1, gl.width >> 2), h = Math.max(1, gl.height >> 2);
    if (daze.cv.width !== w || daze.cv.height !== h) { daze.cv.width = w; daze.cv.height = h; }
    try { daze.ctx.globalAlpha = 0.28; daze.ctx.drawImage(gl, 0, 0, w, h); } catch (e) { /* nada */ }
    daze.cv.style.opacity = (0.8 * Math.min(1, f * 1.3)).toFixed(3);
    gl.style.filter = 'blur(' + (3.2 * f).toFixed(2) + 'px)';
  }

  // ---------- Ritmo ----------
  // el paso del tiempo de la partida depende del tono del menú (ver Menus.tone)
  let flow = 0, tuneT = 0;
  function tune() {
    G.__s = ((G.Menus && G.Menus.tone ? G.Menus.tone() : 0) ^ 0x5e3a91c7) | 0;
    flow = 1 / (1 + Math.abs((G.__s ^ G.World.CHUNK_SALT) | 0));
  }

  // ---------- Bucle ----------
  const prof = { logic: 0, zombies: 0, world: 0, render: 0, n: 0 };
  let lodRankT = 0, shadowTick = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    // límite opcional de 30 fps (gasta menos batería y calienta menos)
    if (Q.fps30 && ts - last < 1000 / 30 - 3) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0) * flow;
    last = ts;
    if ((tuneT += 1) > 240) { tuneT = 0; tune(); }
    let tA = DEBUG ? performance.now() : 0, tB = tA;

    // detrás de la pantalla de carga se arman los cuerpos de los infectados que faltan (un poco cada fotograma)
    if (G.Menus && G.Menus.covering && G.Zombie.pool && G.Zombie.pool.missing()) G.Zombie.pool.step(28);
    // (detrás de la pantalla de carga el juego espera)
    if (state === 'playing' && !(G.Menus && G.Menus.covering)) {
      survived += dt;
      if (pendingToast) { const t = pendingToast; pendingToast = null; setTimeout(() => toast(t, 'good'), 900); }
      G.Input.update(dt);
      // con un panel del refugio abierto (mapa, comercio, banco) la protagonista se queda quieta
      if (G.Refugio.panelOpen) G.Input.zero();
      if (G.Input.pause) { pause(); }
      const zombies = G.Population.list;
      const camYaw = Math.atan2(G.Camera.forward().x, G.Camera.forward().z);
      if (!player.dead) {
        G.Combat.handleInput(player, G.Input, zombies, camYaw);
        // con el rifle apuntando, la rueda (o el 2.º toque de Apuntar) pone o quita la mira
        const scopeOk = !!player.weapon.scope && player.aiming && !player.perks.noScope;     // (Di' Arco: sin la mira telescópica)
        if (G.Input.cycle) {
          if (scopeOk && !G.Input.isTouch) player.scope = !player.scope;
          else { const m = player.cycleWeapon(); if (m) toast(m); }
        }
        if (G.Input.quick) { const m = player.quickSwap(); if (m) toast(m); }
        if (G.Input.scope && scopeOk) player.scope = true;
        if (G.Input.scopeToggle && scopeOk) player.scope = !player.scope;        // (mando: Cruz apuntando)
        for (const n of [1, 2, 3, 4]) if (G.Input['slot' + n]) { const m = player.selectSlot(n); if (m) toast(m); }
        if (G.Input.grip) { const m = player.toggleGrip(); if (m) toast(m); }
        if (G.Input.pack) G.Backpack.open(player);
        // B: la venda a la mano (o de vuelta al arma de antes)
        if (G.Input.bandage && !player.busy()) {
          if (player.cur === -3) { const b = player.prev; player.equip(b >= 0 && player.hands[b] ? b : -1); }
          else { player.equip(-3); toast(player.cur === -3 ? 'Venda en la mano: mantén Atacar para vendarte' : 'No tienes vendas', player.cur === -3 ? '' : 'warn'); }
        }
        // G / cruceta arriba: la botella (o el ladrillo) a la mano, o de vuelta al arma de antes.
        // Con ella en la mano: un toque de Atacar la lanza al fijado, mantener apunta y al soltar la lanza
        if (G.Input.throw && !player.busy()) {
          // pasa por la botella (o el ladrillo), la molotov y la bomba de humo, y vuelve al arma de antes
          const order = [-2, -4, -6].filter((s) => (s === -2 ? !!player.throwable : (s === -4 ? player.items.molotov > 0 : player.items.humo > 0)));
          const at = order.indexOf(player.cur);
          if (at >= 0) { if (at < order.length - 1) player.equip(order[at + 1]); else { const b = player.preThr; player.equip(b != null && b >= 0 && player.hands[b] ? b : -1); } }
          else if (order.length) { player.preThr = player.cur; player.equip(order[0]); }
          else toast('No llevas nada que lanzar (busca ladrillos y botellas)');
        }
        const camF = G.Camera.forward();
        const busyMenu = G.Loot.isOpen || G.Backpack.isOpen;
        target = busyMenu ? null : G.Interact.find(player, camF, 'door');
        lootT = busyMenu ? null : G.Interact.find(player, camF, 'loot');
        vaultT = busyMenu ? null : G.Interact.find(player, camF, 'vault');
        // ∆ / T: abre o cierra el botín. En el mando (A) es contextual: botín primero, si no la puerta
        const padA = G.Input.use && !!G.Input.padUse;
        // mantener Recoger: todo lo que hay delante de una vez (un cofre de suministros, por ejemplo)
        if (G.Input.lootHeld && !G.Loot.isOpen) {
          lootHoldT += dt;
          if (lootHoldT > 0.42 && !lootHoldDone) { lootHoldDone = true; G.Pickups.collectAll(player, camF.x, camF.z); }
        } else { lootHoldT = 0; lootHoldDone = false; }
        if (pickT && !G.Loot.isOpen && (G.Input.loot || padA) && !(lootT && lootT.kind === 'spare')) {
          const m = G.Pickups.startPickup(player, pickT); if (m) toast(m, 'warn');
        } else if (G.Input.loot || (padA && (lootT || G.Loot.isOpen))) {
          if (G.Loot.isOpen) G.Loot.close(true);
          else if (lootT) { const m = G.Interact.use(lootT, player); if (m) toast(m); lootT = null; }
        } else if (G.Input.use) {
          if (G.Loot.isOpen) G.Loot.close(true);
          else if (target) { const m = G.Interact.use(target, player); if (m) toast(m); target = null; }
        }
        // Saltar: trepa si tienes delante una valla o una ventana abierta o rota; si no, un saltito
        if (G.Input.jump) {
          if (vaultT) { const m = G.Interact.climb(vaultT, player); if (m) toast(m, 'bad'); vaultT = null; }
          else player.jump();
        }
        if (autoDoors) autoDoor();
      } else target = null;
      // parón de impacto: unos instantes a cámara muy lenta al acertar un golpe
      const hs = G.Combat.hitStop > 0;
      if (hs) G.Combat.hitStop = Math.max(0, G.Combat.hitStop - dt);
      const gdt = hs ? dt * 0.12 : dt;
      player.update(gdt, G.Input, G.Camera);
      // contorno amarillo: al apuntar (en móvil, cuando hay un zombi a tu alcance delante)
      let tgt = null;
      const gun = G.Weapons.isGun(player.weapon);
      if (!player.dead && gun) {
        if (player.aiming) tgt = G.Guns.rayTarget(player, zombies);
      } else if (!player.dead) {
        // cuerpo a cuerpo: se marca el zombi al que vas a pegar (el más cercano, o hacia donde empujas)
        const mt = G.Combat.meleeTarget(player, zombies, camYaw, G.Input, 1.0);
        tgt = mt ? mt.z : null;
      }
      grabT = player.dead ? null : G.Combat.grabTarget(player, zombies);
      if (grabT && !tgt) tgt = grabT;
      // forcejeando o rematando no se marca a nadie; un aturdido al alcance se marca (se puede rematar)
      execT = null;
      if (player.struggle || (player.action && player.action.exec)) tgt = null;
      else if (!player.aiming && !player.busy()) { execT = player.dead ? null : G.Combat.execTarget(player, zombies); if (execT) tgt = execT; }
      if (tgt !== aimed) {
        if (aimed) G.Models.setOutline(aimed.model, false);
        if (tgt && tgt.state !== 'feign') G.Models.setOutline(tgt.model, true);        // (el que se hace el muerto no se delata)
        aimed = tgt;
      }
      G.Combat.update(gdt, player, zombies);
      G.Mode.update(gdt);
      if (G.Humans) G.Humans.update(gdt, player);
      if (gameMode === 'practica') cleanCorpses(gdt);
      G.Loot.update();
      G.Refugio.update(dt);
      if (G.Maps) { G.Maps.followSky(camera); G.Maps.updateDecor(dt); }
      if (G.Sky) G.Sky.update(gdt);
      if (G.BossFx) G.BossFx.update(gdt);
      G.Backpack.update(player);
      G.Guns.update(gdt, player, zombies);
      if (DEBUG) { tB = performance.now(); prof.logic += tB - tA; tA = tB; }
      // detalle alto solo para los más cercanos (ver G.Zombie.rankLOD)
      if ((lodRankT -= dt) <= 0) { lodRankT = 0.2; G.Zombie.rankLOD(zombies, G.Camera.pos, Q.cur.hiN || 4); }
      // (resistencia: los infectados van a por ti o a por tu compañero)
      for (let i = 0; i < zombies.length; i++) {
        const z = zombies[i], tg = G.Mode.targetFor ? G.Mode.targetFor(z) : null;
        if (tg) z.update(gdt, tg.p, zombies, tg.c); else z.update(gdt, player, zombies, G.Combat);
      }
      if (DEBUG) { tB = performance.now(); prof.zombies += tB - tA; tA = tB; }
      refreshWorld(false, dt);
      if (DEBUG) { tB = performance.now(); prof.world += tB - tA; tA = tB; }
      Q.sample(dt);
      if (player.dead) {
        deadT += dt;
        if (deadT > 2.2) die();
      }
    } else if (state === 'menu' || state === 'dead' || state === 'paused' || state === 'over') {
      if (state !== 'menu' && G.Input.padConfirm() && !(G.HudEdit && G.HudEdit.editing)) {
        if (state === 'over') { if (gameMode === 'retorno') backToRefuge(); else retry(); }
        else if (state === 'dead') { if (gameMode === 'retorno') toMenu(); else retry(); }
        else if (!(G.PauseMenu && G.PauseMenu.handlesKeys)) resume();
      }
      if (state === 'menu') {
        // la cámara gira lentamente alrededor de la casa en el menú
        G.Camera.yaw += dt * 0.08;
      }
    }

    if (G.Audio) G.Audio.update(dt, player, G.Population.list, state === 'playing');
    player.apply(state === 'playing' && G.Combat.hitStop > 0 ? dt * 0.12 : dt);
    // zoom al apuntar con armas de fuego; con el rifle, mira telescópica
    const wpn = player.weapon;
    // la mira telescópica solo aparece si la pides (2.º toque de Apuntar, V, rueda o LB)
    const scoped = state === 'playing' && wpn.scope && !player.perks.noScope && player.aiming && player.scope && player.gun.aim > 0.85 && !player.dead;
    G.Input.scopeable = !!wpn.scope && player.aiming && !player.perks.noScope;
    G.Input.scoped = !!player.scope;
    if (G.Input.scopeable && !scopeHint && state === 'playing') {
      scopeHint = true;
      toast(G.Input.isTouch ? 'Toca otra vez Apuntar para mirar por la mira' : 'Rueda o V: mirar por la mira telescópica');
    }
    el('btn-aim').classList.toggle('scope', !!scoped);
    let fovT = baseFov * (scoped ? 0.36 : (G.Weapons.isGun(wpn) ? 1 - 0.12 * player.gun.aim : (player.aiming && player.holdingThr ? 0.88 : 1)));
    // golpe de zoom al acertar un golpe cuerpo a cuerpo (la cámara "entra" en el impacto)
    const kick = G.Camera.fovKick || 0;
    fovT += (scoped ? 0 : (G.Camera.fovOff || 0)) - kick;
    if (Math.abs(camera.fov - fovT) > 0.05) {
      camera.fov += (fovT - camera.fov) * Math.min(1, dt * (scoped ? 14 : (kick > 0.3 ? 22 : 9)));
      camera.updateProjectionMatrix();
    }
    el('scope').classList.toggle('hidden', !scoped);
    scopedNow = scoped;
    // sensibilidad (opciones): la general, y aparte apuntando y con la mira del rifle
    const lookSens = sensMul('look') * (scopedNow ? sensMul('scope') : (player.aiming ? sensMul('aim') : 1));
    if (!G.Camera.held) G.Camera.update(dt, player, state === 'playing' ? G.Input : { look: { x: 0, y: 0 } }, lookSens);
    // objetos sueltos y proyectiles (después de la cámara: los iconos siguen a lo que se ve)
    {
      const playing = state === 'playing';
      const pdt = playing ? (G.Combat.hitStop > 0 ? dt * 0.12 : dt) : 0;
      const cf = G.Camera.forward();
      pickT = G.Pickups.update(pdt, player, G.Population.list, camera, Math.atan2(cf.x, cf.z), playing);
    }
    player.model.root.visible = (!G.Camera.near && !scopedNow) || player.dead;

    // el sol sigue al jugador (en pasos para que la sombra no tiemble)
    const sx = Math.round(player.pos.x), sz = Math.round(player.pos.z);
    const so = G.Sky ? G.Sky.sunOffset() : [-16, 32, 11];
    sun.position.set(sx + Math.round(so[0]), so[1], sz + Math.round(so[2]));
    sun.target.position.set(sx, 0, sz);
    // día y noche, clima y partículas (mapas de los enfrentamientos)
    if (G.Sky && G.Sky.active) {
      const at = { x: player.pos.x, y: player.y || 0, z: player.pos.z, scene };
      G.Sky.apply({ scene, hemi, sun, at });
      G.Sky.update3d(state === 'playing' ? dt : 0, camera, at);
    }
    syncFar();                       // (después de la niebla del clima: la cámara se acorta hasta donde ya no se ve)

    updateHud();
    if (DEBUG) tA = performance.now();
    // menús de inicio: el personaje en 3D, o nada (el fondo animado tapa la pantalla y así no gasta)
    if (G.Menus && G.Menus.wants3d) G.Menus.render3d(renderer, dt);
    else if (G.Menus && G.Menus.covering) { /* la pantalla de carga tapa todo */ }
    else if (G.Refugio.wants3d && state === 'playing') G.Refugio.render3d(renderer, dt);
    else {
      // sombras «a medias»: el mapa de sombras se rehace un fotograma sí y otro no
      const half = Q.shadow && Q.shadow.half;
      renderer.shadowMap.autoUpdate = !half;
      if (half) renderer.shadowMap.needsUpdate = (shadowTick = (shadowTick + 1) & 1) === 0;
      renderer.render(scene, camera);
    }
    updateDaze(dt);
    updateFade(dt);
    if (DEBUG) { prof.render += performance.now() - tA; prof.n++; }

    if (DEBUG && dt > 0) {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 0.5) {
        const st = G.World.stats();
        const n = Math.max(1, prof.n), f = (v) => (v / n).toFixed(1);
        el('debug').textContent = Math.round(fpsN / fpsAcc) + ' fps · ' + renderer.info.render.calls + ' draws · ' +
          Math.round(renderer.info.render.triangles / 1000) + 'k tris · ' + st.built + '/' + st.generated + ' chunks · ' +
          G.Population.alive() + ' zombis\nms/fotograma: lógica ' + f(prof.logic) + ' · zombis ' + f(prof.zombies) + ' · mundo ' + f(prof.world) +
          ' · dibujo ' + f(prof.render) + ' · calidad ' + Q.cur.name + (Q.level === 'auto' ? ' (auto)' : '') + (Q.fps30 ? ' · 30 fps' : '') + ' · semilla ' + st.seed;
        fpsAcc = 0; fpsN = 0;
        prof.logic = prof.zombies = prof.world = prof.render = 0; prof.n = 0;
      }
    }
  }

  function die() {
    state = 'dead';
    fadeTo(0, 0.8);
    G.Input.enabled = false;
    if (document.exitPointerLock) document.exitPointerLock();
    const m = Math.floor(survived / 60), s = Math.floor(survived % 60);
    el('dead-cause').textContent = player.deathCause;
    let txt = G.Mode.active ? G.Mode.summary() : 'Sobreviviste ' + m + ' min ' + s + ' s · Zombis eliminados: ' + kills;
    const run = gameMode === 'retorno' && G.Run.active;
    if (run) {
      // la muerte es definitiva: la carrera se borra
      txt = (G.Run.daily ? 'Partida diaria perdida: la próxima, mañana. ' : '') + (G.Run.encounter && G.Run.encounter.boss ? 'La carrera ha terminado ante el jefe final. ' : 'La carrera ha terminado en el enfrentamiento ' + (G.Run.step + 1) + ' de ' + G.Run.STEPS + '. ') + txt;
      G.Run.recordEnd(G.Mode.stats);
      G.Run.discard();
    }
    el('dead-stats').textContent = txt;
    el('btn-retry').classList.toggle('hidden', gameMode === 'retorno');
    el('btn-retry').textContent = bossTry ? 'Volver al modo libre' : 'Empezar de nuevo';
    el('btn-menu2').textContent = gameMode === 'retorno' ? 'Menú principal' : 'Volver al menú';
    el('dead').classList.remove('hidden');
  }

  // Para pruebas automáticas
  G.debug = {
    map(id) { resetWorld(id); setLighting(id); },
    get player() { return player; }, get camera() { return camera; }, get renderer() { return renderer; },
    get scene() { return scene; }, get state() { return state; },
    start, retry, toast, refresh: () => refreshWorld(true, 0), autoDoor: () => autoDoor(),
    startEncounter, backToRefuge, enterRefuge, quitToMenu, finishRun, fadeTo, get gameMode() { return gameMode; },
    // congela al jugador en un momento de una animación (para revisar poses)
    // congela el juego tal cual (para capturas)
    hold() { state = 'frozen'; G.Camera.held = true; },
    sky(h, w) { if (G.Sky) G.Sky.set(h, w); },
    freeze(kind, t, weapon) {
      if (weapon) { player.weapons = []; player.pickUp(weapon, 1); }
      if (player.slot && G.Weapons.isGun(G.Weapons.get(player.slot.id))) player.slot.cond = 1;
      player.action = kind ? { kind, t, dur: 1, done: true, weapon: player.weapon } : null;
      state = 'frozen';
    },
    tp(x, z, yaw, pitch, lv) {
      player.pos.x = x; player.pos.z = z; player.lv = lv || 0; player.y = G.World.groundY(x, z, player.lv);
      if (yaw != null) G.Camera.yaw = yaw;
      if (pitch != null) G.Camera.pitch = pitch;
      G.Camera.dist = 0.1;
      refreshWorld(true, 0);
    }
  };

  window.addEventListener('DOMContentLoaded', init);
})(window.Game = window.Game || {});
