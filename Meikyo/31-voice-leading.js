/* ═══════════════════════════════════════════════════
   v25.4: VOICE LEADING ENGINE
   Dmitri Tymoczko "A Geometry of Music" に基づく
   ─────────────────────────────────────────────────
   設計:
   · voiceLead(chordA, chordB, opts)
       2つのコード間で最小移動距離ボイシングを決定論的に返す
   · voiceLeadProgression(prog, opts)
       コード進行全体のボイシングを事前計算してキャッシュ
   · smoothnessScore(voicingA, voicingB)
       VLコスト + 並行完全音程ペナルティを 0-1 に正規化
   · parallelCheck(voicingA, voicingB)
       並行5度・並行8度・反行完全音程のリストを返す
   · VOICE_LEAD_STATE: 計算済みボイシングキャッシュ
   ─────────────────────────────────────────────────
   連携:
   · PROG_STATE.transitionMode === 'voice-lead' 時に
     doGenerate() の generateForChord() ループで
     各コードのボイシングを上書き注入
   · index.html の TRANSITION ボタンに VOICE LEAD 追加
═══════════════════════════════════════════════════ */
const VLEngine = (() => {
  'use strict';

  /* ── 定数 ── */
  const NOTE_MIN  = 36;   // C2
  const NOTE_MAX  = 96;   // C7
  const SPAN_MAX  = 24;   // ボイシング最大音域 (2オクターブ)
  const SPAN_IDEAL = 14;  // 理想的な音域 (短7度+1)

  /* ── ユーティリティ ── */

  /**
   * MIDI ノート番号を NOTE_MIN〜NOTE_MAX にクランプ
   */
  function clamp(n) {
    return Math.max(NOTE_MIN, Math.min(NOTE_MAX, n));
  }

  /**
   * 2つのソート済みボイシング間の移動コスト (Σ|移動量|)
   * ボイス数が異なる場合は最近傍音高に補完
   * @param {number[]} a  ソート済み MIDI ノート列
   * @param {number[]} b  ソート済み MIDI ノート列
   * @returns {number}
   */
  function vlCostSorted(a, b) {
    if (!a.length || !b.length) return 999;
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    // ボイス数を揃える（短い方の末尾を1オクターブ上に延長）
    while (sa.length < sb.length) sa.push(clamp(sa[sa.length - 1] + 12));
    while (sb.length < sa.length) sb.push(clamp(sb[sb.length - 1] + 12));
    return sa.reduce((sum, n, i) => sum + Math.abs(n - sb[i]), 0);
  }

  /**
   * 並行完全音程ペナルティ
   * 同方向進行中に完全5度(7)または完全8度(0/12/24)が連続する場合に加点
   * @param {number[]} a  ボイシング A (ソート済み)
   * @param {number[]} b  ボイシング B (ソート済み)
   * @returns {number}
   */
  function _parallelPenalty(a, b) {
    if (a.length < 2 || b.length < 2) return 0;
    const n = Math.min(a.length, b.length);
    let pen = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const iA  = a[j] - a[i];
        const iB  = b[j] - b[i];
        const mI  = b[i] - a[i]; // 声部 i の移動量
        const mJ  = b[j] - a[j]; // 声部 j の移動量
        const parallel = (mI !== 0 || mJ !== 0) &&
                         ((mI > 0 && mJ > 0) || (mI < 0 && mJ < 0));
        if (parallel) {
          if (iA % 12 === 7  && iB % 12 === 7)  pen += 8;  // 並行5度
          if (iA % 12 === 0  && iA !== 0 && iB % 12 === 0) pen += 12; // 並行8度
        }
      }
    }
    return pen;
  }

  /**
   * コードの PC 集合からボイシング候補を生成
   * @param {number[]} pcs    PC 配列 (0-11)
   * @param {number}   center 中心音高 (MIDI)
   * @param {number}   span   最大音域
   * @returns {number[][]}  ボイシング候補の配列（各要素はソート済み MIDI ノート列）
   */
  function _generateVoicings(pcs, center, span) {
    span = span || SPAN_MAX;
    const u = [...new Set(pcs.map(p => ((p % 12) + 12) % 12))];
    if (!u.length) return [];
    const out  = [];
    const seen = new Set();

    const add = v => {
      const sv = [...v].sort((a, b) => a - b);
      if (sv.some(n => n < NOTE_MIN || n > NOTE_MAX)) return;
      if (sv[sv.length - 1] - sv[0] > span) return;
      const k = sv.join(',');
      if (seen.has(k)) return;
      seen.add(k);
      out.push(sv);
    };

    for (let inv = 0; inv < u.length; inv++) {
      const rot = [...u.slice(inv), ...u.slice(0, inv)];
      // 基音位置を center 近傍に配置
      let bass = Math.round((center - Math.floor(span / 2) - rot[0]) / 12) * 12 + rot[0];
      while (bass < NOTE_MIN) bass += 12;
      while (bass > NOTE_MAX - 7) bass -= 12;

      const v = [bass];
      for (let i = 1; i < rot.length; i++) {
        let n = Math.floor(v[v.length - 1] / 12) * 12 + rot[i];
        if (n <= v[v.length - 1]) n += 12;
        v.push(n);
      }
      add(v);

      // 転回形バリエーション（上から1〜2音を1オクターブ下げる）
      if (v.length >= 3) {
        const d2 = [...v];
        d2[d2.length - 2] -= 12;
        add(d2);
      }
      if (v.length >= 4) {
        const d3 = [...v];
        d3[d3.length - 3] -= 12;
        add(d3);
      }
      // 密集配置（全音域を SPAN_IDEAL 以内に収める版）
      if (v[v.length - 1] - v[0] > SPAN_IDEAL) {
        const tight = [v[0]];
        for (let i = 1; i < rot.length; i++) {
          let n = Math.floor(tight[tight.length - 1] / 12) * 12 + rot[i];
          if (n <= tight[tight.length - 1]) n += 12;
          if (n - tight[0] > SPAN_IDEAL) n -= 12;
          tight.push(n);
        }
        add(tight);
      }
    }
    return out;
  }

  /* ── 公開 API ── */

  /**
   * 2コード間で声部進行コストが最小のボイシングを返す
   * @param {number[]} prevVoicing  直前コードのボイシング (MIDI ノート列)
   * @param {number[]} pcs          次コードの PC 集合 (0-11)
   * @param {Object}   [opts]
   * @param {number}   [opts.center=60]  ボイシング中心音高
   * @param {number}   [opts.span=SPAN_MAX]  最大音域
   * @param {boolean}  [opts.force]    前ボイシングと同一でも許可
   * @returns {number[]}  最適ボイシング (ソート済み MIDI ノート列)
   */
  function voiceLead(prevVoicing, pcs, opts) {
    opts = opts || {};
    const center = opts.center || 60;
    const span   = opts.span   || SPAN_MAX;
    const force  = !!opts.force;

    const candidates = _generateVoicings(pcs, center, span);
    if (!candidates.length) return prevVoicing.length ? prevVoicing : [];

    // 前ボイシングがない場合は音域が最も狭いものを選ぶ
    if (!prevVoicing.length) {
      return candidates.reduce((best, v) =>
        (v[v.length - 1] - v[0]) < (best[best.length - 1] - best[0]) ? v : best
      );
    }

    const prevKey = prevVoicing.join(',');
    const pool = force
      ? candidates
      : candidates.filter(v => v.join(',') !== prevKey);
    if (!pool.length) return prevVoicing;

    let bestCost = Infinity;
    let bestVoicing = pool[0];
    for (const v of pool) {
      const cost = vlCostSorted(prevVoicing, v) + _parallelPenalty(prevVoicing, v) * 0.6;
      if (cost < bestCost) {
        bestCost = cost;
        bestVoicing = v;
      }
    }
    return bestVoicing;
  }

  /**
   * コード進行全体のボイシング列を事前計算
   * @param {Object[]} prog  PROG_STATE.prog 形式の配列 [{chord, bars}, ...]
   * @param {Object}   [opts]
   * @param {number}   [opts.center=60]
   * @param {number}   [opts.span=SPAN_MAX]
   * @returns {number[][]}  各コードのベストボイシング配列 (prog と同インデックス)
   */
  function voiceLeadProgression(prog, opts) {
    if (!prog || !prog.length) return [];
    opts = opts || {};
    const center = opts.center || 60;
    const span   = opts.span   || SPAN_MAX;

    const result = [];
    let prev = [];

    for (const entry of prog) {
      const c = entry.chord;
      if (!c || !c.iv) { result.push(prev); continue; }
      const pcs = c.iv.map(i => ((c.root + i) % 12 + 12) % 12);
      const v = voiceLead(prev, pcs, { center, span, force: result.length > 0 });
      result.push(v);
      prev = v;
    }
    return result;
  }

  /**
   * 2ボイシング間の声部進行の滑らかさを 0-1 で返す
   * 1.0 = 完全滑らか（移動なし）、0.0 = 非常に荒い
   * @param {number[]} voicingA  ソート済み MIDI ノート列
   * @param {number[]} voicingB  ソート済み MIDI ノート列
   * @returns {number}
   */
  function smoothnessScore(voicingA, voicingB) {
    if (!voicingA.length || !voicingB.length) return 0;
    const cost = vlCostSorted(voicingA, voicingB) + _parallelPenalty(voicingA, voicingB) * 0.6;
    const voices = Math.max(voicingA.length, voicingB.length);
    // 1声部あたり平均6半音移動でスコア0に近づく設定
    return Math.max(0, 1 - cost / (voices * 6));
  }

  /**
   * 2ボイシング間の並行完全音程リストを返す（デバッグ・UI 表示用）
   * @param {number[]} voicingA
   * @param {number[]} voicingB
   * @returns {{ type: string, voiceI: number, voiceJ: number }[]}
   */
  function parallelCheck(voicingA, voicingB) {
    const result = [];
    if (voicingA.length < 2 || voicingB.length < 2) return result;
    const n = Math.min(voicingA.length, voicingB.length);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const iA = voicingA[j] - voicingA[i];
        const iB = voicingB[j] - voicingB[i];
        const mI = voicingB[i] - voicingA[i];
        const mJ = voicingB[j] - voicingA[j];
        const parallel = (mI !== 0 || mJ !== 0) &&
                         ((mI > 0 && mJ > 0) || (mI < 0 && mJ < 0));
        if (parallel) {
          if (iA % 12 === 7  && iB % 12 === 7)
            result.push({ type: 'P5',  voiceI: i, voiceJ: j });
          if (iA % 12 === 0  && iA !== 0 && iB % 12 === 0)
            result.push({ type: 'P8',  voiceI: i, voiceJ: j });
        }
        // 反行5度（Anti-fifths: 反行で完全5度に到達）
        if (!parallel && iB % 12 === 7 && iA % 12 !== 7)
          result.push({ type: 'anti-P5', voiceI: i, voiceJ: j });
      }
    }
    return result;
  }

  /* ── キャッシュ状態 ── */
  const VOICE_LEAD_STATE = {
    cachedProg:     null,   // 計算済み PROG_STATE.prog の参照
    cachedVoicings: [],     // voiceLeadProgression の戻り値
    dirty:          true,   // true なら再計算が必要
  };

  /**
   * PROG_STATE.prog が変化したときにキャッシュを無効化
   * 23-init.js の updateTheory フック / renderSlots 末尾から呼ぶ
   */
  function invalidateCache() {
    VOICE_LEAD_STATE.dirty = true;
  }

  /**
   * キャッシュを更新して最新のボイシング列を返す
   * @param {Object[]} prog  PROG_STATE.prog
   * @param {Object}   [opts]
   * @returns {number[][]}
   */
  function getCachedVoicings(prog, opts) {
    if (!VOICE_LEAD_STATE.dirty && VOICE_LEAD_STATE.cachedProg === prog) {
      return VOICE_LEAD_STATE.cachedVoicings;
    }
    const voicings = voiceLeadProgression(prog, opts);
    VOICE_LEAD_STATE.cachedProg     = prog;
    VOICE_LEAD_STATE.cachedVoicings = voicings;
    VOICE_LEAD_STATE.dirty          = false;
    return voicings;
  }

  return {
    voiceLead,
    voiceLeadProgression,
    smoothnessScore,
    parallelCheck,
    invalidateCache,
    getCachedVoicings,
    VOICE_LEAD_STATE,
    /* 内部ユーティリティ — テスト用に公開 */
    _generateVoicings,
    _parallelPenalty,
    vlCostSorted,
  };
})();
