/**
 * 완독 축하 컨페티 — 라이브러리 없이 DOM 조각 몇십 개를 Web Animations API로 흩뿌린 뒤 제거한다.
 * 북모리처럼 "완독"이라는 보상의 순간에만 쓰고(과한 모션은 피함), 모션 줄이기 설정이면 아무것도 하지 않는다.
 */
const COLORS = ['#4F46E5', '#7C3AED', '#FBBF24', '#10B981', '#F472B6', '#38BDF8'];

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** 화면 위쪽 가운데에서 조각을 터뜨린다. 반환값: 실제로 그렸는지 (테스트·호출부 분기용) */
export function celebrateCompletion(count = 36): boolean {
  if (typeof document === 'undefined' || prefersReducedMotion()) return false;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:250';
  document.body.appendChild(layer);

  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.3;
  let pending = count;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    const w = 6 + Math.random() * 5;
    piece.style.cssText =
      `position:absolute;left:${originX}px;top:${originY}px;width:${w}px;height:${w * 0.45}px;` +
      `background:${COLORS[i % COLORS.length]};border-radius:2px;`;
    layer.appendChild(piece);
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = 140 + Math.random() * 180;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 120;
    const anim = piece.animate?.(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 420}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    );
    const done = () => { if (--pending <= 0) layer.remove(); };
    if (anim) anim.onfinish = done; else done();
  }
  return true;
}
