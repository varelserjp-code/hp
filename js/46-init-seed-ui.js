/* ── v25.1: Seed UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const lockBtn = document.getElementById('seedLockBtn');
  const seedInp = document.getElementById('seedInput');
  const seedVal = document.getElementById('seedVal');
  const copyBtn = document.getElementById('seedCopyBtn');
  if (!lockBtn) return;

  function syncLockUI() {
    lockBtn.classList.toggle('locked', S.seedLocked);
    lockBtn.textContent = S.seedLocked ? 'UNLOCK' : 'LOCK';
    seedInp.style.display = S.seedLocked ? 'inline-block' : 'none';
    if (S.seedLocked && S.seed) {
      seedInp.value = S.seed;
      seedVal.textContent = S.seed;
    }
  }

  lockBtn.addEventListener('click', () => {
    S.seedLocked = !S.seedLocked;
    if (S.seedLocked) {
      if (!S.seed) {
        rngSeed(0);
        S.seed = rngState();
      }
      seedInp.value = S.seed;
    }
    syncLockUI();
  });

  seedInp.addEventListener('change', () => {
    const value = (parseInt(seedInp.value) >>> 0) || 1;
    S.seed = value;
    seedInp.value = value;
    seedVal.textContent = value;
  });

  copyBtn.addEventListener('click', () => {
    if (!S.seed) return;
    navigator.clipboard.writeText(String(S.seed)).then(() => {
      copyBtn.textContent = 'COPIED';
      setTimeout(() => {
        copyBtn.textContent = 'COPY';
      }, 1200);
    }).catch(() => {
      copyBtn.textContent = String(S.seed);
    });
  });

  syncLockUI();
});
