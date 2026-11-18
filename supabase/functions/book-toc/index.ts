// 책 목차 중계: 국립중앙도서관 ISBN 서지정보 API(https://www.nl.go.kr/seoji/SearchApi.do)에서 목차를 받아 옴
// 키는 이 함수(Supabase 서버)에만 두고, 블로그 코드에는 넣지 않음
// 블로그 → GET .../functions/v1/book-toc?isbn=9791140715848&title=책제목 → 국립중앙도서관 → { toc, title, isbn }
// 로그인한 주인(owners 표)만 부를 수 있음. 키는 `supabase secrets set NATIONAL_LIBRARY_KEY=...` 로 넣음
//
// 목차는 두 가지로 옴
// - BOOK_TB_CNT: 목차 글자 그대로
// - BOOK_TB_CNT_URL: 목차 txt 파일 주소 (2021년 2월까지 만든 자료, 파일은 EUC-KR)
// 출판사가 목차를 내지 않은 책은 둘 다 비어 있음 → toc: ''
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Doc = Record<string, string | undefined>;

async function search(key: string, field: 'isbn' | 'title', value: string): Promise<Doc[]> {
  const url = new URL('https://www.nl.go.kr/seoji/SearchApi.do');
  url.searchParams.set('cert_key', key);
  url.searchParams.set('result_style', 'json');
  url.searchParams.set('page_no', '1');
  url.searchParams.set('page_size', '20');
  url.searchParams.set(field, value);
  const res = await fetch(url);
  const raw = await res.text();
  // 키가 로그에 남지 않게 주소는 빼고 결과만
  console.log(`[book-toc] ${field}="${value}" status=${res.status} length=${raw.length}`);
  if (!res.ok) throw new Error(`국립중앙도서관 검색 실패 (${res.status})`);
  const body = JSON.parse(raw);
  if (body.RESULT === 'ERROR' || body.ERR_CODE) throw new Error(body.ERR_MESSAGE ?? '국립중앙도서관 검색 실패');
  return body.docs ?? [];
}

// 목차 파일: 대부분 EUC-KR. UTF-8로 읽어서 깨지면(�) EUC-KR로 다시 읽음
async function download(url: string) {
  const res = await fetch(url.replace(/^http:/, 'https:'));
  if (!res.ok) return '';
  const bytes = new Uint8Array(await res.arrayBuffer());
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('�') ? new TextDecoder('euc-kr').decode(bytes) : utf8;
}

// 줄바꿈 정리. 줄바꿈 없이 "…안내chapter 02. …"처럼 붙어 오면 장마다 나눔
function tidy(text: string) {
  let t = text.replace(/\r\n?/g, '\n').replace(/<br\s*\/?>/gi, '\n');
  if (!t.includes('\n')) t = t.replace(/(?<=\S)(?=(?:chapter|part)\s*\d)/gi, '\n');
  return t
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const digits = (isbn = '') => isbn.replace(/[^0-9Xx]/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'GET만 받습니다' }, 405);

  // 부른 사람이 주인인지 (블로그의 is_owner() 함수로 확인)
  const auth = req.headers.get('Authorization') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: owner } = await db.rpc('is_owner');
  if (owner !== true) return json({ error: '로그인한 주인만 목차를 가져올 수 있습니다' }, 403);

  const params = new URL(req.url).searchParams;
  const isbn = digits(params.get('isbn') ?? '').slice(0, 13);
  const title = (params.get('title') ?? '').trim().slice(0, 100);
  if (!isbn && !title) return json({ error: 'isbn이나 title이 필요합니다' }, 400);

  const key = Deno.env.get('NATIONAL_LIBRARY_KEY');
  if (!key) return json({ error: 'NATIONAL_LIBRARY_KEY가 설정되지 않았습니다' }, 500);

  try {
    // ISBN으로 먼저, 목차가 없으면 제목으로 (전자책·개정판 등 같은 책의 다른 판에 목차가 있을 때가 있음)
    let docs = isbn ? await search(key, 'isbn', isbn) : [];
    const hasToc = (d: Doc) => !!(d.BOOK_TB_CNT?.trim() || d.BOOK_TB_CNT_URL?.trim());
    if (!docs.some(hasToc) && title) docs = [...docs, ...(await search(key, 'title', title))];

    // 같은 ISBN을 먼저, 그다음 목차가 있는 아무 판
    const ranked = docs.filter(hasToc).sort((a, b) => Number(digits(b.EA_ISBN) === isbn) - Number(digits(a.EA_ISBN) === isbn));
    for (const doc of ranked) {
      const text = doc.BOOK_TB_CNT?.trim() ? doc.BOOK_TB_CNT : await download(doc.BOOK_TB_CNT_URL!);
      const toc = tidy(text ?? '');
      if (toc) return json({ toc, title: doc.TITLE ?? '', isbn: doc.EA_ISBN ?? '' });
    }
    return json({ toc: '', title: docs[0]?.TITLE ?? '', isbn: docs[0]?.EA_ISBN ?? '' });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
});
