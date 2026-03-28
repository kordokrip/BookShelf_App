import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: '구글 로그인이 취소되었습니다.',
  google_token: '구글 인증 처리에 실패했습니다.',
  google_userinfo: '구글 계정 정보를 가져오지 못했습니다.',
  google_db: '계정 처리 중 오류가 발생했습니다.',
  google_unknown: '구글 로그인 중 오류가 발생했습니다.',
  not_allowed: '접근이 허용되지 않은 계정입니다. 관리자에게 문의하세요.',
};

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      const msg = ERROR_MESSAGES[error] ?? '로그인 중 오류가 발생했습니다.';
      setErrorMessage(msg);
      const delay = error === 'not_allowed' ? 4000 : 2500;
      setTimeout(() => navigate('/login', { replace: true }), delay);
      return;
    }

    // 정상 흐름: App.tsx가 /?token= 파라미터를 처리하므로 여기 도달하지 않음
    navigate('/login', { replace: true });
  }, [navigate, searchParams]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-xl font-semibold text-gray-800">로그인 실패</h2>
        <p className="text-gray-600 max-w-sm leading-relaxed">{errorMessage}</p>
        <p className="text-sm text-gray-400">잠시 후 로그인 페이지로 이동합니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}
