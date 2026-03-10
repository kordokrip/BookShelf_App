import { useState, useRef, type InputHTMLAttributes } from "react";
import { Search, X, ChevronDown, Minus, Plus } from "lucide-react";
import { GENRE_CONFIG, type GenreKey } from "../../../types/book";

/* ─── Text Input ─────────────────────────────────────────── */
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

export function TextInput({ label, error, helper, id, disabled, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s/g, "-");
  const hasValue = String(props.value ?? "").length > 0;

  const borderColor = error
    ? "#EF4444"
    : focused
    ? "#4F46E5"
    : "#E2E8F0";

  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative rounded-xl border bg-white transition-all"
        style={{ borderColor, boxShadow: focused ? `0 0 0 3px ${error ? "#FEE2E2" : "#EEF2FF"}` : undefined }}
      >
        <label
          htmlFor={inputId}
          className="absolute left-4 transition-all pointer-events-none"
          style={{
            top: focused || hasValue ? 8 : "50%",
            transform: focused || hasValue ? "translateY(0) scale(0.85)" : "translateY(-50%) scale(1)",
            transformOrigin: "left",
            fontSize: 14,
            color: error ? "#EF4444" : focused ? "#4F46E5" : "#94A3B8",
            fontWeight: 500,
          }}
        >
          {label}
        </label>
        <input
          id={inputId}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
          className="w-full h-12 px-4 pt-4 pb-1 bg-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: 14, color: "#1E293B" }}
        />
      </div>
      {error && (
        <p className="text-[#EF4444] px-1" style={{ fontSize: 12 }}>{error}</p>
      )}
      {helper && !error && (
        <p className="text-[#94A3B8] px-1" style={{ fontSize: 12 }}>{helper}</p>
      )}
    </div>
  );
}

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
        className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-between transition-all hover:border-[#4F46E5]"
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
            <span className="text-[#94A3B8]" style={{ fontSize: 14 }}>{label}</span>
          )}
        </div>
        <ChevronDown size={16} className="text-[#94A3B8]" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white rounded-xl border border-[#E2E8F0] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-lg px-3 h-9">
              <Search size={14} className="text-[#94A3B8]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="장르 검색…"
                className="flex-1 bg-transparent outline-none text-[#1E293B]"
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
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#F8FAFC] transition-colors"
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
interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export function NumberStepper({ value, onChange, min = 0, max = 9999, step = 1, label }: NumberStepperProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[#64748B]" style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>}
      <div className="flex items-center gap-0 rounded-xl border border-[#E2E8F0] overflow-hidden h-12 bg-white">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="w-12 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30 transition-colors border-r border-[#E2E8F0]"
        >
          <Minus size={16} />
        </button>
        <span
          className="flex-1 text-center text-[#1E293B] tabular-nums"
          style={{ fontSize: 16, fontWeight: 600 }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="w-12 h-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30 transition-colors border-l border-[#E2E8F0]"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Search Bar ─────────────────────────────────────────── */
interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchBar({ value, onChange, placeholder = "책 제목, 저자 검색…", onClear }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex items-center gap-2 rounded-full border bg-white px-4 h-11 transition-all"
      style={{
        borderColor: focused ? "#4F46E5" : "#E2E8F0",
        boxShadow: focused ? "0 0 0 3px #EEF2FF" : undefined,
      }}
    >
      <Search size={16} className="text-[#94A3B8] flex-shrink-0" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 bg-transparent outline-none text-[#1E293B] placeholder:text-[#CBD5E1]"
        style={{ fontSize: 14 }}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); onClear?.(); ref.current?.focus(); }}
          className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/* ─── Simple Date Picker ─────────────────────────────────── */
interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  min?: string;
  max?: string;
}

export function DatePicker({ value, onChange, label, min, max }: DatePickerProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[#64748B]" style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>}
      <div
        className="relative rounded-xl border bg-white h-12 flex items-center px-4 transition-all"
        style={{
          borderColor: focused ? "#4F46E5" : "#E2E8F0",
          boxShadow: focused ? "0 0 0 3px #EEF2FF" : undefined,
        }}
      >
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent outline-none text-[#1E293B]"
          style={{ fontSize: 14 }}
        />
      </div>
    </div>
  );
}
