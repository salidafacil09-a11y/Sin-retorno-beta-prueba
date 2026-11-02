(function (G) {
  'use strict';

  // Menú de botín: lo que hay dentro de un mueble, un vehículo o un montón del suelo.
  // Tarjetas en dos columnas (icono, nombre y cantidad); tocar una la coge.
  // Las armas cuerpo a cuerpo, las cortas y la munición no tienen modelo en el suelo:
  // se ven aquí, con un icono sacado de su modelo 3D.

  const W = () => G.World, WP = () => G.Weapons;
  const CLOSE_DIST = 2.0;      // si te alejas más de esto, se cierra
  let src = null;              // { f } mueble · { c, it } montón
  let player = null;
  let at = null;               // dónde estabas al abrirlo
  let box = null, grid = null, title = null, onTake = null;
  let dirty = true;

  const icon = (id) => (G.Icons ? G.Icons.color(id) : null);

  // ---------- Datos ----------
  // Los muebles guardan ids al generarse; al abrirlos por primera vez se decide qué hay de verdad:
  // no aparecen armas que no te caben o que ya llevas, ni la mochila si ya la tienes
  function normalize(list, kind, pl) {
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i];
      if (typeof id !== 'string') continue;
      if (pl && !WP().isItem(id) && !pl.spotFor(id)) { list.splice(i, 1); continue; }
      if (pl && id === 'mochila' && (pl.backpack || pl.packless)) { list.splice(i, 1); continue; }
      const e = { id, cond: W().itemCond(id, Math.random) };
      // cuerpo a cuerpo: golpes que le quedan (entre el 60 % y nuevo); las armas de fuego no tienen estado
      if (!WP().isItem(id) && !WP().isGun(WP().get(id))) { const n = WP().get(id).cond; e.cond = Math.ceil(n * (0.6 + Math.random() * 0.4)) / n; }
      list[i] = e;
    }
    return list;
  }
  function listOf(s) { return s.f ? s.f.cont.items : s.it.pile; }
  function nameOf(s) { return s.f ? s.f.cont.name : 'Montón'; }

  // ---------- Interfaz ----------
  function ensureDom() {
    if (box) return;
    box = document.getElementById('loot');
    if (!box) return;     // sin interfaz (pruebas)
    grid = box.querySelector('.loot-grid');
    title = box.querySelector('.loot-title');
    box.querySelector('.loot-x').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); close(true); });
    box.querySelector('.loot-all').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); takeAll(); });
    // 'click' y no 'pointerdown': así se puede desplazar la lista sin coger nada sin querer
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.loot-card');
      if (!card) return;
      e.preventDefault(); e.stopPropagation();
      take(+card.dataset.i);
    });
    // que tocar el menú no mueva la cámara ni dispare
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (!src) return;
      if (e.code === 'Escape') { close(true); e.preventDefault(); }
    });
    document.addEventListener('pointerlockchange', () => {
      // al volver a capturar el ratón (clic en el juego) se cierra
      if (src && G.Input.pointerLocked) close(false);
    });
  }

  function sub(e) {
    const w = WP().get(e.id);
    if (e.id === 'alcohol') return { txt: e.cond + ' usos', bar: null };
    if (WP().isItem(e.id)) return { txt: e.id === 'mochila' ? '' : 'x' + e.cond, bar: null };
    if (WP().isGun(w)) return { txt: w.gun === 'bow' ? (e.cond ? 'con flecha' : '') : e.cond + '/' + w.mag, bar: null };
    return { txt: Math.round(e.cond * w.cond) + ' golpes', bar: Math.max(0, Math.min(1, e.cond)) };
  }
  // por qué no se puede coger (o null si se puede)
  function why(e) {
    if (WP().isItem(e.id)) {
      if (player.itemRoom(e.id) > 0) return null;
      const sp = WP().SUPPLY[e.id];
      return sp && !sp.cap[0] && !player.bags ? 'Necesitas mochila' : 'Lleno';
    }
    return player.spotFor(e.id) ? null : (player.weapons.some((s) => s.id === e.id) ? 'Ya la tienes' : (player.canUse && !player.canUse(e.id) ? 'No la usa' : 'Sin espacio'));
  }

  function render() {
    dirty = false;
    if (!grid) return;
    const list = listOf(src);
    title.textContent = nameOf(src);
    box.querySelector('.loot-n').textContent = list.length ? list.length + (list.length === 1 ? ' objeto' : ' objetos') : 'Vacío';
    let html = '';
    list.forEach((e, i) => {
      const u = icon(e.id), s = sub(e), no = why(e);
      html += '<button type="button" class="loot-card' + (no ? ' off' : '') + '" data-i="' + i + '">' +
        '<span class="loot-ic">' + (u ? '<img alt="" src="' + u + '">' : '<b>' + WP().nameOf(e.id).charAt(0) + '</b>') + (no && WP().isItem(e.id) && player.fullOf(e.id) ? '<em class="max-tag">MAX</em>' : '') + '</span>' +
        '<span class="loot-tx"><span class="loot-nm">' + WP().nameOf(e.id) + '</span>' +
        (s.bar != null ? '<span class="loot-bar"><i style="width:' + Math.round(s.bar * 100) + '%"></i></span>' : '') +
        (no ? '<span class="loot-no">' + no + '</span>' : '') +
        '</span>' + (s.txt ? '<span class="loot-ct">' + s.txt + '</span>' : '') + '</button>';
    });
    if (!list.length) html = '<div class="loot-empty">No queda nada</div>';
    grid.innerHTML = html;
    box.querySelector('.loot-all').classList.toggle('hidden', list.length < 2);
  }

  function open(s, pl) {
    ensureDom();
    if (s.f) normalize(s.f.cont.items, s.f.cont.kind, pl);
    src = s; player = pl;
    at = { x: pl.pos.x, z: pl.pos.z, lv: pl.lv };
    if (box) box.classList.remove('hidden');
    render();
    // en PC se suelta el ratón para poder tocar las tarjetas (sin pausar el juego)
    if (!G.Input.isTouch && G.Input.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  }

  function close(relock) {
    if (!src) return;
    src = null;
    if (box) box.classList.add('hidden');
    if (relock && !G.Input.isTouch && G.Input.enabled && G.Input.requestLock) G.Input.requestLock();
  }

  function afterChange() {
    const list = listOf(src);
    // un montón vacío desaparece
    if (src.it && !list.length) { W().removeItem(src.c, src.it); close(true); return; }
    render();
  }

  // Coger una cosa. Devuelve el mensaje (o null si no se pudo)
  function takeOne(i) {
    const list = listOf(src), e = list[i];
    if (!e) return null;
    if (WP().isItem(e.id)) {
      const r = player.takeItem(e.id, e.cond);
      if (r.left <= 0) list.splice(i, 1);
      else if (r.left < e.cond) e.cond = r.left;
      else return { msg: r.msg, fail: true };
      return { msg: r.msg };
    }
    const w = WP().get(e.id);
    const r = player.pickUp(e.id, e.cond, e.dur);
    if (!r.ok) return { msg: (player.weapons.some((s) => s.id === e.id) ? 'Ya tienes: ' : 'No te cabe: ') + w.name, fail: true };
    list.splice(i, 1);
    let msg = 'Cogiste: ' + w.name;
    if (WP().isGun(w) && w.gun !== 'bow' && e.cond > 0) msg += ' (' + e.cond + ' en el cargador)';
    if (r.stored) msg += ' · guardada en la mochila';
    if (r.old) {
      // el arma que cambiaste (la rota, o la larga de Booster) se queda aquí
      list.push({ id: r.old.id, cond: r.old.mag || 0, dur: r.old.broken ? 0 : 1 });
      msg += r.old.broken ? ' · dejaste la rota' : ' · dejaste: ' + WP().get(r.old.id).name;
    }
    return { msg };
  }

  function take(i) {
    if (!src) return;
    const r = takeOne(i);
    if (r && onTake) onTake(r.msg, r.fail);
    afterChange();
  }

  // Coge todo lo que quepa
  function takeAll() {
    if (!src) return;
    const list = listOf(src);
    let n = 0, skipped = 0;
    // la mochila primero: así cabe todo lo demás
    const mi = list.findIndex((e) => e.id === 'mochila');
    if (mi >= 0 && !why(list[mi])) { takeOne(mi); n++; }
    for (let i = 0; i < list.length;) {
      const before = list.length, e = list[i];
      const r = why(e) ? null : takeOne(i);
      if (r && !r.fail) n++;
      if (list.length === before) { i++; skipped++; }
    }
    if (onTake) onTake(n ? 'Cogiste ' + n + (n === 1 ? ' cosa' : ' cosas') + (skipped ? ' · el resto no te cabe' : '') : 'No te cabe nada más', !n);
    afterChange();
  }

  // Cada fotograma: se cierra si te alejas, cambias de planta o mueres
  function update() {
    if (!src) return;
    if (!player || player.dead || player.lv !== at.lv || Math.hypot(player.pos.x - at.x, player.pos.z - at.z) > CLOSE_DIST) { close(false); return; }
    if (src.f && !src.f.cont) { close(false); return; }
    if (dirty) render();
  }

  G.Loot = {
    open, close, update, normalize, icon,
    get isOpen() { return !!src; },
    set onMessage(fn) { onTake = fn; },
    // para pruebas
    take, takeAll, get list() { return src ? listOf(src) : null; }
  };
})(window.Game = window.Game || {});
