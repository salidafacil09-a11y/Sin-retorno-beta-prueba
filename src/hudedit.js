(function (G) {
  'use strict';

  // Editor de botones: desde el menú o la pausa, "Editar botones" deja arrastrar
  // cada botón, el joystick y el panel de armas a donde quieras y cambiar su tamaño.
  // Se guarda en este navegador (localStorage) y se puede restablecer.

  const KEY = 'ceniza.hud';
  const ITEMS = [
    ['btn-attack', 'Atacar'], ['btn-dodge', 'Esquivar'], ['btn-reload', 'Recargar'], ['btn-aim', 'Apuntar'],
    ['btn-jump', 'Saltar'], ['btn-prone', 'Pecho a tierra'], ['btn-crouch', 'Agacharse'],
    ['btn-use', 'Puertas y ventanas'], ['btn-loot', 'Registrar (∆)'], ['btn-run', 'Correr'], ['btn-pause', 'Pausa'], ['joy-base', 'Joystick'],
    ['wpn', 'Arma y vida'], ['bag', 'Mochila'], ['btn-zspawn', 'Sacar zombi']
  ];
  const NAMES = {};
  ITEMS.forEach(([id, n]) => { NAMES[id] = n; });
  const MIN_S = 0.6, MAX_S = 1.8;

  let layout = {};          // id -> { x, y (centro, fracción de la pantalla), s (escala) }
  let editing = false, from = null, sel = null, drag = null;
  let bar = null;

  const el = (id) => document.getElementById(id);

  function load() {
    try { layout = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { layout = {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch (e) { /* sin almacenamiento */ }
  }

  // Aplica la posición guardada a un elemento (o la quita para volver a la del CSS)
  function applyOne(id) {
    const e = el(id);
    if (!e) return;
    const L = layout[id];
    if (!L) {
      e.style.left = e.style.top = e.style.right = e.style.bottom = e.style.transform = '';
      return;
    }
    e.style.left = (L.x * 100) + '%';
    e.style.top = (L.y * 100) + '%';
    e.style.right = 'auto';
    e.style.bottom = 'auto';
    e.style.transform = 'translate(-50%, -50%) scale(' + (L.s || 1) + ')';
  }

  // El área táctil del joystick sigue al joystick si lo mueves
  function placeJoyZone() {
    const z = el('joy-zone');
    if (!z) return;
    const L = layout['joy-base'];
    if (!L) { z.style.left = z.style.top = z.style.width = z.style.height = z.style.bottom = ''; return; }
    const W = window.innerWidth, H = window.innerHeight;
    const size = Math.max(260, 124 * (L.s || 1) * 2.4);
    const cx = L.x * W, cy = L.y * H;
    z.style.left = Math.max(0, cx - size / 2) + 'px';
    z.style.top = Math.max(0, cy - size / 2) + 'px';
    z.style.width = size + 'px';
    z.style.height = size + 'px';
    z.style.bottom = 'auto';
  }

  function applyAll() {
    ITEMS.forEach(([id]) => applyOne(id));
    placeJoyZone();
  }

  // Centro actual de un elemento en fracciones de pantalla y su escala
  function current(id) {
    if (layout[id]) return Object.assign({}, layout[id]);
    const r = el(id).getBoundingClientRect();
    return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight, s: 1 };
  }

  function select(id) {
    if (sel) { const p = el(sel); if (p) p.classList.remove('hud-sel'); }
    sel = id;
    if (sel) el(sel).classList.add('hud-sel');
    el('hudedit-name').textContent = sel ? NAMES[sel] : 'Toca un botón para elegirlo y arrástralo';
    el('hudedit-minus').disabled = el('hudedit-plus').disabled = !sel;
  }

  function editableFrom(target) {
    let n = target;
    while (n && n !== document.body) {
      if (n.id && NAMES[n.id]) return n.id;
      n = n.parentElement;
    }
    return null;
  }

  // Durante la edición todos los toques pasan por aquí primero (fase de captura),
  // así los botones no hacen su acción
  function onDown(e) {
    if (!editing) return;
    if (bar.contains(e.target)) return;
    const id = editableFrom(e.target);
    e.preventDefault(); e.stopPropagation();
    if (!id) { select(null); return; }
    select(id);
    const c = current(id);
    drag = { id, pid: e.pointerId, ox: c.x * window.innerWidth - e.clientX, oy: c.y * window.innerHeight - e.clientY, s: c.s || 1 };
  }
  function onMove(e) {
    if (!editing || !drag || e.pointerId !== drag.pid) return;
    e.preventDefault(); e.stopPropagation();
    const W = window.innerWidth, H = window.innerHeight;
    const r = el(drag.id).getBoundingClientRect();
    const hw = r.width / 2, hh = r.height / 2;
    const x = Math.min(W - hw, Math.max(hw, e.clientX + drag.ox));
    const y = Math.min(H - hh, Math.max(hh, e.clientY + drag.oy));
    layout[drag.id] = { x: x / W, y: y / H, s: drag.s };
    applyOne(drag.id);
    if (drag.id === 'joy-base') placeJoyZone();
  }
  function onUp(e) {
    if (!editing) return;
    if (bar.contains(e.target) && !drag) return;
    if (drag && e.pointerId === drag.pid) { drag = null; save(); }
    e.stopPropagation();
  }

  function resize(f) {
    if (!sel) return;
    const c = current(sel);
    c.s = Math.min(MAX_S, Math.max(MIN_S, Math.round(((c.s || 1) + f) * 10) / 10));
    layout[sel] = c;
    applyOne(sel);
    if (sel === 'joy-base') placeJoyZone();
    save();
  }

  function open(fromScreen) {
    if (editing) return;
    editing = true;
    from = fromScreen;
    if (G.Input) G.Input.editing = true;
    if (from) el(from).classList.add('hidden');
    document.body.classList.add('hud-editing');
    el('touch-ui').classList.add('visible');
    bar.classList.remove('hidden');
    select(null);
  }

  function close() {
    if (!editing) return;
    editing = false;
    drag = null;
    select(null);
    document.body.classList.remove('hud-editing');
    bar.classList.add('hidden');
    if (from) el(from).classList.remove('hidden');
    from = null;
    save();
    // que el toque de "Listo" no llegue al juego
    setTimeout(() => { if (G.Input) { G.Input.editing = false; G.Input.clear(); } }, 60);
  }

  function reset() {
    layout = {};
    save();
    applyAll();
    select(null);
  }

  const HudEdit = {
    get editing() { return editing; },
    init() {
      bar = el('hudedit');
      load();
      applyAll();
      // solo en pantallas táctiles (en PC no hay botones en pantalla)
      const touch = G.Input && G.Input.isTouch;
      document.querySelectorAll('.btn-hudedit').forEach((b) => {
        b.classList.toggle('hidden', !touch);
        b.addEventListener('click', () => open(b.dataset.from));
      });
      el('hudedit-done').addEventListener('click', close);
      el('hudedit-reset').addEventListener('click', reset);
      el('hudedit-minus').addEventListener('click', () => resize(-0.1));
      el('hudedit-plus').addEventListener('click', () => resize(0.1));
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
      window.addEventListener('resize', placeJoyZone);
    },
    open, close, reset,
    get layout() { return layout; }
  };

  G.HudEdit = HudEdit;
})(window.Game = window.Game || {});
