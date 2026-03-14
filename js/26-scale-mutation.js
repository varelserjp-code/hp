/* ═══════════════════════════════════════════════════
   v21.0: SCALE MUTATION ENGINE
   バー単位でスケールが変化する Modal Interchange / Modulation
   ─────────────────────────────────────────────────
   設計:
   · SCALE_MUT_STATE: スロット配列 [{scale, bars}, ...] + パラメーター
   · ScaleMutEngine.expandToBars(slots, totalBars)
       → [{scaleKey, iv, barStart, barCount}, ...]
   · ScaleMutEngine.scaleAtBar(expanded, bar)
       → {scaleKey, iv, barStart, barCount, phase 0-1}
   · ScaleMutEngine.commonToneScore(ivA, rootA, ivB, rootB)
       → 0-1 共通音率 (ルート込みPC集合)
   · ScaleMutEngine.interpolateIv(ivA, ivB, t, mode)
       → 補間済み音程配列 (pivot / crossfade / hard)
   · SCALE_MUT_PRESETS: モーダルインターチェンジ / モジュレーション例
═══════════════════════════════════════════════════ */
const ScaleMutEngine = (() => {
  'use strict';

  /* ── スケール変化プリセット ── */
  const SCALE_MUT_PRESETS = {
    'modal-int':   { label: 'Modal Interchange', scales: ['Ionian (Major)','Dorian','Ionian (Major)','Mixolydian'] },
    'dark-light':  { label: 'Dark ↔ Light',      scales: ['Dorian','Phrygian','Dorian','Lydian'] },
    'dorian-phry': { label: 'Dorian → Phrygian', scales: ['Dorian','Dorian','Phrygian','Phrygian'] },
    'lyd-mix':     { label: 'Lydian → Mixo',     scales: ['Lydian','Lydian','Mixolydian','Mixolydian'] },
    'diatonic-dim':{ label: 'Diatonic → Dim',    scales: ['Ionian (Major)','Ionian (Major)','Diminished (HW)','Diminished (HW)'] },
    'mode-circle': { label: 'Mode Circle',       scales: ['Ionian (Major)','Dorian','Phrygian','Lydian','Mixolydian','Aeolian (Natural Minor)'] },
    'tension-arc': { label: 'Tension Arc',       scales: ['Ionian (Major)','Lydian','Lydian Dominant','Altered Scale'] },
    'ambient-drift':{ label: 'Ambient Drift',    scales: ['Dorian','Phrygian','Locrian','Phrygian'] },
    'wholetone':   { label: 'Whole Tone Drift',  scales: ['Ionian (Major)','Whole Tone','Whole Tone','Ionian (Major)'] },
    'pentatonic':  { label: 'Pentatonic Shift',  scales: ['Major Pentatonic','Minor Pentatonic','Major Pentatonic','Dorian'] },
  };

  /**
   * スケールスロット配列をバー割り当てに展開
   * @param {Array<{scale:string, iv:number[], bars:number}>} slots
   * @param {number} totalBars
   * @returns {Array<{scaleKey:string, iv:number[], barStart:number, barCount:number}>}
   */
  function expandToBars(slots, totalBars) {
    if (!slots || !slots.length) return [];
    const total = slots.reduce((s, e) => s + e.bars, 0);
    const expanded = [];
    let bar = 0;
    for (const entry of slots) {
      const scaled = Math.max(1, Math.round(entry.bars / total * totalBars));
      expanded.push({ scaleKey: entry.scale, iv: entry.iv, barStart: bar, barCount: scaled });
      bar += scaled;
    }
    if (expanded.length > 0) {
      const last = expanded[expanded.length - 1];
      last.barCount = Math.max(1, totalBars - last.barStart);
    }
    return expanded;
  }

  /**
   * 指定バーのスケールエントリを返す
   * @param {Array} expanded  expandToBars() の結果
   * @param {number} bar  バー番号 (0-based)
   * @returns {{ scaleKey, iv, barStart, barCount, phase:number }}
   */
  function scaleAtBar(expanded, bar) {
    if (!expanded || !expanded.length) return null;
    let entry = expanded[expanded.length - 1];
    for (const e of expanded) {
      if (bar >= e.barStart && bar < e.barStart + e.barCount) { entry = e; break; }
    }
    const phase = (bar - entry.barStart) / Math.max(1, entry.barCount);
    return { ...entry, phase };
  }

  /**
   * 2スケール間の共通音率 (root基準のPC集合で比較)
   * @param {number[]} ivA  スケールAの音程配列
   * @param {number}  rootA ルートPC (0-11)
   * @param {number[]} ivB
   * @param {number}  rootB
   * @returns {number} 0-1
   */
  function commonToneScore(ivA, rootA, ivB, rootB) {
    const pcsA = new Set(ivA.map(i => ((rootA + i) % 12 + 12) % 12));
    const pcsB = new Set(ivB.map(i => ((rootB + i) % 12 + 12) % 12));
    let common = 0;
    for (const pc of pcsA) { if (pcsB.has(pc)) common++; }
    const total = new Set([...pcsA, ...pcsB]).size;
    return total > 0 ? common / total : 0;
  }

  /**
   * 2スケール間の音程配列補間
   * mode: 'hard' | 'pivot' | 'crossfade'
   *   hard:      t < 0.5 → ivA, t >= 0.5 → ivB
   *   pivot:     共通音はそのまま保持し、非共通音を線形にブレンド
   *   crossfade: t の確率でランダムに ivB の音を採用
   *
   * @param {number[]} ivA
   * @param {number}  rootA
   * @param {number[]} ivB
   * @param {number}  rootB
   * @param {number}  t     0(A) → 1(B)
   * @param {string}  mode
   * @returns {number[]}  結果音程配列 (root=0 基準)
   */
  function interpolateIv(ivA, rootA, ivB, rootB, t, mode) {
    if (mode === 'hard' || t <= 0) return t < 0.5 ? ivA : ivB;
    if (t >= 1.0) return ivB;

    // PC集合を root=0 基準に正規化して操作
    const pcsA = ivA.map(i => ((rootA + i) % 12 + 12) % 12).sort((a, b) => a - b);
    const pcsB = ivB.map(i => ((rootB + i) % 12 + 12) % 12).sort((a, b) => a - b);

    if (mode === 'crossfade') {
      // 各ポジションを t の確率でBから選択
      const merged = [];
      const maxLen = Math.max(pcsA.length, pcsB.length);
      for (let i = 0; i < maxLen; i++) {
        const pcB = pcsB[i % pcsB.length];
        const pcA = pcsA[i % pcsA.length];
        merged.push(rng() < t ? pcB : pcA);
      }
      // dedup + sort → rootA 基準に戻す
      const deduped = [...new Set(merged)].sort((a, b) => a - b);
      return deduped.map(pc => ((pc - rootA) % 12 + 12) % 12);
    }

    // pivot: 共通音保持、非共通音をブレンド
    const setA = new Set(pcsA);
    const setB = new Set(pcsB);
    const pivot = pcsA.filter(pc => setB.has(pc));
    const onlyA = pcsA.filter(pc => !setB.has(pc));
    const onlyB = pcsB.filter(pc => !setA.has(pc));
    // t の割合で onlyA から onlyB に置換
    const replaceCount = Math.round(t * Math.min(onlyA.length, onlyB.length));
    const result = new Set([...pivot, ...onlyA.slice(replaceCount), ...onlyB.slice(0, replaceCount)]);
    return [...result].sort((a, b) => a - b).map(pc => ((pc - rootA) % 12 + 12) % 12);
  }

  /**
   * 進行全体のスムースネスリスト (隣接スケール間)
   * @param {Array<{iv:number[], scale:string}>} slots
   * @param {number} root  共通ルートPC (0-11)
   * @returns {number[]}
   */
  function smoothnessScores(slots, root) {
    const scores = [];
    for (let i = 0; i < slots.length - 1; i++) {
      scores.push(commonToneScore(slots[i].iv, root, slots[i + 1].iv, root));
    }
    return scores;
  }

  return { expandToBars, scaleAtBar, commonToneScore, interpolateIv, smoothnessScores, SCALE_MUT_PRESETS };
})();

/* ═══ SCALE_MUT_STATE — グローバル状態 ═══ */
const SCALE_MUT_STATE = {
  enabled:    false,              /* Scale Mutation ON/OFF */
  slots:      [],                 /* [{scale:string, iv:number[], bars:number}, ...] */
  /* トランジション設定 */
  transMode:  'hard',             /* 'hard' | 'pivot' | 'crossfade' */
  transLen:   1,                  /* トランジションバー数 (0=即切り替え, 1-4) */
  /* ループ */
  loop:       true,
};
