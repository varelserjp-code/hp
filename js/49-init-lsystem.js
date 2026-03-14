/* ── v19.0: L-System UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('togLS').addEventListener('click', () => {
    syncEngine('lsystem', !S.engines.lsystem);
  });

  document.getElementById('lsAxiom').addEventListener('input', () => {
    LSEngine.STATE.axiom = document.getElementById('lsAxiom').value.toUpperCase().replace(/[^A-H\[\]\+\-]/g, '');
    document.getElementById('lsAxiom').value = LSEngine.STATE.axiom;
    LSEngine.recompute();
  });

  document.getElementById('lsGen').addEventListener('input', () => {
    LSEngine.STATE.generations = parseInt(document.getElementById('lsGen').value);
    document.getElementById('lsGenV').textContent = LSEngine.STATE.generations + ' gen';
    LSEngine.recompute();
  });

  document.getElementById('lsStep').addEventListener('input', () => {
    LSEngine.STATE.stepSt = parseInt(document.getElementById('lsStep').value);
    document.getElementById('lsStepV').textContent = LSEngine.STATE.stepSt + ' st';
    LSEngine.recompute();
  });

  document.getElementById('lsGateR').addEventListener('input', () => {
    LSEngine.STATE.gateRatio = parseInt(document.getElementById('lsGateR').value) / 100;
    document.getElementById('lsGateRV').textContent = LSEngine.STATE.gateRatio.toFixed(2);
  });

  document.getElementById('lsVelBase').addEventListener('input', () => {
    LSEngine.STATE.velBase = parseInt(document.getElementById('lsVelBase').value);
    document.getElementById('lsVelBaseV').textContent = LSEngine.STATE.velBase;
  });

  document.getElementById('lsOctave').addEventListener('input', () => {
    LSEngine.STATE.octave = parseInt(document.getElementById('lsOctave').value);
    document.getElementById('lsOctaveV').textContent = 'Oct ' + LSEngine.STATE.octave;
    LSEngine.recompute();
  });

  document.getElementById('lsGrowthGroup').addEventListener('click', event => {
    const btn = event.target.closest('.ls-grow-btn');
    if (!btn) return;
    LSEngine.STATE.growthMode = btn.dataset.mode;
    document.querySelectorAll('.ls-grow-btn').forEach(button => button.classList.toggle('on', button === btn));
    LSEngine.recompute();
  });

  document.getElementById('lsAddRule').addEventListener('click', () => {
    const used = Object.keys(LSEngine.STATE.rules);
    const symbols = 'ABCDEFGH';
    const free = [...symbols].find(symbol => !used.includes(symbol)) || null;
    if (!free) {
      alert('使用可能なシンボル（A-H）がすべて使用済みです');
      return;
    }
    LSEngine.STATE.rules[free] = free;
    LSEngine.buildRulesUI();
    LSEngine.recompute();
  });

  document.getElementById('lsRegen').addEventListener('click', () => {
    LSEngine.recompute();
  });
});
