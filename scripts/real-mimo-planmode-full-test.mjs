import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_BASE_URL = "http://127.0.0.1:3026";
const PLAN_FIXTURES = [
  "voice-confirmed-calculus-handoff.json",
  "text-confirmed-study-handoff.json",
  "manual-dictation-assignment-handoff.json",
  "multimodal-confirmed-timetable-handoff.json",
  "regenerate-from-previous-draft.json",
];

const baseUrl = readArg("--base-url") ?? process.env.NEXTCARD_REAL_TEST_BASE_URL ?? DEFAULT_BASE_URL;
const concurrency = Number(readArg("--concurrency") ?? process.env.NEXTCARD_REAL_TEST_CONCURRENCY ?? "2");
const runId = `real_mimo_full_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const startedAt = new Date().toISOString();

const cases = [
  ...(await loadPlanFixtureCases()),
  ...(await loadTimelineCases()),
];

const results = [];
let cursor = 0;

console.log(`[real-mimo] runId=${runId}`);
console.log(`[real-mimo] baseUrl=${baseUrl}`);
console.log(`[real-mimo] cases=${cases.length} concurrency=${concurrency}`);

await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async (_, workerIndex) => {
    while (cursor < cases.length) {
      const index = cursor;
      cursor += 1;
      const testCase = cases[index];
      const result = await runCase(testCase, index + 1, workerIndex + 1);
      results[index] = result;
    }
  }),
);

const finishedAt = new Date().toISOString();
const summary = summarize(results);
const payload = {
  runId,
  startedAt,
  finishedAt,
  baseUrl,
  totalCases: cases.length,
  summary,
  results,
};

await mkdir(path.join(ROOT, ".nextcard-data", "real-mimo-full-runs"), { recursive: true });
await mkdir(path.join(ROOT, "docs", "superpowers", "specs"), { recursive: true });

const jsonPath = path.join(ROOT, ".nextcard-data", "real-mimo-full-runs", `${runId}.json`);
const markdownPath = path.join(ROOT, "docs", "superpowers", "specs", "2026-05-21-real-mimo-full-test-report.md");
await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(markdownPath, renderMarkdown(payload, jsonPath), "utf8");

console.log(`[real-mimo] wroteJson=${jsonPath}`);
console.log(`[real-mimo] wroteReport=${markdownPath}`);
console.log(`[real-mimo] summary=${JSON.stringify(summary)}`);

if (summary.failed > 0) {
  process.exitCode = 1;
}

async function loadPlanFixtureCases() {
  const dir = path.join(ROOT, "tests", "fixtures", "plan-mode");
  const items = [];

  for (const fileName of PLAN_FIXTURES) {
    const fixture = JSON.parse(await readFile(path.join(dir, fileName), "utf8"));
    items.push({
      id: `fixture-${fileName.replace(/\.json$/, "")}`,
      group: "plan-fixture",
      source: fixture.source,
      complexity: "fixture",
      imageIndex: null,
      request: withUniqueRequestId(fixture, fileName.replace(/\.json$/, "")),
    });
  }

  return items;
}

async function loadTimelineCases() {
  const sourcePath = path.join(ROOT, "tests", "fixtures", "timeline-complexity", "image-timeline-agent-cases.ts");
  const content = await readFile(sourcePath, "utf8");
  const pattern = /id:\s*"([^"]+)",\s*\r?\n\s*complexity:\s*"([^"]+)",\s*\r?\n\s*imageIndex:\s*(\d+),\s*\r?\n\s*summary:\s*"([^"]+)"/g;
  const items = [];
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const [, id, complexity, imageIndex, summary] = match;
    items.push({
      id: `timeline-${id}`,
      group: "timeline-complexity",
      source: "multimodal-confirmed",
      complexity,
      imageIndex: Number(imageIndex),
      request: {
        requestId: `${runId}_${id}`,
        anonymousDeviceId: `real-mimo-${id}`,
        operation: "generate",
        source: "multimodal-confirmed",
        planCompilerHandoff: {
          id: `handoff_${id.replace(/-/g, "_")}`,
          verifiedInputBundleId: `bundle_${id.replace(/-/g, "_")}`,
          userFacingSummary: summary,
          constraints: [
            `timeline complexity: ${complexity}`,
            `generated image index: ${imageIndex}`,
            "facts are treated as human-reviewed confirmed test facts before Plan Mode",
          ],
          assumptions: [
            "This real-provider test checks Plan Mode planning, not OCR extraction.",
            "No deck/proof/reminder/schedule authority write is allowed in this route.",
          ],
          missingButNonBlocking: ["真实多模态 OCR/Mimo vision parser 不是本轮测试对象"],
          sourceType: "image",
          mustGenerateABC: true,
        },
        clientContext: {
          now: "2026-05-21T20:35:00+08:00",
          timezone: "Asia/Shanghai",
          locale: "zh-CN",
        },
      },
    });
  }

  if (items.length !== 24) {
    throw new Error(`Expected 24 timeline cases, found ${items.length}.`);
  }

  return items;
}

function withUniqueRequestId(fixture, slug) {
  return {
    ...fixture,
    requestId: `${runId}_${slug}`,
  };
}

async function runCase(testCase, ordinal, workerIndex) {
  const started = performance.now();
  const label = `${ordinal}/${cases.length} ${testCase.id}`;
  console.log(`[real-mimo][worker-${workerIndex}] start ${label}`);

  try {
    const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/api/backend/plan-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(testCase.request),
    }, 150_000);
    const durationMs = Math.round(performance.now() - started);
    const body = await response.json().catch(async () => ({ rawText: await response.text() }));

    const validation = validateResponse(response.status, body);
    const result = {
      id: testCase.id,
      group: testCase.group,
      source: testCase.source,
      complexity: testCase.complexity,
      imageIndex: testCase.imageIndex,
      ok: validation.ok,
      httpStatus: response.status,
      durationMs,
      validationErrors: validation.errors,
      draft: sanitizeDraft(body?.draft),
    };

    console.log(`[real-mimo][worker-${workerIndex}] done ${label} ok=${result.ok} status=${response.status} durationMs=${durationMs}`);
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    console.log(`[real-mimo][worker-${workerIndex}] error ${label} durationMs=${durationMs} error=${error instanceof Error ? error.message : String(error)}`);
    return {
      id: testCase.id,
      group: testCase.group,
      source: testCase.source,
      complexity: testCase.complexity,
      imageIndex: testCase.imageIndex,
      ok: false,
      httpStatus: null,
      durationMs,
      validationErrors: [error instanceof Error ? error.message : String(error)],
      draft: null,
    };
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function validateResponse(httpStatus, body) {
  const errors = [];
  const draft = body?.draft;

  if (httpStatus !== 200) errors.push(`HTTP status ${httpStatus}`);
  if (!draft) errors.push("missing draft");
  if (draft?.provider !== "mimo") errors.push(`provider is ${draft?.provider ?? "missing"}, expected mimo`);
  if (draft?.status !== "options-ready") errors.push(`status is ${draft?.status ?? "missing"}`);
  if (!Array.isArray(draft?.options) || draft.options.length !== 3) errors.push("options length is not 3");

  const modes = Array.isArray(draft?.options) ? draft.options.map((option) => option.mode).join(",") : "";
  if (modes !== "A,B,C") errors.push(`modes are ${modes}`);

  for (const option of draft?.options ?? []) {
    if (!Array.isArray(option.cardDrafts) || option.cardDrafts.length < 3) {
      errors.push(`${option.id ?? option.mode ?? "option"} has fewer than 3 cards`);
    }
  }

  const writes = draft?.writes;
  for (const key of ["deckCommitted", "proofWritten", "remindersCreated", "scheduleQueued"]) {
    if (writes?.[key] !== false) errors.push(`writes.${key} is not false`);
  }

  return { ok: errors.length === 0, errors };
}

function sanitizeDraft(draft) {
  if (!draft) return null;
  return {
    id: draft.id,
    requestId: draft.requestId,
    operation: draft.operation,
    source: draft.source,
    planCompilerHandoffId: draft.planCompilerHandoffId,
    verifiedInputBundleId: draft.verifiedInputBundleId,
    status: draft.status,
    goalUnderstanding: draft.goalUnderstanding,
    keyConstraints: draft.keyConstraints,
    decomposition: draft.decomposition,
    timeStrategy: draft.timeStrategy,
    options: draft.options,
    assumptions: draft.assumptions,
    missingButNonBlocking: draft.missingButNonBlocking,
    provider: draft.provider,
    modelRunId: draft.modelRunId,
    createdAt: draft.createdAt,
    writes: draft.writes,
  };
}

function summarize(items) {
  const byGroup = {};
  const byComplexity = {};
  for (const item of items) {
    byGroup[item.group] ??= { total: 0, passed: 0, failed: 0 };
    byComplexity[item.complexity] ??= { total: 0, passed: 0, failed: 0 };
    byGroup[item.group].total += 1;
    byComplexity[item.complexity].total += 1;
    if (item.ok) {
      byGroup[item.group].passed += 1;
      byComplexity[item.complexity].passed += 1;
    } else {
      byGroup[item.group].failed += 1;
      byComplexity[item.complexity].failed += 1;
    }
  }

  return {
    total: items.length,
    passed: items.filter((item) => item.ok).length,
    failed: items.filter((item) => !item.ok).length,
    byGroup,
    byComplexity,
    totalDurationMs: items.reduce((sum, item) => sum + item.durationMs, 0),
  };
}

function renderMarkdown(payload, jsonPath) {
  const failures = payload.results.filter((item) => !item.ok);
  return `# 2026-05-21 真全量真实 Mimo Plan Mode 测试报告

## 运行信息

- runId: \`${payload.runId}\`
- startedAt: \`${payload.startedAt}\`
- finishedAt: \`${payload.finishedAt}\`
- baseUrl: \`${payload.baseUrl}\`
- 原始结构化数据: \`${jsonPath}\`

## 覆盖范围

- 有效 Plan Mode handoff fixtures: 5 组
- 图片时间线 confirmed handoff: 24 组
- 总真实 Mimo API route 请求: ${payload.totalCases} 组

这些请求全部经过本地 \`/api/backend/plan-mode\` route，再由服务层调用真实 \`MimoPlanModeProvider\`。本轮不把图片重新送 OCR；24 个图片时间线用例按已 review/confirmed 后的 PlanCompilerHandoff 进入 Plan Mode。

## 汇总

\`\`\`text
total: ${payload.summary.total}
passed: ${payload.summary.passed}
failed: ${payload.summary.failed}
totalDurationMs: ${payload.summary.totalDurationMs}
\`\`\`

### 按分组

${Object.entries(payload.summary.byGroup)
  .map(([group, value]) => `- ${group}: ${value.passed}/${value.total} passed, ${value.failed} failed`)
  .join("\n")}

### 按复杂度

${Object.entries(payload.summary.byComplexity)
  .map(([complexity, value]) => `- ${complexity}: ${value.passed}/${value.total} passed, ${value.failed} failed`)
  .join("\n")}

## 验证断言

每组真实响应都检查：

- HTTP 200
- \`draft.provider === "mimo"\`
- \`draft.status === "options-ready"\`
- exactly A/B/C 三个方案
- 每个方案至少 3 张 action card
- \`writes.deckCommitted/proofWritten/remindersCreated/scheduleQueued\` 全部为 false

## 失败项

${failures.length === 0 ? "无。" : failures.map((item) => `- ${item.id}: ${item.validationErrors.join("; ")}`).join("\n")}

## 用例结果索引

${payload.results
  .map((item) => `- ${item.ok ? "PASS" : "FAIL"} ${item.id} provider=${item.draft?.provider ?? "n/a"} draft=${item.draft?.id ?? "n/a"} durationMs=${item.durationMs}`)
  .join("\n")}
`;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}
