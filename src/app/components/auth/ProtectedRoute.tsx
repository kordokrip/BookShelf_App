import { Navigate } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const isLoading = useAuthStore((s) => s.isLoading);

  // checkAuth() 실행 중 — 로딩 표시
  if (status === 'idle' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-gray-500">로딩 중...</span>
        </div>
      </div>
    );
  }

  // 미인증 → 진입 게이트로 리다이렉트
  if (status === 'unauthenticated') {
    return <Navigate to="/entry" replace />;
  }

  return <>{children}</>;
}
