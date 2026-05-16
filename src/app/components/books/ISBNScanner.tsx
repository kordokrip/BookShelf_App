import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { searchApi } from '@/lib/api';
import type { SearchBook } from '@/lib/api';

interface ISBNScannerProps {
  onResult: (book: SearchBook) => void;
  onClose: () => void;
}

/** ISBN 13자리 또는 10자리 형식 검증 */
function isValidIsbn(text: string): boolean {
  const cleaned = text.replace(/[^0-9X]/gi, '');
  return cleaned.length === 13 || cleaned.length === 10;
}

/** 스캔 결과를 ISBN 형식으로 정규화 */
function normalizeBarcode(rawText: string): string {
  // 공백, 하이픈, 콤마 제거 후 첫 13자리 또는 10자리 추출
  const cleaned = rawText.replace(/[^0-9X]/gi, '');
  if (cleaned.length >= 13) return cleaned.substring(0, 13);
  if (cleaned.length >= 10) return cleaned.substring(0, 10);
  return cleaned;
}

export default function ISBNScanner({ onResult, onClose }: ISBNScannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState('EAN-13, UPC-A, CODE128 등 스캔 중...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const handledRef = useRef(false);
  const isMountedRef = useRef(true);

  const stopScan = () => {
    controlsRef.current?.stop();
  };

  const startScan = async () => {
    if (!videoRef.current) return;

    // 이전 스캔 정리
    stopScan();
    setError(null);
    setIsLoading(false);
    handledRef.current = false;

    // ISBN 바코드 포맷: EAN-13, UPC-A, CODE128, CODE39 등 다양한 형식 지원
    const barcodeFormats = [
      BarcodeFormat.EAN_13,   // ISBN 표준 형식
      BarcodeFormat.EAN_8,    // EAN 8자리
      BarcodeFormat.UPC_A,    // UPC-A (미국)
      BarcodeFormat.UPC_E,    // UPC-E (미국 단축)
      BarcodeFormat.CODE_128, // CODE 128 (다양한 데이터)
      BarcodeFormat.CODE_39,  // CODE 39 (숫자+문자)
    ];

    const hintMap = new Map<DecodeHintType, unknown>();
    hintMap.set(DecodeHintType.POSSIBLE_FORMATS, barcodeFormats);
    // 바코드 감지 신뢰도 향상
    hintMap.set(DecodeHintType.ASSUME_CODE_39_CHECK_DIGIT, true);

    const codeReader = new BrowserMultiFormatReader(hintMap);

    try {
      const constraints = {
        video: {
          facingMode: 'environment' as const,
          // 카메라 화질 개선
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const controls = await codeReader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, _error) => {
          if (result && !handledRef.current && isMountedRef.current) {
            const rawText = result.getText();
            const normalized = normalizeBarcode(rawText);

            // ISBN 포맷 검증
            if (!isValidIsbn(normalized)) {
              // 포맷이 맞지 않으면 계속 스캔 (에러 표시 없음)
              return;
            }

            handledRef.current = true;
            setIsLoading(true);
            controlsRef.current?.stop();

            void (async () => {
              try {
                const { book } = await searchApi.searchByIsbn(normalized);
                if (isMountedRef.current) {
                  onResult(book);
                }
              } catch {
                if (isMountedRef.current) {
                  setError('책 정보를 찾을 수 없습니다. 직접 검색해 주세요.');
                  setIsLoading(false);
                  handledRef.current = false;
                }
              }
            })();
          }
        },
      );
      controlsRef.current = controls;
      setHints('바코드를 감지 중입니다...');
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('카메라 권한이 거부되었습니다.');
      } else {
        setError('카메라 접근 권한이 필요합니다. 설정에서 허용해주세요.');
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void startScan();
    return () => {
      isMountedRef.current = false;
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <h2 className="text-white font-semibold text-base">바코드 스캔</h2>
        <button
          type="button"
          onClick={() => { stopScan(); onClose(); }}
          className="p-2 rounded-full text-white hover:bg-white/10"
          aria-label="닫기"
        >
          <X size={20} />
        </button>
      </div>

      {/* 카메라 뷰 */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* 스캔 가이드 오버레이 */}
        {!isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* 코너 장식 */}
            <div className="relative w-64 h-40">
              <div className="absolute inset-0 border-2 border-white/30 rounded-lg" />
              {/* 四角 코너 강조 */}
              <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
            <p className="mt-4 text-white text-sm text-center drop-shadow-md px-4 font-medium">
              ISBN 바코드를 박스 안에 맞춰주세요
            </p>
            <p className="mt-2 text-white/70 text-xs text-center drop-shadow-md px-4">
              {hints}
            </p>
          </div>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white text-sm">책 정보 검색 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-8">
            <p className="text-white text-sm text-center mb-4">{error}</p>
            {error !== '카메라 권한이 거부되었습니다.' && (
              <button
                type="button"
                onClick={() => void startScan()}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium"
              >
                <RefreshCw size={16} />
                다시 시도
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
