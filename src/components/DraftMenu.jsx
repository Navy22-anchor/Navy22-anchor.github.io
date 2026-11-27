import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clearDraft, listDrafts, loadDeletedIds, loadLocalPosts, subscribeDrafts } from '../data/localPosts.js';
import { repoPosts } from '../data/posts.js';
import styles from './DraftMenu.module.css';

// 보관함 아이콘 (Figma "Archive button (animated)")
// 뚜껑은 통의 오른쪽 위 모서리(20, 9)를 축으로 돌아감: 마우스를 올리면 5°, 열면 15° (CSS)
function ArchiveIcon() {
  return (
    <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9L6.13333 21H17.8667L20 9H4Z" strokeWidth="1.75" />
        <path d="M10 11.5H14V13.5H10V11.5Z" strokeWidth="1.5" />
        <path className={styles.lid} d="M3 4H21V9H3V4Z" strokeWidth="1.75" />
      </g>
    </svg>
  );
}

// 글 읽기 화면 상단 바의 보관함 버튼 (Figma "Blog Reading Page / Drafts open")
// 누르면 뚜껑이 열리고, 이 브라우저에 임시저장한 글 목록이 버튼 아래로 펼쳐짐
// 줄을 누르면 그 글의 글쓰기 화면으로, 마우스를 올린 줄의 × 로 그 임시저장을 지움
// 바깥을 누르거나 Esc 로 닫힘

// 글 목록이 바뀔 때만 다시 그리도록, 저장된 문자열이 같으면 같은 배열을 돌려줌
let cache = { key: '', list: [] };
function snapshot() {
  const list = listDrafts();
  const key = JSON.stringify(list);
  if (key !== cache.key) cache = { key, list };
  return cache.list;
}

// 수정 중이던 글이 지워졌으면 이어 쓸 글이 없으니 목록에서 뺌
function existing(drafts) {
  const deleted = new Set(loadDeletedIds());
  const ids = new Set([...repoPosts, ...loadLocalPosts()].map((post) => post.id));
  return drafts.filter((d) => d.id === null || (ids.has(d.id) && !deleted.has(d.id)));
}

// 11.27 14:32
function savedTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 본문 첫 부분을 마크다운 기호 없이 한 줄로
function snippet(markdown) {
  return markdown
    .replace(/<\/?cite[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 사진
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크는 글자만
    .replace(/\$\$[\s\S]*?\$\$/g, '') // 블록 수식
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export default function DraftMenu({ className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const drafts = existing(useSyncExternalStore(subscribeDrafts, snapshot));

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

  return (
    <div ref={ref} className={styles.menu}>
      <button
        type="button"
        className={className}
        aria-label="임시저장한 글"
        aria-haspopup="true"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <ArchiveIcon />
      </button>
      {open && (
        <div className={styles.panel}>
          <p className={styles.head}>
            임시저장한 글 <span className={styles.count}>{drafts.length}</span>
          </p>
          {drafts.length === 0 ? (
            <p className={styles.empty}>임시저장한 글이 없어요</p>
          ) : (
            <ul className={styles.list} aria-label="임시저장한 글 목록">
              {drafts.map((draft) => {
                const title = draft.title.trim();
                const text = snippet(draft.markdown);
                return (
                  <li key={draft.id ?? 'new'} className={styles.row}>
                    <a
                      href={draft.id ? `/write/${encodeURIComponent(draft.id)}` : '/write'}
                      className={styles.item}
                      onClick={() => setOpen(false)}
                    >
                      <span className={styles.title} data-untitled={!title || undefined}>
                        {title || '제목 없음'}
                      </span>
                      {text && <span className={styles.snippet}>{text}</span>}
                      <span className={styles.meta}>
                        <span className={styles.tag} data-new={!draft.id || undefined}>
                          {draft.id ? '수정 중' : '새 글'}
                        </span>
                        {savedTime(draft.savedAt)}
                      </span>
                    </a>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`${title || '제목 없음'} 임시저장 지우기`}
                      title="임시저장 지우기"
                      onClick={() => clearDraft(draft.id)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
