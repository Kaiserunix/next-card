# C：真实 Import Review Route 包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 新增真实 import route，把文本/图片输入跑到 extraction + Review Gate。

**Architecture:** Route 只解析 FormData 并调用 `ImportReviewService`；service 选择 text/manual/mimo extractor，然后输出 `ImportReviewReport`。路由不能 commit deck，也不能写 proof/reminder/profile。

**Tech Stack:** Next.js App Router route handlers, FormData, TypeScript, Vitest, Next Card input-layer services.

---

## 目标

新增真实 import route，把文本/图片输入跑到 `ReviewGate`，输出 `ImportReviewReport`。这是 MiMo 图片进入产品后端的第一条正式路由，但仍不 commit deck。

## 文件

- Create: `app/api/backend/import/route.ts`
- Create: `lib/server/import-review/import-review-service.ts`
- Create: `lib/server/import-review/types.ts`
- Test: `tests/api/backend/import/import-route.test.ts`
- Test: `tests/server/import-review/import-review-service.test.ts`

## 请求

`POST /api/backend/import`

FormData:

```text
sourceType = text | manual-dictation | notification | image | pdf | docx | mixed
text?
file?
clientContext = JSON string { now, timezone, locale }
sandboxMode = true
```

## 响应

```ts
type ImportReviewReport = {
  reportId: string;
  rawInputId: string;
  sourceType: RawInputSourceType;
  extraction: InputExtractionResult;
  reviewGate: ReviewGateDecision;
  canProceedToPlanMode: boolean;
  planCompilerHandoff?: PlanCompilerHandoff;
  boundaryWarnings: string[];
  providerUsage: {
    provider: "mimo" | "mock" | "manual";
    model?: string;
    used: boolean;
  };
};
```

## 步骤

- [ ] 写 API 测试：text input -> light/strict review report。
- [ ] 写 API 测试：image upload with mocked MiMo -> strict review report。
- [ ] 写 API 测试：prompt injection image text -> strict/blocked，不写 deck/proof。
- [ ] 写 service 测试：confirmed facts 足够时可生成 `PlanCompilerHandoff`。
- [ ] 实现 `types.ts`。
- [ ] 实现 `import-review-service.ts`。
- [ ] 实现 route，保持 route thin。
- [ ] route response 不包含 `MIMO_API_KEY`。

## 验收

```powershell
pnpm test tests/server/import-review/import-review-service.test.ts tests/api/backend/import/import-route.test.ts
pnpm test tests/server/input-layer tests/api/backend
pnpm typecheck
pnpm lint
pnpm build
```

## 不做

- 不把 import report 自动送入 `Deck Commit`。
- 不做前端上传页面。
- 不做 PDF/DOCX P1 解析。
