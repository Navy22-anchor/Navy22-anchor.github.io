import { useLayoutEffect, useRef, useState } from 'react';
import { signOut } from '../data/supabase.js';
import styles from './LogoutWord.module.css';

// 로고 "이름 in Hanlog"의 "in": 마우스를 올리면(또는 키보드로 고르면) "in"은 아래로 빠지고
// 빈자리에 빨간 "out"이 위에서 내려옴. 누르면 로그아웃
// "out"이 "in"보다 넓어서, 보이는 글자 폭에 맞춰 칸 폭도 함께 바뀜 (뒤의 "Hanlog"와 간격 유지)
export default function LogoutWord() {
  const inRef = useRef(null);
  const outRef = useRef(null);
  const [widths, setWidths] = useState(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    const measure = () => setWidths({ in: inRef.current.offsetWidth, out: outRef.current.offsetWidth });
    measure();
    document.fonts?.ready.then(measure); // 글꼴을 받은 뒤 폭이 바뀌므로 한 번 더
  }, []);

  const logout = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={styles.swap}
      style={widths ? { '--in-w': `${widths.in}px`, '--out-w': `${widths.out}px` } : undefined}
      aria-label="로그아웃"
      onClick={logout}
      disabled={busy}
    >
      <span ref={inRef} className={styles.in} aria-hidden="true">
        in
      </span>
      <span ref={outRef} className={styles.out} aria-hidden="true">
        out
      </span>
    </button>
  );
}
