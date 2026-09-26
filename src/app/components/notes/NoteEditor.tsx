/**
 * 노트 경량 에디터 — textarea + 서식 툴바(굵게, 하이라이트).
 * 저장 형식은 `**굵게**` / `==하이라이트==` 평문이며 NoteContent가 렌더링한다.
 * 단축키: ⌘/Ctrl+B 굵게, ⌘/Ctrl+Shift+H 하이라이트 (그 외 키는 onKeyDown으로 전달)
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Bold, Highlighter } from "lucide-react";
import { wrapSelection } from "../../../lib/noteMarkup";

interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export const NoteEditor = forwardRef<HTMLTextAreaElement, NoteEditorProps>(function NoteEditor(
  { value, onChange, onKeyDown, placeholder, rows = 4, autoFocus, className, style, ariaLabel },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);
  // 서식 적용 후 복원할 선택 범위 — 부모가 새 value를 내려준 뒤(커밋 직후)에 적용해야
  // React의 value 갱신이 커서를 끝으로 옮기는 것을 덮어쓸 수 있다
  const pendingSelection = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    const sel = pendingSelection.current;
    if (!el || !sel) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  }, [value]);

  const applyMarker = (marker: "**" | "==") => {
    const el = textareaRef.current;
    if (!el) return;
    const next = wrapSelection(value, el.selectionStart, el.selectionEnd, marker);
    pendingSelection.current = [next.selectionStart, next.selectionEnd];
    onChange(next.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      applyMarker("**");
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      applyMarker("==");
      return;
    }
    onKeyDown?.(e);
  };

  // 에디터가 놓이는 배경이 화면마다 다르므로(다크 모드에서도 밝은 카드 안에 있을 수 있음)
  // dark: 변형 대신 밝은/어두운 배경 모두에서 3:1 이상 대비가 나오는 중간 회색을 쓴다
  const toolButton =
    "flex items-center justify-center w-8 h-8 rounded-lg text-[#64748B] hover:bg-[#4F46E5]/10 hover:text-[#4F46E5] transition-colors";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1" role="toolbar" aria-label="노트 서식">
        <button
          type="button"
          className={toolButton}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyMarker("**")}
          aria-label="굵게 (⌘B)"
          title="굵게 (⌘B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className={toolButton}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyMarker("==")}
          aria-label="하이라이트 (⌘⇧H)"
          title="하이라이트 (⌘⇧H)"
        >
          <Highlighter size={15} />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        className={
          className ??
          "w-full bg-white dark:bg-slate-900 rounded-xl border border-[#E2E8F0] dark:border-slate-700 outline-none focus:border-[#4F46E5] resize-none px-3 py-2 transition-colors"
        }
        style={style ?? { fontSize: 14, color: "inherit" }}
      />
    </div>
  );
});
