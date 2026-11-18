// 붙여 넣은 목차 글 → 목차 화면용 목록 (Figma "Library book page – TOC" 327:3052)
// 번호(1장, 1.1, 부록 A …)는 빼고 단계만 남김: 장(chapter) › 절(level 1) › 항(level 2)
//   "1장 LLM 이해하기"          → 장
//   "1.1 LLM이란 무엇인가요?"    → 절
//   "1.1.1 …", "__A.1.1 …", 들여쓴 줄 → 항
//   "부록 A 파이토치 소개"        → "부록" 묶음 이름 + 장
//   "[워크북 목차]"              → "워크북" 묶음 이름
// 그 밖의 줄은 장 안이면 절, 아니면 장
//
// 결과: [{ type: 'group', title } | { type: 'chapter', title, value, sections: [{ title, level, value }] }]
// value: 목차 자리 경로 "장 › 절 › 항"
// 목차 자리 이름: "장 › 절 › 항" (구절의 section 칸에 저장되는 값)
export const SEP = ' › ';

// 구절에 붙일 수 있는 목차 자리 목록: [{ value: "장 › 절 › 항", label, level }]
// level 0 장, 1 절, 2 항. 목차 고르기 칸(select)에 씀
export function tocOptions(items) {
  const options = [];
  for (const item of items) {
    if (item.type !== 'chapter') continue;
    options.push({ value: item.value, label: item.title, level: 0 });
    for (const section of item.sections)
      options.push({ value: section.value, label: section.title, level: section.level });
  }
  return options;
}

// 그 구절이 이 목차 자리(또는 그 아래)에 속하나
export const inSection = (section = '', value) => section === value || section.startsWith(value + SEP);

// 구절이 하나라도 있는 목차 자리들 (장, 절, 항 모두). 목차에서 눌러 갈 수 있는 곳 표시에 씀
export function sectionsWithQuotes(quotes) {
  const set = new Set();
  for (const q of quotes) {
    const parts = (q.section ?? '').split(SEP).filter(Boolean);
    parts.forEach((_, i) => set.add(parts.slice(0, i + 1).join(SEP)));
  }
  return set;
}

export function parseToc(text = '') {
  const items = [];
  let chapter = null;
  let group = null;

  const addGroup = (title) => {
    items.push({ type: 'group', title });
    group = title;
    chapter = null;
  };
  let parent = null; // 항이 붙을 절의 경로
  const addChapter = (title) => {
    chapter = { type: 'chapter', title, value: title, sections: [] };
    parent = title;
    items.push(chapter);
  };
  const addSection = (title, level) => {
    const value = (level === 2 ? parent : chapter.value) + SEP + title;
    if (level === 1) parent = value;
    chapter.sections.push({ title, level, value });
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const indented = /^(\s{2,}|\t)/.test(raw) || line.startsWith('__');
    const body = line.replace(/^_+/, '');
    let m;
    if ((m = /^\[(.+)\]$/.exec(body))) {
      addGroup(m[1].replace(/\s*목차$/, '').trim());
    } else if ((m = /^\d+\s*장\.?\s+(.+)$/.exec(body))) {
      addChapter(m[1]);
    } else if ((m = /^부록\s*[A-Z]\.?\s+(.+)$/.exec(body))) {
      if (group !== '부록') addGroup('부록');
      addChapter(m[1]);
    } else if ((m = /^[A-Z0-9]+((?:\.\d+)+)\.?\s+(.+)$/.exec(body))) {
      const depth = m[1].split('.').length - 1; // 1.1 → 1, 1.1.1 → 2
      if (!chapter) addChapter(m[2]);
      else addSection(m[2], depth >= 2 || indented ? 2 : 1);
    } else if (chapter) {
      addSection(body, indented ? 2 : 1);
    } else {
      addChapter(body);
    }
  }
  return items;
}
