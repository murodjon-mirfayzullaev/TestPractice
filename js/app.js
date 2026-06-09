// ── STATE ─────────────────────────────────────────────────────────────────────
let allQuestions = [];
let testQuestions = [];
let currentIndex = 0;
let answers = [];
let activeTab = 'all';
let darkMode = localStorage.getItem('theme') !== 'light';

// Timer
let timerInterval = null;
let timerSecondsLeft = 0;

// Settings (persisted in localStorage)
let settings = {
  numQuestions: 25,
  timerEnabled: false,
  timerMinutes: 25
};

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  loadSettingsFromStorage();
  applyTheme();
  syncThemeBtn();
  await loadTestIndex();
  initSettingsSheet();
}

async function loadTestIndex() {
  try {
    const res = await fetch('tests/index.json');
    const tests = await res.json();
    populateSelector(tests);
    if (tests.length > 0) await loadTest(tests[0].file, tests[0]);
  } catch (e) {
    console.error('Failed to load test index', e);
  }
}

function populateSelector(tests) {
  const sel = document.getElementById('test-selector');
  sel.innerHTML = '';
  tests.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.file;
    opt.textContent = t.label;
    opt.dataset.count = t.count;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', async () => {
    const opt = sel.options[sel.selectedIndex];
    await loadTest(sel.value, { label: opt.textContent, count: opt.dataset.count });
    showScreen('screen-home');
  });
}

async function loadTest(file, meta) {
  try {
    const res = await fetch(file);
    allQuestions = await res.json();
    updateHomeText();
    buildAllQsList(allQuestions);
  } catch (e) {
    console.error('Failed to load test file', e);
  }
}

function updateHomeText() {
  const count = allQuestions.length;
  const n = Math.min(settings.numQuestions, count);
  document.getElementById('home-sub').textContent =
    `${count} вопросов · В тесте ${n} случайных`;
  document.getElementById('home-view-btn').textContent =
    `☰ Все вопросы (${count})`;
}

// ── THEME ─────────────────────────────────────────────────────────────────────
function applyTheme() {
  if (!darkMode) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}

function syncThemeBtn() {
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.textContent = darkMode ? '☀️' : '🌙';
  });
}

function toggleTheme() {
  darkMode = !darkMode;
  localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  applyTheme();
  syncThemeBtn();
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function exitTest() {
  stopTimer();
  showScreen('screen-home');
}

// ── ALL QUESTIONS ─────────────────────────────────────────────────────────────
function buildAllQsList(list) {
  const cont = document.getElementById('qs-list');
  cont.innerHTML = '';
  list.forEach(q => {
    const ai = allQuestions.indexOf(q);
    const div = document.createElement('div');
    div.className = 'q-item';
    const correctHtml = q.c.map(a =>
      `<div class="ans-row correct"><div class="ans-dot correct"></div>${a}</div>`
    ).join('');
    const wrongHtml = q.w.map(a =>
      `<div class="ans-row wrong"><div class="ans-dot wrong"></div>${a}</div>`
    ).join('');
    div.innerHTML = `
      <div class="q-item-num">Вопрос ${ai + 1} · ${q.c.length > 1 ? '☑ несколько ответов' : '○ один ответ'}</div>
      <div class="q-item-text">${q.q}</div>
      <div class="q-item-answers">${correctHtml}${wrongHtml}</div>
    `;
    div.addEventListener('click', () => div.classList.toggle('open'));
    cont.appendChild(div);
  });
  document.getElementById('qs-count-badge').textContent = list.length;
}

function filterQs() {
  const term = document.getElementById('search-input').value.toLowerCase();
  const filtered = term
    ? allQuestions.filter(q =>
        q.q.toLowerCase().includes(term) ||
        q.c.some(a => a.toLowerCase().includes(term))
      )
    : allQuestions;
  buildAllQsList(filtered);
}

// ── TEST ──────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function startTest() {
  if (allQuestions.length === 0) return;
  const n = Math.min(settings.numQuestions, allQuestions.length);
  testQuestions = shuffle(allQuestions).slice(0, n);
  currentIndex = 0;
  answers = new Array(testQuestions.length).fill(null);
  showScreen('screen-test');
  renderQuestion();
  if (settings.timerEnabled) startTimer(settings.timerMinutes * 60);
  else stopTimer();
}

function renderQuestion() {
  const q = testQuestions[currentIndex];
  const total = testQuestions.length;
  const isMulti = q.c.length > 1;
  const isLast = currentIndex === total - 1;

  document.getElementById('test-qnum').textContent = `${currentIndex + 1} / ${total}`;
  document.getElementById('test-progress-bar').style.width = `${((currentIndex + 1) / total) * 100}%`;
  document.getElementById('test-q-text').textContent = q.q;

  const chip = document.getElementById('q-type-chip');
  chip.textContent = isMulti ? `☑ Несколько ответов (${q.c.length})` : '○ Один ответ';
  chip.className = 'q-type-chip ' + (isMulti ? 'multi' : 'single');

  const hint = document.getElementById('hint-multi');
  hint.style.display = isMulti ? 'block' : 'none';
  if (isMulti) document.getElementById('hint-count').textContent = q.c.length;

  // Sticky next button
  const btn = document.getElementById('btn-next-sticky');
  const lbl = document.getElementById('btn-next-label');
  btn.disabled = true;
  btn.className = 'btn-next-sticky' + (isLast ? ' finish' : '');
  lbl.textContent = isLast ? 'Завершить тест 🎉' : 'Следующий вопрос →';

  // Render options
  const allOpts = shuffle([...q.c, ...q.w]);
  const cont = document.getElementById('test-options');
  cont.innerHTML = '';
  allOpts.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'opt-btn';
    div.dataset.val = opt;
    const t = isMulti ? 'checkbox' : 'radio';
    div.innerHTML = `
      <div class="opt-control">
        <input type="${t}" name="opt" value="${opt.replace(/"/g, '&quot;')}" style="pointer-events:none">
      </div>
      <div class="opt-label">${opt}</div>
    `;
    div.addEventListener('click', () => handleOptClick(div, isMulti));
    cont.appendChild(div);
  });
}

function handleOptClick(div, isMulti) {
  if (!isMulti) {
    document.querySelectorAll('.opt-btn').forEach(b => {
      b.classList.remove('selected');
      b.querySelector('input').checked = false;
    });
    div.classList.add('selected');
    div.querySelector('input').checked = true;
  } else {
    const inp = div.querySelector('input');
    inp.checked = !inp.checked;
    div.classList.toggle('selected', inp.checked);
  }
  // Enable button as soon as something is selected
  const anySelected = !!document.querySelectorAll('.opt-btn input:checked').length;
  document.getElementById('btn-next-sticky').disabled = !anySelected;
}

function handleNext() {
  // Record answer silently
  const q = testQuestions[currentIndex];
  const selected = [...document.querySelectorAll('.opt-btn input:checked')].map(i => i.value);
  const selectedSet = new Set(selected);
  const isRight = q.c.length === selected.length && q.c.every(c => selectedSet.has(c));
  answers[currentIndex] = { q: q.q, selected, correct: q.c, isRight };

  const isLast = currentIndex === testQuestions.length - 1;
  if (isLast) {
    showResults();
  } else {
    currentIndex++;
    renderQuestion();
  }
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer(seconds) {
  stopTimer();
  timerSecondsLeft = seconds;
  const display = document.getElementById('timer-display');
  display.style.display = 'flex';
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSecondsLeft--;
    updateTimerDisplay();
    if (timerSecondsLeft <= 0) {
      stopTimer();
      showResults();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const display = document.getElementById('timer-display');
  if (display) display.style.display = 'none';
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSecondsLeft / 60);
  const secs = timerSecondsLeft % 60;
  document.getElementById('timer-text').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const display = document.getElementById('timer-display');
  if (timerSecondsLeft <= 60) display.classList.add('danger');
  else display.classList.remove('danger');
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function showResults() {
  stopTimer();
  const correct = answers.filter(a => a && a.isRight).length;
  const total = testQuestions.length;
  const pct = Math.round((correct / total) * 100);

  showScreen('screen-results');

  // Animate score ring (r=60 → circumference = 2π×60 ≈ 376.99)
  setTimeout(() => {
    const circ = 2 * Math.PI * 60;
    const offset = circ - (pct / 100) * circ;
    const arc = document.getElementById('score-arc');
    arc.style.stroke = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)';
    arc.setAttribute('stroke-dashoffset', offset.toFixed(1));
    document.getElementById('score-pct-text').textContent = pct + '%';
  }, 100);

  const titles =
    pct >= 90 ? ['🏆 Превосходно!', 'Вы настоящий эксперт по анатомии'] :
    pct >= 72 ? ['✅ Хорошо!', 'Вы бы сдали этот тест'] :
    pct >= 50 ? ['📚 Неплохо', 'Ещё немного практики — и будет отлично'] :
                ['💪 Продолжайте!', 'Больше повторений — больше уверенности'];

  document.getElementById('result-title').textContent = titles[0];
  document.getElementById('result-sub').textContent = titles[1];
  document.getElementById('rc-correct').textContent = `✓ ${correct} правильно`;
  document.getElementById('rc-wrong').textContent = `✗ ${total - correct} ошибок`;
  document.getElementById('rc-total').textContent = `${total} вопросов`;
  document.getElementById('tab-wrong-count').textContent = `(${total - correct})`;
  document.getElementById('tab-right-count').textContent = `(${correct})`;

  if (pct === 100) launchConfetti();

  activeTab = 'all';
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-all').classList.add('active');
  renderReview('all');
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderReview(tab);
}

function renderReview(tab) {
  const list = document.getElementById('review-list');
  let toShow = answers.filter(Boolean);
  if (tab === 'wrong') toShow = toShow.filter(a => !a.isRight);
  if (tab === 'right') toShow = toShow.filter(a => a.isRight);

  if (!toShow.length) {
    list.innerHTML = `<div class="no-mistakes">
      <div class="big">${tab === 'wrong' ? '🎉' : '📝'}</div>
      ${tab === 'wrong' ? 'Ошибок нет — отличный результат!' : 'Нет правильных ответов'}
    </div>`;
    return;
  }

  list.innerHTML = toShow.map(a => {
    const correctSet = new Set(a.correct);
    const selectedSet = new Set(a.selected);
    const wrongPicked = a.selected.filter(s => !correctSet.has(s));
    let html = '';

    if (a.isRight) {
      a.correct.forEach(c => {
        html += `<div class="review-ans your-right">
          <div class="review-ans-dot" style="background:var(--green)"></div>
          <span><span class="review-ans-label">✓</span>${c}</span>
        </div>`;
      });
    } else {
      wrongPicked.forEach(w => {
        html += `<div class="review-ans your-wrong">
          <div class="review-ans-dot" style="background:var(--red)"></div>
          <span><span class="review-ans-label">Ваш:</span>${w}</span>
        </div>`;
      });
      a.correct.filter(c => !selectedSet.has(c)).forEach(c => {
        html += `<div class="review-ans correct-ans">
          <div class="review-ans-dot" style="background:var(--green)"></div>
          <span><span class="review-ans-label">Верно:</span>${c}</span>
        </div>`;
      });
    }

    return `<div class="review-card ${a.isRight ? 'correct-card' : 'wrong-card'}">
      <div class="review-header">
        <div class="review-badge ${a.isRight ? 'c' : 'w'}">${a.isRight ? '✓' : '✗'}</div>
        <div class="review-q">${a.q}</div>
      </div>
      <div class="review-body">${html}</div>
    </div>`;
  }).join('');
}

// ── SETTINGS SHEET ────────────────────────────────────────────────────────────
function loadSettingsFromStorage() {
  const saved = localStorage.getItem('quiz_settings');
  if (saved) {
    try { Object.assign(settings, JSON.parse(saved)); } catch (e) {}
  }
}

function saveSettingsToStorage() {
  localStorage.setItem('quiz_settings', JSON.stringify(settings));
}

function initSettingsSheet() {
  // Set pill active states from current settings
  setActivePill('num-pills', settings.numQuestions);
  document.getElementById('timer-toggle').checked = settings.timerEnabled;
  document.getElementById('timer-duration-section').style.display =
    settings.timerEnabled ? 'block' : 'none';
  setActivePill('dur-pills', settings.timerMinutes);

  // Show custom inputs if needed
  if (!['10','20','25','50'].includes(String(settings.numQuestions))) {
    showCustomInput('num-custom', settings.numQuestions);
  }
  if (settings.timerEnabled && !['10','20','25'].includes(String(settings.timerMinutes))) {
    showCustomInput('dur-custom', settings.timerMinutes);
  }

  // Wire up pill clicks
  wirePills('num-pills', 'num-custom');
  wirePills('dur-pills', 'dur-custom');
}

function wirePills(groupId, customInputId) {
  document.querySelectorAll(`#${groupId} .pill-opt`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${groupId} .pill-opt`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const customInput = document.getElementById(customInputId);
      if (btn.dataset.val === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
        customInput.value = '';
      }
    });
  });
}

function setActivePill(groupId, val) {
  const pills = document.querySelectorAll(`#${groupId} .pill-opt`);
  const known = Array.from(pills)
    .filter(p => p.dataset.val !== 'custom')
    .map(p => p.dataset.val);

  pills.forEach(p => p.classList.remove('active'));

  if (known.includes(String(val))) {
    const target = document.querySelector(`#${groupId} .pill-opt[data-val="${val}"]`);
    if (target) target.classList.add('active');
  } else {
    const customPill = document.querySelector(`#${groupId} .pill-opt[data-val="custom"]`);
    if (customPill) customPill.classList.add('active');
  }
}

function showCustomInput(id, val) {
  const input = document.getElementById(id);
  input.style.display = 'block';
  input.value = val;
}

function onTimerToggle() {
  const enabled = document.getElementById('timer-toggle').checked;
  document.getElementById('timer-duration-section').style.display = enabled ? 'block' : 'none';
}

function openSettings() {
  document.getElementById('sheet-overlay').classList.add('open');
  document.getElementById('settings-sheet').classList.add('open');
}

function closeSettings() {
  document.getElementById('sheet-overlay').classList.remove('open');
  document.getElementById('settings-sheet').classList.remove('open');
}

function saveSettings() {
  // Read num questions
  const activePill = document.querySelector('#num-pills .pill-opt.active');
  if (activePill?.dataset.val === 'custom') {
    const val = parseInt(document.getElementById('num-custom').value);
    if (!val || val < 1) { alert('Введите корректное число вопросов'); return; }
    settings.numQuestions = Math.min(val, allQuestions.length || 199);
  } else if (activePill) {
    settings.numQuestions = parseInt(activePill.dataset.val);
  }

  // Read timer
  settings.timerEnabled = document.getElementById('timer-toggle').checked;

  if (settings.timerEnabled) {
    const activeDur = document.querySelector('#dur-pills .pill-opt.active');
    if (activeDur?.dataset.val === 'custom') {
      const val = parseInt(document.getElementById('dur-custom').value);
      if (!val || val < 1) { alert('Введите корректную длительность'); return; }
      settings.timerMinutes = val;
    } else if (activeDur) {
      settings.timerMinutes = parseInt(activeDur.dataset.val);
    }
  }

  saveSettingsToStorage();
  updateHomeText();
  closeSettings();
}

function resetSettings() {
  settings = { numQuestions: 25, timerEnabled: false, timerMinutes: 25 };
  saveSettingsToStorage();

  // Reset UI
  setActivePill('num-pills', 25);
  document.getElementById('num-custom').style.display = 'none';
  document.getElementById('num-custom').value = '';
  document.getElementById('timer-toggle').checked = false;
  document.getElementById('timer-duration-section').style.display = 'none';
  setActivePill('dur-pills', 25);
  document.getElementById('dur-custom').style.display = 'none';
  document.getElementById('dur-custom').value = '';

  updateHomeText();
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = ['#7c6ff7', '#2dd4a0', '#f26b6b', '#f5a623', '#a78bfa', '#fff'];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left:${Math.random() * 100}%;top:-10px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration:${1.5 + Math.random() * 2}s;
        animation-delay:${Math.random() * 0.5}s;
        transform:rotate(${Math.random() * 360}deg);
        width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }, i * 30);
  }
}

// ── START ─────────────────────────────────────────────────────────────────────
init();
