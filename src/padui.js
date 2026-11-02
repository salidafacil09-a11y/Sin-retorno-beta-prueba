(function (G) {
  'use strict';

  // El mando en los menús.
  //
  // 1) buttons(): los botones del mando con la cruceta «mejorada»: el stick izquierdo también cuenta como cruceta,
  //    y mantener una dirección (con la cruceta o el stick) repite el paso (como en cualquier menú). Lo usan los
  //    menús que ya sabían usar la cruceta (inicio, pausa, refugio: comercio, mapa, banco, cofre).
  //
  // 2) Los menús que solo se tocaban (mochila con la fabricación, botín, fin del enfrentamiento, muerte): un
  //    cursor que salta entre los botones con la cruceta o el stick (al más cercano en esa dirección), A pulsa
  //    (mantener A = mantener pulsado, para fabricar), B cierra. Mientras, el mando no mueve al personaje.
  const DIRS = [12, 13, 14, 15];             // arriba, abajo, izquierda, derecha
  const FIRST = 0.38, REP = 0.13, DEAD = 0.5;
  let raw = [], cur = [], axes = [0, 0];
  const held = { 12: -1, 13: -1, 14: -1, 15: -1 };    // segundos que lleva pulsada cada dirección (-1: suelta)
  let last = 0;

  function firstPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
    return null;
  }

  function tick(ts) {
    requestAnimationFrame(tick);
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
    last = ts;
    const p = firstPad();
    if (!p) { raw = []; cur = []; for (const d of DIRS) held[d] = -1; Nav.update(null); return; }
    raw = p.buttons.map((b) => !!(b && (b.pressed || b.value > 0.4)));
    axes = [p.axes[0] || 0, p.axes[1] || 0];
    const stick = { 12: axes[1] < -DEAD, 13: axes[1] > DEAD, 14: axes[0] < -DEAD, 15: axes[0] > DEAD };
    // (el stick: solo la dirección dominante, para no pasar en diagonal)
    if (Math.abs(axes[0]) > Math.abs(axes[1])) stick[12] = stick[13] = false; else stick[14] = stick[15] = false;
    // mandos sin el mapeo estándar (muchos en Android): la cruceta llega como ejes (6 y 7) o como un «hat» (eje 9)
    if (p.mapping !== 'standard') {
      const hx = p.axes[6] || 0, hy = p.axes[7] || 0;
      if (hx < -DEAD) stick[14] = true; else if (hx > DEAD) stick[15] = true;
      if (hy < -DEAD) stick[12] = true; else if (hy > DEAD) stick[13] = true;
      const hat = p.axes[9];
      if (hat != null && Math.abs(hat) <= 1.01 && p.axes.length > 9) {
        // valores típicos: arriba -1, derecha -0.43, abajo 0.14, izquierda 0.71 (suelto: ~1.28, fuera de rango)
        const near = (v) => Math.abs(hat - v) < 0.12;
        if (near(-1)) stick[12] = true; if (near(0.14)) stick[13] = true;
        if (near(0.71)) stick[14] = true; if (near(-0.43)) stick[15] = true;
      }
    }
    cur = raw.slice();
    for (const d of DIRS) {
      const on = !!raw[d] || stick[d];
      if (!on) { held[d] = -1; cur[d] = false; continue; }
      const t0 = held[d];
      held[d] = t0 < 0 ? 0 : t0 + dt;
      if (held[d] < FIRST) cur[d] = true;
      else {
        // repetición: un fotograma suelto (para que se note el cambio) cada REP segundos
        const a = Math.floor((held[d] - FIRST) / REP), b = Math.floor((held[d] - FIRST - dt) / REP);
        cur[d] = a !== b ? false : true;
      }
    }
    Nav.update(p);
  }

  // ---------------------------------------------------------------------------------------------------
  // Cursor para los menús de solo tocar
  // ---------------------------------------------------------------------------------------------------
  const PANELS = [
    { id: 'pack', items: '.pk-card, .pk-btn, .pk-x', close: true },
    { id: 'loot', items: '.loot-card, .loot-all, .loot-x', close: true },
    { id: 'm-stats', items: 'button' },
    { id: 'dead', items: 'button' },
    { id: 'zspawn-list', items: 'button', close: true }
  ];
  const visible = (el) => { if (!el || el.classList.contains('hidden') || !el.getClientRects().length) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const Nav = {
    panel: null, el: null, prev: [], down: null,
    active() {
      for (const P of PANELS) { const e = document.getElementById(P.id); if (visible(e)) return { P, e }; }
      return null;
    },
    items(e, P) {
      return Array.from(e.querySelectorAll(P.items)).filter((x) => x.getClientRects().length && x.getBoundingClientRect().width > 0);
    },
    mark(el) {
      if (this.el === el) return;
      if (this.el) this.el.classList.remove('pad-focus');
      this.el = el;
      if (el) { el.classList.add('pad-focus'); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    },
    // el más cercano en esa dirección (mirando los centros; se prefiere lo que está alineado)
    step(list, d) {
      if (!this.el || list.indexOf(this.el) < 0) { this.mark(list[0] || null); return; }
      const r = this.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const vx = d === 14 ? -1 : (d === 15 ? 1 : 0), vy = d === 12 ? -1 : (d === 13 ? 1 : 0);
      let best = null, bs = Infinity;
      for (const x of list) {
        if (x === this.el) continue;
        const q = x.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
        const along = dx * vx + dy * vy;
        if (along <= 4) continue;
        const side = Math.abs(dx * vy) + Math.abs(dy * vx);
        const s = along + side * 2.2;
        if (s < bs) { bs = s; best = x; }
      }
      if (best) { this.mark(best); if (G.Audio) G.Audio.play('ui'); }
    },
    fire(el, type) {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      let ev;
      try { ev = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 77, pointerType: 'mouse', isPrimary: true, button: 0 }); }
      catch (e) { ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }); }
      el.dispatchEvent(ev);
    },
    update(p) {
      const a = p ? this.active() : null;
      if (!a) {
        if (this.el) this.mark(null);
        if (this.down) this.down = null;
        this.panel = null; this.prev = cur.slice();
        return;
      }
      if (this.panel !== a.e) { this.panel = a.e; this.mark(null); this.prev = cur.slice(); }      // (recién abierto: no cuenta lo que ya estaba pulsado)
      const list = this.items(a.e, a.P);
      if (!this.el || list.indexOf(this.el) < 0) {
        // tras volver a dibujarse el menú, el mismo botón (por su data-k) o el primero
        const k = this.el && this.el.dataset ? this.el.dataset.k : null;
        this.mark((k && list.find((x) => x.dataset && x.dataset.k === k)) || list[0] || null);
      }
      const edge = (i) => cur[i] && !this.prev[i], rel = (i) => !cur[i] && this.prev[i];
      for (const d of DIRS) if (edge(d)) this.step(list, d);
      // A: pulsar (mantener = mantener pulsado); B: cerrar
      if (edge(0) && this.el) { this.down = this.el; this.fire(this.el, 'pointerdown'); }
      if (rel(0) && this.down) {
        const el = this.down; this.down = null;
        this.fire(el, 'pointerup');
        if (document.body.contains(el)) el.click();
      }
      if (edge(1)) {
        if (a.P.id === 'pack' && G.Backpack) G.Backpack.close(true);
        else if (a.P.id === 'loot' && G.Loot) G.Loot.close(true);
        else if (a.P.id === 'zspawn-list') a.e.classList.add('hidden');
      }
      this.prev = cur.slice();
    }
  };

  G.PadUI = {
    // botones con la cruceta mejorada (stick + repetición). Vacío si no hay mando
    buttons() { return cur.slice(); },
    raw() { return raw.slice(); },
    // ¿un menú de solo tocar lo está usando? (entonces el mando no mueve al personaje)
    get capturing() { return !!Nav.panel; }
  };
  if (typeof window !== 'undefined' && window.requestAnimationFrame) requestAnimationFrame(tick);
})(window.Game = window.Game || {});
