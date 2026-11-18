import { useEffect } from 'react';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import SetPassword from './pages/SetPassword.jsx';
import Post from './pages/Post.jsx';
import Shelf from './pages/Shelf.jsx';
import Write from './pages/Write.jsx';
import { findPost } from './data/posts.js';
import { useRepoPostReady } from './data/repoPosts.js';
import { usePath } from './router.js';

// 주소(/post/1, /write …)로 페이지를 나눕니다. 주소 다루는 법은 src/router.js

export default function App() {
  const path = usePath();
  const postMatch = path.match(/^\/post(?:\/([^/]+))?\/?$/);
  // /write 새 글, /write/<id> 기존 글 수정
  const writeMatch = path.match(/^\/write(?:\/([^/]+))?\/?$/);
  const loginMatch = /^\/login\/?$/.test(path);
  // /set-password 초대·비밀번호 재설정 메일의 링크로 들어온 뒤 비밀번호 정하기
  const setPasswordMatch = /^\/set-password\/?$/.test(path);
  // /shelf/<카테고리>/<책 id> 책장 (책등). 랜딩에서 누른 책이 골라진 채로 열림
  const shelfMatch = path.match(/^\/shelf\/([^/]+)(?:\/([^/]+))?\/?$/);
  // 글 보기·수정은 그 글의 본문을 받아 온 뒤에 그림 (본문은 열 때만 받음)
  const postId = postMatch ? findPost(postMatch[1]).id : writeMatch?.[1] ? findPost(writeMatch[1]).id : null;
  const ready = useRepoPostReady(postId);
  const page = postMatch ? 'post' : writeMatch ? 'write' : loginMatch || setPasswordMatch ? 'login' : shelfMatch ? 'shelf' : 'home';

  useEffect(() => {
    document.documentElement.dataset.page = page;
    // 탭 제목: 글이면 "글 제목 - Hanlog" (글 주소 페이지(dist/post/…)로 들어와 다른 곳으로 옮겨도 남지 않게 매번 정함)
    const title = postMatch ? findPost(postMatch[1])?.title : null;
    document.title = title ? `${title} - Hanlog` : 'Hanlog';
    if (page !== 'home') window.scrollTo(0, 0);
  }, [page, path]); // postMatch 는 path 에서 나옴

  if ((postMatch || writeMatch) && !ready) return null;
  if (postMatch) return <Post id={postMatch[1]} />;
  if (loginMatch) return <Login />;
  if (setPasswordMatch) return <SetPassword />;
  if (shelfMatch) return <Shelf
        name={decodeURIComponent(shelfMatch[1])}
        bookId={shelfMatch[2] && decodeURIComponent(shelfMatch[2])}
      />;
  if (writeMatch) return <Write key={path} editId={writeMatch[1]} />;
  return <Landing />;
}
