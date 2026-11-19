// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// English. Wording follows upstream Kiomet (client/src/ui/translations/help/en.md and the
// /towers and /units reference pages) so the reference dialogs read like the original.

export default {
    meta: { name: 'English', short: 'EN', dir: 'ltr', htmlLang: 'en', font: null },

    // ---------------- generic ----------------
    'app.title': 'Kiomet — real-time territory defense',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.ok': 'OK',
    'common.language': 'Language',

    // ---------------- HUD ----------------
    'hud.score': 'Score',
    'hud.towers': 'Towers',
    'hud.life': 'Life',
    'hud.leaderboard': 'Leaderboard',
    'hud.footer': '{towers} towers · {players} players',

    // ---------------- chat ----------------
    'chat.placeholder': 'Say something…',

    // ---------------- zoom ----------------
    'zoom.out': 'Zoom out',
    'zoom.in': 'Zoom in',
    'zoom.center': 'Find my King',

    // ---------------- control buttons ----------------
    'btn.pause': 'Pause',
    'btn.resume': 'Resume',
    'btn.speed': 'Game speed',
    'btn.god': 'God',
    'btn.fog': 'Fog: on',
    'btn.fogOff': 'Fog: off',
    'btn.fogTitle': 'Fog of war (press B)',
    'btn.help': 'Help',
    'btn.towers': 'Towers',
    'btn.units': 'Units',
    'btn.newgame': 'New game',

    // ---------------- spawn panel ----------------
    'spawn.sub': 'Real-time territory defense · offline remake',
    'spawn.name': 'Nickname',
    'spawn.play': 'Play',

    // ---------------- toasts ----------------
    'toast.godOn': 'God mode on — your King cannot die',
    'toast.godOff': 'God mode off',
    'toast.supplyOn': 'Showing all supply lines (R)',
    'toast.supplyOff': 'Supply lines hidden',
    'toast.prereq': 'Missing prerequisite',
    'toast.supplyRemoved': 'Supply line removed',
    'toast.supplyNone': 'No supply lines to remove',
    'toast.kingConfirm': 'Hold the pointer on the destination for a moment to send your King',
    'toast.intro': 'Click a tower for its menu · drag from your towers to send units · H finds your King',
    'toast.menuHint': 'Click to jump',

    // ---------------- alerts ----------------
    'alert.rulerAttack.title': 'Your King is under attack!',
    'alert.rulerAttack.hint': 'If they die, you lose the game',
    'alert.rulerUnsafe.title': 'Move your King to safety',
    'alert.rulerUnsafe.hint': 'Shielded Headquarters or Bunkers near the center of your territory provide the most protection',
    'alert.capture.title': 'Capture more towers',
    'alert.capture.hint': 'Drag units from your towers to outside your borders',
    'alert.upgrade.title': 'Upgrade a tower',
    'alert.upgrade.hint': 'Click a tower to show upgrade options',
    'alert.full.title': 'A tower is full',
    'alert.full.hint': 'Drag away units to make room for more',
    'alert.overflow.title': 'A tower is overflowing',
    'alert.overflow.hint': 'Drag away units to stop them from disappearing',
    'alert.zombies.title': 'Zombies sighted',
    'alert.zombies.hint': 'Escape them by moving in the opposite direction',
    'alert.kingDead': 'Your King was killed!',

    // ---------------- death reason ----------------
    'death.default': 'Your King was killed!',
    'death.byZombies': 'King killed by zombies!',
    'death.byPlayer': "King killed by {player}'s {unit}!",
    'death.byPlayerNoUnit': 'King killed by {player}!',
    'death.someone': 'someone',
    'death.zombies': 'zombies',

    // ---------------- tower menu ----------------
    'menu.upgrading': 'Upgrading… {seconds}s',
    'menu.upgradeTo': 'Upgrade to {tower}',
    'menu.downgradeTo': 'Downgrade to {tower}',
    'menu.cancelSupply': 'Cancel supply line',
    'menu.hintMobile': 'Drag to send units. Select first, then drag to set a supply line.',
    'menu.hintStatic': 'Drag to send units.',
    'menu.unowned': 'Unowned',
    'menu.requestAlly': 'Request alliance',
    'menu.acceptAlly': 'Accept alliance',
    'menu.breakAlly': 'Break alliance',

    // ---------------- engine errors ----------------
    'err.sourceNotOwned': 'Source tower is not yours',
    'err.emptyForce': 'Nothing to send',
    'err.pathTooShort': 'Path too short',
    'err.pathTooLong': 'Path too long',
    'err.sourceMismatch': 'Source tower mismatch',
    'err.duplicateTower': 'Duplicate tower in path',
    'err.edgeTooLong': 'Road too long',
    'err.notNeighbor': 'No road between those towers',
    'err.notGenerated': 'That tower does not exist',
    'err.invalidSupply': 'This tower cannot start a supply line',
    'err.noTower': 'No tower there',
    'err.notOwned': 'That tower is not yours',
    'err.upgradePending': 'Upgrade still in progress',
    'err.badType': 'Invalid tower type',
    'err.prereq': 'Missing prerequisite',
    'err.invalidUpgrade': 'Cannot upgrade that way',

    // ---------------- help ----------------
    'help.title': 'Help',
    'help.body': `
<p>Kiomet is a real-time strategy game: expand your territory by sending units to capture towers.</p>
<h3>How to play</h3>
<p>Drag units to capture towers. To upgrade a tower, click it and then click an available upgrade.
Upgrades list their requirements next to them.</p>
<h3>How to win</h3>
<p>Earn points by capturing towers and holding them as long as possible. Protect your King —
losing it costs you the game. A Bunker or Headquarters can survive a few Nukes.</p>
<h3>Supply lines</h3>
<p>Towers that make units can send them automatically. Click a tower to open its menu, then drag
from it as normal; if the path shows moving arrows, you succeeded. Hold <b>R</b> to show all your
supply lines. Delete one by drawing it again or with <b>Shift+R</b>.</p>
<h3>Alliances</h3>
<p>Select a tower of another player and click the handshake button to request or accept an
alliance. Until it is broken, neither side can attack the other.</p>
<h3>Keys</h3>
<p><b>H</b> find your King · <b>Q</b>/<b>E</b> zoom · <b>WASD</b> or arrows to pan ·
<b>T</b> mark towers of the selected kind · <b>R</b> supply lines · <b>B</b> fog of war ·
<b>Space</b> pause · <b>Esc</b> close menus.</p>`,

    // ---------------- towers reference ----------------
    'towers.title': 'Towers',
    'towers.lead': 'The 27 towers. Solid lines are upgrades, dashed lines are prerequisites.',
    'towers.upgradesFrom': 'Upgrades from {icon} <b>{tower}</b> (in {seconds}s)',
    'towers.upgradesFromReq': 'Upgrades from {icon} <b>{tower}</b> (in {seconds}s), requires {reqs}',
    'towers.foundOnMap': 'Found on the map.',
    'towers.canContain': 'Can contain {units}.',
    'towers.generates': 'Generates {units}',
    'towers.generatesEvery': '{unit} (every {seconds}s)',
    'towers.generatesNothing': 'nothing',
    'towers.worth': ', worth {points} point.',
    'towers.sensor': 'Has a {percent}% higher visual range.',
    'towers.projector': 'Can send Shields along roads.',

    // ---------------- units reference ----------------
    'units.title': 'Units',
    'units.lead': 'The 10 units. They generally fight in the order listed — shield always absorbs damage first.',
    'units.producedBy': 'Produced by {makers}.',
    'units.damage': 'Does {surface} damage.',
    'units.damageBoth': 'Does {surface} damage against surface, {air} damage against air.',
    'units.infinite': 'infinite',
    'units.speed.slow': 'Travels at a slow speed.',
    'units.speed.normal': 'Travels at a moderate speed.',
    'units.speed.fast': 'Travels at a fast speed.',
    'units.speed.shield': 'Is immobile.',
    'units.shieldSpecial': 'Immobile unless sent from a Projector, in which case it travels fast.',
    'units.range.short': 'Has a short range.',
    'units.range.medium': 'Has a medium range.',
    'units.range.long': 'Has a long range.',
    'units.weight': 'Has weight of {weight} for Choppers.',
    'units.chopper': 'Can carry other units (weight of 4).',
    'units.emp': 'Disables a tower for 60s.',
    'units.overflow': 'Up to {count} can temporarily overflow a tower.',
    'units.king': 'Boosts shield capacity by {boost}. If it dies, you lose the game.',

    // ---------------- names: towers ----------------
    'tower.Airfield': 'Airfield',
    'tower.Armory': 'Armory',
    'tower.Artillery': 'Artillery',
    'tower.Barracks': 'Barracks',
    'tower.Bunker': 'Bunker',
    'tower.Centrifuge': 'Centrifuge',
    'tower.City': 'City',
    'tower.Cliff': 'Cliff',
    'tower.Ews': 'EWS',
    'tower.Factory': 'Factory',
    'tower.Generator': 'Generator',
    'tower.Headquarters': 'Headquarters',
    'tower.Helipad': 'Helipad',
    'tower.Launcher': 'Launcher',
    'tower.Mine': 'Mine',
    'tower.Projector': 'Projector',
    'tower.Quarry': 'Quarry',
    'tower.Radar': 'Radar',
    'tower.Rampart': 'Rampart',
    'tower.Reactor': 'Reactor',
    'tower.Refinery': 'Refinery',
    'tower.Rocket': 'Rocket',
    'tower.Runway': 'Runway',
    'tower.Satellite': 'Satellite',
    'tower.Silo': 'Silo',
    'tower.Town': 'Town',
    'tower.Village': 'Village',

    // ---------------- names: units ----------------
    'unit.Shield': 'Shield',
    'unit.Fighter': 'Fighter',
    'unit.Chopper': 'Chopper',
    'unit.Bomber': 'Bomber',
    'unit.Tank': 'Tank',
    'unit.Soldier': 'Soldier',
    'unit.Shell': 'Shell',
    'unit.Emp': 'EMP',
    'unit.Nuke': 'Nuke',
    'unit.King': 'King',
};
