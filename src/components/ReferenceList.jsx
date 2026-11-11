import { GlobeIcon, kindIcon, referenceText } from './ReferenceIcons.jsx';
import styles from './Reference.module.css';

// 글 맨 아래 참고문헌: [종류 아이콘] [저자, 제목, 연도, 페이지.] [지구본 링크]
export default function ReferenceList({ references, className = '' }) {
  const rows = references.filter((ref) => referenceText(ref).trim());
  if (!rows.length) return null;
  return (
    <ol className={`${styles.list} ${className}`} aria-label="참고문헌">
      {rows.map((ref, i) => {
        const Icon = kindIcon(ref.kind);
        return (
          <li key={i} className={styles.row}>
            <span className={styles.tile}>
              <Icon />
            </span>
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
