import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// `npm run icons -w @palikka/client`: the home-screen icons from favicon.svg (committed to public/).
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#1a2029" } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: "#1a2029" } },
  },
  images: ["public/favicon.svg"],
});
