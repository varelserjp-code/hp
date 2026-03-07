/* ── v18.x: Boids UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togBoids');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('boids', !S.engines.boids);
  });

  document.querySelectorAll('.boids-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      BOIDS_STATE.mode = btn.dataset.mode;
      document.querySelectorAll('.boids-mode-btn').forEach(button => {
        button.classList.toggle('on', button.dataset.mode === BOIDS_STATE.mode);
      });
      if (BOIDS_STATE.enabled) boidsPreviewRun();
    });
  });

  [
    ['boidsSep', 'sepWeight'],
    ['boidsSepR', 'sepRadius'],
    ['boidsAli', 'aliWeight'],
    ['boidsAliR', 'aliRadius'],
    ['boidsCoh', 'cohWeight'],
    ['boidsCohR', 'cohRadius'],
    ['boidsSteps', 'steps'],
    ['boidsMaxV', 'maxSpeed'],
    ['boidsInertia', 'inertia'],
    ['boidsRegDepth', 'regDepth'],
    ['boidsVelDepth', 'velDepth'],
    ['boidsGateDepth', 'gateDepth']
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      BOIDS_STATE[key] = parseInt(el.value);
      boidsUpdateLabels();
      if (BOIDS_STATE.enabled) boidsPreviewRun();
    });
  });
});
