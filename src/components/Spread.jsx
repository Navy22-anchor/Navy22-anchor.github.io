import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';

// 책 페이지의 펼친 면: 구절을 왼쪽·오른쪽 두 쪽에 차례로 채우고(CSS columns), 넘치면 다음 면으로
// 넘치는 쪽은 오른쪽에 계속 생기고, 면을 넘길 때 그만큼 가로로 옮겨 보여 줌 (스크롤바 없음)
// ref 는 바깥 상자(넘친 쪽을 가림), 그 첫 자식이 쪽들(CSS columns)
// 좁은 화면에서는 한 쪽짜리 세로 목록 (면 넘기기 없음)
export function useSpread(gap) {
  const ref = useRef(null);
  const [spread, setSpread] = useState(0); // 지금 면 (0부터)
  const [pages, setPages] = useState(1); // 전체 쪽 수

  // 쪽 수 다시 세기: 글을 고치거나 코멘트를 접고 펼 때마다(렌더마다), 창 크기가 바뀔 때
  const measure = useCallback(() => {
    const el = ref.current?.firstElementChild;
    if (!el) return;
    const columns = getComputedStyle(el).columnCount === '2' ? 2 : 1;
    if (columns === 1) return setPages(1);
    const columnWidth = (el.clientWidth - gap) / 2;
    setPages(Math.max(1, Math.round((el.scrollWidth + gap) / (columnWidth + gap))));
  }, [gap]);

  useLayoutEffect(measure);
  // 폭이 바뀌면(창 크기, 목차를 펴고 접어 본문이 옮겨 갈 때) 다시 그림 → 쪽 수와 면 위치를 다시 맞춤
  const [, relayout] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(relayout);
    observer.observe(el);
    return () => observer.disconnect();
  });

  const spreads = Math.ceil(pages / 2);
  const current = Math.min(spread, spreads - 1);

  // 면 넘기기: 안쪽 칸(쪽들)을 왼쪽으로 옮김. 마지막 면이 한 쪽뿐이어도 두 쪽만큼 옮겨야 해서 스크롤 대신 transform
  useLayoutEffect(() => {
    const el = ref.current?.firstElementChild;
    if (!el) return;
    const columns = getComputedStyle(el).columnCount === '2';
    el.style.transform = columns && current ? `translateX(${-current * (el.clientWidth + gap)}px)` : '';
  });

  const go = useCallback((to) => setSpread(Math.max(0, Math.min(to, spreads - 1))), [spreads]);

  // ← → 로 면 넘기기 (글을 쓰는 중에는 커서 이동이라 그대로 둠)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(current - 1);
      if (e.key === 'ArrowRight') go(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, go]);

  // 그 구절이 있는 면으로 (목차를 눌렀을 때). 한 쪽짜리 화면에서는 그 구절까지 스크롤
  const reveal = useCallback(
    (target) => {
      const el = ref.current?.firstElementChild;
      if (!el || !target) return;
      if (getComputedStyle(el).columnCount !== '2') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      // 둘 다 같은 만큼 옮겨져 있으니 차이 = 넘기기 전 위치
      const x = target.getBoundingClientRect().left - el.getBoundingClientRect().left;
      const column = Math.round(x / ((el.clientWidth - gap) / 2 + gap));
      setSpread(Math.floor(column / 2));
    },
    [gap],
  );

  // 마지막 면으로 (구절 추가 뒤)
  const goLast = useCallback(() => setSpread(Infinity), []);

  return { ref, spread: current, spreads, pages, go, goLast, reveal };
}

// "‹ 1–2 / 3쪽 ›" (면이 하나뿐이면 안 보임)
export function SpreadNav({ spread, spreads, pages, go, className, buttonClassName }) {
  if (spreads <= 1) return null;
  const first = spread * 2 + 1;
  const last = Math.min(first + 1, pages);
  return (
    <span className={className}>
      <button
        type="button"
        className={buttonClassName}
        aria-label="이전 면"
        onClick={() => go(spread - 1)}
        disabled={spread === 0}
      >
        <Chevron dir="left" />
      </button>
      <span aria-live="polite">
        {first === last ? first : `${first}–${last}`} / {pages}쪽
      </span>
      <button
        type="button"
        className={buttonClassName}
        aria-label="다음 면"
        onClick={() => go(spread + 1)}
        disabled={spread >= spreads - 1}
      >
        <Chevron dir="right" />
      </button>
    </span>
  );
}

const ROTATE = { down: 0, up: 180, left: 90, right: -90 };

// 꺾쇠 아이콘 (⌄ ⌃ ‹ ›), 16 × 16, 글자색
export function Chevron({ dir = 'down', size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{
        transform: `rotate(${ROTATE[dir]}deg)`,
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
