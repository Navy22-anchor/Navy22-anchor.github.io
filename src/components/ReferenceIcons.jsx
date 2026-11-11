import { NEWS_PATH } from './newsIconPath.js';

// 참고문헌 아이콘 (Figma 204:2392). 색은 글자색(currentColor)을 따라가서 다크 모드에서도 보임
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };

// 두루마리와 깃펜: 논문·책
export function ScrollIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...stroke}>
        <path d="M18 8V4.5C18 3.67 17.33 3 16.5 3H4.5C3.67 3 3 3.67 3 4.5C3 5.33 3.67 6 4.5 6H6" />
        <path d="M6 4.5V8C6 10.5 7.5 11 7.5 13.5C7.5 16.5 5 17.5 4.5 20.5H16C16.83 20.5 17.5 19.83 17.5 19V17.5" />
        {/* 깃은 타일 색으로 채워 두루마리 선을 가림 */}
        <path d="M21.5 7C16.9 7.3 13.2 11 13.3 15.2C17.5 15.3 21.2 11.6 21.5 7Z" fill="var(--ref-tile, #fff)" />
        <path d="M16.3 10.4L18 12.1" />
        <path d="M14.8 12.4L16.3 13.9" />
        <path d="M16.8 11.7L10 18.5" />
      </g>
    </svg>
  );
}

// 굵은 b: 블로그·뉴스레터
export function BlogIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M0 15.7285V31.457H3.54191H7.08382V31.1834C7.08382 30.9988 7.11677 30.9099 7.19914 30.9099C7.2568 30.9099 7.35564 30.862 7.4133 30.8073C7.57804 30.6432 7.99813 30.4996 8.31937 30.4996C8.49235 30.4996 8.98657 30.5748 9.42313 30.6705C9.85969 30.7663 10.2917 30.9099 10.407 30.9099C10.5141 30.9099 10.9047 30.9948 10.6669 30.9099C10.4291 30.8249 11.2929 31.1903 11.8201 31.2655C12.0919 31.3065 12.3884 31.3749 12.4791 31.4228C12.5697 31.4706 12.8497 31.5253 13.0968 31.5459C13.3439 31.5664 13.8135 31.6279 14.1429 31.6895C15.848 32.004 18.5744 32.0929 20.5843 31.8946C25.337 31.4364 28.9778 29.3781 30.6828 26.1913C31.7125 24.2697 32.1408 22.143 31.9596 19.7905C31.5889 14.8463 29.0601 11.6117 24.6286 10.4355C23.4096 10.1073 22.4129 9.97733 20.8149 9.93629C17.0094 9.82688 13.3934 10.7364 10.4775 12.5281C9.56316 13.082 8.12168 14.2582 7.57804 14.8942C7.24032 15.284 7.19914 15.3113 7.14972 15.1677C7.12501 15.0788 7.1003 11.6322 7.09206 7.5018L7.08382 0H3.54191H0V15.7285ZM21.2679 12.4392C23.1377 12.8495 24.3815 13.5538 25.3617 14.7711C26.5149 16.2003 26.9927 17.9852 26.9103 20.5838C26.8609 22.1703 26.7455 22.8268 26.309 23.921C25.1888 26.7111 22.7177 28.6532 19.4228 29.3165C18.9451 29.4123 18.4838 29.4396 17.133 29.4328C15.5432 29.4328 15.4032 29.4191 14.7195 29.2481C12.6767 28.7284 11.4082 27.8394 10.5022 26.2939C10.0244 25.4801 9.7279 24.6595 9.49726 23.5243C9.30781 22.5464 9.30781 20.194 9.49726 19.3118C9.94206 17.3013 10.7246 15.8789 12.1166 14.5386C12.4791 14.1898 13.4922 13.5538 14.2006 13.2324C15.2137 12.7743 16.1692 12.5076 17.4213 12.3366C18.385 12.1998 20.4442 12.2545 21.2679 12.4392Z"
      />
    </svg>
  );
}

// 뉴스의 N: 신문·뉴스 기사
export function NewsIcon(props) {
  return (
    <svg width="13" height="18" viewBox="0 0 19 26" aria-hidden="true" {...props}>
      <path fill="currentColor" d={NEWS_PATH} />
    </svg>
  );
}

// 지구본: 원문 링크
export function GlobeIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...stroke}>
        <path d="M12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3Z" />
        <path d="M12 3C14.21 3 16 7.03 16 12C16 16.97 14.21 21 12 21C9.79 21 8 16.97 8 12C8 7.03 9.79 3 12 3Z" />
        <path d="M3 12H21" />
        <path d="M4.5 7.5H19.5" />
        <path d="M4.5 16.5H19.5" />
      </g>
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" {...props}>
      <path d="M6 1V11M1 6H11" {...stroke} />
    </svg>
  );
}

// 입력창 접기(–)·닫기(×) (Figma 214:2452)
export function MinimizeIcon(props) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" {...props}>
      <path d="M0.7 5H9.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" {...props}>
      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export const REFERENCE_KINDS = [
  { id: 'paper', label: '논문·책', Icon: ScrollIcon },
  { id: 'blog', label: '블로그·글', Icon: BlogIcon },
  { id: 'news', label: '뉴스', Icon: NewsIcon },
];

export const kindIcon = (kind) => (REFERENCE_KINDS.find((k) => k.id === kind) ?? REFERENCE_KINDS[0]).Icon;

// 예전 형식(title·author·year)도 한 줄 인용으로
export const referenceText = (ref) => ref.text || [ref.author, ref.title, ref.year].filter(Boolean).join(', ');
