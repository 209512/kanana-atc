// src/utils/audioService.ts
import { logger } from './logger';

class AudioService {
  private ctx: AudioContext | null = null;
  private lastPlayTime: number = 0;
  private readonly MIN_INTERVAL = 0.05;
  private isActivated: boolean = false;

  private audioQueue: Array<{ type: 'pcm' | 'tts', data: string, sampleRate?: number, lang?: string }> = [];
  private isPlayingQueue: boolean = false;
  private onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
  private nextStartTime: number = 0;

  public setPlayStateCallback(callback: (isPlaying: boolean) => void) {
    this.onPlayStateChange = callback;
  }

  private setPlayingState(state: boolean) {
    this.isPlayingQueue = state;
    if (this.onPlayStateChange) {
      this.onPlayStateChange(state);
    }
  }

  constructor() {
    if (typeof window !== 'undefined') {
      const initAudio = () => {
        const context = this.getContext();
        if (context.state === 'suspended') {
          context.resume().then(() => {
            this.isActivated = true;
            window.removeEventListener('click', initAudio);
          }).catch((err) => {
            logger.error("AudioContext resume failed:", err);
            // Failed to resume, but we should remove the listener to avoid infinite errors on each click
            window.removeEventListener('click', initAudio);
          });
        } else {
          this.isActivated = true;
          window.removeEventListener('click', initAudio);
        }
      };
      window.addEventListener('click', initAudio);
    }
  }

  private async processQueue() {
    if (this.isPlayingQueue || this.audioQueue.length === 0) return;
    this.setPlayingState(true);

    while (this.audioQueue.length > 0) {
      const task = this.audioQueue.shift();
      if (!task) continue;

      try {
        if (task.type === 'pcm') {
          await this._playPCM(task.data, task.sampleRate || 24000);
        } else if (task.type === 'tts') {
          await this._playTTS(task.data, task.lang);
        }
      } catch (err) {
        logger.error("Audio playback error:", err);
      }
    }

    this.setPlayingState(false);
  }

  private _playPCM(base64Data: string, sampleRate: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isActivated) return resolve();
      const ctx = this.getContext();
      
      try {
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Int16Array(len / 2);
        
        // COMPATIBILITY: Parse 16-bit PCM as little-endian safely via DataView
        const buffer = new ArrayBuffer(len);
        const view = new DataView(buffer);
        for (let i = 0; i < len; i++) {
          view.setUint8(i, binaryString.charCodeAt(i));
        }
        for (let i = 0; i < len; i += 2) {
          bytes[i / 2] = view.getInt16(i, true);
        }

        const audioBuffer = ctx.createBuffer(1, bytes.length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < bytes.length; i++) {
          channelData[i] = bytes[i] / 32768.0;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const currentTime = ctx.currentTime;
        if (this.nextStartTime < currentTime) {
          this.nextStartTime = currentTime;
        }
        
        source.start(this.nextStartTime);
        
        this.nextStartTime += audioBuffer.duration;

        source.onended = () => resolve();
      } catch (e) {
        logger.warn("Failed to play PCM audio:", e);
        resolve();
      }
    });
  }

  private _playTTS(text: string, lang: string = 'ko-KR'): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  }

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.ctx;
  }

  play(frequency: number, type: OscillatorType, duration: number, volume: number) {
    if (!this.isActivated) return;

    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      if (now - this.lastPlayTime < this.MIN_INTERVAL) return;
      this.lastPlayTime = now;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      logger.warn("Audio playback error in play method:", e);
    }
  }
  
  // QUEUE: Push Base64 PCM data to audio queue (Kanana-O 24kHz standard)
  async playPCM(base64Data: string, sampleRate: number = 24000) {
    this.audioQueue.push({ type: 'pcm', data: base64Data, sampleRate });
    this.processQueue();
  }

  // FALLBACK: Queue Web Speech API TTS for Lite Version
  playTTS(text: string, lang: string = 'ko-KR') {
    this.audioQueue.push({ type: 'tts', data: text, lang });
    this.processQueue();
  }
}

export const audioService = new AudioService();
