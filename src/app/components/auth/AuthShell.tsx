/**
 * 로그인·회원가입 공용 화면 틀 (56차 개편 "책갈피를 꽂아 둔 자리")
 *
 * - 히어로: 앱 아이콘(Ember Frost)의 겨울 저녁 하늘 — Dusk Ink 바탕에 왼쪽 아래 잉걸불 빛 한 줄기.
 *   위에서 금빛 책갈피가 내려와 세리프 문장 바로 위에 멈춘다("읽던 자리"). 이 화면에서 눈에 띄는 건 이것 하나다.
 * - 데스크톱(lg↑): 왼쪽 히어로 + 오른쪽 폼. 모바일: 위쪽 낮은 히어로 띠 + 아래 폼.
 * - 폼은 한 번만 렌더링한다 — 예전에는 모바일·데스크톱용 폼을 두 벌 그려(숨은 쪽도 DOM에 남음)
 *   입력칸 id가 겹치고 화면 폭을 바꾸면 입력·단계가 따로 놀았다.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AuthPreviewNav } from "./AuthPreviewNav";
import { DUSK_BACKGROUND, HERO_INK, HERO_SUB, RIBBON_GOLD, Ribbon, Wordmark } from "../brand/dusk";

export interface AuthFeature { icon: LucideIcon; text: string }

export function AuthShell({
  headline,
  subline,
  features,
  children,
}: {
  /** 세리프 문장 — 줄바꿈은 \n */
  headline: string;
  subline: string;
  /** 데스크톱 히어로에만 보이는 짧은 목록(가입 화면) */
  features?: AuthFeature[];
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh flex flex-col lg:flex-row" style={{ backgroundColor: "var(--bg-primary)" }}>
      <section
        aria-label="BookShelf 소개"
        className="relative overflow-hidden flex-shrink-0 lg:w-[46%] lg:min-h-svh lg:sticky lg:top-0 lg:self-start"
        style={DUSK_BACKGROUND}
      >
        {/* 모바일: 오른쪽 위에서 짧게 / 데스크톱: 문장 왼쪽 끝 위에서 길게 */}
        <Ribbon className="right-7 w-[22px] h-[72px] lg:right-auto lg:left-14 lg:w-[28px] lg:h-[34vh]" />

        <div className="relative flex flex-col px-6 pb-7 pt-[calc(var(--safe-top,0px)_+_22px)] lg:px-14 lg:py-12 lg:min-h-svh">
          <div className="lg:hidden">
            <Wordmark size="sm" />
          </div>

          <div className="mt-6 pr-12 lg:pr-0 lg:mt-[calc(34vh_-_20px)]">
            <p
              className="font-book break-keep whitespace-pre-line text-[22px] leading-[1.45] lg:text-[38px] lg:leading-[1.38]"
              style={{ color: HERO_INK, letterSpacing: "-0.01em" }}
            >
              {headline}
            </p>
            <p className="mt-2.5 lg:mt-5 text-[13px] lg:text-[15px] leading-relaxed break-keep max-w-[34ch]" style={{ color: HERO_SUB, fontFamily: "var(--font-pretendard)" }}>
              {subline}
            </p>
            {features && (
              <ul className="hidden lg:flex flex-col gap-3.5 mt-10">
                {features.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-[14px]" style={{ color: HERO_SUB, fontFamily: "var(--font-pretendard)" }}>
                    <Icon size={17} aria-hidden style={{ color: RIBBON_GOLD, flexShrink: 0 }} />
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hidden lg:block mt-auto pt-12">
            <Wordmark size="md" />
          </div>
        </div>
      </section>

      <div className="flex-1 flex justify-center lg:items-center px-6 pt-8 pb-12 lg:px-16 lg:py-16">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>

      <AuthPreviewNav />
    </main>
  );
}
