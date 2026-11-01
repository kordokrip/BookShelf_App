# 보관 문서

현행 작업에 더는 필요 없는 옛 기록을 압축해 둔 곳이다. 현행 문서(`docs/README.md` 목록)에서 이 보관본의 내용을 기준으로 삼지 않는다.

## `legacy-docs-2026-11-02.tar.gz` (59차)

| 파일 | 내용 | 원래 위치 |
|---|---|---|
| `CHANGELOG-01-44.md` | 1~44차(2026-03 ~ 2026-10-10) 변경 요약 | `docs/CHANGELOG.md` 아래쪽 |
| `TRACE_MAP-8-bug-log-and-history.md` | BUG-001~015·UX-001·ADD-001(모두 해결)과 2026-03~04 갱신 이력 | `docs/TRACE_MAP.md` 8절·끝 |
| `sessions/2026-07-31-a11y-audit.md` | 1차 접근성 감사(이후 판독성 규칙은 `BookShelf_UI_UX.md` 1.1로 흡수) | `docs/sessions/` |
| `sessions/2026-08-15-public-pages-a11y-pwa.md` | 30차 공개 화면 접근성·PWA | 〃 |
| `sessions/2026-09-14-qa-bugfix-ai-library.md` | 31차 QA 버그 수정 | 〃 |
| `sessions/2026-09-27-renewal-onboarding-responsive.md` | 32차 리뉴얼·온보딩·반응형 | 〃 |
| `sessions/2026-09-28-pwa-native-design-upgrade.md` | 33차 PWA 네이티브 동작 | 〃 |
| `sessions/2026-10-03-full-ui-qa.md` | 35·36차 전체 화면 점검 | 〃 |
| `sessions/2026-10-03-ipad-ai-theme.md` | 34차 iPad·AI·테마 | 〃 |
| `sessions/2026-10-05-refactoring-requests.md` | 39~41차 수정 요청 | 〃 |
| `sessions/2026-10-10-verification-cleanup.md` | 44차 교차 검증·정리 | 〃 |

기준: 1~44차 기록. 45차 이후 리포트는 `docs/sessions/`에 그대로 둔다.

```bash
# 목록
tar -tzf docs/archive/legacy-docs-2026-11-02.tar.gz
# 풀기(저장소 밖 임시 폴더로)
mkdir -p /tmp/bookshelf-legacy && tar -xzf docs/archive/legacy-docs-2026-11-02.tar.gz -C /tmp/bookshelf-legacy
```

압축 전 원본은 git 기록에도 있다(`git log --diff-filter=D --name-only -- docs/sessions`).
