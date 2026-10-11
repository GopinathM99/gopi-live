(function (root) {
  'use strict';
  class Sound {
    constructor() { this.enabled = true; this.context = null; this.nextBeat = 0; this.beat = 0; this.last = {}; }
    init() {
      if (!this.context) {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain(); this.master.gain.value = .18; this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }
    tone(frequency, duration, type = 'sine', volume = .2, end = frequency, delay = 0) {
      if (!this.context || !this.enabled) return;
      const t = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .005); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
      osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration + .02);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    event(type) {
      if (!this.context || !this.enabled) return;
      const now = this.context.currentTime;
      const gap = type === 'shoot' ? .12 : type === 'pickup' ? .1 : .04;
      if (now - (this.last[type] ?? -100) < gap) return;
      this.last[type] = now;
      if (type === 'shoot') this.tone(420, .07, 'triangle', .12, 150);
      if (type === 'pickup') this.tone(880, .06, 'sine', .10, 1200);
      if (type === 'hurt') this.tone(120, .2, 'sawtooth', .25, 50);
      if (type === 'dash') this.tone(130, .15, 'triangle', .25, 700);
      if (type === 'rocket') this.tone(170, .2, 'sawtooth', .1, 60);
      if (type === 'zap') this.tone(1100, .13, 'square', .07, 220);
      if (type === 'heal' || type === 'magnet') { this.tone(660, .12, 'sine', .2); this.tone(990, .2, 'sine', .18, 990, .08); }
      if (['level', 'evolution', 'victory', 'bossDown', 'surge'].includes(type)) [523, 659, 784, 1046].forEach((n, i) => this.tone(n, .3, 'triangle', .25, n, i * .08));
      if (type === 'boss') [130, 123, 98].forEach((n, i) => this.tone(n, .45, 'sawtooth', .2, n, i * .15));
      if (type === 'over') [392, 330, 262].forEach((n, i) => this.tone(n, .3, 'triangle', .2, n, i * .14));
    }
    tick(playing, surge = false) {
      if (!playing || !this.context || !this.enabled) { this.nextBeat = 0; return; }
      const now = this.context.currentTime;
      if (now < this.nextBeat) return;
      this.nextBeat = now + (surge ? .2 : .27);
      const notes = [262, 330, 392, 440, 392, 330, 294, 330, 220, 262, 330, 392, 330, 294, 262, 294];
      const i = this.beat++ % 16;
      this.tone(notes[i], .16, 'sine', .045);
      if (i % 4 === 0) { this.tone(notes[i] / 2, .3, 'triangle', .12); this.tone(90, .12, 'sine', .2, 35); }
      if (i % 4 === 2) this.tone(1300, .025, 'triangle', .05, 700);
    }
  }
  root.PocketSound = Sound;
})(globalThis);
