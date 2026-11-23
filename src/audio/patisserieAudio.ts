/**
 * Web Audio API Procedural Kitchen Foley & Salon Acoustics Engine
 * 纯代码程序化合成巴黎皇家甜品工坊全套厨房拟音与沙龙音效
 *
 * Refined voice-density throttling & anti-clipping envelopes for smooth high-frequency dragging.
 */

import { JudgmentTier } from '../types';

export type BgmTrackId = 'cozy_japanese' | 'garden_waltz';

export interface BgmTrackMeta {
  id: BgmTrackId;
  title: string;
  subtitle: string;
  url: string;
}

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio`;

export const BGM_TRACKS: Record<BgmTrackId, BgmTrackMeta> = {
  cozy_japanese: {
    id: 'cozy_japanese',
    title: 'Cozy Japanese',
    subtitle: '主音乐 · 日系乡村烘焙',
    url: `${AUDIO_BASE}/bgm_cozy_japanese.mp3`,
  },
  garden_waltz: {
    id: 'garden_waltz',
    title: '晨露吉他漫步',
    subtitle: '选放 · 22s起无缝循环',
    url: `${AUDIO_BASE}/bgm_garden_waltz.mp3`,
  },
};

export const BGM_TRACK_ORDER: BgmTrackId[] = ['cozy_japanese', 'garden_waltz'];

interface TrimmedLoopBounds {
  start: number;
  end: number;
}

/**
 * 扫描已解码 PCM AudioBuffer 的首尾有效振幅边界，消除 MP3 编码器的首尾静默帧，
 * 确保 AudioBufferSourceNode 在 loopStart -> loopEnd 之间实现 0ms 样本级无缝循环。
 */
function computeTrimmedLoopBounds(buffer: AudioBuffer): TrimmedLoopBounds {
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const threshold = 0.0008;
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let firstIdx = 0;
  for (let i = 0; i < len; i++) {
    let peak = 0;
    for (let c = 0; c < channels.length; c++) {
      const v = Math.abs(channels[c][i]);
      if (v > peak) peak = v;
    }
    if (peak > threshold) {
      firstIdx = Math.max(0, i - Math.floor(sr * 0.004));
      break;
    }
  }

  let lastIdx = len - 1;
  for (let i = len - 1; i > firstIdx; i--) {
    let peak = 0;
    for (let c = 0; c < channels.length; c++) {
      const v = Math.abs(channels[c][i]);
      if (v > peak) peak = v;
    }
    if (peak > threshold) {
      lastIdx = Math.min(len - 1, i + Math.floor(sr * 0.006));
      break;
    }
  }

  const start = firstIdx / sr;
  const end = Math.max(start + 1.0, lastIdx / sr);
  return { start, end: Math.min(buffer.duration, end) };
}

class PatisserieAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private safetyGain: GainNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private unlocked = false;
  private lastThrottleMap = new Map<string, number>();
  private radioPlaying = false;
  private radioIntervalId: number | null = null;
  private ambianceNode: AudioBufferSourceNode | null = null;
  private ambianceGain: GainNode | null = null;
  private ambianceExtraNodes: AudioNode[] = [];
  private ambianceIntervalId: number | null = null;
  private ambianceEnabled = false;
  private resumePromise: Promise<void> | null = null;
  private activeHarpStop: (() => void) | null = null;

  // 双 BGM 状态与异步解码缓存（默认主音乐 Cozy Japanese，另一首从 22s 无缝循环）
  private bgmEnabled = true;
  private bgmTrack: BgmTrackId = 'cozy_japanese';
  private bgmVolume = 0.34;
  private bgmBuffers = new Map<BgmTrackId, { buffer: AudioBuffer; bounds: TrimmedLoopBounds }>();
  private bgmLoadPromises = new Map<BgmTrackId, Promise<{ buffer: AudioBuffer; bounds: TrimmedLoopBounds } | null>>();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmPendingTrack: BgmTrackId | null = null;
  private bgmPlayingTrack: BgmTrackId | null = null;
  private bgmPlayToken = 0;
  private bgmListeners = new Set<() => void>();

  private ensureContext(fromUserGesture = false): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (fromUserGesture) {
      this.unlocked = true;
    }
    if (!this.unlocked && !this.ctx) {
      return null;
    }

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, ctx.currentTime);
      compressor.knee.setValueAtTime(24, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.004, ctx.currentTime);
      compressor.release.setValueAtTime(0.22, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : 0.66, ctx.currentTime);

      const safetyGain = ctx.createGain();
      safetyGain.gain.setValueAtTime(0.9, ctx.currentTime);

      master.connect(compressor);
      compressor.connect(safetyGain);
      safetyGain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.compressor = compressor;
      this.safetyGain = safetyGain;
      this.buildNoiseBuffers(ctx);
    }

    return this.ctx;
  }

  private async resumeIfNeeded(
    ctx: AudioContext,
    fromUserGesture = false,
  ): Promise<boolean> {
    if (ctx.state === 'running') return true;
    if (ctx.state === 'closed') return false;
    if (!fromUserGesture && !this.unlocked) return false;
    if (!this.resumePromise) {
      this.resumePromise = ctx
        .resume()
        .catch(() => {
          // Unlocked on next user pointer interaction
        })
        .finally(() => {
          this.resumePromise = null;
        });
    }
    await this.resumePromise;
    return (ctx.state as AudioContextState) === 'running';
  }

  private buildNoiseBuffers(ctx: AudioContext): void {
    const length = ctx.sampleRate * 2;

    const white = ctx.createBuffer(1, length, ctx.sampleRate);
    const wData = white.getChannelData(0);
    for (let i = 0; i < length; i++) {
      wData[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuffer = white;

    const pink = ctx.createBuffer(1, length, ctx.sampleRate);
    const pData = pink.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    this.pinkNoiseBuffer = pink;
  }

  private canTrigger(key: string, minIntervalMs: number): boolean {
    const now = performance.now();
    const last = this.lastThrottleMap.get(key) ?? 0;
    if (now - last < minIntervalMs) return false;
    this.lastThrottleMap.set(key, now);
    return true;
  }

  private runAudio(
    key: string,
    minIntervalMs: number,
    opts: {
      fromUserGesture?: boolean;
      needsWhiteNoise?: boolean;
      needsPinkNoise?: boolean;
    },
    render: (ctx: AudioContext, now: number) => void,
  ): void {
    if (this.muted) return;
    const fromGesture = opts.fromUserGesture ?? false;
    const ctx = this.ensureContext(fromGesture);
    if (!ctx || !this.masterGain) return;

    const tryInvoke = () => {
      if (this.muted || ctx.state !== 'running' || !this.masterGain) return;
      if (opts.needsWhiteNoise && !this.whiteNoiseBuffer) return;
      if (opts.needsPinkNoise && !this.pinkNoiseBuffer) return;
      if (!this.canTrigger(key, minIntervalMs)) return;
      render(ctx, ctx.currentTime);
    };

    if (ctx.state === 'running') {
      tryInvoke();
      return;
    }

    void this.resumeIfNeeded(ctx, fromGesture).then((ready) => {
      if (ready) tryInvoke();
    });
  }

  public async unlock(): Promise<void> {
    const ctx = this.ensureContext(true);
    if (ctx) {
      const ready = await this.resumeIfNeeded(ctx, true);
      if (ready && this.bgmEnabled && !this.muted && !this.bgmSource && !this.bgmPendingTrack) {
        void this.startBgmLoop(this.bgmTrack, 1.0);
      }
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.66, t, 0.03);
    }
    if (muted) {
      this.stopRadioLoop();
      this.stopAmbianceLoop();
      this.stopBgmLoop(0.12);
    } else {
      if (this.radioPlaying) {
        this.startRadioLoop();
      }
      if (this.ambianceEnabled) {
        this.startAmbianceLoop();
      }
      if (this.bgmEnabled) {
        void this.startBgmLoop(this.bgmTrack, 0.5);
      }
    }
    this.notifyBgmListeners();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isRadioPlaying(): boolean {
    return this.radioPlaying;
  }

  public isAmbianceEnabled(): boolean {
    return this.ambianceEnabled;
  }

  /**
   * 1. 细目铜筛落粉沙沙声 & 蛋白霜 J 字翻拌空气感
   */
  public playWhiskOrSift(mode: 'sift' | 'whisk' | 'fold' = 'sift'): void {
    this.runAudio(
      `whisk_${mode}`,
      mode === 'sift' ? 160 : 220,
      { fromUserGesture: false, needsWhiteNoise: true, needsPinkNoise: true },
      (ctx, now) => {
        if (mode === 'sift') {
          // Soft almond flour snow sifting through fine brass mesh (dual smooth bandpass, no harsh spike)
          const src = ctx.createBufferSource();
          src.buffer = this.pinkNoiseBuffer!;
          src.loop = true;

          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(2350 + Math.random() * 600, now);
          bp.Q.setValueAtTime(1.7, now);

          const shimmer = ctx.createBiquadFilter();
          shimmer.type = 'lowpass';
          shimmer.frequency.setValueAtTime(5000, now);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

          src.connect(bp);
          bp.connect(shimmer);
          shimmer.connect(gain);
          gain.connect(this.masterGain!);

          src.start(now, Math.random() * 1.1);
          src.stop(now + 0.24);
          return;
        }

        // Velvety rubber-spatula J-fold through meringue bubbles
        const src = ctx.createBufferSource();
        src.buffer = this.pinkNoiseBuffer!;
        src.loop = true;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(mode === 'fold' ? 1.5 : 2.1, now);
        bp.frequency.setValueAtTime(mode === 'fold' ? 460 : 1050, now);
        bp.frequency.exponentialRampToValueAtTime(mode === 'fold' ? 1280 : 2200, now + 0.16);
        bp.frequency.exponentialRampToValueAtTime(mode === 'fold' ? 540 : 960, now + 0.34);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(mode === 'fold' ? 0.18 : 0.15, now + 0.055);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.masterGain!);

        src.start(now, Math.random() * 1.0);
        src.stop(now + 0.38);
      },
    );
  }

  /**
   * 2a. 石板平炉黄铜门闩咔哒声 (Deck Oven Brass Door Latch / Clack)
   */
  public playOvenDoorClack(): void {
    this.playOvenDoorLatch();
  }

  public playOvenDoorLatch(): void {
    this.runAudio('oven_latch', 180, { fromUserGesture: true, needsPinkNoise: true }, (ctx, now) => {
      const click = ctx.createOscillator();
      const g = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(420, now);
      click.frequency.exponentialRampToValueAtTime(140, now + 0.055);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);

      click.connect(g);
      g.connect(this.masterGain!);
      click.start(now);
      click.stop(now + 0.09);

      const thud = ctx.createBufferSource();
      thud.buffer = this.pinkNoiseBuffer!;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, now);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.0001, now);
      tg.gain.linearRampToValueAtTime(0.12, now + 0.008);
      tg.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);
      thud.connect(lp);
      lp.connect(tg);
      tg.connect(this.masterGain!);
      thud.start(now, 0.2);
      thud.stop(now + 0.12);
    });
  }

  /**
   * 2b. 烤箱机械定时器清脆叮铃声 (Stone Deck Oven Brass Mechanical Bell)
   */
  public playOvenDing(doubleStrike = false): void {
    this.runAudio('oven_ding', 320, { fromUserGesture: false }, (ctx, now) => {
      const triggerBell = (startOffset: number, baseFreq: number) => {
        const t = now + startOffset;
        const partials = [
          { ratio: 1.0, amp: 0.125, decay: 1.35 },
          { ratio: 2.003, amp: 0.055, decay: 0.9 },
          { ratio: 2.756, amp: 0.038, decay: 0.58 },
          { ratio: 5.404, amp: 0.015, decay: 0.28 },
        ];

        partials.forEach((p) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq * p.ratio, t);

          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(p.amp, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

          osc.connect(g);
          g.connect(this.masterGain!);
          osc.start(t);
          osc.stop(t + p.decay + 0.04);
        });
      };

      triggerBell(0, 1975.53); // B6 warm brass bell
      if (doubleStrike) {
        triggerBell(0.17, 2489.02); // D#7 harmonic follow-up
      }
    });
  }

  /**
   * 2c. 复古石砌壁炉烤箱双音“叮咚”机械铃 (Vintage Cottage Hearth Oven Ding-Dong Chime)
   */
  public playOvenDingDong(): void {
    this.runAudio('oven_ding_dong', 420, { fromUserGesture: false }, (ctx, now) => {
      const strike = (offset: number, baseFreq: number, ampScale: number) => {
        const t = now + offset;
        const partials = [
          { ratio: 1.0, amp: 0.12 * ampScale, decay: 1.45 },
          { ratio: 2.002, amp: 0.048 * ampScale, decay: 0.92 },
          { ratio: 2.996, amp: 0.022 * ampScale, decay: 0.48 },
        ];
        partials.forEach((p) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq * p.ratio, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(p.amp, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
          osc.connect(g);
          g.connect(this.masterGain!);
          osc.start(t);
          osc.stop(t + p.decay + 0.05);
        });
      };

      // Warm nostalgic pastoral major-third chime (B6 -> G#6)
      strike(0.0, 1975.53, 1.0);
      strike(0.21, 1661.22, 0.92);
    });
  }

  /**
   * 2d. 榉木勺/铜筛轻叩陶碗与铜锅边缘的温润木质叩击声 (Cozy Beechwood-on-Rim ASMR Tap)
   */
  public playWoodRimTap(soft = false): void {
    this.runAudio(
      'wood_rim_tap',
      soft ? 260 : 170,
      { fromUserGesture: false, needsPinkNoise: true },
      (ctx, now) => {
        const amp = soft ? 0.055 : 0.095;

        // Warm hollow woody knock fundamental (beechwood + resonant copper/ceramic rim)
        const body = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        body.type = 'triangle';
        const startPitch = (soft ? 420 : 365) + Math.random() * 45;
        body.frequency.setValueAtTime(startPitch, now);
        body.frequency.exponentialRampToValueAtTime(startPitch * 0.56, now + 0.068);
        bodyGain.gain.setValueAtTime(0.0001, now);
        bodyGain.gain.linearRampToValueAtTime(amp, now + 0.004);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.088);
        body.connect(bodyGain);
        bodyGain.connect(this.masterGain!);
        body.start(now);
        body.stop(now + 0.095);

        // Subtle tactile rim click transient
        const click = ctx.createBufferSource();
        click.buffer = this.pinkNoiseBuffer!;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1480 + Math.random() * 280, now);
        bp.Q.setValueAtTime(3.2, now);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.0001, now);
        cg.gain.linearRampToValueAtTime(amp * 0.65, now + 0.003);
        cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);
        click.connect(bp);
        bp.connect(cg);
        cg.connect(this.masterGain!);
        click.start(now, Math.random() * 0.8);
        click.stop(now + 0.05);
      },
    );
  }

  /**
   * 3. 紫铜锅鲜果泥气泡咕嘟声 (Simmering Copper Pot Bubbles)
   */
  public playCopperPotBubble(intensity = 1): void {
    this.runAudio('copper_bubble', 170, { fromUserGesture: false, needsPinkNoise: true }, (ctx, now) => {
      const bubbleCount = intensity > 0.95 ? 2 : 1;

      for (let i = 0; i < bubbleCount; i++) {
        const delay = i * (0.055 + Math.random() * 0.045);
        const t = now + delay;
        const startFreq = 160 + Math.random() * 115;
        const endFreq = startFreq * (2.1 + Math.random() * 0.7);
        const dur = 0.08 + Math.random() * 0.04;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(endFreq * 0.85, t);
        filter.Q.setValueAtTime(3.0, t);

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.105 * Math.min(1.15, intensity), t + 0.016);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + dur + 0.02);
      }

      const sim = ctx.createBufferSource();
      sim.buffer = this.pinkNoiseBuffer!;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(420, now);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, now);
      sg.gain.linearRampToValueAtTime(0.05, now + 0.048);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      sim.connect(lp);
      lp.connect(sg);
      sg.connect(this.masterGain!);
      sim.start(now, Math.random());
      sim.stop(now + 0.26);
    });
  }

  /**
   * 4. 急速冷冻柜冷气嘶嘶声 (-25°C Cryogenic Blast Chiller Mist Hiss)
   */
  public playBlastChillerHiss(durationSec = 1.4): void {
    this.runAudio('chiller_hiss', 750, { fromUserGesture: false, needsWhiteNoise: true }, (ctx, now) => {
      const src = ctx.createBufferSource();
      src.buffer = this.whiteNoiseBuffer!;
      src.loop = true;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2600, now);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(5600, now);
      bp.frequency.exponentialRampToValueAtTime(3400, now + durationSec);
      bp.Q.setValueAtTime(1.1, now);

      const hissGain = ctx.createGain();
      hissGain.gain.setValueAtTime(0.0001, now);
      hissGain.gain.linearRampToValueAtTime(0.18, now + 0.1);
      hissGain.gain.setValueAtTime(0.15, now + durationSec * 0.42);
      hissGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      src.connect(hp);
      hp.connect(bp);
      bp.connect(hissGain);
      hissGain.connect(this.masterGain!);

      src.start(now);
      src.stop(now + durationSec + 0.05);

      const hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = 'triangle';
      hum.frequency.setValueAtTime(96, now);
      humGain.gain.setValueAtTime(0.0001, now);
      humGain.gain.linearRampToValueAtTime(0.048, now + 0.12);
      humGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
      hum.connect(humGain);
      humGain.connect(this.masterGain!);
      hum.start(now);
      hum.stop(now + durationSec + 0.05);
    });
  }

  /**
   * 5. 银刀切开脆底的层次酥脆声
   * Layer A: Sterling silver blade slicing mirror glaze
   * Layer B: Soft mousse glide
   * Layer C: Multi-grain hazelnut feuilletine crust crackle
   * Layer D: Delicate porcelain plate contact
   */
  public playSilverKnifeCrispCut(): void {
    this.runAudio(
      'silver_cut',
      340,
      { fromUserGesture: true, needsWhiteNoise: true, needsPinkNoise: true },
      (ctx, now) => {
        // Layer A: Sleek silver blade whisper
        const bladeOsc = ctx.createOscillator();
        const bladeGain = ctx.createGain();
        bladeOsc.type = 'sine';
        bladeOsc.frequency.setValueAtTime(4200, now);
        bladeOsc.frequency.exponentialRampToValueAtTime(2800, now + 0.15);

        bladeGain.gain.setValueAtTime(0.0001, now);
        bladeGain.gain.linearRampToValueAtTime(0.042, now + 0.018);
        bladeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

        bladeOsc.connect(bladeGain);
        bladeGain.connect(this.masterGain!);
        bladeOsc.start(now);
        bladeOsc.stop(now + 0.19);

        // Layer B: Silky mousse parting
        const mousseSrc = ctx.createBufferSource();
        mousseSrc.buffer = this.pinkNoiseBuffer!;
        const mousseBp = ctx.createBiquadFilter();
        mousseBp.type = 'bandpass';
        mousseBp.frequency.setValueAtTime(620, now + 0.05);
        mousseBp.Q.setValueAtTime(1.4, now + 0.05);
        const mousseG = ctx.createGain();
        mousseG.gain.setValueAtTime(0.0001, now + 0.04);
        mousseG.gain.linearRampToValueAtTime(0.08, now + 0.09);
        mousseG.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        mousseSrc.connect(mousseBp);
        mousseBp.connect(mousseG);
        mousseG.connect(this.masterGain!);
        mousseSrc.start(now + 0.04, 0.3);
        mousseSrc.stop(now + 0.24);

        // Layer C: Hazelnut feuilletine multi-grain crunch
        const crackleOffsets = [0.16, 0.198, 0.232, 0.27, 0.312];
        crackleOffsets.forEach((offset, idx) => {
          const t = now + offset;
          const grainDur = 0.032 + (idx % 2) * 0.016;

          // Crisp upper grain
          const noise = ctx.createBufferSource();
          noise.buffer = this.whiteNoiseBuffer!;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1750 + idx * 430 + Math.random() * 320, t);
          bp.Q.setValueAtTime(2.0, t);

          const g = ctx.createGain();
          const peak = idx === 1 || idx === 3 ? 0.19 : 0.14;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + grainDur);

          noise.connect(bp);
          bp.connect(g);
          g.connect(this.masterGain!);
          noise.start(t, Math.random() * 1.3);
          noise.stop(t + grainDur + 0.01);

          // Warm toasted biscuit body resonance
          const body = ctx.createOscillator();
          const bodyG = ctx.createGain();
          body.type = 'triangle';
          body.frequency.setValueAtTime(340 + idx * 55, t);
          body.frequency.exponentialRampToValueAtTime(140, t + 0.03);
          bodyG.gain.setValueAtTime(0.0001, t);
          bodyG.gain.linearRampToValueAtTime(0.06, t + 0.004);
          bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);
          body.connect(bodyG);
          bodyG.connect(this.masterGain!);
          body.start(t);
          body.stop(t + 0.045);
        });

        // Layer D: Delicate porcelain plate tap
        const tapT = now + 0.36;
        const tap = ctx.createOscillator();
        const tapGain = ctx.createGain();
        tap.type = 'sine';
        tap.frequency.setValueAtTime(1580, tapT);
        tapGain.gain.setValueAtTime(0.0001, tapT);
        tapGain.gain.linearRampToValueAtTime(0.065, tapT + 0.004);
        tapGain.gain.exponentialRampToValueAtTime(0.0001, tapT + 0.095);
        tap.connect(tapGain);
        tapGain.connect(this.masterGain!);
        tap.start(tapT);
        tap.stop(tapT + 0.11);
      },
    );
  }

  /**
   * 6. 星级颁发竖琴和弦 (Guide Rouge Award Harp Arpeggio)
   */
  public playMichelinHarpChord(stars: 1 | 2 | 3 = 3): void {
    this.runAudio('harp_chord', 1000, { fromUserGesture: false }, (ctx, now) => {
      // Preempt any earlier still-ringing harp arpeggio & feedback delay cleanly
      if (this.activeHarpStop) {
        this.activeHarpStop();
        this.activeHarpStop = null;
      }

      const baseNotes =
        stars === 3
          ? [261.63, 329.63, 392.0, 493.88, 587.33, 659.25, 783.99, 987.77, 1174.66]
          : stars === 2
            ? [261.63, 329.63, 392.0, 493.88, 587.33, 783.99]
            : [261.63, 329.63, 392.0, 523.25, 659.25];

      const chordBus = ctx.createGain();
      chordBus.gain.setValueAtTime(1.0, now);
      chordBus.connect(this.masterGain!);

      const delay = ctx.createDelay(0.6);
      delay.delayTime.setValueAtTime(0.19, now);
      const feedback = ctx.createGain();
      feedback.gain.setValueAtTime(0.24, now);
      feedback.gain.setValueAtTime(0.24, now + 2.8);
      feedback.gain.linearRampToValueAtTime(0.0, now + 4.1);
      const echoFilter = ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.setValueAtTime(2200, now);

      delay.connect(echoFilter);
      echoFilter.connect(feedback);
      feedback.connect(delay);
      echoFilter.connect(chordBus);

      const oscillators: OscillatorNode[] = [];
      let cleaned = false;

      baseNotes.forEach((freq, idx) => {
        const t = now + idx * 0.068;

        const fund = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const pluckFilter = ctx.createBiquadFilter();
        const g = ctx.createGain();

        fund.type = 'triangle';
        fund.frequency.setValueAtTime(freq, t);

        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(freq * 2, t);

        pluckFilter.type = 'lowpass';
        pluckFilter.frequency.setValueAtTime(freq * 4.8, t);
        pluckFilter.frequency.exponentialRampToValueAtTime(freq * 1.35, t + 1.4);

        const amp = 0.11 * (1 - idx * 0.045);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.014);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.15);

        const overGain = ctx.createGain();
        overGain.gain.setValueAtTime(0.28, t);

        fund.connect(pluckFilter);
        overtone.connect(overGain);
        overGain.connect(pluckFilter);
        pluckFilter.connect(g);
        g.connect(chordBus);
        g.connect(delay);

        fund.start(t);
        overtone.start(t);
        fund.stop(t + 2.25);
        overtone.stop(t + 2.25);
        oscillators.push(fund, overtone);
      });

      const disconnectNodes = () => {
        try {
          feedback.disconnect();
          echoFilter.disconnect();
          delay.disconnect();
          chordBus.disconnect();
        } catch {
          // Already disconnected
        }
      };

      const endTimeoutId = window.setTimeout(() => {
        if (cleaned) return;
        cleaned = true;
        if (this.activeHarpStop === stopPreempt) {
          this.activeHarpStop = null;
        }
        disconnectNodes();
      }, 4500);

      const stopPreempt = () => {
        if (cleaned) return;
        cleaned = true;
        window.clearTimeout(endTimeoutId);
        const stopAt = ctx.currentTime;
        chordBus.gain.cancelScheduledValues(stopAt);
        chordBus.gain.setValueAtTime(chordBus.gain.value, stopAt);
        chordBus.gain.linearRampToValueAtTime(0, stopAt + 0.025);
        feedback.gain.cancelScheduledValues(stopAt);
        feedback.gain.setValueAtTime(0, stopAt);
        oscillators.forEach((osc) => {
          try {
            osc.stop(stopAt + 0.03);
          } catch {
            // Already stopped
          }
        });
        window.setTimeout(disconnectNodes, 55);
      };

      this.activeHarpStop = stopPreempt;
    });
  }

  /**
   * 辅助工艺音效：大理石刮刀调温 / 象牙白巧薄屑卷
   */
  public playMarbleScrape(): void {
    this.runAudio('marble_scrape', 180, { fromUserGesture: false, needsPinkNoise: true }, (ctx, now) => {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer!;

      // Steel spatula gliding across cool honed Carrara marble
      const startHz = 960 + Math.random() * 240;
      const endHz = startHz + 680;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(startHz, now);
      bp.frequency.linearRampToValueAtTime(endHz, now + 0.16);
      bp.Q.setValueAtTime(3.1, now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.095, now + 0.036);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain!);
      src.start(now, Math.random());
      src.stop(now + 0.24);

      // Subtle stainless-blade high stone resonance shimmer
      const blade = ctx.createOscillator();
      const bg = ctx.createGain();
      blade.type = 'sine';
      blade.frequency.setValueAtTime(2280 + Math.random() * 180, now);
      blade.frequency.linearRampToValueAtTime(2620, now + 0.12);
      bg.gain.setValueAtTime(0.0001, now);
      bg.gain.linearRampToValueAtTime(0.016, now + 0.024);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      blade.connect(bg);
      bg.connect(this.masterGain!);
      blade.start(now);
      blade.stop(now + 0.16);
    });
  }

  public playChocCurlSnap(): void {
    this.runAudio('choc_snap', 160, { fromUserGesture: true }, (ctx, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.05);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.115, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.09);
    });
  }

  /**
   * 螺旋裱花挤注香草慕斯声 (Silky Mousse Spiral Piping)
   */
  public playMoussePipe(): void {
    this.runAudio('mousse_pipe', 190, { fromUserGesture: false, needsPinkNoise: true }, (ctx, now) => {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer!;

      // Soft compressed pastry-bag nozzle hiss + pillowy airy foam cushion
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1180, now);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(340 + Math.random() * 65, now);
      bp.frequency.exponentialRampToValueAtTime(720, now + 0.18);
      bp.Q.setValueAtTime(1.5, now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.092, now + 0.048);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      src.connect(lp);
      lp.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain!);
      src.start(now, Math.random());
      src.stop(now + 0.27);

      // Gentle creamy pneumatic puff inside piping bag
      const puff = ctx.createOscillator();
      const pg = ctx.createGain();
      puff.type = 'sine';
      puff.frequency.setValueAtTime(175, now);
      puff.frequency.exponentialRampToValueAtTime(118, now + 0.14);
      pg.gain.setValueAtTime(0.0001, now);
      pg.gain.linearRampToValueAtTime(0.036, now + 0.025);
      pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      puff.connect(pg);
      pg.connect(this.masterGain!);
      puff.start(now);
      puff.stop(now + 0.17);
    });
  }

  /**
   * 丝绒香缇奶盖柔润倾倒声 (Velvety Chantilly Cream Pour)
   */
  public playGlazePour(): void {
    this.runAudio('glaze_pour', 200, { fromUserGesture: false, needsPinkNoise: true }, (ctx, now) => {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer!;

      // Warm viscous lower body + glossy mid liquid ribbon sheen
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1060, now);

      const baseHz = 440 + Math.random() * 130;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(baseHz, now);
      bp.frequency.exponentialRampToValueAtTime(baseHz + 290, now + 0.22);
      bp.Q.setValueAtTime(1.2, now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);

      src.connect(lp);
      lp.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain!);
      src.start(now, Math.random());
      src.stop(now + 0.33);

      // Glossy warm liquid pour glug body
      const glug = ctx.createOscillator();
      const gg = ctx.createGain();
      glug.type = 'sine';
      glug.frequency.setValueAtTime(240 + Math.random() * 75, now + 0.03);
      glug.frequency.exponentialRampToValueAtTime(390 + Math.random() * 60, now + 0.15);
      gg.gain.setValueAtTime(0.0001, now + 0.03);
      gg.gain.linearRampToValueAtTime(0.032, now + 0.065);
      gg.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      glug.connect(gg);
      gg.connect(this.masterGain!);
      glug.start(now + 0.03);
      glug.stop(now + 0.19);
    });
  }

  /**
   * 精密黄铜镊点缀金箔 / 倒扣组装落位
   */
  public playTweezerClick(): void {
    this.runAudio('tweezer_click', 110, { fromUserGesture: true }, (ctx, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3280, now);
      osc.frequency.exponentialRampToValueAtTime(1960, now + 0.038);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.065, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.065);
    });
  }

  /**
   * 工艺判定回响和音 (Parfait / Très Bien / Passable)
   */
  public playJudgmentChime(tier: JudgmentTier): void {
    this.runAudio('judgment_chime', 280, { fromUserGesture: false }, (ctx, now) => {
      const notes =
        tier === 'parfait'
          ? [587.33, 880, 1174.66] // D5 - A5 - D6 radiant fifth
          : tier === 'tres_bien'
            ? [523.25, 783.99]
            : [440];

      notes.forEach((freq, i) => {
        const t = now + i * 0.055;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(g);
        g.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.58);
      });
    });
  }

  public playSoftUiTick(): void {
    this.runAudio('ui_tick', 70, { fromUserGesture: true }, (ctx, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1120, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.032, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.04);
    });
  }

  /**
   * 治愈系彩蛋：摸橘猫/花猫发出的撒娇轻喵与呼噜声
   */
  public playCatPurrAndMeow(): void {
    this.runAudio('cat_purr', 320, { fromUserGesture: true }, (ctx, now) => {
      // Soft upward-downward meow pitch contour
      const meow = ctx.createOscillator();
      const meowGain = ctx.createGain();
      meow.type = 'triangle';
      meow.frequency.setValueAtTime(520, now);
      meow.frequency.exponentialRampToValueAtTime(790, now + 0.14);
      meow.frequency.exponentialRampToValueAtTime(490, now + 0.34);

      meowGain.gain.setValueAtTime(0.0001, now);
      meowGain.gain.linearRampToValueAtTime(0.085, now + 0.06);
      meowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      meowGain.gain.linearRampToValueAtTime(0, now + 0.375);

      meow.connect(meowGain);
      meowGain.connect(this.masterGain!);
      meow.start(now);
      meow.stop(now + 0.38);

      // Warm rhythmic purr: keep AM modulation strictly unipolar [0.16..0.88] inside amGain,
      // then apply a zero-anchored outer envelope on envGain so gain never flips negative or pops on stop.
      const purrStart = now + 0.25;
      const purrEnd = now + 1.05;
      const purr = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const amGain = ctx.createGain();
      const envGain = ctx.createGain();

      purr.type = 'sine';
      purr.frequency.setValueAtTime(62, purrStart);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(24, purrStart);
      lfoGain.gain.setValueAtTime(0.36, purrStart);

      amGain.gain.setValueAtTime(0.52, purrStart);
      lfo.connect(lfoGain);
      lfoGain.connect(amGain.gain);

      envGain.gain.setValueAtTime(0.0001, purrStart);
      envGain.gain.linearRampToValueAtTime(0.062, purrStart + 0.11);
      envGain.gain.exponentialRampToValueAtTime(0.0001, purrEnd);
      envGain.gain.linearRampToValueAtTime(0, purrEnd + 0.025);

      purr.connect(amGain);
      amGain.connect(envGain);
      envGain.connect(this.masterGain!);

      purr.start(purrStart);
      lfo.start(purrStart);
      purr.stop(purrEnd + 0.035);
      lfo.stop(purrEnd + 0.035);
    });
  }

  /**
   * 治愈系彩蛋：红铜水壶轻柔蒸汽哨音
   */
  public playKettleWhistle(): void {
    this.runAudio('kettle_whistle', 400, { fromUserGesture: true }, (ctx, now) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1240, now);
      osc.frequency.exponentialRampToValueAtTime(1680, now + 0.24);
      osc.frequency.exponentialRampToValueAtTime(1540, now + 0.56);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.048, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.64);
    });
  }

  /**
   * 治愈系彩蛋：藤编蛋形吊椅轻摇藤条与林间风铃声 (Rattan Swing Chair Sway + Wind Chime)
   */
  public playSwingSwayChime(): void {
    this.runAudio('swing_sway_chime', 420, { fromUserGesture: true, needsPinkNoise: true }, (ctx, now) => {
      // Layer A: Soft flexing wicker rattan breeze whisper
      const wicker = ctx.createBufferSource();
      wicker.buffer = this.pinkNoiseBuffer!;
      wicker.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(340, now);
      bp.frequency.exponentialRampToValueAtTime(560, now + 0.18);
      bp.frequency.exponentialRampToValueAtTime(290, now + 0.44);
      bp.Q.setValueAtTime(1.6, now);

      const wg = ctx.createGain();
      wg.gain.setValueAtTime(0.0001, now);
      wg.gain.linearRampToValueAtTime(0.048, now + 0.08);
      wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
      wg.gain.linearRampToValueAtTime(0, now + 0.48);

      wicker.connect(bp);
      bp.connect(wg);
      wg.connect(this.masterGain!);
      wicker.start(now, Math.random() * 0.9);
      wicker.stop(now + 0.49);

      // Layer B: Delicate brass/bamboo porch wind-chime harmonic notes (E5 - G#5 - B5 - E6)
      const chimes = [659.25, 830.61, 987.77, 1318.51];
      chimes.forEach((freq, i) => {
        const t = now + 0.04 + i * 0.075;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.042 * (1 - i * 0.12), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
        g.gain.linearRampToValueAtTime(0, t + 0.87);

        osc.connect(g);
        g.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.88);
      });
    });
  }

  /**
   * 细目黄铜粉筛轻敲金属清响 + 细腻落粉微沙声
   */
  public playSieveBrassTap(): void {
    this.runAudio('sieve_brass_tap', 110, { fromUserGesture: false, needsPinkNoise: true }, (ctx, now) => {
      // Hand-hammered brass rim ring (inharmonic pair)
      const rimBase = 1940 + Math.random() * 140;
      [
        { freq: rimBase, type: 'triangle' as OscillatorType, amp: 0.052, decay: 0.062 },
        { freq: rimBase * 1.63, type: 'sine' as OscillatorType, amp: 0.028, decay: 0.048 },
      ].forEach((part) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = part.type;
        osc.frequency.setValueAtTime(part.freq, now);
        osc.frequency.exponentialRampToValueAtTime(part.freq * 0.84, now + part.decay);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(part.amp, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, now + part.decay);
        osc.connect(g);
        g.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + part.decay + 0.015);
      });

      // Delicate cloud of fine almond flour sifting off the mesh
      const snow = ctx.createBufferSource();
      snow.buffer = this.pinkNoiseBuffer!;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3050 + Math.random() * 400, now);
      bp.Q.setValueAtTime(2.0, now);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, now);
      sg.gain.linearRampToValueAtTime(0.062, now + 0.018);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      snow.connect(bp);
      bp.connect(sg);
      sg.connect(this.masterGain!);
      snow.start(now, Math.random());
      snow.stop(now + 0.12);
    });
  }

  /**
   * 硅胶刮刀 J 字翻拌面糊：丝滑奶油阻力感 + 微气泡轻啵声
   */
  public playBatterFoldCream(): void {
    this.runAudio('batter_fold_cream', 190, { fromUserGesture: false, needsPinkNoise: true }, (ctx, now) => {
      // Creamy spatula ribbon gliding inside glossy batter
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer!;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(1.35, now);
      bp.frequency.setValueAtTime(320, now);
      bp.frequency.exponentialRampToValueAtTime(920, now + 0.14);
      bp.frequency.exponentialRampToValueAtTime(380, now + 0.34);

      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, now);
      sg.gain.linearRampToValueAtTime(0.145, now + 0.055);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      src.connect(bp);
      bp.connect(sg);
      sg.connect(this.masterGain!);
      src.start(now, Math.random() * 1.1);
      src.stop(now + 0.37);

      // Soft batter suction pocket cushion
      const body = ctx.createOscillator();
      const bg = ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(112, now);
      body.frequency.exponentialRampToValueAtTime(168, now + 0.11);
      body.frequency.exponentialRampToValueAtTime(90, now + 0.27);
      bg.gain.setValueAtTime(0.0001, now);
      bg.gain.linearRampToValueAtTime(0.044, now + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      body.connect(bg);
      bg.connect(this.masterGain!);
      body.start(now);
      body.stop(now + 0.29);

      // Subtle folded meringue micro-bubbles
      [0.09, 0.21].forEach((offset, i) => {
        const t = now + offset;
        const pop = ctx.createOscillator();
        const pg = ctx.createGain();
        pop.type = 'sine';
        const f = 880 + i * 320 + Math.random() * 120;
        pop.frequency.setValueAtTime(f, t);
        pop.frequency.exponentialRampToValueAtTime(f * 1.38, t + 0.022);
        pg.gain.setValueAtTime(0.0001, t);
        pg.gain.linearRampToValueAtTime(0.026, t + 0.004);
        pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
        pop.connect(pg);
        pg.connect(this.masterGain!);
        pop.start(t);
        pop.stop(t + 0.036);
      });
    });
  }

  /**
   * 烤箱黄铜机械旋钮顿挫刻度咔哒声 (Rotary Oven Thermostat Detent)
   */
  public playOvenDialClick(): void {
    this.runAudio('oven_dial_click', 48, { fromUserGesture: true }, (ctx, now) => {
      const notch = ctx.createOscillator();
      const ng = ctx.createGain();
      notch.type = 'triangle';
      notch.frequency.setValueAtTime(940, now);
      notch.frequency.exponentialRampToValueAtTime(380, now + 0.022);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(0.075, now + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      notch.connect(ng);
      ng.connect(this.masterGain!);
      notch.start(now);
      notch.stop(now + 0.032);

      const housing = ctx.createOscillator();
      const hg = ctx.createGain();
      housing.type = 'sine';
      housing.frequency.setValueAtTime(195, now);
      housing.frequency.exponentialRampToValueAtTime(92, now + 0.026);
      hg.gain.setValueAtTime(0.0001, now);
      hg.gain.linearRampToValueAtTime(0.052, now + 0.003);
      hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
      housing.connect(hg);
      hg.connect(this.masterGain!);
      housing.start(now);
      housing.stop(now + 0.036);

      const escapement = ctx.createOscillator();
      const eg = ctx.createGain();
      escapement.type = 'sine';
      escapement.frequency.setValueAtTime(2860, now);
      eg.gain.setValueAtTime(0.0001, now);
      eg.gain.linearRampToValueAtTime(0.022, now + 0.002);
      eg.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      escapement.connect(eg);
      eg.connect(this.masterGain!);
      escapement.start(now);
      escapement.stop(now + 0.018);
    });
  }

  /**
   * Step 5 五重倒扣组装逐层质感落位声：
   * 0: 急冻果冻芯湿润贴合 / 1: 焦糖或柚子流心粘稠滴落 / 2: 戚风海绵软弹缓冲 / 3+: 榛果薄脆酥裂封底
   */
  public playStep5InsertDrop(layerIndex: number): void {
    const normalized = Math.max(0, Math.round(layerIndex));
    this.runAudio(
      `step5_insert_${normalized}`,
      150,
      { fromUserGesture: true, needsWhiteNoise: true, needsPinkNoise: true },
      (ctx, now) => {
        if (normalized === 0) {
          // Chilled coulis jelly wet squish + frost rim chime
          const squish = ctx.createOscillator();
          const sqg = ctx.createGain();
          squish.type = 'sine';
          squish.frequency.setValueAtTime(215, now);
          squish.frequency.exponentialRampToValueAtTime(340, now + 0.045);
          squish.frequency.exponentialRampToValueAtTime(160, now + 0.13);
          sqg.gain.setValueAtTime(0.0001, now);
          sqg.gain.linearRampToValueAtTime(0.095, now + 0.014);
          sqg.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
          squish.connect(sqg);
          sqg.connect(this.masterGain!);
          squish.start(now);
          squish.stop(now + 0.16);

          const wet = ctx.createBufferSource();
          wet.buffer = this.pinkNoiseBuffer!;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(740, now);
          bp.frequency.exponentialRampToValueAtTime(420, now + 0.11);
          bp.Q.setValueAtTime(1.8, now);
          const wg = ctx.createGain();
          wg.gain.setValueAtTime(0.0001, now);
          wg.gain.linearRampToValueAtTime(0.085, now + 0.015);
          wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
          wet.connect(bp);
          bp.connect(wg);
          wg.connect(this.masterGain!);
          wet.start(now, Math.random());
          wet.stop(now + 0.14);

          const chill = ctx.createOscillator();
          const cg = ctx.createGain();
          chill.type = 'sine';
          chill.frequency.setValueAtTime(2180, now + 0.01);
          cg.gain.setValueAtTime(0.0001, now + 0.01);
          cg.gain.linearRampToValueAtTime(0.025, now + 0.018);
          cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
          chill.connect(cg);
          cg.connect(this.masterGain!);
          chill.start(now + 0.01);
          chill.stop(now + 0.095);
          return;
        }

        if (normalized === 1) {
          // Glossy salted caramel / honey curd drip & slow viscous settle
          const drip = ctx.createOscillator();
          const dg = ctx.createGain();
          drip.type = 'sine';
          drip.frequency.setValueAtTime(265, now);
          drip.frequency.exponentialRampToValueAtTime(610, now + 0.095);
          dg.gain.setValueAtTime(0.0001, now);
          dg.gain.linearRampToValueAtTime(0.088, now + 0.012);
          dg.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
          drip.connect(dg);
          dg.connect(this.masterGain!);
          drip.start(now);
          drip.stop(now + 0.15);

          const syrup = ctx.createBufferSource();
          syrup.buffer = this.pinkNoiseBuffer!;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(340, now + 0.02);
          bp.frequency.exponentialRampToValueAtTime(590, now + 0.19);
          bp.Q.setValueAtTime(1.5, now + 0.02);
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(0.0001, now + 0.02);
          sg.gain.linearRampToValueAtTime(0.075, now + 0.055);
          sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          syrup.connect(bp);
          bp.connect(sg);
          sg.connect(this.masterGain!);
          syrup.start(now + 0.02, Math.random());
          syrup.stop(now + 0.23);
          return;
        }

        if (normalized === 2) {
          // Warm porous sponge biscuit cushion press
          const cushion = ctx.createOscillator();
          const cg = ctx.createGain();
          cushion.type = 'sine';
          cushion.frequency.setValueAtTime(155, now);
          cushion.frequency.exponentialRampToValueAtTime(86, now + 0.12);
          cg.gain.setValueAtTime(0.0001, now);
          cg.gain.linearRampToValueAtTime(0.092, now + 0.014);
          cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
          cushion.connect(cg);
          cg.connect(this.masterGain!);
          cushion.start(now);
          cushion.stop(now + 0.16);

          const crumb = ctx.createBufferSource();
          crumb.buffer = this.pinkNoiseBuffer!;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(920, now);
          bp.frequency.exponentialRampToValueAtTime(440, now + 0.13);
          bp.Q.setValueAtTime(1.25, now);
          const rg = ctx.createGain();
          rg.gain.setValueAtTime(0.0001, now);
          rg.gain.linearRampToValueAtTime(0.088, now + 0.018);
          rg.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
          crumb.connect(bp);
          bp.connect(rg);
          rg.connect(this.masterGain!);
          crumb.start(now, Math.random());
          crumb.stop(now + 0.16);
          return;
        }

        // Layer >= 3: Crisp hazelnut feuilletine crust multi-grain wafer crunch
        [0, 0.024, 0.048, 0.075].forEach((offset, i) => {
          const t = now + offset;
          const grain = ctx.createBufferSource();
          grain.buffer = this.whiteNoiseBuffer!;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1920 + i * 440 + Math.random() * 240, t);
          bp.Q.setValueAtTime(2.1, t);
          const gg = ctx.createGain();
          gg.gain.setValueAtTime(0.0001, t);
          gg.gain.linearRampToValueAtTime(i === 1 ? 0.13 : 0.098, t + 0.003);
          gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);
          grain.connect(bp);
          bp.connect(gg);
          gg.connect(this.masterGain!);
          grain.start(t, Math.random() * 1.1);
          grain.stop(t + 0.042);

          const wafer = ctx.createOscillator();
          const wg = ctx.createGain();
          wafer.type = 'triangle';
          wafer.frequency.setValueAtTime(360 + i * 60, t);
          wafer.frequency.exponentialRampToValueAtTime(145, t + 0.028);
          wg.gain.setValueAtTime(0.0001, t);
          wg.gain.linearRampToValueAtTime(0.046, t + 0.003);
          wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
          wafer.connect(wg);
          wg.connect(this.masterGain!);
          wafer.start(t);
          wafer.stop(t + 0.038);
        });
      },
    );
  }

  // Phase 11 semantic convenience delegates
  public playSieveShakeSound(): void {
    this.playSieveBrassTap();
    this.playWhiskOrSift('sift');
  }

  public playBatterFoldSound(): void {
    this.playBatterFoldCream();
  }

  public playCoulisStirSound(intensity = 1): void {
    this.playCopperPotBubble(intensity);
  }

  public playMarbleScraperSound(): void {
    this.playMarbleScrape();
  }

  public playPipingMousseSound(): void {
    this.playMoussePipe();
  }

  public playCoaxialInsertThud(layerIndex = 0): void {
    this.playStep5InsertDrop(layerIndex);
  }

  public playGlazePourStream(): void {
    this.playGlazePour();
  }

  public playSilverKnifeCut(): void {
    this.playSilverKnifeCrispCut();
  }

  private stopRadioLoop(): void {
    if (this.radioIntervalId !== null) {
      window.clearInterval(this.radioIntervalId);
      this.radioIntervalId = null;
    }
  }

  private startRadioLoop(): void {
    this.stopRadioLoop();
    if (!this.radioPlaying || this.muted) return;

    const ctx = this.ensureContext(true);
    if (!ctx) return;

    const triggerLoop = () => {
      if (this.muted || !this.radioPlaying) return;
      const playPhrase = () => {
        if (this.muted || !this.radioPlaying || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        // Gentle Ghibli/French pastoral waltz motif (F major pentatonic music box)
        const melody = [523.25, 659.25, 783.99, 698.46, 659.25, 587.33, 523.25, 440.0];
        melody.forEach((freq, idx) => {
          const t = now + idx * 0.34;
          const osc = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.036, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
          osc.connect(g);
          g.connect(this.masterGain!);
          osc.start(t);
          osc.stop(t + 0.56);
        });
      };

      this.stopRadioLoop();
      playPhrase();
      this.radioIntervalId = window.setInterval(playPhrase, 3100);
    };

    if (ctx.state === 'running') {
      triggerLoop();
      return;
    }

    void this.resumeIfNeeded(ctx, true).then((ready) => {
      if (ready) triggerLoop();
    });
  }

  /**
   * 治愈系彩蛋：复古核桃木收音机播放温暖法式音乐盒圆舞曲
   */
  public setRadioPlaying(playing: boolean): void {
    this.radioPlaying = playing;
    this.stopRadioLoop();
    if (!playing || this.muted) return;
    this.startRadioLoop();
  }

  private stopAmbianceLoop(): void {
    if (this.ambianceIntervalId !== null) {
      window.clearInterval(this.ambianceIntervalId);
      this.ambianceIntervalId = null;
    }

    const node = this.ambianceNode;
    const gain = this.ambianceGain;
    const extraNodes = this.ambianceExtraNodes;
    this.ambianceNode = null;
    this.ambianceGain = null;
    this.ambianceExtraNodes = [];

    const fadeGainNode = (gNode: GainNode) => {
      if (this.ctx && this.ctx.state === 'running') {
        const t = this.ctx.currentTime;
        gNode.gain.cancelScheduledValues(t);
        gNode.gain.setValueAtTime(gNode.gain.value, t);
        gNode.gain.linearRampToValueAtTime(0.0001, t + 0.045);
      }
    };

    const stopSourceNode = (srcNode: AudioScheduledSourceNode) => {
      if (this.ctx && this.ctx.state === 'running') {
        try {
          srcNode.stop(this.ctx.currentTime + 0.055);
        } catch {
          // already stopped
        }
      } else {
        try {
          srcNode.stop();
        } catch {
          // already stopped
        }
      }
    };

    if (gain) fadeGainNode(gain);
    if (node) stopSourceNode(node);

    extraNodes.forEach((extra) => {
      if (extra instanceof GainNode) {
        fadeGainNode(extra);
      } else if ('stop' in extra && typeof (extra as AudioScheduledSourceNode).stop === 'function') {
        stopSourceNode(extra as AudioScheduledSourceNode);
      }
    });

    const cleanupNow = () => {
      try {
        node?.disconnect();
        gain?.disconnect();
      } catch {
        // already disconnected
      }
      extraNodes.forEach((extra) => {
        try {
          extra.disconnect();
        } catch {
          // already disconnected
        }
      });
    };

    if (this.ctx && this.ctx.state === 'running') {
      window.setTimeout(cleanupNow, 85);
    } else {
      cleanupNow();
    }
  }

  private startAmbianceLoop(): void {
    this.stopAmbianceLoop();
    if (!this.ambianceEnabled || this.muted) return;

    const ctx = this.ensureContext(true);
    if (!ctx) return;

    const startProvencalGarden = () => {
      if (this.muted || !this.ambianceEnabled || !this.masterGain || !this.pinkNoiseBuffer) return;
      this.stopAmbianceLoop();

      const now = ctx.currentTime;

      // Gentle sunlit Provençal garden brook & soft meadow breeze
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(720, now);
      bp.Q.setValueAtTime(0.75, now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.024, now + 0.8);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start();
      this.ambianceNode = src;
      this.ambianceGain = g;
      this.ambianceExtraNodes.push(bp);

      // Occasional cheerful Provençal woodland bird chirp
      this.ambianceIntervalId = window.setInterval(() => {
        if (this.muted || !this.ambianceEnabled || !this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        osc.type = 'sine';
        const base = 2400 + Math.random() * 650;
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(base * 0.96, t + 0.16);
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.linearRampToValueAtTime(0.018, t + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.connect(bg);
        bg.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.20);
      }, 4200);
    };

    if (ctx.state === 'running') {
      startProvencalGarden();
      return;
    }

    void this.resumeIfNeeded(ctx, true).then((ready) => {
      if (ready) startProvencalGarden();
    });
  }

  /**
   * 治愈系普罗旺斯阳光花园自然环境音：柔和溪流微风 + 偶发林间鸟鸣
   */
  public setGardenAmbiance(enabled: boolean): void {
    this.ambianceEnabled = enabled;
    this.stopAmbianceLoop();
    if (!enabled || this.muted) return;
    this.startAmbianceLoop();
  }

  // ========================================================================
  // 双 BGM 背景音乐系统（主音乐 Cozy Japanese + 22s 无缝循环选放曲）
  // ========================================================================

  private notifyBgmListeners(): void {
    this.bgmListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // 忽略 UI 订阅方异常
      }
    });
  }

  public subscribeBgm(listener: () => void): () => void {
    this.bgmListeners.add(listener);
    return () => {
      this.bgmListeners.delete(listener);
    };
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public getBgmTrack(): BgmTrackId {
    return this.bgmTrack;
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public isBgmPlaying(): boolean {
    return this.bgmEnabled && !this.muted && this.bgmSource !== null;
  }

  private async loadBgmBuffer(
    trackId: BgmTrackId,
    ctx: AudioContext,
  ): Promise<{ buffer: AudioBuffer; bounds: TrimmedLoopBounds } | null> {
    const cached = this.bgmBuffers.get(trackId);
    if (cached) return cached;

    let pending = this.bgmLoadPromises.get(trackId);
    if (!pending) {
      const meta = BGM_TRACKS[trackId];
      pending = (async () => {
        try {
          const resp = await fetch(meta.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const arrayBuf = await resp.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrayBuf);
          const bounds = computeTrimmedLoopBounds(decoded);
          const entry = { buffer: decoded, bounds };
          this.bgmBuffers.set(trackId, entry);
          return entry;
        } catch (err) {
          console.warn(`[patisserieAudio] 加载 BGM (${meta.title}) 失败:`, err);
          return null;
        } finally {
          this.bgmLoadPromises.delete(trackId);
        }
      })();
      this.bgmLoadPromises.set(trackId, pending);
    }

    return pending;
  }

  private stopBgmLoop(fadeSec = 0.25): void {
    this.bgmPlayToken += 1;
    this.bgmPendingTrack = null;
    this.bgmPlayingTrack = null;
    const oldSrc = this.bgmSource;
    const oldGain = this.bgmGain;
    this.bgmSource = null;
    this.bgmGain = null;
    if (!oldSrc && !oldGain) return;

    const ctx = this.ctx;
    if (ctx && ctx.state === 'running' && oldGain) {
      const now = ctx.currentTime;
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
      oldGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      if (oldSrc) {
        try {
          oldSrc.stop(now + fadeSec + 0.03);
        } catch {
          // already stopped
        }
      }
      window.setTimeout(() => {
        try {
          oldSrc?.disconnect();
          oldGain.disconnect();
        } catch {
          // already disconnected
        }
      }, Math.ceil((fadeSec + 0.08) * 1000));
    } else {
      try {
        oldSrc?.stop();
        oldSrc?.disconnect();
        oldGain?.disconnect();
      } catch {
        // already stopped
      }
    }
  }

  private async startBgmLoop(trackId: BgmTrackId, fadeInSec = 0.85): Promise<void> {
    if (!this.bgmEnabled || this.muted) return;
    if ((this.bgmSource && this.bgmPlayingTrack === trackId) || this.bgmPendingTrack === trackId) {
      return;
    }
    const ctx = this.ensureContext(true);
    if (!ctx || !this.masterGain) return;

    const ready = await this.resumeIfNeeded(ctx, true);
    if (!ready || !this.bgmEnabled || this.muted) return;

    this.bgmPendingTrack = trackId;
    const token = ++this.bgmPlayToken;
    const loaded = await this.loadBgmBuffer(trackId, ctx);
    if (this.bgmPendingTrack === trackId) {
      this.bgmPendingTrack = null;
    }
    if (!loaded || token !== this.bgmPlayToken || !this.bgmEnabled || this.muted || this.bgmTrack !== trackId) {
      return;
    }

    // 淡出已有声源后启动新无缝循环源
    const prevSrc = this.bgmSource;
    const prevGain = this.bgmGain;
    const now = ctx.currentTime;
    if (prevGain && prevSrc) {
      prevGain.gain.cancelScheduledValues(now);
      prevGain.gain.setValueAtTime(Math.max(0.0001, prevGain.gain.value), now);
      prevGain.gain.linearRampToValueAtTime(0.0001, now + 0.35);
      try {
        prevSrc.stop(now + 0.38);
      } catch {
        // already stopped
      }
      window.setTimeout(() => {
        try {
          prevSrc.disconnect();
          prevGain.disconnect();
        } catch {
          // already disconnected
        }
      }, 420);
    }

    const src = ctx.createBufferSource();
    src.buffer = loaded.buffer;
    src.loop = true;
    src.loopStart = loaded.bounds.start;
    src.loopEnd = loaded.bounds.end;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, this.bgmVolume), now + fadeInSec);

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start(now, loaded.bounds.start);

    this.bgmSource = src;
    this.bgmGain = gain;
    this.bgmPlayingTrack = trackId;
    this.notifyBgmListeners();
  }

  public setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    if (!enabled || this.muted) {
      this.stopBgmLoop(0.28);
    } else {
      void this.startBgmLoop(this.bgmTrack, 0.75);
    }
    this.notifyBgmListeners();
  }

  public setBgmTrack(trackId: BgmTrackId): void {
    this.bgmTrack = trackId;
    if (!this.bgmEnabled) {
      this.bgmEnabled = true;
    }
    if (!this.muted) {
      void this.startBgmLoop(trackId, 0.65);
    }
    this.notifyBgmListeners();
  }

  public setBgmVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.bgmVolume = clamped;
    if (this.ctx && this.bgmGain && this.ctx.state === 'running' && this.bgmEnabled && !this.muted) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(Math.max(0.0001, clamped), now, 0.04);
    }
    this.notifyBgmListeners();
  }
}

export const patisserieAudio = new PatisserieAudioEngine();
export default patisserieAudio;
