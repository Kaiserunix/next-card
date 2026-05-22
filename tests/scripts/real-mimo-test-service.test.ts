import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("real-mimo-test-service", () => {
  it("counts course schedule event time fields in the image summary", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "nextcard-real-mimo-"));
    tempDirs.push(cwd);

    const imagePath = join(cwd, "schedule.jpg");
    await writeFile(imagePath, Buffer.from("fake jpg payload"));

    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      if (request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }

      request.resume();
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sourceKind: "courseSchedule",
                  extractedEvents: [
                    { title: "高等数学", day: "周一", time: "08:00-09:30", location: "A101" },
                    { title: "大学英语", day: "周一", time: "10:00-11:30", location: "B204" },
                  ],
                  extractedTimes: [],
                  extractedLocations: [{ name: "A101" }, { name: "B204" }],
                  warnings: [],
                  needsStrictReview: true,
                }),
              },
            },
          ],
        }),
      );
    });

    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("test server did not expose a port");

      const scriptPath = resolve("scripts/real-mimo-test-service.mjs");
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          scriptPath,
          "--mode",
          "image",
          "--image",
          imagePath,
          "--limit",
          "1",
          "--timeout-ms",
          "5000",
          "--no-resize",
        ],
        {
          cwd,
          env: {
            ...process.env,
            MIMO_API_KEY: "tp-test-secret",
            MIMO_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
            MIMO_MULTIMODAL_MODEL: "mimo-v2.5",
          },
          timeout: 10000,
        },
      );

      expect(stdout).toContain("events=2");
      expect(stdout).toContain("times=2");
      expect(stdout).toContain("eventTimes=2");
      expect(stdout).toContain("standaloneTimes=0");

      const runDirLine = stdout.split(/\r?\n/).find((line) => line.startsWith("runDir="));
      expect(runDirLine).toBeDefined();
      const eventLog = await readFile(join(runDirLine!.slice("runDir=".length), "events.jsonl"), "utf8");
      const event = JSON.parse(eventLog.trim());
      expect(event.summary).toMatchObject({
        events: 2,
        times: 2,
        eventTimes: 2,
        standaloneTimes: 0,
        locations: 2,
      });

      const runDir = runDirLine!.slice("runDir=".length);
      const { stdout: summaryStdout } = await execFileAsync(process.execPath, [scriptPath, "--summarize", runDir], {
        cwd,
        env: { ...process.env },
        timeout: 10000,
      });
      expect(summaryStdout).toContain("ok=1 failed=0 skipped=0");
      expect(summaryStdout).toContain("totals events=2 times=2 locations=2");

      const summary = JSON.parse(await readFile(join(runDir, "summary.json"), "utf8"));
      expect(summary.imageSourceKindDistribution).toEqual({ courseSchedule: 1 });

      const { stdout: exportStdout } = await execFileAsync(process.execPath, [scriptPath, "--export-fixtures", runDir], {
        cwd,
        env: { ...process.env },
        timeout: 10000,
      });
      expect(exportStdout).toContain("EXPORT_FIXTURES");
      const fixture = await readFile(join(runDir, "exported-fixtures", "image-001-schedule.json"), "utf8");
      expect(fixture).not.toContain("data:image/");
      expect(fixture).not.toContain("tp-test-secret");
      expect(fixture).not.toContain('"content"');
    } finally {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  });
});
