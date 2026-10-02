import { useUiStore } from "../../../stores/uiStore";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useUiStore((s) => s.isOnline);
  if (isOnline) return null;
  return (
    <div
      className="sticky z-40 w-full flex items-center justify-center gap-2 px-4 py-2.5"
      style={{
        top: "var(--topbar-h)", // TopBar 아래에 붙도록
        backgroundColor: "#FFFBEB",
        borderBottom: "1px solid #FDE68A",
      }}
    >
      <WifiOff size={15} aria-hidden className="flex-shrink-0 text-[#B45309]" />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
        오프라인 상태입니다. 일부 기능이 제한될 수 있어요.
      </span>
    </div>
  );
}
