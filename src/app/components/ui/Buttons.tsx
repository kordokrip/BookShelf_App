import { Plus } from "lucide-react";

interface FABProps {
  onClick?: () => void;
  label?: string;
}

export function AddBookFab({ onClick, label = "책 추가" }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed-nav fixed z-40 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      style={{
        bottom: "var(--floating-bottom)",
        right: "var(--floating-right)",
        background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
      }}
    >
      <Plus size={24} />
    </button>
  );
}
