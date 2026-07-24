# 秘境花瓶

基于 Cocos Creator 3.8.6 的竖屏多花瓶搬运三消游戏。场上同时摆放 6 个花瓶，每个花瓶只展示最上面的 3 支花；玩家只能拖动最顶端的一支到其他花瓶。当目标花瓶顶部连续出现 3 支同款花时自动消除，随后露出下一层。

## 当前版本

- 30 个固定种子关卡，全部通过自动求解。
- 每关 6 个基础花瓶，后期可使用道具增加临时花瓶。
- 顶部 3 支预览、仅顶端可拖动、跨花瓶命中检测和回弹。
- 三朵同款自动消除、下一层揭示、连击、计分与星级。
- 倒计时、暂停、失败、重试和复活。
- 撤回、提示、加时、整理、魔法消除和增加花瓶 6 种道具。
- 首页、30 关选关、金币、星级和微信本地存档。
- 法式复古温室视觉主题，使用真实生成的位图美术，不再使用字符花朵。

## 美术资源

- `assets/resources/art/flowers`：15 种透明花材 PNG。
- `assets/resources/art/vases`：6 种透明陶瓷花瓶 PNG。
- `assets/resources/art/backgrounds/conservatory.png`：750×1334 温室背景。
- `art/source`：保留的生成图集与透明处理源文件。
- `tools/slice_generated_art.py`：可重复执行的图集切片工具。

最终美术由内置图像生成工具创建，方向为“法式复古植物图鉴、手绘水粉、古董陶瓷、温暖温室”。花材和花瓶先在纯色背景上生成，再进行透明背景处理与切片。

## 运行

1. 使用 Cocos Creator 3.8.6 打开本目录并等待首次资源导入完成。
2. 打开 `assets/scenes/Main.scene`。
3. 点击浏览器预览；设计分辨率为 750×1334。
4. 发布时在构建面板选择微信小游戏。

场景已经挂载 `FlowerGameApp`，无需手动绑定节点。图片通过 `resources.loadDir('art')` 预加载。

## 代码结构

- `assets/scripts/App.ts`：美术加载、页面、拖动、HUD 和结算。
- `assets/scripts/domain/ArrangementModel.ts`：花瓶栈、移动、消除、计时和道具。
- `assets/scripts/config/GameData.ts`：15 种花与 30 关配置。
- `assets/scripts/services`：存档与微信平台能力。
- `tests/domain-runner.cjs`：30 关自动求解测试。

规则层与 Cocos 节点相互独立，后续替换 PNG 不会改变关卡逻辑。
