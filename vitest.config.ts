import { defineConfig } from "vitest/config";

// Unit tests only — pure functions with no live DB/Redis/network dependency.
// Anything needing a real connection belongs in the existing smoke-test
// scripts (npm run smoke:*), not here.
export default defineConfig({
  test: {
    include: ["shared/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
  },
});
