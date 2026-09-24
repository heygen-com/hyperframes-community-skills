// hf-bridge.js: runs the kit natively inside a HyperFrames composition.
//
// HyperFrames seeks the page once per frame and dispatches `hf-seek` with { time, waitUntil }. p5.brush paints
// asynchronously (p5 2.x redraw() is a promise), so each seek hands its paint promise to waitUntil(): the renderer
// waits for it before it captures the frame. Setup is held with window.__hf.buildReady until p5 is drawable.
//
// Load order: config.js → core.js → clawd.js → timeline.js → hf-bridge.js → your scene files.
(() => {
  let resolveReady;
  // p5.brush's first paint on a page composites wrong (paper only), and HF dedups a repeat seek to the same time, so
  // the init paint at t=0 would be captured as frame 0. Paint once to warm up before anything can capture.
  const READY = new Promise(r => { resolveReady = r; }).then(() => window.paintAt(0));
  window.__clawdReady = resolveReady;   // core.js setup() calls this once the canvas, brushes, paper and grain exist

  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady.clawd = READY;

  // One paint at a time. Studio scrubbing can fire seeks faster than frames paint: only the latest time is painted,
  // and every waiter resolves once the frame that superseded it is up. Rendering awaits each seek, so it never skips.
  let want = null, waiters = [], busy = false;
  async function pump() {
    busy = true;
    await READY;
    while (want !== null) {
      const t = want, ws = waiters;
      want = null; waiters = [];
      try { await window.paintAt(t); }
      catch (e) { console.error('[clawd] paint failed at t=' + t, e); }
      ws.forEach(r => r());
    }
    busy = false;
  }
  function request(t) {
    want = t;
    const p = new Promise(r => waiters.push(r));
    if (!busy) pump();
    return p;
  }

  window.addEventListener('hf-seek', e => {
    const p = request(Math.max(0, Number(e.detail && e.detail.time) || 0));
    if (e.detail && typeof e.detail.waitUntil === 'function') e.detail.waitUntil(p);
  });
  READY.then(() => request(window.__hfThreeTime || 0));
})();
