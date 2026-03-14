/* ═══════════════════════════════════════════════════════════════
   MIDI PREVIEW PLAYER  v24.0
   Web Audio API による MIDI インライン再生エンジン
   ─────────────────────────────────────────────────────────────
   公開API (window 経由):
     MidiPreview.load(midiData: Uint8Array, bpm: number) → void
     MidiPreview.play()  / pause()  / stop()
     MidiPreview.isPlaying()  → boolean
   ═══════════════════════════════════════════════════════════════ */
const MidiPreview = (() => {
'use strict';

/* ── MIDI パーサー ─────────────────────────────── */
function parseMidi(bytes) {
  let pos = 0;

  function readU16() { const v = (bytes[pos] << 8) | bytes[pos+1]; pos += 2; return v; }
  function readU32() { const v = (bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3]; pos += 4; return v >>> 0; }
  function readVLQ() {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = bytes[pos++];
      v = (v << 7) | (b & 0x7F);
      if (!(b & 0x80)) break;
    }
    return v;
  }

  /* MThd ヘッダ */
  pos = 0;
  if (bytes[0] !== 0x4D || bytes[1] !== 0x54 || bytes[2] !== 0x68 || bytes[3] !== 0x64) return null;
  pos = 4;
  readU32(); /* length */
  const format = readU16();
  const numTracks = readU16();
  const ppq = readU16();

  /* トラック解析 */
  const noteEvents = []; /* { ch, note, vel, tick } */
  let bpmOverride = null;

  for (let t = 0; t < numTracks; t++) {
    if (pos + 8 > bytes.length) break;
    if (bytes[pos] !== 0x4D || bytes[pos+1] !== 0x54 || bytes[pos+2] !== 0x72 || bytes[pos+3] !== 0x6B) {
      break;
    }
    pos += 4;
    const trkLen = readU32();
    const trkEnd = pos + trkLen;
    let tick = 0;
    let runStatus = 0;

    while (pos < trkEnd) {
      tick += readVLQ();
      let status = bytes[pos];

      if (status & 0x80) {
        runStatus = status;
        pos++;
      } else {
        status = runStatus;
      }

      const type = status & 0xF0;
      const ch   = status & 0x0F;

      if (type === 0x90) {
        /* Note On */
        const note = bytes[pos++];
        const vel  = bytes[pos++];
        if (vel > 0) {
          noteEvents.push({ on: true,  ch, note, vel, tick });
        } else {
          noteEvents.push({ on: false, ch, note, vel: 0, tick });
        }
      } else if (type === 0x80) {
        /* Note Off */
        const note = bytes[pos++];
        pos++; /* velocity */
        noteEvents.push({ on: false, ch, note, vel: 0, tick });
      } else if (type === 0xA0) { pos += 2; }
      else if (type === 0xB0) { pos += 2; }
      else if (type === 0xC0) { pos += 1; }
      else if (type === 0xD0) { pos += 1; }
      else if (type === 0xE0) { pos += 2; }
      else if (status === 0xFF) {
        /* Meta */
        const mtype = bytes[pos++];
        const mlen  = readVLQ();
        if (mtype === 0x51 && mlen === 3) {
          /* Set Tempo */
          const uspb = (bytes[pos] << 16) | (bytes[pos+1] << 8) | bytes[pos+2];
          bpmOverride = Math.round(60000000 / uspb);
        }
        pos += mlen;
      } else if (status === 0xF0 || status === 0xF7) {
        const slen = readVLQ();
        pos += slen;
      } else {
        pos++;
      }
    }
    pos = trkEnd;
  }

  noteEvents.sort((a, b) => a.tick - b.tick);
  return { ppq, bpmOverride, noteEvents };
}

/* ── 音色定義 (チャンネル別) ──────────────────── */
/* ch0=Drone, ch1=Pad, ch2=Arp, ch3=Melody, ch4=Bass,
   ch5=Overtone, ch6=Texture, ch7=Lead, ch8=Markov, ch9=L-System */
const TIMBRE = {
  default: { wave: 'sine',     attack: 0.02, release: 0.15 },
  0:       { wave: 'sine',     attack: 0.4,  release: 1.2  },  /* Drone */
  1:       { wave: 'triangle', attack: 0.15, release: 0.6  },  /* Pad */
  2:       { wave: 'sawtooth', attack: 0.01, release: 0.08 },  /* Arp */
  3:       { wave: 'sine',     attack: 0.03, release: 0.18 },  /* Melody */
  4:       { wave: 'sine',     attack: 0.05, release: 0.3  },  /* Bass */
  5:       { wave: 'triangle', attack: 0.02, release: 0.25 },  /* Overtone */
  6:       { wave: 'sine',     attack: 0.08, release: 0.5  },  /* Texture */
  7:       { wave: 'sawtooth', attack: 0.01, release: 0.1  },  /* Lead */
  8:       { wave: 'triangle', attack: 0.03, release: 0.12 },  /* Markov */
  9:       { wave: 'square',   attack: 0.02, release: 0.1  },  /* L-System */
};

/* ── 状態 ─────────────────────────────────────── */
let _ac = null;      /* AudioContext */
let _parsed = null;  /* parseMidi() の結果 */
let _bpm = 60;
let _startAt = 0;    /* AudioContext.currentTime のオフセット */
let _pausedAt = 0;   /* 一時停止位置(秒) */
let _playing = false;
let _activeNodes = [];  /* { osc, gain } 現在鳴らしている音 */
let _schedNodes = [];   /* スケジュール済みノード（後でcancel可能） */
let _raf = null;     /* requestAnimationFrame ハンドル */
let _duration = 0;   /* 総再生時間(秒) */

/* ── AudioContext 遅延初期化 ───────────────────── */
function getAC() {
  if (!_ac || _ac.state === 'closed') {
    _ac = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}

/* ── MIDI ノート → 周波数 ─────────────────────── */
function midiFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/* ── ロード ──────────────────────────────────── */
function load(midiData, bpm) {
  stop();
  _parsed = parseMidi(midiData);
  if (!_parsed) { console.warn('[MidiPreview] parse failed'); return; }
  _bpm = (_parsed.bpmOverride && _parsed.bpmOverride > 0) ? _parsed.bpmOverride : (bpm || 60);

  /* 総再生時間計算 */
  const secPerTick = 60 / (_bpm * _parsed.ppq);
  const lastTick = _parsed.noteEvents.length
    ? _parsed.noteEvents[_parsed.noteEvents.length - 1].tick
    : 0;
  _duration = lastTick * secPerTick + 2.0; /* 末尾に余白 */

  _pausedAt = 0;
  _updateUI();
}

/* ── 再生 ────────────────────────────────────── */
function play() {
  if (!_parsed || _playing) return;
  const ac = getAC();
  _playing = true;

  /* 再生開始時刻（AudioContext時間軸上） */
  _startAt = ac.currentTime - _pausedAt;

  const secPerTick = 60 / (_bpm * _parsed.ppq);

  /* マスターゲイン */
  const masterGain = ac.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(ac.destination);

  /* チャンネル別ゲイン */
  const chGains = {};
  function getChGain(ch) {
    if (!chGains[ch]) {
      const g = ac.createGain();
      g.gain.value = _chVol[ch] !== undefined ? _chVol[ch] : 0.8;
      g.connect(masterGain);
      chGains[ch] = g;
    }
    return chGains[ch];
  }

  /* Note On/Off のペアをスケジュール */
  /* activeNotes[ch][note] = { offTick } */
  const offTicks = {}; /* `${ch}_${note}` → offTick */

  /* まず Note Off を先に収集 */
  for (const ev of _parsed.noteEvents) {
    if (!ev.on) {
      const k = `${ev.ch}_${ev.note}`;
      if (offTicks[k] === undefined || ev.tick < offTicks[k]) {
        offTicks[k] = ev.tick;
      }
    }
  }

  /* Note On ごとにOscillatorをスケジュール */
  for (const ev of _parsed.noteEvents) {
    if (!ev.on) continue;
    const onSec  = ev.tick * secPerTick;
    const startT = _startAt + onSec;
    if (startT < ac.currentTime - 0.05) continue; /* 過去のイベントはスキップ */

    const k = `${ev.ch}_${ev.note}`;
    /* このNote Onの後で来る最初のNote Offを探す */
    let offT = onSec + 0.5; /* デフォルト */
    for (const ofEv of _parsed.noteEvents) {
      if (!ofEv.on && ofEv.ch === ev.ch && ofEv.note === ev.note && ofEv.tick > ev.tick) {
        offT = ofEv.tick * secPerTick;
        break;
      }
    }

    const tb = TIMBRE[ev.ch] || TIMBRE.default;
    const osc = ac.createOscillator();
    osc.type = tb.wave;
    osc.frequency.value = midiFreq(ev.note);

    const gain = ac.createGain();
    const velGain = (ev.vel / 127) * 0.7;
    gain.gain.setValueAtTime(0, startT);
    gain.gain.linearRampToValueAtTime(velGain, startT + tb.attack);
    const noteEnd = _startAt + offT;
    gain.gain.setValueAtTime(velGain, noteEnd);
    gain.gain.linearRampToValueAtTime(0, noteEnd + tb.release);

    osc.connect(gain);
    gain.connect(getChGain(ev.ch));
    osc.start(startT);
    osc.stop(noteEnd + tb.release + 0.05);

    _schedNodes.push({ osc, gain });
  }

  /* 終了検知 + シークバー更新 */
  _raf = requestAnimationFrame(_tick);
  _updateUI();
}

/* ── 一時停止 ────────────────────────────────── */
function pause() {
  if (!_playing) return;
  _pausedAt = _ac.currentTime - _startAt;
  _stopNodes();
  _playing = false;
  cancelAnimationFrame(_raf);
  _updateUI();
}

/* ── 停止 ─────────────────────────────────────── */
function stop() {
  _stopNodes();
  _playing = false;
  _pausedAt = 0;
  cancelAnimationFrame(_raf);
  _updateUI();
}

function _stopNodes() {
  for (const { osc } of _schedNodes) {
    try { osc.stop(); } catch(e) {}
  }
  _schedNodes = [];
}

/* ── RAF ループ (シークバー + 終了検知) ──────── */
function _tick() {
  if (!_playing || !_ac) return;
  const elapsed = _ac.currentTime - _startAt;
  const progress = Math.min(1, elapsed / _duration);

  /* シークバー更新 */
  const bar = document.getElementById('prevSeek');
  if (bar) bar.value = progress * 1000;

  /* 時間表示 */
  const timeEl = document.getElementById('prevTime');
  if (timeEl) {
    const cur = Math.max(0, Math.min(_duration, elapsed));
    timeEl.textContent = _fmtTime(cur) + ' / ' + _fmtTime(_duration);
  }

  if (elapsed >= _duration) {
    stop();
    return;
  }
  _raf = requestAnimationFrame(_tick);
}

function _fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

/* ── チャンネル音量 ─────────────────────────── */
const _chVol = {};
function setChVol(ch, val) {
  _chVol[ch] = val;
}

/* ── シーク ─────────────────────────────────── */
function seek(pos01) {
  const wasPlaying = _playing;
  if (wasPlaying) {
    _stopNodes();
    _playing = false;
    cancelAnimationFrame(_raf);
  }
  _pausedAt = pos01 * _duration;
  if (wasPlaying) play();
  else _updateUI();
}

/* ── UI 更新 ─────────────────────────────────── */
function _updateUI() {
  const container = document.getElementById('midiPreviewPanel');
  if (!container) return;

  /* ボタン状態 */
  const btnPlay  = document.getElementById('prevPlay');
  const btnPause = document.getElementById('prevPause');
  const btnStop  = document.getElementById('prevStop');
  if (btnPlay)  btnPlay.style.display  = _playing ? 'none' : '';
  if (btnPause) btnPause.style.display = _playing ? '' : 'none';
  if (btnStop)  btnStop.disabled = (!_playing && _pausedAt === 0);

  /* パネル表示/非表示は外部で制御 */
}

/* ── 外部公開 ─────────────────────────────────── */
function isPlaying() { return _playing; }
function getDuration() { return _duration; }

return { load, play, pause, stop, seek, setChVol, isPlaying, getDuration };
})();
