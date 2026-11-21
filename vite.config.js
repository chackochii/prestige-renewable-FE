import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix loads every var, so PORT stays server-side (not exposed to the client bundle).
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: Number(env.PORT) || 3000,
      open: false,
    },
    build: {
      rollupOptions: {
        output: {
          // Long-lived vendor chunks so app releases don't re-download React.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            state: ["@reduxjs/toolkit", "react-redux", "axios"],
            icons: ["lucide-react"],
          },
        },
      },
    },
  };
});
