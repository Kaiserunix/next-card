# 任务包 B：Raw Input Intake 包

> **执行要求：** 本包只处理原始输入进入系统的最小确定性入口。不要抽取任务，不要生成计划，不要写 deck/reminder/proof/profile。

**目标：** 创建稳定的 `RawInput` 入口，保存来源、hash、隐私 flags、保留策略和去重信息，为后续 extraction 提供干净材料。

**优先级：** P0

**依赖：** 任务包 A

## 涉及文件

```text
lib/server/input-layer/raw-input-service.ts
lib/server/input-layer/raw-input-repository.ts
lib/server/input-layer/source-hash.ts
tests/server/input-layer/raw-input-service.test.ts
tests/server/input-layer/source-hash.test.ts
```

## 服务边界

Raw Input Intake 可以做：

- 接收 `voice`、`manual-dictation`、`text`、`image`、`pdf`、`docx`、`notification`、`mixed` 来源。
- 生成 `inputId` 和 `sourceHash`。
- 标记隐私 flags。
- 设置 raw/derived retention policy。
- 去重相同 sourceHash 的重复输入。
- 对 `manual-dictation` 标记为 voice-like，但不计入 ASR quota。

Raw Input Intake 禁止做：

- 生成 task。
- 生成 deadline。
- 生成 hard lock。
- 生成 A/B/C。
- 创建 deck。
- 创建 reminder。
- 写 proof。
- 写 profile。

## 输入输出

输入：

```ts
type CreateRawInputCommand = {
  sourceType: RawInput["sourceType"];
  text?: string;
  transcriptId?: string;
  contentRef?: string;
  anonymousDeviceId?: string;
  locale?: RawInput["locale"];
  timezone?: string;
  receivedAt?: string;
};
```

输出：

```ts
type CreateRawInputResult = {
  rawInput: RawInput;
  duplicateOf?: string;
  acceptedForExtraction: boolean;
};
```

## 隐私 flag 规则

- 文本中出现学号、姓名、班级、成绩、老师/同学姓名时，至少标记 `contains_third_party_info` 或 `contains_student_id`。
- 图片/PDF/Word 默认至少带 `unknown`，直到 extraction 后再细分。
- location 明确出现教室、校区、住址时标记 `contains_location`。

## 去重规则

- `sourceHash` 应基于 source type、规范化文本或 content hash。
- 同一 device 同一天重复提交同一 hash，返回 `duplicateOf`。
- 重复输入可以返回已有 raw input，但不能自动推进到 deck。

## 验收用例

- 文本 `明天早八去高数课` 被保存为 `RawInput`，不产生 task。
- `manual-dictation` 保存为 voice-like source，不触发 ASR quota。
- 同一通知文本重复提交返回 duplicate。
- PDF 输入即使没有文本，也保存 contentRef、sourceHash、privacyFlags。
- 任何输出都不包含 deck、card、reminder、proof、profile 字段。

## 验证命令

```powershell
pnpm test tests/server/input-layer/raw-input-service.test.ts tests/server/input-layer/source-hash.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/input-layer/raw-input-service.ts lib/server/input-layer/raw-input-repository.ts lib/server/input-layer/source-hash.ts tests/server/input-layer
git commit -m "feat: add raw input intake service"
```
