export class TacticalAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rain: AudioBufferSourceNode | null = null;
  private volume = .45;
  private noiseSeed = 0x6d2b79f5;

  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * .48;
      this.master.connect(this.ctx.destination);
      const buffer = this.noise(3);
      this.rain = this.ctx.createBufferSource();
      this.rain.buffer = buffer;
      this.rain.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 650;
      const gain = this.ctx.createGain(); gain.gain.value = .07;
      this.rain.connect(filter); filter.connect(gain); gain.connect(this.master);
      this.rain.start();
    } catch { /* Audio remains optional on restricted browsers. */ }
  }

  private noise(duration: number) {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = this.noiseSeed;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 4294967296 * 2 - 1; }
    this.noiseSeed = seed;
    return buffer;
  }

  setVolume(value: number) {
    this.volume = value / 100;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume * .48, this.ctx.currentTime, .08);
  }

  private tone(freq: number, duration: number, gainValue: number, type: OscillatorType = 'sine', endFreq?: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    gain.gain.setValueAtTime(gainValue, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(); osc.stop(t + duration);
  }

  private burst(duration: number, frequency: number, value: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource(); source.buffer = this.noise(duration);
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(value, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start();
  }

  shoot(nonlethal = false, distant = false) {
    this.burst(nonlethal ? .19 : .12, distant ? 650 : 2400, distant ? .16 : .53);
    this.tone(nonlethal ? 95 : 140, .13, distant ? .08 : .24, 'triangle', 35);
    if (!distant) this.tone(1300, .018, .075, 'square', 600);
  }
  step() { this.burst(.095, 480, .105); this.tone(70, .07, .07, 'triangle', 35); }
  click() { this.tone(760, .035, .1, 'sine'); }
  radio() { this.tone(1550, .055, .055, 'sine'); }
  reload() { this.burst(.14, 2500, .23); this.tone(430, .06, .09, 'square', 180); }
  door() { this.burst(.46, 800, .48); this.tone(100, .4, .25, 'triangle', 25); }
  hit() { this.burst(.12, 800, .25); }
  flashbang() { this.burst(.68, 4300, .72); this.tone(3100, .7, .065); }
  success() { this.tone(440, .24, .12); window.setTimeout(() => this.tone(554, .24, .12), 160); window.setTimeout(() => this.tone(660, .55, .12), 320); }
  speak(text: string) {
    if (!('speechSynthesis' in window) || !this.volume) return;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text);
    message.rate = .95; message.pitch = .72; message.volume = this.volume * .55;
    window.speechSynthesis.speak(message);
  }
  dispose() {
    this.rain?.stop();
    if (this.ctx) void this.ctx.close();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.ctx = null;
  }
}
