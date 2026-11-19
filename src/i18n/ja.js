// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// 日本語.

export default {
    meta: { name: '日本語', short: '日', dir: 'ltr', htmlLang: 'ja', font: null },

    // ---------------- 共通 ----------------
    'app.title': 'Kiomet — リアルタイム領土防衛',
    'common.close': '閉じる',
    'common.cancel': 'キャンセル',
    'common.ok': 'OK',
    'common.language': '言語',

    // ---------------- ステータス ----------------
    'hud.score': 'スコア',
    'hud.towers': 'タワー',
    'hud.life': '生存',
    'hud.leaderboard': 'ランキング',
    'hud.footer': 'タワー {towers} 基 · プレイヤー {players} 人',

    // ---------------- チャット ----------------
    'chat.placeholder': 'メッセージを入力…',

    // ---------------- ズーム ----------------
    'zoom.out': '縮小',
    'zoom.in': '拡大',
    'zoom.center': '自分のキングを探す',

    // ---------------- ボタン ----------------
    'btn.pause': '一時停止',
    'btn.resume': '再開',
    'btn.speed': 'ゲーム速度',
    'btn.god': '無敵',
    'btn.fog': '霧:オン',
    'btn.fogOff': '霧:オフ',
    'btn.fogTitle': '戦争の霧（B キーで切替）',
    'btn.help': 'ヘルプ',
    'btn.towers': 'タワー',
    'btn.units': 'ユニット',
    'btn.newgame': '新しいゲーム',

    // ---------------- 開始画面 ----------------
    'spawn.sub': 'リアルタイム領土防衛 · オフライン版',
    'spawn.name': 'ニックネーム',
    'spawn.play': '開始',

    // ---------------- トースト ----------------
    'toast.godOn': '無敵モード オン — キングは死にません',
    'toast.godOff': '無敵モード オフ',
    'toast.supplyOn': 'すべての補給線を表示（R）',
    'toast.supplyOff': '補給線を非表示にしました',
    'toast.prereq': '前提条件が足りません',
    'toast.supplyRemoved': '補給線を削除しました',
    'toast.supplyNone': '削除できる補給線がありません',
    'toast.kingConfirm': '目的地にカーソルをしばらく置くとキングを送れます',
    'toast.intro': 'タワーをクリックでメニュー · 自軍のタワーからドラッグで出兵 · H でキングへ',
    'toast.menuHint': 'クリックで移動',

    // ---------------- アラート ----------------
    'alert.rulerAttack.title': 'キングが攻撃されています！',
    'alert.rulerAttack.hint': '倒されるとゲームオーバーです',
    'alert.rulerUnsafe.title': 'キングを安全な場所へ移動しましょう',
    'alert.rulerUnsafe.hint': '領土の中央付近にあるシールド付きの本拠地やバンカーが最も安全です',
    'alert.capture.title': 'もっとタワーを占領しましょう',
    'alert.capture.hint': '自軍のタワーから領土の外へユニットをドラッグします',
    'alert.upgrade.title': 'タワーをアップグレードしましょう',
    'alert.upgrade.hint': 'タワーをクリックすると強化の候補が表示されます',
    'alert.full.title': 'タワーが満杯です',
    'alert.full.hint': 'ユニットをドラッグして空きを作りましょう',
    'alert.overflow.title': 'タワーがあふれています',
    'alert.overflow.hint': 'ユニットをドラッグしないと消えてしまいます',
    'alert.zombies.title': 'ゾンビを発見',
    'alert.zombies.hint': '反対方向へ移動して逃げましょう',
    'alert.kingDead': 'キングが倒されました！',

    // ---------------- 死因 ----------------
    'death.default': 'キングが倒されました！',
    'death.byZombies': 'キングはゾンビに倒されました！',
    'death.byPlayer': 'キングは {player} の {unit} に倒されました！',
    'death.byPlayerNoUnit': 'キングは {player} に倒されました！',
    'death.someone': '誰か',
    'death.zombies': 'ゾンビ',

    // ---------------- タワーメニュー ----------------
    'menu.upgrading': '強化中… {seconds} 秒',
    'menu.upgradeTo': '{tower} へ強化',
    'menu.downgradeTo': '{tower} へ降格',
    'menu.cancelSupply': '補給線を解除',
    'menu.hintMobile': 'ドラッグで出兵。先に選択してからドラッグすると補給線になります。',
    'menu.hintStatic': 'ドラッグで出兵。',
    'menu.unowned': '無主',
    'menu.requestAlly': '同盟を申し込む',
    'menu.acceptAlly': '同盟を承諾',
    'menu.breakAlly': '同盟を解消',

    // ---------------- エラー ----------------
    'err.sourceNotOwned': '出発タワーが自軍のものではありません',
    'err.emptyForce': '送れるユニットがありません',
    'err.pathTooShort': '経路が短すぎます',
    'err.pathTooLong': '経路が長すぎます',
    'err.sourceMismatch': '出発タワーが一致しません',
    'err.duplicateTower': '経路に同じタワーがあります',
    'err.edgeTooLong': '道が長すぎます',
    'err.notNeighbor': 'このタワー同士は道でつながっていません',
    'err.notGenerated': 'そのタワーは存在しません',
    'err.invalidSupply': 'このタワーは補給線を作れません',
    'err.noTower': 'そこにタワーはありません',
    'err.notOwned': 'そのタワーは自軍のものではありません',
    'err.upgradePending': '強化がまだ完了していません',
    'err.badType': 'タワーの種類が無効です',
    'err.prereq': '前提条件が足りません',
    'err.invalidUpgrade': 'そのような強化はできません',

    // ---------------- ヘルプ ----------------
    'help.title': 'ヘルプ',
    'help.body': `
<p>Kiomet はリアルタイムストラテジーです。ユニットを送ってタワーを占領し、領土を広げましょう。</p>
<h3>遊び方</h3>
<p>ユニットをドラッグしてタワーを占領します。タワーを強化するには、まずタワーをクリックし、
次に可能な強化をクリックします。強化の横には必要な条件が表示されます。</p>
<h3>勝ち方</h3>
<p>タワーを占領し、できるだけ長く保持して得点を稼ぎます。キングを守ってください —
失うとゲームオーバーです。バンカーや本拠地はいくつかの核攻撃に耐えます。</p>
<h3>補給線</h3>
<p>ユニットを生産するタワーは自動で送り出せます。タワーをクリックしてメニューを開き、
いつも通りドラッグしてください。経路に動く矢印が出れば成功です。<b>R</b> を押し続けると
すべての補給線が表示されます。もう一度描くか <b>Shift+R</b> で削除できます。</p>
<h3>同盟</h3>
<p>他プレイヤーのタワーを選び、握手ボタンをクリックすると同盟を申し込むか承諾できます。
解消するまで双方は攻撃できません。</p>
<h3>キー操作</h3>
<p><b>H</b> キングへ · <b>Q</b>/<b>E</b> ズーム · <b>WASD</b> または矢印キーで移動 ·
<b>T</b> 同じ種類のタワーを強調 · <b>R</b> 補給線 · <b>B</b> 戦争の霧 ·
<b>スペース</b> 一時停止 · <b>Esc</b> メニューを閉じる。</p>`,

    // ---------------- タワー一覧 ----------------
    'towers.title': 'タワー',
    'towers.lead': '全 27 種のタワー。実線は強化、破線は前提条件です。',
    'towers.upgradesFrom': '{icon} <b>{tower}</b> から強化（{seconds} 秒）',
    'towers.upgradesFromReq': '{icon} <b>{tower}</b> から強化（{seconds} 秒）、{reqs} が必要',
    'towers.foundOnMap': 'マップ上に出現します。',
    'towers.canContain': '{units} まで収容できます。',
    'towers.generates': '{units}を生産します',
    'towers.generatesEvery': '{unit}（{seconds} 秒ごと）',
    'towers.generatesNothing': '何も生産しません',
    'towers.worth': '、{points} 点の価値があります。',
    'towers.sensor': '視界範囲が標準より {percent}% 広いです。',
    'towers.projector': '道路沿いにシールドを送れます。',

    // ---------------- ユニット一覧 ----------------
    'units.title': 'ユニット',
    'units.lead': '全 10 種のユニット。原則として記載順に戦い、シールドが常に最初にダメージを受けます。',
    'units.producedBy': '{makers} で生産されます。',
    'units.damage': '{surface} のダメージを与えます。',
    'units.damageBoth': '地上に {surface}、空中に {air} のダメージを与えます。',
    'units.infinite': '無限',
    'units.speed.slow': 'ゆっくり移動します。',
    'units.speed.normal': '中程度の速さで移動します。',
    'units.speed.fast': '速く移動します。',
    'units.speed.shield': '動きません。',
    'units.shieldSpecial': 'プロジェクターから送られた場合を除き動きません。その場合は高速で移動します。',
    'units.range.short': '射程は短いです。',
    'units.range.medium': '射程は中程度です。',
    'units.range.long': '射程は長いです。',
    'units.weight': 'チョッパーにとっての重さは {weight} です。',
    'units.chopper': '他のユニットを輸送できます（重さ 4）。',
    'units.emp': 'タワーを 60 秒間無効化します。',
    'units.overflow': '最大 {count} 体まで一時的にタワーからあふれられます。',
    'units.king': 'シールド容量を {boost} 増やします。倒されるとゲームオーバーです。',

    // ---------------- タワー名 ----------------
    'tower.Airfield': '飛行場',
    'tower.Armory': '武器庫',
    'tower.Artillery': '砲兵陣地',
    'tower.Barracks': '兵舎',
    'tower.Bunker': 'バンカー',
    'tower.Centrifuge': '遠心分離機',
    'tower.City': '都市',
    'tower.Cliff': '崖',
    'tower.Ews': '早期警戒機',
    'tower.Factory': '工場',
    'tower.Generator': '発電機',
    'tower.Headquarters': '本拠地',
    'tower.Helipad': 'ヘリポート',
    'tower.Launcher': '発射台',
    'tower.Mine': '鉱山',
    'tower.Projector': 'プロジェクター',
    'tower.Quarry': '採石場',
    'tower.Radar': 'レーダー',
    'tower.Rampart': '防壁',
    'tower.Reactor': '原子炉',
    'tower.Refinery': '精製所',
    'tower.Rocket': 'ロケット',
    'tower.Runway': '滑走路',
    'tower.Satellite': '衛星',
    'tower.Silo': 'ミサイルサイロ',
    'tower.Town': '町',
    'tower.Village': '村',

    // ---------------- ユニット名 ----------------
    'unit.Shield': 'シールド',
    'unit.Fighter': '戦闘機',
    'unit.Chopper': 'チョッパー',
    'unit.Bomber': '爆撃機',
    'unit.Tank': '戦車',
    'unit.Soldier': '兵士',
    'unit.Shell': '砲弾',
    'unit.Emp': 'EMP',
    'unit.Nuke': '核爆弾',
    'unit.King': 'キング',
};
