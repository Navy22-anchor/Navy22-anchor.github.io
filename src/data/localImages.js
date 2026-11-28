// 글에 직접 올린 사진. 발행 전까지는 이 브라우저(IndexedDB)에만 두고, 발행할 때 글과 함께
// 저장소의 public/images/posts/ 에 커밋합니다. 글에는 /images/posts/<파일 이름> 주소로 들어갑니다.
import { getSession, supabase } from './supabase.js';

const DB_NAME = 'hanlog';
const STORE = 'images';
export const IMAGE_DIR = '/images/posts/';
export const imageRepoPath = (src) => `public${src}`;

const MAX_SIZE = 1600; // 긴 변 기준. 더 큰 사진은 줄여서 올림

let dbPromise;
function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

// 미리보기·글 화면이 바로 쓸 수 있게 주소 → 브라우저 안 임시 주소(blob:)
const urls = new Map();
const listeners = new Set();
let version = 0;
const emit = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

export const subscribeImages = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const imagesVersion = () => version;
export const localImageUrl = (src) => urls.get(src);

// 저장해 둔 사진을 처음에 한 번 불러옴 (다 불러오기 전에는 다른 기기 사진을 받지 않음)
const loaded = (async () => {
  try {
    const keys = await withStore('readonly', (store) => store.getAllKeys());
    const blobs = await withStore('readonly', (store) => store.getAll());
    keys.forEach((key, i) => urls.set(key, URL.createObjectURL(blobs[i])));
    if (keys.length) emit();
  } catch {
    // IndexedDB를 못 쓰는 환경이면 이번 화면에서만 보임
  }
})();

export async function loadImageBlob(src) {
  try {
    return await withStore('readonly', (store) => store.get(src));
  } catch {
    return undefined;
  }
}

// 큰 사진은 줄이고 WebP로. 움직이는 GIF와 SVG는 그대로
async function prepare(file) {
  if (/image\/(gif|svg\+xml)/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 500_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  return blob ?? file;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' };

// 사진 파일을 저장하고 글에 넣을 주소를 돌려줌. 예: /images/posts/20261111-153012-a3f9.webp
export async function addImage(file) {
  const blob = await prepare(file);
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const name = `${stamp}-${Math.random().toString(36).slice(2, 6)}.${EXT[blob.type] ?? 'png'}`;
  const src = IMAGE_DIR + name;
  urls.set(src, URL.createObjectURL(blob));
  emit();
  try {
    await withStore('readwrite', (store) => store.put(blob, src));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 보임
  }
  return src;
}

// 글 안에서 직접 올린 사진 주소만 골라냄
export function imagesIn(markdown) {
  const found = new Set();
  for (const m of markdown.matchAll(/\]\((\/images\/posts\/[^)\s]+)\)/g)) found.add(m[1]);
  return [...found];
}

// ── 임시저장 글의 사진을 다른 기기에서도 보이게 (Supabase Storage draft-images, 로그인한 본인만) ──
// 파일 자리: <내 계정 id>/<파일 이름>. 올린 사진은 이 브라우저에 기억해 두고 다시 올리지 않음
const BUCKET = 'draft-images';
const UPLOADED = 'hanlog:uploaded-images';
const nameOf = (src) => src.slice(IMAGE_DIR.length);
const pathOf = (src) => `${getSession().user.id}/${nameOf(src)}`;

function uploadedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED)) ?? []);
  } catch {
    return new Set();
  }
}

// 글에 들어간 사진 중 아직 안 올린 것을 올림. 하나라도 못 올리면 false
export async function uploadImages(srcs) {
  if (!supabase || !getSession() || !srcs.length) return true;
  await loaded;
  const done = uploadedSet();
  let ok = true;
  for (const src of srcs) {
    if (done.has(src)) continue;
    const blob = await loadImageBlob(src);
    if (!blob) continue; // 이 브라우저에 없는 사진(이미 저장소에 있는 사진 등)
    const { error } = await supabase.storage.from(BUCKET).upload(pathOf(src), blob, { contentType: blob.type, upsert: true });
    if (error) ok = false;
    else done.add(src);
  }
  try {
    localStorage.setItem(UPLOADED, JSON.stringify([...done]));
  } catch {
    // 못 남기면 다음에 다시 올림 (덮어쓰기라 괜찮음)
  }
  return ok;
}

// 이 브라우저에 없는 사진을 받아 옴 (다른 기기에서 임시저장한 글의 사진)
export async function fetchImages(srcs) {
  if (!supabase || !getSession() || !srcs.length) return;
  await loaded;
  const done = uploadedSet();
  let got = false;
  for (const src of srcs) {
    if (urls.has(src)) continue;
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(pathOf(src));
    if (error || !blob) continue; // 저장소에 이미 올라간 사진이면 여기 없음 (주소로 바로 보임)
    urls.set(src, URL.createObjectURL(blob));
    done.add(src); // 이미 올라가 있으니 다시 올리지 않음
    got = true;
    try {
      await withStore('readwrite', (store) => store.put(blob, src));
    } catch {
      // 저장소를 못 쓰면 이번 화면에서만 보임
    }
  }
  if (!got) return;
  try {
    localStorage.setItem(UPLOADED, JSON.stringify([...done]));
  } catch {
    // 못 남겨도 다음에 덮어쓰기로 다시 올릴 뿐
  }
  emit();
}
