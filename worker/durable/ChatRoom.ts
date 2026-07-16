import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';

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
 */
export class ChatRoom extends DurableObject<Bindings> {
  override async fetch(request: Request): Promise<Response> {
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

    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    const userRow = await this.env.DB.prepare(
      'SELECT name, avatar_url, profile_emoji FROM users WHERE id = ?',
    ).bind(userId).first<{ name: string; avatar_url: string | null; profile_emoji: string | null }>();

    const msgData = {
      id: messageId,
      group_id: groupId,
      user_id: userId,
      user_name: userRow?.name ?? '알 수 없음',
      avatar_url: userRow?.avatar_url ?? null,
      profile_emoji: userRow?.profile_emoji ?? null,
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
