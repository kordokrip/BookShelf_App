import { useState, useRef, useEffect, useCallback } from 'react';
import { X, RotateCcw, Loader2, CheckCircle, Camera, ImagePlus, RefreshCw } from 'lucide-react';
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

/** 최대/최소 해상도 (OCR 성능과 파일 크기의 균형) */
const MAX_DIMENSION = 1024;
const MIN_DIMENSION = 768;

/**
 * 이미지 리사이즈 + JPEG 변환
 * ⚠️ 그레이스케일/대비 전처리 없음 — 비전 LLM은 자연 컬러 이미지에 최적화됨.
 *    전통적 OCR 엔진용 전처리(그레이스케일·샤프닝)는 신경망 모델의 인식률을 오히려 낮춤.
 */
function resizeAndConvertToJpeg(blob: Blob): Promise<{ file: File; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { naturalWidth: w, naturalHeight: h } = img;

      // 최대 크기 제한
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      // 최소 크기 보장 (OCR 정확도)
      if (w < MIN_DIMENSION && h < MIN_DIMENSION) {
        const ratio = MIN_DIMENSION / Math.min(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas context 생성 실패'));

      // 컬러 이미지 그대로 유지 (전처리 없음)
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (jpegBlob) => {
          if (!jpegBlob) return reject(new Error('JPEG 변환 실패'));
          const file = new File([jpegBlob], 'capture.jpg', { type: 'image/jpeg' });
          const url = URL.createObjectURL(jpegBlob);
          resolve({ file, url });
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('이미지 로드 실패'));
    };
    img.src = objUrl;
  });
}

export function CameraOCRSheet({ bookId, onClose }: Props) {
  const [step, setStep] = useState<'camera' | 'review'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [noteType, setNoteType] = useState<NoteType>('memo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // 마지막으로 캡처한 원본 파일 (OCR 재시도 시 재사용)
  const capturedFileRef = useRef<File | null>(null);

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

  /** 공통 OCR 실행 함수 */
  const runOCR = useCallback(async (file: File) => {
    capturedFileRef.current = file;
    setIsProcessing(true);
    setOcrError(null);
    setExtractedText('');
    setConfidence(null);
    try {
      const result = await ocrApi.extractText(file);
      setExtractedText(result.text);
      setConfidence(result.confidence ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '텍스트 인식에 실패했습니다.';
      setOcrError(msg);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /** OCR 재시도 */
  const handleRetryOCR = useCallback(() => {
    if (!capturedFileRef.current) return;
    setRetryCount((n) => n + 1);
    void runOCR(capturedFileRef.current);
  }, [runOCR]);

  /** 카메라 촬영: 전체 화면 캡처 */
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const { file, url } = await resizeAndConvertToJpeg(blob);
        setPreviewUrl(url);
        setStep('review');
        void runOCR(file);
      } catch {
        setOcrError('이미지 처리 중 오류가 발생했습니다.');
        setStep('review');
      }
    }, 'image/jpeg', 1.0);
  };

  /** 갤러리에서 이미지 선택 */
  const handleGalleryPick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = '';

    try {
      const { file: processedFile, url } = await resizeAndConvertToJpeg(file);
      stopCamera();
      setPreviewUrl(url);
      setStep('review');
      void runOCR(processedFile);
    } catch {
      setOcrError('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    setExtractedText('');
    setConfidence(null);
    setOcrError(null);
    setRetryCount(0);
    capturedFileRef.current = null;
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
      {/* 숨김 파일 입력 (갤러리 선택용) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

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
              <button
                onClick={handleGalleryPick}
                className="px-4 py-2 rounded-xl bg-indigo-600/80 text-white text-sm font-semibold flex items-center gap-2"
              >
                <ImagePlus size={16} />
                갤러리에서 선택
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
              {/* 안내 텍스트 */}
              <p className="absolute bottom-24 left-0 right-0 text-center text-white/70 text-xs px-4 drop-shadow">
                책 페이지 전체가 화면에 들어오도록 맞춰주세요
              </p>
            </div>
          )}

          {/* 하단 버튼 영역 */}
          <div className="h-28 bg-black flex items-center justify-center gap-8 shrink-0">
            {/* 갤러리 선택 버튼 */}
            <button
              onClick={handleGalleryPick}
              className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
              aria-label="갤러리에서 선택"
            >
              <div className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center">
                <ImagePlus size={20} />
              </div>
              <span className="text-[10px]">갤러리</span>
            </button>

            {/* 셔터 버튼 */}
            <button
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/30 disabled:opacity-40 transition-transform active:scale-95"
              aria-label="촬영"
            />

            {/* 빈 공간 (정렬 균형) */}
            <div className="w-11 h-11" />
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
              loading="lazy"
              className="w-full max-h-44 object-contain bg-black shrink-0"
            />
          )}

          <div className="flex-1 px-4 py-4 flex flex-col gap-3">
            {/* OCR 처리 중 */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-[#4F46E5] py-1">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">
                  {retryCount > 0 ? `텍스트 재인식 중... (${retryCount}회)` : '텍스트 인식 중...'}
                </span>
              </div>
            )}

            {/* 신뢰도 표시 */}
            {!isProcessing && confidence !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B]">인식 신뢰도</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${confidence}%`,
                      backgroundColor: confidence >= 70 ? '#10B981' : confidence >= 40 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                <span
                  className="text-xs font-semibold w-9 text-right"
                  style={{ color: confidence >= 70 ? '#10B981' : confidence >= 40 ? '#F59E0B' : '#EF4444' }}
                >
                  {confidence}%
                </span>
              </div>
            )}

            {/* OCR 오류 + 재시도 버튼 */}
            {ocrError && !isProcessing && (
              <div className="flex flex-col gap-2">
                <p className="text-red-500 text-xs leading-relaxed">{ocrError}</p>
                <button
                  onClick={handleRetryOCR}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold border border-red-200 active:scale-95 transition-transform"
                >
                  <RefreshCw size={12} />
                  다시 인식하기
                </button>
              </div>
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
                    ? '텍스트를 직접 입력하거나 위 버튼으로 재시도하세요'
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
    </div>
  );
}

