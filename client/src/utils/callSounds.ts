/**
 * =====================================================
 * CALL SOUNDS UTILITY
 * =====================================================
 * 
 * Manages audio feedback for calls:
 * - Ringtone for incoming calls
 * - Ringback tone for outgoing calls
 * - Call end sound
 * 
 * Uses Web Audio API for generating tones programmatically
 * (no external audio files needed)
 */

class CallSounds {
  private audioContext: AudioContext | null = null;
  private ringtoneInterval: NodeJS.Timeout | null = null;
  private ringbackInterval: NodeJS.Timeout | null = null;
  private currentOscillator: OscillatorNode | null = null;
  private currentGain: GainNode | null = null;

  /**
   * Initialize AudioContext (must be called after user interaction)
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Play a single tone
   */
  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.3
  ): Promise<void> {
    return new Promise((resolve) => {
      const ctx = this.getAudioContext();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      // Fade in
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
      
      // Fade out
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration - 0.02);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);

      oscillator.onended = () => resolve();
    });
  }

  /**
   * Play dual tone (DTMF-like)
   */
  private playDualTone(
    freq1: number,
    freq2: number,
    duration: number,
    volume: number = 0.2
  ): Promise<void> {
    return new Promise((resolve) => {
      const ctx = this.getAudioContext();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq2, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration - 0.02);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + duration);
      osc2.stop(ctx.currentTime + duration);

      osc1.onended = () => resolve();
    });
  }

  /**
   * Play ringtone for incoming calls
   * Pattern: Two tones with pause, repeating
   */
  async playRingtone() {
    this.stopAll();
    
    const playRingPattern = async () => {
      // Classic phone ring pattern: two quick tones
      await this.playDualTone(440, 480, 0.4, 0.25);
      await this.delay(100);
      await this.playDualTone(440, 480, 0.4, 0.25);
    };

    // Play immediately
    playRingPattern();
    
    // Repeat every 3 seconds
    this.ringtoneInterval = setInterval(() => {
      playRingPattern();
    }, 3000);
  }

  /**
   * Play ringback tone for outgoing calls
   * Pattern: Long tone with pause, repeating (like when you're waiting)
   */
  async playRingback() {
    this.stopAll();

    const playRingbackPattern = async () => {
      // US ringback tone: 440Hz + 480Hz for 2s, then 4s silence
      await this.playDualTone(440, 480, 2, 0.15);
    };

    // Play immediately
    playRingbackPattern();
    
    // Repeat every 6 seconds (2s tone + 4s silence)
    this.ringbackInterval = setInterval(() => {
      playRingbackPattern();
    }, 6000);
  }

  /**
   * Play call connected sound
   */
  async playConnected() {
    this.stopAll();
    // Pleasant ascending tones
    await this.playTone(523.25, 0.15, "sine", 0.2); // C5
    await this.delay(50);
    await this.playTone(659.25, 0.15, "sine", 0.2); // E5
    await this.delay(50);
    await this.playTone(783.99, 0.2, "sine", 0.2);  // G5
  }

  /**
   * Play call ended sound
   */
  async playEnded() {
    this.stopAll();
    // Descending tones indicate end
    await this.playTone(523.25, 0.15, "sine", 0.2); // C5
    await this.delay(50);
    await this.playTone(392, 0.15, "sine", 0.2);    // G4
    await this.delay(50);
    await this.playTone(329.63, 0.25, "sine", 0.2); // E4
  }

  /**
   * Play call declined/busy sound
   */
  async playDeclined() {
    this.stopAll();
    // Busy tone: fast beeping
    for (let i = 0; i < 3; i++) {
      await this.playDualTone(480, 620, 0.25, 0.2);
      await this.delay(250);
    }
  }

  /**
   * Stop all sounds
   */
  stopAll() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
      } catch {
        // Already stopped
      }
      this.currentOscillator = null;
    }
    // Also suspend audio context to immediately stop any playing sounds
    if (this.audioContext && this.audioContext.state === "running") {
      this.audioContext.suspend().then(() => {
        // Resume it for future sounds
        this.audioContext?.resume();
      });
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up
   */
  dispose() {
    this.stopAll();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const callSounds = new CallSounds();
