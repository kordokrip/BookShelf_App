/**
 * 처음 사용자 기능 말풍선 — 대상 요소를 감싸(asChild) 레이아웃을 바꾸지 않고, 차례가 되면 말풍선을 띄운다.
 * - 가입 7일 미만 & 방문 7회 미만 사용자에게만, 화면당 한 번에 하나만
 * - 포커스를 가두거나 화면을 막지 않는다. [알겠어요]·Esc·말풍선 바깥 누르기로 닫으면 '본 것'으로 기록
 *   (말풍선이 아래 콘텐츠를 가릴 수 있어 바깥을 눌러도 바로 닫히게 한다)
 * - 대상이 화면(뷰포트) 안에 들어왔을 때만 순서에 등록 — 스크롤 아래 대상이 다른 말풍선 차례를 막지 않게
 * - 모달/시트가 열려 있으면 숨긴다
 * 순서·저장 규칙: lib/featureHints.ts, 상태: hooks/useFeatureHints.ts
 */
import { useEffect, useState, type ReactElement } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useFeatureHint } from "../../../hooks/useFeatureHints";

/** 대상이 레이아웃을 잡은 뒤 띄우기 위한 지연(ms) */
const SHOW_DELAY_MS = 700;

function hasOpenModal(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

/** body 직속 포털(Radix 모달·시트)이 생기고 사라지는 것만 감시 */
function useModalOpen(active: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const sync = () => setOpen(hasOpenModal());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ["data-scroll-locked"] });
    return () => observer.disconnect();
  }, [active]);
  return open;
}

function useMediaMatch(query: string | undefined): boolean {
  const [matches, setMatches] = useState(() => (query ? window.matchMedia(query).matches : true));
  useEffect(() => {
    if (!query) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** 대상 요소가 뷰포트 안에 보이는지 — IntersectionObserver가 없으면 보이는 것으로 본다 */
function useInViewport(id: string): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = document.querySelector(`[data-hint-id="${id}"]`);
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { threshold: 0.6 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);
  return inView;
}

interface FeatureHintProps {
  /** lib/featureHints.ts HINT_ORDER의 id */
  id: string;
  /** 말풍선 문구 (1~2줄, 존댓말) */
  text: string;
  /** 감쌀 단일 요소 — ref와 props를 DOM 요소에 전달해야 한다 */
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  /** 이 미디어쿼리가 맞을 때만 표시 (예: 모바일 하단 메뉴 전용) */
  mediaQuery?: string;
  /** false면 순서에 등록하지 않는다 (같은 id가 목록에 여러 번 있을 때 첫 번째만 true) */
  enabled?: boolean;
}

export function FeatureHint({ id, text, children, side = "bottom", mediaQuery, enabled = true }: FeatureHintProps) {
  const visibleOnViewport = useMediaMatch(mediaQuery);
  const inView = useInViewport(id);
  const { isTurn, dismiss } = useFeatureHint(id, visibleOnViewport && enabled && inView);
  const modalOpen = useModalOpen(isTurn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isTurn || modalOpen) {
      setReady(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-hint-id="${id}"]`);
      setReady(!!el && el.getClientRects().length > 0);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isTurn, modalOpen, id]);

  const open = isTurn && ready && !modalOpen;

  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root open={open}>
        <TooltipPrimitive.Trigger asChild data-hint-id={id}>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            collisionPadding={12}
            aria-label={text}
            onEscapeKeyDown={dismiss}
            onPointerDownOutside={dismiss}
            data-testid="feature-hint"
            className="z-[70] rounded-2xl px-4 pt-3 pb-1.5 text-white shadow-lg ring-1 ring-white/20"
            style={{ background: "var(--brand-600)", maxWidth: "min(280px, calc(100vw - 32px))" }}
          >
            <p style={{ fontSize: 13, lineHeight: 1.5 }} className="break-keep">{text}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={dismiss}
                className="min-h-11 px-3 -mr-2 rounded-xl text-white underline underline-offset-4"
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                알겠어요
              </button>
            </div>
            <TooltipPrimitive.Arrow width={14} height={7} style={{ fill: "var(--brand-600)" }} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
