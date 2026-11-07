import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, isMessageKey, setLanguage, t } from '../i18n';
import { createState, cutThread, execute, advance, outcomeMessage, redirectThread } from './state';

afterEach(() => setLanguage('ko'));

describe('bilingual game feedback', () => {
  it('switches localized names, feedback and errors without mutating the attempt', () => {
    const state = createState();
    cutThread(state, 'force');
    redirectThread(state, 'motion', 'mechanism');
    const before = structuredClone(state);
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('forceName')).toBe('Orange · Force / Fire');
    expect(t('seconds', { value: '4.5' })).toBe('4.5s');
    const result = cutThread(state, 'force');
    if (result.ok) throw new Error('A repeated cut should be rejected');
    expect(t(result.message)).toContain('already cut');
    expect(state).toEqual(before);
    execute(state);
    advance(state, 5);
    expect(outcomeMessage(state)).toContain('bridge is safe');
    const resolved = structuredClone(state);
    setLanguage('ko');
    expect(outcomeMessage(state)).toContain('안전하게 연결');
    expect(t(result.message)).toContain('이미 끊어진');
    expect(state).toEqual(resolved);
  });

  it('validates translation identifiers and interpolates both languages', () => {
    expect(isMessageKey('currentConnection')).toBe(true);
    expect(isMessageKey('missing-translation')).toBe(false);
    expect(t('currentConnection', { target: t('anchorName') })).toBe('현재 연결 → 다리 고정점');
    setLanguage('en');
    expect(t('currentConnection', { target: t('anchorName') })).toBe('Connected to → Bridge anchor');
    expect(t('errorWebGL')).toContain('WebGL');
  });
});
