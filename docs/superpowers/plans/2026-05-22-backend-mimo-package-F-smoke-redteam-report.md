# F：真实 smoke、红队与报告收口包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 固化真实 MiMo 与后端闭环的验收、红队和报告产物。

**Architecture:** 在 `pnpm real:mimo` 上增加 summary/export 能力，同时补 route/backend 边界红队测试。验收结果写文档，不提交 `.nextcard-data`。

**Tech Stack:** Node.js CLI, TypeScript/Vitest tests, Markdown acceptance reports, MiMo live smoke.

---

## 目标

把两部分补完后的验收固定下来：本地单元/集成测试、route-level smoke、真实 MiMo smoke、批量图片慢跑报告、红队边界全部可复现。

## 文件

- Modify: `scripts/real-mimo-test-service.mjs`
- Modify: `docs/real-mimo-test-service.md`
- Create: `docs/superpowers/specs/2026-05-22-backend-mimo-redteam-cases.md`
- Create: `docs/superpowers/specs/2026-05-22-backend-mimo-acceptance-report.md`
- Test: `tests/scripts/real-mimo-test-service.test.ts`
- Test: `tests/server/backend-boundary-redteam.test.ts`

## 需要新增的 CLI 能力

```powershell
pnpm real:mimo -- --summarize latest
pnpm real:mimo -- --export-fixtures latest
```

`--summarize` 输出：

- ok/failed/skipped
- timeout count
- non-json count
- schema-invalid count
- image sourceKind distribution
- extractedEvents/extractedTimes/extractedLocations totals

`--export-fixtures` 输出：

- sanitized JSON fixtures
- 不包含 token
- 不包含 data URL 原文

## 红队场景

- 图片里包含 `ignore previous instructions`。
- 课程表图片 OCR 时间冲突。
- 通知文本说“明天交”，但 source timestamp 缺失。
- MiMo 返回 JSON 但没有 `needsStrictReview`。
- MiMo 返回 A/B/C 但某个 option 没有 card。
- Commit 请求选择不存在的 option。
- Time Guardian 试图调度未选择 option。
- Proof 请求包含羞辱性语言。
- 无通知权限但 report 说 external reminder 已设置。

## 验收

```powershell
pnpm test tests/scripts/real-mimo-test-service.test.ts tests/server/backend-boundary-redteam.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --limit 5 --delay-ms 1500 --timeout-ms 180000
```

## 不做

- 不跑完整 55 张作为默认 CI。
- 不提交 `.nextcard-data`。
- 不暴露 token。
