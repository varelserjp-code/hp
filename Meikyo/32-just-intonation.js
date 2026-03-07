/* ═══════════════════════════════════════════════════
   v25.5: JUST INTONATION ENGINE
   Helmholtz / Partch / Johnston の純正律理論
   ─────────────────────────────────────────────────
   設計:
   · JI_PARAMS: エンジンパラメーター (グローバル)
   · JustIntonation IIFE:
       getPitchBendMap(pcs, root, params)
           コード PC 全体の PitchBend マップを返す
           → applyCompensationTuningToMidi の前に適用
       getPitchBend(midiNote, root, params)
           単音の PitchBend 値を返す (14bit, 0–16383)
       getDeviationTable(root, params)
           偏差テーブル (UI Canvas 描画用)
       consonanceScore(pcs, root, params)
           協和度 0-1 (SpectralEngine と連携可能)
   ─────────────────────────────────────────────────
   モード:
     "limit5"   5-limit 純正律 (Ptolemy)
     "limit7"   7-limit 純正律 (Partch / Johnston)
     "limit11"  11-limit 純正律 (クォータートーン的)
     "harmonic" 倍音列直接マッピング
     "utonal"   倍音列の鏡像反転 (負和声と対応)
   ─────────────────────────────────────────────────
   CompTuning との関係:
     CompTuningEngine は MIDI バイト列への後処理。
     JI は doGenerate() 内で shared.jiPBMap として
     事前計算し makeXxx() に渡す設計。
     CompTuning と JI を同時に有効にした場合は
     JI を先に適用 → CompTuning が上書き補正する。
   ─────────────────────────────────────────────────
   ロード順:
     ...→ 31 → [32] → 22 → 24 → 23
═══════════════════════════════════════════════════ */

/* ── エンジンパラメーター (doGenerate() と同期) ── */
const JI_PARAMS = {
  enabled:       false,
  mode:          'limit5',   // 'limit5'|'limit7'|'limit11'|'harmonic'|'utonal'
  blend:         1.0,        // 0.0=平均律 / 1.0=完全純正律
  harmonicLimit: 16,         // 倍音列モード時の上限倍音 (2–32)
};

/* ── 純正律テーブル (基音=0 からの絶対セント値) ── */
/* 各インデックスは基音からの半音数 (0=R, 1=b2, ..., 11=7) */
const _JI_TABLES = {
  // 5-limit 純正律 — Ptolemy's intense diatonic
  limit5: [
      0,       // 1/1    R
    111.73,    // 16/15  b2
    203.91,    // 9/8    2
    315.64,    // 6/5    b3
    386.31,    // 5/4    3   (平均律 -13.69¢)
    498.04,    // 4/3    4
    582.51,    // 45/32  #4
    701.96,    // 3/2    5   (平均律 +1.96¢)
    813.69,    // 8/5    b6
    884.36,    // 5/3    6
   1017.60,    // 9/5    b7
   1088.27,    // 15/8   7
  ],
  // 7-limit 純正律 — Harry Partch / Ben Johnston
  limit7: [
      0,       // 1/1
    119.44,    // 15/14
    203.91,    // 9/8
    266.87,    // 7/6
    386.31,    // 5/4
    498.04,    // 4/3
    582.51,    // 45/32
    701.96,    // 3/2
    764.92,    // 14/9
    884.36,    // 5/3
    968.83,    // 7/4   ブルーノート (平均律 -31.17¢)
   1088.27,    // 15/8
  ],
  // 11-limit 純正律
  limit11: [
      0,       // 1/1
    150.64,    // 12/11
    203.91,    // 9/8
    315.64,    // 6/5
    386.31,    // 5/4
    498.04,    // 4/3
    551.32,    // 11/8  クォータートーン的
    701.96,    // 3/2
    813.69,    // 8/5
    884.36,    // 5/3
   1017.60,    // 9/5
   1088.27,    // 15/8
  ],
};

const JustIntonation = (() => {
  'use strict';

  /* ── 内部ユーティリティ ── */

  function _ratioToCents(ratio) {
    return 1200 * Math.log2(ratio);
  }

  /**
   * セント偏差 → MIDI PitchBend 値 (14bit 0–16383, center=8192)
   * @param {number} cents   平均律からのずれ（セント）
   * @param {number} pbRange PB レンジ（半音単位）
   */
  function _centsToPB(cents, pbRange) {
    pbRange = pbRange || 2;
    const ratio = Math.max(-1, Math.min(1, cents / (pbRange * 100)));
    return Math.round(8192 + ratio * 8191);
  }

  /**
   * 倍音列から純正律テーブルを動的生成
   * 第2〜limit 倍音を 1 オクターブに折り畳み最近傍 PC に割り当て
   */
  function _buildHarmonicTable(limit) {
    const cents = new Array(12).fill(null);
    cents[0] = 0;
    for (let n = 2; n <= limit; n++) {
      let r = n;
      while (r >= 2) r /= 2;
      const c  = _ratioToCents(r);
      const pc = Math.round(c / 100) % 12;
      if (cents[pc] === null ||
          Math.abs(c - pc * 100) < Math.abs(cents[pc] - pc * 100)) {
        cents[pc] = c;
      }
    }
    // 未割り当ては平均律で補完
    for (let i = 0; i < 12; i++) {
      if (cents[i] === null) cents[i] = i * 100;
    }
    return cents;
  }

  /** Utonal テーブル: 倍音列の鏡像反転 (NegativeHarmony との対応) */
  function _buildUtonalTable(limit) {
    const otonal = _buildHarmonicTable(limit);
    return otonal.map((_, i) => {
      const c = 1200 - otonal[(12 - i) % 12];
      return ((c % 1200) + 1200) % 1200;
    });
  }

  function _getTable(mode, harmonicLimit) {
    switch (mode) {
      case 'limit5':   return _JI_TABLES.limit5;
      case 'limit7':   return _JI_TABLES.limit7;
      case 'limit11':  return _JI_TABLES.limit11;
      case 'harmonic': return _buildHarmonicTable(harmonicLimit);
      case 'utonal':   return _buildUtonalTable(harmonicLimit);
      default:         return _JI_TABLES.limit5;
    }
  }

  /**
   * PC の平均律セント (relPc * 100) からの偏差を返す
   * @param {number} pc  0-11
   * @param {number} root  基音 PC 0-11
   * @param {Object} params  JI_PARAMS
   * @returns {number}  セント偏差（blend 適用済み）
   */
  function _deviation(pc, root, params) {
    const table  = _getTable(params.mode, params.harmonicLimit);
    const relPc  = ((pc - root) + 12) % 12;
    return (table[relPc] - relPc * 100) * params.blend;
  }

  /* ── 公開 API ── */

  /**
   * コード PC 集合のピッチベンドマップを返す
   * doGenerate() 内で shared.jiPBMap として事前計算し
   * makeXxx() 内のノートイベント生成時に参照する
   * @param {number[]} pcs     PC 配列 (0-11)
   * @param {number}   root    基音 PC
   * @param {Object}   params  JI_PARAMS
   * @param {number}   [pbRange=2]
   * @returns {{ [pc: number]: number }}  pc → PitchBend 値 (0-16383)
   */
  function getPitchBendMap(pcs, root, params, pbRange) {
    const map = {};
    for (const pc of pcs) {
      map[pc] = _centsToPB(_deviation(((pc % 12) + 12) % 12, root, params), pbRange);
    }
    return map;
  }

  /**
   * 単音の PitchBend 値を返す
   * @param {number} midiNote
   * @param {number} root
   * @param {Object} params
   * @param {number} [pbRange=2]
   * @returns {number}  0-16383
   */
  function getPitchBend(midiNote, root, params, pbRange) {
    return _centsToPB(_deviation(((midiNote % 12) + 12) % 12, root, params), pbRange);
  }

  /**
   * 全 12 PC の偏差テーブルを返す (UI Canvas 描画・デバッグ用)
   * @returns {Array<{pc, name, etCents, jiCents, deviation}>}
   */
  function getDeviationTable(root, params) {
    const NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
    const table = _getTable(params.mode, params.harmonicLimit);
    return Array.from({ length: 12 }, (_, i) => {
      const relPc   = ((i - root) + 12) % 12;
      const jiCents = table[relPc];
      const etCents = relPc * 100;
      return {
        pc: i, name: NAMES[i], etCents, jiCents,
        deviation: (jiCents - etCents) * params.blend,
      };
    });
  }

  /**
   * 協和度スコア 0-1
   * SpectralEngine の consonanceGate と連携可能
   * @param {number[]} pcs
   * @param {number}   root
   * @param {Object}   params
   * @returns {number}
   */
  function consonanceScore(pcs, root, params) {
    if (pcs.length < 2) return 1.0;
    const table = _getTable(params.mode, params.harmonicLimit);
    const justRef = _JI_TABLES.limit5; // 基準テーブル
    let totalDev = 0, pairs = 0;
    for (let i = 0; i < pcs.length; i++) {
      for (let j = i + 1; j < pcs.length; j++) {
        const interval = Math.abs(
          table[((pcs[i] - root) + 12) % 12] -
          table[((pcs[j] - root) + 12) % 12]
        );
        // 最近傍純正音程との差
        let minDev = Infinity;
        for (const ref of justRef) {
          const d = Math.abs(interval - ref);
          if (d < minDev) minDev = d;
        }
        totalDev += minDev;
        pairs++;
      }
    }
    return 1.0 - Math.min(1.0, (totalDev / pairs) / 50);
  }

  return {
    getPitchBendMap,
    getPitchBend,
    getDeviationTable,
    consonanceScore,
    /* テスト・外部参照用 */
    _buildHarmonicTable,
    _buildUtonalTable,
    _deviation,
  };
})();
