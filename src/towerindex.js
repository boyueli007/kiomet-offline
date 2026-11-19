// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Tower storage: a keyed grid that behaves like the Map the engine was written against, but
// only pays for cells that actually hold a tower.

import { WORLD_SIZE } from './geom.js';

export const indexKey = (x, y) => y * WORLD_SIZE + x;

export class TowerIndex {
    constructor() {
        this.grid = new Map();          // tile key -> Tower (sparse; dense enough already)
        this.version = 0;
    }

    get size() { return this.grid.size; }

    get(k) { return this.grid.get(k); }

    // Map-compatible helpers used across the engine.
    has(k) { return this.grid.has(k); }
    set(k, t) { this.grid.set(k, t); this.version += 1; return this; }
    delete(k) { const ok = this.grid.delete(k); if (ok) this.version += 1; return ok; }
    clear() { this.grid.clear(); this.version += 1; }
    entries() { return this.grid.entries(); }
    keys() { return this.grid.keys(); }
    values() { return this.grid.values(); }
    [Symbol.iterator]() { return this.grid[Symbol.iterator](); }
    forEach(fn) { return this.grid.forEach(fn); }

    // Towers inside a square of cells around (cx, cy).
    *near(cx, cy, radius) {
        for (let y = cy - radius; y <= cy + radius; y++) {
            if (y < 0 || y >= WORLD_SIZE) continue;
            for (let x = cx - radius; x <= cx + radius; x++) {
                if (x < 0 || x >= WORLD_SIZE) continue;
                const t = this.grid.get(y * WORLD_SIZE + x);
                if (t) yield t;
            }
        }
    }
}
