// Functional smoke test for the optimised build: boot, play a little, and confirm the HUD,
// leaderboard, icon layer and adaptive quality scaler all behave.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = Number(process.env.CDP_PORT || 9222);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((p) => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });

let id = 0;
const pend = new Map();
const errs = [];
ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: 'file:///D:/work/self/myproject/kiomet-offline/kiomet.html' });
for (let i = 0; i < 40; i++) {
    if (await ev('typeof window.kiomet === "object"')) break;
    await sleep(250);
}
await ev(`document.getElementById('spawn').classList.add('hidden'); true`);
await sleep(2500);

const out = {
    errors: errs,
    leaderboardRows: await ev('document.querySelectorAll("#leaderboard .lb-row").length'),
    leaderboardText: (await ev('document.getElementById("leaderboard").textContent') || '').slice(0, 70),
    score: await ev('document.getElementById("score").textContent'),
    towers: await ev('document.getElementById("towers-n").textContent'),
    iconNodes: await ev('document.querySelectorAll("#icons img").length'),
    effectiveDpr: await ev('window.kiomet.renderer.effectiveDpr'),
    qualityCap: await ev('window.kiomet.renderer.qualityCap'),
    language: await ev('document.getElementById("lang-select").value'),
};
console.log(JSON.stringify(out, null, 2));
ws.close();
