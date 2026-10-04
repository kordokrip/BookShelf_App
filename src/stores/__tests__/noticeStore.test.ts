import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { pickTopNotice, useNoticeStore, useNoticeSlot } from '../noticeStore';

describe('pickTopNotice', () => {
  it('활성 안내가 없으면 null', () => {
    expect(pickTopNotice({})).toBeNull();
  });
  it('update > genre-recovery > install', () => {
    expect(pickTopNotice({ install: true, 'genre-recovery': true, update: true })).toBe('update');
    expect(pickTopNotice({ install: true, 'genre-recovery': true })).toBe('genre-recovery');
    expect(pickTopNotice({ install: true })).toBe('install');
  });
});

describe('useNoticeSlot', () => {
  beforeEach(() => useNoticeStore.setState({ active: {} }));

  it('최상위 안내만 true, 숨기면 다음 안내가 나타난다', () => {
    const upd = renderHook(({ w }) => useNoticeSlot('update', w), { initialProps: { w: true } });
    const inst = renderHook(() => useNoticeSlot('install', true));
    expect(upd.result.current).toBe(true);
    expect(inst.result.current).toBe(false);
    upd.rerender({ w: false });
    expect(upd.result.current).toBe(false);
    expect(inst.result.current).toBe(true);
  });

  it('언마운트하면 등록이 해제된다', () => {
    const g = renderHook(() => useNoticeSlot('genre-recovery', true));
    const inst = renderHook(() => useNoticeSlot('install', true));
    expect(inst.result.current).toBe(false);
    act(() => g.unmount());
    expect(inst.result.current).toBe(true);
    expect(useNoticeStore.getState().active['genre-recovery']).toBeUndefined();
  });

  it('wants가 false면 등록하지 않아 다른 안내를 막지 않는다', () => {
    renderHook(() => useNoticeSlot('update', false));
    const inst = renderHook(() => useNoticeSlot('install', true));
    expect(inst.result.current).toBe(true);
  });
});
