import styles from './ReferenceCard.module.css';

export default function ReferenceCard({ title, author, year, url, about }) {
  return (
    <article className={styles.card}>
      <h3 className={styles.header}>{title}</h3>
      <dl className={styles.body}>
        <div className={styles.row}>
          <dt className={styles.label}>Author</dt>
          <dd className={styles.value}>{author}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>Year</dt>
          <dd className={styles.value}>{year}</dd>
        </div>
        {url && (
          <dd className={styles.value}>
            <a href={url} target="_blank" rel="noreferrer" className={styles.link}>
              Visit 출처 링크 ↗
            </a>
          </dd>
        )}
        <dt className={styles.label}>About</dt>
        <dd className={`${styles.value} ${styles.about}`}>{about}</dd>
      </dl>
    </article>
  );
}
