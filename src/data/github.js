// 발행하면 GitHub API로 저장소의 content/posts/<id>.md 를 바로 커밋합니다.
// 커밋되면 GitHub Actions(deploy.yml)가 다시 빌드해 1~2분 뒤 모두에게 보입니다.
// 권한은 GitHub가 판단: 이 저장소에 쓰기 권한(Collaborator)이 있는 사람의 토큰만 통과합니다.
const REPO = 'Navy22-anchor/Navy22-anchor.github.io';
const BRANCH = 'main';
const TOKEN_KEY = 'hanlog:github-token';

export const TOKEN_HELP_URL = 'https://github.com/settings/personal-access-tokens/new';

// 토큰은 이 브라우저(localStorage)에만 저장됩니다
export function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 저장소를 못 쓰면 이번 발행에만 사용
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 무시
  }
}

export class PublishError extends Error {
  constructor(message, { badToken = false } = {}) {
    super(message);
    this.badToken = badToken;
  }
}

// 한글이 깨지지 않게 UTF-8 바이트로 base64
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function request(token, path, options = {}) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });
  } catch {
    throw new PublishError('GitHub에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
  }
  if (res.status === 401) throw new PublishError('토큰이 올바르지 않거나 만료되었습니다.', { badToken: true });
  if (res.status === 403 || (res.status === 404 && options.method)) {
    throw new PublishError('이 저장소에 글을 쓸 권한이 없습니다. 저장소 Contents 쓰기 권한이 있는 토큰인지 확인해 주세요.', {
      badToken: true,
    });
  }
  return res;
}

export async function commitPost(token, { id, title }, text) {
  const path = `content/posts/${encodeURIComponent(id)}.md`;

  // 같은 이름의 파일이 이미 있으면 덮어쓰기 위해 sha가 필요
  const existing = await request(token, `${path}?ref=${BRANCH}`);
  const sha = existing.ok ? (await existing.json()).sha : undefined;

  const res = await request(token, path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Post : ${sha ? 'update' : 'publish'} ${title || id}`,
      content: toBase64(text),
      branch: BRANCH,
      ...(sha && { sha }),
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new PublishError(`발행하지 못했습니다. (${res.status} ${detail.message ?? ''})`.trim());
  }
  return res.json();
}

// 삭제: 저장소의 content/posts/<id>.md 를 지우는 커밋. 파일이 없으면(아직 안 올린 글) false
export async function deletePost(token, { id, title }) {
  const path = `content/posts/${encodeURIComponent(id)}.md`;
  const existing = await request(token, `${path}?ref=${BRANCH}`);
  if (!existing.ok) return false;
  const { sha } = await existing.json();

  const res = await request(token, path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Post : delete ${title || id}`, sha, branch: BRANCH }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new PublishError(`삭제하지 못했습니다. (${res.status} ${detail.message ?? ''})`.trim());
  }
  return true;
}
