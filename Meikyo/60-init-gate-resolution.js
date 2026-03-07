/* ── v15.x: Gate / Resolution UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const gateBaseEl = document.getElementById('gateBase');
  if (gateBaseEl) {
    gateBaseEl.addEventListener('input', () => {
      S.gateBase = parseInt(gateBaseEl.value) / 100;
      const valueEl = document.getElementById('gateBaseV');
      if (valueEl) valueEl.textContent = S.gateBase.toFixed(2);
      updateGateIndicator();
    });
  }

  const gateHumanizeEl = document.getElementById('gateHumanize');
  if (gateHumanizeEl) {
    gateHumanizeEl.addEventListener('input', () => {
      S.gateHumanize = parseInt(gateHumanizeEl.value);
      const valueEl = document.getElementById('gateHumanizeV');
      if (valueEl) valueEl.textContent = S.gateHumanize + '%';
    });
  }

  updateGateIndicator();

  const resolveThresholdEl = document.getElementById('resolveThreshold');
  if (resolveThresholdEl) {
    resolveThresholdEl.addEventListener('input', () => {
      S.resolveThreshold = parseInt(resolveThresholdEl.value) / 100;
      const valueEl = document.getElementById('resolveThresholdV');
      if (valueEl) valueEl.textContent = S.resolveThreshold.toFixed(2);
      updateResolveIndicator();
    });
  }

  const resolveStepsEl = document.getElementById('resolveSteps');
  if (resolveStepsEl) {
    resolveStepsEl.addEventListener('input', () => {
      S.resolveSteps = parseInt(resolveStepsEl.value);
      const valueEl = document.getElementById('resolveStepsV');
      if (valueEl) valueEl.textContent = S.resolveSteps;
      updateResolveIndicator();
    });
  }

  updateResolveIndicator();
});
