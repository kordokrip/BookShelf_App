/** 기기 로컬 날짜(YYYY-MM-DD) — toISOString()은 UTC라 한국(UTC+9) 자정~오전 9시에 전날이 된다 */
export function localDateString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
