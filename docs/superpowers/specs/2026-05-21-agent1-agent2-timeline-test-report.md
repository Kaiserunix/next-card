# 2026-05-21 Agent1/Agent2 时间线测试记录

## 测试时间

- 执行时间：2026-05-21 20:14:39 +08:00
- 修复后复测：2026-05-21 20:19:40 +08:00
- 工作目录：`C:\Users\qwerf\Desktop\nextcard`
- 图片语料目录：`C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d`

## 本轮新增专项覆盖

新增 24 组图片时间线 fixture：

- 低复杂度：10 组
- 中复杂度：8 组
- 高复杂度：6 组

覆盖类型：

- 单课程、早八、单 deadline、自习窗口
- 纸质临时课表、实验链、调课通知、固定课与补交作业混合
- 课表冲突、作业窗口与课程冲突、prompt-like 作业截图、低可信暗图

测试文件：

- `tests/fixtures/timeline-complexity/image-timeline-agent-cases.ts`
- `tests/server/timeline-complexity/agent1-agent2-timeline-complexity.test.ts`

## Agent1 检查结果

专项断言：

- 图片、表格、通知、相对日期、prompt-like 文本均进入 review gate。
- strict/blocked review 不会直接产生 `PlanCompilerHandoff`。
- 不产生 `committedDeck`、`cardState`、`reminderJob`、`proofRecord`、`profileSnapshot` 等权威写入。
- 低可信暗图进入 blocked/retry 路径。

结果：通过。

## Agent2 检查结果

专项断言：

- 只安排用户已确认后的事实快照。
- 只安排已选 `plan-b`，不会安排未选 A/C 方案。
- 已安排卡片窗口不互相重叠。
- 不踩 class/exam/fixed calendar/user locked block 等硬锁。
- deadline-sensitive 卡优先于 soft 卡。
- 无安全窗口时输出 `request-user-review`。
- QueueAction 限定为 deterministic Time Guardian action，不直接写 proof/profile/deck/reminder 权威状态。

结果：通过。

## 修复记录

专项测试首次运行时暴露并修复了两个 Time Guardian 问题：

1. `card-window-planner` 原先会把多张卡放在同一个可用窗口的同一开始时间，导致卡片窗口重叠。
2. `time-lock-validator` 原先会把 snapshot 内任意 `submission_deadline` 应用到无关卡片，导致无关 deadline 污染其他时间线。
3. `text-extraction-worker` 的多目标判断需要区分“也要交/复习/提醒”等第二任务，和“学号也要写”这类同一提交任务的附加要求；后者不应触发 rough-scope 多目标确认。

修复后 focused suite 通过。

## 命令记录

### Focused Agent1/Agent2 时间线测试

命令：

```bash
pnpm test tests/server/timeline-complexity/agent1-agent2-timeline-complexity.test.ts tests/server/time-guardian/time-lock-validator.test.ts tests/server/time-guardian/scheduling-kernel.test.ts
```

结果：

```text
Test Files 3 passed
Tests 57 passed
```

### 全量测试

命令：

```bash
pnpm test
```

首次记录结果：

```text
Test Files 1 failed | 69 passed (70)
Tests 10 failed | 351 passed (361)
```

失败文件：

```text
tests/server/stress/agent1-agent2-stress-corpus.test.ts
```

该文件当前为未跟踪文件。失败项集中在已有压力预期与当前实现行为不一致：

- `agent1-text-stop-04`：仍要求补 location。
- `agent1-text-stop-05`：仍要求补 taskType。
- `agent1-text-stop-06`：仍要求补 location。
- `agent1-text-ask-02`：缺少 event 的预期未命中。
- `agent1-text-ask-03`：预期 light，但实际 strict。
- `agent1-text-ask-09`：预期缺失字段不一致。
- `agent1-text-ask-11`：预期 light，但实际 strict。
- `agent1-text-risk-05`：预期 strict，但实际 light。
- `agent1-text-risk-06`：预期 light，但实际 strict。
- `agent2-deadline-05`：低置信 deadline 预期 `risk`，实际 `critical`。

修复后复测结果：

```text
Test Files 70 passed
Tests 361 passed
```

当前判断：

- 本轮新增的图片时间线专项测试通过。
- `tests/server/stress/agent1-agent2-stress-corpus.test.ts` 已通过，覆盖约百组 Agent1/Agent2 压力场景。
- `agent1-text-risk-06` 已验证为 strict-review，而不是 rough-scope 多目标确认。

### Typecheck

命令：

```bash
pnpm typecheck
```

结果：通过。

备注：与 `pnpm build` 并行执行时可能出现 `.next/types` 文件竞态导致的 TS6053；在 build 结束后单独复跑通过。

### Lint

命令：

```bash
pnpm lint
```

结果：通过。

### Build

命令：

```bash
pnpm build
```

结果：通过。

构建路由：

```text
/                                      static
/_not-found                            static
/api/backend/plan-mode                 dynamic
/api/backend/voice/confirm             dynamic
/api/backend/voice/normalize           dynamic
/api/backend/voice/readiness           dynamic
/api/backend/voice/transcribe          dynamic
```

## 结论

Agent1/Agent2 图片时间线专项测试已经通过，并记录了 24 组由低到高复杂度的本地图片语料。修复后全量 `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过。
