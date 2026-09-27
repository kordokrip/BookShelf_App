/**
 * 캐릭터 아바타 — 이모지 + SVG 원형 프레임(단계별 색) + 최종 단계 왕관.
 * 에셋 교체 지점: 나중에 일러스트를 쓰려면 이 컴포넌트에서 character.asset/stageIndex로 이미지를 고르면 된다.
 */
import { useId } from "react";
import { stageFrameColor } from "./tierStyle";

interface CharacterAvatarProps {
  emoji: string;
  stageIndex: number;
  stageCount: number;
  crown?: boolean;
  /** px */
  size?: number;
  /** 스크린리더용 설명 (예: "책 부엉이, 아기 부엉이 단계") */
  label: string;
}

export function CharacterAvatar({ emoji, stageIndex, stageCount, crown, size = 64, label }: CharacterAvatarProps) {
  const gradientId = useId();
  const color = stageFrameColor(stageIndex, stageCount);
  const locked = stageIndex === 0;

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 64 64" className="absolute inset-0" aria-hidden>
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor={locked ? "#F1F5F9" : "#FEF9C3"} />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="29" fill={`url(#${gradientId})`} stroke={color} strokeWidth="3" />
        {/* 단계 눈금: 도달한 단계만 채움 */}
        {Array.from({ length: stageCount - 1 }, (_, i) => {
          const angle = (-90 + (i * 360) / (stageCount - 1)) * (Math.PI / 180);
          return (
            <circle
              key={i}
              cx={32 + 29 * Math.cos(angle)}
              cy={32 + 29 * Math.sin(angle)}
              r="2.6"
              fill={i < stageIndex ? color : "#FFFFFF"}
              stroke={color}
              strokeWidth="1.2"
            />
          );
        })}
      </svg>
      <span className="relative select-none" style={{ fontSize: size * 0.48, lineHeight: 1, filter: locked ? "grayscale(0.3)" : undefined }} aria-hidden>
        {emoji}
      </span>
      {crown && (
        <span className="absolute select-none" style={{ top: -size * 0.14, fontSize: size * 0.3 }} aria-hidden>
          👑
        </span>
      )}
    </div>
  );
}
