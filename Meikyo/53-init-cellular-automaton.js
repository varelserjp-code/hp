/* ── v12.x: Cellular Automaton UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const RULE_PRESETS = [30, 90, 110, 54, 18, 150, 73, 126];
  const SEEDS = ['single', 'random', 'sparse', 'dense'];

  const togEl = document.getElementById('togCA');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('ca', !S.engines.ca);
    togEl.classList.toggle('on', S.engines.ca);
  });

  const overrideTog = document.getElementById('caOverrideTog');
  const overrideLabel = document.getElementById('caOverrideLabel');
  const manualControls = document.getElementById('caManualControls');

  function setOverride(on) {
    CA_PARAMS.override = on;
    if (overrideTog) overrideTog.classList.toggle('on', on);
    if (overrideLabel) overrideLabel.textContent = on ? 'MANUAL (手動指定)' : 'AUTO (ジャンル連動)';
    if (manualControls) manualControls.style.display = on ? 'block' : 'none';
    caPreview();
  }

  if (overrideTog) overrideTog.addEventListener('click', () => setOverride(!CA_PARAMS.override));

  function updateRuleName(rule) {
    const name = CellularAutomaton.PRESETS[rule] || '(unnamed)';
    const nameEl = document.getElementById('caRuleName');
    if (nameEl) nameEl.textContent = 'Rule ' + rule + ' — ' + name;
  }

  const ruleSlider = document.getElementById('caRule');
  const ruleVal = document.getElementById('caRuleV');
  if (ruleSlider) {
    ruleSlider.addEventListener('input', () => {
      const value = parseInt(ruleSlider.value);
      CA_PARAMS.rule = value;
      if (ruleVal) ruleVal.textContent = value;
      updateRuleName(value);
      buildRulePresets();
      caPreview();
    });
  }

  function buildRulePresets() {
    const row = document.getElementById('caRulePresets');
    if (!row) return;
    row.innerHTML = '';
    RULE_PRESETS.forEach(rule => {
      const btn = document.createElement('button');
      btn.className = 'ca-rule-btn' + (CA_PARAMS.rule === rule ? ' on' : '');
      btn.textContent = String(rule);
      btn.title = CellularAutomaton.PRESETS[rule] || '';
      btn.addEventListener('click', () => {
        CA_PARAMS.rule = rule;
        if (ruleSlider) ruleSlider.value = rule;
        if (ruleVal) ruleVal.textContent = rule;
        updateRuleName(rule);
        buildRulePresets();
        caPreview();
      });
      row.appendChild(btn);
    });
  }

  function buildSeedButtons() {
    const row = document.getElementById('caSeedRow');
    if (!row) return;
    row.innerHTML = '';
    SEEDS.forEach(seed => {
      const btn = document.createElement('button');
      btn.className = 'ca-seed-btn' + (CA_PARAMS.seed === seed ? ' on' : '');
      btn.textContent = seed.charAt(0).toUpperCase() + seed.slice(1);
      btn.addEventListener('click', () => {
        CA_PARAMS.seed = seed;
        row.querySelectorAll('.ca-seed-btn').forEach(button => button.classList.toggle('on', button === btn));
        caPreview();
      });
      row.appendChild(btn);
    });
  }

  function caPreview() {
    const cv = document.getElementById('caViz');
    if (!cv) return;
    const rule = CA_PARAMS.override ? CA_PARAMS.rule : 30;
    const inst = CellularAutomaton.create({ width: 64, rule, seed: CA_PARAMS.seed, rows: 80 });
    const width = cv.offsetWidth || 340;
    const height = 80;
    const rows = Math.min(inst.history.length, height);
    const cols = inst.width;
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    const cw = width / cols;
    const rh = height / rows;
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const row = inst.history[rowIndex];
      for (let colIndex = 0; colIndex < cols; colIndex++) {
        if (row[colIndex]) {
          ctx.fillStyle = 'rgba(0,229,255,0.75)';
          ctx.fillRect(Math.floor(colIndex * cw), Math.floor(rowIndex * rh), Math.max(1, Math.ceil(cw)), Math.max(1, Math.ceil(rh)));
        }
      }
    }
  }

  updateRuleName(CA_PARAMS.rule);
  buildRulePresets();
  buildSeedButtons();
  caPreview();
});
