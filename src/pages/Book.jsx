import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Toc from '../components/Toc.jsx';
import { Chevron, SpreadNav, useSpread } from '../components/Spread.jsx';
import { useBooks } from '../data/books.js';
import { removeQuotes, useQuotes } from '../data/quotes.js';
import { inSection, parseToc, sectionsWithQuotes } from '../data/toc.js';
import { useCanEdit } from '../data/supabase.js';
import backIcon from '../assets/back.svg';
import penIcon from '../assets/pen.svg';
import trashIcon from '../assets/trash.svg';
import styles from './Book.module.css';
import { goBack, navigate } from '../router.js';

// /book/<책 id>: 책에서 옮겨 적은 구절 읽기 (Figma "Library book page" 314:3052, 목차 327:3052 · 332:3052)
// 책장에서 책 이름을 누르면 옴. 왼쪽 목차, 오른쪽 두 쪽에 구절 + "왜 인상적이었나" (처음엔 코멘트를 접어 둠)
// 주인은 오른쪽 위 연필(쓰기 화면 /book/<id>/write), 휴지통(이 책의 구절 모두 삭제)
const GAP = 104; // 두 쪽 사이 (Book.module.css --gap)

export default function Book({ bookId }) {
  const book = useBooks().find((b) => b.id === bookId);
  const quotes = useQuotes(bookId);
  const editable = useCanEdit();
  const toc = useMemo(() => parseToc(book?.toc), [book?.toc]);
  const [open, setOpen] = useState(() => new Set()); // 코멘트를 펼친 구절
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const spread = useSpread(GAP);
  const [tocOpen, setTocOpen] = useState(false); // 목차를 펴면 본문이 오른쪽으로 비켜 줌

  useEffect(() => {
    if (book) document.title = `${book.title} - Hanlog`;
  }, [book]);

  const list = quotes ?? [];
  const withComment = list.filter((q) => q.comment);
  const allOpen = withComment.length > 0 && withComment.every((q) => open.has(q.id));
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(withComment.map((q) => q.id)));

  // 쓰기 화면은 이 화면을 바꿔 끼움 (발행하면 다시 이 화면으로 바꿔 끼움 → 뒤로가기는 책장으로)
  // 목차를 누르면 그 자리의 첫 구절이 있는 면으로 넘기고 잠깐 표시
  const marked = useMemo(() => sectionsWithQuotes(list), [list]);
  const jump = (value) => {
    const q = list.find((item) => inSection(item.section, value));
    const el = q && document.querySelector(`[data-quote="${q.id}"]`);
    if (!el) return;
    spread.reveal(el);
    el.removeAttribute('data-flash');
    void el.offsetWidth; // 같은 구절을 다시 눌러도 다시 깜빡이게
    el.setAttribute('data-flash', '');
    setTimeout(() => el.removeAttribute('data-flash'), 1600);
  };

  const edit = () => navigate(`/book/${encodeURIComponent(bookId)}/write`, { replace: true });

  const confirmRemove = async () => {
    setRemoving(true);
    setDeleteError('');
    try {
      await removeQuotes(bookId);
      setDeleting(false);
    } catch (err) {
      setDeleteError(`삭제하지 못했어요 (${err.message})`);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className={styles.page} data-toc={tocOpen ? 'open' : 'closed'}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <button type="button" className={styles.iconButton} aria-label="뒤로가기" onClick={goBack}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <h1 className={styles.pill}>
          <span>{book?.title ?? '책'}</span>
        </h1>
        <div className={styles.headerSide}>
          {editable && book && (
            <>
              <button type="button" className={styles.iconButton} aria-label="구절 쓰기" onClick={edit}>
                <img src={penIcon} alt="" width="24" height="24" />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="구절 모두 삭제"
                onClick={() => setDeleting(true)}
                disabled={!list.length}
              >
                <img src={trashIcon} alt="" width="24" height="24" />
              </button>
            </>
          )}
        </div>
      </header>

      {toc.length > 0 && (
        <aside className={styles.aside}>
          <Toc items={toc} onToggle={setTocOpen} onSelect={jump} marked={marked} />
        </aside>
      )}

      <main className={styles.main}>
        {!book && quotes !== null ? (
          <p className={styles.empty}>책을 찾을 수 없어요</p>
        ) : quotes !== null && list.length === 0 ? (
          <p className={styles.empty}>
            아직 옮겨 적은 구절이 없어요
            {editable && book && (
              <>
                <br />
                <button type="button" className={styles.link} onClick={edit}>
                  구절 쓰기
                </button>
              </>
            )}
          </p>
        ) : (
          <div ref={spread.ref} className={styles.spread}>
            <div className={styles.columns}>
              {list.map((q) => (
                <Entry key={q.id} quote={q} open={open.has(q.id)} onToggle={() => toggle(q.id)} />
              ))}
            </div>
          </div>
        )}
      </main>

      {list.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.bar}>
            {withComment.length > 0 && (
              <button type="button" className={styles.barPill} onClick={toggleAll} aria-expanded={allOpen}>
                {allOpen ? '코멘트 모두 접기' : '코멘트 모두 펼치기'}
                <Chevron dir={allOpen ? 'up' : 'down'} />
              </button>
            )}
            <SpreadNav {...spread} className={styles.barPill} buttonClassName={styles.navButton} />
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="이 책의 구절을 모두 삭제 하겠습니까?"
          onConfirm={confirmRemove}
          onClose={() => {
            setDeleting(false);
            setDeleteError('');
          }}
          busy={removing}
          error={deleteError}
        />
      )}
    </div>
  );
}

// 구절 하나: 인용 + 코멘트 상자 ("왜 인상적이었나 · 쓴 사람 … p. 23 ⌄", 누르면 펼침)
function Entry({ quote, open, onToggle }) {
  const hasComment = !!quote.comment;
  return (
    <article className={styles.entry} data-quote={quote.id}>
      {quote.section && <p className={styles.sectionLabel}>{quote.section}</p>}
      <blockquote className={styles.quote}>{quote.quote}</blockquote>
      {(hasComment || quote.page || quote.author_name) && (
        <div className={styles.comment}>
          {hasComment ? (
            <button type="button" className={styles.commentHead} aria-expanded={open} onClick={onToggle}>
              <CommentHead quote={quote} />
              <span className={styles.collapse} aria-hidden="true">
                <Chevron dir={open ? 'up' : 'down'} />
              </span>
            </button>
          ) : (
            <div className={styles.commentHead}>
              <CommentHead quote={quote} />
            </div>
          )}
          {hasComment && open && <p className={styles.commentText}>{quote.comment}</p>}
        </div>
      )}
    </article>
  );
}

function CommentHead({ quote }) {
  return (
    <>
      <span>왜 인상적이었나</span>
      {quote.author_name && <span className={styles.author}>{quote.author_name}</span>}
      <span className={styles.spacer} />
      {quote.page && <span className={styles.pageNumber}>p. {quote.page}</span>}
    </>
  );
}
