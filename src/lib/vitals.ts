import { onLCP, onINP, onCLS } from 'web-vitals';

interface VitalPayload {
  metric: string;
  value: number;
  page: string;
  ua_mobile: boolean;
}

function send(payload: VitalPayload) {
  try {
    navigator.sendBeacon('/api/vitals', JSON.stringify(payload));
  } catch {
    // sendBeacon 미지원 환경에서 조용히 무시
  }
}

function handleMetric({ name, value }: { name: string; value: number }) {
  if (Math.random() >= 0.2) return; // 20% 샘플링
  send({
    metric: name,
    value: Math.round(name === 'CLS' ? value * 1000 : value), // CLS는 0.x → 정수 변환
    page: location.pathname,
    ua_mobile: /Mobi|Android/i.test(navigator.userAgent),
  });
}

export function initVitals() {
  onLCP(handleMetric);
  onINP(handleMetric);
  onCLS(handleMetric);
}
