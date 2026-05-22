#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { extname, join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const selectedOptionId = normalizeSelectedOption(args["selected-option"] || args.selectedOption || "plan-b");
const sourceType = normalizeSourceType(args.source || inferSourceType(args.file) || "text");
const rootDir = resolve(String(args.root || join(process.cwd(), ".nextcard-data", "backend-dogfood-runs", timestamp())));
mkdirSync(rootDir, { recursive: true });

const command = buildCommand({ args, selectedOptionId, sourceType });
const providerMode = args["route-url"] ? "route" : "mock";
const report = args["route-url"] ? await runViaRoute(String(args["route-url"]), command) : await runDirect(rootDir, command);
report.dogfood = {
  ...(report.dogfood || {}),
  multimodalProvider: providerMode,
  sourceType,
  selectedOptionId,
};

const reportPath = join(rootDir, "report.json");
writeFileSync(reportPath, `${JSON.stringify(redactSensitive(report), null, 2)}\n`, "utf8");

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
  if (command.filePath) {
    throw new Error("--route-url does not accept local --file paths. Upload through the import route or run direct mode.");
  }
  const response = await fetch(routeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const text = await response.text();
  const body = JSON.parse(text);
  if (!response.ok) {
    throw new Error(`Route dogfood failed with ${response.status}: ${sanitize(text).slice(0, 300)}`);
  }
  return body;
}

function buildCommand({ args, selectedOptionId, sourceType }) {
  const now = String(args.now || "2026-05-22T09:00:00.000Z");
  return {
    sourceType,
    text: textForSource(args, sourceType),
    filePath: typeof args.file === "string" ? String(args.file) : undefined,
    selectedOptionId,
    confirmation: args["no-confirm"] ? undefined : { action: "confirm" },
    cardActions: parseActions(String(args.actions || "complete")),
    notificationCapability: "in_app_only",
    clientContext: {
      now,
      timezone: String(args.timezone || "Asia/Shanghai"),
      locale: "zh-CN",
      anonymousDeviceId: "backend-dogfood-cli",
    },
  };
}

function textForSource(args, sourceType) {
  if (typeof args.text === "string" && args.text.trim()) return args.text;
  if (sourceType === "image") return "课表：周一 8:00 高数 三教201";
  if (sourceType === "notification") return "老师通知：明天交实验报告，别忘了。";
  return "今晚八点前交英语作文";
}

function parseActions(value) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((action, index) => {
      const normalized = normalizeAction(action);
      return {
        action: normalized,
        actualMinutes: normalized === "complete" ? 6 : undefined,
        requestId: `dogfood_card_action_${index + 1}_${normalized}`,
      };
    });
}

function normalizeAction(value) {
  const normalized = value.replace(/-/g, "_");
  if (
    normalized === "start" ||
    normalized === "complete" ||
    normalized === "freeze" ||
    normalized === "burn_start" ||
    normalized === "burn_complete" ||
    normalized === "defer" ||
    normalized === "resume"
  ) {
    return normalized;
  }
  throw new Error(`Unsupported --actions item: ${value}`);
}

function printSummary(report, reportPath) {
  const facts = report.importReview?.reviewGate?.confirmationRequest?.facts ?? [];
  const factSummary = facts.length
    ? facts.map((fact) => `${fact.field}:${sanitize(fact.value)}`).join(" | ")
    : `missing:${(report.importReview?.reviewGate?.confirmationRequest?.missingFields ?? []).join(",") || "none"}`;
  const planOptions = report.planModeDraft?.options?.map((option) => option.id).join(",") || "none";
  const cardActions = report.cardRuntimeActions?.map((result) => result.cardRuntimeState.status).join(",") || "none";
  const proofTimeline = report.proofTimeline?.map((entry) => entry.type).join(",") || "none";

  console.log(`DOGFOOD_PROVIDER ${report.dogfood?.multimodalProvider ?? "unknown"}`);
  console.log(`IMPORT_REVIEW ${report.importReview?.reviewGate?.requirement ?? "unknown"}`);
  console.log(`FACTS ${factSummary}`);
  console.log(`PLAN_OPTIONS ${planOptions}`);
  console.log(`SELECTED ${report.committedDeck?.selectedOptionId ?? "none"}`);
  console.log(`CARD_ACTIONS ${cardActions}`);
  console.log(`PROOF_TIMELINE ${proofTimeline}`);
  console.log(`REPORT ${reportPath}`);
}

function normalizeSelectedOption(value) {
  if (value === "plan-a" || value === "plan-b" || value === "plan-c") return value;
  if (value === "A" || value === "a") return "plan-a";
  if (value === "B" || value === "b") return "plan-b";
  if (value === "C" || value === "c") return "plan-c";
  throw new Error("--selected-option must be plan-a, plan-b, or plan-c.");
}

function normalizeSourceType(value) {
  if (
    value === "text" ||
    value === "image" ||
    value === "pdf" ||
    value === "docx" ||
    value === "notification" ||
    value === "manual-dictation" ||
    value === "voice" ||
    value === "mixed"
  ) {
    return value;
  }
  throw new Error("--source must be text, image, pdf, docx, notification, manual-dictation, voice, or mixed.");
}

function inferSourceType(file) {
  if (typeof file !== "string") return undefined;
  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp") return "image";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  return undefined;
}

function redactSensitive(value) {
  return JSON.parse(sanitize(JSON.stringify(value)));
}

function sanitize(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/tp-[A-Za-z0-9._-]+/g, "tp-[redacted]")
    .replace(/MIMO_API_KEY\s*=\s*[^\s"']+/g, "MIMO_API_KEY=[redacted]")
    .replace(/data:[^"'\s]+/g, "data:[redacted]");
}

function printHelp() {
  console.log(`Usage:
pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
pnpm backend:dogfood -- --source image --file "C:\\path\\schedule.jpg" --confirm --selected-option plan-b --actions complete

Options:
  --source TYPE       text, image, pdf, docx, notification, manual-dictation, voice, or mixed.
  --text TEXT         Source text for text/manual/notification or image context.
  --file PATH         Local file path for direct CLI mode.
  --confirm          Confirm strict review facts before Plan Mode. This is the default.
  --no-confirm       Stop after import review when confirmation is required.
  --selected-option  plan-a, plan-b, or plan-c. Required for deck commit; defaults to plan-b.
  --actions LIST     Comma-separated card actions: start,complete,freeze,burn-start,burn-complete,defer,resume.
  --route-url URL    Send to a running /api/backend/sandbox/run route. Local --file is disabled in route mode.
  --root DIR         Write dogfood report and sandbox files under DIR.
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
