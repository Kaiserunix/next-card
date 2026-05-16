import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/ci.yml";

describe("CI configuration", () => {
  it("runs install, lint, unit tests, and build on pull requests and main pushes", () => {
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("uses: pnpm/action-setup@v4");
    expect(workflow).toContain("run: pnpm install --frozen-lockfile");
    expect(workflow).toContain("run: pnpm lint");
    expect(workflow).toContain("run: pnpm test");
    expect(workflow).toContain("run: pnpm build");
    expect(workflow).not.toContain("pnpm test:e2e");
  });

  it("documents the handoff checks and keeps Playwright outside the default backend gate", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("pnpm lint\npnpm test\npnpm build");
    expect(readme).toContain(
      "Vitest covers the local backend state machine and mock AI contract; Playwright is reserved for small mobile WebView smoke flows."
    );
  });
});
