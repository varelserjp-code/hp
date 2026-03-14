/* ═══════════════════════════════════════════════════
   BINAURAL BEAT ENGINE  v1.0
   ─────────────────────────────────────────────────
   バイノーラルビートをMIDIとして生成する独立エンジン。
   
   【原理】
   左耳キャリア周波数 F_L と右耳キャリア周波数 F_R を
   わずかに異なる音程で同時発音。脳がその差分 (F_R - F_L)
   を「うなり」として知覚し、対応する脳波帯域を誘導する。
   
   例: 200Hz (L) + 210Hz (R) → 10Hz差 = Alpha波誘導
   
   【MIDIでの実装】
   - Track L: Ch13  左チャンネル（キャリア基音）
   - Track R: Ch14  右チャンネル（キャリア + ビート周波数）
   - DAW側でCh13→左パン100%、Ch14→右パン100%に設定
   - 両トラックは完全ユニゾンで長尺サステイン
   ═══════════════════════════════════════════════════ */

const BinauralEngine = (() => {
  'use strict';

  /* ─── 脳波帯域データベース ─────────────────────
     各 band に複数のビート周波数（Hz差）プリセットを持つ
  ──────────────────────────────────────────────── */
  const BANDS = [
    {
      id: 'delta',
      name: 'Delta',
      range: '0.5–4 Hz',
      desc: '深い睡眠・潜在意識・回復・解離',
      color: '#888888',
      beats: [
        { hz: 0.5, name: '0.5 Hz', desc: '深部睡眠・成長ホルモン分泌' },
        { hz: 1.0, name: '1.0 Hz', desc: '痛みの緩和・幸福感' },
        { hz: 2.0, name: '2.0 Hz', desc: '神経再生・深部瞑想' },
        { hz: 3.0, name: '3.0 Hz', desc: '深部リラクゼーション' },
      ]
    },
    {
      id: 'theta',
      name: 'Theta',
      range: '4–8 Hz',
      desc: '瞑想・創造性・夢・記憶強化',
      color: '#aaaaaa',
      beats: [
        { hz: 4.0, name: '4.0 Hz', desc: '深部瞑想・コーパスカロスム' },
        { hz: 5.0, name: '5.0 Hz', desc: '直感・記憶定着' },
        { hz: 6.0, name: '6.0 Hz', desc: '長期記憶・創造的洞察' },
        { hz: 7.83, name: '7.83 Hz', desc: 'シューマン共鳴・地球同調' },
      ]
    },
    {
      id: 'alpha',
      name: 'Alpha',
      range: '8–13 Hz',
      desc: 'リラクゼーション・集中・ストレス低減',
      color: '#cccccc',
      beats: [
        { hz: 8.0,  name: '8.0 Hz',  desc: '深部アルファ・瞑想入口' },
        { hz: 10.0, name: '10.0 Hz', desc: 'スーパーラーニング・セロトニン' },
        { hz: 12.0, name: '12.0 Hz', desc: 'リラックス覚醒・フロー状態' },
      ]
    },
    {
      id: 'beta',
      name: 'Beta',
      range: '13–30 Hz',
      desc: '集中・問題解決・覚醒・認知',
      color: '#dddddd',
      beats: [
        { hz: 14.0, name: '14.0 Hz', desc: '集中・論理的思考' },
        { hz: 18.0, name: '18.0 Hz', desc: '覚醒・注意力' },
        { hz: 20.0, name: '20.0 Hz', desc: '高集中・ストレス応答' },
        { hz: 25.0, name: '25.0 Hz', desc: '認知機能・作業記憶' },
      ]
    },
    {
      id: 'gamma',
      name: 'Gamma',
      range: '30–80 Hz',
      desc: '高次認知・洞察・神秘体験・統合',
      color: '#eeeeee',
      beats: [
        { hz: 32.0, name: '32.0 Hz', desc: '問題解決・洞察の瞬間' },
        { hz: 40.0, name: '40.0 Hz', desc: '標準ガンマ・神経同期・瞑想' },
        { hz: 48.0, name: '48.0 Hz', desc: '高次感覚統合' },
      ]
    },
    {
      id: 'high_gamma',
      name: 'High Gamma',
      range: '80–200 Hz',
      desc: '超高次意識・神経可塑性・変性意識',
      color: '#ffffff',
      beats: [
        { hz: 80.0,  name: '80 Hz',  desc: '超高次認知・ピーク体験' },
        { hz: 100.0, name: '100 Hz', desc: '意識拡張・神経可塑性最大化' },
        { hz: 120.0, name: '120 Hz', desc: '変性意識・エクスタシー状態' },
        { hz: 160.0, name: '160 Hz', desc: '超越意識・極限の集中' },
      ]
    },
  ];

  /* ─── プリセット ─────────────────────────────── */
  const PRESETS = [
    { name: 'Deep Sleep',    band: 'delta',      hz: 2.0,  carrier: 60,  desc: '深部睡眠誘導' },
    { name: 'Meditation',    band: 'theta',      hz: 6.0,  carrier: 55,  desc: '深部瞑想' },
    { name: 'Schumann',      band: 'theta',      hz: 7.83, carrier: 55,  desc: 'シューマン共鳴同調' },
    { name: 'Flow State',    band: 'alpha',      hz: 10.0, carrier: 57,  desc: 'フロー状態・スーパーラーニング' },
    { name: 'Focus',         band: 'beta',       hz: 18.0, carrier: 60,  desc: '集中・作業用' },
    { name: 'Peak Gamma',    band: 'gamma',      hz: 40.0, carrier: 62,  desc: '高次認知・瞑想同期' },
    { name: 'Transcend',     band: 'high_gamma', hz: 100.0,carrier: 64,  desc: '変性意識・超越' },
    { name: 'Lucid Dream',   band: 'theta',      hz: 4.0,  carrier: 52,  desc: '明晰夢誘導' },
    { name: 'Creativity',    band: 'theta',      hz: 5.0,  carrier: 57,  desc: '創造性・インスピレーション' },
    { name: 'Relaxation',    band: 'alpha',      hz: 8.0,  carrier: 55,  desc: 'ストレス解消・深部リラックス' },
  ];

  /* ─── キャリア周波数（MIDI番号）→ Hz 変換 ─── */
  const midiToHz = n => 440 * Math.pow(2, (n - 69) / 12);
  /* Hz差をMIDIセント差に変換 (100セント = 半音) */
  const hzDiffToCents = (baseHz, beatHz) => 1200 * Math.log2((baseHz + beatHz) / baseHz);
  /* セント差を最近傍MIDIノート + ピッチベンド値に */
  const centsToMidiPB = (baseNote, cents) => {
    const semis = cents / 100;
    const noteOffset = Math.round(semis);
    const remCents = cents - noteOffset * 100;
    // ピッチベンド: 8192 = 0, 16383 = +2半音, 0 = -2半音 (GM標準 ±2st)
    const pb = Math.round(8192 + (remCents / 200) * 8192);
    return { note: baseNote + noteOffset, pb: Math.max(0, Math.min(16383, pb)) };
  };

  /* ─── STATE ──────────────────────────────────── */
  const STATE = {
    enabled:    false,
    activeBand: 'alpha',
    activeBeat: 10.0,        // ビート周波数 Hz
    carrierNote: 57,         // 左チャンネル基音 MIDI (57 = A3 = 220Hz)
    mode: 'pure',            // 'pure' | 'layered' | 'ramp'
    velocity: 55,
    volume: 80,              // CC7 ボリューム
  };

  /* ─── UI構築 ─────────────────────────────────── */
  function buildUI() {
    buildBandButtons();
    buildPresetButtons();
    buildBeatList();
    buildCarrierDisplay();
    updateInfo();
  }

  function buildBandButtons() {
    const el = document.getElementById('bbBandRow');
    if (!el) return;
    el.innerHTML = BANDS.map(b => `
      <div class="bb-band-btn ${b.id===STATE.activeBand?'on':''}" data-band="${b.id}">
        ${b.name}<br>
        <span style="font-size:7px;opacity:.6;">${b.range}</span>
      </div>`).join('');
    el.querySelectorAll('.bb-band-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.activeBand = btn.dataset.band;
        const band = BANDS.find(b => b.id === STATE.activeBand);
        if (band) STATE.activeBeat = band.beats[0].hz;
        buildUI();
      });
    });
  }

  function buildPresetButtons() {
    const el = document.getElementById('bbPresets');
    if (!el) return;
    el.innerHTML = PRESETS.map(p => `
      <div class="bb-preset-btn" data-preset="${p.name}">${p.name}</div>`).join('');
    el.querySelectorAll('.bb-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PRESETS.find(x => x.name === btn.dataset.preset);
        if (!p) return;
        STATE.activeBand  = p.band;
        STATE.activeBeat  = p.hz;
        STATE.carrierNote = p.carrier;
        buildUI();
      });
    });
  }

  function buildBeatList() {
    const el = document.getElementById('bbBeatList');
    if (!el) return;
    const band = BANDS.find(b => b.id === STATE.activeBand);
    if (!band) return;
    el.innerHTML = band.beats.map(b => `
      <div class="bb-beat-row ${b.hz===STATE.activeBeat?'active-beat':''}">
        <div class="bb-beat-info">
          <div class="bb-beat-name">${b.name}</div>
          <div class="bb-beat-desc">${b.desc}</div>
        </div>
        <div class="bb-beat-hz">Δ${b.hz} Hz</div>
        <div class="bb-beat-tog ${b.hz===STATE.activeBeat?'on':''}" data-hz="${b.hz}"></div>
      </div>`).join('');
    el.querySelectorAll('.bb-beat-tog').forEach(tog => {
      tog.addEventListener('click', () => {
        STATE.activeBeat = parseFloat(tog.dataset.hz);
        buildBeatList();
        buildCarrierDisplay();
        updateInfo();
      });
    });
  }

  function buildCarrierDisplay() {
    const el = document.getElementById('bbCarrierNote');
    if (!el) return;
    const baseHz = midiToHz(STATE.carrierNote);
    const rightHz = baseHz + STATE.activeBeat;
    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const noteName = n => NOTE_NAMES[n % 12] + Math.floor(n/12 - 1);
    el.innerHTML = `
      <span style="color:#cccccc;">L: ${noteName(STATE.carrierNote)}</span>
      <span style="color:#888;margin:0 6px;">|</span>
      <span style="color:#aaaaaa;">${baseHz.toFixed(1)} Hz</span>
      <span style="color:#555;margin:0 8px;">→</span>
      <span style="color:#cccccc;">R: ${(STATE.carrierNote)}+Δ</span>
      <span style="color:#888;margin:0 6px;">|</span>
      <span style="color:#aaaaaa;">${rightHz.toFixed(2)} Hz</span>
      <span style="color:#555;margin:0 8px;">|</span>
      <span style="color:#888;">Δ = ${STATE.activeBeat} Hz</span>`;
  }

  function updateInfo() {
    const el = document.getElementById('bbInfo');
    if (!el) return;
    const band = BANDS.find(b => b.id === STATE.activeBand);
    const beat = band?.beats.find(b => b.hz === STATE.activeBeat);
    if (!band || !beat) return;
    el.innerHTML =
      `[${band.name.toUpperCase()} / ${STATE.activeBeat} Hz] ${beat.desc}<br>` +
      `Ch13 = 左耳キャリア | Ch14 = 右耳 (キャリア + ${STATE.activeBeat} Hz差)<br>` +
      `DAW: Ch13 → Pan L100% / Ch14 → Pan R100% でバイノーラル効果が得られます。`;
  }

  /* ─── キャリアノート選択（スライダー） ────────── */
  function initCarrierSlider() {
    const sl = document.getElementById('bbCarrierSlider');
    if (!sl) return;
    sl.value = STATE.carrierNote;
    sl.addEventListener('input', () => {
      STATE.carrierNote = parseInt(sl.value);
      document.getElementById('bbCarrierVal').textContent =
        (() => { const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
                 return NOTE_NAMES[STATE.carrierNote%12]+Math.floor(STATE.carrierNote/12-1); })();

      buildCarrierDisplay();
      updateInfo();
    });
  }

  /* ─── モードボタン ──────────────────────────── */
  function initModeButtons() {
    const el = document.getElementById('bbModeRow');
    if (!el) return;
    el.querySelectorAll('.bb-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.mode = btn.dataset.mode;
        el.querySelectorAll('.bb-mode-btn').forEach(b => b.classList.toggle('on', b === btn));
      });
    });
  }

  /* ─── MIDI トラック生成 ───────────────────────
     左チャンネル (Ch13): キャリア基音
     右チャンネル (Ch14): キャリア基音 + ビート周波数分だけ高いノート
     
     高周波ビート（High Gamma等）はMIDI音程差が大きすぎるため
     ピッチベンドで微調整。ビート周波数 > 半音の場合はノートを
     1半音上げてベンドで補正する。
  ────────────────────────────────────────────── */
  function makeBinauralTrack(p, tensionCurve) {
    const { ppq, bars } = p;
    const CH_L = 0x0C; // ch 13 (0-indexed=12) 左
    const CH_R = 0x0D; // ch 14 (0-indexed=13) 右
    const bt = ppq * 4;
    const total = bt * bars;

    const baseNote = STATE.carrierNote;
    const baseHz   = midiToHz(baseNote);
    const beatHz   = STATE.activeBeat;
    const cents    = hzDiffToCents(baseHz, beatHz);
    const { note: rightNote, pb: pbVal } = centsToMidiPB(baseNote, cents);

    const vel = STATE.velocity;
    const ae  = [];

    // ── helper: CC7 ボリューム設定
    const cc7 = (ch, val, pos) => ({ pos, v: [0xB0|ch, 7, val] });
    // ── helper: ピッチベンド (14bit: lsb, msb)
    const pitchBend = (ch, val, pos) => ({
      pos, v: [0xE0|ch, val & 0x7F, (val >> 7) & 0x7F]
    });

    switch (STATE.mode) {

      // ── Pure: 全長サステイン（バイノーラル標準） ──
      case 'pure': {
        // 左チャンネル
        ae.push(cc7(CH_L, STATE.volume, 0));
        ae.push({ pos: 0,       v: [0x90|CH_L, baseNote,  vel] });
        ae.push({ pos: total-1, v: [0x80|CH_L, baseNote,  0]   });
        // 右チャンネル（ピッチベンド適用）
        ae.push(cc7(CH_R, STATE.volume, 0));
        ae.push(pitchBend(CH_R, pbVal, 0));
        ae.push({ pos: 0,       v: [0x90|CH_R, rightNote, vel] });
        ae.push({ pos: total-1, v: [0x80|CH_R, rightNote, 0]   });
        break;
      }

      // ── Layered: 複数ビート周波数を同時レイヤー ──
      case 'layered': {
        const band = BANDS.find(b => b.id === STATE.activeBand);
        const beats = band ? band.beats : [{ hz: beatHz }];
        beats.forEach((b, i) => {
          const bCents = hzDiffToCents(baseHz, b.hz);
          const { note: rn, pb: rpb } = centsToMidiPB(baseNote, bCents);
          const v = Math.max(20, Math.round(vel * (1 - i * 0.15)));
          const chL = 0x0C; // 全beat同じchに重ねる（和音）
          const chR = 0x0D;
          if (i === 0) {
            ae.push(cc7(chL, STATE.volume, 0));
            ae.push({ pos: 0, v: [0x90|chL, baseNote, v] });
            ae.push({ pos: total-1, v: [0x80|chL, baseNote, 0] });
          }
          ae.push(cc7(chR, STATE.volume, 0));
          ae.push(pitchBend(chR, rpb, i * ppq)); // stagger
          ae.push({ pos: i * ppq,       v: [0x90|chR, rn, v] });
          ae.push({ pos: total-1,       v: [0x80|chR, rn, 0] });
        });
        break;
      }

      // ── Ramp: ビート周波数を帯域内で徐々に変化 ──
      case 'ramp': {
        const band = BANDS.find(b => b.id === STATE.activeBand);
        const beats = band ? band.beats : [{ hz: beatHz }];
        const segLen = Math.floor(total / beats.length);
        // 左チャンネル: 全長サステイン
        ae.push(cc7(CH_L, STATE.volume, 0));
        ae.push({ pos: 0,       v: [0x90|CH_L, baseNote, vel] });
        ae.push({ pos: total-1, v: [0x80|CH_L, baseNote, 0]   });
        // 右チャンネル: セグメントごとにビート周波数を変える
        ae.push(cc7(CH_R, STATE.volume, 0));
        beats.forEach((b, i) => {
          const segStart = i * segLen;
          const segEnd   = (i === beats.length - 1) ? total - 1 : (i+1) * segLen;
          const bCents = hzDiffToCents(baseHz, b.hz);
          const { note: rn, pb: rpb } = centsToMidiPB(baseNote, bCents);
          ae.push(pitchBend(CH_R, rpb, segStart));
          if (i === 0) {
            ae.push({ pos: segStart, v: [0x90|CH_R, rn, vel] });
          } else {
            // 前のノートをオフ→新ノートオン
            const prevBeats = beats[i-1];
            const prevCents = hzDiffToCents(baseHz, prevBeats.hz);
            const { note: prevRn } = centsToMidiPB(baseNote, prevCents);
            ae.push({ pos: segStart,   v: [0x80|CH_R, prevRn, 0]  });
            ae.push({ pos: segStart+1, v: [0x90|CH_R, rn,     vel] });
          }
          if (i === beats.length - 1) {
            ae.push({ pos: segEnd, v: [0x80|CH_R, rn, 0] });
          }
        });
        break;
      }
    }

    // トラック名・プログラムチェンジ（Sine Wave系音色: 81=SquareLead, 88=Fantasia）
    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const nn = n => NOTE_NAMES[n%12] + Math.floor(n/12-1);
    const trackName = `BB_${STATE.activeBand.toUpperCase()}_${STATE.activeBeat}Hz`;

    if (typeof safeAbsToTrack !== 'function') return [];
    if (typeof tname !== 'function' || typeof pc !== 'function') return [];

    // 左右を単一トラックにまとめる（両ch同居）
    ae.sort((a, b) => a.pos - b.pos);
    return safeAbsToTrack(ae, [
      tname(trackName),
      pc(CH_L, 88),  // Fantasia (sine的な音色)
      pc(CH_R, 88),
    ]);
  }

  return {
    STATE, BANDS, PRESETS,
    buildUI,
    initCarrierSlider,
    initModeButtons,
    makeBinauralTrack,
  };
})();



