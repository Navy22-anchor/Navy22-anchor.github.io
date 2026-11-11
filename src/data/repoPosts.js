import { useEffect, useState } from 'react';
import index from 'virtual:post-index';
import { postBody } from './postMeta.js';

export { excerptOf } from './postMeta.js';

// 저장소의 content/posts/*.md. 파일 이름이 글 주소(id)가 됩니다.
// 새 글은 이 폴더에 .md 파일을 넣고 main에 push하면 GitHub Actions가 다시 빌드해 게시합니다.
//
// 글이 많아져도 첫 화면이 가볍도록, 빌드할 때는 목록(제목·날짜·요약 등, virtual:post-index)만 넣고
// 본문은 글마다 따로 쪼개 두었다가 그 글을 열 때만 받아 옴
const files = import.meta.glob('/content/posts/*.md', { query: '?raw', import: 'default' });
const bodies = new Map(); // id → 받아 온 본문
const pending = new Map(); // id → 받는 중인 Promise

export const repoPosts = index.map((meta) => ({
  ...meta,
  get markdown() {
    return bodies.get(meta.id);
  },
}));

const isRepo = (id) => repoPosts.some((post) => post.id === id);
const isLoaded = (id) => !isRepo(id) || bodies.has(id);

export function loadRepoPost(id) {
  if (isLoaded(id)) return Promise.resolve();
  if (!pending.has(id)) {
    pending.set(
      id,
      files[`/content/posts/${id}.md`]()
        .then((text) => bodies.set(id, postBody(text)))
        .finally(() => pending.delete(id)),
    );
  }
  return pending.get(id);
}

// 이 글의 본문이 준비됐는지. 아직이면 받아 오고, 다 받으면 다시 그림
export function useRepoPostReady(id) {
  const [, setVersion] = useState(0);
  const ready = !id || isLoaded(id);
  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    loadRepoPost(id)
      .catch(() => {}) // 못 받으면(오프라인 등) 빈 본문으로라도 보여줌
      .finally(() => {
        if (!bodies.has(id)) bodies.set(id, '');
        if (alive) setVersion((v) => v + 1);
      });
    return () => {
      alive = false;
    };
  }, [id, ready]);
  return ready;
}
