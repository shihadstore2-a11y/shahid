// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@supabase") || id.includes("@lovable.dev/cloud-auth-js")) {
              return "vendor-cloud";
            }
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("posthog-js")) return "vendor-analytics";
            if (id.includes("@tanstack")) return "vendor-tanstack";
            if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          },
        },
      },
    },
  },
});
