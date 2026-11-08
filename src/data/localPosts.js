// 글 작성 페이지의 임시저장 글과, 발행했지만 아직 저장소에 올리지 않은 글은
// 이 브라우저(localStorage)에만 저장됩니다. GitHub Pages는 서버가 없어서,
// 모두에게 보이게 하려면 발행 때 받은 .md 파일을 content/posts/ 에 커밋해야 합니다.
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

// 같은 id(파일 이름)로 다시 발행하면 덮어씀
export function publishPost(post) {
  const others = loadLocalPosts().filter((p) => p.id !== post.id);
  return write(POSTS_KEY, [post, ...others]) ? post : null;
}

// 파일 이름(=글 주소). 예: 2026-11-08-1611 → content/posts/2026-11-08-1611.md, #/post/2026-11-08-1611
export function postId(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// 2026.11.08 16:11 형식
export function formatDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
