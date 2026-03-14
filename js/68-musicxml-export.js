const MusicXmlExportEngine = (() => {
  'use strict';

  const NOTE_STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
  const NOTE_ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const TYPE_TABLE = [
    { name: 'whole', units: 4 },
    { name: 'half', units: 2 },
    { name: 'quarter', units: 1 },
    { name: 'eighth', units: 0.5 },
    { name: '16th', units: 0.25 },
    { name: '32nd', units: 0.125 },
    { name: '64th', units: 0.0625 },
  ];
  const LOWER_STAFF_PREFERRED_MAX = 55;
  const UPPER_STAFF_PREFERRED_MIN = 60;

  function escapeXml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function updateStatus(text, tone) {
    const el = document.getElementById('musicXmlStatus');
    if (el) {
      el.textContent = text;
      el.style.color = tone === 'ok' ? 'var(--teal)' : tone === 'warn' ? 'var(--amber)' : 'var(--text-dim)';
    }
  }

  function getPPQ() {
    if (typeof S !== 'undefined' && S.midiData && S.midiData.length >= 14) {
      return (S.midiData[12] << 8) | S.midiData[13];
    }
    return 480;
  }

  function parseConductorTrackData(trackData) {
    const events = [];
    const data = Array.from(trackData || []);
    let position = 0;
    let tick = 0;
    while (position < data.length) {
      let delta = 0;
      while (position < data.length) {
        const byte = data[position++];
        delta = (delta << 7) | (byte & 0x7F);
        if (!(byte & 0x80)) break;
      }
      tick += delta;
      if (position >= data.length) break;

      const status = data[position++];
      if (status !== 0xFF) {
        const hi = status & 0xF0;
        position += (hi === 0xC0 || hi === 0xD0) ? 1 : 2;
        continue;
      }

      const metaType = data[position++];
      let length = 0;
      while (position < data.length) {
        const byte = data[position++];
        length = (length << 7) | (byte & 0x7F);
        if (!(byte & 0x80)) break;
      }
      const payload = data.slice(position, position + length);
      position += length;
      events.push({ tick, metaType, payload });
      if (metaType === 0x2F) break;
    }
    return events;
  }

  function extractConductorInfo(divisions) {
    if (typeof S === 'undefined' || !S.conductorRaw) return { tempoByMeasure: {}, sectionByMeasure: {} };
    const ticksPerMeasure = divisions * 4;
    const events = parseConductorTrackData(S.conductorRaw);
    const tempoByMeasure = {};
    const sectionByMeasure = {};
    events.forEach(event => {
      const measure = Math.floor(event.tick / ticksPerMeasure) + 1;
      if (event.metaType === 0x51 && event.payload.length >= 3) {
        const mpqn = (event.payload[0] << 16) | (event.payload[1] << 8) | event.payload[2];
        tempoByMeasure[measure] = +(60000000 / Math.max(1, mpqn)).toFixed(2);
      }
      if (event.metaType === 0x06 && event.payload.length) {
        sectionByMeasure[measure] = new TextDecoder().decode(new Uint8Array(event.payload));
      }
    });
    return { tempoByMeasure, sectionByMeasure };
  }

  function collectTrackNotes(trackData) {
    if (typeof parseMidiTrackData !== 'function') return [];
    const events = parseMidiTrackData(trackData || []);
    const active = new Map();
    const notes = [];

    for (const event of events) {
      const key = event.origCh + ':' + event.note;
      if (event.type === 'on' && event.vel > 0) {
        const stack = active.get(key) || [];
        stack.push(event);
        active.set(key, stack);
        continue;
      }
      if (event.type !== 'off') continue;
      const stack = active.get(key);
      if (!stack || !stack.length) continue;
      const start = stack.shift();
      if (!stack.length) active.delete(key);
      notes.push({
        tick: start.absTime,
        duration: Math.max(1, event.absTime - start.absTime),
        channel: start.origCh + 1,
        note: start.note,
        velocity: start.vel,
      });
    }

    return notes.sort((a, b) => a.tick - b.tick || a.note - b.note);
  }

  function groupChordEvents(notes) {
    const groups = [];
    for (const note of notes) {
      const last = groups.length ? groups[groups.length - 1] : null;
      if (last && last.tick === note.tick) {
        last.notes.push(note);
        last.duration = Math.max(last.duration, note.duration);
      } else {
        groups.push({ tick: note.tick, duration: note.duration, notes: [note] });
      }
    }
    return groups;
  }

  function classifyVoices(group) {
    const notes = [...(group.notes || [])].sort((a, b) => a.note - b.note);
    if (notes.length < 3) return { upper: notes, lower: [] };
    const span = notes[notes.length - 1].note - notes[0].note;
    if (span < 12) return { upper: notes, lower: [] };
    const lowerByRegister = notes.filter(note => note.note <= LOWER_STAFF_PREFERRED_MAX);
    const upperByRegister = notes.filter(note => note.note >= UPPER_STAFF_PREFERRED_MIN);
    if (lowerByRegister.length && upperByRegister.length && lowerByRegister.length < notes.length && upperByRegister.length < notes.length) {
      return {
        lower: lowerByRegister,
        upper: notes.filter(note => !lowerByRegister.includes(note)),
      };
    }
    let splitIndex = 1;
    let bestGap = 0;
    for (let index = 1; index < notes.length; index++) {
      const gap = notes[index].note - notes[index - 1].note;
      const lower = notes.slice(0, index);
      const upper = notes.slice(index);
      if (!lower.length || !upper.length) continue;
      const lowerTop = lower[lower.length - 1].note;
      const upperBottom = upper[0].note;
      const score = gap + (upperBottom >= UPPER_STAFF_PREFERRED_MIN ? 2 : 0) + (lowerTop <= LOWER_STAFF_PREFERRED_MAX ? 2 : 0);
      if (score > bestGap) {
        bestGap = score;
        splitIndex = index;
      }
    }
    if (bestGap < 5) {
      splitIndex = notes.length >= 4 ? 2 : 1;
    }
    return {
      upper: notes.slice(splitIndex),
      lower: notes.slice(0, splitIndex),
    };
  }

  function usesGrandStaff(groups) {
    return (groups || []).some(group => classifyVoices(group).lower.length > 0);
  }

  function pitchInfo(note) {
    const pc = ((note % 12) + 12) % 12;
    return {
      step: NOTE_STEPS[pc],
      alter: NOTE_ALTERS[pc],
      octave: Math.floor(note / 12) - 1,
    };
  }

  function durationType(duration, divisions) {
    const units = duration / Math.max(1, divisions);
    let best = { name: 'quarter', dots: 0, distance: Infinity };
    for (const base of TYPE_TABLE) {
      for (const dots of [0, 1]) {
        const factor = dots === 1 ? 1.5 : 1;
        const distance = Math.abs(units - base.units * factor);
        if (distance < best.distance) best = { name: base.name, dots, distance };
      }
    }
    return best;
  }

  function dynamicMarkForVelocity(velocity) {
    const value = Math.max(1, Math.min(127, velocity || 64));
    if (value < 24) return 'ppp';
    if (value < 40) return 'pp';
    if (value < 56) return 'p';
    if (value < 72) return 'mp';
    if (value < 88) return 'mf';
    if (value < 104) return 'f';
    if (value < 116) return 'ff';
    return 'fff';
  }

  function splitByMeasure(startTick, duration, ticksPerMeasure) {
    const segments = [];
    let cursor = startTick;
    let remaining = duration;
    while (remaining > 0) {
      const measureIndex = Math.floor(cursor / ticksPerMeasure);
      const measureEnd = (measureIndex + 1) * ticksPerMeasure;
      const segment = Math.min(remaining, measureEnd - cursor);
      segments.push({ measureIndex, startTick: cursor, duration: segment });
      cursor += segment;
      remaining -= segment;
    }
    return segments;
  }

  function buildNoteXml(note, duration, divisions, options = {}) {
    const info = pitchInfo(note.note);
    const type = durationType(duration, divisions);
    const tags = [];
    tags.push('<note>');
    if (options.isChord) tags.push('<chord/>');
    tags.push('<pitch>');
    tags.push(`<step>${info.step}</step>`);
    if (info.alter) tags.push(`<alter>${info.alter}</alter>`);
    tags.push(`<octave>${info.octave}</octave>`);
    tags.push('</pitch>');
    tags.push(`<duration>${duration}</duration>`);
    if (options.tieStart) tags.push('<tie type="start"/>');
    if (options.tieStop) tags.push('<tie type="stop"/>');
    tags.push(`<voice>${options.voice || 1}</voice>`);
    tags.push(`<type>${type.name}</type>`);
    if (type.dots) tags.push('<dot/>');
    tags.push(`<velocity>${Math.max(1, Math.min(127, note.velocity || 64))}</velocity>`);
    tags.push(`<staff>${options.staff || 1}</staff>`);
    if (options.voice === 2) tags.push('<stem>down</stem>');
    if (options.tieStart || options.tieStop) {
      tags.push('<notations>');
      if (options.tieStop) tags.push('<tied type="stop"/>');
      if (options.tieStart) tags.push('<tied type="start"/>');
      tags.push('</notations>');
    }
    tags.push('</note>');
    return tags.join('');
  }

  function buildRestXml(duration, divisions, options = {}) {
    const type = durationType(duration, divisions);
    return [
      '<note>',
      '<rest/>',
      `<duration>${duration}</duration>`,
      `<voice>${options.voice || 1}</voice>`,
      `<type>${type.name}</type>`,
      type.dots ? '<dot/>' : '',
      `<staff>${options.staff || 1}</staff>`,
      '</note>',
    ].join('');
  }

  function standardDurationTicks(divisions) {
    const values = [];
    TYPE_TABLE.forEach(base => {
      const ticks = Math.max(1, Math.round(base.units * divisions));
      values.push({ ticks, dots: 0 });
      values.push({ ticks: Math.max(1, Math.round(ticks * 1.5)), dots: 1 });
    });
    return values.sort((a, b) => b.ticks - a.ticks);
  }

  function splitRestDurations(duration, divisions) {
    const values = standardDurationTicks(divisions);
    const chunks = [];
    let remaining = Math.max(0, duration);
    while (remaining > 0) {
      const found = values.find(value => value.ticks <= remaining);
      if (!found) {
        chunks.push(remaining);
        break;
      }
      chunks.push(found.ticks);
      remaining -= found.ticks;
    }
    return chunks;
  }

  function pushVoiceEvent(bucket, voice, startTick, xml) {
    bucket[voice].events.push({ startTick, xml });
  }

  function ensureVoiceRest(bucket, voice, fromTick, toTick, ticksPerMeasure, divisions, options = {}) {
    const measureStart = bucket.measureIndex * ticksPerMeasure;
    let cursor = Math.max(fromTick, measureStart);
    const endTick = Math.max(cursor, toTick);
    if (endTick <= cursor) return;
    while (cursor < endTick) {
      const localTick = cursor - measureStart;
      const nextBeatBoundary = Math.min(endTick, measureStart + (Math.floor(localTick / divisions) + 1) * divisions);
      const durations = splitRestDurations(Math.max(1, nextBeatBoundary - cursor), divisions);
      durations.forEach(duration => {
        pushVoiceEvent(bucket, voice, cursor, buildRestXml(duration, divisions, {
          voice: options.voice || (voice === 'voice2' ? 2 : 1),
          staff: options.staff || 1,
        }));
        cursor += duration;
      });
    }
    bucket[voice].cursor = toTick;
  }

  function measureDynamicDirection(dynamicName) {
    return '<direction placement="below"><direction-type><dynamics><' + dynamicName + '/></dynamics></direction-type></direction>';
  }

  function clefForNotes(notes) {
    if (!notes.length) return { sign: 'G', line: 2 };
    const avg = notes.reduce((sum, note) => sum + note.note, 0) / notes.length;
    return avg < 60 ? { sign: 'F', line: 4 } : { sign: 'G', line: 2 };
  }

  function collectVoiceNotes(groups) {
    const upper = [];
    const lower = [];
    (groups || []).forEach(group => {
      const plan = classifyVoices(group);
      upper.push(...plan.upper);
      lower.push(...plan.lower);
    });
    return { upper, lower };
  }

  function clefsForPart(notes, groups, grandStaff) {
    if (!grandStaff) return { upper: clefForNotes(notes), lower: null };
    const voiceNotes = collectVoiceNotes(groups);
    return {
      upper: clefForNotes(voiceNotes.upper.length ? voiceNotes.upper : notes),
      lower: clefForNotes(voiceNotes.lower.length ? voiceNotes.lower : notes),
    };
  }

  function buildPartXml(layerTrack, partId, divisions, ticksPerMeasure) {
    const notes = collectTrackNotes(layerTrack.data);
    const groups = groupChordEvents(notes);
    const grandStaff = usesGrandStaff(groups);
    const maxTick = groups.reduce((end, group) => Math.max(end, group.tick + group.duration), 0);
    const measureCount = Math.max(1, Math.ceil(maxTick / ticksPerMeasure));
    const measures = Array.from({ length: measureCount }, (_, measureIndex) => ({
      measureIndex,
      voice1: { cursor: measureIndex * ticksPerMeasure, events: [] },
      voice2: { cursor: measureIndex * ticksPerMeasure, events: [] },
      noteVelocities: [],
    }));

    for (const group of groups) {
      const segments = splitByMeasure(group.tick, group.duration, ticksPerMeasure);
      const voicePlan = classifyVoices(group);
      segments.forEach((segment, segmentIndex) => {
        const bucket = measures[segment.measureIndex];
        const segmentStart = segment.startTick;
        const tieStart = segmentIndex < segments.length - 1;
        const tieStop = segmentIndex > 0;
        if (voicePlan.upper.length) {
          ensureVoiceRest(bucket, 'voice1', bucket.voice1.cursor, segmentStart, ticksPerMeasure, divisions, { voice: 1, staff: 1 });
          voicePlan.upper.forEach((note, noteIndex) => {
            pushVoiceEvent(bucket, 'voice1', segmentStart, buildNoteXml(note, segment.duration, divisions, {
              isChord: noteIndex > 0,
              tieStart,
              tieStop,
              voice: 1,
              staff: 1,
            }));
            bucket.noteVelocities.push(note.velocity || 64);
          });
          bucket.voice1.cursor = segmentStart + segment.duration;
        }
        if (voicePlan.lower.length) {
          ensureVoiceRest(bucket, 'voice2', bucket.voice2.cursor, segmentStart, ticksPerMeasure, divisions, { voice: 2, staff: grandStaff ? 2 : 1 });
          voicePlan.lower.forEach((note, noteIndex) => {
            pushVoiceEvent(bucket, 'voice2', segmentStart, buildNoteXml(note, segment.duration, divisions, {
              isChord: noteIndex > 0,
              tieStart,
              tieStop,
              voice: 2,
              staff: grandStaff ? 2 : 1,
            }));
            bucket.noteVelocities.push(note.velocity || 64);
          });
          bucket.voice2.cursor = segmentStart + segment.duration;
        }
      });
    }

    measures.forEach((bucket, measureIndex) => {
      const measureStart = measureIndex * ticksPerMeasure;
      const measureEnd = measureStart + ticksPerMeasure;
      ensureVoiceRest(bucket, 'voice1', bucket.voice1.cursor, measureEnd, ticksPerMeasure, divisions, { voice: 1, staff: 1 });
      if (bucket.voice2.events.length || grandStaff) {
        ensureVoiceRest(bucket, 'voice2', bucket.voice2.cursor, measureEnd, ticksPerMeasure, divisions, { voice: 2, staff: grandStaff ? 2 : 1 });
      }
    });

    const clef = clefsForPart(notes, groups, grandStaff);
    const conductor = extractConductorInfo(divisions);
    const xml = [];
    xml.push(`<part id="${partId}">`);
    for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
      const measureNumber = measureIndex + 1;
      const bucket = measures[measureIndex];
      xml.push(`<measure number="${measureIndex + 1}">`);
      if (measureIndex === 0) {
        xml.push('<attributes>');
        xml.push(`<divisions>${divisions}</divisions>`);
        xml.push('<key><fifths>0</fifths></key>');
        xml.push('<time><beats>4</beats><beat-type>4</beat-type></time>');
        xml.push(`<staves>${grandStaff ? 2 : 1}</staves>`);
        if (grandStaff) {
          xml.push(`<clef number="1"><sign>${clef.upper.sign}</sign><line>${clef.upper.line}</line></clef>`);
          xml.push(`<clef number="2"><sign>${clef.lower.sign}</sign><line>${clef.lower.line}</line></clef>`);
        } else {
          xml.push(`<clef><sign>${clef.upper.sign}</sign><line>${clef.upper.line}</line></clef>`);
        }
        xml.push('</attributes>');
        xml.push(`<direction placement="above"><direction-type><words>${escapeXml(layerTrack.name)}</words></direction-type></direction>`);
      }
      if (conductor.sectionByMeasure[measureNumber]) {
        xml.push('<direction placement="above"><direction-type><rehearsal>' + escapeXml(conductor.sectionByMeasure[measureNumber]) + '</rehearsal></direction-type></direction>');
      }
      if (conductor.tempoByMeasure[measureNumber]) {
        const tempo = conductor.tempoByMeasure[measureNumber];
        xml.push('<direction placement="above">');
        xml.push('<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>' + tempo.toFixed(2).replace(/\.00$/,'') + '</per-minute></metronome></direction-type>');
        xml.push('<sound tempo="' + tempo.toFixed(2) + '"/>');
        xml.push('</direction>');
      }
      if (bucket.noteVelocities.length) {
        const avgVelocity = bucket.noteVelocities.reduce((sum, value) => sum + value, 0) / bucket.noteVelocities.length;
        xml.push(measureDynamicDirection(dynamicMarkForVelocity(avgVelocity)));
      }
      if (!bucket.voice1.events.length) {
        bucket.voice1.events.push({ startTick: measureIndex * ticksPerMeasure, xml: buildRestXml(ticksPerMeasure, divisions, { voice: 1, staff: 1 }) });
      }
      xml.push(...bucket.voice1.events.map(event => event.xml));
      if (bucket.voice2.events.length || grandStaff) {
        if (!bucket.voice2.events.length) {
          bucket.voice2.events.push({ startTick: measureIndex * ticksPerMeasure, xml: buildRestXml(ticksPerMeasure, divisions, { voice: 2, staff: grandStaff ? 2 : 1 }) });
        }
        xml.push(`<backup><duration>${ticksPerMeasure}</duration></backup>`);
        xml.push(...bucket.voice2.events.map(event => event.xml));
      }
      xml.push('</measure>');
    }
    xml.push('</part>');
    return xml.join('');
  }

  function validateXmlString(xml) {
    const issues = [];
    if (!xml || typeof DOMParser === 'undefined') return issues;
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      issues.push('XML parsererror');
      return issues;
    }
    const parts = Array.from(doc.getElementsByTagName('part'));
    parts.forEach(part => {
      const partId = part.getAttribute('id') || 'P?';
      const measures = Array.from(part.getElementsByTagName('measure'));
      measures.forEach(measure => {
        const measureNumber = measure.getAttribute('number') || '?';
        const children = Array.from(measure.children || []);
        const backups = children.filter(node => node.tagName === 'backup');
        if (backups.length > 1) issues.push(partId + ' m' + measureNumber + ': multiple backup blocks');
        const notes = children.filter(node => node.tagName === 'note');
        let declaredStaves = 1;
        const attributes = children.find(node => node.tagName === 'attributes');
        if (attributes) {
          const stavesNode = attributes.getElementsByTagName('staves')[0];
          if (stavesNode) declaredStaves = Math.max(1, parseInt(stavesNode.textContent || '1', 10) || 1);
        }
        let hasStaff2 = false;
        let hasVoice2 = false;
        notes.forEach(note => {
          const durationNode = note.getElementsByTagName('duration')[0];
          const voiceNode = note.getElementsByTagName('voice')[0];
          const typeNode = note.getElementsByTagName('type')[0];
          const staffNode = note.getElementsByTagName('staff')[0];
          const duration = durationNode ? parseInt(durationNode.textContent || '0', 10) : 0;
          const voice = voiceNode ? (voiceNode.textContent || '') : '';
          const staff = staffNode ? (staffNode.textContent || '') : '1';
          if (!durationNode || duration <= 0) issues.push(partId + ' m' + measureNumber + ': note/rest with invalid duration');
          if (!voiceNode) issues.push(partId + ' m' + measureNumber + ': note/rest missing voice');
          if (!typeNode) issues.push(partId + ' m' + measureNumber + ': note/rest missing type');
          if (voice === '2') hasVoice2 = true;
          if (staff === '2') hasStaff2 = true;
        });
        if (declaredStaves >= 2 && !hasStaff2) issues.push(partId + ' m' + measureNumber + ': grand staff declared without staff 2 content');
        if (backups.length && !hasVoice2) issues.push(partId + ' m' + measureNumber + ': backup present without voice 2 content');
      });
    });
    return [...new Set(issues)].slice(0, 8);
  }

  function normalizeXmlString(xml) {
    if (!xml || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      return { xml, fixes: [] };
    }
    const fixes = [];
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      return { xml, fixes };
    }

    const parts = Array.from(doc.getElementsByTagName('part'));
    parts.forEach(part => {
      const partId = part.getAttribute('id') || 'P?';
      const measures = Array.from(part.getElementsByTagName('measure'));
      measures.forEach(measure => {
        const measureNumber = measure.getAttribute('number') || '?';
        const children = Array.from(measure.children || []);
        const attributes = children.find(node => node.tagName === 'attributes');
        const backups = children.filter(node => node.tagName === 'backup');
        const notes = children.filter(node => node.tagName === 'note');
        const noteDurationValues = notes
          .map(note => {
            const durationNode = note.getElementsByTagName('duration')[0];
            return durationNode ? parseInt(durationNode.textContent || '0', 10) : 0;
          })
          .filter(value => value > 0);
        const fallbackDuration = noteDurationValues[0] || getPPQ();

        notes.forEach(note => {
          let durationNode = note.getElementsByTagName('duration')[0];
          if (!durationNode || parseInt(durationNode.textContent || '0', 10) <= 0) {
            if (!durationNode) {
              durationNode = doc.createElement('duration');
              const restNode = note.getElementsByTagName('rest')[0];
              const insertBefore = restNode ? restNode.nextSibling : note.firstChild;
              note.insertBefore(durationNode, insertBefore || null);
            }
            durationNode.textContent = String(fallbackDuration);
            fixes.push(partId + ' m' + measureNumber + ': normalized missing duration');
          }

          if (!note.getElementsByTagName('voice')[0]) {
            const voiceNode = doc.createElement('voice');
            voiceNode.textContent = backups.length ? '2' : '1';
            note.appendChild(voiceNode);
            fixes.push(partId + ' m' + measureNumber + ': added missing voice');
          }

          if (!note.getElementsByTagName('type')[0]) {
            const typeNode = doc.createElement('type');
            typeNode.textContent = durationType(parseInt(durationNode.textContent || String(fallbackDuration), 10), getPPQ()).name;
            note.appendChild(typeNode);
            fixes.push(partId + ' m' + measureNumber + ': added missing type');
          }

          if (!note.getElementsByTagName('staff')[0]) {
            const staffNode = doc.createElement('staff');
            staffNode.textContent = backups.length ? '2' : '1';
            note.appendChild(staffNode);
            fixes.push(partId + ' m' + measureNumber + ': added missing staff');
          }
        });

        if (backups.length > 1) {
          backups.slice(1).forEach(node => node.remove());
          fixes.push(partId + ' m' + measureNumber + ': removed extra backup blocks');
        }

        const remainingNotes = Array.from(measure.children || []).filter(node => node.tagName === 'note');
        const hasVoice2 = remainingNotes.some(note => {
          const voiceNode = note.getElementsByTagName('voice')[0];
          return voiceNode && voiceNode.textContent === '2';
        });
        const hasStaff2 = remainingNotes.some(note => {
          const staffNode = note.getElementsByTagName('staff')[0];
          return staffNode && staffNode.textContent === '2';
        });

        const backupNodes = Array.from(measure.children || []).filter(node => node.tagName === 'backup');
        if (backupNodes.length && !hasVoice2) {
          backupNodes.forEach(node => node.remove());
          fixes.push(partId + ' m' + measureNumber + ': removed backup without voice 2');
        }

        if (attributes) {
          const stavesNode = attributes.getElementsByTagName('staves')[0];
          const clefNodes = Array.from(attributes.getElementsByTagName('clef'));
          if (stavesNode && parseInt(stavesNode.textContent || '1', 10) >= 2 && !hasStaff2) {
            stavesNode.textContent = '1';
            clefNodes.forEach(clefNode => {
              if (clefNode.getAttribute('number') === '2') clefNode.remove();
              if (clefNode.getAttribute('number') === '1') clefNode.removeAttribute('number');
            });
            fixes.push(partId + ' m' + measureNumber + ': collapsed grand staff without staff 2 content');
          }
        }
      });
    });

    return {
      xml: new XMLSerializer().serializeToString(doc),
      fixes: [...new Set(fixes)].slice(0, 12),
    };
  }

  function summarizeValidationIssues(issues) {
    const summary = {};
    (issues || []).forEach(issue => {
      const kind = String(issue).split(': ').slice(1).join(': ') || String(issue);
      summary[kind] = (summary[kind] || 0) + 1;
    });
    return Object.entries(summary)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind, count]) => count + 'x ' + kind);
  }

  function buildXmlString() {
    if (typeof S === 'undefined' || !S.layerTracks || !S.layerTracks.length) return null;
    const divisions = getPPQ();
    const ticksPerMeasure = divisions * 4;
    const workTitle = [
      'MEIKYOSHISUI',
      S.chord ? (S.chord.rootName + (S.chord.quality || '')) : 'NC',
      S.scale,
      S.genre,
    ].join(' / ');
    const parts = S.layerTracks.map((layerTrack, index) => ({
      id: 'P' + (index + 1),
      name: layerTrack.name,
      xml: buildPartXml(layerTrack, 'P' + (index + 1), divisions, ticksPerMeasure),
    }));
    const header = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
      '<score-partwise version="4.0">',
      '<work><work-title>' + escapeXml(workTitle) + '</work-title></work>',
      '<identification>',
      '<creator type="software">MEIKYOSHISUI v25.7</creator>',
      '<encoding><software>MEIKYOSHISUI Browser Export</software></encoding>',
      '</identification>',
      '<part-list>',
      ...parts.map(part => `<score-part id="${part.id}"><part-name>${escapeXml(part.name)}</part-name></score-part>`),
      '</part-list>',
      ...parts.map(part => part.xml),
      '</score-partwise>',
    ];
    return header.join('');
  }

  function downloadCurrent() {
    const rawXml = buildXmlString();
    if (!rawXml) {
      updateStatus('先に GENERATE を実行してください', 'warn');
      if (typeof log === 'function') log('⚠ GENERATE FIRST FOR MUSICXML EXPORT', 'warn');
      return;
    }
    const normalized = normalizeXmlString(rawXml);
    const xml = normalized.xml;
    const issues = validateXmlString(xml);
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const chord = S.chord ? (S.chord.rootName + (S.chord.quality || '')).replace(/[^a-zA-Z0-9#b_-]/g, '') : 'NC';
    const scale = String(S.scale || 'Scale').replace(/[^a-zA-Z0-9_-]/g, '_');
    anchor.href = url;
    anchor.download = `meiky_${chord}_${scale}_${S.bpm}bpm.musicxml`;
    anchor.click();
    URL.revokeObjectURL(url);
    if (normalized.fixes.length && typeof log === 'function') {
      log('// MUSICXML AUTO-FIX: ' + normalized.fixes.length + ' fixes applied', 'warn');
      normalized.fixes.forEach(fix => log('// MUSICXML FIX: ' + fix, 'warn'));
    }
    if (issues.length) {
      updateStatus('MusicXML を書き出しました (' + normalized.fixes.length + ' fixes / ' + issues.length + ' warnings)', 'warn');
      if (typeof log === 'function') {
        log('// MUSICXML EXPORTED WITH WARNINGS: ' + S.layerTracks.length + ' parts', 'warn');
        summarizeValidationIssues(issues).forEach(line => log('// MUSICXML SUMMARY: ' + line, 'warn'));
        issues.forEach(issue => log('// MUSICXML CHECK: ' + issue, 'warn'));
      }
      return;
    }
    updateStatus('MusicXML を書き出しました (' + normalized.fixes.length + ' fixes)', normalized.fixes.length ? 'warn' : 'ok');
    if (typeof log === 'function') {
      log('// MUSICXML EXPORTED: ' + S.layerTracks.length + ' parts', normalized.fixes.length ? 'warn' : 'ok');
      if (normalized.fixes.length) log('// MUSICXML SUMMARY: auto-fix only, no remaining warnings', 'warn');
    }
  }

  function initUI() {
    const button = document.getElementById('btnMusicXml');
    if (!button) return;
    button.addEventListener('click', downloadCurrent);
  }

  return {
    collectTrackNotes,
    parseConductorTrackData,
    extractConductorInfo,
    buildXmlString,
    normalizeXmlString,
    validateXmlString,
    summarizeValidationIssues,
    downloadCurrent,
    initUI,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof MusicXmlExportEngine !== 'undefined') MusicXmlExportEngine.initUI();
});
