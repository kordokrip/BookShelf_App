/**
 * 완독 서재 툴바 — [보기 전환][정렬] … [검색][장르][컬렉션]
 * 책 목록이 화면 위쪽에 오도록 검색·장르·컬렉션을 아이콘 한 줄로 합쳤다.
 * - 검색: 아이콘을 누르면 한 줄 전체가 입력창으로 바뀐다 (← 또는 Esc로 닫고 검색어 비움)
 * - 장르: 아래에서 올라오는 시트에 칩을 줄바꿈으로 나열, 고르면 시트가 닫힘
 * - 선택된 장르는 줄 아래 칩 하나로 표시(눌러서 해제)
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, BookMarked, ChevronDown, FolderOpen, GitBranch, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import type { GenreKey } from "../../../types/book";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

export type ViewMode = "grid" | "list" | "timeline" | "bookshelf";
export type SortKey = "date" | "rating" | "title";

const SORT_OPTIONS = [
  { value: "date" as const, label: "최근순" },
  { value: "rating" as const, label: "평점순" },
  { value: "title" as const, label: "제목순" },
];

const VIEW_OPTIONS = [
  { v: "list" as const, icon: <List size={14} />, label: "리스트" },
  { v: "grid" as const, icon: <LayoutGrid size={14} />, label: "그리드" },
  { v: "bookshelf" as const, icon: <BookMarked size={14} />, label: "책장" },
  { v: "timeline" as const, icon: <GitBranch size={14} />, label: "타임라인" },
];

const ICON_BTN =
  "relative flex items-center justify-center rounded-xl text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors flex-shrink-0";

/* ─── 정렬 드롭다운 ─── */
function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === value)!;
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`정렬: ${current.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center justify-center gap-0.5 h-11 min-w-[36px] px-1 text-[#64748B] dark:text-[#94A3B8]"
        style={{ fontSize: 14, fontWeight: 400 }}
      >
        <span className="hidden min-[360px]:inline">{current.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-lg z-50 overflow-hidden min-w-[96px]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="menuitemradio"
              aria-checked={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#334155]"
              style={{ fontSize: 13, fontWeight: opt.value === value ? 700 : 400, color: opt.value === value ? "var(--brand-600)" : undefined }}
            >
              <span className={opt.value === value ? "" : "text-[#374151] dark:text-[#CBD5E1]"}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 장르 칩 (GenreFilterBar와 같은 스타일, 줄바꿈 배치) ─── */
function GenreChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border transition-all"
      style={{
        height: 36,
        paddingLeft: 14,
        paddingRight: 14,
        backgroundColor: active ? "var(--brand-600)" : "var(--bg-card)",
        borderColor: active ? "var(--brand-600)" : "var(--border-color)",
        color: active ? "white" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "var(--font-pretendard)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 3, color: active ? "#fff" : "var(--text-secondary)" }}>{count}</span>
    </button>
  );
}

interface LibraryToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  sortBy: SortKey;
  onSortChange: (v: SortKey) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  genres: GenreKey[];
  genreCounts: Record<string, number>;
  totalCount: number;
  selectedGenre: GenreKey | null;
  onGenreChange: (g: GenreKey | null) => void;
}

export function LibraryToolbar({
  viewMode, onViewModeChange, sortBy, onSortChange, searchQuery, onSearchChange,
  genres, genreCounts, totalCount, selectedGenre, onGenreChange,
}: LibraryToolbarProps) {
  const [searching, setSearching] = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const wasSearching = useRef(false);

  // 검색 모드가 열리면 입력창에, 닫히면 검색 아이콘에 포커스
  useEffect(() => {
    if (searching) inputRef.current?.focus();
    else if (wasSearching.current) searchBtnRef.current?.focus();
    wasSearching.current = searching;
  }, [searching]);

  const closeSearch = () => { onSearchChange(""); setSearching(false); };
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="px-3 xs:px-4 sm:px-6 pb-2">
      {searching ? (
        <div className="flex items-center gap-1 h-11">
          <button onClick={closeSearch} aria-label="검색 닫기" className={ICON_BTN} style={{ width: 44, height: 44 }}>
            <ArrowLeft size={18} />
          </button>
          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); closeSearch(); } }}
              placeholder="제목 또는 저자 검색…"
              aria-label="제목 또는 저자 검색"
              className="w-full h-11 bg-[#F1F5F9] dark:bg-[#334155] rounded-xl pl-3 pr-10 text-sm text-[#1E293B] dark:text-[#F8FAFC] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] outline-none border border-transparent focus:border-indigo-600/30 focus:bg-white dark:focus:bg-[#1E293B] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => { onSearchChange(""); inputRef.current?.focus(); }}
                aria-label="검색어 지우기"
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1 min-w-0">
          <div className="flex items-center gap-0.5 min-w-0">
            <div className="flex items-center bg-[#F1F5F9] dark:bg-[#334155] rounded-xl p-0.5 flex-shrink-0">
              {VIEW_OPTIONS.map(({ v, icon, label }) => (
                <button
                  key={v}
                  onClick={() => onViewModeChange(v)}
                  aria-label={label}
                  aria-pressed={viewMode === v}
                  title={label}
                  // 320px 폭에서도 한 줄에 들어가도록 360px 미만은 30px (높이 44px 유지)
                  className="flex items-center justify-center -my-2 w-[30px] min-[360px]:w-[34px] h-11"
                >
                  <span
                    className={`flex items-center justify-center rounded-lg transition-all ${viewMode === v ? "bg-white dark:bg-[#1E293B] shadow-sm text-indigo-600 dark:text-indigo-300" : "text-[#64748B] dark:text-[#94A3B8]"}`}
                    style={{ width: 28, height: 28 }}
                  >
                    {icon}
                  </span>
                </button>
              ))}
            </div>
            <SortDropdown value={sortBy} onChange={onSortChange} />
          </div>
          <div className="flex items-center flex-shrink-0">
            <button
              ref={searchBtnRef}
              onClick={() => setSearching(true)}
              aria-label={hasQuery ? "검색 (검색어 적용 중)" : "검색"}
              className={`${ICON_BTN} w-9 min-[360px]:w-10 h-11`}
            >
              <Search size={18} />
              {hasQuery && <span aria-hidden className="absolute top-2.5 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--brand-600)" }} />}
            </button>
            <button
              onClick={() => setGenreOpen(true)}
              aria-label={selectedGenre ? `장르 필터 (${selectedGenre} 선택됨)` : "장르 필터"}
              aria-haspopup="dialog"
              className={`${ICON_BTN} w-9 min-[360px]:w-10 h-11`}
            >
              <SlidersHorizontal size={18} />
              {selectedGenre && <span aria-hidden className="absolute top-2.5 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--brand-600)" }} />}
            </button>
            <Link to="/collections" aria-label="컬렉션" title="컬렉션" className={`${ICON_BTN} w-9 min-[360px]:w-10 h-11`}>
              <FolderOpen size={18} />
            </Link>
          </div>
        </div>
      )}

      {/* 선택된 장르 — 칩 하나로 표시, 누르면 해제 */}
      {selectedGenre && !searching && (
        <div className="mt-1">
          <button
            onClick={() => onGenreChange(null)}
            aria-label={`${selectedGenre} 필터 해제`}
            className="inline-flex items-center gap-1 rounded-full text-white"
            style={{ height: 32, paddingLeft: 12, paddingRight: 10, backgroundColor: "var(--brand-600)", fontSize: 13, fontWeight: 500 }}
          >
            {selectedGenre}
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      <Sheet open={genreOpen} onOpenChange={setGenreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>장르</SheetTitle>
            <SheetDescription className="sr-only">보고 싶은 장르를 고르면 목록이 그 장르로 좁혀져요.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <GenreChip
              label="전체"
              count={totalCount}
              active={selectedGenre === null}
              onClick={() => { onGenreChange(null); setGenreOpen(false); }}
            />
            {genres.map((g) => {
              const count = genreCounts[g] ?? 0;
              if (count === 0) return null;
              const active = selectedGenre === g;
              return (
                <GenreChip
                  key={g}
                  label={g}
                  count={count}
                  active={active}
                  onClick={() => { onGenreChange(active ? null : g); setGenreOpen(false); }}
                />
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
