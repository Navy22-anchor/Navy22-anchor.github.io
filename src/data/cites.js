// 본문 인용 표시: <cite ref="2">문장</cite>
// 글에서는 문장 아래 점선 밑줄 + 끝에 위첨자 숫자 동그라미(참고문헌 번호)로 보임
// 글쓰기 화면에서 문장을 드래그하고 미리보기 참고문헌의 아이콘을 누르면 들어감
const CITE = /<cite ref="(\d+)">([\s\S]*?)<\/cite>/g;

// 글 안의 인용 표시 (순서대로). start~end: 태그까지 포함한 자리, textStart~textEnd: 안의 문장
export function citesIn(source) {
  return [...source.matchAll(CITE)].map((m) => {
    const open = m[0].indexOf('>') + 1;
    return {
      start: m.index,
      end: m.index + m[0].length,
      textStart: m.index + open,
      textEnd: m.index + open + m[2].length,
      ref: Number(m[1]),
    };
  });
}

// 선택한 범위를 인용으로 감쌈. 실패하면 { error }
function wrap(source, start, end, ref) {
  let s = Math.min(start, end);
  let e = Math.max(start, end);
  while (s < e && /\s/.test(source[s])) s += 1; // 앞뒤 빈칸·줄바꿈은 뺌
  while (e > s && /\s/.test(source[e - 1])) e -= 1;
  const text = source.slice(s, e);
  if (!text) return { error: '밑줄 칠 문장을 먼저 드래그하세요' };
  if (/\n\s*\n/.test(text)) return { error: '한 문단 안에서만 밑줄을 칠 수 있어요' };
  if (citesIn(source).some((c) => s < c.end && e > c.start)) return { error: '이미 밑줄 친 곳과 겹쳐요' };
  if (text.includes('$$') || (text.replace(/\\\$/g, '').match(/\$/g) ?? []).length % 2)
    return { error: '수식 중간에서 끊을 수 없어요' };
  const value = `${source.slice(0, s)}<cite ref="${ref}">${text}</cite>${source.slice(e)}`;
  // 새 인용이 글에서 몇 번째인지
  const index = citesIn(value).findIndex((c) => c.start === s);
  return { value, index };
}

export const addCite = (source, start, end, ref) => wrap(source, start, end, ref);

// 인용 표시를 지움 (문장은 남김)
export function removeCite(source, index) {
  const c = citesIn(source)[index];
  if (!c) return source;
  return source.slice(0, c.start) + source.slice(c.textStart, c.textEnd) + source.slice(c.end);
}

// 번호(참고문헌)만 바꿈
export function setCiteRef(source, index, ref) {
  const c = citesIn(source)[index];
  if (!c) return source;
  return `${source.slice(0, c.start)}<cite ref="${ref}">${source.slice(c.textStart)}`;
}

// 밑줄 범위를 새로 고른 범위로 옮김. start·end는 지금 글(태그 포함) 기준 자리
export function moveCite(source, index, start, end) {
  const c = citesIn(source)[index];
  if (!c) return { error: '밑줄을 찾지 못했어요' };
  const openLen = c.textStart - c.start;
  const closeLen = c.end - c.textEnd;
  // 태그를 뺀 글에서의 자리로 바꿈
  const map = (p) => {
    if (p <= c.start) return p;
    if (p < c.textStart) return c.start;
    if (p <= c.textEnd) return p - openLen;
    if (p < c.end) return c.textEnd - openLen;
    return p - openLen - closeLen;
  };
  const plain = removeCite(source, index);
  return wrap(plain, map(start), map(end), c.ref);
}
