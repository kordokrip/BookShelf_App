# 프론트엔드 통합 테스트 체크리스트

> **목적:** 배포 전 실제 브라우저에서 전체 사용자 플로우를 검증  
> **환경:** 로컬 개발 서버 (`http://localhost:8787`)  
> **준비:** Chrome + DevTools Network 탭 + Application 탭 열고 진행

---

## 실행 방법

```bash
# 프론트엔드 빌드 + Worker 동시 실행
npm run build && npx wrangler dev

# 브라우저에서 http://localhost:8787 접속
# DevTools 열기: F12 → Network 탭 + Application 탭
# 아래 체크리스트를 순서대로 진행하며 [x]로 체크
```

---

## SCENARIO 1 — 신규 사용자 가입 플로우 (예상 15분)

### 1-1. 앱 최초 진입

- [ ] `http://localhost:8787` 접속 → `/splash` 리다이렉트 확인
- [ ] 로고 애니메이션 2.8초 재생 후 `/onboarding` 자동 이동 확인
- [ ] 이미 인증된 사용자라면 `/splash` → `/library` 즉시 이동 확인

### 1-2. 온보딩

- [ ] 3단계 슬라이드 (소개 → 장르 선택 → 독서 목표) 순서 진행
- [ ] 장르 선택 최소 1개 클릭 → 선택 표시 (배경색 변화)
- [ ] 독서 목표 숫자 입력 (기본값 12)
- [ ] 완료 버튼 → Network 탭에서 `PATCH /api/users/profile` 요청 확인
- [ ] ⚠️ 미인증 상태에서 저장 시도 → API 호출 없이 진행되어야 함 (로그인 전)
- [ ] `/login` 이동 확인

### 1-3. 회원가입

- [ ] SignUpPage: 4단계 (이름+이메일+비번 → 장르 → 목표 → 완료)
- [ ] 이름 1자 미만 입력 → 에러 메시지 표시
- [ ] 이메일 형식 오류 → 에러 메시지 표시
- [ ] 비밀번호 7자 이하 → 에러 메시지 표시
- [ ] 정상 입력 후 가입 버튼 → `POST /api/users/register` 요청 확인
- [ ] 성공 → DevTools Application > Local Storage에 `auth_token` 저장 확인
- [ ] `/library` 이동 확인

### 1-4. 로그아웃 & 재로그인

- [ ] 로그아웃 → Local Storage에서 `auth_token` 제거 확인
- [ ] `/login`으로 이동 확인
- [ ] 이메일/비밀번호 입력 → `POST /api/users/login` 요청 확인
- [ ] 성공 → `/library` 이동 확인

---

## SCENARIO 2 — 보호된 라우트 가드 (예상 5분)

- [ ] 미인증 상태에서 `/` 직접 접속 → `/login` 리다이렉트
- [ ] 미인증 상태에서 `/reading` 접속 → `/login` 리다이렉트
- [ ] 미인증 상태에서 `/stats` 접속 → `/login` 리다이렉트
- [ ] 유효하지 않은 토큰으로 접속 → `checkAuth` 실패 → `/login` 리다이렉트
- [ ] 토큰 만료 시 API 401 → 자동 로그아웃 처리 확인 (authStore의 ApiError 처리)

---

## SCENARIO 3 — 도서 등록 플로우 (예상 10분)

### 3-1. RegisterFlowPage (4단계)

- [ ] `/register-flow` 접속 확인
- [ ] STEP 1: 검색창에 "리액트" 입력 → 2자 이상 입력 시 `GET /api/search/books` 요청 확인
- [ ] 검색 결과 목록 표시 확인 (카카오 표지 이미지 로드)
- [ ] 책 선택 → STEP 2로 이동 (책 정보 자동 채워짐)
- [ ] STEP 2: 정보 편집 (제목, 저자, 페이지 수, 장르 선택)
- [ ] STEP 3: 상태 선택 (완독 / 읽는 중 / 위시)
  - [ ] 완독 선택 시 완독일 + 별점 입력 필드 표시 확인
- [ ] STEP 4: 커버 선택 (이모지 + 그라데이션)
- [ ] 추가 버튼 → `POST /api/books` 요청 확인
- [ ] `/library` 이동 + 추가된 책 목록 표시 확인

### 3-2. WishlistPage 검색 + 추가

- [ ] `/wishlist` → FAB(+) 클릭 → 검색 패널 열림 확인
- [ ] 검색어 입력 → 결과 표시 확인
- [ ] 추가 버튼 → `POST /api/books` (status: `'wish'`) 요청 확인
- [ ] 패널 닫기 → 위시리스트에 추가된 책 표시 확인

---

## SCENARIO 4 — 서재(LibraryPage) 기능 (예상 5분)

- [ ] `/` 접속 → `GET /api/books?status=done` 요청 확인
- [ ] 로딩 중 스켈레톤 UI 표시 확인
- [ ] 빈 서재: EmptyState 컴포넌트 표시 확인
- [ ] 책 있을 때: 그리드 또는 리스트 뷰 토글 동작
- [ ] 장르 필터 클릭 → 해당 장르 책만 표시 확인
- [ ] 정렬 변경 → 순서 재정렬 확인
- [ ] 책 카드 클릭 → `/book/:id`로 이동 확인

---

## SCENARIO 5 — 책 상세 + 노트 CRUD (예상 10분)

- [ ] `/book/:id` → `GET /api/books/:id`, `GET /api/notes?bookId=:id` 동시 요청 확인
- [ ] 책 표지, 진행률 바, 메모 목록 표시 확인

### 노트 추가

- [ ] 노트 추가 버튼 → Sheet 열림
- [ ] 메모 타입 선택 (메모 / 하이라이트 / 인용)
- [ ] 내용 입력 (1자 이상)
- [ ] 페이지 번호 입력 (선택)
- [ ] 저장 → `POST /api/notes` 요청 확인 → 목록 즉시 갱신 (invalidateQueries)

### 노트 편집

- [ ] 편집 아이콘 클릭 → 기존 내용 채워진 Sheet 열림
- [ ] 수정 저장 → `PUT /api/notes/:id` 요청 확인

### 노트 삭제

- [ ] 삭제 아이콘 클릭 → AlertDialog 표시
- [ ] 확인 → `DELETE /api/notes/:id` 요청 확인 → 목록에서 제거 확인

### R2 표지 이미지 업로드

- [ ] 표지 클릭 → 파일 선택 다이얼로그
- [ ] 파일 선택 → `POST /api/books/:id/cover` 요청 확인
- [ ] 업로드 완료 후 표지 이미지 변경 확인

---

## SCENARIO 6 — 독서 타이머 (ReadingPage) (예상 5분)

- [ ] `/reading` → `GET /api/books?status=reading` 요청 확인
- [ ] 읽는 중 책 없을 때: 빈 상태 UI 표시
- [ ] 책 있을 때: 현재 페이지, 전체 페이지, 진행률 표시 확인

### 페이지 업데이트

- [ ] 페이지 업데이트 버튼 → Sheet 열림
- [ ] 페이지 번호 입력 → `PUT /api/books/:id` 요청 확인

### 세션 기록

- [ ] 세션 기록 → `POST /api/sessions` 요청 확인
- [ ] 응답의 `new_current_page` 값이 `books.current_page`에 반영되는지 확인

---

## SCENARIO 7 — 통계(StatsPage) lazy loading (예상 5분)

- [ ] `/stats` 접속 → Network 탭에서 `vendor-charts-*.js` 로드 확인 (lazy chunk)
- [ ] 다른 페이지(`/`, `/reading` 등)에서는 `vendor-charts` 미로드 확인
- [ ] `GET /api/books` (×3: done / reading / wish), `GET /api/sessions` 동시 요청 확인
- [ ] Recharts 바 차트: 월별 독서 기록 표시
- [ ] 도넛 차트: 장르별 분포 표시
- [ ] 히트맵: 독서 연속 기록 표시

---

## SCENARIO 8 — 노트 검색(NotesSearchPage) (예상 5분)

- [ ] `/notes-search` → 검색창 포커스 자동 설정 확인
- [ ] 검색어 입력 (300ms debounce) → `GET /api/notes?search=xxx` 요청 확인
- [ ] 타입 필터 탭: [전체] [메모] [하이라이트] [인용] 클릭 동작
- [ ] 검색 결과: 검색어 하이라이트 표시 확인
- [ ] 편집 / 삭제 버튼 동작 확인

---

## SCENARIO 9 — 카카오 OAuth 로그인 (예상 5분)

- [ ] `/login` → 카카오로 로그인 버튼 클릭
- [ ] `accounts.kakao.com` 리다이렉트 확인
- [ ] 로그인 완료 → `/auth/kakao?token=xxx` 리다이렉트
- [ ] KakaoCallbackPage: "로그인 처리 중" 로딩 표시 확인
- [ ] `authStore.loginWithKakao(token)` 호출 확인
- [ ] Local Storage `auth_token` 저장 확인
- [ ] `/library` 이동 확인

---

## SCENARIO 10 — 오류 처리 & 에러 바운더리 (예상 5분)

- [ ] 잘못된 책 ID: `/book/invalid-uuid` → 404 표시 확인
- [ ] 네트워크 오프라인 → PWA 캐시에서 이전 데이터 표시 (Workbox NetworkFirst)
- [ ] API 500 오류 → ErrorState 컴포넌트 표시 + 재시도 버튼 확인
- [ ] 만료된 토큰으로 요청 → 401 → 자동 로그아웃 처리 확인

---

## 완료 기준

| 시나리오 | 항목 수 | 통과 | 미통과 |
|----------|---------|------|--------|
| 1 — 신규 사용자 가입 플로우 | 16 | | |
| 2 — 보호된 라우트 가드 | 5 | | |
| 3 — 도서 등록 플로우 | 14 | | |
| 4 — 서재(LibraryPage) 기능 | 7 | | |
| 5 — 책 상세 + 노트 CRUD | 12 | | |
| 6 — 독서 타이머 | 7 | | |
| 7 — 통계 lazy loading | 7 | | |
| 8 — 노트 검색 | 5 | | |
| 9 — 카카오 OAuth | 7 | | |
| 10 — 오류 처리 | 4 | | |
| **합계** | **84** | | |

> ✅ **전체 항목 통과 시 → PHASE 5 (성능·PWA 검증) 진행**  
> ❌ **미통과 항목 발생 시 → 해당 시나리오의 라우트·훅·API 재확인**
