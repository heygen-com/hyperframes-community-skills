// Finish pass (skill: finish-pass). Curves S -> saturation -> 3 % colour noise re-seeded every frame.
// Filters live in each comp's <defs> (#finish on the opaque scene, #finishT on the text layers); this fills the curve
// tables and rolls the grain seed from the master clock: FINISH.init() once, FINISH.seed(t) from paint(t).
(function () {
  var CURVE = [[0, 0], [0.26, 0.235], [0.74, 0.765], [1, 1]];   // Frechen's Curves panel (RGB)
  var FPS = 30;                                                   // = render fps
  function curveTable(pts, n) {                                   // monotone cubic through the points -> n samples
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), m = [];
    var d = xs.slice(1).map(function (x, i) { return (ys[i + 1] - ys[i]) / (x - xs[i]); });
    m[0] = d[0]; m[pts.length - 1] = d[d.length - 1];
    for (var i = 1; i < pts.length - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    var out = [];
    for (var k = 0; k < n; k++) {
      var x = k / (n - 1), j = 0;
      while (j < pts.length - 2 && x > xs[j + 1]) j++;
      var h = xs[j + 1] - xs[j], t = (x - xs[j]) / h, t2 = t * t, t3 = t2 * t;
      var y = (2 * t3 - 3 * t2 + 1) * ys[j] + (t3 - 2 * t2 + t) * h * m[j] + (-2 * t3 + 3 * t2) * ys[j + 1] + (t3 - t2) * h * m[j + 1];
      out.push(Math.min(1, Math.max(0, y)).toFixed(4));
    }
    return out.join(' ');
  }
  var nz = [];
  window.FINISH = {
    init: function () {
      var tab = curveTable(CURVE, 33);
      document.querySelectorAll('feFuncR.crv, feFuncG.crv, feFuncB.crv').forEach(function (f) { f.setAttribute('tableValues', tab); });
      nz = Array.prototype.slice.call(document.querySelectorAll('feTurbulence.nz'));
    },
    // same seed on every filter: the scene and text grain are one field, so a word split behind/front stays continuous
    seed: function (t) { var s = String(1 + Math.floor(t * FPS + 0.5)); nz.forEach(function (n) { n.setAttribute('seed', s); }); }
  };
})();
