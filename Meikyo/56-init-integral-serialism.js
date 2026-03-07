/* ── v16.x: Integral Serialism UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const togEl = document.getElementById('togIS');
  if (!togEl) return;

  togEl.addEventListener('click', () => {
    syncEngine('integralserialism', !S.engines.integralserialism);
  });

  [
    ['isDurScale', 'durScale', value => (parseInt(value) / 100).toFixed(2) + '×'],
    ['isVelBlend', 'velBlend', value => Math.round((parseInt(value) / 100) * 100) + '%'],
    ['isGateBlend', 'gateBlend', value => Math.round((parseInt(value) / 100) * 100) + '%']
  ].forEach(([id, key, formatter]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const value = parseInt(el.value) / 100;
      S.isState[key] = value;
      const valueEl = document.getElementById(id + 'V');
      if (valueEl) valueEl.textContent = formatter(el.value);
    });
  });
});
