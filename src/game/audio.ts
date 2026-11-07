import { getLanguage, t } from '../i18n';
import type { Language, MessageKey } from '../i18n';
import type { Chapter } from './adventure';

export type AudioChannel = 'effects' | 'ambience' | 'voice';
export type SoundEffect = 'step' | 'cast' | 'cut' | 'page' | 'creature' | 'bell' | 'error';

export function localVoice(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => voice.localService && voice.lang.toLowerCase().split(/[-_]/)[0] === language);
}

export function humanChatterAllowed(chapter: Chapter, restored: boolean): boolean {
  return chapter === 'memory' || restored;
}

export class GameAudio {
  readonly volumes: Record<AudioChannel, number> = { effects: 0.3, ambience: 0.2, voice: 0.75 };
  enabled = false;
  caption = '';
  private captionUntil = 0;
  private context: AudioContext | null = null;
  private wind: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private speechChannel: 'voice' | 'ambience' | null = null;
  private speechError = false;
  private audioError = false;
  private clock = 0;
  private nextCreature = 7;
  private nextBell = 16;
  private nextChatter = 10;
  private chatterIndex = 0;
  private chapter: Chapter = 'academy';
  private restored = false;
  private disposed = false;
  private readonly speech = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  private readonly voicesChanged = () => this.changed();

  constructor(private readonly changed: () => void) {
    this.speech?.addEventListener('voiceschanged', this.voicesChanged);
  }

  voiceStatus(): MessageKey {
    if (this.audioError) return 'audioFailed';
    if (!this.enabled) return 'audioOff';
    if (this.speechError) return 'voiceFailed';
    return this.speech && localVoice(this.speech.getVoices(), getLanguage()) ? 'voiceLocal' : 'voiceUnavailable';
  }

  async enable(): Promise<void> {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const context = this.context;
        this.effectsGain = context.createGain();
        this.effectsGain.connect(context.destination);
        this.ambientGain = context.createGain();
        this.ambientGain.connect(context.destination);
        this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        this.wind = context.createBufferSource();
        this.wind.buffer = this.noise;
        this.wind.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350;
        this.wind.connect(filter).connect(this.ambientGain);
        this.wind.start();
      }
      await this.context.resume();
      if (this.disposed) return;
      this.enabled = true;
      this.audioError = false;
      this.updateGains();
    } catch (error) {
      console.error('Local game audio could not start:', error);
      if (this.context) {
        try { await this.context.close(); } catch (cleanupError) { console.error('Failed audio cleanup:', cleanupError); }
      }
      this.context = null;
      this.wind = null;
      this.ambientGain = this.effectsGain = null;
      this.noise = null;
      this.audioError = true;
      this.enabled = false;
    }
    this.changed();
  }

  disable(): void {
    this.enabled = false;
    this.stopSpeech();
    this.updateGains();
    this.changed();
  }

  setVolume(channel: AudioChannel, volume: number): void {
    this.volumes[channel] = Math.max(0, Math.min(1, volume));
    if (this.speechChannel === channel) this.stopSpeech();
    this.updateGains();
    this.changed();
  }

  private updateGains(): void {
    if (!this.context) return;
    const active = this.enabled && !document.hidden;
    this.effectsGain?.gain.setTargetAtTime(active ? this.volumes.effects : 0, this.context.currentTime, 0.03);
    this.ambientGain?.gain.setTargetAtTime(active ? this.volumes.ambience * 0.13 : 0, this.context.currentTime, 0.03);
  }

  visibilityChanged(): void {
    this.stopSpeech();
    this.updateGains();
  }

  setScene(chapter: Chapter, restored: boolean): void {
    if (chapter === this.chapter && restored === this.restored) return;
    this.stopSpeech();
    this.chapter = chapter;
    this.restored = restored;
    this.nextChatter = this.clock + 8;
    this.chatterIndex = 0;
    this.caption = '';
    this.changed();
  }

  effect(effect: SoundEffect, ambient = false): void {
    const context = this.context;
    const output = ambient ? this.ambientGain : this.effectsGain;
    if (!this.enabled || document.hidden || !context || context.state !== 'running' || !output) return;
    const tones: Record<SoundEffect, [number, number, number]> = {
      step: [95, 55, 0.08], cast: [440, 880, 0.45], cut: [1500, 140, 0.16],
      page: [700, 220, 0.15], creature: [900, 1500, 0.12], bell: [660, 660, 1.4], error: [160, 100, 0.2],
    };
    const [start, end, duration] = tones[effect];
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(effect === 'step' ? 0.15 : 0.25, context.currentTime + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    envelope.connect(output);
    const oscillator = context.createOscillator();
    oscillator.type = effect === 'cut' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + duration);
    oscillator.connect(envelope);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    if (effect === 'page' && this.noise) {
      const source = context.createBufferSource();
      source.buffer = this.noise;
      source.connect(envelope);
      source.start();
      source.stop(context.currentTime + duration);
      source.onended = () => source.disconnect();
    }
  }

  speak(text: string, channel: 'voice' | 'ambience' = 'voice'): void {
    if (!this.enabled || document.hidden || !this.speech || this.volumes[channel] === 0) return;
    const voice = localVoice(this.speech.getVoices(), getLanguage());
    if (!voice) { this.changed(); return; }
    this.stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    this.speechChannel = channel;
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.volume = this.volumes[channel];
    utterance.rate = channel === 'ambience' ? 1.05 : 0.92;
    utterance.onend = () => {
      if (this.utterance === utterance) { this.utterance = null; this.speechChannel = null; }
    };
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      console.error('Device-local narration failed:', event.error);
      this.speechError = true;
      this.utterance = null;
      this.speechChannel = null;
      this.changed();
    };
    this.speechError = false;
    this.speech.speak(utterance);
    this.changed();
  }

  stopSpeech(): void {
    if (this.utterance) this.speech?.cancel();
    this.utterance = null;
    this.speechChannel = null;
    this.caption = '';
    this.changed();
  }

  tick(seconds: number, canChatter: boolean): void {
    if (!this.enabled || document.hidden) return;
    this.clock += seconds;
    if (this.caption && this.clock > this.captionUntil) { this.caption = ''; this.changed(); }
    if (this.clock > this.nextCreature) {
      this.effect('creature', true);
      this.nextCreature = this.clock + 9;
    }
    if (this.clock > this.nextBell) {
      this.effect('bell', true);
      this.nextBell = this.clock + 19;
    }
    if (canChatter && humanChatterAllowed(this.chapter, this.restored) && this.clock > this.nextChatter && !this.utterance) {
      const phrases = ['chatterOne', 'chatterTwo', 'chatterThree'] as const;
      const phrase = t(phrases[this.chatterIndex++ % phrases.length]);
      if (this.volumes.ambience > 0) {
        this.speak(phrase, 'ambience');
        this.caption = phrase;
        this.captionUntil = this.clock + 7;
        this.changed();
      }
      this.nextChatter = this.clock + 13;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopSpeech();
    this.speech?.removeEventListener('voiceschanged', this.voicesChanged);
    this.wind?.stop();
    this.wind?.disconnect();
    this.effectsGain?.disconnect();
    this.ambientGain?.disconnect();
    if (this.context) void this.context.close().catch((error: unknown) => console.error('Audio cleanup failed:', error));
  }
}
