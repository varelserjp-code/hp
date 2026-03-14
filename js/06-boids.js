/* ═══════════════════════════════════════════════════
   v18.0: SWARM INTELLIGENCE — BOIDS ENGINE
   Craig Reynolds (1986) — "Flocks, Herds and Schools"
   ─────────────────────────────────────────────────
   理論:
     各エージェント = レイヤー（Drone/Pad/Arp/Melody…）
     状態: pos(位置=音域中心 0-127), vel(速度=変化傾向 ±)
           dynPos(ダイナミクス位置 0-1)

   3ルール:
     Separation  近隣エージェントから離れる力 → 音域の住み分け
     Alignment   近隣エージェントの速度を合わせる → 動的同期
     Cohesion    群れ中心へ向かう → アンサンブル収束

   出力（per-layer）:
     registerOffset  : 音域オフセット（半音 ±N）
     velocityScale   : velocity倍率（0.5〜1.5）
     gateScale       : gate時間倍率（0.6〜1.4）
     octBiasShift    : octBias追加量（±1.5）

   API:
     BoidsEngine.create(layers, params)
     inst.run(bars)          → per-layer影響値配列
     inst.agentState()       → 可視化用状態
     inst.setState(params)   → パラメータ更新
═══════════════════════════════════════════════════ */
const BoidsEngine=(()=>{
'use strict';

/* ── レイヤー定義（音域の自然な住み分け初期位置） ── */
const LAYER_DEFAULTS={
  drone:   {pos:36, dyn:0.55, label:'Drone'},
  pad:     {pos:54, dyn:0.60, label:'Pad'},
  arp:     {pos:65, dyn:0.70, label:'Arp'},
  melody:  {pos:72, dyn:0.65, label:'Melody'},
  bass:    {pos:28, dyn:0.50, label:'Bass'},
  overtone:{pos:90, dyn:0.45, label:'Over'},
  texture: {pos:58, dyn:0.55, label:'Texture'},
  lead:    {pos:80, dyn:0.75, label:'Lead'},
  markov:  {pos:60, dyn:0.60, label:'Markov'},
};

/* ── デフォルトパラメータ ── */
const DEFAULT_PARAMS={
  sepWeight:0.60,  sepRadius:8,
  aliWeight:0.40,  aliRadius:12,
  cohWeight:0.25,  cohRadius:24,
  maxSpeed:5,
  inertia:0.70,
  steps:8,
  mode:'all',
  regDepth:0.50,
  velDepth:0.40,
  gateDepth:0.30,
};

function create(layerKeys, params){
  params={...DEFAULT_PARAMS,...(params||{})};
  const keys=layerKeys.filter(k=>LAYER_DEFAULTS[k]);

  /* エージェント状態 */
  const agents=keys.map(k=>{
    const d=LAYER_DEFAULTS[k];
    return{
      key:k,
      label:d.label,
      pos:d.pos+(rng()-0.5)*4,  // 初期位置に少しランダム
      vel:0,
      dynPos:d.dyn+(rng()-0.5)*0.1,
      dynVel:0,
    };
  });

  let P={...params};

  /* ────────────────────────────────
     1ステップのBoids更新
     posは音域(MIDI音高0-127範囲で表現)
     dynPosはダイナミクス(0-1)
  ──────────────────────────────── */
  function step(){
    const n=agents.length;
    if(n<2) return;

    for(let i=0;i<n;i++){
      const a=agents[i];
      let sepF=0, aliF=0, cohF=0;
      let sepFd=0, aliFd=0, cohFd=0;
      let nSep=0, nAli=0, nCoh=0;

      for(let j=0;j<n;j++){
        if(i===j) continue;
        const b=agents[j];
        const dist=Math.abs(a.pos-b.pos);
        const distD=Math.abs(a.dynPos-b.dynPos);

        /* Separation: 近すぎたら反発 */
        if(dist<P.sepRadius){
          const mag=(P.sepRadius-dist)/P.sepRadius;
          sepF+=(a.pos-b.pos>0?1:-1)*mag;
          sepFd+=(a.dynPos-b.dynPos>0?1:-1)*mag*0.5;
          nSep++;
        }
        /* Alignment: 一定半径内の速度を揃える */
        if(dist<P.aliRadius){
          aliF+=b.vel;
          aliFd+=b.dynVel;
          nAli++;
        }
        /* Cohesion: 群れ中心へ */
        if(dist<P.cohRadius){
          cohF+=b.pos;
          cohFd+=b.dynPos;
          nCoh++;
        }
      }

      /* 力の正規化と適用 */
      let force=0, forceDyn=0;
      if(nSep>0){force+=P.sepWeight*sepF/nSep; forceDyn+=P.sepWeight*sepFd/nSep;}
      if(nAli>0){force+=P.aliWeight*(aliF/nAli-a.vel); forceDyn+=P.aliWeight*(aliFd/nAli-a.dynVel);}
      if(nCoh>0){force+=P.cohWeight*(cohF/nCoh-a.pos)/P.cohRadius*2; forceDyn+=P.cohWeight*(cohFd/nCoh-a.dynPos)*2;}

      /* 速度更新（慣性あり） */
      a.vel=a.vel*P.inertia+force*(1-P.inertia);
      a.dynVel=a.dynVel*P.inertia+forceDyn*(1-P.inertia);

      /* 最大速度制限 */
      a.vel=Math.max(-P.maxSpeed,Math.min(P.maxSpeed,a.vel));
      a.dynVel=Math.max(-0.1,Math.min(0.1,a.dynVel));
    }

    /* 位置更新（境界反射） */
    for(const a of agents){
      a.pos+=a.vel;
      a.dynPos+=a.dynVel;
      /* 境界 */
      if(a.pos<12){a.pos=12;a.vel*=-0.5;}
      if(a.pos>110){a.pos=110;a.vel*=-0.5;}
      if(a.dynPos<0.1){a.dynPos=0.1;a.dynVel*=-0.5;}
      if(a.dynPos>0.95){a.dynPos=0.95;a.dynVel*=-0.5;}
    }
  }

  /* ────────────────────────────────
     シミュレーション実行 (bars×steps ステップ)
     結果: {key: {registerOffset, velocityScale, gateScale, octBiasShift, history}}
  ──────────────────────────────── */
  function run(bars){
    const totalSteps=bars*P.steps;

    /* 初期位置リセット（LAYER_DEFAULT基準） */
    for(const a of agents){
      const d=LAYER_DEFAULTS[a.key];
      a.pos=d.pos+(rng()-0.5)*4;
      a.vel=(rng()-0.5)*0.5;
      a.dynPos=d.dyn+(rng()-0.5)*0.05;
      a.dynVel=(rng()-0.5)*0.02;
    }

    /* 履歴: ステップごとの位置を記録 */
    const hist={};
    for(const a of agents) hist[a.key]={pos:[],dyn:[]};

    for(let s=0;s<totalSteps;s++){
      step();
      for(const a of agents){
        hist[a.key].pos.push(a.pos);
        hist[a.key].dyn.push(a.dynPos);
      }
    }

    /* 最終状態 → per-layer 影響値を計算 */
    const result={};
    for(const a of agents){
      const d=LAYER_DEFAULTS[a.key];
      const posDelta=a.pos-d.pos;           // デフォルトからのズレ（半音単位）
      const dynScale=a.dynPos/d.dyn;        // ダイナミクス比率

      /* Register offset: ±6半音を最大として音域をシフト */
      const regOff=(P.mode==='register'||P.mode==='all')
        ? Math.round(posDelta*P.regDepth*0.5)
        : 0;

      /* Velocity scale: dyn比率で0.5〜1.5 */
      const velScale=(P.mode==='velocity'||P.mode==='all')
        ? Math.max(0.5,Math.min(1.5, 1+(dynScale-1)*P.velDepth))
        : 1.0;

      /* Gate scale: dynとpos速度から */
      const gateScale=(P.mode==='gate'||P.mode==='all')
        ? Math.max(0.5,Math.min(1.5, 1+a.dynVel*10*P.gateDepth))
        : 1.0;

      /* OctBias shift: posデルタをoctBiasに変換（±1.5範囲） */
      const octBiasShift=(P.mode==='register'||P.mode==='all')
        ? Math.max(-1.5,Math.min(1.5, posDelta/24*P.regDepth))
        : 0;

      result[a.key]={
        registerOffset:regOff,
        velocityScale:velScale,
        gateScale:gateScale,
        octBiasShift:octBiasShift,
        finalPos:a.pos,
        finalDyn:a.dynPos,
        history:hist[a.key],
      };
    }
    return result;
  }

  function agentState(){return agents.map(a=>({...a}));}
  function setState(newP){P={...P,...newP};}
  function getParams(){return{...P};}

  return{run, agentState, setState, getParams, keys};
}

/* ── プリセット ──────────────────────────────────── */
const BOIDS_PRESETS=[
  {name:'Natural Flock',  params:{sepWeight:0.60,sepRadius:8, aliWeight:0.40,aliRadius:12,cohWeight:0.25,cohRadius:24,maxSpeed:5, inertia:0.70,regDepth:0.50,velDepth:0.40,gateDepth:0.30}},
  {name:'Tight School',   params:{sepWeight:0.30,sepRadius:4, aliWeight:0.70,aliRadius:8, cohWeight:0.60,cohRadius:16,maxSpeed:3, inertia:0.80,regDepth:0.30,velDepth:0.60,gateDepth:0.50}},
  {name:'Scattered',      params:{sepWeight:0.90,sepRadius:16,aliWeight:0.10,aliRadius:6, cohWeight:0.05,cohRadius:32,maxSpeed:8, inertia:0.50,regDepth:0.80,velDepth:0.20,gateDepth:0.15}},
  {name:'Murmuration',    params:{sepWeight:0.50,sepRadius:6, aliWeight:0.80,aliRadius:20,cohWeight:0.40,cohRadius:30,maxSpeed:7, inertia:0.60,regDepth:0.60,velDepth:0.70,gateDepth:0.60}},
  {name:'Orbit',          params:{sepWeight:0.40,sepRadius:10,aliWeight:0.60,aliRadius:15,cohWeight:0.80,cohRadius:40,maxSpeed:4, inertia:0.85,regDepth:0.40,velDepth:0.50,gateDepth:0.40}},
  {name:'Chaos',          params:{sepWeight:0.20,sepRadius:3, aliWeight:0.10,aliRadius:4, cohWeight:0.05,cohRadius:10,maxSpeed:12,inertia:0.20,regDepth:0.90,velDepth:0.80,gateDepth:0.70}},
  {name:'Echo Chamber',   params:{sepWeight:0.10,sepRadius:5, aliWeight:0.90,aliRadius:30,cohWeight:0.70,cohRadius:50,maxSpeed:2, inertia:0.90,regDepth:0.20,velDepth:0.90,gateDepth:0.80}},
  {name:'Lead & Follow',  params:{sepWeight:0.80,sepRadius:12,aliWeight:0.50,aliRadius:10,cohWeight:0.20,cohRadius:20,maxSpeed:6, inertia:0.65,regDepth:0.70,velDepth:0.50,gateDepth:0.35}},
];

return{create, LAYER_DEFAULTS, BOIDS_PRESETS, DEFAULT_PARAMS};
})();

/* ─── Boids UI 状態 ──────────────────────────────────────── */
const BOIDS_STATE={
  enabled:false,
  mode:'register',
  sepWeight:60, sepRadius:8,
  aliWeight:40, aliRadius:12,
  cohWeight:25, cohRadius:24,
  maxSpeed:5,
  inertia:70,
  steps:8,
  regDepth:50,
  velDepth:40,
  gateDepth:30,
  lastResult:null,   // 最後のrun()結果
  instance:null,     // BoidsEngine instance
};

/* ─── Boids UI コントローラー ─────────────────────────────── */
function boidsGetParams(){
  return{
    sepWeight:BOIDS_STATE.sepWeight/100,
    sepRadius:BOIDS_STATE.sepRadius,
    aliWeight:BOIDS_STATE.aliWeight/100,
    aliRadius:BOIDS_STATE.aliRadius,
    cohWeight:BOIDS_STATE.cohWeight/100,
    cohRadius:BOIDS_STATE.cohRadius,
    maxSpeed:BOIDS_STATE.maxSpeed,
    inertia:BOIDS_STATE.inertia/100,
    steps:BOIDS_STATE.steps,
    mode:BOIDS_STATE.mode,
    regDepth:BOIDS_STATE.regDepth/100,
    velDepth:BOIDS_STATE.velDepth/100,
    gateDepth:BOIDS_STATE.gateDepth/100,
  };
}

function boidsRun(activeLayers, bars){
  const params=boidsGetParams();
  const inst=BoidsEngine.create(activeLayers, params);
  BOIDS_STATE.instance=inst;
  const result=inst.run(bars||16);
  BOIDS_STATE.lastResult=result;
  boidsUpdateDisplay(result, inst, activeLayers);
  return result;
}

function boidsUpdateDisplay(result, inst, activeLayers){
  boidsUpdateAgentGrid(inst);
  boidsDrawViz(inst, activeLayers);
  boidsUpdateOutputGrid(result);
  boidsUpdateInfoBox(result, activeLayers);
}

function boidsUpdateAgentGrid(inst){
  const el=document.getElementById('boidsAgentGrid'); if(!el) return;
  const agents=inst?inst.agentState():[];
  el.innerHTML='';
  for(const a of agents){
    const d=BoidsEngine.LAYER_DEFAULTS[a.key];
    if(!d) continue;
    const div=document.createElement('div');
    div.className='boids-agent active';
    const posNorm=(a.pos-12)/(110-12);
    const dynPct=Math.round(a.dynPos*100);
    const velSign=a.vel>0.1?'↑':a.vel<-0.1?'↓':'→';
    div.innerHTML=`
      <div class="ag-name">${d.label}</div>
      <div class="ag-pos">${Math.round(a.pos)} <span style="font-size:8px;opacity:.5;">${velSign}</span></div>
      <div class="ag-vel">vel:${a.vel.toFixed(2)} dyn:${dynPct}%</div>
      <div class="ag-bar"><div class="ag-fill" style="width:${posNorm*100}%"></div></div>`;
    el.appendChild(div);
  }
}

function boidsDrawViz(inst, layerKeys){
  const cv=document.getElementById('boidsViz'); if(!cv) return;
  const dpr=window.devicePixelRatio||1;
  const W=cv.offsetWidth||400, H=200;
  cv.width=W*dpr; cv.height=H*dpr;
  cv.style.width=W+'px'; cv.style.height=H+'px';
  const cx=cv.getContext('2d'); cx.setTransform(dpr,0,0,dpr,0,0);
  cx.clearRect(0,0,W,H);

  if(!inst) return;

  /* グリッド */
  cx.strokeStyle='rgba(255,149,0,.06)'; cx.lineWidth=1;
  for(let i=1;i<8;i++){
    cx.beginPath(); cx.moveTo(W*i/8,0); cx.lineTo(W*i/8,H); cx.stroke();
    cx.beginPath(); cx.moveTo(0,H*i/8); cx.lineTo(W,H*i/8); cx.stroke();
  }

  /* 軸ラベル */
  cx.fillStyle='rgba(255,149,0,.3)';
  cx.font='7px Share Tech Mono,monospace'; cx.textAlign='center';
  cx.fillText('LOW ←──── REGISTER ────→ HIGH', W/2, H-4);
  cx.save(); cx.translate(8,H/2); cx.rotate(-Math.PI/2);
  cx.fillText('SOFT ←── DYNAMICS ──→ LOUD', 0, 0); cx.restore();

  const agents=inst.agentState();
  const LAYER_COLORS={
    drone:'#00e5ff',pad:'#8c3fff',arp:'#1de9b6',melody:'#ffcc00',
    bass:'#ff4081',overtone:'#00e676',texture:'#ff9500',lead:'#ff1744',markov:'#7fff00'
  };

  /* 軌跡と現在位置 */
  for(const a of agents){
    const col=LAYER_COLORS[a.key]||'#ffffff';
    const px=12+(a.pos-12)/(110-12)*(W-24);
    const py=H*0.9-a.dynPos*(H*0.75);

    /* ハロー */
    cx.shadowColor=col; cx.shadowBlur=12;
    cx.beginPath();
    cx.arc(px,py,6,0,Math.PI*2);
    cx.fillStyle=col+'cc';
    cx.fill();
    cx.shadowBlur=0;

    /* 速度矢印 */
    const vx=a.vel*2.5, vy=-a.dynVel*200;
    if(Math.abs(vx)>0.3||Math.abs(vy)>0.3){
      cx.strokeStyle=col+'88'; cx.lineWidth=1.5;
      cx.beginPath(); cx.moveTo(px,py);
      cx.lineTo(px+vx,py+vy); cx.stroke();
    }

    /* ラベル */
    cx.fillStyle=col+'aa';
    cx.font='7px Share Tech Mono,monospace'; cx.textAlign='center';
    cx.fillText(BoidsEngine.LAYER_DEFAULTS[a.key]?.label||a.key, px, py-10);
  }

  /* Separation radius 可視化 (最初のエージェント) */
  if(agents.length>0){
    const a=agents[0];
    const px=12+(a.pos-12)/(110-12)*(W-24);
    const py=H*0.9-a.dynPos*(H*0.75);
    const sepR=BOIDS_STATE.sepRadius/(110-12)*(W-24);
    cx.strokeStyle='rgba(255,149,0,.08)'; cx.lineWidth=1; cx.setLineDash([3,3]);
    cx.beginPath(); cx.arc(px,py,sepR,0,Math.PI*2); cx.stroke();
    cx.setLineDash([]);
  }
}

function boidsUpdateOutputGrid(result){
  const el=document.getElementById('boidsOutputGrid'); if(!el||!result) return;
  el.innerHTML='';
  for(const[key,v] of Object.entries(result)){
    const div=document.createElement('div');
    div.className='boids-out-card';
    const d=BoidsEngine.LAYER_DEFAULTS[key];
    div.innerHTML=`
      <div class="oc-label">${d?d.label:key}</div>
      <div class="oc-val">
        <span title="Register offset">±${v.registerOffset>0?'+':''}${v.registerOffset}st</span>
        <span style="margin-left:6px;font-size:8px;opacity:.6;">vel×${v.velocityScale.toFixed(2)}</span><br>
        <span style="font-size:8px;opacity:.5;">gate×${v.gateScale.toFixed(2)} bias${v.octBiasShift>0?'+':''}${v.octBiasShift.toFixed(2)}</span>
      </div>`;
    el.appendChild(div);
  }
}

function boidsUpdateInfoBox(result, activeLayers){
  const el=document.getElementById('boidsInfoBox'); if(!el) return;
  if(!result){el.innerHTML='Boids を有効にして GENERATE。'; return;}
  const lines=[];
  for(const[key,v] of Object.entries(result)){
    const d=BoidsEngine.LAYER_DEFAULTS[key];
    const label=d?d.label:key;
    const reg=v.registerOffset!==0?` reg${v.registerOffset>0?'+':''}${v.registerOffset}st`:'';
    const vel=Math.abs(v.velocityScale-1)>0.02?` vel×${v.velocityScale.toFixed(2)}`:'';
    const gate=Math.abs(v.gateScale-1)>0.02?` gate×${v.gateScale.toFixed(2)}`:'';
    if(reg||vel||gate)
      lines.push(`${label.padEnd(8)}→${reg}${vel}${gate}`);
  }
  const params=boidsGetParams();
  el.innerHTML='<pre style="margin:0;font-size:8px;line-height:1.6;">'
    +'Flock: Sep='+Math.round(params.sepWeight*100)+'% Ali='+Math.round(params.aliWeight*100)+'% Coh='+Math.round(params.cohWeight*100)+'%\n'
    +'Agents: '+activeLayers.length+' | Mode: '+params.mode.toUpperCase()+'\n'
    +(lines.length?lines.join('\n'):'— 変化なし（パラメータを調整してください）')
    +'</pre>';
}

function boidsBuildPresets(){
  const el=document.getElementById('boidsPresets'); if(!el) return;
  el.innerHTML='';
  BoidsEngine.BOIDS_PRESETS.forEach(preset=>{
    const btn=document.createElement('button');
    btn.className='boids-preset-btn';
    btn.textContent=preset.name;
    btn.addEventListener('click',()=>{
      const p=preset.params;
      BOIDS_STATE.sepWeight=Math.round(p.sepWeight*100);
      BOIDS_STATE.sepRadius=p.sepRadius;
      BOIDS_STATE.aliWeight=Math.round(p.aliWeight*100);
      BOIDS_STATE.aliRadius=p.aliRadius;
      BOIDS_STATE.cohWeight=Math.round(p.cohWeight*100);
      BOIDS_STATE.cohRadius=p.cohRadius;
      BOIDS_STATE.maxSpeed=p.maxSpeed;
      BOIDS_STATE.inertia=Math.round(p.inertia*100);
      BOIDS_STATE.regDepth=Math.round(p.regDepth*100);
      BOIDS_STATE.velDepth=Math.round(p.velDepth*100);
      BOIDS_STATE.gateDepth=Math.round(p.gateDepth*100);
      boidsSyncUI(); boidsPreviewRun();
    });
    el.appendChild(btn);
  });
}

function boidsSyncUI(){
  const ids={
    boidsSep:BOIDS_STATE.sepWeight,    boidsSepR:BOIDS_STATE.sepRadius,
    boidsAli:BOIDS_STATE.aliWeight,    boidsAliR:BOIDS_STATE.aliRadius,
    boidsCoh:BOIDS_STATE.cohWeight,    boidsCohR:BOIDS_STATE.cohRadius,
    boidsSteps:BOIDS_STATE.steps,      boidsMaxV:BOIDS_STATE.maxSpeed,
    boidsInertia:BOIDS_STATE.inertia,
    boidsRegDepth:BOIDS_STATE.regDepth, boidsVelDepth:BOIDS_STATE.velDepth, boidsGateDepth:BOIDS_STATE.gateDepth,
  };
  for(const[id,val] of Object.entries(ids)){
    const el=document.getElementById(id); if(el) el.value=val;
  }
  boidsUpdateLabels();
}

function boidsUpdateLabels(){
  const map={
    boidsSepV:BOIDS_STATE.sepWeight,
    boidsSepRV:BOIDS_STATE.sepRadius,
    boidsAliV:BOIDS_STATE.aliWeight,
    boidsAliRV:BOIDS_STATE.aliRadius,
    boidsCohV:BOIDS_STATE.cohWeight,
    boidsCohRV:BOIDS_STATE.cohRadius,
    boidsStepsV:BOIDS_STATE.steps,
    boidsMaxVV:BOIDS_STATE.maxSpeed,
    boidsInertiaV:BOIDS_STATE.inertia+'%',
    boidsRegDepthV:BOIDS_STATE.regDepth+'%',
    boidsVelDepthV:BOIDS_STATE.velDepth+'%',
    boidsGateDepthV:BOIDS_STATE.gateDepth+'%',
  };
  for(const[id,val] of Object.entries(map)){
    const el=document.getElementById(id); if(el) el.textContent=val;
  }
}

/* preview run: active layersで実行（generate前の可視化） */
function boidsPreviewRun(){
  const activeLayers=Object.entries(S.layers)
    .filter(([,v])=>v).map(([k])=>k)
    .filter(k=>BoidsEngine.LAYER_DEFAULTS[k]);
  if(!activeLayers.length) return;
  boidsRun(activeLayers, S.bars||16);
}



