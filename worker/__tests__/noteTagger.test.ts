import { describe, it, expect, vi } from 'vitest';
import { tagNote, DAILY_TAG_QUOTA, type TaggerEnv } from '../lib/ai/noteTagger';

const CONTENT = '주인공이 알을 깨고 나오는 장면에서 자아를 찾는 성장의 고통과 용기를 함께 느꼈다';
const NOW = Date.UTC(2026, 8, 27, 3, 0, 0); // KST 2026-09-27

function fakeEnv(opts: { aiResponse?: unknown; aiThrows?: boolean; kv?: Record<string, string>; changes?: number } = {}) {
  const kv = new Map(Object.entries(opts.kv ?? {}));
  const updates: unknown[][] = [];
  const env: TaggerEnv = {
    AI: {
      run: vi.fn(async () => {
        if (opts.aiThrows) throw new Error('AI down');
        return opts.aiResponse ?? { response: '{"keywords":["성장","자아"],"emotion":"희망"}' };
      }),
    },
    KV: {
      get: vi.fn(async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'],
      put: vi.fn(async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'],
    },
    DB: {
      prepare: () => ({
        bind: (...args: unknown[]) => ({
          run: async () => { updates.push(args); return { meta: { changes: opts.changes ?? 1 } }; },
        }),
      }),
    } as unknown as D1Database,
  };
  return { env, kv, updates };
}

describe('tagNote', () => {
  const note = { id: 'n1', userId: 'u1', content: CONTENT };

  it('정상: AI 응답을 파싱해 태그 저장 + 캐시·쿼터 기록', async () => {
    const { env, kv, updates } = fakeEnv();
    expect(await tagNote(env, note, NOW)).toBe('tagged');
    expect(updates[0]).toEqual(['["성장","자아","희망"]', 'n1', 'u1', CONTENT]);
    expect(kv.get('ai_tag_quota:u1:2026-09-27')).toBe('1');
    expect([...kv.keys()].some((k) => k.startsWith('ai_tag:'))).toBe(true);
    // 분류 작업이라 낮은 temperature로 호출
    expect(env.AI.run).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ temperature: 0.2 }));
  });

  it('비문자열(객체) 응답도 처리', async () => {
    const { env, updates } = fakeEnv({ aiResponse: { response: { keywords: ['용기'], emotion: '설렘' } } });
    expect(await tagNote(env, note, NOW)).toBe('tagged');
    expect(updates[0]![0]).toBe('["용기","설렘"]');
  });

  it('깨진 응답이면 저장하지 않음', async () => {
    const { env, updates } = fakeEnv({ aiResponse: { response: '분석할 수 없습니다' } });
    expect(await tagNote(env, note, NOW)).toBe('empty');
    expect(updates).toHaveLength(0);
  });

  it('20자 미만 노트는 AI를 호출하지 않음', async () => {
    const { env } = fakeEnv();
    expect(await tagNote(env, { ...note, content: '짧은 메모' }, NOW)).toBe('skipped-short');
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it(`하루 ${DAILY_TAG_QUOTA}회 상한 도달 시 AI를 호출하지 않음`, async () => {
    const { env } = fakeEnv({ kv: { 'ai_tag_quota:u1:2026-09-27': String(DAILY_TAG_QUOTA) } });
    expect(await tagNote(env, note, NOW)).toBe('quota-exceeded');
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('같은 내용은 캐시를 재사용 (AI·쿼터 소모 없음)', async () => {
    const first = fakeEnv();
    await tagNote(first.env, note, NOW);
    const cacheEntries = Object.fromEntries([...first.kv].filter(([k]) => k.startsWith('ai_tag:')));
    const second = fakeEnv({ kv: cacheEntries });
    expect(await tagNote(second.env, { ...note, id: 'n2' }, NOW)).toBe('cached');
    expect(second.env.AI.run).not.toHaveBeenCalled();
    expect(second.updates[0]).toEqual(['["성장","자아","희망"]', 'n2', 'u1', CONTENT]);
  });

  it('태깅 중 사용자가 내용을 바꿨으면(UPDATE 0행) content-changed', async () => {
    const { env } = fakeEnv({ changes: 0 });
    expect(await tagNote(env, note, NOW)).toBe('content-changed');
  });

  it('AI 오류는 삼키고 error 반환 (노트 저장에 영향 없음)', async () => {
    const { env } = fakeEnv({ aiThrows: true });
    expect(await tagNote(env, note, NOW)).toBe('error');
  });
});
