import { sharePercents } from '../../../../lib/aiCollections';
import { collectionColor } from './palette';

interface Props {
  items: Array<{ key: string; name: string; emoji: string; count: number }>;
}

/** 컬렉션별 책 비율을 한 줄 누적 막대로 보여준다 (스크린리더에는 요약 문장 제공) */
export function ShareBar({ items }: Props) {
  const percents = sharePercents(items.map((i) => i.count));
  const summary = items.map((it, i) => `${it.name} ${it.count}권(${percents[i]}%)`).join(', ');
  return (
    <div>
      <div
        role="img"
        aria-label={`컬렉션별 책 비율: ${summary}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#334155]"
      >
        {items.map((it, i) =>
          it.count > 0 ? (
            <div
              key={it.key}
              className={`${collectionColor(i).bar} h-full border-r border-white/60 last:border-r-0 dark:border-[#0F172A]/60`}
              style={{ width: `${percents[i]}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-1.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
            <span className={`h-2.5 w-2.5 rounded-full ${collectionColor(i).dot}`} />
            <span>{it.emoji} {it.name}</span>
            <span className="text-[#64748B] dark:text-[#94A3B8]">{percents[i]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
