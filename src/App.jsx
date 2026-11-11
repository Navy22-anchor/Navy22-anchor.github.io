import { useEffect, useSyncExternalStore } from 'react';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Post from './pages/Post.jsx';
import Write from './pages/Write.jsx';
import { findPost } from './data/posts.js';
import { useRepoPostReady } from './data/repoPosts.js';

// GitHub Pages는 서버 라우팅이 없어서 해시(#/post/1) 방식으로 페이지를 나눕니다.
function subscribe(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function useHashPath() {
  return useSyncExternalStore(subscribe, () => window.location.hash.replace(/^#/, '') || '/');
}

export default function App() {
  const path = useHashPath();
  const postMatch = path.match(/^\/post(?:\/([^/]+))?\/?$/);
  // #/write 새 글, #/write/<id> 기존 글 수정
  const writeMatch = path.match(/^\/write(?:\/([^/]+))?\/?$/);
  const loginMatch = /^\/login\/?$/.test(path);
  // 글 보기·수정은 그 글의 본문을 받아 온 뒤에 그림 (본문은 열 때만 받음)
  const postId = postMatch ? findPost(postMatch[1]).id : writeMatch?.[1] ? findPost(writeMatch[1]).id : null;
  const ready = useRepoPostReady(postId);
  const page = postMatch ? 'post' : writeMatch ? 'write' : loginMatch ? 'login' : 'home';

  useEffect(() => {
    document.documentElement.dataset.page = page;
    if (page !== 'home') window.scrollTo(0, 0);
  }, [page, path]);

  if ((postMatch || writeMatch) && !ready) return null;
  if (postMatch) return <Post id={postMatch[1]} />;
  if (loginMatch) return <Login />;
  if (writeMatch) return <Write key={path} editId={writeMatch[1]} />;
  return <Landing />;
}
