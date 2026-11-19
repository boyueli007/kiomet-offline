// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The world: tower tick loop, forces, upgrades, spawning, scoring.
// Ported from Kiomet common/src/chunk.rs, common/src/chunk/event.rs,
// common/src/chunk/maintenance.rs, server/src/world.rs, server/src/service.rs.

import {
    TICK_HZ, UNITS, SHIELD, FIGHTER, SOLDIER, RULER, TOWER, SPAWNABLE, EMP_TICKS,
    isMobile, meetsPrereqs, isSingleUse, CHOPPER, TANK, BOMBER, RULER_MARCH_MULT,
    MORALE_GEN_DIVISOR,
} from './data.js';
import {
    WORLD_SIZE, CENTER, neighbors, distanceSquared, connectivity, isSpawnablePosition,
    towerTypeAt, buildConnectivity,
} from './geom.js';
import {
    Units, Force, Combatants, fight, ATTACKER, DEFENDER, forceSpeed, progressPerTick,
    progressRequired,
} from './rules.js';
import { TowerIndex, indexKey } from './towerindex.js';

const key = (x, y) => y * WORLD_SIZE + x;
export const kOf = (id) => key(id.x, id.y);

export class Tower {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.owner = null;
        this.units = new Units();
        this.delay = 0;
        this.inbound = [];
        this.outbound = [];
        this.supply = null;
        this.flash = 0;
        this.hit = 0;
    }
    get active() { return this.delay === 0; }
    get id() { return { x: this.x, y: this.y }; }
    get canDestroy() { return this.inbound.length === 0 && this.owner === null; }
    forceUnits() { return this.units.forceUnits(this.type); }
    takeForceUnits() {
        const f = this.forceUnits();
        for (const [u, c] of f.counts()) this.units.subtract(u, c);
        return f;
    }
    unitGeneration(u) {
        if (u !== SHIELD && this.units.hasRuler()) return null;
        return TOWER[this.type].genPeriod(u);
    }
    generatesMobile() {
        return UNITS.some((_, u) => isMobile(u, this.type) && this.unitGeneration(u) != null);
    }
    setOwner(owner) {
        if (this.owner === owner) return;
        if (this.owner !== null) this.supply = null;
        this.owner = owner;
    }
}

export class Player {
    constructor(id, name, opts = {}) {
        this.id = id;
        this.name = name;
        this.alive = false;
        this.bot = !!opts.bot;
        this.allies = new Set();
        this.newAllies = new Set();
        this.towers = new Set();
        this.score = 0;
        this.towerCounts = {};
        this.rulerKey = null;
        this.deathReason = null;
        this.spawnCooldown = 0;
        this.rank = opts.rank || 0;
        this.botState = {
            ambition: 8 + Math.floor(Math.random() * 5),
            war: null,
            quitAt: 0,
        };
    }
}

export class Game {
    constructor(opts = {}) {
        this.time = 0;
        this.towers = new TowerIndex();
        this.players = [];
        this.forces = [];
        this.events = [];
        this.shrink = opts.shrink !== false;
        this.noShrink = opts.shrink === false;
        this.onEvent = opts.onEvent || null;
        this.botUpdate = opts.botUpdate || null;
        this.hostileAt = TICK_HZ * 60 * 8;
        buildConnectivity();
    }

    tower(x, y) { return this.towers.get(key(x, y)); }
    getTower(id) { return this.towers.get(key(id.x, id.y)); }
    ensureTower(id) {
        let t = this.getTower(id);
        if (!t) {
            t = new Tower(id.x, id.y, towerTypeAt(id.x, id.y));
            this.towers.set(key(id.x, id.y), t);
        }
        return t;
    }

    info(ev) {
        this.events.push(ev);
        if (this.onEvent) this.onEvent(ev);
        if (this.events.length > 600) this.events.splice(0, 300);
    }

    // ---------------- spawning ----------------
    findSpawn() {
        let searchRadius = Math.floor(Math.sqrt(100 / Math.PI));
        for (let i = 0; i < 200000; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * searchRadius;
            const x = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(CENTER.x + Math.cos(a) * r + 0.5)));
            const y = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(CENTER.y + Math.sin(a) * r + 0.5)));
            const id = { x, y };
            if (this.isSpawnable(id)) return id;
            if (i % 8 === 0) searchRadius += 1;
        }
        return null;
    }

    isSpawnable(id) {
        return isSpawnablePosition(id) && this.isGoodSpawn(id) && this.isSafeSpawn(id);
    }

    typeAtOrGenerated(id) {
        const t = this.getTower(id);
        if (t) return t.owner !== null ? null : t.type;
        return towerTypeAt(id.x, id.y);
    }

    isGoodSpawn(id) {
        const tt = this.typeAtOrGenerated(id);
        if (!tt) return false;
        let n = 0, spawnableN = 0;
        for (const nb of neighbors(id.x, id.y)) {
            const nt = this.typeAtOrGenerated(nb);
            if (!nt) return false;
            n += 1;
            if (SPAWNABLE.some((s) => s.name === nt)) spawnableN += 1;
        }
        return (SPAWNABLE.some((s) => s.name === tt) && n >= 3) || spawnableN >= 2;
    }

    isSafeSpawn(id) {
        const seen = new Set([key(id.x, id.y)]);
        let frontier = [id];
        for (let d = 0; d < 4; d++) {
            const next = [];
            for (const t of frontier) {
                for (const nb of neighbors(t.x, t.y)) {
                    const k = key(nb.x, nb.y);
                    if (seen.has(k)) continue;
                    seen.add(k);
                    const tw = this.towers.get(k);
                    if (tw && (tw.owner !== null || tw.inbound.length > 0)) return false;
                    next.push(nb);
                }
            }
            frontier = next;
        }
        return seen.size >= 12;
    }

    bubble(origin, radius, fn) {
        const seen = new Set([key(origin.x, origin.y)]);
        const queue = [origin];
        const r2 = radius * radius;
        fn(origin);
        for (let i = 0; i < queue.length; i++) {
            const t = queue[i];
            for (const nb of neighbors(t.x, t.y)) {
                if (distanceSquared(nb, origin) > r2) continue;
                const k = key(nb.x, nb.y);
                if (seen.has(k)) continue;
                seen.add(k);
                queue.push(nb);
                fn(nb);
            }
        }
    }

    // Generate towers from `id` along the connectivity path towards the world center.
    traverse(id, out) {
        let cur = id;
        for (let i = 0; i < 4000; i++) {
            if (this.getTower(cur)) return;
            const k = key(cur.x, cur.y);
            if (out.has(k)) return;
            out.set(k, cur);
            const parent = connectivity(cur);
            if (!parent) return;
            if (parent.x === cur.x && parent.y === cur.y) return;
            cur = parent;
        }
    }

    spawnPlayer(player) {
        const id = this.findSpawn();
        if (!id) return false;
        const radius = player.bot ? 35 : 50;
        const toGen = new Map();
        this.bubble(id, radius, (t) => this.traverse(t, toGen));
        for (const t of toGen.values()) this.ensureTower(t);

        const t = this.ensureTower(id);
        t.units = new Units();
        t.supply = null;
        t.delay = 0;
        t.setOwner(player.id);
        player.alive = true;
        player.deathReason = null;
        player.score = 0;
        player.towers = new Set([key(id.x, id.y)]);
        this.info({ type: 'gained', tower: id, player: player.id });

        t.units.add(RULER, 1, t.type, true);
        t.units.add(SHIELD, 255, t.type, true);

        const rank = player.rank || 0;
        for (const unit of [SOLDIER, FIGHTER]) {
            const soldiers = new Units();
            soldiers.add(unit, unit === FIGHTER ? 2 : rank >= 2 ? 8 : 4);
            soldiers.add(SHIELD, 15);
            for (const nb of neighbors(id.x, id.y)) {
                this.sendForce(t, new Force(player.id, soldiers.clone(), [id, nb]));
            }
            if (rank < 5) break;
        }
        for (const nb of neighbors(id.x, id.y)) {
            const n = this.getTower(nb);
            if (n && n.owner === null) n.units = new Units();
        }
        return true;
    }

    // ---------------- actions ----------------
    sendForce(from, force) {
        force.host = null;
        // The King's high morale: forces leaving his tower (or a neighbour's) march slower.
        if (from && from.owner != null && this.inMorale(from, from.owner)) {
            force.slow = RULER_MARCH_MULT;
        }
        this.forces.push(force);
        from.outbound.push(force);
        const dst = this.ensureTower(force.destination);
        if (dst) { dst.inbound.push(force); force.host = dst; }
        return force;
    }

    deploy(playerId, fromId, path) {
        const t = this.getTower(fromId);
        if (!t || t.owner !== playerId) return 'source not owned';
        const strength = t.forceUnits();
        if (strength.isEmpty()) return 'empty force';
        const err = this.validatePath(path, fromId, strength.maxEdgeDistance());
        if (err) return err;
        this.sendForce(t, new Force(playerId, t.takeForceUnits(), this.canonicalPath(path)));
        return null;
    }

    // Paths travel through the UI as bare {x,y}; everywhere inside the engine they must be the
    // very Tower objects the map holds (its roads mutate them).
    canonicalPath(path) {
        return path.map((p) => this.getTower(p) || p);
    }

    validatePath(path, fromId, maxEdge) {
        if (!path || path.length < 2) return 'path too short';
        if (maxEdge != null && path.length !== 2) return 'path too long';
        if (maxEdge == null && path.length > 16) return 'path too long';
        if (path[0].x !== fromId.x || path[0].y !== fromId.y) return 'source mismatch';
        for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1], next = path[i];
            if (prev.x === next.x && prev.y === next.y) return 'duplicate tower';
            if (maxEdge != null) {
                if (distanceSquared(prev, next) > (maxEdge + 1) ** 2 - 1) return 'edge too long';
            } else if (!neighbors(prev.x, prev.y).some((n) => n.x === next.x && n.y === next.y)) {
                return 'not neighbor';
            }
            if (!this.getTower(next)) return 'not generated';
        }
        return null;
    }

    setSupplyLine(playerId, fromId, path) {
        const t = this.getTower(fromId);
        if (!t || t.owner !== playerId) return 'source not owned';
        if (!t.generatesMobile()) return 'invalid supply line';
        if (path) {
            const err = this.validatePath(path, fromId, TOWER[t.type].rangedDist);
            if (err) return err;
            if (t.supply && samePath(t.supply, path)) path = null;
        }
        t.supply = path ? this.canonicalPath(path) : null;
        return null;
    }

    upgradeTower(playerId, id, type) {
        const t = this.getTower(id);
        if (!t) return 'no tower';
        if (t.owner !== playerId) return 'not owned';
        if (!t.active) return 'upgrade pending';
        const next = TOWER[type];
        if (!next) return 'bad type';
        const cur = TOWER[t.type];
        if (cur.upgrades.includes(type)) {
            if (!meetsPrereqs(type, this.players[playerId].towerCounts)) return 'missing prerequisite';
        } else if (cur.basis !== type) return 'invalid upgrade path';

        t.type = type;
        t.delay = Math.max(1, Math.round(next.delay * TICK_HZ));
        t.units.reconcile(type, t.owner !== null);
        if (t.supply && !t.generatesMobile()) t.supply = null;
        this.info({ type: 'upgrade', tower: id, player: playerId, towerType: type });
        return null;
    }

    towerType(t) { return TOWER[t.type]; }

    breakAlliance(a, b) {
        const pa = this.players[a], pb = this.players[b];
        if (pa) pa.allies.delete(b);
        if (pb) pb.allies.delete(a);
        this.info({ type: 'alliance', a, b, on: false });
    }

    // Accept/decline an alliance request. `request` is one-sided until both agree.
    requestAlliance(a, b) {
        const pa = this.players[a], pb = this.players[b];
        if (!pa || !pb || a === b) return 'bad player';
        if (pa.allies.has(b) && pb.allies.has(a)) { this.breakAlliance(a, b); return null; }
        const mutual = pa.allies.has(b) || pb.allies.has(a);
        pa.allies.add(b);
        if (mutual) {
            pb.allies.add(a);
            for (const x of [a, b]) this.players[x].newAllies.add(x === a ? b : a);
            this.info({ type: 'alliance', a, b, on: true });
        } else {
            this.info({ type: 'allianceRequest', from: a, to: b });
        }
        return null;
    }

    // A* over roads. Prefers own territory, avoids enemy and zombie towers.
    findBestPath(src, dst, maxEdge, playerId) {
        if (maxEdge != null) {
            const d2 = (src.x - dst.x) ** 2 + (src.y - dst.y) ** 2;
            if (d2 <= (maxEdge + 1) ** 2 - 1) return [src, dst];
            return null;
        }
        const dstTower = this.getTower(dst);
        const dstOwner = dstTower ? dstTower.owner : null;
        const keyOf = (id) => id.y * WORLD_SIZE + id.x;
        const start = keyOf(src), goal = keyOf(dst);
        const gScore = new Map([[start, 0]]);
        const cameFrom = new Map();
        const open = [[0, start]];
        const idOf = new Map([[start, src], [goal, dst]]);
        const heur = (id) => Math.floor(Math.sqrt((id.x - dst.x) ** 2 + (id.y - dst.y) ** 2) * 256);
        let budget = 3000;
        while (open.length && budget-- > 0) {
            let bi = 0;
            for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
            const [f, cur] = open.splice(bi, 1)[0];
            if (cur === goal) break;
            const curId = idOf.get(cur);
            for (const nb of neighbors(curId.x, curId.y)) {
                const nk = keyOf(nb);
                const t = this.towers.get(nk);
                if (!t) continue;
                const allyPass = t.owner !== null && t.owner !== dstOwner && this.haveAlliance(playerId, t.owner);
                if (allyPass) continue;
                const cost = Math.floor(Math.sqrt(distanceSquared(curId, nb)) * 256);
                const tentative = gScore.get(cur) + cost;
                if (tentative < (gScore.get(nk) ?? Infinity)) {
                    gScore.set(nk, tentative);
                    cameFrom.set(nk, cur);
                    idOf.set(nk, nb);
                    let h = heur(nb);
                    if (t.owner === playerId) h += 2 * 256;
                    else if (t.owner !== null || !t.units.isEmpty()) h += 32 * 256;
                    open.push([tentative + h, nk]);
                }
            }
        }
        if (!cameFrom.has(goal)) return null;
        const path = [dst];
        let cur = goal;
        while (cur !== start) {
            cur = cameFrom.get(cur);
            const id = idOf.get(cur);
            if (!id) return null;
            path.push(id);
        }
        path.reverse();
        return path.length >= 2 ? path : null;
    }

    // ---------------- tick ----------------
    tick() {
        this.time += 1;
        const tick = this.time;

        for (const p of this.players) p.newAllies.clear();

        // Halt forces whose remaining path crosses a brand new ally or a destroyed tower.
        for (const t of this.towers.values()) {
            if (t.inbound.length) {
                for (const f of t.inbound) {
                    if (f.owner === null) continue;
                    if (!this.pathHalted(f)) continue;
                    // Halt without rewriting the path object that every holder already shares:
                    // the force simply stops at its current destination (`Force.halted()`).
                    f.parked = true;
                }
            }
            // NOTE: supply lines are deliberately *not* pruned here. A force leaving a tower is
            // both a traveller and the supply line's live copy, so truncating the shared path
            // would strand it mid-route. They are cleared on capture and on upgrade instead.
        }

        for (const t of this.towers.values()) this.tickTower(t, tick);

        // Nothing should be able to orphan a force; if something does, retire it instead of
        // letting it drift around the map forever.
        if (tick % 8 === 0 && this.forces.length > 32) {
            const wanted = new Set();
            for (const t of this.towers.values()) {
                for (const f of t.inbound) wanted.add(f);
                for (const f of t.outbound) wanted.add(f);
            }
            for (const f of this.forces.slice()) if (!wanted.has(f)) this.removeForce(f);
        }

        for (const p of this.players) if (p.alive) this.recomputePlayer(p);
        if (tick % 2 === 0) {
            for (const p of this.players) if (p.alive && p.bot && this.botUpdate) this.botUpdate(this, p);
        }
        if (tick % (TICK_HZ * 2) === 0) this.checkDeaths();
        if (tick % (TICK_HZ * 10) === 0 && this.shrink) this.shrinkWorld();
        if (this.debugBombers && tick % (TICK_HZ * 60 * 4) === 0) this.hostiles();
    }

    pathHalted(f, start = 2) {
        if (!f.path) return true;
        for (let i = Math.max(0, f.idx + start); i < f.path.length; i++) {
            if (!f.path[i]) return true;
            const t = this.getTower(f.path[i]);
            if (!t) return true;
            if (f.owner != null && t.owner != null && t.owner !== f.owner &&
                this.haveAlliance(f.owner, t.owner)) return true;
        }
        return false;
    }

    haveAlliance(a, b) {
        if (a === b || a == null || b == null) return false;
        const pa = this.players[a], pb = this.players[b];
        return !!pa && !!pb && pa.allies.has(b) && pb.allies.has(a);
    }

    relationship(a, b) {
        if (a === b) return 'comrade';
        if (this.haveAlliance(a, b)) return 'ally';
        return 'enemy';
    }

    tickTower(t, tick) {
        const owner = t.owner;
        const period = owner !== null ? 30 : 10;

        let deploy = false;
        if (tick % (period * TICK_HZ) === 0) {
            const diminished = this.diminish(t);
            deploy = diminished !== 0 && t.active;
        }

        if (t.delay > 0) {
            t.delay -= 1;
        } else if (owner !== null) {
            const tt = TOWER[t.type];
            // High morale: the King's tower and its eight neighbours produce twice as fast,
            // which is the same as making two every period they would normally make one.
            const morale = this.inMorale(t, owner) ? MORALE_GEN_DIVISOR : 1;
            for (const name in tt.gen) {
                const u = tt.genUnitId(name);
                const due = tick % (tt.gen[name] * TICK_HZ) === 0;
                for (let rep = 0; due && rep < morale; rep++) {
                    {
                        const added = t.units.add(u, 2, t.type, false);
                        t.units.subtract(u, Math.max(0, added - 1));
                        if (isMobile(u, t.type) && added < 2) deploy = true;
                    }
                }
            }
        } else if (TOWER[t.type].down && tick % (60 * TICK_HZ) === 0) {
            t.type = TOWER[t.type].down;
            t.units.reconcile(t.type, false);
        }

        if (deploy && !t.units.hasRuler() && t.supply && t.owner !== null) {
            const fu = t.forceUnits();
            if (!fu.isEmpty()) {
                const med = fu.maxEdgeDistance();
                if (med >= TOWER[t.type].rangedDist) {
                    this.sendForce(t, new Force(t.owner, t.takeForceUnits(),
                        t.supply.map((p) => ({ x: p.x, y: p.y }))));
                }
            }
        }

        if (t.inbound.length && t.outbound.length) this.collideForces(t);

        if (t.inbound.length) {
            // Iterate a snapshot: arriving forces can re-enter `t.inbound` (e.g. the tower below
            // loses its last defender to a king and the king starts living inside it).
            const finished = [], stepped = [];
            for (const f of t.inbound.slice()) {
                if (f.parked) { finished.push(f); continue; } // arrived (or parked by a halt)
                if (!f.tick()) continue;
                if (f.isLast) { finished.push(f); continue; } // final leg completed
                stepped.push(f);
            }
            // Intermediate checkpoints: keep walking the same road towards the real target.
            for (const f of stepped) {
                f.parked = false;
                f.reported = false;
                const at = t.inbound.indexOf(f);
                if (at >= 0) t.inbound.splice(at, 1);
                const dst = this.ensureTower(f.nextDestination);
                if (dst && !dst.inbound.includes(f)) { dst.inbound.push(f); f.host = dst; }
            }
            for (const f of finished) {
                const at = t.inbound.indexOf(f);
                if (at >= 0) t.inbound.splice(at, 1);
                this.arrive(t, f);
            }
        }

        if (t.outbound.length) {
            t.outbound = t.outbound.filter((f) => {
                // A halted force sits at its destination until it expires.
                const req = Math.max(1, f.required);
                const step = f.path.length === 2 ? 1 : progressPerTick(f.units);
                f.progress = Math.min(f.progress + step, req);
                f.host = null;             // the shadow is done; a force is retired only on arrival
                return f.progress < req;
            });
        }
        if (t.flash > 0) t.flash -= 1;
    }

    // True when the tower sits at or next to its owner's King (Kiomet's "high morale").
    inMorale(t, owner) {
        const p = this.players[owner];
        if (!p || p.rulerKey == null) return false;
        const rk = p.rulerKey;
        const king = this.towers.get(rk);
        if (!king || king.owner !== owner) return false;
        return Math.abs(t.x - (rk % WORLD_SIZE)) <= 1 && Math.abs(t.y - Math.floor(rk / WORLD_SIZE)) <= 1;
    }

    diminish(t) {
        let units = 0;
        for (let u = 0; u < UNITS.length; u++) {
            if (t.owner === null || t.units.get(u) > t.units.capacity(u, t.type)) {
                const sub = t.units.subtract(u, 1);
                if (isMobile(u, t.type)) units += sub;
            }
        }
        return units;
    }

    removeForce(f) {
        f.host = null;
        const i = this.forces.indexOf(f);
        if (i >= 0) this.forces.splice(i, 1);
    }

    collideForces(t) {
        for (const inb of t.inbound.slice()) {
            if (!t.inbound.includes(inb)) continue;
            for (const out of t.outbound.slice()) {
                if (out.destination.x !== inb.source.x || out.destination.y !== inb.source.y) continue;
                if (out.owner === inb.owner) continue;
                if (this.relationship(inb.owner, out.owner) !== 'enemy') continue;

                const reqA = progressRequired(inb.source, inb.destination);
                const reqB = progressRequired(out.source, out.destination);
                const a0 = (reqA - Math.min(reqA, inb.progress + progressPerTick(inb.units))) * reqB;
                const a1 = (reqA - inb.progress) * reqB;
                const b0 = out.progress * reqA;
                const b1 = Math.min(255, out.progress + progressPerTick(out.units)) * reqA;
                if (Math.max(a0, b0) > Math.min(a1, b1)) continue;

                const win = fight(new Combatants(inb.units), new Combatants(out.units),
                    (e) => this.info({ ...e, tower: inb.source }));
                if (win === DEFENDER) {
                    const i = t.inbound.indexOf(inb);
                    if (i >= 0) t.inbound.splice(i, 1);
                    this.removeForce(inb);
                    break;
                } else if (win === ATTACKER) {
                    const i = t.outbound.indexOf(out);
                    if (i >= 0) t.outbound.splice(i, 1);
                    this.removeForce(out);
                }
            }
        }
    }

    arrive(t, f) {
        f.host = null;                    // it is no longer on its way anywhere
        const tp = t.owner;
        const id = { x: t.x, y: t.y };

        if (tp !== null || !t.units.isEmpty()) {
            const fp = f.owner;
            const rel = this.relationship(tp, fp);
            const unfriendly = rel === 'enemy' || (rel === 'ally' && f.units.hasRuler());
            if (unfriendly) {
                let towerEmped = false;
                const winner = fight(new Combatants(f.units), new Combatants(t.units, t.type), (e) => {
                    if (e.type === 'emp' && e.side === ATTACKER) towerEmped = true;
                    this.info({ ...e, tower: id });
                });
                if (towerEmped) t.delay = Math.max(t.delay, EMP_TICKS);
                t.hit = 2;
                if (winner !== ATTACKER && fp !== null) this.info({ type: 'lostForce', player: fp, tower: id });
                if (winner !== DEFENDER) {
                    if (tp !== null) this.info({ type: 'lostTower', tower: id, player: tp });
                    const newOwner = (winner === ATTACKER && fp !== null) ? fp : null;
                    if (newOwner !== null) this.info({ type: 'gained', tower: id, player: newOwner });
                    if (tp !== null || newOwner !== null) t.setOwner(newOwner);
                    if (t.owner === null) {
                        while (TOWER[t.type].down) t.type = TOWER[t.type].down;
                        t.delay = 0;
                    }
                    t.flash = 3;
                }
            }
        } else if (f.owner !== null && f.units.isAlive()) {
            this.info({ type: 'gained', tower: id, player: f.owner });
            t.setOwner(f.owner);
            t.units.reconcile(t.type, t.owner !== null);
        }

        const rel = this.relationship(f.owner, t.owner);
        if (f.units.isEmpty()) {
            this.removeForce(f);
        } else if (f.fuel === 0) {
            if (f.owner !== null) this.info({ type: 'lostForce', player: f.owner, tower: id });
            this.removeForce(f);
        } else if (rel === 'comrade' && this.tryMoveOn(f, t)) {
            // keeps going along its own path
        } else if (rel === 'ally' && !f.units.hasRuler() && this.tryMoveOn(f, t, true)) {
            // handed off to the ally's supply line
        } else if (rel === 'comrade' || (rel === 'ally' && !f.units.hasRuler())) {
            t.units.addUnitsToTower(f.units, t.type, t.owner !== null);
            this.removeForce(f);
        } else if (f.units.get(RULER) > 0) {
            if (f.owner !== null) this.info({ type: 'ruler', player: f.owner, side: ATTACKER, tower: id });
            this.removeForce(f);
        } else {
            this.removeForce(f);
        }
    }

    tryMoveOn(f, t, fromAlly = false) {
        if (!fromAlly && !f.isLast) {
            f.progress = 0;
            if (f.units.isMany()) f.fuel -= 1;
            return true;
        }
        if (!t.supply || TOWER[t.type].rangedDist != null || !f.units.isMany()) return false;
        if (t.type === 'Projector') {
            const maxShield = TOWER.Projector.rawCap(SHIELD);
            const maxTransfer = Math.max(0, maxShield - f.units.get(SHIELD));
            if (maxTransfer > 0) f.units.add(SHIELD, t.units.subtract(SHIELD, maxTransfer));
        }
        if (f.units.get(CHOPPER)) {
            const initial = forceSpeed(f.units);
            const order = { immobile: 0, slow: 1, normal: 2, fast: 3 };
            for (const transfer of [SOLDIER, TANK]) {
                if (order.normal >= order[initial]) break;
                for (;;) {
                    if (t.units.get(transfer) === 0) break;
                    if (f.units.add(transfer, 1) === 0) break;
                    if (order[forceSpeed(f.units)] < order[initial]) { f.units.subtract(transfer, 1); break; }
                    t.units.subtract(transfer, 1);
                }
            }
        }
        f.path = t.supply.map((p) => this.getTower(p) || this.ensureTower(p));
        f.idx = 0;
        f.progress = 0;
        if (f.units.isMany()) f.fuel -= 1;
        const dst = this.ensureTower(f.destination);
        if (dst) { dst.inbound.push(f); f.host = dst; }
        return true;
    }

    // ---------------- bookkeeping ----------------
    recomputePlayer(p) {
        let score = 0;
        const counts = {};
        p.rulerKey = null;
        // Rebuild the holdings from the map so a tower can never be owned by `p` without
        // being in their set (capture, upgrade and death all mutate the map directly).
        const next = new Set();
        for (const [k, t] of this.towers) {
            if (t.owner !== p.id) continue;
            next.add(k);
            if (t.units.hasRuler()) p.rulerKey = k;
            if (!t.active) continue;
            score += TOWER[t.type].score;
            counts[t.type] = (counts[t.type] || 0) + 1;
        }
        p.towers = next;
        p.score = score;
        p.towerCounts = counts;
    }

    checkDeaths() {
        for (const p of this.players) {
            if (!p.alive) continue;
            let rulerSeen = false;
            for (const k of p.towers) {
                const t = this.towers.get(k);
                if (!t) continue;
                if (t.owner !== p.id) continue;
                if (t.units.hasRuler()) rulerSeen = true;
                for (const f of t.inbound) if (f.owner === p.id && f.units.hasRuler()) rulerSeen = true;
            }
            if (!rulerSeen) this.killPlayer(p);
        }
    }

    killPlayer(p) {
        if (!p.alive) return;
        p.alive = false;
        p.allies.clear();
        this.info({ type: 'died', player: p.id });
        for (const t of this.towers.values()) {
            if (t.owner === p.id) {
                t.units.subtract(RULER, 255);
                t.units.subtract(SHIELD, 255);
                t.setOwner(null);
                this.info({ type: 'lostTower', tower: t.id, player: p.id });
            }
            for (const list of [t.inbound, t.outbound]) {
                for (const f of list.slice()) {
                    if (f.owner === p.id) {
                        const i = list.indexOf(f);
                        if (i >= 0) list.splice(i, 1);
                        this.removeForce(f);
                    }
                }
            }
        }
        for (const q of this.players) q.allies.delete(p.id);
        p.towers.clear();
    }

    // Unclaimed towers slowly vanish, and with them the map nobody is using.
    shrinkWorld() {
        if (this.noShrink) return;
        const locked = new Set();
        for (const [k, t] of this.towers) {
            if (t.canDestroy) continue;
            locked.add(k);
            let cur = t.id;
            for (let i = 0; i < 400; i++) {
                const p = connectivity(cur);
                if (!p) break;
                const pk = key(p.x, p.y);
                if (locked.has(pk)) break;
                locked.add(pk);
                cur = p;
            }
            if (t.units.hasRuler()) {
                this.bubble(t.id, 12, (id) => locked.add(key(id.x, id.y)));
            }
        }
        const remove = [];
        let count = 0;
        for (const [k, t] of this.towers) {
            count += 1;
            if (!locked.has(k) && t.canDestroy) remove.push(k);
        }
        // Never let the visible map get smaller than a reasonable play area.
        if (count - remove.length < Math.max(600, this.players.length * 150)) return;
        for (const k of remove) this.towers.delete(k);
    }

    // Over budget: two bombers from the world centre, exactly like Kiomet's summoned debug
    // players, kept behind an explicit opt-in so normal games stay untouched.
    hostiles() {
        if (!this.debugBombers || !this.towers.size) return;
        const keys = Array.from(this.towers.keys());
        this.ensureTower(CENTER);
        for (let i = 0; i < 2; i++) {
            const t = this.towers.get(keys[Math.floor(Math.random() * keys.length)]);
            if (!t || t.owner !== null) continue;
            const u = new Units();
            u.add(BOMBER, 5);
            const from = connectivity(t.id) || CENTER;
            this.sendForce(this.getTower(CENTER), new Force(null, u, [from, t.id]));
        }
    }
}

export function samePath(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
    return true;
}
