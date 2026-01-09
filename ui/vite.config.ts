import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080', // 后端地址
        changeOrigin: true,
        rewrite: (path) => {
          // SSE 接口特殊处理：SseController mapped to /sse
          if (path.startsWith('/api/sse')) {
            return path.replace(/^\/api/, '');
          }
          // 其他接口保留 /api：AgentController 等 mapped to /api
          return path;
        }
      }
    }
  }
});