import { describe, expect, it } from 'vitest';
import {
  advance, createState, cutThread, evaluateOutcome, execute,
  outcomeMessage, reachExit, redirectThread, undoEdit,
} from './state';

describe('spell editing and stitches', () => {
  it('charges only actual edits and refunds exact snapshots in reverse order', () => {
    const state = createState();
    expect(redirectThread(state, 'motion', 'debris').ok).toBe(false);
    expect(redirectThread(state, 'motion', 'anchor').ok).toBe(false);
    expect(state.stitches).toBe(3);
    expect(cutThread(state, 'force').ok).toBe(true);
    expect(cutThread(state, 'force').ok).toBe(false);
    expect(redirectThread(state, 'force', 'debris').ok).toBe(false);
    expect(redirectThread(state, 'motion', 'mechanism').ok).toBe(true);
    expect(state.stitches).toBe(1);
    expect(undoEdit(state).ok).toBe(true);
    expect(state.spells.motion.target).toBe('debris');
    expect(state.spells.force.connected).toBe(false);
    expect(state.stitches).toBe(2);
    expect(undoEdit(state).ok).toBe(true);
    expect(state).toEqual(createState());
    expect(undoEdit(state).ok).toBe(false);
  });

  it('rejects edits beyond capacity without changing spell state', () => {
    const state = createState();
    redirectThread(state, 'motion', 'mechanism');
    redirectThread(state, 'motion', 'debris');
    redirectThread(state, 'motion', 'mechanism');
    const before = structuredClone(state);
    expect(cutThread(state, 'force').ok).toBe(false);
    expect(state).toEqual(before);
    undoEdit(state);
    expect(state.stitches).toBe(1);
    expect(cutThread(state, 'force').ok).toBe(true);
  });
});

describe('execution and puzzle outcomes', () => {
  it('runs exactly five seconds and freezes; does not allow edits or repeated execution', () => {
    const state = createState();
    cutThread(state, 'force');
    redirectThread(state, 'motion', 'mechanism');
    expect(execute(state).ok).toBe(true);
    expect(cutThread(state, 'motion').ok).toBe(false);
    expect(redirectThread(state, 'motion', 'debris').ok).toBe(false);
    expect(undoEdit(state).ok).toBe(false);
    expect(execute(state).ok).toBe(false);
    advance(state, 4.99);
    expect(state.phase).toBe('executing');
    expect(reachExit(state)).toBe(false);
    advance(state, 0.01);
    expect(state.phase).toBe('resolved');
    expect(state.elapsed).toBe(5);
    expect(state.outcome).toEqual({ anchorIntact: true, bridgeRaised: true, safe: true });
    advance(state, 99);
    expect(state.elapsed).toBe(5);
    expect(execute(state).ok).toBe(false);
    expect(cutThread(state, 'motion').ok).toBe(false);
    expect(reachExit(state)).toBe(true);
    expect(reachExit(state)).toBe(false);
    expect(outcomeMessage(state)).toContain('복구');
  });

  it('makes the original catastrophe and each partial solution observable', () => {
    const original = createState();
    execute(original);
    advance(original, 5);
    expect(original.outcome).toEqual({ anchorIntact: false, bridgeRaised: false, safe: false });
    expect(reachExit(original)).toBe(false);
    expect(outcomeMessage(original)).toContain('두 실');
    const cutOnly = createState();
    cutThread(cutOnly, 'force');
    expect(evaluateOutcome(cutOnly).safe).toBe(false);
    execute(cutOnly);
    advance(cutOnly, 5);
    expect(outcomeMessage(cutOnly)).toContain('파란 실');
    const redirectOnly = createState();
    redirectThread(redirectOnly, 'motion', 'mechanism');
    execute(redirectOnly);
    advance(redirectOnly, 5);
    expect(redirectOnly.outcome?.safe).toBe(false);
    expect(outcomeMessage(redirectOnly)).toContain('주황 실');
  });

  it('accepts a clever force redirection as an alternative to cutting', () => {
    const state = createState();
    redirectThread(state, 'force', 'debris');
    redirectThread(state, 'motion', 'mechanism');
    execute(state);
    advance(state, 5);
    expect(state.outcome?.safe).toBe(true);
  });

  it('resets all attempt state through a fresh state, even after success', () => {
    const state = createState();
    cutThread(state, 'force');
    redirectThread(state, 'motion', 'mechanism');
    execute(state);
    advance(state, 100);
    reachExit(state);
    const reset = createState();
    expect(reset.phase).toBe('editing');
    expect(reset.elapsed).toBe(0);
    expect(reset.history).toEqual([]);
    expect(reset.stitches).toBe(3);
    expect(reset.won).toBe(false);
    expect(reset.outcome).toBeNull();
    expect(reset.spells.force.connected).toBe(true);
    expect(reset.spells.motion.target).toBe('debris');
  });

  it('does not advance frozen time or accept invalid time increments', () => {
    const state = createState();
    advance(state, 5);
    expect(state.elapsed).toBe(0);
    execute(state);
    advance(state, NaN);
    advance(state, Infinity);
    advance(state, -1);
    expect(state.elapsed).toBe(0);
  });
});
