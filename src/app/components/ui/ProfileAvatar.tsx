/**
 * 프로필 아바타(이미지 / 이모지 / 이니셜) — TopBar·SideNav·프로필 팝업 공용.
 * 프로필 팝업(motion 사용)과 파일을 나눠, 아바타만 쓰는 상단바가 팝업 코드를 첫 로딩에 끌고 오지 않게 했다(58차).
 * 이니셜 배경은 강조색 단색(예전 인디고→바이올렛 그라데이션은 강조색을 바꿔도 그대로였다).
 */
import { forwardRef } from "react";
import type { AuthUser } from "../../../stores/authStore";

type ProfileAvatarProps = Omit<React.HTMLAttributes<HTMLDivElement>, "className"> & {
  user: AuthUser | null;
  size?: number;
  fontSize?: number;
  className?: string;
};

// forwardRef + rest props: Radix Slot(asChild, 예: TooltipTrigger)이 ref·이벤트 핸들러를 직접 전달한다
export const ProfileAvatar = forwardRef<HTMLDivElement, ProfileAvatarProps>(function ProfileAvatar({
  user,
  size = 40,
  fontSize = 16,
  className = "",
  ...rest
}, ref) {
  const emoji = user?.profile_emoji;
  const avatarUrl = user?.avatar_url;
  const initial = user?.name?.[0] ?? "?";

  if (avatarUrl) {
    return (
      <div
        {...rest}
        ref={ref}
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={avatarUrl}
          alt="프로필"
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            // fallback to gradient
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).parentElement!.style.backgroundColor = "var(--brand-600)";
          }}
        />
      </div>
    );
  }

  if (emoji) {
    return (
      <div
        {...rest}
        ref={ref}
        className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: "var(--bg-accent-soft)",
          border: "2px solid var(--brand-200)",
        }}
      >
        <span style={{ fontSize: fontSize * 1.2 }}>{emoji}</span>
      </div>
    );
  }

  return (
    <div
      {...rest}
      ref={ref}
      className={`rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size, backgroundColor: "var(--brand-600)" }}
    >
      <span className="text-white" style={{ fontSize, fontWeight: 700 }}>
        {initial}
      </span>
    </div>
  );
});

/* ─── 메인 팝업 ───────────────────────────────────── */
