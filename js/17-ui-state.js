/* ═══ UI STATE ═══ */
const S={chord:null,genre:'ambient',scale:'Dorian',bpm:58,bars:16,rootOct:3,octSpread:1,octBias:0,octLayers:[2,3,4],density:40,velocity:72,humanize:35,drift:30,dissonance:20,polyrhythm:10,scaleCat:'modal',layers:{drone:true,pad:true,arp:true,melody:true,bass:true,overtone:false,texture:false,lead:false,markov:false},midiData:null,mpe:false,pbRange:2,macroEnabled:false,curveShape:'Arch',curveAmp:70,chainEnabled:false,curveShapeB:'Ramp Down',tempoModEnabled:false,tempoDrift:8,gateBase:0.85,gateHumanize:20,eucEnabled:false,eucPulses:5,eucSteps:8,eucRotation:0,resolveThreshold:0.65,resolveSteps:2,
/* v15.0: エンジン個別ON/OFF */
engines:{pcset:true,negharmony:true,twelvetone:true,lorenz:true,ca:true,rubato:true,resolution:true,mpe:false,euclidean:false,humanizer:false,markov:false,macro:false,integralserialism:false,sieve:false,boids:false,lsystem:false,solfeggio:false,binaural:false,comptuning:false,spectral:true},isState:{durScale:1.0,velBlend:1.0,gateBlend:1.0},
/* v24.0: Multi-File Export */
layerTracks:null,conductorRaw:null,multiExport:{enabled:false,layers:{},prefix:'void',numberPad:true,includeConductor:true},oscExport:{url:'ws://127.0.0.1:7000',mode:'binary',lastStatus:'IDLE'},
/* v25.1: ランダムシード */
seed:0,seedLocked:false,
/* v25.3: A/B バリアント */
midiDataA:null,midiDataB:null,abMode:'A'};

/* ═══ SEEDED RNG (xorshift32) ═══
   rng()       : 0以上1未満の擬似乱数 (Math.random 互換)
   rngSeed(n)  : シードをセット (n=0 なら Date.now() で自動生成)
   rngState()  : 現在の内部状態を返す (再現用)
 ════════════════════════════════ */
let _rngX = 1;
function rngSeed(n) {
  _rngX = (n === 0 ? (Date.now() ^ (Date.now() >>> 16)) : n) >>> 0;
  if (_rngX === 0) _rngX = 1; // xorshift は 0 NG
}
function rng() {
  _rngX ^= _rngX << 13;
  _rngX ^= _rngX >>> 17;
  _rngX ^= _rngX << 5;
  return (_rngX >>> 0) / 4294967296;
}
function rngState() { return _rngX; }
// 初期化: seedLocked=false なら毎回ランダムシード
rngSeed(0);
const SCALE_ALIASES={'Raga Yaman':'Lydian','Lydian Dominant':'Overtone Scale','Overtone Scale':'Lydian Dominant','Messiaen Mode 1':'Whole Tone','Whole Tone':'Messiaen Mode 1','Messiaen Mode 2':'Diminished (HW)','Diminished (HW)':'Messiaen Mode 2'};

/* ═══ EUCLIDEAN VIZ ═══ */
function drawEucViz(pat){const cv=document.getElementById('euc-viz');if(!cv)return;cv.width=cv.offsetWidth;cv.height=160;const cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height);if(!pat||!pat.length)return;const n=pat.length,cX=cv.width/2,cY=cv.height/2,r=Math.min(cX,cY)-18;cx.strokeStyle='rgba(255,64,129,0.12)';cx.lineWidth=1;cx.beginPath();cx.arc(cX,cY,r,0,Math.PI*2);cx.stroke();const pos=[];for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2-Math.PI/2;pos.push({x:cX+Math.cos(a)*r,y:cY+Math.sin(a)*r,pulse:pat[i]===1});}const pp=pos.filter(p=>p.pulse);if(pp.length>1){cx.strokeStyle='rgba(255,64,129,0.3)';cx.fillStyle='rgba(255,64,129,0.04)';cx.lineWidth=1.5;cx.beginPath();pp.forEach((p,i)=>i===0?cx.moveTo(p.x,p.y):cx.lineTo(p.x,p.y));cx.closePath();cx.stroke();cx.fill();}pos.forEach(p=>{if(p.pulse){cx.shadowColor='rgba(255,64,129,0.6)';cx.shadowBlur=10;cx.fillStyle='#ff4081';cx.beginPath();cx.arc(p.x,p.y,5,0,Math.PI*2);cx.fill();cx.shadowBlur=0;}else{cx.fillStyle='rgba(255,64,129,0.2)';cx.beginPath();cx.arc(p.x,p.y,2.5,0,Math.PI*2);cx.fill();}});cx.fillStyle='rgba(255,64,129,0.35)';cx.font='7px Share Tech Mono,monospace';cx.textAlign='center';cx.textBaseline='middle';for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2-Math.PI/2;cx.fillText(i,cX+Math.cos(a)*(r+12),cY+Math.sin(a)*(r+12));}cx.fillStyle='rgba(255,64,129,0.5)';cx.font='bold 11px Share Tech Mono,monospace';cx.fillText('E('+pp.length+','+n+')',cX,cY);}

