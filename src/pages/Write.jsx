import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Markdown from '../components/Markdown.jsx';
import ReferenceCard from '../components/ReferenceCard.jsx';
import { clearDraft, emptyDraft, formatDate, loadDraft, publishPost, saveDraft } from '../data/localPosts.js';
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

export default function Write() {
  const [draft, setDraft] = useState(loadDraft);
  const [status, setStatus] = useState('');
  const [now, setNow] = useState(() => formatDate());
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

  // 미리보기 날짜는 1분마다 갱신
  useEffect(() => {
    const id = setInterval(() => setNow(formatDate()), 30000);
    return () => clearInterval(id);
  }, []);

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
    const references = draft.references.filter((ref) => ref.title.trim());
    const post = publishPost({ ...draft, references }, formatDate());
    if (!post) return flash('발행하지 못했어요');
    clearDraft();
    window.location.hash = `#/post/${post.id}`;
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

  const references = draft.references.filter((ref) => ref.title.trim());
  const isEmpty = JSON.stringify(draft) === JSON.stringify(emptyDraft);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <a href="#/" className={styles.icon} aria-label="홈으로" />
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
            placeholder={'## 소제목\n\n본문 문단을 마크다운으로 작성합니다. **굵게**, *기울임*, [링크](https://example.com)\n\n$$ e^{i\\pi} + 1 = 0 $$\n\n- 목록 항목'}
            aria-label="본문 (마크다운)"
            spellCheck={false}
            value={draft.markdown}
            onChange={(e) => update({ markdown: e.target.value })}
            onKeyDown={onSourceKeyDown}
          />

          <div className={styles.refEditor}>
            <h2 className={styles.refEditorHeading}>참고문헌</h2>
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
            <button
              type="button"
              className={styles.refAdd}
              onClick={() => update({ references: [...draft.references, emptyReference] })}
            >
              + 참고문헌 추가
            </button>
          </div>
        </section>

        <section className={styles.preview} aria-label="미리보기">
          <p className={styles.previewLabel}>미리보기</p>
          <h1 className={styles.previewTitle} data-empty={!draft.title || undefined}>
            {draft.title || '글 제목'}
          </h1>
          <p className={styles.previewByline}>by {draft.author || '작성자 이름'}</p>
          <time className={styles.previewDate}>{now}</time>
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
