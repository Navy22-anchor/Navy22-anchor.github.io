import { useSyncExternalStore } from 'react';

// 페이지 주소: /post/<id>, /write, /login … (# 없는 주소)
// 블로그 안에서 옮겨 다닐 때는 페이지를 새로 받지 않고 주소만 바꿈 (history.pushState)
// 새로고침하거나 주소로 바로 들어오면 GitHub Pages가 파일을 줌:
//   글은 빌드 때 만든 dist/post/<id>/index.html, 나머지 주소는 dist/404.html (앱 복사본) → 앱이 주소를 보고 화면을 고름
// (src/build/postPages.js 가 둘 다 만듦)

// 예전 주소(/#/post/<id>)로 들어오면 새 주소(/post/<id>)로 바꿈. 이미 공유된 링크도 그대로 열리게
// Supabase 로그인 링크의 #access_token=… 은 #/ 로 시작하지 않아 건드리지 않음
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1) || '/');
}

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
window.addEventListener('popstate', emit);

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const usePath = () => useSyncExternalStore(subscribe, () => window.location.pathname || '/');

// 블로그 안에서 옮겨 감. inApp 표시로 "이 블로그 안에서 왔는지"를 기록 (뒤로가기에 씀)
export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState(window.history.state, '', to);
  else window.history.pushState({ inApp: true }, '', to);
  emit();
}

// 블로그 안에서 왔으면 그리로, 검색 결과·링크로 바로 들어왔으면 홈으로
export function goBack() {
  if (window.history.state?.inApp) window.history.back();
  else navigate('/', { replace: true });
}

// 블로그 안 링크(<a href="/post/…">)를 누르면 페이지를 새로 받지 않고 옮겨 감
// 새 탭(⌘/Ctrl 클릭), 다른 사이트, 파일(sitemap.xml 등), 같은 페이지 안의 #위치는 브라우저에 맡김
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest?.('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
  if (url.pathname === window.location.pathname && url.hash) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});
