import { buildRecommendMessages } from '../../worker/lib/bookRecommend';
import { buildSummaryMessages } from '../../worker/lib/aiSummary';
import { buildQuoteMessages, buildReflectionMessages } from '../../worker/lib/dailyQuote';
import { buildGenreMessages } from '../../worker/lib/genreSuggestions';
const done = [
  ['데미안','헤르만 헤세','해외문학',5],['채식주의자','한강','현대문학',4],['어린 왕자','앙투안 드 생텍쥐페리','해외문학',5],
  ['사피엔스','유발 하라리','인문학',4],['코스모스','칼 세이건','과학/수학',5],['아몬드','손원평','현대문학',4],
  ['미움받을 용기','기시미 이치로','심리학',3],['총 균 쇠','재레드 다이아몬드','인문학',4],['82년생 김지영','조남주','현대문학',3],
  ['이기적 유전자','리처드 도킨스','과학/수학',5],['나미야 잡화점의 기적','히가시노 게이고','해외문학',4],['클린 코드','로버트 C. 마틴','컴퓨터·프로그래밍',4],
].map(([title,author,genre,rating]) => ({ title, author, genre, rating, status: 'done', finished_date: '2026-05-01', created_at: '2026-05-01' }));
const desc = '어린 시절 싱클레어는 밝은 세계와 어두운 세계 사이에서 갈등한다. 신비로운 소년 데미안을 만나면서 그는 선과 악, 자아에 대해 새롭게 눈뜨고, 자기 자신에게로 이르는 길을 찾아 나선다. 헤르만 헤세가 1919년 발표한 성장 소설로, 많은 독자에게 영향을 준 고전이다.';
const genreBooks = [
  { id: 'b1', title: '데미안', author: '헤르만 헤세', publisher: '민음사', genre: '기타' },
  { id: 'b2', title: '코스모스', author: '칼 세이건', publisher: '사이언스북스', genre: '기타' },
  { id: 'b3', title: '미움받을 용기', author: '기시미 이치로', publisher: '인플루엔셜', genre: '기타' },
];
const descs = new Map([['b1', desc], ['b2', '우주의 기원과 생명의 진화를 다룬 칼 세이건의 대표 과학 교양서.'], ['b3', '아들러 심리학을 철학자와 청년의 대화로 풀어낸 책.']]);
console.log(JSON.stringify({
  recommend: buildRecommendMessages(done as never, ['해외문학', '인문학']),
  summary: buildSummaryMessages('데미안', '헤르만 헤세', desc),
  quote: buildQuoteMessages({ id: 'b1', title: '데미안', author: '헤르만 헤세', genre: '해외문학', cover_image: null, cover_color: null, rating: 5 }, desc),
  reflection: buildReflectionMessages({ id: 'b1', title: '데미안', author: '헤르만 헤세', genre: '해외문학', cover_image: null, cover_color: null, rating: 5 }, desc),
  genre: buildGenreMessages(genreBooks as never, descs),
}));
