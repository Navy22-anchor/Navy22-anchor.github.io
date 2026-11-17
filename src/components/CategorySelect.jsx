import { useEffect, useRef, useState } from 'react';
import { loadCategories } from '../data/categories.js';
import checkIcon from '../assets/check.svg';
import styles from './CategorySelect.module.css';

// 카테고리 고르기 (Figma "Publish confirm dialog"): 화살표 없는 알약 버튼을 누르면 목록이 펼쳐짐
export default function CategorySelect({ value, onChange }) {
  const [categories] = useState(loadCategories);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => categories.indexOf(value));
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointer = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const toggle = () => {
    setActive(categories.indexOf(value));
    setOpen((o) => !o);
  };

  const choose = (c) => {
    onChange(c);
    setOpen(false);
    rootRef.current.querySelector('button').focus();
  };

  const onListKey = (e) => {
    const last = categories.length - 1;
    const keys = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(categories[active]),
      ' ': () => choose(categories[active]),
      // 목록만 닫고 발행 창은 그대로
      Escape: () => {
        setOpen(false);
        rootRef.current.querySelector('button').focus();
      },
      Tab: () => setOpen(false),
    };
    if (!keys[e.key]) return;
    if (e.key !== 'Tab') e.preventDefault();
    e.stopPropagation();
    keys[e.key]();
  };

  return (
    <div ref={rootRef} className={styles.category}>
      <button
        type="button"
        className={styles.categoryButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`카테고리: ${value}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) toggle();
          }
        }}
      >
        {value}
      </button>
      {open && (
        <ul
          ref={listRef}
          className={styles.categoryMenu}
          role="listbox"
          tabIndex={-1}
          aria-label="카테고리"
          aria-activedescendant={`category-${active}`}
          onKeyDown={onListKey}
        >
          {categories.map((c, i) => (
            <li
              key={c}
              id={`category-${i}`}
              role="option"
              aria-selected={c === value}
              data-active={i === active || undefined}
              className={styles.categoryOption}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(c)}
            >
              {c}
              {c === value && <img src={checkIcon} alt="" width="11" height="8" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
