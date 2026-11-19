// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Tower / unit / combat data. Ported from Softbear, Inc.'s Kiomet (AGPL-3.0-or-later),
// common/src/tower.rs, common/src/unit.rs and macros/src/lib.rs.

export const TICK_HZ = 4;
// Towers at or next to the King are high morale: same speed, but slower to leave.
export const RULER_MARCH_MULT = 2;
export const SHIELD = 0, FIGHTER = 1, CHOPPER = 2, BOMBER = 3, TANK = 4, SOLDIER = 5,
    SHELL = 6, EMP = 7, NUKE = 8, RULER = 9;

export const UNITS = [
    { name: 'Shield', cls: 'always', speed: 'shield', damage: 1, maxOverflow: 15 },
    { name: 'Fighter', cls: 'many', speed: 'fast', damage: 1, maxOverflow: 4 },
    { name: 'Chopper', cls: 'many', speed: 'fast', damage: 1, maxOverflow: 2 },
    { name: 'Bomber', cls: 'many', speed: 'fast', damage: 1, maxOverflow: 2 },
    { name: 'Tank', cls: 'many', speed: 'slow', damage: 3, maxOverflow: 5, weight: 2 },
    { name: 'Soldier', cls: 'many', speed: 'normal', damage: 1, maxOverflow: 10, weight: 1 },
    { name: 'Shell', cls: 'single', speed: 'fast', damage: 3, maxOverflow: 0, range: 'short' },
    { name: 'Emp', cls: 'single', speed: 'normal', damage: 1, maxOverflow: 0, range: 'medium' },
    { name: 'Nuke', cls: 'single', speed: 'slow', damage: 31, maxOverflow: 0, range: 'short' },
    { name: 'King', cls: 'single', speed: 'normal', damage: 1, maxOverflow: 0 },
];

export const UNIT_ID = {};
UNITS.forEach((u, i) => { UNIT_ID[u.name] = i; });
export const UNIT_ICONS = ['shield', 'fighter', 'chopper', 'bomber', 'tank', 'soldier',
    'shell', 'emp', 'nuke', 'king'];

const RANGE_DIST = { short: 5, medium: 8, long: 11 };
export const MAX_ROAD_LENGTH = 5;
export const rangedDistance = (u) => (UNITS[u].range ? RANGE_DIST[UNITS[u].range] * MAX_ROAD_LENGTH : null);
export const isRanged = (u) => !!(UNITS[u] && UNITS[u].range);
export const isSingleUse = (u) => isRanged(u);

export function speed(u, towerType) {
    if (u === SHIELD) return (towerType == null || towerType === 'Projector') ? 'fast' : 'immobile';
    return UNITS[u].speed;
}
export const isMobile = (u, towerType) => speed(u, towerType) !== 'immobile';
export const canCapture = (u) => u != null && isMobile(u, null) && u !== SHIELD && !isSingleUse(u);

// Field: higher = further above ground. Iterated Air then Surface, like the original.
export function field(u, overflow, inForce, anyAir) {
    switch (u) {
        case SHIELD: return anyAir ? 1 : 0;
        case BOMBER: case CHOPPER: case FIGHTER: case SHELL: case EMP: case NUKE:
            return (overflow || inForce) ? 1 : 0;
        default: return 0;
    }
}

export function damage(u, uField, eField) {
    switch (u) {
        case TANK: return 3;
        case FIGHTER: return uField === 1 ? 3 : 1;
        case BOMBER: return (uField === 1 && eField === 0) ? 5 : 1;
        case CHOPPER: return uField === 1 ? 3 : 1;
        case NUKE: return 31;
        case SHELL: return 3;
        default: return 1;
    }
}
export const INFINITE_DAMAGE = 31;
export const finiteDamage = (d) => (d === INFINITE_DAMAGE ? 2147483647 : d);
export const groundDamage = (u) => damage(u, field(u, false, true, false), 0);

export const EMP_TICKS = 60 * TICK_HZ;

// 27 towers. `pre` = [downgrade, [delaySeconds, [type, count]...]]
const T = (name, o) => ({ name, cap: {}, gen: {}, pre: [], score: 1, sensor: 12, spawnable: false, ...o });

export const TOWERS = [
    T('Airfield', {
        cap: { Fighter: 4, Bomber: 4, Soldier: 4, Tank: 3, Shield: 10 },
        gen: { Bomber: 30 }, spawnable: true,
        pre: ['Runway', [20, ['Factory', 2], ['Radar', 1]]],
    }),
    T('Armory', {
        cap: { Soldier: 4, Tank: 5, Shield: 15 }, gen: { Tank: 15 }, spawnable: true,
        pre: ['Barracks', [25, ['Factory', 1], ['Mine', 1]]],
    }),
    T('Artillery', {
        cap: { Shell: 3, Shield: 20 }, gen: { Shell: 15 },
        pre: ['Bunker', [40, ['Refinery', 2], ['Radar', 3]]],
    }),
    T('Barracks', {
        cap: { Soldier: 12, Tank: 2, Shield: 10 }, gen: { Soldier: 6 }, spawnable: true,
    }),
    T('Bunker', {
        cap: { Soldier: 6, Shield: 40 }, spawnable: true,
        pre: ['Cliff', [30, ['Headquarters', 1], ['Ews', 1]]],
    }),
    T('Centrifuge', {
        cap: { Soldier: 4, Tank: 2, Shield: 15 },
        pre: ['Generator', [30, ['Mine', 3]]],
    }),
    T('City', {
        cap: { Fighter: 2, Soldier: 6, Tank: 2, Shield: 15 }, score: 5,
        pre: ['Town', [30, ['Quarry', 2], ['Reactor', 1], ['Town', 3]]],
    }),
    T('Cliff', { cap: { Soldier: 4, Tank: 2, Shield: 30 }, spawnable: true }),
    T('Ews', {
        cap: { Soldier: 4, Tank: 2, Shield: 15 }, sensor: 20,
        pre: ['Radar', [30, ['Generator', 2]]],
    }),
    T('Factory', { cap: { Soldier: 4, Tank: 2, Shield: 10 }, score: 2 }),
    T('Generator', { cap: { Soldier: 4, Tank: 2, Shield: 10 } }),
    T('Headquarters', {
        cap: { Soldier: 8, Tank: 2, Shield: 40 },
        pre: ['Village', [20, ['Radar', 1]]],
    }),
    T('Helipad', {
        cap: { Chopper: 3, Soldier: 4, Tank: 2, Shield: 15 }, gen: { Chopper: 30 }, spawnable: true,
        pre: ['Airfield', [20, ['Armory', 2], ['Factory', 3]]],
    }),
    T('Launcher', {
        cap: { Emp: 1, Shield: 15 }, gen: { Emp: 80 },
        pre: ['Rocket', [30, ['Airfield', 2]]],
    }),
    T('Mine', { cap: { Soldier: 4, Tank: 2, Shield: 15 }, score: 2 }),
    T('Projector', {
        cap: { Soldier: 4, Tank: 2, Shield: 10 }, gen: { Shield: 3 },
        pre: ['Centrifuge', [20, ['Rampart', 2], ['Reactor', 2]]],
    }),
    T('Quarry', {
        cap: { Soldier: 6, Tank: 2, Shield: 10 }, score: 2,
        pre: ['Cliff', [20, ['Village', 1]]],
    }),
    T('Radar', { cap: { Soldier: 4, Tank: 2, Shield: 10 }, sensor: 16 }),
    T('Rampart', {
        cap: { Soldier: 8, Shield: 45 }, gen: { Shield: 3 },
        pre: ['Cliff', [20, ['Barracks', 2]]],
    }),
    T('Reactor', {
        cap: { Soldier: 4, Tank: 2, Shield: 10 },
        pre: ['Generator', [40, ['Centrifuge', 1]]],
    }),
    T('Refinery', {
        cap: { Soldier: 4, Tank: 2, Shield: 5 }, score: 3,
        pre: ['Factory', [20, ['Generator', 3], ['Cliff', 1]]],
    }),
    T('Rocket', {
        cap: { Soldier: 4, Tank: 2, Shield: 15 },
        pre: ['Radar', [20, ['Refinery', 1]]],
    }),
    T('Runway', {
        cap: { Fighter: 4, Soldier: 4, Tank: 2, Shield: 5 }, gen: { Fighter: 30 }, spawnable: true,
    }),
    T('Satellite', {
        cap: { Soldier: 4, Tank: 2, Shield: 15 }, sensor: 30,
        pre: ['Ews', [40, ['Rocket', 2], ['Generator', 5]]],
    }),
    T('Silo', {
        cap: { Nuke: 1, Soldier: 4, Tank: 1, Shield: 20 }, gen: { Nuke: 120 },
        pre: ['Quarry', [40, ['Centrifuge', 2]]],
    }),
    T('Town', {
        cap: { Fighter: 1, Soldier: 4, Tank: 1, Shield: 10 }, score: 2,
        pre: ['Village', [20, ['Generator', 1], ['Village', 3]]],
    }),
    T('Village', { cap: { Soldier: 4, Shield: 5 } }),
];

// Index by name, and precompute per-tower lookups.
export const TOWER = {};
TOWERS.forEach((t, i) => { t.id = i; TOWER[t.name] = t; });
export const TOWER_NAMES = TOWERS.map((t) => t.name);

for (const t of TOWERS) {
    // The downgrade is the first prerequisite kind (a mid-tier one like Bunker is fine).
    t.down = t.pre.length ? t.pre[0] : null;
    t.delay = t.pre.length ? t.pre[1][0] : 0;
    t.prereqs = t.pre.length ? t.pre[1].slice(1) : [];
    t.upgrades = [];
    t.basis = t.name;
    t.rangedDist = Object.keys(t.gen)
        .map((u) => { const id = UNIT_ID[u]; return id == null ? null : rangedDistance(id); })
        .find((d) => d != null) ?? null;
    t.rawCap = (u) => t.cap[UNITS[u].name] || 0;
    t.genPeriod = (u) => {
        const s = t.gen[UNITS[u].name];
        return s == null ? null : s * TICK_HZ;
    };
    t.genUnitId = (u) => UNIT_ID[u];
    t.generatesMobile = UNITS.some((_, u) => isMobile(u, t.name) && t.genPeriod(u) != null);
    t.rangedDamage = (d) => (t.name === 'Bunker' ? Math.floor(d / 3)
        : t.name === 'Headquarters' ? Math.floor(d * 2 / 3) : d);
    t.maxRangedDamage = () => t.rangedDamage(INFINITE_DAMAGE);
}

// Tower level (invariant: higher than downgrade and prerequisites).
for (let pass = 0; pass < 8; pass++) {
    for (const t of TOWERS) {
        let m = 0;
        for (const p of t.prereqs) m = Math.max(m, TOWER[p[0]].level || 0);
        if (t.down) m = Math.max(m, TOWER[t.down].level || 0);
        t.level = t.prereqs.length || t.down ? m + 1 : 0;
    }
}
// The downgrade chain, resolved after every tower knows its own downgrade.
for (const t of TOWERS) {
    for (let guard = 0; guard < 10; guard++) {
        const d = TOWER[t.basis].down;
        if (!d) break;
        t.basis = d;
    }
}

// A tower can be built straight from its base kind (Kiomet shows e.g. Cliff -> Quarry).
for (const t of TOWERS) {
    if (t.down) {
        const owner = TOWER[t.down];
        if (!owner.upgrades.includes(t.name)) owner.upgrades.push(t.name);
    }
}
export const SPAWNABLE = TOWERS.filter((t) => t.pre.length === 0);

export function meetsPrereqs(name, counts) {
    return TOWER[name].prereqs.every(([p, n]) => (counts[p] || 0) >= n);
}

// "The eight basic kinds are scattered across the map."
export function randomSpawnableType(hash) {
    return SPAWNABLE[hash % SPAWNABLE.length].name;
}
