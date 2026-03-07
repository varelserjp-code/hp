/* ── v23.0: CC Automation UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const tog = document.getElementById('togCCA');
  const presetsEl = document.getElementById('ccaPresets');
  const lanesEl = document.getElementById('ccaLanes');
  const infoEl = document.getElementById('ccaInfo');
  const canvas = document.getElementById('ccaCanvas');
  if (!tog || !presetsEl || !lanesEl) return;

  const state = CC_AUTO_STATE;
  const engine = CCAutoEngine;
  const ccNames = engine.CC_NAMES;
  const waveKeys = Object.keys(engine.WAVE_SHAPES);

  tog.classList.toggle('on', state.enabled);
  tog.addEventListener('click', () => {
    state.enabled = !state.enabled;
    tog.classList.toggle('on', state.enabled);
    renderInfo();
  });

  function buildPresets() {
    presetsEl.innerHTML = '';
    for (const [, preset] of Object.entries(engine.PRESETS)) {
      const btn = document.createElement('button');
      btn.className = 'cca-preset-btn';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        preset.lanes.forEach((presetLane, index) => {
          if (index < state.lanes.length) Object.assign(state.lanes[index], presetLane);
        });
        for (let index = preset.lanes.length; index < state.lanes.length; index++) {
          state.lanes[index].enabled = false;
        }
        renderLanes();
        renderInfo();
        drawCanvas();
      });
      presetsEl.appendChild(btn);
    }
  }

  function renderLanes() {
    lanesEl.innerHTML = '';
    state.lanes.forEach((lane, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'cca-lane' + (lane.enabled ? ' active' : '');

      const head = document.createElement('div');
      head.className = 'cca-lane-head';
      const togDiv = document.createElement('div');
      togDiv.className = 'cca-lane-tog' + (lane.enabled ? ' on' : '');
      togDiv.addEventListener('click', () => {
        lane.enabled = !lane.enabled;
        wrap.classList.toggle('active', lane.enabled);
        togDiv.classList.toggle('on', lane.enabled);
        bodyRow.classList.toggle('disabled', !lane.enabled);
        renderInfo();
        drawCanvas();
      });
      const lbl = document.createElement('span');
      lbl.className = 'cca-lane-label';
      lbl.textContent = 'LANE ' + (idx + 1);
      const ccName = document.createElement('span');
      ccName.className = 'cca-lane-cc-name';
      ccName.textContent = 'CC' + lane.cc + ' ' + (ccNames[lane.cc] || '');
      head.append(togDiv, lbl, ccName);

      const bodyRow = document.createElement('div');
      bodyRow.className = 'cca-lane-body' + (lane.enabled ? '' : ' disabled');

      const ccCtrl = makeCtrl('CC#');
      const ccIn = document.createElement('input');
      ccIn.type = 'number';
      ccIn.className = 'cca-num';
      ccIn.min = 0;
      ccIn.max = 127;
      ccIn.value = lane.cc;
      ccIn.addEventListener('input', () => {
        lane.cc = Math.max(0, Math.min(127, parseInt(ccIn.value) || 0));
        ccName.textContent = 'CC' + lane.cc + ' ' + (ccNames[lane.cc] || '');
        drawCanvas();
      });
      ccCtrl.append(ccIn);

      const chCtrl = makeCtrl('CH');
      const chIn = document.createElement('input');
      chIn.type = 'number';
      chIn.className = 'cca-num';
      chIn.min = 1;
      chIn.max = 16;
      chIn.value = lane.channel;
      chIn.addEventListener('input', () => {
        lane.channel = Math.max(1, Math.min(16, parseInt(chIn.value) || 16));
      });
      chCtrl.append(chIn);

      const shpCtrl = makeCtrl('SHAPE');
      const shpSel = document.createElement('select');
      shpSel.className = 'cca-select';
      waveKeys.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        if (key === lane.shape) option.selected = true;
        shpSel.appendChild(option);
      });
      shpSel.addEventListener('change', () => {
        lane.shape = shpSel.value;
        stepRow.style.display = lane.shape === 'Step Seq' ? 'flex' : 'none';
        drawCanvas();
      });
      shpCtrl.append(shpSel);

      const cycCtrl = makeCtrl('CYCLES');
      const cycIn = document.createElement('input');
      cycIn.type = 'number';
      cycIn.className = 'cca-num';
      cycIn.min = 0.0625;
      cycIn.max = 16;
      cycIn.step = 0.125;
      cycIn.value = lane.cycles;
      cycIn.addEventListener('input', () => {
        lane.cycles = Math.max(0.0625, parseFloat(cycIn.value) || 1);
        drawCanvas();
      });
      cycCtrl.append(cycIn);

      const minCtrl = makeSliderCtrl('MIN', 0, 127, lane.minVal, value => {
        lane.minVal = value;
        drawCanvas();
      });
      const maxCtrl = makeSliderCtrl('MAX', 0, 127, lane.maxVal, value => {
        lane.maxVal = value;
        drawCanvas();
      });

      bodyRow.append(ccCtrl, chCtrl, shpCtrl, cycCtrl, minCtrl, maxCtrl);

      const row2 = document.createElement('div');
      row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px;';
      const smCtrl = makeSliderCtrl('SMOOTH', 0, 100, Math.round(lane.smooth * 100), value => {
        lane.smooth = value / 100;
        drawCanvas();
      });
      const phCtrl = makeSliderCtrl('PHASE°', 0, 360, lane.phase, value => {
        lane.phase = value;
        drawCanvas();
      });
      const glCtrl = makeCtrl('GLIDE');
      const glTog = document.createElement('div');
      glTog.className = 'cca-lane-tog' + (lane.glide ? ' on' : '');
      glTog.style.marginTop = '4px';
      glTog.addEventListener('click', () => {
        lane.glide = !lane.glide;
        glTog.classList.toggle('on', lane.glide);
        drawCanvas();
      });
      glCtrl.append(glTog);
      row2.append(smCtrl, phCtrl, glCtrl);

      const stepRow = document.createElement('div');
      stepRow.className = 'cca-step-row';
      stepRow.style.display = lane.shape === 'Step Seq' ? 'flex' : 'none';
      lane.steps.forEach((stepValue, stepIndex) => {
        const cell = document.createElement('div');
        cell.className = 'cca-step-cell';
        const bar = document.createElement('div');
        bar.className = 'cca-step-bar';
        bar.style.height = Math.round(stepValue / 127 * 100) + '%';
        const rng = document.createElement('input');
        rng.type = 'range';
        rng.min = 0;
        rng.max = 127;
        rng.value = stepValue;
        rng.addEventListener('input', () => {
          lane.steps[stepIndex] = parseInt(rng.value);
          bar.style.height = Math.round(lane.steps[stepIndex] / 127 * 100) + '%';
          drawCanvas();
        });
        cell.append(bar, rng);
        stepRow.appendChild(cell);
      });

      wrap.append(head, bodyRow, row2, stepRow);
      lanesEl.appendChild(wrap);
    });
  }

  function makeCtrl(label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cca-ctrl';
    const labelEl = document.createElement('div');
    labelEl.className = 'cca-ctrl-label';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
    return wrapper;
  }

  function makeSliderCtrl(label, min, max, value, onChange) {
    const wrapper = makeCtrl(label);
    const row = document.createElement('div');
    row.className = 'cca-slider-row';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'slider';
    slider.min = min;
    slider.max = max;
    slider.value = value;
    const valueEl = document.createElement('span');
    valueEl.className = 'cca-val';
    valueEl.textContent = value;
    slider.addEventListener('input', () => {
      const nextValue = parseInt(slider.value);
      valueEl.textContent = nextValue;
      onChange(nextValue);
    });
    row.append(slider, valueEl);
    wrapper.appendChild(row);
    return wrapper;
  }

  function drawCanvas() {
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = 60;
    const cx = canvas.getContext('2d');
    cx.clearRect(0, 0, canvas.width, canvas.height);
    const colors = ['#00e5ff', '#8c3fff', '#1de9b6', '#ffcc00', '#ff4081', '#00bcd4', '#ff9800', '#69f0ae'];
    const enabledLanes = state.lanes.filter(lane => lane.enabled);
    if (!enabledLanes.length) {
      cx.fillStyle = 'rgba(0,229,255,.15)';
      cx.font = '9px Share Tech Mono,monospace';
      cx.fillText('NO ACTIVE LANES', 12, 34);
      return;
    }
    enabledLanes.forEach((lane, index) => {
      cx.strokeStyle = colors[index % 8];
      cx.lineWidth = 1.5;
      cx.globalAlpha = 0.7;
      cx.beginPath();
      const points = 80;
      const cycles = lane.cycles || 1;
      const phaseOffset = (lane.phase || 0) / 360;
      for (let x = 0; x < points; x++) {
        const t = ((x / points) * cycles + phaseOffset) % 1.0;
        let norm;
        if (lane.shape === 'Random Walk' || lane.shape === 'Tension') {
          norm = 0.5;
        } else if (lane.shape === 'Step Seq') {
          norm = engine.genLaneEvents ? 0.5 : (() => {
            const stepIndex = Math.floor(t * lane.steps.length) % lane.steps.length;
            return lane.steps[stepIndex] / 127;
          })();
        } else {
          const fn = engine.WAVE_SHAPES[lane.shape] || engine.WAVE_SHAPES.Sine;
          norm = fn(t);
        }
        const minN = (lane.minVal || 0) / 127;
        const maxN = (lane.maxVal || 127) / 127;
        const value = minN + norm * (maxN - minN);
        const px = x / points * canvas.width;
        const py = canvas.height - value * canvas.height * 0.85 - 4;
        if (x === 0) cx.moveTo(px, py);
        else cx.lineTo(px, py);
      }
      cx.stroke();
    });
    cx.globalAlpha = 1;
  }

  function renderInfo() {
    if (!infoEl) return;
    const active = state.lanes.filter(lane => lane.enabled);
    if (!state.enabled || !active.length) {
      infoEl.textContent = 'CC AUTOMATION — ' + (state.enabled ? '有効 (レーン無効)' : '無効');
      return;
    }
    infoEl.textContent = 'ACTIVE LANES: ' + active.map(lane => 'Lane' + (state.lanes.indexOf(lane) + 1) + ' CC' + lane.cc + '(' + lane.shape + ')').join(' / ');
  }

  buildPresets();
  renderLanes();
  renderInfo();
  drawCanvas();
  window.refreshCCAutoUI = function() {
    renderLanes();
    renderInfo();
    drawCanvas();
  };
});
