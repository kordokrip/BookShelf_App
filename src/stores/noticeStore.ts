/**
 * noticeStore — 한 번에 안내 하나만 보여주는 우선순위 슬롯
 * 각 안내는 "보여주고 싶다"를 등록하고, 활성 안내 중 가장 높은 우선순위만 렌더한다.
 * 우선순위: update(1) > genre-recovery(2) > install(3)
 */
import { useEffect } from 'react';
import { create } from 'zustand';

export type NoticeId = 'update' | 'genre-recovery' | 'install';

export const NOTICE_PRIORITY: Record<NoticeId, number> = {
  update: 1,
  'genre-recovery': 2,
  install: 3,
};

/** 활성 안내 중 우선순위가 가장 높은(숫자가 작은) 것 */
export function pickTopNotice(active: Partial<Record<NoticeId, boolean>>): NoticeId | null {
  let top: NoticeId | null = null;
  for (const id of Object.keys(NOTICE_PRIORITY) as NoticeId[]) {
    if (active[id] && (top === null || NOTICE_PRIORITY[id] < NOTICE_PRIORITY[top])) top = id;
  }
  return top;
}

interface NoticeState {
  active: Partial<Record<NoticeId, boolean>>;
  register: (id: NoticeId) => void;
  unregister: (id: NoticeId) => void;
}

export const useNoticeStore = create<NoticeState>((set) => ({
  active: {},
  register: (id) => set((s) => (s.active[id] ? s : { active: { ...s.active, [id]: true } })),
  unregister: (id) =>
    set((s) => {
      if (!s.active[id]) return s;
      const next = { ...s.active };
      delete next[id];
      return { active: next };
    }),
}));

/**
 * wants가 true인 동안 슬롯에 등록하고(언마운트·false 시 해제),
 * 지금 이 안내가 최상위여서 렌더해도 되는지를 반환한다.
 */
export function useNoticeSlot(id: NoticeId, wants: boolean): boolean {
  const register = useNoticeStore((s) => s.register);
  const unregister = useNoticeStore((s) => s.unregister);
  useEffect(() => {
    if (!wants) return;
    register(id);
    return () => unregister(id);
  }, [id, wants, register, unregister]);
  const top = useNoticeStore((s) => pickTopNotice(s.active));
  return wants && top === id;
}
