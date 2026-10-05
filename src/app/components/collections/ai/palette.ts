/** AI 컬렉션 구분 색 — 막대·카드 강조에 같은 순서로 쓴다 (Tailwind 팔레트: indigo/violet 우선) */
export const AI_COLLECTION_COLORS = [
  { bar: 'bg-indigo-600 dark:bg-indigo-400', dot: 'bg-indigo-600 dark:bg-indigo-400', ring: 'border-indigo-200 dark:border-indigo-800' },
  { bar: 'bg-violet-600 dark:bg-violet-400', dot: 'bg-violet-600 dark:bg-violet-400', ring: 'border-violet-200 dark:border-violet-800' },
  { bar: 'bg-sky-600 dark:bg-sky-400', dot: 'bg-sky-600 dark:bg-sky-400', ring: 'border-sky-200 dark:border-sky-800' },
  { bar: 'bg-emerald-600 dark:bg-emerald-400', dot: 'bg-emerald-600 dark:bg-emerald-400', ring: 'border-emerald-200 dark:border-emerald-800' },
  { bar: 'bg-amber-500 dark:bg-amber-400', dot: 'bg-amber-500 dark:bg-amber-400', ring: 'border-amber-200 dark:border-amber-800' },
  { bar: 'bg-rose-600 dark:bg-rose-400', dot: 'bg-rose-600 dark:bg-rose-400', ring: 'border-rose-200 dark:border-rose-800' },
  { bar: 'bg-teal-600 dark:bg-teal-400', dot: 'bg-teal-600 dark:bg-teal-400', ring: 'border-teal-200 dark:border-teal-800' },
  { bar: 'bg-fuchsia-600 dark:bg-fuchsia-400', dot: 'bg-fuchsia-600 dark:bg-fuchsia-400', ring: 'border-fuchsia-200 dark:border-fuchsia-800' },
] as const;

export function collectionColor(i: number) {
  return AI_COLLECTION_COLORS[i % AI_COLLECTION_COLORS.length]!;
}

export interface SavedInfo {
  id: string;
  /** 이미 같은 이름이 있어 기존 컬렉션으로 연결된 경우 */
  existed: boolean;
}
