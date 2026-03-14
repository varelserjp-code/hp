/* ═══════════════════════════════════════════════════
   MEIKYOSHISUI v23.0 — CC Automation Engine
   CC Automation Lanes: MIDI CC (Mod/Filter/Reverb等) を
   テンションカーブ / 正弦波 / ランダムウォーク / ステップシーケンスで自動生成。
   専用チャンネル (デフォルト ch16=0x0F) に書き込む独立トラックとして出力。
═══════════════════════════════════════════════════ */
const CCAutoEngine = (() => {

  /* ── 既定 CC 名リスト ── */
  const CC_NAMES = {
    1:  'Modulation',
    7:  'Volume',
    10: 'Pan',
    11: 'Expression',
    64: 'Sustain',
    71: 'Resonance',
    74: 'Filter Cutoff',
    91: 'Reverb',
    93: 'Chorus',
    94: 'Detune/Celeste',
    95: 'Phaser',
    5:  'Portamento Time',
    65: 'Portamento',
    72: 'Release Time',
    73: 'Attack Time',
    75: 'Decay Time',
    76: 'Vibrato Rate',
    77: 'Vibrato Depth',
    78: 'Vibrato Delay',
  };

  /* ── Wave シェイプ関数 (t = 0-1, 1周期) ── */
  const WAVE_SHAPES = {
    'Sine':         t => 0.5 + 0.5 * Math.sin(t * Math.PI * 2),
    'Cosine':       t => 0.5 + 0.5 * Math.cos(t * Math.PI * 2),
    'Triangle':     t => t < 0.5 ? t * 2 : 2 - t * 2,
    'Sawtooth Up':  t => t,
    'Sawtooth Dn':  t => 1 - t,
    'Square':       t => t < 0.5 ? 1 : 0,
    'Soft Square':  t => 0.5 + 0.5 * Math.tanh(Math.sin(t * Math.PI * 2) * 3),
    'Pulse 33%':    t => t < 0.33 ? 1 : 0,
    'Random Walk':  null, // 特殊処理
    'Tension':      null, // テンションカーブ直マッピング
    'Step Seq':     null, // ステップシーケンサー
  };

  /* ── ランダムウォーク生成器 ── */
  function genRandomWalk(steps, smoothing) {
    const arr = new Float32Array(steps);
    let v = 0.5;
    for (let i = 0; i < steps; i++) {
      v += (rng() - 0.5) * 0.12;
      v = Math.max(0, Math.min(1, v));
      arr[i] = v;
    }
    /* ローパス平滑化 */
    const sm = Math.max(0, Math.min(1, smoothing));
    for (let pass = 0; pass < Math.round(sm * 8); pass++) {
      for (let i = 1; i < arr.length - 1; i++) arr[i] = (arr[i-1] + arr[i] + arr[i+1]) / 3;
    }
    return arr;
  }

  /* ── ステップシーケンス → ブレークポイント補間 ── */
  function evalStepSeq(steps, t, glide) {
    if (!steps || !steps.length) return 0.5;
    const n = steps.length;
    const rawIdx = t * n;
    const idx = Math.floor(rawIdx) % n;
    const next = (idx + 1) % n;
    const frac = rawIdx - Math.floor(rawIdx);
    const a = steps[idx] / 127;
    const b = steps[next] / 127;
    return glide ? a + (b - a) * frac : a;
  }

  /* ── 単一レーンの CC イベント列を生成 ──
     lane: { cc, shape, cycles, minVal, maxVal, smooth, phase, steps, glide, channel }
     bars / ppq / tensionCurve を受け取り absolute-tick イベント配列を返す */
  function genLaneEvents(lane, bars, ppq, tensionCurve) {
    const bt = ppq * 4;
    const total = bt * bars;
    /* CC イベント間隔: 最小 ppq/4 (16分) = 120 tick @ ppq=480 */
    const interval = Math.max(Math.round(ppq / 4), 1);
    const ch = (lane.channel || 16) - 1; // 0-based
    const ccNum = lane.cc || 1;
    const minV = Math.round(Math.max(0, Math.min(127, lane.minVal ?? 0)));
    const maxV = Math.round(Math.max(0, Math.min(127, lane.maxVal ?? 127)));
    const range = maxV - minV;
    const cycles = Math.max(0.0625, lane.cycles ?? 1);
    const phaseOff = (lane.phase ?? 0) / 360; // 0-1
    const smooth = lane.smooth ?? 0.5;
    const shape = lane.shape || 'Sine';

    /* ランダムウォークとステップシーケンスは事前生成 */
    const totalSteps = Math.ceil(total / interval) + 1;
    let rwCache = null, tcCache = null;
    if (shape === 'Random Walk') rwCache = genRandomWalk(totalSteps, smooth);
    if (shape === 'Tension' && tensionCurve) {
      /* テンションカーブを線形補間でリサンプル */
      tcCache = new Float32Array(totalSteps);
      for (let i = 0; i < totalSteps; i++) {
        const tf = (i / totalSteps) * tensionCurve.length;
        const lo = Math.floor(tf), hi = Math.min(tensionCurve.length - 1, lo + 1);
        tcCache[i] = tensionCurve[lo] + (tensionCurve[hi] - tensionCurve[lo]) * (tf - lo);
      }
    }

    const events = [];
    let stepIdx = 0;
    for (let tick = 0; tick < total; tick += interval) {
      let norm;
      if (shape === 'Random Walk') {
        norm = rwCache ? rwCache[Math.min(stepIdx, rwCache.length - 1)] : 0.5;
      } else if (shape === 'Tension') {
        norm = tcCache ? tcCache[Math.min(stepIdx, tcCache.length - 1)] : (tensionCurve ? tensionCurve[Math.min(Math.floor(tick / bt), tensionCurve.length - 1)] : 0.5);
      } else if (shape === 'Step Seq') {
        const t = (tick / total) * cycles % 1.0;
        norm = evalStepSeq(lane.steps, t, lane.glide);
      } else {
        const fn = WAVE_SHAPES[shape] || WAVE_SHAPES['Sine'];
        const t = ((tick / total) * cycles + phaseOff) % 1.0;
        norm = fn(t);
      }
      const val = Math.round(Math.max(0, Math.min(127, minV + norm * range)));
      events.push({ pos: tick, v: [0xB0 | ch, ccNum, val] });
      stepIdx++;
    }
    return events;
  }

  /* ── 全レーンを1本のトラックとして書き出す ── */
  function makeCCTrack(lanes, bars, ppq, tensionCurve, prg) {
    const allEvents = [];
    for (const lane of lanes) {
      if (!lane.enabled) continue;
      const evs = genLaneEvents(lane, bars, ppq, tensionCurve);
      allEvents.push(...evs);
    }
    if (!allEvents.length) return null;
    /* safeAbsToTrack 互換のためヘッダ付きで返す */
    const hdr = [];
    const tnBytes = [...'CC Automation'].map(c => c.charCodeAt(0));
    hdr.push({ d: 0, v: [0xFF, 0x03, tnBytes.length, ...tnBytes] });
    return safeAbsToTrack(allEvents, hdr);
  }

  /* ── デフォルト レーン ── */
  function defaultLane(overrides) {
    return Object.assign({
      enabled:  false,
      cc:       1,
      channel:  16,
      shape:    'Sine',
      cycles:   1,
      minVal:   0,
      maxVal:   127,
      smooth:   0.5,
      phase:    0,
      steps:    [0,32,64,96,127,96,64,32],
      glide:    true,
    }, overrides);
  }

  /* ── プリセット ── */
  const PRESETS = {
    'mod-swell':   { label: 'Mod Swell',       lanes: [{ enabled:true, cc:1,  shape:'Sine',       cycles:1,   minVal:0,  maxVal:100, smooth:0.5 }] },
    'filter-sweep':{ label: 'Filter Sweep',     lanes: [{ enabled:true, cc:74, shape:'Sawtooth Up', cycles:2,   minVal:20, maxVal:110, smooth:0.3 }] },
    'reverb-fade': { label: 'Reverb Fade Out',  lanes: [{ enabled:true, cc:91, shape:'Sawtooth Dn', cycles:1,   minVal:10, maxVal:100, smooth:0.4 }] },
    'tension-map': { label: 'Tension→Mod',      lanes: [{ enabled:true, cc:1,  shape:'Tension',     cycles:1,   minVal:0,  maxVal:127, smooth:0.5 }] },
    'rw-filter':   { label: 'Random Filter',    lanes: [{ enabled:true, cc:74, shape:'Random Walk',  cycles:1,   minVal:30, maxVal:110, smooth:0.7 }] },
    'dual-mod-rev':{ label: 'Mod + Reverb',     lanes: [
      { enabled:true, cc:1,  shape:'Sine',    cycles:1, minVal:0,  maxVal:100, smooth:0.4 },
      { enabled:true, cc:91, shape:'Cosine',  cycles:1, minVal:20, maxVal:90,  smooth:0.4 },
    ]},
    'build-filter':{ label: 'Build Filter',     lanes: [
      { enabled:true, cc:74, shape:'Tension',  cycles:1, minVal:10, maxVal:120, smooth:0.5 },
      { enabled:true, cc:71, shape:'Tension',  cycles:1, minVal:0,  maxVal:80,  smooth:0.5 },
    ]},
    'lfo-chorus':  { label: 'LFO Chorus',       lanes: [{ enabled:true, cc:93, shape:'Triangle',   cycles:3,   minVal:0,  maxVal:90,  smooth:0.2 }] },
    'step-mod':    { label: 'Step Mod',         lanes: [{ enabled:true, cc:1,  shape:'Step Seq',    cycles:2,   minVal:0,  maxVal:100, steps:[0,64,32,96,16,80,48,127], glide:true }] },
    'vol-arch':    { label: 'Volume Arch',      lanes: [{ enabled:true, cc:7,  shape:'Sine',        cycles:0.5, minVal:40, maxVal:120, smooth:0.5, phase:270 }] },
  };

  return { makeCCTrack, genLaneEvents, genRandomWalk, defaultLane, CC_NAMES, WAVE_SHAPES, PRESETS };
})();

/* ── CC_AUTO_STATE: グローバル状態 ── */
const CC_AUTO_STATE = {
  enabled: false,
  lanes: [
    /* 8レーン (enabled: false がデフォルト) */
    { enabled:false, cc:1,  channel:16, shape:'Sine',        cycles:1,   minVal:0,  maxVal:100, smooth:0.5, phase:0,   steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:74, channel:16, shape:'Sawtooth Up',  cycles:2,   minVal:20, maxVal:110, smooth:0.3, phase:0,   steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:91, channel:16, shape:'Sine',         cycles:1,   minVal:0,  maxVal:80,  smooth:0.5, phase:180, steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:93, channel:16, shape:'Triangle',     cycles:2,   minVal:0,  maxVal:60,  smooth:0.2, phase:0,   steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:71, channel:16, shape:'Random Walk',  cycles:1,   minVal:0,  maxVal:80,  smooth:0.7, phase:0,   steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:11, channel:16, shape:'Tension',      cycles:1,   minVal:20, maxVal:120, smooth:0.5, phase:0,   steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:7,  channel:16, shape:'Sine',         cycles:0.5, minVal:40, maxVal:120, smooth:0.5, phase:270, steps:[0,32,64,96,127,96,64,32], glide:true },
    { enabled:false, cc:10, channel:16, shape:'Step Seq',     cycles:2,   minVal:0,  maxVal:127, smooth:0.5, phase:0,   steps:[0,32,64,96,127,96,64,32], glide:true },
  ],
};
