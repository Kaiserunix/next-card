# 任务包 E：Plan Mode 输出校验与安全边界包

> **执行要求：** 本包只验证 provider/service 输出是否安全。不要修正 provider 输出，不要 commit deck，不要写 proof。

**目标：** 阻止 provider 返回缺少 A/B/C、宽泛卡片、默认选项、越权 writes、错误 mode/style 的 draft。

**优先级：** P0

**依赖：** A、D

## 涉及文件

```text
lib/server/plan-mode/plan-output-validator.ts
tests/server/plan-mode/plan-output-validator.test.ts
tests/server/plan-mode/plan-mode-boundary-redteam.test.ts
```

## 必须实现的接口

```ts
validatePlanModeDraft(draft: PlanModeDraft): PlanModeDraft
isBroadActionCard(card: ActionCardDraft): boolean
assertPlanModeNoAuthorityWrites(draft: PlanModeDraft): void
```

## 校验规则

- `options.length === 3`。
- options id 必须是 `plan-a`、`plan-b`、`plan-c`。
- modes 必须是 `A`、`B`、`C`。
- styles 必须是 `urgent`、`balanced`、`gentle`。
- 不能出现 `selectedOptionId`。
- 每个 option 至少 3 张 card。
- 每张 card 必须有具体 `action`。
- broad card 必须拒绝。
- `writes.deckCommitted/proofWritten/remindersCreated/scheduleQueued` 必须全 false。
- `status="options-ready"` 时必须有 understanding、constraints、decomposition、timeStrategy。

## 宽泛卡片检测最低规则

拒绝 action/title 等于或近似：

```text
学习
学习数学
完成作业
做任务
准备
努力完成
推进一下
```

允许更具体动作：

```text
打开...
圈出...
写出...
整理...
确认...
提交...
到达...
```

## 红队用例

至少覆盖：

1. 只有 A/B，没有 C。
2. 三个 options 但 mode 重复。
3. plan-a 被标成 selected。
4. card action 是 `完成作业`。
5. draft 写 `deckCommitted=true`。
6. draft 写 `proofWritten=true`。
7. draft 写 `remindersCreated=true`。
8. draft 写 `scheduleQueued=true`。
9. provider 生成未选择 plan 的 schedule hint。
10. provider 把 missing hard time 自行补成 deadline。

## 验收标准

- invalid provider output 被拒绝。
- deterministic provider output 通过。
- 所有 authority write flags 被强制保护。
- 测试证明 plan-mode 输出不能越权。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/plan-output-validator.test.ts tests/server/plan-mode/plan-mode-boundary-redteam.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/plan-mode/plan-output-validator.ts tests/server/plan-mode
git commit -m "feat: validate plan mode draft output"
```
