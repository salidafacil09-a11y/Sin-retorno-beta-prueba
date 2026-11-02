(function (G) {
  'use strict';

  // ================= Humanos enemigos =================
  // Un escuadrón de supervivientes armados con una misión: limpiar la zona. Cada uno lleva una sola arma y tiene
  // su papel (diseños propios):
  //   líder      subfusil y bombas de humo; da las órdenes (por voz) y decide cuándo avanzar, buscar o retirarse
  //   tirador    rifle; monta guardia en un sitio con buena vista y cubre a los demás desde lejos
  //   pistolero  pistola; flanquea por un lado
  //   arquera    arco; dispara flechas en silencio (se ven venir y se pueden esquivar)
  //   escopetero escopeta; avanza de cobertura en cobertura hasta tenerte cerca
  //   bruto      hacha de bombero; corre a por ti
  //   sigilosa   cuchillo; te rodea sin que la veas y te ataca por la espalda (forcejeo)
  //   saqueador  palanca; revisa las habitaciones y se lleva alguna cosa (poco: lo suelta al morir)
  // Usan las mismas animaciones que la protagonista (andar, correr, agacharse, apuntar, recargar, golpear, esquivar,
  // saltar ventanas y vallas, abrir puertas, registrar, lanzar, vendarse). Hablan entre ellos (subtítulos y voz),
  // se tienen más o menos afecto, obedecen (o no) al líder y se asustan si las cosas van mal. Si los dejas
  // tocados a golpes, algunos se rinden y te ofrecen algo a cambio de dejarlos ir. Se les puede tomar de rehén
  // con la pistola en la cabeza (y apuntar a los demás mientras tanto). Oyen el clic de un arma sin balas.
  // Nunca se mezclan con los infectados: o hay humanos o hay infectados.

  const U = G.Util;
  const TAU = Math.PI * 2;
  const Z = G.Zombie;
  const R01 = () => Math.random();
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------- Papeles ----------
  // hp: vida (las armas de la protagonista: la pistola quita ~1,3 al cuerpo; a la cabeza mata) · armor: el chaleco
  // reduce lo que entra al cuerpo · sight: metros a los que te ven de pie · fov: medio ángulo de visión ·
  // react: segundos desde que te ven hasta el primer disparo · acc: puntería a corta distancia (0 a 1) ·
  // dmg: daño por bala, perdigón o golpe · burst: balas por ráfaga · gap: segundos entre balas · pause: entre
  // ráfagas · range: distancia mínima y máxima a la que disparan · prefer: distancia a la que les gusta pelear
  const ROLES = {
    lider: { label: 'Líder', w: 'subfusil', hp: 4.8, armor: 0.7, sight: 32, fov: 1.15, react: [0.5, 0.9], acc: 0.36, dmg: 6, burst: [4, 7], gap: 0.1, pause: [0.9, 1.7], range: [3, 26], prefer: 12, run: 4.3, smoke: 3 },
    tirador: { label: 'Tirador', w: 'rifle', hp: 3.4, sight: 52, fov: 0.95, react: [0.9, 1.5], acc: 0.72, dmg: 32, burst: [1, 1], gap: 0, pause: [2.1, 3.2], range: [7, 52], prefer: 24, run: 4.0 },
    pistolero: { label: 'Pistolero', w: 'pistola', hp: 3.7, sight: 34, fov: 1.1, react: [0.45, 0.8], acc: 0.5, dmg: 10, burst: [1, 3], gap: 0.32, pause: [0.6, 1.3], range: [2, 22], prefer: 9, run: 4.6 },
    arquero: { label: 'Arquera', w: 'arco', hp: 3.2, sight: 38, fov: 1.0, react: [0.7, 1.1], acc: 0.6, dmg: 24, burst: [1, 1], gap: 0, pause: [1.5, 2.3], range: [5, 34], prefer: 15, run: 4.4, bow: true },
    escopetero: { label: 'Escopetero', w: 'escopeta', hp: 4.2, sight: 28, fov: 1.1, react: [0.5, 0.85], acc: 0.78, dmg: 7, pellets: 6, burst: [1, 1], gap: 0, pause: [1.0, 1.5], range: [1.2, 13], prefer: 4.5, run: 4.5 },
    bruto: { label: 'Bruto', w: 'hacha_bombero', hp: 5.6, sight: 28, fov: 1.1, react: [0.3, 0.6], melee: true, dmg: 28, run: 4.9 },
    sigilo: { label: 'Sigilosa', w: 'cuchillo_caza', hp: 3.0, sight: 30, fov: 1.15, react: [0.3, 0.5], melee: true, stealth: true, dmg: 12, run: 4.7 },
    // los de las oleadas del asalto humano: exploradores con pistola y carroñeros con un palo (poca cosa)
    explorador: { label: 'Explorador', w: 'pistola', hp: 2.8, sight: 27, fov: 1.0, grunt: true, react: [0.85, 1.4], acc: 0.4, dmg: 9, burst: [1, 2], gap: 0.42, pause: [0.9, 1.7], range: [2, 20], prefer: 9, run: 4.6 },
    carronero: { label: 'Carroñero', w: 'tabla', hp: 2.8, sight: 26, fov: 1.0, grunt: true, react: [0.5, 0.9], melee: true, dmg: 11, run: 4.8 },
    // el compañero que proteges en la resistencia (no es un escorpión: pelea contra los infectados)
    aliado: { label: 'Aliado', w: 'revolver', hp: 999, sight: 30, fov: 1.2, react: [0.5, 0.95], acc: 0.8, dmg: 10, run: 4.6 },
    saqueador: { label: 'Saqueador', w: 'palanca', hp: 3.0, sight: 26, fov: 1.0, react: [0.6, 1.0], melee: true, looter: true, coward: true, dmg: 10, run: 4.8 }
  };
  // puntería general (todos los que disparan): bajarla hace que se pueda esquivar moviéndose
  const ACC_MUL = 0.6;
  const ORDER = ['lider', 'tirador', 'pistolero', 'arquero', 'escopetero', 'bruto', 'sigilo', 'saqueador'];
  // nombres posibles de cada papel ([nombre, mujer])
  const NAMES = {
    lider: [['Bastián', 0], ['Ramiro', 0], ['Tadeo', 0], ['Iván', 0]],          // (el modelo del líder es de hombre, con casco)
    tirador: [['Ingrid', 1], ['Hugo', 0], ['Paloma', 1]],
    pistolero: [['Nico', 0], ['Dante', 0], ['Rocío', 1]],
    arquero: [['Luna', 1], ['Abril', 1], ['Gael', 0]],
    escopetero: [['Tano', 0], ['Bruno', 0], ['Marga', 1]],
    bruto: [['Moisés', 0], ['Toro', 0]],
    sigilo: [['Irene', 1], ['Zoe', 1], ['Leo', 0]],
    saqueador: [['Pecas', 0], ['Rata', 0], ['Mili', 1]],
    explorador: [['Simón', 0], ['Lalo', 0], ['Vicky', 1], ['Cata', 1], ['Fede', 0], ['Mauro', 0], ['Nadia', 1], ['Rulo', 0]],
    carronero: [['Chispa', 0], ['Tuerto', 0], ['Greta', 1], ['Pocho', 0], ['Lola', 1], ['Mosca', 0], ['Coco', 0], ['Yeye', 1]]
  };
  // color del nombre en los subtítulos
  const COLOR = { lider: '#e2b04a', tirador: '#9fb36a', pistolero: '#6fa3d8', arquero: '#8bc48a', escopetero: '#e0874a', bruto: '#d0605a', sigilo: '#b49ad8', saqueador: '#d8c25a', explorador: '#79c0c8', carronero: '#b08a62', aliado: '#8fe0a8' };
  const SKINS = [0xd2a07a, 0xc08a64, 0x9c6b4a, 0xe0b294, 0x7a5236, 0xb88262, 0xcf9c78];
  const HAIRS = [0x2a1d14, 0x3a2a1c, 0x5a4630, 0x1a1715, 0x6e5232, 0x8a7a66];

  // Aspecto de cada papel: ropa y equipo distintos (se distinguen de lejos por el color y la silueta). Tres
  // variantes por papel (v: 0, 1 o 2; si no se da, al azar): treinta años después del brote no hay uniformes,
  // cada uno viste lo que encontró y lo apañó; lo que los une es el trapo rojo de los Escorpiones (brazalete,
  // pañuelo o una franja) y el equipo de su papel. La sigilosa ya no va de negro entero: tonos apagados de
  // tierra y verde, capucha y la cara tapada con un trapo, ropa blanda que no hace ruido
  const RED = 0xa3241c;
  function lookFor(role, fem, v) {
    const o = { hero: true, npc: true, noBand: true, female: !!fem, skin: pick(SKINS), hair: pick(HAIRS), shoes: 0x2e2620, lips: fem ? 0xa8645a : 0x9a6656,
      longSleeves: true, pocket: true, seed: Math.floor(Math.random() * 1e9), gear: {} };
    const g = o.gear;
    if (v == null) v = Math.floor(Math.random() * 3);
    o.variant = v;
    if (!fem && Math.random() < 0.55) o.beard = U.shade(o.hair, 1.1);
    const VAR = {
      lider: [
        () => { o.shirt = 0x2c3440; o.pants = 0x1f2226; o.shoes = 0x18140f; g.vest = 0x4a4f36; g.armband = RED; g.cap = 0x23272b; g.belt = 0x221d18; },
        // abrigo largo de cuero gastado, pañuelo rojo al cuello, guantes y botas
        () => { o.shirt = 0x5a4a3a; o.pants = 0x2a2a28; o.shoes = 0x1e1812; g.jacket = 0x4a3426; g.coatLong = true; g.scarf = RED; g.belt = 0x221d18; g.gloves = 0x2a2420; g.boots = 0x2a221a; },
        // placas atornilladas sobre el chaleco, gafas en la frente, canana y el brazalete
        () => { o.shirt = 0x3a3e44; o.pants = 0x33362e; o.shoes = 0x1a1612; g.vest = 0x3a3a30; g.plates = 0x6a6e70; g.goggles = 0x5a6a62; g.bando = 0x3a2e22; g.armband = RED; g.boots = 0x2a241e; }
      ],
      tirador: [
        () => { o.shirt = 0x4b5434; o.pants = 0x57533d; g.hood = 0x5a613f; g.mask = 0x6b6a4e; g.belt = 0x3a3324; g.armband = RED; },
        // chaqueta de caza con parches, gorro de lana y bolso cruzado; las gafas subidas
        () => { o.shirt = 0x5a5440; o.pants = 0x4a4a3a; g.jacket = 0x5a5a3a; g.beanie = 0x4a4a32; g.scarf = RED; g.satchel = 0x5a4a32; g.goggles = 0x6a6a52; g.boots = 0x3a3024; },
        // gorra, abrigo largo de cazador, canana con balas de rifle y guantes
        () => { o.shirt = 0x6a6250; o.pants = 0x3e3a30; g.cap = 0x3a3a2a; g.jacket = 0x6a5a44; g.coatLong = true; g.bando = 0x4a3a2a; g.gloves = 0x3a3024; g.armband = RED; }
      ],
      pistolero: [
        () => { o.shirt = 0x3c5a7c; o.pants = 0x2c3346; g.cap = RED; g.capBack = true; },
        // cazadora vaquera sobre camiseta clara, gorro rojo y bolsa en el muslo
        () => { o.shirt = 0xb0a890; o.pants = 0x2a2e38; g.jacket = 0x3a4a62; g.rolled = true; g.beanie = RED; g.pouch = 0x3a3024; o.shoes = 0x5a5a5a; },
        // chupa de cuero negra, pañuelo rojo y gafas de sol de esquí en la frente
        () => { o.shirt = 0x6a3a32; o.pants = 0x25262a; g.jacket = 0x1e1c1c; g.scarf = RED; g.goggles = 0x4a4a52; g.belt = 0x1a1612; }
      ],
      arquero: [
        () => { o.shirt = 0x6e4c30; o.pants = 0x4a3c2c; g.quiver = 0x5a3a22; g.mask = 0x3f6a4a; g.armband = RED; if (fem) o.braid = true; },
        // capucha parda, abrigo verde largo, guantes y vendas en los antebrazos
        () => { o.shirt = 0x5a5440; o.pants = 0x3e3a2e; g.hood = 0x5a4a32; g.jacket = 0x3e4a32; g.coatLong = true; g.quiver = 0x4a3220; g.gloves = 0x4a3a2a; g.rags = 0xb8a888; },
        // camiseta de tirantes, gorro, pañuelo, hombrera de cuero en un brazo y trapos en las muñecas
        () => { o.shirt = 0x7a6a50; o.longSleeves = false; o.pants = 0x4a3e30; g.beanie = 0x6a5a3a; g.scarf = RED; g.quiver = 0x5a3a22; g.pads = 0x5a3a22; g.padsOne = true; g.rags = 0x9a8a6a; if (fem) o.braid = true; }
      ],
      escopetero: [
        () => { o.shirt = 0x6a6a64; o.longSleeves = false; o.pants = 0x3a3d33; g.hiviz = 0xe0761e; o.hair = null; if (!fem) o.beard = 0x3a2a1c; o.scale = 1.07; g.armband = RED; },
        // casco de obra, placas en el pecho, guantes y botas: el que entra primero por la puerta
        () => { o.shirt = 0x4a4a40; o.pants = 0x3a3a34; g.helmet = 0xd8a020; g.plates = 0x7a7468; g.gloves = 0x2a2620; g.boots = 0x2e2820; o.scale = 1.07; },
        // chaqueta de trabajo con las mangas subidas, gorra y la canana de cartuchos rojos
        () => { o.shirt = 0x5a5650; o.pants = 0x2e302a; g.jacket = 0x5a3a2a; g.rolled = true; g.cap = 0x3a3a3a; g.bando = RED; if (!fem) o.beard = 0x3a2a1c; o.scale = 1.05; }
      ],
      bruto: [
        () => { o.shirt = 0x7c2a22; o.longSleeves = false; o.pants = 0x2f3230; g.hockey = 0xe6e1d3; g.belt = 0x2a2420; o.scale = 1.1; },
        // hombreras de fútbol americano y placas encima, gafas de soldar y la cara tapada; brazos al aire
        () => { o.shirt = 0x3a3a34; o.longSleeves = false; o.pants = 0x2a2c2a; g.pads = 0x2a2a2a; g.plates = 0x5a5a5a; g.goggles = 0x3a4a3a; g.mask = 0x5a3a2a; g.gloves = 0x1e1a16; g.boots = 0x2a221a; o.scale = 1.12; },
        // casco de moto, chupa de motero sin abrochar, rodilleras y el brazalete
        () => { o.shirt = RED; o.pants = 0x25262a; g.helmet = 0x1e1e20; g.moto = true; g.jacket = 0x2a1e18; g.kneepads = 0x2a2a2a; g.boots = 0x1e1812; o.scale = 1.1; }
      ],
      sigilo: [
        // sudadera con capucha verde oliva, trapo en la cara, chaqueta gris verdosa, rodilleras y guantes
        () => { o.shirt = 0x4a4e42; o.pants = 0x3a3c38; o.shoes = 0x2a2824; g.hood = 0x3a3e30; g.mask = 0x4a4a3e; g.kneepads = 0x3a3a34; g.gloves = 0x2a2a26; g.satchel = 0x3e3a2e; o.hair = null; o.beard = null; },
        // gorro, pañuelo rojo de los Escorpiones en la cara, abrigo largo pardo y trapos en los brazos
        () => { o.shirt = 0x3e3a34; o.pants = 0x2e2e2a; o.shoes = 0x241e18; g.beanie = 0x2e3230; g.mask = 0x6a2a24; g.jacket = 0x3a2e24; g.coatLong = true; g.rags = 0x6a6250; g.belt = 0x221c16; o.beard = null; },
        // capucha parda, bufanda tapando la boca, camisa remendada, bolsa en el muslo y botas blandas
        () => { o.shirt = 0x4a4a42; o.pants = 0x34302a; o.shoes = 0x2e261e; g.hood = 0x4a3a2c; g.mask = 0x5a5446; g.pouch = 0x3a3024; g.kneepads = 0x4a4038; g.boots = 0x3a3024; o.hair = null; o.beard = null; }
      ],
      saqueador: [
        () => { o.shirt = 0xc4a02a; o.pants = 0x3d4250; g.beanie = 0x3a5a7a; g.pack = 0x5c4a32; g.armband = RED; },
        // cazadora azul gastada, gorra mostaza, mochila y bolso cruzado (lleva de todo)
        () => { o.shirt = 0x7a5a3a; o.pants = 0x3a3e46; g.jacket = 0x4a5a6a; g.cap = 0x8a7a3a; g.pack = 0x4a4030; g.satchel = 0x6a5a3a; g.gloves = 0x3a3024; },
        // capucha gris, mascarilla de polvo, mochila verde, bolsa en el muslo y rodilleras
        () => { o.shirt = 0xb08a40; o.pants = 0x40424a; g.hood = 0x6a6a62; g.mask = 0x8a8a7a; g.pack = 0x3a4a3a; g.pouch = 0x4a3a2a; g.kneepads = 0x3a3a3a; g.armband = RED; }
      ],
      // explorador: chaqueta clara de montaña, gorra y mochila; carroñero: harapos, gorro y pañuelo
      explorador: [
        () => { o.shirt = pick([0x5e7f86, 0x7a8a5a, 0x8a6a4a]); o.pants = 0x4a4a40; g.cap = pick([0x2e5a62, 0x5a5a2e]); g.pack = 0x4e5a3a; g.belt = 0x3a3024; g.armband = RED; },
        () => { o.shirt = pick([0x8a8a7a, 0x6a5a48]); o.pants = 0x3e3e38; g.jacket = pick([0x4e6a72, 0x6a7a4a]); g.beanie = pick([0x5a3a2a, 0x3a4a5a]); g.pack = 0x5a4a32; g.boots = 0x3a3024; },
        () => { o.shirt = pick([0x6a7060, 0x7a6a50]); o.pants = 0x44443c; g.hood = pick([0x5a5e52, 0x6a5a44]); g.scarf = RED; g.satchel = 0x4a3a2a; g.pouch = 0x3a3024; }
      ],
      carronero: [
        () => { o.shirt = pick([0x6a5a48, 0x4e5048, 0x7a4a3a]); o.longSleeves = Math.random() < 0.5; o.pants = 0x3e3a34; g.beanie = pick([0x6a3a2a, 0x3a3a3a, 0x5a5a32]); g.mask = 0x8a7a5a; },
        () => { o.shirt = pick([0x5a5248, 0x6a4a3a]); o.longSleeves = false; o.pants = 0x3a3630; g.helmet = pick([0x8a2a22, 0x2a3a5a]); g.moto = true; g.rags = 0x8a7a5a; g.armband = RED; },
        () => { o.shirt = pick([0x4a4a40, 0x6a6050]); o.pants = 0x34322c; g.hood = 0x4a4438; g.pads = 0x3a3a34; g.padsOne = true; g.mask = 0x6a5a44; g.gloves = 0x2a2620; }
      ],
      // supervivientes (la otra facción): ropa de civil remendada, sin el rojo de los Escorpiones; un trapo verde
      // en el brazo para reconocerse entre ellos
      superviviente: [
        () => { o.shirt = pick([0x7a7a6a, 0x6a5a4a, 0x8a8070]); o.pants = 0x4a4a42; g.armband = 0x4a6a3a; g.rags = 0xb8ae96; },
        () => { o.shirt = pick([0x5a6a7a, 0x8a6a5a]); o.pants = 0x3e4048; g.jacket = pick([0x6a6a5a, 0x5a4a3a]); g.rolled = true; g.armband = 0x4a6a3a; },
        () => { o.shirt = pick([0x9a8a6a, 0x6a7060]); o.longSleeves = false; o.pants = 0x4a4438; g.beanie = pick([0x4a5a3a, 0x6a5a3a]); g.scarf = 0x4a6a3a; }
      ]
    };
    const L0 = VAR[role];
    if (L0) L0[Math.min(L0.length - 1, v)]();
    // los Escorpiones: mallas low poly con textura (src/charmesh_esc*.js) con sus variantes de color
    if (ROLES[role] && role !== 'superviviente') escMesh(o, role, fem);
    return o;
  }
  // Modelos de los Escorpiones: cuatro hombres (el líder tiene el suyo, con casco) y dos mujeres, cada uno con su
  // color original y dos o tres variantes (MESH_VARS en models.js). Se reparten de un mazo barajado por sexo: no se
  // repite modelo y color hasta que salieron todos. El líder, uno por escuadrón, siempre con una de sus tres variantes.
  // sc: para que todos midan lo mismo (hombres ~1,80 m, mujeres ~1,70 m)
  const ESC = { m: ['esc0', 'esc1', 'esc2'], f: ['escf1', 'escf2'] };
  const ESC_SC = { esc0: 0.989, esc1: 0.988, esc2: 0.968, escf1: 0.921, escf2: 0.913, esclid: 0.969 };
  const DECK = { m: [], f: [] };
  function escMesh(o, role, fem) {
    if (!G.CharMesh || !G.MESH_VARS) return;
    let m, v;
    if (role === 'lider' && G.CharMesh.esclid) { m = 'esclid'; v = 1 + Math.floor(Math.random() * G.MESH_VARS.esclid.length); }
    else {
      const k = fem ? 'f' : 'm', D = DECK[k];
      if (!D.length) {
        for (const id of ESC[k]) if (G.CharMesh[id]) for (let i = 0; i <= (G.MESH_VARS[id] || []).length; i++) D.push([id, i]);
        for (let i = D.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = D[i]; D[i] = D[j]; D[j] = t; }
      }
      if (!D.length) return;
      [m, v] = D.pop();
    }
    o.mesh = m; o.meshVar = v;
    o.scale = (o.scale || 1) * (ESC_SC[m] || 1);
  }

  // Humanos preparados de antemano (detrás de la pantalla de carga): los que salen en mitad del enfrentamiento
  // (refuerzos de la caza, las oleadas del asalto) ya tienen su cuerpo armado, con el arma en la mano. Por papel y
  // si es mujer u hombre (según el nombre que le toque)
  const PREP = {};
  const prepKey = (role, fem) => role + (fem ? 'f' : 'm');
  function prepLook(role, fem) {
    const b = PREP[prepKey(role, fem)];
    if (b && b.length) {
      const e = b.pop();
      if (G.Zombie.pool) G.Zombie.pool.byLook.set(e.look, e);
      return e.look;
    }
    return lookFor(role, fem);
  }
  function prepOne(role, fem) {
    const look = lookFor(role, fem);
    const model = G.Models.createHumanoid(look);
    G.Models.setWeapon(model, ROLES[role].w);
    G.Models.setLOD(model, 0, true); G.Models.setLOD(model, -1, true); G.Models.setLOD(model, 1, true);
    const k = prepKey(role, fem);
    (PREP[k] = PREP[k] || []).push({ look, model, human: true });
  }

  // ---------- Lo que dicen ----------
  // {to}: a quién le habla · {x}: de quién hablan · {dir}: dónde (a las tres, arriba...)
  const L = {
    // (la huida: los escorpiones contra los infectados)
    zfight: ['¡Infectados! ¡Fuego!', '¡Limpiad la zona!', '¡Ahí vienen los podridos!', '¡Que no se acerquen!', '¡Por la izquierda, infectados!'],
    zdown: ['Abatido.', 'Ese no se levanta.', 'Uno menos.', 'Siguiente.'],
    zhurt: ['¡Me ha mordido!', '¡Quitádmelo de encima!', '¡Agh! ¡Ayuda!'],
    // (el capitolio: los presos que se escapan)
    pfight: ['¡Se escapa un preso!', '¡Que no salga nadie!', '¡A las celdas, ya!', '¡Disparad a los que corren!'],
    pdown: ['Uno menos que alimentar.', 'Eso le pasa por correr.', 'Ese ya no se escapa.'],
    start: ['Muy bien. Limpiamos la zona. Nada de riesgos.', 'Abrid bien los ojos. Esto tiene que quedar limpio.', 'En marcha. Despacio y juntos.'],
    sector: ['Siguiente zona. Despacio.', 'Vamos hacia allí.', 'Por aquí. Atentos.', 'Esa zona, ahora.'],
    clear: ['Despejado.', 'Aquí no hay nadie.', 'Limpio.', 'Nada por aquí.'],
    ordGuard: ['{to}, cúbrenos desde allí.', '{to}, sube a ese sitio y vigila.', '{to}, monta guardia cerca de mí.'],
    ordLoot: ['{to}, revisa esa habitación. Rápido.', '{to}, mira qué hay ahí dentro. Solo lo útil.', '{to}, a lo tuyo: saquea eso.'],
    ordScout: ['{to}, adelántate. Sin ruido.', '{to}, echa un vistazo por delante.'],
    ordFlankL: ['{to}, por la izquierda.', '{to}, rodéalo por la izquierda.'],
    ordFlankR: ['{to}, por la derecha.', '{to}, ábrete por la derecha.'],
    ordRush: ['{to}, ¡a por él!', '{to}, ¡machácalo!'],
    ordCover: ['{to}, ¡cúbrenos!', '{to}, ¡no dejes que asome la cabeza!'],
    ordHide: ['{to}, ¡quítate de en medio!', '{to}, ¡escóndete!'],
    ordSneak: ['{to}, rodéalo. Que no te vea.', '{to}, por detrás. Ya sabes.'],
    ack: ['Voy.', 'Entendido.', 'Hecho.', 'Vale, jefe.', 'Ahora mismo.'],
    ackLoyal: ['Lo que digas, jefe.', 'Cuenta con ello.', 'Ya voy.'],
    refuse: ['¿Yo solo? Ni hablar.', 'Hazlo tú.', 'No pienso ir ahí.', 'Que vaya otro.'],
    refuseLate: ['Vale, vale... voy.', 'Bah. Voy, pero me debes una.'],
    contact: ['¡Contacto! ¡{dir}!', '¡Lo tengo! ¡{dir}!', '¡Ahí está! ¡{dir}!', '¡Allí! ¡{dir}!'],
    heard: ['He oído algo.', '¿Habéis oído eso?', 'Ruido por aquí.'],
    checkNone: ['Nada.', 'Falsa alarma.', 'Será el viento.'],
    shotHeard: ['¡Disparos!', '¡Eso ha sido un tiro!'],
    hit: ['¡Me han dado!', '¡Agh! ¡Estoy herido!', '¡Me ha dado!'],
    hitUnseen: ['¡Me han dado! ¿Desde dónde?', '¡Francotirador! ¡No lo veo!'],
    pain: ['¡Mierda!', '¡Maldita sea!', '¡Hijo de...!'],
    lost: ['¿Dónde se ha metido?', 'Lo perdí.', 'Se ha escondido.'],
    search: ['Abríos. Tiene que estar cerca.', 'Buscadlo. No puede haber ido lejos.', 'Peinad la zona.'],
    giveUp: ['Se ha ido. Seguimos con lo nuestro.', 'Nada. Volved a la ronda.'],
    found: ['¡Otra vez aquí!', '¡Ahí sigue!'],
    reload: ['¡Recargando!', '¡Cambio cargador!', '¡Cubridme, recargo!'],
    cover: ['¡Te cubro!', '¡Ve, te cubro!'],
    suppressed: ['¡Me tiene a tiro!', '¡Cuerpo a tierra!', '¡Casi me da!'],
    lineFire: ['¡Fuera de mi línea!', '¡Apártate, que no tengo tiro!'],
    smoke: ['¡Humo!', '¡Bote de humo!', '¡Echo humo!'],
    dry: ['¡Está sin balas!', '¡Ha hecho clic! ¡Está vacío!', '¡No le quedan balas!'],
    dryPush: ['¡Ahora! ¡A por él!', '¡Echadle encima!'],
    reloadHeard: ['¡Está recargando!', '¡Recarga! ¡Ahora!'],
    manDown: ['¡Han matado a {x}!', '¡{x} ha caído!', '¡Hombre abajo!'],
    grief: ['¡No! ¡{x}!', '¡{x}! ¡Noooo!', '¡Vas a pagar por esto!', '¡Te voy a matar!'],
    cold: ['Uno menos para repartir.', 'Siempre fue un estorbo.', 'Mala suerte, {x}.'],
    leaderDown: ['¡Han matado al jefe!', '¡{x} ha caído! ¿Y ahora qué?'],
    newLeader: ['¡Escuchadme! ¡Ahora mando yo!', '¡Conmigo! ¡Yo me encargo!'],
    regroup: ['¡Replegaos conmigo!', '¡Juntos! ¡Todos aquí!'],
    retreat: ['¡Retirada! ¡Nos vamos!', '¡Esto se ha torcido! ¡Fuera de aquí!', '¡No vale la pena! ¡Atrás!'],
    flee: ['¡Yo me largo!', '¡No me pagan para esto!', '¡Se acabó, me voy!'],
    bandage: ['Me vendo. Cubridme.', 'Un segundo... me vendo.'],
    enraged: ['¡Ven aquí!', '¡Te voy a arrancar la cabeza!'],
    melee: ['¡Ven aquí!', '¡Toma!', '¡Quieta!'],
    sneakAtk: ['Shh...', 'Duérmete.'],
    // rendirse y negociar
    begItems: ['¡Espera, espera! ¡Toma, llévate lo que llevo!', '¡No me mates! ¡Te doy todo lo que tengo!'],
    begInfo: ['¡Para! ¡Te digo dónde están los demás!', '¡No dispares! ¡Sé dónde se esconden!'],
    begLeave: ['¡Me rindo! ¡Me voy y no vuelvo, lo juro!', '¡Déjame ir! ¡No me volverás a ver!'],
    begWait: ['Por favor...', 'No lo hagas...', 'Tengo familia...'],
    spared: ['Gracias... gracias.', 'No lo olvidaré.', 'Me voy. Me voy.'],
    traitor: ['¡Cobarde! ¡Levántate!', '¡Traidor!', '¿Te rindes? ¿En serio?'],
    // rehén
    hostage: ['¡Suéltame! ¡Suéltame!', '¡No dispares! ¡No dispares!', '¡Ah! ¡Quieto, quieto!'],
    hostageSeen: ['¡Tiene a {x}!', '¡Ha cogido a {x}!'],
    hostageDemand: ['¡Suelta a {x}!', '¡Suéltalo y nadie más sale herido!', '¡Baja el arma!', '¡Déjalo ir y te dejamos en paz!'],
    holdFire: ['¡No disparéis! ¡Tiene a {x}!', '¡Alto el fuego!'],
    fireAnyway: ['¡Disparad igual!', '¡Me da igual! ¡Disparad!'],
    disobey: ['¡No pienso darle a {x}!', '¡Estás loco! ¡Es {x}!'],
    hostageExec: ['¡NO! ¡{x}!', '¡Lo ha matado! ¡Lo ha matado a sangre fría!'],
    released: ['¡Me ha soltado!', '¡Estoy bien!'],
    breakFree: ['¡Suelta!', '¡Ahora!'],
    // charla mientras hacen la ronda (de dos en dos: [quien empieza, quien contesta])
    banterGood: [['¿Cómo va ese hombro?', 'Mejor. Gracias por lo de ayer.'], ['Cuando acabemos, te invito a lo que quede de café.', 'Trato hecho.'],
      ['¿Sigues con esa canción en la cabeza?', 'Ni me la nombres.'], ['Quédate cerca, ¿vale?', 'Siempre.'], ['Si salimos de esta, nos vamos al norte.', 'Me gusta cómo suena.']],
    banterBad: [['Si vuelves a quedarte atrás, te dejo tirado.', 'Inténtalo.'], ['¿Otra vez detrás de mí?', 'Alguien tiene que vigilarte.'],
      ['Haces más ruido que un infectado.', 'Y tú hablas más que uno.'], ['No toques mis cosas.', '¿Qué cosas? Si no tienes nada.']],
    banterLeader: [['Jefe, ¿cuánto más?', 'Lo que haga falta. Seguid.'], ['¿Seguro que aquí hay algo?', 'Seguro. Callad y mirad.'], ['¿Y si no hay nadie?', 'Mejor para nosotros.']],
    banterAny: [['Este sitio me da escalofríos.', 'A todos.'], ['¿Has oído eso?', 'Será el viento.'], ['Huele a quemado.', 'Todo huele a quemado ya.']],
    loot: ['Aquí hay algo...', 'Me lo llevo.', 'Esto nos viene bien.'],
    lootNone: ['Aquí no queda nada.', 'Vacío.'],
    door: ['Abro.', 'Puerta.'],
    dodge: ['¡Uf!', '¡Casi!'],
    // asalto humano: el último de la segunda oleada huye a buscar a su grupo; y el grupo llega
    callBackup: ['¡Vale, tú ganas! ¡Pero vuelvo con los míos y te vamos a despedazar!', '¡Esto no acaba aquí! ¡Voy a por mi grupo!', '¡Vas a ver cuando vuelva con los demás! ¡Estás muerto!'],
    revenge: ['¿Ese es el que se cargó a los nuestros? Acabad con él.', 'Ahí está. Que no salga vivo de aquí.', 'Nos dijeron que eras duro. Vamos a ver.'],
    waveIn: ['Algo se mueve por aquí. Separaos.', 'Buscad bien. Hay algo que vale la pena.', 'Mirad en todos lados.']
  };
  // palabras de la dirección según la hora del reloj (12 delante)
  const CLOCK = ['A las doce', 'A la una', 'A las dos', 'A las tres', 'A las cuatro', 'A las cinco', 'A las seis', 'A las siete', 'A las ocho', 'A las nueve', 'A las diez', 'A las once'];

  // ---------- Estado del módulo ----------
  let scene = null;
  const squads = [];
  let T = 0;                 // reloj de la partida (s)
  let selfEmit = false;      // ruidos de los propios humanos: no se investigan a sí mismos
  const smokes = [];         // nubes de humo (tapan la vista)
  const proj = [];           // flechas y botes de humo en el aire
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
  function emitSelf(x, z, r, lv) { selfEmit = true; try { G.World.emit(x, z, r, lv); } finally { selfEmit = false; } }
  function msg(t, k) { if (Humans.onMessage) Humans.onMessage(t, k); }

  // ---------- Voces y subtítulos ----------
  // Una sola voz a la vez (la de más prioridad); cada frase sale en los subtítulos con el nombre de quien habla.
  // Solo se oye lo que se dice cerca (o lo que te llega por la radio de uno que tienes cerca). Voz del navegador
  // (síntesis de voz en español, con un tono y una velocidad para cada uno); si no hay, solo subtítulos
  const Voice = {
    q: [], cur: null, end: 0, box: null, lines: [], voices: [], ok: false,
    init() {
      this.box = document.getElementById('h-subs');
      if (!this.box) { this.box = document.createElement('div'); this.box.id = 'h-subs'; document.body.appendChild(this.box); }
      try {
        this.ok = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
        if (this.ok) {
          const load = () => {
            const all = window.speechSynthesis.getVoices() || [];
            const es = all.filter((v) => /^es/i.test(v.lang));
            // primero las de España (los diálogos usan «vosotros»), luego el resto en español
            this.voices = es.filter((v) => /es[-_]ES/i.test(v.lang)).concat(es.filter((v) => !/es[-_]ES/i.test(v.lang)));
          };
          load();
          window.speechSynthesis.onvoiceschanged = load;
        }
      } catch (e) { this.ok = false; }
    },
    voiceFor(h) {
      if (!this.voices.length) return null;
      // de las disponibles, una según quién es (mujeres y hombres con voces distintas si las hay)
      const fem = this.voices.filter((v) => /female|mujer|monica|mónica|paulina|helena|laura|lucia|lucía|elvira|sabina|conchita|penelope|lupe|marisol|esperanza/i.test(v.name));
      const mal = this.voices.filter((v) => /male|hombre|jorge|diego|juan|carlos|pablo|enrique|alvaro|álvaro|raul|raúl|miguel|andres|andrés/i.test(v.name) && !/female/i.test(v.name));
      const pool = (h.female ? fem : mal).length ? (h.female ? fem : mal) : this.voices;
      return pool[(h.vIdx || 0) % pool.length];
    },
    // prio: 1 charla, 2 órdenes y respuestas, 3 avisos de combate, 4 gritos (siempre)
    say(h, text, o) {
      if (!h || !text) return;
      o = o || {};
      const prio = o.prio || 2;
      // la misma persona no repite lo mismo seguido
      if (h.lastLine === text && T - (h.lastLineT || -99) < 8) return;
      if (this.q.length >= 4) {
        let lo = -1;
        for (let i = 0; i < this.q.length; i++) if (lo < 0 || this.q[i].prio < this.q[lo].prio) lo = i;
        if (this.q[lo].prio > prio) return;
        this.q.splice(lo, 1);
      }
      this.q.push({ h, text, prio, to: o.to || null, t0: T, force: !!o.force, after: o.after || 0 });
    },
    clear() {
      this.q.length = 0; this.cur = null; this.end = 0;
      for (const l of this.lines) l.el.remove();
      this.lines.length = 0;
      try { if (this.ok) window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
    },
    update(dt, player) {
      // subtítulos que se acaban
      for (let i = this.lines.length - 1; i >= 0; i--) {
        const l = this.lines[i];
        if (T > l.end) { l.el.classList.add('out'); if (T > l.end + 0.4) { l.el.remove(); this.lines.splice(i, 1); } }
      }
      // las que llevan mucho esperando se descartan
      for (let i = this.q.length - 1; i >= 0; i--) { const it = this.q[i]; if (T - it.t0 > (it.prio >= 3 ? 4 : 6) + it.after) this.q.splice(i, 1); }
      if (this.cur && T < this.end) {
        // un grito urgente corta una charla
        const top = this.q.reduce((a, b) => (b.after <= T - b.t0 && (!a || b.prio > a.prio) ? b : a), null);
        if (!top || top.prio < 3 || this.cur.prio >= 3) return;
        try { if (this.ok) window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
      }
      this.cur = null;
      let best = -1;
      for (let i = 0; i < this.q.length; i++) {
        const it = this.q[i];
        if (T - it.t0 < it.after) continue;
        if (best < 0 || it.prio > this.q[best].prio) best = i;
      }
      if (best < 0) return;
      const it = this.q.splice(best, 1)[0];
      const h = it.h;
      if ((!h.alive && !it.force) || h.gone) return;
      if (it.to && (!it.to.alive || it.to.gone) && it.prio < 3) return;        // (una orden a alguien que ya cayó)
      // ¿se oye? cerca de quien habla, o por la radio de aquel a quien le habla
      const d = Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z);
      let radio = false;
      if (d > 34) {
        const to = it.to;
        if (to && to.alive && Math.hypot(to.pos.x - player.pos.x, to.pos.z - player.pos.z) < 16) radio = true;
        else return;
      }
      h.lastLine = it.text; h.lastLineT = T;
      const dur = 0.9 + it.text.length * 0.058;
      this.cur = it; this.end = T + dur * 0.9;
      this.show(h, it.text, dur, d, radio);
      this.speak(h, it.text, d, radio);
      h.talkT = dur;
    },
    show(h, text, dur, d, radio) {
      if (!this.box) return;
      const el = document.createElement('div');
      el.className = 'hs-line' + (radio ? ' radio' : '');
      el.innerHTML = '<b style="color:' + h.color + '">' + h.name + (radio ? ' (radio)' : '') + ':</b> ' + text.replace(/</g, '&lt;');
      el.style.opacity = String(radio ? 0.8 : U.clamp(1.25 - d / 34, 0.55, 1));
      this.box.appendChild(el);
      this.lines.push({ el, end: T + dur + 1.2 });
      while (this.lines.length > 3) { const o = this.lines.shift(); o.el.remove(); }
    },
    speak(h, text, d, radio) {
      if (!this.ok || !Humans.voices) return;
      try {
        // (las interjecciones no se leen: la voz sintética dice «a, ge, hache»; el quejido ya suena aparte)
        const said = text.replace(/[¡¿]?\b(A+g+h+|U+g+h+|A+r+g+h+)\b[!?]?\s*/gi, '').replace(/[¡¿]/g, '').trim();
        if (!said) return;
        const u = new SpeechSynthesisUtterance(said);
        const v = this.voiceFor(h);
        if (v) u.voice = v;
        u.lang = v ? v.lang : 'es-ES';
        u.pitch = U.clamp(h.vp, 0.1, 2); u.rate = U.clamp(h.vr * (radio ? 1.05 : 1), 0.5, 1.8);
        const A = G.Audio && G.Audio.vol ? G.Audio.vol.master * (G.Audio.vol.fx != null ? G.Audio.vol.fx : 1) : 0.8;
        u.volume = U.clamp(A * (radio ? 0.35 : U.clamp(1.25 - d / 30, 0.15, 1)), 0, 1);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (e) { /* sin voz */ }
    }
  };
  function line(key, rep) {
    let t = pick(L[key] || [key]);
    if (rep) for (const k in rep) t = t.split('{' + k + '}').join(rep[k]);
    return t;
  }

  // ---------- Humo (tapa la vista) ----------
  function smokeBlocks(x0, z0, x1, z1) {
    for (const s of smokes) {
      if (s.t < 0.4 || s.t > s.T) continue;
      const vx = x1 - x0, vz = z1 - z0, l2 = vx * vx + vz * vz || 1;
      const k = U.clamp(((s.x - x0) * vx + (s.z - z0) * vz) / l2, 0, 1);
      if (Math.hypot(x0 + vx * k - s.x, z0 + vz * k - s.z) < s.r * 0.85) return true;
    }
    return false;
  }
  function inSmoke(x, z) { for (const s of smokes) if (s.t > 0.3 && s.t < s.T && Math.hypot(x - s.x, z - s.z) < s.r * 0.9) return true; return false; }

  // estados en los que el humano no controla lo que hace (los lleva la clase base: golpes, remates, fuego...)
  const UNCTRL = { stagger: 1, stun: 1, held: 1, grabbed: 1, grapple: 1, burning: 1, burnroll: 1, down: 1, rise: 1, climb: 1, dead: 1, ragdoll: 1 };
  // y de esos, los que se dibujan con las poses de los infectados (el resto, con las de la protagonista)
  const ZPOSE = { stun: 1, held: 1, grabbed: 1, grapple: 1, burning: 1, burnroll: 1, down: 1, rise: 1, dead: 1 };
  // estados de los humanos
  const HSTATE = { patrol: 1, guard: 1, loot: 1, check: 1, fight: 1, melee: 1, stab: 1, throw: 1, beg: 1, hostage: 1, flee: 1, bandage: 1, idle: 1 };
  // se le puede agarrar por la espalda (o tomar de rehén) si no está peleando
  const CALM = { patrol: 1, guard: 1, loot: 1, check: 1, idle: 1 };

  // =================================================================
  class Human extends Z {
    constructor(scene, x, z, facing, role, squad, o) {
      const R = ROLES[role];
      super(scene, x, z, null, facing, { human: o.look, lv: o.lv || 0, hp: R.hp * (o.hpMul || 1) });
      this.role = role; this.R = R; this.squad = squad; this.name = o.name; this.female = !!o.look.female;
      this.color = COLOR[role]; this.idx = o.idx;
      this.vp = o.look.female ? rr(1.15, 1.45) : rr(0.62, 0.95); this.vr = rr(0.95, 1.12); this.vIdx = o.idx;
      if (role === 'bruto') { this.vp = 0.5; this.vr = 0.88; }
      if (role === 'lider') { this.vp = o.look.female ? 1.05 : 0.72; this.vr = 0.96; }
      this.w = G.Weapons.get(R.w);
      this.gunW = G.Weapons.isGun(this.w);
      this.gkind = this.gunW ? (this.w.anim || this.w.gun) : null;
      G.Models.setWeapon(this.model, R.w);
      this.mag = this.gunW ? this.w.mag : 0;
      this.g = { aim: 0, recoil: 0, cycle: -1, rw: 0, ru: 0, draw: 0, arrow: true, reload: null };
      this._gs = { kind: this.gkind, aim: 0, recoil: 0, cycle: -1, rw: 0, ru: 0, draw: 0, arrow: true };
      this.state = 'idle'; this.timer = 0.5 + Math.random();
      this.task = null; this.goal = null; this.moveSp = 0; this.faceYaw = null;
      this.crouchAmt = 0; this.wantCrouch = false; this.moveRel = 0; this.moveAmt = 0; this.speedNow = 0; this.phase = Math.random() * 10;
      this.aimPitch = 0; this.lookAt = null; this.alertAmt = 0;
      this.seesP = false; this.notice = 0; this.lostT = 99; this.reactT = 0; this.fireT = 0; this.burst = 0;
      this.spot = null; this.spotT = 0; this.tac = 'peek'; this.tacT = 0;
      this.suppressed = 0; this.recent = []; this.bag = []; this.smoke = R.smoke || 0; this.healed = false; this.begUsed = false;
      this.act = null; this.dodge = null; this.dodgeCD = 2; this.atkCD = 0;
      this.time = 0; this.twitchT = 1e9; this.talkT = 0;
      this.ready = true;
      this.apply(0);
    }

    // ---- lo que la clase base pregunta ----
    aware() { return !!(this.squad && this.squad.mode !== 'sweep' && this.squad.active) || this.state === 'fight' || this.state === 'melee'; }
    // desprevenido de espaldas: se le puede eliminar en silencio o tomar de rehén
    get grabOk() { return this.alive && this.standing && CALM[this.state] && !this.seesP && (!this.squad || this.squad.mode !== 'combat' || this.lostT > 4); }
    scare() { /* los humanos no se asustan como los infectados: su moral la lleva el escuadrón */ }
    // (el aviso de los infectados no vale para ellos: el escuadrón ya sabe dónde estás)
    alertNearby(player) { if (this.squad && this.squad.active && player) this.squad.know(player, false, null); }
    get engaged() { return !!this.squad && this.squad.active && (this.squad.mode === 'combat' || this.squad.mode === 'search'); }

    say(key, rep, o) { if (this.alive || (o && o.force)) Voice.say(this, line(key, rep), o); }

    hear(x, z, r, lv) {
      if (selfEmit || !this.alive || !this.squad || this.gone) return;
      if (!HSTATE[this.state] || this.state === 'beg' || this.state === 'hostage' || this.state === 'flee') return;
      lv = lv || 0;
      if (lv !== (this.lv || 0)) r *= 0.55;
      r *= 0.85 + this.pers.alert * 0.35;
      if (G.Sky) r *= G.Sky.hear(true);
      const d = Math.hypot(x - this.pos.x, z - this.pos.z);
      if (d > r) return;
      if (d > r * 0.6 && lv === (this.lv || 0) && !G.World.hasLOS(this.pos.x, this.pos.z, x, z, this.lv)) return;
      this.squad.onNoise(this, x, z, r, lv);
    }

    // ---- golpes ----
    takeHit(dmg, knock, dx, dz, behind, side, kind, part, src) {
      if (!this.alive) return 'none';
      // rendido o de rehén: cualquier golpe lo mata
      if (this.state === 'beg' || this.state === 'hostage') { dmg = 999; part = 'head'; }
      if (this.R.armor && part !== 'head' && kind === 'shot') dmg *= this.R.armor;
      const r = super.takeHit(dmg, knock, dx, dz, behind, side, kind, part, src);
      if (r === 'none' || r === 'block') return r;
      this.recent.push(T);
      while (this.recent.length && T - this.recent[0] > 3.2) this.recent.shift();
      if (this.alive && this.squad) {
        this.squad.onHurt(this, src && src.by);
        // muy tocado a golpes seguidos: puede rendirse al recuperarse
        if ((this.recent.length === 3 || (this.hp < this.hpMax * 0.35 && !this.lowRolled)) && !this.begPending) { this.lowRolled = this.hp < this.hpMax * 0.35; this.begPending = this.wantsBeg(); }
        // el quejido (voz sintetizada, como la del jugador) y, a veces, una frase
        if (G.Audio && T - (this.hurtVoxT || -9) > 0.35) { this.hurtVoxT = T; G.Audio.play('hHurt', { x: this.pos.x, z: this.pos.z, lv: this.lv || 0, female: this.female, hard: this.hp < this.hpMax * 0.5 }); }
        if (kind === 'shot' && !this.seesP) this.say('hitUnseen', null, { prio: 3 });
        else if (Math.random() < 0.3) this.say(this.hp < this.hpMax * 0.5 ? 'hit' : 'pain', null, { prio: 3 });
      }
      return r;
    }
    stun(dur, dx, dz, force) {
      super.stun(dur, dx, dz, force);
      // (solo si lo vienen moliendo a golpes o ya está tocado: una bomba de humo sola no lo rinde)
      if (this.alive && this.state === 'stun' && (this.recent.length >= 2 || this.hp < this.hpMax * 0.5)) { this.recent.push(T); this.begPending = this.begPending || this.wantsBeg(true); }
    }
    // ¿se rendiría? (el líder y el bruto nunca; el saqueador casi siempre; el resto según lo valientes que sean)
    wantsBeg(stunned) {
      if (this.begUsed || this.role === 'lider' || this.role === 'bruto' || this.enraged > 0) return false;
      if (this.squad && this.squad.noBeg) return false;            // (la venganza: pelean hasta el final)
      if (this.state === 'hostage') return false;
      let p = (1 - this.pers.brave) * 0.75 + (this.R.coward ? 0.45 : 0) + (stunned ? 0.15 : 0) + (this.hp < this.hpMax * 0.4 ? 0.2 : 0) - (this.squad && this.squad.morale > 0.7 ? 0.15 : 0);
      return Math.random() < U.clamp(p, 0, 0.92);
    }
    die(dir) {
      const was = this.alive;
      if (this.state === 'beg' || this.state === 'hostage') this.npcK = 0;
      super.die(dir);
      if (!was) return;
      if (G.Audio) G.Audio.play('pDeath', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, vol: 0.8 });
      if (Humans.player && Humans.player.hostage && Humans.player.hostage.h === this) Humans.player.hostage = null;
      this.dropLoot();
      if (this.squad) this.squad.onDeath(this);
    }
    // lo que suelta al morir: munición de su arma (poca) y lo que haya saqueado
    dropLoot() {
      const W = G.World, P = G.Pickups;
      if (!P || !P.add || !P.KINDS) return;
      const put = (id, n) => {
        if (!P.KINDS[id]) return;
        const a = Math.random() * TAU, r = 0.3 + Math.random() * 0.5;
        let x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
        if (W.circleBlocked(x, z, 0.12, this.lv || 0)) { x = this.pos.x; z = this.pos.z; }
        P.add(id, n, { x, y: W.groundY(x, z, this.lv || 0), z, lv: this.lv || 0 });
      };
      for (const it of this.bag) put(it.id, it.n);
      this.bag.length = 0;
      // (su munición solo si te sirve: si llevas en las manos un arma que la use)
      const Pp = Humans.player, mine = Pp && this.gunW && Pp.hands.some((s) => s && G.Weapons.get(s.id).ammo === this.w.ammo);
      const am = mine && G.Weapons.AMMO[this.w.ammo];
      if (am && Math.random() < 0.6) put(am.item, am.item === 'mun_smg' ? 6 + Math.floor(Math.random() * 6) : 1 + Math.floor(Math.random() * 2));
      if (this.smoke > 0 && Math.random() < 0.6) put('humo', 1);
    }

    // ---------- Cada fotograma ----------
    update(dt, player, all, combat) {
      if (this.gone) return;
      this.time += dt;
      if (this.talkT > 0) this.talkT -= dt;
      if (this.enraged > 0) this.enraged -= dt;
      if (this.suppressed > 0) this.suppressed -= dt;
      if (this.atkCD > 0) this.atkCD -= dt;
      this.dodgeCD -= dt;
      const st = this.state;
      // golpes, remates, fuego, trepar... (lo lleva la clase base)
      if (this.rag || UNCTRL[st]) {
        Z.prototype.step.call(this, dt, player, all, combat);
        if (!this.rag && !UNCTRL[this.state]) this.recover(player, st);
        this.updateGun(dt);
        return;
      }
      if (!HSTATE[st]) { this.recover(player, st); }
      this.perceive(dt, player);
      this.updateGun(dt);
      this.goal = null; this.moveSp = 0; this.faceYaw = null; this.wantCrouch = false;
      if (this.dodge) this.updateDodge(dt);
      else if (this.act && this.act.kind === 'throw') this.updateThrow(dt, player);
      else if ((Humans.mixed || Humans.foes.length) && this.state === 'fight' && this.zombieFight(dt, player, all)) { /* (pelea con un infectado o con los presos que se escapan) */ }
      else this.think(dt, player, combat);
      // atascado: un paso a un lado para rodear lo que estorba
      if (this.side) { this.side.t -= dt; if (this.side.t <= 0 || !this.goal) this.side = null; else this.goal = this.side; }
      // moverse
      let moved = 0;
      if (this.goal && this.moveSp > 0 && !this.dodge) moved = this.moveTo(this.goal, this.moveSp, dt);
      else if (this.faceYaw != null) this.facing = U.turnToward(this.facing, this.faceYaw, 7 * dt);
      if (!this.dodge) this.speedNow += (moved - this.speedNow) * Math.min(1, dt * 10);
      if (this.goal && this.moveSp > 0 && moved < this.moveSp * 0.25 && this.state !== 'climb') {
        const s0 = this.stuck;
        this.stuck += dt;
        // algo delante a la altura de un coche o un contenedor: se sube (como la protagonista)
        if (s0 < 0.7 && this.stuck >= 0.7) {
          const st0 = this.state, a = Math.atan2(this.goal.x - this.pos.x, this.goal.z - this.pos.z);
          if (this.tryLedge(this.moveYaw != null ? this.moveYaw : a) || this.tryLedge(a)) { this.climbBack = st0; this.apply(dt); return; }
        }
        if (this.stuck > 1.2) { this.clear = false; this.clearTimer = 1; this.pathTimer = 0; }
        if (s0 < 1.6 && this.stuck >= 1.6) this.sideStep();
        if (this.stuck > 4.5) { this.spot = null; this.spotT = 0; this.stuck = 0; if (this.task && this.task.kind !== 'guard') this.task.done = true; }
      } else this.stuck = Math.max(0, this.stuck - dt);
      this.separate(all, player);
      this.anim(dt);
      this.apply(dt);
    }

    // ---------- Conflicto mixto (la «huida»: los escorpiones contra los infectados) ----------
    // lo que los infectados ven como su presa cuando van a por este escorpión (como con el compañero)
    zProxy() {
      if (this._zp) return this._zp;
      const self = this;
      this._zp = {
        human: self, stance: 'stand', prone: false, stealth: 0, noise: 0, running: false, inGrass: false, aiming: false,
        beaten: null, struggle: null, lifted: null, bossKill: null, dodging: null, dodgeAfter: 0, climbLift: 0, gun: null, action: null,
        beatCD: 0, blowKb: null, hurt: 0, healing: null, grabCD: 0, fly: null, cover: null, climb: null, blow: null, hostage: null, speedNow: 0,
        vel: { x: 0, z: 0 },
        get pos() { return self.pos; }, get lv() { return self.lv || 0; }, get facing() { return self.facing; }, get y() { return self.y; },
        get elev() { return self.elev || 0; }, get dead() { return !self.alive || self.gone; }, get health() { return Math.max(0, self.hp / (self.hpMax || 1) * 100); },
        damage(d) { self.zHurt(d); }, takePunch() {}, die() {}
      };
      return this._zp;
    }
    // un infectado le pega o lo muerde (d en la escala de la vida de la protagonista: unos 11 por golpe)
    zHurt(d) {
      if (!this.alive || this.gone) return;
      this.hp -= d * 0.07;
      this.zThreatT = 3;
      if (G.Audio && Math.random() < 0.5) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: 'hurt' });
      if (this.hp <= 0) { this.act = null; this.killedBy = 'zombie'; this.die(Math.random() < 0.5 ? 1 : -1); }
      else if (Math.random() < 0.3) this.say('zhurt', null, { prio: 1 });
    }
    // ¿hay un infectado al que atender? Si lo hay (cerca, a la vista y más cerca que tú, o encima), se encarga de él:
    // con armas de fuego le dispara manteniendo la distancia; los de cuerpo a cuerpo van a por él
    zombieFight(dt, player, all) {
      this.zScanT = (this.zScanT || 0) - dt;
      if (this.zScanT <= 0 || (this.ztgt && !this.ztgt.alive)) {
        this.zScanT = 0.35;
        let best = null, bd = 22;
        if (Humans.mixed) for (const z of all) {
          if (!z.alive || z.human || z.ally || z.chain || (z.lv || 0) !== (this.lv || 0)) continue;
          const d = Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
          if (d < bd && G.World.hasLOS(this.pos.x, this.pos.z, z.pos.x, z.pos.z, this.lv)) { bd = d; best = z; }
        }
        // (los presos que se escapan: van a por ellos para que no salgan)
        for (const z of Humans.foes) {
          if (!z.alive || z.gone || z.caged || (z.lv || 0) !== (this.lv || 0)) continue;
          const d = Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
          if (d < bd && G.World.hasLOS(this.pos.x, this.pos.z, z.pos.x, z.pos.z, this.lv)) { bd = d; best = z; }
        }
        if (best && best !== this.ztgt) this.zReactT = rr(0.35, 0.8);
        this.ztgt = best;
      }
      const z = this.ztgt;
      if (!z) return false;
      const d = Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
      const dP = player.dead ? 99 : Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      // si a ti te tiene a la vista y estás más cerca que el infectado (y este no está encima), sigue contigo
      if (this.seesP && dP < d * 0.75 && d > 5 && !(this.zThreatT > 0)) return false;
      if (this.zThreatT > 0) this.zThreatT -= dt;
      const yaw = Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
      this.faceYaw = yaw; this.aimZ = z; this.aimZT = T;
      this.zReactT = (this.zReactT || 0) - dt;
      this.zFireT = (this.zFireT || 0) - dt;
      if (this.R.melee || !this.gunW) {
        this.aiming = false;
        if (d < 1.9 && this.atkCD <= 0) this.startZSwing(z);
        else { this.goal = { x: z.pos.x, z: z.pos.z, lv: z.lv || 0 }; this.moveSp = this.R.run; }
        return true;
      }
      if (this.mag <= 0) { if (!this.g.reload) this.startReload(); }
      this.aiming = !this.g.reload;
      // demasiado cerca: retrocede mientras dispara; lejos: se acerca un poco
      if (d < 3.2) { const ux = (this.pos.x - z.pos.x) / (d || 1), uz = (this.pos.z - z.pos.z) / (d || 1); this.goal = { x: this.pos.x + ux * 1.6, z: this.pos.z + uz * 1.6, lv: this.lv }; this.moveSp = 2.6; }
      else if (d > 16) { this.goal = { x: z.pos.x, z: z.pos.z, lv: z.lv || 0 }; this.moveSp = 2.4; }
      const aimed = Math.abs(U.angleDiff(yaw, this.facing)) < 0.2;
      if (aimed && this.zReactT <= 0 && this.zFireT <= 0 && !this.g.reload && this.mag > 0) this.zShoot(z, d);
      if (this.squad && this.squad.cool('zfight', 7)) this.say(z.freed ? 'pfight' : 'zfight', null, { prio: 1 });
      return true;
    }
    zShoot(z, d) {
      const R = this.R, w = this.w, g = this.g;
      this.mag--; this.kick();
      this.zFireT = (R.burst && R.burst[1] > 2 ? R.gap || 0.1 : 0) + (R.gap || 0.35) + rr(0.25, 0.55) + (w.gun === 'rifle' ? 1.0 : 0);
      const mz = this.muzzle(_v).clone();
      const tgt = new THREE.Vector3(z.pos.x, z.y + 1.3, z.pos.z);
      const sfx = { pistol: 'pistol', shotgun: 'shotgun', rifle: 'rifle', shotgun2: 'shotgun' }[w.gun] || (w.gun === 'smg' ? 'smg' : 'pistol');
      if (G.Audio) G.Audio.play(sfx, { x: this.pos.x, z: this.pos.z, lv: this.lv });
      Humans.flash(mz, w.gun === 'smg' ? 0.45 : 1);
      emitSelf(this.pos.x, this.pos.z, w.noise || 20, this.lv);
      if (Humans.onMixNoise) Humans.onMixNoise(this.pos.x, this.pos.z);
      const n = R.pellets ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const hitP = (R.acc || 0.5) * 0.85 * U.clamp(1.2 - d / 26, 0.3, 1);
        if (Math.random() < hitP && G.World.coverHit(mz.x, mz.z, mz.y, tgt.x, tgt.z, tgt.y, this.lv, false) < 0) {
          if (i === 0) Humans.tracer(mz, tgt);
          const head = Math.random() < 0.1;
          const dmg = rr(w.dmg[0], w.dmg[1]) * (head ? 2.5 : 1) * (R.pellets ? 0.45 : 0.75);
          const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z;
          const r = z.takeHit(dmg, (w.knock || 0.1) + 0.2, dx, dz, false, Math.random() < 0.5 ? 1 : -1, 'shot', head ? 'head' : 'body', { w: w.gun, dist: d, n: 1, foe: true });
          if (G.Guns && G.Guns.burst) G.Guns.burst(tgt, new THREE.Vector3(dx, 0, dz).normalize(), true, 5);
          if (r === 'kill') { z.killedBy = 'squad'; if (Math.random() < 0.3) this.say(z.freed ? 'pdown' : 'zdown', null, { prio: 1 }); }
        } else if (i === 0) this.missFx(mz, tgt, Humans.player || this.zProxy());
      }
    }
    startZSwing(z) {
      const heavy = this.w.hands === 2;
      const kinds = this.role === 'sigilo' ? ['kslash1', 'kslash2', 'kstab'] : (heavy ? ['swing2', 'overhead', 'swing2b'] : ['swing1', 'swing1b']);
      this.atkN = ((this.atkN || 0) + 1) % kinds.length;
      this.enter('melee', 0);
      this.act = { kind: kinds[this.atkN], t: 0, dur: heavy ? 0.95 : 0.65, impact: G.Combat && G.Combat.impactFor ? G.Combat.impactFor(kinds[this.atkN]) : (heavy ? 0.5 : 0.45), hit: false, ztgt: z };
      if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: heavy ? 'heavy' : 'atk', delay: 0.2 });
    }
    zMelee(dt, a) {
      const z = a.ztgt;
      a.t += dt / a.dur;
      if (z && z.alive && a.t < a.impact) {
        const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z;
        this.faceYaw = Math.atan2(dx, dz);
        if (Math.hypot(dx, dz) > 1.2) { this.goal = { x: z.pos.x, z: z.pos.z, lv: z.lv || 0 }; this.moveSp = 1.8; }
      }
      if (!a.wh && a.t >= a.impact - 0.12) { a.wh = true; if (G.Audio) G.Audio.play('whoosh', { w: this.w.hands === 2 ? 0.95 : 0.5, x: this.pos.x, z: this.pos.z, lv: this.lv }); }
      if (!a.hit && a.t >= a.impact) {
        a.hit = true;
        if (z && z.alive) {
          const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z;
          if (Math.hypot(dx, dz) < (this.w.hands === 2 ? 2.1 : 1.6)) {
            const heavy = this.w.hands === 2;
            const r = z.takeHit(rr(0.8, 1.3) * (this.R.dmg / 11), heavy ? 0.7 : 0.4, dx, dz, false, 1, this.w.cat === 'sblade' ? 'stab' : (heavy ? 'heavy' : 'side'), 'body', { foe: true });
            if (r === 'kill') z.killedBy = 'squad';
            if (G.Audio) G.Audio.play(heavy ? 'hitBlade' : 'hitBlunt', { x: z.pos.x, z: z.pos.z, lv: z.lv, heavy });
          }
        }
      }
      if (a.t >= 1) { this.act = null; this.atkCD = rr(0.4, 0.9); this.enter('fight', 0); }
    }

    // vuelve a su papel después de un golpe, de trepar, de que lo suelten...
    recover(player, prev) {
      if (!this.alive) return;
      if (prev === 'climb' && this.climbBack && HSTATE[this.climbBack]) { this.state = this.climbBack; this.climbBack = null; return; }
      if (this.begPending && this.squad && !this.begUsed) { this.begPending = false; this.startBeg(player); return; }
      this.begPending = false;
      const sq = this.squad;
      if (this.spared || (sq && sq.mode === 'retreat')) { this.enter('flee', 0); return; }
      if (!sq || !sq.active) { this.enter('idle', 1); return; }
      if (this.engaged) this.enter('fight', 0);
      else { this.enter('fight', 0); sq.know(player, false, this); }
    }

    // ---------- Sentidos ----------
    perceive(dt, player) {
      this.lostT += dt;
      this.seeT = (this.seeT || 0) - dt;
      if (this.seeT > 0) { if (this.seesP) this.lostT = 0; return; }
      this.seeT = 0.1;
      const was = this.seesP;
      this.seesP = false;
      if (player.dead || this.state === 'beg' || this.state === 'hostage' || this.state === 'flee') return;
      const W = G.World, px = player.pos.x, pz = player.pos.z;
      const dx = px - this.pos.x, dz = pz - this.pos.z, d = Math.hypot(dx, dz);
      // en combate (ya te vieron): te siguen sin dudar. Buscándote (saben más o menos por dónde andas, pero aún no
      // te vieron): miran más, pero reconocerte les lleva su momento como a cualquiera (antes te veían al instante)
      const eng = this.engaged, combat = eng && this.squad.mode === 'combat';
      // agachada o tumbada te ven de más cerca (si no te buscan ya)
      let k = 1;
      if (!combat || this.lostT > 3) k = player.stance === 'prone' ? 0.24 : (player.stance === 'crouch' ? 0.45 : 1);
      if (player.cover && player.cover.low && player.stance !== 'stand') k *= 0.6;
      const range = this.R.sight * k * (0.88 + this.pers.alert * 0.24) * (G.Sky ? G.Sky.sight(true) : 1);     // (de noche ven mucho menos)
      if (d > range || (player.lv || 0) !== (this.lv || 0)) { this.notice = Math.max(0, this.notice - dt * 0.3); return; }
      const diff = Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing));
      const fov = combat ? 1.75 : (eng ? Math.min(1.5, this.R.fov * 1.2) : this.R.fov);
      if (diff > fov && d > 1.6) { this.notice = Math.max(0, this.notice - 0.03); return; }
      if (!W.hasLOS(this.pos.x, this.pos.z, px, pz, this.lv)) { this.notice = Math.max(0, this.notice - 0.03); return; }
      if (smokeBlocks(this.pos.x, this.pos.z, px, pz)) return;
      // cobertura: si lo que tienes delante (una caja, un coche, un árbol, un arbusto si estás agachada) te tapa
      // la cabeza, no te ve
      {
        const hy = player.y + (player.elev || 0) + (player.stance === 'prone' ? 0.32 : (player.stance === 'crouch' ? 0.95 : 1.58));
        if (W.coverHit(this.pos.x, this.pos.z, this.y + 1.6, px, pz, hy, this.lv, true) >= 0) { this.notice = Math.max(0, this.notice - 0.03); return; }
      }
      if (!this.lv && d > 3) {
        const ph = player.y + (player.stance === 'prone' ? 0.3 : (player.stance === 'crouch' ? 0.85 : 1.45));
        if (W.terrainBlocks(this.pos.x, this.pos.z, this.y + 1.6, px, pz, ph)) return;
      }
      // reconocerte lleva un momento (ya en combate, nada)
      if (!combat && !was) {
        const far = d / range, still = (player.speedNow || 0) < 0.4 ? (far > 0.5 ? 0.45 : 0.8) : 1;
        // (buscándote, algo más rápido; los exploradores y carroñeros de las oleadas, como si no te buscaran)
        const kk = eng && !this.R.grunt ? 1.4 : 1;
        this.notice += 0.1 * Math.pow(1.45 - far, 2) * (0.8 + this.pers.alert * 0.4) * still / 0.6 * kk * (player.stealthMul ? player.stealthMul() : 1);
        if (this.notice < 1) { this.susp = { x: px, z: pz }; return; }
      }
      this.notice = 1;
      this.seesP = true; this.lostT = 0;
      if (!was) this.reactT = rr(this.R.react[0], this.R.react[1]) * (combat ? 0.7 : 1);
      if (this.squad) this.squad.know(player, true, this);
    }

    // ---------- Arma ----------
    updateGun(dt) {
      const g = this.g;
      g.recoil = Math.max(0, g.recoil - dt * 8);
      if (g.cycle >= 0) { g.cycle += dt / (this.gkind === 'rifle' ? 0.9 : (this.gkind === 'shotgun' ? 0.55 : (this.gkind === 'bow' ? 0.7 : 0.3))); if (g.cycle >= 1) g.cycle = -1; }
      const want = this.gunW && this.alive && (this.state === 'fight' || this.state === 'check' || (this.engaged && HSTATE[this.state] && this.state !== 'beg' && this.state !== 'hostage' && this.state !== 'flee' && this.state !== 'bandage')) ? (this.aiming ? 1 : 0) : 0;      // (sin apuntar, el arma baja como la lleva Vera; a medio levantar quedaba torcida)
      g.aim += (want - g.aim) * Math.min(1, dt * (want > g.aim ? 7 : 5));
      // recarga (con su animación)
      if (g.reload) {
        g.reload.u += dt / g.reload.dur;
        if (g.reload.u >= 1) {
          if (g.reload.per) { this.mag += this.takeAmmo ? this.takeAmmo(1) : 1; if (G.Audio) G.Audio.play('shellIn', { x: this.pos.x, z: this.pos.z, lv: this.lv, vol: 0.6 }); if (this.mag >= this.w.mag) g.reload = null; else g.reload.u = 0; }
          else { this.mag += this.takeAmmo ? this.takeAmmo(this.w.mag - this.mag) : this.w.mag - this.mag; g.reload = null; if (G.Audio) G.Audio.play('slide', { x: this.pos.x, z: this.pos.z, lv: this.lv, vol: 0.6 }); }
        }
      }
      g.rw += ((g.reload ? 1 : 0) - g.rw) * Math.min(1, dt * 7);
      g.ru = g.reload ? g.reload.u : 0;
      if (this.gkind === 'bow') {
        if (this.drawing && g.aim > 0.7 && g.cycle < 0) g.draw = Math.min(1, g.draw + dt / 0.85);
        else g.draw = Math.max(0, g.draw - dt * 4);
        g.arrow = g.cycle < 0 || g.cycle > 0.8;
      }
    }
    startReload() {
      if (!this.gunW || this.g.reload || this.gkind === 'bow' || this.mag >= this.w.mag) return;
      this.g.reload = { u: 0, dur: this.w.perShell ? Math.max(0.5, this.w.reload) : this.w.reload * 1.15, per: !!this.w.perShell };
      if (G.Audio) G.Audio.play(this.w.perShell ? 'slide' : 'magOut', { x: this.pos.x, z: this.pos.z, lv: this.lv, vol: 0.6 });
      if (Math.random() < 0.5 && this.engaged) this.say('reload', null, { prio: 2 });
      // un compañero cerca con afecto lo cubre
      const sq = this.squad;
      if (sq) for (const o of sq.members) if (o !== this && o.alive && o.gunW && sq.aff(o, this) > 0.6 && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < 10 && Math.random() < 0.4) { o.say('cover', null, { prio: 1, after: 0.6 }); break; }
    }
    // el golpe cuerpo a cuerpo va de verdad al cuerpo de su blanco (ver el contacto en G.Models)
    contactPose(a) {
      const P = Humans.player, tg = a.ztgt || a.tgt || P;
      if (!tg || !tg.model || tg.dead) return null;
      const c = this._cp || (this._cp = {});
      const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
      c.m = tg.model; c.len = this.w.len || 0.3; c.impact = a.impact || 0.45;
      c.blade = !!(this.w.knife || this.w.cat === 'sblade' || this.w.cat === 'lblade' || this.w.cat === 'axe');
      c.hitOK = d < (G.Combat && G.Combat.reachOf ? G.Combat.reachOf(this.w) + 0.1 : 1.5) && !(tg === P && P.dodging);
      return c;
    }
    // a qué punto apunta el cañón: el infectado al que dispara (si hace poco que lo eligió) o la protagonista
    aimPoint() {
      const o = this._aimP || (this._aimP = { x: 0, y: 0, z: 0 });
      const z = this.aimZ && this.aimZ.alive && T - (this.aimZT || -99) < 1.5 ? this.aimZ : null;
      const P = Humans.player;
      if (z) { o.x = z.pos.x; o.y = z.y + 1.25; o.z = z.pos.z; return o; }
      if (!P) return null;
      o.x = P.pos.x; o.y = P.y + (P.elev || 0) + (P.stance === 'prone' ? 0.3 : (P.stance === 'crouch' ? 0.85 : 1.25)); o.z = P.pos.z;
      return o;
    }
    muzzle(out) {
      const m = this.model;
      if (!m.gun) return out.set(this.pos.x, this.y + 1.4, this.pos.z);
      m.root.updateMatrixWorld(true);
      return m.gun.muzzle.getWorldPosition(out);
    }

    // ---------- Decisiones ----------
    think(dt, player, combat) {
      const sq = this.squad;
      switch (this.state) {
        case 'beg': this.updateBeg(dt, player); return;
        case 'hostage': this.updateHostage(dt, player); return;
        case 'flee': this.updateFlee(dt, player); return;
        case 'bandage': this.updateBandage(dt, player); return;
        case 'melee': this.updateMelee(dt, player); return;
        case 'stab': this.updateStab(dt, player, combat); return;
      }
      if (!sq || !sq.active) { this.idleUpdate(dt, player); return; }
      if (sq.mode === 'retreat') { this.enter('flee', 0); return; }
      // vendarse: herido, a cubierto y sin verte un rato
      if (!this.healed && this.hp < this.hpMax * 0.5 && this.lostT > 3 && this.state !== 'loot' && (!sq.known || !G.World.hasLOS(this.pos.x, this.pos.z, sq.known.x, sq.known.z, this.lv))) {
        this.enter('bandage', 0); this.act = { kind: 'bandage', t: 0, dur: 3.6 }; this.healed = true; this.say('bandage', null, { prio: 2 }); return;
      }
      if (this.engaged || this.seesP) { if (this.state !== 'fight') this.enter('fight', 0); this.fight(dt, player, combat); return; }
      if (this.state === 'fight') this.enter('patrol', 0);
      if (this.state === 'check') { this.updateCheck(dt, player); return; }
      // algo le pareció verte: se gira y se acerca a mirar
      if (this.notice > 0.35 && this.susp) { this.faceYaw = Math.atan2(this.susp.x - this.pos.x, this.susp.z - this.pos.z); this.aiming = false; this.goal = this.susp; this.moveSp = 0.7; return; }
      this.taskUpdate(dt, player);
    }

    // antes de que empiece la misión: quietos donde aparecieron, charlando
    idleUpdate(dt) {
      this.aiming = false;
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = rr(2, 5); this.idleYaw = this.facing + rr(-1.2, 1.2); }
      if (this.idleYaw != null) this.faceYaw = this.idleYaw;
    }

    // ---- la ronda: va a donde le mandan y hace lo suyo ----
    taskUpdate(dt, player) {
      const t = this.task;
      this.aiming = false;
      if (!t || t.done) { this.scan(dt); return; }
      const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
      if (t.kind === 'follow' && t.who && t.who.alive) { t.x = t.who.pos.x + (t.ox || 0); t.z = t.who.pos.z + (t.oz || 0); t.lv = t.who.lv; }
      const near = t.kind === 'follow' ? 2.2 : 0.7;
      if (d > near || (t.lv || 0) !== (this.lv || 0)) {
        this.goal = t; this.moveSp = d > 14 ? 3.1 : (this.R.stealth ? 1.6 : 1.75);
        if (this.R.stealth) this.wantCrouch = true;
        this.lookAround(dt, 0.6);
        return;
      }
      if (this.state === 'patrol' && t.kind === 'loot') { this.enter('loot', 0); this.act = { kind: 'search', t: 0, dur: rr(3, 4.5) }; return; }
      if (t.kind === 'guard') { if (this.state !== 'guard') this.enter('guard', 0); this.wantCrouch = this.role === 'tirador' || this.role === 'arquero'; this.scan(dt, t.face); return; }
      if (this.state === 'loot') { this.updateLoot(dt); return; }
      // llegó: mira alrededor un rato y da el sitio por despejado
      t.at = (t.at || 0) + dt;
      this.scan(dt);
      if (t.at > (t.kind === 'scout' ? 2.5 : 3.5) && !t.reported) {
        t.reported = true; t.done = t.kind !== 'follow';
        if (this.squad && Math.random() < 0.35) this.say('clear', null, { prio: 1 });
      }
    }
    // mira de un lado a otro (sin moverse)
    scan(dt, base) {
      this.scanT = (this.scanT || 0) - dt;
      if (this.scanT <= 0) { this.scanT = rr(1.5, 3.5); this.scanYaw = (base != null ? base : this.facing) + rr(-1.3, 1.3); }
      this.faceYaw = this.scanYaw;
      this.lookAround(dt, 1);
    }
    lookAround(dt, w) {
      this.lkT = (this.lkT || 0) - dt;
      if (this.lkT <= 0) { this.lkT = rr(1.2, 3); this.lkY = rr(-0.9, 0.9); }
      const L0 = this.lookAt || (this.lookAt = { yaw: 0, pitch: 0, w: 0 });
      L0.yaw += (this.lkY - L0.yaw) * Math.min(1, dt * 3); L0.pitch = 0.02; L0.w = w;
    }
    updateLoot(dt) {
      const a = this.act;
      if (!a || a.kind !== 'search') { this.enter('patrol', 0); if (this.task) this.task.done = true; return; }
      a.t += dt / a.dur;
      if (a.t >= 1) {
        this.act = null;
        // se lleva lo más cercano del suelo (una cosa; como mucho tres en total, y las suelta al morir)
        const P = G.Pickups;
        let got = null;
        if (P && P.list && this.bag.length < 3) {
          let bd = 4.5;
          for (const it of P.list) {
            if (it.armed || (it.lv || 0) !== (this.lv || 0)) continue;
            const d = Math.hypot(it.x - this.pos.x, it.z - this.pos.z);
            if (d < bd && G.World.hasLOS(this.pos.x, this.pos.z, it.x, it.z, this.lv)) { bd = d; got = it; }
          }
          if (got && P.take) { const t = P.take(got); if (t) this.bag.push(t); else got = null; }
        }
        this.say(got ? 'loot' : 'lootNone', null, { prio: 1 });
        if (this.task) this.task.done = true;
        this.enter('patrol', 0);
      }
    }
    // fue a mirar un ruido
    updateCheck(dt) {
      const c = this.check;
      if (!c) { this.enter('patrol', 0); return; }
      this.aiming = false;
      const d = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
      if (d > 1.5 && !c.at) { this.goal = c; this.moveSp = 1.9; this.lookAround(dt, 0.5); c.tt = (c.tt || 0) + dt; if (c.tt > 14) c.at = 0.01; return; }
      c.at = (c.at || 0) + dt;
      this.scan(dt);
      if (c.at > 3) { this.check = null; if (Math.random() < 0.5) this.say('checkNone', null, { prio: 1 }); this.enter('patrol', 0); }
    }

    // ---------- Pelea ----------
    fight(dt, player, combat) {
      const sq = this.squad, K = sq.known;
      const px = player.pos.x, pz = player.pos.z;
      const tx = this.seesP ? px : (K ? K.x : px), tz = this.seesP ? pz : (K ? K.z : pz);
      const dist = Math.hypot(tx - this.pos.x, tz - this.pos.z);
      const toYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
      const L0 = this.lookAt || (this.lookAt = { yaw: 0, pitch: 0, w: 0 });
      L0.yaw += (U.angleDiff(toYaw, this.facing) - L0.yaw) * Math.min(1, dt * 6); L0.pitch = 0; L0.w = 1;
      // esquiva si lo tienes en la mira de cerca
      if (this.aimedAt && this.dodgeCD <= 0 && dist < 13 && (this.role === 'pistolero' || this.role === 'escopetero' || this.role === 'bruto' || this.role === 'sigilo' || this.role === 'saqueador' || this.role === 'explorador' || this.role === 'carronero')) {
        if (Math.random() < 0.5) { this.startDodge(toYaw); return; }
        this.dodgeCD = rr(1, 2);
      }
      // con un rehén delante: si no le dejan disparar, se busca un ángulo por un lado
      const hos = player.hostage && player.hostage.h && player.hostage.h.alive ? player.hostage.h : null;
      const hold = hos && this.holdFireFor(hos);
      if (this.R.melee) {
        if (this.R.stealth) this.fightStealth(dt, player, dist, toYaw, combat);
        else if (this.R.looter) this.fightLooter(dt, player, dist, toYaw);
        else this.fightMelee(dt, player, dist, toYaw);
        return;
      }
      this.fightRanged(dt, player, dist, toYaw, tx, tz, hold, hos);
    }
    holdFireFor(hos) {
      const sq = this.squad;
      if (hos === this) return true;
      // no le dispara a un compañero al que aprecia; si el líder ordenó no disparar, tampoco (salvo que le dé igual)
      if (sq.aff(this, hos) > 0.45) return true;
      if (sq.holdFire && sq.aff(this, sq.leader) > 0.3) return true;
      return false;
    }

    // armas de fuego: asomarse a disparar y volver a cubrirse; cada papel a su distancia
    fightRanged(dt, player, dist, toYaw, tx, tz, hold, hos) {
      const R = this.R, sq = this.squad, g = this.g;
      this.tacT -= dt; this.spotT -= dt;
      const enr = this.enraged > 0;
      const prefer = enr ? Math.max(R.range[0] + 1, R.prefer * 0.5) : (R.prefer * (sq.pushT > 0 ? 0.55 : 1));
      // turno: asomarse (con línea de tiro) o cubrirse; cubierto recarga
      if (this.tacT <= 0) {
        if (this.tac === 'peek') { this.tac = 'cover'; this.tacT = rr(1.3, 2.6) * (enr ? 0.5 : 1); }
        else { this.tac = 'peek'; this.tacT = rr(2.6, 4.8) * (this.role === 'tirador' ? 2 : 1); }
        this.spot = null;
      }
      if (this.suppressed > 0 && this.tac === 'peek' && this.tacT > 0.8 && !enr) { this.tac = 'cover'; this.tacT = rr(1.2, 2); this.spot = null; if (sq.cool('suppressed', 7)) this.say('suppressed', null, { prio: 2 }); }
      if (this.gkind !== 'bow' && this.mag <= 0 && !g.reload) { this.startReload(); if (this.tac === 'peek') { this.tac = 'cover'; this.tacT = Math.max(this.tacT, 1.2); this.spot = null; } }
      // sitio
      const guard = this.task && this.task.kind === 'guard' && this.role === 'tirador' && !this.task.done;
      if (!this.spot || this.spotT <= 0) {
        this.spotT = rr(2.5, 4.5);
        if (guard && dist > 7) this.spot = { x: this.task.x, z: this.task.z, lv: this.task.lv || 0 };
        else this.spot = this.pickSpot(this.tac === 'peek' ? 'peek' : 'cover', tx, tz, prefer, hold && hos ? hos : null);
      }
      const sp = this.spot;
      const ds = sp ? Math.hypot(sp.x - this.pos.x, sp.z - this.pos.z) : 0;
      if (sp && ds > 0.45) { this.goal = sp; this.moveSp = ds > 6 ? R.run : (this.aiming ? 1.8 : 3.0); }
      this.faceYaw = toYaw;
      this.wantCrouch = (this.role === 'tirador' || this.role === 'arquero') && ds < 0.6 || (this.tac === 'cover' && ds < 0.8);
      // disparar
      const canSee = this.seesP && dist >= R.range[0] * 0.6 && dist <= R.range[1];
      this.aiming = canSee && this.tac === 'peek' && !g.reload;
      this.drawing = this.aiming && this.gkind === 'bow';
      if (!canSee) { this.burst = 0; return; }
      if (this.reactT > 0) { this.reactT -= dt; return; }
      if (g.reload || this.tac !== 'peek' || g.aim < 0.8 || this.speedNow > 2.2) return;
      if (hold) { this.holdT = (this.holdT || 0) + dt; if (this.holdT > 3 && sq.cool('demand', 6)) this.say('hostageDemand', { x: hos.name }, { prio: 2 }); return; }
      this.fireT -= dt;
      if (this.fireT > 0) return;
      if (!this.clearShot(player)) { this.fireT = 0.6; if (sq.cool('lineFire', 12)) this.say('lineFire', null, { prio: 1 }); return; }
      if (this.gkind === 'bow') {
        if (g.draw < 0.95) return;
        this.shootArrow(player);
        this.fireT = rr(R.pause[0], R.pause[1]);
        return;
      }
      if (this.burst <= 0) this.burst = Math.round(rr(R.burst[0], R.burst[1] + 0.49));
      this.shoot(player, dist);
      this.burst--;
      this.fireT = this.burst > 0 ? R.gap : rr(R.pause[0], R.pause[1]) * (enr ? 0.7 : 1);
    }
    // ¿se le cruza un compañero en la línea de tiro?
    clearShot(player) {
      const sq = this.squad, x0 = this.pos.x, z0 = this.pos.z, x1 = player.pos.x, z1 = player.pos.z;
      const vx = x1 - x0, vz = z1 - z0, l2 = vx * vx + vz * vz || 1;
      for (const o of sq.members) {
        if (o === this || !o.alive || o.gone) continue;
        const k = ((o.pos.x - x0) * vx + (o.pos.z - z0) * vz) / l2;
        if (k < 0.05 || k > 0.95) continue;
        if (Math.hypot(x0 + vx * k - o.pos.x, z0 + vz * k - o.pos.z) < 0.6) return false;
      }
      return true;
    }
    // Busca dónde ponerse: 'peek' con línea de tiro a la distancia que le gusta; 'cover' tapado pero cerca
    pickSpot(kind, tx, tz, prefer, shieldOf) {
      const W = G.World, lv = this.lv || 0, sq = this.squad;
      let best = null, bs = -1e9;
      const flank = this.flankSide || 0;
      const center = sq.center();
      const baseA = Math.atan2(center.x - tx, center.z - tz);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + Math.random() * 0.3;
        for (const r of kind === 'cover' ? [1.5, 3, 5] : [2.5, 5, 8]) {
          const x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
          if (x < sq.zone.x0 + 1 || x > sq.zone.x1 - 1 || z < sq.zone.z0 + 1 || z > sq.zone.z1 - 1) continue;
          if (W.circleBlocked(x, z, 0.35, lv)) continue;
          const d = Math.hypot(x - tx, z - tz);
          const los = W.hasLOS(x, z, tx, tz, lv);
          let s = -r * 0.35;
          if (kind === 'peek') { if (!los) continue; s -= Math.abs(d - prefer) * 0.5; }
          else { s += los ? -6 : 4; s -= Math.abs(d - prefer) * 0.25; if (d < 3) s -= 5; }
          // flanqueo: prefiere el lado que le mandaron
          if (flank) { const ang = Math.atan2(x - tx, z - tz); s -= Math.abs(U.angleDiff(ang, baseA + flank * 1.25)) * 1.6; }
          // con un rehén: busca verte de lado o por detrás (donde el rehén no tapa)
          if (shieldOf && Humans.player) { const P = Humans.player, ang = Math.atan2(x - P.pos.x, z - P.pos.z); s += Math.abs(U.angleDiff(ang, P.facing)) * 2.2; }
          for (const o of sq.members) if (o !== this && o.alive && Math.hypot(o.pos.x - x, o.pos.z - z) < 2) s -= 3;
          if (!W.hasClearLine(this.pos.x, this.pos.z, x, z, lv)) s -= 2;
          if (inSmoke(x, z)) s += kind === 'cover' ? 1 : -1;
          if (s > bs) { bs = s; best = { x, z, lv }; }
        }
      }
      return best;
    }

    // el culatazo de cada disparo en la pose: como el de la protagonista (el subfusil apenas se levanta y no se
    // bombea; la pistola, algo; escopeta y rifle, el golpe entero y el cerrojo o la corredera después)
    kick() {
      const w = this.w, g = this.g;
      g.recoil = w.gun === 'smg' ? Math.max(g.recoil, 0.2) : (w.gun === 'pistol' ? 0.75 : (w.gun === 'revolver' ? 0.9 : (w.gun === 'rifle' ? 0.9 : 0.8)));
      if ((this.gkind === 'shotgun' || this.gkind === 'rifle') && !w.noPump) g.cycle = 0;
    }
    // dispara una bala (o los perdigones)
    shoot(player, dist) {
      const R = this.R, g = this.g, W = G.World;
      if (this.mag <= 0) { if (G.Audio) G.Audio.play('dry', { x: this.pos.x, z: this.pos.z, lv: this.lv }); this.startReload(); return; }
      this.mag--; this.kick();
      const mz = this.muzzle(_v).clone();
      const py = player.y + (player.elev || 0) + (player.stance === 'prone' ? 0.3 : (player.stance === 'crouch' ? 0.85 : 1.25));
      const tgt = new THREE.Vector3(player.pos.x, py, player.pos.z);
      // escudo humano: disparando de frente a quien tiene un rehén, la bala puede darle al rehén
      const hs = player.hostage && player.hostage.h && player.hostage.h.alive ? player.hostage.h : null;
      let shield = false;
      if (hs) {
        const ang = Math.atan2(this.pos.x - player.pos.x, this.pos.z - player.pos.z);
        if (Math.abs(U.angleDiff(ang, player.facing)) < 0.8) shield = true;
      }
      // ¿lo que te cubre para la bala? Primero al pecho; si eso está tapado, a la cabeza (si asoma), que es más difícil
      const W2 = G.World;
      const oy = Math.max(mz.y, this.y + (this.crouchAmt > 0.5 ? 0.95 : 1.35));        // (la altura del arma al apuntar)
      let cov = W2.coverHit(mz.x, mz.z, oy, tgt.x, tgt.z, tgt.y, this.lv, false), hard = 1;
      if (cov >= 0) {
        const hy = player.y + (player.elev || 0) + (player.stance === 'prone' ? 0.32 : (player.stance === 'crouch' ? 0.98 : 1.55));
        if (W2.coverHit(mz.x, mz.z, oy, tgt.x, tgt.z, hy, this.lv, false) < 0) { tgt.y = hy; cov = -1; hard = 0.35; }
      }
      const n = R.pellets || 1;
      let dmg = 0, hostHit = 0;
      for (let i = 0; i < n; i++) {
        const p = this.hitChance(player, dist) * (R.pellets ? U.clamp(1.25 - dist / 12, 0.15, 1) : 1) * hard;
        if (cov >= 0) {
          // la bala da en la cobertura (no en ti)
          if (i < 3) {
            const hit = mz.clone().lerp(tgt, cov);
            Humans.tracer(mz, hit);
            if (G.Guns && G.Guns.burst) G.Guns.burst(hit, tgt.clone().sub(mz).normalize(), false, 3);
            if (G.Audio && i === 0) G.Audio.play('hitWall', { x: hit.x, z: hit.z, lv: this.lv, delay: 0.03 });
          }
        } else if (Math.random() < p) {
          if (shield && Math.random() < 0.7) { hostHit++; Humans.tracer(mz, new THREE.Vector3(hs.pos.x, hs.y + 1.3, hs.pos.z)); }
          else { dmg += R.dmg * (R.pellets ? 1 : rr(0.85, 1.15)); if (i < 3) Humans.tracer(mz, tgt); }
        } else if (i < 3) this.missFx(mz, tgt, player);
      }
      // sonido, fogonazo y ruido
      const sfx = { pistol: 'pistol', shotgun: 'shotgun', rifle: 'rifle', shotgun2: 'shotgun' }[this.w.gun] || (this.w.gun === 'smg' ? 'smg' : 'pistol');
      if (G.Audio) G.Audio.play(sfx, { x: this.pos.x, z: this.pos.z, lv: this.lv });
      Humans.flash(mz, this.w.gun === 'smg' ? 0.45 : (this.gkind === 'shotgun' ? 1.3 : 1));
      emitSelf(this.pos.x, this.pos.z, this.w.noise || 20, this.lv);
      if (hostHit && hs) {
        const r = hs.takeHit(R.dmg * 0.5 * hostHit, 0.2, hs.pos.x - this.pos.x, hs.pos.z - this.pos.z, false, 1, 'shot', 'body', { w: this.w.gun });
        if (r === 'kill') { hs.killedBy = 'friendly'; this.squad.onFriendlyKill(this, hs); }
      }
      if (dmg > 0) Humans.hurtPlayer(player, this, dmg, R.pellets ? dmg > 18 : R.dmg >= 25);
      this.lastShotT = T;
    }
    // probabilidad de acertar
    hitChance(player, dist) {
      const R = this.R;
      // (bastante menos certeros que antes: moverse, sobre todo de lado, y correr hace fallar mucho)
      let p = R.acc * ACC_MUL * (G.Sky ? G.Sky.acc() : 1) * U.clamp(1.15 - dist / R.range[1], 0.22, 1);
      const ps = player.speedNow || 0;
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, dl = Math.hypot(dx, dz) || 1;
      const vx = player.vel ? player.vel.x : 0, vz = player.vel ? player.vel.z : 0;
      const lat = Math.abs(vx * dz - vz * dx) / dl;                 // lo que te mueves de lado (respecto a él)
      p *= 1 - Math.min(0.35, ps * 0.06);
      p *= 1 - Math.min(0.6, lat * 0.16);
      if (player.sprinting || ps > 4.2) p *= 0.75;
      if (player.stance === 'crouch') p *= 0.78;
      if (player.stance === 'prone') p *= 0.55;
      if (player.cover && player.cover.low && player.stance === 'crouch') p *= 0.45;
      if (player.dodging) p *= 0.2;
      if (this.suppressed > 0) p *= 0.55;
      if (this.enraged > 0) p *= 0.85;
      if (T - (this.lastShotT == null ? -99 : this.lastShotT) > 4) p *= 0.7;      // el primero tras una pausa, peor
      if (inSmoke(player.pos.x, player.pos.z) || smokeBlocks(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) p *= 0.3;
      if (this.squad) p *= this.squad.diff;
      return U.clamp(p, 0.02, 0.62);
    }
    // bala que falla: pasa a tu lado y da en la pared o en el suelo cerca (con su silbido)
    missFx(mz, tgt, player) {
      const W = G.World;
      const dir = tgt.clone().sub(mz).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(rr(-1.1, 1.1));
      const end = tgt.clone().add(side).add(new THREE.Vector3(0, rr(-0.9, 0.5), 0)).addScaledVector(dir, rr(1.5, 6));
      const f = W.lineHit(mz.x, mz.z, end.x, end.z, W.blocksSightEdge, this.lv);
      if (f >= 0) end.lerpVectors(mz, end, f);
      const gy = W.groundY(end.x, end.z, this.lv);
      if (end.y < gy) end.y = gy + 0.02;
      Humans.tracer(mz, end);
      if (G.Guns && G.Guns.burst) G.Guns.burst(end, dir, false, 3);
      if (G.Audio) {
        G.Audio.play('hitWall', { x: end.x, z: end.z, lv: this.lv, delay: 0.03 });
        if (Math.hypot(end.x - player.pos.x, end.z - player.pos.z) < 5) G.Audio.play('whiz', { vol: 0.8 });
      }
    }
    // la arquera: flecha de verdad (se ve venir y cae con la distancia)
    shootArrow(player) {
      const g = this.g;
      const mz = this.muzzle(_v).clone();
      const py = player.y + (player.elev || 0) + (player.stance === 'prone' ? 0.3 : (player.stance === 'crouch' ? 0.85 : 1.3));
      // apunta un poco por delante de donde vas (y corrige la caída)
      const d = Math.hypot(player.pos.x - mz.x, player.pos.z - mz.z);
      const sp = 34, Tf = d / sp;
      const lead = this.hitChance(player, d) > Math.random() ? 0.85 : rr(-0.6, 1.8);
      const tx = player.pos.x + (player.vel ? player.vel.x : 0) * Tf * lead + rr(-0.25, 0.25), tz = player.pos.z + (player.vel ? player.vel.z : 0) * Tf * lead + rr(-0.25, 0.25);
      const v = new THREE.Vector3(tx - mz.x, py - mz.y, tz - mz.z);
      const L2 = Math.hypot(v.x, v.z) || 1;
      v.multiplyScalar(sp / Math.hypot(v.x, v.y, v.z));
      v.y += 0.5 * 9.8 * (L2 / sp);
      Humans.arrow(this, mz, v);
      g.draw = 0; g.cycle = 0; g.recoil = 0.5; this.drawing = false;
      if (G.Audio) G.Audio.play('bowRelease', { x: this.pos.x, z: this.pos.z, lv: this.lv, k: 1 });
      emitSelf(this.pos.x, this.pos.z, 3, this.lv);
    }

    // el bruto: corre a por ti y descarga el hacha
    fightMelee(dt, player, dist, toYaw) {
      const sq = this.squad;
      this.aiming = dist < 4;
      const sameLv = (player.lv || 0) === (this.lv || 0);
      if (dist < 2.0 && this.seesP && sameLv && this.atkCD <= 0 && !player.dead) { this.startSwing(player); return; }
      // zigzag si lo apuntas
      let gx = player.pos.x, gz = player.pos.z;
      if (this.aimedAt && dist > 4) { const s = Math.sin(this.time * 3) * 2.2; gx += Math.cos(toYaw) * s; gz -= Math.sin(toYaw) * s; }
      const K = sq.known;
      this.goal = this.seesP ? { x: gx, z: gz, lv: player.lv || 0 } : (K ? { x: K.x, z: K.z, lv: K.lv } : null);
      this.moveSp = dist < 2.6 ? 2.2 : this.R.run * (this.enraged > 0 ? 1.08 : 1);
      // a la distancia de su arma: no se le echa encima (con un arma larga, demasiado cerca no le da con ella)
      const ideal = G.Combat && G.Combat.idealDist ? G.Combat.idealDist(this.w) : 1.0;
      if (this.seesP && dist < ideal + 0.2) {
        if (dist < ideal - 0.15) { this.goal = { x: this.pos.x - (player.pos.x - this.pos.x) / (dist || 1) * 0.6, z: this.pos.z - (player.pos.z - this.pos.z) / (dist || 1) * 0.6, lv: this.lv || 0 }; this.moveSp = 1.5; }
        else { this.goal = null; this.moveSp = 0; }
      }
      if (dist < 4) this.faceYaw = toYaw;
      if (dist < 9 && this.seesP && this.squad.cool('melee' + this.idx, 9)) this.say(this.enraged > 0 ? 'enraged' : 'melee', null, { prio: 1 });
    }
    startSwing(player) {
      const heavy = this.w.hands === 2;
      const kinds = this.role === 'sigilo' ? ['kslash1', 'kslash2', 'kstab'] : (heavy ? ['swing2', 'overhead', 'swing2b'] : ['swing1', 'swing1b']);
      this.atkN = ((this.atkN || 0) + 1) % kinds.length;
      this.enter('melee', 0);
      this.act = { kind: kinds[this.atkN], t: 0, dur: heavy ? 1.0 : 0.7, impact: G.Combat && G.Combat.impactFor ? G.Combat.impactFor(kinds[this.atkN]) : (heavy ? 0.5 : 0.45), hit: false };
      if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: heavy ? 'heavy' : 'atk', delay: 0.25 });
    }
    updateMelee(dt, player) {
      const a = this.act;
      if (!a) { this.enter('fight', 0); return; }
      if (a.ztgt) { this.zMelee(dt, a); return; }
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
      a.t += dt / a.dur;
      // se acerca hasta donde el arma llega al cuerpo (como ella)
      const ideal = G.Combat && G.Combat.idealDist ? G.Combat.idealDist(this.w) : 1.1;
      if (a.t < a.impact) {
        this.faceYaw = Math.atan2(dx, dz);
        if (dist > ideal + 0.05) { this.goal = { x: player.pos.x, z: player.pos.z, lv: player.lv || 0 }; this.moveSp = 1.8 + Math.min(1.6, (dist - ideal) * 2.2); }
        else if (dist < ideal - 0.2) { this.goal = { x: this.pos.x - dx / (dist || 1) * 0.5, z: this.pos.z - dz / (dist || 1) * 0.5, lv: this.lv || 0 }; this.moveSp = 1.6; }
        else { this.goal = null; this.moveSp = 0; }
      }
      if (!a.wh && a.t >= a.impact - 0.12) { a.wh = true; if (G.Audio) G.Audio.play('whoosh', { w: this.w.hands === 2 ? 0.95 : 0.5, x: this.pos.x, z: this.pos.z, lv: this.lv }); }
      if (!a.hit && a.t >= a.impact) {
        a.hit = true;
        const dodged = (player.dodging && player.dodging.t < 0.8) || player.dodgeAfter > 0;
        if (dodged && dist < 3) {
          // lo esquivaste: se pasa de largo y queda vendido (se le puede rematar)
          this.act = null; this.atkCD = 1.4;
          if (G.Mode && G.Mode.stats) G.Mode.stats.stun++;
          this.stun(1.3, Math.sin(this.facing), Math.cos(this.facing), 1.4);
          return;
        }
        // (el alcance real del arma: si no llega al cuerpo, no hay daño)
        const reach = G.Combat && G.Combat.reachOf ? G.Combat.reachOf(this.w) + 0.1 : (this.w.hands === 2 ? 2.0 : 1.5);
        if (dist < reach && !player.dead && (player.lv || 0) === (this.lv || 0) && !player.struggle && Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing)) < 1.0 && G.World.hasLOS(this.pos.x, this.pos.z, player.pos.x, player.pos.z, this.lv)) {
          const heavy = this.w.hands === 2;
          Humans.hurtPlayer(player, this, this.R.dmg * rr(0.9, 1.1), true, heavy ? 3.6 : 2);
          if (G.Audio) G.Audio.play(heavy ? 'hitBlade' : 'hitBlunt', { x: player.pos.x, z: player.pos.z, lv: player.lv, heavy });
        }
      }
      if (a.t >= 1) { this.act = null; this.atkCD = rr(0.6, 1.3); this.enter('fight', 0); }
    }

    // la sigilosa: te rodea sin que la veas y te ataca por la espalda (forcejeo); si la pillas, se esconde
    fightStealth(dt, player, dist, toYaw, combat) {
      // ¿la estás mirando de frente (en el centro de la pantalla)? ¿estás de espaldas a ella?
      const looked = this.seenBy(player, dist) === 2;
      const back = Math.abs(U.angleDiff(Math.atan2(this.pos.x - player.pos.x, this.pos.z - player.pos.z), player.facing)) > 1.9;
      this.aiming = false;
      if (this.hideT > 0) {
        this.hideT -= dt;
        if (!this.spot) this.spot = this.findSpot(player, true);
        if (this.spot) { this.goal = this.spot; this.moveSp = this.R.run; }
        this.wantCrouch = true;
        return;
      }
      // a tu espalda y al alcance: te agarra y te apuñala (forcejeo)
      if (dist < 1.45 && back && (player.lv || 0) === (this.lv || 0) && !player.struggle && !player.dead && (player.grabCD || 0) <= 0 && combat) {
        this.enter('stab', 0); this.act = { kind: 'kstab', t: 0, dur: 0.4 }; this.say('sneakAtk', null, { prio: 3 }); return;
      }
      // pillada de frente: pelea si está muy cerca (y es de las agresivas); si no, se va a esconder
      if (looked && !back && dist < 8) {
        if (dist < 2.1 && this.atkCD <= 0 && (this.pers.agr > 0.45 || this.enraged > 0)) { this.startSwing(player); return; }
        if (dist > 1.6) { this.hideT = rr(2, 4); this.spot = null; return; }
      }
      // por detrás de ti (de lejos, dando un rodeo)
      const bx = player.pos.x - Math.sin(player.facing) * 1.0, bz = player.pos.z - Math.cos(player.facing) * 1.0;
      const far = dist > 6;
      this.goal = far ? { x: bx + Math.cos(this.time * 0.4) * 3, z: bz + Math.sin(this.time * 0.4) * 3, lv: player.lv || 0 } : { x: bx, z: bz, lv: player.lv || 0 };
      this.moveSp = looked ? 1.4 : (far ? 3.2 : 2.4);
      this.wantCrouch = !far || looked;
      if (dist < 3) this.faceYaw = toYaw;
    }
    updateStab(dt, player, combat) {
      const a = this.act;
      if (!a) { this.enter('fight', 0); return; }
      a.t += dt / a.dur;
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
      this.faceYaw = Math.atan2(dx, dz);
      if (a.t >= 1) {
        this.act = null;
        const d = Math.hypot(dx, dz);
        const dodged = (player.dodging && player.dodging.t < 0.8) || player.dodgeAfter > 0;
        if (!dodged && d < 1.7 && !player.struggle && !player.dead && combat) { this.knifeGrab = true; combat.startStruggle(player, this); this.hideT = 0; }
        else { this.enter('fight', 0); this.hideT = rr(2, 3.5); this.spot = null; }
      }
    }
    // el saqueador: se queda atrás y escondido; solo pega si lo acorralas
    fightLooter(dt, player, dist, toYaw) {
      this.aiming = dist < 4;
      if (dist < 2.0 && this.seesP && this.atkCD <= 0) { this.startSwing(player); return; }
      this.spotT -= dt;
      if (!this.spot || this.spotT <= 0) { this.spotT = rr(2.5, 4); this.spot = this.pickSpot('cover', player.pos.x, player.pos.z, 15, null); }
      if (this.spot) { this.goal = this.spot; this.moveSp = this.R.run; }
      if (dist < 6) this.faceYaw = toYaw;
      this.wantCrouch = !this.goal || Math.hypot(this.spot.x - this.pos.x, this.spot.z - this.pos.z) < 0.8;
    }

    // ---------- Esquivar (como la protagonista) ----------
    startDodge(toYaw) {
      this.dodgeCD = rr(2.5, 5);
      const side = Math.random() < 0.5 ? 1 : -1;
      const a = toYaw + side * Math.PI / 2;
      let dx = Math.sin(a), dz = Math.cos(a);
      if (G.World.circleBlocked(this.pos.x + dx * 1.4, this.pos.z + dz * 1.4, 0.3, this.lv)) { dx = -dx; dz = -dz; }
      this.dodge = { t: 0, dur: 0.48, dx, dz, rel: U.angleDiff(Math.atan2(dx, dz), this.facing) };
      if (G.Audio) G.Audio.play('dodge', { x: this.pos.x, z: this.pos.z, lv: this.lv });
      if (Math.random() < 0.3) this.say('dodge', null, { prio: 1 });
    }
    updateDodge(dt) {
      const d = this.dodge;
      const t0 = Math.min(1, d.t);
      d.t += dt / d.dur;
      const t1 = Math.min(1, d.t), e = (t) => 1 - (1 - t) * (1 - t);
      const st = (e(t1) - e(t0)) * 1.6;
      G.World.move(this.pos, d.dx * st, d.dz * st, this.rad, this.lv, this.elev);
      this.speedNow = st / Math.max(dt, 1e-4) * 0.3;
      if (d.t >= 1) this.dodge = null;
    }

    // ---------- Bomba de humo (el líder) ----------
    startThrow(tx, tz) {
      if (this.smoke <= 0 || this.act) return false;
      this.smoke--;
      this.act = { kind: 'throw', t: 0, dur: 0.78, impact: 0.46, tx, tz, done: false };
      this.say('smoke', null, { prio: 3 });
      return true;
    }
    updateThrow(dt) {
      const a = this.act;
      a.t += dt / a.dur;
      this.faceYaw = Math.atan2(a.tx - this.pos.x, a.tz - this.pos.z);
      if (!a.done && a.t >= a.impact) {
        a.done = true;
        this.model.root.updateMatrixWorld(true);
        const p = this.model.handR.getWorldPosition(new THREE.Vector3());
        Humans.grenade(this, p, a.tx, a.tz);
        if (G.Audio) G.Audio.play('throwIt', { x: this.pos.x, z: this.pos.z, lv: this.lv });
      }
      if (a.t >= 1) this.act = null;
    }

    // ---------- Vendarse ----------
    updateBandage(dt) {
      const a = this.act;
      this.wantCrouch = true; this.aiming = false;
      if (!a || a.kind !== 'bandage') { this.enter('patrol', 0); return; }
      a.t += dt / a.dur;
      if (this.seesP && a.t < 0.5) { this.act = null; this.enter('fight', 0); return; }
      if (a.t >= 1) { this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.35); this.act = null; this.enter(this.engaged ? 'fight' : 'patrol', 0); }
    }

    // ---------- Rendirse y negociar ----------
    startBeg(player) {
      this.begUsed = true;
      this.enter('beg', 0); this.begT = 0; this.act = null; this.dodge = null; this.g.reload = null; this.aiming = false; this.drawing = false;
      this.hp = Math.min(this.hp, 0.6);
      this.offer = pick(this.bag.length ? ['items', 'items', 'info', 'leave'] : ['items', 'info', 'leave', 'info']);
      this.say(this.offer === 'items' ? 'begItems' : (this.offer === 'info' ? 'begInfo' : 'begLeave'), null, { prio: 4 });
      if (this.squad) this.squad.onBeg(this);
      msg(this.name + ' se rinde: déjalo ir (' + (G.Input && G.Input.isTouch ? '∆' : 'T') + ') o remátalo', 'good');
    }
    updateBeg(dt, player) {
      this.begT += dt;
      this.npcK = Math.min(1, (this.npcK || 0) + dt * 3);
      this.faceYaw = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      if (this.begT > 4 && Math.random() < dt * 0.25) this.say('begWait', null, { prio: 2 });
      // si te alejas o pasa mucho rato, aprovecha y huye
      if (d > 11) this.awayT = (this.awayT || 0) + dt; else this.awayT = 0;
      if (this.awayT > 2.5 || this.begT > 16) { this.npcK = 0; this.enter('flee', 0); this.fledAlone = true; }
    }
    // asalto humano: el último que queda de la segunda oleada tira humo y huye a buscar a su grupo
    escapeForHelp(player) {
      if (!this.alive || this.gone) return;
      this.act = null; this.dodge = null; this.g.reload = null; this.aiming = false; this.begPending = false; this.begUsed = true;
      this.say('callBackup', null, { prio: 5, force: true });
      // el humo entre él y tú (aunque no fuera el líder, lleva uno para esto)
      const tx = (this.pos.x * 0.6 + player.pos.x * 0.4), tz = (this.pos.z * 0.6 + player.pos.z * 0.4);
      const hp = new THREE.Vector3(this.pos.x, this.y + 1.5, this.pos.z);
      Humans.grenade(this, hp, tx, tz);
      Humans.after(0.9, () => { if (this.alive && !this.gone) Humans.grenade(this, new THREE.Vector3(this.pos.x, this.y + 1.5, this.pos.z), this.pos.x + (Math.random() - 0.5) * 3, this.pos.z + (Math.random() - 0.5) * 3); });
      // sale por el lado del mapa más lejos de ti
      const W = G.World, A0 = W.ARENA_MIN + 1.5, A1 = W.ARENA_MAX - 1.5;
      const cand = [{ x: A0, z: this.pos.z }, { x: A1, z: this.pos.z }, { x: this.pos.x, z: A0 }, { x: this.pos.x, z: A1 }];
      cand.sort((a, b) => (Math.hypot(b.x - player.pos.x, b.z - player.pos.z) - Math.hypot(b.x - this.pos.x, b.z - this.pos.z) * 0.6) - (Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(a.x - this.pos.x, a.z - this.pos.z) * 0.6));
      this.exit = this.squad ? this.squad.freeNear(cand[0].x, cand[0].z, 0, 3, 0) : cand[0];
      this.fleeT = 0; this.escaping = true;
      this.enter('flee', 0);
    }
    // lo dejas ir: cumple lo que ofreció y se va
    spare(player) {
      if (this.state !== 'beg') return null;
      this.spared = true; this.npcK = 0;
      this.say('spared', null, { prio: 3 });
      let m = this.name + ' se va';
      if (this.offer === 'items') {
        // suelta lo que llevaba y algo de munición para tus armas
        const guns = player.weapons.map((s) => G.Weapons.get(s.id)).filter((w) => G.Weapons.isGun(w) && G.Weapons.AMMO[w.ammo]);
        const w = guns.length ? pick(guns) : null;
        if (w) this.bag.push({ id: G.Weapons.AMMO[w.ammo].item, n: Math.max(1, Math.round(G.Weapons.AMMO[w.ammo].box[1] * 0.7)) });
        this.bag.push({ id: pick(['venda', 'alcohol', 'trapo']), n: 1 });
        this.dropLoot();
        m = this.name + ' te dejó lo que llevaba';
      } else if (this.offer === 'info' && this.squad) {
        let n = 0;
        for (const o of this.squad.members) if (o !== this && o.alive && !o.gone && G.Refugio && G.Refugio.ping) { G.Refugio.ping(o.pos.x, o.pos.z, 'escorpion', 9); n++; }
        m = n ? this.name + ' te dijo dónde están los demás' : this.name + ' no tenía a quién delatar';
      }
      if (this.squad) this.squad.onSpared(this);
      if (G.Mode && G.Mode.humanEvent) G.Mode.humanEvent('spare');
      this.enter('flee', 0);
      return m;
    }
    updateFlee(dt, player) {
      const sq = this.squad;
      this.aiming = false;
      if (!this.exit) this.exit = sq ? sq.exitPoint(this) : { x: this.pos.x, z: this.pos.z };
      const d = Math.hypot(this.exit.x - this.pos.x, this.exit.z - this.pos.z);
      this.goal = this.exit; this.moveSp = this.R.run * 0.95;
      this.fleeT = (this.fleeT || 0) + dt;
      if (d < 1.2 || this.fleeT > 30) this.depart();
      // si te ve muy cerca mientras huye (y no se rindió), se defiende
      if (!this.spared && this.seesP && Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < 3 && this.R.melee && this.atkCD <= 0) this.startSwing(player);
    }
    // sale del mapa: desaparece (cuenta como que se fue)
    depart() {
      if (this.gone) return;
      this.gone = true;
      if (this.squad) this.squad.onGone(this);
      const L1 = G.Population.list, i = L1.indexOf(this);
      if (i >= 0) L1.splice(i, 1);
      this.dispose();
    }

    // ---------- Rehén ----------
    updateHostage(dt, player) {
      const H = player.hostage;
      if (!H || H.h !== this || player.dead) { this.freeHostage(player, false); return; }
      this.npcK = Math.min(1, (this.npcK || 0) + dt * 5);
      H.t += dt;
      // pegado delante de ti, mirando hacia donde miras
      const f = player.facing, tx = player.pos.x + Math.sin(f) * 0.34, tz = player.pos.z + Math.cos(f) * 0.34;
      const k = Math.min(1, dt * 14);
      G.World.move(this.pos, (tx - this.pos.x) * k, (tz - this.pos.z) * k, 0.2, player.lv || 0, this.elev);
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) > 0.9) { this.pos.x = tx; this.pos.z = tz; }
      this.facing = U.turnToward(this.facing, f, 12 * dt);
      this.lv = player.lv || 0;
      this.speedNow = player.speedNow || 0;
      this.moveRel = player.moveRel || 0;
      if (H.t > 1.5 && Math.random() < dt * 0.12) this.say(Math.random() < 0.5 ? 'begWait' : 'hostage', null, { prio: 2 });
    }
    // se suelta (o lo sueltas): aturdido un momento y luego, según quién sea, pelea, se rinde o huye
    freeHostage(player, pushed) {
      this.npcK = 0;
      if (player && player.hostage && player.hostage.h === this) player.hostage = null;
      if (!this.alive) return;
      const f = player ? player.facing : this.facing;
      this.hostageDone = true;
      if (pushed) {
        // lo sueltas de un empujón: si ya no le quedan compañeros (o no es valiente), se va
        const others = this.squad ? this.squad.alive().filter((m) => m !== this).length : 0;
        if (!others || this.pers.brave < 0.5 || this.begUsed) this.spared = true;
        this.doStagger(Math.sin(f), Math.cos(f), 3.2);
      } else this.enter('fight', 0);
    }

    // ---------- Movimiento ----------
    // Hacia la meta con rutas (A*), abriendo puertas y rompiendo ventanas cerradas por el camino; el cuerpo
    // mira hacia faceYaw si hay (apuntando mientras camina de lado o hacia atrás)
    moveTo(goal, speed, dt) {
      const W = G.World, E = W.E;
      const st0 = this.state, f0 = this.facing, x0 = this.pos.x, z0 = this.pos.z;
      const crouchMul = this.crouchAmt > 0.5 ? 0.62 : 1;
      this.stepToward(goal, speed * crouchMul, dt);
      if (this.state === 'bang') {
        const ref = this.edge, e = ref ? W.edgeGet(ref) : E.NONE;
        if (e === E.DOOR) {
          W.setEdge(ref, E.DOOR_OPEN);
          const mx = ref.o === 'N' ? ref.x + 0.5 : ref.x, mz = ref.o === 'N' ? ref.z : ref.z + 0.5;
          if (G.Audio) G.Audio.play('doorOpen', { x: mx, z: mz, lv: this.lv });
          emitSelf(mx, mz, 3, this.lv);
        } else if (e === E.WIN) W.shatter(ref);
        else { this.path = null; this.pathTimer = 0.4; this.stuck += 0.5; }
        this.state = st0; this.edge = null; this.timer = 0;
      } else if (this.state === 'climb') { this.climbBack = st0; }
      const mdx = this.pos.x - x0, mdz = this.pos.z - z0, mv = Math.hypot(mdx, mdz);
      if (this.state !== 'climb') {
        if (this.faceYaw != null) this.facing = U.turnToward(f0, this.faceYaw, 8 * dt);
        else if (mv > 1e-4) this.facing = U.turnToward(f0, Math.atan2(mdx, mdz), 8 * dt);
        if (mv > 1e-4) this.moveYaw = Math.atan2(mdx, mdz);
      }
      return mv / Math.max(dt, 1e-4);
    }
    sideStep() {
      const W = G.World;
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * TAU, r = rr(1.2, 2.8);
        const x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
        if (!W.circleBlocked(x, z, 0.35, this.lv) && W.hasClearLine(this.pos.x, this.pos.z, x, z, this.lv)) { this.side = { x, z, lv: this.lv, t: 1.1 }; this.path = null; return; }
      }
    }
    separate(all, player) {
      for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o === this || !o.alive || o.downed || o.state === 'hostage') continue;
        const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, d2 = ox * ox + oz * oz;
        if (d2 < 0.36 && d2 > 1e-4) { const d = Math.sqrt(d2), p = (0.6 - d) * 0.5; G.World.move(this.pos, ox / d * p, oz / d * p, this.rad, this.lv, this.elev); }
      }
      if (this.state === 'hostage') return;
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (!player.dead && d < 0.55 && d > 1e-3) G.World.move(this.pos, -dx / d * (0.55 - d), -dz / d * (0.55 - d), this.rad, this.lv, this.elev);
    }
    anim(dt) {
      const want = this.wantCrouch && !this.dodge ? 1 : 0;
      this.crouchAmt += (want - this.crouchAmt) * Math.min(1, dt * 7);
      const v = this.speedNow;
      this.moveAmt += (Math.min(1, v / 2.0) - this.moveAmt) * Math.min(1, dt * 10);
      this.moveRel = v > 0.2 && this.moveYaw != null ? U.angleDiff(this.moveYaw, this.facing) : 0;
      this.phase += dt * Math.PI * 2 * (0.62 + 0.21 * Math.min(6, v)) * (this.moveAmt > 0.05 ? 1 : 0);
      const al = this.engaged || this.state === 'check' ? 1 : 0;
      this.alertAmt += (al - this.alertAmt) * Math.min(1, dt * 3);
      if (this.act && this.act.kind === 'search' && this.state !== 'loot') this.act = null;
      // giro (para la inclinación)
      const tr = U.angleDiff(this.facing, this.prevF == null ? this.facing : this.prevF) / Math.max(dt, 1e-4);
      this.prevF = this.facing;
      this.turnRate = (this.turnRate || 0) + (U.clamp(tr, -6, 6) - (this.turnRate || 0)) * Math.min(1, dt * 8);
      // apuntando: el cañón sube o baja hacia ti
      const P = Humans.player;
      if (P && this.aiming) {
        const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) || 1;
        const want2 = Math.atan2((this.y + 1.45) - (P.y + (P.stance === 'crouch' ? 0.85 : 1.25)), d);
        this.aimPitch += (want2 - this.aimPitch) * Math.min(1, dt * 8);
      } else this.aimPitch *= Math.max(0, 1 - dt * 4);
      if (this.lookAt && !this.engaged && this.state !== 'check') this.lookAt.w *= Math.max(0, 1 - dt * 0.5);
    }

    // ---------- Modelo ----------
    apply(dt) {
      if (!this.ready) return Z.prototype.apply.call(this, dt);
      const m = this.model;
      if (this.rag || ZPOSE[this.state]) {
        if (m.weapon) m.weapon.visible = false;
        if (m.gunAnchor) m.gunAnchor.visible = false;
        this.twitchT = 1e9;
        Z.prototype.apply.call(this, dt);
        return;
      }
      const busyHands = !!(this.act && (this.act.kind === 'bandage' || this.act.kind === 'throw'));
      const hideW = this.state === 'beg' || this.state === 'hostage' || busyHands;
      if (m.weapon) m.weapon.visible = !hideW;
      if (m.gunAnchor) m.gunAnchor.visible = !hideW;
      // posición (plantas, techos de contenedores) y nivel de detalle: igual que los infectados
      this.lv = G.World.levelAt(this.pos.x, this.pos.z, this.lv);
      if (!this.climbing && !this.lv && G.World.deckAt) {
        const deck = G.World.standTop(this.pos.x, this.pos.z, 0);
        if (!this.falling && this.elev > deck + 0.2) { this.falling = true; this.fallV = 0; }
        if (this.falling) {
          this.fallV += 9.8 * (dt || 0.016);
          this.elev = Math.max(deck, this.elev - this.fallV * (dt || 0.016));
          if (this.elev <= deck + 1e-3) { this.falling = false; this.elev = deck; }
        } else if (this.elev > 0) this.elev = deck;
      }
      const gy = G.World.groundY(this.pos.x, this.pos.z, this.lv) + (this.elev || 0);
      if (this.elev > 0 || this.falling || this.climbing) this.y = gy;
      else this.y += (gy - this.y) * Math.min(1, (dt || 0.016) * 14);
      const lift = this.climbing && !this.climbing.ledge ? Math.sin(Math.PI * Math.min(1, this.climbing.t)) * 0.7 : 0;
      m.root.position.set(this.pos.x, this.y + lift, this.pos.z);
      m.root.rotation.y = this.facing;
      const cp = G.Camera && G.Camera.pos;
      if (cp) {
        const d = Math.hypot(cp.x - this.pos.x, cp.z - this.pos.z);
        const q = G.Quality ? G.Quality.cur : { lod: [18, 36], shadowZ: 22, animFar: 2 };
        const lv = m.lod === 1 ? (d > q.lod[0] + 1.5 ? (d > q.lod[1] + 1.5 ? -1 : 0) : 1) : (m.lod === 0 ? (d < q.lod[0] - 1.5 ? 1 : (d > q.lod[1] + 1.5 ? -1 : 0)) : (d < q.lod[1] - 1.5 ? (d < q.lod[0] - 1.5 ? 1 : 0) : -1));
        G.Models.setLOD(m, lv);
        const sh = d < q.shadowZ;
        if (m.mesh.castShadow !== sh) m.mesh.castShadow = sh;
      }
      const g = this.g, gs = this._gs;
      if (this.gunW) {
        gs.aim = g.aim; gs.recoil = g.recoil; gs.cycle = g.cycle; gs.rw = g.rw; gs.ru = g.ru; gs.draw = g.draw; gs.arrow = g.arrow;
      }
      const a = this.act;
      const st = this.state;
      const blow = st === 'stagger' ? { t: Math.min(1, this.stagger || 0), rel: 0, bite: false, dur: this.reactDur || 0.55, react: this.reactKind || 'side', fl: this.flinch || 1 } : null;
      const npc = st === 'beg' ? { kind: 'kneel', k: this.npcK || 0 } : (st === 'hostage' ? { kind: 'held', k: this.npcK || 0 } : null);
      G.Models.posePlayer(m, {
        phase: this.phase, amt: this.moveAmt, run: this.speedNow > 3.4, crouch: this.crouchAmt, prone: 0,
        rel: this.moveRel, hop: 0, cat: this.w.cat, two: this.w.hands === 2, aim: !!(this.aiming || (this.R.melee && this.engaged && st === 'fight')),
        dt: dt || 0, time: this.time,
        action: a && st !== 'beg' && st !== 'hostage' ? a.kind : null, t: a ? Math.min(1, a.t) : 0,
        climb: this.climbing ? Math.min(1, this.climbing.t) : null, ledge: !!(this.climbing && this.climbing.ledge),
        jump: this.jumpU() != null, jumpT: this.jumpU(),      // (valla o ventana: la animación grabada de salto)
        fall: 0, land: 0,
        dodge: this.dodge ? Math.min(1, this.dodge.t) : null, dodgeRel: this.dodge ? this.dodge.rel : 0,
        gun: this.gunW && !npc && !busyHands ? gs : null, pitch: this.aimPitch,
        grabKnife: false, searchLow: !!(a && a.kind === 'search'), side: 1, weaponCat: this.w.cat, guard: 0,
        speed: this.speedNow, female: this.female, turn: this.turnRate || 0, acc: 0, breath: this.engaged ? 0.25 : 0, breathT: this.time * 1.9,
        look: this.lookAt && this.lookAt.w > 0.02 ? this.lookAt : null, alert: this.alertAmt, fidget: null,
        blow, struggle: null, bossKill: null, cover: null, draw: null, npc,
        aimAt: this.gunW && this.aiming ? this.aimPoint() : null,
        contact: a && st === 'melee' ? this.contactPose(a) : null
      });
      if (hideW && m.weapon) m.weapon.visible = false;
    }
  }

  // =================================================================
  // ---------- Escuadrón: el líder, las órdenes, la moral y el afecto ----------
  class Squad {
    constructor(o) {
      this.members = [];
      this.zone = o.zone;
      this.mode = 'sweep';
      this.active = !!o.active;
      this.known = null;
      this.morale = 1;
      this.diff = o.diff || 0.9;
      this.brainT = 2; this.banterT = rr(10, 18); this.retreatT = 0; this.pushT = 0;
      this.holdFire = false; this.hostage = null;
      this.stats = { killed: 0, spared: 0, fled: 0, hostages: 0, execs: 0 };
      this.sectors = this.makeSectors();
      this.affM = [];
      this.done = false;
      this.noRetreat = true;            // (el escuadrón no se retira nunca: ni en grupo ni los cobardes por su cuenta)
      this.entry = o.entry || null;
    }
    get leader() { return this._leader && this._leader.alive && !this._leader.gone && this._leader.state !== 'beg' && !this._leader.spared ? this._leader : null; }
    // para no repetir lo mismo a cada rato: true si hace más de sec segundos que no se dijo
    cool(key, sec) { const c = this.cd || (this.cd = {}); if (T - (c[key] == null ? -1e9 : c[key]) < sec) return false; c[key] = T; return true; }
    aff(a, b) { if (!a || !b || a === b) return 1; const r = this.affM[a.idx]; return r ? (r[b.idx] != null ? r[b.idx] : 0.5) : 0.5; }
    // afecto entre ellos: algunos muy unidos (parejas de amigos), otros que no se soportan; al líder, respeto
    makeAff() {
      const n = this.members.length;
      for (let i = 0; i < n; i++) { this.affM[i] = []; for (let j = 0; j < n; j++) this.affM[i][j] = i === j ? 1 : rr(0.25, 0.6); }
      const idx = this.members.map((m, i) => i);
      for (let k = 0; k < Math.floor(n / 3); k++) {
        const a = pick(idx), b = pick(idx);
        if (a === b) continue;
        const v = Math.random() < 0.65 ? rr(0.78, 0.98) : rr(0.02, 0.18);
        this.affM[a][b] = v; this.affM[b][a] = U.clamp(v + rr(-0.12, 0.12), 0, 1);
      }
      const L0 = this.members.find((m) => m.role === 'lider');
      if (L0) for (const m of this.members) if (m !== L0) this.affM[m.idx][L0.idx] = U.clamp(this.affM[m.idx][L0.idx] + rr(0.05, 0.35), 0, 1);
    }
    alive() { return this.members.filter((m) => m.alive && !m.gone && !m.spared && m.state !== 'beg'); }
    left() { return this.members.filter((m) => m.alive && !m.gone).length; }
    center() {
      let x = 0, z = 0, n = 0;
      for (const m of this.members) if (m.alive && !m.gone) { x += m.pos.x; z += m.pos.z; n++; }
      return n ? { x: x / n, z: z / n } : { x: (this.zone.x0 + this.zone.x1) / 2, z: (this.zone.z0 + this.zone.z1) / 2 };
    }
    makeSectors() {
      const W = G.World, Zn = this.zone, out = [];
      for (let x = Zn.x0 + 4; x < Zn.x1 - 2; x += 7) {
        for (let z = Zn.z0 + 4; z < Zn.z1 - 2; z += 7) {
          for (let k = 0; k < 8; k++) {
            const px = x + (k ? rr(-2.5, 2.5) : 0), pz = z + (k ? rr(-2.5, 2.5) : 0);
            if (W.circleBlocked(px, pz, 0.45, 0)) continue;
            out.push({ x: px, z: pz, lv: 0, indoor: W.isIndoor(Math.floor(px), Math.floor(pz), 0), done: false });
            break;
          }
        }
      }
      return out;
    }
    // punto libre cerca de (x, z)
    freeNear(x, z, r0, r1, lv) {
      const W = G.World;
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * TAU, r = rr(r0, r1);
        const px = U.clamp(x + Math.sin(a) * r, this.zone.x0 + 1, this.zone.x1 - 1), pz = U.clamp(z + Math.cos(a) * r, this.zone.z0 + 1, this.zone.z1 - 1);
        if (!W.circleBlocked(px, pz, 0.4, lv || 0)) return { x: px, z: pz, lv: lv || 0 };
      }
      return { x, z, lv: lv || 0 };
    }
    exitPoint(h) {
      if (this.entry) return this.freeNear(this.entry.x, this.entry.z, 0, 2, 0);
      const Zn = this.zone, x = h.pos.x, z = h.pos.z;
      const opts = [{ x: Zn.x0 + 1, z }, { x: Zn.x1 - 1, z }, { x, z: Zn.z0 + 1 }, { x, z: Zn.z1 - 1 }];
      opts.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      return this.freeNear(opts[0].x, opts[0].z, 0, 2, 0);
    }

    // ---- lo que saben de ti ----
    know(player, seen, by) {
      const K = this.known || (this.known = { x: 0, z: 0, lv: 0, t: 99, seen: false });
      const wasT = K.t;
      K.x = player.pos.x; K.z = player.pos.z; K.lv = player.lv || 0; K.t = 0; K.seen = seen;
      if (!this.active) this.begin(true);
      if (this.mode !== 'combat') {
        const from = this.mode;
        this.mode = 'combat'; this.brainT = Math.min(this.brainT, 0.6);
        if (seen && by) {
          // aviso: dónde estás (la hora del reloj desde quien te vio; «arriba» si estás en otra planta)
          const a = U.angleDiff(Math.atan2(player.pos.x - by.pos.x, player.pos.z - by.pos.z), by.facing);
          let h = Math.round(-a / (Math.PI / 6));
          h = ((h % 12) + 12) % 12;
          const dir = (player.lv || 0) > (by.lv || 0) ? 'Arriba' : CLOCK[h];
          by.say(from === 'search' ? 'found' : 'contact', { dir }, { prio: 3 });
        }
        for (const m of this.members) if (m.alive && HSTATE[m.state] && m.state !== 'beg' && m.state !== 'hostage' && m.state !== 'flee' && m.state !== 'bandage') { if (m.state === 'loot') m.act = null; m.enter('fight', 0); m.spot = null; }
      } else if (seen && by && wasT > 6) by.say('found', null, { prio: 3 });
    }
    onNoise(h, x, z, r, lv) {
      if (!this.active || this.mode === 'retreat') return;
      const big = r >= 20;
      if (this.mode === 'combat') { if (big && this.known && this.known.t > 2) { this.known.x = x; this.known.z = z; this.known.lv = lv; this.known.t = 1.5; } return; }
      if (big) {
        // un disparo: saben más o menos de dónde vino
        h.say('shotHeard', null, { prio: 3 });
        const K = this.known || (this.known = { x, z, lv, t: 0, seen: false });
        K.x = x + rr(-3, 3); K.z = z + rr(-3, 3); K.lv = lv; K.t = 0.5; K.seen = false;
        this.mode = 'search'; this.searchT = 0; this.brainT = 0.4;
        return;
      }
      if (h.state === 'check' || h.state === 'loot') return;
      h.check = { x: x + rr(-1, 1), z: z + rr(-1, 1), lv };
      h.enter('check', 0);
      if (Math.random() < 0.7) h.say('heard', null, { prio: 2 });
    }
    onHurt(h, by) {
      // (lo hirió un preso que se escapó o un compañero: saben dónde está ese, no tú)
      const P = by && by.proxy ? by.proxy : Humans.player;
      if (!P) return;
      if (by && by.proxy) { this.know(P, true, h); return; }
      // los que reciben un tiro saben que estás ahí (aproximadamente si no te ven)
      if (h.seesP) this.know(P, true, h);
      else if (this.mode !== 'combat') { const K = this.known || (this.known = { x: 0, z: 0, lv: 0, t: 0, seen: false }); K.x = P.pos.x + rr(-4, 4); K.z = P.pos.z + rr(-4, 4); K.lv = P.lv || 0; K.t = 1; this.mode = 'combat'; this.brainT = 0.3; for (const m of this.members) if (m.alive && CALM[m.state]) m.enter('fight', 0); }
    }
    onDeath(h) {
      this.stats.killed++;
      const wasLeader = h === this._leader;
      this.morale -= wasLeader ? 0.28 : 0.14;
      const P = Humans.player;
      if (P) this.know(P, false, null);
      const rest = this.members.filter((m) => m !== h && m.alive && !m.gone && m.state !== 'beg' && m.state !== 'hostage');
      if (!rest.length) return;
      // quien lo ve o está cerca lo grita; los que lo querían se enfurecen, a los que no, les da igual
      let said = false;
      const order = rest.slice().sort((a, b) => this.aff(b, h) - this.aff(a, h));
      for (const m of order) {
        const a = this.aff(m, h), near = Math.hypot(m.pos.x - h.pos.x, m.pos.z - h.pos.z) < 25;
        this.morale -= a * 0.05;
        if (a > 0.7) { m.enraged = 25; m.begPending = false; if (!said) { m.say('grief', { x: h.name }, { prio: 4 }); said = true; } }
        else if (!said && near) { m.say(wasLeader ? 'leaderDown' : (a < 0.2 && Math.random() < 0.5 ? 'cold' : 'manDown'), { x: h.name }, { prio: 3 }); said = true; }
      }
      if (wasLeader) this.promote();
      // ejecutaste a un rehén
      if (h.state === 'dead' && h.killedBy === 'exec' && h.wasHostage) {
        this.stats.execs++;
        const w = order[0]; if (w) w.say('hostageExec', { x: h.name }, { prio: 4, after: 0.6 });
        for (const m of rest) if (this.aff(m, h) > 0.4) m.enraged = 30;
      }
    }
    onFriendlyKill(shooter, h) {
      this.morale -= 0.1;
      for (const m of this.members) if (m !== shooter && m.alive && this.aff(m, h) > 0.6) { m.say('hostageExec', { x: h.name }, { prio: 3 }); break; }
    }
    onBeg(h) {
      // otro lo ve y le grita (o intenta ayudarlo)
      for (const m of this.members) {
        if (m === h || !m.alive || m.gone || Math.hypot(m.pos.x - h.pos.x, m.pos.z - h.pos.z) > 20) continue;
        m.say(this.aff(m, h) > 0.6 ? 'hostageDemand' : 'traitor', { x: h.name }, { prio: 2, after: 1.5 });
        break;
      }
      this.morale -= 0.06;
    }
    onSpared(h) { this.stats.spared++; this.morale -= 0.08; }
    onGone(h) { if (!h.spared) this.stats.fled++; }
    onHostage(h, player) {
      this.stats.hostages++;
      this.hostage = h; h.wasHostage = true;
      this.morale -= 0.08;
      this.know(player, false, null);
      // el líder decide: no disparar (si lo aprecia o es de los que no arriesgan) o disparar igual
      const L0 = this.leader;
      const watcher = this.members.find((m) => m !== h && m.alive && !m.gone && m.state !== 'beg' && Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z) < 30);
      if (watcher) watcher.say('hostageSeen', { x: h.name }, { prio: 3, after: 0.8 });
      if (L0 && L0 !== h) {
        this.holdFire = this.aff(L0, h) > 0.35 || L0.pers.agr < 0.6;
        L0.say(this.holdFire ? 'holdFire' : 'fireAnyway', { x: h.name }, { prio: 3, after: 2 });
        if (!this.holdFire) {
          // los que lo aprecian no obedecen
          const dis = this.members.find((m) => m !== h && m !== L0 && m.alive && this.aff(m, h) > 0.6);
          if (dis) dis.say('disobey', { x: h.name }, { prio: 2, after: 4 });
        }
      } else this.holdFire = true;
    }
    onHostageEnd() { this.hostage = null; this.holdFire = false; }
    promote() {
      const c = this.alive().filter((m) => m.role !== 'saqueador').sort((a, b) => (b.pers.brave + b.pers.agr) - (a.pers.brave + a.pers.agr))[0] || this.alive()[0];
      this._leader = c || null;
      if (c) c.say('newLeader', null, { prio: 3, after: 2.5 });
    }
    // empieza la misión
    begin(quiet) {
      if (this.active) return;
      this.active = true;
      const L0 = this.leader;
      if (L0 && !quiet) L0.say('start', null, { prio: 2 });
      this.brainT = quiet ? 0.5 : 2.5;
      for (const m of this.members) if (m.state === 'idle') m.enter('patrol', 0);
    }

    // ---- cada fotograma ----
    update(dt, player) {
      if (this.done) return;
      const K = this.known;
      if (K) K.t += dt;
      if (this.pushT > 0) this.pushT -= dt;
      // ¿queda alguien?
      if (!this.members.some((m) => m.alive && !m.gone && !m.spared)) { this.done = true; Voice.q.length = 0; return; }
      if (this.hostage && (!player.hostage || player.hostage.h !== this.hostage)) this.onHostageEnd();
      if (!this.active) { this.banter(dt, player); return; }
      if (!this.leader) this.promote();
      // cambios de modo
      if (this.mode === 'combat' && K && K.t > 8) {
        this.mode = 'search'; this.searchT = 0; this.brainT = 0.5;
        const sp = this.alive().find((m) => m.lostT < 12) || this.leader;
        if (sp) sp.say('lost', null, { prio: 2 });
      }
      if (this.mode === 'search') {
        this.searchT = (this.searchT || 0) + dt;
        if (this.searchT > 38) {
          this.mode = 'sweep'; this.brainT = 1;
          if (this.leader) this.leader.say('giveUp', null, { prio: 2 });
          for (const m of this.members) if (m.alive && m.state === 'fight') m.enter('patrol', 0);
        }
      }
      // retirada: pocos y desmoralizados
      const alive = this.alive();
      if (!this.noRetreat && this.mode !== 'retreat' && this.morale < 0.32 && alive.length <= Math.max(2, Math.ceil(this.members.length / 2)) && alive.length > 0) {
        this.mode = 'retreat';
        const sp = this.leader || alive[0];
        sp.say('retreat', null, { prio: 4 });
        if (sp.smoke > 0 && K) sp.startThrow((sp.pos.x + K.x) / 2, (sp.pos.z + K.z) / 2);
        for (const m of alive) if (HSTATE[m.state] && m.state !== 'beg' && m.state !== 'hostage') m.enter('flee', 0);
      }
      // los más cobardes huyen solos cuando todo va mal
      if (!this.noRetreat && this.mode === 'combat' && this.morale < 0.55) {
        for (const m of alive) {
          if (m === this.leader || m.enraged > 0 || m.state !== 'fight' || m.fleeCheck > T) continue;
          m.fleeCheck = T + 6;
          if (m.pers.brave < 0.25 && m.hp < m.hpMax * 0.6 && Math.random() < 0.5) { m.say('flee', null, { prio: 3 }); m.enter('flee', 0); }
        }
      }
      this.brainT -= dt;
      if (this.brainT <= 0) this.brain(player);
      this.banter(dt, player);
    }

    // ---- el líder piensa: reparte el trabajo y da las órdenes ----
    brain(player) {
      const L0 = this.leader;
      const alive = this.alive();
      if (!alive.length) return;
      if (this.mode === 'sweep') { this.brainT = rr(7, 10); this.sweepOrders(L0 || alive[0], alive); return; }
      if (this.mode === 'search') { this.brainT = rr(5, 7); this.searchOrders(L0, alive); return; }
      if (this.mode === 'combat') { this.brainT = rr(3, 4.5); this.combatOrders(L0, alive, player); }
    }
    // da una orden: el otro contesta (o se niega si no lo aprecia y es poco valiente)
    order(L0, m, key, task) {
      if (!m || m.state === 'hostage' || m.state === 'beg' || m.state === 'flee' || m.spared) return;
      if (!L0 || m === L0) { m.task = task; return; }
      L0.say(key, { to: m.name }, { prio: 2, to: m });
      const a = this.aff(m, L0);
      const refuse = Math.random() < (1 - a) * (1 - m.pers.brave) * 0.4;
      if (refuse) {
        m.say('refuse', null, { prio: 2, after: 1.8 });
        if (Math.random() < 0.6) { m.say('refuseLate', null, { prio: 1, after: 5 }); setTimeoutGame(4.5, () => { if (m.alive) m.task = task; }); }
        return;
      }
      if (Math.random() < 0.65) m.say(a > 0.7 ? 'ackLoyal' : 'ack', null, { prio: 2, after: 1.6 });
      m.task = task;
    }
    sweepOrders(L0, alive) {
      // siguiente zona: la más cercana sin revisar (si no queda ninguna, vuelven a empezar)
      let sec = null, bd = 1e9;
      const c = L0 ? L0.pos : this.center();
      for (const s of this.sectors) {
        if (s.done) continue;
        const d = Math.hypot(s.x - c.x, s.z - c.z);
        if (d < bd) { bd = d; sec = s; }
      }
      if (!sec) { for (const s of this.sectors) s.done = false; sec = this.sectors[Math.floor(Math.random() * this.sectors.length)]; }
      if (!sec) return;
      sec.done = true;
      this.cur = sec;
      if (L0) { L0.task = { kind: 'move', x: sec.x, z: sec.z, lv: 0 }; if (Math.random() < 0.6) L0.say('sector', null, { prio: 1 }); }
      // saqueo: protegen la caja fuerte; el líder y dos más se quedan siempre a su lado, mirando hacia fuera
      const gd = this.guard, keep = [];
      if (gd) {
        const pool = alive.filter((m) => m.role !== 'tirador' && m.role !== 'sigilo').sort((a, b) => (a === L0 ? -1 : 0) - (b === L0 ? -1 : 0));
        for (const m of pool.slice(0, 3)) {
          const a = Math.random() * TAU, sp = this.freeNear(gd.x + Math.sin(a) * 2.2, gd.z + Math.cos(a) * 2.2, 0, 1.5, 0);
          m.task = { kind: 'guard', x: sp.x, z: sp.z, lv: 0, face: Math.atan2(sp.x - gd.x, sp.z - gd.z) };
          keep.push(m);
        }
      }
      let k = 0;
      for (const m of alive) {
        if (keep.indexOf(m) >= 0) continue;
        if (m === L0 || !HSTATE[m.state] || m.state === 'check' || m.state === 'loot' || m.state === 'bandage') continue;
        if (m.task && !m.task.done && m.task.kind === 'loot') continue;
        let task, key = null;
        if (m.role === 'tirador') { task = Object.assign(this.vantage(sec), { kind: 'guard' }); key = 'ordGuard'; }
        else if (m.role === 'saqueador' || m.role === 'carronero') {
          // a saquear: lo más cercano del suelo dentro de la zona (o una habitación)
          const it = this.lootTarget(sec);
          task = it ? { kind: 'loot', x: it.x, z: it.z, lv: it.lv || 0 } : Object.assign(this.freeNear(sec.x, sec.z, 1, 4, 0), { kind: 'move' });
          key = it ? 'ordLoot' : null;
        } else if (m.role === 'sigilo') { const p = this.sectors.find((s) => !s.done && Math.hypot(s.x - sec.x, s.z - sec.z) < 16) || sec; task = Object.assign(this.freeNear(p.x, p.z, 1, 3, 0), { kind: 'scout' }); key = 'ordScout'; }
        else if (m.role === 'bruto' && L0) { task = { kind: 'follow', who: L0, ox: rr(-1.5, 1.5), oz: rr(-1.5, 1.5), x: L0.pos.x, z: L0.pos.z }; }
        else task = Object.assign(this.freeNear(sec.x, sec.z, 3, 7, 0), { kind: 'move' });
        // no siempre se dicen las órdenes (sería un no parar)
        if (key && Math.random() < 0.55 && k++ < 2) this.order(L0, m, key, task);
        else m.task = task;
      }
    }
    // un sitio con buena vista sobre la zona (el tirador monta guardia ahí)
    vantage(sec) {
      const W = G.World;
      let best = null, bs = -1e9;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU, r = rr(8, 15);
        const x = sec.x + Math.sin(a) * r, z = sec.z + Math.cos(a) * r;
        if (x < this.zone.x0 + 1 || x > this.zone.x1 - 1 || z < this.zone.z0 + 1 || z > this.zone.z1 - 1 || W.circleBlocked(x, z, 0.4, 0)) continue;
        let s = W.hasLOS(x, z, sec.x, sec.z, 0) ? 5 : 0;
        if (!W.isIndoor(Math.floor(x), Math.floor(z), 0)) s += 1;
        for (let k = 0; k < 4; k++) { const b = k / 4 * TAU; if (W.hasLOS(x, z, x + Math.sin(b) * 14, z + Math.cos(b) * 14, 0)) s += 1; }
        if (s > bs) { bs = s; best = { x, z, lv: 0, face: Math.atan2(sec.x - x, sec.z - z) }; }
      }
      return best || { x: sec.x, z: sec.z, lv: 0, face: 0 };
    }
    lootTarget(sec) {
      const P = G.Pickups;
      let best = null, bd = 14;
      if (P && P.list) for (const it of P.list) {
        if (it.armed) continue;
        const d = Math.hypot(it.x - sec.x, it.z - sec.z);
        if (d < bd) { bd = d; best = it; }
      }
      if (best) return this.freeNear(best.x, best.z, 0.4, 1.2, best.lv || 0);
      if (sec.indoor) return { x: sec.x, z: sec.z, lv: 0 };
      return null;
    }
    searchOrders(L0, alive) {
      const K = this.known;
      if (!K) return;
      if (L0 && Math.random() < 0.6) L0.say('search', null, { prio: 2 });
      // en abanico: cada uno por un lado (no todos al mismo sitio)
      const base = Math.random() * TAU, n = Math.max(1, alive.length);
      alive.forEach((m, i) => {
        if (!HSTATE[m.state] || m.state === 'beg' || m.state === 'hostage') return;
        let p = null;
        for (let k = 0; k < 8 && !p; k++) {
          const a = base + i * TAU / n + rr(-0.35, 0.35), r = rr(3.5, 9);
          const px = U.clamp(K.x + Math.sin(a) * r, this.zone.x0 + 1, this.zone.x1 - 1), pz = U.clamp(K.z + Math.cos(a) * r, this.zone.z0 + 1, this.zone.z1 - 1);
          if (!G.World.circleBlocked(px, pz, 0.4, K.lv || 0)) p = { x: px, z: pz, lv: K.lv || 0 };
        }
        p = p || this.freeNear(K.x, K.z, 2, 9, K.lv);
        m.task = Object.assign(p, { kind: 'move' });
        m.spot = p; m.spotT = 6;
      });
    }
    combatOrders(L0, alive, player) {
      const K = this.known;
      if (!K) return;
      // papeles: flanqueadores a los lados, el bruto a por ti, la tiradora cubre, el saqueador se esconde
      let side = Math.random() < 0.5 ? 1 : -1, said = 0;
      for (const m of alive) {
        if (m === L0 || m.state === 'hostage' || m.state === 'flee') continue;
        if ((m.role === 'pistolero' || m.role === 'escopetero' || m.role === 'arquero' || m.role === 'explorador') && !m.flankSide) {
          m.flankSide = side; side = -side;
          if (said < 2 && Math.random() < 0.6) { this.order(L0, m, m.flankSide > 0 ? 'ordFlankR' : 'ordFlankL', m.task); said++; }
        } else if (m.role === 'bruto' && !m.rushOrd) { m.rushOrd = true; if (said < 2) { this.order(L0, m, 'ordRush', m.task); said++; } }
        else if (m.role === 'tirador' && !m.coverOrd) { m.coverOrd = true; m.task = Object.assign(this.vantage({ x: K.x, z: K.z }), { kind: 'guard' }); if (said < 2 && Math.random() < 0.5) { this.order(L0, m, 'ordCover', m.task); said++; } }
        else if (m.role === 'saqueador' && !m.hideOrd) { m.hideOrd = true; if (said < 2 && Math.random() < 0.4) { this.order(L0, m, 'ordHide', m.task); said++; } }
        else if (m.role === 'sigilo' && !m.sneakOrd) { m.sneakOrd = true; if (said < 2 && Math.random() < 0.5) { this.order(L0, m, 'ordSneak', m.task); said++; } }
      }
      // humo: para cubrir a los que avanzan al descubierto, o cuando cae alguien
      if (L0 && L0.smoke > 0 && !L0.act && L0.state === 'fight' && K.t < 4) {
        let exposed = 0;
        for (const m of alive) if (m !== L0 && m.state === 'fight' && m.speedNow > 2 && G.World.hasLOS(m.pos.x, m.pos.z, K.x, K.z, m.lv)) exposed++;
        const lossy = this.stats.killed > (this.smokeAt || 0);
        if ((exposed >= 2 && Math.random() < 0.5) || (lossy && Math.random() < 0.6) || (this.hostage && Math.random() < 0.4)) {
          this.smokeAt = this.stats.killed;
          // entre ellos y tú (más cerca de ti)
          const c = this.center();
          const tx = K.x + (c.x - K.x) * 0.35, tz = K.z + (c.z - K.z) * 0.35;
          L0.startThrow(tx, tz);
        }
      }
      // con un rehén, el líder insiste
      if (this.hostage && L0 && this.hostage !== L0 && Math.random() < 0.5) L0.say('hostageDemand', { x: this.hostage.name }, { prio: 2 });
    }

    // ---- charla: de dos en dos, según cuánto se aprecian ----
    banter(dt, player) {
      if (this.mode !== 'sweep' || Voice.q.length) return;
      this.banterT -= dt;
      if (this.banterT > 0) return;
      this.banterT = rr(16, 30);
      const al = this.alive().filter((m) => CALM[m.state] || m.state === 'idle');
      if (al.length < 2) return;
      const a = pick(al);
      let b = null, bd = 12;
      for (const m of al) { if (m === a) continue; const d = Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z); if (d < bd) { bd = d; b = m; } }
      if (!b) return;
      const L0 = this.leader;
      let pair;
      if (this.chat && Math.random() < 0.8) pair = this.chat();
      else if (b === L0 && Math.random() < 0.6) pair = pick(L.banterLeader);
      else { const v = this.aff(a, b); pair = pick(v > 0.65 ? L.banterGood : (v < 0.3 ? L.banterBad : L.banterAny)); }
      Voice.say(a, pair[0], { prio: 1, to: b });
      Voice.say(b, pair[1], { prio: 1, to: a, after: 0.9 + pair[0].length * 0.058 });
    }
  }

  // temporizadores en tiempo de juego (se paran con la pausa)
  const timers = [];
  function setTimeoutGame(sec, fn) { timers.push({ t: T + sec, fn }); }

  // =================================================================
  // ---------- Efectos: trazadoras, fogonazos, flechas y botes de humo ----------
  const _tA = new THREE.Vector3();
  // =================================================================
  // El compañero de la resistencia (Tomás o Vera, el personaje que no llevas): se mueve por la zona que defiende
  // y dispara a los infectados que se le acercan; de cerca, el hacha (Tomás) o la pistola (Vera). Tiene bastante
  // vida (los golpes de los infectados se los lleva «proxy», que hace de protagonista para ellos), pero no es un
  // soldado: apunta regular, tarda en recargar y sus balas se acaban (de vez en cuando encuentra alguna en la
  // mochila). Sin balas: el hacha (Tomás) o el cuchillo (Vera)
  const ALLY_W = { tomas: ['revolver', 'hacha_bombero'], vera: ['rifle', 'pistola', 'cuchillo_caza'], diarco: ['rifle', 'pistola', 'cuchillo_caza'],
    booster: ['escopeta', 'revolver', 'tubo'], paula: ['revolver', 'pistola', 'llave'] };
  const ALLY_AMMO = { revolver: 10, rifle: 6, pistola: 8, escopeta: 6 };     // balas de reserva (además del cargador): pocas
  // Di' Arco de compañera: muchísimo más agresiva. Va a por ellos (no espera en su sitio), dispara rápido y bien,
  // recarga sin trabarse, no se pone nerviosa y remata con el cuchillo a los que se le acercan
  const ALLY_AMMO_AGR = { rifle: 9, pistola: 16 };
  const ALLY_L_AGR = {
    start: ['Que vengan. Los quiero a todos.', 'Tú vigila. Yo limpio.', 'Por fin algo de acción.'],
    hurt: ['¡Eso es todo lo que tienes?!', '¡Agh! ¡Vas a pagarlo!', '¡Quítate!'],
    low: ['Estoy tocada... ¡pero sigo!', '¡Necesito un respiro!'],
    reload: ['¡Recargo! ¡No se acerquen!', 'Cargando.'],
    kill: ['¡Siguiente!', 'Abajo.', '¡Otro más!', 'Demasiado fácil.', '¡Vengan!'],
    many: ['¡Más para mí!', '¡Por la izquierda, los tengo!', '¡Por detrás!']
  };
  const ALLY_L = {
    start: ['Aguantamos aquí. Cúbreme la espalda.', 'Vienen muchos. No te alejes.', 'Bien. Que no se me acerquen.'],
    hurt: ['¡Me tienen rodeado!', '¡Agh! ¡Ayúdame!', '¡Quítamelos de encima!', '¡Me ha mordido!'],
    low: ['¡No aguanto mucho más!', '¡Estoy muy mal!'],
    reload: ['¡Recargo!', '¡Cúbreme, recargo!'],
    kill: ['¡Uno menos!', '¡Abajo!', 'Siguiente.'],
    many: ['¡Son demasiados!', '¡Por la izquierda!', '¡Por detrás!']
  };
  // cada compañero habla a su manera (Vera piensa en voz alta, Tomás se ríe de todo, Booster es seco y de
  // trinchera, la señora Paula grita órdenes de una guerra que solo ella recuerda). Di' Arco: ALLY_L_AGR
  const ALLY_LC = {
    vera: {
      start: ['Yo cubro este lado. Tú, el otro. No dejemos huecos.', 'Entran por los pasillos: si aguantamos aquí, llegan de a uno.', 'Ahorra balas. Primero los que corren.'],
      hurt: ['¡Me alcanzó! ¡Sigo!', '¡Agh! ¡Me están cerrando por este lado!', '¡Necesito espacio!'],
      low: ['Estoy mal. Voy a retroceder un poco.', 'Si me quedo aquí, no salgo.'],
      reload: ['Recargo. Cúbreme dos segundos.', '¡Cargador!'],
      kill: ['Uno menos.', 'Abajo. Siguiente.', 'Ese ya no.'],
      many: ['Vienen en grupo. Retrocede hacia la pared.', '¡Por la izquierda, son varios!', '¡Por detrás! ¡Gira!']
    },
    tomas: {
      start: ['Qué bonito día para que me coman.', 'Tú dispara, yo me quejo. Buen reparto.', 'Si salimos de esta, invito yo. Nada, porque no hay nada.'],
      hurt: ['¡Ay! Genial. Justo lo que necesitaba.', '¡Eso me lo cobro!', '¡Que alguien me los quite, por favor y gracias!'],
      low: ['Me siento fenomenal. Mentira.', 'Creo que me falta algo de sangre.'],
      reload: ['Recargo. No se muevan, ¿eh?', 'Un momento, señores, recargo.'],
      kill: ['Descanse en paz. O no.', 'Uno menos. Quedan mil.', 'Ni lo sintió. Bueno, un poco.'],
      many: ['Ah, mira, trajeron a los primos.', '¡Por la izquierda! Cómo no.', '¡Por detrás! Clásico.']
    },
    booster: {
      start: ['Me quedo aquí. Que vengan ellos.', 'Formen detrás de mí.', 'Treinta años y siguen sin aprender.'],
      hurt: ['¡Ugh! ¡Eso no alcanza!', '¡Muérdeme otra vez y te arranco la cabeza!', '¡Aguanto!'],
      low: ['El brazo no responde... ¡sigo!', 'Necesito un minuto.'],
      reload: ['¡Cargo!', 'Cubre. Recargo.'],
      kill: ['Al suelo.', 'Quieto ahí.', 'Uno.'],
      many: ['¡Línea! ¡No retrocedan!', '¡Izquierda!', '¡Por la espalda!']
    },
    paula: {
      start: ['¡Pelotón! ¡En formación, inútiles!', 'Huelo a podrido. Será el enemigo. O será la cena.', 'Yo ya maté a estos. ¿Volvieron? Mejor.'],
      hurt: ['¡Me mordió! ¡Malditos sean tus muertos y los míos!', '¡Ay, mi cadera! ¡Fuego a discreción!', '¡Sanitario! ¡Ah, no hay!'],
      low: ['¡Estoy entera! Más o menos entera.', 'Si caigo, quémenme. Pero bien quemada.'],
      reload: ['¡Cargando! ¡Nadie se mueve hasta que diga!', '¡Munición! ¿Quién se comió la munición?'],
      kill: ['¡Baja confirmada!', 'Y no vuelvas, que te conozco.', '¡Eso por mi hermano! No tengo hermano.'],
      many: ['¡Nos flanquean, como en el setenta!', '¡Izquierda! ¡No, mi otra izquierda!', '¡Por detrás, ratas!']
    }
  };
  class Ally extends Human {
    // o (opcional): { look, name } para un aliado que no es uno de los personajes (los presos del capitolio)
    constructor(scene, x, z, charId, lifeMax, o) {
      const C = G.Player.CHARS[charId] || G.Player.CHARS.tomas;
      const look = (o && o.look) || Object.assign({}, C.opts, { npc: true, gear: {}, seed: 7 });
      super(scene, x, z, 0, 'aliado', null, { look, name: (o && o.name) || C.name, idx: 0, lv: 0 });
      this.ally = true; this.charId = charId; this.home = { x, z };
      this.agr = charId === 'diarco';
      this.lifeMax = lifeMax || 1000; this.life = this.lifeMax;
      this.vp = this.female ? 1.2 : 0.8;
      this.wl = ALLY_W[charId] || ALLY_W.tomas;
      this.mags = {};
      for (const id of this.wl) { const w = G.Weapons.get(id); if (G.Weapons.isGun(w)) this.mags[id] = w.mag; }
      this.reserve = Object.assign({}, this.agr ? ALLY_AMMO_AGR : ALLY_AMMO); this.findT = 14;
      this.roam = null; this.roamT = rr(2, 4);
      this.setW(this.wl[0]);
      this.tgt = null; this.tgtT = 0; this.lineT = {};
      const self = this;
      // lo que los infectados ven como «la protagonista» cuando van a por él
      this.proxy = {
        ally: self, stance: 'stand', prone: false, stealth: 0, noise: 0, running: false, inGrass: false, aiming: false,
        beaten: null, struggle: null, lifted: null, bossKill: null, dodging: null, dodgeAfter: 0, climbLift: 0, gun: null, action: null,
        beatCD: 0, blowKb: null, hurt: 0, healing: null, grabCD: 0, fly: null, cover: null, climb: null, blow: null, hostage: null, speedNow: 0,
        vel: { x: 0, z: 0 },
        get pos() { return self.pos; }, get lv() { return self.lv || 0; }, get facing() { return self.facing; }, get y() { return self.y; },
        get elev() { return self.elev || 0; }, get dead() { return !self.alive || self.life <= 0; }, get health() { return self.life / self.lifeMax * 100; },
        damage(d) { self.hurtBy(d); }, takePunch() {}, die() {}
      };
    }
    get engaged() { return true; }
    aware() { return true; }
    setW(id) {
      if (this.w && this.w.id === id) return;
      if (this.w && this.gunW) this.mags[this.w.id] = this.mag;
      this.w = G.Weapons.get(id);
      this.gunW = G.Weapons.isGun(this.w);
      this.gkind = this.gunW ? (this.w.anim || this.w.gun) : null;
      this._gs.kind = this.gkind;
      this.mag = this.gunW ? (this.mags[id] != null ? this.mags[id] : this.w.mag) : 0;
      this.g.reload = null; this.g.cycle = -1;
      G.Models.setWeapon(this.model, id);
    }
    line(k, prio) {
      const now = T;
      if (now - (this.lineT[k] || -99) < (k === 'hurt' ? 7 : 12)) return;
      this.lineT[k] = now;
      Voice.say(this, pick((this.agr ? ALLY_L_AGR : (ALLY_LC[this.charId] || ALLY_L))[k] || ALLY_L[k]), { prio: prio || 2 });
    }
    // balas de la reserva para recargar (las que haya)
    takeAmmo(n) { const id = this.w.id, r = this.reserve[id] || 0, k = Math.min(n, r); this.reserve[id] = r - k; return k; }
    startReload() {
      if (!this.gunW || (this.reserve[this.w.id] || 0) <= 0) return;
      Human.prototype.startReload.call(this);
      if (this.g.reload) this.g.reload.dur *= this.agr ? 1.1 : 2.5;            // (recarga despacio, nervioso: se le traba; ella no)
    }
    // ¿le queda algo con esa arma? (en el cargador o en la reserva)
    usable(id) { const w = G.Weapons.get(id); if (!G.Weapons.isGun(w)) return true; return (this.mags[id] != null ? this.mags[id] : w.mag) > 0 || (this.reserve[id] || 0) > 0; }
    // los infectados no lo matan de un golpe: le van quitando vida
    hurtBy(d) {
      if (!this.alive || this.life <= 0) return;
      this.life = Math.max(0, this.life - d);
      this.hurtT = 0.35;
      if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: 'hurt' });
      if (this.life < this.lifeMax * 0.25) this.line('low', 3); else if (Math.random() < 0.35) this.line('hurt', 3);
      if (this.life <= 0) { this.act = null; this.hp = 0; this.killedBy = 'zombie'; this.die(Math.random() < 0.5 ? 1 : -1); }
    }
    // tus balas y golpes no le hacen nada
    takeHit() { return null; }
    stun() {}
    update(dt, player, all) {
      if (this.gone) return;
      this.time += dt;
      if (!this.alive || this.rag) { Z.prototype.step.call(this, dt, this.proxy, all, null); return; }
      if (this.atkCD > 0) this.atkCD -= dt;
      if (this.hurtT > 0) this.hurtT -= dt;
      this.state = this.act ? 'melee' : 'fight';
      this.goal = null; this.moveSp = 0; this.faceYaw = null; this.wantCrouch = false;
      // a quién: el infectado más cercano a la vista (cada poco)
      this.tgtT -= dt;
      if (this.tgtT <= 0 || (this.tgt && !this.tgt.alive)) {
        this.tgtT = 0.3;
        let best = null, bd = 30;
        for (const z of all) {
          if (!z.alive || z.human || z.ally || (z.lv || 0) !== (this.lv || 0)) continue;
          const d = Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
          if (d < bd && G.World.hasLOS(this.pos.x, this.pos.z, z.pos.x, z.pos.z, this.lv)) { bd = d; best = z; }
        }
        if (best && best !== this.tgt) this.reactT = rr(this.R.react[0], this.R.react[1]);
        this.tgt = best;
      }
      const z = this.tgt;
      const d = z ? Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z) : 99;
      // el arma según la distancia
      const near = d < (this.agr ? 2.6 : (this.charId === 'vera' ? 7 : 2.4));
      if (!this.act) {
        // la que toca por distancia; si no le quedan balas, la siguiente (al final, el arma blanca)
        let order = near ? this.wl.slice(1).concat(this.wl[0]) : this.wl.slice();
        // Di' Arco: cuchillo encima, pistola a media distancia, rifle de lejos
        if (this.agr) order = near ? ['cuchillo_caza', 'pistola', 'rifle'] : (d > 12 ? ['rifle', 'pistola', 'cuchillo_caza'] : ['pistola', 'rifle', 'cuchillo_caza']);
        const id = order.find((q) => this.usable(q)) || this.wl[this.wl.length - 1];
        this.setW(id);
        if (this.gunW && this.mag <= 0 && (this.reserve[this.w.id] || 0) <= 0) this.setW(this.wl[this.wl.length - 1]);
      }
      // de vez en cuando encuentra alguna bala en la mochila
      this.findT -= dt;
      if (this.findT <= 0) { this.findT = this.agr ? rr(14, 22) : rr(28, 40); const g0 = this.wl[this.agr ? 1 : 0]; if (this.reserve[g0] != null) this.reserve[g0] += this.agr ? 2 : 1; }
      this.reactT -= dt; this.fireT -= dt;
      if (this.act) this.allyMelee(dt);
      else if (z) {
        const yaw = Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
        this.faceYaw = yaw; this.aimZ = z; this.aimZT = T;
        if (!this.gunW) {
          // hacha: se acerca un paso y golpea
          this.aiming = false;
          if (d < 2.2 && this.atkCD <= 0) this.startAllySwing();
          else if (d < (this.agr ? 6 : 3.2)) { this.goal = { x: z.pos.x, z: z.pos.z, lv: 0 }; this.moveSp = this.agr ? 4.4 : 1.6; }
        } else {
          this.aiming = !this.g.reload;
          if (this.mag <= 0 && !this.g.reload) { this.startReload(); this.line('reload', 2); }
          // con un infectado encima se pone nervioso: a veces retrocede en vez de disparar
          if (!this.agr && d < 3 && !(this.panicT > 0) && Math.random() < dt * 0.9) { this.panicT = rr(0.8, 1.5); this.line('hurt', 1); }
          const aimed = Math.abs(U.angleDiff(yaw, this.facing)) < (this.agr ? 0.22 : 0.14) && !(this.panicT > 0);
          // ella avanza hacia ellos mientras dispara (hasta unos 5 m) en vez de quedarse esperando
          if (this.agr && d > 5.5 && !this.g.reload) { this.goal = { x: z.pos.x, z: z.pos.z, lv: 0 }; this.moveSp = 2.4; }
          if (aimed && this.reactT <= 0 && this.fireT <= 0 && !this.g.reload && this.mag > 0) this.allyShoot(z, d);
        }
        if (this.panicT > 0) this.panicT = Math.max(0, this.panicT - dt);
        // demasiado cerca con un arma de fuego (o nervioso): un paso atrás
        if (this.gunW && !this.agr && (d < 1.6 || this.panicT > 0)) { const ux = (this.pos.x - z.pos.x) / (d || 1), uz = (this.pos.z - z.pos.z) / (d || 1); this.goal = { x: this.pos.x + ux * 1.5, z: this.pos.z + uz * 1.5, lv: 0 }; this.moveSp = 2.2; }
      }
      // se mueve: cada pocos segundos cambia de sitio dentro de la zona que defiende (mientras, no dispara);
      // al recargar, se aparta del infectado más cercano
      this.roamT -= dt;
      if (!this.act && z && !this.agr && (this.roamT <= 0 || this.roam)) {
        if (!this.roam) {
          this.roamT = rr(2.5, 5);
          for (let k = 0; k < 8; k++) {
            const a = Math.random() * Math.PI * 2, r = rr(2, 7);
            const x = this.home.x + Math.sin(a) * r, zz = this.home.z + Math.cos(a) * r;
            if (!G.World.circleBlocked(x, zz, 0.4, 0) && Math.hypot(x - z.pos.x, zz - z.pos.z) > 2.5) { this.roam = { x, z: zz, lv: 0, t: 2.5 }; break; }
          }
        }
        if (this.roam) {
          this.roam.t -= dt;
          if (this.roam.t <= 0 || Math.hypot(this.roam.x - this.pos.x, this.roam.z - this.pos.z) < 0.5) this.roam = null;
          else { this.goal = this.roam; this.moveSp = 2.6; this.aiming = false; }
        }
      }
      if (this.g.reload && z && d < (this.agr ? 2.5 : 5) && !this.roam) { const ux = (this.pos.x - z.pos.x) / (d || 1), uz = (this.pos.z - z.pos.z) / (d || 1); this.goal = { x: this.pos.x + ux * 1.5, z: this.pos.z + uz * 1.5, lv: 0 }; this.moveSp = 2.4; }
      if (!z) {
        this.aiming = false;
        // sin nadie a la vista: vuelve a su sitio, recarga y mira hacia donde estás tú
        if (this.gunW && this.mag < this.w.mag && !this.g.reload) this.startReload();
        const hd = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
        if (hd > 1.2) { this.goal = { x: this.home.x, z: this.home.z, lv: 0 }; this.moveSp = 2.4; }
        else this.faceYaw = this.facing + 0.4 * dt;
      }
      this.updateGun(dt);
      let moved = 0;
      if (this.goal && this.moveSp > 0) moved = this.moveTo(this.goal, this.moveSp, dt);
      else if (this.faceYaw != null) this.facing = U.turnToward(this.facing, this.faceYaw, 9 * dt);
      this.speedNow += (moved - this.speedNow) * Math.min(1, dt * 10);
      this.anim(dt);
      if (z) {
        const want = Math.atan2((this.y + 1.45) - (z.y + 1.2), Math.max(1, d));
        this.aimPitch += (want - this.aimPitch) * Math.min(1, dt * 8);
      }
      this.apply(dt);
    }
    allyShoot(z, d) {
      const w = this.w, g = this.g;
      this.mag--; this.kick();
      this.fireT = this.agr ? w.fire * 1.1 + rr(0.15, 0.45) + (w.gun === 'rifle' ? 0.5 : 0)      // (ella, sin parar)
        : w.fire * 2.4 + rr(0.7, 1.4) + (w.gun === 'rifle' ? 1.3 : 0);        // (dispara sin prisa)
      const mz = this.muzzle(_v).clone();
      const tgt = new THREE.Vector3(z.pos.x, z.y + 1.3, z.pos.z);
      const sfx = { pistol: 'pistol', revolver: 'pistol', rifle: 'rifle' }[w.gun] || 'pistol';
      if (G.Audio) G.Audio.play(sfx, { x: this.pos.x, z: this.pos.z, lv: this.lv });
      Humans.flash(mz, 1);
      emitSelf(this.pos.x, this.pos.z, w.noise || 25, this.lv);
      const hitP = (this.agr ? (w.gun === 'rifle' ? 0.72 : 0.6) : (w.gun === 'rifle' ? 0.46 : 0.36)) * U.clamp(1.15 - d / 22, 0.3, 1);        // (falla bastante; ella, poco)
      if (Math.random() < hitP) {
        Humans.tracer(mz, tgt);
        const head = Math.random() < (w.gun === 'rifle' ? 0.15 : 0.07) * (this.agr ? 2 : 1);
        const dmg = rr(w.dmg[0], w.dmg[1]) * (head ? 3 : 1) * (this.agr ? 0.8 : 0.45);
        const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z;
        const r = z.takeHit(dmg, (w.knock || 0.1) + 0.2, dx, dz, false, Math.random() < 0.5 ? 1 : -1, 'shot', head ? 'head' : 'body', { w: w.gun, dist: d, n: 1 });
        if (G.Guns && G.Guns.burst) G.Guns.burst(tgt, new THREE.Vector3(dx, 0, dz).normalize(), true, 6);
        if (r === 'kill') { z.killedBy = 'ally'; if (Math.random() < 0.3) this.line('kill', 1); }
      } else this.missFx(mz, tgt, Humans.player || this.proxy);
    }
    startAllySwing() {
      const kinds = ['swing2', 'overhead', 'swing2b'];
      this.atkN = ((this.atkN || 0) + 1) % kinds.length;
      this.act = { kind: kinds[this.atkN], t: 0, dur: this.agr ? 0.6 : 0.95, impact: G.Combat && G.Combat.impactFor ? G.Combat.impactFor(kinds[this.atkN]) : 0.5, hit: false, tgt: this.tgt };
      if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: 'heavy', delay: 0.25 });
    }
    allyMelee(dt) {
      const a = this.act, z = a.tgt;
      a.t += dt / a.dur;
      if (z && a.t < a.impact) this.faceYaw = Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
      if (!a.wh && a.t >= a.impact - 0.12) { a.wh = true; if (G.Audio) G.Audio.play('whoosh', { w: 0.95, x: this.pos.x, z: this.pos.z, lv: this.lv }); }
      if (!a.hit && a.t >= a.impact) {
        a.hit = true;
        // le da a todo lo que tiene delante (hasta dos)
        let n = 0;
        for (const q of (G.Population ? G.Population.list : [])) {
          if (n >= 2 || !q.alive || q.human || (q.lv || 0) !== (this.lv || 0)) continue;
          const dx = q.pos.x - this.pos.x, dz = q.pos.z - this.pos.z, dd = Math.hypot(dx, dz);
          if (dd > 2.1 || Math.abs(U.angleDiff(Math.atan2(dx, dz), this.facing)) > 0.9) continue;
          const r = q.takeHit((this.w.cat === 'sblade' ? rr(0.5, 0.8) : rr(1.0, 1.5)) * (this.agr ? 2.2 : 1), 0.6, dx, dz, false, 1, this.w.cat === 'sblade' ? 'stab' : 'heavy', 'body');
          if (r === 'kill') q.killedBy = 'ally';
          if (G.Audio) G.Audio.play('hitBlade', { x: q.pos.x, z: q.pos.z, lv: q.lv, heavy: true });
          n++;
        }
      }
      if (a.t >= 1) { this.act = null; this.atkCD = this.agr ? rr(0.1, 0.25) : rr(0.3, 0.6); }
    }
  }
  // lo que hace un infectado cuando va a por el compañero (en vez de los agarres y forcejeos de la protagonista)
  const AllyCombat = {
    zombieStrike(z, p, dist) { if (p.dead || dist > 1.5) return false; p.damage(z.blind ? 18 : 11); return false; },
    zombiePunch(z, p, dist, step) {
      if (p.dead) return 'miss';
      if (dist > (step === 'run' ? 1.9 : (z.temb ? 2.15 : 1.5))) return 'miss';
      p.damage((step === 2 ? 12 : 7) * (z.temb ? 1.6 : 1) * (z.blind ? 1.5 : 1));
      return 'hit';
    },
    startStruggle(p, z) { if (!p.dead) p.damage(14); },
    tembTackle(z, p) { if (!p.dead) p.damage(22); },
    blindSlam(z, p) { if (!p.dead) p.damage(18); }
  };

  const Humans = {
    ROLES, ORDER, Human, Squad, Ally, AllyCombat, Voice, squads, lookFor, onMessage: null, player: null, voices: true,
    mixed: false, onMixNoise: null,          // (la huida: los escorpiones también pelean contra los infectados)
    foes: [],                                // (presos liberados: los escorpiones van a por ellos; ver G.Rescue)
    get time() { return T; },

    init(sc) { scene = sc; Voice.init(); try { const v = localStorage.getItem('ceniza.voces'); if (v != null) this.voices = v !== '0'; } catch (e) { /* nada */ } },
    setVoices(on) { this.voices = !!on; try { localStorage.setItem('ceniza.voces', on ? '1' : '0'); } catch (e) { /* nada */ } if (!on) { try { window.speechSynthesis.cancel(); } catch (e) { /* nada */ } } },

    tracer(a, b) { if (G.Guns && G.Guns.tracer) G.Guns.tracer(a, b); },
    flash(p, size) {
      if (!G.Guns || !G.Guns.npcFlash) return;
      G.Guns.npcFlash(p, size);
    },
    // daño a la protagonista: vida, sacudida, reacción del cuerpo (los golpes fuertes la echan atrás)
    hurtPlayer(player, h, dmg, heavy, push) {
      if (player.dead || player.bossKill) return;
      const cause = h.R.melee ? (h.role === 'sigilo' ? h.name + ' te apuñaló.' : h.name + ' te mató a golpes.') : (h.role === 'arquero' ? h.name + ' te atravesó con una flecha.' : h.name + ' te mató a tiros.');
      player.damage(dmg, cause);
      if (G.Combat && G.Combat.stats) G.Combat.stats.hurt += dmg;
      const dx = player.pos.x - h.pos.x, dz = player.pos.z - h.pos.z;
      const side = U.angleDiff(Math.atan2(-dx, -dz), player.facing) > 0 ? 1 : -1;
      if (G.Camera.hurtFx) G.Camera.hurtFx(heavy ? 1 : 0.5, side);
      if (!player.dead && heavy && player.takePunch && !player.hostage) player.takePunch(h, 'heavy', 0, push || 2.4);
      else if (!player.dead && heavy && player.hostage) player.hurt = 0.5;
      if (G.Audio) G.Audio.play('hitFlesh', { vol: 0.8 });
      // con un rehén: un golpe fuerte puede hacer que se te escape
      const H = player.hostage;
      if (H && H.h && H.h.alive && Math.random() < (heavy ? 0.55 : 0.2)) Humans.hostageBreak(player);
      if (player.health <= 0 && !player.dead) player.die(cause);
    },
    // flecha de la arquera
    arrow(h, p, v) {
      if (!scene) return;
      if (!this.arrowMat) this.arrowMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(G.Models.weaponGeometry('flecha'), this.arrowMat);
      mesh.position.copy(p);
      scene.add(mesh);
      proj.push({ kind: 'arrow', h, mesh, p: p.clone(), v: v.clone(), life: 0, lv: h.lv || 0 });
    },
    // bote de humo del líder (parábola hasta el punto elegido)
    grenade(h, p, tx, tz) {
      if (!scene) return;
      const W = G.World;
      const ty = W.groundY(tx, tz, h.lv || 0);
      const d = Math.hypot(tx - p.x, tz - p.z), Tf = U.clamp(d / 13, 0.45, 1.4);
      const v = new THREE.Vector3((tx - p.x) / Tf, (ty - p.y) / Tf + 0.5 * 9.8 * Tf, (tz - p.z) / Tf);
      const mesh = new THREE.Mesh(G.Models.weaponGeometry('humo'), this.arrowMat || (this.arrowMat = new THREE.MeshLambertMaterial({ vertexColors: true })));
      mesh.position.copy(p);
      scene.add(mesh);
      proj.push({ kind: 'smoke', h, mesh, p: p.clone(), v, life: 0, lv: h.lv || 0, spin: new THREE.Vector3(rr(5, 9), rr(1, 3), rr(2, 5)) });
    },
    smokeAt(x, z, lv) {
      const r = 3.6;
      smokes.push({ x, z, r, t: 0, T: 9 });
      // la nube de verdad (la misma que la bomba de humo de la protagonista, pero a ellos no los aturde)
      if (G.Spores) G.Spores.burst(x, G.World.groundY(x, z, lv), z, lv, r, null, this.player, false, false, true, { cover: true });
    },
    updateProj(dt, player) {
      const W = G.World;
      for (let i = proj.length - 1; i >= 0; i--) {
        const a = proj[i];
        a.life += dt;
        const p0 = a.p.clone();
        a.v.y -= 9.8 * dt;
        a.p.addScaledVector(a.v, dt);
        let done = false;
        if (a.kind === 'smoke') {
          a.mesh.position.copy(a.p);
          a.mesh.rotation.x += a.spin.x * dt; a.mesh.rotation.z += a.spin.z * dt;
          const gy = W.groundY(a.p.x, a.p.z, a.lv);
          const wall = W.lineHit(p0.x, p0.z, a.p.x, a.p.z, W.blocksSightEdge, a.lv) >= 0;
          if (wall) { a.v.x *= -0.3; a.v.z *= -0.3; a.p.x = p0.x; a.p.z = p0.z; }
          if (a.p.y <= gy + 0.05 || a.life > 3) { this.smokeAt(a.p.x, a.p.z, a.lv); done = true; }
        } else {
          // flecha: la protagonista (o el rehén que tiene delante), una pared o el suelo
          const seg = a.p.clone().sub(p0), L1 = seg.length() || 1e-4;
          const d = seg.clone().divideScalar(L1);
          const tWall = (() => { const f = W.lineHit(p0.x, p0.z, a.p.x, a.p.z, W.blocksSightEdge, a.lv); return f >= 0 ? f * L1 : Infinity; })();
          const gy = W.groundY(a.p.x, a.p.z, a.lv);
          const tGround = a.p.y < gy ? L1 * (p0.y - gy) / Math.max(1e-4, p0.y - a.p.y) : Infinity;
          // cerca de la protagonista: ¿pasa por su cuerpo?
          let tHit = Infinity, who = null;
          const test = (x, z, y0, y1, r, w) => {
            const vx = a.p.x - p0.x, vz = a.p.z - p0.z, l2 = vx * vx + vz * vz || 1e-6;
            const k = U.clamp(((x - p0.x) * vx + (z - p0.z) * vz) / l2, 0, 1);
            const cx = p0.x + vx * k, cz = p0.z + vz * k, cy = p0.y + (a.p.y - p0.y) * k;
            if (Math.hypot(cx - x, cz - z) < r && cy > y0 && cy < y1 && k * L1 < tHit) { tHit = k * L1; who = w; }
          };
          if (!player.dead && (player.lv || 0) === a.lv) test(player.pos.x, player.pos.z, player.y + 0.1, player.y + (player.stance === 'crouch' ? 1.2 : 1.7), 0.32, player);
          const H = player.hostage && player.hostage.h;
          if (H && H.alive) test(H.pos.x, H.pos.z, H.y + 0.1, H.y + 1.75, 0.3, H);
          if (who && tHit < tWall && tHit < tGround) {
            a.p.copy(p0).addScaledVector(d, tHit);
            if (who === player) {
              const dodged = (player.dodging && player.dodging.t < 0.85) || player.dodgeAfter > 0;
              if (!dodged) { Humans.hurtPlayer(player, a.h, a.h.R.dmg * rr(0.9, 1.1), true, 1.6); if (G.Guns && G.Guns.burst) G.Guns.burst(a.p, d, true, 6); done = true; }
            } else {
              const r = who.takeHit(a.h.R.dmg * 0.4, 0.15, d.x, d.z, false, 1, 'shot', 'body', { w: 'bow' });
              if (r === 'kill') { who.killedBy = 'friendly'; if (a.h.squad) a.h.squad.onFriendlyKill(a.h, who); }
              if (G.Guns && G.Guns.burst) G.Guns.burst(a.p, d, true, 5);
              done = true;
            }
            if (done && G.Audio) G.Audio.play('arrowHit', { x: a.p.x, z: a.p.z, lv: a.lv, flesh: true });
          }
          if (!done && (tWall < Infinity || tGround < Infinity)) {
            const t = Math.min(tWall, tGround);
            a.p.copy(p0).addScaledVector(d, Math.max(0, t - 0.05));
            if (G.Guns && G.Guns.burst) G.Guns.burst(a.p, d, false, 2);
            if (G.Audio) G.Audio.play('arrowHit', { x: a.p.x, z: a.p.z, lv: a.lv });
            if (Math.random() < 0.5 && W.dropItem) W.dropItem(a.p.x - d.x * 0.3, a.p.z - d.z * 0.3, 'mun_flecha', 1, a.lv);
            done = true;
          }
          if (!done && a.life > 4) done = true;
          if (!done) {
            // silba al pasar cerca
            if (!a.whiz && Math.hypot(a.p.x - player.pos.x, a.p.z - player.pos.z) < 2.5) { a.whiz = true; if (G.Audio) G.Audio.play('whiz', { vol: 0.6 }); }
            _tA.copy(a.v).normalize();
            a.mesh.position.copy(a.p).addScaledVector(_tA, -0.62);
            a.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _tA);
          }
        }
        if (done) { if (a.mesh.parent) a.mesh.parent.remove(a.mesh); proj.splice(i, 1); }
      }
      for (let i = smokes.length - 1; i >= 0; i--) { smokes[i].t += dt; if (smokes[i].t > smokes[i].T + 1) smokes.splice(i, 1); }
    },

    // ---------- Sacar un escuadrón ----------
    // o: { roles, at: {x, z}, zone, active, diff, entry }
    spawnSquad(o) {
      o = o || {};
      const W = G.World;
      const zone = o.zone || { x0: W.ARENA_MIN, z0: W.ARENA_MIN, x1: W.ARENA_MAX, z1: W.ARENA_MAX };
      const sq = new Squad({ zone, active: false, diff: o.diff, entry: o.at });
      const roles = o.roles || ORDER.slice();
      const at = o.at || sq.center();
      const used = {};
      roles.forEach((role, i) => {
        const pool = NAMES[role].filter((n) => !used[n[0]]);
        const nm = pick(pool.length ? pool : NAMES[role]);
        used[nm[0]] = 1;
        // repartidos alrededor del punto de entrada (separados unos 3 a 5 m, no en un corro apretado)
        let p = null;
        for (let k = 0; k < 18 && !p; k++) {
          const a = i * 2.39996 + k * 0.6, r = i === 0 && k === 0 ? 0 : (k < 12 ? 2.8 + Math.sqrt(i) * 1.1 + Math.random() * 1.4 : 1.1 + (k - 12) * 0.3);
          const x = at.x + Math.sin(a) * r, z = at.z + Math.cos(a) * r;
          // (y sin pisar a otro del grupo: al menos 1,8 m entre ellos)
          if (!W.circleBlocked(x, z, 0.4, 0) && !sq.members.some((q) => Math.hypot(q.pos.x - x, q.pos.z - z) < 1.8)) p = { x, z };
        }
        p = p || { x: at.x, z: at.z };
        const look = prepLook(role, nm[1]);
        const h = new Human(scene, p.x, p.z, o.face != null ? o.face : Math.random() * TAU, role, sq, { look, name: nm[0], idx: i, lv: 0, hpMul: o.hpMul });
        sq.members.push(h);
        if (role === 'lider') sq._leader = h;
        G.Population.list.push(h);
      });
      if (!sq._leader) sq._leader = sq.members[0];
      if (o.noRetreat) sq.noRetreat = true;
      if (o.noBeg) sq.noBeg = true;
      if (o.guard) sq.guard = o.guard;
      sq.makeAff();
      squads.push(sq);
      if (o.active !== false) sq.begin();
      return sq;
    },

    // prepara (en la carga) los cuerpos de los que saldrán: una lista de papeles; el sexo, al azar como el nombre
    prepare(roles) {
      const P = G.Zombie.pool;
      if (!P) return;
      const want = {};
      for (const role of roles) {
        const nm = pick(NAMES[role]);
        const k = prepKey(role, nm[1]);
        want[k] = (want[k] || 0) + 1;
        if ((PREP[k] ? PREP[k].length : 0) + P.jobs.filter((j) => j.k === k).length < Math.min(4, want[k])) {
          const job = () => prepOne(role, nm[1]); job.k = k; P.jobs.push(job);
        }
      }
    },

    // refuerzos: uno más a un escuadrón que ya está en el mapa (la caza contra los escorpiones)
    reinforce(sq, role, at, face) {
      const W = G.World, used = {};
      for (const m of sq.members) used[m.name] = 1;
      const pool = NAMES[role].filter((n) => !used[n[0]]);
      const nm = pick(pool.length ? pool : NAMES[role]);
      let p = null;
      for (let k = 0; k < 14 && !p; k++) {
        const a = Math.random() * TAU, r = k * 0.3;
        const x = at.x + Math.sin(a) * r, z = at.z + Math.cos(a) * r;
        if (!W.circleBlocked(x, z, 0.4, 0)) p = { x, z };
      }
      p = p || at;
      const h = new Human(scene, p.x, p.z, face != null ? face : Math.random() * TAU, role, sq, { look: prepLook(role, nm[1]), name: nm[0] + (used[nm[0]] ? ' ' + (sq.members.length + 1) : ''), idx: sq.members.length, lv: 0 });
      sq.members.push(h);
      sq.makeAff();
      G.Population.list.push(h);
      h.enter('fight', 0);
      return h;
    },

    update(dt, player) {
      this.player = player;
      T += dt;
      for (let i = timers.length - 1; i >= 0; i--) if (T >= timers[i].t) { const f = timers[i].fn; timers.splice(i, 1); try { f(); } catch (e) { /* nada */ } }
      for (let i = squads.length - 1; i >= 0; i--) squads[i].update(dt, player);
      // ¿a quién apuntas? (para que esquiven)
      const C = G.Camera, f = C && C.forward ? C.forward() : null;
      for (const s of squads) for (const h of s.members) {
        h.aimedAt = false;
        if (!f || !h.alive || h.gone || !player.aiming || !G.Weapons.isGun(player.weapon)) continue;
        const vx = h.pos.x - player.pos.x, vz = h.pos.z - player.pos.z, d = Math.hypot(vx, vz);
        if (d < 1 || d > 16) continue;
        const fl = Math.hypot(f.x, f.z) || 1;
        if (Math.acos(U.clamp((vx * f.x + vz * f.z) / (d * fl), -1, 1)) < 0.09 + 0.6 / d) h.aimedAt = true;
      }
      this.updateProj(dt, player);
      Voice.update(dt, player);
    },
    reset() {
      Voice.clear();
      for (const a of proj) if (a.mesh.parent) a.mesh.parent.remove(a.mesh);
      proj.length = 0; smokes.length = 0; squads.length = 0; timers.length = 0; this.foes.length = 0;
      if (this.player) this.player.hostage = null;
    },
    after(sec, fn) { timers.push({ t: T + sec, fn }); },
    get active() { return squads.some((s) => !s.done); },
    members() { const out = []; for (const s of squads) for (const m of s.members) out.push(m); return out; },

    // ---------- La protagonista ----------
    // disparo de la protagonista: los que tienen la bala cerca se cubren (y se enteran de dónde estás)
    onPlayerShot(player, o, d, range) {
      for (const s of squads) for (const h of s.members) {
        if (!h.alive || h.gone) continue;
        const vx = h.pos.x - o.x, vz = h.pos.z - o.z;
        const k = vx * d.x + vz * d.z;
        if (k < 0 || k > range) continue;
        const px = o.x + d.x * k, pz = o.z + d.z * k;
        if (Math.hypot(px - h.pos.x, pz - h.pos.z) < 1.8) { h.suppressed = 1.6; if (s.active && s.mode !== 'combat') s.know(player, false, null); }
      }
    },
    // clic de un arma sin balas: los que están cerca lo oyen y se avisan
    dryFire(player) {
      for (const s of squads) {
        if (s.done) continue;
        let heard = null, bd = 1e9;
        for (const h of s.members) {
          if (!h.alive || h.gone || h.state === 'beg' || h.state === 'flee') continue;
          const d = Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z);
          if (h.state === 'hostage') { if (!h.dryHeard) { h.dryHeard = true; this.hostageBreak(player, true); } continue; }
          if (d < 14 && (d < 8 || G.World.hasLOS(h.pos.x, h.pos.z, player.pos.x, player.pos.z, h.lv)) && d < bd) { bd = d; heard = h; }
        }
        if (!heard || T - (s.dryT || -99) < 4) continue;
        s.dryT = T;
        heard.say('dry', null, { prio: 4 });
        s.pushT = 8;                      // todos se echan encima unos segundos
        s.know(player, false, null);
        for (const h of s.members) if (h.alive && h.state === 'fight') { h.tac = 'peek'; h.tacT = 4; h.spot = null; h.reactT = 0; h.enraged = Math.max(h.enraged || 0, 5); }
        const L0 = s.leader;
        if (L0 && L0 !== heard) L0.say('dryPush', null, { prio: 3, after: 1.2 });
      }
    },
    // te ven recargar de cerca
    playerReload(player) {
      for (const s of squads) {
        if (s.done || s.mode !== 'combat' || T - (s.rlT || -99) < 8) continue;
        const h = s.alive().find((m) => m.seesP && Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z) < 15);
        if (h && Math.random() < 0.5) { s.rlT = T; h.say('reloadHeard', null, { prio: 3 }); s.pushT = 4; }
      }
    },

    // ---------- Rehén ----------
    // arma corta para tomar un rehén (la pistola o el revólver que lleves)
    shortGunSlot(player) {
      for (const i of [player.cur, 1, 4]) {
        const s = i > 0 ? player.hands[i] : null;
        if (s && G.Weapons.isGun(G.Weapons.get(s.id)) && G.Weapons.isShort(G.Weapons.get(s.id))) return i;
      }
      return -1;
    },
    // a quién se puede tomar de rehén: de espaldas y desprevenido, o rendido o aturdido delante de ti
    hostageTarget(player) {
      if (player.dead || player.hostage || player.busy() || player.struggle || player.stance === 'prone' || this.shortGunSlot(player) < 0) return null;
      let best = null, bd = 1.5;
      for (const s of squads) for (const h of s.members) {
        if (!h.alive || h.gone || (h.lv || 0) !== (player.lv || 0)) continue;
        const ok = h.state === 'beg' || h.state === 'stun' || h.grabOk;
        if (!ok) continue;
        const d = Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z);
        if (d > bd) continue;
        if (h.state !== 'beg' && h.state !== 'stun' && !G.Combat.behind(player, h)) continue;
        if (!G.World.hasLOS(player.pos.x, player.pos.z, h.pos.x, h.pos.z, player.lv)) continue;
        best = h; bd = d;
      }
      return best;
    },
    takeHostage(player, h) {
      if (!h || !h.alive) return null;
      const gi = this.shortGunSlot(player);
      if (gi < 0) return 'Necesitas una pistola o un revólver';
      if (player.cur !== gi) player.equip(gi);
      player.hostage = { h, t: 0 };
      if (G.Mode && G.Mode.humanEvent) G.Mode.humanEvent('hostage');
      player.stance = 'stand';
      h.act = null; h.dodge = null; h.g.reload = null; h.aiming = false; h.drawing = false; h.npcK = 0;
      h.enter('hostage', 0);
      h.say('hostage', null, { prio: 4 });
      emitSelf(player.pos.x, player.pos.z, 12, player.lv);
      if (h.squad) h.squad.onHostage(h, player);
      if (G.Audio) G.Audio.play('hitPunch', { x: h.pos.x, z: h.pos.z, lv: h.lv, vol: 0.5 });
      return 'Tienes a ' + h.name + ' de rehén · Apunta para disparar a los demás · Atacar: ejecutarlo · ' + (G.Input && G.Input.isTouch ? 'Soltar' : 'E: soltarlo');
    },
    // lo sueltas de un empujón
    releaseHostage(player) {
      const H = player.hostage;
      if (!H) return null;
      const h = H.h;
      player.hostage = null;
      h.freeHostage(player, true);
      if (h.squad) { h.squad.onHostageEnd(); h.say('released', null, { prio: 2, after: 0.8 }); }
      return 'Soltaste a ' + h.name;
    },
    // se te escapa (te da un codazo)
    hostageBreak(player, dry) {
      const H = player.hostage;
      if (!H || !H.h.alive) return;
      const h = H.h;
      player.hostage = null;
      h.say('breakFree', null, { prio: 4 });
      if (player.takePunch) player.takePunch(h, 'side', 1, 2.2);
      player.damage(6, h.name + ' te mató.');
      h.freeHostage(player, false);
      h.spared = false;
      const dx = h.pos.x - player.pos.x, dz = h.pos.z - player.pos.z;
      h.doStagger(dx, dz, 2.4);
      if (h.squad) h.squad.onHostageEnd();
      msg(dry ? '¡Oyó el clic y se te escapó!' : '¡Se te escapó el rehén!', 'bad');
    },
    // ejecutarlo: un tiro en la cabeza (si queda bala; si no, clic... y se escapa)
    executeHostage(player) {
      const H = player.hostage;
      if (!H) return;
      const h = H.h, s = player.slot, w = player.weapon;
      if (!s || !G.Weapons.isGun(w)) { this.releaseHostage(player); return; }
      if (s.mag <= 0) { if (G.Audio) G.Audio.play('dry'); this.dryFire(player); return; }
      s.mag--;
      if (G.Audio) G.Audio.shot(w.gun, !!s.sil || !!w.silenced);
      G.World.emit(player.pos.x, player.pos.z, w.noise * (s.sil ? 0.22 : 1), player.lv);
      player.gun.recoil = 1;
      if (G.Combat && G.Combat.bloodAt) G.Combat.bloodAt(h, 14);
      player.hostage = null;
      h.npcK = 0;
      h.hp = 0; h.killedBy = 'exec';
      h.state = 'idle';
      h.die(-1);
      if (G.Mode && G.Mode.humanEvent) G.Mode.humanEvent('exec');
      if (G.Mode && G.Mode.stats) { G.Mode.stats.exec++; G.Mode.stats.shots++; G.Mode.stats.hits++; }
      if (G.Combat.onHit) G.Combat.onHit('kill', true);
    },
    // entrada mientras tienes un rehén: apuntar y disparar a otros (con la pistola), Atacar sin apuntar lo
    // ejecuta, esquivar lo empuja lejos. Devuelve true si se encargó de la entrada
    hostageInput(player, input, zombies) {
      const H = player.hostage;
      if (!H) return false;
      if (!H.h.alive || H.h.state !== 'hostage') { player.hostage = null; return false; }
      if (input.dodge) { const m = this.releaseHostage(player); if (m) msg(m); return true; }
      if (input.reload) { msg('Con un rehén no puedes recargar', 'warn'); return true; }
      if (input.attack && !player.aiming) { this.executeHostage(player); return true; }
      if (input.attack && player.aiming && G.Guns) { if (!(player.gun.cooldown > 0)) G.Guns.tryFire(player, zombies); return true; }
      return true;
    },

    // ---------- Botones de interacción ----------
    // 'door' (E): tomar de rehén / soltarlo · 'loot' (T): dejar ir al que se rinde
    interactFind(player, mode) {
      if (player.hostage) return mode === 'door' ? { kind: 'release', label: 'Soltar al rehén' } : null;
      if (mode === 'door') {
        const h = this.hostageTarget(player);
        return h ? { kind: 'hostage', label: 'Tomar de rehén', h, x: h.pos.x, z: h.pos.z } : null;
      }
      if (mode === 'loot') {
        for (const s of squads) for (const h of s.members) {
          if (!h.alive || h.state !== 'beg' || (h.lv || 0) !== (player.lv || 0)) continue;
          if (Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z) < 2.6) return { kind: 'spare', label: 'Dejar ir a ' + h.name, h, x: h.pos.x, z: h.pos.z };
        }
      }
      return null;
    },
    interactUse(t, player) {
      if (t.kind === 'release') return this.releaseHostage(player);
      if (t.kind === 'hostage') return this.takeHostage(player, t.h);
      if (t.kind === 'spare') return t.h.spare(player);
      return null;
    }
  };

  G.Humans = Humans;
})(window.Game = window.Game || {});
