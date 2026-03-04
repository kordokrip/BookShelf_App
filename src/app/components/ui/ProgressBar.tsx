import { useEffect, useRef, useState } from "react";

interface ProgressBarProps {
  value: number; // 0–100
  variant?: "thin" | "thick";
  showLabel?: boolean;
  color?: string;
  animated?: boolean;
}

export function ProgressBar({
  value,
  variant = "thin",
  showLabel = false,
  color = "#4F46E5",
  animated = true,
}: ProgressBarProps) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated) { setDisplayed(value); return; }
    const timer = setTimeout(() => setDisplayed(value), 100);
    return () => clearTimeout(timer);
  }, [value, animated]);

  const height = variant === "thin" ? 4 : 8;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={ref}
        className="flex-1 rounded-full overflow-hidden bg-[#E2E8F0]"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, displayed))}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-[#64748B] tabular-nums" style={{ fontSize: 12, fontWeight: 500, minWidth: 32 }}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}
