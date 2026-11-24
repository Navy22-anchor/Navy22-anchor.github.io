import { GlobeIcon, kindIcon, referenceText } from './ReferenceIcons.jsx';
import styles from './Reference.module.css';

// 글 맨 아래 참고문헌: [종류 아이콘] [저자, 제목, 연도, 페이지.] [지구본 링크]
// onCite(번호): 글쓰기 미리보기에서만. 아이콘이 버튼이 되어, 본문에서 드래그한 문장에 이 번호로 밑줄을 그음
export default function ReferenceList({ references, className = '', onCite }) {
  const rows = references.filter((ref) => referenceText(ref).trim());
  if (!rows.length) return null;
  return (
    <ol className={`${styles.list} ${className}`} aria-label="참고문헌">
      {rows.map((ref, i) => {
        const Icon = kindIcon(ref.kind);
        return (
          <li key={i} className={styles.row}>
            {onCite ? (
              <button
                type="button"
                className={`${styles.tile} ${styles.tileButton}`}
                title={`본문에서 드래그한 문장에 밑줄 ${i + 1}`}
                aria-label={`드래그한 문장에 참고문헌 ${i + 1} 밑줄 긋기`}
                onMouseDown={(e) => e.preventDefault()} // 본문 선택을 잃지 않게
                onClick={() => onCite(i + 1)}
              >
                <Icon />
              </button>
            ) : (
              <span className={styles.tile}>
                <Icon />
              </span>
            )}
            <p className={styles.bar}>{referenceText(ref)}</p>
            {ref.url && (
              <a className={`${styles.tile} ${styles.link}`} href={ref.url} target="_blank" rel="noreferrer" aria-label="원문 열기">
                <GlobeIcon />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
