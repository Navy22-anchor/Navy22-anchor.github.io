import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Markdown from '../components/Markdown.jsx';
import ReferenceCard from '../components/ReferenceCard.jsx';
import { stringifyPost } from '../data/frontMatter.js';
import { clearDraft, emptyDraft, formatDate, loadDraft, postId, publishPost, saveDraft } from '../data/localPosts.js';
import { categories } from '../data/projects.js';
import backIcon from '../assets/back.svg';
import checkIcon from '../assets/check.svg';
import styles from './Write.module.css';

// Figma "Blog Post Editor" (21:38): 왼쪽 마크다운 원본, 오른쪽 읽기 미리보기

// 툴바 버튼. wrap: 선택 글자를 감쌈 / prefix: 줄 앞에 붙임 / snippet: 틀을 넣고 일부를 선택
const TOOLS = [
  { id: 'bold', label: '굵게 (Ctrl+B)', icon: 'B', wrap: ['**', '**'], placeholder: '굵은 글자' },
  { id: 'italic', label: '기울임 (Ctrl+I)', icon: 'I', wrap: ['*', '*'], placeholder: '기울인 글자' },
  { id: 'heading', label: '소제목', icon: 'H', prefix: '## ' },
  { id: 'quote', label: '인용', icon: '❝', prefix: '> ' },
  { id: 'link', label: '링크', icon: '🔗', snippet: (sel) => [`[${sel || '링크 텍스트'}](`, 'https://', ')'] },
  { id: 'image', label: '사진 (![캡션](주소))', icon: '▣', snippet: (sel) => [`\n![${sel || '사진 캡션'}](`, 'https://', ')\n'] },
  { id: 'list', label: '목록', icon: '≡', prefix: '- ' },
  { id: 'code', label: '코드', icon: '</>', wrap: ['`', '`'], placeholder: '코드' },
  { id: 'math', label: '수식 ($$ … $$)', icon: '∑', snippet: (sel) => ['\n$$ ', sel || 'e^{i\\pi} + 1 = 0', ' $$\n'] },
];

// 마크다운 서식을 넣은 새 글과 선택 범위를 돌려줌
function applyTool(tool, value, start, end) {
  const sel = value.slice(start, end);

  if (tool.prefix) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const block = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const lines = block.split('\n');
    // 모든 줄에 이미 붙어 있으면 떼어 냄
    const remove = lines.every((line) => line.startsWith(tool.prefix));
    const next = lines.map((line) => (remove ? line.slice(tool.prefix.length) : tool.prefix + line)).join('\n');
    return {
      value: value.slice(0, lineStart) + next + value.slice(lineStart + block.length),
      start: lineStart,
      end: lineStart + next.length,
    };
  }

  if (tool.wrap) {
    const [open, close] = tool.wrap;
    const text = sel || tool.placeholder;
    return {
      value: value.slice(0, start) + open + text + close + value.slice(end),
      start: start + open.length,
      end: start + open.length + text.length,
    };
  }

  const [before, selected, after] = tool.snippet(sel);
  return {
    value: value.slice(0, start) + before + selected + after + value.slice(end),
    start: start + before.length,
    end: start + before.length + selected.length,
  };
}

// 내용에 맞춰 높이가 늘어나는 textarea
function useAutosize(value) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

const emptyReference = { title: '', author: '', year: '', url: '', about: '' };

// 브라우저에서 파일 내려받기
function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 카테고리 고르기 (Figma "Publish confirm dialog"): 화살표 없는 알약 버튼을 누르면 목록이 펼쳐짐
function CategorySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => categories.indexOf(value));
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointer = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const toggle = () => {
    setActive(categories.indexOf(value));
    setOpen((o) => !o);
  };

  const choose = (c) => {
    onChange(c);
    setOpen(false);
    rootRef.current.querySelector('button').focus();
  };

  const onListKey = (e) => {
    const last = categories.length - 1;
    const keys = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(categories[active]),
      ' ': () => choose(categories[active]),
      // 목록만 닫고 발행 창은 그대로
      Escape: () => {
        setOpen(false);
        rootRef.current.querySelector('button').focus();
      },
      Tab: () => setOpen(false),
    };
    if (!keys[e.key]) return;
    if (e.key !== 'Tab') e.preventDefault();
    e.stopPropagation();
    keys[e.key]();
  };

  return (
    <div ref={rootRef} className={styles.category}>
      <button
        type="button"
        className={styles.categoryButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`카테고리: ${value}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) toggle();
          }
        }}
      >
        {value}
      </button>
      {open && (
        <ul
          ref={listRef}
          className={styles.categoryMenu}
          role="listbox"
          tabIndex={-1}
          aria-label="카테고리"
          aria-activedescendant={`category-${active}`}
          onKeyDown={onListKey}
        >
          {categories.map((c, i) => (
            <li
              key={c}
              id={`category-${i}`}
              role="option"
              aria-selected={c === value}
              data-active={i === active || undefined}
              className={styles.categoryOption}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(c)}
            >
              {c}
              {c === value && <img src={checkIcon} alt="" width="11" height="8" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 발행 확인 창: 발행하면 .md 파일을 내려받고(content/posts/ 에 올리면 사이트에 게시) 글 화면으로 이동
function PublishDialog({ post, onCategory, onClose, onPublish }) {
  const ref = useRef(null);
  // 창은 사라질 때 DOM에서 빠지며 닫힘 (정리 함수에서 close()하면 onClose가 불려 바로 닫혀 버림)
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="publish-heading">
      <div className={styles.dialogHeader}>
        <CategorySelect value={post.category} onChange={onCategory} />
        <h2 id="publish-heading" className={styles.dialogHeading}>
          에 발행하시겠습니까?
        </h2>
      </div>
      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.dialogButton} ${styles.primary}`} onClick={onPublish}>
          발행
        </button>
        <button type="button" className={styles.dialogButton} onClick={() => ref.current.close()}>
          취소
        </button>
      </div>
    </dialog>
  );
}

export default function Write() {
  const [draft, setDraft] = useState(loadDraft);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(null); // 발행 창에 띄운 글
  const pendingSelection = useRef(null);
  const statusTimer = useRef(0);

  const titleRef = useAutosize(draft.title);
  const sourceRef = useAutosize(draft.markdown);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // 툴바로 바꾼 뒤 선택 범위를 되살림
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    if (!sel || !sourceRef.current) return;
    pendingSelection.current = null;
    sourceRef.current.focus();
    sourceRef.current.setSelectionRange(sel.start, sel.end);
  }, [draft.markdown, sourceRef]);

  useEffect(() => () => clearTimeout(statusTimer.current), []);

  const flash = (message) => {
    setStatus(message);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(''), 2500);
  };

  const runTool = (tool) => {
    const el = sourceRef.current;
    const result = applyTool(tool, draft.markdown, el.selectionStart, el.selectionEnd);
    pendingSelection.current = result;
    update({ markdown: result.value });
  };

  const save = useCallback(() => {
    flash(saveDraft(draft) ? `임시저장됨 ${formatDate().slice(-5)}` : '저장하지 못했어요');
  }, [draft]);

  const publish = () => {
    if (!draft.title.trim()) {
      flash('글 제목을 입력하세요');
      titleRef.current?.focus();
      return;
    }
    const date = new Date();
    const references = draft.references.filter((ref) => ref.title.trim());
    setPending({ ...draft, references, id: postId(date), date: formatDate(date), category: categories[0] });
  };

  const confirmPublish = () => {
    download(`${pending.id}.md`, stringifyPost(pending));
    // 저장소에 올리기 전에도 이 브라우저에서는 바로 볼 수 있게 남겨 둠
    publishPost(pending);
    clearDraft();
    window.location.hash = `#/post/${pending.id}`;
  };

  // Ctrl+S 임시저장
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const onSourceKeyDown = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tool = { b: TOOLS[0], i: TOOLS[1] }[e.key.toLowerCase()];
    if (!tool) return;
    e.preventDefault();
    runTool(tool);
  };

  const setReference = (i, patch) =>
    update({ references: draft.references.map((ref, j) => (j === i ? { ...ref, ...patch } : ref)) });

  // 이전 화면이 있으면 그리로, 이 주소로 바로 열었으면 홈으로
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/';
  };

  const references = draft.references.filter((ref) => ref.title.trim());
  const isEmpty = JSON.stringify(draft) === JSON.stringify(emptyDraft);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} aria-label="뒤로가기" onClick={goBack}>
          <img src={backIcon} alt="" width="24" height="24" />
        </button>
        <p className={styles.pill}>글 작성</p>
        <div className={styles.actions}>
          <span className={styles.status} role="status">
            {status}
          </span>
          <button type="button" className={styles.pill} onClick={save} disabled={isEmpty}>
            임시저장
          </button>
          <button type="button" className={`${styles.pill} ${styles.primary}`} onClick={publish}>
            발행
          </button>
        </div>
      </header>

      {pending && (
        <PublishDialog
          post={pending}
          onCategory={(category) => setPending((p) => ({ ...p, category }))}
          onPublish={confirmPublish}
          onClose={() => setPending(null)}
        />
      )}

      <div className={styles.split}>
        <section className={styles.editor} aria-label="마크다운 작성">
          <div className={styles.toolbar} role="toolbar" aria-label="서식">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={styles.tool}
                data-tool={tool.id}
                title={tool.label}
                aria-label={tool.label}
                onMouseDown={(e) => e.preventDefault()} // 선택 범위를 잃지 않게
                onClick={() => runTool(tool)}
              >
                {tool.icon}
              </button>
            ))}
            <button
              type="button"
              className={styles.tool}
              data-tool="reference"
              title="참고문헌 추가"
              aria-label="참고문헌 추가"
              onClick={() => update({ references: [...draft.references, emptyReference] })}
            >
              [1]
            </button>
          </div>

          <textarea
            ref={titleRef}
            className={styles.titleField}
            rows={1}
            placeholder="글 제목을 입력하세요"
            aria-label="글 제목"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value.replace(/\n/g, ' ') })}
          />

          <label className={styles.byline}>
            by
            <input
              className={styles.authorField}
              placeholder="작성자 이름"
              aria-label="작성자 이름"
              size={Math.max(6, draft.author.length + 1)}
              value={draft.author}
              onChange={(e) => update({ author: e.target.value })}
            />
          </label>

          <textarea
            ref={sourceRef}
            className={styles.source}
            aria-label="본문 (마크다운)"
            spellCheck={false}
            value={draft.markdown}
            onChange={(e) => update({ markdown: e.target.value })}
            onKeyDown={onSourceKeyDown}
          />

          {draft.references.length > 0 && (
            <div className={styles.refEditor} aria-label="참고문헌">
              {draft.references.map((ref, i) => (
                <fieldset key={i} className={styles.refForm}>
                  <legend className={styles.srOnly}>참고문헌 {i + 1}</legend>
                  <input placeholder="제목 (저자, 연도)" value={ref.title} onChange={(e) => setReference(i, { title: e.target.value })} />
                  <div className={styles.refRow}>
                    <input placeholder="저자" value={ref.author} onChange={(e) => setReference(i, { author: e.target.value })} />
                    <input placeholder="연도" value={ref.year} onChange={(e) => setReference(i, { year: e.target.value })} />
                  </div>
                  <input placeholder="링크 https://" type="url" value={ref.url} onChange={(e) => setReference(i, { url: e.target.value })} />
                  <textarea placeholder="설명 또는 메모" rows={2} value={ref.about} onChange={(e) => setReference(i, { about: e.target.value })} />
                  <button
                    type="button"
                    className={styles.refRemove}
                    onClick={() => update({ references: draft.references.filter((_, j) => j !== i) })}
                  >
                    삭제
                  </button>
                </fieldset>
              ))}
            </div>
          )}
        </section>

        <section className={styles.preview} aria-label="미리보기">
          <p className={styles.previewLabel}>미리보기</p>
          <h1 className={styles.previewTitle} data-empty={!draft.title || undefined}>
            {draft.title || '글 제목'}
          </h1>
          <p className={styles.previewByline}>by {draft.author || '작성자 이름'}</p>
          <Markdown source={draft.markdown} className={styles.previewBody} />
          {references.length > 0 && (
            <>
              <h2 className={styles.previewRefHeading}>참고문헌</h2>
              <div className={styles.previewRefs}>
                {references.map((ref, i) => (
                  <ReferenceCard key={i} {...ref} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
