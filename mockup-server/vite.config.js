import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // WSL2 + bind-mounts often need polling for file watching to fire reliably
    watch: {
      usePolling: true,
      interval: 400,
    },
    // Allow Vite to serve files from one level up (the repo root), where MOCKUP.jsx lives
    fs: {
      allow: ["..", "."],
    },
  },
  // Treat .jsx files outside of project root as JSX too
  esbuild: {
    loader: "jsx",
    include: [/\.jsx?$/, /MOCKUP\.jsx$/],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
});
