import { useCallback, useEffect, useRef, useState } from 'react';
import DynamicIsland from '../components/DynamicIsland.jsx';
import ProjectStrip from '../components/ProjectStrip.jsx';
import { categories, initialRow, rows } from '../data/projects.js';
import braceLeft from '../assets/brace-left.svg';
import braceRight from '../assets/brace-right.svg';
import styles from './Landing.module.css';

// Shift + 휠(또는 트랙패드 가로 스와이프)을 이만큼 굴리면 하나씩 넘어감
const WHEEL_STEP = 60;
const WHEEL_LOCK_MS = 280;

// 처음엔 가운데 콘텐츠가 보이도록 (양옆이 모두 보이게)
const startIndex = (row) => Math.floor((row.items.length - 1) / 2) * (row.kind === 'posts' ? 0 : 1);

export default function Landing() {
  const [category, setCategory] = useState(categories[0]);
  const [activeRow, setActiveRow] = useState(initialRow);
  // 줄마다 지금 가운데에 있는 콘텐츠 번호를 기억
  const [indexes, setIndexes] = useState({});

  // 카테고리별 페이지는 아직 없어서 선택 표시만 바꿉니다.
  const active = rows[activeRow] ?? rows[0];
  const indexFor = useCallback((row) => indexes[row.id] ?? startIndex(row), [indexes]);
  const itemIndex = indexFor(active);
  const item = active.items[itemIndex];

  const changeItem = useCallback((row, next) => {
    setIndexes((prev) => ({ ...prev, [row.id]: Math.max(0, Math.min(row.items.length - 1, next)) }));
  }, []);

  const openItem = useCallback((it, row) => {
    if (row.kind === 'posts') window.location.hash = `#/post/${it.id}`;
  }, []);

  // 가로 이동: Shift + 휠, 트랙패드 가로 스와이프, ←/→ 키
  const wheel = useRef({ acc: 0, lockedUntil: 0 });
  useEffect(() => {
    const onWheel = (e) => {
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const state = wheel.current;
      if (performance.now() < state.lockedUntil) return;
      state.acc += delta;
      if (Math.abs(state.acc) >= WHEEL_STEP) {
        changeItem(active, itemIndex + Math.sign(state.acc));
        state.acc = 0;
        state.lockedUntil = performance.now() + WHEEL_LOCK_MS;
      }
    };
    const onKey = (e) => {
      if (e.key === 'ArrowRight') changeItem(active, itemIndex + 1);
      else if (e.key === 'ArrowLeft') changeItem(active, itemIndex - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [changeItem, active, itemIndex]);

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.logo}>
          <span className={styles.logoName}>Hanlog</span>
          <span className={styles.logoSpace}> </span>
          <span className={styles.logoBy}>by</span>
        </h1>

        <nav className={styles.nav} aria-label="주요 메뉴">
          <a href="#/" className={styles.underline}>Work</a>
          <span className={styles.navSep}>
            , <a href="#/post" className={styles.plainLink}>About</a>
          </span>
        </nav>

        <div className={styles.island}>
          <DynamicIsland />
        </div>

        <a href="#/write" className={`${styles.plainLink} ${styles.writeNav}`}>글쓰기</a>

        <p className={styles.intro}>
          여기에 스튜디오 소개 문단이 들어갑니다. 프로젝트와 작업 방식을 짧게 적는 자리입니다.
        </p>
      </header>

      <ul className={styles.categories} aria-label="카테고리">
        {categories.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={name === category ? styles.categoryActive : styles.category}
              aria-pressed={name === category}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.focus}>
        <p className={styles.tags} aria-live="polite">{active.category}</p>
        <img className={styles.braceLeft} src={braceLeft} alt="" width="71" height="173" />
        <img className={styles.braceRight} src={braceRight} alt="" width="71" height="173" />
        <p className={styles.roles} aria-live="polite">
          {active.kind === 'posts' ? `${item.title}, ${item.date}` : item.label}
        </p>
        <p className={styles.index}>{itemIndex + 1}</p>
      </div>

      <main className={styles.main}>
        <ProjectStrip
          rows={rows}
          initialRow={initialRow}
          indexFor={indexFor}
          onActiveChange={setActiveRow}
          onChangeItem={changeItem}
          onOpen={openItem}
        />
      </main>

      <footer className={styles.footer}>
        <p>Vertical, Horizontal, Grid</p>
        <p className={styles.copyright}>All rights reserved. ©2026 Placeholder</p>
      </footer>
    </>
  );
}
