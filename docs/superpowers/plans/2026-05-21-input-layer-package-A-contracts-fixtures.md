# 任务包 A：输入整理层合同与测试样例包

> **执行要求：** 本包只定义第一层的共享合同、样例和测试基线。不要实现真实 ASR、OCR、Plan Mode、deck commit、reminder 或 proof 写入。

**目标：** 建立所有第一层子任务必须遵守的输入/输出 schema，避免后续执行者把“理解用户输入”写成一个无边界 agent。

**优先级：** P0

**依赖：** 无。应最先执行。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-input-layer-contract.md
lib/server/input-layer/types.ts
tests/server/input-layer/input-layer-fixtures.test.ts
tests/fixtures/input-layer/*.json
```

如果当前 repo 还没有 `lib/server/input-layer/` 或 `tests/server/input-layer/`，本包负责创建目录。

## 必须定义的合同

### RawInput

```ts
type RawInput = {
  id: string;
  userId?: string;
  anonymousDeviceId?: string;
  sourceType:
    | "voice"
    | "manual-dictation"
    | "text"
    | "image"
    | "pdf"
    | "docx"
    | "notification"
    | "mixed";
  contentRef?: string;
  text?: string;
  transcriptId?: string;
  sourceHash: string;
  locale: "zh-CN" | "en" | "mixed" | "auto";
  timezone?: string;
  createdAt: string;
  receivedAt: string;
  privacyFlags: Array<
    | "contains_third_party_info"
    | "contains_student_id"
    | "contains_grade_info"
    | "contains_location"
    | "unknown"
  >;
  retentionPolicy: {
    rawRetentionDays: number;
    derivedRetentionDays: number;
    userDeletable: boolean;
  };
};
```

### EvidenceRef

```ts
type EvidenceRef = {
  rawInputId: string;
  page?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textSpan?: {
    start: number;
    end: number;
  };
  quote?: string;
  confidence: number;
};
```

### InputExtractionResult

```ts
type InputExtractionResult = {
  id: string;
  rawInputId: string;
  modelRunId?: string;
  candidates: {
    tasks: TaskCandidate[];
    timeConstraints: TimeCandidate[];
    locations: LocationCandidate[];
    courses: CourseCandidate[];
    reminders: ReminderIntentCandidate[];
  };
  confidence: number;
  ambiguities: string[];
  warnings: InputWarning[];
  evidence: EvidenceRef[];
  reviewRequirement: "none" | "light" | "strict" | "blocked";
};
```

### FactConfirmationRequest

```ts
type FactConfirmationRequest = {
  id: string;
  rawInputId: string;
  mode: "light-card" | "rough-scope" | "strict-review" | "blocked";
  summary: string;
  facts: ConfirmableFact[];
  missingFields: Array<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle">;
  riskReasons: InputWarning[];
  canProceedToPlanMode: boolean;
};
```

### VerifiedInputBundle

```ts
type VerifiedInputBundle = {
  id: string;
  rawInputId: string;
  verifiedTaskFacts: ConfirmedTaskFact[];
  verifiedTimeFacts: ConfirmedTimeFact[];
  verifiedLocationFacts: ConfirmedLocationFact[];
  lifecycle: "one-off" | "fixed-recurring" | "unknown";
  tensionLevel: "hard" | "deadline-sensitive" | "recommended" | "soft" | "unknown";
  confirmationStatus: "confirmed" | "corrected" | "partially-confirmed";
  evidenceRefs: EvidenceRef[];
  readyForPlanCompiler: boolean;
};
```

### PlanCompilerHandoff

```ts
type PlanCompilerHandoff = {
  id: string;
  verifiedInputBundleId: string;
  userFacingSummary: string;
  constraints: string[];
  assumptions: string[];
  missingButNonBlocking: string[];
  sourceType: RawInput["sourceType"];
  mustGenerateABC: true;
};
```

## 必须覆盖的 fixture

在 `tests/fixtures/input-layer/` 下准备这些 JSON 样例：

```text
voice-go-to-calculus.json
ambiguous-voice-that-assignment.json
manual-dictation-reminder.json
image-timetable-low-confidence.json
pdf-assignment-deadline.json
notification-relative-date.json
mixed-multi-goal-input.json
prompt-injection-like-document.json
```

## 验收标准

- 所有第一层输出类型都明确区分 `candidate`、`confirmation request`、`verified bundle`、`plan handoff`。
- 类型层面不能出现 `committedDeck`、`cardState`、`proofRecord`、`reminderJob`、`profileSnapshot` 作为第一层直接输出。
- fixture 能表达小输入轻确认、大输入粗范围确认、strict review、blocked 四种路径。
- 测试能扫描 fixture 并验证字段完整性。

## 验证命令

```powershell
pnpm test tests/server/input-layer/input-layer-fixtures.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add docs/superpowers/specs/2026-05-21-input-layer-contract.md lib/server/input-layer/types.ts tests/server/input-layer tests/fixtures/input-layer
git commit -m "docs: define input layer contracts and fixtures"
```
