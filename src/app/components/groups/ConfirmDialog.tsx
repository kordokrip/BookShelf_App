import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';

/** 모임 화면 공용 확인 다이얼로그 (native confirm 대체) */
export function ConfirmDialog({ open, title, description, confirmLabel, destructive = true, onConfirm, onCancel }: {
  open: boolean; title: string; description?: string; confirmLabel: string; destructive?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? '이 작업은 되돌릴 수 없습니다.'}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]' : 'bg-indigo-600 text-white hover:bg-indigo-700'}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
