/**
 * Simple Sound Manager using Web Audio API (Oscillators)
 * No external assets required.
 */

class SoundManager {
    constructor() {
        if (typeof window !== 'undefined') {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playTone(freq, type, duration, startTime = 0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime + startTime;
        osc.start(now);

        // Envelope to avoid clicking
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.stop(now + duration);
    }

    playSuccess() {
        // Happy major chord arpeggio
        this.playTone(523.25, 'sine', 0.1, 0);   // C5
        this.playTone(659.25, 'sine', 0.1, 0.1); // E5
        this.playTone(783.99, 'sine', 0.2, 0.2); // G5
    }

    playFail() {
        // Sad buzzer
        this.playTone(150, 'sawtooth', 0.3, 0);
    }

    playComplete() {
        // Victory fanfare
        this.playTone(523.25, 'square', 0.1, 0);
        this.playTone(523.25, 'square', 0.1, 0.1);
        this.playTone(523.25, 'square', 0.1, 0.2);
        this.playTone(783.99, 'square', 0.4, 0.3);
    }

    playClick() {
        // Soft UI tick
        this.playTone(800, 'sine', 0.05, 0);
    }
}

const soundManager = new SoundManager();
export default soundManager;
