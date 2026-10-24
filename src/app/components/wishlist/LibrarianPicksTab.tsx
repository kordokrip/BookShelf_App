import { useMemo, useState } from "react";
import { useLibrarianPicks } from "../../../hooks/useDiscover";
import { useAddBook } from "../../../hooks/useBooks";
import { useToast } from "../ui/Toast";
import { ApiError } from "../../../lib/api";
import type { LibrarianPick } from "../../../lib/api";
import { GENRE_CONFIG, type GenreKey } from "../../../types/book";
import { BookCoverImg, ErrorEmpty, SkeletonList } from "./DiscoverTab";

/** 국립중앙도서관 사서추천도서 — 매달 문학·인문·사회·자연 분야별 추천 (51차, worker/lib/nlLibrarianPicks.ts) */
const CATEGORIES = ["전체", "문학", "인문", "사회", "자연"] as const;

const toGenre = (g: string | null): GenreKey => (g && g in GENRE_CONFIG ? (g as GenreKey) : "기타");

export function LibrarianPicksTab({ wishTitleSet }: { wishTitleSet: Set<string> }) {
  const { data, isLoading, isError } = useLibrarianPicks();
  const addBook = useAddBook();
  const { showToast } = useToast();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("전체");

  const picks = useMemo(
    () => (data?.picks ?? [])
      .filter((p) => category === "전체" || p.category === category)
      .filter((p) => !wishTitleSet.has(p.title.toLowerCase())),
    [data, category, wishTitleSet],
  );

  function handleAdd(pick: LibrarianPick) {
    const genre = toGenre(pick.genre);
    addBook.mutate(
      {
        title: pick.title,
        author: pick.author,
        isbn: pick.isbn || undefined,
        coverImage: pick.coverImage || undefined,
        publisher: pick.publisher || undefined,
        status: "wish",
        // 청구기호로 정하지 못한 장르('기타')와 쪽수는 서버가 저장 직후 국립중앙도서관·AI로 채운다
        genre,
        coverEmoji: GENRE_CONFIG[genre]?.emoji,
      },
      {
        onSuccess: () => showToast(`"${pick.title}" 읽을 책에 담았어요 💫`, "success"),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) showToast("이미 서재에 있는 책이에요.", "error");
          else if (err instanceof ApiError && err.status === 400) showToast(err.message, "error");
          else showToast("추가에 실패했어요. 다시 시도해주세요.", "error");
        },
      },
    );
  }

  return (
    <div>
      <p className="px-4 mb-3 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>
        국립중앙도서관 사서가 매달 분야별로 골라 소개하는 책이에요.
      </p>
      <div role="tablist" aria-label="추천 분야" className="px-4 mb-3 flex gap-2 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3 min-h-9 border transition-colors ${
              category === c
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]"
            }`}
            style={{ fontSize: 13 }}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? <SkeletonList /> : isError ? (
        <ErrorEmpty label="사서 추천 도서를 불러오지 못했어요" />
      ) : picks.length === 0 ? (
        <ErrorEmpty label="표시할 사서 추천 도서가 없어요" />
      ) : (
        <ul className="px-4 flex flex-col gap-3">
          {picks.map((pick) => (
            <li key={pick.id} className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 flex gap-3 shadow-sm">
              <BookCoverImg src={pick.coverImage} alt={pick.title} />
              <div className="flex-1 min-w-0">
                <p className="text-indigo-600 dark:text-indigo-300" style={{ fontSize: 11, fontWeight: 600 }}>
                  사서 추천 · {pick.category}{pick.recommendedAt ? ` · ${pick.recommendedAt.replace("-", ".")}` : ""}
                </p>
                <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] leading-snug mt-0.5" style={{ fontSize: 14 }}>
                  {pick.title}
                </p>
                <p className="text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5" style={{ fontSize: 12 }}>
                  {pick.author}{pick.publisher ? ` · ${pick.publisher}` : ""}
                </p>
                {pick.description && (
                  <p className="text-[#475569] dark:text-[#CBD5E1] mt-1 line-clamp-2" style={{ fontSize: 12 }}>
                    {pick.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleAdd(pick)}
                disabled={addBook.isPending}
                className="self-center shrink-0 rounded-xl px-3 py-1.5 text-white disabled:opacity-50 transition-opacity"
                style={{ fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
              >
                담기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
