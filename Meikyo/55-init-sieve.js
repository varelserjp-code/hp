/* ── v17.x: Sieve UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togSieve');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('sieve', !S.engines.sieve);
  });

  const addEl = document.getElementById('svAdd');
  if (addEl) {
    addEl.addEventListener('click', () => {
      const last = SIEVE_STATE.sieves[SIEVE_STATE.sieves.length - 1];
      SIEVE_STATE.sieves.push({
        m: last ? Math.min(99, last.m + 2) : 3,
        r: last ? (last.r + 1) % Math.max(1, last.m) : 0,
        op: 'OR'
      });
      sieveBuildUI();
      sieveRecompute();
    });
  }

  document.querySelectorAll('.sv-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SIEVE_STATE.mode = btn.dataset.mode;
      document.querySelectorAll('.sv-mode-btn').forEach(button => button.classList.remove('on'));
      btn.classList.add('on');
      sieveRecompute();
    });
  });

  [
    ['svRange', 'range'],
    ['svOffset', 'offset'],
    ['svPeriod', 'period'],
    ['svRhyRot', 'rhythmRot']
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const value = parseInt(el.value);
      SIEVE_STATE[key] = value;
      const valueEl = document.getElementById(id + 'V');
      if (valueEl) valueEl.textContent = value;
      sieveRecompute();
    });
  });
});
