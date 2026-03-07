/* ═══════════════════════════════════════════════════════════════
   PC SET THEORY ENGINE  (Allen Forte 1973)
   Pitch-Class Set Theory → MIDI generation integration
   ─────────────────────────────────────────────────────────────
   公開API:
     PCSetEngine.analyze(pcs)          → {primeForm, iv, forte, dissonanceScore, ...}
     PCSetEngine.ivWeights(iv)         → {halfStep,wholeTone,minor3,major3,fourth,tritone}
     PCSetEngine.zRelatedSets(iv)      → [{forte,primeForm},...] (Z関係セット)
     PCSetEngine.pcSetPool(pcs,rootOct,octLayers) → MIDI note pool (IVに基づく並び順)
     PCSetEngine.barPCSet(bar,bars,analysis) → そのbarで推奨されるPC集合(Z遷移)
     PCSetEngine.poolOrder(pool,iv)    → IVの特性でpool順序を再整列
     PCSetEngine.dissonanceDynamic(iv,tension) → 動的不協和係数(0-1)
   ═══════════════════════════════════════════════════════════════ */
const PCSetEngine=(()=>{
'use strict';

/* ── FORTE DATABASE (Allen Forte, 244 set-classes) ── */
const FORTE_DB=(()=>{
  const raw=[
    ['2-1',[0,1],[1,0,0,0,0,0]],['2-2',[0,2],[0,1,0,0,0,0]],
    ['2-3',[0,3],[0,0,1,0,0,0]],['2-4',[0,4],[0,0,0,1,0,0]],
    ['2-5',[0,5],[0,0,0,0,1,0]],['2-6',[0,6],[0,0,0,0,0,1]],
    ['3-1',[0,1,2],[2,1,0,0,0,0]],['3-2',[0,1,3],[1,1,1,0,0,0]],
    ['3-3',[0,1,4],[1,0,1,1,0,0]],['3-4',[0,1,5],[1,0,0,1,1,0]],
    ['3-5',[0,1,6],[1,0,0,0,1,1]],['3-6',[0,2,4],[0,2,0,1,0,0]],
    ['3-7',[0,2,5],[0,1,1,0,1,0]],['3-8',[0,2,6],[0,1,0,1,0,1]],
    ['3-9',[0,2,7],[0,1,0,0,2,0]],['3-10',[0,3,6],[0,0,2,0,0,1]],
    ['3-11',[0,3,7],[0,0,1,1,1,0]],['3-12',[0,4,8],[0,0,0,3,0,0]],
    ['4-1',[0,1,2,3],[3,2,1,0,0,0]],['4-2',[0,1,2,4],[2,2,1,1,0,0]],
    ['4-3',[0,1,3,4],[2,1,2,1,0,0]],['4-4',[0,1,2,5],[2,1,1,1,1,0]],
    ['4-5',[0,1,2,6],[2,1,0,1,1,1]],['4-6',[0,1,2,7],[2,1,0,0,2,1]],
    ['4-7',[0,1,4,5],[2,0,1,2,1,0]],['4-8',[0,1,5,6],[2,0,0,1,2,1]],
    ['4-9',[0,1,6,7],[2,0,0,2,0,2]],['4-10',[0,2,3,5],[1,2,2,0,1,0]],
    ['4-11',[0,1,3,5],[1,2,1,1,1,0]],['4-12',[0,2,3,6],[1,1,2,1,0,1]],
    ['4-13',[0,1,3,6],[1,1,2,0,1,1]],['4-14',[0,2,3,7],[1,1,1,1,2,0]],
    ['4-16',[0,1,5,7],[1,1,0,1,2,1]],['4-17',[0,3,4,7],[1,0,2,2,1,0]],
    ['4-18',[0,1,4,7],[1,0,2,1,1,1]],['4-19',[0,1,4,8],[1,0,1,3,1,0]],
    ['4-20',[0,1,5,8],[1,0,1,2,2,0]],['4-21',[0,2,4,6],[0,3,0,2,0,1]],
    ['4-22',[0,2,4,7],[0,2,1,1,2,0]],['4-23',[0,2,5,7],[0,2,1,0,3,0]],
    ['4-24',[0,2,4,8],[0,2,0,3,0,1]],['4-25',[0,2,6,8],[0,2,0,2,0,2]],
    ['4-26',[0,3,5,8],[0,1,2,1,2,0]],['4-27',[0,2,5,8],[0,1,2,1,1,1]],
    ['4-28',[0,3,6,9],[0,0,4,0,0,2]],['4-29',[0,1,3,7],[1,1,1,1,2,0]],
    ['5-1',[0,1,2,3,4],[4,3,2,1,0,0]],['5-2',[0,1,2,3,5],[3,3,2,1,1,0]],
    ['5-3',[0,1,2,4,5],[3,2,2,2,1,0]],['5-4',[0,1,2,3,6],[3,2,2,1,1,1]],
    ['5-5',[0,1,2,3,7],[3,2,2,0,2,1]],['5-6',[0,1,2,5,6],[3,1,1,2,2,1]],
    ['5-7',[0,1,2,6,7],[3,1,0,2,2,2]],['5-8',[0,2,3,4,6],[2,3,2,2,0,1]],
    ['5-9',[0,1,2,4,6],[2,3,1,2,1,1]],['5-10',[0,1,3,4,6],[2,2,3,1,1,1]],
    ['5-11',[0,2,3,4,7],[2,2,2,2,2,0]],['5-z12',[0,1,3,5,6],[2,2,2,1,2,1]],
    ['5-13',[0,1,2,4,8],[2,2,1,3,1,1]],['5-14',[0,1,2,5,7],[2,2,1,1,3,1]],
    ['5-15',[0,1,2,6,8],[2,2,0,2,2,2]],['5-16',[0,1,3,4,7],[2,1,3,2,1,1]],
    ['5-z17',[0,1,3,4,8],[2,1,2,3,2,0]],['5-z18',[0,1,4,5,7],[2,1,2,2,2,1]],
    ['5-19',[0,1,3,6,7],[2,1,2,1,2,2]],['5-20',[0,1,3,7,8],[2,1,1,2,3,1]],
    ['5-21',[0,1,4,5,8],[2,0,2,4,2,0]],['5-22',[0,1,4,7,8],[2,0,2,2,2,2]],
    ['5-23',[0,2,3,5,7],[1,3,2,1,3,0]],['5-24',[0,1,3,5,7],[1,3,1,2,3,0]],
    ['5-25',[0,2,3,5,8],[1,2,3,1,2,1]],['5-26',[0,2,4,5,8],[1,2,2,3,1,1]],
    ['5-27',[0,1,3,5,8],[1,2,2,2,3,0]],['5-28',[0,2,3,6,8],[1,2,2,2,1,2]],
    ['5-29',[0,1,3,6,8],[1,2,2,1,3,1]],['5-30',[0,1,4,6,8],[1,2,1,3,2,1]],
    ['5-31',[0,1,3,6,9],[1,1,4,1,1,2]],['5-32',[0,1,4,6,9],[1,1,3,2,2,1]],
    ['5-33',[0,2,4,6,8],[0,4,0,4,0,2]],['5-34',[0,2,4,6,9],[0,3,2,2,2,1]],
    ['5-35',[0,2,4,7,9],[0,3,2,1,4,0]],
    ['6-1',[0,1,2,3,4,5],[5,4,3,2,1,0]],
    ['6-20',[0,1,4,5,8,9],[3,0,3,6,3,0]],
    ['6-35',[0,2,4,6,8,10],[0,6,0,6,0,3]],
    ['6-z3',[0,1,2,3,4,6],[4,3,3,2,1,1]],['6-z4',[0,1,2,4,5,6],[4,2,2,2,3,1]],
    ['6-z6',[0,1,2,5,6,7],[4,2,0,2,4,2]],['6-7',[0,1,2,6,7,8],[4,2,0,2,2,4]],
    ['6-z10',[0,1,3,4,5,7],[3,3,3,2,2,1]],['6-z11',[0,1,2,4,5,7],[3,3,2,2,3,1]],
    ['6-z13',[0,1,3,4,6,7],[3,2,4,2,2,1]],['6-14',[0,1,3,4,5,8],[3,2,3,4,3,1]],
    ['6-15',[0,1,2,4,5,8],[3,2,3,4,2,0]],['6-16',[0,1,4,5,6,8],[3,2,3,4,0,2]],
    ['6-z17',[0,1,2,4,7,8],[3,2,2,2,4,1]],['6-18',[0,1,2,5,7,8],[3,2,2,2,2,3]],
    ['6-z19',[0,1,3,4,7,8],[3,2,3,4,3,1]],['6-21',[0,2,3,4,6,8],[2,4,2,4,2,0]],
    ['6-22',[0,1,2,4,6,8],[2,4,1,4,2,1]],['6-z23',[0,2,3,5,6,8],[2,3,4,2,2,1]],
    ['6-z24',[0,1,3,4,6,8],[2,3,3,3,3,0]],['6-z25',[0,1,3,5,6,8],[2,3,3,2,4,0]],
    ['6-z26',[0,1,3,5,7,8],[2,3,2,3,4,0]],['6-27',[0,1,3,4,6,9],[2,2,5,2,2,1]],
    ['6-z28',[0,1,3,5,6,9],[2,2,4,3,2,1]],['6-z29',[0,1,3,6,8,9],[2,2,4,2,3,1]],
    ['6-30',[0,1,3,6,7,9],[2,2,4,2,2,2]],['6-31',[0,1,3,5,8,9],[2,2,3,4,3,0]],
    ['6-32',[0,2,4,5,7,9],[1,4,3,2,5,0]],['6-33',[0,2,3,5,7,9],[1,4,3,2,4,1]],
    ['6-34',[0,1,3,5,7,9],[1,4,2,4,2,1]],
    ['6-z36',[0,1,2,3,4,7],[4,3,3,1,2,1]],['6-z37',[0,1,2,3,4,8],[4,3,2,3,1,1]],
    ['6-z38',[0,1,2,3,7,8],[4,2,1,2,4,1]],['6-z39',[0,2,3,4,5,8],[3,3,3,3,1,1]],
    ['6-z40',[0,1,2,3,5,8],[3,3,3,2,2,1]],['6-z41',[0,1,2,3,6,8],[3,3,2,3,2,1]],
    ['6-z42',[0,1,2,3,6,9],[3,2,5,1,2,1]],['6-z43',[0,1,2,5,6,8],[3,2,2,3,3,1]],
    ['6-z44',[0,1,2,5,6,9],[3,1,4,2,2,2]],['6-z45',[0,2,3,4,6,9],[2,3,4,2,2,1]],
    ['6-z46',[0,1,2,4,6,9],[2,3,3,3,2,1]],['6-z47',[0,1,2,4,7,9],[2,3,3,2,3,1]],
    ['6-z48',[0,1,2,5,7,9],[2,3,2,3,4,0]],['6-z49',[0,1,3,4,7,9],[2,2,4,3,2,1]],
    ['6-z50',[0,1,4,6,7,9],[2,2,4,2,3,1]],
    ['7-35',[0,1,3,5,6,8,10],[2,5,4,3,6,1]],
    ['7-34',[0,1,3,4,6,8,10],[2,5,4,4,4,2]],
    ['7-20',[0,1,2,4,7,8,9],[4,3,4,6,4,3]],
    ['8-28',[0,1,3,4,6,7,9,10],[4,4,8,4,4,4]],
    ['9-12',[0,1,2,4,5,6,8,9,10],[6,6,6,9,6,3]],
  ];
  const db={};
  for(const [forte,pf,iv] of raw) db[forte]={forte,primeForm:pf,iv};
  return db;
})();

/* ── コアアルゴリズム ── */
function computePrimeForm(pcs){
  const sorted=[...new Set(pcs)].map(p=>((p%12)+12)%12).sort((a,b)=>a-b);
  if(sorted.length===0)return[];
  function allRots(a){return a.map((_,i)=>a.slice(i).concat(a.slice(0,i)));}
  function norm(r){const b=r[0];return r.map(p=>((p-b+12)%12));}
  function mostCompact(rots){
    return rots.reduce((best,cur)=>{
      const n=norm(cur),b=norm(best);
      for(let i=n.length-1;i>=0;i--){if(n[i]<b[i])return cur;if(n[i]>b[i])return best;}
      return best;
    });
  }
  const rots=allRots(sorted);
  const best=mostCompact(rots);
  const inv=sorted.map(p=>((12-p)%12)).sort((a,b)=>a-b);
  const bestInv=mostCompact(allRots(inv));
  const n1=norm(best),n2=norm(bestInv);
  for(let i=n1.length-1;i>=0;i--){if(n1[i]<n2[i])return n1;if(n1[i]>n2[i])return n2;}
  return n1;
}

function computeIV(pcs){
  const arr=[...pcs];
  const iv=[0,0,0,0,0,0];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
    let d=Math.abs(arr[i]-arr[j])%12;
    if(d>6)d=12-d;
    if(d>=1&&d<=6)iv[d-1]++;
  }
  return iv;
}

function computeDissonanceScore(iv){
  // m2/TT重視の不協和スコア (0-100)
  const w=[5,2,1,1,2,3];
  let d=0; iv.forEach((v,i)=>d+=v*w[i]);
  return Math.min(100,Math.round(d*8));
}

function findForteNumber(pf){
  const s=pf.join(',');
  for(const[name,e]of Object.entries(FORTE_DB)){if(e.primeForm.join(',')===s)return name;}
  return '?';
}

function findZRelated(iv,selfForte){
  const ivStr=iv.join('');
  return Object.values(FORTE_DB).filter(e=>e.iv.join('')===ivStr&&(!selfForte||e.forte!==selfForte));
}

/* ── MIDI生成統合API ── */

/**
 * PC集合を解析してMIDI生成に使える情報を返す
 * @param {number[]} pcs - ピッチクラス配列(0-11)
 * @returns {Object} analysis
 */
function analyze(pcs){
  const cleanPcs=[...new Set(pcs.map(p=>((p%12)+12)%12))].sort((a,b)=>a-b);
  if(cleanPcs.length<2)return null;
  const pf=computePrimeForm(cleanPcs);
  const iv=computeIV(cleanPcs);
  const forte=findForteNumber(pf);
  const dissonanceScore=computeDissonanceScore(iv);
  const zRelated=findZRelated(iv,forte);
  // IVの特性分類
  const total=iv.reduce((s,v)=>s+v,0)||1;
  const ivNorm=iv.map(v=>v/total); // 正規化IVベクトル
  const character={
    chromatic: ivNorm[0],   // m2比率 → 半音密集度
    diatonic:  ivNorm[1],   // M2比率 → 全音素性
    minor3:    ivNorm[2],   // m3比率 → マイナー感
    major3:    ivNorm[3],   // M3比率 → メジャー感
    quartal:   ivNorm[4],   // P4比率 → 四度堆積感
    tritonic:  ivNorm[5],   // TT比率 → 三全音緊張
  };
  return{pcs:cleanPcs,primeForm:pf,iv,forte,dissonanceScore,zRelated,character,ivNorm};
}

/**
 * IVの特性に基づいてノートプールの並び順を変換
 * 音楽的に意味のある音程優先順でノートが選ばれるようになる
 * @param {number[]} pool - MIDIノート番号の配列
 * @param {Object} analysis - analyze()の戻り値
 * @returns {number[]} 並び替えられたpool
 */
function poolOrder(pool,analysis){
  if(!analysis||!pool.length)return pool;
  const{iv,character}=analysis;
  // 支配的な音程タイプを特定
  const maxIdx=iv.indexOf(Math.max(...iv));
  const preferredIntervals={
    0:[1,2,11],    // m2支配 → 半音+長7度（chromatic）
    1:[2,10],      // M2支配 → 全音（diatonic）
    2:[3,9],       // m3支配 → 短3度・長6度
    3:[4,8],       // M3支配 → 長3度・短6度
    4:[5,7],       // P4支配 → 4・5度（quartal）
    5:[6],         // TT支配 → 三全音
  }[maxIdx]||[5,7];
  // preferred intervaに基づいてroot(pool中点)から距離をスコアリング
  const root=pool[Math.floor(pool.length/2)];
  return [...pool].sort((a,b)=>{
    const da=preferredIntervals.includes(Math.abs(a-root)%12)?0:1;
    const db=preferredIntervals.includes(Math.abs(b-root)%12)?0:1;
    if(da!==db)return da-db;
    return Math.abs(a-root)-Math.abs(b-root);
  });
}

/**
 * Z関係セットを使ったバー間PC集合遷移
 * 曲のbar位置に応じて、同じIVを持つ異なるPC集合へ遷移する
 * @param {number} bar - 現在のバー番号
 * @param {number} bars - 総バー数
 * @param {Object} analysis - analyze()の戻り値
 * @param {number} rootPc - ルートPC(0-11)
 * @returns {number[]|null} 遷移後のPC集合、またはnull(遷移しない)
 */
function barPCSet(bar,bars,analysis,rootPc){
  if(!analysis||!analysis.zRelated.length)return null;
  // 曲の1/3, 2/3地点でZ関係セットに遷移
  const transitions=[Math.floor(bars/3),Math.floor(bars*2/3)];
  const phase=transitions.filter(t=>bar===t).length;
  if(phase===0)return null;
  const zIdx=(Math.floor(bar/bars*analysis.zRelated.length))%analysis.zRelated.length;
  const target=analysis.zRelated[zIdx];
  if(!target)return null;
  // ルートPCから移調して適用
  return target.primeForm.map(p=>(p+rootPc)%12);
}

/**
 * テンション値とIVを組み合わせた動的不協和係数
 * IVの半音・三全音比率が高いほど、同じtension値でも強い不協和を返す
 * @param {Object} analysis - analyze()の戻り値
 * @param {number} tension - テンション値(0-1)
 * @returns {number} 0-1の動的不協和係数
 */
function dissonanceDynamic(analysis,tension){
  if(!analysis)return tension;
  const{character}=analysis;
  // IVの半音+三全音比率で不協和係数を増幅
  const ivDissonanceFactor=1+(character.chromatic+character.tritonic)*0.6;
  // IVの4度+5度比率で協和係数を減衰
  const ivConsonanceFactor=1-character.quartal*0.3;
  return Math.max(0,Math.min(1,tension*ivDissonanceFactor*ivConsonanceFactor));
}

/**
 * IV特性に基づいたゲート時間比率
 * quartal IVは長いサステイン、chromatic IVは短い断片的な音
 * @param {Object} analysis
 * @returns {number} gate multiplier (0.5-1.5)
 */
function gateMultiplier(analysis){
  if(!analysis)return 1.0;
  const{character}=analysis;
  // quartal/major3 → 長いゲート(sustain重視)
  // chromatic/tritonic → 短いゲート(断片的)
  return 0.6+character.quartal*0.8+character.major3*0.4-character.chromatic*0.4-character.tritonic*0.3;
}

/**
 * 2つのIVベクトル間のコサイン類似度 (0-1)
 * PCSet Similarity Map の距離計算に使用
 * @param {number[]} ivA - 区間ベクトル [6要素]
 * @param {number[]} ivB - 区間ベクトル [6要素]
 * @returns {number} 0(完全不一致) ~ 1(完全一致)
 */
function ivSimilarity(ivA, ivB){
  let dot=0, na=0, nb=0;
  for(let i=0;i<6;i++){
    dot += ivA[i]*ivB[i];
    na  += ivA[i]*ivA[i];
    nb  += ivB[i]*ivB[i];
  }
  if(!na||!nb) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

/**
 * 指定したPC集合に類似するForteセットを上位N件返す
 * @param {number[]} pcs - 比較元ピッチクラス配列
 * @param {number} topN  - 返す件数 (デフォルト 20)
 * @returns {{ forte:string, primeForm:number[], iv:number[], similarity:number }[]}
 */
function similarSets(pcs, topN){
  topN = topN || 20;
  const base = analyze(pcs);
  if(!base) return [];
  const results = [];
  for(const [, entry] of Object.entries(FORTE_DB)){
    const sim = ivSimilarity(base.iv, entry.iv);
    results.push({ forte:entry.forte, primeForm:entry.primeForm, iv:entry.iv, similarity:sim });
  }
  results.sort((a,b)=>b.similarity-a.similarity);
  // 自分自身(similarity=1.0 かつ 同primeForm)を除外してtopN件
  const selfPF = base.primeForm.join(',');
  return results.filter(r=>r.primeForm.join(',')!==selfPF).slice(0,topN);
}

return{analyze,computePrimeForm,computeIV,computeDissonanceScore,findForteNumber,findZRelated,poolOrder,barPCSet,dissonanceDynamic,gateMultiplier,ivSimilarity,similarSets,FORTE_DB};
})();

/* ═══ DISSONANCE RESOLUTION ═══ */
const DissonanceResolver=(()=>{const CS={0:1,1:.1,2:.3,3:.75,4:.8,5:.85,6:.05,7:1,8:.7,9:.75,10:.25,11:.15};const DI=new Set([1,2,6,10,11,13]);let st={isResolving:false,remainingSteps:0,tensionNotes:[],previousChord:[],dissonanceHistory:[],resolveCount:0};function cOf(a,b){return CS[Math.abs(a-b)%12]??0.5;}function cCon(ch){if(ch.length<2)return 1;let t=0,c=0;for(let i=0;i<ch.length;i++)for(let j=i+1;j<ch.length;j++){t+=cOf(ch[i],ch[j]);c++;}return t/c;}function dTN(ch){const ts=new Set();for(let i=0;i<ch.length;i++)for(let j=i+1;j<ch.length;j++){if(DI.has(Math.abs(ch[i]-ch[j])%12)){ts.add(ch[i]);ts.add(ch[j]);}}return[...ts];}function rTN(tn,pool,mI){let best=null,bs=-Infinity;for(const t of pool){const d=Math.abs(tn-t);const ed=Math.min(d,Math.abs(d-12));if(ed>mI)continue;const sc=cOf(tn,t)-ed*.1;if(sc>bs){bs=sc;best={note:t,distance:ed};}}return best;}function gR(prev,pool,mI){const ts=st.tensionNotes;if(!ts.length)return null;const res=[...prev];for(const tn of ts){const idx=res.indexOf(tn);if(idx===-1)continue;const r=rTN(tn,pool,mI);if(r){res[idx]=r.note;}else{const fb=[tn-1,tn+1].map(n=>({note:n,score:cCon([...res.filter((_,i)=>i!==idx),n])})).sort((a,b)=>b.score-a.score)[0];if(fb)res[idx]=fb.note;}}return res;}return{step(prev,coeff,pool,thr,steps,mI){if(st.isResolving&&st.remainingSteps>0){st.remainingSteps--;const r=gR(prev,pool||prev,mI||2);if(st.remainingSteps<=0){st.isResolving=false;st.tensionNotes=[];}return r;}if(coeff>=thr){const ts=dTN(prev);if(ts.length>0){st.isResolving=true;st.remainingSteps=steps;st.tensionNotes=ts;st.resolveCount++;}}return null;},update(ch,c){st.previousChord=[...ch];st.dissonanceHistory.push(c);if(st.dissonanceHistory.length>8)st.dissonanceHistory.shift();},getState(){return{isResolving:st.isResolving,remainingSteps:st.remainingSteps,resolveCount:st.resolveCount};},reset(){st={isResolving:false,remainingSteps:0,tensionNotes:[],previousChord:[],dissonanceHistory:[],resolveCount:0};}};})();

