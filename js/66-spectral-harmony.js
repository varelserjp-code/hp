/* ═══════════════════════════════════════════════════
   v25.7: SPECTRAL HARMONY ENGINE
   Harmonic Series → Overtone Chord Voicing
   ─────────────────────────────────────────────────
   倍音列を MIDI ノート群へ写像し、Overtone レイヤーで
   使いやすいボイシングへ整形する。

   SpectralHarmonyEngine.overtoneChord(fundHz, indices, tuningA4, opts)
     → { voices, notes, sourceIndices, spread }

   SpectralHarmonyEngine.partialSpread(chord, spread, minMidi, maxMidi)
     → voice[]
═══════════════════════════════════════════════════ */
const SpectralHarmonyEngine = (() => {
  'use strict';

  function clampMidi(note, minMidi = 12, maxMidi = 115) {
    return Math.max(minMidi, Math.min(maxMidi, Math.round(note)));
  }

  function normalizePc(pc) {
    return ((pc % 12) + 12) % 12;
  }

  function midiToFreq(noteMidi, tuningA4 = 440.0) {
    return tuningA4 * Math.pow(2, (noteMidi - 69) / 12);
  }

  function freqToMidiFloat(freqHz, tuningA4 = 440.0) {
    return 69 + 12 * Math.log2(Math.max(freqHz, 0.000001) / tuningA4);
  }

  function partialSpread(chord, spread = 0.5, minMidi = 12, maxMidi = 115) {
    const voices = (Array.isArray(chord) ? chord : [])
      .map(voice => typeof voice === 'number' ? { note: voice } : { ...voice })
      .filter(voice => Number.isFinite(voice.note))
      .sort((a, b) => a.note - b.note);
    if (!voices.length) return [];

    const normalizedSpread = Math.max(0, Math.min(1, Number(spread) || 0));
    const baseGap = 2 + Math.round(normalizedSpread * 5);
    const octaveLift = Math.round(normalizedSpread * 2);
    const out = [];

    for (let index = 0; index < voices.length; index++) {
      const voice = { ...voices[index] };
      let note = clampMidi(voice.note, minMidi, maxMidi);
      if (index > 0) {
        const targetMin = out[index - 1].note + baseGap;
        while (note < targetMin) note += 12;
        if (octaveLift > 0) {
          note += 12 * Math.floor((index * octaveLift) / Math.max(1, voices.length - 1));
        }
        while (note > maxMidi && note - 12 >= targetMin) note -= 12;
        if (note < targetMin) note = targetMin;
      }
      voice.note = clampMidi(note, minMidi, maxMidi);
      out.push(voice);
    }

    return out;
  }

  function overtoneChord(fundHz, indices, tuningA4 = 440.0, opts = {}) {
    const options = opts || {};
    const rootMidi = Number.isFinite(options.rootMidi) ? options.rootMidi : 48;
    const chordSize = Math.max(2, Math.min(8, Math.round(options.chordSize || 4)));
    const minMidi = Math.max(0, Math.min(127, options.minMidi ?? 12));
    const maxMidi = Math.max(minMidi, Math.min(127, options.maxMidi ?? 115));
    const brightness = Math.max(0, Math.min(1, Number(options.brightness) || 0));
    const spread = options.spread != null ? options.spread : (0.3 + brightness * 0.5);
    const resonantSet = new Set((options.resonantPCs || []).map(normalizePc));
    const chordSet = new Set((options.chordPCs || []).map(normalizePc));
    chordSet.add(normalizePc(rootMidi));

    const harmonicIndices = (Array.isArray(indices) && indices.length ? indices : [1,2,3,4,5,6,7,8])
      .map(index => Math.max(1, Math.round(index)))
      .filter((index, pos, arr) => arr.indexOf(index) === pos);

    const candidates = harmonicIndices.map(harmonic => {
      const freqHz = fundHz * harmonic;
      const midiFloat = freqToMidiFloat(freqHz, tuningA4);
      const midi = clampMidi(midiFloat, minMidi, maxMidi);
      const pc = normalizePc(midi);
      let score = 1 / Math.pow(harmonic, 0.32);
      if (pc === normalizePc(rootMidi)) score += 0.18;
      if (chordSet.has(pc)) score += 0.42;
      if (resonantSet.has(pc)) score += 0.24;
      score += Math.max(0, 0.18 - Math.abs(midiFloat - midi) * 0.02);
      score -= Math.abs(midi - rootMidi) * 0.0025;
      return {
        harmonic,
        freqHz,
        midiFloat,
        note: midi,
        pc,
        centsOffset: +(100 * (midiFloat - midi)).toFixed(2),
        score,
      };
    }).filter(candidate => candidate.note >= minMidi && candidate.note <= maxMidi);

    candidates.sort((a, b) => b.score - a.score || a.harmonic - b.harmonic || a.note - b.note);

    const selected = [];
    const usedNotes = new Set();
    const usedPcs = new Set();

    for (const candidate of candidates) {
      if (selected.length >= chordSize) break;
      if (usedNotes.has(candidate.note)) continue;
      if (usedPcs.has(candidate.pc) && selected.length < chordSize - 1) continue;
      selected.push(candidate);
      usedNotes.add(candidate.note);
      usedPcs.add(candidate.pc);
    }

    if (selected.length < chordSize) {
      for (const candidate of candidates) {
        if (selected.length >= chordSize) break;
        if (usedNotes.has(candidate.note)) continue;
        selected.push(candidate);
        usedNotes.add(candidate.note);
      }
    }

    const spreadVoices = partialSpread(selected, spread, minMidi, maxMidi).sort((a, b) => a.note - b.note);
    return {
      voices: spreadVoices,
      notes: spreadVoices.map(voice => voice.note),
      sourceIndices: spreadVoices.map(voice => voice.harmonic),
      spread,
    };
  }

  return {
    midiToFreq,
    freqToMidiFloat,
    partialSpread,
    overtoneChord,
  };
})();
