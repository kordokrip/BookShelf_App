/**
 * 노트 부가 정보 줄 — 몰입 구간 배지 + AI 태그 칩.
 * 태그 칩은 노트 검색 화면의 태그 필터로 이동한다. 둘 다 없으면 아무것도 그리지 않는다.
 */
import { directionParticle } from "../../../lib/koreanParticle";
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
          className="inline-flex items-center gap-1 rounded-full px-2 bg-indigo-50 text-indigo-800"
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
          className="relative inline-flex items-center rounded-full px-3 bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']"
          // 전역 a:not([role]) { min-height: unset }(index.css)이 클래스를 이기므로 인라인으로 높이를 준다.
          // 보이는 칩은 32px, 위아래 투명 영역(after)까지 눌리는 범위는 44px (2026-10-11 반응형 점검)
          style={{ fontSize: 12, fontWeight: 600, minHeight: 32 }}
          aria-label={`태그 ${tag}${directionParticle(tag)} 노트 찾기`}
        >
          #{tag}
        </Link>
      ))}
    </div>
  );
}
