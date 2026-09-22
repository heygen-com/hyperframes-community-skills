// Frame-bounds QC for camera-3d-captions. Paste into the comp's preview page (browser pane javascript tool), then:
//   __frameBounds(t0, t1, margin = 24)  -> [{word, from, to, worst}]
// Steps the timeline on the 15-fps grid and flags every word group that sits partly outside the frame (minus margin)
// for 5+ consecutive steps while visible (opacity >= 0.5). Entries that start off-frame and a word flying past the lens
// after it was read are short and drop out; anything listed is a group escaping the frame while it should be read.
window.__frameBounds = function (t0, t1, margin) {
  margin = margin == null ? 24 : margin;
  var root = document.querySelector('[data-composition-id]'), W = +root.dataset.width, H = +root.dataset.height;
  var tl = window.__timelines[Object.keys(window.__timelines)[0]], runs = {}, out = [];
  for (var t = t0; t <= t1 + 1e-6; t += 1 / 15) {
    tl.seek(t, false);
    var seen = {};
    document.querySelectorAll('.wg').forEach(function (g, wi) {
      if (g.style.display === 'none' || !g.getClientRects().length || (g.style.opacity !== '' && +g.style.opacity < 0.5)) return;
      var ghs = g.querySelectorAll('.gh'), mid = ghs[Math.floor(ghs.length / 2)], worst = 0, label = '';
      [].forEach.call(mid.querySelectorAll('.pc'), function (sp) {
        if (sp.style.visibility === 'hidden' || (sp.style.opacity !== '' && +sp.style.opacity < 0.5)) return;
        label += sp.textContent || (sp.style.backgroundImage || '').replace(/^.*\/|\.png.*$/g, '');   // sprites: by file name
        var m = new DOMMatrix(getComputedStyle(sp).transform), w = sp.offsetWidth, h = sp.offsetHeight, box = [[0, 0], [w, 0], [w, h], [0, h]];
        if (sp.tagName === 'SPAN') {                    // text: the INK box (line boxes overhang the letters)
          var cs = getComputedStyle(sp), size = parseFloat(cs.fontSize), cv = window.__fbCanvas || (window.__fbCanvas = document.createElement('canvas').getContext('2d'));
          cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
          var mt = cv.measureText(sp.textContent), base = window.CAM3D.baseOf(g.dataset.font) * size;
          box = [[-mt.actualBoundingBoxLeft, base - mt.actualBoundingBoxAscent], [mt.actualBoundingBoxRight, base - mt.actualBoundingBoxAscent],
                 [mt.actualBoundingBoxRight, base + mt.actualBoundingBoxDescent], [-mt.actualBoundingBoxLeft, base + mt.actualBoundingBoxDescent]];
        }
        box.forEach(function (c) {
          var p = m.transformPoint(new DOMPoint(c[0], c[1]));
          worst = Math.max(worst, margin - p.x, p.x - (W - margin), margin - p.y, p.y - (H - margin));
        });
      });
      if (worst > 0) { var key = (label || g.className) + '@' + wi; seen[key] = worst; }
    });
    Object.keys(runs).forEach(function (k) { if (!(k in seen)) { if (runs[k].n >= 5) out.push(runs[k]); delete runs[k]; } });
    Object.keys(seen).forEach(function (k) {
      var r = runs[k] || (runs[k] = { word: k.split('@')[0], from: +t.toFixed(2), n: 0, worst: 0 });
      r.n++; r.to = +t.toFixed(2); r.worst = Math.max(r.worst, Math.round(seen[k]));
    });
  }
  Object.keys(runs).forEach(function (k) { if (runs[k].n >= 5) out.push(runs[k]); });
  return out;
};
