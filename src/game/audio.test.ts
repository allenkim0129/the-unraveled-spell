import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameAudio, humanChatterAllowed, localVoice } from './audio';
import { setLanguage } from '../i18n';

function voice(lang: string, localService: boolean): SpeechSynthesisVoice {
  return { lang, localService, default: false, name: lang, voiceURI: lang };
}

describe('device-local bilingual audio', () => {
  afterEach(() => { vi.unstubAllGlobals(); setLanguage('ko'); });
  it('selects only a local voice in the exact language family, never a remote voice or another language', () => {
    const voices = [voice('ko-KR', false), voice('en-US', true), voice('ko_KR', true)];
    expect(localVoice(voices, 'ko')).toBe(voices[2]);
    expect(localVoice(voices, 'en')).toBe(voices[1]);
    expect(localVoice([voices[0], voices[1]], 'ko')).toBeUndefined();
    expect(localVoice([], 'en')).toBeUndefined();
  });

  it('keeps human chatter absent in every frozen present-day chapter', () => {
    for (const chapter of ['academy', 'path', 'source'] as const) {
      expect(humanChatterAllowed(chapter, false)).toBe(false);
      expect(humanChatterAllowed(chapter, true)).toBe(true);
    }
    expect(humanChatterAllowed('memory', false)).toBe(true);
  });

  it('voices dialogue and memory chatter locally with independent volumes and cancels at the frozen present', () => {
    const voices = [voice('ko-KR', true), voice('en-US', true)];
    const speak = vi.fn<(utterance: SpeechSynthesisUtterance) => void>();
    const cancel = vi.fn();
    const speech = Object.assign(new EventTarget(), { getVoices: () => voices, speak, cancel });
    vi.stubGlobal('document', { hidden: false });
    vi.stubGlobal('speechSynthesis', speech);
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      constructor(readonly text: string) {}
    });
    const audio = new GameAudio(vi.fn());
    expect(audio.voiceStatus()).toBe('audioOff');
    audio.enabled = true;
    audio.setVolume('voice', 0.6);
    audio.speak('여신의 안내');
    expect(speak.mock.lastCall?.[0]).toMatchObject({ text: '여신의 안내', voice: voices[0], volume: 0.6 });
    setLanguage('en');
    audio.speak('Goddess guidance');
    expect(speak.mock.lastCall?.[0]).toMatchObject({ text: 'Goddess guidance', voice: voices[1], volume: 0.6 });
    audio.setScene('memory', false);
    audio.setVolume('ambience', 0.15);
    audio.tick(9, true);
    expect(speak.mock.lastCall?.[0]).toMatchObject({ volume: 0.15, lang: 'en-US' });
    expect(audio.caption).toContain('walk home');
    const count = speak.mock.calls.length;
    audio.setScene('source', false);
    audio.tick(30, true);
    expect(audio.caption).toBe('');
    expect(speak).toHaveBeenCalledTimes(count);
    expect(cancel).toHaveBeenCalled();
    audio.dispose();
  });

  it('retains memory captions without claiming unsupported or remote voices are available', () => {
    const speak = vi.fn();
    vi.stubGlobal('document', { hidden: false });
    vi.stubGlobal('speechSynthesis', Object.assign(new EventTarget(), {
      getVoices: () => [voice('ko-KR', false)], speak, cancel: vi.fn(),
    }));
    const audio = new GameAudio(vi.fn());
    audio.enabled = true;
    expect(audio.voiceStatus()).toBe('voiceUnavailable');
    audio.setScene('memory', false);
    audio.tick(9, true);
    expect(audio.caption).toContain('수업');
    expect(speak).not.toHaveBeenCalled();
    audio.disable();
    expect(audio.caption).toBe('');
    audio.dispose();
  });
});
