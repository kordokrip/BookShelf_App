import { describe, it, expect } from 'vitest';
import { parseTagResponse, readTags, shouldTag, buildTagMessages, MAX_TAGS, NOTE_EMOTIONS } from '../lib/noteTags';

/** 대부분의 케이스에서 쓰는 노트 본문 — 키워드는 여기에 나온 단어여야 남는다 */
const NOTE = '알을 깨고 나오는 성장의 순간, 자아를 찾는 용기와 선택, 몰입과 기억에 대한 문장';

describe('parseTagResponse', () => {
  it('정상 JSON: 키워드 먼저, 감정 마지막', () => {
    expect(parseTagResponse('{"keywords":["성장","자아"],"emotion":"희망"}', NOTE)).toEqual(['성장', '자아', '희망']);
  });

  it('코드펜스·앞뒤 설명이 섞여도 JSON만 추출', () => {
    const text = '다음은 결과입니다.\n```json\n{"keywords":["용기"],"emotion":"두려움"}\n```\n도움이 되길!';
    expect(parseTagResponse(text, NOTE)).toEqual(['용기', '두려움']);
  });

  it('# 접두어·공백 제거, 중복 제거', () => {
    expect(parseTagResponse('{"keywords":["#성장"," 성장 ","용기"],"emotion":"용기"}', NOTE)).toEqual(['성장', '용기']);
  });

  it('모든 노트에 해당하는 일반어(메모·책 등)는 버림 — 스테이징 실측 사례', () => {
    const note = '메모: 몰입해서 선택한 기억을 책에 적었다';
    expect(parseTagResponse('{"keywords":["몰입","메모","선택","기억"],"emotion":"감정"}', note)).toEqual(['몰입', '선택', '기억']);
  });

  it('본문에 없는 키워드(음차·지어낸 단어)는 버림 — 프로덕션 실측 "월드"·"우정"', () => {
    const note = '새는 알에서 나오려고 투쟁한다. 알은 세계이다. 성장은 익숙한 세계와의 결별에서 시작된다.';
    expect(parseTagResponse('{"keywords":["성장","월드","투쟁","우정"],"emotion":"감동"}', note)).toEqual(['성장', '투쟁', '감동']);
  });

  it('한 글자 키워드(새·알·방)는 버림 — 스테이징 실측', () => {
    const note = '새는 알에서 나오려고 투쟁한다. 알은 세계이다.';
    expect(parseTagResponse('{"keywords":["새","알","세계","투쟁"],"emotion":"깨달음"}', note)).toEqual(['세계', '투쟁', '깨달음']);
  });

  it('본문 비교는 띄어쓰기·대소문자 무시', () => {
    expect(parseTagResponse('{"keywords":["빈방","SQL"],"emotion":"없음"}', '그녀가 떠난 빈 방. sql 인덱스 설명')).toEqual(['빈방', 'SQL']);
  });

  it('감정은 고정 목록에 있는 것만 — "인식·상쾌"처럼 감정이 아닌 값·"없음"은 생략', () => {
    expect(parseTagResponse('{"keywords":["선택"],"emotion":"인식"}', NOTE)).toEqual(['선택']);
    expect(parseTagResponse('{"keywords":["선택"],"emotion":"상쾌"}', NOTE)).toEqual(['선택']);
    expect(parseTagResponse('{"keywords":["선택"],"emotion":"없음"}', NOTE)).toEqual(['선택']);
    expect(NOTE_EMOTIONS).toContain('깨달음');
  });

  it('너무 길거나 문장·기호뿐인 값은 버림', () => {
    const note = '아주아주아주아주긴키워드입니다 알 a b';
    expect(parseTagResponse('{"keywords":["아주아주아주아주긴키워드입니다","!!!","알","a b"],"emotion":"기쁨"}', note))
      .toEqual(['ab', '기쁨']);
  });

  it(`키워드 최대 ${MAX_TAGS - 1}개 + 감정 1개 = 최대 ${MAX_TAGS}개`, () => {
    const tags = parseTagResponse('{"keywords":["aa","bb","cc","dd","ee","ff"],"emotion":"기쁨"}', 'aa bb cc dd ee ff');
    expect(tags).toEqual(['aa', 'bb', 'cc', 'dd', '기쁨']);
    expect(tags).toHaveLength(MAX_TAGS);
  });

  it('깨진 JSON·빈 응답·배열 응답은 빈 결과', () => {
    expect(parseTagResponse('{"keywords":["성장",', NOTE)).toEqual([]);
    expect(parseTagResponse('', NOTE)).toEqual([]);
    expect(parseTagResponse('죄송하지만 분석할 수 없습니다', NOTE)).toEqual([]);
  });

  it('keywords가 배열이 아니거나 문자열이 아닌 값은 무시', () => {
    expect(parseTagResponse('{"keywords":"성장","emotion":3}', NOTE)).toEqual([]);
    expect(parseTagResponse('{"keywords":[1,"성장",null],"emotion":"기쁨"}', NOTE)).toEqual(['성장', '기쁨']);
  });

  it('노트의 서식 기호는 본문 비교에서 무시', () => {
    expect(parseTagResponse('{"keywords":["성장"],"emotion":"없음"}', '**성장**의 ==순간==')).toEqual(['성장']);
  });
});

describe('readTags', () => {
  it('JSON 배열 문자열 → 배열, 손상·null은 빈 배열', () => {
    expect(readTags('["성장","희망"]')).toEqual(['성장', '희망']);
    expect(readTags(null)).toEqual([]);
    expect(readTags('not json')).toEqual([]);
    expect(readTags('{"a":1}')).toEqual([]);
  });
});

describe('shouldTag / buildTagMessages', () => {
  it('20자 미만은 태깅하지 않음', () => {
    expect(shouldTag('짧은 메모')).toBe(false);
    expect(shouldTag('이 문장은 스무 글자를 충분히 넘기는 독서 메모입니다')).toBe(true);
  });

  it('프롬프트에서 서식 기호·꺾쇠 제거, 길이 제한 (노트는 마지막 user 메시지)', () => {
    const msgs = buildTagMessages(`**굵게** ==형광== <script>${'가'.repeat(2000)}`);
    const user = msgs[msgs.length - 1]!;
    expect(user.role).toBe('user');
    expect(user.content).not.toContain('**');
    expect(user.content).not.toContain('<');
    expect(user.content.length).toBeLessThan(1300);
  });

  it('시스템 프롬프트에 감정 목록, 예시 1쌍(user→assistant) 포함', () => {
    const msgs = buildTagMessages('예시 확인용 노트 내용입니다. 스무 글자를 넘깁니다.');
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(msgs[0]!.content).toContain(NOTE_EMOTIONS.join(', '));
    expect(JSON.parse(msgs[2]!.content)).toHaveProperty('keywords');
  });
});
