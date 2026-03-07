function generateVoicings(pcs,cm,ms){ms=ms||22;const u=[...new Set(pcs.map(p=>((p%12)+12)%12))];if(!u.length)return[];const out=[],seen=new Set();const add=v=>{const sv=[...v].sort((a,b)=>a-b);if(sv.some(n=>n<12||n>115)||sv[sv.length-1]-sv[0]>ms)return;const k=sv.join(',');if(seen.has(k))return;seen.add(k);out.push(sv);};for(let inv=0;inv<u.length;inv++){const rot=[...u.slice(inv),...u.slice(0,inv)];let bass=Math.round((cm-Math.floor(ms/2)-rot[0])/12)*12+rot[0];while(bass<12)bass+=12;while(bass>100)bass-=12;const v=[bass];for(let i=1;i<rot.length;i++){let n=Math.floor(v[v.length-1]/12)*12+rot[i];if(n<=v[v.length-1])n+=12;v.push(n);}add(v);if(v.length>=3){const d2=[...v];d2[d2.length-2]-=12;add(d2);}if(v.length>=4){const d3=[...v];d3[d3.length-3]-=12;add(d3);}}return out;}
function vlCost(a,b){if(!a.length||!b.length)return 999;const sa=[...a].sort((x,y)=>x-y),sb=[...b].sort((x,y)=>x-y);while(sa.length<sb.length)sa.push(clampNote(sa[sa.length-1]+12));while(sb.length<sa.length)sb.push(clampNote(sb[sb.length-1]+12));return sa.reduce((s,n,i)=>s+Math.abs(n-sb[i]),0);}
function parallelPenalty(a,b){if(a.length<2||b.length<2)return 0;const n=Math.min(a.length,b.length);let p=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const iA=a[j]-a[i],iB=b[j]-b[i],mI=b[i]-a[i],mJ=b[j]-a[j];if((mI!==0||mJ!==0)&&((mI>0&&mJ>0)||(mI<0&&mJ<0))){if(iA%12===7&&iB%12===7)p+=8;if(iA%12===0&&iA!==0&&iB%12===0)p+=12;}}return p;}
function bestVoicing(prev,pcs,cm,ms,fd){ms=ms||22;fd=!!fd;const c=generateVoicings(pcs,cm,ms);if(!c.length)return prev.length?prev:[];if(!prev.length)return c.reduce((b,v)=>(v[v.length-1]-v[0])<(b[b.length-1]-b[0])?v:b);const pk=prev.join(',');const pl=fd?c.filter(v=>v.join(',')!==pk):c;if(!pl.length)return prev;let best=Infinity,bv=pl[0];for(const v of pl){const s=vlCost(prev,v)+parallelPenalty(prev,v)*.6;if(s<best){best=s;bv=v;}}return bv;}
function nearestOctave(anchor,note){const p=((note%12)+12)%12;let best=note,bd=Math.abs(note-anchor);for(let o=0;o<=9;o++){const n=o*12+p;if(n<12||n>115)continue;const d=Math.abs(n-anchor);if(d<bd){bd=d;best=n;}}return best;}

/* ═══ MACRO ═══ */
const CURVE_SHAPES={'Sine Wave':t=>.5+.5*Math.sin(t*Math.PI*2),'Double Sine':t=>.5+.25*Math.sin(t*Math.PI*2)+.25*Math.sin(t*Math.PI*4),'Ramp Up':t=>t,'Ramp Down':t=>1-t,'Arch':t=>Math.sin(t*Math.PI),'Valley':t=>1-Math.sin(t*Math.PI),'Bezier S':t=>{const t2=t*t;return 3*t2-2*t2*t;},'Plateau':t=>t<.2?t*5:t>.8?(1-t)*5:1,'Fractal Sine':t=>Math.max(0,Math.min(1,.4*Math.sin(t*Math.PI*2)+.3*Math.sin(t*Math.PI*4+.5)+.2*Math.sin(t*Math.PI*8+1)+.1)),'Exponential':t=>(Math.exp(t*3)-1)/(Math.exp(3)-1),'Logarithmic':t=>Math.log(1+t*9)/Math.log(10),'Pulse':t=>(Math.sin(t*Math.PI*6)>0)?1:.15};
function generateTensionCurve(shA,bars,amp,cOn,shB){const fA=CURVE_SHAPES[shA]||(t=>.5),fB=(cOn&&shB)?CURVE_SHAPES[shB]||fA:fA;const a=amp/100,half=Math.floor(bars/2),curve=new Float32Array(bars);for(let i=0;i<bars;i++){const fn=(cOn&&i>=half)?fB:fA;let t;if(cOn)t=i<half?(half>1?i/(half-1):0):((bars-half)>1?(i-half)/((bars-half)-1):0);else t=bars>1?i/(bars-1):0;curve[i]=Math.max(0,Math.min(1,fn(t)*a));}return curve;}
function detectSections(curve){if(!curve||curve.length<4)return[];const n=curve.length;let pB=0,pV=-1;for(let i=0;i<n;i++)if(curve[i]>pV){pV=curve[i];pB=i;}if(pV<=0)return[{bar:0,name:'INTRO'}];const avg=curve.reduce((a,v)=>a+v,0)/n,iE=Math.max(1,Math.floor(n*.15)),oS=Math.max(pB+1,Math.floor(n*.85));const s=[{bar:0,name:'INTRO'}];for(let i=iE;i<pB;i++)if(curve[i]>avg*.7){s.push({bar:i,name:'BUILD'});break;}if(pB>0)s.push({bar:pB,name:'PEAK'});for(let i=pB+1;i<oS;i++)if(curve[i]<avg){s.push({bar:i,name:'RELEASE'});break;}if(oS<n-1)s.push({bar:oS,name:'OUTRO'});return s;}
function getTension(tp,ppq,tc){if(!tc||!tc.length)return .5;return tc[Math.min(tc.length-1,Math.max(0,Math.floor(tp/(ppq*4))))];}
function modulateVel(v,t,d){return Math.max(1,Math.min(127,Math.round(v*(1+(t-.5)*2*d))));}
/* ── v14.0: Humanizer ヘルパー ─────────────────────────────
   humVelDelta: velocity ゆらぎ量（整数）を返す。
     Humanizer有効  → 1/f or Perlin ノイズ
     Humanizer無効  → rng() フォールバック（互換）
   humPosOff: MIDI tick位置のマイクロタイミングオフセット
────────────────────────────────────────────────────────── */
function humVelDelta(hum,scale,pos,total,ppq){
  // hum = humanize/100 (0-1), scale = 旧コードの*Nの値
  if(Humanizer.isEnabled()){
    const H=Humanizer.getInstance();
    let dv;
    if(Humanizer.STATE.mode==='pink') dv=H.nextPink();
    else if(Humanizer.STATE.mode==='perlin') dv=H.perlin(H.t,Humanizer.STATE.pnOct);
    else dv=rng()*2-1;
    const maxDelta=(Humanizer.STATE.velScale||0)*hum*((scale||12)/12);
    const stochastic=dv*maxDelta;
    const curve=Humanizer.velocityCurveDelta(maxDelta,pos||0,total||0,ppq||480);
    return Math.round(stochastic+curve);
  }
  return Math.round((rng()-.5)*hum*scale);
}
function humPosOff(pos,bpm,ppq,humanizePct){
  if(!Humanizer.isEnabled()||Humanizer.STATE.timScale===0)return pos;
  return Humanizer.applyTimingTick(pos,bpm,ppq,humanizePct);
}

function modulateDensity(p,t,d){return Math.max(0,Math.min(1,p*(1+(t-.5)*2*d)));}
function drawTensionCurve(curve,sections){const cv=document.getElementById('tension-cv');if(!cv)return;cv.width=cv.offsetWidth;cv.height=120;const cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height);if(!curve||!curve.length)return;const w=cv.width/curve.length,pH=cv.height*.8,pO=10;cx.strokeStyle='rgba(12,32,48,0.6)';cx.lineWidth=.5;for(let y=0;y<=4;y++){const gy=cv.height-pO-pH*y/4;cx.beginPath();cx.moveTo(0,gy);cx.lineTo(cv.width,gy);cx.stroke();}if(sections&&sections.length){const sc={INTRO:'#00e5ff',BUILD:'#ffcc00',PEAK:'#ff1744',RELEASE:'#1de9b6',OUTRO:'#8c3fff'};for(const s of sections){const x=s.bar*w;cx.strokeStyle=(sc[s.name]||'#444')+'66';cx.lineWidth=1;cx.setLineDash([3,3]);cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,cv.height);cx.stroke();cx.setLineDash([]);cx.fillStyle=(sc[s.name]||'#888')+'AA';cx.font='bold 8px Share Tech Mono,monospace';cx.textAlign='left';cx.fillText(s.name,x+3,10);}}cx.strokeStyle='#ff1744';cx.lineWidth=2;cx.beginPath();for(let i=0;i<curve.length;i++){const x=i*w+w/2,y=cv.height-pO-curve[i]*pH;i===0?cx.moveTo(x,y):cx.lineTo(x,y);}cx.stroke();cx.strokeStyle='rgba(255,23,68,0.2)';cx.lineWidth=6;cx.beginPath();for(let i=0;i<curve.length;i++){const x=i*w+w/2,y=cv.height-pO-curve[i]*pH;i===0?cx.moveTo(x,y):cx.lineTo(x,y);}cx.stroke();}

/* ═══ ATTRACTOR MAP HELPER ═══ */
/* resolveAttractorMap: attractor.normalized() の x/y/z を attractorMap に従い各効果量に変換
   Returns { velShift, pitchOff, durMod, gateMod, densityMod }
   - velShift:   velocity ± (最大±range)
   - pitchOff:   note index offset ± (最大±range)
   - durMod:     duration multiplier 1.0 ± (0 – 2.0 range)
   - gateMod:    gate multiplier 1.0 ± (0 – 0.3 range)
   - densityMod: density multiplier 1.0 ± (0 – 0.5 range) */
function resolveAttractorMap(attractor,attractorMap,velRange,pitchRange){
  if(!attractor)return{velShift:0,pitchOff:0,durMod:1,gateMod:1,densityMod:1};
  attractor.step();
  const n=attractor.normalized();
  const axes={x:n.x,y:n.y,z:n.z};
  const m=attractorMap||{mapX:'velocity',mapY:'pitch',mapZ:'gate',scaleX:0.5,scaleY:0.5,scaleZ:0.5};
  let velShift=0,pitchOff=0,durMod=1,gateMod=1,densityMod=1;
  const vr=velRange||15,pr=pitchRange||2;
  for(const ax of['x','y','z']){
    const val=axes[ax],norm=(val-64)/64; // -1…+1
    const scale=m['scale'+ax.toUpperCase()]??0.5;
    const dest=m['map'+ax.toUpperCase()]||'none';
    switch(dest){
      case'velocity':  velShift+=Math.round(norm*vr*scale);break;
      case'pitch':     pitchOff+=Math.round(norm*pr*scale);break;
      case'duration':  durMod*=(1+norm*(2.5-1)*scale);break; // 0.5-3.0 range
      case'gate':      gateMod*=(1+norm*0.3*scale);break;    // 0.7-1.3 range
      case'density':   densityMod*=(1+norm*0.5*scale);break; // 0.5-1.5 range
      default: break;
    }
  }
  return{velShift:Math.round(velShift),pitchOff:Math.round(pitchOff),durMod:Math.max(0.1,durMod),gateMod:Math.max(0.1,gateMod),densityMod:Math.max(0.1,densityMod)};
}

/* ═══ LAYER GENERATORS ═══ */
function makeDrone(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,humanize,velocity,tensionCurve,dissonance,gateBase,gateHumanize,attractor,attractorMap,lorenz,pcAnalysis,boidsResult}=p;
const _bDrn=boidsResult?.drone||null;const _bDrnVB=_bDrn?_bDrn.velocityScale:1.0;const bt=ppq*4,total=bt*bars,vB=Math.round(velocity*(genre==='dark_ambient'?.95:.8)*_bDrnVB),hum=humanize/100;const dn=[];for(const o of octLayers){const r=o*12+(rm%12),f=r+7;if(r>=12&&r<=115)dn.push({n:r,v:vB});if(f>=12&&f<=115)dn.push({n:f,v:Math.round(vB*.65)});if(genre==='drone'){const o2=r+12;if(o2<=115)dn.push({n:o2,v:Math.round(vB*.4)});}}if(genre==='dark_ambient'){const tri=rm+6;if(tri>=12&&tri<=115)dn.push({n:tri,v:Math.round(vB*.5)});}if(!dn.length)return trackBytes([tname('Drone'),pc(0,prg.drone)]);const seg=ppq*(genre==='drone'?8:genre==='ambient'?6:4);const ae=[];let c=0;while(c<total){const t=getTension(c,ppq,tensionCurve),sd=Math.min(seg,total-c);
/* Attractor: mapX/Y/Z設定に従いvel/gate等を変調 */
const _atD=resolveAttractorMap(attractor||lorenz,attractorMap,15,2);
const lVelShift=_atD.velShift;
/* PCSetEngine: IVのgate特性でサステイン長を変調
   quartal IV(4度多) → 長いドローン / chromatic IV(半音多) → 短い断片 */
const pcGateMult=PCSetEngine.gateMultiplier(pcAnalysis);
const lGateMod=_atD.gateMod*pcGateMult;
/* PCSetEngine: IVの不協和度でドローンのvelocity envelope を変調
   dissonanceScore高 → ドローンを引っ込める（padに主役を渡す） */
const pcVelScale=pcAnalysis?Math.max(0.6,1-(pcAnalysis.dissonanceScore/100)*0.35):1.0;
const gt=Math.round(calcGateTime(sd,'drone',genre,t,dissonance,gateBase,gateHumanize,sd)*lGateMod);
for(let i=0;i<dn.length;i++){ae.push({pos:c,v:[0x90,dn[i].n,Math.max(1,Math.min(127,Math.round(modulateVel(dn[i].v+humVelDelta(hum,12,c,total,ppq)+lVelShift,t,.3)*pcVelScale)))]});ae.push({pos:c+gt,v:[0x80,dn[i].n,0]});}c+=seg;}for(const cc of Humanizer.ccEvents(0,total,ppq,8))ae.push(cc);return safeAbsToTrack(ae,[tname('Drone'),pc(0,prg.drone)]);}

function makePad(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,octBias,humanize,dissonance,velocity,tensionCurve,gateBase,gateHumanize,resolveThreshold,resolveSteps,attractor,attractorMap,lorenz,ca,pcAnalysis,chordAnalysis,rootPc,boidsResult,vlVoicing,rcTracks}=p;
/* v25.6: RC ゲート — 声部1 を Pad に割り当て */
const _rcPadGates=rcTracks&&rcTracks[1]?rcTracks[1].gates:null;
const _bPad=boidsResult?.pad||null;const _bPadVB=_bPad?_bPad.velocityScale:1.0;const bt=ppq*4,total=bt*bars,vB=Math.round(velocity*(genre==='dark_ambient'?.87:.72)*_bPadVB),hum=humanize/100;const cPCs=ci.map(i=>((rm%12)+i)%12),tens=si.filter(s=>!ci.map(c=>c%12).includes(s%12)&&s!==0);const sL=[...octLayers].sort((a,b)=>a-b),mL=sL[Math.floor(sL.length/2)]||3,cM=clampNote(mL*12+(rm%12)+Math.round(octBias*6)),sMax=Math.min(28,Math.max(14,(sL[sL.length-1]-sL[0])*12+12));const seg=ppq*(genre==='ambient'||genre==='space'?4:genre==='drone'?8:2),pL=Math.max(2,Math.round(bt*4/seg));const scalePool=buildNotePool(rm,si,octLayers);DissonanceResolver.reset();const ae=[];let c=0,si2=0,cv=vlVoicing&&vlVoicing.length?[...vlVoicing]:[];while(c<total){cv=bestVoicing(cv,cPCs,cM,sMax,(si2>0)&&(si2%pL===0));const t=getTension(c,ppq,tensionCurve);
/* Attractor: mapX/Y/Z設定に従いvel等を変調 */
const _atP=resolveAttractorMap(attractor||lorenz,attractorMap,12,2);
const lVelShift=_atP.velShift;
/* CA: ゲートマトリクスで各ボイスの発音可否を制御 */
if(ca){ca.step();}
const caGM=ca?ca.gateMatrix(si2,4,4):null;
const currentBar=Math.floor(c/(ppq*4));
/* PCSetEngine: Z関係セットへのバー遷移 – 曲の1/3・2/3でPC集合が変換される */
const zTransPCs=PCSetEngine.barPCSet(currentBar,bars,pcAnalysis,rootPc||0);
/* PCSetEngine: 動的不協和係数（IVの半音・三全音比率で増幅） */
const pcDynDiss=PCSetEngine.dissonanceDynamic(pcAnalysis,t);
const ddBase=Math.max(0,Math.min(100,dissonance+(t-.5)*40));
/* Z遷移中はddをIVベースで調整 */
const dd=zTransPCs?Math.min(100,ddBase*(1+pcDynDiss*0.4)):ddBase;
const vo=[...cv];if(dd>30&&tens.length>0)vo.push(clampNote((cv.length?cv[0]:cM)+tens[0]+12));if(dd>60&&tens.length>1)vo.push(clampNote((cv.length?cv[0]:cM)+tens[1]+12));
/* Z遷移PC集合があれば、そのPCに属するノートをvoicingに追加 */
if(zTransPCs&&si2%Math.max(2,Math.floor(pL/2))===0){
  // Z関係セットのPCを現在のoctaveでvoicingに追加（最大2音）
  const zNotes=zTransPCs.map(pc=>{
    const baseNote=mL*12+pc;
    return clampNote(baseNote+(rng()<0.5?0:12));
  }).filter(n=>!vo.includes(n)).slice(0,2);
  vo.push(...zNotes);
}
let vF=[...new Set(vo)].filter(n=>n>=12&&n<=115).sort((a,b)=>a-b);if(!vF.length){c+=seg;si2++;continue;}
/* v25.6: RC ゲート — 声部1 が 0 のセグメントはスキップ */
if(_rcPadGates&&_rcPadGates.length>0&&_rcPadGates[si2%_rcPadGates.length]===0){c+=seg;si2++;continue;}
const dC=dd/100,resolved=DissonanceResolver.step(vF,dC,scalePool,resolveThreshold,resolveSteps,2);if(resolved)vF=[...new Set(resolved)].filter(n=>n>=12&&n<=115).sort((a,b)=>a-b);DissonanceResolver.update(vF,dC);
/* PCSetEngine: gate multiplier でsustain調整 */
const pcGM=PCSetEngine.gateMultiplier(pcAnalysis);
const sd=Math.min(seg,total-c),gt=Math.round(calcGateTime(sd,'pad',genre,t,dissonance,gateBase,gateHumanize,sd)*Math.max(0.7,Math.min(1.3,pcGM)));
/* CAゲートマトリクス適用: ボイスごとに発音スキップ（最低1音は保証） */
let played=0;
for(let i=0;i<vF.length;i++){const caGate=caGM?(caGM[i%4]?.[si2%4]??1):1;if(caGate===0&&played>0&&i<vF.length-1)continue;played++;ae.push({pos:c,v:[0x91,vF[i],Math.max(1,Math.min(127,modulateVel(i===0?vB+humVelDelta(hum,10,c,total,ppq)+lVelShift:Math.max(10,Math.round(vB*(1-i*.07)+humVelDelta(hum,8,c,total,ppq)+lVelShift*.5)),t,.35)))]});ae.push({pos:c+gt,v:[0x81,vF[i],0]});}c+=seg;si2++;}for(const cc of Humanizer.ccEvents(0,total,ppq,6))ae.push(cc);return safeAbsToTrack(ae,[tname('Pad'),pc(1,prg.pad)]);}

function makeArp(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,octBias,density,drift,humanize,polyrhythm,velocity,tensionCurve,dissonance,gateBase,gateHumanize,eucPattern,attractor,attractorMap,lorenz,ca,rubatoDelta,ttForms,pcAnalysis,isInst,isState,sievePattern,sieveScale,boidsResult,rcTracks}=p;
/* v25.6: RC ゲート — 声部0 を Arp に割り当て (eucPattern より優先) */
const _rcArpGates=rcTracks&&rcTracks[0]?rcTracks[0].gates:null;
/* Boids: Arp */
const _bArp=boidsResult?.arp||null;const _bArpVB=_bArp?_bArp.velocityScale:1.0;const _bArpOB=_bArp?_bArp.octBiasShift:0;const _bArpGS=_bArp?_bArp.gateScale:1.0;const bt=ppq*4,total=bt*bars,hum=humanize/100,vB=Math.round(velocity*.94*_bArpVB);/* Sieve Scale: sieveScaleがある場合はスケールインターバルを上書き */
const effectiveSI=(sieveScale&&sieveScale.length)?sieveScale:si;
const pool=buildNotePool(rm,effectiveSI,octLayers),cp=[];for(const o of octLayers)for(const i of ci){const n=o*12+(rm%12)+i;if(n>=12&&n<=115)cp.push(n);}cp.sort((a,b)=>a-b);if(!pool.length&&!cp.length)return trackBytes([tname('Arpeggio'),pc(2,prg.arp)]);const steps={ambient:[ppq*2,ppq*3,ppq*4,ppq*6],drone:[ppq*4,ppq*6,ppq*8],dark_ambient:[ppq,Math.round(ppq*1.5),ppq*2],psychedelic:[Math.round(ppq*.5),ppq,Math.round(ppq*1.5),ppq*2],space:[ppq*3,ppq*4,ppq*6,ppq*8],ritual:[Math.round(ppq*.5),ppq,ppq*2],kosmische:[ppq,ppq*2,ppq*3],noise:[Math.round(ppq*.25),Math.round(ppq*.5),ppq]}[genre]||[ppq*2];const pS=[Math.round(ppq*4/3),Math.round(ppq*2/3),Math.round(ppq*8/3)];const prob=density/100,pP=polyrhythm/100;
/* TwelveTone: bars を4分割してP→R→I→RI とフォームを段階切替 */
const ttFormKeys=['P','R','I','RI'];
function getTTPool(basePool,bar){
  if(!ttForms)return basePool;
  const formKey=ttFormKeys[Math.floor(bar/(Math.max(1,bars)/4))%4];
  const form=ttForms[formKey];
  // formのインターバル順でpoolをソートし直す（音高は維持）
  const pcs=form.map(pc=>((pc%12)+12)%12);
  return [...basePool].sort((a,b)=>{
    const ai=pcs.indexOf(((a%12)+12)%12);
    const bi=pcs.indexOf(((b%12)+12)%12);
    return(ai<0?99:ai)-(bi<0?99:bi);
  });
}
const ae=[];let c=0,pi=0,dir=1,la,eI=0,stepCount=0;
while(c<total){
  const currentBar=Math.floor(c/(ppq*4));
  const uP=rng()<pP,sA=uP?pS:steps;
  /* Rubato: ステップ長をrubataDeltaで変調（70%ベース＋30%Rubato） */
  const baseStep=sA[Math.floor(rng()*sA.length)];
  const rubatoStep=rubatoDelta?(rubatoDelta[stepCount%rubatoDelta.length]||baseStep):baseStep;
  const step=Math.round(baseStep*0.65+rubatoStep*0.35);
  stepCount++;
  const t=getTension(c,ppq,tensionCurve),dp=modulateDensity(prob,t,.5);
  let eA=true;
  if(_rcArpGates&&_rcArpGates.length>0){eA=_rcArpGates[eI%_rcArpGates.length]===1;eI++;}
  else if(eucPattern&&eucPattern.length>0){eA=eucPattern[eI%eucPattern.length]===1;eI++;}
  /* Sieve Rhythm: sievePatternがある場合はEuclideanより優先（または合成） */
  else if(sievePattern&&sievePattern.length>0){eA=sievePattern[eI%sievePattern.length]===1;eI++;}
  /* CA: Euclidean未使用時はCAゲートでノート発音を制御 */
  let caA=true;
  if(!_rcArpGates&&!eucPattern&&ca){ca.step();const caPos=Math.floor(c/ppq)%ca.width;caA=ca.grid[caPos]===1||rng()<0.25;}
  if(eA&&caA&&rng()<dp){
    /* Attractor: mapX/Y/Z設定に従いvel/pitchOffset等を変調 */
    const _atA=resolveAttractorMap(attractor||lorenz,attractorMap,18,2);
    const lVelShift=_atA.velShift;
    const lIdxOffset=_atA.pitchOff; // ±2音のずれ
    const uc=rng()<.55;
    /* TwelveTone: barに応じてpool順序を変換 */
    const ttPool=getTTPool(pool.length>0?pool:cp,currentBar);
    /* PCSetEngine: IVの特性でpool参照順序をさらに再整列
       (TwelveToneがbar全体の構造変化、PCSetEngineが音程キャラクターを決定) */
    const pcPool=PCSetEngine.poolOrder(ttPool.length>0?ttPool:cp,pcAnalysis);
    let src=uc&&cp.length>0?cp:pcPool.length>0?pcPool:cp;
    if(!src.length){c+=step;continue;}
    let note;
    const pat={ambient:'up',drone:'chord',dark_ambient:'random',psychedelic:'random',space:'up_down',ritual:'up',kosmische:'up_down',noise:'random'}[genre]||'up';
    if(pat==='up'){note=src[((pi+lIdxOffset)%src.length+src.length)%src.length];pi++;}
    else if(pat==='up_down'){note=src[Math.max(0,Math.min(src.length-1,pi+lIdxOffset))];pi+=dir;if(pi>=src.length-1){dir=-1;pi=src.length-1;}else if(pi<=0){dir=1;pi=0;}}
    else if(pat==='chord')note=src[Math.floor(rng()*Math.min(4,src.length))];
    else note=src[((Math.floor(rng()*src.length)+lIdxOffset)%src.length+src.length)%src.length];
    if(rng()<drift/100)note=clampNote(note+(rng()<.5?12:-12)*Math.ceil(rng()*2));
    note=clampNote(note+Math.round((octBias+_bArpOB)*6));
    if(la!==undefined)note=nearestOctave(la,note);la=note;
    /* IS: Duration / Velocity / Gate を音列で支配 */
    let isV=null;
    if(isInst&&IntegralSerialism.isActive(isInst)){isV=isInst.next();}
    const isVelBlend=isState?isState.velBlend:1.0;
    const isGateBlend=isState?isState.gateBlend:1.0;
    const isDurScale=isState?isState.durScale:1.0;
    /* Duration: IS音価 vs ステップ長をblendで混合 */
    const iStep=isV?Math.round(isV.durationTick*isDurScale):step;
    const finalStep=isV?Math.round(step*(1-isGateBlend)+iStep*isGateBlend):step;
    const mg=Math.min(finalStep,total-c);
    /* Gate: IS gateRatioで上書き（blendで強度調整） */
    const baseGt=Math.round(calcGateTime(finalStep,'arp',genre,t,dissonance,gateBase,gateHumanize,mg)*_bArpGS);
    const isGt=isV?Math.round(finalStep*isV.gateRatio):baseGt;
    const gt=Math.round(baseGt*(1-isGateBlend)+isGt*isGateBlend);
    /* Velocity: IS velocityで上書き（blendで強度調整） */
    const baseVel=Math.max(1,Math.min(127,modulateVel(Math.round(vB+humVelDelta(hum,30,c,total,ppq))+lVelShift,t,.4)));
    const isVel=isV?isV.velocity:baseVel;
    const finalVel=Math.max(1,Math.min(127,Math.round(baseVel*(1-isVelBlend)+isVel*isVelBlend)));
    ae.push({pos:c,v:[0x92,note,finalVel]});
    ae.push({pos:c+Math.max(1,Math.min(mg,gt)),v:[0x82,note,0]});
    /* ISがアクティブな場合はIS音価でステップ進行、そうでなければ通常ステップ */
    if(isV){c+=Math.max(1,finalStep);continue;}
  }c+=step;}return safeAbsToTrack(ae,[tname('Arpeggio'),pc(2,prg.arp)]);}

function makeMelody(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,octBias,density,drift,humanize,velocity,tensionCurve,dissonance,gateBase,gateHumanize,eucPattern,attractor,attractorMap,lorenz,rubatoDelta,ttForms,pcAnalysis,isInst,isState,sievePattern,sieveScale,boidsResult}=p;
/* Boids: Melody */
const _bMel=boidsResult?.melody||null;const _bMelVB=_bMel?_bMel.velocityScale:1.0;const _bMelOB=_bMel?_bMel.octBiasShift:0;const _bMelGS=_bMel?_bMel.gateScale:1.0;const bt=ppq*4,total=bt*bars,hum=humanize/100,vB=Math.round(velocity*_bMelVB);/* Sieve Scale: Melody にも適用 */
const effectiveSI_mel=(sieveScale&&sieveScale.length)?sieveScale:si;
const sL=[...octLayers].sort((a,b)=>b-a).slice(0,2),pool=[];for(const o of sL)for(const i of effectiveSI_mel){const n=o*12+(rm%12)+i;if(n>=12&&n<=115)pool.push(n);}pool.sort((a,b)=>a-b);if(!pool.length)return trackBytes([tname('Melody'),pc(3,prg.melody)]);const nD=(density*.35)/100;
/* TwelveTone: Melodyはフォームをよりゆっくり切替（曲を半分で1回転） */
const ttMelFormKeys=['P','I','R','RI'];
const ae=[];let c=0,pi=Math.floor(pool.length/2),lm,eI=0,stepCount=0;
while(c<total){
  const currentBar=Math.floor(c/(ppq*4));
  /* Rubato: メロディのステップ長を変調 */
  const baseStep=bt*(rng()<.3?2:1);
  const rubatoStep=rubatoDelta?(rubatoDelta[stepCount%rubatoDelta.length]||baseStep):baseStep;
  const step=Math.round(baseStep*0.55+rubatoStep*0.45);
  stepCount++;
  const t=getTension(c,ppq,tensionCurve);
  let eA=true;
  if(eucPattern&&eucPattern.length>0){eA=eucPattern[eI%eucPattern.length]===1;eI++;}
  /* Sieve Rhythm: sievePatternがある場合はEuclideanより優先（または合成） */
  else if(sievePattern&&sievePattern.length>0){eA=sievePattern[eI%sievePattern.length]===1;eI++;}
  if(eA&&rng()<modulateDensity(nD,t,.5)){
    /* TwelveTone: バーに応じてpool並び替え */
    let orderedPool=pool;
    if(ttForms){
      const fk=ttMelFormKeys[Math.floor(currentBar/(Math.max(1,bars)/4))%4];
      const form=ttForms[fk];
      const pcs=form.map(pc=>((pc%12)+12)%12);
      orderedPool=[...pool].sort((a,b)=>{
        const ai=pcs.indexOf(((a%12)+12)%12);
        const bi=pcs.indexOf(((b%12)+12)%12);
        return(ai<0?99:ai)-(bi<0?99:bi);
      });
    }
    /* PCSetEngine: IVのキャラクターで音程跳躍の優先度を調整
       TwelveTone→曲全体の構造変化、PCSetEngine→IV音程キャラクターの音色変化 */
    orderedPool=PCSetEngine.poolOrder(orderedPool,pcAnalysis);
    /* Attractor: mapX/Y/Z設定に従いvel/pitchOffset等を変調 */
    const _atM=resolveAttractorMap(attractor||lorenz,attractorMap,14,2);
    const lVelShift=_atM.velShift;
    const lJump=_atM.pitchOff; // ±1.5のジャンプ幅補正
    let idx=Math.max(0,Math.min(orderedPool.length-1,pi+Math.round((rng()-.5)*4)+lJump));
    if(rng()<drift*.004)idx=Math.max(0,Math.min(orderedPool.length-1,Math.round(idx+(rng()<.5?8:-8))));
    let note=clampNote(orderedPool[idx]+Math.round(octBias*5));
    if(lm!==undefined)note=nearestOctave(lm,note);lm=note;
    /* IS: Melody の Duration / Velocity / Gate を音列で支配 */
    let isV=null;
    if(isInst&&IntegralSerialism.isActive(isInst)){isV=isInst.next();}
    const isVelBlend=isState?isState.velBlend:1.0;
    const isGateBlend=isState?isState.gateBlend:1.0;
    const isDurScale=isState?isState.durScale:1.0;
    const iStep=isV?Math.round(isV.durationTick*isDurScale):step;
    const finalStep=isV?Math.round(step*(1-isGateBlend)+iStep*isGateBlend):step;
    const mg=Math.min(finalStep,total-c);
    const baseGt=Math.round(calcGateTime(finalStep,'melody',genre,t,dissonance,gateBase,gateHumanize,mg)*_bMelGS);
    const isGt=isV?Math.round(finalStep*isV.gateRatio):baseGt;
    const gt=Math.round(baseGt*(1-isGateBlend)+isGt*isGateBlend);
    const baseVel=Math.max(1,Math.min(127,modulateVel(Math.round(vB+humVelDelta(hum,28,c,total,ppq))+lVelShift,t,.35)));
    const isVel=isV?isV.velocity:baseVel;
    const finalVel=Math.max(1,Math.min(127,Math.round(baseVel*(1-isVelBlend)+isVel*isVelBlend)));
    ae.push({pos:c,v:[0x93,note,finalVel]});
    ae.push({pos:c+Math.max(1,Math.min(mg,gt)),v:[0x83,note,0]});
    pi=idx;
    if(isV){c+=Math.max(1,finalStep);continue;}
  }c+=step;}return safeAbsToTrack(ae,[tname('Melody'),pc(3,prg.melody)]);}

function makeBass(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,humanize,velocity,tensionCurve,dissonance,gateBase,gateHumanize}=p;const bt=ppq*4,total=bt*bars,hum=humanize/100;const sL=[...octLayers].sort((a,b)=>a-b),rP=rm%12;let bO=Math.max(0,sL[0]-1);if(bO*12+rP<12)bO++;const bR=Math.min(115,bO*12+rP),bF=Math.min(115,bR+7),bT=Math.min(115,bR+(ci.includes(3)?3:4)),bV=Math.min(127,Math.round(velocity*(genre==='dark_ambient'?1.08:.94)));const ae=[];if(genre==='ritual'||genre==='noise'){for(let bar=0;bar<bars;bar++){const pos=bar*bt,t=getTension(pos,ppq,tensionCurve),mg=Math.min(ppq,total-pos),gt=calcGateTime(ppq,'bass',genre,t,dissonance,gateBase,gateHumanize,mg);ae.push({pos,v:[0x94,bR,modulateVel(bV+humVelDelta(hum,12,pos,total,ppq),t,.25)]});ae.push({pos:pos+gt,v:[0x84,bR,0]});if(bar%2===0){const p2=pos+ppq*2,m2=Math.min(ppq,total-p2);if(m2>0){const g2=calcGateTime(ppq,'bass',genre,t,dissonance,gateBase,gateHumanize,m2);ae.push({pos:p2,v:[0x94,bF,modulateVel(bV-10+humVelDelta(hum,8,p2,total,ppq),t,.25)]});ae.push({pos:p2+g2,v:[0x84,bF,0]});}}}}else{const seg=bt*(genre==='ambient'||genre==='space'?4:2),seq=[bR,bR,bF,bR,bT,bR,bF,bR];let si2=0,c=0;while(c<total){const note=seq[si2%seq.length];si2++;const t=getTension(c,ppq,tensionCurve),sd=Math.min(seg,total-c),gt=calcGateTime(sd,'bass',genre,t,dissonance,gateBase,gateHumanize,sd);ae.push({pos:c,v:[0x94,note,modulateVel(bV+humVelDelta(hum,10,c,total,ppq),t,.25)]});ae.push({pos:c+gt,v:[0x84,note,0]});c+=seg;}}return safeAbsToTrack(ae,[tname('Bass'),pc(4,prg.bass)]);}

function makeOvertone(rm,ci,si,p,prg){const{ppq,bars,octLayers,velocity,genre,tensionCurve,dissonance,gateBase,gateHumanize,spectralAnalysis}=p;const bt=ppq*4,total=bt*bars,vB=Math.round(velocity*.83);const sL=[...octLayers].sort((a,b)=>a-b),bR=(sL[0]||3)*12+(rm%12);const fallbackOffsets=[0,12,19,24,28,31,34,36,38,40,42,43,45,46,47,48];const tuningA4=(typeof CompTuningEngine!=='undefined'&&CompTuningEngine.STATE&&CompTuningEngine.STATE.a4Hz)?CompTuningEngine.STATE.a4Hz:440;const harmonicPlan=(spectralAnalysis&&typeof SpectralHarmonyEngine!=='undefined')?SpectralHarmonyEngine.overtoneChord(SpectralHarmonyEngine.midiToFreq(bR,tuningA4),spectralAnalysis.partials.map(partial=>partial.harmonic),tuningA4,{rootMidi:bR,chordSize:Math.min(6,Math.max(3,Math.round((spectralAnalysis.harmonicDensity||0.5)*4)+2)),minMidi:bR,maxMidi:112,resonantPCs:spectralAnalysis.resonantPCs||[],chordPCs:[rm%12,...ci.map(interval=>((rm+interval)%12+12)%12)],brightness:spectralAnalysis.brightnessScore||0,spread:Math.max(0.2,Math.min(1,0.3+(spectralAnalysis.brightnessScore||0)*0.45+(SPECTRAL_PARAMS.brightnessBoost||0)*0.2))}):null;const voices=(harmonicPlan&&harmonicPlan.voices&&harmonicPlan.voices.length)?harmonicPlan.voices:fallbackOffsets.map((offset,index)=>({note:bR+offset,harmonic:index+1})).filter(voice=>voice.note<=112);const ae=[];for(let hi=0;hi<voices.length;hi++){const voice=voices[hi];const n=voice.note;if(n>112)break;const harmIdx=Math.max(0,(voice.harmonic||hi+1)-1);/* Spectral Harmony: 倍音列から抽出した和声音を Overtone レイヤーへ反映 */const baseV=Math.max(8,Math.round(vB-hi*6-Math.max(0,n-bR)*0.18));const vel=(spectralAnalysis&&SPECTRAL_PARAMS.velShape)?SpectralEngine.shapeVelocity(Math.round(baseV),harmIdx,SPECTRAL_PARAMS):Math.round(baseV);const notePos=Math.round(hi*(bt/Math.max(1,voices.length)));const t=getTension(notePos,ppq,tensionCurve);const gt=calcGateTime(total-notePos,'overtone',genre,t,dissonance,gateBase,gateHumanize,total-notePos);ae.push({pos:notePos,v:[0x95,n,Math.max(1,Math.min(127,modulateVel(vel,t,.3)))]});ae.push({pos:notePos+gt,v:[0x85,n,0]});}return safeAbsToTrack(ae,[tname('Overtones'),pc(5,prg.overtone)]);}

function makeTexture(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,octBias,density,humanize,velocity,tensionCurve,dissonance,gateBase,gateHumanize,eucPattern,attractor,attractorMap,lorenz,ca,pcAnalysis,boidsResult,spectralAnalysis}=p;
const _bTex=boidsResult?.texture||null;const _bTexVB=_bTex?_bTex.velocityScale:1.0;const _bTexRS=_bTex?_bTex.registerOffset:0;const _bTexGS=_bTex?_bTex.gateScale:1.0;const bt=ppq*4,total=bt*bars,hum=humanize/100,vB=Math.round(velocity*.69*_bTexVB);const pool=buildNotePool(rm,si,octLayers);if(!pool.length)return trackBytes([tname('Texture'),pc(6,prg.texture)]);const prob=(density*.5)/100,sB=ppq*(genre==='noise'?.25:genre==='ritual'?.5:1);
/* Spectral: 共鳴PCセットを事前計算 */
const resonantPCSet=new Set(spectralAnalysis&&SPECTRAL_PARAMS.textureFilter?spectralAnalysis.resonantPCs:[]);
const ae=[];let c=0,eI=0;while(c<total){const t=getTension(c,ppq,tensionCurve);let eA=true;if(eucPattern&&eucPattern.length>0){eA=eucPattern[eI%eucPattern.length]===1;eI++;}
/* CA: Euclidean未使用時にCAゲートを使用 */
let caA=true;if(!eucPattern&&ca){ca.step();const caPos=Math.floor(c/sB)%ca.width;caA=ca.grid[caPos]===1||rng()<0.15;}
/* Attractor: mapX/Y/Z設定に従いvel/duration等を変調 */
const _atT=resolveAttractorMap(attractor||lorenz,attractorMap,16,2);
const lVelShift=_atT.velShift;
const lDurMod=_atT.durMod; // 0.1〜3.0倍の音価変調（テクスチャの密度感）
/* PCSetEngine: IVのキャラクターでテクスチャのnoteをIV優先順から選ぶ */
const pcOrderedPool=PCSetEngine.poolOrder(pool,pcAnalysis);
if(eA&&caA&&rng()<modulateDensity(prob,t,.6)){
  // PCSetEngineで整列されたpoolから選択（IV支配音程を優先）
  const note=pickWithBias(pcOrderedPool.length>0?pcOrderedPool:pool,octBias);
  /* Spectral Texture Filter: 非共鳴PCを確率的に抑制 */
  const notePc=((note%12)+12)%12;
  const isResonant=resonantPCSet.size===0||resonantPCSet.has(notePc);
  const consonancePass=!spectralAnalysis||(SpectralEngine.consonanceScore(notePc,rm%12)>=SPECTRAL_PARAMS.consonanceGate);
  if(!isResonant&&!consonancePass&&rng()<0.6){c+=Math.round(sB*(1+rng()*2));continue;}
  const rawDur=Math.round(sB*(lDurMod+rng())),mg=Math.min(rawDur,total-c),gt=calcGateTime(rawDur,'texture',genre,t,dissonance,gateBase,gateHumanize,mg);
  ae.push({pos:c,v:[0x96,clampNote(note+_bTexRS),Math.max(1,Math.min(127,modulateVel(Math.round(vB+humVelDelta(hum,30,c,total,ppq))+lVelShift,t,.4)))]});
  ae.push({pos:c+gt,v:[0x86,clampNote(note+_bTexRS),0]});
}c+=Math.round(sB*(1+rng()*2));}return safeAbsToTrack(ae,[tname('Texture'),pc(6,prg.texture)]);}

function makeLead(rm,ci,si,p,prg){const{ppq,bars,genre,octLayers,octBias,density,drift,humanize,velocity,tensionCurve,dissonance,gateBase,gateHumanize,eucPattern,attractor,attractorMap,lorenz,rubatoDelta,ttForms,pcAnalysis,isInst,isState,sievePattern,sieveScale,boidsResult}=p;
/* Boids: Lead */
const _bLead=boidsResult?.lead||null;const _bLeadVB=_bLead?_bLead.velocityScale:1.0;const _bLeadOB=_bLead?_bLead.octBiasShift:0;const _bLeadGS=_bLead?_bLead.gateScale:1.0;const bt=ppq*4,total=bt*bars,hum=humanize/100,vB=Math.round(velocity*1.04*_bLeadVB);/* Sieve Scale: Lead にも適用 */const effectiveSI_lead=(sieveScale&&sieveScale.length)?sieveScale:si;const lO=([...octLayers].sort((a,b)=>b-a))[0]||5,pool=[];for(const i of effectiveSI_lead){const n=lO*12+(rm%12)+i;if(n>=12&&n<=115)pool.push(n);}pool.sort((a,b)=>a-b);if(!pool.length)return trackBytes([tname('Lead'),pc(7,prg.lead)]);const prob=(density*.3)/100;
const ttLeadFormKeys=['P','RI','I','R']; // Leadは逆順でフォーム変化
const ae=[];let c=0,idx=Math.floor(pool.length/2),ll,eI=0,stepCount=0;while(c<total){
  const currentBar=Math.floor(c/(ppq*4));
  /* Rubato: Leadのステップ長変調 */
  const baseStep=ppq*(1+Math.floor(rng()*3));
  const rubatoStep=rubatoDelta?(rubatoDelta[stepCount%rubatoDelta.length]||baseStep):baseStep;
  const step=Math.round(baseStep*0.6+rubatoStep*0.4);
  stepCount++;
  const t=getTension(c,ppq,tensionCurve);
  let eA=true;if(eucPattern&&eucPattern.length>0){eA=eucPattern[eI%eucPattern.length]===1;eI++;}
  /* Sieve Rhythm: Lead にも適用 */
  else if(sievePattern&&sievePattern.length>0){eA=sievePattern[eI%sievePattern.length]===1;eI++;}
  if(eA&&rng()<modulateDensity(prob,t,.5)){
    /* TwelveTone: Lead pool順序変換 */
    let orderedPool=pool;
    if(ttForms){
      const fk=ttLeadFormKeys[Math.floor(currentBar/(Math.max(1,bars)/4))%4];
      const form=ttForms[fk];
      const pcs=form.map(pc=>((pc%12)+12)%12);
      orderedPool=[...pool].sort((a,b)=>{const ai=pcs.indexOf(((a%12)+12)%12);const bi=pcs.indexOf(((b%12)+12)%12);return(ai<0?99:ai)-(bi<0?99:bi);});
    }
    /* PCSetEngine: IVキャラクターでLeadの音程選択を整列 */
    orderedPool=PCSetEngine.poolOrder(orderedPool,pcAnalysis);
    /* Attractor: mapX/Y/Z設定に従いvel/pitchOffset等を変調 */
    const _atL=resolveAttractorMap(attractor||lorenz,attractorMap,15,2);
    const lVelShift=_atL.velShift;
    const lIdxOff=_atL.pitchOff;
    idx=Math.max(0,Math.min(orderedPool.length-1,idx+Math.round((rng()-.5)*6)+lIdxOff));
    let note=clampNote(orderedPool[idx]+Math.round(octBias*5));
    if(ll!==undefined)note=nearestOctave(ll,note);ll=note;
    /* IS: Lead の Duration / Velocity / Gate を音列で支配 */
    let isV=null;
    if(isInst&&IntegralSerialism.isActive(isInst)){isV=isInst.next();}
    const isVelBlend=isState?isState.velBlend:1.0;
    const isGateBlend=isState?isState.gateBlend:1.0;
    const isDurScale=isState?isState.durScale:1.0;
    const iStep=isV?Math.round(isV.durationTick*isDurScale):step;
    const finalStep=isV?Math.round(step*(1-isGateBlend)+iStep*isGateBlend):step;
    const mg=Math.min(finalStep,total-c);
    const baseGt=Math.round(calcGateTime(finalStep,'lead',genre,t,dissonance,gateBase,gateHumanize,mg)*_bLeadGS);
    const isGt=isV?Math.round(finalStep*isV.gateRatio):baseGt;
    const gt=Math.round(baseGt*(1-isGateBlend)+isGt*isGateBlend);
    const baseVel=Math.max(1,Math.min(127,modulateVel(Math.round(vB+humVelDelta(hum,25,c,total,ppq))+lVelShift,t,.4)));
    const isVel=isV?isV.velocity:baseVel;
    const finalVel=Math.max(1,Math.min(127,Math.round(baseVel*(1-isVelBlend)+isVel*isVelBlend)));
    ae.push({pos:c,v:[0x97,note,finalVel]});
    ae.push({pos:c+Math.max(1,Math.min(mg,gt)),v:[0x87,note,0]});
    if(isV){c+=Math.max(1,finalStep);continue;}
  }c+=step;}return safeAbsToTrack(ae,[tname('Lead'),pc(7,prg.lead)]);}

