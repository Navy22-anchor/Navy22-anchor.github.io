import bookLeft from '../assets/book-left.jpg';
import bookCenter from '../assets/work-book.jpg';
import bookRight from '../assets/book-right.jpg';
import workNight from '../assets/work-night.jpg';
import workWhisky from '../assets/work-whisky.jpg';
import { repoPosts } from './repoPosts.js';

// 세로로 쌓이는 줄(작업). 줄마다 가로로 넘기는 콘텐츠(items)가 있고,
// 중괄호 사이에 들어온 줄만 양옆 콘텐츠가 조금 작게 펼쳐집니다.
// kind: 'posts' → 가로형 글 카드 / 'images' → 사진·책 표지 (w·h는 Figma 크기)

// AI 줄에는 저장소의 글(content/posts/*.md) 중 category가 AI인 글이 최신순으로 들어갑니다.
const posts = repoPosts
  .filter((post) => post.category === 'AI')
  .map(({ id, title, date, excerpt, thumbnail }) => ({ id, title, date: date.slice(0, 10), excerpt, thumbnail }));

const allRows = [
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
    items: posts,
  },
  {
    id: 'photo',
    category: 'Photo',
    kind: 'images',
    items: [{ id: 'night', src: workNight, w: 260, h: 390, label: '밤 사진, 2025.05.16' }],
  },
];

// 콘텐츠가 하나도 없는 줄(예: 아직 글이 없는 AI 줄)은 숨김
export const rows = allRows.filter((row) => row.items.length > 0);

// 처음 중괄호 사이에 놓일 줄
export const initialRow = Math.max(0, rows.findIndex((row) => row.id === 'ai'));

export const categories = ['AI', 'Daily', 'Cooking', 'Photo', 'Library', 'Side Project'];
