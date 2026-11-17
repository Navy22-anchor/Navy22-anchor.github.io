import { useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { removeBook, setSpine, useBooks } from '../data/books.js';
import { useCanEdit } from '../data/supabase.js';
import backIcon from '../assets/back.svg';
import styles from './Shelf.module.css';

// Figma "Library shelf (1440)" (249:2860): 카테고리를 누르면 그 카테고리의 책을 책등으로 꽂아 보여 주는 책장
// 책등 사진은 주인이 직접 올림 (아직 없으면 회색 칸). 고른 책은 조금 솟아오르고, 아래에 제목·저자·출판사
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

export default function Shelf({ name }) {
  const books = useBooks().filter((book) => same(book.category || 'Library', name));
  const editable = useCanEdit();
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null); // "삭제 하겠습니까?" 창에 띄운 책
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const fileRef = useRef(null);
  const target = useRef(null); // 책등을 올릴 책

  const selected = books.find((book) => book.id === selectedId) ?? books[0];

  const pickSpine = (book) => {
    target.current = book;
    fileRef.current.click();
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    const book = target.current;
    if (!file || !book) return;
    setUploading(true);
    setStatus('책등을 올리는 중…');
    try {
      await setSpine(book, file);
      setStatus('');
    } catch (err) {
      setStatus(`올리지 못했어요 (${err.message})`);
    } finally {
      setUploading(false);
    }
  };

  const confirmRemove = async () => {
    setRemoving(true);
    setDeleteError('');
    try {
      await removeBook(deleting);
      setDeleting(null);
      setSelectedId(null); // 지운 뒤엔 첫 책을 고름
    } catch (err) {
      setDeleteError(`삭제하지 못했어요 (${err.message})`);
    } finally {
      setRemoving(false);
    }
  };

  const onSpineClick = (book) => {
    // 주인이 이미 고른 회색 칸을 누르면 바로 사진 고르기
    if (editable && !book.spine && selected?.id === book.id) pickSpine(book);
    else setSelectedId(book.id);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <button type="button" className={styles.iconButton} aria-label="뒤로가기" onClick={goBack}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <a href="#/" className={styles.pill}>
          {name}
        </a>
        <div className={styles.headerSide} />
      </header>

      {books.length === 0 ? (
        <p className={styles.empty}>아직 꽂힌 책이 없어요</p>
      ) : (
        <main className={styles.shelf}>
          <div className={styles.spines} role="listbox" aria-label={`${name} 책장`}>
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                role="option"
                aria-selected={book.id === selected?.id}
                aria-label={book.title}
                className={styles.spine}
                data-empty={!book.spine || undefined}
                onClick={() => onSpineClick(book)}
                onMouseEnter={() => setSelectedId(book.id)}
                onFocus={() => setSelectedId(book.id)}
              >
                {book.spine && <img src={book.spine} alt="" draggable="false" />}
              </button>
            ))}
          </div>

          {selected && (
            <div className={styles.caption}>
              <p className={styles.info}>
                {[selected.title, selected.authors, selected.publisher].filter(Boolean).join(', ')}
              </p>
              {editable && (
                <span className={styles.tools}>
                  <button type="button" className={styles.upload} onClick={() => pickSpine(selected)} disabled={uploading}>
                    {selected.spine ? '책등 바꾸기' : '책등 올리기'}
                  </button>
                  <button type="button" className={styles.upload} onClick={() => setDeleting(selected)} disabled={uploading}>
                    책 삭제
                  </button>
                </span>
              )}
              {status && (
                <p className={styles.status} role="status">
                  {status}
                </p>
              )}
            </div>
          )}
        </main>
      )}

      {/* Figma "Delete confirm dialog" (87:3860) */}
      {deleting && (
        <ConfirmDialog
          onConfirm={confirmRemove}
          onClose={() => {
            setDeleting(null);
            setDeleteError('');
          }}
          busy={removing}
          error={deleteError}
        />
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
