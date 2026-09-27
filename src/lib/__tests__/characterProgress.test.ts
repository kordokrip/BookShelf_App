import { describe, it, expect } from 'vitest';
import { nextStageInfo } from '../characterProgress';
import type { Character } from '../api/achievements';

const owl = (stageIndex: number): Character => ({
  id: 'owl', name: '책 부엉이', description: '', metric: 'books', asset: 'owl', stageIndex,
  stages: [
    { name: '알', emoji: '🥚', crown: false, threshold: 0 },
    { name: '아기', emoji: '🐣', crown: false, threshold: 1 },
    { name: '꼬마', emoji: '🐥', crown: false, threshold: 5 },
    { name: '현자', emoji: '🦉', crown: true, threshold: 10 },
  ],
});

describe('nextStageInfo', () => {
  it('알 단계, 0권 → 다음(아기)까지 1권, 0%', () => {
    expect(nextStageInfo(owl(0), { totalDone: 0, totalPages: 0 })).toEqual({ nextName: '아기', remaining: 1, unit: '권', percent: 0 });
  });

  it('아기 단계, 3권 → 꼬마까지 2권, 구간(1~5) 진행률 50%', () => {
    expect(nextStageInfo(owl(1), { totalDone: 3, totalPages: 0 })).toEqual({ nextName: '꼬마', remaining: 2, unit: '권', percent: 50 });
  });

  it('최종 단계면 다음 없음, 100%', () => {
    expect(nextStageInfo(owl(3), { totalDone: 40, totalPages: 0 })).toEqual({ nextName: null, remaining: 0, unit: '권', percent: 100 });
  });

  it('진행도가 줄어 단계 임계치 아래여도(업적은 회수 안 됨) 음수·초과 없이 0~100', () => {
    const info = nextStageInfo(owl(2), { totalDone: 2, totalPages: 0 });
    expect(info.percent).toBe(0);
    expect(info.remaining).toBe(8);
  });

  it('페이지 캐릭터는 쪽 단위', () => {
    const dragon: Character = { ...owl(0), id: 'dragon', metric: 'pages', stages: [
      { name: '알', emoji: '🥚', crown: false, threshold: 0 },
      { name: '새끼', emoji: '🦎', crown: false, threshold: 100 },
    ] };
    expect(nextStageInfo(dragon, { totalDone: 0, totalPages: 40 })).toMatchObject({ remaining: 60, unit: '쪽', percent: 40 });
  });
});
