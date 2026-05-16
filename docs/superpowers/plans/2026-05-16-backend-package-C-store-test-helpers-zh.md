# 任务包 C：Store 测试工具包

> **执行要求：** 本包提供测试 helper，不改业务行为。后续 D/E/F/G/H/I 都应复用这些 helper。

**目标：** 给 Zustand store 测试准备统一 reset 和常用流程 helper，避免每个测试重复 setup。

**优先级：** P0

**依赖：** 任务包 A

**涉及文件：**

```text
store/useNextCardStore.ts
tests/helpers/nextCardStore.ts
```

## 需要新增的 helper

```text
resetNextCardStore()
generateCourseDeckInStore()
getActiveCard()
```

## helper 职责

### resetNextCardStore()

- 清理 `localStorage`。
- 重置 `mode` 为 `input`。
- 重置 `inputs`、`analysis`、`analysisStatus`、`plans`。
- 重置 `taskFlow`。
- 重置 `deck`。
- 重置 `proofs`。

### generateCourseDeckInStore()

执行一条稳定主链路：

```text
setInputText("去高数课")
-> analyzeInput()
-> finishAnalysis()
-> selectPlan("plan-1")
```

返回 active deck。如果没有生成 active deck，直接抛错。

### getActiveCard()

- 根据 `activeDeckId` 找 deck。
- 根据 `currentCardId` 找 card。
- 没找到则抛错，避免测试静默通过。

## 验收标准

- 后续 store 测试可以复用 helper。
- helper 不依赖 UI。
- helper 不偷偷修改业务逻辑。
- fake timer 由具体测试控制，helper 不自己设置时间。

## 验证命令

```bash
pnpm test
```

## 建议提交

```bash
git add tests/helpers/nextCardStore.ts
git commit -m "test: add next card store helpers"
```
