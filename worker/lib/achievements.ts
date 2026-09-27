/**
 * 업적·캐릭터 정의와 판정 순수 함수 (리뉴얼 Phase 3, ADR-004).
 *
 * - 업적 8종은 기존 StatsPage BADGES를 그대로 이관(id·임계치 동일) — 이제 서버가 단일 원본이다.
 * - 진행도 기준도 기존과 동일: 완독 권수(books.status='done'), 읽은 페이지(reading_sessions.pages_read 합).
 * - 캐릭터는 업적에 연결된 진화 단계로 표현한다. 첫 단계(알)는 기본 보유, 연결 업적 달성 시 진화.
 * - "새로 달성"은 이번 행동 전후 진행도를 비교해 이번에 넘은 임계치만 센다
 *   → 배포 직후 기존 사용자가 과거 업적을 한꺼번에 축하받는 폭주를 막는다(과거분은 조용히 기록).
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementMetric = 'books' | 'pages';

export interface AchievementDef {
  id: string;
  icon: string;
  label: string;
  description: string;
  threshold: number;
  type: AchievementMetric;
  tier: AchievementTier;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_book', icon: '📖', label: '첫 완독', description: '첫 번째 책을 완독했어요', threshold: 1, type: 'books', tier: 'bronze' },
  { id: '5books', icon: '📚', label: '독서 시작', description: '책 5권을 완독했어요', threshold: 5, type: 'books', tier: 'bronze' },
  { id: '10books', icon: '🥈', label: '독서가', description: '책 10권을 완독했어요', threshold: 10, type: 'books', tier: 'silver' },
  { id: '25books', icon: '🥇', label: '열독가', description: '책 25권을 완독했어요', threshold: 25, type: 'books', tier: 'gold' },
  { id: '50books', icon: '🏆', label: '북마스터', description: '책 50권을 완독했어요', threshold: 50, type: 'books', tier: 'platinum' },
  { id: '100pages', icon: '✨', label: '100p 달성', description: '100페이지를 읽었어요', threshold: 100, type: 'pages', tier: 'bronze' },
  { id: '1000pages', icon: '⭐', label: '1000p 달성', description: '1,000 페이지를 읽었어요', threshold: 1000, type: 'pages', tier: 'silver' },
  { id: '5000pages', icon: '🌟', label: '5000p 달성', description: '5,000 페이지를 읽었어요', threshold: 5000, type: 'pages', tier: 'gold' },
];

export interface CharacterStage {
  /** 이 단계로 진화하는 데 필요한 업적. null이면 기본 단계(처음부터 보유) */
  achievementId: string | null;
  emoji: string;
  name: string;
  /** 최종 단계 장식(왕관) */
  crown?: boolean;
}

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  /** 나중에 일러스트로 교체할 때 쓸 에셋 키 (현재는 이모지 + SVG 프레임으로 렌더링) */
  asset: string;
  stages: readonly CharacterStage[];
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'owl',
    name: '책 부엉이',
    description: '완독한 책이 늘어날수록 자라요',
    metric: 'books',
    asset: 'owl',
    stages: [
      { achievementId: null, emoji: '🥚', name: '부엉이 알' },
      { achievementId: 'first_book', emoji: '🐣', name: '아기 부엉이' },
      { achievementId: '5books', emoji: '🐥', name: '꼬마 부엉이' },
      { achievementId: '10books', emoji: '🐦', name: '날개 돋은 부엉이' },
      { achievementId: '25books', emoji: '🦉', name: '지혜의 부엉이' },
      { achievementId: '50books', emoji: '🦉', name: '책의 현자', crown: true },
    ],
  },
  {
    id: 'dragon',
    name: '페이지 드래곤',
    description: '읽은 페이지가 쌓일수록 자라요',
    metric: 'pages',
    asset: 'dragon',
    stages: [
      { achievementId: null, emoji: '🥚', name: '드래곤 알' },
      { achievementId: '100pages', emoji: '🦎', name: '새끼 도마뱀' },
      { achievementId: '1000pages', emoji: '🐲', name: '어린 용' },
      { achievementId: '5000pages', emoji: '🐉', name: '페이지 드래곤', crown: true },
    ],
  },
];

export interface Progress {
  totalDone: number;
  totalPages: number;
}

/** 진행도로 달성된 업적 id 목록 (정의 순서 유지) */
export function achievedIds(progress: Progress): string[] {
  return ACHIEVEMENTS.filter((a) =>
    (a.type === 'books' ? progress.totalDone : progress.totalPages) >= a.threshold,
  ).map((a) => a.id);
}

/**
 * 이번 행동으로 "새로" 달성한 업적 — 행동 전 진행도(after - delta)로는 미달이었고,
 * 행동 후 진행도로 달성했으며, 아직 기록되지 않은 것만.
 */
export function newlyCrossed(after: Progress, delta: Partial<Progress>, alreadyUnlocked: ReadonlySet<string>): string[] {
  const before: Progress = {
    totalDone: Math.max(0, after.totalDone - (delta.totalDone ?? 0)),
    totalPages: Math.max(0, after.totalPages - (delta.totalPages ?? 0)),
  };
  const beforeSet = new Set(achievedIds(before));
  return achievedIds(after).filter((id) => !beforeSet.has(id) && !alreadyUnlocked.has(id));
}

/** 캐릭터의 현재 단계 인덱스 — 연결 업적이 기록된 가장 높은 단계 */
export function characterStageIndex(character: CharacterDef, unlocked: ReadonlySet<string>): number {
  let index = 0;
  character.stages.forEach((stage, i) => {
    if (stage.achievementId && unlocked.has(stage.achievementId)) index = i;
  });
  return index;
}

export interface Evolution {
  characterId: string;
  characterName: string;
  stageIndex: number;
  stageName: string;
  emoji: string;
  crown: boolean;
}

/** 업적 기록 전후로 단계가 오른 캐릭터 */
export function evolutionsBetween(before: ReadonlySet<string>, after: ReadonlySet<string>): Evolution[] {
  const result: Evolution[] = [];
  for (const character of CHARACTERS) {
    const from = characterStageIndex(character, before);
    const to = characterStageIndex(character, after);
    if (to > from) {
      const stage = character.stages[to]!;
      result.push({
        characterId: character.id,
        characterName: character.name,
        stageIndex: to,
        stageName: stage.name,
        emoji: stage.emoji,
        crown: !!stage.crown,
      });
    }
  }
  return result;
}

export function findAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
