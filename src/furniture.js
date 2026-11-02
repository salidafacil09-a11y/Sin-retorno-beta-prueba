(function (G) {
  'use strict';

  // Muebles y vehículos: dónde se colocan, cómo se ven y qué hay dentro.
  // Cada mueble es una caja (AABB) que bloquea el paso; los que son contenedores
  // se pueden registrar (Abrir/Registrar) y sueltan lo que tengan dentro.
  // Se colocan contra las paredes, sin tapar puertas, y comprobando que la
  // habitación siga siendo transitable.

  const U = G.Util;

  // ---------- Tipos ----------
  // w: ancho (a lo largo de la pared) · d: fondo · h: alto · cont: tipo de contenedor (o null)
  // tall: no va delante de ventanas · block: la casilla queda ocupada para los zombis
  const T = {
    cama: { w: 1.45, d: 2.0, h: 0.55, cont: null, block: true },
    cama1: { w: 0.95, d: 2.0, h: 0.55, cont: null, block: true },
    mesita: { w: 0.45, d: 0.42, h: 0.55, cont: 'mesita' },
    comoda: { w: 1.2, d: 0.5, h: 0.9, cont: 'comoda' },
    armario: { w: 1.0, d: 0.6, h: 1.95, cont: 'armario', tall: true, block: true },
    sofa: { w: 1.9, d: 0.85, h: 0.85, cont: null, block: true },
    sillon: { w: 0.85, d: 0.85, h: 0.85, cont: null, block: true },
    mueble_tv: { w: 1.4, d: 0.45, h: 0.55, cont: 'mueble_tv' },
    estanteria: { w: 0.9, d: 0.35, h: 1.9, cont: 'estanteria', tall: true },
    encimera: { w: 1.0, d: 0.6, h: 0.92, cont: 'armario_cocina', block: true },
    fregadero: { w: 1.0, d: 0.6, h: 0.92, cont: 'armario_cocina', block: true },
    fogon: { w: 0.7, d: 0.6, h: 0.92, cont: null, block: true },
    nevera: { w: 0.72, d: 0.68, h: 1.8, cont: 'nevera', tall: true, block: true },
    mesa: { w: 1.5, d: 0.9, h: 0.76, cont: null, block: true, center: true },
    inodoro: { w: 0.42, d: 0.62, h: 0.78, cont: null },
    lavabo: { w: 0.6, d: 0.45, h: 0.88, cont: 'botiquin' },
    banera: { w: 1.6, d: 0.75, h: 0.58, cont: null, block: true },
    lavadora: { w: 0.62, d: 0.6, h: 0.86, cont: null },
    banco: { w: 1.7, d: 0.7, h: 0.92, cont: 'banco', block: true },
    caja_herr: { w: 0.6, d: 0.35, h: 0.32, cont: 'caja_herr' },
    escritorio: { w: 1.3, d: 0.65, h: 0.76, cont: 'escritorio', block: true },
    archivador: { w: 0.5, d: 0.62, h: 1.3, cont: 'archivador', tall: true },
    taquilla: { w: 0.48, d: 0.5, h: 1.85, cont: 'taquilla', tall: true },
    armero: { w: 1.1, d: 0.5, h: 1.9, cont: 'armero', tall: true },
    camilla: { w: 0.9, d: 2.0, h: 0.7, cont: null, block: true },
    carrito: { w: 0.6, d: 0.45, h: 0.9, cont: 'carrito' },
    mostrador: { w: 2.2, d: 0.7, h: 1.0, cont: 'mostrador', block: true, center: true },
    gondola: { w: 3.0, d: 0.7, h: 1.55, cont: 'estante', block: true, center: true },
    estante: { w: 1.8, d: 0.55, h: 2.0, cont: 'estante', tall: true, block: true },
    cajas: { w: 0.8, d: 0.8, h: 0.62, cont: 'cajas' },
    banco_espera: { w: 1.8, d: 0.55, h: 0.5, cont: null },
    // refugio (modo Retorno): mesa del mapa con el corcho detrás, cofre de recompensas, puesto de comercio y
    // banco de mejoras con su tapete
    mesa_mapa: { w: 2.0, d: 0.9, h: 0.8, cont: null, block: true },
    cofre: { w: 1.3, d: 0.64, h: 0.5, cont: null, block: true },
    puesto: { w: 2.0, d: 0.6, h: 2.05, cont: null, block: true, tall: true },      // comercio: armario lleno de armas
    banco_mej: { w: 2.0, d: 0.8, h: 0.92, cont: null, block: true },
    // vehículos (no funcionan; algunos tienen un cofre que se puede registrar)
    // ---- mapas (terminal de carga, calles, escuela): contenedores de carga (solo se dibujan: los costados son
    // aristas CONT), tanques, palés, lonas, barreras, bidones, tubos, bloques, charcos y vehículos abandonados
    cont6: { w: 6.0, d: 2.36, h: 2.6, cont: null, deco: true },
    cont12: { w: 12.0, d: 2.36, h: 2.6, cont: null, deco: true },
    ibc: { w: 1.2, d: 1.0, h: 1.16, cont: null, block: true },
    palets: { w: 1.2, d: 1.0, h: 0.72, cont: null, block: true },
    lona: { w: 1.9, d: 1.3, h: 1.1, cont: null, block: true },
    barrera: { w: 2.0, d: 0.62, h: 0.82, cont: null, block: true },
    bidones: { w: 1.3, d: 0.7, h: 0.92, cont: null, block: true },
    tubo: { w: 2.2, d: 1.2, h: 1.2, cont: null, block: true },
    bloques: { w: 1.2, d: 0.9, h: 0.88, cont: null, block: true },
    charco: { w: 3.0, d: 2.0, h: 0.01, cont: null, deco: true, flat: true },
    // ---- barrio de casas: jardineras de piedra, cubos de basura, cobertizo, muros bajos (de largo libre),
    // porches (solo se ven: los postes son muebles aparte) y postes
    jardinera: { w: 2.4, d: 1.1, h: 0.72, cont: null, block: true },
    cubos: { w: 1.4, d: 0.75, h: 1.12, cont: null, block: true },
    cobertizo: { w: 2.4, d: 2.0, h: 2.3, cont: null, block: true, tall: true },
    muro_bajo: { w: 3.0, d: 0.3, h: 0.95, cont: null, block: true, sized: true },
    porche: { w: 4.0, d: 1.8, h: 0.3, cont: null, deco: true, sized: true, noShadow: true },
    poste: { w: 0.16, d: 0.16, h: 2.7, cont: null, block: true, tall: true },
    // rastros de supervivientes, árboles caídos, hierba que crece entre el asfalto y cascotes del edificio caído
    fogata: { w: 1.2, d: 1.2, h: 0.3, cont: null, deco: true, noShadow: true },
    barricada: { w: 2.2, d: 0.5, h: 1.15, cont: null, block: true },
    tarima: { w: 2.4, d: 2.4, h: 1.3, cont: null, block: true },
    tablas: { w: 2.0, d: 0.9, h: 0.45, cont: null, block: true },
    refugio_lona: { w: 2.6, d: 2.0, h: 1.7, cont: null, block: true, tall: true },
    arbol_caido: { w: 6.5, d: 1.3, h: 0.95, cont: null, block: true },
    cesped: { w: 2.0, d: 1.0, h: 0.06, cont: null, deco: true, flat: true, sized: true },
    losa: { w: 3.0, d: 2.2, h: 1.2, cont: null, block: true },
    escombro_grande: { w: 2.2, d: 1.8, h: 0.9, cont: null, block: true },
    // edificio de fuera de la valla (tapa el horizonte): solo la fachada que da al mapa, con todo su detalle
    // ---- supermercado (mapa): góndolas, fruteros, cajas de fruta, congeladores, vitrinas, cajas registradoras,
    // el aire acondicionado caído del techo, vigas y planchas del techo hundido, nieve, carritos y carteles colgados
    gondola: { w: 3.0, d: 1.0, h: 1.9, cont: null, block: true, tall: true },
    gondola_caida: { w: 3.0, d: 1.6, h: 0.7, cont: null, block: true },
    frutero: { w: 2.4, d: 1.5, h: 0.95, cont: null, block: true },
    cajas_fruta: { w: 1.4, d: 1.0, h: 1.25, cont: null, block: true },
    congelador: { w: 2.2, d: 1.0, h: 0.9, cont: null, block: true },
    vitrina: { w: 2.0, d: 0.8, h: 2.1, cont: null, block: true, tall: true },
    caja_reg: { w: 2.6, d: 0.9, h: 1.0, cont: null, block: true },
    aire_caido: { w: 2.4, d: 1.7, h: 1.45, cont: null, block: true },
    vigas: { w: 4.0, d: 1.6, h: 1.4, cont: null, block: true, sized: true },
    nieve: { w: 3.0, d: 2.0, h: 0.05, cont: null, deco: true, flat: true, sized: true },
    monton_nieve: { w: 3.0, d: 2.2, h: 0.7, cont: null, block: true, sized: true, noShadow: true },
    carrito: { w: 0.6, d: 0.95, h: 1.0, cont: null, block: true },
    cartel_colgante: { w: 2.6, d: 0.1, h: 0.5, cont: null, deco: true, noShadow: true },
    cadaveres: { w: 2.6, d: 2.2, h: 0.85, cont: null, block: true },    // montón de chasqueadores quemados
    fachada: { w: 20, d: 4, h: 12, cont: null, deco: true, sized: true, noShadow: true },
    // ---- asentamiento en la playa (los Escorpiones): palmeras, el bote y la balsa, rocas, sacos terreros,
    // tiendas, sacos de dormir, tendederos, mesas con comida, armeros, barriles con fuego, la sala de vigilancia y
    // lo del museo (columnas, el esqueleto de dinosaurio, pedestales y cuadros)
    palmera: { w: 0.6, d: 0.6, h: 7.0, cont: null, block: true, tall: true },
    bote: { w: 3.6, d: 1.4, h: 0.8, cont: null, block: true },
    balsa: { w: 3.2, d: 2.4, h: 0.7, cont: null, block: true },
    roca: { w: 1.8, d: 1.4, h: 1.0, cont: null, block: true, sized: true },
    pena: { w: 3.0, d: 2.4, h: 2.2, cont: null, block: true, sized: true, tall: true },
    pilar: { w: 0.8, d: 0.8, h: 3.0, cont: null, block: true, tall: true },
    arco: { w: 7.6, d: 0.4, h: 4.2, cont: null, deco: true },
    sacos: { w: 2.4, d: 0.6, h: 0.85, cont: null, block: true, sized: true },
    saco_dormir: { w: 0.8, d: 2.0, h: 0.16, cont: null, deco: true, noShadow: true },
    tienda: { w: 2.4, d: 2.6, h: 1.6, cont: null, block: true, tall: true },
    tendedero: { w: 3.2, d: 0.3, h: 1.9, cont: null, deco: true, noShadow: true },
    mesa_campo: { w: 1.9, d: 0.9, h: 0.78, cont: null, block: true },
    armero: { w: 1.6, d: 0.5, h: 1.6, cont: null, block: true, tall: true },
    barril_fuego: { w: 0.7, d: 0.7, h: 0.95, cont: null, block: true },
    fogata_viva: { w: 1.4, d: 1.4, h: 0.9, cont: null, deco: true, noShadow: true },
    consola: { w: 2.2, d: 0.8, h: 1.4, cont: null, block: true },
    columna: { w: 0.8, d: 0.8, h: 5.2, cont: null, block: true, tall: true },
    esqueleto: { w: 6.0, d: 2.2, h: 3.4, cont: null, block: true, tall: true },
    pedestal: { w: 0.7, d: 0.7, h: 1.6, cont: null, block: true },
    cuadro: { w: 1.6, d: 0.06, h: 1.2, cont: null, deco: true, noShadow: true },
    banco_parque: { w: 1.8, d: 0.6, h: 0.85, cont: null, block: true },
    // ---- barrio (calles, gasolinera y plaza): marquesina y surtidores, cartel de precios, neumáticos, fuente,
    // columpios, tobogán, setos, buzones, semáforos, señales, bocas de incendio, pasos de cebra, parada de autobús,
    // papeleras y el quiosco
    marquesina: { w: 9.0, d: 6.0, h: 4.4, cont: null, deco: true, sized: true },
    surtidor: { w: 0.9, d: 0.55, h: 1.7, cont: null, block: true },
    cartel_precios: { w: 1.4, d: 0.3, h: 5.0, cont: null, block: true, tall: true },
    neumaticos: { w: 0.9, d: 0.9, h: 1.0, cont: null, block: true },
    fuente: { w: 4.0, d: 4.0, h: 1.6, cont: null, block: true },
    columpio: { w: 3.4, d: 1.8, h: 2.3, cont: null, block: true, tall: true },
    tobogan: { w: 1.0, d: 3.6, h: 2.2, cont: null, block: true, tall: true },
    seto: { w: 3.0, d: 0.7, h: 1.0, cont: null, block: true, sized: true },
    buzon: { w: 0.35, d: 0.35, h: 1.2, cont: null, block: true, tall: true },
    semaforo: { w: 0.3, d: 0.3, h: 3.6, cont: null, block: true, tall: true },
    senal: { w: 0.25, d: 0.25, h: 2.5, cont: null, block: true, tall: true },
    hidrante: { w: 0.4, d: 0.4, h: 0.75, cont: null, block: true },
    paso_cebra: { w: 4.0, d: 3.0, h: 0.01, cont: null, deco: true, flat: true, sized: true, noShadow: true },
    parada: { w: 3.2, d: 1.4, h: 2.5, cont: null, block: true, tall: true },
    papelera: { w: 0.45, d: 0.45, h: 0.9, cont: null, block: true },
    kiosco: { w: 2.4, d: 2.0, h: 2.6, cont: null, block: true, tall: true },
    valla_rota: { w: 2.0, d: 0.2, h: 1.0, cont: null, block: true, sized: true },
    persiana: { w: 3.0, d: 0.12, h: 3.4, cont: null, deco: true, noShadow: true },
    galpon: { w: 14.0, d: 5.0, h: 7.5, cont: null, deco: true, noShadow: true },
    // ---- salón recreativo (jefe final): máquinas, pinball, grúa de peluches, hockey de aire, cambiador, máquinas
    // volcadas, hongos sobre la moqueta, escombros y hongo en las paredes
    maquina: { w: 0.8, d: 0.78, h: 1.85, cont: null, block: true, tall: true, smash: true },
    maquina_rota: { w: 1.85, d: 0.8, h: 0.8, cont: null, block: true, smash: true },
    pinball: { w: 0.75, d: 1.45, h: 1.38, cont: null, block: true, smash: true },
    hockey: { w: 1.2, d: 2.1, h: 0.85, cont: null, block: true, smash: true },
    grua: { w: 0.95, d: 0.95, h: 1.95, cont: null, block: true, tall: true, smash: true },
    cambio: { w: 0.6, d: 0.45, h: 1.6, cont: null, tall: true, smash: true },
    hongos: { w: 2.2, d: 1.6, h: 0.3, cont: null, deco: true, flat: true, noShadow: true },
    escombros: { w: 1.6, d: 1.2, h: 0.3, cont: null, deco: true, flat: true, noShadow: true },
    hongo_pared: { w: 2.0, d: 0.3, h: 2.4, cont: null, deco: true, noShadow: true },
    // modo libre: panel de pared con los mapas (se elige a cuál ir)
    tablero: { w: 2.4, d: 0.25, h: 2.3, cont: null, block: true, tall: true },
    // ---- Asentamiento de Oceanside (el pueblo de la costa que dejaron los Escorpiones): torre de socorrista,
    // plantas de la costa (uña de gato y agaves), tablas de surf, tumbas, vías del tren, aros de fuego de la
    // playa y tablones pintados (lo escrito lo pone G.Maps)
    socorrista: { w: 2.4, d: 3.8, h: 3.6, cont: null, block: true, tall: true },
    planta_hielo: { w: 2.0, d: 1.0, h: 0.12, cont: null, deco: true, flat: true, sized: true, noShadow: true },
    agave: { w: 1.0, d: 1.0, h: 0.9, cont: null, block: true },
    surf: { w: 1.5, d: 0.7, h: 2.0, cont: null, block: true, tall: true },
    tumba: { w: 0.9, d: 1.9, h: 1.1, cont: null, block: true },
    vias: { w: 4.0, d: 2.2, h: 0.16, cont: null, deco: true, flat: true, sized: true, noShadow: true },
    aro_fuego: { w: 1.3, d: 1.3, h: 0.45, cont: null, block: true },
    cartel_madera: { w: 2.4, d: 0.3, h: 2.2, cont: null, block: true, tall: true },
    // ---- Red del Capitolio: celdas improvisadas (rejas soldadas de chatarra, puertas de reja con cadena y
    // candado, tabiques de chapa y contrachapado), colchones en el suelo, los postes de las cadenas de los
    // chasqueadores y la estatua de la plaza (thru: se ve a través)
    reja: { w: 2.0, d: 0.12, h: 2.5, cont: null, block: true, sized: true, thru: true, tall: true },
    reja_puerta: { w: 1.1, d: 0.12, h: 2.4, cont: null, block: true, thru: true, tall: true },
    tabique: { w: 2.0, d: 0.1, h: 2.5, cont: null, block: true, sized: true, tall: true },
    colchon: { w: 0.9, d: 1.9, h: 0.14, cont: null, deco: true, noShadow: true },
    poste_cadena: { w: 0.3, d: 0.3, h: 1.2, cont: null, block: true },
    estatua: { w: 1.6, d: 1.6, h: 3.6, cont: null, block: true, tall: true },
    camioneta: { w: 2.0, d: 5.3, h: 1.85, cont: 'maletero', block: true, vehicle: true },
    coche: { w: 1.8, d: 4.4, h: 1.45, cont: 'maletero', block: true, vehicle: true },
    montacargas: { w: 1.2, d: 2.7, h: 2.25, cont: 'maletero', block: true, vehicle: true },
    camion: { w: 2.5, d: 7.4, h: 3.0, cont: 'cofre_camion', block: true, vehicle: true },
    patrulla: { w: 1.85, d: 4.6, h: 1.5, cont: 'maletero', block: true, vehicle: true },
    ambulancia: { w: 2.1, d: 5.6, h: 2.6, cont: 'ambulancia', block: true, vehicle: true }
  };

  // ---------- Contenedores: nombre y botín ----------
  // chance: probabilidad de que haya algo · table: pesos · fixed: siempre · extra: [id, probabilidad]
  const C = {
    mesita: { name: 'Mesita de noche', chance: 0.45, table: { mun_9mm: 1.8, pistola: 0.8, cuchillo_caza: 0.6, destornillador: 1, silenciador: 0.08 } },
    comoda: { name: 'Cómoda', chance: 0.32, table: { mun_9mm: 1.2, mun_cartucho: 1, cuchillo: 1, pistola: 0.3 } },
    armario: { name: 'Armario', chance: 0.45, table: { bate: 3, golf: 2, bate_clavos: 0.6, katana: 0.15, escopeta: 0.122, mun_cartucho: 1.5, pistola: 0.6, mun_9mm: 0.6 } },
    armario_cabana: { name: 'Armario', chance: 0.85, table: { rifle: 0.525, arco: 0.525, mun_rifle: 2, mun_flecha: 2, machete: 1, hacha_mano: 1, cuchillo_caza: 1 } },
    armario_cocina: { name: 'Armario de cocina', chance: 0.4, table: { cuchillo: 4, cuchilla: 1.5, sarten: 2, rodillo: 2 } },
    nevera: { name: 'Nevera', chance: 0, table: {} },
    botiquin: { name: 'Mueble del lavabo', chance: 0.1, table: { destornillador: 1 } },
    mueble_tv: { name: 'Mueble de la tele', chance: 0.25, table: { mun_9mm: 0.6, destornillador: 1, pistola: 0.25 } },
    estanteria: { name: 'Estantería', chance: 0.25, table: { mun_9mm: 0.6, mun_flecha: 0.6, golf: 0.4, mun_rifle: 0.4 } },
    escritorio: { name: 'Escritorio', chance: 0.4, table: { mun_9mm: 1.2, pistola: 0.45, destornillador: 1.5, cuchillo: 0.5 } },
    archivador: { name: 'Archivador', chance: 0.3, table: { porra: 1, mun_9mm: 0.6, destornillador: 0.5 } },
    banco: { name: 'Banco de trabajo', chance: 0.85, table: { martillo: 3, llave: 3, palanca: 2, tubo: 2, destornillador: 2, hacha_mano: 1.5, mazo: 0.5, mun_cartucho: 0.6, silenciador: 0.12 } },
    caja_herr: { name: 'Caja de herramientas', chance: 0.75, table: { martillo: 2, llave: 2, destornillador: 2 } },
    taquilla: { name: 'Taquilla', chance: 0.5, table: { porra: 2, mun_9mm: 1.2, mun_cartucho: 1, cuchillo_caza: 0.5 } },
    taquilla_bomberos: { name: 'Taquilla', chance: 0.55, table: { palanca: 2, hacha_mano: 1, mun_9mm: 0.3, cuchillo_caza: 0.5 } },
    armero: { name: 'Armero', extra: [['pistola', 0.6], ['escopeta', 0.3], ['mun_9mm', 0.5], ['mun_cartucho', 0.6], ['rifle', 0.06], ['mun_rifle', 0.15], ['silenciador', 0.2], ['venda', 0.2]] },
    carrito: { name: 'Carrito', chance: 0.3, table: { cuchillo: 1, destornillador: 1 } },
    mostrador: { name: 'Mostrador', chance: 0.4, table: { pistola: 1.2, mun_9mm: 1.2, cuchillo: 0.6, porra: 0.3 } },
    mostrador_recepcion: { name: 'Mostrador', chance: 0.35, table: { porra: 1, mun_9mm: 0.9, destornillador: 0.5 } },
    estante: { name: 'Estante', chance: 0.12, table: { mun_9mm: 0.6, cuchillo: 1, rodillo: 1 } },
    cajas: { name: 'Cajas', chance: 0.3, table: { mun_cartucho: 1, mun_9mm: 0.6, palanca: 1, tabla: 1 } },
    cofre_camion: { name: 'Cofre del camión', fixed: ['hacha_bombero'], extra: [['palanca', 0.35], ['hacha_bombero', 0.15]] },
    maletero: { name: 'Maletero de la patrulla', chance: 0.65, table: { escopeta: 0.28, mun_cartucho: 2, porra: 1, mun_9mm: 0.6 } },
    ambulancia: { name: 'Ambulancia', chance: 0.25, table: { cuchillo: 1, destornillador: 1 } }
  };

  // Vendas, alcohol y la mochila: tiradas aparte en ciertos muebles [id, probabilidad]
  const SUPPLIES = {
    botiquin: [['venda', 0.12], ['alcohol', 0.5], ['trapo', 0.3]], mesita: [['venda', 0.1]], comoda: [['venda', 0.06]],
    armario: [['mochila', 0.12], ['venda', 0.05]], armario_cabana: [['mochila', 0.15], ['venda', 0.15]],
    armario_cocina: [['alcohol', 0.12], ['trapo', 0.15]], estanteria: [['alcohol', 0.05]], mostrador: [['trapo', 0.08]],
    carrito: [['venda', 0.5]], ambulancia: [['venda', 0.7]],
    taquilla: [['venda', 0.15], ['mochila', 0.12]], taquilla_bomberos: [['venda', 0.25], ['mochila', 0.12]],
    banco: [['mochila', 0.08]], cajas: [['mochila', 0.1], ['venda', 0.06]], estante: [['venda', 0.05], ['mochila', 0.05]],
    maletero: [['venda', 0.3], ['mina', 0.05]], archivador: [['venda', 0.04]],
    // explosivos: escasos (la mina, rarísima)
    escritorio: [['clavos', 0.1]]
  };
  // materiales de explosivos repartidos en otros muebles [id, probabilidad]
  const EXTRA_SUP = {
    botiquin: [['clavos', 0.15]], mesita: [['clavos', 0.06], ['trapo', 0.1]], comoda: [['trapo', 0.12], ['clavos', 0.04]],
    armario: [['trapo', 0.1]], cajas: [['polvo', 0.05], ['mina', 0.02]], banco: [['polvo', 0.06]], estante: [['polvo', 0.03]],
    taquilla: [['polvo', 0.04], ['mina', 0.015]], armario_cocina: [['polvo', 0.02], ['clavos', 0.05]], mostrador: [['clavos', 0.04]]
  };
  for (const k in EXTRA_SUP) SUPPLIES[k] = (SUPPLIES[k] || []).concat(EXTRA_SUP[k]);

  function rollLoot(kind, rng, opts) {
    if (G.LOOT_ON === false) return [];          // botín guardado para después (mundo de pruebas)
    const c = C[kind];
    if (!c) return [];
    const out = [];
    if (c.fixed) out.push(...c.fixed);
    if (c.extra) for (const [id, p] of c.extra) if (rng() < p) out.push(id);
    if (SUPPLIES[kind]) for (const [id, p] of SUPPLIES[kind]) if (rng() < p) out.push(id);
    if (c.table && c.chance && rng() < c.chance) {
      let table = c.table;
      // en las casas de dos pisos es algo más fácil encontrar una pistola
      if (opts && opts.two && table.pistola) table = Object.assign({}, table, { pistola: table.pistola * 1.8 });
      out.push(U.weighted(rng, table));
      if (rng() < 0.18) out.push(U.weighted(rng, table));
    }
    // casas de una planta: menos pistolas y munición
    if (opts && opts.common) return out.filter((id) => !G.Weapons.commonHouseCut(id) || rng() < G.Weapons.COMMON_KEEP);
    return out;
  }

  // ---------- Qué muebles lleva cada habitación ----------
  // [tipo, cuántos, colocación] · colocación: 'wall' contra la pared, 'bed' cabecera contra la pared,
  // 'center' en medio, 'rows' filas de góndolas
  const SETS = {
    dormitorio: [['cama', 1, 'bed'], ['mesita', 2, 'wall'], ['armario', 1, 'wall'], ['comoda', 1, 'wall']],
    sala: [['sofa', 1, 'wall'], ['mueble_tv', 1, 'wall'], ['estanteria', 1, 'wall'], ['sillon', 1, 'wall']],
    comedor: [['mesa', 1, 'center'], ['estanteria', 1, 'wall'], ['comoda', 1, 'wall']],
    cocina: [['nevera', 1, 'wall'], ['fogon', 1, 'wall'], ['fregadero', 1, 'wall'], ['encimera', 3, 'wall']],
    bano: [['inodoro', 1, 'wall'], ['lavabo', 1, 'wall'], ['banera', 1, 'wall']],
    garaje: [['banco', 1, 'wall'], ['caja_herr', 1, 'wall'], ['estante', 1, 'wall']],
    lavadero: [['lavadora', 1, 'wall'], ['estante', 1, 'wall'], ['caja_herr', 1, 'wall']],
    estudio: [['escritorio', 1, 'wall'], ['estanteria', 2, 'wall'], ['sillon', 1, 'wall']],
    recibidor: [['comoda', 1, 'wall']],
    cabana: [['cama1', 1, 'bed'], ['armario', 1, 'wall', 'armario_cabana'], ['mesa', 1, 'center'], ['banco', 1, 'wall'], ['fogon', 1, 'wall']],
    oficina: [['escritorio', 2, 'wall'], ['archivador', 2, 'wall'], ['estanteria', 1, 'wall']],
    archivo: [['archivador', 4, 'wall'], ['estante', 1, 'wall']],
    recepcion: [['mostrador', 1, 'center', 'mostrador_recepcion'], ['banco_espera', 1, 'wall']],
    espera: [['banco_espera', 2, 'wall']],
    habitacion: [['camilla', 2, 'bed'], ['mesita', 1, 'wall'], ['carrito', 1, 'wall']],
    quirofano: [['camilla', 1, 'center'], ['carrito', 2, 'wall']],
    celda: [['cama1', 1, 'bed'], ['inodoro', 1, 'wall']],
    tienda: [['mostrador', 1, 'counter'], ['gondola', 3, 'rows'], ['estante', 2, 'wall'], ['nevera', 2, 'wall']],
    almacen: [['estante', 3, 'wall'], ['cajas', 3, 'wall']],
    nave: [['banco', 2, 'wall'], ['estante', 3, 'wall'], ['taquilla', 2, 'wall'], ['nevera', 1, 'wall'], ['cajas', 3, 'wall'], ['caja_herr', 1, 'wall']]
  };
  // especiales según el edificio
  const SPECIAL = {
    policia: { oficina: [['armero', 1, 'wall'], ['escritorio', 2, 'wall'], ['taquilla', 2, 'wall']] },
    bomberos: { dormitorio: [['cama1', 2, 'bed'], ['taquilla', 3, 'wall', 'taquilla_bomberos']] },
    // la Red del Capitolio: las celdas, la rotonda y los pasillos los amuebla el mapa; el resto, poca cosa
    capitolio: { celda: [], rotonda: [], galeria: [], recepcion: [], comedor: [], camara: [], deposito: [], armeria: [],
      almacen: [['estante', 2, 'wall'], ['cajas', 2, 'wall']], dormitorio: [['cama1', 4, 'bed'], ['taquilla', 2, 'wall']],
      cocina: [['fogon', 1, 'wall'], ['fregadero', 1, 'wall'], ['encimera', 2, 'wall']], oficina: [['escritorio', 1, 'wall'], ['archivador', 2, 'wall']],
      archivo: [['archivador', 3, 'wall'], ['estante', 1, 'wall']] },
    hospital: { recepcion: [['mostrador', 1, 'center', 'mostrador_recepcion'], ['archivador', 1, 'wall']] }
  };

  // ---------- Colocación ----------
  // c: chunk en generación (se usan sus tablas locales); b: edificio; room: habitación; lv: planta
  // tiles: casillas locales del chunk [x, z] de esa habitación
  function furnishRoom(c, b, room, lv, tiles, rng, CS, E) {
    const set = (SPECIAL[b.kind] && SPECIAL[b.kind][room.type]) || SETS[room.type];
    if (!set || !tiles.length) return;
    const L = lv ? c.up : c;
    const idx = (x, z) => z * CS + x;
    const inRoom = new Set(tiles.map(([x, z]) => idx(x, z)));
    const eN = (x, z) => L.eN[idx(x, z)], eW = (x, z) => L.eW[idx(x, z)];
    const blocked = new Set();              // casillas ocupadas por muebles grandes
    const reserved = new Set();             // delante de puertas y escaleras
    const isOpen = (e) => e === E.DOOR || e === E.DOOR_OPEN || e === E.DOOR_BROKEN || e === E.ARCH || e === E.RAIL || e === 11;
    const isWallLike = (e, tall) => e === E.WALL || (!tall && e === E.WIN);
    // lados de cada casilla: [arista, dirección hacia dentro de la habitación (fx, fz), vecino]
    const sides = (x, z) => [
      { e: eN(x, z), fx: 0, fz: 1, nx: x, nz: z - 1, side: 'N' },
      { e: eN(x, z + 1), fx: 0, fz: -1, nx: x, nz: z + 1, side: 'S' },
      { e: eW(x, z), fx: 1, fz: 0, nx: x - 1, nz: z, side: 'W' },
      { e: eW(x + 1, z), fx: -1, fz: 0, nx: x + 1, nz: z, side: 'E' }
    ];
    for (const [x, z] of tiles) {
      for (const s of sides(x, z)) {
        if (isOpen(s.e) || (c.stairMap && c.stairMap[idx(x, z)])) {
          reserved.add(idx(x, z));
          // y la casilla siguiente hacia dentro
          const ix = x + s.fx, iz = z + s.fz;
          if (inRoom.has(idx(ix, iz))) reserved.add(idx(ix, iz));
        }
      }
    }
    const free = (x, z) => inRoom.has(idx(x, z)) && !blocked.has(idx(x, z)) && !reserved.has(idx(x, z));

    // ¿Siguen conectadas todas las casillas libres de la habitación?
    const connected = (extra) => {
      const open = tiles.filter(([x, z]) => !blocked.has(idx(x, z)) && !extra.has(idx(x, z)));
      if (!open.length) return false;
      const seen = new Set([idx(open[0][0], open[0][1])]);
      const q = [open[0]];
      while (q.length) {
        const [x, z] = q.pop();
        for (const s of sides(x, z)) {
          if (s.e && !isOpen(s.e)) continue;
          const k = idx(s.nx, s.nz);
          if (!inRoom.has(k) || seen.has(k) || blocked.has(k) || extra.has(k)) continue;
          seen.add(k); q.push([s.nx, s.nz]);
        }
      }
      return seen.size === open.length;
    };

    const placed = [];
    const ox = c.cx * CS, oz = c.cz * CS;
    const base = (b.baseY || 0) + (lv ? G.World.FLOOR_H : 0);
    const add = (type, x0, z0, x1, z1, fx, fz, contKind) => {
      const t = T[type];
      const f = {
        type, lv, x0: ox + x0, z0: oz + z0, x1: ox + x1, z1: oz + z1, y: base, h: t.h,
        fx, fz, solid: true, cont: null, seed: Math.floor(rng() * 1e9)
      };
      const ck = contKind || t.cont;
      if (ck && C[ck]) {
        f.cont = { kind: ck, name: C[ck].name, items: rollLoot(ck, rng, { two: b.floors === 2, common: b.kind === 'casa' && b.floors !== 2 }), searched: false };
      }
      placed.push(f);
      c.furn.push(f);
      return f;
    };

    // ¿pisa otro mueble ya puesto? (esquinas: dos muebles contra paredes distintas se cruzaban)
    const clash = (x0, z0, x1, z1) => c.furn.some((g) => (g.lv || 0) === lv && g.solid && !g.gone &&
      ox + x0 < g.x1 - 0.02 && ox + x1 > g.x0 + 0.02 && oz + z0 < g.z1 - 0.02 && oz + z1 > g.z0 + 0.02);
    const WT = 0.07;      // medio grosor de pared
    for (const [type, count, mode, contKind] of set) {
      const t = T[type];
      for (let n = 0; n < count; n++) {
        let done = false;
        for (let attempt = 0; attempt < 24 && !done; attempt++) {
          if (mode === 'wall' || mode === 'bed') {
            // una casilla junto a una pared adecuada
            const [x, z] = U.pick(rng, tiles);
            if (!free(x, z)) continue;
            const opts = sides(x, z).filter((s) => isWallLike(s.e, t.tall) && !(s.e === E.WIN && mode === 'bed'));
            if (!opts.length) continue;
            const s = U.pick(rng, opts);
            const ax = s.fz !== 0;                      // la pared corre a lo largo de x
            const along = mode === 'bed' ? t.w : t.w, depth = t.d;
            const nAlong = Math.max(1, Math.ceil(along - 0.02)), nDepth = Math.max(1, Math.ceil(depth - 0.02));
            // casillas que ocupa (a lo largo de la pared y hacia dentro)
            const cells = [];
            let ok = true;
            for (let i = 0; i < nAlong && ok; i++) {
              for (let j = 0; j < nDepth && ok; j++) {
                const cx = ax ? x + i : x + s.fx * j, cz = ax ? z + s.fz * j : z + i;
                if (!free(cx, cz)) { ok = false; break; }
                // la pared tiene que seguir a lo largo de todo el mueble
                if (j === 0 && !isWallLike(sides(cx, cz).find((q) => q.side === s.side).e, t.tall)) ok = false;
                cells.push(idx(cx, cz));
              }
            }
            if (!ok) continue;
            const blocks = t.block || depth > 0.55;
            const ext = new Set(blocks ? cells : []);
            if (blocks && !connected(ext)) continue;
            // rectángulo del mueble: pegado a la pared, centrado en las casillas que ocupa
            let x0, z0, x1, z1;
            if (ax) {
              const xc = x + nAlong / 2;
              x0 = xc - along / 2; x1 = xc + along / 2;
              if (s.fz > 0) { z0 = z + WT; z1 = z0 + depth; } else { z1 = z + 1 - WT; z0 = z1 - depth; }
            } else {
              const zc = z + nAlong / 2;
              z0 = zc - along / 2; z1 = zc + along / 2;
              if (s.fx > 0) { x0 = x + WT; x1 = x0 + depth; } else { x1 = x + 1 - WT; x0 = x1 - depth; }
            }
            if (clash(x0, z0, x1, z1)) continue;
            if (blocks) for (const k of cells) blocked.add(k);
            else for (const k of cells) reserved.add(k);     // no apilar dos muebles en la misma casilla
            add(type, x0, z0, x1, z1, s.fx, s.fz, contKind);
            done = true;
          } else if (mode === 'center' || mode === 'counter') {
            // en medio de la habitación, dejando paso alrededor
            const xs = tiles.map((q) => q[0]), zs = tiles.map((q) => q[1]);
            const rx0 = Math.min(...xs), rx1 = Math.max(...xs) + 1, rz0 = Math.min(...zs), rz1 = Math.max(...zs) + 1;
            const W = rx1 - rx0, H = rz1 - rz0;
            if (Math.min(W, H) < 3) break;
            const alongX = W >= H;
            const along = t.w, depth = t.d;
            let xc = (rx0 + rx1) / 2 + (rng() - 0.5) * 0.4, zc = (rz0 + rz1) / 2 + (rng() - 0.5) * 0.4;
            if (mode === 'counter') {
              // mostrador cerca de la entrada, a un lado
              const doorSide = sideOfDoor(tiles, sides, isOpen, E);
              if (doorSide) {
                if (doorSide.fz) zc = (doorSide.fz > 0 ? rz0 + 1.6 : rz1 - 1.6);
                else xc = (doorSide.fx > 0 ? rx0 + 1.6 : rx1 - 1.6);
                if (doorSide.fz) xc = rx0 + 2.2; else zc = rz0 + 2.2;
              }
            }
            const hw = (alongX ? along : depth) / 2, hd = (alongX ? depth : along) / 2;
            const x0 = xc - hw, x1 = xc + hw, z0 = zc - hd, z1 = zc + hd;
            const cells = [];
            for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) cells.push(idx(x, z));
            if (cells.some((k) => !inRoom.has(k) || blocked.has(k) || reserved.has(k))) break;
            const ext = new Set(cells);
            if (!connected(ext)) break;
            if (clash(x0, z0, x1, z1)) break;
            for (const k of cells) blocked.add(k);
            add(type, x0, z0, x1, z1, alongX ? 0 : 1, alongX ? 1 : 0, contKind);
            done = true;
          } else if (mode === 'rows') {
            // góndolas de la tienda: filas paralelas al lado largo, con pasillos
            const xs = tiles.map((q) => q[0]), zs = tiles.map((q) => q[1]);
            const rx0 = Math.min(...xs), rx1 = Math.max(...xs) + 1, rz0 = Math.min(...zs), rz1 = Math.max(...zs) + 1;
            const W = rx1 - rx0, H = rz1 - rz0;
            const alongX = W >= H;
            const span = alongX ? H : W, len = alongX ? W : H;
            const rows = [];
            for (let r = 1.5; r < span - 2.5; r += 2) rows.push(r);
            if (n >= rows.length) break;
            const r = rows[n];
            const L2 = Math.min(t.w, len - 4.2);
            if (L2 < 1.4) break;
            const c0 = (alongX ? rx0 : rz0) + len / 2;
            let x0, x1, z0, z1;
            if (alongX) { x0 = c0 - L2 / 2; x1 = c0 + L2 / 2; z0 = rz0 + r + 0.15; z1 = z0 + t.d; }
            else { z0 = c0 - L2 / 2; z1 = c0 + L2 / 2; x0 = rx0 + r + 0.15; x1 = x0 + t.d; }
            const cells = [];
            for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) cells.push(idx(x, z));
            if (cells.some((k) => !inRoom.has(k) || blocked.has(k) || reserved.has(k))) break;
            if (!connected(new Set(cells))) break;
            if (clash(x0, z0, x1, z1)) break;
            for (const k of cells) blocked.add(k);
            add(type, x0, z0, x1, z1, alongX ? 0 : 1, alongX ? 1 : 0, contKind);
            done = true;
          }
        }
      }
    }
    return placed;
  }

  function sideOfDoor(tiles, sides, isOpen, E) {
    for (const [x, z] of tiles) {
      for (const s of sides(x, z)) if (s.e === E.DOOR && !tiles.some((q) => q[0] === s.nx && q[1] === s.nz)) return s;
    }
    return null;
  }

  // Índices de colisión del chunk (se llaman tras colocar todo)
  function indexChunk(c, CS) {
    c.fidx = [new Map(), new Map()];
    c.fblock = [new Uint8Array(CS * CS), c.up ? new Uint8Array(CS * CS) : null];
    const ox = c.cx * CS, oz = c.cz * CS;
    c.furn.forEach((f, k) => {
      const lv = f.lv || 0;
      const m = c.fidx[lv];
      for (let z = Math.floor(f.z0 - oz); z <= Math.floor(f.z1 - oz - 1e-6); z++) {
        for (let x = Math.floor(f.x0 - ox); x <= Math.floor(f.x1 - ox - 1e-6); x++) {
          if (x < 0 || z < 0 || x >= CS || z >= CS) continue;
          const i = z * CS + x;
          if (!m.has(i)) m.set(i, []);
          m.get(i).push(k);
          // casilla bloqueada para las rutas si el mueble la cubre casi entera
          const cx0 = Math.max(f.x0 - ox, x), cx1 = Math.min(f.x1 - ox, x + 1);
          const cz0 = Math.max(f.z0 - oz, z), cz1 = Math.min(f.z1 - oz, z + 1);
          // (lo largo y estrecho, como un muro bajo, también corta el paso aunque ocupe poco de la casilla)
          const thin = Math.min(f.x1 - f.x0, f.z1 - f.z0) < 0.5 && Math.max(f.x1 - f.x0, f.z1 - f.z0) > 0.9;
          if (f.solid !== false && ((cx1 - cx0) * (cz1 - cz0) > 0.4 || (thin && (cx1 - cx0) * (cz1 - cz0) > 0.12)) && c.fblock[lv]) c.fblock[lv][i] = 1;
        }
      }
    });
  }

  // ---------- Modelos ----------
  // Dibuja un mueble en el mesher. Sistema local: la parte de delante mira a +Z, el ancho va en X.
  function draw(m, f) {
    const t = T[f.type];
    const ry = Math.atan2(f.fx, f.fz);
    const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    // lo plano del suelo (charcos, hongos, escombros) a alturas algo distintas: si dos se pisan, no parpadean
    const y0 = f.y + 0.04 + (t.flat ? ((f.seed || 1) % 4) * 0.009 : 0);
    const rnd = U.mulberry32(f.seed || 1);
    // caja en coordenadas locales (lx: a lo ancho, lz: hacia delante)
    const box = (lx, ly, lz, w, h, d, hex) => m.box(cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs, w, h, d, hex, ry);
    const cyl = (lx, ly, lz, r, h, hex, seg) => m.cyl(cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs, r, r, h, hex, seg || 8);
    let W = t.w, D = t.d, H = t.h;
    if (t.flat || t.sized) { const al = Math.abs(f.fz) > 0.5; W = al ? f.x1 - f.x0 : f.z1 - f.z0; D = al ? f.z1 - f.z0 : f.x1 - f.x0; }
    if (t.sized && f.h) H = f.h;
    const wood = U.pick(rnd, [0x8a6440, 0x6f4f33, 0x9c7650, 0x5f4632, 0xb08a60]);
    const dark = U.shade(wood, 0.75);
    const fabric = U.pick(rnd, [0x6d7a5a, 0x7a5a52, 0x55667a, 0x8a7a62, 0x6a5a72, 0x4f5f58]);
    const metal = 0x8d939a, white = 0xe8e6de, steel = 0x6f757b;
    const legs = (w, d, h, r, hex) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 - r), h / 2, sz * (d / 2 - r), r * 2, h, r * 2, hex);
    };
    switch (f.type) {
      case 'cama': case 'cama1': case 'camilla': {
        const hosp = f.type === 'camilla';
        const fr = hosp ? steel : wood;
        legs(W, D, 0.25, 0.04, fr);
        box(0, 0.3, 0, W, 0.12, D, fr);
        box(0, 0.44, 0.02, W - 0.06, 0.18, D - 0.08, hosp ? 0xdfe6e8 : 0xe6e0d0);       // colchón
        box(0, 0.54, -D / 2 + 0.28, W - 0.2, 0.1, 0.36, white);                            // almohada
        box(0, 0.52, 0.25, W - 0.02, 0.06, D * 0.62, hosp ? 0x9fc4c8 : fabric);           // manta
        box(0, 0.6, -D / 2 + 0.03, W, hosp ? 0.5 : 0.9, 0.06, fr);                         // cabecero
        break;
      }
      case 'mesita':
        box(0, H / 2, 0, W, H, D, wood);
        box(0, H * 0.62, D / 2 + 0.005, W - 0.08, 0.14, 0.01, dark);
        box(0, H * 0.25, D / 2 + 0.005, W - 0.08, 0.14, 0.01, dark);
        box(0, H * 0.62, D / 2 + 0.015, 0.06, 0.02, 0.02, 0xc9b27a);
        if (rnd() < 0.6) cyl(0.08, H + 0.12, -0.05, 0.05, 0.24, 0xd8c9a0, 8);           // lámpara
        break;
      case 'comoda':
        box(0, H / 2, 0, W, H, D, wood);
        for (let k = 0; k < 3; k++) {
          box(0, 0.15 + k * 0.27, D / 2 + 0.005, W - 0.08, 0.22, 0.01, dark);
          box(0, 0.15 + k * 0.27, D / 2 + 0.015, 0.14, 0.025, 0.02, 0xc9b27a);
        }
        break;
      case 'armario':
        box(0, H / 2, 0, W, H, D, wood);
        box(-W / 4, H / 2 + 0.05, D / 2 + 0.005, W / 2 - 0.04, H - 0.2, 0.01, dark);
        box(W / 4, H / 2 + 0.05, D / 2 + 0.005, W / 2 - 0.04, H - 0.2, 0.01, dark);
        box(-0.04, H / 2, D / 2 + 0.02, 0.02, 0.16, 0.02, 0xc9b27a);
        box(0.04, H / 2, D / 2 + 0.02, 0.02, 0.16, 0.02, 0xc9b27a);
        break;
      case 'sofa': case 'sillon':
        box(0, 0.22, 0, W, 0.24, D, fabric);
        box(0, 0.4, 0.06, W - 0.3, 0.14, D - 0.2, U.shade(fabric, 1.08));
        box(0, 0.58, -D / 2 + 0.12, W, 0.5, 0.22, fabric);
        box(-W / 2 + 0.1, 0.44, 0, 0.2, 0.3, D, U.shade(fabric, 0.92));
        box(W / 2 - 0.1, 0.44, 0, 0.2, 0.3, D, U.shade(fabric, 0.92));
        break;
      case 'mueble_tv':
        box(0, H / 2, 0, W, H, D, wood);
        box(0, H + 0.3, -0.05, 0.9, 0.55, 0.08, 0x1e2124);                                // tele
        box(0, H + 0.3, -0.005, 0.84, 0.49, 0.01, 0x2c3238);
        box(0, H + 0.02, -0.05, 0.25, 0.04, 0.15, 0x1e2124);
        break;
      case 'estanteria': case 'estante': {
        const fr = f.type === 'estante' ? steel : wood;
        box(-W / 2 + 0.02, H / 2, 0, 0.04, H, D, fr);
        box(W / 2 - 0.02, H / 2, 0, 0.04, H, D, fr);
        box(0, H / 2, -D / 2 + 0.01, W, H, 0.02, U.shade(fr, 0.85));
        for (let k = 0; k <= 4; k++) box(0, 0.05 + k * (H - 0.08) / 4, 0, W - 0.04, 0.03, D, fr);
        // cosas en los estantes
        for (let k = 0; k < 4; k++) {
          const n = 2 + Math.floor(rnd() * 4);
          for (let j = 0; j < n; j++) {
            if (rnd() < 0.3) continue;
            const hh = 0.12 + rnd() * 0.2;
            box(-W / 2 + 0.1 + (j + 0.5) * (W - 0.2) / n, 0.08 + k * (H - 0.08) / 4 + hh / 2, 0.02, 0.06 + rnd() * 0.08, hh, D * 0.7,
              U.pick(rnd, [0x8c3b2e, 0x2f4f6a, 0x5d6b3a, 0xc9b27a, 0x7a6a5a, 0xb9b2a6]));
          }
        }
        break;
      }
      case 'encimera': case 'fregadero': case 'fogon': {
        box(0, 0.45, 0, W, 0.86, D, f.type === 'fogon' ? 0xd9d6cc : 0xe2ddd0);
        box(0, 0.89, 0, W + 0.02, 0.05, D + 0.02, 0x6b6e6a);                              // encimera
        box(0, 0.05, D / 2 - 0.02, W, 0.1, 0.04, 0x3d3a36);                                // zócalo
        if (f.type !== 'fogon') {
          box(-W / 4, 0.48, D / 2 + 0.005, W / 2 - 0.04, 0.66, 0.01, U.shade(0xe2ddd0, 0.92));
          box(W / 4, 0.48, D / 2 + 0.005, W / 2 - 0.04, 0.66, 0.01, U.shade(0xe2ddd0, 0.92));
        }
        if (f.type === 'fregadero') { box(0, 0.9, 0.02, 0.5, 0.03, 0.36, metal); box(0, 1.05, -D / 2 + 0.08, 0.03, 0.28, 0.03, metal); }
        if (f.type === 'fogon') {
          for (const sx of [-0.15, 0.15]) for (const sz of [-0.12, 0.12]) cyl(sx, 0.93, sz, 0.08, 0.02, 0x222222, 10);
          box(0, 0.4, D / 2 + 0.005, W - 0.1, 0.45, 0.01, 0x2a2a2a);
        }
        break;
      }
      case 'nevera':
        box(0, H / 2, 0, W, H, D, 0xe9e7e0);
        box(0, H * 0.72, D / 2 + 0.005, W - 0.04, 0.005, 0.01, 0xb8b6ae);
        box(W / 2 - 0.08, H * 0.82, D / 2 + 0.02, 0.03, 0.3, 0.03, metal);
        box(W / 2 - 0.08, H * 0.4, D / 2 + 0.02, 0.03, 0.4, 0.03, metal);
        break;
      case 'mesa':
        box(0, H - 0.03, 0, W, 0.05, D, wood);
        legs(W - 0.1, D - 0.1, H - 0.05, 0.03, dark);
        // sillas
        for (const s of [-1, 1]) {
          for (const k of [-0.35, 0.35]) {
            box(k * W / 1.5, 0.45, s * (D / 2 + 0.25), 0.4, 0.04, 0.4, wood);
            box(k * W / 1.5, 0.7, s * (D / 2 + 0.43), 0.4, 0.5, 0.04, wood);
            box(k * W / 1.5, 0.22, s * (D / 2 + 0.25), 0.36, 0.44, 0.36, dark);
          }
        }
        break;
      case 'inodoro':
        box(0, 0.2, 0.05, 0.36, 0.4, 0.5, white);
        box(0, 0.42, 0.06, 0.38, 0.04, 0.48, 0xf2f0ea);
        box(0, 0.6, -D / 2 + 0.1, 0.4, 0.4, 0.18, white);
        break;
      case 'lavabo':
        box(0, 0.4, 0, W, 0.8, D, 0xddd6c6);
        box(0, 0.84, 0, W, 0.08, D, white);
        box(0, 1.45, -D / 2 + 0.03, 0.5, 0.6, 0.04, 0xbcd0d6);                            // espejo
        box(0, 0.95, -D / 2 + 0.06, 0.03, 0.15, 0.03, metal);
        break;
      case 'banera':
        box(0, H / 2, 0, W, H, D, white);
        box(0, H - 0.04, 0, W - 0.12, 0.02, D - 0.12, 0xcfd9dc);
        break;
      case 'lavadora':
        box(0, H / 2, 0, W, H, D, 0xe9e7e0);
        cyl(0, H * 0.48, D / 2 + 0.005, 0.18, 0.02, 0x5a6066, 14);
        break;
      case 'banco':
        box(0, H - 0.04, 0, W, 0.08, D, 0x8a6440);
        legs(W - 0.1, D - 0.1, H - 0.08, 0.04, 0x6f4f33);
        box(0, 0.25, 0, W - 0.1, 0.03, D - 0.1, 0x6f4f33);
        box(0, H + 0.45, -D / 2 + 0.02, W, 0.9, 0.03, 0x9c8a6a);                          // panel de herramientas
        box(-0.4, H + 0.6, -D / 2 + 0.05, 0.05, 0.3, 0.03, steel);
        box(0.1, H + 0.55, -D / 2 + 0.05, 0.25, 0.04, 0.03, steel);
        box(0.5, H + 0.5, -D / 2 + 0.05, 0.04, 0.35, 0.03, 0xa8322a);
        break;
      case 'mesa_mapa': {
        // mesa de tablones con un mapa desplegado, chinchetas y un farol; detrás, el corcho con notas y hilo rojo
        box(0, H - 0.03, 0, W, 0.06, D, 0x5e4630);
        legs(W - 0.12, D - 0.12, H - 0.06, 0.045, 0x4a3726);
        box(0, H + 0.004, 0.02, W * 0.78, 0.008, D * 0.8, 0xcbbd98);
        for (let k = 0; k < 6; k++) box(-W * 0.36 + k * W * 0.145, H + 0.009, 0.02, 0.006, 0.002, D * 0.78, 0xa89a78);
        for (let k = 0; k < 4; k++) box(0, H + 0.009, -D * 0.34 + k * D * 0.23, W * 0.76, 0.002, 0.006, 0xa89a78);
        box(-0.3, H + 0.01, 0.05, 0.5, 0.004, 0.02, 0x9e2b22); box(0.1, H + 0.01, -0.06, 0.4, 0.004, 0.02, 0x9e2b22);
        box(0.05, H + 0.01, 0.15, 0.03, 0.004, 0.3, 0x3d6f8a);
        for (const [px, pz, col] of [[-0.55, 0.05, 0xc23a2a], [-0.05, 0.05, 0xc23a2a], [0.3, -0.06, 0xd9b23a], [0.55, 0.2, 0x3a7ac2]]) { cyl(px, H + 0.03, pz, 0.012, 0.04, col, 6); }
        // farol
        cyl(W / 2 - 0.22, H + 0.03, -D / 2 + 0.2, 0.07, 0.04, 0x3a3a36, 8);
        cyl(W / 2 - 0.22, H + 0.13, -D / 2 + 0.2, 0.05, 0.16, 0xf2c776, 8);
        cyl(W / 2 - 0.22, H + 0.24, -D / 2 + 0.2, 0.065, 0.04, 0x3a3a36, 8);
        // corcho en la pared, con marco, papeles, fotos y el hilo rojo entre chinchetas
        const by = 1.62, bz = -D / 2 + 0.03;
        box(0, by, bz, W * 0.98, 1.06, 0.035, 0x3a2a1c);
        box(0, by, bz + 0.012, W * 0.92, 0.98, 0.03, 0x9a7650);
        for (const [px, py, w2, h2, col] of [[-0.62, 0.22, 0.32, 0.4, 0xe2d9bc], [-0.15, 0.28, 0.42, 0.3, 0xd2c8a4], [0.42, 0.18, 0.36, 0.44, 0xeae4cf],
          [-0.5, -0.24, 0.3, 0.28, 0x8a9aa4], [0.05, -0.2, 0.46, 0.34, 0xcbbd98], [0.6, -0.25, 0.26, 0.3, 0x9a8a7a]]) box(px, by + py, bz + 0.03, w2, h2, 0.006, col);
        const pins = [[-0.62, 0.38], [-0.15, 0.4], [0.42, 0.36], [-0.5, -0.12], [0.05, -0.05], [0.6, -0.12]];
        for (const [px, py] of pins) box(px, by + py, bz + 0.04, 0.025, 0.025, 0.02, 0xc23a2a);
        for (let k = 0; k < pins.length - 1; k++) {
          const [ax, ay] = pins[k], [bx2, byy] = pins[k + 1];
          const L = Math.hypot(bx2 - ax, byy - ay), ang = Math.atan2(byy - ay, bx2 - ax);
          const mx = (ax + bx2) / 2, my = (ay + byy) / 2;
          m.box(cx + mx * cs + (bz + 0.045) * sn, y0 + by + my, cz - mx * sn + (bz + 0.045) * cs, L, 0.006, 0.004, 0xb3261c, ry, undefined, 0, ang);
        }
        break;
      }
      case 'cofre': {
        // cofre de recompensas: una caja grande de transporte, de plástico duro color arena, con nervios, asas
        // y cierres. Sin tapa: la tapa (que se abre) y lo de dentro van aparte (refugio.js)
        const SH = 0x8f7b55, SD = 0x6f5f42, IN = 0x2f2b24, t = 0.045;
        box(0, 0.03, 0, W, 0.06, D, SD);                                               // fondo
        box(0, 0.065, 0, W - 2 * t, 0.01, D - 2 * t, IN);                              // suelo de dentro
        box(0, H / 2, D / 2 - t / 2, W, H, t, SH); box(0, H / 2, -D / 2 + t / 2, W, H, t, SH);   // frente y fondo
        for (const sx of [-1, 1]) box(sx * (W / 2 - t / 2), H / 2, 0, t, H, D - 2 * t, SH);       // lados
        // por dentro, más oscuro
        box(0, H / 2, D / 2 - t - 0.002, W - 2 * t, H - 0.08, 0.004, IN); box(0, H / 2, -D / 2 + t + 0.002, W - 2 * t, H - 0.08, 0.004, IN);
        for (const sx of [-1, 1]) box(sx * (W / 2 - t - 0.002), H / 2, 0, 0.004, H - 0.08, D - 2 * t, IN);
        // nervios y borde de arriba
        box(0, H - 0.015, D / 2 + 0.004, W + 0.01, 0.03, 0.012, SD); box(0, H - 0.015, -D / 2 - 0.004, W + 0.01, 0.03, 0.012, SD);
        for (const sx of [-1, 1]) box(sx * (W / 2 + 0.004), H - 0.015, 0, 0.012, 0.03, D + 0.01, SD);
        for (const yy of [0.14, 0.3]) box(0, yy, D / 2 + 0.006, W - 0.1, 0.022, 0.01, SD);
        for (const sx of [-0.36, 0.36]) box(sx * W, H / 2, D / 2 + 0.008, 0.05, H - 0.04, 0.012, SD);
        // cierres de la tapa (abajo) y asas a los lados
        for (const sx of [-0.25, 0.25]) box(sx * W, H - 0.07, D / 2 + 0.016, 0.07, 0.06, 0.016, 0x3a3630);
        for (const sx of [-1, 1]) { box(sx * (W / 2 + 0.02), H * 0.62, 0, 0.025, 0.035, 0.2, 0x2a2826); box(sx * (W / 2 + 0.012), H * 0.62, -0.1, 0.02, 0.035, 0.02, 0x2a2826); box(sx * (W / 2 + 0.012), H * 0.62, 0.1, 0.02, 0.035, 0.02, 0x2a2826); }
        box(-0.3 * W, 0.2, D / 2 + 0.013, 0.2, 0.05, 0.004, 0xd8d0b8);                 // etiqueta
        break;
      }
      case 'puesto': {
        // el comercio: un armario de armas abierto de par en par, lleno. Arriba, armas largas de pie en el
        // armero (rifles, escopetas, un arco); en las puertas, pistolas y revólveres colgados; abajo, un estante
        // con cajas de munición, botes y bidones, y dos cajones
        const MW = 0x5a4632, MD = 0x3a2e22, PEG = 0x9a8a6c, GM = 0x2a2b2d, GM2 = 0x50535a, WD = 0xa0703f;
        box(0, H / 2, -D / 2 + 0.015, W, H, 0.03, MD);                                    // fondo
        box(-W / 2 + 0.02, H / 2, 0, 0.04, H, D, MW); box(W / 2 - 0.02, H / 2, 0, 0.04, H, D, MW);   // laterales
        box(0, H - 0.02, 0, W, 0.04, D, MW); box(0, 0.03, 0, W, 0.06, D, MW);              // techo y base
        box(0, 0.62, 0, W - 0.06, 0.035, D - 0.02, MW);                                    // estante
        box(0, 1.35, -D / 2 + 0.04, W - 0.08, 1.3, 0.01, PEG);                             // panel perforado
        for (let k = 0; k < 9; k++) for (let j = 0; j < 6; j++) box(-0.8 + k * 0.2, 0.8 + j * 0.2, -D / 2 + 0.047, 0.012, 0.012, 0.004, 0x3a2e22);
        // pistolas y revólveres colgados del panel, arriba del todo
        for (let k = 0; k < 7; k++) {
          const gx = -0.78 + k * 0.26;
          box(gx, 1.9, -D / 2 + 0.06, 0.16, 0.04, 0.03, k % 2 ? GM2 : GM);
          box(gx - 0.05, 1.85, -D / 2 + 0.06, 0.035, 0.08, 0.03, k % 3 ? 0x3b3431 : WD);
        }
        // soporte del armero: una barra con muescas delante
        box(0, 1.2, D / 2 - 0.1, W - 0.1, 0.03, 0.03, MW);
        // armas largas de pie (culata abajo, sobre el estante, cañón arriba)
        const longs = [[-0.72, 0, 1.68], [-0.42, 1, 1.75], [-0.12, 0, 1.62], [0.18, 2, 1.8], [0.48, 1, 1.7], [0.74, 3, 1.85]];
        for (const [gx, kind, top] of longs) {
          const z0 = -0.02;
          box(gx, 0.79, z0, 0.07, 0.3, 0.045, kind === 2 ? 0x8a5a33 : WD);              // culata
          box(gx, 0.99, z0, 0.055, 0.15, 0.05, GM);                                         // cajón
          if (kind === 3) {                                                                  // arco
            box(gx, 1.2, z0 + 0.02, 0.02, 1.1, 0.02, 0x8a5a33); box(gx + 0.05, 1.2, z0 + 0.02, 0.003, 1.05, 0.003, 0xd8d0b8);
          } else {
            box(gx, (1.05 + top) / 2, z0 - 0.005, kind === 1 ? 0.03 : 0.024, top - 1.05, 0.024, GM2);   // cañón
            if (kind === 1) box(gx, 1.2, z0 + 0.012, 0.03, 0.18, 0.028, WD);               // guardamanos (escopeta)
            if (kind === 0) box(gx, 1.05, z0 - 0.04, 0.03, 0.16, 0.03, 0x1a1a1a);          // mira (rifle)
            if (kind === 2) { box(gx + 0.022, (1.05 + top) / 2, z0 - 0.005, 0.016, top - 1.05, 0.016, GM2); }   // doble cañón
          }
        }
        // abajo: munición, botes, un bidón rojo y dos cajones
        const shelf = [[-0.82, 0x8a6b3a, 0.1, 0.13], [-0.68, 0x9c3528, 0.1, 0.13], [-0.54, 0x4c6a3a, 0.1, 0.1], [-0.4, 0xb58a2a, 0.08, 0.09],
          [-0.18, 0xeceae2, 0.07, 0.17], [-0.08, 0x6b6e70, 0.07, 0.12], [0.06, 0xc4302a, 0.13, 0.17], [0.3, 0x3a3c40, 0.04, 0.16], [0.36, 0x3a3c40, 0.04, 0.16]];
        for (const [gx, col, gw, gh] of shelf) box(gx, 0.64 + gh / 2, -0.05, gw, gh, 0.08, col);
        box(0.62, 0.64 + 0.12, -0.05, 0.16, 0.24, 0.12, 0xa8322a); box(0.62, 0.9, -0.05, 0.08, 0.03, 0.04, 0x6a1c16);
        for (const sx of [-1, 1]) {
          box(sx * W * 0.25, 0.33, D / 2 - 0.02, W / 2 - 0.08, 0.5, 0.02, MW);
          box(sx * W * 0.25, 0.4, D / 2 - 0.005, 0.12, 0.025, 0.02, 0x9a9a92);
        }
        // puertas abiertas hacia fuera (unos 115°) con armas cortas colgadas
        for (const sx of [-1, 1]) {
          const a = 2.0, dl = W / 2 - 0.02;
          const dx = -sx * Math.cos(a), dz = Math.sin(a);              // dirección de la puerta desde la bisagra
          const beta = Math.atan2(-dz, dx);
          const at = (t, y, h, ww, dd, col, off) => {
            const px = sx * W / 2 + dx * dl * t, pz = D / 2 + dz * dl * t + (off || 0);
            m.box(cx + px * cs + pz * sn, y0 + y, cz - px * sn + pz * cs, ww, h, dd, col, ry + beta);
          };
          const px = sx * W / 2 + dx * dl * 0.5, pz = D / 2 + dz * dl * 0.5;
          m.box(cx + px * cs + pz * sn, y0 + 1.03, cz - px * sn + pz * cs, dl, 2.0, 0.03, MW, ry + beta);
          for (let j = 0; j < 3; j++) {
            const t = 0.28 + j * 0.24;
            at(t, 1.5, 0.035, 0.14, 0.045, j === 1 ? GM2 : GM);         // corredera o cañón
            at(t - 0.04, 1.44, 0.08, 0.03, 0.045, j === 1 ? WD : 0x3b3431);   // empuñadura
            at(t, 1.15, 0.12, 0.1, 0.05, 0x8a6b3a);                    // caja de balas en el estante de la puerta
          }
        }
        break;
      }
      case 'banco_mej': {
        // banco de mejoras: tablero grueso, estante abajo, tapete verde con cuadrícula, tornillo de banco, flexo
        // y un panel de herramientas detrás
        box(0, H - 0.04, 0, W, 0.08, D, 0x7a5a3a);
        legs(W - 0.1, D - 0.1, H - 0.08, 0.045, 0x4a4a46);
        box(0, 0.22, 0, W - 0.12, 0.03, D - 0.12, 0x5f4632);
        box(0, 0.32, 0.05, 0.5, 0.18, 0.3, 0xa8322a);
        box(-0.05, H + 0.004, 0.04, 1.1, 0.008, 0.6, 0x2c5a48);
        for (let k = 0; k <= 10; k++) box(-0.6 + k * 0.11, H + 0.009, 0.04, 0.004, 0.002, 0.6, 0x4f8a72);
        for (let k = 0; k <= 5; k++) box(-0.05, H + 0.009, -0.26 + k * 0.12, 1.1, 0.002, 0.004, 0x4f8a72);
        box(W / 2 - 0.2, H + 0.08, 0.15, 0.16, 0.12, 0.2, 0x3d4a5a);
        box(W / 2 - 0.2, H + 0.16, 0.15, 0.22, 0.05, 0.08, 0x3d4a5a);
        // flexo
        cyl(-W / 2 + 0.2, H + 0.02, -D / 2 + 0.15, 0.08, 0.03, 0x2a2a28, 10);
        m.box(cx + (-W / 2 + 0.2) * cs + (-D / 2 + 0.15) * sn, y0 + H + 0.22, cz - (-W / 2 + 0.2) * sn + (-D / 2 + 0.15) * cs, 0.025, 0.42, 0.025, 0x2a2a28, ry, undefined, 0.35, 0);
        box(-W / 2 + 0.2, H + 0.42, -D / 2 + 0.3, 0.16, 0.08, 0.14, 0x3a5a3a);
        // panel de herramientas
        box(0, H + 0.6, -D / 2 + 0.02, W, 1.0, 0.03, 0x9c8a6a);
        for (let k = 0; k < 9; k++) for (let j = 0; j < 4; j++) box(-W / 2 + 0.15 + k * 0.21, H + 0.25 + j * 0.22, -D / 2 + 0.04, 0.012, 0.012, 0.004, 0x5f523e);
        box(-0.7, H + 0.62, -D / 2 + 0.05, 0.05, 0.36, 0.03, steel); box(-0.55, H + 0.6, -D / 2 + 0.05, 0.04, 0.3, 0.03, 0xa8322a);
        box(-0.2, H + 0.7, -D / 2 + 0.05, 0.32, 0.05, 0.03, steel); box(0.15, H + 0.55, -D / 2 + 0.05, 0.04, 0.4, 0.03, 0xc29a2a);
        box(0.45, H + 0.66, -D / 2 + 0.05, 0.22, 0.22, 0.03, 0x6a6e72); box(0.75, H + 0.6, -D / 2 + 0.05, 0.05, 0.34, 0.03, steel);
        break;
      }
      case 'caja_herr':
        box(0, 0.13, 0, W, 0.26, D, 0xa8322a);
        box(0, 0.29, 0, 0.3, 0.04, 0.04, 0x2a2a2a);
        break;
      case 'escritorio':
        box(0, H - 0.03, 0, W, 0.05, D, wood);
        box(W / 2 - 0.22, (H - 0.05) / 2, 0, 0.42, H - 0.05, D - 0.04, dark);
        box(-W / 2 + 0.03, (H - 0.05) / 2, 0, 0.04, H - 0.05, D - 0.04, dark);
        box(W / 2 - 0.22, H * 0.7, D / 2 - 0.01, 0.36, 0.12, 0.01, U.shade(dark, 0.85));
        box(-0.2, H + 0.02, -0.1, 0.4, 0.02, 0.3, 0xe8e2d0);                               // papeles
        box(-0.2, 0.46, 0.55, 0.42, 0.06, 0.42, 0x3a3a3a);                                  // silla
        box(-0.2, 0.75, 0.75, 0.42, 0.5, 0.05, 0x3a3a3a);
        cyl(-0.2, 0.22, 0.55, 0.03, 0.44, steel, 6);
        break;
      case 'archivador':
        box(0, H / 2, 0, W, H, D, 0x7f878c);
        for (let k = 0; k < 4; k++) {
          box(0, 0.18 + k * 0.3, D / 2 + 0.005, W - 0.06, 0.26, 0.01, 0x737b80);
          box(0, 0.24 + k * 0.3, D / 2 + 0.015, 0.12, 0.02, 0.02, 0xc8c8c8);
        }
        break;
      case 'taquilla':
        box(0, H / 2, 0, W, H, D, U.pick(rnd, [0x5d6f7a, 0x6a7a5e, 0x8a4a3a]));
        for (let k = 0; k < 5; k++) box(0, H - 0.2 - k * 0.04, D / 2 + 0.005, W * 0.5, 0.012, 0.01, 0x3a4348);
        box(W / 2 - 0.08, H / 2, D / 2 + 0.015, 0.025, 0.12, 0.02, 0xc8c8c8);
        break;
      case 'armero':
        box(0, H / 2, 0, W, H, D, 0x3f4a3d);
        box(0, H / 2 + 0.05, D / 2 + 0.005, W - 0.1, H - 0.25, 0.01, 0x2f382e);
        box(0, H / 2, D / 2 + 0.02, 0.04, 0.2, 0.03, 0xc8c8c8);
        box(0, H - 0.25, D / 2 + 0.012, W * 0.5, 0.1, 0.005, 0xd8c860);                    // placa
        break;
      case 'carrito':
        legs(W, D, 0.85, 0.02, steel);
        for (const y of [0.25, 0.85]) box(0, y, 0, W, 0.03, D, metal);
        box(0.1, 0.9, 0, 0.15, 0.08, 0.1, 0xe6e6e6);
        break;
      case 'mostrador': {
        box(0, H / 2, 0, W, H, D, 0x8a6a4a);
        box(0, H + 0.02, 0, W + 0.04, 0.04, D + 0.04, 0x5d5a55);
        box(0.5, H + 0.12, 0, 0.36, 0.16, 0.3, 0x2c2c2e);                                  // caja registradora
        box(0.5, H + 0.24, -0.06, 0.3, 0.1, 0.04, 0x1b3a2b);
        break;
      }
      case 'gondola': {
        box(0, 0.06, 0, W, 0.12, D, 0x9a9da0);
        box(0, H / 2, 0, W, H, 0.06, 0xb9bcbf);
        for (let k = 0; k < 4; k++) {
          const y = 0.25 + k * 0.38;
          box(0, y, 0, W, 0.03, D, 0xc8cbce);
          // estantes casi vacíos: alguna lata o caja suelta
          for (let j = 0; j < 6; j++) {
            if (rnd() < 0.7) continue;
            const side = rnd() < 0.5 ? -1 : 1;
            box(-W / 2 + 0.2 + j * (W - 0.4) / 5, y + 0.09, side * D * 0.25, 0.12, 0.16, 0.12, U.pick(rnd, [0xb8452e, 0xd8b84a, 0x3f6f8a, 0x6a8a3a, 0xe0d8c8]));
          }
        }
        break;
      }
      case 'cajas':
        box(-0.12, 0.2, 0, 0.5, 0.4, 0.5, 0xa4865a);
        box(0.2, 0.15, 0.1, 0.4, 0.3, 0.4, 0xb08f62);
        box(0, 0.5, -0.05, 0.42, 0.24, 0.42, 0x9a7c50);
        break;
      case 'banco_espera':
        box(0, 0.42, 0, W, 0.05, D, 0x4f6a8a);
        box(0, 0.7, -D / 2 + 0.04, W, 0.5, 0.04, 0x4f6a8a);
        legs(W - 0.1, D - 0.1, 0.4, 0.025, steel);
        break;
      case 'camion': drawTruck(box, cyl, W, D, rnd); break;
      case 'patrulla': drawCar(box, cyl, W, D, 'policia', rnd); break;
      case 'cont6': case 'cont12': drawContainer(box, W, D, H, f, rnd); break;
      case 'coche': drawCar(box, cyl, W, D, 'civil', rnd, f.col); break;
      case 'camioneta': drawPickup(box, cyl, W, D, rnd, f.col); break;
      case 'montacargas': drawForklift(box, cyl, W, D, rnd); break;
      case 'ibc': {
        // tanque de 1000 L: depósito blanco sucio dentro de una jaula de tubos, sobre un palé
        box(0, 0.07, 0, W, 0.14, D, 0x6e5a40);
        box(0, 0.62, 0, W - 0.1, 0.92, D - 0.1, 0xd9d4c2);
        box(0, 1.1, 0, 0.18, 0.06, 0.18, 0x2a2a2a);
        for (const yy of [0.18, 0.5, 0.82, 1.12]) { box(0, yy, D / 2 - 0.02, W, 0.035, 0.035, 0x8a8e92); box(0, yy, -D / 2 + 0.02, W, 0.035, 0.035, 0x8a8e92); box(W / 2 - 0.02, yy, 0, 0.035, 0.035, D, 0x8a8e92); box(-W / 2 + 0.02, yy, 0, 0.035, 0.035, D, 0x8a8e92); }
        for (let k = 0; k < 5; k++) { const x = -W / 2 + 0.05 + k * (W - 0.1) / 4; box(x, 0.65, D / 2 - 0.02, 0.035, 1.0, 0.035, 0x8a8e92); box(x, 0.65, -D / 2 + 0.02, 0.035, 1.0, 0.035, 0x8a8e92); }
        box(0, 0.25, D / 2 + 0.01, 0.14, 0.14, 0.04, 0x3a3a3a);
        box(0.1, 0.9, D / 2 - 0.03, 0.3, 0.25, 0.006, 0x6a8a3a);
        break;
      }
      case 'palets': {
        // pila de palés de madera gastada
        const n = 4 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const y = k * 0.13, col = U.shade(0x9a7a54, 0.85 + rnd() * 0.25);
          for (const zz of [-D / 2 + 0.05, 0, D / 2 - 0.05]) box((rnd() - 0.5) * 0.05, y + 0.045, zz, W, 0.09, 0.1, col);
          for (let j = 0; j < 5; j++) box(-W / 2 + 0.1 + j * (W - 0.2) / 4, y + 0.11, 0, 0.14, 0.025, D, U.shade(col, 1.08));
        }
        break;
      }
      case 'lona': {
        // bultos tapados con una lona azul atada con cuerdas
        const col = U.pick(rnd, [0x3f5f86, 0x4a6a8c, 0x5a6a4a]);
        box(0, H / 2 - 0.02, 0, W, H - 0.04, D, col);
        box(0, H - 0.01, 0, W - 0.12, 0.04, D - 0.12, U.shade(col, 1.1));
        box(0.2, H * 0.55, D / 2 + 0.01, W * 0.5, H * 0.6, 0.02, U.shade(col, 0.9));
        box(-W / 2 - 0.01, 0.3, 0, 0.02, 0.6, D * 0.8, U.shade(col, 0.88));
        for (const xx of [-W * 0.3, W * 0.3]) { box(xx, H / 2, D / 2 + 0.02, 0.03, H, 0.02, 0xc9b98a); box(xx, H / 2, -D / 2 - 0.02, 0.03, H, 0.02, 0xc9b98a); box(xx, H + 0.01, 0, 0.03, 0.02, D, 0xc9b98a); }
        box(0, 0.05, 0, W + 0.1, 0.1, D + 0.06, 0x6e5a40);
        break;
      }
      case 'barrera': {
        // barrera de hormigón (tipo New Jersey), manchada
        box(0, 0.12, 0, W, 0.24, D, 0x9a978e);
        box(0, 0.42, 0, W, 0.36, D * 0.62, 0xa19e95);
        box(0, 0.72, 0, W, 0.2, D * 0.36, 0xa6a39a);
        box(rnd() - 0.5, 0.13, D / 2 + 0.008, 0.6, 0.18, 0.006, 0x7c796f);
        box(-W / 2 + 0.25, 0.75, 0, 0.12, 0.06, D * 0.38, 0x6a6862);
        break;
      }
      case 'bidones': {
        const cols = [0x3a5a8a, 0x8a3a2a, 0x4a6a3a, 0x6a6a6a];
        for (const [x, z] of [[-0.32, 0], [0.32, 0.05]]) {
          const col = U.pick(rnd, cols);
          cyl(x, 0.44, z, 0.29, 0.88, col, 12);
          cyl(x, 0.3, z, 0.3, 0.04, U.shade(col, 0.8), 12); cyl(x, 0.62, z, 0.3, 0.04, U.shade(col, 0.8), 12);
          cyl(x + 0.1, 0.885, z, 0.04, 0.02, 0x2a2a2a, 8);
        }
        break;
      }
      case 'tubo': {
        // tubo de hormigón tumbado (se ve el hueco por dentro)
        const R = H / 2;
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
          box(0, R + co * (R - 0.06), s * (R - 0.06), W, 0.12, R * 0.55, 0x9c998f);
        }
        box(W / 2 - 0.08, R, 0, 0.16, H - 0.2, 0.08, 0x8a877e);
        break;
      }
      case 'bloques': {
        // bloques de hormigón apilados sobre un palé
        box(0, 0.06, 0, W, 0.12, D, 0x7a6248);
        for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
          if (k === 2 && rnd() < 0.35) continue;
          box(-W / 2 + 0.2 + i * 0.4, 0.22 + k * 0.24, -D / 4 + j * D / 2, 0.38, 0.22, D / 2 - 0.04, U.shade(0x8f8c84, 0.9 + rnd() * 0.2));
        }
        break;
      }
      case 'persiana': {
        // persiana metálica enrollable bajada, con su cajón arriba y las guías
        box(0, H / 2 - 0.2, 0, W, H - 0.4, 0.04, 0x6f7375);
        for (let y = 0.15; y < H - 0.5; y += 0.12) box(0, y, 0.025, W - 0.05, 0.03, 0.01, 0x5d6163);
        box(0, H - 0.2, 0, W + 0.1, 0.4, 0.16, 0x55595b);
        for (const s2 of [-1, 1]) box(s2 * (W / 2 + 0.03), H / 2 - 0.2, 0, 0.06, H - 0.4, 0.1, 0x45494b);
        box(-W * 0.3, 0.9, 0.03, 0.5, 0.35, 0.006, 0x8a4a2a);
        break;
      }
      case 'galpon': {
        // galpón industrial de fuera del mapa: bloques de hormigón, persianas, ventanas altas y techo plano
        const wall = U.pick(rnd, [0x7d8384, 0x8a8478, 0x6f777a]);
        box(0, H / 2, 0, W, H, D, wall);
        box(0, H + 0.2, 0, W + 0.2, 0.4, D + 0.2, U.shade(wall, 0.8));
        for (let k = 0; k < 3; k++) {
          const x = -W / 2 + 2.5 + k * 4.5;
          box(x, 1.7, D / 2 + 0.02, 3.2, 3.4, 0.04, 0x5d6163);
          for (let y = 0.2; y < 3.3; y += 0.18) box(x, y, D / 2 + 0.045, 3.1, 0.04, 0.01, 0x4f5355);
          box(x, 3.55, D / 2 + 0.06, 3.4, 0.3, 0.12, 0x45494b);
        }
        for (let k = 0; k < 6; k++) box(-W / 2 + 1.3 + k * 2.3, H - 1.5, D / 2 + 0.02, 1.4, 1.0, 0.04, 0x2a3236);
        box(0, H * 0.62, D / 2 + 0.03, W, 0.1, 0.03, U.shade(wall, 0.7));
        for (let k = 0; k < 6; k++) box((rnd() - 0.5) * (W - 2), 1 + rnd() * (H - 3), D / 2 + 0.03 + k * 0.007, 0.4 + rnd(), 0.4 + rnd() * 1.5, 0.006, U.shade(wall, 0.75));
        break;
      }
      case 'jardinera': {
        // jardinera elevada de piedra con tierra y plantas (en los patios de atrás)
        const st = U.pick(rnd, [0x8a8680, 0x7a7670, 0x96918a]);
        box(0, 0.33, 0, W, 0.66, D, st);
        box(0, 0.68, 0, W + 0.06, 0.08, D + 0.06, U.shade(st, 1.1));                    // remate
        box(0, 0.7, 0, W - 0.2, 0.06, D - 0.2, 0x3e3226);                               // tierra
        for (let k = 0; k < 5; k++) box(-W / 2 + 0.06 + rnd() * (W - 0.12), 0.08 + rnd() * 0.5, D / 2 + 0.008 + k * 0.006, 0.18 + rnd() * 0.3, 0.1, 0.006, U.shade(st, 0.82));
        for (let k = 0; k < 6; k++) cyl((rnd() - 0.5) * (W - 0.5), 0.78 + rnd() * 0.06, (rnd() - 0.5) * (D - 0.4), 0.08 + rnd() * 0.08, 0.1 + rnd() * 0.18, U.pick(rnd, [0x4f6a32, 0x5e7a3a, 0x6a5a3a]), 6);
        break;
      }
      case 'cubos': {
        // dos cubos de basura con ruedas (uno con la tapa abierta) y bolsas
        for (const [x, op] of [[-0.35, false], [0.35, rnd() < 0.6]]) {
          const col = U.pick(rnd, [0x3a5a7a, 0x4a4e52, 0x3e5a3e]);
          box(x, 0.5, 0, 0.6, 1.0, 0.68, col);
          if (op) box(x, 1.04, -0.28, 0.62, 0.04, 0.3, U.shade(col, 0.8));
          else box(x, 1.03, 0, 0.64, 0.05, 0.72, U.shade(col, 0.8));
          box(x, 0.08, -0.3, 0.5, 0.12, 0.1, 0x1c1c1c);
        }
        box(0.1, 0.12, 0.45, 0.4, 0.24, 0.3, 0x1e1e20);
        break;
      }
      case 'cobertizo': {
        // cobertizo de jardín de tablas, con la puerta cerrada y tejado a un agua
        const wd = U.pick(rnd, [0x7a6248, 0x6a7280, 0x8a7a5a]);
        box(0, 1.0, 0, W, 2.0, D, wd);
        for (let k = 0; k < 7; k++) box(-W / 2 + 0.15 + k * (W - 0.3) / 6, 1.0, D / 2 + 0.008, 0.03, 1.96, 0.012, U.shade(wd, 0.8));
        box(0.3, 0.92, D / 2 + 0.03, 0.9, 1.8, 0.04, U.shade(wd, 0.9));
        box(0.65, 0.95, D / 2 + 0.06, 0.05, 0.12, 0.04, 0x2a2a2a);
        box(0, 2.15, 0.08, W + 0.2, 0.08, D + 0.36, 0x3a3a3c);                          // tejado
        box(0, 2.05, -D / 2, W, 0.16, 0.06, wd);
        break;
      }
      case 'muro_bajo': {
        // muro bajo de hormigón (de contención), con musgo y desconchones
        box(0, H / 2, 0, W, H, D, 0x8e8b84);
        box(0, H + 0.02, 0, W + 0.04, 0.04, D + 0.04, 0x9a978e);
        for (let k = 0; k < Math.max(2, Math.round(W)); k++) box(-W / 2 + 0.2 + rnd() * (W - 0.4), 0.15 + rnd() * (H - 0.4), (rnd() < 0.5 ? -1 : 1) * (D / 2 + 0.008 + k * 0.005), 0.2 + rnd() * 0.5, 0.15 + rnd() * 0.3, 0.006, U.pick(rnd, [0x5e6a44, 0x76736c, 0x6a7a4a]));
        break;
      }
      case 'porche': {
        // porche de madera: tarima con escalones delante y un tejadillo apoyado en la fachada
        const wd = U.pick(rnd, [0x8a7a64, 0x7a6a56, 0x9a948a]);
        // (tarima baja: se camina por encima sin hundirse)
        box(0, 0.05, 0, W, 0.1, D, wd);
        for (let k = 0; k < Math.round(W / 0.3); k++) box(-W / 2 + 0.15 + k * 0.3, 0.106, 0, 0.012, 0.008, D, U.shade(wd, 0.8));
        box(0, 2.72, 0.05, W + 0.3, 0.1, D + 0.3, 0x4a4a4c);                              // tejadillo
        box(0, 2.6, D / 2 + 0.1, W + 0.2, 0.16, 0.08, wd);
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.05), 0.65, D / 2 - 0.05, 0.05, 0.7, 0.05, 0xd8d4c8);     // barandilla
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.05), 1.0, 0, 0.05, 0.05, D - 0.1, 0xd8d4c8);
        break;
      }
      case 'poste':
        box(0, H / 2, 0, 0.14, H, 0.14, 0xd8d4c8);
        box(0, 0.08, 0, 0.2, 0.16, 0.2, 0xc8c4b8);
        break;
      case 'valla_rota': {
        // tramo de valla de tablas caído o a medio caer (se puede saltar)
        const wd = 0x6a5a48;
        box(0, 0.35, 0, W, 0.06, 0.05, wd); box(0.1, 0.82, 0, W * 0.8, 0.06, 0.05, wd);
        for (let k = 0; k < Math.round(W / 0.2); k++) { if (rnd() < 0.3) continue; const hh = 0.5 + rnd() * 0.45; box(-W / 2 + 0.1 + k * 0.2, hh / 2, 0.04, 0.16, hh, 0.025, U.shade(wd, 0.85 + rnd() * 0.3)); }
        break;
      }
      case 'fogata': {
        // fogata apagada: piedras en corro, troncos quemados, ceniza y un par de latas
        box(0, 0.01, 0, 0.9, 0.02, 0.9, 0x2a2622);
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; box(Math.sin(a) * 0.48, 0.07, Math.cos(a) * 0.48, 0.18, 0.14, 0.16, U.pick(rnd, [0x6e6a64, 0x7c7870, 0x5e5a54])); }
        for (let k = 0; k < 4; k++) { const a = k * 0.8 + rnd(); m.box(cx + Math.sin(a) * 0.1, y0 + 0.08, cz + Math.cos(a) * 0.1, 0.07, 0.07, 0.6, k % 2 ? 0x1c1814 : 0x3a2a1e, a); }
        box(0.2, 0.035, 0.05, 0.12, 0.03, 0.1, 0x8a3a1a);                                 // brasas
        cyl(0.62, 0.06, -0.3, 0.04, 0.12, 0x8a8e92, 8); cyl(-0.55, 0.05, 0.42, 0.04, 0.1, 0x6a5a3a, 8);
        break;
      }
      case 'barricada': {
        // barricada de tablas clavadas a dos caballetes
        const wd = 0x7a6248;
        for (const sx of [-1, 1]) { box(sx * (W / 2 - 0.2), 0.45, 0, 0.08, 0.9, 0.5, U.shade(wd, 0.8)); }
        for (let k = 0; k < 4; k++) box((rnd() - 0.5) * 0.15, 0.25 + k * 0.24, 0.06, W - 0.1 + rnd() * 0.2, 0.18, 0.04, U.shade(wd, 0.85 + rnd() * 0.3));
        box(0, 0.6, -0.08, W * 0.9, 0.1, 0.04, U.shade(wd, 0.7));
        break;
      }
      case 'tarima': {
        // plataforma de vigilancia de madera (se puede subir): tablones sobre cuatro postes y una escalera
        const wd = 0x6e5a42;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.1), H / 2, sz * (D / 2 - 0.1), 0.14, H, 0.14, U.shade(wd, 0.8));
        box(0, H - 0.05, 0, W, 0.1, D, wd);
        for (let k = 0; k < 8; k++) box(-W / 2 + 0.15 + k * (W - 0.3) / 7, H + 0.002, 0, 0.012, 0.006, D, U.shade(wd, 0.75));
        box(-W / 2 + 0.08, H + 0.45, 0, 0.06, 0.9, D, U.shade(wd, 0.85));                  // barandilla de un lado
        for (const sx of [-0.25, 0.25]) box(sx, H / 2, D / 2 + 0.25, 0.05, H, 0.05, 0x5a4a36);
        for (let k = 0; k < 4; k++) box(0, 0.25 + k * 0.3, D / 2 + 0.25, 0.5, 0.04, 0.05, 0x5a4a36);
        break;
      }
      case 'tablas': {
        // pila de tablas y listones (material de los que estuvieron aquí)
        for (let k = 0; k < 6; k++) m.box(cx + (rnd() - 0.5) * 0.3 * cs, y0 + 0.05 + k * 0.07, cz - (rnd() - 0.5) * 0.3 * sn, W * (0.8 + rnd() * 0.2), 0.06, 0.18, U.shade(0x8a7050, 0.8 + rnd() * 0.3), ry + (rnd() - 0.5) * 0.2);
        break;
      }
      case 'refugio_lona': {
        // refugio de palos y lona apoyado en el suelo, con un saco de dormir dentro
        const col = U.pick(rnd, [0x3f5f86, 0x5a6a4a, 0x7a5a3a]);
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.08), H / 2, D / 2 - 0.1, 0.07, H, 0.07, 0x5a4a36);
        box(0, H - 0.04, D / 2 - 0.1, W, 0.07, 0.07, 0x5a4a36);
        m.box(cx - (0) * cs + (0) * sn, y0 + H / 2, cz, W, 0.04, D * 1.1, col, ry, undefined, -0.78 * 1, 0);
        box(0, 0.06, -0.1, 0.8, 0.12, 1.5, 0x4a5a3a);
        break;
      }
      case 'arbol_caido': {
        // tronco caído con la raíz arrancada y ramas rotas
        const bark = 0x5a4632;
        cyl(-0.2 * W, 0.42, 0, 0.36, 0.01, bark, 8);
        m.box(cx, y0 + 0.4, cz, W * 0.92, 0.66, 0.66, bark, ry);
        for (let k = 0; k < 6; k++) m.box(cx + (rnd() - 0.5) * W * 0.8 * cs, y0 + 0.75, cz - (rnd() - 0.5) * W * 0.8 * sn, 0.1, 0.1, 0.9 + rnd() * 0.8, U.shade(bark, 0.9), ry + (rnd() - 0.5) * 2.4);
        box(W / 2 - 0.15, 0.55, 0, 0.3, 1.1, 1.2, 0x4a3a2a);                                  // raíz
        box(W / 2 - 0.05, 0.3, 0, 0.2, 0.5, 0.9, 0x3e3226);
        for (let k = 0; k < 4; k++) box(-W / 2 + 0.6 + rnd() * 1.2, 0.85 + rnd() * 0.2, (rnd() - 0.5) * 0.9, 0.6, 0.4, 0.6, U.pick(rnd, [0x4f6a32, 0x5e7a3a]));
        break;
      }
      case 'cesped': {
        // hierba corta creciendo por las grietas del asfalto
        for (let k = 0; k < 7; k++) box((rnd() - 0.5) * W * 0.85, 0.012 + k * 0.006, (rnd() - 0.5) * D * 0.7, W * (0.15 + rnd() * 0.35), 0.012, D * (0.15 + rnd() * 0.4), U.pick(rnd, [0x4e6a34, 0x5a7a3c, 0x6a8444]));
        break;
      }
      case 'losa': {
        // trozo de forjado caído, inclinado, con hierros asomando
        m.box(cx, y0 + H * 0.45, cz, W, 0.22, D, 0x8e8a82, ry, undefined, 0.42, 0);
        for (let k = 0; k < 5; k++) box(-W / 2 + 0.3 + k * 0.5, H * 0.75, D * 0.3, 0.025, 0.5, 0.025, 0x6a4a32);
        box(0, 0.15, 0, W * 0.8, 0.3, D * 0.8, 0x7a766e);
        break;
      }
      case 'escombro_grande': {
        // montón de cascotes, ladrillos y bloques
        for (let k = 0; k < 14; k++) {
          const s = 0.2 + rnd() * 0.4, hh = (1 - Math.abs(k / 14 - 0.5)) * 0.7;
          box((rnd() - 0.5) * W * 0.8, s * 0.3 + rnd() * hh, (rnd() - 0.5) * D * 0.8, s * (1 + rnd()), s * 0.6, s * (0.8 + rnd()), U.pick(rnd, [0x8e8a82, 0x7a766e, 0x9a5a44, 0x6e6a64]));
        }
        break;
      }
      case 'gondola': case 'gondola_caida': {
        // góndola de metal de doble cara, vacía (algún paquete suelto). Caída: tumbada de lado
        const mt = 0x8e9296, dk2 = 0x5e6266;
        if (f.type === 'gondola_caida') {
          box(0, 0.35, 0, W, 0.7, 0.08, mt);
          for (let k = 0; k < 4; k++) box(0, 0.08 + k * 0.2, 0.35, W - 0.1, 0.03, 0.6, dk2);
          box(0, 0.05, -0.5, W * 0.4, 0.08, 0.3, 0x6a5a4a);
          break;
        }
        box(0, H / 2, 0, W, H, 0.08, mt);                                                  // panel central
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.03), H / 2, 0, 0.06, H, D, dk2);   // laterales
        box(0, 0.08, 0, W, 0.16, D, dk2);                                                 // zócalo
        for (let k = 0; k < 4; k++) {
          const y = 0.45 + k * 0.38;
          for (const sz of [-1, 1]) box(0, y, sz * D / 4, W - 0.1, 0.03, D / 2 - 0.04, mt);
        }
        for (let k = 0; k < 5; k++) if (rnd() < 0.5) box((rnd() - 0.5) * (W - 0.4), 0.55 + Math.floor(rnd() * 4) * 0.38, (rnd() < 0.5 ? -1 : 1) * D / 4, 0.18, 0.2, 0.14, U.pick(rnd, [0xc23a2a, 0xd8b84a, 0x3a6a9a, 0xe0d8c8]));
        box(0, H + 0.12, 0, W * 0.6, 0.2, 0.04, U.pick(rnd, [0xd8c84a, 0x3a7a5a, 0xc8452e]));   // rótulo del pasillo
        break;
      }
      case 'frutero': {
        // expositor de fruta de madera con los cajones inclinados (vacío, alguna fruta podrida)
        const wd = 0x7a5a3a;
        box(0, 0.35, 0, W, 0.7, D * 0.6, U.shade(wd, 0.85));
        for (const sz of [-1, 1]) {
          m.box(cx + (sz * D * 0.3) * sn, y0 + 0.78, cz + (sz * D * 0.3) * cs, W, 0.06, D * 0.42, wd, ry, undefined, sz * 0.35, 0);
          box(0, 0.86, sz * (D / 2 - 0.03), W, 0.16, 0.04, U.shade(wd, 0.75));
        }
        for (let k = 0; k < 4; k++) box(-W / 2 + 0.3 + k * (W - 0.6) / 3, 0.82, 0, 0.04, 0.2, D * 0.85, U.shade(wd, 0.7));
        for (let k = 0; k < 5; k++) if (rnd() < 0.5) cyl((rnd() - 0.5) * (W - 0.4), 0.88, (rnd() - 0.5) * D * 0.6, 0.06, 0.1, U.pick(rnd, [0x5a3a1a, 0x6a5a20, 0x3a4a1a]), 6);
        box(0, 0.5, D * 0.3 + 0.02, W * 0.5, 0.3, 0.02, 0x3a6a3a);                         // cartel verde
        break;
      }
      case 'cajas_fruta': {
        // pila de cajas de cartón de fruta con su etiqueta de colores
        const cb = 0xb89a6a;
        for (let k = 0; k < 3; k++) {
          const w2 = W * (0.95 - k * 0.08), sx = (rnd() - 0.5) * 0.1;
          box(sx, 0.2 + k * 0.4, (rnd() - 0.5) * 0.08, w2, 0.38, D * 0.95, U.shade(cb, 0.9 + rnd() * 0.2));
          box(sx, 0.2 + k * 0.4, D * 0.475 + 0.005, w2 * 0.6, 0.18, 0.006, U.pick(rnd, [0xd84a2a, 0x3a8a3a, 0xe0b030]));
        }
        break;
      }
      case 'congelador': {
        // arcón congelador blanco sucio, con nieve encima y la tapa de cristal rota
        box(0, 0.42, 0, W, 0.84, D, 0xd6d8d4);
        box(0, 0.06, 0, W + 0.02, 0.12, D + 0.02, 0x7a7c7e);
        box(0, 0.85, 0, W - 0.16, 0.02, D - 0.16, 0x2a3036);
        box(0, 0.93, 0, W - 0.02, 0.08, D - 0.04, 0xeef0f2);                                // nieve
        box((rnd() - 0.5) * 0.6, 0.98, 0, W * 0.5, 0.05, D * 0.6, 0xf4f6f8);
        box(0, 0.45, D / 2 + 0.008, W * 0.8, 0.12, 0.006, 0x3a6a9a);
        break;
      }
      case 'vitrina': {
        // vitrina refrigerada de pared con puertas de cristal (oscuras, alguna rota)
        box(0, H / 2, -0.05, W, H, D - 0.1, 0x7a7e82);
        for (let k = 0; k < 3; k++) {
          const x = -W / 2 + 0.34 + k * (W - 0.68) / 2;
          box(x, 1.05, D / 2 - 0.08, 0.6, 1.7, 0.03, rnd() < 0.25 ? 0x0e1012 : 0x34404a);
          box(x, 1.05, D / 2 - 0.06, 0.62, 0.04, 0.03, 0x9a9ea2);
        }
        box(0, H - 0.12, D / 2 - 0.06, W, 0.24, 0.05, U.pick(rnd, [0x3a6a9a, 0xc8452e, 0x3a7a5a]));
        break;
      }
      case 'caja_reg': {
        // caja registradora con su cinta y la máquina (volcada a veces)
        box(0, 0.45, 0, W, 0.9, D, 0x8a8478);
        box(-0.3, 0.92, 0, W * 0.7, 0.04, D * 0.7, 0x2a2a2c);
        box(W / 2 - 0.4, 1.05, 0, 0.45, 0.2, 0.4, 0x3a3a3c);
        box(W / 2 - 0.4, 1.25, -0.1, 0.06, 0.25, 0.06, 0x2a2a2c);
        box(-W / 2 + 0.05, 1.35, 0, 0.05, 0.9, 0.05, 0x9a9ea2); box(-W / 2 + 0.05, 1.82, 0, 0.3, 0.2, 0.04, 0xd8c84a);   // número de caja
        break;
      }
      case 'aire_caido': {
        // unidad de aire acondicionado caída del techo, abollada, con la rejilla del ventilador
        box(0, H / 2, 0, W, H, D, 0xb4b6b2);
        cyl(0, H / 2, D / 2 + 0.01, 0.55, 0.04, 0x3a3c3e, 16);
        for (let k = 0; k < 5; k++) box(0, H / 2 - 0.4 + k * 0.2, D / 2 + 0.035, 1.05, 0.03, 0.02, 0x8a8c8e);
        for (let k = 0; k < 6; k++) box(-W / 2 + 0.2 + k * 0.4, H * 0.3, -D / 2 - 0.008, 0.25, 0.4, 0.006, 0x8a8c88);
        box(0, H + 0.04, 0, W - 0.1, 0.08, D - 0.1, 0xeef0f2);                              // nieve encima
        break;
      }
      case 'vigas': {
        // vigas y planchas del techo hundido, cruzadas y torcidas
        for (let k = 0; k < 3; k++) m.box(cx + (rnd() - 0.5) * W * 0.3 * cs, y0 + 0.3 + k * 0.35, cz - (rnd() - 0.5) * W * 0.3 * sn, W * (0.8 + rnd() * 0.2), 0.2, 0.3, 0x4a4c4e, ry + (rnd() - 0.5) * 0.5, undefined, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.4);
        for (let k = 0; k < 4; k++) m.box(cx + (rnd() - 0.5) * W * 0.6 * cs, y0 + 0.2 + rnd() * 0.8, cz - (rnd() - 0.5) * W * 0.6 * sn, 1.2, 0.04, 1.0, U.pick(rnd, [0xc8c4bc, 0x9a968e, 0x7a7c80]), ry + rnd() * 3, undefined, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2);
        box(0, 0.05, 0, W * 0.9, 0.1, D * 0.8, 0xe8eaec);                                    // nieve debajo
        break;
      }
      case 'nieve': {
        // capa de nieve en el suelo (entró por el techo roto), de bordes irregulares
        const sw = 0xe6e9ec;
        box(0, 0.012, 0, W * 0.85, 0.02, D * 0.8, sw);
        for (let k = 0; k < 5; k++) box((rnd() - 0.5) * W * 0.7, 0.03 + k * 0.007, (rnd() - 0.5) * D * 0.6, W * (0.2 + rnd() * 0.4), 0.02, D * (0.2 + rnd() * 0.4), U.shade(sw, 0.94 + rnd() * 0.08));
        break;
      }
      case 'monton_nieve': {
        // montón de nieve bajo un agujero del techo (se sube encima)
        const sw = 0xeef0f2;
        box(0, H * 0.3, 0, W, H * 0.6, D, U.shade(sw, 0.96));
        box(0, H * 0.7, 0, W * 0.75, H * 0.35, D * 0.7, sw);
        box(0, H * 0.92, 0, W * 0.45, H * 0.16, D * 0.4, 0xf6f8fa);
        break;
      }
      case 'carrito': {
        // carrito de la compra de alambre
        const wr = 0x9a9ea2;
        box(0, 0.62, 0, 0.56, 0.02, 0.85, wr); box(0, 0.98, 0.42, 0.56, 0.02, 0.02, wr);
        for (const sx of [-1, 1]) box(sx * 0.28, 0.8, 0, 0.02, 0.36, 0.85, wr);
        box(0, 0.8, -0.42, 0.56, 0.36, 0.02, wr); box(0, 0.8, 0.42, 0.56, 0.36, 0.02, wr);
        box(0, 1.0, -0.48, 0.5, 0.04, 0.04, 0xc23a2a);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(sx * 0.24, 0.3, sz * 0.36, 0.02, 0.6, 0.02, wr); cyl(sx * 0.24, 0.04, sz * 0.36, 0.04, 0.03, 0x1a1a1a, 6); }
        break;
      }
      case 'cartel_colgante': {
        // cartel del pasillo colgado del techo con dos cables
        const yy = (f.hang || 3.4);
        box(0, yy, 0, W, H, 0.06, U.pick(rnd, [0xd8c84a, 0xe0dcd0, 0x3a7a5a]));
        box(0, yy, 0.035, W * 0.7, H * 0.4, 0.006, 0x2a2a2a);
        for (const sx of [-1, 1]) box(sx * W * 0.4, yy + 0.7, 0, 0.01, 1.2, 0.01, 0x2a2a2a);
        break;
      }
      case 'cadaveres': {
        // montículo de chasqueadores quemados: cuerpos ennegrecidos amontonados, las cabezas deformes por el hongo
        // (carbonizadas), brazos y piernas sueltos, ceniza alrededor y algún neumático y palo que usaron para quemarlos
        box(0, 0.015, 0, W * 1.1, 0.03, D * 1.1, 0x2a2622);                                // ceniza
        box(0.3, 0.025, -0.4, W * 0.5, 0.02, D * 0.4, 0x4a4440);
        const burnt = [0x1c1814, 0x2a221c, 0x3a2e24, 0x241e1a];
        for (let k = 0; k < 6; k++) {
          const a = rnd() * Math.PI * 2, rr = rnd() * 0.6, y = 0.15 + (k > 3 ? 0.3 : 0) + rnd() * 0.1;
          const bx = Math.sin(a) * rr, bz = Math.cos(a) * rr * 0.8, rot = ry + rnd() * Math.PI;
          // tronco
          m.box(cx + bx * cs + bz * sn, y0 + y, cz - bx * sn + bz * cs, 0.42, 0.24, 0.75, U.pick(rnd, burnt), rot, undefined, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4);
          // cabeza con el hongo (bultos carbonizados)
          const hx = bx + Math.sin(rot) * 0.5, hz = bz + Math.cos(rot) * 0.5;
          for (let j = 0; j < 3; j++) m.sphere(cx + (hx + (rnd() - 0.5) * 0.12) * cs + (hz + (rnd() - 0.5) * 0.12) * sn, y0 + y + 0.05 + rnd() * 0.08, cz - (hx) * sn + (hz) * cs, 0.12 + rnd() * 0.06, 0.1 + rnd() * 0.05, 0.12 + rnd() * 0.06, U.pick(rnd, [0x2e241c, 0x4a3a2a, 0x1e1a16]), 0);
          // brazos o piernas
          for (let j = 0; j < 2; j++) m.box(cx + (bx + (rnd() - 0.5) * 0.6) * cs + (bz + (rnd() - 0.5) * 0.6) * sn, y0 + y + (rnd() - 0.3) * 0.15, cz - (bx) * sn + (bz) * cs, 0.09, 0.09, 0.55, U.pick(rnd, burnt), rnd() * 6.28, undefined, (rnd() - 0.5) * 0.8, 0);
        }
        cyl(-W / 2 + 0.2, 0.12, D / 2 - 0.1, 0.32, 0.22, 0x161616, 10);                  // neumático
        m.box(cx + 0.9 * cs, y0 + 0.4, cz - 0.9 * sn, 0.05, 0.05, 1.6, 0x4a3a28, ry + 0.6, undefined, 0.5, 0);   // palo
        box(0.1, 0.03, 0.2, 0.5, 0.02, 0.3, 0x6a2a14);                                     // brasa vieja
        break;
      }
      case 'fachada': {
        // bloque de pisos abandonado: planta baja de locales tapiados, pisos con ventanas (algunas rotas o con
        // tablas), cornisas entre plantas, escalera de incendios, aparatos de aire, manchas de humedad y enredaderas
        const st = f.style || 0;
        const wall = [0x9a5a44, 0xb8b0a0, 0x7f8a8e][st % 3], dk = U.shade(wall, 0.72), lt = U.shade(wall, 1.12);
        const FL = 3.0, nF = Math.max(2, Math.floor((H - 1) / FL));
        box(0, H / 2, 0, W, H, D, wall);
        const z = D / 2;
        // planta baja: zócalo oscuro y locales con persianas y tablas
        box(0, 1.6, z + 0.02, W, 3.2, 0.04, U.shade(wall, 0.6));
        const shops = Math.max(1, Math.floor(W / 5));
        for (let k = 0; k < shops; k++) {
          const sx = -W / 2 + (k + 0.5) * W / shops;
          box(sx, 1.35, z + 0.05, 3.2, 2.5, 0.04, 0x2a2826);
          if (rnd() < 0.5) for (let j = 0; j < 9; j++) box(sx, 0.25 + j * 0.27, z + 0.08, 3.1, 0.2, 0.02, 0x6f7375);     // persiana bajada
          else for (let j = 0; j < 4; j++) m.box(cx + (sx + (rnd() - 0.5) * 0.4) * cs + (z + 0.09) * sn, y0 + 0.5 + j * 0.55, cz - (sx + (rnd() - 0.5) * 0.4) * sn + (z + 0.09) * cs, 3.0, 0.18, 0.03, U.shade(0x8a7050, 0.8 + rnd() * 0.3), ry, undefined, 0, (rnd() - 0.5) * 0.25);   // tablas clavadas
          box(sx, 2.85, z + 0.07, 3.4, 0.5, 0.06, U.pick(rnd, [0x3a4a5a, 0x5a3a3a, 0x3a5a4a]));   // rótulo desvaído
        }
        // pisos: cornisa y ventanas
        const nW = Math.max(2, Math.floor(W / 2.4));
        for (let fl = 1; fl <= nF; fl++) {
          const y = 0.3 + fl * FL;
          box(0, y - 0.15, z + 0.08, W + 0.1, 0.18, 0.16, lt);                              // cornisa
          if (y + 1.6 > H) break;
          for (let k = 0; k < nW; k++) {
            const wx = -W / 2 + (k + 0.5) * W / nW, r = rnd();
            box(wx, y + 1.2, z + 0.03, 1.2, 1.6, 0.04, dk);                                  // marco
            const glass = r < 0.15 ? 0x6e5a42 : (r < 0.4 ? 0x141618 : 0x3a4650);           // tablas, rota (negra) o cristal sucio
            box(wx, y + 1.2, z + 0.055, 1.0, 1.4, 0.03, glass);
            if (r >= 0.4) box(wx, y + 1.2, z + 0.075, 0.06, 1.4, 0.02, dk);
            box(wx, y + 0.38, z + 0.12, 1.3, 0.08, 0.2, lt);                                 // alféizar
            if (rnd() < 0.08) box(wx + 0.3, y + 0.6, z + 0.35, 0.7, 0.45, 0.5, 0x9a9a96);   // aire acondicionado
          }
        }
        // escalera de incendios en zigzag (a un lado)
        const fx0 = W / 2 - 2.2;
        for (let fl = 1; fl <= nF; fl++) {
          const y = 0.3 + fl * FL;
          if (y + 1 > H) break;
          box(fx0, y, z + 0.6, 2.2, 0.06, 1.1, 0x2c2c2e);
          box(fx0, y + 0.95, z + 1.12, 2.2, 0.04, 0.04, 0x2c2c2e);
          for (const sx of [-1.08, 1.08]) box(fx0 + sx, y + 0.5, z + 1.12, 0.04, 1.0, 0.04, 0x2c2c2e);
          m.box(cx + fx0 * cs + (z + 0.6) * sn, y0 + y - FL / 2, cz - fx0 * sn + (z + 0.6) * cs, 2.6, 0.06, 0.6, 0x2c2c2e, ry, undefined, 0, (fl % 2 ? 1 : -1) * 0.85);
        }
        // remate: pretil, depósito de agua y antena
        box(0, H + 0.4, z - 0.1, W + 0.2, 0.8, 0.25, lt);
        if (W > 12) { cyl(-W / 4, H + 1.6, 0, 1.0, 2.4, 0x5a4a3a, 10); box(-W / 4, H + 0.3, 0, 1.6, 0.6, 1.6, 0x3a3a3a); }
        box(W / 4, H + 1.5, 0, 0.06, 3.0, 0.06, 0x3a3a3a);
        // manchas de humedad y enredaderas
        for (let k = 0; k < Math.round(W / 3); k++) box((rnd() - 0.5) * (W - 1), H * (0.4 + rnd() * 0.5), z + 0.015 + k * 0.004, 0.6 + rnd() * 1.6, 1.5 + rnd() * 3, 0.004, U.shade(wall, 0.8));
        for (let k = 0; k < Math.round(W / 6); k++) {
          const vx = (rnd() - 0.5) * (W - 2), vh = 3 + rnd() * (H * 0.6);
          box(vx, vh / 2, z + 0.13, 0.8 + rnd() * 1.2, vh, 0.06, U.pick(rnd, [0x3e5a2a, 0x4a6a32, 0x52703a]));
        }
        break;
      }
      case 'charco': {
        // charco: agua quieta que refleja el cielo (gris azulado), con bordes irregulares
        const col = 0x3d4850;
        // (capas separadas un poco en altura: si no, se pisan y parpadean)
        box(0, 0.005, 0, W * 0.8, 0.01, D * 0.7, col);
        box(W * 0.12, 0.009, D * 0.18, W * 0.5, 0.01, D * 0.5, U.shade(col, 1.1));
        box(-W * 0.2, 0.013, -D * 0.15, W * 0.45, 0.01, D * 0.55, U.shade(col, 0.95));
        box(W * 0.28, 0.017, -D * 0.22, W * 0.3, 0.01, D * 0.4, col);
        break;
      }
      case 'ambulancia': drawVan(box, cyl, W, D, rnd); break;
      case 'tablero': {
        // tabique de madera con un corcho y tres planos clavados (uno por mapa) y un cartel arriba
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.06), H / 2, -0.02, 0.12, H, 0.2, 0x5a4632);
        box(0, 0.08, 0, W + 0.1, 0.16, D, 0x4a3a2a);
        box(0, 1.3, -0.05, W - 0.12, 1.9, 0.08, 0x6e5a40);
        box(0, 1.3, 0.0, W - 0.32, 1.6, 0.03, 0xa9825a);
        const cols = [0x7a8a5a, 0x5a6670, 0x4a3a66];
        for (let k = 0; k < 3; k++) {
          const x = -0.68 + k * 0.68;
          box(x, 1.3, 0.025, 0.56, 0.6, 0.012, 0xe8e2d0);
          box(x, 1.32, 0.033, 0.48, 0.42, 0.006, cols[k]);
          box(x, 1.06, 0.033, 0.4, 0.05, 0.006, 0x2a2622);
          box(x, 1.57, 0.04, 0.04, 0.04, 0.02, 0xc23a2a);
        }
        box(0, 2.15, 0.02, 1.3, 0.22, 0.04, 0x2a2622);
        box(0, 2.15, 0.045, 1.1, 0.06, 0.006, 0xe8e2d0);
        break;
      }
      case 'maquina': case 'maquina_rota': case 'pinball': case 'hockey': case 'grua': case 'cambio':
      case 'hongos': case 'escombros': case 'hongo_pared':
        drawArcade(f, box, cyl, (lx, ly, lz, rx, ry, rz, hex, det) => m.sphere(cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs, rx, ry, rz, hex, det || 1), W, D, H, rnd,
          { m, ry, P: (lx, ly, lz) => [cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs] });
        break;
      case 'palmera': case 'bote': case 'balsa': case 'roca': case 'sacos': case 'saco_dormir': case 'tienda': case 'tendedero':
      case 'mesa_campo': case 'armero': case 'barril_fuego': case 'fogata_viva': case 'consola': case 'columna': case 'esqueleto':
      case 'pedestal': case 'cuadro': case 'banco_parque': case 'pena': case 'pilar': case 'arco':
        drawCamp(f, m, box, cyl, W, D, H, rnd, cx, cz, y0, cs, sn, ry, wood, fabric);
        break;
      case 'marquesina': case 'surtidor': case 'cartel_precios': case 'neumaticos': case 'fuente': case 'columpio': case 'tobogan': case 'seto':
      case 'buzon': case 'semaforo': case 'senal': case 'hidrante': case 'paso_cebra': case 'parada': case 'papelera': case 'kiosco':
        drawStreet(f, m, box, cyl, W, D, H, rnd, cx, cz, y0, cs, sn, ry);
        break;
      case 'socorrista': case 'planta_hielo': case 'agave': case 'surf': case 'tumba': case 'vias': case 'aro_fuego': case 'cartel_madera':
      case 'reja': case 'reja_puerta': case 'tabique': case 'colchon': case 'poste_cadena': case 'estatua':
        drawCoast(f, m, box, cyl, W, D, H, rnd, cx, cz, y0, cs, sn, ry);
        break;
      default:
        box(0, H / 2, 0, W, H, D, wood);
    }
  }

  // ---------- Asentamiento de Oceanside (diseños propios) ----------
  function drawCoast(f, m, box, cyl, W, D, H, rnd, cx, cz, y0, cs, sn, ry) {
    const P = (lx, ly, lz) => [cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs];
    const sph = (lx, ly, lz, rx, r2, rz, hex) => { const p = P(lx, ly, lz); m.sphere(p[0], p[1], p[2], rx, r2, rz, hex, 1); };
    const tri2 = (a, b, c, hex) => { m.tri(a, b, c, hex); m.tri(a, c, b, hex); };
    switch (f.type) {
      case 'socorrista': {
        // torre de socorrista de la playa: caseta azul pálido sobre zancos, ventanas corridas, tejado plano que
        // vuela, terraza delante con barandilla y escalones a la arena. Las de Oceanside tienen el número pintado
        const blue = f.col || U.pick(rnd, [0x8fb4c4, 0x9cc0cc, 0x86a8ba]), trim = 0xe8e4da, dk = 0x2a3238, wd = 0x7a6a56;
        const cz0 = -D / 2 + 0.95, FH = 1.5;                    // centro de la caseta (hacia atrás) y altura del suelo
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.95, FH / 2, cz0 + sz * 0.75, 0.16, FH, 0.16, 0xd8d4ca);
        for (const sx of [-1, 1]) { const p = P(sx * 0.95, FH * 0.5, cz0); m.box(p[0], p[1], p[2], 0.06, 0.06, 1.7, 0xc8c4ba, ry); }   // riostras
        box(0, FH, -D / 2 + 1.35, W, 0.12, 2.6, wd);                                   // suelo (caseta y terraza)
        box(0, FH + 0.85, cz0, 2.0, 1.6, 1.6, blue);                                   // caseta
        box(0, FH + 1.12, cz0 + 0.81, 1.8, 0.55, 0.02, dk);                             // ventanas corridas
        for (const sx of [-1, 1]) box(sx * 1.01, FH + 1.12, cz0, 0.02, 0.55, 1.4, dk);
        box(0, FH + 0.82, cz0 + 0.815, 1.86, 0.06, 0.02, trim); box(0, FH + 1.42, cz0 + 0.815, 1.86, 0.06, 0.02, trim);
        box(0, FH + 1.72, cz0 + 0.1, 2.4, 0.12, 2.1, trim);                            // tejado que vuela
        box(0, FH + 1.66, cz0 + 1.14, 2.4, 0.08, 0.04, blue);
        box(-0.55, FH + 0.5, cz0 + 0.815, 0.36, 0.3, 0.02, trim);                       // el número
        box(-0.55, FH + 0.5, cz0 + 0.83, 0.12, 0.22, 0.01, 0x8a2a22);
        // terraza: barandilla de tubo
        const zf = -D / 2 + 2.6;
        for (const sx of [-1.1, -0.45, 1.1]) box(sx, FH + 0.45, zf, 0.06, 0.9, 0.06, trim);
        box(-0.6, FH + 0.88, zf, 1.1, 0.05, 0.05, trim); box(1.1, FH + 0.88, zf - 0.45, 0.05, 0.05, 0.9, trim); box(-1.1, FH + 0.88, zf - 0.45, 0.05, 0.05, 0.9, trim);
        // escalones a la arena (por el lado derecho de la terraza)
        for (let k = 0; k < 5; k++) { const h = FH - (k + 1) * 0.28; if (h <= 0.02) break; box(0.62, h / 2, zf + 0.12 + k * 0.24, 0.8, h, 0.24, U.shade(wd, 0.9 + (k % 2) * 0.08)); }
        // un salvavidas colgado y una tabla de rescate apoyada
        cyl(0.62, FH + 0.6, cz0 + 0.85, 0.22, 0.06, 0xd8502a, 10);
        box(-1.25, 0.9, cz0 + 0.3, 0.06, 1.8, 0.45, 0xd8c070);
        if (f.used) {
          // los Escorpiones la usaron de puesto: sacos en la terraza y una lona tapando la ventana de un lado
          for (let k = 0; k < 4; k++) sph(-0.9 + k * 0.45, FH + 0.18, zf - 0.12, 0.24, 0.14, 0.18, U.pick(rnd, [0xa8987a, 0x9c8c6c, 0xb4a484]));
          box(1.03, FH + 1.12, cz0, 0.03, 0.62, 1.5, 0x5a6a4a);
        }
        break;
      }
      case 'planta_hielo': {
        // uña de gato (la planta carnosa de las laderas de la costa): una alfombra baja, verde y rojiza, con
        // flores rosas y moradas
        // (la mata no es un rectángulo: varias manchas que se pisan, de bordes desiguales)
        const nb = Math.max(2, Math.round(W * D * 1.4));
        for (let k = 0; k < nb; k++) { const w = W * (0.35 + rnd() * 0.4), d = D * (0.45 + rnd() * 0.45); box((rnd() - 0.5) * (W - w), 0.02 + rnd() * 0.015, (rnd() - 0.5) * (D - d), w, 0.04, d, U.pick(rnd, [0x4a6232, 0x52683a, 0x5a5a34])); }
        const n = Math.max(3, Math.round(W * D * 4));
        for (let k = 0; k < n; k++) {
          const lx = (rnd() - 0.5) * (W - 0.2), lz = (rnd() - 0.5) * (D - 0.2), r = 0.14 + rnd() * 0.16;
          box(lx, 0.06, lz, r * 2, 0.06 + rnd() * 0.05, r * 1.6, U.pick(rnd, [0x587a38, 0x6a8a3e, 0x7a6a3a, 0x8a4a32]));
          if (rnd() < 0.55) box(lx + (rnd() - 0.5) * r, 0.12, lz + (rnd() - 0.5) * r, 0.07, 0.03, 0.07, U.pick(rnd, [0xd24a9a, 0xe06ab4, 0xb8408a, 0xe8d26a]));
        }
        break;
      }
      case 'agave': {
        // agave: roseta de hojas gruesas y puntiagudas, verde azulado, las de fuera abiertas y las de dentro de pie
        const n = 13, col = U.pick(rnd, [0x6e8a7e, 0x7a9484, 0x66806e]);
        for (let k = 0; k < n; k++) {
          const a = k * 2.4 + rnd() * 0.3, inner = k >= 8, L = (inner ? 0.42 : 0.55) * (0.85 + rnd() * 0.3);
          const ux = Math.sin(a), uz = Math.cos(a), px = -uz * 0.07, pz = ux * 0.07;
          const tip = P(ux * L * (inner ? 0.45 : 1), (inner ? 0.85 : 0.42) * (0.85 + rnd() * 0.25), uz * L * (inner ? 0.45 : 1));
          const b1 = P(px, 0.05, pz), b2 = P(-px, 0.05, -pz), mid = P(ux * 0.08, 0.12, uz * 0.08);
          tri2(b1, tip, mid, col); tri2(b2, mid, tip, U.shade(col, 0.82));
        }
        sph(0, 0.06, 0, 0.18, 0.08, 0.18, 0x5a5040);
        break;
      }
      case 'surf': {
        // caballete de madera con tablas de surf de pie (descoloridas por el sol)
        const wd = 0x7a6248;
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.05), 0.6, 0, 0.08, 1.2, D, wd);
        box(0, 1.15, 0, W, 0.07, 0.08, wd); box(0, 0.12, 0, W, 0.07, D, U.shade(wd, 0.85));
        const n = 3 + Math.floor(rnd() * 2);
        for (let k = 0; k < n; k++) {
          const lx = -W / 2 + 0.28 + k * (W - 0.56) / (n - 1), col = U.pick(rnd, [0xe8e2d0, 0x8ac0c8, 0xe8b45a, 0xd86a4a, 0x6a9ab8, 0xc8d8a8]);
          sph(lx, 1.0, (rnd() - 0.5) * 0.15, 0.24, 0.98, 0.045, col);
          box(lx, 1.0, 0.05, 0.03, 1.5, 0.01, U.shade(col, 0.75));                        // el larguero
        }
        break;
      }
      case 'tumba': {
        // tumba: túmulo de tierra con un borde de piedras y una cruz de tablas (alguna con algo colgado)
        sph(0, 0.06, 0.1, W * 0.42, 0.18, D * 0.42, U.pick(rnd, [0x5e4e3a, 0x6a5840, 0x55473a]));
        for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; sph(Math.sin(a) * W * 0.46, 0.05, 0.1 + Math.cos(a) * D * 0.44, 0.1, 0.07, 0.09, U.pick(rnd, [0x8a867e, 0x9a958c, 0x76726a])); }
        const wd = U.pick(rnd, [0x6a5038, 0x7a6248, 0x5a4632]), zc = -D / 2 + 0.12;
        box(0, H / 2, zc, 0.08, H, 0.06, wd); box(0, H * 0.72, zc, 0.5, 0.07, 0.06, wd);
        if (rnd() < 0.5) box(0.02, H * 0.55, zc + 0.05, 0.16, 0.2, 0.02, 0xd8d0b8);      // una placa escrita
        if (rnd() < 0.4) sph(0, H + 0.04, zc, 0.13, 0.08, 0.13, 0x4a5a3a);              // un casco encima
        if (rnd() < 0.6) box((rnd() - 0.5) * 0.4, 0.14, 0.3, 0.2, 0.05, 0.08, U.pick(rnd, [0x9a5a6a, 0x8a7a3a]));   // flores secas
        break;
      }
      case 'vias': {
        // vía del tren: balasto, traviesas de madera y dos raíles oxidados (a lo largo de W)
        box(0, 0.03, 0, W, 0.06, D, 0x6e665c);
        for (let x = -W / 2 + 0.3; x < W / 2; x += 0.62) box(x, 0.08, 0, 0.24, 0.06, D * 0.86, U.shade(0x5a4632, 0.8 + rnd() * 0.3));
        for (const s2 of [-1, 1]) { box(0, 0.14, s2 * 0.72, W, 0.07, 0.07, 0x6a4a36); box(0, 0.18, s2 * 0.72, W, 0.02, 0.09, 0x8a6a50); }
        break;
      }
      case 'aro_fuego': {
        // aro de fuego de la playa (de hormigón), con ceniza y restos de leña de hace tiempo
        for (let k = 0; k < 10; k++) {
          const a = (k + 0.5) / 10 * Math.PI * 2, R0 = W * 0.42, p = P(Math.sin(a) * R0, H / 2, Math.cos(a) * R0);
          m.box(p[0], p[1], p[2], 2 * (R0 + 0.06) * Math.tan(Math.PI / 10) + 0.02, H, 0.14, 0x9a968c, ry + a);
        }
        cyl(0, 0.08, 0, W * 0.36, 0.1, 0x3a3632, 10);
        for (let k = 0; k < 3; k++) { const a = k * 1.1 + rnd(); m.box(cx + Math.sin(a) * 0.08, y0 + 0.15, cz + Math.cos(a) * 0.08, 0.07, 0.07, 0.55, 0x2a2018, a); }
        break;
      }
      case 'reja': case 'reja_puerta': {
        // reja soldada con lo que había: pletinas arriba y abajo, barrotes de varilla oxidada (alguno torcido),
        // chapas soldadas a trozos y alambre de espino arriba; la puerta, con bisagras, cadena y candado
        const door = f.type === 'reja_puerta', rust = [0x5a3e2e, 0x6a4a34, 0x4e3a2e, 0x7a5236];
        for (const y of [0.08, H - 0.06, H * 0.48]) box(0, y, 0, W, 0.06, 0.05, U.pick(rnd, rust));
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.03), H / 2, 0, 0.06, H, 0.06, 0x3e3632);
        const n = Math.max(3, Math.round(W / 0.14));
        for (let k = 1; k < n; k++) {
          const lx = -W / 2 + k * W / n, bent = rnd() < 0.08;
          if (bent) { const p = P(lx, H / 2, 0); m.box(p[0], p[1], p[2], 0.022, H - 0.1, 0.022, U.pick(rnd, rust), ry, undefined, 0, 0.06); }
          else box(lx, H / 2, 0, 0.022, H - 0.1, 0.022, U.pick(rnd, rust));
        }
        if (!door) for (let k = 0; k < Math.round(W); k++) if (rnd() < 0.35) box((rnd() - 0.5) * (W - 0.4), 0.3 + rnd() * 0.5, 0.03, 0.3 + rnd() * 0.4, 0.25 + rnd() * 0.4, 0.012, U.pick(rnd, [0x6a6a62, 0x5a5048, 0x7a6a52]));
        if (!door && rnd() < 0.7) for (let k = 0; k < Math.round(W * 3); k++) box(-W / 2 + (k + 0.5) * W / Math.round(W * 3), H + 0.06, 0, W / Math.round(W * 3) * 0.8, 0.1, 0.1, 0x6a6a66);
        if (door) {
          for (const y of [0.4, H - 0.4]) box(-W / 2 - 0.02, y, 0, 0.05, 0.14, 0.09, 0x2a2a2a);                 // bisagras
          for (let k = 0; k < 5; k++) box(W / 2 - 0.02, H * 0.5 - 0.08 + k * 0.045, 0.04, 0.05, 0.03, 0.012, 0x8a8a84);   // la cadena
          box(W / 2 - 0.02, H * 0.42, 0.06, 0.07, 0.08, 0.03, 0x9a8a3a);                                             // candado
        }
        break;
      }
      case 'tabique': {
        // tabique de chapa ondulada o de contrachapado, clavado a listones (las paredes de las celdas)
        const tin = rnd() < 0.55, c0 = tin ? U.pick(rnd, [0x7a7e7a, 0x6a6e6c, 0x8a7a64]) : U.pick(rnd, [0xa48a64, 0x9a8058, 0x8a7458]);
        box(0, H / 2, 0, W, H, D * 0.5, c0);
        if (tin) for (let k = 0; k < Math.round(W / 0.12); k++) box(-W / 2 + 0.06 + k * 0.12, H / 2, D * 0.27, 0.03, H, 0.012, U.shade(c0, 0.85));
        else for (let k = 1; k < Math.ceil(W / 1.2); k++) box(-W / 2 + k * 1.2, H / 2, D * 0.26, 0.02, H, 0.01, U.shade(c0, 0.7));
        for (const y of [0.2, H * 0.5, H - 0.2]) box(0, y, -D * 0.4, W, 0.08, 0.05, 0x5a4a36);
        for (let k = 0; k < 3; k++) box((rnd() - 0.5) * W * 0.8, 0.4 + rnd() * (H - 0.8), D * 0.28, 0.2 + rnd() * 0.4, 0.15 + rnd() * 0.5, 0.008, U.pick(rnd, [0x5a4a3a, 0x6a5a3a, 0x3a3630]));      // óxido y manchas
        break;
      }
      case 'colchon': {
        // colchón tirado en el suelo, con manchas, y una manta arrugada
        box(0, 0.06, 0, W, 0.12, D, U.pick(rnd, [0xb8ae96, 0xa89e86, 0xc0b8a0]));
        for (let k = 0; k < 4; k++) box((rnd() - 0.5) * W * 0.6, 0.125, (rnd() - 0.5) * D * 0.7, 0.15 + rnd() * 0.25, 0.004, 0.15 + rnd() * 0.3, U.pick(rnd, [0x8a7a5a, 0x7a6a4a, 0x6a5a40]));
        box(0.05, 0.14, D * 0.15, W * 0.9, 0.05, D * 0.45, U.pick(rnd, [0x5a5a6a, 0x6a4a3a, 0x4a5a4a]));
        break;
      }
      case 'poste_cadena': {
        // poste de acero atornillado al suelo con una argolla (de él sale la cadena del chasqueador)
        box(0, 0.02, 0, 0.42, 0.04, 0.42, 0x3a3a3a);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * 0.16, 0.05, sz * 0.16, 0.025, 0.04, 0x8a8a84, 6);
        box(0, H / 2, 0, 0.12, H, 0.12, 0x4a4a48);
        cyl(0, H - 0.12, 0.09, 0.06, 0.02, 0x7a7a74, 10);
        for (let k = 0; k < 6; k++) box((rnd() - 0.5) * 0.5, 0.01, (rnd() - 0.5) * 0.5, 0.06, 0.004, 0.04, 0x3a2a20);        // manchas
        break;
      }
      case 'estatua': {
        // el prócer de la plaza: pedestal de piedra con la placa y, encima, la figura de bronce (sin cabeza: se la
        // llevaron), con la mano en alto; verde de óxido y pintada con espray
        const st0 = 0x9a948a, br = 0x4e6a5a;
        box(0, 0.5, 0, W, 1.0, D, st0); box(0, 1.05, 0, W * 0.86, 0.1, D * 0.86, U.shade(st0, 1.1));
        box(0, 0.6, D / 2 + 0.01, W * 0.5, 0.3, 0.02, 0x6a5a3a);
        const y0b = 1.1;
        box(0, y0b + 0.42, 0, 0.42, 0.84, 0.3, br);                                                  // piernas (con la levita)
        box(0, y0b + 1.18, 0, 0.5, 0.7, 0.32, U.shade(br, 1.05));                                     // torso
        box(0.32, y0b + 1.62, 0, 0.14, 0.62, 0.14, br);                                               // el brazo en alto
        box(-0.3, y0b + 1.12, 0.04, 0.13, 0.55, 0.13, br);
        box(0, y0b + 1.6, 0, 0.16, 0.14, 0.16, U.shade(br, 0.8));                                     // el cuello cortado
        for (let k = 0; k < 6; k++) box((rnd() - 0.5) * 0.4, y0b + 0.2 + rnd() * 1.4, 0.17, 0.08 + rnd() * 0.12, 0.05 + rnd() * 0.1, 0.004, 0x7a9a7a);   // verdín
        break;
      }
      case 'cartel_madera': {
        // tablón de contrachapado clavado a dos postes (lo escrito encima lo pone el mapa)
        const wd = 0x6a5440;
        for (const sx of [-1, 1]) box(sx * (W / 2 - 0.12), H / 2, -0.05, 0.1, H, 0.1, wd);
        box(0, H - 0.75, 0, W, 1.2, 0.04, f.col || 0xb49a74);
        for (const sx of [-1, 1]) for (const y of [H - 0.3, H - 1.2]) box(sx * (W / 2 - 0.12), y, 0.025, 0.03, 0.03, 0.01, 0x2a2a2a);
        break;
      }
    }
  }

  // ---------- Barrio: la calle, la gasolinera y la plaza (diseños propios) ----------
  function drawStreet(f, m, box, cyl, W, D, H, rnd, cx, cz, y0, cs, sn, ry) {
    const P = (lx, ly, lz) => [cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs];
    const sph = (lx, ly, lz, rx, r2, rz, hex) => { const p = P(lx, ly, lz); m.sphere(p[0], p[1], p[2], rx, r2, rz, hex, 1); };
    switch (f.type) {
      case 'marquesina': {
        // techo de la gasolinera: losa blanca con franja roja y luces apagadas (los pilares son postes aparte)
        box(0, H, 0, W, 0.5, D, 0xe8e4dc);
        for (const e of [-1, 1]) { box(0, H + 0.05, e * (D / 2 + 0.01), W, 0.36, 0.03, 0xb8302a); box(e * (W / 2 + 0.01), H + 0.05, 0, 0.03, 0.36, D, 0xb8302a); }
        for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) box(-W / 3 + i * W / 3, H - 0.27, -D / 4 + k * D / 2, 1.2, 0.04, 0.3, 0xc8c8c0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.6), H / 2, sz * (D / 2 - 0.6), 0.35, H, 0.35, 0xd8d4cc);
        box(0, 0.08, 0, W * 0.5, 0.16, 1.0, 0x9a968c);               // isleta de los surtidores
        break;
      }
      case 'surtidor': {
        box(0, 0.75, 0, W * 0.9, 1.5, D, 0xd8d4cc);
        box(0, 1.6, 0, W, 0.2, D * 1.05, 0xb8302a);
        for (const e of [-1, 1]) { box(0, 1.05, e * (D / 2 + 0.005), W * 0.6, 0.35, 0.01, 0x2a3a2a); box(W * 0.3, 0.6, e * (D / 2 + 0.06), 0.1, 0.3, 0.1, 0x1a1a1a); }
        box(-W * 0.48, 0.9, 0, 0.04, 0.6, 0.04, 0x1a1a1a);
        break;
      }
      case 'cartel_precios': {
        box(0, H / 2 - 0.6, 0, 0.25, H - 1.2, 0.25, 0x8a8a8a);
        box(0, H - 0.75, 0, W, 1.5, 0.22, 0xe8e4dc);
        box(0, H - 0.25, 0.115, W - 0.1, 0.4, 0.01, 0xb8302a);
        for (let k = 0; k < 3; k++) box(0, H - 0.65 - k * 0.3, 0.115, W - 0.3, 0.2, 0.01, 0x1a1a1a);
        break;
      }
      case 'neumaticos': {
        for (let k = 0; k < 4; k++) cyl((rnd() - 0.5) * 0.08, 0.12 + k * 0.24, (rnd() - 0.5) * 0.08, 0.4, 0.22, 0x1e1e1e, 12);
        break;
      }
      case 'fuente': {
        // fuente de piedra seca: pila octogonal, columna con dos platos y musgo
        // (el borde: ocho tramos girados que cierran el octógono; antes eran cajas sin girar que se cruzaban)
        for (let k = 0; k < 8; k++) {
          const a = (k + 0.5) / 8 * Math.PI * 2, R0 = W * 0.42, p = P(Math.sin(a) * R0, 0.3, Math.cos(a) * R0);
          m.box(p[0], p[1], p[2], 2 * (R0 + 0.1) * Math.tan(Math.PI / 8) + 0.03, 0.6, 0.2, 0xb8b2a4, ry + a);
          const q = P(Math.sin(a) * (R0 + 0.02), 0.62, Math.cos(a) * (R0 + 0.02));
          m.box(q[0], q[1], q[2], 2 * (R0 + 0.14) * Math.tan(Math.PI / 8) + 0.05, 0.06, 0.3, 0xc4beb0, ry + a);       // la albardilla
        }
        cyl(0, 0.1, 0, W * 0.44, 0.2, 0x8a867c, 8);
        cyl(0, 0.3, 0, W * 0.41, 0.04, 0x4e5e48, 8);                // agua estancada
        cyl(0, 0.9, 0, 0.22, 1.4, 0xb8b2a4, 10);
        cyl(0, 1.05, 0, 0.75, 0.12, 0xb0aa9c, 12);
        cyl(0, 1.5, 0, 0.4, 0.1, 0xb0aa9c, 10);
        sph(0, 1.62, 0, 0.12, 0.12, 0.12, 0xb0aa9c);
        for (let k = 0; k < 6; k++) box((rnd() - 0.5) * W * 0.8, 0.62, (rnd() - 0.5) * W * 0.8, 0.3, 0.02, 0.2, 0x5a7a3a);
        break;
      }
      case 'columpio': {
        // columpios: estructura en A por los lados, travesaño y dos asientos colgados (uno roto)
        const col = 0x3a6a9a;
        // (las patas se abren hacia abajo, en A: arriba se juntan en el travesaño; antes estaban al revés, en V)
        for (const e of [-1, 1]) for (const s2 of [-1, 1]) { const p = P(e * W / 2, H / 2, s2 * D * 0.25); m.box(p[0], p[1], p[2], 0.08, H * 1.04, 0.08, col, ry, undefined, -s2 * 0.4 * cs, s2 * 0.4 * sn); }
        box(0, H, 0, W, 0.1, 0.1, col);
        for (const lx of [-W * 0.22, W * 0.22]) { for (const e of [-0.2, 0.2]) box(lx + e, H / 2 + 0.25, 0, 0.02, H - 0.6, 0.02, 0x8a8a8a); }
        box(-W * 0.22, 0.55, 0, 0.5, 0.05, 0.22, 0x2a2a2a);
        const p2 = P(W * 0.22, 0.7, 0); m.box(p2[0], p2[1], p2[2], 0.5, 0.05, 0.22, 0x2a2a2a, ry, undefined, 0, 0.9);
        break;
      }
      case 'tobogan': {
        // tobogán: escalera atrás, plataforma y la rampa amarilla
        box(0, 1.5, -D / 2 + 0.4, W, 0.08, 0.8, 0xc23a2a);
        for (const e of [-1, 1]) for (const z2 of [-D / 2 + 0.05, -D / 2 + 0.75]) box(e * (W / 2 - 0.05), 0.75, z2, 0.07, 1.5, 0.07, 0x3a6a9a);
        for (let k = 0; k < 5; k++) box(0, 0.25 + k * 0.28, -D / 2 + 0.05, W - 0.1, 0.04, 0.05, 0x3a6a9a);
        for (const e of [-1, 1]) box(e * (W / 2 - 0.05), 1.95, -D / 2 + 0.4, 0.05, 0.9, 0.8, 0x3a6a9a);
        const p = P(0, 0.8, 0.45); m.box(p[0], p[1], p[2], W * 0.7, 0.06, 2.6, 0xe0b830, ry, undefined, 0.58 * cs, -0.58 * sn);
        break;
      }
      case 'seto': {
        // seto recortado (algo crecido)
        const n = Math.max(1, Math.round(W / 1.2));
        for (let k = 0; k < n; k++) box(-W / 2 + (k + 0.5) * W / n, H / 2, 0, W / n + 0.1, H * (0.92 + rnd() * 0.14), D * (0.9 + rnd() * 0.15), U.pick(rnd, [0x3e5a2e, 0x46642f, 0x3a5228]));
        break;
      }
      case 'buzon': box(0, 0.5, 0, 0.08, 1.0, 0.08, 0x5a4a36); box(0, 1.05, 0, 0.3, 0.24, 0.45, U.pick(rnd, [0x2a3a5a, 0x5a2a2a, 0x3a3a3a])); box(0.16, 1.12, -0.1, 0.02, 0.12, 0.08, 0xc23a2a); break;
      case 'semaforo': {
        box(0, H / 2, 0, 0.14, H, 0.14, 0x2a2e2a);
        box(0, H - 0.5, 0.12, 0.32, 0.9, 0.2, 0x1e221e);
        [0x5a1a1a, 0x5a4a1a, 0x1a4a2a].forEach((c, k) => { box(0, H - 0.2 - k * 0.28, 0.225, 0.17, 0.17, 0.02, c); box(0, H - 0.1 - k * 0.28, 0.27, 0.2, 0.03, 0.1, 0x1e221e); });
        break;
      }
      case 'senal': box(0, H / 2, 0, 0.07, H, 0.07, 0x8a8a8a); box(0, H - 0.2, 0.05, 0.6, 0.6, 0.03, 0xb8302a); box(0, H - 0.2, 0.07, 0.4, 0.1, 0.01, 0xf0eee8); break;
      case 'hidrante': cyl(0, 0.3, 0, 0.14, 0.6, 0xc23a2a, 10); sph(0, 0.62, 0, 0.15, 0.1, 0.15, 0xc23a2a); for (const e of [-1, 1]) box(e * 0.17, 0.4, 0, 0.12, 0.1, 0.1, 0xd8b82a); break;
      case 'paso_cebra': {
        // franjas blancas desgastadas sobre el asfalto
        const n = Math.max(3, Math.round(W / 0.8));
        for (let k = 0; k < n; k++) if (rnd() > 0.08) box(-W / 2 + (k + 0.5) * W / n, 0.006, 0, W / n * 0.5, 0.008, D * (0.85 + rnd() * 0.1), 0xd8d6cc);
        break;
      }
      case 'parada': {
        // marquesina de autobús: techo, cristales (uno roto), banco y el cartel con la línea
        box(0, H, 0, W, 0.08, D, 0x5a6268);
        for (const e of [-1, 1]) box(e * (W / 2 - 0.05), H / 2, -D / 2 + 0.05, 0.08, H, 0.08, 0x5a6268);
        box(0, H * 0.55, -D / 2 + 0.05, W - 0.2, H * 0.75, 0.03, 0x9ab0b8);
        box(-W / 2 + 0.05, H * 0.55, 0, 0.03, H * 0.75, D - 0.2, 0x9ab0b8);
        box(0, 0.45, -D / 2 + 0.35, W * 0.7, 0.06, 0.35, 0x8a6440);
        box(W / 2 - 0.2, H - 0.4, D / 2 - 0.1, 0.4, 0.4, 0.04, 0x2a5a8a);
        break;
      }
      case 'papelera': cyl(0, 0.42, 0, 0.2, 0.84, 0x3a4a3a, 10); cyl(0, 0.86, 0, 0.21, 0.04, 0x2a2a2a, 10); break;
      case 'kiosco': {
        // quiosco de prensa cerrado: caseta verde con persiana, tejadillo y revistas viejas
        box(0, H / 2 - 0.2, 0, W, H - 0.4, D, 0x3a6a4a);
        box(0, H - 0.15, 0, W + 0.4, 0.3, D + 0.4, 0x2a4a34);
        box(0, 1.3, D / 2 + 0.01, W - 0.3, 1.2, 0.02, 0x8a8a84);
        for (let k = 0; k < 6; k++) box(0, 0.8 + k * 0.2, D / 2 + 0.025, W - 0.35, 0.02, 0.01, 0x6a6a64);
        box(0, H - 0.5, D / 2 + 0.03, W * 0.8, 0.3, 0.02, 0xd8c890);
        break;
      }
    }
  }

  // ---------- Asentamiento en la playa (diseños propios) ----------
  function drawCamp(f, m, box, cyl, W, D, H, rnd, cx, cz, y0, cs, sn, ry, wood, fabric) {
    // de local (lx a lo ancho, lz hacia delante) a mundo
    const P = (lx, ly, lz) => [cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs];
    const sph = (lx, ly, lz, rx, ryy, rz, hex) => { const p = P(lx, ly, lz); m.sphere(p[0], p[1], p[2], rx, ryy, rz, hex, 1); };
    // un triángulo por las dos caras
    const tri2 = (a, b, c, hex) => { m.tri(a, b, c, hex); m.tri(a, c, b, hex); };
    switch (f.type) {
      case 'palmera': {
        // tronco anillado que se inclina y se curva; arriba, hojas largas que cuelgan (alguna seca) y cocos
        const la = rnd() * Math.PI * 2, lean = 0.12 + rnd() * 0.16, n = 12, segH = (H - 0.6) / n;
        let x = 0, z = 0, y = 0;
        const lx0 = Math.sin(la), lz0 = Math.cos(la);
        for (let i = 0; i < n; i++) {
          const k = i / n, r = 0.2 - k * 0.07;
          const dx = lx0 * lean * (0.4 + k * 1.6) * segH, dz = lz0 * lean * (0.4 + k * 1.6) * segH;
          const p = P(x + dx / 2, y + segH / 2, z + dz / 2);
          const tilt = Math.atan2(Math.hypot(dx, dz), segH);
          m.cyl(p[0], p[1], p[2], r, r * 0.94, segH * 1.06, i % 2 ? 0x8a7454 : 0x77644a, 7, undefined, tilt * (lz0 * cs - lx0 * sn), 0, -tilt * (lx0 * cs + lz0 * sn));
          x += dx; z += dz; y += segH;
        }
        const top = P(x, y, z);
        m.sphere(top[0], top[1], top[2], 0.26, 0.22, 0.26, 0x5e5236, 1);
        for (let c = 0; c < 3; c++) { const a = c * 2.1; m.sphere(top[0] + Math.sin(a) * 0.18, top[1] - 0.18, top[2] + Math.cos(a) * 0.18, 0.11, 0.12, 0.11, 0x4a3a24, 0); }
        const NF = 9;
        for (let k = 0; k < NF; k++) {
          const a = k / NF * Math.PI * 2 + rnd() * 0.4, dry = rnd() < 0.2;
          const col = dry ? 0x9a8452 : (rnd() < 0.5 ? 0x5c7436 : 0x6c7f3e);
          const L = 2.4 + rnd() * 0.8, ux = Math.sin(a), uz = Math.cos(a), px = -uz, pz = ux;
          const pts = [];
          for (let i = 0; i <= 6; i++) {
            const t = i / 6, d = t * L, h = 0.35 * Math.sin(t * Math.PI * 0.9) - t * t * (dry ? 1.6 : 1.05);
            pts.push([top[0] + ux * d, top[1] + h, top[2] + uz * d, 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08))]);
          }
          for (let i = 0; i < 6; i++) {
            const A = pts[i], B = pts[i + 1];
            const a1 = [A[0] + px * A[3], A[1], A[2] + pz * A[3]], a2 = [A[0] - px * A[3], A[1], A[2] - pz * A[3]];
            const b1 = [B[0] + px * B[3], B[1] - 0.04, B[2] + pz * B[3]], b2 = [B[0] - px * B[3], B[1] - 0.04, B[2] - pz * B[3]];
            const ctr = [A[0], A[1] + 0.03, A[2]], ctrB = [B[0], B[1] + 0.03, B[2]];
            tri2(a1, ctr, b1, col); tri2(ctr, ctrB, b1, col); tri2(ctr, a2, b2, U.shade(col, 0.88)); tri2(ctr, b2, ctrB, U.shade(col, 0.88));
          }
        }
        break;
      }
      case 'bote': {
        // bote de remos varado: madera pintada de verde agua descascarado, dos bancos y un remo encima
        const green = 0x5d7a74, gd = 0x3b4a46, inner = 0x5a4632;
        box(0, 0.14, 0, W * 0.78, 0.12, D * 0.5, gd);
        for (const s2 of [-1, 1]) {
          const p = P(0, 0.4, s2 * D * 0.38);
          m.box(p[0], p[1], p[2], W * 0.86, 0.5, 0.07, green, ry, undefined, s2 * 0.32 * cs, -s2 * 0.32 * sn);
          box(0, 0.67, s2 * D * 0.45, W * 0.84, 0.06, 0.1, 0x7b6650);             // regala
          for (let k = 0; k < 7; k++) box((rnd() - 0.5) * W * 0.7, 0.3 + rnd() * 0.25, s2 * (D * 0.44 + 0.012), 0.15 + rnd() * 0.3, 0.05 + rnd() * 0.08, 0.01, rnd() < 0.6 ? 0x8a6a44 : 0x9ab2aa);
        }
        // proa (punta) y popa
        for (const e of [-1, 1]) {
          box(e * W * 0.43, 0.42, 0, 0.2, 0.55, D * (e > 0 ? 0.35 : 0.75), green);
          box(e * W * 0.46, 0.66, 0, 0.14, 0.07, D * (e > 0 ? 0.3 : 0.7), 0x7b6650);
        }
        box(0, 0.22, 0, W * 0.72, 0.04, D * 0.62, inner);
        box(-W * 0.12, 0.48, 0, 0.26, 0.05, D * 0.8, 0x806a52);
        box(W * 0.2, 0.48, 0, 0.26, 0.05, D * 0.8, 0x806a52);
        const o1 = P(-W * 0.05, 0.55, 0.1);
        m.box(o1[0], o1[1], o1[2], W * 0.9, 0.05, 0.05, 0x6a5642, ry + 0.25);
        const o2 = P(W * 0.32, 0.55, 0.15);
        m.box(o2[0], o2[1], o2[2], 0.35, 0.03, 0.14, 0x6a5642, ry + 0.25);
        break;
      }
      case 'balsa': {
        // balsa hecha a mano: troncos atados sobre bidones azules, un mástil con la vela recogida y cuerdas
        for (let k = 0; k < 7; k++) {
          const z = -D / 2 + 0.17 + k * (D - 0.34) / 6, p = P(0, 0.42, z);
          m.cyl(p[0], p[1], p[2], 0.16, 0.16, W * (0.92 + rnd() * 0.08), U.shade(0x7a5e40, 0.85 + rnd() * 0.3), 8, undefined, 0, ry, Math.PI / 2);
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sx * W * 0.3, 0.18, sz * D * 0.3, 0.2, 0.36, sz > 0 ? 0x2e5f8a : 0x3a6a92, 10);
        for (const sx of [-0.38, 0, 0.38]) box(sx * W, 0.6, 0, 0.05, 0.05, D * 1.02, 0xb8a27a);
        cyl(0.2, 1.6, 0, 0.06, 2.2, 0x6a5038, 6);
        box(0.2, 1.2, 0.1, 0.18, 1.2, 0.18, 0xd8d0b8);
        box(-0.6, 0.65, -0.4, 0.5, 0.25, 0.4, 0x6a6a44);                          // un saco con provisiones
        break;
      }
      case 'roca': {
        // rocas de la playa: bloques grises y pardos, redondeados
        const n = 4 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) sph((rnd() - 0.5) * W * 0.6, H * (0.25 + rnd() * 0.25), (rnd() - 0.5) * D * 0.6, W * (0.22 + rnd() * 0.16), H * (0.3 + rnd() * 0.3), D * (0.22 + rnd() * 0.16), U.pick(rnd, [0x6e6a62, 0x7d766a, 0x5f5a52, 0x8a8070]));
        break;
      }
      case 'pena': {
        // afloramiento de roca de la montaña: bloques angulosos inclinados, hundidos en la ladera (por eso
        // empiezan bajo el suelo), con vetas más claras y matas de hierba seca en las grietas
        const cols = [0x7a7268, 0x6a6258, 0x857b6e, 0x5e574e, 0x8e8476];
        const n = 5 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const lx = (rnd() - 0.5) * W * 0.55, lz = (rnd() - 0.5) * D * 0.55;
          const w = W * (k === 0 ? 0.6 : 0.3 + rnd() * 0.3), d = D * (k === 0 ? 0.6 : 0.3 + rnd() * 0.3), h = H * (k === 0 ? 1 : 0.35 + rnd() * 0.45);
          const col = U.pick(rnd, cols), rx = (rnd() - 0.5) * 0.4, rz = (rnd() - 0.5) * 0.4, a = ry + (rnd() - 0.5) * 1.2;
          const p = P(lx, (h - 1.2) / 2, lz);
          m.box(p[0], p[1], p[2], w, h + 1.2, d, col, a, undefined, rx, rz);
          const q = P(lx, h - 0.35 - rnd() * 0.4, lz);
          m.box(q[0], q[1], q[2], w * 1.02, 0.08, d * 1.02, U.shade(col, 1.18), a, undefined, rx, rz);        // veta
        }
        // piedras sueltas al pie y matas de hierba seca
        for (let k = 0; k < 4; k++) sph((rnd() - 0.5) * W * 1.1, 0.05, (rnd() - 0.5) * D * 1.1, W * 0.14, H * 0.16, D * 0.14, U.pick(rnd, cols));
        for (let k = 0; k < 3; k++) sph((rnd() - 0.5) * W * 0.9, 0.1, (rnd() - 0.5) * D * 0.9, 0.35, 0.3, 0.35, U.pick(rnd, [0x8a7a3a, 0x9a7a42, 0x6e6a34]));
        break;
      }
      case 'pilar': {
        // pilar de ladrillo de la entrada, con zócalo y remate de piedra y un farol apagado
        box(0, 0.2, 0, W + 0.1, 0.4, D + 0.1, 0x9a948a);
        box(0, H / 2, 0, W, H - 0.2, D, 0x8a5240);
        for (let y = 0.6; y < H - 0.3; y += 0.5) box(0, y, 0, W + 0.02, 0.03, D + 0.02, 0xa89a88);
        box(0, H - 0.05, 0, W + 0.16, 0.2, D + 0.16, 0xb0a898);
        sph(0, H + 0.25, 0, 0.18, 0.24, 0.18, 0x3a3a34);
        break;
      }
      case 'arco': {
        // arco de hierro sobre la entrada: el cartel del museo (le faltan letras) y, colgada, una lona con el
        // escorpión pintado a mano y una palabra: «PLAYA» (por dónde se entra ahora)
        box(0, H - 0.2, 0, W, 0.16, 0.14, 0x2e2e2c);
        box(0, H - 1.1, 0, W - 0.9, 0.08, 0.1, 0x2e2e2c);
        for (let k = 0; k < 9; k++) { const x = -W / 2 + 0.45 + k * (W - 0.9) / 8; box(x, H - 0.65, 0, 0.05, 0.9, 0.05, 0x3a3a36); }
        box(0, H - 0.65, 0.06, W * 0.62, 0.6, 0.05, 0x2e4a5a);
        for (let k = 0; k < 12; k++) if (rnd() > 0.2) box(-W * 0.27 + k * W * 0.049, H - 0.65, 0.09, 0.2, 0.3, 0.02, 0xd8cfb4);
        box(0.6, H - 2.0, 0.1, 2.2, 1.6, 0.03, 0xc8bca0);
        box(0.6, H - 2.0, 0.12, 0.9, 0.5, 0.02, 0x2a2a26);
        for (const e of [-1, 1]) box(0.6 + e * 0.6, H - 1.75, 0.12, 0.4, 0.06, 0.02, 0x2a2a26);
        box(0.6, H - 2.55, 0.12, 1.4, 0.14, 0.02, 0x8a2a22);
        break;
      }
      case 'sacos': {
        // muro de sacos terreros, en hileras trabadas (old: abandonado hace meses, con huecos y sacos reventados)
        const n = Math.max(2, Math.round(W / 0.6)), lw = W / n;
        for (let r = 0; r < 3; r++) {
          const off = r % 2 ? lw / 2 : 0, cnt = r % 2 ? n - 1 : n;
          for (let k = 0; k < cnt; k++) {
            const lx = -W / 2 + lw / 2 + off + k * lw;
            if (f.old && rnd() < 0.12 + r * 0.22) { if (r === 0 || rnd() < 0.5) continue; sph(lx, 0.05, D * 0.7 * (rnd() < 0.5 ? 1 : -1), lw * 0.6, 0.06, D * 0.5, 0x9a8a6a); continue; }
            sph(lx, 0.14 + r * 0.26, (rnd() - 0.5) * 0.04, lw * 0.52, 0.14, D * 0.48, U.pick(rnd, [0xa8987a, 0x9c8c6c, 0xb4a484, 0x8e8062]));
          }
        }
        break;
      }
      case 'saco_dormir': {
        // saco de dormir abierto con una almohada y una manta; alguna cosa al lado (alguien durmió aquí anoche)
        const col = U.pick(rnd, [0x3e5a7a, 0x7a3e34, 0x4e6a3e, 0x6a5a3a]);
        box(0, 0.05, 0.05, W * 0.9, 0.1, D * 0.86, col);
        box(0, 0.11, D * 0.08, W * 0.82, 0.04, D * 0.5, U.shade(col, 1.25));
        box(0, 0.12, -D / 2 + 0.22, W * 0.6, 0.1, 0.28, 0xd8d0be);
        if (rnd() < 0.7) cyl(W / 2 + 0.15, 0.09, -D * 0.2, 0.05, 0.18, 0x8a8a7a, 8);          // cantimplora
        if (rnd() < 0.5) box(W / 2 + 0.18, 0.02, D * 0.15, 0.16, 0.03, 0.22, 0x7a2a22);         // un libro
        break;
      }
      case 'tienda': {
        // tienda canadiense: dos lonas inclinadas, la entrada abierta, vientos y piquetas (old: se vino abajo:
        // la lona caída sobre los palos, rota)
        const col = U.pick(rnd, [0x5f6a3e, 0x8a5a2e, 0x4a5a6a, 0x6a6a5a]);
        if (f.old) {
          const c2 = U.shade(col, 1.15);
          tri2(P(-W / 2, 0.03, -D / 2), P(W / 2, 0.03, -D / 2), P(0.1, 0.55, 0.2), c2);
          tri2(P(-W / 2, 0.03, -D / 2), P(0.1, 0.55, 0.2), P(-W / 2 + 0.2, 0.03, D / 2), U.shade(c2, 0.9));
          tri2(P(W / 2, 0.03, -D / 2), P(W / 2 - 0.3, 0.03, D / 2 - 0.4), P(0.1, 0.55, 0.2), U.shade(c2, 0.8));
          const p = P(0.1, 0.3, 0.2); m.box(p[0], p[1], p[2], 0.04, 0.6, 0.04, 0x5a4a36, ry);
          box(0.3, 0.02, D / 2 - 0.2, 1.1, 0.03, 0.04, 0x5a4a36);
          break;
        }
        const hw = W / 2, hh = H;
        for (const s2 of [-1, 1]) {
          const a = [cx, y0 + hh, cz], dzv = D / 2;
          const e1 = P(s2 * hw, 0.02, -dzv), e2 = P(s2 * hw, 0.02, dzv), t1 = P(0, hh, -dzv), t2 = P(0, hh, dzv);
          tri2(t1, e1, e2, s2 > 0 ? col : U.shade(col, 0.85)); tri2(t1, e2, t2, s2 > 0 ? col : U.shade(col, 0.85));
        }
        // trasera cerrada; delante, la entrada con una solapa recogida
        tri2(P(0, hh, -D / 2), P(-hw, 0.02, -D / 2), P(hw, 0.02, -D / 2), U.shade(col, 0.75));
        tri2(P(0, hh, D / 2), P(-hw, 0.02, D / 2), P(-hw * 0.45, 0.02, D / 2), U.shade(col, 0.8));
        box(0, hh / 2, D / 2 + 0.02, 0.04, hh, 0.04, 0x5a4a36);
        box(0, hh / 2, -D / 2 - 0.02, 0.04, hh, 0.04, 0x5a4a36);
        box(0, 0.015, 0, W * 0.9, 0.02, D * 0.96, 0x3a3a32);                      // suelo
        for (const e of [-1, 1]) box(0, 0.4, e * (D / 2 + 0.55), 0.015, 0.015, 1.3, 0xc8c0a8);
        break;
      }
      case 'tendedero': {
        // cuerda entre dos palos con ropa tendida (recién lavada; old: trapos desteñidos que nadie recogió)
        for (const e of [-1, 1]) box(e * W / 2, H / 2, 0, 0.07, H, 0.07, 0x6a5038);
        box(0, H - 0.1, 0, W, 0.012, 0.012, 0xd8d0b8);
        if (f.old) {
          for (let k = 0; k < 3; k++) { if (rnd() < 0.3) continue; const lx = -W / 2 + 0.5 + k * (W - 1) / 2, h = 0.3 + rnd() * 0.3; box(lx, H - 0.12 - h / 2, 0, 0.25 + rnd() * 0.2, h, 0.02, U.pick(rnd, [0xb4ac9c, 0x8a9098, 0xa08a7a])); }
          box(W * 0.2, 0.02, 0.4, 0.4, 0.02, 0.3, 0x8a8478);              // uno se cayó
          break;
        }
        const n = 5;
        for (let k = 0; k < n; k++) {
          const lx = -W / 2 + 0.35 + k * (W - 0.7) / (n - 1), w = 0.35 + rnd() * 0.25, h = 0.45 + rnd() * 0.35;
          box(lx, H - 0.12 - h / 2, (rnd() - 0.5) * 0.02, w, h, 0.02, U.pick(rnd, [0xc8c0b0, 0x5a6a7a, 0x8a3a32, 0x6a7a4a, 0xd8c890, 0x3a3a3a]));
        }
        break;
      }
      case 'mesa_campo': {
        // mesa plegable con platos a medio comer, tazas, una olla, un farol y unas cartas: acaban de irse
        // (old: hace meses: polvo, una taza volcada, el farol apagado y hojas secas encima)
        legs(W, D, H, 0.03, 0x5a5a5a);
        box(0, H, 0, W, 0.04, D, 0x8a7a5a);
        if (f.old) {
          box(0, H + 0.022, 0, W - 0.1, 0.004, D - 0.1, 0x9a8c70);
          const p = P(-0.3, H + 0.06, 0.1); m.box(p[0], p[1], p[2], 0.07, 0.07, 0.11, 0xc8c4b8, ry + 0.7);
          box(W / 2 - 0.2, H + 0.1, -0.15, 0.1, 0.16, 0.1, 0x6a6a5a); box(W / 2 - 0.2, H + 0.19, -0.15, 0.12, 0.03, 0.12, 0x2a2a2a);
          for (let k = 0; k < 6; k++) box((rnd() - 0.5) * W * 0.8, H + 0.026, (rnd() - 0.5) * D * 0.7, 0.08, 0.004, 0.05, U.pick(rnd, [0x8a6a3a, 0x9a7a3a, 0x6a5a32]));
          break;
        }
        for (let k = 0; k < 3; k++) {
          const lx = -W / 2 + 0.35 + k * 0.6, lz = (k % 2 ? 0.18 : -0.18);
          cyl(lx, H + 0.03, lz, 0.12, 0.015, 0xd8d4c8, 12);
          box(lx, H + 0.05, lz, 0.12, 0.03, 0.08, U.pick(rnd, [0x8a5a2a, 0xa88a4a, 0x6a3a22]));
          cyl(lx + 0.2, H + 0.07, lz + 0.05, 0.04, 0.1, U.pick(rnd, [0xc8c4b8, 0x5a6a7a, 0x8a3a32]), 8);
        }
        cyl(W / 2 - 0.25, H + 0.12, 0, 0.13, 0.2, 0x3a3a3a, 10);              // olla
        box(-W / 2 + 0.15, H + 0.12, 0.25, 0.1, 0.2, 0.1, 0xf0d070);            // farol encendido
        box(-W / 2 + 0.15, H + 0.24, 0.25, 0.12, 0.03, 0.12, 0x2a2a2a);
        for (let k = 0; k < 5; k++) box((rnd() - 0.3) * 0.4, H + 0.025, 0.05 + rnd() * 0.15, 0.06, 0.004, 0.09, k % 2 ? 0xe8e4d8 : 0xc23a2a);
        break;
      }
      case 'armero': {
        // armero de tablones con rifles y escopetas apoyados, y cajas de munición
        box(0, 0.08, 0, W, 0.16, D, U.shade(wood, 0.8));
        box(0, H - 0.1, -D / 2 + 0.06, W, 0.08, 0.1, wood);
        for (const e of [-1, 1]) box(e * (W / 2 - 0.05), H / 2, -D / 2 + 0.06, 0.08, H, 0.1, wood);
        for (let k = 0; k < 4; k++) {
          const lx = -W / 2 + 0.3 + k * (W - 0.6) / 3;
          const p = P(lx, H * 0.48, -0.02);
          m.box(p[0], p[1], p[2], 0.07, H * 0.85, 0.05, k % 2 ? 0x2a2622 : 0x3a2e24, ry, undefined, -0.12 * cs, 0.12 * sn);
          box(lx, H * 0.2, 0.02, 0.09, 0.32, 0.06, 0x5a3a24);
        }
        box(-W * 0.28, 0.28, D * 0.15, 0.4, 0.22, 0.25, 0x4a5a3a); box(W * 0.25, 0.28, D * 0.15, 0.4, 0.22, 0.25, 0x4a5a3a);
        break;
      }
      case 'barril_fuego': {
        // bidón oxidado con agujeros: se quema leña dentro (la llama y la luz las pone el mapa)
        cyl(0, H / 2, 0, W * 0.45, H, 0x6a4a32, 12);
        for (let k = 0; k < 6; k++) { const a = k * 1.05; box(Math.sin(a) * W * 0.46, H * 0.3, Math.cos(a) * W * 0.46, 0.08, 0.08, 0.02, 0xd8701a); }
        cyl(0, H - 0.02, 0, W * 0.4, 0.06, 0x2a1a12, 12);
        for (let k = 0; k < 4; k++) box((rnd() - 0.5) * 0.3, H + 0.05, (rnd() - 0.5) * 0.3, 0.06, 0.06, 0.4, 0x3a2a1c);
        break;
      }
      case 'fogata_viva': {
        // hoguera encendida hace nada: piedras, troncos nuevos, un trípode con la olla y troncos para sentarse
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; sph(Math.sin(a) * 0.5, 0.08, Math.cos(a) * 0.5, 0.13, 0.1, 0.12, U.pick(rnd, [0x6a665e, 0x5a564e, 0x7a7468])); }
        for (let k = 0; k < 4; k++) { const p = P(0, 0.14, 0); m.box(p[0], p[1], p[2], 0.7, 0.09, 0.09, 0x4a3420, ry + k * 0.8, undefined, 0, 0.3); }
        box(0, 0.03, 0, 0.7, 0.02, 0.7, 0x2a2420);
        for (let k = 0; k < 3; k++) { const a = k * 2.09; const p = P(Math.sin(a) * 0.45, 0.5, Math.cos(a) * 0.45); m.box(p[0], p[1], p[2], 0.04, 1.0, 0.04, 0x5a4a36, 0, undefined, Math.cos(a) * 0.4, -Math.sin(a) * 0.4); }
        box(0, 0.85, 0, 0.02, 0.25, 0.02, 0x2a2a2a);
        cyl(0, 0.62, 0, 0.17, 0.22, 0x2e2e2e, 10);
        break;
      }
      case 'consola': {
        // la sala de vigilancia: mesa con monitores, radio con su micrófono, prismáticos, mapa y una taza
        box(0, 0.74, 0, W, 0.05, D, 0x5a5a56);
        legs(W, D, 0.72, 0.03, 0x3a3a3a);
        for (let k = 0; k < 3; k++) {
          const lx = -W / 2 + 0.4 + k * 0.6;
          box(lx, 1.02, -D / 2 + 0.2, 0.5, 0.36, 0.2, 0x1e1e1e);
          box(lx, 1.02, -D / 2 + 0.31, 0.42, 0.28, 0.01, k === 1 ? 0x2a5a3a : 0x3a4a5a);
        }
        box(W / 2 - 0.3, 0.86, 0.1, 0.4, 0.18, 0.28, 0x3a3e36);              // radio
        box(W / 2 - 0.36, 0.96, 0.24, 0.06, 0.02, 0.02, 0xc23a2a);
        cyl(W / 2 - 0.55, 0.84, 0.25, 0.03, 0.15, 0x1a1a1a, 6);              // micrófono
        box(-0.2, 0.78, 0.2, 0.6, 0.01, 0.4, 0xd8ccaa);                       // mapa
        box(0.2, 0.8, 0.25, 0.14, 0.06, 0.08, 0x1a1a1a);                      // prismáticos
        cyl(-0.65, 0.81, 0.25, 0.04, 0.09, 0xc8c4b8, 8);
        break;
      }
      case 'columna': {
        // columna de piedra del pórtico del museo
        box(0, 0.15, 0, W, 0.3, D, 0xb8ae9a);
        cyl(0, H / 2, 0, W * 0.38, H - 0.6, 0xd2c8b4, 14);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; box(Math.sin(a) * W * 0.37, H / 2, Math.cos(a) * W * 0.37, 0.04, H - 0.7, 0.04, 0xbcb29e); }
        box(0, H - 0.15, 0, W * 1.05, 0.3, D * 1.05, 0xb8ae9a);
        break;
      }
      case 'esqueleto': {
        // esqueleto de dinosaurio sobre su peana (la pieza estrella del museo)
        const bone = 0xd9cdb0, bd = 0xc2b494;
        box(0, 0.2, 0, W, 0.4, D, 0x8a8478);
        box(0, 0.42, D / 2 - 0.05, 1.2, 0.04, 0.02, 0xc9b27a);                // placa
        const yl = 0.4;
        for (const sx of [-0.9, 1.0]) for (const sz of [-0.35, 0.35]) { box(sx, yl + 0.75, sz, 0.13, 1.5, 0.13, bone); box(sx, yl + 1.5, sz * 0.6, 0.2, 0.2, 0.3, bd); box(sx + 0.1, yl + 0.06, sz, 0.3, 0.1, 0.16, bd); }
        const spine = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, lx = -W / 2 + 0.3 + t * (W - 0.6); const ly = yl + 1.3 + Math.sin(t * Math.PI) * 0.5 + (t > 0.78 ? (t - 0.78) * 4 : 0) - (t < 0.25 ? (0.25 - t) * 2.6 : 0); spine.push([lx, ly]); box(lx, ly, 0, 0.18, 0.18, 0.14, bone); box(lx, ly + 0.14, 0, 0.05, 0.16, 0.05, bd); }
        for (let i = 6; i <= 11; i++) { const [lx, ly] = spine[i]; for (const sz of [-1, 1]) { const p = P(lx, ly - 0.32, sz * 0.2); m.box(p[0], p[1], p[2], 0.05, 0.6, 0.05, bone, ry, undefined, sz * 0.35 * cs, -sz * 0.35 * sn); } }
        const [hx, hy] = spine[16];
        box(hx + 0.3, hy + 0.05, 0, 0.6, 0.32, 0.3, bone);                     // cráneo
        box(hx + 0.32, hy - 0.16, 0, 0.5, 0.08, 0.24, bd);                      // mandíbula
        for (let k = 0; k < 5; k++) box(hx + 0.12 + k * 0.1, hy - 0.08, 0.13, 0.02, 0.06, 0.02, 0xf0e8d0);
        for (const sz of [-0.2, 0.2]) box(spine[13][0], spine[13][1] - 0.35, sz, 0.08, 0.5, 0.06, bone);   // brazos cortos
        break;
      }
      case 'pedestal': {
        // pedestal con una pieza del museo: un busto, un ánfora o una piedra tallada
        box(0, 0.05, 0, W, 0.1, D, 0x8a8478);
        box(0, 0.55, 0, W * 0.78, 1.0, D * 0.78, 0xd8d0c0);
        box(0, 1.07, 0, W, 0.06, D, 0x8a8478);
        const k = Math.floor(rnd() * 3);
        if (k === 0) { sph(0, 1.32, 0, 0.14, 0.18, 0.15, 0xb8b0a0); box(0, 1.16, 0, 0.32, 0.12, 0.2, 0xb8b0a0); }
        else if (k === 1) { sph(0, 1.3, 0, 0.16, 0.2, 0.16, 0xa8603a); cyl(0, 1.52, 0, 0.06, 0.12, 0xa8603a, 8); }
        else box(0, 1.28, 0, 0.3, 0.38, 0.12, 0x7a7466);
        break;
      }
      case 'cuadro': {
        // cuadro colgado: marco dorado y un paisaje en manchas de color (va a 1,1 m del suelo)
        box(0, 1.7, 0, W, H, 0.05, 0x8a6a32);
        box(0, 1.7, 0.03, W - 0.16, H - 0.16, 0.01, U.pick(rnd, [0x6a8aa0, 0x8aa06a, 0xc8a070]));
        box(0, 1.5, 0.035, W - 0.16, H * 0.3, 0.01, U.pick(rnd, [0x4a6a3a, 0x6a5a3a, 0x3a4a5a]));
        box((rnd() - 0.5) * 0.4, 1.85, 0.036, 0.25, 0.2, 0.01, U.pick(rnd, [0xe8d070, 0xd88a5a, 0xe8e0d0]));
        break;
      }
      case 'banco_parque': {
        // banco de madera con patas de hierro
        for (const e of [-1, 1]) { box(e * (W / 2 - 0.15), 0.22, 0, 0.06, 0.44, D * 0.8, 0x2a2a2a); }
        for (let k = 0; k < 3; k++) box(0, 0.45, -D / 2 + 0.12 + k * 0.17, W, 0.04, 0.12, wood);
        for (let k = 0; k < 2; k++) box(0, 0.62 + k * 0.15, -D / 2 + 0.04, W, 0.1, 0.03, wood);
        break;
      }
    }
    function legs(w, d, h, r, hex) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 - r), h / 2, sz * (d / 2 - r), r * 2, h, r * 2, hex); }
  }

  // ---------- Salón recreativo (diseños propios) ----------
  // Las pantallas, los carteles de arriba y los neones brillan: eso lo pone G.Maps (decor), aquí van apagados
  const ARC_BODY = [0x241a3a, 0x182a3c, 0x3a1826, 0x171717, 0x2c2a14, 0x1c3326];
  const ARC_TRIM = [0xd8357f, 0x2fb4cf, 0xd9b52f, 0x7a46d6, 0x3fbf6a];
  const FUNGI = [0xc9a26a, 0xa47a48, 0xd8b88a, 0x8a5a3a, 0xb8865a];
  // la infección del entorno, con los colores del hongomorfo: bultos carne tostada, costras oscuras, carne viva,
  // fibras pálidas y la podredumbre negra de debajo
  const BLOAT = [0xc98a5e, 0xb87650, 0xd9a274, 0xa86a44, 0xbf8058, 0x9a5e3e], BDK = 0x5a3220, BRAW = 0x8a2a1c, BPALE = 0xe8c8a0, ROT = [0x1e1612, 0x2a1e16, 0x241a14, 0x34261a];
  function drawArcade(f, box, cyl, sph, W, D, H, rnd, X) {
    const body = f.col != null ? f.col : U.pick(rnd, ARC_BODY), trim = U.pick(rnd, ARC_TRIM), dk = U.shade(body, 0.7);
    // moho y hongos al pie (el local lleva años cerrado)
    const mold = (n, w, d) => { for (let k = 0; k < n; k++) { const s = 0.035 + rnd() * 0.05; sph((rnd() - 0.5) * w, s * 0.4, (rnd() - 0.5) * d, s, s * 0.6, s, U.pick(rnd, BLOAT)); } };
    switch (f.type) {
      case 'maquina': {
        box(0, 0.45, -0.05, W, 0.9, D - 0.1, body);                                     // mueble de abajo
        box(0, 0.98, 0.17, W - 0.014, 0.1, 0.44, dk);                                   // panel de mandos (sus lados no pisan los del mueble)
        box(0, 1.035, 0.37, W - 0.04, 0.012, 0.03, trim);
        cyl(-0.17, 1.08, 0.2, 0.012, 0.09, 0x151515, 6); sph(-0.17, 1.13, 0.2, 0.03, 0.03, 0.03, U.pick(rnd, [0xc23030, 0x2a2a2a, 0x3050c0]));
        for (let k = 0; k < 3; k++) cyl(0.02 + k * 0.09, 1.04, 0.22 - (k % 2) * 0.03, 0.024, 0.02, U.pick(rnd, [0xd23a3a, 0xe0c030, 0x3a8ad2, 0x3ac25a]), 8);
        box(0, 1.42, -0.12, W, 0.82, D - 0.32, body);                                    // caja de la pantalla
        box(0, 1.37, 0.115, 0.6, 0.48, 0.02, 0x07070c);                                  // pantalla (la ilumina decor)
        for (const s of [-1, 1]) box(s * (W / 2 - 0.035), 1.37, 0.12, 0.07, 0.56, 0.03, dk);
        box(0, 1.79, -0.04, W + 0.016, 0.13, D - 0.18, trim);                           // cartel de arriba (algo más ancho: sin bordes que parpadeen)
        box(0, 1.865, -0.04, W + 0.04, 0.02, D - 0.16, dk);
        for (const s of [-1, 1]) {                                                      // laterales pintados
          box(s * (W / 2 + 0.006), 0.95, -0.05, 0.008, 0.6, 0.3, trim);
          box(s * (W / 2 + 0.006), 1.45, -0.12, 0.008, 0.26, 0.45, U.shade(trim, 0.8));
        }
        box(0, 0.55, 0.295, 0.3, 0.26, 0.012, 0x6e6e70);                               // puerta de las monedas
        for (const s of [-1, 1]) box(s * 0.06, 0.6, 0.302, 0.03, 0.06, 0.006, 0xd8742a);
        if (rnd() < 0.5) box((rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.4, 0.3, 0.16, 0.08, 0.008, 0x0c0b10);   // patada
        if (rnd() < 0.6) mold(4 + Math.floor(rnd() * 5), W, D);
        break;
      }
      case 'maquina_rota': {
        // máquina volcada de espaldas: la pantalla rota mira al techo, cristales por el suelo
        box(0, 0.36, 0, W * 0.96, 0.72, D * 0.92, body);
        box(-W * 0.12, 0.725, 0, 0.6, 0.02, 0.5, 0x07070c);
        for (let k = 0; k < 5; k++) box(-W * 0.12 + (rnd() - 0.5) * 0.5, 0.74, (rnd() - 0.5) * 0.4, 0.08 + rnd() * 0.1, 0.01, 0.05 + rnd() * 0.08, 0x8aa6b8);
        box(W * 0.28, 0.8, 0, 0.14, 0.16, D * 0.92, dk);
        box(W / 2 - 0.06, 0.36, 0, 0.12, 0.7, D * 0.94, trim);
        for (let k = 0; k < 6; k++) box((rnd() - 0.5) * W * 1.3, 0.01 + k * 0.004, (rnd() - 0.5) * D * 2, 0.04 + rnd() * 0.06, 0.008, 0.03 + rnd() * 0.05, 0x9ab4c4);
        mold(6, W, D);
        break;
      }
      case 'pinball': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.05), 0.4, sz * (D / 2 - 0.08), 0.06, 0.8, 0.06, 0x3a3a3e);
        box(0, 0.9, 0.05, W, 0.22, D - 0.1, body);
        box(0, 1.012, 0.06, W - 0.08, 0.008, D - 0.2, 0x26304a);                       // tablero bajo el cristal
        for (let k = 0; k < 4; k++) cyl((rnd() - 0.5) * 0.4, 1.03, (rnd() - 0.3) * 0.8, 0.045, 0.03, U.pick(rnd, ARC_TRIM), 8);
        box(0, 1.02, 0.06, W - 0.04, 0.006, D - 0.16, 0x7f93a8);
        box(0, 1.15, -D / 2 + 0.1, W, 0.48, 0.16, body);                                // caja de atrás
        box(0, 1.15, -D / 2 + 0.185, W - 0.08, 0.36, 0.01, 0x07070c);
        box(0, 1.38, -D / 2 + 0.1, W + 0.02, 0.03, 0.18, trim);
        if (rnd() < 0.5) mold(4, W, D);
        break;
      }
      case 'hockey': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.12), 0.35, sz * (D / 2 - 0.15), 0.12, 0.7, 0.12, 0x2a2a30);
        box(0, 0.62, 0, W * 0.92, 0.18, D * 0.95, body);
        box(0, 0.76, 0, W, 0.1, D, 0xc9ced4);
        box(0, 0.815, 0, W - 0.1, 0.01, 0.03, 0xc23030);
        for (const s of [-1, 1]) { box(s * (W / 2 - 0.02), 0.84, 0, 0.04, 0.06, D, trim); box(0, 0.84, s * (D / 2 - 0.02), W, 0.06, 0.04, trim); box(0, 0.83, s * (D / 2 - 0.03), 0.34, 0.03, 0.05, 0x111111); }
        cyl(0.2, 0.83, 0.5, 0.05, 0.03, 0xd02a2a, 10); cyl(-0.25, 0.83, -0.4, 0.05, 0.03, 0x2a5ad0, 10);
        mold(3, W, D);
        break;
      }
      case 'grua': {
        // máquina de la grúa con peluches mohosos
        box(0, 0.42, 0, W, 0.84, D, trim);
        box(0, 0.6, D / 2 + 0.003, 0.32, 0.3, 0.01, 0x101012);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.03), 1.35, sz * (D / 2 - 0.03), 0.05, 1.0, 0.05, U.shade(trim, 0.8));
        box(0, 0.86, 0, W - 0.06, 0.03, D - 0.06, 0x2a2230);
        for (let k = 0; k < 9; k++) {
          const c = U.pick(rnd, [0xd86a9a, 0x6ab8d8, 0xe0d06a, 0x9a7ad8, 0x7ad89a]);
          sph((rnd() - 0.5) * (W - 0.3), 0.95 + rnd() * 0.12, (rnd() - 0.5) * (D - 0.3), 0.08, 0.07, 0.08, rnd() < 0.3 ? U.shade(c, 0.6) : c);
        }
        box(0, 1.9, 0, W, 0.14, D, trim);
        box(0, 1.98, 0, W - 0.1, 0.04, D - 0.1, U.shade(trim, 0.7));
        cyl(0.1, 1.6, -0.05, 0.008, 0.5, 0x8a8a8a, 5); box(0.1, 1.33, -0.05, 0.1, 0.06, 0.1, 0x9a9aa0);
        break;
      }
      case 'cambio': {
        box(0, H / 2, 0, W, H, D, 0x5d6168);
        box(0, H * 0.7, D / 2 + 0.004, W - 0.12, 0.3, 0.008, 0x0a0a0c);
        box(0, H * 0.45, D / 2 + 0.006, 0.12, 0.06, 0.01, 0x2a2a2a);
        box(0, 0.25, D / 2 + 0.02, 0.3, 0.12, 0.05, 0x3a3a3a);
        box(0, H - 0.05, 0, W + 0.02, 0.1, D + 0.02, 0xd9b52f);
        break;
      }
      case 'hongos': {
        // la infección en el suelo (como la piel del hongomorfo, no setas): una mancha de podredumbre negra, colonias
        // de bultos carnosos tostados apiñados sobre costras oscuras, abanicos de láminas que se abren hacia arriba,
        // fibras pálidas y alguna llaga en carne viva. Cada mancha, distinta
        for (let k = 0; k < 7; k++) sph((rnd() - 0.5) * W * 0.5, 0.002 + k * 0.003, (rnd() - 0.5) * D * 0.5, W * (0.18 + rnd() * 0.25), 0.004, D * (0.18 + rnd() * 0.25), U.pick(rnd, ROT));
        const nc = Math.max(1, Math.round(W * D * 0.9));
        for (let c = 0; c < nc; c++) {
          const ccx = (rnd() - 0.5) * W * 0.6, ccz = (rnd() - 0.5) * D * 0.6, R = 0.2 + rnd() * 0.3, top = 0.08 + rnd() * 0.14;
          sph(ccx, 0.02, ccz, R * 0.9, 0.05, R * 0.8, BDK);                                         // costra
          for (let k = 0, n = 10 + Math.floor(rnd() * 9); k < n; k++) {
            const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, s2 = 0.035 + rnd() * 0.06 * (1 - d / R * 0.5);
            sph(ccx + Math.sin(a) * d, s2 * 0.5 + top * (1 - d / R) * 0.6, ccz + Math.cos(a) * d, s2 * (0.9 + rnd() * 0.3), s2 * (0.7 + rnd() * 0.3), s2 * (0.9 + rnd() * 0.3), U.pick(rnd, BLOAT));
            if (rnd() < 0.18) sph(ccx + Math.sin(a) * d * 1.1, s2 + top * (1 - d / R) * 0.6, ccz + Math.cos(a) * d * 1.1, 0.014, 0.012, 0.014, rnd() < 0.5 ? BRAW : BPALE);
          }
          // abanico de láminas en el centro de la colonia
          if (X && rnd() < 0.75) for (let k = 0, n = 6 + Math.floor(rnd() * 5); k < n; k++) {
            const a = k / n * Math.PI * 2 + rnd() * 0.4, h = 0.06 + rnd() * 0.08, w = 0.06 + rnd() * 0.05, o = 0.03 + w * 0.4;
            const p = X.P(ccx + Math.cos(a) * o, top * 0.6 + h * 0.45, ccz - Math.sin(a) * o);
            X.m.box(p[0], p[1], p[2], w, h, 0.01, rnd() < 0.25 ? BPALE : U.pick(rnd, BLOAT), X.ry + a, undefined, 0, -0.5 - rnd() * 0.4);
          }
          // fibras pálidas
          if (X) for (let k = 0; k < 4; k++) {
            const p = X.P(ccx + (rnd() - 0.5) * R, top * 0.5 + 0.05, ccz + (rnd() - 0.5) * R);
            X.m.box(p[0], p[1], p[2], 0.006, 0.08 + rnd() * 0.1, 0.006, BPALE, rnd() * 6.3, undefined, 0, (rnd() - 0.5) * 1.2);
          }
        }
        break;
      }
      case 'escombros': {
        // cascotes de pared, yeso y polvo
        box(0, 0.006, 0, W * 0.9, 0.012, D * 0.8, 0x6a6460);
        for (let k = 0; k < 12; k++) {
          const s = 0.06 + rnd() * 0.16;
          box((rnd() - 0.5) * W * 0.85, s * 0.35, (rnd() - 0.5) * D * 0.8, s * (1 + rnd()), s * 0.7, s * (0.8 + rnd()), U.pick(rnd, [0x7a746e, 0x8e8780, 0xb8b0a4, 0x5a5550]));
        }
        break;
      }
      case 'hongo_pared': {
        // la infección trepando por la pared: manchas negras de humedad y podredumbre, venas de bultos carnosos que
        // suben desde el suelo y se abren en abanicos de láminas (como la corona del hongomorfo), cada vez más
        // escasas hacia arriba, con fibras colgando
        const wz = -D / 2 + 0.012;
        for (let k = 0; k < 8; k++) sph((rnd() - 0.5) * W * 0.7, 0.15 + rnd() * (H - 0.4) * 0.7 * rnd(), wz - 0.004 + k * 0.001, 0.15 + rnd() * 0.35, 0.2 + rnd() * 0.5, 0.008, U.pick(rnd, ROT));
        for (let v = 0, nv = 2 + Math.floor(rnd() * 2); v < nv; v++) {
          let x = (rnd() - 0.5) * W * 0.7, y = 0.05;
          const steps = 14 + Math.floor(rnd() * 12);
          for (let k = 0; k < steps; k++) {
            const t = k / steps, s2 = (0.05 + rnd() * 0.06) * (1 - t * 0.6);
            sph(x, y, wz + 0.004, s2 * 2.2, s2 * 1.8, 0.01, BDK);                                   // costra pegada a la pared
            for (let j = 0; j < 3; j++) sph(x + (rnd() - 0.5) * s2 * 2.2, y + (rnd() - 0.5) * s2 * 1.8, wz + s2 * 0.3, s2 * (0.7 + rnd() * 0.5), s2 * (0.6 + rnd() * 0.4), s2 * 0.5, rnd() < 0.15 ? BDK : U.pick(rnd, BLOAT));
            // a trechos, un abanico de láminas que sale de la pared
            if (X && rnd() < 0.22) for (let j = 0, n = 5 + Math.floor(rnd() * 4); j < n; j++) {
              const a = (j / n - 0.5) * 2.2 + (rnd() - 0.5) * 0.3, dd = 0.06 + rnd() * 0.05;
              const p = X.P(x + Math.sin(a) * 0.03, y + Math.cos(a) * 0.03, wz + dd / 2);
              X.m.box(p[0], p[1], p[2], 0.01, 0.07 + rnd() * 0.05, dd, rnd() < 0.2 ? BPALE : U.pick(rnd, BLOAT), X.ry, undefined, 0, a);
            }
            if (X && rnd() < 0.15) { const p = X.P(x, y - 0.08, wz + 0.03); X.m.box(p[0], p[1], p[2], 0.006, 0.14 + rnd() * 0.1, 0.006, BPALE, X.ry); }
            x += (rnd() - 0.5) * 0.16; y += 0.06 + rnd() * 0.08 * (1 + t);
            if (y > H - 0.1) break;
          }
        }
        // la base, más espesa (de ahí sale todo)
        for (let k = 0; k < 8; k++) { const s2 = 0.05 + rnd() * 0.07; sph((rnd() - 0.5) * W * 0.8, s2 * 0.5, wz + s2 * 0.5 + rnd() * 0.1, s2 * 1.2, s2 * 0.8, s2, U.pick(rnd, BLOAT)); }
        sph(0, 0.02, wz + 0.15, W * 0.4, 0.04, 0.2, BDK);
        break;
      }
    }
  }

  // Camión de bomberos abandonado: rojo apagado y oxidado, ruedas pinchadas, cristales rotos
  function drawTruck(box, cyl, W, D, rnd) {
    const red = 0x8e2a22, rust = 0x7a4a2c, chrome = 0x9a9a92, dark = 0x2a2a2a;
    const L = D;
    // chasis y cabina (delante = +Z)
    box(0, 0.75, 0, W - 0.1, 0.35, L - 0.4, dark);
    box(0, 1.55, L / 2 - 1.2, W, 1.6, 2.0, red);                                  // cabina
    box(0, 1.95, L / 2 - 0.22, W - 0.3, 0.7, 0.04, 0x2a3236);                     // parabrisas (roto)
    box(0.5, 2.0, L / 2 - 0.2, 0.5, 0.3, 0.03, 0x50606a);
    box(0, 0.95, L / 2 - 0.12, W - 0.1, 0.4, 0.1, chrome);                        // parachoques
    box(-W / 2 + 0.3, 1.2, L / 2 - 0.1, 0.22, 0.14, 0.04, 0xd8d0b0);
    box(W / 2 - 0.3, 1.2, L / 2 - 0.1, 0.22, 0.14, 0.04, 0xd8d0b0);
    box(0, 2.42, L / 2 - 1.3, 1.2, 0.14, 0.3, 0xa03030);                          // luces de emergencia
    // caja con compartimentos (el cofre es el de la derecha)
    box(0, 1.6, -0.9, W, 1.8, L - 2.6, red);
    for (let k = 0; k < 3; k++) {
      const z = -L / 2 + 1.3 + k * 1.45;
      box(W / 2 + 0.005, 1.45, z, 0.01, 1.2, 1.2, U.shade(red, 0.85));
      box(-W / 2 - 0.005, 1.45, z, 0.01, 1.2, 1.2, U.shade(red, 0.85));
      box(W / 2 + 0.015, 1.1, z, 0.02, 0.05, 1.0, chrome);
    }
    box(W / 2 + 0.02, 1.45, -L / 2 + 1.3, 0.03, 1.1, 1.1, 0xb8b030);              // cofre marcado
    box(0, 2.6, -0.9, W - 0.2, 0.1, L - 2.8, chrome);                             // escalera del techo
    for (let k = 0; k < 7; k++) box(0, 2.62, -L / 2 + 1.0 + k * 0.7, W - 0.3, 0.04, 0.05, chrome);
    // óxido y suciedad
    for (let k = 0; k < 10; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      box(side * (W / 2 + 0.008), 0.9 + rnd() * 1.6, -L / 2 + rnd() * L, 0.01, 0.15 + rnd() * 0.35, 0.2 + rnd() * 0.6, rust);
    }
    // ruedas (algunas pinchadas: más bajas y anchas)
    for (const z of [L / 2 - 1.3, -L / 2 + 1.4, -L / 2 + 2.6]) {
      for (const sx of [-1, 1]) {
        const flat = rnd() < 0.5;
        const r = flat ? 0.42 : 0.5;
        m2cyl(cyl, box, sx * (W / 2 - 0.15), r, z, r, 0.4, flat);
      }
    }
  }
  function m2cyl(cyl, box, x, y, z, r, w, flat) {
    // rueda: un cilindro tumbado (se aproxima con cajas cruzadas para no complicar)
    box(x, y, z, w, r * 2 * (flat ? 0.85 : 1), r * 1.6, 0x1c1c1c);
    box(x, y, z, w, r * 1.6 * (flat ? 0.85 : 1), r * 2, 0x1c1c1c);
    box(x + Math.sign(x) * 0.02, y, z, w * 0.6, r * 0.9, r * 0.9, 0x6a6a64);
  }
  function drawCar(box, cyl, W, D, kind, rnd, col) {
    const L = D;
    const body = kind === 'policia' ? 0xe8e6de : (col || U.pick(rnd, [0x8a8f86, 0x6e7a84, 0xa8a49a, 0x7a5a48, 0x5e6a5a, 0xb4b0a4]));
    box(0, 0.62, 0, W, 0.55, L, body);
    box(0, 0.62, L / 2 - 0.55, W + 0.01, 0.56, 1.0, kind === 'policia' ? 0x1e2a44 : body);
    box(0, 0.62, -L / 2 + 0.55, W + 0.01, 0.56, 1.0, kind === 'policia' ? 0x1e2a44 : body);
    box(0, 1.12, -0.15, W - 0.2, 0.45, 2.0, U.shade(body, 0.95));                 // habitáculo
    box(0, 1.15, 0.86, W - 0.25, 0.38, 0.04, 0x2c3a44);
    box(0, 1.15, -1.16, W - 0.25, 0.38, 0.04, 0x2c3a44);
    box(W / 2 - 0.09, 1.15, -0.15, 0.02, 0.36, 1.8, 0x2c3a44);
    box(-W / 2 + 0.09, 1.15, -0.15, 0.02, 0.36, 1.8, 0x2c3a44);
    if (kind === 'policia') {
      box(0, 1.4, -0.1, 1.1, 0.1, 0.25, 0x2a2a2a);
      box(-0.3, 1.47, -0.1, 0.45, 0.08, 0.2, 0xb02a2a);
      box(0.3, 1.47, -0.1, 0.45, 0.08, 0.2, 0x2a4ab0);
      box(W / 2 + 0.006, 0.66, 0, 0.01, 0.12, L * 0.5, 0x2a4a8a);
      box(-W / 2 - 0.006, 0.66, 0, 0.01, 0.12, L * 0.5, 0x2a4a8a);
    }
    for (const z of [L / 2 - 0.85, -L / 2 + 0.85]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.1), 0.33, z, 0.33, 0.24, rnd() < 0.4);
    if (kind !== 'policia') dirty(box, W, L, 1.1, rnd);
  }
  // suciedad, polvo y musgo de años: manchas sobre la carrocería y hierba que crece por debajo
  function dirty(box, W, L, top, rnd) {
    for (let k = 0; k < 8; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      box(side * (W / 2 + 0.008), 0.45 + rnd() * 0.4, -L / 2 + rnd() * L, 0.01, 0.12 + rnd() * 0.25, 0.3 + rnd() * 0.7, U.pick(rnd, [0x6a5a44, 0x5a6a44, 0x7a6a50]));
    }
    for (let k = 0; k < 4; k++) box((rnd() - 0.5) * W * 0.7, top + 0.012, (rnd() - 0.5) * L * 0.5, 0.3 + rnd() * 0.5, 0.012, 0.3 + rnd() * 0.6, U.pick(rnd, [0x7a7058, 0x5f6a48]));
  }
  // camioneta (pick-up) abandonada: cabina, caja descubierta, polvo y ruedas pinchadas
  function drawPickup(box, cyl, W, D, rnd, col) {
    const L = D, body = col || U.pick(rnd, [0x8f8a7a, 0x6a7a6c, 0x9a9488, 0x5a6670, 0x7a6a58]);
    const glass = 0x2c3a44, dark = 0x2a2a2a;
    box(0, 0.62, 0, W, 0.5, L, body);                                              // chasis y laterales bajos
    box(0, 0.95, L / 2 - 0.75, W, 0.4, 1.45, body);                                // capó
    box(0, 1.35, 0.35, W - 0.1, 0.75, 1.6, U.shade(body, 0.96));                   // cabina
    box(0, 1.4, 1.16, W - 0.25, 0.5, 0.04, glass);
    box(W / 2 - 0.04, 1.42, 0.35, 0.02, 0.42, 1.3, glass); box(-W / 2 + 0.04, 1.42, 0.35, 0.02, 0.42, 1.3, glass);
    box(0, 1.42, -0.46, W - 0.25, 0.4, 0.04, glass);
    // caja de carga
    box(0, 1.05, -L / 2 + 1.05, W, 0.45, 0.06, body); box(W / 2 - 0.03, 1.05, -L / 2 + 1.05 + 0.0, 0.06, 0.45, 2.1, body); box(-W / 2 + 0.03, 1.05, -L / 2 + 1.05, 0.06, 0.45, 2.1, body);
    box(0, 0.9, -L / 2 + 0.03, W, 0.55, 0.06, U.shade(body, 0.9));
    box(0, 0.86, -L / 2 + 1.05, W - 0.12, 0.04, 2.0, 0x3a3a38);
    if (rnd() < 0.6) box(0.2, 0.98, -L / 2 + 1.2, 0.6, 0.2, 0.5, U.pick(rnd, [0x8a6440, 0x3f5f86, 0x6a6a6a]));
    box(0, 0.55, L / 2 + 0.02, W + 0.04, 0.2, 0.08, 0x9a9a92);                   // parachoques
    box(0, 0.5, -L / 2 - 0.02, W + 0.04, 0.16, 0.06, 0x9a9a92);
    for (const sx of [-1, 1]) box(sx * (W / 2 - 0.25), 0.9, L / 2 + 0.01, 0.3, 0.14, 0.03, 0xcfc8a8);
    for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.1), 0.36, z, 0.36, 0.26, rnd() < 0.5);
    for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const sx of [-1, 1]) box(sx * (W / 2 + 0.01), 0.72, z, 0.04, 0.12, 0.95, dark);
    dirty(box, W, L, 1.72, rnd);
  }
  // montacargas: amarillo descolorido, mástil con las horquillas, jaula del conductor y contrapeso
  function drawForklift(box, cyl, W, D, rnd) {
    const yel = 0xc9a032, dark = 0x2a2a2a, L = D;
    box(0, 0.55, -0.2, W, 0.6, L - 1.0, yel);                                       // cuerpo
    box(0, 0.75, -L / 2 + 0.35, W, 0.9, 0.5, U.shade(yel, 0.85));                  // contrapeso
    box(0, 1.0, -0.15, 0.5, 0.15, 0.5, 0x3a3a3a);                                   // asiento
    box(0, 1.25, -0.4, 0.5, 0.45, 0.08, 0x3a3a3a);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.06), 1.45, -0.15 + sz * 0.55, 0.06, 1.4, 0.06, dark);   // jaula
    box(0, 2.16, -0.15, W, 0.06, 1.2, dark);
    for (const sx of [-1, 1]) box(sx * 0.3, 1.15, L / 2 - 0.55, 0.1, 2.2, 0.12, dark);   // mástil
    box(0, 2.2, L / 2 - 0.55, 0.7, 0.08, 0.12, dark);
    box(0, 0.45, L / 2 - 0.45, 0.8, 0.5, 0.06, 0x3a3a38);
    for (const sx of [-1, 1]) box(sx * 0.25, 0.08, L / 2 - 0.05, 0.12, 0.05, 0.9, 0x4a4a48);   // horquillas
    for (const z of [L / 2 - 0.9, -L / 2 + 0.55]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.05), 0.3, z, 0.3, 0.22, false);
    for (let k = 0; k < 5; k++) box((rnd() < 0.5 ? -1 : 1) * (W / 2 + 0.006), 0.4 + rnd() * 0.4, -L / 2 + rnd() * L * 0.7, 0.01, 0.12 + rnd() * 0.2, 0.2 + rnd() * 0.3, 0x7a4a2c);
  }
  // Contenedor de carga (6 o 12 m): chapa ondulada con nervios, marco oscuro, puertas con barras de cierre en un
  // extremo, óxido y un rótulo de la naviera (inventado: rayas claras desvaídas). f.open: abierto (se puede entrar)
  const CONT_COLS = [0x6f8a6a, 0x4f6f86, 0x8f3c30, 0xb0653a, 0xb8ab84, 0x5f6e5c, 0x8d8a80, 0x3f5f6a, 0x9a5a3a];
  function drawContainer(box, W, D, H, f, rnd) {
    const col = f.col != null ? f.col : U.pick(rnd, CONT_COLS);
    const dark = U.shade(col, 0.62), rib = U.shade(col, 0.86), rust = 0x6e4428, inside = 0x4a443c;
    if (f.lod) {
      // los de fuera de la valla (se ven de lejos): menos piezas
      box(0, H / 2, 0, W - 0.06, H - 0.06, D - 0.06, col);
      for (let x = -W / 2 + 0.6; x < W / 2 - 0.4; x += 1.2) { box(x, H / 2, D / 2, 0.5, H - 0.3, 0.04, rib); box(x, H / 2, -D / 2, 0.5, H - 0.3, 0.04, rib); }
      for (const s of [-1, 1]) { box(0, H - 0.07, s * (D / 2 - 0.03), W, 0.14, 0.08, dark); box(0, 0.08, s * (D / 2 - 0.03), W, 0.16, 0.08, dark); box(s * (W / 2 - 0.03), H / 2, 0, 0.1, H, D + 0.02, dark); }
      if (rnd() < 0.6) box((rnd() - 0.5) * (W - 2), H * 0.6, (rnd() < 0.5 ? -1 : 1) * (D / 2 + 0.035), 1.5 + rnd(), 0.6 + rnd(), 0.006, rust);
      return;
    }
    const T2 = 0.05;
    if (f.open) {
      box(0, 0.02, 0, W - 0.1, 0.04, D - 0.1, 0x5a5046);                                     // suelo de madera
      box(0, H / 2, D / 2 - T2, W - 0.1, H - 0.1, T2, col); box(0, H / 2, -D / 2 + T2, W - 0.1, H - 0.1, T2, col);
      box(0, H / 2, D / 2 - T2 - 0.03, W - 0.2, H - 0.2, 0.01, inside); box(0, H / 2, -D / 2 + T2 + 0.03, W - 0.2, H - 0.2, 0.01, inside);
      box(-W / 2 + T2, H / 2, 0, T2, H - 0.1, D - 0.1, col);                                  // fondo
      box(-W / 2 + T2 + 0.03, H / 2, 0, 0.01, H - 0.2, D - 0.2, inside);
      box(0, H - T2, 0, W - 0.1, T2, D - 0.1, col);                                          // techo
      box(0, H - T2 - 0.03, 0, W - 0.2, 0.01, D - 0.2, inside);
      // puertas abiertas de par en par, plegadas contra los costados
      for (const s of [-1, 1]) {
        box(W / 2 - D / 4 + 0.05, H / 2, s * (D / 2 + 0.07), D / 2 - 0.08, H - 0.25, 0.04, U.shade(col, 0.92));
        for (const k of [0.25, 0.75]) box(W / 2 - (D / 2 - 0.08) * k, H / 2, s * (D / 2 + 0.1), 0.035, H - 0.35, 0.035, 0x55575a);
      }
    } else {
      box(0, H / 2, 0, W - 0.1, H - 0.1, D - 0.1, col);
      // puertas en el extremo +X: dos hojas con cuatro barras de cierre
      for (const s of [-1, 1]) box(W / 2 - 0.03, H / 2, s * D / 4, 0.03, H - 0.25, D / 2 - 0.06, U.shade(col, 0.93));
      for (const z of [-0.36, -0.12, 0.12, 0.36]) {
        box(W / 2 + 0.02, H / 2, z * D, 0.035, H - 0.3, 0.035, 0x55575a);
        box(W / 2 + 0.03, H * 0.42, z * D + 0.04, 0.03, 0.05, 0.1, 0x55575a);
      }
      box(W / 2 + 0.005, H / 2, 0, 0.02, H - 0.25, 0.04, dark);
    }
    // nervios de la chapa en los costados largos (y en el fondo)
    const step = 0.5;
    for (let x = -W / 2 + 0.32; x < W / 2 - 0.25; x += step) {
      box(x, H / 2, D / 2 - 0.02, 0.18, H - 0.3, 0.05, rib);
      box(x, H / 2, -D / 2 + 0.02, 0.18, H - 0.3, 0.05, rib);
    }
    for (let z = -D / 2 + 0.3; z < D / 2 - 0.25; z += step) box(-W / 2 + 0.02, H / 2, z, 0.05, H - 0.3, 0.13, rib);
    // techo ondulado (más oscuro, con charcos de óxido)
    box(0, H - 0.03, 0, W - 0.14, 0.03, D - 0.14, U.shade(col, 0.8));
    for (let x = -W / 2 + 0.4; x < W / 2 - 0.3; x += 0.9) box(x, H - 0.01, 0, 0.3, 0.02, D - 0.2, U.shade(col, 0.74));
    for (let k = 0; k < Math.round(W / 3); k++) box((rnd() - 0.5) * (W - 1), H + 0.006 + k * 0.007, (rnd() - 0.5) * (D - 0.6), 0.4 + rnd() * 0.9, 0.006, 0.3 + rnd() * 0.6, rust);
    // marco: largueros arriba y abajo, postes de las esquinas y cantoneras
    for (const s of [-1, 1]) {
      box(0, H - 0.07, s * (D / 2 - 0.03), W, 0.14, 0.07, dark);
      box(0, 0.08, s * (D / 2 - 0.03), W, 0.16, 0.07, dark);
      box(s * (W / 2 - 0.03), H - 0.07, 0, 0.07, 0.14, D, dark);
      box(s * (W / 2 - 0.03), 0.08, 0, 0.07, 0.16, D, dark);
      for (const t of [-1, 1]) {
        box(s * (W / 2 - 0.05), H / 2, t * (D / 2 - 0.05), 0.1, H, 0.1, dark);
        box(s * (W / 2 - 0.05), H - 0.06, t * (D / 2 - 0.05), 0.16, 0.12, 0.16, 0x5a5a56);
        box(s * (W / 2 - 0.05), 0.06, t * (D / 2 - 0.05), 0.16, 0.12, 0.16, 0x5a5a56);
      }
    }
    // óxido y churretones en los costados
    for (let k = 0; k < 3 + Math.round(W / 2.5); k++) {
      const s = rnd() < 0.5 ? -1 : 1, w = 0.3 + rnd() * 1.2, h = 0.2 + rnd() * 1.2;
      box((rnd() - 0.5) * (W - 1), H - 0.15 - h / 2 - rnd() * 0.6, s * (D / 2 + 0.018 + k * 0.007), w, h, 0.006, rnd() < 0.7 ? rust : U.shade(col, 0.7));   // (cada mancha a su distancia: no se pisan)
    }
    // rótulo de la naviera (inventado): un emblema redondo y letras desvaídas
    if (rnd() < 0.75) {
      const s = rnd() < 0.5 ? -1 : 1, ex = (rnd() - 0.5) * (W - 4), lt = 0xd8d4c6;
      const ey = H * 0.62;
      // (por delante de las manchas de óxido)
      const so = D / 2 + 0.018 + (3 + Math.round(W / 2.5)) * 0.007 + 0.006;
      box(ex - 1.1, ey + 0.05, s * so, 0.45, 0.45, 0.006, lt);
      box(ex - 1.1, ey + 0.05, s * (so + 0.008), 0.25, 0.25, 0.006, col);
      for (let k = 0; k < 6; k++) box(ex - 0.6 + k * 0.28, ey + 0.05, s * so, 0.07 + (k % 2) * 0.08, 0.42, 0.006, lt);
      box(ex + 0.15, ey - 0.3, s * so, 1.4, 0.06, 0.006, lt);
    }
    // número de serie junto a las puertas
    box(W / 2 - 0.5, H - 0.4, D / 2 + 0.018 + (3 + Math.round(W / 2.5)) * 0.007 + 0.02, 0.5, 0.08, 0.006, 0xd8d4c6);
  }
  function drawVan(box, cyl, W, D, rnd) {
    const L = D, wh = 0xe9e7e0;
    box(0, 1.35, -0.4, W, 1.9, L - 1.6, wh);
    box(0, 1.0, L / 2 - 1.0, W, 1.1, 1.8, wh);
    box(0, 1.65, L / 2 - 0.6, W - 0.2, 0.5, 0.04, 0x2c3a44);
    box(W / 2 + 0.006, 1.2, -0.4, 0.01, 0.25, L - 1.8, 0xc23b2b);
    box(-W / 2 - 0.006, 1.2, -0.4, 0.01, 0.25, L - 1.8, 0xc23b2b);
    // cruz
    for (const sx of [1, -1]) {
      box(sx * (W / 2 + 0.008), 1.75, -0.6, 0.01, 0.5, 0.16, 0xc23b2b);
      box(sx * (W / 2 + 0.008), 1.75, -0.6, 0.01, 0.16, 0.5, 0xc23b2b);
    }
    box(0, 2.35, L / 2 - 1.6, 1.0, 0.12, 0.25, 0xb02a2a);
    box(0, 0.45, L / 2 - 0.05, W, 0.25, 0.1, 0x9a9a92);
    for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.12), 0.38, z, 0.38, 0.28, rnd() < 0.5);
  }

  // Coloca un vehículo (centro, dirección del frente) en la lista del chunk
  function addVehicle(c, type, xc, zc, fx, fz, rng, lv, y) {
    const t = T[type];
    const along = Math.abs(fz) > 0.5;      // el largo va en z
    const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
    const f = {
      type, lv: lv || 0, x0: xc - hw, x1: xc + hw, z0: zc - hd, z1: zc + hd, y: y || 0, h: t.h,
      fx, fz, solid: true, seed: Math.floor(rng() * 1e9), vehicle: true,
      cont: { kind: t.cont, name: C[t.cont].name, items: rollLoot(t.cont, rng), searched: false }
    };
    c.furn.push(f);
    return f;
  }

  // Punto desde el que se registra: delante del mueble (o, en vehículos, junto al cofre)
  function frontPoint(f) {
    const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    const t = T[f.type];
    if (f.type === 'camion') {
      // cofre en el lateral derecho (visto desde detrás), cerca de la parte trasera
      const rx = f.fz, rz = -f.fx;   // derecha del vehículo
      return { x: cx - rx * (t.w / 2 + 0.5) - f.fx * (t.d / 2 - 1.3), z: cz - rz * (t.w / 2 + 0.5) - f.fz * (t.d / 2 - 1.3) };
    }
    if (t.vehicle) return { x: cx - f.fx * (t.d / 2 + 0.5), z: cz - f.fz * (t.d / 2 + 0.5) };   // por detrás (maletero)
    const half = Math.abs(f.fx) > 0.5 ? (f.x1 - f.x0) / 2 : (f.z1 - f.z0) / 2;
    return { x: cx + f.fx * (half + 0.45), z: cz + f.fz * (half + 0.45) };
  }

  G.Furniture = { T, C, furnishRoom, indexChunk, draw, addVehicle, rollLoot, frontPoint };
})(window.Game = window.Game || {});
