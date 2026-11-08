# Navy22-anchor.github.io

Hanlog — Vite + React로 만든 개인 사이트.

## 실행

```bash
npm install
npm run dev
```

## 구조

- `src/App.jsx` — 랜딩 첫 화면 (Figma `Landing first screen (1920)`)
- `src/components/ProjectStrip.jsx` — 가운데 세로 작업 목록 (무한 스크롤, 브라켓 사이로 스냅)
- `src/components/DynamicIsland.jsx` — 상단 음악 위젯 (클릭 시 재생/일시정지)
- `src/data/projects.js` — 작업 목록·카테고리 데이터
- `public/fonts/` — S-Core Dream (한글)

`main`에 푸시하면 `.github/workflows/deploy.yml`이 빌드해서 GitHub Pages에 배포합니다.
(저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.)
