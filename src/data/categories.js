import { categories as baseCategories } from './projects.js';

// 랜딩의 "+"로 추가한 카테고리는 이 브라우저(localStorage)에만 저장됩니다.
// 모두에게 보이게 하려면 projects.js 의 categories 에 직접 넣어 주세요.
const KEY = 'hanlog:categories';
const HIDDEN_KEY = 'hanlog:hidden-categories'; // "−"로 지운 기본 카테고리 (이 브라우저에서만 숨김)

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 반영
  }
}

const loadCustom = () => readList(KEY);

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

export function loadCategories() {
  const hidden = readList(HIDDEN_KEY);
  const all = baseCategories.filter((c) => !hidden.some((h) => same(h, c)));
  for (const c of loadCustom()) if (!all.some((x) => same(x, c))) all.push(c);
  return all;
}

// 추가한 이름(이미 있으면 기존 이름)을 돌려줌. 빈 이름이면 null
export function addCategory(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = loadCategories().find((c) => same(c, clean));
  if (existing) return existing;
  // 숨겼던 기본 카테고리면 다시 보이게, 아니면 새로 추가
  const base = baseCategories.find((c) => same(c, clean));
  if (base) {
    writeList(HIDDEN_KEY, readList(HIDDEN_KEY).filter((h) => !same(h, base)));
    return base;
  }
  writeList(KEY, [...loadCustom(), clean]);
  return clean;
}

// "−" 삭제: 추가한 카테고리는 지우고, 기본 카테고리는 이 브라우저에서 숨김
export function removeCategory(name) {
  if (baseCategories.some((c) => same(c, name))) {
    writeList(HIDDEN_KEY, [...readList(HIDDEN_KEY), name]);
  } else {
    writeList(KEY, loadCustom().filter((c) => !same(c, name)));
  }
}
