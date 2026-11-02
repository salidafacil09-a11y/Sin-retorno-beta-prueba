(function (G) {
  'use strict';

  // acciones de pelea cuerpo a cuerpo (para la guardia y la cámara de pelea)
  const MELEE_KINDS = { punch1: 1, punch2: 1, punch3: 1, swing1: 1, swing1b: 1, swing2: 1, swing2b: 1, overhead: 1, stab: 1, slash: 1, thrust: 1, shove: 1, stomp: 1, bash: 1, runatk: 1, runshove: 1, finisher: 1, kslash1: 1, kslash2: 1, kstab: 1 };

  const HEAL_TIME = 5.0;        // segundos manteniendo Atacar con la venda en la mano para vendarte
  const HEAL_HOLD_MS = 200;     // mantener más que esto con la venda en la mano = vendarse (un toque: navajazo)
  const THR_HOLD_MS = 180;      // mantener atacar más que esto con la botella en la mano = apuntar
  // sacar un arma: la mano llega a ella a DRAW_SWAP de la animación (DRAW_T s) y ahí aparece en la mano
  const DRAW_T = 0.5, DRAW_SWAP = 0.42;
  // guardar la que tenías en la mano antes de sacar otra (o al quedarte con las manos libres): la mano la
  // lleva a su sitio en HOLST_T s (las largas, por encima del hombro, algo más) y la suelta a STOW_AT de ese
  // tramo; sin nada que sacar, el brazo vuelve en RET_T s
  const HOLST_T = 0.3, HOLST_T_LONG = 0.38, STOW_AT = 0.88, RET_T = 0.32;
  // sin usar ni apuntar el arma (ni nadie persiguiéndote) durante estos segundos, se guarda sola
  const AUTO_HOLSTER = 6;
  // de dónde se saca cada cosa: pistolera del muslo, espalda (armas largas), abajo a la derecha de la mochila
  // (cuerpo a cuerpo y lo que va en la mochila) o la funda de la navaja (cadera izquierda)
  function drawSrc(i, p) {
    // un arma corta en un espacio de las largas sale de la pistolera igual que la pistola
    if (p && (i === 2 || i === 3) && p.hands[i] && G.Weapons.kindOf(p.hands[i].id) === 1) return 'hip';
    return i === 1 || i === 4 ? 'hip' : (i === 2 || i === 3 ? 'back' : (i === -1 ? 'belt' : 'low'));
  }
  const MOLOTOV_CAP = 3;            // molotovs que puedes llevar (como mucho 3, igual que minas y bombas de humo)
  const BANDAGE_HEAL = 40;      // vida que recupera cada venda
  const CHOCO_HEAL = 8;         // vida que recupera una chocolatina (se come al cogerla)
  const U = G.Util;
  // Velocidades (m/s)
  // Como en el video: con el joystick a fondo trota (rápido); con Correr va a toda velocidad.
  // Joystick a medias: camina. Agachado avanza bastante rápido; corriendo agachado, más.
  const WALK = 3.6, RUN = 5.4, AIM_WALK = 1.6, AIM_RUN = 3.2, CROUCH_WALK = 1.9, CROUCH_RUN = 3.3, PRONE_WALK = 0.6;
  const REF_AMT = 2.0;            // velocidad a la que la animación de las piernas llega al máximo
  const NOISE_CROUCH_RUN = 3.5;   // corriendo agachado se oye menos que corriendo de pie
  const ACCEL = 11, DECEL = 14;   // inercia del movimiento omnidireccional
  const RADIUS = 0.28;
  const COVER_ON = false;         // cobertura automática junto a paredes (desactivada por ahora)
  const JUMP_MAX = 1.8;            // obstáculos hasta esta altura (más o menos el alto del personaje): se saltan con la animación de salto; los más altos (contenedores) se trepan
  const DODGE_DIST = 1.6;         // metros que recorre la esquiva
  const NOISE_RUN = 7;            // los zombis te oyen correr a esta distancia
  const NOISE_WALK = 2;           // caminando de pie solo te oyen muy de cerca (agachado o tumbado, nada)

  // Personajes elegibles (diseños propios). Los dos usan las mismas animaciones
  const CHARS = {
    // Di' Arco: superviviente profesional. Mujer negra, delgada y atlética, rostro afinado y melena corta de rizos;
    // top deportivo gris oscuro (espalda nadadora), vientre al aire, short de jean gris con el bajo vuelto, vendas de
    // boxeo en los antebrazos, cintas atadas en los brazos, medias altas con rayas y zapatillas altas de suela blanca.
    // No usa mochila (2 armas largas y 2 cortas; las demás, en el armero del refugio)
    diarco: { name: "Di' Arco", opts: {
      skin: 0x6a412d, shirt: 0x2c2d31, pants: 0x3f454e, hair: 0x1c1410, shoes: 0x1c1c20, lips: 0x7a4436, brow: 0x140e0b,
      longSleeves: false, cuffs: false, collar: null, belt: null, pocket: true, tank: true, crop: 1.235, dshorts: 0.655, socks: 0x26272a,
      sneakers: true, wraps: true, bandCol: 0x2e3034, armTies: 0x2a2b2f, curls: true, hiRes: true, sockTop: [0.565, 0.37],
      hero: true, female: true, slim: true, build: 'slim', scale: 0.933, mesh: 'diarco', armOut: 0, armRun: 0 },
      // lo que la hace distinta (ver Player): vida, esquiva, sigilo, cadencia, sin mochila, más agresiva
      perks: { hp: 115, dodge: 1.55, dodgeSpeed: 1.25, stealth: 0.6, fire: 0.8, packless: true, melee: 1.2, swing: 0.85, run: 1.06,
        healMove: 1.3, noScope: true, knifeOnly: true } },
    // Vera: mujer joven y delgada, malla low poly con textura (src/charmesh_vera.js): melena corta castaña,
    // musculosa verde grisácea, brazaletes y protectores oscuros en los antebrazos, pantalón oscuro ajustado y
    // botas grises. Mochila low poly gris oscuro con solapa y dos correas con hebilla
    vera: { name: 'Vera', opts: {
      skin: 0xd09878, shirt: 0x6e7466, pants: 0x2c3036, hair: 0x3a2a20, shoes: 0x6a6c6c, lips: 0xb26a5e, brow: 0x2a1a14, eyes: 0x4a3222,
      longSleeves: false, cuffs: false, collar: null, belt: null, pocket: false,
      hero: true, female: true, mesh: 'vera', pack: 'vera', scale: 1.1, armOut: 0.09, backAdj: [0.025, 0, 0.045], miniPack: true } },
    // Tomás (el protagonista anterior): pelo corto castaño, barba de unos días, la campera verde azulada de la
    // versión beta abierta sobre una remera clara, vaqueros oscuros, botas y una mochila de lona marrón con rollo
    // Malla nueva (src/charmesh_tomas.js, de un .glb con su esqueleto) y mochila chica marrón gastada
    tomas: { name: 'Tomás', opts: {
      skin: 0xd2a07a, shirt: 0x2f6b78, jacketIn: 0xcfc6b2, pants: 0x2b3345, hair: 0x3a2a1c, shoes: 0x3b3029, lips: 0xa06a58,
      longSleeves: true, cuffs: true, collar: null, belt: null, pocket: true, noBand: true,
      beard: 0x5a4030, hero: true, mesh: 'tomas', scale: 1.1, miniPack: 'marron', armOut: 0.05 } },
    // Booster: veterano de treinta años de apocalipsis. Robusto (no gordo), rubio rapado a los costados con barba
    // corta, musculosa gris sin mangas, pantalón cargo militar oliva con bolsillos, borceguíes, una férula vieja en
    // el antebrazo izquierdo (el brazo que se partió al principio) y una mochila de camuflaje
    booster: { name: 'Booster', dev: true, opts: {
      skin: 0xc99a76, shirt: 0x7b7d7e, pants: 0x4d5138, hair: 0xd9c690, shoes: 0x2d2620, lips: 0x9c6655, brow: 0xa08a58,
      longSleeves: false, cuffs: false, collar: null, belt: null, pocket: true, tank: true, cargo: true, noBand: true,
      beard: 0xb89c62, buzz: true, brace: true, build: 'stocky', hero: true, scale: 1.1, mesh: 'booster', armOut: 0.08, armRun: 0.35 },
      // defensivo: no esquiva; pega con los puños (más fuerte que el cuchillo) y remata más rápido.
      // Por el brazo roto: una sola arma larga y hasta dos cortas
      perks: { hp: 125, dodge: 1, dodgeSpeed: 1, stealth: 1.05, fire: 1, packless: false, melee: 1.35, swing: 1.05, run: 0.97,
        noDodge: true, fists: true, execFast: 1.45, longMax: 1 } },
    // la señora Paula: anciana bajita de pelo blanco suelto bajo una bandana roja, chaleco de cuero gastado sobre
    // una musculosa, pantalón remendado por debajo de la rodilla, riñonera y botas. Malla low poly con textura
    // (src/charmesh_paula.js). Se desbloquea al completar tres carreras
    paula: { name: 'Sra. Paula', lock: 3, dev: true, opts: {
      skin: 0xd8ab92, shirt: 0x857d5e, pants: 0x4b4842, hair: 0xd6d2c8, shoes: 0x2b221c, lips: 0x9a6a62, brow: 0xcfcac0,
      longSleeves: false, cuffs: false, collar: null, belt: null, pocket: true, bandana: 0xa3221c, old: true, vest: 0x2b2420, mane: true, patch: 0x7a5236,
      noBand: true, hero: true, female: true, slim: true, build: 'slim', scale: 0.86, pack: 'paula', mesh: 'paula', armOut: 0.14 },
      // control de zona: el lanzallamas pega más y encuentra más combustible; poca vida, lenta, mala cuerpo a cuerpo,
      // se la ve antes. Sin escopetas ni rifles, sin esquiva
      perks: { hp: 70, dodge: 1, dodgeSpeed: 1, stealth: 1.45, fire: 1, packless: false, melee: 0.55, swing: 1.15, run: 0.92,
        noDodge: true, flame: 1.25, fuel: 2, noLong: true, sprint: 0.92 } }
  };
  const NO_PERKS = { hp: 100, dodge: 1, dodgeSpeed: 1, stealth: 1, fire: 1, packless: false, melee: 1, swing: 1, run: 1,
    noDodge: false, fists: false, execFast: 1, longMax: 2, noLong: false, flame: 1, fuel: 1, sprint: 1, healMove: 1, noScope: false, knifeOnly: false };
  // (cada personaje completa lo que no define con los valores normales)
  for (const id in CHARS) CHARS[id].perks = Object.assign({}, NO_PERKS, CHARS[id].perks || {});

  class Player {
    constructor(scene) {
      this.scene = scene;
      this.charId = 'diarco';          // (la protagonista principal)
      this.buildModel();
      this.reset();
    }

    // ventajas del personaje (Di' Arco); los demás, las normales
    get perks() { const c = CHARS[this.charId]; return (c && c.perks) || NO_PERKS; }
    // armas de fuego largas que no puede usar (la señora Paula: ni escopetas ni rifles)
    canUse(id) {
      const w = G.Weapons.get(id);
      if (!w || w.id !== id) return true;          // (no es un arma: vendas, molotovs, minas, balas... las usan todos)
      if (this.perks.knifeOnly && w && w.cat !== 'gun' && !w.knife) return false;      // (Di' Arco: cuerpo a cuerpo, solo su navaja)
      return !(this.perks.noLong && w && w.cat === 'gun' && (w.gun === 'shotgun' || w.gun === 'double' || w.gun === 'rifle'));
    }
    get packless() { return !!this.perks.packless; }
    get maxHealth() { return this.perks.hp; }
    // multiplica lo que tarda en reconocerte un enemigo (sigilo): más bajo, más difícil de ver
    stealthMul() { return this.stance !== 'stand' || this.inGrass ? this.perks.stealth : 1; }
    // bolsillos: sin mochila, lleva los suministros como si la tuviera (la protagonista profesional)
    get bags() { return this.backpack || this.packless; }

    buildModel() {
      const c = CHARS[this.charId];
      this.model = G.Models.createHumanoid(c.opts);
      this.female = !!c.opts.female;
      this.charName = c.name;
      this.scene.add(this.model.root);
    }

    // Cambia de personaje (desde el menú)
    setCharacter(id) {
      if (!CHARS[id] || id === this.charId) return;
      const old = this.model;
      if (old && old.root.parent) old.root.parent.remove(old.root);
      this.charId = id;
      this.buildModel();
      this.backpack = !this.packless;
      if (this.packless && this.stored.length && !(G.Run && G.Run.inRefuge)) this.stored = [];
      // lo que este personaje no usa no se queda en las manos (Di' Arco: ningún arma cuerpo a cuerpo salvo la navaja)
      for (let i = 0; i < this.hands.length; i++) if (this.hands[i] && !this.canUse(this.hands[i].id)) { if (this.cur === i) this.cur = -1; this.hands[i] = null; }
      this.refreshModel();
    }

    reset() {
      const s = G.World.SPAWN;
      this.pos = { x: s.x, z: s.z };
      this.vel = { x: 0, z: 0 };
      this.lv = 0;               // planta (0 = baja, 1 = arriba)
      this.elev = 0;             // encima de un contenedor: altura de los pies sobre el suelo
      this.fallV = 0; this.falling = false; this.landT = 0;
      this.y = G.World.groundY(s.x, s.z, 0);
      this.facing = Math.PI;
      this.health = 100;
      this.stamina = 1;
      this.noise = 0;
      this.noiseLevel = 0;
      this.hurt = 0;
      this.phase = 0;
      this.moveAmt = 0;
      this.moveRel = 0;          // dirección del movimiento respecto a donde mira el cuerpo
      this.running = false;
      this.aiming = false;
      this.stance = 'stand';     // stand | crouch | prone
      this.crouchAmt = 0;
      this.proneAmt = 0;
      this.hop = null;
      this.action = null;
      this.struggle = null;      // forcejeo con un infectado que te agarró
      this.grabCD = 0;           // segundos sin que te puedan volver a agarrar
      this.climb = null;
      this.blow = null; this.blowKb = null; this.dodging = null; this.dodgeAfter = 0;
      this.beaten = null;        // un infectado te está dando su combo de golpes (nadie más te pega)
      this.healing = null; this.healPress = null; this.hostage = null; this.thrPress = null; this.bowPress = null; this.lifted = null; this.bossKill = null; this.fly = null; this.climbLift = 0; this.drawA = null; this.drawOK = false;
      this.throwable = null;     // ladrillo o botella en la mano libre (solo uno a la vez)
      // Armas a mano: 0 cuerpo a cuerpo · 1 y 4 armas cortas (pistolera derecha e izquierda: pistola y revólver)
      // · 2 y 3 armas de fuego largas (a la espalda). Cada una { id, cond, two } (armas de fuego: mag = balas
      // cargadas, sil = silenciador; no tienen estado: nunca se rompen)
      this.hands = [null, null, null, null, null];
      this.stored = [];            // armas guardadas en la mochila (todas las que quieras)
      this.backpack = !this.packless;   // por ahora la mochila se lleva siempre (Di' Arco no la usa)
      this.items = { venda: 0, venda_d: 0, alcohol: 0, trapo: 0, molotov: 0, polvo: 0, clavos: 0, tijeras: 0, panuelo: 0, mina: 0, humo: 0 };
      this.ammo = { '9mm': 0, cartucho: 0, rifle: 0, flecha: 0, flecha_exp: 0, revolver: 0, smg: 0, gas: 0 };
      this.arrowExp = false;     // el arco usa flechas explosivas (se cambia con V o en la cruz)
      this.silencers = 0;        // silenciadores sin poner
      this.prev = -1;            // arma anterior (cambio rápido)
      this.heal = 0;             // vida que aún va a recuperar (vendas desinfectadas)
      this.infRisk = 0;          // probabilidad de infección de heridas sin vendar
      this.infRiskT = 0;         // segundos hasta que esa infección se decide
      this.gun = { aim: 0, recoil: 0, bloom: 0, draw: 0, cycle: null, reload: null, rw: 0, ru: 0, cooldown: 0, arrow: false };
      this.cur = -1;             // -1 = manos libres
      this.cover = null;         // cobertura: agachado junto a una pared o valla
      this.coverAmt = 0;
      this.scope = false;        // mira telescópica puesta (rifle)
      this.bleed = 0;
      this.bleedRate = 0;
      this.infected = false;
      this.infectTime = 0;
      this.sick = false;
      this.wounds = 0;
      this.dead = false;
      this.deathCause = '';
      this.model.root.visible = true;
      this.model.body.rotation.set(0, 0, 0);
      this.model.body.position.set(0, 0, 0);
      G.Models.setWeapon(this.model, null);
      G.Models.setBackWeapon(this.model, null);
      G.Models.setBackpack(this.model, this.backpack);
      this._thrShown = false;
      this.refreshModel();          // la navaja en la mano desde el principio
      this.apply();
    }

    get bandageHeal() { return BANDAGE_HEAL; }

    // Sin sistema de resistencia: siempre al máximo (correr, golpear y empujar no cansan)
    get stamina() { return 1; }
    set stamina(v) { /* nada */ }

    // sin otra arma en las manos, la del cuerpo a cuerpo que lleves colgada (o la navaja): sale sola al golpear
    get weapon() { return this.cur > 0 && this.hands[this.cur] ? G.Weapons.get(this.hands[this.cur].id) : this.meleeWeapon; }
    // el arma cuerpo a cuerpo con la que golpeas (no se elige: la llevas colgada y sale al atacar, como la
    // navaja); si no llevas ninguna o se rompe, la navaja
    get meleeWeapon() { const m = this.hands[0]; return m && !m.broken ? G.Weapons.get(m.id) : G.Weapons.KNIFE; }
    get meleeTwo() { const m = this.hands[0]; return !!(m && !m.broken && m.two); }
    get slot() { return this.cur > 0 ? this.hands[this.cur] : null; }
    // todas las armas que llevas (a mano y guardadas)
    get weapons() { return this.hands.concat(this.stored).filter(Boolean); }
    set weapons(list) {
      this.hands = [null, null, null, null, null]; this.stored = []; this.cur = -1; this.prev = -1;
      for (const s of list || []) this.place(s);
      this.refreshModel && this.model && this.refreshModel();
    }
    get crouching() { return this.stance === 'crouch'; }
    get prone() { return this.stance === 'prone'; }
    // 0 de pie, 1 agachado, 2 tumbado: cuanto más alto, más difícil que te vean
    get stealth() { return this.stance === 'prone' ? 2 : (this.stance === 'crouch' ? 1 : 0); }

    // Pruebas de desarrollador: un juego completo de armas, munición llena y vendas
    applyDev() {
      this.backpack = !this.packless;
      this.hands = [null, null, null, null, null]; this.stored = [];
      this.cur = -1;
      for (const id of ['bate', 'pistola', 'escopeta', 'rifle', 'arco']) {
        const w = G.Weapons.get(id);
        this.pickUp(id, G.Weapons.isGun(w) ? w.mag : 1, 1);
      }
      for (const a in this.ammo) this.ammo[a] = this.ammoCap(a);
      this.items.venda = Math.max(this.items.venda, 3);
      this.equip(-1);
      this.refreshModel();
    }

    // Armería de pruebas: pone cualquier arma en su espacio (cuerpo a cuerpo, pistola o larga) y la equipa
    devGive(id) {
      const w = G.Weapons.get(id);
      if (!w || w.cat === 'none' || this.busy()) return null;
      const gun = G.Weapons.isGun(w);
      let i;
      if (!gun) i = 0;
      else if (G.Weapons.isShort(w)) i = this.hands[4] && this.hands[4].id === id ? 4 : ((!this.hands[1] || this.hands[1].id === id) ? 1 : 4);
      else {
        for (let k = 2; k <= 3; k++) if (this.hands[k] && this.hands[k].id === id) { this.equip(k); return 'En las manos: ' + w.name; }
        i = this.cur === 3 ? 3 : 2;
      }
      const slot = { id, cond: 1, two: w.hands === 2 };
      if (gun) slot.mag = w.mag;
      this.hands[i] = slot;
      for (const a in this.ammo) this.ammo[a] = this.ammoCap(a);
      this.equip(i);
      this.refreshModel();
      return 'En las manos: ' + w.name;
    }

    busy() { return !!(this.action || this.climb || this.dodging || (this.blow && this.blow.t < 0.5) || (this.drawA && !this.drawA.swapped)); }

    // Te alcanza un zombi: el cuerpo acusa el golpe (se echa atrás o de lado y retrocede un paso).
    // Corta el golpe que estabas dando. La cámara no se toca.
    takeBlow(z, type) {
      const dx = this.pos.x - z.pos.x, dz = this.pos.z - z.pos.z, l = Math.hypot(dx, dz) || 1;
      const rel = U.angleDiff(Math.atan2(-dx, -dz), this.facing);      // de dónde viene (0 = de frente)
      const bite = type === 'mordisco';
      this.blow = { t: 0, dur: bite ? 1.0 : 0.6, rel, bite };
      this.stopHeal();
      const f = bite ? 1.2 : 2.2;
      this.blowKb = { x: dx / l * f, z: dz / l * f };
      const a = this.action;
      if (a && a.kind !== 'finisher' && a.kind !== 'grab' && a.kind !== 'bandage') this.action = null;
    }

    // Puñetazo o golpe en carrera de un infectado: reacciona como reaccionaban ellos a tus golpes (gancho:
    // cabeza y torso de lado; golpe fuerte: atrás con los brazos arriba) y retrocede
    takePunch(z, react, fl, push) {
      const dx = this.pos.x - z.pos.x, dz = this.pos.z - z.pos.z, l = Math.hypot(dx, dz) || 1;
      if (react === 'launch') {
        // manotazo del temblante: sale despedida lejos (hacia fuera y hacia su derecha, por donde barre el
        // brazo), girada hacia donde va, trastabillando y casi cayéndose
        const f = z.facing || 0;
        let ux = dx / l * 0.75 - Math.cos(f) * 0.65, uz = dz / l * 0.75 + Math.sin(f) * 0.65;
        const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
        this.facing = Math.atan2(ux, uz);
        this.blow = { t: 0, dur: 1.55, rel: 0, bite: false, react: 'launch', fl: fl || 1 };
        this.stopHeal();
        this.blowKb = { x: ux * push, z: uz * push, decay: 2.6 };
        const a = this.action;
        if (a && a.kind !== 'finisher' && a.kind !== 'grab' && !a.exec) this.action = null;
        this.dodging = null;
        return;
      }
      const rel = U.angleDiff(Math.atan2(-dx, -dz), this.facing);
      const heavy = react === 'heavy';
      this.blow = { t: 0, dur: heavy ? 0.95 : 0.6, rel, bite: false, react, fl };
      this.stopHeal();
      // de lado: hacia su derecha (fl +1) o su izquierda, además de un poco atrás
      const rx = -Math.cos(this.facing), rz = Math.sin(this.facing);
      const lat = heavy ? 0.15 : 0.55;
      this.blowKb = { x: (dx / l + rx * fl * lat) * push, z: (dz / l + rz * fl * lat) * push };
      const a = this.action;
      if (a && a.kind !== 'finisher' && a.kind !== 'grab' && !a.exec) this.action = null;
      this.dodging = null;
    }

    // Lo que hace que el personaje nunca parezca quieto: inclinarse al girar y al acelerar, jadear después
    // de correr, mirar al infectado más cercano, ponerse en guardia con la oleada y gestos sueltos en reposo
    life(dt, vlen) {
      if (dt <= 0) return;
      const L = this.lf || (this.lf = { face: this.facing, v: 0, turn: 0, acc: 0, breath: 0, bt: 0, idle: 0, look: null, ly: 0, lp: 0, lw: 0, alert: 0, fid: null, next: 6 + Math.random() * 5 });
      const tr = U.angleDiff(this.facing, L.face) / dt;
      L.face = this.facing;
      L.turn += (U.clamp(tr, -6, 6) - L.turn) * Math.min(1, dt * 8);
      const ac = (vlen - L.v) / dt;
      L.v = vlen;
      L.acc += (U.clamp(ac, -12, 12) - L.acc) * Math.min(1, dt * 6);
      const sprint = this.running && !this.crouchRun && vlen > 3.5;
      L.breath = U.clamp(L.breath + (sprint ? dt * 0.16 : -dt * 0.07), 0, 1);
      L.bt += dt * (1.7 + 1.9 * L.breath);
      // infectado más cercano delante o a los lados (no detrás): la cabeza lo sigue
      let best = null, bd = 14;
      const zs = G.Population ? G.Population.list : [];
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        if (!z.alive || (z.lv || 0) !== (this.lv || 0)) continue;
        const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d >= bd) continue;
        const rel = U.angleDiff(Math.atan2(dx, dz), this.facing);
        if (Math.abs(rel) > 2.1) continue;
        best = { rel, d, y: z.y }; bd = d;
      }
      if (best) {
        L.ly += (best.rel - L.ly) * Math.min(1, dt * 7);
        L.lp += (Math.atan2(0.08 + (this.y - best.y) * 0.8, Math.max(0.6, best.d)) - L.lp) * Math.min(1, dt * 7);
      }
      L.lw += ((best ? 1 : 0) - L.lw) * Math.min(1, dt * 4);
      L.look = L.lw > 0.02 ? { yaw: L.ly, pitch: L.lp, w: L.lw } : null;
      // guardia: con una oleada en marcha o si alguno te persigue cerca
      let chased = false;
      for (let i = 0; i < zs.length && !chased; i++) {
        const z = zs[i];
        if (z.alive && (z.state === 'chase' || z.state === 'attack' || z.state === 'alert') && Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z) < 18) chased = true;
      }
      const alertOn = chased || !!(G.Mode && G.Mode.fighting);
      L.alert += ((alertOn ? 1 : 0) - L.alert) * Math.min(1, dt * (alertOn ? 3 : 0.8));
      // gestos sueltos tras un rato quieto
      const still = this.moveAmt < 0.05 && !this.action && !this.aiming && !this.climb && !this.prone && L.alert < 0.5;
      if (L.fid) { L.fid.t += dt / L.fid.dur; if (L.fid.t >= 1 || !still) L.fid = null; }
      L.idle = still ? L.idle + dt : 0;
      if (!L.fid && L.idle > L.next) {
        const kinds = ['look', 'neck', 'shake', 'look'];
        L.fid = { kind: kinds[Math.floor(Math.random() * kinds.length)], t: 0, dur: 1.6 + Math.random() * 0.6, side: Math.random() < 0.5 ? 1 : -1 };
        L.idle = 0; L.next = 6 + Math.random() * 7;
      }
    }

    // Agachado o tumbado, los ruidos que haces (puertas, golpes) llegan menos lejos
    get noiseMul() { return this.stance === 'prone' ? 0.35 : (this.stance === 'crouch' ? 0.5 : 1); }

    setStance(s) {
      if (this.dead || this.climb) return;
      this.stance = s;
      if (s === 'prone') G.Input.setAim && G.Input.setAim(false);
    }
    toggleCrouch() { this.setStance(this.stance === 'crouch' ? 'stand' : 'crouch'); }
    toggleProne() { this.setStance(this.stance === 'prone' ? 'stand' : 'prone'); }

    // ---------- Armas ----------
    // Espacios: 1 cuerpo a cuerpo (de cualquier tamaño), 1 pistola y 2 armas de fuego largas a la
    // espalda; con mochila, 2 armas largas más guardadas. No se sueltan: las cuerpo a cuerpo se
    // rompen y desaparecen; las de fuego se rompen y se quedan (inservibles hasta arreglarlas).
    get twoHanded() { const s = this.slot; return s ? !!s.two : (this.cur < 0 ? this.meleeTwo : false); }
    get backSlots() {
      const out = [];
      for (const i of [2, 3]) if (this.hands[i] && i !== this.cur) out.push(this.hands[i]);
      // un arma cuerpo a cuerpo larga guardada va a la espalda si queda sitio
      const m = this.hands[0];
      if (m && this.cur !== 0 && out.length < 2 && G.Weapons.isLong(G.Weapons.get(m.id))) out.push(m);
      return out;
    }
    // Lo que se ve colgado: la pistola en la pistolera del muslo, las armas largas a los costados de la mochila
    // (izquierda la 1.ª, derecha la 2.ª) y el arma cuerpo a cuerpo colgando abajo a la derecha. Lo guardado en la
    // mochila no se ve. inHand: el espacio que está en la mano (lo demás, colgado)
    carried(inHand) {
      const out = [];
      if (this.hands[1] && inHand !== 1) out.push({ id: this.hands[1].id, where: 'hip', sil: !!this.hands[1].sil });
      // la segunda arma corta, en la pistolera del muslo izquierdo
      if (this.hands[4] && inHand !== 4) out.push({ id: this.hands[4].id, where: 'hipL', sil: !!this.hands[4].sil });
      // la 1.ª arma larga a la derecha (la mano derecha la saca por encima del hombro), la 2.ª a la izquierda
      // (un arma corta en uno de esos espacios va en la pistolera del muslo izquierdo)
      const sh = (i) => G.Weapons.kindOf(this.hands[i].id) === 1;
      if (this.hands[2] && inHand !== 2) out.push({ id: this.hands[2].id, where: sh(2) ? 'hipL' : 'R' });
      if (this.hands[3] && inHand !== 3) out.push({ id: this.hands[3].id, where: sh(3) ? 'hipL' : ((this.hands[2] && !sh(2)) || (inHand === 2 && !sh(2)) ? 'L' : 'R') });
      // (el cuerpo a cuerpo, mientras lo tienes en la mano al golpear, tampoco cuelga)
      if (this.hands[0] && inHand !== 0 && !this._meleeOut) out.push({ id: this.hands[0].id, where: 'low' });
      return out;
    }

    // ¿Dónde iría esta arma? { where: 'hand'|'stored', i, replace } o null si no cabe
    spotFor(id) {
      const k = G.Weapons.kindOf(id);
      if (k < 0) return null;
      if (this.weapons.some((s) => s.id === id && !s.broken)) return null;      // ya la tienes
      if (!this.canUse(id)) return null;                                           // (Paula: ni escopetas ni rifles; Di' Arco: solo la navaja)
      if (k === 0) return !this.hands[0] ? { where: 'hand', i: 0 } : null;                                           // (Paula: ni escopetas ni rifles)
      // Booster (el brazo que se partió): una sola arma larga, que se cambia por la nueva, y dos cortas
      if (this.perks.longMax < 2) {
        if (k === 1) { for (const i of [1, 4]) if (!this.hands[i]) return { where: 'hand', i }; }
        else return !this.hands[2] ? { where: 'hand', i: 2 } : { where: 'hand', i: 2, replace: true };
        for (const i of [1, 4]) if (this.hands[i].broken) return { where: 'hand', i, replace: true };
        return null;
      }
      // armas cortas: las dos pistoleras (derecha e izquierda); largas: los dos sitios de la espalda.
      // Si están llenos, a la mochila (caben todas las que quieras)
      for (const i of (k === 1 ? [1, 4] : [2, 3])) if (!this.hands[i]) return { where: 'hand', i };
      if (this.backpack && !this.packless) return { where: 'stored', i: this.stored.length };
      // Di' Arco (sin mochila): en el refugio, lo que no le cabe va al armero (y desde la mochila lo cambia)
      if (this.packless && G.Run && G.Run.inRefuge) return { where: 'stored', i: this.stored.length };
      // sin mochila: un arma rota se cambia por la nueva
      for (const i of (k === 1 ? [1, 4] : [2, 3])) if (this.hands[i].broken) return { where: 'hand', i, replace: true };
      return null;
    }
    // ¿Ya no te cabe más de esto? (en el suelo o en un mueble se marca con MAX)
    fullOf(id) {
      if (id === 'molotov') return (this.items.molotov || 0) >= MOLOTOV_CAP;
      if (id === 'ladrillo' || id === 'botella') return !!this.throwable;
      if (G.Weapons.isItem(id)) return this.itemRoom(id) <= 0;
      return false;
    }
    canTake(id) {
      if (G.Weapons.isItem(id)) return this.itemRoom(id) > 0;
      return !!this.spotFor(id);
    }

    place(s) {
      const sp = this.spotFor(s.id);
      if (!sp) return null;
      const arr = sp.where === 'hand' ? this.hands : this.stored;
      const old = sp.replace ? arr[sp.i] : null;
      arr[sp.i] = s;
      return { sp, old };
    }

    // Práctica libre: nada de lo que tienes baja (si lo gastas, vuelve); lo que consigues de más, se suma
    keepStock() {
      const mx = this.stockMax || (this.stockMax = {});
      for (const k in this.items) { if (this.items[k] > (mx['i' + k] || 0)) mx['i' + k] = this.items[k]; else this.items[k] = mx['i' + k] || 0; }
      for (const k in this.ammo) { if (this.ammo[k] > (mx['a' + k] || 0)) mx['a' + k] = this.ammo[k]; else this.ammo[k] = mx['a' + k] || 0; }
    }

    // ladrillo o botella en la mano (espacio -2 de la cruz); venda en la mano (espacio -3)
    // en la mano: -2 la botella o el ladrillo (uno a la vez), -4 una molotov (van aparte: se fabrican y se acumulan)
    // -5 una mina (se coloca en el suelo), -6 una bomba de humo (se lanza)
    get inHandThr() { return this.cur === -2 ? this.throwable : (this.cur === -4 && this.items.molotov > 0 ? 'molotov' : (this.cur === -6 && this.items.humo > 0 ? 'humo' : null)); }
    get holdingMine() { return this.cur === -5 && this.items.mina > 0; }
    get holdingThr() { return !!this.inHandThr; }
    get holdingVenda() { return this.cur === -3 && this.items.venda > 0; }

    // Vendarse en movimiento: con la venda en la mano, manteniendo Atacar. Mientras dura vas agachada y
    // caminando (aunque pidas correr); si sueltas, te pegan o te cambias de arma, se corta sin gastarla
    startHeal() {
      if (!this.holdingVenda || this.dead || this.struggle || this.climb) return 'Ahora no puedes';
      if (this.health + this.heal >= 99 && !this.infinite) return 'No lo necesitas (tienes la vida llena)';
      this.healing = { t: 0, prev: this.stance === 'prone' ? 'crouch' : this.stance };
      this.stance = 'crouch';
      return null;
    }
    stopHeal() {
      if (!this.healing) return;
      const prev = this.healing.prev;
      this.healing = null;
      if (!this.dead && this.stance === 'crouch' && prev === 'stand') this.stance = 'stand';
    }
    // Lo que se ve en la mano para cada espacio (manos libres: nada; la navaja solo sale al golpear)
    modelIdOf(i) {
      if (i >= 0) return this.hands[i] ? this.hands[i].id : null;
      if (i === -2) return this.throwable || null;
      if (i === -4) return this.items.molotov > 0 ? 'molotov' : null;
      if (i === -5) return this.items.mina > 0 ? 'mina' : null;
      if (i === -6) return this.items.humo > 0 ? 'humo' : null;
      if (i === -3) return this.items.venda > 0 ? 'venda' : null;
      return null;
    }
    weaponAt(i) { return i >= 0 && this.hands[i] ? G.Weapons.get(this.hands[i].id) : G.Weapons.KNIFE; }
    // Espacio que se ve en la mano ahora: guardando la anterior, la anterior; entre guardar y sacar, ninguno
    get handSlot() {
      const d = this.drawA;
      if (d && !d.stowed) return d.from;
      if (d && !d.swapped) return null;
      return this.cur;
    }
    refreshModel() {
      const hs = this.handSlot;
      const sil = hs != null && hs >= 0 && this.hands[hs] && this.hands[hs].sil;
      G.Models.setWeapon(this.model, hs == null ? null : this.modelIdOf(hs), sil ? { sil: true } : null);
      G.Models.setBackWeapon(this.model, this.carried(hs), this.backpack);
      if (G.Models.setBackpack) G.Models.setBackpack(this.model, this.backpack);
    }

    equip(i) {
      if (i === 0) i = -1;                   // el cuerpo a cuerpo no se elige: sale solo al golpear
      if (i === -2 && !this.throwable) i = -1;
      if (i === -4 && !this.items.molotov) i = -1;
      if (i === -5 && !this.items.mina) i = -1;
      if (i === -6 && !this.items.humo) i = -1;
      if (i === -3 && !this.items.venda) i = -1;
      if (i !== -3 && this.healing) this.stopHeal();
      if (i >= 0 && !this.hands[i]) i = -1;
      if (i !== this.cur) this.prev = this.cur;
      // cambio de arma: primero guarda lo que tiene en la mano (lo lleva a su sitio: pistolera, espalda,
      // mochila) y después la mano va a buscar lo nuevo. Con las manos libres solo guarda
      if (i !== this.cur && this.model && this.drawOK && !this.dead) {
        const from = this.handSlot;
        const hasFrom = from != null && from !== -1 && !!this.modelIdOf(from);
        const hasTo = i !== -1 && !!this.modelIdOf(i);
        const hold = hasFrom ? (from === 2 || from === 3 ? HOLST_T_LONG : HOLST_T) : 0;
        this.drawA = hasFrom || hasTo ? {
          time: 0, hold, drawDur: hasTo ? DRAW_T : 0, from: hasFrom ? from : null, hsrc: hasFrom ? drawSrc(from, this) : null, src: drawSrc(i, this),
          stowed: !hasFrom, swapped: !hasTo && !hasFrom
        } : null;
      }
      this.idleArmT = 0;
      this.cur = i;
      if (i >= 0 && this.hands[i] && G.Weapons.isGun(G.Weapons.get(this.hands[i].id))) this.lastGun = i;
      this.gun.reload = null; this.gun.cycle = null; this.gun.draw = 0; this.gun.aim = 0;
      this.refreshModel();
    }

    // Elegir un espacio (1 cuerpo a cuerpo, 2 pistola, 3 y 4 largas); el mismo otra vez = manos libres
    selectSlot(n) {
      if (this.busy()) return null;
      const i = n - 1;
      if (!this.hands[i] || i === 0) return null;
      this.equip(i === this.cur ? -1 : i);
      return this.cur >= 0 ? 'En las manos: ' + this.weapon.name : 'Manos libres';
    }

    // Siguiente arma a mano (después de la última, manos libres)
    cycleWeapon() {
      if (this.busy()) return null;
      const order = [-1, 1, 4, 2, 3], at = Math.max(0, order.indexOf(this.cur));
      for (let k = 1; k <= 5; k++) {
        const i = order[(at + k) % 5];
        if (i === -1 || this.hands[i]) { this.equip(i); return i >= 0 ? 'En las manos: ' + this.weapon.name : 'Manos libres'; }
      }
      return null;
    }

    // Desenfunde rápido: el último arma de fuego que usaste (si ya no la tienes, la primera que haya)
    gunSlot() {
      const ok = (i) => i >= 0 && this.hands[i] && G.Weapons.isGun(G.Weapons.get(this.hands[i].id));
      if (ok(this.lastGun)) return this.lastGun;
      for (const i of [1, 4, 2, 3]) if (ok(i)) return i;
      return -1;
    }

    // Cambio rápido: vuelve al arma anterior
    quickSwap() {
      if (this.busy()) return null;
      let p = this.prev;
      if (p >= 0 && !this.hands[p]) p = -1;
      if (p === this.cur) return null;
      this.equip(p);
      return this.cur >= 0 ? 'En las manos: ' + this.weapon.name : 'Manos libres';
    }

    // Intercambia un arma larga a mano (espacio 2 o 3) con una guardada en la mochila
    // Intercambia un arma a mano con una de la mochila (las cortas, con las pistoleras 1 y 4; las largas, con
    // la espalda 2 y 3). storeI fuera de la lista: solo la guarda. Devuelve false si no encajan
    swapStored(handI, storeI) {
      if (!(this.backpack || (this.packless && G.Run && G.Run.inRefuge)) || [1, 2, 3, 4].indexOf(handI) < 0) return false;
      const a = this.hands[handI], b = this.stored[storeI] || null;
      const want = handI === 1 || handI === 4 ? 1 : 2;
      if (b && G.Weapons.kindOf(b.id) !== want) return false;
      if (!a && !b) return false;
      this.hands[handI] = b;
      if (b) this.stored.splice(storeI, 1);
      if (a) this.stored.splice(b ? storeI : this.stored.length, 0, a);
      if (this.cur === handI) { this.gun.reload = null; this.gun.cycle = null; this.gun.draw = 0; if (!b) this.cur = -1; }
      this.refreshModel();
      return true;
    }

    // ---------- Objetos: munición, accesorios, curación y mochila ----------
    ammoCap(a) { return G.Weapons.AMMO[a].cap * (this.bags ? G.Weapons.BAG_MUL : 1) * (a === 'gas' && this.perks.fuel > 1 ? 1.5 : 1); }
    // Cuánto más cabe de un objeto
    itemRoom(id) {
      const a = G.Weapons.ammoOfItem(id);
      if (a) return Math.max(0, this.ammoCap(a) - this.ammo[a]);
      if (id === 'silenciador') return 99;
      if (id === 'mochila') return this.backpack || this.packless ? 0 : 1;
      // chocolatina: se come al cogerla (cura un poco); con la vida llena no se coge
      if (id === 'chocolatina') return this.health + this.heal < 99.5 ? 99 : 0;
      const sp = G.Weapons.SUPPLY[id];
      if (!sp) return 0;
      return Math.max(0, sp.cap[this.bags ? 1 : 0] - this.items[id]);
    }

    // Coge n de un objeto (lo que quepa). Devuelve { msg, left }
    takeItem(id, n) {
      const room = this.itemRoom(id);
      if (id === 'chocolatina') {
        if (room <= 0) return { msg: 'Tienes la vida llena', left: n };
        const before = this.health;
        this.health = Math.min(100, this.health + CHOCO_HEAL * n);
        this.hurt = 0;
        return { msg: 'Te comiste una chocolatina: +' + Math.round(this.health - before) + ' de vida', left: 0 };
      }
      if (room <= 0) {
        const sp = G.Weapons.SUPPLY[id];
        return { msg: sp && !sp.cap[0] && !this.bags ? 'Necesitas una mochila para llevar ' + G.Weapons.nameOf(id).toLowerCase() : 'No te cabe más: ' + G.Weapons.nameOf(id).toLowerCase(), left: n };
      }
      const k = Math.min(n, room), left = n - k;
      const a = G.Weapons.ammoOfItem(id);
      let msg;
      if (a) { this.ammo[a] += k; msg = 'Cogiste ' + k + ' ' + G.Weapons.AMMO[a].name; }
      else if (id === 'silenciador') {
        const s = this.hands[1];
        if (s && !s.sil) { s.sil = 20; this.refreshModel(); msg = 'Silenciador puesto en la pistola (V lo quita y lo pone)'; }
        else { this.silencers++; msg = 'Cogiste un silenciador (sirve para la pistola)'; }
      } else if (id === 'mochila') {
        this.backpack = true; this.refreshModel();
        msg = 'Te pusiste la mochila: más espacio para munición y vendas, y 2 armas largas guardadas';
      } else {
        this.items[id] += k;
        msg = id === 'alcohol' ? 'Cogiste ' + (k === 1 ? 'una botella' : k + ' botellas') + ' de alcohol (' + this.items.alcohol + ')'
          : id === 'trapo' ? 'Cogiste ' + (k === 1 ? 'un trapo' : k + ' trapos') + ' (' + this.items.trapo + ')'
          : 'Cogiste ' + (k === 1 ? 'una ' : k + ' ') + G.Weapons.nameOf(id).toLowerCase() + (k === 1 ? '' : 's');
        if ((id === 'alcohol' || id === 'trapo') && this.items.alcohol >= 2 && this.items.trapo >= 1) msg += ' · puedes fabricar una venda en la mochila';
        if ((id === 'polvo' || id === 'clavos') && this.items.polvo >= 1 && this.items.clavos >= 2) msg += ' · puedes fabricar una mina';
        else if ((id === 'polvo' || id === 'trapo') && this.items.polvo >= 1 && this.items.trapo >= 1) msg += ' · puedes fabricar una bomba de humo';
      }
      if (left > 0) msg += ' · no te cabe el resto';
      return { msg, left };
    }

    // Coge un arma: va a su espacio. Devuelve { ok, old (arma rota que dejas), equipped } o { ok: false }
    pickUp(id, cond, dur) {
      const w = G.Weapons.get(id);
      const slot = { id, cond, two: w.hands === 2 };
      if (G.Weapons.isGun(w)) {
        slot.cond = 1;                     // las armas de fuego no tienen estado: nunca se rompen
        slot.mag = Math.max(0, Math.min(w.mag, Math.round(cond || 0)));
        if (w.id === 'pistola' && this.silencers > 0) { this.silencers--; slot.sil = 20; }
      }
      const r = this.place(slot);
      if (!r) return { ok: false };
      let equipped = false;
      if (r.sp.where === 'hand' && r.sp.i > 0 && !this.busy()) { this.equip(r.sp.i); equipped = true; }
      else this.refreshModel();
      return { ok: true, old: r.old, equipped, stored: r.sp.where === 'stored' };
    }

    // Accesorio (V / LB): con la pistola pone o quita el silenciador; con el rifle, apuntando, la mira telescópica
    // Arco: flechas normales o explosivas (la que está puesta vuelve al carcaj si no es del tipo elegido)
    setArrowExp(on) {
      const s = this.slot, w = this.weapon;
      if (on && !this.ammo.flecha_exp && !(s && s.mag && s.exp && w.gun === 'bow')) { this.arrowExp = false; return 'No tienes flechas explosivas'; }
      this.arrowExp = !!on;
      if (s && w.gun === 'bow' && s.mag && !!s.exp !== this.arrowExp && !this.busy()) {
        if (s.exp) this.ammo.flecha_exp++; else this.ammo.flecha++;
        s.mag = 0; s.exp = false; this.gun.draw = 0;
      }
      return this.arrowExp ? 'Flechas explosivas (' + (this.ammo.flecha_exp + (s && s.mag && s.exp ? 1 : 0)) + ')' : 'Flechas normales';
    }
    toggleGrip() {
      const s = this.slot;
      if (!s) return null;
      const w = this.weapon;
      if (!G.Weapons.isGun(w)) return null;
      if (w.gun === 'bow') return this.setArrowExp(!this.arrowExp);
      if (w.scope) {
        if (!this.aiming) return null;
        if (this.perks.noScope) return this.charName + ' apunta sin la mira telescópica';     // (Di' Arco: solo la mira común)
        this.scope = !this.scope;
        return null;
      }
      if (this.busy() || w.id !== 'pistola') return null;
      if (s.sil) { this.silencers++; s.silStore = s.sil; s.sil = 0; this.refreshModel(); return 'Quitaste el silenciador'; }
      if (this.silencers > 0) { this.silencers--; s.sil = s.silStore || 20; s.silStore = 0; this.refreshModel(); return 'Pusiste el silenciador'; }
      return 'No tienes silenciador';
    }

    // Se rompe el arma cuerpo a cuerpo que llevas colgada: vuelves a golpear con la navaja
    breakMelee() {
      this.hands[0] = null;
      this._meleeOut = false; this.meleeOutW = null;
      if (this.prev === 0) this.prev = -1;
      this.refreshModel();
    }
    // El arma en las manos se rompe: la cuerpo a cuerpo desaparece (las de fuego no se rompen nunca)
    breakCurrent() {
      if (this.cur < 0) return;
      const s = this.hands[this.cur];
      if (G.Weapons.isGun(G.Weapons.get(s.id))) return;
      this.hands[this.cur] = null;
      this.prev = -1;
      this.equip(-1);
    }

    // Datos de la cobertura para la pose: lado de la pared (1 = a la izquierda), asomarse, apuntar
    coverPose() {
      const cv = this.cover;
      if (!cv && this.coverAmt < 0.02) return null;
      const p = this._cp || (this._cp = {});
      p.amt = this.coverAmt;
      if (cv) {
        const lx = Math.cos(this.facing), lz = -Math.sin(this.facing);
        p.wall = (-cv.nx * lx - cv.nz * lz) >= 0 ? 1 : -1;
        p.peek = cv.corner && this.moveAmt < 0.3 ? 1 : 0;
        p.low = cv.low;
        p.aim = this.aiming ? 1 : 0;
      }
      return p;
    }

    // ---------- Daño y curación ----------
    damage(amount, cause) {
      amount *= 100 / this.perks.hp;              // (más vida: Di' Arco aguanta un poco más cada golpe)
      if (G.Run && G.Run.daily && !G.Run.inRefuge) amount *= G.Run.DAILY.hurt;      // (partida diaria: duele más)
      this.health = Math.max(0, this.health - amount);
      this.hurt = 0.4;
      if (this.health <= 0 && !this.dead) { this.die(cause || 'Te mataron los infectados.'); return; }
      // un golpe corta el vendaje o el crafteo a medias
      if (this.action && (this.action.kind === 'bandage' || this.action.kind === 'pack')) this.action = null;
    }

    // Modo arcade: sin infección ni sangrado. Las heridas solo quitan vida
    wound(type) {
      this.wounds++;
      this.damage(type === 'rasguño' ? 4 : type === 'laceración' ? 9 : 14);
    }
    infect() { /* sin infección en este modo */ }

    get bleeding() { return false; }
    get needsCare() { return false; }

    // Vendarse (un tipo de venda): unos 2 s, quieta; recupera BANDAGE_HEAL de vida en pocos segundos
    startBandage(kind) {
      kind = 'venda';
      if (this.busy() || this.dead) return 'Ahora no puedes';
      if (!this.items.venda) return 'No tienes vendas';
      if (this.health + this.heal >= 99) return 'No lo necesitas';
      if (this.stance === 'prone') this.stance = 'crouch';
      this.action = { kind: 'bandage', item: kind, t: 0, dur: 2.0, impact: 0.92, face: this.facing, done: false };
      return null;
    }
    // Fabricar una venda: 2 botellas de alcohol + 1 trapo (desde la mochila o los bolsillos)
    craft(recipe) {
      if (recipe === 'flecha_exp') {
        // flecha explosiva: una flecha, una botella de alcohol y un trapo
        if (this.ammo.flecha < 1) return 'Te falta una flecha';
        if (this.items.alcohol < 1) return 'Te falta alcohol';
        if (this.items.trapo < 1) return 'Te falta un trapo';
        if (this.ammo.flecha_exp >= this.ammoCap('flecha_exp')) return 'No te caben más flechas explosivas';
        this.ammo.flecha--; this.items.alcohol--; this.items.trapo--; this.ammo.flecha_exp++;
        return null;
      }
      if (recipe === 'molotov') {
        // molotov: alcohol y un trapo (lo mismo que gasta una venda: o te curas o la fabricas)
        if (this.items.alcohol < 1) return 'Te falta alcohol';
        if (this.items.trapo < 1) return 'Te falta un trapo';
        if (this.items.molotov >= MOLOTOV_CAP) return 'No te caben más molotovs';
        this.items.alcohol--; this.items.trapo--; this.items.molotov++;
        this.refreshModel();
        return null;
      }
      if (recipe === 'mina') {
        // mina: 1 polvo reactivo (el explosivo) + 1 clavos (la metralla)
        if (this.items.polvo < 1) return 'Te falta polvo reactivo';
        if (this.items.clavos < 1) return 'Te faltan clavos';
        if (this.itemRoom('mina') <= 0) return 'No te caben más minas';
        this.items.polvo--; this.items.clavos--; this.items.mina++;
        return null;
      }
      if (recipe === 'humo') {
        // bomba de humo: 1 polvo reactivo + 1 trapo
        if (this.items.polvo < 1) return 'Te falta polvo reactivo';
        if (this.items.trapo < 1) return 'Te falta un trapo';
        if (this.itemRoom('humo') <= 0) return 'No te caben más bombas de humo';
        this.items.polvo--; this.items.trapo--; this.items.humo++;
        return null;
      }
      if (recipe !== 'venda') return 'Receta desconocida';
      if (this.items.alcohol < 2 || this.items.trapo < 1) return 'Te faltan materiales';
      if (this.itemRoom('venda') <= 0) return 'No te caben más vendas';
      this.items.alcohol -= 2; this.items.trapo--; this.items.venda++;
      return null;
    }
    finishBandage() {
      if (!this.items.venda) return null;
      this.items.venda--;
      this.heal += BANDAGE_HEAL;
      return 'Te vendaste: recuperas vida';
    }

    // Registrar un mueble: agachado si es bajo, de pie si es alto
    startSearch(f) {
      if (this.busy() || this.dead) return;
      const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
      const low = f.h < 1.0 && !G.Furniture.T[f.type].vehicle;
      this.action = { kind: 'search', t: 0, dur: low ? 1.35 : 1.15, impact: 0.82, face: Math.atan2(cx - this.pos.x, cz - this.pos.z), target: f, low, done: false };
      if (this.stance === 'prone') this.stance = 'crouch';
      G.World.emit(this.pos.x, this.pos.z, 1.5 * this.noiseMul, this.lv);
    }

    // Saltito (botón Saltar cuando no hay nada que trepar)
    jump() {
      if (this.busy() || this.hop || this.dead || this.hostage) return;
      if (this.stance !== 'stand') { this.setStance('stand'); return; }
      this.hop = { t: 0 };
      this.stamina = Math.max(0, this.stamina - 0.06);
      this.vel.x *= 0.7; this.vel.z *= 0.7;
    }

    // ---------- Actualización ----------
    update(dt, input, cam) {
      if (this.infinite) this.keepStock();
      // el hongomorfo te soltó (murió o lo interrumpieron) antes de terminar: vuelves al suelo
      if (this.bossKill && !this.dead && (!this.bossKill.z.alive || this.bossKill.z.state !== 'hkill')) { this.bossKill = null; this.lifted = null; this.climbLift = 0; }
      if (this.dead) return;
      const f = cam.forward(), r = cam.right();
      const mx = input.move.x, my = input.move.y;
      const mag = Math.min(1, Math.hypot(mx, my));
      // tras el ataque en carrera sigue corriendo en cuanto lo aparta (si empujas el joystick)
      if (this.action && this.action.kind === 'runKill' && this.action.t > 0.86 && mag > 0.3) this.action = null;
      const wantsMove = mag > 0.12 && !this.climb && !this.dodging && !this.struggle && !this.lifted && !(this.action && (this.action.kind === 'finisher' || this.action.exec));

      const held = !!this.struggle || !!this.lifted || !!(this.action && this.action.exec);    // forcejeando, en vilo o rematando
      // con un rehén: de pie, despacio y mirando hacia donde apuntas
      const hostage = !!this.hostage;
      if (hostage && this.stance !== 'stand') this.stance = 'stand';
      if (input.crouch && !held && !this.healing && !hostage) this.toggleCrouch();
      if (input.prone && !held && !this.healing && !hostage) this.toggleProne();
      // vendándote: avanza la venda; agachada siempre
      if (this.healing) {
        const hl = this.healing;
        if (!this.holdingVenda || this.dead || this.struggle || this.climb || held) this.stopHeal();
        else {
          this.stance = 'crouch';
          hl.t += dt / HEAL_TIME;
          if (hl.t >= 1) {
            this.items.venda--;
            this.heal += BANDAGE_HEAL;
            this.stopHeal();
            if (G.Combat && G.Combat.msg) G.Combat.msg('Te vendaste: recuperas vida', 'good');
            // sin más vendas, vuelve el arma de antes
            if (!this.items.venda) { const b = this.prev; this.equip(b >= 0 && this.hands[b] ? b : -1); }
          }
        }
      }
      // pecho a tierra se puede apuntar con las armas de fuego (no con el arco ni con lo que se lanza)
      const proneNoAim = this.prone && (this.weapon.gun === 'bow' || this.holdingThr);
      if (proneNoAim && this.aiming) this.aiming = false;
      // con la botella en la mano, mantener atacar también apunta (al soltar la lanza)
      const thrHold = !!(this.thrPress && this.holdingThr && performance.now() - this.thrPress.t0 > THR_HOLD_MS);
      const bowHold = !!(this.bowPress && this.weapon.gun === 'bow' && performance.now() - this.bowPress.t0 > THR_HOLD_MS);
      const aimIn = !!input.aim || thrHold || bowHold;
      if (aimIn && !this._aimPrev) {
        this.reloadNoAim = false;
        // con un arma cuerpo a cuerpo (o la navaja) no se apunta: desenfunde rápido del último arma de fuego.
        // Con la botella en la mano, el botón de apuntar saca el arma que tenías antes (o la pistola);
        // con la botella se apunta manteniendo Atacar
        if (this.holdingThr) { if (input.aim) { this.wantDraw = true; this.drawFromThr = true; } }
        else if (!G.Weapons.isGun(this.weapon)) { this.wantDraw = true; this.drawFromThr = false; }
      }
      if (!aimIn) this.wantDraw = false;
      if (this.wantDraw && !this.busy() && !held) {
        this.wantDraw = false;
        let gi = -1;
        if (this.drawFromThr) {
          const ok = (i) => i >= 0 && this.hands[i] && G.Weapons.isGun(G.Weapons.get(this.hands[i].id));
          gi = ok(this.prev) ? this.prev : (ok(1) ? 1 : -1);
          this.drawFromThr = false;
        }
        if (gi < 0) gi = this.gunSlot();
        if (gi >= 0) this.equip(gi);
        else {
          if (G.Combat && G.Combat.msg) G.Combat.msg('No tienes armas de fuego', 'warn');
          if (G.Input && G.Input.setAim) G.Input.setAim(false);
        }
      }
      this._aimPrev = aimIn;
      if (!(this.gun && this.gun.reload)) this.reloadNoAim = false;
      this.aiming = aimIn && (G.Weapons.isGun(this.weapon) || (this.holdingThr && thrHold)) && !this.reloadNoAim && !this.climb && !proneNoAim && !held;
      if (!this.aiming || !this.weapon.scope || this.perks.noScope) this.scope = false;

      // correr te levanta del suelo; agachado, corres agachado (más rápido que caminar, menos ruido que de pie)
      if (wantsMove && input.run && this.stance === 'prone' && this.stamina > 0.1) this.stance = 'stand';
      const canRun = this.stamina > 0.04 && !this.action && this.stance !== 'prone' && this.proneAmt < 0.2;
      this.running = wantsMove && input.run && canRun && !this.healing && !hostage;
      this.crouchRun = this.running && this.stance === 'crouch';

      // dirección en el mundo relativa a la cámara (en cualquier dirección: omni)
      let wx = f.x * -my + r.x * mx;
      let wz = f.z * -my + r.z * mx;
      const wl = Math.hypot(wx, wz) || 1;
      wx /= wl; wz /= wl;

      let speed;
      if (this.prone || this.proneAmt > 0.5) speed = PRONE_WALK;
      else if (this.running) speed = this.crouchRun ? CROUCH_RUN : (this.aiming ? AIM_RUN : RUN);
      else if (this.aiming) speed = AIM_WALK;
      else if (this.crouching) speed = CROUCH_WALK;
      else speed = WALK;
      speed *= this.perks.run;                 // (Di' Arco: algo más rápida; Paula, más lenta)
      if (this.running) speed *= this.perks.sprint;
      if (this.healing) speed *= this.perks.healMove;      // (Di' Arco se mueve más rápido mientras se venda)
      // de espaldas se camina un poco más despacio
      if (!this.running && wantsMove && Math.abs(U.angleDiff(Math.atan2(wx, wz), Math.atan2(f.x, f.z))) > 1.75) speed *= 0.8;
      if (this.action) {
        const ak0 = this.action.kind;
        speed *= (ak0 === 'grab' || ak0 === 'search' || ak0 === 'bandage' || ak0 === 'pack' || ak0 === 'shoveoff' || this.action.exec) ? 0
          : ((ak0 === 'stomp' || ak0 === 'floor') ? 0.1 : ((ak0 === 'throw' || ak0 === 'pickup' || ak0 === 'pickupHi') ? 0.45 : 0.35));
      }
      if (this.blow && this.blow.t < 0.6) speed *= 0.3;
      // con el arco tenso se camina más despacio
      if (this.gun.draw > 0.3) speed *= 0.8;
      if (hostage) speed = Math.min(speed, 1.45);
      speed *= wantsMove ? mag : 0;
      // saltando no se gana velocidad: en el aire vas más despacio (y saltar cansa un poco)
      if (this.hop) speed *= 0.6;
      // cuesta arriba se va más despacio (cuanto más empinada, más)
      if (speed > 0 && !this.lv) {
        const g0 = G.World.groundY(this.pos.x, this.pos.z, 0);
        const grade = (G.World.groundY(this.pos.x + wx * 0.6, this.pos.z + wz * 0.6, 0) - g0) / 0.6;
        if (grade > 0.08) speed *= Math.max(0.5, 1 - (grade - 0.08) * 1.2);
      }

      // cobertura: agachado junto a una pared o valla te pegas a ella y te mueves de costado
      this.updateCover(dt, wantsMove ? wx : 0, wantsMove ? wz : 0, f);
      const cv = this.cover;
      let tvx = wx * speed, tvz = wz * speed;
      if (cv) {
        // sin alejarse de la pared: solo el movimiento a lo largo, y un leve tirón hasta pegarse
        let along = tvx * cv.tx + tvz * cv.tz;
        // al llegar a la esquina se queda asomado; si sigues empujando un momento, sale
        if (cv.corner && along * cv.side > 0 && cv.endDist < 0.3) {
          cv.pushT += dt;
          if (cv.pushT < 0.5) along = 0;
        } else cv.pushT = 0;
        const pull = (cv.d - 0.34) * -2.5;
        tvx = cv.tx * along + cv.nx * pull;
        tvz = cv.tz * along + cv.nz * pull;
      }

      // inercia: acelera y frena en unas décimas de segundo
      const k = 1 - Math.exp(-dt * (speed > 0.01 ? ACCEL : DECEL));
      this.vel.x += (tvx - this.vel.x) * k;
      this.vel.z += (tvz - this.vel.z) * k;

      if (this.climb) {
        this.updateClimb(dt);
        this.vel.x = this.vel.z = 0;
      } else if (this.dodging) {
        // esquiva: unos 1,6 m que arrancan rápido y frenan al final
        const d = this.dodging;
        const t0 = Math.min(1, d.t);
        d.t += dt / d.dur;
        const t1 = Math.min(1, d.t);
        const ease = (t) => 1 - (1 - t) * (1 - t);
        const step = (ease(t1) - ease(t0)) * DODGE_DIST * this.perks.dodge;      // (Di' Arco: más larga y rápida)
        G.World.move(this.pos, d.dx * step, d.dz * step, RADIUS, this.lv, this.elev);
        const v = step / Math.max(dt, 1e-4);
        this.vel.x = d.dx * v * 0.3; this.vel.z = d.dz * v * 0.3;
        if (d.t >= 1) { this.dodging = null; this.dodgeAfter = 0.3 / this.perks.dodgeSpeed; }
      } else if (this.action && this.action.kind === 'finisher' && this.action.goto) {
        // el remate te coloca junto al zombi caído
        const g = this.action.goto;
        const kk = Math.min(1, dt * 9);
        G.World.move(this.pos, (g.x - this.pos.x) * kk, (g.z - this.pos.z) * kk, RADIUS, this.lv, this.elev);
        this.vel.x = this.vel.z = 0;
      } else {
        G.World.move(this.pos, this.vel.x * dt, this.vel.z * dt, RADIUS, this.lv, this.elev);
        // retroceso por un golpe recibido
        if (this.blowKb) {
          const k = this.blowKb;
          G.World.move(this.pos, k.x * dt, k.z * dt, RADIUS, this.lv, this.elev);
          const fk = Math.max(0, 1 - dt * (k.decay || 6)); k.x *= fk; k.z *= fk;
          if (Math.abs(k.x) + Math.abs(k.z) < 0.02) this.blowKb = null;
        }
        // paso adelante al golpear (si el zombi está algo lejos)
        const st = this.action && this.action.step;
        if (st) {
          const fr = U.smooth(U.clamp((this.action.t - 0.1) / 0.35, 0, 1)) * st.len;
          const dd = fr - st.done;
          if (dd > 0) {
            G.World.move(this.pos, Math.sin(this.action.face) * dd, Math.cos(this.action.face) * dd, RADIUS, this.lv, this.elev);
            st.done = fr;
          }
        }
      }

      // pelea: tiempo desde el último golpe cuerpo a cuerpo (la cámara se pega y, sin arma, se levanta la guardia)
      const ak = this.action && this.action.kind;
      if (ak && MELEE_KINDS[ak]) this.fightT = 0; else this.fightT = (this.fightT == null ? 99 : this.fightT) + dt;
      const guardOn = this.weapon.cat === 'none' && this.fightT < 2.4 && !this.running && !this.prone && this.crouchAmt < 0.35 && !this.climb;
      this.guardAmt = (this.guardAmt || 0) + ((guardOn ? 1 : 0) - (this.guardAmt || 0)) * Math.min(1, dt * 8);

      const vlen = Math.hypot(this.vel.x, this.vel.z);
      const moveYaw = Math.atan2(this.vel.x, this.vel.z);
      const camYaw = Math.atan2(f.x, f.z);
      // orientación: al apuntar o atacar el cuerpo mira a la cámara y las piernas van a cualquier lado;
      // si no, el cuerpo gira hacia donde te mueves
      if (this.climb || this.dodging) { /* la fija updateClimb; al esquivar se mantiene */ }
      else if (this.struggle) {
        // forcejeando: de cara al infectado que te tiene agarrada
        const z = this.struggle.z;
        this.facing = U.turnToward(this.facing, Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z), 14 * dt);
      } else if (this.cover && !this.action && !this.aiming) {
        // pegado a la pared: mira a lo largo de ella, hacia donde vas o hacia donde mira la cámara
        this.facing = U.turnToward(this.facing, Math.atan2(this.cover.tx * this.cover.side, this.cover.tz * this.cover.side), 10 * dt);
      } else if (this.hostage) {
        this.facing = U.turnToward(this.facing, camYaw, 6 * dt);
      } else if (this.action) {
        this.facing = U.turnToward(this.facing, this.action.face != null ? this.action.face : camYaw, 14 * dt);
      } else if (this.aiming) {
        this.facing = U.turnToward(this.facing, camYaw, (this.prone ? 6 : 14) * dt);
      } else if (vlen > 0.2) {
        // Caminando hacia atrás (respecto a la cámara) el personaje no se gira: camina de espaldas.
        // Hacia delante o a los lados gira hacia donde va. Corriendo siempre mira hacia donde corre.
        let want = moveYaw;
        const back = Math.abs(U.angleDiff(moveYaw, camYaw)) > 1.75;
        if (back && !this.running && !this.prone) want = moveYaw + Math.PI;
        this.facing = U.turnToward(this.facing, want, (this.prone ? 3 : (this.running ? 9 : 10)) * dt);
      }
      this.moveRel = vlen > 0.2 ? U.angleDiff(moveYaw, this.facing) : 0;

      if (this.dodgeAfter > 0) this.dodgeAfter -= dt;
      // pruebas de desarrollador: munición sin fin
      if (G.DEV) for (const a in this.ammo) { const cap = this.ammoCap(a); if (this.ammo[a] < cap) this.ammo[a] = cap; }
      if (this.blow) { this.blow.t += dt / this.blow.dur; if (this.blow.t >= 1) this.blow = null; }
      this.drawOK = true;
      if (this.drawA) {
        const d = this.drawA;
        d.time += dt;
        // la mano llega a su sitio con lo que llevaba: lo suelta ahí (sin nada que sacar, ya está libre)
        if (!d.stowed && d.time >= d.hold * STOW_AT) { d.stowed = true; if (!d.drawDur) d.swapped = true; this.refreshModel(); }
        if (d.stowed && !d.swapped && d.time - d.hold >= d.drawDur * DRAW_SWAP) { d.swapped = true; this.refreshModel(); }
        if (d.time >= d.hold + (d.drawDur || RET_T)) this.drawA = null;
      }
      // con algo en la mano sin usarlo ni apuntar (y sin nadie persiguiéndote) un rato, lo guarda solo
      const using = this.aiming || this.action || this.hostage || this.healing || this.healPress || this.thrPress || this.bowPress || this.gun.reload || this.gun.wantReload || this.gun.cycle || this.dodging || this.struggle || this.lifted || this.climb;
      if (this.cur === -1 || using || this.drawA || (this.lf && this.lf.alert > 0.4) || (G.HUD && G.HUD.selecting)) this.idleArmT = 0;
      else {
        this.idleArmT = (this.idleArmT || 0) + dt;
        if (this.idleArmT > AUTO_HOLSTER && !this.busy()) { this.idleArmT = 0; this.equip(-1); }
      }
      // resistencia

      // ruido (en la hierba alta, al moverte de pie o agachado, se oye un leve roce)
      const moving = vlen > 0.3;
      this.inGrass = G.World.tallAt ? G.World.tallAt(this.pos.x, this.pos.z, this.lv) : false;
      if (this.crouchRun) { this.noise = NOISE_CROUCH_RUN + (this.inGrass ? 1 : 0); this.noiseLevel = 1; }
      else if (this.running) { this.noise = NOISE_RUN; this.noiseLevel = 2; }
      else if (moving && this.stance === 'stand') { this.noise = (vlen > 2.4 ? 3.5 : NOISE_WALK) + (this.inGrass ? 1 : 0); this.noiseLevel = 1; }
      else if (this.prone) { this.noise = 0; this.noiseLevel = this.inGrass ? 5 : 4; }
      else if (this.crouching) { this.noise = moving && this.inGrass ? 1.2 : 0; this.noiseLevel = this.inGrass ? 5 : 3; }
      else { this.noise = 0; this.noiseLevel = 0; }

      // heridas: el sangrado dura un rato si no te vendas
      if (this.heal > 0) {
        // venda: la vida sube en unos segundos
        const h = Math.min(this.heal, 14 * dt);
        this.heal -= h; this.health = Math.min(100, this.health + h);
        if (this.health >= 100) this.heal = 0;
      } else if (this.health < 50 && this.health > 0) {
        // sin tratamiento la vida solo vuelve sola hasta la mitad, despacio
        this.health = Math.min(50, this.health + 0.15 * dt);
      }
      this.hurt = Math.max(0, this.hurt - dt);

      // salto
      if (this.hop) {
        this.hop.t += dt / 0.5;
        this.hopLift = Math.sin(Math.PI * Math.min(1, this.hop.t)) * 0.32;
        if (this.hop.t >= 1) { this.hop = null; this.hopLift = 0; }
      }
      // por los aires (manotazo del hongomorfo): sube y baja; si choca contra una pared se estampa y cae
      if (this.fly) {
        const f = this.fly;
        f.t += dt;
        const u = Math.min(1, f.t / f.dur);
        this.hopLift = Math.sin(Math.PI * u) * f.h * (f.hit ? Math.max(0, 1 - (f.t - f.hitT) / 0.18) : 1);
        const mv = Math.hypot(this.pos.x - f.lx, this.pos.z - f.lz), k = this.blowKb;
        const want = k ? Math.hypot(k.x, k.z) * dt : 0;
        if (!f.hit && f.t > 0.06 && want > 0.04 && mv < want * 0.3) {
          f.hit = true; f.hitT = f.t; this.blowKb = null;
          if (G.Camera.shake) G.Camera.shake(0.55);
          if (G.Audio) G.Audio.play('tackle', { vol: 0.8 });
        }
        f.lx = this.pos.x; f.lz = this.pos.z;
        if (u >= 1 || (f.hit && f.t - f.hitT > 0.18)) { this.fly = null; this.hopLift = 0; }
      }

      const ref = this.prone ? PRONE_WALK : REF_AMT;
      this.moveAmt += (Math.min(1, vlen / ref) - this.moveAmt) * Math.min(1, dt * 12);
      this.speedNow = vlen;
      // metros que llevas corriendo sin parar (el ataque en carrera necesita impulso)
      this.runDist = this.running && vlen > 2 ? (this.runDist || 0) + vlen * dt : 0;
      this.life(dt, vlen);
      this.time = (this.time || 0) + dt;
      // pasos por segundo según la velocidad (de paseo a carrera a fondo)
      const rate = this.prone ? 5 : Math.PI * 2 * (0.62 + 0.21 * Math.min(6, vlen));
      this.phase += dt * rate * (this.moveAmt > 0.05 ? 1 : 0);
      const finisher = this.action && this.action.kind === 'finisher';
      const coverRise = this.cover && this.cover.low && this.aiming ? 0.45 : 1;
      this.crouchAmt += ((this.crouching && !this.climb && !finisher ? coverRise * (this.crouchRun ? 0.55 : 1) : 0) - this.crouchAmt) * Math.min(1, dt * 9);
      this.proneAmt += ((this.prone && !this.climb ? 1 : 0) - this.proneAmt) * Math.min(1, dt * 5);
      // en la escalera se cambia de planta a mitad de camino
      this.lv = G.World.levelAt(this.pos.x, this.pos.z, this.lv);
      // encima de los contenedores: si sales del borde, caes (sin daño hasta unos 4,5 m)
      this.updateElev(dt);
      const gy = G.World.groundY(this.pos.x, this.pos.z, this.lv) + this.elev;
      if (this.elev > 0 || this.falling || this.landT > 0) this.y = gy;
      else this.y += (gy - this.y) * Math.min(1, dt * (G.World.stairAt(this.pos.x, this.pos.z) ? 20 : 12));
      if (this.health <= 0 && !this.dead) this.die('Te mataron los infectados.');
    }

    // ---------- Techos de los contenedores: caída y aterrizaje ----------
    updateElev(dt) {
      if (this.landT > 0) this.landT = Math.max(0, this.landT - dt);
      if (this.lv || this.climb) return;
      const deck = G.World.standTop ? G.World.standTop(this.pos.x, this.pos.z, 0) : 0;
      if (!this.falling && this.elev > deck + 0.2) { this.falling = true; this.fallV = 0; this.fallFrom = this.elev; }
      if (!this.falling) { if (this.elev > 0) this.elev = deck; return; }
      this.fallV += 9.8 * dt;
      this.elev = Math.max(deck, this.elev - this.fallV * dt);
      if (this.elev <= deck + 1e-3) {
        const drop = (this.fallFrom || 0) - deck;
        this.falling = false; this.fallV = 0; this.elev = deck;
        this.landT = drop > 1.5 ? 0.35 : 0.15;
        if (G.Camera.shake) G.Camera.shake(Math.min(0.35, drop * 0.06));
        if (G.Audio) G.Audio.play('land', { x: this.pos.x, z: this.pos.z, lv: this.lv });
        G.World.emit(this.pos.x, this.pos.z, 2 + drop * 1.2, this.lv);
        if (drop > 4.5 && !this.dead) {
          this.damage(Math.round((drop - 4) * 12), 'Te caíste desde muy alto.');
          if (this.health <= 0) this.die('Te caíste desde muy alto.');
        }
      }
    }

    // ---------- Trepar a un contenedor (o desde uno al de encima) ----------
    // t: { x, z (punto de agarre en el borde), tx, tz (dónde quedas arriba), h (altura del techo) }
    startLedge(t) {
      if (this.busy() || this.dead || this.struggle) return false;
      if (this.stance !== 'stand') this.stance = 'stand';
      const face = Math.atan2(t.tx - this.pos.x, t.tz - this.pos.z);
      if (t.over) {
        // saltar por encima (un muro bajo, una barrera, unos palés): apoya una mano y pasa al otro lado
        // (jump: obstáculo no más alto que el personaje: la animación de salto)
        this.climb = { x0: this.pos.x, z0: this.pos.z, x1: t.tx, z1: t.tz, t: 0, dur: 0.5 + t.lift * 0.35, h: t.lift, face, jump: t.lift <= JUMP_MAX };
        this.action = null; this.aiming = false;
        G.World.emit(this.pos.x, this.pos.z, 2 * this.noiseMul, this.lv);
        return true;
      }
      this.climb = {
        ledge: true, x0: this.pos.x, z0: this.pos.z, xm: t.x, zm: t.z, x1: t.tx, z1: t.tz, t: 0,
        dur: 0.6 + (t.h - this.elev) * 0.32, h0: this.elev, h1: t.h, face, jump: t.h - this.elev <= JUMP_MAX
      };
      this.action = null;
      this.aiming = false;
      return true;
    }

    // ---------- Cobertura ----------
    updateCover(dt, mx, mz, camF) {
      // desactivada de momento (trababa al personaje); el código queda para retomarla
      if (!COVER_ON) { this.cover = null; this.coverAmt = 0; return; }
      const W = G.World;
      const ok = this.stance === 'crouch' && !this.climb && !this.dodging && !this.running && !this.dead &&
        !(this.action && (this.action.kind === 'search' || this.action.kind === 'pack' || this.action.kind === 'finisher' || this.action.kind === 'grab'));
      let cv = this.cover;
      if (!ok) cv = null;
      else {
        const near = W.coverNear(this.pos.x, this.pos.z, this.lv, cv ? 0.75 : 0.55);
        if (!near) cv = null;
        else {
          // alejarse de la pared con el joystick te despega
          const away = mx * near.nx + mz * near.nz;
          if (cv && away > 0.6) cv = null;
          else if (!cv && away > 0.2) cv = null;
          else {
            const prev = cv;
            cv = near;
            // hacia qué lado miras a lo largo de la pared: el de tu movimiento o el de la cámara
            const along = mx * near.tx + mz * near.tz;
            const camA = camF.x * near.tx + camF.z * near.tz;
            cv.side = Math.abs(along) > 0.2 ? Math.sign(along) : (prev && prev.o === near.o ? prev.side : (camA >= 0 ? 1 : -1));
            // esquina: la pared se acaba a menos de medio metro hacia ese lado
            const s = near.o === 'N' ? near.cx : near.cz;
            cv.corner = !W.coverAlong(near, s + cv.side * 0.45, this.lv);
            cv.endDist = cv.corner ? Math.abs((cv.side > 0 ? Math.floor(s + 0.45) : Math.ceil(s - 0.45)) - s) : 9;
            cv.pushT = prev ? prev.pushT || 0 : 0;
          }
        }
      }
      this.cover = cv;
      this.coverAmt += ((cv ? 1 : 0) - this.coverAmt) * Math.min(1, dt * 8);
    }

    // Estado del arma de fuego para la animación
    gunPose(w) {
      const g = this.gun, gp = this._gp || (this._gp = {});
      gp.kind = w.anim || w.gun; gp.aim = g.aim; gp.recoil = g.recoil;
      gp.cycle = g.cycle ? Math.min(1, g.cycle.t) : -1;
      gp.rw = g.rw || 0; gp.ru = g.ru || 0; gp.draw = g.draw; gp.arrow = !!g.arrow;
      return gp;
    }

    // Saltar por una ventana abierta o una valla
    startClimb(ref, kind) {
      const W = G.World;
      if (this.stance !== 'stand') this.stance = 'stand';
      const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x;
      const mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
      const nx = ref.o === 'N' ? 0 : 1, nz = ref.o === 'N' ? 1 : 0;
      const side = (this.pos.x - mx) * nx + (this.pos.z - mz) * nz > 0 ? 1 : -1;
      const tx = mx - nx * side * 0.6, tz = mz - nz * side * 0.6;
      if (W.circleBlocked(tx, tz, RADIUS, this.lv, this.elev)) return false;
      this.climb = {
        x0: this.pos.x, z0: this.pos.z, x1: tx, z1: tz, t: 0,
        dur: kind === 'fence' ? 0.85 : 1.2, h: kind === 'fence' ? 0.7 : 0.95,
        face: Math.atan2(-nx * side, -nz * side), jump: true
      };
      this.action = null;
      return true;
    }

    // Saltar abajo desde el piso de arriba (barandilla de un balcón o ventana): pasa por encima y cae al suelo
    startDrop(ref) {
      const W = G.World;
      if (this.busy() || this.dead || this.struggle) return false;
      const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
      const nx = ref.o === 'N' ? 0 : 1, nz = ref.o === 'N' ? 1 : 0;
      const side = (this.pos.x - mx) * nx + (this.pos.z - mz) * nz > 0 ? 1 : -1;
      const tx = mx - nx * side * 0.65, tz = mz - nz * side * 0.65;
      if (W.circleBlocked(tx, tz, RADIUS, 0, true)) return false;
      if (this.stance !== 'stand') this.stance = 'stand';
      const fromY = W.groundY(this.pos.x, this.pos.z, this.lv);
      this.climb = { x0: this.pos.x, z0: this.pos.z, x1: tx, z1: tz, t: 0, dur: 0.75, h: 0.7, face: Math.atan2(-nx * side, -nz * side), drop: fromY };
      this.action = null; this.aiming = false;
      G.World.emit(this.pos.x, this.pos.z, 2 * this.noiseMul, this.lv);
      return true;
    }
    // Entrar por una ventana del piso de arriba desde el techo de un vehículo
    startEnter(ref) {
      const W = G.World;
      if (this.busy() || this.dead || this.struggle) return false;
      const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
      const nx = ref.o === 'N' ? 0 : 1, nz = ref.o === 'N' ? 1 : 0;
      const side = (this.pos.x - mx) * nx + (this.pos.z - mz) * nz > 0 ? 1 : -1;
      const tx = mx - nx * side * 0.6, tz = mz - nz * side * 0.6;
      if (!W.isIndoor(Math.floor(tx), Math.floor(tz), 1) || W.circleBlocked(tx, tz, RADIUS, 1)) return false;
      if (this.stance !== 'stand') this.stance = 'stand';
      this.climb = { x0: this.pos.x, z0: this.pos.z, x1: tx, z1: tz, t: 0, dur: 1.1, h: 0.6, face: Math.atan2(-nx * side, -nz * side), enter: true, jump: true };
      this.action = null; this.aiming = false;
      return true;
    }

    updateClimb(dt) {
      const c = this.climb;
      c.t += dt / c.dur;
      const t = Math.min(1, c.t);
      if (c.ledge) {
        // se pega a la pared, salta y se agarra al borde (sube), y pasa las piernas por encima (avanza)
        const a = U.smooth(U.clamp(t / 0.25, 0, 1)), up = U.smooth(U.clamp((t - 0.15) / 0.55, 0, 1)), over = U.smooth(U.clamp((t - 0.6) / 0.4, 0, 1));
        this.pos.x = U.lerp(U.lerp(c.x0, c.xm, a), c.x1, over);
        this.pos.z = U.lerp(U.lerp(c.z0, c.zm, a), c.z1, over);
        this.elev = U.lerp(c.h0, c.h1, up);
        this.facing = U.turnToward(this.facing, c.face, 14 * dt);
        this.climbLift = 0;
        if (c.t >= 1) { this.climb = null; this.elev = c.h1; G.World.emit(this.pos.x, this.pos.z, 2 * this.noiseMul, this.lv); }
        return;
      }
      this.pos.x = U.lerp(c.x0, c.x1, U.smooth(t));
      this.pos.z = U.lerp(c.z0, c.z1, U.smooth(t));
      this.facing = U.turnToward(this.facing, c.face, 12 * dt);
      this.climbLift = Math.sin(Math.PI * t) * c.h;
      if (c.t >= 1) {
        this.climb = null; this.climbLift = 0;
        // al pasar: abajo (cae desde la altura del piso) o arriba (ya dentro del piso de arriba)
        if (c.drop != null) { this.lv = 0; this.elev = Math.max(0, c.drop - G.World.groundY(this.pos.x, this.pos.z, 0)); }
        if (c.enter) { this.lv = 1; this.elev = 0; this.falling = false; }
      }
    }

    die(cause) {
      this.dead = true;
      this.deathCause = cause;
      this.deathT = 0;
      this.action = null;
      this.climb = null;
    }

    // Fase del gesto de guardar y sacar para la pose: 'hold' (lleva lo que tenía a su sitio), 'draw' (va a por
    // lo nuevo; from: venía de guardar otra cosa) o 'ret' (no había nada que sacar: el brazo vuelve)
    drawPose() {
      const d = this.drawA;
      if (!d) return null;
      const p = this._dp || (this._dp = {});
      if (d.time < d.hold) { p.phase = 'hold'; p.t = d.time / d.hold; p.src = d.hsrc; p.hsrc = null; p.stowAt = STOW_AT; }
      else if (d.drawDur) { p.phase = 'draw'; p.t = Math.min(1, (d.time - d.hold) / d.drawDur); p.src = d.src; p.hsrc = d.hold ? d.hsrc : null; }
      else { p.phase = 'ret'; p.t = Math.min(1, (d.time - d.hold) / RET_T); p.src = d.hsrc; p.hsrc = null; }
      return p;
    }

    // Pose y posición del modelo
    apply(dt) {
      const m = this.model;
      // apuntando en la esquina de una pared alta, el personaje sale de lado para disparar
      const cv = this.cover;
      const out = cv && !cv.low && cv.corner && this.aiming ? 0.42 : 0;
      this.aimOut = this.aimOut || { x: 0, z: 0 };
      const kk = Math.min(1, (dt || 0.016) * 10);
      this.aimOut.x += ((cv ? cv.tx * cv.side * out : 0) - this.aimOut.x) * kk;
      this.aimOut.z += ((cv ? cv.tz * cv.side * out : 0) - this.aimOut.z) * kk;
      m.root.position.set(this.pos.x + this.aimOut.x, this.y + (this.climbLift || 0) + (this.hopLift || 0), this.pos.z + this.aimOut.z);
      m.root.rotation.y = this.facing;
      if (this.dead) {
        this.deathT = Math.min(1, (this.deathT || 0) + (dt || 0) * 1.6);
        G.Models.poseZombie(m, { phase: 0, amt: 0, chase: false, armsUp: 0, reach: 0, stagger: 0, seed: 0, lean: 0, tilt: 0, dt });
        G.Models.poseFall(m, this.deathT, 1);
        return;
      }
      let a = this.action;
      // forcejeo, remates, lanzar y recoger: con un arma de fuego en la mano se guarda y sale la navaja
      const kl = !!(this.struggle || (a && (a.knifeSwap || a.kind === 'throw' || a.kind === 'pickup' || a.kind === 'pickupHi' || a.kind === 'shoveoff')));
      // guardando lo que tenía: la pose sigue siendo la de esa arma hasta soltarla en su sitio
      const dA = this.drawA, holding = !!(dA && !dA.stowed);
      const wNow = holding ? this.weaponAt(dA.from) : this.weapon;
      const gunHeld = G.Weapons.isGun(wNow) || !!(a && a.knifeSwap && !wNow.knife);
      // manos libres: la navaja solo sale para golpear (y se guarda enseguida)
      const bare = this.cur === -1 && !holding && !(dA && !dA.swapped);
      // (lo mismo con el arma cuerpo a cuerpo que llevas colgada: sale al golpear y vuelve a su sitio)
      const aw = a && a.weapon && !G.Weapons.isGun(a.weapon) && a.kind !== 'grab' ? a.weapon : null;
      // arma cuerpo a cuerpo recién recogida del suelo: sale en la mano desde que la agarra, sube con ella y
      // al terminar la lleva a su sitio (abajo, junto a la mochila) con el gesto de guardar
      const ph = this.pickHold;
      if (ph && (!a || (a.kind !== 'pickup' && a.kind !== 'pickupHi'))) {
        this.pickHold = null;
        if (this.hands[0] && this.cur === -1 && !this.drawA && !this.dead) {
          this.drawA = { time: 0, hold: HOLST_T, drawDur: 0, from: 0, hsrc: drawSrc(0, this), src: drawSrc(-1, this), stowed: false, swapped: false };
        }
      }
      const knifeUse = bare && !!(this.struggle || aw || this.pickHold);
      if (knifeUse) { this.knifeT = this.pickHold ? 0.05 : 0.35; this.meleeOutW = this.struggle ? G.Weapons.KNIFE : (this.pickHold ? this.pickHold.w : aw); } else if (this.knifeT > 0) this.knifeT -= dt || 0;
      const knifeOut = bare && (knifeUse || this.knifeT > 0);
      const outW = knifeOut ? (this.meleeOutW || G.Weapons.KNIFE) : null;
      const swapW = kl && gunHeld ? (aw || G.Weapons.KNIFE) : null;
      const w = bare && !knifeOut ? G.Weapons.FISTS : (outW || swapW || wNow);
      // el arma colgada que está en la mano no se ve en la espalda
      const mOut = !!this.hands[0] && ((outW && !outW.knife) || (swapW && !swapW.knife));
      if (mOut !== !!this._meleeOut) { this._meleeOut = mOut; G.Models.setBackWeapon(m, this.carried(this.handSlot), this.backpack); }
      // ladrillo o botella en la mano mientras lo lanza (después vuelve la navaja o el arma)
      let show = null;
      if (a && a.kind === 'throw' && a.t < (a.impact || 0.46)) show = a.item;
      else if (swapW) show = swapW.id;
      else if (knifeOut) show = outW.id;
      else if ((this.holdingThr || this.holdingVenda) && a && a.kind !== 'throw' && a.kind !== 'pickup' && a.kind !== 'pickupHi') show = 'navaja';
      if (show === 'navaja' && this.perks.fists) show = 'manos';      // (Booster no saca la navaja: remata a golpes)
      if (show) G.Models.setWeapon(m, show);
      else if (this._thrShown) this.refreshModel();
      this._thrShown = !!show;
      if (a && a.kind === 'pack') a = { kind: 'search', t: 0.3 + ((this.time || 0) * 0.07) % 0.45, low: true };
      G.Models.posePlayer(m, {
        phase: this.phase, amt: this.moveAmt, run: this.running, crouch: this.crouchAmt, prone: this.proneAmt,
        rel: this.moveRel, hop: this.hop ? Math.min(1, this.hop.t) : 0,
        cat: w.cat, two: (outW || swapW) ? (!(outW || swapW).knife && this.meleeTwo) : (bare ? false : (holding ? !!(dA.from >= 0 && this.hands[dA.from] && this.hands[dA.from].two) : (this.cur < -1 ? false : this.twoHanded))), aim: this.aiming || !!a, dt, time: this.time || 0,
        action: a ? a.kind : (this.healing ? 'bandage' : null), t: a ? Math.min(1, a.t) : (this.healing ? 0.1 + 0.78 * this.healing.t : 0),
        climb: this.climb ? Math.min(1, this.climb.t) : null,
        ledge: !!(this.climb && this.climb.ledge),
        jump: !!(this.climb && this.climb.jump),
        fall: this.falling ? Math.min(1, this.fallV / 6) : 0,
        land: this.landT,
        dodge: this.dodging ? Math.min(1, this.dodging.t) : null, dodgeRel: this.dodging ? this.dodging.rel : 0,
        gun: G.Weapons.isGun(w) && !this.bossKill ? this.gunPose(w) : null,
        pitch: G.Camera ? G.Camera.pitch + (G.Camera.kickOff || 0) - 0.14 : 0,
        grabKnife: !!(a && a.kind === 'grab' && a.knife),
        searchLow: !!(a && a.kind === 'search' && a.low),
        side: a && a.side ? a.side : 1,
        weaponCat: w.cat,
        guard: this.guardAmt || 0,
        speed: this.speedNow || 0, female: this.female,
        turn: this.lf ? this.lf.turn : 0, acc: this.lf ? this.lf.acc : 0,
        breath: this.lf ? this.lf.breath : 0, breathT: this.lf ? this.lf.bt : 0,
        look: this.lf ? this.lf.look : null, alert: this.lf ? this.lf.alert : 0, fidget: this.lf ? this.lf.fid : null,
        blow: this.blow ? { t: Math.min(1, this.blow.t), rel: this.blow.rel, bite: this.blow.bite, dur: this.blow.dur, react: this.blow.react, fl: this.blow.fl } : null,
        struggle: this.struggle ? { t: this.struggle.t, prog: this.struggle.prog } : (this.lifted && !this.bossKill ? { t: this.lifted.t, prog: 0.6 } : null),
        bossKill: this.bossKill ? { t: this.bossKill.t } : null,
        cover: this.coverPose(),
        draw: this.drawPose(),
        hostage: !!this.hostage,
        contact: this.contactPose(a, w),
        pick: a && (a.kind === 'pickup' || a.kind === 'pickupHi') && a.item ? a.item : null,
        aimAt: this.aiming && G.Weapons.isGun(w) && G.Guns && G.Guns.ray ? this.aimAtPoint() : null
      });
    }
  }

  // lo que necesita el contacto de los golpes y remates: el modelo del infectado al que va el golpe, el largo y
  // el tipo del arma que golpea, cuándo es el impacto y si el golpe va a entrar
  const _cp = { m: null, len: 0.3, blade: false, impact: 0.45, hitOK: true };
  Player.prototype.contactPose = function (a, w) {
    if (!a || !a.target || !a.target.model || a.target.model === this.model) return null;
    const ww = a.weapon && !G.Weapons.isGun(a.weapon) ? a.weapon : w;
    _cp.m = a.target.model;
    _cp.len = ww && ww.len ? ww.len : 0.2;
    _cp.blade = !!(ww && (ww.knife || ww.cat === 'sblade' || ww.cat === 'lblade' || ww.cat === 'axe' || ww.cat === 'spear'));
    _cp.impact = a.impact || 0.45;
    _cp.hitOK = a.willHit !== false;
    return _cp;
  };

  // el punto al que apunta la mira (para que el cañón vaya hacia él)
  const _ap = { x: 0, y: 0, z: 0 };
  Player.prototype.aimAtPoint = function () {
    const r = G.Guns.ray(this);
    if (!r || !r.o) return null;
    _ap.x = r.o.x + r.d.x * 14; _ap.y = r.o.y + r.d.y * 14; _ap.z = r.o.z + r.d.z * 14;
    return _ap;
  };

  G.Player = Player;
  G.Player.CHARS = CHARS;
})(window.Game = window.Game || {});
