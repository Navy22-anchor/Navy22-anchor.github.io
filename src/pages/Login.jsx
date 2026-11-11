import { useState } from 'react';
import { uploadLocalCategories } from '../data/categories.js';
import { signIn, signOut, supabase, useAuthReady, useSession } from '../data/supabase.js';
import { uploadLocalSchedules } from '../components/schedules.js';
import styles from './Login.module.css';

// #/login: 주인 로그인. 로그인하면 노래 예약·카테고리를 추가하고 지울 수 있음
// 계정은 Supabase 대시보드(Authentication → Users)에서 만들고 owners 표에 등록 (supabase/schema.sql)
export default function Login() {
  const session = useSession();
  const ready = useAuthReady();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 이 브라우저에만 있던 예약·카테고리를 Supabase로 옮김
  const upload = async () => {
    const [schedules, categories] = await Promise.all([uploadLocalSchedules(), uploadLocalCategories()]);
    if (schedules || categories) setMessage(`이 브라우저에 있던 예약 ${schedules}개, 카테고리 ${categories}개를 옮겼습니다.`);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await signIn(email.trim(), password);
      setPassword('');
      await upload().catch(() => setError('로그인은 됐지만 이 브라우저의 데이터를 옮기지 못했습니다. owners 표에 계정을 등록했는지 확인해 주세요.'));
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? '이메일이나 비밀번호가 맞지 않습니다.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <a href="#/" className={styles.back}>← 홈</a>
      <section className={styles.card} aria-labelledby="login-heading">
        <h1 id="login-heading" className={styles.heading}>로그인</h1>
        {!supabase ? (
          <p className={styles.note}>Supabase 주소와 키가 없어 이 브라우저에만 저장하는 중입니다. 로그인 없이 바꿀 수 있습니다.</p>
        ) : !ready ? (
          <p className={styles.note}>확인하는 중…</p>
        ) : session ? (
          <>
            <p className={styles.note}>
              <strong>{session.user.email}</strong> 으로 로그인했습니다. 노래 예약과 카테고리를 바꿀 수 있습니다.
            </p>
            <button type="button" className={styles.button} onClick={() => signOut()}>
              로그아웃
            </button>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.field}>
              <span>이메일</span>
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button type="submit" className={styles.button} disabled={busy}>
              {busy ? '로그인 중…' : '로그인'}
            </button>
          </form>
        )}
        {message && <p className={styles.note} role="status">{message}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </main>
  );
}
