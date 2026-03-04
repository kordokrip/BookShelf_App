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
 */
export function NumberStepper({ value, min = 0, max = 9999, onChange, unit = "페이지", label }: NumberStepperProps) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

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
        aria-label="감소"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "2px solid #E2E8F0", background: "#FFFFFF",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Minus size={18} color="#4F46E5" strokeWidth={2.5} />
      </button>

      {/* Center number + unit */}
      <div style={{ textAlign: "center", flex: 1 }}>
        {label && (
          <p style={{ fontSize: 13, fontWeight: 400, color: "#64748B", marginBottom: 2 }}>{label}</p>
        )}
        <span style={{ fontSize: 32, fontWeight: 700, color: "#1E293B", lineHeight: 1, fontFamily: "var(--font-pretendard)" }}>
          {value}
        </span>
        {unit && (
          <p style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>{unit}</p>
        )}
      </div>

      {/* Plus button: 40×40px circle */}
      <button
        onClick={increment}
        aria-label="증가"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "2px solid #E2E8F0", background: "#FFFFFF",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Plus size={18} color="#4F46E5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
