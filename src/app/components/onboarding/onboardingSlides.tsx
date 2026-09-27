/**
 * 온보딩 슬라이드 구성 — 서재 · 기록 · 몰입 · 성장 4장.
 * 2026-09-27 리뉴얼 기능 전체 공개 후 플래그 분기를 제거했다. 새 기능을 플래그 뒤에서 먼저 공개할 때는
 * 온보딩에서 미공개 기능을 약속하지 않도록 다시 공개 플래그(GET /api/flags/public)로 분기한다(ADR-003).
 */
import type { ReactNode } from "react";
import { BookshelfIllustration, FocusIllustration, GrowthIllustration, NotesIllustration } from "./Illustrations";

export interface OnboardingSlide {
  key: string;
  eyebrow: string;
  headline: string;
  body: string;
  illustration: ReactNode;
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: "library",
    eyebrow: "서재",
    headline: "읽은 책이 한눈에 모여요",
    body: "읽는 중·완독·읽고 싶은 책을 한곳에서 관리해요. 표지를 찍거나 검색하면 책 정보가 바로 채워져요.",
    illustration: <BookshelfIllustration />,
  },
  {
    key: "notes",
    eyebrow: "기록",
    headline: "밑줄 그은 문장을 오래 간직해요",
    body: "굵게·형광펜 서식과 페이지 범위로 기록하고, 서재의 '오늘의 회고'에서 예전 메모를 다시 만나요.",
    illustration: <NotesIllustration />,
  },
  {
    key: "focus",
    eyebrow: "몰입",
    headline: "집중해서 읽고, 생각을 붙잡아요",
    body: "집중 타이머가 도는 동안 쓴 메모는 그 시간과 함께 묶여요. AI가 메모에 키워드 태그도 달아 줘요.",
    illustration: <FocusIllustration />,
  },
  {
    key: "growth",
    eyebrow: "성장",
    headline: "읽을수록 서재가 자라요",
    body: "완독한 책이 차곡차곡 쌓이고, 책 부엉이와 페이지 드래곤이 함께 자라요.",
    illustration: <GrowthIllustration />,
  },
];
