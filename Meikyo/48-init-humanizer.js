/* ── v14.0: Humanizer UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('togHum').addEventListener('click', () => {
    syncEngine('humanizer', !S.engines.humanizer);
  });

  document.getElementById('humPinkOct').addEventListener('input', () => {
    const value = parseInt(document.getElementById('humPinkOct').value);
    Humanizer.STATE.pinkOctaves = value;
    document.getElementById('humPinkOctV').textContent = value;
    Humanizer.reset();
  });

  document.getElementById('humVelScale').addEventListener('input', () => {
    Humanizer.STATE.velScale = parseInt(document.getElementById('humVelScale').value);
    document.getElementById('humVelScaleV').textContent = Humanizer.STATE.velScale;
  });

  document.getElementById('humTimScale').addEventListener('input', () => {
    Humanizer.STATE.timScale = parseInt(document.getElementById('humTimScale').value);
    document.getElementById('humTimScaleV').textContent = Humanizer.STATE.timScale;
  });

  document.getElementById('humPnSpeed').addEventListener('input', () => {
    Humanizer.STATE.pnSpeed = parseInt(document.getElementById('humPnSpeed').value) / 1000;
    document.getElementById('humPnSpeedV').textContent = Humanizer.STATE.pnSpeed.toFixed(3);
  });

  document.getElementById('humPnAmp').addEventListener('input', () => {
    Humanizer.STATE.pnAmp = parseInt(document.getElementById('humPnAmp').value) / 100;
    document.getElementById('humPnAmpV').textContent = Humanizer.STATE.pnAmp.toFixed(2);
  });

  document.getElementById('humPnOct').addEventListener('input', () => {
    Humanizer.STATE.pnOct = parseInt(document.getElementById('humPnOct').value);
    document.getElementById('humPnOctV').textContent = Humanizer.STATE.pnOct;
  });

  document.getElementById('humCurveTog').addEventListener('click', () => {
    Humanizer.STATE.velCurveEnabled = !Humanizer.STATE.velCurveEnabled;
    document.getElementById('humCurveTog').classList.toggle('on', Humanizer.STATE.velCurveEnabled);
  });

  document.getElementById('humCurveAmount').addEventListener('input', () => {
    Humanizer.STATE.velCurveAmount = parseInt(document.getElementById('humCurveAmount').value);
    document.getElementById('humCurveAmountV').textContent = Humanizer.STATE.velCurveAmount + '%';
  });

  document.getElementById('humCurveBarHead').addEventListener('input', () => {
    Humanizer.STATE.velCurveBarHead = parseInt(document.getElementById('humCurveBarHead').value);
    document.getElementById('humCurveBarHeadV').textContent = Humanizer.STATE.velCurveBarHead + '%';
  });

  document.getElementById('humCurvePhraseTail').addEventListener('input', () => {
    Humanizer.STATE.velCurvePhraseTail = parseInt(document.getElementById('humCurvePhraseTail').value);
    document.getElementById('humCurvePhraseTailV').textContent = Humanizer.STATE.velCurvePhraseTail + '%';
  });

  document.getElementById('humCurveBars').addEventListener('input', () => {
    Humanizer.STATE.velCurveBars = parseInt(document.getElementById('humCurveBars').value);
    document.getElementById('humCurveBarsV').textContent = Humanizer.STATE.velCurveBars;
  });

  document.getElementById('humCurvePower').addEventListener('input', () => {
    Humanizer.STATE.velCurvePower = parseInt(document.getElementById('humCurvePower').value) / 100;
    document.getElementById('humCurvePowerV').textContent = Humanizer.STATE.velCurvePower.toFixed(2);
  });

  Humanizer.buildUI();
});
