/**
 * PWA 아이콘 자동 생성 스크립트
 * 실행: node scripts/generate-icons.mjs
 *
 * 필요: npm install -D sharp
 *
 * 소스: bookshelf_shelf_128.png
 *   - 흰 배경 제거 (r,g,b > 235 이상인 픽셀을 투명 처리)
 *   - 앱 브랜드 그라디언트(#4F46E5 → #7C3AED) 배경 위에 합성
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PNG = join(ROOT, 'bookshelf_shelf_128.png');
const ICONS_DIR = join(ROOT, 'public/icons');

// ── 앱 브랜드 색상 ───────────────────────────────────────────
const BRAND_START = '#4F46E5';  // indigo-600
const BRAND_END   = '#7C3AED';  // violet-600

/** 그라디언트 + 모서리 둥글기 배경 SVG 생성 */
function makeBgSvg(size, radiusRatio = 0.18) {
  const rx = Math.round(size * radiusRatio);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="${BRAND_START}"/>
          <stop offset="100%" stop-color="${BRAND_END}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>
    </svg>`
  );
}

/** 원본 PNG에서 흰 배경을 투명으로 교체한 Buffer 반환 */
async function makeTransparentSource() {
  // 원본 128×128에서 하단 텍스트 라벨("bookshelf") 제거: 상단 94px만 사용
  const CROP_HEIGHT = 94;

  const { data, info } = await sharp(SOURCE_PNG)
    .extract({ left: 0, top: 0, width: 128, height: CROP_HEIGHT })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 순수 흰색/중성 회색만 제거:
  //   밝기(min채널) > 245  AND  채널 간 편차 < 8 (중성 = 색조 없음)
  // 내부 크림 배경(warm 톤: R>G>B 편차 ≥ 10)은 보존
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const minC = Math.min(r, g, b);
    const spread = Math.max(r, g, b) - minC;  // 색조 편차
    if (minC > 245 && spread < 8) {
      // 선형 페이드: minC 245=불투명, 254=완전 투명
      const alpha = 1 - (minC - 245) / 9;
      data[i + 3] = Math.round(alpha * data[i + 3]);
    }
  }

  return { buffer: Buffer.from(data), info };
}

const sizes = [
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-512-maskable.png', size: 512, maskable: true  },
  { name: 'apple-touch-icon.png',  size: 180, maskable: false },
  { name: 'favicon-32.png',        size: 32,  maskable: false },
];

mkdirSync(ICONS_DIR, { recursive: true });

console.log('📸 원본 PNG 흰 배경 제거 중...');
const { buffer: srcData, info: srcInfo } = await makeTransparentSource();

for (const { name, size, maskable } of sizes) {
  // maskable: safe-zone 80% 규칙 (safe area = 중앙 80%)
  const contentRatio = maskable ? 0.72 : 0.82;
  const contentSize  = Math.round(size * contentRatio);
  const radiusRatio  = maskable ? 0 : 0.18;  // maskable은 정사각형 배경

  // 1) 그라디언트 배경 생성
  const bgBuffer = await sharp(makeBgSvg(size, radiusRatio))
    .resize(size, size)
    .png()
    .toBuffer();

  // 2) 소스 이미지를 target size에 맞게 리사이징
  const iconBuffer = await sharp(srcData, {
    raw: { width: srcInfo.width, height: srcInfo.height, channels: 4 },
  })
    .resize(contentSize, contentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 3) 배경 위에 아이콘 합성 (중앙 정렬)
  await sharp(bgBuffer)
    .composite([{ input: iconBuffer, gravity: 'center' }])
    .png()
    .toFile(join(ICONS_DIR, name));

  console.log(`✅ ${name} (${size}x${size}) 생성 완료`);
}

console.log('\n🎉 모든 PWA 아이콘 생성 완료!');
