// 글 작성 페이지의 임시저장 글과, 발행했지만 아직 저장소에 올리지 않은 글은
// 이 브라우저(localStorage)에만 저장됩니다. GitHub Pages는 서버가 없어서,
// 모두에게 보이게 하려면 발행 때 받은 .md 파일을 content/posts/ 에 커밋해야 합니다.
const DRAFT_KEY = 'hanlog:draft';
const DELETED_KEY = 'hanlog:deleted';
const POSTS_KEY = 'hanlog:posts';

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const emptyDraft = { title: '', author: '', markdown: '', references: [] };

// 새 글은 hanlog:draft, 기존 글 수정은 hanlog:draft:<id> 에 따로 임시저장
const draftKey = (id) => (id ? `${DRAFT_KEY}:${id}` : DRAFT_KEY);
// savedAt(저장한 시각)은 임시저장 목록에만 쓰고, 편집 화면의 글 내용에는 넣지 않음
const withoutTime = (value) => {
  if (!value) return value;
  const { savedAt: _savedAt, ...draft } = value;
  return draft;
};
export const loadSavedDraft = (id) => withoutTime(read(draftKey(id), null));
export const loadDraft = (id) => ({ ...emptyDraft, ...withoutTime(read(draftKey(id), {})) });
export const saveDraft = (draft, id) => {
  const ok = write(draftKey(id), { ...withoutTime(draft), savedAt: new Date().toISOString() });
  if (ok) draftListeners.forEach((fn) => fn());
  return ok;
};
export const clearDraft = (id) => {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // 저장소를 못 쓰는 환경이면 지울 것도 없음
  }
  draftListeners.forEach((fn) => fn());
};

// 임시저장한 글 전부 (보관함 목록). id: 수정 중인 글의 id, 새 글은 null. 최근에 저장한 것이 위
// 내용이 하나도 없는 임시저장은 뺌
const draftListeners = new Set();
export const subscribeDrafts = (fn) => {
  draftListeners.add(fn);
  const onStorage = (e) => (e.key === null || e.key?.startsWith(DRAFT_KEY)) && fn(); // 다른 탭에서 저장·삭제
  window.addEventListener('storage', onStorage);
  return () => {
    draftListeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
};
export function listDrafts() {
  const drafts = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== DRAFT_KEY && !key?.startsWith(`${DRAFT_KEY}:`)) continue;
      const value = read(key, null);
      if (!value || typeof value !== 'object') continue;
      const draft = { ...emptyDraft, ...value };
      if (!draft.title.trim() && !draft.markdown.trim()) continue;
      drafts.push({ ...draft, id: key === DRAFT_KEY ? null : key.slice(DRAFT_KEY.length + 1) });
    }
  } catch {
    // 저장소를 못 쓰면 목록도 없음
  }
  return drafts.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
}

export const loadLocalPosts = () => read(POSTS_KEY, []);

// 같은 id(파일 이름)로 다시 발행하면 덮어씀
export function publishPost(post) {
  const others = loadLocalPosts().filter((p) => p.id !== post.id);
  return write(POSTS_KEY, [post, ...others]) ? post : null;
}

// 삭제한 글: 이 브라우저 목록에서 빼고, 저장소 글은 다시 빌드될 때까지 숨김
export const loadDeletedIds = () => read(DELETED_KEY, []);
export function removePost(id) {
  write(POSTS_KEY, loadLocalPosts().filter((p) => p.id !== id));
  write(DELETED_KEY, [...new Set([...loadDeletedIds(), id])]);
}

// 파일 이름(=글 주소). 예: 2026-11-08-1611 → content/posts/2026-11-08-1611.md, /post/2026-11-08-1611
export function postId(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// 2026.11.08 16:11 형식
export function formatDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
