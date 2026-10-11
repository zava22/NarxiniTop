import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,

    // Frontend calls /api/... and Vite forwards it to the Express server.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },

    hmr: {
      host: "127.0.0.1",
      port: 5173,
      clientPort: 5173,
      protocol: "ws",
    },
  },
});
