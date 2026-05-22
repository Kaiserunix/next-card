# 2026-05-22 P0 第二次后端缺损审查

## 审查对象

当前分支中的 P0 后端闭包实现，基线提交为 `760b041 feat: complete p0 backend closure`。

覆盖范围：

- Strict Review 确认续跑
- Card Runtime
- Proof Timeline read model
- Sandbox chain / CLI
- TXT/DOCX/PDF 最小文档抽取
- P0 验收报告与红队用例

## 当前验证

已重新运行：

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
pnpm backend:chain -- --case notification-relative --selected-option plan-b
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

结果：

- `pnpm test`: 96 files / 541 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `backend:chain text-assignment`: produced `deck_committed`, `card_started`, `card_completed`.
- `backend:chain crowded-timeline`: produced `defer-card` and `card_deferred`.
- `backend:chain strict-image-confirmed`: strict review -> confirmed -> deck commit -> card completed.
- `backend:chain notification-relative`: strict review -> confirmed -> deck commit -> card completed.
- Real MiMo text smoke: OK, `mimo-v2.5-pro`, `options=3`.
- Real MiMo image smoke: OK, `mimo-v2.5`, `sourceKind=courseSchedule`, `needsStrictReview=true`, `events=11`, `times=11`, `locations=2`.

## 主要结论

P0 后端闭包整体质量合格，可以进入“修小缺口 + 最小前端/CLI dogfood”的下一步。当前不是 production-ready，也不是完整产品可用，但已经从“模块可测”推进到了“后端链路可跑”。

## 审查发现

### P1：Proof Timeline 把 reminder created 映射成 delivered

文件：

- `lib/server/proof-ledger/proof-timeline-projection.ts`

问题：

`reminder_created` 被投影为 `reminder_delivered`。这会让 timeline 表达“提醒已送达”的语义，但当前事件只证明 reminder 被创建，不证明外部通知或应用内提醒已经展示。

风险：

- 违反“没有通知权限时不得假装提醒成功”的产品边界。
- 后续 action-review 可能把未送达提醒误当用户已收到提醒。

建议：

- 把 timeline type 改成 `reminder_created` 或 `reminder_recorded`。
- 只有来自 notification adapter audit 的 delivered event 才允许叫 `reminder_delivered`。

### P1：backend chain CLI 的 strict image 默认仍是 mock extractor

文件：

- `scripts/backend-chain-smoke.mjs`

问题：

CLI direct mode 总是注入 `MockMultimodalExtractor`。即使传了 `--image`，`strict-image-confirmed` 默认也只是走 mock 严格审查链路，不是真实 MiMo 图片识别链路。

风险：

- 报告和命令名容易让执行者误以为跑了真实图片端到端。
- 真实图片识别仍需要 `pnpm real:mimo` 或 route mode 另跑。

建议：

- CLI summary 明确打印 `multimodal provider: mock`。
- 增加 `--real-mimo` 或 `--route-url` smoke 文档，避免误读。
- 报告中把 backend chain smoke 和 real MiMo smoke 明确分栏。

### P2：document import 的 providerUsage 对 DOCX/PDF 不准确

文件：

- `lib/server/import-review/import-review-service.ts`

问题：

DOCX 成功走本地文本抽取、PDF fallback blocked 时，`providerUsage()` 仍可能返回 `provider: "mimo", used: true`，因为它只按 sourceType 和 extractor 类型判断，不知道本次是否真的调用了 MiMo。

风险：

- 模型状态 UI / report 会显示错误 provider。
- 后续成本统计或 smoke 统计可能把本地 DOCX 抽取算成 MiMo 调用。

建议：

- 把 `providerUsage` 改成由实际 extraction path 产生。
- 增加 provider 值，例如 `document-text` 或 `manual`。
- PDF blocked 时 `used` 应该是 false，另给 `recoverable` reason。

### P2：Card Runtime freeze queue action 未经过统一 validator

文件：

- `lib/server/card-runtime/card-runtime-service.ts`

问题：

`defer` action 走了 `validateQueueAction()`，但 `freeze` action 直接 push `createFreezeAction()`。当前字段看起来正确，测试也过，但没有统一锁住 Time Guardian queue action 规范。

风险：

- 以后 queue action schema 改动时，freeze 可能绕过校验。

建议：

- freeze 也调用 `validateQueueAction()`。
- 如果 validator 不支持 freeze，则补对应 validator case 和测试。

### P2：真实 MiMo CLI 仍有 module type warning

文件：

- `scripts/real-mimo-test-service.mjs`
- `lib/server/mimo/image-preprocess.ts`

问题：

真实 smoke 会输出 `MODULE_TYPELESS_PACKAGE_JSON` warning。它不影响运行，但会污染 smoke 输出。

建议：

- 将图片预处理包装成 CLI 专用 JS entry，或调整加载方式。
- 不建议为了这一个 warning 贸然给整个 package 加 `"type": "module"`，可能影响 Next/Vitest 生态。

## 第二次后端缺损清单

### 仍缺 P0/P1 边界

1. 前端或轻量客户端还没有接入新后端 routes。
2. Proof Timeline 语义需要修正 reminder created/delivered。
3. CLI provider 标识需要更清楚地区分 mock chain 与 real MiMo smoke。
4. DOCX/PDF providerUsage 需要按实际路径上报。
5. Freeze queue action 建议统一 validator。

### 仍属刻意不做

1. Production database。
2. Auth / 多用户隔离。
3. 外部通知发送与 delivery audit。
4. 系统日历 sync。
5. OCR PDF / PDF 表格重建。
6. 完整前端卡片手势与 proof dashboard。

## 下一步推荐

推荐先做一个“小修 + 可试用入口”切片：

1. 修掉本报告 P1/P2 的 5 个小问题。
2. 做一个极简后端 dogfood CLI 或最小网页，不做设计展示：
   - 输入 text/image/docx
   - 显示 review facts
   - confirm/correct
   - 选择 A/B/C
   - 执行 start/complete/freeze/defer
   - 展示 proof timeline
3. 跑 10-20 个真实/半真实 case：
   - 课表图
   - 群通知
   - DOCX 活动通知
   - prompt injection 文档
   - 拥挤时间线
   - hard lock 冲突

理由：

后端主链路已经够完整，继续堆服务收益下降。现在最大的风险变成“真实人怎么使用确认/选择/执行这条链”，也就是 dogfood 入口和 timeline 可理解性。

## Post-P0 Dogfood 收口状态

更新时间：2026-05-22。

已收口：

1. Proof Timeline 不再把 `reminder_created` 投影成 `reminder_delivered`，当前只表达 `提醒已记录`。
2. DOCX/PDF import 的 `providerUsage` 改为按实际 extraction path 上报：DOCX/TXT 本地文本抽取为 `document-text used:true`，PDF 不可抽取 fallback 为 `document-text used:false reason:document_text_unavailable`。
3. Card Runtime 的 `freeze-card` queue action 已进入 `validateQueueAction()` 校验；校验失败时返回 user-review queue action，不写冻结状态或 proof。
4. `pnpm backend:chain` 已明确打印 `multimodal provider: mock` 或 `route`，避免把 direct mock chain 误读成真实 MiMo。
5. 新增 `pnpm backend:dogfood`，可跑 `import -> confirm -> A/B/C -> card action -> proof timeline` 的开发者 CLI dogfood 链路。

本轮验证：

```text
pnpm test: 98 files / 556 tests passed.
pnpm typecheck: passed.
pnpm lint: passed.
pnpm build: passed.
pnpm backend:chain text-assignment: mock provider, deck_committed/card_started/card_completed.
pnpm backend:chain crowded-timeline: mock provider, defer-card, card_deferred.
pnpm backend:chain strict-image-confirmed: mock provider, strict review confirmed, card_completed.
pnpm backend:dogfood text: IMPORT_REVIEW strict, PLAN_OPTIONS plan-a/plan-b/plan-c, SELECTED plan-b, proof timeline deck_committed/card_started/card_completed.
pnpm real:mimo text: OK text-course-hardlock, parsed=true, options=3.
pnpm real:mimo image: OK courseSchedule, parsed=true, events=11, times=11, locations=2.
```

仍非阻塞：

- `pnpm real:mimo` 仍会输出 `MODULE_TYPELESS_PACKAGE_JSON` warning；这不影响 smoke 结果，仍不建议为了该 warning 给整个 package 增加 `"type": "module"`。
- 生产数据库、外部通知 delivery audit、日历 sync、OCR PDF/table reconstruction、完整前端 dogfood UI 仍然刻意不做。
