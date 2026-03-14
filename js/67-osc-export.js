const OscExportEngine = (() => {
  'use strict';

  const textEncoder = new TextEncoder();

  function escapeLayerName(name) {
    return String(name || 'Track').replace(/[^a-zA-Z0-9_-]+/g, '_');
  }

  function updateStatus(text, tone) {
    const el = document.getElementById('oscSendStatus');
    if (el) {
      el.textContent = text;
      el.style.color = tone === 'ok' ? 'var(--teal)' : tone === 'warn' ? 'var(--amber)' : 'var(--text-dim)';
    }
    if (typeof S !== 'undefined' && S.oscExport) S.oscExport.lastStatus = text;
  }

  function getPPQ() {
    if (typeof S !== 'undefined' && S.midiData && S.midiData.length >= 14) {
      return (S.midiData[12] << 8) | S.midiData[13];
    }
    return 480;
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

  function buildPayload() {
    if (typeof S === 'undefined' || !S.layerTracks || !S.layerTracks.length) return null;

    const ppq = getPPQ();
    const chordLabel = S.chord ? (S.chord.rootName + (S.chord.quality || '')) : 'N.C.';
    const layers = S.layerTracks.map((layerTrack, index) => {
      const notes = collectTrackNotes(layerTrack.data);
      return {
        index,
        name: layerTrack.name,
        noteCount: notes.length,
        messages: notes.map(note => ({
          address: '/meiky/note',
          args: [layerTrack.name, note.tick, note.duration, note.channel, note.note, note.velocity],
        })),
      };
    });

    return {
      format: 'osc-json-v1',
      generatedAt: new Date().toISOString(),
      meta: {
        bpm: S.bpm,
        bars: S.bars,
        ppq,
        genre: S.genre,
        scale: S.scale,
        chord: chordLabel,
      },
      messages: [
        { address: '/meiky/meta/bpm', args: [S.bpm] },
        { address: '/meiky/meta/bars', args: [S.bars] },
        { address: '/meiky/meta/scale', args: [S.scale] },
        { address: '/meiky/meta/chord', args: [chordLabel] },
      ],
      layers,
      conductorBytes: typeof S.conductorRaw !== 'undefined' && S.conductorRaw ? Array.from(S.conductorRaw) : [],
    };
  }

  function getMode() {
    return typeof S !== 'undefined' && S.oscExport && S.oscExport.mode ? S.oscExport.mode : 'binary';
  }

  function encodeOscString(value) {
    const bytes = [...textEncoder.encode(String(value || ''))];
    bytes.push(0);
    while (bytes.length % 4 !== 0) bytes.push(0);
    return bytes;
  }

  function encodeOscInt32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setInt32(0, value | 0, false);
    return [...out];
  }

  function encodeOscBlob(blobBytes) {
    const bytes = Array.from(blobBytes || []);
    const out = [...encodeOscInt32(bytes.length), ...bytes];
    while (out.length % 4 !== 0) out.push(0);
    return out;
  }

  function encodeOscArg(arg) {
    if (arg instanceof Uint8Array) return { tag: 'b', bytes: encodeOscBlob(arg) };
    if (Array.isArray(arg) && arg.every(item => Number.isInteger(item) && item >= 0 && item <= 255)) {
      return { tag: 'b', bytes: encodeOscBlob(arg) };
    }
    if (typeof arg === 'number' && Number.isFinite(arg)) {
      return { tag: Number.isInteger(arg) ? 'i' : 'f', bytes: Number.isInteger(arg) ? encodeOscInt32(arg) : (() => {
        const out = new Uint8Array(4);
        new DataView(out.buffer).setFloat32(0, arg, false);
        return [...out];
      })() };
    }
    return { tag: 's', bytes: encodeOscString(arg) };
  }

  function encodeOscMessage(address, args = []) {
    const encodedArgs = args.map(encodeOscArg);
    const typeTag = ',' + encodedArgs.map(arg => arg.tag).join('');
    return new Uint8Array([
      ...encodeOscString(address),
      ...encodeOscString(typeTag),
      ...encodedArgs.flatMap(arg => arg.bytes),
    ]);
  }

  function buildOscMessages(payload) {
    const messages = [];
    (payload.messages || []).forEach(message => {
      messages.push({ address: message.address, args: message.args || [] });
    });
    (payload.layers || []).forEach(layer => {
      messages.push({ address: '/meiky/layer', args: [layer.index, layer.name, layer.noteCount] });
      (layer.messages || []).forEach(message => messages.push(message));
    });
    if (payload.conductorBytes && payload.conductorBytes.length) {
      messages.push({ address: '/meiky/meta/conductor', args: [new Uint8Array(payload.conductorBytes)] });
    }
    return messages;
  }

  function encodeOscBundle(payload) {
    const bundleHeader = [...encodeOscString('#bundle'), 0, 0, 0, 0, 0, 0, 0, 1];
    const packets = buildOscMessages(payload).map(message => encodeOscMessage(message.address, message.args));
    const out = [...bundleHeader];
    packets.forEach(packet => {
      out.push(...encodeOscInt32(packet.length), ...packet);
    });
    return new Uint8Array(out);
  }

  function syncModeButtons() {
    const binaryBtn = document.getElementById('oscModeBinary');
    const jsonBtn = document.getElementById('oscModeJson');
    const mode = getMode();
    if (binaryBtn) {
      binaryBtn.style.borderColor = mode === 'binary' ? 'var(--teal)' : 'var(--border)';
      binaryBtn.style.color = mode === 'binary' ? 'var(--teal)' : 'var(--text-dim)';
    }
    if (jsonBtn) {
      jsonBtn.style.borderColor = mode === 'json' ? 'var(--teal)' : 'var(--border)';
      jsonBtn.style.color = mode === 'json' ? 'var(--teal)' : 'var(--text-dim)';
    }
  }

  function validateWsUrl(url) {
    return /^wss?:\/\//i.test(url || '');
  }

  function sendCurrent() {
    const input = document.getElementById('oscWsUrl');
    const url = input ? input.value.trim() : '';
    if (!validateWsUrl(url)) {
      updateStatus('OSC URL は ws:// または wss:// で始めてください', 'warn');
      if (typeof log === 'function') log('⚠ OSC URL INVALID', 'warn');
      return;
    }
    if (typeof S !== 'undefined' && S.oscExport) S.oscExport.url = url;

    const payload = buildPayload();
    if (!payload) {
      updateStatus('先に GENERATE を実行してください', 'warn');
      if (typeof log === 'function') log('⚠ GENERATE FIRST FOR OSC EXPORT', 'warn');
      return;
    }

    updateStatus('OSC bridge 接続中...', 'info');
    const socket = new WebSocket(url);
    const mode = getMode();
    if (mode === 'binary') socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      if (mode === 'binary') {
        const bundle = encodeOscBundle(payload);
        socket.send(bundle.buffer);
      } else {
        socket.send(JSON.stringify(payload));
      }
      socket.close();
      const layerSummary = payload.layers.map(layer => escapeLayerName(layer.name) + ':' + layer.noteCount).join(' / ');
      updateStatus('OSC 送信完了 — ' + payload.layers.length + ' layers (' + mode.toUpperCase() + ')', 'ok');
      if (typeof log === 'function') log('// OSC EXPORT[' + mode.toUpperCase() + ']: ' + payload.layers.length + ' layers — ' + layerSummary, 'ok');
    }, { once: true });
    socket.addEventListener('error', () => {
      updateStatus('OSC bridge 接続失敗 — URL とブリッジ起動状態を確認', 'warn');
      if (typeof log === 'function') log('⚠ OSC EXPORT FAILED', 'warn');
    }, { once: true });
  }

  function initUI() {
    const input = document.getElementById('oscWsUrl');
    const button = document.getElementById('btnOscSend');
    const binaryBtn = document.getElementById('oscModeBinary');
    const jsonBtn = document.getElementById('oscModeJson');
    if (!input || !button) return;
    if (typeof S !== 'undefined' && S.oscExport && S.oscExport.url) input.value = S.oscExport.url;
    input.addEventListener('input', () => {
      if (typeof S !== 'undefined' && S.oscExport) S.oscExport.url = input.value.trim();
    });
    if (binaryBtn) {
      binaryBtn.addEventListener('click', () => {
        if (typeof S !== 'undefined' && S.oscExport) S.oscExport.mode = 'binary';
        syncModeButtons();
      });
    }
    if (jsonBtn) {
      jsonBtn.addEventListener('click', () => {
        if (typeof S !== 'undefined' && S.oscExport) S.oscExport.mode = 'json';
        syncModeButtons();
      });
    }
    button.addEventListener('click', sendCurrent);
    syncModeButtons();
  }

  return {
    buildPayload,
    buildOscMessages,
    encodeOscMessage,
    encodeOscBundle,
    collectTrackNotes,
    sendCurrent,
    initUI,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof OscExportEngine !== 'undefined') OscExportEngine.initUI();
});
