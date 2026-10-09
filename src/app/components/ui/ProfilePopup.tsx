/**
 * ProfilePopup — Google 스타일 프로필 팝업
 * - 아바타 (이미지 / 이모지 / 이니셜)
 * - 사용자 정보: 이름, 이메일, 가입일
 * - 오늘의 인사말
 * - 프로필 이모지 선택 기능
 * - 로그아웃 버튼
 */
import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X, Camera, Palette, ChevronRight, Users, LibraryBig, CalendarRange, UserCog } from "lucide-react";
import { useAuthStore, type AuthUser } from "../../../stores/authStore";
import { usersApi } from "../../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { PushNotificationToggle } from "./PushNotificationToggle";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { useNavigate } from "react-router";
import { useDialogA11y } from "../../../hooks/useDialogA11y";

/* ─── 인사말 생성 ─────────────────────────────────── */
function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const nameDisplay = name.split(/[\s@]/)[0] ?? name;
  if (hour < 6) return `좋은 새벽이에요, ${nameDisplay}님 🌙`;
  if (hour < 12) return `좋은 아침이에요, ${nameDisplay}님 ☀️`;
  if (hour < 18) return `좋은 오후예요, ${nameDisplay}님 📖`;
  return `좋은 저녁이에요, ${nameDisplay}님 🌆`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return dateStr;
  }
}

/* ─── 이모지 피커 ─────────────────────────────────── */
const EMOJI_OPTIONS = [
  "😀", "😎", "🤓", "🧑‍💻", "👨‍🎓", "👩‍🎓",
  "📚", "📖", "✨", "🌟", "🎯", "🏆",
  "🦊", "🐱", "🐰", "🐻", "🦉", "🐧",
  "🌸", "🌻", "🍀", "🌈", "☕", "🎵",
];

const REMINDER_TIMES: string[] = [];
for (let h = 6; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    REMINDER_TIMES.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const ADMIN_SHORTCUT = { path: "/admin", label: "관리자 대시보드", icon: UserCog };

const SHORTCUTS: { path: string; label: string; icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }> }[] = [
  { path: "/groups", label: "독서 모임", icon: Users },
  { path: "/collections", label: "컬렉션", icon: LibraryBig },
  { path: "/yearly-review", label: "연간 결산", icon: CalendarRange },
];

/** 접근성 스위치 — 시각 트랙(w-10 h-5)과 별개로 44px 이상 히트 영역 확보 (전역 button min-height 영향 차단) */
function SwitchButton({ checked, onClick, disabled, label }: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 -mr-1 bg-transparent disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative block w-10 h-5 min-h-0 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-[#CBD5E1] dark:bg-[#475569]"}`}
      >
        <span
          className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white dark:bg-[#1E293B] shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] shadow-xl p-3 z-10"
      style={{ width: 264, maxWidth: "calc(100vw - 1rem)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>프로필 이모지 선택</p>
        <button onClick={onClose} aria-label="이모지 피커 닫기" className="w-11 h-11 -m-2 flex items-center justify-center text-[#64748B] dark:text-[#94A3B8] hover:text-[#64748B]">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1 justify-items-center">
        {EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            aria-label={`이모지 ${emoji}`}
            className="w-11 h-11 rounded-lg hover:bg-indigo-50 flex items-center justify-center transition-colors"
            style={{ fontSize: 18 }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSelect("")}
        className="w-full mt-2 py-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors"
        style={{ fontSize: 11, fontWeight: 600 }}
      >
        이모지 제거 (이니셜로 복원)
      </button>
    </motion.div>
  );
}

/* ─── 아바타 표시 컴포넌트 (공유) ──────────────────── */
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
            (e.target as HTMLImageElement).parentElement!.classList.add(
              "bg-gradient-to-br", "from-indigo-600", "to-violet-600"
            );
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
      className={`rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-white" style={{ fontSize, fontWeight: 700 }}>
        {initial}
      </span>
    </div>
  );
});

/* ─── 메인 팝업 ───────────────────────────────────── */
export function ProfilePopup({ onClose }: { onClose: () => void }) {
  useBackToClose(true, onClose);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState((user?.reminder_enabled ?? 1) !== 0);
  const [reminderTime, setReminderTime] = useState(user?.reminder_time ?? "17:00");
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState((user?.weekly_report_enabled ?? 1) !== 0);
  const [savingReminder, setSavingReminder] = useState(false);
  // 포커스 이동·Tab 트랩·ESC 닫기·포커스 복원
  const popupRef = useDialogA11y<HTMLDivElement>(onClose);

  // 바깥 클릭으로 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, popupRef]);

  if (!user) return null;

  const handleEmojiSelect = async (emoji: string) => {
    setSaving(true);
    setShowEmojiPicker(false);
    try {
      await usersApi.updateProfile({ profile_emoji: emoji || null });
      // authStore user 갱신
      useAuthStore.setState((prev) => ({
        user: prev.user ? { ...prev.user, profile_emoji: emoji || null } : null,
      }));
      queryClient.invalidateQueries({ queryKey: ["user"] });
    } catch {
      // 실패 시 무시
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout(); // 캐시·알림까지 비우므로 전체 새로고침 없이 앱 안에서 이동
    // 로그아웃한 사용자는 기존 사용자이므로 소개 화면이 아니라 로그인으로. 전에는 location.href 전체 이동이
    // 보호 라우트의 앱 내 이동(지연 로딩 중인 로그인 화면)과 겹쳐 Safari에서 모듈 로드 오류가 났다 (2026-09-28 QA)
    navigate("/login", { replace: true });
  };

  const saveReminderPrefs = async (prefs: {
    reminder_enabled?: boolean;
    reminder_time?: string;
    weekly_report_enabled?: boolean;
  }) => {
    setSavingReminder(true);
    try {
      await usersApi.updateProfile(prefs);
      useAuthStore.setState((prev) => ({
        user: prev.user
          ? {
              ...prev.user,
              ...(prefs.reminder_enabled !== undefined ? { reminder_enabled: prefs.reminder_enabled ? 1 : 0 } : {}),
              ...(prefs.reminder_time !== undefined ? { reminder_time: prefs.reminder_time } : {}),
              ...(prefs.weekly_report_enabled !== undefined ? { weekly_report_enabled: prefs.weekly_report_enabled ? 1 : 0 } : {}),
            }
          : null,
      }));
    } catch {
      // 저장 실패 시 무시
    } finally {
      setSavingReminder(false);
    }
  };

  const handleReminderToggle = async () => {
    const next = !reminderEnabled;
    setReminderEnabled(next);
    await saveReminderPrefs({ reminder_enabled: next });
  };

  const handleReminderTimeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setReminderTime(next);
    await saveReminderPrefs({ reminder_time: next });
  };

  const handleWeeklyReportToggle = async () => {
    const next = !weeklyReportEnabled;
    setWeeklyReportEnabled(next);
    await saveReminderPrefs({ weekly_report_enabled: next });
  };

  return (
    <motion.div
      ref={popupRef}
      role="dialog"
      aria-modal="true"
      aria-label="프로필"
      tabIndex={-1}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      // 화면 높이 안에서 내부 스크롤 — 작은 폰에서 하단 탭바가 로그아웃 버튼을 가리던 문제 (iPhone 15 Pro 에뮬레이션)
      className="absolute right-0 top-full mt-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-y-auto overscroll-contain z-50 outline-none max-h-[calc(var(--vp-h)-var(--topbar-h)-var(--bottomnav-h)-1rem)] md:max-h-[calc(var(--vp-h)-var(--topbar-h)-1.5rem)]"
      style={{ width: 320, maxWidth: "calc(100vw - 1rem)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 상단: 이메일 + 닫기 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 12 }}>
          {user.email}
        </p>
        <button
          onClick={onClose}
          aria-label="프로필 닫기"
          className="w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 중앙: 아바타 + 인사말 */}
      <div className="flex flex-col items-center px-4 pb-4">
        {/* 아바타 + 카메라 아이콘 (이모지 선택 트리거) */}
        <div className="relative mb-3">
          <div className="rounded-full p-[3px]" style={{ background: "conic-gradient(#4285F4, #EA4335, #FBBC05, #34A853, #4285F4)" }}>
            <div className="rounded-full bg-white dark:bg-[#1E293B] p-[2px]">
              <ProfileAvatar user={user} size={80} fontSize={28} />
            </div>
          </div>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={saving}
            aria-label="프로필 이모지 변경"
            aria-expanded={showEmojiPicker}
            className="group absolute -bottom-2 -right-2 w-11 h-11 flex items-center justify-center"
          >
            <span className="w-7 h-7 rounded-full bg-white dark:bg-[#334155] border border-[#E2E8F0] dark:border-[#475569] shadow-sm flex items-center justify-center group-hover:bg-[#F8FAFC] dark:group-hover:bg-[#475569] transition-colors">
              <Camera size={13} className="text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
            </span>
          </button>

          {/* 이모지 피커 */}
          <AnimatePresence>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* 인사말 */}
        <p className="text-[#1E293B] dark:text-[#F8FAFC] text-center mb-1" style={{ fontSize: 16, fontWeight: 600 }}>
          {getGreeting(user.name)}
        </p>

        {/* 가입일 */}
        <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>
          가입일: {user.created_at ? formatDate(user.created_at) : "정보 없음"}
        </p>
      </div>

      {/* 구분선 */}
      <div className="border-t border-[#E2E8F0] dark:border-[#334155]" />

      {/* 하단: 알림 토글 + 로그아웃 */}
      <div className="p-3 space-y-2">
        {/* 푸시 알림 토글 */}
        <PushNotificationToggle />

        {/* 바로가기 — 모바일 하단 탭·상단바에 없는 화면으로 이동 */}
        <nav aria-label="바로가기" className="space-y-0.5">
          <p className="text-[#64748B] dark:text-[#94A3B8] px-1" style={{ fontSize: 11, fontWeight: 700 }}>바로가기</p>
          {(user.role === "admin" ? [ADMIN_SHORTCUT, ...SHORTCUTS] : SHORTCUTS).map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => { onClose(); navigate(path); }}
              className="w-full min-h-[44px] flex items-center justify-between rounded-xl px-1 text-left hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
            >
              <span className="flex items-center gap-2 text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13 }}>
                <Icon size={18} className="text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                {label}
              </span>
              <ChevronRight size={16} className="text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
            </button>
          ))}
        </nav>

        {/* 앱 디자인 (강조색·화면 모드) */}
        <button
          onClick={() => { onClose(); navigate("/settings/appearance"); }}
          className="w-full min-h-[44px] flex items-center justify-between rounded-xl px-1 text-left hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
        >
          <span className="flex items-center gap-2 text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13 }}>
            <Palette size={18} className="text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            앱 디자인
          </span>
          <ChevronRight size={16} className="text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
        </button>

        {/* 알림 설정 */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#475569] p-3 space-y-2">
          <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11, fontWeight: 700 }}>
            알림 설정
          </p>
          {/* 독서 리마인더 토글 */}
          <div className="flex items-center justify-between">
            <span className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13 }}>독서 리마인더</span>
            <SwitchButton
              checked={reminderEnabled}
              onClick={handleReminderToggle}
              disabled={savingReminder}
              label="독서 리마인더"
            />
          </div>
          {/* 알림 시각 */}
          {reminderEnabled && (
            <div className="flex items-center justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>알림 시각</span>
              <select
                value={reminderTime}
                onChange={handleReminderTimeChange}
                aria-label="리마인더 시간"
                disabled={savingReminder}
                className="rounded-lg border border-[#E2E8F0] dark:border-[#475569] bg-white dark:bg-[#334155] text-[#1E293B] dark:text-[#F8FAFC] px-2 py-1"
                style={{ fontSize: 12 }}
              >
                {REMINDER_TIMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
          {/* 주간 독서 리포트 */}
          <div className="flex items-center justify-between">
            <span className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13 }}>주간 독서 리포트</span>
            <SwitchButton
              checked={weeklyReportEnabled}
              onClick={handleWeeklyReportToggle}
              disabled={savingReminder}
              label="주간 독서 리포트"
            />
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#475569] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#EF4444] dark:hover:bg-[#450A0A] dark:hover:text-[#FCA5A5] transition-colors"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </motion.div>
  );
}
