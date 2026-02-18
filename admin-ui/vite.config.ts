import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [vike(), react(), tailwindcss(), tsconfigPaths()],
  base: "/beta/admin/",
  server: {
    strictPort: true,
    proxy: {
      "/admin": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
