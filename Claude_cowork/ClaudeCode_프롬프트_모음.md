# BookShelf — Claude Code 구현 프롬프트 모음

> **사용법**: 각 Phase 프롬프트를 Claude Code CLI(`claude`)에 그대로 붙여넣기
> **전제**: 프로젝트 루트(`BookShelf_App/`)에서 실행
> **스택**: React 18 · Vite 6 · Hono 4 (Cloudflare Workers) · D1(SQLite) · Zustand v5 · TanStack Query v5 · TailwindCSS 4

---

## Phase 1 — 즉시 적용 (Rate Limiting · 오프라인 Toast · staleTime 튜닝)

### 📋 프롬프트 1-A: Rate Limiting 미들웨어 구현

```
You are working on a PWA called BookShelf. The backend is a Cloudflare Workers (Hono 4.x) API with D1, KV, and R2 bindings. The project root is the current directory.

## Task
Implement a KV-based rate limiting middleware for the Cloudflare Worker backend.

## Context
- Worker entry point: `worker/index.ts`
- Auth routes: `worker/routes/users.ts`
- Search routes: `worker/routes/search.ts`
- AI routes: `worker/routes/ai.ts`
- Bindings type: `worker/types.ts` (KVNamespace binding named `KV`)
- Hono context type: `Context<{ Bindings: Bindings }>`

## Implementation Requirements

1. Create a new file `worker/middleware/rateLimit.ts`:
   - Export a `rateLimit(options: { limit: number; windowMs: number; keyPrefix?: string })` function
   - Use Cloudflare KV (`c.env.KV`) for sliding-window counter storage
   - Key format: `rl:{keyPrefix}:{path}:{ip}` where IP comes from `c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'`
   - On limit exceeded: return `c.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429)`
   - Use `expirationTtl: Math.ceil(windowMs / 1000)` for KV expiry

2. Apply rate limits to these routes in their respective files:
   - `POST /api/users/login` → 5 requests per 60 seconds (keyPrefix: 'login')
   - `POST /api/users/register` → 3 requests per 60 seconds (keyPrefix: 'register')
   - `GET /api/search/books` → 20 requests per 60 seconds (keyPrefix: 'search')
   - `GET /api/search/books/isbn` → 10 requests per 60 seconds (keyPrefix: 'isbn')
   - `POST /api/ai/summarize` → 5 requests per 60 seconds (keyPrefix: 'ai')
   - `GET /api/ai/recommend` → 10 requests per 60 seconds (keyPrefix: 'ai')
   - `POST /api/ai/ocr` → 3 requests per 60 seconds (keyPrefix: 'ai')

3. The middleware must be placed BEFORE auth middleware in the middleware chain.

## Constraints
- Do NOT modify `worker/index.ts` (only modify the individual route files and create the new middleware file)
- Do NOT change any existing middleware behavior
- TypeScript must compile without errors (`npx tsc --noEmit`)
- The middleware must be a proper Hono `MiddlewareHandler` compatible function

## Verification
After implementation, run:
1. `npx tsc --noEmit` — must exit 0
2. Show the complete `worker/middleware/rateLimit.ts` file content
3. Show the diff for each modified route file
```

---

### 📋 프롬프트 1-B: 오프라인 상태 Toast + 홈화면 설치 배너

```
You are working on a PWA called BookShelf. Frontend is React 18 + Vite + TanStack Query v5 + Zustand v5.

## Task
Implement two UX improvements: (1) offline/online status Toast notification, (2) PWA install prompt banner.

## Context
- App entry point: `src/app/App.tsx`
- Toast component and hook: `src/app/components/ui/Toast.tsx` (exports `useToast` hook — read this file first to understand the API)
- Zustand UI store: `src/stores/uiStore.ts` (read to understand existing modal/state patterns)
- CSS variables and global styles: `src/styles/index.css`, `src/styles/theme.css`
- PWA service worker registration: `vite.config.ts` (uses vite-plugin-pwa with `registerType: 'autoUpdate'`)

## Implementation Requirements

### Part 1: Offline/Online Toast
In `src/app/App.tsx`, add a `useEffect` that:
- Listens to `window` events: `'offline'` and `'online'`
- On `'offline'`: shows an error/warning toast with message `'인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.'`
- On `'online'`: shows a success toast with message `'인터넷 연결이 복구되었습니다.'`
- Properly removes event listeners on cleanup
- Uses the existing `useToast` hook (do NOT create a new toast system)

### Part 2: PWA Install Banner
Create a new component `src/app/components/ui/InstallBanner.tsx`:
- Captures the `beforeinstallprompt` event via `useEffect` on mount
- Shows a dismissible banner at the bottom of the screen (above BottomNavBar, z-index: 40) with:
  - Text: `'홈 화면에 추가하면 앱처럼 사용할 수 있어요'`
  - "설치" button: calls `promptEvent.prompt()` then hides banner
  - "닫기" button (X icon from lucide-react): hides banner and saves dismissal to `sessionStorage` key `'install_banner_dismissed'`
- Does NOT show if `sessionStorage.getItem('install_banner_dismissed')` is truthy
- Does NOT show on desktop (use `window.matchMedia('(display-mode: standalone)')` to check if already installed)
- Uses TailwindCSS 4 utility classes and existing design tokens
- The banner should animate in from the bottom using a simple CSS transition (no framer-motion)

Mount `<InstallBanner />` inside `App.tsx`, inside the `RouterProvider` wrapper but outside the router (so it's always visible).

## Constraints
- Do NOT modify `Root.tsx` layout structure
- Do NOT add new dependencies
- TypeScript strict mode must pass (`npx tsc --noEmit` exits 0)
- Use existing `lucide-react` icons (already installed)

## Verification
1. `npx tsc --noEmit` — must exit 0
2. Show complete content of the new `InstallBanner.tsx`
3. Show the diff for `App.tsx`
```

---

### 📋 프롬프트 1-C: QueryClient staleTime·refetchOnWindowFocus 튜닝

```
You are working on a PWA called BookShelf. The data layer uses TanStack Query v5.

## Task
Tune QueryClient configuration to reduce unnecessary refetches on mobile, and add per-hook staleTime overrides where appropriate.

## Context
- QueryClient config: `src/lib/queryClient.ts` — read the full file first
- All hooks: `src/hooks/useBooks.ts`, `src/hooks/useNotes.ts`, `src/hooks/useSessions.ts`, `src/hooks/useAI.ts`, `src/hooks/useBookSearch.ts`
- API module: `src/lib/api.ts` (contains ApiError class — read to understand retry logic)

## Implementation Requirements

### 1. Update `src/lib/queryClient.ts`
Change the following defaults:
- `staleTime`: `30_000` → `60_000` (60 seconds — reduces mobile window-focus refetches)
- `refetchOnWindowFocus`: `true` → `false` (prevent aggressive refetching when user returns from another app)
- `gcTime`: keep at `5 * 60_000` (no change)
- `retry` logic: keep existing ApiError-based logic (no change)

### 2. Add explicit staleTime overrides in hooks where data changes frequently:
- `useSessions()` in `src/hooks/useSessions.ts`: add `staleTime: 30_000` (session data is time-sensitive)
- `useBooks()` with status `'reading'` doesn't need override (60s is fine)
- `useAIRecommendations()` in `src/hooks/useAI.ts`: verify it already has `staleTime: 60 * 60_000` — if not, add it (AI recommendations are expensive and cached 1h in KV anyway)

### 3. Add `select` optimization to `useBooks` in `src/hooks/useBooks.ts`
The BottomNavBar mounts `useBooks({ status: 'reading' })` and `useBooks({ status: 'wish' })` only to get the count.
Add a `useBookCount(status: BookStatus)` hook that:
- Reuses the same queryKey as `useBooks({ status })`
- Uses TanStack Query `select` option to return only `data.length` (number)
- This avoids re-renders when book content changes but count stays the same

### 4. Update `BottomNavBar.tsx` to use the new `useBookCount` hook
File: `src/app/components/navigation/BottomNavBar.tsx`
- Replace `useBooks({ status: 'reading' })` → `useBookCount('reading')`
- Replace `useBooks({ status: 'wish' })` → `useBookCount('wish')`
- Keep the `99+` display logic as-is

## Constraints
- Export `useBookCount` from `src/hooks/useBooks.ts` (add to existing file, do NOT create a new file)
- All existing hook signatures must remain unchanged (backward compatible)
- `npx tsc --noEmit` must exit 0
- Do NOT change anything in `worker/` directory

## Verification
1. `npx tsc --noEmit` — must exit 0
2. Show diffs for: `queryClient.ts`, `useBooks.ts`, `BottomNavBar.tsx`
3. Confirm `useAIRecommendations` staleTime value
```

---

## Phase 2 — 1주 이내 (독서 타이머 · 스트릭 · PBKDF2)

### 📋 프롬프트 2-A: 독서 타이머 기능 (ReadingPage)

```
You are working on a PWA called BookShelf. Frontend is React 18 + Vite + TailwindCSS 4.

## Task
Add a reading timer feature to ReadingPage that automatically populates `durationMinutes` when recording a reading session.

## Context — Read these files FIRST before writing any code:
- `src/app/pages/ReadingPage.tsx` — full page implementation
- `src/hooks/useSessions.ts` — `useAddSession` mutation signature
- `src/app/components/ui/NumberStepper.tsx` — existing stepper component (may reuse)
- `src/app/components/ui/Modal.tsx` — existing modal pattern
- `src/styles/theme.css` — design tokens

## Implementation Requirements

### 1. Create `src/hooks/useReadingTimer.ts`
```typescript
// Exported interface (implement this exactly):
interface UseReadingTimerReturn {
  isRunning: boolean;
  elapsed: number;       // total seconds elapsed
  minutes: number;       // Math.floor(elapsed / 60)
  displayTime: string;   // "MM:SS" formatted string
  start: () => void;
  pause: () => void;
  reset: () => void;
}
export function useReadingTimer(): UseReadingTimerReturn
```
- Use `useRef` for the interval ID (not useState) to avoid stale closure
- Use `setInterval` with 1-second tick
- `displayTime` format: `"${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}"`
- Cleanup interval on unmount

### 2. Add Timer UI to `ReadingPage.tsx`
Add a compact timer widget to the ReadingPage. It should:
- Appear as a sticky card at the top of the page (below TopBar) or as a floating element
- Show the current book being timed (if a book is selected)
- Display: current time `MM:SS`, Start/Pause button, Reset button
- When the "세션 기록" (session recording) sheet/modal opens, pre-fill `durationMinutes` with `timer.minutes`
- After successful session submission (`useAddSession` onSuccess), call `timer.reset()`
- The timer should persist across tab switches within the session (use `useRef` to store startTime)

### 3. Integrate with `useAddSession`
In the session recording flow, pass `durationMinutes: timer.minutes` to the mutation.
If `timer.minutes === 0`, pass `undefined` (the field is nullable in DB).

## Constraints
- Do NOT modify `src/hooks/useSessions.ts` (timer value is passed at call site)
- Do NOT add new npm dependencies
- Timer must NOT use `Date.now()` polling — use `setInterval` with 1s
- TailwindCSS 4 only for styling (no inline style objects except for dynamic values)
- `npx tsc --noEmit` must exit 0

## Verification
1. `npx tsc --noEmit` — exit 0
2. Show complete `useReadingTimer.ts`
3. Show the ReadingPage diff (timer integration section only)
```

---

### 📋 프롬프트 2-B: 독서 스트릭 계산 및 StatsPage 표시

```
You are working on a PWA called BookShelf. The stats page uses Recharts + TanStack Query.

## Task
Add reading streak calculation (current streak and longest streak) to StatsPage.

## Context — Read these files FIRST:
- `src/app/components/stats/StatsComponents.tsx` — all existing stat components and calculation functions
- `src/app/pages/StatsPage.tsx` — how stats are composed
- `src/hooks/useSessions.ts` — `useSessions()` hook return type (`UISession[]`)
- `src/types/book.ts` — `UISession` interface (check `sessionDate` field type — it's a string 'YYYY-MM-DD')

## Implementation Requirements

### 1. Add `calcReadingStreak` to `src/app/components/stats/StatsComponents.tsx`

```typescript
export function calcReadingStreak(sessions: UISession[]): {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;  // unique days with reading sessions
}
```

Algorithm:
1. Extract unique `sessionDate` strings from sessions, sort descending
2. `totalDays` = unique dates count
3. `currentStreak`: starting from today or yesterday, count consecutive days backwards
   - If the most recent session date is neither today nor yesterday → currentStreak = 0
4. `longestStreak`: iterate all sorted dates, count max consecutive run
5. Two dates are "consecutive" if one equals the other minus 1 day (compare YYYY-MM-DD strings via Date arithmetic)

Edge cases: empty sessions → `{ currentStreak: 0, longestStreak: 0, totalDays: 0 }`

### 2. Create a `StreakCard` component in `StatsComponents.tsx`

Visual design:
- Card with flame emoji 🔥 icon or lucide `Flame` icon (check if available in installed lucide-react version)
- Show: current streak (large number + "일 연속"), longest streak, total reading days
- Match the visual style of existing `SummaryCard` in the same file
- Use the same card/shadow/padding design tokens

### 3. Add `StreakCard` to `StatsPage.tsx`
- Place it after the existing summary cards, before the monthly chart
- Pass `sessions` data from the already-fetched `useSessions()` query
- Show skeleton (`StatCardSkeleton`) while sessions are loading

## Constraints
- Add ALL new code to existing files (no new files)
- `UISession` type must not be modified
- `npx tsc --noEmit` must exit 0
- No new dependencies

## Verification
1. `npx tsc --noEmit` — exit 0
2. Show the `calcReadingStreak` function implementation
3. Show the `StreakCard` component
4. Verify edge case: what does the function return for an empty array?
```

---

### 📋 프롬프트 2-C: 비밀번호 해싱 SHA-256 → PBKDF2 마이그레이션

```
You are working on a Cloudflare Workers backend using Hono 4.x with TypeScript.

## Task
Migrate password hashing from SHA-256 (current) to PBKDF2 with 600,000 iterations using the Web Crypto API (available natively in Cloudflare Workers). Implement automatic migration on next login.

## Context — Read these files FIRST:
- `worker/auth.ts` — current `hashPassword()` and `verifyPassword()` implementations
- `worker/routes/users.ts` — `POST /api/users/login` handler (where migration hook goes)
- `worker/types.ts` — Bindings interface (DB is D1Database)

## Current Implementation (for reference)
```typescript
// Current SHA-256 format stored in DB: "{uuid-salt}:{sha256-hex}"
hashPassword(password, salt?) → `${salt}:${hexHash}`
verifyPassword(password, stored) → boolean
```

## Implementation Requirements

### 1. Rewrite `hashPassword` in `worker/auth.ts`
New format stored in DB: `"pbkdf2:{salt-hex}:{hash-hex}"`
- Generate 16-byte random salt: `crypto.getRandomValues(new Uint8Array(16))`
- Use `crypto.subtle.importKey` with algorithm `'PBKDF2'`
- Use `crypto.subtle.deriveBits` with:
  - `name: 'PBKDF2'`, `salt: saltBuffer`, `iterations: 600_000`, `hash: 'SHA-256'`
  - 256 bits output
- Convert both salt and hash to lowercase hex strings
- Return `"pbkdf2:{saltHex}:{hashHex}"`
- Function signature must become `async`: `hashPassword(password: string): Promise<string>`

### 2. Rewrite `verifyPassword` in `worker/auth.ts`
- Function signature: `async verifyPassword(password: string, stored: string): Promise<boolean>`
- If `stored.startsWith('pbkdf2:')`: use new PBKDF2 verification (re-derive and compare)
- If stored does NOT start with `'pbkdf2:'`: use legacy SHA-256 verification (keep existing logic for backward compat)
- Use `crypto.subtle.timingSafeEqual` equivalent: compare using constant-time comparison
  (In Web Crypto, derive the hash and compare ArrayBuffers byte-by-byte in a loop — do NOT use string comparison)

### 3. Update all callers of `hashPassword` and `verifyPassword`
- `worker/routes/users.ts`: update `POST /api/users/register` — await hashPassword
- `worker/routes/users.ts`: update `POST /api/users/login` — await verifyPassword, then:
  - If login succeeds AND stored hash does NOT start with 'pbkdf2:' (legacy hash):
    - Automatically upgrade: `await db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(newHash, user.id).run()`
    - Log: no logging needed
  - This transparent migration requires no user action

### 4. Update `createToken` if it's synchronous — no change needed if it already uses `Hono/Jwt`

## Constraints
- Do NOT add any npm packages — use Web Crypto API only (`crypto.subtle`, `crypto.getRandomValues`)
- All functions that become async must propagate `async/await` up the call chain
- `npx tsc --noEmit` must exit 0
- The legacy SHA-256 verification path must remain functional (for existing users before migration)
- Do NOT change any frontend files

## Verification
1. `npx tsc --noEmit` — exit 0
2. Show the complete rewritten `worker/auth.ts`
3. Show the diff for `worker/routes/users.ts`
4. Explain: what happens when a user with a legacy SHA-256 hash logs in? (Step-by-step)
```

---

## Phase 3 — 2~4주 (FTS5 · Stats API · Web Push · Background Sync)

### 📋 프롬프트 3-A: D1 FTS5 전문 검색 마이그레이션

```
You are working on a Cloudflare Workers + D1 (SQLite) backend.

## Task
Replace `LIKE '%keyword%'` full-table-scan search in the notes API with SQLite FTS5 virtual table search.

## Context — Read these files FIRST:
- `worker/db/schema.sql` — current schema (notes table structure)
- `worker/routes/notes.ts` — current `GET /api/notes?search=` implementation
- `worker/types.ts` — DbNote type

Check the `worker/db/migrations/` directory structure (may be empty or have existing migrations).

## Implementation Requirements

### 1. Create migration file: `worker/db/migrations/0002_fts5_notes.sql`

```sql
-- Step 1: Create FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  content,
  content='notes',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 1'
);

-- Step 2: Populate from existing notes
INSERT INTO notes_fts(rowid, content) SELECT rowid, content FROM notes;

-- Step 3: Sync triggers (INSERT / UPDATE / DELETE)
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

### 2. Update `worker/routes/notes.ts` — search query

Replace the existing `LIKE '%keyword%'` branch with FTS5:

```typescript
// When search param is provided:
const ftsQuery = `"${search.replace(/"/g, '""')}"*`  // FTS5 prefix query, escape quotes
const stmt = c.env.DB.prepare(`
  SELECT n.* FROM notes n
  JOIN notes_fts f ON n.rowid = f.rowid
  WHERE f.notes_fts MATCH ?
    AND n.user_id = ?
  ORDER BY f.rank
  LIMIT ? OFFSET ?
`)
const results = await stmt.bind(ftsQuery, userId, limit, offset).all()
```

For the count query (used for pagination `total`), use:
```sql
SELECT COUNT(*) as count FROM notes n
JOIN notes_fts f ON n.rowid = f.rowid
WHERE f.notes_fts MATCH ? AND n.user_id = ?
```

Fallback: If FTS5 MATCH throws an error (e.g., invalid query syntax), catch the error and fall back to `LIKE '%keyword%'` for robustness.

### 3. Document how to run the migration
Add a comment block at the top of the migration file explaining:
```sql
-- Run with: wrangler d1 migrations apply bookshelf-db --remote
-- Local dev:  wrangler d1 migrations apply bookshelf-db --local
```

## Constraints
- Do NOT modify the notes table schema itself (no column changes)
- The non-search `GET /api/notes` path (no search param) must remain unchanged
- `npx tsc --noEmit` must exit 0
- The FTS5 query must sanitize user input to prevent injection (escape double quotes)
- Handle the case where `notes_fts` table doesn't exist yet (migration not run) gracefully with try/catch fallback

## Verification
1. Show the complete migration SQL file
2. Show the diff for `worker/routes/notes.ts` (search section only)
3. Show the fallback error handling code
4. `npx tsc --noEmit` — exit 0
```

---

### 📋 프롬프트 3-B: Stats 전용 API 엔드포인트 도입

```
You are working on a Cloudflare Workers + Hono 4.x + D1 backend with a React 18 frontend.

## Task
Create a dedicated `GET /api/stats` endpoint that returns pre-aggregated statistics, replacing the current pattern of 4 separate client-side queries in StatsPage.

## Context — Read these files FIRST:
- `worker/index.ts` — router mounting
- `worker/routes/books.ts` — reference for auth middleware pattern
- `worker/auth.ts` — `authMiddleware` import
- `worker/types.ts` — Bindings, DbBook, DbReadingSession types
- `src/app/pages/StatsPage.tsx` — current 4-query pattern
- `src/hooks/useSessions.ts` and `src/hooks/useBooks.ts` — current hooks
- `src/lib/api.ts` — API module pattern (apiFetch, queryKeys)

## Implementation Requirements

### Part 1: Backend — `worker/routes/stats.ts` (NEW FILE)

Create a new Hono router with a single endpoint:

`GET /api/stats` — requires `authMiddleware`

Use `D1Database.batch()` to execute these queries atomically:

```sql
-- Query 1: Monthly completed books (last 12 months)
SELECT strftime('%Y-%m', finished_date) AS month, COUNT(*) AS count
FROM books
WHERE user_id = ? AND status = 'done' AND finished_date IS NOT NULL
GROUP BY month
ORDER BY month DESC
LIMIT 12

-- Query 2: Genre distribution (all statuses)
SELECT genre, COUNT(*) AS count
FROM books
WHERE user_id = ?
GROUP BY genre
ORDER BY count DESC

-- Query 3: Status counts
SELECT status, COUNT(*) AS count
FROM books
WHERE user_id = ?
GROUP BY status

-- Query 4: Recent session dates (last 365 days, for streak calculation)
SELECT DISTINCT session_date
FROM reading_sessions
WHERE user_id = ?
  AND session_date >= date('now', '-365 days')
ORDER BY session_date DESC

-- Query 5: Total pages read (all time)
SELECT SUM(pages_read) AS total_pages, SUM(duration_min) AS total_minutes
FROM reading_sessions
WHERE user_id = ?
```

Response format:
```typescript
{
  monthly: Array<{ month: string; count: number }>;      // "YYYY-MM"
  genres: Array<{ genre: string; count: number }>;
  statusCounts: { done: number; reading: number; wish: number };
  sessionDates: string[];      // ['YYYY-MM-DD', ...] for streak calc
  totals: { totalPages: number; totalMinutes: number };
}
```

Mount the router in `worker/index.ts`:
```typescript
import { statsRouter } from './routes/stats'
app.route('/api/stats', statsRouter)
```

### Part 2: Frontend — add `statsApi` and `useStats` hook

In `src/lib/api.ts`, add:
```typescript
// Add to queryKeys
queryKeys.stats = {
  all: ['stats'] as const,
  user: () => [...queryKeys.stats.all, 'user'] as const,
}

// Add API function
export const statsApi = {
  getStats: () => apiFetch<StatsResponse>('/api/stats'),
}

// Add StatsResponse type (match the backend response format above)
export interface StatsResponse { ... }
```

Create `src/hooks/useStats.ts` (NEW FILE):
```typescript
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats.user(),
    queryFn: () => statsApi.getStats(),
    staleTime: 5 * 60_000,  // 5 minutes
  })
}
```

### Part 3: Refactor `StatsPage.tsx`

Replace the 4 `useBooks` + `useSessions` calls with a single `useStats()` call.
- Map the new `StatsResponse` fields to the existing chart component props
- Keep all existing chart components (`MonthlyBarChart`, `GenreDonutChart`, `ReadingHeatmap`, etc.) unchanged — only change the data source
- Show a single loading state while `useStats` is pending (no per-section skeletons)
- Keep `calcReadingStreak` working with the `sessionDates` array (it already receives string dates)

## Constraints
- All existing chart components in `StatsComponents.tsx` must remain UNCHANGED
- The old `useBooks` and `useSessions` hooks must remain exported and functional (other pages still use them)
- `npx tsc --noEmit` must exit 0
- `npm run lint` must pass

## Verification
1. `npx tsc --noEmit` — exit 0
2. Show complete `worker/routes/stats.ts`
3. Show the StatsPage.tsx diff (data source section)
4. Confirm: how many API calls does StatsPage make after this change? (Answer: 1)
```

---

### 📋 프롬프트 3-C: Web Push Notification (독서 리마인더)

```
You are working on a PWA (BookShelf) using vite-plugin-pwa + Workbox on the frontend and Cloudflare Workers (Hono 4.x + KV) on the backend.

## Task
Implement Web Push Notifications for reading reminders. Users can opt-in to daily reading reminders.

## Context — Read these files FIRST:
- `vite.config.ts` — current vite-plugin-pwa config (Workbox generateSW mode)
- `worker/index.ts` — router mounting
- `worker/auth.ts` — authMiddleware
- `worker/types.ts` — Bindings (KV: KVNamespace)
- `src/app/App.tsx` — where to add push registration prompt
- `public/manifest.json` — current PWA manifest

## Implementation Requirements

### Part 1: VAPID Key Setup

1. Add to `worker/types.ts` Bindings:
```typescript
VAPID_PUBLIC_KEY: string;
VAPID_PRIVATE_KEY: string;
VAPID_SUBJECT: string;  // "mailto:admin@example.com"
```

2. Add to `wrangler.toml` vars section (VAPID_SUBJECT only — keys go to secrets):
```toml
VAPID_SUBJECT = "mailto:kordokrip@gmail.com"
```

3. Add to `.env.example` (create if not exists):
```
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
```

Note: Do NOT hardcode actual VAPID keys — use placeholder comments explaining:
"Generate with: npx web-push generate-vapid-keys"

### Part 2: Backend Push Routes — `worker/routes/push.ts` (NEW FILE)

```typescript
// POST /api/push/subscribe — save push subscription
// GET  /api/push/subscription — get current subscription status
// DELETE /api/push/subscribe — unsubscribe
```

- KV key format: `push:subscription:{userId}` with no expiry
- Store the full PushSubscription JSON object
- `POST /api/push/subscribe` body: `{ subscription: PushSubscriptionJSON }`
- Return `{ success: true }` on success
- All routes require `authMiddleware`

### Part 3: Frontend Push Hook — `src/hooks/usePushNotification.ts` (NEW FILE)

```typescript
export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)

  // On mount: check current permission and subscription state
  // subscribe(): requests permission, calls pushManager.subscribe(), POSTs to /api/push/subscribe
  // unsubscribe(): calls pushSubscription.unsubscribe(), DELETEs from /api/push/subscribe
  // isSupported: boolean — 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

  return { permission, isSubscribed, isSupported, subscribe, unsubscribe }
}
```

VAPID public key from `import.meta.env.VITE_VAPID_PUBLIC_KEY` — convert to Uint8Array using `urlBase64ToUint8Array` helper (include this utility function in the hook file).

### Part 4: Push Settings UI — add to existing settings area

Find the most appropriate existing settings location (check if there's a profile/settings page or section in `Root.tsx`, `TopBar.tsx`, or any settings modal). Add a push notification toggle that:
- Shows "독서 알림" label
- Uses a Toggle/Switch component (check existing ui components)
- Shows current subscription state
- Calls `subscribe()` or `unsubscribe()` on toggle

### Part 5: Update `vite.config.ts` — add push event handler to SW

In the Workbox config, add `additionalManifestEntries` or use `injectManifest` mode if needed.
Add a `push` event listener to the service worker using vite-plugin-pwa's `includeAssets` or by creating `src/sw-push.ts`:

```typescript
// This needs to go into the service worker
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? { title: 'BookShelf', body: '오늘 독서 기록을 남겨보세요! 📚' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: '/reading' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'))
})
```

Research the correct way to add custom SW code with vite-plugin-pwa's `generateSW` mode (use `additionalManifestEntries` + Workbox `importScripts`, or switch to `injectManifest` mode). Choose the approach that requires minimal config changes.

## Constraints
- Do NOT add `web-push` npm package to frontend (use native browser PushManager API)
- For backend push sending, note that Cloudflare Workers cannot use the `web-push` npm package — push sending from backend is OUT OF SCOPE for this task (only subscription management)
- `npx tsc --noEmit` must exit 0
- Service worker changes must not break existing Workbox precaching

## Verification
1. `npx tsc --noEmit` — exit 0
2. Show complete `worker/routes/push.ts`
3. Show complete `src/hooks/usePushNotification.ts`
4. Show the SW event listener integration approach chosen and why
5. List all files modified
```

---

### 📋 프롬프트 3-D: Background Sync — 오프라인 노트 저장 큐

```
You are working on a PWA called BookShelf using vite-plugin-pwa (Workbox generateSW mode) + TanStack Query v5.

## Task
Implement Background Sync for offline note creation: when the user creates a note while offline, queue it and automatically submit when connectivity is restored.

## Context — Read these files FIRST:
- `vite.config.ts` — current Workbox config
- `src/hooks/useNotes.ts` — current `useAddNote` mutation
- `src/lib/api.ts` — `notesApi.create()`, `ApiError` class, `apiFetch`
- `src/app/components/ui/Toast.tsx` — `useToast` hook API

## Implementation Requirements

### Part 1: Offline Queue using IndexedDB — `src/lib/offlineQueue.ts` (NEW FILE)

```typescript
// Simple IndexedDB wrapper for queuing failed requests
interface QueuedAction {
  id: string;           // crypto.randomUUID()
  type: 'addNote';
  data: CreateNoteInput;
  createdAt: string;    // ISO datetime
  retryCount: number;
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>): Promise<void>
export async function getQueuedActions(): Promise<QueuedAction[]>
export async function removeQueuedAction(id: string): Promise<void>
export async function clearQueue(): Promise<void>
```

Use native `indexedDB` API (no idb library) with database name `'bookshelf-offline-queue'`, version 1, object store `'actions'`.

### Part 2: Update `useAddNote` in `src/hooks/useNotes.ts`

```typescript
export function useAddNote() {
  const { showToast } = useToast()  // import and use existing toast hook

  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      if (!navigator.onLine) {
        await enqueueAction({ type: 'addNote', data })
        // Register Background Sync if supported
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          const sw = await navigator.serviceWorker.ready
          await sw.sync.register('sync-notes')
        }
        throw new OfflineQueuedError('노트가 오프라인 큐에 저장되었습니다. 연결 복구 시 자동으로 동기화됩니다.')
      }
      return notesApi.create(data)
    },
    onError: (error) => {
      if (error instanceof OfflineQueuedError) {
        showToast(error.message, 'info')  // NOT an error — show info toast
        return  // don't propagate as error
      }
      // existing error handling
    },
    // keep existing onSuccess invalidation
  })
}
```

Create `class OfflineQueuedError extends Error` in `src/lib/offlineQueue.ts`.

### Part 3: Sync Processing Hook — `src/hooks/useOfflineSync.ts` (NEW FILE)

```typescript
export function useOfflineSync() {
  // On mount, listen to 'online' window event
  // When online: process queue
  //   1. getQueuedActions()
  //   2. For each action: call notesApi.create(action.data)
  //   3. On success: removeQueuedAction(action.id), invalidate notes queries
  //   4. On all success: showToast(`${n}개의 노트가 동기화되었습니다.`, 'success')
  //   5. On failure: increment retryCount (up to 3), keep in queue
  // Return: { pendingCount: number }
}
```

Mount `useOfflineSync()` in `src/app/App.tsx`.

### Part 4: Service Worker Background Sync Handler

Add to Workbox SW config (research correct approach for vite-plugin-pwa generateSW):
```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(
      // Fetch the queue from IndexedDB and process
      // This runs in SW context — must use fetch() directly, not the React hooks
      processOfflineQueue()
    )
  }
})
```

Note: The SW cannot access React context or TanStack Query. The SW sync handler should call `fetch('/api/notes', {...})` directly with the token from a separate KV store or skip the SW handler and rely on the `online` event in `useOfflineSync` hook instead.

**Decision**: If implementing the SW sync handler is too complex, implement ONLY the `online` event-based sync in `useOfflineSync` and document why the SW handler was deferred.

## Constraints
- Do NOT add `idb` or any IndexedDB wrapper library — use native `indexedDB` API
- `npx tsc --noEmit` must exit 0
- The existing `useAddNote` mutation's `onSuccess` invalidation must still work for online submissions
- `OfflineQueuedError` must NOT trigger the global TanStack Query error state

## Verification
1. `npx tsc --noEmit` — exit 0
2. Show complete `src/lib/offlineQueue.ts`
3. Show the diff for `src/hooks/useNotes.ts`
4. Show complete `src/hooks/useOfflineSync.ts`
5. Explain the sync trigger strategy chosen (SW `sync` event vs `online` event) and why
```

---

## 사용 팁

### 프롬프트 실행 순서 및 의존성

```
Phase 1-A (Rate Limit)     ─── 독립 실행 가능
Phase 1-B (오프라인 Toast) ─── 독립 실행 가능
Phase 1-C (staleTime)      ─── 독립 실행 가능

Phase 2-A (타이머)         ─── 독립 실행 가능
Phase 2-B (스트릭)         ─── 독립 실행 가능
Phase 2-C (PBKDF2)         ─── 독립 실행 가능

Phase 3-A (FTS5)           ─── 독립 실행 가능
Phase 3-B (Stats API)      ─── Phase 2-B 완료 후 실행 권장 (calcReadingStreak 재사용)
Phase 3-C (Web Push)       ─── Phase 1-B 완료 후 실행 권장
Phase 3-D (Background Sync)─── Phase 1-B, 3-C 완료 후 실행 권장
```

### Claude Code 실행 방법

```bash
# 프로젝트 루트에서 Claude Code 시작
cd BookShelf_App
claude

# 프롬프트를 붙여넣은 후 Claude Code가 파일을 분석하고 구현합니다.
# 각 프롬프트 실행 후 반드시 검증:
npx tsc --noEmit
npm run lint
npm run build
```

### 각 구현 후 커밋 메시지 템플릿

```
# Phase 1
feat: add KV-based rate limiting middleware (login/search/ai routes)
feat: add offline/online status toast and PWA install banner
perf: tune QueryClient staleTime + add useBookCount selector hook

# Phase 2
feat: add reading timer with auto duration tracking (ReadingPage)
feat: add reading streak calculation and StreakCard (StatsPage)
security: migrate password hashing SHA-256 → PBKDF2 (600k iterations)

# Phase 3
perf: migrate notes search to FTS5 virtual table
perf: add GET /api/stats aggregation endpoint, refactor StatsPage
feat: implement Web Push notification subscription management
feat: add offline note queue with Background Sync via online event
```
