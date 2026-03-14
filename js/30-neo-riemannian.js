/* ═══════════════════════════════════════════════════
   v25.3: NEO-RIEMANNIAN ENGINE
   Hugo Riemann → Lewin / Cohn 拡張
   ─────────────────────────────────────────────────
   設計:
   · P (Parallel)       : 同名長短調変換 — 5度は保持、3度を上下1半音
   · R (Relative)       : 平行調変換   — ルートか5度を長2度移動
   · L (Leading-tone)   : 導音変換     — ルートか5度を半音移動
   · nrTransform(chord, ops): P/R/L の複合変換
   · tonnetzPath(chordA, chordB): 最短変換パスの BFS 探索
   · NREngine.PRESETS: P/R/L 変換プリセット進行
   ─────────────────────────────────────────────────
   Tonnetz 座標系:
   · 完全5度方向 = (+7 semitones) = +x
   · 長3度方向   = (+4 semitones) = +y の斜め
   · 六角格子でトライアドの3頂点が隣接
═══════════════════════════════════════════════════ */
const NREngine = (() => {
  'use strict';

  /* ── 基本変換 ── */

  /**
   * P (Parallel): メジャー ↔ マイナー。5度は保持、3度を半音変換
   * Cm → C, C → Cm
   * @param {{ root:number, quality:string, iv:number[] }} chord
   * @returns {{ root:number, quality:string, iv:number[] }}
   */
  function P(chord) {
    if (chord.quality === '' || chord.quality === 'maj') {
      // Major → Minor: 長3度(4)を短3度(3)に
      return { root: chord.root, quality: 'm', iv: [0, 3, 7],
               rootName: chord.rootName, name: 'Minor' };
    } else if (chord.quality === 'm') {
      // Minor → Major: 短3度(3)を長3度(4)に
      return { root: chord.root, quality: '', iv: [0, 4, 7],
               rootName: chord.rootName, name: 'Major' };
    }
    return chord; // 7th等は変換しない
  }

  /**
   * R (Relative): 平行調変換
   * C → Am (ルートが長2度下 = 短3度上), Am → C
   * Major: ルートを短3度上に移動してマイナーに
   * Minor: ルートを長2度下に移動してメジャーに (= 短3度上のルートのメジャー)
   */
  function R(chord) {
    const r = chord.root;
    if (chord.quality === '' || chord.quality === 'maj') {
      // C Major → A Minor: 新ルート = r + 9 (短6度上) mod 12
      const newRoot = (r + 9) % 12;
      return { root: newRoot, quality: 'm', iv: [0, 3, 7],
               rootName: NN[newRoot], name: 'Minor' };
    } else if (chord.quality === 'm') {
      // Am → C Major: 新ルート = r + 3 (短3度上) mod 12
      const newRoot = (r + 3) % 12;
      return { root: newRoot, quality: '', iv: [0, 4, 7],
               rootName: NN[newRoot], name: 'Major' };
    }
    return chord;
  }

  /**
   * L (Leading-tone): 導音変換
   * C → Em (ルートが半音下), Em → C
   * Major: ルートを半音下げてマイナーに
   * Minor: 5度を半音上げてメジャーに (= 5度音がルートになるメジャー)
   */
  function L(chord) {
    const r = chord.root;
    if (chord.quality === '' || chord.quality === 'maj') {
      // C → Em: 新ルート = r + 4 mod 12
      const newRoot = (r + 4) % 12;
      return { root: newRoot, quality: 'm', iv: [0, 3, 7],
               rootName: NN[newRoot], name: 'Minor' };
    } else if (chord.quality === 'm') {
      // Em → C: 新ルート = r + 8 mod 12 (短6度上 = r - 4)
      const newRoot = (r + 8) % 12;
      return { root: newRoot, quality: '', iv: [0, 4, 7],
               rootName: NN[newRoot], name: 'Major' };
    }
    return chord;
  }

  /* ── 変換テーブル ── */
  const OPS = { P, R, L };

  /**
   * 単一または複合変換を適用
   * @param {Object} chord  { root, quality, iv, rootName }
   * @param {string|string[]} ops  'P', 'R', 'L', 'PL', ['P','R'] など
   * @returns {Object}
   */
  function nrTransform(chord, ops) {
    const opList = Array.isArray(ops) ? ops : [...String(ops)];
    let result = { ...chord };
    for (const op of opList) {
      const fn = OPS[op.toUpperCase()];
      if (fn) result = fn(result);
    }
    return result;
  }

  /**
   * コードを正規化した識別子に変換 (BFS用)
   */
  function chordId(chord) {
    return chord.root + '_' + (chord.quality === '' ? 'M' : chord.quality);
  }

  /**
   * chordA から chordB への最短変換パスを BFS で探索
   * @param {Object} chordA
   * @param {Object} chordB
   * @param {number} maxDepth  最大探索深さ (デフォルト6)
   * @returns {{ path: string[], sequence: Object[] } | null}
   *   path: 変換記号列 ['P','R',...]
   *   sequence: 変換後のコード列 (chordA含む)
   */
  function tonnetzPath(chordA, chordB, maxDepth = 6) {
    const targetId = chordId(chordB);
    if (chordId(chordA) === targetId) return { path: [], sequence: [chordA] };

    const visited = new Map(); // chordId → 前のノード情報
    visited.set(chordId(chordA), null);
    const queue = [{ chord: chordA, path: [], sequence: [chordA] }];

    while (queue.length > 0) {
      const { chord, path, sequence } = queue.shift();
      if (path.length >= maxDepth) continue;

      for (const op of ['P', 'R', 'L']) {
        const next = OPS[op](chord);
        const nid = chordId(next);
        if (visited.has(nid)) continue;
        const newPath = [...path, op];
        const newSeq  = [...sequence, next];
        if (nid === targetId) return { path: newPath, sequence: newSeq };
        visited.set(nid, true);
        queue.push({ chord: next, path: newPath, sequence: newSeq });
      }
    }
    return null; // 到達不能
  }

  /* ── Tonnetz 座標計算 ── */

  /**
   * PC (0-11) の Tonnetz 格子座標を返す
   * 基底ベクトル: 完全5度(+7) = (+1, 0), 長3度(+4) = (+0.5, +1)
   * @param {number} pc  0-11
   * @returns {{ x:number, y:number }}
   */
  function tonnetzCoord(pc) {
    // 5度圏と3度圏の2次元格子
    // 基音 C=0 を原点として
    // 5度 (+7 semitones) = dx=1, dy=0
    // 長3度 (+4 semitones) = dx=0.5, dy=1
    // 各PCに対して最小コストの格子座標を割り当て
    const COORDS = [
      { x: 0,   y: 0 },  // C
      { x: -0.5, y: 3 }, // C#/Db  (3短3度 = 3y)
      { x: 1,   y: 2 },  // D
      { x: 0.5, y: 5 },  // D#/Eb
      { x: 2,   y: 1 },  // E
      { x: 1.5, y: 4 },  // F
      { x: -0.5, y: 2 }, // F#/Gb
      { x: 1,   y: 0 },  // G
      { x: 0.5, y: 3 },  // G#/Ab
      { x: 2,   y: 2 },  // A
      { x: 1.5, y: 5 },  // A#/Bb
      { x: 3,   y: 1 },  // B
    ];
    return COORDS[pc % 12] || { x: 0, y: 0 };
  }

  /* ── プリセット進行 ── */
  const NR_PRESETS = {
    'plp':  { label: 'PLP (C→Cm→Ab→Abm)',  ops: ['P','L','P'],   root: 0, quality: '' },
    'lpl':  { label: 'LPL (C→Em→E→G#m)',   ops: ['L','P','L'],   root: 0, quality: '' },
    'prp':  { label: 'PRP (C→Cm→Eb→Ebm)',  ops: ['P','R','P'],   root: 0, quality: '' },
    'rl':   { label: 'RL (C→Am→Fm)',        ops: ['R','L'],       root: 0, quality: '' },
    'lr':   { label: 'LR (C→Em→Bm)',        ops: ['L','R'],       root: 0, quality: '' },
    'hex1': { label: 'Hexatonic (C Maj cycle)',
              ops: ['P','L','P','L','P','L'],  root: 0, quality: '' },
    'oct1': { label: 'Octatonic (C Maj cycle)',
              ops: ['R','L','R','L','R','L','R','L'], root: 0, quality: '' },
  };

  /**
   * プリセットからコード進行配列を生成
   * @param {string} key  NR_PRESETS のキー
   * @returns {{ chord:Object, bars:number }[]}
   */
  function presetToProgression(key) {
    const preset = NR_PRESETS[key];
    if (!preset) return [];
    const start = { root: preset.root, quality: preset.quality,
                    rootName: NN[preset.root], iv: preset.quality === 'm' ? [0,3,7] : [0,4,7],
                    name: preset.quality === 'm' ? 'Minor' : 'Major' };
    const chords = [start];
    let cur = start;
    for (const op of preset.ops) {
      cur = OPS[op.toUpperCase()](cur);
      chords.push({ ...cur });
    }
    return chords.map(c => ({ chord: c, bars: 4 }));
  }

  return { P, R, L, nrTransform, tonnetzPath, tonnetzCoord, presetToProgression, NR_PRESETS };
})();
