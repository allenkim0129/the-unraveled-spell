import './style.css';
import { getLanguage, setLanguage, t, translateMarkup } from './i18n';
import type { MessageKey } from './i18n';
import { markup } from './ui';
import { GameInput } from './game/input';
import type { InputAction } from './game/input';
import { GameScene } from './game/scene';
import {
  advance, createState, cutThread, execute, EXECUTION_SECONDS, outcomeKey,
  redirectThread, SPELL_NAMES, STITCH_CAPACITY, TARGET_NAMES, undoEdit, VALID_TARGETS,
} from './game/state';
import type { ActionResult, GameState, SpellId, TargetId } from './game/state';
import {
  castLight, createAdventure, discover, enterMemory, finishMemory, masterEmotion,
  obtainBook, restoreHumanity, travel,
} from './game/adventure';
import type { Gesture, StoryResult } from './game/adventure';
import type { Vector3 } from 'three';
import { GameAudio } from './game/audio';
import { CHARACTER_FILES, loadCharacterArt } from './game/character';
import type { Appearance, CharacterArt } from './game/character';
import academyBackdrop from './assets/academy-background.webp';

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
let appearance: Appearance = 'boy';
try {
  const stored = localStorage.getItem('magical-time-appearance');
  if (stored === 'boy' || stored === 'girl') appearance = stored;
} catch (error) {
  console.warn('Appearance preference storage is unavailable; using the boy appearance.', error);
}

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
  storyLanguage: get<HTMLSelectElement>('story-language'),
  story: get<HTMLDialogElement>('story'),
  storyTitle: get('story-title'), storyBody: get('story-body'), storyDraft: get('story-draft'),
  storyChoices: get('story-choices'), storyError: get('story-error'),
  castControls: get('cast-controls'), castWord: get<HTMLSelectElement>('cast-word'),
  sequence: get('gesture-sequence'),
  audioDialog: get<HTMLDialogElement>('audio-dialog'), audioLanguage: get<HTMLSelectElement>('audio-language'),
  audioStatus: get('audio-status'), voiceStatus: get('voice-status'), audioToggle: get<HTMLButtonElement>('audio-toggle'),
  appearance: get<HTMLSelectElement>('student-appearance'), appearancePreview: get('appearance-preview'),
};

let refreshGameLanguage: (() => void) | undefined;
let refreshGameAppearance: (() => void) | undefined;
let fatalKey: MessageKey | null = null;
ui.appearance.value = appearance;
const refreshAppearancePreview = () => {
  ui.appearancePreview.style.backgroundImage = `url("${import.meta.env.BASE_URL}characters/${CHARACTER_FILES[appearance]}")`;
  ui.appearancePreview.dataset.appearance = appearance;
};
refreshAppearancePreview();
ui.appearance.addEventListener('change', () => {
  const value = ui.appearance.value;
  if (value !== 'boy' && value !== 'girl') return;
  appearance = value;
  try {
    localStorage.setItem('magical-time-appearance', value);
  } catch (error) {
    console.warn('Appearance preference could not be saved; the in-game choice is still active.', error);
  }
  refreshAppearancePreview();
  refreshGameAppearance?.();
});
ui.language.value = ui.introLanguage.value = ui.fatalLanguage.value = ui.storyLanguage.value = ui.audioLanguage.value = getLanguage();
for (const select of [ui.language, ui.introLanguage, ui.fatalLanguage, ui.storyLanguage, ui.audioLanguage]) {
  select.addEventListener('change', () => {
    const value = select.value;
    if (value !== 'ko' && value !== 'en') return;
    setLanguage(value);
    ui.language.value = ui.introLanguage.value = ui.fatalLanguage.value = ui.storyLanguage.value = ui.audioLanguage.value = value;
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
  console.error('Magical Time initialization/rendering failure:', error);
  fatalKey = key;
  get('fatal-message').textContent = t(key);
  get('fatal-error').hidden = false;
  if (ui.instructions.open) ui.instructions.close();
  if (ui.story.open) ui.story.close();
  if (ui.audioDialog.open) ui.audioDialog.close();
}

function initialize(art: CharacterArt): void {
  let adventure = createAdventure();
  let scene: GameScene;
  try {
    scene = new GameScene(ui.scene, adventure, art, appearance);
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
  let restorationPending = false;
  let memorySave: { state: GameState; position: Vector3 } | null = null;
  type StoryScreen = 'goddess' | 'book' | 'memoryIntro' | 'friend' | 'cast' | 'reason' | 'motive' | 'emotion' | 'journal';
  let storyScreen: StoryScreen = 'goddess';
  let storyError: MessageKey | null = null;
  let gestures: Gesture[] = [];
  let sceneListeners = new AbortController();
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  const audio = new GameAudio(renderAudio);
  let stepDistance = 0;
  function renderAudio(): void {
    ui.audioStatus.textContent = ui.voiceStatus.textContent = t(audio.voiceStatus());
    ui.audioToggle.textContent = t(audio.enabled ? 'audioDisable' : 'audioEnable');
    get<HTMLButtonElement>('replay-voice').disabled = !audio.enabled || audio.voiceStatus() !== 'voiceLocal' || audio.volumes.voice === 0;
    get('ambient-caption').hidden = !audio.caption;
    get('ambient-caption').textContent = audio.caption;
  }
  const narrate = () => audio.speak(`${ui.storyTitle.textContent}. ${ui.storyBody.textContent}`);
  const narrateEnding = () => audio.speak(`${t('endingCall', { name: adventure.name })} ${t('endingQuote')}`);

  const bindContext = () => {
    scene.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      stopped = true;
      cancelAnimationFrame(frame);
      input.clear(ui.knob);
      audio.disable();
      showFatal('errorContext', new Error('WebGL context lost'));
    }, { signal: sceneListeners.signal });
  };
  const replaceScene = () => {
    const next = new GameScene(ui.scene, adventure, art, appearance);
    sceneListeners.abort();
    scene.dispose();
    scene = next;
    audio.setScene(adventure.chapter, adventure.restored);
    stepDistance = 0;
    sceneListeners = new AbortController();
    bindContext();
    selected = null;
    previous = performance.now();
    lastUiSignature = '';
    updateUI();
  };

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
    if (result.ok) scene.playPlayerAction();
    audio.effect(result.ok ? success === 'notifyCut' ? 'cut' : 'cast' : 'error');
    notify(result.ok ? success : result.message, target);
    lastUiSignature = '';
    updateUI();
  };
  const reset = () => {
    restorationPending = false;
    state = createState();
    sight = false;
    selected = null;
    scene.reset();
    audio.stopSpeech();
    stepDistance = 0;
    input.clear(ui.knob);
    clearTimeout(toastTimeout);
    ui.toast.hidden = true;
    lastUiSignature = '';
    updateUI();
    notify('notifyReset');
  };
  const showStory = (screen: StoryScreen) => {
    storyScreen = screen;
    storyError = null;
    input.clear(ui.knob);
    renderStory();
    if (!ui.story.open) ui.story.showModal();
    audio.effect('page');
    narrate();
  };
  const closeStory = () => {
    ui.story.close();
    audio.stopSpeech();
    input.clear(ui.knob);
    previous = performance.now();
  };
  const resultError = (result: StoryResult): boolean => {
    if (result.ok) return false;
    storyError = result.message;
    renderStory();
    audio.effect('error');
    audio.speak(t(storyError));
    return true;
  };
  const startMemory = () => {
    const position = scene.getPosition();
    const result = enterMemory(adventure);
    if (resultError(result)) return;
    memorySave = { state, position };
    state = createState();
    replaceScene();
    showStory('memoryIntro');
  };
  const returnMemory = (honest: boolean) => {
    if (resultError(finishMemory(adventure, honest))) return;
    const saved = memorySave;
    if (!saved) throw new Error('Missing present-day state for memory return');
    state = saved.state;
    replaceScene();
    scene.setPosition(saved.position);
    memorySave = null;
    closeStory();
    notify('memoryReturn');
  };
  function renderStory(): void {
    const text: Record<StoryScreen, [MessageKey, MessageKey]> = {
      goddess: ['goddessTitle', 'goddessBody'], book: ['bookTitle', 'bookBody'],
      memoryIntro: ['memoryTitle', 'memoryIntro'], friend: ['memoryTitle', 'friendBody'],
      cast: ['castTitle', 'castBody'], reason: ['reasonTitle', 'reasonBody'],
      motive: ['motiveTitle', 'motiveBody'], emotion: ['emotionTitle', 'emotionBody'],
      journal: ['journal', 'bookBody'],
    };
    ui.storyTitle.textContent = t(text[storyScreen][0]);
    ui.storyBody.textContent = t(text[storyScreen][1]);
    ui.storyDraft.hidden = !['reason', 'motive', 'emotion'].includes(storyScreen);
    ui.castControls.hidden = storyScreen !== 'cast';
    ui.storyError.hidden = !storyError;
    ui.storyError.textContent = storyError ? t(storyError) : '';
    const arrows: Record<Gesture, string> = { up: '↑', right: '→', down: '↓', left: '←' };
    ui.sequence.textContent = gestures.map((gesture) => arrows[gesture]).join(' ') || '—';
    ui.storyChoices.replaceChildren();
    const choice = (id: string, key: MessageKey, callback: () => void) => {
      const button = document.createElement('button');
      button.className = 'primary-button';
      button.dataset.choice = id;
      button.textContent = t(key);
      button.addEventListener('click', callback);
      ui.storyChoices.append(button);
    };
    if (storyScreen === 'friend') {
      choice('honest', 'faceLoneliness', () => returnMemory(true));
      choice('suppress', 'forceHappiness', () => returnMemory(false));
    } else if (storyScreen === 'cast') {
      choice('cast', 'castButton', () => {
        if (resultError(castLight(adventure, ui.castWord.value, gestures))) return;
        closeStory();
        lastUiSignature = '';
        updateUI();
        notify('lightSuccess');
        audio.effect('cast');
        scene.playPlayerAction();
      });
    } else if (storyScreen === 'emotion') {
      for (const [id, key] of [
        ['connection', 'chooseConnection'], ['power', 'choosePower'], ['happiness', 'chooseHappy'],
      ] as const) {
        choice(id, key, () => {
          if (resultError(masterEmotion(adventure, id))) return;
          closeStory();
          restorationPending = true;
          state = createState();
          execute(state);
          previous = performance.now();
          notify('notifyExecuting');
          audio.effect('cast');
          lastUiSignature = '';
        });
      }
    } else if (storyScreen === 'journal') {
      const status = (flag: boolean) => t(flag ? 'complete' : 'unknown');
      const progress = document.createElement('p');
      progress.className = 'journal-progress';
      progress.textContent = t('journalProgress', {
        book: status(adventure.bookFound), memory: status(adventure.memorySeen), light: status(adventure.lightLearned),
        reason: status(adventure.reasonKnown), motive: status(adventure.intentionKnown), emotion: status(adventure.emotionMastered),
      }).replace(/<br \/>/g, '\n');
      ui.storyChoices.append(progress);
      if (adventure.bookFound && adventure.chapter !== 'memory' && !adventure.restored) {
        choice('remember', 'rememberButton', startMemory);
      }
      choice('continue', 'continue', closeStory);
    } else {
      choice('continue', 'continue', () => {
        if (storyScreen === 'reason' || storyScreen === 'motive') {
          if (resultError(discover(adventure, storyScreen))) return;
        }
        closeStory();
        lastUiSignature = '';
        updateUI();
      });
    }
  }
  const openInstructions = () => {
    input.clear(ui.knob);
    ui.start.textContent = t(started ? 'return' : 'enter');
    get<HTMLInputElement>('student-name').readOnly = started;
    ui.appearance.disabled = started;
    ui.instructions.showModal();
  };
  const action = (name: InputAction) => {
    if (ui.instructions.open || ui.story.open || ui.audioDialog.open) return;
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
        const interaction = scene.interaction(state);
        if (!interaction) { notify('notifyApproach'); break; }
        if (interaction === 'book') {
          const result = obtainBook(adventure);
          if (result.ok) showStory('book');
          else notify(result.message);
          break;
        }
        if (interaction === 'memory') { startMemory(); break; }
        if (interaction === 'friend') { scene.waveFriend(); showStory('friend'); break; }
        if (interaction === 'ward') { gestures = []; showStory('cast'); break; }
        if (interaction === 'reason' || interaction === 'motive') { showStory(interaction); break; }
        if (interaction === 'source') {
          if (!adventure.memorySeen) { showStory('journal'); storyError = 'needMemory'; renderStory(); break; }
          if (!adventure.reasonKnown || !adventure.intentionKnown) {
            showStory('journal'); storyError = 'needUnderstanding'; renderStory(); break;
          }
          showStory('emotion');
          break;
        }
        if (!adventure.bookFound) { notify('needBook'); break; }
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
        if (!adventure.bookFound) { notify('needBook'); break; }
        if (adventure.chapter !== 'academy') { notify('storyWrongPlace'); break; }
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
    const interaction = scene.interaction(state);
    if (selected && (nearby !== selected || state.phase !== 'editing' || !sight)) selected = null;
    const signature = JSON.stringify({
      phase: state.phase, spells: state.spells, stitches: state.stitches,
      history: state.history.length, won: state.won, sight, selected, nearby, interaction, adventure, language: getLanguage(),
    });
    if (signature === lastUiSignature) return;
    lastUiSignature = signature;
    ui.stitches.textContent = `${state.stitches} / ${STITCH_CAPACITY}`;
    ui.scene.dataset.chapter = adventure.chapter;
    const chapterKey = { academy: 'academyChapter', path: 'pathChapter', source: 'sourceChapter', memory: 'memoryChapter' } as const;
    const objectiveKey = adventure.chapter === 'academy' ? outcomeKey(state) :
      adventure.chapter === 'path' ? 'pathObjective' : adventure.chapter === 'memory' ? 'memoryObjective' : 'sourceObjective';
    document.querySelector<HTMLElement>('.room-title h2')!.textContent = t(chapterKey[adventure.chapter]);
    document.querySelector<HTMLElement>('.mission > p')!.textContent = t(objectiveKey);
    document.querySelector<HTMLElement>('.steps')!.hidden = adventure.chapter !== 'academy';
    ui.phase.textContent = t(adventure.restored ? 'phaseWon' : state.phase === 'editing' ? 'phaseEditing' :
      state.phase === 'executing' ? 'phaseExecuting' : 'phaseResolved');
    ui.outcome.textContent = t(adventure.restored ? 'restoredBody' : objectiveKey);
    ui.outcome.closest('footer')?.classList.toggle('safe', Boolean(state.outcome?.safe));
    ui.sight.setAttribute('aria-pressed', String(sight));
    ui.sightBadge.hidden = !sight;
    ui.undo.disabled = state.phase !== 'editing' || state.history.length === 0;
    ui.execute.disabled = state.phase !== 'editing' || !adventure.bookFound || adventure.chapter !== 'academy';
    ui.execute.textContent = t(state.phase === 'executing' ? 'executingButton' :
      state.phase === 'resolved' ? 'resolvedButton' : 'execute');
    ui.interact.disabled = !interaction;
    ui.interact.dataset.nearby = nearby ?? '';
    ui.interact.dataset.interaction = interaction ?? '';
    const interactionKeys = {
      book: 'bookAction', memory: 'memoryAction', friend: 'friendAction', ward: 'wardAction',
      reason: 'reasonAction', motive: 'motiveAction', source: 'sourceAction',
      force: state.phase !== 'editing' ? 'cannotEditResolved' : !sight ? 'enableSight' : 'interactForce',
      motion: state.phase !== 'editing' ? 'cannotEditResolved' : !sight ? 'enableSight' : 'interactMotion',
    } satisfies Record<string, MessageKey>;
    ui.interact.textContent = t(interaction ? interactionKeys[interaction] : 'approach');
    if (interaction === 'force' || interaction === 'motion') ui.interact.disabled = state.phase !== 'editing';
    ui.bar.hidden = state.phase !== 'executing';
    ui.success.hidden = !adventure.restored;
    get('ending-call').textContent = t('endingCall', { name: adventure.name });
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
    audio.stopSpeech();
    renderAudio();
    ui.start.textContent = t(started ? 'return' : 'enter');
    renderNotification();
    if (ui.story.open) {
      renderStory();
      if (!ui.audioDialog.open) narrate();
    }
    lastUiSignature = lastTimer = '';
    updateUI();
    if (adventure.restored && !ui.audioDialog.open) narrateEnding();
  };
  refreshGameAppearance = () => {
    if (!started) replaceScene();
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
  const openAudio = () => {
    audio.stopSpeech();
    input.clear(ui.knob);
    renderAudio();
    ui.audioDialog.showModal();
  };
  get('audio-settings').addEventListener('click', openAudio, options);
  get('story-audio').addEventListener('click', openAudio, options);
  get('close-audio').addEventListener('click', () => ui.audioDialog.close(), options);
  ui.audioDialog.addEventListener('close', () => { input.clear(ui.knob); previous = performance.now(); }, options);
  ui.audioToggle.addEventListener('click', () => {
    if (audio.enabled) audio.disable();
    else void audio.enable();
  }, options);
  get('replay-voice').addEventListener('click', narrate, options);
  for (const channel of ['effects', 'ambience', 'voice'] as const) {
    get<HTMLInputElement>(`volume-${channel}`).addEventListener('input', (event) => {
      const slider = event.currentTarget;
      if (!(slider instanceof HTMLInputElement)) return;
      audio.setVolume(channel, Number(slider.value) / 100);
      get(`value-${channel}`).textContent = `${slider.value}%`;
    }, options);
  }
  get('replay').addEventListener('click', () => {
    adventure = createAdventure(adventure.name);
    state = createState();
    restorationPending = false;
    memorySave = null;
    sight = false;
    replaceScene();
    showStory('goddess');
  }, options);
  get('journal').addEventListener('click', () => {
    if (!ui.instructions.open && state.phase !== 'executing') showStory('journal');
  }, options);
  get('close-story').addEventListener('click', closeStory, options);
  get('clear-gesture').addEventListener('click', () => { gestures = []; renderStory(); }, options);
  get('cast-controls').addEventListener('click', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLButtonElement)) return;
    const direction = element.dataset.gesture;
    if (direction !== 'up' && direction !== 'right' && direction !== 'down' && direction !== 'left') return;
    if (gestures.length < 3) gestures.push(direction);
    else storyError = 'castIncorrect';
    renderStory();
    audio.effect('cast');
    scene.playPlayerAction();
  }, options);
  ui.story.addEventListener('close', () => { input.clear(ui.knob); previous = performance.now(); }, options);
  get('close-editor').addEventListener('click', () => { selected = null; updateUI(); }, options);
  ui.start.addEventListener('click', () => {
    const firstStart = !started;
    if (firstStart) adventure.name = get<HTMLInputElement>('student-name').value.trim().slice(0, 24) || 'Ari';
    started = true;
    ui.instructions.close();
    input.clear(ui.knob);
    ui.start.blur();
    if (firstStart) showStory('goddess');
    if (firstStart) void audio.enable().then(() => {
      if (ui.story.open && storyScreen === 'goddess') narrate();
    });
  }, options);
  ui.instructions.addEventListener('cancel', (event) => { if (!started) event.preventDefault(); }, options);
  ui.instructions.addEventListener('close', () => {
    input.clear(ui.knob);
    previous = performance.now();
  }, options);
  document.addEventListener('visibilitychange', () => { previous = performance.now(); audio.visibilityChanged(); }, options);
  bindContext();

  const loop = (now: number) => {
    if (stopped) return;
    const elapsedSeconds = Math.max((now - previous) / 1000, 0);
    const seconds = Math.min(elapsedSeconds, 0.1);
    previous = now;
    try {
      if (started && !ui.instructions.open && !ui.story.open && !ui.audioDialog.open && !document.hidden) {
        const axes = input.axes();
        const movementSeconds = Math.min(elapsedSeconds, 0.25);
        const steps = Math.max(1, Math.ceil(movementSeconds / 0.025));
        const position = scene.getPosition();
        for (let i = 0; i < steps; i++) scene.move(axes.x, axes.y, movementSeconds / steps, state);
        stepDistance += scene.getPosition().distanceTo(position);
        if (stepDistance > 0.65) { audio.effect('step'); stepDistance = 0; }
        const oldPhase = state.phase;
        advance(state, elapsedSeconds);
        if (oldPhase === 'executing' && state.phase === 'resolved') {
          if (restorationPending) {
            const result = restoreHumanity(adventure);
            restorationPending = false;
            if (!result.ok) notify(result.message);
            else {
              audio.setScene(adventure.chapter, true);
              audio.effect('bell');
              narrateEnding();
            }
            input.clear(ui.knob);
          } else notify(outcomeKey(state));
        }
        if (scene.atExit() && ['academy', 'path'].includes(adventure.chapter)) {
          const result = travel(adventure, Boolean(state.outcome?.safe));
          if (result.ok) {
            state = createState();
            sight = false;
            input.clear(ui.knob);
            replaceScene();
          }
        }
      }
      scene.render(state, sight, selected, seconds);
      audio.tick(seconds, !ui.story.open && !ui.instructions.open && !ui.audioDialog.open);
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
      audio.disable();
    }
  };
  updateUI();
  renderAudio();
  ui.start.disabled = false;
  openInstructions();
  frame = requestAnimationFrame(loop);
  import.meta.hot?.dispose(() => {
    stopped = true;
    lifetime.abort();
    sceneListeners.abort();
    refreshGameLanguage = undefined;
    refreshGameAppearance = undefined;
    cancelAnimationFrame(frame);
    clearTimeout(toastTimeout);
    input.dispose();
    scene.dispose();
    audio.dispose();
    Object.values(art).forEach((texture) => texture.dispose());
  });
}

async function bootstrap(): Promise<void> {
  ui.outcome.textContent = t('loadingCharacterArt');
  let art: CharacterArt;
  try {
    art = await loadCharacterArt();
  } catch (error) {
    showFatal('errorCharacterArt', error);
    return;
  }
  try {
    const backdrop = new Image();
    backdrop.src = academyBackdrop;
    await backdrop.decode();
  } catch (error) {
    showFatal('errorEnvironmentArt', error);
    return;
  }
  initialize(art);
}

void bootstrap();
