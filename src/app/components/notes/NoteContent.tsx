/**
 * 노트 본문 렌더러 — `**굵게**` / `==하이라이트==`를 React 요소로 그린다.
 * HTML을 주입하지 않으므로(dangerouslySetInnerHTML 미사용) 사용자 입력이 그대로 이스케이프된다.
 */
import { useMemo } from "react";
import { parseNoteMarkup } from "../../../lib/noteMarkup";

export function NoteContent({ content }: { content: string }) {
  const segments = useMemo(() => parseNoteMarkup(content), [content]);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "bold") return <strong key={i} style={{ fontWeight: 700 }}>{seg.text}</strong>;
        if (seg.kind === "highlight") {
          return (
            <mark key={i} className="rounded-sm px-0.5 text-inherit [box-decoration-break:clone] [-webkit-box-decoration-break:clone]" style={{ backgroundColor: "var(--highlight)" }}>
              {seg.text}
            </mark>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}
