import { useEffect, useSyncExternalStore } from 'react';

// 책 표지 원본 크기 { 주소: [가로, 세로] }. 표지마다 비율이 달라 고정 크기로 그리면 잘리므로
// 처음 볼 때 그림을 받아 크기를 재고, 다음 방문 땐 바로 쓰도록 이 브라우저에 기억
const KEY = 'hanlog:cover-sizes';

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

let sizes = read();
const listeners = new Set();
const pending = new Set();

function remember(src, w, h) {
  sizes = { ...sizes, [src]: [w, h] };
  try {
    localStorage.setItem(KEY, JSON.stringify(sizes));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
  listeners.forEach((fn) => fn());
}

function measure(src) {
  if (!src || sizes[src] || pending.has(src)) return;
  pending.add(src);
  const img = new Image();
  img.onload = () => {
    pending.delete(src);
    if (img.naturalWidth && img.naturalHeight) remember(src, img.naturalWidth, img.naturalHeight);
  };
  img.onerror = () => pending.delete(src);
  img.src = src;
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// 주어진 표지들의 크기 (아직 모르면 재기 시작하고, 재는 동안은 빠져 있음)
export function useCoverSizes(srcs) {
  const all = useSyncExternalStore(subscribe, () => sizes);
  const key = srcs.join('\n');
  useEffect(() => {
    key.split('\n').forEach(measure);
  }, [key]);
  return all;
}
