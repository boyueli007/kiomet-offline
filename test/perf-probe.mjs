// Performance probe: loads the built game in headless Chrome/Edge via CDP and measures
// frame pacing (rAF deltas), per-frame work, and DOM/icon churn over a few seconds of play.
// Prints a JSON report so the numbers, not guesses, drive the optimisation work.
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'D:/work/self/myproject/kiomet-offline/kiomet.html';
const PORT = Number(process.env.CDP_PORT || 9222);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((p) => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: 'file:///' + FILE });
for (let i = 0; i < 60; i++) {
    if (await evaluate('typeof window.kiomet === "object"')) break;
    await sleep(250);
}

// Instrument: wrap the renderer draw + icon sync to measure their real cost per frame.
await evaluate(`
(() => {
  const app = window.kiomet;
  const R = app.renderer;
  window.__perf = { frames: [], draw: [], icons: [], ticks: [] };
  const origDraw = R.draw.bind(R);
  R.draw = (g, v) => { const t0 = performance.now(); origDraw(g, v); window.__perf.draw.push(performance.now() - t0); };
  const origIcons = app.syncIcons.bind(app);
  app.syncIcons = () => { const t0 = performance.now(); origIcons(); window.__perf.icons.push(performance.now() - t0); };
  const origTick = app.game.tick.bind(app.game);
  app.game.tick = () => { const t0 = performance.now(); origTick(); window.__perf.ticks.push(performance.now() - t0); };
  let last = performance.now();
  const loop = (now) => { window.__perf.frames.push(now - last); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return true;
})()`);

// Let the round get busy: start it, jump the speed and pan/zoom to force redraws.
await evaluate(`document.getElementById('spawn').classList.add('hidden'); document.getElementById('speed-btn').click(); document.getElementById('speed-btn').click(); true`);
await sleep(3000);

// Simulated camera movement for a couple of seconds (the worst case for redraw cost).
await evaluate(`
(() => {
  const app = window.kiomet;
  let n = 0;
  const iv = setInterval(() => {
    app.camera.x += 22; app.camera.y += 9; app.camera.zoom = 12 + 6 * Math.sin(n / 8);
    app.camera.clamp();
    if (++n > 90) clearInterval(iv);
  }, 16);
  return true;
})()`);
await sleep(2200);

const stats = await evaluate(`
(() => {
  const s = (a) => {
    if (!a.length) return null;
    const b = [...a].sort((x, y) => x - y);
    const q = (p) => b[Math.min(b.length - 1, Math.floor(b.length * p))];
    return { n: b.length, mean: +(b.reduce((t, v) => t + v, 0) / b.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +b[b.length - 1].toFixed(2) };
  };
  const P = window.__perf;
  const frames = P.frames.filter((d) => d > 0 && d < 1000);
  const long = frames.filter((d) => d > 33.4).length;
  const huge = frames.filter((d) => d > 100).length;
  return {
    fps: +(1000 / (frames.reduce((t, v) => t + v, 0) / frames.length)).toFixed(1),
    frames: frames.length,
    frameMs: s(frames),
    drawMs: s(P.draw),
    iconSyncMs: s(P.icons),
    tickMs: s(P.ticks),
    over33ms: long,
    over100ms: huge,
    iconNodes: document.querySelectorAll('#icons img').length,
    towersOnMap: window.kiomet.game.towers.size,
    canvasPx: [window.kiomet.renderer.canvas.width, window.kiomet.renderer.canvas.height],
    effectiveDpr: +window.kiomet.renderer.effectiveDpr.toFixed(2),
    forces: window.kiomet.game.forces.length,
  };
})()`);

console.log(JSON.stringify(stats, null, 2));
ws.close();
