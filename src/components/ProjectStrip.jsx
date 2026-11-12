import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import RowCarousel, { centerSize } from './RowCarousel.jsx';
import styles from './ProjectStrip.module.css';

// 세로 줄 목록. 문서 스크롤 대신 연속값 pos(중괄호에 놓인 줄 번호)를 움직입니다.
// 휠을 내리면 위에 있던 줄이 중괄호로 내려오고, 중괄호에 있던 줄은 아래로 내려갑니다.
const WHEEL_DIRECTION = -1; // 1로 바꾸면 휠을 내릴 때 아래 줄이 올라옴
const GAP = 32;
const SETTLE_DELAY = 140;
const EASE = 0.18;
const MOBILE = 700;
const MOBILE_POST_H = 160;

// 새 카테고리 빈 줄 (Figma 157:1507 애니메이션): 빈 중괄호 높이, 빈 중괄호 간격(가운데에서 810 → 960 = 150)
const EMPTY_H = 173;
const EMPTY_BRACE = 150;
// 1) 0~650ms 중괄호 자리의 줄과 그 아래 줄들이 한 칸씩 내려감
// 2) 300~650ms 빈 중괄호 간격이 좁아짐. 둘 다 같은 때 끝남 (라벨 바뀜은 Landing.module.css에서 같은 시간으로)
export const INSERT_MS = 650;
const INSERT_BRACE_FROM = 300 / INSERT_MS;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const mod = (a, n) => ((a % n) + n) % n;
const lerp = (a, b, t) => a + (b - a) * t;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readViewport() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--focus-y');
  return { w: window.innerWidth, h: window.innerHeight, focus: (parseFloat(value) / 100) * window.innerHeight };
}

// 중괄호와 가운데 콘텐츠 사이 거리 (Figma: 글 카드 369, 책 258, 빈 줄 150)
const braceOffset = ({ row, w }) => (row.kind === 'empty' ? EMPTY_BRACE : Math.max(w / 2 + 49, 258));

export default function ProjectStrip({ ref, rows, initialRow = 0, indexFor, onActiveChange, onChangeItem, onOpen }) {
  const n = rows.length;
  const [pos, setPos] = useState(initialRow);
  const [viewport, setViewport] = useState(readViewport);
  const posRef = useRef(initialRow);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const rootRef = useRef(null);
  const [inserting, setInserting] = useState(null); // 빈 줄을 끼우는 중 { row, t: 0~1 }
  const insertingRef = useRef(false);

  const size = useCallback(
    (k) => {
      const row = rows[mod(k, n)];
      if (row.kind === 'empty') return { row, w: 0, h: viewport.w > MOBILE ? EMPTY_H : MOBILE_POST_H };
      const { w, h } = centerSize(row, indexFor(row));
      if (viewport.w > MOBILE) return { row, w, h };
      if (row.kind === 'posts') return { row, w, h: MOBILE_POST_H };
      const fit = Math.min(1, (viewport.w - 32) / w);
      return { row, w: w * fit, h: h * fit };
    },
    [rows, n, indexFor, viewport.w],
  );

  // 줄 a와 a+1의 중심 사이 거리
  const distance = useCallback((a) => size(a).h / 2 + GAP + size(a + 1).h / 2, [size]);

  const apply = (p) => {
    posRef.current = p;
    setPos(p);
  };

  const animateTo = useCallback((target) => {
    if (insertingRef.current) return; // 빈 줄을 끼우는 동안은 다른 움직임을 받지 않음
    cancelAnimationFrame(frame.current);
    clearTimeout(settleTimer.current);
    if (reducedMotion()) return apply(target);
    const step = () => {
      const d = target - posRef.current;
      if (Math.abs(d) < 0.002) return apply(target);
      apply(posRef.current + d * EASE);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  // px만큼 굴리면 지금 간격 기준으로 그만큼 줄이 이동하고, 멈추면 가장 가까운 줄로 맞춤
  const moveBy = useCallback(
    (px) => {
      if (insertingRef.current) return;
      cancelAnimationFrame(frame.current);
      const p = posRef.current;
      apply(p + px / distance(Math.floor(p)));
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => animateTo(Math.round(posRef.current)), SETTLE_DELAY);
    },
    [distance, animateTo],
  );

  // 바깥(카테고리 목록)에서 줄 번호로 이동: 끝없이 반복되므로 지금 자리에서 가까운 쪽으로
  useImperativeHandle(
    ref,
    () => ({
      goTo(index) {
        if (insertingRef.current) return;
        const current = Math.round(posRef.current);
        let delta = mod(index - current, n);
        if (delta > n / 2) delta -= n;
        animateTo(current + delta);
      },
      // 새 카테고리: 중괄호 자리에 빈 줄을 끼움. 움직임이 끝나면 onInsert(줄 번호)로 rows에 실제로 넣게 함
      insert(row, onInsert) {
        if (insertingRef.current) return;
        cancelAnimationFrame(frame.current);
        clearTimeout(settleTimer.current);
        const at = mod(Math.round(posRef.current), n);
        const done = () => {
          insertingRef.current = false;
          setInserting(null);
          apply(at); // 끼운 빈 줄(rows[at])이 중괄호에
          onInsert(at);
        };
        if (reducedMotion()) return done();
        insertingRef.current = true;
        apply(Math.round(posRef.current));
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / INSERT_MS);
          setInserting({ row, t });
          if (t < 1) frame.current = requestAnimationFrame(step);
          else done();
        };
        frame.current = requestAnimationFrame(step);
      },
    }),
    [n, animateTo],
  );

  const activeIndex = mod(Math.round(pos), n);
  useEffect(() => {
    onActiveChange(activeIndex);
  }, [activeIndex, onActiveChange]);

  useEffect(() => {
    const onWheel = (e) => {
      // Shift + 휠과 가로 스와이프는 가로 넘기기용, Ctrl + 휠은 확대용
      if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.target.closest?.('[role="dialog"]')) return; // 달력 하루 일정은 그 안에서 스크롤
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      moveBy(WHEEL_DIRECTION * e.deltaY * unit);
    };
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [role="dialog"]')) return; // 글자 입력·달력 사용 중에는 넘기지 않음
      if (insertingRef.current) return;
      // ↓는 휠을 내릴 때와 같은 방향
      if (e.key === 'ArrowDown') animateTo(Math.round(posRef.current) + WHEEL_DIRECTION);
      else if (e.key === 'ArrowUp') animateTo(Math.round(posRef.current) - WHEEL_DIRECTION);
      else return;
      e.preventDefault();
    };
    const onResize = () => setViewport(readViewport());

    // 터치는 손가락을 따라감 (아래로 끌면 위 줄이 내려옴)
    let touchY = null;
    const root = rootRef.current;
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (touchY === null) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      moveBy(touchY - y);
      touchY = y;
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settleTimer.current);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
    };
  }, [moveBy, animateTo]);

  // 중괄호 간격을 중괄호 사이 줄의 크기에 맞춤 (줄 사이를 지날 때는 부드럽게 보간)
  const base = Math.floor(pos);
  const frac = pos - base;
  let brace = lerp(braceOffset(size(base)), braceOffset(size(base + 1)), frac);
  // 빈 줄을 끼우는 중: 중괄호 자리 줄부터 아래 줄들은 한 칸(빈 줄 + 간격)만큼 내려가고,
  // 위 줄들은 지금 줄과 빈 줄의 높이 차이의 절반만큼만 움직여서 다 끼운 뒤의 자리와 맞음 (빈 줄이 낮으면 살짝 아래로)
  let shiftDown = 0;
  let shiftUp = 0;
  if (inserting) {
    const p = easeInOut(inserting.t);
    const empty = viewport.w > MOBILE ? EMPTY_H : MOBILE_POST_H;
    shiftDown = p * (empty / 2 + GAP + size(base).h / 2);
    shiftUp = (p * (size(base).h - empty)) / 2;
    const b = easeInOut(Math.max(0, (inserting.t - INSERT_BRACE_FROM) / (1 - INSERT_BRACE_FROM)));
    brace = lerp(brace, EMPTY_BRACE, b);
  }
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--brace-offset', `${brace}px`);
  }, [brace]);
  useEffect(() => () => document.documentElement.style.removeProperty('--brace-offset'), []);

  // 중괄호 기준선에서 위아래로 화면이 찰 때까지 줄을 쌓음 (끝없이 반복)
  const baseY = viewport.focus - frac * distance(base);
  const items = [];
  for (let k = base, y = baseY; y - size(k).h / 2 < viewport.h; y += distance(k), k++) {
    items.push({ k, y });
  }
  for (let k = base - 1, y = baseY - distance(k); y + size(k).h / 2 > 0; y -= distance(k - 1), k--) {
    items.unshift({ k, y });
  }

  return (
    <div ref={rootRef} className={styles.viewport} aria-label="작업 목록">
      {items.map(({ k, y }) => {
        const { row, h } = size(k);
        const top = y - h / 2 + (k >= base ? shiftDown : shiftUp);
        const reveal = Math.max(0, 1 - Math.abs(k - pos) * 2); // 반 줄 이상 벗어나면 가운데 것만
        const isActive = k === Math.round(pos);
        return (
          <div
            key={k}
            className={styles.row}
            style={{ height: h, transform: `translateY(${top}px)`, zIndex: isActive ? 2 : 1 }}
            aria-hidden={!isActive || undefined}
            onClickCapture={(e) => {
              // 중괄호 밖의 줄을 누르면 그 줄을 중괄호로 가져옴
              if (!isActive) {
                e.stopPropagation();
                animateTo(k);
              }
            }}
          >
            {row.kind !== 'empty' && (
              <RowCarousel
                row={row}
                index={indexFor(row)}
                reveal={reveal}
                onChange={(i) => onChangeItem(row, i)}
                onOpen={onOpen}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
