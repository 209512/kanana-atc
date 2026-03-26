// src/utils/audioService.ts
class AudioService {
  private ctx: AudioContext | null = null;
  private lastPlayTime: number = 0;
  private readonly MIN_INTERVAL = 0.05;
  private isActivated: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const initAudio = () => {
        const context = this.getContext();
        if (context.state === 'suspended') {
          context.resume().then(() => {
            this.isActivated = true;
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

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    }
  }
  
  /**
   * 카나나 API에서 온 Base64 PCM 데이터를 재생
   * @param base64Data PCM 데이터
   * @param sampleRate 카나나 표준 24000Hz
   */
  async playPCM(base64Data: string, sampleRate: number = 24000) {
    if (!this.isActivated) return;
    const ctx = this.getContext();
    
    // Base64를 ArrayBuffer로 변환
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
    }

    // AudioBuffer 생성 및 재생
    const audioBuffer = ctx.createBuffer(1, bytes.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) {
      channelData[i] = bytes[i] / 32768.0; // PCM 16bit Float 변환
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  }
}

export const audioService = new AudioService();