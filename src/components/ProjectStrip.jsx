import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import styles from './ProjectStrip.module.css';

// 무한 스크롤처럼 보이도록 목록을 여러 번 이어 붙이고,
// 가운데 복사본 근처에 머물도록 스크롤 위치를 순간 이동시킵니다.
const GAP = 7;
const SETTLE_DELAY = 140;

// 화면 위아래가 항상 타일로 채워질 만큼 복사본 개수를 정함 (홀수)
function copiesFor(projects) {
  const loop = projects.reduce((sum, p) => sum + p.height + GAP, 0);
  const screen = Math.max(window.innerHeight, 1200);
  const half = Math.max(2, Math.ceil(screen / loop) + 1);
  return half * 2 + 1;
}

function focusLine() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--focus-y');
  return (parseFloat(value) / 100) * window.innerHeight;
}

function centerOf(el) {
  return el.offsetTop + el.offsetHeight / 2;
}

export default function ProjectStrip({ projects, onActiveChange }) {
  const itemRefs = useRef([]);
  const settleTimer = useRef(0);
  const count = projects.length;
  const copies = useMemo(() => copiesFor(projects), [projects]);
  const homeCopy = Math.floor(copies / 2);

  const loopHeight = useCallback(() => {
    const first = itemRefs.current[0];
    const next = itemRefs.current[count];
    return first && next ? next.offsetTop - first.offsetTop : 0;
  }, [count]);

  const scrollToItem = useCallback((el, behavior = 'auto') => {
    window.scrollTo({ top: centerOf(el) - focusLine(), behavior });
  }, []);

  const nearestItem = useCallback(() => {
    const line = window.scrollY + focusLine();
    let best = null;
    let bestDist = Infinity;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(centerOf(el) - line);
      if (dist < bestDist) {
        bestDist = dist;
        best = { el, index: i % count, dist };
      }
    });
    return best;
  }, [count]);

  // 처음 그리거나 필터가 바뀌면 가운데 복사본의 첫 작업을 브라켓 위치로
  useLayoutEffect(() => {
    const el = itemRefs.current[homeCopy * count];
    if (el) scrollToItem(el);
    onActiveChange(0);
  }, [count, homeCopy, projects, scrollToItem, onActiveChange]);

  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const loop = loopHeight();
        const home = itemRefs.current[homeCopy * count];
        if (loop > 0 && home) {
          const homeTop = centerOf(home) - focusLine();
          if (window.scrollY < homeTop - loop / 2) window.scrollBy(0, loop);
          else if (window.scrollY > homeTop + loop / 2) window.scrollBy(0, -loop);
        }

        const nearest = nearestItem();
        if (nearest) onActiveChange(nearest.index);
      });

      // 스크롤이 멈추면 가장 가까운 작업을 브라켓 사이로 맞춤
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const nearest = nearestItem();
        if (nearest && nearest.dist > 1) scrollToItem(nearest.el, 'smooth');
      }, SETTLE_DELAY);
    };

    const onResize = () => {
      const nearest = nearestItem();
      if (nearest) scrollToItem(nearest.el);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [count, homeCopy, loopHeight, nearestItem, scrollToItem, onActiveChange]);

  const items = Array.from({ length: copies }, (_, copy) =>
    projects.map((project, i) => ({
      project,
      key: `${copy}-${project.id}`,
      slot: copy * count + i,
      clone: copy !== homeCopy,
    })),
  ).flat();

  return (
    <ol className={styles.strip} aria-label="작업 목록">
      {items.map(({ project, key, slot, clone }) => (
        <li
          key={key}
          ref={(el) => {
            itemRefs.current[slot] = el;
          }}
          className={styles.item}
          aria-hidden={clone || undefined}
        >
          <button
            type="button"
            className={styles.tile}
            style={{
              width: project.width,
              height: project.height,
              background: project.image ? `center / cover url(${project.image})` : project.color,
            }}
            aria-label={project.title}
            tabIndex={clone ? -1 : undefined}
            onClick={(e) => scrollToItem(e.currentTarget.parentElement, 'smooth')}
          />
        </li>
      ))}
    </ol>
  );
}
