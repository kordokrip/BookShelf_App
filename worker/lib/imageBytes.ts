/**
 * 파일 앞부분 바이트(매직 넘버)로 실제 이미지 형식 판별 — 요청의 Content-Type은 보내는 쪽이 마음대로 정한다(57차 보안 점검).
 * 표지 업로드는 JPEG·PNG·WebP만 받는다. 헤더와 실제 형식이 달라도 실제로 이 셋 중 하나면 받고, 저장 형식은 실제 형식으로 둔다.
 */
export type UploadImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export function sniffImageType(buf: ArrayBuffer): UploadImageType | null {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  // RIFF....WEBP
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
