import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import yelliPreset from "@yelli/ui/tailwind.config";

const config: Config = {
  presets: [yelliPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [animate],
};

export default config;
