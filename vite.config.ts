import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        bypass: (req) => {
          // During dev, API calls will fail - that's expected
          // They only work on Vercel in production
          if (req.url.includes('/api/')) {
            console.warn(`⚠️  API endpoint ${req.url} requires Vercel deployment`);
            return null;
          }
        }
      }
    }
  }
})
