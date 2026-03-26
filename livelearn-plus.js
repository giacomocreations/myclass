/**
 * LiveLearn — livelearn-plus.js
 * Unico file che sostituisce TUTTI i patch precedenti.
 *
 * COSA FA:
 *  1. Fix bug consegna: showFeedbackAndAdvance usava .set() che poteva
 *     cancellare submittedAt → ora usa .update()
 *  2. Nuovo tipo domanda "Fill in the blanks" (scrittura libera, no word bank)
 *  3. Correzione AI (Gemini) delle risposte libere alla consegna
 *  4. Pannello modifica punteggi per il docente (aggiunto DOPO l'originale)
 *
 * INSTALLAZIONE:
 *   - Elimina da GitHub: livelearn-patch.js, livelearn-bugfix-v2.js,
 *     livelearn-score-override-fix.js, livelearn-bugfix-submit.js
 *   - Carica solo questo file: livelearn-plus.js
 *   - In LiveLearn.html prima di </body>:
 *       <script src="livelearn-plus.js"></script>
 */

// ─────────────────────────────────────────────────────────────
// PARTE 1 — FIX BUG CONSEGNA
// showFeedbackAndAdvance usava .set() dentro setTimeout(2200ms).
// Se arrivava su Firebase dopo submitAnswers cancellava submittedAt.
// Soluzione: .update() che non tocca mai i campi non elencati.
// ─────────────────────────────────────────────────────────────
window.showFeedbackAndAdvance = function() {
  const q = S.activity.questions[S.qIndex];
  const a = S.answers[S.qIndex];
  const r = evaluateAnswer(q, a);
  if (r.scorable && r.correct) S.studentScore += r.points;

  const scorePill = document.getElementById('s-score-pill');
  if (scorePill) { scorePill.style.display = 'inline-block'; scorePill.textContent = S.studentScore + ' pt'; }

  ['btn-prev','btn-next','btn-skip','btn-submit','btn-review'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('s-question-area')?.querySelectorAll('button,input,textarea')
    .forEach(el => el.disabled = true);

  if (q.type === 'multiple-choice') {
    document.querySelectorAll('.option-btn').forEach((btn, i) => {
      if (i === q.correct) btn.classList.add('correct');
      else if (i === a) btn.classList.add('wrong');
    });
  }

  const fbArea = document.getElementById('s-feedback-area');
  if (fbArea) {
    const icon  = r.scorable ? (r.correct ? '✅' : '❌') : '💬';
    const title = r.scorable ? (r.correct ? `Corretto! +${r.points} pt` : 'Sbagliato') : 'Risposta registrata!';
    fbArea.innerHTML = `<div class="feedback-card ${r.scorable ? (r.correct ? 'correct' : 'wrong') : 'neutral'}"
      style="border-radius:12px;padding:18px;margin-top:14px;text-align:center;">
      <div style="font-size:36px;margin-bottom:6px;">${icon}</div>
      <div style="font-size:17px;font-weight:700;">${title}</div>
      ${r.detail ? `<div style="font-size:13px;margin-top:6px;opacity:.8;">${r.detail}</div>` : ''}
    </div>`;
  }

  setTimeout(async () => {
    // ✅ .update() — non sovrascrive submittedAt
    if (window.db && S.sessionCode && S.safeName) {
      try {
        await db.ref('livelearn/responses/' + S.sessionCode + '/' + S.safeName).update({
          answers: S.answers.map(a => a === undefined ? null : a),
          score: S.studentScore,
          updatedAt: Date.now()
        });
      } catch(e) { console.warn('progress save error:', e); }
    }
    const isLast = S.qIndex === S.activity.questions.length - 1;
    showLeaderboard(isLast);
  }, 2200);
};


// ─────────────────────────────────────────────────────────────
// PARTE 2 — FILL IN THE BLANKS
// ─────────────────────────────────────────────────────────────

// Helper: normalizza la risposta ignorando maiuscole, spazi, punteggiatura finale
function _normBlank(s) {
  return (s || '').trim().toLowerCase().replace(/[.,;:!?'"]+$/g, '').replace(/\s+/g, ' ');
}

// Estendi typeLabel
const _origTypeLabel = window.typeLabel;
window.typeLabel = function(t) {
  if (t === 'fill-in-blanks') return 'Fill in the blanks';
  return _origTypeLabel ? _origTypeLabel(t) : t;
};

// Estendi evaluateAnswer
const _origEvaluate = window.evaluateAnswer;
window.evaluateAnswer = function(q, a) {
  if (q.type === 'fill-in-blanks') {
    const pts = q.points || 10;
    if (!Array.isArray(a)) return { scorable: true, correct: false, points: pts, detail: 'Nessuna risposta.' };
    const answers = q.answers || [];
    const ok = answers.every((ans, bi) => _normBlank(a[bi]) === _normBlank(ans));
    const detail = ok ? '' : answers.map((ans, bi) =>
      'Sp.' + (bi+1) + ': ' + esc(a[bi] || '—') + ' → <strong>' + esc(ans) + '</strong>'
    ).join(' · ');
    return { scorable: true, correct: ok, points: pts, detail };
  }
  return _origEvaluate ? _origEvaluate(q, a) : { scorable: false, correct: false, points: 0, detail: '' };
};

// Estendi buildQuestionHTML (vista studente)
const _origBuildQ = window.buildQuestionHTML;
window.buildQuestionHTML = function(q, i) {
  if (q.type === 'fill-in-blanks') {
    const pts = q.points || 10;
    const isSkipped = S.skipped?.includes(i);
    const qLabel = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div class="q-label">Domanda ${i+1}</div>
      <span class="q-pts-label">⭐ ${pts} pt</span>
      ${isSkipped ? '<span class="skip-badge">Saltata — rispondi ora</span>' : ''}
    </div>`;
    let idx = 0;
    const html = esc(q.text).replace(/___/g, () =>
      `<input class="blank-input" id="blank-${idx++}" type="text" autocomplete="off" spellcheck="true" placeholder="scrivi qui…">`
    );
    const hint = q.hint ? `<p style="font-size:12px;color:var(--muted);margin-top:10px;">💡 ${esc(q.hint)}</p>` : '';
    return `<div class="question-card">${qLabel}
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px;">✍️ Scrivi la risposta negli spazi</div>
      <div class="cloze-text">${html}</div>${hint}</div>`;
  }
  return _origBuildQ ? _origBuildQ(q, i) : '';
};

// Estendi saveCurrentAnswer
const _origSave = window.saveCurrentAnswer;
window.saveCurrentAnswer = function() {
  const q = S.activity?.questions?.[S.qIndex];
  if (q?.type === 'fill-in-blanks') {
    const count = (q.text.match(/___/g) || []).length;
    const vals = Array.from({ length: count }, (_, b) => {
      const el = document.getElementById('blank-' + b);
      return el ? el.value.trim() : '';
    });
    if (vals.some(v => v !== '')) S.answers[S.qIndex] = vals;
    return;
  }
  return _origSave && _origSave();
};

// Estendi restoreAnswer
const _origRestore = window.restoreAnswer;
window.restoreAnswer = function(i) {
  const q = S.activity?.questions?.[i];
  if (q?.type === 'fill-in-blanks') {
    const a = S.answers[i];
    if (Array.isArray(a)) a.forEach((val, bi) => {
      const el = document.getElementById('blank-' + bi);
      if (el) el.value = val;
    });
    return;
  }
  return _origRestore && _origRestore(i);
};

// Estendi renderAddForm (builder docente)
const _origAddForm = window.renderAddForm;
window.renderAddForm = function(type) {
  if (type === 'fill-in-blanks') {
    const el = document.getElementById('add-form');
    if (!el) return;
    el.innerHTML = `
      <div class="form-group">
        <label>Testo con spazi (usa ___ per ogni spazio vuoto)</label>
        <textarea id="qf-text" rows="4" placeholder="Yesterday she ___ to the park and ___ her friends."></textarea>
      </div>
      <div class="form-group">
        <label>Risposte esatte (una per riga, stesso ordine degli spazi)</label>
        <textarea id="qf-answers" rows="3" placeholder="went\nmet"></textarea>
        <p style="font-size:11px;color:var(--muted);margin-top:4px;">⚡ Ignora maiuscole, spazi extra e punteggiatura finale.</p>
      </div>
      <div class="form-group">
        <label>Suggerimento per lo studente (opzionale)</label>
        <input type="text" id="qf-hint" placeholder="Usa il Past Simple…">
      </div>
      <div class="form-group">
        <label>⭐ Punti</label>
        <input type="number" id="qf-points" value="10" min="1" max="100" style="width:80px;">
      </div>
      <button class="btn btn-primary btn-block" onclick="addQuestion()">+ Aggiungi</button>`;
    return;
  }
  return _origAddForm && _origAddForm(type);
};

// Estendi addQuestion
const _origAddQuestion = window.addQuestion;
window.addQuestion = async function() {
  if (S?.currentQType !== 'fill-in-blanks') return _origAddQuestion && _origAddQuestion();
  const text    = (document.getElementById('qf-text')?.value || '').trim();
  const answers = (document.getElementById('qf-answers')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const hint    = (document.getElementById('qf-hint')?.value || '').trim();
  const pts     = parseInt(document.getElementById('qf-points')?.value) || 10;
  if (!text) return alert('Inserisci il testo con gli spazi ___');
  const blanks = (text.match(/___/g) || []).length;
  if (blanks === 0) return alert('Inserisci almeno uno spazio ___ nel testo');
  if (answers.length !== blanks) return alert(`Hai ${blanks} spazi ma ${answers.length} risposte. Devono corrispondere.`);
  S.questions.push({ type: 'fill-in-blanks', text, answers, hint, points: pts });
  renderQList && renderQList();
  document.getElementById('add-form').innerHTML = '';
  document.querySelectorAll('.q-type-btn').forEach(b => b.classList.remove('selected'));
  S.currentQType = null;
};

// Estendi getEditFormHTML
const _origEditForm = window.getEditFormHTML;
window.getEditFormHTML = function(q) {
  if (q.type === 'fill-in-blanks') {
    const fg = '<div class="form-group">';
    return fg + '<label>Testo (usa ___ per ogni spazio)</label><textarea id="qf-text" rows="4">' + esc(q.text || '') + '</textarea></div>' +
      fg + '<label>Risposte corrette (una per riga)</label><textarea id="qf-answers" rows="3">' + (q.answers || []).join('\n') + '</textarea></div>' +
      fg + '<label>Suggerimento (opzionale)</label><input type="text" id="qf-hint" value="' + esc(q.hint || '') + '"></div>' +
      fg + '<label>⭐ Punti</label><input type="number" id="qf-points" value="' + (q.points || 10) + '" min="1" max="100" style="width:80px;"></div>';
  }
  return _origEditForm ? _origEditForm(q) : '';
};

// Estendi buildQFromCurrentForm
const _origBuildForm = window.buildQFromCurrentForm;
window.buildQFromCurrentForm = async function(type) {
  if (type === 'fill-in-blanks') {
    const text    = (document.getElementById('qf-text')?.value || '').trim();
    const answers = (document.getElementById('qf-answers')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const hint    = (document.getElementById('qf-hint')?.value || '').trim();
    const pts     = parseInt(document.getElementById('qf-points')?.value) || 10;
    if (!text) { alert('Inserisci il testo'); return null; }
    return { type: 'fill-in-blanks', text, answers, hint, points: pts };
  }
  return _origBuildForm ? _origBuildForm(type) : null;
};

// Aggiungi bottone fill-in-blanks nella griglia builder
function _addFillInBlanksBtn() {
  const grid = document.querySelector('.q-type-grid');
  if (!grid) { setTimeout(_addFillInBlanksBtn, 300); return; }
  if (grid.querySelector('[data-fib]')) return; // già presente
  const btn = document.createElement('div');
  btn.className = 'q-type-btn';
  btn.setAttribute('data-fib', '1');
  btn.textContent = '✍️ Fill in the blanks';
  btn.onclick = function() { selectQType('fill-in-blanks', btn); };
  const clozeBtn = Array.from(grid.querySelectorAll('.q-type-btn')).find(b => b.textContent.includes('Cloze'));
  clozeBtn ? clozeBtn.after(btn) : grid.prepend(btn);
}
_addFillInBlanksBtn();
// Ri-prova quando si apre il builder
document.addEventListener('click', e => {
  if (e.target?.textContent?.match(/Nuova attività|Modifica/)) setTimeout(_addFillInBlanksBtn, 200);
});

// renderAnswerCard: aggiungi supporto fill-in-blanks per la vista docente
const _origAnswerCard = window.renderAnswerCard;
window.renderAnswerCard = function(q, i, answer, timeSec) {
  if (q.type !== 'fill-in-blanks') return _origAnswerCard ? _origAnswerCard(q, i, answer, timeSec) : '';
  const fmtSecs = s => s == null ? null : s >= 60 ? Math.floor(s/60)+'m '+(s%60)+'s' : s+'s';
  const timeTag = timeSec != null ? `<span style="font-size:10px;background:#f0ede8;color:#888;padding:2px 8px;border-radius:10px;margin-left:6px;">⏱ ${fmtSecs(timeSec)}</span>` : '';
  const arr = Array.isArray(answer) ? answer : [];
  const answers = q.answers || [];
  const allOk = answers.every((ans, bi) => _normBlank(arr[bi]) === _normBlank(ans));
  const scoreTag = arr.some(v => v) ? (allOk
    ? `<span style="font-size:11px;font-weight:800;color:var(--success);background:var(--success-light);padding:2px 8px;border-radius:10px;">✓ ${q.points||10} pt</span>`
    : `<span style="font-size:11px;font-weight:800;color:var(--warning);background:var(--warning-light);padding:2px 8px;border-radius:10px;">~ parziale</span>`) : '';
  const body = answers.map((ans, bi) => {
    const given = arr[bi] || '';
    const ok = _normBlank(given) === _normBlank(ans);
    return `<span style="display:inline-block;margin:3px 0;">Spazio ${bi+1}: <strong>${esc(given) || '<em style="color:#aaa">—</em>'}</strong>
      <span class="${ok ? 'correct-mark' : 'wrong-mark'}">${given ? (ok ? '✓' : `✗ → <em>${esc(ans)}</em>`) : ''}</span></span>`;
  }).join('<br>') || '<em style="color:#aaa">—</em>';
  const borderColor = allOk && arr.some(v=>v) ? 'var(--success)' : arr.some(v=>v) ? 'var(--warning)' : 'var(--border)';
  const qPreviewText = (q.text || '').substring(0, 60);
  return `<div class="answer-card" style="border-color:${borderColor};">
    <div class="answer-card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
      <span>${i+1}. FILL IN THE BLANKS — ${esc(qPreviewText)}${q.text.length>60?'…':''}</span>
      <span style="display:flex;gap:6px;align-items:center;">${scoreTag}${timeTag}</span>
    </div>
    <div class="answer-card-body">${body}</div>
  </div>`;
};


// ─────────────────────────────────────────────────────────────
// PARTE 3 — CORREZIONE AI RISPOSTE LIBERE ALLA CONSEGNA
// ─────────────────────────────────────────────────────────────
async function _gradeOpenAnswersWithAI(questions, answers) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) return {};
  const results = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[i];
    if (q.type !== 'free-response' || !a || a.length < 3) continue;
    const maxPts = q.points || 10;
    const hint = q.hint ? `\nCriteri del docente: "${q.hint}"` : '';
    const prompt = `Sei un insegnante di inglese per la scuola media italiana.
Valuta questa risposta aperta da 0 a ${maxPts}.
Domanda: "${q.text}"${hint}
Risposta: "${a}"
Criteri: rispetto consegna, correttezza grammaticale, quantità e qualità.
Rispondi SOLO con JSON valido, niente altro:
{"score": <numero 0-${maxPts}>, "feedback": "<1-2 frasi incoraggianti in italiano>"}`;
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      results[i] = { score: Math.max(0, Math.min(maxPts, Math.round(parsed.score || 0))), feedback: parsed.feedback || '' };
    } catch(e) { console.warn('AI grading Q' + i + ':', e.message); }
  }
  return results;
}

// Patch submitAnswers: aggiunge AI grading prima di salvare
const _origSubmit = window.submitAnswers;
window.submitAnswers = async function(auto) {
  if (S._submitting || S.submitted) return;
  S._submitting = true;

  if (!auto) { recordQuestionTime(S.qIndex); saveCurrentAnswer(); }
  if (S.timerInterval) { clearInterval(S.timerInterval); S.timerInterval = null; }
  S.skipped = S.skipped.filter(i => S.answers[i] === undefined || S.answers[i] === null);
  S.submitted = true;

  const safeName = S.safeName || (S.studentName || 'Anonimo').replace(/[.#$\[\]/]/g, '_');
  const questionTimes = (S.questionStartTimes || []).map((start, i) => {
    if (!start) return null;
    return Math.round(((S.questionEndTimes?.[i] || Date.now()) - start) / 1000);
  });

  const questions = S.activity?.questions || [];
  const answers   = S.answers || [];
  const hasFreeResponse = questions.some((q, i) => q.type === 'free-response' && answers[i]);

  // Mostra schermata consegna subito
  showView('student-done');
  document.getElementById('done-title').textContent = hasFreeResponse ? '⏳ Valutazione in corso…' : '✅ Consegnato!';
  document.getElementById('done-subtitle').textContent = hasFreeResponse ? "L'AI sta correggendo le risposte aperte…" : '';
  if (hasFreeResponse) document.getElementById('student-results-detail').innerHTML =
    '<div style="text-align:center;padding:30px;color:var(--muted);">🤖 Analisi in corso…</div>';

  // Chiama AI se ci sono risposte libere
  const aiGrades = hasFreeResponse ? await _gradeOpenAnswersWithAI(questions, answers) : {};

  // Calcola punteggio totale
  let totalScore = 0;
  questions.forEach((q, i) => {
    if (q.type === 'free-response' && aiGrades[i]?.score != null) {
      totalScore += aiGrades[i].score;
    } else {
      const r = evaluateAnswer(q, answers[i]);
      if (r.scorable && r.correct) totalScore += r.points;
    }
  });

  const payload = {
    name: S.studentName,
    answers: answers.map(a => a === undefined ? null : a),
    score: totalScore,
    aiGrades: Object.keys(aiGrades).length ? aiGrades : null,
    questionTimes,
    joinedAt: S.joinedAt,
    submittedAt: Date.now()
  };

  if (window.db && S.sessionCode) {
    try { await db.ref('livelearn/responses/' + S.sessionCode + '/' + safeName).set(payload); }
    catch(e) { console.warn('submitAnswers error:', e.message); }
  }

  // Render schermata risultati studente
  _renderDoneScreen(questions, answers, aiGrades, totalScore);
  S._submitting = false;
};

function _renderDoneScreen(questions, answers, aiGrades, totalScore) {
  showView('student-done');
  const mode    = S.sessionMode;
  const totalPts = questions.reduce((s, q) => s + (q.points || 10), 0);
  const pct     = totalPts > 0 ? Math.round(totalScore / totalPts * 100) : null;

  document.getElementById('done-pct').textContent = pct !== null ? pct + '%' : '—';
  document.getElementById('done-title').textContent = mode === 'practice' ? '🎮 Fine esercitazione!' : '✅ Consegnato!';
  document.getElementById('done-subtitle').textContent = totalPts > 0
    ? totalScore + ' / ' + totalPts + ' punti (' + pct + '% accuracy)'
    : 'Il professore valuterà le tue risposte.';

  const icons = { 'multiple-choice':'📋','cloze':'✏️','fill-in-blanks':'✍️','matching':'🔗','free-response':'💬','listening':'🎧','drag-drop':'🎯','reorder':'🔀' };

  document.getElementById('student-results-detail').innerHTML = questions.map((q, i) => {
    const a   = answers[i];
    const pts = q.points || 10;
    const ai  = aiGrades?.[i];
    let r;
    let aiFeedbackHtml = '';

    if (q.type === 'free-response' && ai?.score != null) {
      r = { scorable: true, correct: ai.score >= pts * 0.5, points: ai.score, detail: '' };
      if (ai.feedback) aiFeedbackHtml = `<div style="font-size:12px;color:#555;margin-top:6px;font-style:italic;">🤖 ${esc(ai.feedback)}</div>`;
    } else {
      r = evaluateAnswer(q, a);
    }

    let ans = '—';
    if (q.type === 'multiple-choice' && a !== undefined) ans = esc(q.options?.[a] || '—');
    else if ((q.type === 'cloze' || q.type === 'fill-in-blanks') && Array.isArray(a)) ans = a.map(esc).join(', ');
    else if (q.type === 'free-response' && a) ans = '"' + esc(a) + '"';
    else if (q.type === 'matching') ans = 'Collegamento effettuato';

    const si       = r.scorable ? (r.correct ? '✅' : '❌') : '📝';
    const ptsLabel = q.type === 'free-response' && ai?.score != null
      ? ai.score + '/' + pts + ' pt'
      : (r.scorable ? (r.correct ? '+' + pts + ' pt' : '0/' + pts + ' pt') : '');
    const bg  = r.scorable ? (r.correct ? 'var(--success-light)' : 'var(--danger-light)') : 'var(--surface2)';
    const bdr = r.scorable ? (r.correct ? 'var(--success)' : 'var(--danger)') : 'var(--border)';

    return `<div style="padding:14px;border-radius:12px;border:2px solid ${bdr};background:${bg};margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:16px;">${si}</span>
        <span style="flex:1;font-size:11px;font-weight:800;color:var(--muted);">${icons[q.type]||''} Dom.${i+1} · ${typeLabel(q.type)}</span>
        <span style="font-size:11px;font-weight:800;color:var(--muted);">${ptsLabel}</span>
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:3px;color:var(--text);">${esc((q.text||'').substring(0,80))}</div>
      <div style="font-size:12px;color:var(--muted);">Risposta: <em>${ans}</em>${r.detail ? ' · ' + r.detail : ''}</div>
      ${aiFeedbackHtml}
    </div>`;
  }).join('');
}


// ─────────────────────────────────────────────────────────────
// PARTE 4 — PANNELLO MODIFICA PUNTEGGI (DOCENTE)
// Strategia: chiamiamo l'originale renderStudentResultsTeacher
// (che visualizza tutto correttamente), poi appendiamo il pannello.
// ─────────────────────────────────────────────────────────────
const _origRenderTeacher = window.renderStudentResultsTeacher;
window.renderStudentResultsTeacher = function(name, response) {
  // 1. Chiama l'originale — gestisce dati live, export, answer cards
  _origRenderTeacher(name, response);

  // 2. Se non è consegnato non serve il pannello
  if (!response.submittedAt) return;

  const main = document.getElementById('live-main-content');
  if (!main) return;

  // 3. Rimuovi eventuale pannello precedente
  document.getElementById('ll-override-panel')?.remove();

  const questions = window.S?.liveActivity?.questions || [];
  const answers   = response.answers || [];
  const overrides = response.scoreOverrides || {};
  const aiGrades  = response.aiGrades || {};
  const safeName  = (response.name || name).replace(/[.#$\[\]/]/g, '_');

  // 4. Costruisci griglia input
  const gridItems = questions.map((q, i) => {
    const pts      = q.points || 10;
    const a        = answers[i];
    const r        = evaluateAnswer(q, a);
    const isOpen   = q.type === 'free-response';
    const aiScore  = aiGrades[i]?.score;
    const defVal   = overrides[i] != null ? overrides[i]
                   : (isOpen && aiScore != null ? aiScore
                   : (r.scorable ? (r.correct ? pts : 0) : ''));
    const aiLabel  = isOpen && aiScore != null
      ? `<span style="font-size:10px;color:var(--primary);">🤖 AI:${aiScore}/${pts} &nbsp;</span>` : '';
    const hi       = overrides[i] != null ? 'border:1.5px solid var(--primary);' : '';
    const qText    = (q.text || q.question?.text || '').substring(0, 40);
    return `<div style="background:${isOpen?'#fdf6e3':'var(--surface2)'};border-radius:10px;padding:10px 12px;border:1px solid var(--border);">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;">Dom.${i+1} ${isOpen?'💬':''} ${esc(qText)}${qText.length>=40?'…':''}</div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${aiLabel}
        <input type="number" id="llor-${i}" min="0" max="${pts}"
          value="${defVal}" placeholder="—"
          style="width:60px;padding:5px 8px;border-radius:6px;font-size:14px;font-weight:700;${hi}">
        <span style="font-size:12px;color:var(--muted);">/ ${pts}</span>
      </div>
    </div>`;
  }).join('');

  const panel = document.createElement('div');
  panel.id = 'll-override-panel';
  panel.style.cssText = 'margin-top:24px;background:white;border-radius:14px;border:2px solid var(--border);padding:20px;';
  panel.innerHTML = `
    <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px;">✏️ Modifica punteggi</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;">${gridItems}</div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px;">
      <button class="btn btn-primary" onclick="_llSaveOverrides('${safeName}')">💾 Salva modifiche</button>
      <span id="llor-status" style="font-size:13px;color:var(--success);display:none;">✅ Salvato!</span>
    </div>`;
  main.appendChild(panel);
};

window._llSaveOverrides = async function(safeName) {
  const questions = window.S?.liveActivity?.questions || [];
  const overrides = {};
  let finalScore  = 0;

  // Leggi risposte attuali per domande senza override
  let currentAnswers = [];
  try {
    const snap = await db.ref('livelearn/responses/' + S.liveCode + '/' + safeName).get();
    currentAnswers = snap.val()?.answers || [];
  } catch(e) {}

  questions.forEach((q, i) => {
    const el  = document.getElementById('llor-' + i);
    const val = el ? el.value.trim() : '';
    if (val !== '') {
      const n = Math.max(0, Math.min(q.points || 10, parseInt(val) || 0));
      overrides[i] = n;
      finalScore  += n;
    } else {
      const r = evaluateAnswer(q, currentAnswers[i]);
      if (r.scorable && r.correct) finalScore += r.points;
    }
  });

  try {
    await db.ref('livelearn/responses/' + S.liveCode + '/' + safeName).update({
      scoreOverrides: overrides,
      score: finalScore
    });
    const st = document.getElementById('llor-status');
    if (st) { st.style.display = 'inline'; setTimeout(() => st.style.display = 'none', 2500); }
  } catch(e) { alert('Errore salvataggio: ' + e.message); }
};

console.log('✅ LiveLearn Plus caricato (fix consegna + fill-in-blanks + AI grading + score override)');
