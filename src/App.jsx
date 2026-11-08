import { useEffect, useSyncExternalStore } from 'react';
import Landing from './pages/Landing.jsx';
import Post from './pages/Post.jsx';
import Write from './pages/Write.jsx';

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
  const isWrite = /^\/write\/?$/.test(path);
  const page = postMatch ? 'post' : isWrite ? 'write' : 'home';

  useEffect(() => {
    document.documentElement.dataset.page = page;
    if (page !== 'home') window.scrollTo(0, 0);
  }, [page, path]);

  if (postMatch) return <Post id={postMatch[1]} />;
  if (isWrite) return <Write />;
  return <Landing />;
}
