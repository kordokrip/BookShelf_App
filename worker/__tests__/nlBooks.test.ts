import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  parseCollectionBooks, cleanNlTitle, cleanPublisher, cleanIsbn, cleanNlDate, coverUrl, searchNlBooks, nlBookByIsbn,
} from '../lib/nl/books';
import { searchRouter } from '../routes/search';
import { createToken } from '../auth';
import type { Bindings } from '../types';
import { makeSqliteD1 } from './helpers/sqliteD1';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// 2026-10-25 실제 소장자료 응답에서 필드만 추린 픽스처
const COLLECTION = {
  total: 36,
  result: [
    { titleInfo: '<span class="searching_txt">채식주의자</span> : 한강 장편소설', authorInfo: '지은이: 한강', pubInfo: '창비', isbn: '9788936434595', pubYearInfo: '2022', typeName: '도서', imageUrl: 'kolis/2022/KMO20221903501_thumbnail.jpg' },
    { titleInfo: '(완벽한 프로그래머가 되는 법) 클린코드 / 로버트 C. 마틴 지음', authorInfo: '로버트 C. 마틴 지음 ;박재호,이해영 옮김', pubInfo: '서울 : 케이앤피북스, 2010', isbn: '8964200371 9788964200377', pubYearInfo: '2010', typeName: '도서', imageUrl: '' },
    { titleInfo: '사피엔스 : 그래픽 히스토리', authorInfo: '유발 하라리', pubInfo: '김영사', isbn: '9788934991311(세트)', pubYearInfo: '20202024', typeName: '도서' },
    { titleInfo: '어떤 신문', authorInfo: '', pubInfo: '', isbn: '', typeName: '연속간행물' },
  ],
};

describe('국립중앙도서관 소장자료 정리', () => {
  it('강조 태그·앞 괄호 수식어·책임표시를 지우고, 출판사·ISBN·연도·표지를 정리한다', () => {
    const books = parseCollectionBooks(COLLECTION);
    expect(books).toHaveLength(3); // 연속간행물 제외
    expect(books[0]).toEqual({
      title: '채식주의자 : 한강 장편소설', author: '한강', publisher: '창비', isbn: '9788936434595',
      publishedDate: '2022', thumbnail: 'https://cover.nl.go.kr/kolis/2022/KMO20221903501_thumbnail.jpg', pageCount: null,
    });
    expect(books[1]).toMatchObject({ title: '클린코드', author: '로버트 C. 마틴, 박재호, 이해영', publisher: '케이앤피북스', isbn: '9788964200377', thumbnail: '' });
    expect(books[2]).toMatchObject({ isbn: '9788934991311', publishedDate: '2020' }); // 연도 범위 "2020-2024"
  });

  it.each([
    ['20220328', '2022-03-28'], ['2022', '2022'], ['20202024', '2020'], ['', null], ['abcd', null], ['0000', null],
  ])('cleanNlDate(%s) → %s', (raw, out) => { expect(cleanNlDate(raw)).toBe(out); });

  it('개별 정리 함수', () => {
    expect(cleanNlTitle('데미안')).toBe('데미안');
    expect(cleanPublisher('(주)을유문화사')).toBe('(주)을유문화사');
    expect(cleanIsbn('8937460009 8937460440')).toBe('8937460009');
    expect(cleanIsbn('')).toBe('');
    expect(coverUrl('http://www.nl.go.kr/seoji/fu/ecip/dbfiles/CIP_FILES_TBL/1_3.jpg')).toBe('https://www.nl.go.kr/seoji/fu/ecip/dbfiles/CIP_FILES_TBL/1_3.jpg');
    expect(coverUrl('/kolis/x.jpg')).toBe('https://cover.nl.go.kr/kolis/x.jpg');
    expect(coverUrl(undefined)).toBe('');
  });
});

describe('searchNlBooks / nlBookByIsbn', () => {
  it('키가 없으면 요청하지 않는다', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await searchNlBooks({}, '데미안')).toEqual({ books: [], total: 0 });
    expect(await nlBookByIsbn({}, '9788936434595')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('키워드 검색: 소장자료 도서 분류·정확도순, total을 돌려준다', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(COLLECTION), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await searchNlBooks({ NL_CERT_KEY: 'k' }, ' 채식주의자 한강 ', 5, 2);
    expect(r.total).toBe(36);
    const url = new URL(String((f.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/NL/search/openApi/search.do');
    expect(url.searchParams.get('kwd')).toBe('채식주의자 한강');
    expect(url.searchParams.get('category')).toBe('도서');
    expect(url.searchParams.get('pageNum')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('5');
  });

  it('ISBN: 소장자료 제목·표지 + 서지정보 쪽수·출간일을 합친다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (String(u).includes('seoji')
      ? new Response(JSON.stringify({ TOTAL_COUNT: '1', docs: [{ TITLE: '채식주의자', AUTHOR: '저자 : 한강', PUBLISHER: '(주)창비', PAGE: '276 p.', REAL_PUBLISH_DATE: '20220328', TITLE_URL: '' }] }), { status: 200 })
      : new Response(JSON.stringify(COLLECTION), { status: 200 }))));
    expect(await nlBookByIsbn({ NL_CERT_KEY: 'k' }, '9788936434595')).toEqual({
      title: '채식주의자 : 한강 장편소설', author: '한강', publisher: '창비', isbn: '9788936434595', publishedDate: '2022-03-28',
      thumbnail: 'https://cover.nl.go.kr/kolis/2022/KMO20221903501_thumbnail.jpg', pageCount: 276,
    });
  });

  it('ISBN: 소장자료에 없으면 서지정보만으로, 둘 다 없으면 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (String(u).includes('seoji')
      ? new Response(JSON.stringify({ docs: [{ TITLE: '새 책 : 부제', AUTHOR: '저자 : 홍길동;역자 : 김옮김', PUBLISHER: '출판사', PAGE: '', PUBLISH_PREDATE: '20261101', TITLE_URL: 'http://www.nl.go.kr/seoji/a.jpg' }] }), { status: 200 })
      : new Response(JSON.stringify({ total: 0, result: [] }), { status: 200 }))));
    expect(await nlBookByIsbn({ NL_CERT_KEY: 'k' }, '9791100000000')).toMatchObject({
      title: '새 책 : 부제', author: '홍길동, 김옮김', publishedDate: '2026-11-01', thumbnail: 'https://www.nl.go.kr/seoji/a.jpg', pageCount: null,
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ docs: [], result: [] }), { status: 200 })));
    expect(await nlBookByIsbn({ NL_CERT_KEY: 'k' }, '9791100000000')).toBeNull();
  });
});

describe('검색 라우트 — 카카오 실패·0건이면 국립중앙도서관 (네이버 책 API 대체, 52차)', () => {
  async function call(path: string, fetchImpl: (u: string) => Response) {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => fetchImpl(String(u))));
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/search', searchRouter);
    const env = { DB: makeSqliteD1(), KV: { get: async () => null, put: async () => {} }, JWT_SECRET: 'test-secret', KAKAO_REST_API_KEY: 'kk', NL_CERT_KEY: 'k' } as unknown as Bindings;
    const token = await createToken({ sub: 'u1', email: 'u1@t.dev' }, 'test-secret');
    const res = await app.request(path, { headers: { Authorization: `Bearer ${token}` } }, env);
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  }
  const kakaoDoc = { title: '채식주의자', authors: ['한강'], isbn: '8936434594 9788936434595', thumbnail: 'https://search1.kakaocdn.net/x.jpg', publisher: '창비', datetime: '2022-03-28T00:00:00.000+09:00', contents: '소개', url: '', translators: [], price: 0, sale_price: 0, status: '' };

  it('카카오가 결과를 주면 카카오만 쓴다(국립중앙도서관 호출 없음)', async () => {
    let nlCalls = 0;
    const r = await call('/api/search/books?q=' + encodeURIComponent('채식주의자'), (u) => {
      if (u.includes('nl.go.kr')) nlCalls++;
      return new Response(JSON.stringify({ documents: [kakaoDoc], meta: { total_count: 1, pageable_count: 1, is_end: true } }), { status: 200 });
    });
    expect(r.status).toBe(200);
    expect((r.body.books as Array<{ title: string }>)[0]!.title).toBe('채식주의자');
    expect(nlCalls).toBe(0);
  });

  it('카카오 오류면 국립중앙도서관 결과(표지는 프록시, 소개 없음)', async () => {
    const r = await call('/api/search/books?q=' + encodeURIComponent('채식주의자') + '&size=5', (u) =>
      (u.includes('kakao') ? new Response('x', { status: 500 }) : new Response(JSON.stringify(COLLECTION), { status: 200 })));
    expect(r.status).toBe(200);
    const books = r.body.books as Array<Record<string, unknown>>;
    expect(books[0]).toMatchObject({ title: '채식주의자 : 한강 장편소설', author: '한강', description: null });
    expect(String(books[0]!.coverImage)).toContain('/api/cover-proxy?url=https%3A%2F%2Fcover.nl.go.kr');
    expect(r.body).toMatchObject({ total: 36, isEnd: false });
  });

  it('둘 다 실패면 502', async () => {
    const r = await call('/api/search/books?q=x', () => new Response('x', { status: 500 }));
    expect(r.status).toBe(502);
  });

  it('ISBN: 카카오에 없으면 국립중앙도서관(쪽수 포함)', async () => {
    const r = await call('/api/search/books/isbn?isbn=9788936434595', (u) => {
      if (u.includes('kakao')) return new Response(JSON.stringify({ documents: [], meta: { total_count: 0, pageable_count: 0, is_end: true } }), { status: 200 });
      if (u.includes('seoji')) return new Response(JSON.stringify({ docs: [{ TITLE: '채식주의자', PAGE: '276 p.', REAL_PUBLISH_DATE: '20220328' }] }), { status: 200 });
      return new Response(JSON.stringify(COLLECTION), { status: 200 });
    });
    expect(r.status).toBe(200);
    expect(r.body.book).toMatchObject({ title: '채식주의자 : 한강 장편소설', pageCount: 276, publishedDate: '2022-03-28' });
  });
});
