// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Game loop, input handling and DOM overlays (tower menu, alerts, leaderboard, dialogs).

import {
    UNITS, UNIT_ID, TOWER, TOWERS, TICK_HZ, SHIELD, RULER, SPAWNABLE,
    meetsPrereqs, isMobile, RULER_SHIELD_BOOST,
} from './data.js';
import { integerPosition, neighbors, distance } from './geom.js';
import { Units } from './rules.js';
import { Game, Player } from './world.js';
import { botUpdate } from './bot.js';
import { TOWER_SVG, UNIT_SVG } from './glyphs.js';
import { Visibility } from './fog.js';
import { Effects } from './effects.js';
import { AlertBoard } from './alerts.js';
import { Renderer, COLORS } from './render.js';

const LABEL = {
    Ews: 'EWS', Emp: 'EMP', Ruler: 'King',
};

const D = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
};
const fmt = (n) => String(n);

export class App {
    constructor() {
        this.canvas = D('canvas');
        this.renderer = new Renderer(this.canvas);
        this.camera = this.renderer.camera;
        this.name = localStorage.getItem('kiomet-name') || 'Guesty';
        this.godMode = localStorage.getItem('kiomet-god') === '1';
        // Fog of war (on by default, like the real game). B toggles it, as upstream cheats do.
        this.fogEnabled = localStorage.getItem('kiomet-fog') !== '0';
        this.speed = 1;
        this.paused = false;
        this.selected = null;
        this.drag = null;               // {from, to, startTime, path}
        this.pan = null;
        this.pinching = null;
        this.keys = new Set();
        this.lastFrame = performance.now();
        this.acc = 0;
        this.game = null;
        this.newGame();
        this.bindInput();
        this.bindUi();
        requestAnimationFrame((t) => this.frame(t));
    }

    // ---------------- game lifecycle ----------------
    newGame(keepName) {
        const me = new Player(0, this.name, { rank: 3 });
        this.me = me;
        const bots = [];
        const botNames = ['Borus', 'Cynder', 'Draven', 'Eldra', 'Fenn', 'Grim', 'Hollis', 'Isolde',
            'Jorik', 'Kael', 'Lysa', 'Mira', 'Nyx', 'Orin', 'Perrin', 'Quill'];
        for (let i = 0; i < 9; i++) {
            const n = botNames[(i * 5 + Math.floor(Math.random() * 16)) % botNames.length];
            bots.push(new Player(i + 1, n + (i > 7 ? i : ''), { bot: true, rank: 1 }));
        }
        const game = new Game({
            shrink: true,
            botUpdate: (g, p) => {
                if (p.id === 0) return;
                botUpdate(g, p);
            },
        });
        game.players = [me, ...bots];
        game.onEvent = (e) => this.onGameEvent(e);
        this.visibility = new Visibility();
        this.effects = new Effects();
        this.alertBoard = new AlertBoard();
        this.game = game;
        game.spawnPlayer(me);
        for (const b of bots) {
            if (Math.random() < 0.75) game.spawnPlayer(b);
        }
        if (this.effects) this.effects.clear();
        if (this.alertBoard) this.alertBoard.reset();
        this.camera.x = 1280; this.camera.y = 1280; this.camera.zoom = 16;
        if (me.rulerKey != null) this.panToKey(me.rulerKey, false);
        this.selected = null;
        this.renderMenu();
        this.renderAlerts();
        this.showDeath(false);
    }

    panToKey(k, animate = true) {
        const t = this.game.towers.get(k);
        if (!t) return;
        const p = integerPosition(t.x, t.y);
        this.camera.x = p[0]; this.camera.y = p[1];
    }

    centreOn(t) {
        const p = integerPosition(t.x, t.y);
        this.camera.x = p[0]; this.camera.y = p[1];
    }

    // ---------------- frame loop ----------------
    frame(now) {
        const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        if (!this.paused) {
            this.acc += dt * this.speed;
            let steps = 0;
            while (this.acc >= 1 / TICK_HZ && steps < 8) {
                this.game.tick();
                this.visibility.invalidate();
                this.acc -= 1 / TICK_HZ;
                steps += 1;
            }
        }
        this.handleKeyboardPan(dt);
        // Icon overlay follows the camera; refresh it every frame like the canvas.
        this.syncIcons();
        this.updateVisibility();
        this.renderer.draw(this.game, {
            playerId: this.me.id,
            allies: this.me.allies,
            selected: this.selected,
            dragPath: this.dragPath,
            dragValid: this.dragValid,
            markType: this.markType(),
            showSupplyLines: this.showSupplyLines,
            fog: (t) => this.isVisible(t),
        });
        // Once per game second (and once right after any pause), same cadence as the server.
        if (this.game.time !== this.lastAlertTick) {
            this.lastAlertTick = this.game.time;
            this.renderGameAlerts();
        }
        this.effects.meId = this.me.id;
        this.effects.cameraAt = [this.camera.x, this.camera.y];
        this.effects.render(this.renderer.ctx, (x, y) => this.camera.toScreen(x, y, this.renderer.cw, this.renderer.ch), this.camera.zoom, dt);
        this.updateHud();
        if (this.selected) this.positionMenu();
        requestAnimationFrame((t) => this.frame(t));
    }

    closeMenuOnPan() {
        this.selected = null;
        this.lastAlertSig = null;
        this.renderMenu();
    }

    // Fog of war is a player setting (default on, like the real game).
    updateVisibility() {
        const vis = this.visibility;
        const allVisible = !this.fogEnabled || !this.me.alive;
        vis.update(this.game, this.me.id, allVisible);
        if (!allVisible) vis.addAllies(this.game, this.me.allies);
    }

    // Holding T highlights every tower of the selected kind (Kiomet's "mark every tower").
    markType() {
        if (!this.keys.has('t') || !this.selected) return null;
        const t = this.game.getTower(this.selected);
        return t ? t.type : null;
    }

    isVisible(t) {
        if (!this.fogEnabled || !this.me.alive) return true;
        return this.visibility.visible(t);
    }

    handleKeyboardPan(dt) {
        const sp = 520 / this.camera.zoom * dt * 12;
        let dx = 0, dy = 0;
        if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= sp;
        if (this.keys.has('d') || this.keys.has('arrowright')) dx += sp;
        if (this.keys.has('w') || this.keys.has('arrowup')) dy -= sp;
        if (this.keys.has('s') || this.keys.has('arrowdown')) dy += sp;
        if (dx || dy) {
            this.camera.x += dx; this.camera.y += dy;
            this.panTarget = null;
            this.camera.clamp();
            if (this.selected) this.closeMenuOnPan();
        }
        // A queued "find my King" glides the camera instead of teleporting.
        if (this.panTarget) {
            const k = Math.min(1, dt * 8);
            this.camera.x += (this.panTarget.x - this.camera.x) * k;
            this.camera.y += (this.panTarget.y - this.camera.y) * k;
            if (Math.hypot(this.panTarget.x - this.camera.x, this.panTarget.y - this.camera.y) < 0.5) {
                this.panTarget = null;
            }
            this.camera.clamp();
        }
    }

    // ---------------- input ----------------
    bindInput() {
        const cv = this.canvas;
        cv.addEventListener('contextmenu', (e) => e.preventDefault());

        cv.addEventListener('pointerdown', (e) => {
            this.effects.ensureAudio();
            if (this.effects.audio && this.effects.audio.state === 'suspended') this.effects.audio.resume();
            cv.setPointerCapture(e.pointerId);
            this.pointers = this.pointers || new Map();
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                this.pinching = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.camera.zoom };
                this.drag = null;
                return;
            }
            if (e.button === 2 || e.shiftKey) {
                this.pan = { x: e.clientX, y: e.clientY, cx: this.camera.x, cy: this.camera.y };
                return;
            }
            const [wx, wy] = this.camera.toWorld(e.clientX, e.clientY, this.renderer.cw, this.renderer.ch);
            const t = this.towerAtWorld(wx, wy);
            this.drag = null;
            this.dragPath = null;
            if (t && t.owner === this.me.id) {
                this.drag = { from: t, startX: e.clientX, startY: e.clientY, path: null, moved: false };
            }
        });

        cv.addEventListener('pointermove', (e) => {
            if (this.pointers && this.pointers.has(e.pointerId)) {
                this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }
            if (this.pinching && this.pointers.size >= 2) {
                const [a, b] = [...this.pointers.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                this.camera.zoom = Math.max(7, Math.min(64, this.pinching.zoom * (d / this.pinching.d)));
                return;
            }
            if (this.pan) {
                this.camera.x = this.pan.cx - (e.clientX - this.pan.x) / this.camera.zoom;
                this.camera.y = this.pan.cy - (e.clientY - this.pan.y) / this.camera.zoom;
                this.camera.clamp();
                return;
            }
            if (this.drag) {
                this.updateDrag(e);
            }
        });

        const end = (e) => {
            if (this.pointers) this.pointers.delete(e.pointerId);
            if (this.pointers && this.pointers.size < 2) this.pinching = null;
            if (this.pan) { this.pan = null; return; }
            if (this.drag) this.finishDrag(e);
        };
        cv.addEventListener('pointerup', end);
        cv.addEventListener('pointercancel', end);
        cv.addEventListener('lostpointercapture', end);
        addEventListener('pointerup', (e) => { if (this.drag) end(e); });

        cv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const [wx, wy] = this.camera.toWorld(e.clientX, e.clientY, this.renderer.cw, this.renderer.ch);
            const f = Math.exp(-e.deltaY * 0.0015);
            this.camera.zoom = Math.max(7, Math.min(64, this.camera.zoom * f));
            const [nx, ny] = this.camera.toWorld(e.clientX, e.clientY, this.renderer.cw, this.renderer.ch);
            this.camera.x += wx - nx; this.camera.y += wy - ny;
            this.camera.clamp();
        }, { passive: false });

        addEventListener('pointermove', (e) => {
            // Drag preview continues even if the pointer leaves the canvas.
            if (this.drag) this.updateDrag(e);
        });

        addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            this.keys.add(k);
            if (k === 'escape') { this.selected = null; this.renderMenu(); this.closeDialog(); }
            if (k === 'h') {
                const t = this.me.rulerKey != null ? this.game.towers.get(this.me.rulerKey) : null;
                if (t) { const p = integerPosition(t.x, t.y); this.panTarget = { x: p[0], y: p[1] }; }
            }
            if (k === 'q') { this.camera.zoom = Math.max(7, this.camera.zoom / 1.2); }
            if (k === 'e') { this.camera.zoom = Math.min(64, this.camera.zoom * 1.2); }
            if (k === 'r' && !e.shiftKey) {
                this.showSupplyLines = !this.showSupplyLines;
                this.toast(this.showSupplyLines ? 'Showing all supply lines (R)' : 'Supply lines hidden');
            } else if (k === 'r' && e.shiftKey) {
                this.clearSupplyLines();
            }
            if (k === 'b') this.toggleFog();
            if (k === ' ') { e.preventDefault(); this.togglePause(); }
        });
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        addEventListener('resize', () => this.renderer.resize());
    }

    // Which tower is under the pointer? Each sprite stands on a jittered point inside its
    // 5x5 world cell, so search the neighbouring cells and take the nearest *cell centre*
    // (the same point the sprite is drawn around); a generous tap radius keeps fat fingers
    // working without ever stealing the tap from a closer neighbour.
    towerAtWorld(wx, wy) {
        let best = null, bestD = Infinity;
        const cx = Math.round(wx / 5), cy = Math.round(wy / 5);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const t = this.game.tower(cx + dx, cy + dy);
                if (!t) continue;
                const d = Math.hypot(t.x * 5 - wx, t.y * 5 - wy);
                if (d < bestD) { best = t; bestD = d; }
            }
        }
        if (!best) return null;
        const tapRadius = Math.max(3, Math.min(6, 34 / this.camera.zoom));
        return bestD <= tapRadius ? best : null;
    }

    updateDrag(e) {
        const [wx, wy] = this.camera.toWorld(e.clientX, e.clientY, this.renderer.cw, this.renderer.ch);
        if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 6) this.drag.moved = true;
        const t = this.towerAtWorld(wx, wy);
        if (t !== this.drag.to) this.drag.hoverSince = performance.now();
        this.drag.to = t;
        if (!t || !this.drag.moved) { this.dragPath = null; return; }
        const maxEdge = this.drag.from.forceUnits().maxEdgeDistance();
        const path = this.game.findBestPath(this.drag.from.id, t.id, maxEdge, this.me.id);
        this.drag.path = path;
        this.dragPath = path || [this.drag.from.id, t.id];
        this.dragValid = !!path;
    }

    // Kiomet makes you *hold* the pointer on the destination before it will march the King
    // through land you don't own (RULER_DRAG_DELAY).
    rulerNeedsConfirm(drag) {
        const path = drag.path;
        if (!path || !drag.to) return false;
        if (!drag.from.units.hasRuler()) return false;
        const perilous = path.some((id) => {
            const t = this.game.getTower(id);
            return !t || t.owner !== this.me.id;
        });
        if (!perilous) return false;
        return (performance.now() - (drag.hoverSince || 0)) < 1200;
    }

    finishDrag(e) {
        const drag = this.drag;
        this.drag = null;
        this.dragPath = null;
        if (!drag.moved) {
            // A click: select the tower / close the menu.
            this.selectTower(drag.from);
            return;
        }
        if (!drag.to) return;
        const path = drag.path;
        if (!path) return;
        if (this.rulerNeedsConfirm(drag)) {
            this.toast('Hold the pointer on the destination for a moment to send your King');
            return;
        }
        const src = drag.from;
        const sameAsSelection = this.selected && this.selected.x === src.x && this.selected.y === src.y;
        const err = sameAsSelection
            ? this.game.setSupplyLine(this.me.id, src.id, path)
            : this.game.deploy(this.me.id, src.id, path);
        if (err) this.toast(err);
        else if (!sameAsSelection) this.alertBoard.onCapture();
    }

    // Shift+R: drop the selected tower's line, else one visible line per press (like upstream).
    clearSupplyLines() {
        const mine = [...this.me.towers].map((k) => this.game.towers.get(k)).filter(Boolean);
        const sel = this.selected ? this.game.getTower(this.selected) : null;
        if (sel && sel.supply) {
            this.game.setSupplyLine(this.me.id, sel.id, null);
            this.renderMenu();
            return;
        }
        const line = mine.find((t) => t.supply);
        if (line) {
            this.game.setSupplyLine(this.me.id, line.id, null);
            this.toast('Supply line removed');
        } else {
            this.toast('No supply lines to remove');
        }
    }

    selectTower(t) {
        if (this.selected && this.selected.x === t.x && this.selected.y === t.y) {
            this.selected = null;
        } else {
            this.selected = { x: t.x, y: t.y };
        }
        this.renderMenu();
    }

    // ---------------- menu ----------------
    positionMenu() {
        const menu = D('tower-menu');
        const t = this.game.getTower(this.selected);
        if (!t) { this.selected = null; menu.classList.add('hidden'); return; }
        const p = integerPosition(t.x, t.y);
        const [sx, sy] = this.camera.toScreen(p[0], p[1], this.renderer.cw, this.renderer.ch);
        const w = menu.offsetWidth || 200, h = menu.offsetHeight || 120;
        let left = sx + 18, top = sy - h / 2;
        if (left + w > this.renderer.cw - 8) left = sx - w - 18;
        top = Math.max(8, Math.min(this.renderer.ch - h - 8, top));
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    renderMenu() {
        const menu = D('tower-menu');
        menu.innerHTML = '';
        const t = this.selected ? this.game.getTower(this.selected) : null;
        if (!t) { menu.classList.add('hidden'); return; }
        menu.classList.remove('hidden');

        const isMine = t.owner === this.me.id;
        const type = TOWER[t.type];
        const head = el('div', 'tm-head');
        head.appendChild(el('img', 'tm-icon', ''));
        head.querySelector('img').src = this.svgUrl(t.type, 'rgb(116,185,255)');
        head.appendChild(el('span', 'tm-title', LABEL[t.type] || t.type));
        if (t.owner != null) {
            const p = this.game.players[t.owner];
            head.appendChild(el('span', 'tm-owner', p ? p.name : ''));
        }
        menu.appendChild(head);

        if (t.delay > 0) {
            menu.appendChild(el('div', 'tm-delay', `Upgrading… ${Math.ceil(t.delay / TICK_HZ)}s`));
        }

        // Unit rows (only what the tower can make, or already holds).
        const rows = el('div', 'tm-units');
        for (const [u, c] of t.units.counts()) {
            const cap = t.units.capacity(u, t.type);
            rows.appendChild(this.unitRow(u, c, cap));
        }
        for (const name of Object.keys(type.gen)) {
            const u = UNIT_ID[name];
            if (c2(t, u)) continue;
            rows.appendChild(this.unitRow(u, 0, t.units.capacity(u, t.type)));
        }
        if (t.units.hasRuler()) rows.appendChild(this.unitRow(RULER, 1, 1));
        menu.appendChild(rows);

        if (isMine && t.active) {
            const ups = el('div', 'tm-ups');
            const opts = [...TOWER[t.type].upgrades];
            if (type.basis !== t.type) opts.push(type.basis);
            for (const name of opts) {
                const up = TOWER[name];
                const down = name === type.basis;
                const ok = down ? true : meetsPrereqs(name, this.me.towerCounts);
                const row = el('button', 'tm-up' + (down ? ' down' : '') + (ok ? '' : ' locked'));
                row.title = (down ? 'Downgrade to ' : 'Upgrade to ') + name;
                const ic = el('img', 'tm-up-icon');
                ic.src = this.svgUrl(name, down ? 'rgb(192,57,43)' : 'rgb(116,185,255)');
                row.appendChild(ic);
                if (!down) {
                    const req = el('div', 'tm-req');
                    for (const [pre, n] of up.prereqs) {
                        const have = this.me.towerCounts[pre] || 0;
                        const r = el('span', 'tm-req-item' + (have >= n ? ' ok' : ''));
                        const im = el('img', 'tm-req-icon');
                        im.src = this.svgUrl(pre, have >= n ? 'rgb(116,185,255)' : 'rgb(150,150,150)');
                        r.appendChild(im);
                        r.appendChild(el('b', '', `${have}/${n}`));
                        req.appendChild(r);
                    }
                    row.appendChild(req);
                }
                row.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (!ok) { this.toast('Missing prerequisite'); return; }
                    const err = this.game.upgradeTower(this.me.id, t.id, name);
                    if (err) this.toast(err);
                    else { this.alertBoard.onUpgrade(); this.renderMenu(); }
                });
                ups.appendChild(row);
            }
            menu.appendChild(ups);

            if (t.supply) {
                const b = el('button', 'tm-btn', 'Cancel supply line');
                b.addEventListener('click', () => {
                    this.game.setSupplyLine(this.me.id, t.id, null);
                    this.renderMenu();
                });
                menu.appendChild(b);
            }
            menu.appendChild(el('div', 'tm-hint', t.generatesMobile()
                ? 'Drag to send units. Select first, then drag to set a supply line.'
                : 'Drag to send units.'));
        } else if (t.owner != null && t.owner !== this.me.id) {
            const p = this.game.players[t.owner];
            const allied = this.me.allies.has(t.owner);
            const pending = p && p.allies.has(this.me.id) && !allied;
            const b = el('button', 'tm-btn' + (allied ? ' danger' : ''),
                allied ? 'Break alliance' : (pending ? 'Accept alliance' : 'Request alliance'));
            b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.game.requestAlliance(this.me.id, t.owner);
                this.renderMenu();
            });
            menu.appendChild(b);
        } else {
            menu.appendChild(el('div', 'tm-hint', t.owner == null ? 'Unowned' : ''));
        }

        this.positionMenu();
    }

    svgUrl(type, color) {
        const svg = (TOWER_SVG[type] || '').replace(/stroke="#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"/g, `stroke="${color}"`);
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }

    unitRow(u, count, cap) {
        const row = el('div', 'tm-unit');
        row.title = LABEL[UNITS[u].name] || UNITS[u].name;
        const badge = el('span', 'unit-' + UNITS[u].name.toLowerCase());
        row.appendChild(badge);
        row.appendChild(el('span', 'tm-count', `${count}/${cap}`));
        if (TOWER_GEN_HINT[u]) row.appendChild(el('span', 'tm-gen', TOWER_GEN_HINT[u]));
        return row;
    }

    // ---------------- icon overlay ----------------
    // Towers are drawn as absolutely positioned <img> elements: crisp SVG at any zoom, and
    // it sidesteps canvas quirks entirely.
    syncIcons() {
        if (!this.iconLayer) {
            this.iconLayer = D('icons');
            this.iconEls = new Map();
        }
        const z = this.camera.zoom;
        const { cw, ch } = this.renderer;
        const size = Math.max(14, z * 1.35);
        const seen = new Set();
        const padX = cw / 2 / z + 4, padY = ch / 2 / z + 4;
        for (const t of this.game.towers.values()) {
            const wp = integerPosition(t.x, t.y);
            const wx = wp[0], wy = wp[1];
            if (Math.abs(wx - this.camera.x) > padX || Math.abs(wy - this.camera.y) > padY) continue;
            if (!this.isVisible(t)) continue;
            const k = t.y * 512 + t.x;
            seen.add(k);
            const [sx, sy] = this.camera.toScreen(wx, wy, cw, ch);
            let el = this.iconEls.get(k);
            if (!el) {
                el = document.createElement('img');
                el.className = 'tico';
                this.iconLayer.appendChild(el);
                this.iconEls.set(k, el);
            }
            const c = this.colorForRgb(t.owner);
            const key = t.type + c.join(',');
            if (el.dataset.key !== key) {
                el.src = this.svgUrl(t.type, `rgb(${c.join(',')})`);
                el.dataset.key = key;
            }
            el.style.width = size + 'px';
            el.style.height = size + 'px';
            el.style.left = (sx - size / 2) + 'px';
            el.style.top = (sy - size * 0.95) + 'px';
            el.style.opacity = t.owner == null ? 0.85 : 1;
        }
        for (const [k, el] of this.iconEls) {
            if (!seen.has(k)) { el.remove(); this.iconEls.delete(k); }
        }
    }

    colorForRgb(owner) {
        if (owner == null) return COLORS.neutral;
        if (owner === this.me.id) return COLORS.me;
        if (this.me.allies.has(owner)) return COLORS.ally;
        return COLORS.enemy;
    }

    // ---------------- HUD ----------------
    updateHud() {
        const me = this.me;
        D('score').textContent = fmt(me.score);
        D('towers-n').textContent = fmt(me.towers.size);
        const rank = document.querySelectorAll('#leaderboard .lb-row');
        const rows = this.game.players
            .filter((p) => p.alive || p.id === me.id)
            .map((p) => ({ p, score: p.id === me.id ? me.score : p.score, n: p.towers.size }))
            .sort((a, b) => b.score - a.score || b.n - a.n)
            .slice(0, 10);
        const lb = D('leaderboard');
        let html = '<div class="lb-head">Leaderboard</div>';
        rows.forEach((r, i) => {
            const mine = r.p.id === me.id;
            const col = this.colorCss(r.p.id);
            html += `<div class="lb-row${mine ? ' me' : ''}"><span class="lb-n">${i + 1}.</span>` +
                `<span class="lb-dot" style="background:${col}"></span>` +
                `<span class="lb-name">${escapeHtml(r.p.name)}</span>` +
                `<span class="lb-score">${r.score}</span></div>`;
        });
        html += `<div class="lb-foot">${fmt(this.game.towers.size)} towers · ${this.game.players.filter((p) => p.alive).length} players</div>`;
        lb.innerHTML = html;
        D('alive-dot').style.background = me.alive ? '#74b9ff' : '#c0392b';
    }

    colorCss(owner) {
        const c = owner === this.me.id ? COLORS.me : this.me.allies.has(owner) ? COLORS.ally : COLORS.enemy;
        return `rgb(${c[0]},${c[1]},${c[2]})`;
    }

    // ---------------- alerts ----------------
    onGameEvent(e) {
        // Battle feedback (particles + blips) for anything the player could plausibly see.
        // Engine events carry either a tower id, a bare {x,y} cell, or a world position.
        let pos = null, tower = null;
        if (e.tower) {
            tower = this.game.getTower(e.tower);
            pos = tower ? integerPosition(tower.x, tower.y) : null;
        } else if (e.pos) {
            pos = e.pos;
        }
        // Only show feedback for things the player can actually see.
        const visible = tower ? this.isVisible(tower)
            : !this.fogEnabled || !this.me.alive || !pos ? true
                : this.visibility.near(pos[0], pos[1], this.game);
        if (pos && visible) this.effects.onEvent(e, pos);
        if (e.type === 'ruler' && e.player === this.me.id) {
            this.alerts.unshift({ text: 'Your King was killed!', sub: '', kind: 'bad', until: performance.now() + 8000 });
        }
        if (e.type === 'died' && e.player === this.me.id) {
            this.showDeath(true);
        }
    }

    renderAlerts() { /* alerts are pushed in pushAlert */ }

    pushAlert(text, sub, kind = 'info', ms = 7000) {
        this.alerts = this.alerts || [];
        if (this.alerts.some((a) => a.text === text)) return;
        this.alerts.unshift({ text, sub, kind, until: performance.now() + ms });
        this.renderAlertList();
    }

    // The Kiomet-style alert column (King safety, tutorial, full/overflow, zombies).
    renderGameAlerts() {
        const list = this.alertBoard.evaluate(this.game, this.me);
        const box = D('game-alerts');
        if (!box) return;
        const sig = list.map((a) => a.kind + (a.tower ? a.tower.x + ':' + a.tower.y : '')).join(',');
        if (sig === this.lastAlertSig) return;
        this.lastAlertSig = sig;
        box.innerHTML = '';
        for (const a of list) {
            const row = el('div', 'galert ' + a.kind);
            const txt = el('div', 'galert-text');
            txt.appendChild(el('div', 'galert-main', a.title));
            txt.appendChild(el('div', 'galert-sub', a.hint));
            row.appendChild(txt);
            if (a.tower) {
                row.title = 'Click to jump';
                row.addEventListener('click', () => {
                    const t = this.game.getTower(a.tower);
                    if (t) { this.centreOn(t); this.selected = { x: t.x, y: t.y }; this.renderMenu(); }
                });
            }
            const x = el('span', 'galert-x', '✘');
            x.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.alertBoard.dismiss(a.kind);
                this.lastAlertSig = null;
                this.renderGameAlerts();
            });
            row.appendChild(x);
            box.appendChild(row);
        }
    }

    renderAlertList() {
        const box = D('alerts');
        const now = performance.now();
        this.alerts = (this.alerts || []).filter((a) => a.until > now);
        box.innerHTML = '';
        for (const a of this.alerts.slice(0, 4)) {
            const row = el('div', 'alert ' + a.kind);
            row.appendChild(el('span', 'alert-dot'));
            const txt = el('div', 'alert-text');
            txt.appendChild(el('div', 'alert-main', escapeHtml(a.text)));
            if (a.sub) txt.appendChild(el('div', 'alert-sub', escapeHtml(a.sub)));
            row.appendChild(txt);
            const x = el('span', 'alert-x', '✘');
            x.addEventListener('click', () => { a.until = 0; this.renderAlertList(); });
            row.appendChild(x);
            box.appendChild(row);
        }
    }

    // DeathReason::RulerKilled { alias, unit } -> "King killed by <alias>'s <unit>!"
    deathText() {
        const p = this.game.players[this.me.id];
        const r = p && p.deathReason;
        if (!r) return 'Your King was killed!';
        const who = r.killer == null ? 'zombies' : `${this.game.players[r.killer] ? this.game.players[r.killer].name : 'someone'}'s`;
        const what = r.unit == null ? '' : ` ${UNITS[r.unit].name}`;
        return `King killed by ${who}${what}!`;
    }

    showDeath(anim) {
        const spawn = D('spawn');
        spawn.classList.toggle('hidden', this.me.alive);
        if (!this.me.alive) {
            const r = D('death-reason');
            r.textContent = this.deathText();
            r.classList.remove('hidden');
        }
    }

    // ---------------- UI wiring ----------------
    bindUi() {
        this.alerts = [];
        D('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = D('chat-input');
            const v = input.value.trim();
            if (!v) return;
            input.value = '';
            this.chatLine(this.name, v, true);
        });
        D('play-btn').addEventListener('click', () => {
            const name = D('name-input').value.trim().slice(0, 12) || 'Guesty';
            this.name = name;
            localStorage.setItem('kiomet-name', name);
            this.newGame();
        });
        D('pause-btn').addEventListener('click', () => this.togglePause());
        D('speed-btn').addEventListener('click', () => {
            this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
            D('speed-btn').textContent = this.speed + '×';
            D('speed-btn').classList.toggle('active', this.speed !== 1);
        });
        D('god-btn').addEventListener('click', () => {
            this.godMode = !this.godMode;
            localStorage.setItem('kiomet-god', this.godMode ? '1' : '0');
            D('god-btn').classList.toggle('active', this.godMode);
        D('fog-btn').textContent = this.fogEnabled ? '迷雾:开' : '迷雾:关';
        D('fog-btn').addEventListener('click', () => this.toggleFog());
            this.toast(this.godMode ? 'God mode on — your King cannot die' : 'God mode off');
        });
        D('god-btn').classList.toggle('active', this.godMode);
        D('fog-btn').textContent = this.fogEnabled ? '迷雾:开' : '迷雾:关';
        D('fog-btn').addEventListener('click', () => this.toggleFog());
        D('help-btn').addEventListener('click', () => this.openDialog('help'));
        D('towers-btn').addEventListener('click', () => this.openDialog('towers'));
        D('units-btn').addEventListener('click', () => this.openDialog('units'));
        D('dialog-close').addEventListener('click', () => this.closeDialog());
        D('newgame-btn').addEventListener('click', () => this.newGame());
        D('zoom-in').addEventListener('click', () => { this.camera.zoom = Math.min(64, this.camera.zoom * 1.25); });
        D('zoom-out').addEventListener('click', () => { this.camera.zoom = Math.max(7, this.camera.zoom / 1.25); });
        D('center-btn').addEventListener('click', () => this.panToKey(this.me.rulerKey));
        D('name-input').value = this.name;
        setInterval(() => this.renderAlertList(), 500);
        this.toast('Click a tower for its menu · drag from your towers to send units · H finds your King');
    }

    toggleFog() {
        this.fogEnabled = !this.fogEnabled;
        localStorage.setItem('kiomet-fog', this.fogEnabled ? '1' : '0');
        const btn = D('fog-btn');
        if (btn) btn.textContent = this.fogEnabled ? '迷雾:开' : '迷雾:关';
        this.visibility.invalidate();
        this.updateVisibility();
    }

    togglePause() {
        this.paused = !this.paused;
        D('pause-btn').textContent = this.paused ? '▶' : '❚❚';
        D('pause-btn').classList.toggle('active', this.paused);
    }

    toast(text) {
        this.pushAlert(text, '', 'info', 6000);
    }

    chatLine(who, text, mine) {
        const box = D('chat-log');
        const line = el('div', 'chat-line' + (mine ? ' mine' : ''));
        line.appendChild(el('b', 'chat-name', escapeHtml(who)));
        line.appendChild(el('span', 'chat-text', ' ' + escapeHtml(text)));
        box.appendChild(line);
        box.scrollTop = box.scrollHeight;
    }

    openDialog(which) {
        const dlg = D('dialog');
        const body = D('dialog-body');
        dlg.classList.remove('hidden');
        if (which === 'help') {
            D('dialog-title').textContent = 'Help';
            body.innerHTML = HELP_HTML;
        } else if (which === 'towers') {
            D('dialog-title').textContent = 'Towers';
            body.innerHTML = towersHtml();
        } else {
            D('dialog-title').textContent = 'Units';
            body.innerHTML = unitsHtml();
        }
    }

    closeDialog() { D('dialog').classList.add('hidden'); }
}

function c2(t, u) { return t.units.get(u) > 0; }

const TOWER_GEN_HINT = {};

// Tower reference, worded like the real /towers page: "Upgrades from X (in 20s), requires 2 Factory",
// "Can contain 12 Soldier, 2 Tank, 10 Shield", "Generates Soldier (every 6s), worth 1 point".
function towersHtml() {
    const icon = (n) => `<img class="ref-ico" src="${svgRef(n)}" alt="${n}">`;
    const unitRef = (n) => `<span class="ref-unit"><b>${n}</b></span>`;
    let out = '<p class="ref-lead">The 27 towers. Solid lines are upgrades, dashed lines are prerequisites.</p>';
    out += '<div class="ref-grid">';
    for (const t of TOWERS) {
        const up = t.down ? `<p>Upgrades from ${icon(t.down)} <b>${t.down}</b> (in ${t.delay}s)` +
            (t.prereqs.length ? ', requires ' + t.prereqs.map(([p2, n]) => `${n}${icon(p2)}`).join(', ') : '') + '.</p>'
            : '<p class="ref-dim">Found on the map.</p>';
        const cap = Object.entries(t.cap).map(([u, c]) => `${c} ${unitRef(u)}`).join(', ');
        const gen = Object.entries(t.gen).map(([u, sec]) => `${unitRef(u)} (every ${sec}s)`).join(', ');
        out += `<div class="ref-card">
            <h3>${icon(t.name)} ${LABEL[t.name] || t.name}</h3>
            ${up}
            <p>Can contain ${cap}.</p>
            <p>Generates ${gen || 'nothing'}, worth ${t.score} point${t.score === 1 ? '' : 's'}.</p>
            ${t.sensor > 12 ? `<p>Has a ${Math.round(100 * (t.sensor - 12) / 12)}% higher visual range.</p>` : ''}
            ${t.name === 'Projector' ? '<p>Can send Shields along roads.</p>' : ''}
        </div>`;
    }
    return out + '</div>';
}

// Unit reference, worded like the real /units page (damage vs surface/air, speed, range,
// chopper weight, EMP duration, overflow allowance, which towers make it).
function unitsHtml() {
    const icon = (n) => `<img class="ref-ico" src="${svgRef(n)}" alt="${n}">`;
    let out = '<p class="ref-lead">The 10 units. They generally fight in the order listed — ' +
        'shield always absorbs damage first.</p><div class="ref-grid">';
    const SPEED = { slow: 'Travels at a slow speed.', normal: 'Travels at a moderate speed.', fast: 'Travels at a fast speed.', shield: 'Is immobile.' };
    const RANGE = { short: 'Has a short range.', medium: 'Has a medium range.', long: 'Has a long range.' };
    for (let u = 0; u < UNITS.length; u++) {
        const d = UNITS[u];
        const makers = TOWERS.filter((t) => t.gen[d.name]).map((t) => icon(t.name)).join(' ');
        const surface = Math.max(damageOf(u, 0, 0), damageOf(u, 1, 0));
        const air = Math.max(damageOf(u, 0, 1), damageOf(u, 1, 1));
        let dmg = surface === air ? `Does ${surface >= 31 ? 'infinite' : surface} damage.`
            : `Does ${surface >= 31 ? 'infinite' : surface} damage against surface, ${air} damage against air.`;
        out += `<div class="ref-card">
            <h3>${icon(d.name)} ${LABEL[d.name] || d.name}</h3>
            ${makers ? `<p>Produced by ${makers}.</p>` : ''}
            <p>${dmg}</p>
            <p>${d.name === 'Shield' ? 'Immobile unless sent from a Projector, in which case it travels fast.' : SPEED[d.speed] || ''}</p>
            ${d.range ? `<p>${RANGE[d.range]}</p>` : ''}
            ${d.weight ? `<p>Has weight of ${d.weight} for Choppers.</p>` : ''}
            ${d.name === 'Chopper' ? '<p>Can carry other units (weight of 4).</p>' : ''}
            ${d.name === 'Emp' ? '<p>Disables a tower for 60s.</p>' : ''}
            ${d.maxOverflow ? `<p>Up to ${d.maxOverflow} can temporarily overflow a tower.</p>` : ''}
            ${d.name === 'King' ? `<p>Boosts shield capacity by ${RULER_SHIELD_BOOST}. If it dies, you lose the game.</p>` : ''}
        </div>`;
    }
    return out + '</div>';
}

function damageOf(u, uf, af) {
    // local mirror of data.js damage() for display only
    const name = UNITS[u].name;
    const f = (uf || af) ? 1 : 0;
    switch (name) {
        case 'Tank': return 3;
        case 'Fighter': return f === 1 ? 3 : 1;
        case 'Bomber': return (f === 1 && af === 0) ? 5 : 1;
        case 'Chopper': return f === 1 ? 3 : 1;
        case 'Nuke': return 31;
        case 'Shell': return 3;
        default: return 1;
    }
}

function svgRef(name) {
    const svg = (TOWER_SVG[name] || UNIT_SVG[name] || '').replace(/stroke="#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"/g, 'stroke="#cfe0ff"');
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Help, condensed from the real client help (client/src/ui/translations/help/en.md).
const HELP_HTML = `
<p>Kiomet is a real-time strategy game: expand your territory by sending units to capture towers.</p>
<h3>How to play</h3>
<p>Drag units to capture towers. To upgrade a tower, click it and then click an available upgrade.
Upgrades list their requirements next to them.</p>
<h3>How to win</h3>
<p>Earn points by capturing towers and holding them as long as possible. Protect your King —
losing it costs you the game. A Bunker or Headquarters can survive a few Nukes.</p>
<h3>Supply lines</h3>
<p>Towers that make units can send them automatically. Click a tower to open its menu, then drag
from it as normal; if the path shows moving arrows, you succeeded. Hold <b>R</b> to show all your
supply lines. Delete one by drawing it again or with <b>Shift+R</b>.</p>
<h3>Alliances</h3>
<p>Select a tower of another player and click the handshake button to request or accept an
alliance. Until it is broken, neither side can attack the other.</p>
<h3>Keys</h3>
<p><b>H</b> find your King · <b>Q</b>/<b>E</b> zoom · <b>WASD</b> or arrows to pan ·
<b>T</b> mark towers of the selected kind · <b>R</b> supply lines · <b>B</b> fog of war ·
<b>Space</b> pause · <b>Esc</b> close menus.</p>
`;

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
