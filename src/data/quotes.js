import { useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';

// 책 구절: 책에서 옮겨 적은 구절 + "왜 인상적이었나" 코멘트 (책 페이지 /book/<책 id>)
// Supabase book_quotes 표에 저장 (쓰기는 주인만). Supabase가 없으면 이 브라우저(localStorage)에만
// 책마다 따로 받음: { [책 id]: [구절…] }
const KEY = 'hanlog:quotes';
const CACHE_KEY = 'hanlog:quotes-cache'; // Supabase에서 받은 구절 (다음 방문 첫 화면용)
// * : 나중에 더한 칸(section)을 아직 안 만든 데이터베이스에서도 받도록
const COLUMNS = '*';
const EMPTY = [];

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

let all = read(supabase ? CACHE_KEY : KEY);
const listeners = new Set();
function setBook(bookId, list) {
  all = { ...all, [bookId]: list };
  try {
    localStorage.setItem(supabase ? CACHE_KEY : KEY, JSON.stringify(all));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 반영
  }
  listeners.forEach((fn) => fn());
}

async function refresh(bookId) {
  const { data, error } = await supabase
    .from('book_quotes')
    .select(COLUMNS)
    .eq('book_id', bookId)
    .order('position')
    .order('created_at');
  // 표가 아직 없으면(schema.sql 실행 전) 빈 목록
  setBook(bookId, error ? (all[bookId] ?? EMPTY) : data);
}

// 지금 화면에 떠 있는 책들. 다른 컴퓨터에서 바꾸면 그 책만 다시 받음
const watched = new Map();
let channel = null;
function watch(bookId, fn) {
  listeners.add(fn);
  if (supabase) {
    watched.set(bookId, (watched.get(bookId) ?? 0) + 1);
    if (watched.get(bookId) === 1) refresh(bookId);
    channel ??= supabase
      .channel('book_quotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_quotes' }, (change) => {
        const id = change.new?.book_id ?? change.old?.book_id;
        // 지운 줄은 책 id 없이 올 수 있음 → 떠 있는 책 모두
        if (id) watched.has(id) && refresh(id);
        else watched.forEach((_, bookId) => refresh(bookId));
      })
      .subscribe();
  }
  return () => {
    listeners.delete(fn);
    if (!supabase) return;
    const left = watched.get(bookId) - 1;
    if (left) watched.set(bookId, left);
    else watched.delete(bookId);
  };
}

// 그 책의 구절 목록. 처음 받기 전에는 null
export function useQuotes(bookId) {
  const subscribe = useCallback((fn) => watch(bookId, fn), [bookId]);
  return useSyncExternalStore(subscribe, () => all[bookId] ?? (supabase ? null : EMPTY));
}

// 쓰기 화면의 "발행": 그 책의 구절을 통째로 이 목록으로 맞춤 (새 구절 추가, 고친 구절 저장, 빠진 구절 삭제)
// entries: [{ id?, quote, page, comment, author_name, section }] (보이는 순서대로)
export async function saveQuotes(bookId, entries) {
  const rows = entries.map((entry, position) => ({
    id: entry.id ?? crypto.randomUUID(),
    book_id: bookId,
    position,
    quote: entry.quote,
    page: entry.page,
    comment: entry.comment,
    author_name: entry.author_name,
    section: entry.section ?? '',
  }));
  if (!supabase) return setBook(bookId, rows);
  if (rows.length) {
    const { error } = await supabase.from('book_quotes').upsert(rows);
    if (error) throw error;
  }
  let remove = supabase.from('book_quotes').delete().eq('book_id', bookId);
  if (rows.length) remove = remove.not('id', 'in', `(${rows.map((row) => row.id).join(',')})`);
  const { error } = await remove;
  if (error) throw error;
  await refresh(bookId);
}

// 책 페이지의 "삭제": 그 책의 구절을 모두 지움 (책은 책장에 그대로)
export const removeQuotes = (bookId) => saveQuotes(bookId, []);
