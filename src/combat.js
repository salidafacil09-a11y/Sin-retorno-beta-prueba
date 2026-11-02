(function (G) {
  'use strict';
  // golpes cuerpo a cuerpo (los que Di' Arco da más rápido)
  const MELEE_ACT = { punch1: 1, punch2: 1, punch3: 1, swing1: 1, swing1b: 1, swing2: 1, swing2b: 1, overhead: 1, stab: 1, slash: 1, thrust: 1, shove: 1, stomp: 1, bash: 1, runatk: 1, runshove: 1, kslash1: 1, kslash2: 1, kstab: 1 };

  // Combate cuerpo a cuerpo al estilo del original:
  // - Apuntar (clic derecho / LT) te deja quieto y encarado; atacar sin apuntar también vale.
  // - Cada arma tiene alcance, daño, velocidad, críticos, golpes múltiples y probabilidad de derribo.
  // - Empujón (Espacio): aparta y puede tirar al suelo; contra un zombi caído es un pisotón.
  // - Golpear a un zombi caído es un ataque al suelo (más daño, a la cabeza).
  // - Los cuchillos pueden rematar de un golpe por la espalda o en el suelo.
  // - El arma se desgasta y se rompe. La resistencia baja con cada golpe.
  // - Los zombis agarran: rasguños, laceraciones y mordiscos (los mordiscos infectan).

  const U = G.Util;
  const IMPACT = 0.45;
  // impacto propio de algunos golpes (cuando el arma pasa de verdad por el cuerpo en su animación)
  const IMPACT_K = { overhead: 0.48, kslash2: 0.46, swing2b: 0.43 };
  // golpes que se pueden encadenar
  const COMBO_KINDS = { swing1: 1, swing1b: 1, swing2: 1, swing2b: 1, overhead: 1, stab: 1, slash: 1, thrust: 1, punch1: 1, punch2: 1, punch3: 1, kslash1: 1, kslash2: 1, kstab: 1 };
  // Puños (manos libres): gancho de derecha, gancho de izquierda y un golpe fuerte que sale agachado.
  // dur en segundos; impact = momento del golpe (0 a 1); next = desde cuándo sale el siguiente del combo
  const PUNCH = [
    { kind: 'punch1', dur: 0.5, impact: 0.42, next: 0.6, dmg: [0.24, 0.4], knock: 0.06, side: 1 },
    { kind: 'punch2', dur: 0.46, impact: 0.42, next: 0.58, dmg: [0.22, 0.36], knock: 0.06, side: -1 },
    { kind: 'punch3', dur: 0.88, impact: 0.52, next: 0.8, dmg: [0.5, 0.8], knock: 0.5, side: 1 }
  ];
  const ANIM = 0.9;          // ritmo general de los ataques (menor = más rápidos)
  // Resistencia de los infectados a los golpes cuerpo a cuerpo: el daño de las armas se multiplica por esto
  // (en campo abierto, con la navaja hacen falta unos 9 tajos; con un bate, 6 o 7). El golpe que lo dejaría muerto no lo mata:
  // lo deja aturdido para rematarlo, salvo el último del combo con la navaja, que se convierte en el remate
  const MELEE_MUL = 0.33;
  // acciones con silbido de golpe (las que no llevan arma ni puño las marca esta tabla); false: nunca
  const SWISH = { bash: true, shove: true, stomp: true, runatk: true, runshove: true, throw: false, plant: false, pickup: false, pickupHi: false, search: false, bandage: false, pack: false, grab: false, shoveoff: false };
  const BLADE = { sblade: 1, lblade: 1, axe: 1, spear: 1 };
  const PUNCH_MUL = 0.5;        // a puñetazos también aguantan más (algo menos que con armas: los puños ya son flojos)
  // Pelea hacia la pared: cada golpe empuja al infectado hacia la pared, valla, mueble alto o mesa más cercana
  // (que no quede detrás de ti) a menos de STEER_R metros, como mucho STEER_STEP metros por golpe. Cuando ya
  // está a menos de PIN_D de ella (y lo has golpeado hace poco), Atacar lo remata contra ella
  // golpes que recibes de un infectado: daño, reacción (como las de ellos), lado, empuje y fuerza en la cámara
  const PUNCH_TAKEN = {
    0: { dmg: 6, react: 'side', fl: 1, push: 1.1, cam: 0.6 },
    1: { dmg: 6, react: 'side', fl: -1, push: 1.1, cam: 0.6 },
    2: { dmg: 13, react: 'heavy', fl: 0, push: 2.7, cam: 1.1 },
    run: { dmg: 15, react: 'heavy', fl: 0, push: 3.8, cam: 1.25 }
  };
  const HOLD_AIM_MS = 180;      // con el arco: mantener más que esto = apuntar y tensar
  const HEAL_HOLD_MS = 200;     // con la venda en la mano: mantener más que esto = vendarse
  const RUN_MIN = 4;            // metros corriendo antes de poder hacer el ataque en carrera
  const STEER_R = 6, STEER_STEP = 1.0, PIN_D = 1.0, PIN_TIME = 3.5, EXEC_REACH = 1.7;
  // reacción del zombi según el golpe: [tipo, lado, zona] (lado +1: hacia la derecha del zombi, la izquierda de
  // quien pega). La zona solo cuenta en el suelo y en los remates: de pie, todos los golpes van al cuerpo (daño
  // normal, ver MELEE_MUL). Los puñetazos nunca matan de un golpe
  const HIT_REACT = {
    swing2: ['side', 1, 'body'], swing2b: ['side', -1, 'body'], swing1: ['vert', 1, 'head'], swing1b: ['side', -1, 'body'], overhead: ['vert', 1, 'head'],
    slash: ['side', -1, 'body'], stab: ['stab', 1, 'body'], thrust: ['stab', 1, 'body'], punch1: ['side', 1, 'body'], punch2: ['side', -1, 'body'], punch3: ['heavy', 1, 'body'],
    kslash1: ['side', 1, 'body'], kslash2: ['side', -1, 'body'], kstab: ['stab', 1, 'head']
  };
  // estados en los que un zombi no te ha visto y se le puede agarrar por la espalda
  const GRAB_OK = { idle: 1, wander: 1, investigate: 1, bang: 1 };
  // chaskeado: aguantan muchísimo más cuerpo a cuerpo (se les puede pegar, pero contestan enseguida)
  const BLIND_MELEE = 0.7;
  // ...salvo con armas largas: con ellas se le puede matar peleando (le hacen más y lo frenan más rato)
  const BLIND_MELEE_LONG = 1.4;
  // con armas cortas (navaja, cuchillos, herramientas pequeñas, puños) aguanta dos golpes seguidos: al tercero
  // te corta el combo de un manotazo y se te echa encima (4 o 5 golpes rápidos para soltarte). "Seguidos": sin pasar este tiempo entre uno y otro
  const CUT_HITS = 2, CUT_WINDOW = 4;
  // dos toques de Atacar en este tiempo cortan la recarga
  const RELOAD_TAP2 = 0.45;
  // remate del chaskeado: pulsar Atacar justo al empezar (antes de este tiempo) te libra por poco
  const KILL_ESCAPE_DMG = 20;
  const STEALTH_R = 1.85;          // alcance del asesinato silencioso (por la espalda)
  const WHIFF_NOISE = 7;           // golpe al aire: se oye (radio en m, de pie; agachada la mitad)
  const HIT_ALERT_R = 16;          // si un infectado te pega, los de alrededor acuden

  // Distancia a la primera superficie (pared, valla, puerta o ventana cerradas, o un mueble alto) en la
  // dirección (ux, uz) desde (x, z); null si no hay ninguna antes de maxD
  function surfaceHit(x, z, ux, uz, maxD, lv) {
    const W = G.World, E = W.E;
    const f = W.lineHit(x, z, x + ux * maxD, z + uz * maxD, (e) => e !== E.NONE && e !== E.DOOR_OPEN && e !== E.DOOR_BROKEN && e !== E.ARCH, lv);
    let d = f >= 0 ? f * maxD : null;
    const base = W.baseAt(x, z, lv) + (lv ? W.FLOOR_H : 0);
    for (let t = 0.25; t <= maxD; t += 0.1) {
      if (d != null && t >= d) break;
      if (W.furnTop(x + ux * t, z + uz * t, lv, 0.04) > base + 0.6) { d = t; break; }
    }
    return d;
  }

  const Combat = {
    stats: null,
    dragT: 0,
    hitStop: 0,
    onMessage: null,
    onHit: null,

    msg(text, kind) { if (this.onMessage) this.onMessage(text, kind); },

    // Cadena de golpes: [primero, segundo, tercero (fuerte)]
    comboFor(w, two) {
      if (w.knife) return ['kslash1', 'kslash2', 'kstab'];
      const base = this.animFor(w, two);
      if (base === 'swing2') return ['swing2', 'swing2b', 'overhead'];
      if (base === 'swing1') return two ? ['swing1', 'swing2b', 'overhead'] : ['swing1', 'swing1b', 'swing1'];
      if (base === 'stab') return ['stab', 'slash', 'stab'];
      return ['thrust', 'thrust', 'thrust'];
    },

    // Animación según el arma y cómo la agarras
    animFor(w, two) {
      if (w.cat === 'sblade') return 'stab';
      if (w.cat === 'spear') return 'thrust';
      if (w.cat === 'lblunt') return two ? 'swing2' : 'swing1';
      if (w.cat === 'axe' || w.cat === 'lblade') return w.hands === 2 && two ? 'swing2' : 'swing1';
      return 'swing1';
    },

    // Zombis delante del jugador dentro de un alcance y un ángulo
    inFront(player, zombies, range, arc, filter) {
      const out = [];
      for (const z of zombies) {
        if (!z.alive || !filter(z)) continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > range) continue;
        const a = Math.abs(U.angleDiff(Math.atan2(dx, dz), player.facing));
        if (a > arc && d > 0.45) continue;
        if ((z.lv || 0) !== (player.lv || 0)) continue;
        if (Math.abs((z.elev || 0) - (player.elev || 0)) > 1.2) continue;     // uno encima de un contenedor y el otro abajo
        if (!G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) continue;
        out.push({ z, d, a });
      }
      out.sort((p, q) => p.d - q.d);
      return out;
    },

    // Zombi al que apuntas: el más centrado delante de la cámara y a tu alcance
    pickTarget(player, zombies, camYaw, extra) {
      const range = player.weapon.range + (extra != null ? extra : 0.8);
      let best = null, bestA = 0.62;
      for (const z of zombies) {
        if (!z.alive) continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > range) continue;
        const a = Math.abs(U.angleDiff(Math.atan2(dx, dz), camYaw));
        if (a < bestA && (z.lv || 0) === (player.lv || 0) && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bestA = a; best = z; }
      }
      return best;
    },

    // Dirección de ataque con un poco de ayuda para apuntar
    aimYaw(player, zombies, camYaw) {
      const z = this.pickTarget(player, zombies, camYaw);
      return z ? Math.atan2(z.pos.x - player.pos.x, z.pos.z - player.pos.z) : camYaw;
    },

    // Objetivo cuerpo a cuerpo: el zombi más cercano a tu alcance (con un paso), en cualquier dirección.
    // Si empujas el joystick hacia uno, se elige ese: así se puede ir pegando a dos que te rodean.
    // Devuelve { z, d, yaw } o null
    meleeTarget(player, zombies, camYaw, input, extra) {
      const w = player.weapon;
      const range = (w.cat === 'none' ? 0.9 : w.range) + (extra != null ? extra : 1.35);
      let intent = null;
      const mv = input && input.move;
      if (mv && Math.hypot(mv.x, mv.y) > 0.35) {
        const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
        intent = Math.atan2(fx * -mv.y + rx * mv.x, fz * -mv.y + rz * mv.x);
      }
      let best = null, bestS = Infinity;
      for (const z of zombies) {
        if (!z.alive || !(z.standing || z.state === 'rise')) continue;
        if ((z.lv || 0) !== (player.lv || 0)) continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > range) continue;
        const yaw = Math.atan2(dx, dz);
        let s = d;
        if (intent != null) s += Math.abs(U.angleDiff(yaw, intent)) * 0.9;
        else s += Math.abs(U.angleDiff(yaw, camYaw)) * 0.22;     // a igual distancia, el que tienes delante
        if (s >= bestS) continue;
        if (!G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) continue;
        bestS = s; best = { z, d, yaw };
      }
      return best;
    },

    // ---------- Entrada del jugador ----------
    handleInput(player, input, zombies, camYaw) {
      this.input = input;
      this.camYaw = camYaw;
      if (player.dead) return;
      // en el refugio se puede apuntar (y recargar) pero no disparar ni golpear
      if (this.peaceful) {
        // (curarse sí: con la venda en la mano, mantener Atacar te venda; un toque no hace nada)
        if (player.holdingVenda) {
          if (player.healing) { if (!input.attackHeld) { player.stopHeal(); this.msg('Dejaste de vendarte', 'warn'); } }
          else if (input.attack && !player.healPress) player.healPress = { t0: performance.now() };
          else if (player.healPress) {
            if (!input.attackHeld) player.healPress = null;
            else if (performance.now() - player.healPress.t0 > HEAL_HOLD_MS) { player.healPress = null; const m = player.startHeal(); if (m) this.msg(m, 'warn'); }
          }
          input.attack = false;
          if (input.dodge) this.startDodge(player, input, camYaw);
          return;
        }
        player.healPress = null;
        if (input.attack) { input.attack = false; const now = this.clock || 0; if (now - (this.peaceMsgT || -99) > 5) { this.peaceMsgT = now; this.msg('En el refugio no se dispara ni se golpea'); } }
        player.bowPress = null;
        if (input.dodge) { this.startDodge(player, input, camYaw); return; }
        if (input.reload && G.Guns) G.Guns.handleInput(player, input, zombies);
        return;
      }
      // forcejeo: cada pulsación de atacar cuenta para soltarte
      if (input.attack) this.atkPressT = this.clock || 0;
      // (el agarre del chaskeado también: 4 o 5 golpes rápidos y te lo quitas de encima)
      if (player.struggle) { if (input.attack) { player.struggle.n++; if (player.struggle.kill && player.struggle.n >= player.struggle.need) player.struggle.esc = true; } return; }
      if (player.lifted) return;
      // con un rehén: apuntar y disparar a los demás, ejecutarlo o soltarlo (lo lleva G.Humans)
      if (player.hostage && G.Humans && G.Humans.hostageInput(player, input, zombies)) return;
      // esquiva: también corta la recuperación de un golpe
      if (input.dodge && !(player.perks && player.perks.noDodge)) { this.startDodge(player, input, camYaw); return; }
      if (input.dodge) this.startDodge(player, input, camYaw);
      // recargando un arma de fuego: un toque suelto de Atacar no la corta (se pierde la recarga y te deja
      // expuesto); hacen falta dos toques seguidos
      if (input.attack && !player.aiming && player.gun && (player.gun.reload || player.gun.wantReload) && G.Weapons.isGun(player.weapon) && player.weapon.gun !== 'bow') {
        const now = this.clock || 0;
        if (this.rlTap == null || now - this.rlTap > RELOAD_TAP2) {
          this.rlTap = now; input.attack = false;
          if (now - (this.rlMsgT || -99) > 6) { this.rlMsgT = now; this.msg('Recargando: toca dos veces Atacar para cortar la recarga'); }
          return;
        }
        this.rlTap = null;
      }
      const a = player.action;
      // agarrar por la espalda a un zombi desprevenido: con el botón de ataque (sin apuntar)
      if (input.attack && !player.aiming && !player.busy() && !player.dodging && !(player.prone || player.proneAmt > 0.4)) {
        const g = this.grabTarget(player, zombies);
        if (g) { this.startGrab(player, g); return; }
        // al temblante no se le puede eliminar por la espalda: se gira, te levanta con un brazo y te tira
        const tz = this.grabTarget(player, zombies, true);
        if (tz) { tz.startThrow(); this.msg('¡Al temblante no se le puede eliminar así!', 'bad'); return; }
      }
      // arco sin el botón de apuntar: mantener Atacar apunta y tensa (cuanto más rato, más tenso y más lejos);
      // al soltar dispara. Un toque es un navajazo. Soltar encima de Cancelar no dispara
      const bowIn = player.weapon.gun === 'bow' && player.slot && !player.slot.broken;
      if (bowIn && !input.aim) {
        if (player.bowPress) {
          if (input.cancel) { player.bowPress = null; player.gun.draw = 0; this.msg('Tiro cancelado'); return; }
          if (input.attackHeld) return;
          const held = performance.now() - player.bowPress.t0 > HOLD_AIM_MS;
          player.bowPress = null;
          if (held) {
            if (!player.busy() && G.Guns) {
              const g = player.gun;
              // soltaste antes de tensar lo mínimo: avisa en vez de no hacer nada
              if (player.slot.mag && !g.cycle && g.cooldown <= 0 && (g.aim < 0.6 || g.draw < 0.15)) this.msg('Mantén más para tensar el arco', 'warn');
              else G.Guns.tryFire(player, zombies);
            }
            return;
          }
          input.attack = true;                     // toque: sigue como un ataque normal
        } else if (input.attack && !player.busy() && !player.dodging && !(player.prone || player.proneAmt > 0.4)) { player.bowPress = { t0: performance.now() }; return; }
      } else player.bowPress = null;
      // armas de fuego: disparar al apuntar, recargar (R, o empujar mientras apuntas)
      if (G.Guns && G.Guns.handleInput(player, input, zombies)) return;
      // pulsar atacar durante un golpe encadena el siguiente (combo de 3)
      if (a && input.attack && COMBO_KINDS[a.kind] && a.t > (a.punch ? 0.15 : 0.3)) { a.queued = true; return; }
      if (player.busy() || player.dodging) return;
      // tumbado no se puede atacar: el primer toque te levanta
      if (input.attack && (player.prone || player.proneAmt > 0.4)) { player.setStance('crouch'); return; }
      // venda en la mano: mantener Atacar te venda (agachada, caminando); un toque es un navajazo normal
      if (player.holdingVenda) {
        if (player.healing) { if (!input.attackHeld) { player.stopHeal(); this.msg('Dejaste de vendarte', 'warn'); } return; }
        if (input.attack && !player.healPress) { player.healPress = { t0: performance.now() }; return; }
        if (player.healPress) {
          if (!input.attackHeld) { player.healPress = null; input.attack = true; }      // toque: sigue como un ataque
          else {
            if (performance.now() - player.healPress.t0 > HEAL_HOLD_MS) {
              player.healPress = null;
              const m = player.startHeal();
              if (m) this.msg(m, 'warn');
            }
            return;
          }
        }
      } else player.healPress = null;
      // mina en la mano: Atacar la coloca en el suelo (te agachas un instante y listo para salir corriendo)
      if (player.holdingMine && input.attack && !player.aiming) {
        player.action = { kind: 'plant', t: 0, dur: 0.5, impact: 0.55, face: player.facing, done: false };
        return;
      }
      // agachada y ya te vieron: para pegar te levantas (sin que te hayan visto, el ataque sigue agachado)
      if (input.attack && player.stance === 'crouch' && this.spotted(player, zombies)) player.setStance('stand');
      const w = player.weapon;
      // un aturdido al alcance: remate (con un arma de fuego en la mano, la guarda y saca la navaja). Va antes
      // que el ataque en carrera: llegar corriendo a uno aturdido y atacar también lo remata
      const runningNow = player.running && player.moveAmt > 0.6 && (player.speedNow || 0) > 2.6;
      if (input.attack && !player.aiming) {
        const ez = this.execTarget(player, zombies, runningNow ? 3.2 : 1.95);
        if (ez) { this.startExecution(player, ez, runningNow && w.cat !== 'none' ? 'run' : null); return; }
      }
      // con el ladrillo o la botella en la mano: un toque lo lanza al fijado y mantener el botón apunta (zoom y
      // parábola) y al soltar lo lanza (el botón de apuntar, en cambio, saca el arma de fuego)
      if (player.holdingThr && G.Pickups) {
        if (player.thrPress && input.cancel) { player.thrPress = null; this.msg('Lanzamiento cancelado'); return; }
        if (input.attack && !player.thrPress) player.thrPress = { t0: performance.now() };
        if (player.thrPress) {
          if (!input.attackHeld) { player.thrPress = null; G.Pickups.startThrow(player, zombies, camYaw); }
          return;
        }
      } else player.thrPress = null;
      // ataque en carrera: corriendo, atacar lanza un golpe con todo el impulso. Con la navaja (o con un arma de
      // fuego en la mano, que se guarda) y un infectado delante, lo ensarta y lo mata (como en el vídeo)
      // hace falta haber corrido un poco (RUN_MIN metros): recién arrancando no hay impulso
      // Booster sin arma cuerpo a cuerpo: pega a puñetazos (nunca saca la navaja)
      const fistsOnly = !!(player.perks && player.perks.fists && !player.hands[0]);
      if (input.attack && !fistsOnly && player.running && player.moveAmt > 0.6 && (player.runDist || 0) >= RUN_MIN) {
        if (w.knife || G.Weapons.isGun(w)) {
          const rz = this.runKillTarget(player, zombies);
          if (rz) { this.startExecution(player, rz, 'runkill'); return; }
        }
        if (w.cat !== 'gun') { this.startRunAttack(player, zombies, camYaw); return; }
      }
      if (input.attack && w.cat !== 'none' && !(fistsOnly && (w.knife || G.Weapons.isGun(w)))) this.startAttack(player, zombies, camYaw);
      else if (input.attack) this.startPunch(player, zombies, camYaw, 0);
    },

    // ¿Algún infectado sabe dónde estás (te persigue, te pega o se acaba de llevar un golpe tuyo)?
    spotted(player, zombies) {
      for (const z of zombies) {
        if (!z.alive || (z.lv || 0) !== (player.lv || 0)) continue;
        const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
        if ((z.aware() && d < 30) || ((z.state === 'stagger' || z.state === 'stun') && d < 6)) return true;
      }
      return false;
    },

    // ¿Hay un zombi desprevenido de espaldas, al alcance, para agarrarlo?
    grabTarget(player, zombies, temb) {
      if (player.dead || player.busy() || player.prone) return null;
      let best = null, bestD = STEALTH_R;
      for (const z of zombies) {
        if (!z.alive || !!z.temb !== !!temb || !z.standing) continue;
        if (z.human ? !z.grabOk : !(GRAB_OK[z.state] || (z.stalker && (z.state === 'stalk' || z.state === 'hide')))) continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > bestD) continue;
        if (Math.abs(U.angleDiff(Math.atan2(dx, dz), player.facing)) > 1.15 && d > 0.6) continue;
        if (!this.behind(player, z)) continue;
        if ((z.lv || 0) !== (player.lv || 0)) continue;
        if (Math.abs((z.elev || 0) - (player.elev || 0)) > 1.0) continue;
        if (!G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) continue;
        best = z; bestD = d;
      }
      return best;
    },

    // Siempre llevas una navaja para el sigilo (no se gasta ni ocupa espacio): tres puñaladas al cuello
    startGrab(player, z) {
      const knife = true;
      const face = Math.atan2(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
      // desde algo más lejos: da un paso rápido hacia él (y él queda pegado a ti)
      const d0 = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
      if (d0 > 0.8) G.World.move(player.pos, Math.sin(face) * (d0 - 0.8) * 0.7, Math.cos(face) * (d0 - 0.8) * 0.7, 0.3, player.lv || 0);
      player.action = { kind: 'grab', t: 0, dur: knife ? 1.7 : 2.8, impact: knife ? 0.62 : 0.8, face, target: z, knife, done: false };
      if (player.stance !== 'stand') player.stance = 'stand';
      z.grab(player);
      player.stamina = Math.max(0, player.stamina - 0.06);
    },

    // Ataque en carrera: el personaje se lanza con el impulso (como en el vídeo de referencia):
    // brazo izquierdo adelante, el arma arriba detrás de la cabeza y golpe de arriba abajo al llegar.
    // Hace más daño y casi siempre derriba. Sin arma es un placaje.
    startRunAttack(player, zombies, camYaw) {
      const w = player.weapon;
      const moveYaw = Math.atan2(player.vel.x, player.vel.z);
      // objetivo: el zombi más centrado hacia donde corres (si hay)
      let tgt = null, bestA = 0.7;
      for (const z of zombies) {
        if (!z.alive || !z.standing || (z.lv || 0) !== (player.lv || 0)) continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.hypot(dx, dz);
        if (d > w.range + 2.4) continue;
        const a2 = Math.abs(U.angleDiff(Math.atan2(dx, dz), moveYaw));
        if (a2 < bestA && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bestA = a2; tgt = z; }
      }
      const face = tgt ? Math.atan2(tgt.pos.x - player.pos.x, tgt.pos.z - player.pos.z) : moveYaw;
      const d = tgt ? Math.hypot(tgt.pos.x - player.pos.x, tgt.pos.z - player.pos.z) : 2;
      const g = G.Weapons.grip(w);
      player.action = {
        kind: w.cat === 'none' ? 'runshove' : 'runatk', t: 0, dur: 0.78, impact: 0.42, face, done: false,
        weapon: w, two: player.twoHanded, g, run: true, target: tgt,
        step: { len: Math.max(0.6, Math.min(2.0, d - w.range * 0.6)), done: 0 }
      };
      player.stamina = Math.max(0, player.stamina - Math.max(0.05, w.stam * 1.5));
      player.running = false;
    },

    resolveRunAttack(player, zombies, a) {
      const w = a.weapon;
      const targets = this.inFront(player, zombies, (w.cat === 'none' ? 1.1 : w.range + 0.35), 0.9, (z) => z.standing);
      if (!targets.length) { this.hitWindow(player); G.World.emit(player.pos.x, player.pos.z, WHIFF_NOISE * player.noiseMul, player.lv); return; }
      const { z } = targets[0];
      const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
      const behind = this.behind(player, z);
      let res;
      if (w.cat === 'none' && z.temb) { res = 'block'; this.blocked(z); if (G.Audio) G.Audio.play('hitPunch', { x: z.pos.x, z: z.pos.z, lv: z.lv, heavy: true }); }
      else if (w.cat === 'none') {
        // placaje: lo tira al suelo casi siempre
        z.react('heavy', 1, dx, dz); res = 'hit';         // placaje: lo echa atrás tambaleándose (ya no se caen)
        if (G.Audio) G.Audio.play('hitPunch', { x: z.pos.x, z: z.pos.z, lv: z.lv, heavy: true });
      } else {
        // ataque en carrera: el arma baja desde arriba con todo el impulso, a la cabeza: mata de un golpe
        // al temblante solo le hace algo con un arma grande (de dos manos): lo aturde y le quita un cuarto de vida
        const big = w.hands === 2 && w.cat !== 'gun' && w.cat !== 'none';
        res = z.blind ? z.takeHit(1.6, Math.max(0, w.knock + a.g.knock) + 0.5, dx, dz, behind, 1, 'heavy', 'body')
          : z.takeHit(99, Math.max(0, w.knock + a.g.knock) + 0.5, dx, dz, behind, 1, 'heavy', 'head', { w: 'runatk', big });
        if (z.blind && res === 'hit') this.blindAnswer(player, z);
        if (G.Audio) { const at = { x: z.pos.x, z: z.pos.z, lv: z.lv, heavy: true }; G.Audio.play(w.knife || BLADE[w.cat] ? 'hitBlade' : 'hitBlunt', at); if (res !== 'block') G.Audio.play('gore', at); }
        if (z.temb && res === 'hit') { z.stun(1.9, dx, dz, 2.6); this.msg('¡Aturdido! Otra embestida así', 'good'); }
        if (res === 'block') this.blocked(z, true);
        if (res === 'kill') z.killedBy = 'melee';
        if (this.onHit) this.onHit(res, true);
        this.hitStop = 0.11;
        this.wear(player, w);
      }
      if (G.Camera.hitFx) G.Camera.hitFx(1, 1);
      else if (G.Camera.shake) G.Camera.shake(0.24);
      G.World.emit(player.pos.x, player.pos.z, 6 * player.noiseMul, player.lv);
    },

    // Al chaskeado le pegaste: sabe dónde estás y se recupera enseguida para contestar con su zarpazo
    // (con un arma larga el golpe lo frena bastante más: así se le puede ganar peleando)
    blindAnswer(player, z, long) {
      if (!z.alive) return;
      z.target = { x: player.pos.x, z: player.pos.z, lv: player.lv || 0 }; z.lastSeen = 0; z.homebound = false;
      const k = long ? 0.75 : 0.45;
      if (z.state === 'stagger') { z.timer *= k; z.reactDur = (z.reactDur || 0.55) * k; z.kb.x *= long ? 0.8 : 0.5; z.kb.z *= long ? 0.8 : 0.5; }
    },

    // ¿Arma cuerpo a cuerpo larga? (bates, hachas grandes, palas, lanzas, katanas, palancas...)
    // distancia (centro a centro) a la que un golpe con esta arma llega al cuerpo con el brazo casi estirado
    // momento del impacto de cada golpe (cuando el arma pasa por el cuerpo en su animación)
    impactFor(kind) { return IMPACT_K[kind] || IMPACT; },
    idealDist(w) { return !w || w.cat === 'none' ? 0.68 : U.clamp(0.5 + (w.len || 0.3) * 0.62, 0.62, 1.15); },
    // lo más lejos que llega de verdad (más allá, el golpe no toca: no hace daño)
    reachOf(w) { return !w || w.cat === 'none' ? 0.95 : 0.78 + (w.len || 0.3) * 0.85; },
    longMelee(w) { return !!w && !w.knife && w.cat !== 'none' && w.cat !== 'gun' && G.Weapons.isLong(w); },

    // Golpe con arma corta (o a puñetazos) que le entró a un chaskeado: cuenta para el corte del combo
    countCut(z) {
      const now = this.clock || 0;
      if (now - (z.cutT == null ? -99 : z.cutT) > CUT_WINDOW) z.cutN = 0;
      z.cutN = (z.cutN || 0) + 1; z.cutT = now;
      if (z.cutN >= CUT_HITS && !this.cutTip) { this.cutTip = true; this.msg('¡Cuidado! Con un arma corta, el chaskeado te corta el tercer golpe y te remata', 'warn'); }
    },
    // ¿Este golpe (con arma corta) es el tercero seguido a un chaskeado? Entonces te lo corta
    markCut(a, z, w) {
      if (!a || !z || !z.blind || !z.alive || !z.standing || z.state === 'stun' || z.state === 'grapple') return;
      if (this.longMelee(w)) return;
      if ((z.cutN || 0) < CUT_HITS || (this.clock || 0) - (z.cutT == null ? -99 : z.cutT) > CUT_WINDOW) return;
      a.cut = z;
    },
    // El chaskeado corta el combo: manotazo que te deja a su merced y se te echa encima
    blindCut(player, z, a) {
      if (a) { a.done = true; a.queued = false; a.cut = null; }
      player.action = null;
      z.cutN = 0; z.cutT = null;
      z.finalKill = true;
      z.facing = Math.atan2(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
      z.kb.x = 0; z.kb.z = 0;
      this.blindSlam(z, player);
      this.msg('¡Te cortó el combo de un manotazo!', 'bad');
    },
    // Zarpazo salvaje del chaskeado: te deja a su merced y enseguida se te echa encima para rematarte
    // Un infectado te ha pegado o agarrado: el ruido y los gritos atraen a los de alrededor
    hitAlert(z, player) {
      if (!z || !z.alertNearby) return;
      const now = this.clock || 0;
      if (now - (z.hitAlertT == null ? -99 : z.hitAlertT) < 1.5) return;
      z.hitAlertT = now;
      z.alertNearby(player, HIT_ALERT_R);
    },

    blindSlam(z, player) {
      z.enter('bslam', 0.45); z.slamT = 0;
      this.hitAlert(z, player);
      player.damage(14, 'Un chaskeado te despedazó.');
      if (!player.dead) player.takePunch(z, 'heavy', 0, 1.4);
      if (G.Camera.hurtFx) G.Camera.hurtFx(1.3, 0);
      if (G.Camera.wobble) G.Camera.wobble(0.45);
      if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(player.pos.x, player.y + 1.45, player.pos.z), new THREE.Vector3(player.pos.x - z.pos.x, 0.4, player.pos.z - z.pos.z).normalize(), true, 10);
      if (G.Audio) G.Audio.play('hitBlade', { heavy: true });
      if (this.stats) this.stats.hurt += 14;
    },

    // Golpe que no le hace nada (temblante): lo avisa de vez en cuando
    blocked(z, run) {
      if (!z || !z.temb) return;
      const now = this.clock || 0;
      if (now - (this.blockMsgT || -99) < 5) return;
      this.blockMsgT = now;
      this.msg(run ? 'Con un arma pequeña no le hace nada: hace falta un arma grande' : 'A puñetazos no le haces nada: usa un arma (o embístelo corriendo con una grande)', 'warn');
    },
    // Daño de un golpe normal cuerpo a cuerpo al temblante (vida 100): muy poco. Con un bate hacen falta
    // unos 35 golpes, con un hacha de bombero una docena y con la navaja más de 70, y no lo frena nada
    tembMelee(w, a, crit) {
      const base = (w.dmg[0] + w.dmg[1]) * 0.5 * G.Weapons.matMul(w) * (this.longMelee(w) ? 2.6 : 1.6);
      return base * (a.heavy ? 1.3 : 1) * (crit ? 1.4 : 1);
    },
    // Le entró un golpe al temblante: lo recuerda de vez en cuando (apenas le haces nada)
    tembScratch(z) {
      const now = this.clock || 0;
      if (now - (this.blockMsgT || -99) < 7) return;
      this.blockMsgT = now;
      this.msg('A golpes apenas le haces daño: embístelo corriendo con un arma grande (o dispárale)', 'warn');
    },

    // El temblante te arrolla en plena embestida: mucho daño y te lanza lejos
    tembTackle(z, player) {
      if (player.dead || player.climb) return;
      const T = G.Zombie.TEMB;
      const dx = player.pos.x - z.pos.x, dz = player.pos.z - z.pos.z;
      const side = (dx * Math.cos(z.facing) - dz * Math.sin(z.facing)) > 0 ? -1 : 1;
      if (player.struggle) player.struggle = null;
      this.hitAlert(z, player);
      player.damage(T.tackleDmg, 'Te arrolló un temblante.');
      if (!player.dead) player.takePunch(z, 'heavy', side, T.tacklePush);
      if (G.Camera.hurtFx) G.Camera.hurtFx(1.6, side);
      if (G.Camera.wobble) G.Camera.wobble(0.8);
      if (this.stats) this.stats.hurt += T.tackleDmg;
      if (G.Audio) { G.Audio.play('hitPunch', { heavy: true }); G.Audio.play('tackle'); }
      if (G.Mode && G.Mode.bark) G.Mode.bark('hurt');
    },

    // Culatazo con un arma de fuego (atacar sin apuntar)
    startBash(player, zombies, camYaw) {
      const face = this.aimYaw(player, zombies, camYaw);
      player.action = { kind: 'bash', t: 0, dur: 0.62, face, done: false, weapon: player.weapon };
      player.stamina = Math.max(0, player.stamina - player.weapon.stam);
    },

    resolveBash(player, zombies) {
      const w = player.weapon;
      const targets = this.inFront(player, zombies, 1.15, 0.9, (z) => z.standing);
      if (!targets.length) { this.hitWindow(player); G.World.emit(player.pos.x, player.pos.z, WHIFF_NOISE * 0.85 * player.noiseMul, player.lv); return; }
      const { z } = targets[0];
      const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
      const behind = this.behind(player, z);
      const res = z.takeHit(U.lerp(w.bash[0], w.bash[1], Math.random()), 0.35 + (behind ? 0.2 : 0), dx, dz, behind, 1, 'push');
      if (res === 'block') this.blocked(z);
      if (G.Audio) G.Audio.play('hitBlunt', { x: z.pos.x, z: z.pos.z, lv: z.lv });
      if (this.onHit) this.onHit(res, false);
      if (G.Camera.hitFx) G.Camera.hitFx(0.55, 1);
      else if (G.Camera.shake) G.Camera.shake(0.12);
      G.World.emit(player.pos.x, player.pos.z, 3 * player.noiseMul, player.lv);
    },

    startAttack(player, zombies, camYaw, combo) {
      combo = combo || 0;
      // con un arma de fuego en la mano (sin apuntar) pelea con la navaja, como siempre
      const gunIn = G.Weapons.isGun(player.weapon);
      // con un arma de fuego en la mano golpea con el cuerpo a cuerpo que lleves colgado (o la navaja)
      const w = gunIn ? player.meleeWeapon : player.weapon;
      const mt = this.meleeTarget(player, zombies, this.camYaw != null ? this.camYaw : camYaw, this.input);
      const face = mt ? mt.yaw : this.aimYaw(player, zombies, camYaw);
      player.facing = U.turnToward(player.facing, face, 1.2);
      const tired = player.stamina < 0.25;
      // ¿hay alguien de pie delante? si no, y hay uno caído, golpe al suelo
      const tmp = { pos: player.pos, facing: face };
      const standing = this.inFront(tmp, zombies, w.range + 0.3, 0.9, (z) => z.standing);
      // para el remate basta con estar cerca: el personaje se acerca solo
      const down = this.inFront(tmp, zombies, w.range + 1.0, 1.0, (z) => z.downed);
      const floor = !standing.length && down.length > 0;
      const two = w.knife ? false : (gunIn ? player.meleeTwo : player.twoHanded);
      const g = G.Weapons.grip(w, two);
      if (floor) {
        // remate: te arrodillas junto al torso del zombi caído (con cámara de cine)
        const z = down[0].z;
        if (z.state === 'down') z.timer = Math.max(z.timer, 1.6);   // que no se levante a mitad del remate
        const d = z.fallDir || -1;
        // eje del cuerpo tumbado (de los pies a la cabeza) y un lado del torso
        const ax = Math.sin(z.facing) * d, az = Math.cos(z.facing) * d;
        const tx = z.pos.x + ax * 1.0, tz = z.pos.z + az * 1.0;            // torso
        const hx = z.pos.x + ax * 1.4, hz = z.pos.z + az * 1.4;            // pecho y cabeza
        const side = ((player.pos.x - tx) * az - (player.pos.z - tz) * ax) >= 0 ? 1 : -1;
        const gx = tx + az * 0.72 * side, gz = tz - ax * 0.72 * side;
        const free = !G.World.circleBlocked(gx, gz, 0.28, player.lv) && G.World.hasLOS(player.pos.x, player.pos.z, gx, gz, player.lv);
        const goto = free ? { x: gx, z: gz } : null;
        const fx = goto ? gx : player.pos.x, fz = goto ? gz : player.pos.z;
        player.action = {
          kind: 'finisher', t: 0, dur: Math.max(1.15, w.speed * 1.35), impact: 0.54,
          face: Math.atan2(hx - fx, hz - fz), goto, floor: true, target: z,
          done: false, weapon: w, two, g, knifeSwap: gunIn
        };
        player.stamina = Math.max(0, player.stamina - w.stam);
        return;
      }
      const chain = this.comboFor(w, two);
      const heavy = combo === 2;
      const durMul = combo === 1 ? 0.9 : (heavy ? 1.15 : 1);
      // paso adelante hacia el objetivo si está un poco lejos
      // se acerca hasta la distancia a la que el arma llega de verdad al cuerpo (no se queda golpeando al aire)
      let step = null;
      if (mt) {
        const want = mt.d - this.idealDist(w);
        if (want > 0.04) step = { len: Math.min(1.25, want), done: 0 };
      }
      player.action = {
        kind: chain[combo], t: 0, dur: w.speed * g.speed * ANIM * durMul * (tired ? 1.35 : 1), impact: IMPACT_K[chain[combo]] || IMPACT,
        face, floor, done: false, weapon: w, two, g, combo, heavy, step, knifeSwap: gunIn,
        side: (combo === 1) ? -1 : 1, target: mt ? mt.z : null,
        // si el golpe entra se decide al empezar: así la animación va al cuerpo o pasa de largo según lo que pase
        willHit: Math.random() <= ({ sblade: 0.92, sblunt: 0.88, lblunt: 0.85, axe: 0.85, lblade: 0.88, spear: 0.88 }[w.cat] || 0.85) + g.acc - (tired ? 0.15 : 0) - (player.moveAmt > 0.3 ? 0.08 : 0)
      };
      if (mt) this.markCut(player.action, mt.z, w);
      player.stamina = Math.max(0, player.stamina - w.stam * (heavy ? 1.3 : 1));
    },

    // Esquiva rápida hacia donde empujes (o hacia atrás), con unos instantes de invulnerabilidad
    startDodge(player, input, camYaw) {
      // Booster y la señora Paula no esquivan (aviso, como mucho cada 4 s)
      if (player.perks && player.perks.noDodge) {
        const now = this.clock || 0;
        if (now - (this.noDodgeT || -99) > 4) { this.noDodgeT = now; this.msg(player.charName + ' no puede esquivar', 'warn'); }
        return false;
      }
      if (player.dead || player.climb || player.prone || player.dodging) return;
      if (player.action && (player.action.kind === 'finisher' || player.action.kind === 'grab' || player.action.t < 0.5)) return;
      if (player.blow && player.blow.t < 0.35) return;
      if (player.stamina < 0.08) return;
      let mx = input.move.x, my = input.move.y;
      if (Math.hypot(mx, my) < 0.2) { mx = 0; my = 1; }        // sin dirección: hacia atrás
      const f = { x: Math.sin(camYaw), z: Math.cos(camYaw) }, r = { x: -Math.cos(camYaw), z: Math.sin(camYaw) };
      let dx = f.x * -my + r.x * mx, dz = f.z * -my + r.z * mx;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      player.action = null;
      if (player.healing) player.stopHeal();
      const pk = player.perks || {};
      player.dodging = { t: 0, dur: 0.45 / (pk.dodgeSpeed || 1), dx, dz, rel: U.angleDiff(Math.atan2(dx, dz), player.facing) };
      player.stamina = Math.max(0, player.stamina - ((pk.dodge || 1) > 1 ? 0.07 : 0.1));
      if (player.stance !== 'stand') player.stance = 'stand';
    },

    startShove(player, zombies, camYaw) {
      const face = this.aimYaw(player, zombies, camYaw);
      const tmp = { pos: player.pos, facing: face };
      const standing = this.inFront(tmp, zombies, 1.0, 0.9, (z) => z.standing);
      const down = this.inFront(tmp, zombies, 1.4, 1.0, (z) => z.downed);
      const stomp = !standing.length && down.length > 0;
      player.action = { kind: stomp ? 'stomp' : 'shove', t: 0, dur: stomp ? 0.68 : 0.5, face, done: false };
      player.stamina = Math.max(0, player.stamina - (stomp ? 0.04 : 0.035));
    },

    // Puñetazos: con las manos libres, atacar lanza el combo (empujar sigue en su botón).
    // Si delante solo hay un zombi caído, el primer golpe es un pisotón.
    startPunch(player, zombies, camYaw, combo) {
      combo = combo || 0;
      const mt = this.meleeTarget(player, zombies, this.camYaw != null ? this.camYaw : camYaw, this.input);
      const face = mt ? mt.yaw : this.aimYaw(player, zombies, camYaw);
      const tmp = { pos: player.pos, facing: face };
      const standing = mt ? [mt] : this.inFront(tmp, zombies, 1.25, 0.9, (z) => z.standing);
      const down = this.inFront(tmp, zombies, 1.4, 1.0, (z) => z.downed);
      if (!standing.length && down.length) { this.startShove(player, zombies, camYaw); return; }
      const P = PUNCH[combo];
      const tired = player.stamina < 0.25;
      if (player.stance === 'crouch') player.setStance('stand');      // se pega de pie
      // paso hacia el objetivo (se lanza hacia él si está a un par de metros)
      let step = null;
      if (mt) {
        const want = mt.d - this.idealDist(null);
        if (want > 0.04) step = { len: Math.min(1.25, want), done: 0 };
      }
      player.facing = U.turnToward(player.facing, face, 1.2);
      // (Booster: con el arma de fuego en la mano, la baja y pega con el puño; sin ella, nada de navaja)
      const fists = !!(player.perks && player.perks.fists), gunIn = fists && G.Weapons.isGun(player.weapon);
      if (gunIn) { player.gun.reload = null; player.gun.cycle = null; player.gun.aim = 0; }
      player.action = {
        willHit: Math.random() <= 0.93 - (tired ? 0.12 : 0),
        kind: P.kind, t: 0, dur: P.dur * (tired ? 1.25 : 1), impact: P.impact, face, done: false,
        weapon: fists ? G.Weapons.FISTS : player.weapon, combo, heavy: combo === 2, step, side: P.side, punch: P, two: false, target: mt ? mt.z : null,
        knifeSwap: gunIn
      };
      if (mt) this.markCut(player.action, mt.z, player.weapon);
      player.stamina = Math.max(0, player.stamina - (combo === 2 ? 0.05 : 0.03));
    },

    resolvePunch(player, zombies, a) {
      const P = a.punch;
      const targets = this.inFront(player, zombies, 1.2, 0.85, (z) => z.standing || z.state === 'rise');
      this.preferTarget(targets, a.target);
      if (!targets.length) {
        if (this.hitWindow(player) && G.Camera.hitFx) G.Camera.hitFx(0.5, P.side);
        G.World.emit(player.pos.x, player.pos.z, WHIFF_NOISE * 0.8 * player.noiseMul, player.lv);
        return;
      }
      const { z } = targets[0];
      const tired = player.stamina < 0.25;
      if (a.willHit === false || targets[0].d > this.reachOf(null)) { G.World.emit(player.pos.x, player.pos.z, 1.5 * player.noiseMul, player.lv); return; }
      const behind = this.behind(player, z);
      const counter = z.exposed && z.state === 'recover';
      let dmg = U.lerp(P.dmg[0], P.dmg[1], Math.random()) * (tired ? 0.75 : 1) * (counter ? 1.3 : 1) * PUNCH_MUL * (z.blind ? BLIND_MELEE : 1) * (player.perks ? player.perks.melee : 1);
      // Booster: puños de veterano (pegan más que la navaja y tumban/aturden más a menudo)
      const boxer = !!(player.perks && player.perks.fists);
      if (boxer) dmg *= 1.6;
      const crit = Math.random() < (a.heavy ? 0.15 : 0.06) * (boxer ? 1.8 : 1);
      if (crit) dmg *= 1.8;
      const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
      const hr = HIT_REACT[a.kind] || ['side', 1];
      const res = z.takeHit(dmg, (P.knock + (crit ? 0.2 : 0) + (counter ? 0.25 : 0)) * (boxer ? 1.5 : 1), dx, dz, behind, hr[1], hr[0]);
      if (res === 'block') this.blocked(z);
      if (G.Audio) G.Audio.play('hitPunch', { x: z.pos.x, z: z.pos.z, lv: z.lv, heavy: !!(a.heavy || crit) });
      if (res === 'hit' && z.blind) { this.blindAnswer(player, z); this.countCut(z); }
      if (res === 'hit') this.steer(player, z);
      if (this.onHit) this.onHit(res, crit);
      this.hitStop = a.heavy ? 0.12 : 0.06;
      if (G.Camera.hitFx) G.Camera.hitFx(a.heavy ? 1 : 0.55, P.side);
      else if (G.Camera.shake) G.Camera.shake(a.heavy ? 0.22 : 0.12);
      G.World.emit(player.pos.x, player.pos.z, 3.5 * player.noiseMul, player.lv);
    },

    // ---------- Resolución ----------
    update(dt, player, zombies) {
      this.clock = (this.clock || 0) + dt;
      this.updateStruggle(dt, player);
      const a = player.action;
      if (a) {
        // (Di' Arco: golpea más rápido)
        a.t += dt / (a.dur * (MELEE_ACT[a.kind] && player.perks ? player.perks.swing : 1));
        // tercer golpe seguido con arma corta a un chaskeado: en cuanto arrancas, te lo corta
        if (a.cut && !a.done && a.t * a.dur >= 0.1) {
          const cz = a.cut; a.cut = null;
          if (cz.alive && cz.standing && cz.state !== 'stun' && !player.struggle && Math.hypot(cz.pos.x - player.pos.x, cz.pos.z - player.pos.z) < 2.6) { this.blindCut(player, cz, a); return; }
        }
        if (a.exec) this.updateExecution(dt, player, a);
        // silbido del golpe justo antes del impacto
        if (!a.wh && !a.done && !a.exec && SWISH[a.kind] !== false && (a.punch || a.weapon || SWISH[a.kind]) && a.t >= (a.impact || IMPACT) - 0.14 / Math.max(0.2, a.dur)) {
          a.wh = true;
          const ww = a.punch ? 0.3 : (a.weapon && a.weapon.knife ? 0.15 : (a.weapon && (a.weapon.cat === 'lblunt' || a.weapon.cat === 'axe') ? 0.95 : 0.6));
          if (G.Audio) G.Audio.play('whoosh', { w: a.heavy ? Math.min(1, ww + 0.2) : ww });
        }
        if (!a.done && a.t >= (a.impact || IMPACT)) {
          a.done = true;
          if (a.kind === 'shove') this.resolveShove(player, zombies);
          else if (a.kind === 'stomp') this.resolveStomp(player, zombies);
          else if (a.kind === 'bash') this.resolveBash(player, zombies);
          else if (a.kind === 'runatk' || a.kind === 'runshove') this.resolveRunAttack(player, zombies, a);
          else if (a.kind === 'grab') this.resolveGrab(player, a);
          else if (a.kind === 'search') { const m = G.Interact.finishSearch(player, a.target); if (m) this.msg(m, 'good'); }
          else if (a.kind === 'bandage') { const m = player.finishBandage(a.item); if (m) this.msg(m, 'good'); }
          else if (a.kind === 'pack') { /* mochila abierta: no termina sola */ }
          else if (a.exec) this.resolveExecution(player, a);
          else if (a.kind === 'shoveoff') { /* nada que resolver */ }
          else if (a.kind === 'pickup' || a.kind === 'pickupHi') { if (G.Pickups) G.Pickups.collect(player, a); }
          else if (a.kind === 'throw') { if (G.Pickups) G.Pickups.release(player, a); }
          else if (a.kind === 'plant') { if (G.Pickups) { G.Pickups.placeMine(player); if (!this.mineTip) { this.mineTip = true; this.msg('Mina colocada: estalla cuando la pise un infectado (tú puedes pasar y recogerla)'); } } }
          else if (a.punch) this.resolvePunch(player, zombies, a);
          else this.resolveSwing(player, zombies, a);
        }
        // el siguiente golpe del combo sale al final de este (cortando la recuperación)
        if (a.queued && a.t >= (a.punch ? a.punch.next : 0.72) && COMBO_KINDS[a.kind]) {
          const next = ((a.combo || 0) + 1) % 3;
          player.action = null;
          // si el golpe anterior lo dejó aturdido, el siguiente es el remate
          const ez = this.execTarget(player, zombies);
          if (ez) this.startExecution(player, ez);
          else if (a.punch) this.startPunch(player, zombies, a.face, next);
          else this.startAttack(player, zombies, a.face, next);
        } else if (a.t >= 1) player.action = null;
        // si el agarre se corta (te muerden, mueres...), el zombi se suelta
        if (a.kind === 'grab' && player.action !== a && !a.done && a.target.state === 'grabbed') a.target.release();
      }

      // Agarrado por varios a la vez: te derriban
      if (!player.dead) {
        let n = 0;
        for (const z of zombies) {
          if ((z.state === 'attack' || z.state === 'recover' || z.state === 'combo') && Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) < 1.15) n++;
        }
        if (n >= 4) this.dragT += dt; else this.dragT = Math.max(0, this.dragT - dt * 2);
        if (this.dragT > 2.2) player.die('Te rodearon y te derribaron.');
      } else this.dragT = 0;
    },

    resolveGrab(player, a) {
      const z = a.target;
      if (!z || !z.alive || z.state !== 'grabbed') return;
      z.die(1);                                     // cae boca abajo, hacia delante
      z.killedBy = 'stealth';
      if (G.Audio) G.Audio.play('hitBlade', { x: z.pos.x, z: z.pos.z, lv: z.lv, vol: 0.7 });
      if (this.stats) this.stats.stealth++;
      if (this.onHit) this.onHit('kill', true);
      G.World.emit(player.pos.x, player.pos.z, (a.knife ? 1.5 : 2.5) * player.noiseMul, player.lv);
      if (G.Mode && G.Mode.bark) G.Mode.bark('stealth');
    },

    // el zombi elegido al empezar el golpe va primero (si sigue al alcance)
    preferTarget(list, z) {
      if (!z) return;
      const i = list.findIndex((t) => t.z === z);
      if (i > 0) list.unshift(list.splice(i, 1)[0]);
    },

    behind(player, z) {
      // el jugador está detrás del zombi si el zombi mira hacia el otro lado
      const toPlayer = Math.atan2(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
      return Math.abs(U.angleDiff(toPlayer, z.facing)) > 2.0;
    },

    resolveSwing(player, zombies, a) {
      const w = a.weapon;
      const tired = player.stamina < 0.25;
      const targets = a.kind === 'finisher'
        ? (a.target && a.target.alive && a.target.downed ? [{ z: a.target, d: 1, a: 0 }] : [])
        : a.floor
        ? this.inFront(player, zombies, w.range + 0.35, 1.0, (z) => z.downed)
        : this.inFront(player, zombies, w.range + 0.25, a.two ? 1.05 : 0.8, (z) => z.standing || z.state === 'rise');
      if (!a.floor && a.kind !== 'finisher') this.preferTarget(targets, a.target);
      if (!targets.length) {
        if (!a.floor && a.kind !== 'finisher' && this.hitWindow(player)) this.wear(player, w);
        G.World.emit(player.pos.x, player.pos.z, WHIFF_NOISE * player.noiseMul, player.lv);
        return;
      }
      const base = { sblade: 0.92, sblunt: 0.88, lblunt: 0.85, axe: 0.85, lblade: 0.88, spear: 0.88 }[w.cat] || 0.85;
      let landed = 0, sz = null;
      const long = this.longMelee(w);
      // un arma de dos manos usada con una sola solo alcanza a un zombi
      const n = a.floor ? 1 : Math.min(a.two ? w.hits : 1, targets.length);
      for (let i = 0; i < n; i++) {
        const { z } = targets[i];
        let chance = base + a.g.acc - (tired ? 0.15 : 0) - (player.moveAmt > 0.3 ? 0.08 : 0) - i * 0.1;
        if (a.floor) chance += 0.08;
        if (a.kind === 'finisher') chance = 0.97;
        // el primero: lo que se decidió al empezar (la animación ya fue al cuerpo o pasó de largo) y que de verdad
        // esté al alcance del arma
        if (i === 0 && !a.floor && a.kind !== 'finisher' && a.willHit != null) {
          if (!a.willHit || targets[i].d > this.reachOf(w)) continue;
        } else if (Math.random() > chance) continue;
        landed++;
        if (!sz) sz = z;
        const behind = this.behind(player, z);
        // contraataque: el zombi que falló al esquivarlo está vendido
        const counter = z.exposed && z.state === 'recover';
        let dmg = U.lerp(w.dmg[0], w.dmg[1], Math.random()) * a.g.dmg * G.Weapons.matMul(w) * (i > 0 ? 0.6 : 1) * (tired ? 0.75 : 1) * (a.heavy ? 1.3 : 1) * (counter ? 1.2 : 1) * MELEE_MUL * (z.blind ? (long ? BLIND_MELEE_LONG : BLIND_MELEE) : 1) * (player.perks ? player.perks.melee : 1);
        let crit = Math.random() < w.crit[0] + (behind ? 0.1 : 0);
        if (crit) dmg *= Math.min(1.5, w.crit[1]);
        if (a.floor) dmg *= a.kind === 'finisher' ? 6 : 3;     // en el suelo va a la cabeza
        // los cuchillos rematan en el suelo
        if (w.cat === 'sblade' && a.floor && Math.random() < 0.5) { dmg = 99; crit = true; }
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        const hr = HIT_REACT[a.kind] || ['side', a.side || 1, 'body'];
        // golpe de pie que lo dejaría muerto: con la navaja, el tercero del combo se convierte en el remate;
        // los demás lo dejan aturdido, tambaleándose (Atacar otra vez lo remata)
        if (!a.floor && a.kind !== 'finisher' && i === 0 && z.standing && !z.temb && dmg >= z.hp - 1e-6 && !(a.heavy && !w.knife)) {
          // con una pared o una mesa cerca no hace el remate del combo: lo aturde y lo lleva hacia ella
          if (a.heavy && !this.findSpot(z, STEER_R, dx / (Math.hypot(dx, dz) || 1), dz / (Math.hypot(dx, dz) || 1), -0.2)) {
            this.startExecution(player, z, 'combo');
            this.hitStop = 0.08;
            if (G.Camera.hitFx) G.Camera.hitFx(0.8, 1);
            G.World.emit(player.pos.x, player.pos.z, 4 * player.noiseMul, player.lv);
            return;
          }
          z.hp = 0.05; z.flinch = hr[1];
          z.stun(z.blind ? 1.5 : 2.1, dx, dz, 1.9);
          this.steer(player, z);
          if (this.stats) this.stats.stun++;
          if (this.onHit) this.onHit('hit', crit);
          landed++;
          continue;
        }
        // en pie, cuerpo a cuerpo: siempre al cuerpo (la cabeza solo en el suelo y en los remates)
        const part = a.kind === 'finisher' || a.floor ? 'head' : 'body';
        // con la navaja (como en el vídeo) el infectado acusa el tajo pero no sale despedido: se queda a tiro
        const kn = w.knife ? 0 : Math.max(0, w.knock + a.g.knock) + (crit ? 0.25 : 0) + (a.heavy ? 0.2 : 0) + (counter ? 0.25 : 0);
        // temblante: a golpes apenas le haces nada (no lo frena: solo se sacude). Ver tembMelee
        const tsrc = z.temb ? { w: 'melee', d: this.tembMelee(w, a, crit) } : undefined;
        const res = z.takeHit(dmg, kn, dx, dz, behind, hr[1], hr[0], i === 0 ? part : 'body', tsrc);
        if (res === 'block') this.blocked(z);
        else if (z.temb && res === 'hit') this.tembScratch(z);
        if (res === 'hit' && z.blind) { this.blindAnswer(player, z, long); if (!long) this.countCut(z); }
        if (w.knife && res === 'hit') { z.kb.x *= 0.45; z.kb.z *= 0.45; }
        if (res === 'hit') this.steer(player, z);
        if (this.onHit) this.onHit(res, crit);
      }
      if (landed && sz && G.Audio) {
        const at = { x: sz.pos.x, z: sz.pos.z, lv: sz.lv, heavy: !!(a.heavy || a.kind === 'finisher' || a.floor) };
        G.Audio.play(w.knife || BLADE[w.cat] ? 'hitBlade' : 'hitBlunt', at);
        if (a.kind === 'finisher' || (a.floor && !sz.alive)) G.Audio.play('gore', at);
      }
      if (landed) {
        // parón breve y sacudida de cámara: el golpe se siente
        this.hitStop = a.heavy || a.kind === 'finisher' ? 0.11 : 0.065;
        if (G.Camera.hitFx) G.Camera.hitFx(a.heavy || a.kind === 'finisher' ? 1 : 0.6, a.kind === 'swing2b' || a.kind === 'slash' || a.kind === 'swing1b' ? -1 : 1);
        else if (G.Camera.shake) G.Camera.shake(a.heavy || a.kind === 'finisher' ? 0.22 : 0.12);
        G.World.emit(player.pos.x, player.pos.z, 6 * player.noiseMul, player.lv);
        this.wear(player, w);
      } else G.World.emit(player.pos.x, player.pos.z, 2.5 * player.noiseMul, player.lv);
    },

    wear(player, w) {
      // el arma que se gasta: la de la mano o, si golpeaste con el cuerpo a cuerpo colgado, esa
      const cs = player.slot, ms = player.hands[0];
      const slot = cs && G.Weapons.get(cs.id) === w ? cs : (ms && G.Weapons.get(ms.id) === w ? ms : null);
      if (!slot) return;
      if (Math.random() < 1 / w.lower) {
        slot.cond -= 1 / (w.cond * G.Weapons.DURABILITY);
        if (slot.cond <= 0.001) {
          this.msg('Se rompió: ' + w.name + (slot === ms ? ' (vuelves a la navaja)' : ''), 'bad');
          if (slot === ms) player.breakMelee(); else player.breakCurrent();
        }
      }
    },

    // Golpe al aire delante de una ventana: si está cerrada se rompe; si está rota, quita los vidrios
    hitWindow(player) {
      const W = G.World, E = W.E;
      const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
      const x0 = player.pos.x, z0 = player.pos.z, x1 = x0 + fx * 0.85, z1 = z0 + fz * 0.85;
      const f = W.lineHit(x0, z0, x1, z1, (e) => e === E.WIN || e === E.WIN_BROKEN, player.lv);
      if (f < 0) return false;
      const ref = W.edgeAt(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, fx, fz, player.lv);
      if (!ref) return false;
      const e = W.edgeGet(ref);
      if (e === E.WIN) { W.shatter(ref); this.msg('Rompiste la ventana (hay vidrios en el marco)', 'warn'); if (G.Camera.shake) G.Camera.shake(0.1); return true; }
      if (e === E.WIN_BROKEN && W.hasGlass(ref)) {
        W.clearGlass(ref);
        W.emit(player.pos.x, player.pos.z, 4 * player.noiseMul, player.lv);
        this.msg('Quitaste los vidrios del marco');
        return true;
      }
      return false;
    },

    resolveShove(player, zombies) {
      const targets = this.inFront(player, zombies, 1.05, 0.9, (z) => z.standing && !z.temb);
      if (!targets.length && this.hitWindow(player)) return;     // codazo al vidrio
      for (let i = 0; i < Math.min(2, targets.length); i++) {
        const { z } = targets[i];
        const behind = this.behind(player, z);
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        // tras un empujón tarda 2 segundos más en levantarse
        if (Math.random() < (behind ? 0.75 : 0.35)) z.knockDown(behind ? 1 : -1, dx, dz, 2);
        else z.doStagger(dx, dz, 2.6);
        if (G.Audio && i === 0) G.Audio.play('hitPunch', { x: z.pos.x, z: z.pos.z, lv: z.lv, vol: 0.7 });
        if (this.onHit) this.onHit('shove', false);
      }
      if (targets.length && G.Camera.hitFx) G.Camera.hitFx(0.4, 1);
      G.World.emit(player.pos.x, player.pos.z, 2 * player.noiseMul, player.lv);
    },

    resolveStomp(player, zombies) {
      const targets = this.inFront(player, zombies, 1.4, 1.0, (z) => z.downed);
      if (!targets.length) return;
      const { z } = targets[0];
      let dmg = U.lerp(0.45, 0.95, Math.random());
      const crit = Math.random() < 0.18;
      if (crit) dmg *= 3;
      const res = z.takeHit(dmg, 0, 0, 0, false);
      if (G.Audio) G.Audio.play('stomp', { x: z.pos.x, z: z.pos.z, lv: z.lv });
      if (this.onHit) this.onHit(res, crit);
      if (G.Camera.hitFx) G.Camera.hitFx(0.6, 1);
      G.World.emit(player.pos.x, player.pos.z, 3 * player.noiseMul, player.lv);
    },

    // Un zombi termina su intento de agarrar al jugador
    zombieStrike(z, player, dist) {
      // intento de agarre (el ataque en el que se lanza con los brazos por delante)
      if (player.dead || player.bossKill) return false;
      // esquivado justo a tiempo: se pasa de largo y queda aturdido
      if ((player.dodging && player.dodging.t < 0.75) || (player.dodgeAfter > 0 && dist < 2.8)) { z.overextended = true; return false; }
      if (dist > (z.blind ? 1.5 : 1.38) || player.climb) return false;
      if (Math.abs((z.elev || 0) - (player.elev || 0)) > 1.2) return false;
      if ((z.lv || 0) !== (player.lv || 0) && !G.World.stairAt(player.pos.x, player.pos.z)) return false;
      if (!G.World.hasLOS(z.pos.x, z.pos.z, player.pos.x, player.pos.z, z.lv)) return false;
      // mientras otro te tiene agarrada o te está pegando, nadie más te agarra
      if (player.struggle || (player.beaten && player.beaten.z !== z)) return false;
      // chaskeado: zarpazo salvaje que te deja a su merced; enseguida se te echa encima y te remata
      if (z.blind) { this.blindSlam(z, player); return true; }
      const toZ = Math.atan2(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
      const behind = Math.abs(U.angleDiff(toZ, player.facing)) > 1.9;
      const chance = 0.5 + (behind ? 0.25 : 0) + (player.prone ? 0.2 : 0);
      if (Math.random() > chance) return false;
      const busy = player.action && player.action.exec;
      if (!busy && (player.grabCD || 0) <= 0) { this.startStruggle(player, z); return true; }
      return false;
    },

    // Puñetazos del infectado (combo de tres) y su golpe en carrera. step: 0 gancho de derecha, 1 gancho de
    // izquierda, 2 golpe fuerte, 'run' golpe en carrera. El primero y el último (y el de carrera) se pueden
    // esquivar; el segundo entra siempre si te entró el primero. Devuelve 'hit', 'dodge' o 'miss'
    zombiePunch(z, player, dist, step) {
      if (player.dead || player.struggle || player.climb || player.bossKill) return 'miss';
      if (player.beaten && player.beaten.z !== z) return 'miss';
      const run = step === 'run';
      // esquivado a tiempo (el primero, el último o el de carrera): se pasa de largo y queda vendido
      if (step !== 1 && dist < 2.8 && ((player.dodging && player.dodging.t < 0.75) || player.dodgeAfter > 0)) { z.overextended = true; if (G.Audio) G.Audio.play('whoosh', { w: 0.9, x: z.pos.x, z: z.pos.z, lv: z.lv }); return 'dodge'; }
      if (dist > (run ? 1.9 : (z.temb ? 2.15 : (z.blind ? 1.55 : 1.45)))) return 'miss';
      if ((z.lv || 0) !== (player.lv || 0) && !G.World.stairAt(player.pos.x, player.pos.z)) return 'miss';
      if (!G.World.hasLOS(z.pos.x, z.pos.z, player.pos.x, player.pos.z, z.lv)) return 'miss';
      if (step === 0) {
        const toZ = Math.atan2(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
        const behind = Math.abs(U.angleDiff(toZ, player.facing)) > 1.9;
        if (Math.random() > (behind ? 0.95 : 0.75)) return 'miss';
      }
      const P = PUNCH_TAKEN[step], TB = z.temb ? G.Zombie.TEMB : null;
      const dmg = P.dmg * (z.blind ? 1.8 : 1) * (TB ? TB.dmg : 1);
      this.hitAlert(z, player);
      player.damage(dmg, z.blind ? 'Un ciego te despedazó.' : (TB ? 'Un temblante te molió a golpes.' : 'Te mataron a golpes.'));
      const launch = TB && step === 1;
      if (!player.dead) player.takePunch(z, launch ? 'launch' : P.react, P.fl, launch ? TB.launch : P.push * (TB ? TB.push : 1));
      if (launch && G.Audio) G.Audio.play('tackle');
      if (G.Camera.hurtFx) G.Camera.hurtFx(P.cam * (TB ? 1.45 : 1), P.fl);
      if (TB && G.Camera.wobble) G.Camera.wobble(launch ? 0.75 : 0.35);
      if (this.stats) this.stats.hurt += dmg;
      if (step === 2 || run) { if (G.Mode && G.Mode.bark) G.Mode.bark('hurt'); }
      if (player.health <= 0 && !player.dead) player.die(z.blind ? 'Un ciego te despedazó.' : 'Te mataron a golpes.');
      return 'hit';
    },

    // ---------- Forcejeo: te agarran y tienes que pulsar atacar sin parar para soltarte ----------
    // kill: el remate del chaskeado (4 o 5 pulsaciones rápidas de Atacar te lo quitan de encima; si no, te mata)
    startStruggle(player, z, kill) {
      if (player.bossKill || player.dead) return;
      if (player.hostage && G.Humans) G.Humans.releaseHostage(player);
      player.action = null; player.dodging = null; player.blow = null; player.blowKb = null;
      if (player.gun) { player.gun.reload = null; }
      if (G.Input && G.Input.setAim) G.Input.setAim(false);
      // early: venías aporreando el botón (el que se adelanta no se libra; hay que pulsar en el momento)
      // final: el remate tras cortarte el combo
      const final = !!kill && !!z.finalKill; z.finalKill = false;
      const early = !!kill && (final || (this.clock || 0) - (this.atkPressT == null ? -9 : this.atkPressT) < 0.22);
      player.struggle = { z, t: 0, dur: kill ? 1.9 : (z.blind ? 1.7 : 2.1), need: kill ? 4 + (Math.random() < 0.5 ? 1 : 0) : (z.blind ? 9 : (z.nemi ? 8 : 5)), n: 0, prog: 0, kill: !!kill, b: 0, early, esc: false };
      player.facing = Math.atan2(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
      z.startGrapple(kill);
      this.hitAlert(z, player);
      if (G.Camera.shake) G.Camera.shake(kill ? 0.45 : 0.25);
      if (z.human) this.msg(G.Input.isTouch ? '¡Te agarran por la espalda! Toca Atacar sin parar' : '¡Te agarran por la espalda! Pulsa Atacar sin parar', 'bad');
      else if (kill) this.msg(G.Input.isTouch ? '¡Te atrapa! ¡Toca Atacar rápido!' : '¡Te atrapa! ¡Pulsa Atacar rápido!', 'bad');
      else this.msg(G.Input.isTouch ? '¡Te agarró! Toca Atacar sin parar' : '¡Te agarró! Pulsa Atacar sin parar', 'bad');
    },

    updateStruggle(dt, player) {
      if (player.beatCD > 0) player.beatCD -= dt;
      if (player.grabCD > 0) player.grabCD -= dt;
      const st = player.struggle;
      if (!st) return;
      player.grabCD = 6;           // al terminar el forcejeo, unos segundos sin que te vuelvan a agarrar
      st.t += dt;
      st.prog = Math.min(1, st.n / st.need);
      const z = st.z;
      if (!z.alive || player.dead || z.state !== 'grapple') { player.struggle = null; return; }
      if (st.kill && st.esc) {
        // ¡te libraste por poco! lo empujas: te ha costado vida y a él la mitad de la suya
        player.struggle = null;
        z.maul = false;
        z.hp = Math.max(0.05, z.hp * 0.5);
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        z.stun(1.6, dx, dz, 2.8);
        player.damage(KILL_ESCAPE_DMG, 'Un chaskeado te despedazó.');
        player.action = { kind: 'shoveoff', t: 0, dur: 0.45, impact: 0.35, face: Math.atan2(dx, dz), done: true };
        player.grabCD = 3;
        if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(player.pos.x, player.y + 1.45, player.pos.z), new THREE.Vector3(0, 0.5, 0), true, 8);
        if (G.Camera.hitFx) G.Camera.hitFx(0.8, 1);
        if (G.Audio) G.Audio.play('hitPunch', { heavy: true });
        if (this.stats) { this.stats.escapes++; this.stats.hurt += KILL_ESCAPE_DMG; }
        this.msg('¡Te libraste por poco! Remátalo', 'good');
        if (player.health <= 0 && !player.dead) player.die('Un chaskeado te despedazó.');
        return;
      }
      if (st.kill) {
        // cada mordisco: sangre, sacudida y un poco de vida, hasta el último
        const bites = Math.floor((st.t + 0.1) * 12 / (Math.PI * 2));
        if (bites > st.b) {
          st.b = bites;
          if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(player.pos.x, player.y + 1.5, player.pos.z), new THREE.Vector3(0, 0.5, 0), true, 9);
          if (G.Camera.shake) G.Camera.shake(0.3);
          if (G.Audio) G.Audio.play('gore', { vol: 0.8 });
          player.health = Math.max(1, player.health - 8); player.hurt = 0.4;
        }
        if (st.t >= st.dur) {
          player.struggle = null;
          z.maul = false; z.enter('recover', 1.2); z.reach = 0.4;
          if (G.Mode && G.Mode.bark) G.Mode.bark('hurt');
          player.damage(999, 'Un chaskeado te despedazó.');
          if (!player.dead) player.die('Un chaskeado te despedazó.');
        }
        return;
      }
      if (st.n >= st.need) {
        // ¡fuera! lo empuja y queda aturdido (listo para rematarlo)
        player.struggle = null;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
        z.stun(z.blind ? 1.4 : 1.9, dx, dz, 2.8);
        player.action = { kind: 'shoveoff', t: 0, dur: 0.45, impact: 0.35, face: Math.atan2(dx, dz), done: true };
        if (G.Camera.hitFx) G.Camera.hitFx(0.6, 1);
        if (this.stats) this.stats.escapes++;
        this.msg('¡Te soltaste! Remátalo', 'good');
        if (G.Mode && G.Mode.bark) G.Mode.bark('free');
      } else if (st.t >= st.dur) {
        // no te soltaste a tiempo: te muerde (un humano, te apuñala)
        player.struggle = null;
        const dmg = z.human ? 38 : (z.blind ? 62 : (z.nemi ? 45 : 30));
        const cause = z.human ? z.name + ' te apuñaló por la espalda.' : (z.blind ? 'Un ciego te atrapó.' : (z.nemi ? 'Un blindado te atrapó.' : 'Te mordieron.'));
        player.damage(dmg, cause);
        if (z.human && G.Audio) G.Audio.play('hitBlade', { x: player.pos.x, z: player.pos.z, lv: player.lv, heavy: true });
        if (G.Mode && G.Mode.bark) G.Mode.bark('hurt');
        if (player.takeBlow) player.takeBlow(z, 'mordisco');
        if (this.stats) this.stats.hurt += dmg;
        z.enter('recover', 0.9); z.reach = 0.6;
        if (G.Camera.shake) G.Camera.shake(0.55);
        this.msg(z.human ? '¡Te apuñaló!' : (z.blind ? '¡Te mordió un ciego!' : '¡Te mordió!'), 'bad');
        if (player.health <= 0 && !player.dead) player.die(cause);
      }
    },

    // ---------- Remates: un infectado aturdido muere de un golpe ----------
    // Infectado aturdido al alcance (corriendo se le alcanza desde más lejos: remate en carrera)
    // A quién se puede rematar: un aturdido, o uno que estás golpeando y ya está contra una pared o una mesa
    execTarget(player, zombies, range) {
      let best = null, bd = range || 1.95;
      for (const z of zombies) {
        if (!z.alive || z.temb || (z.lv || 0) !== (player.lv || 0)) continue;
        const d = Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z);
        if (z.state !== 'stun' && z.state !== 'beg') {          // (un humano rendido también se puede rematar)
          if (!z.standing || z.state === 'held' || z.state === 'grapple' || z.hitAt == null || (this.clock || 0) - z.hitAt > PIN_TIME) continue;
          if (d > Math.max(bd, 2.4) || !this.pinned(player, z)) continue;
          if (d < bd + 0.45 && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bd = d - 0.45; best = z; }
          continue;
        }
        if (d < bd && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bd = d; best = z; }
      }
      return best;
    },

    // Pared, valla, mueble alto o mesa más cercana al infectado (a menos de maxD), en las direcciones que no
    // apuntan hacia ella (ax, az: de ella al infectado; minDot: cuánto puede desviarse). Prefiere lo que queda
    // detrás del infectado visto desde ella
    findSpot(z, maxD, ax, az, minDot) {
      let best = null, bs = Infinity;
      for (let i = 0; i < 16; i++) {
        const an = i / 16 * Math.PI * 2, ux = Math.sin(an), uz = Math.cos(an);
        const dot = ux * ax + uz * az;
        if (dot < minDot) continue;
        const pb = this.probeBehind(z, ux, uz, maxD);
        let d = null, kind = 'wall';
        if (pb.table && (pb.wall == null || pb.table.d < pb.wall)) { d = pb.table.d; kind = 'table'; }
        else if (pb.wall != null) d = pb.wall;
        if (d == null) continue;
        const sc = d - dot * 0.6;
        if (sc < bs) { bs = sc; best = { ux, uz, d, kind }; }
      }
      return best;
    },

    // ¿Está contra algo que permite un remate? (se mira como mucho cada 0,2 s por infectado)
    pinned(player, z) {
      const now = this.clock || 0;
      if (z.pinAt != null && now - z.pinAt < 0.2) return z.pin;
      let ax = z.pos.x - player.pos.x, az = z.pos.z - player.pos.z;
      const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
      const sp = this.findSpot(z, PIN_D + 0.1, ax, az, -0.3);
      z.pin = sp && sp.d <= PIN_D ? sp : null; z.pinAt = now;
      return z.pin;
    },

    // Cada golpe lo lleva hacia la pared o la mesa más cercana; si ya está pegado, se estampa contra ella
    steer(player, z) {
      z.hitAt = this.clock || 0; z.pinAt = null;
      if (!z.alive || !z.standing || z.state === 'held' || z.state === 'grapple') return;
      let ax = z.pos.x - player.pos.x, az = z.pos.z - player.pos.z;
      const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
      const sp = this.findSpot(z, STEER_R, ax, az, -0.2);
      if (!sp) return;
      let vx = ax * 0.3 + sp.ux * 0.7, vz = az * 0.3 + sp.uz * 0.7;
      const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
      // la caída del empujón recorre unos v / 4,2 m; pegado a la pared basta para estamparlo
      const v = Math.max(Math.min(STEER_STEP, sp.d - 0.35) * 4.2, 1.8);
      z.kb.x = vx * v; z.kb.z = vz * v; z.wallHit = false;
    },

    // Qué hay detrás del infectado (visto desde ella) a menos de maxD: una pared o valla, o un mueble a la
    // altura de una mesa o un mostrador (0,55 a 1,15 m), o uno alto (cuenta como pared)
    probeBehind(z, ux, uz, maxD) {
      const W = G.World, E = W.E, lv = z.lv || 0;
      const f = W.lineHit(z.pos.x, z.pos.z, z.pos.x + ux * maxD, z.pos.z + uz * maxD, (e) => e !== E.NONE && e !== E.DOOR_OPEN && e !== E.DOOR_BROKEN && e !== E.ARCH, lv);
      let wall = f >= 0 ? f * maxD : null, table = null;
      const base = W.baseAt(z.pos.x, z.pos.z, lv) + (lv ? W.FLOOR_H : 0);
      for (let t = 0.2; t <= maxD; t += 0.08) {
        if (wall != null && t >= wall) break;
        const top = W.furnTop(z.pos.x + ux * t, z.pos.z + uz * t, lv, 0.03) - base;
        if (top > 1.15) { wall = t; break; }
        if (top > 0.55) { table = { d: t, top }; break; }
      }
      return { wall, table };
    },

    // Remates (cada uno sigue los tiempos del vídeo de referencia, con poses propias):
    //   execRun   llegas corriendo a un aturdido: tajo, lo sujetas de la muñeca y le apuñalas el vientre,
    //             lo agarras de la cabeza, puñaladas al cuello y lo tiras al suelo
    //   execWall  de espaldas a una pared o valla: lo clavas contra ella a puñaladas y se desliza hasta el suelo
    //   execTable con una mesa o un mostrador detrás: puñalada, lo empujas, lo estampas de espaldas sobre la
    //             mesa y le clavas la navaja en el cuello
    //   execShove en campo abierto: lo agarras del hombro, dos puñaladas y un empujón que lo tira de espaldas
    //             (si detrás hay una ventana, la atraviesa)
    //   execCombo el último golpe del combo cuando ya está muy tocado: lo agarras, lo doblas hacia atrás y le
    //             clavas la navaja en la cabeza dos veces desde arriba
    //   runKill   ataque en carrera con la navaja: lo ensartas al llegar, lo abres de lado y lo apartas (mata)
    //   execHeavy con otra arma cuerpo a cuerpo: un golpe brutal a la cabeza
    // dur (s), impact (muere), hits (sangre), gap (distancia entre los dos), lerp (cuándo están colocados),
    // die (cómo cae: -1 de espaldas, 1 boca abajo, 0 se queda en la pose final), push (empujón al morir),
    // turn [t, giro] (el infectado gira antes de caer)
    EX: {
      execRun: { dur: 2.7, impact: 0.84, hits: [0.093, 0.185, 0.245, 0.31, 0.37, 0.65, 0.71, 0.77], gap: 0.52, lerp: 0.12, die: 1, turn: [0.78, 1.2] },
      execWall: { dur: 1.5, impact: 0.6, hits: [0.21, 0.33, 0.45], gap: 0.55, lerp: 0.14, die: 0 },
      execTable: { dur: 2.3, impact: 0.66, hits: [0.06, 0.18, 0.43, 0.55, 0.65], gap: 0.58, lerp: 0.1, die: 0 },
      execShove: { dur: 1.45, impact: 0.66, hits: [0.24, 0.41], gap: 0.62, lerp: 0.14, die: -1, push: 3.4 },
      execCombo: { dur: 3.0, impact: 0.78, hits: [0.39, 0.64], gap: 0.55, lerp: 0.1, die: 1, turn: [0.7, -1.0] },
      runKill: { dur: 1.4, impact: 0.84, hits: [0.29, 0.62], gap: 0.62, lerp: 0.27, die: -1, push: 2.6 },
      execHeavy: { dur: 0.95, impact: 0.43, hits: [], gap: 0.92, lerp: 0.22, die: -1 }
    },

    startExecution(player, z, mode) {
      const W = G.World, gun = G.Weapons.isGun(player.weapon);
      // con pistola o rifle en la mano, remata con la navaja; con otra arma, también si hay una pared o una mesa
      // (los remates contra ellas son con la navaja); si no, golpe brutal con el arma
      let w = gun ? player.meleeWeapon : player.weapon, swap = gun;
      const px = player.pos.x, pz = player.pos.z;
      let dx = z.pos.x - px, dz = z.pos.z - pz;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      let kind = 'execHeavy', zx = z.pos.x, zz = z.pos.z, corpse = null;
      let pb = null;
      if (!mode || !w.knife) {
        pb = this.probeBehind(z, dx, dz, EXEC_REACH);
        // si no hay nada justo detrás, busca la pared o la mesa más cercana alrededor y lo remata contra ella
        // (ella se coloca enfrente)
        if (!pb.table && pb.wall == null) {
          const sp = this.findSpot(z, EXEC_REACH, dx, dz, -0.3);
          if (sp) { dx = sp.ux; dz = sp.uz; pb = this.probeBehind(z, dx, dz, EXEC_REACH); }
        }
        if (!w.knife && (pb.table || pb.wall != null) && mode !== 'runkill') { w = G.Weapons.KNIFE; swap = true; mode = null; }
      }
      if (w.knife) {
        if (mode === 'combo') kind = 'execCombo';
        else if (mode === 'run') kind = 'execRun';
        else if (mode === 'runkill') kind = 'runKill';
        else if (pb.table && (pb.wall == null || pb.table.d < pb.wall)) {
          // de espaldas al borde de la mesa
          kind = 'execTable'; corpse = 'execTable';
          const k = Math.max(-0.2, pb.table.d - 0.28); zx += dx * k; zz += dz * k;
        } else if (pb.wall != null) {
          kind = 'execWall'; corpse = 'execWall';
          const k = Math.max(-0.2, pb.wall - 0.36); zx += dx * k; zz += dz * k;
        } else kind = 'execShove';
      }
      const E = this.EX[kind];
      // (golpe brutal con un arma: a la distancia a la que la cabeza del arma cae sobre la cabeza, no las manos)
      const gap = kind === 'execHeavy' ? U.clamp(0.5 + (w.len || 0.5) * 0.62, 0.78, 1.15) : E.gap;
      const pTo = { x: zx - dx * gap, z: zz - dz * gap };
      // si lo lleva empujando hasta la pared o la mesa, la colocación dura algo más (a unos 4 m/s), sin pasarse
      // del primer golpe
      const mv = Math.hypot(zx - z.pos.x, zz - z.pos.z);
      const lerp = Math.max(E.lerp, Math.min((E.hits[0] || E.impact) - 0.03, mv / 4 / E.dur));
      if (W.circleBlocked(pTo.x, pTo.z, 0.22, player.lv)) { pTo.x = px; pTo.z = pz; }
      player.action = {
        kind, t: 0, dur: E.dur / (player.perks ? player.perks.execFast : 1), impact: E.impact, hits: E.hits, hd: {}, face: Math.atan2(dx, dz), target: z, exec: true, cine: true, done: false,
        from: { x: px, z: pz }, pTo, zFrom: { x: z.pos.x, z: z.pos.z }, zTo: { x: zx, z: zz }, lerp,
        zFace: Math.atan2(-dx, -dz), turn: E.turn || null, die: E.die, push: E.push || 0, corpse,
        weapon: w, two: w.knife ? false : (swap ? player.meleeTwo : player.twoHanded), g: G.Weapons.grip(w), knifeSwap: swap
      };
      if (gun) { player.gun.reload = null; player.gun.cycle = null; player.gun.aim = 0; }
      player.running = false;
      z.hold(kind);
      z.heldBy = player.model;
      if (player.stance !== 'stand') player.stance = 'stand';
      if (G.Input && G.Input.setAim) G.Input.setAim(false);
    },

    updateExecution(dt, player, a) {
      const z = a.target;
      const k = U.smooth(Math.min(1, a.t / (a.lerp || 0.22)));
      if (z && z.state === 'held') {
        z.pos.x = U.lerp(a.zFrom.x, a.zTo.x, k); z.pos.z = U.lerp(a.zFrom.z, a.zTo.z, k);
        const want = a.zFace + (a.turn && a.t > a.turn[0] ? a.turn[1] : 0);
        z.facing = U.turnToward(z.facing, want, dt * (a.turn && a.t > a.turn[0] ? 5 : 12));
      }
      player.pos.x = U.lerp(a.from.x, a.pTo.x, k); player.pos.z = U.lerp(a.from.z, a.pTo.z, k);
      for (const ht of a.hits) {
        if (a.hd[ht] || a.t < ht) continue;
        a.hd[ht] = 1;
        this.bloodAt(z, 5);
        if (G.Camera.hitFx) G.Camera.hitFx(0.35, 1);
        this.hitStop = 0.04;
        // el golpe contra la mesa levanta polvo y astillas
        if (a.kind === 'execTable' && ht === 0.43 && G.Guns && G.Guns.burst) {
          G.Guns.burst(new THREE.Vector3(z.pos.x, z.y + 0.95, z.pos.z), new THREE.Vector3(0, 1, 0), false, 10);
          if (G.Camera.shake) G.Camera.shake(0.35);
        }
      }
    },

    resolveExecution(player, a) {
      const z = a.target;
      if (!z || !z.alive) return;
      const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, l = Math.hypot(dx, dz) || 1;
      if (a.corpse) { z.corpseKind = a.corpse; }
      z.die(a.die === 0 ? -1 : a.die);
      if (a.push) {
        z.kb.x = dx / l * a.push; z.kb.z = dz / l * a.push;
        // empujado contra una ventana: la atraviesa
        G.World.breakWindowsAlong(z.pos.x, z.pos.z, z.pos.x + dx / l * 1.6, z.pos.z + dz / l * 1.6, z.lv || 0);
      }
      z.killedBy = a.kind === 'runKill' ? 'melee' : 'exec';
      if (G.Audio) {
        const at = { x: z.pos.x, z: z.pos.z, lv: z.lv, heavy: true, big: true }, ew = a.weapon || player.weapon;
        G.Audio.play(ew && !ew.knife && !BLADE[ew.cat] && ew.cat !== 'none' && !G.Weapons.isGun(ew) ? 'hitBlunt' : 'hitBlade', at);
        G.Audio.play('gore', at);
      }
      this.bloodAt(z, 12);
      if (this.onHit) this.onHit('kill', true);
      if (this.stats && a.kind !== 'runKill') this.stats.exec++;
      this.hitStop = 0.1;
      if (G.Camera.hitFx) G.Camera.hitFx(0.8, 1);
      G.World.emit(player.pos.x, player.pos.z, 4 * player.noiseMul, player.lv);
      if (a.kind === 'execHeavy') this.wear(player, a.weapon);
      if (G.Mode && G.Mode.bark) G.Mode.bark('kill');
    },

    // Ataque en carrera con la navaja: busca al infectado de pie hacia donde corres (hasta 3,2 m)
    runKillTarget(player, zombies) {
      const moveYaw = Math.atan2(player.vel.x, player.vel.z);
      let best = null, bs = Infinity;
      for (const z of zombies) {
        if (!z.alive || z.temb || !z.standing || (z.lv || 0) !== (player.lv || 0) || z.state === 'grapple' || z.state === 'held') continue;
        const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.hypot(dx, dz);
        if (d > 3.2) continue;
        const a = Math.abs(U.angleDiff(Math.atan2(dx, dz), moveYaw));
        if (a > 0.7) continue;
        const sc = d + a * 2;
        if (sc < bs && G.World.hasLOS(player.pos.x, player.pos.z, z.pos.x, z.pos.z, player.lv)) { bs = sc; best = z; }
      }
      return best;
    },

    // salpicadura de sangre a la altura de la cabeza del infectado
    bloodAt(z, n) {
      if (!G.Guns || !G.Guns.burst || !z.model) return;
      const h = z.model;
      h.head.updateWorldMatrix(true, false);
      const p = h.head.getWorldPosition(new THREE.Vector3());
      p.y -= 0.06;
      const d = new THREE.Vector3(Math.sin(z.facing + Math.PI), 0.2, Math.cos(z.facing + Math.PI));
      G.Guns.burst(p, d, true, n);
      if (G.Guns.decal && n >= 10) G.Guns.decal(z.pos.x + d.x * 0.3, z.pos.z + d.z * 0.3, 0.38, z.lv || 0);
    }
  };

  G.Combat = Combat;
})(window.Game = window.Game || {});
