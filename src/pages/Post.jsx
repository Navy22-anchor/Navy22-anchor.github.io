import Markdown from '../components/Markdown.jsx';
import ReferenceCard from '../components/ReferenceCard.jsx';
import { findPost } from '../data/posts.js';
import backIcon from '../assets/back.svg';
import styles from './Post.module.css';

function Block({ block }) {
  switch (block.type) {
    case 'h2':
      return <h2 className={styles.subheading}>{block.text}</h2>;
    case 'image':
      return (
        <figure className={styles.figure}>
          {block.src ? (
            <img className={styles.image} src={block.src} alt={block.alt} />
          ) : (
            <div className={styles.image} role="img" aria-label="사진 자리" />
          )}
          {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
        </figure>
      );
    default:
      return <p className={styles.paragraph}>{block.text}</p>;
  }
}

// 이전 화면이 있으면 그리로, 이 주소로 바로 열었으면 홈으로
function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

export default function Post({ id }) {
  const post = findPost(id);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.back} aria-label="뒤로가기" onClick={goBack}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <a href="#/" className={styles.pill}>나의 블로그</a>
        <a href="#/write" className={styles.icon} aria-label="새 글 쓰기" />
      </header>

      <main className={styles.content}>
        <article className={styles.article}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            {post.author && <p className={styles.byline}>by {post.author}</p>}
            <time className={styles.date}>{post.date}</time>
          </div>
          {post.markdown !== undefined ? (
            <Markdown source={post.markdown} />
          ) : (
            post.body.map((block, i) => <Block key={i} block={block} />)
          )}
        </article>

        {post.faq?.length > 0 && (
          <section className={styles.faq} aria-labelledby="faq-heading">
            <h2 id="faq-heading" className={styles.sectionHeading}>자주 묻는 질문</h2>
            {post.faq.map((item) => (
              <div key={item.q} className={styles.faqItem}>
                <h3 className={styles.question}>{item.q}</h3>
                <p className={styles.answer}>{item.a}</p>
              </div>
            ))}
          </section>
        )}

        {post.references?.length > 0 && (
          <aside className={styles.references} aria-labelledby="references-heading">
            <h2 id="references-heading" className={styles.referencesHeading}>참고문헌</h2>
            <div className={styles.referenceList}>
              {post.references.map((ref, i) => (
                <ReferenceCard key={i} {...ref} />
              ))}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
