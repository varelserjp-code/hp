/* ── v20.0: Chord Progression UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  function renderSlots() {
    const el = document.getElementById('cpSlots');
    if (!el) return;
    if (!PROG_STATE.prog.length) {
      el.innerHTML = '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--text-dim);padding:8px 0;">— コードを追加してください —</div>';
      renderSmooth();
      return;
    }
    el.innerHTML = '';
    const expanded = ProgEngine.expandToBars(PROG_STATE.prog, S.bars);
    const ctScores = ProgEngine.smoothnessScores(PROG_STATE.prog);
    const ivScores = ProgEngine.ivSimScores(PROG_STATE.prog);
    PROG_STATE.prog.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'cp-slot';
      const c = entry.chord;
      const chordLabel = c ? (c.rootName + (c.quality || '')) : '?';
      const isLast = idx === PROG_STATE.prog.length - 1;
      let badgeHtml = '<div class="cp-sim-badge"></div>';
      if (!isLast) {
        const ct = Math.round(ctScores[idx] * 100);
        const iv = Math.round(ivScores[idx] * 100);
        const ctCol = `hsl(${Math.round(ct * 1.2)},70%,55%)`;
        const ivCol = `hsl(${Math.round(iv * 1.2)},70%,55%)`;
        badgeHtml = `<div class="cp-sim-badge" title="CT: 共通音 ${ct}%&#10;IV: PC Set コサイン類似度 ${iv}%">
            <span style="color:${ctCol}">CT${ct}%</span>
            <span style="color:${ivCol}">IV${iv}%</span>
          </div>`;
      }

      row.innerHTML = `
          <div class="cp-slot-chord">${chordLabel} <span style="font-size:8px;color:var(--text-dim);">${c ? c.name : ''}</span></div>
          <div class="cp-slot-bars">
            <button class="cp-slot-del" data-action="dec" data-idx="${idx}" style="padding:1px 5px;margin-right:4px;">▼</button>
            <span>${entry.bars}</span> bars
            <button class="cp-slot-del" data-action="inc" data-idx="${idx}" style="padding:1px 5px;margin-left:4px;">▲</button>
          </div>
          ${badgeHtml}
          <div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--text-dim);">→ bar ${(expanded[idx]?.barStart ?? '?') + 1}</div>
          <button class="cp-slot-del" data-action="del" data-idx="${idx}">✕</button>`;
      el.appendChild(row);
    });
    renderSmooth();
    renderInfoLine();
    if (typeof VLEngine !== 'undefined') VLEngine.invalidateCache();
  }

  function renderSmooth() {
    const el = document.getElementById('cpSmoothBar');
    if (!el) return;
    if (PROG_STATE.prog.length < 2) {
      el.innerHTML = '<span class="cp-smooth-label">—</span>';
      return;
    }
    const scores = ProgEngine.smoothnessScores(PROG_STATE.prog);
    let html = '<span class="cp-smooth-label">SMOOTH</span>';
    scores.forEach((s, i) => {
      const ca = PROG_STATE.prog[i].chord;
      const cb = PROG_STATE.prog[i + 1].chord;
      const la = ca ? (ca.rootName + (ca.quality || '')) : '?';
      const lb = cb ? (cb.rootName + (cb.quality || '')) : '?';
      const r = Math.round(255 * (1 - s));
      const g = Math.round(230 * s);
      const color = `rgb(${r},${g},60)`;
      html += `<div class="cp-smooth-seg" title="${la} → ${lb}: ${(s * 100).toFixed(0)}%" style="background:${color};"></div>`;
    });
    el.innerHTML = html;
  }

  function renderInfoLine() {
    const el = document.getElementById('cpInfoLine');
    if (!el || !PROG_STATE.prog.length) return;
    const totalBars = PROG_STATE.prog.reduce((s, e) => s + e.bars, 0);
    const ctScores = ProgEngine.smoothnessScores(PROG_STATE.prog);
    const ivScores = ProgEngine.ivSimScores(PROG_STATE.prog);
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length * 100).toFixed(0) : '—';
    const chordNames = PROG_STATE.prog.map(e => e.chord ? (e.chord.rootName + (e.chord.quality || '')) : '?').join(' → ');
    el.textContent = `${chordNames}  |  ${PROG_STATE.prog.length} chords · ${totalBars} bars · CT:${avg(ctScores)}% IV:${avg(ivScores)}%`;
  }

  function buildPresets() {
    const el = document.getElementById('cpPresets');
    if (!el) return;
    el.innerHTML = '';
    for (const [, preset] of Object.entries(ProgEngine.PROG_PRESETS)) {
      const btn = document.createElement('div');
      btn.className = 'cp-preset-btn';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        PROG_STATE.prog = preset.chords
          .map(str => ({ chord: parseChord(str), bars: 4 }))
          .filter(e => e.chord !== null);
        renderSlots();
        document.querySelectorAll('.cp-preset-btn').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
      });
      el.appendChild(btn);
    }
  }

  const slotsEl = document.getElementById('cpSlots');
  if (slotsEl) {
    slotsEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'del') {
        PROG_STATE.prog.splice(idx, 1);
      } else if (action === 'inc') {
        PROG_STATE.prog[idx].bars = Math.min(32, PROG_STATE.prog[idx].bars + 1);
      } else if (action === 'dec') {
        PROG_STATE.prog[idx].bars = Math.max(1, PROG_STATE.prog[idx].bars - 1);
      }
      document.querySelectorAll('.cp-preset-btn').forEach(b => b.classList.remove('on'));
      renderSlots();
    });
  }

  const addInput = document.getElementById('cpAddInput');
  const addBars = document.getElementById('cpAddBars');
  const addBtn = document.getElementById('cpAddBtn');

  function validateAddInput() {
    if (!addInput) return;
    const v = addInput.value.trim();
    if (!v) {
      addInput.className = 'cp-add-input';
      return;
    }
    addInput.className = 'cp-add-input ' + (parseChord(v) ? 'ok' : 'err');
  }
  if (addInput) addInput.addEventListener('input', validateAddInput);

  if (addBtn && addInput && addBars) {
    function doAdd() {
      const str = addInput.value.trim();
      const bars = Math.max(1, Math.min(32, parseInt(addBars.value) || 4));
      const chord = parseChord(str);
      if (!chord) {
        addInput.className = 'cp-add-input err';
        return;
      }
      PROG_STATE.prog.push({ chord, bars });
      addInput.value = '';
      addInput.className = 'cp-add-input';
      document.querySelectorAll('.cp-preset-btn').forEach(b => b.classList.remove('on'));
      renderSlots();
    }
    addBtn.addEventListener('click', doAdd);
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  }

  const togEl = document.getElementById('togProgression');
  const ctrlEl = document.getElementById('progressionControls');
  if (togEl) {
    togEl.addEventListener('click', () => {
      PROG_STATE.enabled = !PROG_STATE.enabled;
      togEl.classList.toggle('on', PROG_STATE.enabled);
      if (ctrlEl) ctrlEl.style.display = PROG_STATE.enabled ? 'block' : 'none';
    });
  }

  const velShapeRow = document.getElementById('cpVelShapeRow');
  if (velShapeRow) {
    velShapeRow.addEventListener('click', e => {
      const btn = e.target.closest('.cp-mode-btn');
      if (!btn) return;
      PROG_STATE.velShapeMode = btn.dataset.mode;
      velShapeRow.querySelectorAll('.cp-mode-btn').forEach(b => b.classList.toggle('on', b === btn));
    });
  }

  const transRow = document.getElementById('cpTransRow');
  if (transRow) {
    transRow.addEventListener('click', e => {
      const btn = e.target.closest('.cp-mode-btn');
      if (!btn) return;
      PROG_STATE.transitionMode = btn.dataset.mode;
      transRow.querySelectorAll('.cp-mode-btn').forEach(b => b.classList.toggle('on', b === btn));
    });
  }

  const vsAmt = document.getElementById('cpVelShapeAmt');
  if (vsAmt) {
    vsAmt.addEventListener('input', () => {
      PROG_STATE.velShapeAmt = parseInt(vsAmt.value) / 100;
      const vEl = document.getElementById('cpVelShapeAmtV');
      if (vEl) vEl.textContent = PROG_STATE.velShapeAmt.toFixed(2);
    });
  }

  const loopTog = document.getElementById('cpLoopTog');
  if (loopTog) {
    loopTog.addEventListener('click', () => {
      PROG_STATE.loopProg = !PROG_STATE.loopProg;
      loopTog.classList.toggle('on', PROG_STATE.loopProg);
    });
  }

  function renderBorrowed() {
    const grpEl = document.getElementById('cpBorrowedGroups');
    const rootLbl = document.getElementById('cpBorrowedRoot');
    if (!grpEl) return;

    const root = S.chord ? S.chord.root : 0;
    const currentScale = (typeof S.scale === 'string') ? S.scale : 'Ionian (Major)';

    if (rootLbl) {
      const rn = S.chord ? S.chord.rootName : '?';
      rootLbl.textContent = `ルート: ${rn}  スケール: ${currentScale}`;
    }

    const candidates = ProgEngine.borrowedChords(root, currentScale);
    if (!candidates.length) {
      grpEl.innerHTML = '<span style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--text-dim);">候補なし</span>';
      return;
    }

    const groups = {};
    for (const entry of candidates) {
      if (!groups[entry.source]) groups[entry.source] = [];
      groups[entry.source].push(entry);
    }

    grpEl.innerHTML = '';
    for (const [src, entries] of Object.entries(groups)) {
      const srcDiv = document.createElement('div');
      srcDiv.className = 'cp-borrowed-src';
      srcDiv.innerHTML = `<span class="cp-borrowed-src-label">${src}</span>`;

      for (const entry of entries) {
        const btnWrap = document.createElement('span');
        btnWrap.className = 'cp-borrowed-btn-wrap';

        const btn = document.createElement('button');
        btn.className = 'cp-borrowed-btn';
        btn.textContent = entry.chord.rootName + entry.chord.quality;
        btn.title = `${entry.degree}度 (${entry.chord.name}) — ${src}`;
        btn.addEventListener('click', () => {
          const bars = parseInt(document.getElementById('cpAddBars')?.value) || 4;
          PROG_STATE.prog.push({ chord: entry.chord, bars });
          renderSlots();
        });
        btnWrap.appendChild(btn);

        if (entry.chord7) {
          const btn7 = document.createElement('button');
          btn7.className = 'cp-borrowed-btn cp-borrowed-btn7';
          btn7.textContent = entry.chord7.rootName + entry.chord7.quality;
          btn7.title = `${entry.degree}度7th (${entry.chord7.name}) — ${src}`;
          btn7.addEventListener('click', () => {
            const bars = parseInt(document.getElementById('cpAddBars')?.value) || 4;
            PROG_STATE.prog.push({ chord: entry.chord7, bars });
            renderSlots();
          });
          btnWrap.appendChild(btn7);
        }

        srcDiv.appendChild(btnWrap);
      }
      grpEl.appendChild(srcDiv);
    }
  }

  if (typeof window.addUpdateTheoryHook === 'function') {
    window.addUpdateTheoryHook(() => {
      renderBorrowed();
    });
  }

  buildPresets();
  renderSlots();
  renderBorrowed();
  window.refreshProgUI = function() { buildPresets(); renderSlots(); renderBorrowed(); };
});
