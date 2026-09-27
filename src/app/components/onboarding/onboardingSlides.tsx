/**
 * 온보딩 슬라이드 구성 — 공개 플래그(GET /api/flags/public)에 따라 리뉴얼 기능 또는 현재 기능을 소개한다.
 * 아직 전체 공개되지 않은 기능(관리자·스테이징 전용)을 신규 사용자에게 약속하지 않기 위함(ADR-003).
 */
import type { ReactNode } from "react";
import type { FeatureFlag } from "../../../lib/api/flags";
import {
  BookshelfIllustration, CameraIllustration, FocusIllustration, GrowthIllustration,
  NotesIllustration, StatsIllustration,
} from "./Illustrations";

export interface OnboardingSlide {
  key: string;
  eyebrow: string;
  headline: string;
  body: string;
  illustration: ReactNode;
}

export function buildOnboardingSlides(flags: readonly FeatureFlag[]): OnboardingSlide[] {
  const has = (f: FeatureFlag) => flags.includes(f);

  const library: OnboardingSlide = {
    key: "library",
    eyebrow: "서재",
    headline: "읽은 책이 한눈에 모여요",
    body: "읽는 중·완독·읽고 싶은 책을 한곳에서 관리해요. 표지를 찍거나 검색하면 책 정보가 바로 채워져요.",
    illustration: <BookshelfIllustration />,
  };

  const notes: OnboardingSlide = has("notes_v2")
    ? {
        key: "notes",
        eyebrow: "기록",
        headline: "밑줄 그은 문장을 오래 간직해요",
        body: "굵게·형광펜 서식과 페이지 범위로 기록하고, 서재의 '오늘의 회고'에서 예전 메모를 다시 만나요.",
        illustration: <NotesIllustration />,
      }
    : {
        key: "notes",
        eyebrow: "기록",
        headline: "인상 깊은 문장을 남겨요",
        body: "문구·메모·독후감을 기록하고 언제든 검색해요. 사진으로 찍은 페이지도 글자로 옮겨 드려요.",
        illustration: <CameraIllustration />,
      };

  const focus: OnboardingSlide | null = has("focus_timer")
    ? {
        key: "focus",
        eyebrow: "몰입",
        headline: "집중해서 읽고, 생각을 붙잡아요",
        body:
          "집중 타이머가 도는 동안 쓴 메모는 그 시간과 함께 묶여요." +
          (has("ai_tags") ? " AI가 메모에 키워드 태그도 달아 줘요." : ""),
        illustration: <FocusIllustration />,
      }
    : null;

  const growth: OnboardingSlide = has("book_stack") || has("characters")
    ? {
        key: "growth",
        eyebrow: "성장",
        headline: "읽을수록 서재가 자라요",
        body: "완독한 책이 차곡차곡 쌓이고, 책 부엉이와 페이지 드래곤이 함께 자라요.",
        illustration: <GrowthIllustration />,
      }
    : {
        key: "growth",
        eyebrow: "성장",
        headline: "목표와 통계로 꾸준함을 만들어요",
        body: "독서 타이머와 기록이 쌓이면 월별 통계·연속 독서·성취 배지로 성장을 보여 드려요.",
        illustration: <StatsIllustration />,
      };

  return [library, notes, ...(focus ? [focus] : []), growth];
}
