function parseChord(str){if(!str||!str.trim())return null;str=str.trim().replace(/\u266d/g,'b').replace(/\u266f/g,'#').replace(/[()]/g,'');let i=0;let rs=str[0].toUpperCase();i=1;if(i<str.length&&(str[i]==='#'||str[i]==='b')){rs+=str[i];i++;}const rn=ALIASES[rs]||rs;const ri=NN.indexOf(rn);if(ri<0)return null;let qual=str.substring(i).trim();const si=qual.lastIndexOf('/');if(si>=0&&/[A-Ga-g]/.test(qual[si+1]||''))qual=qual.substring(0,si);const keys=Object.keys(CHORDS).sort((a,b)=>b.length-a.length);for(const k of keys){if(qual===k)return{root:ri,rootName:rs,quality:k,iv:CHORDS[k].iv,name:CHORDS[k].name};}for(const k of keys){if(k!==''&&qual.startsWith(k))return{root:ri,rootName:rs,quality:k,iv:CHORDS[k].iv,name:CHORDS[k].name};}return null;}
function nn(n){return NN[((n%12)+12)%12];}
function chordNotes(root,iv){return iv.map(i=>((root+i)%12+12)%12);}
function scaleNotes(root,iv){return iv.map(i=>((root+i)%12+12)%12);}
const INAMES={0:'R',1:'b2',2:'2',3:'b3',4:'3',5:'4',6:'b5',7:'5',8:'b6',9:'6',10:'b7',11:'7',12:'8va',13:'b9',14:'9',15:'#9',16:'b10',17:'11',18:'#11',19:'b12',20:'12',21:'13',22:'b14',23:'14',24:'15va',25:'b16',26:'16'};

/* ═══ MIDI CORE ═══ */
function vl(v){v=Math.max(0,v);const b=[];b.unshift(v&0x7F);v>>=7;while(v>0){b.unshift((v&0x7F)|0x80);v>>=7;}return b;}
function trackChunk(d){const l=d.length;return[0x4D,0x54,0x72,0x6B,(l>>24)&0xFF,(l>>16)&0xFF,(l>>8)&0xFF,l&0xFF,...d];}
function trackBytes(evs){const b=[];for(let e of evs){b.push(...vl(e.d));b.push(...e.v);}b.push(0,0xFF,0x2F,0);return b;}
const pc=(ch,p,d=0)=>({d,v:[0xC0|ch,p]});
const tname=s=>{const b=[...s].map(c=>c.charCodeAt(0));return{d:0,v:[0xFF,0x03,b.length,...b]};};
function safeAbsToTrack(ae,hdr){ae.sort((a,b)=>{if(a.pos!==b.pos)return a.pos-b.pos;return((a.v[0]&0xF0)===0x80?0:1)-((b.v[0]&0xF0)===0x80?0:1);});let pp=0;const f=[...hdr];for(const e of ae){f.push({d:Math.max(0,e.pos-pp),v:e.v});pp=e.pos;}return trackBytes(f);}

function buildConductorTrack(bpm,ppq,bars,tc,tOn,tDr,secs){const bt=ppq*4,pool=[];const t0=Math.round(60000000/bpm);const tb={tick:0,bytes:[0xFF,0x51,3,(t0>>16)&0xFF,(t0>>8)&0xFF,t0&0xFF]};pool.push(tb);if(secs&&secs.length)for(const s of secs){const tk=s.bar*bt;const nm=[...s.name].map(c=>c.charCodeAt(0));pool.push({tick:Math.max(1,tk),bytes:[0xFF,0x06,nm.length,...nm]});}if(tOn&&tc&&tc.length>0)for(let bar=0;bar<bars;bar++){const tk=bar*bt;const t=tc[bar]!=null?tc[bar]:.5;const bB=Math.max(15,Math.min(200,Math.round(bpm+(t-.5)*2*tDr)));const us=Math.round(60000000/bB);if(bar===0)tb.bytes=[0xFF,0x51,3,(us>>16)&0xFF,(us>>8)&0xFF,us&0xFF];else pool.push({tick:tk,bytes:[0xFF,0x51,3,(us>>16)&0xFF,(us>>8)&0xFF,us&0xFF]});}pool.sort((a,b)=>a.tick-b.tick);const raw=[];let pv=0;for(const ev of pool){raw.push(...vl(ev.tick-pv),...ev.bytes);pv=ev.tick;}raw.push(0,0xFF,0x2F,0);return raw;}

function extractTrackName(trackData){const data=Array.from(trackData||[]);let p=0;while(p<data.length){let delta=0;while(p<data.length){const b=data[p++];delta=(delta<<7)|(b&0x7F);if(!(b&0x80))break;}if(p>=data.length)break;const status=data[p++];if(status!==0xFF){const hi=status&0xF0;p+=(hi===0xC0||hi===0xD0)?1:2;continue;}const metaType=data[p++];let len=0;while(p<data.length){const b=data[p++];len=(len<<7)|(b&0x7F);if(!(b&0x80))break;}const payload=data.slice(p,p+len);p+=len;if(metaType===0x03&&payload.length)return String.fromCharCode(...payload);if(metaType===0x2F)break;}return'';}

/* ─── Compensation Tuning: MIDI全体への適用 ────────────
   writeMIDI後のUint8Arrayを受け取り、全トラックに
   CompTuningEngineの補正を適用して返す。
   また conductor track 先頭にSysExを追加する。
────────────────────────────────────────────────────── */
function applyCompensationTuningToMidi(midiData, pbRange) {
  if (!CompTuningEngine.STATE.enabled) return midiData;
  if (!window.__MEIKY_ALLOW_COMP_SECTION_INTERNAL__ &&
      typeof S !== 'undefined' && S && S.compSectionPreTuned) {
    return midiData;
  }
  if (CompTuningEngine.STATE.enabled &&
      Number.isFinite(CompTuningEngine.STATE.pbRange) &&
      CompTuningEngine.STATE.pbRange > 0) {
    pbRange = CompTuningEngine.STATE.pbRange;
  }

  const data = Array.from(midiData);
  // SMF header: 14 bytes
  const numTracks = (data[10] << 8) | data[11];
  const ppq = (data[12] << 8) | data[13];
  const CT = CompTuningEngine;
  const masterCents = CT.a4ToCents(CT.STATE.a4Hz) + CT.STATE.globalCents;
  const rawTracks = [];

  let p = 14;
  const newTracks = [];

  for (let t = 0; t < numTracks; t++) {
    if (p + 8 > data.length) break;
    // MTrk header: 8 bytes
    const sig = String.fromCharCode(data[p],data[p+1],data[p+2],data[p+3]);
    const len = (data[p+4]<<24)|(data[p+5]<<16)|(data[p+6]<<8)|data[p+7];
    p += 8;
    const trackData = data.slice(p, p+len);
    p += len;
    rawTracks.push(trackData);
  }

  const globallyUsedChannels = new Set();
  for (let t = 1; t < rawTracks.length; t++) {
    parseMidiTrackData(rawTracks[t]).forEach(ev => globallyUsedChannels.add(ev.origCh));
  }
  const preferredSpareChannels = [...CT.STATE.channels].filter(ch => !globallyUsedChannels.has(ch)).sort((a, b) => a - b);
  const extendedShadowPriority = [15,14,13,12,11,10,8,7,6,5,4,3,2,1,0];
  const extendedSpareChannels = Array.from({ length: 16 }, (_, ch) => ch)
    .filter(ch => ch !== 9 && !globallyUsedChannels.has(ch) && !preferredSpareChannels.includes(ch))
    .sort((a, b) => extendedShadowPriority.indexOf(a) - extendedShadowPriority.indexOf(b));
  const spareChannels = [...preferredSpareChannels, ...extendedSpareChannels];
  CT.STATE.lastAdaptiveRouting = { used: false, reassignedNotes: 0, fallbackConflicts: 0, spareChannels: [...spareChannels], shadowPoolSize: spareChannels.length, trackStats: {} };

  for (let t = 0; t < rawTracks.length; t++) {
    const trackData = rawTracks[t];
    let processedTrack;

    if (t === 0) {
      // conductor track: SysExをMaster Fine Tuning付きで先頭に挿入
      if (CT.STATE.applySysEx && Math.abs(masterCents) > 0.1) {
        const sysex = CT.makeMasterTuningSysEx(masterCents);
        // SysEx MIDI形式: F0 <len_vlq> <data_without_F0_without_F7> F7
        // makeMasterTuningSysExは [0xF0, 0x7F, 0x7F, 0x04, 0x03, lsb, msb, 0xF7] を返す
        // MIDI SMF では: delta F0 <VLQ長さ(F7まで含む全データ長-1)> data[1..6] F7
        // データ部 = sysex[1..7] (F0の後F7まで) = 7バイト
        const dataBytes = sysex.slice(1); // F0を除く [7F,7F,04,03,lsb,msb,F7]
        const dataLen = dataBytes.length;  // 7
        const vlLen = [];
        let sl = dataLen;
        vlLen.unshift(sl & 0x7F); sl >>= 7;
        while (sl > 0) { vlLen.unshift((sl & 0x7F) | 0x80); sl >>= 7; }
        const sysexEvent = [0, 0xF0, ...vlLen, ...dataBytes];
        processedTrack = [...sysexEvent, ...trackData];
      } else {
        processedTrack = trackData;
      }
    } else {
      // 音符トラック: PitchBend後処理適用
      if (CT.STATE.outputMode === 'pb' || CT.STATE.outputMode === 'both') {
        const trackName = extractTrackName(trackData) || ('Track ' + t);
        processedTrack = CT.applyTuningToTrack(trackData, pbRange || CT.STATE.pbRange, spareChannels, trackName);
      } else {
        processedTrack = trackData;
      }
    }

    // MTrk chunk再構築
    const tlen = processedTrack.length;
    newTracks.push(
      0x4D,0x54,0x72,0x6B,
      (tlen>>24)&0xFF,(tlen>>16)&0xFF,(tlen>>8)&0xFF,tlen&0xFF,
      ...processedTrack
    );
  }

  // SMF header: numTracks更新は不要（同じトラック数）
  const newHeader = data.slice(0, 14);
  return new Uint8Array([...newHeader, ...newTracks]);
}

function writeMIDI(tracks,bpm,ppq,cond){const hdr=[0x4D,0x54,0x68,0x64,0,0,0,6,0,1,0,tracks.length+1,(ppq>>8)&0xFF,ppq&0xFF];let a=[...hdr,...trackChunk(cond)];for(const t of tracks)a.push(...trackChunk(t));return new Uint8Array(a);}

/* ═══ MPE ═══ */
function parseMidiTrackData(data){const ev=[];let p=0,at=0,rs=0;while(p<data.length){let d=0;while(p<data.length){const b=data[p++];d=(d<<7)|(b&0x7F);if(!(b&0x80))break;}at+=d;if(p>=data.length)break;const fb=data[p];if(fb===0xFF){p++;const mt=data[p++];let l=0;while(p<data.length){const b=data[p++];l=(l<<7)|(b&0x7F);if(!(b&0x80))break;}if(mt===0x2F)break;p+=l;continue;}if(fb===0xF0||fb===0xF7){p++;let l=0;while(p<data.length){const b=data[p++];l=(l<<7)|(b&0x7F);if(!(b&0x80))break;}p+=l;continue;}let st=fb;if(fb&0x80){rs=fb;p++;}else st=rs;const hi=st&0xF0,ch=st&0x0F;if(hi===0x90){ev.push({absTime:at,type:'on',origCh:ch,note:data[p],vel:data[p+1]});p+=2;}else if(hi===0x80){ev.push({absTime:at,type:'off',origCh:ch,note:data[p],vel:data[p+1]});p+=2;}else if(hi===0xC0||hi===0xD0)p+=1;else p+=2;}return ev;}
function buildMPETrack(allEv,scIv,rPc,mc,pbR){const dm={};if(Array.isArray(mc)&&mc.length){for(let o=0;o<=10;o++)for(let i=0;i<mc.length;i++){const midiFloat=o*12+rPc+(mc[i]/100);const anchor=Math.max(0,Math.min(127,Math.round(midiFloat)));const detune=+(mc[i]-(anchor-(o*12+rPc))*100).toFixed(2);if(!Object.prototype.hasOwnProperty.call(dm,anchor)||Math.abs(detune)<Math.abs(dm[anchor]))dm[anchor]=detune;}}else{const devs=scIv.map((interval,index)=>0-interval*100);for(let o=0;o<=10;o++)for(let i=0;i<scIv.length;i++){const mn=o*12+rPc+scIv[i];if(mn>=0&&mn<=127&&!Object.prototype.hasOwnProperty.call(dm,mn))dm[mn]=devs[i]||0;}}allEv.sort((a,b)=>a.absTime-b.absTime||(a.type==='off'?-1:1));const free=[];for(let c=1;c<=15;c++)free.push(c);const used=new Map(),out=[];function optN(n,d){if(Math.abs(d)<=50)return{n,d};const an=d>0?n+1:n-1,ad=d>0?d-100:d+100;return(Math.abs(ad)<Math.abs(d)&&an>=0&&an<=127)?{n:an,d:ad}:{n,d};}for(const e of allEv){const nk=e.note+'_'+e.origCh;if(e.type==='on'){let ch=free.length>0?free.shift():((e.absTime%15)+1);used.set(nk,ch);const o=optN(e.note,dm[e.note]||0);const pb=Math.max(0,Math.min(16383,Math.round(8192+8191*(o.d/100)/pbR)));out.push({t:e.absTime,b:[0xE0|ch,pb&0x7F,(pb>>7)&0x7F]});out.push({t:e.absTime,b:[0x90|ch,o.n,e.vel]});used.set(nk+'_pn',o.n);}else{const ch=used.get(nk)||1,pn=used.get(nk+'_pn');used.delete(nk);used.delete(nk+'_pn');if(!Array.from(used.values()).includes(ch)&&typeof ch==='number')free.push(ch);out.push({t:e.absTime,b:[0x80|ch,pn!=null?pn:e.note,0]});}}out.sort((a,b)=>a.t-b.t);const enc=[];const nm='MPE Microtonal',nb=[...nm].map(c=>c.charCodeAt(0));enc.push(...vl(0),0xFF,0x03,nb.length,...nb);let pt=0;for(const e of out){enc.push(...vl(Math.max(0,e.t-pt)),...e.b);pt=e.t;}enc.push(0,0xFF,0x2F,0);return enc;}
function buildMPEConductor(bpm,ppq,bars,tc,tOn,tDr,secs,pbR){const safePbRange=Number.isFinite(pbR)&&pbR>0?pbR:2;const bt=ppq*4,pool=[];const t0=Math.round(60000000/bpm);const tb={tick:0,bytes:[0xFF,0x51,3,(t0>>16)&0xFF,(t0>>8)&0xFF,t0&0xFF]};pool.push(tb);pool.push({tick:0,bytes:[0xB0,101,0]},{tick:0,bytes:[0xB0,100,6]},{tick:0,bytes:[0xB0,6,safePbRange]},{tick:0,bytes:[0xB0,38,0]});for(let ch=1;ch<=15;ch++){pool.push({tick:0,bytes:[0xB0|ch,101,0]},{tick:0,bytes:[0xB0|ch,100,0]},{tick:0,bytes:[0xB0|ch,6,safePbRange]},{tick:0,bytes:[0xB0|ch,38,0]});}if(secs&&secs.length)for(const s of secs){const tk=s.bar*bt;const nm=[...s.name].map(c=>c.charCodeAt(0));pool.push({tick:Math.max(1,tk),bytes:[0xFF,0x06,nm.length,...nm]});}if(tOn&&tc&&tc.length>0)for(let bar=0;bar<bars;bar++){const tk=bar*bt;const t=tc[bar]!=null?tc[bar]:.5;const bB=Math.max(15,Math.min(200,Math.round(bpm+(t-.5)*2*tDr)));const us=Math.round(60000000/bB);if(bar===0)tb.bytes=[0xFF,0x51,3,(us>>16)&0xFF,(us>>8)&0xFF,us&0xFF];else pool.push({tick:tk,bytes:[0xFF,0x51,3,(us>>16)&0xFF,(us>>8)&0xFF,us&0xFF]});}pool.sort((a,b)=>a.tick-b.tick);const raw=[];let pv=0;for(const ev of pool){raw.push(...vl(ev.tick-pv),...ev.bytes);pv=ev.tick;}raw.push(0,0xFF,0x2F,0);return raw;}
function writeMPEMidi(merged,bpm,ppq,pbR,cond){const hdr=[0x4D,0x54,0x68,0x64,0,0,0,6,0,1,0,2,(ppq>>8)&0xFF,ppq&0xFF];return new Uint8Array([...hdr,...trackChunk(cond),...trackChunk(merged)]);}

/* ═══ NOTE/VOICING UTILS ═══ */
function buildNotePool(rm,si,ol){const rp=rm%12,n=[];const useMicroPool=typeof S!=='undefined'&&typeof MICRO_CENTS!=='undefined'&&typeof CompTuningEngine!=='undefined'&&S.engines&&MICRO_CENTS[S.scale]&&typeof CompTuningEngine.getScaleDegreeCents==='function'&&((S.engines.mpe&&S.mpe)||(S.engines.comptuning&&CompTuningEngine.STATE&&CompTuningEngine.STATE.enabled));if(useMicroPool){const cents=CompTuningEngine.getScaleDegreeCents(S.scale,rp)||[];for(const o of ol){const base=o*12+rp;for(const cent of cents){const v=Math.round(base+(cent/100));if(v>=12&&v<=115)n.push(v);}}}else{for(const o of ol)for(const i of si){const v=o*12+rp+i;if(v>=12&&v<=115)n.push(v);}}return[...new Set(n)].sort((a,b)=>a-b);}
function clampNote(n){return Math.max(12,Math.min(115,n));}
function pickWithBias(pool,bias){if(!pool.length)return 60;const mid=Math.floor(pool.length/2),shift=Math.round(bias*(pool.length/4)),center=Math.max(0,Math.min(pool.length-1,mid+shift)),spread=Math.max(1,Math.floor(pool.length*.35));return pool[Math.max(0,Math.min(pool.length-1,center+Math.round((rng()-.5)*spread*2)))];}
