/* ═══════════════════════════════════════════════════
   v20.0: CHORD PROGRESSION ENGINE
   複数コード進行 → 全レイヤーへのバー単位マッピング
   ─────────────────────────────────────────────────
   設計:
   · S.chordProg: コード進行配列 [{chord, bars}, ...]
   · PROG_PARAMS: 補間・ベロシティ変化・トランジション設定
   · ProgEngine.expandToBars(prog, totalBars)
       → [{chord, barStart, barCount}, ...] バー割り当て済み配列
   · ProgEngine.chordAtBar(expanded, bar)
       → {chord, barStart, barCount, phase 0-1 within chord}
   · ProgEngine.commonToneScore(chordA, chordB)
       → 0-1 共通音率（コード間の滑らかさ指標）
   · ProgEngine.smoothnessMatrix(prog)
       → [[score, ...], ...] 進行全体の滑らかさ行列
═══════════════════════════════════════════════════ */
const ProgEngine = (() => {
  'use strict';

  /* ── コード進行プリセット ── */
  const PROG_PRESETS = {
    'II-V-I':     { label: 'II-V-I',      chords: ['Dm7','G7','Cmaj7','Cmaj7'] },
    'I-IV-V-I':   { label: 'I-IV-V-I',    chords: ['C','F','G','C'] },
    'Am-G-F-E':   { label: 'Am-G-F-E',    chords: ['Am','G','F','E'] },
    'I-V-vi-IV':  { label: 'I-V-vi-IV',   chords: ['C','G','Am','F'] },
    '12bar':      { label: '12 Bar Blues', chords: ['C7','C7','C7','C7','F7','F7','C7','C7','G7','F7','C7','G7'] },
    'modal':      { label: 'Modal Drift',  chords: ['Dm7','Em7','Fmaj7','Em7'] },
    'dark':       { label: 'Dark Scape',   chords: ['Am','Bb','G','Am'] },
    'chroma':     { label: 'Chromatic',    chords: ['Cmaj7','Dbmaj7','Dmaj7','Ebmaj7'] },
    'tritone':    { label: 'Tritone Sub',  chords: ['Cmaj7','Db7','Cmaj7','G7b9'] },
    'coltrane':   { label: 'Coltrane',     chords: ['Cmaj7','Ebmaj7','Abmaj7','Bmaj7'] },
  };

  /**
   * コード進行配列をバー割り当てに展開
   * @param {Array<{chord:Object,bars:number}>} prog  進行配列
   * @param {number} totalBars  総バー数
   * @returns {Array<{chord:Object,barStart:number,barCount:number}>}
   */
  function expandToBars(prog, totalBars) {
    if (!prog || !prog.length) return [];
    const total = prog.reduce((s, e) => s + e.bars, 0);
    const expanded = [];
    let bar = 0;
    for (const entry of prog) {
      // totalBars に対して等比スケール
      const scaled = Math.max(1, Math.round(entry.bars / total * totalBars));
      expanded.push({ chord: entry.chord, barStart: bar, barCount: scaled });
      bar += scaled;
    }
    // 端数調整: 最後のエントリを伸縮して totalBars に合わせる
    if (expanded.length > 0) {
      const last = expanded[expanded.length - 1];
      last.barCount = Math.max(1, totalBars - last.barStart);
    }
    return expanded;
  }

  /**
   * 指定バーに対応するコードエントリを返す
   * @param {Array} expanded  expandToBars() の結果
   * @param {number} bar  バー番号 (0-based)
   * @returns {{ chord, barStart, barCount, phase:number }}
   */
  function chordAtBar(expanded, bar) {
    if (!expanded || !expanded.length) return null;
    let entry = expanded[expanded.length - 1];
    for (const e of expanded) {
      if (bar >= e.barStart && bar < e.barStart + e.barCount) {
        entry = e;
        break;
      }
    }
    const phase = (bar - entry.barStart) / Math.max(1, entry.barCount);
    return { ...entry, phase };
  }

  /**
   * 2コード間の共通音率 (0-1)
   * @param {Object} chordA  {root, iv}
   * @param {Object} chordB  {root, iv}
   * @returns {number}
   */
  function commonToneScore(chordA, chordB) {
    if (!chordA || !chordB) return 0;
    const pcsA = new Set(chordA.iv.map(i => ((chordA.root + i) % 12 + 12) % 12));
    const pcsB = new Set(chordB.iv.map(i => ((chordB.root + i) % 12 + 12) % 12));
    let common = 0;
    for (const pc of pcsA) { if (pcsB.has(pc)) common++; }
    const total = new Set([...pcsA, ...pcsB]).size;
    return total > 0 ? common / total : 0;
  }

  /**
   * 進行全体の滑らかさスコア配列 (隣接コード間)
   * @param {Array<{chord:Object,bars:number}>} prog
   * @returns {number[]}  長さ = prog.length - 1
   */
  function smoothnessScores(prog) {
    const scores = [];
    for (let i = 0; i < prog.length - 1; i++) {
      scores.push(commonToneScore(prog[i].chord, prog[i + 1].chord));
    }
    return scores;
  }

  /**
   * 隣接コード間の IV コサイン類似度スコア配列 (PCSetEngine.ivSimilarity ベース)
   * @param {Array<{chord:Object,bars:number}>} prog
   * @returns {number[]}  長さ = prog.length - 1
   */
  function ivSimScores(prog) {
    if (typeof PCSetEngine === 'undefined') return prog.slice(0, -1).map(() => 0);
    const scores = [];
    for (let i = 0; i < prog.length - 1; i++) {
      const ca = prog[i].chord, cb = prog[i + 1].chord;
      if (!ca || !cb) { scores.push(0); continue; }
      // chord.iv は chord内音程インターバル配列 → PC Set の IV ベクトルとは異なる
      // PCSetEngine.analyze でコードの絶対PCセットを取得してから ivSimilarity を計算
      const pcsA = ca.iv.map(i => ((ca.root + i) % 12 + 12) % 12);
      const pcsB = cb.iv.map(i => ((cb.root + i) % 12 + 12) % 12);
      const ivA = PCSetEngine.computeIV(pcsA);
      const ivB = PCSetEngine.computeIV(pcsB);
      scores.push(PCSetEngine.ivSimilarity(ivA, ivB));
    }
    return scores;
  }

  /**
   * ベロシティスケールをコード内フェーズで補間
   * mode: 'flat' | 'swell' | 'fade' | 'accent-in' | 'accent-out'
   * @param {number} baseVel  基本ベロシティ
   * @param {number} phase    コード内位置 0-1
   * @param {string} mode
   * @param {number} amount   変化幅 0-1
   * @returns {number}
   */
  function velShape(baseVel, phase, mode, amount) {
    let mul = 1.0;
    const a = Math.max(0, Math.min(1, amount));
    switch (mode) {
      case 'swell':     mul = 1 - a * 0.4 + a * 0.8 * Math.sin(phase * Math.PI); break;
      case 'fade':      mul = 1 - a * phase * 0.5; break;
      case 'accent-in': mul = 1 - a * 0.3 + a * 0.3 * (1 - phase); break;
      case 'accent-out':mul = 1 - a * 0.3 + a * 0.3 * phase; break;
      default: break; // flat
    }
    return Math.max(1, Math.min(127, Math.round(baseVel * mul)));
  }

  /* ── Modal Mixture: スケール度数上のダイアトニックトライアド/7th和音 ── */

  /**
   * 指定スケール (iv配列) のダイアトニックコード一覧を生成
   * @param {number} root  ルート音 (0-11)
   * @param {number[]} scaleIv  スケール音程配列
   * @param {string} sourceLabel  ラベル用の名前
   * @returns {Array<{chord:Object,degree:string,source:string}>}
   */
  function diatonicChords(root, scaleIv, sourceLabel) {
    const scalePcs = scaleIv.map(i => (root + i) % 12);
    const results = [];
    // 7音スケールのみ処理（5音スケールは度数名が変則的になるためスキップ）
    if (scaleIv.length < 5) return results;
    const degreeNames = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    for (let d = 0; d < Math.min(scaleIv.length, 7); d++) {
      const dr = scalePcs[d];
      // 3度・5度・7度をスケール内音で構築
      const third = scalePcs[(d + 2) % scaleIv.length];
      const fifth  = scalePcs[(d + 4) % scaleIv.length];
      const seventh= scalePcs[(d + 6) % scaleIv.length];
      const i3 = ((third  - dr) + 12) % 12;
      const i5 = ((fifth  - dr) + 12) % 12;
      const i7 = ((seventh- dr) + 12) % 12;
      // トライアドタイプ判定
      let quality = '', iv;
      if      (i3 === 4 && i5 === 7)  { quality = '';    iv = [0,4,7]; }
      else if (i3 === 3 && i5 === 7)  { quality = 'm';   iv = [0,3,7]; }
      else if (i3 === 3 && i5 === 6)  { quality = 'dim'; iv = [0,3,6]; }
      else if (i3 === 4 && i5 === 8)  { quality = 'aug'; iv = [0,4,8]; }
      else continue; // 認識できないトライアド形は飛ばす
      // 7th コードタイプ（スケール内 7th を付加）
      let q7 = quality, iv7 = null;
      if      (quality === ''    && i7 === 11) { q7 = 'maj7'; iv7 = [0,4,7,11]; }
      else if (quality === ''    && i7 === 10) { q7 = '7';    iv7 = [0,4,7,10]; }
      else if (quality === 'm'   && i7 === 10) { q7 = 'm7';   iv7 = [0,3,7,10]; }
      else if (quality === 'm'   && i7 === 11) { q7 = 'mM7';  iv7 = [0,3,7,11]; }
      else if (quality === 'dim' && i7 === 9)  { q7 = 'dim7'; iv7 = [0,3,6,9]; }
      else if (quality === 'dim' && i7 === 10) { q7 = 'm7b5'; iv7 = [0,3,6,10]; }
      const rootName = NN[dr];
      const _CNAME = { '': 'Major', 'm': 'Minor', 'dim': 'Diminished', 'aug': 'Augmented',
                       'maj7': 'Major 7th', '7': 'Dominant 7th', 'm7': 'Minor 7th',
                       'mM7': 'Minor Major 7th', 'dim7': 'Diminished 7th', 'm7b5': 'Half-Diminished' };
      const chord = { root: dr, rootName, quality, iv, name: _CNAME[quality] || quality };
      const chord7 = iv7 ? { root: dr, rootName, quality: q7, iv: iv7,
                             name: _CNAME[q7] || q7 } : null;
      const deg = degreeNames[d] || String(d + 1);
      results.push({ chord, chord7, degree: deg, source: sourceLabel });
    }
    return results;
  }

  /**
   * ルート音・スケール名から借用コード候補を返す
   * 同主マイナー・同主メジャー・ドリアン・フリジアン・ミクソリディアン の
   * ダイアトニックコードを列挙し、現在進行に含まれないものを返す
   * @param {number} root  ルート音 (0-11)
   * @param {string} currentScaleName  現在のスケール名 (ALL_SCALES のキー)
   * @returns {Array<{chord:Object,chord7:Object|null,degree:string,source:string}>}
   */
  function borrowedChords(root, currentScaleName) {
    if (typeof ALL_SCALES === 'undefined') return [];

    // 借用元スケールリスト（現在スケール以外から借用）
    const sourceMap = [
      { name: 'Ionian (Major)',        label: 'Parallel Maj'  },
      { name: 'Aeolian (Natural Minor)',label: 'Parallel Min'  },
      { name: 'Dorian',                label: 'Dorian'        },
      { name: 'Phrygian',              label: 'Phrygian'      },
      { name: 'Mixolydian',            label: 'Mixolydian'    },
      { name: 'Lydian',                label: 'Lydian'        },
      { name: 'Harmonic Minor',        label: 'Harm.Min'      },
      { name: 'Melodic Minor (Asc)',   label: 'Mel.Min'       },
    ];

    const allCandidates = [];
    const seen = new Set();
    for (const src of sourceMap) {
      if (src.name === currentScaleName) continue; // 現在スケール自体は除外
      const scaleIv = ALL_SCALES[src.name];
      if (!scaleIv) continue;
      for (const entry of diatonicChords(root, scaleIv.iv, src.label)) {
        const key = entry.chord.root + '_' + entry.chord.quality;
        if (!seen.has(key)) {
          seen.add(key);
          allCandidates.push(entry);
        }
      }
    }
    return allCandidates;
  }

  return { expandToBars, chordAtBar, commonToneScore, smoothnessScores, ivSimScores, velShape,
           borrowedChords, diatonicChords, PROG_PRESETS };
})();

/* ═══ PROG STATE — グローバル状態 ═══ */
const PROG_STATE = {
  enabled:     false,             /* コード進行モード ON/OFF */
  prog:        [],                /* [{chord:Object, bars:number}, ...] */
  /* パラメーター */
  velShapeMode:'flat',            /* 'flat'|'swell'|'fade'|'accent-in'|'accent-out' */
  velShapeAmt: 0.5,               /* 変化幅 0-1 */
  transitionMode: 'hard',         /* 'hard'|'smooth' (smooth=前コード音を次コードで可能な限り保持) */
  loopProg:    true,              /* 進行をループするか */
};
