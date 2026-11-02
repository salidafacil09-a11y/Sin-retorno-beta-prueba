(function (G) {
  'use strict';

  // Entrada unificada. El juego solo lee:
  //   Input.move {x, y}   movimiento (-1 a 1; y negativo = adelante)
  //   Input.look {x, y}   giro de cámara de este fotograma (radianes)
  //   Input.run, Input.aim                      botones mantenidos
  //   Input.attack, shove, use, cycle, crouch, prone, jump, grip, drop,
  //   slot1, slot2, slot3, pause                pulsados en este fotograma
  //
  // (las teclas y los botones de abajo son los predeterminados: se cambian en Opciones > Controles)
  // PC: WASD, ratón (clic para capturarlo), clic izq. atacar, clic der. apuntar,
  //     Espacio empujar (o agarrar por la espalda), F esquivar, R recargar, E usar, Q o rueda cambiar arma, 1 2 3 elegir arma,
  //     C agacharse, Z pecho a tierra, V accesorio (silenciador / mira del rifle), Shift correr,
  //     E puertas y ventanas, T registrar y coger, I mochila, B vendarse, Q cambio rápido / selector.
  // Móvil: joystick fijo con bloqueo de carrera (arrástralo hacia arriba), mirar
  //        arrastrando a la derecha, botones al estilo de los shooters de móvil.
  // Mando (ver controls.js): L1 apuntar, R1 disparar apuntando / recargar, L2 esquivar / correr (mantener),
  //        R2 cambiar de arma, Triángulo interactuar, Círculo agacharse / tumbarse (mantener), Cruz saltar,
  //        Cuadrado golpe, panel táctil mochila, Options pausa; cruceta: menú de armas (se cierra al soltar).
  //        PC: G botella, B venda.

  // ¿móvil o tableta? Antes bastaba con que la pantalla admitiera toques: muchos portátiles y monitores de PC
  // también lo dicen, y el juego se ponía en modo táctil (sin la configuración de teclas). Ahora cuenta el puntero
  // principal: si es grueso (un dedo) o no hay ratón, es táctil
  const mq = (q) => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isTouch = hasTouch && (mq('(pointer: coarse)') || !mq('(any-pointer: fine)'));
  const hasMouse = mq('(any-pointer: fine)');
  const keys = {};
  const touch = { id: null, cx: 0, cy: 0, x: 0, y: 0, lookId: null, lx: 0, ly: 0, sprintLock: false, aim: false, lootHeld: false };
  const JOY_RADIUS = 56;
  const MOUSE_SENS = 0.0026;
  const TOUCH_SENS = 0.0065;
  const PAD_LOOK = 2.6;
  let mouseDX = 0, mouseDY = 0;
  const ACTIONS = ['attack', 'dodge', 'reload', 'shove', 'use', 'loot', 'pack', 'bandage', 'quick', 'cycle', 'pause', 'crouch', 'prone', 'jump', 'grip', 'slot1', 'slot2', 'slot3', 'slot4', 'scope', 'scopeToggle', 'throw', 'cancel'];
  const queued = {};
  ACTIONS.forEach((a) => { queued[a] = false; });
  const prevPad = [];
  let canvas = null;

  // Las teclas y los botones salen de G.Controls (se pueden cambiar en Opciones > Controles). La tecla del
  // cambio rápido / selector de armas la lleva el HUD. Las flechas mueven siempre (además de lo asignado)
  const C = () => G.Controls;
  const down = {};             // teclas y botones del ratón mantenidos (por código)
  const held = (act) => { const k = C().key(act); return !!(k && down[k]); };
  // la cruceta del mando: el menú de armas (se abre al pulsar, se cierra al soltar)
  const DPAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  // botones de tocar o mantener: cuánto llevan pulsados (s) y si ya hicieron lo de mantener
  const HOLD_RUN = 0.22, HOLD_PRONE = 0.42;
  const holdT = { dodgeRun: 0, stance: 0 }, holdDone = { stance: false };
  let padMenuT = 0;

  const Input = {
    isTouch, hasMouse, hasTouch,
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    run: false, aim: false,
    pointerLocked: false,
    enabled: false,
    editing: false,     // editor de botones abierto: los controles no actúan
    blockLook: false,   // selector de armas abierto: el ratón elige en vez de mirar
    scopeable: false,   // el juego avisa si el arma en las manos tiene mira y estás apuntando
    scoped: false,      // ... y si la mira está puesta

    init(canvasEl) {
      canvas = canvasEl;
      ACTIONS.forEach((a) => { this[a] = false; });
      window.addEventListener('keydown', (e) => {
        if (keys[e.code]) return;
        keys[e.code] = true; down[e.code] = true; Input.kbSeen = true;
        if (!Input.enabled || C().busy) return;
        press(e.code);
        if (C().kbAction(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { keys[e.code] = false; down[e.code] = false; });
      window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in down) down[k] = false; touch.fire = false; });

      if (!isTouch) {
        canvas.addEventListener('mousedown', (e) => {
          if (!Input.enabled || C().busy) return;
          if (!Input.pointerLocked) { Input.requestLock(); return; }
          const code = 'Mouse' + e.button;
          down[code] = true;
          press(code);
        });
        window.addEventListener('mouseup', (e) => { down['Mouse' + e.button] = false; });
        window.addEventListener('mousemove', (e) => {
          // sin ratón capturado (por ejemplo dentro de un iframe) se puede mirar arrastrando
          if (!Input.pointerLocked && !(Input.enabled && e.buttons)) return;
          mouseDX += e.movementX || 0;
          mouseDY += e.movementY || 0;
        });
        window.addEventListener('wheel', (e) => {
          if (Input.enabled && Input.pointerLocked && Math.abs(e.deltaY) > 2) queued.cycle = true;
        }, { passive: true });
        document.addEventListener('pointerlockchange', () => {
          Input.pointerLocked = document.pointerLockElement === canvas;
          if (!Input.pointerLocked) for (const k in down) if (k.startsWith('Mouse')) down[k] = false;
        });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      } else {
        setupTouch();
      }
    },

    // Para que la interfaz (botones de armas) pueda pedir acciones
    queue(action) { if (Input.enabled && action in queued) queued[action] = true; },

    requestLock() {
      if (isTouch || !canvas || !canvas.requestPointerLock) return;
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* sin bloqueo de puntero */ }
    },

    get sprintLocked() { return touch.sprintLock; },
    get padMenu() { return padMenuT > 0; },

    update(dt) {
      let x = 0, y = 0;
      if (held('left') || keys.ArrowLeft) x -= 1;
      if (held('right') || keys.ArrowRight) x += 1;
      if (held('forward') || keys.ArrowUp) y -= 1;
      if (held('back') || keys.ArrowDown) y += 1;
      if (touch.sprintLock && touch.id === null) { y -= 1; }
      else if (Math.hypot(touch.x, touch.y) > 0.12) { x += touch.x; y += touch.y; }

      let lx = this.blockLook ? 0 : mouseDX * MOUSE_SENS + touch.lx * TOUCH_SENS;
      let ly = this.blockLook ? 0 : mouseDY * MOUSE_SENS + touch.ly * TOUCH_SENS;
      mouseDX = mouseDY = 0;
      touch.lx = touch.ly = 0;

      const pad = readPad(dt);
      x += pad.x; y += pad.y;
      lx += pad.lx * PAD_LOOK * dt;
      ly += pad.ly * PAD_LOOK * dt * 0.8;

      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      this.move.x = x; this.move.y = y;
      this.look.x = lx; this.look.y = ly;
      const busy = C().busy;
      this.run = !busy && !!(held('run') || touch.sprintLock || pad.run);
      this.aim = !busy && !!(held('aim') || pad.aim || touch.aim);
      // atacar mantenido (para apuntar manteniendo el botón con la botella en la mano)
      this.attackHeld = !busy && !!(held('attack') || touch.fire || pad.fireHeld);
      for (const a of ACTIONS) this[a] = queued[a] || !!pad[a];
      this.padUse = !!pad.use;      // A del mando: botín o puerta según lo que haya
      // recoger mantenido (T, ∆ o A): coge de golpe todo lo que tienes delante
      this.lootHeld = !busy && !!(held('loot') || touch.lootHeld || pad.useHeld || pad.lootHeld);
      for (const a of ACTIONS) queued[a] = false;
    },

    clear() {
      for (const a of ACTIONS) queued[a] = false;
      mouseDX = mouseDY = 0;
    },
    // todo a cero en este fotograma (un panel del refugio abierto)
    zero() {
      for (const a of ACTIONS) this[a] = false;
      this.move.x = this.move.y = 0; this.look.x = this.look.y = 0;
      this.run = false; this.aim = false; this.attackHeld = false; this.padUse = false;
    },

    // El juego avisa cuando deja de apuntar (por ejemplo al tumbarse)
    setAim(on) {
      touch.aim = !!on;
      const b = document.getElementById('btn-aim');
      if (b) b.classList.toggle('on', touch.aim);
    },

    setSprintLock(on) {
      touch.sprintLock = !!on;
      const b = document.getElementById('btn-run');
      if (b) b.classList.toggle('on', touch.sprintLock);
    },

    padConfirm() {
      const p = firstPad();
      return !!(p && p.buttons[0] && p.buttons[0].pressed);
    }
  };

  // una tecla o botón del ratón pulsado: su acción (si tiene)
  function press(code) {
    const act = C().kbAction(code);
    if (!act || act === 'quick' || act === 'forward' || act === 'back' || act === 'left' || act === 'right' || act === 'run') return;
    if (act === 'aim') { if (held('attack')) queued.cancel = true; return; }      // apuntar mientras atacas: cancela el tiro
    if (act in queued) queued[act] = true;
  }

  function firstPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
    return null;
  }

  function readPad(dt) {
    const out = { x: 0, y: 0, lx: 0, ly: 0, run: false, aim: false };
    const p = firstPad();
    if (!p) return out;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    out.x = dz(p.axes[0] || 0); out.y = dz(p.axes[1] || 0);
    out.lx = dz(p.axes[2] || 0); out.ly = dz(p.axes[3] || 0);
    const b = (i) => i >= 0 && !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4));
    const edges = {}, rels = {};
    for (let i = 0; i < p.buttons.length; i++) { const now = b(i); edges[i] = now && !prevPad[i]; rels[i] = !now && !!prevPad[i]; prevPad[i] = now; }
    if (!Input.enabled || C().busy) { holdT.dodgeRun = holdT.stance = 0; return out; }
    // un menú de solo tocar abierto con el mando (mochila, botín...): el mando es para el menú (G.PadUI)
    if (G.PadUI && G.PadUI.capturing) { holdT.dodgeRun = holdT.stance = 0; return { x: 0, y: 0, lx: 0, ly: 0, run: false, aim: false }; }
    // cruceta: al pulsar se abre el menú de armas con lo de esa dirección marcado; al soltar se elige y se cierra
    if (G.HUD && G.HUD.padHold) {
      for (const k in DPAD) {
        if (edges[k]) G.HUD.padHold(DPAD[k]);
        else if (rels[k]) G.HUD.padRelease(DPAD[k]);
      }
    }
    const P = C().pad;
    const bt = (a) => P[a] != null && P[a] >= 0 && b(P[a]);
    const ed = (a) => P[a] != null && P[a] >= 0 && !!edges[P[a]];
    const rl = (a) => P[a] != null && P[a] >= 0 && !!rels[P[a]];
    const aiming = bt('aim');
    out.aim = aiming;
    // L2: tocar esquiva, mantener corre
    if (bt('dodgeRun')) { holdT.dodgeRun += dt || 0; if (holdT.dodgeRun > HOLD_RUN) out.run = true; }
    else { if (rl('dodgeRun') && holdT.dodgeRun <= HOLD_RUN) out.dodge = true; holdT.dodgeRun = 0; }
    // R1: apuntando, dispara; con algo que se usa en la mano (botella, molotov, humo, mina, venda), lo usa
    // (mantener para apuntar el lanzamiento o para vendarse); si no, recarga
    const pl = G.debug && G.debug.player;
    const handUse = !!(pl && pl.cur < -1);
    if (aiming || handUse) { out.attack = ed('fire'); out.fireHeld = bt('fire'); }
    else out.reload = ed('fire');
    // Cuadrado: golpe; apuntando, cambia de hombro la cámara
    if (!aiming) { out.attack = out.attack || ed('melee'); out.fireHeld = out.fireHeld || bt('melee'); }
    else if (ed('melee') && G.Camera && G.Camera.swapShoulder) G.Camera.swapShoulder();
    // Triángulo: interactuar y recoger (mantener: todo); apuntando, el accesorio (silenciador)
    if (aiming) out.grip = ed('use');
    else { out.use = ed('use'); out.useHeld = bt('use'); }
    // Cruz: saltar y trepar; apuntando, poner o quitar la mira
    if (aiming) out.scopeToggle = ed('jump');
    else out.jump = ed('jump');
    // Círculo: tocar se agacha, mantener se tumba
    if (bt('stance')) {
      holdT.stance += dt || 0;
      if (holdT.stance > HOLD_PRONE && !holdDone.stance) { holdDone.stance = true; out.prone = true; }
    } else {
      if (rl('stance') && !holdDone.stance) out.crouch = true;
      holdT.stance = 0; holdDone.stance = false;
    }
    out.cycle = ed('cycle');
    out.pack = ed('pack') || !!edges[17];            // (el panel táctil del mando de PlayStation, siempre)
    out.pause = ed('pause');
    return out;
  }

  function setupTouch() {
    const ui = document.getElementById('touch-ui');
    const zone = document.getElementById('joy-zone');
    const lookZone = document.getElementById('look-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    ui.classList.add('visible');

    // Joystick fijo: el centro es el de la base dibujada
    const center = () => {
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const setKnob = (dx, dy) => { knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))'; };

    zone.addEventListener('pointerdown', (e) => {
      if (touch.id !== null || Input.editing) return;
      touch.id = e.pointerId;
      const c = center();
      touch.cx = c.x; touch.cy = c.y;
      // tocar el joystick quita el bloqueo de carrera, salvo que sigas empujando hacia arriba
      zone.setPointerCapture(e.pointerId);
      move(e);
      base.classList.add('on');
      e.preventDefault();
    });
    const move = (e) => {
      let dx = e.clientX - touch.cx, dy = e.clientY - touch.cy;
      // arrastrar muy arriba (hasta el botón Correr) bloquea la carrera
      if (dy < -JOY_RADIUS * 1.55 && Math.abs(dx) < JOY_RADIUS) Input.setSprintLock(true);
      else if (touch.sprintLock && dy > -JOY_RADIUS * 0.3) Input.setSprintLock(false);
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) { dx = dx / len * JOY_RADIUS; dy = dy / len * JOY_RADIUS; }
      touch.x = dx / JOY_RADIUS; touch.y = dy / JOY_RADIUS;
      setKnob(dx, dy);
    };
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === touch.id) move(e); });
    const endJoy = (e) => {
      if (e.pointerId !== touch.id) return;
      touch.id = null; touch.x = touch.y = 0;
      setKnob(0, touch.sprintLock ? -JOY_RADIUS : 0);
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', endJoy);
    zone.addEventListener('pointercancel', endJoy);

    // Mirar arrastrando con el pulgar derecho
    let lastX = 0, lastY = 0;
    lookZone.addEventListener('pointerdown', (e) => {
      if (touch.lookId !== null || Input.editing) return;
      touch.lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      lookZone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== touch.lookId) return;
      touch.lx += e.clientX - lastX; touch.ly += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === touch.lookId) touch.lookId = null; };
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    // Botones que además dejan mirar si arrastras desde ellos (como en los shooters de móvil)
    const tap = (id, action, opts) => {
      const el = document.getElementById(id);
      if (!el) return;
      let pid = null, bx = 0, by = 0;
      el.addEventListener('pointerdown', (e) => {
        if (Input.editing) return;
        // Apuntar con el rifle: 1.er toque apunta, 2.º pone la mira telescópica, 3.º deja de apuntar
        if (action === 'aim') {
          if (touch.aim && Input.scopeable && !Input.scoped) Input.queue('scope');
          else Input.setAim(!touch.aim);
        }
        else if (action === 'run') Input.setSprintLock(!touch.sprintLock);
        else Input.queue(action);
        if (action === 'attack') touch.fire = true;
        if (action === 'loot') touch.lootHeld = true;
        el.classList.add('down');
        if (opts && opts.look && touch.lookId === null) {
          pid = e.pointerId; bx = e.clientX; by = e.clientY;
          el.setPointerCapture(e.pointerId);
        } else if (action === 'attack') {
          // atacar siempre sigue al dedo (para soltarlo encima de Cancelar aunque no sirva para mirar)
          try { el.setPointerCapture(e.pointerId); } catch (er) { /* nada */ }
        }
        e.preventDefault(); e.stopPropagation();
      });
      el.addEventListener('pointermove', (e) => {
        if (action === 'attack') {
          const cb = document.getElementById('btn-cancel');
          if (cb && !cb.classList.contains('hidden')) {
            const r = cb.getBoundingClientRect(), m = 14;
            cb.classList.toggle('hot', e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m);
          }
        }
        if (e.pointerId !== pid) return;
        touch.lx += e.clientX - bx; touch.ly += e.clientY - by;
        bx = e.clientX; by = e.clientY;
      });
      const up = (e) => {
        el.classList.remove('down');
        if (action === 'loot') touch.lootHeld = false;
        if (action === 'attack') {
          touch.fire = false;
          // soltar el dedo encima del botón de cancelar (al apuntar la botella o tensar el arco): no se lanza
          const cb = document.getElementById('btn-cancel');
          if (e && cb && !cb.classList.contains('hidden')) {
            const r = cb.getBoundingClientRect(), m = 14;
            if (e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m) queued.cancel = true;
          }
        }
        if (e && e.pointerId === pid) pid = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    tap('btn-attack', 'attack', { look: true });
    tap('btn-dodge', 'dodge', { look: true });
    tap('btn-reload', 'reload');
    tap('btn-use', 'use');
    tap('btn-loot', 'loot');
    tap('bag', 'pack');
    tap('btn-pause', 'pause');
    tap('btn-crouch', 'crouch');
    tap('btn-prone', 'prone');
    tap('btn-jump', 'jump');
    tap('btn-aim', 'aim');
    tap('btn-run', 'run');
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  G.Input = Input;
})(window.Game = window.Game || {});
