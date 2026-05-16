import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center safe-area-inset">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet (mobile: bottom sheet, desktop: centered modal) */}
      <div className="relative w-full sm:max-w-md mx-auto xs:mx-3 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full bg-[#CBD5E1]" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-[#F1F5F9]">
            <h2 className="text-[#1E293B] text-[17px] sm:text-[18px]" style={{ fontWeight: 700 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors flex-shrink-0"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content - 최적화된 높이 */}
        <div className="px-4 sm:px-5 py-4 max-h-[calc(100dvh-120px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}