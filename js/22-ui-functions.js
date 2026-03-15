function updateEucDisplay(){const pat=euclideanPattern(S.eucPulses,S.eucSteps,S.eucRotation);document.getElementById('eucPatternDisplay').textContent='E('+S.eucPulses+','+S.eucSteps+') rot'+S.eucRotation+'  [ '+pat.map(p=>p?'\u25cf':'\u25cb').join(' ')+' ]';drawEucViz(pat);}
function buildEucPresets(){const el=document.getElementById('eucPresets');el.innerHTML='';for(const pr of EUC_PRESETS){const btn=document.createElement('button');btn.className='ep-btn'+((S.eucPulses===pr.k&&S.eucSteps===pr.n&&S.eucRotation===pr.r)?' on':'');btn.textContent=pr.name;btn.title='E('+pr.k+','+pr.n+') \u2014 '+pr.desc;btn.addEventListener('click',()=>{S.eucPulses=pr.k;S.eucSteps=pr.n;S.eucRotation=pr.r;document.getElementById('eucPulses').value=pr.k;document.getElementById('eucPulses').max=pr.n;document.getElementById('eucPulsesV').textContent=pr.k;document.getElementById('eucSteps').value=pr.n;document.getElementById('eucStepsV').textContent=pr.n;document.getElementById('eucRotation').value=pr.r;document.getElementById('eucRotation').max=pr.n-1;document.getElementById('eucRotationV').textContent=pr.r;buildEucPresets();updateEucDisplay();});el.appendChild(btn);}}

/* ═══ UI FUNCS ═══ */
function drawPR(chN,scN){const cv=document.getElementById('piano-roll'),cx=cv.getContext('2d');cv.width=cv.offsetWidth;cv.height=90;cx.clearRect(0,0,cv.width,cv.height);const nw=cv.width/12,chS=new Set(chN.map(n=>((n%12)+12)%12)),scS=new Set(scN.map(n=>((n%12)+12)%12));for(let n=0;n<12;n++){const x=n*nw;cx.fillStyle=[1,3,6,8,10].includes(n)?'#070d18':'#080e1c';cx.fillRect(x,0,nw-1,cv.height);if(scS.has(n)){cx.fillStyle='rgba(140,63,255,0.22)';cx.fillRect(x,0,nw-1,cv.height);}if(chS.has(n)){cx.fillStyle='rgba(0,229,255,0.55)';cx.fillRect(x,0,nw-1,cv.height);cx.fillStyle='#00e5ff';cx.font='8px Share Tech Mono,monospace';cx.textAlign='center';cx.fillText(NN[n],x+nw/2,cv.height-6);}cx.strokeStyle='rgba(12,32,48,0.9)';cx.strokeRect(x,0,nw-1,cv.height);}}
function buildOctDisplay(){const el=document.getElementById('octDisplay');el.innerHTML='';for(let o=0;o<=8;o++){const p=document.createElement('div');p.className='oct-pill'+(S.octLayers.includes(o)?' on':'');if(o===S.rootOct)p.classList.add('root-oct');p.textContent='C'+o;p.addEventListener('click',()=>{if(S.octLayers.includes(o)){if(S.octLayers.length>1)S.octLayers=S.octLayers.filter(x=>x!==o);}else{S.octLayers.push(o);S.octLayers.sort((a,b)=>a-b);}buildOctDisplay();buildLayerOctaves();updateTheory();});el.appendChild(p);}}
function buildLayerOctaves(){const el=document.getElementById('layerOctaves'),ln=['Drone','Pad','Arp','Mel','Bass','Over','Tex','Lead','Markov'],lk=['drone','pad','arp','melody','bass','overtone','texture','lead','markov'];el.innerHTML='';const sorted=[...S.octLayers].sort((a,b)=>a-b);lk.forEach((k,i)=>{const d=document.createElement('div');d.style.cssText='background:var(--s2);border:1px solid var(--border);border-radius:2px;padding:8px 10px;';const on=S.layers[k];d.innerHTML=`<div style="font-family:Share Tech Mono,monospace;font-size:8px;letter-spacing:2px;color:${on?'var(--cyan-dim)':'var(--text-dim)'};">${ln[i]}</div><div style="font-family:Share Tech Mono,monospace;font-size:9px;color:${on?'var(--text)':'var(--text-dim)'};margin-top:4px;letter-spacing:1px;">${k==='markov'?'Oct '+MarkovEngine.STATE.octave:sorted.map(o=>'C'+o).join(' ')}</div>`;el.appendChild(d);});}
function updateTheory(){const c=S.chord;if(!c){['tRoot','tChord','tChordSub','tTones','tIntvs','tScale','tScaleDesc','tChar','tTension'].forEach(id=>document.getElementById(id).textContent='\u2014');drawPR([],[]);if(typeof drawPCSimMap==='function')drawPCSimMap(null);return;}document.getElementById('tRoot').textContent=c.rootName;document.getElementById('tChord').textContent=c.name;const cN=chordNotes(c.root,c.iv);document.getElementById('tTones').textContent=c.iv.map(i=>nn(c.root+i)).join('  ');document.getElementById('tIntvs').textContent=c.iv.map(i=>INAMES[i]||i).join(' \u00b7 ');document.getElementById('tChordSub').textContent=c.quality?' ('+c.quality+')':'';const sD=ALL_SCALES[S.scale],sI=sD?sD.iv:[0,2,3,5,7,9,10],sN=scaleNotes(c.root,sI);document.getElementById('tScale').textContent=sN.map(n=>NN[n]).join('  ');document.getElementById('tScaleDesc').textContent=sD?sD.desc:'';document.getElementById('tChar').textContent=sD?sD.char:'';document.getElementById('tTension').textContent=sN.filter(n=>!cN.includes(n)).map(n=>NN[n]).join('  ')||'\u2014';drawPR(cN,sN);if(typeof drawPCSimMap==='function')drawPCSimMap(c);}
const CAT_MAP={'modal':'Modal / Diatonic','harmonic':'Harmonic / Altered','symmetric':'Symmetric / Exotic','world':'World / Non-Western','spectral':'Spectral / Micro'};
function buildScaleUI(){const wr=document.getElementById('scaleWrap');wr.innerHTML='';const cn=CAT_MAP[S.scaleCat]||'Modal / Diatonic',cs=SCALES[cn]||{},rec=GENRE_SCALES[S.genre]||[],keys=Object.keys(cs),sorted=[...keys.filter(k=>rec.includes(k)),...keys.filter(k=>!rec.includes(k))];if(S.scale&&!sorted.includes(S.scale)){const info=document.createElement('div');info.style.cssText='font-family:Share Tech Mono,monospace;font-size:8px;color:var(--amber);letter-spacing:2px;margin-bottom:8px;';let scn='';for(const[ck,cd] of Object.entries(CAT_MAP))if(SCALES[cd]&&SCALES[cd][S.scale]){scn=cd;break;}info.textContent='\u25b8 ACTIVE: '+S.scale+(scn?' ['+scn.split(' /')[0]+']':'');wr.appendChild(info);}for(const s of sorted){const btn=document.createElement('button'),isR=rec.includes(s);btn.className='s-btn'+(s===S.scale?' on':'')+(isR?' rec':'');const al=SCALE_ALIASES[s];btn.textContent=s+(al?' \u2261':'')+(MICRO_CENTS[s]?' \u25c8':'');btn.title=(cs[s]?cs[s].desc:'')+(al?' | \u2261 '+al:'');if(isR){const dot=document.createElement('div');dot.className='rec-dot';btn.appendChild(dot);}btn.addEventListener('click',()=>{S.scale=s;buildScaleUI();updateTheory();});wr.appendChild(btn);}}
const GENRES=[{id:'ambient',name:'Ambient',sub:'SUSTAINED \u00b7 MODAL \u00b7 SLOW'},{id:'drone',name:'Drone',sub:'CONTINUOUS \u00b7 STATIC \u00b7 PURE'},{id:'dark_ambient',name:'Dark Ambient',sub:'DISSONANT \u00b7 PHRYGIAN \u00b7 TENSE'},{id:'psychedelic',name:'Psychedelic',sub:'EXOTIC \u00b7 BITONAL \u00b7 COMPLEX'},{id:'space',name:'Space Music',sub:'LYDIAN \u00b7 FLOATING \u00b7 SPARSE'},{id:'ritual',name:'Ritual',sub:'PENTATONIC \u00b7 PULSE \u00b7 HYPNOTIC'},{id:'kosmische',name:'Kosmische',sub:'KRAUTROCK \u00b7 SEQUENCER \u00b7 MOTORIC'},{id:'noise',name:'Noise / Industrial',sub:'CHROMATIC \u00b7 CLUSTER \u00b7 HARSH'}];
function buildGenreUI(){const el=document.getElementById('genreGrid');el.innerHTML='';for(const g of GENRES){const btn=document.createElement('button');btn.className='g-btn'+(S.genre===g.id?' on':'');btn.innerHTML=`<div class="g-name">${g.name}</div><div class="g-sub">${g.sub}</div>`;btn.addEventListener('click',()=>{S.genre=g.id;buildGenreUI();const rec=GENRE_SCALES[S.genre]||[];if(rec.length)for(const[ck,cn] of Object.entries(CAT_MAP))if(SCALES[cn]&&SCALES[cn][rec[0]]){S.scaleCat=ck;S.scale=rec[0];document.querySelectorAll('.t-tab').forEach(t=>t.classList.toggle('on',t.dataset.cat===ck));break;}buildScaleUI();updateTheory();updateGateIndicator();log('// GENRE \u2192 '+S.genre.toUpperCase());});el.appendChild(btn);}}
const BASIC_CHORDS=['C','Am','F','G','Dm','Em','Cmaj7','Am7','Fmaj7','G7','Dm9','Em7b5','Asus4','Bsus2','Dsus4'];
const EXT_CHORDS=['Cm11','Fmaj13','Abm7b5','Dbmaj9','Ebdim7','F#m9','Bb7b9','E7#11','Gmaj#11','DbaugM7','Aquartal','Cquintal','Dtone','Bcluster','Cadd9','F#mM7','C\u03947','D\u00f87'];
function buildChips(){const bc=document.getElementById('basicChips'),ec=document.getElementById('extChips');BASIC_CHORDS.forEach(c=>{const b=document.createElement('button');b.className='chip';b.textContent=c;b.addEventListener('click',()=>{document.getElementById('chordInput').value=c;document.getElementById('chordInput').dispatchEvent(new Event('input'));});bc.appendChild(b);});EXT_CHORDS.forEach(c=>{const b=document.createElement('button');b.className='chip ext';b.textContent=c;b.addEventListener('click',()=>{document.getElementById('chordInput').value=c;document.getElementById('chordInput').dispatchEvent(new Event('input'));});ec.appendChild(b);});}
const LAYER_DEFS=[{k:'drone',name:'Drone',desc:'ROOT + 5TH \u00b7 SUSTAINED TONE'},{k:'pad',name:'Pad',desc:'CHORD VOICING \u00b7 ATMOSPHERIC'},{k:'arp',name:'Arpeggio',desc:'SCALE PATTERN \u00b7 GENERATIVE'},{k:'melody',name:'Melody',desc:'MODAL MELODY \u00b7 SPARSE PHRASE'},{k:'bass',name:'Bass',desc:'SUB BASS \u00b7 ROOT MOVEMENT'},{k:'overtone',name:'Overtone',desc:'HARMONIC SERIES \u00b7 SPECTRAL'},{k:'texture',name:'Texture',desc:'RANDOM SPARSE \u00b7 AMBIENT NOISE'},{k:'lead',name:'Lead',desc:'HIGH REGISTER \u00b7 MODAL LEAD'},{k:'markov',name:'Markov',desc:'STOCHASTIC CHAIN \u00b7 CH8 TRACK'}];
function buildLayerToggles(){const el=document.getElementById('layerToggles');el.innerHTML='';for(const l of LAYER_DEFS){const row=document.createElement('div');row.className='tog-row';row.dataset.layerKey=l.k;row.dataset.layerName=l.name;const tog=document.createElement('div');tog.className='tog'+(S.layers[l.k]?' on':'');tog.addEventListener('click',()=>{S.layers[l.k]=!S.layers[l.k];tog.classList.toggle('on',S.layers[l.k]);buildLayerOctaves();updateGateIndicator();refreshGenerateButtonMicrotonalState();});row.innerHTML=`<div class="tog-info"><div class="tog-name">${l.name}</div><div class="tog-desc">${l.desc}</div></div>`;row.appendChild(tog);el.appendChild(row);}}
function buildTheoryTabs(){document.querySelectorAll('.t-tab').forEach(t=>{t.addEventListener('click',()=>{document.querySelectorAll('.t-tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');S.scaleCat=t.dataset.cat;buildScaleUI();});});}
function refreshBpmDisplay(){const el=document.getElementById('bpmV');el.textContent=(S.macroEnabled&&S.tempoModEnabled)?Math.max(15,S.bpm-S.tempoDrift)+'\u2013'+Math.min(200,S.bpm+S.tempoDrift)+' BPM':S.bpm+' BPM';}
function updateGateIndicator(){const el=document.getElementById('gateIndicator');if(!el)return;const gr=GATE_RATIOS[S.genre]||GATE_RATIOS.ambient,al=LAYER_DEFS.filter(l=>S.layers[l.k]).map(l=>l.k);if(!al.length){el.textContent='NO LAYERS';el.style.color='var(--text-dim)';return;}const avg=al.reduce((a,k)=>a+(gr[k]||.85),0)/al.length,eff=avg*S.gateBase;let d,c;if(eff<.5){d='STACCATO';c='var(--red)';}else if(eff<.75){d='DETACHED';c='var(--amber)';}else if(eff<.95){d='NEUTRAL';c='var(--green)';}else if(eff<1.1){d='LEGATO';c='var(--teal)';}else{d='OVERLAP';c='var(--cyan)';}el.textContent=d+' (eff: '+eff.toFixed(2)+')';el.style.color=c;}
function updateResolveIndicator(){const el=document.getElementById('resolveIndicator');if(el)el.textContent='THR: '+S.resolveThreshold.toFixed(2)+' | STEPS: '+S.resolveSteps;}
function bindSliders(){[{id:'bpm',key:'bpm',vid:'bpmV',fmt:v=>(S.macroEnabled&&S.tempoModEnabled)?Math.max(15,v-S.tempoDrift)+'\u2013'+Math.min(200,v+S.tempoDrift)+' BPM':v+' BPM'},{id:'bars',key:'bars',vid:'barsV',fmt:v=>v+' bars'},{id:'density',key:'density',vid:'densityV',fmt:v=>v+'%'},{id:'velocity',key:'velocity',vid:'velocityV',fmt:v=>''+v},{id:'humanize',key:'humanize',vid:'humanizeV',fmt:v=>v+'%'},{id:'drift',key:'drift',vid:'driftV',fmt:v=>v+'%'},{id:'dissonance',key:'dissonance',vid:'dissonanceV',fmt:v=>v+'%'},{id:'polyrhythm',key:'polyrhythm',vid:'polyrhythmV',fmt:v=>v+'%'},{id:'rootOct',key:'rootOct',vid:'rootOctVal',fmt:v=>'C'+v},{id:'octSpread',key:'octSpread',vid:'octSpreadVal',fmt:v=>v===0?'Root only':'\u00b1'+v+' oct'},{id:'octBias',key:'octBias',vid:'octBiasVal',fmt:v=>v<0?'Low '+(v*-1):v>0?'High '+v:'Center'}].forEach(({id,key,vid,fmt})=>{const el=document.getElementById(id);if(!el)return;el.addEventListener('input',()=>{const v=parseInt(el.value);S[key]=v;document.getElementById(vid).textContent=fmt(v);if(key==='rootOct'||key==='octSpread'){S.octLayers=[];for(let i=-S.octSpread;i<=S.octSpread;i++){const o=S.rootOct+i;if(o>=0&&o<=8)S.octLayers.push(o);}buildOctDisplay();buildLayerOctaves();updateTheory();}if(key==='bars'){updateMacroPreview();refreshBpmDisplay();}if(key==='dissonance')updateGateIndicator();});});}
function buildCurveGrid(){const el=document.getElementById('curveGrid');if(!el)return;el.innerHTML='';for(const n of Object.keys(CURVE_SHAPES)){const btn=document.createElement('button');btn.className='c-btn'+(S.curveShape===n?' on':'');btn.textContent=n;btn.addEventListener('click',()=>{S.curveShape=n;buildCurveGrid();document.getElementById('chainAName').textContent=n;updateMacroPreview();});el.appendChild(btn);}}
function buildChainSelect(){const sel=document.getElementById('chainBSelect');if(!sel)return;sel.innerHTML='';for(const n of Object.keys(CURVE_SHAPES)){const opt=document.createElement('option');opt.value=n;opt.textContent=n;if(n===S.curveShapeB)opt.selected=true;sel.appendChild(opt);}sel.addEventListener('change',()=>{S.curveShapeB=sel.value;updateMacroPreview();});}
function updateMacroPreview(){if(!S.macroEnabled)return;const cv=generateTensionCurve(S.curveShape,S.bars,S.curveAmp,S.chainEnabled,S.curveShapeB),sc=detectSections(cv);drawTensionCurve(cv,sc);const si=document.getElementById('sectionInfo');if(si)si.textContent=sc.map(s=>s.name+'@bar'+(s.bar+1)).join(' \u2192 ');}

/* ═══ GENERATE ═══ */

/**
 * 1コード・指定バー数のレイヤートラック群を生成して返す
 * (コード進行モード・単一コードモード共用の内部関数)
 *
 * @param {Object} c          S.chord 相当の {root,rootName,quality,iv,name}
 * @param {number} barCount   このコードが占めるバー数
 * @param {number} barOffset  曲全体での開始バー (テンションカーブ位置計算用)
 * @param {Object} shared     doGenerate() 冒頭で計算した共有リソース群
 * @returns {{ tracks: Uint8Array[], trackNames: string[] }}
 */
function generateForChord(c, barCount, barOffset, shared){
  const PATCH = window.__MEIKY_PATCH__ || {};

  /* ── [v25.7 統合] JI PBマップをバーオフセットごとに再構築するヘルパー ── */
  const buildSharedForBar = (currentBarOffset) => {
    let nextShared = shared;
    if (c && c.iv &&
        typeof JI_PARAMS !== 'undefined' && JI_PARAMS && JI_PARAMS.enabled &&
        typeof JustIntonation !== 'undefined') {
      const safePbRange = typeof S !== 'undefined' && S && Number.isFinite(S.pbRange) && S.pbRange > 0 ? S.pbRange : 2;
      const jiParamsForBar = typeof PATCH.getJiParamsForBar === 'function'
        ? PATCH.getJiParamsForBar(currentBarOffset) : JI_PARAMS;
      nextShared = Object.assign({}, shared, {
        jiPBMap: typeof PATCH.buildAdaptiveJiPitchBendMap === 'function'
          ? PATCH.buildAdaptiveJiPitchBendMap(c, safePbRange, currentBarOffset)
          : JustIntonation.getPitchBendMap(
              c.iv.map(interval => (((c.root % 12) + 12 + interval) % 12 + 12) % 12),
              ((c.root % 12) + 12) % 12,
              jiParamsForBar,
              safePbRange
            ),
      });
    }
    return nextShared;
  };

  /* ── [v25.7 統合] CompTuning セクション分割: 複数セグメントの場合は分割再帰→merge ── */
  const _segments = typeof PATCH.getCompSectionSegments === 'function'
    ? PATCH.getCompSectionSegments(barOffset, barCount)
    : [{ barOffset: barOffset, bars: barCount }];
  if (Array.isArray(_segments) && _segments.length > 1) {
    const segmentResults = _segments.map(segment => {
      const nextShared = buildSharedForBar(segment.barOffset);
      const result = generateForChord(c, segment.bars, segment.barOffset, nextShared);
      result.tracks = PATCH.applyCompTuningToTrackSlice(result.tracks, result.trackNames, c, segment.barOffset);
      return { tracks: result.tracks, trackNames: result.trackNames, bars: segment.bars };
    });
    if (typeof S !== 'undefined' && S) S.compSectionPreTuned = true;
    return {
      tracks: typeof mergeProgTracks === 'function'
        ? mergeProgTracks(segmentResults, (shared && shared.ppq) || 480)
        : segmentResults[0].tracks,
      trackNames: segmentResults[0].trackNames,
    };
  }
  /* 単一セグメント: JI PBマップを現在のbarOffsetで再構築 */
  shared = buildSharedForBar(barOffset);

  const{ppq,scIv,prg,tensionCurve,eucPattern,sievePattern,sieveScale,boidsResult,
        lorenz,attractor,attractorMap,ca,rubatoDelta,ttForms,isInst,isState,velShape,velShapeMode,velShapeAmt,
        scaleMutExpanded,scaleMutTransMode,scaleMutTransLen,
        vlVoicing, jiPBMap, rcTracks}=shared;  /* v25.4: VL / v25.5: JI / v25.6: RC */

  /* テンションカーブのバーオフセットスライス */
  const slicedTension=tensionCurve?tensionCurve.slice(barOffset,barOffset+barCount):null;

  /* Vel Shape — コード進行時にベロシティ包絡を適用する係数を p に渡す */
  const progVelShape=velShape?(phase=>ProgEngine.velShape(1.0,phase,velShapeMode,velShapeAmt)):null;

  /* Scale Mutation: バー単位でスケール iv を解決するヘルパー関数
   * tick = このコードスライス内の相対ティック (0 = コード開始)
   * 全体バー番号 = barOffset + Math.floor(tick / (ppq*4)) で求める
   */
  let scaleIvAtTick=null;
  if(scaleMutExpanded&&scaleMutExpanded.length){
    scaleIvAtTick=(tick)=>{
      const globalBar=barOffset+Math.floor(tick/(ppq*4));
      const entry=ScaleMutEngine.scaleAtBar(scaleMutExpanded,globalBar);
      if(!entry)return scIv;
      /* transLen > 0 のとき境界付近でブレンド */
      if(scaleMutTransLen>0&&entry.phase<scaleMutTransLen/Math.max(1,entry.barCount)){
        const expandedIdx=scaleMutExpanded.findIndex(e=>e.barStart===entry.barStart);
        const prev=scaleMutExpanded[expandedIdx-1];
        if(prev){
          const t=entry.phase*(entry.barCount/Math.max(1,scaleMutTransLen));
          return ScaleMutEngine.interpolateIv(prev.iv,c.root%12,entry.iv,c.root%12,Math.min(1,t),scaleMutTransMode);
        }
      }
      return entry.iv;
    };
  }

  /* scIv 確定: Scale Mutation が有効な場合はバー0 の iv を初期値に使用 */
  const effectiveScIv=scaleIvAtTick?scaleIvAtTick(0):scIv;

  const chordPCs=c.iv.map(i=>((c.root+i)%12));
  const scalePCs=effectiveScIv.map(i=>((c.root+i)%12));
  const compositePCs=[...new Set([...chordPCs,...scalePCs.slice(0,4)])];
  const pcAnalysis=S.engines.pcset?PCSetEngine.analyze(compositePCs):null;
  const chordAnalysis=S.engines.pcset?PCSetEngine.analyze(chordPCs):null;
  const spectralAnalysis=S.engines.spectral?SpectralEngine.analyze(c.root%12,c.iv,{harmonics:SPECTRAL_PARAMS.harmonics,timbre:SPECTRAL_PARAMS.timbre,rolloff:SPECTRAL_PARAMS.rolloff,threshold:SPECTRAL_PARAMS.threshold}):null;

  const rootMidi=(S.rootOct*12)+c.root;
  const p={ppq,bars:barCount,genre:S.genre,octLayers:S.octLayers.length?S.octLayers:[S.rootOct],octBias:S.octBias,density:S.density,velocity:S.velocity,humanize:S.humanize,drift:S.drift,dissonance:S.dissonance,polyrhythm:S.polyrhythm,tensionCurve:slicedTension,gateBase:S.gateBase,gateHumanize:S.gateHumanize,eucPattern,resolveThreshold:S.engines.resolution?S.resolveThreshold:1.01,resolveSteps:S.resolveSteps,lorenz,attractor,attractorMap,ca,rubatoDelta,ttForms,pcAnalysis,chordAnalysis,rootPc:c.root%12,isInst,isState,sievePattern,sieveScale,boidsResult,spectralAnalysis,progVelShape,scaleIvAtTick,
    vlVoicing: vlVoicing || null,  /* v25.4: voice-lead 事前計算ボイシング */
    jiPBMap:   jiPBMap   || null,  /* v25.5: JI PitchBend マップ */
    rcTracks:  rcTracks  || null}; /* v25.6: Rhythmic Canons ゲートパターン */

  const tracks=[],tn=[];
  if(S.layers.drone){tracks.push(makeDrone(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Drone');}
  if(S.layers.pad){tracks.push(makePad(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Pad');}
  if(S.layers.arp){tracks.push(makeArp(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Arp');}
  if(S.layers.melody){tracks.push(makeMelody(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Melody');}
  if(S.layers.bass){tracks.push(makeBass(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Bass');}
  if(S.layers.overtone){tracks.push(makeOvertone(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Overtone');}
  if(S.layers.texture){tracks.push(makeTexture(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Texture');}
  if(S.layers.lead){tracks.push(makeLead(rootMidi,c.iv,effectiveScIv,p,prg));tn.push('Lead');}
  if(S.layers.markov&&S.engines.markov){
    MarkovEngine.STATE.matrix=MarkovEngine.STATE.matrix||MarkovEngine.buildMatrix(MarkovEngine.SCALE_PRESETS[MarkovEngine.STATE.scaleKey].notes,MarkovEngine.STATE.bias,MarkovEngine.STATE.tension);
    const mkTrk=MarkovEngine.makeMarkovTrack(rootMidi,effectiveScIv,p,prg);
    if(mkTrk&&mkTrk.length){tracks.push(mkTrk);tn.push('Markov');}
  }
  if(S.engines.lsystem&&LSEngine.STATE.enabled&&LSEngine.STATE.lstring){
    const lsTrk=LSEngine.makeLSTrack(rootMidi,effectiveScIv,p,prg);
    if(lsTrk&&lsTrk.length){tracks.push(lsTrk);tn.push('L-System');}
  }
  /* [v25.7 統合] 単一セグメントでCompTuningセクションが有効な場合、トラックスライスに適用 */
  if (typeof PATCH.isCompSectionRuntimeActive === 'function' && PATCH.isCompSectionRuntimeActive()) {
    if (typeof S !== 'undefined' && S) S.compSectionPreTuned = true;
    const _tuned = PATCH.applyCompTuningToTrackSlice(tracks, tn, c, barOffset);
    if (Array.isArray(_tuned)) { tracks.length = 0; _tuned.forEach(t => tracks.push(t)); }
  }
  return{tracks,trackNames:tn};
}

/**
 * 複数のトラックバイト列を PPQ×4×bars ティック分だけオフセットして連結する
 * MIDI フォーマット1: トラック数は固定 (最初のスライスのトラック数に合わせる)
 * @param {Uint8Array[][]} slices  [{tracks,bars}, ...]
 * @param {number} ppq
 * @returns {Uint8Array[]}  結合済みトラック配列 (tracks[0] が先頭スライス ch1 …)
 */
function mergeProgTracks(slices, ppq){
  function _vlqBytes(n){
    n=Math.max(0,n|0);
    const out=[n&0x7F];
    n>>=7;
    while(n>0){out.unshift((n&0x7F)|0x80);n>>=7;}
    return out;
  }
  function _parseTrackForMerge(trackData){
    const headers=[];
    const events=[];
    let p=0,tick=0,rs=0;
    const len=trackData.length;
    const readVlq=()=>{
      let v=0;
      while(p<len){
        const b=trackData[p++];
        v=(v<<7)|(b&0x7F);
        if(!(b&0x80))break;
      }
      return v;
    };
    while(p<len){
      const d=readVlq();
      tick+=d;
      if(p>=len)break;
      const fb=trackData[p];
      if(fb===0xFF){
        p++;
        if(p>=len)break;
        const mt=trackData[p++];
        const l=readVlq();
        const data=Array.from(trackData.slice(p,p+l));
        p+=l;
        if(mt===0x2F)break;
        if(tick===0)headers.push({d:0,v:[0xFF,mt,..._vlqBytes(l),...data]});
        continue;
      }
      if(fb===0xF0||fb===0xF7){
        p++;
        const l=readVlq();
        const data=Array.from(trackData.slice(p,p+l));
        p+=l;
        if(tick===0)headers.push({d:0,v:[fb,..._vlqBytes(l),...data]});
        continue;
      }
      let st=fb;
      if(fb&0x80){rs=fb;p++;}
      else st=rs;
      if(!st)break;
      const hi=st&0xF0;
      if(hi===0xC0||hi===0xD0){
        if(p>=len)break;
        events.push({tick,data:[st,trackData[p++]]});
      }else{
        if(p+1>=len)break;
        events.push({tick,data:[st,trackData[p],trackData[p+1]]});
        p+=2;
      }
    }
    return{headers,events};
  }
  if(!slices.length)return[];
  const numTracks=slices[0].tracks.length;
  const merged=[];
  for(let ti=0;ti<numTracks;ti++){
    /* 各スライスの同インデックストラックを時系列に結合 */
    let allEvents=[];
    let tickOffset=0;
    const baseHdr=(_parseTrackForMerge(slices[0].tracks[ti]||new Uint8Array(0))).headers;
    for(const sl of slices){
      const trk=sl.tracks[ti];
      if(trk&&trk.length){
        /* 生バイト列からイベントを抽出してオフセット付与 */
        const evs=_parseTrackForMerge(trk).events;
        for(const ev of evs) ev.tick+=tickOffset;
        allEvents=allEvents.concat(evs);
      }
      tickOffset+=ppq*4*sl.bars;
    }
    /* イベントを時系列ソートしてトラックバイト列に変換 */
    if(allEvents.length){
      allEvents.sort((a,b)=>a.tick-b.tick||(((a.data[0]&0xF0)===0x80?0:1)-((b.data[0]&0xF0)===0x80?0:1)));
      const ae=allEvents.map(ev=>({pos:ev.tick,v:ev.data}));
      /* ヘッダはスライス0の tick=0 メタ/システムイベントを流用 */
      merged.push(safeAbsToTrack(ae, baseHdr));
    } else {
      merged.push(slices[0].tracks[ti]||new Uint8Array(0));
    }
  }
  return merged;
}

/* _abSlot: undefined=通常, 'A'=midiDataA, 'B'=midiDataB */
function doGenerate(_abSlot, _onDone){
  /* ── コード進行モード: 有効かつ進行が設定されている場合 ── */
  const useProgression = (typeof PROG_STATE!=='undefined') && PROG_STATE.enabled && PROG_STATE.prog.length >= 1;

  /* バリデーション */
  if(!useProgression && !S.chord){log('\u26a0 コードを入力してください','warn');return;}
  if(useProgression && !PROG_STATE.prog.length){log('\u26a0 コード進行にコードを追加してください','warn');return;}

  const _isAB = (_abSlot === 'A' || _abSlot === 'B');
  const btn=document.getElementById(_isAB ? 'btnGenAB' : 'btnGen');
    if(btn){btn.classList.add('busy');btn.textContent=_isAB?'\u2b21 GEN '+_abSlot+'...':'\u2b21 GENERATING...';}
  setTimeout(()=>{try{if(!_isAB)logClear();
  /* ── シード設定 ── */
  if(_abSlot === 'B'){
    /* B バリアント: A シードを XOR して差異を作る */
    const seedB = (S.seed ^ 0xDEADBEEF) >>> 0 || 1;
    rngSeed(seedB);
    log('// SEED B='+seedB+' (A='+S.seed+' ^ 0xDEADBEEF)','ok');
  } else if(S.seedLocked){
    rngSeed(S.seed);
    log('// SEED LOCKED '+S.seed,'ok');
  } else {
    rngSeed(0);S.seed=rngState();
    const sEl=document.getElementById('seedVal');if(sEl)sEl.textContent=S.seed;
    log('// SEED RAND '+S.seed,'ok');
  }

  /* 単一コード時のフォールバック: S.chord を進行1コードとして扱う */
  const activeProg = useProgression ? PROG_STATE.prog : [{chord:S.chord, bars:S.bars}];
  const totalBars = activeProg.reduce((s,e)=>s+e.bars,0);

  /* 単一コード時: S.bars を totalBars に揃えて既存挙動を維持 */
  if(!useProgression) activeProg[0].bars = S.bars;

  const c=activeProg[0].chord; // ログ・PC解析の代表コード
  const sD=ALL_SCALES[S.scale],scIv=sD?sD.iv:[0,2,3,5,7,9,10];
  const prg=GENRE_PROGS[S.genre]||GENRE_PROGS.ambient,ppq=480;
  let tensionCurve=null,sections=[];
  if(S.engines.macro&&S.macroEnabled){tensionCurve=generateTensionCurve(S.curveShape,totalBars,S.curveAmp,S.chainEnabled,S.curveShapeB);sections=detectSections(tensionCurve);log('// MACRO: '+S.curveShape+(S.chainEnabled?' \u2192 '+S.curveShapeB:'')+' | AMP: '+S.curveAmp+'%');if(S.tempoModEnabled)log('// TEMPO MOD: \u00b1'+S.tempoDrift+' BPM');}
  /* ── v25.7: Conductor Viz — 接続1: 編集済みカーブを優先的に使用 ── */
  if(CONDUCTOR_VIZ_STATE.enabled&&typeof ConductorViz!=='undefined'){
    tensionCurve=ConductorViz.getEffectiveCurve(tensionCurve);
    if(CONDUCTOR_VIZ_STATE.editedCurve)log('// CONDUCTOR VIZ: edited curve active','ok');
  }
  const eucPattern=(S.engines.euclidean&&S.eucEnabled)?euclideanPattern(S.eucPulses,S.eucSteps,S.eucRotation):null;
  if(eucPattern)log('// EUCLIDEAN: E('+S.eucPulses+','+S.eucSteps+') rot'+S.eucRotation);
/* ── v25.6: Rhythmic Canons — RC_PARAMS.enabled 時にゲートパターンを生成 ── */
let rcTracks=null;
if(RC_PARAMS.enabled&&typeof RhythmicCanons!=='undefined'){
  rcTracks=RhythmicCanons.generate(RC_PARAMS,RC_PARAMS.n);
  log('// RC: mode='+RC_PARAMS.mode+' n='+RC_PARAMS.n+' voices='+RC_PARAMS.voices,'ok');
}
/* ── v17.0: Sieve Theory — スカール/リズムパターン適用 ── */
let sievePattern=null, sieveScale=null;
if(S.engines.sieve&&SIEVE_STATE.enabled&&SIEVE_STATE.sieves.length){
  sieveRecompute(); // 最新状態に更新
  sievePattern=SIEVE_STATE.rhythmPat;
  sieveScale=SIEVE_STATE.scaleIv;
  const sieveExpr=SieveEngine.expression(SIEVE_STATE.sieves);
  log('// SIEVE: '+sieveExpr+' | mode='+SIEVE_STATE.mode.toUpperCase());
  if(sieveScale) log('// SIEVE SCALE: ['+sieveScale.join(',')+']');
  if(sievePattern) log('// SIEVE RHYTHM: '+sievePattern.map(p=>p?'●':'○').join('').slice(0,32)+(sievePattern.length>32?'…':''));
}
/* ── v18.0: Boids Swarm Intelligence ─────────────────────
   アクティブレイヤーをエージェントとして Boids シミュレーション実行
──────────────────────────────────────────────────────── */
let boidsResult=null;
if(S.engines.boids&&BOIDS_STATE.enabled){
  const activeLayerKeys=Object.entries(S.layers)
    .filter(([,v])=>v).map(([k])=>k)
    .filter(k=>BoidsEngine.LAYER_DEFAULTS[k]);
  if(activeLayerKeys.length>=2){
    boidsResult=boidsRun(activeLayerKeys, totalBars);
    log('// BOIDS: '+activeLayerKeys.length+' agents | Sep='+BOIDS_STATE.sepWeight+'% Ali='+BOIDS_STATE.aliWeight+'% Coh='+BOIDS_STATE.cohWeight+'%');
    const bSample=Object.entries(boidsResult).slice(0,3)
      .map(([k,v])=>(BoidsEngine.LAYER_DEFAULTS[k]?.label||k)+(v.registerOffset>=0?'+':'')+v.registerOffset+'st').join(' ');
    log('// BOIDS OFFSET: '+bSample);
  }
}
/* ── v14.0: Humanizer-Noise リセット（generate毎に新インスタンス） ── */
if(S.engines.humanizer&&Humanizer.isEnabled()){Humanizer.reset();const hst=Humanizer.STATE;log('// HUMANIZER: '+hst.mode.toUpperCase()+' | vel±'+hst.velScale+' tim±'+hst.timScale+'tk | pnAmp='+hst.pnAmp.toFixed(2));}

/* ── v15.0 / v22.0: アトラクターエンジン初期化
   Attractor Sequencer が有効なら AttractorEngine を使用、
   そうでなければ従来の LorenzAttractor にフォールバック ── */
const useAttractorSeq=(typeof ATTRACTOR_STATE!=='undefined')&&ATTRACTOR_STATE.enabled;
let attractor=null;
if(S.engines.lorenz){
  if(useAttractorSeq){
    attractor=AttractorEngine.create(ATTRACTOR_STATE.type,{
      a:ATTRACTOR_STATE.a,b:ATTRACTOR_STATE.b,c:ATTRACTOR_STATE.c,dt:ATTRACTOR_STATE.dt});
    attractor.stepN(ATTRACTOR_STATE.warmup);
    log('// ATTRACTOR: '+ATTRACTOR_STATE.type.toUpperCase()+
        ' a='+ATTRACTOR_STATE.a.toFixed(3)+' b='+ATTRACTOR_STATE.b.toFixed(3)+
        ' c='+ATTRACTOR_STATE.c.toFixed(3)+' | X→'+ATTRACTOR_STATE.mapX+
        ' Y→'+ATTRACTOR_STATE.mapY+' Z→'+ATTRACTOR_STATE.mapZ);
  } else {
    /* 後方互換: LorenzAttractor.create() でインスタンス生成し、AttractorEngine API に揃える */
    const _l=LorenzAttractor.create({sigma:LORENZ_PARAMS.sigma,rho:LORENZ_PARAMS.rho,beta:LORENZ_PARAMS.beta,dt:LORENZ_PARAMS.dt});
    _l.stepN(LORENZ_PARAMS.warmup);
    /* LorenzAttractor の API を AttractorEngine 互換にラップ */
    attractor={ type:'lorenz', step:()=>_l.step(), stepN:n=>_l.stepN(n), normalized:()=>_l.normalized(), get state(){return _l.state;} };
  }
}
/* 旧コードとの互換性のため lorenz 変数も保持 */
const lorenz=attractor;
const caRule=CA_PARAMS.override?CA_PARAMS.rule:(({ambient:30,drone:90,dark_ambient:110,psychedelic:54,space:18,ritual:150,kosmische:73,noise:126})[S.genre]||30);
const ca=S.engines.ca?CellularAutomaton.create({width:64,rule:caRule,seed:CA_PARAMS.seed,rows:60}):null;
const rubatoDelta=S.engines.rubato?RubatoEngine.deltaTicks({e:RUBATO_PARAMS.e,t0:RUBATO_PARAMS.t0,notes:RUBATO_PARAMS.notes,ppq,dir:RUBATO_PARAMS.dir}):null;
const ttRow=scIv.slice(0,Math.min(12,scIv.length));
while(ttRow.length<12)ttRow.push((ttRow[ttRow.length-1]+1)%12);
const ttForms=S.engines.twelvetone?TwelveTone.allForms(ttRow):null;
/* ── v16.0: Integral Serialism 初期化 ── */
const isInst=S.engines.integralserialism?IntegralSerialism.create(ttRow,ppq):null;
if(isInst){
  const inf=isInst.info();
  log('// INTEGRAL SERIALISM: 12音列 Duration·Vel·Gate 直列化 ACTIVE');
  log('// IS vel['+inf.currentForm+']: '+inf.summary.vel.split(' ').slice(0,6).join(' ')+'…');
  /* UIパネルのプレビュー更新 */
  const dEl=document.getElementById('isDurDisplay');
  const vEl=document.getElementById('isVelDisplay');
  const gEl=document.getElementById('isGateDisplay');
  if(dEl)dEl.textContent=inf.summary.dur;
  if(vEl)vEl.textContent=inf.summary.vel;
  if(gEl)gEl.textContent=inf.summary.gate;
  const fs=document.getElementById('isFormStatus');
  if(fs)fs.textContent='FORM: '+inf.currentForm+' / SERIES LEN: '+ttRow.length;
}
/* ── PCSet + Spectral ログ (代表コードで出力) ── */
{
  const chordPCs=c.iv.map(i=>((c.root+i)%12));
  const scalePCs=scIv.map(i=>((c.root+i)%12));
  const compositePCs=[...new Set([...chordPCs,...scalePCs.slice(0,4)])];
  const pcAnalysis=S.engines.pcset?PCSetEngine.analyze(compositePCs):null;
  if(pcAnalysis){
    log('// PC: '+pcAnalysis.forte+' IV<'+pcAnalysis.iv.join('')+'> diss='+pcAnalysis.dissonanceScore);
    if(pcAnalysis.zRelated.length>0) log('// Z-RELATED: '+pcAnalysis.zRelated.slice(0,3).map(z=>z.forte).join(', '));
  }
  const spectralAnalysis=S.engines.spectral?SpectralEngine.analyze(c.root%12,c.iv,{harmonics:SPECTRAL_PARAMS.harmonics,timbre:SPECTRAL_PARAMS.timbre,rolloff:SPECTRAL_PARAMS.rolloff,threshold:SPECTRAL_PARAMS.threshold}):null;
  if(spectralAnalysis)log('// SPECTRAL: '+SPECTRAL_PARAMS.timbre.toUpperCase()+' h'+SPECTRAL_PARAMS.harmonics+' cons='+spectralAnalysis.chordConsonance.toFixed(2)+' bright='+spectralAnalysis.brightnessScore.toFixed(2));
}
const engLog=Object.entries(S.engines).filter(([,v])=>v).map(([k])=>k.toUpperCase().slice(0,4)).join(' ');
log('// ENGINES ON: '+engLog);

/* ── コード進行ログ ── */
if(useProgression){
  log('// PROG: '+activeProg.map(e=>e.chord.rootName+(e.chord.quality||'')).join(' → ')+' | '+totalBars+' bars');
  const expanded=ProgEngine.expandToBars(activeProg,totalBars);
  const scores=ProgEngine.smoothnessScores(activeProg);
  if(scores.length){const avg=(scores.reduce((a,v)=>a+v,0)/scores.length).toFixed(2);log('// SMOOTH avg='+avg+' ['+scores.map(v=>v.toFixed(2)).join(',')+']');}
} else {
  log('// '+c.rootName+(c.quality||'')+' | '+S.scale+' | '+S.genre.toUpperCase()+' | GATE:'+S.gateBase.toFixed(2));
}

/* ── Scale Mutation 初期化 ── */
let scaleMutExpanded=null;
const useScaleMut=(typeof SCALE_MUT_STATE!=='undefined')&&SCALE_MUT_STATE.enabled&&SCALE_MUT_STATE.slots.length>=1;
if(useScaleMut){
  scaleMutExpanded=ScaleMutEngine.expandToBars(SCALE_MUT_STATE.slots,totalBars);
  const smScores=ScaleMutEngine.smoothnessScores(SCALE_MUT_STATE.slots,c.root%12);
  log('// SCALE MUT: '+SCALE_MUT_STATE.slots.map(s=>s.scale).join(' → ')+' | mode='+SCALE_MUT_STATE.transMode);
  if(smScores.length){const smAvg=(smScores.reduce((a,v)=>a+v,0)/smScores.length).toFixed(2);log('// SCALE MUT SMOOTH avg='+smAvg);}
}

/* ── 共有リソースを shared オブジェクトにまとめる ── */
const velShape=(typeof PROG_STATE!=='undefined')&&PROG_STATE.enabled;
/* Attractor mapping config (useAttractorSeq 時は ATTRACTOR_STATE から、通常は固定デフォルト) */
const attractorMap=useAttractorSeq?{
  mapX:ATTRACTOR_STATE.mapX, mapY:ATTRACTOR_STATE.mapY, mapZ:ATTRACTOR_STATE.mapZ,
  scaleX:ATTRACTOR_STATE.scaleX/100, scaleY:ATTRACTOR_STATE.scaleY/100, scaleZ:ATTRACTOR_STATE.scaleZ/100,
}:{
  mapX:'velocity', mapY:'pitch', mapZ:'gate',
  scaleX:0.5, scaleY:0.5, scaleZ:0.5,
};
/* ── v25.4: Voice Leading — 'voice-lead' モード時にボイシングを事前計算 ── */
const useVL = PROG_STATE.enabled && PROG_STATE.transitionMode === 'voice-lead'
              && typeof VLEngine !== 'undefined' && activeProg.length > 0;
const vlVoicings = useVL
  ? VLEngine.getCachedVoicings(PROG_STATE.prog, { center: (S.rootOct * 12) + (S.chord ? S.chord.root : 0) })
  : [];
if(useVL) log('// VL: voice-lead mode — '+activeProg.length+' chords pre-voiced','ok');

/* ── v25.5: Just Intonation — jiPBMap を事前計算してレイヤーに渡す ── */
const useJI = JI_PARAMS.enabled && typeof JustIntonation !== 'undefined' && S.chord;
let jiPBMap = null;
if(useJI){
  const root = S.chord.root;
  const pcs  = S.chord.iv.map(i => ((root + i) % 12 + 12) % 12);
  jiPBMap = JustIntonation.getPitchBendMap(pcs, root, JI_PARAMS);
  log('// JI: mode='+JI_PARAMS.mode+' blend='+JI_PARAMS.blend.toFixed(2)+' root='+NN[root],'ok');
}

const shared={ppq,scIv,prg,tensionCurve,eucPattern,sievePattern,sieveScale,boidsResult,
  lorenz,attractor,attractorMap,ca,rubatoDelta,ttForms,isInst,isState:S.isState,
  velShape,velShapeMode:PROG_STATE.velShapeMode,velShapeAmt:PROG_STATE.velShapeAmt,
  scaleMutExpanded,scaleMutTransMode:useScaleMut?SCALE_MUT_STATE.transMode:'hard',
  scaleMutTransLen:useScaleMut?SCALE_MUT_STATE.transLen:0,
  vlVoicings, jiPBMap, rcTracks};

/* ── Markov matrix の事前構築 (全コードで共用) ── */
if(S.layers.markov&&S.engines.markov){
  MarkovEngine.STATE.matrix=MarkovEngine.STATE.matrix||MarkovEngine.buildMatrix(
    MarkovEngine.SCALE_PRESETS[MarkovEngine.STATE.scaleKey].notes,
    MarkovEngine.STATE.bias, MarkovEngine.STATE.tension);
  log('// MARKOV: '+MarkovEngine.SCALE_PRESETS[MarkovEngine.STATE.scaleKey].name+' '+MarkovEngine.STATE.bias.toUpperCase()+' t='+MarkovEngine.STATE.tension.toFixed(2)+' T='+MarkovEngine.STATE.temperature.toFixed(2));
}
if(S.engines.lsystem&&LSEngine.STATE.enabled&&LSEngine.STATE.lstring){
  const lst=LSEngine.STATE;
  log('// L-SYSTEM: '+lst.presetName+' gen'+lst.generations+' len='+lst.lstring.length+' mode='+lst.growthMode);
}

/* ── コードごとにレイヤートラックを生成 ── */
const slices=[];
let barCursor=0;
for(let _pi=0;_pi<activeProg.length;_pi++){
  const entry=activeProg[_pi];
  /* v25.4: voice-lead モード時は各コードのボイシングを shared 経由で注入 */
  const _sharedForChord = vlVoicings.length > _pi
    ? { ...shared, vlVoicing: vlVoicings[_pi] }
    : shared;
  const result=generateForChord(entry.chord,entry.bars,barCursor,_sharedForChord);
  slices.push({tracks:result.tracks,trackNames:result.trackNames,bars:entry.bars});
  barCursor+=entry.bars;
}

/* ── スライスを結合して最終トラック配列を作成 ── */
let tracks,tn;
if(slices.length===1){
  /* 単一コード: 結合不要 */
  tracks=slices[0].tracks;
  tn=slices[0].trackNames;
} else {
  /* 複数コード: mergeProgTracks で時系列結合 */
  tracks=mergeProgTracks(slices,ppq);
  tn=slices[0].trackNames; // トラック名は最初のスライスから
}

/* ── 全体トラックへ特殊エンジンを追加 (Solfeggio・Binaural は単一コードを代表コードで) ── */
const rootMidiGlobal=(S.rootOct*12)+c.root;
if(S.engines.solfeggio&&SolfeggioEngine.STATE.enabled){
  const sfTrk=SolfeggioEngine.makeSolfeggioTrack(rootMidiGlobal,{ppq,bars:totalBars,genre:S.genre,octLayers:S.octLayers.length?S.octLayers:[S.rootOct],octBias:S.octBias,density:S.density,velocity:S.velocity,humanize:S.humanize,drift:S.drift,dissonance:S.dissonance,polyrhythm:S.polyrhythm,tensionCurve,gateBase:S.gateBase,gateHumanize:S.gateHumanize,eucPattern,resolveThreshold:S.engines.resolution?S.resolveThreshold:1.01,resolveSteps:S.resolveSteps,lorenz,ca,rubatoDelta,ttForms,rootPc:c.root%12,isInst,isState:S.isState,sievePattern,sieveScale,boidsResult},tensionCurve);
  if(sfTrk&&sfTrk.length){tracks.push(sfTrk);tn.push('Solfeggio');const sfSel=SolfeggioEngine.getSelectedFreqs();log('// SOLFEGGIO: '+sfSel.length+'freq | mode='+SolfeggioEngine.STATE.mode+' vel='+SolfeggioEngine.STATE.velocity+' gate='+SolfeggioEngine.STATE.gate.toFixed(2)+' oct'+(SolfeggioEngine.STATE.octShift>=0?'+':'')+SolfeggioEngine.STATE.octShift);}
}
if(S.engines.binaural&&BinauralEngine.STATE.enabled){
  const bbTrk=BinauralEngine.makeBinauralTrack({ppq,bars:totalBars,genre:S.genre,octLayers:S.octLayers.length?S.octLayers:[S.rootOct],octBias:S.octBias,density:S.density,velocity:S.velocity,humanize:S.humanize,drift:S.drift,dissonance:S.dissonance,polyrhythm:S.polyrhythm,tensionCurve,gateBase:S.gateBase,gateHumanize:S.gateHumanize,eucPattern,resolveThreshold:S.engines.resolution?S.resolveThreshold:1.01,resolveSteps:S.resolveSteps,lorenz,ca,rubatoDelta,ttForms,rootPc:c.root%12,isInst,isState:S.isState,sievePattern,sieveScale,boidsResult},tensionCurve);
  if(bbTrk&&bbTrk.length){tracks.push(bbTrk);tn.push('Binaural-L/R');const bb=BinauralEngine.STATE;log('// BINAURAL: '+bb.activeBand.toUpperCase()+' Δ'+bb.activeBeat+'Hz | mode='+bb.mode+' carrier=midi'+bb.carrierNote+' Ch13(L)/Ch14(R)');}
}

/* ── v23.0: CC Automation トラック生成 ── */
const useCCA=(typeof CC_AUTO_STATE!=='undefined')&&CC_AUTO_STATE.enabled;
if(useCCA){
  const activeLanes=CC_AUTO_STATE.lanes.filter(l=>l.enabled);
  if(activeLanes.length){
    const ccaTrk=CCAutoEngine.makeCCTrack(activeLanes,totalBars,ppq,tensionCurve);
    if(ccaTrk&&ccaTrk.length){
      tracks.push(ccaTrk);tn.push('CC Automation');
      log('// CC AUTO: '+activeLanes.length+' lanes ['+activeLanes.map(l=>'CC'+l.cc+'/'+l.shape.split(' ')[0]).join(', ')+']');
    }
  }
}
if(!tracks.length){log('\u26a0 レイヤーが無効','warn');btn.classList.remove('busy');btn.textContent='\u2b21 GENERATE MIDI';return;}
const rS=DissonanceResolver.getState();
if(rS.resolveCount>0)log('// RESOLUTION: '+rS.resolveCount+'x');
const ri=document.getElementById('resolveIndicator');
if(ri){ri.textContent=rS.resolveCount>0?'RESOLVED '+rS.resolveCount+'x':'NO RESOLUTION';ri.style.color=rS.resolveCount>0?'var(--teal)':'var(--text-dim)';}
/* ── Multi-File Export: 個別レイヤートラックを保存 ── */
S.layerTracks=tracks.map((t,i)=>({name:tn[i]||('Track'+(i+1)),data:t}));
S.conductorRaw=buildConductorTrack(S.bpm,ppq,totalBars,tensionCurve,S.engines.macro&&S.macroEnabled&&S.tempoModEnabled,S.tempoDrift,S.engines.macro&&S.macroEnabled?sections:[]);
const _mc=(typeof CompTuningEngine!=='undefined'&&typeof CompTuningEngine.getScaleDegreeCents==='function')?CompTuningEngine.getScaleDegreeCents(S.scale,c.root%12,useJI?{useJI:true,jiParams:JI_PARAMS}:undefined):MICRO_CENTS[S.scale],_useMPE=S.engines.mpe&&S.mpe&&!!_mc;
if(typeof CompTuningEngine!=='undefined'&&typeof CompTuningEngine.setGeneratedNoteCentsMap==='function'){
  if(_mc&&S.engines.comptuning&&CompTuningEngine.STATE.enabled){
    const generatedMap=CompTuningEngine.buildGeneratedNoteCentsMap(S.scale,c.root%12,[0,10],useJI?{useJI:true,jiParams:JI_PARAMS}:undefined);
    CompTuningEngine.setGeneratedNoteCentsMap(generatedMap);
  }else if(typeof CompTuningEngine.clearGeneratedNoteCentsMap==='function'){
    CompTuningEngine.clearGeneratedNoteCentsMap();
  }
}
if(_mc){
  if(_useMPE) log('// MICROTONAL OUT: MPE per-note pitch bend','ok');
  else if(S.engines.comptuning&&CompTuningEngine.STATE.enabled) log('// MICROTONAL OUT: CompTuning pitch bend (shared channel path)','ok');
  else log('// MICROTONAL OUT: 12-TET fallback — enable MPE or CompTuning for exact detune','warn');
}
if(_useMPE){
  const _scIv=(ALL_SCALES[S.scale]||{iv:[0]}).iv,_rpc=c.root%12;
  const _mcEff=_mc;
  if(useJI)log('// JI(MPE): '+JI_PARAMS.mode+' blend='+JI_PARAMS.blend.toFixed(2),'ok');
  let _allEv=[];for(const t of tracks)_allEv.push(...parseMidiTrackData(t));
  const _merged=buildMPETrack(_allEv,_scIv,_rpc,_mcEff,S.pbRange);
  const mpeCond=buildMPEConductor(S.bpm,ppq,totalBars,tensionCurve,S.engines.macro&&S.macroEnabled&&S.tempoModEnabled,S.tempoDrift,S.engines.macro&&S.macroEnabled?sections:[],S.pbRange);
  S.midiData=writeMPEMidi(_merged,S.bpm,ppq,S.pbRange,mpeCond);
  if(S.engines.comptuning&&CompTuningEngine.STATE.enabled){S.midiData=applyCompensationTuningToMidi(S.midiData,S.pbRange);log('// COMPTUNING(MPE): '+CompTuningEngine.getSummary(),'ok');logCompTuningRoutingState();}
  log('// MPE \u00b1'+S.pbRange+' st','ok');
} else {
  S.midiData=writeMIDI(tracks,S.bpm,ppq,S.conductorRaw);
  if(S.engines.comptuning&&CompTuningEngine.STATE.enabled){S.midiData=applyCompensationTuningToMidi(S.midiData,S.pbRange);log('// COMPTUNING: '+CompTuningEngine.getSummary(),'ok');logCompTuningRoutingState();}
}
/* A/B スロット振り分け */
if(_abSlot === 'A'){ S.midiDataA = S.midiData; }
else if(_abSlot === 'B'){ S.midiDataB = S.midiData; }
log('// DONE '+((_abSlot)?'['+_abSlot+'] ':'')+S.midiData.length+' bytes','ok');
if(!_isAB){
  drawTViz(totalBars*ppq*4,tracks.length,tn);
  /* ── v25.7: Conductor Viz — 接続2: 生成後に可視化を更新 ── */
  if(CONDUCTOR_VIZ_STATE.enabled&&typeof ConductorViz!=='undefined'){
    ConductorViz.updateAfterGenerate(
      S.bpm,totalBars,tensionCurve,
      S.engines.macro&&S.macroEnabled&&S.tempoModEnabled,
      S.tempoDrift,sections
    );
  }
  document.getElementById('btnDl').classList.add('show');
  buildMultiExportUI();const _btnMDl=document.getElementById('btnMultiDl');if(_btnMDl)_btnMDl.classList.add('show');
  if(typeof MidiPreview!=='undefined'&&S.midiData){MidiPreview.load(S.midiData,S.bpm);const _pp=document.getElementById('midiPreviewPanel');if(_pp)_pp.style.display='';}
}

}catch(e){
  // エラーコンテキスト: どのエンジンが有効だったかを出力
  const activeEngines=typeof S!=='undefined'&&S.engines
    ? Object.entries(S.engines).filter(([,v])=>v).map(([k])=>k).join(',')
    : '?';
  const chordStr=typeof S!=='undefined'&&S.chord
    ? (S.chord.rootName+(S.chord.quality||''))
    : 'none';
  log('// ERROR: '+e.message,'err');
  log('//   chord='+chordStr+' bpm='+(typeof S!=='undefined'?S.bpm:'?')+' engines=['+activeEngines+']','err');
  if(e.stack){
    // スタックの最初の2行だけコンソールに出力（ログパネルには長すぎる）
    console.error('[doGenerate]',e);
    const stackTop=(e.stack||'').split('\n').slice(0,3).join(' | ');
    log('//   '+stackTop,'err');
  }
}if(btn){btn.classList.remove('busy');btn.textContent=_isAB?'⬡ GEN A/B':'\u2b21 GENERATE MIDI';if(!_isAB&&typeof refreshGenerateButtonMicrotonalState==='function')refreshGenerateButtonMicrotonalState();}if(typeof _onDone==='function')_onDone();},30);}
/* ═══ A/B バリアント生成 ═══ */
function doGenerateAB(){
  if(!S.chord && !(typeof PROG_STATE!=='undefined' && PROG_STATE.enabled && PROG_STATE.prog.length)){
    log('⚠ コードを入力してください','warn'); return;
  }
  const btnAB = document.getElementById('btnGenAB');
  if(btnAB){ btnAB.classList.add('busy'); btnAB.textContent='⬡ GEN A...'; }
  log('// A/B GENERATE START (seed='+S.seed+')','ok');

  // A 完了コールバック → B を直列起動（固定遅延による競合を解消）
  doGenerate('A', () => {
    if(btnAB){ btnAB.textContent='⬡ GEN B...'; }
    // B 完了コールバック → 後処理
    doGenerate('B', () => {
      S.abMode = 'A';
      _updateABPreview();
      if(btnAB){ btnAB.classList.remove('busy'); btnAB.textContent='⬡ GEN A/B'; }
      document.getElementById('btnDl').classList.add('show');
      const _pp = document.getElementById('midiPreviewPanel');
      if(_pp) _pp.style.display = '';
      const _abPanel = document.getElementById('abPanel');
      if(_abPanel) _abPanel.style.display = '';
      log('// A/B DONE — A:'+( S.midiDataA?S.midiDataA.length:'?')+' B '+(S.midiDataB?S.midiDataB.length:'?')+' bytes','ok');
    });
  });
}

function _updateABPreview(){
  const data = S.abMode === 'B' ? S.midiDataB : S.midiDataA;
  if(!data) return;
  S.midiData = data; // DL ボタンは常に現在の abMode のデータをDLする
  if(typeof MidiPreview !== 'undefined') MidiPreview.load(data, S.bpm);
  // A/B ボタン状態更新
  ['A','B'].forEach(m => {
    const b = document.getElementById('abBtn'+m);
    if(b) b.classList.toggle('on', S.abMode === m);
  });
}

function doDownload(){if(!S.midiData)return;const blob=new Blob([S.midiData],{type:'audio/midi'}),url=URL.createObjectURL(blob),a=document.createElement('a');const sq=(S.chord?(S.chord.quality||''):'').replace(/[\u00f8\u0394]/g,'').replace(/#/g,'s').replace(/[^a-zA-Z0-9_-]/g,'');const sr=S.chord?S.chord.rootName.replace('#','s'):'x';const ss=S.scale.replace(/[ /()]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'');const mt=S.macroEnabled?'_'+S.curveShape.replace(/\s+/g,''):'';const euc=S.eucEnabled?'_E'+S.eucPulses+'x'+S.eucSteps+'r'+S.eucRotation:'';const mkv=S.layers.markov?'_MKV':'';a.href=url;a.download=`void_${sr}${sq}_${ss}_${S.genre}_${S.bpm}bpm_g${Math.round(S.gateBase*100)}${mt}${euc}${mkv}${S.mpe?'_MPE':''}.mid`;a.click();URL.revokeObjectURL(url);log('// DOWNLOADED','ok');}
/* ═══ MULTI-FILE EXPORT ═══ */
function buildMultiExportUI(){
  const grid=document.getElementById('meLayerGrid');
  if(!grid||!S.layerTracks)return;
  grid.innerHTML='';
  const ME=S.multiExport;
  S.layerTracks.forEach(lt=>{
    if(!Object.prototype.hasOwnProperty.call(ME.layers,lt.name))ME.layers[lt.name]=true;
  });
  S.layerTracks.forEach(lt=>{
    const on=ME.layers[lt.name]!==false;
    const btn=document.createElement('button');
    btn.className='me-layer-btn'+(on?' on':'');
    btn.dataset.layerName=lt.name;
    btn.textContent=lt.name;
    btn.addEventListener('click',()=>{
      ME.layers[lt.name]=!ME.layers[lt.name];
      btn.classList.toggle('on',ME.layers[lt.name]);
      updateMultiExportCount();
    });
    grid.appendChild(btn);
  });
  const statusEl=document.getElementById('meStatus');
  if(statusEl)statusEl.textContent='';
  updateMultiExportCount();
}
function updateMultiExportCount(){
  const cnt=document.getElementById('meCount');
  if(!cnt||!S.layerTracks)return;
  const n=S.layerTracks.filter(lt=>S.multiExport.layers[lt.name]!==false).length;
  cnt.textContent=n+' ファイルを出力';
}
function doMultiExport(){
  if(!S.layerTracks||!S.layerTracks.length){log('\u26a0 まずGENERATEを実行してください','warn');return;}
  const ME=S.multiExport;
  const ppq=480;
  const rawPfx=(ME.prefix||'void').replace(/[^a-zA-Z0-9_-]/g,'_')||'void';
  const toExport=S.layerTracks.filter(lt=>ME.layers[lt.name]!==false);
  if(!toExport.length){log('\u26a0 エクスポートするレイヤーを選択してください','warn');return;}
  log('// MULTI EXPORT: '+toExport.length+' files...');
  toExport.forEach((lt,idx)=>{
    setTimeout(()=>{
      const num=ME.numberPad?(String(idx+1).padStart(2,'0')+'_'):'';
      const safeName=lt.name.replace(/[\/ ]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'');
      const fname=rawPfx+'_'+num+safeName+'.mid';
      let midiBytes;
      if(ME.includeConductor&&S.conductorRaw){
        midiBytes=writeMIDI([lt.data],S.bpm,ppq,S.conductorRaw);
      }else{
        const hdr=[0x4D,0x54,0x68,0x64,0,0,0,6,0,1,0,1,(ppq>>8)&0xFF,ppq&0xFF];
        midiBytes=new Uint8Array([...hdr,...trackChunk(lt.data)]);
      }
      if(S.engines.comptuning&&CompTuningEngine.STATE.enabled){
        midiBytes=applyCompensationTuningToMidi(midiBytes,S.pbRange);
      }
      const blob=new Blob([midiBytes],{type:'audio/midi'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=fname;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      if(idx===toExport.length-1)log('// MULTI EXPORT DONE \u2014 '+toExport.length+' files','ok');
    },idx*120);
  });
}
function drawTViz(total,num,names){const cv=document.getElementById('tviz');cv.width=cv.offsetWidth;cv.height=100;const cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height);const cols=['#00e5ff','#8c3fff','#1de9b6','#ffcc00','#00e676','#ff4081','#00bcd4','#ff9800'];const h=10,gap=2,tH=num*(h+gap),sy=(cv.height-tH)/2;for(let i=0;i<num;i++){const y=sy+i*(h+gap);cx.fillStyle=cols[i%8]+'18';cx.fillRect(0,y,cv.width,h);cx.fillStyle=cols[i%8];cx.font='7px Share Tech Mono,monospace';cx.fillText(names[i]||'',3,y+8);let x=40;while(x<cv.width){if(rng()<.45){const w=rng()*50+4;cx.fillStyle=cols[i%8]+'88';cx.fillRect(x,y+1,Math.min(w,cv.width-x),h-2);x+=w+rng()*20+2;}else x+=rng()*30+5;}}}
function log(msg,type=''){const el=document.getElementById('log'),d=document.createElement('div');d.className='log-l'+(type?' '+type:'');d.textContent=msg;el.appendChild(d);while(el.children.length>12)el.removeChild(el.firstChild);el.scrollTop=el.scrollHeight;}
function logClear(){document.getElementById('log').innerHTML='';}
function bindChordInput(){const inp=document.getElementById('chordInput'),st=document.getElementById('chordStatus');inp.addEventListener('input',()=>{const v=inp.value;if(!v.trim()){st.textContent='\u2014 コードを入力してください \u2014';st.className='chord-status';S.chord=null;return;}const p=parseChord(v);if(p){st.textContent='\u2713 '+p.rootName+(p.quality||'')+' \u2014 '+p.name;st.className='chord-status ok';S.chord=p;updateTheory();}else{st.textContent='\u2717 認識できません';st.className='chord-status err';S.chord=null;}});}

/* ═══════════════════════════════════════════════════
   v12.2: NEGATIVE HARMONY UI CONTROLLER
═══════════════════════════════════════════════════ */
(function initNegHarmony(){
  const NH=NegHarmony;
  const keyEl=document.getElementById('nh-key');
  const slotsEl=document.getElementById('nh-slots');
  const origRow=document.getElementById('nh-orig-row');
  const shadRow=document.getElementById('nh-shad-row');
  const axisLbl=document.getElementById('nh-axis-label');
  const addBtn=document.getElementById('nh-add');

  /* populate key select */
  NH.NF.forEach((n,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=n;keyEl.appendChild(opt);});

  let slots=[{root:0,type:6},{root:9,type:8},{root:2,type:8},{root:7,type:7}]; /* CM7 Am7 Dm7 G7 */

  function rootOpts(sel){return NH.NF.map((n,i)=>`<option value="${i}"${i===sel?' selected':''}>${n}</option>`).join('');}
  function typeOpts(sel){return NH.CDB.map(([nm],i)=>`<option value="${i}"${i===sel?' selected':''}>${nm||'maj'}</option>`).join('');}

  function renderSlots(){
    slotsEl.innerHTML=slots.map((s,idx)=>`<div class="nh-slot" data-idx="${idx}"><div class="slot-num">${idx+1}</div><select class="slot-root">${rootOpts(s.root)}</select><select class="slot-type">${typeOpts(s.type)}</select><button class="del-btn" data-idx="${idx}">\u00d7</button></div>`).join('');
    slotsEl.querySelectorAll('.slot-root').forEach((el,i)=>{el.addEventListener('change',()=>{slots[i].root=+el.value;render();});});
    slotsEl.querySelectorAll('.slot-type').forEach((el,i)=>{el.addEventListener('change',()=>{slots[i].type=+el.value;render();});});
    slotsEl.querySelectorAll('.del-btn').forEach(el=>{el.addEventListener('click',()=>{slots.splice(+el.dataset.idx,1);render();});});
  }

  function renderChords(){
    const keyRoot=+keyEl.value;
    axisLbl.textContent=NH.AX[keyRoot];
    if(!slots.length){origRow.innerHTML='<div class="nh-empty">コードを追加してください</div>';shadRow.innerHTML='';return;}
    let oH='',sH='';
    for(const s of slots){
      const oN=NH.chordToNotes(s.root,s.type);
      const sN=NH.invert(oN,keyRoot);
      const oSuf=NH.CDB[s.type][0];
      oH+=`<div class="nh-chord-card orig"><div class="chord-name-nh">${NH.NF[s.root]}${oSuf}</div><div class="chord-notes-nh">${oN.map(n=>NH.NF[n]).join(' \u00b7 ')}</div></div>`;
      const id=NH.identify(sN);
      if(id){sH+=`<div class="nh-chord-card shad"><div class="chord-name-nh">${NH.NF[id.root]}${id.suffix}</div><div class="chord-notes-nh">${sN.map(n=>NH.NF[n]).join(' \u00b7 ')}</div></div>`;}
      else{sH+=`<div class="nh-chord-card shad"><div class="chord-name-nh" style="font-size:12px">(?)</div><div class="chord-notes-nh">${sN.map(n=>NH.NF[n]).join(' \u00b7 ')}</div></div>`;}
    }
    origRow.innerHTML=oH;shadRow.innerHTML=sH;
  }

  function render(){renderSlots();renderChords();}
  addBtn.addEventListener('click',()=>{if(slots.length>=8)return;slots.push({root:7,type:6});render();});
  keyEl.addEventListener('change',renderChords);
  render();
})();

function getCompTuningScaleSyncSummary(){
  if(typeof CompTuningEngine==='undefined'||!CompTuningEngine.STATE)return null;
  const st=CompTuningEngine.STATE;
  if(!st.autoScaleSync)return{mode:'MANUAL',detail:'CompTuning manual override active',on:false};
  if(!st.linkedScaleName)return null;
  return{mode:'AUTO',detail:'CompTuning -> '+st.linkedScaleName+' @ '+CompTuningEngine.NOTE_NAMES[st.rootPc],on:true};
}

function getMicrotonalOutputSummary(){
  const hasMicro=typeof MICRO_CENTS!=='undefined'&&!!MICRO_CENTS[S.scale];
  if(!hasMicro)return null;
  if(S.engines.mpe&&S.mpe)return{mode:'MPE',detail:'Per-note pitch bend path active',warn:false};
  if(typeof CompTuningEngine!=='undefined'&&CompTuningEngine.STATE&&S.engines.comptuning&&CompTuningEngine.STATE.enabled){
    const routing=CompTuningEngine.STATE.lastAdaptiveRouting||null;
    if(routing&&routing.fallbackConflicts>0)return{mode:'COMP',detail:'CompTuning shared-channel path active | '+routing.fallbackConflicts+' collisions remained on original channels',warn:true};
    if(routing&&routing.used)return{mode:'COMP',detail:'CompTuning shared-channel path active | adaptive routing via '+routing.spareChannels.map(ch=>'Ch'+(ch+1)).join(' '),warn:false};
    return{mode:'COMP',detail:'CompTuning pitch-bend path active (shared by channel)',warn:false};
  }
  return{mode:'12-TET',detail:'Microtonal scale selected, but output remains equal-tempered',warn:true};
}

function getCompTuningTrackWarningSummary(){
  if(typeof CompTuningEngine==='undefined'||!CompTuningEngine.STATE)return null;
  const routing=CompTuningEngine.STATE.lastAdaptiveRouting;
  if(!routing||!routing.trackStats)return null;
  const warned=Object.entries(routing.trackStats)
    .filter(([,stats])=>stats&&stats.fallbackConflicts>0)
    .sort((a,b)=>b[1].fallbackConflicts-a[1].fallbackConflicts)
    .slice(0,3);
  if(!warned.length)return null;
  return{
    mode:'TRACK WARN',
    detail:warned.map(([trackName,stats])=>trackName+' x'+stats.fallbackConflicts).join(' / '),
    items:warned.map(([trackName,stats])=>({trackName,fallbackConflicts:stats.fallbackConflicts})),
    warn:true,
  };
}

function getCompTuningMitigationSuggestions(trackWarnInfo){
  if(!trackWarnInfo||!trackWarnInfo.items||!trackWarnInfo.items.length)return[];
  return trackWarnInfo.items
    .filter(item=>{
      const layerKey=getLayerKeyFromTrackName(item.trackName);
      return !!(layerKey&&S.layers[layerKey]);
    })
    .slice(0,3)
    .map((item,index)=>({
      trackName:item.trackName,
      fallbackConflicts:item.fallbackConflicts,
      label:'TRY MUTE '+item.trackName.toUpperCase(),
      detail:(index===0?'Highest':'Next')+' remaining collision candidate: '+item.trackName,
    }));
}

function getLayerKeyFromTrackName(trackName){
  const aliases={Drone:'drone',Pad:'pad',Arp:'arp',Arpeggio:'arp',Melody:'melody',Bass:'bass',Overtone:'overtone',Texture:'texture',Lead:'lead',Markov:'markov'};
  return aliases[trackName]||null;
}

function focusLayerToggle(trackName){
  const layerKey=getLayerKeyFromTrackName(trackName);
  const wrap=document.getElementById('layerToggles');
  if(!wrap||!layerKey)return false;
  const row=wrap.querySelector(`.tog-row[data-layer-key="${layerKey}"]`);
  if(!row)return false;
  row.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  row.classList.remove('warn-focus');
  void row.offsetWidth;
  row.classList.add('warn-focus');
  setTimeout(()=>row.classList.remove('warn-focus'),1800);
  return true;
}

function muteTrackWarningLayer(trackName){
  const layerKey=getLayerKeyFromTrackName(trackName);
  if(!layerKey)return;
  const activeLayers=LAYER_DEFS.filter(layer=>S.layers[layer.k]);
  if(S.layers[layerKey]&&activeLayers.length<=1){
    log('// LAYER HOLD: '+trackName+' is the last active layer','warn');
    focusLayerToggle(trackName);
    return;
  }
  S.layers[layerKey]=false;
  buildLayerToggles();
  buildLayerOctaves();
  updateGateIndicator();
  refreshGenerateButtonMicrotonalState();
  focusLayerToggle(trackName);
  log('// TRACK WARN ACTION: muted '+trackName+' for next generate','warn');
}

function focusMultiExportLayer(trackName){
  const grid=document.getElementById('meLayerGrid');
  if(!grid||!trackName)return;
  const target=[...grid.querySelectorAll('.me-layer-btn')].find(btn=>btn.dataset.layerName===trackName);
  if(!target)return;
  target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  target.classList.remove('warn-focus');
  void target.offsetWidth;
  target.classList.add('warn-focus');
  setTimeout(()=>target.classList.remove('warn-focus'),1800);
}

function logCompTuningRoutingState(){
  if(typeof CompTuningEngine==='undefined'||!CompTuningEngine.STATE)return;
  const routing=CompTuningEngine.STATE.lastAdaptiveRouting;
  if(!routing)return;
  if(routing.used)log('// COMPTUNING ROUTING: '+routing.reassignedNotes+' notes -> shadow channels '+routing.spareChannels.map(ch=>'Ch'+(ch+1)).join(' '),'ok');
  if(routing.fallbackConflicts>0)log('// COMPTUNING LIMIT: '+routing.fallbackConflicts+' collisions stayed on original channels (shadow pool '+routing.shadowPoolSize+')','warn');
  const perTrack=Object.entries(routing.trackStats||{});
  perTrack.sort((a,b)=>(b[1].fallbackConflicts-b[1].reassignedNotes)-(a[1].fallbackConflicts-a[1].reassignedNotes));
  for(const [trackName,stats] of perTrack){
    const parts=[];
    if(stats.reassignedNotes>0)parts.push(stats.reassignedNotes+' reroutes');
    if(stats.fallbackConflicts>0)parts.push(stats.fallbackConflicts+' fallback collisions');
    if(parts.length)log('// COMPTUNING TRACK '+trackName+': '+parts.join(' | '),stats.fallbackConflicts>0?'warn':'ok');
  }
}

function refreshGenerateButtonMicrotonalState(){
  const btn=document.getElementById('btnGen');
  if(!btn||btn.classList.contains('busy'))return;
  const outputInfo=getMicrotonalOutputSummary();
  const warn=!!(outputInfo&&outputInfo.warn);
  btn.classList.toggle('warn',warn);
  btn.textContent=warn?'⬡ GENERATE MIDI [12-TET]':'⬡ GENERATE MIDI';
  btn.title=outputInfo?outputInfo.detail:'';
}

buildScaleUI=function(){
  const wr=document.getElementById('scaleWrap');
  wr.innerHTML='';
  const cn=CAT_MAP[S.scaleCat]||'Modal / Diatonic';
  const cs=SCALES[cn]||{};
  const rec=GENRE_SCALES[S.genre]||[];
  const keys=Object.keys(cs);
  const sorted=[...keys.filter(k=>rec.includes(k)),...keys.filter(k=>!rec.includes(k))];
  const syncInfo=getCompTuningScaleSyncSummary();
  const outputInfo=getMicrotonalOutputSummary();
  const trackWarnInfo=getCompTuningTrackWarningSummary();
  const mitigationItems=getCompTuningMitigationSuggestions(trackWarnInfo);

  if(syncInfo||outputInfo||trackWarnInfo){
    const status=document.createElement('div');
    const isOn=!!(syncInfo&&syncInfo.on);
    const isWarn=!!((outputInfo&&outputInfo.warn)||(trackWarnInfo&&trackWarnInfo.warn));
    status.className='scale-sync-status'+(isOn?' on':'')+(isWarn?' warn':'');
    status.innerHTML='';
    if(syncInfo){
      status.innerHTML+=`<span class="scale-sync-badge">${syncInfo.mode}</span><span class="scale-sync-text">${syncInfo.detail}</span>`;
    }
    if(outputInfo){
      status.innerHTML+=`<span class="scale-output-badge${outputInfo.warn?' warn':''}">${outputInfo.mode}</span><span class="scale-sync-text">${outputInfo.detail}</span>`;
    }
    if(trackWarnInfo){
      status.innerHTML+=`<span class="scale-output-badge warn">${trackWarnInfo.mode}</span>`;
      const warnWrap=document.createElement('span');
      warnWrap.className='scale-track-warn-wrap';
      mitigationItems.forEach(mitigationInfo=>{
        const suggestChip=document.createElement('button');
        suggestChip.type='button';
        suggestChip.className='scale-track-warn-chip suggest';
        suggestChip.textContent=mitigationInfo.label;
        suggestChip.title=mitigationInfo.detail;
        suggestChip.addEventListener('click',()=>muteTrackWarningLayer(mitigationInfo.trackName));
        warnWrap.appendChild(suggestChip);
      });
      trackWarnInfo.items.forEach(item=>{
        const group=document.createElement('span');
        group.className='scale-track-warn-group';
        const chip=document.createElement('button');
        chip.type='button';
        chip.className='scale-track-warn-chip';
        chip.textContent=item.trackName+' x'+item.fallbackConflicts;
        chip.title='Multi-Export の '+item.trackName+' へ移動';
        chip.addEventListener('click',()=>focusMultiExportLayer(item.trackName));
        group.appendChild(chip);
        if(getLayerKeyFromTrackName(item.trackName)){
          const muteChip=document.createElement('button');
          muteChip.type='button';
          muteChip.className='scale-track-warn-chip action';
          muteChip.textContent='MUTE';
          muteChip.title=item.trackName+' を次回生成から一時的に無効化';
          muteChip.addEventListener('click',()=>muteTrackWarningLayer(item.trackName));
          group.appendChild(muteChip);
        }
        warnWrap.appendChild(group);
      });
      status.appendChild(warnWrap);
    }
    wr.appendChild(status);
  }

  if(S.scale&&!sorted.includes(S.scale)){
    const info=document.createElement('div');
    info.className='scale-active-info';
    let scn='';
    for(const[ck,cd] of Object.entries(CAT_MAP)) if(SCALES[cd]&&SCALES[cd][S.scale]){scn=cd;break;}
    info.textContent='▸ ACTIVE: '+S.scale+(scn?' ['+scn.split(' /')[0]+']':'');
    wr.appendChild(info);
  }

  for(const s of sorted){
    const btn=document.createElement('button');
    const isR=rec.includes(s);
    const isLinked=!!(syncInfo&&syncInfo.on&&CompTuningEngine.STATE.linkedScaleName===s);
    btn.className='s-btn'+(s===S.scale?' on':'')+(isR?' rec':'')+(isLinked?' linked':'');
    const al=SCALE_ALIASES[s];
    btn.textContent=s+(al?' ≡':'')+(MICRO_CENTS[s]?' ◈':'');
    btn.title=(cs[s]?cs[s].desc:'')+(al?' | ≡ '+al:'')+(isLinked?' | CompTuning Scale Sync ACTIVE':'');
    if(isR){
      const dot=document.createElement('div');
      dot.className='rec-dot';
      btn.appendChild(dot);
    }
    if(isLinked){
      const dot=document.createElement('div');
      dot.className='scale-link-dot';
      btn.appendChild(dot);
    }
    btn.addEventListener('click',()=>{S.scale=s;buildScaleUI();updateTheory();});
    wr.appendChild(btn);
  }
  refreshGenerateButtonMicrotonalState();
};

