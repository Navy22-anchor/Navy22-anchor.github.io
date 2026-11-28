import { getSession, onSessionChange, supabase } from './supabase.js';
import { fetchImages, imagesIn, uploadImages } from './localImages.js';

// 발행했지만 아직 저장소에 올리지 않은 글은 이 브라우저(localStorage)에만 저장됩니다.
// 임시저장 글도 이 브라우저에 저장하되, 로그인해 있으면 Supabase(drafts 표)에도 올려 다른 기기에서도 보입니다. GitHub Pages는 서버가 없어서,
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
// syncedAt: Supabase에 올린 적이 있다는 표시 (다른 기기에서 지운 임시저장을 알아보는 데 씀)
const withoutTime = (value) => {
  if (!value) return value;
  const { savedAt: _savedAt, syncedAt: _syncedAt, ...draft } = value;
  return draft;
};
export const loadSavedDraft = (id) => withoutTime(read(draftKey(id), null));
export const loadDraft = (id) => ({ ...emptyDraft, ...withoutTime(read(draftKey(id), {})) });

// ── 다른 기기와 같이 보기 (Supabase drafts 표, 로그인한 본인만) ──
// 브라우저에도 그대로 저장해 두고, 로그인해 있으면 Supabase에도 올림. 새 글 자리는 slot 'new'
const NEW_SLOT = 'new';
const slotOf = (id) => id ?? NEW_SLOT;
const idOf = (slot) => (slot === NEW_SLOT ? null : slot);
const remoteOn = () => !!supabase && !!getSession();

const draftListeners = new Set();
const emitDrafts = () => draftListeners.forEach((fn) => fn());

// 임시저장: 브라우저에 먼저 저장하고, 로그인해 있으면 Supabase에도 올림
// 결과: 'synced'(모든 기기에서 보임) · 'local'(이 브라우저에만 저장됨) · false(저장 못 함)
export async function saveDraft(draft, id) {
  const savedAt = new Date().toISOString();
  const value = { ...withoutTime(draft), savedAt };
  const ok = write(draftKey(id), value);
  if (ok) emitDrafts();
  if (!remoteOn()) return ok ? 'local' : false;
  // 사진부터 올려야 다른 기기에서 글을 열었을 때 사진도 보임
  const imagesOk = await uploadImages(imagesIn(draft.markdown ?? ''));
  const { error } = await supabase
    .from('drafts')
    .upsert({ slot: slotOf(id), value: withoutTime(draft), saved_at: savedAt }, { onConflict: 'user_id,slot' });
  if (error || !imagesOk) return ok ? 'local' : false;
  // 올리는 동안 또 저장했으면 그 저장이 표시를 남김
  const now = read(draftKey(id), null);
  if (ok && now?.savedAt === savedAt) write(draftKey(id), { ...now, syncedAt: savedAt });
  return 'synced';
}

export const clearDraft = (id) => {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // 저장소를 못 쓰는 환경이면 지울 것도 없음
  }
  emitDrafts();
  if (remoteOn()) supabase.from('drafts').delete().eq('slot', slotOf(id)).then(() => {});
};

// Supabase와 맞춤: 같은 글은 나중에 저장한 쪽을 남기고, 한쪽에만 있으면
// - Supabase에만 있음 → 브라우저로 가져옴
// - 브라우저에만 있고 올린 적 없음(로그인 전에 씀 등) → 올림
// - 브라우저에만 있고 올린 뒤 그대로임 → 다른 기기에서 지운 것이니 여기서도 지움
let syncing = null;
export function syncDrafts() {
  if (!remoteOn()) return Promise.resolve();
  syncing ??= (async () => {
    const { data, error } = await supabase.from('drafts').select('slot, value, saved_at');
    if (error) return;
    const remote = new Map(data.map((row) => [row.slot, row]));
    const local = new Map();
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key !== DRAFT_KEY && !key?.startsWith(`${DRAFT_KEY}:`)) continue;
        const value = read(key, null);
        if (value && typeof value === 'object') local.set(slotOf(key === DRAFT_KEY ? null : key.slice(DRAFT_KEY.length + 1)), value);
      }
    } catch {
      // 저장소를 못 쓰면 Supabase 것만 가져옴
    }
    const uploads = [];
    for (const [slot, value] of local) {
      const row = remote.get(slot);
      const at = value.savedAt ?? '';
      if (!row) {
        // 올린 뒤로 고친 적이 없을 때만 지움 (고쳤으면 다시 올림)
        if (value.syncedAt && value.syncedAt === value.savedAt) {
          try {
            localStorage.removeItem(draftKey(idOf(slot)));
          } catch {
            // 못 지우면 다음에 다시
          }
        } else uploads.push({ slot, value: withoutTime(value), saved_at: at || new Date().toISOString() });
      } else if (new Date(at) > new Date(row.saved_at)) {
        uploads.push({ slot, value: withoutTime(value), saved_at: at });
      }
    }
    for (const [slot, row] of remote) {
      const mine = local.get(slot);
      if (mine && new Date(mine.savedAt ?? 0) >= new Date(row.saved_at)) continue;
      const savedAt = new Date(row.saved_at).toISOString();
      write(draftKey(idOf(slot)), { ...emptyDraft, ...row.value, savedAt, syncedAt: savedAt });
    }
    // 다른 기기에서 가져온 글의 사진을 받아 오고, 이 브라우저에서 쓴 글의 사진은 올림
    const markdownOf = (slot) => read(draftKey(idOf(slot)), null)?.markdown ?? '';
    await fetchImages([...remote.keys()].flatMap((slot) => imagesIn(markdownOf(slot))));
    await uploadImages(uploads.flatMap((row) => imagesIn(row.value.markdown ?? '')));
    if (uploads.length) {
      const { error: upError } = await supabase.from('drafts').upsert(uploads, { onConflict: 'user_id,slot' });
      if (!upError) {
        for (const { slot, saved_at: at } of uploads) {
          const now = read(draftKey(idOf(slot)), null);
          if (now?.savedAt === at) write(draftKey(idOf(slot)), { ...now, syncedAt: at });
        }
      }
    }
    emitDrafts();
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

// 로그인하면 바로 맞추고, 다른 기기에서 쓰다 돌아왔을 때(창을 다시 볼 때)도 맞춤
if (supabase) {
  onSessionChange(() => {
    if (getSession()) syncDrafts();
  });
  window.addEventListener('focus', () => syncDrafts());
}

// 임시저장한 글 전부 (보관함 목록). id: 수정 중인 글의 id, 새 글은 null. 최근에 저장한 것이 위
// 내용이 하나도 없는 임시저장은 뺌
export const subscribeDrafts = (fn) => {
  draftListeners.add(fn);
  const onStorage = (e) => (e.key === null || e.key?.startsWith(DRAFT_KEY)) && fn(); // 다른 탭에서 저장·삭제
  window.addEventListener('storage', onStorage);
  syncDrafts(); // 보관함을 열 때 다른 기기에서 저장한 것도 가져옴
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
      const { syncedAt: _syncedAt, ...draft } = { ...emptyDraft, ...value };
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
