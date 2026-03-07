/* ═══════════════════════════════════════════════════
   v12.2+: TWELVE-TONE MATRIX ENGINE
   Schoenberg / Webern — P · R · I · RI + Fractal
   ─────────────────────────────────────────────────
   UIや既存変数に一切依存しない純粋ロジックモジュール。
   ソース: twelve-tone-matrix.html (Twelve-Tone Fractal Matrix Engine)

   使い方:
     const row = [0,2,4,5,7,9,11,10,8,6,3,1];
     TwelveTone.P(row)   // → Prime (原型)
     TwelveTone.R(row)   // → Retrograde (逆行)
     TwelveTone.I(row)   // → Inversion (転回)
     TwelveTone.RI(row)  // → Retrograde-Inversion (逆行転回)
     TwelveTone.matrix(row)          // → 12×12 転位マトリクス
     TwelveTone.fractalExpand(row,2) // → フラクタル展開
     TwelveTone.transform(row,'RI')  // → 変換ラベルで取得
     TwelveTone.allForms(row)        // → {P,R,I,RI} 一括取得
═══════════════════════════════════════════════════ */
const TwelveTone=(()=>{
  'use strict';

  const NF=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  /** Prime — 原型（そのまま返す） */
  function P(row){return[...row];}

  /** Retrograde — 逆行 */
  function R(row){return[...row].reverse();}

  /** Inversion — 転回（音程を逆向きに） */
  function I(row){
    if(!row.length)return[];
    const res=[row[0]];
    for(let i=1;i<row.length;i++){
      const delta=row[i]-row[i-1];
      res.push(((res[i-1]-delta)%12+12)%12);
    }
    return res;
  }

  /** Retrograde-Inversion — 逆行転回 */
  function RI(row){return R(I(row));}

  /** ラベル文字列で変換を取得 */
  function transform(row,form){
    switch(form){
      case'P':  return P(row);
      case'R':  return R(row);
      case'I':  return I(row);
      case'RI': return RI(row);
      default:  return P(row);
    }
  }

  /** 4形式を一括取得 */
  function allForms(row){
    return{P:P(row),R:R(row),I:I(row),RI:RI(row)};
  }

  /**
   * 12×12 転位マトリクス生成
   * 行 = P0〜P11 (Primeの各転位)、列 = インデックス位置
   * @param {number[]} row  seed音列 (pitch class 0-11 の配列)
   * @returns {number[][]}  12行 × row.length列 のマトリクス
   */
  function matrix(row){
    if(!row.length)return[];
    const p0=P(row);
    const m=[];
    for(let t=0;t<12;t++){
      m.push(p0.map(pc=>(pc+t)%12));
    }
    return m;
  }

  /**
   * フラクタル展開 — P/I/R/RI を再帰的にネスト
   * @param {number[]} row
   * @param {number}   depth  展開の深さ (0=そのまま)
   * @returns {number[]}
   */
  function fractalExpand(row,depth){
    if(depth<=0||!row.length)return[...row];
    const forms=[P(row),I(row),R(row),RI(row)];
    let result=row.map((pc,i)=>{
      const sub=forms[pc%4];
      return sub[i%sub.length];
    });
    return fractalExpand(result,depth-1);
  }

  /**
   * 音列を音名文字列に変換
   * @param {number[]} row  pitch class の配列
   * @returns {string}  "C D# F G …"
   */
  function format(row){
    return row.map(pc=>NF[((pc%12)+12)%12]).join(' ');
  }

  return{P,R,I,RI,transform,allForms,matrix,fractalExpand,format,NF};
})();

