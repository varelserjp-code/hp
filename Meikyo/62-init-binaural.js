/* ── v15.x: Binaural UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togBinaural');
  const ctrlEl = document.getElementById('binauralControls');
  if (!togEl || !ctrlEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('binaural', !S.engines.binaural);
  });

  BinauralEngine.buildUI();
  BinauralEngine.initCarrierSlider();
  BinauralEngine.initModeButtons();

  const velocityEl = document.getElementById('bbVelocity');
  if (velocityEl) {
    velocityEl.addEventListener('input', event => {
      BinauralEngine.STATE.velocity = parseInt(event.target.value);
      const valueEl = document.getElementById('bbVelocityV');
      if (valueEl) valueEl.textContent = BinauralEngine.STATE.velocity;
    });
  }

  const volumeEl = document.getElementById('bbVolume');
  if (volumeEl) {
    volumeEl.addEventListener('input', event => {
      BinauralEngine.STATE.volume = parseInt(event.target.value);
      const valueEl = document.getElementById('bbVolumeV');
      if (valueEl) valueEl.textContent = BinauralEngine.STATE.volume;
    });
  }
});
