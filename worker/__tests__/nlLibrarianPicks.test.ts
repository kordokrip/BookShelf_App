import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLibrarianPicksXml, cleanAuthor, splitTitle, toPlainText, fetchLibrarianPicks } from '../lib/nlLibrarianPicks';

afterEach(() => vi.unstubAllGlobals());

// 2026-10-25 실제 응답 구조(태그 이름 오타 recomcontens 포함, HTML은 엔티티로 들어 있음)
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<channel>
<totalCount>3</totalCount>
<list><item>
  <recomNo>20260922163135829100</recomNo><drCode>11</drCode><drCodeName>어문학</drCodeName>
  <recomtitle>삼문동 봉주르 아파트 : 오서 장편소설</recomtitle>
  <recomauthor>지은이: 오서</recomauthor><recompublisher>자음과모음</recompublisher>
  <recomcallno>813.7-26-39</recomcallno><recomisbn>9788954473378</recomisbn>
  <recomfilepath>http://www.nl.go.kr/afile/fileDownload/TZWmn</recomfilepath>
  <recommokcha>&lt;p&gt;1부 아파트 재건축 전&lt;/p&gt;</recommokcha>
  <recomcontens>&lt;p&gt;&lt;span style=&#034;font-size: 11pt;&#034;&gt;우리나라 가구의 절반 이상이 &lsquo;아파트&rsquo;에 산다.&lt;/span&gt;&lt;/p&gt;</recomcontens>
  <recomYear>2026</recomYear><recomMonth>10</recomMonth><publishYear>2026</publishYear>
</item></list>
<list><item>
  <recomNo>2</recomNo><drCode>4</drCode><drCodeName>자연과학</drCodeName>
  <recomtitle>(아무도 모르지만 누구나 알아야 할) 최소한의 양자역학</recomtitle>
  <recomauthor>프랑크 베르스트라테 지음 ; 홍길동 옮김</recomauthor><recompublisher>출판사</recompublisher>
  <recomcallno>420.13-26-1</recomcallno><recomisbn>9791163639855 9791163639856</recomisbn>
  <recomfilepath></recomfilepath><recomcontens>양자의 세계</recomcontens>
  <recomYear>2026</recomYear><recomMonth>8</recomMonth><publishYear>2026</publishYear>
</item></list>
<list><item>
  <recomNo>3</recomNo><drCode>4</drCode><drCodeName>자연과학</drCodeName>
  <recomtitle>기후위기는 어떻게 내 몸을 병들게 하는가</recomtitle><recomauthor>크리스티나 베른트</recomauthor>
  <recomcallno>539.9-26-2</recomcallno><recomisbn>9788972972174</recomisbn>
  <recomcontens>기후</recomcontens><recomYear>2026</recomYear><recomMonth>9</recomMonth>
</item></list>
</channel>`;

describe('parseLibrarianPicksXml', () => {
  it('제목·부제·저자·KDC·장르·표지(https)·소개 평문·추천 연월, 최근 추천부터', () => {
    const picks = parseLibrarianPicksXml(XML);
    expect(picks.map((p) => p.recommendedAt)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(picks[0]).toMatchObject({
      title: '삼문동 봉주르 아파트', subtitle: '오서 장편소설', author: '오서', publisher: '자음과모음',
      isbn: '9788954473378', kdc: '813.7', genre: '현대문학', category: '문학',
      coverUrl: 'https://www.nl.go.kr/afile/fileDownload/TZWmn',
      description: '우리나라 가구의 절반 이상이 ‘아파트’에 산다.',
    });
  });

  it('앞 괄호 수식어 제거, 여러 ISBN 중 13자리, 표지 없음은 null, 역할어 제거', () => {
    const p = parseLibrarianPicksXml(XML).find((x) => x.id === '2')!;
    expect(p).toMatchObject({ title: '최소한의 양자역학', isbn: '9791163639855', coverUrl: null, author: '프랑크 베르스트라테, 홍길동', genre: '과학/수학', category: '자연' });
  });

  it('장르를 정할 수 없는 KDC(기술과학 5xx)는 genre null — 담을 때 서버 보정이 채운다', () => {
    expect(parseLibrarianPicksXml(XML).find((x) => x.id === '3')!).toMatchObject({ kdc: '539.9', genre: null });
  });

  it('빈 응답·깨진 XML은 빈 배열', () => {
    expect(parseLibrarianPicksXml('<channel><totalCount>0</totalCount></channel>')).toEqual([]);
    expect(parseLibrarianPicksXml('not xml')).toEqual([]);
  });
});

describe('보조 함수', () => {
  it.each([
    ['지은이: 오서', '오서'], ['애너 퀸들런 소설, 김지현 옮김', '애너 퀸들런, 김지현'], ['박혜연 지음', '박혜연'],
    ['글: 가 ; 그림: 나', '가, 나'],
  ])('cleanAuthor(%s) → %s', (raw, out) => { expect(cleanAuthor(raw)).toBe(out); });

  it('splitTitle·toPlainText', () => {
    expect(splitTitle('정의란 무엇인가')).toEqual({ title: '정의란 무엇인가', subtitle: null });
    expect(toPlainText('&lt;p&gt;가&amp;nbsp;나&lt;/p&gt;&lt;p&gt;다&lt;/p&gt;')).toBe('가 나\n다');
  });
});

describe('fetchLibrarianPicks', () => {
  it('키가 없으면 호출하지 않고 빈 배열, 실패해도 빈 배열', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await fetchLibrarianPicks({})).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
    expect(await fetchLibrarianPicks({ NL_CERT_KEY: 'k' })).toEqual([]);
  });

  it('최근 12개월(KST) 범위를 요청한다', async () => {
    const f = vi.fn(async () => new Response(XML, { status: 200 }));
    vi.stubGlobal('fetch', f);
    const picks = await fetchLibrarianPicks({ NL_CERT_KEY: 'k' }, Date.UTC(2026, 9, 25, 3));
    expect(picks).toHaveLength(3);
    const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get('end_date')).toBe('20261025');
    expect(url.searchParams.get('start_date')).toMatch(/^202510/);
  });
});
