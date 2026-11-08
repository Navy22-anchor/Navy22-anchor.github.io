// 글 작성 페이지의 임시저장·발행 글은 이 브라우저(localStorage)에만 저장됩니다.
// GitHub Pages는 서버가 없어서, 모두에게 보이게 하려면 글 파일을 저장소에 올려야 합니다.
const DRAFT_KEY = 'hanlog:draft';
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

export const loadDraft = () => ({ ...emptyDraft, ...read(DRAFT_KEY, {}) });
export const saveDraft = (draft) => write(DRAFT_KEY, draft);
export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 저장소를 못 쓰는 환경이면 지울 것도 없음
  }
};

export const loadLocalPosts = () => read(POSTS_KEY, []);

export function publishPost(draft, date) {
  const post = { ...draft, id: `local-${Date.now()}`, date };
  const saved = write(POSTS_KEY, [post, ...loadLocalPosts()]);
  return saved ? post : null;
}

// 2026.11.08 16:11 형식
export function formatDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
