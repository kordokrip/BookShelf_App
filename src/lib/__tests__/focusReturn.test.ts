import { describe, it, expect } from 'vitest';
import { focusReturnTarget } from '../focusReturn';

describe('focusReturnTarget', () => {
  it('메뉴 항목이면 메뉴를 연 버튼을 돌려준다', () => {
    document.body.innerHTML = '<button aria-controls="m1" id="t">더보기</button><div role="menu" id="m1"><div role="menuitem" tabindex="0" id="i">수정</div></div>';
    expect(focusReturnTarget(document.getElementById('i'))?.id).toBe('t');
  });
  it('일반 요소는 그대로, 없으면 null', () => {
    document.body.innerHTML = '<button id="b">삭제</button>';
    expect(focusReturnTarget(document.getElementById('b'))?.id).toBe('b');
    expect(focusReturnTarget(null)).toBeNull();
  });
});
