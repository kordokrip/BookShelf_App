import { describe, it, expect } from 'vitest';
import { parseNoteMarkup, stripNoteMarkup, wrapSelection, formatNotePages } from '../noteMarkup';

describe('parseNoteMarkup', () => {
  it('서식 없는 문장은 text 하나', () => {
    expect(parseNoteMarkup('그냥 메모')).toEqual([{ kind: 'text', text: '그냥 메모' }]);
  });

  it('굵게와 하이라이트를 분리한다', () => {
    expect(parseNoteMarkup('앞 **강조** 중간 ==형광== 끝')).toEqual([
      { kind: 'text', text: '앞 ' },
      { kind: 'bold', text: '강조' },
      { kind: 'text', text: ' 중간 ' },
      { kind: 'highlight', text: '형광' },
      { kind: 'text', text: ' 끝' },
    ]);
  });

  it('닫히지 않은 기호는 글자로 남긴다', () => {
    expect(parseNoteMarkup('**열기만')).toEqual([{ kind: 'text', text: '**열기만' }]);
    expect(parseNoteMarkup('a == b')).toEqual([{ kind: 'text', text: 'a == b' }]);
  });

  it('빈 구간(****)은 서식이 아님', () => {
    expect(parseNoteMarkup('****')).toEqual([{ kind: 'text', text: '****' }]);
  });

  it('줄바꿈을 넘는 서식은 인정하지 않는다', () => {
    expect(parseNoteMarkup('**첫줄\n둘째줄**')).toEqual([{ kind: 'text', text: '**첫줄\n둘째줄**' }]);
  });

  it('HTML은 서식이 아니라 그대로 텍스트 (렌더러가 이스케이프)', () => {
    const html = '<img src=x onerror=alert(1)>';
    expect(parseNoteMarkup(`**${html}**`)).toEqual([{ kind: 'bold', text: html }]);
  });
});

describe('stripNoteMarkup', () => {
  it('기호만 제거', () => {
    expect(stripNoteMarkup('**굵게** 그리고 ==형광==')).toBe('굵게 그리고 형광');
  });
});

describe('wrapSelection', () => {
  it('선택 영역을 감싸고 선택을 안쪽으로 유지', () => {
    expect(wrapSelection('abc def', 4, 7, '**')).toEqual({ value: 'abc **def**', selectionStart: 6, selectionEnd: 9 });
  });

  it('선택이 없으면 기호 쌍 사이에 커서', () => {
    expect(wrapSelection('ab', 1, 1, '==')).toEqual({ value: 'a====b', selectionStart: 3, selectionEnd: 3 });
  });
});

describe('formatNotePages', () => {
  it('없음 / 단일 / 범위', () => {
    expect(formatNotePages()).toBe('');
    expect(formatNotePages(12)).toBe('p.12');
    expect(formatNotePages(12, 12)).toBe('p.12');
    expect(formatNotePages(12, 15)).toBe('p.12–15');
  });
});
