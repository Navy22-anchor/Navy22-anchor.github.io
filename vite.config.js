import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// <user>.github.io 저장소는 도메인 루트에서 서비스되므로 base는 '/'
export default defineConfig(({ mode }) => {
  // .env(로컬)나 GitHub Actions 변수(배포)에서 읽음.
  // 브라우저에 공개해도 되는 이 두 값만 코드에 넣고, 나머지(.env의 비밀번호 등)는 넣지 않음
  const env = loadEnv(mode, process.cwd(), '');
  const value = (name) => JSON.stringify((env[name] ?? '').trim());
  return {
    plugins: [react()],
    base: '/',
    define: {
      'import.meta.env.SUPABASE_URL': value('Supabase_Project_URL'),
      'import.meta.env.SUPABASE_KEY': value('Publishable_Key'),
    },
  };
});
