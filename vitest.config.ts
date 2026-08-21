import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

// حمّل .env.test محلياً (CI يستخدم env vars مباشرة)
dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
