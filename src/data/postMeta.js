import { parseFrontMatter } from './frontMatter.js';

// 글 파일(.md) → 목록에 필요한 정보. 브라우저와 빌드(vite.config.js의 글 목록 플러그인) 둘 다 씀

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
export const firstImage = (markdown) => /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(markdown)?.[1] ?? null;

// 본문(markdown)은 빼고 목록·글 머리에 쓰는 정보만
export function postMeta(id, text) {
  const { data, body } = parseFrontMatter(text);
  return {
    id,
    title: data.title || id,
    author: data.author || '',
    date: data.date || '',
    category: data.category || 'AI',
    references: Array.isArray(data.references) ? data.references : [],
    excerpt: data.excerpt || excerptOf(body),
    thumbnail: data.thumbnail || firstImage(body),
  };
}

export const postBody = (text) => parseFrontMatter(text).body.trim();
