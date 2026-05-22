# Next Card 第二层时间守护层实践方案索引

> 这组文档用于分派给其他执行任务，目标是把“时间守护层”从架构草图拆成可实现、可测试、可审计的工程包。执行者应先读本索引，再执行自己负责的任务包。

## 总目标

实现第二层的核心能力：

```text
自动分析 confirmed/committed task
-> 保护 TimeLock
-> 插入内部 schedule events
-> 创建保底提醒
-> 生成 nudge / deadline warning
-> 处理 soft task good line
-> 处理 frozen card 回流
-> 输出 validated QueueAction
```

第二层可以自动插入 Next Card 内部事件，但不能把未确认事实发明成 hard lock、DDL、外部通知或系统日历事件。

## 必读上游文档

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-21-time-guardian-architecture.md`
- `docs/superpowers/specs/2026-05-21-hidden-agent-profile-architecture.md`
- `docs/superpowers/specs/2026-05-21-soft-task-and-deck-library.md`
- `docs/superpowers/plans/2026-05-21-input-layer-execution-index.md`

## 分包执行顺序

1. A：合同与 fixture 包
2. B：Schedule Snapshot 与 TimeLock Validator 包
3. C：QueueAction 与内部事件插入包
4. D：Baseline Reminder 与通知权限降级包
5. E：Scheduling Kernel 与卡片窗口插入包
6. F：Deadline Warning 与 Recovery 请求包
7. G：Soft Task Good Line 与 tension classifier 包
8. H：Freeze Return Queue 与红队/skill 草案包

## 独立任务包文件

- [A：合同与 fixture 包](./2026-05-21-time-guardian-package-A-contracts-fixtures.md)
- [B：Schedule Snapshot 与 TimeLock Validator 包](./2026-05-21-time-guardian-package-B-snapshot-timelock.md)
- [C：QueueAction 与内部事件插入包](./2026-05-21-time-guardian-package-C-queue-actions-events.md)
- [D：Baseline Reminder 与通知权限降级包](./2026-05-21-time-guardian-package-D-reminders-capability.md)
- [E：Scheduling Kernel 与卡片窗口插入包](./2026-05-21-time-guardian-package-E-scheduling-kernel.md)
- [F：Deadline Warning 与 Recovery 请求包](./2026-05-21-time-guardian-package-F-deadline-warning.md)
- [G：Soft Task Good Line 与 tension classifier 包](./2026-05-21-time-guardian-package-G-soft-task-tension.md)
- [H：Freeze Return Queue 与红队/skill 草案包](./2026-05-21-time-guardian-package-H-freeze-redteam-skill.md)

## 全局不变量

- Time Guardian 必须支持自动插入内部 schedule events。
- 所有插入和变更必须表示为 validated `QueueAction`。
- `TimeLock` 不能被静默移动或覆盖。
- 用户选择 B/C 方案时，不能按未选择的 A 方案生成提醒或窗口。
- 每个 verified time-protected card 必须有 baseline reminder。
- 默认 baseline reminder 是目标时间前 30 分钟，除非用户设为 15/45/custom。
- `agent-refined` nudge 可以增加提醒，但不能删除 baseline reminder。
- 没有外部通知权限时，只能创建 `in-app-only` 状态，不能声称外部通知已设置。
- reminder delivery failure 不能算用户忽略。
- soft task hardening 是调度事实，不是道德评价。
- Time Guardian 只能请求 Proof Ledger 记录事实，不能直接 append proof。

## 当前不做

- 不接真实系统日历同步。
- 不做后台 Web Push。
- 不做 Android/iOS 原生提醒桥。
- 不做跨 deck 全局最优排程。
- 不做 profile 自动改 schedule。
- 不让 LLM 做最终时间算术。
- 不写 proof/profile 权威状态。

## 给执行任务的启动提示

```text
你正在实现 Next Card 第二层时间守护层。先阅读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-21-time-guardian-architecture.md
3. docs/superpowers/plans/2026-05-21-time-guardian-execution-index.md
4. 你被分配的具体 Time Guardian 任务包

只执行被分配的任务包。第二层的核心是自动分析并插入内部 schedule events，但所有变更必须通过 QueueAction、TimeLock 校验、baseline reminder 保护和通知权限检查。遇到 hard lock、外部通知、proof/profile 写入边界冲突时，记录 blocker，不要自行扩大范围。
```

## 执行者最终报告格式

```text
完成范围:
- ...

改动文件:
- ...

验证:
- ...

未做/刻意不做:
- ...

发现的产品或架构阻塞:
- ...
```
