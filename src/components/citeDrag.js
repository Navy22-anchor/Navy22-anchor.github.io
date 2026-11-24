// 미리보기에서 숫자 동그라미를 끌 때: 마우스가 가리키는 글자 자리 → 마크다운 원문 자리
// 그려진 문단의 글자와 원문의 글자를 앞에서부터 맞춰 봄 (서식 기호·태그는 건너뜀, 수식 $…$ 은 한 덩어리)
const BLOCK = 'p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6';
const ATOM = '￼'; // 수식 한 덩어리

// 마우스 아래 글자 자리
function caretAt(x, y) {
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    return p && { node: p.offsetNode, offset: p.offset };
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r && { node: r.startContainer, offset: r.startOffset };
}

// 그려진 문단을 글자 조각으로: 글자 노드, 수식(한 글자로 침). 숫자 동그라미는 뺌
function renderedUnits(block) {
  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out.push({ node: child, text: child.data });
      else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.matches('sup[data-cite]')) continue;
        if (child.classList.contains('katex')) out.push({ node: child, text: ATOM, atomic: true });
        else walk(child);
      }
    }
  };
  walk(block);
  return out;
}

// (node, offset) 자리 앞에 그려진 글자가 몇 개인지
function indexAt(units, node, offset, x) {
  const point = document.createRange();
  point.setStart(node, offset);
  let count = 0;
  for (const u of units) {
    if (u.atomic && u.node.contains(node)) {
      const r = u.node.getBoundingClientRect();
      return count + (x > r.left + r.width / 2 ? 1 : 0); // 수식 가운데보다 오른쪽이면 수식 뒤
    }
    if (u.node === node) return count + offset;
    if (point.comparePoint(u.node, 0) === 1) return count; // 이 조각이 자리보다 뒤에서 시작
    count += u.text.length;
  }
  return count;
}

// 원문을 글자 조각으로: 태그는 건너뛰고, \* 같은 escape는 한 글자, $수식$ 은 한 덩어리
function sourceUnits(src, from, to) {
  const out = [];
  let i = from;
  while (i < to) {
    const tag = /^<\/?[a-zA-Z][^<>]*>/.exec(src.slice(i, to));
    if (tag) {
      i += tag[0].length;
      continue;
    }
    if (src[i] === '\\' && /[!-/:-@[-`{-~]/.test(src[i + 1] ?? '')) {
      out.push({ ch: src[i + 1], start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (src[i] === '$' && src[i + 1] !== '$') {
      const close = src.indexOf('$', i + 1);
      const nl = src.indexOf('\n', i + 1);
      if (close > i + 1 && close < to && (nl === -1 || close < nl)) {
        out.push({ ch: ATOM, start: i, end: close + 1 });
        i = close + 1;
        continue;
      }
    }
    out.push({ ch: src[i], start: i, end: i + 1 });
    i += 1;
  }
  return out;
}

// 밑줄을 뗀 원문(plain)에서, 마우스 (x, y)를 밑줄 끝으로 할 때의 자리. 못 정하면 null, 끝까지 줄였으면 -1
// start: 밑줄 시작(원문 자리), index: 글 안에서 몇 번째 인용인지
export function citeEndAt(root, index, plain, start, x, y) {
  const span = root.querySelector(`span[data-cite="${index}"]`);
  if (!span) return null;
  const block = span.closest(BLOCK) ?? span.parentElement;
  const caret = caretAt(x, y);
  if (!caret || !block.contains(caret.node)) return null;

  const units = renderedUnits(block);
  const from = indexAt(units, span, 0, x); // 밑줄이 시작하는 그려진 자리
  const at = indexAt(units, caret.node, caret.offset, x) - from;
  if (at <= 0) return -1; // 밑줄 시작점까지(또는 그 앞으로) 줄임 → 지움

  const rendered = units.map((u) => u.text).join('').slice(from);
  const paraEnd = plain.indexOf('\n\n', start);
  const src = sourceUnits(plain, start, paraEnd === -1 ? plain.length : paraEnd);
  // 그려진 글자마다 원문 조각을 앞에서부터 짝지음 (짝이 없는 원문 조각은 서식 기호)
  const match = [];
  for (const u of src) {
    if (match.length >= rendered.length) break;
    if (u.ch === rendered[match.length]) match.push(u);
  }
  // 끝: 다음 글자 바로 앞 (닫는 ** 같은 기호까지 안에 들어가게). 문단 끝이면 마지막 글자 뒤
  if (at < rendered.length) return match[at]?.start ?? null;
  return match.at(-1)?.end ?? null;
}
