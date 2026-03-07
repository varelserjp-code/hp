/* ── v10.x: Rubato UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const PRESET_KEYS = Object.keys(RubatoEngine.PRESETS);

  const togEl = document.getElementById('togRubato');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('rubato', !S.engines.rubato);
    togEl.classList.toggle('on', S.engines.rubato);
  });

  function drawChart() {
    const cv = document.getElementById('rbChart');
    if (!cv) return;
    const result = RubatoEngine.compute({
      e: RUBATO_PARAMS.e,
      t0: RUBATO_PARAMS.t0,
      notes: RUBATO_PARAMS.notes,
      dir: RUBATO_PARAMS.dir,
      bpm: 120,
      ppq: 480
    });
    const intervals = result.intervals_ppq;
    const width = cv.offsetWidth || 340;
    const height = 60;
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    const maxValue = Math.max(...intervals);
    const count = intervals.length;
    const barWidth = width / count;
    intervals.forEach((value, index) => {
      const barHeight = Math.max(2, Math.round((value / maxValue) * (height - 4)));
      const t = index / (count - 1 || 1);
      const r = Math.round(0 + t * 0);
      const g = Math.round(100 + t * 129);
      const b = Math.round(200 + t * 55);
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
      ctx.fillRect(Math.floor(index * barWidth) + 1, height - barHeight, Math.max(1, Math.floor(barWidth) - 1), barHeight);
    });
    const analysis = RubatoEngine.analyze(result);
    const ratioDisplay = document.getElementById('rbRatioDisplay');
    if (ratioDisplay) {
      const ratio = result.ratio.toFixed(2);
      const tempoRange = analysis.tempoRange.map(value => Math.round(value)).join('–');
      ratioDisplay.textContent = 'ratio: ' + ratio + '× · instant BPM range: ' + tempoRange + ' · notes: ' + intervals.length;
    }
  }

  let activePreset = null;
  function buildRbPresets() {
    const grid = document.getElementById('rbPresets');
    if (!grid) return;
    grid.innerHTML = '';
    PRESET_KEYS.forEach(key => {
      const preset = RubatoEngine.PRESETS[key];
      const btn = document.createElement('button');
      btn.className = 'rb-preset-btn' + (activePreset === key ? ' on' : '');
      btn.textContent = preset.name.replace(' ', '\n');
      btn.title = preset.name;
      btn.addEventListener('click', () => {
        RUBATO_PARAMS.e = preset.e;
        RUBATO_PARAMS.t0 = preset.t0;
        RUBATO_PARAMS.notes = preset.notes;
        RUBATO_PARAMS.dir = preset.dir;
        activePreset = key;
        syncRbSliders();
        buildRbPresets();
        syncDirButtons();
        drawChart();
      });
      grid.appendChild(btn);
    });
  }

  function syncRbSliders() {
    const eEl = document.getElementById('rbE');
    if (eEl) eEl.value = Math.round(RUBATO_PARAMS.e * 100);
    const eVEl = document.getElementById('rbEV');
    if (eVEl) eVEl.textContent = RUBATO_PARAMS.e.toFixed(2);

    const t0El = document.getElementById('rbT0');
    if (t0El) t0El.value = Math.round(RUBATO_PARAMS.t0 * 100);
    const t0VEl = document.getElementById('rbT0V');
    if (t0VEl) t0VEl.textContent = RUBATO_PARAMS.t0.toFixed(2);

    const nEl = document.getElementById('rbNotes');
    if (nEl) nEl.value = RUBATO_PARAMS.notes;
    const nVEl = document.getElementById('rbNotesV');
    if (nVEl) nVEl.textContent = RUBATO_PARAMS.notes;
  }

  function syncDirButtons() {
    document.querySelectorAll('.rb-dir-btn').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.dir === RUBATO_PARAMS.dir);
    });
  }

  const dirRow = document.getElementById('rbDirRow');
  if (dirRow) {
    dirRow.querySelectorAll('.rb-dir-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        RUBATO_PARAMS.dir = btn.dataset.dir;
        activePreset = null;
        syncDirButtons();
        buildRbPresets();
        drawChart();
      });
    });
  }

  [
    ['rbE', value => { RUBATO_PARAMS.e = parseInt(value) / 100; }, value => (parseInt(value) / 100).toFixed(2)],
    ['rbT0', value => { RUBATO_PARAMS.t0 = parseInt(value) / 100; }, value => (parseInt(value) / 100).toFixed(2)],
    ['rbNotes', value => { RUBATO_PARAMS.notes = parseInt(value); }, value => String(parseInt(value))]
  ].forEach(([id, setter, formatter]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      setter(el.value);
      const valueEl = document.getElementById(id + 'V');
      if (valueEl) valueEl.textContent = formatter(el.value);
      activePreset = null;
      buildRbPresets();
      drawChart();
    });
  });

  syncRbSliders();
  syncDirButtons();
  buildRbPresets();
  drawChart();
});
