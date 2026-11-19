<!--
  SPDX-FileCopyrightText: 2026 Kiomet clone contributors
  SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Kiomet（离线复刻）

一个可以离线玩、单文件运行的 **Kiomet** 复刻版。规则不是猜的——全部照
[Softbear 的开源仓库](https://github.com/SoftbearStudios/kiomet)（AGPL-3.0-or-later）逐条移植。

> Kiomet 与 Kiomet.com 是 Softbear, Inc. 的商标。本项目是非官方的个人复刻，
> 不用于商业用途，也不连接官方服务器。

## 直接玩

打开根目录的 `kiomet.html` 即可（双击、或手机浏览器里打开），不需要服务器、不需要联网。

- **拖动**自己的塔 → 目标塔：沿道路派兵，路过空塔会顺手占领
- **单击**塔：打开升级面板（会显示前置条件 `已有/需要`）
- 先**单击**再**拖动**：建立补给线，塔满了自动续兵
- `H` 找到国王，`Q`/`E` 缩放，`WASD`/右键拖拽平移，`Esc` 关闭面板
- 手机：单指拖拽，双指捏合缩放

## 玩法要点（与原版一致）

- 27 种塔、10 种单位，`src/data.js` 里的数值就是从原版 `common/src/tower.rs`、`unit.rs` 抄的
- 4Hz 逻辑帧；部队速度取最慢单位；choppers 可以携带坦克/步兵
- 战斗先结算空中单位再结算地面单位，护盾永远最先被消耗
- 国王不能补充，被打死就出局；他所在（及相邻）的塔产兵更快，但出兵也更慢
- 塔满后多余单位会绕塔一圈再消失；无主塔三十秒不占就降级

## 开发

```bash
node build.mjs              # 打包成单文件 kiomet.html
node --test test/engine.test.mjs   # 19 个规则回归测试
```

模块划分：

| 文件 | 内容 |
| --- | --- |
| `src/data.js` | 塔/单位数值表（原版宏注释的直译） |
| `src/geom.js` | 512×512 格子世界、FNV 抖动的道路连通性 |
| `src/rules.js` | 单位容器、战斗结算、部队移动 |
| `src/world.js` | 每帧模拟：生成/升级/派兵/补给线/占领/死亡 |
| `src/bot.js` | AI（参考原版 `server/src/bot.rs`） |
| `src/render.js` | Canvas 2D 绘制 |
| `src/glyphs.js` | 塔与单位的 SVG 字形（取自原版 `/towers`、`/units` 页面） |
| `src/app.js` | 输入、界面、帧循环 |

测试覆盖：塔表/降级链/前置条件、单位容器的“单发单位清空杂兵”、
战斗结算顺序、护盾不吃核弹的边界、部队速度与 chopper 载重、道路对称性、
出生流程、经济、升级门控、死亡与僵尸化、多段路径不会被“孤立”、补给线持续产出。

## 许可

AGPL-3.0-or-later，见 `LICENSE`。移植自 Softbear 的 `kiomet` 仓库，
其中的数值、规则与图形资源版权归 Softbear, Inc. 所有。
