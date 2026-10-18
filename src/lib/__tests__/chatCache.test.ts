import { describe, it, expect } from 'vitest';
import { insertIncomingMessage, markMessageDeleted, type MessagePages } from '../chatCache';
import type { GroupMessage } from '../api';

const msg = (id: string, over: Partial<GroupMessage> = {}) =>
  ({ id, group_id: 'g', user_id: 'u', user_name: 'n', content: id, deleted_at: null, created_at: '2026-10-19 00:00:00', ...over }) as GroupMessage;
const pages = (...ps: GroupMessage[][]): MessagePages => ({ pages: ps.map((data) => ({ data })), pageParams: ps.map(() => undefined) });

describe('insertIncomingMessage', () => {
  it('첫 페이지 맨 앞(= 화면 맨 아래)에 넣는다', () => {
    const next = insertIncomingMessage(pages([msg('b'), msg('a')], [msg('z')]), msg('c'))!;
    expect(next.pages[0]!.data.map((m) => m.id)).toEqual(['c', 'b', 'a']);
    expect(next.pages[1]!.data.map((m) => m.id)).toEqual(['z']);
  });

  it('이미 있는 id(내 HTTP 응답·폴링이 먼저 넣은 경우)는 중복으로 넣지 않는다', () => {
    const old = pages([msg('b')], [msg('a')]);
    expect(insertIncomingMessage(old, msg('a'))).toBe(old);
  });

  it('캐시가 없으면 그대로(아직 불러오기 전)', () => {
    expect(insertIncomingMessage(undefined, msg('a'))).toBeUndefined();
  });
});

describe('markMessageDeleted', () => {
  it('어느 페이지에 있든 deleted_at을 채운다', () => {
    const next = markMessageDeleted(pages([msg('b')], [msg('a')]), 'a', '2026-10-19 01:00:00')!;
    expect(next.pages[1]!.data[0]!.deleted_at).toBe('2026-10-19 01:00:00');
    expect(next.pages[0]!.data[0]!.deleted_at).toBeNull();
  });

  it('없는 id·이미 삭제된 메시지는 캐시를 바꾸지 않는다', () => {
    const old = pages([msg('a', { deleted_at: 'x' })]);
    expect(markMessageDeleted(old, 'nope', 'y')).toBe(old);
    expect(markMessageDeleted(old, 'a', 'y')).toBe(old);
  });
});
