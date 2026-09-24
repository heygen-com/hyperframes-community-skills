// hf-bridge.js: runs the ink kit natively inside a HyperFrames composition.
//
// HyperFrames dispatches `hf-seek` with { time, waitUntil } on every seek. p5.brush paints asynchronously, so each seek
// hands its paint promise to waitUntil() and the renderer waits for it before capturing. Setup is held with
// window.__hf.buildReady until p5 is drawable. Every drawing holds 1/8 s, so a seek that lands on the drawing already
// on the canvas resolves at once (2 of every 3 frames at 24 fps).
// Load order: p5 → p5.brush → brush-ink.js → props.js → film.js → hf-bridge.js → scenes.
(() => {
  if (location.search.includes('nobridge')) return;   // still harness (tools/shoot.mjs) drives renderAt itself
  let resolveReady;
  const READY = new Promise(r => { resolveReady = r; }).then(() => window.paintAt(0));   // warm-up paint (first composite is wrong)
  window.__inkReady = resolveReady;
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady.ink = READY;

  let want = null, waiters = [], busy = false, onCanvas = null;
  async function pump() {
    busy = true;
    await READY;
    while (want !== null) {
      const t = want, ws = waiters; want = null; waiters = [];
      const step = Math.floor(t * BOIL + 1e-6);
      try { if (step !== onCanvas) { await window.paintAt(t); onCanvas = step; } }
      catch (e) { console.error('[ink] paint failed at t=' + t, e); }
      ws.forEach(r => r());
    }
    busy = false;
  }
  function request(t) { want = t; const p = new Promise(r => waiters.push(r)); if (!busy) pump(); return p; }
  window.addEventListener('hf-seek', e => {
    const p = request(Math.max(0, Number(e.detail && e.detail.time) || 0));
    if (e.detail && typeof e.detail.waitUntil === 'function') e.detail.waitUntil(p);
  });
  READY.then(() => request(window.__hfThreeTime || 0));
})();
