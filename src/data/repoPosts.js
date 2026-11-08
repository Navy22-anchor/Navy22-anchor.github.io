import { parseFrontMatter } from './frontMatter.js';

// 저장소의 content/posts/*.md 를 빌드할 때 읽어 들입니다. 파일 이름이 글 주소(id)가 됩니다.
// 새 글은 이 폴더에 .md 파일을 넣고 main에 push하면 GitHub Actions가 다시 빌드해 게시합니다.
const files = import.meta.glob('/content/posts/*.md', { query: '?raw', import: 'default', eager: true });

// 미리보기용: 마크다운 기호를 걷어 낸 본문 앞부분
export function excerptOf(markdown, length = 160) {
  const text = markdown
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

// 본문의 첫 사진을 썸네일로
const firstImage = (markdown) => /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(markdown)?.[1] ?? null;

export const repoPosts = Object.entries(files)
  .map(([path, text]) => {
    const { data, body } = parseFrontMatter(text);
    const id = path.split('/').pop().replace(/\.md$/, '');
    return {
      id,
      title: data.title || id,
      author: data.author || '',
      date: data.date || '',
      category: data.category || 'AI',
      references: Array.isArray(data.references) ? data.references : [],
      markdown: body.trim(),
      excerpt: data.excerpt || excerptOf(body),
      thumbnail: data.thumbnail || firstImage(body),
    };
  })
  // 최신 글이 먼저 (날짜 형식 2026.11.08 16:11 은 문자열 비교로 정렬됨)
  .sort((a, b) => b.date.localeCompare(a.date));
