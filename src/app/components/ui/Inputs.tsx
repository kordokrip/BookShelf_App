import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { GENRE_CONFIG, type GenreKey } from "../../../types/book";

/* ─── Text Input ─────────────────────────────────────────── */
/* ─── Genre Select Dropdown ──────────────────────────────── */
const GENRES = Object.keys(GENRE_CONFIG) as GenreKey[];

interface GenreSelectProps {
  value: GenreKey | "";
  onChange: (v: GenreKey) => void;
  label?: string;
}

export function GenreSelect({ value, onChange, label = "장르 선택" }: GenreSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = GENRES.filter((g) => g.includes(search));
  const config = value ? GENRE_CONFIG[value as GenreKey] : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] flex items-center justify-between transition-all hover:border-indigo-600"
      >
        <div className="flex items-center gap-2">
          {config ? (
            <>
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ fontSize: 12, backgroundColor: config.bg, color: config.text, fontWeight: 600 }}
              >
                {config.emoji} {value}
              </span>
            </>
          ) : (
            <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14 }}>{label}</span>
          )}
        </div>
        <ChevronDown size={16} className="text-[#64748B] dark:text-[#94A3B8]" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#F1F5F9] dark:border-[#334155]">
            <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-lg px-3 h-9">
              <Search size={14} className="text-[#64748B] dark:text-[#94A3B8]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="장르 검색…"
                className="flex-1 bg-transparent outline-none text-[#1E293B] dark:text-[#F8FAFC]"
                style={{ fontSize: 13 }}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map((g) => {
              const c = GENRE_CONFIG[g];
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => { onChange(g); setOpen(false); setSearch(""); }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors"
                >
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{ fontSize: 11, backgroundColor: c.bg, color: c.text, fontWeight: 600 }}
                  >
                    {c.emoji} {g}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Number Stepper ─────────────────────────────────────── */
/* ─── Search Bar ─────────────────────────────────────────── */
/* ─── Simple Date Picker ─────────────────────────────────── */
