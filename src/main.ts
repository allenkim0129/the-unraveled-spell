import './style.css';
import { getLanguage, setLanguage, t, translateMarkup } from './i18n';
import type { MessageKey } from './i18n';
import { markup } from './ui';
import { GameInput } from './game/input';
import type { InputAction } from './game/input';
import { GameScene } from './game/scene';
import {
  advance, createState, cutThread, execute, EXECUTION_SECONDS, outcomeKey,
  reachExit, redirectThread, SPELL_NAMES, STITCH_CAPACITY, TARGET_NAMES, undoEdit, VALID_TARGETS,
} from './game/state';
import type { ActionResult, SpellId, TargetId } from './game/state';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root is missing.');
app.innerHTML = markup;

function get<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element: ${id}`);
  return element as T;
}

try {
  const stored = localStorage.getItem('spellweaver-language');
  if (stored === 'ko' || stored === 'en') setLanguage(stored);
} catch (error) {
  console.warn('Language preference storage is unavailable; using Korean.', error);
}
translateMarkup();

const ui = {
  scene: get('scene'), stitches: get('stitches'), phase: get('phase'), outcome: get('outcome'),
  editor: get('editor'), editorTitle: get('editor-title'), connection: get('connection'), targets: get('targets'),
  cut: get<HTMLButtonElement>('cut'), undo: get<HTMLButtonElement>('undo'), sight: get<HTMLButtonElement>('sight'),
  interact: get<HTMLButtonElement>('interact'), execute: get<HTMLButtonElement>('execute'),
  bar: get('execution-bar'), timer: get('timer'), progress: get<HTMLProgressElement>('progress'),
  sightBadge: get('sight-badge'), success: get('success'), toast: get('toast'),
  instructions: get<HTMLDialogElement>('instructions'), start: get<HTMLButtonElement>('start'),
  joystick: get('joystick'), knob: get('knob'),
  language: get<HTMLSelectElement>('language'), introLanguage: get<HTMLSelectElement>('intro-language'),
  fatalLanguage: get<HTMLSelectElement>('fatal-language'),
};

let refreshGameLanguage: (() => void) | undefined;
let fatalKey: MessageKey | null = null;
ui.language.value = ui.introLanguage.value = ui.fatalLanguage.value = getLanguage();
for (const select of [ui.language, ui.introLanguage, ui.fatalLanguage]) {
  select.addEventListener('change', () => {
    const value = select.value;
    if (value !== 'ko' && value !== 'en') return;
    setLanguage(value);
    ui.language.value = ui.introLanguage.value = ui.fatalLanguage.value = value;
    try {
      localStorage.setItem('spellweaver-language', value);
    } catch (error) {
      console.warn('Language preference could not be saved; the in-game choice is still active.', error);
    }
    translateMarkup();
    if (fatalKey) get('fatal-message').textContent = t(fatalKey);
    refreshGameLanguage?.();
    select.blur();
  });
}

function showFatal(key: MessageKey, error: unknown): void {
  console.error('Spellweaver prototype initialization/rendering failure:', error);
  fatalKey = key;
  get('fatal-message').textContent = t(key);
  get('fatal-error').hidden = false;
  if (ui.instructions.open) ui.instructions.close();
}

function initialize(): void {
  let scene: GameScene;
  try {
    scene = new GameScene(ui.scene);
  } catch (error) {
    showFatal('errorWebGL', error);
    return;
  }
  let state = createState();
  let sight = false;
  let selected: SpellId | null = null;
  let started = false;
  let previous = performance.now();
  let lastUiSignature = '';
  let lastTimer = '';
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  let notification: { key: MessageKey; target?: TargetId } | null = null;
  let frame = 0;
  let stopped = false;
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };

  const renderNotification = () => {
    if (!notification) return;
    ui.toast.textContent = t(notification.key, notification.target ?
      { target: t(TARGET_NAMES[notification.target]) } : {});
  };
  const notify = (key: MessageKey, target?: TargetId) => {
    clearTimeout(toastTimeout);
    notification = { key, target };
    renderNotification();
    ui.toast.hidden = false;
    toastTimeout = setTimeout(() => { ui.toast.hidden = true; }, 4500);
  };
  const apply = (result: ActionResult, success: MessageKey, target?: TargetId) => {
    notify(result.ok ? success : result.message, target);
    lastUiSignature = '';
    updateUI();
  };
  const reset = () => {
    state = createState();
    sight = false;
    selected = null;
    scene.reset();
    input.clear(ui.knob);
    clearTimeout(toastTimeout);
    ui.toast.hidden = true;
    lastUiSignature = '';
    updateUI();
    notify('notifyReset');
  };
  const openInstructions = () => {
    input.clear(ui.knob);
    ui.start.textContent = t(started ? 'return' : 'enter');
    ui.instructions.showModal();
  };
  const action = (name: InputAction) => {
    if (ui.instructions.open) return;
    if (name === 'help') { openInstructions(); return; }
    if (!started) return;
    switch (name) {
      case 'sight':
        sight = !sight;
        if (!sight) selected = null;
        lastUiSignature = '';
        updateUI();
        break;
      case 'interact': {
        if (state.phase !== 'editing') { notify('errorPhase'); break; }
        if (!sight) { notify('notifySightFirst'); break; }
        const nearby = scene.nearestSpell();
        if (!nearby) { notify('notifyApproach'); break; }
        selected = nearby;
        lastUiSignature = '';
        updateUI();
        break;
      }
      case 'execute':
        if (state.phase === 'editing') selected = null;
        input.clear(ui.knob);
        {
          const result = execute(state);
          if (result.ok) previous = performance.now();
          apply(result, 'notifyExecuting');
        }
        break;
      case 'undo': apply(undoEdit(state), 'notifyUndo'); break;
      case 'reset': reset(); break;
    }
  };
  const input = new GameInput(ui.joystick, ui.knob, action);

  function updateUI(): void {
    const nearby = scene.nearestSpell();
    if (selected && (nearby !== selected || state.phase !== 'editing' || !sight)) selected = null;
    const signature = JSON.stringify({
      phase: state.phase, spells: state.spells, stitches: state.stitches,
      history: state.history.length, won: state.won, sight, selected, nearby, language: getLanguage(),
    });
    if (signature === lastUiSignature) return;
    lastUiSignature = signature;
    ui.stitches.textContent = `${state.stitches} / ${STITCH_CAPACITY}`;
    ui.phase.textContent = t(state.phase === 'editing' ? 'phaseEditing' :
      state.phase === 'executing' ? 'phaseExecuting' : state.won ? 'phaseWon' : 'phaseResolved');
    ui.outcome.textContent = t(outcomeKey(state));
    ui.outcome.closest('footer')?.classList.toggle('safe', Boolean(state.outcome?.safe));
    ui.sight.setAttribute('aria-pressed', String(sight));
    ui.sightBadge.hidden = !sight;
    ui.undo.disabled = state.phase !== 'editing' || state.history.length === 0;
    ui.execute.disabled = state.phase !== 'editing';
    ui.execute.textContent = t(state.phase === 'executing' ? 'executingButton' :
      state.phase === 'resolved' ? 'resolvedButton' : 'execute');
    ui.interact.disabled = state.phase !== 'editing' || !nearby;
    ui.interact.dataset.nearby = nearby ?? '';
    ui.interact.textContent = t(state.phase !== 'editing' ? 'cannotEditResolved' : !nearby ? 'approach' :
      !sight ? 'enableSight' : nearby === 'force' ? 'interactForce' : 'interactMotion');
    ui.bar.hidden = state.phase !== 'executing';
    ui.success.hidden = !state.won;
    ui.joystick.classList.toggle('inactive', state.phase === 'executing' || state.won);
    ui.editor.hidden = !selected;
    ui.editor.closest('aside')?.classList.toggle('editing', selected !== null);
    if (selected) {
      const spell = state.spells[selected];
      ui.editorTitle.textContent = t(SPELL_NAMES[selected]);
      ui.editor.dataset.spell = selected;
      ui.connection.textContent = spell.connected ?
        t('currentConnection', { target: t(TARGET_NAMES[spell.target]) }) : t('cutConnection');
      ui.cut.disabled = !spell.connected || state.stitches === 0;
      ui.targets.replaceChildren();
      for (const target of VALID_TARGETS[selected]) {
        const button = document.createElement('button');
        button.className = 'target-button';
        const current = target === spell.target;
        button.textContent = t(current ? 'targetCurrent' : 'targetCost', { target: t(TARGET_NAMES[target]) });
        button.disabled = current || !spell.connected || state.stitches === 0;
        button.dataset.target = target;
        ui.targets.append(button);
      }
    }
  }
  refreshGameLanguage = () => {
    input.clear(ui.knob);
    scene.setLanguage();
    ui.start.textContent = t(started ? 'return' : 'enter');
    renderNotification();
    lastUiSignature = lastTimer = '';
    updateUI();
  };

  ui.targets.addEventListener('click', (event) => {
    if (!selected || scene.nearestSpell() !== selected) { notify('notifyApproach'); return; }
    const targetElement = event.target;
    if (!(targetElement instanceof HTMLButtonElement)) return;
    const target = targetElement.dataset.target;
    if (target !== 'anchor' && target !== 'debris' && target !== 'mechanism') return;
    if (!VALID_TARGETS[selected].includes(target)) { notify('errorInvalidTarget'); return; }
    apply(redirectThread(state, selected, target), 'notifyRedirect', target);
  }, options);
  ui.cut.addEventListener('click', () => {
    if (selected && scene.nearestSpell() === selected) apply(cutThread(state, selected), 'notifyCut');
    else notify('notifyApproach');
  }, options);
  ui.sight.addEventListener('click', () => action('sight'), options);
  ui.interact.addEventListener('click', () => action('interact'), options);
  ui.execute.addEventListener('click', () => action('execute'), options);
  ui.undo.addEventListener('click', () => action('undo'), options);
  get('reset').addEventListener('click', () => action('reset'), options);
  get('help').addEventListener('click', () => action('help'), options);
  get('replay').addEventListener('click', () => action('reset'), options);
  get('close-editor').addEventListener('click', () => { selected = null; updateUI(); }, options);
  ui.start.addEventListener('click', () => {
    started = true;
    ui.instructions.close();
    input.clear(ui.knob);
    ui.start.blur();
    notify('notifyStart');
  }, options);
  ui.instructions.addEventListener('cancel', (event) => { if (!started) event.preventDefault(); }, options);
  ui.instructions.addEventListener('close', () => {
    input.clear(ui.knob);
    previous = performance.now();
  }, options);
  document.addEventListener('visibilitychange', () => { previous = performance.now(); }, options);
  scene.renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(frame);
    input.clear(ui.knob);
    showFatal('errorContext', new Error('WebGL context lost'));
  }, options);

  const loop = (now: number) => {
    if (stopped) return;
    const elapsedSeconds = Math.max((now - previous) / 1000, 0);
    const seconds = Math.min(elapsedSeconds, 0.1);
    previous = now;
    try {
      if (started && !ui.instructions.open && !document.hidden) {
        const axes = input.axes();
        const movementSeconds = Math.min(elapsedSeconds, 0.25);
        const steps = Math.max(1, Math.ceil(movementSeconds / 0.025));
        for (let i = 0; i < steps; i++) scene.move(axes.x, axes.y, movementSeconds / steps, state);
        const oldPhase = state.phase;
        advance(state, elapsedSeconds);
        if (oldPhase === 'executing' && state.phase === 'resolved') notify(outcomeKey(state));
        if (scene.atExit() && reachExit(state)) input.clear(ui.knob);
      }
      scene.render(state, sight, selected, seconds);
      updateUI();
      const timerText = t('seconds', { value: (EXECUTION_SECONDS - state.elapsed).toFixed(1) });
      if (timerText !== lastTimer) {
        ui.timer.textContent = timerText;
        ui.progress.value = state.elapsed;
        lastTimer = timerText;
      }
      frame = requestAnimationFrame(loop);
    } catch (error) {
      stopped = true;
      input.clear(ui.knob);
      showFatal('errorRendering', error);
    }
  };
  updateUI();
  openInstructions();
  frame = requestAnimationFrame(loop);
  import.meta.hot?.dispose(() => {
    stopped = true;
    lifetime.abort();
    refreshGameLanguage = undefined;
    cancelAnimationFrame(frame);
    clearTimeout(toastTimeout);
    input.dispose();
    scene.dispose();
  });
}

initialize();
