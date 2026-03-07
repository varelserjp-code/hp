/* ═══════════════════════════════════════════════════
   v12.2 NEW: NEGATIVE HARMONY ENGINE
   Ernst Levy · axis = root + 3.5 semitones
═══════════════════════════════════════════════════ */
const NegHarmony=(()=>{
  const NF=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  const AX=['G/A♭','A♭/A','A/B♭','B♭/B','B/C','C/D♭','D♭/D','D/E♭','E♭/E','E/F','F/G♭','G♭/G'];
  const CDB=[['',      [0,4,7]],['m',     [0,3,7]],['dim',   [0,3,6]],['aug',   [0,4,8]],['sus2',  [0,2,7]],['sus4',  [0,5,7]],['M7',    [0,4,7,11]],['7',     [0,4,7,10]],['m7',    [0,3,7,10]],['mM7',   [0,3,7,11]],['dim7',  [0,3,6,9]],['m7b5',  [0,3,6,10]],['aug7',  [0,4,8,10]],['augM7', [0,4,8,11]],['7sus4', [0,5,7,10]],['6',     [0,4,7,9]],['m6',    [0,3,7,9]],['6/9',   [0,2,4,7,9]],['add9',  [0,2,4,7]],['madd9', [0,2,3,7]],['M9',    [0,2,4,7,11]],['9',     [0,2,4,7,10]],['m9',    [0,2,3,7,10]],['M11',   [0,2,4,5,7,11]],['11',    [0,2,4,5,7,10]],['m11',   [0,2,3,5,7,10]],['M13',   [0,2,4,7,9,11]],['13',    [0,2,4,7,9,10]],['m13',   [0,2,3,7,9,10]],['7b5',   [0,4,6,10]],['7#5',   [0,4,8,10]],['7b9',   [0,1,4,7,10]],['7#9',   [0,3,4,7,10]],['7b5b9', [0,1,4,6,10]],['7b5#9', [0,3,4,6,10]],['M7#11', [0,4,6,7,11]],['M7b5',  [0,4,6,11]],['9sus4', [0,2,5,7,10]],['dim(add9)',[0,2,3,6]],['5',     [0,7]]];
  const CM=new Map();for(const[nm,iv]of CDB){const k=[...iv].sort((a,b)=>a-b).join(',');if(!CM.has(k))CM.set(k,nm);}
  function identify(pcs){const ns=[...new Set(pcs.map(n=>((n%12)+12)%12))].sort((a,b)=>a-b);if(!ns.length)return null;for(let r=0;r<ns.length;r++){const root=ns[r];const iv=ns.map(n=>((n-root+12)%12)).sort((a,b)=>a-b);const k=iv.join(',');if(CM.has(k))return{root,suffix:CM.get(k)};}return null;}
  function invert(notes,keyRoot){const ax=keyRoot+3.5;return notes.map(n=>((Math.round(2*ax-n)%12)+12)%12);}
  function chordToNotes(ri,ti){return CDB[ti][1].map(i=>(ri+i)%12);}

  /* ─── v12.2+: standalone batch converter ───
     入力: progression = [{root:0-11, intervals:[0,4,7,...]}, ...]
            key = 0-11 (調性ルート, デフォルト 0=C)
     出力: [{root, intervals, notes, name, rootName}]
     UI や既存の変数には一切依存しない純粋関数。               */
  function convertProgression(progression, key){
    if(key==null) key=0;
    const ax=key+3.5;
    function inv(n){return((Math.round(2*ax-n)%12)+12)%12;}
    function normIv(ns){const r=ns[0];return ns.map(n=>((n-r+12)%12));}
    return progression.map(chord=>{
      const abs=chord.intervals.map(iv=>(chord.root+iv)%12);
      const inverted=abs.map(inv);
      const iv=normIv(inverted);
      const id=identify(inverted);
      return{
        root:     inverted[0],
        rootName: NF[inverted[0]],
        intervals:iv,
        notes:    inverted,
        name:     id ? NF[id.root]+(id.suffix||'') : '(?)',
        suffix:   id ? id.suffix : null
      };
    });
  }

  return{NF,AX,CDB,identify,invert,chordToNotes,convertProgression};
})();

/* ═══════════════════════════════════════════════════
   v12.2+: GLOBAL CONVENIENCE — negativeHarmony()
   外部依存ゼロの純粋関数。UIに一切触れない。
   ─────────────────────────────────────────────────
   使い方:
     const shadow = negativeHarmony(
       [
         { root: 0, intervals: [0,4,7] },      // C
         { root: 9, intervals: [0,3,7,10] },    // Am7
         { root: 2, intervals: [0,3,7,10] },    // Dm7
         { root: 7, intervals: [0,4,7,10] },    // G7
       ],
       0  // key = C
     );
     // → [{root:7, rootName:'G', intervals:[...], notes:[...], name:'Gm', suffix:'m'}, ...]
═══════════════════════════════════════════════════ */
function negativeHarmony(progression, key){
  return NegHarmony.convertProgression(progression, key);
}

