import { useEffect, useRef, useState } from 'react';
import { addBook, hasBook, searchBooks } from '../data/books.js';
import { loadCategories } from '../data/categories.js';
import CategorySelect from './CategorySelect.jsx';
import styles from './BookSearch.module.css';

// Figma "Library / Book search (1440)" (306:2905): 오른쪽 위 "책"을 누르면 뜨는 책 검색 창
// 글자를 치면 잠깐 뒤 카카오 책 검색 → ↑↓로 고르고 Enter(또는 클릭) → 확인 창(Figma 68:198 모양)에서 "추가"
// Esc·×·바깥 클릭으로 닫힘
// 창은 사라질 때 DOM에서 빠지며 닫힘
const WAIT = 300; // 마지막 글자를 친 뒤 이만큼 멈추면 검색

export default function BookSearch({ onClose }) {
  const ref = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState(''); // 검색 중 · 결과 없음 · 오류 · 추가됨
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(null); // 확인 창에 띄운 책

  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
    inputRef.current.focus(); // showModal은 첫 버튼(×)에 포커스를 주므로 검색 칸으로 옮김
  }, []);

  // 치는 동안은 기다렸다가, 멈추면 검색 (늦게 온 예전 결과는 버림)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setStatus('');
      return undefined;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      setStatus('검색하는 중…');
      try {
        const books = await searchBooks(q);
        if (stale) return;
        setResults(books);
        setActive(0);
        setStatus(books.length ? '' : '찾는 책이 없어요');
      } catch (err) {
        if (!stale) setStatus(err.message);
      }
    }, WAIT);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  // 고른 줄이 목록 밖이면 보이게 스크롤
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // 고르면 바로 넣지 않고 확인 창을 띄움
  const pick = (book) => {
    if (!book || adding) return;
    if (hasBook(book)) {
      setStatus(`이미 서재에 있는 책이에요: ${book.title}`);
      return;
    }
    setPicked(book);
  };

  // 확인 창이 닫히면 검색 칸으로 돌아가 이어서 고를 수 있게 (창이 떠 있는 동안은 뒤 칸에 포커스를 못 줌)
  useEffect(() => {
    if (!picked) inputRef.current?.focus();
  }, [picked]);

  const closeConfirm = () => setPicked(null);

  const add = async (book, category) => {
    setPicked(null);
    setAdding(true);
    try {
      await addBook({ ...book, category });
      setStatus(`${category}에 추가했어요: ${book.title}`);
    } catch (err) {
      setStatus(`추가하지 못했어요 (${err.message})`);
    } finally {
      setAdding(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter·화살표는 글자 입력용
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]);
    }
  };

  return (
    <>
      <dialog
        ref={ref}
        className={styles.dialog}
        onClose={onClose}
        // 바깥(어두운 부분)을 누르면 닫힘
        onClick={(e) => e.target === ref.current && ref.current.close()}
        aria-label="책 검색"
      >
        <button type="button" className={styles.close} aria-label="책 검색 닫기" onClick={() => ref.current.close()}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <label className={styles.field}>
          <svg className={styles.lens} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            enterKeyHint="search"
            placeholder="책 제목, 저자, ISBN"
            aria-label="책 검색어"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="book-results"
            aria-activedescendant={results.length ? `book-${active}` : undefined}
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>

        {results.length > 0 && (
          <ul ref={listRef} id="book-results" className={styles.results} role="listbox" aria-label="검색 결과">
            {results.map((book, i) => (
              <li
                key={`${book.isbn}-${i}`}
                id={`book-${i}`}
                role="option"
                aria-selected={i === active}
                className={styles.result}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(book)}
              >
                {book.thumbnail ? (
                  <img className={styles.cover} src={book.thumbnail} alt="" width="44" height="64" loading="lazy" />
                ) : (
                  <span className={styles.cover} />
                )}
                <span className={styles.info}>
                  <span className={styles.title}>{book.title}</span>
                  <span className={styles.meta}>{[book.authors, book.publisher, book.year].filter(Boolean).join(' · ')}</span>
                </span>
                {hasBook(book) && <span className={styles.owned}>서재에 있음</span>}
              </li>
            ))}
          </ul>
        )}

        <p className={styles.hint} role="status">
          {status || '↑↓로 고르고 Enter로 추가 · 카카오 책 검색'}
        </p>
      </dialog>
      {picked && <ConfirmAdd book={picked} onConfirm={(category) => add(picked, category)} onCancel={closeConfirm} />}
    </>
  );
}

// 처음 고른 카테고리: Library (없으면 목록 첫 번째)
const defaultCategory = () => {
  const list = loadCategories();
  return list.find((c) => c.toLowerCase() === 'library') ?? list[0] ?? 'Library';
};

// Figma "Publish confirm dialog" (68:198·68:212)과 같은 모양: [카테고리▾] 에 추가하시겠습니까? + 고른 책 + 추가 / 취소
// 카테고리 알약을 누르면 목록이 펼쳐짐 → 고른 카테고리 줄(랜딩)에 책 표지가 붙음
function ConfirmAdd({ book, onConfirm, onCancel }) {
  const ref = useRef(null);
  const [category, setCategory] = useState(defaultCategory);

  useEffect(() => {
    if (!ref.current.open) ref.current.showModal(); // 첫 버튼("추가")에 포커스 → Enter로 바로 추가
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.confirm}
      // Esc로 닫히면 취소로 침
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      aria-labelledby="book-confirm-heading"
    >
      <div className={styles.confirmHeader}>
        <CategorySelect value={category} onChange={setCategory} />
        <h2 id="book-confirm-heading" className={styles.confirmHeading}>
          에 추가하시겠습니까?
        </h2>
      </div>
      <p className={styles.confirmBook}>
        <span className={styles.confirmTitle}>{book.title}</span>
        {book.authors && <span className={styles.meta}>{book.authors}</span>}
      </p>
      <div className={styles.confirmActions}>
        <button
          type="button"
          className={`${styles.confirmButton} ${styles.primary}`}
          onClick={() => onConfirm(category)}
          autoFocus
        >
          추가
        </button>
        <button type="button" className={styles.confirmButton} onClick={onCancel}>
          취소
        </button>
      </div>
    </dialog>
  );
}
