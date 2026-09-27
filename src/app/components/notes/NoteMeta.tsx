/**
 * 노트 부가 정보 줄 — 몰입 구간 배지 + AI 태그 칩.
 * 태그 칩은 노트 검색 화면의 태그 필터로 이동한다. 둘 다 없으면 아무것도 그리지 않는다.
 */
import { Link } from "react-router";
import type { BookNote } from "../../../types/book";

export function NoteMeta({ note, className = "" }: { note: Pick<BookNote, "sessionId" | "tags">; className?: string }) {
  const showFocus = !!note.sessionId;
  const tags = note.tags;
  if (!showFocus && tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {showFocus && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 bg-[#EEF2FF] text-[#3730A3]"
          style={{ fontSize: 11, fontWeight: 700, minHeight: 24 }}
          title="몰입 타이머 구간에 작성한 메모"
        >
          ⏱ 몰입
        </span>
      )}
      {tags.map((tag) => (
        <Link
          key={tag}
          to={`/notes-search?tag=${encodeURIComponent(tag)}`}
          className="inline-flex items-center rounded-full px-2.5 bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition-colors"
          // 전역 a:not([role]) { min-height: unset }(index.css)이 클래스를 이기므로 인라인으로 24px 보장 (WCAG 2.5.8)
          style={{ fontSize: 11, fontWeight: 600, minHeight: 24 }}
          aria-label={`태그 ${tag}로 노트 찾기`}
        >
          #{tag}
        </Link>
      ))}
    </div>
  );
}
