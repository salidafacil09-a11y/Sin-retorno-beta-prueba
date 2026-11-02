(function (G) {
  'use strict';

  // Zombis y cadáveres del mundo infinito.
  // - Al activarse un chunk por primera vez se crean sus zombis.
  // - Los zombis (y cadáveres) lejanos se "duermen": se guardan en el chunk
  //   donde están y se quita su modelo. Al volver, aparecen igual.

  const ACTIVE_RADIUS = 1;
  const SLEEP_RADIUS = 2;
  const SAFE_START = 9;

  const list = [];        // zombis activos (vivos y cadáveres cercanos)
  let scene = null;
  let lastPCX = NaN, lastPCZ = NaN;
  let sleepTimer = 0;
  let listening = false;

  function init(sceneRef) {
    scene = sceneRef;
    if (!listening) {
      listening = true;
      // ruidos del mundo (puertas rotas, golpes, etc.)
      G.World.onNoise((x, z, r, lv) => {
        for (let i = 0; i < list.length; i++) list[i].hear(x, z, r, lv);
      });
    }
  }

  function reset() {
    for (let i = 0; i < list.length; i++) list[i].dispose();
    list.length = 0;
    lastPCX = lastPCZ = NaN;
    sleepTimer = 0;
  }

  function wake(chunk) {
    if (!chunk.populated) {
      chunk.populated = true;
      const S = G.World.SPAWN;
      for (const p of chunk.spawns) {
        if (Math.hypot(p.x - S.x, p.z - S.z) < SAFE_START) continue;
        list.push(new G.Zombie(scene, p.x, p.z, null, null, { homebound: !!p.indoor, lv: p.lv || 0 }));
      }
    }
    for (const s of chunk.sleepers) list.push(new G.Zombie(scene, s.x, s.z, s.look, s.facing, s));
    chunk.sleepers.length = 0;
  }

  function sleepFar(pcx, pcz) {
    const CS = G.World.CS;
    for (let i = list.length - 1; i >= 0; i--) {
      const z = list[i];
      if (z.human) continue;            // los humanos no se duermen (tienen su misión)
      const zcx = Math.floor(z.pos.x / CS), zcz = Math.floor(z.pos.z / CS);
      if (Math.abs(zcx - pcx) > SLEEP_RADIUS || Math.abs(zcz - pcz) > SLEEP_RADIUS) {
        G.World.chunkAt(zcx, zcz).sleepers.push(z.snapshot());
        z.dispose(true);
        list.splice(i, 1);
      }
    }
  }

  function update(px, pz, dt) {
    const CS = G.World.CS;
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    if (pcx !== lastPCX || pcz !== lastPCZ) {
      lastPCX = pcx; lastPCZ = pcz;
      for (let dz = -ACTIVE_RADIUS; dz <= ACTIVE_RADIUS; dz++) {
        for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx++) wake(G.World.chunkAt(pcx + dx, pcz + dz));
      }
      sleepFar(pcx, pcz);
    }
    sleepTimer += dt || 0;
    if (sleepTimer > 2) { sleepTimer = 0; sleepFar(pcx, pcz); }
  }

  function alive() {
    let n = 0;
    for (let i = 0; i < list.length; i++) if (list[i].alive) n++;
    return n;
  }

  G.Population = { list, init, reset, update, alive };
})(window.Game = window.Game || {});
