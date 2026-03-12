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
        video: { facingMode: 'environment' },
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

  // 컴포넌트 마운트 시 카메라 시작
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // previewUrl 정리
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      setPreviewUrl(url);
      stopCamera();
      setStep('review');

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
    }, 'image/jpeg', 0.9);
  };

  const handleRetake = () => {
    setStep('camera');
    setExtractedText('');
    setOcrError(null);
    // previewUrl은 useEffect 정리에서 처리되므로 상태만 null로 변경
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    startCamera();
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
