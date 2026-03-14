/* ── v25.5: Just Intonation UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof JustIntonation === 'undefined') return;

  const togJI = document.getElementById('togJI');
  const modeRow = document.getElementById('jiModeRow');
  const blendEl = document.getElementById('jiBlend');
  const blendV = document.getElementById('jiBlendV');
  const hlRow = document.getElementById('jiHarmonicRow');
  const hlEl = document.getElementById('jiHarmonicLimit');
  const hlV = document.getElementById('jiHarmonicLimitV');
  const canvas = document.getElementById('jiDeviationCanvas');
  const info = document.getElementById('jiInfo');
  if (!togJI || !modeRow || !canvas) return;

  function drawDeviation() {
    if (!JI_PARAMS.enabled || !window.S || !window.S.chord) {
      const cx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth || 300;
      canvas.height = 72;
      cx.clearRect(0, 0, canvas.width, canvas.height);
      cx.fillStyle = 'rgba(0,230,118,0.08)';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const root = S.chord.root;
    const rows = JustIntonation.getDeviationTable(root, JI_PARAMS);
    const cx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 300;
    canvas.height = 72;
    const W = canvas.width;
    const H = canvas.height;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = 'rgba(0,0,0,0.3)';
    cx.fillRect(0, 0, W, H);
    const barW = W / 12;
    const maxDev = 50;

    cx.strokeStyle = 'rgba(0,230,118,0.2)';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(0, H / 2);
    cx.lineTo(W, H / 2);
    cx.stroke();

    rows.forEach((r, i) => {
      const x = i * barW;
      const dev = Math.max(-maxDev, Math.min(maxDev, r.deviation));
      const barH = Math.abs(dev) / maxDev * (H / 2 - 4);
      const y = dev >= 0 ? H / 2 - barH : H / 2;
      const isChord = S.chord.iv.map(iv => ((S.chord.root + iv) % 12 + 12) % 12).includes(r.pc);
      cx.fillStyle = isChord ? 'rgba(0,230,118,0.75)' : 'rgba(0,180,100,0.35)';
      cx.fillRect(x + 1, y, barW - 2, barH);
      cx.fillStyle = isChord ? '#00e676' : 'rgba(0,230,118,0.55)';
      cx.font = '7px Share Tech Mono, monospace';
      cx.textAlign = 'center';
      cx.fillText(r.name, x + barW / 2, H - 2);
      if (Math.abs(dev) > 1) {
        cx.fillStyle = 'rgba(255,255,255,0.7)';
        cx.fillText((dev > 0 ? '+' : '') + dev.toFixed(1), x + barW / 2, dev >= 0 ? y - 2 : y + barH + 8);
      }
    });

    const consonance = JustIntonation.consonanceScore(
      S.chord.iv.map(iv => ((S.chord.root + iv) % 12 + 12) % 12), root, JI_PARAMS
    );
    info.textContent = 'MODE: ' + JI_PARAMS.mode.toUpperCase()
      + '  BLEND: ' + Math.round(JI_PARAMS.blend * 100) + '%'
      + '  CONSONANCE: ' + (consonance * 100).toFixed(1) + '%';
  }

  togJI.classList.toggle('on', JI_PARAMS.enabled);
  togJI.addEventListener('click', () => {
    JI_PARAMS.enabled = !JI_PARAMS.enabled;
    togJI.classList.toggle('on', JI_PARAMS.enabled);
    drawDeviation();
  });

  modeRow.querySelectorAll('.ji-mode-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.mode === JI_PARAMS.mode);
    btn.addEventListener('click', () => {
      JI_PARAMS.mode = btn.dataset.mode;
      modeRow.querySelectorAll('.ji-mode-btn').forEach(b => b.classList.toggle('on', b === btn));
      const needHL = JI_PARAMS.mode === 'harmonic' || JI_PARAMS.mode === 'utonal';
      hlRow.style.display = needHL ? 'flex' : 'none';
      drawDeviation();
    });
  });

  blendEl.value = Math.round(JI_PARAMS.blend * 100);
  blendEl.addEventListener('input', () => {
    JI_PARAMS.blend = parseInt(blendEl.value) / 100;
    blendV.textContent = blendEl.value + '%';
    drawDeviation();
  });

  hlEl.value = JI_PARAMS.harmonicLimit;
  hlEl.addEventListener('input', () => {
    JI_PARAMS.harmonicLimit = parseInt(hlEl.value);
    hlV.textContent = hlEl.value;
    drawDeviation();
  });

  if (typeof window.addUpdateTheoryHook === 'function') {
    window.addUpdateTheoryHook(() => {
      drawDeviation();
    });
  }

  drawDeviation();
});
