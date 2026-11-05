import { formatNum } from "./adminFormat";

// ─── 통계 카드 ────────────────────────────────────────────────
export function StatCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm border border-[#E2E8F0] dark:border-[#334155]">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#0F172A] dark:text-white">{formatNum(Number(value))}</p>
      <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">{label}</p>
      {sub && <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{sub}</p>}
    </div>
  );
}
