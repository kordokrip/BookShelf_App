import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, X, Check, ChevronRight, PenLine, Star } from "lucide-react";
import { useBookSearch } from "../../hooks/useBookSearch";
import { useAddBook } from "../../hooks/useBooks";
import type { GenreKey, BookStatus } from "../../types/book";
import { GENRE_CONFIG, COVER_GRADIENTS } from "../../types/book";
import { Skeleton } from "../components/ui/skeleton";
import type { SearchBook } from "../../lib/api";

/* ─── 타입 ──────────────────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4;

interface FormState {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  totalPages: string;
  genre: GenreKey;
  status: BookStatus;
  finishedDate: string;
  rating: number;
  goalDate: string;
  currentPage: string;
  coverEmoji: string;
  coverColor: string; // COVER_GRADIENTS 중 하나
}

const INITIAL_FORM: FormState = {
  title: "",
  author: "",
  publisher: "",
  isbn: "",
  totalPages: "",
  genre: "기타",
  status: "reading",
  finishedDate: "",
  rating: 0,
  goalDate: "",
  currentPage: "",
  coverEmoji: "📚",
  coverColor: COVER_GRADIENTS[0] ?? "from-indigo-500 to-violet-600",
};

/* ─── cn 유틸 ───────────────────────────────────────────────── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ─── 단계 표시기 ───────────────────────────────────────────── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 border-b border-border/50 flex-shrink-0">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                done && "bg-emerald-500 text-white",
                active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            {i < total - 1 && (
              <div className={cn("h-0.5 w-8 rounded-full", done ? "bg-emerald-500" : "bg-border")} />
            )}
          </div>
        );
      })}
      <span className="ml-1 text-xs text-muted-foreground font-medium">{current}/{total}</span>
    </div>
  );
}

/* ─── Step 1: 책 검색 ───────────────────────────────────────── */
function StepSearch({
  onSelect,
  onManual,
}: {
  onSelect: (book: SearchBook) => void;
  onManual: () => void;
}) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const { data, isLoading } = useBookSearch(query);
  const books = data?.books ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <p className="text-lg font-bold text-foreground">어떤 책인가요?</p>
        <p className="text-sm text-muted-foreground mt-0.5">제목이나 저자로 검색하세요</p>
      </div>

      {/* 검색 입력 */}
      <div className="px-4 mb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="책 제목 또는 저자명..."
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            autoFocus
            className="w-full h-11 bg-muted rounded-xl pl-9 pr-9 text-sm outline-none border border-transparent focus:border-primary/50 focus:bg-background transition-colors"
          />
          {rawQuery && (
            <button
              onClick={() => { setRawQuery(""); setQuery(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 결과 목록 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading && query.length >= 2 && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && books.length > 0 && (
          <div className="space-y-2">
            {books.map((book, i) => (
              <button
                key={i}
                onClick={() => onSelect(book)}
                className="w-full p-3 bg-card border border-border/50 rounded-xl flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">📚</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm line-clamp-2 leading-snug">
                    {book.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>
                  {book.publisher && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{book.publisher}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!isLoading && query.length >= 2 && books.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium text-foreground text-sm">검색 결과가 없어요</p>
            <p className="text-xs text-muted-foreground mt-1">직접 입력으로 등록해보세요</p>
          </div>
        )}

        {query.length < 2 && (
          <div className="py-8 text-center text-muted-foreground/60 text-sm">
            2글자 이상 입력 시 자동 검색됩니다
          </div>
        )}
      </div>

      {/* 직접 입력 버튼 */}
      <div className="px-4 py-4 flex-shrink-0 border-t border-border">
        <button
          onClick={onManual}
          className="w-full h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <PenLine className="h-4 w-4" />
          직접 입력하기
        </button>
      </div>
    </div>
  );
}

/* ─── Step 2: 책 정보 입력 ──────────────────────────────────── */
function StepBookInfo({
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
            <input
              type="number"
              min={1}
              value={form.totalPages}
              onChange={(e) => update({ totalPages: e.target.value })}
              placeholder="페이지 수 (선택)"
              className={inputClass}
            />
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
        </div>
      </div>

      <div className="px-4 py-4 flex-shrink-0 border-t border-border">
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

/* ─── Step 3: 독서 상태 + 커버 ─────────────────────────────── */
function StepStatusCover({
  form,
  update,
  onNext,
}: {
  form: FormState;
  update: (patch: Partial<FormState>) => void;
  onNext: () => void;
}) {
  const STATUS_OPTIONS: { value: BookStatus; label: string; emoji: string }[] = [
    { value: "reading", label: "읽는 중",   emoji: "📖" },
    { value: "done",    label: "완독",       emoji: "✅" },
    { value: "wish",    label: "위시리스트", emoji: "🔖" },
  ];

  const inputClass =
    "w-full h-11 px-3 rounded-xl border border-border bg-muted text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pt-4 pb-3">
          <p className="text-lg font-bold text-foreground">독서 상태 & 커버</p>
          <p className="text-sm text-muted-foreground mt-0.5">현재 독서 상태와 커버를 설정하세요</p>
        </div>

        {/* 상태 선택 */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ status: opt.value })}
              className={cn(
                "py-4 rounded-xl border flex flex-col items-center gap-1.5 transition-all",
                form.status === opt.value
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* 읽는 중: 현재 페이지 + 목표 완독일 */}
        {form.status === "reading" && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                현재 페이지
              </label>
              <input
                type="number"
                min={0}
                value={form.currentPage}
                onChange={(e) => update({ currentPage: e.target.value })}
                placeholder="현재 읽은 페이지 (선택)"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                목표 완독일
              </label>
              <input
                type="date"
                value={form.goalDate}
                onChange={(e) => update({ goalDate: e.target.value })}
                title="목표 완독일"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* 완독: 완독일 + 별점 */}
        {form.status === "done" && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">완독일</label>
              <input
                type="date"
                value={form.finishedDate}
                onChange={(e) => update({ finishedDate: e.target.value })}
                title="완독일"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">별점</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => update({ rating: n === form.rating ? 0 : n })}
                    aria-label={`${n}점`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        n <= form.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 커버 그라디언트 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">커버 색상</label>
          <div className="grid grid-cols-4 gap-2">
            {COVER_GRADIENTS.map((gradient) => (
              <button
                key={gradient}
                onClick={() => update({ coverColor: gradient })}
                className={cn(
                  "h-14 rounded-xl bg-gradient-to-br transition-all",
                  gradient,
                  form.coverColor === gradient && "ring-2 ring-offset-2 ring-primary scale-105"
                )}
                aria-label={gradient}
              />
            ))}
          </div>
        </div>

        {/* 커버 미리보기 */}
        <div className="flex justify-center pt-2 pb-4">
          <div
            className={cn(
              "w-24 h-32 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
              form.coverColor
            )}
          >
            <span className="text-4xl">{form.coverEmoji}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex-shrink-0 border-t border-border">
        <button
          onClick={onNext}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          다음
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: 최종 확인 ─────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function StepConfirm({
  form,
  isLoading,
  error,
  onSubmit,
}: {
  form: FormState;
  isLoading: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const STATUS_LABELS: Record<BookStatus, string> = {
    reading: "📖 읽는 중",
    done:    "✅ 완독",
    wish:    "🔖 위시리스트",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pt-4 pb-3">
          <p className="text-lg font-bold text-foreground">등록 확인</p>
          <p className="text-sm text-muted-foreground mt-0.5">아래 정보로 책을 등록합니다</p>
        </div>

        {/* 커버 카드 미리보기 */}
        <div
          className={cn(
            "w-full rounded-2xl bg-gradient-to-br p-5 flex items-center gap-4 mb-5 shadow-md",
            form.coverColor
          )}
        >
          <div className="w-16 h-20 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <span className="text-4xl">{form.coverEmoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base line-clamp-2 leading-snug">{form.title}</p>
            <p className="text-white/80 text-sm mt-1">{form.author}</p>
            {form.publisher && (
              <p className="text-white/60 text-xs mt-0.5">{form.publisher}</p>
            )}
          </div>
        </div>

        {/* 상세 정보 */}
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/50">
          <InfoRow label="장르" value={`${GENRE_CONFIG[form.genre]?.emoji ?? ""} ${form.genre}`} />
          <InfoRow label="상태" value={STATUS_LABELS[form.status]} />
          {form.totalPages ? <InfoRow label="총 페이지" value={`${form.totalPages}p`} /> : null}
          {form.status === "reading" && form.currentPage ? (
            <InfoRow label="현재 페이지" value={`${form.currentPage}p`} />
          ) : null}
          {form.status === "reading" && form.goalDate ? (
            <InfoRow label="목표 완독일" value={form.goalDate} />
          ) : null}
          {form.status === "done" && form.finishedDate ? (
            <InfoRow label="완독일" value={form.finishedDate} />
          ) : null}
          {form.status === "done" && form.rating > 0 ? (
            <InfoRow label="별점" value={"⭐".repeat(form.rating)} />
          ) : null}
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}
      </div>

      <div className="px-4 py-4 flex-shrink-0 border-t border-border">
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {isLoading ? "등록 중..." : "📚 책 등록하기"}
        </button>
      </div>
    </div>
  );
}

/* ─── 메인 페이지 ───────────────────────────────────────────── */
export function RegisterFlowPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const addBook = useAddBook();

  const update = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const fillFromSearch = (book: SearchBook) => {
    update({
      title:      book.title,
      author:     book.author,
      publisher:  book.publisher ?? "",
      isbn:       book.isbn,
      totalPages: book.pageCount ? String(book.pageCount) : "",
    });
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await addBook.mutateAsync({
        title:        form.title,
        author:       form.author,
        publisher:    form.publisher || undefined,
        isbn:         form.isbn || undefined,
        genre:        form.genre,
        coverEmoji:   form.coverEmoji,
        coverColor:   form.coverColor,
        status:       form.status,
        totalPages:   form.totalPages ? parseInt(form.totalPages, 10) : undefined,
        currentPage:  form.currentPage ? parseInt(form.currentPage, 10) : 0,
        finishedDate:
          form.status === "done" && form.finishedDate ? form.finishedDate : undefined,
        goalDate:
          form.status === "reading" && form.goalDate ? form.goalDate : undefined,
        rating:
          form.status === "done" && form.rating > 0 ? form.rating : undefined,
      });
      navigate("/library");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "등록에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const STEP_LABELS = ["책 찾기", "책 정보", "상태 & 커버", "최종 확인"];

  const prev = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else navigate(-1);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
        <button
          onClick={prev}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">{step > 1 ? "이전" : "뒤로"}</span>
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-foreground text-base leading-none">책 등록</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{STEP_LABELS[step - 1]}</p>
        </div>
      </div>

      {/* 단계 표시기 */}
      <StepIndicator current={step} total={4} />

      {/* 단계 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {step === 1 && (
          <StepSearch onSelect={fillFromSearch} onManual={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepBookInfo form={form} update={update} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <StepStatusCover form={form} update={update} onNext={() => setStep(4)} />
        )}
        {step === 4 && (
          <StepConfirm
            form={form}
            isLoading={addBook.isPending}
            error={submitError}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
