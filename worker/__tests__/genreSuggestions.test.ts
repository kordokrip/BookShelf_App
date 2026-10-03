import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseBookIds, parseSuggestions, selectTargetBooks, suggestGenres, MAX_SUGGEST_BOOKS,
  type GenreBookRow, type GenreEnv,
} from '../lib/genreSuggestions';

afterEach(() => { vi.unstubAllGlobals(); });

const rows: GenreBookRow[] = [
  { id: 'b1', title: '사피엔스', author: '유발 하라리', publisher: '김영사', genre: '기타' },
  { id: 'b2', title: '클린 코드', author: '로버트 마틴', publisher: '인사이트', genre: null },
  { id: 'b3', title: '모르는 책', author: '', publisher: null, genre: '' },
];

function fakeDb(results: GenreBookRow[]) {
  const calls: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => { calls.push({ sql, binds }); return { all: async () => ({ results }) }; },
    }),
  } as unknown as D1Database;
  return { db, calls };
}

function env(): GenreEnv {
  const kv = new Map<string, string>();
  return {
    OPENROUTER_API_KEY: 'sk', KAKAO_REST_API_KEY: 'k',
    KV: { get: (async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'], put: (async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'] },
    AI: { run: vi.fn(async () => ({ response: '{}' })) },
  };
}
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });

describe('selectTargetBooks', () => {
  it('ids 없음: 사용자의 기타/NULL/빈 장르 최신순 최대 40', async () => {
    const { db, calls } = fakeDb(rows);
    expect(await selectTargetBooks(db, 'u1')).toEqual(rows);
    expect(calls[0]!.sql).toContain("genre IS NULL OR genre = ''");
    expect(calls[0]!.sql).toContain('ORDER BY created_at DESC');
    expect(calls[0]!.sql).toContain(`LIMIT ${MAX_SUGGEST_BOOKS}`);
    expect(calls[0]!.binds).toEqual(['u1', '기타']);
  });
  it('ids 있음: 본인 소유 id만(user_id 조건 + IN)', async () => {
    const { db, calls } = fakeDb(rows);
    await selectTargetBooks(db, 'u1', ['b1', 'b2']);
    expect(calls[0]!.sql).toContain('user_id = ?');
    expect(calls[0]!.sql).toContain('id IN (?,?)');
    expect(calls[0]!.binds).toEqual(['u1', 'b1', 'b2']);
  });
  it('빈 ids 배열은 DB 조회 없이 빈 목록', async () => {
    const { db, calls } = fakeDb(rows);
    expect(await selectTargetBooks(db, 'u1', [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('parseBookIds', () => {
  it('없으면 undefined, 배열 아니면/40개 초과/비문자열이면 null, 중복 제거', () => {
    expect(parseBookIds(undefined)).toBeUndefined();
    expect(parseBookIds('x')).toBeNull();
    expect(parseBookIds([1])).toBeNull();
    expect(parseBookIds(Array.from({ length: 41 }, (_, i) => `i${i}`))).toBeNull();
    expect(parseBookIds(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('parseSuggestions', () => {
  it('유효한 제안만 남긴다(잘못된 장르·미지의 id·기타·중복 제거, confidence 보정)', () => {
    const text = JSON.stringify({ suggestions: [
      { id: 'b1', genre: '해외사', confidence: 'high' },
      { id: 'b2', genre: '소설', confidence: 'high' },
      { id: 'zzz', genre: '철학', confidence: 'high' },
      { id: 'b3', genre: '기타', confidence: 'high' },
      { id: 'b1', genre: '철학', confidence: 'high' },
      { id: 'b2', genre: '컴퓨터·프로그래밍', confidence: '아마도' },
    ] });
    expect(parseSuggestions(text, rows)).toEqual([
      { id: 'b1', title: '사피엔스', author: '유발 하라리', current_genre: '기타', suggested_genre: '해외사', confidence: 'high' },
      { id: 'b2', title: '클린 코드', author: '로버트 마틴', current_genre: '기타', suggested_genre: '컴퓨터·프로그래밍', confidence: 'low' },
    ]);
    expect(parseSuggestions('json 아님', rows)).toEqual([]);
  });
});

describe('suggestGenres', () => {
  it('빈 목록이면 모델·네트워크 호출 없이 {data: [], provider: null}', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const e = env();
    expect(await suggestGenres(e, [])).toEqual({ data: [], provider: null });
    expect(f).not.toHaveBeenCalled();
    expect(e.AI.run).not.toHaveBeenCalled();
  });

  it('책 소개를 근거로 한 번의 배치 모델 호출 → 검증된 제안 반환', async () => {
    let modelCalls = 0;
    let userPrompt = '';
    vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
      if (u.includes('openrouter')) {
        modelCalls++;
        const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }>; response_format?: unknown };
        userPrompt = body.messages[1]!.content;
        expect(body.response_format).toEqual({ type: 'json_object' });
        return json({ choices: [{ message: { content: JSON.stringify({ suggestions: [{ id: 'b1', genre: '해외사', confidence: 'high' }, { id: 'b2', genre: '없는장르', confidence: 'high' }] }) } }] });
      }
      const q = new URL(u).searchParams.get('query') ?? '';
      return json({ documents: q.startsWith('사피엔스') ? [{ title: '사피엔스', authors: ['유발 하라리'], publisher: '김영사', isbn: 'x 9780000000001', thumbnail: '', url: 'u', contents: '인류의 역사를 다룬다. '.repeat(40) }] : [] });
    }));
    const res = await suggestGenres(env(), rows);
    expect(modelCalls).toBe(1);
    expect(res.provider).toBe('openrouter');
    expect(res.data.map((d) => d.id)).toEqual(['b1']);
    const descLine = userPrompt.split('\n').find((l) => l.includes('"id":"b1"'))!;
    expect((JSON.parse(descLine) as { description: string }).description.length).toBeLessThanOrEqual(200);
    expect(descLine).toContain('인류의 역사');
  });
});
