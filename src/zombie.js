(function (G) {
  'use strict';

  const U = G.Util;
  const _re = new THREE.Euler(), _rv = new THREE.Vector3();

  // Zombis lentos. Ajusta estos valores para cambiar la dificultad.
  const SIGHT_RANGE = 16;
  const CROUCH_SIGHT = 6;        // a un jugador agachado solo lo ven hasta esta distancia
  const PRONE_SIGHT = 3.5;       // tumbado, aún más cerca
  const NOTICE_TIME = 0.75;      // segundos que tienen que mirarte para notarte agachado
  // De pie también tardan un poco en reconocerte (de cerca casi nada, de lejos más): mientras tanto se
  // paran, te miran y se acercan despacio. Si te escondes antes, van a investigar donde te vieron, muy lento
  const NOTICE_STAND = [0.9, 2.2];     // segundos de cerca y en el límite de la vista
  const ALERT_T = 0.65;                // el corredor se para y chilla antes de lanzarse
  const SUS_SPEED = 0.35;
  const ALERT_R = 16;                  // al chillar avisa a los que no te han visto hasta esta distancia
  const NOISE_SPEED = [1.3, 2.2];      // yendo hacia un ruido: caminante y corredor (decidido, sin trompicones)              // acercándose mientras te reconoce
  const SEARCH_SPEED = 0.7;            // investigando (a trompicones, se para y sigue)
  const HUNTER_SEARCH = 1.5;           // los de las oleadas saben más o menos dónde estás: van más decididos
  const FOV_HALF = 0.8;          // solo ven de frente (~92°)
  const WANDER_SPEED = 0.5;
  const INVESTIGATE_SPEED = 0.8;
  const CHASE_SPEED = 1.3;       // algo más lentos que el jugador caminando
  const REACH = 1.05;            // distancia a la que intentan agarrarte
  // Golpes (los puñetazos que antes daba el protagonista): gancho de derecha, gancho de izquierda y golpe
  // fuerte. imp: momento del golpe (fracción de la duración). Si el primero falla, el combo se corta
  const COMBO = [{ kind: 'punch1', dur: 0.72, imp: 0.42 }, { kind: 'punch2', dur: 0.62, imp: 0.42 }, { kind: 'punch3', dur: 1.05, imp: 0.52 }];
  // Fuego (molotov): se queman unos segundos y van perdiendo vida; los alcanzados se quedan un rato
  // sacudiéndose las llamas y el más cercano al impacto cae al suelo, se revuelca y muere
  const BURN_T = 6, BURN_DPS = 0.42, BURN_STUN = [2.4, 3.6], BURN_ROLL = 3.2;
  // Muñeco de trapo (explosión): giros objetivo de cada hueso en el aire (brazos arriba, piernas sueltas)
  // y ya en el suelo (despatarrado). Se mueven con muelles poco amortiguados: se agitan como un trapo
  const RAG_AIR = { armL: [-2.5, 0, 0.7], armR: [-2.4, 0, -0.7], foreL: [-0.5, 0, 0], foreR: [-0.6, 0, 0], legL: [-0.6, 0, 0.25], legR: [0.25, 0, -0.2],
    shinL: [1.0, 0, 0], shinR: [0.6, 0, 0], neck: [-0.45, 0, 0], head: [-0.2, 0, 0], spine: [-0.3, 0, 0], chest: [-0.15, 0, 0] };
  const RAG_GROUND = { armL: [-0.35, 0, 1.3], armR: [-0.9, 0, -1.05], foreL: [-0.3, 0, 0], foreR: [-0.85, 0, 0], legL: [-0.25, 0, 0.28], legR: [0.05, 0, -0.18],
    shinL: [0.55, 0, 0], shinR: [0.15, 0, 0], neck: [0.05, 0.6, 0], head: [0, 0.25, 0], spine: [0.05, 0, 0], chest: [0, 0, 0] };
  const BEAT_REST = 0.9;         // respiro tras un combo antes de que otro te pueda pegar
  const GRAB_P = 0.2;            // probabilidad de que un ataque sea un intento de agarre (si no, el combo)
  // Golpe en carrera (el ataque en carrera que tenía el protagonista): el corredor se lanza desde 2 a 3,6 m
  const RUNATK = { dur: 0.8, imp: 0.42, min: 2.0, max: 3.6, chance: 0.5, cd: 4 };
  const WINDUP = 0.62;           // preparación del ataque: corta pero se ve venir, se puede esquivar
  const RADIUS = 0.28;
  const HP_MIN = 2.4, HP_MAX = 3.4;   // vida de cada zombi
  const NO_FALL = true;              // los golpes no los tiran al suelo (solo caen al morir)
  // Reacciones a los golpes: duración (s), fuerza del empuje (m/s al empezar) y cuánto va de lado
  const REACT = {
    side: { dur: 0.75, force: 2.6, lat: 0.55 },     // gancho o golpe horizontal: la cabeza y el torso se van de lado
    heavy: { dur: 1.0, force: 4.4, lat: 0.15 },     // golpe fuerte de frente: se echa atrás con los brazos arriba
    vert: { dur: 0.85, force: 1.3, lat: 0 },        // de arriba abajo: se le doblan las rodillas
    stab: { dur: 0.7, force: 1.4, lat: 0 },         // puñalada: se encorva
    push: { dur: 0.6, force: 3.0, lat: 0 },         // culatazo o golpe con el arma de fuego
    shot: { dur: 0.5, force: 1.6, lat: 0.2 },       // disparo
    wall: { dur: 0.9, force: 0, lat: 0 }            // se estampó contra una pared
  };
  // Corredores: una parte de los zombis es agresiva (ven más lejos, te notan antes,
  // corren casi como tú, chillan al verte y se lanzan a por ti). El resto, lentos.
  const RUNNER_CHANCE = 1;          // por ahora todos son corredores (ninguno camina lento)
  // muy agresivos: corren casi como tú, te ven de lejos y te notan enseguida, atacan rápido y se lanzan lejos
  const RUNNER = { chase: 3.55, sight: 30, notice: 0.18, windup: 0.32, reach: 1.45, lunge: 1.65, hp: [2.0, 2.8], scream: 18, wander: 0.9, investigate: 2.35 };

  // piel pálida y enfermiza, entre gris, verde y amarillo
  const SKINS = [0x9aa08a, 0xa3a690, 0x8c957f, 0xb0ad98, 0x9a9580, 0x87907c, 0xa59f8c];
  const SHIRTS = [0x5a4a3a, 0x6b5d4f, 0x4a5560, 0x6e4b4b, 0x55603f, 0x7a7a72, 0x3f4a5a, 0x8a7a5a, 0x5e3f3f, 0x9a9488];
  const PANTS = [0x2f3340, 0x3b3a33, 0x4a4036, 0x28303a, 0x3d4a5a, 0x5a5448];
  const HAIR = [0x2a2018, 0x3a2a1c, 0x5a4630, 0x1a1a1a, 0x7a6a5a, null, null];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // estados en los que un ruido no le hace cambiar de idea
  const BUSY = { hhunt: 1, heat: 1, eaten: 1, avoid: 1, hdorm: 1, hburst: 1, hgrab: 1, hrip: 1, hkill: 1, stalk: 1, hide: 1, ambush: 1, tthrow: 1, bslam: 1, tcharge: 1, tdash: 1, troar: 1, ragdoll: 1, burning: 1, burnroll: 1, dead: 1, feign: 1, down: 1, rise: 1, stagger: 1, attack: 1, recover: 1, combo: 1, runatk: 1, climb: 1, chase: 1, bang: 1, grabbed: 1, alert: 1, stun: 1, grapple: 1, held: 1 };
  // Ciegos (variante dura): no ven, oyen muy bien, van encorvados y se lanzan hacia el ruido.
  // Aguantan más golpes (en la cabeza mueren igual) y su agarre es casi mortal
  const BLIND_SLAM_P = 0.3;         // probabilidad de que el ataque del chaskeado sea el agarre mortal
  const BLIND = { chase: 3.7, wander: 0.75, investigate: 1.7, hear: 1.7, touch: 1.25, hp: [4.6, 5.6], windup: 0.42, reach: 1.25 };
  // chasqueado que ya te oyó: más rápido, ataca antes y con más alcance, y busca más el agarre mortal
  const BLIND_HUNT = { chase: 1.2, windup: 0.75, reach: 1.15, slam: 0.42 };

  // Temblante: grande, ancho y torpe, con bultos de esporas de la cabeza a la espalda. Corre algo más lento que
  // un corredor pero aguanta muchísimo (vida 100: cada arma le quita lo suyo, ver TEMB_DMG). Los golpes cuerpo a
  // cuerpo no le hacen nada salvo el ataque en carrera con un arma grande (lo aturde; 4 lo matan). Pega como los
  // corredores pero más lento, más fuerte y empujando mucho más. A veces se fija en dónde estás, grita mientras
  // carga (1 s) y embiste hacia ese punto aunque te muevas; al frenar (o al chocar contra una pared, más grande)
  // grita y suelta una explosión de esporas. Al morir se retuerce en el suelo y revienta
  const TEMB = { hp: 100, chase: 3.25, reach: 1.6, punchSlow: 1.45, dmg: 1.8, push: 2.3, scale: [1.3, 1.1, 1.26], bulk: 1.25,
    cmin: 3.5, cmax: 15, cchance: 0.55, cfirst: [1.5, 3], cretry: [1.2, 2.5], ccd: [7, 12], windup: 1.0, dash: 7.2, over: 1.4,
    launch: 11, throwPush: 5.5, throwDmg: 15, tackleR: 1.05, tackleDmg: 22, tacklePush: 11, roar: 1.15, sporeR: 3.2, wallR: 4.4, popR: 3.6, pop: [1, 2] };
  // Tiros que hacen falta (rifle y revólver), [cabeza, cuerpo]; 'up' = con la mejora de Daño del banco.
  // light: corredores y acechadores · blind: chaskeados · temb: temblantes. Las piernas cuentan como cuerpo
  const STK = {
    rifle: { base: { light: [1, 2], blind: [2, 3], temb: [3, 5], nemi: [2, 3] }, up: { light: [1, 1], blind: [1, 2], temb: [2, 2], nemi: [1, 2] } },
    revolver: { base: { light: [1, 4], blind: [3, 5], temb: [4, 7], nemi: [3, 5] }, up: { light: [1, 3], blind: [2, 3], temb: [3, 4], nemi: [2, 4] } }
  };
  function stkShots(src, kind, part, type) {
    if (kind !== 'shot' || !src || !STK[src.w]) return 0;
    const t = STK[src.w][src.up ? 'up' : 'base'][type];
    return part === 'head' ? t[0] : t[1];
  }
  // daño de cada arma (vida 100). Escopeta: 25 al cuerpo, 50 a la cabeza y 100 a la cabeza a quemarropa
  const TEMB_DMG = { pistol: { head: 20, body: 5, legs: 3 }, rifle: { head: 100, body: 25, legs: 15 }, bow: { head: 34, body: 7, legs: 5 } };
  // (diseños propios) temblante: enorme y deforme, sin camisa, carne viva agrietada con costras y bultos;
  // descalzo y con el pantalón hecho jirones
  const TEMB_LOOK = { temb: true, runner: true, blind: false, fungus: 0, facePlate: false, drag: false, armsUp: 0, hair: null, longHair: false,
    skin: 0x86594c, shirt: 0x3d3a30, pants: 0x3a352c, shoes: 0x7d5246, longSleeves: false, female: false,
    build: 'huge', tear: 0, shorts: true, skinPal: 'raw' };
  // chaskeado: consumido y pálido, venas oscuras, ropa hecha jirones, descalzo
  const BLIND_LOOK = { blind: true, runner: false, fungus: 0, facePlate: true, drag: false, armsUp: 0, hair: null, longHair: false,
    skin: 0xa8a197, shirt: 0x5f5b52, pants: 0x4c483f, shoes: 0x8f877d, longSleeves: false, belt: null, pocket: false,
    build: 'gaunt', tear: 0.5, shorts: true, skinPal: 'pale' };
  // Acechador: flaco, pálido y encorvado. Te ve antes y de más lejos que los demás y te busca, pero al verte
  // no avisa ni va de frente: se esconde y te sigue a distancia. Cuando llevas unos 3-4 s sin mirarlo, se lanza
  // por la espalda o un costado y te agarra (forcejeo de los corredores). Si te sueltas, huye a esconderse detrás
  // de lo más cercano y desde ahí chilla para avisar a los demás. Si le pegas o lo pillas de frente y cerca,
  // pelea como un corredor un rato. Aguanta más que un corredor y menos que un chaskeado
  // (más atrevido que antes: espera menos para lanzarse, te pelea de frente desde más lejos y se le pasa menos el
  // enfado; mirarlo de reojo ya no basta para que se esconda si está cerca)
  const STALK = { hp: [3.4, 4.0], sight: 24, fov: 1.0, notice: 1.3, creep: 2.2, hide: 4.3, ambush: 4.8, wait: [1.6, 2.6],
    face: 8.5, madT: 16, grabR: 1.35, lose: 12, scale: [0.94, 1.07, 0.94] };
  const STALK_LOOK = { stalker: true, runner: true, blind: false, fungus: 1, facePlate: false, drag: false, armsUp: 0, hair: null, longHair: false,
    skin: 0xb6b9a6, shirt: 0x2b2926, pants: 0x24221f, longSleeves: false, belt: null, female: false };
  // Hongomorfo (jefe final; diseño propio): más grande que el temblante, cubierto de bultos y placas de hongo
  // de pies a cabeza y con la cabeza partida en una corona de láminas. Rápido y pesado a la vez; aguanta muchísimo
  // (vida 360 en la escala del temblante: cada arma le quita lo mismo que a un temblante) y el fuego le quita
  // más (70 por molotov). Si te alcanza (el zarpazo para agarrarte o la embestida), te mata: te levanta del
  // suelo y te despedaza (animación propia). Se arranca trozos de hongo del cuerpo y te los lanza (revientan en
  // una nube de esporas más grande, más larga y que hace más daño). Atraviesa las paredes interiores que se le
  // ponen en medio (embistiendo). Hereda del temblante la embestida y los gritos
  const HONGO = Object.assign({}, TEMB, { hp: 360, chase: 3.55, reach: 1.95, scale: [1.42, 1.2, 1.36], meshScale: 1.29, bulk: 1.6,
    cmin: 4, cmax: 13, cchance: 0.5, cfirst: [3, 5], cretry: [1, 2.2], ccd: [6.5, 9.5], windup: 0.95, dash: 8.4, over: 2.4,
    tackleR: 1.35, roar: 1.3, popR: 4.8, fireK: 70, rad: 0.4,
    grabWind: 0.62, grabR: 2.1, lunge: 1.8, throwMin: 4.5, throwMax: 17, throwFirst: [5, 8], throwCD: [5.5, 8.5], ripT: 1.15, killT: 3.6 });
  const HONGO_LOOK = { hongo: true, build: 'giant', skin: 0xb5764c, shirt: 0x5a3a26, pants: 0x5a3826, shoes: 0x8a5a3c, skinPal: 'raw', tear: 0, shorts: true };
  // Blindado (acechador con armadura biológica): del tamaño de un corredor, ennegrecido y rojizo. Se comporta
  // como un acechador (te sigue escondido y te agarra cuando no lo miras), pero la armadura aguanta mucho:
  // a la cabeza hacen falta unos 3 tiros de pistola y los golpes le hacen la mitad. Sale de la guarida del
  // hongomorfo cuando a este le queda la mitad de la vida y se esconde en los huecos que deja al romper paredes.
  // (En el código lo llamamos «nemi»)
  const NEMI = { hp: 9 };
  const NEMI_LOOK = { nemi: true, skin: 0x3b1c18, shirt: 0x24100e, pants: 0x1e0e0c, shoes: 0x160a08, fungus: 0, longSleeves: true };
  // estados en los que ya va a por ti (al verte no vuelve a empezar)
  // peleando o sin control: no se puede ir a la sombra en ese momento
  const BUSY_FIGHT = { attack: 1, combo: 1, recover: 1, runatk: 1, grapple: 1, held: 1, stagger: 1, burning: 1, burnroll: 1, ragdoll: 1, down: 1, rise: 1, dead: 1, feign: 1, climb: 1, grabbed: 1, stun: 1 };
  const ENGAGED = { hhunt: 1, heat: 1, eaten: 1, avoid: 1, hdorm: 1, hburst: 1, hgrab: 1, hrip: 1, hkill: 1, stalk: 1, hide: 1, ambush: 1, tthrow: 1, bslam: 1, chase: 1, attack: 1, recover: 1, combo: 1, runatk: 1, bang: 1, alert: 1, tcharge: 1, tdash: 1, troar: 1 };

  function randomLook() {
    const fungus = Math.random() < 0.4 ? 0 : (Math.random() < 0.65 ? 1 : 2);
    return {
      fungus, facePlate: fungus === 2 && Math.random() < 0.6,
      belt: Math.random() < 0.4 ? 0x2e2620 : null, pocket: Math.random() < 0.5,
      skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIR),
      longHair: Math.random() < 0.3, longSleeves: Math.random() < 0.4,
      shoes: pick([0x2a2622, 0x3b3029, 0x4a4a4a, 0x5a4636]),
      seed: Math.floor(Math.random() * 1e9), drag: Math.random() < 0.3,
      armsUp: Math.random() < 0.35 ? 0.6 : 0,
      runner: Math.random() < RUNNER_CHANCE,
      female: Math.random() < 0.35
    };
  }

  // El aspecto final de un infectado según su tipo (variantes encima del aspecto al azar)
  function finalLook(look, extra) {
    // variante ciega: cabeza cubierta de hongo, sin pelo, encorvada
    if (extra && extra.blind) {
      Object.assign(look, BLIND_LOOK);
      // los chasqueados: mallas low poly con textura (src/charmesh_chasq1/2/3/4.js): dos mujeres y dos hombres
      const r = U.mulberry32((look.seed || 1) * 5 + 3)() < 0.5;
      const id = look.female ? (r ? 'chasq1' : 'chasq2') : (r || !(G.CharMesh && G.CharMesh.chasq4) ? 'chasq3' : 'chasq4');
      if (G.CharMesh && G.CharMesh[id]) look.mesh = id;
    }
    if (extra && (extra.temb || extra.hongo)) Object.assign(look, TEMB_LOOK);
    if (extra && extra.hongo) Object.assign(look, HONGO_LOOK);
    if (extra && (extra.stalker || extra.nemi)) Object.assign(look, STALK_LOOK);
    if (extra && extra.nemi) Object.assign(look, NEMI_LOOK);
    // el temblante (no el hongomorfo): malla low poly con textura (src/charmesh_temb.js)
    if (extra && extra.temb && !extra.hongo && G.CharMesh && G.CharMesh.temb) look.mesh = 'temb';
    // los corredores: menos hongo y más sangre, no arrastran la pierna
    if (look.runner) { look.fungus = Math.min(look.fungus, 1); look.facePlate = false; look.drag = false; look.armsUp = 0; }
    // el corredor común: malla low poly con textura (src/charmesh_corr.js)
    if (look.runner && !look.stalker && !look.temb && !look.hongo && !look.nemi && !look.blind && !look.mesh && G.CharMesh && G.CharMesh.corr)
      look.mesh = 'corr';
    // el acechador (no el blindado) y el hongomorfo: mallas low poly con textura (src/charmesh_stalk.js y _hongo.js)
    if (look.stalker && !look.nemi && G.CharMesh && G.CharMesh.stalk) look.mesh = 'stalk';
    // el blindado: la malla de la chasqueada del chaleco, ennegrecida y con el hongo rojo (src/charmesh_chasq1.js)
    if (look.nemi && G.CharMesh && G.CharMesh.nemi) { look.mesh = 'nemi'; look.female = true; }
    if (look.hongo && G.CharMesh && G.CharMesh.hongo) look.mesh = 'hongo';
    // variante de color de la malla (0: la original; ver MESH_VARS en models.js): corredores, chasqueado hombre y
    // temblante. El acechador (el chasqueado hombre con el hongo de la cabeza rojizo) siempre lleva una variante
    const nv = look.mesh && G.MESH_VARS && G.MESH_VARS[look.mesh] ? G.MESH_VARS[look.mesh].length : 0;
    const v0 = look.mesh === 'stalk' || look.mesh === 'nemi' ? 1 : 0;
    if (nv && look.meshVar == null) look.meshVar = v0 + Math.floor(U.mulberry32((look.seed || 1) * 7 + 13)() * (nv + 1 - v0));
    return look;
  }
  function zombieModel(look) {
    return G.Models.createHumanoid(Object.assign({ zombie: true, blood: U.mulberry32(look.seed) }, look));
  }

  // ---------- Reserva de cuerpos ----------
  // Armar el cuerpo de un infectado (la malla con sus huesos) cuesta mucho de una vez (de 50 a 200 ms en un
  // móvil): por eso salía un tirón cada vez que aparecía uno. Ahora se arman de antemano detrás de la pantalla de
  // carga (con sus tres niveles de detalle) y, cuando un infectado desaparece, su cuerpo vuelve a la reserva para
  // el siguiente del mismo tipo. Una reserva por tipo: corriente, acechador, chaskeado y temblante (los jefes y
  // los humanos se arman aparte).
  const POOL_CAP = { z: 26, stalker: 8, blind: 4, temb: 3 };
  const Pool = {
    bins: { z: [], stalker: [], blind: [], temb: [] },
    byLook: new WeakMap(),           // aspecto → su cuerpo guardado (los dormidos del mundo abierto vuelven con el suyo)
    want: { z: 0, stalker: 0, blind: 0, temb: 0 },
    ghost: null,
    keyFor(look, extra) {
      if (extra && (extra.human || extra.hongo || extra.nemi)) return null;
      if (extra && extra.blind) return 'blind';
      if (extra && extra.temb) return 'temb';
      if (extra && extra.stalker) return 'stalker';
      if (look) return look.blind ? 'blind' : look.temb ? (look.hongo ? null : 'temb') : look.stalker ? (look.nemi ? null : 'stalker') : (look.hongo || look.nemi ? null : 'z');
      return 'z';
    },
    extraFor(k) { return k === 'z' ? null : { [k]: true }; },
    // un cuerpo nuevo para la reserva (con la malla media y la lejana ya hechas)
    make(k) {
      const look = finalLook(randomLook(), this.extraFor(k));
      const model = zombieModel(look);
      G.Models.setLOD(model, 0, true); G.Models.setLOD(model, -1, true); G.Models.setLOD(model, 1, true);
      return this.mark({ look, model });
    },
    mark(e) { const b = e.model.base = new Set(); e.model.root.traverse((o) => b.add(o)); return e; },
    take(k, look) {
      const bin = this.bins[k];
      if (!bin) return null;
      if (look) {
        const e = this.byLook.get(look);
        const i = e ? bin.indexOf(e) : -1;
        if (i < 0) return null;
        bin.splice(i, 1);
        return e;
      }
      for (let i = 0; i < bin.length; i++) if (!bin[i].kept) return bin.splice(i, 1)[0];
      return null;
    },
    // de vuelta a la reserva: como recién hecho (sin flechas ni llamas, de pie, con su tamaño)
    give(k, look, h, keep) {
      const bin = this.bins[k];
      if (!bin || !h.base) return false;
      if (bin.length >= POOL_CAP[k]) {
        // llena: se quita el más viejo de los que guardan a un dormido (si no hay, este no entra)
        const i = bin.findIndex((e) => e.kept);
        if (i < 0) return false;
        G.Models.disposeHumanoid(bin.splice(i, 1)[0].model);
      }
      const rm = [];
      h.root.traverse((o) => { if (o !== h.outline && !h.base.has(o) && o.parent && h.base.has(o.parent)) rm.push(o); });
      for (const o of rm) o.parent.remove(o);
      h.root.visible = true; h.root.position.set(0, 0, 0); h.root.rotation.set(0, 0, 0); h.root.scale.set(1, 1, 1);
      h.body.visible = true; h.body.position.set(0, 0, 0); h.body.rotation.set(0, 0, 0); h.body.scale.set(1, 1, 1);
      h.mesh.visible = true; h.mesh.castShadow = true;
      for (let i = 0; i < h.bones.length; i++) { const b = h.bones[i]; b.position.copy(h.rest[i]); b.quaternion.set(0, 0, 0, 1); b.scale.set(1, 1, 1); }
      h._ls = 0;
      if (h.outline) h.outline.visible = false;
      G.Models.setLOD(h, 1);
      const e = { look, model: h, kept: !!keep };
      bin.push(e);
      this.byLook.set(look, e);
      return true;
    },
    // para los que ya no existen: un cuerpo que no está en la escena (por si algo los mira después)
    getGhost() {
      if (!this.ghost) { this.ghost = G.Models.createHumanoid(Object.assign({ zombie: true, lod: -1 }, finalLook(randomLook(), null))); this.ghost.ghost = true; }      // (la malla mínima: se arma enseguida)
      return this.ghost;
    },
    // cuántos de cada tipo tener listos (lo pide cada enfrentamiento al empezar)
    need(spec) { for (const k in this.want) this.want[k] = Math.min(POOL_CAP[k], (spec && spec[k]) || 0); },
    missing() { let n = this.jobs.length; for (const k in this.want) n += Math.max(0, this.want[k] - this.bins[k].filter((e) => !e.kept).length); return n; },
    get full() { return this.missing() === 0; },
    // otros trabajos para la carga (los humanos enemigos que saldrán después; ver humans.js)
    jobs: [],
    // un humano preparado: su cuerpo (con el arma) se usa al crearlo con ese mismo aspecto
    takeHuman(look) {
      const e = look && this.byLook.get(look);
      if (!e || !e.human) return null;
      this.byLook.delete(look);
      return e;
    },
    // arma cuerpos hasta pasarse de «ms» milisegundos (al menos uno si falta alguno)
    step(ms) {
      const t0 = performance.now();
      for (;;) {
        if (this.jobs.length) { this.jobs.shift()(); if (performance.now() - t0 >= ms) return true; continue; }
        let k = null;
        for (const q in this.want) if (this.bins[q].filter((e) => !e.kept).length < this.want[q]) { k = q; break; }
        if (!k) return false;
        this.bins[k].push(this.make(k));
        if (performance.now() - t0 >= ms) return true;
      }
    },
    count() { const o = {}; for (const k in this.bins) o[k] = this.bins[k].length; return o; }
  };

  class Zombie {
    constructor(scene, x, z, look, facing, extra) {
      this.scene = scene;
      this.pos = { x, z };
      this.lv = (extra && extra.lv) || 0;
      this.y = G.World.groundY(x, z, this.lv);
      this.facing = facing != null ? facing : Math.random() * Math.PI * 2;
      this.human = !!(extra && extra.human);
      // un cuerpo de la reserva, si hay (si no, se arma ahora)
      const pk = this.human ? null : Pool.keyFor(look, extra);
      const pre = pk ? Pool.take(pk, look) : (this.human ? Pool.takeHuman(extra.human) : null);
      this.poolKey = pk;
      this.look = pre ? pre.look : finalLook((extra && extra.human) || look || randomLook(), this.human ? null : extra);
      this.blind = !!this.look.blind;
      this.temb = !!this.look.temb;
      this.hongo = !!this.look.hongo;
      this.nemi = !!this.look.nemi;
      this.T = this.hongo ? HONGO : TEMB;
      this.rad = this.hongo ? HONGO.rad : RADIUS;
      this.stalker = !!this.look.stalker;
      if (this.stalker) this.hunter = true;          // te busca aunque no te haya visto
      // los de las oleadas saben siempre dónde estás (te cazan)
      this.hunter = !!(extra && extra.hunter);
      this.runner = !!this.look.runner;
      // (los humanos enemigos usan esta misma clase como base, con su propio modelo: ver humans.js)
      if (pre) this.model = pre.model;
      else {
        this.model = this.human ? G.Models.createHumanoid(this.look) : zombieModel(this.look);
        if (pk) Pool.mark({ look: this.look, model: this.model });
      }
      scene.add(this.model.root);
      if (this.stalker && !this.nemi && this.look.mesh !== 'stalk') this.model.root.scale.set(STALK.scale[0], STALK.scale[1], STALK.scale[2]);
      // mallas con su propia escala (el corredor: el modelo es más alto que el esqueleto)
      { const cb = this.look.mesh && G.CharMesh && G.CharMesh[this.look.mesh] && G.CharMesh[this.look.mesh].bind;
        if (cb && cb.rootScale && !this.stalker && !this.temb) this.model.root.scale.setScalar(cb.rootScale); }
      if (this.temb) { if (this.look.mesh === 'hongo') this.model.root.scale.setScalar(HONGO.meshScale); else { const mb = this.look.mesh && G.CharMesh && G.CharMesh[this.look.mesh], rs = (mb && mb.bind && mb.bind.rootScale) || 1; this.model.root.scale.set(this.T.scale[0] * rs, this.T.scale[1] * rs, this.T.scale[2] * rs); } this.bulk = this.T.bulk; this.chargeCD = this.T.cfirst[0] + Math.random() * (this.T.cfirst[1] - this.T.cfirst[0]); }
      this.hp = extra && extra.hp != null ? extra.hp
        : this.temb ? this.T.hp : this.nemi ? NEMI.hp : this.stalker ? STALK.hp[0] + Math.random() * (STALK.hp[1] - STALK.hp[0]) : (this.blind ? BLIND.hp[0] + Math.random() * (BLIND.hp[1] - BLIND.hp[0])
          : (this.runner ? RUNNER.hp[0] + Math.random() * (RUNNER.hp[1] - RUNNER.hp[0]) : HP_MIN + Math.random() * (HP_MAX - HP_MIN)));
      this.hpMax = this.hp;
      // Personalidad: cada infectado nace con sus rasgos (0 a 1). Agresividad (cuánto le pesa ir a por ti frente
      // al miedo), valentía (cuánto le asusta el fuego o ver caer a otros), atención (te ve antes y de más lejos),
      // curiosidad (oye más y busca más rato), tenacidad (tarda más en perderte) y energía (algo más rápido o lento).
      // Los jefes y el blindado, sin rasgos (siempre igual)
      const tr = () => (extra && (extra.hongo || extra.nemi)) ? 0.5 : Math.random();
      this.pers = { agr: tr(), brave: tr(), alert: tr(), curious: tr(), persist: tr(), energy: tr() };
      this.spMul = 0.9 + this.pers.energy * 0.2;
      this.fearT = 0; this.sunT = 0;
      if (this.hongo) { this.throwCD = HONGO.throwFirst[0] + Math.random() * (HONGO.throwFirst[1] - HONGO.throwFirst[0]); this.wallCD = 1; }
      this.state = 'idle';
      this.timer = 1 + Math.random() * 3;
      this.target = null;
      this.lastSeen = 0;
      this.hearTimer = 0;
      this.path = null; this.pathTimer = 0; this.clear = true; this.clearTimer = 0;
      this.stuck = 0;
      this.phase = Math.random() * 10;
      this.speedNow = 0;
      this.reach = 0;
      this.notice = 0;
      this.stagger = 0;
      this.kb = { x: 0, z: 0 };
      this.fall = 0;          // 0 de pie, 1 en el suelo
      this.fallDir = -1;
      this.edge = null;
      this.climbing = null;
      this.elev = 0; this.fallV = 0; this.falling = false;   // encima de un contenedor
      this.bangT = 0;
      this.resume = 'chase';
      this.tilt = (Math.random() - 0.5) * 1.6;
      this.lean = (Math.random() - 0.5) * 0.12;
      if (extra && extra.dead) { this.state = 'dead'; this.fall = 1; this.fallDir = extra.fallDir || -1; }
      // los que aparecen dentro de una casa no salen de su habitación hasta oír un ruido
      this.homebound = !!(extra && extra.homebound);
      if (this.homebound) { const r = G.World.roomAt(Math.floor(x), Math.floor(z), this.lv); this.homeRoom = r; if (!r) this.homebound = false; }
      this.apply(0);
    }

    get alive() { return this.state !== 'dead'; }
    get downed() { return this.state === 'down' || this.state === 'feign' || (this.state === 'rise' && this.timer > 0.6); }
    get standing() { return this.alive && !this.downed && this.state !== 'rise'; }

    // keep: se duerme (mundo abierto): su cuerpo se le guarda para cuando vuelva
    dispose(keep) {
      const m = this.model;
      if (!m || m.ghost) return;
      this.scene.remove(m.root);
      // su cuerpo vuelve a la reserva (el infectado se queda con uno fuera de la escena, por si algo lo mira)
      if (this.poolKey && Pool.give(this.poolKey, this.look, m, keep)) { this.model = Pool.getGhost(); this.poolKey = null; return; }
      G.Models.disposeHumanoid(m);
    }

    enter(state, timer) {
      if (state !== 'investigate') { this.investFast = false; this.alertRun = false; }
      this.state = state;
      this.timer = timer || 0;
      this.exposed = false;
      this.pathTimer = 0;
      this.clearTimer = 0;
      this.stuck = 0;
    }

    // ---------- Agarre, aturdimiento y remates ----------
    // Te agarra (forcejeo): se queda pegado delante de ti hasta que te sueltas o te muerde
    startGrapple(maul) { this.maul = !!maul; this.enter('grapple', 0); this.reach = 0; this.path = null; this.edge = null; this.grappleT = 0; this.kb.x = this.kb.z = 0; }
    // Aturdido: se tambalea con las manos en la cara; un golpe cuerpo a cuerpo lo remata
    stun(dur, dx, dz, force) {
      if (!this.alive || this.state === 'held') return;
      this.enter('stun', dur); this.stunDur = dur; this.stunT = 0; this.reach = 0; this.edge = null; this.path = null;
      if (dx != null) { const l = Math.hypot(dx, dz) || 1, f = force != null ? force : 1.5; this.kb.x = dx / l * f; this.kb.z = dz / l * f; }
    }
    get stunned() { return this.state === 'stun'; }
    // Lo están rematando: lo mueve quien lo remata
    hold(kind) { this.enter('held', 0); this.heldKind = kind; this.heldT = 0; this.reach = 0; this.path = null; this.edge = null; this.kb.x = this.kb.z = 0; }

    // Lo lanza una explosión: sale despedido de espaldas dando vueltas como un muñeco de trapo. k: 0 a 1
    // (fuerza); kill: muere en el acto (si no, al caer se levanta)
    launch(dx, dz, k, kill, player) {
      if (this.state === 'held') return;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.facing = Math.atan2(-dx, -dz);
      const hs = 2 + 4.5 * k, rnd = () => Math.random() - 0.5;
      const r = { vx: dx * hs, vz: dz * hs, vy: 2.5 + 4.2 * k, hip: 0.95, rx: 0, rz: 0,
        wx: -(2.5 + 4.5 * k) * (0.8 + 0.4 * Math.random()), wz: rnd() * 4 * k, t: 0, bounces: 0, settled: false, st: 0, kill: !!kill, b: {} };
      for (const n in RAG_AIR) r.b[n] = { x: 0, y: 0, z: 0, vx: rnd() * 14 * k, vy: rnd() * 4 * k, vz: rnd() * 14 * k };
      this.rag = r;
      if (player) this.endCombo(player);
      this.kb.x = this.kb.z = 0; this.reach = 0; this.path = null; this.edge = null; this.speedNow = 0;
      if (kill) { this.hp = 0; this.killedBy = 'explosion'; this.die(-1); this.fall = 0; }
      else this.enter('ragdoll', 0);
    }
    // Física simple del muñeco: el cuerpo vuela con gravedad y gira; al tocar el suelo rebota y se frena; las
    // extremidades van con muelles (se agitan en el aire y quedan despatarradas en el suelo)
    stepRag(dt, player) {
      const r = this.rag;
      r.t += dt;
      if (!r.settled) {
        r.vy -= 9.8 * dt;
        const x0 = this.pos.x, z0 = this.pos.z;
        G.World.move(this.pos, r.vx * dt, r.vz * dt, this.rad, this.lv, this.elev);
        const mv = Math.hypot(this.pos.x - x0, this.pos.z - z0), want = Math.hypot(r.vx, r.vz) * dt;
        if (want > 0.01 && mv < want * 0.4) { r.vx *= -0.3; r.vz *= -0.3; r.wx *= 0.6; }      // contra una pared
        r.hip += r.vy * dt;
        r.rx += r.wx * dt; r.rz += r.wz * dt;
        const minH = 0.16 + 0.78 * Math.abs(Math.cos(r.rx) * Math.cos(r.rz));
        if (r.hip <= minH) {
          r.hip = minH;
          if (r.vy < -1.5 && r.bounces < 3) {
            // rebote: se frena y las extremidades dan un latigazo
            r.vy = -r.vy * 0.3; r.vx *= 0.55; r.vz *= 0.55; r.wx *= 0.45; r.wz = r.wz * 0.5 + (Math.random() - 0.5) * 2; r.bounces++;
            for (const n in r.b) { const q = r.b[n]; q.vx += (Math.random() - 0.5) * 10; q.vz += (Math.random() - 0.5) * 10; }
          } else {
            r.vy = 0;
            const f = Math.max(0, 1 - dt * 6);
            r.vx *= f; r.vz *= f; r.wx *= Math.max(0, 1 - dt * 5); r.wz *= Math.max(0, 1 - dt * 5);
            if (Math.hypot(r.vx, r.vz) < 0.4 && r.t > 0.5) {
              r.settled = true; r.st = 0;
              const a = Math.atan2(Math.sin(r.rx), Math.cos(r.rx));
              r.rx = a; r.trx = a >= 0 ? Math.PI / 2 : -Math.PI / 2;
              r.rz = Math.atan2(Math.sin(r.rz), Math.cos(r.rz));
            }
          }
        }
      } else {
        // se acomoda tumbado (boca arriba o boca abajo)
        r.st += dt;
        const k = Math.min(1, dt * 6);
        r.rx += (r.trx - r.rx) * k; r.rz += (0 - r.rz) * k; r.hip += (0.16 - r.hip) * k;
      }
      // extremidades
      const T = r.settled || r.hip <= 0.3 ? RAG_GROUND : RAG_AIR;
      const K = r.settled ? 45 : 28, C = r.settled ? 11 : 3.5;
      for (const n in r.b) {
        const q = r.b[n], tg = T[n];
        q.vx += (K * (tg[0] - q.x) - C * q.vx) * dt; q.x += q.vx * dt;
        q.vy += (K * (tg[1] - q.y) - C * q.vy) * dt; q.y += q.vy * dt;
        q.vz += (K * (tg[2] - q.z) - C * q.vz) * dt; q.z += q.vz * dt;
      }
      if (r.settled && r.st > 0.5) {
        this.fall = 1; this.fallDir = r.trx > 0 ? 1 : -1;
        // si sobrevivió, se levanta (desde el suelo, como al caer)
        if (this.alive && r.st > 1.1) {
          this.rag = null;
          const m = this.model;
          m.body.rotation.set(0, 0, 0); m.body.position.set(0, 0, 0);
          this.enter('down', 1.2);
        }
      }
    }

    // Le alcanza el fuego. roll: el más cercano al impacto cae y se revuelca hasta morir
    ignite(player, roll, zone) {
      if (!this.alive || this.state === 'held' || this.state === 'burnroll') return;
      // de dónde viene el fuego (para los desafíos): las molotovs no marcan nada; el lanzallamas, 'flame'
      this.burnSrc = (zone && zone.src) || 'molotov';
      if (this.temb) {
        // arde sin pararse: cada charco de fuego (cada molotov) le quita 50 de vida mientras se quema
        const zs = this.fireZones || (this.fireZones = []);
        if (!zone || zs.indexOf(zone) < 0) { if (zone) zs.push(zone); this.burnLeft = (this.burnLeft || 0) + (this.T.fireK || 50); }
        this.burnT = Math.max(this.burnT || 0, BURN_T);
        if (G.Fire) G.Fire.attach(this);
        return;
      }
      this.burnT = Math.max(this.burnT || 0, BURN_T);
      if (G.Fire) G.Fire.attach(this);
      if (player) this.endCombo(player);
      this.reach = 0; this.path = null; this.edge = null; this.kb.x = this.kb.z = 0;
      if (roll) { this.fallDir = -1; this.rollT = 0; this.enter('burnroll', BURN_ROLL); }
      else if (this.state !== 'burning') this.enter('burning', BURN_STUN[0] + Math.random() * (BURN_STUN[1] - BURN_STUN[0]));
    }

    // Empieza el combo de puñetazos (o el golpe en carrera): te tiene "atrapada" (nadie más te pega)
    startCombo(player) {
      this.enter('combo', 0); this.combo = { step: 0, t: 0, hit: false, hits: 0, tgt: player }; this.reach = 0;
      player.beaten = { z: this };
    }
    startRunAtk(player, dist) {
      // velocidad del impulso: llega a tu lado justo en el golpe
      const v = U.clamp(((dist || 3) - 0.85) / (RUNATK.imp * RUNATK.dur), 3, 8);
      this.enter('runatk', 0); this.combo = { step: 'run', t: 0, hit: false, hits: 0, v, tgt: player }; this.reach = 0;
      player.beaten = { z: this };
    }
    // el cuerpo al que van sus golpes (la protagonista o el compañero que defiende), mientras siga al alcance
    strikeModel() {
      const p = this.combo && this.combo.tgt;
      if (!p || p.dead) return null;
      const m = p.model || (p.ally && p.ally.model);
      if (!m) return null;
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      return d < 1.6 && !(p.dodging && p.dodging.t < 0.8) ? m : null;
    }
    endCombo(player) {
      if (player && player.beaten && player.beaten.z === this) { player.beaten = null; player.beatCD = BEAT_REST; }
    }

    aware() {
      return this.state === 'chase' || this.state === 'attack' || this.state === 'recover' || this.state === 'alert' || this.state === 'combo' || this.state === 'runatk'
        || this.state === 'tcharge' || this.state === 'tdash' || this.state === 'troar'
        || this.state === 'stalk' || this.state === 'hide' || this.state === 'ambush' || this.state === 'avoid';
    }

    // Un ruido en (x, z) con alcance r
    hear(x, z, r, lv) {
      // ocupado (persiguiéndote, peleando...) no hace caso. El acechador que te acecha sí cae en la trampa de
      // un ruido (una botella), pero no cuando ya pelea
      if (BUSY[this.state] && !(this.stalker && (this.state === 'stalk' || this.state === 'hide') && !(this.mad > 0) && !this.alertPending)) return;
      lv = lv || 0;
      const other = lv !== (this.lv || 0);
      if (other) r *= 0.55;                      // de otra planta se oye peor
      r *= 0.8 + this.pers.curious * 0.45;          // (los curiosos oyen más lejos)
      if (G.Sky) r *= G.Sky.hear(false);           // (la lluvia y el viento tapan; de noche oyen más)
      const d = Math.hypot(x - this.pos.x, z - this.pos.z);
      if (d > r) return;
      if (!other && d > r * 0.6 && !G.World.hasLOS(this.pos.x, this.pos.z, x, z, this.lv)) return;
      // acechador: a un ruido a pleno sol no va (salvo que sea muy agresivo)
      if (this.stalker && G.World.sunlit(x, z, lv) && this.pers.agr < 0.75) return;
      this.homebound = false;
      this.target = { x: x + (Math.random() - 0.5) * 2, z: z + (Math.random() - 0.5) * 2, lv };
      this.enter('investigate', 9 + this.pers.curious * 9);
      this.investFast = true;                    // va decidido hacia el ruido (no a trompicones)
      this.facing = U.turnToward(this.facing, Math.atan2(x - this.pos.x, z - this.pos.z), 1.2);
    }

    // Te vio y avisa: los que no te han visto en un radio amplio (pero no infinito) van hacia donde estás.
    // Cada uno, al verte, avisará a su vez a los de su alrededor
    alertNearby(player, r) {
      const list = G.Population ? G.Population.list : [];
      const lv = this.lv || 0;
      for (const q of list) {
        if (q === this || !q.alive || q.aware() || BUSY[q.state] || (q.lv || 0) !== lv) continue;
        const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
        if (d > r) continue;
        if (d > r * 0.75 && !G.World.hasLOS(this.pos.x, this.pos.z, q.pos.x, q.pos.z, lv)) continue;
        const e = 1 + d * 0.08;
        q.homebound = false;
        q.target = { x: player.pos.x + (Math.random() - 0.5) * 2 * e, z: player.pos.z + (Math.random() - 0.5) * 2 * e, lv: player.lv || 0 };
        q.enter('investigate', 12);
        q.investFast = true; q.alertRun = true;
        q.notice = Math.max(q.notice || 0, 0.6);
      }
    }

    // ---------- Golpes recibidos ----------
    // dx, dz: dirección del golpe (desde el atacante hacia el zombi)
    // kind: tipo de golpe para la reacción ('side' lateral, 'heavy' fuerte de frente, 'vert' de arriba,
    // 'stab' puñalada, 'push' empujón o culatazo, 'shot' disparo). side: +1 lo empuja hacia su derecha
    // part: 'head' (muerte en el acto) o el cuerpo (del cuello para abajo: daño normal)
    takeHit(dmg, knock, dx, dz, behind, side, kind, part, src) {
      if (!this.alive) return 'none';
      if (this.temb) return this.tembHit(kind, part, src, behind, side, dx, dz);
      const wasFeign = this.state === 'feign';
      if (this.stalker) this.mad = STALK.madT;
      // chaskeado: la placa de hongo de la cabeza aguanta un tiro de pistola (hacen falta dos a la cabeza)
      if (part === 'head' && this.blind && kind === 'shot' && src && src.w === 'pistol' && !this.plateHit) {
        this.plateHit = true;
        this.flinch = side || (Math.random() < 0.5 ? 1 : -1);
        this.react('shot', this.flinch, dx, dz); this.kb.x *= 0.6; this.kb.z *= 0.6;
        return 'hit';
      }
      // rifle y revólver: un número fijo de tiros según el infectado y dónde le das
      const nShots = stkShots(src, kind, part, this.nemi ? 'nemi' : (this.blind ? 'blind' : 'light'));
      if (nShots) dmg = nShots === 1 ? 999 : (this.hpMax || this.hp) / nShots + 1e-4;
      // blindado: la armadura aguanta (a la cabeza, unos 3 tiros; el resto, la mitad)
      else if (this.nemi) dmg = part === 'head' ? Math.max(dmg * 0.6, (this.hpMax || this.hp) * 0.34) : dmg * 0.55;
      else if (part === 'head') dmg = Math.max(dmg, 999);
      if (this.rag && this.alive) { this.hp -= dmg; if (this.hp <= 0) { this.rag.kill = true; this.die(-1); } return this.alive ? 'hit' : 'kill'; }
      if (this.state === 'burnroll') { this.hp -= dmg; if (this.hp <= 0) { this.die(-1); this.fall = 1; return 'kill'; } return 'hit'; }
      this.hp -= dmg;
      this.flinch = side || (Math.random() < 0.5 ? 1 : -1);   // hacia qué lado se dobla al recibir el golpe
      // caer hacia donde lo empujan: de espaldas si le pegan de frente, boca abajo si es por detrás
      const dir = behind ? 1 : -1;
      if (this.hp <= 0) { this.kb.x = 0; this.kb.z = 0; this.push(dx, dz, this.flinch, kind, 0.6); this.die(dir); return 'kill'; }
      // haciéndose el muerto y le pegas: se levanta furioso
      if (wasFeign) { this.feignUp(false); return 'hit'; }
      // acechador herido: a veces cae como si lo hubieras matado (y se hace el muerto)
      if (this.stalker && !this.nemi && !this.feigned && this.hp < (this.hpMax || 1) * 0.7 && Math.random() < 0.5 && !this.downed && this.state !== 'grapple') {
        this.kb.x = 0; this.kb.z = 0; this.push(dx, dz, this.flinch, kind, 0.6); this.feign(dir); return 'hit';
      }
      if (this.downed) return 'hit';
      // ya no se caen: un golpe que antes los tiraba ahora los hace retroceder más y tambalearse más rato
      const strong = Math.random() < knock + (behind ? 0.25 : 0);
      this.react(strong && (kind === 'side' || !kind) ? 'heavy' : (kind || 'side'), this.flinch, dx, dz);
      if (strong) { this.kb.x *= 1.35; this.kb.z *= 1.35; this.timer += 0.25; this.reactDur += 0.25; }
      return 'hit';
    }

    // Temblante: el daño depende del arma (src: { w, dist, n, big, k }). Devuelve 'block' si no le hace nada
    tembHit(kind, part, src, behind, side, dx, dz) {
      const s = src || {};
      let d = 0;
      const nShots = stkShots(s, kind, part, 'temb');
      if (nShots) d = TEMB.hp / nShots + 1e-4;
      else if (kind === 'shot') {
        if (s.w === 'shotgun') d = part === 'head' ? ((s.dist || 9) < 2.6 ? 100 : 50) : 25 * U.clamp((s.n || 4) / 4, 0.3, 1);
        else { const T = TEMB_DMG[s.w] || TEMB_DMG.pistol; d = part === 'head' ? T.head : (part === 'legs' ? T.legs : T.body); }
      } else if (s.w === 'runatk') d = s.big ? 25 : 0;
      else if (s.w === 'melee') d = s.d || 0;           // golpe normal con un arma cuerpo a cuerpo: casi nada
      else if (s.w === 'boom') d = (s.k || 0) >= 1 ? 100 : 60 * (s.k || 0);
      this.flinch = side || (Math.random() < 0.5 ? 1 : -1);
      if (d <= 0) return 'block';
      this.hp -= d;
      if (this.hp <= 1e-6) { this.hp = 0; this.die(behind ? 1 : -1); return 'kill'; }
      // los disparos no lo frenan: una sacudida (a la cabeza, un tirón si no está embistiendo ni pegando)
      this.twitch = 1; this.twitchKind = part === 'head' ? 2 : 3;
      if (kind === 'shot' && part === 'head' && (this.state === 'chase' || this.state === 'recover' || this.state === 'idle' || this.state === 'wander' || this.state === 'investigate' || this.state === 'sus')) {
        this.react('shot', this.flinch, dx, dz); this.kb.x *= 0.4; this.kb.z *= 0.4;
      }
      return 'hit';
    }

    // Persiguiéndote varios a la vez: no van en fila. Si otro va por delante en la misma dirección, este se
    // abre por un lado y te rodea (el punto al que va gira alrededor de ti); de cerca va directo
    flankGoal(player, all, dist, sameLv, dt) {
      const px = player.pos.x, pz = player.pos.z;
      if (!sameLv || dist < 2.6) { this.flankA = (this.flankA || 0) * Math.max(0, 1 - dt * 4); return null; }
      const myA = Math.atan2(this.pos.x - px, this.pos.z - pz);
      let push = 0, ahead = false;
      for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o === this || !o.alive || o.downed || (o.lv || 0) !== (this.lv || 0)) continue;
        if (o.state !== 'chase' && o.state !== 'attack' && o.state !== 'combo' && o.state !== 'recover') continue;
        const od = Math.hypot(o.pos.x - px, o.pos.z - pz);
        if (od >= dist || od > 18) continue;
        const dA = U.angleDiff(myA, Math.atan2(o.pos.x - px, o.pos.z - pz));
        if (Math.abs(dA) < 0.7) { ahead = true; push += (dA >= 0 ? 1 : -1) * (0.7 - Math.abs(dA)); }
      }
      if (this.flankSide == null) this.flankSide = Math.random() < 0.5 ? -1 : 1;
      const side = Math.abs(push) > 0.05 ? Math.sign(push) : this.flankSide;
      const want = ahead ? side * Math.min(1.25, 0.55 + dist * 0.06) : 0;
      this.flankA = (this.flankA || 0) + (want - (this.flankA || 0)) * Math.min(1, dt * 2);
      if (Math.abs(this.flankA) < 0.06) return null;
      // punto a un lado de ti: girado flankA desde donde viene, a una distancia que se acorta al acercarse
      const a = myA + this.flankA, r = Math.min(4.5, dist * 0.55);
      const gx = px + Math.sin(a) * r, gz = pz + Math.cos(a) * r;
      if (G.World.circleBlocked(gx, gz, 0.35, this.lv)) return null;
      const g = this._fg || (this._fg = { x: 0, z: 0, lv: 0 });
      g.x = gx; g.z = gz; g.lv = this.lv || 0;
      return g;
    }

    // Embestida del temblante: se fija en dónde estás, grita mientras carga y sale disparado hacia ese punto
    startCharge(px, pz) {
      const dx = px - this.pos.x, dz = pz - this.pos.z, d = Math.hypot(dx, dz) || 1;
      this.chg = { x0: this.pos.x, z0: this.pos.z, ux: dx / d, uz: dz / d, len: d + this.T.over, t: 0, hit: false };
      this.enter('tcharge', this.T.windup);
      this.reach = 0; this.path = null; this.edge = null;
      G.World.emit(this.pos.x, this.pos.z, 22, this.lv);
    }
    // Acechador: ¿lo estás viendo? 0 no, 1 en pantalla, 2 lo miras de frente
    seenBy(player, dist) {
      if (player.dead || dist > 34) return 0;
      const C = G.Camera, f = C && C.forward ? C.forward() : null;
      if (!f) return 0;
      const cx = C.pos ? C.pos.x : player.pos.x, cz = C.pos ? C.pos.z : player.pos.z;
      const vx = this.pos.x - cx, vz = this.pos.z - cz, vl = Math.hypot(vx, vz) || 1, fl = Math.hypot(f.x, f.z) || 1;
      const c = (vx * f.x + vz * f.z) / (vl * fl);
      if (c < 0.62) return 0;
      // agachado (acechador quieto en su escondite): se le ve de más cerca y solo mirándolo casi de frente
      if ((this.crouchK || 0) > 0.6 && (dist > 16 || c < 0.8)) return 0;
      if ((player.lv || 0) !== (this.lv || 0) || !G.World.hasLOS(player.pos.x, player.pos.z, this.pos.x, this.pos.z, this.lv)) return 0;
      return c > 0.9 ? 2 : 1;
    }
    // Sitio al que ir: para acechar, a unos 10 m de ti y fuera de tu vista; para esconderse, lo más cercano que
    // lo tape y lejos de ti
    findSpot(player, hide) {
      const W = G.World, lv = this.lv || 0, px = player.pos.x, pz = player.pos.z;
      const C = G.Camera, f = C && C.forward ? C.forward() : { x: 0, z: 1 }, fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl;
      let best = null, bs = -1e9;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
        for (const r of hide ? [2.5, 5, 8] : [3.5, 7]) {
          const x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
          if (W.circleBlocked(x, z, 0.4, lv)) continue;
          const dpx = x - px, dpz = z - pz, dp = Math.hypot(dpx, dpz) || 1;
          const hidden = !W.hasLOS(px, pz, x, z, lv);
          const inView = (dpx * fx + dpz * fz) / dp > 0.62;
          let s = (hidden ? 6 : 0) + (inView && !hidden ? -4 : 1.5) - r * 0.3;
          if (hide) s += Math.min(dp, 14) * 0.3;
          else s -= Math.abs(dp - 10) * 0.5;
          if (!W.hasClearLine(this.pos.x, this.pos.z, x, z, lv)) s -= 2.5;
          if (this.nemi && G.BossFx) s += G.BossFx.hideBonus(x, z);
          // algo pegado entre el sitio y tú (un auto, un murete...): agachado detrás, no se le ve
          if (this.stalker && W.circleBlocked(x - dpx / dp * 0.8, z - dpz / dp * 0.8, 0.25, lv)) s += 3;
          if (this.stalker && !this.nemi && W.sunlit(x, z, lv)) s -= 9;          // (prefiere la sombra)
          if (s > bs) { bs = s; best = { x, z, lv }; }
        }
      }
      return best;
    }
    // ---------- Necesidades que compiten ----------
    // Un susto (ve caer a otro, o el fuego cerca): si el miedo le pesa más que las ganas de ir a por ti, se aparta
    // unos pasos (1 o 2 s) y luego vuelve a lo suyo. Los valientes y los agresivos casi no se inmutan
    scare(x, z, amount) {
      if (!this.alive || BUSY[this.state] && this.state !== 'chase' || this.state === 'avoid' || this.burnT > 0) return;
      // (menos miedosos que antes: cuesta más asustarlos y, si se apartan, es menos y por menos tiempo)
      const fear = amount * (1.25 - this.pers.brave) * 0.75;
      const drive = 0.3 + this.pers.agr * 0.6 + (this.state === 'chase' ? 0.3 : 0) + (this.blind && this.locked ? 1 : 0);
      if (fear <= drive) return;
      const a = Math.atan2(this.pos.x - x, this.pos.z - z) + (Math.random() - 0.5) * 0.8;
      const back = 1.8 + fear * 2;
      this.avoid = { x: this.pos.x + Math.sin(a) * back, z: this.pos.z + Math.cos(a) * back, prev: this.state };
      this.enter('avoid', 0.5 + fear * 1.0);
    }
    // Lo más cerca a la sombra (acechadores): dentro de una casa, bajo un porche o un árbol
    findShade(lv) {
      const W = G.World;
      lv = lv || 0;
      let best = null, bd = 1e9;
      for (const r of [1.5, 3, 5, 8, 12]) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
          if (W.circleBlocked(x, z, 0.35, lv) || W.sunlit(x, z, lv)) continue;
          const d = r + (W.hasClearLine(this.pos.x, this.pos.z, x, z, lv) ? 0 : 4);
          if (d < bd) { bd = d; best = { x, z, lv }; }
        }
        if (best) break;
      }
      return best;
    }
    // Cada 0,25 s: miedo al fuego (todos) y rechazo a la luz del sol (acechadores) frente a sus ganas de cazar
    needs(dt, player, dist) {
      this.needT = (this.needT || 0) - dt;
      if (this.frenzy > 0) this.frenzy -= dt;
      if (this.temb || this.hongo || this.state === 'dead' || this.burnT > 0) return;
      const W = G.World;
      // acechador al sol: se le acumula; según lo agresivo que sea aguanta más o menos antes de volver a la sombra
      if (this.stalker && !this.nemi) {
        const lit = W.sunlit(this.pos.x, this.pos.z, this.lv);
        this.sunT = lit ? this.sunT + dt : Math.max(0, this.sunT - dt * 2);
        const tol = this.state === 'ambush' || this.state === 'chase' ? 0.8 + this.pers.agr * 3.2 : 0.4;
        const goingShade = this.state === 'hide' && this.sunHide && this.spot && !W.sunlit(this.spot.x, this.spot.z, this.lv);
        if (!lit) this.sunHide = false;
        // atascado al sol sin llegar a la sombra: se vuelve loco
        if (goingShade && this.sunT > 9 && !(this.frenzy > 0)) { this.sunHide = false; this.frenzy = 5; this.mad = STALK.madT; this.sunT = 0; this.enter('chase', 0); }
        if (lit && this.sunT > tol && !goingShade && !(this.frenzy > 0) && this.state !== 'avoid' && !BUSY_FIGHT[this.state]) {
          const sh = this.findShade(this.lv);
          if (sh) {
            this.spot = sh; this.mad = 0; this.sunAway = 4; this.sunHide = true;
            this.enter('hide', 8);
          } else {
            // sin sombra cerca: se vuelve loco y ataca
            this.frenzy = 5; this.mad = STALK.madT; this.sunT = 0;
            if (this.state !== 'chase') this.enter('chase', 0);
          }
        }
        if (this.sunAway > 0) this.sunAway -= dt;
      }
      if (this.needT > 0) return;
      this.needT = 0.25;
      // fuego cerca (molotov encendida): miedo según lo cerca que esté
      const zones = G.Fire && G.Fire.zones;
      if (zones && zones.length) {
        for (const zn of zones) {
          if (zn.t > 7 || (zn.lv || 0) !== (this.lv || 0)) continue;
          const d = Math.hypot(this.pos.x - zn.x, this.pos.z - zn.z);
          if (d < 4.5) { this.scare(zn.x, zn.z, 0.9 * (1 - d / 5)); break; }
        }
      }
    }

    // Tras agarrarte (te soltaras o no): huye a esconderse y desde ahí avisa a los demás
    afterGrab() {
      if (!this.stalker || !this.postGrab) return false;
      this.postGrab = false; this.alertPending = true; this.spot = null; this.unseenT = -2.5;
      this.enter('hide', 6);
      return true;
    }

    startThrow() {
      // al hongomorfo no se le puede eliminar por la espalda: se gira y te mata
      if (this.hongo) { const P = G.debug && G.debug.player; if (P && !P.dead) this.hongoHit(P); return; }
      this.thr = { t: 0, grabbed: false }; this.enter('tthrow', 0); this.reach = 0; this.path = null; this.edge = null; this.notice = 1; }
    endCharge(wall) {
      this.burstR = wall ? this.T.wallR : this.T.sporeR; this.burstDone = false; this.burstWall = !!wall;
      if (wall) { this.kb.x = -this.chg.ux * 1.5; this.kb.z = -this.chg.uz * 1.5; if (G.Camera && G.Camera.shake) G.Camera.shake(0.15); }
      this.enter('troar', this.T.roar);
      this.dashSp = 0;
    }

    // ---------- Hongomorfo ----------
    // Te alcanza (zarpazo o embestida): con más de la mitad de la vida, un manotazo que quita la mitad y te
    // lanza volando contra la pared más cercana; con la mitad o menos, te agarra y te despedaza. true si te mató
    hongoHit(player) {
      if (player.dead || player.bossKill) return true;
      if (player.health <= 50.5) { this.startKill(player); return true; }
      player.damage(50, 'Un hongomorfo te aplastó.');
      if (player.dead) return true;
      // hacia dónde sale: lejos de él, hacia la pared más cercana (dentro de un abanico de ±80°)
      const W = G.World, lv = player.lv || 0;
      const bx = player.pos.x - this.pos.x, bz = player.pos.z - this.pos.z;
      const base = Math.atan2(bx, bz), R = 12;
      let best = null;
      for (let k = -8; k <= 8; k++) {
        const a = base + k * 0.175, ux = Math.sin(a), uz = Math.cos(a);
        const f = W.lineHit(player.pos.x, player.pos.z, player.pos.x + ux * R, player.pos.z + uz * R, (e) => W.blocksWalkEdge(e), lv);
        const d = f < 0 ? R : f * R;
        // ¿algún mueble antes de la pared? (mejor una pared con el camino libre)
        let free = d;
        for (let t = 0.5; t < d - 0.35; t += 0.25) if (W.circleBlocked(player.pos.x + ux * t, player.pos.z + uz * t, 0.3, lv)) { free = t; break; }
        // sin pared libre cerca: sale lo más lejos que pueda y se estampa contra lo que haya
        const sc = (free < d - 0.4 ? 30 - Math.min(free, 7) : d) + Math.abs(k) * 0.12;     // (y de frente si la distancia es parecida)
        if (!best || sc < best.sc) best = { sc, d: Math.min(d, free + 0.3), ux, uz };
      }
      const d = Math.max(1.2, Math.min(9, best.d));
      const decay = 2.0, push = d * decay + 2.5;
      player.takePunch(this, 'launch', 1, push);
      player.facing = Math.atan2(-best.ux, -best.uz);               // (vuela de espaldas)
      player.blowKb = { x: best.ux * push, z: best.uz * push, decay };
      player.fly = { t: 0, dur: Math.min(1.0, 0.35 + d * 0.09), h: 0.55 + d * 0.06, hit: false, lx: player.pos.x, lz: player.pos.z };
      player.action = null; player.dodging = null; player.aiming = false;
      if (player.gun) player.gun.reload = null;
      if (G.Input && G.Input.setAim) G.Input.setAim(false);
      if (G.Camera.shake) G.Camera.shake(0.7);
      if (G.Camera.hurtFx) G.Camera.hurtFx(1.3, 1);
      if (G.Camera.wobble) G.Camera.wobble(0.8);
      if (G.Audio) { G.Audio.play('tackle'); G.Audio.play('hRoar', { x: this.pos.x, z: this.pos.z, lv: this.lv, z0: this }); }
      if (G.Mode && G.Mode.onMessage) G.Mode.onMessage('¡Otro golpe así y te despedaza!', 'bad');
      return false;
    }
    // Te despedaza: te levanta del suelo (dura HONGO.killT s; ver el estado 'hkill')
    startKill(player) {
      if (player.dead || player.bossKill) return;
      this.enter('hkill', 0); this.killT = 0; this.killDone = false; this.bites = 0;
      this.reach = 0; this.path = null; this.edge = null; this.kb.x = this.kb.z = 0; this.speedNow = 0;
      this.facing = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      player.bossKill = { z: this, t: 0 };
      player.lifted = { z: this, t: 0, boss: true };
      player.action = null; player.dodging = null; player.struggle = null; player.beaten = null; player.blow = null; player.blowKb = null;
      player.climb = null; player.healing = null; player.aiming = false;
      if (player.gun) player.gun.reload = null;
      if (G.Input && G.Input.setAim) G.Input.setAim(false);
      if (G.Camera.shake) G.Camera.shake(0.6);
      if (G.Camera.hurtFx) G.Camera.hurtFx(1.4, 0);
      if (G.Audio) { G.Audio.play('tackle'); G.Audio.play('hRoar', { x: this.pos.x, z: this.pos.z, lv: this.lv, z0: this }); }
    }
    // Encerrado en la guarida hasta que acaba el tiempo de saqueo
    sleep() { this.enter('hdorm', 0); this.speedNow = 0; this.facing = 0; }
    // Sale derribando la pared (br: aristas N en la línea z, de x0 a x1 - 1)
    burstOut(br) { this.enter('hburst', 0); this.burstT = 0; this.br = br; this.brDone = false; this.facing = 0; this.notice = 1; }
    // Persiguiendo: zarpazo para agarrarte de cerca, trozos de hongo de lejos y paredes que atraviesa. true si
    // empezó algo
    hongoChase(dt, player, dist, sees, sameLv, px, pz) {
      this.throwCD -= dt; this.wallCD -= dt;
      if (player.dead || player.bossKill) return false;
      const reachV = Math.abs((player.elev || 0) - (this.elev || 0)) < 2.3;     // llega hasta lo alto de una máquina
      // ¿hay una pared o una puerta en medio? (no cabe por las puertas: las derriba con la pared)
      this.walledT = (this.walledT || 0) - dt;
      if (this.walledT <= 0) { this.walledT = 0.2; this.walled = !G.World.hasClearLine(this.pos.x, this.pos.z, px, pz, this.lv); }
      if (dist < HONGO.reach && sameLv && reachV && !this.walled && (sees || dist < 1.4)) {
        this.enter('hgrab', HONGO.grabWind); this.lungeT = 0; this.grabDone = false; this.dodged = false;
        return true;
      }
      if (sees && sameLv && this.throwCD <= 0 && dist > HONGO.throwMin && dist < HONGO.throwMax) {
        this.enter('hrip', 0); this.ripT = 0; this.ripped = false; this.thrown = false;
        return true;
      }
      // una pared en medio (de las que se pueden derribar): embiste hacia ti y la atraviesa
      if (G.BossFx && this.wallCD <= 0 && sameLv && dist < 30 && (this.walled || this.stuck > 0.5)) {
        this.wallCD = dist < 3 ? 0.4 : 1.2;
        const ux = (px - this.pos.x) / (dist || 1), uz = (pz - this.pos.z) / (dist || 1);
        const ref = G.BossFx.wallAhead(this.pos.x, this.pos.z, ux, uz, Math.min(dist, 7));
        if (ref) { this.wallCD = 4; this.startCharge(px, pz); return true; }
      }
      return false;
    }
    // a su paso (o embistiendo) destroza las máquinas del salón que tiene delante
    hongoSmash(dt) {
      if (!this.hongo || !this.alive || !G.BossFx || this.state === 'hdorm' || this.state === 'hkill' || this.state === 'hgrab') return;
      this.smashCD = (this.smashCD || 0) - dt;
      if (this.smashCD > 0) return;
      const charging = this.state === 'tcharge' || this.state === 'tdash' || this.state === 'hburst';
      if (!charging && !((this.speedNow || 0) > 0.3) && !((this.stuck || 0) > 0.25)) return;
      const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
      const hits = G.World.furnNear(this.pos.x + fx * 0.6, this.pos.z + fz * 0.6, charging ? 0.9 : 0.7, this.lv || 0)
        .filter((h) => !h.f.gone && G.Furniture.T[h.f.type].smash);
      if (!hits.length) return;
      this.smashCD = 0.3;
      for (const h of hits) G.BossFx.smashFurn(h.c, h.f, fx, fz);
    }
    // ---- con hambre (al abrirse el exterior): caza acechadores para comérselos ----
    // ¿hay uno a mano? Va a por él si lo tiene más cerca que a ti (o si está herido y no lo tiene muy lejos)
    hongoPrey(dt, player, dist) {
      if (!this.hunger || !G.Population) return false;
      this.eatCD = (this.eatCD || 0) - dt;
      if (this.eatCD > 0 || this.hp >= this.hpMax - 1) return false;
      this.preyT = (this.preyT || 0) - dt;
      if (this.preyT > 0) return false;
      this.preyT = 0.5;
      let best = null, bd = 1e9;
      for (const q of G.Population.list) {
        if (!q.alive || !q.stalker || q.nemi || q.state === 'eaten' || (q.lv || 0) !== (this.lv || 0)) continue;
        const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
        if (d < bd) { bd = d; best = q; }
      }
      if (!best) return false;
      const hurt = this.hp < this.hpMax * 0.65;
      if (!(bd < dist - 1 || (hurt && bd < 24) || (dist > 9 && bd < 18))) return false;
      this.prey = best; this.huntT = 0; this.preyNow = null;
      this.enter('hhunt', 0); this.path = null;
      return true;
    }
    hongoFeed(dt, player) {
      const q = this.prey;
      if (this.state === 'hhunt') {
        this.huntT += dt;
        const pd = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        // se le escapa, se cansa de perseguirlo o te tiene a mano: vuelve a por ti
        if (!q || !q.alive || q.state === 'eaten' || this.huntT > 14 || (pd < 2.4 && !player.dead && !player.bossKill)) {
          this.prey = null; this.eatCD = 2; this.target = { x: player.pos.x, z: player.pos.z, lv: player.lv || 0 }; this.enter('chase', 0); return;
        }
        const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
        if (d < 1.9 && Math.abs((q.elev || 0) - (this.elev || 0)) < 1.5) {
          // lo atrapa
          this.enter('heat', 0); this.eatT = 0; this.bites = 0; this.preyNow = q; this.speedNow = 0;
          this.facing = Math.atan2(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
          q.enter('eaten', 0); q.eater = this; q.path = null; q.spot = null; q.sunHide = false;
          if (G.Audio) { G.Audio.play('hRoar', { x: this.pos.x, z: this.pos.z, lv: this.lv, z0: this }); G.Audio.play('tackle', { x: q.pos.x, z: q.pos.z, lv: q.lv }); }
          return;
        }
        this.target = { x: q.pos.x, z: q.pos.z, lv: q.lv || 0 };
        const moved = this.stepToward(this.target, HONGO.chase * 1.12, dt);
        this.speedNow = moved;
        this.phase += dt * (1.4 + moved * 5.5);
        if (moved < 0.5) this.stuck = (this.stuck || 0) + dt; else this.stuck = 0;
        this.hongoSteps(dt, player); this.hongoSmash(dt);
        return;
      }
      // 'heat': lo levanta, le da bocados y lo despedaza
      this.eatT += dt;
      this.speedNow = 0;
      const p = this.preyNow;
      if (!p || !p.alive) { this.preyNow = null; this.prey = null; this.eatCD = 3; this.enter('troar', HONGO.roar); return; }
      const f = this.facing;
      const n = Math.floor((this.eatT - 0.6) / 0.35);
      if (this.eatT > 0.6 && n >= this.bites && this.eatT < 2.0) {
        this.bites = n + 1;
        if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(p.pos.x, p.y + (p.lift || 0) + 1.5, p.pos.z), new THREE.Vector3(Math.sin(f), 0.6, Math.cos(f)), true, 9);
        if (G.Audio) G.Audio.play('gore', { x: p.pos.x, z: p.pos.z, lv: p.lv || 0, vol: 0.8 });
      }
      if (this.eatT >= 2.2) {
        // lo despedaza y recupera un 20 % de la vida
        p.eater = null; p.lift = 0;
        if (G.Gore) G.Gore.explode(p, Math.sin(f), Math.cos(f), 0.8, 'hongo');
        else { p.hp = 0; p.killedBy = 'hongo'; p.die(-1); }
        const before = this.hp;
        this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.2);
        this.preyNow = null; this.prey = null; this.eatCD = 5;
        if (G.Audio) G.Audio.play('gore', { big: true, x: this.pos.x, z: this.pos.z, lv: this.lv || 0 });
        if (G.Mode && G.Mode.onBossAte) G.Mode.onBossAte(this, this.hp - before);
        this.target = { x: player.pos.x, z: player.pos.z, lv: player.lv || 0 };
        this.enter('troar', HONGO.roar);
      }
    }
    // pasos que hacen temblar el suelo
    hongoSteps(dt, player) {
      if (!this.hongo || !(this.speedNow > 1)) return;
      this.stepAcc = (this.stepAcc || 0) + this.speedNow * dt;
      if (this.stepAcc < 1.45) return;
      this.stepAcc = 0;
      const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      if (d < 11 && G.Camera.shake) G.Camera.shake(0.07 + 0.12 * (1 - d / 11));
    }
    // pose propia del hongomorfo (o null)
    hongoPose() {
      if (!this.hongo) return null;
      if (this.state === 'hrip') return { kind: 'H_rip', t: Math.min(1, this.ripT / (HONGO.ripT + 0.45)) };
      if (this.state === 'hkill') return { kind: 'H_kill', t: Math.min(1, this.killT / HONGO.killT) };
      if (this.state === 'heat') return { kind: 'H_kill', t: Math.min(0.8, (this.eatT || 0) / 2.2 * 0.82) };
      if (this.state === 'hdorm') return { kind: 'H_dorm', t: 0.5 + 0.5 * Math.sin((this.time || 0) * 0.9) };
      return null;
    }

    // Reacción a un golpe: retrocede trastabillando hacia donde lo empujan y el cuerpo acusa el golpe
    react(kind, side, dx, dz) {
      const R = REACT[kind] || REACT.side;
      this.reach = 0;
      this.edge = null;
      this.reactKind = kind;
      this.reactDur = R.dur * (0.9 + Math.random() * 0.2);
      this.push(dx, dz, side, kind, 1);
      this.enter('stagger', this.reactDur);
      this.stagger = 0.001;
    }

    // empuje del golpe: hacia atrás y algo de lado (en la dirección en que iba el golpe)
    push(dx, dz, side, kind, mul) {
      const R = REACT[kind] || REACT.side;
      const l = Math.hypot(dx, dz) || 1;
      const fx = dx / l, fz = dz / l;
      // lateral: la derecha del zombi es la izquierda de quien pega, que mira hacia (fx, fz)
      const lx = fz, lz = -fx;
      const f = R.force * (mul || 1);
      this.kb.x = (fx + lx * side * R.lat) * f; this.kb.z = (fz + lz * side * R.lat) * f;
      this.wallHit = false;
    }

    doStagger(dx, dz, force) {
      const l = Math.hypot(dx, dz) || 1;
      this.reactKind = 'push';
      this.reactDur = 0.55;
      this.kb.x = dx / l * force; this.kb.z = dz / l * force;
      this.reach = 0;
      this.edge = null;
      this.enter('stagger', 0.55);
      this.stagger = 0.001;
    }

    // extra: segundos de más en el suelo (el empujón añade 2)
    knockDown(dir, dx, dz, extra) {
      // ya no se caen al suelo: se tambalean hacia atrás
      if (NO_FALL) { this.react('heavy', this.flinch || 1, dx, dz); return; }
      const l = Math.hypot(dx, dz) || 1;
      this.kb.x = dx / l * 1.2; this.kb.z = dz / l * 1.2;
      this.fallDir = dir;
      this.reach = 0;
      this.edge = null;
      this.homebound = false;
      this.enter('down', 2.5 + Math.random() * 2 + (extra || 0));
    }

    // Agarrado por la espalda: se queda delante del jugador forcejeando hasta morir
    grab(player) {
      this.grabber = player;
      this.reach = 0;
      this.edge = null;
      this.path = null;
      this.homebound = false;
      this.enter('grabbed', 0);
    }

    release() {
      this.grabber = null;
      this.target = null;
      this.doStagger(Math.sin(this.facing), Math.cos(this.facing), 1.5);
    }

    // Acechador: se tira al suelo como si estuviera muerto (una sola vez). dir: hacia dónde cae
    feign(dir) {
      if (!this.stalker || this.nemi || this.feigned || !this.alive) return false;
      this.feigned = true;
      this.fallDir = dir || (Math.random() < 0.5 ? 1 : -1);
      this.reach = 0; this.edge = null; this.spot = null; this.crouchK = 0;
      this.state = 'feign'; this.timer = 0;
      return true;
    }
    // se levanta de golpe (near: estás al lado y va a agarrarte)
    feignUp(near) {
      this.postFeign = !!near;
      this.riseDur = near ? 0.4 : 0.8;
      this.enter('rise', this.riseDur);
      if (G.Audio && near) G.Audio.play('zAlert', { x: this.pos.x, z: this.pos.z, lv: this.lv, z0: this, runner: true });
    }
    die(dir) {
      // los de alrededor que lo ven caer se asustan (según lo valientes y agresivos que sean)
      if (this.state !== 'dead' && G.Population) {
        for (const q of G.Population.list) {
          if (q === this || !q.alive || q.temb || q.hongo || q.nemi || (q.lv || 0) !== (this.lv || 0)) continue;
          const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
          if (d < 7 && G.World.hasLOS(q.pos.x, q.pos.z, this.pos.x, this.pos.z, q.lv)) q.scare(this.pos.x, this.pos.z, 0.55 * (1 - d / 9));
        }
      }
      this.fallDir = dir;
      this.reach = 0;
      this.edge = null;
      this.state = 'dead';
      this.timer = 0;
      // temblante: cae, se retuerce (como el que se quema en el suelo) y a los 1 o 2 s revienta en esporas
      if (this.temb && !this.popped && this.popT == null) { this.popT = this.T.pop[0] + Math.random() * (this.T.pop[1] - this.T.pop[0]); this.rollT = 0; this.writhe = true; this.burnT = 0; this.kb.x = this.kb.z = 0; }
    }
    pop(player) {
      this.popped = true; this.writhe = false;
      if (G.Spores) G.Spores.burst(this.pos.x, this.y, this.pos.z, this.lv || 0, this.T.popR, this, player, true);
      if (G.Gore) G.Gore.explode(this, Math.random() - 0.5, Math.random() - 0.5, 0.9, this.killedBy || 'temb');
    }

    // ---------- IA ----------
    // el hongomorfo es demasiado grande para las puertas: mientras se actualiza, el mundo lo trata como «grande»
    update(dt, player, all, combat) {
      if (!this.hongo) { const r = this.step(dt, player, all, combat); if (this.chain) this.chainClamp(); return r; }
      G.World.setBig(true);
      try { return this.step(dt, player, all, combat); } finally { G.World.setBig(false); }
    }
    // encadenado a un poste (los chasqueadores del capitolio): no pasa del largo de la cadena
    chainClamp() {
      const C = this.chain, dx = this.pos.x - C.x, dz = this.pos.z - C.z, d = Math.hypot(dx, dz);
      if (d > C.r && this.alive) { this.pos.x = C.x + dx / d * C.r; this.pos.z = C.z + dz / d * C.r; }
    }
    step(dt, player, all, combat) {
      // si lo interrumpen (le pegas, lo aturdes, muere...), deja de tenerte atrapada
      if (player.beaten && player.beaten.z === this && this.state !== 'combo' && this.state !== 'runatk') player.beaten = null;
      // quemándose: va perdiendo vida mientras le duran las llamas
      if (this.temb && this.burnLeft > 0 && this.alive) {
        const b = Math.min(this.burnLeft, 50 / BURN_T * dt);
        this.burnLeft -= b; this.hp -= b;
        if (this.hp <= 1e-6) { this.hp = 0; this.killedBy = 'fire'; this.endCombo(player); this.die(-1); }
      }
      if (this.burnT > 0) {
        this.burnT -= dt;
        if (this.alive && this.state !== 'burnroll' && !this.temb) {
          this.hp -= BURN_DPS * dt;
          if (this.hp <= 0) { this.killedBy = 'fire'; this.endCombo(player); this.die(Math.random() < 0.5 ? 1 : -1); }
        }
      }
      if (this.rag) { this.stepRag(dt, player); this.apply(dt); return; }
      // en las garras del hongomorfo, que se lo está comiendo: colgando delante de su cara, pataleando
      if (this.state === 'eaten') {
        const e = this.eater;
        if (!e || !e.alive || e.state !== 'heat' || e.preyNow !== this) { this.eater = null; this.lift = 0; this.enter('stagger', 0.6); this.reactDur = 0.6; this.apply(dt); return; }
        const f = e.facing, tx = e.pos.x + Math.sin(f) * 0.95, tz = e.pos.z + Math.cos(f) * 0.95, k = Math.min(1, dt * 12);
        this.pos.x += (tx - this.pos.x) * k; this.pos.z += (tz - this.pos.z) * k;
        this.facing = f + Math.PI;
        this.lift = 0.75 * U.smooth(U.clamp(e.eatT / 0.45, 0, 1));
        this.stagger = 0.5 + 0.5 * Math.sin((e.eatT || 0) * 19);
        this.speedNow = 0;
        this.apply(dt);
        return;
      }
      if (this.state === 'burning') {
        // se sacude las llamas dando tumbos, sin hacerte caso
        this.timer -= dt; this.burnWob = (this.burnWob || 0) + dt;
        this.facing += Math.sin(this.burnWob * 2.3 + (this.look.seed || 0)) * 2.2 * dt;
        const sp = 0.45 + 0.35 * Math.sin(this.burnWob * 3.1);
        G.World.move(this.pos, Math.sin(this.facing) * sp * dt, Math.cos(this.facing) * sp * dt, this.rad, this.lv, this.elev);
        this.speedNow = sp; this.phase += dt * 4;
        this.knockback(dt);
        if (this.timer <= 0) { this.enter('chase', 0); this.target = { x: player.pos.x, z: player.pos.z, lv: player.lv || 0 }; this.lastSeen = 0; }
        this.apply(dt);
        return;
      }
      if (this.state === 'burnroll') {
        // cae y se revuelca en el suelo; al final muere
        this.timer -= dt; this.rollT = (this.rollT || 0) + dt;
        this.fall = Math.min(1, this.fall + dt * 2.6);
        this.speedNow = 0;
        if (this.timer <= 0) { this.hp = 0; this.killedBy = 'fire'; this.die(-1); this.fall = 1; }
        this.apply(dt);
        return;
      }
      if (this.state === 'dead') {
        if (this.popT != null && !this.popped) {
          this.popT -= dt; this.rollT = (this.rollT || 0) + dt;
          this.fall = Math.min(1, this.fall + dt * 2.6); this.speedNow = 0;
          if (this.popT <= 0) this.pop(player);
          this.apply(dt);
          return;
        }
        this.fall = Math.min(1, this.fall + dt * 2.2);
        this.knockback(dt);
        this.apply(dt);
        return;
      }
      const px = player.pos.x, pz = player.pos.z;
      const dx = px - this.pos.x, dz = pz - this.pos.z;
      const dist = Math.hypot(dx, dz);
      let speed = 0;
      const plv = player.lv || 0;
      const sameLv = plv === (this.lv || 0);
      // a la misma altura (para pegar o agarrar): no desde abajo de un contenedor a quien está encima
      const reachV = Math.abs((player.elev || 0) - (this.elev || 0)) < 1.2;

      // estados sin control
      if (this.state === 'grapple') {
        const st = player.struggle;
        if (!st || st.z !== this || player.dead) { this.enter('recover', 0.6); this.apply(dt); return; }
        // pegado delante de ella, empujando para morder
        const f = { x: Math.sin(player.facing), z: Math.cos(player.facing) };
        const tx = player.pos.x + f.x * 0.5, tz = player.pos.z + f.z * 0.5;
        const k = Math.min(1, dt * 12);
        this.pos.x += (tx - this.pos.x) * k; this.pos.z += (tz - this.pos.z) * k;
        this.facing = U.turnToward(this.facing, player.facing + Math.PI, 14 * dt);
        this.grappleT = st.t; this.speedNow = 0;
        this.apply(dt);
        return;
      }
      if (this.state === 'stun') {
        this.timer -= dt; this.stunT = (this.stunT || 0) + dt;
        this.knockback(dt);
        if (this.timer <= 0) { this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0; if (!this.afterGrab()) this.enter('chase', 0); }
        this.phase += dt * 1.5;
        this.apply(dt);
        return;
      }
      if (this.state === 'held') {
        const a = player.action;
        if (!a || a.target !== this || !a.exec || player.dead) { this.stun(0.8); this.apply(dt); return; }
        this.heldT = a.t; this.speedNow = 0;
        this.apply(dt);
        return;
      }
      if (this.state === 'hdorm') {
        // en la guarida: respira, quieto, detrás de la pared
        this.speedNow = 0; this.reach = 0;
        this.apply(dt);
        return;
      }
      if (this.state === 'hburst') {
        // grita, atraviesa la pared de un golpe y entra en la sala
        this.burstT += dt;
        const b = this.br;
        if (!this.brDone && this.burstT >= 1.05) {
          this.brDone = true;
          if (G.BossFx && b) G.BossFx.breakAround({ o: 'N', x: Math.floor((b.x0 + b.x1) / 2), z: b.z, lv: 0 }, Math.ceil((b.x1 - b.x0) / 2), 0, 1);
        }
        if (this.burstT > 1.0 && this.burstT < 2.3) {
          const sp = this.burstT < 1.25 ? 4.5 : 2.2;
          G.World.move(this.pos, 0, sp * dt, this.rad, this.lv, this.elev);
          this.speedNow = sp;
        } else this.speedNow = 0;
        this.phase += dt * (1.4 + this.speedNow * 5.5);
        if (this.burstT >= 2.3) { this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0; this.screamed = true; this.endCharge(false); this.dashSp = 0; }
        this.apply(dt);
        return;
      }
      if (this.state === 'hkill') {
        const K = player.bossKill;
        this.killT += dt;
        const u = this.killT / HONGO.killT;
        if (K && K.z === this && !this.killDone) {
          K.t = Math.min(1, u);
          if (player.lifted) player.lifted.t = u;
          // la tiene delante, levantada a la altura de su cara
          const f = this.facing, rd = 0.95;
          const tx = this.pos.x + Math.sin(f) * rd, tz = this.pos.z + Math.cos(f) * rd;
          const k = Math.min(1, dt * 12);
          player.pos.x += (tx - player.pos.x) * k; player.pos.z += (tz - player.pos.z) * k;
          player.facing = f + Math.PI;
          player.climbLift = 0.6 * U.smooth(U.clamp((u - 0.05) / 0.2, 0, 1));
          // mordiscos: sangre, sacudidas y vida que se va
          if (u > 0.42 && u < 0.8) {
            const n = Math.floor((u - 0.42) / 0.075);
            if (n >= this.bites) {
              this.bites = n + 1;
              if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(player.pos.x, player.y + player.climbLift + 1.55, player.pos.z), new THREE.Vector3(Math.sin(f), 0.6, Math.cos(f)), true, 9);
              if (G.Camera.shake) G.Camera.shake(0.35);
              if (G.Audio) G.Audio.play('gore', { vol: 0.85 });
              player.health = Math.max(1, player.health - 14); player.hurt = 0.5;
            }
          }
          // la despedaza
          if (u >= 0.82) {
            this.killDone = true;
            for (let i = 0; i < 4; i++) if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(player.pos.x, player.y + player.climbLift + 1.5, player.pos.z), new THREE.Vector3((Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2), true, 14);
            if (G.Audio) G.Audio.play('gore', { big: true });
            if (G.Camera.shake) G.Camera.shake(0.8);
            player.lifted = null; player.climbLift = 0;
            player.damage(999, 'Un hongomorfo te despedazó.');
            if (!player.dead) player.die('Un hongomorfo te despedazó.');
            if (G.fadeTo) G.fadeTo(1, 1.4);
          }
        } else if (!this.killDone) { this.enter('chase', 0); this.apply(dt); return; }
        this.speedNow = 0;
        if (u >= 1.3) { this.enter('troar', HONGO.roar); this.burstDone = true; }
        this.apply(dt);
        return;
      }
      // hongomorfo con hambre: va a por un acechador y se lo come (recupera vida)
      if (this.state === 'hhunt' || this.state === 'heat') { this.hongoFeed(dt, player); this.apply(dt); return; }
      if (this.state === 'grabbed') {
        const p = this.grabber, a = p && p.action;
        if (!p || p.dead || !a || a.kind !== 'grab' || a.target !== this) { this.release(); this.apply(dt); return; }
        const f = { x: Math.sin(p.facing), z: Math.cos(p.facing) };
        const tx = p.pos.x + f.x * 0.36, tz = p.pos.z + f.z * 0.36;
        const k = Math.min(1, dt * 14);
        this.pos.x += (tx - this.pos.x) * k; this.pos.z += (tz - this.pos.z) * k;
        this.facing = U.turnToward(this.facing, p.facing, 12 * dt);
        this.grabT = Math.min(1, a.t);
        this.speedNow = 0;
        this.apply(dt);
        return;
      }
      if (this.state === 'stagger') {
        this.timer -= dt;
        this.stagger = 1 - this.timer / (this.reactDur || 0.55);
        this.knockback(dt);
        if (this.timer <= 0) { this.stagger = 0; this.enter(this.target ? 'chase' : 'idle', 0); }
        this.apply(dt);
        return;
      }
      // acechador haciéndose el muerto: tirado como un rematado. Se levanta de golpe si pasas cerca (si estás al
      // lado, te agarra), si te alejas mucho o al rato
      if (this.state === 'feign') {
        this.fall = Math.min(1, this.fall + dt * 2.5);
        this.knockback(dt);
        this.timer += dt;
        const near = sameLv && dist < 2.4 && this.timer > 1.2 && !player.dead && !player.struggle && !player.beaten && !player.lifted;
        if (near || this.timer > 45 || dist > 30) this.feignUp(near);
        this.apply(dt);
        return;
      }
      if (this.state === 'down') {
        this.fall = Math.min(1, this.fall + dt * 2.5);
        this.knockback(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.enter('rise', 1.3);
        this.apply(dt);
        return;
      }
      if (this.state === 'rise') {
        this.timer -= dt;
        this.fall = Math.max(0, this.timer / (this.riseDur || 1.3));
        if (this.timer <= 0) {
          this.fall = 0; this.riseDur = 0;
          this.target = { x: px, z: pz, lv: plv };
          // (se hacía el muerto y estás al lado: te agarra; si no, va a por ti)
          if (this.postFeign && dist < 2.5 && sameLv && !player.dead && !player.struggle && !player.beaten && !player.lifted && combat) {
            this.postFeign = false; combat.startStruggle(player, this); this.postGrab = true;
          } else { this.postFeign = false; this.mad = Math.max(this.mad || 0, STALK.madT * 0.6); this.enter('chase', 0); }
        }
        this.apply(dt);
        return;
      }
      if (this.state === 'climb') {
        const c = this.climbing;
        c.t += dt / c.dur;
        const t = Math.min(1, c.t);
        if (c.ledge) {
          // trepa al techo del contenedor: se agarra, sube y pasa por encima
          const up = U.smooth(U.clamp((t - 0.1) / 0.6, 0, 1)), over = U.smooth(U.clamp((t - 0.55) / 0.45, 0, 1));
          this.pos.x = U.lerp(c.x0, c.x1, over); this.pos.z = U.lerp(c.z0, c.z1, over);
          this.elev = U.lerp(c.h0, c.h1, up);
          this.lift = 0;
          if (c.t >= 1) { this.elev = c.h1; this.climbing = null; this.enter('chase', 0); this.path = null; }
          this.phase += dt * 3;
          this.apply(dt);
          return;
        }
        this.pos.x = U.lerp(c.x0, c.x1, U.smooth(t));
        this.pos.z = U.lerp(c.z0, c.z1, U.smooth(t));
        this.lift = Math.sin(Math.PI * t) * 0.6;
        if (c.t >= 1) { this.lift = 0; this.climbing = null; this.enter(this.resume, 14); this.path = null; }
        this.phase += dt * 3;
        this.apply(dt);
        return;
      }

      // ---- sentidos ----
      let sees = false;
      // si ya te persigue no te pierde por agacharte; si no, agachado te ve de más cerca y tarda en notarte
      const sneaky = (player.stealth || 0) > 0 && !this.aware();
      const R = this.runner;
      // en la hierba alta: tumbado solo te ven casi encima; agachado, bastante más cerca
      let grass = sneaky && player.inGrass ? (player.stealth === 2 ? 0.3 : 0.55) : 1;
      // agachado detrás de una valla o un muro bajo (en cobertura): desde el otro lado te ven mucho menos
      const cvr = player.cover;
      if (sneaky && cvr && cvr.low && (this.pos.x - px) * cvr.nx + (this.pos.z - pz) * cvr.nz < 0) grass = Math.min(grass, 0.35);
      // (de noche, con niebla o lluvia ven menos: G.Sky)
      const range = (sneaky ? (player.stealth === 2 ? PRONE_SIGHT : CROUCH_SIGHT) * (R ? 1.2 : 1) * grass * (player.stealthMul ? 0.5 + 0.5 * player.stealthMul() : 1) : (this.stalker ? STALK.sight : (R ? RUNNER.sight : SIGHT_RANGE))) * (0.88 + this.pers.alert * 0.24) * (G.Sky ? G.Sky.sight(false) : 1);
      if (dist < range && !player.dead) {
        const diff = Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing));
        if ((diff < (this.stalker ? STALK.fov : FOV_HALF) || (dist < 1.4 && diff < 1.6)) && sameLv && G.World.hasLOS(this.pos.x, this.pos.z, px, pz, this.lv)) sees = true;
        // una loma entre los dos tapa la vista (tumbado o agachado se tapa antes)
        if (sees && !this.lv && dist > 3) {
          const ph = player.y + (player.stealth === 2 ? 0.3 : (player.stealth === 1 ? 0.85 : 1.45));
          if (G.World.terrainBlocks(this.pos.x, this.pos.z, this.y + 1.6, px, pz, ph)) sees = false;
        }
        // detrás de algo (una caja, un coche, un árbol; un arbusto si vas agachada) que te tapa la cabeza: no te ve
        if (sees && dist > 1.6) {
          const hy = player.y + (player.elev || 0) + (player.stealth === 2 ? 0.32 : (player.stealth === 1 ? 0.95 : 1.58));
          if (G.World.coverHit(this.pos.x, this.pos.z, this.y + 1.55, px, pz, hy, this.lv, true) >= 0) sees = false;
        }
      }
      if (this.blind) {
        // no ve: solo nota lo que tiene delante de la cara (a un palmo). Oye tus pasos (más lejos que los
        // demás) y cualquier ruido, pero agachada y sin correr no te oye: por la espalda puedes llegar a él
        const quiet = (player.stance === 'crouch' || player.stance === 'prone') && !player.running;
        const front = Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing)) < 1.1;
        sees = !player.dead && sameLv && ((front && dist < (quiet ? 1.0 : BLIND.touch)) || (!quiet && dist < 0.8) || (this.aware() && dist < BLIND.touch));
        if (!sees && !quiet && player.noise > 0 && dist < player.noise * BLIND.hear && sameLv && this.hearTimer <= 0) {
          this.hearTimer = 0.35;
          this.target = { x: px, z: pz, lv: plv };
          this.locked = true;            // ya te oyó: a partir de ahora te encuentra siempre
          if (this.state !== 'attack' && this.state !== 'recover' && this.state !== 'combo' && this.state !== 'runatk') { if (this.state !== 'chase') this.enter('chase', 0); this.lastSeen = 0; }
        }
      } else if (this.hunter && !player.dead && dist < 90 && !sees && !this.aware()) {
        // de una oleada: sabe más o menos dónde estás y va hacia allí, pero tiene que verte para lanzarse
        this.huntT = (this.huntT || 0) - dt;
        if (this.huntT <= 0 && (this.state === 'idle' || this.state === 'wander' || this.state === 'investigate')) {
          this.huntT = 2.5;
          const e = Math.min(3, dist * 0.2);
          this.target = { x: px + (Math.random() - 0.5) * e * 2, z: pz + (Math.random() - 0.5) * e * 2, lv: plv };
          this.enter('investigate', 8);
        }
      }
      // reconocerte lleva un momento (salvo pegado a ti o si ya te persigue)
      let susp = false;
      if (sees && !this.blind && !this.aware() && dist > 1.6) {
        const nk = 0.75 + this.pers.alert * 0.5;           // (atentos: te reconocen antes)
        if (sneaky) this.notice += nk * dt * (1.6 - dist / range) / (NOTICE_TIME * (R ? RUNNER.notice : 1) * (player.stealth === 2 ? 1.5 : 1)) * (player.stealthMul ? player.stealthMul() : 1);
        else this.notice += nk * dt / (U.lerp(NOTICE_STAND[0], NOTICE_STAND[1], Math.min(1, dist / range)) * (this.hunter ? 0.75 : 1)) * (this.stalker ? STALK.notice : 1);
        if (this.notice < 1) { sees = false; susp = true; this.susAt = { x: px, z: pz, lv: plv }; }
      } else if (!sees) this.notice = Math.max(0, this.notice - dt * 0.3);
      let hearsRun = false;
      const blindQuiet = this.blind && (player.stance === 'crouch' || player.stance === 'prone') && !player.running;
      if (!sees && !blindQuiet && player.noise > 0 && dist < player.noise) {
        hearsRun = dist < player.noise * 0.6 || (sameLv && G.World.hasLOS(this.pos.x, this.pos.z, px, pz, this.lv));
      }
      this.hearTimer -= dt;

      // el chasqueado que ya te oyó no te pierde: sigue tu rastro adonde vayas (aunque te calles o te agaches) y se
      // vuelve más agresivo (ver BLIND_HUNT). Solo se suelta si te alejas mucho
      if (this.blind && this.locked && this.alive) {
        if (player.dead || dist > 60) this.locked = false;
        else if (!BUSY_FIGHT[this.state] && this.state !== 'dead') {
          this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0;
          if (this.state !== 'chase' && this.state !== 'attack' && this.state !== 'recover' && this.state !== 'combo') this.enter('chase', 0);
        }
      }
      // el hongomorfo, despierto, no te pierde nunca: siempre sabe dónde estás (aunque haya paredes en medio)
      if (this.hongo && !sees && !player.dead && this.state !== 'hdorm') {
        this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0; this.notice = 1; this.homebound = false;
        if (!ENGAGED[this.state] && !BUSY[this.state]) this.enter('chase', 0);
      }

      if (sees) {
        this.lastSeen = 0;
        this.homebound = false;
        this.target = { x: px, z: pz, lv: plv };
        if (!ENGAGED[this.state] && this.stalker && !(this.mad > 0)) { this.enter('stalk', 0); this.unseenT = 0; this.spot = null; }
        else if (!ENGAGED[this.state]) {
          // el corredor se para un instante y chilla (avisa a los de alrededor) antes de lanzarse
          if (R && !this.screamed) { this.screamed = true; this.enter('alert', ALERT_T); this.alertNearby(player, ALERT_R); }
          else this.enter('chase', 0);
        }
      } else {
        this.lastSeen += dt;
        if (hearsRun && this.hearTimer <= 0 && this.state !== 'attack' && this.state !== 'recover' && this.state !== 'combo' && this.state !== 'runatk' && !BUSY[this.state]) {
          this.hearTimer = 1;
          this.homebound = false;
          this.target = { x: px + (Math.random() - 0.5) * 1.5, z: pz + (Math.random() - 0.5) * 1.5, lv: plv };
          if (this.state !== 'chase' && this.state !== 'bang') this.enter('investigate', 14);
        }
        if (this.state === 'chase' && this.lastSeen > 0.8 + this.pers.persist * 2.4) this.enter('investigate', 7 + this.pers.persist * 10);   // (los tenaces tardan más en perderte)
        // el acechador te perdió del todo: vuelve a buscarte
        if ((this.state === 'stalk' || this.state === 'hide') && this.lastSeen > STALK.lose) { this.enter('investigate', 10); this.target = { x: px, z: pz, lv: plv }; }
      }
      // te está viendo pero aún no te reconoce: se para, te mira y se acerca despacio
      if (susp && (this.state === 'idle' || this.state === 'wander' || this.state === 'investigate')) { this.homebound = false; this.enter('sus', 0); }
      if (this.state === 'sus' && !susp) {
        // te escondiste a tiempo: va a mirar donde te vio
        this.target = this.susAt ? { x: this.susAt.x, z: this.susAt.z, lv: this.susAt.lv } : null;
        this.enter('investigate', 14);
      }

      this.reach = Math.max(0, this.reach - dt * 3);
      if (this.shriekT > 0) this.shriekT -= dt;
      this.needs(dt, player, dist);

      switch (this.state) {
        case 'avoid': {
          // apartándose de lo que lo asustó; después vuelve a lo suyo (si te vio, a por ti)
          this.timer -= dt;
          if (this.avoid) { this.target = { x: this.avoid.x, z: this.avoid.z, lv: this.lv }; speed = this.blind ? BLIND.chase * 0.7 : (R ? RUNNER.chase * 0.8 : CHASE_SPEED); }
          if (this.timer <= 0 || (this.avoid && Math.hypot(this.avoid.x - this.pos.x, this.avoid.z - this.pos.z) < 0.6)) {
            this.avoid = null;
            if (sees || this.hunter) { this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0; this.enter(this.stalker && !(this.mad > 0) ? 'stalk' : 'chase', 0); }
            else this.enter('idle', 1 + Math.random() * 2);
          }
          break;
        }
        case 'idle':
          this.timer -= dt;
          if (this.timer <= 0) {
            if (this.homebound) {
              // dentro de casa: da unos pasos sin salir de su habitación
              const a = Math.random() * Math.PI * 2, d = 0.8 + Math.random() * 2;
              const tx = this.pos.x + Math.sin(a) * d, tz = this.pos.z + Math.cos(a) * d;
              if (G.World.roomAt(Math.floor(tx), Math.floor(tz), this.lv) === this.homeRoom && G.World.hasClearLine(this.pos.x, this.pos.z, tx, tz, this.lv)) {
                this.target = { x: tx, z: tz, lv: this.lv }; this.enter('wander', 6);
              } else this.timer = 1 + Math.random() * 2;
              break;
            }
            const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 6;
            const tx = this.pos.x + Math.sin(a) * d, tz = this.pos.z + Math.cos(a) * d;
            if (!G.World.solidObj(G.World.obj(Math.floor(tx), Math.floor(tz), this.lv)) && (!this.lv || G.World.isIndoor(Math.floor(tx), Math.floor(tz), 1))) { this.target = { x: tx, z: tz, lv: this.lv }; this.enter('wander', 12); }
            else this.timer = 1;
          }
          break;
        case 'wander':
        case 'investigate': {
          this.timer -= dt;
          let g = this.target;
          // (un ruido fuera de la zona jugable del mapa: va hasta el borde, no se queda empujando contra él)
          const BB = G.World.bounds;
          if (g && BB && (g.x < BB[0] + 0.5 || g.x > BB[2] - 0.5 || g.z < BB[1] + 0.5 || g.z > BB[3] - 0.5)) {
            g = this.target = { x: U.clamp(g.x, BB[0] + 0.6, BB[2] - 0.6), z: U.clamp(g.z, BB[1] + 0.6, BB[3] - 0.6), lv: g.lv };
          }
          if (!g || this.timer <= 0 || (Math.hypot(g.x - this.pos.x, g.z - this.pos.z) < 0.7 && (g.lv || 0) === (this.lv || 0))) {
            this.target = null; this.investFast = false; this.alertRun = false;
            this.enter('idle', 2 + Math.random() * 5);
          } else speed = this.state === 'investigate' && this.alertRun ? (this.blind ? BLIND.chase * 0.8 : (R ? RUNNER.chase * 0.85 : CHASE_SPEED))
            : this.state === 'investigate' && this.investFast && !this.blind ? NOISE_SPEED[R ? 1 : 0]
            : this.blind ? (this.state === 'wander' ? BLIND.wander : BLIND.investigate)
            : (this.state === 'wander' ? (R ? RUNNER.wander : WANDER_SPEED)
              // investigando: lento y a trompicones (avanza, se frena, sigue)
              : (this.hunter ? HUNTER_SEARCH : SEARCH_SPEED) * (0.45 + 0.55 * Math.max(0, Math.sin((this.time || 0) * 1.6 + (this.seed || 0)))));
          break;
        }
        case 'sus':
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 2.5 * dt);
          this.target = this.susAt;
          speed = Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing)) < 0.6 ? SUS_SPEED : 0;
          break;
        case 'alert':
          this.timer -= dt;
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 6 * dt);
          if (this.timer <= 0) this.enter('chase', 0);
          break;
        case 'chase':
          if (player.dead) { this.enter('idle', 3); this.target = null; break; }
          // otro la tiene agarrada o le está pegando: espera a un par de metros, encarándola
          if (((player.struggle && player.struggle.z !== this) || (player.beaten && player.beaten.z !== this)) && dist < 2.2) {
            this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 5 * dt);
            break;
          }
          // hongomorfo: zarpazo, trozos de hongo y paredes
          if (this.hongo && this.hongoPrey(dt, player, dist)) break;
          if (this.hongo && this.hongoChase(dt, player, dist, sees, sameLv, px, pz)) break;
          // temblante: a veces se fija en dónde estás y embiste (no seguido: tras cada embestida tarda en volver)
          if (this.temb) {
            this.chargeCD -= dt;
            if (sees && sameLv && this.chargeCD <= 0 && dist > this.T.cmin && dist < this.T.cmax && !player.beaten && !player.struggle && !player.dead) {
              if (Math.random() < this.T.cchance) { this.startCharge(px, pz); break; }
              this.chargeCD = this.T.cretry[0] + Math.random() * (this.T.cretry[1] - this.T.cretry[0]);
            }
          }
          // acechador peleando de frente: se le pasa el enfado y, si te alejas, vuelve a esconderse
          if (this.stalker) {
            this.mad = (this.mad || 0) - dt;
            if (this.mad <= 0 && dist > 11) { this.enter('hide', 6); this.spot = null; break; }
          }
          this.runAtkCD = Math.max(0, (this.runAtkCD || 0) - dt);
          // corriendo hacia ti a la distancia justa: a veces se lanza con el golpe en carrera
          if (R && !this.blind && !this.temb && sees && sameLv && reachV && this.runAtkCD <= 0 && dist > RUNATK.min && dist < RUNATK.max && (this.speedNow || 0) > 2.5 && !player.beaten && !player.struggle && !((player.beatCD || 0) > 0)) {
            this.runAtkCD = RUNATK.cd;
            if (Math.random() < RUNATK.chance) { this.startRunAtk(player, dist); break; }
          }
          // ¿estás encima de un contenedor? trepa detrás de ti (el temblante no puede)
          if (!this.temb && (player.elev || 0) > this.elev + 1.1 && dist < 7 && this.tryLedge(Math.atan2(dx, dz))) break;
          if (dist < (this.blind ? BLIND.reach * (this.locked ? BLIND_HUNT.reach : 1) : (this.temb ? this.T.reach : (R ? RUNNER.reach : REACH))) && (sees || (this.blind && dist < (this.locked ? 1.6 : 1.4))) && sameLv && reachV) {
            if (player.beaten || player.struggle || (player.beatCD || 0) > 0 || this.hongo) { this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 5 * dt); break; }
            const toZ = Math.atan2(-dx, -dz), behind = Math.abs(U.angleDiff(toZ, player.facing)) > 1.9;
            // el chaskeado a veces va a por el zarpazo que te deja a su merced (si no, golpea); los demás, a veces
            // un agarre y si no el combo
            if ((this.blind && Math.random() < (this.locked ? BLIND_HUNT.slam : BLIND_SLAM_P)) || (!this.blind && !this.temb && (player.grabCD || 0) <= 0 && Math.random() < GRAB_P * (behind ? 1.6 : 1) * (0.7 + this.pers.agr * 0.6))) {
              this.enter('attack', this.blind ? BLIND.windup * (this.locked ? BLIND_HUNT.windup : 1) : (R ? RUNNER.windup : WINDUP));
              this.lungeT = R ? 0 : -1;
            } else this.startCombo(player);
          } else {
            speed = this.blind ? BLIND.chase * (this.locked ? BLIND_HUNT.chase : 1) : (this.temb ? this.T.chase : (R ? RUNNER.chase : CHASE_SPEED));
            this.moveGoal = this.flankGoal(player, all, dist, sameLv, dt);
          }
          break;
        case 'stalk':
        case 'hide':
        case 'ambush': {
          // ---- acechador ----
          const seen = this.seenBy(player, dist);
          this.unseenT = seen ? 0 : (this.unseenT || 0) + dt;
          this.timer -= dt;
          if (this.state === 'ambush') {
            // se lanza a por ti; si lo ves venir de lejos, aborta y se esconde
            if (seen === 2 && dist > STALK.face + 1) { this.enter('hide', 6); this.spot = null; break; }
            this.target = { x: px, z: pz, lv: plv };
            speed = STALK.ambush;
            if (dist < STALK.grabR && sameLv && reachV) {
              if (!player.dead && !player.struggle && !player.beaten && !player.lifted && combat) { combat.startStruggle(player, this); this.postGrab = true; }
              else this.enter('recover', 0.5);
            } else if (this.timer < -6) { this.enter('stalk', 0); this.spot = null; }
            break;
          }
          // de frente y cerca: pelea como un corredor
          if (seen === 2 && dist < STALK.face && sameLv && !(this.state === 'hide' && this.alertPending)) { this.mad = STALK.madT; this.enter('chase', 0); break; }
          if (this.state === 'stalk') {
            // si lo estás mirando, se esconde (de cerca, en cambio, te pelea)
            if (seen && dist < STALK.face && sameLv) { this.mad = STALK.madT; this.enter('chase', 0); break; }
            if (seen && !this.feigned && dist > 6 && dist < 16 && Math.random() < 0.25 && this.feign(Math.random() < 0.5 ? 1 : -1)) break;
            if (seen) { this.enter('hide', 6); this.spot = null; break; }
            // llevas un rato sin mirarlo: ataca por la espalda o un costado
            const sunOk = !(this.sunAway > 0) && (this.pers.agr > 0.7 || !G.World.sunlit(px, pz, plv));     // (al sol solo se lanzan los más agresivos)
            if (sunOk && this.unseenT > (this.ambT || (this.ambT = STALK.wait[0] + Math.random() * (STALK.wait[1] - STALK.wait[0]))) && dist < 26 && sameLv && !player.dead && !player.struggle && !player.beaten) {
              this.ambT = 0; this.enter('ambush', 0); break;
            }
            this.stalkT = (this.stalkT || 0) - dt;
            if (this.stalkT <= 0 || !this.spot) { this.stalkT = 0.9; this.spot = this.findSpot(player, false); }
          } else {
            // escondiéndose: corre a lo más cercano que lo tape; ya a cubierto, chilla si acaba de agarrarte
            this.stalkT = (this.stalkT || 0) - dt;
            if (!this.spot || (this.stalkT <= 0 && !this.sunHide)) { this.stalkT = 1.2; this.spot = this.findSpot(player, true); }   // (yendo a la sombra, no cambia de sitio)
            const there = this.spot && Math.hypot(this.spot.x - this.pos.x, this.spot.z - this.pos.z) < 0.7;
            if ((there || this.timer <= 0) && this.unseenT > 0.4) {
              if (this.alertPending) {
                this.alertPending = false;
                this.alertNearby(player, ALERT_R + 4);
                if (G.Audio) G.Audio.play('zAlert', { x: this.pos.x, z: this.pos.z, lv: this.lv, z0: this, runner: true });
                this.shriekT = 1.0;
              }
              this.enter('stalk', 0); this.spot = null; break;
            }
          }
          if (this.spot) {
            const ds = Math.hypot(this.spot.x - this.pos.x, this.spot.z - this.pos.z);
            if (ds > 0.5) { this.target = { x: this.spot.x, z: this.spot.z, lv: this.spot.lv }; speed = this.state === 'hide' ? STALK.hide : STALK.creep; }
            else this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 3 * dt);
          }
          break;
        }
        case 'tthrow': {
          // intentaste eliminarlo por la espalda: se gira, te agarra del cuello con un brazo, te levanta y te tira
          const T = this.thr; T.t += dt;
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 14 * dt);
          if (!T.grabbed && T.t >= 0.28) {
            T.grabbed = true;
            if (!player.dead && dist < 1.9 && !player.struggle) { player.lifted = { z: this, t: 0 }; player.action = null; player.dodging = null; if (G.Camera.shake) G.Camera.shake(0.25); }
          }
          const L = player.lifted;
          if (L && L.z === this) {
            L.t = T.t;
            const f = this.facing, ax = this.pos.x + Math.sin(f) * 0.72 - Math.cos(f) * 0.12, az = this.pos.z + Math.cos(f) * 0.72 + Math.sin(f) * 0.12;
            const k = Math.min(1, dt * 14);
            player.pos.x += (ax - player.pos.x) * k; player.pos.z += (az - player.pos.z) * k;
            player.facing = f + Math.PI;
            player.climbLift = 0.55 * U.smooth(Math.min(1, (T.t - 0.28) / 0.45)) * (T.t > 0.95 ? Math.max(0, 1 - (T.t - 0.95) / 0.1) : 1);
            if (T.t >= 0.95) {
              player.lifted = null; player.climbLift = 0;
              player.damage(this.T.throwDmg, 'Un temblante te estampó.');
              if (!player.dead) player.takePunch(this, 'launch', 1, this.T.throwPush);
              if (G.Camera.hurtFx) G.Camera.hurtFx(1.2, 1);
              if (G.Camera.wobble) G.Camera.wobble(0.6);
              if (G.Audio) G.Audio.play('tackle');
            }
          }
          if (T.t >= 1.45) { if (player.lifted && player.lifted.z === this) { player.lifted = null; player.climbLift = 0; } this.enter('chase', 0); this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0; }
          break;
        }
        case 'bslam': {
          // chaskeado: tras el zarpazo se te echa encima para rematarte (4 o 5 golpes rápidos para soltarse)
          this.timer -= dt; this.slamT = (this.slamT || 0) + dt;
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 6 * dt);
          if (dist > 0.75 && this.slamT < 0.3) G.World.move(this.pos, Math.sin(this.facing) * 1.5 * dt, Math.cos(this.facing) * 1.5 * dt, this.rad, this.lv, this.elev);
          if (this.timer <= 0) {
            // (tras cortarte el combo llega aunque te hayas apartado un poco)
            if (!player.dead && dist < (this.finalKill ? 3.2 : 2.3) && sameLv && combat && !player.struggle) combat.startStruggle(player, this, true);
            else { this.finalKill = false; this.enter('recover', 0.6); }
          }
          break;
        }
        case 'hgrab': {
          // hongomorfo: se encoge con las garras arriba y se lanza a agarrarte (se puede esquivar)
          this.timer -= dt;
          if (this.timer > 0) {
            this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 5 * dt);
            this.atkU = 0.66 * (1 - this.timer / HONGO.grabWind);
          } else {
            this.lungeT += dt;
            this.atkU = 0.66 + 0.34 * Math.min(1, this.lungeT / 0.45);
            if (this.lungeT < 0.3 && dist > 0.95) {
              const st = Math.min(dist - 0.95, HONGO.lunge * dt / 0.28);
              G.World.move(this.pos, Math.sin(this.facing) * st, Math.cos(this.facing) * st, this.rad, this.lv, this.elev);
            }
            if (!this.grabDone && this.lungeT > 0.14) {
              this.grabDone = true;
              this.dodged = (player.dodging && player.dodging.t < 0.8) || player.dodgeAfter > 0;
              const ok = !this.dodged && !player.dead && !player.bossKill && dist < HONGO.grabR && sameLv && Math.abs((player.elev || 0) - (this.elev || 0)) < 2.3 &&
                Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing)) < 1.0 && G.World.hasLOS(this.pos.x, this.pos.z, px, pz, this.lv);
              if (ok && this.hongoHit(player)) break;
              if (this.dodged) { this.exposed = true; if (G.Mode && G.Mode.stats) G.Mode.stats.stun++; if (this.hongo && G.Mode.bossEvent && dist < HONGO.grabR + 0.8) G.Mode.bossEvent('dodge'); }
            }
            if (this.lungeT > 0.45) { this.enter('recover', this.dodged ? 1.4 : 0.85); this.strikeT = 0; this.strikeHit = false; }
          }
          break;
        }
        case 'hrip': {
          // se arranca un trozo de hongo del hombro y te lo lanza
          this.ripT += dt;
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 4 * dt);
          if (!this.ripped && this.ripT > 0.5) {
            this.ripped = true;
            if (G.Audio) G.Audio.play('hRip', { x: this.pos.x, z: this.pos.z, lv: this.lv });
            if (G.Guns && G.Guns.burst) G.Guns.burst(new THREE.Vector3(this.pos.x - Math.cos(this.facing) * 0.4, this.y + 2.2, this.pos.z + Math.sin(this.facing) * 0.4), new THREE.Vector3(0, 1, 0), true, 6);
          }
          if (!this.thrown && this.ripT > HONGO.ripT) {
            this.thrown = true;
            // apunta un poco por delante de donde vas
            const lead = Math.min(0.7, dist / 16);
            const tx = px + (player.vel ? player.vel.x : 0) * lead, tz = pz + (player.vel ? player.vel.z : 0) * lead;
            if (G.BossFx && sameLv && !player.dead) G.BossFx.throwChunk(this, tx, tz, player);
          }
          if (this.ripT > HONGO.ripT + 0.45) {
            this.throwCD = HONGO.throwCD[0] + Math.random() * (HONGO.throwCD[1] - HONGO.throwCD[0]);
            this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0;
            this.enter('chase', 0);
          }
          break;
        }
        case 'tcharge': {
          // grita mientras carga, encarando el punto donde estabas
          this.timer -= dt;
          this.facing = U.turnToward(this.facing, Math.atan2(this.chg.ux, this.chg.uz), 7 * dt);
          if (this.timer <= 0) { this.enter('tdash', 0); this.chg.t = 0; }
          break;
        }
        case 'tdash': {
          // embestida en línea recta hacia ese punto (aunque ya no estés): placaje con el hombro
          const c = this.chg;
          c.t += dt;
          const sp = this.T.dash * Math.min(1, 0.35 + c.t * 4);
          const bx = this.pos.x, bz = this.pos.z;
          G.World.move(this.pos, c.ux * sp * dt, c.uz * sp * dt, this.rad, this.lv, this.elev);
          const mv = Math.hypot(this.pos.x - bx, this.pos.z - bz);
          this.dashSp = mv / Math.max(dt, 1e-4);
          this.facing = Math.atan2(c.ux, c.uz);
          G.World.breakWindowsAlong(bx, bz, this.pos.x, this.pos.z, this.lv);
          const dp = Math.hypot(px - this.pos.x, pz - this.pos.z);
          if (!c.hit && !player.dead && sameLv && dp < this.T.tackleR) {
            c.hit = true;
            const dodged = (player.dodging && player.dodging.t < 0.8) || player.dodgeAfter > 0;
            if (!dodged && this.hongo && !player.bossKill) { if (!this.hongoHit(player)) this.endCharge(false); break; }
            if (!dodged && combat && combat.tembTackle) { combat.tembTackle(this, player); this.endCharge(false); break; }
          }
          const prog = (this.pos.x - c.x0) * c.ux + (this.pos.z - c.z0) * c.uz;
          // el hongomorfo atraviesa la pared (como mucho dos seguidas) y sigue
          if (this.hongo && G.BossFx && (c.smash || 0) < 2 && G.BossFx.wallAhead(this.pos.x, this.pos.z, c.ux, c.uz, 1.0) && G.BossFx.smash(this.pos.x, this.pos.z, c.ux, c.uz)) {
            c.smash = (c.smash || 0) + 1; c.len = Math.max(c.len, prog + 2.5);
          } else if (c.t > 0.15 && mv < sp * dt * 0.35) this.endCharge(true);                // contra una pared
          else if (prog >= c.len || c.t > c.len / this.T.dash + 0.9) this.endCharge(false);
          break;
        }
        case 'troar': {
          // frena, grita y suelta la explosión de esporas
          this.timer -= dt;
          this.knockback(dt);
          if (!this.burstDone && this.T.roar - this.timer > 0.2) {
            this.burstDone = true;
            if (G.Spores && !this.hongo) G.Spores.burst(this.pos.x, this.y, this.pos.z, this.lv || 0, this.burstR || this.T.sporeR, this, player, false, this.burstWall);
          }
          if (this.timer <= 0) {
            this.chargeCD = this.T.ccd[0] + Math.random() * (this.T.ccd[1] - this.T.ccd[0]);
            this.target = { x: px, z: pz, lv: plv }; this.lastSeen = 0;
            this.enter('chase', 0);
          }
          break;
        }
        case 'combo': {
          // combo de puñetazos: se acerca un poco si te alejas y te encara
          const c = this.combo, K = COMBO[c.step];
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 5 * dt);
          if (dist > 0.8 && c.t < K.imp) {
            const st = Math.min(dist - 0.75, (c.step === 0 ? 1.4 : 3.2) * dt);
            G.World.move(this.pos, Math.sin(this.facing) * st, Math.cos(this.facing) * st, this.rad, this.lv, this.elev);
          }
          c.t += dt / (K.dur * (this.temb ? this.T.punchSlow : 1));
          if (!c.hit && c.t >= K.imp) {
            c.hit = true;
            const r = combat ? combat.zombiePunch(this, player, Math.hypot(px - this.pos.x, pz - this.pos.z), c.step) : 'miss';
            if (r === 'hit') c.hits++;
            else {
              // falló (o lo esquivaste): se corta el combo; esquivado, se pasa de largo y queda vendido
              const over = r === 'dodge';
              this.overextended = false;
              this.endCombo(player);
              this.strikeT = 0; this.strikeHit = false;
              this.enter('recover', over ? 1.1 : 0.45);
              if (over) { this.stun(1.25, Math.sin(this.facing), Math.cos(this.facing), 1.2); this.exposed = true; if (G.Mode && G.Mode.stats) G.Mode.stats.stun++; }
              break;
            }
          }
          if (c.t >= 1) {
            if (c.step < 2) { c.step++; c.t = 0; c.hit = false; }
            else { this.endCombo(player); this.enter('recover', 0.6); this.strikeT = 0; this.strikeHit = false; }
          }
          break;
        }
        case 'runatk': {
          // golpe en carrera: se lanza hacia ti con el impulso y descarga de arriba abajo
          const c = this.combo;
          c.t += dt / RUNATK.dur;
          if (c.t < RUNATK.imp + 0.05) this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 3 * dt);
          const sp = c.t < RUNATK.imp ? c.v : Math.max(0, c.v * 0.5 * (1 - (c.t - RUNATK.imp) / 0.25));
          if (sp > 0 && dist > 0.75) G.World.move(this.pos, Math.sin(this.facing) * sp * dt, Math.cos(this.facing) * sp * dt, this.rad, this.lv, this.elev);
          this.speedNow = sp;
          if (!c.hit && c.t >= RUNATK.imp) {
            c.hit = true;
            const r = combat ? combat.zombiePunch(this, player, Math.hypot(px - this.pos.x, pz - this.pos.z), 'run') : 'miss';
            if (r === 'dodge') { this.endCombo(player); this.stun(1.4, Math.sin(this.facing), Math.cos(this.facing), 2.2); this.exposed = true; break; }
          }
          if (c.t >= 1) { this.endCombo(player); this.enter('recover', 0.5); this.strikeT = 0; this.strikeHit = false; }
          break;
        }
        case 'attack':
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 4 * dt);
          this.timer -= dt;
          const wu = this.blind ? BLIND.windup : (R ? RUNNER.windup : WINDUP);
          this.reach = Math.min(1, 1 - this.timer / wu + 0.15);
          this.atkU = Math.min(1, 1 - this.timer / wu);
          // embestida: al final de la preparación se lanza hacia delante con los brazos por delante
          if (!R && this.timer < 0.18 && dist > 0.62) {
            const st = Math.min(dist - 0.6, 0.4 * dt / 0.18);
            G.World.move(this.pos, Math.sin(this.facing) * st, Math.cos(this.facing) * st, this.rad, this.lv, this.elev);
          }
          // el corredor se abalanza hacia delante al final de la preparación
          if (R && this.timer < 0.25 && dist > 0.7) {
            const st = Math.min(dist - 0.65, RUNNER.lunge * dt / 0.25);
            G.World.move(this.pos, Math.sin(this.facing) * st, Math.cos(this.facing) * st, this.rad, this.lv, this.elev);
            this.lungeT = 1;
          }
          if (this.timer <= 0) {
            const hit = combat ? combat.zombieStrike(this, player, Math.hypot(px - this.pos.x, pz - this.pos.z)) : false;
            // si falla porque esquivaste, se queda vendido un rato (ventana para contraatacar)
            const over = this.overextended; this.overextended = false;
            this.strikeT = 0; this.strikeHit = hit;
            if (this.state === 'grapple' || this.state === 'bslam') break;          // te agarró (o el zarpazo del chaskeado)
            this.enter('recover', over ? 1.1 : (hit ? 0.55 : 0.4));
            // esquivado: se pasa de largo y queda aturdido un momento (se le puede rematar)
            if (over) { this.stun(1.25, Math.sin(this.facing), Math.cos(this.facing), 1.2); this.exposed = true; if (G.Mode && G.Mode.stats) G.Mode.stats.stun++; }
          }
          break;
        case 'recover':
          this.timer -= dt;
          this.strikeT = (this.strikeT || 0) + dt;
          this.reach = Math.max(this.reach, 0.5);
          this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 3 * dt);
          if (this.timer <= 0 && !this.afterGrab()) this.enter('chase', 0);
          break;
        case 'bang':
          this.updateBang(dt, player, dist, sees);
          break;
      }

      let moved = 0;
      if (this.state !== 'chase') this.moveGoal = null;
      if (speed > 0 && this.target) moved = this.stepToward(this.moveGoal || this.target, speed * (this.hongo ? 1 : this.spMul) * (this.frenzy > 0 ? 1.18 : 1), dt);
      this.speedNow = this.state === 'tdash' ? (this.dashSp || 0) : moved;

      if (speed > 0 && moved < speed * 0.25 && this.state !== 'bang' && this.state !== 'climb') {
        this.stuck += dt;
        if (this.stuck > 1.2) { this.clear = false; this.clearTimer = 1; this.pathTimer = 0; }
        if (this.stuck > 6) { this.target = null; this.enter('idle', 2); }
      } else this.stuck = Math.max(0, this.stuck - dt);

      // separación entre zombis
      for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o === this || !o.alive || o.downed) continue;
        const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z;
        const d2 = ox * ox + oz * oz;
        if (d2 < 0.3 && d2 > 1e-4) {
          const d = Math.sqrt(d2), push = (0.55 - d) * 0.5;
          G.World.move(this.pos, ox / d * push, oz / d * push, this.rad, this.lv, this.elev);
        }
      }
      // no atravesar al jugador
      const pr = this.hongo ? 0.95 : 0.55;
      if (!player.dead && !player.bossKill && dist < pr && dist > 1e-3) {
        const push = (pr - dist);
        G.World.move(this.pos, -dx / dist * push, -dz / dist * push, this.rad, this.lv, this.elev);
      }

      this.phase += dt * (1.4 + this.speedNow * (this.runner && this.speedNow > 1.5 ? 3.4 : 5.5) * (this.hongo ? 0.8 : (this.temb ? 1.45 : 1)));   // (el temblante: pasos cortos y más seguidos)
      this.hongoSteps(dt, player);
      this.hongoSmash(dt);
      this.apply(dt);
    }

    knockback(dt) {
      const k = this.kb;
      if (Math.abs(k.x) + Math.abs(k.z) < 0.01) return;
      const x0 = this.pos.x, z0 = this.pos.z;
      G.World.move(this.pos, k.x * dt, k.z * dt, this.rad, this.lv, this.elev);
      // contra una pared: se estampa, rebota un poco y se queda aturdido más rato
      const sp = Math.hypot(k.x, k.z), moved = Math.hypot(this.pos.x - x0, this.pos.z - z0);
      if (sp > 1.6 && moved < sp * dt * 0.4 && this.alive && !this.wallHit) {
        this.wallHit = true;
        k.x *= -0.25; k.z *= -0.25;
        if (this.state === 'stagger') { this.reactKind = 'wall'; this.reactDur = 0.9; this.timer = 0.9; this.stagger = 0.001; }
        if (G.World.emit) G.World.emit(this.pos.x, this.pos.z, 4, this.lv);
        return;
      }
      const f = Math.max(0, 1 - dt * 4.2);
      k.x *= f; k.z *= f;
    }

    // ---------- Puertas, ventanas y vallas ----------
    updateBang(dt, player, dist, sees) {
      const W = G.World, E = W.E;
      const ref = this.edge;
      const e = ref ? W.edgeGet(ref) : E.NONE;
      if (!ref || !W.blocksWalkEdge(e)) { this.edge = null; this.enter(this.resume, 12); return; }
      if (W.climbableEdge(e)) { this.startClimb(ref, e); return; }
      const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
      this.facing = U.turnToward(this.facing, Math.atan2(mx - this.pos.x, mz - this.pos.z), 4 * dt);
      this.bangT += dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 1;
        W.emit(mx, mz, 9, this.lv);
        if (G.Audio) G.Audio.play('bang', { x: mx, z: mz, lv: this.lv });
        if (W.damageEdge(ref, 1)) {
          const after = W.edgeGet(ref);
          if (W.climbableEdge(after)) this.startClimb(ref, after);
          else { this.edge = null; this.enter(this.resume, 12); }
        }
      }
      // si deja de oír o ver al jugador durante mucho rato, se rinde
      if (!sees && this.bangT > 25 && dist > 12) { this.edge = null; this.target = null; this.enter('idle', 3); }
    }

    // Trepar al techo de un contenedor que tiene delante (dirección a); true si empieza
    tryLedge(a) {
      const W = G.World;
      if (!W.deckAt || this.falling) return false;
      for (const dd of [0.5, 0.85]) {
        const ex = this.pos.x + Math.sin(a) * dd, ez = this.pos.z + Math.cos(a) * dd;
        const h = W.standTop(ex, ez, 0);
        if (h - this.elev < 0.5 || h - this.elev > 2.95) continue;
        const tx = this.pos.x + Math.sin(a) * (dd + 0.6), tz = this.pos.z + Math.cos(a) * (dd + 0.6);
        if (W.standTop(tx, tz, 0) < h - 0.05 || W.circleBlocked(tx, tz, this.rad, this.lv, false, h)) continue;
        this.climbing = { ledge: true, x0: this.pos.x, z0: this.pos.z, x1: tx, z1: tz, t: 0, dur: 0.9 + (h - this.elev) * 0.25, h0: this.elev, h1: h };
        this.facing = a;
        this.state = 'climb';
        this.edge = null; this.path = null;
        return true;
      }
      return false;
    }

    // Tiempo (0..1) de la animación grabada de salto (G.Clips.jump, «HumanJumping») al pasar una valla o una
    // ventana. El clip dura lo que dura (~1,2 s) y el resto de la trepada (más larga en las ventanas) se reparte
    // antes y después, para que no vaya a cámara lenta. La usan todos (infectados, enemigos humanos y aliados),
    // salvo el tanque (Temblante) y el jefe (Hongomorfo), que conservan lo que tenían. null = sin clip (no está
    // trepando, o es el techo de un contenedor, que tiene su propia trepada)
    jumpU() {
      const c = this.climbing, C = G.Clips && G.Clips.jump;
      if (!c || c.ledge || !C || this.temb || this.hongo) return null;
      const lead = Math.max(0, (c.dur - C.dur) / 2);
      return U.clamp((Math.min(1, c.t) * c.dur - lead) / C.dur, 0, 1);
    }

    startClimb(ref, e) {
      const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
      const nx = ref.o === 'N' ? 0 : 1, nz = ref.o === 'N' ? 1 : 0;
      const side = (this.pos.x - mx) * nx + (this.pos.z - mz) * nz > 0 ? 1 : -1;
      const tx = mx - nx * side * 0.6, tz = mz - nz * side * 0.6;
      if (G.World.circleBlocked(tx, tz, this.rad, this.lv, this.elev)) { this.edge = null; this.enter('idle', 2); return; }
      this.climbing = { x0: this.pos.x, z0: this.pos.z, x1: tx, z1: tz, t: 0, dur: e === G.World.E.FENCE ? 1.4 : 2.0 };
      this.facing = Math.atan2(tx - this.pos.x, tz - this.pos.z);
      this.edge = null;
      this.state = 'climb';
    }

    // Si la meta está en otra planta, primero va a la escalera (arriba o abajo)
    routeGoal(goal) {
      const lv = this.lv || 0;
      if (goal.lv == null || goal.lv === lv) return goal;
      const W = G.World;
      const b = W.bldAt(Math.floor(goal.x), Math.floor(goal.z), goal.lv) || W.bldAt(Math.floor(this.pos.x), Math.floor(this.pos.z), lv);
      const s = b && b.stair;
      if (!s) return goal;
      const k = lv === 0 ? s.len - 1 : 0;
      const sx = s.x + s.dx * k + 0.5, sz = s.z + s.dz * k + 0.5;
      // la casilla del otro extremo de la escalera: al pasar la mitad ya cambia de planta
      return { x: sx, z: sz, lv };
    }

    // Avanza hacia la meta: en línea recta si se puede, si no con A*
    stepToward(goal, speed, dt) {
      const W = G.World;
      goal = this.routeGoal(goal);
      // desatasco: si lleva un rato sin avanzar contra algo, da unos pasos de lado (rodea el obstáculo) y vuelve
      // a calcular el camino
      if (this.unstick) {
        this.unstick.t -= dt;
        if (this.unstick.t <= 0 || Math.hypot(this.unstick.x - this.pos.x, this.unstick.z - this.pos.z) < 0.3) { this.unstick = null; this.pathTimer = 0; this.clearTimer = 0; }
        else goal = this.unstick;
      }
      if (this.elev > 0.3) { this.clear = true; this.clearTimer = 0.25; }
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.clear = W.hasClearLine(this.pos.x, this.pos.z, goal.x, goal.z, this.lv);
        this.clearTimer = 0.25;
      }
      let gx = goal.x, gz = goal.z;
      if (!this.clear) {
        this.pathTimer -= dt;
        if (this.pathTimer <= 0) {
          this.path = W.findPath(this.pos.x, this.pos.z, goal.x, goal.z, 0, this.lv);
          this.pathTimer = 1 + Math.random() * 0.6;
          // ruta más directa: se salta los puntos intermedios si se ve en línea recta uno más adelante (sin pegarse
          // a las esquinas de los muebles)
          if (this.path && this.path.length > 2) {
            let k = 0;
            for (let j = Math.min(this.path.length - 1, 6); j >= 1; j--) {
              if (W.hasClearLine(this.pos.x, this.pos.z, this.path[j].x, this.path[j].z, this.lv)) { k = j; break; }
            }
            if (k > 0) this.path.splice(0, k);
          }
        }
        if (this.path) {
          while (this.path.length && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 0.35) this.path.shift();
          if (this.path.length) {
            gx = this.path[0].x; gz = this.path[0].z;
            // ¿hay una puerta, ventana o valla entre esta casilla y la siguiente?
            const tx = Math.floor(this.pos.x), tz = Math.floor(this.pos.z);
            const nx = Math.floor(gx), nz = Math.floor(gz);
            if (Math.abs(nx - tx) + Math.abs(nz - tz) === 1) {
              const ref = W.edgeRefBetween(tx, tz, nx, nz, this.lv);
              const e = W.edgeGet(ref);
              if (W.blocksWalkEdge(e)) {
                const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
                const dEdge = ref.o === 'N' ? Math.abs(this.pos.z - mz) : Math.abs(this.pos.x - mx);
                if (dEdge < 0.6) {
                  this.resume = this.state === 'chase' ? 'chase' : 'investigate';
                  if (W.climbableEdge(e)) { this.startClimb(ref, e); return 0; }
                  this.edge = ref; this.bangT = 0;
                  this.state = 'bang'; this.timer = 0.6;
                  return 0;
                }
                // ir hacia el centro de la arista
                gx = ref.o === 'N' ? mx : gx; gz = ref.o === 'N' ? gz : mz;
                if (ref.o === 'N') gz = mz + (tz < nz ? -0.3 : 0.3);
                else gx = mx + (tx < nx ? -0.3 : 0.3);
              }
            }
          }
        }
      } else this.path = null;

      const ddx = gx - this.pos.x, ddz = gz - this.pos.z;
      const d = Math.hypot(ddx, ddz);
      if (d < 0.01) return 0;
      this.facing = U.turnToward(this.facing, Math.atan2(ddx, ddz), 3 * dt);
      const step = speed * dt * (G.Sky && !this.hongo ? G.Sky.speedMul() : 1);        // (de noche, más vivos; en la nieve, más lentos)
      const bx = this.pos.x, bz = this.pos.z;
      W.move(this.pos, ddx / d * step, ddz / d * step, this.rad, this.lv, this.elev, this.hongo && this.stuck > 0.7);
      const got = Math.hypot(this.pos.x - bx, this.pos.z - bz);
      // ¿atascado? (avanza mucho menos de lo que debería)
      if (step > 1e-4 && got < step * 0.3 && d > 0.4) this.navStuck = (this.navStuck || 0) + dt;
      else this.navStuck = Math.max(0, (this.navStuck || 0) - dt * 2);
      if (this.navStuck > 0.9 && !this.unstick && !this.hongo) {
        this.navStuck = 0;
        const ux = ddx / d, uz = ddz / d, sgn = Math.random() < 0.5 ? 1 : -1;
        for (let k = 0; k < 6; k++) {
          const side = (k % 2 ? -sgn : sgn), back = k >= 4 ? -0.8 : 0.2, r = 1.1 + (k >> 1) * 0.6;
          const x = this.pos.x + (-uz * side + ux * back) * r, z = this.pos.z + (ux * side + uz * back) * r;
          if (!W.circleBlocked(x, z, this.rad + 0.04, this.lv) && W.hasClearLine(this.pos.x, this.pos.z, x, z, this.lv)) { this.unstick = { x, z, lv: this.lv, t: 0.8 }; break; }
        }
        this.clear = false; this.clearTimer = 0.8; this.pathTimer = 0;
      }
      return got / Math.max(dt, 1e-4);
    }

    // ---------- Modelo ----------
    apply(dt) {
      const m = this.model;
      this.lv = G.World.levelAt(this.pos.x, this.pos.z, this.lv);
      // encima de un contenedor: si sale del borde, cae
      if (!this.climbing && !this.lv && G.World.deckAt) {
        const deck = G.World.standTop(this.pos.x, this.pos.z, 0);
        if (!this.falling && this.elev > deck + 0.2) { this.falling = true; this.fallV = 0; }
        if (this.falling) {
          this.fallV += 9.8 * (dt || 0.016);
          this.elev = Math.max(deck, this.elev - this.fallV * (dt || 0.016));
          if (this.elev <= deck + 1e-3) { this.falling = false; this.elev = deck; if (G.Audio) G.Audio.play('land', { x: this.pos.x, z: this.pos.z, lv: this.lv, vol: 0.7 }); }
        } else if (this.elev > 0) this.elev = deck;
      }
      const gy = G.World.groundY(this.pos.x, this.pos.z, this.lv) + (this.elev || 0);
      if (this.elev > 0 || this.falling || this.climbing) this.y = gy;
      else this.y += (gy - this.y) * Math.min(1, (dt || 0.016) * 14);
      m.root.position.set(this.pos.x, this.y + (this.lift || 0), this.pos.z);
      // lejos de la cámara: malla más ligera, sin sombra y animada cada 2 o 3 fotogramas
      const cp = G.Camera && G.Camera.pos;
      let skip = 1;
      if (cp) {
        const d = Math.hypot(cp.x - this.pos.x, cp.z - this.pos.z);
        const q = G.Quality ? G.Quality.cur : { lod: [18, 36], shadowZ: 22, animFar: 2 };
        let lv = lodFor(m.lod, d, q.lod[0], q.lod[1]);
        if (lv === 1 && this.lodCap === 0) lv = 0;           // (cerca, pero ya hay bastantes con el detalle alto)
        G.Models.setLOD(m, lv);
        const sh = d < q.shadowZ;
        if (m.mesh.castShadow !== sh) m.mesh.castShadow = sh;
        if (d > q.lod[0] && this.state !== 'attack' && this.state !== 'tthrow' && this.state !== 'bslam' && this.state !== 'grapple' && this.state !== 'combo' && this.state !== 'runatk' && this.state !== 'tdash' && this.state !== 'grabbed' && !(this.fall > 0)) skip = d > q.lod[1] ? q.animFar + 1 : q.animFar;
      }
      m.root.rotation.y = this.facing;
      if (this.rag) {
        // muñeco de trapo: el cuerpo gira alrededor de la cadera
        const r = this.rag;
        m.root.position.y = this.y + (this.lift || 0) + r.hip - 0.95;
        _re.set(r.rx, 0, r.rz); _rv.set(0, 0.95, 0).applyEuler(_re);
        m.body.rotation.set(r.rx, 0, r.rz); m.body.position.set(-_rv.x, 0.95 - _rv.y, -_rv.z);
        if (m._ls) { G.Models.legSpread(m, -m._ls); m._ls = 0; }
        G.Models.poseRagdoll(m, r.b);
        return;
      }
      this.poseDt = (this.poseDt || 0) + (dt || 0);
      this.poseN = ((this.poseN || 0) + 1) % 997;
      if (skip > 1 && (this.poseN + (this.look.seed | 0)) % skip !== 0) return;
      dt = this.poseDt; this.poseDt = 0;
      // espasmos: sacudidas sueltas de cabeza y hombros, más seguidas al perseguir
      if (this.state !== 'dead' && !(this.fall > 0) && !this.temb) {
        this.twitchT = (this.twitchT == null ? Math.random() * 4 : this.twitchT) - (dt || 0);
        if (this.twitchT <= 0) {
          this.twitch = 1;
          this.twitchKind = (Math.random() * 4) | 0;
          this.twitchT = ((this.state === 'chase' ? 1.2 : 2.5) + Math.random() * 4) * (this.runner ? 0.5 : 1);
        }
      }
      this.twitch = Math.max(0, (this.twitch || 0) - (dt || 0) * 3.2);
      // (se deshace la apertura de piernas del fotograma anterior: la pose puede no tocar las piernas)
      if (m._ls) { G.Models.legSpread(m, -m._ls); m._ls = 0; }
      // acechador quieto acechando o escondido: agachado (en cuclillas)
      if (this.stalker) {
        const cw = (this.state === 'stalk' || this.state === 'hide') && (this.speedNow || 0) < 0.35 ? 1 : 0;
        this.crouchK = (this.crouchK || 0) + (cw - (this.crouchK || 0)) * Math.min(1, (this.poseDt || dt || 0.016) * 5);
      }
      G.Models.poseZombie(m, {
        phase: this.phase, amt: Math.min(1, this.speedNow / 0.9) * 0.7,
        chase: this.state === 'chase' || this.state === 'attack' || this.state === 'hburst' || this.state === 'recover' || this.state === 'bang' || this.state === 'alert' || this.state === 'combo' || this.state === 'runatk' || this.state === 'tdash',
        runner: this.runner, sprint: (this.runner || this.blind) && (this.state === 'chase' || this.state === 'tdash' || this.state === 'hide' || this.state === 'ambush') ? Math.min(1, this.speedNow / 2.5) : 0,
        alert: this.state === 'hburst' ? Math.min(1, this.burstT / 1.05) * (this.burstT < 1.05 ? 1 : 0) : this.shriekT > 0 ? 1 - this.shriekT : this.state === 'alert' ? 1 - this.timer / ALERT_T : (this.state === 'tcharge' ? 1 - this.timer / this.T.windup : (this.state === 'troar' ? 1 - this.timer / this.T.roar : 0)),
        creep: (this.state === 'stalk' ? 1 : (this.state === 'ambush' ? 0.45 : 0)) * (1 - (this.crouchK || 0)),
        crouch: this.crouchK || 0,
        temb: this.temb, tackle: this.state === 'tdash' || (this.state === 'hburst' && this.burstT > 0.9 && this.burstT < 1.5) ? 1 : 0, bslam: this.state === 'bslam' ? Math.min(1, (this.slamT || 0) / 0.45) : null,
        maul: this.state === 'grapple' && !!this.maul, tthrow: this.state === 'tthrow' ? Math.min(1, this.thr.t / 1.45) : null, tcharge: this.state === 'tcharge' ? 1 - this.timer / this.T.windup : 0,
        armsUp: this.look.armsUp || 0,
        reach: this.reach, stagger: this.state === 'stagger' ? this.stagger : 0, flinch: this.flinch || 1,
        react: this.state === 'stagger' ? (this.reactKind || 'push') : null, reactDur: this.reactDur || 0.55,
        atk: this.state === 'attack' || this.state === 'hgrab' ? (this.atkU || 0) : null,
        hpose: this.hongoPose(), hongo: this.hongo, jump: this.jumpU(),
        burn: this.writhe ? 2 : (this.state === 'burning' || this.state === 'burnroll' ? (this.state === 'burnroll' ? 2 : 1) : null),
        punch: this.state === 'combo' ? { kind: COMBO[this.combo.step].kind, t: Math.min(1, this.combo.t), imp: COMBO[this.combo.step].imp, tgt: this.strikeModel() }
          : (this.state === 'runatk' ? { kind: 'runatk', t: Math.min(1, this.combo.t), imp: RUNATK.imp, tgt: this.strikeModel() } : null),
        grapple: this.state === 'grapple' ? (this.grappleT || 0) : null,
        stun: this.state === 'stun' ? { t: this.stunT || 0, dur: this.stunDur || 1.5 } : null,
        held: this.state === 'held' ? { kind: this.heldKind, t: this.heldT || 0, by: this.heldBy || null } : null,
        // muerto en un remate contra la pared o la mesa: se queda en la pose final de ese remate
        corpse: this.corpseKind && this.state === 'dead' ? { kind: this.corpseKind, t: Math.min(1, (this.heldT || 0.6) + (1 - (this.heldT || 0.6)) * (this.fall || 0)) } : null,
        blind: this.blind,
        strike: this.state === 'recover' && this.strikeT != null ? Math.min(1, this.strikeT / 0.5) : null, strikeHit: !!this.strikeHit,
        grabbed: this.state === 'grabbed' ? (this.grabT || 0) : null,
        twitch: this.twitch || 0, twitchKind: this.twitchKind || 0,
        bang: this.state === 'bang' ? this.bangT : 0,
        drag: this.look.drag, seed: this.look.seed % 7, lean: this.lean, tilt: this.tilt,
        dt: dt || 0.016, time: (this.time = (this.time || 0) + (dt || 0))
      });
      if (m.hipOff) m.hips.position.y += m.hipOff;            // (piernas cortas: la cadera más baja)
      // mallas con las piernas algo abiertas (el temblante)
      const cmb = this.look.mesh && G.CharMesh && G.CharMesh[this.look.mesh] && G.CharMesh[this.look.mesh].bind;
      if (cmb && cmb.legSpread) { G.Models.legSpread(m, cmb.legSpread); m._ls = cmb.legSpread; }
      if (this.state === 'burnroll' || this.writhe) {
        // tumbado de espaldas, rodando de un lado a otro sobre sí mismo
        const f = U.smooth(Math.min(1, this.fall));
        m.body.rotation.x = -Math.PI / 2 * f; m.body.position.y = 0.12 * f; m.body.position.z = 0;
        m.body.rotation.y = Math.sin((this.rollT || 0) * 4.2) * 1.25 * f * (1 - 0.6 * U.smooth(((this.rollT || 0) - 2.2) / 1)) ;
      } else if (this.fall > 0 && !this.corpseKind) G.Models.poseFall(m, this.fall, this.fallDir);
      else { m.body.rotation.x = 0; m.body.rotation.y = 0; m.body.position.y = 0; }
    }

    // Datos para dormirlo y despertarlo después
    snapshot() {
      return { x: this.pos.x, z: this.pos.z, lv: this.lv || 0, facing: this.facing, look: this.look, hp: this.hp, dead: !this.alive, fallDir: this.fallDir, homebound: this.homebound };
    }
  }

  // Nivel de detalle con un margen para que no cambie a cada paso
  function lodFor(cur, d, L1, L2) {
    const h = 1.5;
    if (cur === 1) return d > L1 + h ? (d > L2 + h ? -1 : 0) : 1;
    if (cur === 0) return d < L1 - h ? 1 : (d > L2 + h ? -1 : 0);
    return d < L2 - h ? (d < L1 - h ? 1 : 0) : -1;
  }

  Zombie.randomLook = randomLook;
  Zombie.TEMB = TEMB;
  // Cuántos llevan el cuerpo con todo el detalle (unos 14 000 triángulos frente a 3 200 del medio): solo los n más
  // cercanos a la cámara. Con una oleada encima, el resto va con el medio (casi no se nota a esa distancia y la
  // tarjeta gráfica dibuja mucho menos, también en las sombras)
  const _rank = [];
  Zombie.rankLOD = function (list, cp, n) {
    if (!cp) return;
    _rank.length = 0;
    for (let i = 0; i < list.length; i++) {
      const z = list[i];
      if (!z.model || z.model.ghost) continue;
      const dx = z.pos.x - cp.x, dz = z.pos.z - cp.z;
      z._rd = dx * dx + dz * dz;
      _rank.push(z);
    }
    _rank.sort((a, b) => a._rd - b._rd);
    for (let i = 0; i < _rank.length; i++) _rank[i].lodCap = i < n ? 1 : 0;
    _rank.length = 0;
  };
  G.Zombie = Zombie;
  G.Zombie.pool = Pool;
})(window.Game = window.Game || {});
