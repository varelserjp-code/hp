(() => {
  'use strict';

  const PATCH = window.__MEIKY_PATCH__ || {};

  PATCH.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  PATCH.STORAGE_PREFIX = 'meikyoshisui_v25_';
  PATCH.abVariants = PATCH.abVariants || { A: null, B: null };
  PATCH.midiMonitorState = PATCH.midiMonitorState || { armedTarget: '', events: [] };
  PATCH.midiCaptureState = PATCH.midiCaptureState || {
    enabled: false,
    lastCapturedKey: '',
    lastCapturedAt: 0,
    lastCaptureSource: '',
    pendingKey: '',
    pendingSince: 0,
    pendingChord: null,
    pendingTimer: null,
    policy: {
      mode: 'stable',
      holdMs: 180,
      minVelocity: 1,
      ignoreInversions: true,
    },
  };
  PATCH.SCALA_TEMPERAMENT_KEY = 'Scala';
  PATCH.SCALA_PRESETS = PATCH.SCALA_PRESETS || [];
  PATCH.SCALA_FAVORITE_SLOTS = ['F1', 'F2', 'F3', 'F4'];
  PATCH.SCALA_FAVORITES_KEY = PATCH.STORAGE_PREFIX + 'scala_favorites';
  PATCH.MIDI_LEARN_KEY = PATCH.STORAGE_PREFIX + 'midi_learn_map';
  PATCH.sectionLearnFocus = PATCH.sectionLearnFocus || { ji: 0, comp: 0 };
  PATCH.sectionPreviewFollow = PATCH.sectionPreviewFollow || { ji: false, comp: false };
  PATCH.previewTransportState = PATCH.previewTransportState || { playing: false, bar: 0, progress: 0, duration: 0 };
  PATCH.jiAdaptiveMemory = PATCH.jiAdaptiveMemory || { prevCents: null, prevPcs: [], lastOffsetCents: 0, lastCommonCount: 0 };
  PATCH.MIDI_LEARN_TARGETS = [
    { id: 'density', label: 'DENSITY', min: 0, max: 100, valueId: 'densityV', format: value => value + '%' },
    { id: 'velocity', label: 'VELOCITY', min: 1, max: 127, valueId: 'velocityV', format: value => '' + value },
    { id: 'humanize', label: 'HUMANIZE', min: 0, max: 100, valueId: 'humanizeV', format: value => value + '%' },
    { id: 'dissonance', label: 'DISSONANCE', min: 0, max: 100, valueId: 'dissonanceV', format: value => value + '%' },
    { id: 'bpm', label: 'BPM', min: 30, max: 240, valueId: 'bpmV', format: value => value + ' BPM' },
    { id: 'gateBase', label: 'GATE RATIO', min: 30, max: 150, valueId: 'gateBaseV', format: value => (value / 100).toFixed(2) },
    { id: 'curveAmp', label: 'CURVE AMP', min: 0, max: 100, valueId: 'curveAmpV', format: value => value + '%' },
    { id: 'tempoDrift', label: 'TEMPO DRIFT', min: 0, max: 30, valueId: 'tempoDriftV', format: value => '±' + value + ' BPM' },
    { id: 'pbRange', label: 'PB RANGE', min: 1, max: 48, valueId: 'pbRangeV', format: value => '±' + value + ' st' },
    { id: 'concertA4', label: 'CONCERT A4', min: 415, max: 466, step: 0.1, valueId: 'ctA4Val', format: value => value.toFixed(1) + ' Hz' },
    { id: 'concertCents', label: 'GLOBAL CENTS', min: -100, max: 100, step: 0.5, valueId: 'ctGlobalCentsV', format: value => (value >= 0 ? '+' : '') + value.toFixed(1) + '¢' },
    { id: 'concertRoot', label: 'CONCERT ROOT', min: 0, max: 11, valueId: 'ctRootPcV', format: value => PATCH.NOTE_NAMES[PATCH.mod(value, 12)] || 'C' },
    { id: 'jiBlend', label: 'JI BLEND', min: 0, max: 100, valueId: 'jiBlendV', format: value => value + '%' },
    { id: 'jiMemory', label: 'JI MEMORY', min: 0, max: 100, valueId: 'jiAdaptiveMemoryStrengthV', format: value => value + '%' },
    { id: 'jiBassBias', label: 'JI BASS', min: 0, max: 100, valueId: 'jiAdaptiveBassBiasV', format: value => value + '%' },
    { id: 'jiVoiceLeading', label: 'JI VL', min: 0, max: 100, valueId: 'jiAdaptiveVoiceLeadingV', format: value => value + '%' },
    { id: 'jiCadence', label: 'JI CADENCE', min: 0, max: 100, valueId: 'jiAdaptiveCadenceStrengthV', format: value => value + '%' },
    { id: 'scalaPreset', label: 'SCALA PRESET', min: 0, max: 127, valueId: 'ctScalaStatus', format: value => String(value) },
    { id: 'scalaFavorite', label: 'SCALA FAVORITE', min: 0, max: 127, valueId: 'ctScalaStatus', format: value => String(value) },
    { id: 'jiSectionBlend', label: 'JI SEC BLEND', min: 0, max: 100, valueId: 'jiAdaptiveMemoryInfo', format: value => value + '%' },
    { id: 'jiSectionBass', label: 'JI SEC BASS', min: 0, max: 100, valueId: 'jiAdaptiveMemoryInfo', format: value => value + '%' },
    { id: 'jiSectionVl', label: 'JI SEC VL', min: 0, max: 100, valueId: 'jiAdaptiveMemoryInfo', format: value => value + '%' },
    { id: 'compSectionA4', label: 'CT SEC A4', min: 415, max: 466, step: 0.1, valueId: 'ctSectionInfo', format: value => value.toFixed(1) + ' Hz' },
    { id: 'compSectionCents', label: 'CT SEC CENTS', min: -100, max: 100, step: 0.5, valueId: 'ctSectionInfo', format: value => (value >= 0 ? '+' : '') + value.toFixed(1) + '¢' },
    { id: 'compSectionRoot', label: 'CT SEC ROOT', min: 0, max: 11, valueId: 'ctSectionInfo', format: value => PATCH.NOTE_NAMES[PATCH.mod(value, 12)] || 'C' },
    { id: 'compSectionScala', label: 'CT SEC SCALA', min: 0, max: 127, valueId: 'ctSectionInfo', format: value => String(value) },
  ];

  if (typeof JI_PARAMS !== 'undefined') {
    if (typeof JI_PARAMS.adaptiveMemoryEnabled !== 'boolean') JI_PARAMS.adaptiveMemoryEnabled = false;
    if (!Number.isFinite(JI_PARAMS.adaptiveMemoryStrength)) JI_PARAMS.adaptiveMemoryStrength = 0.65;
    if (!Number.isFinite(JI_PARAMS.adaptiveBassAnchorStrength)) JI_PARAMS.adaptiveBassAnchorStrength = 0;
    if (!Number.isFinite(JI_PARAMS.adaptiveVoiceLeadingStrength)) JI_PARAMS.adaptiveVoiceLeadingStrength = 0;
    if (typeof JI_PARAMS.adaptiveCadenceResetEnabled !== 'boolean') JI_PARAMS.adaptiveCadenceResetEnabled = false;
    if (!Number.isFinite(JI_PARAMS.adaptiveCadenceResetStrength)) JI_PARAMS.adaptiveCadenceResetStrength = 0.8;
    if (typeof JI_PARAMS.adaptiveResetOnSection !== 'boolean') JI_PARAMS.adaptiveResetOnSection = true;
    if (typeof JI_PARAMS.sectionModEnabled !== 'boolean') JI_PARAMS.sectionModEnabled = false;
    if (!Array.isArray(JI_PARAMS.sectionProfiles)) JI_PARAMS.sectionProfiles = [];
  }
  if (typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE) {
    if (typeof CompTuningEngine.STATE.sectionModEnabled !== 'boolean') CompTuningEngine.STATE.sectionModEnabled = false;
    if (!Array.isArray(CompTuningEngine.STATE.sectionProfiles)) CompTuningEngine.STATE.sectionProfiles = [];
  }
  if (typeof S !== 'undefined' && S && S.multiExport && typeof S.multiExport.includeManifest !== 'boolean') {
    S.multiExport.includeManifest = false;
  }

  PATCH.jsonClone = function jsonClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  };

  PATCH.getConcertA4Hz = function getConcertA4Hz() {
    if (typeof CompTuningEngine !== 'undefined' &&
        CompTuningEngine.STATE &&
        Number.isFinite(CompTuningEngine.STATE.a4Hz) &&
        CompTuningEngine.STATE.a4Hz > 0) {
      return CompTuningEngine.STATE.a4Hz;
    }
    return 440.0;
  };

  PATCH.midiToHz = function midiToHz(note, referenceHz) {
    const a4 = Number.isFinite(referenceHz) && referenceHz > 0 ? referenceHz : PATCH.getConcertA4Hz();
    return a4 * Math.pow(2, (note - 69) / 12);
  };

  PATCH.hzToMidi = function hzToMidi(freqHz, referenceHz) {
    const a4 = Number.isFinite(referenceHz) && referenceHz > 0 ? referenceHz : PATCH.getConcertA4Hz();
    if (freqHz <= 0) return 24;
    let note = Math.round(69 + 12 * Math.log2(freqHz / a4));
    while (note < 12) note += 12;
    while (note > 115) note -= 12;
    return note;
  };

  PATCH.hzDiffToCents = function hzDiffToCents(baseHz, beatHz) {
    return 1200 * Math.log2((baseHz + beatHz) / baseHz);
  };

  PATCH.getGlobalConcertOffsetCents = function getGlobalConcertOffsetCents() {
    const a4 = PATCH.getConcertA4Hz();
    const fromA4 = 1200 * Math.log2(a4 / 440.0);
    const globalCents =
      typeof CompTuningEngine !== 'undefined' &&
      CompTuningEngine.STATE &&
      Number.isFinite(CompTuningEngine.STATE.globalCents)
        ? CompTuningEngine.STATE.globalCents
        : 0;
    return fromA4 + globalCents;
  };

  PATCH.formatSignedCents = function formatSignedCents(value) {
    const rounded = Number.isFinite(value) ? value : 0;
    const sign = rounded > 0 ? '+' : '';
    return sign + rounded.toFixed(1) + '¢';
  };

  PATCH.readMidiLearnMappings = function readMidiLearnMappings() {
    try {
      const raw = localStorage.getItem(PATCH.MIDI_LEARN_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  PATCH.writeMidiLearnMappings = function writeMidiLearnMappings(mappings) {
    try {
      localStorage.setItem(PATCH.MIDI_LEARN_KEY, JSON.stringify(mappings || {}));
    } catch (_) {}
  };

  PATCH.getMidiLearnTarget = function getMidiLearnTarget(id) {
    return PATCH.MIDI_LEARN_TARGETS.find(target => target.id === id) || null;
  };

  PATCH.getFocusedSectionProfile = function getFocusedSectionProfile(kind) {
    if (kind === 'ji') {
      if (typeof JI_PARAMS === 'undefined' || !Array.isArray(JI_PARAMS.sectionProfiles) || !JI_PARAMS.sectionProfiles.length) return null;
      const index = Math.max(0, Math.min(JI_PARAMS.sectionProfiles.length - 1, Number(PATCH.sectionLearnFocus.ji) || 0));
      PATCH.sectionLearnFocus.ji = index;
      return { index, profile: JI_PARAMS.sectionProfiles[index] };
    }
    if (kind === 'comp') {
      if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE || !Array.isArray(CompTuningEngine.STATE.sectionProfiles) || !CompTuningEngine.STATE.sectionProfiles.length) return null;
      const index = Math.max(0, Math.min(CompTuningEngine.STATE.sectionProfiles.length - 1, Number(PATCH.sectionLearnFocus.comp) || 0));
      PATCH.sectionLearnFocus.comp = index;
      return { index, profile: CompTuningEngine.STATE.sectionProfiles[index] };
    }
    return null;
  };

  PATCH.getFocusedSectionLabel = function getFocusedSectionLabel(kind) {
    const focused = PATCH.getFocusedSectionProfile(kind);
    if (!focused || !focused.profile) return kind === 'ji' ? 'JI#1' : 'COMP#1';
    return focused.profile.name || ((kind === 'ji' ? 'JI' : 'COMP') + '#' + (focused.index + 1));
  };

  PATCH.isSectionLearnTarget = function isSectionLearnTarget(targetId) {
    return [
      'jiSectionBlend',
      'jiSectionBass',
      'jiSectionVl',
      'compSectionA4',
      'compSectionCents',
      'compSectionRoot',
      'compSectionScala',
    ].includes(targetId);
  };

  PATCH.describeLiveSectionFocus = function describeLiveSectionFocus() {
    const follow = PATCH.ensureSectionPreviewFollow();
    const transport = PATCH.previewTransportState || { bar: 0 };
    return {
      previewBar: Math.max(0, Math.floor(Number(transport.bar) || 0)),
      ji: {
        index: Number(PATCH.sectionLearnFocus && PATCH.sectionLearnFocus.ji) || 0,
        name: PATCH.getFocusedSectionLabel('ji'),
        follow: !!follow.ji,
      },
      comp: {
        index: Number(PATCH.sectionLearnFocus && PATCH.sectionLearnFocus.comp) || 0,
        name: PATCH.getFocusedSectionLabel('comp'),
        follow: !!follow.comp,
      },
    };
  };

  PATCH.ensureSectionPreviewFollow = function ensureSectionPreviewFollow() {
    const state = PATCH.sectionPreviewFollow || (PATCH.sectionPreviewFollow = {});
    if (typeof state.ji !== 'boolean') state.ji = false;
    if (typeof state.comp !== 'boolean') state.comp = false;
    return state;
  };

  PATCH.findSectionIndexForBar = function findSectionIndexForBar(profiles, bar) {
    if (!Array.isArray(profiles) || !profiles.length) return 0;
    const safeBar = Math.max(0, Math.floor(Number(bar) || 0));
    let index = 0;
    for (let i = 0; i < profiles.length; i++) {
      const startBar = Math.max(0, Math.floor(Number(profiles[i] && profiles[i].bar) || 0));
      if (safeBar >= startBar) index = i;
      else break;
    }
    return index;
  };

  PATCH.syncPreviewLinkedSectionFocus = function syncPreviewLinkedSectionFocus(bar, options) {
    const transport = PATCH.previewTransportState || (PATCH.previewTransportState = { playing: false, bar: 0, progress: 0, duration: 0 });
    const follow = PATCH.ensureSectionPreviewFollow();
    const safeBar = Math.max(0, Math.floor(Number(bar) || 0));
    const opts = options || {};
    const force = !!opts.force;
    const changedBar = transport.bar !== safeBar;
    transport.bar = safeBar;
    if (typeof opts.playing === 'boolean') transport.playing = opts.playing;
    if (Number.isFinite(opts.progress)) transport.progress = Math.max(0, Math.min(1, Number(opts.progress)));
    if (Number.isFinite(opts.duration)) transport.duration = Math.max(0, Number(opts.duration));

    let jiChanged = false;
    let compChanged = false;

    if (follow.ji && typeof JI_PARAMS !== 'undefined' && Array.isArray(JI_PARAMS.sectionProfiles) && JI_PARAMS.sectionProfiles.length) {
      const jiIndex = PATCH.findSectionIndexForBar(JI_PARAMS.sectionProfiles, safeBar);
      if (force || PATCH.sectionLearnFocus.ji !== jiIndex) {
        PATCH.sectionLearnFocus.ji = jiIndex;
        jiChanged = true;
      }
    }

    if (follow.comp &&
        typeof CompTuningEngine !== 'undefined' &&
        CompTuningEngine.STATE &&
        Array.isArray(CompTuningEngine.STATE.sectionProfiles) &&
        CompTuningEngine.STATE.sectionProfiles.length) {
      const compIndex = PATCH.findSectionIndexForBar(CompTuningEngine.STATE.sectionProfiles, safeBar);
      if (force || PATCH.sectionLearnFocus.comp !== compIndex) {
        PATCH.sectionLearnFocus.comp = compIndex;
        compChanged = true;
      }
    }

    if (jiChanged) PATCH.syncJustIntonationUI();
    if (compChanged) PATCH.syncCompSectionUI();
    if (!jiChanged && !compChanged && (changedBar || force)) PATCH.syncPatchDiagnosticsUI();

    return {
      bar: safeBar,
      ji: PATCH.sectionLearnFocus.ji,
      comp: PATCH.sectionLearnFocus.comp,
      playing: transport.playing,
    };
  };

  PATCH.resetPreviewSectionTracking = function resetPreviewSectionTracking() {
    const transport = PATCH.previewTransportState || (PATCH.previewTransportState = { playing: false, bar: 0, progress: 0, duration: 0 });
    transport.playing = false;
    transport.bar = 0;
    transport.progress = 0;
    transport.duration = 0;
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.scaleMidiToRange = function scaleMidiToRange(value, min, max) {
    const midi = Math.max(0, Math.min(127, Number(value) || 0));
    return Math.max(min, Math.min(max, Math.round(min + (midi / 127) * (max - min))));
  };

  PATCH.scaleMidiToStepRange = function scaleMidiToStepRange(value, min, max, step) {
    const midi = Math.max(0, Math.min(127, Number(value) || 0));
    const raw = min + (midi / 127) * (max - min);
    const safeStep = step && step > 0 ? step : 1;
    const snapped = Math.round(raw / safeStep) * safeStep;
    return Math.max(min, Math.min(max, +snapped.toFixed(4)));
  };

  PATCH.pushMidiMonitorEvent = function pushMidiMonitorEvent(text) {
    const state = PATCH.midiMonitorState || (PATCH.midiMonitorState = { armedTarget: '', events: [] });
    state.events.unshift(text);
    if (state.events.length > 8) state.events.length = 8;
  };

  PATCH.getProgressionCaptureBars = function getProgressionCaptureBars() {
    const input = document.getElementById('cpAddBars');
    const value = input ? parseInt(input.value, 10) : 4;
    return Math.max(1, Math.min(32, Number.isFinite(value) ? value : 4));
  };

  PATCH.ensureMidiCapturePolicy = function ensureMidiCapturePolicy() {
    const capture = PATCH.midiCaptureState || (PATCH.midiCaptureState = {});
    const policy = capture.policy || (capture.policy = {});
    if (policy.mode !== 'release' && policy.mode !== 'stable') policy.mode = 'stable';
    if (!Number.isFinite(policy.holdMs)) policy.holdMs = 180;
    if (!Number.isFinite(policy.minVelocity)) policy.minVelocity = 1;
    if (typeof policy.ignoreInversions !== 'boolean') policy.ignoreInversions = true;
    policy.holdMs = Math.max(0, Math.min(1200, Number(policy.holdMs) || 0));
    policy.minVelocity = Math.max(1, Math.min(127, Math.round(Number(policy.minVelocity) || 1)));
    return policy;
  };

  PATCH.chordKey = function chordKey(chord) {
    if (!chord) return '';
    return [chord.root, chord.quality || '', Array.isArray(chord.iv) ? chord.iv.join(',') : ''].join(':');
  };

  PATCH.getHeldMidiBassNote = function getHeldMidiBassNote() {
    if (typeof MidiInputEngine === 'undefined' || !MidiInputEngine.STATE || !(MidiInputEngine.STATE.activeNotes instanceof Map)) return null;
    const notes = Array.from(MidiInputEngine.STATE.activeNotes.keys()).sort((a, b) => a - b);
    return notes.length ? notes[0] : null;
  };

  PATCH.getHeldMidiMaxVelocity = function getHeldMidiMaxVelocity() {
    if (typeof MidiInputEngine === 'undefined' || !MidiInputEngine.STATE || !(MidiInputEngine.STATE.activeNotes instanceof Map)) return 0;
    const velocities = Array.from(MidiInputEngine.STATE.activeNotes.values()).map(value => Number(value) || 0);
    return velocities.length ? Math.max(...velocities) : 0;
  };

  PATCH.chordCaptureKey = function chordCaptureKey(chord, options) {
    if (!chord) return '';
    const policy = PATCH.ensureMidiCapturePolicy();
    const opts = options || {};
    const base = PATCH.chordKey(chord);
    if (policy.ignoreInversions) return base;
    const bassNote = Number.isFinite(opts.bassNote) ? opts.bassNote : PATCH.getHeldMidiBassNote();
    const bassPc = bassNote == null ? 'x' : PATCH.mod(bassNote, 12);
    return base + ':bass:' + bassPc;
  };

  PATCH.cloneChord = function cloneChord(chord) {
    return chord ? PATCH.jsonClone(chord) : chord;
  };

  PATCH.clearPendingMidiCapture = function clearPendingMidiCapture() {
    const capture = PATCH.midiCaptureState || (PATCH.midiCaptureState = {
      enabled: false,
      lastCapturedKey: '',
      lastCapturedAt: 0,
      lastCaptureSource: '',
      pendingKey: '',
      pendingSince: 0,
      pendingChord: null,
      pendingTimer: null,
    });
    if (capture.pendingTimer) clearTimeout(capture.pendingTimer);
    PATCH.ensureMidiCapturePolicy();
    capture.pendingTimer = null;
    capture.pendingKey = '';
    capture.pendingSince = 0;
    capture.pendingChord = null;
  };

  PATCH.appendChordToProgression = function appendChordToProgression(chord, bars, sourceLabel) {
    if (!chord || typeof PROG_STATE === 'undefined' || !PROG_STATE) return false;
    const safeBars = Math.max(1, Math.min(32, Number.isFinite(bars) ? bars : 4));
    const capture = PATCH.midiCaptureState || (PATCH.midiCaptureState = {
      enabled: false,
      lastCapturedKey: '',
      lastCapturedAt: 0,
      lastCaptureSource: '',
      pendingKey: '',
      pendingSince: 0,
      pendingChord: null,
      pendingTimer: null,
    });
    const source = sourceLabel || 'CAPTURE';
    const lastEntry = PROG_STATE.prog[PROG_STATE.prog.length - 1];
    const canReplaceRecent =
      source === 'MIDI AUTO' &&
      lastEntry &&
      lastEntry.chord &&
      lastEntry.chord.root === chord.root &&
      Array.isArray(lastEntry.chord.iv) &&
      Array.isArray(chord.iv) &&
      chord.iv.length > lastEntry.chord.iv.length &&
      safeBars === lastEntry.bars &&
      Date.now() - (capture.lastCapturedAt || 0) < 400 &&
      capture.lastCaptureSource === 'MIDI AUTO';
    if (canReplaceRecent) {
      lastEntry.chord = PATCH.cloneChord(chord);
    } else {
      PROG_STATE.prog.push({ chord: PATCH.cloneChord(chord), bars: safeBars });
    }
    PROG_STATE.enabled = true;
    const tog = document.getElementById('togProgression');
    const controls = document.getElementById('progressionControls');
    if (tog) tog.classList.add('on');
    if (controls) controls.style.display = 'block';
    if (typeof window.refreshProgUI === 'function') window.refreshProgUI();
    capture.lastCapturedAt = Date.now();
    capture.lastCaptureSource = source;
    capture.lastCapturedKey = PATCH.chordCaptureKey(chord);
    PATCH.clearPendingMidiCapture();
    PATCH.pushMidiMonitorEvent(source + ' -> ' + chord.rootName + (chord.quality || '') + ' / ' + safeBars + ' bars');
    PATCH.syncMidiMonitorUI();
    return true;
  };

  PATCH.captureCurrentMidiChordToProgression = function captureCurrentMidiChordToProgression() {
    if (typeof S === 'undefined' || !S || !S.chord) return false;
    PATCH.clearPendingMidiCapture();
    return PATCH.appendChordToProgression(S.chord, PATCH.getProgressionCaptureBars(), 'MIDI CAPTURE');
  };

  PATCH.queueMidiChordCapture = function queueMidiChordCapture(chord, options) {
    const capture = PATCH.midiCaptureState || (PATCH.midiCaptureState = {
      enabled: false,
      lastCapturedKey: '',
      lastCapturedAt: 0,
      lastCaptureSource: '',
      pendingKey: '',
      pendingSince: 0,
      pendingChord: null,
      pendingTimer: null,
    });
    const opts = options || {};
    const policy = PATCH.ensureMidiCapturePolicy();
    if (!capture.enabled || !chord) return false;
    if (policy.mode === 'release' && opts.triggerType === 'noteon') return false;
    const minVelocity = policy.minVelocity;
    const triggerVelocity = Number.isFinite(opts.velocity) ? opts.velocity : PATCH.getHeldMidiMaxVelocity();
    if (triggerVelocity < minVelocity) return false;
    const key = PATCH.chordCaptureKey(chord, opts);
    if (!key || key === capture.lastCapturedKey) return false;
    if (capture.pendingKey === key && capture.pendingTimer) return false;

    PATCH.clearPendingMidiCapture();
    capture.pendingKey = key;
    capture.pendingSince = Date.now();
    capture.pendingChord = PATCH.cloneChord(chord);
    const delayMs = Math.max(0, Number(policy.holdMs) || 0);
    capture.pendingTimer = setTimeout(() => {
      capture.pendingTimer = null;
      const currentChord = PATCH.getHeldMidiChord();
      const currentKey = PATCH.chordCaptureKey(currentChord);
      if (!capture.enabled || !capture.pendingChord || !currentChord || currentKey !== capture.pendingKey) {
        PATCH.clearPendingMidiCapture();
        PATCH.syncMidiMonitorUI();
        return;
      }
      PATCH.appendChordToProgression(capture.pendingChord, PATCH.getProgressionCaptureBars(), 'MIDI AUTO');
    }, delayMs);
    PATCH.syncMidiMonitorUI();
    return true;
  };

  PATCH.maybeCaptureMidiChord = function maybeCaptureMidiChord(chord, options) {
    return PATCH.queueMidiChordCapture(chord, options);
  };

  PATCH.setMidiCaptureEnabled = function setMidiCaptureEnabled(enabled) {
    PATCH.ensureMidiCapturePolicy();
    PATCH.midiCaptureState.enabled = !!enabled;
    if (enabled) {
      PATCH.midiCaptureState.lastCapturedKey = (typeof S !== 'undefined' && S && S.chord) ? PATCH.chordCaptureKey(S.chord) : '';
    } else {
      PATCH.midiCaptureState.lastCapturedKey = '';
      PATCH.clearPendingMidiCapture();
    }
    PATCH.syncMidiMonitorUI();
  };

  PATCH.applyMidiLearnValue = function applyMidiLearnValue(targetId, cc, value) {
    const target = PATCH.getMidiLearnTarget(targetId);
    if (!target || typeof S === 'undefined' || !S) return false;
    let uiValue = PATCH.scaleMidiToStepRange(value, target.min, target.max, target.step || 1);
    if (target.id === 'concertA4') {
      if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return false;
      CompTuningEngine.STATE.a4Hz = uiValue;
      const slider = document.getElementById('ctA4Slider');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.refreshScalaProfile(false);
      PATCH.syncBinauralUI();
      PATCH.syncConcertPitchUI();
      PATCH.syncScalaUI();
    } else if (target.id === 'concertCents') {
      if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return false;
      CompTuningEngine.STATE.globalCents = uiValue;
      const slider = document.getElementById('ctGlobalCents');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.syncConcertPitchUI();
    } else if (target.id === 'concertRoot') {
      if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return false;
      uiValue = PATCH.scaleMidiToRange(value, 0, 11);
      CompTuningEngine.STATE.rootPc = uiValue;
      const slider = document.getElementById('ctRootPc');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.refreshScalaProfile(false);
      if (typeof CompTuningEngine.buildIntervalGrid === 'function') CompTuningEngine.buildIntervalGrid();
      if (typeof CompTuningEngine.updateDisplay === 'function') CompTuningEngine.updateDisplay();
      PATCH.syncScalaUI();
      PATCH.syncCompSectionUI();
    } else if (target.id === 'jiBlend') {
      if (typeof JI_PARAMS === 'undefined') return false;
      JI_PARAMS.blend = uiValue / 100;
      const slider = document.getElementById('jiBlend');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'jiMemory') {
      if (typeof JI_PARAMS === 'undefined') return false;
      JI_PARAMS.adaptiveMemoryStrength = uiValue / 100;
      const slider = document.getElementById('jiAdaptiveMemoryStrength');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'jiBassBias') {
      if (typeof JI_PARAMS === 'undefined') return false;
      JI_PARAMS.adaptiveBassAnchorStrength = uiValue / 100;
      const slider = document.getElementById('jiAdaptiveBassBias');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'jiVoiceLeading') {
      if (typeof JI_PARAMS === 'undefined') return false;
      JI_PARAMS.adaptiveVoiceLeadingStrength = uiValue / 100;
      const slider = document.getElementById('jiAdaptiveVoiceLeading');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'jiCadence') {
      if (typeof JI_PARAMS === 'undefined') return false;
      JI_PARAMS.adaptiveCadenceResetStrength = uiValue / 100;
      const slider = document.getElementById('jiAdaptiveCadenceStrength');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'scalaPreset') {
      PATCH.initScalaPresets();
      if (!PATCH.SCALA_PRESETS.length) return false;
      const presetIndex = PATCH.scaleMidiToRange(value, 0, PATCH.SCALA_PRESETS.length - 1);
      const preset = PATCH.SCALA_PRESETS[presetIndex];
      if (!preset || !PATCH.loadScalaPreset(preset.id)) return false;
      PATCH.syncScalaUI();
      PATCH.syncCompSectionUI();
      uiValue = preset.label;
    } else if (target.id === 'scalaFavorite') {
      const favorites = PATCH.readScalaFavorites();
      const availableSlots = PATCH.SCALA_FAVORITE_SLOTS.filter(slot => !!favorites[slot]);
      if (!availableSlots.length) return false;
      const slotIndex = PATCH.scaleMidiToRange(value, 0, availableSlots.length - 1);
      const slot = availableSlots[slotIndex];
      if (!PATCH.loadScalaFavorite(slot)) return false;
      PATCH.syncScalaUI();
      PATCH.syncCompSectionUI();
      uiValue = slot;
    } else if (target.id === 'jiSectionBlend') {
      const focused = PATCH.getFocusedSectionProfile('ji');
      if (!focused) return false;
      focused.profile.blend = uiValue / 100;
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'jiSectionBass') {
      const focused = PATCH.getFocusedSectionProfile('ji');
      if (!focused) return false;
      focused.profile.adaptiveBassAnchorStrength = uiValue / 100;
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'jiSectionVl') {
      const focused = PATCH.getFocusedSectionProfile('ji');
      if (!focused) return false;
      focused.profile.adaptiveVoiceLeadingStrength = uiValue / 100;
      PATCH.syncJustIntonationUI();
    } else if (target.id === 'compSectionA4') {
      const focused = PATCH.getFocusedSectionProfile('comp');
      if (!focused) return false;
      focused.profile.a4Hz = uiValue;
      PATCH.syncCompSectionUI();
    } else if (target.id === 'compSectionCents') {
      const focused = PATCH.getFocusedSectionProfile('comp');
      if (!focused) return false;
      focused.profile.globalCents = uiValue;
      PATCH.syncCompSectionUI();
    } else if (target.id === 'compSectionRoot') {
      const focused = PATCH.getFocusedSectionProfile('comp');
      if (!focused) return false;
      uiValue = PATCH.scaleMidiToRange(value, 0, 11);
      focused.profile.rootPc = uiValue;
      PATCH.syncCompSectionUI();
    } else if (target.id === 'compSectionScala') {
      const focused = PATCH.getFocusedSectionProfile('comp');
      if (!focused) return false;
      const options = PATCH.getCompSectionScalaOptions();
      if (!options.length) return false;
      const optionIndex = PATCH.scaleMidiToRange(value, 0, options.length - 1);
      const option = options[optionIndex];
      if (!option) return false;
      focused.profile.scalaSource = option.value;
      PATCH.syncCompSectionUI();
      uiValue = option.label;
    } else if (target.id === 'gateBase') {
      S.gateBase = uiValue / 100;
      const slider = document.getElementById('gateBase');
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      if (typeof updateGateIndicator === 'function') updateGateIndicator();
    } else {
      S[target.id] = uiValue;
      const slider = document.getElementById(target.id);
      if (slider) slider.value = uiValue;
      const valueEl = document.getElementById(target.valueId);
      if (valueEl) valueEl.textContent = target.format(uiValue);
      if (target.id === 'bpm' && typeof refreshBpmDisplay === 'function') refreshBpmDisplay();
      if (target.id === 'dissonance' && typeof updateGateIndicator === 'function') updateGateIndicator();
      if (target.id === 'tempoDrift' && typeof refreshBpmDisplay === 'function') refreshBpmDisplay();
      if (target.id === 'curveAmp' && typeof updateMacroPreview === 'function') updateMacroPreview();
      if (target.id === 'pbRange') {
        const mpeStatus = document.getElementById('mpeStatus');
        if (mpeStatus) mpeStatus.textContent = S.mpe ? 'MPE ON — pb:±' + S.pbRange + ' st' : 'MPE OFF';
      }
    }
    PATCH.pushMidiMonitorEvent('LEARN CC' + cc + ' -> ' + target.label + ' = ' + uiValue);
    return true;
  };

  PATCH.armMidiLearn = function armMidiLearn(targetId) {
    const state = PATCH.midiMonitorState || (PATCH.midiMonitorState = { armedTarget: '', events: [] });
    state.armedTarget = targetId || '';
    PATCH.syncMidiMonitorUI();
  };

  PATCH.clearMidiLearnMapping = function clearMidiLearnMapping(cc) {
    const mappings = PATCH.readMidiLearnMappings();
    delete mappings[String(cc)];
    PATCH.writeMidiLearnMappings(mappings);
    PATCH.pushMidiMonitorEvent('LEARN CLEAR CC' + cc);
    PATCH.syncMidiMonitorUI();
  };

  PATCH.handleMidiLearnCC = function handleMidiLearnCC(cc, value) {
    const state = PATCH.midiMonitorState || (PATCH.midiMonitorState = { armedTarget: '', events: [] });
    const mappings = PATCH.readMidiLearnMappings();
    if (state.armedTarget) {
      const target = PATCH.getMidiLearnTarget(state.armedTarget);
      if (target) {
        mappings[String(cc)] = target.id;
        PATCH.writeMidiLearnMappings(mappings);
        PATCH.applyMidiLearnValue(target.id, cc, value);
        PATCH.pushMidiMonitorEvent('LEARN BIND CC' + cc + ' -> ' + target.label);
      }
      state.armedTarget = '';
      PATCH.syncMidiMonitorUI();
      return true;
    }
    const mappedTargetId = mappings[String(cc)];
    if (!mappedTargetId) return false;
    const applied = PATCH.applyMidiLearnValue(mappedTargetId, cc, value);
    if (applied) PATCH.syncMidiMonitorUI();
    return applied;
  };

  PATCH.describeMidiMessage = function describeMidiMessage(data) {
    const bytes = Array.from(data || []);
    if (!bytes.length) return 'EMPTY';
    const status = bytes[0] || 0;
    const type = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    const d1 = bytes[1] || 0;
    const d2 = bytes[2] || 0;
    if (type === 0x90 && d2 > 0) return 'CH' + channel + ' NOTE ON ' + PATCH.NOTE_NAMES[d1 % 12] + (Math.floor(d1 / 12) - 1) + ' vel ' + d2;
    if (type === 0x80 || (type === 0x90 && d2 === 0)) return 'CH' + channel + ' NOTE OFF ' + PATCH.NOTE_NAMES[d1 % 12] + (Math.floor(d1 / 12) - 1);
    if (type === 0xB0) return 'CH' + channel + ' CC' + d1 + ' = ' + d2;
    if (type === 0xE0) return 'CH' + channel + ' PB';
    return 'CH' + channel + ' 0x' + status.toString(16).toUpperCase();
  };

  PATCH.syncMidiMonitorUI = function syncMidiMonitorUI() {
    const state = PATCH.midiMonitorState || (PATCH.midiMonitorState = { armedTarget: '', events: [] });
    const capture = PATCH.midiCaptureState || (PATCH.midiCaptureState = {
      enabled: false,
      lastCapturedKey: '',
      lastCapturedAt: 0,
      lastCaptureSource: '',
      pendingKey: '',
      pendingSince: 0,
      pendingChord: null,
      pendingTimer: null,
    });
    const mappings = PATCH.readMidiLearnMappings();
    const learnStatus = document.getElementById('midiLearnStatus');
    const learnTarget = document.getElementById('midiLearnTarget');
    const learnMap = document.getElementById('midiLearnMap');
    const log = document.getElementById('midiMonitorLog');
    const captureStatus = document.getElementById('midiCaptureStatus');
    const captureToggle = document.getElementById('midiCaptureTog');
    const captureMode = document.getElementById('midiCaptureMode');
    const captureHold = document.getElementById('midiCaptureHoldMs');
    const captureHoldValue = document.getElementById('midiCaptureHoldMsV');
    const captureMinVel = document.getElementById('midiCaptureMinVel');
    const captureMinVelValue = document.getElementById('midiCaptureMinVelV');
    const captureIgnoreInv = document.getElementById('midiCaptureIgnoreInv');
    const policy = PATCH.ensureMidiCapturePolicy();
    const liveFocus = PATCH.describeLiveSectionFocus();
    if (learnTarget && !learnTarget.options.length) {
      learnTarget.innerHTML = PATCH.MIDI_LEARN_TARGETS.map(target =>
        '<option value="' + target.id + '">' + target.label + '</option>'
      ).join('');
    }
    if (learnTarget && state.armedTarget) learnTarget.value = state.armedTarget;
    if (learnStatus) {
      const armedTarget = PATCH.getMidiLearnTarget(state.armedTarget);
      let armedText = 'LEARN IDLE';
      if (armedTarget) {
        armedText = 'LEARN ARMED — move a CC for ' + armedTarget.label;
        if (PATCH.isSectionLearnTarget(armedTarget.id)) {
          const kind = armedTarget.id.startsWith('ji') ? 'ji' : 'comp';
          const focus = kind === 'ji' ? liveFocus.ji : liveFocus.comp;
          armedText += ' @ ' + focus.name + (focus.follow ? ' / FOLLOW BAR ' + (liveFocus.previewBar + 1) : '');
        }
      }
      learnStatus.textContent = armedText;
      learnStatus.style.color = armedTarget ? 'var(--amber)' : 'var(--text-dim)';
    }
    if (learnMap) {
      const entries = Object.entries(mappings)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([cc, targetId]) => {
          const target = PATCH.getMidiLearnTarget(targetId);
          return 'CC' + cc + ' → ' + (target ? target.label : targetId);
        });
      learnMap.textContent =
        'FOCUS: JI=' + liveFocus.ji.name + (liveFocus.ji.follow ? '@BAR' + (liveFocus.previewBar + 1) : '') +
        ' / COMP=' + liveFocus.comp.name + (liveFocus.comp.follow ? '@BAR' + (liveFocus.previewBar + 1) : '') +
        (entries.length ? '  |  MAP: ' + entries.join('  |  ') : '  |  MAP: —');
    }
    if (log) log.textContent = state.events.length ? state.events.join('\n') : 'MONITOR: waiting for MIDI input';
    if (captureToggle) captureToggle.classList.toggle('on', !!capture.enabled);
    if (captureMode) captureMode.value = policy.mode;
    if (captureHold) captureHold.value = policy.holdMs;
    if (captureHoldValue) captureHoldValue.textContent = policy.holdMs + ' ms';
    if (captureMinVel) captureMinVel.value = policy.minVelocity;
    if (captureMinVelValue) captureMinVelValue.textContent = String(policy.minVelocity);
    if (captureIgnoreInv) captureIgnoreInv.classList.toggle('on', !!policy.ignoreInversions);
    if (captureStatus) {
      const bars = PATCH.getProgressionCaptureBars();
      if (!capture.enabled) {
        captureStatus.textContent = 'CAPTURE IDLE';
      } else if (capture.pendingKey && capture.pendingSince) {
        const pendingChord = capture.pendingChord ? capture.pendingChord.rootName + (capture.pendingChord.quality || '') : capture.pendingKey;
        captureStatus.textContent = 'CAPTURE PENDING — ' + pendingChord + ' / ' + bars + ' bars / ' + policy.mode.toUpperCase();
      } else {
        captureStatus.textContent = 'CAPTURE ARMED — ' + policy.mode.toUpperCase() + ' / ' + bars + ' bars / ' + policy.holdMs + 'ms / vel≥' + policy.minVelocity;
      }
      captureStatus.style.color = capture.enabled ? 'var(--teal)' : 'var(--text-dim)';
    }
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.floorDiv = function floorDiv(value, divisor) {
    return Math.floor(value / divisor);
  };

  PATCH.mod = function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  };

  PATCH.cloneMidiBytes = function cloneMidiBytes(value) {
    if (!value) return null;
    if (value instanceof Uint8Array) return new Uint8Array(value);
    return new Uint8Array(Array.from(value));
  };

  PATCH.cloneLayerTracks = function cloneLayerTracks(layerTracks) {
    if (!Array.isArray(layerTracks)) return null;
    return layerTracks.map(layerTrack => ({
      name: layerTrack.name,
      data: Array.isArray(layerTrack.data) ? layerTrack.data.slice() : [],
    }));
  };

  PATCH.getActiveProgressionTotalBars = function getActiveProgressionTotalBars() {
    if (typeof PROG_STATE !== 'undefined' &&
        PROG_STATE &&
        PROG_STATE.enabled &&
        Array.isArray(PROG_STATE.prog) &&
        PROG_STATE.prog.length) {
      return PROG_STATE.prog.reduce((sum, entry) => sum + (entry && entry.bars ? entry.bars : 0), 0);
    }
    return (typeof S !== 'undefined' && S && Number.isFinite(S.bars)) ? S.bars : 0;
  };

  PATCH.getTotalBarsForUI = function getTotalBarsForUI() {
    return Math.max(1, PATCH.getActiveProgressionTotalBars() || 0);
  };

  PATCH.getAutoCARule = function getAutoCARule() {
    if (typeof CA_PARAMS === 'undefined' || !CA_PARAMS) return 30;
    if (CA_PARAMS.override) return CA_PARAMS.rule;
    const genre = (typeof S !== 'undefined' && S && S.genre) ? S.genre : 'ambient';
    return ({
      ambient: 30,
      drone: 90,
      dark_ambient: 110,
      psychedelic: 54,
      space: 18,
      ritual: 150,
      kosmische: 73,
      noise: 126,
    })[genre] || 30;
  };

  PATCH.normalizeNRTriad = function normalizeNRTriad(chord) {
    if (!chord) return chord;
    const quality = String(chord.quality || '');
    const isMinor = quality.startsWith('m') && !quality.startsWith('maj');
    const keepAsIs = /dim|aug|sus|quartal|quintal|cluster|tone|ø/i.test(quality);
    const isMajor = !isMinor && !keepAsIs;
    if (!isMinor && !isMajor) return { ...chord };
    return {
      root: chord.root,
      quality: isMinor ? 'm' : '',
      rootName: chord.rootName || PATCH.NOTE_NAMES[((chord.root % 12) + 12) % 12],
      iv: isMinor ? [0, 3, 7] : [0, 4, 7],
      name: isMinor ? 'Minor' : 'Major',
    };
  };

  PATCH.applyRecognizedMidiChord = function applyRecognizedMidiChord(chord) {
    if (!chord || typeof S === 'undefined' || !S) return;
    S.chord = chord;
    const chordText = chord.rootName + (chord.quality || '');
    const input = document.getElementById('chordInput');
    const status = document.getElementById('chordStatus');
    if (input) input.value = chordText;
    if (status) {
      status.textContent = '✓ MIDI IN ' + chordText + ' — ' + chord.name;
      status.className = 'chord-status ok';
    }
    if (typeof updateTheory === 'function') updateTheory();
    if (typeof buildScaleUI === 'function') buildScaleUI();
    if (typeof log === 'function') log('// MIDI IN CHORD: ' + chordText + ' — ' + chord.name, 'ok');
  };

  PATCH.getHeldMidiChord = function getHeldMidiChord() {
    if (typeof MidiInputEngine === 'undefined' ||
        !MidiInputEngine.STATE ||
        typeof MidiInputEngine.chordFromPitchClasses !== 'function') {
      return null;
    }
    const activeNotes = Array.from(MidiInputEngine.STATE.activeNotes.keys());
    return MidiInputEngine.chordFromPitchClasses(activeNotes.map(note => note % 12));
  };

  PATCH.syncMidiChordFromHeldNotes = function syncMidiChordFromHeldNotes() {
    if (typeof MidiInputEngine === 'undefined' || !MidiInputEngine.STATE) return;
    const state = MidiInputEngine.STATE;
    const activeNotes = Array.from(state.activeNotes.keys());
    const chord = PATCH.getHeldMidiChord();
    if (chord) {
      state.lastChordKey = '';
      PATCH.applyRecognizedMidiChord(chord);
      return chord;
    }
    if (!activeNotes.length) {
      state.lastChordKey = '';
      PATCH.clearPendingMidiCapture();
    }
    return null;
  };

  PATCH.clearGeneratedArtifacts = function clearGeneratedArtifacts() {
    if (typeof S === 'undefined' || !S) return;
    S.midiData = null;
    S.layerTracks = null;
    S.conductorRaw = null;
    S.midiDataA = null;
    S.midiDataB = null;
    S.abMode = 'A';
    S.compSectionPreTuned = false;
    PATCH.abVariants.A = null;
    PATCH.abVariants.B = null;
    if (S.oscExport) S.oscExport.lastStatus = 'GENERATEしてから送信してください';
  };

  PATCH.captureABVariant = function captureABVariant(slot) {
    if ((slot !== 'A' && slot !== 'B') || typeof S === 'undefined' || !S) return;
    PATCH.abVariants[slot] = {
      midiData: PATCH.cloneMidiBytes(S.midiData),
      layerTracks: PATCH.cloneLayerTracks(S.layerTracks),
      conductorRaw: Array.isArray(S.conductorRaw) ? S.conductorRaw.slice() : null,
    };
  };

  PATCH.restoreABVariant = function restoreABVariant(slot) {
    if ((slot !== 'A' && slot !== 'B') || typeof S === 'undefined' || !S) return false;
    const variant = PATCH.abVariants[slot];
    if (!variant || !variant.midiData) return false;
    S.abMode = slot;
    S.midiData = PATCH.cloneMidiBytes(variant.midiData);
    S.layerTracks = PATCH.cloneLayerTracks(variant.layerTracks);
    S.conductorRaw = Array.isArray(variant.conductorRaw) ? variant.conductorRaw.slice() : null;
    if (typeof MidiPreview !== 'undefined' && typeof MidiPreview.load === 'function' && S.midiData) {
      MidiPreview.load(S.midiData, S.bpm);
    }
    PATCH.syncGeneratedOutputUI();
    return true;
  };

  PATCH.syncABUI = function syncABUI() {
    if (typeof S === 'undefined' || !S) return;
    const panel = document.getElementById('abPanel');
    const buttonA = document.getElementById('abBtnA');
    const buttonB = document.getElementById('abBtnB');
    const hasA = !!S.midiDataA;
    const hasB = !!S.midiDataB;
    const hasEither = hasA || hasB;
    if (!hasEither && S.abMode !== 'A') S.abMode = 'A';
    if (panel) panel.style.display = hasEither ? '' : 'none';
    if (buttonA) {
      buttonA.classList.toggle('on', S.abMode === 'A');
      buttonA.disabled = !hasA;
    }
    if (buttonB) {
      buttonB.classList.toggle('on', S.abMode === 'B');
      buttonB.disabled = !hasB;
    }
  };

  PATCH.syncMultiExportUI = function syncMultiExportUI() {
    if (typeof S === 'undefined' || !S || !S.multiExport) return;
    const prefix = document.getElementById('mePfx');
    const numberPad = document.getElementById('meNumPad');
    const numberPadValue = document.getElementById('meNumPadV');
    const conductor = document.getElementById('meCond');
    const conductorValue = document.getElementById('meCondV');
    const manifest = document.getElementById('meManifest');
    const manifestValue = document.getElementById('meManifestV');
    const manifestBtn = document.getElementById('btnManifestDl');
    const count = document.getElementById('meCount');
    const status = document.getElementById('meStatus');
    const grid = document.getElementById('meLayerGrid');
    const download = document.getElementById('btnMultiDl');

    if (prefix) prefix.value = S.multiExport.prefix || 'void';
    if (numberPad) numberPad.classList.toggle('on', !!S.multiExport.numberPad);
    if (numberPadValue) numberPadValue.textContent = S.multiExport.numberPad ? 'ON' : 'OFF';
    if (conductor) conductor.classList.toggle('on', !!S.multiExport.includeConductor);
    if (conductorValue) conductorValue.textContent = S.multiExport.includeConductor ? 'ON' : 'OFF';
    if (manifest) manifest.classList.toggle('on', !!S.multiExport.includeManifest);
    if (manifestValue) manifestValue.textContent = S.multiExport.includeManifest ? 'ON' : 'OFF';

    if (Array.isArray(S.layerTracks) && S.layerTracks.length) {
      if (typeof buildMultiExportUI === 'function') buildMultiExportUI();
      if (download) download.classList.add('show');
      if (manifestBtn) manifestBtn.classList.add('show');
      return;
    }

    if (grid) grid.innerHTML = '';
    if (count) count.textContent = '';
    if (status) status.textContent = 'GENERATEしてからエクスポートしてください';
    if (download) download.classList.remove('show');
    if (manifestBtn) manifestBtn.classList.remove('show');
  };

  PATCH.syncOscExportUI = function syncOscExportUI() {
    if (typeof S === 'undefined' || !S || !S.oscExport) return;
    if (!('testStatus' in S.oscExport)) S.oscExport.testStatus = 'OSC TEST 未実行';
    S.oscExport.lastPayloadSummary = PATCH.describeOscPayload();
    if (!('lastTestOk' in S.oscExport)) S.oscExport.lastTestOk = null;
    const input = document.getElementById('oscWsUrl');
    const status = document.getElementById('oscSendStatus');
    const testStatus = document.getElementById('oscTestStatus');
    const payloadPreview = document.getElementById('oscPayloadPreview');
    const musicXmlStatus = document.getElementById('musicXmlStatus');
    if (input) input.value = S.oscExport.url || 'ws://127.0.0.1:7000';
    if (status) status.textContent = S.oscExport.lastStatus || 'GENERATEしてから送信してください';
    if (testStatus) {
      testStatus.textContent = S.oscExport.testStatus || 'OSC TEST 未実行';
      testStatus.style.color = S.oscExport.lastTestOk === true
        ? 'var(--teal)'
        : S.oscExport.lastTestOk === false
          ? 'var(--amber)'
          : 'var(--text-dim)';
    }
    if (payloadPreview) payloadPreview.textContent = S.oscExport.lastPayloadSummary || 'PAYLOAD PREVIEW: unavailable';
    if (musicXmlStatus && !S.midiData) {
      musicXmlStatus.textContent = 'GENERATEしてからエクスポートしてください';
    }
    if (typeof OscExportEngine !== 'undefined' && typeof OscExportEngine.initUI === 'function') {
      const binaryBtn = document.getElementById('oscModeBinary');
      const jsonBtn = document.getElementById('oscModeJson');
      if (binaryBtn) {
        binaryBtn.style.borderColor = S.oscExport.mode === 'binary' ? 'var(--teal)' : 'var(--border)';
        binaryBtn.style.color = S.oscExport.mode === 'binary' ? 'var(--teal)' : 'var(--text-dim)';
      }
      if (jsonBtn) {
        jsonBtn.style.borderColor = S.oscExport.mode === 'json' ? 'var(--teal)' : 'var(--border)';
        jsonBtn.style.color = S.oscExport.mode === 'json' ? 'var(--teal)' : 'var(--text-dim)';
      }
    }
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.describeOscPayload = function describeOscPayload() {
    if (typeof S === 'undefined' || !S || typeof OscExportEngine === 'undefined' || typeof OscExportEngine.buildPayload !== 'function') {
      return 'PAYLOAD PREVIEW: unavailable';
    }
    const payload = OscExportEngine.buildPayload();
    if (!payload) return 'PAYLOAD PREVIEW: GENERATE required';
    const layers = Array.isArray(payload.layers) ? payload.layers.length : 0;
    const noteCount = (payload.layers || []).reduce((sum, layer) => sum + (layer.noteCount || 0), 0);
    const conductor = payload.conductorBytes && payload.conductorBytes.length ? 'CONDUCTOR ON' : 'CONDUCTOR OFF';
    const mode = S.oscExport && S.oscExport.mode ? S.oscExport.mode.toUpperCase() : 'BINARY';
    const liveFocus = PATCH.describeLiveSectionFocus();
    return 'PAYLOAD PREVIEW: ' + layers + ' layers / ' + noteCount + ' notes / ' + conductor + ' / ' + mode +
      ' / BAR ' + (liveFocus.previewBar + 1) +
      ' / JI ' + liveFocus.ji.name +
      ' / COMP ' + liveFocus.comp.name;
  };

  if (typeof OscExportEngine !== 'undefined' &&
      typeof OscExportEngine.buildPayload === 'function' &&
      !OscExportEngine.__meikyLiveControlWrapped) {
    const originalOscBuildPayload = OscExportEngine.buildPayload.bind(OscExportEngine);
    OscExportEngine.buildPayload = function buildPayloadWithLiveControl() {
      const payload = originalOscBuildPayload();
      if (!payload) return payload;
      const liveFocus = PATCH.describeLiveSectionFocus();
      const midiLearnMappings = PATCH.readMidiLearnMappings();
      const scalaName =
        typeof CompTuningEngine !== 'undefined' &&
        CompTuningEngine.STATE &&
        CompTuningEngine.STATE.scalaProfile &&
        CompTuningEngine.STATE.scalaProfile.sclName
          ? CompTuningEngine.STATE.scalaProfile.sclName
          : 'None';
      const jiMode = typeof JI_PARAMS !== 'undefined' && JI_PARAMS && JI_PARAMS.mode ? JI_PARAMS.mode : 'off';
      const jiBlend = typeof JI_PARAMS !== 'undefined' && JI_PARAMS ? Number(JI_PARAMS.blend || 0) : 0;
      const concertA4 = PATCH.getConcertA4Hz();
      const globalCents =
        typeof CompTuningEngine !== 'undefined' &&
        CompTuningEngine.STATE &&
        Number.isFinite(CompTuningEngine.STATE.globalCents)
          ? CompTuningEngine.STATE.globalCents
          : 0;
      const progressionSummary =
        typeof PROG_STATE !== 'undefined' &&
        PROG_STATE &&
        Array.isArray(PROG_STATE.prog) &&
        PROG_STATE.prog.length
          ? PROG_STATE.prog
              .map(entry => {
                const chord = entry && entry.chord ? entry.chord.rootName + (entry.chord.quality || '') : 'N.C.';
                const bars = entry && entry.bars ? entry.bars : 0;
                return chord + ':' + bars;
              })
              .join(' -> ')
          : ((typeof S !== 'undefined' && S && S.chord)
              ? (S.chord.rootName + (S.chord.quality || ''))
              : 'N.C.');
      const activeEngines =
        typeof S !== 'undefined' &&
        S &&
        S.engines
          ? Object.entries(S.engines).filter(([, on]) => !!on).map(([name]) => name)
          : [];
      const activeLayerKeys =
        typeof S !== 'undefined' &&
        S &&
        S.layers
          ? Object.entries(S.layers).filter(([, on]) => !!on).map(([key]) => key)
          : [];
      const activeLayerDefs =
        typeof LAYER_DEFS !== 'undefined' && Array.isArray(LAYER_DEFS)
          ? activeLayerKeys.map(key => {
              const layerDef = LAYER_DEFS.find(def => def && def.k === key);
              return {
                key,
                name: layerDef && layerDef.name ? layerDef.name : key,
                desc: layerDef && layerDef.desc ? layerDef.desc : '',
              };
            })
          : activeLayerKeys.map(key => ({ key, name: key, desc: '' }));
      const layerNames =
        typeof S !== 'undefined' &&
        S &&
        Array.isArray(S.layerTracks)
          ? S.layerTracks.map(track => track && track.name ? track.name : 'Track')
          : [];
      const enabledLayerNames =
        typeof S !== 'undefined' &&
        S &&
        S.multiExport &&
        Array.isArray(S.layerTracks)
          ? S.layerTracks
              .filter(track => track && track.name && S.multiExport.layers[track.name] !== false)
              .map(track => track.name)
          : layerNames.slice();
      const seed = typeof S !== 'undefined' && S ? Number(S.seed || 0) : 0;
      const genre = typeof S !== 'undefined' && S && S.genre ? S.genre : 'unknown';
      const scale = typeof S !== 'undefined' && S && S.scale ? S.scale : 'unknown';
      const currentChordSummary =
        typeof S !== 'undefined' && S && S.chord
          ? (S.chord.rootName + (S.chord.quality || ''))
          : 'N.C.';
      const abState = {
        currentMode: typeof S !== 'undefined' && S ? (S.abMode || 'A') : 'A',
        hasA: !!(typeof S !== 'undefined' && S && S.midiDataA),
        hasB: !!(typeof S !== 'undefined' && S && S.midiDataB),
      };
      const exportState = {
        hasMidi: !!(typeof S !== 'undefined' && S && S.midiData),
        layerCount: layerNames.length,
        layerNames,
        enabledLayerNames,
        prefix: typeof S !== 'undefined' && S && S.multiExport ? (S.multiExport.prefix || 'void') : 'void',
        includeConductor: !!(typeof S !== 'undefined' && S && S.multiExport && S.multiExport.includeConductor),
        includeManifest: !!(typeof S !== 'undefined' && S && S.multiExport && S.multiExport.includeManifest),
      };
      const exportTarget = {
        kind: 'osc',
        mode: typeof S !== 'undefined' && S && S.oscExport ? (S.oscExport.mode || 'binary') : 'binary',
        url: typeof S !== 'undefined' && S && S.oscExport ? (S.oscExport.url || '') : '',
        ready: exportState.hasMidi,
      };
      const layerContexts = Array.isArray(payload.layers)
        ? payload.layers.map((layer, index) => ({
            index: layer && Number.isFinite(layer.index) ? layer.index : index,
            name: layer && layer.name ? layer.name : ('Layer ' + (index + 1)),
            genre,
            scale,
            chord: currentChordSummary,
            progression: progressionSummary,
          }))
        : [];
      if (Array.isArray(payload.layers)) {
        payload.layers = payload.layers.map((layer, index) => Object.assign({}, layer, {
          context: layerContexts[index] || null,
        }));
      }
      payload.liveControl = {
        previewBar: liveFocus.previewBar,
        sectionLearnFocus: PATCH.jsonClone(PATCH.sectionLearnFocus),
        sectionPreviewFollow: PATCH.jsonClone(PATCH.ensureSectionPreviewFollow()),
        activeJiSection: liveFocus.ji,
        activeCompSection: liveFocus.comp,
        midiLearnMappings,
        activeLayerKeys,
        activeLayerDefs,
        abState,
        progressionSummary,
        currentChordSummary,
        layerContexts,
        exportState,
        exportTarget,
        project: {
          seed,
          genre,
          scale,
          activeEngines,
        },
        tuning: {
          concertA4Hz: concertA4,
          globalCents,
          scala: scalaName,
          jiMode,
          jiBlend,
        },
      };
      payload.meta = payload.meta || {};
      payload.meta.liveControl = PATCH.jsonClone(payload.liveControl);
      const extraMessages = [
        { address: '/meiky/meta/preview_bar', args: [liveFocus.previewBar] },
        { address: '/meiky/meta/ji_section', args: [liveFocus.ji.index, liveFocus.ji.name, liveFocus.ji.follow ? 1 : 0] },
        { address: '/meiky/meta/comp_section', args: [liveFocus.comp.index, liveFocus.comp.name, liveFocus.comp.follow ? 1 : 0] },
        { address: '/meiky/meta/section_follow', args: [liveFocus.ji.follow ? 1 : 0, liveFocus.comp.follow ? 1 : 0] },
        { address: '/meiky/meta/midi_learn_count', args: [Object.keys(midiLearnMappings).length] },
        { address: '/meiky/meta/concert_a4', args: [concertA4] },
        { address: '/meiky/meta/global_cents', args: [globalCents] },
        { address: '/meiky/meta/scala_name', args: [scalaName] },
        { address: '/meiky/meta/ji_profile', args: [jiMode, jiBlend] },
        { address: '/meiky/meta/ab_state', args: [abState.currentMode, abState.hasA ? 1 : 0, abState.hasB ? 1 : 0] },
        { address: '/meiky/meta/progression_summary', args: [progressionSummary] },
        { address: '/meiky/meta/project_seed', args: [seed] },
        { address: '/meiky/meta/project_genre', args: [genre] },
        { address: '/meiky/meta/project_scale', args: [scale] },
        { address: '/meiky/meta/active_engines', args: [activeEngines.join(',')] },
        { address: '/meiky/meta/active_layer_keys', args: [activeLayerKeys.join(',')] },
        { address: '/meiky/meta/active_layer_defs', args: [activeLayerDefs.map(def => def.key + ':' + def.name).join('|')] },
        { address: '/meiky/meta/layer_count', args: [exportState.layerCount] },
        { address: '/meiky/meta/layer_names', args: [layerNames.join(',')] },
        { address: '/meiky/meta/enabled_layers', args: [enabledLayerNames.join(',')] },
        { address: '/meiky/meta/export_flags', args: [exportState.prefix, exportState.includeConductor ? 1 : 0, exportState.includeManifest ? 1 : 0, exportState.hasMidi ? 1 : 0] },
        { address: '/meiky/meta/export_target', args: [exportTarget.kind, exportTarget.mode, exportTarget.url, exportTarget.ready ? 1 : 0] },
      ].concat(layerContexts.map(layerContext => ({
        address: '/meiky/meta/layer_context',
        args: [layerContext.index, layerContext.name, layerContext.genre, layerContext.scale, layerContext.chord, layerContext.progression],
      })));
      const existing = Array.isArray(payload.messages) ? payload.messages : [];
      payload.messages = existing.filter(message =>
        ![
          '/meiky/meta/preview_bar',
          '/meiky/meta/ji_section',
          '/meiky/meta/comp_section',
          '/meiky/meta/section_follow',
          '/meiky/meta/midi_learn_count',
          '/meiky/meta/concert_a4',
          '/meiky/meta/global_cents',
          '/meiky/meta/scala_name',
          '/meiky/meta/ji_profile',
          '/meiky/meta/ab_state',
          '/meiky/meta/progression_summary',
          '/meiky/meta/project_seed',
          '/meiky/meta/project_genre',
          '/meiky/meta/project_scale',
          '/meiky/meta/active_engines',
          '/meiky/meta/active_layer_keys',
          '/meiky/meta/active_layer_defs',
          '/meiky/meta/layer_count',
          '/meiky/meta/layer_names',
          '/meiky/meta/enabled_layers',
          '/meiky/meta/export_flags',
          '/meiky/meta/export_target',
          '/meiky/meta/layer_context',
        ].includes(message && message.address)
      ).concat(extraMessages);
      return payload;
    };
    OscExportEngine.__meikyLiveControlWrapped = true;
  }

  PATCH.sendOscCurrentWithLiveControl = function sendOscCurrentWithLiveControl() {
    if (typeof OscExportEngine === 'undefined' || typeof OscExportEngine.buildPayload !== 'function') return false;
    const input = document.getElementById('oscWsUrl');
    const url = input ? String(input.value || '').trim() : '';
    if (!/^wss?:\/\//i.test(url)) {
      if (typeof S !== 'undefined' && S && S.oscExport) {
        S.oscExport.lastStatus = 'OSC URL は ws:// または wss:// で始めてください';
      }
      PATCH.syncOscExportUI();
      if (typeof log === 'function') log('⚠ OSC URL INVALID', 'warn');
      return false;
    }
    if (typeof S !== 'undefined' && S && S.oscExport) S.oscExport.url = url;

    const payload = OscExportEngine.buildPayload();
    if (!payload) {
      if (typeof S !== 'undefined' && S && S.oscExport) {
        S.oscExport.lastStatus = '先に GENERATE を実行してください';
      }
      PATCH.syncOscExportUI();
      if (typeof log === 'function') log('⚠ GENERATE FIRST FOR OSC EXPORT', 'warn');
      return false;
    }

    const mode = typeof S !== 'undefined' && S && S.oscExport && S.oscExport.mode ? S.oscExport.mode : 'binary';
    if (typeof S !== 'undefined' && S && S.oscExport) {
      S.oscExport.lastStatus = 'OSC bridge 接続中...';
    }
    PATCH.syncOscExportUI();

    const socket = new WebSocket(url);
    if (mode === 'binary') socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      if (mode === 'binary') {
        const bundle = OscExportEngine.encodeOscBundle(payload);
        socket.send(bundle.buffer);
      } else {
        socket.send(JSON.stringify(payload));
      }
      socket.close();
      const layerSummary = (payload.layers || []).map(layer => layer.name + ':' + layer.noteCount).join(' / ');
      if (typeof S !== 'undefined' && S && S.oscExport) {
        S.oscExport.lastStatus = 'OSC 送信完了 — ' + (payload.layers || []).length + ' layers (' + mode.toUpperCase() + ')';
      }
      PATCH.syncOscExportUI();
      if (typeof log === 'function') log('// OSC EXPORT[' + mode.toUpperCase() + ']: ' + (payload.layers || []).length + ' layers — ' + layerSummary, 'ok');
    }, { once: true });
    socket.addEventListener('error', () => {
      if (typeof S !== 'undefined' && S && S.oscExport) {
        S.oscExport.lastStatus = 'OSC bridge 接続失敗 — URL とブリッジ起動状態を確認';
      }
      PATCH.syncOscExportUI();
      if (typeof log === 'function') log('⚠ OSC EXPORT FAILED', 'warn');
    }, { once: true });
    return true;
  };

  PATCH.installOscSendOverride = function installOscSendOverride() {
    const button = document.getElementById('btnOscSend');
    if (!button || button.dataset.patchOscBound === '1') return;
    const clone = button.cloneNode(true);
    clone.dataset.patchOscBound = '1';
    button.parentNode.replaceChild(clone, button);
    clone.addEventListener('click', event => {
      event.preventDefault();
      PATCH.sendOscCurrentWithLiveControl();
    });
  };

  if (typeof OscExportEngine !== 'undefined' &&
      typeof OscExportEngine.sendCurrent === 'function' &&
      !OscExportEngine.__meikySendCurrentWrapped) {
    OscExportEngine.sendCurrent = function sendCurrentPatched() {
      return PATCH.sendOscCurrentWithLiveControl();
    };
    OscExportEngine.__meikySendCurrentWrapped = true;
  }

  PATCH.encodeOscDiagnosticPacket = function encodeOscDiagnosticPacket() {
    if (typeof OscExportEngine !== 'undefined' && typeof OscExportEngine.encodeOscMessage === 'function') {
      return OscExportEngine.encodeOscMessage('/meiky/test', [Date.now(), 'ping']);
    }
    return new TextEncoder().encode('meiky-osc-test');
  };

  PATCH.testOscConnection = function testOscConnection(timeoutMs = 1500) {
    if (typeof S === 'undefined' || !S || !S.oscExport) return Promise.resolve(false);
    const url = String(S.oscExport.url || '').trim();
    S.oscExport.lastPayloadSummary = PATCH.describeOscPayload();
    if (!/^wss?:\/\//i.test(url)) {
      S.oscExport.lastTestOk = false;
      S.oscExport.testStatus = 'OSC TEST FAILED — URL must start with ws:// or wss://';
      PATCH.syncOscExportUI();
      return Promise.resolve(false);
    }

    S.oscExport.lastTestOk = null;
    S.oscExport.testStatus = 'OSC TEST: connecting...';
    PATCH.syncOscExportUI();

    return new Promise(resolve => {
      let settled = false;
      let timer = null;
      const finish = (ok, text) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        S.oscExport.lastTestOk = ok;
        S.oscExport.testStatus = text;
        PATCH.syncOscExportUI();
        resolve(ok);
      };

      try {
        const socket = new WebSocket(url);
        if ((S.oscExport.mode || 'binary') === 'binary') socket.binaryType = 'arraybuffer';
        timer = setTimeout(() => {
          try { socket.close(); } catch (_) {}
          finish(false, 'OSC TEST FAILED — timeout');
        }, timeoutMs);
        socket.addEventListener('open', () => {
          try {
            if ((S.oscExport.mode || 'binary') === 'binary') {
              const packet = PATCH.encodeOscDiagnosticPacket();
              socket.send(packet.buffer ? packet.buffer : packet);
            } else {
              socket.send(JSON.stringify({
                format: 'meiky-osc-test-v1',
                type: 'ping',
                sentAt: new Date().toISOString(),
                payloadPreview: S.oscExport.lastPayloadSummary,
              }));
            }
          } catch (_) {}
          try { socket.close(); } catch (_) {}
          finish(true, 'OSC TEST OK — bridge reachable');
        }, { once: true });
        socket.addEventListener('error', () => finish(false, 'OSC TEST FAILED — bridge unreachable'), { once: true });
      } catch (_) {
        finish(false, 'OSC TEST FAILED — socket error');
      }
    });
  };

  PATCH.syncGeneratedOutputUI = function syncGeneratedOutputUI() {
    if (typeof S === 'undefined' || !S) return;
    const download = document.getElementById('btnDl');
    const preview = document.getElementById('midiPreviewPanel');
    if (download) download.classList.toggle('show', !!S.midiData);
    if (preview) preview.style.display = S.midiData ? '' : 'none';
    PATCH.syncABUI();
    PATCH.syncMultiExportUI();
    PATCH.syncOscExportUI();
    PATCH.syncConcertPitchUI();
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.syncBinauralUI = function syncBinauralUI() {
    if (typeof BinauralEngine === 'undefined' || !BinauralEngine.STATE) return;
    const el = document.getElementById('bbCarrierNote');
    if (!el) return;
    const baseHz = PATCH.midiToHz(BinauralEngine.STATE.carrierNote);
    const rightHz = baseHz + BinauralEngine.STATE.activeBeat;
    const noteName = note => PATCH.NOTE_NAMES[note % 12] + Math.floor(note / 12 - 1);
    el.innerHTML =
      '<span style="color:#cccccc;">L: ' + noteName(BinauralEngine.STATE.carrierNote) + '</span>' +
      '<span style="color:#888;margin:0 6px;">|</span>' +
      '<span style="color:#aaaaaa;">' + baseHz.toFixed(1) + ' Hz</span>' +
      '<span style="color:#555;margin:0 8px;">→</span>' +
      '<span style="color:#cccccc;">R: ' + BinauralEngine.STATE.carrierNote + '+Δ</span>' +
      '<span style="color:#888;margin:0 6px;">|</span>' +
      '<span style="color:#aaaaaa;">' + rightHz.toFixed(2) + ' Hz</span>' +
      '<span style="color:#555;margin:0 8px;">|</span>' +
      '<span style="color:#888;">Δ = ' + BinauralEngine.STATE.activeBeat + ' Hz</span>';
    PATCH.syncConcertPitchUI();
  };

  PATCH.syncConcertPitchUI = function syncConcertPitchUI() {
    const a4 = PATCH.getConcertA4Hz();
    const netCents = PATCH.getGlobalConcertOffsetCents();

    const previewPanel = document.getElementById('midiPreviewPanel');
    if (previewPanel && !document.getElementById('prevConcertPitch')) {
      const badge = document.createElement('div');
      badge.id = 'prevConcertPitch';
      badge.style.fontFamily = "'Share Tech Mono',monospace";
      badge.style.fontSize = '8px';
      badge.style.letterSpacing = '1px';
      badge.style.color = '#8f8f8f';
      badge.style.padding = '0 8px';
      badge.style.whiteSpace = 'nowrap';
      const timeEl = document.getElementById('prevTime');
      if (timeEl && timeEl.parentNode) {
        timeEl.parentNode.insertBefore(badge, timeEl.nextSibling);
      }
    }

    const previewBadge = document.getElementById('prevConcertPitch');
    if (previewBadge) {
      previewBadge.textContent = 'A4 ' + a4.toFixed(1) + ' Hz  |  ' + PATCH.formatSignedCents(netCents);
      previewBadge.title = 'Current concert pitch and net offset from 440Hz';
    }

    const compControls = document.getElementById('compTuningControls');
    if (compControls && !document.getElementById('ctConcertPitchSummary')) {
      const summary = document.createElement('div');
      summary.id = 'ctConcertPitchSummary';
      summary.style.fontFamily = "'Share Tech Mono',monospace";
      summary.style.fontSize = '8px';
      summary.style.letterSpacing = '1px';
      summary.style.lineHeight = '1.8';
      summary.style.color = '#8f8f8f';
      summary.style.margin = '-2px 0 14px';
      summary.style.padding = '8px 10px';
      summary.style.border = '1px solid var(--border)';
      summary.style.background = 'rgba(255,255,255,.03)';
      const globalRow = document.getElementById('ctGlobalCents');
      if (globalRow) {
        const row = globalRow.closest('.param-row');
        if (row && row.parentNode) {
          row.parentNode.insertBefore(summary, row.nextSibling);
        }
      }
    }

    const compSummary = document.getElementById('ctConcertPitchSummary');
    if (compSummary) {
      compSummary.innerHTML =
        '<span style="color:#cfcfcf;">CONCERT PITCH</span>' +
        '<span style="color:#555;margin:0 8px;">|</span>' +
        '<span style="color:#aaaaaa;">A4 = ' + a4.toFixed(1) + ' Hz</span>' +
        '<span style="color:#555;margin:0 8px;">|</span>' +
        '<span style="color:#aaaaaa;">NET ' + PATCH.formatSignedCents(netCents) + ' from 440</span>';
    }

    const binauralControls = document.getElementById('binauralControls');
    if (binauralControls && !document.getElementById('bbConcertPitchInfo')) {
      const info = document.createElement('div');
      info.id = 'bbConcertPitchInfo';
      info.style.fontFamily = "'Share Tech Mono',monospace";
      info.style.fontSize = '8px';
      info.style.letterSpacing = '1px';
      info.style.color = '#777';
      info.style.margin = '2px 0 12px';
      const carrierNote = document.getElementById('bbCarrierNote');
      if (carrierNote && carrierNote.parentNode && carrierNote.parentNode.parentNode) {
        carrierNote.parentNode.parentNode.appendChild(info);
      }
    }

    const binauralInfo = document.getElementById('bbConcertPitchInfo');
    if (binauralInfo) {
      binauralInfo.textContent = 'CONCERT PITCH: A4 ' + a4.toFixed(1) + ' Hz  |  NET ' + PATCH.formatSignedCents(netCents);
    }
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.centsToPitchBend = function centsToPitchBend(cents, pbRange) {
    const safeRange = Number.isFinite(pbRange) && pbRange > 0 ? pbRange : 2;
    const normalized = Math.max(-1, Math.min(1, (Number(cents) || 0) / (safeRange * 100)));
    return Math.round(8192 + normalized * 8191);
  };

  PATCH.resetAdaptiveJiMemory = function resetAdaptiveJiMemory() {
    PATCH.jiAdaptiveMemory = {
      prevCents: null,
      prevPcs: [],
      prevRootPc: null,
      prevVoicing: [],
      lastOffsetCents: 0,
      lastBaseOffsetCents: 0,
      lastAnchorOffsetCents: 0,
      lastVoiceLeadOffsetCents: 0,
      lastCommonCount: 0,
      lastCadenceType: '',
      lastBassBiasWeight: 1,
      lastVoiceLeadWeight: 1,
    };
  };

  PATCH.getAdaptiveJiTonicPc = function getAdaptiveJiTonicPc() {
    if (typeof PROG_STATE !== 'undefined' &&
        PROG_STATE &&
        PROG_STATE.enabled &&
        Array.isArray(PROG_STATE.prog) &&
        PROG_STATE.prog.length &&
        PROG_STATE.prog[0] &&
        PROG_STATE.prog[0].chord) {
      return PATCH.mod(PROG_STATE.prog[0].chord.root, 12);
    }
    if (typeof S !== 'undefined' && S && S.chord) return PATCH.mod(S.chord.root, 12);
    return null;
  };

  PATCH.detectAdaptiveJiCadence = function detectAdaptiveJiCadence(prevRootPc, currentRootPc) {
    const tonic = PATCH.getAdaptiveJiTonicPc();
    if (!Number.isFinite(tonic) || !Number.isFinite(prevRootPc) || !Number.isFinite(currentRootPc)) return '';
    const prev = PATCH.mod(prevRootPc, 12);
    const curr = PATCH.mod(currentRootPc, 12);
    if (curr !== tonic) return '';
    if (prev === PATCH.mod(tonic + 7, 12)) return 'AUTHENTIC';
    if (prev === PATCH.mod(tonic + 5, 12)) return 'PLAGAL';
    if (prev === PATCH.mod(tonic + 11, 12)) return 'LEADING';
    return '';
  };

  PATCH.getMacroSections = function getMacroSections(totalBarsOverride) {
    if (typeof S === 'undefined' ||
        !S ||
        !S.engines ||
        !S.engines.macro ||
        !S.macroEnabled ||
        typeof generateTensionCurve !== 'function' ||
        typeof detectSections !== 'function') {
      return [];
    }
    const totalBars = Math.max(1, Number(totalBarsOverride) || PATCH.getActiveProgressionTotalBars() || S.bars || 1);
    const curve = generateTensionCurve(S.curveShape, totalBars, S.curveAmp, S.chainEnabled, S.curveShapeB);
    return detectSections(curve) || [];
  };

  PATCH.ensureJiSectionProfiles = function ensureJiSectionProfiles(totalBarsOverride) {
    if (typeof JI_PARAMS === 'undefined') return [];
    const sections = PATCH.getMacroSections(totalBarsOverride);
    const existing = Array.isArray(JI_PARAMS.sectionProfiles) ? JI_PARAMS.sectionProfiles : [];
    JI_PARAMS.sectionProfiles = sections.map(section => {
      const key = (section.name || 'Section') + '@' + section.bar;
      const match = existing.find(item => ((item.name || 'Section') + '@' + item.bar) === key);
      return {
        name: section.name || 'Section',
        bar: section.bar,
        mode: match && match.mode ? match.mode : JI_PARAMS.mode,
        blend: match && Number.isFinite(match.blend) ? match.blend : JI_PARAMS.blend,
        harmonicLimit: match && Number.isFinite(match.harmonicLimit) ? match.harmonicLimit : JI_PARAMS.harmonicLimit,
        adaptiveBassAnchorStrength: match && Number.isFinite(match.adaptiveBassAnchorStrength)
          ? match.adaptiveBassAnchorStrength
          : (Number(JI_PARAMS.adaptiveBassAnchorStrength) || 0),
        adaptiveVoiceLeadingStrength: match && Number.isFinite(match.adaptiveVoiceLeadingStrength)
          ? match.adaptiveVoiceLeadingStrength
          : (Number(JI_PARAMS.adaptiveVoiceLeadingStrength) || 0),
        adaptiveCadenceResetEnabled: match && typeof match.adaptiveCadenceResetEnabled === 'boolean'
          ? match.adaptiveCadenceResetEnabled
          : !!JI_PARAMS.adaptiveCadenceResetEnabled,
        adaptiveCadenceResetStrength: match && Number.isFinite(match.adaptiveCadenceResetStrength)
          ? match.adaptiveCadenceResetStrength
          : (Number(JI_PARAMS.adaptiveCadenceResetStrength) || 0.8),
      };
    });
    return JI_PARAMS.sectionProfiles;
  };

  PATCH.getChordRootPcAtBar = function getChordRootPcAtBar(bar) {
    const targetBar = Math.max(0, Number(bar) || 0);
    if (typeof PROG_STATE !== 'undefined' &&
        PROG_STATE &&
        PROG_STATE.enabled &&
        Array.isArray(PROG_STATE.prog) &&
        PROG_STATE.prog.length) {
      let cursor = 0;
      for (const entry of PROG_STATE.prog) {
        const bars = Math.max(1, Number(entry && entry.bars) || 1);
        if (targetBar >= cursor && targetBar < cursor + bars) {
          return entry && entry.chord ? PATCH.mod(entry.chord.root, 12) : 0;
        }
        cursor += bars;
      }
    }
    if (typeof S !== 'undefined' && S && S.chord) return PATCH.mod(S.chord.root, 12);
    if (typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE) return PATCH.mod(CompTuningEngine.STATE.rootPc, 12);
    return 0;
  };

  PATCH.ensureCompSectionProfiles = function ensureCompSectionProfiles(totalBarsOverride) {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return [];
    const sections = PATCH.getMacroSections(totalBarsOverride);
    const existing = Array.isArray(CompTuningEngine.STATE.sectionProfiles) ? CompTuningEngine.STATE.sectionProfiles : [];
    CompTuningEngine.STATE.sectionProfiles = sections.map(section => {
      const key = (section.name || 'Section') + '@' + section.bar;
      const match = existing.find(item => ((item.name || 'Section') + '@' + item.bar) === key);
      const defaultRootPc = PATCH.getChordRootPcAtBar(section.bar);
      return {
        name: section.name || 'Section',
        bar: section.bar,
        a4Hz: match && Number.isFinite(match.a4Hz) ? match.a4Hz : CompTuningEngine.STATE.a4Hz,
        globalCents: match && Number.isFinite(match.globalCents) ? match.globalCents : CompTuningEngine.STATE.globalCents,
        rootPc: match && Number.isFinite(match.rootPc) ? PATCH.mod(match.rootPc, 12) : defaultRootPc,
        scalaSource: match && typeof match.scalaSource === 'string' ? match.scalaSource : 'inherit',
      };
    });
    return CompTuningEngine.STATE.sectionProfiles;
  };

  PATCH.isCompSectionModActive = function isCompSectionModActive() {
    return typeof CompTuningEngine !== 'undefined' &&
      !!CompTuningEngine.STATE &&
      !!CompTuningEngine.STATE.enabled &&
      !!CompTuningEngine.STATE.sectionModEnabled;
  };

  PATCH.isCompSectionRuntimeActive = function isCompSectionRuntimeActive() {
    return PATCH.isCompSectionModActive() &&
      !(typeof S !== 'undefined' && S && S.engines && S.engines.mpe && S.mpe);
  };

  PATCH.getCompSectionScalaOptions = function getCompSectionScalaOptions() {
    PATCH.initScalaPresets();
    const options = [
      { value: 'inherit', label: 'INHERIT CURRENT' },
      { value: 'none', label: 'NONE' },
    ];
    PATCH.SCALA_PRESETS.forEach(preset => {
      options.push({ value: 'preset:' + preset.id, label: 'PRESET ' + preset.label.toUpperCase() });
    });
    const favorites = PATCH.readScalaFavorites();
    PATCH.SCALA_FAVORITE_SLOTS.forEach(slot => {
      const entry = favorites[slot];
      if (entry) options.push({ value: 'favorite:' + slot, label: slot + ' ' + (entry.label || 'FAVORITE').toUpperCase() });
    });
    return options;
  };

  PATCH.getCompTuningContextForBar = function getCompTuningContextForBar(barOffset) {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return null;
    const base = {
      a4Hz: CompTuningEngine.STATE.a4Hz,
      globalCents: CompTuningEngine.STATE.globalCents,
      rootPc: PATCH.mod(CompTuningEngine.STATE.rootPc, 12),
      scalaSource: 'inherit',
    };
    if (!CompTuningEngine.STATE.sectionModEnabled) return base;
    const profiles = PATCH.ensureCompSectionProfiles();
    if (!profiles.length) return base;
    let selected = profiles[0];
    profiles.forEach(profile => {
      if ((profile.bar || 0) <= (Number(barOffset) || 0)) selected = profile;
    });
    return {
      a4Hz: Number.isFinite(selected.a4Hz) ? selected.a4Hz : base.a4Hz,
      globalCents: Number.isFinite(selected.globalCents) ? selected.globalCents : base.globalCents,
      rootPc: Number.isFinite(selected.rootPc) ? PATCH.mod(selected.rootPc, 12) : base.rootPc,
      scalaSource: typeof selected.scalaSource === 'string' ? selected.scalaSource : 'inherit',
      sectionName: selected.name || 'Section',
      bar: selected.bar || 0,
    };
  };

  PATCH.getCompSectionSegments = function getCompSectionSegments(barOffset, barCount) {
    const start = Math.max(0, Number(barOffset) || 0);
    const totalBars = Math.max(1, Number(barCount) || 1);
    if (!PATCH.isCompSectionRuntimeActive()) return [{ barOffset: start, bars: totalBars }];
    const end = start + totalBars;
    const boundaries = PATCH.ensureCompSectionProfiles()
      .map(profile => Number(profile.bar) || 0)
      .filter(bar => bar > start && bar < end)
      .sort((a, b) => a - b);
    if (!boundaries.length) return [{ barOffset: start, bars: totalBars }];
    const segments = [];
    let cursor = start;
    boundaries.forEach(bar => {
      if (bar > cursor) {
        segments.push({ barOffset: cursor, bars: bar - cursor });
        cursor = bar;
      }
    });
    if (cursor < end) segments.push({ barOffset: cursor, bars: end - cursor });
    return segments.length ? segments : [{ barOffset: start, bars: totalBars }];
  };

  PATCH.captureCompTuningState = function captureCompTuningState() {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return null;
    return {
      a4Hz: CompTuningEngine.STATE.a4Hz,
      globalCents: CompTuningEngine.STATE.globalCents,
      rootPc: CompTuningEngine.STATE.rootPc,
      temperament: CompTuningEngine.STATE.temperament,
      customCents: Array.isArray(CompTuningEngine.STATE.customCents) ? CompTuningEngine.STATE.customCents.slice() : null,
      autoScaleSync: !!CompTuningEngine.STATE.autoScaleSync,
      linkedScaleName: CompTuningEngine.STATE.linkedScaleName || null,
      scalaProfile: CompTuningEngine.STATE.scalaProfile ? PATCH.jsonClone(CompTuningEngine.STATE.scalaProfile) : null,
      generatedNoteCentsMap: CompTuningEngine.STATE.generatedNoteCentsMap ? { ...CompTuningEngine.STATE.generatedNoteCentsMap } : null,
    };
  };

  PATCH.restoreCompTuningState = function restoreCompTuningState(snapshot) {
    if (!snapshot || typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
    CompTuningEngine.STATE.a4Hz = snapshot.a4Hz;
    CompTuningEngine.STATE.globalCents = snapshot.globalCents;
    CompTuningEngine.STATE.rootPc = snapshot.rootPc;
    CompTuningEngine.STATE.temperament = snapshot.temperament;
    CompTuningEngine.STATE.customCents = Array.isArray(snapshot.customCents) ? snapshot.customCents.slice() : Array(12).fill(0);
    CompTuningEngine.STATE.autoScaleSync = !!snapshot.autoScaleSync;
    CompTuningEngine.STATE.linkedScaleName = snapshot.linkedScaleName || null;
    CompTuningEngine.STATE.scalaProfile = snapshot.scalaProfile ? PATCH.jsonClone(snapshot.scalaProfile) : null;
    CompTuningEngine.STATE.generatedNoteCentsMap = snapshot.generatedNoteCentsMap ? { ...snapshot.generatedNoteCentsMap } : null;
    if (CompTuningEngine.STATE.scalaProfile) {
      PATCH.ensureScalaTemperamentEntry();
      PATCH.refreshScalaProfile(false);
    } else if (typeof CompTuningEngine.clearGeneratedNoteCentsMap === 'function' && !snapshot.generatedNoteCentsMap) {
      CompTuningEngine.clearGeneratedNoteCentsMap();
    }
  };

  PATCH.resolveCompSectionScalaPayload = function resolveCompSectionScalaPayload(source) {
    if (!source || source === 'inherit') return { kind: 'inherit' };
    if (source === 'none') return { kind: 'none' };
    if (source.startsWith('preset:')) {
      PATCH.initScalaPresets();
      const presetId = source.slice('preset:'.length);
      const preset = PATCH.SCALA_PRESETS.find(entry => entry.id === presetId);
      if (!preset) return { kind: 'inherit' };
      return {
        kind: 'preset',
        sclText: preset.sclText,
        kbmText: preset.kbmText || '',
        sclName: preset.label + '.scl',
        kbmName: preset.kbmText ? preset.label + '.kbm' : '',
        presetId,
      };
    }
    if (source.startsWith('favorite:')) {
      const slot = source.slice('favorite:'.length);
      const favorites = PATCH.readScalaFavorites();
      const entry = favorites[slot];
      if (!entry) return { kind: 'inherit' };
      return {
        kind: 'favorite',
        sclText: entry.sclText,
        kbmText: entry.kbmText || '',
        sclName: entry.sclName || slot,
        kbmName: entry.kbmName || '',
        presetId: entry.presetId || null,
        favoriteSlot: slot,
      };
    }
    return { kind: 'inherit' };
  };

  PATCH.clearScalaProfileSilently = function clearScalaProfileSilently() {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
    delete CompTuningEngine.TEMPERAMENTS[PATCH.SCALA_TEMPERAMENT_KEY];
    CompTuningEngine.STATE.scalaProfile = null;
    CompTuningEngine.STATE.customCents = Array(12).fill(0);
    if (typeof CompTuningEngine.clearGeneratedNoteCentsMap === 'function') {
      CompTuningEngine.clearGeneratedNoteCentsMap();
    } else {
      CompTuningEngine.STATE.generatedNoteCentsMap = null;
    }
    if (CompTuningEngine.STATE.temperament === PATCH.SCALA_TEMPERAMENT_KEY) {
      CompTuningEngine.STATE.temperament = 'Equal';
    }
  };

  PATCH.applyCompTuningContext = function applyCompTuningContext(context, options) {
    if (!context || typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return false;
    const opts = options || {};
    CompTuningEngine.STATE.a4Hz = context.a4Hz;
    CompTuningEngine.STATE.globalCents = context.globalCents;
    CompTuningEngine.STATE.rootPc = PATCH.mod(context.rootPc, 12);

    const scala = PATCH.resolveCompSectionScalaPayload(context.scalaSource);
    if (scala.kind === 'none') {
      PATCH.clearScalaProfileSilently();
    } else if (scala.kind === 'preset' || scala.kind === 'favorite') {
      CompTuningEngine.STATE.scalaProfile = {
        sclName: scala.sclName,
        sclText: String(scala.sclText || ''),
        kbmName: scala.kbmName || '',
        kbmText: String(scala.kbmText || ''),
        presetId: scala.presetId || null,
        favoriteSlot: scala.favoriteSlot || null,
      };
      PATCH.refreshScalaProfile(false);
    } else if (CompTuningEngine.STATE.scalaProfile) {
      PATCH.refreshScalaProfile(false);
    } else if (typeof CompTuningEngine.clearGeneratedNoteCentsMap === 'function') {
      CompTuningEngine.clearGeneratedNoteCentsMap();
    }

    if (!CompTuningEngine.STATE.scalaProfile) {
      const scaleName = opts.scaleName || (typeof S !== 'undefined' && S ? S.scale : null);
      if (CompTuningEngine.STATE.autoScaleSync &&
          scaleName &&
          typeof CompTuningEngine.buildGeneratedNoteCentsMap === 'function' &&
          typeof CompTuningEngine.setGeneratedNoteCentsMap === 'function') {
        const map = CompTuningEngine.buildGeneratedNoteCentsMap(
          scaleName,
          PATCH.mod(context.rootPc, 12),
          [0, 10],
          opts.useJI ? { useJI: true, jiParams: opts.jiParams } : undefined
        );
        CompTuningEngine.setGeneratedNoteCentsMap(map);
        CompTuningEngine.STATE.linkedScaleName = scaleName;
      }
    }
    return true;
  };

  PATCH.withCompTuningContext = function withCompTuningContext(context, options, fn) {
    const snapshot = PATCH.captureCompTuningState();
    try {
      PATCH.applyCompTuningContext(context, options);
      return fn();
    } finally {
      PATCH.restoreCompTuningState(snapshot);
    }
  };

  PATCH.extractMidiTrackDatas = function extractMidiTrackDatas(midiData) {
    const bytes = Array.from(midiData || []);
    if (bytes.length < 14) return [];
    const numTracks = (bytes[10] << 8) | bytes[11];
    let pointer = 14;
    const tracks = [];
    for (let index = 0; index < numTracks; index++) {
      if (pointer + 8 > bytes.length) break;
      const length = (bytes[pointer + 4] << 24) | (bytes[pointer + 5] << 16) | (bytes[pointer + 6] << 8) | bytes[pointer + 7];
      pointer += 8;
      tracks.push(bytes.slice(pointer, pointer + length));
      pointer += length;
    }
    return tracks;
  };

  PATCH.applyCompTuningToTrackSlice = function applyCompTuningToTrackSlice(tracks, trackNames, chord, barOffset) {
    if (!PATCH.isCompSectionRuntimeActive() || !Array.isArray(tracks) || !tracks.length || typeof writeMIDI !== 'function') {
      return tracks;
    }
    const context = PATCH.getCompTuningContextForBar(barOffset);
    if (!context) return tracks;
    const conductor = [0, 0xFF, 0x2F, 0];
    const midi = writeMIDI(tracks, (typeof S !== 'undefined' && S ? S.bpm : 120) || 120, 480, conductor);
    const useJI = typeof JI_PARAMS !== 'undefined' && JI_PARAMS && JI_PARAMS.enabled;
    const jiParams = typeof PATCH.getJiParamsForBar === 'function'
      ? PATCH.getJiParamsForBar(barOffset)
      : (typeof JI_PARAMS !== 'undefined' ? JI_PARAMS : null);
    const prevInternal = window.__MEIKY_ALLOW_COMP_SECTION_INTERNAL__;
    window.__MEIKY_ALLOW_COMP_SECTION_INTERNAL__ = true;
    try {
      const tunedMidi = PATCH.withCompTuningContext(context, {
        scaleName: typeof S !== 'undefined' && S ? S.scale : null,
        useJI,
        jiParams,
      }, () => applyCompensationTuningToMidi(midi, (typeof S !== 'undefined' && S ? S.pbRange : 2) || 2));
      const tunedTracks = PATCH.extractMidiTrackDatas(tunedMidi).slice(1);
      return tunedTracks.map((data, index) => {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || []);
        return bytes.length ? bytes : tracks[index];
      });
    } finally {
      window.__MEIKY_ALLOW_COMP_SECTION_INTERNAL__ = prevInternal;
    }
  };

  PATCH.getJiParamsForBar = function getJiParamsForBar(barOffset) {
    if (typeof JI_PARAMS === 'undefined') return null;
    const base = PATCH.jsonClone(JI_PARAMS);
    if (!JI_PARAMS.sectionModEnabled) return base;
    const profiles = PATCH.ensureJiSectionProfiles();
    if (!profiles.length) return base;
    let selected = profiles[0];
    profiles.forEach(profile => {
      if ((profile.bar || 0) <= (Number(barOffset) || 0)) selected = profile;
    });
    return Object.assign(base, {
      mode: selected.mode || base.mode,
      blend: Number.isFinite(selected.blend) ? selected.blend : base.blend,
      harmonicLimit: Number.isFinite(selected.harmonicLimit) ? selected.harmonicLimit : base.harmonicLimit,
      adaptiveBassAnchorStrength: Number.isFinite(selected.adaptiveBassAnchorStrength)
        ? selected.adaptiveBassAnchorStrength
        : base.adaptiveBassAnchorStrength,
      adaptiveVoiceLeadingStrength: Number.isFinite(selected.adaptiveVoiceLeadingStrength)
        ? selected.adaptiveVoiceLeadingStrength
        : base.adaptiveVoiceLeadingStrength,
      adaptiveCadenceResetEnabled: typeof selected.adaptiveCadenceResetEnabled === 'boolean'
        ? selected.adaptiveCadenceResetEnabled
        : base.adaptiveCadenceResetEnabled,
      adaptiveCadenceResetStrength: Number.isFinite(selected.adaptiveCadenceResetStrength)
        ? selected.adaptiveCadenceResetStrength
        : base.adaptiveCadenceResetStrength,
    });
  };

  PATCH.shouldResetAdaptiveJiAtBar = function shouldResetAdaptiveJiAtBar(barOffset) {
    if (typeof JI_PARAMS !== 'undefined' && JI_PARAMS && !JI_PARAMS.adaptiveResetOnSection) return false;
    const bars = window.__MEIKY_JI_SECTION_BARS__;
    if (!Array.isArray(bars) || !bars.length) return false;
    return bars.includes(Number(barOffset) || 0);
  };

  PATCH.buildAdaptiveJiPitchBendMap = function buildAdaptiveJiPitchBendMap(chord, pbRange, barOffset) {
    if (!chord || !Array.isArray(chord.iv) || typeof JustIntonation === 'undefined' || typeof JI_PARAMS === 'undefined') {
      return null;
    }
    const jiContext = PATCH.getJiParamsForBar(barOffset) || JI_PARAMS;
    if (jiContext.adaptiveMemoryEnabled && PATCH.shouldResetAdaptiveJiAtBar(barOffset)) {
      PATCH.resetAdaptiveJiMemory();
    }
    const safePbRange = Number.isFinite(pbRange) && pbRange > 0 ? pbRange : 2;
    const root = ((chord.root % 12) + 12) % 12;
    const pcs = chord.iv.map(interval => ((root + interval) % 12 + 12) % 12);
    const uniquePcs = Array.from(new Set(pcs));
    const currentCents = {};
    uniquePcs.forEach(pc => {
      currentCents[pc] = typeof JustIntonation._deviation === 'function'
        ? JustIntonation._deviation(pc, root, jiContext)
        : 0;
    });

    let offsetCents = 0;
    let commonCount = 0;
    let cadenceType = '';
    let bassBiasWeight = 1;
    let voiceLeadWeight = 1;
    const memory = PATCH.jiAdaptiveMemory || { prevCents: null, prevPcs: [], prevRootPc: null };
    const currentVoicing = typeof VLEngine !== 'undefined' && VLEngine && typeof VLEngine.voiceLead === 'function'
      ? VLEngine.voiceLead(Array.isArray(memory.prevVoicing) ? memory.prevVoicing : [], uniquePcs, { center: 60, force: true })
      : [];
    if (jiContext.adaptiveMemoryEnabled &&
        memory.prevCents &&
        Array.isArray(memory.prevPcs) &&
        memory.prevPcs.length) {
      const common = uniquePcs.filter(pc => Number.isFinite(memory.prevCents[pc]));
      commonCount = common.length;
      if (common.length) {
        const bassBias = Math.max(0, Math.min(1, Number(jiContext.adaptiveBassAnchorStrength) || 0));
        const baseDrift = common.reduce((sum, pc) => {
          return sum + (memory.prevCents[pc] - currentCents[pc]);
        }, 0) / common.length;
        const anchorPcs = common.filter(pc => {
          return pc === root || (Number.isFinite(memory.prevRootPc) && pc === memory.prevRootPc);
        });
        const anchorDrift = anchorPcs.length
          ? anchorPcs.reduce((sum, pc) => sum + (memory.prevCents[pc] - currentCents[pc]), 0) / anchorPcs.length
          : baseDrift;
        let drift = baseDrift + (anchorDrift - baseDrift) * bassBias;
        const voiceLeadBias = Math.max(0, Math.min(1, Number(jiContext.adaptiveVoiceLeadingStrength) || 0));
        const prevVoicing = Array.isArray(memory.prevVoicing) ? memory.prevVoicing : [];
        const voiceLeadWeights = {};
        if (voiceLeadBias > 0 && currentVoicing.length && prevVoicing.length) {
          currentVoicing.forEach((note, index) => {
            const pc = PATCH.mod(note, 12);
            if (!common.includes(pc)) return;
            const prevNote = prevVoicing[Math.min(index, prevVoicing.length - 1)];
            const move = Number.isFinite(prevNote) ? Math.abs(note - prevNote) : 12;
            const retain = Math.max(0, 1 - Math.min(move, 12) / 12);
            const bassPos = currentVoicing.length > 1 ? 1 - (index / (currentVoicing.length - 1)) : 1;
            const weight = 1 + retain * 1.5 + bassPos;
            voiceLeadWeights[pc] = Math.max(voiceLeadWeights[pc] || 1, weight);
          });
          const entries = common.filter(pc => Number.isFinite(voiceLeadWeights[pc]));
          if (entries.length) {
            const totalWeight = entries.reduce((sum, pc) => sum + voiceLeadWeights[pc], 0);
            const voiceLeadDrift = totalWeight > 0
              ? entries.reduce((sum, pc) => sum + (memory.prevCents[pc] - currentCents[pc]) * voiceLeadWeights[pc], 0) / totalWeight
              : drift;
            drift = drift + (voiceLeadDrift - drift) * voiceLeadBias;
            voiceLeadWeight = Math.max(...entries.map(pc => voiceLeadWeights[pc]));
            memory.lastVoiceLeadOffsetCents = voiceLeadDrift * Math.max(0, Math.min(1, Number(jiContext.adaptiveMemoryStrength) || 0));
          } else {
            memory.lastVoiceLeadOffsetCents = 0;
          }
        } else {
          memory.lastVoiceLeadOffsetCents = 0;
        }
        const strength = Math.max(0, Math.min(1, Number(jiContext.adaptiveMemoryStrength) || 0));
        offsetCents = drift * strength;
        bassBiasWeight = anchorPcs.length ? 1 + bassBias * 2 : 1;
        memory.lastBaseOffsetCents = baseDrift * strength;
        memory.lastAnchorOffsetCents = anchorDrift * strength;
      } else {
        memory.lastBaseOffsetCents = 0;
        memory.lastAnchorOffsetCents = 0;
        memory.lastVoiceLeadOffsetCents = 0;
      }
      if (jiContext.adaptiveCadenceResetEnabled) {
        cadenceType = PATCH.detectAdaptiveJiCadence(memory.prevRootPc, root);
        if (cadenceType) {
          const cadenceStrength = Math.max(0, Math.min(1, Number(jiContext.adaptiveCadenceResetStrength) || 0));
          offsetCents *= (1 - cadenceStrength);
        }
      }
    }

    const adjustedCents = {};
    const pbMap = {};
    uniquePcs.forEach(pc => {
      adjustedCents[pc] = currentCents[pc] + offsetCents;
      pbMap[pc] = PATCH.centsToPitchBend(adjustedCents[pc], safePbRange);
    });

    PATCH.jiAdaptiveMemory = {
      prevCents: adjustedCents,
      prevPcs: uniquePcs.slice(),
      prevRootPc: root,
      prevVoicing: currentVoicing.slice(),
      lastOffsetCents: offsetCents,
      lastBaseOffsetCents: memory.lastBaseOffsetCents || 0,
      lastAnchorOffsetCents: memory.lastAnchorOffsetCents || 0,
      lastVoiceLeadOffsetCents: memory.lastVoiceLeadOffsetCents || 0,
      lastCommonCount: commonCount,
      lastCadenceType: cadenceType,
      lastBassBiasWeight: bassBiasWeight,
      lastVoiceLeadWeight: voiceLeadWeight,
    };
    return pbMap;
  };

  PATCH.buildABDiffSummary = function buildABDiffSummary() {
    const variantA = PATCH.abVariants && PATCH.abVariants.A;
    const variantB = PATCH.abVariants && PATCH.abVariants.B;
    if (!variantA || !variantB || !variantA.midiData || !variantB.midiData) return null;

    const midiA = Array.from(variantA.midiData || []);
    const midiB = Array.from(variantB.midiData || []);
    const minLength = Math.min(midiA.length, midiB.length);
    let firstDiffIndex = -1;
    for (let index = 0; index < minLength; index++) {
      if (midiA[index] !== midiB[index]) {
        firstDiffIndex = index;
        break;
      }
    }
    const differingBytes = Math.abs(midiA.length - midiB.length) +
      Array.from({ length: minLength }).reduce((sum, _, index) => sum + (midiA[index] !== midiB[index] ? 1 : 0), 0);
    const layerNamesA = Array.isArray(variantA.layerTracks) ? variantA.layerTracks.map(track => track.name) : [];
    const layerNamesB = Array.isArray(variantB.layerTracks) ? variantB.layerTracks.map(track => track.name) : [];

    return {
      hasVariants: true,
      currentMode: typeof S !== 'undefined' && S ? (S.abMode || 'A') : 'A',
      midiBytes: { A: midiA.length, B: midiB.length },
      differingBytes,
      firstDiffIndex,
      layerNames: { A: layerNamesA, B: layerNamesB },
      conductorBytes: {
        A: Array.isArray(variantA.conductorRaw) ? variantA.conductorRaw.length : 0,
        B: Array.isArray(variantB.conductorRaw) ? variantB.conductorRaw.length : 0,
      },
    };
  };

  PATCH.buildExportManifest = function buildExportManifest(kind, fileEntries) {
    const progression =
      typeof PROG_STATE !== 'undefined' &&
      PROG_STATE &&
      Array.isArray(PROG_STATE.prog) &&
      PROG_STATE.prog.length
        ? PROG_STATE.prog.map(entry => ({
            chord: entry && entry.chord ? entry.chord.rootName + (entry.chord.quality || '') : null,
            bars: entry && entry.bars ? entry.bars : 0,
          }))
        : [];
    const layers = typeof S !== 'undefined' && S && Array.isArray(S.layerTracks)
      ? S.layerTracks.map(track => track.name)
      : [];
    const activeLayers = typeof S !== 'undefined' && S && S.layers
      ? Object.entries(S.layers).filter(([, on]) => !!on).map(([name]) => name)
      : [];
    const activeEngines = typeof S !== 'undefined' && S && S.engines
      ? Object.entries(S.engines).filter(([, on]) => !!on).map(([name]) => name)
      : [];
    const scalaName =
      typeof CompTuningEngine !== 'undefined' &&
      CompTuningEngine.STATE &&
      CompTuningEngine.STATE.scalaProfile &&
      CompTuningEngine.STATE.scalaProfile.sclName
        ? CompTuningEngine.STATE.scalaProfile.sclName
        : null;
    const sections =
      typeof S !== 'undefined' &&
      S &&
      S.engines &&
      S.engines.macro &&
      S.macroEnabled &&
      typeof generateTensionCurve === 'function' &&
      typeof detectSections === 'function'
        ? detectSections(generateTensionCurve(S.curveShape, PATCH.getActiveProgressionTotalBars() || S.bars, S.curveAmp, S.chainEnabled, S.curveShapeB))
        : [];
    if (typeof JI_PARAMS !== 'undefined') PATCH.ensureJiSectionProfiles();
    if (typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE) PATCH.ensureCompSectionProfiles();
    const liveFocus = PATCH.describeLiveSectionFocus();
    return {
      format: 'meiky-export-manifest-v1',
      kind: kind || 'manual',
      exportedAt: new Date().toISOString(),
      source: 'index.html',
      project: {
        chord: typeof S !== 'undefined' && S && S.chord ? S.chord.rootName + (S.chord.quality || '') : null,
        progression,
        scale: typeof S !== 'undefined' && S ? S.scale : null,
        genre: typeof S !== 'undefined' && S ? S.genre : null,
        bpm: typeof S !== 'undefined' && S ? S.bpm : null,
        bars: typeof S !== 'undefined' && S ? PATCH.getActiveProgressionTotalBars() || S.bars : null,
        rootOct: typeof S !== 'undefined' && S ? S.rootOct : null,
        seed: typeof S !== 'undefined' && S ? S.seed : null,
        sections: sections.map(section => ({ name: section.name, bar: section.bar })),
      },
      tuning: {
        concertA4Hz: PATCH.getConcertA4Hz(),
        globalOffsetCents: PATCH.getGlobalConcertOffsetCents(),
        compTuningSummary: typeof CompTuningEngine !== 'undefined' && typeof CompTuningEngine.getSummary === 'function'
          ? CompTuningEngine.getSummary()
          : null,
        scala: scalaName,
        compSectionModulation: typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE ? {
          enabled: !!CompTuningEngine.STATE.sectionModEnabled,
          runtimeApplied: PATCH.isCompSectionRuntimeActive(),
          profiles: Array.isArray(CompTuningEngine.STATE.sectionProfiles) ? PATCH.jsonClone(CompTuningEngine.STATE.sectionProfiles) : [],
        } : null,
        justIntonation: typeof JI_PARAMS !== 'undefined' ? {
          enabled: !!JI_PARAMS.enabled,
          mode: JI_PARAMS.mode,
          blend: JI_PARAMS.blend,
          harmonicLimit: JI_PARAMS.harmonicLimit,
          adaptiveMemoryEnabled: !!JI_PARAMS.adaptiveMemoryEnabled,
          adaptiveMemoryStrength: JI_PARAMS.adaptiveMemoryStrength,
          adaptiveBassAnchorStrength: JI_PARAMS.adaptiveBassAnchorStrength,
          adaptiveVoiceLeadingStrength: JI_PARAMS.adaptiveVoiceLeadingStrength,
          adaptiveCadenceResetEnabled: !!JI_PARAMS.adaptiveCadenceResetEnabled,
          adaptiveCadenceResetStrength: JI_PARAMS.adaptiveCadenceResetStrength,
          lastOffsetCents: PATCH.jiAdaptiveMemory ? PATCH.jiAdaptiveMemory.lastOffsetCents : 0,
          lastVoiceLeadOffsetCents: PATCH.jiAdaptiveMemory ? PATCH.jiAdaptiveMemory.lastVoiceLeadOffsetCents : 0,
          lastCadenceType: PATCH.jiAdaptiveMemory ? PATCH.jiAdaptiveMemory.lastCadenceType : '',
          sectionResetEnabled: !!JI_PARAMS.adaptiveResetOnSection,
          sectionModEnabled: !!JI_PARAMS.sectionModEnabled,
          sectionProfiles: Array.isArray(JI_PARAMS.sectionProfiles) ? PATCH.jsonClone(JI_PARAMS.sectionProfiles) : [],
        } : null,
      },
      liveControl: {
        previewBar: liveFocus.previewBar,
        sectionLearnFocus: PATCH.jsonClone(PATCH.sectionLearnFocus),
        sectionPreviewFollow: PATCH.jsonClone(PATCH.ensureSectionPreviewFollow()),
        activeJiSection: liveFocus.ji,
        activeCompSection: liveFocus.comp,
        midiLearnMappings: PATCH.readMidiLearnMappings(),
      },
      exports: {
        layerNames: layers,
        activeLayers,
        activeEngines,
        multiExport: typeof S !== 'undefined' && S && S.multiExport ? PATCH.jsonClone(S.multiExport) : null,
        files: Array.isArray(fileEntries) ? fileEntries : [],
        abDiff: PATCH.buildABDiffSummary(),
      },
    };
  };

  PATCH.downloadJsonFile = function downloadJsonFile(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  PATCH.downloadExportManifest = function downloadExportManifest(kind, fileEntries) {
    if (typeof S === 'undefined' || !S) return false;
    const prefix = ((S.multiExport && S.multiExport.prefix) || 'void').replace(/[^a-zA-Z0-9_-]/g, '_') || 'void';
    const manifest = PATCH.buildExportManifest(kind, fileEntries);
    PATCH.downloadJsonFile(prefix + '_manifest.json', manifest);
    const status = document.getElementById('meStatus');
    if (status) status.textContent = 'EXPORT MANIFEST saved';
    return true;
  };

  PATCH.syncPatchDiagnosticsUI = function syncPatchDiagnosticsUI() {
    const el = document.getElementById('patchDiagnostics');
    if (!el) return;
    const a4 = PATCH.getConcertA4Hz();
    const netCents = PATCH.getGlobalConcertOffsetCents();
    const scalaName =
      typeof CompTuningEngine !== 'undefined' &&
      CompTuningEngine.STATE &&
      CompTuningEngine.STATE.scalaProfile &&
      CompTuningEngine.STATE.scalaProfile.scale &&
      CompTuningEngine.STATE.scalaProfile.scale.name
        ? CompTuningEngine.STATE.scalaProfile.scale.name
        : 'None';
    const learnCount = Object.keys(PATCH.readMidiLearnMappings()).length;
    const capture = PATCH.midiCaptureState || {};
    const capturePolicy = PATCH.ensureMidiCapturePolicy();
    const follow = PATCH.ensureSectionPreviewFollow();
    const previewState = PATCH.previewTransportState || { playing: false, bar: 0, progress: 0, duration: 0 };
    const captureState = !capture.enabled
      ? 'IDLE'
      : capture.pendingChord
        ? 'PENDING ' + capture.pendingChord.rootName + (capture.pendingChord.quality || '')
        : 'ARMED';
    const jiFocus = PATCH.getFocusedSectionProfile('ji');
    const compFocus = PATCH.getFocusedSectionProfile('comp');
    const jiState = typeof JI_PARAMS !== 'undefined'
      ? (!!JI_PARAMS.enabled
          ? (
              JI_PARAMS.mode +
              (JI_PARAMS.adaptiveMemoryEnabled ? ' / MEM ' + Math.round((JI_PARAMS.adaptiveMemoryStrength || 0) * 100) + '%' : '') +
              (JI_PARAMS.adaptiveMemoryEnabled && (Number(JI_PARAMS.adaptiveBassAnchorStrength) || 0) > 0 ? ' / BASS ' + Math.round((JI_PARAMS.adaptiveBassAnchorStrength || 0) * 100) + '%' : '') +
              (JI_PARAMS.adaptiveMemoryEnabled && (Number(JI_PARAMS.adaptiveVoiceLeadingStrength) || 0) > 0 ? ' / VL ' + Math.round((JI_PARAMS.adaptiveVoiceLeadingStrength || 0) * 100) + '%' : '') +
              (JI_PARAMS.adaptiveCadenceResetEnabled ? ' / CAD ' + Math.round((JI_PARAMS.adaptiveCadenceResetStrength || 0) * 100) + '%' : '') +
              (JI_PARAMS.adaptiveMemoryEnabled ? ' / SEC ' + (JI_PARAMS.adaptiveResetOnSection ? 'ON' : 'OFF') : '') +
              (JI_PARAMS.sectionModEnabled ? ' / MOD ON' : '') +
              (JI_PARAMS.sectionModEnabled && jiFocus && jiFocus.profile ? ' / F:' + (jiFocus.profile.name || ('#' + (jiFocus.index + 1))) : '')
            )
          : 'OFF')
      : 'OFF';
    const compState =
      typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE
        ? (CompTuningEngine.STATE.sectionModEnabled
            ? ('MOD ON' + (PATCH.isCompSectionRuntimeActive() ? '' : ' / MPE BYPASS') + (compFocus && compFocus.profile ? ' / F:' + (compFocus.profile.name || ('#' + (compFocus.index + 1))) : ''))
            : 'MOD OFF')
        : 'MOD OFF';
    const oscMode = typeof S !== 'undefined' && S && S.oscExport ? (S.oscExport.mode || 'binary').toUpperCase() : 'BINARY';
    const oscUrl = typeof S !== 'undefined' && S && S.oscExport ? (S.oscExport.url || '—') : '—';
    const oscTest = typeof S !== 'undefined' && S && S.oscExport ? (S.oscExport.testStatus || 'OSC TEST 未実行') : 'OSC TEST 未実行';
    const abState = typeof S !== 'undefined' && S ? 'A:' + (!!S.midiDataA) + ' / B:' + (!!S.midiDataB) + ' / CUR:' + (S.abMode || 'A') : 'A:false / B:false / CUR:A';
    const currentOutput = typeof S !== 'undefined' && S && S.midiData ? ('MIDI ' + S.midiData.length + ' bytes') : 'No MIDI';
    el.innerHTML =
      '<div style="color:#e5e7eb;">PATCH DIAGNOSTICS</div>' +
      '<div style="color:#7c7c7c;margin-top:4px;">CONCERT: A4 ' + a4.toFixed(1) + ' Hz / ' + PATCH.formatSignedCents(netCents) + '</div>' +
      '<div style="color:#7c7c7c;">SCALA: ' + scalaName + '</div>' +
      '<div style="color:#7c7c7c;">COMP: ' + compState + '</div>' +
      '<div style="color:#7c7c7c;">JI: ' + jiState + '</div>' +
      '<div style="color:#7c7c7c;">OSC: ' + oscMode + ' / ' + oscUrl + '</div>' +
      '<div style="color:#7c7c7c;">OSC TEST: ' + oscTest + '</div>' +
      '<div style="color:#7c7c7c;">PREVIEW: ' + (previewState.playing ? 'PLAY' : 'STOP') + ' / BAR ' + (previewState.bar + 1) + ' / JI ' + (follow.ji ? 'FOLLOW' : 'MANUAL') + ' / COMP ' + (follow.comp ? 'FOLLOW' : 'MANUAL') + '</div>' +
      '<div style="color:#7c7c7c;">MIDI LEARN: ' + learnCount + ' map(s) / CAPTURE ' + captureState + ' / ' + capturePolicy.mode.toUpperCase() + ' / ' + capturePolicy.holdMs + 'ms</div>' +
      '<div style="color:#7c7c7c;">A/B: ' + abState + '</div>' +
      '<div style="color:#7c7c7c;">OUTPUT: ' + currentOutput + '</div>';
  };

  PATCH.parseScalaPitchToken = function parseScalaPitchToken(token) {
    const value = String(token || '').trim();
    if (!value) throw new Error('empty Scala pitch token');
    if (value.includes('/')) {
      const parts = value.split('/');
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!(numerator > 0) || !(denominator > 0)) throw new Error('invalid Scala ratio: ' + value);
      return 1200 * Math.log2(numerator / denominator);
    }
    if (value.includes('.')) {
      const cents = parseFloat(value);
      if (!Number.isFinite(cents)) throw new Error('invalid Scala cents: ' + value);
      return cents;
    }
    const integer = parseFloat(value);
    if (!(integer > 0)) throw new Error('invalid Scala integer ratio: ' + value);
    return 1200 * Math.log2(integer);
  };

  PATCH.makeEdoScalaText = function makeEdoScalaText(name, edo, description, periodCents) {
    const stepCount = Math.max(1, Number(edo) || 12);
    const period = Number.isFinite(periodCents) ? periodCents : 1200;
    const lines = [description || name || (stepCount + '-EDO'), String(stepCount)];
    for (let index = 1; index <= stepCount; index++) {
      lines.push(((period / stepCount) * index).toFixed(6));
    }
    return lines.join('\n');
  };

  PATCH.initScalaPresets = function initScalaPresets() {
    if (PATCH.SCALA_PRESETS.length) return;
    PATCH.SCALA_PRESETS.push(
      {
        id: '19edo',
        label: '19-EDO',
        desc: '19 equal divisions of the octave',
        sclText: PATCH.makeEdoScalaText('19-EDO', 19, '19 equal divisions of the octave'),
        kbmText: '',
      },
      {
        id: '31edo',
        label: '31-EDO',
        desc: '31 equal divisions of the octave',
        sclText: PATCH.makeEdoScalaText('31-EDO', 31, '31 equal divisions of the octave'),
        kbmText: '',
      },
      {
        id: '22edo',
        label: '22-EDO',
        desc: '22 equal divisions of the octave',
        sclText: PATCH.makeEdoScalaText('22-EDO', 22, '22 equal divisions of the octave'),
        kbmText: '',
      },
      {
        id: '24edo',
        label: '24-EDO',
        desc: '24 equal divisions of the octave',
        sclText: PATCH.makeEdoScalaText('24-EDO', 24, '24 equal divisions of the octave'),
        kbmText: '',
      },
      {
        id: '53edo',
        label: '53-EDO',
        desc: '53 equal divisions of the octave',
        sclText: PATCH.makeEdoScalaText('53-EDO', 53, '53 equal divisions of the octave'),
        kbmText: '',
      },
      {
        id: 'bp',
        label: 'B-P',
        desc: 'Bohlen-Pierce equal temperament over a tritave',
        sclText: PATCH.makeEdoScalaText('Bohlen-Pierce', 13, 'Bohlen-Pierce equal temperament', 1901.955001),
        kbmText: '',
      },
      {
        id: '12jt',
        label: 'JI-12',
        desc: '5-limit just chromatic scale',
        sclText: [
          '5-limit just chromatic',
          '12',
          '16/15',
          '9/8',
          '6/5',
          '5/4',
          '4/3',
          '45/32',
          '3/2',
          '8/5',
          '5/3',
          '9/5',
          '15/8',
          '2/1',
        ].join('\n'),
        kbmText: '',
      },
      {
        id: 'septimal',
        label: 'JI-7',
        desc: '7-limit just scale colors',
        sclText: [
          '7-limit lattice',
          '12',
          '28/27',
          '9/8',
          '7/6',
          '5/4',
          '21/16',
          '4/3',
          '7/5',
          '3/2',
          '14/9',
          '5/3',
          '7/4',
          '2/1',
        ].join('\n'),
        kbmText: '',
      }
    );
  };

  PATCH.readScalaFavorites = function readScalaFavorites() {
    try {
      const raw = localStorage.getItem(PATCH.SCALA_FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  PATCH.writeScalaFavorites = function writeScalaFavorites(favorites) {
    try {
      localStorage.setItem(PATCH.SCALA_FAVORITES_KEY, JSON.stringify(favorites || {}));
    } catch (_) {}
  };

  PATCH.parseScalaScl = function parseScalaScl(text, fallbackName) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    const payload = [];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('!')) continue;
      payload.push(trimmed);
    }
    if (payload.length < 2) throw new Error('Scala .scl is incomplete');
    const description = payload[0];
    const noteCount = parseInt(payload[1], 10);
    if (!(noteCount > 0)) throw new Error('Scala .scl note count is invalid');
    const pitches = [];
    for (let index = 2; index < payload.length && pitches.length < noteCount; index++) {
      const token = payload[index].split(/\s+/)[0];
      pitches.push(+PATCH.parseScalaPitchToken(token).toFixed(6));
    }
    if (pitches.length !== noteCount) throw new Error('Scala .scl pitch count mismatch');
    return {
      name: String(fallbackName || description || 'Scala').replace(/\.(scl)$/i, ''),
      description,
      noteCount,
      pitches,
      periodCents: pitches.length ? pitches[pitches.length - 1] : 1200,
      text: String(text || ''),
    };
  };

  PATCH.defaultScalaKbm = function defaultScalaKbm(scale) {
    const mapSize = Math.max(1, Number(scale && scale.noteCount) || 12);
    return {
      name: 'Default KBM',
      mapSize,
      firstMidi: 0,
      lastMidi: 127,
      middleNote: 60,
      referenceNote: 69,
      referenceFreq: PATCH.getConcertA4Hz(),
      formalOctave: mapSize,
      mapping: Array.from({ length: mapSize }, (_, index) => index),
      text: '',
      implicit: true,
    };
  };

  PATCH.parseScalaKbm = function parseScalaKbm(text, scale, fallbackName) {
    if (!text || !String(text).trim()) return PATCH.defaultScalaKbm(scale);
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
    const payload = [];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('!')) continue;
      payload.push(trimmed);
    }
    let nameLine = '';
    if (payload.length && !Number.isFinite(parseInt(payload[0], 10))) {
      nameLine = payload.shift();
    }
    if (payload.length < 7) throw new Error('Scala .kbm is incomplete');
    const mapSize = parseInt(payload[0], 10);
    const firstMidi = parseInt(payload[1], 10);
    const lastMidi = parseInt(payload[2], 10);
    const middleNote = parseInt(payload[3], 10);
    const referenceNote = parseInt(payload[4], 10);
    const referenceFreq = parseFloat(payload[5]);
    const formalOctave = parseInt(payload[6], 10);
    if (!(mapSize > 0)) throw new Error('Scala .kbm map size is invalid');
    if (!Number.isFinite(referenceFreq) || referenceFreq <= 0) throw new Error('Scala .kbm reference frequency is invalid');
    const mapping = [];
    for (let index = 0; index < mapSize; index++) {
      const raw = payload[7 + index];
      if (raw == null) {
        mapping.push(index);
        continue;
      }
      const token = raw.split(/\s+/)[0];
      mapping.push(/^[xX]$/.test(token) ? null : parseInt(token, 10));
    }
    return {
      name: String(fallbackName || nameLine || 'Keyboard Mapping').replace(/\.(kbm)$/i, ''),
      mapSize,
      firstMidi: Number.isFinite(firstMidi) ? firstMidi : 0,
      lastMidi: Number.isFinite(lastMidi) ? lastMidi : 127,
      middleNote: Number.isFinite(middleNote) ? middleNote : 60,
      referenceNote: Number.isFinite(referenceNote) ? referenceNote : 69,
      referenceFreq,
      formalOctave: formalOctave > 0 ? formalOctave : Math.max(1, Number(scale && scale.noteCount) || 12),
      mapping,
      text: String(text || ''),
      implicit: false,
    };
  };

  PATCH.scalaDegreeToCents = function scalaDegreeToCents(scale, degree, formalOctave) {
    const octaveSize = Math.max(1, formalOctave || scale.noteCount || 12);
    const periods = PATCH.floorDiv(degree, octaveSize);
    const degreeInOctave = PATCH.mod(degree, octaveSize);
    const base = periods * (Number.isFinite(scale.periodCents) ? scale.periodCents : 1200);
    if (degreeInOctave === 0) return base;
    const idx = Math.max(0, Math.min(scale.pitches.length - 1, degreeInOctave - 1));
    return base + scale.pitches[idx];
  };

  PATCH.scalaDegreeForMidi = function scalaDegreeForMidi(note, kbm) {
    if (note < kbm.firstMidi || note > kbm.lastMidi) return null;
    const relative = note - kbm.middleNote;
    const mapIndex = PATCH.mod(relative, kbm.mapSize);
    const octaveOffset = PATCH.floorDiv(relative, kbm.mapSize);
    const degree = kbm.mapping[mapIndex];
    if (!Number.isFinite(degree)) return null;
    return octaveOffset * kbm.formalOctave + degree;
  };

  PATCH.buildScalaNoteMap = function buildScalaNoteMap(scale, kbm, referenceHz) {
    const refDegree = PATCH.scalaDegreeForMidi(kbm.referenceNote, kbm);
    const fallbackRefDegree = refDegree != null ? refDegree : 0;
    const noteMap = {};
    for (let note = 0; note <= 127; note++) {
      const degree = PATCH.scalaDegreeForMidi(note, kbm);
      if (degree == null) continue;
      const relativeCents =
        PATCH.scalaDegreeToCents(scale, degree, kbm.formalOctave) -
        PATCH.scalaDegreeToCents(scale, fallbackRefDegree, kbm.formalOctave);
      const targetHz = referenceHz * Math.pow(2, relativeCents / 1200);
      const equalHz = PATCH.midiToHz(note);
      noteMap[note] = +(1200 * Math.log2(targetHz / equalHz)).toFixed(2);
    }
    return noteMap;
  };

  PATCH.deriveScalaPcCents = function deriveScalaPcCents(noteMap, rootPc) {
    const derived = Array(12).fill(0);
    for (let index = 0; index < 12; index++) {
      const midi = 60 + PATCH.mod((rootPc || 0) + index, 12);
      derived[index] = Number.isFinite(noteMap[midi]) ? noteMap[midi] : 0;
    }
    return derived;
  };

  PATCH.syncScalaUI = function syncScalaUI() {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
    PATCH.initScalaPresets();
    PATCH.ensureScalaTemperamentEntry();
    const row = document.getElementById('ctScalaRow');
    const label = document.getElementById('ctScalaStatus');
    const clearBtn = document.getElementById('ctScalaClear');
    const kbmBtn = document.getElementById('ctScalaKbmBtn');
    const presetGrid = document.getElementById('ctScalaPresetGrid');
    const favoriteGrid = document.getElementById('ctScalaFavoriteGrid');
    const favorites = PATCH.readScalaFavorites();
    const profile = CompTuningEngine.STATE.scalaProfile;
    const enabled = !!profile;
    if (row) row.style.display = '';
    if (label) {
      if (!enabled) {
        label.textContent = 'NO SCALA FILE LOADED';
      } else {
        const kbmName = profile.kbmName || 'Default KBM';
        const refText = Number.isFinite(profile.referenceFreq) ? profile.referenceFreq.toFixed(3) + ' Hz' : 'pending';
        label.textContent =
          'SCL: ' + profile.sclName +
          '  |  KBM: ' + kbmName +
          '  |  NOTES: ' + (profile.noteCount || '?') +
          '  |  REF: ' + refText;
      }
    }
    if (clearBtn) clearBtn.disabled = !enabled;
    if (kbmBtn) {
      kbmBtn.classList.toggle('on', !!(enabled && profile.kbmText));
      kbmBtn.title = enabled && profile.kbmText ? 'Custom KBM loaded' : 'Load optional .kbm keyboard mapping';
    }
    if (presetGrid) {
      const activePresetId = enabled ? (profile.presetId || '') : '';
      presetGrid.querySelectorAll('[data-scala-preset]').forEach(button => {
        button.classList.toggle('on', button.dataset.scalaPreset === activePresetId);
      });
    }
    if (favoriteGrid) {
      const activeFavorite = enabled ? (profile.favoriteSlot || '') : '';
      favoriteGrid.querySelectorAll('[data-scala-favorite]').forEach(button => {
        const slot = button.dataset.scalaFavorite;
        const entry = favorites[slot];
        button.classList.toggle('on', slot === activeFavorite);
        button.classList.toggle('empty', !entry);
        button.textContent = entry ? slot + ' ' + (entry.label || 'Saved') : slot;
        button.title = entry ? (entry.label || slot) : 'Empty favorite slot — Option/Alt+Click to save current Scala';
      });
    }
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.syncCompSectionUI = function syncCompSectionUI() {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
    const button = document.getElementById('ctSectionModBtn');
    const followButton = document.getElementById('ctSectionFollowBtn');
    const wrap = document.getElementById('ctSectionProfiles');
    const info = document.getElementById('ctSectionInfo');
    const follow = PATCH.ensureSectionPreviewFollow();
    const previewState = PATCH.previewTransportState || { playing: false, bar: 0 };
    if (button) button.classList.toggle('on', !!CompTuningEngine.STATE.sectionModEnabled);
    if (followButton) followButton.classList.toggle('on', !!follow.comp);
    const profiles = PATCH.ensureCompSectionProfiles();
    if (info) {
      info.textContent = CompTuningEngine.STATE.sectionModEnabled
        ? 'SECTION TUNING ACTIVE' + (PATCH.isCompSectionRuntimeActive() ? '' : ' / MPE BYPASS') + (follow.comp ? ' / FOLLOW BAR ' + (previewState.bar + 1) : '')
        : 'SECTION TUNING OFF';
    }
    if (!wrap) {
      PATCH.syncPatchDiagnosticsUI();
      return;
    }
    wrap.style.display = CompTuningEngine.STATE.sectionModEnabled && profiles.length ? '' : 'none';
    const scalaOptions = PATCH.getCompSectionScalaOptions();
    wrap.innerHTML = profiles.map((profile, index) =>
      '<div data-ct-section-index="' + index + '" style="border:1px solid ' + (index === (Number(PATCH.sectionLearnFocus.comp) || 0) ? 'var(--cyan)' : 'var(--border)') + ';padding:8px 10px;margin-bottom:8px;background:' + (index === (Number(PATCH.sectionLearnFocus.comp) || 0) ? 'rgba(34,211,238,.08)' : 'rgba(255,255,255,.02)') + ';cursor:pointer;">' +
        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#b7f7d1;letter-spacing:2px;margin-bottom:6px;">' +
          profile.name + ' @ BAR ' + (profile.bar + 1) + (index === (Number(PATCH.sectionLearnFocus.comp) || 0) ? '  |  LEARN TARGET' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">' +
          '<label style="font-size:8px;color:var(--text-dim);">A4</label>' +
          '<input data-ct-section-a4="' + index + '" type="range" min="415" max="466" step="0.1" value="' + Number(profile.a4Hz || 440).toFixed(1) + '" style="flex:1;min-width:120px;">' +
          '<div data-ct-section-a4-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:52px;">' + Number(profile.a4Hz || 440).toFixed(1) + ' Hz</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">' +
          '<label style="font-size:8px;color:var(--text-dim);">GLOBAL</label>' +
          '<input data-ct-section-cents="' + index + '" type="range" min="-100" max="100" step="0.5" value="' + Number(profile.globalCents || 0).toFixed(1) + '" style="flex:1;min-width:120px;">' +
          '<div data-ct-section-cents-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:48px;">' + PATCH.formatSignedCents(Number(profile.globalCents || 0)) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">' +
          '<label style="font-size:8px;color:var(--text-dim);">ROOT</label>' +
          '<input data-ct-section-root="' + index + '" type="range" min="0" max="11" step="1" value="' + PATCH.mod(profile.rootPc || 0, 12) + '" style="flex:1;min-width:120px;">' +
          '<div data-ct-section-root-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:24px;">' + (PATCH.NOTE_NAMES[PATCH.mod(profile.rootPc || 0, 12)] || 'C') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
          '<label style="font-size:8px;color:var(--text-dim);">SCALA</label>' +
          '<select data-ct-section-scala="' + index + '" class="midi-in-select" style="min-width:180px;">' +
            scalaOptions.map(option =>
              '<option value="' + option.value + '"' + (option.value === (profile.scalaSource || 'inherit') ? ' selected' : '') + '>' + option.label + '</option>'
            ).join('') +
          '</select>' +
        '</div>' +
      '</div>'
    ).join('');
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.ensureScalaTemperamentEntry = function ensureScalaTemperamentEntry() {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
    const profile = CompTuningEngine.STATE.scalaProfile;
    if (!profile) return;
    if (CompTuningEngine.TEMPERAMENTS[PATCH.SCALA_TEMPERAMENT_KEY]) return;
    const cents = Array.isArray(CompTuningEngine.STATE.customCents) && CompTuningEngine.STATE.customCents.length === 12
      ? CompTuningEngine.STATE.customCents.slice()
      : Array(12).fill(0);
    CompTuningEngine.TEMPERAMENTS[PATCH.SCALA_TEMPERAMENT_KEY] = {
      name: 'Scala Import',
      desc: profile.sclName || 'Imported Scala tuning',
      cents,
    };
    if (profile.sclName && CompTuningEngine.STATE.temperament !== PATCH.SCALA_TEMPERAMENT_KEY) {
      CompTuningEngine.STATE.temperament = PATCH.SCALA_TEMPERAMENT_KEY;
    }
  };

  PATCH.refreshScalaProfile = function refreshScalaProfile(rebuildUI = true) {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE || !CompTuningEngine.STATE.scalaProfile) return false;
    const profile = CompTuningEngine.STATE.scalaProfile;
    try {
      const scale = PATCH.parseScalaScl(profile.sclText, profile.sclName);
      const kbm = PATCH.parseScalaKbm(profile.kbmText || '', scale, profile.kbmName);
      const referenceHz = kbm.referenceFreq;
      const noteMap = PATCH.buildScalaNoteMap(scale, kbm, referenceHz);
      const derivedCents = PATCH.deriveScalaPcCents(noteMap, CompTuningEngine.STATE.rootPc);
      CompTuningEngine.TEMPERAMENTS[PATCH.SCALA_TEMPERAMENT_KEY] = {
        name: 'Scala Import',
        desc: scale.description || 'Imported Scala tuning',
        cents: derivedCents.slice(),
      };
      CompTuningEngine.STATE.scalaProfile = {
        sclName: scale.name,
        sclText: scale.text,
        kbmName: kbm.name,
        kbmText: kbm.text,
        presetId: profile.presetId || null,
        favoriteSlot: profile.favoriteSlot || null,
        noteCount: scale.noteCount,
        periodCents: scale.periodCents,
        mapSize: kbm.mapSize,
        formalOctave: kbm.formalOctave,
        referenceFreq: kbm.referenceFreq,
      };
      CompTuningEngine.STATE.customCents = derivedCents.slice();
      CompTuningEngine.STATE.temperament = PATCH.SCALA_TEMPERAMENT_KEY;
      if (typeof CompTuningEngine.disableScaleMicroSync === 'function') {
        CompTuningEngine.disableScaleMicroSync();
      } else {
        CompTuningEngine.STATE.autoScaleSync = false;
      }
      if (typeof CompTuningEngine.setGeneratedNoteCentsMap === 'function') {
        CompTuningEngine.setGeneratedNoteCentsMap(noteMap);
      }
      if (rebuildUI) {
        if (typeof CompTuningEngine.buildTemperamentButtons === 'function') CompTuningEngine.buildTemperamentButtons();
        if (typeof CompTuningEngine.buildIntervalGrid === 'function') CompTuningEngine.buildIntervalGrid();
        if (typeof CompTuningEngine.updateDisplay === 'function') CompTuningEngine.updateDisplay();
        PATCH.syncScalaUI();
        PATCH.syncConcertPitchUI();
      }
      return true;
    } catch (error) {
      console.warn('[ScalaImport]', error);
      return false;
    }
  };

  PATCH.importScalaProfile = function importScalaProfile(sclText, kbmText, sclName, kbmName, meta) {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return false;
    const extras = meta && typeof meta === 'object' ? meta : {};
    CompTuningEngine.STATE.scalaProfile = {
      sclName: sclName || 'Scala',
      sclText: String(sclText || ''),
      kbmName: kbmName || '',
      kbmText: String(kbmText || ''),
      presetId: extras.presetId || null,
      favoriteSlot: extras.favoriteSlot || null,
    };
    return PATCH.refreshScalaProfile(true);
  };

  PATCH.loadScalaPreset = function loadScalaPreset(presetId) {
    PATCH.initScalaPresets();
    const preset = PATCH.SCALA_PRESETS.find(entry => entry.id === presetId);
    if (!preset) return false;
    return PATCH.importScalaProfile(
      preset.sclText,
      preset.kbmText || '',
      preset.label + '.scl',
      preset.kbmText ? preset.label + '.kbm' : '',
      { presetId: preset.id }
    );
  };

  PATCH.saveScalaFavorite = function saveScalaFavorite(slot) {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE || !CompTuningEngine.STATE.scalaProfile) return false;
    if (!PATCH.SCALA_FAVORITE_SLOTS.includes(slot)) return false;
    const profile = CompTuningEngine.STATE.scalaProfile;
    const favorites = PATCH.readScalaFavorites();
    favorites[slot] = {
      label: profile.sclName + (profile.kbmName ? ' + ' + profile.kbmName : ''),
      sclName: profile.sclName,
      sclText: profile.sclText,
      kbmName: profile.kbmName || '',
      kbmText: profile.kbmText || '',
      presetId: profile.presetId || null,
    };
    PATCH.writeScalaFavorites(favorites);
    CompTuningEngine.STATE.scalaProfile.favoriteSlot = slot;
    PATCH.syncScalaUI();
    return true;
  };

  PATCH.clearScalaFavorite = function clearScalaFavorite(slot) {
    if (!PATCH.SCALA_FAVORITE_SLOTS.includes(slot)) return false;
    const favorites = PATCH.readScalaFavorites();
    if (!favorites[slot]) return false;
    delete favorites[slot];
    PATCH.writeScalaFavorites(favorites);
    if (typeof CompTuningEngine !== 'undefined' &&
        CompTuningEngine.STATE &&
        CompTuningEngine.STATE.scalaProfile &&
        CompTuningEngine.STATE.scalaProfile.favoriteSlot === slot) {
      CompTuningEngine.STATE.scalaProfile.favoriteSlot = null;
    }
    PATCH.syncScalaUI();
    return true;
  };

  PATCH.loadScalaFavorite = function loadScalaFavorite(slot) {
    if (!PATCH.SCALA_FAVORITE_SLOTS.includes(slot)) return false;
    const favorites = PATCH.readScalaFavorites();
    const entry = favorites[slot];
    if (!entry) return false;
    return PATCH.importScalaProfile(
      entry.sclText,
      entry.kbmText || '',
      entry.sclName || slot,
      entry.kbmName || '',
      {
        presetId: entry.presetId || null,
        favoriteSlot: slot,
      }
    );
  };

  PATCH.clearScalaProfile = function clearScalaProfile() {
    if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
    delete CompTuningEngine.TEMPERAMENTS[PATCH.SCALA_TEMPERAMENT_KEY];
    if (typeof CompTuningEngine.clearGeneratedNoteCentsMap === 'function') {
      CompTuningEngine.clearGeneratedNoteCentsMap();
    } else {
      CompTuningEngine.STATE.generatedNoteCentsMap = null;
    }
    CompTuningEngine.STATE.scalaProfile = null;
    CompTuningEngine.STATE.customCents = Array(12).fill(0);
    if (CompTuningEngine.STATE.temperament === PATCH.SCALA_TEMPERAMENT_KEY) {
      CompTuningEngine.STATE.temperament = 'Equal';
    }
    if (typeof CompTuningEngine.buildTemperamentButtons === 'function') CompTuningEngine.buildTemperamentButtons();
    if (typeof CompTuningEngine.buildIntervalGrid === 'function') CompTuningEngine.buildIntervalGrid();
    if (typeof CompTuningEngine.updateDisplay === 'function') CompTuningEngine.updateDisplay();
    PATCH.syncScalaUI();
  };

  PATCH.wrapMidiInputHandlers = function wrapMidiInputHandlers() {
    if (typeof MidiInputEngine === 'undefined' || !MidiInputEngine.STATE || !MidiInputEngine.STATE.access) return;
    for (const input of MidiInputEngine.STATE.access.inputs.values()) {
      if (!input || typeof input.onmidimessage !== 'function' || input.__meikyFixWrapped) continue;
      const originalHandler = input.onmidimessage;
      input.onmidimessage = event => {
        originalHandler(event);
        const data = event && event.data ? event.data : [];
        const status = data.length ? data[0] : 0;
        const type = status & 0xF0;
        const cc = data.length > 1 ? data[1] : 0;
        const value = data.length > 2 ? data[2] : 0;
        PATCH.pushMidiMonitorEvent(PATCH.describeMidiMessage(data));
        if (type === 0x90 && value > 0) {
          const heldChord = PATCH.getHeldMidiChord();
          if (heldChord) PATCH.maybeCaptureMidiChord(heldChord, {
            triggerType: 'noteon',
            velocity: value,
            bassNote: PATCH.getHeldMidiBassNote(),
          });
        }
        if (type === 0xB0) PATCH.handleMidiLearnCC(cc, value);
        if (type === 0x80 || (type === 0x90 && value === 0)) {
          const heldChord = PATCH.syncMidiChordFromHeldNotes();
          if (heldChord) PATCH.maybeCaptureMidiChord(heldChord, {
            triggerType: 'noteoff',
            velocity: PATCH.getHeldMidiMaxVelocity(),
            bassNote: PATCH.getHeldMidiBassNote(),
          });
        }
        PATCH.syncMidiMonitorUI();
      };
      input.__meikyFixWrapped = true;
    }
  };

  PATCH.drawCAPreviewPatched = function drawCAPreviewPatched() {
    if (typeof CellularAutomaton === 'undefined') return;
    const canvas = document.getElementById('caViz');
    if (!canvas) return;
    const rule = PATCH.getAutoCARule();
    const inst = CellularAutomaton.create({ width: 64, rule, seed: CA_PARAMS.seed, rows: 80 });
    const width = canvas.offsetWidth || 340;
    const height = 80;
    const rows = Math.min(inst.history.length, height);
    const cols = inst.width;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    const cw = width / cols;
    const rh = height / rows;
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const row = inst.history[rowIndex];
      for (let colIndex = 0; colIndex < cols; colIndex++) {
        if (!row[colIndex]) continue;
        ctx.fillStyle = 'rgba(0,229,255,0.75)';
        ctx.fillRect(
          Math.floor(colIndex * cw),
          Math.floor(rowIndex * rh),
          Math.max(1, Math.ceil(cw)),
          Math.max(1, Math.ceil(rh))
        );
      }
    }
  };

  PATCH.syncCAPreviewUI = function syncCAPreviewUI() {
    if (typeof CA_PARAMS === 'undefined') return;
    const overrideTog = document.getElementById('caOverrideTog');
    const overrideLabel = document.getElementById('caOverrideLabel');
    const manualControls = document.getElementById('caManualControls');
    const ruleSlider = document.getElementById('caRule');
    const ruleVal = document.getElementById('caRuleV');
    const ruleName = document.getElementById('caRuleName');
    if (overrideTog) overrideTog.classList.toggle('on', !!CA_PARAMS.override);
    if (overrideLabel) overrideLabel.textContent = CA_PARAMS.override ? 'MANUAL (手動指定)' : 'AUTO (ジャンル連動)';
    if (manualControls) manualControls.style.display = CA_PARAMS.override ? 'block' : 'none';
    if (ruleSlider) ruleSlider.value = CA_PARAMS.rule;
    if (ruleVal) ruleVal.textContent = String(CA_PARAMS.rule);
    if (ruleName && typeof CellularAutomaton !== 'undefined') {
      const shownRule = CA_PARAMS.override ? CA_PARAMS.rule : PATCH.getAutoCARule();
      const presetName = CellularAutomaton.PRESETS[shownRule] || '(unnamed)';
      ruleName.textContent = 'Rule ' + shownRule + ' — ' + presetName;
    }
    PATCH.drawCAPreviewPatched();
  };

  PATCH.syncAttractorUI = function syncAttractorUI() {
    if (typeof ATTRACTOR_STATE === 'undefined') return;
    const tog = document.getElementById('togAttractor');
    const controls = document.getElementById('attractorControls');
    const legacyPanel = document.getElementById('lorenzLegacyPanel');
    const typeRow = document.getElementById('atTypeRow');
    const presets = document.querySelectorAll('.at-preset-btn');
    const labels = {
      lorenz: { a: 'A (σ)', b: 'B (ρ)', c: 'C (β)', aMin: 1, aMax: 30, bMin: 1, bMax: 60, cMin: 0.1, cMax: 15 },
      rossler: { a: 'A', b: 'B', c: 'C', aMin: 0.01, aMax: 1, bMin: 0.01, bMax: 5, cMin: 1, cMax: 20 },
      thomas: { a: 'B (diss)', b: '—', c: '—', aMin: 0.05, aMax: 0.5, bMin: 0, bMax: 1, cMin: 0, cMax: 1 },
    }[ATTRACTOR_STATE.type] || {
      a: 'A (σ)', b: 'B (ρ)', c: 'C (β)', aMin: 1, aMax: 30, bMin: 1, bMax: 60, cMin: 0.1, cMax: 15,
    };

    if (tog) tog.classList.toggle('on', !!ATTRACTOR_STATE.enabled);
    if (controls) controls.style.display = ATTRACTOR_STATE.enabled ? 'block' : 'none';
    if (legacyPanel) legacyPanel.style.display = ATTRACTOR_STATE.enabled ? 'none' : '';
    if (typeRow) {
      typeRow.querySelectorAll('.at-type-btn').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.type === ATTRACTOR_STATE.type);
      });
    }
    presets.forEach(btn => {
      btn.classList.toggle('on', btn.textContent === (typeof AttractorEngine !== 'undefined' &&
        AttractorEngine.PRESETS &&
        AttractorEngine.PRESETS[ATTRACTOR_STATE.activePreset] &&
        AttractorEngine.PRESETS[ATTRACTOR_STATE.activePreset].label));
    });

    const labelA = document.getElementById('atLabelA');
    const labelB = document.getElementById('atLabelB');
    const labelC = document.getElementById('atLabelC');
    if (labelA) labelA.textContent = labels.a;
    if (labelB) labelB.textContent = labels.b;
    if (labelC) labelC.textContent = labels.c;

    const paramA = document.getElementById('atParamA');
    const paramB = document.getElementById('atParamB');
    const paramC = document.getElementById('atParamC');
    const paramAV = document.getElementById('atParamAV');
    const paramBV = document.getElementById('atParamBV');
    const paramCV = document.getElementById('atParamCV');
    if (paramA) { paramA.min = labels.aMin; paramA.max = labels.aMax; paramA.value = ATTRACTOR_STATE.a; }
    if (paramB) { paramB.min = labels.bMin; paramB.max = labels.bMax; paramB.value = ATTRACTOR_STATE.b; }
    if (paramC) { paramC.min = labels.cMin; paramC.max = labels.cMax; paramC.value = ATTRACTOR_STATE.c; }
    if (paramAV) paramAV.textContent = parseFloat(ATTRACTOR_STATE.a).toFixed(2);
    if (paramBV) paramBV.textContent = parseFloat(ATTRACTOR_STATE.b).toFixed(2);
    if (paramCV) paramCV.textContent = parseFloat(ATTRACTOR_STATE.c).toFixed(2);
    if (paramB && paramB.parentElement) paramB.parentElement.style.opacity = ATTRACTOR_STATE.type === 'thomas' ? '0.35' : '1';
    if (paramC && paramC.parentElement) paramC.parentElement.style.opacity = ATTRACTOR_STATE.type === 'thomas' ? '0.35' : '1';

    const dt = document.getElementById('atDt');
    const dtV = document.getElementById('atDtV');
    const warmup = document.getElementById('atWarmup');
    const warmupV = document.getElementById('atWarmupV');
    if (dt) dt.value = Math.round(ATTRACTOR_STATE.dt * 1000);
    if (dtV) dtV.textContent = Number(ATTRACTOR_STATE.dt).toFixed(3);
    if (warmup) warmup.value = ATTRACTOR_STATE.warmup;
    if (warmupV) warmupV.textContent = String(ATTRACTOR_STATE.warmup);

    ['X', 'Y', 'Z'].forEach(axis => {
      const mapEl = document.getElementById('atMap' + axis);
      const scaleEl = document.getElementById('atScale' + axis);
      const scaleValueEl = document.getElementById('atScale' + axis + 'V');
      const mapKey = 'map' + axis;
      const scaleKey = 'scale' + axis;
      if (mapEl && ATTRACTOR_STATE[mapKey] != null) mapEl.value = ATTRACTOR_STATE[mapKey];
      if (scaleEl && ATTRACTOR_STATE[scaleKey] != null) scaleEl.value = ATTRACTOR_STATE[scaleKey];
      if (scaleValueEl && ATTRACTOR_STATE[scaleKey] != null) scaleValueEl.textContent = ATTRACTOR_STATE[scaleKey] + '%';
    });

    const canvas = document.getElementById('atCanvas');
    if (canvas && typeof AttractorEngine !== 'undefined') {
      setTimeout(() => {
        canvas.width = canvas.offsetWidth || 400;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const inst = AttractorEngine.create(ATTRACTOR_STATE.type, {
          a: ATTRACTOR_STATE.a,
          b: ATTRACTOR_STATE.b,
          c: ATTRACTOR_STATE.c,
          dt: ATTRACTOR_STATE.dt,
        });
        inst.stepN(Math.min(ATTRACTOR_STATE.warmup, 500));
        const points = [];
        for (let index = 0; index < 600; index++) {
          inst.step();
          points.push({ ...inst.state });
        }
        const xs = points.map(point => point.x);
        const ys = points.map(point => point.y);
        const zs = points.map(point => point.z);
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const yMin = Math.min(...ys), yMax = Math.max(...ys);
        const zMin = Math.min(...zs), zMax = Math.max(...zs);
        const mx = xMax === xMin ? 1 : xMax - xMin;
        const my = yMax === yMin ? 1 : yMax - yMin;
        const mz = zMax === zMin ? 1 : zMax - zMin;
        const pad = 10;
        const width = canvas.width - pad * 2;
        const height = canvas.height - pad * 2;
        const colors = { lorenz: '#ffcc00', rossler: '#ff6b35', thomas: '#1de9b6' };
        const baseColor = colors[ATTRACTOR_STATE.type] || '#ffcc00';
        ctx.lineWidth = 0.8;
        for (let index = 1; index < points.length; index++) {
          const prev = points[index - 1];
          const next = points[index];
          const px = pad + (prev.x - xMin) / mx * width;
          const py = pad + (1 - (prev.y - yMin) / my) * height;
          const nx = pad + (next.x - xMin) / mx * width;
          const ny = pad + (1 - (next.y - yMin) / my) * height;
          const alpha = 0.15 + 0.55 * (next.z - zMin) / mz;
          ctx.strokeStyle = baseColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
        }
      }, 0);
    }
  };

  PATCH.drawJustIntonationPatched = function drawJustIntonationPatched() {
    if (typeof JustIntonation === 'undefined' || typeof JI_PARAMS === 'undefined') return;
    const canvas = document.getElementById('jiDeviationCanvas');
    const info = document.getElementById('jiInfo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 300;
    canvas.height = 72;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!JI_PARAMS.enabled || typeof S === 'undefined' || !S || !S.chord) {
      ctx.fillStyle = 'rgba(0,230,118,0.08)';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const root = S.chord.root;
    const rows = JustIntonation.getDeviationTable(root, JI_PARAMS);
    const chordPcs = S.chord.iv.map(iv => ((S.chord.root + iv) % 12 + 12) % 12);
    const barWidth = width / 12;
    const maxDeviation = 50;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(0,230,118,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    rows.forEach((row, index) => {
      const x = index * barWidth;
      const deviation = Math.max(-maxDeviation, Math.min(maxDeviation, row.deviation));
      const barHeight = Math.abs(deviation) / maxDeviation * (height / 2 - 4);
      const y = deviation >= 0 ? height / 2 - barHeight : height / 2;
      const isChordTone = chordPcs.includes(row.pc);
      ctx.fillStyle = isChordTone ? 'rgba(0,230,118,0.75)' : 'rgba(0,180,100,0.35)';
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      ctx.fillStyle = isChordTone ? '#00e676' : 'rgba(0,230,118,0.55)';
      ctx.font = '7px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(row.name, x + barWidth / 2, height - 2);
    });

    if (info) {
      const consonance = JustIntonation.consonanceScore(chordPcs, root, JI_PARAMS);
      info.textContent = 'MODE: ' + JI_PARAMS.mode.toUpperCase()
        + '  BLEND: ' + Math.round(JI_PARAMS.blend * 100) + '%'
        + '  CONSONANCE: ' + (consonance * 100).toFixed(1) + '%'
        + (JI_PARAMS.adaptiveMemoryEnabled
          ? '  MEMORY: ' + Math.round((JI_PARAMS.adaptiveMemoryStrength || 0) * 100) + '%'
            + '  OFFSET: ' + PATCH.formatSignedCents(PATCH.jiAdaptiveMemory ? PATCH.jiAdaptiveMemory.lastOffsetCents : 0)
          : '');
    }
  };

  PATCH.syncJustIntonationUI = function syncJustIntonationUI() {
    if (typeof JI_PARAMS === 'undefined') return;
    const tog = document.getElementById('togJI');
    const modeRow = document.getElementById('jiModeRow');
    const blendEl = document.getElementById('jiBlend');
    const blendValue = document.getElementById('jiBlendV');
    const harmonicRow = document.getElementById('jiHarmonicRow');
    const harmonicEl = document.getElementById('jiHarmonicLimit');
    const harmonicValue = document.getElementById('jiHarmonicLimitV');
    const adaptiveBtn = document.getElementById('jiAdaptiveMemoryBtn');
    const adaptiveStrength = document.getElementById('jiAdaptiveMemoryStrength');
    const adaptiveStrengthValue = document.getElementById('jiAdaptiveMemoryStrengthV');
    const adaptiveBassBias = document.getElementById('jiAdaptiveBassBias');
    const adaptiveBassBiasValue = document.getElementById('jiAdaptiveBassBiasV');
    const adaptiveVoiceLeading = document.getElementById('jiAdaptiveVoiceLeading');
    const adaptiveVoiceLeadingValue = document.getElementById('jiAdaptiveVoiceLeadingV');
    const adaptiveCadenceBtn = document.getElementById('jiAdaptiveCadenceBtn');
    const adaptiveCadenceStrength = document.getElementById('jiAdaptiveCadenceStrength');
    const adaptiveCadenceStrengthValue = document.getElementById('jiAdaptiveCadenceStrengthV');
    const adaptiveSectionBtn = document.getElementById('jiAdaptiveSectionBtn');
    const sectionModBtn = document.getElementById('jiSectionModBtn');
    const sectionFollowBtn = document.getElementById('jiSectionFollowBtn');
    const sectionWrap = document.getElementById('jiSectionProfiles');
    const adaptiveInfo = document.getElementById('jiAdaptiveMemoryInfo');
    const follow = PATCH.ensureSectionPreviewFollow();
    const previewState = PATCH.previewTransportState || { bar: 0 };
    if (tog) tog.classList.toggle('on', !!JI_PARAMS.enabled);
    if (modeRow) {
      modeRow.querySelectorAll('.ji-mode-btn').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.mode === JI_PARAMS.mode);
      });
    }
    if (blendEl) blendEl.value = Math.round(JI_PARAMS.blend * 100);
    if (blendValue) blendValue.textContent = Math.round(JI_PARAMS.blend * 100) + '%';
    if (harmonicRow) {
      harmonicRow.style.display = (JI_PARAMS.mode === 'harmonic' || JI_PARAMS.mode === 'utonal') ? 'flex' : 'none';
    }
    if (harmonicEl) harmonicEl.value = JI_PARAMS.harmonicLimit;
    if (harmonicValue) harmonicValue.textContent = String(JI_PARAMS.harmonicLimit);
    if (adaptiveBtn) adaptiveBtn.classList.toggle('on', !!JI_PARAMS.adaptiveMemoryEnabled);
    if (adaptiveStrength) adaptiveStrength.value = Math.round((Number(JI_PARAMS.adaptiveMemoryStrength) || 0) * 100);
    if (adaptiveStrengthValue) adaptiveStrengthValue.textContent = Math.round((Number(JI_PARAMS.adaptiveMemoryStrength) || 0) * 100) + '%';
    if (adaptiveBassBias) adaptiveBassBias.value = Math.round((Number(JI_PARAMS.adaptiveBassAnchorStrength) || 0) * 100);
    if (adaptiveBassBiasValue) adaptiveBassBiasValue.textContent = Math.round((Number(JI_PARAMS.adaptiveBassAnchorStrength) || 0) * 100) + '%';
    if (adaptiveVoiceLeading) adaptiveVoiceLeading.value = Math.round((Number(JI_PARAMS.adaptiveVoiceLeadingStrength) || 0) * 100);
    if (adaptiveVoiceLeadingValue) adaptiveVoiceLeadingValue.textContent = Math.round((Number(JI_PARAMS.adaptiveVoiceLeadingStrength) || 0) * 100) + '%';
    if (adaptiveCadenceBtn) adaptiveCadenceBtn.classList.toggle('on', !!JI_PARAMS.adaptiveCadenceResetEnabled);
    if (adaptiveCadenceStrength) adaptiveCadenceStrength.value = Math.round((Number(JI_PARAMS.adaptiveCadenceResetStrength) || 0) * 100);
    if (adaptiveCadenceStrengthValue) adaptiveCadenceStrengthValue.textContent = Math.round((Number(JI_PARAMS.adaptiveCadenceResetStrength) || 0) * 100) + '%';
    if (adaptiveSectionBtn) adaptiveSectionBtn.classList.toggle('on', !!JI_PARAMS.adaptiveResetOnSection);
    if (sectionModBtn) sectionModBtn.classList.toggle('on', !!JI_PARAMS.sectionModEnabled);
    if (sectionFollowBtn) sectionFollowBtn.classList.toggle('on', !!follow.ji);
    if (adaptiveInfo) {
      adaptiveInfo.textContent = JI_PARAMS.adaptiveMemoryEnabled
        ? 'COMMON-TONE DRIFT: ' + PATCH.formatSignedCents(PATCH.jiAdaptiveMemory ? PATCH.jiAdaptiveMemory.lastOffsetCents : 0)
          + '  |  COMMON PCS: ' + (PATCH.jiAdaptiveMemory ? PATCH.jiAdaptiveMemory.lastCommonCount : 0)
          + '  |  BASS BIAS: ' + Math.round((Number(JI_PARAMS.adaptiveBassAnchorStrength) || 0) * 100) + '%'
          + '  |  VL: ' + Math.round((Number(JI_PARAMS.adaptiveVoiceLeadingStrength) || 0) * 100) + '%'
          + '  |  CADENCE: ' + (JI_PARAMS.adaptiveCadenceResetEnabled
              ? ((PATCH.jiAdaptiveMemory && PATCH.jiAdaptiveMemory.lastCadenceType) || 'ARMED')
              : 'OFF')
          + '  |  SECTION RESET: ' + (JI_PARAMS.adaptiveResetOnSection ? 'ON' : 'OFF')
          + '  |  FOLLOW: ' + (follow.ji ? ('BAR ' + (previewState.bar + 1)) : 'MANUAL')
        : 'ADAPTIVE MEMORY OFF';
    }
    if (sectionWrap) {
      const profiles = PATCH.ensureJiSectionProfiles();
      sectionWrap.style.display = JI_PARAMS.sectionModEnabled && profiles.length ? '' : 'none';
      sectionWrap.innerHTML = profiles.map((profile, index) =>
        '<div data-ji-section-index="' + index + '" style="border:1px solid ' + (index === (Number(PATCH.sectionLearnFocus.ji) || 0) ? 'var(--cyan)' : 'var(--border)') + ';padding:8px 10px;margin-bottom:8px;background:' + (index === (Number(PATCH.sectionLearnFocus.ji) || 0) ? 'rgba(34,211,238,.08)' : 'rgba(255,255,255,.02)') + ';cursor:pointer;">' +
          '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#b7f7d1;letter-spacing:2px;margin-bottom:6px;">' +
            profile.name + ' @ BAR ' + (profile.bar + 1) + (index === (Number(PATCH.sectionLearnFocus.ji) || 0) ? '  |  LEARN TARGET' : '') +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">' +
            '<label style="font-size:8px;color:var(--text-dim);">MODE</label>' +
            '<select data-ji-section-mode="' + index + '" class="midi-in-select" style="min-width:110px;">' +
              ['limit5','limit7','limit11','harmonic','utonal'].map(mode =>
                '<option value="' + mode + '"' + (mode === profile.mode ? ' selected' : '') + '>' + mode.toUpperCase() + '</option>'
              ).join('') +
            '</select>' +
            '<label style="font-size:8px;color:var(--text-dim);">BLEND</label>' +
            '<input data-ji-section-blend="' + index + '" type="range" min="0" max="100" step="1" value="' + Math.round((profile.blend || 0) * 100) + '" style="flex:1;min-width:120px;">' +
            '<div data-ji-section-blend-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:36px;">' + Math.round((profile.blend || 0) * 100) + '%</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
            '<label style="font-size:8px;color:var(--text-dim);">HARMONIC LIMIT</label>' +
            '<input data-ji-section-harmonic="' + index + '" type="range" min="2" max="32" step="1" value="' + (profile.harmonicLimit || 16) + '" style="flex:1;min-width:120px;">' +
            '<div data-ji-section-harmonic-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:24px;">' + (profile.harmonicLimit || 16) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;">' +
            '<label style="font-size:8px;color:var(--text-dim);">BASS BIAS</label>' +
            '<input data-ji-section-bass="' + index + '" type="range" min="0" max="100" step="1" value="' + Math.round((profile.adaptiveBassAnchorStrength || 0) * 100) + '" style="flex:1;min-width:120px;">' +
            '<div data-ji-section-bass-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:36px;">' + Math.round((profile.adaptiveBassAnchorStrength || 0) * 100) + '%</div>' +
            '<label style="font-size:8px;color:var(--text-dim);">VL</label>' +
            '<input data-ji-section-vl="' + index + '" type="range" min="0" max="100" step="1" value="' + Math.round((profile.adaptiveVoiceLeadingStrength || 0) * 100) + '" style="flex:1;min-width:120px;">' +
            '<div data-ji-section-vl-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:36px;">' + Math.round((profile.adaptiveVoiceLeadingStrength || 0) * 100) + '%</div>' +
            '<button class="midi-in-btn' + (profile.adaptiveCadenceResetEnabled ? ' on' : '') + '" data-ji-section-cadence-btn="' + index + '" type="button">CADENCE</button>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;">' +
            '<label style="font-size:8px;color:var(--text-dim);">CAD STR</label>' +
            '<input data-ji-section-cadence="' + index + '" type="range" min="0" max="100" step="1" value="' + Math.round((profile.adaptiveCadenceResetStrength || 0) * 100) + '" style="flex:1;min-width:120px;">' +
            '<div data-ji-section-cadence-v="' + index + '" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--cyan);min-width:36px;">' + Math.round((profile.adaptiveCadenceResetStrength || 0) * 100) + '%</div>' +
          '</div>' +
        '</div>'
      ).join('');
    }
    PATCH.drawJustIntonationPatched();
    PATCH.syncPatchDiagnosticsUI();
  };

  PATCH.drawRhythmicCanonsPatched = function drawRhythmicCanonsPatched() {
    if (typeof RhythmicCanons === 'undefined' || typeof RC_PARAMS === 'undefined') return;
    const canvas = document.getElementById('rcPatternCanvas');
    const info = document.getElementById('rcInfo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 320;
    canvas.height = 56;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0d0600';
    ctx.fillRect(0, 0, width, height);
    if (!RC_PARAMS.enabled) {
      ctx.fillStyle = 'rgba(255,109,0,0.08)';
      ctx.fillRect(0, 0, width, height);
      if (info) info.textContent = 'RHYTHMIC CANONS — 無効';
      return;
    }

    const patternInfo = RhythmicCanons.getPatternInfo(RC_PARAMS);
    const n = patternInfo.n;
    const cellWidth = width / n;
    const rowHeight = patternInfo.voices.length > 0 ? Math.floor((height - 8) / patternInfo.voices.length) : height - 8;
    patternInfo.voices.forEach((voice, voiceIndex) => {
      const y = 4 + voiceIndex * rowHeight;
      voice.binary.forEach((bit, index) => {
        ctx.fillStyle = bit
          ? (voiceIndex === 0 ? 'rgba(255,109,0,0.85)' : 'rgba(255,145,0,0.65)')
          : 'rgba(255,109,0,0.06)';
        ctx.fillRect(index * cellWidth + 1, y, cellWidth - 2, rowHeight - 2);
      });
      ctx.fillStyle = voiceIndex === 0 ? '#ff6d00' : '#ff9100';
      ctx.font = '7px Share Tech Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(voice.label + '  density:' + (voice.density * 100).toFixed(0) + '%', 2, y + rowHeight - 3);
    });
    if (info) info.textContent = 'MODE: ' + RC_PARAMS.mode.toUpperCase() + '  n=' + n;
  };

  PATCH.rebuildRhythmicCanonPresets = function rebuildRhythmicCanonPresets() {
    if (typeof RhythmicCanons === 'undefined' || typeof RC_PARAMS === 'undefined') return;
    const presetsEl = document.getElementById('rcPresets');
    const presetWrap = document.getElementById('rcPresetWrap');
    const presetN = document.getElementById('rcPresetN');
    if (!presetsEl || !presetWrap) return;

    const isVuza = RC_PARAMS.mode === 'vuza' || RC_PARAMS.mode === 'tiling';
    presetWrap.style.display = isVuza ? '' : 'none';
    presetsEl.innerHTML = '';
    if (!isVuza) return;

    if (presetN) presetN.textContent = String(RC_PARAMS.n);
    const presets = RhythmicCanons.getPresets(RC_PARAMS.n);
    presets.forEach((preset, index) => {
      const btn = document.createElement('div');
      btn.className = 'rc-preset-btn' + (RC_PARAMS.presetIndex === index ? ' on' : '');
      btn.textContent = 'P' + (index + 1) + ': [' + preset.A + ']';
      btn.title = preset.label;
      btn.addEventListener('click', () => {
        RC_PARAMS.presetIndex = index;
        PATCH.rebuildRhythmicCanonPresets();
        PATCH.drawRhythmicCanonsPatched();
      });
      presetsEl.appendChild(btn);
    });
  };

  PATCH.syncRhythmicCanonsUI = function syncRhythmicCanonsUI() {
    if (typeof RC_PARAMS === 'undefined') return;
    const tog = document.getElementById('togRC');
    const modeRow = document.getElementById('rcModeRow');
    const presetWrap = document.getElementById('rcPresetWrap');
    const presetN = document.getElementById('rcPresetN');
    const nEl = document.getElementById('rcN');
    const nValue = document.getElementById('rcNV');
    const voicesEl = document.getElementById('rcVoices');
    const voicesValue = document.getElementById('rcVoicesV');
    const messiaenRow = document.getElementById('rcMessiaenRow');
    const messiaenEl = document.getElementById('rcMessiaenPattern');
    const polymeterRow = document.getElementById('rcPolymeterRow');
    const polymeterEl = document.getElementById('rcPolymeterCycles');
    if (tog) tog.classList.toggle('on', !!RC_PARAMS.enabled);
    if (modeRow) {
      modeRow.querySelectorAll('.rc-mode-btn').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.mode === RC_PARAMS.mode);
      });
    }
    PATCH.rebuildRhythmicCanonPresets();
    if (presetWrap) presetWrap.style.display = (RC_PARAMS.mode === 'vuza' || RC_PARAMS.mode === 'tiling') ? '' : 'none';
    if (presetN) presetN.textContent = String(RC_PARAMS.n);
    if (nEl) nEl.value = RC_PARAMS.n;
    if (nValue) nValue.textContent = String(RC_PARAMS.n);
    if (voicesEl) voicesEl.value = RC_PARAMS.voices;
    if (voicesValue) voicesValue.textContent = String(RC_PARAMS.voices);
    if (messiaenRow) messiaenRow.style.display = RC_PARAMS.mode === 'messiaen' ? 'block' : 'none';
    if (messiaenEl) messiaenEl.value = (RC_PARAMS.messiaenPattern || []).join(',');
    if (polymeterRow) polymeterRow.style.display = RC_PARAMS.mode === 'polymeter' ? 'block' : 'none';
    if (polymeterEl) polymeterEl.value = (RC_PARAMS.polymeterCycles || []).join(',');
    PATCH.drawRhythmicCanonsPatched();
  };

  PATCH.syncConductorVizUI = function syncConductorVizUI() {
    if (typeof CONDUCTOR_VIZ_STATE === 'undefined') return;
    const hasState = typeof S !== 'undefined' && !!S;
    const tog = document.getElementById('togCV');
    const editBtn = document.getElementById('cvEditBtn');
    const info = document.getElementById('cvInfo');
    const canvas = document.getElementById('conductorVizCanvas');
    if (tog) tog.classList.toggle('on', !!CONDUCTOR_VIZ_STATE.enabled);
    if (editBtn) editBtn.classList.toggle('on', !!CONDUCTOR_VIZ_STATE.editMode);
    if (info) {
      if (!CONDUCTOR_VIZ_STATE.enabled) info.textContent = 'CONDUCTOR VIZ — 無効';
      else if (CONDUCTOR_VIZ_STATE.editMode) info.textContent = 'EDIT MODE — クリック&ドラッグでテンションを編集';
      else if (CONDUCTOR_VIZ_STATE.editedCurve) info.textContent = '手動編集済み — 次回 GENERATE に適用されます';
      else info.textContent = 'CONDUCTOR VIZ — 有効 (次回 GENERATE 後に更新)';
    }
    if (canvas && typeof ConductorViz !== 'undefined') {
      let displayData = null;
      if (CONDUCTOR_VIZ_STATE.editedCurve && typeof ConductorViz.buildDisplayData === 'function') {
        const curve = CONDUCTOR_VIZ_STATE.editedCurve;
        const totalBars = curve.length || PATCH.getTotalBarsForUI();
        const sections = typeof detectSections === 'function' ? detectSections(curve) : [];
        displayData = ConductorViz.buildDisplayData(
          hasState && S.bpm ? S.bpm : 60,
          totalBars,
          curve,
          !!(hasState && S.engines && S.engines.macro && S.macroEnabled && S.tempoModEnabled),
          hasState && Number.isFinite(S.tempoDrift) ? S.tempoDrift : 0,
          sections
        );
        ConductorViz.draw(canvas, displayData);
      } else {
        ConductorViz.draw(canvas, null);
      }

      if (CONDUCTOR_VIZ_STATE.editMode &&
          displayData &&
          typeof ConductorViz.bindEditInteraction === 'function') {
        const parent = canvas.parentNode;
        if (parent) {
          const clone = canvas.cloneNode(true);
          parent.replaceChild(clone, canvas);
          ConductorViz.draw(clone, displayData);
          ConductorViz.bindEditInteraction(clone, displayData, null);
        }
      }
    }
  };

  window.__MEIKY_PATCH__ = PATCH;
})();
