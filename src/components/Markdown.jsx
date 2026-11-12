import { useMemo, useSyncExternalStore } from 'react';
import { Marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { imagesVersion, localImageUrl, subscribeImages } from '../data/localImages.js';
import styles from './Markdown.module.css';

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// javascript: 같은 위험한 주소는 막음
const safeUrl = (href = '') => (/^\s*(javascript|vbscript|data:(?!image\/))/i.test(href) ? '#' : href);

const math = (text, displayMode) => katex.renderToString(text, { displayMode, throwOnError: false });

const marked = new Marked({
  gfm: true,
  breaks: true,
  extensions: [
    // $$ 수식 $$ → 가운데 정렬 수식 블록
    {
      name: 'blockMath',
      level: 'block',
      start: (src) => src.indexOf('$$'),
      tokenizer(src) {
        const m = /^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/.exec(src);
        if (m) return { type: 'blockMath', raw: m[0], text: m[1].trim() };
      },
      renderer: (token) => `<div class="${styles.math}">${math(token.text, true)}</div>`,
    },
    // $수식$ → 문장 안 수식
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src) => src.indexOf('$'),
      tokenizer(src) {
        const m = /^\$([^$\n]+?)\$/.exec(src);
        if (m) return { type: 'inlineMath', raw: m[0], text: m[1] };
      },
      renderer: (token) => math(token.text, false),
    },
  ],
  renderer: {
    // 글 안의 HTML은 그대로 글자로 보여 줌
    html: ({ text }) => escapeHtml(text),
    // ![캡션](주소) → 사진 + "사진 N. 캡션". 번호는 글 안의 순서대로 자동 (캡션이 비어 있으면 "사진 N"만)
    // 직접 올린 사진이 아직 이 브라우저에만 있으면 그걸 보여 줌
    image({ href, text }) {
      photoCount += 1;
      const label = `<span class="${styles.photoNumber}">사진 ${photoCount}${text ? '.' : ''}</span>`;
      const caption = `<figcaption>${label}${text ? ` ${escapeHtml(text)}` : ''}</figcaption>`;
      const src = localImageUrl(href) ?? safeUrl(href);
      return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(text)}" loading="lazy">${caption}</figure>`;
    },
    link({ href, tokens }) {
      const url = safeUrl(href);
      const external = /^https?:/i.test(url) ? ' target="_blank" rel="noreferrer"' : '';
      return `<a href="${escapeHtml(url)}"${external}>${this.parser.parseInline(tokens)}</a>`;
    },
    // 사진만 있는 문단은 <p>로 감싸지 않음
    paragraph({ tokens }) {
      const inner = this.parser.parseInline(tokens);
      return tokens.length === 1 && tokens[0].type === 'image' ? inner : `<p>${inner}</p>\n`;
    },
  },
});

// 지금 그리는 글에서 몇 번째 사진인지
let photoCount = 0;

export default function Markdown({ source, className = '' }) {
  const images = useSyncExternalStore(subscribeImages, imagesVersion);
  const html = useMemo(() => {
    photoCount = 0; // 글마다 사진 1부터
    return marked.parse(source ?? '');
  }, [source, images]);
  return <div className={`${styles.markdown} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
