/**
 * LiveLearn — livelearn-plus.js  (v2 — bugfix completo)
 *
 * FIX v2:
 *  1. [BUG 6] Test sempre "IN CORSO": showStudentDone() patchato →
 *     in quiz-mode submittedAt ora viene scritto su Firebase.
 *  2. [BUG 1] Punteggio AI nelle risposte libere: visibile allo studente.
 *  3. [BUG 5] Analisi AI studente: _renderDoneScreen chiama runAIAnalysis.
 *  4. [BUG 2] Modifica punteggi: dipendeva da submittedAt → risolto con fix 1.
 *  5. [BUG 3] Esporta PDF: dipendeva da submittedAt → risolto con fix 1.
 *  6. [BUG 4] Navigazione alunno→alunno: gestione errori + AI grades in answer-card.
 */

// ─────────────────────────────────────────────────────────────
// PARTE 1 — FIX BUG CONSEGNA (.update() in showFeedbackAndAdvance)
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

function _normBlank(s) {
  return (s || '').trim().toLowerCase().replace(/[.,;:!?'"]+$/g, '').replace(/\s+/g, ' ');
}

const _origTypeLabel = window.typeLabel;
window.typeLabel = function(t) {
  if (t === 'fill-in-blanks') return 'Fill in the blanks';
  return _origTypeLabel ? _origTypeLabel(t) : t;
};

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

function _addFillInBlanksBtn() {
  const grid = document.querySelector('.q-type-grid');
  if (!grid) { setTimeout(_addFillInBlanksBtn, 300); return; }
  if (grid.querySelector('[data-fib]')) return;
  const btn = document.createElement('div');
  btn.className = 'q-type-btn';
  btn.setAttribute('data-fib', '1');
  btn.textContent = '✍️ Fill in the blanks';
  btn.onclick = function() { selectQType('fill-in-blanks', btn); };
  const clozeBtn = Array.from(grid.querySelectorAll('.q-type-btn')).find(b => b.textContent.includes('Cloze'));
  clozeBtn ? clozeBtn.after(btn) : grid.prepend(btn);
}
_addFillInBlanksBtn();
document.addEventListener('click', e => {
  if (e.target?.textContent?.match(/Nuova attività|Modifica/)) setTimeout(_addFillInBlanksBtn, 200);
});

const _origAnswerCard = window.renderAnswerCard;
window.renderAnswerCard = function(q, i, answer, timeSec) {
  // Fill-in-blanks
  if (q.type === 'fill-in-blanks') {
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
  }

  // Free-response: mostra score AI se disponibile
  if (q.type === 'free-response') {
    const aiGrades = window._llCurrentAiGrades || {};
    const ai = aiGrades[i];
    const pts = q.points || 10;
    const fmtSecs = s => s == null ? null : s >= 60 ? Math.floor(s/60)+'m '+(s%60)+'s' : s+'s';
    const timeTag = timeSec != null ? `<span style="font-size:10px;background:#f0ede8;color:#888;padding:2px 8px;border-radius:10px;margin-left:6px;">⏱ ${fmtSecs(timeSec)}</span>` : '';
    let scoreTag, borderColor;
    if (ai?.score != null) {
      const pct = ai.score / pts;
      const col = pct >= 0.9 ? 'success' : pct >= 0.5 ? 'warning' : 'danger';
      scoreTag = `<span style="font-size:11px;font-weight:800;color:var(--${col});background:var(--${col}-light);padding:2px 8px;border-radius:10px;">🤖 ${ai.score}/${pts} pt</span>`;
      borderColor = `var(--${col})`;
    } else {
      scoreTag = answer ? `<span style="font-size:11px;font-weight:800;color:var(--muted);background:#f0ede8;padding:2px 8px;border-radius:10px;">📝 da valutare</span>` : '';
      borderColor = 'var(--border)';
    }
    const body = answer
      ? `<blockquote style="margin:6px 0 0;padding:8px 14px;border-left:3px solid var(--primary);background:var(--surface2);border-radius:0 8px 8px 0;font-size:13px;color:var(--text);">${esc(answer)}</blockquote>`
        + (ai?.feedback ? `<div style="font-size:12px;color:#555;margin-top:6px;font-style:italic;">🤖 ${esc(ai.feedback)}</div>` : '')
      : '<em style="color:#aaa">—</em>';
    return `<div class="answer-card" style="border-color:${borderColor};">
      <div class="answer-card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span>${i+1}. RISPOSTA LIBERA — ${esc((q.text||'').substring(0,60))}${(q.text||'').length>60?'…':''}</span>
        <span style="display:flex;gap:6px;align-items:center;">${scoreTag}${timeTag}</span>
      </div>
      <div class="answer-card-body">${body}</div>
    </div>`;
  }

  return _origAnswerCard ? _origAnswerCard(q, i, answer, timeSec) : '';
};


// ─────────────────────────────────────────────────────────────
// PARTE 3 — CORREZIONE AI RISPOSTE LIBERE + FIX SCHERMATA STUDENTE
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
    const prompt = `Sei un insegnante di inglese per la scuola media italiana.\nValuta questa risposta aperta da 0 a ${maxPts}.\nDomanda: "${q.text}"${hint}\nRisposta: "${a}"\nCriteri: rispetto consegna, correttezza grammaticale, quantità e qualità.\nRispondi SOLO con JSON valido, niente altro:\n{"score": <numero 0-${maxPts}>, "feedback": "<1-2 frasi incoraggianti in italiano>"}`;
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

// ── FIX BUG 6 (radice di tutti i problemi) ──────────────────
// In modalità quiz, "Vedi risultati finali" chiama showStudentDone()
// direttamente, bypassando submitAnswers() → submittedAt non veniva mai
// scritto su Firebase. Ora intercettiamo: se non ancora consegnato,
// forziamo il percorso corretto attraverso submitAnswers(auto=true).
const _origShowStudentDone = window.showStudentDone;
window.showStudentDone = async function() {
  if (S.submitted || S._submitting) {
    // Già passato da submitAnswers: usa la versione originale
    return _origShowStudentDone && _origShowStudentDone();
  }
  // Quiz-mode: delega a submitAnswers che salva submittedAt e fa AI grading
  await window.submitAnswers(true);
};

// ── Patch submitAnswers: AI grading + salva submittedAt ──────
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
    submittedAt: Date.now()   // ← campo critico: segnala al docente che è consegnato
  };

  if (window.db && S.sessionCode) {
    try { await db.ref('livelearn/responses/' + S.sessionCode + '/' + safeName).set(payload); }
    catch(e) { console.warn('submitAnswers error:', e.message); }
  }

  _renderDoneScreen(questions, answers, aiGrades, totalScore);
  S._submitting = false;
};

function _renderDoneScreen(questions, answers, aiGrades, totalScore) {
  showView('student-done');
  const mode     = S.sessionMode;
  const totalPts = questions.reduce((s, q) => s + (q.points || 10), 0);
  const pct      = totalPts > 0 ? Math.round(totalScore / totalPts * 100) : null;

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

  // ── FIX BUG 5: chiama runAIAnalysis per il commento finale ──
  const apiKey = localStorage.getItem('gemini_api_key');
  if (apiKey && pct !== null) {
    try { runAIAnalysis(apiKey, questions, answers, pct, mode); } catch(e) {}
  } else if (apiKey && totalPts === 0) {
    try { runAIAnalysis(apiKey, questions, answers, 0, mode); } catch(e) {}
  }
}


// ─────────────────────────────────────────────────────────────
// PARTE 4 — PANNELLO MODIFICA PUNTEGGI (DOCENTE)
// ─────────────────────────────────────────────────────────────
const _origRenderTeacher = window.renderStudentResultsTeacher;
window.renderStudentResultsTeacher = function(name, response) {
  // Passa AI grades come contesto globale per renderAnswerCard (bug 4 + bug 1)
  window._llCurrentAiGrades = response.aiGrades || {};

  try {
    if (_origRenderTeacher) _origRenderTeacher(name, response);
  } catch(e) {
    console.error('renderStudentResultsTeacher error:', e);
    window._llCurrentAiGrades = null;
    return;
  }

  window._llCurrentAiGrades = null;

  // Se non è consegnato non serve il pannello modifica
  if (!response.submittedAt) return;

  const main = document.getElementById('live-main-content');
  if (!main) return;

  // Rimuovi eventuale pannello precedente
  document.getElementById('ll-override-panel')?.remove();

  const questions = window.S?.liveActivity?.questions || [];
  const answers   = response.answers || [];
  const overrides = response.scoreOverrides || {};
  const aiGrades  = response.aiGrades || {};
  const safeName  = (response.name || name).replace(/[.#$\[\]/]/g, '_');

  const gridItems = questions.map((q, i) => {
    const pts     = q.points || 10;
    const a       = answers[i];
    const r       = evaluateAnswer(q, a);
    const isOpen  = q.type === 'free-response';
    const aiScore = aiGrades[i]?.score;
    const defVal  = overrides[i] != null ? overrides[i]
                  : (isOpen && aiScore != null ? aiScore
                  : (r.scorable ? (r.correct ? pts : 0) : ''));
    const aiLabel = isOpen && aiScore != null
      ? `<span style="font-size:10px;color:var(--primary);">🤖 AI:${aiScore}/${pts} &nbsp;</span>` : '';
    const hi      = overrides[i] != null ? 'border:1.5px solid var(--primary);' : '';
    const qText   = (q.text || q.question?.text || '').substring(0, 40);
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

console.log('✅ LiveLearn Plus v2 — fix: IN CORSO / AI score / analisi AI / PDF / navigazione / modifica punteggi');
