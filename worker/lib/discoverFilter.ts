/**
 * 신간 탭(카카오 검색) 결과 정제 — 미래 출간일(예: 2062-02)·수험서 등 잡음 제거. 보수적으로 적용한다.
 */
export const MAX_FUTURE_DAYS = 31;

/** 신간으로 보기 어려운 제목 키워드(수험서·검정고시류) */
const NON_TRADE_TITLE = /검정고시|수험서|기출문제|기출\s*문제|자격증|공무원\s*시험|합격\s*(?:노트|공략)|모의고사/;

/** 출간일이 now 기준 maxFutureDays일보다 더 미래이거나 파싱 불가면 false */
export function isPlausiblePubDate(datetime: string, now: number = Date.now(), maxFutureDays = MAX_FUTURE_DAYS): boolean {
  const t = new Date(datetime).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now + maxFutureDays * 24 * 60 * 60 * 1000;
}

/** 신간 탭에 보여줄 만한 항목인가(저자 없음·수험서 키워드 제외) */
export function isTradeBook(doc: { title: string; authors: string[] }): boolean {
  if (!doc.authors.some((a) => a.trim())) return false;
  return !NON_TRADE_TITLE.test(doc.title);
}
