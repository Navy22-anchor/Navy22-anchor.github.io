import { useEffect, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

// Figma "Delete confirm dialog" (87:3860). 창은 사라질 때 DOM에서 빠지며 닫힘
// 실수로 Enter를 두 번 눌러 지우지 않게 처음 포커스는 "아니오"
export default function ConfirmDialog({ title = '삭제 하겠습니까?', onConfirm, onClose, busy = false, error = '' }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
      aria-labelledby="confirm-heading"
      aria-busy={busy}
    >
      <h2 id="confirm-heading" className={styles.dialogHeading}>
        {title}
      </h2>
      {error && (
        <p className={styles.dialogError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.dialogButton} ${styles.danger}`} onClick={onConfirm} disabled={busy}>
          {busy ? '삭제 중…' : '예'}
        </button>
        <button
          ref={cancelRef}
          type="button"
          className={styles.dialogButton}
          onClick={() => ref.current.close()}
          disabled={busy}
        >
          아니오
        </button>
      </div>
    </dialog>
  );
}
