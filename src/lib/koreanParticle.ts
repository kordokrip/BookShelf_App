/**
 * 한국어 조사 선택 — 캐릭터·단계 이름처럼 동적으로 들어가는 단어 뒤에 붙인다.
 * 마지막 글자의 받침 유무로 판단하며, 한글이 아니면 받침 없음으로 본다.
 */
function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

/** 주격: "책 부엉이가" / "페이지 드래곤이" */
export function subjectParticle(word: string): '이' | '가' {
  return hasFinalConsonant(word) ? '이' : '가';
}

/** 서술격: "아기 부엉이예요" / "어린 용이에요" */
export function copulaEnding(word: string): '이에요' | '예요' {
  return hasFinalConsonant(word) ? '이에요' : '예요';
}
