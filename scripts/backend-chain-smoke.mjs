#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const selectedOptionId = normalizeSelectedOption(args["selected-option"] || args.selectedOption || "plan-b");
const caseId = String(args.case || "text-assignment");
const rootDir = resolve(String(args.root || join(process.cwd(), ".nextcard-data", "backend-chain-runs", timestamp())));
mkdirSync(rootDir, { recursive: true });

const command = buildCase(caseId, selectedOptionId, args);
const multimodalProvider = args["route-url"] ? "route" : "mock";
const report = args["route-url"] ? await runViaRoute(String(args["route-url"]), command) : await runDirect(rootDir, command);
report.cli = {
  ...(report.cli || {}),
  multimodalProvider,
};
const reportPath = join(rootDir, "report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

printSummary(report, reportPath);
process.exit(report.errors?.length ? 1 : 0);

async function runDirect(rootDir, command) {
  register(new URL("./ts-alias-loader.mjs", import.meta.url));
  const [{ BackendSandboxRunService }, { MockMultimodalExtractor }] = await Promise.all([
    import("../lib/server/backend-orchestrator/sandbox-run-service.ts"),
    import("../lib/server/input-layer/mock-multimodal-extractor.ts"),
  ]);
  const service = new BackendSandboxRunService({
    sandboxRootDir: rootDir,
    multimodalExtractor: new MockMultimodalExtractor(),
    now: () => command.clientContext?.now || "2026-05-22T09:00:00.000Z",
  });
  return service.run(command);
}

async function runViaRoute(routeUrl, command) {
  const response = await fetch(routeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const text = await response.text();
  const body = JSON.parse(text);
  if (!response.ok) {
    throw new Error(`Route run failed with ${response.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

function buildCase(caseId, selectedOptionId, args) {
  const now = String(args.now || "2026-05-22T09:00:00.000Z");
  const base = {
    selectedOptionId,
    clientContext: {
      now,
      timezone: String(args.timezone || "Asia/Shanghai"),
      locale: "zh-CN",
      anonymousDeviceId: "backend-chain-cli",
    },
    notificationCapability: "in_app_only",
  };

  if (caseId === "text-assignment") {
    return {
      ...base,
      sourceType: "text",
      text: "写英语作文",
      cardActions: [{ action: "start" }, { action: "complete", actualMinutes: 6 }],
    };
  }

  if (caseId === "strict-image-confirmed") {
    return {
      ...base,
      sourceType: "image",
      text: "课表：周一 8:00 高数 三教201",
      filePath: typeof args.image === "string" ? String(args.image) : undefined,
      confirmation: { action: "confirm" },
      cardActions: [{ action: "complete", actualMinutes: 5 }],
    };
  }

  if (caseId === "crowded-timeline") {
    return {
      ...base,
      sourceType: "text",
      text: "写英语作文",
      availableWindows: [
        window("window_before_class", "2026-05-22T09:10:00.000Z", "2026-05-22T09:40:00.000Z"),
        window("window_after_class", "2026-05-22T11:30:00.000Z", "2026-05-22T12:30:00.000Z"),
      ],
      timeLocks: [
        {
          id: "lock_class_1",
          userId: "backend-chain-cli",
          kind: "class_time",
          startAt: "2026-05-22T09:45:00.000Z",
          endAt: "2026-05-22T11:15:00.000Z",
          timezone: "Asia/Shanghai",
          movable: false,
          sourceRefs: [{ rawInputId: "raw_cli", quote: "9:45-11:15 固定上课", confidence: 1 }],
          reviewStatus: "user-confirmed",
          conflictStatus: "none",
        },
      ],
      cardActions: [
        {
          action: "defer",
          deferToWindow: window("window_after_class", "2026-05-22T11:30:00.000Z", "2026-05-22T12:00:00.000Z"),
        },
      ],
    };
  }

  if (caseId === "notification-relative") {
    return {
      ...base,
      sourceType: "notification",
      text: "老师通知：明天交实验报告，别忘了。",
      confirmation: { action: "confirm" },
      cardActions: [{ action: "complete", actualMinutes: 7 }],
    };
  }

  throw new Error(`Unknown backend chain case: ${caseId}`);
}

function window(id, startAt, endAt) {
  return {
    id,
    startAt,
    endAt,
    timezone: "Asia/Shanghai",
    source: "user-stated",
    confidence: 1,
  };
}

function normalizeSelectedOption(value) {
  if (value === "plan-a" || value === "plan-b" || value === "plan-c") return value;
  if (value === "A" || value === "a") return "plan-a";
  if (value === "B" || value === "b") return "plan-b";
  if (value === "C" || value === "c") return "plan-c";
  throw new Error("--selected-option must be plan-a, plan-b, or plan-c.");
}

function printSummary(report, reportPath) {
  console.log(`BACKEND_CHAIN_REPORT ${reportPath}`);
  console.log(`multimodal provider: ${report.cli?.multimodalProvider ?? "unknown"}`);
  console.log(`import review: ${report.importReview?.reviewGate?.requirement ?? "unknown"}`);
  console.log(`fact confirmation required: ${Boolean(report.importReview?.reviewSessionId)}`);
  console.log(`selected option: ${report.committedDeck?.selectedOptionId ?? "none"}`);
  console.log(`committed deck/cards: ${report.committedDeck?.deckId ?? "none"} / ${report.committedCards?.length ?? 0}`);
  console.log(`queue actions: ${report.timeGuardianActions?.map((action) => action.type).join(",") || "none"}`);
  console.log(`card runtime actions: ${report.cardRuntimeActions?.map((result) => result.cardRuntimeState.status).join(",") || "none"}`);
  console.log(`proof timeline entries: ${report.proofTimeline?.map((entry) => entry.type).join(",") || "none"}`);
}

function printHelp() {
  console.log(`Usage:
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\\path\\schedule.jpg" --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-c
pnpm backend:chain -- --case notification-relative --selected-option plan-b

Options:
  --route-url URL     Send the case to a running /api/backend/sandbox/run route.
  --root DIR          Write CLI report and sandbox files under DIR.
`);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
