/**
 * src/lib/themePresets.ts(프리셋 정의) → src/styles/accent.css(CSS 변수) 생성.
 * 실행: node scripts/generate-accent-css.mjs   (프리셋 값을 바꾼 뒤 실행, 결과 CSS도 커밋)
 * 두 파일이 같은지는 src/lib/__tests__/themePresets.test.ts가 검사한다.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'src/lib/themePresets.ts'), 'utf8');
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const parse = (list) => list.split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);

const presets = [...src.matchAll(/id: '(\w+)'[\s\S]*?brand: \[([^\]]+)\],\s*brand2: \[([^\]]+)\]/g)]
  .map(([, id, b, b2]) => ({ id, brand: parse(b), brand2: parse(b2) }));
if (presets.length === 0) throw new Error('프리셋을 찾지 못했습니다');

const block = ({ id, brand, brand2 }) => {
  const sel = id === 'indigo' ? ':root, [data-accent="indigo"]' : `[data-accent="${id}"]`;
  const lines = [
    ...STEPS.map((s, i) => `  --brand-${s}: ${brand[i]};`),
    ...STEPS.map((s, i) => `  --brand2-${s}: ${brand2[i]};`),
  ];
  return `${sel} {\n${lines.join('\n')}\n}\n`;
};

const css = `/*
 * 개인 앱 테마(강조색) — scripts/generate-accent-css.mjs가 src/lib/themePresets.ts에서 생성. 직접 고치지 말 것.
 * 앱의 강조색은 Tailwind indigo·violet 클래스와 인라인 var(--brand-*)로 쓰인다. 아래 @theme inline이
 * indigo→--brand, violet→--brand2로 연결하므로 <html data-accent="ocean"> 하나로 앱 전체 강조색이 바뀐다.
 * 장르 색·생성 표지·앱 로고처럼 의미가 고정된 색은 hex를 그대로 써서 테마를 따르지 않는다.
 */

${presets.map(block).join('\n')}
@theme inline {
${STEPS.map((s) => `  --color-indigo-${s}: var(--brand-${s});`).join('\n')}
${STEPS.map((s) => `  --color-violet-${s}: var(--brand2-${s});`).join('\n')}
}

:root {
  /* 브랜드 그라디언트 — 버튼·배너 등 인라인 style에서 사용 */
  --brand-gradient: linear-gradient(135deg, var(--brand-600) 0%, var(--brand2-600) 100%);
}
`;
writeFileSync(join(ROOT, 'src/styles/accent.css'), css);
console.log(`✅ accent.css — 프리셋 ${presets.length}종`);
