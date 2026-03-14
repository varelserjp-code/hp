/* ── v25.6: Rhythmic Canons UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof RhythmicCanons === 'undefined') return;

  const togRC = document.getElementById('togRC');
  const modeRow = document.getElementById('rcModeRow');
  const presetsEl = document.getElementById('rcPresets');
  const presetWrap = document.getElementById('rcPresetWrap');
  const presetN = document.getElementById('rcPresetN');
  const nEl = document.getElementById('rcN');
  const nV = document.getElementById('rcNV');
  const voicesEl = document.getElementById('rcVoices');
  const voicesV = document.getElementById('rcVoicesV');
  const messiaenRow = document.getElementById('rcMessiaenRow');
  const messiaenEl = document.getElementById('rcMessiaenPattern');
  const polymeterRow = document.getElementById('rcPolymeterRow');
  const polymeterEl = document.getElementById('rcPolymeterCycles');
  const canvas = document.getElementById('rcPatternCanvas');
  const info = document.getElementById('rcInfo');
  if (!togRC || !modeRow || !canvas) return;

  function drawPattern() {
    const cx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 320;
    canvas.height = 56;
    const W = canvas.width;
    const H = canvas.height;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#0d0600';
    cx.fillRect(0, 0, W, H);

    if (!RC_PARAMS.enabled) {
      cx.fillStyle = 'rgba(255,109,0,0.08)';
      cx.fillRect(0, 0, W, H);
      info.textContent = 'RHYTHMIC CANONS — 無効';
      return;
    }

    const pInfo = RhythmicCanons.getPatternInfo(RC_PARAMS);
    const n = pInfo.n;
    const cellW = W / n;
    const rowH = pInfo.voices.length > 0 ? Math.floor((H - 8) / pInfo.voices.length) : H - 8;

    pInfo.voices.forEach((v, vi) => {
      const y0 = 4 + vi * rowH;
      v.binary.forEach((bit, i) => {
        cx.fillStyle = bit
          ? (vi === 0 ? 'rgba(255,109,0,0.85)' : 'rgba(255,145,0,0.65)')
          : 'rgba(255,109,0,0.06)';
        cx.fillRect(i * cellW + 1, y0, cellW - 2, rowH - 2);
      });
      cx.fillStyle = vi === 0 ? '#ff6d00' : '#ff9100';
      cx.font = '7px Share Tech Mono, monospace';
      cx.textAlign = 'left';
      cx.fillText(v.label + '  density:' + (v.density * 100).toFixed(0) + '%', 2, y0 + rowH - 3);
    });

    if ((RC_PARAMS.mode === 'vuza' || RC_PARAMS.mode === 'tiling') && pInfo.voices.length >= 2) {
      const A = pInfo.voices[0].binary.reduce((acc, b, i) => { if (b) acc.push(i); return acc; }, []);
      const B = pInfo.voices[1].binary.reduce((acc, b, i) => { if (b) acc.push(i); return acc; }, []);
      const valid = RhythmicCanons.validateTiling(A, B, n);
      info.textContent = 'MODE: ' + RC_PARAMS.mode.toUpperCase()
        + '  n=' + n
        + '  TILING: ' + (valid.valid ? 'VALID ✓' : 'partial ' + (valid.coverage * 100).toFixed(0) + '%');
    } else {
      info.textContent = 'MODE: ' + RC_PARAMS.mode.toUpperCase() + '  n=' + n;
    }
  }

  function buildPresets() {
    if (!presetsEl) return;
    presetsEl.innerHTML = '';
    const isVuza = RC_PARAMS.mode === 'vuza' || RC_PARAMS.mode === 'tiling';
    presetWrap.style.display = isVuza ? '' : 'none';
    if (!isVuza) return;
    if (presetN) presetN.textContent = RC_PARAMS.n;
    const presets = RhythmicCanons.getPresets(RC_PARAMS.n);
    presets.forEach((pr, i) => {
      const btn = document.createElement('div');
      btn.className = 'rc-preset-btn' + (RC_PARAMS.presetIndex === i ? ' on' : '');
      btn.textContent = 'P' + (i + 1) + ': [' + pr.A + ']';
      btn.title = pr.label;
      btn.addEventListener('click', () => {
        RC_PARAMS.presetIndex = i;
        presetsEl.querySelectorAll('.rc-preset-btn').forEach((b, j) => b.classList.toggle('on', j === i));
        drawPattern();
      });
      presetsEl.appendChild(btn);
    });
  }

  function updateModeUI() {
    const isVuza = RC_PARAMS.mode === 'vuza' || RC_PARAMS.mode === 'tiling';
    if (presetWrap) presetWrap.style.display = isVuza ? '' : 'none';
    if (messiaenRow) messiaenRow.style.display = RC_PARAMS.mode === 'messiaen' ? 'block' : 'none';
    if (polymeterRow) polymeterRow.style.display = RC_PARAMS.mode === 'polymeter' ? 'block' : 'none';
  }

  togRC.classList.toggle('on', RC_PARAMS.enabled);
  togRC.addEventListener('click', () => {
    RC_PARAMS.enabled = !RC_PARAMS.enabled;
    togRC.classList.toggle('on', RC_PARAMS.enabled);
    drawPattern();
  });

  modeRow.querySelectorAll('.rc-mode-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.mode === RC_PARAMS.mode);
    btn.addEventListener('click', () => {
      RC_PARAMS.mode = btn.dataset.mode;
      modeRow.querySelectorAll('.rc-mode-btn').forEach(b => b.classList.toggle('on', b === btn));
      updateModeUI();
      buildPresets();
      drawPattern();
    });
  });

  nEl.value = RC_PARAMS.n;
  nEl.addEventListener('input', () => {
    RC_PARAMS.n = parseInt(nEl.value);
    nV.textContent = nEl.value;
    RC_PARAMS.presetIndex = 0;
    buildPresets();
    drawPattern();
  });

  voicesEl.value = RC_PARAMS.voices;
  voicesEl.addEventListener('input', () => {
    RC_PARAMS.voices = parseInt(voicesEl.value);
    voicesV.textContent = voicesEl.value;
    drawPattern();
  });

  if (messiaenEl) {
    messiaenEl.value = RC_PARAMS.messiaenPattern.join(',');
    messiaenEl.addEventListener('change', () => {
      const vals = messiaenEl.value.split(',').map(v => parseInt(v.trim())).filter(v => v > 0);
      if (vals.length) RC_PARAMS.messiaenPattern = vals;
      drawPattern();
    });
  }

  if (polymeterEl) {
    polymeterEl.value = RC_PARAMS.polymeterCycles.join(',');
    polymeterEl.addEventListener('change', () => {
      const vals = polymeterEl.value.split(',').map(v => parseInt(v.trim())).filter(v => v > 0);
      if (vals.length) RC_PARAMS.polymeterCycles = vals;
      drawPattern();
    });
  }

  updateModeUI();
  buildPresets();
  drawPattern();
});
