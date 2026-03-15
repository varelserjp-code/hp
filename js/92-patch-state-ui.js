(() => {
  'use strict';

  const PATCH = window.__MEIKY_PATCH__ || {};


  /* v25.7: StatePersist.save / .load / .exportAll / .importAll のパッチは
     元ファイル (29-state-persist.js) に統合済みのため削除。 */

  if (typeof window._updateABPreview === 'function') {
    const originalUpdateABPreview = window._updateABPreview;
    window._updateABPreview = function updateABPreviewPatched() {
      const slot = typeof S !== 'undefined' && S && S.abMode === 'B' ? 'B' : 'A';
      if (PATCH.restoreABVariant(slot)) return;
      originalUpdateABPreview();
      PATCH.syncABUI();
      PATCH.syncMultiExportUI();
      PATCH.syncOscExportUI();
    };
  }

  function installDomFixes() {
    const midiControls = document.getElementById('midiInControls');
    if (midiControls && !document.getElementById('midiMonitorWrap')) {
      const wrap = document.createElement('div');
      wrap.id = 'midiMonitorWrap';
      wrap.style.marginTop = '10px';
      wrap.innerHTML =
        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#7dd3fc;letter-spacing:3px;margin:10px 0 6px;">MIDI MONITOR / LEARN</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">' +
          '<select id="midiLearnTarget" class="midi-in-select" style="min-width:140px;"></select>' +
          '<button class="midi-in-btn" id="midiLearnArmBtn" type="button">ARM LEARN</button>' +
          '<button class="midi-in-btn" id="midiLearnClearBtn" type="button">CLEAR MAP</button>' +
        '</div>' +
        '<div class="midi-in-status dim" id="midiLearnStatus">LEARN IDLE</div>' +
        '<div class="midi-in-status dim" id="midiLearnMap">MAP: —</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 6px;">' +
          '<button class="midi-in-btn" id="midiCaptureTog" type="button">CAPTURE TO PROG</button>' +
          '<button class="midi-in-btn" id="midiCaptureNowBtn" type="button">ADD CURRENT</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">' +
          '<select id="midiCaptureMode" class="midi-in-select" style="min-width:140px;">' +
            '<option value="stable">STABLE HOLD</option>' +
            '<option value="release">NOTE-OFF CONFIRM</option>' +
          '</select>' +
          '<button class="midi-in-btn on" id="midiCaptureIgnoreInv" type="button">IGNORE INVERSIONS</button>' +
        '</div>' +
        '<div class="param-row" style="margin-bottom:6px;">' +
          '<span class="param-label" style="min-width:72px;">Hold ms</span>' +
          '<input type="range" id="midiCaptureHoldMs" min="0" max="1200" step="10" value="180" style="flex:1;">' +
          '<div class="pval" id="midiCaptureHoldMsV">180 ms</div>' +
        '</div>' +
        '<div class="param-row" style="margin-bottom:6px;">' +
          '<span class="param-label" style="min-width:72px;">Min vel</span>' +
          '<input type="range" id="midiCaptureMinVel" min="1" max="127" step="1" value="1" style="flex:1;">' +
          '<div class="pval" id="midiCaptureMinVelV">1</div>' +
        '</div>' +
        '<div class="midi-in-status dim" id="midiCaptureStatus">CAPTURE IDLE</div>' +
        '<pre id="midiMonitorLog" style="margin:8px 0 0;padding:8px 10px;min-height:78px;max-height:120px;overflow:auto;background:rgba(255,255,255,.03);border:1px solid var(--border);color:var(--text-dim);font-family:\'Share Tech Mono\',monospace;font-size:8px;line-height:1.6;white-space:pre-wrap;">MONITOR: waiting for MIDI input</pre>' +
        '<div id="patchDiagnostics" style="margin:10px 0 0;padding:8px 10px;border:1px solid var(--border);background:rgba(255,255,255,.03);font-family:\'Share Tech Mono\',monospace;font-size:8px;line-height:1.7;letter-spacing:1px;color:var(--text-dim);">PATCH DIAGNOSTICS</div>';
      midiControls.appendChild(wrap);
    }

    const oscSendButton = document.getElementById('btnOscSend');
    const oscStatus = document.getElementById('oscSendStatus');
    if (oscSendButton && oscStatus && !document.getElementById('btnOscTest')) {
      const oscActions = oscSendButton.parentNode;
      if (oscActions) {
        const testBtn = document.createElement('button');
        testBtn.id = 'btnOscTest';
        testBtn.className = 'btn-dl show';
        testBtn.type = 'button';
        testBtn.textContent = '⇢ TEST LINK';
        testBtn.style.display = 'block';
        testBtn.style.fontSize = '10px';
        testBtn.style.padding = '12px 18px';
        testBtn.style.letterSpacing = '2px';
        testBtn.style.opacity = '0.85';
        oscActions.insertBefore(testBtn, oscStatus);

        const diag = document.createElement('div');
        diag.id = 'oscTestStatus';
        diag.style.fontFamily = "'Share Tech Mono',monospace";
        diag.style.fontSize = '8px';
        diag.style.color = 'var(--text-dim)';
        diag.style.letterSpacing = '1px';
        diag.style.lineHeight = '1.6';
        diag.style.marginTop = '6px';
        diag.textContent = 'OSC TEST 未実行';
        oscActions.insertBefore(diag, oscStatus);

        const payload = document.createElement('div');
        payload.id = 'oscPayloadPreview';
        payload.style.fontFamily = "'Share Tech Mono',monospace";
        payload.style.fontSize = '8px';
        payload.style.color = 'var(--text-dim)';
        payload.style.letterSpacing = '1px';
        payload.style.lineHeight = '1.6';
        payload.style.marginTop = '6px';
        payload.textContent = 'PAYLOAD PREVIEW: unavailable';
        oscActions.insertBefore(payload, oscStatus);
      }
    }

    const jiPanel = document.getElementById('jiPanel');
    const jiCanvas = document.getElementById('jiDeviationCanvas');
    if (jiPanel && jiCanvas && !document.getElementById('jiAdaptiveMemoryRow')) {
      const wrap = document.createElement('div');
      wrap.id = 'jiAdaptiveMemoryRow';
      wrap.innerHTML =
        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#5b8;letter-spacing:3px;margin:10px 0 6px;">ADAPTIVE MEMORY</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">' +
          '<button class="midi-in-btn" id="jiAdaptiveMemoryBtn" type="button">COMMON-TONE MEMORY</button>' +
          '<button class="midi-in-btn" id="jiAdaptiveSectionBtn" type="button">RESET ON SECTION</button>' +
          '<button class="midi-in-btn" id="jiAdaptiveCadenceBtn" type="button">CADENCE RESET</button>' +
          '<button class="midi-in-btn" id="jiSectionModBtn" type="button">SECTION MODULATION</button>' +
          '<button class="midi-in-btn" id="jiSectionFollowBtn" type="button">FOLLOW PREVIEW</button>' +
          '<div id="jiAdaptiveMemoryInfo" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--text-dim);letter-spacing:1px;">ADAPTIVE MEMORY OFF</div>' +
        '</div>' +
        '<div class="param-row" style="margin-bottom:10px;">' +
          '<span class="param-label" style="min-width:84px;">Strength</span>' +
          '<input type="range" id="jiAdaptiveMemoryStrength" min="0" max="100" value="65" step="1" style="flex:1;">' +
          '<div id="jiAdaptiveMemoryStrengthV" style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:var(--cyan);min-width:36px;">65%</div>' +
        '</div>' +
        '<div class="param-row" style="margin-bottom:10px;">' +
          '<span class="param-label" style="min-width:84px;">Bass Bias</span>' +
          '<input type="range" id="jiAdaptiveBassBias" min="0" max="100" value="0" step="1" style="flex:1;">' +
          '<div id="jiAdaptiveBassBiasV" style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:var(--cyan);min-width:36px;">0%</div>' +
        '</div>' +
        '<div class="param-row" style="margin-bottom:10px;">' +
          '<span class="param-label" style="min-width:84px;">VL Bias</span>' +
          '<input type="range" id="jiAdaptiveVoiceLeading" min="0" max="100" value="0" step="1" style="flex:1;">' +
          '<div id="jiAdaptiveVoiceLeadingV" style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:var(--cyan);min-width:36px;">0%</div>' +
        '</div>' +
        '<div class="param-row" style="margin-bottom:10px;">' +
          '<span class="param-label" style="min-width:84px;">Cadence</span>' +
          '<input type="range" id="jiAdaptiveCadenceStrength" min="0" max="100" value="80" step="1" style="flex:1;">' +
          '<div id="jiAdaptiveCadenceStrengthV" style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:var(--cyan);min-width:36px;">80%</div>' +
        '</div>' +
        '<div id="jiSectionProfiles" style="display:none;"></div>';
      jiCanvas.parentNode.insertBefore(wrap, jiCanvas);
    }

    const multiGrid = document.getElementById('meLayerGrid');
    if (multiGrid && !document.getElementById('meManifestRow')) {
      const wrap = document.createElement('div');
      wrap.id = 'meManifestRow';
      wrap.style.marginBottom = '12px';
      wrap.innerHTML =
        '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
          '<div class="tog-row" style="margin:0;padding:0;border-bottom:none;">' +
            '<div class="tog-info" style="min-width:auto;">' +
              '<div class="tog-name" style="font-size:9px;">Include Manifest</div>' +
              '<div class="tog-desc">Stem export と一緒に再現用 JSON を出力</div>' +
            '</div>' +
            '<div class="tog" id="meManifest"></div>' +
            '<span class="pval" id="meManifestV">OFF</span>' +
          '</div>' +
          '<button class="btn-dl show" id="btnManifestDl" type="button" style="font-size:10px;padding:12px 18px;letter-spacing:2px;">⇣ MANIFEST JSON</button>' +
        '</div>';
      multiGrid.parentNode.insertBefore(wrap, multiGrid);
    }

    const compControls = document.getElementById('compTuningControls');
    if (compControls && !document.getElementById('ctScalaRow')) {
      PATCH.initScalaPresets();
      const presetHtml = PATCH.SCALA_PRESETS.map(preset =>
        '<button class="midi-in-btn" type="button" data-scala-preset="' + preset.id + '" title="' + preset.desc + '">' +
        preset.label +
        '</button>'
      ).join('');
      const favoriteHtml = PATCH.SCALA_FAVORITE_SLOTS.map(slot =>
        '<button class="midi-in-btn" type="button" data-scala-favorite="' + slot + '" title="Click to load, Option/Alt+Click to save current Scala, Shift+Option/Alt+Click to clear">' +
        slot +
        '</button>'
      ).join('');
      const scalaWrap = document.createElement('div');
      scalaWrap.id = 'ctScalaRow';
      scalaWrap.innerHTML =
        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#555;letter-spacing:3px;margin:12px 0 6px;">SCALA IMPORT</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">' +
          '<button class="midi-in-btn" id="ctScalaSclBtn" type="button">LOAD .SCL</button>' +
          '<button class="midi-in-btn" id="ctScalaKbmBtn" type="button">LOAD .KBM</button>' +
          '<button class="midi-in-btn" id="ctScalaClear" type="button">CLEAR</button>' +
          '<input id="ctScalaSclInput" type="file" accept=".scl,text/plain" style="display:none;">' +
          '<input id="ctScalaKbmInput" type="file" accept=".kbm,text/plain" style="display:none;">' +
        '</div>' +
        '<div id="ctScalaPresetGrid" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + presetHtml + '</div>' +
        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:7px;color:#666;letter-spacing:2px;margin:0 0 6px;">FAVORITES  Option/Alt+Click = SAVE  Shift+Option/Alt+Click = CLEAR</div>' +
        '<div id="ctScalaFavoriteGrid" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + favoriteHtml + '</div>' +
        '<div id="ctScalaStatus" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#8a8a8a;letter-spacing:1px;line-height:1.8;padding:8px 10px;border:1px solid var(--border);background:rgba(255,255,255,.03);margin-bottom:12px;">NO SCALA FILE LOADED</div>';
      const rootRow = document.getElementById('ctRootPc');
      const rootParamRow = rootRow ? rootRow.closest('.param-row') : null;
      if (rootParamRow && rootParamRow.parentNode) rootParamRow.parentNode.insertBefore(scalaWrap, rootParamRow);
      else compControls.appendChild(scalaWrap);
    }

    if (compControls && !document.getElementById('ctSectionRow')) {
      const sectionWrap = document.createElement('div');
      sectionWrap.id = 'ctSectionRow';
      sectionWrap.innerHTML =
        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:#5b8;letter-spacing:3px;margin:12px 0 6px;">SECTION MODULATION</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">' +
          '<button class="midi-in-btn" id="ctSectionModBtn" type="button">SECTION TUNING</button>' +
          '<button class="midi-in-btn" id="ctSectionFollowBtn" type="button">FOLLOW PREVIEW</button>' +
          '<div id="ctSectionInfo" style="font-family:\'Share Tech Mono\',monospace;font-size:8px;color:var(--text-dim);letter-spacing:1px;">SECTION TUNING OFF</div>' +
        '</div>' +
        '<div id="ctSectionProfiles" style="display:none;"></div>';
      compControls.appendChild(sectionWrap);
    }

    if (typeof MidiInputEngine !== 'undefined' && typeof MidiInputEngine.enable === 'function') {
      const originalEnable = MidiInputEngine.enable.bind(MidiInputEngine);
      MidiInputEngine.enable = async function enableWithWrappedHandlers() {
        const result = await originalEnable();
        PATCH.wrapMidiInputHandlers();

        const access = MidiInputEngine.STATE && MidiInputEngine.STATE.access;
        if (access && !access.__meikyFixWrappedStatechange) {
          const originalStateChange = access.onstatechange;
          access.onstatechange = event => {
            if (typeof originalStateChange === 'function') originalStateChange(event);
            PATCH.wrapMidiInputHandlers();
          };
          access.__meikyFixWrappedStatechange = true;
        }
        return result;
      };

    const refreshBtn = document.getElementById('midiInRefreshBtn');
    const select = document.getElementById('midiInSelect');
    const midiLearnTarget = document.getElementById('midiLearnTarget');
    const midiLearnArmBtn = document.getElementById('midiLearnArmBtn');
    const midiLearnClearBtn = document.getElementById('midiLearnClearBtn');
    const midiCaptureTog = document.getElementById('midiCaptureTog');
    const midiCaptureNowBtn = document.getElementById('midiCaptureNowBtn');
    const midiCaptureMode = document.getElementById('midiCaptureMode');
    const midiCaptureHoldMs = document.getElementById('midiCaptureHoldMs');
    const midiCaptureMinVel = document.getElementById('midiCaptureMinVel');
    const midiCaptureIgnoreInv = document.getElementById('midiCaptureIgnoreInv');
    if (refreshBtn) refreshBtn.addEventListener('click', () => setTimeout(PATCH.wrapMidiInputHandlers, 0));
    if (select) select.addEventListener('change', () => setTimeout(PATCH.wrapMidiInputHandlers, 0));
    if (midiLearnArmBtn && midiLearnTarget) {
      midiLearnArmBtn.addEventListener('click', () => {
        PATCH.armMidiLearn(midiLearnTarget.value);
      });
    }
    if (midiLearnClearBtn) {
      midiLearnClearBtn.addEventListener('click', () => {
        const target = PATCH.midiMonitorState && PATCH.midiMonitorState.armedTarget;
        PATCH.armMidiLearn('');
        const mappings = PATCH.readMidiLearnMappings();
        Object.keys(mappings).forEach(cc => {
          if (!target || mappings[cc] === midiLearnTarget.value) delete mappings[cc];
        });
        PATCH.writeMidiLearnMappings(mappings);
        PATCH.pushMidiMonitorEvent('LEARN MAP CLEARED');
        PATCH.syncMidiMonitorUI();
      });
    }
    if (midiCaptureTog) {
      midiCaptureTog.addEventListener('click', () => {
        PATCH.setMidiCaptureEnabled(!(PATCH.midiCaptureState && PATCH.midiCaptureState.enabled));
      });
    }
    if (midiCaptureNowBtn) {
      midiCaptureNowBtn.addEventListener('click', () => {
        PATCH.captureCurrentMidiChordToProgression();
      });
    }
    if (midiCaptureMode) {
      midiCaptureMode.addEventListener('change', () => {
        PATCH.ensureMidiCapturePolicy().mode = midiCaptureMode.value === 'release' ? 'release' : 'stable';
        PATCH.syncMidiMonitorUI();
      });
    }
    if (midiCaptureHoldMs) {
      midiCaptureHoldMs.addEventListener('input', () => {
        PATCH.ensureMidiCapturePolicy().holdMs = Math.max(0, Math.min(1200, parseInt(midiCaptureHoldMs.value, 10) || 0));
        PATCH.syncMidiMonitorUI();
      });
    }
    if (midiCaptureMinVel) {
      midiCaptureMinVel.addEventListener('input', () => {
        PATCH.ensureMidiCapturePolicy().minVelocity = Math.max(1, Math.min(127, parseInt(midiCaptureMinVel.value, 10) || 1));
        PATCH.syncMidiMonitorUI();
      });
    }
    if (midiCaptureIgnoreInv) {
      midiCaptureIgnoreInv.addEventListener('click', () => {
        const policy = PATCH.ensureMidiCapturePolicy();
        policy.ignoreInversions = !policy.ignoreInversions;
        PATCH.syncMidiMonitorUI();
      });
    }
    }

    const editBtn = document.getElementById('cvEditBtn');
    const resetBtn = document.getElementById('cvResetBtn');
    const caOverrideTog = document.getElementById('caOverrideTog');
    const caRule = document.getElementById('caRule');
    const caSeedRow = document.getElementById('caSeedRow');
    const modeRow = document.getElementById('jiModeRow');
    const jiBlend = document.getElementById('jiBlend');
    const jiHarmonic = document.getElementById('jiHarmonicLimit');
    const rcModeRow = document.getElementById('rcModeRow');
    const rcN = document.getElementById('rcN');
    const rcVoices = document.getElementById('rcVoices');
    const rcMessiaen = document.getElementById('rcMessiaenPattern');
    const rcPolymeter = document.getElementById('rcPolymeterCycles');
    const barsInput = document.getElementById('bars');
    const curveAmpInput = document.getElementById('curveAmp');
    const chainBSelect = document.getElementById('chainBSelect');
    const togMacro = document.getElementById('togMacro');

    PATCH.syncCAPreviewUI();
    PATCH.syncAttractorUI();
    PATCH.syncJustIntonationUI();
    PATCH.syncRhythmicCanonsUI();
    PATCH.syncConductorVizUI();
    PATCH.syncGeneratedOutputUI();
    PATCH.syncBinauralUI();
    PATCH.syncConcertPitchUI();
    PATCH.syncScalaUI();
    PATCH.syncCompSectionUI();
    PATCH.syncMidiMonitorUI();
    PATCH.installOscSendOverride();

    if (typeof window.addUpdateTheoryHook === 'function') {
      window.addUpdateTheoryHook(() => {
        PATCH.syncCAPreviewUI();
        PATCH.syncJustIntonationUI();
        PATCH.syncCompSectionUI();
      });
    }

    if (caOverrideTog) caOverrideTog.addEventListener('click', () => setTimeout(PATCH.syncCAPreviewUI, 0));
    if (caRule) caRule.addEventListener('input', () => setTimeout(PATCH.syncCAPreviewUI, 0));
    if (caSeedRow) caSeedRow.addEventListener('click', () => setTimeout(PATCH.syncCAPreviewUI, 0));
    if (modeRow) modeRow.addEventListener('click', () => setTimeout(PATCH.syncJustIntonationUI, 0));
    if (jiBlend) jiBlend.addEventListener('input', () => setTimeout(PATCH.syncJustIntonationUI, 0));
    if (jiHarmonic) jiHarmonic.addEventListener('input', () => setTimeout(PATCH.syncJustIntonationUI, 0));
    if (rcModeRow) rcModeRow.addEventListener('click', () => setTimeout(PATCH.syncRhythmicCanonsUI, 0));
    if (rcN) rcN.addEventListener('input', () => setTimeout(PATCH.syncRhythmicCanonsUI, 0));
    if (rcVoices) rcVoices.addEventListener('input', () => setTimeout(PATCH.syncRhythmicCanonsUI, 0));
    if (rcMessiaen) rcMessiaen.addEventListener('change', () => setTimeout(PATCH.syncRhythmicCanonsUI, 0));
    if (rcPolymeter) rcPolymeter.addEventListener('change', () => setTimeout(PATCH.syncRhythmicCanonsUI, 0));
    if (editBtn) editBtn.addEventListener('click', () => setTimeout(PATCH.syncConductorVizUI, 0));
    if (resetBtn) resetBtn.addEventListener('click', () => setTimeout(PATCH.syncConductorVizUI, 0));
    if (barsInput) barsInput.addEventListener('input', () => setTimeout(PATCH.syncCompSectionUI, 0));
    if (curveAmpInput) curveAmpInput.addEventListener('input', () => setTimeout(PATCH.syncCompSectionUI, 0));
    if (chainBSelect) chainBSelect.addEventListener('change', () => setTimeout(PATCH.syncCompSectionUI, 0));
    if (togMacro) togMacro.addEventListener('click', () => setTimeout(PATCH.syncCompSectionUI, 0));

    const abPanel = document.getElementById('abPanel');
    const multiDownload = document.getElementById('btnMultiDl');
    const multiPrefix = document.getElementById('mePfx');
    const multiNumberPad = document.getElementById('meNumPad');
    const multiConductor = document.getElementById('meCond');
    const multiManifest = document.getElementById('meManifest');
    const manifestBtn = document.getElementById('btnManifestDl');
    const oscBinary = document.getElementById('oscModeBinary');
    const oscJson = document.getElementById('oscModeJson');
    const oscUrl = document.getElementById('oscWsUrl');
    const oscTestBtn = document.getElementById('btnOscTest');
    const jiAdaptiveBtn = document.getElementById('jiAdaptiveMemoryBtn');
    const jiAdaptiveSectionBtn = document.getElementById('jiAdaptiveSectionBtn');
    const jiAdaptiveCadenceBtn = document.getElementById('jiAdaptiveCadenceBtn');
    const jiSectionModBtn = document.getElementById('jiSectionModBtn');
    const jiSectionFollowBtn = document.getElementById('jiSectionFollowBtn');
    const jiSectionProfiles = document.getElementById('jiSectionProfiles');
    const jiAdaptiveStrength = document.getElementById('jiAdaptiveMemoryStrength');
    const jiAdaptiveBassBias = document.getElementById('jiAdaptiveBassBias');
    const jiAdaptiveVoiceLeading = document.getElementById('jiAdaptiveVoiceLeading');
    const jiAdaptiveCadenceStrength = document.getElementById('jiAdaptiveCadenceStrength');
    const a4Slider = document.getElementById('ctA4Slider');
    const a4Presets = document.getElementById('ctA4Presets');
    const globalCents = document.getElementById('ctGlobalCents');
    const rootPc = document.getElementById('ctRootPc');
    const ctSectionModBtn = document.getElementById('ctSectionModBtn');
    const ctSectionFollowBtn = document.getElementById('ctSectionFollowBtn');
    const ctSectionProfiles = document.getElementById('ctSectionProfiles');
    const scalaSclBtn = document.getElementById('ctScalaSclBtn');
    const scalaKbmBtn = document.getElementById('ctScalaKbmBtn');
    const scalaClearBtn = document.getElementById('ctScalaClear');
    const scalaSclInput = document.getElementById('ctScalaSclInput');
    const scalaKbmInput = document.getElementById('ctScalaKbmInput');
    const scalaPresetGrid = document.getElementById('ctScalaPresetGrid');
    const scalaFavoriteGrid = document.getElementById('ctScalaFavoriteGrid');
    if (abPanel) abPanel.addEventListener('click', () => setTimeout(PATCH.syncABUI, 0));
    if (multiPrefix) multiPrefix.addEventListener('input', () => setTimeout(PATCH.syncMultiExportUI, 0));
    if (multiNumberPad) multiNumberPad.addEventListener('click', () => setTimeout(PATCH.syncMultiExportUI, 0));
    if (multiConductor) multiConductor.addEventListener('click', () => setTimeout(PATCH.syncMultiExportUI, 0));
    if (multiManifest) {
      multiManifest.addEventListener('click', () => {
        if (typeof S !== 'undefined' && S && S.multiExport) S.multiExport.includeManifest = !S.multiExport.includeManifest;
        PATCH.syncMultiExportUI();
      });
    }
    if (multiDownload) {
      multiDownload.addEventListener('click', () => {
        if (typeof S === 'undefined' || !S || !S.multiExport || !S.multiExport.includeManifest) return;
        const files = Array.isArray(S.layerTracks)
          ? S.layerTracks
              .filter(track => S.multiExport.layers[track.name] !== false)
              .map((track, index) => ({
                name: track.name,
                filename:
                  ((S.multiExport.prefix || 'void').replace(/[^a-zA-Z0-9_-]/g, '_') || 'void') +
                  '_' +
                  (S.multiExport.numberPad ? String(index + 1).padStart(2, '0') + '_' : '') +
                  track.name.replace(/[\/ ]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') +
                  '.mid',
              }))
          : [];
        setTimeout(() => PATCH.downloadExportManifest('multi-export', files), 0);
      });
    }
    if (manifestBtn) {
      manifestBtn.addEventListener('click', () => {
        PATCH.downloadExportManifest('manual', []);
      });
    }
    if (oscBinary) oscBinary.addEventListener('click', () => setTimeout(PATCH.syncOscExportUI, 0));
    if (oscJson) oscJson.addEventListener('click', () => setTimeout(PATCH.syncOscExportUI, 0));
    if (oscUrl) oscUrl.addEventListener('input', () => setTimeout(PATCH.syncOscExportUI, 0));
    if (oscTestBtn) {
      oscTestBtn.addEventListener('click', async () => {
        await PATCH.testOscConnection();
      });
    }
    if (jiAdaptiveBtn) {
      jiAdaptiveBtn.addEventListener('click', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveMemoryEnabled = !JI_PARAMS.adaptiveMemoryEnabled;
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiAdaptiveSectionBtn) {
      jiAdaptiveSectionBtn.addEventListener('click', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveResetOnSection = !JI_PARAMS.adaptiveResetOnSection;
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiAdaptiveCadenceBtn) {
      jiAdaptiveCadenceBtn.addEventListener('click', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveCadenceResetEnabled = !JI_PARAMS.adaptiveCadenceResetEnabled;
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiSectionModBtn) {
      jiSectionModBtn.addEventListener('click', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.sectionModEnabled = !JI_PARAMS.sectionModEnabled;
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiSectionFollowBtn) {
      jiSectionFollowBtn.addEventListener('click', () => {
        PATCH.ensureSectionPreviewFollow().ji = !PATCH.ensureSectionPreviewFollow().ji;
        PATCH.syncPreviewLinkedSectionFocus((PATCH.previewTransportState && PATCH.previewTransportState.bar) || 0, {
          playing: !!(PATCH.previewTransportState && PATCH.previewTransportState.playing),
          force: true,
        });
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiAdaptiveStrength) {
      jiAdaptiveStrength.addEventListener('input', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveMemoryStrength = Math.max(0, Math.min(1, parseInt(jiAdaptiveStrength.value, 10) / 100));
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiAdaptiveBassBias) {
      jiAdaptiveBassBias.addEventListener('input', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveBassAnchorStrength = Math.max(0, Math.min(1, parseInt(jiAdaptiveBassBias.value, 10) / 100));
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiAdaptiveVoiceLeading) {
      jiAdaptiveVoiceLeading.addEventListener('input', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveVoiceLeadingStrength = Math.max(0, Math.min(1, parseInt(jiAdaptiveVoiceLeading.value, 10) / 100));
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiAdaptiveCadenceStrength) {
      jiAdaptiveCadenceStrength.addEventListener('input', () => {
        if (typeof JI_PARAMS === 'undefined') return;
        JI_PARAMS.adaptiveCadenceResetStrength = Math.max(0, Math.min(1, parseInt(jiAdaptiveCadenceStrength.value, 10) / 100));
        PATCH.syncJustIntonationUI();
      });
    }
    if (jiSectionProfiles) {
      jiSectionProfiles.addEventListener('input', event => {
        if (typeof JI_PARAMS === 'undefined' || !Array.isArray(JI_PARAMS.sectionProfiles)) return;
        const target = event.target;
        const modeIndex = target.dataset.jiSectionMode;
        const blendIndex = target.dataset.jiSectionBlend;
        const harmonicIndex = target.dataset.jiSectionHarmonic;
        const bassIndex = target.dataset.jiSectionBass;
        const vlIndex = target.dataset.jiSectionVl;
        const cadenceIndex = target.dataset.jiSectionCadence;
        if (modeIndex != null && JI_PARAMS.sectionProfiles[modeIndex]) {
          JI_PARAMS.sectionProfiles[modeIndex].mode = target.value;
        }
        if (blendIndex != null && JI_PARAMS.sectionProfiles[blendIndex]) {
          JI_PARAMS.sectionProfiles[blendIndex].blend = Math.max(0, Math.min(1, parseInt(target.value, 10) / 100));
        }
        if (harmonicIndex != null && JI_PARAMS.sectionProfiles[harmonicIndex]) {
          JI_PARAMS.sectionProfiles[harmonicIndex].harmonicLimit = parseInt(target.value, 10);
        }
        if (bassIndex != null && JI_PARAMS.sectionProfiles[bassIndex]) {
          JI_PARAMS.sectionProfiles[bassIndex].adaptiveBassAnchorStrength = Math.max(0, Math.min(1, parseInt(target.value, 10) / 100));
        }
        if (vlIndex != null && JI_PARAMS.sectionProfiles[vlIndex]) {
          JI_PARAMS.sectionProfiles[vlIndex].adaptiveVoiceLeadingStrength = Math.max(0, Math.min(1, parseInt(target.value, 10) / 100));
        }
        if (cadenceIndex != null && JI_PARAMS.sectionProfiles[cadenceIndex]) {
          JI_PARAMS.sectionProfiles[cadenceIndex].adaptiveCadenceResetStrength = Math.max(0, Math.min(1, parseInt(target.value, 10) / 100));
        }
        PATCH.syncJustIntonationUI();
      });
      jiSectionProfiles.addEventListener('change', event => {
        if (event.target.dataset.jiSectionMode != null) PATCH.syncJustIntonationUI();
      });
      jiSectionProfiles.addEventListener('click', event => {
        if (typeof JI_PARAMS === 'undefined' || !Array.isArray(JI_PARAMS.sectionProfiles)) return;
        const target = event.target;
        const sectionCard = target instanceof HTMLElement ? target.closest('[data-ji-section-index]') : null;
        const cadenceBtnIndex = target.dataset.jiSectionCadenceBtn;
        if (sectionCard && sectionCard.dataset.jiSectionIndex != null) {
          __MEIKY_PATCH__.sectionLearnFocus.ji = parseInt(sectionCard.dataset.jiSectionIndex, 10) || 0;
        }
        if (cadenceBtnIndex != null && JI_PARAMS.sectionProfiles[cadenceBtnIndex]) {
          JI_PARAMS.sectionProfiles[cadenceBtnIndex].adaptiveCadenceResetEnabled =
            !JI_PARAMS.sectionProfiles[cadenceBtnIndex].adaptiveCadenceResetEnabled;
        }
        PATCH.syncJustIntonationUI();
      });
    }
    if (a4Slider) a4Slider.addEventListener('input', () => setTimeout(() => {
      PATCH.refreshScalaProfile(false);
      PATCH.syncBinauralUI();
      PATCH.syncConcertPitchUI();
      PATCH.syncScalaUI();
    }, 0));
    if (a4Presets) a4Presets.addEventListener('click', () => setTimeout(() => {
      PATCH.refreshScalaProfile(false);
      PATCH.syncBinauralUI();
      PATCH.syncConcertPitchUI();
      PATCH.syncScalaUI();
    }, 0));
    if (globalCents) globalCents.addEventListener('input', () => setTimeout(PATCH.syncConcertPitchUI, 0));
    if (rootPc) rootPc.addEventListener('input', () => setTimeout(() => {
      PATCH.refreshScalaProfile(false);
      if (typeof CompTuningEngine !== 'undefined' && typeof CompTuningEngine.buildIntervalGrid === 'function') {
        CompTuningEngine.buildIntervalGrid();
      }
      if (typeof CompTuningEngine !== 'undefined' && typeof CompTuningEngine.updateDisplay === 'function') {
        CompTuningEngine.updateDisplay();
      }
      PATCH.syncScalaUI();
      PATCH.syncCompSectionUI();
    }, 0));
    if (ctSectionModBtn) {
      ctSectionModBtn.addEventListener('click', () => {
        if (typeof CompTuningEngine === 'undefined' || !CompTuningEngine.STATE) return;
        CompTuningEngine.STATE.sectionModEnabled = !CompTuningEngine.STATE.sectionModEnabled;
        PATCH.syncCompSectionUI();
      });
    }
    if (ctSectionFollowBtn) {
      ctSectionFollowBtn.addEventListener('click', () => {
        PATCH.ensureSectionPreviewFollow().comp = !PATCH.ensureSectionPreviewFollow().comp;
        PATCH.syncPreviewLinkedSectionFocus((PATCH.previewTransportState && PATCH.previewTransportState.bar) || 0, {
          playing: !!(PATCH.previewTransportState && PATCH.previewTransportState.playing),
          force: true,
        });
        PATCH.syncCompSectionUI();
      });
    }
    if (ctSectionProfiles) {
      ctSectionProfiles.addEventListener('input', event => {
        if (typeof CompTuningEngine === 'undefined' ||
            !CompTuningEngine.STATE ||
            !Array.isArray(CompTuningEngine.STATE.sectionProfiles)) return;
        const target = event.target;
        const a4Index = target.dataset.ctSectionA4;
        const centsIndex = target.dataset.ctSectionCents;
        const rootIndex = target.dataset.ctSectionRoot;
        const scalaIndex = target.dataset.ctSectionScala;
        if (a4Index != null && CompTuningEngine.STATE.sectionProfiles[a4Index]) {
          CompTuningEngine.STATE.sectionProfiles[a4Index].a4Hz = parseFloat(target.value);
        }
        if (centsIndex != null && CompTuningEngine.STATE.sectionProfiles[centsIndex]) {
          CompTuningEngine.STATE.sectionProfiles[centsIndex].globalCents = parseFloat(target.value);
        }
        if (rootIndex != null && CompTuningEngine.STATE.sectionProfiles[rootIndex]) {
          CompTuningEngine.STATE.sectionProfiles[rootIndex].rootPc = parseInt(target.value, 10);
        }
        if (scalaIndex != null && CompTuningEngine.STATE.sectionProfiles[scalaIndex]) {
          CompTuningEngine.STATE.sectionProfiles[scalaIndex].scalaSource = target.value;
        }
        PATCH.syncCompSectionUI();
      });
      ctSectionProfiles.addEventListener('change', event => {
        if (event.target.dataset.ctSectionScala != null) PATCH.syncCompSectionUI();
      });
      ctSectionProfiles.addEventListener('click', event => {
        const target = event.target instanceof HTMLElement ? event.target.closest('[data-ct-section-index]') : null;
        if (!target || target.dataset.ctSectionIndex == null) return;
        __MEIKY_PATCH__.sectionLearnFocus.comp = parseInt(target.dataset.ctSectionIndex, 10) || 0;
        PATCH.syncCompSectionUI();
      });
    }

    const readFileText = file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsText(file);
    });

    if (scalaSclBtn && scalaSclInput) {
      scalaSclBtn.addEventListener('click', () => scalaSclInput.click());
      scalaSclInput.addEventListener('change', async () => {
        const file = scalaSclInput.files && scalaSclInput.files[0];
        if (!file) return;
        try {
          const text = await readFileText(file);
          const current = (typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE && CompTuningEngine.STATE.scalaProfile) || {};
          PATCH.importScalaProfile(text, current.kbmText || '', file.name, current.kbmName || '');
          PATCH.syncScalaUI();
          PATCH.syncCompSectionUI();
        } catch (error) {
          const status = document.getElementById('ctScalaStatus');
          if (status) status.textContent = 'SCALA LOAD ERROR: ' + (error && error.message ? error.message : error);
        } finally {
          scalaSclInput.value = '';
        }
      });
    }

    if (scalaKbmBtn && scalaKbmInput) {
      scalaKbmBtn.addEventListener('click', () => scalaKbmInput.click());
      scalaKbmInput.addEventListener('change', async () => {
        const file = scalaKbmInput.files && scalaKbmInput.files[0];
        if (!file) return;
        try {
          const text = await readFileText(file);
          const current = (typeof CompTuningEngine !== 'undefined' && CompTuningEngine.STATE && CompTuningEngine.STATE.scalaProfile) || {};
          if (!current.sclText) throw new Error('load .scl first');
          PATCH.importScalaProfile(current.sclText, text, current.sclName || 'Scala', file.name);
          PATCH.syncScalaUI();
          PATCH.syncCompSectionUI();
        } catch (error) {
          const status = document.getElementById('ctScalaStatus');
          if (status) status.textContent = 'KBM LOAD ERROR: ' + (error && error.message ? error.message : error);
        } finally {
          scalaKbmInput.value = '';
        }
      });
    }

    if (scalaClearBtn) {
      scalaClearBtn.addEventListener('click', () => {
        PATCH.clearScalaProfile();
        PATCH.syncConcertPitchUI();
        PATCH.syncCompSectionUI();
      });
    }

    if (scalaPresetGrid) {
      scalaPresetGrid.addEventListener('click', event => {
        const target = event.target instanceof HTMLElement ? event.target.closest('[data-scala-preset]') : null;
        if (!target) return;
        PATCH.loadScalaPreset(target.dataset.scalaPreset);
        PATCH.syncScalaUI();
        PATCH.syncCompSectionUI();
      });
    }

    if (scalaFavoriteGrid) {
      scalaFavoriteGrid.addEventListener('click', event => {
        const target = event.target instanceof HTMLElement ? event.target.closest('[data-scala-favorite]') : null;
        if (!target) return;
        const slot = target.dataset.scalaFavorite;
        if (event.altKey && event.shiftKey) {
          PATCH.clearScalaFavorite(slot);
        } else if (event.altKey) {
          PATCH.saveScalaFavorite(slot);
        } else {
          PATCH.loadScalaFavorite(slot);
        }
        PATCH.syncScalaUI();
        PATCH.syncCompSectionUI();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDomFixes);
  } else {
    installDomFixes();
  }
})();
