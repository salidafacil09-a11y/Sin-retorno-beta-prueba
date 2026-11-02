(function (G) {
  'use strict';

  // Iconos sacados de los modelos 3D (una vez por objeto, guardados como imagen):
  //   color(id)  a color, para el menú de botín
  //   white(id)  silueta blanca simplificada con un leve sombreado, para el HUD y la mochila

  const cache = { color: {}, white: {} };
  let ir = null, iscene = null, icam = null, matColor = null, matWhite = null, lights = null;
  const IW = 132, IH = 92;

  function setup() {
    const cv = document.createElement('canvas');
    cv.width = IW; cv.height = IH;
    ir = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    ir.setPixelRatio(1);
    ir.setSize(IW, IH, false);
    ir.outputEncoding = THREE.sRGBEncoding;
    ir.setClearColor(0x000000, 0);
    iscene = new THREE.Scene();
    lights = new THREE.Group();
    lights.add(new THREE.HemisphereLight(0xffffff, 0x5a5650, 0.95));
    const d = new THREE.DirectionalLight(0xffffff, 0.75);
    d.position.set(-1, 2, 3);
    lights.add(d);
    iscene.add(lights);
    icam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    matColor = new THREE.MeshLambertMaterial({ vertexColors: true });
    matWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
  }

  function render(id, white) {
    if (!ir) setup();
    const WP = G.Weapons;
    const geo = G.Models.weaponGeometry(id === 'mochila' ? 'mochila_icon' : id);
    // munición: se pinta a color y se pasa a blanco con más contraste (que se vean los cartuchos y la caja)
    const ammo = /^mun_(9mm|cartucho|rifle|revolver)$/.test(id);
    const keepColor = id === 'botiquin' || id === 'molotov' || ammo;
    const mesh = new THREE.Mesh(geo, white && !keepColor ? matWhite : matColor);   // el botiquín se pinta a color para recortarle la cruz
    const w = WP.get(id), gun = WP.isGun(w), item = WP.isItem(id) || id === 'botiquin';
    // a lo largo (+Y del modelo) hacia la derecha y la parte de arriba (-Z) hacia arriba
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    // en blanco, de perfil (se lee mejor como silueta); a color, con algo de volumen
    const tilt = new THREE.Quaternion().setFromEuler(white
      ? new THREE.Euler(ammo ? 0.45 : (item ? 0.35 : 0.05), ammo ? 0.5 : (item ? 0.4 : 0), gun || item ? 0 : 0.62)
      : new THREE.Euler(0.45, item ? 0.5 : 0.25, gun || item ? 0.06 : 0.62));
    mesh.quaternion.copy(tilt.multiply(q));
    mesh.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(mesh);
    const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    mesh.position.sub(c);
    const asp = IW / IH, pad = white ? 1.08 : 1.18;
    const hh = Math.max(s.y, s.x / asp) * pad / 2;
    icam.left = -hh * asp; icam.right = hh * asp; icam.top = hh; icam.bottom = -hh;
    icam.updateProjectionMatrix();
    iscene.add(mesh);
    ir.render(iscene, icam);
    iscene.remove(mesh);
    if (!white) return ir.domElement.toDataURL('image/png');
    // blanco casi puro con un leve sombreado (para que se distingan las piezas)
    const cv = document.createElement('canvas');
    cv.width = IW; cv.height = IH;
    const g = cv.getContext('2d');
    g.drawImage(ir.domElement, 0, 0);
    const im = g.getImageData(0, 0, IW, IH), px = im.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      // botiquín: la cruz blanca queda recortada (hueco) para que se lea en la silueta blanca
      if (id === 'botiquin' && px[i + 1] > 120 && px[i + 2] > 120) { px[i + 3] = 0; continue; }
      // molotov: el trapo encendido en naranja (así no se confunde con la botella)
      if (id === 'molotov' && px[i] > px[i + 2] + 30 && px[i] > px[i + 1]) { px[i] = 255; px[i + 1] = 150; px[i + 2] = 50; px[i + 3] = 255; continue; }
      const l = (px[i] + px[i + 1] + px[i + 2]) / 765;
      const v = ammo ? Math.round(255 * (0.42 + 0.58 * Math.min(1, l * 1.5))) : Math.round(255 * (0.72 + 0.28 * Math.min(1, l * 1.15)));
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = px[i + 3] > 40 ? 255 : px[i + 3];
    }
    g.putImageData(im, 0, 0);
    return cv.toDataURL('image/png');
  }

  function get(kind, id) {
    const C = cache[kind];
    if (C[id] !== undefined) return C[id];
    let url = null;
    try { url = render(id, kind === 'white'); } catch (e) { url = null; }
    C[id] = url;
    return url;
  }

  G.Icons = {
    color: (id) => get('color', id),
    white: (id) => get('white', id)
  };
})(window.Game = window.Game || {});
