import { useState } from 'react';
import { Link } from 'react-router';
import { Check, ChevronDown, FolderPlus, Loader2 } from 'lucide-react';
import type { UIBook } from '../../../../types/book';
import { resolveCover, coverInitials } from '../../../../lib/coverArt';
import type { AICollectionItem } from '../../../../hooks/useAI';
import { collectionColor, type SavedInfo } from './palette';

function Tile({ book }: { book: UIBook }) {
  const [err, setErr] = useState(false);
  if (book.coverImage && !err) {
    return (
      <img
        src={book.coverImage}
        alt=""
        loading="lazy"
        onError={() => setErr(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  const c = resolveCover(book);
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center font-book"
      style={{ backgroundColor: c.flat, color: c.smInk, fontSize: 14, fontWeight: 700 }}
    >
      {coverInitials(book.title)}
    </div>
  );
}

interface Props {
  collection: AICollectionItem;
  index: number;
  books: UIBook[];
  saved?: SavedInfo;
  saving: boolean;
  onSave: () => void;
  onOpenSaved: (id: string) => void;
}

export function AICollectionCard({ collection, index, books, saved, saving, onSave, onOpenSaved }: Props) {
  const [open, setOpen] = useState(false);
  const color = collectionColor(index);
  const listId = `ai-col-${collection.key}-list`;
  const mosaic = books.slice(0, 4);

  return (
    <li className={`flex flex-col rounded-2xl border bg-white p-4 dark:bg-[#1E293B] ${color.ring}`}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--bg-accent-soft)', fontSize: 22 }}
          aria-hidden="true"
        >
          {collection.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-keep text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 15, fontWeight: 700 }}>
            {collection.name}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{books.length}권</p>
        </div>
      </div>

      <p className="mt-2 text-[#475569] dark:text-[#CBD5E1]" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {collection.description}
      </p>
      {collection.insight && (
        <p className="mt-1.5 italic text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12, lineHeight: 1.5 }}>
          {collection.insight}
        </p>
      )}

      {mosaic.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {mosaic.map((b) => (
            <div key={b.id} className="aspect-[2/3] overflow-hidden rounded-md shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <Tile book={b} />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="mt-2 flex min-h-11 items-center justify-between rounded-lg px-1 text-left text-[#4F46E5] dark:text-indigo-300"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        <span>{open ? '책 목록 접기' : `책 ${books.length}권 보기`}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="mb-1 flex flex-col">
          {books.map((b) => (
            <li key={b.id}>
              <Link
                to={`/book/${b.id}`}
                className="flex min-h-11 flex-col justify-center rounded-lg px-1 hover:bg-[#F1F5F9] dark:hover:bg-[#334155]"
              >
                <span className="truncate text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13, fontWeight: 600 }}>{b.title}</span>
                <span className="truncate text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>{b.author}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-3">
        {saved ? (
          <div className="flex flex-col gap-1">
            {saved.existed && (
              <p role="status" className="text-xs text-[#64748B] dark:text-[#94A3B8]">이미 같은 이름의 컬렉션이 있어요</p>
            )}
            <button
              type="button"
              onClick={() => onOpenSaved(saved.id)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              <Check size={16} aria-hidden="true" />
              {saved.existed ? '기존 컬렉션 보기' : '저장됨 · 보기'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || books.length === 0}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-white disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, var(--brand-600), var(--brand2-600))' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FolderPlus size={16} aria-hidden="true" />}
            {saving ? '저장하는 중…' : '컬렉션으로 저장'}
          </button>
        )}
      </div>
    </li>
  );
}
