/* ═══════════════════════════════════════════════════
   v19.0: SPECTRAL ANALYSIS ENGINE
   Harmonic Series · Consonance Scoring · Timbre Shaping
   ─────────────────────────────────────────────────
   コードの倍音列を計算し、声部間の協和度を解析。
   MIDI生成時にオーバートーン速度・テクスチャ密度・
   アルペジオ音程選択に反映する。

   SpectralEngine.analyze(rootPc, chordIntervals, opts)
     → { partials, strength, consonance, spectralCentroid,
         resonantPCs, brightnessScore, density }

   SpectralEngine.shapeVelocity(basVel, harmonicIdx, params)
     → number  倍音インデックス i の速度補正値

   SpectralEngine.consonanceScore(pc1, pc2)
     → 0-1  ピッチクラス間の協和度

   SpectralEngine.timbreProfile(preset)
     → { partialWeights: number[] }  倍音強度プロファイル
═══════════════════════════════════════════════════ */
const SpectralEngine = (() => {
  'use strict';

  /* ── 倍音比 (整数比) 1-16次 ── */
  const HARMONIC_RATIOS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];

  /* ── 音色プリセット (倍音強度プロファイル, 正規化前) ── */
  const TIMBRE_PRESETS = {
    sine:      { label:'Sine',     weights:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    sawtooth:  { label:'Saw',      weights:[1,0.5,0.333,0.25,0.2,0.167,0.143,0.125,0.111,0.1,0.091,0.083,0.077,0.071,0.067,0.063] },
    square:    { label:'Square',   weights:[1,0,0.333,0,0.2,0,0.143,0,0.111,0,0.091,0,0.077,0,0.067,0] },
    triangle:  { label:'Triangle', weights:[1,0,0.111,0,0.04,0,0.02,0,0.012,0,0.008,0,0.006,0,0.004,0] },
    clarinet:  { label:'Clarinet', weights:[1,0.1,0.8,0.05,0.5,0.03,0.3,0.02,0.2,0.01,0.15,0.01,0.1,0.01,0.07,0.005] },
    brass:     { label:'Brass',    weights:[1,0.8,0.6,0.5,0.4,0.35,0.3,0.25,0.2,0.18,0.15,0.12,0.1,0.08,0.06,0.05] },
    strings:   { label:'Strings',  weights:[1,0.7,0.4,0.3,0.2,0.15,0.1,0.08,0.06,0.05,0.04,0.03,0.02,0.015,0.01,0.008] },
    organ:     { label:'Organ',    weights:[1,0.9,0.8,0.7,0.6,0.5,0.4,0.35,0.3,0.25,0.2,0.18,0.15,0.12,0.1,0.08] },
    bell:      { label:'Bell',     weights:[1,0.6,0.3,0.4,0.2,0.1,0.25,0.05,0.15,0.03,0.08,0.02,0.04,0.01,0.02,0.01] },
    flute:     { label:'Flute',    weights:[1,0.4,0.1,0.05,0.03,0.02,0.01,0.005,0.003,0.002,0.001,0,0,0,0,0] },
  };

  /* ── ピッチクラス間協和度テーブル (半音距離 0-6) ── */
  // 心理音響学的協和度: ユニゾン>オクターブ>5度>4度>3度>6度>2度>7度>4度(Aug)>半音>全音
  const DYAD_CONSONANCE = [
    1.00, // 0  unison
    0.10, // 1  m2
    0.20, // 2  M2
    0.70, // 3  m3
    0.80, // 4  M3
    0.90, // 5  P4
    0.30, // 6  TT
    0.95, // 7  P5
    0.75, // 8  m6
    0.72, // 9  M6
    0.25, // 10 m7
    0.35, // 11 M7
  ];

  /**
   * ピッチクラス間の協和度スコアを返す
   * @param {number} pc1  0-11
   * @param {number} pc2  0-11
   * @returns {number}  0-1
   */
  function consonanceScore(pc1, pc2) {
    const interval = Math.abs(pc1 - pc2) % 12;
    const d = Math.min(interval, 12 - interval); // 最近傍半音距離 0-6
    return DYAD_CONSONANCE[interval] || 0;
  }

  /**
   * 倍音列から共鳴するピッチクラス集合を計算
   * @param {number} rootPc  ルートノートのPC 0-11
   * @param {number} harmonics  倍音数
   * @param {number[]} weights  倍音強度プロファイル
   * @returns {{ pc: number, strength: number }[]}
   */
  function computePartials(rootPc, harmonics, weights) {
    const partials = [];
    for (let h = 0; h < harmonics; h++) {
      const ratio = HARMONIC_RATIOS[h] || (h + 1);
      // 倍音周波数比 → ピッチクラス (log₂変換)
      const semitones = Math.round(Math.log2(ratio) * 12);
      const pc = ((rootPc + semitones) % 12 + 12) % 12;
      const strength = (weights[h] !== undefined ? weights[h] : 1 / (h + 1));
      partials.push({ harmonic: h + 1, ratio, semitones, pc, strength });
    }
    return partials;
  }

  /**
   * コード全体の倍音スペクトルを解析
   * @param {number} rootPc  0-11
   * @param {number[]} chordIntervals  コードの音程配列 e.g. [0,4,7]
   * @param {Object} [opts]
   * @param {number} [opts.harmonics=16]     計算する倍音数
   * @param {string} [opts.timbre='sawtooth'] 音色プリセット名
   * @param {number} [opts.threshold=0.05]   強度閾値（これ未満は無視）
   * @param {number} [opts.rolloff=1.0]      倍音減衰係数 (0.5=急減衰, 2.0=緩減衰)
   * @returns {Object}
   */
  function analyze(rootPc, chordIntervals, opts) {
    const o = opts || {};
    const harmonics = Math.max(1, Math.min(16, o.harmonics || 16));
    const timbreKey = o.timbre || 'sawtooth';
    const threshold = o.threshold != null ? o.threshold : 0.05;
    const rolloff = o.rolloff != null ? o.rolloff : 1.0;

    const profile = TIMBRE_PRESETS[timbreKey] || TIMBRE_PRESETS.sawtooth;
    // rolloff 係数で倍音強度を変調
    const weights = profile.weights.map((w, i) => w * Math.pow(1 / (i + 1), rolloff - 1));

    // 各コードトーンの倍音列を合算
    const pcSpectrum = new Float32Array(12); // 各PCへの総強度
    const allPartials = [];

    for (const interval of chordIntervals) {
      const notePc = ((rootPc + interval) % 12 + 12) % 12;
      const partials = computePartials(notePc, harmonics, weights);
      for (const p of partials) {
        if (p.strength >= threshold) {
          pcSpectrum[p.pc] += p.strength;
          allPartials.push({ ...p, notePc, interval });
        }
      }
    }

    // スペクトル重心 (0-11)
    let wSum = 0, wPcSum = 0;
    for (let pc = 0; pc < 12; pc++) {
      wSum += pcSpectrum[pc];
      wPcSum += pcSpectrum[pc] * pc;
    }
    const spectralCentroid = wSum > 0 ? wPcSum / wSum : 0;

    // 明るさスコア: 高次倍音の強度合計 / 全強度 (0-1)
    const chordSize = chordIntervals.length || 1;
    let lowPower = 0, highPower = 0;
    for (const p of allPartials) {
      if (p.harmonic <= 4) lowPower += p.strength;
      else highPower += p.strength;
    }
    const brightnessScore = (lowPower + highPower) > 0
      ? highPower / (lowPower + highPower)
      : 0;

    // 共鳴PCリスト (強度上位N個)
    const resonantPCs = Array.from(pcSpectrum)
      .map((s, pc) => ({ pc, strength: s }))
      .filter(x => x.strength > 0)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 6)
      .map(x => x.pc);

    // コード内倍音一致率: resonantPCs と chordPCs の重複
    const chordPCs = chordIntervals.map(i => ((rootPc + i) % 12 + 12) % 12);
    const resonantInChord = resonantPCs.filter(pc => chordPCs.includes(pc)).length;
    const harmonicDensity = resonantPCs.length > 0 ? resonantInChord / resonantPCs.length : 0;

    // コード協和度スコア (全ペア平均)
    let consonanceSum = 0, pairCount = 0;
    for (let i = 0; i < chordPCs.length; i++) {
      for (let j = i + 1; j < chordPCs.length; j++) {
        consonanceSum += consonanceScore(chordPCs[i], chordPCs[j]);
        pairCount++;
      }
    }
    const chordConsonance = pairCount > 0 ? consonanceSum / pairCount : 1;

    return {
      partials: allPartials,
      pcSpectrum: Array.from(pcSpectrum),
      spectralCentroid,
      brightnessScore,
      resonantPCs,
      harmonicDensity,
      chordConsonance,
      timbre: timbreKey,
      harmonics,
    };
  }

  /**
   * 倍音インデックスに基づいてベロシティを整形
   * @param {number} baseVel   基本ベロシティ 1-127
   * @param {number} harmIdx   倍音インデックス 0-based (0=基音)
   * @param {Object} params    SPECTRAL_PARAMS
   * @returns {number}  整形後ベロシティ 1-127
   */
  function shapeVelocity(baseVel, harmIdx, params) {
    const profile = TIMBRE_PRESETS[params.timbre] || TIMBRE_PRESETS.sawtooth;
    const w = profile.weights[harmIdx] != null ? profile.weights[harmIdx] : 1 / (harmIdx + 1);
    const rolloffW = w * Math.pow(1 / (harmIdx + 1), (params.rolloff || 1.0) - 1);
    // 正規化 (基音強度=1.0 を基準)
    const normW = Math.min(1, rolloffW / (profile.weights[0] || 1));
    // 明るさボーナス: brightnessBoost が高いほど高次倍音のベロシティを底上げ
    const boost = 1 + (params.brightnessBoost || 0) * harmIdx * 0.05;
    const shaped = Math.round(baseVel * normW * boost);
    return Math.max(1, Math.min(127, shaped));
  }

  /**
   * 音色プリセットの倍音強度プロファイルを返す
   * @param {string} preset  プリセット名
   * @returns {{ partialWeights: number[], label: string }}
   */
  function timbreProfile(preset) {
    const p = TIMBRE_PRESETS[preset] || TIMBRE_PRESETS.sawtooth;
    return { partialWeights: p.weights.slice(), label: p.label };
  }

  return {
    analyze,
    shapeVelocity,
    consonanceScore,
    timbreProfile,
    TIMBRE_PRESETS,
    HARMONIC_RATIOS,
  };
})();

/* ═══ SPECTRAL PARAMS — グローバル状態 ═══ */
const SPECTRAL_PARAMS = {
  enabled:        true,
  harmonics:      12,         /* 計算倍音数 1-16 */
  timbre:         'sawtooth', /* 音色プリセット */
  rolloff:        1.0,        /* 倍音ロールオフ 0.5-2.0 */
  threshold:      0.05,       /* 倍音強度閾値 0.01-0.30 */
  brightnessBoost:0.0,        /* 高次倍音ブースト 0-2 */
  velShape:       true,       /* オーバートーン速度整形を適用 */
  textureFilter:  true,       /* 非共鳴音をテクスチャから抑制 */
  consonanceGate: 0.5,        /* この値未満の協和度を持つ音程をゲートで抑制 */
};
