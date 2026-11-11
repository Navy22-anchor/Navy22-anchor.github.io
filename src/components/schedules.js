import { useSyncExternalStore } from 'react';
import { canEdit, supabase } from '../data/supabase.js';

// 노래 예약 목록 [{ id, at, color, track }] (시각 순). 아일랜드가 쓰고, 날짜 알약 달력도 같이 봄
// Supabase를 쓰면 모든 방문자가 같은 예약을 보고 그 시각에 같이 재생됨 (추가는 로그인한 주인만)
// Supabase가 없으면 이 브라우저에 저장. 다른 탭에서 바꿔도 따라감
const KEY = 'hanlog.island.schedules';
const FIRED_KEY = 'hanlog.island.fired'; // 이 브라우저에서 이미 재생한 예약 (새로 고침해도 다시 안 울리게)
export const SCHEDULE_GRACE = 5 * 60 * 1000; // 늦게 깨어나도 이 안이면 재생, 넘은 예약은 버림

const fresh = (s) => s.at > Date.now() - SCHEDULE_GRACE;
const byTime = (a, b) => a.at - b.at;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만 유지
  }
}

const loadLocal = () => {
  const list = readJson(KEY, []);
  return Array.isArray(list) ? list.filter(fresh) : [];
};

// 재생한 예약 id → 시각. 오래된 건 정리
const loadFired = () => {
  const fired = readJson(FIRED_KEY, {});
  const now = Date.now();
  return Object.fromEntries(Object.entries(fired).filter(([, at]) => at > now - SCHEDULE_GRACE * 2));
};
let fired = loadFired();

let schedules = supabase ? [] : loadLocal();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const set = (next) => {
  schedules = next.filter((s) => !fired[s.id]).sort(byTime);
  if (!supabase) writeJson(KEY, schedules);
  emit();
};

// Supabase에서 지금 유효한 예약을 받아 옴
const toRow = (s) => ({ id: s.id, at: s.at, color: s.color ?? null, track: s.track });
const fromRow = (r) => ({ id: r.id, at: Number(r.at), color: r.color, track: r.track });

async function refresh() {
  const { data, error } = await supabase
    .from('schedules')
    .select('id, at, color, track')
    .gt('at', Date.now() - SCHEDULE_GRACE)
    .order('at');
  if (!error) set(data.map(fromRow));
}

let syncing = false;
function startSync() {
  if (syncing || !supabase) return;
  syncing = true;
  refresh();
  // 다른 컴퓨터에서 예약을 넣거나 지우면 바로 따라감
  supabase
    .channel('schedules')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refresh)
    .subscribe();
  // 절전에서 깨어나면 놓친 변경을 다시 받음
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());
}

export async function addSchedule(entry) {
  if (schedules.some((s) => s.id === entry.id)) return;
  set([...schedules, entry]);
  if (!supabase) return;
  const { error } = await supabase.from('schedules').upsert(toRow(entry));
  if (error) {
    refresh(); // 저장이 안 됐으면 화면도 되돌림
    throw error;
  }
}

// 시각이 된 예약을 꺼냄: 목록에서 빼고, 이 브라우저에서 재생한 것으로 기록.
// 주인이 로그인해 있으면 Supabase에서도 지움 (방문자는 못 지우니 각자 기록만)
export function takeDue(now = Date.now()) {
  const due = schedules.filter((s) => s.at <= now);
  if (!due.length) return due;
  for (const s of due) fired[s.id] = s.at;
  writeJson(FIRED_KEY, fired);
  set(schedules.filter((s) => s.at > now));
  if (supabase && canEdit()) {
    supabase.from('schedules').delete().lte('at', now).then(() => {});
  }
  return due;
}

// 로그인하면 이 브라우저에만 있던 예약을 Supabase로 옮김
export async function uploadLocalSchedules() {
  const local = loadLocal();
  if (!supabase || !local.length) return 0;
  const { error } = await supabase.from('schedules').upsert(local.map(toRow));
  if (error) throw error;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지우지 못해도 다음에 다시 올릴 뿐 (같은 id라 겹치지 않음)
  }
  await refresh();
  return local.length;
}

const subscribe = (fn) => {
  listeners.add(fn);
  startSync();
  const onStorage = (e) => {
    if (supabase || e.key !== KEY) return;
    schedules = loadLocal();
    emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
};

export const useSchedules = () => useSyncExternalStore(subscribe, () => schedules);

// 달력 날짜 아래 점: 날짜(toDateString) → 그날 예약들의 앨범 색 (시각 순)
export function scheduleMarks(list) {
  const marks = new Map();
  for (const s of list) {
    const key = new Date(s.at).toDateString();
    marks.set(key, [...(marks.get(key) ?? []), s.color]);
  }
  return marks;
}
