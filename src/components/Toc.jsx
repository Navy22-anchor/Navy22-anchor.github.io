import { useEffect, useRef, useState } from 'react';
import styles from './Toc.module.css';

// 책 페이지 왼쪽 목차 (Figma 327:3052 목차, 332:3052 "-" 일곱 개 + 누를 때 움직임)
// 처음엔 "목차" 아래 장마다 "-"만 보임. 누르면
//   0–0.4초  "-"가 오른쪽(꺾쇠 자리)으로 미끄러지고 줄 간격이 16 → 40으로 벌어짐
//   0.4–0.6초 "-"가 가운데서 꺾여 ⌄
//   0.55초부터 장 제목이 왼쪽에서 0.05초씩 차례로 들어옴
// 펼친 뒤: 장만 보이고(›), 마우스를 올리면 절이 펼쳐짐(⌄). 누르면 펼친 채로 고정 (여러 장 고정 가능)
// "목차"를 다시 누르면 "-"로 접힘
const OPEN_MS = 1000; // 위 움직임이 끝나는 때 (그 뒤로는 지연 없이 반응)

// onToggle(open): 펼칠 때 true, 접을 때 false (책 페이지가 본문을 옆으로 비켜 줌)
// onSelect(value): 장·절을 누르면 그 목차 자리("장 › 절")로 → 책 페이지가 그 자리의 첫 구절이 있는 면으로 넘김
// marked: 구절이 있는 목차 자리들 (초록 글씨로 표시, 눌러서 갈 수 있음)
export default function Toc({ items, onToggle, onSelect, marked }) {
  const [phase, setPhase] = useState('closed'); // closed → opening → open
  const [pinned, setPinned] = useState(() => new Set());
  const [hovered, setHovered] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = () => {
    clearTimeout(timer.current);
    if (phase === 'closed') {
      setPhase('opening');
      onToggle?.(true);
      timer.current = setTimeout(() => setPhase('open'), OPEN_MS);
    } else {
      setPhase('closed');
      onToggle?.(false);
      setHovered(null);
    }
  };

  const togglePin = (i) =>
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  let order = 0; // 장 제목이 들어오는 차례
  return (
    <nav className={styles.toc} data-phase={phase} aria-label="목차">
      <button type="button" className={styles.heading} onClick={toggle} aria-expanded={phase !== 'closed'}>
        목차
      </button>
      <ol className={styles.list}>
        {items.map((item, i) => {
          if (item.type === 'group') {
            return (
              <li key={i} className={styles.group} aria-hidden={phase === 'closed' || undefined}>
                {item.title}
              </li>
            );
          }
          const expanded = phase === 'open' && item.sections.length > 0 && (pinned.has(i) || hovered === i);
          return (
            <li
              key={i}
              className={styles.item}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              <button
                type="button"
                className={styles.chapter}
                style={{ '--i': order++ }}
                aria-expanded={item.sections.length ? expanded : undefined}
                aria-label={phase === 'closed' ? '목차 펼치기' : undefined}
                data-marked={marked?.has(item.value) || undefined}
                onClick={() => {
                  if (phase === 'closed') return toggle();
                  if (phase !== 'open') return;
                  togglePin(i);
                  if (marked?.has(item.value)) onSelect?.(item.value);
                }}
              >
                <span className={styles.title}>{item.title}</span>
                <span className={styles.chevron} data-empty={!item.sections.length || undefined} aria-hidden="true" />
              </button>
              {item.sections.length > 0 && (
                <div className={styles.sections} data-open={expanded || undefined}>
                  <ol>
                    {item.sections.map((section, j) => (
                      <li key={j}>
                        <button
                          type="button"
                          className={styles.section}
                          data-level={section.level}
                          data-marked={marked?.has(section.value) || undefined}
                          disabled={!marked?.has(section.value)}
                          onClick={() => onSelect?.(section.value)}
                        >
                          {section.title}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
