import bookLeft from '../assets/book-left.jpg';
import bookCenter from '../assets/work-book.jpg';
import bookRight from '../assets/book-right.jpg';
import workNight from '../assets/work-night.jpg';
import workWhisky from '../assets/work-whisky.jpg';
import { loadDeletedIds, loadLocalPosts } from './localPosts.js';
import { excerptOf, repoPosts } from './repoPosts.js';

// 세로로 쌓이는 줄(작업). 줄마다 가로로 넘기는 콘텐츠(items)가 있고,
// 중괄호 사이에 들어온 줄만 양옆 콘텐츠가 조금 작게 펼쳐집니다.
// kind: 'posts' → 가로형 글 카드 / 'images' → 사진·책 표지 (w·h는 Figma 크기)

// AI 줄에는 category가 AI인 글이 최신순으로 들어갑니다.
// 저장소의 글(content/posts/*.md)에, 이 브라우저에서 발행·수정했지만 아직 다시 빌드되지 않은 글을 덮어씀
function loadPosts(category) {
  const deleted = new Set(loadDeletedIds());
  const local = loadLocalPosts()
    .filter((post) => !deleted.has(post.id))
    .map((post) => ({
      ...post,
      excerpt: excerptOf(post.markdown ?? ''),
      thumbnail: /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(post.markdown ?? '')?.[1] ?? null,
    }));
  const localIds = new Set(local.map((post) => post.id));
  return [...repoPosts.filter((post) => !localIds.has(post.id) && !deleted.has(post.id)), ...local]
    .filter((post) => post.category === category)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(({ id, title, date, excerpt, thumbnail }) => ({ id, title, date: date.slice(0, 10), excerpt, thumbnail }));
}

const buildRows = () => [
  {
    id: 'cooking',
    category: 'Cooking',
    kind: 'images',
    items: [{ id: 'whisky', src: workWhisky, w: 426, h: 516, label: '위스키, 2026.03.21' }],
  },
  {
    id: 'library',
    category: 'Library',
    kind: 'images',
    items: [
      { id: 'book-1', src: bookLeft, w: 279, h: 349, label: '책 제목, 저자, 읽은 날짜' },
      { id: 'book-2', src: bookCenter, w: 279, h: 366, label: 'Programming: Principles and Practice Using C++, Bjarne Stroustrup, 읽은 날짜' },
      { id: 'book-3', src: bookRight, w: 279, h: 358, label: '책 제목, 저자, 읽은 날짜' },
    ],
  },
  {
    id: 'ai',
    category: 'AI',
    kind: 'posts',
    items: loadPosts('AI'),
  },
  {
    id: 'photo',
    category: 'Photo',
    kind: 'images',
    items: [{ id: 'night', src: workNight, w: 260, h: 390, label: '밤 사진, 2025.05.16' }],
  },
];

// 랜딩을 열 때마다 새로 만듦 (방금 발행한 글이 바로 보이게).
// 콘텐츠가 하나도 없는 줄(예: 아직 글이 없는 AI 줄)은 숨기고, 처음엔 AI 줄을 중괄호 사이에 둠
export function loadRows() {
  const rows = buildRows().filter((row) => row.items.length > 0);
  return { rows, initialRow: Math.max(0, rows.findIndex((row) => row.id === 'ai')) };
}

export const categories = ['AI', 'Daily', 'Cooking', 'Photo', 'Library', 'Side Project'];
