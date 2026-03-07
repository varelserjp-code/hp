/* ── v15.x: Macro UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togMacro');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('macro', !S.engines.macro);
  });

  const curveAmpEl = document.getElementById('curveAmp');
  if (curveAmpEl) {
    curveAmpEl.addEventListener('input', () => {
      S.curveAmp = parseInt(curveAmpEl.value);
      const valueEl = document.getElementById('curveAmpV');
      if (valueEl) valueEl.textContent = S.curveAmp + '%';
      updateMacroPreview();
    });
  }

  const chainEl = document.getElementById('togChain');
  if (chainEl) {
    chainEl.addEventListener('click', () => {
      S.chainEnabled = !S.chainEnabled;
      chainEl.classList.toggle('on', S.chainEnabled);
      const controls = document.getElementById('chainControls');
      if (controls) controls.style.display = S.chainEnabled ? 'block' : 'none';
      updateMacroPreview();
    });
  }

  const tempoModEl = document.getElementById('togTempoMod');
  if (tempoModEl) {
    tempoModEl.addEventListener('click', () => {
      S.tempoModEnabled = !S.tempoModEnabled;
      tempoModEl.classList.toggle('on', S.tempoModEnabled);
      const controls = document.getElementById('tempoModControls');
      if (controls) controls.style.display = S.tempoModEnabled ? 'block' : 'none';
      refreshBpmDisplay();
      updateMacroPreview();
    });
  }

  const tempoDriftEl = document.getElementById('tempoDrift');
  if (tempoDriftEl) {
    tempoDriftEl.addEventListener('input', () => {
      S.tempoDrift = parseInt(tempoDriftEl.value);
      const valueEl = document.getElementById('tempoDriftV');
      if (valueEl) valueEl.textContent = '±' + S.tempoDrift + ' BPM';
      refreshBpmDisplay();
      updateMacroPreview();
    });
  }
});
