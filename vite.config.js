import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// <user>.github.io 저장소는 도메인 루트에서 서비스되므로 base는 '/'
export default defineConfig({
  plugins: [react()],
  base: '/',
});
