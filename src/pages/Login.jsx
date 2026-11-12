import { useEffect, useState } from 'react';
import { uploadLocalCategories } from '../data/categories.js';
import { signIn, supabase, useAuthReady, useSession } from '../data/supabase.js';
import { uploadLocalSchedules } from '../components/schedules.js';
import backIcon from '../assets/back.svg';
import styles from './Login.module.css';

// #/login: 주인 로그인 (Figma "Login page (1440)"). 로그인하면 노래 예약·카테고리를 추가하고 지울 수 있음
// 이메일·비밀번호를 넣고 Enter. 성공하면 바로 홈으로. 이미 로그인했으면 들어오자마자 홈으로
// 계정은 Supabase 대시보드(Authentication → Users)에서 만들고 owners 표에 등록 (supabase/schema.sql)

// 이전 화면이 있으면 그리로, 이 주소로 바로 열었으면 홈으로
function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

const goHome = () => window.location.replace('#/');

export default function Login() {
  const session = useSession();
  const ready = useAuthReady();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 이미 로그인했거나 Supabase를 안 쓰면(이 브라우저에만 저장, 로그인 필요 없음) 홈으로
  useEffect(() => {
    if (ready && !busy && (session || !supabase)) goHome();
  }, [ready, session, busy]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? '이메일이나 비밀번호가 맞지 않습니다.' : err.message);
      setBusy(false);
      return;
    }
    // 이 브라우저에만 있던 예약·카테고리를 Supabase로 옮김 (실패해도 로그인은 된 것이니 홈으로)
    await Promise.all([uploadLocalSchedules(), uploadLocalCategories()]).catch(() => {});
    goHome();
  };

  return (
    <div className={styles.page}>
      {/* 글 읽기 화면과 같은 상단 바: 양옆 64px 묶음 사이에 알약을 가운데로 */}
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <button type="button" className={styles.iconButton} aria-label="뒤로가기" onClick={goBack}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <h1 id="login-heading" className={styles.pill}>
          로그인
        </h1>
        <div className={styles.headerSide} />
      </header>

      <main className={styles.main}>
        <form className={styles.form} onSubmit={onSubmit} aria-labelledby="login-heading" aria-busy={busy}>
          <label className={styles.field}>
            <span>이메일</span>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {/* 버튼은 화면에 없고 Enter로 로그인 (칸이 둘이면 제출 버튼이 있어야 Enter가 먹음) */}
          <button type="submit" className={styles.hidden} disabled={busy}>
            로그인
          </button>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
