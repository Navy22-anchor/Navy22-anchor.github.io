import { useEffect, useState } from 'react';
import styles from './PostToc.module.css';

// 글 읽기 화면 왼쪽 목차: 본문 마크다운의 제목(#, ##, ###)으로 만듦
// 그려진 본문에서 제목을 찾아 id를 붙이고, 누르면 그 제목으로 부드럽게 스크롤
// 지금 읽는 곳(화면 위쪽을 지난 마지막 제목)은 초록 글씨
// 단계는 글자 크기로: 가장 큰 제목 16 semibold, 그다음 14, 그 아래 12 (책 페이지 목차와 같음)
const TOP = 120; // 이만큼 내려온 곳을 지나면 "읽는 중"

export default function PostToc({ articleRef, deps }) {
  const [headings, setHeadings] = useState([]); // [{ id, text, level, el }]
  const [current, setCurrent] = useState(null);
  const [offset, setOffset] = useState(0); // 본문(마크다운) 시작 높이: 목차 첫 줄을 여기에 맞춤

  // 본문을 다 그린 뒤 제목 모으기 (글 제목 h1은 빼고, 마크다운 안의 제목만)
  // 본문은 나중에 다시 그려질 수 있어서(본문 받아 옴, 사진 주소 바뀜 …) 바뀔 때마다 다시 모음
  // useEffect: 목차가 본문보다 앞에 있어, 화면을 그린 직후(layout)에는 본문 ref가 아직 비어 있음
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const collect = () => {
      const els = [...root.querySelectorAll('[data-markdown] :is(h1, h2, h3, h4)')];
      const top = Math.min(...els.map((el) => Number(el.tagName[1])));
      const used = new Set();
      setHeadings(
        els.map((el, i) => {
          const text = el.textContent.trim();
          const slug = text
            .replace(/\s+/g, '-')
            .replace(/[^\p{L}\p{N}-]/gu, '')
            .slice(0, 40);
          let id = `h-${slug || i}`;
          while (used.has(id)) id += `-${i}`;
          used.add(id);
          el.id = id;
          return { id, text, level: Math.min(Number(el.tagName[1]) - top, 2), el };
        }),
      );
    };
    // 목차 시작을 본문 시작(글 제목·날짜 아래 첫 줄)과 같은 높이로. 목차 칸과 글은 같은 줄에서 시작함
    const measure = () => {
      const body = root.querySelector('[data-markdown]');
      if (body) setOffset(Math.round(body.getBoundingClientRect().top - root.getBoundingClientRect().top));
    };
    collect();
    measure();
    const observer = new MutationObserver(() => {
      collect();
      measure();
    });
    observer.observe(root, { childList: true, subtree: true });
    const resize = new ResizeObserver(measure); // 창 폭이 바뀌어 제목 줄 수가 바뀔 때
    resize.observe(root);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
    // deps: 글이 바뀌었을 때
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 지금 읽는 제목
  useEffect(() => {
    if (!headings.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let active = headings[0].id;
      for (const h of headings) if (h.el.getBoundingClientRect().top <= TOP) active = h.id;
      // 맨 아래까지 내렸으면 마지막 제목
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) active = headings.at(-1).id;
      setCurrent(active);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className={styles.toc} style={{ marginTop: offset }} aria-label="목차">
      <p className={styles.heading}>목차</p>
      <ol className={styles.list}>
        {headings.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              className={styles.item}
              data-level={h.level}
              aria-current={current === h.id ? 'location' : undefined}
              onClick={() => {
                h.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setCurrent(h.id);
              }}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
