# 任务包 E：Scheduling Kernel 与卡片窗口插入包

> **执行要求：** 本包实现基础确定性排程和 card-window 插入。不要使用 LLM 做最终时间算术，不做跨 deck 全局优化。

**目标：** 根据用户选择的 A/B/C 方案、已确认 hard locks、可用窗口和估算时长，自动插入内部卡片执行窗口。

**优先级：** P0

**依赖：** 任务包 A、B、C、D

## 涉及文件

```text
lib/server/time-guardian/scheduling-kernel.ts
lib/server/time-guardian/card-window-planner.ts
lib/server/time-guardian/defer-decision-service.ts
tests/server/time-guardian/scheduling-kernel.test.ts
tests/server/time-guardian/card-window-planner.test.ts
tests/server/time-guardian/defer-decision-service.test.ts
```

## 输入

```ts
type ScheduleCommittedDeckInput = {
  snapshot: ScheduleSnapshot;
  deck: CommittedDeckRef;
  cards: CommittedCardRef[];
  chosenPlanId: string;
  policySnapshot?: AgentPolicySnapshot;
};
```

## 输出

```ts
type ScheduleCommittedDeckResult = {
  scheduleProposal: ScheduleProposal;
  queueActions: QueueAction[];
  warnings: string[];
};
```

## 基础排程规则

- 只调度 chosenPlanId 对应的 cards。
- 先放 hard/deadline-sensitive cards。
- soft/recommended cards 不得挤占 hard lock。
- 每张 scheduled card 输出 `InsertScheduleEventAction(kind="card-window")`。
- 时间计算使用确定性函数。
- 无可用窗口时输出 conflict report 或 `RequestUserReviewAction`。

## defer 判断

用户推迟卡片时：

```text
safe -> DeferCardAction
unsafe -> RequestUserReviewAction + reason
```

unsafe 包括：

- 撞上 class/exam/user_locked_block。
- 超过 submission_deadline。
- 会删除 baseline reminder。
- 会让 chosen plan 的关键 card 没有可执行窗口。

## 验收用例

- 用户选 B 方案，只插入 B 方案 card-window。
- 8:00 class hard lock 下，准备卡插入 7:25-7:40，不插入 8:00-8:10。
- 20:00 DDL 前，最低可提交卡优先于 soft review card。
- 没有可用窗口时输出 `needs_review`，不硬塞。
- 推迟到考试时间被拒绝。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/scheduling-kernel.test.ts tests/server/time-guardian/card-window-planner.test.ts tests/server/time-guardian/defer-decision-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/time-guardian/scheduling-kernel.ts lib/server/time-guardian/card-window-planner.ts lib/server/time-guardian/defer-decision-service.ts tests/server/time-guardian
git commit -m "feat: add deterministic card scheduling"
```
