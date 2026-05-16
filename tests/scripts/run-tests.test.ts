import { describe, expect, it } from "vitest";
import { getTestCommands } from "../../scripts/run-tests.mjs";

describe("run-tests script routing", () => {
  it("routes a specific unit test file to vitest only", () => {
    expect(getTestCommands(["tests\\lib\\mock-ai.test.ts"])).toEqual([
      ["exec", "vitest", "run", "tests\\lib\\mock-ai.test.ts"]
    ]);
  });

  it("routes a specific e2e spec file to Playwright only", () => {
    expect(getTestCommands(["tests\\e2e\\next-card-smoke.spec.ts"])).toEqual([
      ["exec", "playwright", "test", "tests\\e2e\\next-card-smoke.spec.ts"]
    ]);
  });

  it("keeps default test runs focused on unit tests for CI", () => {
    expect(getTestCommands([])).toEqual([
      ["exec", "vitest", "run"]
    ]);
  });
});
