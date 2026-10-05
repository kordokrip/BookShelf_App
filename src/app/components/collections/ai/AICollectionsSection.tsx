import { useMemo, useState } from 'react';
import { BookOpen, FolderPlus, RefreshCw, Sparkles } from 'lucide-react';
import { ApiError } from '../../../../lib/api';
import { useBooks } from '../../../../hooks/useBooks';
import { useCollections } from '../../../../hooks/useCollections';
import {
  useAICollections, useRefreshAICollections, useCreateCollectionFromBooks,
  RATE_LIMIT_RETRY_COPY, type AICollectionItem,
} from '../../../../hooks/useAI';
import { collectionsBasisLine } from '../../../../lib/aiCollections';
import { useToast } from '../../ui/Toast';
import { AICollectionCard } from './AICollectionCard';
import { ShareBar } from './ShareBar';
import type { SavedInfo } from './palette';

function errorCopy(e: unknown): string {
  if (e instanceof ApiError && e.status === 429) return `요청이 잠시 많아요. ${RATE_LIMIT_RETRY_COPY}`;
  if (e instanceof ApiError && e.status === 503) return '지금은 서재를 정리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  return '서재 정리를 불러오지 못했어요. 다시 시도해 주세요.';
}

function Skeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
        <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
        {label}
      </p>
      <div className="h-3 w-full animate-pulse rounded-full bg-[#E2E8F0] dark:bg-[#334155]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-[#E2E8F0] dark:bg-[#334155]" />
        ))}
      </div>
    </div>
  );
}

export function AICollectionsSection({ onOpenCollection }: { onOpenCollection: (id: string) => void }) {
  const query = useAICollections();
  const refresh = useRefreshAICollections();
  const create = useCreateCollectionFromBooks();
  const { data: books = [] } = useBooks();
  const { showToast } = useToast();
  const { data: myCollections } = useCollections();
  const [savedLocal, setSaved] = useState<Record<string, SavedInfo>>({});
  const [savingKeys, setSavingKeys] = useState<string[]>([]);

  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const readingCount = useMemo(() => books.filter((b) => b.status === 'reading').length, [books]);

  const res = query.data;
  const collections = useMemo(() => res?.data.collections ?? [], [res]);
  const resolved = useMemo(
    () => collections.map((c) => ({ c, books: c.book_ids.map((id) => bookMap.get(id)).filter((b): b is NonNullable<typeof b> => !!b) })),
    [collections, bookMap],
  );

  // 저장 여부는 내 컬렉션 이름과 정확히 일치하는지로 판단 — 로컬 상태는 낙관적 덮어쓰기용
  const saved = useMemo(() => {
    const byName = new Map((myCollections ?? []).map((m) => [m.name, m.id]));
    const out: Record<string, SavedInfo> = {};
    for (const c of collections) {
      const id = byName.get(c.name);
      if (id) out[c.key] = { id, existed: false };
    }
    return { ...out, ...savedLocal };
  }, [myCollections, collections, savedLocal]);

  const saveOne = async (c: AICollectionItem, ids: string[], silent = false): Promise<boolean> => {
    setSavingKeys((k) => [...k, c.key]);
    try {
      const r = await create.mutateAsync({ name: c.name, emoji: c.emoji, description: c.description, book_ids: ids });
      setSaved((s) => ({ ...s, [c.key]: { id: r.data.id, existed: false } }));
      if (!silent) showToast('컬렉션을 만들었어요', 'success');
      return true;
    } catch (e) {
      const existing = e instanceof ApiError && e.status === 409 ? e.body?.existing_id : undefined;
      if (typeof existing === 'string') {
        setSaved((s) => ({ ...s, [c.key]: { id: existing, existed: true } }));
        if (!silent) showToast('이미 같은 이름의 컬렉션이 있어요', 'info');
      } else if (!silent) {
        showToast('저장하지 못했어요. 다시 시도해 주세요.', 'error');
      }
      return typeof existing === 'string';
    } finally {
      setSavingKeys((k) => k.filter((x) => x !== c.key));
    }
  };

  const saveAll = async () => {
    const targets = resolved.filter((r) => !saved[r.c.key] && r.books.length > 0);
    let ok = 0;
    for (const t of targets) {
      if (await saveOne(t.c, t.books.map((b) => b.id), true)) ok += 1;
    }
    showToast(ok === targets.length ? `컬렉션 ${ok}개를 저장했어요` : '일부 컬렉션을 저장하지 못했어요', ok === targets.length ? 'success' : 'error');
  };

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: (d) => {
        setSaved({});
        showToast(d.reason === 'not_enough_books' ? '책을 더 담으면 정리해 드려요' : '서재를 새로 정리했어요', 'success');
      },
      onError: (e) => showToast(errorCopy(e), 'error'),
    });
  };

  const notEnough = res?.reason === 'not_enough_books' || (res && collections.length === 0);
  const unsaved = resolved.filter((r) => !saved[r.c.key] && r.books.length > 0).length;
  const basisLine = res && !notEnough
    ? collectionsBasisLine({ done_count: res.data.basis.done_count, reading_count: readingCount }, res.generated_at)
    : null;

  return (
    <section aria-labelledby="ai-collections-title" className="mx-4 mb-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="ai-collections-title"
            className="flex items-center gap-1.5 text-[#1E293B] dark:text-[#F8FAFC]"
            style={{ fontSize: 17, fontWeight: 700 }}
          >
            <Sparkles size={17} className="text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            AI가 정리한 내 서재
          </h2>
          {basisLine && <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">{basisLine}</p>}
          {query.staleCopy && !refresh.isPending && (
            <p role="status" className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">{query.staleCopy}</p>
          )}
        </div>
        {res && !notEnough && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refresh.isPending}
            aria-label="서재 새로 정리"
            className="flex min-h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-indigo-700 hover:bg-[#F1F5F9] disabled:opacity-60 dark:text-indigo-200 dark:hover:bg-[#334155]"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <RefreshCw size={15} className={refresh.isPending ? 'animate-spin' : ''} aria-hidden="true" />
            {refresh.isPending ? '정리하는 중…' : '새로 정리'}
          </button>
        )}
      </div>

      <div className="mt-3">
        {query.isLoading && <Skeleton label="서재를 살펴보는 중이에요…" />}

        {query.isError && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 text-center dark:border-[#334155] dark:bg-[#1E293B]">
            <p className="text-sm text-[#475569] dark:text-[#CBD5E1]">{errorCopy(query.error)}</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-3 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {res && notEnough && (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-6 text-center dark:border-[#475569]">
            <BookOpen size={32} className="mx-auto mb-2 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#1E293B] dark:text-[#F8FAFC]">아직 정리할 책이 부족해요</p>
            <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">책을 6권 이상 담으면 AI가 컬렉션을 만들어 드려요</p>
          </div>
        )}

        {res && !notEnough && (
          <div className="relative">
            <div className={refresh.isPending ? 'pointer-events-none opacity-30' : ''} aria-busy={refresh.isPending}>
              <ShareBar
                items={resolved.map(({ c, books: bs }) => ({ key: c.key, name: c.name, emoji: c.emoji, count: bs.length }))}
              />
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {resolved.map(({ c, books: bs }, i) => (
                  <AICollectionCard
                    key={c.key}
                    collection={c}
                    index={i}
                    books={bs}
                    saved={saved[c.key]}
                    saving={savingKeys.includes(c.key)}
                    onSave={() => void saveOne(c, bs.map((b) => b.id))}
                    onOpenSaved={onOpenCollection}
                  />
                ))}
              </ul>
              {unsaved > 1 && (
                <button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={savingKeys.length > 0}
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 text-indigo-700 disabled:opacity-60 dark:border-indigo-800 dark:text-indigo-200"
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  <FolderPlus size={16} aria-hidden="true" />
                  모두 저장
                </button>
              )}
            </div>
            {refresh.isPending && (
              <div className="absolute inset-0 flex items-start justify-center pt-10" role="status" aria-live="polite">
                <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md dark:bg-[#1E293B] dark:text-indigo-200">
                  <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                  서재를 다시 살펴보는 중…
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
