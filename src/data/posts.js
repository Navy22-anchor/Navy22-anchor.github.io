import { loadLocalPosts } from './localPosts.js';
import { repoPosts } from './repoPosts.js';

export { repoPosts };

// 글 데이터. body는 위에서부터 순서대로 그려지는 블록 목록입니다.
// type: 'p' 문단 | 'h2' 소제목 | 'image' 사진(src 없으면 회색 자리) | 'faq' 자주 묻는 질문
export const posts = [
  {
    id: '1',
    title: '글 제목',
    author: '작성자 이름',
    date: '2026.11.08 16:11',
    body: [
      { type: 'p', text: '여기에 블로그 소개 첫 문단이 들어갑니다. 블로그의 주제와 운영 목적, 주로 다루는 이야기를 간단히 적는 자리입니다.' },
      { type: 'h2', text: '링크 섹션' },
      { type: 'p', text: '이 블로그는 여러 주제의 글을 한곳에 모아 두는 공간입니다. 연결된 사이트나 관련 링크를 소개하는 문단을 여기에 적습니다.' },
      { type: 'h2', text: '프로젝트' },
      { type: 'p', text: '진행 중인 프로젝트와 연재 글을 소개하는 문단입니다. 글의 길이에 따라 줄 수가 자연스럽게 바뀝니다.' },
      { type: 'image', src: null, alt: '', caption: '사진 캡션을 여기에 입력합니다. 사진의 출처나 설명을 적는 자리입니다.' },
    ],
    faq: [
      { q: '질문 예시 1', a: '답변 예시 1입니다. 실제 내용으로 바꿔 주세요.' },
      { q: '질문 예시 2', a: '답변 예시 2입니다. 실제 내용으로 바꿔 주세요.' },
      { q: '질문 예시 3', a: '답변 예시 3입니다. 실제 내용으로 바꿔 주세요.' },
    ],
    references: [
      { kind: 'paper', text: '저자, 논문 또는 책 제목, 연도, 페이지.', url: 'https://example.com' },
      { kind: 'blog', text: '저자, 블로그 글 제목, 날짜, 사이트 이름.', url: 'https://example.com' },
    ],
  },
];

// 이 브라우저에서 방금 발행·수정한 글 → 저장소 글(content/posts/*.md) → 예시 글 순서로 찾음
export function findPost(id) {
  const byId = (post) => post.id === id;
  return loadLocalPosts().find(byId) ?? repoPosts.find(byId) ?? posts.find(byId) ?? repoPosts[0] ?? posts[0];
}

// 저장소에 올라간 글인지 (삭제할 때 GitHub에서도 지워야 함)
export const isRepoPost = (id) => repoPosts.some((post) => post.id === id);

// 예시 글(블록 목록)을 수정 화면에 띄울 수 있게 마크다운으로
export function toMarkdown(post) {
  if (post.markdown !== undefined) return post.markdown;
  return (post.body ?? [])
    .map((block) => {
      if (block.type === 'h2') return `## ${block.text}`;
      if (block.type === 'image') return `![${block.caption ?? ''}](${block.src ?? ''})`;
      return block.text;
    })
    .join('\n\n');
}
