import { useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';

// 서재 책: 오른쪽 위 "책"을 눌러 검색 창(카카오 책 검색)에서 고른 책.
// Supabase books 표에 저장해 모든 컴퓨터가 같이 봄 (추가·삭제는 로그인한 주인만)
// 검색은 Supabase Edge Function(book-search)이 카카오에 대신 물어봄 → 카카오 키는 블로그 코드에 없음
// Supabase가 없으면 검색은 못 하고, 고른 책은 이 브라우저(localStorage)에만 저장
const KEY = 'hanlog:books';
const CACHE_KEY = 'hanlog:books-cache'; // Supabase에서 받은 목록 (다음 방문 첫 화면용)

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 반영
  }
}

let books = read(supabase ? CACHE_KEY : KEY);
const listeners = new Set();
const set = (next) => {
  books = next;
  write(supabase ? CACHE_KEY : KEY, next);
  listeners.forEach((fn) => fn());
};

async function refresh() {
  const { data, error } = await supabase
    .from('books')
    .select('id, isbn, title, authors, publisher, year, cover, category')
    .order('created_at');
  if (!error) set(data);
}

let syncing = false;
const subscribe = (fn) => {
  listeners.add(fn);
  if (supabase && !syncing) {
    syncing = true;
    refresh();
    supabase
      .channel('books')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, refresh)
      .subscribe();
  }
  return () => listeners.delete(fn);
};

export const useBooks = () => useSyncExternalStore(subscribe, () => books);

const sameBook = (a, b) => (a.isbn && a.isbn === b.isbn) || (a.title === b.title && a.authors === b.authors);
export const hasBook = (book) => books.some((b) => sameBook(b, book));

// 추가 (이미 있으면 그대로). category: 표지가 붙을 랜딩 줄 (기본 Library). 실패하면 화면을 되돌리고 오류를 던짐
export async function addBook({ isbn = '', title, authors = '', publisher = '', year = '', cover = '', category = 'Library' }) {
  const book = { isbn, title, authors, publisher, year, cover, category };
  if (hasBook(book)) return;
  if (!supabase) return set([...books, { id: crypto.randomUUID(), ...book }]);
  set([...books, { id: `pending-${Date.now()}`, ...book }]);
  const { error } = await supabase.from('books').insert(book);
  await refresh();
  if (error) throw error;
}

// 카카오 책 검색 (Edge Function 경유). [{ isbn, title, authors, publisher, year, thumbnail, cover }]
export async function searchBooks(query) {
  const q = query.trim();
  if (!q) return [];
  // 개발 중(Supabase 없음) 화면 확인용: window.__mockBookSearch(q) 가 있으면 그 결과를 씀. 배포 코드에는 빠짐
  if (import.meta.env.DEV && typeof window.__mockBookSearch === 'function') return window.__mockBookSearch(q);
  if (!supabase) throw new Error('Supabase가 연결되어 있어야 책을 검색할 수 있어요');
  // GET .../functions/v1/book-search?query=검색어 (로그인 토큰은 라이브러리가 자동으로 붙임)
  const { data, error } = await supabase.functions.invoke(`book-search?query=${encodeURIComponent(q)}`, {
    method: 'GET',
  });
  if (error) {
    // 함수가 보낸 오류 문구가 있으면 그걸 보여 줌
    const message = await error.context?.json?.().then((body) => body.error).catch(() => null);
    throw new Error(message || '검색하지 못했어요');
  }
  return data.books ?? [];
}
