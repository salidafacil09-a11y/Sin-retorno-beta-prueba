(function (G) {
  'use strict';

  const Util = {
    // Generador pseudoaleatorio con semilla
    mulberry32(seed) {
      let a = seed | 0;
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    smooth(t) {
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return t * t * (3 - 2 * t);
    },

    // Diferencia de ángulos en el rango [-PI, PI]
    angleDiff(a, b) {
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },

    // Gira el ángulo "a" hacia "b" con un paso máximo
    turnToward(a, b, maxStep) {
      const d = Util.angleDiff(b, a);
      if (Math.abs(d) <= maxStep) return b;
      return a + Math.sign(d) * maxStep;
    },

    pick(rng, arr) {
      return arr[Math.floor(rng() * arr.length)];
    },

    // Elige una clave de un objeto {clave: peso}
    weighted(rng, table) {
      let total = 0;
      for (const k in table) total += table[k];
      let r = rng() * total;
      for (const k in table) {
        r -= table[k];
        if (r <= 0) return k;
      }
      return Object.keys(table)[0];
    },

    // Color hexadecimal (sRGB) a THREE.Color en espacio lineal,
    // porque el renderer trabaja con salida sRGB.
    col(hex) {
      return new THREE.Color(hex).convertSRGBToLinear();
    },

    // Variante de color con ligera variación de brillo
    shade(hex, f) {
      const c = new THREE.Color(hex);
      c.r = Util.clamp(c.r * f, 0, 1);
      c.g = Util.clamp(c.g * f, 0, 1);
      c.b = Util.clamp(c.b * f, 0, 1);
      return c.getHex();
    }
  };

  G.Util = Util;
})(window.Game = window.Game || {});
