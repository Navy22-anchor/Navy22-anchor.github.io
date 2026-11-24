import { useSyncExternalStore } from 'react';
import { canEdit, supabase } from './supabase.js';

// 카테고리 안 글 순서 { 카테고리(소문자): [글 id, …] }
// 글 화면의 카테고리 목록에서 글을 1초 꾹 눌러 순서 바꾸기 모드로 들어가 끌어서 바꿈
// Supabase를 쓰면 site_settings 표(key 'post_order')에 저장 (읽기는 누구나, 바꾸기는 주인만)
// Supabase가 없으면 이 브라우저에만 저장
const KEY = 'hanlog:post-order'; // Supabase가 없을 때 저장소, 있을 때는 다음 방문 첫 화면용
const SETTING = 'post_order';

const valid = (value) => value && typeof value === 'object' && !Array.isArray(value);

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return valid(value) ? value : {};
  } catch {
    return {};
  }
}

let order = read();
const listeners = new Set();

function set(next) {
  order = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
  listeners.forEach((fn) => fn());
}

async function refresh() {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', SETTING).maybeSingle();
  if (!error && data && valid(data.value)) set(data.value);
}

let syncing = false;
const subscribe = (fn) => {
  listeners.add(fn);
  if (supabase && !syncing) {
    syncing = true;
    refresh();
  }
  return () => listeners.delete(fn);
};

export const loadPostOrder = () => order;
export const usePostOrder = () => useSyncExternalStore(subscribe, () => order);

// 정한 순서대로. 순서를 정한 뒤에 새로 쓴 글(목록에 없는 글)은 맨 위에 최신순으로
// posts는 최신순으로 들어온다고 봄
export function sortByOrder(posts, category, current = order) {
  const ids = current[(category ?? '').toLowerCase()];
  if (!ids?.length) return posts;
  const rank = new Map(ids.map((id, i) => [id, i]));
  const fresh = posts.filter((post) => !rank.has(post.id));
  const placed = posts.filter((post) => rank.has(post.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id));
  return [...fresh, ...placed];
}

// 순서 저장 (주인만)
export async function savePostOrder(category, ids) {
  if (!canEdit()) return;
  const next = { ...order, [category.toLowerCase()]: ids };
  set(next);
  if (!supabase) return;
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: SETTING, value: next, updated_at: new Date().toISOString() });
  if (error) {
    refresh(); // 저장 못 했으면 저장된 순서로 되돌림
    throw error;
  }
}
