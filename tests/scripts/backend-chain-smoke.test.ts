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

describe("scripts/backend-chain-smoke.mjs", () => {
  it("runs a backend chain case without a dev server", async () => {
    tempDir = join(tmpdir(), `nextcard-backend-chain-${Date.now()}`);
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/backend-chain-smoke.mjs",
        "--case",
        "text-assignment",
        "--selected-option",
        "plan-b",
        "--root",
        tempDir,
      ],
      { cwd: process.cwd(), timeout: 120_000 },
    );
    const reportPath = stdout.match(/BACKEND_CHAIN_REPORT\s+(.+)/)?.[1]?.trim();
    expect(reportPath).toBeTruthy();
    const report = JSON.parse(await readFile(reportPath!, "utf8"));

    expect(stdout).toContain("proof timeline entries:");
    expect(stdout).toContain("multimodal provider:");
    expect(stdout).toContain("mock");
    expect(report.committedDeck.selectedOptionId).toBe("plan-b");
    expect(report.cli.multimodalProvider).toBe("mock");
    expect(report.proofTimeline.map((entry: { type: string }) => entry.type)).toContain("card_completed");
  });
});
