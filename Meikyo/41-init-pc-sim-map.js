/* ── v23.1: PC Set Similarity Map UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const STATE = {
    enabled: false,
    source: 'chord',
    display: 'scatter',
    topN: 20,
    hovered: null,
    nodes: []
  };

  const canvas = document.getElementById('pcSimCanvas');
  const infoEl = document.getElementById('pcSimInfo');
  const detailEl = document.getElementById('pcSimDetail');
  const controls = document.getElementById('pcSimControls');
  const togEl = document.getElementById('togPCSimMap');

  if (!canvas) return;

  togEl.addEventListener('click', () => {
    STATE.enabled = !STATE.enabled;
    togEl.classList.toggle('on', STATE.enabled);
    controls.style.display = STATE.enabled ? '' : 'none';
    if (STATE.enabled) drawPCSimMap(S.chord);
  });

  document.getElementById('pcSimSource').querySelectorAll('.pcs-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('pcSimSource').querySelectorAll('.pcs-mode-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      STATE.source = btn.dataset.src;
      drawPCSimMap(S.chord);
    });
  });

  document.getElementById('pcSimDisplay').querySelectorAll('.pcs-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('pcSimDisplay').querySelectorAll('.pcs-mode-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      STATE.display = btn.dataset.disp;
      drawPCSimMap(S.chord);
    });
  });

  document.getElementById('pcSimTopN').addEventListener('input', e => {
    STATE.topN = parseInt(e.target.value);
    document.getElementById('pcSimTopNV').textContent = STATE.topN;
    drawPCSimMap(S.chord);
  });

  canvas.addEventListener('mousemove', e => {
    if (!STATE.nodes.length) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    let found = null;
    for (const nd of STATE.nodes) {
      const dx = mx - nd.x;
      const dy = my - nd.y;
      if (dx * dx + dy * dy <= (nd.r + 4) * (nd.r + 4)) {
        found = nd;
        break;
      }
    }
    if (found !== STATE.hovered) {
      STATE.hovered = found;
      if (found) {
        const pct = (found.similarity * 100).toFixed(1);
        const ivStr = found.iv.map((v, i) => ['m2','M2','m3','M3','P4','TT'][i] + ':' + v).join(' · ');
        detailEl.textContent = found.forte + '  [' + found.primeForm.join(',') + ']  sim ' + pct + '%  IV⟨' + found.iv.join(',') + '⟩  ' + ivStr;
      } else {
        detailEl.textContent = '';
      }
      redrawHighlight();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    STATE.hovered = null;
    detailEl.textContent = '';
    redrawHighlight();
  });

  window.drawPCSimMap = function(chord) {
    if (!STATE.enabled) return;

    const cx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 280;
    const W = canvas.width;
    const H = canvas.height;

    if (!chord || typeof PCSetEngine === 'undefined') {
      cx.clearRect(0, 0, W, H);
      infoEl.textContent = '— コードを入力してください —';
      STATE.nodes = [];
      return;
    }

    let sourcePCs;
    if (STATE.source === 'composite') {
      const sD = (typeof ALL_SCALES !== 'undefined') && ALL_SCALES[S.scale];
      const sI = sD ? sD.iv : [0,2,4,5,7,9,11];
      const chPCs = chord.iv.map(i => ((chord.root + i) % 12));
      const scPCs = sI.map(i => ((chord.root + i) % 12));
      sourcePCs = [...new Set([...chPCs, ...scPCs])];
    } else {
      sourcePCs = chord.iv.map(i => ((chord.root + i) % 12));
    }

    const baseAnalysis = PCSetEngine.analyze(sourcePCs);
    if (!baseAnalysis) {
      cx.clearRect(0, 0, W, H);
      infoEl.textContent = '— PC集合が小さすぎます（2音以上必要） —';
      STATE.nodes = [];
      return;
    }

    const simSets = PCSetEngine.similarSets(sourcePCs, STATE.topN);
    cx.clearRect(0, 0, W, H);

    if (STATE.display === 'radial') {
      drawRadial(cx, W, H, baseAnalysis, simSets, STATE, chord);
    } else {
      drawScatter(cx, W, H, baseAnalysis, simSets, STATE, chord);
    }

    const baseForte = baseAnalysis.forte;
    const basePF = baseAnalysis.primeForm.join(',');
    infoEl.textContent = 'SOURCE: ' + chord.name + ' → Forte ' + baseForte + ' [' + basePF + ']  IV⟨' + baseAnalysis.iv.join(',') + '⟩  TOP ' + STATE.topN + ' similar sets plotted';
  };

  function drawScatter(cx, W, H, baseAnalysis, simSets, state, chord) {
    const CX = W / 2;
    const CY = H / 2;
    const maxR = Math.min(CX, CY) - 24;
    state.nodes = [];

    [0.25, 0.5, 0.75, 1.0].forEach(lv => {
      cx.beginPath();
      cx.arc(CX, CY, maxR * lv, 0, Math.PI * 2);
      cx.strokeStyle = 'rgba(140,63,255,0.08)';
      cx.lineWidth = 1;
      cx.stroke();
      cx.fillStyle = 'rgba(140,63,255,0.3)';
      cx.font = '7px Share Tech Mono,monospace';
      cx.textAlign = 'left';
      cx.fillText((lv * 100).toFixed(0) + '%', CX + maxR * lv + 3, CY);
    });

    cx.fillStyle = 'rgba(140,63,255,0.4)';
    cx.font = '8px Share Tech Mono,monospace';
    cx.textAlign = 'center';
    cx.fillText('HIGH SIMILARITY', CX, CY - maxR - 10);
    cx.fillText('LOW SIMILARITY', CX, CY + maxR + 16);

    simSets.forEach((entry, idx) => {
      const sim = entry.similarity;
      const card = entry.primeForm.length;
      const angleBase = (card - 2) / 8 * Math.PI * 2;
      const angleJitter = (idx / simSets.length) * Math.PI * 0.5 - Math.PI * 0.25;
      const angle = angleBase + angleJitter - Math.PI / 2;
      const dist = maxR * (1.0 - sim * 0.92);
      const x = CX + Math.cos(angle) * dist;
      const y = CY + Math.sin(angle) * dist;
      const r = 3 + sim * 6;
      const hue = ((card - 2) / 8 * 280 + 200) % 360;
      const alpha = 0.4 + sim * 0.6;

      cx.beginPath();
      cx.arc(x, y, r, 0, Math.PI * 2);
      cx.fillStyle = `hsla(${hue},80%,65%,${alpha})`;
      cx.fill();
      cx.strokeStyle = `hsla(${hue},80%,80%,${alpha * 0.6})`;
      cx.lineWidth = 1;
      cx.stroke();

      if (baseAnalysis.zRelated && baseAnalysis.zRelated.some(z => z.forte === entry.forte)) {
        cx.beginPath();
        cx.arc(x, y, r + 3, 0, Math.PI * 2);
        cx.strokeStyle = 'rgba(255,204,0,0.7)';
        cx.lineWidth = 1.5;
        cx.stroke();
      }

      if (idx < 8) {
        cx.fillStyle = `hsla(${hue},80%,85%,0.85)`;
        cx.font = '7px Share Tech Mono,monospace';
        cx.textAlign = 'center';
        cx.fillText(entry.forte, x, y - r - 2);
      }

      state.nodes.push({ ...entry, x, y, r });
    });

    cx.beginPath();
    cx.arc(CX, CY, 9, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(0,229,255,0.9)';
    cx.fill();
    cx.strokeStyle = '#fff';
    cx.lineWidth = 1.5;
    cx.stroke();
    cx.fillStyle = '#00e5ff';
    cx.font = 'bold 7px Share Tech Mono,monospace';
    cx.textAlign = 'center';
    cx.fillText(baseAnalysis.forte || '?', CX, CY - 11);
    cx.fillStyle = 'rgba(0,229,255,0.7)';
    cx.font = '7px Share Tech Mono,monospace';
    cx.fillText(chord.name, CX, CY + 18);

    [3,4,5,6,7].forEach((card, i) => {
      const hue = ((card - 2) / 8 * 280 + 200) % 360;
      const lx = 12;
      const ly = H - 60 + i * 11;
      cx.beginPath();
      cx.arc(lx + 3, ly, 3, 0, Math.PI * 2);
      cx.fillStyle = `hsla(${hue},80%,65%,0.8)`;
      cx.fill();
      cx.fillStyle = 'rgba(200,200,200,0.5)';
      cx.font = '7px Share Tech Mono,monospace';
      cx.textAlign = 'left';
      cx.fillText(card + '-note set', lx + 9, ly + 3);
    });
  }

  function drawRadial(cx, W, H, baseAnalysis, simSets, state, chord) {
    const CX = W / 2;
    const CY = H / 2;
    const maxR = Math.min(CX, CY) - 28;
    state.nodes = [];
    const ivLabels = ['m2','M2','m3','M3','P4','TT'];
    const N = 6;

    cx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = CX + Math.cos(a) * maxR;
      const y = CY + Math.sin(a) * maxR;
      if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.closePath();
    cx.strokeStyle = 'rgba(140,63,255,0.15)';
    cx.lineWidth = 1;
    cx.stroke();

    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      cx.beginPath();
      cx.moveTo(CX, CY);
      cx.lineTo(CX + Math.cos(a) * maxR, CY + Math.sin(a) * maxR);
      cx.strokeStyle = 'rgba(140,63,255,0.1)';
      cx.lineWidth = 1;
      cx.stroke();
      const lx = CX + Math.cos(a) * (maxR + 14);
      const ly = CY + Math.sin(a) * (maxR + 14);
      cx.fillStyle = 'rgba(140,63,255,0.5)';
      cx.font = '8px Share Tech Mono,monospace';
      cx.textAlign = 'center';
      cx.fillText(ivLabels[i], lx, ly + 3);
    }

    simSets.slice(0, 12).forEach((entry, idx) => {
      const sim = entry.similarity;
      const ivMax = Math.max(...entry.iv, 1);
      const alpha = 0.08 + sim * 0.25;
      const hue = idx / 12 * 360;

      cx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const rv = (entry.iv[i] / ivMax) * maxR * 0.85;
        const x = CX + Math.cos(a) * rv;
        const y = CY + Math.sin(a) * rv;
        if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
      }
      cx.closePath();
      cx.fillStyle = `hsla(${hue},70%,60%,${alpha})`;
      cx.fill();
      cx.strokeStyle = `hsla(${hue},70%,70%,${alpha * 2})`;
      cx.lineWidth = 0.5;
      cx.stroke();

      const angle = (idx / simSets.length) * Math.PI * 2 - Math.PI / 2;
      const dist = maxR * 1.05;
      const x = CX + Math.cos(angle) * dist;
      const y = CY + Math.sin(angle) * dist;
      const r = 3 + sim * 5;
      cx.beginPath();
      cx.arc(x, y, r, 0, Math.PI * 2);
      cx.fillStyle = `hsla(${hue},70%,65%,${0.5 + sim * 0.5})`;
      cx.fill();
      if (idx < 6) {
        cx.fillStyle = `hsla(${hue},70%,85%,0.8)`;
        cx.font = '6px Share Tech Mono,monospace';
        cx.textAlign = 'center';
        cx.fillText(entry.forte, x, y - r - 2);
      }
      state.nodes.push({ ...entry, x, y, r });
    });

    const bIVmax = Math.max(...baseAnalysis.iv, 1);
    cx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const rv = (baseAnalysis.iv[i] / bIVmax) * maxR * 0.85;
      const x = CX + Math.cos(a) * rv;
      const y = CY + Math.sin(a) * rv;
      if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.closePath();
    cx.fillStyle = 'rgba(0,229,255,0.15)';
    cx.fill();
    cx.strokeStyle = 'rgba(0,229,255,0.8)';
    cx.lineWidth = 1.5;
    cx.stroke();

    cx.fillStyle = 'rgba(0,229,255,0.9)';
    cx.font = 'bold 8px Share Tech Mono,monospace';
    cx.textAlign = 'center';
    cx.fillText(chord.name, CX, CY - 6);
    cx.fillStyle = 'rgba(0,229,255,0.6)';
    cx.font = '7px Share Tech Mono,monospace';
    cx.fillText(baseAnalysis.forte || '?', CX, CY + 8);
  }

  function redrawHighlight() {
    const cx = canvas.getContext('2d');
    STATE.nodes.forEach(nd => {
      if (nd === STATE.hovered) {
        cx.beginPath();
        cx.arc(nd.x, nd.y, nd.r + 4, 0, Math.PI * 2);
        cx.strokeStyle = 'rgba(255,255,255,0.9)';
        cx.lineWidth = 2;
        cx.stroke();
      }
    });
  }
});
