(function (G) {
  'use strict';

  // Indicador de combate (abajo a la derecha, se puede mover con el editor de botones):
  // icono blanco del arma, balas "cargador | reserva" y la vida como un arco alrededor.
  //   toque corto     cambio rápido al arma anterior
  //   mantener        se despliega el selector: deslizas sin soltar hasta un arma (o una venda)
  //                   y al soltar la eliges (o te vendas)
  // En PC: Q igual (tocar = cambio rápido, mantener = selector, se elige moviendo el ratón).

  const HOLD_MS = 260;
  // Estilo del selector: 'agresivo' (cruz pequeña, como en los juegos de referencia) o 'clasico'
  // (dos columnas de tarjetas). Se elige en las opciones y se guarda en el navegador
  const STYLE_KEY = 'ceniza.hudestilo';
  // (ya no se elige: siempre el agresivo)
  let style = 'agresivo';
  let start = null;               // dónde empezó el gesto (cruz: se elige por dirección y distancia)
  let root = null, sel = null, player = null;
  let ring = null, icon = null, mag = null, res = null, pips = null, name = null, med = null, healRing = null, arrowBtn = null;
  let open = false, hl = null, timer = null, pid = null, cards = [];
  let kbd = null;                 // selección con el ratón (PC): { x, y }
  let key = '';
  const onMsg = (m, k) => { if (HUD.onMessage) HUD.onMessage(m, k); };
  const el = (id) => document.getElementById(id);
  const W = () => G.Weapons;

  // ---------- Arco de vida ----------
  // de abajo (110°) a arriba (-110°) por la derecha, con pathLength 100
  function arcPath(cx, cy, r) {
    const a0 = 110 * Math.PI / 180, a1 = -110 * Math.PI / 180;
    const p = (a) => (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    return 'M ' + p(a0) + ' A ' + r + ' ' + r + ' 0 1 0 ' + p(a1);
  }

  function init() {
    root = el('wpn'); sel = el('wsel');
    if (!root) return;
    document.body.classList.toggle('hud-clasico', style === 'clasico');
    const d = arcPath(60, 60, 52);
    root.querySelector('.wpn-ring').innerHTML =
      '<path class="ring-bg" pathLength="100" d="' + d + '"/><path class="ring-hp" pathLength="100" d="' + d + '"/><path class="ring-heal" pathLength="100" d="' + d + '"/>';
    ring = root.querySelector('.ring-hp'); healRing = root.querySelector('.ring-heal');
    // con el arco en la mano: botón aparte para cambiar entre flechas normales y explosivas
    arrowBtn = document.createElement('button');
    arrowBtn.type = 'button'; arrowBtn.className = 'wpn-arrow hidden'; arrowBtn.setAttribute('aria-label', 'Tipo de flecha');
    root.appendChild(arrowBtn);
    arrowBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (G.Input.editing || !G.Input.enabled || !player) return;
      onMsg(player.setArrowExp(!player.arrowExp));
    });
    icon = root.querySelector('.wpn-ic'); mag = root.querySelector('.wpn-mag'); res = root.querySelector('.wpn-res');
    pips = root.querySelector('.wpn-pips'); name = root.querySelector('.wpn-name'); med = root.querySelector('.wpn-med');

    root.addEventListener('pointerdown', (e) => {
      if (G.Input.editing || !G.Input.enabled) return;
      e.preventDefault(); e.stopPropagation();
      pid = e.pointerId;
      try { root.setPointerCapture(pid); } catch (er) { /* nada */ }
      clearTimeout(timer);
      start = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => { timer = null; openSel(); highlight(e.clientX, e.clientY); }, HOLD_MS);
    });
    root.addEventListener('pointermove', (e) => { if (open && e.pointerId === pid) highlight(e.clientX, e.clientY); });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (timer) { clearTimeout(timer); timer = null; quick(); return; }
      if (open) { pick(); closeSel(); }
    };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) { pid = null; clearTimeout(timer); timer = null; closeSel(); } });

    // PC: Q
    window.addEventListener('keydown', (e) => {
      if (e.code !== quickKey() || e.repeat || !G.Input.enabled || G.Input.editing || (G.Controls && G.Controls.busy)) return;
      e.preventDefault();
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; openSel(); kbd = { x: 0, y: 0 }; start = null; kbdHighlight(); }, HOLD_MS);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code !== quickKey()) return;
      if (timer) { clearTimeout(timer); timer = null; if (G.Input.enabled) quick(); return; }
      if (open) { pick(); closeSel(); }
    });
    window.addEventListener('mousemove', (e) => {
      if (!open || !kbd) return;
      kbd.x += e.movementX || 0; kbd.y += e.movementY || 0;
      kbdHighlight();
    });
  }

  const quickKey = () => (G.Controls ? G.Controls.key('quick') : 'KeyQ');

  // ---------- Mando: la cruceta mueve por el menú de armas ----------
  // El primer toque lo abre en esa dirección; cada toque más en la misma dirección avanza una casilla; otra
  // dirección cambia de brazo. A elige, B cierra (lo lleva Input). Devuelve true si el menú quedó abierto
  let padSel = null;
  function padNav(dir) {
    if (!player || player.dead || !G.Input.enabled || G.Input.editing) return false;
    if (!open) { openSel(); if (!open) return false; kbd = { x: 0, y: 0 }; start = null; padSel = { arm: null, n: -1 }; }
    if (!padSel) padSel = { arm: null, n: -1 };
    if (style === 'agresivo') {
      if (padSel.arm !== dir) { padSel.arm = dir; padSel.n = 0; } else padSel.n++;
      const len = arms && arms[dir] ? arms[dir].length : 1;
      padSel.n = Math.min(padSel.n, len - 1);
      const along = dir === 'left' || dir === 'right';
      const d = DEAD + (padSel.n + 0.5) * (along ? STEP_X : STEP_Y) * PICK_STEP;
      crossPick(dir === 'left' ? -d : (dir === 'right' ? d : 0), dir === 'up' ? -d : (dir === 'down' ? d : 0));
    } else {
      if (dir === 'left') kbd.x = -100; else if (dir === 'right') kbd.x = 0;
      else kbd.y += dir === 'up' ? -46 : 46;
      kbdHighlight();
    }
    return true;
  }
  // Cruceta mantenida (esquema nuevo): al pulsar se abre la cruz con la casilla de esa dirección marcada (la
  // primera que no es la que llevas en la mano; otro toque seguido en la misma dirección, la siguiente); al
  // soltar se coge lo marcado y la cruz se cierra. Mientras, se sigue pudiendo mirar y moverse
  let padHeld = null, padLast = { dir: null, n: -1, t: -9 };
  function padHold(dir) {
    if (!player || player.dead || !G.Input.enabled || G.Input.editing || !sel) return false;
    if (open && !padHeld) closeSel();
    open = true; hl = null;
    openCross();
    G.Input.blockLook = false;
    const list = arms[dir] || [];
    if (!list.length) return false;
    const now = performance.now() / 1000;
    let n;
    if (padLast.dir === dir && now - padLast.t < 0.9) n = (padLast.n + 1) % list.length;
    else { n = list.findIndex((c) => !c.empty && !c.on); if (n < 0) n = Math.max(0, list.findIndex((c) => c.on)); }
    for (let k = 0; k < list.length && list[n].empty; k++) n = (n + 1) % list.length;
    setHl(cards.find((e) => e.dataset.k === list[n].k) || null);
    padHeld = { dir, n };
    return true;
  }
  function padRelease(dir) {
    if (!padHeld || padHeld.dir !== dir) return;
    padLast = { dir, n: padHeld.n, t: performance.now() / 1000 };
    padHeld = null;
    // lo que ya llevas en la mano no se guarda (con la cruceta solo se cambia)
    if (hl && !hl.classList.contains('on') && !hl.classList.contains('empty')) pick();
    closeSel();
  }
  function padConfirm() { if (open) { pick(); closeSel(); } padSel = null; }
  function padCancel() { if (open) closeSel(); padSel = null; }

  function quick() {
    if (!player || player.dead) return;
    const m = player.quickSwap();
    if (m) onMsg(m);
  }

  // ---------- Selector ----------
  const SLOT_NAMES = ['Cuerpo a cuerpo', 'Arma corta', 'Arma larga 1', 'Arma larga 2', 'Arma corta 2'];
  function cardHtml(c) {
    const u = c.id ? G.Icons.white(c.id) : null;
    return '<div class="ws-card' + (c.empty ? ' empty' : '') + (c.on ? ' on' : '') + (c.broken ? ' broken' : '') + '" data-k="' + c.k + '">' +
      '<span class="ws-ic">' + (u ? '<img alt="" src="' + u + '">' : (c.glyph || '')) + '</span>' +
      '<span class="ws-tx"><span class="ws-nm">' + c.name + '</span><span class="ws-ct">' + (c.txt || '') + '</span></span></div>';
  }
  function weaponText(s) {
    const w = W().get(s.id);
    if (W().isGun(w)) return s.broken ? 'ROTA' : (w.gun === 'bow' ? (s.mag ? '1' : '0') + ' | ' + player.ammo.flecha + (player.ammo.flecha_exp ? ' +' + player.ammo.flecha_exp + ' exp' : '') : s.mag + ' | ' + player.ammo[w.ammo]);
    return Math.max(0, Math.round(s.cond * w.cond)) + ' golpes';
  }
  function buildCards() {
    const p = player;
    const weapons = [1, 4, 2, 3].map((i) => {
      const s = p.hands[i];
      return s ? { k: 'w' + i, id: s.id, name: W().get(s.id).name, txt: weaponText(s), on: p.cur === i, broken: !!s.broken }
        : { k: 'w' + i, name: SLOT_NAMES[i], txt: 'vacío', empty: true };
    });
    weapons.push(p.throwable ? { k: 'w-2', id: p.throwable, name: thrName(p.throwable), txt: '', on: p.cur === -2 } : { k: 'w-2', name: 'Arrojable', txt: 'nada', empty: true });
    const items = [
      { k: 'i:venda', id: 'botiquin', name: 'Venda', txt: 'x' + p.items.venda, empty: !p.items.venda, on: p.cur === -3 },
      { k: 'w-4', id: 'molotov', name: 'Molotov', txt: 'x' + (p.items.molotov || 0), empty: !p.items.molotov, on: p.cur === -4 },
      { k: 'w-5', id: 'mina', name: 'Mina', txt: 'x' + (p.items.mina || 0), empty: !p.items.mina, on: p.cur === -5 },
      { k: 'w-6', id: 'humo', name: 'Bomba de humo', txt: 'x' + (p.items.humo || 0), empty: !p.items.humo, on: p.cur === -6 }
    ];
    return { weapons, items };
  }
  // ---------- Selector en cruz ----------
  // izquierda: armas de fuego largas · derecha: las armas cortas (dos) · arriba: botiquín,
  // bombas de humo y minas · abajo: ladrillo o botella y molotov (la navaja y el arma cuerpo a cuerpo no están:
  // salen solas al golpear).
  // Se elige deslizando hacia un brazo de la cruz: la dirección elige el brazo y la distancia, la casilla.
  // PICK_STEP: cuánto hay que deslizar por casilla (en el móvil, poco: el dedo apenas se mueve)
  const STEP_X = 60, STEP_Y = 50;
  // sensibilidad (opción del menú, 1 a 10; 5 por defecto): cuanto más alta, menos hay que deslizar
  const SENS_KEY = 'ceniza.sensarmas';
  let sens = (() => { try { const v = +localStorage.getItem(SENS_KEY); return v >= 1 && v <= 10 ? v : 5; } catch (e) { return 5; } })();
  let PICK_STEP = 0.45, DEAD = 12;
  function applySens() { PICK_STEP = 0.45 * Math.pow(1.25, 5 - sens); DEAD = Math.round(12 * Math.pow(1.12, 5 - sens)); }
  applySens();
  const CROSS_AT = [0.69, 0.41];      // centro de la cruz en la pantalla (fracción del ancho y del alto)
  let arms = null;
  function crossCard(c, x, y) {
    const u = c.id ? G.Icons.white(c.id) : null;
    return '<div class="wx-card' + (c.empty ? ' empty' : '') + (c.on ? ' on' : '') + (c.broken ? ' broken' : '') + '" data-k="' + c.k + '" data-name="' + c.name + '" style="left:' + x + 'px;top:' + y + 'px">' +
      (u ? '<img alt="" src="' + u + '">' : '<b>' + (c.glyph || '') + '</b>') + (c.txt ? '<span>' + c.txt + '</span>' : '') + '</div>';
  }
  function openCross() {
    const p = player;
    const wc = (i, name) => { const sl = p.hands[i]; return sl ? { k: 'w' + i, id: sl.id, name: W().get(sl.id).name, txt: shortText(sl), on: p.cur === i, broken: !!sl.broken } : { k: 'w' + i, name, empty: true }; };
    arms = {
      left: [wc(2, 'Arma larga'), wc(3, 'Arma larga')],
      // derecha: las dos armas cortas (pistola y revólver)
      right: [wc(1, 'Arma corta'), wc(4, 'Arma corta')],
      // arriba: el botiquín (vendas), encima las bombas de humo y encima las minas
      up: [{ k: 'i:venda', id: 'botiquin', name: 'Venda', txt: String(p.items.venda), empty: !p.items.venda, on: p.cur === -3 },
        { k: 'w-6', id: 'humo', name: 'Bomba de humo', txt: String(p.items.humo || 0), empty: !p.items.humo, on: p.cur === -6 },
        { k: 'w-5', id: 'mina', name: 'Mina', txt: String(p.items.mina || 0), empty: !p.items.mina, on: p.cur === -5 }],
      // abajo: el ladrillo o la botella y, debajo, la molotov
      down: [p.throwable ? { k: 'w-2', id: p.throwable, name: thrName(p.throwable), on: p.cur === -2 } : { k: 'w-2', name: 'Arrojable', empty: true },
        { k: 'w-4', id: 'molotov', name: 'Molotov', txt: String(p.items.molotov || 0), empty: !p.items.molotov, on: p.cur === -4 }]
    };
    // la caja se ajusta a cada brazo (arriba deja sitio para el nombre de lo elegido), así el brazo de
    // abajo, que es el más largo, no queda colgando fuera de la pantalla
    const W2 = STEP_X * 2 + 30;
    const Hup = STEP_Y * arms.up.length + 21 + 18, Hdn = STEP_Y * arms.down.length + 21 + 4;
    let h = '<div class="wx-label"></div><i class="wx-dot" style="top:' + Hup + 'px"></i>';
    arms.left.forEach((c, i) => { h += crossCard(c, W2 - STEP_X * (i + 1), Hup); });
    arms.right.forEach((c, i) => { h += crossCard(c, W2 + STEP_X * (i + 1), Hup); });
    arms.up.forEach((c, i) => { h += crossCard(c, W2, Hup - STEP_Y * (i + 1)); });
    arms.down.forEach((c, i) => { h += crossCard(c, W2, Hup + STEP_Y * (i + 1)); });
    sel.className = 'cross';
    sel.innerHTML = h;
    sel.style.width = (W2 * 2) + 'px'; sel.style.height = (Hup + Hdn) + 'px';
    sel.classList.remove('hidden');
    // la cruz se abre siempre en el mismo sitio (a la derecha, algo por encima del centro), esté donde esté
    // el indicador que la abre; si no entra entera, sube, y en pantallas muy bajas se encoge un poco
    const Wd = window.innerWidth, H = window.innerHeight;
    const k = Math.max(0.7, Math.min(1, (H - 8) / (Hup + Hdn)));
    sel.style.transformOrigin = W2 + 'px ' + Hup + 'px';
    sel.style.transform = k < 1 ? 'scale(' + k.toFixed(3) + ')' : '';
    let cx = Wd * CROSS_AT[0], cy = H * CROSS_AT[1];
    cx = Math.max(W2 * k + 4, Math.min(Wd - W2 * k - 4, cx));
    cy = Math.max(Hup * k + 4, Math.min(H - Hdn * k - 4, cy));
    sel.style.left = (cx - W2) + 'px'; sel.style.top = (cy - Hup) + 'px';
    cards = Array.from(sel.querySelectorAll('.wx-card'));
  }
  // elige por la dirección y la distancia del gesto desde donde empezó
  function crossPick(dx, dy) {
    const d = Math.hypot(dx, dy);
    if (d < DEAD) { setHl(null); return; }
    let arm, n;
    if (Math.abs(dx) > Math.abs(dy)) { arm = dx < 0 ? 'left' : 'right'; n = Math.floor((Math.abs(dx) - DEAD) / (STEP_X * PICK_STEP)); }
    else { arm = dy < 0 ? 'up' : 'down'; n = Math.floor((Math.abs(dy) - DEAD) / (STEP_Y * PICK_STEP)); }
    const list = arms[arm];
    const c = list[Math.max(0, Math.min(list.length - 1, n))];
    setHl(cards.find((e) => e.dataset.k === c.k) || null);
  }
  function thrName(id) { return id === 'ladrillo' ? 'Ladrillo' : (id === 'molotov' ? 'Molotov' : 'Botella'); }
  function shortText(sl) {
    const w = W().get(sl.id);
    if (W().isGun(w)) return sl.broken ? 'ROTA' : (w.gun === 'bow' ? String(player.ammo.flecha) : sl.mag + '|' + player.ammo[w.ammo]);
    return String(Math.max(0, Math.round(sl.cond * w.cond)));
  }

  function openSel() {
    if (!player || player.dead || !sel) return;
    open = true; hl = null;
    G.Input.blockLook = true;
    if (style === 'agresivo') { openCross(); return; }
    sel.className = '';
    sel.style.width = sel.style.height = sel.style.transform = '';
    const { weapons, items } = buildCards();
    sel.innerHTML = '<div class="ws-col ws-items">' + items.map(cardHtml).join('') + '</div>' +
      '<div class="ws-col ws-weapons">' + weapons.map(cardHtml).join('') + '</div>';
    sel.classList.remove('hidden');
    // se abre hacia el centro de la pantalla, junto al indicador
    const r = root.getBoundingClientRect(), Wd = window.innerWidth, H = window.innerHeight;
    const sw = sel.offsetWidth, sh = sel.offsetHeight;
    let x = r.left + r.width / 2 > Wd / 2 ? r.left - sw - 8 : r.right + 8;
    let y = r.top + r.height / 2 > H / 2 ? r.bottom - sh : r.top;
    x = Math.max(6, Math.min(Wd - sw - 6, x)); y = Math.max(6, Math.min(H - sh - 6, y));
    sel.style.left = x + 'px'; sel.style.top = y + 'px';
    cards = Array.from(sel.querySelectorAll('.ws-card'));
  }
  function closeSel() {
    open = false; kbd = null; hl = null;
    G.Input.blockLook = false;
    if (sel) sel.classList.add('hidden');
  }
  function setHl(c) {
    if (hl === c) return;
    if (hl) hl.classList.remove('hl');
    hl = c;
    if (hl) hl.classList.add('hl');
    const lb = sel && sel.querySelector('.wx-label');
    if (lb) lb.textContent = hl ? hl.dataset.name : '';
  }
  function highlight(x, y) {
    if (style === 'agresivo') { if (start) crossPick(x - start.x, y - start.y); return; }
    let best = null;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 3 && y <= r.bottom + 3) best = c;
    }
    setHl(best);
  }
  // PC: el ratón mueve la selección (filas de 46 px; a la izquierda, la columna de vendas)
  function kbdHighlight() {
    if (style === 'agresivo') { crossPick(kbd.x * 0.6, kbd.y * 0.6); return; }
    const col = kbd.x < -70 ? sel.querySelectorAll('.ws-items .ws-card') : sel.querySelectorAll('.ws-weapons .ws-card');
    const list = Array.from(col);
    const cur = list.findIndex((c) => c.classList.contains('on'));
    let i = (cur >= 0 ? cur : 0) + Math.round(kbd.y / 46);
    i = Math.max(0, Math.min(list.length - 1, i));
    setHl(list[i]);
  }
  function pick() {
    if (!hl || !player) return;
    const k = hl.dataset.k;
    if (k.charAt(0) === 'w') {
      const i = parseInt(k.slice(1), 10);
      if (i >= 0 && !player.hands[i]) return;
      if (i === -2 && !player.throwable) return;
      if (i === -4 && !player.items.molotov) { onMsg('No tienes molotovs (alcohol + trapo en la mochila)', 'warn'); return; }
      if (i === -5 && !player.items.mina) { onMsg('No tienes minas (polvo reactivo + clavos en la mochila)', 'warn'); return; }
      if (i === -6 && !player.items.humo) { onMsg('No tienes bombas de humo (polvo reactivo + trapo en la mochila)', 'warn'); return; }
      if (player.busy()) { onMsg('Ahora no puedes cambiar de arma'); return; }
      // elegir lo que ya tienes en la mano lo guarda (manos libres)
      if (i === player.cur) { player.equip(-1); onMsg('Manos libres'); return; }
      player.equip(i); onMsg(i >= 0 ? 'En las manos: ' + player.weapon.name : (i === -2 ? thrName(player.throwable) + ': apunta para ver dónde cae' : (i === -4 ? 'Molotov en la mano: mantén Atacar para apuntar' : (i === -5 ? 'Mina en la mano: Atacar la coloca en el suelo' : (i === -6 ? 'Bomba de humo en la mano: mantén Atacar para apuntar' : 'Manos libres')))));
    } else {
      // la venda a la mano (para vendarte manteniendo Atacar)
      if (!player.items.venda) { onMsg('No tienes vendas', 'warn'); return; }
      if (player.busy()) { onMsg('Ahora no puedes cambiar de arma'); return; }
      if (player.cur === -3) { player.equip(-1); onMsg('Manos libres'); return; }
      player.equip(-3); onMsg('Venda en la mano: mantén Atacar para vendarte');
    }
  }

  // ---------- Cada fotograma ----------
  function update(p, state) {
    player = p;
    if (!root) return;
    const s = p.slot, w = p.weapon, gun = W().isGun(w) && !!s;
    const hp = Math.max(0, Math.round(p.health));
    const k2 = [hp, p.bleeding, p.infected, p.cur, s ? s.id + (s.broken ? 'R' : '') : '', s ? s.mag : '', s ? Math.round((s.cond || 0) * 100) : '',
      gun ? p.ammo[w.ammo] : '', p.items.venda, p.items.molotov, p.items.mina, p.items.humo, p.backpack, style, p.inHandThr || p.throwable || '', p.arrowExp, p.ammo.flecha_exp, p.ammo.flecha, s ? s.exp : '',
      p.healing ? 1 : 0, Math.round(p.heal || 0), p.hands[0] ? p.hands[0].id + Math.round(p.hands[0].cond * 100) : ''].join('|');
    if (k2 === key) return;
    key = k2;
    ring.style.strokeDasharray = hp + ' 100';
    // vendándote: en el arco de vida se ve (verde agua) hasta dónde vas a llegar con esta venda
    const hv = p.healing ? Math.max(0, Math.min(100 - hp, Math.round((p.heal || 0) + (p.bandageHeal || 40)))) : 0;
    healRing.style.strokeDasharray = '0 ' + hp + ' ' + hv + ' 100';
    root.classList.toggle('healing', hv > 0);
    root.classList.toggle('bleed', p.bleeding);
    root.classList.toggle('sick', !!p.infected);
    root.classList.toggle('low', hp < 30);
    // manos libres: el arma con la que golpearías (la cuerpo a cuerpo colgada o la navaja), apagada
    const u = G.Icons.white(p.holdingThr ? p.inHandThr : p.holdingMine ? 'mina' : (p.holdingVenda ? 'botiquin' : (s ? s.id : p.meleeWeapon.id)));
    if (u) { icon.src = u; icon.classList.remove('hidden'); } else icon.classList.add('hidden');
    // manos libres: la navaja (que sale sola al golpear) se ve apagada
    root.classList.toggle('bare', p.cur === -1);
    const bowIn = gun && w.gun === 'bow';
    arrowBtn.classList.toggle('hidden', !bowIn);
    if (bowIn) {
      const ex = p.arrowExp, ui = G.Icons.white(ex ? 'mun_flecha_exp' : 'mun_flecha');
      arrowBtn.classList.toggle('exp', ex);
      arrowBtn.innerHTML = (ui ? '<img alt="" src="' + ui + '">' : '') + '<span>' + (ex ? 'EXP ' + p.ammo.flecha_exp : p.ammo.flecha) + '</span>';
    }
    name.textContent = '';
    root.classList.toggle('gun', gun);
    root.classList.toggle('broken', !!(s && s.broken));
    if (gun) {
      const bow = w.gun === 'bow';
      mag.textContent = s.broken ? '—' : (bow ? (s.mag ? 1 : 0) : s.mag);
      const r = p.ammo[w.ammo];
      // arco con explosivas elegidas: muestra las explosivas que quedan
      const ex = bow && p.arrowExp;
      res.textContent = ex ? p.ammo.flecha_exp + ' exp' : r;
      res.classList.toggle('full', !ex && r >= p.ammoCap(w.ammo));
      res.classList.toggle('exp', !!ex);
      // munición del cargador como rayitas (como en el juego de referencia)
      const n = bow ? 1 : w.mag;
      let h = '';
      for (let i = 0; i < n; i++) h += '<i' + (i < s.mag ? ' class="on"' : '') + '></i>';
      pips.innerHTML = h;
    } else if (s || (p.cur === -1 && p.hands[0])) {
      // cuerpo a cuerpo: golpes que le quedan
      const ms = s || p.hands[0], mw = s ? w : p.meleeWeapon;
      const n = mw.cond, left = Math.max(0, Math.round(ms.cond * n));
      mag.textContent = ''; res.textContent = '';
      let h = '';
      for (let i = 0; i < n; i++) h += '<i' + (i < left ? ' class="on"' : '') + '></i>';
      pips.innerHTML = h;
    } else if (p.holdingVenda) { mag.textContent = 'x' + p.items.venda; res.textContent = ''; pips.innerHTML = ''; }
    else { mag.textContent = ''; res.textContent = ''; pips.innerHTML = ''; }
    // HUD agresivo: sin el atajo de la venda bajo el arma (se usa desde el selector, la mochila o B)
    const nv = style === 'clasico' ? p.items.venda : 0;
    med.classList.toggle('hidden', !nv);
    if (nv) med.innerHTML = '<img alt="" src="' + (G.Icons.white('botiquin') || '') + '"><span>' + nv + '</span>';
  }

  const HUD = {
    init, update, get selecting() { return open; }, onMessage: null,
    padNav, padConfirm, padCancel, padHold, padRelease, quickSwap: () => quick(),
    get style() { return style; },
    get sens() { return sens; },
    setSens(v) { sens = Math.max(1, Math.min(10, Math.round(v))); applySens(); try { localStorage.setItem(SENS_KEY, String(sens)); } catch (e) { /* nada */ } },
    setStyle(v) { style = v === 'clasico' ? 'clasico' : 'agresivo'; try { localStorage.setItem(STYLE_KEY, style); } catch (e) { /* nada */ } document.body.classList.toggle('hud-clasico', style === 'clasico'); }
  };
  G.HUD = HUD;
})(window.Game = window.Game || {});
