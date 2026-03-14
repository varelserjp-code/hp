/* ─── MIDI Preview Player UI Init (v24.0) ─── */
document.addEventListener('DOMContentLoaded', () => {
  const channelNames = ['Drone', 'Pad', 'Arp', 'Mel', 'Bass', 'Over', 'Tex', 'Lead', 'Markov', 'LSys'];

  function buildPreviewMixer() {
    const mixer = document.getElementById('prevMixer');
    if (!mixer) return;
    mixer.innerHTML = '';
    for (let channel = 0; channel < 10; channel++) {
      const strip = document.createElement('div');
      strip.className = 'prev-ch-strip';
      const label = document.createElement('div');
      label.className = 'prev-ch-label';
      label.textContent = channelNames[channel] || ('Ch' + channel);
      const vol = document.createElement('input');
      vol.type = 'range';
      vol.className = 'prev-ch-vol';
      vol.min = '0';
      vol.max = '1';
      vol.step = '0.01';
      vol.value = '0.8';
      vol.addEventListener('input', () => {
        if (typeof MidiPreview !== 'undefined') MidiPreview.setChVol(channel, parseFloat(vol.value));
      });
      strip.appendChild(label);
      strip.appendChild(vol);
      mixer.appendChild(strip);
    }
  }

  buildPreviewMixer();

  const btnPlay = document.getElementById('prevPlay');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      if (typeof MidiPreview !== 'undefined') MidiPreview.play();
    });
  }

  const btnPause = document.getElementById('prevPause');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (typeof MidiPreview !== 'undefined') MidiPreview.pause();
    });
  }

  const btnStop = document.getElementById('prevStop');
  if (btnStop) {
    btnStop.addEventListener('click', () => {
      if (typeof MidiPreview !== 'undefined') MidiPreview.stop();
    });
  }

  const seekBar = document.getElementById('prevSeek');
  if (seekBar) {
    seekBar.addEventListener('mousedown', () => {
      if (typeof MidiPreview !== 'undefined' && MidiPreview.isPlaying()) MidiPreview.pause();
    });
    seekBar.addEventListener('change', () => {
      if (typeof MidiPreview !== 'undefined') MidiPreview.seek(parseInt(seekBar.value, 10) / 1000);
    });
  }

  const mixerToggle = document.getElementById('prevMixerToggle');
  const mixerEl = document.getElementById('prevMixer');
  if (mixerToggle && mixerEl) {
    mixerToggle.addEventListener('click', () => {
      const open = mixerEl.style.display === 'none' || mixerEl.style.display === '';
      mixerEl.style.display = open ? 'flex' : 'none';
      mixerToggle.style.borderColor = open ? 'rgba(0,229,255,.4)' : '';
      mixerToggle.style.color = open ? 'var(--text)' : '';
    });
  }
});
