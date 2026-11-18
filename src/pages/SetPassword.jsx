import { useState } from 'react';
import {
  passwordLinkError,
  pendingPasswordLink,
  setPassword,
  supabase,
  useAuthReady,
  useSession,
} from '../data/supabase.js';
import backIcon from '../assets/back.svg';
import styles from './Login.module.css';
import { goBack, navigate } from '../router.js';

// /set-password: 초대 메일(또는 비밀번호 재설정 메일)의 링크로 들어오면 여기로 옴 (supabase.js가 보냄)
// 링크로 이미 로그인된 상태라, 새 비밀번호를 두 번 넣고 Enter → 다음부터 /login 에서 이메일·비밀번호로 로그인
// 생김새는 로그인 화면과 같음
const MIN_LENGTH = 6; // Supabase 기본 최소 길이

const goHome = () => navigate('/', { replace: true });


function message(err) {
  if (err.code === 'same_password') return '전과 다른 비밀번호를 넣어 주세요.';
  if (err.code === 'weak_password') return '더 길거나 복잡한 비밀번호를 넣어 주세요.';
  if (err.code === 'session_not_found' || err.status === 401) return '링크 로그인이 끝났어요. 메일을 다시 받아 주세요.';
  return err.message;
}

export default function SetPassword() {
  const session = useSession();
  const ready = useAuthReady();
  // 손대기 전(null)엔 이미 정해 둔 별명을 보여 줌 (로그인 확인이 늦게 끝나도 채워지도록)
  const [nameInput, setName] = useState(null);
  const name = nameInput ?? session?.user.user_metadata?.name ?? '';
  const [password, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const kind = pendingPasswordLink(); // 'invite' · 'recovery' · null
  const linkError = passwordLinkError();
  const title = kind === 'recovery' ? '비밀번호 재설정' : '비밀번호 정하기';

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_LENGTH) return setError(`비밀번호는 ${MIN_LENGTH}자 이상이어야 해요.`);
    if (password !== confirm) return setError('두 비밀번호가 같지 않아요.');
    setBusy(true);
    setError('');
    try {
      await setPassword(password, name.trim());
    } catch (err) {
      setError(message(err));
      setBusy(false);
      return;
    }
    goHome();
  };

  let body;
  if (!supabase || !ready) {
    body = null;
  } else if (!session) {
    // 링크가 만료됐거나 이미 썼거나, 링크 없이 이 주소로 바로 들어옴
    body = (
      <p className={styles.notice} role="alert">
        {linkError === 'otp_expired'
          ? '링크가 만료됐거나 이미 사용됐어요. 초대 메일을 다시 받아 주세요.'
          : linkError
            ? '링크로 로그인하지 못했어요. 메일을 다시 받아 주세요.'
            : '초대 메일의 링크로 들어와야 비밀번호를 정할 수 있어요.'}{' '}
        <a href="/login">로그인</a>
      </p>
    );
  } else {
    body = (
      <form className={styles.form} onSubmit={onSubmit} aria-labelledby="set-password-heading" aria-busy={busy} noValidate>
        {/* 비밀번호 관리자가 어느 계정의 비밀번호인지 알도록 이메일도 보여 줌 */}
        <label className={styles.field}>
          <span>이메일</span>
          <input type="email" autoComplete="username" value={session.user.email ?? ''} readOnly disabled />
        </label>
        {/* 로고 "별명 in Hanlog"에 나오는 이름. 비우면 이메일 @ 앞부분 */}
        <label className={styles.field}>
          <span>별명</span>
          <input
            type="text"
            autoComplete="nickname"
            autoFocus
            maxLength={30}
            placeholder={session.user.email?.split('@')[0]}
            disabled={busy}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>새 비밀번호</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            disabled={busy}
            value={password}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>비밀번호 확인</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            disabled={busy}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {/* 로그인 화면처럼 버튼은 안 보이고 Enter로 저장 */}
        <button type="submit" className={styles.hidden} disabled={busy}>
          저장
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <button type="button" className={styles.iconButton} aria-label="뒤로가기" onClick={goBack}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <h1 id="set-password-heading" className={styles.pill}>
          {title}
        </h1>
        <div className={styles.headerSide} />
      </header>

      <main className={styles.main}>{body}</main>
    </div>
  );
}
