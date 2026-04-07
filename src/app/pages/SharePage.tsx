import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Send, Mail, Clock, CheckCircle2, User } from 'lucide-react';
import {
  useShareInbox,
  useShareSent,
  useShareUnreadCount,
  useShareReport,
  useMarkReportRead,
} from '../../hooks/useGroups';
import type { SharedReport } from '../../lib/api';

type Tab = 'inbox' | 'sent';

export function SharePage() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [showCompose, setShowCompose] = useState(false);

  const { data: unread } = useShareUnreadCount();
  const unreadCount = (unread as unknown as { data: { count: number } })?.data?.count ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">공유 보고서 📬</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          보고서 보내기
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')} badge={unreadCount}>
          <Inbox size={16} /> 받은 보고서
        </TabButton>
        <TabButton active={tab === 'sent'} onClick={() => setTab('sent')}>
          <Send size={16} /> 보낸 보고서
        </TabButton>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'inbox' ? (
          <motion.div key="inbox" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <InboxTab />
          </motion.div>
        ) : (
          <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <SentTab />
          </motion.div>
        )}
      </AnimatePresence>

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} />}
    </div>
  );
}

/* ─── Tab Button ──────────────────────────────────────── */
function TabButton({ active, onClick, badge, children }: {
  active: boolean; onClick: () => void; badge?: number; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition relative ${
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold">{badge}</span>
      )}
    </button>
  );
}

/* ─── Inbox Tab ───────────────────────────────────────── */
function InboxTab() {
  const { data, isLoading } = useShareInbox();
  const markRead = useMarkReportRead();
  const reports = (data as unknown as { data: SharedReport[] })?.data ?? [];

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">로딩 중...</div>;
  if (!reports.length) return <EmptyState icon={<Inbox size={32} />} text="받은 보고서가 없습니다" />;

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          label={`${r.sender_name ?? '알 수 없음'}님이 보냄`}
          isRead={!!r.is_read}
          onMarkRead={() => markRead.mutate(r.id)}
        />
      ))}
    </div>
  );
}

/* ─── Sent Tab ────────────────────────────────────────── */
function SentTab() {
  const { data, isLoading } = useShareSent();
  const reports = (data as unknown as { data: SharedReport[] })?.data ?? [];

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">로딩 중...</div>;
  if (!reports.length) return <EmptyState icon={<Send size={32} />} text="보낸 보고서가 없습니다" />;

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          label={`→ ${r.recipient_name ?? r.recipient_email ?? '알 수 없음'}`}
          isRead
        />
      ))}
    </div>
  );
}

/* ─── Report Card ─────────────────────────────────────── */
function ReportCard({ report, label, isRead, onMarkRead }: {
  report: SharedReport; label: string; isRead: boolean; onMarkRead?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data as Record<string, unknown>;
  } catch { /* ignore */ }

  const statusCounts = parsed?.statusCounts as { done?: number; reading?: number; wish?: number } | undefined;
  const totals = parsed?.totals as { totalPages?: number; totalMinutes?: number; sessionCount?: number } | undefined;

  return (
    <div
      className={`p-4 rounded-xl border transition cursor-pointer ${
        isRead ? 'bg-background border-border' : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
      }`}
      onClick={() => {
        setExpanded(!expanded);
        if (!isRead && onMarkRead) onMarkRead();
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {report.sender_emoji ? (
            <span className="text-lg">{report.sender_emoji}</span>
          ) : (
            <User size={18} className="text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{label}</span>
          {!isRead && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={12} />
          {new Date(report.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>

      {report.message && (
        <p className="mt-2 text-sm text-muted-foreground">&ldquo;{report.message}&rdquo;</p>
      )}

      <AnimatePresence>
        {expanded && parsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
              {statusCounts && (
                <div className="flex gap-4">
                  <span>📚 완독 {statusCounts.done ?? 0}</span>
                  <span>📖 읽는 중 {statusCounts.reading ?? 0}</span>
                  <span>💫 위시 {statusCounts.wish ?? 0}</span>
                </div>
              )}
              {totals && (
                <div className="flex gap-4 text-muted-foreground">
                  <span>{totals.totalPages ?? 0}페이지</span>
                  <span>{totals.totalMinutes ?? 0}분</span>
                  <span>{totals.sessionCount ?? 0}세션</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Compose Modal ───────────────────────────────────── */
function ComposeModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const shareReport = useShareReport();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await shareReport.mutateAsync({ recipient_email: email.trim(), message: message.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.form
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Mail size={20} className="text-indigo-500" /> 독서 보고서 보내기
        </h2>
        <div>
          <label className="text-sm font-medium text-muted-foreground">받는 사람 이메일</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">메시지 (선택)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="같이 독서해요! 📖"
            className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition">
            취소
          </button>
          <button
            type="submit"
            disabled={shareReport.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            {shareReport.isPending ? '보내는 중...' : '보내기'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

/* ─── Empty State ─────────────────────────────────────── */
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}
