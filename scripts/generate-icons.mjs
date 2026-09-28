/**
 * PWA 아이콘·파비콘·소셜 이미지 생성 — 벡터 마스터(design/icons/*.svg)에서 모든 크기를 만든다.
 * 실행: node scripts/generate-icons.mjs  (iOS 스플래시까지: npm run pwa:assets)
 *
 * 이전에는 128px 비트맵 한 장을 4.5배 확대해 만들어 모든 아이콘이 흐리고 흰 점이 남았다(2026-09-27 에셋 감사).
 *
 * 출력 (public/icons/, public/og-image.png)
 * - favicon.ico(16·32·48, PNG 내장) · favicon.svg · favicon-16/32.png  ← 작은 크기 전용 단순화 마스터
 * - apple-touch-icon.png 180 — 불투명 풀블리드(iOS가 투명 모서리를 검정으로 채우고 자체 마스크를 씌움)
 * - icon-192/512.png (purpose any) — 둥근 모서리, 투명 배경(데스크톱 설치 아이콘)
 * - icon-192/512-maskable.png — 풀블리드, 글리프를 안전 영역(중앙 80% 원) 안으로 축소
 * - icon-monochrome-512.png — 흰색 + 알파(안드로이드 테마 아이콘)
 * - badge-72/96.png — 알림 배지(안드로이드는 알파만 사용)
 * - shortcut-{record,register,stats,library}-96.png — manifest 바로가기
 * - og-image.png 1200×630 — 링크 공유 미리보기
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'design/icons');
const OUT = join(ROOT, 'public/icons');
const svg = (name) => readFileSync(join(SRC, name));

const BRAND_START = '#4F46E5';
const BRAND_END = '#7C3AED';
const GRADIENT = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND_START}"/><stop offset="1" stop-color="${BRAND_END}"/></linearGradient></defs>`;

mkdirSync(OUT, { recursive: true });
const png = (input, size, file) => sharp(input, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(OUT, file));
const log = (file, size) => console.log(`✅ ${file}${size ? ` (${size})` : ''}`);

/** 둥근 사각형으로 잘라 투명 모서리를 만든다 (radius: 한 변 대비 비율) */
async function rounded(input, size, radiusRatio) {
  const r = Math.round(size * radiusRatio);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(await sharp(input, { density: 300 }).resize(size, size).png().toBuffer())
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** 그라디언트 배경 위에 글리프를 scale 비율로 가운데 배치 (maskable 안전 영역용) */
async function onGradient(glyph, size, scale) {
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${GRADIENT}<rect width="${size}" height="${size}" fill="url(#g)"/></svg>`);
  const inner = Math.round(size * scale);
  const g = await sharp(glyph, { density: 300 }).resize(inner, inner).png().toBuffer();
  return sharp(bg).composite([{ input: g, gravity: 'center' }]).png({ compressionLevel: 9 }).toBuffer();
}

/** PNG 여러 장을 담은 .ico (Vista 이후 모든 브라우저·OS가 PNG 내장 ICO를 지원) */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

// ── 파비콘 (작은 크기 전용 마스터) ─────────────────────────────
const small = svg('app-icon-small.svg');
const icoParts = [];
for (const size of [16, 32, 48]) icoParts.push({ size, data: await sharp(small, { density: 300 }).resize(size, size).png().toBuffer() });
writeFileSync(join(ROOT, 'public/favicon.ico'), buildIco(icoParts)); log('favicon.ico', '16·32·48');
copyFileSync(join(SRC, 'app-icon-small.svg'), join(OUT, 'favicon.svg')); log('favicon.svg');
await png(small, 16, 'favicon-16.png'); log('favicon-16.png', 16);
await png(small, 32, 'favicon-32.png'); log('favicon-32.png', 32);

// ── 앱 아이콘 ───────────────────────────────────────────────
const master = svg('app-icon.svg');
const glyph = svg('app-glyph.svg');
await png(master, 180, 'apple-touch-icon.png'); log('apple-touch-icon.png', 180);
for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), await rounded(master, size, 0.225)); log(`icon-${size}.png`, size);
  // 글리프의 가장 먼 점(선반 끝)이 중앙 80% 원 안에 들도록 72%로 축소
  writeFileSync(join(OUT, `icon-${size}-maskable.png`), await onGradient(glyph, size, 0.72)); log(`icon-${size}-maskable.png`, size);
}
await png(glyph, 512, 'icon-monochrome-512.png'); log('icon-monochrome-512.png', 512);

// ── 알림 배지 ───────────────────────────────────────────────
const badge = svg('badge-glyph.svg');
for (const size of [72, 96]) { await png(badge, size, `badge-${size}.png`); log(`badge-${size}.png`, size); }

// ── manifest 바로가기 아이콘 (둥근 그라디언트 + 흰 기호) ─────────
const SHORTCUTS = {
  record: '<circle cx="512" cy="560" r="250" fill="none" stroke="#fff" stroke-width="72"/><path d="M512 420v150l90 70" fill="none" stroke="#fff" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/><rect x="452" y="210" width="120" height="70" rx="30" fill="#fff"/>',
  register: '<path d="M512 250v524M250 512h524" stroke="#fff" stroke-width="96" stroke-linecap="round"/>',
  stats: '<rect x="240" y="520" width="140" height="264" rx="36" fill="#fff"/><rect x="442" y="330" width="140" height="454" rx="36" fill="#fff"/><rect x="644" y="430" width="140" height="354" rx="36" fill="#fff"/>',
  library: '<rect x="230" y="260" width="150" height="470" rx="32" fill="#fff"/><rect x="420" y="220" width="170" height="510" rx="32" fill="#fff"/><rect x="630" y="300" width="140" height="430" rx="32" fill="#fff"/><rect x="200" y="760" width="624" height="70" rx="35" fill="#fff"/>',
};
for (const [name, body] of Object.entries(SHORTCUTS)) {
  const s = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${GRADIENT}<rect width="1024" height="1024" rx="230" fill="url(#g)"/>${body}</svg>`);
  await png(s, 96, `shortcut-${name}-96.png`); log(`shortcut-${name}-96.png`, 96);
}

// ── 링크 공유 이미지 1200×630 ────────────────────────────────
const W = 1200, H = 630;
const ogBg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${GRADIENT}
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="1080" cy="90" r="220" fill="#fff" opacity="0.07"/><circle cx="120" cy="600" r="260" fill="#fff" opacity="0.05"/>
  <text x="520" y="290" font-family="Apple SD Gothic Neo, Pretendard, Noto Sans KR, sans-serif" font-size="92" font-weight="800" fill="#fff">BookShelf</text>
  <text x="522" y="370" font-family="Apple SD Gothic Neo, Pretendard, Noto Sans KR, sans-serif" font-size="38" font-weight="600" fill="#fff" opacity="0.92">읽은 책이 한눈에 쌓이는 독서 기록</text>
  <text x="522" y="430" font-family="Apple SD Gothic Neo, Pretendard, Noto Sans KR, sans-serif" font-size="28" fill="#fff" opacity="0.75">문장 기록 · 집중 타이머 · 독서 통계 · 책 쌓기</text>
</svg>`);
const ogIcon = await rounded(master, 340, 0.225);
// 같은 그라디언트 배경 위라 타일 경계가 묻히므로 그림자로 띄운다
const ogShadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><rect x="40" y="52" width="340" height="340" rx="77" fill="#1E1B4B" opacity="0.45"/></svg>`)).blur(22).png().toBuffer();
await sharp(ogBg).composite([{ input: ogShadow, left: 70, top: 105 }, { input: ogIcon, left: 110, top: 145 }]).png({ compressionLevel: 9 }).toFile(join(ROOT, 'public/og-image.png'));
log('og-image.png', '1200×630');

console.log('\n🎉 아이콘 생성 완료 — iOS 스플래시는 npm run pwa:ios-startup');
