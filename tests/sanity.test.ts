import { describe, expect, it } from "vitest";

describe("test foundation", () => {
  it("provides a storage shim and resolves the @ alias in backend tests", async () => {
    expect(typeof globalThis.localStorage.getItem).toBe("function");

    const mockAI = await import("@/lib/mock-ai");
    expect(typeof mockAI.mockAnalyzeInput).toBe("function");
  });
});
