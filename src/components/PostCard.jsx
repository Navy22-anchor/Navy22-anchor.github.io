import styles from './PostCard.module.css';

// Figma "Post card" 컴포넌트. layout: 'vertical'(320) | 'horizontal'(640)
export default function PostCard({ date, title, excerpt, thumbnail, showThumbnail = true, layout = 'vertical', className = '' }) {
  return (
    <article className={`${styles.card} ${styles[layout]} ${className}`}>
      {showThumbnail && (
        <div
          className={styles.thumbnail}
          style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}
        />
      )}
      <div className={styles.text}>
        <div className={styles.head}>
          <time className={styles.date}>{date}</time>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p className={styles.excerpt}>{excerpt}</p>
      </div>
    </article>
  );
}
