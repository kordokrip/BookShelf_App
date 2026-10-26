import { describe, it, expect, vi } from 'vitest';
import { broadcastToRoom, BROADCAST_PATH, kickFromRoom, KICK_PATH, KICK_ALL } from '../lib/chatBroadcast';

describe('broadcastToRoom', () => {
  it('모임 이름의 DO에 POST /broadcast로 이벤트 JSON을 넘긴다', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const getByName = vi.fn(() => ({ fetch }));
    await broadcastToRoom({ getByName }, 'g1', { type: 'message_deleted', data: { id: 'm1', deleted_at: 't' } });
    expect(getByName).toHaveBeenCalledWith('g1');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe(BROADCAST_PATH);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ type: 'message_deleted', data: { id: 'm1', deleted_at: 't' } });
  });

  it('DO 호출이 실패해도 던지지 않는다(메시지는 이미 저장, 폴링이 메움)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getByName = () => ({ fetch: async () => { throw new Error('DO down'); } });
    await expect(broadcastToRoom({ getByName }, 'g1', { type: 'message', data: {} })).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe('kickFromRoom (57차 — 탈퇴·강퇴·삭제 시 열린 채팅 연결 끊기)', () => {
  it('모임 DO에 POST /kick으로 회원 id를 넘긴다(모임 삭제는 *)', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    await kickFromRoom({ getByName: () => ({ fetch }) }, 'g1', 'u1');
    await kickFromRoom({ getByName: () => ({ fetch }) }, 'g1', KICK_ALL);
    const calls = fetch.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(new URL(calls[0]![0]).pathname).toBe(KICK_PATH);
    expect(JSON.parse(calls[0]![1].body as string)).toEqual({ user_id: 'u1' });
    expect(JSON.parse(calls[1]![1].body as string)).toEqual({ user_id: '*' });
  });

  it('DO 호출이 실패해도 던지지 않는다(다음 메시지 때 DO가 회원 자격을 다시 확인)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(kickFromRoom({ getByName: () => ({ fetch: async () => { throw new Error('down'); } }) }, 'g1', 'u1')).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
