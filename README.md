# 秘境花瓶（FlowerClear）

基于 Cocos Creator 3.8.6 的竖屏多花瓶搬运消除游戏，适配浏览器、Web Mobile 和微信小游戏。玩家将花瓶顶部可操作的花拖入任意有效目标花瓶；当同一花瓶中组成 3 支同款花时自动消除，并按真实层级露出下一层花。

## 当前版本

- 60 个固定种子渐进关卡，包含 12 个章节。
- 关卡使用 3、7、8 或 9 个花瓶；7—9 个花瓶统一按最多 3 列、3 行布局。
- 顶部最多 3 支花可见；下一层存在花朵时显示虚影，空层不显示虚影。
- 支持直接跨越中间花瓶拖到远端目标，松手后才执行目标判定；无效放置自动回弹。
- 三朵同款自动消除、下一层揭示、连击、计分与星级。
- 倒计时、暂停、失败、重试和复活。
- 提示、加时和魔法消除道具，包含无可用操作时的安全恢复逻辑。
- 首页、60 关选关、金币、星级和微信本地存档。
- 首页提供七日签到、转发好友和花艺商城入口；签到奖励按本地自然日保存，可选择观看激励视频领取双倍花币。
- 首页左上角显示花币余额及“+”入口，点击后可通过视频补给获得 20 花币；设置入口位于右上角。
- 花艺商城可使用花币购买加时、随机消除和打乱道具；关卡中优先消耗库存，库存为零时才显示视频入口。
- 当天未签到时，首次进入游戏以及从游戏流程返回首页会自动打开签到弹窗；从选关页返回首页不会重复弹出。
- 微信小游戏通过 `wx.shareAppMessage` 转发好友，并通过 `wx.showShareMenu` 与 `wx.onShareTimeline` 开启朋友圈分享。
- 背景音乐采用花园氛围循环曲，并在浏览器首次触摸或点击后立即恢复播放。
- 法式复古温室视觉主题，使用真实生成的位图美术，不再使用字符花朵。

## 美术资源

- `assets/resources/art/flowers`：20 种透明花材 PNG。
- `assets/resources/art/vases`：6 种透明陶瓷花瓶 PNG。
- `assets/resources/art/backgrounds/conservatory.png`：750×1334 温室背景。
- `assets/resources/audio/garden_bgm.wav`：花园氛围循环背景音乐。
- `assets/resources/art/ui/home_*.png`：签到和转发好友等首页图标。
- `assets/resources/art/ui/share_friend_cover.png`：微信好友及朋友圈分享封面（1000×800）。
- `art/source`：保留的生成图集与透明处理源文件。
- `tools/slice_generated_art.py`：可重复执行的图集切片工具。
- `tools/generate-garden-bgm.cjs`：背景音乐生成工具。

最终美术由内置图像生成工具创建，方向为“法式复古植物图鉴、手绘水粉、古董陶瓷、温暖温室”。花材和花瓶先在纯色背景上生成，再进行透明背景处理与切片。

## 运行

1. 使用 Cocos Creator 3.8.6（或同系列 3.8.x）打开本目录并等待首次资源导入完成。
2. 打开 `assets/scenes/Main.scene`。
3. 点击浏览器预览；设计分辨率为 750×1334。
4. 发布时在构建面板选择 `Web Mobile` 或 `微信小游戏`。

场景已经挂载 `FlowerGameApp`，无需手动绑定节点。图片通过 `resources.loadDir('art')` 预加载。

浏览器和小游戏均存在音频自动播放限制，背景音乐会在资源加载完成且玩家第一次触摸或点击后播放。拖放基于 Cocos 节点触摸事件与全局输入结束事件处理，确保手指移出原节点后仍可正确完成放置。

## 代码结构

- `assets/scripts/App.ts`：美术加载、页面、拖动、HUD 和结算。
- `assets/scripts/board/BoardLayout.ts`：花瓶三列布局和花朵视觉槽位。
- `assets/scripts/domain/ArrangementModel.ts`：花瓶栈、移动、消除、计时和道具。
- `assets/scripts/config/FlowerData.ts`：20 种花材及资源映射。
- `assets/scripts/config/LevelData.ts`：60 关进度、花瓶数量、锁定条件和道具配置。
- `assets/scripts/config/GameData.ts`：花材与关卡配置的统一导出入口。
- `assets/scripts/services/AudioService.ts`：音乐、音效和浏览器手势解锁。
- `assets/scripts/services/PlatformService.ts`：微信平台能力与振动适配。
- `assets/scripts/services/SaveService.ts`：本地存档与七日签到状态。
- `tests/domain-runner.cjs`：60 关、分层花瓶、连续消除、死锁恢复和布局测试。

规则层与 Cocos 节点相互独立，后续替换 PNG 不会改变关卡逻辑。

## 验证

```bash
npm run test:domain
```

提交前还应分别完成 Cocos Creator 的 Web Mobile 与微信小游戏构建，并在对应预览环境验证：

- 花朵能够直接拖入同一行任意有效花瓶。
- 经过中间花瓶时不会提前放置。
- 目标无效时花朵回弹，原花瓶内容不会重复或补回。
- 仅在下一层真实存在花朵时显示虚影。
- 首次交互后背景音乐正常播放，设置中的音乐开关能够暂停和恢复。
- 签到当天只能领取一次，刷新或重新进入后状态和花币保持一致；勾选视频选项后领取按钮显示视频标识并发放双倍奖励。
- 微信好友按钮能唤起转发，右上角菜单仍支持朋友圈分享。
- 商城扣除花币后正确增加道具库存；关卡内有库存时显示次数并直接使用，库存为零时显示视频标识。
