const MidiInputEngine = (() => {
  'use strict';

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const STATE = {
    enabled: false,
    ccMapEnabled: true,
    access: null,
    selectedInputId: '',
    activeNotes: new Map(),
    lastChordKey: '',
    lastStatus: 'WEB MIDI: OFF',
  };

  const CC_MAP = {
    1:  { key: 'density',    label: 'DENSITY',   min: 0, max: 100, valueId: 'densityV',    format: value => value + '%' },
    7:  { key: 'velocity',   label: 'VELOCITY',  min: 1, max: 127, valueId: 'velocityV',   format: value => '' + value },
    71: { key: 'dissonance', label: 'DISSONANCE',min: 0, max: 100, valueId: 'dissonanceV', format: value => value + '%' },
    74: { key: 'humanize',   label: 'HUMANIZE',  min: 0, max: 100, valueId: 'humanizeV',   format: value => value + '%' },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function midiToUiRange(value, min, max) {
    return clamp(Math.round(min + (value / 127) * (max - min)), min, max);
  }

  function updateStatus(text, detail) {
    STATE.lastStatus = text;
    const el = document.getElementById('midiInStatus');
    if (!el) return;
    el.innerHTML = detail ? text + '<br>' + detail : text;
  }

  function updateHeldNotesDisplay() {
    const el = document.getElementById('midiInNotes');
    if (!el) return;
    const notes = [...STATE.activeNotes.keys()].sort((a, b) => a - b);
    if (!notes.length) {
      el.textContent = 'HELD: —';
      return;
    }
    el.textContent = 'HELD: ' + notes.map(note => NOTE_NAMES[note % 12] + Math.floor(note / 12 - 1)).join('  ');
  }

  function getInputList() {
    if (!STATE.access) return [];
    return [...STATE.access.inputs.values()];
  }

  function refreshInputSelect() {
    const sel = document.getElementById('midiInSelect');
    if (!sel) return;
    const inputs = getInputList();
    sel.innerHTML = '<option value="">NO INPUT</option>' + inputs.map(input => {
      const selected = input.id === STATE.selectedInputId ? ' selected' : '';
      return `<option value="${input.id}"${selected}>${input.name || input.manufacturer || input.id}</option>`;
    }).join('');
  }

  function chordFromPitchClasses(pitchClasses) {
    const pcs = [...new Set(pitchClasses.map(pc => ((pc % 12) + 12) % 12))].sort((a, b) => a - b);
    if (pcs.length < 3 || typeof CHORDS === 'undefined') return null;

    const uniqueQualities = [];
    for (const [quality, entry] of Object.entries(CHORDS)) {
      const signature = [...new Set(entry.iv.map(interval => ((interval % 12) + 12) % 12))].sort((a, b) => a - b).join(',');
      if (uniqueQualities.some(item => item.signature === signature)) continue;
      uniqueQualities.push({ quality, entry, signature });
    }
    uniqueQualities.sort((a, b) => b.entry.iv.length - a.entry.iv.length || a.quality.length - b.quality.length);

    for (let root = 0; root < 12; root++) {
      for (const candidate of uniqueQualities) {
        const chordPcs = [...new Set(candidate.entry.iv.map(interval => (root + interval) % 12))].sort((a, b) => a - b);
        if (chordPcs.length !== pcs.length) continue;
        if (chordPcs.every((pc, index) => pc === pcs[index])) {
          return {
            root,
            rootName: NOTE_NAMES[root],
            quality: candidate.quality,
            iv: candidate.entry.iv.slice(),
            name: candidate.entry.name,
          };
        }
      }
    }
    return null;
  }

  function applyRecognizedChord(chord) {
    if (!chord) return false;
    const chordKey = chord.root + ':' + chord.quality + ':' + chord.iv.join(',');
    if (STATE.lastChordKey === chordKey) return true;
    STATE.lastChordKey = chordKey;
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
    return true;
  }

  function applyCC(cc, value) {
    const mapping = CC_MAP[cc];
    if (!mapping) return;
    const uiValue = midiToUiRange(value, mapping.min, mapping.max);
    S[mapping.key] = uiValue;
    const slider = document.getElementById(mapping.key);
    if (slider) slider.value = uiValue;
    const valueEl = document.getElementById(mapping.valueId);
    if (valueEl) valueEl.textContent = mapping.format(uiValue);
    if (mapping.key === 'dissonance' && typeof updateGateIndicator === 'function') updateGateIndicator();
    updateStatus('WEB MIDI: CC MAP ACTIVE', `CC${cc} → ${mapping.label} = ${uiValue}`);
  }

  function handleMidiMessage(event) {
    const data = event.data || [];
    if (data.length < 2) return;
    const statusByte = data[0];
    const type = statusByte & 0xF0;
    const note = data[1];
    const value = data[2] || 0;

    if (type === 0x90 && value > 0) {
      STATE.activeNotes.set(note, value);
      updateHeldNotesDisplay();
      const chord = chordFromPitchClasses([...STATE.activeNotes.keys()].map(activeNote => activeNote % 12));
      if (chord) {
        updateStatus('WEB MIDI: NOTE INPUT ACTIVE', 'Detected chord from held notes');
        applyRecognizedChord(chord);
      } else {
        updateStatus('WEB MIDI: NOTE INPUT ACTIVE', 'Held notes do not match a known chord set yet');
      }
      return;
    }

    if (type === 0x80 || (type === 0x90 && value === 0)) {
      STATE.activeNotes.delete(note);
      updateHeldNotesDisplay();
      if (!STATE.activeNotes.size) updateStatus(STATE.lastStatus, 'Input idle');
      return;
    }

    if (type === 0xB0 && STATE.ccMapEnabled) {
      applyCC(note, value);
    }
  }

  function bindSelectedInput() {
    if (!STATE.access) return;
    getInputList().forEach(input => { input.onmidimessage = null; });
    const input = STATE.access.inputs.get(STATE.selectedInputId);
    if (!input) {
      updateStatus('WEB MIDI: NO INPUT SELECTED', 'Choose a MIDI device to receive notes / CC');
      return;
    }
    input.onmidimessage = handleMidiMessage;
    updateStatus('WEB MIDI: ' + (input.name || 'INPUT ACTIVE'), 'Receiving note / CC data');
  }

  async function enable() {
    if (!navigator.requestMIDIAccess) {
      updateStatus('WEB MIDI: UNSUPPORTED', 'This browser does not expose navigator.requestMIDIAccess()');
      return false;
    }
    STATE.access = await navigator.requestMIDIAccess();
    STATE.enabled = true;
    STATE.access.onstatechange = () => {
      refreshInputSelect();
      if (!STATE.access.inputs.has(STATE.selectedInputId)) {
        const first = getInputList()[0];
        STATE.selectedInputId = first ? first.id : '';
      }
      bindSelectedInput();
    };
    const first = getInputList()[0];
    if (!STATE.selectedInputId && first) STATE.selectedInputId = first.id;
    refreshInputSelect();
    bindSelectedInput();
    return true;
  }

  function disable() {
    STATE.enabled = false;
    STATE.activeNotes.clear();
    STATE.lastChordKey = '';
    getInputList().forEach(input => { input.onmidimessage = null; });
    updateHeldNotesDisplay();
    updateStatus('WEB MIDI: OFF');
  }

  function initUI() {
    const tog = document.getElementById('togMidiIn');
    const controls = document.getElementById('midiInControls');
    const refreshBtn = document.getElementById('midiInRefreshBtn');
    const select = document.getElementById('midiInSelect');
    const ccTog = document.getElementById('togMidiCCMap');
    if (!tog || !controls || !refreshBtn || !select || !ccTog) return;

    tog.addEventListener('click', async () => {
      if (!STATE.enabled) {
        const ok = await enable();
        tog.classList.toggle('on', !!ok);
        controls.style.display = ok ? 'block' : 'none';
      } else {
        disable();
        tog.classList.remove('on');
        controls.style.display = 'none';
      }
    });

    refreshBtn.addEventListener('click', async () => {
      if (!STATE.enabled) {
        await enable();
        tog.classList.add('on');
        controls.style.display = 'block';
      } else {
        refreshInputSelect();
        bindSelectedInput();
      }
    });

    select.addEventListener('change', () => {
      STATE.selectedInputId = select.value;
      bindSelectedInput();
    });

    ccTog.addEventListener('click', () => {
      STATE.ccMapEnabled = !STATE.ccMapEnabled;
      ccTog.classList.toggle('on', STATE.ccMapEnabled);
      updateStatus('WEB MIDI: ' + (STATE.ccMapEnabled ? 'CC MAP ON' : 'CC MAP OFF'));
    });

    updateHeldNotesDisplay();
    updateStatus('WEB MIDI: OFF');
  }

  return {
    STATE,
    initUI,
    enable,
    disable,
    chordFromPitchClasses,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof MidiInputEngine !== 'undefined') MidiInputEngine.initUI();
});
