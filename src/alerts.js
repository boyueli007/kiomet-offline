// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The alerts the real game shows at the top of the screen, ported from
// common/src/alerts.rs and client/src/ui/alert_overlay.rs:
//   * your King is unsafe / under attack (takes priority)
//   * the opening tutorial (capture a tower, then upgrade one)
//   * a tower is full / overflowing
//   * zombies are attacking
// Each one carries a tower so clicking it can jump there.

import { SHIELD, UNITS, isMobile, TOWER } from './data.js';

export const ALERT_TEXT = {
    rulerAttack: ['Your King is under attack!', 'If they die, you lose the game'],
    rulerUnsafe: ['Move your King to safety',
        'Shielded Headquarters or Bunkers near the center of your territory provide the most protection'],
    capture: ['Capture more towers', 'Drag units from your towers to outside your borders'],
    upgrade: ['Upgrade a tower', 'Click a tower to show upgrade options'],
    full: ['A tower is full', 'Drag away units to make room for more'],
    overflow: ['A tower is overflowing', 'Drag away units to stop them from disappearing'],
    zombies: ['Zombies sighted', 'Escape them by moving in the opposite direction'],
};

export class AlertBoard {
    constructor() {
        this.tutorial = 'capture';        // 'capture' | 'upgrade' | 'done'
        this.dismissed = new Set();       // one-shot dismissals for this run
        this.zombieSeen = false;
        this.last = [];
    }

    reset() {
        this.tutorial = 'capture';
        this.dismissed.clear();
        this.zombieSeen = false;
        this.last = [];
    }

    dismiss(kind) { this.dismissed.add(kind); }

    // Recompute every second, exactly like the server does for Alerts.
    evaluate(game, me) {
        const out = [];
        if (!me.alive) { this.last = out; return out; }

        const mine = [...me.towers].map((k) => game.towers.get(k)).filter((t) => t && t.owner === me.id);
        const king = mine.find((t) => t.units.hasRuler());
        const ks = king ? { x: king.x, y: king.y } : null;

        if (king) {
            const incoming = king.inbound.filter((f) => f.owner !== me.id &&
                game.relationship(me.id, f.owner) === 'enemy');
            const shields = king.units.get(SHIELD);
            const need = TOWER[king.type].maxRangedDamage();
            // Kiomet treats a missing tower or an enemy tower as unsafe; empty (neutral)
            // towers don't count against you.
            const neighboursOwned = [...neighborsOf(king)].every((n) => {
                const t = game.getTower(n);
                return !t || t.owner == null || t.owner === me.id;
            });
            const safe = (shields >= need || neighboursOwned) &&
                !incoming.some((f) => f.owner !== me.id);
            if (incoming.length && !safe) {
                out.push(this.item('rulerAttack', ks));
            } else if (!safe && !this.dismissed.has('rulerUnsafe')) {
                out.push(this.item('rulerUnsafe', ks));
            }
        }

        // Tutorial: nudge after a few seconds if the player hasn't done it yet.
        if (this.tutorial !== 'done' && game.time > 12 && !this.dismissed.has(this.tutorial)) {
            const target = this.tutorial === 'capture'
                ? (mine[0] || null)
                : (mine.find((t) => t.active && TOWER[t.type].upgrades.length) || null);
            if (target) out.push(this.item(this.tutorial, { x: target.x, y: target.y }));
        }

        const { full, overflow, zombie } = this.health(game, mine);
        if (full && !this.dismissed.has('full')) out.push(this.item('full', full));
        if (overflow && !this.dismissed.has('overflow')) out.push(this.item('overflow', overflow));
        if (zombie && !this.dismissed.has('zombies')) out.push(this.item('zombies', zombie));

        this.last = out;
        return out;
    }

    item(kind, tower) {
        const [title, hint] = ALERT_TEXT[kind];
        return { kind, title, hint, tower };
    }

    // "A tower is full / overflowing" + "zombies are attacking this tower".
    health(game, mine) {
        let full = null, overflow = null, zombie = null;
        for (const t of mine) {
            if (!t.active) continue;
            for (const [u, c] of t.units.counts()) {
                if (!isMobile(u, t.type)) continue;
                const cap = t.units.capacity(u, t.type);
                const generates = TOWER[t.type].genPeriod(u) != null;
                if (c > cap) overflow = overflow || { x: t.x, y: t.y };
                else if (c === cap && generates && !t.supply) full = full || { x: t.x, y: t.y };
            }
            if (!zombie && t.inbound.some((f) => f.owner === null)) zombie = { x: t.x, y: t.y };
        }
        return { full, overflow, zombie };
    }

    // Called by the app when the player actually does the tutorial step.
    onCapture() { if (this.tutorial === 'capture') this.tutorial = 'upgrade'; }
    onUpgrade() { if (this.tutorial === 'upgrade') this.tutorial = 'done'; }
}

function* neighborsOf(t) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            yield { x: t.x + dx, y: t.y + dy };
        }
    }
}
