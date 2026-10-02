/**
 * AppearancePage — 앱 디자인(개인 테마) 설정: /settings/appearance
 * - 강조색 6종: 라디오 그룹 카드. 선택 즉시 앱 전체에 적용(<html data-accent>) + 서버 프로필에 저장
 * - 화면 모드: 자동(시간대)/라이트/다크
 * - 실제 토큰(bg-indigo-* 등)으로 그린 미리보기 — 선택 결과를 바로 확인
 * 저장 실패 시에도 기기에는 그대로 적용되고 토스트로만 안내한다.
 */
import { useRef, type KeyboardEvent } from 'react';
import { Check, Clock, Sun, Moon, BookOpen } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import { changeTheme } from '../../lib/themeSync';
import { ACCENT_PRESETS, type AccentId, type AccentPreset } from '../../lib/themePresets';
import type { ThemeMode } from '../../lib/applyTheme';
import { useToast } from '../components/ui/Toast';

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'auto', label: '자동 (시간대)', icon: Clock },
  { id: 'light', label: '라이트', icon: Sun },
  { id: 'dark', label: '다크', icon: Moon },
];

/** 라디오 그룹 키보드 이동 — 방향키로 이전/다음 항목을 선택하고 포커스를 옮긴다 */
function useRadioArrows<T extends string>(ids: readonly T[], current: T, onSelect: (id: T) => void) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = (e: KeyboardEvent) => {
    const idx = ids.indexOf(current);
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    const id = ids[next]!;
    onSelect(id);
    refs.current[id]?.focus();
  };
  return { refs, onKeyDown };
}

/** 프리셋 카드 안의 미니 미리보기 — 프리셋 hex를 직접 써서 적용 전에도 해당 색을 보여준다 */
function PresetPreview({ preset }: { preset: AccentPreset }) {
  const b600 = preset.brand[6];
  const b2600 = preset.brand2[6];
  return (
    <div
      className="rounded-lg p-2.5 space-y-2 border border-[#E2E8F0]"
      style={{ background: '#FFFFFF' }}
      aria-hidden="true"
    >
      <div className="h-6 rounded-md" style={{ background: `linear-gradient(135deg, ${b600}, ${b2600})` }} />
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2.5 flex items-center text-white"
          style={{ background: b600, fontSize: 11, fontWeight: 600, height: 24 }}
        >
          버튼
        </span>
        <span
          className="rounded-full px-2 flex items-center"
          style={{ background: preset.brand[0], color: preset.brand[7], fontSize: 11, fontWeight: 600, height: 22 }}
        >
          칩
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div className="h-full rounded-full" style={{ width: '62%', background: b600 }} />
      </div>
    </div>
  );
}

function AccentCard({
  preset, selected, onSelect, buttonRef,
}: {
  preset: AccentPreset;
  selected: boolean;
  onSelect: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${preset.name} — ${preset.description}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`relative text-left rounded-2xl border-2 p-3 min-h-[44px] bg-white dark:bg-[#1E293B] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300 ${
        selected
          ? 'border-indigo-600 dark:border-indigo-300'
          : 'border-[#E2E8F0] dark:border-[#334155] hover:border-[#94A3B8]'
      }`}
    >
      <PresetPreview preset={preset} />
      <div className="mt-2.5 pr-7">
        <p className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 14, fontWeight: 700 }}>{preset.name}</p>
        <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>{preset.description}</p>
      </div>
      {selected && (
        <span
          className="absolute bottom-3 right-3 w-6 h-6 rounded-full flex items-center justify-center bg-indigo-600 dark:bg-indigo-300 text-white dark:text-[#0F172A]"
          aria-hidden="true"
        >
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export function AppearancePage() {
  const accent = useUiStore((s) => s.accent);
  const themeMode = useUiStore((s) => s.themeMode);
  const { showToast } = useToast();

  const onError = () => showToast('서버에 저장하지 못했어요. 이 기기에는 적용됐어요.', 'error');
  const selectAccent = (id: AccentId) => { if (id !== accent) void changeTheme({ theme_accent: id }, onError); };
  const selectMode = (id: ThemeMode) => { if (id !== themeMode) void changeTheme({ theme_mode: id }, onError); };

  const accentArrows = useRadioArrows(ACCENT_PRESETS.map((p) => p.id), accent, selectAccent);
  const modeArrows = useRadioArrows(MODES.map((m) => m.id), themeMode, selectMode);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <header>
        <h1 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 22, fontWeight: 700 }}>앱 디자인</h1>
        <p className="text-[#64748B] dark:text-[#94A3B8] mt-1" style={{ fontSize: 13 }}>
          나만의 강조색과 화면 모드를 고르세요. 계정에 저장되어 다른 기기에서도 같게 보여요.
        </p>
      </header>

      {/* 강조색 */}
      <section aria-labelledby="accent-heading">
        <h2 id="accent-heading" className="text-[#1E293B] dark:text-[#F8FAFC] mb-3" style={{ fontSize: 15, fontWeight: 700 }}>강조색</h2>
        <div
          role="radiogroup"
          aria-labelledby="accent-heading"
          onKeyDown={accentArrows.onKeyDown}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {ACCENT_PRESETS.map((p) => (
            <AccentCard
              key={p.id}
              preset={p}
              selected={p.id === accent}
              onSelect={() => selectAccent(p.id)}
              buttonRef={(el) => { accentArrows.refs.current[p.id] = el; }}
            />
          ))}
        </div>
      </section>

      {/* 화면 모드 */}
      <section aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="text-[#1E293B] dark:text-[#F8FAFC] mb-3" style={{ fontSize: 15, fontWeight: 700 }}>화면 모드</h2>
        <div
          role="radiogroup"
          aria-labelledby="mode-heading"
          onKeyDown={modeArrows.onKeyDown}
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#F1F5F9] dark:bg-[#1E293B]"
        >
          {MODES.map(({ id, label, icon: Icon }) => {
            const selected = id === themeMode;
            return (
              <button
                key={id}
                ref={(el) => { modeArrows.refs.current[id] = el; }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectMode(id)}
                className={`min-h-[44px] rounded-xl flex items-center justify-center gap-1.5 px-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300 ${
                  selected
                    ? 'bg-white dark:bg-[#334155] text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-[#F8FAFC]'
                }`}
                style={{ fontSize: 13, fontWeight: selected ? 700 : 500 }}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[#64748B] dark:text-[#94A3B8] mt-2" style={{ fontSize: 11 }}>
          자동은 오전 6시부터 오후 6시까지 라이트, 그 외 시간에는 다크예요.
        </p>
      </section>

      {/* 실제 토큰 미리보기 */}
      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-[#1E293B] dark:text-[#F8FAFC] mb-3" style={{ fontSize: 15, fontWeight: 700 }}>미리보기</h2>
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'var(--brand-gradient)' }}
              aria-hidden="true"
            >
              <BookOpen size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 15, fontWeight: 700 }}>이달의 독서</p>
              <p className="text-indigo-600 dark:text-indigo-300" style={{ fontSize: 13, fontWeight: 600 }}>3권 중 2권 완독</p>
            </div>
          </div>
          <div
            className="h-2 rounded-full bg-[#E2E8F0] dark:bg-[#334155] overflow-hidden"
            role="progressbar" aria-valuenow={67} aria-valuemin={0} aria-valuemax={100} aria-label="미리보기 진행률"
          >
            <div className="h-full w-2/3 rounded-full bg-indigo-600 dark:bg-indigo-400" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-h-[44px] px-5 inline-flex items-center rounded-xl bg-indigo-600 text-white" style={{ fontSize: 14, fontWeight: 600 }}>
              기본 버튼
            </span>
            <span className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200" style={{ fontSize: 12, fontWeight: 600 }}>
              선택된 칩
            </span>
            <span className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900 dark:text-violet-200" style={{ fontSize: 12, fontWeight: 600 }}>
              보조 강조
            </span>
          </div>
        </div>
      </section>

      <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>
        앱 아이콘과 시작 화면은 기기 설정상 바뀌지 않아요.
      </p>
    </div>
  );
}
