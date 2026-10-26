/**
 * HTTP로 저장된 채팅 이벤트를 모임의 ChatRoom DO로 넘겨 접속 중인 WebSocket에 실시간 전달한다.
 * 채팅 전송은 HTTP POST(알림·rate limit·읽음 갱신 포함)라서, 이 호출이 없으면 WS 사용자는 폴링으로만 메시지를 받는다.
 * 실패해도 메시지는 이미 D1에 있고 클라이언트 안전망 폴링이 메우므로 요청은 실패시키지 않는다.
 */
export type ChatEvent =
  | { type: 'message'; data: unknown }
  | { type: 'message_deleted'; data: { id: string; deleted_at: string } };

/** 워커 → ChatRoom DO 내부 브로드캐스트 경로 (호스트는 의미 없음 — DO는 바인딩으로만 닿는다) */
export const BROADCAST_PATH = '/broadcast';
const BROADCAST_URL = `https://chat-room${BROADCAST_PATH}`;

export async function broadcastToRoom(
  rooms: { getByName(name: string): { fetch(input: string, init?: RequestInit): Promise<Response> } },
  groupId: string,
  event: ChatEvent,
): Promise<void> {
  try {
    await rooms.getByName(groupId).fetch(BROADCAST_URL, { method: 'POST', body: JSON.stringify(event) });
  } catch (err) {
    console.error('[chat] 실시간 전달 실패(폴링이 메움):', groupId, event.type, err);
  }
}

/** 워커 → ChatRoom DO: 그 회원의 열린 연결을 끊는다(탈퇴·강퇴). `*`면 모두(모임 삭제) — 57차 보안 점검 */
export const KICK_PATH = '/kick';
export const KICK_ALL = '*';
const KICK_URL = `https://chat-room${KICK_PATH}`;

export async function kickFromRoom(
  rooms: { getByName(name: string): { fetch(input: string, init?: RequestInit): Promise<Response> } },
  groupId: string,
  userId: string,
): Promise<void> {
  try {
    await rooms.getByName(groupId).fetch(KICK_URL, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
  } catch (err) {
    // 실패해도 다음 메시지 때 DO가 회원 자격을 다시 확인해 연결을 끊는다
    console.error('[chat] 연결 끊기 실패(다음 메시지 때 다시 확인):', groupId, err);
  }
}
