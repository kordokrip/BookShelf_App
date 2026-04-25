/**
 * 디자인 시스템 패이지 (개발/스키징 전용)
 * - 작동하는 UI 컴포넌트(Badge, StarRating, Toast 등) 시각적 확인
 */
import { useState } from "react";
import { GenreBadge } from "../components/ui/GenreBadge";
import { StarRating } from "../components/ui/StarRating";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Button, IconButton } from "../components/ui/Buttons";
import { TextInput, GenreSelect, NumberStepper, SearchBar, DatePicker } from "../components/ui/Inputs";
import { BookCardSkeleton, StatCardSkeleton } from "../components/ui/skeleton";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { DoneBookCard, ReadingBookCard, WishBookCard } from "../components/books/BookCard";
import { SummaryCard } from "../components/stats/StatsComponents";
import { BookMarked, Star, Flame, BookOpen, ShieldAlert, Heart, Edit, Share2, Trash2 } from "lucide-react";
import { GENRE_CONFIG, type GenreKey, type UIBook } from "../../types/book";
import { useAuthStore } from "../../stores/authStore";

const GENRES = Object.keys(GENRE_CONFIG) as GenreKey[];

const mockDoneBooks: UIBook[] = [
  {
    id: "d1",
    title: "클린 아키텍처",
    author: "로버트 C. 마틴",
    publisher: "인사이트",
    genre: "AI/데이터",
    coverEmoji: "🤖",
    coverColor: "from-indigo-500 to-violet-600",
    status: "done",
    rating: 5,
    finishedDate: "2025-03-15",
    addedDate: "2025-02-01",
    totalPages: 360,
  },
  {
    id: "d2",
    title: "아몬드",
    author: "손원평",
    publisher: "창비",
    genre: "현대문학",
    coverEmoji: "✍️",
    coverColor: "from-amber-500 to-orange-600",
    status: "done",
    rating: 4.5,
    finishedDate: "2025-03-10",
    addedDate: "2025-02-15",
    totalPages: 264,
  },
];

const mockReadingBooks: UIBook[] = [
  {
    id: "r1",
    title: "클린 아키텍처",
    author: "로버트 C. 마틴",
    publisher: "인사이트",
    genre: "AI/데이터",
    coverEmoji: "🤖",
    coverColor: "from-indigo-500 to-violet-600",
    status: "reading",
    totalPages: 300,
    currentPage: 195,
    addedDate: "2025-01-15",
    goalDate: "2025-03-16",
    dailyGoal: 15,
    isOverdue: false,
  },
  {
    id: "r2",
    title: "사피엔스",
    author: "유발 하라리",
    publisher: "김영사",
    genre: "인문학",
    coverEmoji: "🏛️",
    coverColor: "from-violet-500 to-purple-700",
    status: "reading",
    totalPages: 300,
    currentPage: 96,
    addedDate: "2025-01-20",
    goalDate: "2025-02-28",
    dailyGoal: 28,
    isOverdue: true,
  },
];

const mockWishBooks: UIBook[] = [
  {
    id: "w1",
    title: "도둑맞은 집중력",
    author: "요한 하리",
    publisher: "어크로스",
    genre: "자기계발",
    coverEmoji: "🚀",
    coverColor: "from-sky-500 to-blue-600",
    status: "wish",
    addedDate: "2025-01-20",
    priority: 5,
  },
  {
    id: "w2",
    title: "넛지",
    author: "리처드 탈러",
    publisher: "리더스북",
    genre: "경제/경영",
    coverEmoji: "💼",
    coverColor: "from-emerald-500 to-teal-600",
    status: "wish",
    addedDate: "2024-12-05",
    priority: 4,
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[#1E293B]" style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>
      {children}
    </section>
  );
}

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[#64748B] mb-2.5" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export function DesignSystemPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [rating, setRating] = useState(3);
  const [inputVal, setInputVal] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [genre, setGenre] = useState<GenreKey | "">("");
  const [stepperVal, setStepperVal] = useState(142);
  const [dateVal, setDateVal] = useState("2024-05-01");
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 flex items-center justify-center">
          <ShieldAlert className="text-[#EF4444]" size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#1E293B] dark:text-[#F8FAFC]">접근 권한 없음</h2>
        <p className="text-[#64748B] dark:text-[#94A3B8] text-sm max-w-xs">
          디자인 시스템 페이지는 Admin 계정만 접근할 수 있습니다.
          관리자에게 문의해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#4F46E5] via-[#7C3AED] to-[#6D28D9] px-6 py-8 text-white mb-6">
        <p className="opacity-75 mb-1" style={{ fontSize: 13 }}>BookShelf Design System</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>컴포넌트 라이브러리</h1>
        <p className="opacity-80 mt-2" style={{ fontSize: 14, lineHeight: 1.6 }}>
          모바일 우선 한국어 독서 관리 앱을 위한 디자인 시스템
        </p>
        <div className="flex gap-3 mt-4">
          {[
            { label: "컬러", value: "12+" },
            { label: "컴포넌트", value: "30+" },
            { label: "장르", value: "19" },
          ].map((s) => (
            <div key={s.label} className="px-3 py-2 rounded-xl bg-white/15 text-center">
              <p style={{ fontSize: 18, fontWeight: 800 }}>{s.value}</p>
              <p style={{ fontSize: 11, opacity: 0.8 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4">
        {/* ─── Color Palette ──────────────────────────────────────── */}
        <Section title="🎨 색상 팔레트">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Primary", hex: "#4F46E5", textColor: "white" },
              { name: "Secondary", hex: "#7C3AED", textColor: "white" },
              { name: "Accent", hex: "#F59E0B", textColor: "white" },
              { name: "Background", hex: "#F8FAFC", textColor: "#1E293B", border: true },
              { name: "Surface", hex: "#FFFFFF", textColor: "#1E293B", border: true },
              { name: "Text Primary", hex: "#1E293B", textColor: "white" },
              { name: "Text Secondary", hex: "#64748B", textColor: "white" },
              { name: "Success", hex: "#10B981", textColor: "white" },
              { name: "Warning", hex: "#F59E0B", textColor: "white" },
              { name: "Error", hex: "#EF4444", textColor: "white" },
              { name: "Border", hex: "#E2E8F0", textColor: "#1E293B", border: true },
              { name: "Muted", hex: "#94A3B8", textColor: "white" },
            ].map((c) => (
              <div
                key={c.name}
                className="rounded-xl overflow-hidden shadow-sm"
                style={{ border: c.border ? "1px solid #E2E8F0" : undefined }}
              >
                <div
                  className="h-16"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="p-2 bg-white">
                  <p className="text-[#1E293B]" style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</p>
                  <p className="text-[#94A3B8]" style={{ fontSize: 11 }}>{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Typography ────────────────────────────────────────── */}
        <Section title="✍️ 타이포그래피">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col gap-4">
            {[
              { name: "Heading 1", size: 24, weight: 700, label: "독서는 마음의 양식이다" },
              { name: "Heading 2", size: 20, weight: 600, label: "오늘 읽은 책을 기록하세요" },
              { name: "Heading 3", size: 16, weight: 600, label: "장르별 완독 현황" },
              { name: "Body",      size: 14, weight: 400, label: "좋은 책 한 권은 우리에게 새로운 세계를 열어줍니다." },
              { name: "Caption",   size: 12, weight: 400, label: "2024년 5월 15일 완독", color: "#64748B" },
            ].map((t) => (
              <div key={t.name} className="flex items-baseline gap-4">
                <span className="text-[#94A3B8] w-24 flex-shrink-0" style={{ fontSize: 11, fontWeight: 500 }}>
                  {t.name}
                </span>
                <span
                  style={{ fontSize: t.size, fontWeight: t.weight, color: t.color ?? "#1E293B", lineHeight: 1.6 }}
                >
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Genre Badges ──────────────────────────────────────── */}
        <Section title="🏷️ 장르 배지">
          <SubSection label="전체 장르 (19개)">
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <GenreBadge key={g} genre={g} size="md" />
              ))}
            </div>
          </SubSection>
          <SubSection label="사이즈 비교">
            <div className="flex items-center gap-2 flex-wrap">
              <GenreBadge genre="인문학" size="sm" />
              <GenreBadge genre="인문학" size="md" />
              <GenreBadge genre="인문학" size="lg" />
            </div>
          </SubSection>
        </Section>

        {/* ─── Buttons ───────────────────────────────────────────── */}
        <Section title="🔘 버튼">
          <SubSection label="버튼 종류">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </SubSection>
          <SubSection label="버튼 사이즈">
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="primary" size="sm">Small 버튼</Button>
              <Button variant="primary" size="md">Medium 버튼</Button>
              <Button variant="primary" size="lg">Large 버튼</Button>
            </div>
          </SubSection>
          <SubSection label="전체 너비 + 로딩">
            <div className="flex flex-col gap-2">
              <Button variant="primary" fullWidth>전체 너비 버튼</Button>
              <Button variant="primary" fullWidth loading>로딩 중...</Button>
            </div>
          </SubSection>
          <SubSection label="아이콘 버튼">
            <div className="flex gap-2">
              <IconButton icon={<Heart size={18} />} label="좋아요" variant="default" />
              <IconButton icon={<Edit size={18} />} label="편집" variant="primary" />
              <IconButton icon={<Share2 size={18} />} label="공유" variant="ghost" />
              <IconButton icon={<Trash2 size={18} />} label="삭제" className="!bg-[#FEE2E2] !text-[#EF4444] hover:!bg-[#FECACA]" />
            </div>
          </SubSection>
        </Section>

        {/* ─── Input Components ──────────────────────────────────── */}
        <Section title="📝 입력 컴포넌트">
          <div className="flex flex-col gap-4">
            <SubSection label="텍스트 입력 (상태별)">
              <div className="flex flex-col gap-3">
                <TextInput label="책 제목" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder=" " />
                <TextInput label="저자명" value="한강" onChange={() => {}} placeholder=" " />
                <TextInput label="이메일" value="invalid@" onChange={() => {}} error="올바른 이메일 형식을 입력해주세요" placeholder=" " />
                <TextInput label="비활성화" value="disabled value" disabled onChange={() => {}} placeholder=" " />
              </div>
            </SubSection>

            <SubSection label="장르 선택 드롭다운">
              <GenreSelect value={genre} onChange={setGenre} />
            </SubSection>

            <SubSection label="페이지 수 스텝퍼">
              <NumberStepper
                value={stepperVal}
                onChange={setStepperVal}
                min={0}
                max={636}
                step={10}
                label="현재 페이지"
              />
            </SubSection>

            <SubSection label="날짜 선택">
              <DatePicker value={dateVal} onChange={setDateVal} label="목표 완독일" />
            </SubSection>

            <SubSection label="별점 (인터랙티브)">
              <div className="flex flex-col gap-2">
                <StarRating value={rating} onChange={setRating} size={28} />
                <p className="text-[#94A3B8]" style={{ fontSize: 12 }}>현재 평점: {rating}점</p>
              </div>
            </SubSection>

            <SubSection label="검색 바">
              <SearchBar value={searchVal} onChange={setSearchVal} />
            </SubSection>
          </div>
        </Section>

        {/* ─── Progress Bar ──────────────────────────────────────── */}
        <Section title="📊 진행 바">
          <div className="flex flex-col gap-4 bg-white rounded-2xl border border-[#E2E8F0] p-4">
            <div className="flex flex-col gap-2">
              <p className="text-[#64748B]" style={{ fontSize: 12, fontWeight: 500 }}>Thin (4px) — 72%</p>
              <ProgressBar value={72} variant="thin" showLabel />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[#64748B]" style={{ fontSize: 12, fontWeight: 500 }}>Thick (8px) — 45%</p>
              <ProgressBar value={45} variant="thick" showLabel />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[#64748B]" style={{ fontSize: 12, fontWeight: 500 }}>Custom Color (Amber) — 90%</p>
              <ProgressBar value={90} variant="thick" showLabel color="#F59E0B" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[#64748B]" style={{ fontSize: 12, fontWeight: 500 }}>Success Color — 100%</p>
              <ProgressBar value={100} variant="thick" showLabel color="#10B981" />
            </div>
          </div>
        </Section>

        {/* ─── Book Cards ────────────────────────────────────────── */}
        <Section title="📚 책 카드 컴포넌트">
          <SubSection label="Variant A — 완독 카드">
            <div className="flex flex-col gap-3">
              {mockDoneBooks.slice(0, 2).map((b) => (
                <DoneBookCard key={b.id} book={b} onClick={() => showToast(`"${b.title}" 클릭`, "info")} />
              ))}
            </div>
          </SubSection>
          <SubSection label="Variant B — 읽는 중 카드">
            <div className="flex flex-col gap-3">
              {mockReadingBooks.map((b) => (
                <ReadingBookCard key={b.id} book={b} onClick={() => showToast(`"${b.title}" 클릭`, "info")} />
              ))}
            </div>
          </SubSection>
          <SubSection label="Variant C — 위시리스트 카드">
            <div className="flex flex-col gap-3">
              {mockWishBooks.slice(0, 2).map((b) => (
                <WishBookCard
                  key={b.id}
                  book={b}
                  onStart={() => showToast(`"${b.title}" 읽기 시작!`, "success")}
                  onDelete={() => showToast(`"${b.title}" 삭제됨`, "error")}
                />
              ))}
            </div>
          </SubSection>
        </Section>

        {/* ─── Status & Feedback ─────────────────────────────────── */}
        <Section title="💬 상태 & 피드백">
          <SubSection label="토스트 알림">
            <div className="flex gap-2 flex-wrap">
              <Button variant="primary" size="sm" onClick={() => showToast("책이 성공적으로 추가되었어요 📚", "success")}>
                ✅ 성공
              </Button>
              <Button variant="danger" size="sm" onClick={() => showToast("오류가 발생했어요. 다시 시도해주세요", "error")}>
                ❌ 오류
              </Button>
              <Button variant="secondary" size="sm" onClick={() => showToast("오늘 목표 15페이지를 달성해보세요 📖", "info")}>
                ℹ️ 정보
              </Button>
            </div>
          </SubSection>

          <SubSection label="로딩 스켈레톤">
            <div className="flex flex-col gap-3">
              <BookCardSkeleton />
              <BookCardSkeleton />
              <div className="grid grid-cols-2 gap-3">
                <StatCardSkeleton />
                <StatCardSkeleton />
              </div>
            </div>
          </SubSection>

          <SubSection label="모달 / 바텀 시트">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              모달 열기
            </Button>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="책 추가하기"
            >
              <div className="flex flex-col gap-4">
                <TextInput label="책 제목" value="" onChange={() => {}} placeholder=" " />
                <TextInput label="저자명" value="" onChange={() => {}} placeholder=" " />
                <GenreSelect value="" onChange={() => {}} />
                <div className="flex gap-2">
                  <Button variant="ghost" fullWidth onClick={() => setModalOpen(false)}>취소</Button>
                  <Button variant="primary" fullWidth onClick={() => { setModalOpen(false); showToast("책이 추가되었어요!", "success"); }}>
                    추가하기
                  </Button>
                </div>
              </div>
            </Modal>
          </SubSection>
        </Section>

        {/* ─── Stat Cards ────────────────────────────────────────── */}
        <Section title="📈 통계 카드">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              icon={<BookMarked size={20} style={{ color: "#4F46E5" }} />}
              iconBg="#EEF2FF"
              label="완독한 책"
              value="22권"
              trend="up"
              trendLabel="+3 이번 달"
            />
            <SummaryCard
              icon={<Star size={20} style={{ color: "#F59E0B" }} />}
              iconBg="#FEF3C7"
              label="평균 평점"
              value="4.2"
              trend="up"
              trendLabel="+0.3"
            />
            <SummaryCard
              icon={<BookOpen size={20} style={{ color: "#7C3AED" }} />}
              iconBg="#EDE9FE"
              label="읽은 페이지"
              value="8,420"
              trend="neutral"
              trendLabel="유지 중"
            />
            <SummaryCard
              icon={<Flame size={20} style={{ color: "#EF4444" }} />}
              iconBg="#FEE2E2"
              label="독서 스트릭"
              value="42일"
              trend="up"
              trendLabel="🔥 최고"
            />
          </div>
        </Section>

        {/* ─── Chips & Badges ────────────────────────────────────── */}
        <Section title="🏅 뱃지 & 칩">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 flex flex-col gap-4">
            <SubSection label="숫자 뱃지">
              <div className="flex items-center gap-4 flex-wrap">
                {[
                  { label: "읽는 중", count: 3, color: "#4F46E5", bg: "#EEF2FF" },
                  { label: "위시리스트", count: 12, color: "#7C3AED", bg: "#EDE9FE" },
                  { label: "알림", count: 5, color: "#EF4444", bg: "#FEE2E2" },
                  { label: "새 메시지", count: 99, color: "#10B981", bg: "#D1FAE5" },
                ].map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="text-[#64748B]" style={{ fontSize: 13 }}>{b.label}</span>
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ fontSize: 11, fontWeight: 700, color: b.color, backgroundColor: b.bg }}
                    >
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection label="상태 칩">
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "완독 ✅", bg: "#D1FAE5", color: "#065F46" },
                  { label: "읽는 중 📖", bg: "#EEF2FF", color: "#4338CA" },
                  { label: "목표 달성 🎯", bg: "#FEF3C7", color: "#92400E" },
                  { label: "D-5 🔥", bg: "#FEE2E2", color: "#B91C1C" },
                  { label: "새 책 🆕", bg: "#E0F2FE", color: "#0369A1" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="px-3 py-1 rounded-full"
                    style={{ fontSize: 12, fontWeight: 600, backgroundColor: chip.bg, color: chip.color }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ─── Empty State ───────────────────────────────────────── */}
        <Section title="🌵 빈 상태">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center shadow-inner">
                <span style={{ fontSize: 40 }}>📚</span>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-[#1E293B]" style={{ fontSize: 16, fontWeight: 700 }}>완독한 책이 없어요</h3>
                <p className="text-[#94A3B8]" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  첫 번째 책을 완독하고<br />나만의 서재를 채워보세요!
                </p>
              </div>
              <Button variant="primary" onClick={() => showToast("책 추가 기능이 준비 중이에요!", "info")}>
                + 첫 번째 책 추가하기
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
