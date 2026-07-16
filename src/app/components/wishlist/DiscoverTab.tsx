import { useExternalBooks, useDiscover } from "../../../hooks/useDiscover";
import { useAddBook } from "../../../hooks/useBooks";
import { useToast } from "../ui/Toast";
import { ApiError } from "../../../lib/api";
import type { GenreKey } from "../../../types/book";
import type { ExternalBook } from "../../../lib/api";
import type { DiscoverBook } from "../../../lib/api";

function BookCoverImg({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#F1F5F9] dark:bg-[#334155] flex items-center justify-center shadow-sm">
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span style={{ fontSize: 20 }}>📚</span>
      )}
    </div>
  );
}

function NewBooksTab({ wishTitleSet }: { wishTitleSet: Set<string> }) {
  const { data, isLoading, isError } = useExternalBooks('new');
  const addBook = useAddBook();
  const { showToast } = useToast();
  const books = (data?.books ?? []).filter((b) => !wishTitleSet.has(b.title.toLowerCase()));

  function handleAdd(book: ExternalBook) {
    addBook.mutate(
      {
        title: book.title,
        author: book.author,
        isbn: book.isbn || undefined,
        coverImage: book.coverImage || undefined,
        publisher: book.publisher || undefined,
        status: "wish",
        genre: "기타" as GenreKey,
      },
      {
        onSuccess: () => showToast(`"${book.title}" 위시리스트에 추가됨 💫`, "success"),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            showToast("이미 위시리스트에 있는 책입니다.", "error");
          } else {
            showToast("추가에 실패했어요. 다시 시도해주세요.", "error");
          }
        },
      },
    );
  }

  if (isLoading) return <SkeletonList />;
  if (isError) return <ErrorEmpty label="신간 정보를 불러오지 못했어요" />;
  if (books.length === 0) return <ErrorEmpty label="현재 표시할 신간이 없어요" />;

  return (
    <ul className="px-4 flex flex-col gap-3">
      {books.slice(0, 20).map((book) => (
        <li key={book.isbn || book.title} className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3 shadow-sm">
          <BookCoverImg src={book.coverImage} alt={book.title} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] leading-snug truncate" style={{ fontSize: 14 }}>
              {book.title}
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5" style={{ fontSize: 12 }}>
              {book.author}{book.publisher ? ` · ${book.publisher}` : ""}
            </p>
            {book.publishedDate && (
              <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: 11 }}>{book.publishedDate.slice(0, 7)}</p>
            )}
          </div>
          <button
            onClick={() => handleAdd(book)}
            disabled={addBook.isPending}
            className="shrink-0 rounded-xl px-3 py-1.5 text-white disabled:opacity-50 transition-opacity"
            style={{ fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
          >
            담기
          </button>
        </li>
      ))}
    </ul>
  );
}

function PopularBooksTab({ wishTitleSet }: { wishTitleSet: Set<string> }) {
  const { data, isLoading, isError } = useDiscover('popular', '전체');
  const addBook = useAddBook();
  const { showToast } = useToast();
  const books = (data?.books ?? []).filter((b) => !wishTitleSet.has(b.title.toLowerCase()));

  function handleAdd(book: DiscoverBook) {
    addBook.mutate(
      {
        title: book.title,
        author: book.author,
        isbn: book.isbn || undefined,
        coverImage: book.cover_image || undefined,
        publisher: book.publisher || undefined,
        status: "wish",
        genre: (book.genre as GenreKey) ?? "기타",
      },
      {
        onSuccess: () => showToast(`"${book.title}" 위시리스트에 추가됨 💫`, "success"),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            showToast("이미 위시리스트에 있는 책입니다.", "error");
          } else {
            showToast("추가에 실패했어요. 다시 시도해주세요.", "error");
          }
        },
      },
    );
  }

  if (isLoading) return <SkeletonList />;
  if (isError) return <ErrorEmpty label="인기책 정보를 불러오지 못했어요" />;
  if (books.length === 0) return <ErrorEmpty label="현재 표시할 인기책이 없어요" />;

  return (
    <ul className="px-4 flex flex-col gap-3">
      {books.slice(0, 20).map((book, i) => (
        <li key={book.key || `${book.title}-${i}`} className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3 shadow-sm">
          <BookCoverImg src={book.cover_image} alt={book.title} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] leading-snug truncate" style={{ fontSize: 14 }}>
              {book.title}
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5" style={{ fontSize: 12 }}>
              {book.author}{book.publisher ? ` · ${book.publisher}` : ""}
            </p>
            <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: 11 }}>
              서재 {book.library_count}명{book.avg_rating ? ` · ★ ${book.avg_rating.toFixed(1)}` : ""}
            </p>
          </div>
          <button
            onClick={() => handleAdd(book)}
            disabled={addBook.isPending}
            className="shrink-0 rounded-xl px-3 py-1.5 text-white disabled:opacity-50 transition-opacity"
            style={{ fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
          >
            담기
          </button>
        </li>
      ))}
    </ul>
  );
}

function SkeletonList() {
  return (
    <div className="px-4 flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3 animate-pulse">
          <div className="w-12 h-16 rounded-lg bg-[#E2E8F0] dark:bg-[#334155] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[#E2E8F0] dark:bg-[#334155] rounded w-3/4" />
            <div className="h-3 bg-[#E2E8F0] dark:bg-[#334155] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorEmpty({ label }: { label: string }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-[#94A3B8] dark:text-[#64748B]" style={{ fontSize: 14 }}>{label}</p>
    </div>
  );
}

export function DiscoverTab({
  variant,
  wishTitleSet,
}: {
  variant: 'new' | 'popular';
  wishTitleSet: Set<string>;
}) {
  if (variant === 'new') return <NewBooksTab wishTitleSet={wishTitleSet} />;
  return <PopularBooksTab wishTitleSet={wishTitleSet} />;
}
