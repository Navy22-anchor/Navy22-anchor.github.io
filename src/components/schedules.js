import { useSyncExternalStore } from 'react';

// 노래 예약 목록 [{ id, at, color, track }] (시각 순). 아일랜드가 쓰고, 날짜 알약 달력도 같이 봄
// 브라우저에 저장. 다른 탭에서 바꿔도 따라감
const KEY = 'hanlog.island.schedules';
export const SCHEDULE_GRACE = 5 * 60 * 1000; // 늦게 깨어나도 이 안이면 재생, 넘은 예약은 버림

const load = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list.filter((s) => s.at > Date.now() - SCHEDULE_GRACE) : [];
  } catch {
    return [];
  }
};

let schedules = load();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function setSchedules(update) {
  schedules = typeof update === 'function' ? update(schedules) : update;
  try {
    localStorage.setItem(KEY, JSON.stringify(schedules));
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만 유지
  }
  emit();
}

const subscribe = (fn) => {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key !== KEY) return;
    schedules = load();
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
