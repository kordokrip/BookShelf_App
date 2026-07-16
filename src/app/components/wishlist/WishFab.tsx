import { Plus } from "lucide-react";

export function WishFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="책 검색하여 추가"
      className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
      style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
    >
      <Plus size={24} />
    </button>
  );
}
