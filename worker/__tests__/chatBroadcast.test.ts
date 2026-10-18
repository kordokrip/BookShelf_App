import { describe, it, expect, vi } from 'vitest';
import { broadcastToRoom, BROADCAST_PATH } from '../lib/chatBroadcast';

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
