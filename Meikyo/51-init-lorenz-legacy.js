/* ── v12.x: Legacy Lorenz Panel UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togLorenz');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('lorenz', !S.engines.lorenz);
    togEl.classList.toggle('on', S.engines.lorenz);
  });

  function buildLzPresets() {
    const row = document.getElementById('lzPresetRow');
    if (!row) return;
    row.innerHTML = '';
    Object.entries(LORENZ_PARAMS.PRESETS).forEach(([key, pr]) => {
      const btn = document.createElement('button');
      btn.className = 'lz-preset-btn' + (LORENZ_PARAMS.activePreset === key ? ' on' : '');
      btn.textContent = pr.label;
      btn.addEventListener('click', () => {
        LORENZ_PARAMS.sigma = pr.sigma;
        LORENZ_PARAMS.rho = pr.rho;
        LORENZ_PARAMS.beta = pr.beta;
        LORENZ_PARAMS.dt = pr.dt;
        LORENZ_PARAMS.warmup = pr.warmup;
        LORENZ_PARAMS.activePreset = key;
        syncLzSliders();
        buildLzPresets();
        lzPreview();
      });
      row.appendChild(btn);
    });
  }

  function syncLzSliders() {
    const set = (id, value, formatter) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
      const valueEl = document.getElementById(id + 'V');
      if (valueEl) valueEl.textContent = formatter(value);
    };
    set('lzSigma', LORENZ_PARAMS.sigma, value => (+value).toFixed(1));
    set('lzRho', LORENZ_PARAMS.rho, value => (+value).toFixed(1));
    set('lzBeta', LORENZ_PARAMS.beta, value => (+value).toFixed(2));
    set('lzDt', Math.round(LORENZ_PARAMS.dt * 1000), value => (value / 1000).toFixed(3));
    set('lzWarmup', LORENZ_PARAMS.warmup, value => String(value));
  }

  let rafId = null;
  function lzPreview() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const cv = document.getElementById('lzViz');
    const sd = document.getElementById('lzStateDisplay');
    if (!cv) return;
    const inst = LorenzAttractor.create({
      sigma: LORENZ_PARAMS.sigma,
      rho: LORENZ_PARAMS.rho,
      beta: LORENZ_PARAMS.beta,
      dt: LORENZ_PARAMS.dt
    });
    inst.stepN(LORENZ_PARAMS.warmup);
    const width = cv.offsetWidth || 340;
    const height = 80;
    const buffer = [];
    const pointCount = width;
    for (let index = 0; index < pointCount; index++) {
      inst.step();
      buffer.push({ x: inst.state.x, z: inst.state.z });
    }
    cv.width = width;
    cv.height = height;
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, width, height);
    const xs = buffer.map(point => point.x);
    const zs = buffer.map(point => point.z);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    cx.strokeStyle = 'rgba(0,229,255,0.7)';
    cx.lineWidth = 1.2;
    cx.shadowColor = 'rgba(0,229,255,0.3)';
    cx.shadowBlur = 5;
    cx.beginPath();
    buffer.forEach((point, index) => {
      const px = xMax === xMin ? width / 2 : ((point.x - xMin) / (xMax - xMin)) * (width - 2) + 1;
      const py = zMax === zMin ? height / 2 : height - 1 - ((point.z - zMin) / (zMax - zMin)) * (height - 2);
      if (index === 0) cx.moveTo(px, py);
      else cx.lineTo(px, py);
    });
    cx.stroke();
    cx.shadowBlur = 0;
    if (sd) {
      const normalized = inst.normalized();
      sd.textContent = 'x: ' + inst.state.x.toFixed(2)
        + ' · y: ' + inst.state.y.toFixed(2)
        + ' · z: ' + inst.state.z.toFixed(2)
        + '  [' + normalized.x + '·' + normalized.y + '·' + normalized.z + ']';
    }
  }

  [
    ['lzSigma', value => { LORENZ_PARAMS.sigma = parseFloat(value); }, value => (+value).toFixed(1)],
    ['lzRho', value => { LORENZ_PARAMS.rho = parseFloat(value); }, value => (+value).toFixed(1)],
    ['lzBeta', value => { LORENZ_PARAMS.beta = parseFloat(value); }, value => (+value).toFixed(2)],
    ['lzDt', value => { LORENZ_PARAMS.dt = parseInt(value) / 1000; }, value => (parseInt(value) / 1000).toFixed(3)],
    ['lzWarmup', value => { LORENZ_PARAMS.warmup = parseInt(value); }, value => String(value)]
  ].forEach(([id, setter, formatter]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      setter(el.value);
      document.getElementById(id + 'V').textContent = formatter(el.value);
      LORENZ_PARAMS.activePreset = 'custom';
      buildLzPresets();
      lzPreview();
    });
  });

  syncLzSliders();
  buildLzPresets();
  lzPreview();
});
