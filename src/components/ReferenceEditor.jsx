import { useEffect, useRef, useState } from 'react';
import { GlobeIcon, PlusIcon, REFERENCE_KINDS, kindIcon } from './ReferenceIcons.jsx';
import styles from './Reference.module.css';

// 왼쪽 아이콘을 누르면 종류(두루마리 / b)를 고르는 드롭다운
function KindPicker({ kind, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const Icon = kindIcon(kind);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className={styles.picker} ref={box}>
      <button
        type="button"
        className={`${styles.tile} ${styles.tileButton}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="참고문헌 종류 고르기"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {REFERENCE_KINDS.map(({ id, label, Icon: OptionIcon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={kind === id}
              aria-label={label}
              title={label}
              className={`${styles.tile} ${styles.tileButton}`}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
            >
              <OptionIcon />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 글쓰기 화면의 참고문헌 입력창 (Figma 198:2886)
export default function ReferenceEditor({ references, onChange, focusIndex }) {
  const [linkOpen, setLinkOpen] = useState(() => new Set());
  const inputs = useRef([]);

  useEffect(() => {
    if (focusIndex != null) inputs.current[focusIndex]?.focus();
  }, [focusIndex, references.length]);

  const set = (i, patch) => onChange(references.map((ref, j) => (j === i ? { ...ref, ...patch } : ref)));
  const remove = (i) => {
    onChange(references.filter((_, j) => j !== i));
    setLinkOpen(new Set());
    requestAnimationFrame(() => inputs.current[Math.max(0, i - 1)]?.focus());
  };
  const toggleLink = (i) =>
    setLinkOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className={styles.editor} aria-label="참고문헌 입력">
      {references.map((ref, i) => (
        <div key={i} className={styles.editRow}>
          <div className={styles.row}>
            <KindPicker kind={ref.kind} onChange={(kind) => set(i, { kind })} />
            <input
              ref={(el) => (inputs.current[i] = el)}
              className={styles.bar}
              placeholder="저자, 제목, 연도, 페이지."
              aria-label={`참고문헌 ${i + 1}`}
              value={ref.text}
              onChange={(e) => set(i, { text: e.target.value })}
              onKeyDown={(e) => {
                // 빈 칸에서 지우기를 한 번 더 누르면 그 줄을 없앰
                if (e.key === 'Backspace' && !ref.text && !ref.url) {
                  e.preventDefault();
                  remove(i);
                }
              }}
            />
            <button
              type="button"
              className={`${styles.tile} ${styles.tileButton}`}
              data-active={Boolean(ref.url) || undefined}
              aria-expanded={linkOpen.has(i)}
              aria-label="링크 입력"
              title={ref.url || '링크 입력'}
              onClick={() => toggleLink(i)}
            >
              <GlobeIcon />
            </button>
          </div>
          {linkOpen.has(i) && (
            <input
              className={`${styles.bar} ${styles.urlField}`}
              type="url"
              placeholder="https://"
              aria-label={`참고문헌 ${i + 1} 링크`}
              value={ref.url}
              autoFocus
              onChange={(e) => set(i, { url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  toggleLink(i);
                  inputs.current[i]?.focus();
                }
              }}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        className={styles.add}
        aria-label="참고문헌 추가"
        onClick={() => onChange([...references, { kind: 'paper', text: '', url: '' }], references.length)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
