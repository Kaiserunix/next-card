# 任务包 J：Playwright MVP 冒烟包

> **执行要求：** 等 UI selector 基本稳定后再做。本包只覆盖一条主链路，不测试大量动画细节。

**目标：** 用 Playwright 给 demo 主链路加一个最小端到端冒烟测试。

**优先级：** P2

**依赖：** UI selector 稳定；任务包 A-D 基本完成

**涉及文件：**

```text
playwright.config.ts
tests/e2e/mvp-flow.spec.ts
components/input/InputComposer.tsx
components/deck/SwipeTaskCard.tsx
components/proof/ProofDashboard.tsx
```

## 推荐测试主链路

```text
打开 app
-> input tab
-> 输入 去高数课
-> 点击 生成执行方案
-> 看到三方案
-> 点击 执行方案一
-> 看到任务流
-> 进入 deck
-> 看到 去高数课 deck
-> 打开 deck
-> 看到第一张 burning card
-> 完成一张卡
-> 进入 proof
-> 看到 proof 记录
```

## selector 原则

- 优先使用 role、label、button name。
- 避免使用脆弱 CSS selector。
- 如果当前 UI 缺 accessible name，只做最小补充：

```tsx
aria-label="目标输入"
aria-label="完成当前卡片"
```

## 不测的内容

- 不测复杂动画轨迹。
- 不测每个视觉细节。
- 不测真实 OCR/OpenAI。
- 不测 native Android bridge。

## 验收标准

- `pnpm test:e2e` 通过一个 mobile-chrome 项目。
- 测试能证明 input -> deck -> proof 主链路可跑。
- UI 小文案变化不应频繁导致测试失败。

## 验证命令

```bash
pnpm test:e2e
```

## 建议提交

```bash
git add playwright.config.ts tests/e2e/mvp-flow.spec.ts components/input components/deck components/proof
git commit -m "test: add mvp browser smoke flow"
```
