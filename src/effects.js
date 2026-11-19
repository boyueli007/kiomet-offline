// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Battle feedback: sparks when a fight lands, expanding rings for EMP/nuke/shell, floating
// "+1 capture" pings, and a tiny WebAudio synthesiser (no asset needed).

import { ATTACKER, DEFENDER } from './rules.js';

export class Effects {
    constructor() {
        this.items = [];          // {kind, x, y, t, life, ...}
        this.audio = null;
        this.enabled = true;
    }

    clear() { this.items.length = 0; }

    // Map an engine event to particles. `x, y` are world coordinates.
    onEvent(e, worldPos) {
        if (!this.enabled || !worldPos) return;
        const [x, y] = worldPos;
        switch (e.type) {
            case 'shell':
                this.ring(x, y, 10, 26, '#ffb347', 420);
                this.play('hit', 0.35);
                break;
            case 'emp':
                this.ring(x, y, 6, 46, '#4cc9f0', 700);
                this.play('emp', 0.5);
                break;
            case 'nuke':
                this.ring(x, y, 8, 90, '#ff5a5a', 900);
                this.ring(x, y, 4, 60, '#ffd166', 650);
                this.play('nuke', 0.6);
                break;
            case 'ruler':
                this.ring(x, y, 6, 50, '#ffd166', 900);
                this.play('ruler', 0.7);
                this.float(x, y, 'King lost!', '#ffd166', 1400);
                break;
            case 'gained':
                this.spark(x, y, 7, '#8fd3ff');
                this.play('capture', 0.18);
                break;
            case 'lostTower':
                this.spark(x, y, 5, '#ff8f7a');
                break;
            case 'lostForce':
                this.spark(x, y, 4, '#cfcfcf');
                break;
            case 'died':
                this.play('loss', 0.5);
                break;
            case 'upgrade':
                this.ring(x, y, 4, 22, '#ffffff', 400);
                this.play('upgrade', 0.2);
                break;
            default:
                break;
        }
    }

    spill(x, y, n, colour) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const speed = 12 + Math.random() * 26;
            this.items.push({
                kind: 'spark', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                t: 0, life: 0.35 + Math.random() * 0.3, colour,
            });
        }
    }

    spark(x, y, n, colour) { this.spill(x, y, n, colour); }

    ring(x, y, r0, r1, colour, life) {
        this.items.push({ kind: 'ring', x, y, r0, r1, t: 0, life: life / 1000, colour });
    }

    float(x, y, text, colour, life) {
        this.items.push({ kind: 'float', x, y, text, colour, t: 0, life: life / 1000 });
    }

    // Advance and draw. `toScreen` converts world (x, y) to canvas pixels.
    render(ctx, toScreen, zoom, dt = 1 / 60) {
        if (!this.items.length) return;
        dt = Math.min(0.1, Math.max(0.001, dt));
        for (const it of this.items) {
            it.t += dt;
            const k = Math.min(1, it.t / it.life);
            const [sx, sy] = toScreen(it.x, it.y);
            if (it.kind === 'spark') {
                ctx.globalAlpha = 1 - k;
                ctx.fillStyle = it.colour;
                const sz = Math.max(1.5, zoom * 0.09);
                ctx.fillRect(sx + it.vx * it.t * zoom - sz / 2, sy + it.vy * it.t * zoom - sz / 2 + 12 * it.t * it.t * zoom, sz, sz);
            } else if (it.kind === 'ring') {
                ctx.globalAlpha = (1 - k) * 0.9;
                ctx.strokeStyle = it.colour;
                ctx.lineWidth = Math.max(1.2, zoom * 0.06) * (1 - k * 0.6);
                ctx.beginPath();
                ctx.arc(sx, sy, (it.r0 + (it.r1 - it.r0) * k) * zoom * 0.12 + 4, 0, Math.PI * 2);
                ctx.stroke();
            } else if (it.kind === 'float') {
                ctx.globalAlpha = 1 - k;
                ctx.fillStyle = it.colour;
                ctx.font = `bold ${Math.max(11, zoom * 0.5)}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(it.text, sx, sy - 20 - k * 26);
            }
        }
        ctx.globalAlpha = 1;
        this.items = this.items.filter((it) => it.t < it.life);
    }

    // ---- audio: small synthesised blips, created on first user gesture ----
    ensureAudio() {
        if (this.audio || !this.enabled) return this.audio;
        const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return null;
        try { this.audio = new AC(); } catch { this.audio = null; }
        return this.audio;
    }

    play(kind, vol = 0.3) {
        if (!this.enabled) return;
        const ac = this.ensureAudio();
        if (!ac || ac.state === 'suspended') return;
        const now = ac.currentTime;
        const o = ac.createOscillator();
        const g = ac.createGain();
        const table = {
            hit: { type: 'square', f0: 320, f1: 160, dur: 0.08 },
            capture: { type: 'triangle', f0: 520, f1: 780, dur: 0.12 },
            upgrade: { type: 'sine', f0: 660, f1: 990, dur: 0.16 },
            emp: { type: 'sawtooth', f0: 720, f1: 90, dur: 0.35 },
            nuke: { type: 'sawtooth', f0: 180, f1: 40, dur: 0.7 },
            ruler: { type: 'sine', f0: 440, f1: 110, dur: 0.8 },
            loss: { type: 'sine', f0: 300, f1: 80, dur: 1.2 },
        }[kind];
        if (!table) return;
        o.type = table.type;
        o.frequency.setValueAtTime(table.f0, now);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, table.f1), now + table.dur);
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + table.dur);
        o.connect(g).connect(ac.destination);
        o.start(now);
        o.stop(now + table.dur + 0.02);
    }
}
