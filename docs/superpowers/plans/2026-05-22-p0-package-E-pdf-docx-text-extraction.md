# E：PDF/DOCX 最小文本抽取包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 让 `POST /api/backend/import` 对 PDF/DOCX 文件走服务端文本抽取，再进入现有 input-layer/review gate，而不是对非图片文件直接 blocked。

**Architecture:** P0 只实现 text extraction，不实现复杂 OCR、版式理解或表格重建。抽取出的文本仍是 source content，必须经过 Review Gate；DDL、hard lock、课程时间等高风险事实仍需确认。

**Tech Stack:** TypeScript, Vitest, Node server utilities. Prefer existing dependencies; only add a dependency if the repo lacks a reasonable extractor and the dependency is small/stable.

---

## 目标

当前 import route 接受 `pdf` / `docx` sourceType，但真实能力主要是图片和文本。P0 需要最小文档解析：可抽文本就按文本交给 extractor/review；抽不出来就返回 recoverable review state，提示需要粘贴文本或换图片。

## 文件

- Create: `lib/server/input-layer/document-text-extractor.ts`
- Modify: `lib/server/import-review/import-review-service.ts`
- Modify: `lib/server/input-layer/types.ts` if new warning is needed
- Test: `tests/server/input-layer/document-text-extractor.test.ts`
- Test: `tests/api/backend/import/import-route-document.test.ts`

## 支持范围

- `.txt`：直接读取 UTF-8 文本。
- `.docx`：抽取正文 XML 文本，保留段落分隔。
- `.pdf`：优先用可用文本抽取能力；若当前依赖不足，则实现 recoverable fallback，不假装成功。
- 大文件：限制 bytes/page count，超限返回 blocked/recoverable review。

## 输出策略

成功抽取：

```text
RawInput(sourceType=pdf/docx, contentRef=filePath, text=extractedText)
-> text extraction worker or document-aware extraction
-> strict review if deadline/hard lock/table/relative date appears
```

失败：

```text
ImportReviewReport {
  reviewGate.requirement = "blocked",
  errors/reasons include "document_text_unavailable",
  canProceedToPlanMode = false
}
```

## 步骤

- [ ] 实现 `extractDocumentText({ filePath, sourceType })`。
- [ ] DOCX：读取 zip 中 `word/document.xml`，去 XML tag，保留段落空格。
- [ ] TXT：读取 UTF-8，限制长度。
- [ ] PDF：若能用现有环境抽文本则实现；否则明确返回 recoverable fallback。
- [ ] ImportReviewService 对 `pdf/docx/txt` 文件先抽文本，再创建 RawInput。
- [ ] 抽取文本不得被当成系统指令；prompt-like 文本要触发 warning。
- [ ] 写测试：docx 中文通知能抽出 deadline 文本并进入 strict review。
- [ ] 写测试：prompt injection docx 不会写 proof/deck。
- [ ] 写测试：不可抽取 PDF 返回 recoverable blocked，不进入 Plan Mode。
- [ ] 写测试：route response 不包含原始文件全文和 token。

## 验收

```powershell
pnpm test tests/server/input-layer/document-text-extractor.test.ts tests/api/backend/import/import-route-document.test.ts
pnpm test tests/server/input-layer tests/api/backend/import
pnpm typecheck
pnpm lint
```

## 不做

- 不做 OCR PDF。
- 不做复杂表格结构还原。
- 不从 PDF/DOCX 静默创建 hard lock。
- 不把文档里的 prompt-like 文本当系统指令。
