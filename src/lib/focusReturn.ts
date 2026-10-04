/**
 * 대화상자·시트가 닫힌 뒤 포커스를 돌려줄 요소를 고른다.
 * 드롭다운 메뉴 항목에서 연 경우 그 항목은 곧 사라지므로, 메뉴를 연 버튼(aria-controls로 메뉴를 가리키는 요소)을 대신 쓴다.
 */
export function focusReturnTarget(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement)) return null;
  const menu = active.closest<HTMLElement>('[role="menu"]');
  if (menu?.id) {
    const trigger = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`);
    if (trigger) return trigger;
  }
  return active;
}
