import { useSyncExternalStore } from 'react';
import { categories as baseCategories } from './projects.js';
import { supabase } from './supabase.js';

// 랜딩의 "+"로 추가한 카테고리와 "−"로 숨긴 기본 카테고리.
// Supabase를 쓰면 categories 표에 저장해 모든 컴퓨터가 같이 봄 (바꾸기는 로그인한 주인만)
//   name: 카테고리 이름, hidden: true면 "−"로 숨긴 기본 카테고리
// Supabase가 없으면 예전처럼 이 브라우저(localStorage)에만 저장
const KEY = 'hanlog:categories';
const HIDDEN_KEY = 'hanlog:hidden-categories';
const CACHE_KEY = 'hanlog:categories-cache'; // Supabase에서 받은 목록 (다음 방문 첫 화면용)

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 반영
  }
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const isBase = (name) => baseCategories.some((c) => same(c, name));

// 추가한 것과 숨긴 것 → 보여줄 목록
function combine(custom, hidden) {
  const all = baseCategories.filter((c) => !hidden.some((h) => same(h, c)));
  for (const c of custom) if (!all.some((x) => same(x, c))) all.push(c);
  return all;
}

const fromLocal = () => combine(readList(KEY), readList(HIDDEN_KEY));

// Supabase 모드에서 받아 둔 표 내용 (추가한 것 / 숨긴 기본 카테고리)
let custom = [];
let hidden = [];
let categories = supabase ? (readList(CACHE_KEY).length ? readList(CACHE_KEY) : [...baseCategories]) : fromLocal();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const set = (next) => {
  categories = next;
  if (supabase) writeList(CACHE_KEY, next);
  emit();
};

const setRows = (nextCustom, nextHidden) => {
  custom = nextCustom;
  hidden = nextHidden;
  set(combine(custom, hidden));
};

async function refresh() {
  const { data, error } = await supabase.from('categories').select('name, hidden').order('created_at');
  if (error) return;
  setRows(data.filter((r) => !r.hidden).map((r) => r.name), data.filter((r) => r.hidden).map((r) => r.name));
}

let syncing = false;
function startSync() {
  if (syncing || !supabase) return;
  syncing = true;
  refresh();
  supabase
    .channel('categories')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, refresh)
    .subscribe();
}

const subscribe = (fn) => {
  listeners.add(fn);
  startSync();
  return () => listeners.delete(fn);
};

export const loadCategories = () => categories;
export const useCategories = () => useSyncExternalStore(subscribe, () => categories);

// 저장이 실패하면 화면을 되돌리고 알림
async function save(run) {
  const { error } = await run();
  if (error) {
    refresh();
    throw error;
  }
}

// 추가한 이름(이미 있으면 기존 이름)을 돌려줌. 빈 이름이면 null
export function addCategory(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = categories.find((c) => same(c, clean));
  if (existing) return existing;
  // 숨겼던 기본 카테고리면 다시 보이게, 아니면 새로 추가
  const base = baseCategories.find((c) => same(c, clean));
  const shown = base ?? clean;
  if (supabase) {
    if (base) setRows(custom, hidden.filter((h) => !same(h, base)));
    else setRows([...custom, clean], hidden);
    save(() =>
      base
        ? supabase.from('categories').delete().eq('name', base)
        : supabase.from('categories').upsert({ name: clean, hidden: false }),
    ).catch(() => {});
  } else if (base) {
    writeList(HIDDEN_KEY, readList(HIDDEN_KEY).filter((h) => !same(h, base)));
    set(fromLocal());
  } else {
    writeList(KEY, [...readList(KEY), clean]);
    set(fromLocal());
  }
  return shown;
}

// "−" 삭제: 추가한 카테고리는 지우고, 기본 카테고리는 숨김
export function removeCategory(name) {
  if (supabase) {
    if (isBase(name)) setRows(custom, [...hidden, name]);
    else setRows(custom.filter((c) => !same(c, name)), hidden);
    save(() =>
      isBase(name)
        ? supabase.from('categories').upsert({ name, hidden: true })
        : supabase.from('categories').delete().eq('name', name),
    ).catch(() => {});
  } else {
    if (isBase(name)) writeList(HIDDEN_KEY, [...readList(HIDDEN_KEY), name]);
    else writeList(KEY, readList(KEY).filter((c) => !same(c, name)));
    set(fromLocal());
  }
}

// 로그인하면 이 브라우저에만 있던 추가·숨김을 Supabase로 옮김
export async function uploadLocalCategories() {
  const added = readList(KEY);
  const hid = readList(HIDDEN_KEY);
  if (!supabase || (!added.length && !hid.length)) return 0;
  const rows = [...added.map((name) => ({ name, hidden: false })), ...hid.map((name) => ({ name, hidden: true }))];
  const { error } = await supabase.from('categories').upsert(rows);
  if (error) throw error;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // 지우지 못해도 다음에 같은 이름으로 다시 올릴 뿐
  }
  await refresh();
  return rows.length;
}
