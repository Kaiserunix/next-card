# Next Card 多模态模型模拟与第二层验收报告

Date: 2026-05-21
Status: execution-track acceptance record

## 完成范围

- 新增 `lib/server/simulation/multimodal-second-layer-acceptance.ts`。
- 用确定性代码模拟 8 类多模态/输入模型子 agent 输出：
  - 课表图片 OCR。
  - 低置信课表行。
  - PDF 作业要求。
  - PDF 多截止时间。
  - 相对日期通知。
  - 与既有事实冲突的通知。
  - 系统输入法听写文本。
  - prompt-like 文档。
- 多模态模拟器只输出 input-layer 允许的对象：
  - `RawInput`
  - `InputExtractionResult`
  - evidence / warnings / review requirement
  - `FactConfirmationRequest`
  - 用户确认后才生成 `PlanCompilerHandoff`
- 多模态模拟器不输出：
  - selected plan
  - committed deck
  - card state
  - reminder job
  - proof record
  - profile snapshot

## 第二层验收规则

第二层 Time Guardian 不接收 raw multimodal output。它只验收 A/B/C Plan Mode 和用户选择完成后的 post-plan `QueueAction`。

本次验收模拟覆盖：

- `rawMultimodalRuns = 8`
- `rawRunsAcceptedByTimeGuardian = 0`
- 低置信 OCR hard time 进入 strict review，不能直接排程。
- prompt-like 文档进入 blocked，不能进入计划或排程。
- 手动听写走 light confirmation，确认后得到 `PlanCompilerHandoff.mustGenerateABC = true`。
- 已选 `plan-b` 后的合法 `QueueAction` 可以通过 validator。
- 未选方案、硬锁重叠、agent-owned baseline reminder、删除 baseline reminder 的 nudge 都会被拒绝。
- proof/profile 越权写入被显式拦截。

## 可视化

首页模拟台已增加 `Second Layer Acceptance` 区块：

- 四条验收轨道：
  - Multimodal model
  - Input review gate
  - Plan Mode boundary
  - Second-layer acceptance
- 四个指标：
  - raw 输入直接接收
  - QueueAction 通过
  - QueueAction 拒绝
  - 越权写入拦截
- 表格展示每条 raw 输入、QueueAction、forbidden write 的 `accepted / review / rejected` 结果。

## 子 agent 审查吸收项

- 把“多模态模型模拟”从原先 `simulateOcrCourseAndTaskModel -> CommittedDeckRef` 的下游 demo 中拆出来。
- 保持 input-layer 合同：多模态层不能默认选择方案，也不能创建 deck/reminder/proof/profile。
- 第二层只接收 post-plan QueueAction。
- 弱 OCR、相对日期、冲突 deadline、prompt-like 文档必须进入 review 或 blocked。
- baseline reminder 必须由 `system-fallback` 或 `user-fixed` 拥有，agent nudge 不能删除它。

## 仍未做

- 未接真实 OCR / Mimo / LLM provider。
- 未实现 `PlanCompilerHandoff -> A/B/C -> user-selected deck commit` 正式链路。
- 未实现 Time Guardian runtime queue store 或 API route。
- 未实现 Proof Ledger / Profile authority 的真实写入端。
- 未把模拟台迁到独立 `/simulation` 后恢复正式产品首页。
