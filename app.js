const state = {
  reference: '',
  index: 0,
  audioCtx: null,
  isComplete: false,
  startTime: null,
  correctChars: 0,
  totalKeystrokes: 0,
  totalErrors: 0,  // 🆕 Counter total kesalahan
  timerInterval: null
};

const els = {
  left: document.getElementById('leftPanel'),
  typed: document.getElementById('typedArea'),
  right: document.getElementById('referenceArea'),
  statsBar: document.getElementById('statsBar'),
  statTime: document.getElementById('statTime'),
  statWPM: document.getElementById('statWPM'),
  statAccuracy: document.getElementById('statAccuracy'),
  statErrors: document.getElementById('statErrors'),  // 🆕 Element untuk errors
  statChars: document.getElementById('statChars'),
  toast: document.getElementById('toast'),
  btnPaste: document.getElementById('btnPaste'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnReset: document.getElementById('btnReset')
};

// 🎵 Web Audio API
function initAudio() {
  if (!state.audioCtx) {
    try {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    } catch (e) { console.warn('Audio tidak tersedia:', e); }
  }
}

function playTone(freq, dur, type = 'sine', vol = 0.12) {
  if (!state.audioCtx) return;
  try {
    const o = state.audioCtx.createOscillator();
    const g = state.audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, state.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + dur);
    o.connect(g).connect(state.audioCtx.destination);
    o.start(); o.stop(state.audioCtx.currentTime + dur);
  } catch {}
}

function playSuccess() { playTone(800, 0.04, 'sine', 0.15); }
function playError() { playTone(150, 0.12, 'square', 0.18); }
function playComplete() { playTone(1200, 0.2, 'triangle', 0.2); }
function playBackspace() { playTone(300, 0.04, 'sine', 0.1); }

// 📢 Toast Notification
function showToast(msg, type = 'info') {
  els.toast.textContent = msg;
  els.toast.className = `toast visible ${type === 'error' ? 'toast-error' : ''}`;
  setTimeout(() => els.toast.className = 'toast hidden', 2500);
}

// 🖋️ Render UI
function render() {
  els.typed.innerHTML = '';
  for (let i = 0; i < state.index; i++) {
    const span = document.createElement('span');
    span.className = 'char correct';
    span.textContent = state.reference[i] === '\n' ? '↵\n' : state.reference[i] === ' ' ? '\u00A0' : state.reference[i];
    els.typed.appendChild(span);
  }
  const cursor = document.createElement('span');
  cursor.className = 'cursor-inline';
  els.typed.appendChild(cursor);

  els.right.innerHTML = '';
  for (let i = 0; i < state.reference.length; i++) {
    const span = document.createElement('span');
    span.textContent = state.reference[i] === '\n' ? '↵\n' : state.reference[i] === ' ' ? '\u00A0' : state.reference[i];
    if (i === state.index) { span.className = 'char expected'; span.title = 'Karakter berikutnya'; }
    else if (i < state.index) { span.className = 'char done'; }
    else { span.className = 'char'; }
    els.right.appendChild(span);
  }
  
  const expected = els.right.querySelector('.expected');
  if (expected) expected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}

// 📊 Update Statistik Real-time
function updateStats() {
  if (!state.startTime) return;
  const elapsed = (Date.now() - state.startTime) / 1000;
  const minutes = elapsed / 60;
  
  const wpm = minutes > 0 ? Math.round((state.correctChars / 5) / minutes) : 0;
  const accuracy = state.totalKeystrokes > 0 
    ? Math.round((state.correctChars / (state.correctChars + state.totalErrors)) * 100) 
    : 100;
  
  els.statTime.textContent = elapsed.toFixed(1) + 's';
  els.statWPM.textContent = wpm;
  els.statAccuracy.textContent = accuracy + '%';
  els.statErrors.textContent = state.totalErrors;  // 🆕 Update error count
  els.statChars.textContent = `${state.index}/${state.reference.length}`;
}

// ⌨️ GLOBAL KEY HANDLER
document.addEventListener('keydown', (e) => {
  if (state.isComplete) return;
  if (!state.reference) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const isPrintable = e.key.length === 1;
  const isEnter = e.key === 'Enter';
  const isBack = e.key === 'Backspace';
  if (!isPrintable && !isEnter && !isBack) return;

  e.preventDefault();

  if (!state.startTime) {
    state.startTime = Date.now();
    els.statsBar.classList.remove('hidden');
    state.timerInterval = setInterval(updateStats, 100);
  }

  if (isBack) {
    if (state.index > 0) {
      state.index--;
      state.correctChars = Math.max(0, state.correctChars - 1);
      render(); updateStats();
      playBackspace();
    }
    return;
  }

  state.totalKeystrokes++;
  const expected = state.reference[state.index];
  const inputChar = isEnter ? '\n' : e.key;

  if (inputChar === expected) {
    state.correctChars++;
    state.index++;
    render(); updateStats();
    playSuccess();

    if (state.index >= state.reference.length) {
      state.isComplete = true;
      clearInterval(state.timerInterval);
      showToast('✅ Latihan selesai! Tekan Reset untuk ulang.', 'success');
      playComplete();
    }
  } else {
    state.totalErrors++;  // 🆕 Tambah counter kesalahan
    playError();
    els.left.classList.add('shake');
    setTimeout(() => els.left.classList.remove('shake'), 200);
    updateStats();
  }
});

// 📋 Paste Handler
els.btnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) { showToast('⚠️ Clipboard kosong.', 'error'); return; }
    
    state.reference = text.replace(/\r\n/g, '\n').replace(/\t/g, '    ');
    state.index = 0; state.isComplete = false;
    state.startTime = null; 
    state.correctChars = 0; 
    state.totalKeystrokes = 0;
    state.totalErrors = 0;  // 🆕 Reset error counter
    clearInterval(state.timerInterval);
    els.statsBar.classList.add('hidden');
    els.statTime.textContent = '0.0s'; 
    els.statWPM.textContent = '0';
    els.statAccuracy.textContent = '100%'; 
    els.statErrors.textContent = '0';  // 🆕 Reset display
    els.statChars.textContent = '0/0';
    
    els.right.textContent = '';
    render();
    initAudio();
    showToast('📋 Teks berhasil dimuat. Langsung ketik!');
    document.body.focus();
  } catch (err) {
    showToast('⚠️ Gagal akses clipboard. Gunakan HTTPS/localhost.', 'error');
  }
});

// ⛶ Fullscreen
els.btnFullscreen.addEventListener('click', () => {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(()=>{});
});

// 🔄 Reset
els.btnReset.addEventListener('click', () => {
  state.index = 0; state.isComplete = false;
  state.startTime = null; 
  state.correctChars = 0; 
  state.totalKeystrokes = 0;
  state.totalErrors = 0;  // 🆕 Reset error counter
  clearInterval(state.timerInterval);
  els.statsBar.classList.add('hidden');
  render();
  showToast('🔄 Reset. Siap mengetik ulang.');
});

// 🎯 Init
window.addEventListener('load', () => render());