/* ═══ INIT ═══ */
document.addEventListener('DOMContentLoaded',()=>{
  buildGenreUI();buildChips();buildLayerToggles();buildTheoryTabs();bindSliders();bindChordInput();buildOctDisplay();buildLayerOctaves();buildScaleUI();

  /* updateTheory の多重ラップを避けるため、追加処理は hook として集約する */
  const _updateTheoryHooks = [];
  let _updateTheoryHookPatched = false;
  function addUpdateTheoryHook(hook){
    if(typeof hook !== 'function') return;
    if(!_updateTheoryHookPatched){
      const _baseUpdateTheory = typeof window.updateTheory === 'function' ? window.updateTheory : null;
      window.updateTheory = function(...args){
        if(_baseUpdateTheory) _baseUpdateTheory.apply(this,args);
        for(const _hook of _updateTheoryHooks){
          try{ _hook.apply(this,args); }
          catch(err){ console.error('updateTheory hook failed:', err); }
        }
      };
      _updateTheoryHookPatched = true;
    }
    _updateTheoryHooks.push(hook);
  }
  window.addUpdateTheoryHook = addUpdateTheoryHook;

  /* ── v15.0: Engine Control Bar 初期化 ── */
  renderECB();
  document.getElementById('ecbPresetFull') .addEventListener('click',()=>applyPreset('full'));
  document.getElementById('ecbPresetMin')  .addEventListener('click',()=>applyPreset('minimal'));
  document.getElementById('ecbPresetChaos').addEventListener('click',()=>applyPreset('chaos'));
  document.getElementById('ecbPresetOff')  .addEventListener('click',()=>applyPreset('off'));

  /* 既存パネルトグルがクリックされたとき ECB も同期する（双方向） */
  function patchPanelTog(togId, engineKey){
    const el=document.getElementById(togId);
    if(!el)return;
    el.addEventListener('click',()=>{
      setTimeout(()=>{
        const nowOn=el.classList.contains('on');
        S.engines[engineKey]=nowOn;
        renderECB();
      },0);
    });
  }
  patchPanelTog('togEuc',    'euclidean');
  patchPanelTog('togHum',    'humanizer');
  patchPanelTog('togMarkov', 'markov');
  patchPanelTog('togMPE',    'mpe');
  patchPanelTog('togMacro',  'macro');
  patchPanelTog('togSolfeggio','solfeggio');
  initSolfeggio();

  document.getElementById('ecbPresetSerial').addEventListener('click',()=>applyPreset('serial'));
  document.getElementById('ecbPresetXenakis').addEventListener('click',()=>applyPreset('xenakis'));
  document.getElementById('ecbPresetSwarm').addEventListener('click',()=>applyPreset('swarm'));
  document.getElementById('ecbPresetOrganic').addEventListener('click',()=>applyPreset('organic'));
  document.getElementById('ecbPresetSacred').addEventListener('click',()=>applyPreset('sacred'));

  document.getElementById('btnGen').addEventListener('click',doGenerate);
  document.getElementById('btnDl').addEventListener('click',doDownload);

  updateTheory();
  log('// MEIKYOSHISUI v25.7 READY — MODULAR INIT ACTIVE //','ok');
  renderECB(); // 初期状態を再描画
});
