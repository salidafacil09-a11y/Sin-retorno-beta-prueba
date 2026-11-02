# Proyecto Retorno

Juego de acción y supervivencia zombi para navegador con cámara en tercera persona al hombro, rumbo a un modo de encuentros cerrados tipo "sin retorno". Ahora mismo es una beta de pruebas de mecánicas en un mundo pequeño y plano: combate cuerpo a cuerpo y con armas de fuego, infectados muy agresivos y un modo desarrollador para probar. Funciona en PC, en móvil y con mando.

> Antes se llamaba "Ceniza" (survival de mundo abierto); el código de esa etapa sigue guardado. Es un proyecto inspirado en el género; todo el arte, el código y los nombres son propios.

## Estado

**Bloque 1: base y zombis lentos**
- Zombis lentos que caminan al azar; te persiguen si te ven de frente o si corres cerca

**Bloque 2: mundo infinito**
- Chunks de 32x32 que se generan al acercarte; lo que dejas atrás se conserva
- Los zombis lejanos se duermen y despiertan donde los dejaste

**Bloque 3: tercera persona, casas y combate**
- Cámara sobre el hombro que se acerca al apuntar y no atraviesa paredes, techos ni puertas
- Gráficos más suaves: personajes redondeados con esqueleto, sombras, niebla, texturas de suelo, techos a dos aguas
- Paredes finas entre casillas, como en el original
- 5 tipos de vivienda (4 casas y una cabaña) con varias habitaciones, girados hacia la calle
- 3 edificios raros: estación de bomberos, comisaría y hospital (en torno al 1,5 % de los edificios)
- Puertas que se abren y cierran, ventanas que se abren y por las que se puede saltar, vallas que se saltan
- Interruptor de luz en cada habitación y lámparas de techo que iluminan de verdad
- Farolas, aceras con bordillo, árboles y pinos grandes, arbustos
- 23 armas cuerpo a cuerpo repartidas por las casas según la habitación
- Combate: apuntar, golpes múltiples, críticos, derribos, empujón, pisotón, ataque al suelo, remate con cuchillo, desgaste y rotura de armas
- Zombis que agarran, arañan, hacen laceraciones y muerden; los mordiscos infectan. Si te rodean cuatro, te derriban
- Los zombis golpean puertas hasta romperlas, rompen ventanas y trepan por ventanas y vallas

**Bloque 3.1: sigilo y objetivo**
- Agacharse: andas más despacio, no haces ruido al caminar y tus golpes y puertas suenan a la mitad
- De pie te ven a 14 m al instante; agachado solo a 6 m y tardan cerca de un segundo en notarte (de muy cerca, al momento)
- Caminando de pie te oyen solo a 2 m (a tu espalda); agachado, nada. Correr te levanta y se oye a 7 m
- Si un zombi ya te persigue, agacharte no lo despista: primero rompe su línea de visión
- Contorno amarillo en el zombi al que apuntas (en móvil, en el que tienes a tu alcance delante)

**Bloque 3.2: animaciones y armas**
- Animaciones más fluidas y rápidas: transiciones suaves entre poses, golpes que aceleran hasta el impacto, cadera y hombros que se balancean, respiración en reposo, cabeza que compensa el giro
- Agarre a una o dos manos: un arma corta a dos manos hace un 15 % más de daño; una larga con una mano hace un 25 % menos, es más lenta y solo golpea a un zombi
- Armas largas: máximo 2, una en las manos y otra a la espalda (se ve en el personaje). Armas cortas: en los bolsillos, sin límite
- Soltar el arma de las manos

**Bloque 3.3: controles y más**
- HUD al estilo de los shooters de móvil: vida (línea blanca) y armas abajo al centro, joystick fijo con bloqueo de carrera, botones con iconos, botón contextual Abrir/Cerrar/Encender/Coger, Empujar junto a Atacar
- Pecho a tierra: te arrastras despacio, no haces ruido y solo te ven a 3,5 m (y tardan más en notarte). Tumbado no puedes atacar y te muerden con más facilidad
- Movimiento omnidireccional: correr y caminar en cualquier dirección con inercia; al apuntar, el torso mira al frente y la cadera gira hacia donde vas (también hacia atrás)
- Tras un empujón el zombi tarda 2 segundos más en levantarse
- Remate en el suelo: al golpear a un zombi caído, el personaje se acerca, se arrodilla y golpea, con plano de cine
- Agarre a dos manos con la mano izquierda realmente sobre el mango
- El metal pega un 12 % más; la madera un 10 % menos
- Muchos menos zombis: el 12 % de los chunks tiene una horda como antes; el resto, muy pocos. Muchos aparecen dentro de las casas y no salen de su habitación hasta oír un ruido o verte
- Ventanas: se abren y se cierran con Abrir; se salta por ellas con Saltar

**Bloque 3.4: esqueleto nuevo**
- 22 huesos (antes 17): columna en tres tramos, clavículas y dedos del pie. Sin dedos de la mano ni cara
- Piel suavizada: codos, rodillas, hombros, cadera y cintura se doblan repartidos entre dos huesos, sin cortes
- Las animaciones usan los huesos nuevos: la espalda se curva por tramos, los hombros acompañan al estirar, empujar y apuntar, y el pie rueda al pisar
- Nombres de huesos fáciles de emparejar con esqueletos estándar (por ejemplo Mixamo) si algún día se usan modelos externos

**Bloque 3.5: cámara, movimiento y combate de supervivencia moderna**
- Cámara más cerca y al hombro, con el personaje a la izquierda del encuadre (inspirada en el vídeo de referencia, sin copiar)
- Caminar hacia atrás sin darse la vuelta: el personaje retrocede mirando al frente; corriendo sí gira
- Agachado más bajo y natural, carrera con el torso inclinado
- Más polígonos: el jugador pasa a unos 6800 triángulos (pecho, omóplatos, orejas, cejas, manos con pulgar, suelas, mochila con saco de dormir) y los zombis a unos 7300 de cerca; de lejos usan una malla de unos 3300 para no perder fluidez
- Infectados con hongos: unos tienen bultos en la cabeza, el cuello y los hombros, y algunos una placa de hongo que les tapa media cara. Sufren espasmos (sacudidas secas de cabeza y hombros)
- Combo de 3 golpes: pulsa atacar otra vez durante un golpe. Con armas largas a dos manos: golpe, revés y un golpe fuerte por encima de la cabeza; con cuchillos: puñalada, tajo y puñalada
- El tercer golpe pega un 25 % más y derriba más
- Paso adelante al golpear si el zombi está algo lejos
- Esquivar (R, RB o botón Esquivar): un paso rápido de 1,6 m hacia donde muevas el joystick (sin dirección, hacia atrás). Si esquivas justo cuando un zombi te agarra, falla y se queda vendido 1,4 s: el contraataque pega más y derriba más
- Los zombis avisan más antes de agarrar (casi un segundo con los brazos estirados), para que se pueda leer y esquivar
- Golpes con peso: un instante de cámara lenta al acertar y una pequeña sacudida de cámara; el zombi se dobla hacia el lado del golpe
- **Editar botones** (en el menú y en la pausa, solo en móvil): arrastra cualquier botón, el joystick o el panel de vida y armas; con − y + cambias el tamaño del elegido. Se guarda en el teléfono; "Restablecer" vuelve a la disposición original

**Bloque 3.6: armas de fuego, arco y agarre por la espalda**
- 4 armas nuevas, imitadas (sin copiar) de los vídeos de referencia: pistola semiautomática, escopeta de corredera, rifle de cerrojo con mira telescópica y arco
- Munición que se encuentra en las casas: balas de 9 mm, cartuchos, balas de rifle y flechas; y un silenciador para la pistola (V lo pone y lo quita; aguanta 20 disparos)
- Se dispara apuntando: la cámara se acerca al hombro y aparece una retícula que se abre al moverte y al disparar y se cierra si te quedas quieto. Sin apuntar, atacar da un culatazo
- Animaciones: pistola baja a un lado al caminar y a dos manos al apuntar; escopeta y rifle cruzados delante del cuerpo y con la culata al hombro al apuntar; retroceso, corredera de la escopeta, cerrojo del rifle, recarga de la pistola (cargador y corredera), de la escopeta cartucho a cartucho y del rifle bala a bala; el arco se tensa hasta la cara y la mano va al carcaj por la siguiente flecha. Las manos siguen al arma de verdad (IK en los dos brazos) y el torso sigue la mirada arriba y abajo
- Disparo a la cabeza: triple de daño. A las piernas: derriba más. La escopeta suelta 7 perdigones y pierde fuerza a partir de 6 m. El rifle mata casi siempre de un tiro
- Las balas las paran paredes y puertas cerradas. Fogonazo con luz, estela de la bala, sangre y polvo al impactar, sacudida de cámara y la mira sube un poco con cada disparo
- Los disparos se oyen lejos (pistola 30 m, escopeta 38 m, rifle 45 m) y atraen a los zombis. El arco y la pistola con silenciador casi no hacen ruido
- Las flechas vuelan con caída; muchas se recuperan del suelo o del cadáver
- Mira telescópica del rifle: al apuntar, zoom fuerte con visor
- Recarga con R (o empujar mientras apuntas en el mando). Con escopeta y rifle puedes disparar a mitad de recarga. Si pides recargar durante la corredera, recarga al terminar
- Agarre por la espalda: acércate por detrás a un zombi que no te ha visto y pulsa Empujar (el botón cambia a "Agarrar" y se marca en amarillo). Con un cuchillo encima: tres puñaladas al cuello. Sin cuchillo: lo estrangulas (más lento)
- Botón Recargar en móvil (también se puede mover con el editor) y munición encima de las armas
- Cambio de teclas: esquivar pasa a la F; la R es recargar

**Bloque 4: casas de dos pisos, muebles, tiendas y corredores**
- 3 modelos nuevos de casa de dos pisos, repartidos al azar: escalera de verdad (se sube y se baja andando), dormitorios, baño y estudio arriba, barandilla en el hueco de la escalera y ventanas en las dos plantas. Los zombis también suben y bajan, y los ruidos se oyen peor de una planta a otra
- Muebles en todas las casas y edificios: camas, mesitas, cómodas, armarios, sofás, mesas, cocina completa, nevera, baño, estanterías, bancos de trabajo, escritorios, archivadores, taquillas... Bloquean el paso y la cámara los tiene en cuenta
- Registrar: acércate a un mueble con cajones o puertas y pulsa Registrar (E). El personaje rebusca (agachado si es bajo) y encuentras lo que haya: la munición va directa a la mochila y las armas quedan delante para cogerlas. Casi todo el botín está ahora dentro de los muebles
- Comisaría: en la oficina hay un armero con escopeta de corredera y pistola siempre, y un 12 % de rifle (más munición)
- Casas de dos pisos: algo más de probabilidad de encontrar una pistola
- Tiendas de comida (todavía sin comida): escaparate, toldo a rayas, cartel con nombre, góndolas, neveras, mostrador con caja (a veces con una pistola debajo) y almacén
- Edificios especiales que se reconocen de lejos: cartel de BOMBEROS con portones abiertos, dos camiones de bomberos viejos dentro (ruedas pinchadas, óxido) y una torre; POLICÍA con franja azul, mástil y coche patrulla aparcado (se puede registrar el maletero); HOSPITAL con marquesina, cruz roja en el tejado y ambulancia
- Camiones de bomberos: tienen un cofre en el lateral con un hacha de bombero
- Ataque en carrera (como en el vídeo de referencia): corriendo, atacar hace que el personaje se lance con el arma arriba y descargue el golpe al llegar. Hace más daño y casi siempre derriba; con cuchillo se clava en la cabeza; sin arma es un placaje
- Agarrar por la espalda ahora va en el botón de Atacar (que se ilumina y pone "Agarrar")
- Corredores: uno de cada cuatro zombis es agresivo. Ve más lejos, te nota antes, se para a chillar al verte (y avisa a los de alrededor), corre casi como tú, encorvado y agitando los brazos, y se abalanza para agarrarte. Tienen algo menos de vida. El resto siguen siendo lentos
- Esqueleto con 24 huesos: un hueso para los dedos de cada mano, que se cierran sobre el arma, se abren al empujar o rebuscar y hacen garras en los zombis

**Bloque 5: menú de botín, rendimiento y vegetación**
- Menú de botín al estilo de los shooters de móvil: al registrar un mueble se abre un panel con lo que hay dentro, en tarjetas de dos columnas con su icono (sacado del modelo 3D), nombre y cantidad. Toca una para cogerla o "Coger todo". Si ya llevas dos armas largas, la que tenías se queda dentro del mueble (cambio). Se cierra con la X, con E/Esc o al alejarte
- Lo que registras se queda registrado: después el mueble pone "Abrir (n)" y se abre al momento; vacío ya no sale. Al salir de una casa y volver, el botín sigue igual (los muebles y lo que tienen dentro son datos del mundo; solo se ocultan sus modelos)
- En el suelo solo se ven las armas de fuego largas (escopeta, rifle, arco) y las flechas disparadas. Las armas cuerpo a cuerpo, la pistola y la munición se encuentran dentro de muebles. Lo que sueltas (G) que no sea un arma de fuego larga queda en un "montón" que se abre con el mismo menú
- El hacha de bombero solo está en los cofres de los camiones de bomberos. La palanca inicial está dentro de un mueble de la sala
- Fuera la mecánica de una o dos manos y el límite de las armas cortas: con dos largas a la espalda puedes seguir usando las cortas. V (LB) ahora es el accesorio: silenciador en la pistola y mira del rifle
- Rifle: el primer toque de Apuntar apunta normal; el segundo pone la mira telescópica (en PC, rueda o V apuntando)
- Arco: postura de tiro nueva. Cadera y torso de perfil, brazo izquierdo estirado hacia el blanco, cuerda hasta la barbilla y codo derecho atrás a la altura del hombro
- Las luces de las habitaciones salen encendidas o apagadas al azar (fuera los interruptores, de momento)
- Calidad gráfica en el menú de inicio y en la pausa: Auto, Baja, Media y Alta (se guarda en el teléfono). Auto empieza en Media en móvil y Alta en PC y baja sola si el juego va por debajo de ~24 fps. Opción "Limitar a 30 fps"
- Optimización: las zonas nuevas se construyen por partes, unos milisegundos por fotograma (sin tirones); muebles y tabiques no proyectan sombra y solo se dibujan si estás dentro de la casa o cerca; menos luces a la vez en calidades bajas; zombis con 3 niveles de detalle, sin sombra a partir de cierta distancia y animados cada 2 o 3 fotogramas cuando están lejos. En la casa inicial se pasa de unos 535 000 a unos 225 000 triángulos y de 185 a 105 llamadas de dibujo
- `?debug` ampliado: fps, llamadas de dibujo, triángulos y milisegundos por fotograma de lógica, zombis, mundo y dibujo
- Vegetación nueva: árboles con tronco y ramas en 3D y hojas en láminas con transparencia; pinos con pisos de ramas; arbustos de láminas cruzadas; todo se mece con el viento. De lejos cada árbol pasa a ser una sola lámina que mira a la cámara
- Hierba alta al estilo PUBG Mobile, en manchas por el césped y sobre todo fuera del pueblo. Se encoge a lo lejos (20 a 30 m según la calidad) y su densidad depende de la calidad
- Esconderse en la hierba alta: tumbado dentro, los zombis solo te ven casi encima; agachado, mucho más cerca de lo normal; de pie no te tapa. Moverte por ella hace un leve roce. El HUD muestra "Oculto en la hierba"

**Bloque 5.1: sin resistencia, armas duraderas y botín sin repetir**
- Fuera la resistencia: correr, golpear y empujar ya no cansan (desaparece la barra y el estado "Agotado"). Correr sigue haciendo ruido
- Las armas cuerpo a cuerpo duran 5 veces más (un bate aguanta unos 900 golpes de media)
- No salen armas que ya llevas: al abrir un mueble por primera vez, las armas que tienes en el inventario no aparecen. Si eran fijas del mueble (la escopeta y la pistola del armero de la comisaría, el hacha del cofre del camión) quedan con un 12 % de probabilidad. Las armas de fuego largas del suelo tampoco salen si ya tienes una igual. La munición sí sigue saliendo
- Casas de una planta: menos pistolas y munición (un 40 % de lo que había). En las de dos pisos se mantiene igual

**Bloque 6A: inventario, mochila, curación, HUD nuevo y ventanas**
- Espacios de armas: 1 cuerpo a cuerpo (de cualquier tamaño), 1 pistola y 2 armas de fuego largas a la espalda. Con mochila, 2 armas largas más guardadas. Ya no se sueltan armas
- Si no te cabe un arma (o ya la tienes), no aparece al registrar; un arma de fuego rota sí se cambia por una nueva (la rota se queda en el mueble)
- Durabilidad real: cada golpe que acierta gasta uno. Tabla 4, palo de golf 5, cuchillo 5, bate 8, palanca 12, hacha de bombero 13 (y mata casi siempre de un golpe). Al romperse, las cuerpo a cuerpo desaparecen
- Armas de fuego con desgaste por disparo (pistola 150, escopeta 80, rifle 70, arco 120). Rotas no disparan pero se quedan; se podrán arreglar en un banco de taller más adelante
- Navaja de sigilo siempre a mano (no ocupa espacio ni se gasta): agarrar por la espalda siempre es con tres puñaladas
- Botín más escaso: fuera el 100 % del armero de la comisaría (pistola 60 %, escopeta 30 %, rifle 6 %); armas de fuego largas unas 3 veces más raras; munición de pistola más rara. Cada hallazgo de munición trae como mucho 6 (pistola 2-6, cartuchos 1-4, rifle 1-3, flechas 1-3)
- Límite de munición en reserva: sin mochila 10 balas de pistola, 5 cartuchos, 5 de rifle y 5 flechas; con mochila, el triple. Lo que no te cabe se queda en el mueble
- Mochila: empiezas sin ella. Se encuentra en armarios, taquillas, cajas, bancos de trabajo y estantes (deja de aparecer cuando la llevas). Se ve en la espalda y las armas se reubican
- Vendas (en baños, dormitorios, hospital, ambulancias): cortan el sangrado y evitan la infección de rasguños y laceraciones si te vendas en el primer minuto. Vendarse tarda 2,5 s y te deja quieto (un golpe lo corta). Los mordiscos siguen sin cura
- Alcohol (más raro; baños, cocinas, hospital): necesita mochila; cada botella trae 2-4 usos
- Fabricar en la mochila (mantener pulsado): venda + alcohol = venda desinfectada, que además recupera unos 30 puntos de vida en un minuto
- Sin tratamiento la vida solo vuelve sola hasta la mitad, despacio
- Menú de la mochila (se abre con un toque, el personaje se agacha a rebuscar y el mundo sigue): armas a mano y guardadas (toca una y luego otra para cambiarlas, o arrástrala), materiales y objetos (usar), descripción y fabricar. La munición no está ahí, está en el indicador de combate
- HUD nuevo al estilo de los juegos de referencia: un indicador con el icono blanco del arma, la munición "cargador | reserva" (en ámbar si está llena), rayitas del cargador o de los golpes que quedan, y la vida como un arco (rojo y latiendo si sangras). Tocarlo = cambio rápido al arma anterior; mantener y deslizar = selector de armas y vendas. Se puede mover con el editor de botones
- Iconos blancos generados de los modelos 3D para el HUD y la mochila (el menú de botín sigue a color)
- Botón ∆ aparte para registrar y abrir o cerrar el menú de botín; el botón de la puerta queda solo para puertas y ventanas; saltar vallas y ventanas solo con Saltar (se ilumina cuando hay algo que saltar)
- Opción "Abrir puertas al correr" (inicio y pausa): corriendo, las puertas se abren de un empujón (más ruido) y las ventanas abiertas o rotas y las vallas se saltan sin frenar
- Ventanas rompibles: un disparo o una flecha rompe el vidrio; un golpe o un codazo de frente también. Se oye a unos 14 m. Una ventana rota tiene vidrios: saltar por ella puede cortarte (rasguño o laceración). Quítalos con el botón de la puerta ("Quitar los vidrios") o con un golpe
- Fuera la resistencia (bloque 5.1) y la durabilidad x5 (sustituida por los golpes reales)

**Bloque 6B: terreno con lomas**
- Fuera del pueblo, lomas de 4 a 8 m y algún cerro de hasta unos 6 m más, con pequeñas irregularidades en todas partes. La mayoría de las cuestas son suaves (la mitad del campo tiene menos de 4°, casi todo menos de 20°, y las más empinadas rondan los 30°)
- En el pueblo, casi plano: 1 o 2 m de diferencia de punta a punta. Las calles y aceras siguen el terreno
- Cada edificio tiene una base nivelada a la altura media del terreno; donde el suelo queda más bajo se ve un zócalo, y la entrada tiene escalones si hace falta. Alrededor de la casa el terreno se nivela (una casilla) y luego hace una transición
- Todo sigue la altura del suelo: jugador, zombis, objetos, árboles, arbustos, hierba, vallas, farolas y vehículos
- Cuesta arriba se camina más despacio (hasta la mitad en las más empinadas)
- Las lomas tapan la vista: un zombi al otro lado de una loma no te ve (tumbado o agachado te tapa antes). Las balas y flechas chocan con el terreno, y la cámara no se mete dentro de una loma
- Las lomas proyectan sombra (fuera del pueblo)

**Bloque 6C: cobertura y protagonista más detallado**
- Cobertura automática (sin botón): agachado a menos de medio metro de una pared, una puerta cerrada, una valla, una barandilla o una ventana, el personaje se pega a ella con el hombro y avanza de costado, mirando a lo largo de la pared. Empujar el joystick lejos de la pared, levantarte o correr te despega
- En una esquina se para y se asoma (torso y cabeza salen por el borde); si sigues empujando medio segundo, sale
- Apuntar en cobertura: tras una cobertura baja (valla, ventana) te incorporas lo justo para disparar por encima; en la esquina de una pared alta sales de lado para disparar y vuelves a cubrirte al dejar de apuntar
- La cámara se pasa al otro hombro cuando la pared queda a su lado, para que nunca te tape la vista
- Sigilo: agachado en cobertura detrás de una valla o un muro bajo, un zombi del otro lado solo te ve a un tercio de la distancia normal (las paredes altas ya tapan la vista del todo)
- El protagonista pasa de unos 6800 a unos 12 000 triángulos, puestos en la silueta, las articulaciones y la ropa: chaqueta con faldón, dobladillo, cremallera, bolsillos, solapas y capucha recogida detrás del cuello; espalda en V y omóplatos; hombros y pliegues de codo; mangas arremangadas; rodillas del pantalón; botas altas con cordones; pistolera en el muslo y funda de la navaja. Manos, pies y cara casi iguales

**Bloque 6.1: HUD agresivo y sin cobertura**
- Cobertura desactivada por ahora (trababa al personaje). El código queda en `src/player.js` (`COVER_ON`) para retomarla más adelante
- Selector de armas nuevo en cruz, pequeño, al estilo de los juegos de referencia: a la izquierda las armas de fuego largas, a la derecha las cortas (pistola), arriba las vendas y vendas desinfectadas, abajo el arma cuerpo a cuerpo y las manos libres (y lo que se añada más adelante). Mantén el indicador y desliza hacia un brazo de la cruz: la dirección elige el brazo y la distancia, la casilla; al soltar se elige. Arriba se ve el nombre de lo marcado. En PC, mantén Q y mueve el ratón
- Indicador de combate más compacto en este modo
- Opción en el inicio y en la pausa: HUD "Agresivo" (el nuevo, por defecto) o "Clásico" (el selector en dos columnas del bloque 6). Se guarda en el navegador

## Controles

| Acción | Teclado y ratón | Móvil | Mando |
|---|---|---|---|
| Mover (en cualquier dirección) | WASD | Joystick fijo a la izquierda | Stick izquierdo |
| Mirar | Ratón (clic para capturarlo) | Arrastrar a la derecha (también desde Atacar y Empujar) | Stick derecho |
| Correr | Shift | Arrastra el joystick hasta Correr (se queda corriendo) o toca Correr | L3 |
| Apuntar | Mantener clic derecho | Botón de mira (activa y desactiva) | LT |
| Mira telescópica del rifle | Apuntando: rueda o V | Toca Apuntar otra vez | Apuntando: LB |
| Atacar | Clic izquierdo | Botón grande | RT |
| Empujar / pisotear | Espacio | Empujar | X |
| Agarrar por la espalda (zombi desprevenido) | Clic izquierdo | Agarrar (sale en Atacar) | RT |
| Ataque en carrera | Correr + clic izquierdo | Correr + Atacar | L3 + RT |
| Coger un objeto suelto (brillan) | T | Botón ∆ (dice "Coger") | A |
| Lanzar el ladrillo o la botella | G | Botón Lanzar (sale al llevar uno) | Cruceta arriba |
| Soltarte de un agarre | Clic izquierdo sin parar | Atacar sin parar | RT sin parar |
| Rematar a un aturdido | Clic izquierdo cerca de él | Atacar (dice "Rematar") | RT |
| Registrar o abrir un mueble / montón | T (abre y cierra el menú de botín) | Botón ∆ | A |
| Coger del menú de botín | Clic en la tarjeta · "Coger todo" | Toca la tarjeta | — |
| Cerrar el menú de botín | T, Esc o X (o alejarte) | ∆ o X (o alejarte) | A |
| Mochila (armas guardadas, vendas, fabricar) | I | Botón de la mochila (abajo a la izquierda) | Select |
| Vendarse | B (la desinfectada si la tienes) | Mantén el indicador de arma y desliza hasta la venda | Cruceta abajo |
| Esquivar | F | Esquivar | RB |
| Disparar (armas de fuego y arco) | Apuntar + clic izquierdo | Mira + Atacar | LT + RT |
| Recargar | R | Recargar | X apuntando |
| Poner o quitar el silenciador | V | — (se pone solo al cogerlo) | LB |
| Combo | Clic izquierdo otra vez durante el golpe | Atacar otra vez | RT otra vez |
| Abrir y cerrar puertas y ventanas, quitar vidrios | E | Botón con la puerta (aparece al acercarte) | A |
| Saltar (vallas y ventanas abiertas o rotas) | X | Saltar (se ilumina) | — |
| Agacharse (junto a una pared o valla: cobertura) | C | Agacharse | R3 |
| Pecho a tierra | Z | Pecho a tierra | B |
| Cambio rápido al arma anterior | Q (tocar) | Toca el indicador de arma | — |
| Selector de armas (cruz: izquierda largas, derecha cortas, arriba vendas, abajo cuerpo a cuerpo) | Mantén Q y elige moviendo el ratón | Mantén el indicador y desliza | — |
| Elegir arma | 1 cuerpo a cuerpo, 2 pistola, 3 y 4 largas · Tab o rueda pasa | — | Y |
| Pausa | Esc o P | Engranaje | Start |

Para cambiar la posición o el tamaño de los botones en móvil: "Editar botones" en el menú o en la pausa.

## Armas

Contundentes largas: bate, bate con clavos, palo de golf, mazo, pala, tabla, tabla con clavos.
Contundentes cortas: palanca, martillo, llave inglesa, sartén, tubo de plomo, rodillo, porra policial.
Hachas: hacha de bombero, hacha de mano. Hojas largas: machete, katana.
Hojas cortas: cuchillo de cocina, cuchillo de caza, destornillador, cuchilla de carnicero. Lanza improvisada.
De fuego: pistola semiautomática (corta, va al bolsillo), escopeta de corredera, rifle de cerrojo y arco (largas, a la espalda).

Espacios: 1 arma cuerpo a cuerpo (cualquiera), 1 pistola y 2 armas de fuego largas a mano; con mochila, 2 armas largas más guardadas. No se sueltan. Las cuerpo a cuerpo se rompen tras sus golpes y desaparecen; las de fuego se rompen y se quedan (inservibles hasta poder arreglarlas). Sin arma solo puedes empujar y pisotear; agarrar por la espalda siempre es con la navaja.

Dónde buscar (casi todo dentro de muebles): pistolas y munición de 9 mm en mesitas, escritorios, mostradores y comisarías; escopetas en comisarías y maleteros de patrulla; rifles, arcos y flechas sobre todo en cabañas y garajes; el hacha de bombero, en los cofres de los camiones de bomberos; vendas en baños, hospital y ambulancias; alcohol en baños, cocinas y hospital; la mochila en armarios, taquillas, cajas y talleres.

## Cómo probarlo

Abre `index.html` en el navegador (necesita conexión para cargar Three.js desde el CDN).

Opciones en la dirección (se pueden combinar con `&`):
- `?debug` muestra fotogramas, llamadas de dibujo, triángulos, chunks, zombis, la semilla y los milisegundos de cada parte (lógica, zombis, mundo, dibujo)
- `?seed=123` repite el mismo mundo
- `?armas` pone las armas de fuego largas junto al inicio y todo lo demás (cuerpo a cuerpo, pistola, munición, silenciador) en un montón
- `?calidad=baja` (o `media`, `alta`) fuerza esa calidad sin guardarla

## Publicar en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio, con la carpeta `src`.
2. En el repositorio: Settings, Pages, Source "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. En uno o dos minutos estará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`.

## Estructura

```
index.html        página, HUD y controles táctiles
style.css         estilos
src/
  util.js         ayudas (aleatorio con semilla, ángulos, colores)
  quality.js      calidad gráfica (Baja, Media, Alta, Auto) y límite de 30 fps
  mesher.js       une muchas piezas en una sola malla
  buildings.js    plantillas de edificios por habitaciones
  weapons.js      las 23 armas y qué aparece en cada habitación
  furniture.js    muebles y vehículos: colocación, modelos y lo que hay dentro
  world.js        chunks infinitos, plantas, escaleras, paredes, colisiones, línea de vista, rutas
  vegetation.js   árboles, pinos, arbustos y hierba alta (láminas con transparencia y viento)
  worldview.js    modelos 3D del mundo por etapas, puertas, ventanas, luces, interiores
  models.js       personajes con esqueleto, animaciones y modelos de armas
  input.js        teclado, ratón, táctil y mando
  camera.js       cámara en tercera persona
  player.js       jugador: movimiento, heridas, armas
  zombie.js       zombi: sentidos, persecución, puertas, golpes recibidos
  population.js   zombis por chunk: crear, dormir y despertar
  combat.js       combate cuerpo a cuerpo, agarre por la espalda
  guns.js         armas de fuego y arco: disparos, flechas, munición, efectos
  interact.js     puertas, ventanas, vallas, muebles, montones y armas del suelo
  icons.js        iconos sacados de los modelos 3D (a color y en blanco)
  loot.js         menú de botín
  hud.js          indicador de combate (arma, munición, vida) y selector de armas
  backpack.js     mochila: armas guardadas, objetos y fabricar
  hudedit.js      editor de botones (mover y cambiar tamaño, guardado en el teléfono)
  pickups.js      objetos sueltos (aparecen, brillan, se cogen) y arrojables (ladrillo y botella)
  mode.js         modo Asalto: oleadas, HUD del modo, frases, desafío y puntuación
  main.js         bucle principal, luces, HUD
```

## Ajustes rápidos

- Dificultad de los zombis: constantes al inicio de `src/zombie.js` (vida, velocidad, visión)
- Armas: tabla al inicio de `src/weapons.js` (daño, alcance, velocidad, golpes que aguanta en `cond`, disparos que aguanta en `shots`); multiplicador general: `DURABILITY`; cuántas pistolas y munición quedan en las casas de una planta: `COMMON_KEEP`
- Munición: `AMMO` en `src/weapons.js` (`box` = cuánta trae lo que encuentras, `cap` = cuánta cabe sin mochila; con mochila `BAG_MUL` veces más); vendas y alcohol: `SUPPLY`; dónde salen: `SUPPLIES` en `src/furniture.js`
- Curación: `wound`, `startBandage`, `finishBandage` y la vida que vuelve sola (hasta 50) en `src/player.js`
- Armas de fuego: tabla de `src/weapons.js` (daño, cargador, cadencia, recarga, dispersión, ruido); retroceso de la mira y sacudida en `KICK` y `SHAKE` de `src/guns.js`; cuánta munición trae cada caja en `AMMO`
- Qué hay dentro de cada mueble: tabla `C` en `src/furniture.js` (por ejemplo `armero`, `mesita`, `mostrador`, `cofre_camion`); qué muebles lleva cada habitación: `SETS`
- Botín extra por habitación: tabla `LOOT` en `src/weapons.js` (las armas de fuego largas van al suelo; lo demás, a un mueble de esa habitación)
- Calidades: tabla `PRESETS` en `src/quality.js` (resolución, sombras, niebla, luces, distancia de interiores, hierba, árboles lejanos, detalle de zombis, milisegundos de carga)
- Terreno: `HILL`, `HILL2` y `CERRO` (alturas) y `rawHeight` en `src/world.js`; cuánto frena una cuesta: busca "cuesta arriba" en `src/player.js`
- Cobertura: distancia para pegarse en `updateCover` (0,55 m) y cuánto se ve tras una valla (`0.35` en `src/zombie.js`, busca "cobertura")
- Hierba alta: dónde sale, en `generateChunk` de `src/world.js` (busca `c.tall`); cuánto esconde, `grass` en `src/zombie.js`; aspecto en `src/vegetation.js`
- Corredores: `RUNNER_CHANCE` (proporción) y `RUNNER` (velocidad, vista, chillido) en `src/zombie.js`
- Cuántas casas de dos pisos y tiendas salen: el reparto en `generateChunk` de `src/world.js` (busca `B.SHOPS`)
- Esquiva: `DODGE_DIST` en `src/player.js`; cuánto tarda el zombi en agarrar: `WINDUP` en `src/zombie.js`
- Parón al golpear: `hitStop` en `resolveSwing` de `src/combat.js` (pon 0 para quitarlo); sacudida de cámara: `shake` en `src/camera.js`
- Ritmo de los ataques: `ANIM` en `src/combat.js`; suavidad de las animaciones: números de `blend(...)` en `src/models.js`
- Distancia a la que te oyen correr o caminar: `NOISE_RUN` y `NOISE_WALK` en `src/player.js` (pon `NOISE_WALK = 0` para que caminar de pie sea silencioso)
- Sigilo: `CROUCH_SIGHT`, `PRONE_SIGHT` y `NOTICE_TIME` en `src/zombie.js`
- Cantidad de zombis y probabilidad de horda: `HORDE_CHANCE` y la sección de zombis en `src/world.js`
- Inercia del movimiento: `ACCEL` y `DECEL` en `src/player.js`
- Distancia de la cámara: constantes al inicio de `src/camera.js`
- Niebla: `fog` de cada calidad en `src/quality.js`
- Probabilidad de edificios raros: `specialQ` en `src/world.js`
- Campo de pruebas: `FIELD` (sí o no), `FIELD_MIN` y `FIELD_MAX` (tamaño) y `fieldProps` (muros, coche, mesas y cajas) en `src/world.js`
- Oleadas del modo Asalto: `WAVES` (cuántos corredores y ciegos, cuántos a la vez), `PREP`, `BETWEEN` y `RETURN` (segundos) en `src/mode.js`; frases: `BARKS`; nombre de la protagonista: `SPEAKER`; puntuación: `score`
- Forcejeo: `startStruggle` en `src/combat.js` (`dur` = tiempo para soltarte, `need` = pulsaciones); daño del mordisco en `updateStruggle`; probabilidad de agarrarte en `zombieStrike`
- Remates: tabla `EX` de `src/combat.js`. Por cada remate fija la duración (`dur`), los momentos de cada golpe (`hits`), cuánto tarda en juntarlos (`lerp`), cómo cae (`die`) y el empujón final (`push`). Las poses de ella están en `KP` y las del infectado en `KZ` de `src/models.js`. El recorrido de la cámara está en `CPATH` de `src/camera.js`: giro, distancia, altura, cabeceo y cuánto se centra en el infectado en cada momento
- Resistencia cuerpo a cuerpo: `MELEE_MUL` (armas) y `PUNCH_MUL` (puños) en `src/combat.js`. Súbelos para que caigan antes
- Pelear hacia la pared: `STEER_R` (hasta dónde busca una pared o una mesa), `STEER_STEP` (cuánto lo acerca cada golpe), `PIN_D` (a qué distancia ya se puede rematar), `PIN_TIME` (segundos desde el último golpe) y `EXEC_REACH` (hasta dónde lo lleva empujando al rematar) en `src/combat.js`
- Agarres: `grabChance` en `zombieStrike` de `src/combat.js` (probabilidad de que un zarpazo sea un agarre) y `grabCD` en `updateStruggle` (segundos de respiro tras soltarte)
- Cámara en la pelea: `DIST_FIGHT`, `SHOULDER_FIGHT`, `PIVOT_FIGHT`, `FIGHT_TILT` (cuánto mira hacia abajo) y `LOCK` (cuánto gira para dejar al infectado a la derecha) en `src/camera.js`. La opción Dinámica/Fija y el zoom por defecto están en `zoomMode` y `zoomPct`
- Objetos sueltos y arrojables: `KINDS` (cantidades y pesos), `REACH`, `ICON_D` y el aturdido del impacto en `src/pickups.js`; cuántos salen: `G.Pickups.spawn(n)` en `src/mode.js` y `src/main.js`
- Ciegos: `BLIND` en `src/zombie.js`; su aspecto en `blindGrowth` de `src/models.js`
- Cámara: `PIVOT`, `DIST`, `SHOULDER`, `TILT` (explorar), `*_AIM` (apuntar), `*_FIGHT` (pelea) y `CINE` (planos de cine) en `src/camera.js`

**Bloque 6.2: protagonista de una pieza, remera blanca y vendas**
- El torso del protagonista ya no se arma con esferas y cilindros encimados (eso dejaba círculos en el pecho). Ahora es una sola superficie hecha con secciones de la cadera al cuello (ancho y fondo por altura, pecho algo más cuadrado, espalda y hombros con su caída), con normales suaves y los pesos repartidos a lo largo de los tres tramos de la columna y las clavículas: se dobla sin cortes
- Brazos, piernas y cuello también son tubos de una pieza que se afinan (hombro, bíceps, codo, antebrazo, muñeca; muslo, rodilla, pantorrilla, tobillo). Fuera las esferas sueltas de codos, rodillas, bíceps y muslos
- Ropa nueva: remera blanca gastada de manga corta, con el dobladillo y las mangas un poco deshilachados, cuello redondo amarillento, mugre en los costados y abajo, sombra en las axilas y una mancha de sangre seca en el costado. Brazos al aire desde la manga
- Vendas: una en el antebrazo izquierdo y otra alrededor del codo derecho, con las vueltas marcadas, algo sucias, una mancha de sangre y la punta remetida. Se doblan con el brazo
- Pantalón con desgaste en muslos y rodillas y barro cerca de las botas. Se mantienen las botas altas con cordones, la pistolera en el muslo (ahora con correa alrededor de la pierna), la funda de la navaja y un bolsillo lateral
- Las correas de la mochila siguen ahora la forma de la remera (del pecho, por encima del hombro, a la mochila), con hebilla en el pecho
- Unos 12 700 triángulos (antes unos 11 900). Manos, pies y cara iguales. Los zombis no cambian
- El código está en `src/models.js` (`heroBody`, `HERO_TT` para la forma del torso y las tablas de brazos y piernas). `G.Mesher.vert` añade vértices con normal y pesos propios

**Bloque 6.3: puñetazos y cámara de pelea**
- Partimos de un video de referencia de peleas cuerpo a cuerpo, desglosado cuadro por cuadro: cuánto dura la carga, el impacto y la recuperación de cada golpe, y qué hace la cámara en cada fase. Lo llevamos a una versión propia (tiempos, poses y números nuestros, sin calcar)
- Puñetazos con las manos libres: Atacar lanza un combo de tres. Gancho de derecha (0,5 s), gancho de izquierda (0,46 s) y golpe fuerte (0,88 s): el personaje se agacha y se aparta, sube girando con todo el cuerpo, descarga y termina inclinado hacia delante por la inercia. Cada golpe aturde; el fuerte derriba a menudo (y después se pisotea). Empujar sigue en su botón. Si delante solo hay un zombi caído, el primer golpe es un pisotón
- Guardia: después de pelear sin arma el personaje levanta los puños unos segundos, con las rodillas algo flexionadas y el pie izquierdo adelante
- Los brazos siguen trayectorias de carga, golpe y vuelta (IK), con el codo guiado: afuera y a la altura del hombro en los ganchos
- Cámara de pelea: desde el primer golpe y hasta 2,4 s después la cámara se acerca (1,7 m) y baja un poco; mientras golpeas se coloca sola a tu espalda (si no la estás moviendo tú)
- Cada golpe tiene su coreografía de cámara. En la carga la cámara se va hacia el lado del brazo que golpea; en el impacto da un latigazo hacia el otro lado siguiendo el puño o el arma, se mete encima y se inclina un poco; después vuelve sola. En el golpe fuerte se abre a tres cuartos mientras te agachas y vuelve a tu espalda justo antes de pegar. Vale también para las armas (horizontal, revés, de arriba abajo, puñalada, empujón, pisotón y ataque en carrera)
- Al acertar: el parón breve que ya había, más un golpe de zoom (el campo de visión se cierra unos grados y vuelve), sacudida y un empujón de la cámara hacia delante
- El remate en el suelo se ve ahora de tres cuartos (antes de costado): el personaje se ve casi siempre de espaldas
- Para ajustar: `CHOREO` en `src/camera.js` (cámara por golpe), `PUNCH` en `src/combat.js` (tiempos y daño de los puños) y `FIST_TR` en `src/models.js` (trayectorias de los puños)

**Bloque 6.4: cámara baja, pelea con reacciones y zombis más peligrosos**
- Cámara a la altura de la cintura (como en los videos de referencia): el personaje se ve de las rodillas para arriba, un poco desde abajo. Al apuntar sube al hombro y se pega (más cerca con armas largas)
- Zoom dinámico, siempre en movimiento: corriendo la cámara se aleja y abre el campo de visión; con zombis persiguiéndote cerca se cierra un poco; quieto, se acerca despacio y "respira"; en la pelea se pega y en cada golpe hace su coreografía
- Golpe automático: al atacar con un zombi cerca, el personaje se gira y le pega al más cercano (en cualquier dirección), dando un paso o lanzándose hacia él si está a un par de metros. Si empujas el joystick hacia uno, le pega a ese: así se va pegando a dos que te rodean. El que va a recibir el golpe se marca con el contorno
- Reacciones de los zombis a los golpes, según el tipo: un gancho o un golpe horizontal les tuerce la cabeza y el torso de lado y los hace trastabillar de costado; el golpe fuerte los echa atrás con los brazos arriba; de arriba abajo se les doblan las rodillas; una puñalada los encorva; un disparo los echa atrás. Ahora retroceden de verdad (de medio metro a casi un metro) y, si chocan contra una pared, se estampan y quedan aturdidos más tiempo. Al morir salen despedidos
- Daño de las armas cuerpo a cuerpo: un golpe que acierta quita al menos 1,17, así que ningún zombi aguanta más de 3 golpes (las pesadas, 1 o 2). Los puños siguen igual
- Ataque de los zombis como en los videos: se encogen con las garras arriba, se lanzan con el cuerpo por delante y los brazos estirados, y el brazo derecho barre cruzando; si te alcanzan, el izquierdo se te queda agarrado un momento; si fallan, el impulso los lleva un paso de más
- Tu personaje acusa los golpes: se echa atrás o de lado según de dónde venga el golpe, retrocede un paso y se cubre con los brazos; un mordisco es un forcejeo. Corta el golpe que estabas dando. La cámara no se mueve por los golpes que recibes
- Zombis más rápidos y agresivos: persiguen a 1,3 m/s (antes 0,95), ven más lejos, te notan antes, preparan el ataque en 0,6 s (antes 0,9) y llegan más lejos; hay más corredores (32 %) y corren más (3,55 m/s). Aparecen un poco más (alrededor de un 10 % más)
- Comisarías: ahora salen unas 4 veces más (los edificios especiales son el doble de frecuentes y la mitad son comisarías)
- Armas largas: sin apuntar se llevan en la mano derecha a la altura de la cadera, con el cañón hacia delante y abajo y la izquierda libre; al apuntar, culata al hombro con las dos manos. Más retroceso en escopeta y rifle
- Recargar deja de apuntar (vuelves a apuntar tocando Apuntar otra vez o, en PC, al terminar si sigues con el botón)
- Correr agachado: con Correr estando agachado, el personaje corre encorvado (3 m/s, más rápido que caminar y con mucho menos ruido que corriendo de pie)
- Fuera el botón de empujar. Sin arma, Atacar a un zombi caído es un pisotón. En PC, Espacio salta; en el mando, X recarga
- La cruz de armas se abre siempre en el mismo sitio (a la derecha, algo por encima del centro), esté donde esté el indicador
- Mochila nueva: cuerpo de lona redondeado con tapa que cae por encima, bolsillo delantero y laterales, correas con hebillas y saco de dormir enrollado abajo

**Bloque 6.5: cambio de rumbo (modo tipo "sin retorno"), mundo de pruebas y modo desarrollador**
- Cambio de planes: en vez de un survival de mundo abierto, el juego va hacia un modo de encuentros cerrados tipo "sin retorno". Empezamos con betas de prueba de mecánicas
- Mundo de pruebas: pequeño (3 x 3 chunks, 96 x 96 m), plano y cerrado con una valla que no se puede saltar. En el centro, el pueblo con la casa de inicio; alrededor, campo con caminos y alguna cabaña; fuera de la valla, bosque. El mundo infinito sigue en el código: `SMALL = false` en `src/world.js`
- Sin botín por ahora: ni armas en el suelo ni cosas en los muebles (palos, munición, vendas...). El código queda guardado para después: `LOOT = true` en `src/world.js`
- Sin zombis que aparezcan solos (se sacan con el botón de pruebas). Para volver a activarlos: `AUTO_ZOMBIES = true` en `src/world.js`
- La mochila se lleva siempre, con o sin el modo desarrollador
- Opción "Pruebas de desarrollador" (en el inicio y en la pausa; se guarda en el navegador): al activarla tienes bate, pistola, escopeta, rifle y arco (este en la mochila), munición sin fin y vendas; en la mochila aparece la Armería con todas las armas del juego (tócalas para ponerlas en su espacio y equiparlas)
- Con el modo desarrollador aparece arriba el botón "+ Zombi" (en PC también la tecla N): saca un zombi a unos metros delante de ti, que viene a por ti (a veces un corredor). Se puede mover con el editor de botones
- Cámara enganchada al hombro, como en las fotos de referencia: a la altura de la cabeza, cerca y mirando un poco hacia abajo; el personaje se ve de medio muslo para arriba, a la izquierda del encuadre. Al apuntar se pega más

**Bloque 6.6: Proyecto Retorno — infectados muy agresivos, cabeza y cuerpo, modelos nuevos**
- El proyecto pasa a llamarse "Proyecto Retorno"
- Todos los infectados son corredores por ahora (ninguno camina lento): corren a 4 m/s (tú, 4,3), te ven a 30 m y te notan casi al instante, chillan y se lanzan; preparan el ataque en 0,32 s, llegan hasta 1,45 m y se abalanzan más lejos; tras atacar se recuperan enseguida. Incluso vagando van ligeros y al investigar un ruido corren
- Ya no se caen con los golpes: el golpe que antes los tiraba ahora los hace retroceder más y tambalearse más rato. Solo caen al morir
- Daño en dos zonas: del cuello para abajo, daño normal; en la cabeza, muerte en el acto
  - Armas de fuego y flechas: cuenta dónde da el disparo. La cabeza y el pecho se buscan donde están de verdad en la animación (los corredores van inclinados hacia delante)
  - Armas cuerpo a cuerpo: de pie, todos los golpes van al cuerpo (ver `MELEE_MUL`). El ataque en carrera con un arma, los remates y los golpes en el suelo van a la cabeza
  - Los puñetazos nunca matan de un golpe (daño normal)
- Modelos de los infectados casi al nivel del protagonista: el mismo cuerpo de una pieza (torso, brazos, piernas y cuello sin cortes) con camisas rotas por las que se ve la piel, manchas de sangre seca y barro, mangas cortas o largas deshilachadas, pantalones rotos en las rodillas, piel muerta con moratones, venas y verdín, y complexión distinta en cada uno. Cabeza, manos y pies con el mismo detalle que el protagonista; los hongos siguen igual. Unos 12 000 triángulos cada uno de cerca (3300 de lejos)

**Bloque 7: Asalto por oleadas, protagonista nueva, forcejeo y remates (inspirado en el vídeo de referencia)**

Partimos de un vídeo de un modo por oleadas de un juego de referencia y lo desglosamos (cámara, movimiento, golpes, remates, disparos, objetos, HUD, comportamiento de los infectados). Todo se rehízo con diseño, poses, tiempos y números propios: sirve de guía para la sensación, no se calca nada.

- Protagonista nueva, diseño propio: Vera (nombre provisional), una mujer joven y atlética con el pelo castaño muy oscuro recogido en una trenza corta con física (cuelga con la gravedad, se queda atrás al acelerar y se balancea al frenar), remera blanca gastada, vendas en el antebrazo y el codo, pantalón cargo oliva y botas. Cuerpo de mujer de una pieza (hombros más estrechos, cintura, cadera y pecho propios), cara más corta y redonda, labios y cejas. 26 huesos (dos nuevos para la trenza)
- Siempre viva: trota por defecto (3,6 m/s) y corre a 5,4 m/s; la zancada, el braceo y la inclinación crecen con la velocidad; se inclina hacia dentro en las curvas y hacia delante al arrancar; jadea después de correr; la cabeza sigue al infectado más cercano; con una oleada en marcha o alguno persiguiéndote se pone en guardia con la navaja lista; quieta, mira alrededor, estira el cuello o sacude los brazos
- Navaja siempre en la mano cuando no llevas otra arma: combo de tres (tajo, revés y puñalada al cuello)
- Agarres y forcejeo: los corredores pueden agarrarte de frente. Pulsa Atacar sin parar para soltarte (5 veces en 2,1 s; a un ciego, 9 en 1,7 s). Si lo logras, lo empujas y queda aturdido; si no, te muerde (30 de daño; un ciego, 62). Plano de cine de lado y un anillo que se llena con cada pulsación
- Aturdir: el empujón al soltarte, esquivar un ataque o darle con un ladrillo o una botella lo dejan aturdido unos segundos, tambaleándose con las manos en la cara
- Remates: Atacar junto a un aturdido lo remata con plano de cine. Con la navaja, si hay una pared, una valla o un mueble alto cerca, le agarra la nuca y le estampa la cabeza dos veces; si no, lo agarra del hombro y le clava la navaja en el cuello tres veces. Con otra arma, un golpe brutal a la cabeza. Con la pistola en la mano, la guarda y remata con la navaja. El infectado reacciona a cada golpe (cabeza atrás, rodillas que ceden) y queda un charco de sangre
- Infectado ciego (variante dura, diseño propio): una costra de hongo en repisas, como las de los troncos viejos, le tapa los ojos y trepa por un lado del cráneo, con nódulos, fibras pálidas y raicillas. Va encorvado con la cabeza ladeada escuchando; no ve, oye muy bien y su agarre es casi mortal
- Objetos sueltos: munición, vendas, alcohol, ladrillos y botellas aparecen encima de mesas, mostradores y escritorios o en el suelo, repartidos por el mapa. Brillan; de cerca muestran su icono blanco (en el borde de la pantalla si quedan fuera) y se cogen con ∆ / T de pasada: si está en una mesa estira el brazo, si está en el suelo se agacha
- Arrojables: se lleva un ladrillo o una botella. G (o el botón Lanzar, o la cruceta arriba) lo lanza con un lanzamiento rápido al infectado fijado (el rombo sobre su cabeza); si no hay ninguno, hacia donde miras. Al darle queda aturdido; al caer hace ruido y atrae a los que no te han visto
- Modo Asalto (nuevo en el menú, junto a "Práctica libre"): 20 s para prepararte ("OLEADA ENTRANTE"), tres oleadas (4 corredores; 6; 6 y 2 ciegos), "PRÓXIMA OLEADA EN…" con suministros nuevos entre oleadas, "ENFRENTAMIENTO COMPLETADO", "REGRESANDO AL ESCONDITE" y las estadísticas con la puntuación (finalización, tiempo, daño recibido, precisión, aturdir, muertes cuerpo a cuerpo, remates, disparos a la cabeza, forcejeos ganados y el desafío). Los de las oleadas son cazadores: saben dónde estás. Desafío de la partida: agarrar y matar a uno por sorpresa (recompensa: 2 vendas). En este modo los mordiscos no infectan. Empiezas con la navaja, la pistola cargada, 4 balas de reserva y una venda
- HUD del modo: título "ASALTO / DESPEJA CADA OLEADA" arriba a la izquierda al empezar, cuenta atrás arriba al centro, "Oleada 1/3" con barra y un muñeco por cada infectado que queda arriba a la derecha (los ciegos marcados), el desafío a la izquierda y frases de Vera como subtítulos
- Cámara medida en el vídeo: explorando, a la altura de la cabeza, unos 2 m detrás y algo a la derecha, mirando hacia abajo (se ve de cuerpo entero en el tercio izquierdo); apuntando, pegada al hombro derecho y recta; en la pelea, más cerca y más baja; corriendo, se aleja y se mece con la zancada; agachada, más baja y más cerca. Planos de cine para el forcejeo (de lado) y los remates (de tres cuartos, encuadrando a los dos)
- Pistola: retícula circular pequeña, fogonazo grande con humo, casquillos que saltan y rebotan, nube de sangre en el impacto y charco bajo el infectado

**Bloque 7.1: campo de pruebas**
- Mientras probamos mecánicas, el mapa pasa a ser un campo de pruebas de 40 x 40 m, plano y cerrado con la valla: sin casas, árboles, arbustos, calles ni farolas
- Dentro hay solo lo necesario para probar: cinco muros sueltos de hormigón (una esquina en L, un muro largo, uno corto y un rincón) para cubrirte, cortar la vista y rematar contra la pared; un coche patrulla; una mesa, un escritorio, un mostrador, un banco de trabajo y cajas, donde aparecen los objetos sueltos; y dos manchas de hierba alta para el sigilo
- El modo Asalto se adapta al tamaño: los infectados aparecen a entre 12 y unos 22 m de ti, y hay menos objetos repartidos (9 al empezar y 5 entre oleadas; 10 en la práctica libre)
- Para volver al pueblo de 96 x 96 m con casas y árboles: `FIELD = false` en `src/world.js`. El tamaño del campo está en `FIELD_MIN` y `FIELD_MAX`, y lo que hay dentro en `fieldProps`

**Bloque 7.2: pelea y remates del segundo vídeo (más exigente)**

Tomamos el segundo vídeo de referencia (remates y pelea con navaja) como guía de tiempos, poses clave y encuadres, segmento a segmento. Las poses y los números son nuestros: el vídeo marca el ritmo y la sensación, no se calca.

- Cámara en la pelea, como en el vídeo: más cerca, por encima del hombro derecho y mirando más hacia abajo. Gira para dejarla a ella a la izquierda y al infectado a la derecha del centro (antes el cuerpo de ella lo tapaba). Con la navaja apenas se sacude
- Cada remate tiene su propio recorrido de cámara, medido en el vídeo: se acerca, rodea hasta el lado que mejor se ve y se aleja al final. En los remates ya no hay bandas negras (en el vídeo no las hay); solo en el remate en el suelo
- Remates nuevos con navaja:
  - Ataque en carrera: mata de un golpe. Lo agarra con la izquierda, le engancha la navaja en el cuello, aguanta, tira y lo empuja, y sigue corriendo. Sale con la navaja o con la pistola en la mano (la cambia por la navaja); con otras armas, el golpe en carrera también mata de un golpe
  - Remate en carrera (corriendo hacia un aturdido): puñaladas al estómago, el infectado se dobla sobre su hombro, puñalada al cuello y lo tira al suelo
  - Contra una mesa, un escritorio o un mostrador: lo tumba de espaldas encima, puñaladas al cuello, levanta el brazo y la clava hacia abajo. El cuerpo queda tendido sobre el mueble
  - Contra una pared o un muro: lo clava contra la pared, puñaladas al cuello y se desliza hasta quedar sentado
  - En campo abierto: lo agarra del hombro, dos puñaladas y lo empuja lejos. Si hay una ventana detrás, la atraviesa
  - Remate del combo: si el tercer golpe del combo de navaja lo dejaría muerto, se convierte en un remate. Lo echa hacia atrás, lo sujeta y le da dos puñaladas por encima de la cabeza, con la cámara delante de ella
- Combo de navaja rehecho: tajo en diagonal con mucho recorrido, revés que termina con el brazo derecho estirado y el izquierdo arriba, y puñalada con una vuelta amplia. El infectado acusa cada tajo sin salir despedido, así sigue a tiro como en el vídeo
- Más resistentes cuerpo a cuerpo (en el 7.3 se subió más). El daño de las armas se multiplicaba por 0,62 y el de los puñetazos por 0,8. Los críticos llegan como mucho a ×1,5. De pie, todos los golpes van al cuerpo. El golpe que lo dejaría muerto no lo mata: lo deja aturdido, y el siguiente Atacar es un remate
- Agarres mucho menos frecuentes:
  - Antes, cada zarpazo que acertaba era un agarre. Ahora solo 3 de cada 10 (de 4 a 5 por la espalda); el resto son arañazos
  - Después de soltarte tienes 6 s de respiro sin que nadie te agarre
  - Mientras uno te agarra, ningún otro te agarra ni te pega. Los que están cerca esperan su turno a unos 2 m
- Opción de cámara en el menú de configuración (pantalla de inicio y pausa):
  - **Dinámica** (por defecto): la de siempre, mejorada con los vídeos. Se aleja al correr, se cierra con infectados cerca y se acerca al pelear
  - **Fija**: la distancia no cambia sola
  - **Zoom**: deslizador de -40 % (más cerca) a +40 % (más lejos). Vale para explorar y para pelear, en los dos modos
  - Se guarda en el navegador

**Bloque 7.3: pelear hacia la pared**
- Los remates contra la pared y la mesa ya no dependen de la suerte. Cada golpe empuja al infectado hacia la pared, el muro, la valla, el mueble alto o la mesa más cercana, hasta unos 6 m alrededor, siempre que no quede detrás de ti. Avanza hasta 1 m por golpe y, si ya está pegado, se estampa contra ella
- Cuando lo estás golpeando y queda a 1 m o menos de algo así, Atacar lo remata contra eso (aparece "Rematar"). También si está aturdido. Ella se coloca enfrente aunque la pared quede de lado, y si está a menos de 1,7 m lo lleva empujando hasta ella
- Con cualquier arma: los remates contra la pared y la mesa se hacen con la navaja (guarda el arma un momento); en campo abierto, con un arma que no es la navaja, sigue el golpe brutal
- Aguantan bastante más: el daño cuerpo a cuerpo se multiplica por 0,33 (puños por 0,5). En campo abierto hacen falta unos 9 tajos de navaja (o el remate del combo cuando ya están tocados); cerca de una pared, 4 a 6 golpes y el remate
- Con una pared o una mesa cerca, el tercer golpe del combo ya no hace el remate en campo abierto: lo aturde y lo lleva hacia ella

## Plan de bloques

1. Base y zombis lentos (hecho)
2. Mundo infinito por chunks (hecho; guardado, ahora se usa el mundo de pruebas)
3. Tercera persona, casas con interiores y combate (hecho)
4. Casas de dos pisos, muebles y tiendas (hecho)
5. Menú de botín, rendimiento y vegetación (hecho)
6. Inventario, mochila, curación, HUD, cámara, pelea y modo desarrollador (hecho)
7. Betas de prueba de mecánicas y primer modo por oleadas (Asalto) en el mundo de pruebas (en curso)
8. Modo tipo "sin retorno" completo: varios encuentros seguidos en zonas cerradas, escondite y recompensas entre encuentros
9. Banco de taller para arreglar armas de fuego
10. Pulido: sonido, guardado, PWA

## Pulido final (pendiente)

Detalles que se dejan para el final, cuando el resto del juego esté hecho:
- Hierba alta: mejorar la textura de las hojas (forma, color, variedad) y revisar la densidad en general (cuánta hay por zona y cuántas matas por casilla). Se ajusta en `src/vegetation.js` (`grassCanvas`, `grassGeo` y las matas por casilla en `build`), en `grass` y `grassFar` de `src/quality.js` y en `c.tall` de `src/world.js`

## Licencia

Añade una licencia al repositorio (por ejemplo MIT) antes de publicarlo. Three.js se carga desde un CDN y tiene su propia licencia (MIT).
