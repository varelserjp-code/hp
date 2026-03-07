/* ═══════════════════════════════════════════════════
   v15.0: ENGINE CONTROL BAR — 全エンジン個別トグル
   ─────────────────────────────────────────────────
   設計:
   ・S.engines オブジェクトが唯一の状態ソース
   ・既存パネルトグル (togEuc, togHum 等) との双方向同期
   ・doGenerate() はすべて S.engines.xxx を参照
   ・ECBとパネルトグルは syncEngine() で同期
═══════════════════════════════════════════════════ */

// エンジン定義テーブル
const ECB_ENGINES=[
  // ── 音楽理論 ──────────────────────────────────
  {group:'THEORY',key:'pcset',    label:'PC Set',   color:'#8c3fff', desc:'Allen Forte音級集合・区間ベクトル・Z関係',
   panelTogId:null, panelCtrlId:null},
  {group:'THEORY',key:'negharmony',label:'NegHarm', color:'#e4a01b', desc:'Ernst Levy 負和声・対称軸反転',
   panelTogId:null, panelCtrlId:null},
  {group:'THEORY',key:'twelvetone',label:'12-Tone', color:'#8c3fff', desc:'Schoenberg P/R/I/RI 12音列変換',
   panelTogId:null, panelCtrlId:null},
  {group:'THEORY',key:'integralserialism',label:'Integral',color:'#ff6d00',
   desc:'Boulez/Stockhausen — Duration·Vel·Gate を12音列で完全決定論的支配',
   panelTogId:'togIS', panelCtrlId:'isControls'},
  // ── カオス ────────────────────────────────────
  {group:'CHAOS', key:'lorenz',   label:'Lorenz',   color:'#00e5ff', desc:'ローレンツアトラクター σ=10 ρ=28 velocity変調',
   panelTogId:'togLorenz', panelCtrlId:'lorenzControls'},
  {group:'CHAOS', key:'ca',       label:'Cell.Auto',color:'#00e5ff', desc:'ウォルフラム細胞オートマトン gate行列生成',
   panelTogId:'togCA', panelCtrlId:'caControls'},
  {group:'CHAOS', key:'rubato',   label:'Rubato',   color:'#00e5ff', desc:'バウンスボールルバート tick変調',
   panelTogId:'togRubato', panelCtrlId:'rubatoControls'},
  // ── リズム / 生成 ─────────────────────────────
  {group:'GENERATE',key:'sieve',    label:'Sieve',    color:'#7fff00',
   desc:'Xenakis 篩理論 — モジュロ演算×集合論 → 非対称スケール & ポリリズム',
   panelTogId:'togSieve', panelCtrlId:'sieveControls'},
  {group:'GENERATE',key:'euclidean',label:'Euclidean',color:'#ff4081', desc:'Björklund E(k,n) ユークリッドリズム',
   panelTogId:'togEuc', panelCtrlId:'eucControls'},
  {group:'GENERATE',key:'markov',  label:'Markov',  color:'#1de9b6', desc:'確率的遷移行列メロディ生成 ch9',
   panelTogId:'togMarkov', panelCtrlId:'markovControls'},
  {group:'GENERATE',key:'lsystem', label:'L-System',color:'#c084fc', desc:'Lindenmayer フラクタル文法 — フレーズ自己増殖 ch10',
   panelTogId:'togLS', panelCtrlId:'lsControls'},
  {group:'GENERATE',key:'solfeggio',label:'Solfeggio',color:'#9b6fff', desc:'ソルフェジオ周波数・シューマン共鳴・惑星周波数 — ch12',
   panelTogId:'togSolfeggio', panelCtrlId:'solfeggioControls'},
  {group:'GENERATE',key:'binaural',label:'Binaural',color:'#cccccc', desc:'バイノーラルビート脳波誘導 — Delta/Theta/Alpha/Beta/Gamma/HiGamma — ch13(L)/ch14(R)',
   panelTogId:'togBinaural', panelCtrlId:'binauralControls'},
  {group:'GENERATE',key:'comptuning',label:'CompTune',color:'#aaaaaa', desc:'コンペンセーションチューニング — A4基準ピッチ・音律・インターバル補正 — PitchBend後処理',
   panelTogId:'togCompTuning', panelCtrlId:'compTuningControls'},
  {group:'GENERATE',key:'humanizer',label:'Humaniz',color:'#8c3fff', desc:'1/f ピンクノイズ + Perlin FBM velocity/timing',
   panelTogId:'togHum', panelCtrlId:'humControls'},
  // ── 表現 / 仕上げ ─────────────────────────────
  {group:'FINISH', key:'resolution',label:'Resolve',color:'#00e676', desc:'不協和音程の自動解決 DissonanceResolver',
   panelTogId:null, panelCtrlId:null},
  {group:'FINISH', key:'mpe',      label:'MPE',     color:'#ffcc00', desc:'MPE per-note ピッチベンド・マイクロトーナル',
   panelTogId:'togMPE', panelCtrlId:'mpePbRow'},
  {group:'FINISH', key:'macro',    label:'Macro',   color:'#ff1744', desc:'Tensionカーブ + テンポドリフト + セクション',
   panelTogId:'togMacro', panelCtrlId:'macroControls'},
  {group:'FINISH', key:'boids',    label:'Boids',   color:'#00b8d4', desc:'群知能シミュレーション — 分離・整列・結合 → 音楽パラメータ変調',
   panelTogId:'togBoids', panelCtrlId:'boidsControls'},
  {group:'FINISH', key:'spectral', label:'Spectral',color:'#ff9100', desc:'倍音列スペクトル解析 — 音色整形・協和度ゲート・テクスチャ共鳴フィルタ',
   panelTogId:'togSpectral', panelCtrlId:'spectralControls'},
];

const ECB_GROUPS=['THEORY','CHAOS','GENERATE','FINISH'];
const ECB_GROUP_LABELS={THEORY:'Theory',CHAOS:'Chaos',GENERATE:'Generate',FINISH:'Finish'};

// プリセット定義
// ── ALL ON 除外エンジンの根拠 ──────────────────────────────────────────────
// binaural:false        ch13/ch14 専用ビート生成。他レイヤーと干渉しないが
//                       単独で使う想定のため、一括 ON では不要な MIDI ch を消費する。
// integralserialism:false Humanizer/Lorenz 等の確率的揺らぎを 12音列で完全上書きする
//                       決定論的エンジン。ALL ON で共存すると相互に効果が打ち消される。
// sieve:false           Xenakis 篩理論がスケール自体を強制置換するため、
//                       PCSet/NegHarmony/12-Tone との音律競合が発生する。
// boids:false           registerOffset 変調を加える群知能エンジン。
//                       Lorenz/Rubato 等と重畳すると変調量が過剰になる。
// lsystem:false         ch10 専用フレーズ生成。Markov (ch9) と同時 ON にすると
//                       MIDI ch が飽和し、再生環境によってはポリ数超過する。
// comptuning:false      PitchBend を使う後処理エンジン。MPE(mpe:false) と
//                       同じく PitchBend チャンネルを独占するため MPE と排他的に使う。
// ─────────────────────────────────────────────────────────────────────────
const ECB_PRESETS={
  full:    {label:'ALL ON',   engines:{pcset:true,negharmony:true,twelvetone:true,lorenz:true,ca:true,rubato:true,resolution:true,mpe:false,euclidean:true,humanizer:true,markov:true,macro:true,integralserialism:false,sieve:false,boids:false,lsystem:false,solfeggio:false,spectral:true,binaural:false,comptuning:false}},
  minimal: {label:'MINIMAL', engines:{pcset:true,negharmony:false,twelvetone:false,lorenz:false,ca:false,rubato:false,resolution:true,mpe:false,euclidean:false,humanizer:false,markov:false,macro:false,integralserialism:false,sieve:false,boids:false,lsystem:false,solfeggio:false,spectral:false,binaural:false,comptuning:false}},
  chaos:   {label:'CHAOS',   engines:{pcset:true,negharmony:true,twelvetone:false,lorenz:true,ca:true,rubato:true,resolution:false,mpe:false,euclidean:true,humanizer:true,markov:false,macro:true,integralserialism:false,sieve:false,boids:false,lsystem:false,solfeggio:false,spectral:false,binaural:false,comptuning:false}},
  off:     {label:'ALL OFF', engines:{pcset:false,negharmony:false,twelvetone:false,lorenz:false,ca:false,rubato:false,resolution:false,mpe:false,euclidean:false,humanizer:false,markov:false,macro:false,integralserialism:false,sieve:false,boids:false,lsystem:false,solfeggio:false,spectral:false,binaural:false,comptuning:false}},
  serial:  {label:'SERIAL',  engines:{pcset:true,negharmony:false,twelvetone:true,lorenz:false,ca:false,rubato:false,resolution:false,mpe:false,euclidean:false,humanizer:false,markov:false,macro:false,integralserialism:true,sieve:false,boids:false,lsystem:false,solfeggio:false,spectral:false,binaural:false,comptuning:false}},
  xenakis: {label:'XENAKIS', engines:{pcset:true,negharmony:false,twelvetone:false,lorenz:false,ca:false,rubato:false,resolution:false,mpe:false,euclidean:false,humanizer:false,markov:false,macro:false,integralserialism:false,sieve:true,boids:false,lsystem:false,solfeggio:false,spectral:false,binaural:false,comptuning:false}},
  swarm:   {label:'SWARM',   engines:{pcset:true,negharmony:false,twelvetone:false,lorenz:true,ca:true,rubato:true,resolution:true,mpe:false,euclidean:false,humanizer:false,markov:false,macro:false,integralserialism:false,sieve:false,boids:true,lsystem:false,solfeggio:false,spectral:true,binaural:false,comptuning:false}},
  organic: {label:'ORGANIC', engines:{pcset:true,negharmony:false,twelvetone:false,lorenz:true,ca:false,rubato:true,resolution:true,mpe:false,euclidean:false,humanizer:true,markov:false,macro:true,integralserialism:false,sieve:false,boids:false,lsystem:true,solfeggio:false,spectral:true,binaural:false,comptuning:false}},
  sacred:  {label:'SACRED',  engines:{pcset:true,negharmony:false,twelvetone:false,lorenz:false,ca:false,rubato:false,resolution:true,mpe:false,euclidean:false,humanizer:true,markov:false,macro:true,integralserialism:false,sieve:false,boids:false,lsystem:false,solfeggio:true,spectral:true,binaural:false,comptuning:false}},
};

/**
 * エンジン状態を単一ソース (S.engines) から
 * ECBミニトグル・既存パネルトグル・S上のフラグすべてに反映する。
 */
function syncEngine(key, on){
  // 1. S.engines に書き込み
  S.engines[key]=on;

  // 2. S の直接フラグも同期
  if(key==='euclidean'){S.eucEnabled=on;}
  if(key==='humanizer'){Humanizer.STATE.enabled=on;if(on){Humanizer.buildUI();Humanizer.startViz();}else Humanizer.stopViz();}
  if(key==='markov')   {S.layers.markov=on;}
  if(key==='mpe')      {S.mpe=on;const pb=document.getElementById('mpePbRow');if(pb)pb.style.display=on?'block':'none';const ms=document.getElementById('mpeStatus');if(ms)ms.textContent=on?'MPE ON — per-note pitch bend':'MPE OFF';}
  if(key==='macro')    {S.macroEnabled=on;const mc=document.getElementById('macroControls');if(mc)mc.style.display=on?'block':'none';if(on){buildCurveGrid();buildChainSelect();updateMacroPreview();}refreshBpmDisplay();}
  if(key==='resolution'){S.resolveThreshold=on?0.65:1.01;}// 無効時は閾値を1超にして発動しない
  if(key==='sieve'){
    SIEVE_STATE.enabled=on;
    const sc=document.getElementById('sieveControls');
    if(sc) sc.style.display=on?'block':'none';
    if(on){ sieveBuildPresets(); sieveBuildUI(); sieveRecompute(); }
  }
  if(key==='boids'){
    BOIDS_STATE.enabled=on;
    if(on) boidsPreviewRun();
  }
  if(key==='lsystem'){
    LSEngine.STATE.enabled=on;
    if(on){ LSEngine.buildUI(); }
  }
  if(key==='solfeggio'){
    SolfeggioEngine.STATE.enabled=on;
    if(on){ SolfeggioEngine.buildUI(); SolfeggioEngine.drawViz(); }
    const ib=document.getElementById('sfInfoBox');
    if(ib) ib.textContent=on
      ? '有効 — GENERATEでソルフェジオ周波数トラック(ch12)が生成されます。'
      : 'ソルフェジオ周波数を選択して GENERATE — 対応するMIDIノートに最近傍マッピングされた独立トラックが生成されます。';
  }
  if(key==='binaural'){
    BinauralEngine.STATE.enabled=on;
    const btog=document.getElementById('togBinaural');
    if(btog) btog.classList.toggle('on',on);
    const bc=document.getElementById('binauralControls');
    if(bc) bc.style.display=on?'block':'none';
    if(on){ BinauralEngine.buildUI(); BinauralEngine.initCarrierSlider(); BinauralEngine.initModeButtons(); }
  }
  if(key==='comptuning'){
    CompTuningEngine.STATE.enabled=on;
    const ctog=document.getElementById('togCompTuning');
    if(ctog) ctog.classList.toggle('on',on);
    const cc=document.getElementById('compTuningControls');
    if(cc) cc.style.display=on?'block':'none';
    if(on){ CompTuningEngine.buildUI(); }
  }
  if(key==='spectral'){
    SPECTRAL_PARAMS.enabled=on;
  }
  if(key==='integralserialism'){
    const isp=document.getElementById('isControls');
    if(isp)isp.style.display=on?'block':'none';
    if(on)log('// IS: Integral Serialism ENABLED — Duration·Vel·Gate を音列で支配');
  }

  // 3. 既存パネルトグルへの反映
  const def=ECB_ENGINES.find(e=>e.key===key);
  if(def&&def.panelTogId){
    const ptog=document.getElementById(def.panelTogId);
    if(ptog) ptog.classList.toggle('on',on);
  }
  if(def&&def.panelCtrlId){
    const pctrl=document.getElementById(def.panelCtrlId);
    if(pctrl) pctrl.style.display=on?'block':'none';
  }

  // 4. Euclidean/Markov/Humanizer: パネル内追加初期化
  if(on){
    if(key==='euclidean'){buildEucPresets();updateEucDisplay();}
    if(key==='markov'){MarkovEngine.buildUI();MarkovEngine.rebuildMatrix();}
    if(key==='humanizer'){Humanizer.buildUI();}
  }

  // 5. ECBミニトグルと表示更新
  renderECB();
}

function applyPreset(name){
  const p=ECB_PRESETS[name];
  if(!p)return;
  for(const k of Object.keys(S.engines)){
    const v=Object.prototype.hasOwnProperty.call(p.engines,k)?p.engines[k]:false;
    syncEngine(k,!!v);
  }
  buildLayerToggles(); // markov layer toggle も更新
  updateResolveIndicator();
}

function renderECB(){
  // グリッド描画
  const grid=document.getElementById('ecbGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const gk of ECB_GROUPS){
    const engines=ECB_ENGINES.filter(e=>e.group===gk);
    if(!engines.length)continue;
    const grp=document.createElement('div');
    grp.className='ecb-group';
    grp.innerHTML=`<div class="ecb-group-label">${ECB_GROUP_LABELS[gk]}</div>`;
    for(const eng of engines){
      const on=!!S.engines[eng.key];
      const row=document.createElement('div');
      row.className='ecb-row';
      row.title=eng.desc;
      row.innerHTML=`
        <div class="ecb-tog ${on?'on':''}" style="color:${eng.color}"></div>
        <span class="ecb-label ${on?'on':''}">${eng.label}</span>`;
      row.addEventListener('click',()=>syncEngine(eng.key,!S.engines[eng.key]));
      grp.appendChild(row);
    }
    grid.appendChild(grp);
  }

  // ステータスバッジ描画
  const status=document.getElementById('ecbStatus');
  if(!status)return;
  const onEngines=ECB_ENGINES.filter(e=>S.engines[e.key]);
  const offEngines=ECB_ENGINES.filter(e=>!S.engines[e.key]);
  status.innerHTML='<span style="font-family:Share Tech Mono,monospace;font-size:8px;color:var(--text-dim);letter-spacing:2px;margin-right:6px;">ACTIVE:</span>'
    +onEngines.map(e=>`<span class="ecb-badge on" style="color:${e.color};border-color:${e.color}30;background:${e.color}10">${e.label}</span>`).join('')
    +(offEngines.length?`<span style="font-family:Share Tech Mono,monospace;font-size:8px;color:var(--text-dim);letter-spacing:2px;margin-left:6px;margin-right:4px;">OFF:</span>`+offEngines.map(e=>`<span class="ecb-badge" style="color:var(--text-dim);border-color:var(--border)">${e.label}</span>`).join(''):'');
}

