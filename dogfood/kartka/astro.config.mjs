import { defineConfig } from "astro/config";
import bun from "@wyattjoh/astro-bun-adapter";

// See docs/ADR-adapter.md for why this adapter (not @astrojs/node) was chosen.
export default defineConfig({
  output: "server",
  adapter: bun(),
  server: {
    port: Number(process.env.PORT) || 4321,
  },
});
