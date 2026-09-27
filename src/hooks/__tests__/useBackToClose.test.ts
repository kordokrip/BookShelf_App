import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackToClose } from '../useBackToClose';

/** happy-dom의 history.back()은 popstate를 보내지 않으므로, 브라우저처럼 동작하는 가짜 history 스택으로 검증 */
function installFakeHistory() {
  const stack: unknown[] = [{ idx: 0, key: 'page' }];
  let pos = 0;
  const firePop = () => window.dispatchEvent(new PopStateEvent('popstate', { state: stack[pos] }));
  vi.spyOn(window.history, 'state', 'get').mockImplementation(() => stack[pos] as never);
  vi.spyOn(window.history, 'pushState').mockImplementation((state) => { stack.splice(pos + 1); stack.push(state); pos += 1; });
  vi.spyOn(window.history, 'back').mockImplementation(() => { if (pos > 0) { pos -= 1; firePop(); } });
  return {
    get length() { return stack.length; },
    get pos() { return pos; },
    /** 사용자가 뒤로 가기를 누름 */
    back: () => window.history.back(),
    /** 라우터가 다른 화면으로 이동 */
    navigate: () => { stack.splice(pos + 1); stack.push({ idx: 1, key: 'other' }); pos += 1; },
  };
}

describe('useBackToClose', () => {
  let h: ReturnType<typeof installFakeHistory>;
  beforeEach(() => { vi.useFakeTimers(); h = installFakeHistory(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('열리면 같은 화면의 기록 항목을 하나 쌓고, 라우터 상태(idx·key)를 유지', () => {
    renderHook(() => useBackToClose(true, () => {}));
    expect(h.length).toBe(2);
    expect(window.history.state).toMatchObject({ idx: 0, key: 'page' });
  });

  it('뒤로 가기 → onClose, 화면(기록 위치)은 원래 페이지', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(({ open }) => useBackToClose(open, onClose), { initialProps: { open: true } });
    h.back();
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender({ open: false }); // 부모가 닫힘 반영
    vi.runAllTimers();
    expect(h.pos).toBe(0); // 추가로 되돌리지 않음
  });

  it('화면에서 직접 닫으면 쌓아 둔 항목을 걷어냄 (onClose 재호출 없음)', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(({ open }) => useBackToClose(open, onClose), { initialProps: { open: true } });
    rerender({ open: false });
    vi.runAllTimers();
    expect(h.pos).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('닫으면서 다른 화면으로 이동하면 그 이동을 되돌리지 않음', () => {
    const { rerender } = renderHook(({ open }) => useBackToClose(open, () => {}), { initialProps: { open: true } });
    rerender({ open: false });
    h.navigate();
    vi.runAllTimers();
    expect(window.history.state).toMatchObject({ key: 'other' });
  });

  it('겹친 오버레이는 뒤로 가기 한 번에 맨 위 하나만 닫힘', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    renderHook(() => useBackToClose(true, closeA));
    renderHook(() => useBackToClose(true, closeB));
    h.back();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it('닫자마자 다른 오버레이를 열면(타이머 프롬프트 → 기록 모달) 새 오버레이를 닫지 않음', () => {
    const closeModal = vi.fn();
    const prompt = renderHook(({ open }) => useBackToClose(open, () => {}), { initialProps: { open: true } });
    prompt.rerender({ open: false });
    renderHook(() => useBackToClose(true, closeModal));
    vi.runAllTimers();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
