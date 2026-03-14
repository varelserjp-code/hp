/* ═══════════════════════════════════════════════════
   v16.0: INTEGRAL SERIALISM ENGINE
   Boulez · Stockhausen — Total Parameter Serialization
   ─────────────────────────────────────────────────
   ピッチ音列（12音）から3つの独立派生音列を生成し、
   Duration・Velocity・GateTime を決定論的数式で支配する。

   理論的根拠:
     Pierre Boulez "Structures Ia" (1952)
       ピッチ行列の各形式(P/I/R/RI)から音価・強度を導出
     Karlheinz Stockhausen "Kreuzspiel" (1951)
       12段階の強度数列・音域数列を独立した系列として使用

   設計:
     durationSeries : P形式→音符の長さ (ppq倍率 12段階)
     velocitySeries : I形式→MIDI velocity (pppp〜ffff 12段階)
     gateSeries     : RI形式→ゲート比率 (0.08〜1.20 12段階)
     各系列はP/R/I/RI形式を曲の進行に従って循環

   公開API:
     IntegralSerialism.create(pitchRow, ppq)
       → { next(), reset(), info() }
     inst.next()
       → { durationTick, velocity, gateRatio, form, index }
     IntegralSerialism.isActive(inst)  → boolean
═══════════════════════════════════════════════════ */
const IntegralSerialism=(()=>{
'use strict';

/* Boulez "Structures Ia" 音価系列 (32分〜2分 12段階) */
const DUR_TABLE=[1/8,1/6,1/4,1/3,3/8,1/2,2/3,3/4,1,4/3,3/2,2];
/* pppp(8)〜ffff(127) 12段階 */
const VEL_TABLE=[8,16,24,32,42,52,64,76,90,104,115,127];
/* Stockhausen articulation — staccatissimo〜overlap */
const GATE_TABLE=[0.08,0.12,0.18,0.25,0.33,0.45,0.55,0.65,0.78,0.90,1.05,1.20];

/** ピッチ音列を順位付きインデックス(0-11)に正規化 */
function rankRow(row){
  const sorted=[...row].sort((a,b)=>a-b);
  const uniq=[...new Set(sorted)];
  return row.map(pc=>uniq.indexOf(((pc%12)+12)%12));
}

/**
 * IntegralSerialism インスタンスを生成
 * @param {number[]} pitchRow  12音ピッチクラス配列
 * @param {number}   ppq       MIDI PPQ (480)
 */
function create(pitchRow, ppq){
  if(!pitchRow||pitchRow.length<2) return null;
  ppq=ppq||480;
  const FORMS=['P','R','I','RI'];

  /* 各変換形式をランク変換 */
  const ranked={
    P:  rankRow(TwelveTone.P(pitchRow)),
    R:  rankRow(TwelveTone.R(pitchRow)),
    I:  rankRow(TwelveTone.I(pitchRow)),
    RI: rankRow(TwelveTone.RI(pitchRow)),
  };

  /* 音価系列: P形式 */
  const durSeries={};
  /* ベロシティ系列: I形式から導出 (転回形式で強度を支配) */
  const velSeries={};
  /* ゲート系列: RI形式から導出 (逆行転回でアーティキュレーション) */
  const gateSeries={};
  for(const f of FORMS){
    durSeries[f]  = ranked[f].map(i=>Math.max(1,Math.round(DUR_TABLE[i%12]*ppq)));
    /* velはIとPを入れ替えてクロスリレーション */
    const vf={'P':'I','R':'RI','I':'P','RI':'R'}[f];
    velSeries[f]  = ranked[vf].map(i=>VEL_TABLE[i%12]);
    const gf={'P':'RI','R':'I','I':'R','RI':'P'}[f];
    gateSeries[f] = ranked[gf].map(i=>GATE_TABLE[i%12]);
  }

  let formIdx=0, noteIdx=0, callCount=0;

  return {
    /**
     * 次の直列値を取得。ピッチと完全に独立したカウンタで進む。
     * @returns {{durationTick, velocity, gateRatio, form, index}}
     */
    next(){
      const form=FORMS[formIdx%4];
      const len=durSeries[form].length;
      const idx=noteIdx%len;
      const out={
        durationTick: durSeries[form][idx],
        velocity:     velSeries[form][idx],
        gateRatio:    gateSeries[form][idx],
        form, index:idx
      };
      noteIdx++;
      if(noteIdx%len===0) formIdx++;  // 1周したら次の形式へ
      callCount++;
      return out;
    },

    reset(){ formIdx=0; noteIdx=0; callCount=0; },

    /** UIデバッグ用: 系列情報を返す */
    info(){
      return{
        durSeries, velSeries, gateSeries,
        currentForm: FORMS[formIdx%4],
        noteIndex: noteIdx, callCount,
        /* 現在フォームの先頭12値サマリ */
        summary: (()=>{
          const f=FORMS[formIdx%4];
          return{
            form:f,
            vel: velSeries[f].slice(0,12).join(' '),
            dur: durSeries[f].slice(0,12).map(v=>(v/ppq).toFixed(2)).join(' '),
            gate: gateSeries[f].slice(0,12).map(v=>v.toFixed(2)).join(' '),
          };
        })()
      };
    },

    get callCount(){ return callCount; }
  };
}

/** インスタンス有効チェック */
function isActive(inst){ return inst!=null&&typeof inst.next==='function'; }

return{create, isActive, DUR_TABLE, VEL_TABLE, GATE_TABLE};
})();




