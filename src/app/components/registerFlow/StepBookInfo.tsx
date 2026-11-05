import { useState, useEffect, useRef } from "react";
import { Loader2, Globe } from "lucide-react";
import { type GenreKey, GENRE_CONFIG, detectGenre } from "../../../types/book";
import { searchApi } from "../../../lib/api";
import { type FormState, cn } from "./registerForm";

/* ─── Step 2: 책 정보 입력 ──────────────────────────────────── */
export function StepBookInfo({
  form,
  update,
  onNext,
}: {
  form: FormState;
  update: (patch: Partial<FormState>) => void;
  onNext: () => void;
}) {
  const genres = Object.keys(GENRE_CONFIG) as GenreKey[];
  const canNext = form.title.trim().length > 0 && form.author.trim().length > 0;
  const [isFetchingPages, setIsFetchingPages] = useState(false);
  const autoFetchedRef = useRef(false);

  /** 서버에서 페이지 수 + 장르 조회 (국립중앙도서관·Open Library·KDC·AI 분류) */
  async function handleFetchPageCount() {
    if (isFetchingPages || (!form.isbn && !form.title)) return;
    setIsFetchingPages(true);
    try {
      const result = await searchApi.getPageCount({
        isbn: form.isbn || undefined,
        title: form.title || undefined,
        author: form.author || undefined,
        publisher: form.publisher || undefined,
      });

      const patch: Partial<FormState> = {};

      if (result.pageCount && result.pageCount > 0) {
        patch.totalPages = String(result.pageCount);
      }

      // 서버가 정한 장르(KDC·AI 분류) 우선, 없으면 제목 키워드로 추정 — '기타'면 바꾸지 않는다
      const serverGenre = result.genre && result.genre in GENRE_CONFIG ? (result.genre as GenreKey) : null;
      const detectedGenre = serverGenre ?? detectGenre(null, form.title, null);
      if (detectedGenre !== '기타') {
        patch.genre = detectedGenre;
        patch.coverEmoji = GENRE_CONFIG[detectedGenre]?.emoji ?? form.coverEmoji;
      }

      if (Object.keys(patch).length > 0) {
        update(patch);
      }
    } catch {
      // 실패 시 무시 — 사용자가 직접 입력 가능
    } finally {
      setIsFetchingPages(false);
    }
  }

  // Step 2 진입 시 totalPages가 비어있으면 자동 조회
  useEffect(() => {
    if (autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    if (!form.totalPages && (form.isbn || form.title)) {
      handleFetchPageCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputClass =
    "w-full h-11 px-3 rounded-xl border border-border bg-muted text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pt-4 pb-3">
          <p className="text-lg font-bold text-foreground">책 정보</p>
          <p className="text-sm text-muted-foreground mt-0.5">정보를 확인하거나 직접 입력하세요</p>
        </div>

        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              제목 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="책 제목"
              className={inputClass}
            />
          </div>

          {/* 저자 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              저자 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => update({ author: e.target.value })}
              placeholder="저자명"
              className={inputClass}
            />
          </div>

          {/* 출판사 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">출판사</label>
            <input
              type="text"
              value={form.publisher}
              onChange={(e) => update({ publisher: e.target.value })}
              placeholder="출판사 (선택)"
              className={inputClass}
            />
          </div>

          {/* 총 페이지 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">총 페이지</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99999}
                aria-valuemin={1}
                aria-valuemax={99999}
                value={form.totalPages}
                onChange={(e) => update({ totalPages: e.target.value })}
                placeholder="페이지 수 (선택)"
                className={cn(inputClass, "flex-1")}
              />
              <button
                type="button"
                onClick={handleFetchPageCount}
                disabled={isFetchingPages || (!form.isbn && !form.title)}
                title="Google Books에서 페이지 수 자동 조회"
                className="flex-shrink-0 h-11 px-3 rounded-xl border border-primary/40 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {isFetchingPages ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                {isFetchingPages ? "조회 중" : "웹에서 가져오기"}
              </button>
            </div>
            {isFetchingPages && (
              <p className="text-xs text-muted-foreground mt-1">
                Google Books에서 페이지 정보를 가져오고 있어요...
              </p>
            )}
          </div>

          {/* 장르 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">장르</label>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => {
                const cfg = GENRE_CONFIG[g];
                const active = form.genre === g;
                return (
                  <button
                    key={g}
                    onClick={() => update({ genre: g, coverEmoji: cfg.emoji })}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cfg.emoji} {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 책 표지 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">책 표지</label>
            {form.coverImage ? (
              <div className="flex items-start gap-3">
                <img
                  src={form.coverImage}
                  alt="책 표지"
                  loading="lazy"
                  className="w-14 aspect-[2/3] rounded-lg object-cover shadow-sm border border-border"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-xs text-muted-foreground">검색에서 가져온 표지</p>
                  <button
                    type="button"
                    onClick={() => update({ coverImage: "" })}
                    className="text-xs text-destructive/70 hover:text-destructive text-left"
                  >
                    제거
                  </button>
                </div>
              </div>
            ) : (
              <input
                type="url"
                value={form.coverImage}
                onChange={(e) => update({ coverImage: e.target.value })}
                placeholder="표지 이미지 URL (선택)"
                className={inputClass}
              />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 flex-shrink-0 border-t border-border" style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          다음
        </button>
      </div>
    </div>
  );
}
