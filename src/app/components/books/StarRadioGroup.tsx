/**
 * 별점 입력 — radiogroup 패턴(role=radio · aria-checked · roving tabindex · 좌우 방향키).
 * 별 글자는 작게 두되 터치 영역은 44x44 이상으로 확보한다.
 */
import { useRef, useState } from "react";

interface StarRadioGroupProps {
  value: number;
  onChange: (n: number) => void;
  /** 별 글자 크기(px) — 터치 영역과는 별개 */
  fontSize?: number;
  label?: string;
}

export function StarRadioGroup({ value, onChange, fontSize = 18, label = "별점" }: StarRadioGroupProps) {
  const [hover, setHover] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.round(value);
  const display = hover || value;
  // roving tabindex: 선택된 별(없으면 첫 별)만 탭 순서에 둔다
  const tabStop = current >= 1 ? current : 1;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let next = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, (current || 0) + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, (current || 2) - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else return;
    e.preventDefault();
    if (next !== current) onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex items-center" onKeyDown={handleKeyDown}>
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = i <= Math.round(display);
        const color = lit ? "text-[#F59E0B]" : "text-[#E2E8F0] dark:text-[#475569]";
        return (
          <button
            key={i}
            ref={(el) => { refs.current[i - 1] = el; }}
            type="button"
            role="radio"
            aria-checked={i === current}
            aria-label={`${i}점`}
            tabIndex={i === tabStop ? 0 : -1}
            className={`${color} leading-none flex items-center justify-center`}
            style={{ fontSize, minWidth: 44, minHeight: 44 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(i)}
          >★</button>
        );
      })}
    </div>
  );
}
