/**
 * ProfilePopup — Google 스타일 프로필 팝업
 * - 아바타 (이미지 / 이모지 / 이니셜)
 * - 사용자 정보: 이름, 이메일, 가입일
 * - 오늘의 인사말
 * - 프로필 이모지 선택 기능
 * - 로그아웃 버튼
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X, Camera } from "lucide-react";
import { useAuthStore, type AuthUser } from "../../../stores/authStore";
import { usersApi } from "../../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { PushNotificationToggle } from "./PushNotificationToggle";

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
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-3 z-10"
      style={{ width: 240 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>프로필 이모지 선택</p>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B]">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 rounded-lg hover:bg-[#EEF2FF] flex items-center justify-center transition-colors"
            style={{ fontSize: 18 }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSelect("")}
        className="w-full mt-2 py-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F8FAFC] transition-colors"
        style={{ fontSize: 11, fontWeight: 600 }}
      >
        이모지 제거 (이니셜로 복원)
      </button>
    </motion.div>
  );
}

/* ─── 아바타 표시 컴포넌트 (공유) ──────────────────── */
export function ProfileAvatar({
  user,
  size = 40,
  fontSize = 16,
  className = "",
}: {
  user: AuthUser | null;
  size?: number;
  fontSize?: number;
  className?: string;
}) {
  const emoji = user?.profile_emoji;
  const avatarUrl = user?.avatar_url;
  const initial = user?.name?.[0] ?? "?";

  if (avatarUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={avatarUrl}
          alt="프로필"
          className="w-full h-full object-cover"
          onError={(e) => {
            // fallback to gradient
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).parentElement!.classList.add(
              "bg-gradient-to-br", "from-[#4F46E5]", "to-[#7C3AED]"
            );
          }}
        />
      </div>
    );
  }

  if (emoji) {
    return (
      <div
        className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: "#EEF2FF",
          border: "2px solid #C7D2FE",
        }}
      >
        <span style={{ fontSize: fontSize * 1.2 }}>{emoji}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center flex-shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-white" style={{ fontSize, fontWeight: 700 }}>
        {initial}
      </span>
    </div>
  );
}

/* ─── 메인 팝업 ───────────────────────────────────── */
export function ProfilePopup({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭으로 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ESC 키로 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
    logout();
    onClose();
    window.location.href = "/splash";
  };

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute right-0 top-full mt-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-visible z-50"
      style={{ width: 320 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 상단: 이메일 + 닫기 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 12 }}>
          {user.email}
        </p>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
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
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white dark:bg-[#334155] border border-[#E2E8F0] dark:border-[#475569] shadow-sm flex items-center justify-center hover:bg-[#F8FAFC] dark:hover:bg-[#475569] transition-colors"
          >
            <Camera size={13} className="text-[#64748B]" />
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
        <p className="text-[#94A3B8] dark:text-[#64748B]" style={{ fontSize: 11 }}>
          가입일: {user.created_at ? formatDate(user.created_at) : "정보 없음"}
        </p>
      </div>

      {/* 구분선 */}
      <div className="border-t border-[#E2E8F0] dark:border-[#334155]" />

      {/* 하단: 알림 토글 + 로그아웃 */}
      <div className="p-3 space-y-2">
        {/* 푸시 알림 토글 */}
        <PushNotificationToggle />

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
