// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// 简体中文（默认语言）。所有界面文案的唯一来源：其它语言缺 key 时回退到这里。

export default {
    meta: { name: '中文', short: '中', dir: 'ltr', htmlLang: 'zh-CN', font: null },

    // ---------------- 通用 ----------------
    'app.title': 'Kiomet — 实时领地塔防',
    'common.close': '关闭',
    'common.cancel': '取消',
    'common.ok': '确定',
    'common.language': '语言',

    // ---------------- 底栏 / 顶栏 ----------------
    'hud.score': '得分',
    'hud.towers': '塔',
    'hud.life': '生命',
    'hud.leaderboard': '排行榜',
    'hud.footer': '{towers} 座塔 · {players} 名玩家',

    // ---------------- 聊天 ----------------
    'chat.placeholder': '说点什么…',

    // ---------------- 缩放 ----------------
    'zoom.out': '缩小',
    'zoom.in': '放大',
    'zoom.center': '找到我的国王',

    // ---------------- 控制按钮 ----------------
    'btn.pause': '暂停',
    'btn.resume': '继续',
    'btn.speed': '游戏速度',
    'btn.god': '无敌',
    'btn.fog': '迷雾:开',
    'btn.fogOff': '迷雾:关',
    'btn.fogTitle': '战争迷雾（B 键切换）',
    'btn.help': '帮助',
    'btn.towers': '塔',
    'btn.units': '单位',
    'btn.newgame': '新游戏',

    // ---------------- 开局面板 ----------------
    'spawn.sub': '实时领地塔防 · 单机复刻',
    'spawn.name': '昵称',
    'spawn.play': '开始',

    // ---------------- 提示条 ----------------
    'toast.godOn': '无敌模式已开启 — 你的国王不会阵亡',
    'toast.godOff': '无敌模式已关闭',
    'toast.supplyOn': '显示全部补给线（R）',
    'toast.supplyOff': '已隐藏补给线',
    'toast.prereq': '缺少前置条件',
    'toast.supplyRemoved': '已删除补给线',
    'toast.supplyNone': '没有可删除的补给线',
    'toast.kingConfirm': '把指针停在目标上片刻即可派出国王',
    'toast.intro': '单击塔打开菜单 · 从我方塔拖动可派兵 · H 键找到国王',
    'toast.menuHint': '单击可以跳转',

    // ---------------- 警报（对应原版 alerts.rs） ----------------
    'alert.rulerAttack.title': '你的国王正被攻击！',
    'alert.rulerAttack.hint': '国王阵亡即出局',
    'alert.rulerUnsafe.title': '把国王转移到安全的地方',
    'alert.rulerUnsafe.hint': '位于领地中央、有护盾的总部或地堡最能保护国王',
    'alert.capture.title': '占领更多的塔',
    'alert.capture.hint': '从你的塔把部队拖到领地之外',
    'alert.upgrade.title': '升级一座塔',
    'alert.upgrade.hint': '单击一座塔查看升级选项',
    'alert.full.title': '有塔已经满了',
    'alert.full.hint': '拖走部队，为新的单位腾出空间',
    'alert.overflow.title': '有塔正在溢出',
    'alert.overflow.hint': '拖走多余部队，否则它们会消失',
    'alert.zombies.title': '发现僵尸',
    'alert.zombies.hint': '朝反方向移动来摆脱它们',
    'alert.kingDead': '你的国王阵亡了！',

    // ---------------- 死亡原因 ----------------
    'death.default': '你的国王阵亡了！',
    'death.byZombies': '国王被僵尸杀死了！',
    'death.byPlayer': '国王被 {player} 的 {unit} 杀死了！',
    'death.byPlayerNoUnit': '国王被 {player} 杀死了！',
    'death.someone': '某人',
    'death.zombies': '僵尸',

    // ---------------- 塔菜单 ----------------
    'menu.upgrading': '升级中… {seconds} 秒',
    'menu.upgradeTo': '升级为 {tower}',
    'menu.downgradeTo': '降级为 {tower}',
    'menu.cancelSupply': '取消补给线',
    'menu.hintMobile': '拖动可以派兵。先选中再拖动可建立补给线。',
    'menu.hintStatic': '拖动可以派兵。',
    'menu.unowned': '无主',
    'menu.requestAlly': '请求结盟',
    'menu.acceptAlly': '接受结盟',
    'menu.breakAlly': '解除结盟',

    // ---------------- 引擎错误 ----------------
    'err.sourceNotOwned': '出发塔不属于你',
    'err.emptyForce': '没有可派出的部队',
    'err.pathTooShort': '路径太短',
    'err.pathTooLong': '路径太长',
    'err.sourceMismatch': '出发塔不匹配',
    'err.duplicateTower': '路径中有重复的塔',
    'err.edgeTooLong': '道路连接太远',
    'err.notNeighbor': '两座塔之间没有道路',
    'err.notGenerated': '目标塔不存在',
    'err.invalidSupply': '这座塔无法建立补给线',
    'err.noTower': '塔不存在',
    'err.notOwned': '这座塔不属于你',
    'err.upgradePending': '升级尚未完成',
    'err.badType': '无效的塔类型',
    'err.prereq': '缺少前置条件',
    'err.invalidUpgrade': '无法这样升级',

    // ---------------- 帮助 ----------------
    'help.title': '帮助',
    'help.body': `
<p>Kiomet 是一款即时战略游戏：把部队派往各座塔来占领它们，扩张你的领地。</p>
<h3>如何游玩</h3>
<p>拖动部队占领塔。要升级一座塔，先单击它，再单击可用的升级。每个升级旁会列出它的前置条件。</p>
<h3>如何获胜</h3>
<p>占领塔并尽可能久地守住它们来获得分数。保护好你的国王 —— 失去国王就等于输掉本局。
地堡或总部能承受几枚核弹。</p>
<h3>补给线</h3>
<p>会产出单位的塔可以自动送兵。单击一座塔打开菜单，然后照常拖动；如果路径上出现移动的箭头，
说明补给线建立成功。按住 <b>R</b> 显示你全部的补给线。再画一次或按 <b>Shift+R</b> 可以删除。</p>
<h3>结盟</h3>
<p>选中其他玩家的塔，点击握手按钮即可请求或接受结盟。在解除结盟之前，双方都无法攻击对方。</p>
<h3>快捷键</h3>
<p><b>H</b> 找到国王 · <b>Q</b>/<b>E</b> 缩放 · <b>WASD</b> 或方向键平移 ·
<b>T</b> 标记同类塔 · <b>R</b> 补给线 · <b>B</b> 战争迷雾 ·
<b>空格</b> 暂停 · <b>Esc</b> 关闭面板。</p>`,

    // ---------------- 塔资料页 ----------------
    'towers.title': '塔',
    'towers.lead': '共 27 种塔。实线是升级路线，虚线是前置条件。',
    'towers.upgradesFrom': '由 {icon} <b>{tower}</b> 升级而来（{seconds} 秒）',
    'towers.upgradesFromReq': '由 {icon} <b>{tower}</b> 升级而来（{seconds} 秒），需要 {reqs}',
    'towers.foundOnMap': '可在地图上直接占领。',
    'towers.canContain': '最多容纳 {units}。',
    'towers.generates': '产出 {units}',
    'towers.generatesEvery': '{unit}（每 {seconds} 秒）',
    'towers.generatesNothing': '不产出单位',
    'towers.worth': '，价值 {points} 分。',
    'towers.sensor': '视野范围比 Mine 高 {percent}%。',
    'towers.projector': '可以沿道路派出护盾。',

    // ---------------- 单位资料页 ----------------
    'units.title': '单位',
    'units.lead': '共 10 种单位。它们大体按下面的顺序交战 —— 护盾永远最先承受伤害。',
    'units.producedBy': '由 {makers} 生产。',
    'units.damage': '造成 {surface} 点伤害。',
    'units.damageBoth': '对地面造成 {surface} 点伤害，对空中造成 {air} 点伤害。',
    'units.infinite': '无限',
    'units.speed.slow': '移动速度慢。',
    'units.speed.normal': '移动速度中等。',
    'units.speed.fast': '移动速度快。',
    'units.speed.shield': '不会移动。',
    'units.shieldSpecial': '除非由投射器派出，否则不会移动；被派出时移动很快。',
    'units.range.short': '射程短。',
    'units.range.medium': '射程中等。',
    'units.range.long': '射程长。',
    'units.weight': '对直升机而言重量为 {weight}。',
    'units.chopper': '可以搭载其它单位（重量 4）。',
    'units.emp': '使一座塔瘫痪 60 秒。',
    'units.overflow': '最多可以临时溢出 {count} 个。',
    'units.king': '使护盾上限提高 {boost}。一旦阵亡，你就输掉本局。',

    // ---------------- 名称：塔 ----------------
    'tower.Airfield': '机场',
    'tower.Armory': '军械库',
    'tower.Artillery': '炮兵阵地',
    'tower.Barracks': '兵营',
    'tower.Bunker': '地堡',
    'tower.Centrifuge': '离心机',
    'tower.City': '城市',
    'tower.Cliff': '悬崖',
    'tower.Ews': '预警机',
    'tower.Factory': '工厂',
    'tower.Generator': '发电机',
    'tower.Headquarters': '总部',
    'tower.Helipad': '直升机坪',
    'tower.Launcher': '发射装置',
    'tower.Mine': '矿场',
    'tower.Projector': '投射器',
    'tower.Quarry': '采石场',
    'tower.Radar': '雷达',
    'tower.Rampart': '壁垒',
    'tower.Reactor': '反应堆',
    'tower.Refinery': '炼油厂',
    'tower.Rocket': '火箭',
    'tower.Runway': '跑道',
    'tower.Satellite': '卫星',
    'tower.Silo': '发射井',
    'tower.Town': '城镇',
    'tower.Village': '村庄',

    // ---------------- 名称：单位 ----------------
    'unit.Shield': '护盾',
    'unit.Fighter': '战斗机',
    'unit.Chopper': '直升机',
    'unit.Bomber': '轰炸机',
    'unit.Tank': '坦克',
    'unit.Soldier': '步兵',
    'unit.Shell': '炮弹',
    'unit.Emp': '电磁脉冲弹',
    'unit.Nuke': '核弹',
    'unit.King': '国王',
};
