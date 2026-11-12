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

// 글 안의 HTML은 안전한 것만 살림 (나머지 태그·속성은 글자로 보여 줌)
//   <img src width height align alt>  : 사진 주소는 https:// 이거나 이 사이트(/로 시작)만
//   <span style="color: …">           : 글자 색만
//   <br>
const ATTR = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const SIZE = /^\d+(\.\d+)?(%|px)?$/;
const ALIGN = /^(left|right|center|middle|top|bottom)$/i;
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla)\([\d\s.,%/]+\))$/i;

function attrsOf(source) {
  const attrs = {};
  for (const m of source.matchAll(ATTR)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function safeTag(tag) {
  const m = /^<(\/?)([a-zA-Z]+)([^>]*?)\/?>$/.exec(tag);
  if (!m) return null;
  const [, closing, rawName, rest] = m;
  const name = rawName.toLowerCase();
  if (name === 'br' && !closing) return '<br>';
  if (name === 'span') {
    if (closing) return '</span>';
    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(attrsOf(rest).style ?? '')?.[1].trim();
    return color && COLOR.test(color) ? `<span style="color: ${color}">` : '<span>';
  }
  if (name === 'img' && !closing) {
    const a = attrsOf(rest);
    const src = (a.src ?? '').trim();
    if (!/^(https:\/\/|\/(?!\/))/i.test(src)) return null;
    let out = `<img src="${escapeHtml(localImageUrl(src) ?? src)}" alt="${escapeHtml(a.alt ?? '')}" loading="lazy"`;
    if (SIZE.test(a.width ?? '')) out += ` width="${a.width}"`;
    // % 높이는 뺌: 본문(flex 칸)에서는 문단 높이에 대한 %로 계산돼 사진 아래에 큰 빈칸이 생김.
    // velog처럼 폭과 사진 비율로 높이를 정함
    if (SIZE.test(a.height ?? '') && !a.height.endsWith('%')) out += ` height="${a.height}"`;
    if (ALIGN.test(a.align ?? '')) out += ` align="${a.align.toLowerCase()}"`;
    return `${out}>`;
  }
  return null;
}

// 태그마다 안전한지 보고, 아니면 글자로. 태그 밖 글자도 그대로 글자로
const safeHtml = (text) =>
  text
    .split(/(<[^<>]*>)/)
    .map((part) => (part.startsWith('<') ? (safeTag(part) ?? escapeHtml(part)) : escapeHtml(part)))
    .join('');

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
    // 글 안의 HTML: 안전한 태그만 살림. 블록(줄 전체가 HTML)은 감싸서 사진을 양옆으로 띄울 수 있게
    html: ({ text, block }) => (block ? `<div class="${styles.htmlBlock}">${safeHtml(text)}</div>` : safeHtml(text)),
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
