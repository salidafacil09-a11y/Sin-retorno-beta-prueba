(function (G) {
  'use strict';

  // Mochila (o bolsillos, si aún no la tienes). Se abre con un toque y el personaje se agacha a
  // rebuscar: el mundo NO se pausa. Tiene:
  //   - las armas a mano y las guardadas (toca una larga y luego una guardada para cambiarlas,
  //     o arrástrala encima)
  //   - materiales y objetos (vendas, alcohol, vendas desinfectadas) para usar
  //   - fabricar: venda + alcohol = venda desinfectada (mantén pulsado)
  // La munición no se ve aquí: está en el indicador de combate.

  const CRAFT_MS = 1200;
  let box = null, player = null, selKey = null, onMsg = null;
  let crafting = null;          // { t0, raf }
  let dragFrom = null;
  const el = (id) => document.getElementById(id);
  const W = () => G.Weapons;
  const msg = (m, k) => { if (onMsg) onMsg(m, k); };

  const TXT = {
    venda: 'Recupera 40 de vida en unos segundos. Se lleva en la mano (cruz de armas, arriba, o B): mantén Atacar 2 segundos para vendarte; mientras tanto puedes caminar, pero agachada. Un toque de Atacar sigue siendo un navajazo.',
    venda_d: 'Corta la hemorragia, evita la infección y recupera vida poco a poco (unos 30 puntos en un minuto).',
    alcohol: 'Alcohol para desinfectar. Con 2 botellas y un trapo fabricas una venda.',
    trapo: 'Un trapo limpio. Con 2 botellas de alcohol fabricas una venda.',
    flecha_exp: 'Revienta al clavarse: los infectados cercanos salen volando (los de muy cerca, muertos). Con el arco en la mano, V (o la cruz de armas, arriba) elige flechas normales o explosivas. Receta: 1 flecha + 1 alcohol + 1 trapo.',
    polvo: 'Polvo reactivo: escaso y peligroso. Con clavos haces una mina; con un trapo, una bomba de humo.',
    clavos: 'Un puñado de clavos. Dos, con polvo reactivo, hacen una mina (los clavos hacen de metralla).',
    mina: 'Mina de presión. Con ella en la mano, Atacar la coloca en el suelo. Estalla cuando la pisa un infectado (tú puedes pasar por encima y recogerla): una explosión más grande que las demás que mata a todos los de dentro y aturde a los que quedan justo fuera. Receta: 1 polvo reactivo + 1 clavos. Como mucho llevas 3.',
    humo: 'Bomba de humo. Se lanza como la botella: suelta una nube gris que aturde a los infectados de dentro (sin daño). Si te pilla muy cerca, te deja grogui un momento. Receta: 1 polvo reactivo + 1 trapo.',
    molotov: 'Se lanza como la botella, pero al romperse prende un charco de fuego: los infectados que alcanza arden, se sacuden las llamas unos segundos y van perdiendo vida; el más cercano cae y se revuelca hasta morir. Cuidado: el fuego también te quema.',
    recipe: 'Receta: 2 botellas de alcohol + 1 trapo.'
  };

  function ensure() {
    if (box) return box;
    box = el('pack');
    if (!box) return null;
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    box.querySelector('.pk-x').addEventListener('pointerdown', (e) => { e.preventDefault(); close(true); });
    box.addEventListener('click', (e) => {
      const c = e.target.closest('[data-k]');
      if (!c || c.classList.contains('pk-hold')) return;
      tapCard(c.dataset.k);
    });
    // arrastrar un arma sobre otra la cambia
    box.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.pk-card[data-k^="h"], .pk-card[data-k^="s"]');
      dragFrom = c ? c.dataset.k : null;
    });
    box.addEventListener('pointerup', (e) => {
      if (!dragFrom) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const c = t && t.closest('.pk-card[data-k^="h"], .pk-card[data-k^="s"]');
      if (c && c.dataset.k !== dragFrom) { swap(dragFrom, c.dataset.k); selKey = c.dataset.k; render(); }
      dragFrom = null;
    });
    // mantener para fabricar o usar
    box.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.pk-hold');
      if (!b) return;
      e.preventDefault();
      startCraft(b);
    });
    const stop = () => stopCraft(false);
    box.addEventListener('pointerup', stop);
    box.addEventListener('pointercancel', stop);
    box.addEventListener('pointerleave', stop);
    window.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.code === 'Escape' || e.code === (G.Controls ? G.Controls.key('pack') : 'KeyI')) { e.preventDefault(); close(true); }
    });
    document.addEventListener('pointerlockchange', () => { if (isOpen() && G.Input.pointerLocked) close(false); });
    return box;
  }

  const isOpen = () => !!(box && !box.classList.contains('hidden'));

  function open(p) {
    player = p;
    if (!ensure() || p.dead) return false;
    if (isOpen()) { close(true); return false; }
    if (p.busy()) { msg('Ahora no puedes'); return false; }
    if (G.Loot && G.Loot.isOpen) G.Loot.close(false);
    if (p.stance === 'prone') p.stance = 'crouch';
    p.aiming = false;
    p.action = { kind: 'pack', t: 0, dur: 1e9, impact: 2, face: p.facing, done: false };
    selKey = selKey || 'r:venda';
    box.classList.remove('hidden');
    render();
    if (!G.Input.isTouch && G.Input.pointerLocked && document.exitPointerLock) document.exitPointerLock();
    return true;
  }

  function close(relock) {
    if (!isOpen()) return;
    stopCraft(false);
    box.classList.add('hidden');
    if (player && player.action && player.action.kind === 'pack') player.action = null;
    if (relock && !G.Input.isTouch && G.Input.enabled && G.Input.requestLock) G.Input.requestLock();
  }

  // ---------- Contenido ----------
  function wText(s) {
    const w = W().get(s.id);
    if (W().isGun(w)) return w.gun === 'bow' ? (s.mag ? 1 : 0) + ' | ' + (player.ammo.flecha || 0) : (s.mag || 0) + ' | ' + (player.ammo[w.ammo] || 0);
    return Math.max(0, Math.round(s.cond * w.cond)) + ' golpes';
  }
  function card(k, id, label, txt, extra) {
    const u = id ? G.Icons.white(id) : null;
    return '<button type="button" class="pk-card' + (extra || '') + (selKey === k ? ' sel' : '') + '" data-k="' + k + '">' +
      '<span class="pk-ic">' + (u ? '<img alt="" src="' + u + '">' : '') + '</span>' +
      '<span class="pk-nm">' + label + '</span>' + (txt != null ? '<span class="pk-ct">' + txt + '</span>' : '') + '</button>';
  }

  function render() {
    if (!box || !player) return;
    const p = player;
    // Di' Arco no usa mochila: en el refugio, el armero hace de mochila (sueltas un arma ahí y coges otra)
    const rack = p.packless && G.Run && G.Run.inRefuge;
    const canStore = (p.backpack && !p.packless) || rack;
    box.querySelector('.pk-title').textContent = rack ? 'Bolsillos y armero del refugio' : (p.backpack && !p.packless ? 'Mochila' : 'Bolsillos');
    const names = ['Cuerpo a cuerpo', 'Arma corta', 'Arma larga', 'Arma larga', 'Arma corta'];
    box.querySelector('.pk-hands').innerHTML = [0, 1, 4, 2, 3].map((i) => {
      const s = p.hands[i];
      return s ? card('h' + i, s.id, W().get(s.id).name, wText(s), (s.broken ? ' broken' : '') + (p.cur === i ? ' cur' : ''))
        : card('h' + i, null, names[i], 'vacío', ' empty');
    }).join('');
    box.querySelector('.pk-stored').innerHTML = canStore
      // todas las guardadas (no hay límite) y un hueco libre para guardar otra
      ? p.stored.map((s, i) => card('s' + i, s.id, W().get(s.id).name, wText(s), s.broken ? ' broken' : '')).join('') + card('s' + p.stored.length, null, rack ? 'Dejar en el armero' : 'Guardar aquí', 'libre', ' empty')
      : '<div class="pk-lock">' + (p.packless ? 'No usa mochila: lleva 2 armas cortas y 2 largas. En el refugio puede cambiarlas en el armero.' : 'Sin mochila no puedes guardar armas') + '</div>';
    box.querySelector('.pk-mats').innerHTML =
      card('m:molotov', 'molotov', 'Molotov', (p.items.molotov || 0) + ' / 3', p.items.molotov ? '' : ' empty') +
      card('m:mina', 'mina', 'Mina', (p.items.mina || 0) + ' / ' + W().SUPPLY.mina.cap[p.bags ? 1 : 0], p.items.mina ? '' : ' empty') +
      card('m:humo', 'humo', 'Bomba de humo', (p.items.humo || 0) + ' / ' + W().SUPPLY.humo.cap[p.bags ? 1 : 0], p.items.humo ? '' : ' empty') +
      card('m:polvo', 'polvo', 'Polvo reactivo', (p.items.polvo || 0) + ' / ' + W().SUPPLY.polvo.cap[p.bags ? 1 : 0], p.items.polvo ? '' : ' empty') +
      card('m:clavos', 'clavos', 'Clavos', (p.items.clavos || 0) + ' / ' + W().SUPPLY.clavos.cap[p.bags ? 1 : 0], p.items.clavos ? '' : ' empty') +
      card('m:venda', 'botiquin', 'Venda', p.items.venda + ' / ' + W().SUPPLY.venda.cap[p.bags ? 1 : 0]) +
      card('m:alcohol', 'alcohol', 'Alcohol', p.items.alcohol + ' / ' + W().SUPPLY.alcohol.cap[p.bags ? 1 : 0], p.items.alcohol ? '' : ' empty') +
      card('m:trapo', 'trapo', 'Trapo', p.items.trapo + ' / ' + W().SUPPLY.trapo.cap[p.bags ? 1 : 0], p.items.trapo ? '' : ' empty');
    const okC = p.items.alcohol >= 2 && p.items.trapo >= 1;
    const okM = p.items.alcohol >= 1 && p.items.trapo >= 1 && (p.items.molotov || 0) < 5;
    box.querySelector('.pk-craft').innerHTML = card('r:venda', 'botiquin', 'Venda', '2 alcohol + 1 trapo', okC ? '' : ' empty') +
      card('r:molotov', 'molotov', 'Molotov', '1 alcohol + 1 trapo', okM ? '' : ' empty') +
      card('r:mina', 'mina', 'Mina', '1 polvo + 1 clavos', p.items.polvo >= 1 && p.items.clavos >= 1 ? '' : ' empty') +
      card('r:humo', 'humo', 'Bomba de humo', '1 polvo + 1 trapo', p.items.polvo >= 1 && p.items.trapo >= 1 ? '' : ' empty') +
      card('r:flecha_exp', 'mun_flecha_exp', 'Flecha explosiva', 'flecha + alcohol + trapo', p.ammo.flecha >= 1 && p.items.alcohol >= 1 && p.items.trapo >= 1 ? '' : ' empty');
    const dv = box.querySelector('.pk-dev');
    if (dv) dv.innerHTML = G.DEV ? W().LIST.filter((w) => w.cat !== 'none').map((w) => card('dev:' + w.id, w.id, w.name, W().isGun(w) ? (w.gun === 'bow' ? 'flechas' : 'balas') : 'cuerpo a cuerpo')).join('') : '';
    describe();
  }

  function describe() {
    const p = player, d = box.querySelector('.pk-desc');
    const k = selKey || '';
    let title = '', text = '', act = '';
    if (k.charAt(0) === 'h' || k.charAt(0) === 's') {
      const i = +k.slice(1), s = k.charAt(0) === 'h' ? p.hands[i] : p.stored[i];
      if (!s) { title = k.charAt(0) === 'h' ? 'Espacio vacío' : 'Hueco en la mochila'; text = k.charAt(0) === 's' ? 'Toca un arma a mano para guardarla en la mochila (caben todas).' : (i === 1 || i === 4 ? 'Aquí va un arma corta (pistola o revólver). Toca una guardada para sacarla.' : 'Aquí va un arma larga. Toca una guardada para sacarla.'); }
      else {
        const w = W().get(s.id);
        title = w.name;
        text = W().isGun(w)
          ? 'Munición: ' + wText(s) + ' (en el arma | de reserva).'
          : 'Le quedan ' + wText(s) + '. Sale sola al golpear (como la navaja); al romperse desaparece y vuelves a la navaja.';
        if ((p.backpack && !p.packless || (p.packless && G.Run && G.Run.inRefuge)) && (k !== 'h0')) text += ' Toca ' + (k.charAt(0) === 's' ? 'un espacio a mano del mismo tipo (corta o larga)' : 'un arma guardada o el hueco de la mochila') + ' para cambiarlas.';
        if (k.charAt(0) === 'h' && i > 0) act = '<button type="button" class="pk-btn" data-k="eq' + i + '">' + (p.cur === i ? 'Guardar en la funda' : 'Equipar') + '</button>';
      }
    } else if (k === 'm:venda' || k === 'm:venda_d') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id];
      if (p.items[id]) act = '<button type="button" class="pk-btn" data-k="use:' + id + '">A la mano</button>';
    } else if (k === 'm:molotov') {
      title = 'Molotov'; text = TXT.molotov + ' Llevas ' + (p.items.molotov || 0) + '. Va aparte de la botella o el ladrillo: puedes llevar las dos cosas.';
      if (p.items.molotov) act = '<button type="button" class="pk-btn" data-k="usem">A la mano</button>';
    } else if (k === 'm:mina' || k === 'm:humo') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id] + ' Llevas ' + (p.items[id] || 0) + '.';
      if (p.items[id]) act = '<button type="button" class="pk-btn" data-k="usex:' + id + '">A la mano</button>';
    } else if (k === 'm:polvo' || k === 'm:clavos') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id] + ' Tienes ' + p.items.polvo + ' de polvo reactivo, ' + p.items.clavos + ' clavos y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
    } else if (k === 'r:mina' || k === 'r:humo') {
      const id = k.slice(2), mina = id === 'mina';
      const ok = p.items.polvo >= 1 && (mina ? p.items.clavos >= 2 : p.items.trapo >= 1) && p.itemRoom(id) > 0;
      title = 'Fabricar ' + (mina ? 'mina' : 'bomba de humo'); text = TXT[id] + ' Tienes ' + p.items.polvo + ' de polvo reactivo, ' + (mina ? p.items.clavos + ' clavos.' : p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '.' : 's.'));
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft:' + id + '"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : (p.itemRoom(id) <= 0 ? 'No caben más' : 'Te faltan materiales')) + '</span></button>';
    } else if (k === 'm:alcohol' || k === 'm:trapo') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id] + ' Tienes ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
    } else if (k === 'r:flecha_exp') {
      title = 'Fabricar flecha explosiva'; text = TXT.flecha_exp + ' Tienes ' + p.ammo.flecha + ' flechas, ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
      const ok = p.ammo.flecha >= 1 && p.items.alcohol >= 1 && p.items.trapo >= 1;
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft:flecha_exp"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : 'Te faltan materiales') + '</span></button>';
    } else if (k === 'r:molotov') {
      title = 'Fabricar molotov'; text = TXT.molotov + ' Gasta lo mismo que una venda: 1 alcohol y 1 trapo (tienes ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '). O te curas, o la fabricas.';
      const ok = p.items.alcohol >= 1 && p.items.trapo >= 1 && (p.items.molotov || 0) < 5;
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft:molotov"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : 'Te faltan materiales') + '</span></button>';
    } else if (k === 'r:venda') {
      title = 'Fabricar venda'; text = TXT.venda + ' ' + TXT.recipe + ' Tienes ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
      const full = p.itemRoom('venda') <= 0, ok = p.items.alcohol >= 2 && p.items.trapo >= 1 && !full;
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : (full ? 'No caben más' : 'Te faltan materiales')) + '</span></button>';
    }
    d.innerHTML = '<b>' + title + '</b><p>' + text + '</p><div class="pk-acts">' + act + '</div>';
  }

  // tocar: seleccionar; tocar un arma con otra seleccionada: cambiarlas
  function tapCard(k) {
    const p = player;
    if (k.indexOf('eq') === 0) { const i = +k.slice(2); if (p.hands[i]) { p.cur === i ? p.equip(-1) : p.equip(i); } render(); return; }
    if (k.indexOf('use:') === 0) {
      close(false);
      p.equip(-3);
      msg(p.cur === -3 ? 'Venda en la mano: mantén Atacar para vendarte (puedes caminar agachada)' : 'No tienes vendas', p.cur === -3 ? 'good' : 'warn');
      return;
    }
    if (k.indexOf('usex:') === 0) {
      const id = k.slice(5), slot = id === 'mina' ? -5 : -6;
      close(false);
      p.equip(slot);
      msg(p.cur === slot ? (id === 'mina' ? 'Mina en la mano: Atacar la coloca en el suelo' : 'Bomba de humo en la mano: mantén Atacar para apuntar y suelta para lanzar') : 'No tienes', p.cur === slot ? 'good' : 'warn');
      return;
    }
    if (k === 'usem') {
      close(false);
      p.equip(-4);
      msg(p.cur === -4 ? 'Molotov en la mano: mantén Atacar para apuntar y suelta para lanzar' : 'No tienes molotovs', p.cur === -4 ? 'good' : 'warn');
      return;
    }
    if (k === 'craft' || k.indexOf('craft:') === 0) return;
    if (k.indexOf('dev:') === 0) { const m = p.devGive(k.slice(4)); if (m) msg(m); render(); return; }
    const w1 = selKey && (selKey.charAt(0) === 'h' || selKey.charAt(0) === 's');
    const w2 = k.charAt(0) === 'h' || k.charAt(0) === 's';
    if (w1 && w2 && selKey !== k && swap(selKey, k)) { selKey = k; render(); return; }
    selKey = k;
    render();
  }

  // cambia un arma a mano (pistoleras h1/h4 o espalda h2/h3) con una guardada (o la guarda en el hueco libre)
  function swap(a, b) {
    const p = player;
    let h = null, s = null;
    for (const k of [a, b]) { if (/^h[1-4]$/.test(k)) h = +k.slice(1); else if (k.charAt(0) === 's') s = +k.slice(1); }
    if (h == null || s == null || !((p.backpack && !p.packless) || (p.packless && G.Run && G.Run.inRefuge))) return false;
    if (!p.hands[h] && !p.stored[s]) return false;
    const was = p.hands[h];
    if (!p.swapStored(h, s)) { msg(h === 1 || h === 4 ? 'Ahí solo va un arma corta' : 'Ahí solo va un arma larga', 'warn'); return false; }
    msg(p.hands[h] ? 'A mano: ' + W().get(p.hands[h].id).name : (p.packless ? 'Dejaste en el armero: ' : 'Guardaste en la mochila: ') + W().get(was.id).name);
    return true;
  }

  // ---------- Fabricar (mantener pulsado) ----------
  function startCraft(b) {
    if (b.classList.contains('off')) return;
    const fill = b.querySelector('.pk-fill');
    const recipe = b.dataset.k.indexOf('craft:') === 0 ? b.dataset.k.slice(6) : 'venda';
    crafting = { t0: performance.now(), fill };
    const step = () => {
      if (!crafting) return;
      const k = Math.min(1, (performance.now() - crafting.t0) / CRAFT_MS);
      fill.style.width = (k * 100) + '%';
      if (k >= 1) {
        crafting = null;
        const m = player.craft(recipe);
        msg(m || (recipe === 'molotov' ? 'Fabricaste una molotov: lánzala como la botella' : (recipe === 'flecha_exp' ? 'Fabricaste una flecha explosiva'
          : (recipe === 'mina' ? 'Fabricaste una mina: póntela en la mano y Atacar la coloca' : (recipe === 'humo' ? 'Fabricaste una bomba de humo' : 'Fabricaste una venda')))), m ? 'warn' : 'good');
        render();
        return;
      }
      crafting.raf = requestAnimationFrame(step);
    };
    crafting.raf = requestAnimationFrame(step);
  }
  function stopCraft() {
    if (!crafting) return;
    cancelAnimationFrame(crafting.raf);
    if (crafting.fill) crafting.fill.style.width = '0%';
    crafting = null;
  }

  // Cada fotograma: se cierra si algo te interrumpe (un golpe) o mueres
  function update(p) {
    player = p;
    if (!isOpen()) return;
    if (p.dead || !p.action || p.action.kind !== 'pack') close(false);
  }

  G.Backpack = {
    open, close, update, render,
    get isOpen() { return isOpen(); },
    set onMessage(fn) { onMsg = fn; }
  };
})(window.Game = window.Game || {});
