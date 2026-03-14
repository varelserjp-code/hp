/* ── v15.x: Multi-File Export UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const prefixEl = document.getElementById('mePfx');
  if (prefixEl) {
    prefixEl.addEventListener('input', () => {
      S.multiExport.prefix = prefixEl.value;
    });
  }

  const numberPadEl = document.getElementById('meNumPad');
  if (numberPadEl) {
    numberPadEl.addEventListener('click', () => {
      S.multiExport.numberPad = !S.multiExport.numberPad;
      numberPadEl.classList.toggle('on', S.multiExport.numberPad);
      const valueEl = document.getElementById('meNumPadV');
      if (valueEl) valueEl.textContent = S.multiExport.numberPad ? 'ON' : 'OFF';
    });
  }

  const conductorEl = document.getElementById('meCond');
  if (conductorEl) {
    conductorEl.addEventListener('click', () => {
      S.multiExport.includeConductor = !S.multiExport.includeConductor;
      conductorEl.classList.toggle('on', S.multiExport.includeConductor);
      const valueEl = document.getElementById('meCondV');
      if (valueEl) valueEl.textContent = S.multiExport.includeConductor ? 'ON' : 'OFF';
    });
  }

  const selectAllEl = document.getElementById('meSelAll');
  if (selectAllEl) {
    selectAllEl.addEventListener('click', () => {
      if (!S.layerTracks) return;
      S.layerTracks.forEach(layerTrack => {
        S.multiExport.layers[layerTrack.name] = true;
      });
      buildMultiExportUI();
    });
  }

  const selectNoneEl = document.getElementById('meSelNone');
  if (selectNoneEl) {
    selectNoneEl.addEventListener('click', () => {
      if (!S.layerTracks) return;
      S.layerTracks.forEach(layerTrack => {
        S.multiExport.layers[layerTrack.name] = false;
      });
      buildMultiExportUI();
    });
  }

  const downloadEl = document.getElementById('btnMultiDl');
  if (downloadEl) {
    downloadEl.addEventListener('click', doMultiExport);
  }
});
