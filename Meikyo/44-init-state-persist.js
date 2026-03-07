/* ─── State Persist UI Init (v25.0) ─── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof StatePersist === 'undefined') return;

  function renderSlotList() {
    const list = document.getElementById('spSlotList');
    const empty = document.getElementById('spEmpty');
    if (!list) return;
    Array.from(list.children).forEach(el => {
      if (el !== empty) el.remove();
    });
    const slots = StatePersist.listSlots();
    if (!slots.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    slots.forEach(slot => {
      const item = document.createElement('div');
      item.className = 'sp-slot';
      const date = new Date(slot.savedAt);
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + ' '
        + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
      item.innerHTML = `<span class="sp-slot-name" title="Click to load: ${slot.name}">${slot.label || slot.name}</span>`
        + `<span class="sp-slot-date">${dateStr}</span>`
        + `<button class="sp-slot-del" title="Delete" data-name="${slot.name}">×</button>`;
      item.querySelector('.sp-slot-name').addEventListener('click', () => {
        if (StatePersist.load(slot.name)) {
          log('// PRESET LOADED: ' + slot.name, 'ok');
        }
      });
      item.querySelector('.sp-slot-del').addEventListener('click', event => {
        event.stopPropagation();
        StatePersist.remove(slot.name);
        renderSlotList();
      });
      list.appendChild(item);
    });
  }

  const btnSave = document.getElementById('spBtnSave');
  const inputName = document.getElementById('spSlotName');
  if (btnSave && inputName) {
    btnSave.addEventListener('click', () => {
      const name = inputName.value.trim().replace(/[^a-zA-Z0-9_\-\u3000-\u9fff\u30a0-\u30ff\u3041-\u3096]/g, '_') || 'preset_' + Date.now();
      if (StatePersist.save(name, name)) {
        log('// PRESET SAVED: ' + name, 'ok');
        inputName.value = '';
        renderSlotList();
      }
    });
    inputName.addEventListener('keydown', event => {
      if (event.key === 'Enter') btnSave.click();
    });
  }

  const btnAuto = document.getElementById('spBtnAutoSave');
  if (btnAuto) {
    btnAuto.addEventListener('click', () => {
      StatePersist.autoSave();
      log('// AUTO SAVED', 'ok');
    });
  }

  const btnExport = document.getElementById('spBtnExport');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      StatePersist.exportAll();
      log('// PRESETS EXPORTED', 'ok');
    });
  }

  const btnImport = document.getElementById('spBtnImport');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      StatePersist.importAll(count => {
        renderSlotList();
        log('// IMPORTED ' + count + ' preset(s)', 'ok');
      });
    });
  }

  StatePersist.autoLoad();
  renderSlotList();
});
