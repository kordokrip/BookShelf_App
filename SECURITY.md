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

---

## 2. 비밀번호 해싱

### PBKDF2 (현재)
- **알고리즘**: PBKDF2-SHA256
- **반복 횟수**: 10,000
- **솔트**: 16바이트 랜덤
- **출력**: 256비트

#### 반복 횟수에 대한 설명
OWASP 권장 반복 횟수는 600,000+ 이지만, Cloudflare Workers의 CPU 시간 제한(10-50ms)으로 인해 10,000을 사용합니다.

| 반복 횟수 | 예상 소요 시간 | Workers 호환성 |
|-----------|--------------|---------------|
| 10,000 | ~5ms | ✅ 안정 |
| 100,000 | ~50ms | ⚠️ 간헐적 타임아웃 |
| 600,000 | ~300ms | ❌ CPU 제한 초과 |

**위험 완화 조치**:
- Rate Limiting 적용 (로그인 5회/분, 회원가입 3회/분)
- 실패 시 동일 응답 메시지 (타이밍 공격 완화)
- constant-time 비교 사용

### 레거시 SHA-256 (하위 호환)
- 기존 SHA-256 해시는 로그인 시 자동으로 PBKDF2로 마이그레이션됩니다.

---

## 3. Rate Limiting

| 엔드포인트 | 제한 | 윈도우 |
|-----------|------|--------|
| POST /api/users/register | 3회 | 60초 |
| POST /api/users/login | 5회 | 60초 |
| POST /api/auth/refresh | 10회 | 60초 |
| POST /api/ai/summarize | 5회 | 60초 |
| GET /api/ai/recommend | 10회 | 60초 |
| POST /api/groups/:id/messages | 10회 | 60초 |
| POST /api/groups/:id/meetings/:mid/feedback | 5회 | 60초 |

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
