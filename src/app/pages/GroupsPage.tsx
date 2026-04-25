/**
 * 독서 모임 목록 / 상세 페이지
 * - 공개 그룹 탐색 및 참여 요청
 * - 내 모임 목록 (코럨 생성, lazy 구로 분할)
 * - 그룹 상세(채팅·멤버·일정) 내지 탭
 */
import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, LogIn, Crown, ChevronRight, Search, Clock } from 'lucide-react';
import { useGroups, useCreateGroup, useJoinGroup } from '../../hooks/useGroups';
import { useAuthStore } from '../../stores/authStore';
import type { Group } from '../../lib/api';

const GroupDetailView = lazy(() => import('../components/groups/GroupDetailView').then(m => ({ default: m.GroupDetailView })));

export function GroupsPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ name: '', description: '', cover_emoji: '📖' });

  if (selectedGroupId) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground text-sm">모임 로딩 중...</div>}>
        <GroupDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
      </Suspense>
    );
  }

  const myGroups = data?.myGroups ?? [];
  const approvedGroups = myGroups.filter((g) => g.my_status === 'approved');
  const pendingGroups = myGroups.filter((g) => g.my_status === 'pending');
  const ownsGroup = myGroups.some((g) => g.owner_id === user?.id);
  const publicGroups = (data?.publicGroups ?? []).filter(
    (g) => !myGroups.some((mg) => mg.id === g.id),
  );
  const filteredPublic = publicGroups.filter(
    (g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createGroup.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      cover_emoji: form.cover_emoji || '📖',
    });
    setForm({ name: '', description: '', cover_emoji: '📖' });
    setShowCreate(false);
  };

  const emojiOptions = ['📖', '📚', '🎯', '💡', '🌟', '🔥', '🎨', '🌈', '☕', '🏆', '💬', '🧠'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] dark:text-[#F8FAFC]">독서 모임 📚</h1>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
            독서 모임을 만들고, 함께 읽고, 이야기를 나눠보세요
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={ownsGroup}
          title={ownsGroup ? '유저당 1개의 모임만 만들 수 있습니다' : undefined}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#4F46E5] text-white rounded-xl text-sm font-medium hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Plus size={16} />
          모임 만들기
        </button>
      </div>

      {/* 내 모임 */}
      {(approvedGroups.length > 0 || pendingGroups.length > 0) ? (
        <section>
          <h2 className="text-lg font-semibold text-[#1E293B] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Users size={18} className="text-[#4F46E5]" />
            내 모임
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {approvedGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                userId={user?.id}
                onClick={() => setSelectedGroupId(group.id)}
              />
            ))}
          </div>
          {pendingGroups.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-[#94A3B8] mt-4 mb-2 flex items-center gap-1.5">
                <Clock size={14} /> 승인 대기 중
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {pendingGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    userId={user?.id}
                    onClick={() => {}}
                    isPending
                  />
                ))}
              </div>
            </>
          )}
        </section>
      ) : !isLoading && (
        <section className="text-center py-10 px-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
          <div className="text-4xl mb-3">📚</div>
          <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC]">독서 모임을 시작해보세요!</h3>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-2 max-w-md mx-auto">
            모임을 만들어 친구들과 함께 책을 읽고, 일정을 잡고, 후기를 공유하세요.
            아래 공개 모임에 참여하거나 직접 만들 수 있습니다.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-5 py-2.5 bg-[#4F46E5] text-white rounded-xl text-sm font-medium hover:bg-[#4338CA] transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <Plus size={16} />
            첫 모임 만들기
          </button>
        </section>
      )}

      {/* 공개 모임 탐색 */}
      <section>
        <h2 className="text-lg font-semibold text-[#1E293B] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Search size={18} className="text-[#64748B]" />
          공개 모임 탐색
        </h2>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="모임 이름으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm text-[#1E293B] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
          />
        </div>
        {isLoading ? (
          <div className="text-center py-12 text-[#94A3B8]">로딩 중...</div>
        ) : filteredPublic.length === 0 ? (
          <div className="text-center py-12 text-[#94A3B8]">
            {searchQuery ? '검색 결과가 없습니다.' : '참여 가능한 공개 모임이 없습니다.'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredPublic.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                userId={user?.id}
                onClick={() => setSelectedGroupId(group.id)}
                onJoin={() => joinGroup.mutate(group.id)}
                showJoin
              />
            ))}
          </div>
        )}
      </section>

      {/* 모임 생성 모달 */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1E293B] rounded-2xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-4">새 독서 모임 만들기</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 block">모임 이름 *</label>
                  <input
                    type="text" maxLength={50}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="예: 월요일 독서 클럽"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 block">설명</label>
                  <textarea
                    maxLength={500} rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="모임에 대한 간략한 설명"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 block">모임 아이콘</label>
                  <div className="flex flex-wrap gap-2">
                    {emojiOptions.map((e) => (
                      <button
                        key={e}
                        onClick={() => setForm({ ...form, cover_emoji: e })}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 transition-all ${
                          form.cover_emoji === e
                            ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#312E81]'
                            : 'border-transparent hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A]'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[#64748B] bg-[#F1F5F9] dark:bg-[#0F172A] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim() || createGroup.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 transition-colors"
                >
                  {createGroup.isPending ? '생성 중...' : '모임 만들기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GroupCard ─────────────────────────────────────────────────
function GroupCard({ group, userId, onClick, onJoin, showJoin, isPending }: {
  group: Group;
  userId?: string;
  onClick: () => void;
  onJoin?: () => void;
  showJoin?: boolean;
  isPending?: boolean;
}) {
  const isOwner = group.owner_id === userId;
  const isMyGroup = group.my_role != null;

  return (
    <motion.div
      whileHover={{ y: isPending ? 0 : -2 }}
      className={`bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-4 transition-shadow ${isPending ? 'opacity-70' : 'cursor-pointer hover:shadow-md'}`}
      onClick={isPending ? undefined : onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] dark:bg-[#312E81] flex items-center justify-center text-2xl flex-shrink-0">
          {group.cover_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#1E293B] dark:text-[#F8FAFC] truncate">
              {group.name}
            </h3>
            {isOwner && <Crown size={14} className="text-amber-500 flex-shrink-0" />}
            {isPending && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">
                대기중
              </span>
            )}
          </div>
          {group.description && (
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2 mt-0.5">
              {group.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {group.member_count ?? 0}/{group.max_members}
            </span>
            {group.owner_name && <span>by {group.owner_name}</span>}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          {showJoin && !isMyGroup ? (
            <button
              onClick={(e) => { e.stopPropagation(); onJoin?.(); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#4F46E5] text-white rounded-lg text-xs font-medium hover:bg-[#4338CA] transition-colors"
            >
              <LogIn size={12} />
              가입
            </button>
          ) : (
            <ChevronRight size={16} className="text-[#94A3B8]" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
