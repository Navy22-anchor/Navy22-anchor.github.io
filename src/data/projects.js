import bookLeft from '../assets/book-left.jpg';
import bookCenter from '../assets/work-book.jpg';
import bookRight from '../assets/book-right.jpg';
import workNight from '../assets/work-night.jpg';
import workWhisky from '../assets/work-whisky.jpg';

// 세로로 쌓이는 줄(작업). 줄마다 가로로 넘기는 콘텐츠(items)가 있고,
// 중괄호 사이에 들어온 줄만 양옆 콘텐츠가 조금 작게 펼쳐집니다.
// kind: 'posts' → 가로형 글 카드 / 'images' → 사진·책 표지 (w·h는 Figma 크기)
const excerpt =
  '본문의 첫 부분이 미리보기로 들어갑니다. 글의 주제와 내용을 짧게 보여 주는 자리이며, 세 줄을 넘으면 말줄임표로 잘립니다. 실제 글 내용으로 바꿔 주세요.';

const posts = Array.from({ length: 5 }, (_, i) => ({
  id: `ai-${i + 1}`,
  title: `글 제목 ${i + 1}이 여기에 들어갑니다. 길면 두 줄까지 보여요`,
  date: `2026.11.${String(8 - i).padStart(2, '0')}`,
  excerpt,
  thumbnail: null,
}));

export const rows = [
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

// 처음 중괄호 사이에 놓일 줄
export const initialRow = rows.findIndex((row) => row.id === 'ai');

export const categories = ['AI', 'Daily', 'Cooking', 'Photo', 'Library', 'Side Project'];
