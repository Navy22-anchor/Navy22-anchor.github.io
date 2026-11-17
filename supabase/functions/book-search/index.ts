// 책 검색 중계: 카카오 책 검색 키는 이 함수(Supabase 서버)에만 두고, 블로그 코드에는 넣지 않음
// 블로그 → GET .../functions/v1/book-search?query=검색어 → 카카오 → 결과
// 로그인한 주인(owners 표)만 부를 수 있음. 키는 `supabase secrets set KAKAO_REST_KEY=...` 로 넣음
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// 카카오 썸네일은 작은 사본(120px)이라, 주소 안의 원본(fname)이 있으면 그걸 씀
function bigCover(thumbnail: string) {
  if (!thumbnail) return '';
  try {
    const original = new URL(thumbnail).searchParams.get('fname');
    if (original) return original.replace(/^http:/, 'https:');
  } catch {
    // 주소가 이상하면 받은 그대로
  }
  return thumbnail.replace(/^http:/, 'https:');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'GET만 받습니다' }, 405);

  // 부른 사람이 주인인지 (블로그의 is_owner() 함수로 확인)
  const auth = req.headers.get('Authorization') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: owner } = await db.rpc('is_owner');
  if (owner !== true) return json({ error: '로그인한 주인만 검색할 수 있습니다' }, 403);

  // 검색어는 주소 뒤 ?query= 로 받음
  const q = (new URL(req.url).searchParams.get('query') ?? '').trim().slice(0, 100);
  if (!q) return json({ books: [] });

  const key = Deno.env.get('KAKAO_REST_KEY');
  if (!key) return json({ error: 'KAKAO_REST_KEY가 설정되지 않았습니다' }, 500);

  const res = await fetch(`https://dapi.kakao.com/v3/search/book?size=10&query=${encodeURIComponent(q)}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) return json({ error: `카카오 검색 실패 (${res.status})` }, 502);
  const { documents = [] } = await res.json();

  // 블로그에 필요한 것만
  const books = documents.map((d: Record<string, unknown>) => ({
    isbn: String(d.isbn ?? '').split(' ').filter(Boolean).pop() ?? '',
    title: String(d.title ?? ''),
    authors: (d.authors as string[] | undefined)?.join(', ') ?? '',
    publisher: String(d.publisher ?? ''),
    year: String(d.datetime ?? '').slice(0, 4),
    thumbnail: String(d.thumbnail ?? '').replace(/^http:/, 'https:'),
    cover: bigCover(String(d.thumbnail ?? '')),
  }));
  return json({ books });
});
