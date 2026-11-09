import { useEffect, useRef, useState } from 'react';
import Markdown from '../components/Markdown.jsx';
import ReferenceCard from '../components/ReferenceCard.jsx';
import { deletePost, loadToken } from '../data/github.js';
import { removePost } from '../data/localPosts.js';
import { findPost, isRepoPost, posts } from '../data/posts.js';
import backIcon from '../assets/back.svg';
import penIcon from '../assets/pen.svg';
import trashIcon from '../assets/trash.svg';
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

// Figma "Delete confirm dialog" (87:3860)
function DeleteDialog({ onConfirm, onClose, busy, error }) {
  const ref = useRef(null);
  // 창은 사라질 때 DOM에서 빠지며 닫힘
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
      aria-labelledby="delete-heading"
      aria-busy={busy}
    >
      <h2 id="delete-heading" className={styles.dialogHeading}>
        삭제 하겠습니까?
      </h2>
      {error && (
        <p className={styles.dialogError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.dialogButton} ${styles.danger}`} onClick={onConfirm} disabled={busy}>
          {busy ? '삭제 중…' : '예'}
        </button>
        <button type="button" className={styles.dialogButton} onClick={() => ref.current.close()} disabled={busy}>
          아니오
        </button>
      </div>
    </dialog>
  );
}

export default function Post({ id }) {
  const post = findPost(id);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const isExample = posts.includes(post); // 예시 글은 지울 파일이 없음

  // 휴지통: 저장소 글은 GitHub에서 파일을 지우는 커밋, 이 브라우저에만 있는 글은 여기서만 지움
  const onDelete = async () => {
    if (deleting) return;
    setDeleteError('');
    if (isRepoPost(post.id)) {
      const token = loadToken();
      if (!token) {
        setDeleteError('저장소의 글을 지우려면 먼저 글 작성 페이지에서 발행할 때 GitHub 토큰을 연결해 주세요.');
        return;
      }
      setDeleting(true);
      try {
        await deletePost(token, post);
      } catch (err) {
        setDeleteError(err.message);
        setDeleting(false);
        return;
      }
    }
    removePost(post.id);
    window.location.replace('#/');
  };

  return (
    <div className={styles.page}>
      {/* Figma "Blog Reading Page" 상단 바: 양옆 64px 묶음 사이에 카테고리 알약을 가운데로 */}
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <button type="button" className={styles.iconButton} aria-label="뒤로가기" onClick={goBack}>
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
        </div>
        <a href="#/" className={styles.pill}>{post.category || '나의 블로그'}</a>
        <div className={`${styles.headerSide} ${styles.headerRight}`}>
          <a href={`#/write/${post.id}`} className={styles.iconButton} aria-label="글 수정">
            <img src={penIcon} alt="" width="24" height="24" />
          </a>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="글 삭제"
            onClick={() => setConfirming(true)}
            disabled={isExample}
          >
            <img src={trashIcon} alt="" width="24" height="24" />
          </button>
        </div>
      </header>

      {confirming && (
        <DeleteDialog
          onConfirm={onDelete}
          onClose={() => {
            setConfirming(false);
            setDeleteError('');
          }}
          busy={deleting}
          error={deleteError}
        />
      )}

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
