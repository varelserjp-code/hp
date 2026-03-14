/* ── v25.3: A/B Variant UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const btnAB = document.getElementById('btnGenAB');
  if (btnAB) {
    btnAB.addEventListener('click', () => {
      if (typeof doGenerateAB === 'function') doGenerateAB();
    });
  }

  const abPanel = document.getElementById('abPanel');
  if (abPanel) {
    abPanel.addEventListener('click', event => {
      const btn = event.target.closest('.ab-btn');
      if (!btn) return;
      S.abMode = btn.dataset.ab;
      if (typeof _updateABPreview === 'function') _updateABPreview();
    });
  }
});
