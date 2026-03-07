/* ── v21.0: Scale Mutation UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  function populateSelect() {
    const sel = document.getElementById('smAddSelect');
    if (!sel) return;
    sel.innerHTML = '';
    for (const [catLabel, catScales] of Object.entries(SCALES)) {
      const grp = document.createElement('optgroup');
      grp.label = catLabel;
      for (const key of Object.keys(catScales)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        grp.appendChild(opt);
      }
      sel.appendChild(grp);
    }
  }

  function renderSlots() {
    const el = document.getElementById('smSlots');
    if (!el) return;
    if (!SCALE_MUT_STATE.slots.length) {
      el.innerHTML = '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--text-dim);padding:8px 0;">— スケールを追加してください —</div>';
      renderSmooth();
      renderSeqBar();
      return;
    }
    el.innerHTML = '';
    const expanded = ScaleMutEngine.expandToBars(SCALE_MUT_STATE.slots, S.bars);
    SCALE_MUT_STATE.slots.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'sm-slot';
      row.innerHTML = `
          <div class="sm-slot-scale">${entry.scale}</div>
          <div class="sm-slot-bars">
            <button class="sm-slot-del" data-action="dec" data-idx="${idx}" style="padding:1px 5px;">▼</button>
            <span>${entry.bars}</span> bars
            <button class="sm-slot-del" data-action="inc" data-idx="${idx}" style="padding:1px 5px;">▲</button>
          </div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--text-dim);">→ bar ${(expanded[idx]?.barStart ?? '?') + 1}</div>
          <button class="sm-slot-del" data-action="del" data-idx="${idx}">✕</button>`;
      el.appendChild(row);
    });
    renderSmooth();
    renderSeqBar();
    renderInfoLine();
    renderDiffCanvas();
  }

  function renderSmooth() {
    const el = document.getElementById('smSmoothBar');
    if (!el) return;
    if (SCALE_MUT_STATE.slots.length < 2) {
      el.innerHTML = '<span class="sm-smooth-label">—</span>';
      return;
    }
    const root = S.chord ? S.chord.root % 12 : 0;
    const scores = ScaleMutEngine.smoothnessScores(SCALE_MUT_STATE.slots, root);
    let html = '<span class="sm-smooth-label">SMOOTH</span>';
    scores.forEach((s, i) => {
      const la = SCALE_MUT_STATE.slots[i].scale;
      const lb = SCALE_MUT_STATE.slots[i + 1].scale;
      const r = Math.round(200 * (1 - s));
      const g = Math.round(100 * s + 30);
      const b = Math.round(200 * s);
      html += `<div class="sm-smooth-seg" title="${la} → ${lb}: ${(s * 100).toFixed(0)}%" style="background:rgb(${r},${g},${b});"></div>`;
    });
    el.innerHTML = html;
  }

  function renderSeqBar() {
    const el = document.getElementById('smSeqBar');
    if (!el) return;
    if (!SCALE_MUT_STATE.slots.length) {
      el.innerHTML = '';
      return;
    }
    const colors = ['#8c3fff','#6a20cc','#a855f7','#c084fc','#7e22ce','#9333ea'];
    let html = '';
    SCALE_MUT_STATE.slots.forEach((entry, idx) => {
      const col = colors[idx % colors.length];
      const flex = Math.max(1, entry.bars);
      html += `<div class="sm-seq-seg" style="flex:${flex};background:${col}18;border:1px solid ${col}55;color:${col}cc;" title="${entry.scale} · ${entry.bars} bars">${entry.scale.slice(0,10)} <span style="opacity:.6;">${entry.bars}b</span></div>`;
    });
    el.innerHTML = html;
  }

  function renderInfoLine() {
    const el = document.getElementById('smInfoLine');
    if (!el || !SCALE_MUT_STATE.slots.length) return;
    const totalBars = SCALE_MUT_STATE.slots.reduce((s, e) => s + e.bars, 0);
    const root = S.chord ? S.chord.root % 12 : 0;
    const scores = ScaleMutEngine.smoothnessScores(SCALE_MUT_STATE.slots, root);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length * 100).toFixed(0) : '—';
    const names = SCALE_MUT_STATE.slots.map(e => e.scale).join(' → ');
    el.textContent = `${names}  |  ${SCALE_MUT_STATE.slots.length} scales · ${totalBars} bars · smooth avg: ${avg}%`;
  }

  function renderDiffCanvas() {
    const canvas = document.getElementById('smDiffCanvas');
    const legEl = document.getElementById('smDiffLegend');
    if (!canvas) return;
    const slots = SCALE_MUT_STATE.slots;
    const n = slots.length;
    const W = canvas.parentElement ? canvas.parentElement.clientWidth - 2 : 400;
    canvas.width = Math.max(W, 100);
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (n < 2) {
      ctx.fillStyle = 'rgba(140,63,255,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(140,63,255,0.35)';
      ctx.font = '9px "Share Tech Mono",monospace';
      ctx.textAlign = 'center';
      ctx.fillText('— 2スロット以上追加するとビジュアライズが表示されます —', canvas.width / 2, 38);
      if (legEl) legEl.innerHTML = '';
      return;
    }

    const root = S.chord ? S.chord.root % 12 : 0;
    function getIV(iv, r) {
      if (typeof PCSetEngine === 'undefined') return new Array(6).fill(0);
      const pcs = iv.map(i => ((r + i) % 12 + 12) % 12);
      return PCSetEngine.computeIV(pcs);
    }

    const pairCount = n - 1;
    const colW = Math.floor(canvas.width / Math.max(pairCount, 1));
    const IVLABEL = ['m2/M7','M2/m7','m3/M6','M3/m6','P4/P5','TT'];
    const ROW_H = Math.floor(canvas.height / 6);
    let legendHtml = '';

    for (let p = 0; p < pairCount; p++) {
      const ivA = getIV(slots[p].iv, root);
      const ivB = getIV(slots[p + 1].iv, root);
      const x0 = p * colW;
      const x1 = (p === pairCount - 1) ? canvas.width : x0 + colW;
      const segW = x1 - x0;
      const ct = ScaleMutEngine.commonToneScore(slots[p].iv, root, slots[p + 1].iv, root);

      for (let dim = 0; dim < 6; dim++) {
        const diff = Math.abs(ivA[dim] - ivB[dim]);
        const intensity = Math.min(1, diff / 4);
        const h = 270 - intensity * 120;
        const s = 60 + intensity * 30;
        const l = 20 + intensity * 30;
        const y0 = dim * ROW_H;
        const y1 = (dim === 5) ? canvas.height : y0 + ROW_H;
        ctx.fillStyle = `hsl(${h},${s}%,${l}%)`;
        ctx.fillRect(x0, y0, segW - 1, y1 - y0 - 1);
        if (diff > 0 && segW > 24) {
          ctx.fillStyle = `hsla(${h},80%,85%,0.9)`;
          ctx.font = `${Math.min(9, ROW_H - 2)}px "Share Tech Mono",monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(String(diff), x0 + segW / 2, y0 + ROW_H * 0.72);
        }
      }

      const ctPct = Math.round(ct * 100);
      const ctCol = `hsl(${Math.round(ct * 120)},70%,60%)`;
      ctx.fillStyle = ctCol;
      ctx.font = '8px "Share Tech Mono",monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CT${ctPct}%`, x0 + segW / 2, 10);

      if (p < pairCount - 1) {
        ctx.strokeStyle = 'rgba(140,63,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1 - 0.5, 0);
        ctx.lineTo(x1 - 0.5, canvas.height);
        ctx.stroke();
      }

      legendHtml += `<span class="sm-diff-pair" style="color:${ctCol};">${slots[p].scale.slice(0,8)}→${slots[p + 1].scale.slice(0,8)}: CT${ctPct}%</span>`;
    }

    ctx.fillStyle = 'rgba(140,63,255,0.6)';
    ctx.font = '7px "Share Tech Mono",monospace';
    ctx.textAlign = 'right';
    for (let dim = 0; dim < 6; dim++) {
      const y = dim * ROW_H + ROW_H * 0.7;
      ctx.fillText(IVLABEL[dim], canvas.width - 2, y);
    }

    if (legEl) legEl.innerHTML = legendHtml;
  }

  function buildPresets() {
    const el = document.getElementById('smPresets');
    if (!el) return;
    el.innerHTML = '';
    for (const [, preset] of Object.entries(ScaleMutEngine.SCALE_MUT_PRESETS)) {
      const btn = document.createElement('div');
      btn.className = 'sm-preset-btn';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        SCALE_MUT_STATE.slots = preset.scales.map(scaleName => {
          const d = ALL_SCALES[scaleName];
          return { scale: scaleName, iv: d ? d.iv : [0,2,4,5,7,9,11], bars: 4 };
        });
        renderSlots();
        document.querySelectorAll('.sm-preset-btn').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
      });
      el.appendChild(btn);
    }
  }

  const slotsEl = document.getElementById('smSlots');
  if (slotsEl) {
    slotsEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'del') {
        SCALE_MUT_STATE.slots.splice(idx, 1);
      } else if (action === 'inc') {
        SCALE_MUT_STATE.slots[idx].bars = Math.min(32, SCALE_MUT_STATE.slots[idx].bars + 1);
      } else if (action === 'dec') {
        SCALE_MUT_STATE.slots[idx].bars = Math.max(1, SCALE_MUT_STATE.slots[idx].bars - 1);
      }
      document.querySelectorAll('.sm-preset-btn').forEach(b => b.classList.remove('on'));
      renderSlots();
    });
  }

  const addSelEl = document.getElementById('smAddSelect');
  const addBarsEl = document.getElementById('smAddBars');
  const addBtnEl = document.getElementById('smAddBtn');
  if (addBtnEl && addSelEl && addBarsEl) {
    function doAdd() {
      const key = addSelEl.value;
      const bars = Math.max(1, Math.min(32, parseInt(addBarsEl.value) || 4));
      const d = ALL_SCALES[key];
      if (!d) return;
      SCALE_MUT_STATE.slots.push({ scale: key, iv: d.iv, bars });
      document.querySelectorAll('.sm-preset-btn').forEach(b => b.classList.remove('on'));
      renderSlots();
    }
    addBtnEl.addEventListener('click', doAdd);
  }

  const togEl = document.getElementById('togScaleMut');
  const ctrlEl = document.getElementById('scaleMutControls');
  if (togEl) {
    togEl.addEventListener('click', () => {
      SCALE_MUT_STATE.enabled = !SCALE_MUT_STATE.enabled;
      togEl.classList.toggle('on', SCALE_MUT_STATE.enabled);
      if (ctrlEl) ctrlEl.style.display = SCALE_MUT_STATE.enabled ? 'block' : 'none';
    });
  }

  const transRow = document.getElementById('smTransModeRow');
  if (transRow) {
    transRow.addEventListener('click', e => {
      const btn = e.target.closest('.sm-mode-btn');
      if (!btn) return;
      SCALE_MUT_STATE.transMode = btn.dataset.mode;
      transRow.querySelectorAll('.sm-mode-btn').forEach(b => b.classList.toggle('on', b === btn));
    });
  }

  const transLen = document.getElementById('smTransLen');
  if (transLen) {
    transLen.addEventListener('input', () => {
      SCALE_MUT_STATE.transLen = parseInt(transLen.value);
      const vEl = document.getElementById('smTransLenV');
      if (vEl) vEl.textContent = SCALE_MUT_STATE.transLen;
    });
  }

  const loopTog = document.getElementById('smLoopTog');
  if (loopTog) {
    loopTog.addEventListener('click', () => {
      SCALE_MUT_STATE.loop = !SCALE_MUT_STATE.loop;
      loopTog.classList.toggle('on', SCALE_MUT_STATE.loop);
    });
  }

  populateSelect();
  buildPresets();
  renderSlots();
  window.refreshScaleMutUI = function() { populateSelect(); renderSlots(); };
  if (typeof window.addUpdateTheoryHook === 'function') {
    window.addUpdateTheoryHook(() => {
      renderDiffCanvas();
    });
  }
});
