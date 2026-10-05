# 세션 리포트 — 무료 OpenRouter 모델로 전환 (2026-10-05, 42차)

> 요청: "OpenRouter 현재 남아 있는 무료 크레딧으로 쓸 수 있는 것을 정해서 설정". 현재 모델명은 `worker/lib/openrouter.ts`의 `OPENROUTER_MODEL`. 이전 유료 비교는 `docs/sessions/2026-10-04-ai-model-switch.md`.

## 배경
- 계정 상태(`GET /api/v1/key`, `GET /api/v1/credits`로 확인)
  - 구매 크레딧이 $0이라 유료 모델은 모두 402가 난다. 키 자체의 사용 한도($100)는 크레딧이 아니다.
  - 무료 모델은 `is_free_tier: true` 상태에서 **계정 전체 하루 50회**다. 남은 횟수는 응답의 `free_model_daily_requests`로 본다.
- 운영 영향: AI 컬렉션은 503, 인생책·추천 도서는 엄선 목록, 요약은 Workers AI 8B 폴백으로만 동작하고 있었다.

## 비교 (사용자 실데이터: 서재 76권)
요청 조건은 운영과 같다(인생책 6권·AI 컬렉션 프롬프트, 추론 끔).

| 모델 | 인생책 | AI 컬렉션 | 결과 |
|---|---|---|---|
| **qwen/qwen3.8-27b:free** (추론 none) | 7.7초, 6권(읽은 책 0, 근거 5/6 정확) | 12.6초, 6묶음, 76권 중 63권, 중복·잘못된 번호 0 | **채택** |
| google/gemma-4-31b-it:free, gemma-4-26b-a4b-it:free | 429 | 429 | 공용 풀 혼잡 |
| nvidia/nemotron-3-super·ultra:free | 12~74초 | 본문 없음 | 추론이 토큰 한도를 다 씀 |
| thinkingmachines/inkling:free | 403 | 403 | 에이전트 전용 |

Qwen 무료의 다른 작업(앱 프롬프트 그대로):
- 요약: 3.5초, 소개문 범위 안.
- 명문장: 0.9초. 원문과 가깝지만 맥락 설명이 틀릴 수 있다(카드의 안내 표시 유지).
- 장르: 0.6초.

인생책 품질은 Gemini보다 낮다. 저자가 틀린 책이 섞인다(예: 다른 저자 이름이 붙은 실존 책). 이런 책은 기존 실재 검증(카카오·네이버)에서 빠지고, 모자란 만큼 엄선 목록으로 채운다.

## 반영
- **모델**: `OPENROUTER_MODEL = 'qwen/qwen3.8-27b:free'`, 추론 `none`. 큐레이터(AI 컬렉션·인생책)도 같다. 유료로 되돌릴 모델은 `OPENROUTER_PAID_MODEL`(Gemini 3.8 Flash, 추론 `minimal`)로 남겼다.
- **JSON 모드**
  - Qwen 무료 공급자는 `response_format`이 없다. 보내면 404("No endpoints found that can handle the requested parameters")다.
  - `supportsJsonMode(model)`로 지원 모델에만 `response_format`·`require_parameters`를 보낸다.
  - 프롬프트가 'JSON만'을 요구하고 응답은 `extractJsonObject`로 꺼내므로 결과는 같다.
- **일일 예산**
  - 전체 `OPENROUTER_DAILY_BUDGET` 45회(계정 한도 50보다 작게), 오늘의 명문장 몫 `OPENROUTER_BACKGROUND_BUDGET` 15회로 낮췄다.
  - 예산을 넘기면 기존 폴백으로 넘어간다: 요약·추천은 Workers AI, 인생책은 엄선 목록, 명문장은 내 노트, AI 컬렉션은 안내 문구.
- **테스트**: JSON 모드 분기, 무료 예산 < 50.

## 알려진 한계
- 하루 50회는 **전 사용자 합산**이다. 캐시(요약 7일, 인생책·추천·컬렉션 24시간)로 버티지만 사용자가 늘면 오후에 폴백이 잦아진다.
- 무료 풀은 혼잡하면 429가 난다. 한 번 재시도한 뒤 폴백한다.
- **크레딧 충전 후 되돌리는 법**
  - `OPENROUTER_MODEL`을 `OPENROUTER_PAID_MODEL`로 바꾼다.
  - `OPENROUTER_REASONING_EFFORT`를 `'minimal'`로 바꾼다.
  - 예산을 다시 올린다(전체 1000·백그라운드 600 수준).
  - 큐레이터용 상위 모델은 `scripts/ai-bench/`로 다시 비교한다.
- 크레딧을 $10 이상 구매하면 무료 모델 한도도 하루 1000회로 늘어난다(OpenRouter 정책, 바뀔 수 있음).
