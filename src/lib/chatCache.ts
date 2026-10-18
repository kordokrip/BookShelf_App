import type { InfiniteData } from '@tanstack/react-query';
import type { GroupMessage } from './api';

/** 그룹 메시지 무한 쿼리 캐시 모양 (pages[0]이 최신, 각 페이지는 created_at DESC) */
export type MessagePages = InfiniteData<{ data: GroupMessage[] }, string | undefined>;

/**
 * WS로 받은 새 메시지를 첫 페이지 선두에 넣는다.
 * (useGroupMessages의 select가 pages.flatMap().reverse()로 정렬하므로 DESC인 pages[0] 앞 = 화면 맨 아래)
 * 이미 있는 id(내가 보낸 메시지의 HTTP 응답·폴링으로 먼저 들어온 경우)는 그대로 둔다.
 */
export function insertIncomingMessage(old: MessagePages | undefined, msg: GroupMessage): MessagePages | undefined {
  if (!old) return old;
  if (old.pages.some((p) => p.data.some((x) => x.id === msg.id))) return old;
  return {
    ...old,
    pages: [{ ...old.pages[0], data: [msg, ...(old.pages[0]?.data ?? [])] }, ...old.pages.slice(1)],
  };
}

/** WS로 받은 삭제를 반영한다(소프트 삭제 — 화면은 "삭제된 메시지입니다."로 바뀜) */
export function markMessageDeleted(old: MessagePages | undefined, id: string, deletedAt: string): MessagePages | undefined {
  if (!old) return old;
  let hit = false;
  const pages = old.pages.map((p) => ({
    ...p,
    data: p.data.map((m) => {
      if (m.id !== id || m.deleted_at) return m;
      hit = true;
      return { ...m, deleted_at: deletedAt };
    }),
  }));
  return hit ? { ...old, pages } : old;
}
