import { describe, it, expect, vi } from 'vitest';
import {
  resolveBookMeta, fillMissingBookMeta, parsePageText, normalizeIsbn, bookMetaCacheKey,
  type BookMetaDeps, type BookMetaEnv,
} from '../lib/bookMeta';
import type { SeojiInfo } from '../lib/nl/api';

/** 서지정보 대역 — 기본은 부가기호만 있는 흔한 경우 */
const sj = (pages: number | null, addCodeKdc: string | null = null, kdc: string | null = null): SeojiInfo => ({ pages, addCodeKdc, kdc, tocUrl: null });
import { genreFromKdc, kdcFromSeoji } from '../lib/nl/kdcGenre';
import { buildGenreMessages } from '../lib/ai/genreSuggestions';
import type { BookMatch } from '../lib/bookLookup';

describe('kdcFromSeoji / genreFromKdc', () => {
  it('KDC 필드가 있으면 그것, 없으면 부가기호 5자리의 뒤 세 자리', () => {
    expect(kdcFromSeoji('03850', '')).toBe('850');
    expect(kdcFromSeoji('14000', '005.1')).toBe('005');
    expect(kdcFromSeoji('', '')).toBeNull();
  });

  // 2026-10-25 실측 classNo(소장자료) 기준
  it.each([
    ['004.73', 'AI/데이터', true], ['005.14', '컴퓨터·프로그래밍', true], ['911.05', '한국사', true],
    ['813.62', '현대문학', true], ['813.7', '현대문학', true], ['813.3', '고전문학', true],
    ['189.2', '심리학', true], ['320.911', '경제/경영', true], ['389', '사회과학', true],
    ['443.1', '과학/수학', true], ['491.51', '과학/수학', true], ['909', '해외사', true], ['230', '종교/영성', true],
    ['340', '정치/법률', true], ['600', '예술/디자인', true], ['700', '인문학', true],
    // 앱 장르가 KDC와 다르게 나뉘는 영역 → LLM 힌트(sure=false)
    ['843.6', '해외문학', false], ['853', '해외문학', false], ['810', '현대문학', false], ['813.5', '현대문학', false],
    ['193', '자기계발', false], ['325.211', '자기계발', false], ['004', '컴퓨터·프로그래밍', false],
    ['904', '해외사', false], ['900', '해외사', false], ['300', '사회과학', false],
  ])('KDC %s → %s (sure=%s)', (code, genre, sure) => {
    expect(genreFromKdc(code)).toMatchObject({ genre, sure });
  });

  it('장르를 정할 수 없는 분류는 genre null + LLM 힌트(총류 000·기술과학·오락·지리·전기)', () => {
    for (const c of ['000', '510', '594', '690', '980', '990']) expect(genreFromKdc(c)).toMatchObject({ genre: null, sure: false });
  });

  it('근거가 약한 분류와 잘못된 값은 null', () => {
    for (const c of ['010', '030', null, 'abc', '12', '81']) expect(genreFromKdc(c)).toBeNull();
  });
});

describe('parsePageText / normalizeIsbn', () => {
  it.each([
    ['239 p.', 239], ['xii, 239p ; 20cm', 239], ['1,024 p.', 1024], ['약 640쪽 내외', 640], ['716', 716],
    [312, 312], ['5', null], ['', null], [undefined, null],
  ])('%s → %s', (input, out) => { expect(parsePageText(input)).toBe(out); });

  it('ISBN은 13자리 우선, 하이픈 제거', () => {
    expect(normalizeIsbn('8937460440 9788937460449')).toBe('9788937460449');
    expect(normalizeIsbn('978-89-374-6044-9')).toBe('9788937460449');
    expect(normalizeIsbn(undefined)).toBe('');
  });
});

describe('buildGenreMessages — 번역자·KDC 힌트와 분류 규칙', () => {
  it('있을 때만 translator·kdc를 넣고, 해외문학·역사 규칙을 담는다', () => {
    const [sys, user] = buildGenreMessages(
      [{ id: 'b', title: '데미안', author: '헤르만 헤세', publisher: '민음사', genre: null, translator: '전영애', kdc: 'KDC 850 외국문학' }],
      new Map([['b', '싱클레어의 성장']]),
    );
    expect(sys!.content).toContain('번역자(translator)가 있거나 외국 작가의 작품이면 "해외문학"');
    expect(sys!.content).toContain('"한국사"');
    expect(JSON.parse(user!.content.split('\n')[1]!)).toMatchObject({ translator: '전영애', kdc: 'KDC 850 외국문학' });
    const [, user2] = buildGenreMessages([{ id: 'c', title: 't', author: null, publisher: null, genre: null }], new Map());
    expect(user2!.content).not.toContain('translator');
  });
});

const MATCH: BookMatch = {
  title: '데미안', author: '헤르만 헤세', contents: '싱클레어가 겪는 성장', isbn: '9788937460449',
  thumbnail: '', publisher: '민음사', url: '', source: 'kakao', translators: '전영애',
};

function setup(over: Partial<BookMetaDeps> = {}) {
  const kv = new Map<string, string>();
  const env = {
    KV: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kv.set(k, v); } },
  } as unknown as BookMetaEnv;
  const deps: BookMetaDeps = {
    seoji: vi.fn(async () => null),
    collection: vi.fn(async () => null),
    openLibrary: vi.fn(async () => null),
    lookup: vi.fn(async () => MATCH),
    classify: vi.fn(async () => '해외문학' as const),
    ...over,
  };
  return { env, kv, deps };
}

describe('resolveBookMeta', () => {
  const Q = { isbn: '9788937460449', title: '데미안', author: '헤르만 헤세' };

  it('쪽수는 국립중앙도서관 우선, 없으면 Open Library', async () => {
    const a = setup({ seoji: vi.fn(async () => sj(248)), openLibrary: vi.fn(async () => 239) });
    expect(await resolveBookMeta(a.env, Q, a.deps)).toMatchObject({ pageCount: 248, pageSource: 'nl' });
    const b = setup({ openLibrary: vi.fn(async () => 239) });
    expect(await resolveBookMeta(b.env, Q, b.deps)).toMatchObject({ pageCount: 239, pageSource: 'openlibrary' });
    const c = setup();
    expect(await resolveBookMeta(c.env, Q, c.deps)).toMatchObject({ pageCount: null, pageSource: null });
  });

  it('KDC가 확실한 분류면 LLM을 부르지 않는다', async () => {
    const s = setup({ seoji: vi.fn(async () => sj(300, '320')) });
    expect(await resolveBookMeta(s.env, Q, s.deps)).toMatchObject({ genre: '경제/경영', genreSource: 'kdc', kdc: '320' });
    expect(s.deps.classify).not.toHaveBeenCalled();
  });

  it('KDC 근거는 소장자료 classNo → 서지정보 KDC → 부가기호 순서(부가기호 000이어도 classNo 004.73이면 AI/데이터)', async () => {
    const a = setup({ seoji: vi.fn(async () => sj(488, '000')), collection: vi.fn(async () => '004.73') });
    expect(await resolveBookMeta(a.env, Q, a.deps)).toMatchObject({ genre: 'AI/데이터', genreSource: 'kdc', kdc: '004.73' });
    expect(a.deps.classify).not.toHaveBeenCalled();
    const b = setup({ seoji: vi.fn(async () => sj(300, '300', '193')) });
    await resolveBookMeta(b.env, Q, b.deps);
    expect(b.deps.classify).toHaveBeenCalledWith(b.env, expect.objectContaining({ kdcLabel: 'KDC 193 윤리학·처세' }));
  });

  it('총류(000)처럼 장르가 없는 KDC는 LLM 힌트만 주고, LLM이 실패하면 장르 null', async () => {
    const s = setup({ seoji: vi.fn(async () => sj(550, '000')), classify: vi.fn(async () => null) });
    expect(await resolveBookMeta(s.env, Q, s.deps)).toMatchObject({ genre: null, genreSource: null, kdc: '000' });
  });

  it('KDC가 애매하면 LLM에 소개·번역자·KDC 힌트를 넘기고, LLM이 실패하면 KDC 대략값', async () => {
    const s = setup({ seoji: vi.fn(async () => sj(248, '850')) });
    expect(await resolveBookMeta(s.env, Q, s.deps)).toMatchObject({ genre: '해외문학', genreSource: 'llm' });
    expect(s.deps.classify).toHaveBeenCalledWith(s.env, expect.objectContaining({
      title: '데미안', translator: '전영애', kdcLabel: 'KDC 850 외국문학', description: '싱클레어가 겪는 성장',
    }));
    const f = setup({ seoji: vi.fn(async () => sj(248, '850')), classify: vi.fn(async () => null) });
    expect(await resolveBookMeta(f.env, Q, f.deps)).toMatchObject({ genre: '해외문학', genreSource: 'kdc-approx' });
  });

  it('KDC가 없으면 LLM만, LLM도 실패하면 장르 null(클라이언트 키워드 추정)', async () => {
    const s = setup({ classify: vi.fn(async () => null) });
    expect(await resolveBookMeta(s.env, Q, s.deps)).toMatchObject({ genre: null, genreSource: null });
  });

  it('장르까지 정한 결과는 ISBN 단위로 캐시해 다시 묻지 않고, 장르를 못 정하면(쪽수만 있어도) 캐시하지 않는다', async () => {
    const s = setup({ openLibrary: vi.fn(async () => 239) });
    await resolveBookMeta(s.env, Q, s.deps);
    await resolveBookMeta(s.env, Q, s.deps);
    expect(s.deps.classify).toHaveBeenCalledTimes(1);
    expect(JSON.parse(s.kv.get(bookMetaCacheKey('9788937460449'))!)).toMatchObject({ pageCount: 239, genre: '해외문학' });
    const pagesOnly = setup({ openLibrary: vi.fn(async () => 239), classify: vi.fn(async () => null) });
    expect(await resolveBookMeta(pagesOnly.env, Q, pagesOnly.deps)).toMatchObject({ pageCount: 239, genre: null });
    expect(pagesOnly.kv.size).toBe(0);
  });

  it('withGenre=false(페이지 수만)면 소개 조회·LLM을 하지 않고 캐시도 남기지 않는다', async () => {
    const s = setup({ openLibrary: vi.fn(async () => 239) });
    expect(await resolveBookMeta(s.env, { ...Q, withGenre: false }, s.deps)).toMatchObject({ pageCount: 239, genre: null });
    expect(s.deps.lookup).not.toHaveBeenCalled();
    expect(s.deps.classify).not.toHaveBeenCalled();
    expect(s.kv.size).toBe(0);
  });

  it('ISBN 없이 제목만 와도 장르는 정한다(캐시는 ISBN이 있을 때만)', async () => {
    const s = setup();
    expect(await resolveBookMeta(s.env, { title: '데미안' }, s.deps)).toMatchObject({ genre: '해외문학', pageCount: null });
    expect(s.deps.seoji).toHaveBeenCalledWith(s.env, '');
    expect(s.kv.size).toBe(0);
  });
});

describe('parseSuggestions — 모델 출력 형식 변형 (2026-10-21 로컬 실측)', () => {
  const rows = [{ id: 'b', title: '클린 코드', author: null, publisher: null, genre: null }];
  it('맨 배열 응답(gemini-lite JSON 모드)도 받는다', async () => {
    const { parseSuggestions } = await import('../lib/ai/genreSuggestions');
    expect(parseSuggestions('[\n  {"id":"b","genre":"컴퓨터·프로그래밍","confidence":"high"}\n]', rows)[0]?.suggested_genre).toBe('컴퓨터·프로그래밍');
    expect(parseSuggestions('```json\n[{"id":"b","genre":"경제/경영"}]\n```', rows)[0]?.suggested_genre).toBe('경제/경영');
  });

  it('장르 표기의 공백 변형("컴퓨터· 프로그래밍", " 경제 / 경영 ")을 목록 표기로 맞춘다', async () => {
    const { parseSuggestions } = await import('../lib/ai/genreSuggestions');
    expect(parseSuggestions('{"suggestions":[{"id":"b","genre":"컴퓨터· 프로그래밍"}]}', rows)[0]?.suggested_genre).toBe('컴퓨터·프로그래밍');
    expect(parseSuggestions('{"suggestions":[{"id":"b","genre":" 경제 / 경영 "}]}', rows)[0]?.suggested_genre).toBe('경제/경영');
  });

  it('형식이 아예 틀리면 빈 결과', async () => {
    const { parseSuggestions, extractSuggestionArray } = await import('../lib/ai/genreSuggestions');
    expect(parseSuggestions('장르는 해외문학입니다', rows)).toEqual([]);
    expect(extractSuggestionArray('{"genre":"x"}')).toBeNull();
  });
});

describe('resolveBookMeta — 동시 진행', () => {
  it('Open Library를 기다리는 동안 LLM 분류가 시작된다(직렬 대기 없음)', async () => {
    const order: string[] = [];
    let releaseOl!: (n: number) => void;
    const kv = new Map<string, string>();
    const env = { KV: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kv.set(k, v); } } } as unknown as BookMetaEnv;
    const deps: BookMetaDeps = {
      seoji: vi.fn(async () => null),
      collection: vi.fn(async () => null),
      openLibrary: vi.fn(() => new Promise<number | null>((r) => { releaseOl = (n) => { order.push('ol-done'); r(n); }; })),
      lookup: vi.fn(async () => MATCH),
      classify: vi.fn(async () => { order.push('classify'); setTimeout(() => releaseOl(239), 0); return '해외문학' as const; }),
    };
    const meta = await resolveBookMeta(env, { isbn: '9788937460449', title: '데미안' }, deps);
    expect(order).toEqual(['classify', 'ol-done']);
    expect(meta).toMatchObject({ pageCount: 239, genre: '해외문학' });
  });
});

describe('resolveBookMeta — 캐시 기간', () => {
  it('쪽수까지 있으면 30일, 쪽수가 없으면 1일만 캐시한다', async () => {
    const ttls: number[] = [];
    const env = { KV: { get: async () => null, put: async (_k: string, _v: string, o: { expirationTtl: number }) => { ttls.push(o.expirationTtl); } } } as unknown as BookMetaEnv;
    const base = { seoji: vi.fn(async () => null), collection: vi.fn(async () => '853'), lookup: vi.fn(async () => MATCH), classify: vi.fn(async () => '해외문학' as const) };
    await resolveBookMeta(env, { isbn: '9788937460449', title: '데미안' }, { ...base, openLibrary: vi.fn(async () => 239) });
    await resolveBookMeta(env, { isbn: '9788937460449', title: '데미안' }, { ...base, openLibrary: vi.fn(async () => null) });
    expect(ttls).toEqual([30 * 24 * 3600, 24 * 3600]);
  });
});

describe('fillMissingBookMeta — 저장 직후 빈 쪽수·기타 장르 보정 (51차)', () => {
  async function db() {
    const { makeSqliteD1 } = await import('./helpers/sqliteD1');
    const d = makeSqliteD1();
    d.raw.exec("CREATE TABLE books (id TEXT PRIMARY KEY, user_id TEXT, genre TEXT NOT NULL DEFAULT '기타', total_pages INTEGER)");
    return d;
  }
  const meta = (genre: string | null, pageCount: number | null) => vi.fn(async () => ({ pageCount, pageSource: null, genre, genreSource: null, kdc: null }) as never);
  const row = (d: Awaited<ReturnType<typeof db>>, id: string) => d.raw.prepare('SELECT genre, total_pages FROM books WHERE id = ?').get(id) as { genre: string; total_pages: number | null };
  const T = { id: 'b1', userId: 'u1', isbn: '9788937460449', title: '데미안', needGenre: true, needPages: true };

  it('기타 장르와 빈 쪽수를 채운다', async () => {
    const d = await db();
    d.raw.exec("INSERT INTO books VALUES ('b1','u1','기타',NULL)");
    const env = { DB: d, KV: { get: async () => null, put: async () => {} } } as unknown as Parameters<typeof fillMissingBookMeta>[0];
    expect(await fillMissingBookMeta(env, T, meta('해외문학', 248))).toBe(2);
    expect(row(d, 'b1')).toEqual({ genre: '해외문학', total_pages: 248 });
  });

  it('그사이 사용자가 바꾼 장르·쪽수는 덮어쓰지 않는다', async () => {
    const d = await db();
    d.raw.exec("INSERT INTO books VALUES ('b1','u1','철학',300)");
    const env = { DB: d, KV: { get: async () => null, put: async () => {} } } as unknown as Parameters<typeof fillMissingBookMeta>[0];
    await fillMissingBookMeta(env, T, meta('해외문학', 248));
    expect(row(d, 'b1')).toEqual({ genre: '철학', total_pages: 300 });
  });

  it('필요한 칸만 조회하고(장르 불필요면 AI 없음), 다른 사용자의 책은 건드리지 않는다', async () => {
    const d = await db();
    d.raw.exec("INSERT INTO books VALUES ('b1','u2','기타',NULL)");
    const env = { DB: d, KV: { get: async () => null, put: async () => {} } } as unknown as Parameters<typeof fillMissingBookMeta>[0];
    const r = meta('해외문학', 248);
    await fillMissingBookMeta(env, { ...T, needGenre: false }, r);
    expect(r).toHaveBeenCalledWith(env, expect.objectContaining({ withGenre: false }));
    expect(row(d, 'b1')).toEqual({ genre: '기타', total_pages: null });
  });

  it('채울 게 없으면 조회하지 않고, 조회 실패해도 던지지 않는다', async () => {
    const d = await db();
    const env = { DB: d, KV: { get: async () => null, put: async () => {} } } as unknown as Parameters<typeof fillMissingBookMeta>[0];
    const r = meta('해외문학', 248);
    expect(await fillMissingBookMeta(env, { ...T, needGenre: false, needPages: false }, r)).toBe(0);
    expect(r).not.toHaveBeenCalled();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await fillMissingBookMeta(env, T, vi.fn(async () => { throw new Error('boom'); }) as never)).toBe(0);
    spy.mockRestore();
  });
});
