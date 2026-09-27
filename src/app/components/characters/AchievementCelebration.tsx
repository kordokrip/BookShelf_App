/**
 * 업적 달성·캐릭터 진화 축하 모달 — Root에 한 번 마운트, celebrationStore 큐를 하나씩 보여준다.
 * 이벤트는 useAchievementCelebration이 변경 API 응답의 achievements 필드로 쌓는다.
 * 모션 줄이기 설정 시 등장 애니메이션을 생략한다.
 */
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Modal } from "../ui/Modal";
import { useCelebrationStore } from "../../../stores/celebrationStore";
import { useAchievements } from "../../../hooks/useAchievements";
import { CharacterAvatar } from "./CharacterAvatar";
import { TIER_STYLE } from "./tierStyle";
import { copulaEnding, subjectParticle } from "../../../lib/koreanParticle";

export function AchievementCelebration() {
  const event = useCelebrationStore((s) => s.queue[0]);
  const remaining = useCelebrationStore((s) => s.queue.length);
  const dismiss = useCelebrationStore((s) => s.dismiss);
  const reduceMotion = useReducedMotion();
  // 진화 아바타의 전체 단계 수(눈금) — 업적 조회 캐시가 있으면 사용
  const { data } = useAchievements(!!event);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // 포커스를 [확인]으로 이동 — 드롭다운 메뉴(Radix)에서 완독 처리하면 메뉴가 닫히며 트리거로
  // 포커스를 되돌려 autoFocus를 덮어쓰므로, 잠시 뒤 한 번 더 확인해 대화상자 안으로 옮긴다
  useEffect(() => {
    if (!event) return;
    const focusConfirm = () => {
      const button = confirmRef.current;
      if (button && !button.closest('[role="dialog"]')?.contains(document.activeElement)) button.focus();
    };
    focusConfirm();
    const timer = setTimeout(focusConfirm, 200);
    return () => clearTimeout(timer);
  }, [event]);

  if (!event) return null;

  const pop = reduceMotion
    ? {}
    : { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring" as const, stiffness: 260, damping: 16 } };

  return (
    <Modal open onClose={dismiss} title="🎉 축하해요!">
      <div className="flex flex-col items-center gap-4 pb-2">
        {event.evolved.map((evo) => {
          const stageCount = data?.characters.find((c) => c.id === evo.characterId)?.stages.length ?? evo.stageIndex + 1;
          return (
            <motion.div key={evo.characterId} className="flex flex-col items-center gap-2" {...pop}>
              <CharacterAvatar
                emoji={evo.emoji}
                stageIndex={evo.stageIndex}
                stageCount={stageCount}
                crown={evo.crown}
                size={96}
                label={`${evo.characterName}, ${evo.stageName} 단계`}
              />
              <p className="text-center" style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>
                {evo.characterName}{subjectParticle(evo.characterName)} 진화했어요!
              </p>
              <p className="text-center" style={{ fontSize: 13, color: "#64748B" }}>
                이제 <strong style={{ color: "#4F46E5" }}>{evo.stageName}</strong>{copulaEnding(evo.stageName)}
              </p>
            </motion.div>
          );
        })}

        <ul className="flex flex-wrap justify-center gap-2" aria-label="새로 달성한 업적">
          {event.newlyUnlocked.map((a) => {
            const tier = TIER_STYLE[a.tier];
            return (
              <li
                key={a.id}
                className="flex flex-col items-center gap-1 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: tier.bg, border: `1.5px solid ${tier.border}`, minWidth: 96 }}
              >
                <span style={{ fontSize: 26 }} aria-hidden>{a.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: tier.label }}>{a.label}</span>
                <span style={{ fontSize: 11, color: tier.label }}>{a.description}</span>
              </li>
            );
          })}
        </ul>

        <button
          ref={confirmRef}
          type="button"
          onClick={dismiss}
          className="w-full rounded-xl py-3 text-white"
          style={{ fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
        >
          {remaining > 1 ? `확인 (${remaining - 1}개 더)` : "확인"}
        </button>
      </div>
    </Modal>
  );
}
