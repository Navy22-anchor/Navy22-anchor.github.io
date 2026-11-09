import { useCallback, useEffect, useRef, useState } from 'react';
import DateTime from '../components/DateTime.jsx';
import DynamicIsland from '../components/DynamicIsland.jsx';
import ProjectStrip from '../components/ProjectStrip.jsx';
import { addCategory, loadCategories } from '../data/categories.js';
import { loadRows } from '../data/projects.js';
import braceLeft from '../assets/brace-left.svg';
import braceRight from '../assets/brace-right.svg';
import styles from './Landing.module.css';

// Shift + 휠(또는 트랙패드 가로 스와이프)을 이만큼 굴리면 하나씩 넘어감
const WHEEL_STEP = 60;
const WHEEL_LOCK_MS = 280;

// 처음엔 가운데 콘텐츠가 보이도록 (양옆이 모두 보이게)
const startIndex = (row) => Math.floor((row.items.length - 1) / 2) * (row.kind === 'posts' ? 0 : 1);

export default function Landing() {
  const [{ rows, initialRow }] = useState(loadRows);
  const [categories, setCategories] = useState(loadCategories);
  const [category, setCategory] = useState(categories[0]);
  const [adding, setAdding] = useState(false); // "+"를 눌러 새 카테고리 이름을 입력하는 중
  const [activeRow, setActiveRow] = useState(initialRow);
  // 줄마다 지금 가운데에 있는 콘텐츠 번호를 기억
  const [indexes, setIndexes] = useState({});

  const stripRef = useRef(null);
  const active = rows[activeRow] ?? rows[0];

  // 카테고리를 누르면 그 콘텐츠 줄을 중괄호 사이로 가져옴 (아직 콘텐츠가 없는 카테고리는 선택 표시만)
  const goToCategory = (name) => {
    setCategory(name);
    const i = rows.findIndex((row) => row.category === name);
    if (i !== -1) stripRef.current?.goTo(i);
  };
  // 스크롤로 줄이 바뀌면 카테고리 선택 표시도 따라감
  useEffect(() => {
    setCategory(active.category);
  }, [active.category]);
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
      if (e.target.closest?.('input, textarea, [role="dialog"]')) return; // 글자 입력·달력 사용 중에는 넘기지 않음
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

        <DateTime className={styles.dateTime} />

        <div className={styles.island}>
          <DynamicIsland />
        </div>

        <a href="#/write" className={`${styles.plainLink} ${styles.writeNav}`}>글쓰기</a>
      </header>

      <ul className={styles.categories} aria-label="카테고리">
        {categories.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={name === category ? styles.categoryActive : styles.category}
              aria-pressed={name === category}
              onClick={() => goToCategory(name)}
            >
              {name}
            </button>
          </li>
        ))}
        <li>
          {adding ? (
            <input
              className={styles.categoryInput}
              autoFocus
              maxLength={20}
              placeholder="새 카테고리"
              aria-label="새 카테고리 이름 (Enter로 추가, Esc로 취소)"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAdding(false);
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                const name = addCategory(e.currentTarget.value);
                if (name) {
                  setCategories(loadCategories());
                  setCategory(name);
                }
                setAdding(false);
              }}
              onBlur={() => setAdding(false)}
            />
          ) : (
            <button type="button" className={styles.category} aria-label="카테고리 추가" onClick={() => setAdding(true)}>
              +
            </button>
          )}
        </li>
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
          ref={stripRef}
          rows={rows}
          initialRow={initialRow}
          indexFor={indexFor}
          onActiveChange={setActiveRow}
          onChangeItem={changeItem}
          onOpen={openItem}
        />
      </main>
    </>
  );
}
