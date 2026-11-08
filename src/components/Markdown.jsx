import { useMemo } from 'react';
import { Marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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
    // ![캡션](주소) → 사진 + 캡션
    image({ href, text }) {
      const caption = text ? `<figcaption>${escapeHtml(text)}</figcaption>` : '';
      return `<figure><img src="${escapeHtml(safeUrl(href))}" alt="${escapeHtml(text)}" loading="lazy">${caption}</figure>`;
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

export default function Markdown({ source, className = '' }) {
  const html = useMemo(() => marked.parse(source ?? ''), [source]);
  return <div className={`${styles.markdown} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
