(function (G) {
  'use strict';

  // Plantillas de edificios definidas por habitaciones rectangulares.
  // A partir de ellas se generan solas las paredes, puertas, ventanas,
  // interruptores y luces. La puerta principal siempre se define al sur
  // y luego el edificio se gira para que mire a la calle.
  // Las casas de dos pisos tienen un segundo plan (up) y una escalera que
  // ocupa las mismas casillas en las dos plantas.

  // Tipos de arista (paredes finas entre casillas, como en el original)
  const E = {
    NONE: 0, WALL: 1, DOOR: 2, DOOR_OPEN: 3, DOOR_BROKEN: 4,
    WIN: 5, WIN_OPEN: 6, WIN_BROKEN: 7, ARCH: 8, FENCE: 9,
    RAIL: 10,         // barandilla del hueco de la escalera (no se pasa, pero se ve a través)
    GATE: 11,         // portón grande abierto (cochera de los bomberos)
    CONT: 12          // costado de un contenedor de carga (no se dibuja: lo dibuja el contenedor; tapa la vista)
  };

  // Suelos
  const F = {
    GRASS: 0, ROAD: 1, SIDEWALK: 2, DIRT: 3,
    WOOD: 10, TILE: 11, CONCRETE: 12, LINO: 13, CARPET: 14,
    ARCADE: 15         // moqueta de salón recreativo (dibujos de neón que brillan en la penumbra)
  };

  // Tipos de habitación: nombre, suelo y colores de pared posibles
  const ROOM = {
    super:      { name: 'Supermercado', floor: F.CONCRETE, walls: [0x8e928c, 0x868a84] },
    porche:     { name: 'Porche', floor: F.WOOD, walls: [0xd8d4c8] },
    terraza:    { name: 'Terraza', floor: F.CONCRETE, walls: [0xc8c4b8] },
    ruina:      { name: 'Ruinas', floor: F.CONCRETE, walls: [0x8a867e, 0x7e7a72] },
    sala:       { name: 'Sala', floor: F.WOOD, walls: [0xd8c9a8, 0xcfc0a0, 0xc9b99a, 0xd4c4b0] },
    cocina:     { name: 'Cocina', floor: F.TILE, walls: [0xe6dfc6, 0xdde2cf, 0xe8d9b5] },
    dormitorio: { name: 'Dormitorio', floor: F.CARPET, walls: [0xa9bfcf, 0xb8cdb0, 0xd6b8b8, 0xcfc6a6] },
    bano:       { name: 'Baño', floor: F.TILE, walls: [0xc9dde0, 0xe0e4e6] },
    pasillo:    { name: 'Pasillo', floor: F.WOOD, walls: [0xd2c4a6, 0xc7b896] },
    garaje:     { name: 'Garaje', floor: F.CONCRETE, walls: [0x9a9a92, 0xa8a59a] },
    cabana:     { name: 'Cabaña', floor: F.WOOD, walls: [0x9c7a54] },
    cochera:    { name: 'Cochera', floor: F.CONCRETE, walls: [0xb9b2a6] },
    oficina:    { name: 'Oficina', floor: F.LINO, walls: [0xc8cfc8, 0xd0cbbd] },
    recepcion:  { name: 'Recepción', floor: F.LINO, walls: [0xd9dcd6] },
    celda:      { name: 'Celda', floor: F.CONCRETE, walls: [0x9fa6a8] },
    archivo:    { name: 'Archivo', floor: F.LINO, walls: [0xb7bdb4] },
    habitacion: { name: 'Habitación', floor: F.LINO, walls: [0xdfe7e3, 0xe2e6dd] },
    quirofano:  { name: 'Quirófano', floor: F.TILE, walls: [0xc6e0d6] },
    espera:     { name: 'Sala de espera', floor: F.LINO, walls: [0xdfe3e6] },
    escalera:   { name: 'Escalera', floor: F.WOOD, walls: [0xd2c4a6, 0xc9bda2] },
    comedor:    { name: 'Comedor', floor: F.WOOD, walls: [0xd8c9a8, 0xd9cdb6, 0xc6b79c] },
    recibidor:  { name: 'Recibidor', floor: F.WOOD, walls: [0xd2c4a6, 0xcdbf9f] },
    estudio:    { name: 'Estudio', floor: F.CARPET, walls: [0xb9c4b0, 0xc8bfa8] },
    lavadero:   { name: 'Lavadero', floor: F.TILE, walls: [0xd8dcd6, 0xcfd6d2] },
    tienda:     { name: 'Tienda', floor: F.LINO, walls: [0xe4e0d4, 0xdcdfd6] },
    almacen:    { name: 'Almacén', floor: F.CONCRETE, walls: [0xb0aca2, 0xa9a69c] },
    // refugio del modo Retorno: taller grande, armería con el banco de mejoras y una despensa
    taller:     { name: 'Refugio', floor: F.CONCRETE, walls: [0x6e6253] },
    armeria:    { name: 'Armería', floor: F.WOOD, walls: [0x5f5548] },
    despensa:   { name: 'Despensa', floor: F.CONCRETE, walls: [0x655b4e] },
    // mapas: la nave de la terminal de carga (taller con estanterías y bancos)
    nave:       { name: 'Nave', floor: F.CONCRETE, walls: [0x8a8c88, 0x7f8584] },
    // jefe final: salón recreativo abandonado (la sala grande) rodeado de cuartos cerrados que el hongomorfo
    // va abriendo a golpes
    arcade:     { name: 'Salón recreativo', floor: F.ARCADE, walls: [0x51436f] },
    // asentamiento en la playa (los Escorpiones viven en el museo)
    museo:      { name: 'Vestíbulo del museo', floor: F.TILE, walls: [0xd8cfbc] },
    galeria:    { name: 'Sala del museo', floor: F.WOOD, walls: [0x9a5446, 0x7a8462] },
    vigilancia: { name: 'Sala de vigilancia', floor: F.CONCRETE, walls: [0xa8a69c] },
    trastienda: { name: 'Trastienda', floor: F.CONCRETE, walls: [0x5a4c40] },
    despacho:   { name: 'Despacho', floor: F.LINO, walls: [0x55584e] },
    aseos:      { name: 'Aseos', floor: F.TILE, walls: [0x5f706e] },
    deposito:   { name: 'Depósito', floor: F.CONCRETE, walls: [0x48443e] },
    vestibulo:  { name: 'Vestíbulo', floor: F.ARCADE, walls: [0x56486e] },
    // Red del Capitolio: la rotonda de mármol, la cámara de los diputados (abandonada) y la armería de los Escorpiones
    rotonda:    { name: 'Rotonda', floor: F.TILE, walls: [0xd8d0bc] },
    camara:     { name: 'Cámara', floor: F.CARPET, walls: [0x7a5446] }
  };

  // Plantillas: rooms [x, z, w, h, tipo], links [a, b, 'D' puerta | 'o' arco],
  // doors [habitación, lado] puertas al exterior (n, s, e, o=w)
  const DEFS = [
    {
      id: 'casa1', kind: 'casa', w: 10, h: 9, roof: 'gable',
      rooms: [[0, 0, 4, 4, 'dormitorio'], [4, 0, 2, 3, 'bano'], [6, 0, 4, 4, 'dormitorio'],
              [4, 3, 2, 1, 'pasillo'], [0, 4, 6, 5, 'sala'], [6, 4, 4, 5, 'cocina']],
      links: [[4, 3, 'o'], [3, 0, 'D'], [3, 2, 'D'], [3, 1, 'D'], [4, 5, 'o']],
      doors: [[4, 's'], [5, 'e']]
    },
    {
      id: 'casa2', kind: 'casa', w: 11, h: 9, roof: 'gable',
      rooms: [[0, 0, 4, 9, 'garaje'], [4, 0, 4, 4, 'cocina'], [8, 0, 3, 3, 'bano'],
              [8, 3, 3, 6, 'dormitorio'], [4, 4, 4, 5, 'sala']],
      links: [[0, 1, 'D'], [1, 4, 'o'], [4, 3, 'D'], [3, 2, 'D']],
      doors: [[4, 's'], [0, 's'], [1, 'n']]
    },
    {
      id: 'casa3', kind: 'casa', w: 12, h: 8, roof: 'gable',
      rooms: [[0, 0, 4, 4, 'dormitorio'], [0, 4, 4, 4, 'dormitorio'], [4, 0, 2, 8, 'pasillo'],
              [6, 0, 2, 3, 'bano'], [8, 0, 4, 3, 'cocina'], [6, 3, 6, 5, 'sala']],
      links: [[2, 0, 'D'], [2, 1, 'D'], [2, 5, 'o'], [2, 3, 'D'], [5, 4, 'o']],
      doors: [[5, 's'], [2, 'n']]
    },
    {
      id: 'casa4', kind: 'casa', w: 8, h: 8, roof: 'gable',
      rooms: [[0, 0, 5, 4, 'dormitorio'], [5, 0, 3, 4, 'bano'], [0, 4, 5, 4, 'sala'], [5, 4, 3, 4, 'cocina']],
      links: [[2, 0, 'D'], [2, 3, 'o'], [3, 1, 'D']],
      doors: [[2, 's'], [3, 'e']]
    },
    // ---- Casas de dos pisos: plan de la planta baja y plan de arriba (up).
    // La escalera ocupa las mismas casillas en las dos plantas; stair.dir = hacia dónde se sube.
    {
      id: 'casa5', kind: 'casa', floors: 2, w: 10, h: 9, roof: 'gable',
      rooms: [[0, 0, 4, 4, 'comedor'], [4, 0, 6, 3, 'cocina'], [0, 4, 4, 5, 'sala'], [4, 3, 1, 4, 'escalera'],
              [4, 7, 3, 2, 'recibidor'], [5, 3, 2, 4, 'bano'], [7, 3, 3, 6, 'lavadero']],
      links: [[4, 3, 'o'], [4, 2, 'o'], [2, 0, 'o'], [0, 1, 'D'], [4, 5, 'D'], [1, 6, 'D']],
      doors: [[4, 's'], [6, 'e']],
      stair: { room: 3, dir: 'n' },
      up: {
        rooms: [[4, 3, 1, 4, 'escalera'], [3, 0, 4, 3, 'pasillo'], [0, 0, 3, 3, 'dormitorio'], [7, 0, 3, 7, 'dormitorio'],
                [5, 3, 2, 4, 'bano'], [0, 3, 4, 6, 'dormitorio'], [4, 7, 6, 2, 'estudio']],
        links: [[0, 1, 'o'], [1, 2, 'D'], [1, 3, 'D'], [1, 5, 'D'], [1, 4, 'D'], [3, 6, 'D']]
      }
    },
    {
      id: 'casa6', kind: 'casa', floors: 2, w: 11, h: 9, roof: 'gable',
      rooms: [[0, 0, 6, 4, 'estudio'], [6, 0, 5, 2, 'cocina'], [6, 2, 1, 4, 'escalera'], [7, 2, 4, 4, 'comedor'],
              [0, 4, 6, 5, 'sala'], [6, 6, 2, 3, 'recibidor'], [8, 6, 3, 3, 'bano']],
      links: [[5, 2, 'o'], [5, 4, 'o'], [4, 0, 'D'], [3, 5, 'o'], [3, 1, 'o'], [5, 6, 'D']],
      doors: [[5, 's'], [1, 'n']],
      stair: { room: 2, dir: 'n' },
      up: {
        rooms: [[6, 2, 1, 4, 'escalera'], [3, 0, 6, 2, 'pasillo'], [0, 0, 3, 5, 'dormitorio'], [9, 0, 2, 2, 'bano'],
                [3, 2, 3, 3, 'estudio'], [7, 2, 4, 4, 'dormitorio'], [0, 5, 6, 4, 'dormitorio'], [6, 6, 5, 3, 'dormitorio']],
        links: [[0, 1, 'o'], [1, 2, 'D'], [1, 3, 'D'], [1, 4, 'D'], [1, 5, 'D'], [4, 6, 'D'], [5, 7, 'D']]
      }
    },
    {
      id: 'casa7', kind: 'casa', floors: 2, w: 9, h: 10, roof: 'gable',
      rooms: [[0, 0, 4, 4, 'cocina'], [4, 0, 5, 3, 'comedor'], [4, 3, 1, 4, 'escalera'], [5, 3, 4, 2, 'bano'],
              [0, 4, 4, 6, 'sala'], [5, 5, 4, 2, 'dormitorio'], [4, 7, 3, 3, 'recibidor'], [7, 7, 2, 3, 'lavadero']],
      links: [[6, 2, 'o'], [6, 4, 'o'], [4, 0, 'o'], [0, 1, 'o'], [1, 3, 'D'], [6, 5, 'D'], [6, 7, 'D']],
      doors: [[6, 's'], [0, 'n'], [7, 'e']],
      stair: { room: 2, dir: 'n' },
      up: {
        rooms: [[4, 3, 1, 4, 'escalera'], [2, 0, 5, 3, 'pasillo'], [0, 0, 2, 5, 'dormitorio'], [7, 0, 2, 7, 'dormitorio'],
                [2, 3, 2, 2, 'estudio'], [5, 3, 2, 4, 'bano'], [0, 5, 4, 5, 'dormitorio'], [4, 7, 5, 3, 'dormitorio']],
        links: [[0, 1, 'o'], [1, 2, 'D'], [1, 3, 'D'], [1, 4, 'D'], [1, 5, 'D'], [4, 6, 'D'], [3, 7, 'D']]
      }
    },
    // ---- Barrio de casas (mapa): casa estrecha de dos pisos (8 x 10), puerta delante (recibidor) y detrás
    // (cocina, al patio). casa_b2 es la misma, en espejo
    {
      id: 'casa_b1', kind: 'casa', floors: 2, w: 8, h: 10, roof: 'gable', mapOnly: true,
      rooms: [[0, 0, 5, 4, 'cocina'], [5, 0, 3, 3, 'bano'], [5, 3, 1, 4, 'escalera'], [6, 3, 2, 4, 'lavadero'],
              [0, 4, 5, 6, 'sala'], [5, 7, 3, 3, 'recibidor']],
      links: [[5, 2, 'o'], [5, 4, 'o'], [4, 0, 'o'], [0, 1, 'D'], [5, 3, 'D']],
      doors: [[5, 's'], [0, 'n']],
      stair: { room: 2, dir: 'n' },
      up: {
        rooms: [[5, 3, 1, 4, 'escalera'], [2, 0, 6, 3, 'pasillo'], [0, 0, 2, 6, 'dormitorio'], [6, 3, 2, 4, 'bano'],
                [2, 3, 3, 3, 'estudio'], [0, 6, 5, 4, 'dormitorio'], [5, 7, 3, 3, 'dormitorio']],
        links: [[0, 1, 'o'], [1, 2, 'D'], [1, 3, 'D'], [1, 4, 'D'], [4, 5, 'D'], [5, 6, 'D']]
      }
    },
    // ---- Barrio (mapa): cuatro casas distintas. Las salidas que falten (dos por habitación como mínimo) las
    // abre G.Maps al colocarlas; los porches y terrazas quedan al aire (barandilla arriba, abierto abajo).
    // openUp: casillas de arriba sin techo (terraza)
    // A (10 x 11): dos pisos, techo plano. Galería de balcones delante (los dos dormitorios salen a ella, uno
    // junto a otro) sobre un porche abierto, y terraza detrás. Habitaciones amplias (nada de pasillos de 1 m)
    {
      id: 'bar_a', kind: 'casa', floors: 2, w: 10, h: 11, roof: 'flat', mapOnly: true, openUp: [[0, 0, 10, 2]],
      rooms: [[0, 0, 5, 4, 'cocina'], [5, 0, 5, 4, 'comedor'], [0, 4, 6, 5, 'sala'], [6, 4, 1, 5, 'escalera'],
              [7, 4, 3, 5, 'bano'], [0, 9, 10, 2, 'porche']],
      links: [[0, 1, 'o'], [0, 2, 'o'], [2, 5, 'D'], [3, 5, 'o'], [4, 5, 'D'], [4, 1, 'D']],
      doors: [[0, 'n']],
      stair: { room: 3, dir: 'n' },
      up: {
        rooms: [[6, 4, 1, 5, 'escalera'], [0, 2, 10, 2, 'pasillo'], [0, 0, 10, 2, 'terraza'], [0, 4, 6, 5, 'dormitorio'],
                [7, 4, 3, 5, 'dormitorio'], [0, 9, 10, 2, 'porche']],
        links: [[0, 1, 'o'], [1, 2, 'o'], [1, 3, 'D'], [1, 4, 'D'], [3, 5, 'D'], [4, 5, 'D']]
      }
    },
    // B (11 x 11): dos pisos, techo plano, terraza delante (sobre la sala y el recibidor)
    {
      id: 'bar_b', kind: 'casa', floors: 2, w: 11, h: 11, roof: 'flat', mapOnly: true, openUp: [[0, 7, 11, 4]],
      rooms: [[0, 6, 6, 5, 'sala'], [6, 7, 5, 4, 'recibidor'], [6, 2, 1, 5, 'escalera'], [0, 0, 6, 6, 'cocina'],
              [6, 0, 5, 2, 'bano'], [7, 2, 4, 5, 'lavadero']],
      links: [[1, 2, 'o'], [1, 0, 'o'], [0, 3, 'o'], [3, 4, 'D'], [4, 5, 'D'], [5, 1, 'D']],
      doors: [[1, 's'], [3, 'n']],
      stair: { room: 2, dir: 'n' },
      up: {
        rooms: [[6, 2, 1, 5, 'escalera'], [0, 0, 11, 2, 'pasillo'], [0, 2, 6, 5, 'dormitorio'], [7, 2, 4, 5, 'dormitorio'],
                [0, 7, 11, 4, 'terraza']],
        links: [[0, 1, 'o'], [1, 2, 'D'], [1, 3, 'D'], [4, 2, 'D'], [4, 3, 'D']]
      }
    },
    // Supermercado (mapa): dos edificios que se juntan en x = 32 (cada uno en su trozo del mundo) y forman una
    // sala de ventas grande; detrás, el almacén, la oficina y la cámara. El techo está hundido por partes
    // (openUp: sin techo) y entra la nieve. Las ventanas del escaparate y la pared que los une las pone G.Maps
    {
      id: 'super_w', kind: 'super', w: 28, h: 22, roof: 'flat', noWindows: true, wallH: 4.6, mapOnly: true,
      openUp: [[6, 9, 5, 4], [16, 13, 6, 4]],
      rooms: [[0, 0, 12, 5, 'almacen'], [12, 0, 6, 5, 'oficina'], [18, 0, 10, 5, 'despensa'], [0, 5, 28, 17, 'super']],
      links: [[0, 3, 'D'], [1, 3, 'D'], [2, 3, 'D'], [0, 1, 'D'], [1, 2, 'D']],
      doors: [[0, 'n'], [3, 's'], [3, 's2']]
    },
    {
      id: 'super_e', kind: 'super', w: 14, h: 22, roof: 'flat', noWindows: true, wallH: 4.6, mapOnly: true,
      openUp: [[3, 8, 5, 5]],
      rooms: [[0, 0, 14, 5, 'almacen'], [0, 5, 14, 17, 'super']],
      links: [[0, 1, 'D']],
      doors: [[1, 's'], [0, 'e']]
    },
    // Edificio desmoronado: solo queda la planta baja, sin techo, con paredes rotas (G.Maps abre los huecos)
    {
      id: 'ruina', kind: 'ruina', w: 12, h: 9, roof: 'none', mapOnly: true,
      rooms: [[0, 0, 6, 5, 'ruina'], [6, 0, 6, 5, 'ruina'], [0, 5, 4, 4, 'ruina'], [4, 5, 8, 4, 'ruina']],
      links: [[0, 1, 'o'], [0, 2, 'o'], [1, 3, 'o'], [2, 3, 'o']],
      doors: [[2, 's'], [3, 's']]
    },
    // ---- Tiendas de comida (todavía sin comida): sala de ventas con escaparate y almacén
    {
      id: 'tienda1', kind: 'tienda', w: 12, h: 9, roof: 'flat',
      rooms: [[0, 3, 12, 6, 'tienda'], [0, 0, 9, 3, 'almacen'], [9, 0, 3, 3, 'bano']],
      links: [[0, 1, 'D'], [1, 2, 'D']],
      doors: [[0, 's'], [1, 'n']]
    },
    {
      id: 'tienda2', kind: 'tienda', w: 10, h: 8, roof: 'flat',
      rooms: [[0, 3, 10, 5, 'tienda'], [0, 0, 6, 3, 'almacen'], [6, 0, 4, 3, 'oficina']],
      links: [[0, 1, 'D'], [0, 2, 'D']],
      doors: [[0, 's'], [1, 'w']]
    },
    {
      id: 'cabana', kind: 'cabana', w: 6, h: 6, roof: 'gable',
      rooms: [[0, 0, 6, 6, 'cabana']],
      links: [],
      doors: [[0, 's']]
    },
    {
      id: 'bomberos', kind: 'bomberos', w: 13, h: 12, roof: 'flat', rare: true,
      rooms: [[0, 0, 8, 12, 'cochera'], [8, 0, 5, 5, 'dormitorio'], [8, 5, 5, 3, 'bano'], [8, 8, 5, 4, 'oficina']],
      links: [[0, 1, 'D'], [0, 3, 'D'], [3, 2, 'D']],
      doors: [[0, 's'], [0, 's2'], [3, 's']]
    },
    {
      id: 'policia', kind: 'policia', w: 13, h: 12, roof: 'flat', rare: true,
      rooms: [[0, 0, 4, 5, 'celda'], [4, 0, 4, 5, 'celda'], [8, 0, 5, 5, 'archivo'],
              [0, 5, 13, 2, 'pasillo'], [0, 7, 6, 5, 'recepcion'], [6, 7, 7, 5, 'oficina']],
      links: [[4, 3, 'o'], [5, 3, 'D'], [4, 5, 'D'], [3, 0, 'D'], [3, 1, 'D'], [3, 2, 'D']],
      doors: [[4, 's']]
    },
    // Mapas: nave de la terminal de carga (un taller grande con oficina y almacén; los portones se abren a mano
    // en G.Maps) y el edificio de oficinas de la terminal
    {
      id: 'nave_t', kind: 'nave', w: 20, h: 12, roof: 'flat', wallH: 6.0,
      rooms: [[0, 0, 14, 12, 'nave'], [14, 0, 6, 6, 'garaje'], [14, 6, 6, 6, 'almacen']],
      links: [[0, 1, 'o'], [0, 2, 'o'], [1, 2, 'o']],
      doors: []
    },
    {
      id: 'oficinas_t', kind: 'oficinas', w: 10, h: 8, roof: 'flat',
      rooms: [[0, 0, 10, 4, 'oficina'], [0, 4, 5, 4, 'archivo'], [5, 4, 5, 4, 'oficina']],
      links: [[0, 1, 'D'], [0, 2, 'D']],
      doors: [[0, 'w'], [2, 's']]
    },
    // Jefe final: salón recreativo (la sala del medio, del tamaño del interior de la nave de la terminal) con la
    // trastienda al norte (la guarida del hongomorfo, cerrada) y una habitación en cada una de las otras paredes:
    // despacho (oeste), depósito (este) y vestíbulo (sur), con puertas. Las paredes interiores se pueden derribar
    // (breakable): el hongomorfo no cabe por las puertas y las atraviesa
    {
      id: 'arcade_b', kind: 'arcade', w: 26, h: 20, roof: 'flat', noWindows: true, wallH: 4.2, breakable: true, breakOut: true,
      rooms: [[3, 4, 20, 12, 'arcade'], [0, 0, 26, 4, 'trastienda'], [0, 4, 3, 16, 'despacho'], [23, 4, 3, 16, 'deposito'],
              [3, 16, 20, 4, 'vestibulo']],
      // una puerta de la sala a cada habitación (oeste, este y sur) y las tres conectadas entre sí por el vestíbulo
      links: [[0, 2, 'D'], [0, 3, 'D'], [0, 4, 'D'], [2, 4, 'D'], [3, 4, 'D']],
      doors: []
    },
    // Museo (asentamiento en la playa): un vestíbulo enorme delante (28 x 13) y dos salas grandes detrás, todo
    // comunicado por arcos; techos altos. La fachada de piedra da al patio
    {
      id: 'museo', kind: 'museo', w: 28, h: 22, roof: 'flat', wallH: 5.2, mapOnly: true, siding: 0xcfc4ae, roofColor: 0x6a655c,
      rooms: [[0, 9, 28, 13, 'museo'], [0, 0, 14, 9, 'galeria'], [14, 0, 14, 9, 'galeria']],
      links: [[0, 1, 'o'], [0, 2, 'o'], [1, 2, 'o']],
      doors: [[0, 's'], [0, 's2'], [1, 'w'], [2, 'e']]
    },
    // Sala de vigilancia (en el medio del patio): una cabina con ventanas por los cuatro lados
    {
      id: 'vigilancia', kind: 'vigilancia', w: 6, h: 5, roof: 'flat', wallH: 3.0, mapOnly: true, siding: 0x8a8a80, roofColor: 0x4a4a46,
      rooms: [[0, 0, 6, 5, 'vigilancia']],
      links: [],
      doors: [[0, 's']]
    },
    // ---- Red del Capitolio (mapa): el Capitolio en tres piezas, cada una dentro de su trozo del mundo (x 6 a 32,
    // 32 a 64 y 64 a 90), que se juntan en x = 32 y x = 64 (los pasos los abre G.Maps). Techos altos. Las celdas son
    // salas del edificio cerradas por dentro con rejas y tabiques (muebles que pone el mapa)
    // Ala oeste: el pasillo largo; al norte, las celdas A y B; al sur, el comedor, la cocina y el almacén
    {
      id: 'cap_oeste', kind: 'capitolio', w: 26, h: 22, roof: 'flat', wallH: 4.6, mapOnly: true, siding: 0xcfc6b2, roofColor: 0x6a6e6a,
      rooms: [[0, 9, 26, 3, 'pasillo'], [0, 0, 13, 9, 'celda'], [13, 0, 13, 9, 'celda'], [0, 12, 9, 10, 'comedor'], [9, 12, 6, 10, 'cocina'], [15, 12, 11, 10, 'almacen']],
      links: [[0, 1, 'o'], [0, 2, 'o'], [0, 3, 'o'], [0, 4, 'o'], [0, 5, 'o'], [3, 4, 'o']],
      doors: [[0, 'w'], [3, 's'], [5, 's']]
    },
    // El centro: la rotonda (bajo la cúpula) con la galería detrás, la cámara (abandonada, con el techo hundido),
    // el archivo, la sala de guardia, las celdas C y el vestíbulo de la entrada
    {
      id: 'cap_centro', kind: 'capitolio', w: 32, h: 22, roof: 'flat', wallH: 4.6, mapOnly: true, siding: 0xcfc6b2, roofColor: 0x6a6e6a,
      openUp: [[2, 2, 5, 4]],
      rooms: [[10, 4, 12, 14, 'rotonda'], [0, 9, 10, 3, 'pasillo'], [22, 9, 10, 3, 'pasillo'], [0, 0, 10, 9, 'camara'], [22, 0, 10, 9, 'archivo'],
              [10, 18, 12, 4, 'recepcion'], [0, 12, 10, 10, 'oficina'], [22, 12, 10, 10, 'celda'], [10, 0, 12, 4, 'galeria']],
      links: [[1, 0, 'o'], [2, 0, 'o'], [0, 5, 'o'], [0, 8, 'o'], [1, 3, 'o'], [1, 6, 'o'], [2, 4, 'o'], [2, 7, 'o'], [8, 3, 'o'], [8, 4, 'o'], [5, 6, 'o'], [5, 7, 'o']],
      doors: [[5, 's'], [5, 's2'], [8, 'n']]
    },
    // Ala este: el pasillo; al norte, las celdas D y el dormitorio de los Escorpiones; al sur, la perrera (los
    // chasqueadores encadenados) y la armería
    {
      id: 'cap_este', kind: 'capitolio', w: 26, h: 22, roof: 'flat', wallH: 4.6, mapOnly: true, siding: 0xcfc6b2, roofColor: 0x6a6e6a,
      rooms: [[0, 9, 26, 3, 'pasillo'], [0, 0, 12, 9, 'celda'], [12, 0, 14, 9, 'dormitorio'], [0, 12, 13, 10, 'deposito'], [13, 12, 13, 10, 'armeria']],
      links: [[0, 1, 'o'], [0, 2, 'o'], [0, 3, 'o'], [0, 4, 'o']],
      doors: [[0, 'e'], [4, 's'], [2, 'n']]
    },
    // Refugio (modo Retorno): una sola sala, sin puertas al exterior ni ventanas
    {
      id: 'refugio', kind: 'refugio', w: 11, h: 9, roof: 'flat', noWindows: true, wallH: 3.6,
      rooms: [[0, 0, 11, 9, 'taller']],
      links: [],
      doors: []
    },
    {
      id: 'hospital', kind: 'hospital', w: 13, h: 12, roof: 'flat', rare: true,
      rooms: [[0, 0, 5, 6, 'habitacion'], [5, 0, 3, 6, 'quirofano'], [8, 0, 5, 6, 'habitacion'],
              [0, 6, 13, 2, 'pasillo'], [0, 8, 4, 4, 'espera'], [4, 8, 5, 4, 'recepcion'], [9, 8, 4, 4, 'espera']],
      links: [[5, 3, 'o'], [4, 3, 'D'], [6, 3, 'D'], [3, 0, 'D'], [3, 1, 'D'], [3, 2, 'D']],
      doors: [[5, 's']]
    }
  ];

  // Colores de fachada por tipo
  const SIDING = {
    casa: [0xd8d2c0, 0xc9cfc8, 0xb8c4cc, 0xd9c7a6, 0xc2b49c, 0xe0dcd0, 0xa9b49a],
    cabana: [0x7e6044, 0x8b6a4a],
    bomberos: [0x9b4a3c],
    policia: [0x8e99a3],
    hospital: [0xe4e2dc],
    tienda: [0xd9cfb8, 0xc4ccc4, 0xd8c8a8, 0xb9c2c9],
    refugio: [0x5a5248],
    nave: [0x7a7f80, 0x8a8478, 0x6f7a7c],
    oficinas: [0xa8a296, 0x9a9a92],
    arcade: [0x3a3440],
    ruina: [0x8e8a82],
    super: [0x9a9c98],
    museo: [0xcfc4ae],
    vigilancia: [0x8a8a80],
    capitolio: [0xcfc6b2]
  };
  const ROOFS = [0x4a3f3a, 0x3f4650, 0x5a4234, 0x544c46, 0x3b4a3c];

  // ---------- Construcción del plano ----------
  // spec: { rooms, links, doors }. Devuelve casillas (índice de habitación), aristas y habitaciones.
  function buildPlan(def, spec, rng, upper) {
    const w = def.w, h = def.h;
    const tiles = new Int16Array(w * h).fill(-1);
    const special = def.kind === 'hospital' || def.kind === 'policia' || def.kind === 'bomberos' || def.kind === 'tienda';
    const rooms = spec.rooms.map((r, i) => {
      const t = ROOM[r[4]];
      for (let z = r[1]; z < r[1] + r[3]; z++) {
        for (let x = r[0]; x < r[0] + r[2]; x++) {
          if (tiles[z * w + x] !== -1) throw new Error(def.id + ': habitaciones solapadas en ' + x + ',' + z);
          tiles[z * w + x] = i;
        }
      }
      return {
        type: r[4], name: t.name, lv: upper ? 1 : 0,
        floor: special && t.floor === F.WOOD ? F.LINO : (special && t.floor === F.CARPET ? F.LINO : t.floor),
        wall: special && r[4] === 'pasillo' ? 0xdcdfd8 : G.Util.pick(rng, t.walls),
        x: r[0], z: r[1], w: r[2], h: r[3],
        cx: r[0] + r[2] / 2, cz: r[1] + r[3] / 2,
        sw: null
      };
    });
    const at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h) ? -1 : tiles[z * w + x];

    // hE: línea horizontal z (0..h), columna x. vE: línea vertical x (0..w), fila z.
    const hE = new Uint8Array(w * (h + 1));
    const vE = new Uint8Array((w + 1) * h);
    for (let z = 0; z <= h; z++) {
      for (let x = 0; x < w; x++) {
        if (at(x, z - 1) !== at(x, z)) hE[z * w + x] = E.WALL;
      }
    }
    for (let z = 0; z < h; z++) {
      for (let x = 0; x <= w; x++) {
        if (at(x - 1, z) !== at(x, z)) vE[z * (w + 1) + x] = E.WALL;
      }
    }

    // Aristas compartidas entre dos habitaciones (o una y el exterior)
    function shared(a, b) {
      const out = [];
      for (let z = 0; z <= h; z++) {
        for (let x = 0; x < w; x++) {
          const u = at(x, z - 1), d = at(x, z);
          if ((u === a && d === b) || (u === b && d === a)) out.push({ t: 'h', x, z });
        }
      }
      for (let z = 0; z < h; z++) {
        for (let x = 0; x <= w; x++) {
          const l = at(x - 1, z), r = at(x, z);
          if ((l === a && r === b) || (l === b && r === a)) out.push({ t: 'v', x, z });
        }
      }
      return out;
    }
    const setEdge = (e, v) => {
      if (e.t === 'h') hE[e.z * w + e.x] = v;
      else vE[e.z * (w + 1) + e.x] = v;
    };
    const getEdge = (e) => (e.t === 'h' ? hE[e.z * w + e.x] : vE[e.z * (w + 1) + e.x]);

    const doorEdges = [];   // { e, room }
    for (const [a, b, kind] of spec.links) {
      const s = shared(a, b);
      if (!s.length) throw new Error(def.id + ': sin pared común entre ' + a + ' y ' + b);
      const e = s[Math.floor(s.length / 2)];
      setEdge(e, kind === 'D' ? E.DOOR : E.ARCH);
      doorEdges.push({ e, room: a }, { e, room: b });
    }

    // Puertas exteriores en el lado pedido (s2 = segunda puerta en el mismo lado)
    const exteriorSide = (room, side) => {
      const out = [];
      for (const e of shared(room, -1)) {
        if (side === 's' && e.t === 'h' && e.z === h) out.push(e);
        else if (side === 'n' && e.t === 'h' && e.z === 0) out.push(e);
        else if (side === 'e' && e.t === 'v' && e.x === w) out.push(e);
        else if (side === 'w' && e.t === 'v' && e.x === 0) out.push(e);
      }
      out.sort((p, q) => (p.x + p.z) - (q.x + q.z));
      return out;
    };
    const doors = spec.doors || [];
    for (const [room, side] of doors) {
      const s = exteriorSide(room, side[0]);
      if (!s.length) throw new Error(def.id + ': la habitación ' + room + ' no da al lado ' + side);
      let e;
      if (side === 's2') e = s[Math.floor(s.length * 0.75)];
      else if (doors.some((d) => d[0] === room && d[1] === 's2')) e = s[Math.floor(s.length * 0.25)];
      else e = s[Math.floor(s.length / 2)];
      setEdge(e, E.DOOR);
      doorEdges.push({ e, room, outside: true });
    }

    // Ventanas en las paredes exteriores, por tramos de cada lado de cada habitación
    for (let i = 0; i < rooms.length && !def.noWindows; i++) {
      const type = rooms[i].type;
      if (type === 'celda' || type === 'pasillo' || type === 'escalera') continue;
      // escaparate: la fachada de la tienda casi entera de cristal
      if (type === 'tienda') {
        const run = exteriorSide(i, 's');
        run.forEach((e, k) => {
          if (getEdge(e) !== E.WALL || k === 0 || k === run.length - 1) return;
          const nb = run.filter((o) => Math.abs((o.x + o.z) - (e.x + e.z)) === 1);
          if (nb.some((o) => getEdge(o) === E.DOOR)) return;
          setEdge(e, E.WIN_OPEN);         // ventanas sin vidrio: solo el hueco (se saltan)
        });
        continue;
      }
      for (const side of ['n', 's', 'e', 'w']) {
        const run = exteriorSide(i, side);
        const L = run.length;
        if (!L) continue;
        let slots;
        if (type === 'garaje' || type === 'cochera' || type === 'almacen') slots = L >= 5 ? [Math.floor(L / 2)] : [];
        else if (L >= 5) slots = [Math.round(L * 0.25), Math.round(L * 0.75) - 1];
        else if (L >= 2) slots = [Math.floor((L - 1) / 2)];
        else slots = [];
        for (const k of slots) {
          const e = run[k];
          if (!e || getEdge(e) !== E.WALL) continue;
          // no junto a una puerta
          const nb = run.filter((o) => Math.abs((o.x + o.z) - (e.x + e.z)) === 1);
          if (nb.some((o) => getEdge(o) === E.DOOR)) continue;
          setEdge(e, E.WIN_OPEN);
        }
      }
    }

    // Interruptor: en la pared junto a la primera puerta de cada habitación, por dentro
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (r.type === 'escalera') continue;
      const cands = [];
      for (const d of doorEdges) {
        if (d.room !== i) continue;
        const e = d.e;
        const opts = e.t === 'h'
          ? [{ t: 'h', x: e.x - 1, z: e.z }, { t: 'h', x: e.x + 1, z: e.z }]
          : [{ t: 'v', x: e.x, z: e.z - 1 }, { t: 'v', x: e.x, z: e.z + 1 }];
        for (const o of opts) {
          if (o.x < 0 || o.z < 0) continue;
          if (o.t === 'h' && (o.x >= w || o.z > h)) continue;
          if (o.t === 'v' && (o.x > w || o.z >= h)) continue;
          if (getEdge(o) !== E.WALL) continue;
          // casilla de la habitación al lado de esa pared y dirección de la pared vista desde ella
          let tx, tz, dir;
          if (o.t === 'h') {
            if (at(o.x, o.z) === i) { tx = o.x; tz = o.z; dir = 'N'; }
            else if (at(o.x, o.z - 1) === i) { tx = o.x; tz = o.z - 1; dir = 'S'; }
            else continue;
          } else {
            if (at(o.x, o.z) === i) { tx = o.x; tz = o.z; dir = 'W'; }
            else if (at(o.x - 1, o.z) === i) { tx = o.x - 1; tz = o.z; dir = 'E'; }
            else continue;
          }
          cands.push({ x: tx, z: tz, dir });
        }
      }
      r.sw = cands[0] || null;
    }

    // arriba, el hueco de la escalera tiene barandilla en lugar de pared
    if (upper) {
      const si = rooms.findIndex((r) => r.type === 'escalera');
      for (let z = 0; z <= h; z++) {
        for (let x = 0; x < w; x++) {
          const u = at(x, z - 1), d = at(x, z);
          if ((u === si || d === si) && u >= 0 && d >= 0 && hE[z * w + x] === E.WALL) hE[z * w + x] = E.RAIL;
        }
      }
      for (let z = 0; z < h; z++) {
        for (let x = 0; x <= w; x++) {
          const l = at(x - 1, z), r = at(x, z);
          if ((l === si || r === si) && l >= 0 && r >= 0 && vE[z * (w + 1) + x] === E.WALL) vE[z * (w + 1) + x] = E.RAIL;
        }
      }
    }
    return { tiles, hE, vE, rooms };
  }

  const DIRV = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

  function build(def, rng) {
    const bp = buildPlan(def, def, rng, false);
    bp.def = def; bp.w = def.w; bp.h = def.h;
    if (def.up) {
      bp.up = buildPlan(def, def.up, rng, true);
      // escalera: casilla de abajo (donde se empieza a subir) y dirección de subida
      const r = def.rooms[def.stair.room];
      const [dx, dz] = DIRV[def.stair.dir];
      const len = dx ? r[2] : r[3];
      const bx = dx > 0 ? r[0] : (dx < 0 ? r[0] + r[2] - 1 : r[0]);
      const bz = dz > 0 ? r[1] : (dz < 0 ? r[1] + r[3] - 1 : r[1]);
      bp.stair = { x: bx, z: bz, dx, dz, len };
    }
    return bp;
  }

  // ---------- Rotación 90° ----------
  const ROT_DIR = { N: 'E', E: 'S', S: 'W', W: 'N' };

  function rotatePlan(p, w, h) {
    const nw = h, nh = w;
    const tiles = new Int16Array(nw * nh).fill(-1);
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) tiles[x * nw + (h - 1 - z)] = p.tiles[z * w + x];
    }
    const hE = new Uint8Array(nw * (nh + 1));
    const vE = new Uint8Array((nw + 1) * nh);
    // horizontal (x, z) -> vertical en línea x' = h - z, fila z' = x
    for (let z = 0; z <= h; z++) {
      for (let x = 0; x < w; x++) {
        const v = p.hE[z * w + x];
        if (v) vE[x * (nw + 1) + (h - z)] = v;
      }
    }
    // vertical (x, z) -> horizontal en línea z' = x, columna x' = h - z - 1
    for (let z = 0; z < h; z++) {
      for (let x = 0; x <= w; x++) {
        const v = p.vE[z * (w + 1) + x];
        if (v) hE[x * nw + (h - z - 1)] = v;
      }
    }
    const rooms = p.rooms.map((r) => Object.assign({}, r, {
      cx: h - r.cz, cz: r.cx,
      sw: r.sw ? { x: h - 1 - r.sw.z, z: r.sw.x, dir: ROT_DIR[r.sw.dir] } : null
    }));
    return { tiles, hE, vE, rooms };
  }

  function rotate(bp) {
    const w = bp.w, h = bp.h;
    const out = rotatePlan(bp, w, h);
    out.def = bp.def; out.w = h; out.h = w;
    if (bp.up) {
      out.up = rotatePlan(bp.up, w, h);
      const s = bp.stair;
      out.stair = { x: h - 1 - s.z, z: s.x, dx: -s.dz, dz: s.dx, len: s.len };
    }
    return out;
  }

  // Frente: S (sin girar), W, N, E
  const FRONT_ROT = { S: 0, W: 1, N: 2, E: 3 };

  // casa_b2: casa_b1 en espejo (de izquierda a derecha)
  (function () {
    const d = DEFS.find((q) => q.id === 'casa_b1');
    const mir = (rs) => rs.map(([x, z, w, h, t]) => [d.w - x - w, z, w, h, t]);
    const sideM = { e: 'w', w: 'e', n: 'n', s: 's' };
    DEFS.push(Object.assign({}, d, { id: 'casa_b2', rooms: mir(d.rooms), doors: d.doors.map(([r, sd]) => [r, sideM[sd] || sd]),
      up: Object.assign({}, d.up, { rooms: mir(d.up.rooms) }) }));
  })();
  // C y D: B y A en espejo, con tejado a dos aguas (C: arriba, un dormitorio en vez de la terraza; D: balcones cubiertos)
  (function () {
    const derive = (srcId, id, retypeUp) => {
      const d = DEFS.find((q) => q.id === srcId);
      const mir = (rs) => rs.map(([x, z, w, h, t]) => [d.w - x - w, z, w, h, t]);
      const sideM = { e: 'w', w: 'e', n: 'n', s: 's' };
      DEFS.push(Object.assign({}, d, { id, roof: 'gable', openUp: null, rooms: mir(d.rooms), doors: d.doors.map(([r, sd]) => [r, sideM[sd] || sd]),
        up: Object.assign({}, d.up, { rooms: mir(d.up.rooms).map((r) => retypeUp[r[4]] ? r.slice(0, 4).concat(retypeUp[r[4]]) : r) }) }));
    };
    derive('bar_b', 'bar_c', { terraza: 'dormitorio' });
    derive('bar_a', 'bar_d', {});          // (balcones cubiertos delante y detrás, bajo el tejado)
  })();
  function make(id, rng, front) {
    const def = DEFS.find((d) => d.id === id);
    let bp = build(def, rng);
    const r = FRONT_ROT[front || 'S'];
    for (let i = 0; i < r; i++) bp = rotate(bp);
    bp.siding = def.siding || G.Util.pick(rng, SIDING[def.kind]);
    bp.roofColor = def.roofColor || (def.roof === 'flat' ? 0x5e5c58 : G.Util.pick(rng, ROOFS));
    bp.front = front || 'S';
    return bp;
  }

  G.Buildings = {
    E, F, ROOM, DEFS, make, build, rotate,
    COMMON: ['casa1', 'casa2', 'casa3', 'casa4'],
    TWO: ['casa5', 'casa6', 'casa7'],
    SHOPS: ['tienda1', 'tienda2'],
    RARE: ['bomberos', 'policia', 'hospital'],

    // Bloquea caminar (aunque se pueda trepar o abrir)
    blocksWalk(e) {
      return e === E.WALL || e === E.DOOR || e === E.WIN || e === E.WIN_OPEN || e === E.WIN_BROKEN || e === E.FENCE || e === E.RAIL || e === E.CONT;
    },
    blocksSight(e) {
      return e === E.WALL || e === E.DOOR || e === E.CONT;
    },
    climbable(e) {
      return e === E.WIN_OPEN || e === E.WIN_BROKEN || e === E.FENCE;
    }
  };
})(window.Game = window.Game || {});
