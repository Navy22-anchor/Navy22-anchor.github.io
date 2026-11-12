import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseIcon, GlobeIcon, MinimizeIcon, PlusIcon, REFERENCE_KINDS, kindIcon } from './ReferenceIcons.jsx';
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

// Figma "Motion / 참고문헌 – → Bar": – 를 누르면 400×172 → 460×64 바로 접힘 (아래 끝은 제자리)
const COLLAPSE = { duration: 500, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// 글쓰기 화면의 참고문헌 입력창 (Figma 198:2886, 접힌 모습 214:2452)
export default function ReferenceEditor({ references, onChange, focusIndex, collapsed, onCollapsedChange, onClose }) {
  const [linkOpen, setLinkOpen] = useState(() => new Set());
  const inputs = useRef([]);
  const card = useRef(null);
  const fromSize = useRef(null);

  // 접기·펼치기 전 크기를 재 두었다가, 바뀐 뒤 크기까지 움직임
  const toggle = (next) => {
    const el = card.current;
    fromSize.current = el ? { width: el.offsetWidth, height: el.offsetHeight } : null;
    onCollapsedChange(next);
  };
  useLayoutEffect(() => {
    const el = card.current;
    const from = fromSize.current;
    fromSize.current = null;
    if (!el || !from || reducedMotion()) return;
    const to = { width: el.offsetWidth, height: el.offsetHeight };
    if (from.width === to.width && from.height === to.height) return;
    el.dataset.animating = '';
    const px = ({ width, height }) => ({ width: `${width}px`, height: `${height}px` });
    const anim = el.animate([px(from), px(to)], COLLAPSE);
    anim.onfinish = anim.oncancel = () => delete el.dataset.animating;
  }, [collapsed]);

  // 빈 곳(칸·버튼 말고)을 잡고 끌면 입력창이 따라 움직임. 화면 밖으로는 못 나감
  // 접힌 바는 어디든 잡고 끌 수 있고, 끌었으면 놓을 때 펼쳐지지 않음
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragged = useRef(false);
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('input, textarea, [role="menu"]')) return;
    if (e.target.closest('button') && !e.target.closest(`.${styles.expand}`)) return;
    const el = card.current;
    const rect = el.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const margin = 8;
    // 지금 자리에서 더 갈 수 있는 거리
    const limit = {
      left: margin - rect.left,
      right: window.innerWidth - margin - rect.right,
      top: margin - rect.top,
      bottom: window.innerHeight - margin - rect.bottom,
    };
    const clamp = (v, lo, hi) => Math.min(Math.max(v, Math.min(lo, 0)), Math.max(hi, 0));
    dragged.current = false;
    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return; // 살짝 흔들린 건 누르기로 봄
      dragged.current = true;
      el.dataset.dragging = '';
      setOffset({
        x: start.x0 + clamp(dx, limit.left, limit.right),
        y: start.y0 + clamp(dy, limit.top, limit.bottom),
      });
    };
    const up = () => {
      delete el.dataset.dragging;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    start.x0 = offset.x;
    start.y0 = offset.y;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (!e.target.closest('button')) e.preventDefault(); // 끄는 동안 글자가 선택되지 않게
  };

  // 새 칸이나 지운 줄의 윗줄로 커서를 옮기고, 글 끝에 둠
  useEffect(() => {
    const el = focusIndex != null && inputs.current[focusIndex];
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusIndex, references.length]);

  const set = (i, patch) => onChange(references.map((ref, j) => (j === i ? { ...ref, ...patch } : ref)));
  const remove = (i) => {
    const next = references.filter((_, j) => j !== i);
    onChange(next, next.length ? Math.max(0, i - 1) : null);
    setLinkOpen(new Set());
  };
  const toggleLink = (i) =>
    setLinkOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div
      ref={card}
      className={styles.editor}
      data-collapsed={collapsed || undefined}
      aria-label="참고문헌 입력"
      style={{ translate: `${offset.x}px ${offset.y}px` }}
      onPointerDown={onPointerDown}
    >
      {/* 접힌 바 전체를 누르면 다시 펼침 (끌어서 옮겼을 때는 빼고) */}
      {collapsed && (
        <button
          type="button"
          className={styles.expand}
          aria-label="참고문헌 입력창 펼치기"
          onClick={() => {
            if (dragged.current) dragged.current = false;
            else toggle(false);
          }}
        />
      )}
      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.control} ${styles.minimize}`}
          aria-label={collapsed ? '참고문헌 입력창 펼치기' : '참고문헌 입력창 접기'}
          aria-expanded={!collapsed}
          onClick={() => toggle(!collapsed)}
        >
          <MinimizeIcon />
        </button>
        <button type="button" className={`${styles.control} ${styles.close}`} aria-label="참고문헌 입력창 닫기" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className={styles.rows} inert={collapsed || undefined}>
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
                  // 빈 칸에서 지우기를 한 번 더 누르면 그 줄을 없앰.
                  // 꾹 누르고 있을 때(반복 입력)는 글자만 지우고 줄은 남김
                  if (e.key === 'Backspace' && !ref.text && !e.repeat) {
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
    </div>
  );
}
