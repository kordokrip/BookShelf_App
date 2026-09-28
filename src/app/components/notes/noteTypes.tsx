/**
 * 노트 종류 이름·아이콘 — 한 곳에서 정의 (빠른 입력 칩·필터 탭·추가 버튼·편집 시트·회고 카드).
 * 조작 요소의 아이콘은 lucide로 통일한다: 이모지(📝💬✍️)는 OS마다 모양이 달라 톤이 흔들리고
 * 스크린리더가 이모지 이름("메모장")까지 읽었다 (2026-09-27 디자인 점검 — 이모지는 캐릭터·업적·축하에만).
 */
import { NotebookPen, Quote, PenLine, Highlighter, type LucideIcon } from "lucide-react";

export const NOTE_TYPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  memo: { label: "메모", Icon: NotebookPen },
  quote: { label: "문구", Icon: Quote },
  review: { label: "독후감", Icon: PenLine },
  highlight: { label: "하이라이트", Icon: Highlighter },
};

/** 아이콘 + 이름 (아이콘은 장식 — 이름이 옆에 있으므로 aria-hidden) */
export function NoteTypeLabel({ type, size = 14, prefix }: { type: string; size?: number; prefix?: string }) {
  const meta = NOTE_TYPE_META[type] ?? NOTE_TYPE_META.memo!;
  const { Icon } = meta;
  return (
    <span className="inline-flex items-center gap-1">
      {prefix}
      <Icon size={size} strokeWidth={2} aria-hidden className="flex-shrink-0" />
      {meta.label}
    </span>
  );
}
