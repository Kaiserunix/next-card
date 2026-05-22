# Next Card 第三层行动回顾 / 节奏适配层执行包索引

> 这组文档用于分派给其他执行任务，目标是把“行动回顾 / 节奏适配层”从轻量架构草图拆成可实现、可测试、可审计的工程包。执行者应先读本索引，再执行自己负责的任务包。

## 总目标

实现第三层的最小安全能力：

```text
Proof events
-> read-only proof signals
-> neutral ProfileSnapshot
-> future-facing AgentPolicySnapshot
-> optional SystemSoftTaskCandidate
-> support-language explanations
```

第三层只能产生 aggregate、snapshot、policy hint、candidate、explanation。它不能直接写入 deck、card、reminder、proof、deadline、hard lock 或 Time Guardian 队列。

## 必读上游文档

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-21-action-review-profile-adaptation-plan.md`
- `docs/superpowers/specs/2026-05-21-hidden-agent-profile-architecture.md`
- `docs/superpowers/specs/2026-05-21-soft-task-and-deck-library.md`
- `docs/superpowers/plans/2026-05-21-input-layer-execution-index.md`
- `docs/superpowers/plans/2026-05-21-time-guardian-execution-index.md`

## 分包执行顺序

1. A：合同与 fixture 包
2. B：Proof Reader 与 Signal Normalizer 包
3. C：默认 Profile Aggregator 与静态 Policy Engine 包
4. D：Explanation Builder 与 Proof Summary Insight 包
5. E：System Soft Task Candidate Generator 包
6. F：Profile Governance 与 Reset Controls 包
7. G：红队测试与 skill 草案包

## 独立任务包文件

- [A：合同与 fixture 包](./2026-05-21-action-review-profile-package-A-contracts-fixtures.md)
- [B：Proof Reader 与 Signal Normalizer 包](./2026-05-21-action-review-profile-package-B-proof-reader-signal-normalizer.md)
- [C：默认 Profile Aggregator 与静态 Policy Engine 包](./2026-05-21-action-review-profile-package-C-default-profile-policy.md)
- [D：Explanation Builder 与 Proof Summary Insight 包](./2026-05-21-action-review-profile-package-D-explanation-summary-insight.md)
- [E：System Soft Task Candidate Generator 包](./2026-05-21-action-review-profile-package-E-system-soft-task-candidates.md)
- [F：Profile Governance 与 Reset Controls 包](./2026-05-21-action-review-profile-package-F-profile-governance-reset.md)
- [G：红队测试与 skill 草案包](./2026-05-21-action-review-profile-package-G-redteam-skill-draft.md)

## 全局不变量

- 第三层是隐藏内部能力，不是用户可见 agent。
- Profile 是支持策略模型，不是心理诊断、人格画像或道德评分。
- Proof 是 append-only evidence，不是第三层可写状态。
- 第三层不能直接 mutate deck、card、reminder、proof、deadline、hard lock。
- 第三层不能移动 `TimeLock`。
- 第三层不能删除 baseline reminder。
- 第三层不能降低 `baselineGoal` 或 `standardGoal`。
- 第三层只能通过 future-facing policy hint 缩小下一步 `progressGoal`。
- failed reminder delivery 不能被解释成用户忽略。
- missing notification permission 时，reminder response 数据不可靠。
- MVP 自动 profile 更新关闭。
- 系统软任务只生成 candidate，必须交给 Time Guardian review。
- 文案必须是支持语言，不能出现懒、自律差、拖延症、执行力评分、人格分数等标签。

## 当前不做

- 不做用户可见人格/profile 页面。
- 不做自动 profile 学习默认开启。
- 不做 committed deck 自动重写。
- 不做 reminder job 自动修改。
- 不做 proof 写入。
- 不做 school/parent/third-party report。
- 不做系统软任务强制推送。
- 不让第三层绕过 A/B/C Plan Mode。

## 分派建议

- 架构/类型同事：A
- proof/数据同事：B
- 策略同事：C
- 产品文案/summary 同事：D
- 软任务同事：E
- 安全/控制同事：F
- 审计/skill 同事：G

## 给执行任务的启动提示

```text
你正在实现 Next Card 第三层行动回顾 / 节奏适配层。先阅读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-21-action-review-profile-adaptation-plan.md
3. docs/superpowers/plans/2026-05-21-action-review-profile-execution-index.md
4. 你被分配的具体 Action Review/Profile 任务包

只执行被分配的任务包。第三层只能读取 verified proof/runtime facts，并输出 aggregate、ProfileSnapshot、AgentPolicySnapshot、SystemSoftTaskCandidate、explanation。遇到 deck/card/reminder/proof/deadline/hard lock 写入需求，记录 blocker，不要自行扩大范围。
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
