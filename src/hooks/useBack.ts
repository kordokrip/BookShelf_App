import { useNavigate } from 'react-router';

/**
 * standalone PWA 뒤로가기 훅.
 * history 스택이 있으면 navigate(-1), 없으면 fallback 경로로 이동.
 * 브라우저/앱 공통으로 사용.
 */
export function useBack(fallback = '/') {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
}
