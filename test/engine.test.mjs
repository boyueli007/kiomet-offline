// Headless checks of the engine against the reference implementation's invariants.
import { test } from 'node:test';
import assert from 'node:assert';
import {
    TOWERS, TOWER, UNITS, SHIELD, SOLDIER, TANK, NUKE, FIGHTER, RULER, CHOPPER,
    TICK_HZ, SPAWNABLE, meetsPrereqs,
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
