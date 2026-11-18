import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Toc from '../components/Toc.jsx';
import { Chevron, SpreadNav, useSpread } from '../components/Spread.jsx';
import { setToc, useBooks } from '../data/books.js';
import { saveQuotes, useQuotes } from '../data/quotes.js';
import { inSection, parseToc, sectionsWithQuotes, tocOptions } from '../data/toc.js';
import { useCanEdit, useSession, userName } from '../data/supabase.js';
import backIcon from '../assets/back.svg';
import styles from './Book.module.css';
import { navigate } from '../router.js';

// /book/<책 id>/write: 구절 쓰기 (Figma "Library book editor" 317:3052)
// 읽기 화면과 같은 자리에 글자칸: 구절, 쪽수(흰 칩), 왜 인상적이었나
// 가운데 알약 ⌄ 로 다른 책, 아래 "+ 구절 추가" · "− 구절 삭제"(커서가 있던 구절, 없으면 마지막 구절). 구절을 비우면 발행할 때도 빠짐
// 임시저장: 이 브라우저에만 (책마다 따로). 발행: Supabase에 저장하고 읽기 화면으로
// 왼쪽 목차는 붙여 넣은 글로 만듦 (src/data/toc.js)
const GAP = 104;
const draftKey = (bookId) => `hanlog:quote-draft:${bookId}`;
const bookPath = (bookId) => `/book/${encodeURIComponent(bookId)}`;

function readDraft(bookId) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(bookId)) ?? 'null');
    return draft && Array.isArray(draft.entries) ? draft : null;
  } catch {
    return null;
  }
}

// section: 목차 자리. 새 구절은 바로 앞 구절의 자리를 이어받음 (같은 장을 읽으며 연달아 적으니까)
const blank = (author_name, section = '') => ({
  key: crypto.randomUUID(),
  section,
  quote: '',
  page: '',
  comment: '',
  author_name,
});
const toEntry = (q) => ({
  key: q.id,
  id: q.id,
  quote: q.quote,
  page: q.page,
  comment: q.comment,
  author_name: q.author_name,
  section: q.section ?? '',
});

// 글자 수만큼 늘어나는 글자칸
function AutoText({ className, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });
  return <textarea ref={ref} rows={1} className={`${styles.input} ${className}`} {...props} />;
}

export default function BookWrite({ bookId }) {
  const books = useBooks();
  const book = books.find((b) => b.id === bookId);
  const quotes = useQuotes(bookId);
  const editable = useCanEdit();
  const me = userName(useSession()?.user);

  const [entries, setEntries] = useState(null); // 구절을 받아 온 뒤(또는 임시저장본) 채움
  const [tocText, setTocText] = useState(null);
  const [editingToc, setEditingToc] = useState(false);
  const [tocOpen, setTocOpen] = useState(false); // 목차를 펴거나 고치는 중이면 본문이 오른쪽으로 비켜 줌
  const [closed, setClosed] = useState(() => new Set()); // 코멘트를 접은 구절 (쓰기 화면은 처음에 다 펼침)
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const focusKey = useRef(null);
  const [activeKey, setActiveKey] = useState(null); // 마지막으로 커서가 있던 구절 (구절 삭제 대상)
  const [deleting, setDeleting] = useState(null); // "삭제 하겠습니까?" 창에 띄운 구절
  const spread = useSpread(GAP);

  // 처음 채우기: 임시저장본이 있으면 그것, 없으면 저장된 구절, 그것도 없으면 빈 구절 하나
  useEffect(() => {
    if (entries !== null || quotes === null) return;
    const draft = readDraft(bookId);
    if (draft) {
      setEntries(draft.entries.map((e) => ({ ...e, key: e.key ?? crypto.randomUUID() })));
      if (typeof draft.toc === 'string') setTocText(draft.toc);
      setStatus('임시저장한 글을 불러왔어요');
    } else {
      setEntries(quotes.length ? quotes.map(toEntry) : [blank(me)]);
    }
  }, [entries, quotes, bookId, me]);

  useEffect(() => {
    if (book) document.title = `${book.title} 구절 쓰기 - Hanlog`;
  }, [book]);

  const toc = tocText ?? book?.toc ?? '';
  const tocItems = useMemo(() => parseToc(toc), [toc]);
  const sections = useMemo(() => tocOptions(tocItems), [tocItems]);

  // 새 구절을 넣으면 그 구절 칸으로 커서
  useEffect(() => {
    if (!focusKey.current) return;
    document.querySelector(`[data-entry="${focusKey.current}"] textarea`)?.focus({ preventScroll: true });
    focusKey.current = null;
  });

  const list = entries ?? [];
  const update = (key, patch) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
    setStatus('');
  };
  // 구절 삭제: 커서가 있던 구절, 없으면 마지막 구절. 글이 있으면 한 번 묻고 지움 (발행 전까지는 저장된 구절에 영향 없음)
  const target = list.find((e) => e.key === activeKey) ?? list.at(-1);
  const removeEntry = (key) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
    setActiveKey(null);
    setDeleting(null);
    setStatus('');
  };
  const askRemove = () => {
    if (!target) return;
    if (target.quote.trim() || target.comment.trim() || target.page.trim()) setDeleting(target.key);
    else removeEntry(target.key);
  };
  // 목차를 누르면 그 자리의 첫 구절이 있는 면으로 넘기고 그 구절 칸에 커서
  const marked = useMemo(() => sectionsWithQuotes(list), [list]);
  const jump = (value) => {
    const entry = list.find((e) => inSection(e.section, value));
    const el = entry && document.querySelector(`[data-entry="${entry.key}"]`);
    if (!el) return;
    spread.reveal(el);
    el.querySelector('textarea')?.focus({ preventScroll: true });
  };

  const add = () => {
    const entry = blank(me, list.at(-1)?.section ?? '');
    focusKey.current = entry.key;
    setEntries((prev) => [...prev, entry]);
    spread.goLast();
  };
  const toggle = (key) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allOpen = list.every((e) => !closed.has(e.key));
  const toggleAll = () => setClosed(allOpen ? new Set(list.map((e) => e.key)) : new Set());

  const saveDraft = () => {
    if (!entries) return;
    try {
      localStorage.setItem(draftKey(bookId), JSON.stringify({ entries, toc: tocText, savedAt: Date.now() }));
      setStatus('임시저장했어요');
    } catch {
      setStatus('임시저장하지 못했어요');
    }
  };

  const publish = async () => {
    if (!entries || busy) return;
    setBusy(true);
    setStatus('발행하는 중…');
    try {
      const kept = entries
        .map((e) => ({
          ...e,
          quote: e.quote.trim(),
          page: e.page.trim(),
          comment: e.comment.trim(),
        }))
        .filter((e) => e.quote);
      await saveQuotes(bookId, kept);
      if (tocText !== null && tocText !== (book.toc ?? '')) await setToc(book, tocText);
      try {
        localStorage.removeItem(draftKey(bookId));
      } catch {
        // 지우지 못해도 그만
      }
      navigate(bookPath(bookId), { replace: true });
    } catch (err) {
      setStatus(`발행하지 못했어요 (${err.message})`);
      setBusy(false);
    }
  };

  // 다른 책으로: 지금 글은 임시저장해 두고 바꿔 끼움
  const switchBook = (id) => {
    saveDraft();
    navigate(`${bookPath(id)}/write`, { replace: true });
  };

  // 읽기 화면을 바꿔 끼우고 들어왔으니 뒤로가기도 읽기 화면으로 바꿔 끼움
  const back = () => navigate(bookPath(bookId), { replace: true });

  if (!editable) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>
          로그인해야 구절을 쓸 수 있어요. <a href="/login">로그인</a>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page} data-toc={tocOpen || editingToc || tocItems.length === 0 ? 'open' : 'closed'}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <button type="button" className={styles.iconButton} aria-label="뒤로가기" onClick={back}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <label className={`${styles.pill} ${styles.picker}`} {...keyboardFocus}>
          <span>{book?.title ?? '책 고르기'}</span>
          <Chevron />
          <select aria-label="책 고르기" value={bookId} onChange={(e) => switchBook(e.target.value)}>
            {!book && <option value={bookId}>책 고르기</option>}
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.headerSide}>
          {status && (
            <span className={styles.status} role="status">
              {status}
            </span>
          )}
          <button type="button" className={styles.action} onClick={saveDraft} disabled={busy || !entries}>
            임시저장
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.primary}`}
            onClick={publish}
            disabled={busy || !entries || !book}
          >
            발행
          </button>
        </div>
      </header>

      <aside className={styles.aside}>
        {editingToc || tocItems.length === 0 ? (
          <div className={styles.tocEditor}>
            <textarea
              aria-label="목차"
              placeholder={'목차를 붙여 넣으세요\n\n1장 …\n1.1 …\n1.1.1 …\n부록 A …'}
              value={toc}
              onChange={(e) => {
                setTocText(e.target.value);
                setStatus('');
              }}
            />
            <p className={styles.tocHint}>번호(1장, 1.1 …)는 화면에서 빠지고 글자 크기로 단계를 나눠요.</p>
            {tocItems.length > 0 && (
              <button type="button" className={styles.link} onClick={() => setEditingToc(false)}>
                목차 보기
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tocEditor}>
            <Toc items={tocItems} onToggle={setTocOpen} onSelect={jump} marked={marked} />
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                setEditingToc(true);
                setTocOpen(false);
              }}
            >
              목차 고치기
            </button>
          </div>
        )}
      </aside>

      <main className={styles.main}>
        <div ref={spread.ref} className={styles.spread}>
          <div className={styles.columns}>
            {list.map((entry) => {
              const open = !closed.has(entry.key);
              return (
                <article
                  key={entry.key}
                  className={styles.entry}
                  data-entry={entry.key}
                  onFocus={() => setActiveKey(entry.key)}
                >
                  {sections.length > 0 && (
                    <SectionPicker
                      options={sections}
                      value={entry.section ?? ''}
                      onChange={(section) => update(entry.key, { section })}
                    />
                  )}
                  <AutoText
                    className={styles.quote}
                    aria-label="구절"
                    placeholder="기억하고 싶은 구절을 옮겨 적으세요"
                    value={entry.quote}
                    onChange={(e) => update(entry.key, { quote: e.target.value })}
                  />
                  <div className={styles.comment}>
                    <div className={styles.commentHead}>
                      <span>왜 인상적이었나</span>
                      {entry.author_name && <span className={styles.author}>{entry.author_name}</span>}
                      <span className={styles.spacer} />
                      <input
                        className={styles.pageChip}
                        aria-label="쪽수"
                        placeholder="쪽수"
                        inputMode="numeric"
                        maxLength={10}
                        value={entry.page}
                        onChange={(e) => update(entry.key, { page: e.target.value })}
                      />
                      <button
                        type="button"
                        className={styles.collapse}
                        aria-label={open ? '코멘트 접기' : '코멘트 펼치기'}
                        aria-expanded={open}
                        onClick={() => toggle(entry.key)}
                      >
                        <Chevron dir={open ? 'up' : 'down'} />
                      </button>
                    </div>
                    {open && (
                      <AutoText
                        className={styles.commentText}
                        aria-label="왜 인상적이었나"
                        placeholder="이 구절이 왜 마음에 남았는지 적어 보세요"
                        value={entry.comment}
                        onChange={(e) => update(entry.key, { comment: e.target.value })}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>

      <div className={styles.bottomBar}>
        <div className={styles.bar}>
          <button type="button" className={styles.barPill} onClick={toggleAll} aria-expanded={allOpen}>
            {allOpen ? '코멘트 모두 접기' : '코멘트 모두 펼치기'}
            <Chevron dir={allOpen ? 'up' : 'down'} />
          </button>
          {spread.spreads > 1 && (
            <SpreadNav {...spread} className={styles.barPill} buttonClassName={styles.navButton} />
          )}
          <button type="button" className={styles.barPill} onClick={add} disabled={!entries}>
            <PlusMinus plus />
            구절 추가
          </button>
          <button type="button" className={styles.barPill} onClick={askRemove} disabled={!target}>
            <PlusMinus />
            구절 삭제
          </button>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title="이 구절을 삭제 하겠습니까?"
          onConfirm={() => removeEntry(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// 고르기 칸(select)의 포커스 테두리는 키보드(Tab)로 왔을 때만
// Chrome은 select를 마우스로 눌러도 :focus-visible 로 쳐서, 누른 뒤 검은 테두리가 남음 → 마우스로 누르면 표시를 지움
const keyboardFocus = {
  onPointerDown: (e) => e.currentTarget.removeAttribute('data-keyboard'),
  onKeyUp: (e) => e.key === 'Tab' && e.currentTarget.setAttribute('data-keyboard', ''),
  onBlur: (e) => e.currentTarget.removeAttribute('data-keyboard'),
};

// 구절 위 "목차 고르기 ⌄": 이 구절이 목차의 어디에 해당하는지 (장 › 절 › 항)
// 투명한 select를 글자 위에 겹침. 목차를 고쳐 예전 자리가 목록에 없어도 그대로 보여 줌
function SectionPicker({ options, value, onChange }) {
  const known = !value || options.some((o) => o.value === value);
  return (
    <label className={styles.sectionPicker} data-empty={!value || undefined} {...keyboardFocus}>
      <span>{value || '목차 고르기'}</span>
      <Chevron />
      <select
        aria-label="목차"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          e.target.blur();
        }}
      >
        <option value="">목차 고르지 않음</option>
        {!known && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {'\u00a0\u00a0\u00a0\u00a0'.repeat(o.level) + o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// + / − 아이콘 (글자 "+"는 글꼴에 따라 작거나 잘려 보여서 그림으로)
function PlusMinus({ plus = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      {plus && <path d="M7 2.5v9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />}
    </svg>
  );
}
