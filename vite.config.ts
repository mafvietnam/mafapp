
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // NGUYÊN TẮC 2: ĐƯỜNG DẪN NGINX
  // Bắt buộc phải có base: '/' để chạy đúng sau Nginx Reverse Proxy và Docker
  base: '/',
  
  // NGUYÊN TẮC 1: KHÔNG CẦN API KEY
  // App chạy hoàn toàn bằng thuật toán thuần (Client-side logic).
  // Tuyệt đối KHÔNG define process.env.API_KEY thực tế.
  
  // SAFETY PATCH: Fix lỗi màn hình trắng "Uncaught ReferenceError: process is not defined"
  // Một số thư viện React cũ vẫn cố truy cập process.env, ta định nghĩa object rỗng để tránh crash.
  define: {
    'process.env': {}
  },
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
