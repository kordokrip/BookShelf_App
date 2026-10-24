# BookShelf PWA — 보안 문서

> 최종 업데이트: 23차 세션

---

## 1. 인증 & 토큰

### JWT Access Token
- **알고리즘**: HS256
- **유효기간**: 2시간 (7200초)
- **저장 위치**: 클라이언트 `localStorage`
- **갱신**: Refresh Token으로 자동 갱신 (`POST /api/auth/refresh`)

### Refresh Token
- **형식**: UUID v4
- **유효기간**: 30일
- **저장 위치**: Cloudflare KV (`refresh:{token}` 키) + HTTP-only Secure 쿠키
- **쿠키 속성**: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`
- **다중 탭**: 동일 토큰 재사용 (삭제하지 않음)

### 휴면 계정 차단 (2026-10-05)
- 관리자가 회원을 휴면 처리하면(`PATCH /api/admin/users/:id/status`) `users.status='dormant'` + KV `user_dormant:{userId}`를 기록한다.
- 차단 지점: 이메일 로그인(비밀번호가 맞은 뒤에만 휴면 여부를 알려 계정 상태가 새지 않게), 구글 로그인(`/login?error=account_dormant`로 리다이렉트), 토큰 갱신, 그리고 `authMiddleware`(JWT 확인 뒤 KV 1회 조회 → 이미 로그인한 기기도 다음 요청부터 403 `ACCOUNT_DORMANT`). KV 조회 실패 시에는 막지 않는다(전체 장애 방지).
- 관리자 계정과 본인 계정은 휴면·삭제할 수 없다. 관리자 삭제(`DELETE /api/admin/users/:id`)는 대상 이메일 재입력이 필요하고, 본인 탈퇴와 같은 정리 로직(`purgeUserAccount`)을 쓴다. 모든 조치는 activity_logs에 남는다.

### 운영 메모
- 2026-10-05: 테스트 스크립트에 커밋돼 있던 관리자 비밀번호 기본값을 제거하고, 해당 관리자 계정의 비밀번호를 재설정했다(사용자 요청). 비밀번호는 문서·저장소에 적지 않는다.

---

## 2. 비밀번호 해싱

### PBKDF2 (현재)
- **알고리즘**: PBKDF2-SHA256
- **반복 횟수**: `worker/auth.ts`의 `PBKDF2_ITERATIONS` (2026-10-19에 10,000 → 100,000)
- **솔트**: 16바이트 랜덤
- **출력**: 256비트
- **저장 형식**: `pbkdf2:{반복 횟수}:{salt hex}:{hash hex}`. 예전 형식 `pbkdf2:{salt}:{hash}`는 10,000회로 만든 해시이며, 검증은 그대로 되고 **로그인에 성공하면 그 자리에서 현재 횟수로 다시 해시**한다(`needsRehash`).

#### 반복 횟수에 대한 설명
OWASP 권장치는 600,000+지만 **Cloudflare Workers 런타임의 PBKDF2 상한이 100,000이다(확인됨).** 2026-10-19 스테이징에 600,000을 배포하자 가입이 500 `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`로 실패했다. 로컬 workerd(`wrangler dev`)와 Node에는 이 상한이 없어 로컬 테스트로는 드러나지 않는다. `worker/__tests__/password.test.ts`의 "100,000 이하" 단언이 유일한 안전장치이니 지우지 말 것.

edge 실측(`wrangler tail`, 스테이징): 로그인 CPU 34~45ms(계정 단위 한도 포함, 기준 health 1~17ms).

더 강하게 하려면 반복 횟수 대신 **pepper**(Worker secret으로 HMAC을 한 번 더 거는 방식)를 검토한다. DB만 유출됐을 때 오프라인 대입을 막는 효과가 크다. 다만 secret을 잃으면 모든 비밀번호를 검증할 수 없게 된다.

**위험 완화 조치**:
- Rate Limiting 적용 (로그인 5회/분, 회원가입 3회/분) — D1 원자적 카운터로 실제로 걸린다(ADR-005, e2e TEST 81)
- 실패 시 동일 응답 메시지 (타이밍 공격 완화)
- constant-time 비교 사용

### 레거시 SHA-256
- 2026-10-19 운영·스테이징에 해당 해시가 0건임을 확인하고 검증 경로를 제거했다. 이 형식은 이제 로그인되지 않는다.

---

## 3. Rate Limiting

| 엔드포인트 | 제한 | 윈도우 |
|-----------|------|--------|
| POST /api/users/register | 3회 | 60초 |
| POST /api/users/login | 5회 | 60초 |
| POST /api/users/login (**계정 단위**, 실패만 셈) | 10회 실패 | 900초(15분) 고정 창 — 닿으면 맞는 비밀번호도 429 `login_locked`, 성공 시 기록 삭제. 키는 이메일 해시(`worker/lib/loginGuard.ts`) |
| DELETE /api/users/me | 5회 | 60초 |
| POST /api/auth/refresh | 10회 | 60초 |
| POST /api/ai/book-summary/:bookId (AI 요약) | 3회 | KST 하루(실제 생성 시에만 차감) |
| GET /api/ai/recommend | 10회 | 60초 |
| GET /api/ai/lifebooks | 3회 | 600초(10분) |
| POST /api/ai/ocr | 3회 | 60초 |
| (노트 AI 태깅, 내부 비동기) | 사용자별 50회 | 하루(KST) — `ai_tag_quota` D1 카운터(ADR-005), 플래그 `ai_tags` 사용자만 |
| GET /api/search/books | 20회(사용자별, 로그인 필수) | 60초 |
| GET /api/search/books/isbn | 10회(사용자별, 로그인 필수) | 60초 |
| GET /api/search/pagecount | 15회(사용자별, 로그인 필수) | 60초 |
| GET /api/discover | 30회 | 60초 |
| GET /api/discover/external | 20회 | 60초 |
| GET /api/discover/librarian | 20회 | 60초 |
| POST /api/groups/:id/messages | 30회 | 60초 |
| POST /api/groups/:id/meetings/:meetingId/feedbacks | 10회 | 60초 |
| POST /api/admin/seed-admins | 5회 | 60초 |
| POST /api/admin/messages | 30회 | 60초 |
| POST /api/push/subscribe | 5회 | 300초(5분) |
| POST /api/push/test | 3회 | 3600초(1시간) |
| POST /api/presence/heartbeat | 10회 | 60초 |
| POST /api/vitals | 60회 | 60초 |

> 전수 확인 기준: `worker/routes/*.ts` 전체에서 `rateLimit(` 사용처 grep (`worker/middleware/rateLimit.ts` 기반, 고정 창 — D1 `counters` 테이블 원자적 카운터, ADR-005. 예전 KV 카운터는 최종 일관성 때문에 한도가 걸리지 않았다. 카운터 저장소 오류 시에는 요청을 막지 않는다. 실동작은 e2e TEST 81이 확인)

---

## 4. 보안 헤더

모든 응답에 다음 헤더가 포함됩니다:

- `X-Frame-Options: DENY` — 클릭재킹 방지
- `X-Content-Type-Options: nosniff` — MIME 스니핑 방지
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — HTTPS 강제
- `Referrer-Policy: strict-origin-when-cross-origin` — Referer 정보 제한
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — 불필요 API 차단
- `X-Permitted-Cross-Domain-Policies: none` — Flash/PDF 크로스 도메인 방지

---

## 5. 시크릿 관리 & 로테이션

### 현재 시크릿 목록 (`wrangler secret`)

| 시크릿 | 용도 | 로테이션 주기 |
|--------|------|-------------|
| JWT_SECRET | JWT 서명 | 90일 권장 |
| GOOGLE_CLIENT_ID | Google OAuth | 필요 시 |
| GOOGLE_CLIENT_SECRET | Google OAuth | 90일 권장 |
| KAKAO_REST_API_KEY | 카카오 도서 검색 | 필요 시 |
| NAVER_CLIENT_ID | 네이버 도서 검색 | 필요 시 |
| NAVER_CLIENT_SECRET | 네이버 도서 검색 | 90일 권장 |
| ALLOWED_EMAILS | 가입 허용 이메일 | 필요 시 |
| OPENROUTER_API_KEY | AI 요약·인생책·오늘의 문장(OpenRouter 유료 모델 — 키 노출 시 크레딧 도용 위험). 등록 여부는 `npx wrangler secret list`(스테이징은 `--env staging`)로 확인. 로컬은 `.dev.vars` | 노출 시 즉시 |
| VAPID_PUBLIC_KEY | Web Push 공개키 | 변경 불필요 |
| VAPID_PRIVATE_KEY | Web Push 비밀키 | 변경 불필요 |

### 로테이션 절차

```bash
# 1. 새 시크릿 생성
openssl rand -base64 32

# 2. Cloudflare에 업데이트
wrangler secret put JWT_SECRET

# 3. 배포
npx wrangler deploy

# 4. 기존 JWT는 만료될 때까지 유효 (최대 2시간)
# 사용자는 Refresh Token으로 새 JWT를 발급받으므로 영향 최소화
```

**주의**: JWT_SECRET 변경 시 모든 기존 Access Token이 무효화됩니다. Refresh Token은 KV에 저장되므로 영향 없습니다.

---

## 6. CORS 정책

```
허용 오리진:
- http://localhost:*          (개발)
- https://bookshelf-api.kordokrip.workers.dev  (프로덕션)
- https://*.bookshelf-app.pages.dev            (프리뷰)

Credentials: true (HttpOnly 쿠키 지원)
```

---

## 7. 보안 연락처

보안 취약점을 발견하시면 프로젝트 관리자에게 직접 연락해주세요.
