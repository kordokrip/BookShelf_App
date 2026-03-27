import { useState, useRef, useEffect, useCallback } from 'react';
import { X, RotateCcw, Loader2, CheckCircle, Camera } from 'lucide-react';
import { cn } from '../ui/utils';
import { ocrApi } from '../../../lib/api';
import { useAddNote } from '../../../hooks/useNotes';
import { Textarea } from '../ui/textarea';

type NoteType = 'memo' | 'quote' | 'review';

interface Props {
  bookId: string;
  onClose: () => void;
}

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'memo', label: '📝 메모' },
  { value: 'quote', label: '💬 문구' },
  { value: 'review', label: '✍️ 독후감' },
];

/**
 * OCR 전처리 파이프라인:
 * 1. 그레이스케일 변환 (BT.601 가중치)
 * 2. 대비 향상 (히스토그램 스트레칭)
 * 3. 샤프닝 (라플라시안 커널)
 */
function preprocessForOCR(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Step 1: 그레이스케일 + 대비 향상
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    // 대비 스트레칭: [30..225] → [0..255] 범위로 선형 확장
    const contrasted = Math.min(255, Math.max(0, ((gray - 30) / 195) * 255));
    data[i] = data[i + 1] = data[i + 2] = contrasted;
    // data[i + 3] (alpha) is unchanged
  }
  ctx.putImageData(imageData, 0, 0);

  // Step 2: 샤프닝 (Laplacian 기반 unsharp mask)
  const sharpData = ctx.getImageData(0, 0, width, height);
  const src = new Uint8ClampedArray(sharpData.data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ni = ((y + ky) * width + (x + kx)) * 4;
          sum += (src[ni] ?? 0) * (kernel[(ky + 1) * 3 + (kx + 1)] ?? 0);
        }
      }
      const val = Math.min(255, Math.max(0, sum));
      sharpData.data[idx] = sharpData.data[idx + 1] = sharpData.data[idx + 2] = val;
    }
  }
  ctx.putImageData(sharpData, 0, 0);
}

export function CameraOCRSheet({ bookId, onClose }: Props) {
  const [step, setStep] = useState<'camera' | 'review'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('memo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addMutation = useAddNote();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setCameraError('카메라 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.');
      } else {
        setCameraError('카메라를 시작할 수 없습니다.');
      }
    }
  }, []);

  /**
   * step === 'camera' 일 때 카메라를 시작한다.
   * setStep('camera') → React 리렌더 → video DOM 마운트 → 이 effect 실행
   * 순서가 보장되므로 재촬영 시 videoRef.current null 레이스 컨디션 없음.
   */
  useEffect(() => {
    if (step !== 'camera') return;
    void startCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  // previewUrl ObjectURL 메모리 정리
  useEffect(() => {
    const url = previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewUrl]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    if (!videoW || !videoH || !displayW || !displayH) return;

    // 가이드박스 CSS 크기 (w-72 h-52 = 288×208px)
    const GUIDE_CSS_W = 288;
    const GUIDE_CSS_H = 208;

    // object-cover 스케일: 컨테이너를 채우는 비율 (= max of x/y scale)
    const scale = Math.max(displayW / videoW, displayH / videoH);

    // 가이드박스를 비디오 픽셀 좌표로 변환 (중앙 기준)
    const srcX = Math.round(videoW / 2 - GUIDE_CSS_W / 2 / scale);
    const srcY = Math.round(videoH / 2 - GUIDE_CSS_H / 2 / scale);
    const srcW = Math.round(GUIDE_CSS_W / scale);
    const srcH = Math.round(GUIDE_CSS_H / scale);

    // 비디오 프레임 범위로 클램핑
    const clampedX = Math.max(0, srcX);
    const clampedY = Math.max(0, srcY);
    const clampedW = Math.min(srcW, videoW - clampedX);
    const clampedH = Math.min(srcH, videoH - clampedY);
    if (!clampedW || !clampedH) return;

    // 최소 640px 너비로 업스케일 (OCR 정확도 향상)
    const targetW = Math.max(clampedW, 640);
    const targetH = Math.round(targetW * (clampedH / clampedW));

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 가이드박스 영역만 크롭 후 리사이즈
    ctx.drawImage(video, clampedX, clampedY, clampedW, clampedH, 0, 0, targetW, targetH);

    // OCR 전처리: 그레이스케일 + 대비 향상 + 샤프닝
    preprocessForOCR(ctx, targetW, targetH);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      // PNG: 손실 없는 포맷 → 텍스트 엣지 보존
      const file = new File([blob], 'capture.png', { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      setPreviewUrl(url);
      setStep('review'); // useEffect cleanup에서 stopCamera() 자동 호출

      // OCR 처리
      setIsProcessing(true);
      setOcrError(null);
      try {
        const result = await ocrApi.extractText(file);
        setExtractedText(result.text);
      } catch (err) {
        setOcrError(err instanceof Error ? err.message : '텍스트 인식에 실패했습니다.');
        setExtractedText('');
      } finally {
        setIsProcessing(false);
      }
    }, 'image/png');
  };

  const handleRetake = () => {
    // previewUrl revoke는 useEffect에서 처리 (state updater 내 side-effect 방지)
    setPreviewUrl(null);
    setExtractedText('');
    setOcrError(null);
    // setStep('camera') → useEffect가 startCamera() 재호출 (DOM 마운트 후 실행 보장)
    setStep('camera');
  };

  const handleSave = async () => {
    if (!extractedText.trim() || addMutation.isPending) return;
    await addMutation.mutateAsync({
      book_id: bookId,
      type: noteType,
      content: extractedText.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button onClick={onClose} className="p-2 text-white" aria-label="닫기">
          <X size={22} />
        </button>
        <span className="text-white font-semibold text-sm">
          {step === 'camera' ? '사진 촬영' : 'OCR 노트 저장'}
        </span>
        {step === 'review' ? (
          <button onClick={handleRetake} className="p-2 text-white" aria-label="재촬영">
            <RotateCcw size={20} />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* 카메라 단계 */}
      {step === 'camera' && (
        <>
          {cameraError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <Camera size={48} className="text-gray-500" />
              <p className="text-white/70 text-center text-sm">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-semibold"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* 가이드 오버레이 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-52 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/80 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/80 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/80 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/80 rounded-br-lg" />
                </div>
              </div>
              <p className="absolute bottom-24 left-0 right-0 text-center text-white/60 text-xs px-4">
                책의 텍스트가 가이드 안에 들어오도록 맞춰주세요
              </p>
            </div>
          )}
          {/* 셔터 버튼 */}
          <div className="h-28 bg-black flex items-center justify-center shrink-0">
            <button
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/30 disabled:opacity-40 transition-transform active:scale-95"
              aria-label="촬영"
            />
          </div>
        </>
      )}

      {/* 리뷰 단계 */}
      {step === 'review' && (
        <div className="flex-1 bg-[#F8FAFC] flex flex-col overflow-y-auto">
          {/* 촬영 이미지 미리보기 */}
          {previewUrl && (
            <img
              src={previewUrl}
              alt="촬영 이미지"
              className="w-full max-h-44 object-contain bg-black shrink-0"
            />
          )}

          <div className="flex-1 px-4 py-4 flex flex-col gap-3">
            {/* OCR 처리 중 */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-[#4F46E5] py-1">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">텍스트 인식 중...</span>
              </div>
            )}

            {/* OCR 오류 */}
            {ocrError && !isProcessing && (
              <p className="text-red-500 text-xs leading-relaxed">{ocrError}</p>
            )}

            {/* 노트 타입 선택 */}
            <div className="flex gap-2">
              {NOTE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNoteType(t.value)}
                  className={cn(
                    'flex-1 py-2 text-xs rounded-xl border transition-colors font-semibold',
                    noteType === t.value
                      ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                      : 'border-[#E2E8F0] text-[#64748B]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 인식된 텍스트 (편집 가능) */}
            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder={
                isProcessing
                  ? '텍스트 인식 중...'
                  : ocrError
                    ? '텍스트를 직접 입력하세요'
                    : '인식된 텍스트 (직접 수정 가능)'
              }
              rows={6}
              className="resize-none"
              disabled={isProcessing}
            />

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={!extractedText.trim() || addMutation.isPending || isProcessing}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {addMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {addMutation.isPending ? '저장 중...' : '노트 저장'}
            </button>
          </div>
        </div>
      )}

      {/* 캡처용 숨김 캔버스 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
