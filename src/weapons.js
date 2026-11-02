(function (G) {
  'use strict';

  // Armas cuerpo a cuerpo, de fuego y arco. Categorías cuerpo a cuerpo como en el original:
  //   lblunt  contundente larga (dos manos)    sblunt  contundente corta (una mano)
  //   axe     hacha                            lblade  hoja larga
  //   sblade  hoja corta (cuchillos)           spear   lanza
  //
  // range: alcance en metros · dmg: daño mínimo y máximo (un zombi tiene de 2.4 a 3.4 de vida)
  // speed: segundos por golpe · crit: probabilidad y multiplicador de crítico
  // hits: zombis que puede golpear de una vez · knock: probabilidad de derribar
  // stam: (sin uso: ya no hay resistencia) · cond: golpes que aguanta antes de romperse (cada golpe
  // que acierta gasta uno, como en los juegos de referencia) · lower: 1 (todos los golpes gastan)

  const LIST = [
    // (las de largo alcance aguantan como mucho un combo: 3 o 4 golpes)
    { id: 'bate', name: 'Bate de béisbol', cat: 'lblunt', hands: 2, range: 1.3, dmg: [0.8, 1.3], speed: 0.85, crit: [0.2, 2], hits: 2, knock: 0.35, stam: 0.05, cond: 4, lower: 1, len: 0.86 },
    { id: 'bate_clavos', name: 'Bate con clavos', cat: 'lblunt', hands: 2, range: 1.3, dmg: [1.0, 1.6], speed: 0.9, crit: [0.25, 2], hits: 2, knock: 0.3, stam: 0.055, cond: 3, lower: 1, len: 0.86 },
    { id: 'golf', name: 'Palo de golf', cat: 'lblunt', hands: 2, range: 1.4, dmg: [0.5, 0.9], speed: 0.75, crit: [0.15, 2], hits: 2, knock: 0.2, stam: 0.04, cond: 3, lower: 1, len: 1.0 },
    { id: 'mazo', name: 'Mazo', cat: 'lblunt', hands: 2, range: 1.25, dmg: [2.0, 3.4], speed: 1.6, crit: [0.1, 2], hits: 3, knock: 0.9, stam: 0.12, cond: 4, lower: 1, len: 0.9 },
    { id: 'pala', name: 'Pala', cat: 'lblunt', hands: 2, range: 1.45, dmg: [0.8, 1.4], speed: 1.0, crit: [0.15, 2], hits: 2, knock: 0.4, stam: 0.07, cond: 4, lower: 1, len: 1.15 },
    { id: 'tabla', name: 'Tabla de madera', cat: 'lblunt', hands: 2, range: 1.35, dmg: [0.5, 0.9], speed: 0.8, crit: [0.1, 2], hits: 2, knock: 0.25, stam: 0.05, cond: 3, lower: 1, len: 1.0 },
    { id: 'tabla_clavos', name: 'Tabla con clavos', cat: 'lblunt', hands: 2, range: 1.35, dmg: [0.7, 1.2], speed: 0.85, crit: [0.15, 2], hits: 2, knock: 0.25, stam: 0.05, cond: 3, lower: 1, len: 1.0 },
    { id: 'palanca', name: 'Palanca', cat: 'sblunt', hands: 1, range: 1.1, dmg: [0.7, 1.1], speed: 0.7, crit: [0.2, 2], hits: 1, knock: 0.2, stam: 0.04, cond: 4, lower: 1, len: 0.75 },
    { id: 'martillo', name: 'Martillo', cat: 'sblunt', hands: 1, range: 0.95, dmg: [0.6, 1.0], speed: 0.65, crit: [0.25, 2], hits: 1, knock: 0.15, stam: 0.035, cond: 10, lower: 1, len: 0.35 },
    { id: 'llave', name: 'Llave inglesa', cat: 'sblunt', hands: 1, range: 0.95, dmg: [0.6, 1.0], speed: 0.7, crit: [0.2, 2], hits: 1, knock: 0.15, stam: 0.035, cond: 10, lower: 1, len: 0.36 },
    { id: 'sarten', name: 'Sartén', cat: 'sblunt', hands: 1, range: 0.95, dmg: [0.6, 1.0], speed: 0.8, crit: [0.15, 2], hits: 1, knock: 0.3, stam: 0.045, cond: 8, lower: 1, len: 0.46 },
    { id: 'tubo', name: 'Tubo de plomo', cat: 'sblunt', hands: 1, range: 1.1, dmg: [0.7, 1.2], speed: 0.75, crit: [0.2, 2], hits: 1, knock: 0.2, stam: 0.045, cond: 11, lower: 1, len: 0.62 },
    { id: 'rodillo', name: 'Rodillo de cocina', cat: 'sblunt', hands: 1, range: 0.9, dmg: [0.4, 0.7], speed: 0.6, crit: [0.15, 2], hits: 1, knock: 0.15, stam: 0.03, cond: 5, lower: 1, len: 0.44 },
    { id: 'porra', name: 'Porra policial', cat: 'sblunt', hands: 1, range: 1.05, dmg: [0.6, 1.0], speed: 0.6, crit: [0.2, 2], hits: 1, knock: 0.3, stam: 0.035, cond: 10, lower: 1, len: 0.6 },
    { id: 'hacha_bombero', name: 'Hacha de bombero', cat: 'axe', hands: 2, range: 1.3, dmg: [2.7, 3.6], speed: 1.1, crit: [0.3, 3], hits: 3, knock: 0.5, stam: 0.09, cond: 4, lower: 1, len: 0.92 },
    { id: 'hacha_mano', name: 'Hacha de mano', cat: 'axe', hands: 1, range: 0.95, dmg: [1.0, 1.6], speed: 0.8, crit: [0.25, 2.5], hits: 1, knock: 0.2, stam: 0.05, cond: 9, lower: 1, len: 0.32 },
    { id: 'machete', name: 'Machete', cat: 'lblade', hands: 1, range: 1.2, dmg: [1.0, 1.6], speed: 0.7, crit: [0.3, 2.5], hits: 2, knock: 0.15, stam: 0.045, cond: 9, lower: 1, len: 0.66 },
    { id: 'katana', name: 'Katana', cat: 'lblade', hands: 2, range: 1.35, dmg: [1.6, 2.6], speed: 0.75, crit: [0.35, 3], hits: 2, knock: 0.2, stam: 0.05, cond: 4, lower: 1, len: 1.0 },
    { id: 'cuchillo', name: 'Cuchillo de cocina', cat: 'sblade', hands: 1, range: 0.85, dmg: [0.5, 0.9], speed: 0.5, crit: [0.4, 2.5], hits: 1, knock: 0.05, stam: 0.025, cond: 5, lower: 1, len: 0.3 },
    { id: 'cuchillo_caza', name: 'Cuchillo de caza', cat: 'sblade', hands: 1, range: 0.85, dmg: [0.7, 1.1], speed: 0.5, crit: [0.4, 2.5], hits: 1, knock: 0.05, stam: 0.025, cond: 8, lower: 1, len: 0.32 },
    { id: 'destornillador', name: 'Destornillador', cat: 'sblade', hands: 1, range: 0.8, dmg: [0.4, 0.7], speed: 0.45, crit: [0.4, 2.5], hits: 1, knock: 0.05, stam: 0.02, cond: 5, lower: 1, len: 0.26 },
    { id: 'cuchilla', name: 'Cuchilla de carnicero', cat: 'sblade', hands: 1, range: 0.9, dmg: [0.8, 1.2], speed: 0.6, crit: [0.3, 2.5], hits: 1, knock: 0.1, stam: 0.03, cond: 7, lower: 1, len: 0.32 },
    { id: 'lanza', name: 'Lanza improvisada', cat: 'spear', hands: 2, range: 1.7, dmg: [0.8, 1.4], speed: 0.8, crit: [0.3, 2], hits: 1, knock: 0.25, stam: 0.05, cond: 3, lower: 1, len: 1.7 },

    // ---- Armas de fuego y arco (cat 'gun') ----
    // gun: tipo de animación · ammo: munición · mag: cargador · fire: segundos entre disparos
    // (incluye corredera o cerrojo) · reload: segundos por recarga (por cartucho si perShell)
    // dmg: daño por bala o perdigón (cabeza x3) · spread: dispersión en radianes · noise: metros
    // a los que se oye el disparo · range: alcance · bash: daño del culatazo · shots: disparos que
  // (sin uso: las armas de fuego ya no se rompen)
    { id: 'pistola', name: 'Pistola semiautomática', cat: 'gun', gun: 'pistol', hands: 1, ammo: '9mm', mag: 17, fire: 0.26, reload: 0.85,
      dmg: [1.1, 1.5], pellets: 1, spread: 0.011, noise: 30, range: 45, knock: 0.08, bash: [0.3, 0.6], speed: 0.6, stam: 0.03, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 150, len: 0.2 },
    { id: 'escopeta', name: 'Escopeta de corredera', cat: 'gun', gun: 'shotgun', hands: 2, ammo: 'cartucho', mag: 4, fire: 0.95, reload: 0.45, perShell: true,
      dmg: [0.5, 0.7], pellets: 7, spread: 0.056, noise: 38, range: 22, knock: 0.12, bash: [0.4, 0.8], speed: 0.75, stam: 0.05, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 80, len: 0.95 },
    { id: 'rifle', name: 'Rifle de cerrojo', cat: 'gun', gun: 'rifle', hands: 2, ammo: 'rifle', mag: 1, fire: 1.2, reload: 0.5, perShell: true, scope: true,
      dmg: [1.5, 1.9], pellets: 1, spread: 0.004, noise: 45, range: 80, knock: 0.3, bash: [0.4, 0.8], speed: 0.8, stam: 0.05, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 70, len: 1.08 },
    { id: 'arco', name: 'Arco', cat: 'gun', gun: 'bow', hands: 2, ammo: 'flecha', mag: 1, fire: 0.75, reload: 0.7,
      dmg: [0.9, 2.8], pellets: 1, spread: 0.01, noise: 3, range: 45, knock: 0.15, bash: [0.2, 0.4], speed: 0.7, stam: 0.04, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 120, len: 1.1 },
    // ---- Armas nuevas (modo Retorno, se compran en el comercio). anim: qué animación usa (la de la pistola o la
    // de la escopeta); noPump: sin corredera; muzzle: punta del cañón en el modelo; special: sin mejoras
    // revólver: arma corta (va a la pistolera), mucho daño y lento; se recarga de una vez
    { id: 'revolver', name: 'Revólver', cat: 'gun', gun: 'revolver', anim: 'pistol', hands: 1, ammo: 'revolver', mag: 6, fire: 0.6, reload: 1.35,
      dmg: [2.0, 2.6], pellets: 1, spread: 0.009, noise: 38, range: 50, knock: 0.3, bash: [0.3, 0.6], speed: 0.6, stam: 0.03, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 120, len: 0.24, muzzle: [0, 0.215, -0.042] },
    // escopeta de doble cañón: dos disparos muy fuertes de cerca; se abre y se cargan los dos cartuchos a la vez
    { id: 'doble', name: 'Escopeta de doble cañón', cat: 'gun', gun: 'double', anim: 'shotgun', noPump: true, hands: 2, ammo: 'cartucho', mag: 2, fire: 0.32, reload: 1.8,
      dmg: [0.7, 0.9], pellets: 8, spread: 0.07, noise: 42, range: 18, knock: 0.2, bash: [0.4, 0.8], speed: 0.75, stam: 0.05, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 70, len: 0.92, muzzle: [0, 0.66, -0.036] },
    // subfusil silenciado (especial: sin mejoras): ráfagas manteniendo Atacar, casi sin ruido
    { id: 'subfusil', name: 'Subfusil silenciado', cat: 'gun', gun: 'smg', anim: 'shotgun', noPump: true, special: true, auto: true, silenced: true, hands: 2, ammo: 'smg', mag: 24, fire: 0.09, reload: 1.6,
      dmg: [0.55, 0.75], pellets: 1, spread: 0.022, noise: 6, range: 35, knock: 0.04, bash: [0.3, 0.6], speed: 0.7, stam: 0.04, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 400, len: 0.62, muzzle: [0, 0.45, -0.035] },
    // lanzallamas (especial: sin mejoras): un chorro de fuego de unos 7 m manteniendo Atacar; gasta combustible
    { id: 'lanzallamas', name: 'Lanzallamas', cat: 'gun', gun: 'flame', anim: 'shotgun', noPump: true, special: true, auto: true, hands: 2, ammo: 'gas', mag: 60, fire: 0.06, reload: 2.0,
      dmg: [0.12, 0.17], pellets: 1, spread: 0.06, noise: 12, range: 7, knock: 0, bash: [0.4, 0.8], speed: 0.8, stam: 0.05, crit: [0, 1], hits: 1, cond: Infinity, lower: Infinity, shots: 2000, len: 0.95, muzzle: [0, 0.63, -0.03] }
  ];

  // Munición y accesorios (cond = cantidad). box: cuántas trae lo que encuentras (como mucho 6) ·
  // cap: cuántas de reserva caben sin mochila (con mochila, BAG_MUL veces más)
  const AMMO = {
    '9mm': { item: 'mun_9mm', name: 'balas de 9 mm', box: [2, 6], cap: 17 },
    cartucho: { item: 'mun_cartucho', name: 'cartuchos', box: [1, 4], cap: 5 },
    rifle: { item: 'mun_rifle', name: 'balas de rifle', box: [1, 3], cap: 5 },
    flecha: { item: 'mun_flecha', name: 'flechas', box: [1, 3], cap: 5 },
    flecha_exp: { item: 'mun_flecha_exp', name: 'flechas explosivas', box: [1, 2], cap: 3 },
    revolver: { item: 'mun_revolver', name: 'balas de revólver', box: [2, 4], cap: 6 },
    smg: { item: 'mun_smg', name: 'balas de subfusil', box: [2, 4], cap: 24 },      // (pocas: es la mejor arma)
    gas: { item: 'mun_gas', name: 'combustible', box: [20, 30], cap: 40 }
  };
  const ITEM_AMMO = {};
  for (const k in AMMO) ITEM_AMMO[AMMO[k].item] = k;
  const BAG_MUL = 3;
  const ITEMS = {
    mun_9mm: 'Balas de 9 mm', mun_cartucho: 'Cartuchos de escopeta', mun_rifle: 'Balas de rifle', mun_flecha: 'Flechas', mun_flecha_exp: 'Flechas explosivas',
    mun_revolver: 'Balas de revólver', mun_smg: 'Balas de subfusil', mun_gas: 'Combustible',
    silenciador: 'Silenciador',
    venda: 'Venda', venda_d: 'Venda desinfectada', alcohol: 'Botella de alcohol', trapo: 'Trapo', mochila: 'Mochila',
    polvo: 'Polvo reactivo', clavos: 'Clavos', tijeras: 'Tijeras', panuelo: 'Pañuelo', mina: 'Mina', humo: 'Bomba de humo',
    chocolatina: 'Chocolatina'
  };
  // Curación y mochila: cuántas caben (sin mochila / con mochila; 0 = hace falta mochila)
  const SUPPLY = {
    venda: { cap: [3, 10], n: [1, 2] },
    venda_d: { cap: [0, 5], n: [1, 1] },
    alcohol: { cap: [4, 10], n: [1, 1] },     // para fabricar vendas: 2 botellas de alcohol + 1 trapo
    trapo: { cap: [4, 10], n: [1, 1] },
    mochila: { cap: [1, 1], n: [1, 1] },
    // explosivos (1 + 1, como en los juegos de referencia): polvo reactivo + clavos = una mina; polvo reactivo +
    // trapo = una bomba de humo. Como mucho 3 de cada (y 3 molotovs)
    polvo: { cap: [3, 8], n: [1, 1] },
    clavos: { cap: [6, 12], n: [1, 2] },
    tijeras: { cap: [4, 10], n: [1, 1] },
    panuelo: { cap: [4, 10], n: [1, 1] },
    mina: { cap: [3, 3], n: [1, 1] },
    humo: { cap: [3, 3], n: [1, 1] }
  };

  const BY_ID = {};
  LIST.forEach((w) => { BY_ID[w.id] = w; });

  // Sin arma: solo empujón (como en el original)
  const FISTS = { id: 'manos', name: 'Manos', cat: 'none', hands: 0, range: 0.9, dmg: [0, 0], speed: 0.7, crit: [0, 1], hits: 1, knock: 0, stam: 0.03, cond: Infinity, lower: Infinity };
  // Navaja: siempre a mano cuando no llevas otra arma (no se rompe ni ocupa sitio). Tres golpes:
  // tajo, revés y puñalada al cuello (esta mata). También sirve para rematar y para soltarte de un agarre
  const KNIFE = { id: 'navaja', name: 'Navaja', cat: 'sblade', hands: 1, range: 1.05, dmg: [0.75, 0.95], speed: 0.46, crit: [0, 1], hits: 1, knock: 0.08, stam: 0.02, cond: Infinity, lower: Infinity, len: 0.2, knife: true };
  BY_ID.navaja = KNIFE;

  // Qué se puede encontrar en cada tipo de habitación (las armas de fuego largas quedan en el suelo;
  // lo demás se guarda en algún mueble de esa habitación)
  const LOOT = {
    cocina: { chance: 0.6, table: { sarten: 4, rodillo: 3, cuchillo: 5, cuchilla: 2 } },
    garaje: { chance: 0.85, table: { martillo: 4, llave: 4, palanca: 3, tubo: 3, mazo: 1, pala: 2, hacha_mano: 2, destornillador: 3, tabla: 2, tabla_clavos: 1, mun_cartucho: 0.8, rifle: 0.105, mun_rifle: 0.5, arco: 0.158, mun_flecha: 0.7, silenciador: 0.15 } },
    dormitorio: { chance: 0.38, table: { bate: 4, golf: 3, bate_clavos: 1, cuchillo_caza: 1, katana: 0.15, pistola: 0.9, mun_9mm: 0.72, mun_cartucho: 0.5, mun_rifle: 0.35, arco: 0.052, mun_flecha: 0.35, silenciador: 0.1 } },
    sala: { chance: 0.28, table: { golf: 2, bate: 2, tabla: 1, destornillador: 1, mun_9mm: 0.36, escopeta: 0.07, mun_rifle: 0.2, mun_flecha: 0.2 } },
    cabana: { chance: 0.95, table: { hacha_mano: 3, pala: 2, lanza: 2, tabla_clavos: 2, machete: 2, cuchillo_caza: 1, arco: 0.7, rifle: 0.42, mun_flecha: 2, mun_rifle: 1.5, mun_cartucho: 1 } },
    cochera: { chance: 0.7, table: { palanca: 3, mazo: 1, pala: 1 } },   // el hacha de bombero solo está en los cofres de los camiones
    oficina: { chance: 0.5, table: { porra: 2, destornillador: 1, pistola: 1, mun_9mm: 1.2 } },
    archivo: { chance: 0.85, table: { porra: 3, cuchillo_caza: 1, machete: 1, pistola: 2, escopeta: 0.525, mun_9mm: 1.8, mun_cartucho: 2, silenciador: 0.6 } },
    recepcion: { chance: 0.25, table: { porra: 1, destornillador: 1 } },
    quirofano: { chance: 0.5, table: { cuchillo: 2, destornillador: 1 } },
    habitacion: { chance: 0.15, table: { destornillador: 1, rodillo: 1 } }
  };

  function lootFor(roomType, kind, rng) {
    const l = LOOT[roomType];
    if (!l) return [];
    const out = [];
    if (rng() < l.chance) out.push(G.Util.weighted(rng, l.table));
    if ((kind === 'bomberos' || kind === 'policia') && rng() < 0.4) out.push(G.Util.weighted(rng, l.table));
    return out;
  }

  // Armas largas: van a la espalda (máximo 2: una en las manos y otra a la espalda).
  // Las cortas van a los bolsillos, sin límite por ahora.
  function isLong(w) { return w.hands === 2 || (w.len || 0) >= 0.7; }

  // Material: el metal pega más fuerte que la madera
  const WOOD = { bate: 1, bate_clavos: 1, tabla: 1, tabla_clavos: 1, rodillo: 1, lanza: 1 };
  const OTHER = { porra: 1 };
  function material(w) { return WOOD[w.id] ? 'madera' : (OTHER[w.id] || w.id === 'manos' ? 'otro' : 'metal'); }
  function matMul(w) { const m = material(w); return m === 'metal' ? 1.12 : (m === 'madera' ? 0.9 : 1); }

  // Cada arma se usa como es (ya no se cambia el agarre): sin modificadores
  const NEUTRAL = { dmg: 1, speed: 1, acc: 0, knock: 0 };
  function grip() { return NEUTRAL; }

  // Multiplicador general de los golpes que aguantan las armas cuerpo a cuerpo (1 = los de la tabla)
  const DURABILITY = 1;

  // Pistolas y munición: en las casas de una planta salen menos (en las de dos pisos, igual que antes)
  function commonHouseCut(id) { return id === 'pistola' || !!ITEM_AMMO[id]; }
  const COMMON_KEEP = 0.4;

  // Cantidad que trae una caja de munición encontrada
  function stackSize(id, rng) {
    const a = ITEM_AMMO[id];
    if (!a) {
      const sp = SUPPLY[id];
      return sp ? sp.n[0] + Math.floor((rng || Math.random)() * (sp.n[1] - sp.n[0] + 1)) : 1;
    }
    const b = AMMO[a].box;
    return b[0] + Math.floor((rng || Math.random)() * (b[1] - b[0] + 1));
  }

  // ---------- Mejoras (banco de mejoras del refugio, modo Retorno) ----------
  // Sin mejorar, las armas de fuego retroceden mucho más y la mira se mueve bastante al apuntar (kickMul y
  // swayMul). Estabilidad quita una parte; Retroceso (después de Estabilidad) las deja como eran antes.
  // Capacidad: pistola 17 → 33 (cargador ampliado, como una 9 mm de verdad), escopeta 4 → 6, rifle 1 → 2.
  // Cadencia: dispara más seguido. Daño (rifle y revólver): cuántos tiros hacen falta, ver STK en zombie.js. El arco solo tiene Alcance (la flecha sale más rápida y llega más lejos).
  const BASE_MUL = { pistola: [2.4, 3.5], escopeta: [1.9, 3.0], rifle: [1.7, 3.5], arco: [1, 1], revolver: [2.0, 3.2], doble: [1.6, 2.8] };   // [retroceso, balanceo]
  const UPGRADES = {
    pistola: [
      { id: 'cadencia', name: 'Cadencia', cost: 80, desc: 'Dispara más seguido.' },
      { id: 'estabilidad', name: 'Estabilidad', cost: 60, desc: 'Menos retroceso y la mira se mueve menos al apuntar.' },
      { id: 'retroceso', name: 'Retroceso', cost: 90, req: 'estabilidad', desc: 'El retroceso y el movimiento de la mira quedan al mínimo.' },
      { id: 'capacidad', name: 'Capacidad', cost: 100, desc: 'Cargador ampliado: de 17 a 33 balas.' }
    ],
    escopeta: [
      { id: 'cadencia', name: 'Cadencia', cost: 110, desc: 'Bombea más rápido entre disparo y disparo.' },
      { id: 'estabilidad', name: 'Estabilidad', cost: 90, desc: 'Menos retroceso y la mira se mueve menos al apuntar.' },
      { id: 'retroceso', name: 'Retroceso', cost: 120, req: 'estabilidad', desc: 'El retroceso y el movimiento de la mira quedan al mínimo.' },
      { id: 'capacidad', name: 'Capacidad', cost: 130, desc: 'De 4 a 6 cartuchos.' }
    ],
    rifle: [
      { id: 'dano', name: 'Daño', cost: 160, desc: 'Mata de un tiro al cuerpo a corredores y acechadores; a chaskeados y temblantes, de dos.' },
      { id: 'cadencia', name: 'Cadencia', cost: 120, desc: 'Cerrojo más rápido.' },
      { id: 'estabilidad', name: 'Estabilidad', cost: 90, desc: 'Menos retroceso y la mira se mueve menos al apuntar.' },
      { id: 'retroceso', name: 'Retroceso', cost: 130, req: 'estabilidad', desc: 'El retroceso y el movimiento de la mira quedan al mínimo.' },
      { id: 'capacidad', name: 'Capacidad', cost: 120, desc: 'De 1 a 2 balas.' }
    ],
    arco: [
      { id: 'alcance', name: 'Alcance', cost: 90, desc: 'La flecha sale más rápida, cae menos y llega más lejos.' }
    ],
    revolver: [
      { id: 'dano', name: 'Daño', cost: 130, desc: 'Balas más pesadas: hacen falta menos tiros a todos.' },
      { id: 'cadencia', name: 'Cadencia', cost: 90, desc: 'Martillo más suave: dispara más seguido.' },
      { id: 'estabilidad', name: 'Estabilidad', cost: 70, desc: 'Menos retroceso y la mira se mueve menos al apuntar.' },
      { id: 'retroceso', name: 'Retroceso', cost: 100, req: 'estabilidad', desc: 'El retroceso y el movimiento de la mira quedan al mínimo.' },
    ],
    doble: [
      { id: 'recarga', name: 'Recarga', cost: 100, desc: 'Abre y carga los dos cañones mucho más rápido.' },
      { id: 'estabilidad', name: 'Estabilidad', cost: 90, desc: 'Menos retroceso y la mira se mueve menos al apuntar.' },
      { id: 'retroceso', name: 'Retroceso', cost: 120, req: 'estabilidad', desc: 'El retroceso y el movimiento de la mira quedan al mínimo.' }
    ]
  };
  // valores sin mejorar (se guardan al cargar para poder recalcular)
  const BASE = {};
  for (const id in UPGRADES) { const w = BY_ID[id]; BASE[id] = { mag: w.mag, fire: w.fire, dmg: w.dmg.slice(), range: w.range, reload: w.reload }; }
  // up: { pistola: { cadencia: true, ... }, ... } (o nada: todas sin mejorar)
  function applyUpgrades(up) {
    up = up || {};
    for (const id in UPGRADES) {
      const w = BY_ID[id], b = BASE[id], u = up[id] || {}, m = BASE_MUL[id];
      w.mag = b.mag; w.fire = b.fire; w.dmg = b.dmg.slice(); w.range = b.range; w.reload = b.reload; w.arrowMul = 1;
      w.kickMul = m[0]; w.swayMul = m[1]; w.dmgUp = !!u.dano;
      if (u.estabilidad) { w.kickMul = 1 + (m[0] - 1) * 0.5; w.swayMul = 1 + (m[1] - 1) * 0.45; }
      if (u.retroceso) { w.kickMul = 1; w.swayMul = 1; }
      if (u.cadencia) w.fire = +(b.fire * 0.75).toFixed(3);
      if (u.capacidad) w.mag = { pistola: 33, escopeta: 6, rifle: 2 }[id] || b.mag;
      // (rifle y revólver: el daño real va por tiros, STK en zombie.js; esto es para la barra del banco)
      if (u.dano) w.dmg = id === 'rifle' ? [3.0, 3.8] : [2.7, 3.4];
      if (u.recarga) w.reload = +(b.reload * 0.55).toFixed(2);
      if (u.alcance) { w.range = 70; w.arrowMul = 1.32; }
    }
  }
  // las especiales (subfusil, lanzallamas) no se mejoran: retroceso y balanceo normales
  for (const w of LIST) if (w.cat === 'gun' && !UPGRADES[w.id]) { w.kickMul = 1; w.swayMul = 1; w.arrowMul = 1; }
  applyUpgrades(null);
  // arma corta (va en la pistolera): la pistola y el revólver
  function isShort(w) { return !!w && w.cat === 'gun' && (w.anim || w.gun) === 'pistol'; }

  G.Weapons = {
    UPGRADES, applyUpgrades, BY_ID,
    LIST, FISTS, KNIFE, AMMO, SUPPLY, BAG_MUL, lootFor, isLong, grip, material, matMul, stackSize, DURABILITY, commonHouseCut, COMMON_KEEP,
    get(id) { return BY_ID[id] || FISTS; },
    // ¿Se ve en el suelo? Solo las armas de fuego largas; lo demás se encuentra dentro de muebles o montones
    hasModel(id) { const w = BY_ID[id]; return !!w && w.cat === 'gun' && isLong(w); },
    isGun(w) { return !!w && w.cat === 'gun'; },
    // espacio de cada arma: 0 cuerpo a cuerpo · 1 pistola · 2 arma de fuego larga
    kindOf(id) { const w = BY_ID[id]; if (!w) return -1; return w.cat !== 'gun' ? 0 : (isShort(w) ? 1 : 2); },
    isShort,
    // animación que usa (pistol, shotgun, rifle, bow)
    animOf(w) { return w ? (w.anim || w.gun) : null; },
    // objetos que no son armas: munición y accesorios
    isItem(id) { return !!ITEMS[id]; },
    ammoOfItem(id) { return ITEM_AMMO[id] || null; },
    // nombre para mostrar de cualquier cosa del suelo
    nameOf(id) { return ITEMS[id] || (BY_ID[id] || FISTS).name; },
    itemLen(id) { return ITEMS[id] ? (id === 'mun_flecha' || id === 'mun_flecha_exp' ? 0.7 : 0.16) : ((BY_ID[id] || FISTS).len || 0.8); }
  };
})(window.Game = window.Game || {});
