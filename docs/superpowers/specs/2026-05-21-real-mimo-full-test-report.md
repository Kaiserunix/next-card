# 2026-05-21 真全量真实 Mimo Plan Mode 测试报告

## 运行信息

- runId: `real_mimo_full_2026-05-21T12-49-09-763Z`
- startedAt: `2026-05-21T12:49:09.764Z`
- finishedAt: `2026-05-21T12:54:55.912Z`
- baseUrl: `http://127.0.0.1:3026`
- 原始结构化数据: `C:\Users\qwerf\Desktop\nextcard\.nextcard-data\real-mimo-full-runs\real_mimo_full_2026-05-21T12-49-09-763Z.json`

## 覆盖范围

- 有效 Plan Mode handoff fixtures: 5 组
- 图片时间线 confirmed handoff: 24 组
- 总真实 Mimo API route 请求: 29 组

这些请求全部经过本地 `/api/backend/plan-mode` route，再由服务层调用真实 `MimoPlanModeProvider`。本轮不把图片重新送 OCR；24 个图片时间线用例按已 review/confirmed 后的 PlanCompilerHandoff 进入 Plan Mode。

## 汇总

```text
total: 29
passed: 29
failed: 0
totalDurationMs: 683792
```

### 按分组

- plan-fixture: 5/5 passed, 0 failed
- timeline-complexity: 24/24 passed, 0 failed

### 按复杂度

- fixture: 5/5 passed, 0 failed
- low: 10/10 passed, 0 failed
- medium: 8/8 passed, 0 failed
- high: 6/6 passed, 0 failed

## 验证断言

每组真实响应都检查：

- HTTP 200
- `draft.provider === "mimo"`
- `draft.status === "options-ready"`
- exactly A/B/C 三个方案
- 每个方案至少 3 张 action card
- `writes.deckCommitted/proofWritten/remindersCreated/scheduleQueued` 全部为 false

## 失败项

无。

## 后续工程门禁

真实 Mimo 路由测试完成后，已关闭本轮临时 Next dev server（端口 `3026`），并继续执行完整本地门禁：

```text
pnpm test      PASS 70 files / 363 tests
pnpm lint      PASS
pnpm build     PASS
pnpm typecheck PASS
```

`pnpm build` 确认 `/api/backend/plan-mode` 仍作为动态 API route 编译进生产构建。

## 用例结果索引

- PASS fixture-voice-confirmed-calculus-handoff provider=mimo draft=draft_mimo_5692a88d-cd07-4ba0-b82f-33510b1fe758 durationMs=20716
- PASS fixture-text-confirmed-study-handoff provider=mimo draft=draft_mimo_1229cdef-64e6-46b5-b026-2cdca94f7eea durationMs=22695
- PASS fixture-manual-dictation-assignment-handoff provider=mimo draft=draft_mimo_1c900753-577d-4207-b94a-46ec4c0b0fbf durationMs=22171
- PASS fixture-multimodal-confirmed-timetable-handoff provider=mimo draft=draft_mimo_5b2bc4c2-4d79-4766-bc5d-e3ba8b81beb6 durationMs=18408
- PASS fixture-regenerate-from-previous-draft provider=mimo draft=draft_mimo_4f4fdf0b-8700-4d4a-8969-863ae6020050 durationMs=20470
- PASS timeline-low-01-calculus-arrival provider=mimo draft=draft_mimo_d792303b-7cc6-47a3-b853-0a2adb5bafa8 durationMs=24350
- PASS timeline-low-02-evening-checkin provider=mimo draft=draft_mimo_79ba3430-1d73-4289-97e4-8ce2cdeda22a durationMs=19587
- PASS timeline-low-03-library-window provider=mimo draft=draft_mimo_25b3fd06-9460-48be-ab99-07bb691072c3 durationMs=24159
- PASS timeline-low-04-office-hour provider=mimo draft=draft_mimo_54b37c3a-e67d-41b2-8cf3-bf1d2e25792a durationMs=23517
- PASS timeline-low-05-lab-single-slot provider=mimo draft=draft_mimo_9a05b2c3-2bf3-4ba6-9546-6519a3eb452c durationMs=24743
- PASS timeline-low-06-elective-online provider=mimo draft=draft_mimo_614b3a6d-16d1-4f0d-9d28-ba6e08832a1a durationMs=20053
- PASS timeline-low-07-morning-reading provider=mimo draft=draft_mimo_c6958bb3-b9ac-4d9f-b4a3-5f01d185cfb1 durationMs=22850
- PASS timeline-low-08-self-study-checkpoint provider=mimo draft=draft_mimo_128e4b5d-22a5-4f14-99d8-e4535c53efe4 durationMs=18811
- PASS timeline-low-09-single-deadline provider=mimo draft=draft_mimo_69ca6ebf-644d-4f6e-9e4f-920bce0334c1 durationMs=24267
- PASS timeline-low-10-course-reminder provider=mimo draft=draft_mimo_4145bc65-f03a-4b62-bbaf-33e49e2462a2 durationMs=25808
- PASS timeline-medium-01-paper-temporary-week provider=mimo draft=draft_mimo_34d667c7-b370-4c52-8ead-b6ddfc62c6c8 durationMs=20397
- PASS timeline-medium-02-whiteboard-lab-chain provider=mimo draft=draft_mimo_4920801a-c647-4420-9936-269d8bac620d durationMs=18346
- PASS timeline-medium-03-group-meeting-and-deadline provider=mimo draft=draft_mimo_c2cff27c-7bcb-40db-bf8a-b1f90ad681b2 durationMs=19377
- PASS timeline-medium-04-assignment-rubric provider=mimo draft=draft_mimo_878e5add-e599-46db-8fd3-fe811fcc076d durationMs=23892
- PASS timeline-medium-05-crowded-evening provider=mimo draft=draft_mimo_534033d9-7afa-4676-8011-7f76ce32f240 durationMs=21876
- PASS timeline-medium-06-review-reschedule-notification provider=mimo draft=draft_mimo_da91f5f2-5a93-4c1d-a24b-2c49a3cd6111 durationMs=26271
- PASS timeline-medium-07-recurring-plus-oneoff provider=mimo draft=draft_mimo_adddd51c-d2af-450a-8306-a9591916e667 durationMs=21498
- PASS timeline-medium-08-weekend-chain provider=mimo draft=draft_mimo_4c7e2aeb-680f-456a-ad15-7dfebc4fce94 durationMs=23960
- PASS timeline-high-01-physics-vs-essay-conflict provider=mimo draft=draft_mimo_192f26f2-96b7-4713-af29-58169ef91bb8 durationMs=28513
- PASS timeline-high-02-overlapping-classes provider=mimo draft=draft_mimo_126a8ac4-ece7-430b-919b-f642cfaedb3b durationMs=23222
- PASS timeline-high-03-prompt-like-writing-assignment provider=mimo draft=draft_mimo_bb561ba1-feb4-4397-9957-fe25f192d53b durationMs=28570
- PASS timeline-high-04-system-command-in-course-pdf provider=mimo draft=draft_mimo_51ee8176-ea82-49c6-b65b-477ff907ccbf durationMs=36015
- PASS timeline-high-05-dark-unreadable-image provider=mimo draft=draft_mimo_bc66170a-5b13-48a6-b69a-8dff368ca766 durationMs=34201
- PASS timeline-high-06-stacked-notification-updates provider=mimo draft=draft_mimo_26b2a4a9-b447-48aa-abe1-7745e3ebea79 durationMs=25049
