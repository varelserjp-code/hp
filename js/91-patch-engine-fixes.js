(() => {
  'use strict';

  const PATCH = window.__MEIKY_PATCH__ || {};


  /* v25.7: parseMidiTrackData / generateForChord / applyCompensationTuningToMidi / buildMPEConductor
     のパッチは元ファイル (15-midi-core.js, 22-ui-functions.js) に統合済みのため削除。 */

  if (typeof NREngine !== 'undefined') {
    const originalP = NREngine.P.bind(NREngine);
    const originalR = NREngine.R.bind(NREngine);
    const originalL = NREngine.L.bind(NREngine);
    const originalTransform = NREngine.nrTransform.bind(NREngine);
    const originalPath = NREngine.tonnetzPath.bind(NREngine);
    NREngine.P = chord => originalP(PATCH.normalizeNRTriad(chord));
    NREngine.R = chord => originalR(PATCH.normalizeNRTriad(chord));
    NREngine.L = chord => originalL(PATCH.normalizeNRTriad(chord));
    NREngine.nrTransform = (chord, ops) => originalTransform(PATCH.normalizeNRTriad(chord), ops);
    NREngine.tonnetzPath = (fromChord, toChord, maxDepth) => {
      return originalPath(PATCH.normalizeNRTriad(fromChord), PATCH.normalizeNRTriad(toChord), maxDepth);
    };
  }

  if (typeof SpectralHarmonyEngine !== 'undefined') {
    SpectralHarmonyEngine.midiToFreq = (noteMidi, tuningA4) => PATCH.midiToHz(noteMidi, tuningA4);
    SpectralHarmonyEngine.freqToMidiFloat = (freqHz, tuningA4) => {
      const a4 = Number.isFinite(tuningA4) && tuningA4 > 0 ? tuningA4 : PATCH.getConcertA4Hz();
      return 69 + 12 * Math.log2(Math.max(freqHz, 0.000001) / a4);
    };
  }

  if (typeof CompTuningEngine !== 'undefined' && typeof CompTuningEngine.getSummary === 'function') {
    const originalGetSummary = CompTuningEngine.getSummary.bind(CompTuningEngine);
    CompTuningEngine.getSummary = function getSummaryPatched() {
      const base = originalGetSummary();
      const profile = CompTuningEngine.STATE && CompTuningEngine.STATE.scalaProfile;
      if (!profile) return base;
      return base + ' | Scala: ' + profile.sclName + (profile.kbmText ? ' + ' + (profile.kbmName || 'KBM') : '');
    };
  }

  if (typeof SolfeggioEngine !== 'undefined') {
    SolfeggioEngine.hzToMidi = hz => PATCH.hzToMidi(hz);
    SolfeggioEngine.makeSolfeggioTrack = function makeSolfeggioTrackPatched(rootMidi, params, tensionCurve) {
      const state = SolfeggioEngine.STATE;
      const freqs = typeof SolfeggioEngine.getSelectedFreqs === 'function' ? SolfeggioEngine.getSelectedFreqs() : [];
      if (!params || !freqs.length) return null;

      const ppq = params.ppq;
      const bars = params.bars;
      const ch = 0x0B;
      const barTicks = ppq * 4;
      const total = barTicks * bars;
      const vel = state.velocity;
      const gate = Math.max(0.05, Math.min(2.0, state.gate));
      const shift = state.octShift;
      const density = state.density / 100;
      const stagger = state.stagger / 100;

      const toNote = freq => {
        let note = PATCH.hzToMidi(freq.hz) + shift * 12;
        while (note < 12) note += 12;
        while (note > 115) note -= 12;
        if (state.rootLock && rootMidi != null) {
          const rootPc = rootMidi % 12;
          const candidates = [rootPc, rootPc + 12, rootPc + 24, rootPc + 36, rootPc + 48, rootPc + 60, rootPc + 72, rootPc + 84, rootPc + 96, rootPc + 108];
          const valid = candidates.filter(candidate => candidate >= 12 && candidate <= 115);
          if (valid.length) {
            note = valid.reduce((best, candidate) => Math.abs(candidate - note) < Math.abs(best - note) ? candidate : best, valid[0]);
          }
        }
        return note;
      };

      const applyFade = (baseVelocity, pos) => {
        const ratio = total > 0 ? pos / total : 0;
        switch (state.fadeCurve) {
          case 'fade-in':
            return Math.round(baseVelocity * (0.15 + ratio * 0.85));
          case 'fade-out':
            return Math.round(baseVelocity * (1.0 - ratio * 0.85));
          case 'swell':
            return Math.round(baseVelocity * (0.15 + Math.sin(ratio * Math.PI) * 0.85));
          default:
            return baseVelocity;
        }
      };

      const tensionVelocity = (baseVelocity, pos) => {
        if (!state.tensionMod || !tensionCurve || !tensionCurve.length) return baseVelocity;
        const bar = Math.floor(pos / barTicks);
        const tension = tensionCurve[Math.min(bar, tensionCurve.length - 1)] ?? 0.5;
        return Math.round(Math.max(1, Math.min(127, baseVelocity * (0.5 + tension))));
      };

      const events = [];
      freqs.forEach((freq, index) => {
        const note = toNote(freq);
        const staggerTick = Math.round(index * stagger * barTicks);

        switch (state.mode) {
          case 'sustain':
            for (let bar = 0; bar < bars; bar++) {
              if (rng() > density) continue;
              const pos = bar * barTicks + staggerTick;
              if (pos >= total) continue;
              const duration = Math.round(barTicks * gate);
              const voiceVelocity = Math.max(1, Math.min(127, applyFade(tensionVelocity(vel, pos), pos)));
              events.push({ pos, v: [0x90 | ch, note, voiceVelocity] });
              events.push({ pos: Math.min(pos + duration, total - 1), v: [0x80 | ch, note, 0] });
            }
            break;
          case 'pulse': {
            const step = ppq;
            let cursor = staggerTick;
            while (cursor < total) {
              if (rng() <= density) {
                const duration = Math.round(step * gate);
                const voiceVelocity = Math.max(1, Math.min(127, applyFade(tensionVelocity(vel, cursor), cursor)));
                events.push({ pos: cursor, v: [0x90 | ch, note, voiceVelocity] });
                events.push({ pos: Math.min(cursor + duration, total - 1), v: [0x80 | ch, note, 0] });
              }
              cursor += step;
            }
            break;
          }
          case 'breath': {
            const inhale = barTicks * 2;
            const exhale = barTicks * 2;
            let cursor = staggerTick;
            while (cursor < total) {
              const dur1 = Math.round(inhale * gate);
              const v1 = Math.max(1, Math.min(127, applyFade(tensionVelocity(Math.round(vel * 0.6), cursor), cursor)));
              if (cursor + dur1 <= total) {
                events.push({ pos: cursor, v: [0x90 | ch, note, v1] });
                events.push({ pos: cursor + dur1, v: [0x80 | ch, note, 0] });
              }
              cursor += inhale;
              if (cursor >= total) break;
              const dur2 = Math.round(exhale * gate * 1.1);
              const v2 = Math.max(1, Math.min(127, applyFade(tensionVelocity(vel, cursor), cursor)));
              if (cursor + dur2 <= total) {
                events.push({ pos: cursor, v: [0x90 | ch, note, v2] });
                events.push({ pos: cursor + dur2, v: [0x80 | ch, note, 0] });
              }
              cursor += exhale;
            }
            break;
          }
          case 'shimmer': {
            const step = Math.round(ppq / 2);
            let cursor = staggerTick;
            let phase = 0;
            while (cursor < total) {
              if (rng() <= density) {
                const shimmerVelocity = Math.max(1, Math.min(127, Math.round(vel * (0.35 + Math.sin(phase) * 0.3 + rng() * 0.35))));
                const duration = Math.round(step * gate * 0.65);
                events.push({ pos: cursor, v: [0x90 | ch, note, shimmerVelocity] });
                events.push({ pos: Math.min(cursor + duration, total - 1), v: [0x80 | ch, note, 0] });
              }
              cursor += step;
              phase += 0.4;
            }
            break;
          }
        }
      });

      if (!events.length || typeof safeAbsToTrack !== 'function') return null;
      const trackName = typeof tname === 'function' ? tname('Solfeggio') : { d: 0, v: [0xFF, 0x03, 9, 83, 111, 108, 102, 101, 103, 103, 105, 111] };
      const program = typeof pc === 'function' ? pc(ch, 88) : { d: 0, v: [0xC0 | ch, 88] };
      return safeAbsToTrack(events, [trackName, program]);
    };
  }

  if (typeof BinauralEngine !== 'undefined') {
    const originalBuildUI = BinauralEngine.buildUI.bind(BinauralEngine);
    BinauralEngine.buildUI = function buildUIPatched() {
      originalBuildUI();
      PATCH.syncBinauralUI();
    };

    BinauralEngine.makeBinauralTrack = function makeBinauralTrackPatched(params) {
      const state = BinauralEngine.STATE;
      const ppq = params.ppq;
      const bars = params.bars;
      const chLeft = 0x0C;
      const chRight = 0x0D;
      const barTicks = ppq * 4;
      const total = barTicks * bars;
      const baseNote = state.carrierNote;
      const baseHz = PATCH.midiToHz(baseNote);
      const beatHz = state.activeBeat;
      const cents = PATCH.hzDiffToCents(baseHz, beatHz);
      const centsToMidiPB = (note, centsValue) => {
        const semis = centsValue / 100;
        const noteOffset = Math.round(semis);
        const remCents = centsValue - noteOffset * 100;
        const pb = Math.round(8192 + (remCents / 200) * 8192);
        return { note: note + noteOffset, pb: Math.max(0, Math.min(16383, pb)) };
      };
      const pitchBend = (ch, value, pos) => ({ pos, v: [0xE0 | ch, value & 0x7F, (value >> 7) & 0x7F] });
      const cc7 = (ch, value, pos) => ({ pos, v: [0xB0 | ch, 7, value] });
      const baseRight = centsToMidiPB(baseNote, cents);
      const events = [];

      switch (state.mode) {
        case 'pure':
          events.push(cc7(chLeft, state.volume, 0));
          events.push({ pos: 0, v: [0x90 | chLeft, baseNote, state.velocity] });
          events.push({ pos: total - 1, v: [0x80 | chLeft, baseNote, 0] });
          events.push(cc7(chRight, state.volume, 0));
          events.push(pitchBend(chRight, baseRight.pb, 0));
          events.push({ pos: 0, v: [0x90 | chRight, baseRight.note, state.velocity] });
          events.push({ pos: total - 1, v: [0x80 | chRight, baseRight.note, 0] });
          break;
        case 'layered': {
          const band = BinauralEngine.BANDS.find(entry => entry.id === state.activeBand);
          const beats = band ? band.beats : [{ hz: beatHz }];
          beats.forEach((beat, index) => {
            const tuned = centsToMidiPB(baseNote, PATCH.hzDiffToCents(baseHz, beat.hz));
            const velocity = Math.max(20, Math.round(state.velocity * (1 - index * 0.15)));
            if (index === 0) {
              events.push(cc7(chLeft, state.volume, 0));
              events.push({ pos: 0, v: [0x90 | chLeft, baseNote, velocity] });
              events.push({ pos: total - 1, v: [0x80 | chLeft, baseNote, 0] });
            }
            events.push(cc7(chRight, state.volume, 0));
            events.push(pitchBend(chRight, tuned.pb, index * ppq));
            events.push({ pos: index * ppq, v: [0x90 | chRight, tuned.note, velocity] });
            events.push({ pos: total - 1, v: [0x80 | chRight, tuned.note, 0] });
          });
          break;
        }
        case 'ramp': {
          const band = BinauralEngine.BANDS.find(entry => entry.id === state.activeBand);
          const beats = band ? band.beats : [{ hz: beatHz }];
          const segLen = Math.floor(total / Math.max(1, beats.length));
          events.push(cc7(chLeft, state.volume, 0));
          events.push({ pos: 0, v: [0x90 | chLeft, baseNote, state.velocity] });
          events.push({ pos: total - 1, v: [0x80 | chLeft, baseNote, 0] });
          events.push(cc7(chRight, state.volume, 0));
          beats.forEach((beat, index) => {
            const segStart = index * segLen;
            const segEnd = index === beats.length - 1 ? total - 1 : (index + 1) * segLen;
            const tuned = centsToMidiPB(baseNote, PATCH.hzDiffToCents(baseHz, beat.hz));
            events.push(pitchBend(chRight, tuned.pb, segStart));
            if (index === 0) {
              events.push({ pos: segStart, v: [0x90 | chRight, tuned.note, state.velocity] });
            } else {
              const prev = centsToMidiPB(baseNote, PATCH.hzDiffToCents(baseHz, beats[index - 1].hz));
              events.push({ pos: segStart, v: [0x80 | chRight, prev.note, 0] });
              events.push({ pos: segStart + 1, v: [0x90 | chRight, tuned.note, state.velocity] });
            }
            if (index === beats.length - 1) {
              events.push({ pos: segEnd, v: [0x80 | chRight, tuned.note, 0] });
            }
          });
          break;
        }
      }

      if (typeof safeAbsToTrack !== 'function' || typeof tname !== 'function' || typeof pc !== 'function') return [];
      events.sort((a, b) => a.pos - b.pos);
      return safeAbsToTrack(events, [
        tname('BB_' + state.activeBand.toUpperCase() + '_' + state.activeBeat + 'Hz'),
        pc(chLeft, 88),
        pc(chRight, 88),
      ]);
    };
  }

  if (typeof MidiPreview !== 'undefined') {
    const previewState = {
      ac: null,
      parsed: null,
      bpm: 60,
      startAt: 0,
      pausedAt: 0,
      playing: false,
      schedNodes: [],
      raf: null,
      duration: 0,
      chVol: {},
    };

    function parsePreviewMidi(bytes) {
      let pos = 0;

      function readU16() {
        const value = (bytes[pos] << 8) | bytes[pos + 1];
        pos += 2;
        return value;
      }

      function readU32() {
        const value = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
        pos += 4;
        return value >>> 0;
      }

      function readVLQ() {
        let value = 0;
        for (let index = 0; index < 4; index++) {
          const byte = bytes[pos++];
          value = (value << 7) | (byte & 0x7F);
          if (!(byte & 0x80)) break;
        }
        return value;
      }

      pos = 0;
      if (bytes[0] !== 0x4D || bytes[1] !== 0x54 || bytes[2] !== 0x68 || bytes[3] !== 0x64) return null;
      pos = 4;
      readU32();
      readU16();
      const numTracks = readU16();
      const ppq = readU16();
      const noteEvents = [];
      let bpmOverride = null;

      for (let trackIndex = 0; trackIndex < numTracks; trackIndex++) {
        if (pos + 8 > bytes.length) break;
        if (bytes[pos] !== 0x4D || bytes[pos + 1] !== 0x54 || bytes[pos + 2] !== 0x72 || bytes[pos + 3] !== 0x6B) {
          break;
        }
        pos += 4;
        const trackLength = readU32();
        const trackEnd = pos + trackLength;
        let tick = 0;
        let runStatus = 0;

        while (pos < trackEnd) {
          tick += readVLQ();
          let status = bytes[pos];

          if (status & 0x80) {
            runStatus = status;
            pos++;
          } else {
            status = runStatus;
          }

          const type = status & 0xF0;
          const ch = status & 0x0F;

          if (type === 0x90) {
            const note = bytes[pos++];
            const vel = bytes[pos++];
            noteEvents.push({ on: vel > 0, ch, note, vel, tick });
          } else if (type === 0x80) {
            const note = bytes[pos++];
            pos++;
            noteEvents.push({ on: false, ch, note, vel: 0, tick });
          } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
            pos += 2;
          } else if (type === 0xC0 || type === 0xD0) {
            pos += 1;
          } else if (status === 0xFF) {
            const metaType = bytes[pos++];
            const metaLength = readVLQ();
            if (metaType === 0x51 && metaLength === 3) {
              const microsecondsPerBeat = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
              bpmOverride = Math.round(60000000 / microsecondsPerBeat);
            }
            pos += metaLength;
          } else if (status === 0xF0 || status === 0xF7) {
            pos += readVLQ();
          } else {
            pos++;
          }
        }

        pos = trackEnd;
      }

      noteEvents.sort((left, right) => left.tick - right.tick);
      return { ppq, bpmOverride, noteEvents };
    }

    const previewTimbre = {
      default: { wave: 'sine', attack: 0.02, release: 0.15 },
      0: { wave: 'sine', attack: 0.4, release: 1.2 },
      1: { wave: 'triangle', attack: 0.15, release: 0.6 },
      2: { wave: 'sawtooth', attack: 0.01, release: 0.08 },
      3: { wave: 'sine', attack: 0.03, release: 0.18 },
      4: { wave: 'sine', attack: 0.05, release: 0.3 },
      5: { wave: 'triangle', attack: 0.02, release: 0.25 },
      6: { wave: 'sine', attack: 0.08, release: 0.5 },
      7: { wave: 'sawtooth', attack: 0.01, release: 0.1 },
      8: { wave: 'triangle', attack: 0.03, release: 0.12 },
      9: { wave: 'square', attack: 0.02, release: 0.1 },
    };

    function getPreviewAC() {
      if (!previewState.ac || previewState.ac.state === 'closed') {
        previewState.ac = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (previewState.ac.state === 'suspended' && typeof previewState.ac.resume === 'function') {
        previewState.ac.resume();
      }
      return previewState.ac;
    }

    function stopPreviewNodes() {
      for (const item of previewState.schedNodes) {
        try { item.osc.stop(); } catch (_) {}
      }
      previewState.schedNodes = [];
    }

    function updatePreviewUI() {
      const container = document.getElementById('midiPreviewPanel');
      if (!container) return;
      const playButton = document.getElementById('prevPlay');
      const pauseButton = document.getElementById('prevPause');
      const stopButton = document.getElementById('prevStop');
      if (playButton) playButton.style.display = previewState.playing ? 'none' : '';
      if (pauseButton) pauseButton.style.display = previewState.playing ? '' : 'none';
      if (stopButton) stopButton.disabled = (!previewState.playing && previewState.pausedAt === 0);
    }

    function formatPreviewTime(sec) {
      const minutes = Math.floor(sec / 60);
      const seconds = Math.floor(sec % 60);
      return minutes + ':' + String(seconds).padStart(2, '0');
    }

    function syncPreviewSectionFocus(elapsedSec, isPlaying, force) {
      if (typeof PATCH.syncPreviewLinkedSectionFocus !== 'function' || !previewState.parsed) return;
      const safeElapsed = Math.max(0, Number(elapsedSec) || 0);
      const secPerTick = 60 / (previewState.bpm * previewState.parsed.ppq);
      const tick = secPerTick > 0 ? Math.round(safeElapsed / secPerTick) : 0;
      const bar = Math.floor(tick / (previewState.parsed.ppq * 4));
      PATCH.syncPreviewLinkedSectionFocus(bar, {
        playing: !!isPlaying,
        duration: previewState.duration,
        progress: previewState.duration > 0 ? safeElapsed / previewState.duration : 0,
        force: !!force,
      });
    }

    function tickPreview() {
      if (!previewState.playing || !previewState.ac) return;
      const elapsed = previewState.ac.currentTime - previewState.startAt;
      const progress = Math.min(1, elapsed / previewState.duration);
      syncPreviewSectionFocus(elapsed, true, false);

      const seek = document.getElementById('prevSeek');
      if (seek) seek.value = progress * 1000;

      const timeEl = document.getElementById('prevTime');
      if (timeEl) {
        const current = Math.max(0, Math.min(previewState.duration, elapsed));
        timeEl.textContent = formatPreviewTime(current) + ' / ' + formatPreviewTime(previewState.duration);
      }

      if (elapsed >= previewState.duration) {
        MidiPreview.stop();
        return;
      }
      previewState.raf = requestAnimationFrame(tickPreview);
    }

    MidiPreview.load = function loadPatched(midiData, bpm) {
      MidiPreview.stop();
      previewState.parsed = parsePreviewMidi(midiData);
      if (!previewState.parsed) {
        console.warn('[MidiPreview] parse failed');
        return;
      }
      previewState.bpm = (previewState.parsed.bpmOverride && previewState.parsed.bpmOverride > 0)
        ? previewState.parsed.bpmOverride
        : (bpm || 60);
      const secPerTick = 60 / (previewState.bpm * previewState.parsed.ppq);
      const lastTick = previewState.parsed.noteEvents.length
        ? previewState.parsed.noteEvents[previewState.parsed.noteEvents.length - 1].tick
        : 0;
      previewState.duration = lastTick * secPerTick + 2.0;
      previewState.pausedAt = 0;
      syncPreviewSectionFocus(0, false, true);
      updatePreviewUI();
    };

    MidiPreview.play = function playPatched() {
      if (!previewState.parsed || previewState.playing) return;
      const ac = getPreviewAC();
      previewState.playing = true;
      previewState.startAt = ac.currentTime - previewState.pausedAt;
      syncPreviewSectionFocus(previewState.pausedAt, true, true);

      const secPerTick = 60 / (previewState.bpm * previewState.parsed.ppq);
      const masterGain = ac.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(ac.destination);

      const channelGains = {};
      function getChannelGain(ch) {
        if (!channelGains[ch]) {
          const gain = ac.createGain();
          gain.gain.value = previewState.chVol[ch] !== undefined ? previewState.chVol[ch] : 0.8;
          gain.connect(masterGain);
          channelGains[ch] = gain;
        }
        return channelGains[ch];
      }

      for (const event of previewState.parsed.noteEvents) {
        if (!event.on) continue;
        const onSec = event.tick * secPerTick;
        const startTime = previewState.startAt + onSec;
        if (startTime < ac.currentTime - 0.05) continue;

        let offSec = onSec + 0.5;
        for (const offEvent of previewState.parsed.noteEvents) {
          if (!offEvent.on &&
              offEvent.ch === event.ch &&
              offEvent.note === event.note &&
              offEvent.tick > event.tick) {
            offSec = offEvent.tick * secPerTick;
            break;
          }
        }

        const timbre = previewTimbre[event.ch] || previewTimbre.default;
        const osc = ac.createOscillator();
        osc.type = timbre.wave;
        osc.frequency.value = PATCH.midiToHz(event.note);

        const gain = ac.createGain();
        const velocityGain = (event.vel / 127) * 0.7;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(velocityGain, startTime + timbre.attack);
        const noteEnd = previewState.startAt + offSec;
        gain.gain.setValueAtTime(velocityGain, noteEnd);
        gain.gain.linearRampToValueAtTime(0, noteEnd + timbre.release);

        osc.connect(gain);
        gain.connect(getChannelGain(event.ch));
        osc.start(startTime);
        osc.stop(noteEnd + timbre.release + 0.05);
        previewState.schedNodes.push({ osc, gain });
      }

      previewState.raf = requestAnimationFrame(tickPreview);
      updatePreviewUI();
    };

    MidiPreview.pause = function pausePatched() {
      if (!previewState.playing || !previewState.ac) return;
      previewState.pausedAt = previewState.ac.currentTime - previewState.startAt;
      stopPreviewNodes();
      previewState.playing = false;
      cancelAnimationFrame(previewState.raf);
      syncPreviewSectionFocus(previewState.pausedAt, false, true);
      updatePreviewUI();
    };

    MidiPreview.stop = function stopPatched() {
      stopPreviewNodes();
      previewState.playing = false;
      previewState.pausedAt = 0;
      cancelAnimationFrame(previewState.raf);
      if (typeof PATCH.resetPreviewSectionTracking === 'function') PATCH.resetPreviewSectionTracking();
      updatePreviewUI();
    };

    MidiPreview.seek = function seekPatched(pos01) {
      const wasPlaying = previewState.playing;
      if (wasPlaying) {
        stopPreviewNodes();
        previewState.playing = false;
        cancelAnimationFrame(previewState.raf);
      }
      previewState.pausedAt = pos01 * previewState.duration;
      if (wasPlaying) MidiPreview.play();
      else {
        syncPreviewSectionFocus(previewState.pausedAt, false, true);
        updatePreviewUI();
      }
    };

    MidiPreview.setChVol = function setChVolPatched(ch, value) {
      previewState.chVol[ch] = value;
    };

    MidiPreview.isPlaying = function isPlayingPatched() {
      return previewState.playing;
    };

    MidiPreview.getDuration = function getDurationPatched() {
      return previewState.duration;
    };
  }

  if (typeof RhythmicCanons !== 'undefined' && typeof RhythmicCanons.generate === 'function') {
    const originalRhythmicCanonsGenerate = RhythmicCanons.generate.bind(RhythmicCanons);
    RhythmicCanons.generate = function generateWithSongLengthHint(params, totalSteps) {
      const hint = window.__MEIKY_RC_TOTAL_STEPS_HINT__;
      const correctedTotalSteps =
        hint && params && Number(totalSteps) === Number(params.n) ? hint : totalSteps;
      return originalRhythmicCanonsGenerate(params, correctedTotalSteps);
    };
  }

  if (typeof doGenerate === 'function') {
    const originalDoGenerate = doGenerate;
    window.doGenerate = function doGenerateWithRhythmicCanonHint(abSlot, onDone) {
      const totalBars = PATCH.getActiveProgressionTotalBars();
      const hintedTotalSteps = totalBars > 0 ? totalBars * 480 * 4 : null;
      const isABVariant = abSlot === 'A' || abSlot === 'B';
      if (typeof PATCH.resetAdaptiveJiMemory === 'function') PATCH.resetAdaptiveJiMemory();
      if (typeof S !== 'undefined' && S) S.compSectionPreTuned = false;
      window.__MEIKY_JI_SECTION_BARS__ = null;
      if (typeof JI_PARAMS !== 'undefined' &&
          JI_PARAMS &&
          JI_PARAMS.adaptiveMemoryEnabled &&
          JI_PARAMS.adaptiveResetOnSection &&
          typeof S !== 'undefined' &&
          S &&
          S.engines &&
          S.engines.macro &&
          S.macroEnabled &&
          typeof generateTensionCurve === 'function' &&
          typeof detectSections === 'function') {
        const sections = detectSections(generateTensionCurve(S.curveShape, totalBars || S.bars, S.curveAmp, S.chainEnabled, S.curveShapeB)) || [];
        window.__MEIKY_JI_SECTION_BARS__ = sections.map(section => section.bar).filter(bar => bar > 0);
      }
      if (!isABVariant && typeof S !== 'undefined' && S) {
        PATCH.abVariants.A = null;
        PATCH.abVariants.B = null;
        S.midiDataA = null;
        S.midiDataB = null;
        PATCH.syncABUI();
      }
      window.__MEIKY_RC_TOTAL_STEPS_HINT__ = hintedTotalSteps;
      const wrappedOnDone = () => {
        if (typeof PATCH.buildExportManifest === 'function') {
          PATCH.lastGeneratedManifest = PATCH.buildExportManifest('generate', []);
        }
        if (typeof PATCH.syncJustIntonationUI === 'function') PATCH.syncJustIntonationUI();
        if (typeof PATCH.syncCompSectionUI === 'function') PATCH.syncCompSectionUI();
        if (typeof PATCH.syncPatchDiagnosticsUI === 'function') PATCH.syncPatchDiagnosticsUI();
        if (isABVariant) PATCH.captureABVariant(abSlot);
        if (typeof onDone === 'function') onDone();
      };
      const result = originalDoGenerate(abSlot, wrappedOnDone);
      setTimeout(() => {
        if (window.__MEIKY_RC_TOTAL_STEPS_HINT__ === hintedTotalSteps) {
          window.__MEIKY_RC_TOTAL_STEPS_HINT__ = null;
        }
        window.__MEIKY_JI_SECTION_BARS__ = null;
      }, 0);
      return result;
    };
  }
})();
