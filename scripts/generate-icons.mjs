/**
 * PWA 아이콘 자동 생성 스크립트
 * 실행: node scripts/generate-icons.mjs
 *
 * 필요: npm install -D sharp
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SVG_PATH = join(ROOT, 'public/icons/icon.svg');
const ICONS_DIR = join(ROOT, 'public/icons');

const svgBuffer = readFileSync(SVG_PATH);

const sizes = [
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-512-maskable.png', size: 512, maskable: true  },
  { name: 'apple-touch-icon.png',  size: 180, maskable: false },
  { name: 'favicon-32.png',        size: 32,  maskable: false },
];

mkdirSync(ICONS_DIR, { recursive: true });

for (const { name, size, maskable } of sizes) {
  let pipeline = sharp(svgBuffer).resize(size, size);

  if (maskable) {
    // Maskable 아이콘: safe zone을 위해 약간 패딩 추가
    pipeline = sharp(svgBuffer)
      .resize(Math.round(size * 0.8), Math.round(size * 0.8))
      .extend({
        top: Math.round(size * 0.1),
        bottom: Math.round(size * 0.1),
        left: Math.round(size * 0.1),
        right: Math.round(size * 0.1),
        background: { r: 79, g: 70, b: 229, alpha: 1 }, // #4F46E5
      });
  }

  await pipeline.png().toFile(join(ICONS_DIR, name));
  console.log(`✅ ${name} (${size}x${size}) 생성 완료`);
}

console.log('\n🎉 모든 PWA 아이콘 생성 완료!');
