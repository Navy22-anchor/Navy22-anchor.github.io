import { loadLocalPosts } from './localPosts.js';

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
      {
        title: '참고문헌 제목 (저자, 연도)',
        author: '작성자 이름',
        year: '2026',
        url: 'https://example.com',
        about: '참고문헌 설명 또는 메모를 여기에 적습니다. 글에서 인용한 내용과 출처를 간단히 정리하는 자리입니다.',
      },
      {
        title: '참고문헌 제목 (저자, 연도)',
        author: '작성자 이름',
        year: '2026',
        url: 'https://example.com',
        about: '참고문헌 설명 또는 메모를 여기에 적습니다. 글에서 인용한 내용과 출처를 간단히 정리하는 자리입니다.',
      },
    ],
  },
];

// 글 작성 페이지에서 발행한 글(이 브라우저에만 저장)도 함께 찾음
export function findPost(id) {
  return loadLocalPosts().find((post) => post.id === id) ?? posts.find((post) => post.id === id) ?? posts[0];
}
