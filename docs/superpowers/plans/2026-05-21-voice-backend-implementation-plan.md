# Voice Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Next Card backend slice for voice input: short-audio ASR, quota control, confirmed transcript metadata, light normalization, and readiness gating.

**Architecture:** Route handlers under `app/api/backend/voice/*` stay thin and delegate to focused services under `lib/server/voice/*`. Provider calls go through `SpeechToTextPort`; Volcengine is the only implemented provider in this slice, while Aliyun/Tencent remain typed adapter slots. Deck/proof state stays in frontend `localStorage`; backend JSON storage is authoritative only for voice usage and confirmed transcript metadata.

**Tech Stack:** Next.js App Router, TypeScript, Node `fs/promises`, Vitest, Volcengine big-model flash recording-file recognition API.

---

## Source Specs

- `docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md`
- `docs/superpowers/specs/2026-05-21-nextcard-pm-question-log.md`
- Volcengine API reference: `https://www.volcengine.com/docs/6561/1631584?lang=zh`

## Current Repo State

The root workspace is currently a design-first baseline. Most implementation files are deleted from root and archived under `废弃文件夹/旧实现-20260520-225958`; the teammate frontend is checked out at `external/next-card-119`. This plan is written for the root workspace. If the teammate frontend is imported first, keep its UI files and merge only the backend files from this plan.

## File Structure

- Create `package.json`: restores Next/Vitest scripts for root implementation.
- Create `next.config.mjs`, `tsconfig.json`, `vitest.config.ts`: minimal build and test foundation.
- Create `.eslintrc.json`, `.eslintignore`, `next-env.d.ts`: lint and Next type foundation.
- Create `app/layout.tsx`, `app/page.tsx`: minimal shell so `next build` has an app surface before final frontend import.
- Create `app/api/backend/voice/transcribe/route.ts`: validates request, checks quota, calls ASR, normalizes, stores confirmed metadata only after explicit confirmation in a follow-up request.
- Create `app/api/backend/voice/normalize/route.ts`: returns raw and normalized text without writing proof/deck state.
- Create `app/api/backend/voice/readiness/route.ts`: returns `direct-plan`, `confirm-understanding`, or `retry-transcript`.
- Create `app/api/backend/voice/confirm/route.ts`: stores only user-confirmed transcript metadata.
- Create `lib/server/backend-ports.ts`: shared backend provider ports and adapter-slot exports.
- Create `lib/server/voice/types.ts`: voice data contracts.
- Create `lib/server/voice/errors.ts`: typed service errors and HTTP mapping.
- Create `lib/server/voice/config.ts`: env parsing and default quota.
- Create `lib/server/voice/normalization-service.ts`: light transcript cleanup.
- Create `lib/server/voice/readiness-service.ts`: confidence and ambiguity gate.
- Create `lib/server/voice/usage-repository.ts`: `VoiceUsageRepository` plus local JSON implementation.
- Create `lib/server/voice/transcript-repository.ts`: `VoiceTranscriptRepository` plus local JSON implementation.
- Create `lib/server/voice/usage-limit-service.ts`: per-device quota enforcement.
- Create `lib/server/voice/volcengine-asr-provider.ts`: Volcengine `X-Api-Key` adapter.
- Create `lib/server/voice/request-validation.ts`: request parsing shared by routes.
- Create tests under `tests/server/voice/*` and `tests/api/backend/voice/*`.
- Modify `.gitignore`: ignore `.nextcard-data/` local JSON records.

## Task 1: Runtime Skeleton And Test Foundation

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.eslintrc.json`
- Create: `.eslintignore`
- Create: `next-env.d.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Modify: `.gitignore`

- [ ] **Step 1: Restore package scripts**

Create `package.json`:

```json
{
  "name": "next-card",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "vitest run",
    "typecheck": "tsc --noEmit --incremental false"
  },
  "dependencies": {
    "framer-motion": "12.38.0",
    "lucide-react": "1.16.0",
    "next": "15.5.18",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "zustand": "5.0.9"
  },
  "devDependencies": {
    "@types/node": "24.10.1",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "autoprefixer": "10.4.22",
    "eslint": "8.57.1",
    "eslint-config-next": "15.5.18",
    "postcss": "8.5.6",
    "tailwindcss": "3.4.19",
    "typescript": "5.9.3",
    "vitest": "4.0.14"
  }
}
```

- [ ] **Step 2: Add TypeScript and test config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "external", "废弃文件夹"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
```

Create `.eslintrc.json`:

```json
{
  "extends": ["next/core-web-vitals"]
}
```

Create `.eslintignore`:

```gitignore
.next
node_modules
external
废弃文件夹
.nextcard-data
```

Create `next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is generated once for the backend-capable root shell.
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Add a minimal app shell**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Card",
  description: "Next Card backend-capable MVP shell",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/page.tsx`:

```tsx
export default function Page() {
  return (
    <main>
      <h1>Next Card</h1>
      <p>Backend-capable shell for voice Plan Mode integration.</p>
    </main>
  );
}
```

Create `app/globals.css`:

```css
:root {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 4: Ignore local backend data**

Add this line to `.gitignore`:

```gitignore
.nextcard-data/
```

- [ ] **Step 5: Install and verify the skeleton**

Run:

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Expected:

```text
typecheck exits 0
test exits 0 with no test files, or exits 0 with tests added in following tasks
build exits 0
```

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml next.config.mjs tsconfig.json vitest.config.ts .eslintrc.json .eslintignore next-env.d.ts app .gitignore
git commit -m "chore: restore backend-capable next skeleton"
```

## Task 2: Voice Contracts And Error Model

**Files:**
- Create: `lib/server/backend-ports.ts`
- Create: `lib/server/voice/types.ts`
- Create: `lib/server/voice/errors.ts`
- Test: `tests/server/voice/types.test.ts`

- [ ] **Step 1: Write the type contract test**

Create `tests/server/voice/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SpeechTranscript, VoiceUsageLimit } from "@/lib/server/voice/types";

describe("voice type contracts", () => {
  it("keeps manual dictation separate from paid ASR providers", () => {
    const transcript: SpeechTranscript = {
      id: "tr_1",
      text: "明天早八高数课提醒我出门",
      rawTranscript: "明天早八高数课提醒我出门",
      normalizedText: "明天早八高数课提醒我出门。",
      source: "manual-dictation",
      provider: "manual",
      language: "zh-CN",
      confidence: 1,
      userConfirmed: true,
      createdAt: "2026-05-21T00:00:00.000Z",
    };

    expect(transcript.source).toBe("manual-dictation");
    expect(transcript.provider).toBe("manual");
  });

  it("expresses the experience quota defaults", () => {
    const limit: VoiceUsageLimit = {
      maxDurationMsPerClip: 30_000,
      maxClipsPerDay: 30,
      maxTotalDurationMsPerDay: 600_000,
      provider: "volcengine",
    };

    expect(limit.maxClipsPerDay).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
pnpm test tests/server/voice/types.test.ts
```

Expected:

```text
FAIL Cannot find module '@/lib/server/voice/types'
```

- [ ] **Step 3: Add contracts**

Create `lib/server/voice/types.ts`:

```ts
export type SpeechInputSource =
  | "manual-dictation"
  | "web-recording"
  | "web-speech"
  | "android-native"
  | "volcengine-asr"
  | "aliyun-asr"
  | "tencent-asr"
  | "self-hosted-asr"
  | "mimo-asr";

export type SpeechProviderName =
  | "volcengine"
  | "aliyun"
  | "tencent"
  | "manual"
  | "android"
  | "mimo";

export type SpeechTranscript = {
  id: string;
  text: string;
  rawTranscript: string;
  normalizedText: string;
  source: SpeechInputSource;
  provider?: SpeechProviderName;
  language: "zh-CN" | "en" | "mixed" | "auto";
  durationMs?: number;
  confidence?: number;
  userConfirmed: boolean;
  createdAt: string;
};

export type VoicePlanGate = "direct-plan" | "confirm-understanding" | "retry-transcript";

export type VoicePlanReadiness = {
  gate: VoicePlanGate;
  confidence: number;
  reasons: string[];
  understandingPreview?: string;
  missingInfoChips?: string[];
};

export type VoiceUsageLimit = {
  maxDurationMsPerClip: number;
  maxClipsPerDay: number;
  maxTotalDurationMsPerDay: number;
  provider: "volcengine";
};

export type VoiceQuotaSubject = {
  kind: "device" | "user";
  id: string;
};

export type VoiceUsageRecord = {
  id: string;
  subject: VoiceQuotaSubject;
  provider: "volcengine" | "aliyun" | "tencent";
  durationMs: number;
  createdAt: string;
  status: "accepted" | "rejected" | "failed";
};

export type ConfirmedVoiceTranscriptRecord = {
  transcript: SpeechTranscript & { userConfirmed: true };
  anonymousDeviceId: string;
  confirmedAt: string;
};
```

Create `lib/server/backend-ports.ts`:

```ts
import type { SpeechTranscript } from "@/lib/server/voice/types";

export type SpeechProviderMode = "batch-audio" | "streaming";

export type SpeechToTextInput = {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  requestId: string;
  anonymousDeviceId: string;
};

export interface SpeechToTextPort {
  readonly provider: "volcengine" | "aliyun" | "tencent";
  readonly mode: SpeechProviderMode;
  transcribeAudio(input: SpeechToTextInput): Promise<SpeechTranscript>;
  createStreamingSession?(input: unknown): Promise<unknown>;
}
```

Create `lib/server/voice/errors.ts`:

```ts
export type VoiceErrorCode =
  | "BAD_REQUEST"
  | "QUOTA_EXCEEDED"
  | "CONFIG_MISSING"
  | "PROVIDER_FAILED";

export class VoiceServiceError extends Error {
  constructor(
    public readonly code: VoiceErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "VoiceServiceError";
  }
}

export function toVoiceErrorResponse(error: unknown): Response {
  if (error instanceof VoiceServiceError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }

  return Response.json(
    { error: "PROVIDER_FAILED", message: "Voice backend request failed." },
    { status: 500 },
  );
}
```

- [ ] **Step 4: Run the test**

Run:

```powershell
pnpm test tests/server/voice/types.test.ts
pnpm typecheck
```

Expected:

```text
PASS tests/server/voice/types.test.ts
typecheck exits 0
```

- [ ] **Step 5: Commit**

```powershell
git add lib/server/backend-ports.ts lib/server/voice/types.ts lib/server/voice/errors.ts tests/server/voice/types.test.ts
git commit -m "feat: add voice backend contracts"
```

## Task 3: Normalization And Readiness Services

**Files:**
- Create: `lib/server/voice/normalization-service.ts`
- Create: `lib/server/voice/readiness-service.ts`
- Test: `tests/server/voice/normalization-service.test.ts`
- Test: `tests/server/voice/readiness-service.test.ts`

- [ ] **Step 1: Write normalization tests**

Create `tests/server/voice/normalization-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";

describe("normalizeTranscript", () => {
  it("removes filler words and duplicated starts without changing intent", () => {
    const result = normalizeTranscript("呃呃 明天 明天早八高数课提醒我出门");

    expect(result.normalizedText).toBe("明天早八高数课提醒我出门。");
    expect(result.changedTooMuch).toBe(false);
  });

  it("keeps short ambiguous input visible for readiness instead of inventing details", () => {
    const result = normalizeTranscript("那个作业");

    expect(result.normalizedText).toBe("那个作业。");
    expect(result.changedTooMuch).toBe(false);
  });
});
```

- [ ] **Step 2: Write readiness tests**

Create `tests/server/voice/readiness-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateVoicePlanReadiness } from "@/lib/server/voice/readiness-service";

describe("evaluateVoicePlanReadiness", () => {
  it("allows high-confidence actionable transcript into direct Plan Mode", () => {
    const result = evaluateVoicePlanReadiness({
      normalizedText: "明天早八高数课提醒我 7 点 40 出门。",
      confidence: 0.92,
      normalizationChangedTooMuch: false,
    });

    expect(result.gate).toBe("direct-plan");
    expect(result.missingInfoChips).toEqual([]);
  });

  it("asks for lightweight understanding confirmation on unresolved references", () => {
    const result = evaluateVoicePlanReadiness({
      normalizedText: "明天那个作业。",
      confidence: 0.66,
      normalizationChangedTooMuch: false,
    });

    expect(result.gate).toBe("confirm-understanding");
    expect(result.missingInfoChips).toContain("具体任务对象");
  });

  it("returns retry-transcript for unusably short speech", () => {
    const result = evaluateVoicePlanReadiness({
      normalizedText: "那个。",
      confidence: 0.3,
      normalizationChangedTooMuch: false,
    });

    expect(result.gate).toBe("retry-transcript");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
pnpm test tests/server/voice/normalization-service.test.ts tests/server/voice/readiness-service.test.ts
```

Expected:

```text
FAIL Cannot find module '@/lib/server/voice/normalization-service'
FAIL Cannot find module '@/lib/server/voice/readiness-service'
```

- [ ] **Step 4: Implement normalization**

Create `lib/server/voice/normalization-service.ts`:

```ts
export type NormalizedTranscript = {
  rawTranscript: string;
  normalizedText: string;
  changedTooMuch: boolean;
};

const FILLER_PATTERN = /(呃+|嗯+|那个|就是)/g;

export function normalizeTranscript(rawTranscript: string): NormalizedTranscript {
  const collapsed = rawTranscript
    .replace(FILLER_PATTERN, " ")
    .replace(/(.{2,8})\s+\1/g, "$1")
    .replace(/\s+/g, "")
    .trim();

  const normalizedText = addTerminalPunctuation(collapsed || rawTranscript.trim());
  const changedRatio = rawTranscript.length === 0 ? 0 : 1 - normalizedText.length / rawTranscript.length;

  return {
    rawTranscript,
    normalizedText,
    changedTooMuch: changedRatio > 0.55,
  };
}

function addTerminalPunctuation(text: string): string {
  if (!text) return text;
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}
```

- [ ] **Step 5: Implement readiness**

Create `lib/server/voice/readiness-service.ts`:

```ts
import type { VoicePlanReadiness } from "@/lib/server/voice/types";

export type ReadinessInput = {
  normalizedText: string;
  confidence?: number;
  normalizationChangedTooMuch: boolean;
};

const UNRESOLVED_REFERENCES = ["这个", "那个", "这件事", "那件事"];

export function evaluateVoicePlanReadiness(input: ReadinessInput): VoicePlanReadiness {
  const confidence = input.confidence ?? 1;
  const reasons: string[] = [];
  const missingInfoChips: string[] = [];
  const text = input.normalizedText.trim();

  if (text.length <= 3 || confidence < 0.4) {
    return {
      gate: "retry-transcript",
      confidence,
      reasons: ["语音内容过短或识别置信度过低"],
      understandingPreview: text,
      missingInfoChips: ["重新说一遍"],
    };
  }

  if (confidence < 0.75) reasons.push("识别置信度偏低");
  if (input.normalizationChangedTooMuch) reasons.push("转写清理改动较大");
  if (UNRESOLVED_REFERENCES.some((word) => text.includes(word))) {
    reasons.push("存在未解析指代");
    missingInfoChips.push("具体任务对象");
  }
  if (looksTimeSensitiveButIncomplete(text)) {
    reasons.push("时间信息不完整");
    missingInfoChips.push("具体时间");
  }
  if (looksLikeMultipleGoals(text)) {
    reasons.push("可能包含多个目标");
    missingInfoChips.push("先做哪一个");
  }

  if (reasons.length > 0) {
    return {
      gate: "confirm-understanding",
      confidence,
      reasons,
      understandingPreview: buildUnderstandingPreview(text),
      missingInfoChips,
    };
  }

  return {
    gate: "direct-plan",
    confidence,
    reasons: [],
    understandingPreview: buildUnderstandingPreview(text),
    missingInfoChips: [],
  };
}

function looksTimeSensitiveButIncomplete(text: string): boolean {
  return /(明天|今晚|今天|早八|课前|截止|ddl|deadline)/i.test(text) && !/(\d{1,2}[:：点]|上午|下午|晚上|早上)/.test(text);
}

function looksLikeMultipleGoals(text: string): boolean {
  return /(还有|然后|顺便|以及|另外)/.test(text);
}

function buildUnderstandingPreview(text: string): string {
  return `我理解你想处理：${text.replace(/[。！？!?]$/, "")}`;
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
pnpm test tests/server/voice/normalization-service.test.ts tests/server/voice/readiness-service.test.ts
pnpm typecheck
```

Expected:

```text
PASS normalization-service.test.ts
PASS readiness-service.test.ts
typecheck exits 0
```

- [ ] **Step 7: Commit**

```powershell
git add lib/server/voice/normalization-service.ts lib/server/voice/readiness-service.ts tests/server/voice
git commit -m "feat: add voice normalization and readiness gate"
```

## Task 4: Usage Repository And Quota Service

**Files:**
- Create: `lib/server/voice/usage-repository.ts`
- Create: `lib/server/voice/transcript-repository.ts`
- Create: `lib/server/voice/usage-limit-service.ts`
- Create: `lib/server/voice/config.ts`
- Test: `tests/server/voice/usage-repository.test.ts`
- Test: `tests/server/voice/transcript-repository.test.ts`
- Test: `tests/server/voice/usage-limit-service.test.ts`

- [ ] **Step 1: Write repository tests**

Create `tests/server/voice/usage-repository.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalJsonVoiceUsageRepository } from "@/lib/server/voice/usage-repository";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("LocalJsonVoiceUsageRepository", () => {
  it("persists and reads usage records", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-voice-"));
    const repo = new LocalJsonVoiceUsageRepository(join(tempDir, "voice-usage.json"));

    await repo.append({
      id: "usage_1",
      subject: { kind: "device", id: "device_a" },
      provider: "volcengine",
      durationMs: 20_000,
      createdAt: "2026-05-21T01:00:00.000Z",
      status: "accepted",
    });

    const records = await repo.listForSubjectOnDay(
      { kind: "device", id: "device_a" },
      "2026-05-21",
    );

    expect(records).toHaveLength(1);
    expect(records[0].durationMs).toBe(20_000);
  });
});
```

- [ ] **Step 2: Write confirmed transcript repository tests**

Create `tests/server/voice/transcript-repository.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalJsonVoiceTranscriptRepository } from "@/lib/server/voice/transcript-repository";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("LocalJsonVoiceTranscriptRepository", () => {
  it("stores only confirmed transcript records", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-transcript-"));
    const repo = new LocalJsonVoiceTranscriptRepository(join(tempDir, "voice-transcripts.json"));

    await repo.append({
      anonymousDeviceId: "device_a",
      confirmedAt: "2026-05-21T01:02:00.000Z",
      transcript: {
        id: "tr_1",
        text: "明天早八高数课提醒我出门。",
        rawTranscript: "明天早八高数课提醒我出门",
        normalizedText: "明天早八高数课提醒我出门。",
        source: "volcengine-asr",
        provider: "volcengine",
        language: "zh-CN",
        durationMs: 20_000,
        confidence: 0.82,
        userConfirmed: true,
        createdAt: "2026-05-21T01:00:00.000Z",
      },
    });

    const records = await repo.listForDevice("device_a");

    expect(records).toHaveLength(1);
    expect(records[0].transcript.userConfirmed).toBe(true);
  });
});
```

- [ ] **Step 3: Write quota tests**

Create `tests/server/voice/usage-limit-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VoiceUsageLimitService } from "@/lib/server/voice/usage-limit-service";
import type { VoiceUsageRecord } from "@/lib/server/voice/types";

const baseRecord: VoiceUsageRecord = {
  id: "usage_1",
  subject: { kind: "device", id: "device_a" },
  provider: "volcengine",
  durationMs: 30_000,
  createdAt: "2026-05-21T01:00:00.000Z",
  status: "accepted",
};

describe("VoiceUsageLimitService", () => {
  it("rejects clips longer than 30 seconds", () => {
    const service = new VoiceUsageLimitService();

    const result = service.check({ durationMs: 31_000, existingRecords: [] });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("30 seconds");
  });

  it("rejects the 31st accepted clip in one day", () => {
    const service = new VoiceUsageLimitService();
    const existingRecords = Array.from({ length: 30 }, (_, index) => ({
      ...baseRecord,
      id: `usage_${index}`,
    }));

    const result = service.check({ durationMs: 1_000, existingRecords });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("30 clips");
  });

  it("does not count failed provider attempts toward daily accepted quota", () => {
    const service = new VoiceUsageLimitService();
    const existingRecords = [{ ...baseRecord, status: "failed" as const }];

    const result = service.check({ durationMs: 1_000, existingRecords });

    expect(result.allowed).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```powershell
pnpm test tests/server/voice/usage-repository.test.ts tests/server/voice/transcript-repository.test.ts tests/server/voice/usage-limit-service.test.ts
```

Expected:

```text
FAIL Cannot find module '@/lib/server/voice/usage-repository'
FAIL Cannot find module '@/lib/server/voice/transcript-repository'
FAIL Cannot find module '@/lib/server/voice/usage-limit-service'
```

- [ ] **Step 5: Implement config**

Create `lib/server/voice/config.ts`:

```ts
import { join } from "node:path";
import type { VoiceUsageLimit } from "@/lib/server/voice/types";

export const DEFAULT_VOICE_USAGE_LIMIT: VoiceUsageLimit = {
  maxDurationMsPerClip: 30_000,
  maxClipsPerDay: 30,
  maxTotalDurationMsPerDay: 600_000,
  provider: "volcengine",
};

export type VolcengineAsrConfig = {
  apiKey: string;
  resourceId: string;
  endpoint: string;
};

export function getVoiceUsageFilePath(): string {
  return process.env.NEXTCARD_VOICE_USAGE_FILE ?? join(process.cwd(), ".nextcard-data", "voice-usage.json");
}

export function getVoiceTranscriptFilePath(): string {
  return process.env.NEXTCARD_VOICE_TRANSCRIPT_FILE ?? join(process.cwd(), ".nextcard-data", "voice-transcripts.json");
}

export function getVolcengineAsrConfig(): VolcengineAsrConfig {
  return {
    apiKey: process.env.VOLCENGINE_ASR_API_KEY ?? "",
    resourceId: process.env.VOLCENGINE_ASR_RESOURCE_ID ?? "volc.bigasr.auc_turbo",
    endpoint:
      process.env.VOLCENGINE_ASR_ENDPOINT ??
      "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash",
  };
}
```

- [ ] **Step 6: Implement repositories and quota service**

Create `lib/server/voice/usage-repository.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { VoiceQuotaSubject, VoiceUsageRecord } from "@/lib/server/voice/types";

export interface VoiceUsageRepository {
  append(record: VoiceUsageRecord): Promise<void>;
  listForSubjectOnDay(subject: VoiceQuotaSubject, yyyyMmDd: string): Promise<VoiceUsageRecord[]>;
}

export class LocalJsonVoiceUsageRepository implements VoiceUsageRepository {
  constructor(private readonly filePath: string) {}

  async append(record: VoiceUsageRecord): Promise<void> {
    const records = await this.readAll();
    records.push(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  async listForSubjectOnDay(subject: VoiceQuotaSubject, yyyyMmDd: string): Promise<VoiceUsageRecord[]> {
    const records = await this.readAll();
    return records.filter((record) => {
      return (
        record.subject.kind === subject.kind &&
        record.subject.id === subject.id &&
        record.createdAt.startsWith(yyyyMmDd)
      );
    });
  }

  private async readAll(): Promise<VoiceUsageRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as VoiceUsageRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
```

Create `lib/server/voice/transcript-repository.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConfirmedVoiceTranscriptRecord } from "@/lib/server/voice/types";

export interface VoiceTranscriptRepository {
  append(record: ConfirmedVoiceTranscriptRecord): Promise<void>;
  listForDevice(anonymousDeviceId: string): Promise<ConfirmedVoiceTranscriptRecord[]>;
}

export class LocalJsonVoiceTranscriptRepository implements VoiceTranscriptRepository {
  constructor(private readonly filePath: string) {}

  async append(record: ConfirmedVoiceTranscriptRecord): Promise<void> {
    const records = await this.readAll();
    records.push(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  async listForDevice(anonymousDeviceId: string): Promise<ConfirmedVoiceTranscriptRecord[]> {
    const records = await this.readAll();
    return records.filter((record) => record.anonymousDeviceId === anonymousDeviceId);
  }

  private async readAll(): Promise<ConfirmedVoiceTranscriptRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as ConfirmedVoiceTranscriptRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
```

Create `lib/server/voice/usage-limit-service.ts`:

```ts
import { DEFAULT_VOICE_USAGE_LIMIT } from "@/lib/server/voice/config";
import type { VoiceUsageLimit, VoiceUsageRecord } from "@/lib/server/voice/types";

export type VoiceQuotaCheckInput = {
  durationMs: number;
  existingRecords: VoiceUsageRecord[];
};

export type VoiceQuotaCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export class VoiceUsageLimitService {
  constructor(private readonly limit: VoiceUsageLimit = DEFAULT_VOICE_USAGE_LIMIT) {}

  check(input: VoiceQuotaCheckInput): VoiceQuotaCheckResult {
    if (input.durationMs > this.limit.maxDurationMsPerClip) {
      return { allowed: false, reason: "Single clip exceeds 30 seconds." };
    }

    const accepted = input.existingRecords.filter((record) => record.status === "accepted");
    if (accepted.length >= this.limit.maxClipsPerDay) {
      return { allowed: false, reason: "Daily quota exceeds 30 clips." };
    }

    const usedDuration = accepted.reduce((sum, record) => sum + record.durationMs, 0);
    if (usedDuration + input.durationMs > this.limit.maxTotalDurationMsPerDay) {
      return { allowed: false, reason: "Daily quota exceeds 10 minutes." };
    }

    return { allowed: true };
  }
}
```

- [ ] **Step 7: Run tests**

Run:

```powershell
pnpm test tests/server/voice/usage-repository.test.ts tests/server/voice/transcript-repository.test.ts tests/server/voice/usage-limit-service.test.ts
pnpm typecheck
```

Expected:

```text
PASS usage-repository.test.ts
PASS transcript-repository.test.ts
PASS usage-limit-service.test.ts
typecheck exits 0
```

- [ ] **Step 8: Commit**

```powershell
git add lib/server/voice/config.ts lib/server/voice/usage-repository.ts lib/server/voice/transcript-repository.ts lib/server/voice/usage-limit-service.ts tests/server/voice
git commit -m "feat: add voice usage quota storage"
```

## Task 5: Volcengine ASR Provider

**Files:**
- Create: `lib/server/voice/volcengine-asr-provider.ts`
- Test: `tests/server/voice/volcengine-asr-provider.test.ts`

- [ ] **Step 1: Write provider tests with mocked fetch**

Create `tests/server/voice/volcengine-asr-provider.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { VolcengineAsrProvider } from "@/lib/server/voice/volcengine-asr-provider";

describe("VolcengineAsrProvider", () => {
  it("sends new-console X-Api-Key headers and returns transcript", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          audio_info: { duration: 2499 },
          result: { text: "关闭透传。", utterances: [] },
        }),
        {
          status: 200,
          headers: {
            "X-Api-Status-Code": "20000000",
            "X-Api-Message": "OK",
          },
        },
      ),
    );
    const provider = new VolcengineAsrProvider(
      {
        apiKey: "volc_key",
        resourceId: "volc.bigasr.auc_turbo",
        endpoint: "https://example.test/recognize",
      },
      fetchMock,
    );

    const transcript = await provider.transcribeAudio({
      audioBase64: "UklGRg==",
      mimeType: "audio/wav",
      durationMs: 2499,
      requestId: "req_1",
      anonymousDeviceId: "device_a",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/recognize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Api-Key": "volc_key",
          "X-Api-Resource-Id": "volc.bigasr.auc_turbo",
          "X-Api-Request-Id": "req_1",
          "X-Api-Sequence": "-1",
        }),
      }),
    );
    expect(transcript.rawTranscript).toBe("关闭透传。");
    expect(transcript.source).toBe("volcengine-asr");
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run:

```powershell
pnpm test tests/server/voice/volcengine-asr-provider.test.ts
```

Expected:

```text
FAIL Cannot find module '@/lib/server/voice/volcengine-asr-provider'
```

- [ ] **Step 3: Implement provider**

Create `lib/server/voice/volcengine-asr-provider.ts`:

```ts
import type { SpeechToTextInput, SpeechToTextPort } from "@/lib/server/backend-ports";
import { VoiceServiceError } from "@/lib/server/voice/errors";
import type { VolcengineAsrConfig } from "@/lib/server/voice/config";
import type { SpeechTranscript } from "@/lib/server/voice/types";

type FetchLike = typeof fetch;

type VolcengineRecognizeResponse = {
  audio_info?: { duration?: number };
  result?: { text?: string };
};

export class VolcengineAsrProvider implements SpeechToTextPort {
  readonly provider = "volcengine" as const;
  readonly mode = "batch-audio" as const;

  constructor(
    private readonly config: VolcengineAsrConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async transcribeAudio(input: SpeechToTextInput): Promise<SpeechTranscript> {
    if (!this.config.apiKey) {
      throw new VoiceServiceError("CONFIG_MISSING", "VOLCENGINE_ASR_API_KEY is required.", 500);
    }

    const response = await this.fetchImpl(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.config.apiKey,
        "X-Api-Resource-Id": this.config.resourceId,
        "X-Api-Request-Id": input.requestId,
        "X-Api-Sequence": "-1",
      },
      body: JSON.stringify({
        user: { uid: input.anonymousDeviceId },
        audio: { data: input.audioBase64 },
        request: { model_name: "bigmodel" },
      }),
    });

    const statusCode = response.headers.get("X-Api-Status-Code");
    if (!response.ok || statusCode !== "20000000") {
      throw new VoiceServiceError("PROVIDER_FAILED", "Volcengine ASR request failed.", 502);
    }

    const payload = (await response.json()) as VolcengineRecognizeResponse;
    const text = payload.result?.text?.trim();
    if (!text) {
      throw new VoiceServiceError("PROVIDER_FAILED", "Volcengine ASR returned empty text.", 502);
    }

    return {
      id: `tr_${input.requestId}`,
      text,
      rawTranscript: text,
      normalizedText: text,
      source: "volcengine-asr",
      provider: "volcengine",
      language: "zh-CN",
      durationMs: payload.audio_info?.duration ?? input.durationMs,
      confidence: 0.8,
      userConfirmed: false,
      createdAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
pnpm test tests/server/voice/volcengine-asr-provider.test.ts
pnpm typecheck
```

Expected:

```text
PASS volcengine-asr-provider.test.ts
typecheck exits 0
```

- [ ] **Step 5: Commit**

```powershell
git add lib/server/voice/volcengine-asr-provider.ts tests/server/voice/volcengine-asr-provider.test.ts
git commit -m "feat: add volcengine asr provider"
```

## Task 6: Voice API Routes

**Files:**
- Create: `lib/server/voice/request-validation.ts`
- Create: `app/api/backend/voice/transcribe/route.ts`
- Create: `app/api/backend/voice/normalize/route.ts`
- Create: `app/api/backend/voice/readiness/route.ts`
- Create: `app/api/backend/voice/confirm/route.ts`
- Test: `tests/api/backend/voice/normalize-route.test.ts`
- Test: `tests/api/backend/voice/readiness-route.test.ts`
- Test: `tests/api/backend/voice/confirm-route.test.ts`

- [ ] **Step 1: Write route tests for normalize and readiness**

Create `tests/api/backend/voice/normalize-route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/voice/normalize/route";

describe("POST /api/backend/voice/normalize", () => {
  it("normalizes text without storing state", async () => {
    const response = await POST(
      new Request("http://localhost/api/backend/voice/normalize", {
        method: "POST",
        body: JSON.stringify({ rawTranscript: "呃 明天 明天早八高数课提醒我出门" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.normalizedText).toBe("明天早八高数课提醒我出门。");
  });
});
```

Create `tests/api/backend/voice/confirm-route.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/voice/confirm/route";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
  delete process.env.NEXTCARD_VOICE_TRANSCRIPT_FILE;
});

describe("POST /api/backend/voice/confirm", () => {
  it("stores confirmed transcript metadata only", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-confirm-"));
    process.env.NEXTCARD_VOICE_TRANSCRIPT_FILE = join(tempDir, "voice-transcripts.json");

    const response = await POST(
      new Request("http://localhost/api/backend/voice/confirm", {
        method: "POST",
        body: JSON.stringify({
          anonymousDeviceId: "device_a",
          transcript: {
            id: "tr_1",
            text: "明天早八高数课提醒我出门。",
            rawTranscript: "明天早八高数课提醒我出门",
            normalizedText: "明天早八高数课提醒我出门。",
            source: "volcengine-asr",
            provider: "volcengine",
            language: "zh-CN",
            durationMs: 20_000,
            confidence: 0.82,
            userConfirmed: true,
            createdAt: "2026-05-21T01:00:00.000Z",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.saved).toBe(true);
  });
});
```

Create `tests/api/backend/voice/readiness-route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/voice/readiness/route";

describe("POST /api/backend/voice/readiness", () => {
  it("returns missing-info chips for ambiguous voice input", async () => {
    const response = await POST(
      new Request("http://localhost/api/backend/voice/readiness", {
        method: "POST",
        body: JSON.stringify({
          normalizedText: "明天那个作业。",
          confidence: 0.62,
          normalizationChangedTooMuch: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.gate).toBe("confirm-understanding");
    expect(body.missingInfoChips).toContain("具体任务对象");
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```powershell
pnpm test tests/api/backend/voice/normalize-route.test.ts tests/api/backend/voice/readiness-route.test.ts tests/api/backend/voice/confirm-route.test.ts
```

Expected:

```text
FAIL Cannot find module '@/app/api/backend/voice/normalize/route'
FAIL Cannot find module '@/app/api/backend/voice/readiness/route'
FAIL Cannot find module '@/app/api/backend/voice/confirm/route'
```

- [ ] **Step 3: Add request validation helpers**

Create `lib/server/voice/request-validation.ts`:

```ts
import { VoiceServiceError } from "@/lib/server/voice/errors";

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new VoiceServiceError("BAD_REQUEST", "Request body must be a JSON object.", 400);
  }
  return payload as Record<string, unknown>;
}

export function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new VoiceServiceError("BAD_REQUEST", `${key} is required.`, 400);
  }
  return value;
}

export function optionalNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new VoiceServiceError("BAD_REQUEST", `${key} must be a number.`, 400);
  }
  return value;
}

export function optionalBoolean(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new VoiceServiceError("BAD_REQUEST", `${key} must be a boolean.`, 400);
  }
  return value;
}
```

- [ ] **Step 4: Implement normalize and readiness routes**

Create `app/api/backend/voice/normalize/route.ts`:

```ts
import { toVoiceErrorResponse } from "@/lib/server/voice/errors";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";
import { readJsonObject, requireString } from "@/lib/server/voice/request-validation";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const rawTranscript = requireString(payload, "rawTranscript");
    return Response.json(normalizeTranscript(rawTranscript));
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}
```

Create `app/api/backend/voice/readiness/route.ts`:

```ts
import { toVoiceErrorResponse } from "@/lib/server/voice/errors";
import { optionalBoolean, optionalNumber, readJsonObject, requireString } from "@/lib/server/voice/request-validation";
import { evaluateVoicePlanReadiness } from "@/lib/server/voice/readiness-service";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const normalizedText = requireString(payload, "normalizedText");
    const confidence = optionalNumber(payload, "confidence");
    const normalizationChangedTooMuch = optionalBoolean(payload, "normalizationChangedTooMuch");

    return Response.json(
      evaluateVoicePlanReadiness({
        normalizedText,
        confidence,
        normalizationChangedTooMuch,
      }),
    );
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}
```

Create `app/api/backend/voice/confirm/route.ts`:

```ts
import { getVoiceTranscriptFilePath } from "@/lib/server/voice/config";
import { toVoiceErrorResponse, VoiceServiceError } from "@/lib/server/voice/errors";
import { readJsonObject, requireString } from "@/lib/server/voice/request-validation";
import { LocalJsonVoiceTranscriptRepository } from "@/lib/server/voice/transcript-repository";
import type { SpeechTranscript } from "@/lib/server/voice/types";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const anonymousDeviceId = requireString(payload, "anonymousDeviceId");
    const transcript = payload.transcript as SpeechTranscript | undefined;

    if (!transcript || typeof transcript !== "object") {
      throw new VoiceServiceError("BAD_REQUEST", "transcript is required.", 400);
    }
    if (transcript.userConfirmed !== true) {
      throw new VoiceServiceError("BAD_REQUEST", "Only confirmed transcripts can be saved.", 400);
    }

    const repository = new LocalJsonVoiceTranscriptRepository(getVoiceTranscriptFilePath());
    await repository.append({
      anonymousDeviceId,
      transcript: transcript as SpeechTranscript & { userConfirmed: true },
      confirmedAt: new Date().toISOString(),
    });

    return Response.json({ saved: true });
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}
```

- [ ] **Step 5: Implement transcribe route**

Create `app/api/backend/voice/transcribe/route.ts`:

```ts
import { randomUUID } from "node:crypto";
import { getVoiceUsageFilePath, getVolcengineAsrConfig } from "@/lib/server/voice/config";
import { toVoiceErrorResponse, VoiceServiceError } from "@/lib/server/voice/errors";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";
import { readJsonObject, requireString, optionalNumber } from "@/lib/server/voice/request-validation";
import { LocalJsonVoiceUsageRepository } from "@/lib/server/voice/usage-repository";
import { VoiceUsageLimitService } from "@/lib/server/voice/usage-limit-service";
import { VolcengineAsrProvider } from "@/lib/server/voice/volcengine-asr-provider";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const anonymousDeviceId = requireString(payload, "anonymousDeviceId");
    const audioBase64 = requireString(payload, "audioBase64");
    const mimeType = requireString(payload, "mimeType");
    const durationMs = optionalNumber(payload, "durationMs") ?? 0;
    if (durationMs <= 0) {
      throw new VoiceServiceError("BAD_REQUEST", "durationMs is required.", 400);
    }

    const subject = { kind: "device" as const, id: anonymousDeviceId };
    const today = new Date().toISOString().slice(0, 10);
    const usageRepository = new LocalJsonVoiceUsageRepository(getVoiceUsageFilePath());
    const existingRecords = await usageRepository.listForSubjectOnDay(subject, today);
    const quota = new VoiceUsageLimitService().check({ durationMs, existingRecords });
    if (!quota.allowed) {
      throw new VoiceServiceError("QUOTA_EXCEEDED", quota.reason, 429);
    }

    const requestId = randomUUID();
    const provider = new VolcengineAsrProvider(getVolcengineAsrConfig());
    const transcript = await provider.transcribeAudio({
      audioBase64,
      mimeType,
      durationMs,
      requestId,
      anonymousDeviceId,
    });
    const normalized = normalizeTranscript(transcript.rawTranscript);

    await usageRepository.append({
      id: `usage_${requestId}`,
      subject,
      provider: "volcengine",
      durationMs,
      createdAt: new Date().toISOString(),
      status: "accepted",
    });

    return Response.json({
      ...transcript,
      text: normalized.normalizedText,
      normalizedText: normalized.normalizedText,
      userConfirmed: false,
      normalizationChangedTooMuch: normalized.changedTooMuch,
    });
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}
```

- [ ] **Step 6: Run API tests and full backend checks**

Run:

```powershell
pnpm test tests/api/backend/voice/normalize-route.test.ts tests/api/backend/voice/readiness-route.test.ts tests/api/backend/voice/confirm-route.test.ts
pnpm test tests/server/voice
pnpm typecheck
pnpm lint
pnpm build
```

Expected:

```text
all targeted tests pass
typecheck exits 0
lint exits 0
build exits 0
```

- [ ] **Step 7: Commit**

```powershell
git add app/api/backend/voice lib/server/voice/request-validation.ts tests/api/backend/voice
git commit -m "feat: expose voice backend routes"
```

## Task 7: Documentation And Handoff

**Files:**
- Create: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md`

- [ ] **Step 1: Add env example**

Create `.env.example`:

```dotenv
VOLCENGINE_ASR_API_KEY=
VOLCENGINE_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
VOLCENGINE_ASR_ENDPOINT=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
NEXTCARD_VOICE_USAGE_FILE=.nextcard-data/voice-usage.json
NEXTCARD_VOICE_TRANSCRIPT_FILE=.nextcard-data/voice-transcripts.json
```

- [ ] **Step 2: Update README backend section**

Add this section to `README.md`:

```md
## Voice Backend Slice

The first backend-capable slice covers voice input only:

- `POST /api/backend/voice/transcribe`
- `POST /api/backend/voice/normalize`
- `POST /api/backend/voice/readiness`
- `POST /api/backend/voice/confirm`

The experience version uses Volcengine ASR through `VOLCENGINE_ASR_API_KEY` and `VOLCENGINE_ASR_RESOURCE_ID=volc.bigasr.auc_turbo`.

Limits:

- 30 seconds per clip
- 30 clips per anonymous device per day
- 10 total minutes per anonymous device per day

The backend stores voice usage records and confirmed transcript metadata in local JSON. Deck and proof state remain frontend `localStorage` state in this slice.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected:

```text
test exits 0
typecheck exits 0
lint exits 0
build exits 0
```

- [ ] **Step 4: Commit**

```powershell
git add .env.example README.md docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md
git commit -m "docs: document voice backend slice"
```

## Self-Review

- Spec coverage: The plan covers batch Volcengine ASR, new `X-Api-Key` credential shape, quota limits, anonymous-device identity, local JSON usage storage, confirmed transcript metadata storage, light normalization, readiness gating, manual-dictation separation, and Aliyun/Tencent adapter slots as types only.
- Scope check: The plan does not implement Plan Mode, deck/proof backend writes, streaming ASR, Android native bridge, Aliyun/Tencent providers, or frontend redesign.
- Verification: Each code task includes failing tests first, targeted pass commands, and final `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- Type consistency: `SpeechTranscript`, `VoicePlanReadiness`, `VoiceUsageRecord`, and `SpeechToTextPort` signatures are introduced before services and routes consume them.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-voice-backend-implementation-plan.md`.

Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, with checkpoints.
