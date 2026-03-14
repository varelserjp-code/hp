/* ═══════════════════════════════════════════════════
   SOLFEGGIO FREQUENCY ENGINE  v1.0
   ─────────────────────────────────────────────────
   古代ソルフェジオ周波数・バイノーラルビート・シューマン共鳴
   各周波数を最近傍MIDIノートにマッピングし、独立ch12トラック
   として生成。モード・ベロシティ・ゲート・オクターブを制御可能。

   周波数 → MIDIノート変換:
     f0 = 440Hz = MIDI 69 (A4)
     MIDI = round(69 + 12 * log2(f / 440))
     セント偏差 = (f - f_midi) / f_midi * 100 * 12 (近似)
═══════════════════════════════════════════════════ */
const SolfeggioEngine = (() => {
  'use strict';

  /* ─── 周波数データベース ───────────────────────────
     全カテゴリ網羅: 古代ソルフェジオ6音/9音, 拡張系,
     バイノーラルビート(α/β/θ/δ/γ), シューマン共鳴,
     ピタゴラス音律, 惑星周波数, ニコラ・テスラ369
  ─────────────────────────────────────────────────── */
  const FREQ_DB = [
    // ── 古代ソルフェジオ 6音 ─────────────────────
    { hz:174,  name:'UT (174 Hz)',  cat:'Solfeggio Classic',  desc:'痛みの解放・基盤の安定',      tag:'174' },
    { hz:285,  name:'UT+ (285 Hz)', cat:'Solfeggio Classic',  desc:'組織再生・エネルギー場の回復',  tag:'285' },
    { hz:396,  name:'UT (396 Hz)', cat:'Solfeggio Classic',  desc:'罪悪感・恐怖の解放',          tag:'396' },
    { hz:417,  name:'RE (417 Hz)', cat:'Solfeggio Classic',  desc:'変容の促進・ブロック解除',     tag:'417' },
    { hz:528,  name:'MI (528 Hz)', cat:'Solfeggio Classic',  desc:'DNA修復・愛の周波数・奇跡',    tag:'528' },
    { hz:639,  name:'FA (639 Hz)', cat:'Solfeggio Classic',  desc:'関係の修復・コミュニケーション', tag:'639' },
    { hz:741,  name:'SOL (741 Hz)',cat:'Solfeggio Classic',  desc:'毒素排出・直感の覚醒',         tag:'741' },
    { hz:852,  name:'LA (852 Hz)', cat:'Solfeggio Classic',  desc:'精神的秩序・第三の目の覚醒',    tag:'852' },
    { hz:963,  name:'SI (963 Hz)', cat:'Solfeggio Classic',  desc:'神の意識・松果体の活性化',      tag:'963' },
    // ── 拡張ソルフェジオ ─────────────────────────
    { hz:111,  name:'111 Hz',      cat:'Extended Solfeggio', desc:'細胞再生・β-エンドルフィン',   tag:'111' },
    { hz:222,  name:'222 Hz',      cat:'Extended Solfeggio', desc:'調和とバランス',               tag:'222' },
    { hz:333,  name:'333 Hz',      cat:'Extended Solfeggio', desc:'創造性・聖なる三位一体',        tag:'333' },
    { hz:444,  name:'444 Hz',      cat:'Extended Solfeggio', desc:'天使の周波数・高次接続',        tag:'444' },
    { hz:555,  name:'555 Hz',      cat:'Extended Solfeggio', desc:'変容の加速',                   tag:'555' },
    { hz:666,  name:'666 Hz',      cat:'Extended Solfeggio', desc:'地球エネルギー・物質との統合',  tag:'666' },
    { hz:777,  name:'777 Hz',      cat:'Extended Solfeggio', desc:'幸運・高次の守護',              tag:'777' },
    { hz:888,  name:'888 Hz',      cat:'Extended Solfeggio', desc:'無限の豊かさ・宇宙の流れ',      tag:'888' },
    { hz:999,  name:'999 Hz',      cat:'Extended Solfeggio', desc:'完成・サイクルの終了と新生',    tag:'999' },
    // ── シューマン共鳴 ───────────────────────────
    { hz:7.83, name:'SR-1 (7.83)', cat:'Schumann Resonance', desc:'地球の基本共鳴・グランディング',tag:'SR1' },
    { hz:14.3, name:'SR-2 (14.3)', cat:'Schumann Resonance', desc:'第2倍音・θ波境界',            tag:'SR2' },
    { hz:20.8, name:'SR-3 (20.8)', cat:'Schumann Resonance', desc:'第3倍音',                     tag:'SR3' },
    { hz:27.3, name:'SR-4 (27.3)', cat:'Schumann Resonance', desc:'第4倍音・超低周波共鳴',        tag:'SR4' },
    { hz:33.8, name:'SR-5 (33.8)', cat:'Schumann Resonance', desc:'第5倍音・γ波接続',            tag:'SR5' },
    // ── バイノーラルビート ───────────────────────
    { hz:40,   name:'Gamma (40)',  cat:'Brainwave',          desc:'γ波・集中・高次認知・瞑想',    tag:'gamma' },
    { hz:20,   name:'Beta-Hi (20)',cat:'Brainwave',          desc:'β波高域・覚醒・集中',          tag:'betaH' },
    { hz:10,   name:'Alpha (10)', cat:'Brainwave',          desc:'α波・リラックス・創造性',      tag:'alpha' },
    { hz:6,    name:'Theta (6)',  cat:'Brainwave',          desc:'θ波・深い瞑想・潜在意識',      tag:'theta' },
    { hz:2,    name:'Delta (2)',  cat:'Brainwave',          desc:'δ波・深い睡眠・癒し',          tag:'delta' },
    // ── ピタゴラス音律 ───────────────────────────
    { hz:256,  name:'C4 Pyth. (256)', cat:'Pythagorean',    desc:'C=256Hz ピタゴラス標準基音',   tag:'C256' },
    { hz:432,  name:'A4=432Hz',       cat:'Pythagorean',    desc:'A=432Hz 宇宙的チューニング',   tag:'A432' },
    { hz:480,  name:'A4=480Hz',       cat:'Pythagorean',    desc:'A=480Hz 古典的チューニング',   tag:'A480' },
    // ── ニコラ・テスラ 369 ───────────────────────
    { hz:3,    name:'Tesla 3',   cat:'Tesla 369',          desc:'テスラの神聖数3',               tag:'t3' },
    { hz:6,    name:'Tesla 6',   cat:'Tesla 369',          desc:'テスラの神聖数6',               tag:'t6' },
    { hz:9,    name:'Tesla 9',   cat:'Tesla 369',          desc:'テスラの神聖数9',               tag:'t9' },
    { hz:3.69, name:'Tesla 3.69',cat:'Tesla 369',          desc:'369の基本単位',                tag:'t369' },
    // ── 惑星周波数 ───────────────────────────────
    { hz:136.1,name:'OM / Earth Year', cat:'Planetary',    desc:'地球公転周期 = OMの音',         tag:'earth' },
    { hz:194.18,name:'Earth Day',      cat:'Planetary',    desc:'地球自転周期の周波数',           tag:'earthD' },
    { hz:221.23,name:'Venus',          cat:'Planetary',    desc:'金星の公転周波数',              tag:'venus' },
    { hz:141.27,name:'Mercury',        cat:'Planetary',    desc:'水星の公転周波数',              tag:'mercury' },
    { hz:183.58,name:'Jupiter',        cat:'Planetary',    desc:'木星の公転周波数',              tag:'jupiter' },
    { hz:144.72,name:'Mars',           cat:'Planetary',    desc:'火星の公転周波数',              tag:'mars' },
    { hz:147.85,name:'Saturn',         cat:'Planetary',    desc:'土星の公転周波数',              tag:'saturn' },
    { hz:207.36,name:'Uranus',         cat:'Planetary',    desc:'天王星の公転周波数',            tag:'uranus' },
    { hz:211.44,name:'Neptune',        cat:'Planetary',    desc:'海王星の公転周波数',            tag:'neptune' },
    // ── チャクラ対応 ─────────────────────────────
    { hz:194.18,name:'Root Chakra',    cat:'Chakra',       desc:'第1チャクラ ムーラダーラ・安定', tag:'chk1' },
    { hz:210.42,name:'Sacral Chakra',  cat:'Chakra',       desc:'第2チャクラ スヴァーディシュターナ', tag:'chk2' },
    { hz:126.22,name:'Solar Plexus',   cat:'Chakra',       desc:'第3チャクラ マニプラ・意志力',  tag:'chk3' },
    { hz:136.1, name:'Heart Chakra',   cat:'Chakra',       desc:'第4チャクラ アナーハタ・愛',    tag:'chk4' },
    { hz:141.27,name:'Throat Chakra',  cat:'Chakra',       desc:'第5チャクラ ヴィシュッダ・表現', tag:'chk5' },
    { hz:221.23,name:'Third Eye',      cat:'Chakra',       desc:'第6チャクラ アージュナー・直感', tag:'chk6' },
    { hz:172.06,name:'Crown Chakra',   cat:'Chakra',       desc:'第7チャクラ サハスラーラ・覚醒', tag:'chk7' },
  ];

  /* ─── Hz → 最近傍MIDIノート番号 ─────────────────
     MIDI 69 = A4 = 440Hz
     n = round(69 + 12 * log2(f / 440))
  ─────────────────────────────────────────────── */
  function hzToMidi(hz) {
    if (hz <= 0) return 24; // 極小周波数は最低音扱い → オクターブ調整で使う
    let n = Math.round(69 + 12 * Math.log2(hz / 440));
    // 10Hz以下は超低域なので複数オクターブ上に
    while (n < 12) n += 12;
    while (n > 115) n -= 12;
    return n;
  }

  /* ─── カテゴリ一覧取得 ────────────────────────── */
  function getCategories() {
    return [...new Set(FREQ_DB.map(f => f.cat))];
  }

  /* ─── 状態 ──────────────────────────────────── */
  const STATE = {
    enabled: false,
    selected: new Set(['528','396','417','639','741','852']), // デフォルト: Classic6音
    mode: 'sustain',       // 'sustain'|'pulse'|'breath'|'shimmer'
    velocity: 45,
    gate: 0.95,
    octShift: 0,
    density: 60,
    stagger: 30,
    fadeCurve: 'flat',     // 'flat'|'fade-in'|'fade-out'|'swell'
    rootLock: false,
    tensionMod: false,
  };

  /* ─── プリセット ─────────────────────────────── */
  const PRESETS = [
    { name:'Classic 6',  tags:['396','417','528','639','741','852'] },
    { name:'Full 9',     tags:['174','285','396','417','528','639','741','852','963'] },
    { name:'Healing',    tags:['528','285','174','alpha','SR1'] },
    { name:'Meditation', tags:['A432','SR1','theta','delta','111'] },
    { name:'Chakras',    tags:['chk1','chk2','chk3','chk4','chk5','chk6','chk7'] },
    { name:'Planets',    tags:['earth','venus','jupiter','mars','saturn'] },
    { name:'Tesla 369',  tags:['t3','t6','t9','t369','333','666','999'] },
    { name:'Deep Delta', tags:['delta','SR1','174','111','t3'] },
    { name:'Clear',      tags:[] },
  ];

  /* ─── 選択中の周波数エントリ取得 ─────────────── */
  function getSelectedFreqs() {
    return FREQ_DB.filter(f => STATE.selected.has(f.tag));
  }

  /* ─── MIDIトラック生成 ───────────────────────── */
  function makeSolfeggioTrack(rootMidi, p, tensionCurve) {
    const { ppq, bars } = p;
    const CH = 0x0B; // MIDI ch 12 (0-indexed = 11)
    const bt  = ppq * 4;
    const total = bt * bars;
    const freqs = getSelectedFreqs();
    if (!freqs.length) return null;

    const vel  = STATE.velocity;
    const gate = Math.max(0.05, Math.min(2.0, STATE.gate));
    const shift = STATE.octShift;
    const dens  = STATE.density / 100;
    const stag  = STATE.stagger / 100;

    /* velオクターブシフトを適用したMIDI番号 */
    function toNote(f) {
      let n = hzToMidi(f.hz) + shift * 12;
      while (n < 12)  n += 12;
      while (n > 115) n -= 12;
      /* rootLock: コードルートに近い音へスナップ */
      if (STATE.rootLock && rootMidi != null) {
        const rpc = rootMidi % 12;
        const cands = [rpc,rpc+12,rpc+24,rpc+36,rpc+48,rpc+60,rpc+72,rpc+84,rpc+96,rpc+108];
        const valid = cands.filter(c => c >= 12 && c <= 115);
        if (valid.length) {
          n = valid.reduce((best, c) => Math.abs(c-n) < Math.abs(best-n) ? c : best, valid[0]);
        }
      }
      return n;
    }

    /* fadeCurveによるvel変調 */
    function applyFade(baseVel, pos) {
      const ratio = pos / total;
      switch (STATE.fadeCurve) {
        case 'fade-in':  return Math.round(baseVel * (0.15 + ratio * 0.85));
        case 'fade-out': return Math.round(baseVel * (1.0 - ratio * 0.85));
        case 'swell':    return Math.round(baseVel * (0.15 + Math.sin(ratio * Math.PI) * 0.85));
        default:         return baseVel;
      }
    }

    /* tensionModによるvel変調 */
    function tensionVel(baseVel, pos) {
      if (!STATE.tensionMod || !tensionCurve || !tensionCurve.length) return baseVel;
      const bar = Math.floor(pos / bt);
      const t = tensionCurve[Math.min(bar, tensionCurve.length-1)] ?? 0.5;
      return Math.round(Math.max(1, Math.min(127, baseVel * (0.5 + t))));
    }

    const ae = []; // absolute events: {pos, v:[...]}

    freqs.forEach((f, fi) => {
      const note = toNote(f);
      const staggerTick = Math.round(fi * stag * bt);

      switch (STATE.mode) {
        case 'sustain': {
          for (let bar = 0; bar < bars; bar++) {
            if (rng() > dens) continue;
            const pos  = bar * bt + staggerTick;
            if (pos >= total) continue;
            const dur  = Math.round(bt * gate);
            const v    = Math.max(1, Math.min(127, applyFade(tensionVel(vel, pos), pos)));
            ae.push({ pos, v: [0x90|CH, note, v] });
            ae.push({ pos: Math.min(pos+dur, total-1), v: [0x80|CH, note, 0] });
          }
          break;
        }
        case 'pulse': {
          const step = ppq;
          let c = staggerTick;
          while (c < total) {
            if (rng() <= dens) {
              const dur = Math.round(step * gate);
              const v   = Math.max(1, Math.min(127, applyFade(tensionVel(vel, c), c)));
              ae.push({ pos: c, v: [0x90|CH, note, v] });
              ae.push({ pos: Math.min(c+dur, total-1), v: [0x80|CH, note, 0] });
            }
            c += step;
          }
          break;
        }
        case 'breath': {
          const inhale = bt * 2, exhale = bt * 2;
          let c = staggerTick;
          while (c < total) {
            const dur1 = Math.round(inhale * gate);
            const v1 = Math.max(1, Math.min(127, applyFade(tensionVel(Math.round(vel*0.6), c), c)));
            if (c + dur1 <= total) {
              ae.push({ pos:c, v:[0x90|CH,note,v1] });
              ae.push({ pos:c+dur1, v:[0x80|CH,note,0] });
            }
            c += inhale;
            if (c >= total) break;
            const dur2 = Math.round(exhale * gate * 1.1);
            const v2 = Math.max(1, Math.min(127, applyFade(tensionVel(vel, c), c)));
            if (c + dur2 <= total) {
              ae.push({ pos:c, v:[0x90|CH,note,v2] });
              ae.push({ pos:c+dur2, v:[0x80|CH,note,0] });
            }
            c += exhale;
          }
          break;
        }
        case 'shimmer': {
          const step = Math.round(ppq / 2);
          let c = staggerTick, phase = 0;
          while (c < total) {
            if (rng() <= dens) {
              const shimV = Math.max(1, Math.min(127, Math.round(vel*(0.35+Math.sin(phase)*0.3+rng()*0.35))));
              const dur   = Math.round(step * gate * 0.65);
              ae.push({ pos:c, v:[0x90|CH,note,shimV] });
              ae.push({ pos:Math.min(c+dur,total-1), v:[0x80|CH,note,0] });
            }
            c += step; phase += 0.4;
          }
          break;
        }
      }
    });

    if (!ae.length) return null;

    /* safeAbsToTrack (グローバル関数) を使ってバイト列生成 */
    const tnFn  = typeof tname === 'function' ? tname : (nm)=>({d:0,v:[0xFF,0x03,nm.length,...[...nm].map(c=>c.charCodeAt(0))]});
    const pcFn  = typeof pc    === 'function' ? pc    : (ch,prg)=>({d:0,v:[0xC0|ch,prg]});
    return safeAbsToTrack(ae, [tnFn('Solfeggio'), pcFn(CH, 88)]);
  }

  /* ─── ビジュアライザー描画 ───────────────────── */
  function drawViz() {
    const cv = document.getElementById('sfVizCanvas');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.offsetWidth || 400, H = 80;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W+'px'; cv.style.height = H+'px';
    const cx = cv.getContext('2d');
    cx.setTransform(dpr,0,0,dpr,0,0);
    cx.clearRect(0,0,W,H);

    const freqs = getSelectedFreqs();
    if (!freqs.length) {
      cx.fillStyle = '#222'; cx.font = '9px Share Tech Mono,monospace';
      cx.textAlign = 'center'; cx.fillText('— 周波数を選択してください —', W/2, H/2+3);
      return;
    }

    const maxHz = Math.max(...freqs.map(f=>f.hz), 1000);
    const minHz = Math.min(...freqs.map(f=>f.hz), 1);
    const logMin = Math.log2(Math.max(minHz, 0.5));
    const logMax = Math.log2(Math.max(maxHz * 1.1, 1));

    freqs.forEach((f, i) => {
      const x = ((Math.log2(Math.max(f.hz, 0.5)) - logMin) / (logMax - logMin)) * (W-40) + 20;
      const hue = (i / freqs.length) * 300 + 260;
      const col = `hsl(${hue},70%,65%)`;

      /* 縦線 */
      cx.strokeStyle = col + '66'; cx.lineWidth = 1;
      cx.setLineDash([2,3]);
      cx.beginPath(); cx.moveTo(x,0); cx.lineTo(x,H-18); cx.stroke();
      cx.setLineDash([]);

      /* ドット */
      cx.fillStyle = col;
      cx.beginPath(); cx.arc(x, H/2-10, 4, 0, Math.PI*2); cx.fill();

      /* Hz表示 */
      cx.fillStyle = col+'cc'; cx.font = '7px Share Tech Mono,monospace';
      cx.textAlign = 'center';
      cx.fillText(f.hz < 10 ? f.hz.toFixed(1)+'Hz' : Math.round(f.hz)+'Hz', x, H-5);
    });
  }

  /* ─── UI 構築 ──────────────────────────────── */
  function buildUI() {
    buildPresets();
    buildFreqGrid();
    updateSummary();
    drawViz();
  }

  function buildPresets() {
    const el = document.getElementById('sfPresets'); if (!el) return;
    el.innerHTML = '';
    PRESETS.forEach(pr => {
      const btn = document.createElement('button');
      btn.className = 'sf-preset-btn';
      btn.textContent = pr.name;
      btn.addEventListener('click', () => {
        STATE.selected = new Set(pr.tags);
        buildFreqGrid();
        updateSummary();
        drawViz();
      });
      el.appendChild(btn);
    });
  }

  function buildFreqGrid() {
    const el = document.getElementById('sfFreqGrid'); if (!el) return;
    el.innerHTML = '';
    const cats = getCategories();
    cats.forEach(cat => {
      const catDiv = document.createElement('div');
      catDiv.className = 'sf-cat-label';
      catDiv.textContent = cat;
      el.appendChild(catDiv);

      const grid = document.createElement('div');
      grid.className = 'sf-freq-grid';
      el.appendChild(grid);

      FREQ_DB.filter(f => f.cat === cat).forEach(f => {
        const card = document.createElement('div');
        card.className = 'sf-freq-card' + (STATE.selected.has(f.tag) ? ' on' : '');
        card.innerHTML = `
          <div class="sf-fc-check">✓</div>
          <div class="sf-fc-hz">${f.hz < 10 ? f.hz.toFixed(2) : f.hz < 100 ? f.hz.toFixed(1) : Math.round(f.hz)} Hz</div>
          <div class="sf-fc-name">${f.name}</div>
          <div class="sf-fc-desc">${f.desc}</div>
          <div class="sf-fc-cat">${f.cat}</div>`;
        card.addEventListener('click', () => {
          if (STATE.selected.has(f.tag)) STATE.selected.delete(f.tag);
          else STATE.selected.add(f.tag);
          card.classList.toggle('on', STATE.selected.has(f.tag));
          updateSummary();
          drawViz();
        });
        grid.appendChild(card);
      });
    });
  }

  function updateSummary() {
    const el = document.getElementById('sfSelSummary'); if (!el) return;
    const sel = getSelectedFreqs();
    if (!sel.length) { el.textContent = '— 未選択'; return; }
    const txt = sel.map(f => `${f.hz<10?f.hz.toFixed(1):Math.round(f.hz)}Hz`).join(' · ');
    el.textContent = `✓ ${sel.length}周波数: ${txt}`;
  }

  return { STATE, FREQ_DB, PRESETS, hzToMidi, getSelectedFreqs, makeSolfeggioTrack, buildUI, updateSummary, drawViz };
})();

/* ─── Solfeggio UI初期化 ─────────────────────────── */
function initSolfeggio(){
  const togEl = document.getElementById('togSolfeggio');
  const ctrlEl = document.getElementById('solfeggioControls');
  if (!togEl || !ctrlEl) return;

  /* Toggle */
  togEl.addEventListener('click', () => syncEngine('solfeggio', !S.engines.solfeggio));

  /* Mode buttons */
  document.querySelectorAll('#sfModeRow .sf-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SolfeggioEngine.STATE.mode = btn.dataset.mode;
      document.querySelectorAll('#sfModeRow .sf-mode-btn').forEach(b => b.classList.toggle('on', b===btn));
      SolfeggioEngine.drawViz();
    });
  });

  /* Sliders */
  [
    ['sfVelocity', v => { SolfeggioEngine.STATE.velocity = v; return String(v); }],
    ['sfGate',     v => { SolfeggioEngine.STATE.gate = v/100; return (v/100).toFixed(2); }],
    ['sfOctShift', v => { SolfeggioEngine.STATE.octShift = v; return (v>=0?'+':'')+v; }],
    ['sfDensity',  v => { SolfeggioEngine.STATE.density = v; return v+'%'; }],
    ['sfStagger',  v => { SolfeggioEngine.STATE.stagger = v; return v+'%'; }],
  ].forEach(([id, fn]) => {
    const el = document.getElementById(id);
    const vEl = document.getElementById(id+'V');
    if (!el || !vEl) return;
    el.addEventListener('input', () => { vEl.textContent = fn(+el.value); SolfeggioEngine.drawViz(); });
  });

  /* Fade Curve buttons */
  document.querySelectorAll('#sfFadeCurveGroup .ls-grow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SolfeggioEngine.STATE.fadeCurve = btn.dataset.mode;
      document.querySelectorAll('#sfFadeCurveGroup .ls-grow-btn').forEach(b => b.classList.toggle('on', b===btn));
    });
  });

  /* Root Lock & Tension Mod toggles */
  document.getElementById('sfRootLock').addEventListener('click', () => {
    SolfeggioEngine.STATE.rootLock = !SolfeggioEngine.STATE.rootLock;
    document.getElementById('sfRootLock').classList.toggle('on', SolfeggioEngine.STATE.rootLock);
  });
  document.getElementById('sfTensionMod').addEventListener('click', () => {
    SolfeggioEngine.STATE.tensionMod = !SolfeggioEngine.STATE.tensionMod;
    document.getElementById('sfTensionMod').classList.toggle('on', SolfeggioEngine.STATE.tensionMod);
  });
}
