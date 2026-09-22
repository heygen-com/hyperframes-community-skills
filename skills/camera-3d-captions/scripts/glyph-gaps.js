// Glyph-gap QC for camera-3d-captions. Paste into the comp's preview page (browser pane javascript tool), then:
//   __glyphGaps(t)            -> { t, words: "word min..max (pair)", cross: [...] }
// Measures the oriented INK box of every visible glyph (canvas measureText + the span's own transform) on the middle
// motion-blur ghost. Word gaps are in font px (normalised by glyph scale); cross lists glyphs of different words closer
// than 4 screen px. At rest: every word min > 0 and cross empty.
window.__glyphGaps = function (t) {
  var tl = window.__timelines[Object.keys(window.__timelines)[0]]; tl.seek(t, false);
  var cv = document.createElement('canvas').getContext('2d'), glyphs = [];
  document.querySelectorAll('.wg').forEach(function (g, wi) {
    if (g.style.display === 'none' || +g.style.opacity === 0 || !g.getClientRects().length) return;   // incl. hidden shots
    var ghs = g.querySelectorAll('.gh'), mid = ghs[Math.floor(ghs.length / 2)];
    var spans = [].slice.call(mid.querySelectorAll('.pc')); if (!spans.length) return;
    var cs = getComputedStyle(spans[0]), size = parseFloat(cs.fontSize);
    cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var text = spans.map(function (s) { return s.textContent; }).join(''), base = window.CAM3D.baseOf(g.dataset.font) * size;
    spans.forEach(function (sp, i) {
      if (sp.style.visibility === 'hidden' || (sp.style.opacity !== '' && +sp.style.opacity < 0.25) || sp.textContent.trim() === '') return;
      var m = new DOMMatrix(getComputedStyle(sp).transform), mt = cv.measureText(sp.textContent);
      var loc = [[-mt.actualBoundingBoxLeft, base - mt.actualBoundingBoxAscent], [mt.actualBoundingBoxRight, base - mt.actualBoundingBoxAscent],
                 [mt.actualBoundingBoxRight, base + mt.actualBoundingBoxDescent], [-mt.actualBoundingBoxLeft, base + mt.actualBoundingBoxDescent]];
      glyphs.push({ text: text, key: text + '@' + wi, i: i, ch: sp.textContent, sc: Math.hypot(m.a, m.b),
        q: loc.map(function (p) { var r = m.transformPoint(new DOMPoint(p[0], p[1])); return [r.x, r.y]; }) });
    });
  });
  function axes(q) { var a = []; for (var k = 0; k < 2; k++) { var dx = q[k + 1][0] - q[k][0], dy = q[k + 1][1] - q[k][1], L = Math.hypot(dx, dy) || 1; a.push([-dy / L, dx / L]); } return a; }
  function sep(A, B) {
    var best = -1e9; axes(A).concat(axes(B)).forEach(function (ax) {
      var pa = A.map(function (p) { return p[0] * ax[0] + p[1] * ax[1]; }), pb = B.map(function (p) { return p[0] * ax[0] + p[1] * ax[1]; });
      best = Math.max(best, Math.max(Math.min.apply(0, pb) - Math.max.apply(0, pa), Math.min.apply(0, pa) - Math.max.apply(0, pb)));
    }); return best;
  }
  var by = {}; glyphs.forEach(function (g) { (by[g.key] = by[g.key] || []).push(g); });
  var words = [];
  Object.keys(by).forEach(function (key) {
    var text = key.split('@')[0], gs = by[key].sort(function (a, b) { return a.i - b.i; }), mn = 1e9, mx = -1e9, where = '';
    for (var k = 1; k < gs.length; k++) { if (gs[k].i - gs[k - 1].i !== 1) continue; var s = sep(gs[k - 1].q, gs[k].q) / ((gs[k].sc + gs[k - 1].sc) / 2); if (s < mn) { mn = s; where = gs[k - 1].ch + gs[k].ch; } mx = Math.max(mx, s); }
    if (mn < 1e8) words.push(text + ' ' + mn.toFixed(1) + '..' + mx.toFixed(1) + ' (' + where + ')');
  });
  var cross = [];
  for (var a = 0; a < glyphs.length; a++) for (var b = a + 1; b < glyphs.length; b++) {
    if (glyphs[a].text === glyphs[b].text) continue;   // same word (incl. its behind/front twin)
    var s = sep(glyphs[a].q, glyphs[b].q);
    if (s < 4) cross.push(glyphs[a].ch + '|' + glyphs[b].ch + ' ' + glyphs[a].text + '/' + glyphs[b].text + ' ' + s.toFixed(1));
  }
  return { t: t, words: words.join(' · '), cross: cross.slice(0, 10) };
};
