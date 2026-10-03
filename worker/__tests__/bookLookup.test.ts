import { describe, it, expect, vi, afterEach } from 'vitest';
import { LOOKUP_TIMEOUT_MS, searchBook, titleSimilarity, authorsOverlap, pickIsbn } from '../lib/bookLookup';

afterEach(() => { vi.unstubAllGlobals(); });

const doc = (over: Record<string, unknown> = {}) => ({
  title: '데미안', contents: '싱클레어가 겪는 성장 이야기를 다룬 헤세의 장편소설입니다.', url: 'https://k/1',
  isbn: '8937460777 9788937460777', authors: ['헤르만 헤세'], publisher: '민음사', thumbnail: 'https://t/1.jpg', ...over,
});
const kakao = (docs: unknown[]) => vi.fn(async () => new Response(JSON.stringify({ documents: docs }), { status: 200 }));
const ENV = { KAKAO_REST_API_KEY: 'k' };

describe('유사도 헬퍼', () => {
  it('titleSimilarity: 동일·부제·무관', () => {
    expect(titleSimilarity('데미안', '데미안')).toBe(1);
    expect(titleSimilarity('데미안', '데미안 (개정판)')).toBeGreaterThanOrEqual(0.85);
    expect(titleSimilarity('데미안', '해리포터와 마법사의 돌')).toBeLessThan(0.5);
  });
  it('authorsOverlap / pickIsbn', () => {
    expect(authorsOverlap('헤르만 헤세', ['헤르만 헤세', '전영애'])).toBe(true);
    expect(authorsOverlap('한강', ['최은영'])).toBe(false);
    expect(authorsOverlap(undefined, ['한강'])).toBe(false);
    expect(pickIsbn('8937460777 9788937460777')).toBe('9788937460777');
  });
});

describe('searchBook', () => {
  it('제목·저자가 맞는 결과를 반환(소개·ISBN13·표지 포함)', async () => {
    vi.stubGlobal('fetch', kakao([doc()]));
    const m = await searchBook(ENV, { title: '데미안', author: '헤르만 헤세' });
    expect(m).toMatchObject({ isbn: '9788937460777', publisher: '민음사', thumbnail: 'https://t/1.jpg', source: 'kakao' });
    expect(m?.contents).toContain('싱클레어');
  });

  it('첫 결과가 엉뚱한 책이면 건너뛰고 맞는 책을 고른다', async () => {
    vi.stubGlobal('fetch', kakao([doc({ title: '해리포터와 마법사의 돌', authors: ['J.K. 롤링'] }), doc()]));
    expect((await searchBook(ENV, { title: '데미안', author: '헤르만 헤세' }))?.title).toBe('데미안');
  });

  it('일치하는 책이 없으면 null (환각 제목 검증)', async () => {
    vi.stubGlobal('fetch', kakao([doc({ title: '전혀 다른 책', authors: ['아무개'] })]));
    expect(await searchBook(ENV, { title: '존재하지않는유령의서재', author: '가짜' })).toBeNull();
  });

  it('ISBN이 있으면 target=isbn으로 조회', async () => {
    const f = kakao([doc()]);
    vi.stubGlobal('fetch', f);
    await searchBook(ENV, { title: '데미안', author: '헤세', isbn: '9788937460777' });
    const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get('target')).toBe('isbn');
    expect(url.searchParams.get('query')).toBe('9788937460777');
  });

  it('키 없음/HTTP 오류/네트워크 예외는 null', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(await searchBook({}, { title: '데미안' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    expect(await searchBook(ENV, { title: '데미안' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }));
    expect(await searchBook(ENV, { title: '데미안' })).toBeNull();
  });

  it('카카오 실패 시 네이버로 폴백(HTML 태그 제거, ^ 저자 구분)', async () => {
    const f = vi.fn(async (u: string) => u.includes('kakao')
      ? new Response('x', { status: 500 })
      : new Response(JSON.stringify({ items: [{ title: '<b>데미안</b>', author: '헤르만 헤세^전영애', description: '<b>성장</b> 소설 소개 문장입니다 충분히 길게.', isbn: '8937460777 9788937460777', publisher: '민음사', image: 'i', link: 'l' }] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const m = await searchBook({ ...ENV, NAVER_CLIENT_ID: 'a', NAVER_CLIENT_SECRET: 'b' }, { title: '데미안', author: '헤르만 헤세' });
    expect(m).toMatchObject({ title: '데미안', author: '헤르만 헤세, 전영애', source: 'naver' });
    expect(m?.contents).toBe('성장 소설 소개 문장입니다 충분히 길게.');
  });

  it('카카오가 맞으면 네이버는 호출하지 않는다', async () => {
    const f = kakao([doc()]);
    vi.stubGlobal('fetch', f);
    await searchBook({ ...ENV, NAVER_CLIENT_ID: 'a', NAVER_CLIENT_SECRET: 'b' }, { title: '데미안', author: '헤르만 헤세' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('응답 없는 조회는 타임아웃(AbortController)으로 끊고 null', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_r, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      })));
      const p = searchBook(ENV, { title: '데미안' });
      await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS + 10);
      expect(await p).toBeNull();
      expect(LOOKUP_TIMEOUT_MS).toBeLessThanOrEqual(4000);
    } finally { vi.useRealTimers(); }
  });
});
