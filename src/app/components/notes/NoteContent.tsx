/**
 * 노트 본문 렌더러 — `**굵게**` / `==하이라이트==`를 React 요소로 그린다.
 * HTML을 주입하지 않으므로(dangerouslySetInnerHTML 미사용) 사용자 입력이 그대로 이스케이프된다.
 * notes_v2 플래그가 꺼진 사용자는 원문 그대로 표시 — 별표·등호를 글자로 쓴 기존 노트의 모양이 바뀌지 않도록.
 */
import { useMemo } from "react";
import { parseNoteMarkup } from "../../../lib/noteMarkup";
import { useFlag } from "../../../hooks/useFeatureFlags";

export function NoteContent({ content }: { content: string }) {
  const enabled = useFlag("notes_v2");
  const segments = useMemo(() => (enabled ? parseNoteMarkup(content) : null), [content, enabled]);
  if (!segments) return <>{content}</>;
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "bold") return <strong key={i} style={{ fontWeight: 700 }}>{seg.text}</strong>;
        if (seg.kind === "highlight") {
          return (
            <mark key={i} className="rounded px-0.5 bg-yellow-200 text-inherit dark:bg-yellow-400/30">
              {seg.text}
            </mark>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}
