/* ── v24.x: Spectral UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function drawSpectrum() {
    const cv = document.getElementById('spCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    cv.width = cv.offsetWidth || 400;
    cv.height = 80;
    ctx.clearRect(0, 0, cv.width, cv.height);

    const chord = typeof S !== 'undefined' && S.chord ? S.chord : null;
    const rootPc = chord ? chord.root : 0;
    const chordIv = chord ? chord.iv : [0, 4, 7];

    const result = SpectralEngine.analyze(rootPc, chordIv, {
      harmonics: SPECTRAL_PARAMS.harmonics,
      timbre: SPECTRAL_PARAMS.timbre,
      rolloff: SPECTRAL_PARAMS.rolloff,
      threshold: SPECTRAL_PARAMS.threshold
    });

    const pcSpectrum = result.pcSpectrum;
    const maxStrength = Math.max(...pcSpectrum, 0.001);
    const width = cv.width;
    const height = cv.height;
    const barWidth = width / 12 - 2;

    ctx.strokeStyle = 'rgba(255,145,0,0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) {
      const yPos = height - y / 4 * height;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(width, yPos);
      ctx.stroke();
    }

    const chordPcs = new Set(chordIv.map(interval => ((rootPc + interval) % 12 + 12) % 12));
    for (let pc = 0; pc < 12; pc++) {
      const strength = pcSpectrum[pc];
      const normalized = strength / maxStrength;
      const x = pc * (width / 12) + 1;
      const barHeight = Math.max(2, normalized * (height - 10));
      const isChord = chordPcs.has(pc);
      const isRoot = pc === rootPc;

      if (isRoot) {
        ctx.fillStyle = '#ff9100';
      } else if (isChord) {
        ctx.fillStyle = 'rgba(255,145,0,0.7)';
      } else {
        ctx.fillStyle = 'rgba(255,145,0,0.25)';
      }
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      ctx.fillStyle = isChord ? '#ff910099' : 'rgba(255,145,0,0.25)';
      ctx.font = '7px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(noteNames[pc], x + barWidth / 2, height - 2);
    }

    const consonanceEl = document.getElementById('spScoreConsonance');
    const brightnessEl = document.getElementById('spScoreBrightness');
    const densityEl = document.getElementById('spScoreDensity');
    if (consonanceEl) consonanceEl.textContent = (result.chordConsonance * 100).toFixed(0) + '%';
    if (brightnessEl) brightnessEl.textContent = (result.brightnessScore * 100).toFixed(0) + '%';
    if (densityEl) densityEl.textContent = (result.harmonicDensity * 100).toFixed(0) + '%';

    const resonantEl = document.getElementById('spResonantPCs');
    if (resonantEl) {
      resonantEl.textContent = chord
        ? result.resonantPCs.map(pc => noteNames[pc]).join('  ·  ')
        : '— chord not yet analyzed —';
    }
  }

  function syncTimbreButtons() {
    document.querySelectorAll('.sp-timbre-btn').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.timbre === SPECTRAL_PARAMS.timbre);
    });
  }

  const timbreRow = document.getElementById('spTimbreRow');
  if (timbreRow) {
    timbreRow.addEventListener('click', event => {
      const btn = event.target.closest('.sp-timbre-btn');
      if (!btn) return;
      SPECTRAL_PARAMS.timbre = btn.dataset.timbre;
      syncTimbreButtons();
      drawSpectrum();
    });
  }

  [
    ['spHarmonics', value => { SPECTRAL_PARAMS.harmonics = parseInt(value); return parseInt(value); }],
    ['spRolloff', value => { SPECTRAL_PARAMS.rolloff = parseInt(value) / 10; return (parseInt(value) / 10).toFixed(1); }],
    ['spThreshold', value => { SPECTRAL_PARAMS.threshold = parseInt(value) / 100; return (parseInt(value) / 100).toFixed(2); }],
    ['spBrightness', value => { SPECTRAL_PARAMS.brightnessBoost = parseInt(value) / 100; return (parseInt(value) / 100).toFixed(1); }],
    ['spConsGate', value => { SPECTRAL_PARAMS.consonanceGate = parseInt(value) / 100; return (parseInt(value) / 100).toFixed(2); }]
  ].forEach(([id, setter]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const display = setter(el.value);
      const valueEl = document.getElementById(id + 'V');
      if (valueEl) valueEl.textContent = display;
      drawSpectrum();
    });
  });

  const velShapeTog = document.getElementById('spVelShape');
  if (velShapeTog) {
    velShapeTog.addEventListener('click', () => {
      SPECTRAL_PARAMS.velShape = !SPECTRAL_PARAMS.velShape;
      velShapeTog.classList.toggle('on', SPECTRAL_PARAMS.velShape);
    });
  }

  const texFilterTog = document.getElementById('spTexFilter');
  if (texFilterTog) {
    texFilterTog.addEventListener('click', () => {
      SPECTRAL_PARAMS.textureFilter = !SPECTRAL_PARAMS.textureFilter;
      texFilterTog.classList.toggle('on', SPECTRAL_PARAMS.textureFilter);
    });
  }

  const togEl = document.getElementById('togSpectral');
  if (togEl) {
    togEl.addEventListener('click', () => {
      syncEngine('spectral', !S.engines.spectral);
    });
  }

  const chordInput = document.getElementById('chordInput');
  if (chordInput) {
    chordInput.addEventListener('input', () => {
      setTimeout(drawSpectrum, 80);
    });
  }

  syncTimbreButtons();
  drawSpectrum();
});
