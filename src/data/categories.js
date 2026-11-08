import { categories as baseCategories } from './projects.js';

// 랜딩의 "+"로 추가한 카테고리는 이 브라우저(localStorage)에만 저장됩니다.
// 모두에게 보이게 하려면 projects.js 의 categories 에 직접 넣어 주세요.
const KEY = 'hanlog:categories';

function loadCustom() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

export function loadCategories() {
  const all = [...baseCategories];
  for (const c of loadCustom()) if (!all.some((x) => same(x, c))) all.push(c);
  return all;
}

// 추가한 이름(이미 있으면 기존 이름)을 돌려줌. 빈 이름이면 null
export function addCategory(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = loadCategories().find((c) => same(c, clean));
  if (existing) return existing;
  try {
    localStorage.setItem(KEY, JSON.stringify([...loadCustom(), clean]));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 보임
  }
  return clean;
}
