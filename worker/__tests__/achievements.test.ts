import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS, CHARACTERS, achievedIds, newlyCrossed, characterStageIndex, evolutionsBetween,
} from '../lib/achievements';

const none = new Set<string>();

describe('정의 정합성', () => {
  it('업적 id는 중복 없음', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('캐릭터 단계가 참조하는 업적은 모두 존재하고, 지표가 캐릭터와 같다', () => {
    for (const c of CHARACTERS) {
      expect(c.stages[0]!.achievementId).toBeNull();
      for (const s of c.stages.slice(1)) {
        const a = ACHIEVEMENTS.find((x) => x.id === s.achievementId);
        expect(a, `${c.id}:${s.achievementId}`).toBeDefined();
        expect(a!.type).toBe(c.metric);
      }
    }
  });

  it('캐릭터 단계는 임계치 오름차순', () => {
    for (const c of CHARACTERS) {
      const thresholds = c.stages.slice(1).map((s) => ACHIEVEMENTS.find((a) => a.id === s.achievementId)!.threshold);
      expect([...thresholds].sort((x, y) => x - y)).toEqual(thresholds);
    }
  });
});

describe('achievedIds — 경계값', () => {
  it('0권·0쪽이면 없음', () => {
    expect(achievedIds({ totalDone: 0, totalPages: 0 })).toEqual([]);
  });
  it('임계치와 같으면 달성, 1 모자라면 미달', () => {
    expect(achievedIds({ totalDone: 5, totalPages: 99 })).toEqual(['first_book', '5books']);
    expect(achievedIds({ totalDone: 4, totalPages: 100 })).toEqual(['first_book', '100pages']);
  });
});

describe('newlyCrossed — 이번 행동으로 넘은 임계치만', () => {
  it('첫 완독: 0 → 1권이면 first_book', () => {
    expect(newlyCrossed({ totalDone: 1, totalPages: 0 }, { totalDone: 1 }, none)).toEqual(['first_book']);
  });

  it('기존 사용자 첫 평가(기록 없음): 60권 상태에서 1권 추가해도 과거 업적은 축하하지 않음', () => {
    expect(newlyCrossed({ totalDone: 60, totalPages: 9000 }, { totalDone: 1 }, none)).toEqual([]);
  });

  it('임계치를 정확히 넘는 행동만 잡는다 (24 → 25권)', () => {
    expect(newlyCrossed({ totalDone: 25, totalPages: 0 }, { totalDone: 1 }, none)).toEqual(['25books']);
  });

  it('한 번에 여러 임계치를 넘으면 모두 (세션 1200쪽: 0 → 1200)', () => {
    expect(newlyCrossed({ totalDone: 0, totalPages: 1200 }, { totalPages: 1200 }, none)).toEqual(['100pages', '1000pages']);
  });

  it('이미 기록된 업적은 다시 새로 달성으로 치지 않음', () => {
    expect(newlyCrossed({ totalDone: 1, totalPages: 0 }, { totalDone: 1 }, new Set(['first_book']))).toEqual([]);
  });

  it('delta가 없으면(단순 조회) 새로 달성 없음', () => {
    expect(newlyCrossed({ totalDone: 30, totalPages: 0 }, {}, none)).toEqual([]);
  });
});

describe('캐릭터 단계와 진화', () => {
  const owl = CHARACTERS.find((c) => c.id === 'owl')!;

  it('업적이 없으면 알(0단계)', () => {
    expect(characterStageIndex(owl, none)).toBe(0);
  });

  it('가장 높은 단계 기준 (중간 업적이 빠져 있어도)', () => {
    expect(characterStageIndex(owl, new Set(['first_book', '10books']))).toBe(3);
  });

  it('first_book 기록 시 부엉이 알 → 아기 부엉이로 진화', () => {
    const evo = evolutionsBetween(none, new Set(['first_book']));
    expect(evo).toHaveLength(1);
    expect(evo[0]).toMatchObject({ characterId: 'owl', stageIndex: 1, stageName: '아기 부엉이' });
  });

  it('단계 변화가 없으면 진화 없음', () => {
    expect(evolutionsBetween(new Set(['first_book']), new Set(['first_book']))).toEqual([]);
  });

  it('최종 단계는 왕관', () => {
    const evo = evolutionsBetween(none, new Set(['5000pages']));
    expect(evo[0]).toMatchObject({ characterId: 'dragon', crown: true });
  });
});
