// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// World geometry: tower ids, roads, connectivity. Ported from Kiomet
// common/src/tower/id.rs and common/src/tower/connectivity.rs.

import { MAX_ROAD_LENGTH, randomSpawnableType } from './data.js';

export const WORLD_SIZE = 512;
export const CENTER = { x: 256, y: 256 };
const MAX_ROAD_SQ = (MAX_ROAD_LENGTH + 1) ** 2 - 1;

const FNV_OFFSET = 2166136261 >>> 0;
const FNV_PRIME = 16777619;

function fnv(seed, bytes) {
    let h = seed >>> 0;
    for (const b of bytes) {
        h = Math.imul(h, FNV_PRIME) >>> 0;
        h = (h ^ b) >>> 0;
    }
    return h;
}
const condense16 = (h) => ((h & 0xffff) ^ (h >>> 16)) >>> 0;
const condense8 = (h) => ((h & 0xff) ^ (h >>> 8)) & 0xff;

const u16bytes = (v) => [v & 0xff, (v >>> 8) & 0xff];

// Deterministic per-cell jitter, 1..4 in each axis.
const offsetCache = new Map();
export function offset(x, y) {
    const k = (y << 9) | x;
    let v = offsetCache.get(k);
    if (v === undefined) {
        const h = condense8(condense16(fnv(FNV_OFFSET, [...u16bytes(x), ...u16bytes(y)])));
        v = [(h & 3) + 1, ((h >>> 4) & 3) + 1];
        offsetCache.set(k, v);
    }
    return v;
}

export function integerPosition(x, y) {
    const o = offset(x, y);
    return [x * 5 + o[0], y * 5 + o[1]];
}
export const position = (id) => integerPosition(id.x, id.y);

export function towerTypeAt(x, y) {
    let h = FNV_OFFSET;
    h = fnv(h, u16bytes((x + 31415) & 0xffff));
    h = fnv(h, u16bytes((y + 31415) & 0xffff));
    return randomSpawnableType(condense8(condense16(condense16(h))));
}

const NB = [
    [0, 1, 'N'], [1, 1, 'NE'], [1, 0, 'E'], [1, -1, 'SE'],
    [0, -1, 'S'], [-1, -1, 'SW'], [-1, 0, 'W'], [-1, 1, 'NW'],
];

export function areNeighbors(a, b) {
    if (a.x === b.x && a.y === b.y) return false;
    if (b.x < 0 || b.y < 0 || b.x >= WORLD_SIZE || b.y >= WORLD_SIZE) return false;
    const pa = integerPosition(a.x, a.y), pb = integerPosition(b.x, b.y);
    const dx = pa[0] - pb[0], dy = pa[1] - pb[1];
    const d2 = dx * dx + dy * dy;
    if (d2 > MAX_ROAD_SQ) return false;
    if (b.x !== a.x && b.y !== a.y) {
        const o1 = integerPosition(a.x, b.y), o2 = integerPosition(b.x, a.y);
        const ox = o1[0] - o2[0], oy = o1[1] - o2[1];
        if (ox * ox + oy * oy <= d2) return false; // intersections with a shorter road
    }
    return true;
}

// Road connectivity for a cell as an 8-bit mask + ordered list of neighbor ids.
const neighborCache = new Map();
export function neighbors(x, y) {
    const k = (y << 9) | x;
    let v = neighborCache.get(k);
    if (v === undefined) {
        v = [];
        for (const [dx, dy] of NB) {
            const b = { x: x + dx, y: y + dy };
            if (b.x < 0 || b.y < 0 || b.x >= WORLD_SIZE || b.y >= WORLD_SIZE) continue;
            if (areNeighbors({ x, y }, b)) v.push(b);
        }
        neighborCache.set(k, v);
    }
    return v;
}

export function distanceSquared(a, b) {
    const pa = integerPosition(a.x, a.y), pb = integerPosition(b.x, b.y);
    const dx = pa[0] - pb[0], dy = pa[1] - pb[1];
    return dx * dx + dy * dy;
}
export const distance = (a, b) => Math.floor(Math.sqrt(distanceSquared(a, b)));

// Breadth-first parent pointers towards the world center (same construction order as the
// original's connectivity table: center first, then BFS over *all* 8 neighbours).
let PARENT = null;
export function buildConnectivity() {
    PARENT = new Map();
    const key = (id) => id.y * WORLD_SIZE + id.x;
    const c = { x: CENTER.x, y: CENTER.y };
    PARENT.set(key(c), c); // the center points at itself
    const queue = [c];
    for (let head = 0; head < queue.length; head++) {
        const p = queue[head];
        for (const n of allNeighbors(p)) {
            const k = key(n);
            if (PARENT.has(k)) continue;
            PARENT.set(k, p);
            queue.push(n);
        }
        if (queue.length > WORLD_SIZE * WORLD_SIZE) break;
    }
    return PARENT.size;
}

function allNeighbors(p) {
    const out = [];
    for (const [dx, dy] of NB) {
        const b = { x: p.x + dx, y: p.y + dy };
        if (b.x < 0 || b.y < 0 || b.x >= WORLD_SIZE || b.y >= WORLD_SIZE) continue;
        out.push(b);
    }
    return out;
}

export const connectivity = (id) => PARENT.get(id.y * WORLD_SIZE + id.x);
export const isSpawnablePosition = (id) => {
    if (id.x < 1 || id.y < 1 || id.x >= WORLD_SIZE - 1 || id.y >= WORLD_SIZE - 1) return false;
    return connectivity(id) !== undefined;
};
