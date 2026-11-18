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
    // * : 목차(toc) 칸을 아직 안 만든 데이터베이스에서도 목록은 받도록
    .select('*')
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

// 책등 사진: 높이 1400px 넘으면 줄여서 JPEG로 (휴대폰 사진은 너무 큼)
const SPINE_MAX_H = 1400;
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SPINE_MAX_H / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('사진을 읽지 못했어요'))), 'image/jpeg', 0.9),
  );
}

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// 책등 사진 올리기 (주인만): Supabase Storage book-spines 에 올리고 books.spine 에 주소 저장
// Supabase가 없으면 이 브라우저에만 저장
export async function setSpine(book, file) {
  const blob = await shrink(file);
  if (!supabase) {
    const spine = await readAsDataUrl(blob);
    return set(books.map((b) => (b.id === book.id ? { ...b, spine } : b)));
  }
  const path = `${book.id}-${Date.now()}.jpg`; // 바꿀 때마다 새 이름 → 브라우저 캐시에 옛 사진이 남지 않음
  const storage = supabase.storage.from('book-spines');
  const { error: uploadError } = await storage.upload(path, blob, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { data } = storage.getPublicUrl(path);
  const { error } = await supabase.from('books').update({ spine: data.publicUrl }).eq('id', book.id);
  if (error) throw error;
  // 예전 사진은 지움 (실패해도 그만)
  const old = book.spine?.split('/book-spines/')[1];
  if (old) storage.remove([old]).catch(() => {});
  await refresh();
}

// 목차 저장 (주인만). toc: 붙여 넣은 목차 글 (src/data/toc.js 가 읽음)
export async function setToc(book, toc) {
  if (!supabase) return set(books.map((b) => (b.id === book.id ? { ...b, toc } : b)));
  const { error } = await supabase.from('books').update({ toc }).eq('id', book.id);
  if (error) throw error;
  await refresh();
}

// 책 삭제 (주인만): books 표에서 지우고, 올린 책등 사진도 Storage에서 지움
export async function removeBook(book) {
  if (!supabase) return set(books.filter((b) => b.id !== book.id));
  const { error } = await supabase.from('books').delete().eq('id', book.id);
  if (error) throw error;
  const spine = book.spine?.split('/book-spines/')[1];
  if (spine) supabase.storage.from('book-spines').remove([spine]).catch(() => {});
  await refresh();
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
