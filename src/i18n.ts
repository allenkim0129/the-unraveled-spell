export type Language = 'ko' | 'en';

const messages = {
  academy: ['파열된 아테네움', 'THE SHATTERED ATHENAEUM'],
  prototype: ['웹 프로토타입 01', 'WEB PROTOTYPE 01'],
  language: ['언어', 'Language'],
  help: ['조작법', 'Help'],
  helpAria: ['조작법 열기', 'Open instructions'],
  reset: ['초기화', 'Reset'],
  playArea: ['퍼즐 플레이 영역', 'Puzzle play area'],
  cameraAria: ['3D 마법 학원. 이동 버튼이나 키보드로 탐험하고 화면을 드래그해 시점을 돌리세요.', '3D magical academy. Explore using movement controls and drag the scene to rotate the camera.'],
  chamber: ['관측실 01', 'CHAMBER 01'],
  roomTitle: ['끊어진 시간의 다리', 'The Broken Crossing'],
  stitches: ['남은 실', 'Stitches left'],
  timeState: ['시간 상태', 'Timeline'],
  phaseEditing: ['동결 · 편집', 'Frozen · edit'],
  phaseExecuting: ['시간 재개', 'Time flowing'],
  phaseResolved: ['다시 동결', 'Frozen again'],
  phaseWon: ['복구 완료', 'Restored'],
  weavingTime: ['시간을 다시 엮는 중', 'Weaving time forward'],
  seconds: ['{value}초', '{value}s'],
  progressAria: ['시간 재개 진행', 'Execution progress'],
  sightBadge: ['◈ 에테르 시야 · 마법 실을 볼 수 있어요', '◈ Aether Sight · magic threads revealed'],
  restored: ['시간 복구 완료', 'TIMELINE RESTORED'],
  successTitle: ['첫 번째 매듭이 풀렸습니다.', 'The first knot is undone.'],
  successStory: ['하지만 이 동결은 사고를 막기 위한 것이었을까요,<br />무언가를 가두기 위한 것이었을까요?', 'Was time frozen to prevent a catastrophe,<br />or to keep something imprisoned?'],
  replay: ['다시 실험하기', 'Experiment again'],
  scopeEnd: ['현재 프로토타입은 이 방까지 플레이할 수 있어요.', 'This room is the end of the current prototype.'],
  move: ['이동', 'Move'],
  joystickAria: ['터치 이동 패드', 'Touch movement pad'],
  desktopHint: ['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동<br />화면 드래그 · 시점 회전', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move<br />Drag scene · rotate camera'],
  sight: ['◈ 에테르 시야', '◈ Aether Sight'],
  approach: ['마법에 다가가세요', 'Approach a spell'],
  interactForce: ['주황 마법 편집 · F', 'Edit orange spell · F'],
  interactMotion: ['파랑 마법 편집 · F', 'Edit blue spell · F'],
  enableSight: ['먼저 에테르 시야 켜기', 'Enable Aether Sight first'],
  cannotEditResolved: ['실행 후 편집 불가', 'Editing locked'],
  execute: ['▷ 5초 재개', '▷ Weave 5 seconds'],
  executingButton: ['시간 재개 중…', 'Time is flowing…'],
  resolvedButton: ['초기화 후 재실행', 'Reset to try again'],
  cameraHint: ['화면의 빈 곳을 드래그하면 시점이 회전해요', 'Drag an empty part of the scene to rotate the camera'],
  sidebarAria: ['목표와 마법 편집', 'Objective and spell editing'],
  objective: ['목표', 'YOUR OBJECTIVE'],
  missionTitle: ['마법을 바꾸고,<br />결과를 바꾸세요.', 'Change the spell.<br />Change the outcome.'],
  missionBody: ['멈춰 버린 학원의 다리가 끊어졌습니다. 마법이 향하는 곳을 바꾸면 건너갈 수 있을지도 모릅니다.', 'The academy crossing is broken, suspended in time. Change where the magic goes, and you may find a way across.'],
  observe: ['관찰', 'Observe'],
  observeBody: ['에테르 시야로 두 마법의 실과 대상을 확인하세요.', 'Reveal both spells and their targets with Aether Sight.'],
  edit: ['편집', 'Edit'],
  editBody: ['시전자에게 다가가 실을 끊거나 대상을 변경하세요.', 'Approach a caster. Cut a thread or redirect it to another target.'],
  execution: ['실행', 'Execute'],
  executionBody: ['5초간 시간을 재개하고, 안전한 다리를 건너 출구로 가세요.', 'Resume time for 5 seconds, then cross the safe bridge to the exit.'],
  editor: ['마법 편집', 'SPELL EDITOR'],
  closeEditor: ['마법 편집 닫기', 'Close spell editor'],
  cut: ['✂ 실 절단 · 실 1개', '✂ Cut thread · 1 stitch'],
  editorNote: ['대상 변경도 실 1개를 사용해요.<br /> 시간 재개 전에는 편집을 취소할 수 있어요.', 'Redirection also costs 1 stitch.<br /> Undo edits before you resume time.'],
  undo: ['↶ 편집 취소', '↶ Undo edit'],
  forceLegend: ['힘 / 화염', 'Force / Fire'],
  motionLegend: ['운동', 'Motion'],
  scopeNote: ['절단 + 대상 변경 실험<br />원소 접합과 반동은 다음 단계', 'Cutting + redirection experiment<br />Splicing and Backlash come later'],
  introTitle: ['시간은 멈췄지만,<br /><em>마법은 고칠 수 있습니다.</em>', 'Time stands still.<br /><em>Magic can still be mended.</em>'],
  introLead: ['폭발 직전의 마법 학원. 당신은 시전 중인 마법의 실을<br class="desktop-break" /> 풀고, 다시 엮을 수 있는 유일한 직조사입니다.', 'An academy frozen on the brink of disaster.<br class="desktop-break" /> You alone can unravel and re-stitch its suspended spells.'],
  introSight: ['에테르 시야', 'Aether Sight'],
  introSightBody: ['주황과 파랑 마법의<br />연결을 드러내세요.', 'Reveal the connections<br />of orange and blue spells.'],
  introEdit: ['절단 / 대상 변경', 'Cut / Redirect'],
  introEditBody: ['시전자 가까이에서<br />마법 실을 편집하세요.', 'Approach a caster<br />to edit a magic thread.'],
  introExecute: ['5초 시간 재개', 'Weave 5 seconds'],
  introExecuteBody: ['결과를 관찰하고<br />안전한 다리를 건너세요.', 'Observe the outcome.<br />Cross the safe bridge.'],
  introControls: ['<strong>데스크톱</strong> WASD / 방향키 이동 · 화면 드래그 시점 회전<br />E 시야 · F 편집 · Space 실행 · Z 편집 취소 · R 초기화<br /><strong>모바일</strong> 왼쪽 패드 이동 · 화면 드래그 시점 회전 · 오른쪽 버튼 조작', '<strong>Desktop</strong> WASD / arrows to move · drag scene to rotate camera<br />E sight · F edit · Space execute · Z undo · R reset<br /><strong>Mobile</strong> Left pad to move · drag scene to rotate · right buttons for actions'],
  retryNote: ['편집용 실은 3개. 실패해도 초기화로 무제한 재시도할 수 있어요.<br />실행 중 이동은 잠시 멈추고, 5초 뒤 다시 움직일 수 있어요.', 'You have 3 stitches. Reset for unlimited retries.<br />Movement pauses during execution, then resumes after 5 seconds.'],
  enter: ['관측실 들어가기 →', 'Enter the chamber →'],
  return: ['관측실로 돌아가기 →', 'Return to the chamber →'],
  introFootnote: ['첫 방 프로토타입 · 헤드폰 없이도 모든 정보를 확인할 수 있어요', 'First-room prototype · all feedback is available without audio'],
  fatalTitle: ['게임 화면을 열 수 없어요.', 'The game cannot be displayed.'],
  fatalHelp: ['WebGL을 지원하는 최신 브라우저와 하드웨어 가속을 확인한 뒤 페이지를 새로고침하세요.', 'Use a recent WebGL-capable browser with hardware acceleration, then reload the page.'],
  errorCanvas: ['공간 안내를 그릴 수 없어요. Canvas 2D를 지원하는 브라우저를 사용하세요.', 'Spatial labels could not be rendered. Use a browser with Canvas 2D support.'],
  errorWebGL: ['3D 렌더러를 시작할 수 없어요. WebGL 지원과 하드웨어 가속을 확인하세요.', 'The 3D renderer could not start. Check WebGL support and hardware acceleration.'],
  errorRendering: ['3D 화면에 오류가 발생했어요. 페이지를 새로고침해 다시 시도하세요.', 'A 3D rendering error occurred. Reload the page to try again.'],
  errorContext: ['그래픽 연결이 중단됐어요. 페이지를 새로고침해 다시 시작하세요.', 'The graphics context was lost. Reload the page to restart.'],
  forceName: ['주황 · 힘 / 화염', 'Orange · Force / Fire'],
  motionName: ['파랑 · 운동', 'Blue · Motion'],
  anchorName: ['다리 고정점', 'Bridge anchor'],
  debrisName: ['떠 있는 잔해', 'Floating debris'],
  mechanismName: ['다리 구동 장치', 'Bridge mechanism'],
  exitName: ['출구 · 시간을 복구하라', 'Exit · Restore the timeline'],
  roomName: ['파열된 아테네움 · 제1 관측실', 'Shattered Athenaeum · Chamber 01'],
  currentConnection: ['현재 연결 → {target}', 'Connected to → {target}'],
  cutConnection: ['실이 끊어졌어요 · 이 마법은 실행되지 않아요', 'Thread cut · this spell will not execute'],
  targetCurrent: ['● {target} · 현재', '● {target} · current'],
  targetCost: ['↗ {target} · 실 1개', '↗ {target} · 1 stitch'],
  errorPhase: ['실행한 방은 편집할 수 없어요. 방을 초기화해 다시 시도하세요.', 'This attempt has already executed. Reset the room to edit again.'],
  errorStitches: ['남은 실이 없어요. 편집 취소로 실을 되돌려 받으세요.', 'No stitches remain. Undo an edit to refund a stitch.'],
  errorAlreadyCut: ['이미 끊어진 실이에요. 편집 취소로 복원할 수 있어요.', 'This thread is already cut. Undo the edit to restore it.'],
  errorInvalidTarget: ['이 마법을 연결할 수 없는 대상이에요.', 'This spell cannot connect to that target.'],
  errorCutRedirect: ['끊어진 실은 대상 변경을 할 수 없어요. 먼저 편집을 취소하세요.', 'A cut thread cannot be redirected. Undo the cut first.'],
  errorSameTarget: ['이미 이 대상에 연결되어 있어요. 실은 소비되지 않았어요.', 'Already connected to this target. No stitch was consumed.'],
  errorUndoPhase: ['시간을 재개하기 전의 편집만 취소할 수 있어요.', 'Edits can only be undone before time resumes.'],
  errorNoUndo: ['취소할 편집이 없어요.', 'There are no edits to undo.'],
  errorAlreadyExecuted: ['이 시도는 이미 실행했어요. 방을 초기화하면 다시 실행할 수 있어요.', 'This attempt has already executed. Reset the room to try again.'],
  outcomeDefault: ['마법을 관찰하고 실을 편집한 뒤, 5초 동안 시간을 재개하세요.', 'Observe the spells, edit their threads, then resume time for 5 seconds.'],
  outcomeWon: ['첫 방의 시간을 복구했어요. 학원 깊은 곳에서 무언가가 깨어납니다…', 'The first room is restored. Something stirs deep within the academy…'],
  outcomeSafe: ['다리가 안전하게 연결됐어요! 건너편 빛나는 출구로 이동하세요.', 'The bridge is safe! Cross to the glowing exit on the far side.'],
  outcomeBothFailed: ['화염이 고정점을 파괴했고, 운동 마법은 잔해만 움직였어요. 초기화해 두 실을 살펴보세요.', 'Fire destroyed the anchor, and motion only moved debris. Reset and inspect both threads.'],
  outcomeAnchorFailed: ['다리는 올라왔지만 화염이 고정점을 파괴했어요. 초기화해 주황 실을 편집하세요.', 'The bridge rose, but fire destroyed its anchor. Reset and edit the orange thread.'],
  outcomeBridgeFailed: ['고정점은 안전하지만 다리가 움직이지 않았어요. 초기화해 파란 실의 대상을 바꿔보세요.', 'The anchor is safe, but the bridge did not move. Reset and redirect the blue thread.'],
  notifyReset: ['방을 처음 상태로 되돌렸어요. 다른 연결도 실험해 보세요.', 'Room reset. Try experimenting with different connections.'],
  notifySightFirst: ['에테르 시야를 켜면 마법 실을 편집할 수 있어요.', 'Enable Aether Sight to edit magic threads.'],
  notifyApproach: ['주황 또는 파랑 시전자에게 더 가까이 다가가세요.', 'Move closer to the orange or blue caster.'],
  notifyExecuting: ['5초간 시간이 흐릅니다. 수정한 마법의 결과를 관찰하세요.', 'Time flows for 5 seconds. Watch your edited spells play out.'],
  notifyUndo: ['마지막 편집을 취소하고 실을 되돌려 받았어요.', 'Last edit undone. Its stitch has been refunded.'],
  notifyRedirect: ['{target}로 마법을 다시 연결했어요.', 'Spell redirected to {target}.'],
  notifyCut: ['실을 끊었어요. 이 마법은 시간이 흘러도 발동하지 않아요.', 'Thread cut. This spell will not fire when time resumes.'],
  notifyStart: ['두 시전자 가까이에서 마법을 관찰하세요. 주황은 힘, 파랑은 운동 마법이에요.', 'Approach the two casters. Orange is force magic; blue is motion magic.'],
} satisfies Record<string, readonly [string, string]>;

export type MessageKey = keyof typeof messages;
let language: Language = 'ko';

export function getLanguage(): Language {
  return language;
}

export function setLanguage(value: Language): void {
  language = value;
}

export function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(messages, value);
}

export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  return messages[key][language === 'ko' ? 0 : 1].replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token);
}

export function translateMarkup(): void {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n], [data-i18n-html], [data-i18n-aria]')) {
    const textKey = element.dataset.i18n;
    const htmlKey = element.dataset.i18nHtml;
    const ariaKey = element.dataset.i18nAria;
    if (textKey && isMessageKey(textKey)) element.textContent = t(textKey);
    if (htmlKey && isMessageKey(htmlKey)) element.innerHTML = t(htmlKey);
    if (ariaKey && isMessageKey(ariaKey)) element.setAttribute('aria-label', t(ariaKey));
  }
}
