import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'public', 'ios-startup');
const INDEX_HTML = join(ROOT, 'index.html');
const ICON_SOURCE = join(ROOT, 'public', 'icons', 'icon-512.png');

const START_MARKER = '<!-- IOS_STARTUP_IMAGES:START -->';
const END_MARKER = '<!-- IOS_STARTUP_IMAGES:END -->';

const DEVICES = [
  { id: 'iphone-se-1', deviceWidth: 320, deviceHeight: 568, ratio: 2, pxWidth: 640, pxHeight: 1136 },
  { id: 'iphone-se-2-8', deviceWidth: 375, deviceHeight: 667, ratio: 2, pxWidth: 750, pxHeight: 1334 },
  { id: 'iphone-8-plus', deviceWidth: 414, deviceHeight: 736, ratio: 3, pxWidth: 1242, pxHeight: 2208 },
  { id: 'iphone-x-xs-11pro', deviceWidth: 375, deviceHeight: 812, ratio: 3, pxWidth: 1125, pxHeight: 2436 },
  { id: 'iphone-12-13-mini', deviceWidth: 360, deviceHeight: 780, ratio: 3, pxWidth: 1080, pxHeight: 2340 },
  { id: 'iphone-11-xr', deviceWidth: 414, deviceHeight: 896, ratio: 2, pxWidth: 828, pxHeight: 1792 },
  { id: 'iphone-11pro-max', deviceWidth: 414, deviceHeight: 896, ratio: 3, pxWidth: 1242, pxHeight: 2688 },
  { id: 'iphone-12-13-14', deviceWidth: 390, deviceHeight: 844, ratio: 3, pxWidth: 1170, pxHeight: 2532 },
  { id: 'iphone-12-13-14-pro-max', deviceWidth: 428, deviceHeight: 926, ratio: 3, pxWidth: 1284, pxHeight: 2778 },
  { id: 'iphone-15-15pro', deviceWidth: 393, deviceHeight: 852, ratio: 3, pxWidth: 1179, pxHeight: 2556 },
  { id: 'iphone-15-plus-15pro-max', deviceWidth: 430, deviceHeight: 932, ratio: 3, pxWidth: 1290, pxHeight: 2796 },
  { id: 'ipad-mini', deviceWidth: 768, deviceHeight: 1024, ratio: 2, pxWidth: 1536, pxHeight: 2048 },
  { id: 'ipad-10-2', deviceWidth: 810, deviceHeight: 1080, ratio: 2, pxWidth: 1620, pxHeight: 2160 },
  { id: 'ipad-10th', deviceWidth: 820, deviceHeight: 1180, ratio: 2, pxWidth: 1640, pxHeight: 2360 },
  { id: 'ipad-air-pro-11', deviceWidth: 834, deviceHeight: 1194, ratio: 2, pxWidth: 1668, pxHeight: 2388 },
  { id: 'ipad-pro-12-9', deviceWidth: 1024, deviceHeight: 1366, ratio: 2, pxWidth: 2048, pxHeight: 2732 },
];

function gradientSvg(width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4F46E5"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <circle cx="${Math.round(width * 0.86)}" cy="${Math.round(height * 0.18)}" r="${Math.round(Math.min(width, height) * 0.18)}" fill="rgba(255,255,255,0.08)"/>
      <circle cx="${Math.round(width * 0.14)}" cy="${Math.round(height * 0.82)}" r="${Math.round(Math.min(width, height) * 0.22)}" fill="rgba(255,255,255,0.06)"/>
    </svg>`,
  );
}

async function generateSplash(width, height, outputFile) {
  const bg = await sharp(gradientSvg(width, height)).png().toBuffer();
  const iconSize = Math.round(Math.min(width, height) * 0.24);
  const icon = await sharp(ICON_SOURCE)
    .resize(iconSize, iconSize, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp(bg)
    .composite([{ input: icon, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outputFile);
}

function buildLinkTags(entries) {
  const lines = [];
  for (const e of entries) {
    lines.push(
      `      <link rel="apple-touch-startup-image" href="${e.hrefPortrait}" media="(device-width: ${e.deviceWidth}px) and (device-height: ${e.deviceHeight}px) and (-webkit-device-pixel-ratio: ${e.ratio}) and (orientation: portrait)" />`,
    );
    lines.push(
      `      <link rel="apple-touch-startup-image" href="${e.hrefLandscape}" media="(device-width: ${e.deviceWidth}px) and (device-height: ${e.deviceHeight}px) and (-webkit-device-pixel-ratio: ${e.ratio}) and (orientation: landscape)" />`,
    );
  }
  return lines.join('\n');
}

function upsertHeadBlock(indexHtml, block) {
  const content = readFileSync(indexHtml, 'utf8');
  const wrapped = `${START_MARKER}\n${block}\n      ${END_MARKER}`;

  if (content.includes(START_MARKER) && content.includes(END_MARKER)) {
    const next = content.replace(new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`), wrapped);
    writeFileSync(indexHtml, next, 'utf8');
    return;
  }

  const anchor = '<meta name="apple-touch-fullscreen" content="yes" />';
  if (content.includes(anchor)) {
    const next = content.replace(anchor, `${anchor}\n      ${wrapped}`);
    writeFileSync(indexHtml, next, 'utf8');
    return;
  }

  const headEnd = '</head>';
  const next = content.replace(headEnd, `      ${wrapped}\n    ${headEnd}`);
  writeFileSync(indexHtml, next, 'utf8');
}

async function main() {
  if (!existsSync(ICON_SOURCE)) {
    throw new Error(`아이콘 소스를 찾을 수 없습니다: ${ICON_SOURCE}`);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = [];

  for (const d of DEVICES) {
    const portraitName = `${d.id}-portrait.png`;
    const landscapeName = `${d.id}-landscape.png`;

    await generateSplash(d.pxWidth, d.pxHeight, join(OUTPUT_DIR, portraitName));
    await generateSplash(d.pxHeight, d.pxWidth, join(OUTPUT_DIR, landscapeName));

    entries.push({
      ...d,
      hrefPortrait: `/ios-startup/${portraitName}`,
      hrefLandscape: `/ios-startup/${landscapeName}`,
    });

    console.log(`✅ ${d.id} (portrait/landscape) 생성 완료`);
  }

  const tags = buildLinkTags(entries);
  upsertHeadBlock(INDEX_HTML, tags);

  console.log('\n🎉 iOS startup 이미지 생성 및 index.html 링크 자동 반영 완료');
}

main().catch((err) => {
  console.error('❌ iOS startup 이미지 생성 실패:', err);
  process.exit(1);
});
