import { createClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

// 노래 예약·카테고리를 모든 컴퓨터가 같이 보도록 Supabase에 저장합니다.
// 주소·키가 없으면(예: 배포 변수를 아직 안 넣음) 예전처럼 이 브라우저에만 저장합니다.
// 읽기는 누구나, 쓰기는 owners 표에 등록된 계정만 (supabase/schema.sql 의 RLS 규칙)
const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_KEY;

// 초대·비밀번호 재설정 메일의 링크로 들어오면 주소 끝(#access_token=…&type=invite)에 로그인 정보가 붙어 옴
// Supabase가 그걸 읽고 지우기 전에(createClient 전에) 어떤 링크였는지만 기억해 두고,
// 로그인이 되면 비밀번호 정하는 화면(#/set-password)으로 보냄. 새로고침해도 이어지게 이 탭에 저장
const SET_PASSWORD = 'hanlog:set-password';
const LINK_ERROR = 'hanlog:link-error';

function store(name, value) {
  try {
    if (value) sessionStorage.setItem(name, value);
    else sessionStorage.removeItem(name);
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
}

function stored(name) {
  try {
    return sessionStorage.getItem(name);
  } catch {
    return null;
  }
}

if (url && key) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const type = params.get('type');
  if (params.has('access_token') && (type === 'invite' || type === 'recovery')) {
    store(SET_PASSWORD, type);
    store(LINK_ERROR, null);
  } else if (params.has('error_description')) {
    // 만료됐거나 이미 쓴 링크: 로그인 정보가 없으니 주소를 바로 정리하고 안내 화면으로
    store(LINK_ERROR, params.get('error_code') || params.get('error') || 'error');
    window.location.replace('#/set-password');
  }
}

export const supabase = url && key ? createClient(url, key) : null;

let session = null;
let ready = !supabase; // 로그인 상태를 아직 확인하는 중이면 false
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

// 로그인 정보(JWT) 안의 내용: amr = 이번 로그인을 어떤 방법으로 했는지, session_id = 이 로그인의 고유번호
function claims(next) {
  try {
    const part = next.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return {};
  }
}

// 이 블로그는 이메일·비밀번호로만 로그인하니, 메일 링크(초대·재설정·매직 링크)로 로그인한 상태면
// 아직 비밀번호를 안 정한 것으로 봄. 주소의 type=invite 를 놓쳐도(예전 화면이 캐시에서 열림 등) 이걸로 알아챔
// 이 로그인에서 비밀번호를 정했으면 그 로그인 번호를 기억해 두고 다시 묻지 않음
const LINK_METHODS = new Set(['invite', 'recovery', 'otp', 'magiclink']);
const DONE = 'hanlog:password-set-session';

function linkLogin(next) {
  const { amr = [], session_id: id } = claims(next);
  if (!amr.length || !amr.every((entry) => LINK_METHODS.has(entry.method))) return null;
  try {
    if (id && localStorage.getItem(DONE) === id) return null;
  } catch {
    // 저장소를 못 쓰면 매번 확인
  }
  return amr.some((entry) => entry.method === 'recovery') ? 'recovery' : 'invite';
}

// 관리자로 로그인한 기기는 방문 통계에서 빼도록 표시를 남김 (index.html 이 읽음, 로그아웃해도 지우지 않음)
// 관리자인지는 owners 표를 직접 못 읽으니 is_owner() 함수로 확인
const NO_TRACK = 'hanlog:no-track';

async function markOwnerDevice() {
  try {
    if (localStorage.getItem(NO_TRACK)) return;
  } catch {
    return; // 저장소를 못 쓰면 표시도 못 남김
  }
  const { data, error } = await supabase.rpc('is_owner');
  if (error || data !== true) return;
  try {
    localStorage.setItem(NO_TRACK, '1');
  } catch {
    // 못 남기면 다음 로그인 때 다시
  }
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, next) => {
    session = next;
    ready = true;
    // 이 알림 안에서 Supabase를 다시 부르면 멈출 수 있어서 다음 차례에
    if (next) setTimeout(markOwnerDevice, 0);
    if (!next) store(SET_PASSWORD, null); // 로그아웃하면 더 안 물어봄
    else if (!stored(SET_PASSWORD) && linkLogin(next)) store(SET_PASSWORD, linkLogin(next));
    if (next && stored(SET_PASSWORD) && !/^#\/set-password\/?$/.test(window.location.hash)) {
      // 링크로 막 로그인됨 → 비밀번호부터 정하게 (이벤트 처리 중에 주소를 바꾸지 않도록 다음 차례에)
      setTimeout(() => window.location.replace('#/set-password'), 0);
    }
    emit();
  });
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getSession = () => session;
export const onSessionChange = subscribe;
export const useSession = () => useSyncExternalStore(subscribe, () => session);
export const useAuthReady = () => useSyncExternalStore(subscribe, () => ready);

// 바꿀 수 있는지: Supabase를 안 쓰면 이 브라우저 것이니 항상, 쓰면 로그인했을 때만
export const canEdit = () => !supabase || !!session;
export const useCanEdit = () => useSyncExternalStore(subscribe, canEdit);

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// 링크로 들어온 계정이 비밀번호를 아직 안 정했는지: 'invite'(초대) · 'recovery'(재설정) · null
export const pendingPasswordLink = () => stored(SET_PASSWORD);
// 링크가 잘못됐을 때 Supabase가 준 오류 코드 (예: 'otp_expired')
export const passwordLinkError = () => stored(LINK_ERROR);

// 지금 로그인한 계정의 비밀번호와 별명(로고 "별명 in Hanlog"의 앞부분)을 정함. 다 되면 위의 기억을 지움
// 별명을 비우면 그대로 둠 (로고에는 이메일 @ 앞부분이 나옴)
export async function setPassword(password, name = '') {
  const { error } = await supabase.auth.updateUser(name ? { password, data: { name } } : { password });
  if (error) throw error;
  try {
    const id = claims(session ?? {}).session_id;
    if (id) localStorage.setItem(DONE, id);
  } catch {
    // 저장소를 못 쓰면 이번 탭에서만 (아래 기억을 지우는 것으로 충분)
  }
  store(SET_PASSWORD, null);
  store(LINK_ERROR, null);
}
