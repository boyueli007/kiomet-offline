// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Unit containers, combat and forces. Ported from Kiomet common/src/units.rs,
// common/src/combatants.rs and common/src/force.rs.

import {
    UNITS, SHIELD, FIGHTER, CHOPPER, TANK, SOLDIER, EMP, NUKE, SHELL, RULER,
    field, damage, finiteDamage, isRanged, isSingleUse, isMobile, speed, TOWER,
    RULER_SHIELD_BOOST,
} from './data.js';
import { distance, integerPosition } from './geom.js';

// A Units container: shields + (five "many" counts) XOR (one "single" unit).
export class Units {
    constructor() { this.shield = 0; this.many = [0, 0, 0, 0, 0]; this.single = null; this.singleCount = 0; }

    clone() {
        const u = new Units();
        u.shield = this.shield;
        u.many = this.many.slice();
        u.single = this.single; u.singleCount = this.singleCount;
        return u;
    }
    isEmpty() { return this.shield === 0 && this.single === null && this.many.every((c) => c === 0); }

    get(u) {
        if (u === SHIELD) return this.shield;
        if (UNITS[u] === undefined) return 0;
        if (UNITS[u].cls === 'many') return this.single !== null ? 0 : this.many[u - FIGHTER];
        return this.single === u ? this.singleCount : 0;
    }

    counts() {
        const out = [];
        if (this.shield) out.push([SHIELD, this.shield]);
        if (this.single !== null) { if (this.singleCount) out.push([this.single, this.singleCount]); }
        else for (let i = 0; i < 5; i++) if (this.many[i]) out.push([i + FIGHTER, this.many[i]]);
        return out;
    }

    hasRuler() { return this.single === RULER; }
    len() { let n = 0; for (const [, c] of this.counts()) n += c; return n; }
    isAlive() { return this.counts().some(([u]) => !isSingleUse(u) && u !== SHIELD); }
    isMany() { return this.single === null; }

    capacity(u, towerType) {
        // The world's own ruler slot: every tower type has capacity 1 for him.
        if (u === RULER) return towerType == null ? 255 : 1;
        const base = towerType == null ? 255
            : TOWER[towerType].rawCap(u) + (u === SHIELD && this.hasRuler() ? RULER_SHIELD_BOOST : 0);
        return Math.min(255, base);
    }

    spaceRemaining(u, towerType, overflow) {
        const cls = UNITS[u].cls;
        if (cls === 'many' && this.single !== null) return 0;
        if (cls === 'single' && this.single !== null && this.single > u) return 0;
        return Math.max(0, this.capacity(u, towerType) + (overflow ? UNITS[u].maxOverflow : 0) - this.get(u));
    }

    add(u, count, towerType = null, overflow = true) {
        const added = Math.min(count, this.spaceRemaining(u, towerType, overflow));
        if (added <= 0) return 0;
        const cls = UNITS[u].cls;
        if (cls === 'always') this.shield += added;
        else if (cls === 'many') {
            if (this.single !== null) return 0;
            this.many[u - FIGHTER] += added;
        } else if (this.single === u) this.singleCount += added;
        else {
            this.many = [0, 0, 0, 0, 0];
            this.single = u; this.singleCount = added;
        }
        return added;
    }

    subtract(u, count) {
        const sub = Math.min(count, this.get(u));
        if (sub <= 0) return 0;
        if (u === SHIELD) this.shield -= sub;
        else if (UNITS[u].cls === 'many') this.many[u - FIGHTER] -= sub;
        else {
            this.singleCount -= sub;
            if (this.singleCount === 0) { this.single = null; this.many = [0, 0, 0, 0, 0]; }
        }
        return sub;
    }

    addUnitsToTower(other, towerType, hasPlayer) {
        for (const [u, c] of other.counts()) {
            if (isSingleUse(u)) continue;
            this.add(u, c, towerType, hasPlayer);
        }
    }

    reconcile(towerType, hasPlayer) {
        const old = this.clone();
        this.shield = 0; this.many = [0, 0, 0, 0, 0]; this.single = null; this.singleCount = 0;
        this.addUnitsToTower(old, towerType, hasPlayer);
    }

    forceUnits(towerType) {
        const out = new Units();
        for (const [u, c] of this.counts()) if (isMobile(u, towerType)) out.add(u, c);
        return out;
    }

    maxEdgeDistance() {
        let acc = null;
        for (const [u] of this.counts()) acc = isRanged(u) ? rangedDistanceOf(u) : null;
        return acc;
    }

    forceGroundDamage() {
        let total = 0;
        for (const [u, c] of this.counts()) total += finiteDamage(damage(u, field(u, false, true, false), 0)) * c;
        return total;
    }
}

export const rangedDistanceOf = (u) => ({ short: 5, medium: 8, long: 11 }[UNITS[u].range]) * 5;

export const ATTACKER = 1, DEFENDER = 2;

export class Combatants {
    constructor(units, towerType = null) { this.units = units; this.towerType = towerType; }
}

// Fight two combatants in place. Returns ATTACKER, DEFENDER or 0 (stalemate).
//
// Mirrors Combatants::fight: the air field resolves first, then the surface; at zero damage the
// defender spends first, otherwise whoever is "ahead" spends a unit to cancel the damage.
export function fight(A, D, onInfo) {
    if (A.towerType != null) D.units.subtract(SHIELD, 1e9);
    if (D.towerType != null) A.units.subtract(SHIELD, 1e9);

    let dmg = 0;
    let lastA = -1, lastD = -1;
    const flags = { emp: false, nuke: false, shell: false };
    let boundCheck = false;

    // Units not yet committed (the currently "in hand" unit is excluded).
    const unusedUnits = (c, last) => {
        const out = [];
        for (const [u, count] of c.units.counts()) {
            const n = count - (last === u && !isSingleUse(u) ? 1 : 0);
            if (n > 0) out.push([u, n]);
        }
        return out;
    };

    const fire = (unit, isAtt) => {
        if (flags[unit === EMP ? 'emp' : unit === NUKE ? 'nuke' : 'shell']) return;
        flags[unit === EMP ? 'emp' : unit === NUKE ? 'nuke' : 'shell'] = true;
        if (onInfo) onInfo({ type: unit === EMP ? 'emp' : unit === NUKE ? 'nuke' : 'shell', side: isAtt ? ATTACKER : DEFENDER });
    };

    // Commit `unit` for one side; returns the new "in hand" unit.
    const commit = (me, myLast, enemyLast, unit) => {
        boundCheck = true;
        const isAtt = me === A;
        if (unit >= 0 && isSingleUse(unit)) {
            fire(unit, isAtt);
            me.units.subtract(unit, 1);
        }
        if (myLast >= 0 && !isSingleUse(myLast)) {
            if (myLast === RULER && onInfo) {
                onInfo({ type: 'ruler', side: isAtt ? ATTACKER : DEFENDER, by: enemyLast });
            }
            me.units.subtract(myLast, 1);
        }
        return unit >= 0 ? unit : myLast;
    };

    const damageAgainst = (unit, uField, enemy, eField, prev) => {
        let d = damage(unit, uField, eField);
        if (isRanged(unit) && enemy.towerType != null) d = TOWER[enemy.towerType].rangedDamage(d);
        let fin = finiteDamage(d);
        const dir = enemy === A ? -1 : 1;
        if (prev * -dir > 1073741823) fin = Math.min(fin, 1000);
        return fin * dir;
    };

    for (const fld of [1, 0]) {
        // `killedNukes < 2` lets both sides keep spending through a nuclear exchange.
        let killedNukes = 0;
        const pick = (me, last, anyAir) => {
            const t = me.towerType;
            for (const [u, c] of unusedUnits(me, last)) {
                const overflow = t != null && c > me.units.capacity(u, t);
                const uf = field(u, overflow, t == null, anyAir);
                if (uf >= fld) return [u, uf];
            }
            return null;
        };
        const nextUnit = (me, last) => {
            const n = pick(me, last, false);
            if (!n) return null;
            return fld === 1 ? pick(me, last, true) : n;
        };

        for (let guard = 0; guard < 4000 && killedNukes < 2; guard++) {
            let na = null, nd = null;
            if (dmg < 0) na = nextUnit(A, lastA);
            else if (dmg > 0) nd = nextUnit(D, lastD);
            else {
                const a = nextUnit(A, lastA), d = nextUnit(D, lastD);
                if (d) nd = d; else na = a;
            }
            if (na) {
                if (na[0] === NUKE) killedNukes += 1; // count
                lastA = commit(A, lastA, lastD, na[0]);
                dmg += damageAgainst(na[0], na[1], D, fld, dmg);
            } else if (nd) {
                if (nd[0] === NUKE) killedNukes += 1; // count
                lastD = commit(D, lastD, lastA, nd[0]);
                dmg += damageAgainst(nd[0], nd[1], A, fld, dmg);
            } else break;
        }
    }

    // Spend one last unit so exactly one side ends up empty.
    const first = (c, last) => { const u = unusedUnits(c, last); return u.length ? u[0][0] : -1; };
    const na = first(A, lastA), nd = first(D, lastD);
    const order = nd >= 0 ? [ATTACKER, DEFENDER] : [DEFENDER, ATTACKER];
    for (const side of order) {
        if (side === ATTACKER && dmg <= 0 && na >= 0) {
            dmg += damageAgainst(na, 0, D, 0, dmg);
            lastA = commit(A, lastA, lastD, na);
        } else if (side === DEFENDER && dmg >= 0 && nd >= 0) {
            dmg += damageAgainst(nd, 0, A, 0, dmg);
            lastD = commit(D, lastD, lastA, nd);
        }
    }

    // A shot that the other side could not answer keeps landing: this is what makes a nuke
    // (or a hopeless last soldier) clear out everything it can reach.
    for (let guard = 0; guard < 64; guard++) {
        if (dmg > 0 && lastA >= 0 && !isSingleUse(lastA)) {
            const a = unusedUnits(A, lastA);
            if (a.length) {
                dmg += damageAgainst(a[0][0], 0, D, 0, dmg);
                lastA = commit(A, lastA, lastD, a[0][0]);
                continue;
            }
        }
        if (dmg < 0 && lastD >= 0 && !isSingleUse(lastD)) {
            const d = unusedUnits(D, lastD);
            if (d.length) {
                dmg += damageAgainst(d[0][0], 0, A, 0, dmg);
                lastD = commit(D, lastD, lastA, d[0][0]);
                continue;
            }
        }
        break;
    }

    if (A.units.isAlive() || (A.towerType != null && dmg >= 0)) return ATTACKER;
    if (D.units.isAlive() || (D.towerType != null && dmg <= 0)) return DEFENDER;
    return 0;
}

// ---- Forces ----

export const FORCE_FUEL = 150;
const RANK = { immobile: 0, slow: 1, normal: 2, fast: 3 };

export function forceSpeed(units) {
    const choppers = units.get(CHOPPER);
    if (choppers !== 0) {
        let weight = 0;
        for (const [u, c] of units.counts()) weight += (UNITS[u].weight || 0) * c;
        const maxWeight = choppers * 4;
        if (weight <= maxWeight) return 'fast';
        let slowWeight = 0;
        for (const [u, c] of units.counts()) {
            if (RANK[speed(u, null)] < RANK.normal) slowWeight += (UNITS[u].weight || 0) * c;
        }
        return slowWeight <= maxWeight ? 'normal' : 'slow';
    }
    let worst = 3;
    for (const [u] of units.counts()) worst = Math.min(worst, RANK[speed(u, null)]);
    return ['immobile', 'slow', 'normal', 'fast'][worst];
}

export const progressPerTick = (units) => ({ slow: 1, normal: 2, fast: 3 }[forceSpeed(units)] || 0);

export function progressRequired(src, dst) {
    return Math.min(255, Math.floor((distance(src, dst) * 180) / 5 / 2));
}

let nextForceId = 1;

export class Force {
    constructor(owner, units, path) {
        this.id = nextForceId++;
        this.owner = owner;               // player index, or null for zombies
        this.units = units;
        this.path = path.slice();         // forward order: source ... destination
        this.idx = 0;
        this.progress = 0;
        this.fuel = FORCE_FUEL;
        this.slow = 1;                    // multiplier applied to the first leg only
        this.parked = false;              // arrived (or halted): stop at the current destination
        this.reported = false;            // the tower has not yet handled this arrival
    }
    get source() { return this.path[Math.min(this.idx, this.path.length - 1)]; }
    get destination() { return this.path[Math.min(this.idx + 1, this.path.length - 1)]; }
    // Forces leaving the King's tower march at half the usual pace.
    get required() {
        const base = progressRequired(this.source, this.destination);
        return this.slow ? Math.min(255, base * this.slow) : base;
    }
    get isLast() { return this.idx >= this.path.length - 2; }
    // Where we would land next, whether or not we are already at the final destination.
    get nextDestination() { return this.path[Math.min(this.idx + 1, this.path.length - 1)]; }
    // Advance; returns true when it arrives at the current destination.
    // Advance one tick. Only the *final* leg counts as an arrival: while a force travels it is
    // also the live copy of its supply line, and the stops in between are checkpoints.
    tick() {
        // A parked force reports its arrival exactly once; the tower then decides what happens
        // (continuing along a supply line, or unloading into a friend).
        if (this.parked) {
            if (this.reported) return false;
            this.reported = true;
            return true;
        }
        this.progress += progressPerTick(this.units);
        if (this.progress < this.required) return false;
        this.progress = 0;
        this.idx += 1;
        this.slow = 1;                     // the penalty belongs to the departure
        if (!this.isLast) {
            if (this.units.isMany()) this.fuel -= 1;
            return false;
        }
        this.parked = true;                // arrived: stay put until the tower moves it on
        return true;
    }
    advance() {
        this.progress += progressPerTick(this.units);
        return this.progress >= this.required;
    }
    halt() { this.path = this.path.slice(0, this.idx + 2); }
    position(t = 0) {
        if (!this.source || !this.destination) return [0, 0];
        const a = integerPosition(this.source.x, this.source.y);
        const b = integerPosition(this.destination.x, this.destination.y);
        const f = Math.min(1, (this.progress + t * progressPerTick(this.units)) / Math.max(1, this.required));
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
}

export function makeForce(owner, units, path) { return new Force(owner, units, path); }
