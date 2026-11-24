import { useEffect, useRef, useState } from 'react';
import { loadDeletedIds, loadLocalPosts } from '../data/localPosts.js';
import { repoPosts } from '../data/posts.js';
import { savePostOrder, sortByOrder, usePostOrder } from '../data/postOrder.js';
import { useCanEdit } from '../data/supabase.js';
import styles from './CategoryMenu.module.css';

// 글 읽기 화면 가운데 카테고리 알약 (예: "AI ⌄")
// 누르면 같은 카테고리의 글 목록이 아래로 펼쳐지고, 고르면 그 글로 옮겨 감 (지금 글은 초록 글씨)
// 바깥을 누르거나 Esc 로 닫힘
// 주인은 글 하나를 1초 꾹 누르면 순서 바꾸기 모드: 글을 위아래로 끌어 순서를 바꿈 (놓을 때마다 저장)
const same = (a = '', b = '') => a.toLowerCase() === b.toLowerCase();
const HOLD = 1000; // 꾹 누르는 시간
const SLOP = 8; // 누르는 동안 이만큼 움직이면 꾹 누르기 취소 (스크롤·끌기로 봄)

// 이 브라우저에서 방금 발행한 글 + 저장소 글 (같은 id면 방금 것), 최신 글이 위
function postsIn(category) {
  const deleted = new Set(loadDeletedIds());
  const byId = new Map();
  for (const post of [...repoPosts, ...loadLocalPosts()]) byId.set(post.id, post);
  return [...byId.values()]
    .filter((post) => !deleted.has(post.id) && same(post.category, category))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export default function CategoryMenu({ category, currentId, className }) {
  const [open, setOpen] = useState(false);
  const [sorting, setSorting] = useState(false); // 순서 바꾸기 모드
  const [holding, setHolding] = useState(null); // 꾹 누르는 중인 글 id (채워지는 표시)
  const [drag, setDrag] = useState(null); // { from, to, dy, height }
  const ref = useRef(null);
  const listRef = useRef(null);
  const suppressClick = useRef(false);
  const order = usePostOrder();
  const editable = useCanEdit();
  const list = open ? sortByOrder(postsIn(category), category, order) : [];

  const close = () => {
    setOpen(false);
    setSorting(false);
    setDrag(null);
    suppressClick.current = false;
  };
  const finishSorting = () => {
    setSorting(false);
    suppressClick.current = false;
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && close();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (sorting) return finishSorting(); // 먼저 순서 바꾸기만 끝냄
      close();
      ref.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, sorting]);

  // 다른 글로 옮겨 가면 닫음
  useEffect(() => close(), [currentId]);

  // 글 i를 위아래로 끎. 손을 떼면 그 자리에 두고 저장
  const startDrag = (e, i, items) => {
    const rows = [...listRef.current.children];
    const height = rows[i].getBoundingClientRect().height;
    const startY = e.clientY;
    let to = i;
    setDrag({ from: i, to, dy: 0, height });
    const move = (ev) => {
      const dy = ev.clientY - startY;
      to = Math.max(0, Math.min(items.length - 1, i + Math.round(dy / height)));
      setDrag({ from: i, to, dy, height });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (to === i) return;
      const ids = items.map((post) => post.id);
      const [moved] = ids.splice(i, 1);
      ids.splice(to, 0, moved);
      savePostOrder(category, ids).catch(() => {});
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onItemPointerDown = (e, i) => {
    if (e.button !== 0 || !editable) return;
    // 순서 바꾸기 모드에서는 바로 끌기
    if (sorting) {
      e.preventDefault();
      startDrag(e, i, list);
      return;
    }
    // 1초 꾹 누르면 순서 바꾸기 모드로 들어가고, 누른 그 글을 바로 끌 수 있음
    const start = { x: e.clientX, y: e.clientY };
    const items = list;
    let last = e;
    setHolding(items[i].id);
    const cancel = () => {
      clearTimeout(timer);
      setHolding(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cancel);
      window.removeEventListener('pointercancel', cancel);
    };
    const move = (ev) => {
      last = ev;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > SLOP) cancel();
    };
    const timer = setTimeout(() => {
      cancel();
      setSorting(true);
      suppressClick.current = true; // 손을 뗄 때 글로 옮겨 가지 않게
      navigator.vibrate?.(15);
      startDrag(last, i, items);
    }, HOLD);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cancel);
    window.addEventListener('pointercancel', cancel);
  };

  // 끌 때 다른 글이 비켜 주는 거리
  const shift = (i) => {
    if (!drag) return 0;
    const { from, to, dy, height } = drag;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -height;
    if (to < from && i >= to && i < from) return height;
    return 0;
  };

  return (
    <div ref={ref} className={styles.menu}>
      <button
        type="button"
        className={className}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
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
        <div className={styles.panel} data-sorting={sorting || undefined} data-dragging={drag ? '' : undefined}>
          {sorting && (
            <div className={styles.sortBar}>
              <span>끌어서 순서를 바꾸세요</span>
              <button type="button" className={styles.done} onClick={finishSorting}>
                완료
              </button>
            </div>
          )}
          {list.length === 0 ? (
            <p className={styles.empty}>이 카테고리의 다른 글이 없어요</p>
          ) : (
            <ul ref={listRef} className={styles.list} aria-label={`${category} 글 목록`}>
              {list.map((post, i) => (
                <li
                  key={post.id}
                  className={styles.row}
                  data-dragged={drag?.from === i || undefined}
                  style={drag ? { transform: `translateY(${shift(i)}px)` } : undefined}
                >
                  <a
                    href={`/post/${encodeURIComponent(post.id)}`}
                    className={styles.item}
                    draggable={false}
                    aria-current={post.id === currentId ? 'page' : undefined}
                    data-holding={holding === post.id || undefined}
                    onPointerDown={(e) => onItemPointerDown(e, i)}
                    onContextMenu={(e) => editable && e.preventDefault()} // 꾹 누를 때 메뉴가 뜨지 않게
                    onClickCapture={(e) => {
                      // 순서 바꾸기 중이거나 방금 꾹 눌렀으면 글로 옮겨 가지 않음
                      if (!sorting && !suppressClick.current) return;
                      suppressClick.current = false;
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {sorting && (
                      <svg className={styles.grip} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2 3.5H10M2 6H10M2 8.5H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    )}
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
