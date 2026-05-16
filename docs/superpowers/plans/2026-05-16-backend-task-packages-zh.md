# Next Card 后端测试与任务包拆分计划

> **给执行同事/agentic workers：** 如果要按本计划执行，建议使用 `subagent-driven-development` 或 `executing-plans`，逐包推进。每个任务包都应该先写测试，再实现或修正行为，最后跑验证命令。

**目标：** 在不接真实 OCR、OpenAI API、云后端、登录、日历和通知的前提下，把 Next Card 当前“本地后端”测稳，并补齐下一阶段必须的后端行为。

**当前架构判断：** 这个 MVP 目前没有真实 API server。现阶段所谓“后端”主要是本地业务层：`lib/mock-ai.ts`、`store/useNextCardStore.ts`、Zustand 持久化、proof 记录、时间状态、冻结/恢复队列，以及未来真实服务接入边界。UI 已经交给同事后，后端同事应优先保障这些业务规则可测试、可回归、可接真实服务。

**技术栈：** Next.js App Router、TypeScript、Zustand、localStorage、Vitest、Playwright、GitHub Actions。

---

## 一、当前后端边界

### 1. Mock AI 业务层

负责文件：

```text
lib/mock-ai.ts
lib/types.ts
```

负责能力：

- 输入理解：一句话目标、作业通知、课表文本、模拟图片课表。
- 三方案生成：方案一 urgent、方案二 balanced、方案三 gentle。
- 任务流生成。
- deck 和 task card 生成。
- card 时间计划和 urgency 计算。
- 冻结卡片重排。
- proof summary 生成。

### 2. Zustand 状态机

负责文件：

```text
store/useNextCardStore.ts
```

负责能力：

- input / deck / proof 三个模式状态。
- 输入、分析、方案、任务流、deck、proof 的状态流转。
- 双击计时、三击燃烧、左右滑完成、冻结、奖励卡。
- localStorage 持久化。

### 3. 页面契约与未来接入点

负责文件：

```text
lib/page-contracts.ts
lib/webview-contract.ts
README.md
```

负责能力：

- 标明 input / deck / proof 的读写边界。
- 标明 Android WebView 对 localStorage、静态导出、安全区的要求。
- 标明未来 OCR、OpenAI、后端、提醒、日历的接入位置。

---

## 二、任务包总览

| 包 | 名称 | 优先级 | 可并行 | 主要产出 |
|---|---|---:|---|---|
| A | 测试基建包 | P0 | 否 | Vitest、测试脚本、setup |
| B | Mock AI 合同测试包 | P0 | A 后可做 | 锁定 mock planning / deck / urgency |
| C | Store 测试工具包 | P0 | A 后可做 | reset/helper/common flow |
| D | Planning 状态机测试包 | P0 | C 后可做 | input -> analysis -> plan -> deck |
| E | Deck 行为状态机测试包 | P0 | C 后可做 | timing / burning / complete / freeze / reward |
| F | localStorage 持久化测试包 | P1 | C 后可做 | 刷新保留 decks/proofs/queues |
| G | 时间引擎包 | P1 | B 后可做 | 可测试的 card time refresh |
| H | 冻结恢复队列包 | P1 | G 后可做 | resume frozen card |
| I | Proof 语义收敛包 | P1 | D/E 后可做 | 事件语义和汇总规则 |
| J | Playwright 冒烟包 | P2 | UI selector 稳定后 | 端到端主链路测试 |
| K | CI 包 | P1 | A-F 后可做 | GitHub Actions |
| L | 真实后端扩展边界包 | P2 | 任意时刻 | 后端/OCR/OpenAI 接入文档 |

---

## 任务包 A：测试基建包

**目标：** 给项目加上可跑的单元测试环境，让后续后端任务都能 TDD。

**优先级：** P0

**依赖：** 无

**涉及文件：**

```text
package.json
pnpm-lock.yaml
vitest.config.ts
tests/setup.ts
```

**具体任务：**

- 安装 `vitest` 和 `jsdom`。
- 新增脚本：

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- 新增 `vitest.config.ts`，配置 `@` alias 指向项目根目录。
- 新增 `tests/setup.ts`，每个测试后清理 `localStorage`、mock timer、spy。

**验收标准：**

- `pnpm test` 可以正常启动。
- 测试环境能解析 `@/lib/...` 和 `@/store/...`。
- jsdom 里可以使用 `localStorage`。

**验证命令：**

```bash
pnpm test
pnpm lint
```

**建议提交：**

```bash
git commit -m "test: add vitest foundation"
```

---

## 任务包 B：Mock AI 合同测试包

**目标：** 锁定 mock AI 的稳定输出，避免 UI 调整或真实服务接入前把核心产品规则改坏。

**优先级：** P0

**依赖：** 任务包 A

**涉及文件：**

```text
lib/mock-ai.ts
lib/types.ts
tests/lib/mock-ai.test.ts
```

**需要测试的函数：**

```text
mockAnalyzeInput
mockGeneratePlanOptions
mockRegeneratePlanOptions
mockGenerateTaskFlow
mockGenerateDeckFromPlan
mockGenerateTimePlanForCard
mockUpdateCardUrgency
mockRescheduleFrozenCard
mockGenerateProofSummary
```

**具体测试场景：**

- 输入 `去高数课` 时：
  - 识别为课程/到课目标。
  - 输出包含时间约束。
  - deck 名称为 `去高数课`。
  - deck icon 为 `course`。
  - 第一张卡是 near-deadline / burning demo。

- 输入作业通知时：
  - 识别为 assignment。
  - deadline 文案为 `今晚 20:00 前`。
  - 方案优先保护最低可提交版本。

- 输入没有明确时间时：
  - 不允许时间为空。
  - 应生成温和默认时间建议。

- 三方案生成：
  - 必须且只能有 3 个选项。
  - id 必须是 `plan-1`、`plan-2`、`plan-3`。
  - style 必须是 `urgent`、`balanced`、`gentle`。

- 重新生成：
  - 保留原始输入。
  - `regenerate` 后文案要变化。

- urgency 阈值：
  - 大于 20 分钟：`calm`。
  - 20 到 10 分钟：`hot`。
  - 3 分钟内：`burning`。
  - 超时：`expired` + `crack`。

- 冻结重排：
  - status 变为 `frozen`。
  - damageEffect 变为 `freeze`。
  - suggestedStartAt 往后推。
  - cardBackNote 保留上下文。

**验收标准：**

- `tests/lib/mock-ai.test.ts` 覆盖以上场景。
- mock AI 输出保持稳定。
- 不接任何真实 API。

**验证命令：**

```bash
pnpm test tests/lib/mock-ai.test.ts
```

**建议提交：**

```bash
git commit -m "test: cover mock ai planning contract"
```

---

## 任务包 C：Store 测试工具包

**目标：** 给 Zustand store 测试准备统一 reset 和常用流程 helper，避免每个测试重复写 setup。

**优先级：** P0

**依赖：** 任务包 A

**涉及文件：**

```text
store/useNextCardStore.ts
tests/helpers/nextCardStore.ts
```

**需要提供的 helper：**

```text
resetNextCardStore()
generateCourseDeckInStore()
getActiveCard()
```

**具体任务：**

- `resetNextCardStore()`：
  - 清理 localStorage。
  - 重置 mode 为 `input`。
  - 重置 inputs、analysis、plans、taskFlow、deck、proofs。

- `generateCourseDeckInStore()`：
  - 写入输入 `去高数课`。
  - 调用 `analyzeInput()`。
  - 调用 `finishAnalysis()`。
  - 调用 `selectPlan("plan-1")`。
  - 返回 active deck。

- `getActiveCard()`：
  - 从 activeDeckId 和 currentCardId 找到当前卡。
  - 如果没有 active deck/card，直接抛错，避免测试静默失败。

**验收标准：**

- 后续 store 测试都复用 helper。
- helper 不依赖 UI。
- helper 不引入真实时间不确定性；需要时由测试自己设置 fake timer。

**验证命令：**

```bash
pnpm test
```

**建议提交：**

```bash
git commit -m "test: add next card store helpers"
```

---

## 任务包 D：Planning 状态机测试包

**目标：** 测住从 input 到 plan selection 的后端状态流转。

**优先级：** P0

**依赖：** 任务包 C

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/planning-flow.test.ts
```

**需要测试的 action：**

```text
setInputText
addMockAttachment
addMockImageSchedule
analyzeInput
finishAnalysis
regeneratePlans
selectPlan
```

**具体测试场景：**

- 设置文本输入后：
  - `inputs.text` 正确。
  - `sourceType` 正确。

- 添加 mock attachment 后：
  - `attachments` 增加。
  - `parsedText` 拼入 mock 作业通知。
  - `sourceType` 是 `attachment` 或 `mixed`。

- 添加 mock image schedule 后：
  - `imageSchedule` 不为空。
  - `parsedText` 拼入课表识别结果。
  - `sourceType` 是 `image` 或 `mixed`。

- `analyzeInput()` 后：
  - `analysisStatus` 为 `analyzing`。
  - `analysis` 有内容。
  - 还没有 plan options。

- `finishAnalysis()` 后：
  - `analysisStatus` 为 `ready`。
  - plan options 刚好 3 个。

- `regeneratePlans()` 后：
  - 保留原始 input。
  - options 仍然 3 个。
  - `regenerateCount` 增加。

- `selectPlan("plan-1")` 后：
  - 生成 taskFlow。
  - 生成 deck。
  - activeDeckId 和 currentCardId 正确。
  - 写入第一条 proof record。

- 无效 plan id：
  - 不应生成 deck。
  - 不应写 proof。

**验收标准：**

- store planning 流程不依赖 UI。
- plan 选择后生成的数据结构符合 `lib/types.ts`。
- `去高数课` 场景稳定通过。

**验证命令：**

```bash
pnpm test tests/store/planning-flow.test.ts
```

**建议提交：**

```bash
git commit -m "test: cover planning store flow"
```

---

## 任务包 E：Deck 行为状态机测试包

**目标：** 测住 deck 核心执行行为：计时、燃烧、完成、冻结、奖励。

**优先级：** P0

**依赖：** 任务包 C

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/deck-actions.test.ts
```

**需要测试的 action：**

```text
openDeck
startFocusTiming
startQuickBurning
completeCurrentCard
freezeCurrentCard
continueCurrentCard
```

**具体测试场景：**

- `openDeck(deckId)`：
  - mode 切到 `deck`。
  - activeDeckId 正确。
  - currentCardId 指向 active card。

- 双击计时，对应 store action `startFocusTiming()`：
  - activeTimeMode 变为 `timing`。
  - 当前卡 startedAt 写入。
  - proof 写入“开始计时”事件。

- 三击燃烧，对应 `startQuickBurning()`：
  - activeTimeMode 变为 `burning`。
  - 当前卡 urgencyStage 变为 `burning`。
  - damageEffect 变为 `burn`。
  - burnLevel 变为 3。
  - proof 写入燃烧事件。

- 左/右滑完成，对应 `completeCurrentCard("left" | "right")`：
  - 当前卡 status 变为 `completed`。
  - completedCardIds 增加。
  - deck.completedCards 增加。
  - currentCardId 前进到下一张 queued card。
  - proof 写入完成事件和 actualMinutes。

- 冻结，对应 `freezeCurrentCard()`：
  - 当前卡 status 变为 `frozen`。
  - damageEffect 变为 `freeze`。
  - frozenCardIds 增加。
  - rescheduleQueue 增加。
  - proof 写入 `frozen-rescheduled`。

- 完成整副 deck：
  - deckStatus 变为 `completed`。
  - rewardCards 增加。
  - proof 写入 `rewarded`。

**验收标准：**

- Deck 单卡执行闭环可测试。
- 不出现 Todo-list 式状态跳转。
- 完成、冻结、燃烧都写 proof。

**验证命令：**

```bash
pnpm test tests/store/deck-actions.test.ts
```

**建议提交：**

```bash
git commit -m "test: cover deck action state machine"
```

---

## 任务包 F：localStorage 持久化测试包

**目标：** 确认刷新页面后关键业务状态仍能恢复。

**优先级：** P1

**依赖：** 任务包 C、D、E

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/persistence.test.ts
```

**需要验证的持久化 key：**

```text
next-card-mvp
```

**具体测试场景：**

- 生成 deck 后，localStorage 保存：
  - inputs。
  - analysis。
  - plans。
  - taskFlow。
  - deck。
  - proofs。

- 不应把 UI-only 的 mode 当作权威后端状态保存。

- 冻结后，localStorage 保存：
  - frozenCardIds。
  - rescheduleQueue。
  - proofs.records。

- 完成后，localStorage 保存：
  - completedCardIds。
  - deck.completedCards。
  - rewardCards。

**验收标准：**

- `partialize` 的保存范围符合产品需求。
- 刷新后历史 deck、proof、冻结队列可恢复。
- Android WebView 只需要开启 DOM storage 即可保留状态。

**验证命令：**

```bash
pnpm test tests/store/persistence.test.ts
```

**建议提交：**

```bash
git commit -m "test: cover persisted next card state"
```

---

## 任务包 G：Card Time Engine 时间引擎包

**目标：** 把 card urgency 刷新逻辑抽成可测试业务函数，给刷新、恢复、未来提醒服务复用。

**优先级：** P1

**依赖：** 任务包 B

**涉及文件：**

```text
lib/card-time-engine.ts
tests/lib/card-time-engine.test.ts
store/useNextCardStore.ts
```

**建议新增函数：**

```text
refreshCardTimeState(card, now)
refreshDeckTimeState(deck, now)
```

**业务规则：**

- `queued` 和 `active` 卡片可以刷新 urgency。
- `completed`、`frozen`、`rewarded`、`needs-review` 不应被时间刷新破坏。
- deadline 过期后：
  - urgencyStage 为 `expired`。
  - damageEffect 为 `crack`。
  - remainingSeconds 为 0。

**Store 需要新增 action：**

```text
refreshActiveDeckTime(nowIso?)
```

**具体测试场景：**

- 当前时间距 deadline 15 分钟：card 进入 `hot`。
- 当前时间距 deadline 2 分钟：card 进入 `burning`。
- 当前时间晚于 deadline：card 进入 `expired`。
- frozen card 不被刷新成 crack。
- active deck 刷新不应写一堆 noisy proof records。

**验收标准：**

- 时间逻辑不再只散落在 UI 或 mock 函数里。
- 打开 deck / 刷新页面 / 未来 native reminder 都可以复用同一个时间引擎。

**验证命令：**

```bash
pnpm test tests/lib/card-time-engine.test.ts
pnpm test tests/store/time-and-reschedule.test.ts
```

**建议提交：**

```bash
git commit -m "feat: add card time refresh engine"
```

---

## 任务包 H：冻结恢复队列包

**目标：** 补齐 `rescheduleQueue` 的真实后端行为：冻结后不仅记录，还能恢复。

**优先级：** P1

**依赖：** 任务包 E、G

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/time-and-reschedule.test.ts
```

**当前问题：**

- `freezeCurrentCard()` 已经把 card id 放入 `rescheduleQueue`。
- 但还没有恢复 frozen card 的 store action。
- README 也把 resume screen / reschedule queue 列为下一步。

**建议新增 action：**

```text
resumeFrozenCard(cardId: string)
```

**业务规则：**

- 只有 status 为 `frozen` 的卡可以恢复。
- 恢复后：
  - status 变为 `active`。
  - damageEffect 清回 `none`。
  - urgencyStage 变为 `warm` 或通过时间引擎重算。
  - 从 `rescheduleQueue` 移除。
  - 从 `frozenCardIds` 移除。
  - currentCardId 指向恢复卡。
  - activeDeckId 指向对应 deck。
  - proof 写入“从 reschedule queue 恢复冻结卡”。

- 恢复某张 frozen card 时，原 active card 应退回 `queued`，避免一副 deck 同时多个 active card。

**验收标准：**

- 冻结卡可恢复。
- 不需要重新分析原始输入。
- proof 有恢复事件。
- 无效 cardId 不改变状态。

**验证命令：**

```bash
pnpm test tests/store/time-and-reschedule.test.ts
```

**建议提交：**

```bash
git commit -m "feat: resume frozen cards from reschedule queue"
```

---

## 任务包 I：Proof 语义收敛包

**目标：** 明确 proof 是“行动证据”，避免把“生成计划”“开始燃烧”“完成卡片”“完成目标”混成同一种状态。

**优先级：** P1

**依赖：** 任务包 D、E

**涉及文件：**

```text
store/useNextCardStore.ts
lib/mock-ai.ts
tests/store/proof-semantics.test.ts
```

**需要收敛的语义：**

- `selectPlan`：
  - 应记录 `in-progress`。
  - 不应算 completed。
  - 不应提前写成 `burning-completed`。

- `startFocusTiming`：
  - 是 timing event。
  - 不增加 completedCards。

- `startQuickBurning`：
  - 是 burn event。
  - 可以记录 lastDamageEffect 为 `burn`。
  - 不增加 completedCards。

- `completeCurrentCard`：
  - 是 card completion event。
  - 增加 completedCards。
  - 记录 actualMinutes。

- 全 deck 完成：
  - 额外写 reward record。
  - progress 为 100。
  - rewardCards 增加。

- `freezeCurrentCard`：
  - status 为 `frozen`。
  - timeStatus 为 `frozen-rescheduled`。
  - frozenCards 增加。

**建议后续重构方向：**

如果 proof 继续复杂化，可以拆成两层：

```text
ProofEvent      # 每一次动作日志
ProofAggregate  # 每个目标/Deck 的当前汇总状态
```

MVP 当前可以先不重构类型，但测试必须先锁语义。

**验收标准：**

- proof 表格、journal、summary 的数据含义一致。
- burning demo 不被误判为已经 burning-completed。
- 奖励只在 deck 完成后出现。

**验证命令：**

```bash
pnpm test tests/store/proof-semantics.test.ts
pnpm test tests/store/deck-actions.test.ts
```

**建议提交：**

```bash
git commit -m "test: lock proof event semantics"
```

---

## 任务包 J：Playwright MVP 冒烟包

**目标：** 在 UI selector 稳定后，用最少端到端测试覆盖核心 demo 链路。

**优先级：** P2

**依赖：** UI selector 稳定，任务包 A-D 基本完成

**涉及文件：**

```text
playwright.config.ts
tests/e2e/mvp-flow.spec.ts
components/input/InputComposer.tsx
components/deck/SwipeTaskCard.tsx
components/proof/ProofDashboard.tsx
```

**推荐只测一条主链路：**

```text
打开 app
-> input tab
-> 输入 去高数课
-> 生成执行方案
-> 执行方案一
-> 看到任务流
-> 进入 deck
-> 看到 去高数课 deck
-> 打开 deck
-> 看到第一张 burning card
-> 完成一张卡
-> 进入 proof
-> 看到 proof 记录
```

**注意事项：**

- Playwright 不要测太多动画细节。
- 优先用 role、label、button name。
- 如果当前 UI 缺 accessible name，最小增补 `aria-label`。
- 不要用脆弱 CSS selector。

**验收标准：**

- `pnpm test:e2e` 能通过一个 mobile-chrome 项目。
- 不因微小 UI 文案变动频繁失败。

**验证命令：**

```bash
pnpm test:e2e
```

**建议提交：**

```bash
git commit -m "test: add mvp browser smoke flow"
```

---

## 任务包 K：CI 包

**目标：** 给后端测试建立自动回归门禁。

**优先级：** P1

**依赖：** 至少任务包 A-F

**涉及文件：**

```text
.github/workflows/ci.yml
README.md
```

**CI 应运行：**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

**建议暂不把 Playwright 放进默认 CI：**

原因：

- 当前 UI 还在同事手里。
- 动画和 selector 可能还会变。
- 先把单元测试和 store 测试作为稳定门禁。

等 UI 稳定后再加：

```bash
pnpm test:e2e
```

**验收标准：**

- PR 和 main push 都会跑 CI。
- lint/test/build 任一失败则 CI 失败。

**验证命令：**

```bash
pnpm lint
pnpm test
pnpm build
```

**建议提交：**

```bash
git commit -m "ci: verify lint tests and build"
```

---

## 任务包 L：真实后端扩展边界包

**目标：** 明确什么时候、从哪里接真实服务，避免现在过早引入后端复杂度。

**优先级：** P2

**依赖：** 无，可与其他包并行

**涉及文件：**

```text
docs/backend-extension-boundaries.md
README.md
lib/page-contracts.ts
```

**需要写清的接入边界：**

### 1. OpenAI / Planning API

当前替代：

```text
lib/mock-ai.ts
```

未来真实接口必须返回现有类型：

```text
AnalysisResult
PlanOption[]
TaskFlowState
TaskDeck
```

不能让 UI 直接依赖真实 API 原始响应。

### 2. OCR API

当前替代：

```text
InputsState.imageSchedule
InputsState.parsedText
```

未来真实 OCR 只应该填充：

```text
UploadedImage.parsedTimetable
inputs.parsedText
```

不要新增第四个主页面。

### 3. Backend Persistence

当前替代：

```text
localStorage key: next-card-mvp
```

未来后端同步对象：

```text
inputs
taskFlow
deck
proofs
```

不要把纯 UI 状态当成服务端权威状态。

### 4. Reminder / Calendar

当前替代：

```text
deadlineAt
suggestedStartAt
rescheduleQueue
```

未来 native / backend 只应从 card 时间字段生成提醒。

### 5. Proof Export

当前替代：

```text
proofs.records
proofs.summaryDocument
```

未来可以做 Markdown / PDF / 云端归档。

**验收标准：**

- README 链接边界文档。
- page contracts backlog 里提醒先看边界文档。
- 后端同事知道哪些 mock 可以替换，哪些产品规则不能绕过。

**验证命令：**

```bash
pnpm lint
pnpm build
```

**建议提交：**

```bash
git commit -m "docs: define backend extension boundaries"
```

---

## 三、推荐执行顺序

### 第一阶段：先把测试跑起来

```text
A 测试基建包
B Mock AI 合同测试包
C Store 测试工具包
```

这一阶段完成后，后端同事已经可以稳定写业务测试。

### 第二阶段：锁住当前 MVP 主链路

```text
D Planning 状态机测试包
E Deck 行为状态机测试包
F localStorage 持久化测试包
```

这一阶段完成后，input -> deck -> proof 的业务闭环基本可回归。

### 第三阶段：补后端缺口

```text
G Card Time Engine 时间引擎包
H 冻结恢复队列包
I Proof 语义收敛包
```

这一阶段完成后，真正的后端行为开始成型，而不是只有 mock demo。

### 第四阶段：工程化和接入边界

```text
K CI 包
J Playwright MVP 冒烟包
L 真实后端扩展边界包
```

Playwright 建议等 UI 同事的 selector 稳定后再做；CI 可以先只跑 lint/test/build。

---

## 四、可以并行分派的工作

### 后端同事 1：测试基础和 mock AI

负责：

```text
A 测试基建包
B Mock AI 合同测试包
```

### 后端同事 2：Store 主状态机

负责：

```text
C Store 测试工具包
D Planning 状态机测试包
E Deck 行为状态机测试包
```

### 后端同事 3：时间、冻结、proof

负责：

```text
G Card Time Engine 时间引擎包
H 冻结恢复队列包
I Proof 语义收敛包
```

注意：同事 3 最好等 C/E 的 helper 和 deck 测试框架完成后再开始实现。

### 工程化同事

负责：

```text
F localStorage 持久化测试包
K CI 包
L 真实后端扩展边界包
```

### UI/QA 同事

负责：

```text
J Playwright MVP 冒烟包
```

注意：这个包依赖 UI selector 稳定。

---

## 五、当前不要做的事

这些不是当前阶段后端任务：

- 接真实 OCR。
- 接真实 OpenAI API。
- 搭真实数据库。
- 做登录。
- 做日历同步。
- 做推送通知。
- 做 Android 原生 WebView bridge。
- 重构成多路由后台管理系统。

这些都要等本地后端状态机和 proof 语义稳定后再接。

---

## 六、全量验收命令

每个阶段结束都跑：

```bash
pnpm lint
pnpm test
pnpm build
```

UI selector 稳定后额外跑：

```bash
pnpm test:e2e
```

---

## 七、最终交付标准

后端同事完成这些任务包后，项目应达到：

- 有稳定测试脚本。
- mock AI 输出受测试保护。
- store 状态机受测试保护。
- deck 完成/冻结/燃烧/奖励有 proof 回归测试。
- localStorage 持久化受测试保护。
- card urgency 有统一时间引擎。
- frozen card 可以恢复。
- proof 事件语义清晰。
- CI 自动跑 lint/test/build。
- 真实 OCR/OpenAI/backend/calendar/reminder 的接入边界明确。
