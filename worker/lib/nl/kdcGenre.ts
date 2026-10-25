/**
 * KDC(한국십진분류) → 앱 장르 매핑. 근거 우선순위(bookMeta.ts): 소장자료 classNo(예: "813.62") → 서지정보 KDC → 부가기호 내용분류.
 *
 * ISBN 부가기호는 5자리다: 1번째 독자대상, 2번째 발행형태, 3~5번째 내용분류. 실측상 내용분류는 십 단위(810·850·900·000)라
 * 911(한국사)·004.73(인공지능) 같은 구분은 소장자료 classNo로만 가능하다(2026-10-25, 20권 중 19권 보유).
 *
 * sure=true면 그대로 쓴다. false면 앱 장르가 KDC와 다르게 나뉘는 영역이라 LLM에 label을 힌트로 넘기고,
 * LLM이 실패할 때만 genre(있으면)를 쓴다.
 */
import type { Genre } from '../genres';

export interface KdcGenre {
  genre: Genre | null;
  sure: boolean;
  /** LLM 힌트용 분류 이름 */
  label: string;
}

/** 부가기호(5자리) 또는 KDC 문자열에서 KDC 앞 세 자리를 꺼낸다 — 예전 호출부 호환 */
export function kdcFromSeoji(addCode?: string | null, kdc?: string | null): string | null {
  const k = (kdc ?? '').replace(/[^\d.]/g, '');
  if (/^\d{3}/.test(k)) return k.slice(0, 3);
  const add = (addCode ?? '').replace(/\D/g, '');
  return add.length === 5 ? add.slice(2) : null;
}

/** "813.62" → { main: 813, decimal: "62" } */
function splitKdc(code: string): { n: number; decimal: string } | null {
  const m = /^(\d{3})(?:\.(\d+))?$/.exec(code.trim());
  return m ? { n: Number(m[1]), decimal: m[2] ?? '' } : null;
}

const r = (genre: Genre | null, sure: boolean, label: string): KdcGenre => ({ genre, sure, label });

export function genreFromKdc(code: string | null): KdcGenre | null {
  if (!code) return null;
  const k = splitKdc(code);
  if (!k) return null;
  const { n, decimal } = k;
  const main = Math.floor(n / 100);
  const div = Math.floor(n / 10);
  const label = (name: string) => `KDC ${code} ${name}`;

  switch (main) {
    case 0:
      if (n === 4 && decimal.startsWith('73')) return r('AI/데이터', true, label('인공지능'));
      if (n === 5) return r('컴퓨터·프로그래밍', true, label('프로그래밍·소프트웨어'));
      if (n === 4) return r('컴퓨터·프로그래밍', false, label('컴퓨터과학'));
      if (n === 0) return r(null, false, label('총류(컴퓨터·일반 포함)')); // 부가기호 "000" — 컴퓨터 책도 여기로 온다
      return null; // 도서학·문헌정보·백과사전 등은 근거가 약하다
    case 1:
      if (div === 18) return r('심리학', true, label('심리학'));
      if (div === 19) return r('자기계발', false, label('윤리학·처세'));
      return r('철학', true, label('철학'));
    case 2:
      return r('종교/영성', true, label('종교'));
    case 3:
      if (div === 32) {
        if (n === 325 && decimal.startsWith('2')) return r('자기계발', false, label('경영·성공'));
        return r('경제/경영', true, label('경제·경영'));
      }
      if (div === 34 || div === 35 || div === 36 || div === 39) return r('정치/법률', true, label('정치·행정·법'));
      if (div === 30) return r('사회과학', false, label('사회과학 일반'));
      return r('사회과학', true, label('사회과학'));
    case 4:
      return r('과학/수학', true, label('자연과학'));
    case 5:
      return r(null, false, label('기술과학(의학·공학·생활과학 등)'));
    case 6:
      if (div === 69) return r(null, false, label('오락·스포츠'));
      return r('예술/디자인', true, label('예술'));
    case 7:
      return r('인문학', true, label('언어'));
    case 8:
      if (div === 81) {
        // 한국문학 시대 구분은 소수점 첫째 자리: .1~.4 고대~개화기, .5 일제강점기, .6 현대, .7 21세기
        // (실측: 채식주의자 813.62, 아몬드 813.7). .5는 근대 작품이라 LLM이 고전·현대를 정한다
        const period = decimal[0] ?? '';
        if (period && '1234'.includes(period)) return r('고전문학', true, label('한국 고전문학'));
        if (period === '6' || period === '7') return r('현대문학', true, label('한국 현대문학'));
        return r('현대문학', false, label('한국문학'));
      }
      return r('해외문학', false, label('외국문학'));
    case 9:
      if (n === 911) return r('한국사', true, label('한국사'));
      if (n === 909 || (div >= 91 && div <= 97)) return r('해외사', true, label('세계사·외국사'));
      if (div === 98) return r(null, false, label('지리·여행'));
      if (div === 99) return r(null, false, label('전기'));
      return r('해외사', false, label('역사'));
    default:
      return null;
  }
}
