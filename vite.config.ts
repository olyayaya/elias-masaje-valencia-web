import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { faviconVersion } from "./vite-plugin-favicon-version";
import { ffmpegCore } from "./vite-plugin-ffmpeg-core";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), faviconVersion(__dirname), ffmpegCore(__dirname), mcpPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
