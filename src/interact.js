(function (G) {
  'use strict';

  // Busca con qué puede interactuar el jugador y ejecuta la acción. Tres botones separados:
  //   'door'  puertas y ventanas (abrir, cerrar, quitar vidrios)       → botón de la puerta / E
  //   'loot'  muebles, vehículos, montones y armas del suelo            → botón ∆ / T
  //   'vault' ventanas abiertas o rotas y vallas para saltar            → botón Saltar / X

  const U = G.Util;
  const REACH = 1.45;
  const NO_SEARCH = true;        // registrar muebles y cajas: eliminado

  function label(t) {
    return t ? t.label : '';
  }

  function find(player, camF, mode) {
    const W = G.World, E = W.E;
    if (player.dead || player.busy()) return null;
    mode = mode || 'door';
    // humanos: tomar de rehén o soltarlo (puerta / E) y dejar ir al que se rinde (∆ / T)
    // la caja fuerte del saqueo (la lleva el modo)
    if (G.Mode && G.Mode.interactFind && (mode === 'door' || mode === 'loot')) { const mt = G.Mode.interactFind(player, mode); if (mt) return mt; }
    if (G.Humans) {
      const ht = G.Humans.interactFind(player, mode);
      if (ht) return ht;
      if (player.hostage) return null;
    }
    const px = player.pos.x, pz = player.pos.z, lv = player.lv || 0;
    const look = Math.atan2(camF.x, camF.z);
    let best = null, bestScore = Infinity;
    const consider = (x, z, data, maxD) => {
      const d = Math.hypot(x - px, z - pz);
      if (d > (maxD || REACH)) return;
      const a = Math.abs(U.angleDiff(Math.atan2(x - px, z - pz), look));
      if (a > 1.25 && d > 0.75) return;
      const score = d + a * 0.7;
      if (score < bestScore) { bestScore = score; best = data; best.x = x; best.z = z; }
    };

    if (mode === 'door' || mode === 'vault') {
      const tx0 = Math.floor(px) - 2, tz0 = Math.floor(pz) - 2;
      for (let tz = tz0; tz <= tz0 + 4; tz++) {
        for (let tx = tx0; tx <= tx0 + 4; tx++) {
          for (const o of ['N', 'W']) {
            const e = o === 'N' ? W.eN(tx, tz, lv) : W.eW(tx, tz, lv);
            if (!e) continue;
            const ref = { o, x: tx, z: tz, lv };
            const mx = o === 'N' ? tx + 0.5 : tx, mz = o === 'N' ? tz : tz + 0.5;
            if (mode === 'door') {
              let lab = null, kind = null;
              if (e === E.DOOR) { lab = 'Abrir puerta'; kind = 'door'; }
              else if (e === E.DOOR_OPEN) { lab = 'Cerrar puerta'; kind = 'door'; }
              // (las ventanas ya no se abren ni se cierran: son solo el hueco, sin vidrio)
              if (lab) consider(mx, mz, { kind, label: lab, ref, e }, kind === 'door' ? REACH + 0.1 : REACH);
            } else if (lv && (e === E.RAIL || e === E.WIN_OPEN || e === E.WIN_BROKEN)) {
              // arriba: por la barandilla de un balcón o una ventana que da afuera, se salta abajo
              const ax = o === 'N' ? tx : tx - 1, az = o === 'N' ? tz - 1 : tz;
              const inA = W.isIndoor(ax, az, lv) && !W.stairAt(ax + 0.5, az + 0.5), inB = W.isIndoor(tx, tz, lv) && !W.stairAt(tx + 0.5, tz + 0.5);
              if (inA !== inB) consider(mx, mz, { kind: 'drop', label: 'Saltar abajo', ref, e }, REACH);
            } else if (!lv && player.elev > 1.8 && (W.eN && (o === 'N' ? W.eN(tx, tz, 1) : W.eW(tx, tz, 1)) === E.WIN_OPEN)) {
              // desde el techo de un vehículo, frente a una ventana del piso de arriba: se entra por ella
              const fy = W.groundY(mx + (o === 'N' ? 0 : 0.5), mz + (o === 'N' ? 0.5 : 0), 1);
              const py = W.groundY(px, pz, 0) + player.elev;
              if (Math.abs(fy - py) < 1.1) consider(mx, mz, { kind: 'enter', label: 'Entrar por la ventana', ref: { o, x: tx, z: tz, lv: 1 } }, REACH);
            } else if (!lv && !(player.elev > 0.3) && (e === E.WIN_OPEN || e === E.WIN_BROKEN || e === E.FENCE)) {
              // arriba no se salta por las ventanas
              const glass = e === E.WIN_BROKEN && W.hasGlass(ref);
              consider(mx, mz, { kind: 'vault', label: e === E.FENCE ? 'Saltar la valla' : (glass ? 'Saltar (hay vidrios)' : 'Saltar por la ventana'), ref, e, glass, climbable: true }, REACH);
            }
          }
        }
      }
      // Trepar o saltar casi todo: lo bajo (hasta la cintura más o menos) y estrecho se salta por encima; lo
      // demás, hasta algo más alto que el personaje (un contenedor), se trepa y se queda encima
      if (mode === 'vault' && !lv && W.standTop) {
        const base = player.elev || 0;
        const sx = Math.sin(look), sz = Math.cos(look);
        for (const dd of [0.4, 0.65, 0.9, 1.15]) {
          const ex = px + sx * dd, ez = pz + sz * dd;
          const h = W.standTop(ex, ez, 0);
          const dh = h - base;
          if (dh < 0.35 || dh > 2.95) continue;
          // ¿cuánto mide de fondo? (para saltarlo por encima hace falta que sea estrecho y que haya sitio detrás)
          if (dh <= 1.3) {
            let far = -1;
            for (let k = dd + 0.15; k <= dd + 1.6; k += 0.1) {
              if (W.standTop(px + sx * k, pz + sz * k, 0) < base + 0.3) { far = k; break; }
            }
            if (far > 0) {
              const ox = px + sx * (far + 0.45), oz = pz + sz * (far + 0.45);
              if (!W.circleBlocked(ox, oz, 0.3, lv, false, base) && W.standTop(ox, oz, 0) <= base + 0.3 && !W.lineBlocked(px, pz, ox, oz, W.blocksWalkEdge, lv)) {
                consider(ex, ez, { kind: 'ledge', over: true, label: 'Saltar', tx: ox, tz: oz, h: base, lift: dh + 0.2 }, 1.4);
                break;
              }
            }
          }
          const tx = px + sx * (dd + 0.55), tz = pz + sz * (dd + 0.55);
          if (W.standTop(tx, tz, 0) < h - 0.05 || W.circleBlocked(tx, tz, 0.3, lv, false, h)) continue;
          consider(ex, ez, { kind: 'ledge', label: 'Trepar', tx, tz, h }, 1.4);
          break;
        }
      }
      return best;
    }

    // Objetos especiales: las estaciones del refugio y el maletín de suministros del asalto
    if (G.Props) {
      for (const p of G.Props.list) {
        if ((p.lv || 0) !== lv) continue;
        if (Math.hypot(p.x - px, p.z - pz) > (p.reach || 1.6)) continue;
        if (p.kind === 'case' && !p.f.cont.items.length) continue;
        if (p.off && p.off()) continue;
        const fx = p.fx != null ? p.fx : p.x, fz = p.fz != null ? p.fz : p.z;
        if (!W.hasLOS(px, pz, fx, fz, lv)) continue;
        consider(p.x, p.z, { kind: 'prop', label: p.label, p }, p.reach || 1.6);
      }
    }

    // (ya no se registran muebles, cajas ni vehículos: el botín está a la vista, por el suelo)
    for (const { f } of (NO_SEARCH ? [] : W.furnNear(px, pz, 1.5, lv))) {
      if (!f.cont || (f.cont.searched && !f.cont.items.length)) continue;
      const fp = G.Furniture.frontPoint(f);
      if (Math.hypot(fp.x - px, fp.z - pz) > 1.7) continue;
      if (!W.hasLOS(px, pz, fp.x, fp.z, lv)) continue;
      const qx = U.clamp(px, f.x0, f.x1), qz = U.clamp(pz, f.z0, f.z1);
      const nm = f.cont.name.charAt(0).toLowerCase() + f.cont.name.slice(1);
      if (!f.cont.searched) consider(qx, qz, { kind: 'search', label: 'Registrar ' + nm, f }, 1.5);
      else consider(qx, qz, { kind: 'open', label: 'Abrir ' + nm + ' (' + f.cont.items.length + ')', f }, 1.5);
    }

    // Cosas en el suelo: armas de fuego largas, flechas disparadas y montones
    for (const { c, it } of W.itemsNear(px, pz, 1.3, lv)) {
      if (!W.hasLOS(px, pz, it.x, it.z, lv)) continue;
      if (it.pile) { consider(it.x, it.z, { kind: 'pile', label: 'Revisar montón (' + it.pile.length + ')', c, it }, 1.3); continue; }
      const nm = G.Weapons.nameOf(it.id) + (G.Weapons.ammoOfItem(it.id) ? ' (' + it.cond + ')' : '');
      consider(it.x, it.z, { kind: 'item', label: 'Coger ' + nm, c, it }, 1.3);
    }
    return best;
  }

  // Devuelve un mensaje para mostrar (o null)
  function use(t, player) {
    const W = G.World, E = W.E;
    if (!t) return null;
    if (t.kind === 'door') {
      const e = W.edgeGet(t.ref);
      W.setEdge(t.ref, e === E.DOOR ? E.DOOR_OPEN : E.DOOR);
      if (G.Audio) G.Audio.play(e === E.DOOR ? 'doorOpen' : 'doorClose', { x: t.x, z: t.z, lv: player.lv });
      W.emit(t.x, t.z, 3 * player.noiseMul, player.lv);
      return null;
    }
    if (t.kind === 'window') {
      W.setEdge(t.ref, W.edgeGet(t.ref) === E.WIN ? E.WIN_OPEN : E.WIN);
      if (G.Audio) G.Audio.play('window', { x: t.x, z: t.z, lv: player.lv });
      W.emit(t.x, t.z, 2 * player.noiseMul, player.lv);
      return null;
    }
    if (t.kind === 'glass') {
      // un codazo o un golpe con el arma limpia el marco
      player.facing = Math.atan2(t.x - player.pos.x, t.z - player.pos.z);
      G.Combat.startShove(player, [], player.facing);
      return null;
    }
    if (t.kind === 'safe' || t.kind === 'cell' || t.kind === 'chain') return G.Mode.interactUse(t, player);
    if (t.kind === 'release' || t.kind === 'hostage' || t.kind === 'spare') return G.Humans ? G.Humans.interactUse(t, player) : null;
    if (t.kind === 'vault' || t.kind === 'ledge') return climb(t, player);
    if (t.kind === 'drop') return player.startDrop(t.ref) ? null : 'No hay sitio abajo';
    if (t.kind === 'enter') return player.startEnter(t.ref) ? null : 'No hay sitio dentro';
    if (t.kind === 'prop') return t.p.use(player);
    if (t.kind === 'search') {
      player.startSearch(t.f);
      return null;
    }
    if (t.kind === 'open') { G.Loot.open({ f: t.f }, player); return null; }
    if (t.kind === 'pile') { G.Loot.open({ c: t.c, it: t.it }, player); return null; }
    if (t.kind === 'item' && G.Weapons.isItem(t.it.id)) {
      const r = player.takeItem(t.it.id, t.it.cond);
      if (r.left > 0 && r.left < t.it.cond) t.it.cond = r.left;
      else if (r.left <= 0) W.removeItem(t.c, t.it);
      return r.msg;
    }
    if (t.kind === 'item') {
      const w = G.Weapons.get(t.it.id);
      const r = player.pickUp(t.it.id, t.it.cond, t.it.dur);
      if (!r.ok) return player.canUse && !player.canUse(t.it.id) ? player.charName + ' no usa: ' + w.name : 'No te cabe: ' + w.name;
      W.removeItem(t.c, t.it);
      if (r.old) W.dropItem(player.pos.x, player.pos.z, r.old.id, r.old.mag || 0, player.lv).dur = r.old.broken ? 0 : 1;
      let msg = 'Cogiste: ' + w.name;
      if (r.old && !r.old.broken) msg += ' · dejaste: ' + G.Weapons.get(r.old.id).name;
      if (G.Weapons.isGun(w) && t.it.cond > 0) msg += w.gun === 'bow' ? ' (con una flecha puesta)' : ' (' + t.it.cond + ' en el cargador)';
      if (r.stored) msg += ' · guardada en la mochila';
      return msg;
    }
    return null;
  }

  // Saltar por una ventana abierta o rota, o una valla. Los vidrios de una ventana rota cortan
  function climb(t, player) {
    if (t && t.kind === 'ledge') return player.startLedge(t) ? null : 'Ahora no puedes trepar';
    if (!t || !t.climbable) return null;
    const W = G.World;
    if (!player.startClimb(t.ref, t.e === W.E.FENCE ? 'fence' : 'window')) return 'No hay sitio al otro lado';
    W.emit(t.x, t.z, 2.5 * player.noiseMul);
    if (t.e === W.E.WIN_BROKEN && W.hasGlass(t.ref) && Math.random() < 0.55) {
      const lac = Math.random() < 0.3;
      player.wound(lac ? 'laceración' : 'rasguño');
      return lac ? 'Te cortaste con los vidrios: sangras' : 'Te arañaste con los vidrios';
    }
    return null;
  }

  // Termina de registrar un mueble: se abre el menú con lo que hay dentro
  function finishSearch(player, f) {
    if (!f || !f.cont) return null;
    f.cont.searched = true;
    G.Loot.normalize(f.cont.items, f.cont.kind, player);
    if (!f.cont.items.length) return 'No hay nada útil';
    G.Loot.open({ f }, player);
    return null;
  }

  G.Interact = { find, use, label, climb, finishSearch };
})(window.Game = window.Game || {});
