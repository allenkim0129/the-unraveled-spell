import type { MessageKey } from '../i18n';

export type Chapter = 'academy' | 'path' | 'source' | 'memory';
export type Interaction = 'book' | 'memory' | 'friend' | 'ward' | 'reason' | 'motive' | 'source' | 'force' | 'motion';
export type Gesture = 'up' | 'right' | 'down' | 'left';
export const LIGHT_GESTURE: readonly Gesture[] = ['up', 'right', 'up'];

export interface AdventureState {
  chapter: Chapter;
  returnChapter: Exclude<Chapter, 'memory'>;
  name: string;
  bookFound: boolean;
  memorySeen: boolean;
  lightLearned: boolean;
  reasonKnown: boolean;
  intentionKnown: boolean;
  emotionMastered: boolean;
  restored: boolean;
}
export type StoryResult = { ok: true } | { ok: false; message: MessageKey };

export function createAdventure(name = 'Ari'): AdventureState {
  return {
    chapter: 'academy', returnChapter: 'academy', name: name.trim().slice(0, 24) || 'Ari',
    bookFound: false, memorySeen: false, lightLearned: false,
    reasonKnown: false, intentionKnown: false, emotionMastered: false, restored: false,
  };
}

export function obtainBook(state: AdventureState): StoryResult {
  if (state.chapter !== 'academy') return { ok: false, message: 'storyWrongPlace' };
  state.bookFound = true;
  return { ok: true };
}

export function enterMemory(state: AdventureState): StoryResult {
  if (!state.bookFound) return { ok: false, message: 'needBook' };
  if (state.chapter === 'memory') return { ok: false, message: 'storyWrongPlace' };
  state.returnChapter = state.chapter;
  state.chapter = 'memory';
  return { ok: true };
}

export function finishMemory(state: AdventureState, faceLoneliness: boolean): StoryResult {
  if (state.chapter !== 'memory') return { ok: false, message: 'storyWrongPlace' };
  if (!faceLoneliness) return { ok: false, message: 'memoryHonesty' };
  state.memorySeen = true;
  state.chapter = state.returnChapter;
  return { ok: true };
}

export function castLight(state: AdventureState, word: string, gesture: readonly Gesture[]): StoryResult {
  if (!state.bookFound) return { ok: false, message: 'needBook' };
  if (state.chapter !== 'path') return { ok: false, message: 'storyWrongPlace' };
  if (word !== 'Lumen' || gesture.length !== LIGHT_GESTURE.length ||
    gesture.some((direction, i) => direction !== LIGHT_GESTURE[i])) {
    return { ok: false, message: 'castIncorrect' };
  }
  state.lightLearned = true;
  return { ok: true };
}

export function discover(state: AdventureState, discovery: 'reason' | 'motive'): StoryResult {
  if (state.chapter !== 'source') return { ok: false, message: 'storyWrongPlace' };
  if (discovery === 'reason') state.reasonKnown = true;
  else state.intentionKnown = true;
  return { ok: true };
}

export function masterEmotion(state: AdventureState, choice: 'connection' | 'power' | 'happiness'): StoryResult {
  if (state.chapter !== 'source') return { ok: false, message: 'storyWrongPlace' };
  if (!state.memorySeen) return { ok: false, message: 'needMemory' };
  if (!state.reasonKnown || !state.intentionKnown) return { ok: false, message: 'needUnderstanding' };
  if (choice !== 'connection') return { ok: false, message: 'emotionHonesty' };
  state.emotionMastered = true;
  return { ok: true };
}

export function restoreHumanity(state: AdventureState): StoryResult {
  if (state.chapter !== 'source') return { ok: false, message: 'storyWrongPlace' };
  if (!state.bookFound) return { ok: false, message: 'needBook' };
  if (!state.memorySeen) return { ok: false, message: 'needMemory' };
  if (!state.reasonKnown || !state.intentionKnown) return { ok: false, message: 'needUnderstanding' };
  if (!state.emotionMastered) return { ok: false, message: 'needEmotion' };
  state.restored = true;
  return { ok: true };
}

export function travel(state: AdventureState, bridgeSafe: boolean): StoryResult {
  if (state.chapter === 'academy') {
    if (!state.bookFound || !bridgeSafe) return { ok: false, message: 'needBridge' };
    state.chapter = 'path';
    return { ok: true };
  }
  if (state.chapter === 'path') {
    if (!state.lightLearned) return { ok: false, message: 'needLight' };
    state.chapter = 'source';
    return { ok: true };
  }
  return { ok: false, message: 'storyWrongPlace' };
}
