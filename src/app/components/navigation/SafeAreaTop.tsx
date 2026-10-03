/**
 * Root 레이아웃 밖 독립 화면(/notes-search, /register-flow)의 상단 안전 영역(노치·다이내믹 아일랜드·상태 표시줄).
 *
 * 홈 화면에 설치한 PWA는 상태 표시줄이 투명(black-translucent)이라 콘텐츠가 그 아래까지 올라온다.
 * 이전의 단순 여백 div는 스크롤하면 같이 올라가서, 목록이 노치 아래로 지나가며 시계·아이콘과 겹쳐 흐릿해 보였다.
 * sticky + 불투명 배경으로 상태 표시줄 영역을 항상 덮는다 (2026-09-28 iPhone 14 Pro 사용자 제보).
 * 이 아래에 붙는 sticky 요소는 top을 var(--safe-top)으로 둘 것.
 */
export function SafeAreaTop() {
  return (
    <div
      aria-hidden
      className="sticky top-0 z-30 bg-background dark:bg-[#0F172A] flex-shrink-0"
      style={{ height: "var(--safe-top)" }}
    />
  );
}
