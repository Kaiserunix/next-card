# Next Card 多模态动画 AI 验收待办

> 当前阶段不接真实多模态模型。本文件只定义后续要交给多模态模型检查的前端动画、截图证据和判定问题，方便和 Playwright 冒烟测试一起跑。

## 使用方式

1. 先用 Playwright 打开本地 demo，固定输入 `去高数课`。
2. 依次触发 input、deck、burning、freeze、reward、proof journal 等状态。
3. 对每个状态保存截图，必要时保存 2-4 秒短视频或连续帧。
4. 把截图/视频帧和本文件里的 AI 检查提示词交给多模态模型。
5. 模型只做视觉验收，不改代码；发现问题后再开独立修复任务。

## Playwright 采集待办

- [ ] `input-ready.png`：首次打开 app，确认三 tab 与 composer 可见。
- [ ] `analysis-plan-options.png`：提交 `去高数课` 后，确认 Plan Mode 分析和三方案可见。
- [ ] `task-flow-overview.png`：执行方案一后，确认任务流节点和时间压力标签可见。
- [ ] `deck-burning-card.png`：进入 deck 后，确认第一张 card 是 burning 状态且文字清晰。
- [ ] `deck-sparks-frame.png`：双击卡片后截取 sparks 出现的一帧。
- [ ] `deck-quick-burning-frame.png`：触发快速燃烧后截取 burn rail、边缘火光和主文字。
- [ ] `deck-status-bar.png`：下滑/按钮显示状态栏后，确认进度、时间状态、剩余时间可读。
- [ ] `deck-freeze-prompt.png`：触发冻结提示后，确认冰蓝视觉和按钮可读。
- [ ] `deck-resumed-frozen-card.png`：恢复冻结卡后，确认压力降级且卡片恢复 active。
- [ ] `reward-card.png`：完成整副 deck 后，确认 reward card 信息完整。
- [ ] `proof-dashboard.png`：进入 proof 后，确认统计卡、表格、图表可读。
- [ ] `proof-flow-journal.png`：滚动到 journal，确认时间线是 blog/editorial 风格而不是普通表格。

## 多模态模型通用提示词

```text
你是 Next Card 的视觉 QA。请只根据截图/视频帧判断界面状态，不要假设隐藏信息。

检查目标：
1. 当前画面是否符合 Next Card 的 card-based action companion 定位？
2. 是否看起来像 Todo list、后台 dashboard、营销 landing page 或单词卡应用？如果像，请指出原因。
3. 主要文字是否清晰可读，有没有被 burn、spark、freeze、crack 或 weathering 效果遮挡？
4. 时间 UI 是否在 task card 本体上，而不是只在页面其他区域？
5. burning/freeze/crack/weathering 是否表达状态反馈，而不是羞辱或失败惩罚？
6. 移动端尺寸下按钮、标签、进度条和卡片是否重叠或溢出？
7. 当前画面最需要修的一个视觉问题是什么？

输出格式：
- verdict: pass / needs-fix
- visible_state: input / plan / flow / deck / burning / freeze / reward / proof
- issues: 用短 bullet 列出
- suggested_fix: 一句话说明最小修复方向
```

## 状态专项检查

### Burning Card

```text
请检查这张 burning task card：
- burn rail、火光、sparks 是否明显但不遮挡标题、动作说明和时间 UI？
- urgency stage、estimated minutes、remaining/window 是否都能在卡片上看见？
- 卡片是否仍然像一个可执行 action，而不是失败惩罚画面？
- 色彩是否过度橙/棕，导致界面一眼变成单色主题？
```

### Freeze Prompt

```text
请检查冻结提示：
- 冰蓝视觉是否能表达“暂停并保存上下文”？
- `你还想继续完成这个任务吗？`、`继续完成`、`先冻结` 是否清晰？
- freeze 效果是否温和，没有让用户感觉失败或被责备？
- 背景和卡片层级是否清楚？
```

### Swipe / Status Bar

```text
请检查单卡执行画面：
- 状态栏是否显示 deck 名、完成百分比、已完成/剩余数量、当前节点、时间状态、elapsed/remaining？
- 主卡是否仍然是视觉焦点？
- 控件是否像移动端可触控按钮，而不是密集后台工具？
```

### Reward Card

```text
请检查 reward card：
- 是否强调“目标变成证据”，而不是泛泛 XP 或游戏积分？
- completed nodes、actual time、completed count、time performance、next suggestion 是否可读？
- 奖励视觉是否温暖但克制？
```

### Proof Journal

```text
请检查 proof flow journal：
- 时间线是否像可读叙事日志，而不是 Excel 表？
- 每条 entry 是否能看出 time、goal、action、urgency/time status、actual time 或 next suggestion？
- 表格、图表、journal 三者是否互补，而不是重复堆叠？
```

## 自动化扩展待办

- [ ] 在 `tests/e2e` 增加截图采集 spec，但默认不并入 `pnpm test`，避免视觉迭代时阻塞后端测试。
- [ ] 给关键组件补充稳定 `aria-label` 或 `data-testid`，只用于状态采集，不绑定样式结构。
- [ ] 为 desktop 与 mobile viewport 各采一组截图。
- [ ] 将多模态模型输出保存为 `test-results/visual-ai/*.json`。
- [ ] 后续接入真实多模态模型时，输出只作为 QA 报告，不自动改代码。

## 不在本轮做

- 不接真实 OpenAI API 或其他视觉模型。
- 不做像素级截图 diff。
- 不测试复杂动画轨迹物理精度。
- 不把视觉 AI 检查接进默认 CI。
