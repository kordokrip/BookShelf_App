import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, Zap, ZapOff } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { searchApi } from '@/lib/api';
import type { SearchBook } from '@/lib/api';

interface ISBNScannerProps {
  onResult: (book: SearchBook) => void;
  onClose: () => void;
}

interface ScannerTuningProfile {
  version: 1;
  deviceKey: string;
  attempts: number;
  successes: number;
  failures: number;
  avgSuccessMs: number;
  avgFailureMs: number;
  refocusMs: number;
  baseZoom: number;
  updatedAt: number;
}

const SCANNER_TUNING_STORAGE_KEY = 'bookshelf:isbn-scanner-tuning:v1';
const DEFAULT_REFOCUS_MS = 2200;
const DEFAULT_BASE_ZOOM = 1.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fingerprintDevice(): string {
  const source = [
    navigator.userAgent,
    navigator.language,
    String(window.devicePixelRatio || 1),
    `${window.screen.width}x${window.screen.height}`,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  return `d${Math.abs(hash)}`;
}

function loadTuningProfile(): ScannerTuningProfile {
  const deviceKey = fingerprintDevice();
  const fallback: ScannerTuningProfile = {
    version: 1,
    deviceKey,
    attempts: 0,
    successes: 0,
    failures: 0,
    avgSuccessMs: 0,
    avgFailureMs: 0,
    refocusMs: DEFAULT_REFOCUS_MS,
    baseZoom: DEFAULT_BASE_ZOOM,
    updatedAt: Date.now(),
  };

  try {
    const raw = localStorage.getItem(SCANNER_TUNING_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ScannerTuningProfile>;
    if (parsed.version !== 1 || parsed.deviceKey !== deviceKey) return fallback;

    return {
      ...fallback,
      ...parsed,
      refocusMs: clamp(parsed.refocusMs ?? DEFAULT_REFOCUS_MS, 1000, 3200),
      baseZoom: clamp(parsed.baseZoom ?? DEFAULT_BASE_ZOOM, 1.0, 2.4),
      updatedAt: Date.now(),
    };
  } catch {
    return fallback;
  }
}

function saveTuningProfile(profile: ScannerTuningProfile): void {
  try {
    localStorage.setItem(SCANNER_TUNING_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // 저장 실패는 기능에 영향이 없으므로 무시
  }
}

function tuneFromAttempt(
  previous: ScannerTuningProfile,
  outcome: 'success' | 'failure',
  durationMs: number,
): ScannerTuningProfile {
  let refocusMs = previous.refocusMs;
  let baseZoom = previous.baseZoom;

  if (outcome === 'success') {
    if (durationMs >= 9000) {
      refocusMs -= 180;
      baseZoom += 0.08;
    } else if (durationMs <= 2800) {
      refocusMs += 120;
      baseZoom -= 0.04;
    }
  } else {
    refocusMs -= 220;
    baseZoom += 0.1;
  }

  refocusMs = clamp(refocusMs, 1000, 3200);
  baseZoom = clamp(baseZoom, 1.0, 2.4);

  const nextAttempts = previous.attempts + 1;
  const nextSuccesses = previous.successes + (outcome === 'success' ? 1 : 0);
  const nextFailures = previous.failures + (outcome === 'failure' ? 1 : 0);

  const nextAvgSuccessMs =
    outcome === 'success'
      ? (previous.avgSuccessMs * previous.successes + durationMs) / Math.max(1, nextSuccesses)
      : previous.avgSuccessMs;

  const nextAvgFailureMs =
    outcome === 'failure'
      ? (previous.avgFailureMs * previous.failures + durationMs) / Math.max(1, nextFailures)
      : previous.avgFailureMs;

  return {
    ...previous,
    attempts: nextAttempts,
    successes: nextSuccesses,
    failures: nextFailures,
    avgSuccessMs: Math.round(nextAvgSuccessMs),
    avgFailureMs: Math.round(nextAvgFailureMs),
    refocusMs,
    baseZoom,
    updatedAt: Date.now(),
  };
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
  const showDebugPanel = import.meta.env.DEV;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState('EAN-13, UPC-A, CODE128 등 스캔 중...');
  const [guideStep, setGuideStep] = useState(0);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const refocusTimerRef = useRef<number | null>(null);
  const guideTimerRef = useRef<number | null>(null);
  const autoFocusPulseRef = useRef(false);
  const tuningRef = useRef<ScannerTuningProfile>(loadTuningProfile());
  const [debugProfile, setDebugProfile] = useState<ScannerTuningProfile>(() => tuningRef.current);
  const attemptStartedAtRef = useRef(0);
  const attemptRecordedRef = useRef(false);
  const handledRef = useRef(false);
  const isMountedRef = useRef(true);

  const recordAttempt = (outcome: 'success' | 'failure') => {
    if (attemptRecordedRef.current || attemptStartedAtRef.current <= 0) return;

    const durationMs = Date.now() - attemptStartedAtRef.current;
    if (durationMs < 500) return;

    const next = tuneFromAttempt(tuningRef.current, outcome, durationMs);
    tuningRef.current = next;
    saveTuningProfile(next);
    setDebugProfile(next);
    attemptRecordedRef.current = true;

    if (outcome === 'failure' && isMountedRef.current) {
      setHints('인식 지연이 감지되어 스캐너 파라미터를 자동 보정했습니다. 다시 시도해 주세요.');
    }
  };

  const setTorch = async (enabled: boolean) => {
    const track = trackRef.current;
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled } as MediaTrackConstraintSet],
      });
      if (isMountedRef.current) {
        setIsTorchOn(enabled);
      }
    } catch {
      // 일부 브라우저/기기에서는 torch 제약조건을 지원하지 않는다.
      if (isMountedRef.current) {
        setIsTorchSupported(false);
        setIsTorchOn(false);
      }
    }
  };

  const enhanceTrackForScanning = async (track: MediaStreamTrack) => {
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      torch?: boolean;
      zoom?: { min?: number; max?: number };
    };

    const advanced: Array<Record<string, unknown>> = [
      { focusMode: 'continuous' },
      { exposureMode: 'continuous' },
      { whiteBalanceMode: 'continuous' },
    ];

    if (capabilities?.zoom && typeof capabilities.zoom.min === 'number' && typeof capabilities.zoom.max === 'number') {
      const zoomTarget = Math.min(Math.max(tuningRef.current.baseZoom, capabilities.zoom.min), capabilities.zoom.max);
      advanced.push({ zoom: zoomTarget });
    }

    try {
      await track.applyConstraints({ advanced: advanced as unknown as MediaTrackConstraintSet[] });
    } catch {
      // 지원하지 않는 고급 제약은 무시하고 기본 스캔을 유지한다.
    }

    setIsTorchSupported(Boolean(capabilities?.torch));
  };

  const triggerRefocus = async () => {
    const track = trackRef.current;
    if (!track || handledRef.current || isLoading || error) return;

    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      zoom?: { min?: number; max?: number };
    };

    const advanced: Array<Record<string, unknown>> = [
      { focusMode: 'continuous' },
      { exposureMode: 'continuous' },
    ];

    if (capabilities?.zoom && typeof capabilities.zoom.min === 'number' && typeof capabilities.zoom.max === 'number') {
      const max = capabilities.zoom.max;
      const min = capabilities.zoom.min;
      const baseZoom = Math.min(Math.max(tuningRef.current.baseZoom, min), max);
      const pulseZoom = Math.min(Math.max(baseZoom + (autoFocusPulseRef.current ? 0.08 : -0.08), min), max);
      advanced.push({ zoom: pulseZoom });
      autoFocusPulseRef.current = !autoFocusPulseRef.current;
    }

    try {
      await track.applyConstraints({ advanced: advanced as unknown as MediaTrackConstraintSet[] });
    } catch {
      // 지원되지 않는 고급 제약은 무시한다.
    }
  };

  const startAutoRefocus = () => {
    if (refocusTimerRef.current) {
      window.clearInterval(refocusTimerRef.current);
    }

    refocusTimerRef.current = window.setInterval(() => {
      void triggerRefocus();
    }, tuningRef.current.refocusMs);
  };

  const startGuideProgress = () => {
    if (guideTimerRef.current) {
      window.clearInterval(guideTimerRef.current);
    }

    setGuideStep(0);
    const startedAt = Date.now();
    guideTimerRef.current = window.setInterval(() => {
      if (handledRef.current || isLoading || error) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed >= 18000) {
        setGuideStep(3);
      } else if (elapsed >= 12000) {
        setGuideStep(2);
      } else if (elapsed >= 6000) {
        setGuideStep(1);
      }

      if (elapsed >= 28000 && !attemptRecordedRef.current) {
        recordAttempt('failure');
        setHints('인식이 지연되어 자동으로 재탐색합니다...');
        void startScan();
      }
    }, 1000);
  };

  const stopTimers = () => {
    if (refocusTimerRef.current) {
      window.clearInterval(refocusTimerRef.current);
      refocusTimerRef.current = null;
    }
    if (guideTimerRef.current) {
      window.clearInterval(guideTimerRef.current);
      guideTimerRef.current = null;
    }
  };

  const stopScan = () => {
    stopTimers();
    void setTorch(false);
    controlsRef.current?.stop();
    controlsRef.current = null;
    trackRef.current = null;
    setIsTorchOn(false);
  };

  const startScan = async () => {
    if (!videoRef.current) return;

    // 이전 스캔 정리
    stopScan();
    setError(null);
    setIsLoading(false);
    setGuideStep(0);
    attemptStartedAtRef.current = Date.now();
    attemptRecordedRef.current = false;
    handledRef.current = false;
    setDebugProfile(tuningRef.current);

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
    hintMap.set(DecodeHintType.TRY_HARDER, true);

    const codeReader = new BrowserMultiFormatReader(hintMap);

    try {
      const constraints = {
        video: {
          facingMode: 'environment' as const,
          // 카메라 화질 개선
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
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
                  recordAttempt('success');
                  onResult(book);
                }
              } catch {
                if (isMountedRef.current) {
                  recordAttempt('failure');
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
      const stream = videoRef.current.srcObject;
      if (stream instanceof MediaStream) {
        const [track] = stream.getVideoTracks();
        if (track) {
          trackRef.current = track;
          await enhanceTrackForScanning(track);
          startAutoRefocus();
          startGuideProgress();
        }
      }

      setHints('바코드를 가까이 맞추고 흔들림 없이 1~2초 유지해 주세요.');
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

  const stageGuideText =
    guideStep === 1
      ? '1단계: 카메라를 바코드에서 12~20cm 거리로 맞춰주세요.'
      : guideStep === 2
        ? '2단계: 책을 살짝 기울여 반사광을 피한 뒤 다시 고정해 주세요.'
        : guideStep === 3
          ? (isTorchSupported && !isTorchOn
              ? '3단계: 주변이 어두우면 손전등을 켜고, 그림자가 없도록 조명을 확보해 주세요.'
              : '3단계: 조명을 밝게 하고 바코드 전체가 프레임 안에 들어오게 맞춰주세요.')
          : '안내: 바코드 선이 또렷하게 보이도록 1~2초 정지해 주세요.';

  const handleClose = () => {
    // 사용자가 스스로 닫는 것은 스캔 실패가 아니므로 튜닝 프로필에 반영하지 않는다
    // (실제 실패/타임아웃은 startGuideProgress의 28초 자동 재탐색, ISBN 조회 실패 분기에서만 기록)
    stopScan();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <h2 className="text-white font-semibold text-base">바코드 스캔</h2>
        <button
          type="button"
          onClick={handleClose}
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
            <p className="mt-2 max-w-xs rounded-md bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-white/90 text-center">
              {stageGuideText}
            </p>
          </div>
        )}

        {/* 개발자 디버그 패널 (DEV 전용) */}
        {showDebugPanel && (
          <div className="absolute left-3 top-3 z-10 w-[220px] rounded-md border border-white/20 bg-black/65 p-2 text-[11px] text-white/90 shadow-lg backdrop-blur">
            <p className="mb-1 font-semibold text-white">Scanner Debug</p>
            <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
              <span className="text-white/70">refocusMs</span>
              <span>{Math.round(debugProfile.refocusMs)}ms</span>
              <span className="text-white/70">baseZoom</span>
              <span>{debugProfile.baseZoom.toFixed(2)}x</span>
              <span className="text-white/70">avgSuccess</span>
              <span>{debugProfile.avgSuccessMs > 0 ? `${debugProfile.avgSuccessMs}ms` : '-'}</span>
              <span className="text-white/70">avgFailure</span>
              <span>{debugProfile.avgFailureMs > 0 ? `${debugProfile.avgFailureMs}ms` : '-'}</span>
              <span className="text-white/70">attempts</span>
              <span>{debugProfile.attempts}</span>
              <span className="text-white/70">success/fail</span>
              <span>{debugProfile.successes}/{debugProfile.failures}</span>
            </div>
          </div>
        )}

        {/* 하단 카메라 컨트롤 */}
        {!isLoading && !error && isTorchSupported && (
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => void setTorch(!isTorchOn)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur"
              aria-label={isTorchOn ? '손전등 끄기' : '손전등 켜기'}
            >
              {isTorchOn ? <ZapOff size={16} /> : <Zap size={16} />}
              {isTorchOn ? '손전등 끄기' : '손전등 켜기'}
            </button>
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
