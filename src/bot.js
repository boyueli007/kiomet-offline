// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A tower AI modelled on Kiomet's server/src/bot.rs: every update it looks at one of its
// towers, upgrades it if the shields are banked, and sends its mobile units at the most
// promising reachable target — the enemy it is currently fighting, or unclaimed ground.

import { UNITS, SHIELD, TOWER, meetsPrereqs, TOWERS, SOLDIER, TANK, CHOPPER } from './data.js';
import { neighbors } from './geom.js';

export function botUpdate(game, player) {
    if (!player.alive) return;
    const bot = player.botState;

    // Bots retire after a while, like Kiomet's, so the map makes room for humans.
    if (!bot.quitAt) bot.quitAt = game.time + 4 * 60 * (30 + Math.random() * 60);
    if (game.time > bot.quitAt) { game.killPlayer(player); return; }

    const mine = [...player.towers].map((k) => game.towers.get(k)).filter((t) => t && t.owner === player.id);
    if (!mine.length) return;

    // ---- what are we fighting? the nearest enemy touching our land
    let target = null, targetDist = Infinity, enemyTower = null;
    for (const t of mine) {
        for (const nb of nearTowers(game, t, 3)) {
            if (nb.owner == null || nb.owner === player.id) continue;
            if (game.haveAlliance(player.id, nb.owner)) continue;
            const d = distanceSq(t, nb);
            if (d < targetDist) { targetDist = d; target = nb.owner; enemyTower = nb; }
        }
    }

    // The king runs for safety when his tower is about to fall.
    const king = mine.find((t) => t.units.hasRuler());
    if (king && king.active && kingIsThreatened(game, player, king)) {
        evacuateKing(game, player, king);
        return;
    }

    // ---- upgrade a tower with plenty of shields
    const upgradable = mine.filter((t) => t.active && t.units.get(SHIELD) >=
        Math.floor(t.units.capacity(SHIELD, t.type) / (target != null ? 1 : 2)));
    if (upgradable.length && Math.random() < 0.6) {
        upgrade(game, player, upgradable[Math.floor(Math.random() * upgradable.length)]);
    }

    // ---- send a force. Never gamble with the king.
    const withUnits = mine.filter((t) => !t.units.hasRuler() && !t.forceUnits().isEmpty());
    if (!withUnits.length) return;
    const src = withUnits[Math.floor(Math.random() * withUnits.length)];

    const strength = src.forceUnits();
    // Kiomet's bot calls any force of 5+ ground damage "formidable"; below that it only
    // occasionally bothers, which is far too timid for an offline map of this size.
    const formidable = strength.forceGroundDamage() >= 2;
    if (!formidable && Math.random() > 0.25) return;
    const maxEdge = strength.maxEdgeDistance();

    const candidates = [];
    for (const dst of nearTowers(game, src, 8)) {
        if (dst === src) continue;
        if (maxEdge != null && distanceSq(src, dst) > (maxEdge + 1) ** 2 - 1) continue;
        if (dst.owner === player.id) {
            // Reinforce: only if it shortens the way to the enemy.
            if (!enemyTower) continue;
            if (distanceSq(enemyTower, dst) >= distanceSq(enemyTower, src)) continue;
            if (dst.units.get(SHIELD) < 5) continue;
        } else if (dst.owner == null) {
            // Unclaimed land is always worth taking.
        } else if (game.haveAlliance(player.id, dst.owner)) {
            continue;
        } else if (target != null && dst.owner !== target) {
            continue;                     // one theatre at a time
        } else if (!formidable) {
            continue;                     // a token force shouldn't poke a garrison
        }
        candidates.push(dst);
    }
    if (!candidates.length) return;

    const dst = candidates[Math.floor(Math.random() * candidates.length)];
    const path = game.findBestPath(src, dst, maxEdge, player.id);
    if (!path) return;
    if (src.generatesMobile() && dst.generatesMobile() && Math.random() < 0.25 &&
        game.setSupplyLine(player.id, src, path) == null) return;
    game.deploy(player.id, src, path);
}

// Towers within `radius` tower cells (the bubble radius is in world units: 5 per cell).
function nearTowers(game, src, radius) {
    const out = [];
    game.bubble(src.id, radius * 5, (id) => {
        const t = game.getTower(id);
        if (t) out.push(t);
    });
    return out;
}

function distanceSq(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function upgrade(game, player, t) {
    if (!t.active) return;
    const opts = TOWER[t.type].upgrades.filter((u) => meetsPrereqs(u, player.towerCounts));
    if (!opts.length) return;
    game.upgradeTower(player.id, t, opts[Math.floor(Math.random() * opts.length)]);
}

function kingIsThreatened(game, player, king) {
    const armed = king.inbound.filter((f) => f.owner !== player.id &&
        game.relationship(player.id, f.owner) === 'enemy');
    if (!armed.length) return false;
    return armed.reduce((n, f) => n + f.units.forceGroundDamage(), 0) > king.units.get(SHIELD);
}

function evacuateKing(game, player, king) {
    let best = null;
    for (const nb of neighbors(king.x, king.y)) {
        const t = game.getTower(nb);
        if (!t || t.owner !== player.id || !t.active) continue;
        if (!best || t.units.get(SHIELD) > best.units.get(SHIELD)) best = t;
    }
    if (!best) return;
    game.deploy(player.id, king, [king.id, best.id]);
}
