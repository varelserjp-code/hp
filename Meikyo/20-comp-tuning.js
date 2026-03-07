/* ═══════════════════════════════════════════════════════
   COMPENSATION TUNING ENGINE  v1.0
   ────────────────────────────────────────────────────
   MIDIノートに対してセントレベルのチューニング補正を適用。

   【機能】
   1. マスターチューン  — A4基準ピッチ (415〜466 Hz)
   2. グローバルセント  — ±100セント自由オフセット
   3. 音律テンプラメント — Equal/純正律/ピタゴラス/
                          中全音律/Werckmeister III/
                          Kirnberger III/カスタム
   4. インターバルオフセット — 12半音それぞれに個別補正
   5. チャンネル選択    — 適用チャンネルを指定
   6. 出力方式         — PitchBend後処理 / SysEx / RPN

   【MIDI実装】
   ノートOn直前に各チャンネルへPitch Bendを挿入し、
   ノートOff後にセンターへリセット。
   ピッチベンドレンジは pbRange (default 2st) を使用。
   またconductor trackにSysEx Master Fine Tuningを挿入。
   ═══════════════════════════════════════════════════════ */

const CompTuningEngine = (() => {
  'use strict';

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const ROUTING_PRIORITY = {
    protectedSources: new Set([0, 1, 4]),
    reservedShadowCount: 3,
  };

  function edoStepSize(edo) {
    const safeEdo = Math.max(1, Number(edo) || 12);
    return 1200 / safeEdo;
  }

  function buildEdoTemperament(edo) {
    const stepSize = edoStepSize(edo);
    const cents = Array.from({ length: 12 }, (_, pc) => {
      const targetCents = pc * 100;
      const nearestStep = Math.round(targetCents / stepSize);
      return +(nearestStep * stepSize - targetCents).toFixed(2);
    });
    return {
      name: `${edo}-EDO`,
      desc: `${edo}等分音律 — 12半音へ最近傍射影した微分音プリセット (${stepSize.toFixed(2)}¢/step)`,
      cents,
      edo,
      stepSize,
    };
  }

  function nearestPitch(freqHz, edo, pbRange = STATE.pbRange, referenceHz = 440.0) {
    const stepSize = edoStepSize(edo);
    const totalCents = 1200 * Math.log2(Math.max(freqHz, 0.000001) / referenceHz);
    const edoStep = Math.round(totalCents / stepSize);
    const edoCents = edoStep * stepSize;
    const midiFloat = 69 + edoCents / 100;
    const midiNote = Math.max(0, Math.min(127, Math.round(midiFloat)));
    const pitchBendCents = +(edoCents - (midiNote - 69) * 100).toFixed(2);
    return {
      edo,
      stepSize,
      edoStep,
      targetHz: +(referenceHz * Math.pow(2, edoCents / 1200)).toFixed(6),
      midiFloat: +midiFloat.toFixed(4),
      midiNote,
      pitchBendCents,
      pitchBendValue: centsToPB(pitchBendCents, pbRange),
    };
  }

  function scaleMicroToCustomCents(scaleName) {
    const degreeCents = getScaleDegreeCents(scaleName);
    const scale = ALL_SCALES[scaleName];
    if (!degreeCents || !scale || !Array.isArray(scale.iv)) return null;

    const customCents = Array(12).fill(0);
    const assigned = Array(12).fill(false);
    const limit = Math.min(scale.iv.length, degreeCents.length);
    for (let index = 0; index < limit; index++) {
      const interval = scale.iv[index];
      const pc = ((interval % 12) + 12) % 12;
      const deviation = +(degreeCents[index] - interval * 100).toFixed(2);
      if (!assigned[pc] || Math.abs(deviation) < Math.abs(customCents[pc])) {
        customCents[pc] = deviation;
        assigned[pc] = true;
      }
    }
    return customCents;
  }

  function getScaleDegreeCents(scaleName, rootPc = 0, options = {}) {
    if (typeof ALL_SCALES === 'undefined') return null;
    const scale = ALL_SCALES[scaleName];
    if (!scale || !Array.isArray(scale.iv)) return null;

    if (options.useJI && typeof JustIntonation !== 'undefined' && options.jiParams) {
      const jiRows = JustIntonation.getDeviationTable(rootPc, options.jiParams);
      return scale.iv.map(interval => {
        const pc = (((rootPc + interval) % 12) + 12) % 12;
        const row = jiRows.find(entry => entry.pc === pc);
        return row ? +(row.etCents + row.deviation).toFixed(2) : interval * 100;
      });
    }

    if (typeof MICRO_CENTS === 'undefined') return null;
    const microCents = MICRO_CENTS[scaleName];
    if (!microCents || !microCents.length) return null;
    return scale.iv.map((interval, index) => {
      const cents = microCents[index];
      return typeof cents === 'number' ? cents : interval * 100;
    });
  }

  /* ─── 音律テンプラメント定義 ─────────────────────
     各エントリ: 12音のセントオフセット配列
     index 0 = ルート, 1 = 短2度, 2 = 長2度 ... 11 = 長7度
  ──────────────────────────────────────────────────── */
  const TEMPERAMENTS = {
    'Equal': {
      name: 'Equal Temperament',
      desc: '平均律 — 全半音均等分割',
      cents: [0,0,0,0,0,0,0,0,0,0,0,0],
    },
    'Just': {
      name: 'Just Intonation (5-limit)',
      desc: '純正律 — 整数比率に基づく完全和音 (5-limit: 1,25/24,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,9/5,15/8)',
      cents: [0,-29.33,3.91,15.64,-13.69,-1.96,-9.78,1.96,13.69,-15.64,17.6,-11.73],
    },
    'Pythagorean': {
      name: 'Pythagorean',
      desc: 'ピタゴラス律 — 完全5度(3/2)の連鎖、C基準±6度',
      cents: [0,-9.78,3.91,-5.87,7.82,-1.96,11.73,1.96,-7.82,5.87,-3.91,9.78],
    },
    'Meantone': {
      name: 'Quarter-Comma Meantone',
      desc: '中全音律 — 長3度を純正に。5度 = 5^(1/4) ≈ 696.58¢。G#はAbとして使用',
      cents: [0,-23.95,-6.84,10.26,-13.69,3.42,-20.53,-3.42,13.69,-10.26,6.84,-17.11],
    },
    'Werckmeister': {
      name: 'Werckmeister III',
      desc: 'ヴェルクマイスター III — バッハ時代の不等分律 (1691)',
      cents: [0,-9.78,-7.82,-5.87,-9.77,-1.95,-11.73,-3.91,-7.82,-11.73,-3.91,-7.82],
    },
    'Kirnberger': {
      name: 'Kirnberger III',
      desc: 'キルンベルガー III — 純正律に近い不等分律 (1779)',
      cents: [0,-9.78,3.91,-5.87,-13.69,-1.95,-9.78,1.96,-7.82,-15.64,-3.91,-11.73],
    },
    'Vallotti': {
      name: 'Vallotti & Young',
      desc: 'ヴァロッティ — F-C-G-D-A-E: 1/6 PC細め5度 + E-B-F#-C#-G#-Eb: 純正5度 (1728)',
      cents: [0,-1.95,-3.91,1.95,-7.82,1.95,-3.91,-1.96,0,-5.87,0,-5.87],
    },
    'Young': {
      name: 'Young II',
      desc: 'ヤング II — C-G-D-A-E-B: 1/6 PC細め5度 + B以降: 純正5度 (Thomas Young 1800)',
      cents: [0,-6.1,-4.2,-2.2,-8.3,-0.1,-8.1,-2.2,-4.2,-6.2,-0.2,-8.2],
    },
    '19-EDO': buildEdoTemperament(19),
    '31-EDO': buildEdoTemperament(31),
    '53-EDO': buildEdoTemperament(53),
    'Custom': {
      name: 'Custom',
      desc: 'カスタム — 各音に自由にセントオフセット',
      cents: [0,0,0,0,0,0,0,0,0,0,0,0],
    },
  };

  /* ─── A4基準プリセット ─────────────────────────── */
  const A4_PRESETS = [
    { hz: 415.3, label: '415.3', desc: 'バロック調律' },
    { hz: 432.0, label: '432',   desc: '宇宙調律' },
    { hz: 436.0, label: '436',   desc: '歴史的欧州標準' },
    { hz: 440.0, label: '440',   desc: 'ISO 16 国際標準' },
    { hz: 441.0, label: '441',   desc: '日本の放送基準' },
    { hz: 442.0, label: '442',   desc: '欧州オーケストラ標準' },
    { hz: 443.0, label: '443',   desc: '一部の欧州室内楽' },
    { hz: 444.0, label: '444',   desc: '高めの現代標準' },
    { hz: 446.0, label: '446',   desc: 'ヒストリカル高調律' },
    { hz: 466.2, label: '466.2', desc: '高バロック (a semitone up)' },
  ];

  /* ─── チャンネル定義 ─────────────────────────────
     適用するチャンネルを選択できる
  ──────────────────────────────────────────────────── */
  const CH_DEFS = [
    { ch:0,  label:'Ch1',  desc:'Drone/Pad/Arp etc.' },
    { ch:1,  label:'Ch2',  desc:''},
    { ch:2,  label:'Ch3',  desc:''},
    { ch:3,  label:'Ch4',  desc:''},
    { ch:4,  label:'Ch5',  desc:''},
    { ch:5,  label:'Ch6',  desc:''},
    { ch:6,  label:'Ch7',  desc:''},
    { ch:7,  label:'Ch8',  desc:''},
    { ch:8,  label:'Ch9',  desc:'Markov'},
    { ch:9,  label:'Ch10', desc:'Percussion (skip)'},
    { ch:10, label:'Ch11', desc:'L-System'},
    { ch:11, label:'Ch12', desc:'Solfeggio'},
    { ch:12, label:'Ch13', desc:'Binaural L'},
    { ch:13, label:'Ch14', desc:'Binaural R'},
  ];

  /* ─── STATE ──────────────────────────────────────── */
  const STATE = {
    enabled: false,
    a4Hz: 440.0,
    globalCents: 0,       // -100 ~ +100 (A4補正以外の追加オフセット)
    autoScaleSync: true,
    temperament: 'Equal',
    customCents: [0,0,0,0,0,0,0,0,0,0,0,0], // Custom mode用
    linkedScaleName: null,
    rootPc: 0,            // テンプラメント基音 (0=C, 9=A etc.)
    pbRange: 2,           // PitchBendレンジ (半音)
    channels: new Set([0,1,2,3,4,5,6,7,8,10,11]), // 適用ch（ch9=percは除外）
    outputMode: 'pb',     // 'pb'=PitchBend後処理 / 'sysex'=SysExのみ / 'both'
    applySysEx: true,
    generatedNoteCentsMap: null,
    lastAdaptiveRouting: { used: false, reassignedNotes: 0, fallbackConflicts: 0, spareChannels: [], shadowPoolSize: 0, trackStats: {} },
  };

  function buildGeneratedNoteCentsMap(scaleName, rootPc = 0, octaveRange = [0, 10], options = {}) {
    const degreeCents = getScaleDegreeCents(scaleName, rootPc, options);
    if (!degreeCents || !degreeCents.length) return null;
    const map = Object.create(null);
    const startOct = Math.max(0, octaveRange[0] ?? 0);
    const endOct = Math.max(startOct, octaveRange[1] ?? 10);
    for (let octave = startOct; octave <= endOct; octave++) {
      const base = octave * 12 + (((Number(rootPc) || 0) % 12) + 12) % 12;
      for (const cents of degreeCents) {
        const midiFloat = base + cents / 100;
        const midiNote = Math.max(0, Math.min(127, Math.round(midiFloat)));
        const detuneCents = +(cents - (midiNote - base) * 100).toFixed(2);
        if (!Object.prototype.hasOwnProperty.call(map, midiNote) || Math.abs(detuneCents) < Math.abs(map[midiNote])) {
          map[midiNote] = detuneCents;
        }
      }
    }
    return map;
  }

  function setGeneratedNoteCentsMap(noteMap) {
    STATE.generatedNoteCentsMap = noteMap && Object.keys(noteMap).length ? { ...noteMap } : null;
  }

  function clearGeneratedNoteCentsMap() {
    STATE.generatedNoteCentsMap = null;
  }

  function clearScaleMicroLink() {
    STATE.linkedScaleName = null;
  }

  function disableScaleMicroSync() {
    STATE.autoScaleSync = false;
    clearScaleMicroLink();
  }

  function setScaleMicroSync(enabled) {
    STATE.autoScaleSync = !!enabled;
    if (!STATE.autoScaleSync) clearScaleMicroLink();
  }

  function syncScaleMicroTuning(scaleName, rootPc = STATE.rootPc) {
    if (!STATE.autoScaleSync) return false;
    const customCents = scaleMicroToCustomCents(scaleName);
    if (!customCents) {
      if (STATE.linkedScaleName === scaleName) STATE.linkedScaleName = null;
      return false;
    }
    STATE.temperament = 'Custom';
    STATE.customCents = customCents;
    STATE.rootPc = ((Number(rootPc) || 0) % 12 + 12) % 12;
    STATE.linkedScaleName = scaleName;
    return true;
  }

  /* ─── 計算ユーティリティ ─────────────────────────── */
  // A4=440Hzからのセントオフセット計算
  const a4ToCents = hz => 1200 * Math.log2(hz / 440.0);

  // ノートpcに対するテンプラメントのセントオフセット
  function getIntervalCents(noteMidi) {
    const pc = ((noteMidi % 12) - STATE.rootPc + 12) % 12;
    const tCents = STATE.temperament === 'Custom'
      ? STATE.customCents[pc]
      : TEMPERAMENTS[STATE.temperament].cents[pc];
    return tCents;
  }

  // ノートのトータルセントオフセット
  function totalCentsForNote(noteMidi) {
    const masterCents = a4ToCents(STATE.a4Hz);      // A4基準補正
    const globalCents = STATE.globalCents;            // グローバル追加オフセット
    const generatedCents = STATE.generatedNoteCentsMap && Object.prototype.hasOwnProperty.call(STATE.generatedNoteCentsMap, noteMidi)
      ? STATE.generatedNoteCentsMap[noteMidi]
      : null;
    const tempCents   = getIntervalCents(noteMidi);   // テンプラメント補正
    return masterCents + globalCents + (generatedCents != null ? generatedCents : tempCents);
  }

  function remapChannelRaw(raw, channel) {
    if (!raw || !raw.length) return raw;
    const bytes = [...raw];
    if (bytes[0] >= 0x80 && bytes[0] <= 0xEF) bytes[0] = (bytes[0] & 0xF0) | (channel & 0x0F);
    return bytes;
  }

  // セント→ピッチベンド値変換 (pbRange半音)
  function centsToPB(cents, pbRange) {
    const semis = cents / 100;
    const pb = Math.round(8192 + 8191 * (semis / pbRange));
    return Math.max(0, Math.min(16383, pb));
  }

  // SysEx Master Fine Tuning バイト列生成
  // F0 7F 7F 04 03 [lsb] [msb] F7
  // center = 0x2000 = 8192, range = ±100 cents
  function makeMasterTuningSysEx(cents) {
    const val = Math.round(8192 + (cents / 100) * 8192);
    const clamped = Math.max(0, Math.min(16383, val));
    const lsb = clamped & 0x7F;
    const msb = (clamped >> 7) & 0x7F;
    return [0xF0, 0x7F, 0x7F, 0x04, 0x03, lsb, msb, 0xF7];
  }

  // RPN Fine Tuning (RPN 0x0001) — チャンネルごと
  // cents: -64 ~ +63 (semitones) + fine (0~127 = 0~99 cents)
  function makeRPNTuning(ch, cents) {
    const semitones = Math.floor(cents / 100);
    const fine = Math.round(((cents / 100) - Math.floor(cents / 100)) * 128);
    const coarse = Math.max(0, Math.min(127, 64 + semitones));
    const evs = [];
    // RPN select: CC101=0, CC100=1 (Fine Tuning)
    evs.push({ d: 0, v: [0xB0|ch, 101, 0] });
    evs.push({ d: 0, v: [0xB0|ch, 100, 1] });
    // Data Entry MSB (coarse ±64st)
    evs.push({ d: 0, v: [0xB0|ch, 6,  coarse] });
    // Data Entry LSB (fine 0~127 = 0~99cents)
    evs.push({ d: 0, v: [0xB0|ch, 38, Math.max(0, Math.min(127, fine))] });
    // RPN null (deselect)
    evs.push({ d: 0, v: [0xB0|ch, 101, 127] });
    evs.push({ d: 0, v: [0xB0|ch, 100, 127] });
    return evs;
  }

  /* ─── MIDI後処理: PitchBendによるチューニング適用 ──
     各トラックのバイト列を解析し、対象チャンネルの
     ノートOnの直前にPitch Bendイベントを挿入し、
     ノートOffの直後にPB=8192(center)へリセット。
  ──────────────────────────────────────────────────── */
  function applyTuningToTrack(trackBytes, pbRange, spareChannels = [], trackName = 'Track') {
    if (!STATE.enabled) return trackBytes;
    // 補正が実質ゼロの場合はスキップ（パフォーマンス最適化）
    const masterCents = a4ToCents(STATE.a4Hz);
    const totalTest = masterCents + STATE.globalCents;
    // Equalテンプラメントかつトータルオフセットが0.1¢未満ならバイパス
    if (STATE.temperament === 'Equal' && Math.abs(totalTest) < 0.1) {
      return trackBytes;
    }

    // イベントをパース
    const evs = parseTuningTrackData(trackBytes);
    if (!evs || !evs.length) return trackBytes;

    const out = [];
    const activePhysical = new Map();
    const noteAssignments = new Map();
    const shadowChannelsByOriginal = new Map();
    const channelState = new Map();
    const trackRouting = { reassignedNotes: 0, fallbackConflicts: 0 };

    function getShadowSet(origCh) {
      if (!shadowChannelsByOriginal.has(origCh)) shadowChannelsByOriginal.set(origCh, new Set());
      return shadowChannelsByOriginal.get(origCh);
    }

    function trackChannelState(ev) {
      if (typeof ev.ch !== 'number' || !ev.raw || !ev.raw.length) return;
      const hi = ev.raw[0] & 0xF0;
      if (hi === 0xE0 || hi === 0x80 || hi === 0x90) return;
      if (!channelState.has(ev.ch)) channelState.set(ev.ch, new Map());
      const bucket = channelState.get(ev.ch);
      const key = hi === 0xB0 ? `B${ev.raw[1]}` : hi === 0xC0 ? 'C' : hi === 0xD0 ? 'D' : hi === 0xA0 ? `A${ev.raw[1]}` : null;
      if (key) bucket.set(key, [...ev.raw]);
    }

    function cloneChannelState(origCh, targetCh, tick) {
      if (origCh === targetCh) return;
      const bucket = channelState.get(origCh);
      if (!bucket) return;
      for (const raw of bucket.values()) out.push({ tick, order: 8, bytes: remapChannelRaw(raw, targetCh) });
    }

    function spareOrderForSource(origCh) {
      if (!spareChannels.length) return spareChannels;
      const reserved = spareChannels.slice(0, Math.min(ROUTING_PRIORITY.reservedShadowCount, spareChannels.length));
      const general = spareChannels.slice(reserved.length);
      if (ROUTING_PRIORITY.protectedSources.has(origCh)) return [...reserved, ...general];
      return [...general, ...reserved];
    }

    function chooseOutputChannel(origCh, pb) {
      const originalState = activePhysical.get(origCh);
      if (!originalState || originalState.pb === pb) return origCh;
      let freeShadow = null;
      for (const shadowCh of spareOrderForSource(origCh)) {
        const shadowState = activePhysical.get(shadowCh);
        if (shadowState && shadowState.pb === pb) return shadowCh;
        if (!shadowState && freeShadow == null) freeShadow = shadowCh;
      }
      if (freeShadow == null) {
        STATE.lastAdaptiveRouting.fallbackConflicts += 1;
        trackRouting.fallbackConflicts += 1;
      }
      return freeShadow != null ? freeShadow : origCh;
    }

    function registerActiveChannel(channel, pb) {
      const current = activePhysical.get(channel);
      if (!current) activePhysical.set(channel, { count: 1, pb });
      else {
        current.count += 1;
        current.pb = pb;
      }
    }

    function unregisterActiveChannel(channel) {
      const current = activePhysical.get(channel);
      if (!current) return true;
      current.count -= 1;
      if (current.count <= 0) {
        activePhysical.delete(channel);
        return true;
      }
      return false;
    }

    function pushNoteAssignment(origCh, note, physicalCh) {
      const key = `${origCh}:${note}`;
      const stack = noteAssignments.get(key) || [];
      stack.push(physicalCh);
      noteAssignments.set(key, stack);
    }

    function shiftNoteAssignment(origCh, note) {
      const key = `${origCh}:${note}`;
      const stack = noteAssignments.get(key);
      if (!stack || !stack.length) return null;
      const physicalCh = stack.shift();
      if (!stack.length) noteAssignments.delete(key);
      return physicalCh;
    }

    function duplicateChannelEventToShadows(ev) {
      const shadows = shadowChannelsByOriginal.get(ev.ch);
      if (!shadows || !shadows.size) return;
      shadows.forEach(shadowCh => {
        if (activePhysical.has(shadowCh)) out.push({ tick: ev.tick, order: 24, bytes: remapChannelRaw(ev.raw, shadowCh) });
      });
    }

    // 既存のPBイベントは除去（元トラックにMPEなどのPBがある場合に衝突するため）
    const filteredEvs = evs.filter(ev =>
      !(ev.type === 'ctrl' && ev.raw && (ev.raw[0] & 0xF0) === 0xE0 && STATE.channels.has(ev.raw[0] & 0x0F))
    );

    for (const ev of filteredEvs) {
      trackChannelState(ev);
      if (ev.type === 'noteOn' && STATE.channels.has(ev.ch)) {
        const cents = totalCentsForNote(ev.note);
        const pb = centsToPB(cents, pbRange);
        const targetCh = chooseOutputChannel(ev.ch, pb);
        if (targetCh !== ev.ch) {
          STATE.lastAdaptiveRouting.used = true;
          STATE.lastAdaptiveRouting.reassignedNotes += 1;
          trackRouting.reassignedNotes += 1;
          cloneChannelState(ev.ch, targetCh, ev.tick);
          getShadowSet(ev.ch).add(targetCh);
        }
        out.push({ tick: ev.tick, order: 10, bytes: [0xE0|targetCh, pb & 0x7F, (pb >> 7) & 0x7F] });
        out.push({ tick: ev.tick, order: 20, bytes: remapChannelRaw(ev.raw, targetCh) });
        registerActiveChannel(targetCh, pb);
        pushNoteAssignment(ev.ch, ev.note, targetCh);
      } else if (ev.type === 'noteOff' && STATE.channels.has(ev.ch)) {
        const targetCh = shiftNoteAssignment(ev.ch, ev.note) ?? ev.ch;
        out.push({ tick: ev.tick, order: 40, bytes: remapChannelRaw(ev.raw, targetCh) });
        if (unregisterActiveChannel(targetCh)) {
          out.push({ tick: ev.tick + 1, order: 45, bytes: [0xE0|targetCh, 0x00, 0x40] });
          const shadows = shadowChannelsByOriginal.get(ev.ch);
          if (shadows) shadows.delete(targetCh);
        }
      } else {
        out.push({ tick: ev.tick, order: 30, bytes: ev.raw });
        if (ev.type === 'ctrl' && STATE.channels.has(ev.ch)) duplicateChannelEventToShadows(ev);
      }
    }

    out.sort((a, b) => a.tick - b.tick || (a.order || 50) - (b.order || 50));

    if ((trackRouting.reassignedNotes > 0 || trackRouting.fallbackConflicts > 0) && STATE.lastAdaptiveRouting && STATE.lastAdaptiveRouting.trackStats) {
      const current = STATE.lastAdaptiveRouting.trackStats[trackName] || { reassignedNotes: 0, fallbackConflicts: 0 };
      current.reassignedNotes += trackRouting.reassignedNotes;
      current.fallbackConflicts += trackRouting.fallbackConflicts;
      STATE.lastAdaptiveRouting.trackStats[trackName] = current;
    }

    return rebuildTrackBytes(out);
  }

  /* トラックバイト列をイベントにパース */
  function parseTuningTrackData(data) {
    const evs = [];
    let p = 0, tick = 0, rs = 0;
    while (p < data.length) {
      // delta time
      let delta = 0;
      while (p < data.length) {
        const b = data[p++];
        delta = (delta << 7) | (b & 0x7F);
        if (!(b & 0x80)) break;
      }
      tick += delta;
      if (p >= data.length) break;

      const fb = data[p];
      if (fb === 0xFF) {
        // Meta event
        p++;
        const mt = data[p++];
        let ml = 0;
        while (p < data.length) { const b = data[p++]; ml=(ml<<7)|(b&0x7F); if(!(b&0x80))break; }
        const raw = [0xFF, mt, ...vlEncode(ml), ...data.slice(p, p+ml)];
        if (mt === 0x2F) { evs.push({tick, type:'endTrack', raw}); break; }
        evs.push({ tick, type: 'meta', raw });
        p += ml;
        continue;
      }
      if (fb === 0xF0 || fb === 0xF7) {
        // SysEx
        p++;
        let sl = 0;
        while (p < data.length) { const b = data[p++]; sl=(sl<<7)|(b&0x7F); if(!(b&0x80))break; }
        const raw = [fb, ...vlEncode(sl), ...data.slice(p, p+sl)];
        evs.push({ tick, type: 'sysex', raw });
        p += sl;
        continue;
      }

      let st = fb;
      if (fb & 0x80) { rs = fb; p++; } else st = rs;
      const hi = st & 0xF0, ch = st & 0x0F;

      if (hi === 0x90) {
        const note = data[p], vel = data[p+1]; p += 2;
        const type = vel > 0 ? 'noteOn' : 'noteOff';
        evs.push({ tick, type, ch, note, vel, raw: [st, note, vel] });
      } else if (hi === 0x80) {
        const note = data[p], vel = data[p+1]; p += 2;
        evs.push({ tick, type: 'noteOff', ch, note, vel, raw: [st, note, vel] });
      } else if (hi === 0xA0 || hi === 0xB0 || hi === 0xE0) {
        const d1 = data[p], d2 = data[p+1]; p += 2;
        evs.push({ tick, type: 'ctrl', ch, raw: [st, d1, d2] });
      } else if (hi === 0xC0 || hi === 0xD0) {
        const d1 = data[p]; p += 1;
        evs.push({ tick, type: 'ctrl', ch, raw: [st, d1] });
      } else {
        evs.push({ tick, type: 'unknown', raw: [st] });
        p++;
      }
    }
    return evs;
  }

  function vlEncode(v) {
    const b = [];
    b.unshift(v & 0x7F); v >>= 7;
    while (v > 0) { b.unshift((v & 0x7F) | 0x80); v >>= 7; }
    return b;
  }

  function rebuildTrackBytes(evs) {
    const out = [];
    let prevTick = 0;
    // endTrackイベントを末尾に1つだけ出力するため、まず除外してソート
    const bodyEvs = evs.filter(ev => {
      if (!ev.bytes) return false;
      const b = ev.bytes;
      // FF 2F 00 = End of Track meta event
      return !(b.length >= 2 && b[0] === 0xFF && b[1] === 0x2F);
    });
    bodyEvs.sort((a, b) => a.tick - b.tick || (a.order || 50) - (b.order || 50));
    for (const ev of bodyEvs) {
      const delta = Math.max(0, ev.tick - prevTick);
      prevTick = ev.tick;
      out.push(...vlEncode(delta), ...ev.bytes);
    }
    // end of track（1回だけ）
    out.push(0, 0xFF, 0x2F, 0);
    return out;
  }

  /* ─── conductor trackへのSysEx/RPN挿入 ─────────── */
  function buildTuningHeader(channels, pbRange) {
    if (!STATE.enabled) return [];
    const evs = [];
    const masterCents = a4ToCents(STATE.a4Hz) + STATE.globalCents;

    // SysEx Master Fine Tuning (全チャンネル共通)
    if (STATE.applySysEx && Math.abs(masterCents) > 0.1) {
      evs.push({ d: 0, v: makeMasterTuningSysEx(masterCents) });
    }

    // RPN Fine/Coarse Tuning — 対象チャンネルごと
    // ※テンプラメントによる音ごとの補正はPB後処理で行うため
    //   ここではマスターチューン分のみRPN適用
    if (STATE.outputMode === 'both' || STATE.outputMode === 'rpn') {
      for (const ch of STATE.channels) {
        makeRPNTuning(ch, masterCents).forEach(e => evs.push(e));
      }
    }

    return evs;
  }

  /* ─── 現在のチューニング状態を表示文字列で返す ─── */
  function getSummary() {
    const masterCents = a4ToCents(STATE.a4Hz);
    const total = masterCents + STATE.globalCents;
    const sign = total >= 0 ? '+' : '';
    return `A4=${STATE.a4Hz}Hz (${sign}${(masterCents).toFixed(2)}¢) ` +
           `+ Global ${STATE.globalCents >= 0 ? '+' : ''}${STATE.globalCents}¢ ` +
           `= ${sign}${total.toFixed(2)}¢ | ${TEMPERAMENTS[STATE.temperament]?.name||STATE.temperament}`;
  }

  /* ─── UI構築 ─────────────────────────────────────── */
  function buildUI() {
    buildA4Presets();
    buildTemperamentButtons();
    buildIntervalGrid();
    buildChannelButtons();
    updateDisplay();
  }

  function buildA4Presets() {
    const el = document.getElementById('ctA4Presets');
    if (!el) return;
    el.innerHTML = A4_PRESETS.map(p =>
      `<div class="ct-a4-btn ${STATE.a4Hz===p.hz?'on':''}" data-hz="${p.hz}" title="${p.desc}">
        ${p.label}
      </div>`
    ).join('');
    el.querySelectorAll('.ct-a4-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.a4Hz = parseFloat(btn.dataset.hz);
        const sl = document.getElementById('ctA4Slider');
        if (sl) sl.value = STATE.a4Hz;
        const vl = document.getElementById('ctA4Val');
        if (vl) vl.textContent = STATE.a4Hz.toFixed(1) + ' Hz';
        buildA4Presets();
        updateDisplay();
      });
    });
  }

  function buildTemperamentButtons() {
    const el = document.getElementById('ctTempGrid');
    if (!el) return;
    el.innerHTML = Object.keys(TEMPERAMENTS).map(k =>
      `<div class="ct-temp-btn ${STATE.temperament===k?'on':''}" data-temp="${k}">
        ${TEMPERAMENTS[k].name.replace(' Temperament','').replace('Quarter-Comma ','').replace(' III','')}
      </div>`
    ).join('');
    el.querySelectorAll('.ct-temp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.temperament = btn.dataset.temp;
        disableScaleMicroSync();
        buildTemperamentButtons();
        buildIntervalGrid();
        updateDisplay();
      });
    });
  }

  function buildIntervalGrid() {
    const el = document.getElementById('ctIntervalGrid');
    if (!el) return;
    const tCents = STATE.temperament === 'Custom'
      ? STATE.customCents
      : TEMPERAMENTS[STATE.temperament].cents;
    const isCustom = STATE.temperament === 'Custom';
    el.innerHTML = Array.from({length:12}, (_,i) => {
      const val = tCents[i];
      const sign = val >= 0 ? '+' : '';
      return `<div class="ct-iv-cell">
        <div class="ct-iv-name">${NOTE_NAMES[(i + STATE.rootPc) % 12]}</div>
        ${isCustom
          ? `<input class="ct-iv-input" type="number" min="-100" max="100" step="0.1"
               value="${val.toFixed(1)}" data-idx="${i}">`
          : `<div class="ct-iv-val">${sign}${val.toFixed(1)}¢</div>`
        }
      </div>`;
    }).join('');
    if (isCustom) {
      el.querySelectorAll('.ct-iv-input').forEach(inp => {
        inp.addEventListener('change', () => {
          const idx = parseInt(inp.dataset.idx);
          STATE.customCents[idx] = parseFloat(inp.value) || 0;
          disableScaleMicroSync();
          updateDisplay();
        });
      });
    }
  }

  function buildChannelButtons() {
    const el = document.getElementById('ctChButtons');
    if (!el) return;
    el.innerHTML = CH_DEFS.map(c =>
      `<div class="ct-ch-btn ${STATE.channels.has(c.ch)?'on':''}" data-ch="${c.ch}"
        title="${c.desc}">${c.label}</div>`
    ).join('');
    el.querySelectorAll('.ct-ch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = parseInt(btn.dataset.ch);
        if (STATE.channels.has(ch)) STATE.channels.delete(ch);
        else STATE.channels.add(ch);
        btn.classList.toggle('on', STATE.channels.has(ch));
      });
    });
  }

  function updateDisplay() {
    const el = document.getElementById('ctDisplay');
    if (!el) return;
    const masterCents = a4ToCents(STATE.a4Hz);
    const total = masterCents + STATE.globalCents;
    const sign = v => v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
    const temp = TEMPERAMENTS[STATE.temperament];
    const edoInfo = temp && temp.edo
      ? `<br>EDO mapping: ${temp.edo} equal divisions (${temp.stepSize.toFixed(2)}¢/step) projected onto 12 chromatic notes`
      : '';
    const linkedScaleInfo = STATE.linkedScaleName
      ? `<br>Scale sync: ${STATE.linkedScaleName} @ ${NOTE_NAMES[STATE.rootPc]}`
      : '';
    const syncModeInfo = `<br>Scale sync mode: ${STATE.autoScaleSync ? 'AUTO' : 'MANUAL'}`;
    el.innerHTML =
      `A4 = ${STATE.a4Hz.toFixed(1)} Hz &nbsp;|&nbsp; ${sign(masterCents)}¢ from 440<br>` +
      `Global offset = ${sign(STATE.globalCents)}¢ &nbsp;|&nbsp; Total = ${sign(total)}¢<br>` +
      `Temperament: ${temp ? temp.name : STATE.temperament}<br>` +
      `Root: ${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][STATE.rootPc]} &nbsp;|&nbsp;` +
      ` Channels: ${[...STATE.channels].sort((a,b)=>a-b).map(c=>`Ch${c+1}`).join(' ')}` +
      edoInfo +
      linkedScaleInfo +
      syncModeInfo;
  }

  return {
    STATE,
    TEMPERAMENTS,
    A4_PRESETS,
    NOTE_NAMES,
    a4ToCents,
    edoStepSize,
    buildEdoTemperament,
    nearestPitch,
    getScaleDegreeCents,
    scaleMicroToCustomCents,
    buildGeneratedNoteCentsMap,
    setGeneratedNoteCentsMap,
    clearGeneratedNoteCentsMap,
    syncScaleMicroTuning,
    setScaleMicroSync,
    disableScaleMicroSync,
    clearScaleMicroLink,
    totalCentsForNote,
    centsToPB,
    makeMasterTuningSysEx,
    makeRPNTuning,
    applyTuningToTrack,
    buildTuningHeader,
    getSummary,
    buildUI,
    buildA4Presets,
    buildTemperamentButtons,
    buildIntervalGrid,
    buildChannelButtons,
    updateDisplay,
  };
})();


