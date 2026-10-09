# AI 모델 비교 스크립트

OpenRouter 모델을 바꾸기 전, 실제 앱 프롬프트(합쳐진 추천[구 인생책]·책 분석·오늘의 명문장·장르 추천)로 응답 시간·비용·JSON 유효성을 비교한다.
2026-10-04 모델 교체 근거: `docs/sessions/2026-10-04-ai-model-switch.md`.

```bash
# 1) 워커 코드의 프롬프트를 JSON으로 뽑는다
npx esbuild scripts/ai-bench/dumpPrompts.ts --bundle --platform=node --format=cjs --outfile=/tmp/dumpPrompts.cjs
node /tmp/dumpPrompts.cjs > /tmp/prompts.json

# 2) 모델 비교 (키 값은 출력하지 않는다. 모델 뒤 @none/@minimal은 추론 정도)
KEY=$(grep '^VITE_OPENROUTER_API_KEY=' .env.local | cut -d= -f2- | tr -d '"') \
KAKAO=$(grep '^KAKAO_REST_API_KEY=' .dev.vars | cut -d= -f2- | tr -d '"') \
PROMPTS=/tmp/prompts.json \
python3 scripts/ai-bench/bench.py "google/gemini-3.8-flash@minimal,google/gemma-3-27b-it"
```

출력: 작업별 응답 시간, 추천 후보 중 이미 읽은 책·카카오에서 확인되는 책 수(3회), 호출당 비용. 결과 본문은 `/tmp/ai-bench-out.json`.
비용이 들므로(모델당 수 센트 이하) 필요할 때만 실행한다.
