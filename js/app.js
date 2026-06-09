// ══════════════════════════════════════════════════════
//  PrepKit — App Logic
// ══════════════════════════════════════════════════════

// ── Palette definitions ───────────────────────────────
const PALETTES = {
  green: {
    '--accent':      '#10B981',
    '--accent2':     '#059669',
    '--accent-soft': 'rgba(16,185,129,0.15)',
    '--accent-glow': 'rgba(16,185,129,0.28)',
    '--hero-from':   '#065F46',
    '--hero-to':     '#022C22',
  },
  purple: {
    '--accent':      '#8B5CF6',
    '--accent2':     '#7C3AED',
    '--accent-soft': 'rgba(139,92,246,0.18)',
    '--accent-glow': 'rgba(139,92,246,0.30)',
    '--hero-from':   '#7C3AED',
    '--hero-to':     '#3B1A7A',
  },
  red: {
    '--accent':      '#EF4444',
    '--accent2':     '#DC2626',
    '--accent-soft': 'rgba(239,68,68,0.15)',
    '--accent-glow': 'rgba(239,68,68,0.28)',
    '--hero-from':   '#991B1B',
    '--hero-to':     '#450A0A',
  },
  yellow: {
    '--accent':      '#F59E0B',
    '--accent2':     '#D97706',
    '--accent-soft': 'rgba(245,158,11,0.15)',
    '--accent-glow': 'rgba(245,158,11,0.28)',
    '--hero-from':   '#92400E',
    '--hero-to':     '#451A03',
  },
};

// ── State ─────────────────────────────────────────────
let allQuestions  = [];
let testQuestions = [];
let testsList     = [];
let currentIndex  = 0;
let answers       = [];
let activeTab     = 'all';
let isTestActive  = false;

let darkMode       = localStorage.getItem('theme') !== 'light';
let currentPalette = localStorage.getItem('palette') || 'green';

let timerInterval    = null;
let timerSecondsLeft = 0;

let settings = { numQuestions: 25, timerEnabled: false, timerMinutes: 25 };

// ── Refresh guard ─────────────────────────────────────
window.addEventListener('beforeunload', e => {
  if (!isTestActive) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});

// ── Init ─────────────────────────────────────────────
async function init() {
  loadSettingsFromStorage();
  applyTheme();
  applyPalette(currentPalette);
  syncThemeModeBtns();
  syncPaletteChips();
  await loadTestIndex();
  initSettingsSheet();
}

async function loadTestIndex() {
  try {
    const res   = await fetch('tests/index.json');
    const tests = await res.json();
    testsList = tests;
    buildTestSheet(tests);
    if (tests.length > 0) {
      document.getElementById('test-selector-label').textContent = tests[0].label;
      await loadTest(tests[0].file);
    }
  } catch (e) { console.error('Failed to load test index', e); }
}

async function loadTest(file) {
  try {
    const res = await fetch(file);
    allQuestions = await res.json();
    updateHomeText();
    buildAllQsList(allQuestions);
  } catch (e) { console.error('Failed to load test', e); }
}

function updateHomeText() {
  const count = allQuestions.length;
  const n = Math.min(settings.numQuestions, count);
  document.getElementById('home-sub').textContent =
    `${count} вопросов · ${n} случайных в тесте`;
  const btn = document.getElementById('home-view-btn');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> Все вопросы (${count})`;
}

// ── Theme ─────────────────────────────────────────────
function applyTheme() {
  if (!darkMode) document.documentElement.setAttribute('data-theme', 'light');
  else           document.documentElement.removeAttribute('data-theme');
}

function setThemeMode(mode) {
  darkMode = (mode === 'dark');
  localStorage.setItem('theme', mode);
  applyTheme();
  syncThemeModeBtns();
}

function syncThemeModeBtns() {
  document.querySelectorAll('.theme-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === (darkMode ? 'dark' : 'light'));
  });
}

// ── Palette ───────────────────────────────────────────
function applyPalette(name) {
  const p = PALETTES[name];
  if (!p) return;
  const root = document.documentElement;
  Object.entries(p).forEach(([k, v]) => root.style.setProperty(k, v));
}

function setPalette(name) {
  currentPalette = name;
  localStorage.setItem('palette', name);
  applyPalette(name);
  syncPaletteChips();
}

function syncPaletteChips() {
  document.querySelectorAll('.palette-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.palette === currentPalette);
  });
}

// ── Navigation ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}
function exitTest() {
  isTestActive = false;
  stopTimer();
  showScreen('screen-home');
}

// ── Bottom Sheets ─────────────────────────────────────
function openSheet(id) {
  // Close any previously open sheet first
  ['settings-sheet', 'theme-sheet', 'test-sheet'].forEach(s => {
    document.getElementById(s)?.classList.remove('open');
  });
  document.getElementById('sheet-overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeAllSheets() {
  document.getElementById('sheet-overlay').classList.remove('open');
  ['settings-sheet', 'theme-sheet', 'test-sheet'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
  });
}

function openSettings()   { openSheet('settings-sheet'); }
function openThemeSheet() { openSheet('theme-sheet'); }
function openTestSheet()  { openSheet('test-sheet'); }

// ── Test selector sheet ───────────────────────────────
function buildTestSheet(tests) {
  const list = document.getElementById('test-option-list');
  list.innerHTML = tests.map((t, i) => `
    <div class="test-option-item ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="selectTest(${i})">
      <span class="test-option-icon">${t.icon || '📚'}</span>
      <div class="test-option-info">
        <div class="test-option-name">${t.label}</div>
        <div class="test-option-sub">${t.sublabel || (t.count + ' вопросов')}</div>
      </div>
      <svg class="test-option-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
  `).join('');
}

function selectTest(idx) {
  const t = testsList[idx];
  if (!t) return;
  // Update active state in sheet
  document.querySelectorAll('.test-option-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  // Update topbar label
  document.getElementById('test-selector-label').textContent = t.label;
  // Load test data
  loadTest(t.file);
  closeAllSheets();
  showScreen('screen-home');
}

// ── All Questions ─────────────────────────────────────
function buildAllQsList(list) {
  const cont = document.getElementById('qs-list');
  cont.innerHTML = '';

  list.forEach(q => {
    const ai = allQuestions.indexOf(q);
    const isMulti = q.c.length > 1;
    const div = document.createElement('div');
    div.className = 'q-item';

    const correctHtml = q.c.map(a =>
      `<div class="ans-row correct"><div class="ans-dot correct"></div>${a}</div>`
    ).join('');
    const wrongHtml = q.w.map(a =>
      `<div class="ans-row wrong"><div class="ans-dot wrong"></div>${a}</div>`
    ).join('');

    div.innerHTML = `
      <div class="q-item-header">
        <div class="q-item-badge num">${ai + 1}</div>
        <div class="q-item-meta">
          <div class="q-item-num">${isMulti ? '☑ несколько' : '○ один ответ'}</div>
          <div class="q-item-text">${q.q}</div>
        </div>
        <svg class="q-item-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
      </div>
      <div class="q-item-answers">${correctHtml}${wrongHtml}</div>
    `;
    div.addEventListener('click', () => div.classList.toggle('open'));
    cont.appendChild(div);
  });

  document.getElementById('qs-count-badge').textContent = list.length;
}

function filterQs() {
  const term = document.getElementById('search-input').value.toLowerCase();
  buildAllQsList(
    term ? allQuestions.filter(q =>
      q.q.toLowerCase().includes(term) || q.c.some(a => a.toLowerCase().includes(term))
    ) : allQuestions
  );
}

// ── Test ──────────────────────────────────────────────
function shuffle(arr) { return arr.slice().sort(() => Math.random() - 0.5); }

function startTest() {
  if (!allQuestions.length) return;
  const n = Math.min(settings.numQuestions, allQuestions.length);
  testQuestions = shuffle(allQuestions).slice(0, n);
  currentIndex  = 0;
  answers       = new Array(n).fill(null);
  isTestActive  = true;
  showScreen('screen-test');
  renderQuestion();
  settings.timerEnabled ? startTimer(settings.timerMinutes * 60) : stopTimer();
}

function renderQuestion() {
  const q     = testQuestions[currentIndex];
  const total = testQuestions.length;
  const isMulti = q.c.length > 1;
  const isLast  = currentIndex === total - 1;

  document.getElementById('test-qnum').textContent = `${currentIndex + 1} / ${total}`;
  document.getElementById('test-progress-bar').style.width = `${((currentIndex + 1) / total) * 100}%`;
  document.getElementById('test-q-text').textContent = q.q;

  const chip = document.getElementById('q-type-chip');
  chip.textContent = isMulti ? `Несколько ответов · ${q.c.length}` : 'Один правильный ответ';
  chip.className   = 'q-type-chip ' + (isMulti ? 'multi' : 'single');

  const hint = document.getElementById('hint-multi');
  hint.style.display = isMulti ? 'flex' : 'none';
  if (isMulti) document.getElementById('hint-count').textContent = q.c.length;

  const btn = document.getElementById('btn-next-sticky');
  const lbl = document.getElementById('btn-next-label');
  btn.disabled    = true;
  btn.className   = 'btn-next-sticky' + (isLast ? ' finish' : '');
  lbl.textContent = isLast ? 'Завершить тест' : 'Следующий вопрос';

  const allOpts = shuffle([...q.c, ...q.w]);
  const cont    = document.getElementById('test-options');
  cont.innerHTML = '';

  allOpts.forEach(opt => {
    const div = document.createElement('div');
    div.className   = 'opt-btn';
    div.dataset.val = opt;
    const t = isMulti ? 'checkbox' : 'radio';
    div.innerHTML = `
      <div class="opt-control">
        <input type="${t}" name="opt" value="${opt.replace(/"/g,'&quot;')}" style="pointer-events:none">
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
  document.getElementById('btn-next-sticky').disabled =
    !document.querySelectorAll('.opt-btn input:checked').length;
}

function handleNext() {
  const q        = testQuestions[currentIndex];
  const selected = [...document.querySelectorAll('.opt-btn input:checked')].map(i => i.value);
  const selSet   = new Set(selected);
  const isRight  = q.c.length === selected.length && q.c.every(c => selSet.has(c));

  // Store all wrong options too (for full answer review in results)
  answers[currentIndex] = {
    q: q.q, selected, correct: q.c, allWrong: q.w || [], isRight
  };

  currentIndex === testQuestions.length - 1 ? showResults() : (currentIndex++, renderQuestion());
}

// ── Timer ─────────────────────────────────────────────
function startTimer(seconds) {
  stopTimer();
  timerSecondsLeft = seconds;
  const display = document.getElementById('timer-display');
  display.style.display = 'flex';
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSecondsLeft--;
    updateTimerDisplay();
    if (timerSecondsLeft <= 0) { stopTimer(); showResults(); }
  }, 1000);
}
function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const d = document.getElementById('timer-display');
  if (d) d.style.display = 'none';
}
function updateTimerDisplay() {
  const m = Math.floor(timerSecondsLeft / 60);
  const s = timerSecondsLeft % 60;
  document.getElementById('timer-text').textContent =
    `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const d = document.getElementById('timer-display');
  timerSecondsLeft <= 60 ? d.classList.add('danger') : d.classList.remove('danger');
}

// ── Results ───────────────────────────────────────────
function showResults() {
  isTestActive = false;
  stopTimer();
  const correct = answers.filter(a => a?.isRight).length;
  const total   = testQuestions.length;
  const pct     = Math.round((correct / total) * 100);

  showScreen('screen-results');

  setTimeout(() => {
    const circ   = 2 * Math.PI * 60;
    const offset = circ - (pct / 100) * circ;
    document.getElementById('score-arc').setAttribute('stroke-dashoffset', offset.toFixed(1));
    document.getElementById('score-pct-text').textContent = pct + '%';
  }, 120);

  const [title, sub] =
    pct >= 90 ? ['🏆 Превосходно!', 'Вы настоящий эксперт!'] :
    pct >= 72 ? ['✅ Хорошо!', 'Вы бы сдали этот тест'] :
    pct >= 50 ? ['📚 Неплохо', 'Ещё немного — и будет отлично'] :
                ['💪 Не сдавайтесь!', 'Повторите материал и попробуйте снова'];

  document.getElementById('result-title').textContent = title;
  document.getElementById('result-sub').textContent   = sub;
  document.getElementById('rc-correct').textContent   = `✓ ${correct} верно`;
  document.getElementById('rc-wrong').textContent     = `✗ ${total - correct} ошибок`;
  document.getElementById('rc-total').textContent     = `${total} вопросов`;
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

// Render review with ALL answer options, tagged: Верно / Ваш ответ / Ошибка
function renderReview(tab) {
  const list = document.getElementById('review-list');
  let toShow = answers.filter(Boolean);
  if (tab === 'wrong') toShow = toShow.filter(a => !a.isRight);
  if (tab === 'right') toShow = toShow.filter(a =>  a.isRight);

  if (!toShow.length) {
    list.innerHTML = `<div class="no-results">
      <div class="big">${tab === 'wrong' ? '🎉' : '📝'}</div>
      ${tab === 'wrong' ? 'Ошибок нет — отличный результат!' : 'Нет правильных ответов'}
    </div>`;
    return;
  }

  list.innerHTML = toShow.map(a => {
    const correctSet = new Set(a.correct);
    const selSet     = new Set(a.selected);
    const allWrong   = a.allWrong || [];

    // Order: correct answers → wrong options the user picked → other wrong options
    const allOptions = [
      ...a.correct,
      ...allWrong.filter(w =>  selSet.has(w)),
      ...allWrong.filter(w => !selSet.has(w)),
    ];

    const optsHtml = allOptions.map(opt => {
      const isCorrect = correctSet.has(opt);
      const wasChosen = selSet.has(opt);
      let cls = 'result-opt ';
      let tags = '';

      if (isCorrect && wasChosen) {
        cls += 'ro-correct-chosen';
        tags = `<span class="rtag rtag-true">Верно</span><span class="rtag rtag-chosen">Ваш ответ</span>`;
      } else if (isCorrect && !wasChosen) {
        cls += 'ro-correct-missed';
        tags = `<span class="rtag rtag-true">Верно</span>`;
      } else if (!isCorrect && wasChosen) {
        cls += 'ro-wrong-chosen';
        tags = `<span class="rtag rtag-chosen">Ваш ответ</span><span class="rtag rtag-wrong">Ошибка</span>`;
      } else {
        cls += 'ro-neutral';
      }

      return `<div class="${cls}">
        <span>${opt}</span>
        ${tags ? `<div class="result-opt-tags">${tags}</div>` : ''}
      </div>`;
    }).join('');

    const hintHtml = a.isRight
      ? `<div class="result-hint ok">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Все правильные ответы выбраны верно!
        </div>`
      : `<div class="result-hint err">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Обратите внимание на правильные ответы выше
        </div>`;

    return `
      <div class="q-item ${a.isRight ? 'correct-item' : 'wrong-item'}" onclick="this.classList.toggle('open')">
        <div class="q-item-header">
          <div class="q-item-badge ${a.isRight ? 'c' : 'w'}">${a.isRight ? '✓' : '✗'}</div>
          <div class="q-item-meta">
            <div class="q-item-num">${a.isRight ? 'Правильно' : 'Ошибка'}</div>
            <div class="q-item-text">${a.q}</div>
          </div>
          <svg class="q-item-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
        <div class="q-item-answers">
          ${optsHtml}
          ${hintHtml}
        </div>
      </div>`;
  }).join('');
}

// ── Settings ──────────────────────────────────────────
function loadSettingsFromStorage() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem('quiz_settings') || '{}')); }
  catch (e) {}
}
function saveSettingsToStorage() {
  localStorage.setItem('quiz_settings', JSON.stringify(settings));
}

function initSettingsSheet() {
  setActivePill('num-pills', settings.numQuestions);
  document.getElementById('timer-toggle').checked = settings.timerEnabled;
  document.getElementById('timer-duration-section').style.display =
    settings.timerEnabled ? 'block' : 'none';
  setActivePill('dur-pills', settings.timerMinutes);

  if (!['10','20','25','50'].includes(String(settings.numQuestions)))
    showCustomInput('num-custom', settings.numQuestions);
  if (settings.timerEnabled && !['10','20','25'].includes(String(settings.timerMinutes)))
    showCustomInput('dur-custom', settings.timerMinutes);

  wirePills('num-pills', 'num-custom');
  wirePills('dur-pills', 'dur-custom');
}

function wirePills(groupId, customId) {
  document.querySelectorAll(`#${groupId} .pill-opt`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${groupId} .pill-opt`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const inp = document.getElementById(customId);
      if (btn.dataset.val === 'custom') { inp.style.display = 'block'; inp.focus(); }
      else { inp.style.display = 'none'; inp.value = ''; }
    });
  });
}

function setActivePill(groupId, val) {
  const pills = document.querySelectorAll(`#${groupId} .pill-opt`);
  const known = Array.from(pills).filter(p => p.dataset.val !== 'custom').map(p => p.dataset.val);
  pills.forEach(p => p.classList.remove('active'));
  if (known.includes(String(val))) {
    document.querySelector(`#${groupId} .pill-opt[data-val="${val}"]`)?.classList.add('active');
  } else {
    document.querySelector(`#${groupId} .pill-opt[data-val="custom"]`)?.classList.add('active');
  }
}

function showCustomInput(id, val) {
  const inp = document.getElementById(id);
  inp.style.display = 'block'; inp.value = val;
}

function onTimerToggle() {
  document.getElementById('timer-duration-section').style.display =
    document.getElementById('timer-toggle').checked ? 'block' : 'none';
}

function saveSettings() {
  const numPill = document.querySelector('#num-pills .pill-opt.active');
  if (numPill?.dataset.val === 'custom') {
    const v = parseInt(document.getElementById('num-custom').value);
    if (!v || v < 1) { alert('Введите корректное число вопросов'); return; }
    settings.numQuestions = Math.min(v, allQuestions.length || 199);
  } else if (numPill) {
    settings.numQuestions = parseInt(numPill.dataset.val);
  }

  settings.timerEnabled = document.getElementById('timer-toggle').checked;

  if (settings.timerEnabled) {
    const durPill = document.querySelector('#dur-pills .pill-opt.active');
    if (durPill?.dataset.val === 'custom') {
      const v = parseInt(document.getElementById('dur-custom').value);
      if (!v || v < 1) { alert('Введите корректную длительность'); return; }
      settings.timerMinutes = v;
    } else if (durPill) {
      settings.timerMinutes = parseInt(durPill.dataset.val);
    }
  }

  saveSettingsToStorage();
  updateHomeText();
  closeAllSheets();
}

function resetSettings() {
  settings = { numQuestions: 25, timerEnabled: false, timerMinutes: 25 };
  saveSettingsToStorage();
  setActivePill('num-pills', 25);
  ['num-custom','dur-custom'].forEach(id => {
    const el = document.getElementById(id);
    el.style.display = 'none'; el.value = '';
  });
  document.getElementById('timer-toggle').checked = false;
  document.getElementById('timer-duration-section').style.display = 'none';
  setActivePill('dur-pills', 25);
  updateHomeText();
}

// ── Confetti ──────────────────────────────────────────
function launchConfetti() {
  const colors = [
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    '#34D399','#F87171','#FBBF24','#fff','rgba(255,255,255,0.6)'
  ];
  for (let i = 0; i < 70; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `left:${Math.random()*100}%;top:-10px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        animation-duration:${1.5+Math.random()*2}s;
        animation-delay:${Math.random()*0.5}s;
        transform:rotate(${Math.random()*360}deg);
        width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }, i * 28);
  }
}

// ── Start ─────────────────────────────────────────────
init();
