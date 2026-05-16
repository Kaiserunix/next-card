import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }

  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
