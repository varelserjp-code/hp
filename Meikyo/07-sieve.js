/* ═══════════════════════════════════════════════════
   v17.0: XENAKIS SIEVE THEORY ENGINE
   整数論・モジュロ演算・集合論による音高/リズム生成
   ─────────────────────────────────────────────────
   理論: ヤニス・クセナキス "Formalized Music" (1963/1992)
         "La Légende d'Eer" · "Jonchaies" での実装例

   篩 (Sieve) の定義:
     残差類 (Residue Class) = { n | n ≡ r (mod m) }
     例: m=3, r=0 → {0, 3, 6, 9, 12, ...}

   論理演算子:
     OR  (∪) : どちらかの篩に属するなら発音
     AND (∩) : 両方の篩に属するなら発音
     NOT (∁) : 直前結果に属さないなら発音

   モード:
     SCALE  : 0〜Range の整数空間で篩を計算 → ピッチクラスに変換
     RHYTHM : 0〜Period の整数空間で篩を計算 → リズムパターンに変換
     BOTH   : 両方同時に適用

   公開API:
     SieveEngine.compute(sieves, range)
       → Set<number> — 篩が通した整数集合
     SieveEngine.toScale(result, range)
       → number[] — 半音インターバル配列 (mod 12 ユニーク)
     SieveEngine.toRhythm(result, period, rotation)
       → number[] — 0/1 パターン配列
     SieveEngine.periodicity(result)
       → number — 最小周期
     SieveEngine.expression(sieves)
       → string — 数式表現 "3₀∪4₁∩NOT5₂"
═══════════════════════════════════════════════════ */
const SieveEngine=(()=>{
'use strict';

/**
 * 篩の配列から整数集合を計算
 * @param {Array<{m:number, r:number, op:'OR'|'AND'|'NOT'}>} sieves
 *   m = modulus (篩の周期), r = residue (残差), op = 論理演算
 * @param {number} range  整数空間の上限 [0, range)
 * @returns {Set<number>}
 */
function compute(sieves, range){
  if(!sieves||!sieves.length) return new Set();
  range=Math.max(2, Math.min(256, range|0));

  // 全整数空間
  const universe=new Set();
  for(let i=0;i<range;i++) universe.add(i);

  let result=null; // null = 未初期化（最初の篩はそのままセット）

  for(const sv of sieves){
    const m=Math.max(1, sv.m|0);
    const r=((sv.r|0)%m+m)%m;
    // この篩が通す整数集合
    const sieveSet=new Set();
    for(let i=r;i<range;i+=m) sieveSet.add(i);

    if(result===null){
      // 最初の篩 — 演算子に関わらずそのままセット
      result=new Set(sieveSet);
    } else {
      const op=sv.op||'OR';
      const next=new Set();
      if(op==='OR'){
        // 結合 (∪)
        for(const x of result) next.add(x);
        for(const x of sieveSet) next.add(x);
      } else if(op==='AND'){
        // 交差 (∩)
        for(const x of result) if(sieveSet.has(x)) next.add(x);
      } else if(op==='NOT'){
        // 差集合 (∖) — resultからsieveSetを除く
        for(const x of result) if(!sieveSet.has(x)) next.add(x);
      }
      result=next;
    }
  }
  return result||new Set();
}

/**
 * 整数集合をピッチスケール（半音インターバル列）に変換
 * @param {Set<number>} resultSet
 * @param {number}      range
 * @returns {number[]}  ユニークなpitch-class(mod12)の昇順インターバル配列
 */
function toScale(resultSet, range){
  // mod 12 でユニーク化
  const pcs=new Set();
  for(const n of resultSet) pcs.add(n%12);
  if(!pcs.size) return [0];
  const sorted=[...pcs].sort((a,b)=>a-b);
  // インターバル列に変換（最初は0から）
  const root=sorted[0];
  return sorted.map(pc=>(pc-root+12)%12);
}

/**
 * 整数集合をリズムパターン（0/1配列）に変換
 * @param {Set<number>} resultSet
 * @param {number}      period    パターン長
 * @param {number}      rotation  回転量
 * @returns {number[]}  0または1の配列
 */
function toRhythm(resultSet, period, rotation){
  period=Math.max(2, Math.min(128, period|0));
  const pat=[];
  for(let i=0;i<period;i++){
    pat.push(resultSet.has(i%period)?1:0);
  }
  // 回転
  const rot=((rotation|0)%period+period)%period;
  if(rot===0) return pat;
  return [...pat.slice(rot), ...pat.slice(0,rot)];
}

/**
 * 整数集合の最小周期を計算
 * @param {Set<number>} resultSet
 * @returns {number}
 */
function periodicity(resultSet){
  if(!resultSet.size) return 1;
  const arr=[...resultSet].sort((a,b)=>a-b);
  const max=arr[arr.length-1];
  // 差分列のGCDで近似
  const diffs=[];
  for(let i=1;i<arr.length;i++) diffs.push(arr[i]-arr[i-1]);
  if(!diffs.length) return 1;
  function gcd(a,b){return b===0?a:gcd(b,a%b);}
  return diffs.reduce(gcd);
}

/**
 * 篩配列を数式文字列に変換
 * 例: "3₀ ∪ 4₁ ∩ ∁5₂"
 */
function expression(sieves){
  if(!sieves||!sieves.length) return '';
  const SUB='₀₁₂₃₄₅₆₇₈₉';
  function sub(n){return String(n).split('').map(d=>SUB[+d]).join('');}
  return sieves.map((sv,i)=>{
    const m=Math.max(1,sv.m|0), r=((sv.r|0)%m+m)%m;
    const base=m+sub(r);
    if(i===0) return base;
    const op={OR:'∪',AND:'∩',NOT:'∁'}[sv.op||'OR'];
    return op+(sv.op==='NOT'?'('+base+')':base);
  }).join(' ');
}

/**
 * 密度とエントロピー統計
 */
function stats(resultSet, range){
  const size=resultSet.size;
  const density=size/Math.max(1,range);
  // Shannon entropy of inter-onset intervals
  const arr=[...resultSet].sort((a,b)=>a-b);
  const iois={};
  for(let i=1;i<arr.length;i++){
    const d=arr[i]-arr[i-1];
    iois[d]=(iois[d]||0)+1;
  }
  let entropy=0;
  const total=arr.length-1||1;
  for(const d of Object.values(iois)){
    const p=d/total;
    if(p>0) entropy-=p*Math.log2(p);
  }
  return{size, density, entropy: entropy.toFixed(2)};
}

return{compute, toScale, toRhythm, periodicity, expression, stats};
})();

/* ─── Sieve UI 状態 ──────────────────────────────────────── */
const SIEVE_STATE={
  enabled:false,
  mode:'scale',       // 'scale' | 'rhythm' | 'both'
  range:24,           // scale用の整数空間
  offset:0,           // 音高オフセット
  period:24,          // rhythm用の整数空間
  rhythmRot:0,        // リズム回転量
  sieves:[            // 初期: 典型的なクセナキス風の篩
    {m:3, r:0, op:'OR'},
    {m:4, r:1, op:'OR'},
    {m:5, r:2, op:'NOT'},
  ],
  result:null,        // 計算済み Set
  scaleIv:null,       // 生成されたスケール interval array
  rhythmPat:null,     // 生成されたリズムパターン
};

/* ─── Sieve プリセット (クセナキス作品から) ───────────────── */
const SIEVE_PRESETS=[
  {name:'Jonchaies',   sieves:[{m:2,r:0,op:'OR'},{m:3,r:1,op:'OR'},{m:5,r:2,op:'NOT'}], mode:'scale', range:24},
  {name:'Nomos Alpha', sieves:[{m:3,r:0,op:'OR'},{m:4,r:0,op:'OR'},{m:7,r:0,op:'NOT'},{m:11,r:0,op:'AND'}], mode:'scale', range:36},
  {name:'Eonta',       sieves:[{m:5,r:1,op:'OR'},{m:5,r:3,op:'OR'},{m:8,r:0,op:'NOT'}], mode:'scale', range:24},
  {name:'Achorripsis', sieves:[{m:7,r:0,op:'OR'},{m:11,r:3,op:'OR'},{m:13,r:5,op:'NOT'}], mode:'rhythm', period:77},
  {name:'Polytope',    sieves:[{m:3,r:0,op:'OR'},{m:5,r:0,op:'OR'},{m:7,r:0,op:'OR'},{m:2,r:1,op:'NOT'}], mode:'both', range:24, period:30},
  {name:'Pléiades',    sieves:[{m:4,r:1,op:'OR'},{m:6,r:3,op:'OR'},{m:9,r:0,op:'AND'}], mode:'scale', range:24},
  {name:'Prime Sieve', sieves:[{m:2,r:1,op:'OR'},{m:3,r:2,op:'OR'},{m:5,r:4,op:'OR'},{m:7,r:6,op:'OR'}], mode:'both', range:36, period:24},
  {name:'Xenakis #1',  sieves:[{m:3,r:0,op:'OR'},{m:4,r:2,op:'OR'},{m:5,r:1,op:'OR'},{m:6,r:3,op:'NOT'}], mode:'scale', range:24},
];

/* ─── Sieve UI 描画関数 ──────────────────────────────────── */
function sieveRecompute(){
  const ss=SIEVE_STATE;
  if(!ss.sieves.length){
    ss.result=new Set(); ss.scaleIv=null; ss.rhythmPat=null;
    sieveUpdateDisplay(); return;
  }
  // SCALE
  if(ss.mode==='scale'||ss.mode==='both'){
    const scResult=SieveEngine.compute(ss.sieves, ss.range);
    const rawIv=SieveEngine.toScale(scResult, ss.range);
    // offset: 篩結果のピッチクラスを回転させて新しいルートから再計算
    if(ss.offset && rawIv.length>1){
      const pcs=new Set();
      for(const n of scResult) pcs.add(n%12);
      const sorted=[...pcs].sort((a,b)=>a-b);
      const root=ss.offset%12;
      ss.scaleIv=sorted.map(pc=>((pc-root)%12+12)%12).sort((a,b)=>a-b);
      if(ss.scaleIv[0]!==0) ss.scaleIv.unshift(0);
      // 重複除去
      ss.scaleIv=[...new Set(ss.scaleIv)].sort((a,b)=>a-b);
    } else { ss.scaleIv=rawIv; }
    ss.result=scResult; // 密度表示用
  } else { ss.scaleIv=null; }
  // RHYTHM
  if(ss.mode==='rhythm'||ss.mode==='both'){
    const rResult=SieveEngine.compute(ss.sieves, ss.period);
    ss.rhythmPat=SieveEngine.toRhythm(rResult, ss.period, ss.rhythmRot);
    if(ss.mode==='rhythm') ss.result=rResult; // rhythmのみの場合はrResultを使う
  } else { ss.rhythmPat=null; }
  if(!ss.result) ss.result=new Set();
  sieveUpdateDisplay();
}

function sieveUpdateDisplay(){
  const ss=SIEVE_STATE;
  const rb=document.getElementById('svResultBar');
  const db=document.getElementById('svDensityBar');
  const ib=document.getElementById('svInfoBox');
  if(!rb) return;

  const expr=SieveEngine.expression(ss.sieves);
  const range=ss.mode==='rhythm'?ss.period:ss.range;
  const st=SieveEngine.stats(ss.result||new Set(), range);

  rb.textContent=expr||'—';
  db.textContent='Density: '+st.size+'/'+range+
    ' ('+(st.density*100).toFixed(1)+'%)'+
    ' | IOI Entropy: '+st.entropy+' bits'+
    (ss.scaleIv?' | Scale: ['+ss.scaleIv.join(',')+']':'');

  // infobox
  const scInfo=ss.scaleIv?'Generated Scale: ['+ss.scaleIv.join(', ')+']\n':'' ;
  const rhInfo=ss.rhythmPat?
    'Rhythm: '+ss.rhythmPat.map(p=>p?'●':'○').join('')+'\n':'';
  const period=ss.rhythmPat?'\nPeriod ≈ '+SieveEngine.periodicity(ss.result||new Set()):'' ;
  ib.innerHTML='<pre style="margin:0;white-space:pre-wrap;">'+
    'Sieve: '+expr+'\n'+
    scInfo+rhInfo+
    'Set size: '+st.size+' / Density: '+(st.density*100).toFixed(1)+'%\n'+
    'IOI Shannon Entropy: '+st.entropy+' bits'+period+
    '</pre>';

  // Canvas
  sieveDrawScale();
  sieveDrawRhythm();
}

function sieveDrawScale(){
  const cv=document.getElementById('svScaleCv'); if(!cv)return;
  const dpr=window.devicePixelRatio||1;
  const W=cv.offsetWidth||300, H=120;
  cv.width=W*dpr; cv.height=H*dpr;
  cv.style.width=W+'px'; cv.style.height=H+'px';
  const cx=cv.getContext('2d'); cx.setTransform(dpr,0,0,dpr,0,0);
  cx.clearRect(0,0,W,H);

  const ss=SIEVE_STATE;
  const range=ss.range;
  const result=ss.mode==='rhythm'?new Set():SieveEngine.compute(ss.sieves,range);
  const cellW=W/range, cellH=H*0.55, cy=H*0.22;

  // Draw grid
  for(let i=0;i<range;i++){
    const x=i*cellW;
    const inSieve=result.has(i);
    const pc=i%12;
    const isBlack=[1,3,6,8,10].includes(pc);
    cx.fillStyle=inSieve
      ? (isBlack?'rgba(127,255,0,.9)':'rgba(200,255,100,.95)')
      : (isBlack?'rgba(255,255,255,.03)':'rgba(255,255,255,.08)');
    cx.fillRect(x+0.5, cy, cellW-1, cellH*(isBlack?.65:1));
    if(inSieve){
      // glow
      cx.shadowColor='#7fff00'; cx.shadowBlur=8;
      cx.fillRect(x+0.5, cy, cellW-1, cellH*(isBlack?.65:1));
      cx.shadowBlur=0;
    }
  }
  // octave dividers
  for(let i=0;i<=range;i+=12){
    cx.strokeStyle='rgba(127,255,0,.3)'; cx.lineWidth=1;
    cx.beginPath(); cx.moveTo(i*cellW, cy-4); cx.lineTo(i*cellW, cy+cellH+4); cx.stroke();
    cx.fillStyle='rgba(127,255,0,.4)';
    cx.font='7px Share Tech Mono,monospace'; cx.textAlign='center';
    cx.fillText('Oct'+(i/12), i*cellW+cellW*5.5, cy+cellH+12);
  }
  // labels
  if(ss.scaleIv&&ss.scaleIv.length){
    cx.fillStyle='rgba(127,255,0,.6)';
    cx.font='8px Share Tech Mono,monospace'; cx.textAlign='center';
    cx.fillText('Scale: ['+ss.scaleIv.join(',')+']', W/2, H-4);
  } else if(ss.mode==='rhythm'){
    cx.fillStyle='rgba(127,255,0,.3)';
    cx.font='8px Share Tech Mono,monospace'; cx.textAlign='center';
    cx.fillText('RHYTHM MODE — Scale disabled', W/2, H/2+4);
  }
}

function sieveDrawRhythm(){
  const cv=document.getElementById('svRhythmCv'); if(!cv)return;
  const dpr=window.devicePixelRatio||1;
  const W=cv.offsetWidth||300, H=120;
  cv.width=W*dpr; cv.height=H*dpr;
  cv.style.width=W+'px'; cv.style.height=H+'px';
  const cx=cv.getContext('2d'); cx.setTransform(dpr,0,0,dpr,0,0);
  cx.clearRect(0,0,W,H);

  const ss=SIEVE_STATE;
  if(ss.mode==='scale'){
    cx.fillStyle='rgba(127,255,0,.3)';
    cx.font='8px Share Tech Mono,monospace'; cx.textAlign='center';
    cx.fillText('SCALE MODE — Rhythm disabled', W/2, H/2+4);
    return;
  }
  const pat=ss.rhythmPat||[];
  const n=pat.length; if(!n) return;
  const cols=Math.min(n, 32);
  const rows=Math.ceil(n/cols);
  const cw=(W-4)/cols, ch=(H-8)/rows;
  const pulses=pat.filter(p=>p===1).length;

  for(let i=0;i<n;i++){
    const col=i%cols, row=Math.floor(i/cols);
    const x=2+col*cw, y=4+row*ch;
    const on=pat[i]===1;
    cx.fillStyle=on?'rgba(127,255,0,.85)':'rgba(255,255,255,.04)';
    cx.fillRect(x+0.5, y+0.5, cw-1.5, ch-1.5);
    if(on){ cx.shadowColor='#7fff00'; cx.shadowBlur=6;
      cx.fillRect(x+0.5, y+0.5, cw-1.5, ch-1.5); cx.shadowBlur=0; }
  }
  // info
  cx.fillStyle='rgba(127,255,0,.5)';
  cx.font='7px Share Tech Mono,monospace'; cx.textAlign='right';
  cx.fillText('E('+pulses+','+n+')', W-4, H-2);
}

/* ─── Sieve UI コントローラー ────────────────────────────── */
function sieveBuildRowHTML(sv, idx){
  const ops=['OR','AND','NOT'];
  const opColors={OR:'and',AND:'and',NOT:'not'};
  const opClass={OR:'or',AND:'and',NOT:'not'};
  return `<div class="sv-row" id="svRow${idx}">
    <div>
      <label>MODULO (m)</label>
      <input class="sv-input" id="svM${idx}" type="number" min="1" max="99" value="${Math.max(1,sv.m|0)}" style="width:60px;">
    </div>
    <div>
      <label>RESIDUE (r)</label>
      <input class="sv-input" id="svR${idx}" type="number" min="0" max="98" value="${sv.r|0}" style="width:60px;">
    </div>
    <div>
      <label>OPERATOR</label>
      <div class="sv-op-group">
        ${idx===0?'<span style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:rgba(127,255,0,.4);padding:4px 6px;">INITIAL</span>':
          ops.map(op=>`<button class="sv-op ${opClass[op]} ${sv.op===op?'on':''}" data-idx="${idx}" data-op="${op}">${op}</button>`).join('')}
      </div>
    </div>
    <div>
      <label>PREVIEW</label>
      <div id="svPrev${idx}" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(127,255,0,.6);letter-spacing:1px;">—</div>
    </div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(127,255,0,.3);">
      { n ≡ ${(sv.r|0)%Math.max(1,sv.m|0)} (mod ${Math.max(1,sv.m|0)}) }
    </div>
    <button class="sv-del" data-idx="${idx}">✕</button>
  </div>`;
}

function sieveUpdateRowPreview(idx){
  const el=document.getElementById('svPrev'+idx); if(!el)return;
  const ss=SIEVE_STATE.sieves[idx]; if(!ss)return;
  const m=Math.max(1,ss.m|0), r=((ss.r|0)%m+m)%m;
  const vals=[]; for(let i=r;i<Math.min(r+m*5,50);i+=m) vals.push(i);
  el.textContent=vals.slice(0,5).join(',')+',…';
  // update formula span
  const row=document.getElementById('svRow'+idx); if(!row)return;
  const spans=row.querySelectorAll('div>div:not(.sv-op-group)');
  // update the formula text in the 5th cell
  const formulaCells=[...row.children];
  if(formulaCells[4]){
    formulaCells[4].textContent='{ n ≡ '+r+' (mod '+m+') }';
    formulaCells[4].style.cssText='font-family:\'Share Tech Mono\',monospace;font-size:8px;color:rgba(127,255,0,.3);';
  }
}

function sieveBuildUI(){
  const container=document.getElementById('svSieves'); if(!container)return;
  container.innerHTML=SIEVE_STATE.sieves.map((sv,i)=>sieveBuildRowHTML(sv,i)).join('');

  // bind inputs
  SIEVE_STATE.sieves.forEach((sv,i)=>{
    const mEl=document.getElementById('svM'+i);
    const rEl=document.getElementById('svR'+i);
    if(mEl) mEl.addEventListener('input',()=>{
      sv.m=Math.max(1,parseInt(mEl.value)||1);
      sieveUpdateRowPreview(i); sieveRecompute();
    });
    if(rEl) rEl.addEventListener('input',()=>{
      sv.r=Math.max(0,parseInt(rEl.value)||0);
      sieveUpdateRowPreview(i); sieveRecompute();
    });
    sieveUpdateRowPreview(i);
  });

  // bind op buttons
  container.querySelectorAll('.sv-op').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const idx=+btn.dataset.idx, op=btn.dataset.op;
      SIEVE_STATE.sieves[idx].op=op;
      // toggle active class
      const row=document.getElementById('svRow'+idx);
      if(row) row.querySelectorAll('.sv-op').forEach(b=>{
        b.classList.remove('on');
        if(b.dataset.op===op) b.classList.add('on');
      });
      sieveRecompute();
    });
  });

  // bind delete buttons
  container.querySelectorAll('.sv-del').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const idx=+btn.dataset.idx;
      SIEVE_STATE.sieves.splice(idx,1);
      sieveBuildUI(); sieveRecompute();
    });
  });
}

function sieveBuildPresets(){
  const el=document.getElementById('svPresets'); if(!el)return;
  el.innerHTML='';
  SIEVE_PRESETS.forEach(preset=>{
    const btn=document.createElement('button');
    btn.className='sv-preset-btn';
    btn.textContent=preset.name;
    btn.title=SieveEngine.expression(preset.sieves);
    btn.addEventListener('click',()=>{
      SIEVE_STATE.sieves=preset.sieves.map(s=>({...s}));
      if(preset.mode) SIEVE_STATE.mode=preset.mode;
      if(preset.range) SIEVE_STATE.range=preset.range;
      if(preset.period) SIEVE_STATE.period=preset.period;
      // sync mode buttons
      document.querySelectorAll('.sv-mode-btn').forEach(b=>{
        b.classList.toggle('on',b.dataset.mode===SIEVE_STATE.mode);
      });
      // sync range/period sliders
      const rangeEl=document.getElementById('svRange');
      const periodEl=document.getElementById('svPeriod');
      if(rangeEl){rangeEl.value=SIEVE_STATE.range;document.getElementById('svRangeV').textContent=SIEVE_STATE.range;}
      if(periodEl){periodEl.value=SIEVE_STATE.period;document.getElementById('svPeriodV').textContent=SIEVE_STATE.period;}
      sieveBuildUI(); sieveRecompute();
    });
    el.appendChild(btn);
  });
}


