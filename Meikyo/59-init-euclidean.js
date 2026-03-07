/* ── v15.x: Euclidean UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togEuc');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('euclidean', !S.engines.euclidean);
  });

  const pulsesEl = document.getElementById('eucPulses');
  if (pulsesEl) {
    pulsesEl.addEventListener('input', () => {
      S.eucPulses = parseInt(pulsesEl.value);
      const valueEl = document.getElementById('eucPulsesV');
      if (valueEl) valueEl.textContent = S.eucPulses;
      buildEucPresets();
      updateEucDisplay();
    });
  }

  const stepsEl = document.getElementById('eucSteps');
  if (stepsEl) {
    stepsEl.addEventListener('input', () => {
      S.eucSteps = parseInt(stepsEl.value);
      const stepsValueEl = document.getElementById('eucStepsV');
      if (stepsValueEl) stepsValueEl.textContent = S.eucSteps;

      const pulsesInput = document.getElementById('eucPulses');
      if (pulsesInput) pulsesInput.max = S.eucSteps;
      const rotationInput = document.getElementById('eucRotation');
      if (rotationInput) rotationInput.max = Math.max(0, S.eucSteps - 1);

      if (S.eucPulses > S.eucSteps) {
        S.eucPulses = S.eucSteps;
        if (pulsesInput) pulsesInput.value = S.eucPulses;
        const pulsesValueEl = document.getElementById('eucPulsesV');
        if (pulsesValueEl) pulsesValueEl.textContent = S.eucPulses;
      }

      if (S.eucRotation >= S.eucSteps) {
        S.eucRotation = 0;
        if (rotationInput) rotationInput.value = 0;
        const rotationValueEl = document.getElementById('eucRotationV');
        if (rotationValueEl) rotationValueEl.textContent = '0';
      }

      buildEucPresets();
      updateEucDisplay();
    });
  }

  const rotationEl = document.getElementById('eucRotation');
  if (rotationEl) {
    rotationEl.addEventListener('input', () => {
      S.eucRotation = parseInt(rotationEl.value);
      const valueEl = document.getElementById('eucRotationV');
      if (valueEl) valueEl.textContent = S.eucRotation;
      buildEucPresets();
      updateEucDisplay();
    });
  }
});
