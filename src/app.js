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
import {
    LANGUAGES, t, tName, setLang, metaOf, resolveLang, langCodes, langCode,
} from './i18n.js';

const D = (id) => document.getElementById(id);
// Defined by code point so the source file stays encoding-independent.
const CLOSE_GLYPH = String.fromCharCode(0x2718);
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
        // Language first: everything below looks up already-translated strings.
        setLang(resolveLang());
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
        this.lastFrameAt = this.lastFrame;
        this.acc = 0;
        this.game = null;
        this.newGame();
        this.bindInput();
        this.bindUi();
        this.applyLanguage();
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
            // Cap the catch-up steps: after a long stall (tab switch, heavy GC) running eight
            // ticks in one frame turns a stumble into a freeze. Two is enough to stay smooth;
            // the surplus is dropped and the clock stays in the past rather than snowballing.
            let steps = 0;
            while (this.acc >= 1 / TICK_HZ && steps < 2) {
                this.game.tick();
                this.visibility.invalidate();
                this.acc -= 1 / TICK_HZ;
                steps += 1;
            }
            if (this.acc > 1 / TICK_HZ) this.acc = 0;
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
        this.validateSelection();
        if (this.selected) this.positionMenu();
        this.trackFrameCost(now);
        requestAnimationFrame((t) => this.frame(t));
    }

    // A selected tower can disappear between frames (captured by an enemy, razed, or the map
    // regenerated). Checking here once per frame keeps the panel honest without making
    // positionMenu() mutate state.
    validateSelection() {
        if (!this.selected) return;
        if (!this.game.getTower(this.selected)) this.dismissMenu();
    }

    // Adaptive quality: if frames consistently exceed the budget, step the canvas resolution
    // down; if there is plenty of headroom again, step it back up. This is the cheap version of
    // what a real engine's dynamic-resolution scaler does, and it turns a machine that can't
    // hold 60fps into a smooth lower-res render instead of a stuttering one.
    trackFrameCost(now) {
        const dtMs = now - this.lastFrameAt;
        this.lastFrameAt = now;
        if (!(dtMs > 0) || dtMs > 250) return;         // ignore tab-switch gaps
        const ema = this.frameEma == null ? dtMs : this.frameEma * 0.9 + dtMs * 0.1;
        this.frameEma = ema;
        this.frameSamples = (this.frameSamples || 0) + 1;
        if (this.frameSamples < 90) return;            // ~1.5s of evidence before reacting
        this.frameSamples = 0;
        const r = this.renderer;
        if (ema > 22 && r.effectiveDpr > 0.75) {         // slower than ~45fps: drop resolution
            r.setQualityScale(r.effectiveDpr * 0.85);
        } else if (ema < 17.5 && r.effectiveDpr < r.qualityCap) {   // headroom: restore detail
            r.setQualityScale(Math.min(r.qualityCap, r.effectiveDpr * 1.06));
        }
    }

    closeMenuOnPan() {
        this.lastAlertSig = null;
        this.dismissMenu();
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
            // Capture can legitimately fail (the pointer was already released, or a synthetic
            // event carries an unknown id). Throwing here would abandon the rest of the handler
            // and leave the tower panel undismissable, so it must never break input.
            try { cv.setPointerCapture(e.pointerId); } catch { /* capture is an optimisation */ }
            this.pointers = this.pointers || new Map();
            const [lx, ly] = this.renderer.eventToLocal(e);
            this.pointers.set(e.pointerId, { x: lx, y: ly });
            if (this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                this.pinching = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.camera.zoom };
                this.drag = null;
                return;
            }
            if (e.button === 2 || e.shiftKey) {
                this.pan = { x: lx, y: ly, cx: this.camera.x, cy: this.camera.y };
                return;
            }
            const [wx, wy] = this.camera.toWorld(lx, ly, this.renderer.cw, this.renderer.ch);
            const t = this.towerAtWorld(wx, wy);
            this.drag = null;
            this.dragPath = null;
            if (t && t.owner === this.me.id) {
                this.drag = { from: t, startX: lx, startY: ly, path: null, moved: false };
            } else {
                // Clicking empty ground (or someone else's tower) dismisses the menu. Without
                // this the panel could only be closed by clicking the very same tower again,
                // and if that tower's id changed under you the panel became impossible to close.
                this.dismissMenu();
            }
        });

        cv.addEventListener('pointermove', (e) => {
            const [lx, ly] = this.renderer.eventToLocal(e);
            if (this.pointers && this.pointers.has(e.pointerId)) {
                this.pointers.set(e.pointerId, { x: lx, y: ly });
            }
            if (this.pinching && this.pointers.size >= 2) {
                const [a, b] = [...this.pointers.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                this.camera.zoom = Math.max(7, Math.min(64, this.pinching.zoom * (d / this.pinching.d)));
                return;
            }
            if (this.pan) {
                this.camera.x = this.pan.cx - (lx - this.pan.x) / this.camera.zoom;
                this.camera.y = this.pan.cy - (ly - this.pan.y) / this.camera.zoom;
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
        // Window-level fallback only for pointers that left the canvas mid-drag. Guarding on
        // the target keeps a click on a menu button from being re-routed into finishDrag().
        addEventListener('pointerup', (e) => { if (this.drag && e.target === cv) end(e); });

        cv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const [lx, ly] = this.renderer.eventToLocal(e);
            const [wx, wy] = this.camera.toWorld(lx, ly, this.renderer.cw, this.renderer.ch);
            const f = Math.exp(-e.deltaY * 0.0015);
            this.camera.zoom = Math.max(7, Math.min(64, this.camera.zoom * f));
            const [nx, ny] = this.camera.toWorld(lx, ly, this.renderer.cw, this.renderer.ch);
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
            if (k === 'escape') { this.dismissMenu(); this.closeDialog(); }
            if (k === 'h') {
                const t = this.me.rulerKey != null ? this.game.towers.get(this.me.rulerKey) : null;
                if (t) { const p = integerPosition(t.x, t.y); this.panTarget = { x: p[0], y: p[1] }; }
            }
            if (k === 'q') { this.camera.zoom = Math.max(7, this.camera.zoom / 1.2); }
            if (k === 'e') { this.camera.zoom = Math.min(64, this.camera.zoom * 1.2); }
            if (k === 'r' && !e.shiftKey) {
                this.showSupplyLines = !this.showSupplyLines;
                this.toast(this.showSupplyLines ? 'toast.supplyOn' : 'toast.supplyOff');
            } else if (k === 'r' && e.shiftKey) {
                this.clearSupplyLines();
            }
            if (k === 'b') this.toggleFog();
            if (k === ' ') { e.preventDefault(); this.togglePause(); }
        });
        addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
        // ResizeObserver also fires on CSS-driven box changes (zoom, sidebar, devtools),
        // which plain `resize` misses and which silently desyncs taps from the canvas.
        addEventListener('resize', () => this.renderer.resize());
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
            this.resizeObserver.observe(cv);
        }
    }

    // Which tower is under the pointer? Each sprite stands on a jittered point inside its
    // 5x5 world cell, so search the neighbouring cells and compare against the *drawn* centre
    // (integerPosition), not the raw cell coordinate 鈥?the jitter is up to a full cell, so
    // using t.x*5 / t.y*5 picked the wrong tower and made taps miss the tower you saw.
    towerAtWorld(wx, wy) {
        let best = null, bestD = Infinity;
        const cx = Math.round(wx / 5), cy = Math.round(wy / 5);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const t = this.game.tower(cx + dx, cy + dy);
                if (!t) continue;
                if (!this.isVisible(t)) continue;
                const p = integerPosition(t.x, t.y);
                const d = Math.hypot(p[0] - wx, p[1] - wy);
                if (d < bestD) { best = t; bestD = d; }
            }
        }
        if (!best) return null;
        const tapRadius = Math.max(3, Math.min(6, 34 / this.camera.zoom));
        return bestD <= tapRadius ? best : null;
    }

    updateDrag(e) {
        const [lx, ly] = this.renderer.eventToLocal(e);
        const [wx, wy] = this.camera.toWorld(lx, ly, this.renderer.cw, this.renderer.ch);
        if (Math.hypot(lx - this.drag.startX, ly - this.drag.startY) > 6) this.drag.moved = true;
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
            this.toast('toast.kingConfirm');
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
            this.toast('toast.supplyRemoved');
        } else {
            this.toast('toast.supplyNone');
        }
    }

    selectTower(t) {
        // Toggle only against a *live* tower. The old check compared coordinates, so once the
        // selected tower was captured/destroyed its lookup returned null and renderMenu() kept
        // the stale panel on screen with no way to dismiss it.
        const sel = this.selected ? this.game.getTower(this.selected) : null;
        if (sel && t && sel.x === t.x && sel.y === t.y) {
            this.selected = null;
        } else {
            this.selected = { x: t.x, y: t.y };
        }
        this.renderMenu();
    }

    // Single exit path for closing the tower panel, so no caller can leave a hidden-but-stale
    // selection behind.
    dismissMenu() {
        if (!this.selected) return;
        this.selected = null;
        this.renderMenu();
    }

    // ---------------- menu ----------------
    positionMenu() {
        const menu = D('tower-menu');
        const t = this.selected ? this.game.getTower(this.selected) : null;
        // Do NOT null the selection here: positionMenu() runs every frame, and clearing the
        // selection from inside it means a tower that vanishes (captured, destroyed, or
        // replaced) silently strands the panel. renderMenu() owns the hide.
        if (!t) { menu.classList.add('hidden'); return; }
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
        // Named `tower`, not `t`: `t` is the translation function and must stay callable here.
        const tower = this.selected ? this.game.getTower(this.selected) : null;
        if (!tower) {
            // The selected tower is gone (captured, razed, or the map regenerated): drop the
            // stale selection so the next frame doesn't try to reposition a phantom panel.
            this.selected = null;
            menu.classList.add('hidden');
            return;
        }
        menu.classList.remove('hidden');

        // Explicit close button: mouse users can always dismiss the panel without hunting for
        // the same tower again, and touch users get a target that isn't a 3px tap radius.
        const close = el('button', 'tm-close', '✕');
        close.type = 'button';
        close.title = t('common.close');
        close.setAttribute('aria-label', t('common.close'));
        close.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        close.addEventListener('click', (ev) => { ev.stopPropagation(); this.dismissMenu(); });
        menu.appendChild(close);

        const isMine = tower.owner === this.me.id;
        const type = TOWER[tower.type];
        const head = el('div', 'tm-head');
        head.appendChild(el('img', 'tm-icon', ''));
        head.querySelector('img').src = this.svgUrl(tower.type, 'rgb(116,185,255)');
        head.appendChild(el('span', 'tm-title', tName('tower', tower.type)));
        if (tower.owner != null) {
            const p = this.game.players[tower.owner];
            head.appendChild(el('span', 'tm-owner', p ? p.name : ''));
        }
        menu.appendChild(head);

        if (tower.delay > 0) {
            menu.appendChild(el('div', 'tm-delay', t('menu.upgrading', { seconds: Math.ceil(tower.delay / TICK_HZ) })));
        }

        // Unit rows (only what the tower can make, or already holds).
        const rows = el('div', 'tm-units');
        for (const [u, c] of tower.units.counts()) {
            const cap = tower.units.capacity(u, tower.type);
            rows.appendChild(this.unitRow(u, c, cap));
        }
        for (const name of Object.keys(type.gen)) {
            const u = UNIT_ID[name];
            if (c2(tower, u)) continue;
            rows.appendChild(this.unitRow(u, 0, tower.units.capacity(u, tower.type)));
        }
        if (tower.units.hasRuler()) rows.appendChild(this.unitRow(RULER, 1, 1));
        menu.appendChild(rows);

        if (isMine && tower.active) {
            const ups = el('div', 'tm-ups');
            const opts = [...TOWER[tower.type].upgrades];
            if (type.basis !== tower.type) opts.push(type.basis);
            for (const name of opts) {
                const up = TOWER[name];
                const down = name === type.basis;
                const ok = down ? true : meetsPrereqs(name, this.me.towerCounts);
                const row = el('button', 'tm-up' + (down ? ' down' : '') + (ok ? '' : ' locked'));
                row.title = t(down ? 'menu.downgradeTo' : 'menu.upgradeTo', { tower: tName('tower', name) });
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
                    if (!ok) { this.toast('toast.prereq'); return; }
                    const err = this.game.upgradeTower(this.me.id, tower.id, name);
                    if (err) this.toast(err);
                    else { this.alertBoard.onUpgrade(); this.renderMenu(); }
                });
                ups.appendChild(row);
            }
            menu.appendChild(ups);

            if (tower.supply) {
                const b = el('button', 'tm-btn', t('menu.cancelSupply'));
                b.addEventListener('click', () => {
                    this.game.setSupplyLine(this.me.id, tower.id, null);
                    this.renderMenu();
                });
                menu.appendChild(b);
            }
            menu.appendChild(el('div', 'tm-hint', t(tower.generatesMobile() ? 'menu.hintMobile' : 'menu.hintStatic')));
        } else if (tower.owner != null && tower.owner !== this.me.id) {
            const p = this.game.players[tower.owner];
            const allied = this.me.allies.has(tower.owner);
            const pending = p && p.allies.has(this.me.id) && !allied;
            const b = el('button', 'tm-btn' + (allied ? ' danger' : ''),
                t(allied ? 'menu.breakAlly' : (pending ? 'menu.acceptAlly' : 'menu.requestAlly')));
            b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.game.requestAlliance(this.me.id, tower.owner);
                this.renderMenu();
            });
            menu.appendChild(b);
        } else {
            menu.appendChild(el('div', 'tm-hint', tower.owner == null ? t('menu.unowned') : ''));
        }

        this.positionMenu();
    }

    svgUrl(type, color) {
        const svg = (TOWER_SVG[type] || '').replace(/stroke="#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"/g, `stroke="${color}"`);
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }

    unitRow(u, count, cap) {
        const row = el('div', 'tm-unit');
        row.title = tName('unit', UNITS[u].name);
        const badge = el('span', 'unit-' + UNITS[u].name.toLowerCase());
        row.appendChild(badge);
        row.appendChild(el('span', 'tm-count', `${count}/${cap}`));
        if (TOWER_GEN_HINT[u]) row.appendChild(el('span', 'tm-gen', TOWER_GEN_HINT[u]));
        return row;
    }

    // ---------------- language ----------------
    // Every static label, tooltip and placeholder is rewritten from the dictionary. Anything
    // that is rebuilt per frame or per selection (leaderboard, tower menu, alerts, dialogs)
    // is redrawn right after so the switch is instant, with no reload.
    applyLanguage() {
        const setText = (id, key) => { const e = D(id); if (e) e.textContent = t(key); };
        const setTitle = (id, key) => { const e = D(id); if (e) e.title = t(key); };
        const setPh = (id, key) => { const e = D(id); if (e) e.placeholder = t(key); };

        document.title = t('app.title');

        // Top bar.
        setText('lbl-score', 'hud.score');
        setText('lbl-towers', 'hud.towers');
        setText('lbl-life', 'hud.life');

        setPh('chat-input', 'chat.placeholder');

        setTitle('zoom-out', 'zoom.out');
        setTitle('zoom-in', 'zoom.in');
        setTitle('center-btn', 'zoom.center');

        setTitle('pause-btn', this.paused ? 'btn.resume' : 'btn.pause');
        setTitle('speed-btn', 'btn.speed');
        setTitle('god-btn', 'btn.god');
        setTitle('fog-btn', 'btn.fogTitle');
        setText('god-btn', 'btn.god');
        setText('fog-btn', this.fogEnabled ? 'btn.fog' : 'btn.fogOff');
        setText('help-btn', 'btn.help');
        setText('towers-btn', 'btn.towers');
        setText('units-btn', 'btn.units');
        setText('newgame-btn', 'btn.newgame');

        setText('spawn-sub', 'spawn.sub');
        setPh('name-input', 'spawn.name');
        setText('play-btn', 'spawn.play');
        setText('dialog-close', 'common.close');

        this.renderLangPicker();
        this.buildTowerLabels();
        // Live widgets.
        this.updateHud();
        this.renderMenu();
        this.lastAlertSig = null;
        this.renderGameAlerts();
        this.retranslateAlerts();
        this.renderAlertList();
        this.showDeath(false);
        if (this.dialogKind) this.openDialog(this.dialogKind);
    }

    // The picker in the top-right corner: a <select> keeps native keyboard/AT behaviour and
    // costs nothing, and each option carries the language's own name so it is findable in
    // whatever language the player reads.
    renderLangPicker() {
        const sel = D('lang-select');
        if (!sel) return;
        const cur = langCode();
        if (!sel.dataset.built) {
            sel.innerHTML = '';
            for (const code of langCodes()) {
                const o = document.createElement('option');
                o.value = code;
                o.textContent = metaOf(code).name;
                sel.appendChild(o);
            }
            sel.dataset.built = '1';
            sel.addEventListener('change', () => this.setLanguage(sel.value));
        }
        sel.value = cur || sel.value;
        sel.title = t('common.language');
        sel.setAttribute('aria-label', t('common.language'));
    }

    setLanguage(code) {
        if (code === langCode()) return;
        setLang(code);
        this.applyLanguage();
    }

    // Tower/unit names are used all over the UI; resolve them once per language change.
    buildTowerLabels() {
        for (const tw of TOWERS) tw.label = tName('tower', tw.name);
        for (const u of UNITS) u.label = tName('unit', u.name);
    }

    // ---------------- icon overlay ----------------
    // Towers are drawn as absolutely positioned <img> elements: crisp SVG at any zoom, and
    // it sidesteps canvas quirks entirely.
    syncIcons() {
        if (!this.iconLayer) {
            this.iconLayer = D('icons');
            this.iconEls = new Map();
            // Batch every style write through a single transform-based node move: writing
            // left/top (and swapping img.src) per tower per frame forces a synchronous
            // layout on every frame, which is the main source of the stutter.
            this.iconPool = [];
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
                el.draggable = false;
                this.iconLayer.appendChild(el);
                this.iconEls.set(k, el);
            }
            const c = this.colorForRgb(t.owner);
            const key = t.type + c.join(',');
            if (el.dataset.key !== key) {
                el.src = this.svgUrl(t.type, `rgb(${c.join(',')})`);
                el.dataset.key = key;
            }
            const w = Math.round(size) + 'px';
            if (el.style.width !== w) { el.style.width = w; el.style.height = w; }
            const opacity = t.owner == null ? '0.85' : '1';
            if (el.style.opacity !== opacity) el.style.opacity = opacity;
            el.style.transform = `translate3d(${(sx - size / 2).toFixed(1)}px,${(sy - size * 0.95).toFixed(1)}px,0)`;
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
        const score = fmt(me.score);
        const towers = fmt(me.towers.size);
        if (this._hudScore !== score) { this._hudScore = score; D('score').textContent = score; }
        if (this._hudTowers !== towers) { this._hudTowers = towers; D('towers-n').textContent = towers; }

        // The leaderboard is rebuilt only when its *content* changes. Rewriting its innerHTML
        // every frame (60x/s) forced a full style recalc + layout each time — the single most
        // expensive thing the UI did, and the main source of the visible hitch.
        const rows = this.game.players
            .filter((p) => p.alive || p.id === me.id)
            .map((p) => ({ p, score: p.id === me.id ? me.score : p.score, n: p.towers.size }))
            .sort((a, b) => b.score - a.score || b.n - a.n)
            .slice(0, 10);
        const aliveCount = this.game.players.filter((p) => p.alive).length;
        const sig = rows.map((r) => `${r.p.id}:${r.p.name}:${r.score}`).join('|') +
            `#${this.game.towers.size}#${aliveCount}#${t('hud.leaderboard')}#${t('hud.footer')}`;
        if (sig !== this._lbSig) {
            this._lbSig = sig;
            const lb = D('leaderboard');
            let html = `<div class="lb-head">${t('hud.leaderboard')}</div>`;
            rows.forEach((r, i) => {
                const mine = r.p.id === me.id;
                const col = this.colorCss(r.p.id);
                html += `<div class="lb-row${mine ? ' me' : ''}"><span class="lb-n">${i + 1}.</span>` +
                    `<span class="lb-dot" style="background:${col}"></span>` +
                    `<span class="lb-name">${escapeHtml(r.p.name)}</span>` +
                    `<span class="lb-score">${r.score}</span></div>`;
            });
            html += `<div class="lb-foot">${t('hud.footer', {
                towers: fmt(this.game.towers.size),
                players: aliveCount,
            })}</div>`;
            lb.innerHTML = html;
        }

        const alive = me.alive ? '#74b9ff' : '#c0392b';
        if (this._hudAlive !== alive) { this._hudAlive = alive; D('alive-dot').style.background = alive; }
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
            this.alerts.unshift({ text: t('alert.kingDead'), sub: '', kind: 'bad', until: performance.now() + 8000 });
        }
        if (e.type === 'died' && e.player === this.me.id) {
            this.showDeath(true);
        }
    }

    renderAlerts() { /* alerts are pushed in pushAlert */ }

    // Toasts are queued as translation *keys* (or literal text for engine errors) so that a
    // language switch can re-render the ones still on screen in the new language.
    pushAlert(text, sub, kind = 'info', ms = 7000) {
        this.alerts = this.alerts || [];
        const key = isTranslatableKey(text) ? text : null;
        const shown = key ? t(key) : text;
        if (this.alerts.some((a) => a.text === shown)) return;
        this.alerts.unshift({ key, text: shown, sub, kind, until: performance.now() + ms });
        this.renderAlertList();
    }

    // Re-resolve every queued toast; called when the language changes.
    retranslateAlerts() {
        for (const a of (this.alerts || [])) {
            if (a.key) a.text = t(a.key);
        }
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
                row.title = t('toast.menuHint');
                row.addEventListener('click', () => {
                    const t = this.game.getTower(a.tower);
                    if (t) { this.centreOn(t); this.selected = { x: t.x, y: t.y }; this.renderMenu(); }
                });
            }
            const x = el('span', 'galert-x', CLOSE_GLYPH);
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
            const x = el('span', 'alert-x', CLOSE_GLYPH);
            x.addEventListener('click', () => { a.until = 0; this.renderAlertList(); });
            row.appendChild(x);
            box.appendChild(row);
        }
    }

    // DeathReason::RulerKilled { alias, unit } -> "King killed by <alias>'s <unit>!"
    deathText() {
        const p = this.game.players[this.me.id];
        const r = p && p.deathReason;
        if (!r) return t('death.default');
        if (r.killer == null) return t('death.byZombies');
        const killer = this.game.players[r.killer];
        const who = killer ? killer.name : t('death.someone');
        if (r.unit == null) return t('death.byPlayerNoUnit', { player: who });
        return t('death.byPlayer', { player: who, unit: tName('unit', UNITS[r.unit].name) });
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
            D('speed-btn').textContent = this.speed + '脳';
            D('speed-btn').classList.toggle('active', this.speed !== 1);
        });
        D('god-btn').addEventListener('click', () => {
            this.godMode = !this.godMode;
            localStorage.setItem('kiomet-god', this.godMode ? '1' : '0');
            D('god-btn').classList.toggle('active', this.godMode);
            this.toast(this.godMode ? 'toast.godOn' : 'toast.godOff');
        });
        D('god-btn').classList.toggle('active', this.godMode);
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
        this.toast('toast.intro');
    }

    toggleFog() {
        this.fogEnabled = !this.fogEnabled;
        localStorage.setItem('kiomet-fog', this.fogEnabled ? '1' : '0');
        const btn = D('fog-btn');
        if (btn) btn.textContent = t(this.fogEnabled ? 'btn.fog' : 'btn.fogOff');
        this.visibility.invalidate();
        this.updateVisibility();
    }

    togglePause() {
        this.paused = !this.paused;
        const btn = D('pause-btn');
        btn.textContent = this.paused ? '▶' : '❚❚';
        btn.title = t(this.paused ? 'btn.resume' : 'btn.pause');
        btn.classList.toggle('active', this.paused);
    }

    // `text` may be a translation key or an already-formatted string (engine errors).
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
        // Remembered so a language switch can redraw the open panel in the new language.
        this.dialogKind = which;
        const title = D('dialog-title');
        if (which === 'help') {
            title.textContent = t('help.title');
            body.innerHTML = t('help.body');
        } else if (which === 'towers') {
            title.textContent = t('towers.title');
            body.innerHTML = towersHtml();
        } else {
            title.textContent = t('units.title');
            body.innerHTML = unitsHtml();
        }
    }

    closeDialog() {
        this.dialogKind = null;
        D('dialog').classList.add('hidden');
    }
}

function c2(t, u) { return t.units.get(u) > 0; }

const TOWER_GEN_HINT = {};

// Tower reference, worded like the real /towers page: "Upgrades from X (in 20s), requires 2 Factory",
// "Can contain 12 Soldier, 2 Tank, 10 Shield", "Generates Soldier (every 6s), worth 1 point".
function towersHtml() {
    const icon = (n) => `<img class="ref-ico" src="${svgRef(n)}" alt="${escapeHtml(tName('tower', n))}">`;
    const unitRef = (n) => `<span class="ref-unit"><b>${escapeHtml(tName('unit', n))}</b></span>`;
    let out = `<p class="ref-lead">${t('towers.lead')}</p>`;
    out += '<div class="ref-grid">';
    for (const tw of TOWERS) {
        const reqs = tw.prereqs.map(([p2, n]) => `${n}${icon(p2)}`).join(', ');
        const up = tw.down
            ? `<p>${t(reqs ? 'towers.upgradesFromReq' : 'towers.upgradesFrom', {
                icon: icon(tw.down),
                tower: tName('tower', tw.down),
                seconds: tw.delay,
                reqs,
            })}.</p>`
            : `<p class="ref-dim">${t('towers.foundOnMap')}</p>`;
        const cap = Object.entries(tw.cap).map(([u, c]) => `${c} ${unitRef(u)}`).join(', ');
        const gen = Object.entries(tw.gen)
            .map(([u, sec]) => t('towers.generatesEvery', { unit: unitRef(u), seconds: sec }))
            .join(', ');
        // Chinese-style languages end the clause with a full stop; the template owns the
        // punctuation so translations can place it correctly.
        out += `<div class="ref-card">
            <h3>${icon(tw.name)} ${escapeHtml(tName('tower', tw.name))}</h3>
            ${up}
            <p>${t('towers.canContain', { units: cap })}</p>
            <p>${t('towers.generates', { units: gen || t('towers.generatesNothing') })}${t('towers.worth', { points: tw.score })}</p>
            ${tw.sensor > 12 ? `<p>${t('towers.sensor', { percent: Math.round(100 * (tw.sensor - 12) / 12) })}</p>` : ''}
            ${tw.name === 'Projector' ? `<p>${t('towers.projector')}</p>` : ''}
        </div>`;
    }
    return out + '</div>';
}

// Unit reference, worded like the real /units page (damage vs surface/air, speed, range,
// chopper weight, EMP duration, overflow allowance, which towers make it).
function unitsHtml() {
    const icon = (n) => `<img class="ref-ico" src="${svgRef(n)}" alt="${escapeHtml(tName('tower', n))}">`;
    let out = `<p class="ref-lead">${t('units.lead')}</p><div class="ref-grid">`;
    for (let u = 0; u < UNITS.length; u++) {
        const d = UNITS[u];
        const makers = TOWERS.filter((tw) => tw.gen[d.name]).map((tw) => icon(tw.name)).join(' ');
        const surface = Math.max(damageOf(u, 0, 0), damageOf(u, 1, 0));
        const air = Math.max(damageOf(u, 0, 1), damageOf(u, 1, 1));
        const fmtDmg = (n) => (n >= 31 ? t('units.infinite') : n);
        const dmg = surface === air
            ? t('units.damage', { surface: fmtDmg(surface) })
            : t('units.damageBoth', { surface: fmtDmg(surface), air: fmtDmg(air) });
        const speedText = d.name === 'Shield' ? t('units.shieldSpecial') : t(`units.speed.${d.speed}`);
        out += `<div class="ref-card">
            <h3>${icon(d.name)} ${escapeHtml(tName('unit', d.name))}</h3>
            ${makers ? `<p>${t('units.producedBy', { makers })}</p>` : ''}
            <p>${dmg}</p>
            <p>${speedText}</p>
            ${d.range ? `<p>${t(`units.range.${d.range}`)}</p>` : ''}
            ${d.weight ? `<p>${t('units.weight', { weight: d.weight })}</p>` : ''}
            ${d.name === 'Chopper' ? `<p>${t('units.chopper')}</p>` : ''}
            ${d.name === 'Emp' ? `<p>${t('units.emp')}</p>` : ''}
            ${d.maxOverflow ? `<p>${t('units.overflow', { count: d.maxOverflow })}</p>` : ''}
            ${d.name === 'King' ? `<p>${t('units.king', { boost: RULER_SHIELD_BOOST })}</p>` : ''}
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

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// A string is a translation key when it looks like `section.name` and the dictionary knows
// it, which keeps engine messages (plain words like "path too long") renderable as-is.
function isTranslatableKey(s) {
    return typeof s === 'string' && /^[a-z]+\.[A-Za-z0-9.]+$/.test(s) && t(s) !== s;
}
