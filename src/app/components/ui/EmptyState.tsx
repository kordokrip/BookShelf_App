interface EmptyStateProps {
  emoji?: string;
  heading: string;
  subtext: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * Spec:
 * - Icon: 72px emoji, centered vertically in content area
 * - Heading: 18px SemiBold #1E293B, 16px below icon
 * - Subtext: 14px Regular #64748B, 8px below heading
 * - CTA button: 48px height, indigo, border-radius 12px, 24px below subtext,
 *               auto width (not full-width), 48px horizontal padding
 */
export function EmptyState({ emoji = "📚", heading, subtext, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {/* 72px emoji icon container */}
      <div
        className="flex items-center justify-center rounded-3xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF]"
        style={{ width: 72, height: 72 }}
      >
        <span style={{ fontSize: 36 }}>{emoji}</span>
      </div>

      {/* Heading: 18px SemiBold #1E293B, 16px gap from icon */}
      <h3
        style={{
          marginTop: 16,
          fontSize: 18,
          fontWeight: 600,
          color: "#1E293B",
          fontFamily: "var(--font-pretendard)",
        }}
      >
        {heading}
      </h3>

      {/* Subtext: 14px Regular #64748B, 8px gap from heading */}
      <p
        style={{
          marginTop: 8,
          fontSize: 14,
          color: "#64748B",
          lineHeight: 1.6,
          fontFamily: "var(--font-pretendard)",
        }}
      >
        {subtext}
      </p>

      {/* CTA: 48px height, indigo gradient, border-radius 12px, auto width, 48px h-padding, 24px gap */}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="flex items-center justify-center text-white transition-opacity hover:opacity-90 active:scale-95"
          style={{
            marginTop: 24,
            height: 48,
            paddingLeft: 48,
            paddingRight: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "var(--font-pretendard)",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
