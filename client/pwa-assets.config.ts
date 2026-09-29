import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// `npm run icons -w @labyrinth/client`: the home-screen icons from favicon.svg (committed to public/).
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#1f3a2e" } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: "#1f3a2e" } },
  },
  images: ["public/favicon.svg"],
});
