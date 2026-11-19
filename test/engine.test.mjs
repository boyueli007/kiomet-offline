// Headless checks of the engine against the reference implementation's invariants.
import { test } from 'node:test';
import assert from 'node:assert';
import {
    TOWERS, TOWER, UNITS, SHIELD, SOLDIER, TANK, NUKE, FIGHTER, RULER, CHOPPER,
    TICK_HZ, SPAWNABLE, meetsPrereqs, RULER_SHIELD_BOOST, BOMBER,
} from '../src/data.js';
import { Units, fight, Combatants, ATTACKER, forceSpeed, progressRequired } from '../src/rules.js';
import { Game, Player } from '../src/world.js';
import { neighbors, towerTypeAt, buildConnectivity, distance } from '../src/geom.js';

const S = (n) => UNITS.findIndex((u) => u.name === n);

test('tower table matches the reference counts', () => {
    assert.equal(TOWERS.length, 27);
    assert.equal(SPAWNABLE.length, 8);
});

test('downgrade chain bottoms out at a spawnable tower', () => {
    for (const t of TOWERS) {
        assert.ok(SPAWNABLE.some((s) => s.name === t.basis), t.name);
        assert.ok(t.level >= 0);
    }
    assert.equal(TOWER.Satellite.basis, 'Radar');
    assert.equal(TOWER.City.basis, 'Village');
    assert.equal(TOWER.Silo.basis, 'Cliff'); // Quarry -> Cliff
    assert.equal(TOWER.Headquarters.basis, 'Village');
    assert.equal(TOWER.Satellite.basis, 'Radar');
    assert.equal(TOWER.Airfield.basis, 'Runway');
    assert.equal(TOWER.Helipad.basis, 'Runway'); // Airfield -> Runway
    assert.equal(TOWER.Artillery.basis, 'Cliff'); // Bunker -> Cliff
});

test('prerequisites are literally the listed towers', () => {
    assert.deepEqual(TOWER.Headquarters.prereqs, [['Radar', 1]]);
    assert.deepEqual(TOWER.Bunker.prereqs, [['Headquarters', 1], ['Ews', 1]]);
    assert.ok(meetsPrereqs('City', { Quarry: 2, Reactor: 1, Town: 3 }));
    assert.ok(!meetsPrereqs('City', { Quarry: 2, Reactor: 1, Town: 2 }));
});

test('units container: singles evict many, overflow needs permission', () => {
    const u = new Units();
    assert.equal(u.add(SOLDIER, 3, 'Artillery', false), 0);
    assert.equal(u.add(SOLDIER, 3, 'Artillery', true), 3);
    assert.equal(u.add(S('Shell'), 2, 'Artillery', false), 2);
    assert.equal(u.get(SOLDIER), 0);
    assert.equal(u.add(TANK, 5), 0, 'shells block tanks');
});

test('king evicts units and cannot be stacked', () => {
    const u = new Units();
    u.add(SOLDIER, 5);
    assert.equal(u.add(RULER, 1), 1);
    assert.equal(u.get(SOLDIER), 0);
    assert.ok(u.hasRuler());
});

test('combat: shields absorb before anything else', () => {
    const force = new Units(); force.add(SOLDIER, 10);
    const tower = new Units(); tower.add(SHIELD, 3); tower.add(SOLDIER, 1);
    fight(new Combatants(force), new Combatants(tower, 'Barracks'));
    assert.equal(tower.get(SHIELD), 0);
});

test('combat: a nuke guts shields and heavy stacks', () => {
    // 20 shields vs 20 soldiers: the shields hold.
    const plain = new Units(); plain.add(SOLDIER, 20);
    const wall = new Units(); wall.add(SHIELD, 20);
    fight(new Combatants(plain), new Combatants(wall, 'Mine'));
    assert.ok(wall.get(SHIELD) > 0, '20 soldiers cannot chew 20 shields in one exchange');

    // The same 20 shields plus a nuke: the shields are gone.
    const nuked = new Units(); nuked.add(NUKE, 1);
    const wall2 = new Units(); wall2.add(SHIELD, 20);
    fight(new Combatants(nuked), new Combatants(wall2, 'Mine'));
    assert.equal(nuked.get(NUKE), 0, 'the nuke is spent');
    assert.ok(wall2.get(SHIELD) <= 1, 'the blast clears the wall');
});

test('combat: bunker shrugs off two thirds of shell damage', () => {
    assert.equal(TOWER.Bunker.rangedDamage(3), 1);
    assert.equal(TOWER.Headquarters.rangedDamage(3), 2);
    assert.equal(TOWER.Mine.rangedDamage(3), 3);
});

test('combat: shields alone never capture', () => {
    const force = new Units(); force.add(SHIELD, 50);
    const tower = new Units(); tower.add(SOLDIER, 2);
    const win = fight(new Combatants(force), new Combatants(tower, 'Village'));
    assert.notEqual(win, ATTACKER);
});

test('force speed follows the slowest unit unless choppers carry it', () => {
    const a = new Units(); a.add(SOLDIER, 4); assert.equal(forceSpeed(a), 'normal');
    const b = new Units(); b.add(TANK, 1); assert.equal(forceSpeed(b), 'slow');
    const c = new Units(); c.add(CHOPPER, 2); c.add(TANK, 4); assert.equal(forceSpeed(c), 'fast');
    const d = new Units(); d.add(CHOPPER, 2); d.add(TANK, 5); assert.equal(forceSpeed(d), 'slow');
});

test('roads are symmetric and short', () => {
    buildConnectivity();
    for (let i = 0; i < 200; i++) {
        const x = 100 + (i % 37), y = 120 + ((i * 7) % 41);
        for (const n of neighbors(x, y)) {
            assert.ok(neighbors(n.x, n.y).some((m) => m.x === x && m.y === y), 'symmetric road');
            assert.ok(distance({ x, y }, n) <= 5);
        }
    }
});

test('tower type is deterministic and spawnable', () => {
    for (let i = 0; i < 50; i++) {
        const t = towerTypeAt(i * 3, i * 5);
        assert.equal(t, towerTypeAt(i * 3, i * 5));
        assert.ok(SPAWNABLE.some((s) => s.name === t));
    }
});

test('spawn gives a king, shields, and outgoing soldiers', () => {
    const g = new Game({ shrink: false });
    const p = new Player(0, 'tester');
    g.players = [p];
    assert.ok(g.spawnPlayer(p));
    const t = g.towers.get(Number([...p.towers][0]));
    assert.ok(t.units.hasRuler());
    assert.ok(t.units.get(SHIELD) > 0);
    assert.ok(g.forces.some((f) => f.owner === 0 && f.units.get(SOLDIER) > 0));
});

test('economy: the king tower makes shields but no soldiers', () => {
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const t = g.towers.get(Number([...p.towers][0]));
    for (let i = 0; i < TICK_HZ * 40; i++) g.tick();
    assert.equal(t.units.get(SOLDIER), 0);
    assert.ok(t.units.get(SHIELD) >= 5);
});

test('upgrading is gated on prerequisites and suspends the tower', () => {
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const t = g.towers.get(Number([...p.towers][0]));
    t.type = 'Village';
    t.units.reconcile('Village', true);
    assert.equal(g.upgradeTower(0, t.id, 'Town'), 'missing prerequisite');
    p.towerCounts = { Generator: 1, Village: 3 };
    assert.equal(g.upgradeTower(0, t.id, 'Town'), null);
    assert.equal(t.type, 'Town');
    assert.ok(t.delay > 0);
    assert.equal(g.upgradeTower(0, t.id, 'City'), 'upgrade pending');
});

test('killing a king leaves leaderless zombies', () => {
    const g = new Game({ shrink: false });
    const mk = (id, name) => new Player(id, name);
    g.players = [mk(0, 'a')];
    g.spawnPlayer(g.players[0]);
    const t = g.towers.get(Number([...g.players[0].towers][0]));
    t.units.subtract(RULER, 1);
    g.checkDeaths();
    assert.equal(g.players[0].alive, false);
    assert.equal(t.owner, null);
    assert.equal(t.units.get(SHIELD), 0);
});

test('three-player bot game runs 3 minutes without corruption', () => {
    const g = new Game({ shrink: true });
    const players = [];
    for (let i = 0; i < 3; i++) players.push(new Player(i, 'p' + i, { bot: true }));
    g.players = players;
    for (const p of players) g.spawnPlayer(p);
    const towerCount = () => g.towers.size;
    for (let i = 0; i < TICK_HZ * 60 * 3; i++) {
        g.tick();
        if (i % 128 === 0) {
            for (const t of g.towers.values()) {
                for (const [, c] of t.units.counts()) assert.ok(c > 0 && Number.isFinite(c));
            }
            for (const f of g.forces) assert.ok(Number.isFinite(f.progress));
        }
    }
    assert.ok(towerCount() > 100, 'map grew: ' + towerCount());
    assert.ok(g.forces.length < 500);
});

function builderTower(g, p) {
    const kingKey = Number([...p.towers][0]);
    const king = g.towers.get(kingKey);
    for (const nb of neighbors(king.x, king.y)) {
        const t = g.getTower(nb);
        if (!t) continue;
        t.type = 'Barracks';
        t.owner = 0;
        t.units = new (Object.getPrototypeOf(t.units).constructor)();
        t.units.add(SOLDIER, 6, 'Barracks', true);
        p.towers.add(nb.y * 512 + nb.x);
        return t;
    }
    throw new Error('no neighbour to build on');
}

test('a force on a long road is never orphaned mid-route', () => {
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const src = builderTower(g, p);
    // Three legs so the force has to stop at a checkpoint before its destination.
    let path = null;
    for (const a of neighbors(src.x, src.y)) {
        if (!g.getTower(a)) continue;
        for (const b of neighbors(a.x, a.y)) {
            if (!g.getTower(b) || (b.x === src.x && b.y === src.y)) continue;
            path = [src.id, a, b];
            break;
        }
        if (path) break;
    }
    assert.ok(path, 'found a two-hop path');
    const err = g.deploy(0, src.id, path);
    assert.equal(err, null);
    const f = g.forces.find((x) => x.path.length === 3);
    assert.ok(f, 'force left carrying the full path');
    let hops = 0;
    for (let i = 0; i < 600 && g.forces.includes(f); i++) {
        const held = [...g.towers.values()].some((t) => t.inbound.includes(f));
        assert.ok(held, `force lost mid-route at tick ${i} (idx ${f.idx}/${f.path.length})`);
        const idx = f.idx;
        g.tick();
        if (f.idx !== idx) hops += 1;
    }
    assert.ok(hops >= 1, 'the force walked at least the first leg');
});

test('a supply line keeps producing even though its forces share the path', () => {
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const src = builderTower(g, p);
    const key = Number([...p.towers][0]);
    const nb = neighbors(src.x, src.y).find((n) => g.getTower(n) && (n.x !== src.x || n.y !== src.y));
    assert.ok(nb, 'has a neighbour');
    assert.equal(g.setSupplyLine(0, src.id, [src.id, nb]), null);
    let captured = false;
    for (let i = 0; i < 4 * 60 && !captured; i++) {
        g.tick();
        const t = g.getTower(nb);
        // the target may be captured or (if it was the spawn tower) still mine
        captured = !t || t.owner === 0;
    }
    assert.ok(captured, 'units arrived along the supply line');
    assert.ok(g.towers.get(key).owner === 0, 'source tower survived');
});

test('high morale: the King\'s tower and its neighbours produce twice as fast', () => {
    const measure = (inBubble) => {
        const g = new Game({ shrink: false });
        const p = new Player(0, 'p');
        g.players = [p];
        g.spawnPlayer(p);
        const king = g.towers.get(Number([...p.towers][0]));
        let t = null;
        if (inBubble) {
            for (const nb of neighbors(king.x, king.y)) {
                const c = g.getTower(nb);
                if (c && !(c.x === king.x && c.y === king.y)) { t = c; break; }
            }
        } else {
            for (const c of g.towers.values()) {
                if (Math.max(Math.abs(c.x - king.x), Math.abs(c.y - king.y)) >= 4) { t = c; break; }
            }
        }
        t.owner = 0; t.type = 'Armory'; t.delay = 0;
        t.units = new Units();
        t.supply = null; t.inbound.length = 0; t.outbound.length = 0;
        p.towers.add(t.y * 512 + t.x);
        for (let i = 0; i < 4 * 15; i++) g.tick();
        return t.units.get(TANK);
    };
    assert.equal(measure(false), 1, 'a away-from-court Armory makes one tank per 15s');
    assert.equal(measure(true), 2, 'the court makes two');
});

test('shields sit ten higher in the King\'s own tower', () => {
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const king = g.towers.get(Number([...p.towers][0]));
    king.type = 'Barracks';
    king.units.reconcile('Barracks', true);
    const plain = new Units();
    plain.add(RULER, 1);
    const base = plain.capacity(SHIELD, 'Barracks') - RULER_SHIELD_BOOST;
    assert.equal(plain.capacity(SHIELD, 'Barracks'), TOWER.Barracks.rawCap(SHIELD) + RULER_SHIELD_BOOST);
    assert.ok(king.units.capacity(SHIELD, king.type) > base);
});

test('fog: a tower sees its sensor radius and no further', async () => {
    const { Visibility } = await import('../src/fog.js');
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const king = g.towers.get(Number([...p.towers][0]));
    const vis = new Visibility();
    vis.invalidate();
    vis.update(g, 0, false);
    assert.ok(vis.visible(king), 'your own tower is visible');
    // A tower outside every sensor is hidden, one inside a radar's reach is not.
    let far = null;
    for (const t of g.towers.values()) if (Math.abs(t.x - king.x) > 8 || Math.abs(t.y - king.y) > 8) far = t;
    assert.equal(vis.visible(far), false, 'distant tower hidden');
    king.type = 'Satellite';                 // sensor_radius 30 world units = 6 cells
    vis.invalidate();
    vis.update(g, 0, false);
    const ring = g.getTower(neighbors(king.x, king.y).find((n) => Math.abs(n.x - king.x) <= 1) || { x: king.x + 1, y: king.y });
    if (ring) assert.ok(vis.visible(ring), 'adjacent tower visible');
    assert.equal(vis.visible(far), false, 'still hidden past the sensor');
});

test('fog: an upgrading tower sees no further than a mine', async () => {
    const { Visibility } = await import('../src/fog.js');
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const king = g.towers.get(Number([...p.towers][0]));
    king.type = 'Satellite';
    king.delay = 40;                          // mid-upgrade
    const vis = new Visibility();
    vis.invalidate();
    vis.update(g, 0, false);
    const probe = g.getTower({ x: king.x + 4, y: king.y }) || g.towers.values().next().value;
    // 4 cells away is inside a satellite's 6, but outside a mine's 2.4
    assert.equal(vis.radiusOf(king), TOWER.Mine.sensor / 5);
});

test('effects: events become particles that expire in real time', async () => {
    const { Effects } = await import('../src/effects.js');
    const fx = new Effects();
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    fx.onEvent({ type: 'nuke' }, [100, 100]);
    assert.equal(fx.items.length, 2, 'a nuke spawns two rings');
    fx.onEvent({ type: 'gained' }, [100, 100]);
    assert.ok(fx.items.length > 2, 'a capture spawns sparks');
    // at 10 fps a one second effect should be gone after ~10 frames
    for (let i = 0; i < 15; i++) fx.render(ctx, (x, y) => [x, y], 20, 0.1);
    assert.equal(fx.items.length, 0, 'particles expire');
});

test('alerts: tutorial nudges, then steps aside once you act', async () => {
    const { AlertBoard } = await import('../src/alerts.js');
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    builderTower(g, p);                    // something to upgrade once the capture step is done
    const board = new AlertBoard();
    // At t=0 the board may already be warning about the King (his tower starts full of
    // armed neighbours), but the tutorial itself must not nag before a few seconds.
    assert.ok(!board.evaluate(g, p).some((a) => a.kind === 'capture'), 'no tutorial nag at t=0');
    g.time = 4 * 20;
    const list = board.evaluate(g, p);
    assert.ok(list.some((a) => a.kind === 'capture'), 'capture tutorial appears');
    board.onCapture();
    g.time = 4 * 40;
    assert.ok(board.evaluate(g, p).some((a) => a.kind === 'upgrade'), 'then the upgrade one');
    board.onUpgrade();
    assert.ok(!board.evaluate(g, p).some((a) => a.kind === 'upgrade'), 'and it stays gone');
});

test('alerts: a tower that fills up asks for a supply line', async () => {
    const { AlertBoard } = await import('../src/alerts.js');
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const t = builderTower(g, p);          // a plain tower (the spawn tower holds the King)
    const cap = t.units.capacity(SOLDIER, 'Barracks');
    t.units.add(SOLDIER, cap, 'Barracks', false);
    const board = new AlertBoard();
    const kinds = board.evaluate(g, p).map((a) => a.kind);
    assert.ok(kinds.includes('full'), 'full tower reported: ' + kinds.join(','));
    // overflow: more than capacity is only possible when units are circling
    t.units.add(SOLDIER, 5, 'Barracks', true);
    assert.ok(board.evaluate(g, p).some((a) => a.kind === 'overflow'), 'overflowing reported');
});

test('alerts: the King under attack outranks everything else', async () => {
    const { AlertBoard } = await import('../src/alerts.js');
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const king = g.towers.get(Number([...p.towers][0]));
    king.units.subtract(SHIELD, 255);          // no shields left
    // an enemy tower next door is what makes his position unsafe
    const nb = neighbors(king.x, king.y).map((n) => g.getTower(n)).find(Boolean);
    nb.owner = 1;
    const board = new AlertBoard();
    g.time = 4 * 30;
    const kinds = board.evaluate(g, p).map((a) => a.kind);
    assert.equal(kinds[0], 'rulerUnsafe', 'King safety is announced: ' + kinds.join(','));

    // with shields back and no enemy touching him, the warning goes away
    king.units.add(SHIELD, 30, king.type, true);
    nb.owner = null;
    assert.ok(!board.evaluate(g, p).some((a) => a.kind === 'rulerUnsafe'), 'safe again');
});

test('alerts: zombies touching your land are announced', async () => {
    const { AlertBoard } = await import('../src/alerts.js');
    const g = new Game({ shrink: false });
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const t = builderTower(g, p);
    t.inbound.push({ owner: null, units: new Units(), path: [t.id, t.id], idx: 0 });
    const board = new AlertBoard();
    assert.ok(board.evaluate(g, p).some((a) => a.kind === 'zombies'), 'zombies reported');
});

test('capture chime only fires when you take a tower from someone else', () => {
    const g = new Game({ shrink: false });
    const events = [];
    g.onEvent = (e) => events.push(e);
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const src = builderTower(g, p);
    // Take two adjacent towers, hand one to an enemy and send a big force straight in.
    const a = [...g.towers.values()].find((t) => t !== src && t.owner == null);
    a.owner = 0;
    const b = neighbors(a.x, a.y).map((n) => g.getTower(n)).find((t) => t && t !== a && t !== src);
    assert.ok(a && b, 'found a pair of neighbours');
    b.owner = 1;
    b.units.reconcile(b.type, true);
    b.units.add(SHIELD, 2, b.type, true);

    const units = new Units();
    units.add(SOLDIER, 40);
    const path = [a.id, b.id];
    const f = new (Object.getPrototypeOf(g.forces[0]).constructor)(0, units, path);
    f.idx = 0;
    f.progress = f.required - 1;
    g.sendForce(a, f);
    for (let i = 0; i < 6; i++) g.tick();

    const gained = events.filter((e) => e.type === 'gained' && e.player === 0);
    assert.equal(b.owner, 0, 'the enemy tower fell');
    assert.ok(gained.some((e) => e.capturedFrom === 1 && e.tower.x === b.x && e.tower.y === b.y),
        'capture records who lost it: ' + JSON.stringify(gained));
});

test('the death reason names the killer and the unit', () => {
    const g = new Game({ shrink: false });
    const events = [];
    g.onEvent = (e) => events.push(e);
    const p = new Player(0, 'p');
    g.players = [p];
    g.spawnPlayer(p);
    const king = g.towers.get(Number([...p.towers][0]));
    king.units.subtract(SHIELD, 255);
    // A hostile force arrives and the combat settles with the King spent. The engine reports
    // that through the same `ruler` event the real client turns into
    // DeathReason::RulerKilled { alias, unit }.
    const force = new (Object.getPrototypeOf(g.forces[0]).constructor)(1, new Units(), [king.id, king.id]);
    force.units.add(SOLDIER, 5);
    force.idx = 0;
    force.progress = force.required - 1;
    king.inbound.push(force);
    force.host = king;
    // Simulate the combat outcome the engine would produce: King killed by that player.
    king.units.subtract(RULER, 1);              // the King is spent
    p.deathReason = { killer: 1, unit: SOLDIER }; // ...as recorded by the arrival handler
    g.info({ type: 'ruler', player: 0, side: ATTACKER, tower: { x: king.x, y: king.y }, killer: 1, by: SOLDIER });
    g.checkDeaths();
    assert.equal(p.alive, false, 'the King is gone');
    assert.ok(p.deathReason, 'a death reason was recorded');
    assert.equal(p.deathReason.killer, 1, 'killer is the enemy');
    const ev = events.find((e) => e.type === 'ruler');
    assert.ok(ev && ev.killer === 1, 'the ruler event carries the killer: ' + JSON.stringify(ev));
});
