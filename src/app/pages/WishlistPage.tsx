import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useBooks, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useToast } from "../components/ui/Toast";
import { SearchSheet } from "../components/wishlist/SearchSheet";
import { RecommendSection } from "../components/wishlist/RecommendSection";
import { WishGrid } from "../components/wishlist/WishGrid";
import { WishFab } from "../components/wishlist/WishFab";

export function WishlistPage() {
  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: "wish" });
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
  const [showSearch, setShowSearch] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const wishTitleSet = useMemo(
    () => new Set(books.map((b) => b.title.toLowerCase())),
    [books],
  );

  function handleDelete(id: string) {
    const book = books.find((b) => b.id === id);
    deleteBook.mutate(id, {
      onSuccess: () => showToast(`"${book?.title}" 삭제됨`, "error"),
    });
  }

  function handleStart(id: string) {
    const book = books.find((b) => b.id === id);
    updateBook.mutate(
      { id, data: { status: "reading" } },
      { onSuccess: () => showToast(`"${book?.title}" 읽기를 시작했어요! 📖`, "success") },
    );
  }

  function handlePriorityChange(id: string, priority: number) {
    updateBook.mutate({ id, data: { priority } });
  }

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      <SearchSheet open={showSearch} onClose={() => setShowSearch(false)} />
      <RecommendSection wishTitleSet={wishTitleSet} />
      <WishGrid
        books={books}
        isLoading={isLoading}
        isError={isError}
        onStart={handleStart}
        onDelete={handleDelete}
        onPriorityChange={handlePriorityChange}
        onRetry={refetch}
        onNavigateAdd={() => navigate("/register-flow")}
      />
      <WishFab onClick={() => setShowSearch(true)} />
    </div>
  );
}
