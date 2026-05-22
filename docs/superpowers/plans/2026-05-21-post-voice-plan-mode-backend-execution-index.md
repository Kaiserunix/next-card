# Next Card Post-Voice Plan Mode Backend 执行包索引

> 这组文档用于分派给其他执行任务，目标是把语音确认后的 `POST /api/backend/plan-mode` 从设计合同拆成可实现、可测试、可审计的工程包。执行者应先读本索引，再执行自己负责的任务包。

## 总目标

实现 Post-Voice Plan Mode Backend：

```text
confirmed transcript
-> input-layer fact confirmation
-> PlanCompilerHandoff
-> POST /api/backend/plan-mode
-> PlanModeDraft with explicit A/B/C
-> user selects an option later
-> future Deck Commit Service
```

本执行轨道只产出 Plan Mode draft，不 commit deck、不写 proof、不创建 reminder、不 schedule card、不默认方案 A。

## 必读上游文档

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-21-post-voice-plan-mode-backend-design.md`
- `docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md`
- `docs/superpowers/plans/2026-05-21-input-layer-execution-index.md`
- `docs/superpowers/plans/2026-05-21-time-guardian-execution-index.md`

## 分包执行顺序

1. A：合同与 fixture 包
2. B：请求校验与错误合同包
3. C：PlanModeDraft Repository 包
4. D：Deterministic Local Provider 包
5. E：输出校验与安全边界包
6. F：PlanMode Service 与 API Route 包
7. G：Regeneration、红队与实现文档收口包

## 独立任务包文件

- [A：合同与 fixture 包](./2026-05-21-post-voice-plan-mode-package-A-contracts-fixtures.md)
- [B：请求校验与错误合同包](./2026-05-21-post-voice-plan-mode-package-B-request-validation.md)
- [C：PlanModeDraft Repository 包](./2026-05-21-post-voice-plan-mode-package-C-draft-repository.md)
- [D：Deterministic Local Provider 包](./2026-05-21-post-voice-plan-mode-package-D-deterministic-provider.md)
- [E：输出校验与安全边界包](./2026-05-21-post-voice-plan-mode-package-E-output-validator.md)
- [F：PlanMode Service 与 API Route 包](./2026-05-21-post-voice-plan-mode-package-F-service-route.md)
- [G：Regeneration、红队与实现文档收口包](./2026-05-21-post-voice-plan-mode-package-G-regeneration-redteam-docs.md)

## 全局不变量

- `POST /api/backend/plan-mode` 的权威输入是 `PlanCompilerHandoff`。
- raw/unconfirmed transcript 不能作为 plan-mode 权威输入。
- voice-confirmed source 应带 `confirmedTranscriptId`。
- 输出必须是 `PlanModeDraft`。
- 输出必须包含 exactly A/B/C 三个方案。
- 后端不能选择任何方案。
- 后端不能默认方案 A。
- 后端不能 commit deck。
- 后端不能写 proof。
- 后端不能创建 reminder。
- 后端不能 enqueue Time Guardian action。
- provider 输出必须通过 schema/语义校验。
- provider 失败或输出无效时必须 fallback 到 deterministic-local。
- UI 不得 import provider SDK。

## 当前不做

- 不做 Deck Commit Service。
- 不做 card runtime。
- 不做 proof ledger 写入。
- 不做 Time Guardian schedule route。
- 不做 reminder route。
- 不做 streaming plan generation。
- 不做 frontend redesign。
- 不接真实 Mimo/OpenAI provider 作为唯一可用路径。

## 分派建议

- 架构/类型同事：A
- API/后端入口同事：B + F
- 存储同事：C
- mock/provider 同事：D
- 审计同事：E + G

## 给执行任务的启动提示

```text
你正在实现 Next Card Post-Voice Plan Mode Backend。先阅读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-21-post-voice-plan-mode-backend-design.md
3. docs/superpowers/plans/2026-05-21-post-voice-plan-mode-backend-execution-index.md
4. 你被分配的具体 Plan Mode 任务包

只执行被分配的任务包。本轨道只生成 PlanModeDraft with explicit A/B/C。遇到 deck commit、proof write、reminder creation、Time Guardian queue action、frontend redesign 需求，记录 blocker，不要自行扩大范围。
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
