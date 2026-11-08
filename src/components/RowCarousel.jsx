import { useRef } from 'react';
import PostCard from './PostCard.jsx';
import styles from './RowCarousel.module.css';

const SWIPE_MIN = 40;
const POST_SIZE = { w: 640, h: 198 };

// 줄의 가운데 콘텐츠 크기 (세로 간격·중괄호 위치 계산에 씀)
export function centerSize(row, index) {
  return row.kind === 'posts' ? POST_SIZE : row.items[index];
}

// 양옆 콘텐츠 위치·크기. 글 카드는 Figma 38:50, 책 표지는 62:1006 기준
function sideLayout(row, index) {
  if (row.kind === 'posts') return { offset: 194, scale: 0.88 };
  return { offset: Math.round(centerSize(row, index).w * 0.46), scale: 0.853 };
}

// 한 줄의 가로 콘텐츠. reveal(0~1): 중괄호에 들어온 정도 — 0이면 가운데 것만, 1이면 양옆까지 펼침
export default function RowCarousel({ row, index, reveal, onChange, onOpen }) {
  const touchX = useRef(null);
  const { offset: sideOffset, scale: sideScale } = sideLayout(row, index);
  const sideOpacity = Math.max(0, (reveal - 0.5) / 0.5);

  return (
    <div
      className={styles.carousel}
      data-kind={row.kind}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${row.category} (Shift + 스크롤로 넘기기)`}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) >= SWIPE_MIN) onChange(index + (dx < 0 ? 1 : -1));
      }}
    >
      {row.items.map((item, i) => {
        const d = i - index;
        const dist = Math.abs(d);
        const offset = d === 0 ? 0 : Math.sign(d) * (sideOffset + (dist - 1) * 60) * reveal;
        return (
          <button
            key={item.id}
            type="button"
            className={styles.slot}
            data-active={d === 0 || undefined}
            data-hidden={dist > 1 || undefined}
            style={{
              transform: `translate(calc(-50% + ${offset}px), -50%) scale(${d === 0 ? 1 : sideScale})`,
              '--side-opacity': sideOpacity,
              zIndex: 10 - dist,
            }}
            tabIndex={d === 0 && reveal === 1 ? 0 : -1}
            aria-hidden={(d !== 0 && reveal < 1) || dist > 1 || undefined}
            aria-label={row.kind === 'posts' ? item.title : item.label}
            onClick={() => (d === 0 ? onOpen?.(item, row) : onChange(i))}
          >
            {row.kind === 'posts' ? (
              <PostCard layout="horizontal" {...item} />
            ) : (
              <img className={styles.image} src={item.src} alt="" width={item.w} height={item.h} draggable="false" />
            )}
          </button>
        );
      })}
    </div>
  );
}
