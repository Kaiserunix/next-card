import { describe, it, expect } from "vitest";

describe("vitest foundation", () => {
  it("runs in jsdom and resolves @ alias", async () => {
    expect(typeof window).toBe("object");
    expect(typeof window.localStorage).toBe("object");

    const types = await import("@/lib/types");
    expect(types).toBeDefined();
  });
});
