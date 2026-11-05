import { type GenreKey, type BookStatus, COVER_GRADIENTS } from "../../../types/book";

/* ─── 타입 ──────────────────────────────────────────────────── */
export type Step = 1 | 2 | 3 | 4;

export interface FormState {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  totalPages: string;
  genre: GenreKey;
  status: BookStatus;
  finishedDate: string;
  rating: number;
  goalDate: string;
  currentPage: string;
  coverEmoji: string;
  coverColor: string; // 검색 결과 표지 없을 때 폴백 그라디언트
  coverImage: string; // 검색 결과 표지 URL
}

export const INITIAL_FORM: FormState = {
  title: "",
  author: "",
  publisher: "",
  isbn: "",
  totalPages: "",
  genre: "기타",
  status: "reading",
  finishedDate: "",
  rating: 0,
  goalDate: "",
  currentPage: "",
  coverEmoji: "📚",
  coverColor: COVER_GRADIENTS[0] ?? "from-indigo-500 to-violet-600",
  coverImage: "",
};

/* ─── cn 유틸 ───────────────────────────────────────────────── */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** 로컬 기준 오늘(YYYY-MM-DD) — toISOString은 UTC라 KST 새벽에 하루 전 날짜가 됨 */
export function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
