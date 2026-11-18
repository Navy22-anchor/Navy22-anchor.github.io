import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { postBody, postMeta } from '../data/postMeta.js';

// 빌드할 때(npm run build) 글마다 진짜 주소의 페이지와 사이트맵을 만듦 (vite.config.js에서 씀)
//
// GitHub Pages는 실제 파일이 있는 주소만 열어 줌. 그래서 # 없는 주소(/post/<id>, /write …)로 바로 들어와도 열리게:
// - 글마다 dist/post/<id>/index.html: 앱(index.html) 복사본에 제목·설명·대표 주소(canonical)를 글에 맞게 바꾸고,
//   #root 안에 글 제목·날짜·본문 글자를 미리 넣어 둠 (자바스크립트를 안 돌리는 검색엔진도 읽도록. 앱이 뜨면 바로 바뀜)
// - dist/404.html: 앱 복사본. 그 밖의 주소(/write, /login, /shelf/… 등)는 GitHub Pages가 이걸 주고, 앱이 주소를 보고 화면을 고름
// 그리고 dist/sitemap.xml 에 홈과 모든 글 주소를 적음 (public/robots.txt 가 위치를 알려 줌)

export const SITE = 'https://navy22-anchor.github.io';

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 마크다운 → 검색엔진용 단순 HTML (제목은 h2, 나머지는 문단 글자만. 수식·코드·사진·태그는 뺌)
function plainHtml(markdown) {
  return markdown
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = /^#{1,6}\s+(.*)$/.exec(block);
      if (heading) return `<h2>${escapeHtml(heading[1].replace(/[*_`~$]/g, ''))}</h2>`;
      const text = block
        .replace(/^\s{0,3}(>|[-*+]|\d+\.)\s+/gm, '')
        .replace(/[*_`~$]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return text ? `<p>${escapeHtml(text)}</p>` : '';
    })
    .join('\n');
}

// "2026.11.12 23:40" → "2026-11-12"
const isoDate = (date) => /^(\d{4})\.(\d{2})\.(\d{2})/.exec(date)?.slice(1).join('-') ?? null;

function postPage(template, post, body) {
  const url = `${SITE}/post/${encodeURIComponent(post.id)}/`;
  const title = `${post.title} - Hanlog`;
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(post.excerpt)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeHtml(post.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(post.excerpt)}" />`,
    `<meta property="og:url" content="${url}" />`,
  ].join('\n    ');
  const article = [
    '<article>',
    `<h1>${escapeHtml(post.title)}</h1>`,
    post.date ? `<p><time datetime="${isoDate(post.date) ?? ''}">${escapeHtml(post.date)}</time></p>` : '',
    plainHtml(body),
    '</article>',
  ].join('\n');
  return template
    .replace(/<title>[^<]*<\/title>/, head)
    .replace('<div id="root"></div>', `<div id="root">${article}</div>`);
}

function sitemap(entries) {
  const urls = entries
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function postPages(postsDir) {
  let outDir;
  return {
    name: 'hanlog-post-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const template = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      writeFileSync(resolve(outDir, '404.html'), template);
      let names = [];
      try {
        names = readdirSync(postsDir).filter((name) => name.endsWith('.md'));
      } catch {
        // 글 폴더가 없으면 홈만
      }
      const posts = names.map((name) => {
        const id = name.replace(/\.md$/, '');
        const text = readFileSync(resolve(postsDir, name), 'utf8');
        return { meta: postMeta(id, text), body: postBody(text) };
      });

      for (const { meta, body } of posts) {
        const dir = resolve(outDir, 'post', meta.id);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'index.html'), postPage(template, meta, body));
      }

      const dates = posts.map(({ meta }) => isoDate(meta.date)).filter(Boolean).sort();
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        sitemap([
          { loc: `${SITE}/`, lastmod: dates.at(-1) },
          ...posts.map(({ meta }) => ({
            loc: `${SITE}/post/${encodeURIComponent(meta.id)}/`,
            lastmod: isoDate(meta.date),
          })),
        ]),
      );
    },
  };
}
