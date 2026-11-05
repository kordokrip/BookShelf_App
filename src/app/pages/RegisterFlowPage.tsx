/**
 * 도서 등록 팔로우 페이지
 * - 스텝 1: 카카오/네이버 API 도서 검색
 * - 스텝 2: 도서 정보 편집 (제목·저자·평점 등)
 * - 스텝 3: 상태 / 장르 선택 후 등록
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAddBook } from "../../hooks/useBooks";
import { GENRE_CONFIG, detectGenre } from "../../types/book";
import type { SearchBook } from "../../lib/api";
import { SafeAreaTop } from "../components/navigation/SafeAreaTop";
import { type Step, type FormState, INITIAL_FORM } from "../components/registerFlow/registerForm";
import { StepIndicator } from "../components/registerFlow/StepIndicator";
import { StepSearch } from "../components/registerFlow/StepSearch";
import { StepBookInfo } from "../components/registerFlow/StepBookInfo";
import { StepStatusCover } from "../components/registerFlow/StepStatusCover";
import { StepConfirm } from "../components/registerFlow/StepConfirm";

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
    const autoGenre = detectGenre(book.category ?? null, book.title, book.description);
    update({
      title:      book.title,
      author:     book.author,
      publisher:  book.publisher ?? "",
      isbn:       book.isbn,
      totalPages: book.pageCount ? String(book.pageCount) : "",
      coverImage: book.coverImage ?? "",
      genre:      autoGenre,
      coverEmoji: GENRE_CONFIG[autoGenre]?.emoji ?? "📚",
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
        coverImage:   form.coverImage || undefined,
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
      // 등록한 상태에 맞는 목록으로 이동 (wish → 읽을 책, reading → 읽는 중, done → 서재)
      navigate(form.status === "wish" ? "/wishlist" : form.status === "reading" ? "/reading" : "/");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "등록에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const STEP_LABELS = ["책 찾기", "책 정보", "독서 상태", "최종 확인"];

  const prev = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else navigate(-1);
  };

  return (
    <main className="flex flex-col min-h-[var(--vp-h)] bg-background dark:bg-[#0F172A]">
      {/* iOS 노치 / Dynamic Island / PWA standalone 상단 안전 영역 — 스크롤해도 콘텐츠가 노치 아래로 비치지 않게 고정 */}
      <SafeAreaTop />

      <div className="flex flex-col flex-1 w-full max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
          <button
            type="button"
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
    </main>
  );
}
