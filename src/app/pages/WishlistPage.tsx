import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { useBooks, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useToast } from "../components/ui/Toast";
import { SearchSheet } from "../components/wishlist/SearchSheet";
import { WishGrid } from "../components/wishlist/WishGrid";
import { AddBookFab } from "../components/ui/Buttons";
import { DiscoverTab } from "../components/wishlist/DiscoverTab";
import { RecommendedBooksTab } from "../components/wishlist/RecommendedBooksTab";
import { FeatureHint } from "../components/onboarding/FeatureHint";

type TabKey = 'new' | 'recommend' | 'mine';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine',    label: '내 목록' },
  { key: 'new',     label: '새로 나온 책' },
  { key: 'recommend', label: '당신을 위한 AI추천 도서' },
];

function parseTab(v: string | null): TabKey {
  return v === 'recommend' || v === 'new' ? v : 'mine';
}

export function WishlistPage() {
  // 탭은 ?tab=recommend|new 로 열 수 있고(기본 mine), 바꿀 때 URL도 replace로 맞춘다
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  function selectTab(key: TabKey) {
    const next = new URLSearchParams(searchParams);
    if (key === 'mine') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  }
  // 좁은 화면에서 가로로 스크롤되는 탭 줄 — 선택한 탭이 보이도록
  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);
  const [showSearch, setShowSearch] = useState(false);

  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: "wish" });
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
  const { showToast } = useToast();

  const wishTitleSet = useMemo(
    () => new Set(books.map((b) => b.title.toLowerCase())),
    [books],
  );

  function handleDelete(id: string) {
    const book = books.find((b) => b.id === id);
    deleteBook.mutate(id, {
      onSuccess: () => showToast(`"${book?.title}" 삭제됨`, "error"),
      onError: () => showToast("삭제에 실패했어요. 다시 시도해주세요.", "error"),
    });
  }

  function handleStart(id: string) {
    const book = books.find((b) => b.id === id);
    updateBook.mutate(
      { id, data: { status: "reading" } },
      {
        onSuccess: () => showToast(`"${book?.title}" 읽기를 시작했어요! 📖`, "success"),
        onError: () => showToast("실패했어요. 다시 시도해주세요.", "error"),
      },
    );
  }

  function handlePriorityChange(id: string, priority: number) {
    updateBook.mutate(
      { id, data: { priority } },
      { onError: () => showToast("변경에 실패했어요. 다시 시도해주세요.", "error") },
    );
  }

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      <h1 className="sr-only">읽을 책</h1>
      <SearchSheet open={showSearch} onClose={() => setShowSearch(false)} />

      {/* 검색 바 */}
      <div className="px-4 pt-4 pb-3">
        <FeatureHint id="wishlist-search" text="읽고 싶은 책을 제목·저자로 찾아서 바로 담을 수 있어요" side="bottom">
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 bg-[#F1F5F9] dark:bg-[#1E293B] rounded-xl px-3 py-2.5 min-h-11 text-left"
          aria-label="책 검색"
        >
          <Search size={15} className="text-[#64748B] dark:text-[#94A3B8] shrink-0" />
          <span className="text-[#475569] dark:text-[#94A3B8]" style={{ fontSize: 14 }}>도서명, 저자, 출판사, ISBN</span>
        </button>
        </FeatureHint>
      </div>

      {/* 탭 바 */}
      <div role="tablist" aria-label="읽을 책 보기" className="flex border-b border-[#E2E8F0] dark:border-[#334155] px-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const button = (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[tab.key] = el; }}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => selectTab(tab.key)}
              className={`shrink-0 whitespace-nowrap mr-1 px-2 min-h-11 pt-1 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300 dark:border-indigo-300'
                  : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#475569] dark:hover:text-[#CBD5E1]'
              }`}
            >
              {tab.label}
            </button>
          );
          return tab.key === 'recommend' ? (
            <FeatureHint key={tab.key} id="wishlist-ai-tab" text="읽은 책을 바탕으로 AI가 다음에 읽을 책을 골라 드려요" side="bottom">
              {button}
            </FeatureHint>
          ) : button;
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="mt-4">
        {activeTab === 'new'     && <DiscoverTab wishTitleSet={wishTitleSet} />}
        {activeTab === 'recommend' && <RecommendedBooksTab />}
        {activeTab === 'mine'    && (
          <WishGrid
            books={books}
            isLoading={isLoading}
            isError={isError}
            onStart={handleStart}
            onDelete={handleDelete}
            onPriorityChange={handlePriorityChange}
            onRetry={refetch}
            onNavigateAdd={() => setShowSearch(true)}
          />
        )}
      </div>

      <AddBookFab onClick={() => setShowSearch(true)} label="책 검색하여 추가" />
    </div>
  );
}
