// Regression test for the un-dismissable tower panel.
//
// The panel could once be closed only by clicking the *same* tower again, which failed in
// practice whenever that tower stopped being clickable. Every dismissal path is covered here:
//   1. Esc
//   2. clicking empty ground
//   3. the visible close button
//   4. the selected tower disappearing (captured / destroyed)
//
// Runs against the built single file in a real browser via CDP.
const PORT = Number(process.env.CDP_PORT || 9222);
const FILE = 'file:///D:/work/self/myproject/kiomet-offline/kiomet.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((p) => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });

let id = 0;
const pend = new Map();
const errors = [];
ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: FILE });
for (let i = 0; i < 60; i++) {
    if (await ev('typeof window.kiomet === "object"')) break;
    await sleep(250);
}
await ev(`document.getElementById('spawn').classList.add('hidden'); true`);
await sleep(700);

const results = [];
const check = (name, pass, detail) => results.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });

const menuHidden = () => ev(`document.getElementById('tower-menu').classList.contains('hidden')`);
const selectOwn = () => ev(`(() => {
  const app = window.kiomet;
  const k = [...app.me.towers][0];
  const t = app.game.towers.get(k);
  if (!t) return false;
  app.selected = null;          // start from a clean state every time
  app.selectTower(t);
  return true;
})()`);

check('存在可测试的己方塔', await selectOwn());
await sleep(200);
check('选中后菜单显示', !(await menuHidden()));

// 1. Esc
await ev(`dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
await sleep(200);
check('Esc 关闭菜单', await menuHidden());

// 2. empty ground click
await selectOwn();
await sleep(200);
const spot = await ev(`(() => {
  const app = window.kiomet;
  const cw = app.renderer.cw, ch = app.renderer.ch;
  for (let sy = 60; sy < ch - 60; sy += 13) {
    for (let sx = 60; sx < cw - 60; sx += 13) {
      const [wx, wy] = app.camera.toWorld(sx, sy, cw, ch);
      if (!app.towerAtWorld(wx, wy)) return { sx, sy };
    }
  }
  return null;
})()`);
check('找到了空白地面坐标', !!spot);
if (spot) {
  await ev(`(() => {
    const cv = document.getElementById('canvas');
    const r = cv.getBoundingClientRect();
    const o = { pointerId: 11, clientX: r.left + ${spot.sx}, clientY: r.top + ${spot.sy},
                bubbles: true, cancelable: true, button: 0, buttons: 1, isPrimary: true, pointerType: 'mouse' };
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    cv.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
    return true;
  })()`);
  await sleep(300);
  check('点击空白地面关闭菜单', await menuHidden());
}

// 3. close button
await selectOwn();
await sleep(200);
const hasBtn = await ev(`!!document.querySelector('#tower-menu .tm-close')`);
check('菜单上有可见关闭按钮', hasBtn);
if (hasBtn) {
  await ev(`document.querySelector('#tower-menu .tm-close').click(); true`);
  await sleep(250);
  check('关闭按钮关闭菜单', await menuHidden());
}

// 4. selected tower disappears
await selectOwn();
await sleep(200);
await ev(`(() => {
  const app = window.kiomet;
  app.selected = { x: 999, y: 999 };     // a cell that holds no tower at all
  app.validateSelection();
  return true;
})()`);
await sleep(250);
check('选中塔失效后不会卡住菜单', await menuHidden());

// 5. no uncaught errors during any of the above
check('过程中无未捕获异常', errors.length === 0, errors.length ? errors : undefined);

console.log(JSON.stringify({ results, errors }, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `\nFAILED: ${failed.length}` : '\nALL PASSED');
ws.close();
process.exit(failed.length ? 1 : 0);
