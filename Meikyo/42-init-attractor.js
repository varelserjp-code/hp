/* ── v22.0: Attractor Sequencer UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const PARAM_LABELS = {
    lorenz: { a: 'A (σ)', b: 'B (ρ)', c: 'C (β)', aMin: 1, aMax: 30, bMin: 1, bMax: 60, cMin: 0.1, cMax: 15 },
    rossler: { a: 'A', b: 'B', c: 'C', aMin: 0.01, aMax: 1, bMin: 0.01, bMax: 5, cMin: 1, cMax: 20 },
    thomas: { a: 'B (diss)', b: '—', c: '—', aMin: 0.05, aMax: 0.5, bMin: 0, bMax: 1, cMin: 0, cMax: 1 }
  };

  function drawAttractorCanvas() {
    const cv = document.getElementById('atCanvas');
    if (!cv) return;
    cv.width = cv.offsetWidth || 400;
    cv.height = 120;
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, cv.width, cv.height);

    const type = ATTRACTOR_STATE.type;
    const inst = AttractorEngine.create(type, {
      a: ATTRACTOR_STATE.a,
      b: ATTRACTOR_STATE.b,
      c: ATTRACTOR_STATE.c,
      dt: ATTRACTOR_STATE.dt
    });
    inst.stepN(Math.min(ATTRACTOR_STATE.warmup, 500));

    const steps = 600;
    const pts = [];
    for (let index = 0; index < steps; index++) {
      inst.step();
      pts.push({ ...inst.state });
    }

    const xs = pts.map(point => point.x);
    const ys = pts.map(point => point.y);
    const zs = pts.map(point => point.z);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    const mx = xMax === xMin ? 1 : xMax - xMin;
    const my = yMax === yMin ? 1 : yMax - yMin;
    const mz = zMax === zMin ? 1 : zMax - zMin;

    const pad = 10;
    const width = cv.width - pad * 2;
    const height = cv.height - pad * 2;
    const colors = { lorenz: '#ffcc00', rossler: '#ff6b35', thomas: '#1de9b6' };
    const baseColor = colors[type] || '#ffcc00';

    cx.lineWidth = 0.8;
    for (let index = 1; index < pts.length; index++) {
      const px = pad + (pts[index - 1].x - xMin) / mx * width;
      const py = pad + (1 - (pts[index - 1].y - yMin) / my) * height;
      const nx = pad + (pts[index].x - xMin) / mx * width;
      const ny = pad + (1 - (pts[index].y - yMin) / my) * height;
      const alpha = 0.15 + 0.55 * (pts[index].z - zMin) / mz;
      cx.strokeStyle = baseColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
      cx.beginPath();
      cx.moveTo(px, py);
      cx.lineTo(nx, ny);
      cx.stroke();
    }
  }

  function syncParamUI() {
    const type = ATTRACTOR_STATE.type;
    const labels = PARAM_LABELS[type] || PARAM_LABELS.lorenz;
    const lA = document.getElementById('atLabelA');
    const lB = document.getElementById('atLabelB');
    const lC = document.getElementById('atLabelC');
    if (lA) lA.textContent = labels.a;
    if (lB) lB.textContent = labels.b;
    if (lC) lC.textContent = labels.c;

    const slA = document.getElementById('atParamA');
    const slB = document.getElementById('atParamB');
    const slC = document.getElementById('atParamC');
    if (slA) {
      slA.min = labels.aMin;
      slA.max = labels.aMax;
      slA.value = ATTRACTOR_STATE.a;
      document.getElementById('atParamAV').textContent = parseFloat(ATTRACTOR_STATE.a).toFixed(2);
    }
    if (slB) {
      slB.min = labels.bMin;
      slB.max = labels.bMax;
      slB.value = ATTRACTOR_STATE.b;
      document.getElementById('atParamBV').textContent = parseFloat(ATTRACTOR_STATE.b).toFixed(2);
    }
    if (slC) {
      slC.min = labels.cMin;
      slC.max = labels.cMax;
      slC.value = ATTRACTOR_STATE.c;
      document.getElementById('atParamCV').textContent = parseFloat(ATTRACTOR_STATE.c).toFixed(2);
    }

    if (slB) slB.parentElement.style.opacity = type === 'thomas' ? '0.35' : '1';
    if (slC) slC.parentElement.style.opacity = type === 'thomas' ? '0.35' : '1';
  }

  function buildPresets() {
    const el = document.getElementById('atPresets');
    if (!el) return;
    el.innerHTML = '';
    for (const [key, pr] of Object.entries(AttractorEngine.PRESETS)) {
      const btn = document.createElement('div');
      btn.className = 'at-preset-btn';
      btn.dataset.atype = pr.type;
      btn.textContent = pr.label;
      if (key === ATTRACTOR_STATE.activePreset) btn.classList.add('on');
      btn.addEventListener('click', () => {
        ATTRACTOR_STATE.type = pr.type;
        ATTRACTOR_STATE.a = pr.a;
        ATTRACTOR_STATE.b = pr.b;
        ATTRACTOR_STATE.c = pr.c;
        ATTRACTOR_STATE.dt = pr.dt;
        ATTRACTOR_STATE.warmup = pr.warmup;
        ATTRACTOR_STATE.activePreset = key;
        document.querySelectorAll('.at-type-btn').forEach(button => button.classList.toggle('on', button.dataset.type === pr.type));
        document.querySelectorAll('.at-preset-btn').forEach(button => button.classList.toggle('on', button === btn));
        const dtEl = document.getElementById('atDt');
        if (dtEl) {
          dtEl.value = Math.round(pr.dt * 1000);
          document.getElementById('atDtV').textContent = pr.dt.toFixed(3);
        }
        const wuEl = document.getElementById('atWarmup');
        if (wuEl) {
          wuEl.value = pr.warmup;
          document.getElementById('atWarmupV').textContent = pr.warmup;
        }
        syncParamUI();
        setTimeout(drawAttractorCanvas, 50);
      });
      el.appendChild(btn);
    }
  }

  const togEl = document.getElementById('togAttractor');
  const ctrlEl = document.getElementById('attractorControls');
  const legacyPanel = document.getElementById('lorenzLegacyPanel');
  function syncLegacyPanelVisibility() {
    if (legacyPanel) legacyPanel.style.display = ATTRACTOR_STATE.enabled ? 'none' : '';
  }

  syncLegacyPanelVisibility();
  if (togEl) {
    togEl.addEventListener('click', () => {
      ATTRACTOR_STATE.enabled = !ATTRACTOR_STATE.enabled;
      togEl.classList.toggle('on', ATTRACTOR_STATE.enabled);
      if (ctrlEl) {
        ctrlEl.style.display = ATTRACTOR_STATE.enabled ? 'block' : 'none';
        if (ATTRACTOR_STATE.enabled) setTimeout(drawAttractorCanvas, 50);
      }
      syncLegacyPanelVisibility();
    });
  }

  const typeRow = document.getElementById('atTypeRow');
  if (typeRow) {
    typeRow.addEventListener('click', event => {
      const btn = event.target.closest('.at-type-btn');
      if (!btn) return;
      const type = btn.dataset.type;
      ATTRACTOR_STATE.type = type;
      const di = AttractorEngine.DEFAULT_INIT[type];
      const dp = AttractorEngine.DEFAULT_PARAMS[type];
      ATTRACTOR_STATE.a = dp.a;
      ATTRACTOR_STATE.b = dp.b;
      ATTRACTOR_STATE.c = dp.c;
      ATTRACTOR_STATE.dt = di.dt;
      ATTRACTOR_STATE.warmup = di.warmup;
      ATTRACTOR_STATE.activePreset = '';
      typeRow.querySelectorAll('.at-type-btn').forEach(button => button.classList.toggle('on', button === btn));
      document.querySelectorAll('.at-preset-btn').forEach(button => button.classList.remove('on'));
      syncParamUI();
      setTimeout(drawAttractorCanvas, 50);
    });
  }

  ['A', 'B', 'C'].forEach(axis => {
    const sl = document.getElementById('atParam' + axis);
    const vl = document.getElementById('atParam' + axis + 'V');
    if (!sl || !vl) return;
    sl.addEventListener('input', () => {
      const value = parseFloat(sl.value);
      ATTRACTOR_STATE[axis.toLowerCase()] = value;
      vl.textContent = value.toFixed(2);
      ATTRACTOR_STATE.activePreset = '';
      document.querySelectorAll('.at-preset-btn').forEach(button => button.classList.remove('on'));
      setTimeout(drawAttractorCanvas, 80);
    });
  });

  const dtSl = document.getElementById('atDt');
  if (dtSl) {
    dtSl.addEventListener('input', () => {
      ATTRACTOR_STATE.dt = parseInt(dtSl.value) / 1000;
      document.getElementById('atDtV').textContent = ATTRACTOR_STATE.dt.toFixed(3);
      setTimeout(drawAttractorCanvas, 80);
    });
  }

  const wuSl = document.getElementById('atWarmup');
  if (wuSl) {
    wuSl.addEventListener('input', () => {
      ATTRACTOR_STATE.warmup = parseInt(wuSl.value);
      document.getElementById('atWarmupV').textContent = ATTRACTOR_STATE.warmup;
    });
  }

  ['X', 'Y', 'Z'].forEach(axis => {
    const sel = document.getElementById('atMap' + axis);
    if (sel) sel.addEventListener('change', () => { ATTRACTOR_STATE['map' + axis] = sel.value; });
    const sc = document.getElementById('atScale' + axis);
    const scV = document.getElementById('atScale' + axis + 'V');
    if (sc && scV) {
      sc.addEventListener('input', () => {
        ATTRACTOR_STATE['scale' + axis] = parseInt(sc.value);
        scV.textContent = ATTRACTOR_STATE['scale' + axis] + '%';
      });
    }
  });

  ATTRACTOR_STATE.enabled = false;
  buildPresets();
  syncParamUI();
});
