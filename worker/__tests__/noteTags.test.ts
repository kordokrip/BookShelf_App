import { describe, it, expect } from 'vitest';
import { parseTagResponse, readTags, shouldTag, buildTagMessages, MAX_TAGS } from '../lib/noteTags';

describe('parseTagResponse', () => {
  it('정상 JSON: 키워드 먼저, 감정 마지막', () => {
    expect(parseTagResponse('{"keywords":["성장","자아"],"emotion":"희망"}')).toEqual(['성장', '자아', '희망']);
  });

  it('코드펜스·앞뒤 설명이 섞여도 JSON만 추출', () => {
    const text = '다음은 결과입니다.\n```json\n{"keywords":["용기"],"emotion":"두려움"}\n```\n도움이 되길!';
    expect(parseTagResponse(text)).toEqual(['용기', '두려움']);
  });

  it('# 접두어·공백 제거, 중복 제거', () => {
    expect(parseTagResponse('{"keywords":["#성장"," 성장 ","우정"],"emotion":"우정"}')).toEqual(['성장', '우정']);
  });

  it('모든 노트에 해당하는 일반어(메모·책 등)는 버림 — 스테이징 실측 사례', () => {
    expect(parseTagResponse('{"keywords":["몰입","메모","선택","기억"],"emotion":"감정"}')).toEqual(['몰입', '선택', '기억']);
  });

  it('너무 길거나 문장·기호뿐인 값은 버림', () => {
    expect(parseTagResponse('{"keywords":["아주아주아주아주긴키워드입니다","!!!","알","a b"],"emotion":"기쁨"}'))
      .toEqual(['알', 'ab', '기쁨']);
  });

  it(`최대 ${MAX_TAGS}개`, () => {
    expect(parseTagResponse('{"keywords":["a","b","c","d","e","f"],"emotion":"g"}')).toHaveLength(MAX_TAGS);
  });

  it('깨진 JSON·빈 응답·배열 응답은 빈 결과', () => {
    expect(parseTagResponse('{"keywords":["성장",')).toEqual([]);
    expect(parseTagResponse('')).toEqual([]);
    expect(parseTagResponse('죄송하지만 분석할 수 없습니다')).toEqual([]);
  });

  it('keywords가 배열이 아니거나 문자열이 아닌 값은 무시', () => {
    expect(parseTagResponse('{"keywords":"성장","emotion":3}')).toEqual([]);
    expect(parseTagResponse('{"keywords":[1,"성장",null],"emotion":"기쁨"}')).toEqual(['성장', '기쁨']);
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

  it('프롬프트에서 서식 기호·꺾쇠 제거, 길이 제한', () => {
    const msgs = buildTagMessages(`**굵게** ==형광== <script>${'가'.repeat(2000)}`);
    const user = msgs[1]!.content;
    expect(user).not.toContain('**');
    expect(user).not.toContain('<');
    expect(user.length).toBeLessThan(1300);
  });
});
