import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { Plus } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants: Record<string, string> = {
    primary:   "bg-[#4F46E5] text-white hover:bg-[#4338CA] shadow-sm hover:shadow-md",
    secondary: "bg-white text-[#4F46E5] border border-[#4F46E5] hover:bg-[#EEF2FF]",
    ghost:     "bg-transparent text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B]",
    danger:    "bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-sm",
  };

  const sizes: Record<string, string> = {
    sm: "h-9 px-4 text-sm",
    md: "h-12 px-5 text-sm",
    lg: "h-14 px-6 text-base",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label?: string;
  variant?: "default" | "primary" | "ghost";
}

export function IconButton({ icon, label, variant = "default", className = "", ...props }: IconButtonProps) {
  const variants: Record<string, string> = {
    default: "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1E293B]",
    primary: "bg-[#4F46E5] text-white hover:bg-[#4338CA] shadow-sm",
    ghost:   "bg-transparent text-[#64748B] hover:bg-[#F1F5F9]",
  };

  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${variants[variant]} ${className}`}
    >
      {icon}
    </button>
  );
}

interface FABProps {
  onClick?: () => void;
  label?: string;
}

export function FAB({ onClick, label = "책 추가" }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      style={{
        bottom: "var(--floating-bottom)",
        right: "var(--floating-right)",
      }}
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
}
