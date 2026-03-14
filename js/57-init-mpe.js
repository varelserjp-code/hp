/* ── v15.x: MPE UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togMPE');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('mpe', !S.engines.mpe);
  });

  const pbRangeEl = document.getElementById('pbRange');
  if (!pbRangeEl) return;
  pbRangeEl.addEventListener('input', () => {
    S.pbRange = parseInt(pbRangeEl.value);
    const valueEl = document.getElementById('pbRangeV');
    if (valueEl) valueEl.textContent = '±' + S.pbRange + ' st';
  });
});
