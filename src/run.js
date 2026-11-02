(function (G) {
  'use strict';

  // Modo Retorno: una carrera de 5 enfrentamientos (y el jefe final: el hongomorfo, en el salón recreativo) con un refugio
  // entre uno y otro. Aquí vive el estado de la carrera: el mapa de enfrentamientos, las monedas (para el
  // puesto de comercio) y las piezas (para el banco de mejoras), las mejoras de las armas, lo que hay a la
  // venta, lo que espera en el cofre de recompensas y lo que llevas encima.
  //
  // Guardado (como un roguelike): solo se guarda en el refugio. Al empezar un enfrentamiento la partida queda
  // marcada; si sales a mitad (o se cierra el juego) la carrera se pierde. Una carrera nueva desde el menú
  // principal empieza de cero (sin mejoras).

  const KEY = 'ceniza.retorno';
  const STEPS = 5;
  // Partida diaria: una sola por día (se reinicia a medianoche), 8 enfrentamientos, el mismo mapa para todos
  // ese día (sale de la fecha), un personaje desbloqueado al azar y más difícil (más enemigos, golpes que
  // duelen más y algo menos de recompensa). Se guarda aparte: no pisa la carrera normal
  const DAILY_STEPS = 8;
  const DKEY = 'ceniza.diaria.carrera';       // la carrera diaria guardada
  const DSTATE = 'ceniza.diaria';             // { day, char, res: 'jugando' | 'perdida' | 'completada' }
  const DAILY = { hurt: 1.25, enemies: 1.25, reward: 0.85 };
  const U = G.Util;

  // ---------- Enfrentamientos ----------
  const TYPES = {
    asalto: { name: 'Asalto', text: 'Aguanta tres oleadas de infectados que llegan desde todo el mapa. Al despejar cada oleada aparece un cofre con suministros.', foes: 'Corredores y acechadores; en la 2.ª oleada, a veces un chasqueador o un temblante; en la 3.ª, uno o dos temblantes.' },
    caza: { name: 'Caza', text: 'Sobrevive hasta que se acabe el tiempo. Los infectados no dejan de llegar (como mucho 12 a la vez) y cada vez más rápido cuanto menos falta para volver.', foes: 'Muchos corredores, algunos chasqueadores y pocos acechadores. Sin temblantes.' },
    asalto_h: { name: 'Asalto · Escorpiones', text: 'Unos saqueadores de los Escorpiones rondan la zona. Dos oleadas de exploradores con pistola y carroñeros con palos; el último en pie huirá a buscar a su grupo, y la tercera oleada será ese grupo, con su líder.', foes: 'Los Escorpiones: exploradores (pistola) y carroñeros (palo); en la tercera oleada, un escuadrón con líder, tirador, escopetero, bruto... Sin infectados.' },
    caza_h: { name: 'Caza · Escorpiones', text: 'Aguanta hasta que se acabe el tiempo mientras los Escorpiones te buscan por el mapa. Llegan de a poco: como mucho ocho, y nunca más de cuatro a la vez.', foes: 'Los Escorpiones: exploradores (pistola), carroñeros (palo) y pistoleros. Sin infectados.' },
    saqueo: { name: 'Saqueo', text: 'Los Escorpiones protegen una caja fuerte con botín y no la van a soltar. Tienes 3 min 30 s para abrirla, a escondidas o acabando con ellos. Si se acaba el tiempo, vuelves con un cuarto de la recompensa.', foes: 'Los Escorpiones: un escuadrón con su líder, tirador, escopetero, bruto, sigilosa... Sin infectados.' },
    resistencia: { name: 'Resistencia', text: 'Aguanta las oleadas de infectados protegiendo a tu compañero (el personaje que no llevas). Él también pelea y aguanta mucho, pero si cae, pierdes.', foes: 'Infectados: corredores en oleadas cada vez más grandes y, al final, algún chaskeado o temblante.' },
  };
  TYPES.liberacion = { name: 'Liberación', text: 'Cuélate en la Red del Capitolio, donde los Escorpiones tienen presos a los tuyos, y sácalos con vida. Puedes liberar a varios a la vez, cuando quieras: si es pronto, salen sin armas con toda la guardia despierta. Luego, salid juntos por donde entraste. Hay Supervivientes en otras celdas (liberarlos es opcional) y chasqueadores encadenados que dan la alarma.', foes: 'La guarnición de los Escorpiones (tres grupos repartidos por la sede) y chasqueadores encadenados.' };
  TYPES.escuadron = TYPES.saqueo;          // (carreras guardadas de antes: el escuadrón es ahora el saqueo)
  // duración de la caza según la columna del mapa (segundos)
  const CAZA_T = [120, 135, 150, 165, 180];

  // ---------- Puesto de comercio ----------
  // Solo hay 4 cosas a la vez (y los dados para volver a sortearlas, que cuestan monedas). Se renueva tras cada
  // enfrentamiento. Las monedas cuestan de ganar (de 13 a 32 por enfrentamiento): los precios son bajos.
  // p: peso al sortear lo que sale
  const SHOP = [
    { id: 'venda', name: 'Venda', icon: 'botiquin', n: 1, price: 3, p: 1.0, desc: 'Una venda para curarte.' },
    { id: 'humo', name: 'Bomba de humo', icon: 'humo', n: 1, price: 4, p: 0.6, desc: 'Una nube que aturde a los infectados que la cruzan.' },
    { id: 'molotov', name: 'Molotov', icon: 'molotov', n: 1, price: 4, p: 0.7, desc: 'Prende fuego a todo lo que alcanza.' },
    { id: 'mina', name: 'Mina', icon: 'mina', n: 1, price: 5, p: 0.5, desc: 'Revienta cuando un infectado la pisa.' },
    { id: 'mun_9mm', name: 'Balas de 9 mm', icon: 'mun_9mm', n: 6, price: 2, p: 1.2, desc: 'Munición para la pistola.' },
    { id: 'mun_cartucho', name: 'Cartuchos', icon: 'mun_cartucho', n: 4, price: 3, p: 0.8, desc: 'Munición para las escopetas.' },
    { id: 'mun_rifle', name: 'Balas de rifle', icon: 'mun_rifle', n: 3, price: 3, p: 0.7, desc: 'Munición para el rifle de cerrojo.' },
    { id: 'mun_flecha', name: 'Flechas', icon: 'mun_flecha', n: 4, price: 2, p: 0.7, desc: 'Flechas para el arco (se pueden recuperar).' },
    { id: 'mun_revolver', name: 'Balas de revólver', icon: 'mun_revolver', n: 4, price: 3, p: 0.7, desc: 'Munición para el revólver.' },
    { id: 'mun_smg', name: 'Balas de subfusil', icon: 'mun_smg', n: 6, price: 6, p: 0.25, desc: 'Munición para el subfusil silenciado.' },
    { id: 'mun_gas', name: 'Combustible', icon: 'mun_gas', n: 20, price: 3, p: 0.5, desc: 'Combustible para el lanzallamas.' },
    { id: 'pistola', name: 'Pistola semiautomática', icon: 'pistola', weapon: true, price: 6, p: 0.3, desc: 'Arma corta de 9 mm. Se mejora en el banco de mejoras.' },
    { id: 'revolver', name: 'Revólver', icon: 'revolver', weapon: true, price: 10, p: 0.4, desc: 'Arma corta: mucho daño y seis balas. Se mejora en el banco de mejoras.' },
    { id: 'arco', name: 'Arco', icon: 'arco', weapon: true, price: 10, p: 0.4, desc: 'Silencioso. Mantén Atacar para tensarlo.' },
    { id: 'escopeta', name: 'Escopeta de corredera', icon: 'escopeta', weapon: true, price: 12, p: 0.4, desc: 'Demoledora de cerca. Se mejora en el banco de mejoras.' },
    { id: 'rifle', name: 'Rifle de cerrojo', icon: 'rifle', weapon: true, price: 14, p: 0.35, desc: 'El arma más potente, con mira. Se mejora en el banco de mejoras.' },
    { id: 'doble', name: 'Escopeta de doble cañón', icon: 'doble', weapon: true, price: 14, p: 0.35, desc: 'Dos disparos brutales de cerca.' },
    { id: 'subfusil', name: 'Subfusil silenciado', icon: 'subfusil', weapon: true, special: true, price: 18, p: 0.2, desc: 'Ráfagas casi sin ruido. Arma especial: no se mejora.' },
    { id: 'lanzallamas', name: 'Lanzallamas', icon: 'lanzallamas', weapon: true, special: true, price: 20, p: 0.15, desc: 'Un chorro de fuego de unos 7 m. Arma especial: no se mejora.' }
  ];
  const SHOP_SLOTS = 4, REROLL = 3;
  // carreras de Retorno completadas (desbloquean personajes)
  const DONE_KEY = 'ceniza.carreras';
  function runsDone() { try { return Math.max(0, parseInt(localStorage.getItem(DONE_KEY) || '0', 10) || 0); } catch (e) { return 0; } }

  // Sitios del mapa (nombres para los enfrentamientos; inventados)
  const PLACES = ['Granja del arroyo', 'Taller de la ruta', 'Depósito ferroviario', 'Escuela del barrio', 'Estación de servicio', 'Aserradero',
    'Oficina del primer piso', 'Mercado cubierto', 'Galpón portuario', 'Clínica vieja', 'Biblioteca municipal', 'Planta de agua'];

  // ---------- Desafíos ----------
  // Cada uno cuenta una vez por carrera. Al completarlo, las recompensas del enfrentamiento en el que lo hiciste
  // (piezas, suplementos y monedas) se multiplican según lo difícil que es (si haces varios, se suman). Los
  // difíciles, además, tienen una probabilidad baja de dejar un arma (una sola) sobre un mueble del refugio.
  // Se cuenta también cuántas veces los has hecho en total (en el menú de Desafíos)
  const LEVEL = { facil: { name: 'Fácil', mult: 1.15 }, media: { name: 'Media', mult: 1.3 }, dificil: { name: 'Difícil', mult: 1.5 } };
  const GIFT_P = 0.2;          // probabilidad de arma con un desafío difícil
  const CHALLENGES = [
    { id: 'sigilo_chasq', name: 'Silencio mortal', lv: 'dificil', text: 'Mata a un chasqueador por la espalda sin que se entere.' },
    { id: 'molotov_temb', name: 'Fuego al gigante', lv: 'media', text: 'Mata a un temblante con una molotov.' },
    { id: 'cabezas', name: 'Puntería', lv: 'media', text: 'Mata a 5 infectados de un disparo en la cabeza en un mismo enfrentamiento.' },
    { id: 'remates', name: 'Sin piedad', lv: 'facil', text: 'Remata a 3 infectados aturdidos en un mismo enfrentamiento.' },
    { id: 'intacta', name: 'Ni un rasguño', lv: 'dificil', text: 'Supera una oleada de un asalto sin recibir daño.' },
    { id: 'cazador', name: 'Cazadora', lv: 'facil', text: 'Elimina a 15 infectados en una caza.' },
    // contra los Escorpiones (y la resistencia)
    { id: 'esc_sigilo', esc: true, name: 'Fantasma', lv: 'dificil', text: 'Abre la caja fuerte de un saqueo sin que los Escorpiones te descubran.' },
    { id: 'saqueo_rapido', esc: true, name: 'Golpe limpio', lv: 'media', text: 'Abre la caja fuerte de un saqueo con más de 2 minutos de margen.' },
    { id: 'esc_lider', esc: true, name: 'Cortar la cabeza', lv: 'media', text: 'Mata al líder de los Escorpiones antes que a ningún otro de su grupo.' },
    { id: 'esc_rehen', esc: true, name: 'Escudo humano', lv: 'media', text: 'Mata a un escorpión mientras tienes a otro de rehén.' },
    { id: 'esc_perdon', esc: true, name: 'Misericordia', lv: 'facil', text: 'Deja ir a 2 escorpiones que se rindan en un mismo enfrentamiento.' },
    { id: 'esc_golpes', esc: true, name: 'Cuerpo a cuerpo', lv: 'media', text: 'Mata a 3 escorpiones cuerpo a cuerpo en un mismo enfrentamiento.' },
    { id: 'esc_fuga', esc: true, name: 'Que no escape', lv: 'media', text: 'En un asalto de los Escorpiones, mata al que huye a buscar a su grupo antes de que escape.' },
    { id: 'lib_sigilo', esc: true, name: 'Sin alarma', lv: 'dificil', text: 'Completa una liberación sin que salte la alarma de la sede.' },
    { id: 'resist_entero', esc: true, name: 'Guardaespaldas', lv: 'dificil', text: 'Termina una resistencia con tu compañero por encima del 75 % de vida.' },
    // jefe final (multiplican el puntaje de la batalla)
    { id: 'jefe_rapido', boss: true, name: 'Contra reloj', lv: 'dificil', text: 'Vence al jefe final en menos de 4 minutos desde que sale el hongomorfo.' },
    { id: 'jefe_vida', boss: true, name: 'Sin un rasguño', lv: 'dificil', text: 'Vence al jefe final sin recibir daño.' },
    { id: 'jefe_blindado', boss: true, name: 'Primero la lata', lv: 'dificil', text: 'Mata al blindado antes que al hongomorfo.' },
    { id: 'jefe_esquiva', boss: true, name: 'Bailarina', lv: 'media', text: 'Esquiva 3 agarres del hongomorfo en la misma batalla.' },
    { id: 'jefe_fuego', boss: true, name: 'A la brasa', lv: 'media', text: 'Acaba con el hongomorfo con fuego.' },
    { id: 'jefe_salon', boss: true, name: 'Salón en pie', lv: 'media', text: 'Vence al jefe final con 5 máquinas o menos destruidas.' }
  ];
  // Logros: para siempre (en Retorno y en la batalla de prueba del modo libre)
  const ACHIEVEMENTS = [
    { id: 'hongo', name: 'Cazahongos', text: 'Vence al hongomorfo.' },
    { id: 'huida', name: 'No era un asalto', text: 'Sal con vida de una huida: un asalto en el que aparece la otra facción.' },
    { id: 'carrera', name: 'De vuelta a casa', text: 'Completa una carrera de Retorno.' },
    { id: 'blindado', name: 'Abrelatas', text: 'Mata al blindado.' },
    { id: 'esquiva', name: 'Por los pelos', text: 'Esquiva un agarre del hongomorfo.' },
    { id: 'demolicion', name: 'Fin de la partida', text: 'Deja que el hongomorfo destroce 10 máquinas en una misma batalla.' },
    { id: 'intocable', name: 'Intocable', text: 'Vence al jefe final sin recibir daño.' },
    { id: 'maestro', name: 'Dueña del salón', text: 'Completa alguna vez todos los desafíos del jefe final.' },
    { id: 'picadura', name: 'Primera picadura', text: 'Mata a tu primer escorpión.' },
    { id: 'exterminio', name: 'Plaga', text: 'Mata a 50 escorpiones (en total).' },
    { id: 'saqueo', name: 'Ladrona de cajas', text: 'Abre una caja fuerte de los Escorpiones.' },
    { id: 'fantasma', name: 'Nadie te vio', text: 'Abre una caja fuerte sin que los Escorpiones te descubran.' },
    { id: 'rehen', name: 'Moneda de cambio', text: 'Toma a un escorpión de rehén.' },
    { id: 'clemencia', name: 'Clemencia', text: 'Deja ir a un escorpión que se rinde.' },
    { id: 'sin_trato', name: 'Sin trato', text: 'Ejecuta a un rehén.' },
    { id: 'venganza', name: 'Que vengan todos', text: 'Supera un asalto de los Escorpiones (las tres oleadas).' },
    { id: 'guardaespaldas', name: 'Fiel compañía', text: 'Completa una resistencia.' },
    { id: 'liberacion', name: 'Nadie se queda atrás', text: 'Completa una liberación en la Red del Capitolio.' },
    { id: 'rejas', name: 'Fuera rejas', text: 'Libera a un Superviviente de su celda.' },
    { id: 'cuatro', name: 'De todo un poco', text: 'Completa alguna vez las cuatro modalidades: asalto, caza, saqueo y resistencia.' },
    // partida diaria: uno por personaje (el que te tocó ese día)
    { id: 'diaria_vera', big: true, name: 'La sombra del puerto', text: 'Completa una partida diaria con Vera.' },
    { id: 'diaria_tomas', big: true, name: 'Nada que no se arregle', text: 'Completa una partida diaria con Tomás.' },
    { id: 'diaria_diarco', big: true, name: 'Puños vendados', text: "Completa una partida diaria con Di' Arco." },
    { id: 'diaria_booster', big: true, name: 'Treinta años y un día', text: 'Completa una partida diaria con Booster.' },
    { id: 'diaria_paula', big: true, name: 'Veterana de todas las guerras', text: 'Completa una partida diaria con la señora Paula.' }
  ];
  const AKEY = 'ceniza.logros';
  function achRecord() { try { return JSON.parse(localStorage.getItem(AKEY) || '{}') || {}; } catch (e) { return {}; } }
  const CKEY = 'ceniza.desafios';
  const GIFTS = ['revolver', 'doble', 'escopeta', 'rifle', 'arco', 'subfusil', 'lanzallamas'];
  function chalRecord() { try { return JSON.parse(localStorage.getItem(CKEY) || '{}') || {}; } catch (e) { return {}; } }

  let st = null;          // estado de la carrera (null: no hay)
  let inRefuge = false;
  let encMul = 1;             // lo que se lleva de la recompensa el enfrentamiento en curso (saqueo fallido: 0,25)

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rngOf(seed) { let x = seed >>> 0; return () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daySeed(day, salt) { let h = 2166136261; for (const c of 'retorno|' + day + '|' + (salt || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // lo difícil que es la columna k de un mapa de n (0 a 4 en la carrera normal; en la diaria, de 1 a 5)
  function tierOf(k, n, daily) { return daily ? 1 + k * 4 / Math.max(1, n - 1) : k; }

  function pickMap(rnd) { const L = G.Maps ? G.Maps.list() : []; return L.length ? L[Math.floor((rnd || Math.random)() * L.length)] : null; }
  function mapName(node) { const m = node && node.map && G.Maps && G.Maps.get(node.map); return m ? m.name : (node && node.place) || 'Campo de pruebas'; }
  // El mapa: dos líneas (una arriba y otra abajo) que llegan al jefe final. Al elegir el primer enfrentamiento
  // quedas en esa línea hasta el final. Cada línea tiene un desvío (sublínea) de dos enfrentamientos seguidos,
  // por si lo que viene en la tuya no te convence: sale de la línea, se juegan los dos y vuelve a ella.
  // Cada columna: [línea 0, línea 1, y los desvíos que pasan por ella]; subAt[L]: la columna donde empieza el
  // desvío de la línea L (de 1 a n - 2: nunca en la primera, y termina como mucho en la última)
  function makeMap(steps, rnd, daily) {
    steps = steps || STEPS; rnd = rnd || Math.random;
    const rI = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    // de las cuatro modalidades: asalto y caza (de infectados o de escorpiones), saqueo (solo escorpiones) y
    // resistencia (solo infectados)
    const pickT = () => { const r = rnd(); return r < 0.28 ? 'asalto' : (r < 0.56 ? 'caza' : (r < 0.78 ? 'saqueo' : 'resistencia')); };
    const other = (not) => { let t = pickT(); for (let i = 0; i < 5 && not.indexOf(t) >= 0; i++) t = pickT(); return t; };
    const rw = daily ? DAILY.reward : 1;
    const node = (k, type0, line, sub) => {
      const tier = tierOf(k, steps, daily), kk = Math.min(4, Math.round(tier));
      const map = pickMap(rnd);
      // en la Red del Capitolio, a menudo toca la liberación (el modo de ese mapa)
      const type = map === 'capitolio' && rnd() < 0.6 ? 'liberacion' : type0;
      return {
        type, map, line, sub: !!sub,
        humans: type === 'saqueo' || type === 'liberacion' || ((type === 'asalto' || type === 'caza') && rnd() < 0.4),
        time: type === 'caza' ? CAZA_T[kk] + (tier > 4 ? 15 : 0) : (type === 'resistencia' ? 180 + Math.round(tier * 15) : (type === 'saqueo' ? 210 : 0)),
        // recompensa (en el cofre del refugio): las monedas cuestan de ganar; más cuanto más cerca del jefe
        // final y en la caza (más difícil). El asalto da más piezas
        piezas: Math.round(((type === 'asalto' ? 50 : (type === 'saqueo' || type === 'liberacion' ? 60 : (type === 'resistencia' ? 45 : 35))) + tier * 10 + rI(0, 2) * 5) * rw),
        suplementos: Math.round((50 + tier * 8 + rI(0, 4) * 5) * rw),
        monedas: Math.round((13 + tier * 4 + (type === 'caza' || type === 'resistencia' ? 2 : (type === 'saqueo' || type === 'liberacion' ? 4 : 0)) + rI(0, 1)) * rw)
      };
    };
    const subAt = [rI(1, steps - 2), 0];
    subAt[1] = rI(1, steps - 2);
    for (let t = 0; t < 6 && subAt[1] === subAt[0] && steps > 3; t++) subAt[1] = rI(1, steps - 2);
    const cols = [];
    for (let k = 0; k < steps; k++) {
      const a = pickT(), b = other([a]);
      const col = [node(k, a, 0, false), node(k, b, 1, false)];
      // el desvío: distinto de lo que hay en su línea en esa columna
      for (const L of [0, 1]) if (k === subAt[L] || k === subAt[L] + 1) col.push(node(k, other([col[L].type]), L, true));
      cols.push(col);
    }
    return { cols, subAt };
  }

  // 4 cosas al azar (sin repetir, sin armas que ya tengas)
  function makeShop(player) {
    const out = [], pool = {};
    const fuel = player && player.perks ? player.perks.fuel : 1;
    for (const s of SHOP) {
      if (s.weapon && player && player.weapons.some((w) => w.id === s.id)) continue;
      // (la señora Paula: ni escopetas ni rifles a la venta, y el combustible sale mucho más)
      if (player && player.canUse && !player.canUse(s.id)) continue;
      if (fuel > 1 && (s.id === 'mun_cartucho' || s.id === 'mun_rifle')) continue;
      pool[s.id] = s.p * (s.id === 'mun_gas' ? fuel * 1.6 : 1);
    }
    // siempre algo ya fabricado (venda, molotov, mina o humo) y algo de munición; como mucho 2 armas
    const isW = (id) => SHOP.find((s) => s.id === id).weapon;
    const take = (filter) => {
      const sub = {}; for (const k in pool) if (filter(k)) sub[k] = pool[k];
      if (!Object.keys(sub).length) return;
      const id = U.weighted(Math.random, sub); delete pool[id]; out.push({ id, left: 1 });
    };
    take((k) => k === 'venda' || k === 'molotov' || k === 'mina' || k === 'humo');
    take((k) => k.indexOf('mun_') === 0);
    while (out.length < SHOP_SLOTS && Object.keys(pool).length) {
      const nw = out.filter((o) => isW(o.id)).length;
      if (nw >= 2) for (const k in pool) if (isW(k)) delete pool[k];
      if (!Object.keys(pool).length) break;
      const id = U.weighted(Math.random, pool);
      delete pool[id];
      out.push({ id, left: 1 });
    }
    return out;
  }

  // ---------- Inventario (entre el refugio y los enfrentamientos) ----------
  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
  function snapshot(p) {
    // Di' Arco: lo que no lleva encima se queda en el armero del refugio (fuera de él no lo tiene a mano)
    const stored = p.packless && !inRefuge && st ? clone(st.rack || []) : clone(p.stored);
    return {
      hands: clone(p.hands), stored, items: clone(p.items), ammo: clone(p.ammo),
      backpack: !!p.backpack, silencers: p.silencers || 0, arrowExp: !!p.arrowExp, throwable: p.throwable || null,
      health: p.health
    };
  }
  function restore(p, s) {
    if (!s) return;
    p.hands = clone(s.hands) || [];
    while (p.hands.length < 5) p.hands.push(null);
    p.stored = (clone(s.stored) || []).filter(Boolean);
    if (p.packless) {
      if (st) st.rack = clone(p.stored);
      if (!inRefuge) p.stored = [];             // (en un enfrentamiento: solo lo que lleva encima)
    }
    for (const k in s.items) p.items[k] = s.items[k];
    for (const k in s.ammo) p.ammo[k] = s.ammo[k];
    p.backpack = s.backpack !== false && !p.packless; p.silencers = s.silencers || 0; p.arrowExp = !!s.arrowExp; p.throwable = s.throwable || null;
    // se llega como se estaba (la vida no se llena sola al volver al refugio)
    if (s.health != null) { p.health = Math.max(1, Math.min(100, s.health)); p.heal = 0; }
    // las armas de fuego no traen más balas de las que caben ahora en el cargador
    for (const h of p.hands.concat(p.stored)) if (h && h.mag != null) h.mag = Math.min(h.mag, G.Weapons.get(h.id).mag);
    // (partidas viejas: las armas de fuego ya no se rompen)
    for (const h of p.hands.concat(p.stored)) if (h && G.Weapons.isGun(G.Weapons.get(h.id))) { h.broken = false; h.cond = 1; }
    p.cur = -1; p.prev = -1;
    G.Models.setBackpack(p.model, p.backpack);
    p.refreshModel();
  }

  function save() {
    if (!st || st.free) return;           // el modo libre no se guarda
    try { localStorage.setItem(st.daily ? DKEY : KEY, JSON.stringify(st)); } catch (e) { /* sin guardado */ }
  }
  // daily: la carrera diaria guardada (si no, la normal)
  function readSave(daily) {
    try { const t = localStorage.getItem(daily ? DKEY : KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  // la partida diaria de hoy: ¿ya se jugó?
  function dayRec() { try { const r = JSON.parse(localStorage.getItem(DSTATE) || 'null'); return r && typeof r === 'object' ? r : null; } catch (e) { return null; } }
  function setDay(o) { try { localStorage.setItem(DSTATE, JSON.stringify(o)); } catch (e) { /* nada */ } }
  // cómo terminó la diaria (si es la de hoy)
  function dayResult(run, res) { const r = dayRec(); if (run && run.daily && r && r.day === run.daily && r.res !== 'completada') { r.res = res; setDay(r); } }

  // Lo que trae un arma al comprarla: como mucho 12 balas entre el cargador y la reserva, según el arma (las
  // de cargador grande vienen a medias; las de pocas balas traen alguna de repuesto)
  const BUY_ROUNDS = { pistola: [9, 12], revolver: [8, 12], escopeta: [6, 9], doble: [6, 9], rifle: [5, 8], arco: [6, 9], subfusil: [6, 9] };
  function buyRounds(w) {
    if (w.gun === 'flame') return { load: w.mag, spare: 0 };
    const r = BUY_ROUNDS[w.id] || [6, 12];
    const total = Math.min(12, r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1)));
    const load = Math.min(w.mag, total);
    return { load, spare: total - load };
  }

  // suma lo de un enfrentamiento a la carrera (para el puntaje final y la clasificación)
  const SUM = ['kills', 'time', 'head', 'shots', 'hits', 'melee', 'exec', 'hurt', 'stealth'];
  function addStats(stats) {
    if (!st || !stats) return;
    for (const k of SUM) st.totals[k] = (st.totals[k] || 0) + (stats[k] || 0);
    if (stats.bossTime) st.totals.bossTime = stats.bossTime;
  }

  // ---------- Clasificación: los récords propios de este navegador ----------
  // Cada récord guarda el valor, con qué personaje y cuándo. Se anota al terminar cada carrera de Retorno
  // (completada, muerta o abandonada); el tiempo es el de los enfrentamientos (el refugio no cuenta).
  const RKEY = 'ceniza.clasificacion';
  const RECS = [
    { id: 'rapida', name: 'Carrera más rápida', low: true, done: true, fmt: 'time' },
    { id: 'jefe', name: 'Jefe final más rápido', low: true, done: true, fmt: 'time' },
    { id: 'puntaje', name: 'Mejor puntaje de carrera', fmt: 'n' },
    { id: 'enc', name: 'Mejor puntaje en un enfrentamiento', fmt: 'n' },
    { id: 'bajas', name: 'Más infectados en una carrera', fmt: 'n' },
    { id: 'cabeza', name: 'Más disparos a la cabeza', fmt: 'n' },
    { id: 'cuerpo', name: 'Más bajas cuerpo a cuerpo', fmt: 'n' },
    { id: 'remates', name: 'Más remates', fmt: 'n' },
    { id: 'precision', name: 'Mejor precisión (40 disparos o más)', fmt: 'pct' },
    { id: 'ileso', name: 'Menos daño recibido (carrera completa)', low: true, done: true, fmt: 'hp' },
    { id: 'lejos', name: 'Más lejos', fmt: 'step' }
  ];
  const Records = {
    LIST: RECS,
    read() {
      let r = null; try { r = JSON.parse(localStorage.getItem(RKEY) || 'null'); } catch (e) { /* nada */ }
      r = r && typeof r === 'object' ? r : {};
      r.rec = r.rec || {}; r.runs = r.runs || 0; r.done = r.done || 0; r.kills = r.kills || 0; r.time = r.time || 0; r.chars = r.chars || {};
      return r;
    },
    write(r) { try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch (e) { /* sin almacenamiento */ } },
    // intenta mejorar un récord (devuelve true si es nuevo)
    put(r, id, v, char) {
      const d = RECS.find((x) => x.id === id);
      if (!d || v == null || !isFinite(v)) return false;
      const o = r.rec[id];
      if (o && (d.low ? v >= o.v : v <= o.v)) return false;
      r.rec[id] = { v, char, date: Date.now() };
      return true;
    },
    // enfrentamiento ganado: mejor puntaje en uno solo
    encounter(run, score) {
      if (!run || run.free) return;
      const r = this.read();
      if (this.put(r, 'enc', Math.round(score), run.char)) (run.newRec = run.newRec || []).push('enc');
      this.write(r);
    },
    // fin de la carrera. extra: lo del enfrentamiento en curso (si moriste o saliste a mitad)
    runEnded(run, extra, completed) {
      if (!run || run.free || run.recorded) return;
      run.recorded = true;
      const t = Object.assign({}, run.totals);
      if (extra) for (const k of SUM) t[k] = (t[k] || 0) + (extra[k] || 0);
      const r = this.read(), ch = run.char, nw = run.newRec = run.newRec || [];
      // la partida diaria (más larga y más difícil) se cuenta aparte: no compite con las marcas de la normal
      if (run.daily) {
        dayResult(run, completed ? 'completada' : 'perdida');
        const d = r.daily = r.daily || { runs: 0, done: 0, chars: {} };
        d.runs++; r.kills += t.kills || 0; r.time += t.time || 0;
        const c = d.chars[ch] = d.chars[ch] || { runs: 0, done: 0 };
        c.runs++;
        if (completed) {
          d.done++; c.done++;
          if (!d.best || t.time < d.best.v) { d.best = { v: Math.round(t.time || 0), char: ch, date: Date.now() }; nw.push('diaria'); }
        }
        if (!d.far || (completed ? DAILY_STEPS + 2 : (run.step || 0) + 1) > d.far) d.far = completed ? DAILY_STEPS + 2 : (run.step || 0) + 1;
        this.write(r);
        return;
      }
      const put = (id, v) => { if (this.put(r, id, v, ch)) nw.push(id); };
      r.runs++; r.kills += t.kills || 0; r.time += t.time || 0;
      const c = r.chars[ch] = r.chars[ch] || { runs: 0, done: 0 };
      c.runs++;
      if (completed) {
        r.done++; c.done++;
        put('rapida', Math.round(t.time || 0));
        if (t.bossTime) put('jefe', Math.round(t.bossTime));
        put('ileso', Math.round(t.hurt || 0));
      }
      put('puntaje', Math.round(t.score || 0));
      put('bajas', t.kills || 0);
      put('cabeza', t.head || 0);
      put('cuerpo', t.melee || 0);
      put('remates', t.exec || 0);
      if ((t.shots || 0) >= 40) put('precision', Math.round((t.hits || 0) / t.shots * 1000) / 10);
      put('lejos', completed ? STEPS + 2 : (run.step || 0) + 1);        // (STEPS + 1: llegó al jefe; + 2: completa)
      this.write(r);
    },
    reset() { try { localStorage.removeItem(RKEY); } catch (e) { /* nada */ } }
  };
  G.Records = Records;

  const Run = {
    BASE_STEPS: STEPS, DAILY_STEPS, DAILY, TYPES, SHOP, REROLL, mapName,
    // enfrentamientos antes del jefe en la carrera en curso (5; la diaria, 8)
    get STEPS() { return (st && st.steps) || STEPS; },
    get active() { return !!st; },
    get daily() { return !!(st && st.daily); },
    // lo difícil que es el enfrentamiento en curso (para el número y la dureza de los enemigos)
    get tier() { if (!st) return 2; const n = st.steps || STEPS; return st.daily ? Math.min(5.5, tierOf(st.step, n, true)) : st.step; },
    // nombre y textos de un camino del mapa (asalto y caza pueden ser de escorpiones)
    typeInfo(n) { if (!n) return TYPES.asalto; if (n.type === 'escuadron') return TYPES.saqueo; return (n.humans && TYPES[n.type + '_h']) || TYPES[n.type] || TYPES.asalto; },
    setEncMul(k) { encMul = k; },
    get st() { return st; },
    get inRefuge() { return inRefuge; },
    set inRefuge(v) { inRefuge = !!v; },
    get step() { return st ? st.step : 0; },
    get monedas() { return st ? st.monedas : 0; },
    get piezas() { return st ? st.piezas : 0; },
    get suplementos() { return st ? (st.suplementos || 0) : 0; },
    // recompensas esperando en el cofre del refugio (o null)
    get pending() { return st ? st.pending || null : null; },
    get done() { return !!st && st.step >= this.STEPS; },

    // ¿Hay una carrera guardada que se puede continuar? (si saliste en medio de un enfrentamiento, se perdió)
    // daily: la carrera diaria (si no, la normal)
    saveInfo(daily) {
      const s = readSave(daily);
      if (!s || s.v !== 1) return null;
      return { lost: !!s.inEnc, char: s.char, step: s.step, steps: s.steps || STEPS, daily: !!s.daily };
    },
    // carrera guardada que se pierde sin jugarla (salió a mitad de un enfrentamiento, o empieza otra): a la clasificación
    recordSaved(daily) { const s = readSave(daily); if (s && s.v === 1 && !s.free) Records.runEnded(s, null, !!s.bossWon); },
    // la carrera en curso termina (muerte o abandono); stats: lo del enfrentamiento a medias
    recordEnd(stats) { if (st) Records.runEnded(st, st.inEnc ? stats : null, !!st.bossWon); },
    // borra la carrera en curso (o la guardada: daily true / false)
    discard(daily) {
      const d = daily != null ? !!daily : !!(st && st.daily);
      if (!st || !!st.daily === d) { st = null; inRefuge = false; G.Weapons.applyUpgrades(null); }
      try { localStorage.removeItem(d ? DKEY : KEY); } catch (e) { /* nada */ }
    },

    // ---------- Partida diaria ----------
    // estado de la de hoy: { day, played (ya empezada hoy), res, char (el que toca), saved (hay una a medias), left (ms hasta medianoche) }
    dailyInfo() {
      const day = today(), r = dayRec(), sv = this.saveInfo(true);
      const end = new Date(); end.setHours(24, 0, 0, 0);
      return { day, played: !!(r && r.day === day), res: r && r.day === day ? r.res : null, char: r && r.day === day ? r.char : this.dailyChar(day),
        saved: sv && !sv.lost ? sv : null, lost: !!(sv && sv.lost), left: end - Date.now() };
    },
    // el personaje que toca hoy: uno de los desbloqueados, al azar (sale de la fecha)
    dailyChar(day) {
      const ids = Object.keys(G.Player.CHARS).filter((id) => this.unlocked(id));
      return ids[Math.floor(rngOf(daySeed(day || today(), 'pj'))() * ids.length)] || 'vera';
    },

    // Carrera nueva: solo con la pistola (cargador lleno y un cargador de reserva) y una venda.
    // daily: la partida diaria de hoy (8 enfrentamientos, el mapa sale de la fecha)
    newRun(charId, player, daily) {
      this.recordSaved(!!daily);
      const day = daily ? today() : null, steps = daily ? DAILY_STEPS : STEPS;
      const m = makeMap(steps, daily ? rngOf(daySeed(day, 'mapa')) : null, !!daily);
      st = {
        v: 1, char: charId, step: 0, steps, lines: true, subAt: m.subAt, path: [], map: m.cols, monedas: 4, piezas: 0, suplementos: 0, pending: null, up: {},
        inv: null, shop: [], crate: [], inEnc: false, enc: null, chal: {}, gifts: [],
        totals: { kills: 0, time: 0, score: 0 }, last: null
      };
      if (daily) { st.daily = day; setDay({ day, char: charId, res: 'jugando' }); }
      G.Weapons.applyUpgrades(st.up);
      if (player) {
        player.hands = [null, null, null, null, null]; player.stored = [];
        player.pickUp('pistola', G.Weapons.get('pistola').mag, 1);
        player.ammo['9mm'] = 6;
        player.items.venda = 1;
        this.charKit(player, st);
        player.equip(-1);
        st.inv = snapshot(player);
      }
      st.shop = makeShop(player);
      save();
    },
    // Lo que trae cada personaje de más al empezar. Di' Arco: el rifle (con la mejora de daño ya puesta) y dos minas.
    // Booster: solo la escopeta y dos molotov (sin pistola). La señora Paula: el lanzallamas con combustible (sin pistola)
    charKit(player, run) {
      if (!player) return;
      const R = run || st;
      const drop = (id) => { for (const i of [1, 2, 3, 4]) if (player.hands[i] && player.hands[i].id === id) player.hands[i] = null; };
      if (player.charId === 'booster') {
        drop('pistola'); player.ammo['9mm'] = 0;
        if (!player.weapons.some((w) => w.id === 'escopeta')) player.pickUp('escopeta', G.Weapons.get('escopeta').mag, 1);
        player.ammo.cartucho = Math.max(player.ammo.cartucho || 0, 6);
        player.items.molotov = Math.max(player.items.molotov || 0, 2);
        player.refreshModel && player.refreshModel();
        return;
      }
      if (player.charId === 'paula') {
        drop('pistola'); player.ammo['9mm'] = 0;
        if (!player.weapons.some((w) => w.id === 'lanzallamas')) player.pickUp('lanzallamas', G.Weapons.get('lanzallamas').mag, 1);
        player.ammo.gas = Math.max(player.ammo.gas || 0, Math.round(player.ammoCap('gas') * 0.6));
        player.refreshModel && player.refreshModel();
        return;
      }
      if (player.charId !== 'diarco') return;
      if (R) { R.up = R.up || {}; R.up.rifle = Object.assign({}, R.up.rifle, { dano: true }); G.Weapons.applyUpgrades(R.up); }
      if (!player.weapons.some((w) => w.id === 'pistola')) player.pickUp('pistola', G.Weapons.get('pistola').mag, 1);
      if (!player.weapons.some((w) => w.id === 'rifle')) player.pickUp('rifle', G.Weapons.get('rifle').mag, 1);
      player.ammo.rifle = Math.max(player.ammo.rifle || 0, 6);
      player.items.mina = Math.max(player.items.mina || 0, 2);
      player.backpack = false;
      player.refreshModel && player.refreshModel();
    },
    // Continuar la carrera guardada
    load(daily) {
      const s = readSave(daily);
      if (!s || s.v !== 1 || s.inEnc) return false;
      st = s;
      G.Weapons.applyUpgrades(st.up);
      return true;
    },
    save,

    // ---------- Refugio ----------
    // al llegar al refugio: llegas tal cual saliste del enfrentamiento (vida, balas y todo) y se guarda
    enterRefuge(player) {
      if (!st) return;
      inRefuge = true;
      st.inEnc = false; st.enc = null;
      G.Weapons.applyUpgrades(st.up);
      restore(player, st.inv);
      // el arma de un desafío difícil (si salió): espera sobre un mueble del refugio hasta que la cojas
      this.newGift = null;
      const give = (id, mag) => {
        if (player.weapons.some((w) => w.id === id)) return false;
        player.stored.push({ id, mag: mag != null ? mag : G.Weapons.get(id).mag, cond: 1 });
        return true;
      };
      if (st.gifts && st.gifts.length && !st.shelf) { st.shelf = st.gifts[0]; this.newGift = st.shelf; }
      st.gifts = [];
      // (partidas viejas: lo que quedaba en el cofre de antes va a la mochila)
      for (const c of st.crate || []) {
        const w = G.Weapons.get(c.id);
        if (w && w.cat === 'gun') give(c.id, c.cond); else player.takeItem(c.id, c.cond || 1);
      }
      st.crate = [];
      st.inv = snapshot(player);
      save();
    },
    // lo que llevas, otra vez encima (al empezar un enfrentamiento, tras reiniciar el mundo)
    restoreInv(player) { if (st) { G.Weapons.applyUpgrades(st.up); restore(player, st.inv); } },
    // guarda lo que llevas (cada vez que cambia algo en el refugio)
    keep(player) { if (!st || !player) return; st.inv = snapshot(player); save(); },

    // ---------- Mapa ----------
    choices() { return st && st.step < this.STEPS ? st.map[st.step] : []; },
    // los enfrentamientos de la columna actual que se pueden elegir (índices): al principio, el primero de cada
    // línea; luego, solo los de tu línea (y su desvío, donde sale; dentro del desvío, se sigue por él)
    allowed() {
      if (!st || st.step >= this.STEPS) return [];
      const col = st.map[st.step];
      if (!st.lines) return col.map((n, i) => i);          // (carreras guardadas de antes: como siempre)
      if (st.step === 0) return col.map((n, i) => (n.sub ? -1 : i)).filter((i) => i >= 0);
      const pn = st.map[st.step - 1][st.path[st.step - 1]], L = pn.line, s0 = st.subAt[L], out = [];
      col.forEach((n, i) => {
        if (n.line !== L) return;
        if (pn.sub) { if (st.step === s0 + 1 ? n.sub : !n.sub) out.push(i); }
        else if (!n.sub || st.step === s0) out.push(i);
      });
      return out;
    },
    // de dónde se llega al enfrentamiento i de la columna k (índices de la columna k - 1; -1: el refugio)
    preds(k, i) {
      if (!st) return [];
      if (k === 0) return [-1];
      const prev = st.map[k - 1];
      if (!st.lines) return prev.map((n, j) => j);
      const n = st.map[k][i], L = n.line, s0 = st.subAt[L];
      const mainI = prev.findIndex((x) => x.line === L && !x.sub), subI = prev.findIndex((x) => x.line === L && x.sub);
      if (n.sub) return [k === s0 ? mainI : subI];
      return k === s0 + 2 && subI >= 0 ? [mainI, subI] : [mainI];
    },
    // de dónde se llega al jefe final (índices de la última columna)
    bossPreds() {
      if (!st) return [];
      const n = this.STEPS, last = st.map[n - 1];
      if (!st.lines) return last.map((x, j) => j);
      return last.map((x, j) => (!x.sub || st.subAt[x.line] + 1 === n - 1 ? j : -1)).filter((j) => j >= 0);
    },
    // empieza el enfrentamiento i de la columna actual (queda marcado: salir a mitad pierde la carrera)
    beginEncounter(i, player) {
      if (!st || st.step >= this.STEPS) return null;
      const node = st.map[st.step][i];
      if (!node || this.allowed().indexOf(i) < 0) return null;
      st.inv = snapshot(player);
      if (!node.map || !(G.Maps && G.Maps.get(node.map))) node.map = pickMap();
      st.enc = { col: st.step, i, type: node.type, time: node.time, map: node.map, humans: !!node.humans };
      st.encBonus = 0; st.encChal = [];
      st.inEnc = true;
      inRefuge = false;
      save();
      return st.enc;
    },
    get encounter() { return st ? st.enc : null; },
    // el jefe final (tras los cinco enfrentamientos): siempre en el salón recreativo
    BOSS_MAP: 'arcade',
    beginBoss(player) {
      if (!st || st.step < this.STEPS) return null;
      st.inv = snapshot(player);
      st.enc = { boss: true, type: 'jefe', map: 'arcade' };
      st.encBonus = 0; st.encChal = [];
      st.inEnc = true;
      inRefuge = false;
      save();
      return st.enc;
    },
    // jefe derrotado: la carrera termina (se suma al total)
    winBoss(player, score, stats) {
      if (!st || !st.enc || !st.enc.boss) return null;
      st.totals.score += Math.round((score || 0) * (1 + (st.encBonus || 0)));     // (los desafíos del jefe lo multiplican)
      addStats(stats);
      Records.runEnded(st, null, true);
      // carreras completadas (para desbloquear personajes: la señora Paula, con 3)
      if (!st.bossWon) {
        const n0 = runsDone();
        try { localStorage.setItem(DONE_KEY, String(n0 + 1)); } catch (e) { /* nada */ }
        st.unlockedNow = Object.keys(G.Player.CHARS).filter((id) => G.Player.CHARS[id].lock && n0 < G.Player.CHARS[id].lock && n0 + 1 >= G.Player.CHARS[id].lock);
      }
      st.bossWon = true;
      st.inEnc = false;
      save();
      if (st.daily) { this.dailyWon = this.achieve('diaria_' + st.char) || ACHIEVEMENTS.find((a) => a.id === 'diaria_' + st.char) || null; }
      return st.totals;
    },
    get bossWon() { return !!(st && st.bossWon); },
    runsDone,
    // ¿se puede elegir este personaje? (lock: carreras completadas que hacen falta)
    unlocked(id) { const c = G.Player.CHARS[id]; return !!c && !c.dev && (!c.lock || runsDone() >= c.lock); },   // (dev: en desarrollo)
    get unlockedNow() { return (st && st.unlockedNow) || []; },
    // enfrentamiento superado: las recompensas (piezas, suplementos y monedas) esperan en el cofre del refugio
    winEncounter(player, score, stats) {
      if (!st || !st.enc) return null;
      const e = st.enc, node = st.map[e.col][e.i];
      // desafíos completados en este enfrentamiento: multiplican lo que da (se suman entre sí)
      // (saqueo sin abrir la caja a tiempo: un cuarto)
      const mult = (1 + (st.encBonus || 0)) * (encMul || 1);
      encMul = 1;
      const got = {
        piezas: Math.round(node.piezas * mult),
        suplementos: Math.round((node.suplementos != null ? node.suplementos : 50 + e.col * 8) * mult),
        monedas: Math.round((node.monedas != null && node.monedas <= 60 ? node.monedas : 13 + e.col * 4) * mult),
        place: mapName(node), type: e.type, mult: Math.round(mult * 100) / 100, chals: (st.encChal || []).slice()
      };
      st.encBonus = 0; st.encChal = [];
      const p = st.pending;
      if (p) { p.piezas += got.piezas; p.suplementos += got.suplementos; p.monedas += got.monedas; p.place = got.place; p.type = got.type; p.mult = got.mult; p.chals = got.chals; }
      else st.pending = Object.assign({}, got);
      st.path.push(e.i);
      st.step++;
      st.totals.score += score || 0;
      addStats(stats);
      Records.encounter(st, score || 0);
      st.inv = snapshot(player);
      st.shop = makeShop(player);
      st.last = got;
      // el enfrentamiento ya terminó: si sales ahora, se continúa desde el refugio
      st.inEnc = false;
      save();
      return got;
    },

    // recoger lo del cofre del refugio
    takeRewards(player) {
      const p = st && st.pending;
      if (!p) return null;
      st.piezas += p.piezas; st.suplementos = (st.suplementos || 0) + p.suplementos; st.monedas += p.monedas;
      st.pending = null;
      if (player) st.inv = snapshot(player);
      save();
      return p;
    },

    // ---------- Comercio ----------
    // (la señora Paula: no le ofrecen escopetas ni rifles, y el combustible le sale más barato y en más cantidad)
    shopList() {
      if (!st) return [];
      const paula = st.char === 'paula', NO = { escopeta: 1, doble: 1, rifle: 1, mun_cartucho: 1, mun_rifle: 1 };
      return st.shop.filter((o) => SHOP.some((s) => s.id === o.id) && !(paula && NO[o.id])).map((o) => Object.assign({}, SHOP.find((s) => s.id === o.id), { left: o.left },
        paula && o.id === 'mun_gas' ? { price: 2, n: 30, desc: 'Combustible para el lanzallamas (Paula consigue más y más barato).' } : {}, st.free ? { price: 0 } : {}));
    },
    // los dados: vuelve a sortear lo que hay a la venta (cuesta monedas)
    rerollWhyNot() { if (!st || st.free) return 'No disponible'; return st.monedas < REROLL ? 'Te faltan monedas' : null; },
    reroll(player) {
      const no = this.rerollWhyNot();
      if (no) return { msg: no, fail: true };
      st.monedas -= REROLL;
      st.shop = makeShop(player);
      this.keep(player);
      if (G.Audio) G.Audio.play('pickup');
      return { msg: 'El puesto de comercio cambió' };
    },
    // Modo libre: comercio y banco de mejoras gratis (todo a la venta, sin gastar nada). No se guarda
    get free() { return !!(st && st.free); },
    startFree(charId) {
      st = {
        v: 1, free: true, char: charId, step: 0, path: [], map: makeMap().cols, monedas: 0, piezas: 0, up: {},
        inv: null, shop: SHOP.map((s) => ({ id: s.id, left: 99 })), crate: [], inEnc: false, enc: null, chal: {}, gifts: [],
        totals: { kills: 0, time: 0, score: 0 }, last: null
      };
      inRefuge = false;
      G.Weapons.applyUpgrades(st.up);
    },
    endFree() { if (st && st.free) { st = null; inRefuge = false; G.Weapons.applyUpgrades(null); } },
    // por qué no se puede comprar (o null)
    whyNot(o, player) {
      if (!o || o.left <= 0) return 'Agotado';
      if (st.monedas < o.price) return 'Te faltan monedas';
      if (o.weapon) return player.weapons.some((w) => w.id === o.id) ? 'Ya la tienes' : (player.spotFor(o.id) ? null : (player.canUse && !player.canUse(o.id) ? 'No la usa' : 'Sin espacio'));
      if (o.id === 'molotov') return player.fullOf('molotov') ? 'No te caben más' : null;
      return player.itemRoom(o.id) > 0 ? null : 'No te caben más';
    },
    buy(id, player) {
      if (!st) return null;
      const o = this.shopList().find((x) => x.id === id);
      const no = this.whyNot(o, player);
      if (no) return { msg: no, fail: true };
      let msg;
      if (o.weapon) {
        const w = G.Weapons.get(o.id);
        const b = buyRounds(w);
        const r = player.pickUp(o.id, b.load, 1);
        if (!r.ok) return { msg: 'Sin espacio', fail: true };
        let extra = 0;
        if (b.spare && G.Weapons.AMMO[w.ammo]) { extra = Math.max(0, Math.min(b.spare, player.ammoCap(w.ammo) - (player.ammo[w.ammo] || 0))); player.ammo[w.ammo] = (player.ammo[w.ammo] || 0) + extra; }
        player.equip(-1);
        msg = 'Compraste: ' + w.name + (w.gun !== 'flame' ? ' (' + (b.load + extra) + ' ' + (w.gun === 'bow' ? 'flechas' : 'balas') + ')' : '');
        // (Booster: la larga que llevaba queda sobre el mueble del refugio, para cambiarla otra vez si quiere)
        if (r.old && !r.old.broken) { if (!st.shelf) { st.shelf = r.old.id; msg += ' · dejaste ' + G.Weapons.get(r.old.id).name.toLowerCase() + ' en el refugio'; } }
      } else if (o.id === 'molotov') {
        player.items.molotov = (player.items.molotov || 0) + 1; msg = 'Compraste una molotov';
      } else {
        const r = player.takeItem(o.id, o.n);
        msg = 'Compraste: ' + (o.n > 1 ? o.n + ' ' : '') + o.name.toLowerCase() + (r.left > 0 ? ' (no te cabía todo)' : '');
      }
      st.monedas -= o.price;
      const so = st.shop.find((x) => x.id === id);
      if (!st.free) so.left = 0;
      this.keep(player);
      if (G.Audio) G.Audio.play('pickup');
      return { msg };
    },

    // ---------- Mejoras ----------
    upgraded(wid, uid) { return !!(st && st.up[wid] && st.up[wid][uid]); },
    upgradeWhyNot(wid, u) {
      if (!st) return 'Sin carrera';
      if (this.upgraded(wid, u.id)) return 'Mejorada';
      if (u.req && !this.upgraded(wid, u.req)) return 'Antes: ' + G.Weapons.UPGRADES[wid].find((x) => x.id === u.req).name;
      if (!st.free && st.piezas < u.cost) return 'Te faltan piezas';
      return null;
    },
    upgrade(wid, uid, player) {
      const u = (G.Weapons.UPGRADES[wid] || []).find((x) => x.id === uid);
      if (!u) return { msg: 'No existe', fail: true };
      const no = this.upgradeWhyNot(wid, u);
      if (no) return { msg: no, fail: true };
      if (!st.free) st.piezas -= u.cost;
      (st.up[wid] || (st.up[wid] = {}))[uid] = true;
      G.Weapons.applyUpgrades(st.up);
      // con más capacidad, el cargador se llena gratis (como en el banco del vídeo de referencia)
      if (uid === 'capacidad') for (const h of player.hands.concat(player.stored)) if (h && h.id === wid) h.mag = G.Weapons.get(wid).mag;
      this.keep(player);
      return { msg: G.Weapons.get(wid).name + ': ' + u.name + ' mejorada' };
    },

    // ---------- Cofre de recompensas ----------
    get crate() { return st ? st.crate : []; },

    // ---------- Desafíos ----------
    CHALLENGES, LEVEL, ACHIEVEMENTS,
    achieved(id) { return !!achRecord()[id]; },
    // logro nuevo: lo devuelve (null si ya lo tenías)
    achieve(id) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      const rec = achRecord();
      if (!a || rec[id]) return null;
      rec[id] = Date.now();
      try { localStorage.setItem(AKEY, JSON.stringify(rec)); } catch (e) { /* nada */ }
      return a;
    },
    // el arma esperando sobre un mueble del refugio (o null) y cogerla
    get shelf() { return st ? st.shelf || null : null; },
    takeShelf(player) {
      const id = st && st.shelf;
      if (!id) return null;
      const w = G.Weapons.get(id);
      if (player.weapons.some((x) => x.id === id)) { st.shelf = null; this.keep(player); return 'Ya tienes ' + w.name.toLowerCase(); }
      const r = player.pickUp(id, w.mag, 1);
      if (!r || !r.ok) player.stored.push({ id, mag: w.mag, cond: 1 });
      st.shelf = null;
      this.keep(player);
      if (G.Audio) G.Audio.play('pickup');
      return 'Cogiste: ' + w.name;
    },
    chalDone(id) { return !!(st && st.chal && st.chal[id]); },
    chalTimes(id) { return chalRecord()[id] || 0; },
    // completar un desafío (en una carrera): una sola vez por carrera. Multiplica las recompensas de este
    // enfrentamiento; si es difícil, a veces deja un arma (una sola, y solo si no hay ya otra esperando)
    challenge(id, player) {
      const c = CHALLENGES.find((x) => x.id === id);
      if (!st || !c) return null;
      st.chal = st.chal || {}; st.gifts = st.gifts || [];
      if (st.chal[id]) return null;
      st.chal[id] = true;
      const rec = chalRecord(); rec[id] = (rec[id] || 0) + 1;
      try { localStorage.setItem(CKEY, JSON.stringify(rec)); } catch (e) { /* nada */ }
      const L = LEVEL[c.lv] || LEVEL.facil;
      st.encBonus = (st.encBonus || 0) + (L.mult - 1);
      (st.encChal || (st.encChal = [])).push(c.name);
      let gift = null;
      if (c.lv === 'dificil' && !st.shelf && !st.gifts.length && Math.random() < GIFT_P) {
        const have = new Set(player ? player.weapons.map((w) => w.id) : []);
        const pool = GIFTS.filter((g) => !have.has(g));
        if (pool.length) { gift = pool[Math.floor(Math.random() * pool.length)]; st.gifts.push(gift); }
      }
      save();
      return { gift, c, mult: L.mult, total: Math.round((1 + st.encBonus) * 100) / 100 };
    },

    // ---------- Final ----------
    get totals() { return st ? st.totals : null; },
    get last() { return st ? st.last : null; }
  };

  G.Run = Run;
})(window.Game = window.Game || {});
