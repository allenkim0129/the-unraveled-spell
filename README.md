# Spellweaver's Paradox

멈춰 버린 마법 학원에서 마법 실을 편집하고 시간을 다시 엮는 **한국어·영어 지원 버드아이 2.5D 웹 프로토타입**입니다. 제공된 GDD를 기반으로 제작했으며, 현재 플레이 범위는 작은 관측실 하나입니다. 전체 게임을 방 탈출이나 디펜스로 변경한 것은 아닙니다.

## 플레이

GitHub Pages 주소: https://allenkim0129.github.io/the-unraveled-spell/

배포 워크플로가 성공해야 위 주소에서 플레이할 수 있습니다. WebGL을 지원하는 최신 데스크톱/모바일 브라우저가 필요합니다. 별도 설치나 계정은 필요하지 않습니다.

시작 안내창과 화면 상단의 **한국어 / English** 선택기로 언어를 전환할 수 있습니다. 안내, 버튼, 목표, 3D 공간 표지, 퍼즐 결과와 오류 안내가 함께 바뀌며 진행 상태는 유지됩니다. 언어 선택만 브라우저에 저장합니다. 저장소 접근이 제한되어도 현재 플레이의 언어 전환은 작동합니다.

에테르 시야를 켜고 시전자에게 다가가 마법 편집을 여세요. 실 절단과 대상 변경은 각각 실 1개를 사용하며, 초기 용량은 3개입니다. 같은 대상 선택에는 비용이 들지 않습니다. 끊어진 실을 복원하려면 편집을 취소하세요.

고정된 비스듬한 정사영 시점으로 방과 마법의 연결을 한눈에 보여줍니다. 시점 회전이나 캐릭터 추적 카메라는 없으며, 방향키와 이동 패드의 위/아래/좌/우가 화면의 방향과 일치합니다. 화면 크기 변경 시 방 전체가 조작 버튼에 가려지지 않도록 배치를 조정합니다.

시간을 재개하면 이동과 편집이 멈추고 수정한 마법이 **5초** 동안 실행됩니다. 다시 동결되면 결과를 관찰하고 이동할 수 있습니다. 각 시도는 한 번만 실행할 수 있으며, 초기화는 시도 중 언제든 사용할 수 있습니다. 조작법을 열거나 다른 탭으로 이동하면 실행이 일시 정지됩니다.

안전한 다리를 만든 뒤 건너편 출구에 도달하면 완료입니다. 실패해도 방 전체 초기화로 무제한 재시도할 수 있습니다. 초기화는 위치, 마법 연결, 남은 실, 시간, 방의 변화와 완료 상태를 모두 되돌립니다.

| 행동 | 데스크톱 | 모바일 |
| --- | --- | --- |
| 이동 | WASD / 방향키 | 왼쪽 이동 패드 |
| 에테르 시야 | E / 화면 버튼 | 에테르 시야 버튼 |
| 가까운 마법 편집 | F / 화면 버튼 | 마법 편집 버튼 |
| 시간 재개 | Space / 화면 버튼 | 5초 재개 버튼 |
| 마지막 편집 취소 | Z / 화면 버튼 | 편집 취소 버튼 |
| 방 초기화 | R / 화면 버튼 | 초기화 버튼 |
| 조작법 | H / 화면 버튼 | 조작법 버튼 |

<details>
<summary>첫 방의 해법 (스포일러)</summary>

주황색 힘/화염 마법의 실을 끊어 다리 고정점을 보호하고, 파란색 운동 마법의 대상을 잔해에서 다리 구동 장치로 바꾸세요. 시간을 재개한 뒤 다리 중앙을 건너 빛나는 출구에 도달하세요. 주황 마법을 잔해로 돌리는 대안도 가능합니다.

</details>

## 로컬 개발

Node.js 24 이상을 권장합니다.

```bash
npm ci
npm run dev
```

개발 서버: http://localhost:5173/the-unraveled-spell/

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

프로덕션 결과물은 `dist/`에 생성됩니다. `vite.config.ts`의 `base`는 이 저장소의 Pages 하위 경로를 사용합니다. 다른 저장소나 커스텀 도메인으로 옮기면 이 값을 바꾸세요.

브라우저 회귀 검사에는 데스크톱과 실제 터치 입력을 에뮬레이션하는 모바일 Chromium이 포함됩니다.

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Linux에서 브라우저 시스템 라이브러리가 없다면 `npx playwright install --with-deps chromium`을 사용하세요.

## 배포

공개 저장소의 **Settings → Pages → Source → GitHub Actions**를 선택하세요. `.github/workflows/deploy-pages.yml`은 `main`과 초기 프로토타입 브랜치 `allenkim0129-cautious-adventure`의 push에서 상태 테스트와 빌드를 수행하고 Pages에 배포합니다. 기본 브랜치에 워크플로가 등록된 이후에는 Actions에서 수동 실행도 가능합니다.

현재 프로토타입 브랜치는 이 첫 버전을 플레이할 수 있도록 배포 대상으로 포함했습니다. `main`으로 승격한 뒤에는 해당 브랜치 항목을 제거하면 됩니다. `github-pages` 환경의 배포 브랜치 정책을 사용하는 경우 배포 대상 브랜치를 허용해야 합니다.

Pages가 꺼진 상태에서 첫 실행이 실패했다면, 저장소 관리자가 위 Source 설정을 적용한 뒤 **Actions → 실패한 배포 실행 → Re-run all jobs**를 선택하세요. GitHub 통합으로 Pages 설정 시 `403 Resource not accessible by integration`이 발생해도 관리자 계정으로 저장소 설정에서 활성화할 수 있습니다.

## 구성과 범위

TypeScript + Vite + Three.js를 사용합니다. `src/game/state.ts`는 편집 비용, 취소, 시간 상태와 방의 결과를 관리하고, `scene.ts`는 공간/이동/시각화를, `view.ts`는 고정 정사영 카메라와 화면 맞춤을, `input.ts`는 키보드와 터치 이동 입력을 처리합니다. `i18n.ts`에 두 언어의 문구가 모여 있고, `ui.ts`와 `main.ts`가 인터페이스와 게임 루프를 연결합니다.

방은 원본 절차적 도형이며, 기존 세 캐릭터는 Canvas로 그린 임시 스프라이트 시트를 사용합니다. 외부 이미지, 외부 폰트 요청, 백엔드, 게임 진행 저장 기능은 없습니다. 마법의 결과는 퍼즐용 결정적 시뮬레이션으로 계산하며, 범용 물리 엔진을 사용하지 않습니다.

### 향후 캐릭터 애니메이션 교체

`src/game/character.ts`의 `CharacterSprite`는 2D 시트를 카메라와 평행한 평면에 그립니다. 평면의 아래 중앙이 캐릭터의 발 위치이며 바닥 그림자와 함께 이동합니다. 알파 테스트와 깊이 테스트/쓰기를 사용해 투명한 여백은 가리지 않고, 캐릭터는 실제 3D 장치의 앞뒤에 따라 가려집니다. 캐릭터 자체를 회전시키지 않고 방향별 그림을 전환합니다.

현재 시트 규격은 **4열 × 4행**의 동일 크기 셀입니다. 행은 위부터 아래를 향함 / 왼쪽 / 오른쪽 / 위쪽이며, 열 0은 대기, 열 1–3은 걷기 프레임입니다. 각 프레임의 발 접지점은 셀 아래 중앙에 맞추세요. `CharacterSprite`에 전달하는 텍스처를 완성된 시트로 교체하면 이동·퍼즐 규칙을 바꾸지 않고 아트를 추가할 수 있습니다. `height` 인자로 화면 속 크기를 조절합니다.

걷기는 실제 이동 거리에 따라 재생하고 벽에 막히거나 대기·시간 실행 중에는 대기 프레임을 사용합니다. 동작 줄이기 설정에서는 걷기 애니메이션을 생략합니다. 현재 그림은 구조 검증용 임시 아트이며 최종 캐릭터 아트나 추가 캐릭터를 제작한 것은 아닙니다.

### English quick start

Use the **English** selector on the welcome screen or in the header. Switching languages does not reset your puzzle progress. The fixed oblique bird-eye orthographic view shows the whole room; no camera control is needed. On desktop, move with WASD / arrow keys in screen directions. On mobile, use the left movement pad and action buttons. Characters use replaceable, foot-anchored 2D animation sheets within the 3D scene.

Enable **Aether Sight**, approach a caster, and edit its thread. Cutting and redirection each cost one of your three stitches; undo refunds the last edit before execution. **Weave 5 seconds** to observe the outcome, then cross a safe bridge to the exit. **Reset** restores the entire room for unlimited retries. This first-room prototype includes cutting and redirection; elemental splicing, Backlash, and the full RPG are not yet implemented.

원소 접합, Arcane Backlash, 확장 도구, RPG 성장, 여러 방과 전체 미스터리 서사는 후속 범위입니다. 현재의 실 용량, 시간과 퍼즐 배치는 플레이 피드백으로 조정할 프로토타입 수치입니다.
