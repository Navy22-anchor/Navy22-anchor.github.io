import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { postMeta } from './src/data/postMeta.js';

// 글 목록: content/posts/*.md 의 제목·날짜·요약만 모아 'virtual:post-index' 로 넣음 (본문은 빼고)
// 본문은 src/data/repoPosts.js 에서 글을 열 때 따로 받음
const POSTS_DIR = resolve(import.meta.dirname, 'content/posts');
const VIRTUAL_ID = 'virtual:post-index';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

function postIndex() {
  return {
    name: 'hanlog-post-index',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
    load(id) {
      if (id !== RESOLVED_ID) return null;
      let names = [];
      try {
        names = readdirSync(POSTS_DIR).filter((name) => name.endsWith('.md'));
      } catch {
        // 글 폴더가 없으면 빈 목록
      }
      const list = names
        .map((name) => postMeta(name.replace(/\.md$/, ''), readFileSync(resolve(POSTS_DIR, name), 'utf8')))
        // 최신 글이 먼저 (날짜 형식 2026.11.08 16:11 은 문자열 비교로 정렬됨)
        .sort((a, b) => b.date.localeCompare(a.date));
      return `export default ${JSON.stringify(list)};`;
    },
    // 개발 중 글 파일을 추가·수정·삭제하면 목록을 다시 만듦
    configureServer(server) {
      const refresh = (file) => {
        if (!file.startsWith(POSTS_DIR) || !file.endsWith('.md')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(POSTS_DIR);
      server.watcher.on('add', refresh);
      server.watcher.on('change', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

// <user>.github.io 저장소는 도메인 루트에서 서비스되므로 base는 '/'
export default defineConfig(({ mode }) => {
  // .env(로컬)나 GitHub Actions 변수(배포)에서 읽음.
  // 브라우저에 공개해도 되는 이 두 값만 코드에 넣고, 나머지(.env의 비밀번호 등)는 넣지 않음
  const env = loadEnv(mode, process.cwd(), '');
  const value = (name) => JSON.stringify((env[name] ?? '').trim());
  return {
    plugins: [react(), postIndex()],
    base: '/',
    define: {
      'import.meta.env.SUPABASE_URL': value('Supabase_Project_URL'),
      'import.meta.env.SUPABASE_KEY': value('Publishable_Key'),
    },
  };
});
