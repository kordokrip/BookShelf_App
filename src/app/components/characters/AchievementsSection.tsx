/**
 * 업적·캐릭터 섹션 — StatsPage의 기존 "성취 배지"를 대체 (플래그 `characters`, ADR-004).
 * 데이터는 서버(GET /api/achievements)가 단일 원본이며, 달성 시각이 기록된 업적만 "달성"으로 본다.
 * 배치 화면(StatsPage) 카드가 다크 모드에서도 흰색이라 같은 밝은 톤을 쓴다.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAchievements } from "../../../hooks/useAchievements";
import { nextStageInfo } from "../../../lib/characterProgress";
import { CharacterAvatar } from "./CharacterAvatar";
import { TIER_STYLE } from "./tierStyle";

export function AchievementsSection() {
  const { data, isLoading, isError, refetch } = useAchievements();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="px-4 mb-3">
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 h-48 animate-pulse" aria-label="업적 불러오는 중" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="px-4 mb-3">
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 text-center" style={{ fontSize: 13, color: "#64748B" }}>
          업적을 불러오지 못했어요.{" "}
          <button type="button" onClick={() => void refetch()} className="underline text-[#4F46E5]" style={{ minHeight: "unset" }}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const { progress, achievements, characters } = data;
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);
  const visibleLocked = showAll ? locked : locked.slice(0, 2);

  return (
    <section className="px-4 mb-3" aria-labelledby="achievements-title">
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 id="achievements-title" style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>🏅 업적 · 캐릭터</h3>
          <span style={{ fontSize: 12, color: "#64748B" }}>
            {unlocked.length} / {achievements.length} 달성
          </span>
        </div>

        {/* 캐릭터 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {characters.map((ch) => {
            const stage = ch.stages[ch.stageIndex]!;
            const next = nextStageInfo(ch, progress);
            return (
              <div key={ch.id} className="flex items-center gap-3 rounded-xl p-3 bg-[#F8FAFC] border border-[#E2E8F0]">
                <CharacterAvatar
                  emoji={stage.emoji}
                  stageIndex={ch.stageIndex}
                  stageCount={ch.stages.length}
                  crown={stage.crown}
                  size={56}
                  label={`${ch.name}, ${stage.name} 단계 (${ch.stageIndex + 1}/${ch.stages.length})`}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{ch.name}</p>
                  <p className="truncate" style={{ fontSize: 14, color: "#1E293B", fontWeight: 700 }}>{stage.name}</p>
                  <div
                    className="h-1.5 rounded-full bg-[#E2E8F0] mt-1.5 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={next.percent}
                    aria-label={next.nextName ? `${next.nextName}까지 진행률` : "최종 단계"}
                  >
                    <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${next.percent}%` }} />
                  </div>
                  <p className="mt-1 truncate" style={{ fontSize: 11, color: "#64748B" }}>
                    {next.nextName
                      ? `${next.nextName}까지 ${next.remaining.toLocaleString()}${next.unit}`
                      : "최종 단계 달성 👑"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 달성한 업적 */}
        {unlocked.length > 0 ? (
          <ul className="flex flex-wrap gap-2 mb-3" aria-label="달성한 업적">
            {unlocked.map((a) => {
              const tier = TIER_STYLE[a.tier];
              return (
                <li
                  key={a.id}
                  className="flex flex-col items-center gap-1 rounded-xl p-2.5"
                  style={{ backgroundColor: tier.bg, border: `1.5px solid ${tier.border}`, minWidth: 70 }}
                  title={`${a.description} · ${a.unlockedAt!.slice(0, 10)} 달성`}
                >
                  <span style={{ fontSize: 22 }} aria-hidden>{a.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tier.label, textAlign: "center" }}>{a.label}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: "#64748B", textAlign: "center", padding: "8px 0 12px" }}>
            첫 책을 완독하면 부엉이 알이 깨어나요 🥚
          </p>
        )}

        {/* 다음 도전 */}
        {locked.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 8 }}>다음 도전</p>
            <ul className="flex flex-wrap gap-2" aria-label="아직 달성하지 않은 업적">
              {visibleLocked.map((a) => {
                const left = a.threshold - (a.type === "books" ? progress.totalDone : progress.totalPages);
                return (
                  <li
                    key={a.id}
                    className="flex flex-col items-center gap-1 rounded-xl p-2.5 bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0]"
                    style={{ minWidth: 70 }}
                    title={a.description}
                  >
                    <span style={{ fontSize: 22, filter: "grayscale(1)", opacity: 0.6 }} aria-hidden>{a.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textAlign: "center" }}>
                      {a.label}
                      <br />
                      {Math.max(0, left).toLocaleString()}{a.type === "books" ? "권" : "p"} 남음
                    </span>
                  </li>
                );
              })}
            </ul>
            {locked.length > 2 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl"
                style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5", backgroundColor: "#EEF2FF" }}
              >
                {showAll ? "접기" : `다음 도전 ${locked.length}개 모두 보기`}
                <ChevronDown size={14} style={{ transform: showAll ? "rotate(180deg)" : undefined }} aria-hidden />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
