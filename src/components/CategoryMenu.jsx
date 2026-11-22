import { useEffect, useRef, useState } from 'react';
import { loadLocalPosts } from '../data/localPosts.js';
import { repoPosts } from '../data/posts.js';
import styles from './CategoryMenu.module.css';

// 글 읽기 화면 가운데 카테고리 알약 (예: "AI ⌄")
// 누르면 같은 카테고리의 글 목록이 아래로 펼쳐지고, 고르면 그 글로 옮겨 감 (지금 글은 초록 글씨)
// 바깥을 누르거나 Esc 로 닫힘
const same = (a = '', b = '') => a.toLowerCase() === b.toLowerCase();

// 이 브라우저에서 방금 발행한 글 + 저장소 글 (같은 id면 방금 것), 최신 글이 위
function postsIn(category) {
  const byId = new Map();
  for (const post of [...repoPosts, ...loadLocalPosts()]) byId.set(post.id, post);
  return [...byId.values()]
    .filter((post) => same(post.category, category))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export default function CategoryMenu({ category, currentId, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const list = open ? postsIn(category) : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 다른 글로 옮겨 가면 닫음
  useEffect(() => setOpen(false), [currentId]);

  return (
    <div ref={ref} className={styles.menu}>
      <button
        type="button"
        className={className}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {category}
        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className={styles.panel}>
          {list.length === 0 ? (
            <p className={styles.empty}>이 카테고리의 다른 글이 없어요</p>
          ) : (
            <ul className={styles.list} aria-label={`${category} 글 목록`}>
              {list.map((post) => (
                <li key={post.id}>
                  <a
                    href={`/post/${encodeURIComponent(post.id)}`}
                    className={styles.item}
                    aria-current={post.id === currentId ? 'page' : undefined}
                  >
                    <span className={styles.title}>{post.title}</span>
                    <span className={styles.date}>{post.date?.slice(0, 10)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
