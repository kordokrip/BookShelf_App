import { describe, it, expect, vi } from 'vitest';
import {
  resolveBookMeta, parsePageText, parseSeoji, normalizeIsbn, bookMetaCacheKey,
  type BookMetaDeps, type BookMetaEnv,
} from '../lib/bookMeta';
import { genreFromKdc, kdcFromSeoji } from '../lib/kdcGenre';
import { buildGenreMessages } from '../lib/ai/genreSuggestions';
import type { BookMatch } from '../lib/bookLookup';

describe('kdcFromSeoji / genreFromKdc', () => {
  it('부가기호 5자리의 뒤 세 자리가 KDC 내용분류', () => {
    expect(kdcFromSeoji('03850', '')).toBe('850');
    expect(kdcFromSeoji('', '853.6')).toBe('853');
    expect(kdcFromSeoji('', '')).toBeNull();
  });

  it.each([
    ['180', '심리학', true], ['100', '철학', true], ['230', '종교/영성', true],
    ['320', '경제/경영', true], ['340', '정치/법률', true], ['330', '사회과학', true],
    ['400', '과학/수학', true], ['600', '예술/디자인', true], ['700', '인문학', true], ['911', '한국사', true],
    // 앱 장르가 더 잘게 나뉘는 영역 → LLM 힌트(sure=false)
    ['810', '현대문학', false], ['850', '해외문학', false], ['004', '컴퓨터·프로그래밍', false],
    ['190', '자기계발', false], ['920', '해외사', false],
  ])('KDC %s → %s (sure=%s)', (code, genre, sure) => {
    expect(genreFromKdc(code)).toMatchObject({ genre, sure });
  });

  it('근거가 약한 분류(총류·오락·지리)와 잘못된 값은 null', () => {
    for (const c of ['010', '690', '980', null, 'abc', '12']) expect(genreFromKdc(c)).toBeNull();
  });
});

describe('parsePageText / parseSeoji / normalizeIsbn', () => {
  it.each([['239 p.', 239], ['xii, 239p ; 20cm', 239], ['1,024 p.', 1024], [312, 312], ['5', null], ['', null], [undefined, null]])(
    '%s → %s', (input, out) => { expect(parsePageText(input)).toBe(out); },
  );

  it('서지정보 응답(docs/result 어느 형태든)에서 쪽수와 KDC를 꺼낸다', () => {
    expect(parseSeoji({ TOTAL_COUNT: '1', docs: [{ TITLE: '데미안', PAGE: '248 p.', EA_ADD_CODE: '03850' }] })).toEqual({ pages: 248, kdc: '850' });
    expect(parseSeoji({ result: [{ PAGE: '', EA_ADD_CODE: '', KDC: '911.05' }] })).toEqual({ pages: null, kdc: '911' });
    expect(parseSeoji({ docs: [] })).toBeNull();
    expect(parseSeoji(null)).toBeNull();
  });

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
    const a = setup({ seoji: vi.fn(async () => ({ pages: 248, kdc: null })), openLibrary: vi.fn(async () => 239) });
    expect(await resolveBookMeta(a.env, Q, a.deps)).toMatchObject({ pageCount: 248, pageSource: 'nl' });
    const b = setup({ openLibrary: vi.fn(async () => 239) });
    expect(await resolveBookMeta(b.env, Q, b.deps)).toMatchObject({ pageCount: 239, pageSource: 'openlibrary' });
    const c = setup();
    expect(await resolveBookMeta(c.env, Q, c.deps)).toMatchObject({ pageCount: null, pageSource: null });
  });

  it('KDC가 확실한 분류면 LLM을 부르지 않는다', async () => {
    const s = setup({ seoji: vi.fn(async () => ({ pages: 300, kdc: '320' })) });
    expect(await resolveBookMeta(s.env, Q, s.deps)).toMatchObject({ genre: '경제/경영', genreSource: 'kdc', kdc: '320' });
    expect(s.deps.classify).not.toHaveBeenCalled();
  });

  it('KDC가 애매하면 LLM에 소개·번역자·KDC 힌트를 넘기고, LLM이 실패하면 KDC 대략값', async () => {
    const s = setup({ seoji: vi.fn(async () => ({ pages: 248, kdc: '850' })) });
    expect(await resolveBookMeta(s.env, Q, s.deps)).toMatchObject({ genre: '해외문학', genreSource: 'llm' });
    expect(s.deps.classify).toHaveBeenCalledWith(s.env, expect.objectContaining({
      title: '데미안', translator: '전영애', kdcLabel: 'KDC 850 외국문학', description: '싱클레어가 겪는 성장',
    }));
    const f = setup({ seoji: vi.fn(async () => ({ pages: 248, kdc: '850' })), classify: vi.fn(async () => null) });
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
      openLibrary: vi.fn(() => new Promise<number | null>((r) => { releaseOl = (n) => { order.push('ol-done'); r(n); }; })),
      lookup: vi.fn(async () => MATCH),
      classify: vi.fn(async () => { order.push('classify'); setTimeout(() => releaseOl(239), 0); return '해외문학' as const; }),
    };
    const meta = await resolveBookMeta(env, { isbn: '9788937460449', title: '데미안' }, deps);
    expect(order).toEqual(['classify', 'ol-done']);
    expect(meta).toMatchObject({ pageCount: 239, genre: '해외문학' });
  });
});
