import { createClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

// 노래 예약·카테고리를 모든 컴퓨터가 같이 보도록 Supabase에 저장합니다.
// 주소·키가 없으면(예: 배포 변수를 아직 안 넣음) 예전처럼 이 브라우저에만 저장합니다.
// 읽기는 누구나, 쓰기는 owners 표에 등록된 계정만 (supabase/schema.sql 의 RLS 규칙)
const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_KEY;

export const supabase = url && key ? createClient(url, key) : null;

let session = null;
let ready = !supabase; // 로그인 상태를 아직 확인하는 중이면 false
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (supabase) {
  supabase.auth.onAuthStateChange((_event, next) => {
    session = next;
    ready = true;
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
