import { useState, useRef } from "react";
import { Minus, Plus } from "lucide-react";

interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  unit?: string;
  label?: string;
}

/**
 * Shared NumberStepper component.
 * Used in: PageUpdateModal (ReadingPage), NoteInput screen (NotesSearchPage)
 * Spec: 40×40px circle buttons, 32px Bold number, unit text 14px #94A3B8
 * BUG-002: 숫자 클릭 시 직접 입력 모드 지원
 */
export function NumberStepper({ value, min = 0, max = 9999, onChange, unit = "페이지", label }: NumberStepperProps) {
  const [inputMode, setInputMode] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  const handleDisplayClick = () => {
    setInputValue(String(value));
    setInputMode(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleInputConfirm = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(Math.max(min, parsed), max);
      onChange(clamped);
    }
    setInputMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleInputConfirm();
    if (e.key === "Escape") setInputMode(false);
  };

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        border: "1.5px solid #E2E8F0",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Minus button: 40×40px circle */}
      <button
        onClick={decrement}
        disabled={value <= min}
        aria-label="감소"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "2px solid #E2E8F0", background: "#FFFFFF",
          cursor: value <= min ? "default" : "pointer",
          opacity: value <= min ? 0.4 : 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Minus size={18} color="#4F46E5" strokeWidth={2.5} />
      </button>

      {/* Center number + unit — 클릭 시 직접 입력 모드 */}
      <div style={{ textAlign: "center", flex: 1 }}>
        {label && (
          <p style={{ fontSize: 13, fontWeight: 400, color: "#64748B", marginBottom: 2 }}>{label}</p>
        )}
        {inputMode ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputConfirm}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            style={{
              width: 80,
              fontSize: 32,
              fontWeight: 700,
              color: "#1E293B",
              lineHeight: 1,
              fontFamily: "var(--font-pretendard)",
              textAlign: "center",
              border: "2px solid #4F46E5",
              borderRadius: 8,
              outline: "none",
              padding: "2px 4px",
              background: "#F8FAFC",
              // input[type=number] 화살표 제거
              MozAppearance: "textfield" as never,
            }}
            className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={handleDisplayClick}
            title="클릭하여 직접 입력"
            aria-label={`현재 값 ${value}, 클릭하여 수정`}
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#1E293B",
              lineHeight: 1,
              fontFamily: "var(--font-pretendard)",
              background: "none",
              border: "none",
              cursor: "text",
              padding: 0,
            }}
          >
            {value}
          </button>
        )}
        {unit && (
          <p style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>{unit}</p>
        )}
      </div>

      {/* Plus button: 40×40px circle */}
      <button
        onClick={increment}
        disabled={value >= max}
        aria-label="증가"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "2px solid #E2E8F0", background: "#FFFFFF",
          cursor: value >= max ? "default" : "pointer",
          opacity: value >= max ? 0.4 : 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Plus size={18} color="#4F46E5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
