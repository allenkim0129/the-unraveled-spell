import { describe, expect, it } from 'vitest';
import {
  castLight, createAdventure, discover, enterMemory, finishMemory, masterEmotion,
  obtainBook, restoreHumanity, travel,
} from './adventure';

describe('adventure progression and distinct kinds of magic', () => {
  it('requires the book, retains loneliness through a playable memory, and checks words and gestures', () => {
    const state = createAdventure('  Mina  ');
    expect(state.name).toBe('Mina');
    expect(enterMemory(state).ok).toBe(false);
    expect(travel(state, true).ok).toBe(false);
    obtainBook(state);
    expect(state.emotionMastered).toBe(false);
    expect(enterMemory(state).ok).toBe(true);
    expect(state.chapter).toBe('memory');
    expect(finishMemory(state, false).ok).toBe(false);
    expect(state.chapter).toBe('memory');
    expect(finishMemory(state, true).ok).toBe(true);
    expect(state.chapter).toBe('academy');
    expect(state.memorySeen).toBe(true);
    expect(state.emotionMastered).toBe(false);
    expect(travel(state, false).ok).toBe(false);
    expect(travel(state, true).ok).toBe(true);
    expect(state.chapter).toBe('path');
    expect(state.restored).toBe(false);
    expect(travel(state, true).ok).toBe(false);
    expect(castLight(state, 'Umbra', ['up', 'right', 'up']).ok).toBe(false);
    expect(castLight(state, 'Lumen', ['up', 'left', 'up']).ok).toBe(false);
    expect(castLight(state, 'Lumen', ['up', 'right']).ok).toBe(false);
    expect(castLight(state, 'Lumen', ['up', 'right', 'up']).ok).toBe(true);
    expect(state.lightLearned).toBe(true);
    expect(state.emotionMastered).toBe(false);
    expect(travel(state, true).ok).toBe(true);
    expect(state.chapter).toBe('source');
    expect(state.restored).toBe(false);
  });

  it('cannot restore humanity away from the source or without either mystery and genuine emotion', () => {
    const state = createAdventure();
    obtainBook(state);
    state.memorySeen = true;
    expect(restoreHumanity(state).ok).toBe(false);
    state.chapter = 'source';
    expect(restoreHumanity(state).ok).toBe(false);
    expect(masterEmotion(state, 'connection').ok).toBe(false);
    discover(state, 'reason');
    expect(restoreHumanity(state).ok).toBe(false);
    expect(masterEmotion(state, 'connection').ok).toBe(false);
    discover(state, 'motive');
    expect(restoreHumanity(state).ok).toBe(false);
    expect(masterEmotion(state, 'power').ok).toBe(false);
    expect(masterEmotion(state, 'happiness').ok).toBe(false);
    expect(state.emotionMastered).toBe(false);
    expect(masterEmotion(state, 'connection').ok).toBe(true);
    expect(restoreHumanity(state).ok).toBe(true);
    expect(state.restored).toBe(true);
  });

  it.each(['bookFound', 'memorySeen', 'reasonKnown', 'intentionKnown', 'emotionMastered'] as const)(
    'guards the independent restoration prerequisite %s', (missing) => {
      const state = createAdventure();
      Object.assign(state, {
        chapter: 'source', bookFound: true, memorySeen: true,
        reasonKnown: true, intentionKnown: true, emotionMastered: true,
      });
      state[missing] = false;
      expect(restoreHumanity(state).ok).toBe(false);
      expect(state.restored).toBe(false);
    },
  );

  it('returns later memories to the correct location without erasing discoveries or learned magic', () => {
    const state = createAdventure();
    state.bookFound = state.lightLearned = state.reasonKnown = true;
    state.chapter = 'source';
    enterMemory(state);
    finishMemory(state, true);
    expect(state.chapter).toBe('source');
    expect(state.lightLearned).toBe(true);
    expect(state.reasonKnown).toBe(true);
    expect(state.intentionKnown).toBe(false);
    expect(state.restored).toBe(false);
  });
});
