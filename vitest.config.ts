import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    clearMocks: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    setupFiles: ["tests/setup/vitest.setup.ts"],
    testTimeout: 8000
  }
});
