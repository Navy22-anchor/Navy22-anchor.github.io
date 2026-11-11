import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Markdown from '../components/Markdown.jsx';
import ReferenceEditor from '../components/ReferenceEditor.jsx';
import ReferenceList from '../components/ReferenceList.jsx';
import { referenceText } from '../components/ReferenceIcons.jsx';
import { stringifyPost } from '../data/frontMatter.js';
import { clearDraft, emptyDraft, formatDate, loadDraft, loadSavedDraft, postId, publishPost, saveDraft } from '../data/localPosts.js';
import { findPost, toMarkdown } from '../data/posts.js';
import { loadCategories } from '../data/categories.js';
import { TOKEN_HELP_URL, clearToken, commitPost, loadToken, saveToken } from '../data/github.js';
import { addImage, imageRepoPath, imagesIn, loadImageBlob } from '../data/localImages.js';
import backIcon from '../assets/back.svg';
import checkIcon from '../assets/check.svg';
import styles from './Write.module.css';

// Figma "Blog Post Editor" (21:38): 왼쪽 마크다운 원본, 오른쪽 읽기 미리보기

// 툴바 버튼. wrap: 선택 글자를 감쌈 / prefix: 줄 앞에 붙임 / snippet: 틀을 넣고 일부를 선택 / upload: 사진 파일 고르기
const TOOLS = [
  { id: 'bold', label: '굵게 (Ctrl+B)', icon: 'B', wrap: ['**', '**'], placeholder: '굵은 글자' },
  { id: 'italic', label: '기울임 (Ctrl+I)', icon: 'I', wrap: ['*', '*'], placeholder: '기울인 글자' },
  { id: 'heading', label: '소제목', icon: 'H', prefix: '## ' },
  { id: 'quote', label: '인용', icon: '❝', prefix: '> ' },
  { id: 'link', label: '링크', icon: '🔗', snippet: (sel) => [`[${sel || '링크 텍스트'}](`, 'https://', ')'] },
  { id: 'image', label: '사진 올리기 (끌어다 놓거나 붙여 넣어도 됨)', icon: '▣', upload: true },
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
// 높이를 재려고 잠깐 줄이는 동안 페이지가 짧아져 스크롤이 맨 위로 튀지 않게 스크롤 위치를 되돌림
function useAutosize(value) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollX, scrollY } = window;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    if (window.scrollY !== scrollY) window.scrollTo(scrollX, scrollY);
  }, [value]);
  return ref;
}

const emptyReference = { kind: 'paper', text: '', url: '' };

// Figma "Motion / Scrollbar → Toolbar": 두 칸 사이의 스크롤바 막대에 마우스를 올리면 세로 도구모음으로 펼쳐짐
// 버튼마다 배경이 자기 자리까지 자란 뒤 커지기 시작하고, 모두 배경과 같은 순간(0.25초)에 제 크기가 됨
const TOOL_DELAYS = [0, 0, 0, 0, 0, 0, 0.017, 0.036, 0.06, 0.116, 0.116];
const RAIL_TOP = 85; // 접힌 막대가 스크롤 맨 위일 때 위치 (상단 바 77 + 8)
const THUMB_HEIGHT = 260;
const OPEN_TOP = 109; // 펼친 도구모음의 가장 높은 위치 (왼쪽 편집 칸 윗선)
const OPEN_HEIGHT = 372;
const EDGE = 8; // 화면 아래 여백, 막대 양옆 마우스 여유

function ToolRail({ tools, onTool, onReference }) {
  const ref = useRef(null);
  const thumbY = useRef(0);
  const [open, setOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animTimer = useRef(0);

  // 접힌 막대는 글 스크롤 위치를 따라 움직임 (펼치고 접는 동안에만 위치가 부드럽게 이동)
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const track = Math.max(0, window.innerHeight - EDGE - RAIL_TOP - THUMB_HEIGHT);
      thumbY.current = max > 0 ? (window.scrollY / max) * track : 0;
      ref.current?.style.setProperty('--thumb-y', `${thumbY.current}px`);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => () => clearTimeout(animTimer.current), []);

  const toggle = useCallback((next) => {
    setOpen(next);
    setAnimating(true);
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setAnimating(false), 260);
  }, []);

  // 막대가 있는 자리에서 펼침: 막대 가운데에 맞추되 화면 안(편집 칸 윗선 ~ 화면 아래)으로
  const expand = () => {
    if (open) return;
    const center = RAIL_TOP + thumbY.current + THUMB_HEIGHT / 2;
    const top = Math.max(OPEN_TOP, Math.min(center - OPEN_HEIGHT / 2, window.innerHeight - EDGE - OPEN_HEIGHT));
    ref.current.style.setProperty('--open-top', `${top}px`);
    toggle(true);
  };

  // 마우스가 도구모음과 원래 막대 자리 모두에서 벗어나야 접음 (펼친 자리와 막대 자리가 어긋나도 깜빡이지 않게)
  useEffect(() => {
    if (!open) return;
    const inside = (x, y) => {
      const r = ref.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const top = RAIL_TOP + thumbY.current;
      const inRail = x >= r.left - EDGE && x <= r.right + EDGE && y >= r.top && y <= r.bottom;
      const inThumb = Math.abs(x - cx) <= 4 + EDGE && y >= top && y <= top + THUMB_HEIGHT;
      return inRail || inThumb;
    };
    const onMove = (e) => {
      if (inside(e.clientX, e.clientY)) return;
      if (ref.current.querySelector(':focus-visible')) return; // 키보드로 쓰는 중
      toggle(false);
    };
    const onOut = (e) => !e.relatedTarget && toggle(false); // 창 밖으로 나감
    window.addEventListener('pointermove', onMove);
    document.addEventListener('mouseout', onOut);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseout', onOut);
    };
  }, [open, toggle]);

  return (
    <div
      ref={ref}
      className={styles.rail}
      data-open={open || undefined}
      data-animating={animating || undefined}
      role="toolbar"
      aria-label="서식"
      aria-orientation="vertical"
      onMouseEnter={expand}
      // 키보드(Tab)로 들어오면 펼침
      onFocus={(e) => e.target.matches(':focus-visible') && expand()}
      onBlur={(e) => !ref.current.contains(e.relatedTarget) && !ref.current.matches(':hover') && toggle(false)}
    >
      <div className={styles.tools}>
        {tools.map((tool, i) => (
          <button
            key={tool.id}
            type="button"
            className={styles.tool}
            data-tool={tool.id}
            title={tool.label}
            aria-label={tool.label}
            style={{ '--tool-delay': `${TOOL_DELAYS[i]}s` }}
            onMouseDown={(e) => e.preventDefault()} // 선택 범위를 잃지 않게
            onClick={() => onTool(tool)}
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
          style={{ '--tool-delay': `${TOOL_DELAYS[tools.length]}s` }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReference}
        >
          [1]
        </button>
      </div>
    </div>
  );
}

// 브라우저에서 파일 내려받기 (글자 또는 Blob)
function download(filename, data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 카테고리 고르기 (Figma "Publish confirm dialog"): 화살표 없는 알약 버튼을 누르면 목록이 펼쳐짐
function CategorySelect({ value, onChange }) {
  const [categories] = useState(loadCategories);
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
function PublishDialog({ post, onCategory, onClose, onPublish, onDownload, token, onToken, busy, error }) {
  const ref = useRef(null);
  const [savedToken] = useState(token); // 창을 열 때 이미 연결되어 있었는지
  // 창은 사라질 때 DOM에서 빠지며 닫힘 (정리 함수에서 close()하면 onClose가 불려 바로 닫혀 버림)
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
  }, []);

  const connected = savedToken && savedToken === token;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
      aria-labelledby="publish-heading"
      aria-busy={busy}
    >
      <div className={styles.dialogHeader}>
        <CategorySelect value={post.category} onChange={onCategory} />
        <h2 id="publish-heading" className={styles.dialogHeading}>
          에 발행하시겠습니까?
        </h2>
      </div>

      {/* 저장소 쓰기 권한이 있는 GitHub 토큰으로 바로 커밋 */}
      {connected ? (
        <p className={styles.dialogNote}>
          GitHub에 바로 게시됩니다 ·{' '}
          <button type="button" className={styles.linkButton} onClick={() => onToken('')} disabled={busy}>
            토큰 바꾸기
          </button>
        </p>
      ) : (
        <div className={styles.tokenField}>
          <label htmlFor="github-token">GitHub 토큰</label>
          <input
            id="github-token"
            type="password"
            autoComplete="off"
            spellCheck="false"
            value={token}
            onChange={(e) => onToken(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && token && onPublish()}
            disabled={busy}
          />
          <p className={styles.dialogNote}>
            이 저장소의 Contents 읽기·쓰기 권한이 있는 토큰. 이 브라우저에만 저장됩니다.{' '}
            <a href={TOKEN_HELP_URL} target="_blank" rel="noreferrer">
              토큰 만들기
            </a>
          </p>
        </div>
      )}

      {error && (
        <p className={styles.dialogError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.dialogActions}>
        <button
          type="button"
          className={`${styles.dialogButton} ${styles.primary}`}
          onClick={onPublish}
          disabled={busy || !token}
        >
          {busy ? '발행 중…' : '발행'}
        </button>
        <button type="button" className={styles.dialogButton} onClick={() => ref.current.close()} disabled={busy}>
          취소
        </button>
      </div>

      {!connected && (
        <button type="button" className={styles.linkButton} onClick={onDownload} disabled={busy}>
          토큰 없이 .md 파일로 내려받기
        </button>
      )}
    </dialog>
  );
}

// 수정할 글을 편집 화면 형태로. 수정하다 임시저장한 내용이 있으면 그것부터
function loadEditDraft(id) {
  const saved = loadSavedDraft(id);
  if (saved) return { ...emptyDraft, ...saved };
  const post = findPost(id);
  return {
    title: post.title ?? '',
    author: post.author ?? '',
    markdown: toMarkdown(post),
    references: (post.references ?? []).map((ref) => ({ kind: ref.kind || 'paper', text: referenceText(ref), url: ref.url ?? '' })),
  };
}

export default function Write({ editId }) {
  // 수정이면 원래 글의 id(파일 이름)·날짜·카테고리를 그대로 두고 내용만 덮어씀
  const [original] = useState(() => (editId ? findPost(editId) : null));
  const [draft, setDraft] = useState(() => (original ? loadEditDraft(original.id) : loadDraft()));
  const [status, setStatus] = useState('');
  const [refFocus, setRefFocus] = useState(null); // 새로 만든 참고문헌 칸에 커서
  const [refCollapsed, setRefCollapsed] = useState(false); // 참고문헌 입력창을 바로 접음 (–)
  const [refClosed, setRefClosed] = useState(false); // 참고문헌 입력창을 닫음 (×). [1] 도구로 다시 열림
  const [pending, setPending] = useState(null); // 발행 창에 띄운 글
  const [token, setToken] = useState(loadToken);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const pendingSelection = useRef(null);
  const statusTimer = useRef(0);
  const fileRef = useRef(null);
  const uploadAt = useRef(null); // 사진 고르는 창을 열 때의 커서 위치

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

  // 사진 파일을 저장하고 커서 자리에 ![사진 캡션](/images/posts/…) 를 넣은 뒤 캡션을 선택
  const insertImages = async (fileList, at) => {
    const files = [...fileList].filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    const el = sourceRef.current;
    const start = at?.start ?? el.selectionStart;
    const end = at?.end ?? el.selectionEnd;
    flash('사진을 넣는 중…');
    let srcs;
    try {
      srcs = await Promise.all(files.map(addImage));
    } catch {
      flash('사진을 넣지 못했어요');
      return;
    }
    const caption = '사진 캡션';
    setDraft((d) => {
      // 사진은 앞뒤에 빈 줄을 두어 따로 한 덩어리로
      const before = d.markdown.slice(0, start);
      const after = d.markdown.slice(end);
      const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const tail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
      const text = lead + srcs.map((src) => `![${caption}](${src})`).join('\n\n') + tail;
      const at = before.length + lead.length + 2;
      pendingSelection.current = { start: at, end: at + caption.length };
      return { ...d, markdown: before + text + after };
    });
    flash(files.length > 1 ? `사진 ${files.length}장을 넣었어요` : '사진을 넣었어요');
  };

  const runTool = (tool) => {
    const el = sourceRef.current;
    if (tool.upload) {
      uploadAt.current = { start: el.selectionStart, end: el.selectionEnd };
      fileRef.current.click();
      return;
    }
    const result = applyTool(tool, draft.markdown, el.selectionStart, el.selectionEnd);
    pendingSelection.current = result;
    update({ markdown: result.value });
  };

  const save = useCallback(() => {
    flash(saveDraft(draft, original?.id) ? `임시저장됨 ${formatDate().slice(-5)}` : '저장하지 못했어요');
  }, [draft, original]);

  const publish = () => {
    if (!draft.title.trim()) {
      flash('글 제목을 입력하세요');
      titleRef.current?.focus();
      return;
    }
    const date = new Date();
    const references = draft.references.filter((ref) => referenceText(ref).trim());
    setPending(
      original
        ? { ...draft, references, id: original.id, date: original.date || formatDate(date), category: original.category || loadCategories()[0] }
        : { ...draft, references, id: postId(date), date: formatDate(date), category: loadCategories()[0] },
    );
  };

  // 이 브라우저에서는 바로 보이게 남겨 두고 글 페이지로
  const finishPublish = (post) => {
    publishPost(post);
    clearDraft(original?.id);
    // 수정이면 편집 화면을 기록에서 지워, 글에서 뒤로가기 하면 수정 전 화면으로 돌아오지 않게
    if (original) window.location.replace(`#/post/${post.id}`);
    else window.location.hash = `#/post/${post.id}`;
  };

  // 발행: GitHub 저장소에 content/posts/<id>.md 로 커밋
  const confirmPublish = async () => {
    if (!token || publishing) return;
    setPublishing(true);
    setPublishError('');
    try {
      // 글에 넣은 사진 중 이 브라우저에 있는 것(아직 저장소에 없을 수 있는 것)을 함께 올림
      const images = await Promise.all(
        imagesIn(pending.markdown).map(async (src) => ({ path: imageRepoPath(src), blob: await loadImageBlob(src) })),
      );
      await commitPost(token, pending, stringifyPost(pending), images.filter((image) => image.blob));
      saveToken(token);
      finishPublish(pending);
    } catch (err) {
      if (err.badToken) clearToken();
      setPublishError(err.message);
      setPublishing(false);
    }
  };

  // 토큰 없이: 예전처럼 파일만 내려받음 (저장소에는 직접 올려야 함. 사진은 public/images/posts/ 에)
  const downloadPublish = async () => {
    download(`${pending.id}.md`, stringifyPost(pending));
    for (const src of imagesIn(pending.markdown)) {
      const blob = await loadImageBlob(src);
      if (blob) download(src.split('/').pop(), blob);
    }
    finishPublish(pending);
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

  // 이전 화면이 있으면 그리로, 이 주소로 바로 열었으면 홈으로
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/';
  };

  const references = draft.references.filter((ref) => referenceText(ref).trim());
  const isEmpty = !original && JSON.stringify(draft) === JSON.stringify(emptyDraft);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} aria-label="뒤로가기" onClick={goBack}>
          <img src={backIcon} alt="" width="24" height="24" />
        </button>
        <p className={styles.pill}>{original ? '글 수정' : '글 작성'}</p>
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
          onDownload={downloadPublish}
          token={token}
          onToken={(value) => {
            setToken(value);
            setPublishError('');
          }}
          busy={publishing}
          error={publishError}
          onClose={() => {
            setPending(null);
            setPublishError('');
          }}
        />
      )}

      <div className={styles.split}>
        <section className={styles.editor} aria-label="마크다운 작성">
          <ToolRail
            tools={TOOLS}
            onTool={runTool}
            onReference={() => {
              // 처음 누르면 빈칸 2개, 그다음부터는 1개씩
              const add = draft.references.length ? [emptyReference] : [emptyReference, emptyReference];
              update({ references: [...draft.references, ...add] });
              setRefFocus(draft.references.length);
              setRefCollapsed(false);
              setRefClosed(false);
            }}
          />

          <textarea
            ref={titleRef}
            className={styles.titleField}
            rows={1}
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
            onPaste={(e) => {
              if (![...e.clipboardData.files].some((file) => file.type.startsWith('image/'))) return;
              e.preventDefault();
              insertImages(e.clipboardData.files);
            }}
            onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault();
              insertImages(e.dataTransfer.files);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              insertImages(e.target.files, uploadAt.current);
              e.target.value = '';
            }}
          />

          {draft.references.length > 0 && !refClosed && (
            <ReferenceEditor
              references={draft.references}
              focusIndex={refFocus}
              collapsed={refCollapsed}
              onCollapsedChange={setRefCollapsed}
              onClose={() => {
                // 닫을 때 비어 있는 칸은 정리
                update({ references: draft.references.filter((ref) => referenceText(ref).trim() || ref.url) });
                setRefClosed(true);
                setRefCollapsed(false);
              }}
              onChange={(next, focus) => {
                update({ references: next });
                setRefFocus(focus ?? null);
              }}
            />
          )}
        </section>

        <section className={styles.preview} aria-label="미리보기">
          <p className={styles.previewLabel}>미리보기</p>
          <h1 className={styles.previewTitle} data-empty={!draft.title || undefined}>
            {draft.title || '글 제목'}
          </h1>
          <p className={styles.previewByline}>by {draft.author || '작성자 이름'}</p>
          <Markdown source={draft.markdown} className={styles.previewBody} />
          <ReferenceList references={references} className={styles.previewRefs} />
        </section>
      </div>
    </div>
  );
}
