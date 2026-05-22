# Next Card 未完成记录与全量模拟报告

Date: 2026-05-21
Status: execution-track record

## 当前已完成的模拟范围

- 已建立 `lib/server/simulation/full-timeline-simulation.ts`，用确定性代码模拟四条内部能力轨道：
  - `ocr-worker`
  - `planning-worker`
  - `time-guardian`
  - `proof-audit`
- 已把模拟结果接到首页可视化平台，页面保留 `input / deck / proof` 三个顶层模式。
- 已用 Vitest 覆盖全量模拟：
  - OCR 输出至少 6 门课程和 12 个任务。
  - 大模型模拟器只提交用户选择的 `plan-b`。
  - Time Guardian 生成 card-window、baseline reminder、deadline warning、soft-task surface、freeze-return。
  - 低置信 OCR hard-lock 被 review/validation 拦截。
  - QueueAction 使用同一 snapshot，并通过 deterministic validator。
  - 缺少外部通知权限时降级为 in-app-only。
  - Time Guardian 不直接写 proof/profile。
- 已新增多模态模型子 agent 与第二层验收专项报告：
  - `docs/superpowers/specs/2026-05-21-multimodal-second-layer-acceptance-report.md`
  - raw multimodal 输出不被 Time Guardian 直接接收。
  - post-plan `QueueAction` 通过 deterministic validator 才能进入第二层。
  - 未选方案、硬锁重叠、baseline reminder 被 agent 覆盖、proof/profile 越权写入都会被拒绝。

## 未完成项

1. **正式用户产品 UI 当前不在根首页**
   - 当前文件：`app/page.tsx`
   - 状态：根首页现在渲染 `TimelineSimulationPanel`，这是可视化模拟台，不是 AGENTS 要求的正式 `input / deck / proof` Plan Mode、deck swipe、proof journal 体验。
   - 下一步：把模拟台保留到独立入口，例如 `/simulation` 或 `/test-platform`，根首页恢复正式产品流。

2. **旧前端和状态核心处于 tracked deletion 风险**
   - 当前文件：`components/input/*`、`components/deck/*`、`components/proof/*`、`store/useNextCardStore.ts`、`lib/mock-ai.ts`、`lib/types.ts`
   - 状态：这些文件在当前 worktree 被标记删除；本次任务没有回滚它们，也没有确认它们是否应永久删除。
   - 下一步：提交前单独 triage，确认是否从旧实现/备份目录恢复、替换，或作为有意删除提交。

3. **README / backend boundary 文档与当前文件树存在冲突**
   - 当前文件：`README.md`、`docs/backend-extension-boundaries.md`
   - 状态：文档仍描述 `health`、`plan-mode`、`import/review`、`schedule/plan`、Web Push、ICS 等能力；当前根 app/API 并不完全匹配。
   - 下一步：按真实文件树更新文档，或把缺失 endpoint 纳入后续执行包。

4. **仓库治理/CI 文件被标记删除**
   - 当前文件：`.github/CODEOWNERS`、`.github/workflows/ci.yml`
   - 状态：这会影响 PR review 和默认 CI gate，不属于本次模拟平台范围。
   - 下一步：恢复或单独记录删除理由。

5. **Time Guardian 尚未接入真实 runtime queue**
   - 当前文件：`lib/server/time-guardian/*`
   - 状态：已实现 deterministic services 和 tests，但还没有权威 queue store、事务、重试、幂等持久化。
   - 下一步：实现 `TimeGuardianQueuePort` 的本地 JSON 或数据库版本。

6. **Time Guardian 尚未接入 Deck Commit 事件**
   - 当前文件：`lib/server/simulation/full-timeline-simulation.ts`
   - 状态：模拟器直接调用 `scheduleCommittedDeck()`。
   - 下一步：在 deck commit service 后触发 Time Guardian scheduling。

7. **没有真实 `app/api/backend/time-guardian/*` 路由**
   - 当前状态：只有 voice API routes。
   - 下一步：新增 thin route handlers，把业务逻辑留在 `lib/server/time-guardian/*`。

8. **`POST /api/backend/plan-mode` 当前不存在**
   - 当前状态：`app/api/backend` 下有 `voice/*` 和 `test-platform/simulate`，但没有 Plan Mode backend。
   - 下一步：实现 `PlanCompilerHandoff -> A/B/C -> user-selected commit`，仍不能默认方案一。

9. **OCR / multimodal provider 仍是模拟输出**
   - 当前文件：`simulateOcrCourseAndTaskModel()`
   - 状态：能模拟课程表、任务、低置信 OCR、通知任务，但没有接真实 Mimo/OCR。
   - 下一步：通过 input-layer adapter 接真实 multimodal provider，并保留 review gate。

10. **大模型规划仍是 deterministic worker 模拟**
   - 当前文件：`simulatePlanningModel()`
   - 状态：只模拟已选 `plan-b` 的 committed deck/cards。
   - 下一步：实现 Plan Compiler handoff -> A/B/C Plan Mode -> user-selected commit，不允许直接默认方案一。

11. **语音后端已做但未接正式 UI**
   - 当前文件：`app/api/backend/voice/{transcribe,normalize,readiness,confirm}/route.ts`、`lib/server/voice/*`
   - 状态：Volcengine provider、quota、normalization、readiness、confirmed transcript metadata 已有测试；当前正式 UI 没有 voice opening 卡片调用它们。
   - 下一步：设计 voice opening UI，接 transcript review 和 confirmed metadata。

12. **`transcribe` route 缺 API route 测试**
   - 当前文件：`app/api/backend/voice/transcribe/route.ts`
   - 状态：provider/service 有测试，但 `tests/api/backend/voice/` 里没有 transcribe route test。
   - 下一步：补 route-level request validation / quota / provider failure 测试。

13. **input-layer 是 service/test slice，尚未接 API/UI**
   - 当前文件：`lib/server/input-layer/*`、`tests/server/input-layer/*`
   - 状态：RawInput、review gate、evidence、FactConfirmation、PlanCompilerHandoff 都存在，但没有 `app/api/backend/input-layer/*` 和正式 composer 接入。
   - 下一步：新增 thin API route，再接 input composer / import review UI。

14. **Proof/Profile 权威写入没有接线**
   - 当前状态：Time Guardian 只模拟 `proof-request`，不 append proof/profile。
   - 下一步：实现 Proof Ledger request adapter，并由 Proof Ledger 权威写入。

15. **外部通知、Web Push、原生提醒、日历同步未实现**
   - 当前文件：`lib/server/backend-ports.ts`
   - 状态：已有 `ReminderNotificationPort` / `CalendarExportPort` adapter slot。
   - 下一步：先做 browser notification permission proof，再做 native bridge/calendar export。

16. **可视化平台是模拟台，不是正式产品 UI**
   - 当前文件：`app/page.tsx`、`components/simulation/TimelineSimulationPanel.tsx`
   - 状态：用于观察 runtime timeline，不替代正式 `input/deck/proof` 体验。
   - 下一步：正式 UI 仍需回到 Plan Mode、deck swipe、proof journal 产品面。

17. **当前 worktree 有大量既有 dirty/untracked 状态**
   - 状态：本次工作只追加 simulation/time-guardian 相关文件，没有回滚既有删除和未跟踪文档。
   - 下一步：提交前先做独立 triage，区分本次改动、voice slice 改动、历史 frontend 删除。

18. **全量模拟还不是压力测试**
    - 当前测试：`tests/server/simulation/full-timeline-simulation.test.ts`
    - 状态：覆盖单日 crowded student schedule。
    - 下一步：增加多日课程表、冲突 DDL、重复 deck、100+ task 的性能/稳定性模拟。

## 模拟测试指标快照

当前模拟期望：

```text
coursesParsed >= 6
tasksParsed >= 12
decksCommitted >= 4
baselineReminders == timeProtectedCards
inAppOnlyReminders == baselineReminders
blockedUnverifiedHardLocks >= 1
directProofWrites == 0
directProfileWrites == 0
```

## 刻意不做

- 不接真实 OCR/Mimo/LLM provider。
- 不写外部通知 job。
- 不写系统日历或课程表。
- 不让 Time Guardian 直接 append proof/profile。
- 不把 simulation dashboard 当正式用户体验。

## 下一轮建议

1. 增加 `app/api/backend/simulation/full-timeline`，让前端可以重新运行不同种子。
2. 给 simulation engine 加 seed 和 scenario presets：`crowded-day`、`deadline-night`、`bad-ocr-week`、`freeze-recovery`。
3. 接入 input-layer 的 `FactConfirmationRequest`，让可视化能看到 review gate 前后的差异。
4. 加一个 JSON export，用于长期回归和人工审查。
