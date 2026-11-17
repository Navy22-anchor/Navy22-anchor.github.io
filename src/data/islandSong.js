import { useSyncExternalStore } from 'react';
import { canEdit, supabase } from './supabase.js';

// 음악 아일랜드의 기본 곡 { id, title, artist, explicit, country }
// 주인이 검색 결과를 재생하면 그 곡이 기본 곡이 되어, 다음부터 모든 방문자에게 처음 올라가 있음
// Supabase를 쓰면 site_settings 표(key 'island_song')에 저장 (읽기는 누구나, 바꾸기는 주인만)
// Supabase가 없으면 이 브라우저에만 저장
// country: 곡 ID로 미리듣기 주소를 다시 받을 iTunes 스토어 (검색은 미국 스토어에서 함)
export const FALLBACK_SONG = {
  id: 1508562516, // Glass Animals - Heat Waves (Dreamland)
  title: 'Heat Waves',
  artist: 'Glass Animals',
  explicit: false,
  country: 'KR',
};

const KEY = 'hanlog:island-song'; // Supabase가 없을 때 저장소, 있을 때는 다음 방문 첫 화면용
const SETTING = 'island_song';

const valid = (song) => song && Number.isFinite(Number(song.id)) && typeof song.title === 'string';

function read() {
  try {
    const song = JSON.parse(localStorage.getItem(KEY));
    return valid(song) ? song : FALLBACK_SONG;
  } catch {
    return FALLBACK_SONG;
  }
}

let song = read();
const listeners = new Set();

function set(next) {
  if (!valid(next) || next.id === song.id) return;
  song = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만
  }
  listeners.forEach((fn) => fn());
}

async function refresh() {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', SETTING).maybeSingle();
  if (!error && data) set(data.value);
}

let syncing = false;
const subscribe = (fn) => {
  listeners.add(fn);
  if (supabase && !syncing) {
    syncing = true;
    refresh();
  }
  return () => listeners.delete(fn);
};

export const useIslandSong = () => useSyncExternalStore(subscribe, () => song);

// 기본 곡으로 저장 (주인만. 방문자가 재생한 곡은 그 자리에서만 들림)
export async function saveIslandSong({ id, title, artist, explicit = false }) {
  if (!canEdit()) return;
  const next = { id, title, artist, explicit, country: 'US' };
  set(next);
  if (!supabase) return;
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: SETTING, value: next, updated_at: new Date().toISOString() });
  if (error) throw error;
}
