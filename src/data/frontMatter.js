// 글 파일(content/posts/*.md) 맨 위의 front matter를 읽고 씁니다.
// 쓸 때는 값을 모두 큰따옴표 문자열로 적어서(YAML과 호환), 읽을 때 그대로 되돌립니다.
//
// ---
// title: "글 제목"
// author: "작성자"
// date: "2026.11.08 16:11"
// category: "AI"
// references:
//   - title: "참고문헌 제목"
//     url: "https://example.com"
// ---

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---[^\S\n]*(?:\r?\n|$)/;

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

export function parseFrontMatter(text) {
  const m = FENCE.exec(text);
  if (!m) return { data: {}, body: text };

  const data = {};
  let list = null; // 지금 채우는 목록 (예: references)
  let item = null; // 목록의 지금 항목

  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const top = /^([\w-]+):(.*)$/.exec(line);
    if (top) {
      const [, key, rest] = top;
      if (rest.trim()) {
        data[key] = parseValue(rest);
        list = null;
      } else {
        list = data[key] = [];
      }
      item = null;
      continue;
    }
    const entry = /^\s+-\s*(?:([\w-]+):(.*))?$/.exec(line);
    if (list && entry) {
      item = {};
      list.push(item);
      if (entry[1]) item[entry[1]] = parseValue(entry[2]);
      continue;
    }
    const field = /^\s+([\w-]+):(.*)$/.exec(line);
    if (item && field) item[field[1]] = parseValue(field[2]);
  }

  return { data, body: text.slice(m[0].length) };
}

const quote = (value) => JSON.stringify(String(value ?? ''));

export function stringifyPost({ title, author, date, category, references = [], markdown = '' }) {
  const lines = ['---', `title: ${quote(title)}`, `author: ${quote(author)}`, `date: ${quote(date)}`];
  if (category) lines.push(`category: ${quote(category)}`);
  if (references.length) {
    lines.push('references:');
    for (const ref of references) {
      const keys = ['kind', 'text', 'title', 'author', 'year', 'url', 'about'].filter((key) => ref[key]);
      keys.forEach((key, i) => lines.push(`${i === 0 ? '  - ' : '    '}${key}: ${quote(ref[key])}`));
    }
  }
  lines.push('---', '');
  return `${lines.join('\n')}\n${markdown.trim()}\n`;
}
