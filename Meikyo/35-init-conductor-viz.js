/* ── v25.7: Conductor Viz UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof ConductorViz === 'undefined') return;

  const togCV = document.getElementById('togCV');
  const canvas = document.getElementById('conductorVizCanvas');
  const editBtn = document.getElementById('cvEditBtn');
  const resetBtn = document.getElementById('cvResetBtn');
  const info = document.getElementById('cvInfo');
  if (!togCV || !canvas) return;

  ConductorViz.draw(canvas, null);

  togCV.classList.toggle('on', CONDUCTOR_VIZ_STATE.enabled);
  togCV.addEventListener('click', () => {
    CONDUCTOR_VIZ_STATE.enabled = !CONDUCTOR_VIZ_STATE.enabled;
    togCV.classList.toggle('on', CONDUCTOR_VIZ_STATE.enabled);
    if (info) {
      info.textContent = CONDUCTOR_VIZ_STATE.enabled
        ? 'CONDUCTOR VIZ — 有効 (次回 GENERATE 後に更新)'
        : 'CONDUCTOR VIZ — 無効';
    }
  });

  if (editBtn) {
    editBtn.classList.toggle('on', CONDUCTOR_VIZ_STATE.editMode);
    editBtn.addEventListener('click', () => {
      CONDUCTOR_VIZ_STATE.editMode = !CONDUCTOR_VIZ_STATE.editMode;
      editBtn.classList.toggle('on', CONDUCTOR_VIZ_STATE.editMode);
      if (info) {
        info.textContent = CONDUCTOR_VIZ_STATE.editMode
          ? 'EDIT MODE — クリック&ドラッグでテンションを編集'
          : (CONDUCTOR_VIZ_STATE.editedCurve ? '手動編集済み — 次回 GENERATE に適用されます' : 'CONDUCTOR VIZ — 有効');
      }
      ConductorViz.draw(canvas, null);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ConductorViz.resetEdit();
      if (editBtn) editBtn.classList.remove('on');
      ConductorViz.draw(canvas, null);
      if (info) info.textContent = 'RESET — 自動生成カーブに戻しました';
    });
  }
});
