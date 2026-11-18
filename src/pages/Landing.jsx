import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BookSearch from '../components/BookSearch.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DateTime from '../components/DateTime.jsx';
import DynamicIsland from '../components/DynamicIsland.jsx';
import LogoutWord from '../components/LogoutWord.jsx';
import ProjectStrip from '../components/ProjectStrip.jsx';
import { useBooks } from '../data/books.js';
import { useCoverSizes } from '../data/coverSizes.js';
import { addCategory, loadCategories, removeCategory, useCategories } from '../data/categories.js';
import { useCanEdit, useSession, userName } from '../data/supabase.js';
import { categories as baseCategories, loadRows } from '../data/projects.js';
import braceLeft from '../assets/brace-left.svg';
import braceRight from '../assets/brace-right.svg';
import styles from './Landing.module.css';
import { navigate } from '../router.js';

// Shift + 휠(또는 트랙패드 가로 스와이프)을 이만큼 굴리면 하나씩 넘어감
const WHEEL_STEP = 60;
const WHEEL_LOCK_MS = 280;

// 처음엔 가운데 콘텐츠가 보이도록 (양옆이 모두 보이게)
// 콘텐츠가 아직 없는 카테고리("+"로 추가한 것)는 빈 줄(빈 중괄호 칸)로 둠. 그 카테고리로 글을 발행하면 글 줄로 바뀜
// 줄은 콘텐츠로만 만들어지므로, 카테고리 목록을 보고 빈 줄을 더하고 지운 카테고리의 빈 줄은 뺌
// 새로 고친 뒤엔 맨 끝(마지막 줄 다음)에 붙임. skip: 지금 애니메이션으로 끼우는 중인 이름
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const emptyRow = (name) => ({ id: `empty-${name}`, category: name, kind: 'empty', items: [] });
// source: 처음에 만든 콘텐츠 줄 전체. 목록에서 빠졌던 글 줄은 카테고리가 다시 보이면 되살림
// (Supabase 모드 첫 방문엔 기본 카테고리로 먼저 그렸다가 실제 목록을 받으므로, 그 사이 숨긴 글 줄이 돌아와야 함)
function withEmptyRows(list, names, skip, source = []) {
  // 빈 줄과 "+"로 추가한 카테고리의 글 줄은 그 카테고리가 목록에 있을 때만 보임
  const shown = (row) =>
    (row.kind !== 'empty' && !row.id.startsWith('posts-')) || names.some((name) => same(name, row.category));
  const keep = list.filter(shown);
  const back = source.filter((row) => shown(row) && !keep.some((r) => r.id === row.id));
  const rows = [...keep, ...back];
  const missing = names.filter(
    (name) =>
      !baseCategories.some((base) => same(base, name)) &&
      !(skip && same(skip, name)) &&
      !rows.some((row) => same(row.category, name)),
  );
  return keep.length === list.length && back.length === 0 && missing.length === 0
    ? list
    : [...rows, ...missing.map(emptyRow)];
}

// 책 → 고른 카테고리 줄의 사진 칸. 폭은 다른 책 표지와 같은 279, 높이는 표지 원본 비율대로 (안 잘리게)
// 원본 크기를 재기 전에는 일반적인 책 비율(279×400)
const COVER_W = 279;
const bookItem = (book, sizes) => {
  const size = sizes[book.cover];
  return {
    id: `book-${book.id}`,
    // 가운데 표지를 누르면 이 카테고리의 책장으로 (그 책이 골라진 채로)
    shelf: `${encodeURIComponent(book.category || 'Library')}/${encodeURIComponent(book.id)}`,
    src: book.cover,
    book: true, // 표지에 옅은 그림자 (RowCarousel)
    w: COVER_W,
    h: size ? Math.round((COVER_W * size[1]) / size[0]) : 400,
    label: [book.title, book.authors, book.publisher].filter(Boolean).join(', '),
  };
};

// 책 표지를 고른 카테고리 줄 끝에 붙임 (예전 책은 Library)
// 빈 줄은 표지 줄로 바뀌고, 글 줄(카드)에는 섞을 수 없어 바로 뒤에 같은 카테고리의 표지 줄을 따로 둠
// 줄이 없는 카테고리면 맨 끝에 새 줄. 목록에서 지운 카테고리의 책은 숨김
function withBooks(rows, books, names, sizes) {
  if (books.length === 0) return rows;
  const groups = [];
  for (const book of books) {
    const name = book.category || 'Library';
    const group = groups.find((g) => same(g.name, name));
    if (group) group.items.push(bookItem(book, sizes));
    else groups.push({ name, items: [bookItem(book, sizes)] });
  }
  const take = (name) => {
    const i = groups.findIndex((g) => same(g.name, name));
    return i === -1 ? null : groups.splice(i, 1)[0];
  };
  const bookRow = (name, items) => ({ id: `books-${name}`, category: name, kind: 'images', items });
  const out = [];
  for (const row of rows) {
    const group = take(row.category);
    if (!group) out.push(row);
    else if (row.kind === 'posts') out.push(row, bookRow(row.category, group.items));
    else out.push({ ...row, kind: 'images', items: [...row.items, ...group.items] });
  }
  for (const group of groups) {
    if (names.some((name) => same(name, group.name))) out.push(bookRow(group.name, group.items));
  }
  return out;
}

// 로그인한 사람의 이름: 계정 정보의 name(또는 full_name), 없으면 이메일 @ 앞부분
const startIndex = (row) => Math.floor((row.items.length - 1) / 2) * (row.kind === 'posts' ? 0 : 1);

export default function Landing() {
  const [{ rows: loadedRows, initialRow }] = useState(loadRows);
  const [rowList, setRows] = useState(() => withEmptyRows(loadedRows, loadCategories()));
  // "책" 검색 창에서 추가한 책은 고른 카테고리 줄 끝에 표지로 붙임
  const books = useBooks();
  const categories = useCategories();
  const coverSizes = useCoverSizes(books.map((book) => book.cover));
  const rows = useMemo(
    () => withBooks(rowList, books, categories, coverSizes),
    [rowList, books, categories, coverSizes],
  );
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [insertingName, setInsertingName] = useState(null); // 빈 줄을 끼우는 중인 카테고리 이름
  // 카테고리 목록이 바뀌면(다른 컴퓨터에서 추가·삭제 포함) 빈 줄도 맞춤
  useEffect(() => {
    setRows((list) => withEmptyRows(list, categories, insertingName, loadedRows));
  }, [categories, insertingName, loadedRows]);
  const editable = useCanEdit(); // 카테고리 추가·삭제는 주인(로그인)만
  const ownerName = userName(useSession()?.user); // 로그인하면 로고가 "이름 in Hanlog"
  const [category, setCategory] = useState(categories[0]);
  const [adding, setAdding] = useState(false); // "+"를 눌러 새 카테고리 이름을 입력하는 중
  const [removing, setRemoving] = useState(false); // "−"를 눌러 지울 카테고리를 고르는 중
  const [confirming, setConfirming] = useState(null); // "삭제 하겠습니까?" 카드에 띄운 카테고리
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
  const pendingGoTo = useRef(null);
  useEffect(() => {
    const name = pendingGoTo.current;
    const i = name ? rows.findIndex((row) => same(row.category, name)) : -1;
    if (i === -1) return;
    pendingGoTo.current = null;
    stripRef.current?.goTo(i);
  }, [rows]);

  // 삭제 모드에서 카테고리를 누르면 확인 카드부터
  const onCategoryClick = (name) => {
    if (removing) setConfirming(name);
    else goToCategory(name);
  };

  // 새 카테고리: 중괄호 자리에 빈 줄을 끼우는 애니메이션 (이미 줄이 있는 카테고리면 그 줄로 이동만)
  const insertCategory = (name) => {
    setCategory(name);
    if (rows.some((row) => row.category === name)) return goToCategory(name);
    // 숨겼다가 다시 추가한 카테고리라 글 줄이 있으면 빈 줄 대신 그 글 줄이 돌아옴 → 돌아오면 그리로 이동
    if (loadedRows.some((row) => same(row.category, name))) {
      pendingGoTo.current = name;
      return;
    }
    const row = emptyRow(name);
    setInsertingName(name);
    stripRef.current?.insert(row, (at) => {
      setRows((list) => {
        const rest = list.filter((r) => r.id !== row.id);
        return [...rest.slice(0, at), row, ...rest.slice(at)];
      });
      setInsertingName(null);
    });
  };

  const confirmRemove = () => {
    removeCategory(confirming);
    const next = loadCategories();
    setConfirming(null);
    if (next.length === 0) setRemoving(false);
  };

  // 삭제 고르기는 Esc로 끝냄 (확인 카드가 떠 있을 때 Esc는 카드만 닫음)
  useEffect(() => {
    if (!removing || confirming) return;
    const onKey = (e) => e.key === 'Escape' && setRemoving(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removing, confirming]);

  // 스크롤로 줄이 바뀌면 카테고리 선택 표시도 따라감
  useEffect(() => {
    setCategory(active.category);
  }, [active.category]);
  const indexFor = useCallback((row) => indexes[row.id] ?? startIndex(row), [indexes]);
  const itemIndex = indexFor(active);
  const item = active.items[itemIndex]; // 빈 줄이면 없음

  const changeItem = useCallback((row, next) => {
    setIndexes((prev) => ({ ...prev, [row.id]: Math.max(0, Math.min(row.items.length - 1, next)) }));
  }, []);

  const openItem = useCallback((it, row) => {
    if (row.kind === 'posts') navigate(`/post/${it.id}`);
    else if (it.shelf) navigate(`/shelf/${it.shelf}`);
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
      <header className={styles.header} data-books={editable || undefined} data-visitor={!editable || undefined}>
        {ownerName ? (
          // 로그인: "이름 in Hanlog" (방문자 로고와 같은 모양). "in"에 마우스를 올리면 빨간 "out" → 누르면 로그아웃
          <h1 className={`${styles.logo} ${styles.visitorLogo}`}>
            <span className={styles.logoName}>{ownerName}</span>
            <span className={styles.logoName}> </span>
            <span className={styles.logoBy}>
              <LogoutWord /> Hanlog
            </span>
          </h1>
        ) : editable ? (
          // Supabase 없이 이 브라우저에서만 쓰는 경우 (로그인 없음)
          <h1 className={styles.logo}>
            <span className={styles.logoName}>Hanlog</span>
            <span className={styles.logoSpace}> </span>
            <span className={styles.logoBy}>by</span>
          </h1>
        ) : (
          // 방문자 (Figma "Landing first screen (1920)" 310:4661): "Login at Hanlog", Login을 누르면 로그인 화면
          <h1 className={`${styles.logo} ${styles.visitorLogo}`}>
            <a href="/login" className={`${styles.plainLink} ${styles.logoName}`}>
              Login
            </a>
            <span className={styles.logoName}> </span>
            <span className={styles.logoBy}>at Hanlog</span>
          </h1>
        )}

        <DateTime className={styles.dateTime} />

        <div className={styles.island}>
          <DynamicIsland />
        </div>

        {/* 글쓰기·책은 주인만 (방문자 화면에는 없음) */}
        {editable && (
          <nav className={styles.writeNav} aria-label="쓰기">
            {/* "책": 카카오 책 검색으로 책 추가 */}
            <button type="button" className={`${styles.plainLink} ${styles.navButton}`} onClick={() => setSearchingBooks(true)}>
              책
            </button>
            {/* 지금 고른 카테고리를 글쓰기 화면의 기본 카테고리로 (빈 칸의 카테고리에서 누르면 그 카테고리로 발행) */}
            <a
              href="/write"
              className={styles.plainLink}
              onClick={() => {
                try {
                  sessionStorage.setItem('hanlog:write-category', category ?? '');
                } catch {
                  // 저장소를 못 쓰면 첫 카테고리가 기본
                }
              }}
            >
              글쓰기
            </a>
          </nav>
        )}
      </header>
      {searchingBooks && <BookSearch onClose={() => setSearchingBooks(false)} />}

      <ul className={styles.categories} aria-label="카테고리" data-removing={removing || undefined}>
        {/* Figma "minus" (157:1609): 목록 바로 위. 누르면 지울 카테고리를 고르는 상태 */}
        {editable && (
          <li className={styles.minusItem}>
            <button
              type="button"
              className={styles.minus}
              aria-label={removing ? '카테고리 삭제 끝내기' : '카테고리 삭제'}
              aria-pressed={removing}
              onClick={() => {
                setAdding(false);
                setRemoving((r) => !r);
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M0 5H10" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </li>
        )}
        {categories.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={name === category ? styles.categoryActive : styles.category}
              aria-pressed={removing ? undefined : name === category}
              aria-label={removing ? `${name} 삭제` : undefined}
              onClick={() => onCategoryClick(name)}
            >
              {name}
            </button>
          </li>
        ))}
        {editable && (
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
                  setAdding(false);
                  if (name) insertCategory(name);
                }}
                onBlur={() => setAdding(false)}
              />
            ) : (
              <button
                type="button"
                className={styles.category}
                aria-label="카테고리 추가"
                onClick={() => {
                  setRemoving(false);
                  setAdding(true);
                }}
              >
                +
              </button>
            )}
          </li>
        )}
      </ul>

      {confirming && <ConfirmDialog onConfirm={confirmRemove} onClose={() => setConfirming(null)} />}

      <div className={styles.focus}>
        {/* 빈 줄을 끼우는 동안: 원래 이름은 흐려지며 사라지고 새 이름이 나타남 (ProjectStrip INSERT_MS와 같은 시간) */}
        <p className={`${styles.tags} ${insertingName ? styles.fadeOut : ''}`} aria-live="polite">
          {active.category}
        </p>
        {insertingName && (
          <p className={`${styles.tags} ${styles.fadeIn}`} aria-hidden="true">
            {insertingName}
          </p>
        )}
        <img className={styles.braceLeft} src={braceLeft} alt="" width="71" height="173" />
        <img className={styles.braceRight} src={braceRight} alt="" width="71" height="173" />
        <p className={`${styles.roles} ${insertingName ? styles.fadeOut : ''}`} aria-live="polite">
          {!item ? '' : active.kind === 'posts' ? `${item.title}, ${item.date}` : item.label}
        </p>
        <p className={`${styles.index} ${insertingName ? styles.fadeOut : ''}`}>{item ? itemIndex + 1 : ''}</p>
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
