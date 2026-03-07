/* ═══════════════════════════════════════════════════
   v25.6: RHYTHMIC CANONS ENGINE
   Vuza Canon / Tiling Canon / Messiaen / Polymeter
   ─────────────────────────────────────────────────
   設計:
   · RC_PARAMS: エンジンパラメーター (グローバル)
   · RhythmicCanons IIFE:
       generate(params, totalSteps)
           ゲートパターン配列を返す
           → doGenerate() 内で eucPattern の代替として使用
       getPatternInfo(params)
           UI Canvas 描画用のパターン情報を返す
       validateTiling(A, B, n)
           Vuza A⊕B=Zn の検証 (デバッグ用)
       getPresets(n)
           既知 Vuza パターン一覧 (UIプリセット用)
   ─────────────────────────────────────────────────
   モード:
     "vuza"      Vuza カノン (完全タイリング、非周期)
     "tiling"    一般タイリングカノン (周期的補集合も許容)
     "messiaen"  Messiaen 付加値リズム
     "polymeter" ポリミクシャ (複数周期の独立ループ)
   ─────────────────────────────────────────────────
   注意:
     01-euclidean.js の rotatePattern() と同名関数が
     衝突するため、内部では _rcRotate() に改名。
     gcd / lcm 等の数学ユーティリティも IIFE 内部化。
   ─────────────────────────────────────────────────
   ロード順:
     ...→ 01 → [33] → ... → 22 → 24 → 23
═══════════════════════════════════════════════════ */

/* ── エンジンパラメーター (doGenerate() と同期) ── */
const RC_PARAMS = {
  enabled: false,
  mode:    'vuza',    // 'vuza'|'tiling'|'messiaen'|'polymeter'
  n:       24,        // 全体ステップ数 (約数が多い数推奨: 12/24/36/48)
  voices:  2,         // カノン声部数 (2–4)
  messiaenPattern:  [3, 3, 2, 3, 3, 3, 2], // Messiaen モード用音価配列
  polymeterCycles:  [3, 4],                 // Polymeter モード用各声部周期
  outputChannels:   [2, 3],                 // 出力先 MIDI チャンネル番号
  velocity:         100,
  offsets:          [0, 12],               // 声部ごとの開始オフセット (ステップ)
  presetIndex:      0,                     // Vuza プリセット選択インデックス
};

/* ── 既知 Vuza カノン テーブル ── */
const _RC_VUZA_TABLE = {
  12: [
    { A: [0, 1, 4],    B: [0, 2, 8]  },
    { A: [0, 1, 2, 9], B: [0, 3]     },
  ],
  24: [
    { A: [0, 1, 4, 8],  B: [0, 2, 12] },
    { A: [0, 2, 4, 14], B: [0, 1, 8]  },
    { A: [0, 1, 8, 9],  B: [0, 2, 4]  },
    { A: [0, 3, 6, 9],  B: [0, 2, 16] },
  ],
  36: [
    { A: [0, 1, 2, 12], B: [0, 3, 18] },
    { A: [0, 4, 8, 12], B: [0, 1, 2]  },
  ],
  48: [
    { A: [0, 1, 4, 8, 16], B: [0, 2, 24] },
    { A: [0, 2, 4, 6, 8],  B: [0, 1, 16] },
  ],
};

const RhythmicCanons = (() => {
  'use strict';

  /* ── 内部数学ユーティリティ ── */

  function _gcd(a, b) { return b === 0 ? a : _gcd(b, a % b); }
  function _lcm(a, b) { return (a * b) / _gcd(a, b); }

  function _divisors(n) {
    const divs = [];
    for (let i = 1; i <= Math.sqrt(n); i++) {
      if (n % i === 0) {
        divs.push(i);
        if (i !== n / i) divs.push(n / i);
      }
    }
    return divs.sort((a, b) => a - b);
  }

  /**
   * AとBの畳み込み (Zn上)
   * A⊕B が Zn 全体を被覆するか確認するために使う
   */
  function _tilingConvolution(A, B, n) {
    const result = new Array(n).fill(0);
    for (const a of A) {
      for (const b of B) {
        result[(a + b) % n]++;
      }
    }
    return result;
  }

  /**
   * パターンAの補集合Bを探索して返す
   * 計算量制約: k <= 16 のみ全探索
   */
  function _findTilingComplement(A, n) {
    if (n % A.length !== 0) return { valid: false, complement: null };
    const k = n / A.length;
    if (k > 16) return { valid: false, complement: null };

    let found = null;
    function search(start, current) {
      if (found) return;
      if (current.length === k) {
        const conv = _tilingConvolution(A, current, n);
        if (conv.every(v => v === 1)) found = [...current];
        return;
      }
      for (let i = start; i < n; i++) {
        current.push(i);
        search(i + 1, current);
        current.pop();
        if (found) return;
      }
    }
    search(0, []);
    return found ? { valid: true, complement: found } : { valid: false, complement: null };
  }

  /* ── パターン生成ユーティリティ ── */

  /** ゲートオンステップ配列 → 0/1 バイナリ配列 */
  function _patternToBinary(gateSteps, n) {
    const binary = new Array(n).fill(0);
    for (const step of gateSteps) {
      if (step >= 0 && step < n) binary[step] = 1;
    }
    return binary;
  }

  /** 0/1 配列をオフセット分ローテート (01-euclidean.js の rotatePattern と同機能だが内部名で衝突回避) */
  function _rcRotate(pattern, offset) {
    const n = pattern.length;
    if (!n || offset === 0) return pattern;
    const o = ((offset % n) + n) % n;
    return [...pattern.slice(o), ...pattern.slice(0, o)];
  }

  /** パターンを totalSteps 長さに繰り返す */
  function _repeatToLength(pattern, totalSteps) {
    if (!pattern.length) return new Array(totalSteps).fill(0);
    const result = new Array(totalSteps);
    for (let i = 0; i < totalSteps; i++) result[i] = pattern[i % pattern.length];
    return result;
  }

  /* ── Vuza カノン生成 ── */

  /**
   * n に対応する Vuza カノンペア一覧を返す
   * 既知テーブルにない n は探索（n ≤ 36 のみ現実的）
   */
  function _getVuzaCanons(n) {
    if (_RC_VUZA_TABLE[n]) return _RC_VUZA_TABLE[n];

    const results = [];
    if (n <= 36) {
      const divs = _divisors(n).filter(d => d > 1 && d < n);
      for (const k of divs) {
        // k 要素のパターンを全探索（2^n は大きいので n <= 24 程度に限定）
        if (n > 24) break;
        const maxMask = 1 << n;
        for (let mask = 1; mask < maxMask && results.length < 4; mask++) {
          const A = [];
          for (let i = 0; i < n; i++) if (mask & (1 << i)) A.push(i);
          if (A.length !== k || A[0] !== 0) continue;
          const { valid, complement } = _findTilingComplement(A, n);
          if (valid) results.push({ A, B: complement });
        }
        if (results.length >= 4) break;
      }
    }

    return results.length > 0 ? results : [{ A: [0, 1, 2], B: [0, 3] }];
  }

  /* ── Messiaen 付加値リズム ── */

  function _generateMessiaenPattern(durations, totalSteps) {
    const gates = [];
    let pos = 0;
    for (const dur of durations) {
      if (pos >= totalSteps) break;
      gates.push(pos);
      pos += Math.max(1, dur);
    }
    return gates;
  }

  /* ── Polymeter ── */

  function _generatePolymeter(cycles, totalSteps) {
    return cycles.map(cycle => {
      const gates = [];
      const c = Math.max(1, cycle);
      for (let step = 0; step < totalSteps; step += c) gates.push(step);
      return gates;
    });
  }

  /* ── 公開 API ── */

  /**
   * RC_PARAMS に基づきゲートパターン配列を生成
   * 返り値形式: [{ channel, gates: number[] (0/1), velocity, patternInfo }]
   *
   * doGenerate() 内での使用例:
   *   if (RC_PARAMS.enabled) {
   *     const rcTracks = RhythmicCanons.generate(RC_PARAMS, ppq * 4 * bars);
   *     // rcTracks[i].gates を makeXxx() の gateOverride として渡す
   *   }
   *
   * @param {Object} params     RC_PARAMS
   * @param {number} totalSteps doGenerate() の ppq*4*bars 相当のティック数に合わせる場合は
   *                            呼び出し元で n 単位に変換すること
   * @returns {Array<{channel, gates, velocity, patternInfo}>}
   */
  function generate(params, totalSteps) {
    const n      = Math.max(1, params.n);
    const tracks = [];

    switch (params.mode) {

      case 'vuza':
      case 'tiling': {
        const canons = _getVuzaCanons(n);
        const idx    = params.mode === 'tiling'
          ? Math.floor(canons.length / 2)
          : Math.min(params.presetIndex || 0, canons.length - 1);
        const canon  = canons[idx];
        const voices = [canon.A, canon.B];
        const vCount = Math.min(Math.max(1, params.voices), voices.length);

        for (let v = 0; v < vCount; v++) {
          const offset = params.offsets[v] || 0;
          const binary = _rcRotate(_patternToBinary(voices[v], n), offset);
          tracks.push({
            channel:     params.outputChannels[v] || (v + 1),
            gates:       _repeatToLength(binary, totalSteps),
            velocity:    params.velocity,
            patternInfo: { type: params.mode, n, voice: v, pattern: voices[v], offset },
          });
        }
        break;
      }

      case 'messiaen': {
        const gateSteps = _generateMessiaenPattern(params.messiaenPattern, n);
        const binary    = _patternToBinary(gateSteps, n);
        tracks.push({
          channel:     params.outputChannels[0] || 1,
          gates:       _repeatToLength(binary, totalSteps),
          velocity:    params.velocity,
          patternInfo: { type: 'messiaen', n, pattern: params.messiaenPattern },
        });
        break;
      }

      case 'polymeter': {
        const patterns = _generatePolymeter(params.polymeterCycles, totalSteps);
        patterns.forEach((gateSteps, v) => {
          tracks.push({
            channel:     params.outputChannels[v] || (v + 1),
            gates:       _patternToBinary(gateSteps, totalSteps),
            velocity:    params.velocity,
            patternInfo: { type: 'polymeter', cycle: params.polymeterCycles[v] },
          });
        });
        break;
      }

      default:
        break;
    }

    return tracks;
  }

  /**
   * UI Canvas 描画用のパターン情報を返す
   * getDeviationTable() 相当
   * @param {Object} params RC_PARAMS
   * @returns {{ n, mode, voices: [{label, binary, density, info}] }}
   */
  function getPatternInfo(params) {
    const tracks = generate(params, params.n);
    return {
      n:      params.n,
      mode:   params.mode,
      voices: tracks.map(t => ({
        label:   'ch' + t.channel,
        binary:  t.gates.slice(0, params.n),
        density: t.gates.length
          ? t.gates.filter(g => g === 1).length / t.gates.length
          : 0,
        info:    t.patternInfo,
      })),
    };
  }

  /**
   * Vuza A⊕B=Zn の検証 (デバッグ・UI 確認用)
   * @returns {{ valid, coverage, convolution }}
   */
  function validateTiling(A, B, n) {
    const conv  = _tilingConvolution(A, B, n);
    const valid = conv.every(v => v === 1);
    return {
      valid,
      coverage:    conv.filter(v => v > 0).length / n,
      convolution: conv,
    };
  }

  /**
   * 既知 Vuza パターン一覧を返す (UI プリセット用)
   * @param {number} n
   * @returns {Array<{label, A, B}>}
   */
  function getPresets(n) {
    return _getVuzaCanons(n).map((c, i) => ({
      label: 'Vuza ' + n + '-' + (i + 1) + '  [' + c.A + '] × [' + c.B + ']',
      A: c.A,
      B: c.B,
    }));
  }

  return {
    generate,
    getPatternInfo,
    validateTiling,
    getPresets,
    /* テスト・外部参照用 */
    _getVuzaCanons,
    _tilingConvolution,
    _patternToBinary,
    _rcRotate,
    _gcd,
    _lcm,
  };
})();
