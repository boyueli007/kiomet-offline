// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Fog of war, ported from Kiomet's client/src/visible.rs: a tower sees `sensor_radius` world
// units around itself, the union of your towers' sensors is visible, and an inactive tower
// (upgrading or EMP'd) sees no further than a mine.

import { TOWER } from './data.js';
import { WORLD_SIZE } from './geom.js';

const RAD = 5;                  // world units per cell
const REF_RADIUS = 15;          // widest sensor radius, in cells (satellite = 30 world units)

export class Visibility {
    constructor() {
        this.stamp = new Uint32Array(WORLD_SIZE * WORLD_SIZE);
        this.gen = 0;
        this.lastVersion = -1;
        this.dirty = true;
    }

    invalidate() { this.dirty = true; }

    // union of every sensor you own
    update(game, playerId, allVisible) {
        if (allVisible) { this.gen += 1; return; }
        if (!this.dirty && this.lastVersion === game.towers.version && this.lastPlayer === playerId) return;
        this.gen += 1;
        const g = this.gen;
        this.lastVersion = game.towers.version;
        this.lastPlayer = playerId;
        this.dirty = false;
        for (const t of game.towers.values()) {
            if (t.owner !== playerId) continue;
            this.stampArea(t, g);
        }
    }

    // `Tower::active()` false -> sensor falls back to a mine's (the client does the same)
    radiusOf(t) {
        const type = t.delay > 0 ? 'Mine' : t.type;
        return TOWER[type].sensor / RAD;
    }

    stampArea(t, g) {
        const r = this.radiusOf(t);
        const r2 = r * r;
        const x0 = Math.round(t.x), y0 = Math.round(t.y);
        for (let dy = -REF_RADIUS; dy <= REF_RADIUS; dy++) {
            const y = y0 + dy;
            if (y < 0 || y >= WORLD_SIZE) continue;
            const row = y * WORLD_SIZE;
            for (let dx = -REF_RADIUS; dx <= REF_RADIUS; dx++) {
                const x = x0 + dx;
                if (x < 0 || x >= WORLD_SIZE) continue;
                if (dx * dx + dy * dy > r2) continue;
                this.stamp[row + x] = g;
            }
        }
    }

    // Merge another player's sensors (allies share sight, like the client's union).
    addAllies(game, allies) {
        if (!allies || !allies.size) return;
        const g = this.gen;
        for (const t of game.towers.values()) {
            if (t.owner != null && allies.has(t.owner)) this.stampArea(t, g);
        }
    }

    // Cheap "is this world point inside your sight" for events that are not tied to a tower.
    near(wx, wy, game) {
        const cx = Math.round(wx / RAD), cy = Math.round(wy / RAD);
        for (let dy = -6; dy <= 6; dy++) {
            for (let dx = -6; dx <= 6; dx++) {
                const t = game.tower(cx + dx, cy + dy);
                if (!t) continue;
                const d = Math.hypot(t.x * RAD - wx, t.y * RAD - wy);
                if (d <= this.radiusOf(t) * RAD) return true;
            }
        }
        return false;
    }

    visible(t) {
        if (!t) return false;
        if (this.gen === 0) return false;
        return this.stamp[t.y * WORLD_SIZE + t.x] === this.gen;
    }
}
