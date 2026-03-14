/* ── v15.x: Compensation Tuning UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togCompTuning');
  const ctrlEl = document.getElementById('compTuningControls');
  if (!togEl || !ctrlEl) return;
  const scaleSyncBtn = document.getElementById('ctScaleSyncBtn');
  const rootPcSl = document.getElementById('ctRootPc');
  const rootPcVl = document.getElementById('ctRootPcV');
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function refreshRootPcUI() {
    if (rootPcSl) rootPcSl.value = CompTuningEngine.STATE.rootPc;
    if (rootPcVl) rootPcVl.textContent = noteNames[CompTuningEngine.STATE.rootPc];
  }

  function refreshScaleSyncButton() {
    if (!scaleSyncBtn) return;
    const auto = !!CompTuningEngine.STATE.autoScaleSync;
    scaleSyncBtn.classList.toggle('on', auto);
    scaleSyncBtn.textContent = auto ? 'AUTO' : 'MANUAL';
    scaleSyncBtn.title = auto
      ? 'Scale Sync: ON — microtonal scales follow current scale/root'
      : 'Scale Sync: OFF — keep manual CompTuning values';
    if (typeof buildScaleUI === 'function') buildScaleUI();
  }

  function syncScaleMicroToCompTuning() {
    if (typeof CompTuningEngine === 'undefined') return;
    const rootPc = S.chord ? (S.chord.root % 12) : CompTuningEngine.STATE.rootPc;
    const applied = CompTuningEngine.syncScaleMicroTuning(S.scale, rootPc);
    if (!applied) {
      refreshScaleSyncButton();
      return;
    }
    CompTuningEngine.buildTemperamentButtons();
    CompTuningEngine.buildIntervalGrid();
    refreshRootPcUI();
    CompTuningEngine.updateDisplay();
    refreshScaleSyncButton();
  }

  togEl.addEventListener('click', () => {
    syncEngine('comptuning', !S.engines.comptuning);
  });

  const a4sl = document.getElementById('ctA4Slider');
  const a4vl = document.getElementById('ctA4Val');
  if (a4sl) {
    a4sl.addEventListener('input', () => {
      CompTuningEngine.STATE.a4Hz = parseFloat(a4sl.value);
      if (a4vl) a4vl.textContent = CompTuningEngine.STATE.a4Hz.toFixed(1) + ' Hz';
      CompTuningEngine.buildA4Presets();
      CompTuningEngine.updateDisplay();
    });
  }

  const gcsl = document.getElementById('ctGlobalCents');
  const gcvl = document.getElementById('ctGlobalCentsV');
  if (gcsl) {
    gcsl.addEventListener('input', () => {
      CompTuningEngine.STATE.globalCents = parseFloat(gcsl.value);
      if (gcvl) {
        gcvl.textContent = (CompTuningEngine.STATE.globalCents >= 0 ? '+' : '') + CompTuningEngine.STATE.globalCents.toFixed(1) + '¢';
      }
      CompTuningEngine.updateDisplay();
    });
  }

  const pbsl = document.getElementById('ctPbRange');
  const pbvl = document.getElementById('ctPbRangeV');
  if (pbsl) {
    pbsl.addEventListener('input', () => {
      CompTuningEngine.STATE.pbRange = parseInt(pbsl.value);
      if (pbvl) pbvl.textContent = '±' + CompTuningEngine.STATE.pbRange + ' st';
    });
  }

  if (rootPcSl) {
    rootPcSl.addEventListener('input', () => {
      CompTuningEngine.disableScaleMicroSync();
      CompTuningEngine.STATE.rootPc = parseInt(rootPcSl.value);
      if (rootPcVl) rootPcVl.textContent = noteNames[CompTuningEngine.STATE.rootPc];
      CompTuningEngine.buildIntervalGrid();
      CompTuningEngine.updateDisplay();
      refreshScaleSyncButton();
    });
  }

  const modeRow = document.getElementById('ctOutputModeRow');
  if (modeRow) {
    modeRow.querySelectorAll('.bb-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        CompTuningEngine.STATE.outputMode = btn.dataset.mode;
        modeRow.querySelectorAll('.bb-mode-btn').forEach(button => button.classList.toggle('on', button === btn));
      });
    });
  }

  if (scaleSyncBtn) {
    scaleSyncBtn.addEventListener('click', () => {
      const next = !CompTuningEngine.STATE.autoScaleSync;
      CompTuningEngine.setScaleMicroSync(next);
      if (next) syncScaleMicroToCompTuning();
      else {
        CompTuningEngine.updateDisplay();
        refreshScaleSyncButton();
      }
    });
  }

  const tempGrid = document.getElementById('ctTempGrid');
  if (tempGrid) {
    tempGrid.addEventListener('click', () => {
      refreshScaleSyncButton();
    });
  }

  const intervalGrid = document.getElementById('ctIntervalGrid');
  if (intervalGrid) {
    intervalGrid.addEventListener('change', () => {
      refreshScaleSyncButton();
    });
  }

  if (typeof window.addUpdateTheoryHook === 'function') {
    window.addUpdateTheoryHook(() => {
      syncScaleMicroToCompTuning();
    });
  }

  refreshRootPcUI();
  refreshScaleSyncButton();
  syncScaleMicroToCompTuning();
});
