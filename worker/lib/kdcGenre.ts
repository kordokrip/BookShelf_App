/**
 * KDC(한국십진분류) → 앱 장르 매핑. 근거는 국립중앙도서관 ISBN 서지정보의 부가기호(EA_ADD_CODE) 또는 KDC 값.
 *
 * ISBN 부가기호는 5자리다: 1번째 독자대상, 2번째 발행형태, 3~5번째 내용분류(KDC 앞 세 자리).
 * 예) 03850 → 교양·단행본·독일문학(850).
 *
 * sure=true면 그대로 쓴다. false면 앱 장르가 KDC보다 잘게(또는 다르게) 나뉘는 영역이라 LLM에 힌트로 넘기고,
 * LLM이 실패할 때만 이 값을 쓴다(예: 문학 → 고전·현대·해외, 0xx 컴퓨터 → 프로그래밍·AI·시스템).
 */
import type { Genre } from './genres';

export interface KdcGenre {
  genre: Genre;
  sure: boolean;
  /** LLM 힌트용 분류 이름 */
  label: string;
}

/** 부가기호(5자리) 또는 KDC 문자열에서 KDC 앞 세 자리를 꺼낸다 */
export function kdcFromSeoji(addCode?: string | null, kdc?: string | null): string | null {
  const add = (addCode ?? '').replace(/\D/g, '');
  if (add.length === 5) return add.slice(2);
  const k = (kdc ?? '').replace(/[^\d.]/g, '');
  const m = /^(\d{3})/.exec(k);
  return m ? m[1]! : null;
}

export function genreFromKdc(code: string | null): KdcGenre | null {
  if (!code || !/^\d{3}$/.test(code)) return null;
  const n = Number(code);
  const main = Math.floor(n / 100);
  const div = Math.floor(n / 10); // 앞 두 자리

  switch (main) {
    case 0:
      if (n === 4 || n === 5) return { genre: '컴퓨터·프로그래밍', sure: false, label: `KDC ${code} 컴퓨터과학·프로그래밍` };
      return null; // 총류(백과사전·도서관학 등)는 근거가 약하다
    case 1:
      if (div === 18) return { genre: '심리학', sure: true, label: `KDC ${code} 심리학` };
      if (div === 19) return { genre: '자기계발', sure: false, label: `KDC ${code} 윤리학·처세` };
      return { genre: '철학', sure: true, label: `KDC ${code} 철학` };
    case 2:
      return { genre: '종교/영성', sure: true, label: `KDC ${code} 종교` };
    case 3:
      if (div === 32) return { genre: '경제/경영', sure: true, label: `KDC ${code} 경제·경영` };
      if (div === 34 || div === 35 || div === 36 || div === 39) return { genre: '정치/법률', sure: true, label: `KDC ${code} 정치·행정·법` };
      return { genre: '사회과학', sure: true, label: `KDC ${code} 사회과학` };
    case 4:
      return { genre: '과학/수학', sure: true, label: `KDC ${code} 자연과학` };
    case 5:
      return { genre: '시스템개발', sure: false, label: `KDC ${code} 기술과학` };
    case 6:
      if (div === 69) return null; // 오락·스포츠
      return { genre: '예술/디자인', sure: true, label: `KDC ${code} 예술` };
    case 7:
      return { genre: '인문학', sure: true, label: `KDC ${code} 언어` };
    case 8:
      if (div === 81) return { genre: '현대문학', sure: false, label: `KDC ${code} 한국문학` };
      return { genre: '해외문학', sure: false, label: `KDC ${code} 외국문학` };
    case 9:
      if (n === 911) return { genre: '한국사', sure: true, label: `KDC ${code} 한국사` };
      if (div === 98) return null; // 지리·여행
      return { genre: '해외사', sure: false, label: `KDC ${code} 역사` };
    default:
      return null;
  }
}
