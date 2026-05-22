# Next Card Deck Commit / Proof Ledger P0 执行包索引

> 这组文档用于分派给其他执行任务，目标是把 `PlanModeDraft -> 用户选择 A/B/C -> committed deck -> proof request -> append-only proof` 从边界规格拆成可实现、可测试、可审计的工程包。执行者应先读本索引，再执行自己负责的任务包。

## 总目标

实现 Deck Commit / Proof Ledger 后端权威边界：

```text
PlanModeDraft with A/B/C
-> user selects exactly one option
-> Deck Commit Service writes committed deck + initial cards
-> Deck Commit creates ProofEventRequest / outbox record
-> Proof Ledger validates and appends neutral proof
-> Time Guardian receives committed deck/card refs
```

本执行轨道的核心不是做 UI，也不是直接进入排程，而是把权威写入边界固定下来：

```text
Deck Commit owns deck/card commit.
Proof Ledger alone appends proof.
Time Guardian receives committed refs later.
```

## 必读上游文档

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-boundary.md`
- `docs/superpowers/specs/2026-05-21-post-voice-plan-mode-backend-design.md`
- `docs/superpowers/plans/2026-05-21-post-voice-plan-mode-backend-execution-index.md`
- `docs/superpowers/plans/2026-05-21-time-guardian-execution-index.md`
- `docs/superpowers/plans/2026-05-21-action-review-profile-execution-index.md`

## 分包执行顺序

1. A：共享合同与 fixture 包
2. B：Deck Commit 校验与幂等包
3. C：DeckStore / CardRuntimeStore Repository 包
4. D：Deck Commit Compiler Service 包
5. E：Proof Ledger 合同、append-only repository 与 validator 包
6. F：Proof Request Outbox 与 retry 包
7. G：Deck Commit API Route 与 trusted orchestration 包
8. H：红队测试与 skill 草案包

## 独立任务包文件

- [A：共享合同与 fixture 包](./2026-05-21-deck-commit-proof-ledger-package-A-contracts-fixtures.md)
- [B：Deck Commit 校验与幂等包](./2026-05-21-deck-commit-proof-ledger-package-B-validator-idempotency.md)
- [C：DeckStore / CardRuntimeStore Repository 包](./2026-05-21-deck-commit-proof-ledger-package-C-repositories.md)
- [D：Deck Commit Compiler Service 包](./2026-05-21-deck-commit-proof-ledger-package-D-compiler-service.md)
- [E：Proof Ledger 合同、append-only repository 与 validator 包](./2026-05-21-deck-commit-proof-ledger-package-E-proof-ledger-validator.md)
- [F：Proof Request Outbox 与 retry 包](./2026-05-21-deck-commit-proof-ledger-package-F-proof-outbox-retry.md)
- [G：Deck Commit API Route 与 trusted orchestration 包](./2026-05-21-deck-commit-proof-ledger-package-G-route-orchestration.md)
- [H：红队测试与 skill 草案包](./2026-05-21-deck-commit-proof-ledger-package-H-redteam-skill-draft.md)

## 全局不变量

- Deck Commit 只能 commit 用户选择的一个 Plan Mode option。
- 未选择的 A/B/C options 不能创建 deck/card/proof/reminder/schedule refs。
- Deck Commit 不能直接 append Proof Ledger。
- Deck Commit 可以创建 `ProofEventRequest` 和 outbox record。
- Proof Ledger 是唯一 append-only proof writer。
- Proof Ledger 不能写 deck/card/reminder/schedule/profile/policy/PlanModeDraft。
- `deck_committed` 只表示“用户选择方案并生成卡组”，不表示完成、成功、失败或自律。
- Card completion proof 只能来自 Card Runtime，不能来自 Deck Commit、Plan Mode、Time Guardian 或 Profile。
- Time Guardian 可以请求 `deadline_warning` / `soft_task_hardened` proof，不能请求 `card_completed`。
- Notification delivery failure 不能算用户忽略。
- Proof 文案和 metadata 禁止羞辱、诊断、道德评分。
- commit 成功但 proof append 失败时，deck 保持 committed，proof request 进入 retryable outbox。

## 当前不做

- 不做公开任意 proof write route。
- 不做完整 event sourcing。
- 不做数据库迁移。
- 不做 UI redesign。
- 不做系统日历写入。
- 不做真实外部通知发送。
- 不做 profile 自动更新。
- 不做 deck recommit / rebuild flow。
- 不做 unchosen option 的隐藏预排程。

## 分派建议

- 类型/fixture 同事：A
- validator/幂等同事：B
- 存储同事：C + F
- commit 编译同事：D
- proof 审计同事：E + H
- route/API 同事：G

## 最低验证命令

```powershell
pnpm test tests/server/deck-commit tests/server/proof-ledger tests/api/backend/deck
pnpm typecheck
pnpm lint
```

如果当前项目没有 `typecheck` 脚本，执行者改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 给执行任务的启动提示

```text
你正在实现 Next Card Deck Commit / Proof Ledger P0 后端权威边界。先阅读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-boundary.md
3. docs/superpowers/plans/2026-05-21-deck-commit-proof-ledger-execution-index.md
4. 你被分配的具体任务包

只执行被分配的任务包。Deck Commit 可以写 committed deck/card 与 proof request outbox，但不能 append proof。Proof Ledger 是唯一 append-only proof writer。遇到提醒、排程、profile、UI redesign、公开 proof write route 需求，记录 blocker，不要扩大范围。
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
