/**
 * 개인 앱 테마(강조색) 프리셋 — 사용자가 '앱 디자인' 설정에서 고르고, <html data-accent="…">로 적용된다.
 *
 * 앱 전체의 강조색은 Tailwind의 indigo·violet 팔레트와 인라인 var(--brand-*)로 쓰이는데,
 * src/styles/accent.css가 그 팔레트를 --brand-*·--brand2-* 변수로 연결하므로 프리셋은 변수 값만 바꾼다.
 * - brand: 주 강조색(버튼·링크·선택 상태). 600은 흰 배경 글자·흰 글자 버튼 모두 WCAG AA(4.5:1) 이상.
 * - brand2: 그라디언트 짝·보조 강조. 600은 같은 기준.
 * - 다크 모드는 300(글자)·900(옅은 배경)을 쓰므로 300은 다크 배경(#0F172A·#1E293B)에서 AA 이상.
 * 값은 accent.css와 반드시 같아야 한다(단위 테스트가 대조).
 */
export type AccentId = 'indigo' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'graphite';

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Scale = readonly [string, string, string, string, string, string, string, string, string, string, string];

export interface AccentPreset {
  id: AccentId;
  name: string;
  description: string;
  brand: Scale;
  brand2: Scale;
}

export const DEFAULT_ACCENT: AccentId = 'indigo';

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  {
    id: 'indigo', name: '인디고', description: '기본 — 차분한 남보라',
    brand: ['#EEF2FF', '#E0E7FF', '#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1', '#4F46E5', '#4338CA', '#3730A3', '#312E81', '#1E1B4B'],
    brand2: ['#F5F3FF', '#EDE9FE', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95', '#2E1065'],
  },
  {
    id: 'ocean', name: '바다', description: '맑은 파랑과 청록',
    brand: ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#172554'],
    brand2: ['#ECFEFF', '#CFFAFE', '#A5F3FC', '#67E8F9', '#22D3EE', '#06B6D4', '#0E7490', '#155E75', '#164E63', '#0F3F50', '#083344'],
  },
  {
    id: 'forest', name: '숲', description: '깊은 초록과 청록',
    brand: ['#ECFDF5', '#D1FAE5', '#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#047857', '#065F46', '#064E3B', '#053F30', '#022C22'],
    brand2: ['#F0FDFA', '#CCFBF1', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0F766E', '#115E59', '#134E4A', '#0F3D3A', '#042F2E'],
  },
  {
    id: 'sunset', name: '노을', description: '따뜻한 주황과 장밋빛',
    brand: ['#FFF7ED', '#FFEDD5', '#FED7AA', '#FDBA74', '#FB923C', '#F97316', '#C2410C', '#9A3412', '#7C2D12', '#5A2310', '#431407'],
    brand2: ['#FFF1F2', '#FFE4E6', '#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E', '#E11D48', '#BE123C', '#9F1239', '#881337', '#4C0519'],
  },
  {
    id: 'rose', name: '로즈', description: '산뜻한 분홍과 보라',
    brand: ['#FDF2F8', '#FCE7F3', '#FBCFE8', '#F9A8D4', '#F472B6', '#EC4899', '#BE185D', '#9D174D', '#831843', '#6D1238', '#500724'],
    brand2: ['#FAF5FF', '#F3E8FF', '#E9D5FF', '#D8B4FE', '#C084FC', '#A855F7', '#9333EA', '#7E22CE', '#6B21A8', '#581C87', '#3B0764'],
  },
  {
    id: 'graphite', name: '먹색', description: '절제된 회색 톤',
    brand: ['#EEF1F5', '#E2E8F0', '#CBD5E1', '#CBD5E1', '#94A3B8', '#64748B', '#334155', '#1E293B', '#0F172A', '#3B4658', '#1E293B'],
    brand2: ['#FAFAFA', '#F4F4F5', '#E4E4E7', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46', '#27272A', '#3F3F46', '#18181B'],
  },
];

export function isAccentId(v: unknown): v is AccentId {
  return typeof v === 'string' && ACCENT_PRESETS.some((p) => p.id === v);
}

export function getAccentPreset(id: string | null | undefined): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0]!;
}

/** 브라우저 상단 바(theme-color) 등 hex가 필요한 곳 — 주 강조색 600 */
export function accentHex(id: string | null | undefined, step: (typeof SCALE_STEPS)[number] = 600): string {
  const p = getAccentPreset(id);
  return p.brand[SCALE_STEPS.indexOf(step)]!;
}
