/* ── v11.x: Markov UI Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('togMarkov').addEventListener('click', () => {
    syncEngine('markov', !S.engines.markov);
    buildLayerToggles();
    buildLayerOctaves();
  });

  document.getElementById('mkvTension').addEventListener('input', () => {
    MarkovEngine.STATE.tension = parseInt(document.getElementById('mkvTension').value) / 100;
    document.getElementById('mkvTensionV').textContent = MarkovEngine.STATE.tension.toFixed(2);
    MarkovEngine.rebuildMatrix();
  });

  document.getElementById('mkvTemp').addEventListener('input', () => {
    MarkovEngine.STATE.temperature = parseInt(document.getElementById('mkvTemp').value) / 100;
    document.getElementById('mkvTempV').textContent = MarkovEngine.STATE.temperature.toFixed(2);
    MarkovEngine.rebuildSequence();
  });

  document.getElementById('mkvSeqLen').addEventListener('input', () => {
    MarkovEngine.STATE.seqLength = parseInt(document.getElementById('mkvSeqLen').value);
    document.getElementById('mkvSeqLenV').textContent = MarkovEngine.STATE.seqLength;
    MarkovEngine.rebuildSequence();
  });

  document.getElementById('mkvOctave').addEventListener('input', () => {
    MarkovEngine.STATE.octave = parseInt(document.getElementById('mkvOctave').value);
    document.getElementById('mkvOctaveV').textContent = 'Oct ' + MarkovEngine.STATE.octave;
    MarkovEngine.rebuildSequence();
    buildLayerOctaves();
  });

  document.getElementById('mkvRegen').addEventListener('click', () => {
    MarkovEngine.rebuildSequence();
  });
});
