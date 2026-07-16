import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router";
import { useBooks, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useToast } from "../components/ui/Toast";
import { SearchSheet } from "../components/wishlist/SearchSheet";
import { RecommendSection } from "../components/wishlist/RecommendSection";
import { WishGrid } from "../components/wishlist/WishGrid";
import { WishFab } from "../components/wishlist/WishFab";
import { DiscoverTab } from "../components/wishlist/DiscoverTab";

type TabKey = 'new' | 'popular' | 'life' | 'mine';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'new',     label: '새로운책' },
  { key: 'popular', label: '인기책' },
  { key: 'life',    label: '✨ 인생책' },
  { key: 'mine',    label: '내 목록' },
];

export function WishlistPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('life');
  const [showSearch, setShowSearch] = useState(false);

  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: "wish" });
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
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

      {/* 검색 바 */}
      <div className="px-4 pt-4 pb-3">
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 bg-[#F1F5F9] dark:bg-[#1E293B] rounded-xl px-3 py-2.5 text-left"
          aria-label="책 검색"
        >
          <Search size={15} className="text-[#94A3B8] shrink-0" />
          <span className="text-[#94A3B8]" style={{ fontSize: 14 }}>도서명, 저자, 출판사, ISBN</span>
        </button>
      </div>

      {/* 탭 바 */}
      <div className="flex border-b border-[#E2E8F0] dark:border-[#334155] px-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 mr-5 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[#4F46E5] text-[#4F46E5] dark:text-[#A5B4FC] dark:border-[#A5B4FC]'
                : 'border-transparent text-[#94A3B8] hover:text-[#64748B] dark:hover:text-[#CBD5E1]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="mt-4">
        {activeTab === 'new'     && <DiscoverTab variant="new"     wishTitleSet={wishTitleSet} />}
        {activeTab === 'popular' && <DiscoverTab variant="popular" wishTitleSet={wishTitleSet} />}
        {activeTab === 'life'    && <RecommendSection wishTitleSet={wishTitleSet} />}
        {activeTab === 'mine'    && (
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
        )}
      </div>

      <WishFab onClick={() => setShowSearch(true)} />
    </div>
  );
}
