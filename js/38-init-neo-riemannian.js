/* ── v25.3: Neo-Riemannian UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof NREngine === 'undefined') return;

  let nrCurrent = null;
  let nrPathChords = [];

  function resetToCurrent() {
    nrCurrent = S.chord ? { ...S.chord } : null;
    nrPathChords = [];
    renderCurChord();
    drawTonnetz();
  }

  function renderCurChord() {
    const el = document.getElementById('nrCurChord');
    if (!el) return;
    if (!nrCurrent) {
      el.textContent = '— コードを入力してください —';
      return;
    }
    el.textContent = (nrCurrent.rootName || '') + (nrCurrent.quality || '') + '  ' + (nrCurrent.name || '');
  }

  function drawTonnetz() {
    const canvas = document.getElementById('nrCanvas');
    if (!canvas) return;
    const W = canvas.parentElement ? Math.max(canvas.parentElement.clientWidth - 2, 200) : 400;
    canvas.width = W;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, canvas.height);

    ctx.fillStyle = 'rgba(10,0,30,0.6)';
    ctx.fillRect(0, 0, W, canvas.height);

    const CX = W / 2;
    const CY = canvas.height / 2;
    const CELL_W = 38;
    const CELL_H = 28;
    function toCanvas(tx, ty) {
      return {
        x: CX + tx * CELL_W + ty * CELL_W * 0.5,
        y: CY - ty * CELL_H
      };
    }

    const NN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    for (let ty = -2; ty <= 2; ty++) {
      for (let tx = -3; tx <= 3; tx++) {
        const pc = ((tx * 7 + ty * 4) % 12 + 12) % 12;
        const pos = toCanvas(tx, ty);
        if (pos.x < -20 || pos.x > W + 20 || pos.y < -20 || pos.y > canvas.height + 20) continue;

        let isActive = false;
        let isRoot = false;
        if (nrCurrent && nrCurrent.iv) {
          const chordPcs = nrCurrent.iv.map(i => ((nrCurrent.root + i) % 12 + 12) % 12);
          if (chordPcs.includes(pc)) isActive = true;
          if (pc === (nrCurrent.root % 12 + 12) % 12) isRoot = true;
        }

        const isOnPath = nrPathChords.some(c => {
          if (!c.iv) return false;
          const pcs = c.iv.map(i => ((c.root + i) % 12 + 12) % 12);
          return pcs.includes(pc);
        });

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isRoot ? 10 : isActive ? 8 : isOnPath ? 7 : 5, 0, Math.PI * 2);
        if (isRoot) ctx.fillStyle = 'rgba(192,132,252,0.9)';
        else if (isActive) ctx.fillStyle = 'rgba(140,63,255,0.7)';
        else if (isOnPath) ctx.fillStyle = 'rgba(0,230,118,0.5)';
        else ctx.fillStyle = 'rgba(60,30,100,0.6)';
        ctx.fill();
        ctx.strokeStyle = isActive ? 'rgba(192,132,252,0.6)' : 'rgba(80,40,140,0.4)';
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.stroke();

        ctx.fillStyle = isRoot ? '#fff' : isActive ? 'rgba(220,180,255,0.9)' : 'rgba(120,80,180,0.7)';
        ctx.font = `${isActive ? 'bold ' : ''}${isRoot ? 9 : 8}px "Share Tech Mono",monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(NN[pc], pos.x, pos.y + (isRoot ? 3.5 : 3));
      }
    }

    if (nrPathChords.length >= 2) {
      ctx.strokeStyle = 'rgba(0,230,118,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < nrPathChords.length; i++) {
        const c = nrPathChords[i];
        const tc = NREngine.tonnetzCoord(c.root % 12);
        const pos = toCanvas(tc.x - 1, tc.y - 2);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = 'rgba(140,63,255,0.35)';
    ctx.font = '7px "Share Tech Mono",monospace';
    ctx.textAlign = 'left';
    ctx.fillText('← P5 →', 8, canvas.height - 6);
    ctx.textAlign = 'right';
    ctx.fillText('↑ M3', W - 6, 14);
  }

  function buildPresets() {
    const el = document.getElementById('nrPresets');
    if (!el) return;
    el.innerHTML = '';
    for (const [key, preset] of Object.entries(NREngine.NR_PRESETS)) {
      const btn = document.createElement('button');
      btn.className = 'nr-preset-btn';
      btn.textContent = preset.label;
      btn.title = `${key.toUpperCase()}: ${preset.ops.join('-')} 変換`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nr-preset-btn').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        const startChord = S.chord
          ? {
              root: S.chord.root,
              quality: S.chord.quality === '' ? '' : (S.chord.quality || ''),
              rootName: S.chord.rootName,
              iv: S.chord.quality === 'm' ? [0, 3, 7] : [0, 4, 7],
              name: S.chord.quality === 'm' ? 'Minor' : 'Major'
            }
          : {
              root: preset.root,
              quality: preset.quality,
              rootName: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][preset.root],
              iv: preset.quality === 'm' ? [0, 3, 7] : [0, 4, 7],
              name: preset.quality === 'm' ? 'Minor' : 'Major'
            };
        const prog = NREngine.presetToProgression(key);
        nrCurrent = prog.length ? prog[0].chord : startChord;
        nrPathChords = prog.map(e => e.chord);
        renderCurChord();
        drawTonnetz();
      });
      el.appendChild(btn);
    }
  }

  const opsRow = document.getElementById('nrOpsRow');
  if (opsRow) {
    opsRow.addEventListener('click', e => {
      const btn = e.target.closest('.nr-op-btn[data-op]');
      if (!btn) return;
      if (!nrCurrent) {
        if (!S.chord) return;
        nrCurrent = { ...S.chord, iv: S.chord.quality === 'm' ? [0, 3, 7] : [0, 4, 7] };
      }
      const op = btn.dataset.op;
      nrCurrent = NREngine.nrTransform(nrCurrent, op);
      nrPathChords = [];
      document.querySelectorAll('.nr-preset-btn').forEach(b => b.classList.remove('on'));
      renderCurChord();
      drawTonnetz();
    });
  }

  const resetBtn = document.getElementById('nrResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetToCurrent);

  const pathFromEl = document.getElementById('nrPathFrom');
  const pathToEl = document.getElementById('nrPathTo');
  const pathFindEl = document.getElementById('nrPathFind');
  const pathResultEl = document.getElementById('nrPathResult');
  const pathAddRow = document.getElementById('nrPathAddRow');

  if (pathFindEl) {
    pathFindEl.addEventListener('click', () => {
      if (!pathFromEl || !pathToEl || !pathResultEl) return;
      const fromStr = pathFromEl.value.trim();
      const toStr = pathToEl.value.trim();
      if (!fromStr || !toStr) {
        pathResultEl.textContent = '起点と終点を入力してください';
        return;
      }

      const chordFrom = parseChord(fromStr);
      const chordTo = parseChord(toStr);
      if (!chordFrom) {
        pathResultEl.textContent = `起点コードを解析できません: "${fromStr}"`;
        return;
      }
      if (!chordTo) {
        pathResultEl.textContent = `終点コードを解析できません: "${toStr}"`;
        return;
      }

      function toTriad(c) {
        return {
          root: c.root,
          quality: (c.quality === '' || c.quality === 'maj') ? '' : (c.quality.startsWith('m') && !c.quality.startsWith('maj') ? 'm' : c.quality),
          rootName: c.rootName,
          iv: c.quality === 'm' ? [0, 3, 7] : [0, 4, 7],
          name: c.quality === 'm' ? 'Minor' : 'Major'
        };
      }

      const result = NREngine.tonnetzPath(toTriad(chordFrom), toTriad(chordTo), 8);
      if (!result) {
        pathResultEl.textContent = '変換パスが見つかりません（maxDepth=8内）';
        if (pathAddRow) pathAddRow.style.display = 'none';
        nrPathChords = [];
        drawTonnetz();
        return;
      }

      nrPathChords = result.sequence;
      nrCurrent = result.sequence[result.sequence.length - 1];
      renderCurChord();
      drawTonnetz();

      const pathStr = result.path.length ? result.path.join(' → ') + '  (' + result.path.length + ' steps)' : '同一コード';
      const seqStr = result.sequence.map(c => (c.rootName || '') + (c.quality || '')).join(' → ');
      pathResultEl.textContent = `${pathStr}\n${seqStr}`;
      if (pathAddRow) pathAddRow.style.display = result.path.length ? '' : 'none';
    });
  }

  const nrAddToProg = document.getElementById('nrAddToProg');
  if (nrAddToProg) {
    nrAddToProg.addEventListener('click', () => {
      if (!nrPathChords.length) return;
      const bars = parseInt(document.getElementById('nrAddBars')?.value) || 4;
      for (const chord of nrPathChords) {
        PROG_STATE.prog.push({ chord, bars });
      }
      if (typeof window.refreshProgUI === 'function') window.refreshProgUI();
    });
  }

  const addCurBtn = document.getElementById('nrAddCurBtn');
  if (addCurBtn) {
    addCurBtn.addEventListener('click', () => {
      if (!nrCurrent) return;
      const bars = parseInt(document.getElementById('nrAddBars')?.value) || 4;
      PROG_STATE.prog.push({ chord: nrCurrent, bars });
      if (typeof window.refreshProgUI === 'function') window.refreshProgUI();
    });
  }

  if (typeof window.addUpdateTheoryHook === 'function') {
    window.addUpdateTheoryHook(() => {
      if (!nrCurrent && S.chord) resetToCurrent();
      drawTonnetz();
    });
  }

  buildPresets();
  resetToCurrent();
});
