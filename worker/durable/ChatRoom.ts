import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { BROADCAST_PATH, KICK_ALL, KICK_PATH } from '../lib/chatBroadcast';

/** WebSocket 전송 한도 — HTTP 전송(POST /messages)과 같은 분당 30회 */
export const WS_MESSAGE_LIMIT = 30;
export const WS_MESSAGE_WINDOW_MS = 60_000;
/** 회원이 아니게 된 연결을 닫을 때 쓰는 코드(4000~4999는 앱 정의) */
export const WS_CLOSE_NOT_MEMBER = 4003;

interface WsAttachment {
  userId: string;
  groupId: string;
}

/**
 * ChatRoom Durable Object — 그룹별 채팅룸 (WebSocket Hibernation API)
 *
 * 클라이언트 → 워커(JWT 검증) → DO stub.fetch() → WebSocket 업그레이드
 * 메시지 수신 → 룸 전체 브로드캐스트 → D1 write-behind (group_messages 테이블)
 * 접속/해제 시 Presence 브로드캐스트 (KV heartbeat 대체)
 * HTTP로 보낸 메시지·삭제는 워커가 POST /broadcast로 넘겨 같은 소켓들에 전달한다(2026-10-19~)
 *
 * 보안(57차): 메시지마다 승인된 회원인지 다시 확인하고(탈퇴·강퇴 뒤 열린 연결로 쓰기 차단), 탈퇴·강퇴·모임 삭제 때
 * 워커가 POST /kick으로 그 회원의 연결을 끊는다. 전송은 회원별 분당 30회(HTTP와 같음, DO 메모리 — 잠들면 초기화).
 */
export class ChatRoom extends DurableObject<Bindings> {
  private readonly sendLog = new Map<string, { windowStart: number; count: number }>();

  override async fetch(request: Request): Promise<Response> {
    // 워커 내부 호출 전용(DO는 바인딩으로만 닿는다): HTTP로 저장된 메시지·삭제를 접속 중인 소켓에 전달
    if (request.method === 'POST' && new URL(request.url).pathname === BROADCAST_PATH) {
      this.broadcastRaw(await request.text());
      return new Response(null, { status: 204 });
    }
    if (request.method === 'POST' && new URL(request.url).pathname === KICK_PATH) {
      const { user_id } = await request.json<{ user_id?: string }>().catch(() => ({ user_id: undefined }));
      if (user_id) this.kick(user_id);
      return new Response(null, { status: 204 });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }

    const userId = request.headers.get('X-User-Id');
    const groupId = request.headers.get('X-Group-Id');
    if (!userId || !groupId) {
      return new Response('Missing required headers', { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, groupId } satisfies WsAttachment);

    // 새 접속자 포함한 현재 온라인 목록 전체 브로드캐스트
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    const att = ws.deserializeAttachment() as WsAttachment | null;
    if (!att) return;
    const { userId, groupId } = att;

    let parsed: unknown;
    try { parsed = JSON.parse(message); } catch { return; }
    if (typeof parsed !== 'object' || parsed === null) return;
    const msg = parsed as Record<string, unknown>;

    if (msg['type'] === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (msg['type'] !== 'message') return;

    const rawContent = msg['content'];
    if (typeof rawContent !== 'string') return;
    const content = rawContent.trim().replace(/<[^>]*>/g, '').slice(0, 1000);
    if (!content) return;

    if (!this.allowSend(userId)) {
      try { ws.send(JSON.stringify({ type: 'error', code: 'rate_limited' })); } catch { /* closed */ }
      return;
    }

    // 승인된 회원인지 메시지마다 확인 — 원래 하던 사용자 조회에 조건을 합쳐 쿼리 수는 같다
    const userRow = await this.env.DB.prepare(
      `SELECT u.name, u.avatar_url, u.profile_emoji FROM users u
       JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ? AND gm.status = 'approved'
       WHERE u.id = ?`,
    ).bind(groupId, userId).first<{ name: string; avatar_url: string | null; profile_emoji: string | null }>();
    if (!userRow) {
      try { ws.close(WS_CLOSE_NOT_MEMBER, 'not a member'); } catch { /* already closed */ }
      this.broadcastPresence(ws);
      return;
    }

    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    const msgData = {
      id: messageId,
      group_id: groupId,
      user_id: userId,
      user_name: userRow.name ?? '알 수 없음',
      avatar_url: userRow.avatar_url ?? null,
      profile_emoji: userRow.profile_emoji ?? null,
      content,
      deleted_at: null,
      created_at: createdAt,
    };

    const payload = JSON.stringify({ type: 'message', data: msgData });
    for (const s of this.ctx.getWebSockets()) {
      try { s.send(payload); } catch { /* closed */ }
    }

    // D1 write-behind (fire and forget)
    this.ctx.waitUntil(
      this.env.DB.prepare(
        'INSERT INTO group_messages (id, group_id, user_id, content) VALUES (?, ?, ?, ?)',
      ).bind(messageId, groupId, userId, content).run(),
    );
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    try { ws.close(); } catch { /* already closed */ }
    this.broadcastPresence(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    try { ws.close(); } catch { /* already closed */ }
    this.broadcastPresence(ws);
  }

  /** 회원별 고정 창 전송 한도 */
  private allowSend(userId: string, now = Date.now()): boolean {
    const cur = this.sendLog.get(userId);
    if (!cur || now - cur.windowStart >= WS_MESSAGE_WINDOW_MS) {
      this.sendLog.set(userId, { windowStart: now, count: 1 });
      return true;
    }
    if (cur.count >= WS_MESSAGE_LIMIT) return false;
    cur.count += 1;
    return true;
  }

  /** 그 회원(또는 KICK_ALL이면 전원)의 연결을 닫는다 */
  private kick(userId: string): void {
    for (const s of this.ctx.getWebSockets()) {
      try {
        const att = s.deserializeAttachment() as WsAttachment | null;
        if (userId === KICK_ALL || att?.userId === userId) s.close(WS_CLOSE_NOT_MEMBER, 'membership revoked');
      } catch { /* already closed */ }
    }
    this.broadcastPresence();
  }

  private broadcastRaw(payload: string): void {
    for (const s of this.ctx.getWebSockets()) {
      try { s.send(payload); } catch { /* closed */ }
    }
  }

  private broadcastPresence(exclude?: WebSocket): void {
    const sockets = this.ctx.getWebSockets();
    const onlineIds = new Set<string>();
    for (const s of sockets) {
      if (s === exclude) continue;
      try {
        const att = s.deserializeAttachment() as WsAttachment | null;
        if (att?.userId) onlineIds.add(att.userId);
      } catch { /* skip */ }
    }
    const presencePayload = JSON.stringify({ type: 'presence', onlineUsers: [...onlineIds] });
    for (const s of sockets) {
      if (s === exclude) continue;
      try { s.send(presencePayload); } catch { /* closed */ }
    }
  }
}
