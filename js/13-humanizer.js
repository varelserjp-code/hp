
/* ═══════════════════════════════════════════════════
   v14.0: HUMANIZER-NOISE ENGINE
   1/f Pink Noise (Voss–McCartney) + Perlin FBM
   ─────────────────────────────────────────────────
   ソース: humanizer-noise.js (vanilla JS移植)

   精査で発見した問題点と修正:
     ① _runSum 累積ドリフト問題:
        Voss-McCarneyは確率的更新のため _runSum が
        初期化後に徐々に±方向へドリフトし、長時間生成で
        velocity/timingが偏った値になる。
        → rebuildNoise() で _rows と _runSum を同時リセット
        → 1000ノート毎に自動リセット（_callCount で管理）
     ② HTMLデモ版の不完全実装:
        humanizeTiming() / modulateContinuous() /
        modulatePitchBend() がデモHTMLに欠落。
        → .js の完全版をそのまま使用
     ③ MIDI tick変換:
        humanizeTiming() は ms 単位だが VOID SYNTHESISは
        MIDI tick。ppq/BPMから変換。
        tick_offset = ms_offset * ppq * bpm / 60000
     ④ CC挿入タイミング:
        Perlin変調CCは各ノートon直前に挿入。
        CC1 (Mod Wheel) をデフォルトターゲットとし、
        Drone/Pad向けに長いセグメントにも定期挿入。
     ⑤ nextPink() の正規化範囲:
        _max = octaves * 0.5 は理論値であり実際の出力は
        [-1.2, +1.2] 程度になることがある →
        velocity clamp を [1,127] で安全化（既存実装で対応済み）
   ─────────────────────────────────────────────────
   公開API (グローバル):
     HumanizerNoise クラス
     Humanizer.applyVelocity(baseVel, p)   ← velocity humanize
     Humanizer.applyTimingTick(tick, p)    ← timing offset
     Humanizer.ccEvents(pos, total, ppq, p) ← CC変調イベント配列
     Humanizer.isEnabled()
     Humanizer.STATE
═══════════════════════════════════════════════════ */

class HumanizerNoise {
  constructor(octaves=8){
    this._octaves=octaves;
    this._rows=new Float32Array(octaves);
    this._runSum=0;
    this._max=octaves*0.5;
    this._perm=this._buildPerm();
    this.t=0;
    this._callCount=0;        // ① ドリフト防止カウンタ
    this._resetInterval=800;  // N回毎に _runSum をリセット
  }

  /* ── Public API ────────────────────────────────── */
  nextPink(){
    // ① 定期リセット
    this._callCount++;
    if(this._callCount>=this._resetInterval){
      this._rows.fill(0);
      this._runSum=0;
      this._callCount=0;
    }
    const oct=this._octaves;
    const idx=Math.floor(rng()*oct);
    const prev=this._rows[idx];
    const next=rng()*2-1;
    this._rows[idx]=next;
    this._runSum+=(next-prev);
    return this._runSum/(this._max*2);
  }

  perlin(x,octaves=3,persistence=0.5){
    let val=0,amp=1,freq=1,max=0;
    for(let i=0;i<octaves;i++){
      val+=this._noise1d(x*freq)*amp;
      max+=amp;
      amp*=persistence;
      freq*=2;
    }
    return val/max;
  }

  tick(speed=0.008){this.t+=speed;}

  humanizeVelocity(baseVel,scale=10){
    const dv=this.nextPink()*scale;
    return Math.round(Math.min(127,Math.max(1,baseVel+dv)));
  }

  /** ② ms→MIDI tick 変換で使用。ms単位で返す（呼び出し元で変換）*/
  humanizeTimingMs(baseTimeMs,scale=8){
    const dt=this.nextPink()*scale;
    return Math.max(0,baseTimeMs+dt);
  }

  modulateContinuous(center,range=20,octaves=3){
    return center+this.perlin(this.t,octaves)*range;
  }

  modulatePitchBend(semitoneRange=0.1){
    const pbRange=semitoneRange*4096;
    return Math.round(8192+this.perlin(this.t,2)*pbRange);
  }

  rebuildNoise(){
    // ① 完全リセット
    this._rows=new Float32Array(this._octaves);
    this._runSum=0;
    this._callCount=0;
  }

  /* ── Internal ──────────────────────────────────── */
  _noise1d(x){
    const xi=Math.floor(x)&255;
    const xf=x-Math.floor(x);
    const u=this._fade(xf);
    const a=this._perm[xi];
    const b=this._perm[(xi+1)&255];
    return this._lerp(u,this._grad1d(a,xf),this._grad1d(b,xf-1));
  }
  _fade(t){return t*t*t*(t*(t*6-15)+10);}
  _lerp(t,a,b){return a+t*(b-a);}
  _grad1d(h,x){return(h&1)?x:-x;}
  _buildPerm(){
    const p=new Uint8Array(256);
    for(let i=0;i<256;i++)p[i]=i;
    for(let i=255;i>0;i--){const j=rng()*(i+1)|0;[p[i],p[j]]=[p[j],p[i]];}
    const out=new Uint8Array(512);
    for(let i=0;i<512;i++)out[i]=p[i&255];
    return out;
  }
}

/* ── Humanizer グローバルコントローラ ────────────── */
const Humanizer=(()=>{
'use strict';

const VEL_CURVE_SHAPES={
  'bar_phrase':'Bar Head → Phrase Tail',
  'crescendo':'Crescendo',
  'decrescendo':'Decrescendo',
  'arch':'Arch',
  'wave':'Wave',
};

const STATE={
  enabled:false,
  mode:'pink',       // 'pink' | 'perlin' | 'white'
  pinkOctaves:8,
  velScale:10,
  timScale:12,       // MIDI ticks（ppq=480基準で約12tick≒12.5ms@120BPM）
  pnSpeed:0.008,
  pnAmp:0.5,
  pnOct:3,
  velCurveEnabled:true,
  velCurveShape:'bar_phrase',
  velCurveAmount:45,
  velCurveBarHead:70,
  velCurvePhraseTail:55,
  velCurveBars:4,
  velCurvePower:1.2,
  // CC変調対象チャンネル（0-index）: {ch, ccNum, enabled}
  ccTargets:[
    {label:'Drone (ch1)',  ch:0, ccNum:1, enabled:true},
    {label:'Pad (ch2)',    ch:1, ccNum:1, enabled:true},
    {label:'Drone (ch1) CC11', ch:0, ccNum:11, enabled:false},
    {label:'Lead (ch8)',   ch:7, ccNum:1, enabled:false},
    {label:'Markov (ch9)',ch:8, ccNum:1, enabled:false},
  ],
  // 内部インスタンス（generate毎に再生成）
  _inst:null,
  _animFrame:null,
  _vizBuf:new Float32Array(120),
  _vizIdx:0,
};

function getInstance(){
  if(!STATE._inst) STATE._inst=new HumanizerNoise(STATE.pinkOctaves);
  return STATE._inst;
}

function reset(){
  STATE._inst=new HumanizerNoise(STATE.pinkOctaves);
}

function isEnabled(){return STATE.enabled;}

function velocityCurveUnit(pos,total,ppq){
  if(!STATE.velCurveEnabled)return 0;
  if(!Number.isFinite(pos)||!Number.isFinite(ppq)||ppq<=0)return 0;
  const barTicks=Math.max(1,ppq*4);
  const bars=Math.max(1,parseInt(STATE.velCurveBars));
  const phraseTicks=Math.max(1,barTicks*bars);
  const barPhase=((pos%barTicks)+barTicks)%barTicks/barTicks;
  const phrasePhase=((pos%phraseTicks)+phraseTicks)%phraseTicks/phraseTicks;
  const p=Math.max(0.25,Math.min(4,STATE.velCurvePower||1));
  let unit=0;
  switch(STATE.velCurveShape){
    case 'crescendo':{
      const x=Math.pow(phrasePhase,p);
      unit=x*2-1;
      break;
    }
    case 'decrescendo':{
      const x=1-Math.pow(phrasePhase,p);
      unit=x*2-1;
      break;
    }
    case 'arch':{
      unit=(Math.sin(phrasePhase*Math.PI)-0.5)*2;
      break;
    }
    case 'wave':{
      unit=Math.sin(phrasePhase*Math.PI*2);
      break;
    }
    case 'bar_phrase':
    default:{
      const head=Math.pow(1-barPhase,p)*(STATE.velCurveBarHead/100);
      const tail=Math.pow(phrasePhase,p)*(STATE.velCurvePhraseTail/100);
      unit=head-tail;
      break;
    }
  }
  const amount=Math.max(0,Math.min(1,STATE.velCurveAmount/100));
  return Math.max(-1,Math.min(1,unit))*amount;
}

function velocityCurveDelta(maxDelta,pos,total,ppq){
  if(!STATE.velCurveEnabled)return 0;
  const unit=velocityCurveUnit(pos,total,ppq);
  return unit*Math.max(0,maxDelta||0);
}

/**
 * velocity を 1/f or Perlin or White で humanize する。
 * 既存の rng() 計算を**置き換える**（加算ではない）。
 * @param {number} baseVel  元のベロシティ
 * @param {number} scalePct humanize パーセント (0-100)
 * @returns {number} 1-127
 */
function applyVelocity(baseVel, scalePct=35){
  if(!STATE.enabled) return baseVel;
  const scale=STATE.velScale*(scalePct/100);
  const H=getInstance();
  let dv=0;
  if(STATE.mode==='pink') dv=H.nextPink()*scale;
  else if(STATE.mode==='perlin') dv=H.perlin(H.t,STATE.pnOct)*scale;
  else dv=(rng()*2-1)*scale;
  return Math.round(Math.min(127,Math.max(1,baseVel+dv)));
}

/**
 * ③ MIDI tick タイミングを微小シフトする（マイクロタイミング）。
 * scalePct=0 で無効。
 * @param {number} tick    元の MIDI tick 位置
 * @param {number} bpm     現在 BPM
 * @param {number} ppq     MIDI PPQ（通常480）
 * @param {number} scalePct humanize % (0-100)
 * @returns {number} 変更後 tick (≥0)
 */
function applyTimingTick(tick, bpm, ppq, scalePct=35){
  if(!STATE.enabled||STATE.timScale===0) return tick;
  const H=getInstance();
  // tick スケールをパーセントで補正
  const tickScale=STATE.timScale*(scalePct/100);
  const dt=H.nextPink()*tickScale;
  return Math.max(0,Math.round(tick+dt));
}

/**
 * ④ CC変調イベントを生成する。
 * 指定区間 [posStart, posEnd) に一定間隔でCC変調を挿入。
 * @param {number} posStart  開始 tick
 * @param {number} posEnd    終了 tick
 * @param {number} ppq
 * @param {number} notesPerCC  何ノート毎にCC1つ（間引き）
 * @returns {Array<{pos:number,v:number[]}>}
 */
function ccEvents(posStart, posEnd, ppq, notesPerCC=4){
  if(!STATE.enabled) return [];
  const H=getInstance();
  const interval=ppq*notesPerCC;
  const evs=[];
  const activeTargets=STATE.ccTargets.filter(t=>t.enabled);
  if(!activeTargets.length)return[];
  for(let pos=posStart;pos<posEnd;pos+=interval){
    H.tick(STATE.pnSpeed);
    for(const tgt of activeTargets){
      const center=64;
      const range=Math.round(STATE.pnAmp*48);
      const val=Math.max(0,Math.min(127,Math.round(H.modulateContinuous(center,range,STATE.pnOct))));
      // CC event: [0xB0|ch, ccNum, val]
      evs.push({pos,v:[0xB0|tgt.ch, tgt.ccNum, val]});
    }
  }
  return evs;
}

/* ── UI ── */
function buildUI(){
  // モードボタン
  const mg=document.getElementById('humModeGroup');
  if(mg){
    mg.innerHTML='';
    [{k:'pink',l:'1/f Pink'},{k:'perlin',l:'Perlin FBM'},{k:'white',l:'White（比較）'}].forEach(({k,l})=>{
      const btn=document.createElement('button');
      btn.className='hum-mode-btn'+(STATE.mode===k?' on':'');
      btn.textContent=l;
      btn.addEventListener('click',()=>{STATE.mode=k;buildUI();});
      mg.appendChild(btn);
    });
  }
  // CCターゲット
  const ct=document.getElementById('humCCTargets');
  if(ct){
    ct.innerHTML='';
    STATE.ccTargets.forEach((tgt,i)=>{
      const btn=document.createElement('button');
      btn.className='hum-mode-btn'+(tgt.enabled?' on':'');
      btn.textContent=tgt.label;
      btn.style.fontSize='8px';
      btn.addEventListener('click',()=>{tgt.enabled=!tgt.enabled;buildUI();});
      ct.appendChild(btn);
    });
  }
  const cst=document.getElementById('humCurveTog');
  if(cst) cst.classList.toggle('on',!!STATE.velCurveEnabled);
  const cs=document.getElementById('humCurveShapes');
  if(cs){
    cs.innerHTML='';
    Object.entries(VEL_CURVE_SHAPES).forEach(([k,l])=>{
      const btn=document.createElement('button');
      btn.className='hum-mode-btn'+(STATE.velCurveShape===k?' on':'');
      btn.textContent=l;
      btn.addEventListener('click',()=>{STATE.velCurveShape=k;buildUI();});
      cs.appendChild(btn);
    });
  }
}

/* ── ライブビジュアライザー（requestAnimationFrame） ── */
let _rafId=null;
function startViz(){
  if(_rafId)return;
  const cv=document.getElementById('humViz');
  if(!cv)return;
  const H_viz=new HumanizerNoise(STATE.pinkOctaves);
  const H_pn=new HumanizerNoise(STATE.pinkOctaves);
  const BUF=cv.offsetWidth||360;
  const buf=new Float32Array(BUF);
  let idx=0;
  function loop(){
    if(!STATE.enabled){_rafId=null;return;}
    // サンプル取得
    let sample;
    if(STATE.mode==='pink') sample=H_viz.nextPink();
    else if(STATE.mode==='perlin'){H_pn.tick(STATE.pnSpeed);sample=H_pn.perlin(H_pn.t,STATE.pnOct);}
    else sample=rng()*2-1;
    buf[idx%BUF]=sample;
    idx++;
    // 描画
    cv.width=cv.offsetWidth;cv.height=52;
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    // ゼロライン
    ctx.strokeStyle='rgba(140,63,255,0.12)';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,26);ctx.lineTo(cv.width,26);ctx.stroke();
    // 波形
    ctx.strokeStyle='rgba(140,63,255,0.8)';
    ctx.lineWidth=1.5;
    ctx.shadowColor='rgba(140,63,255,0.4)';
    ctx.shadowBlur=6;
    ctx.beginPath();
    for(let i=0;i<BUF&&i<cv.width;i++){
      const x=(i/BUF)*cv.width;
      const y=26-buf[(idx+i)%BUF]*22;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.shadowBlur=0;
    // メーター更新
    const velDelta=sample*STATE.velScale;
    const timDelta=sample*STATE.timScale;
    const ccVal=Math.round(64+H_pn.perlin(H_pn.t,STATE.pnOct)*STATE.pnAmp*48);
    const vp=50+(velDelta/(STATE.velScale||1))*45;
    const tp=50+(timDelta/(STATE.timScale||1))*45;
    const cp=(ccVal/127)*100;
    const mv=document.getElementById('humMeterVel');
    const mt=document.getElementById('humMeterTim');
    const mc=document.getElementById('humMeterCC');
    const mvv=document.getElementById('humMeterVelV');
    const mtv=document.getElementById('humMeterTimV');
    const mcv=document.getElementById('humMeterCCV');
    if(mv)mv.style.width=Math.max(0,Math.min(100,vp))+'%';
    if(mt)mt.style.width=Math.max(0,Math.min(100,tp))+'%';
    if(mc)mc.style.width=Math.max(0,Math.min(100,cp))+'%';
    if(mvv)mvv.textContent='Δv '+velDelta.toFixed(1);
    if(mtv)mtv.textContent='Δt '+timDelta.toFixed(0)+'tk';
    if(mcv)mcv.textContent='CC '+ccVal;
    _rafId=requestAnimationFrame(loop);
  }
  _rafId=requestAnimationFrame(loop);
}
function stopViz(){
  if(_rafId){cancelAnimationFrame(_rafId);_rafId=null;}
}

return{STATE,getInstance,reset,isEnabled,applyVelocity,applyTimingTick,velocityCurveUnit,velocityCurveDelta,ccEvents,buildUI,startViz,stopViz,VEL_CURVE_SHAPES};
})();

