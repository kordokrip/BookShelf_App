import { describe, it, expect } from 'vitest';
import { groupByMonth, UNKNOWN_DATE_LABEL, getDesktopBlockClassName, getMobileBlockClassName } from '../LibraryPage';
import type { UIBook } from '../../../types/book';

function makeBook(overrides: Partial<UIBook> & { id: string }): UIBook {
  return {
    title: '제목',
    author: '저자',
    publisher: '',
    genre: '기타',
    coverEmoji: '📚',
    coverColor: 'from-indigo-500 to-violet-600',
    status: 'done',
    addedDate: '2026-09-14',
    ...overrides,
  };
}

// ── groupByMonth ──────────────────────────────────────────────
// Bug #6: status='done'인데 finishedDate가 없는 책이 서재 기본(날짜별) 뷰에서
// 통째로 사라졌던 문제. 완독일을 지어내지 않고, 대신 "날짜 미상" 그룹으로
// 숨기지 않고 노출한다.

describe('groupByMonth', () => {
  it('finishedDate가 있는 책은 해당 월 그룹으로 분류된다', () => {
    const books = [makeBook({ id: '1', finishedDate: '2026-09-10' })];
    const grouped = groupByMonth(books);
    expect(grouped.get('2026년 9월')).toEqual(books);
  });

  it('finishedDate가 없는 책도 사라지지 않고 UNKNOWN_DATE_LABEL 그룹에 포함된다', () => {
    const undatedBook = makeBook({ id: '2', finishedDate: undefined });
    const grouped = groupByMonth([undatedBook]);
    expect(grouped.get(UNKNOWN_DATE_LABEL)).toEqual([undatedBook]);
  });

  it('날짜 있는 책과 없는 책이 섞여도 둘 다 그룹에 남는다 (총 개수 보존)', () => {
    const dated = makeBook({ id: '1', finishedDate: '2026-09-10' });
    const undated = makeBook({ id: '2', finishedDate: undefined });
    const grouped = groupByMonth([dated, undated]);

    const totalGrouped = Array.from(grouped.values()).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalGrouped).toBe(2);
    expect(grouped.get('2026년 9월')).toEqual([dated]);
    expect(grouped.get(UNKNOWN_DATE_LABEL)).toEqual([undated]);
  });

  it('UNKNOWN_DATE_LABEL 그룹은 날짜 그룹들보다 뒤에 삽입된다 (항상 마지막 표시)', () => {
    const undated = makeBook({ id: '2', finishedDate: undefined });
    const dated = makeBook({ id: '1', finishedDate: '2026-09-10' });
    // 입력 순서를 undated 먼저로 줘도 결과 Map의 키 순서는 dated 그룹이 먼저다.
    const grouped = groupByMonth([undated, dated]);
    const keys = Array.from(grouped.keys());
    expect(keys.indexOf(UNKNOWN_DATE_LABEL)).toBe(keys.length - 1);
  });

  it('완독일이 없는 책이 하나도 없으면 UNKNOWN_DATE_LABEL 그룹 자체가 생기지 않는다', () => {
    const grouped = groupByMonth([makeBook({ id: '1', finishedDate: '2026-09-10' })]);
    expect(grouped.has(UNKNOWN_DATE_LABEL)).toBe(false);
  });
});

// ── getDesktopBlockClassName / getMobileBlockClassName ────────
// Bug: 기본(list) 뷰에서 데스크톱 폭 화면에 같은 책이 두 번 렌더링되던 문제.
// 두 블록이 동시에 "md 이상에서 보이는" 상태가 되면 안 된다.

/** className 문자열만 보고 "md 이상 폭에서 실제로 보이는가"를 판정한다. */
function isVisibleAtDesktopWidth(className: string): boolean {
  const c = className.trim();
  if (c.startsWith('hidden') && !c.includes('md:block')) return false; // 항상 숨김
  if (c.includes('md:hidden')) return false; // md 이상에서 숨김
  return true;
}

describe('getDesktopBlockClassName / getMobileBlockClassName', () => {
  // 이 두 블록은 LibraryPage에서 viewMode가 "grid" 또는 "list"일 때만 함께 렌더링된다
  // (timeline/bookshelf는 그 전에 별도 분기로 빠짐).
  const viewModes = ['grid', 'list'] as const;

  it.each(viewModes)('%s 모드에서 데스크톱 블록과 모바일 블록 중 정확히 하나만 md 이상 폭에서 보인다', (mode) => {
    const desktopVisible = isVisibleAtDesktopWidth(getDesktopBlockClassName(mode));
    const mobileVisible = isVisibleAtDesktopWidth(getMobileBlockClassName(mode));
    expect(desktopVisible).toBe(!mobileVisible);
  });

  it('list 모드: 데스크톱 블록은 항상 숨김, 모바일 블록이 md 이상에서도 노출된다', () => {
    expect(getDesktopBlockClassName('list')).toBe('hidden pb-24');
    expect(isVisibleAtDesktopWidth(getMobileBlockClassName('list'))).toBe(true);
  });

  it('grid 모드: 데스크톱 블록이 md 이상에서 노출, 모바일 블록은 md에서 숨김', () => {
    expect(getDesktopBlockClassName('grid')).toBe('hidden md:block pb-24');
    expect(getMobileBlockClassName('grid')).toBe('md:hidden pb-24');
  });
});
