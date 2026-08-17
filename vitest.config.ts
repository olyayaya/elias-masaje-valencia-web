import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Each jsdom worker mounts whole dashboard sections; oversubscribing the CPU made
    // individual tests miss the default 5s budget purely through contention.
    pool: "threads",
    poolOptions: { threads: { minThreads: 1, maxThreads: 4 } },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
