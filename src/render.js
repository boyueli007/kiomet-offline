// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Canvas renderer: roads, tower plinths, unit formations, force markers, territory halos.
// Visual language follows Kiomet's client (client/src/layout.rs, client/src/road.rs,
// client/src/color.rs).

import { UNITS, SHIELD, TOWER, TOWERS, UNIT_ID, MAX_ROAD_LENGTH } from './data.js';
import { integerPosition, neighbors, distance } from './geom.js';
import { progressPerTick } from './rules.js';

import { TOWER_SVG } from './glyphs.js';

export const COLORS = {
    blue: [0x74, 0xb9, 0xff],
    gray: [0x66, 0x66, 0x66],
    purple: [0x86, 0x44, 0xfc],
    red: [0xc0, 0x39, 0x2b],
    me: [0x74, 0xb9, 0xff],
    ally: [0x86, 0x44, 0xfc],
    enemy: [0xc0, 0x39, 0x2b],
    neutral: [0x66, 0x66, 0x66],
    road: 'rgba(150,160,175,0.55)',
    roadHi: 'rgba(215,225,240,0.9)',
};

// Tower art from Kiomet's own painting set (AGPL-3.0-or-later, Softbear, Inc.),
// re-encoded to 64px transparent WebP.
const BG = '#2d3436';

export class Camera {
    constructor() { this.x = 0; this.y = 0; this.zoom = 18; }
    toScreen(wx, wy, cw, ch) { return [(wx - this.x) * this.zoom + cw / 2, (wy - this.y) * this.zoom + ch / 2]; }
    toWorld(sx, sy, cw, ch) { return [(sx - cw / 2) / this.zoom + this.x, (sy - ch / 2) / this.zoom + this.y]; }
    clamp() {
        this.zoom = Math.max(7, Math.min(64, this.zoom));
        this.x = Math.max(0, Math.min(2560, this.x));
        this.y = Math.max(0, Math.min(2560, this.y));
    }
}

export class Renderer {
    constructor(canvas, icons) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = new Camera();
        // SvgColor: each glyph stroked in its owner's colour, cached per colour.
        this.glyphCache = new Map();
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.resize();
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        this.cw = r.width; this.ch = r.height;
        this.canvas.width = Math.round(r.width * this.dpr);
        this.canvas.height = Math.round(r.height * this.dpr);
    }

    // Which towers should be drawn: everything within the view plus any owned tower.
    draw(game, view) {
        this.fog = view && view.fog ? view.fog : null;
        const ctx = this.ctx;
        const { cw, ch } = this;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, cw, ch);

        const zoom = this.camera.zoom;
        // World-space bounds of the viewport plus a margin.
        const [wx0, wy0] = this.camera.toWorld(-80, -80, cw, ch);
        const [wx1, wy1] = this.camera.toWorld(cw + 80, ch + 80, cw, ch);
        const lo = { x: Math.floor(wx0 / 5) - 2, y: Math.floor(wy0 / 5) - 2 };
        const hi = { x: Math.ceil(wx1 / 5) + 2, y: Math.ceil(wy1 / 5) + 2 };

        const visible = [];
        for (const t of game.towers.values()) {
            if (t.x < lo.x || t.y < lo.y || t.x > hi.x || t.y > hi.y) continue;
            visible.push(t);
        }

        this.drawTerritory(ctx, game, visible);
        this.drawRoads(ctx, game, visible);
        this.drawPaths(ctx, game, view);
        this.drawTowers(ctx, game, visible, view);
        this.drawForces(ctx, game, view);
        this.drawSelection(ctx, game, view);
    }

    colorFor(game, owner, view) {
        if (owner == null) return COLORS.neutral;
        if (view && owner === view.playerId) return COLORS.me;
        if (view && view.allies && view.allies.has(owner)) return COLORS.ally;
        return COLORS.enemy;
    }

    drawTerritory(ctx, game, visible) {
        const fog = this.fog;
        const z = this.camera.zoom;
        const r = Math.max(12, z * 2.2);
        ctx.save();
        ctx.globalAlpha = 0.10;
        for (const t of visible) {
            if (t.owner == null) continue;
            if (fog && !fog(t)) continue;
            const c = this.colorFor(game, t.owner, game.view);
            const [sx, sy] = this.camera.toScreen(integerPosition(t.x, t.y)[0], integerPosition(t.x, t.y)[1], this.cw, this.ch);
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
            g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
            g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        }
        ctx.restore();
    }

    drawRoads(ctx, game, visible) {
        const seen = new Set();
        ctx.lineWidth = Math.max(1, this.camera.zoom * 0.055);
        ctx.strokeStyle = COLORS.road;
        ctx.beginPath();
        for (const t of visible) {
            const a = integerPosition(t.x, t.y);
            for (const nb of neighbors(t.x, t.y)) {
                const k1 = t.y * 512 + t.x, k2 = nb.y * 512 + nb.x;
                const kk = k1 < k2 ? k1 * 262144 + k2 : k2 * 262144 + k1;
                if (seen.has(kk)) continue;
                seen.add(kk);
                const other = game.getTower(nb);
                if (!other) continue;
                if (this.fog && !(this.fog(t) || this.fog(other))) continue;
                const b = integerPosition(nb.x, nb.y);
                const [x1, y1] = this.camera.toScreen(a[0], a[1], this.cw, this.ch);
                const [x2, y2] = this.camera.toScreen(b[0], b[1], this.cw, this.ch);
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
        }
        ctx.stroke();
    }

    drawPaths(ctx, game, view) {
        if (!view) return;
        // Supply lines of the player and hovered drag preview.
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        for (const t of game.towers.values()) {
            if (!t.supply || t.owner !== view.playerId) continue;
            const p0 = integerPosition(t.x, t.y);
            ctx.strokeStyle = 'rgba(116,185,255,0.75)';
            ctx.beginPath();
            let prev = p0;
            const [x0, y0] = this.camera.toScreen(prev[0], prev[1], this.cw, this.ch);
            ctx.moveTo(x0, y0);
            for (let i = 1; i < t.supply.length; i++) {
                const p = integerPosition(t.supply[i].x, t.supply[i].y);
                const [x, y] = this.camera.toScreen(p[0], p[1], this.cw, this.ch);
                ctx.lineTo(x, y);
                prev = p;
            }
            ctx.stroke();
        }
        ctx.restore();

        if (view.dragPath && view.dragPath.length > 1) {
            ctx.save();
            ctx.lineWidth = Math.max(2, this.camera.zoom * 0.09);
            ctx.strokeStyle = view.dragValid === false ? 'rgba(230,120,60,0.75)' : 'rgba(235,245,255,0.85)';
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < view.dragPath.length; i++) {
                const p = integerPosition(view.dragPath[i].x, view.dragPath[i].y);
                const [x, y] = this.camera.toScreen(p[0], p[1], this.cw, this.ch);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    drawTowers(ctx, game, visible, view) {
        const z = this.camera.zoom;
        const size = Math.max(10, z * 1.25);
        for (const t of visible) {
            if (this.fog && !this.fog(t)) continue;
            const a = integerPosition(t.x, t.y);
            const [sx, sy] = this.camera.toScreen(a[0], a[1], this.cw, this.ch);
            const c = this.colorFor(game, t.owner, view);

            // Plinth.
            ctx.beginPath();
            ctx.arc(sx, sy + size * 0.30, size * 0.46, 0, Math.PI * 2);
            ctx.fillStyle = t.owner == null ? 'rgba(30,34,36,0.75)'
                : `rgba(${this.shade(c, 0.45)},0.9)`;
            ctx.fill();

            // A faint owner ring behind the glyph (the glyph itself is a DOM <img>).
            if (t.owner != null) {
                ctx.beginPath();
                ctx.arc(sx, sy - size * 0.42, size * 0.62, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${this.shade(c, 1.2)},0.35)`;
                ctx.lineWidth = Math.max(1, size * 0.06);
                ctx.stroke();
            }

            // Selection / hover ring.
            if (view && view.selected && view.selected.x === t.x && view.selected.y === t.y) {
                ctx.beginPath();
                ctx.arc(sx, sy + size * 0.30, size * 0.58, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Unit badges under the tower.
            if (z > 11) this.drawUnits(ctx, t, sx, sy + size * 0.30, size);

            // Delay / EMP indicator.
            if (t.delay > 0) {
                ctx.globalAlpha = 0.45;
                ctx.fillStyle = '#1b1f21';
                ctx.beginPath();
                ctx.arc(sx, sy - size * 0.36, size * 0.42, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ffd166';
                ctx.font = `${Math.max(9, size * 0.34)}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(Math.ceil(t.delay / 4) + 's', sx, sy - size * 0.28);
            }
        }
    }

    drawUnits(ctx, t, cx, cy, size) {
        const counts = t.units.counts();
        if (!counts.length) return;
        const cap = {};
        for (const [u] of counts) cap[u] = t.units.capacity(u, t.type);
        // Shields as a ring, the rest as a compact bar of pips.
        const shield = t.units.get(SHIELD);
        if (shield) {
            const max = Math.max(1, t.units.capacity(SHIELD, t.type));
            const r = size * 0.36;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(150,175,220,0.35)';
            ctx.lineWidth = Math.max(1.5, size * 0.09);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, shield / max));
            ctx.strokeStyle = 'rgba(180,205,255,0.95)';
            ctx.stroke();
        }
        const rest = counts.filter(([u]) => u !== SHIELD);
        if (!rest.length) return;
        const total = rest.reduce((n, [, c]) => n + c, 0);
        const maxBar = size * 1.05;
        const w = Math.min(maxBar, Math.max(size * 0.16, Math.sqrt(total) * size * 0.10));
        let x = cx - w / 2;
        const y = cy + size * 0.10;
        const h = Math.max(2, size * 0.10);
        for (const [u, c] of rest) {
            const frac = c / total;
            ctx.fillStyle = UNIT_TINT[u] || '#dfe6ee';
            ctx.fillRect(x, y, Math.max(1.5, w * frac - 1), h);
            x += w * frac;
        }
    }

    drawForces(ctx, game, view) {
        const z = this.camera.zoom;
        const r = Math.max(3, z * 0.22);
        for (const f of game.forces) {
            if (f.idx >= f.path.length - 1) continue;   // already parked somewhere
            if (this.fog && view && f.owner !== view.playerId &&
                !(view.allies && view.allies.has(f.owner)) &&
                !this.fog(f.source) && !this.fog(f.destination)) continue;
            const [wx, wy] = f.position(0);
            const [sx, sy] = this.camera.toScreen(wx, wy, this.cw, this.ch);
            if (sx < -40 || sy < -40 || sx > this.cw + 40 || sy > this.ch + 40) continue;
            const c = this.colorFor(game, f.owner, view);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = f.owner == null ? 'rgba(120,120,120,0.85)' : `rgb(${this.shade(c, 1.05)})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
            if (z > 13) {
                const n = f.units.counts().reduce((s, [, c2]) => s + c2, 0);
                ctx.fillStyle = 'rgba(20,24,26,0.85)';
                ctx.font = `bold ${Math.max(8, r * 1.15)}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(String(n), sx, sy - r * 1.4);
            }
        }
    }

    drawSelection(ctx, game, view) {
        if (!view || !view.selected) return;
        const t = game.getTower(view.selected);
        if (!t) return;
        const z = this.camera.zoom;
        const a = integerPosition(t.x, t.y);
        const [sx, sy] = this.camera.toScreen(a[0], a[1], this.cw, this.ch);
        ctx.beginPath();
        ctx.arc(sx, sy + z * 0.30, z * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // SVG glyph for a tower type, stroked in `color`. Cached per (type, colour).
    glyph(type, color) {
        const key = type + ':' + color.join(',');
        let img = this.glyphCache.get(key);
        if (!img) {
            const svg = (TOWER_SVG[type] || '')
                .replace(/stroke="#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"/g, `stroke="rgb(${color.join(',')})"`);
            img = new Image();
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            this.glyphCache.set(key, img);
        }
        return img;
    }

    shade(c, k) {
        return [c[0], c[1], c[2]].map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',');
    }
}

const UNIT_TINT = {
    [UNIT_ID.Fighter]: '#7fd1ff',
    [UNIT_ID.Chopper]: '#9be15d',
    [UNIT_ID.Bomber]: '#ffd166',
    [UNIT_ID.Tank]: '#f2a65a',
    [UNIT_ID.Soldier]: '#e8eef6',
    [UNIT_ID.Shell]: '#ff9f1c',
    [UNIT_ID.Emp]: '#4cc9f0',
    [UNIT_ID.Nuke]: '#ff4d4d',
    [UNIT_ID.King]: '#ffd700',
};
