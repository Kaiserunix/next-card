import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("scripts/backend-dogfood.mjs", () => {
  it("runs a direct deterministic dogfood chain and writes a report", async () => {
    tempDir = join(tmpdir(), `nextcard-backend-dogfood-${Date.now()}`);
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/backend-dogfood.mjs",
        "--text",
        "今晚八点前交英语作文",
        "--selected-option",
        "plan-b",
        "--confirm",
        "--actions",
        "start,complete",
        "--root",
        tempDir,
      ],
      { cwd: process.cwd(), timeout: 120_000 },
    );
    const reportPath = stdout.match(/REPORT\s+(.+)/)?.[1]?.trim();
    expect(reportPath).toBeTruthy();
    const report = JSON.parse(await readFile(reportPath!, "utf8"));

    expect(stdout).toContain("IMPORT_REVIEW");
    expect(stdout).toContain("PLAN_OPTIONS");
    expect(stdout).toContain("PROOF_TIMELINE");
    expect(stdout).toContain("DOGFOOD_PROVIDER mock");
    expect(report.committedDeck.selectedOptionId).toBe("plan-b");
    expect(report.proofTimeline.map((entry: { type: string }) => entry.type)).toContain("card_completed");
  });
});
