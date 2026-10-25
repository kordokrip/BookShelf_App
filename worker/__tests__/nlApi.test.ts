import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { parseSeoji, parseCollectionKdc, cleanToc, fetchToc, fetchSeoji, fetchCollectionKdc, TOC_MAX_CHARS } from '../lib/nlApi';

beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); vi.spyOn(console, 'warn').mockImplementation(() => undefined); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// 2026-10-25 실제 응답에서 필드만 추린 픽스처
const SEOJI_SAPIENS = {
  TOTAL_COUNT: '1', PAGE_NO: '1',
  docs: [{ TITLE: '사피엔스', PAGE: '약 640쪽 내외', EA_ADD_CODE: '03900', KDC: '909', SUBJECT: '9', BOOK_TB_CNT_URL: 'https://www.nl.go.kr/seoji/fu/ecip/dbfiles/CIP_FILES_TBL/1_toc.txt' }],
};
const SEOJI_DEMIAN = { TOTAL_COUNT: '1', PAGE_NO: '1', docs: [{ TITLE: '데미안', PAGE: '', EA_ADD_CODE: '04850', KDC: '', BOOK_TB_CNT_URL: '' }] };
const COLLECTION_DEMIAN = { total: 3, result: [{ titleInfo: '데미안', classNo: '853', kdcName1s: '문학' }, { titleInfo: '데미안', classNo: '' }] };

describe('parseSeoji — ISBN 서지정보', () => {
  it('쪽수·부가기호 내용분류·KDC·목차 URL', () => {
    expect(parseSeoji(SEOJI_SAPIENS)).toEqual({ pages: 640, addCodeKdc: '900', kdc: '909', tocUrl: SEOJI_SAPIENS.docs[0]!.BOOK_TB_CNT_URL });
    expect(parseSeoji(SEOJI_DEMIAN)).toEqual({ pages: null, addCodeKdc: '850', kdc: null, tocUrl: null });
  });

  it('등록 안 된 ISBN·깨진 응답은 null', () => {
    expect(parseSeoji({ TOTAL_COUNT: '0', docs: [] })).toBeNull();
    expect(parseSeoji(null)).toBeNull();
  });
});

describe('parseCollectionKdc — 소장자료', () => {
  it('classNo가 있는 첫 결과(세 자리 이상 KDC)', () => {
    expect(parseCollectionKdc(COLLECTION_DEMIAN)).toBe('853');
    expect(parseCollectionKdc({ result: [{ classNo: '813.62' }] })).toBe('813.62');
  });

  it('classNo가 없거나 형식이 아니면 null', () => {
    expect(parseCollectionKdc({ total: 0, result: [] })).toBeNull();
    expect(parseCollectionKdc({ result: [{ classNo: '813.6-26' }] })).toBeNull();
    expect(parseCollectionKdc(null)).toBeNull();
  });
});

describe('키가 없으면 호출하지 않는다', () => {
  it('fetchSeoji·fetchCollectionKdc는 NL_CERT_KEY 없으면 바로 null', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await fetchSeoji({}, '9788937460449')).toBeNull();
    expect(await fetchCollectionKdc({}, '9788937460449')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('목차 파일', () => {
  it('cleanToc: 빈 줄·공백 정리, 길이 제한', () => {
    expect(cleanToc('제1부  인지혁명\r\n\r\n1. 별로   중요치 않은 동물\r\n')).toBe('제1부 인지혁명\n1. 별로 중요치 않은 동물');
    expect(Array.from(cleanToc('가'.repeat(5000))).length).toBe(TOC_MAX_CHARS);
  });

  it('fetchToc: CP949(EUC-KR) 텍스트를 디코딩한다', async () => {
    // "제1부 인지혁명\r\n1. 별로 중요치 않은 동물" 의 CP949 바이트
    const bytes = new Uint8Array([0xc1, 0xa6, 0x31, 0xba, 0xce, 0x20, 0xc0, 0xce, 0xc1, 0xf6, 0xc7, 0xf5, 0xb8, 0xed, 0x0d, 0x0a,
      0x31, 0x2e, 0x20, 0xba, 0xb0, 0xb7, 0xce, 0x20, 0xc1, 0xdf, 0xbf, 0xe4, 0xc4, 0xa1, 0x20, 0xbe, 0xca, 0xc0, 0xba, 0x20, 0xb5, 0xbf, 0xb9, 0xb0]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, { status: 200, headers: { 'Content-Type': 'text/plain' } })));
    expect(await fetchToc('https://www.nl.go.kr/x.txt')).toBe('제1부 인지혁명\n1. 별로 중요치 않은 동물');
  });

  it('fetchToc: 인코딩이 다른 파일(깨진 문자)·EUC-KR 디코더가 없는 런타임은 목차 없이(null) — 깨진 글자를 프롬프트에 넣지 않는다', async () => {
    // UTF-8 바이트를 EUC-KR로 읽으면 U+FFFD가 섞인다
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new TextEncoder().encode('제1부 인지혁명 그리고 농업혁명'), { status: 200 })));
    expect(await fetchToc('https://www.nl.go.kr/x.txt')).toBeNull();
    // 라벨을 무시하고 UTF-8 디코더를 주는 런타임 흉내
    const Orig = globalThis.TextDecoder;
    vi.stubGlobal('TextDecoder', class extends Orig { constructor() { super('utf-8'); } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0xc1, 0xa6, 0x31, 0xba, 0xce, 0x20, 0xc0, 0xce, 0xc1, 0xf6, 0xc7, 0xf5, 0xb8, 0xed]), { status: 200 })));
    expect(await fetchToc('https://www.nl.go.kr/x.txt')).toBeNull();
  });

  it('fetchToc: URL 없음·실패·너무 짧은 내용은 null', async () => {
    expect(await fetchToc(null)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect(await fetchToc('https://www.nl.go.kr/x.txt')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0x31, 0x32]), { status: 200 })));
    expect(await fetchToc('https://www.nl.go.kr/x.txt')).toBeNull();
  });
});

describe('cleanToc — 길이 맞춤(52차)', () => {
  // 클린 코드 목차 모양(2026-10-25 실측: 11,371자·17장, 하위 절에 "__" 표시)
  const big = Array.from({ length: 17 }, (_, i) => [
    `${i + 1}장 장 제목 ${i + 1}`,
    ...Array.from({ length: 20 }, (_, j) => `소절 ${i + 1}-${j + 1} 설명이 조금 긴 하위 항목`),
    '__ 깊은 하위 항목',
  ].join('\n')).join('\n') + '\n부록A 동시성 II\n에필로그';

  it('짧은 목차는 그대로(줄 정리만)', () => {
    expect(cleanToc('제1부 인지혁명\r\n\r\n1.  별로 중요치 않은 동물\n')).toBe('제1부 인지혁명\n1. 별로 중요치 않은 동물');
  });

  it('길면 앞에서 자르지 않고 모든 장 제목을 남기고 하위 절을 장마다 고르게 넣는다', () => {
    const out = cleanToc(big);
    expect(Array.from(out).length).toBeLessThanOrEqual(TOC_MAX_CHARS);
    expect(out.match(/^\d+장/gm)).toHaveLength(17);
    expect(out).toContain('17장 장 제목 17');
    expect(out).toContain('부록A 동시성 II');
    expect(out).toContain('  소절 17-1');
    expect(out).not.toContain('__ 깊은');
  });

  it('장 구조를 못 찾으면 하위 표시 줄을 빼고 자른다', () => {
    const flat = Array.from({ length: 300 }, (_, i) => (i % 3 ? `__ 하위 ${i}` : `항목 ${i}`)).join('\n');
    const out = cleanToc(flat, 100);
    expect(Array.from(out).length).toBeLessThanOrEqual(100);
    expect(out).not.toContain('__');
  });
});
