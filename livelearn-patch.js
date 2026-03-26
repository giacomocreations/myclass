/**
 * LiveLearn PATCH v2.1
 * ─────────────────────────────────────────────────────────────
 * 1. Nuovo tipo "fill-in-blanks" (scrittura libera, matching tollerante)
 * 2. Correzione AI (Gemini) delle risposte libere alla consegna
 * 3. Modifica punteggio da parte del docente dopo la consegna
 * ─────────────────────────────────────────────────────────────
 * INSTALLAZIONE: aggiungi questo tag PRIMA di </body> in LiveLearn.html
 *   <script src="livelearn-patch.js"></script>
 */

// ─── Utility ────────────────────────────────────────────────
function _normalizeBlank(s) {
  // Rimuove spazi extra, punteggiatura finale, maiuscole
  return (s || '').trim().toLowerCase().replace(/[.,;:!?'"]+$/g, '').replace(/\s+/g, ' ');
}

// ─── 1. ESTENDE typeLabel ───────────────────────────────────
(function patchTypeLabel() {
  const orig = window.typeLabel;
  window.typeLabel = function(t) {
    if (t === 'fill-in-blanks') return 'Fill in the blanks';
    return orig ? orig(t) : t;
  };
})();

// ─── 1. ESTENDE evaluateAnswer ─────────────────────────────
(function patchEvaluateAnswer() {
  const orig = window.evaluateAnswer;
  window.evaluateAnswer = function(q, a) {
    if (q.type === 'fill-in-blanks') {
      const pts = q.points || 10;
      if (!Array.isArray(a)) return { scorable: true, correct: false, points: pts, detail: 'Nessuna risposta.' };
      const answers = q.answers || [];
      const ok = answers.every((ans, bi) => _normalizeBlank(a[bi]) === _normalizeBlank(ans));
      const detail = ok ? '' : answers.map((ans, bi) =>
        'Sp.' + (bi + 1) + ': ' + esc(a[bi] || '—') + ' → <strong>' + esc(ans) + '</strong>'
      ).join(' · ');
      return { scorable: true, correct: ok, points: pts, detail };
    }
    return orig ? orig(q, a) : { scorable: false, correct: false, points: 0, detail: '' };
  };
})();

// ─── 1. ESTENDE saveCurrentAnswer ──────────────────────────
(function patchSaveCurrentAnswer() {
  const orig = window.saveCurrentAnswer;
  window.saveCurrentAnswer = function() {
    if (!window.S) return orig && orig();
    const q = S.activity?.questions?.[S.qIndex];
    if (q && q.type === 'fill-in-blanks') {
      const text = q.text || '';
      const count = (text.match(/___/g) || []).length;
      const vals = Array.from({ length: count }, (_, b) => {
        const el = document.getElementById('blank-' + b);
        return el ? el.value.trim() : '';
      });
      if (vals.some(v => v !== '')) S.answers[S.qIndex] = vals;
      return;
    }
    return orig && orig();
  };
})();

// ─── 1. ESTENDE buildQuestionHTML ──────────────────────────
(function patchBuildQuestionHTML() {
  const orig = window.buildQuestionHTML;
  window.buildQuestionHTML = function(q, i) {
    if (q.type === 'fill-in-blanks') {
      const pts = q.points || 10;
      const isSkipped = S.skipped?.includes(i);
      const qLabel = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div class="q-label">Domanda ${i + 1}</div>
        <span class="q-pts-label">⭐ ${pts} pt</span>
        ${isSkipped ? '<span class="skip-badge">Saltata — rispondi ora</span>' : ''}
      </div>`;
      let idx = 0;
      const html = esc(q.text).replace(/___/g, () =>
        `<input class="blank-input" id="blank-${idx++}" type="text" autocomplete="off" spellcheck="true" placeholder="scrivi qui…">`
      );
      const hint = q.hint ? `<p style="font-size:12px;color:var(--muted);margin-top:10px;">💡 ${esc(q.hint)}</p>` : '';
      return `<div class="question-card">${qLabel}<div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:8px;">✍️ Scrivi la risposta negli spazi</div><div class="cloze-text">${html}</div>${hint}</div>`;
    }
    return orig ? orig(q, i) : '';
  };
})();

// ─── 1. ESTENDE renderAddForm ───────────────────────────────
(function patchRenderAddForm() {
  const orig = window.renderAddForm;
  window.renderAddForm = function(type) {
    if (type === 'fill-in-blanks') {
      const el = document.getElementById('add-form');
      if (!el) return;
      el.innerHTML = `
        <div class="form-group">
          <label>Testo con spazi (usa ___ per ogni spazio)</label>
          <textarea id="qf-text" rows="4" placeholder="Yesterday she ___ to the park and ___ her friends."></textarea>
        </div>
        <div class="form-group">
          <label>Risposte esatte (una per riga, in ordine degli spazi)</label>
          <textarea id="qf-answers" rows="3" placeholder="went\nmet"></textarea>
          <p style="font-size:11px;color:var(--muted);margin-top:4px;">⚡ La correzione ignora maiuscole, spazi extra e punteggiatura.</p>
        </div>
        <div class="form-group">
          <label>Suggerimento per lo studente (opzionale)</label>
          <input type="text" id="qf-hint" placeholder="Usa il Past Simple…">
        </div>
        <div class="form-group"><label>⭐ Punti</label><input type="number" id="qf-points" value="10" min="1" max="100" style="width:80px;"></div>
        <button class="btn btn-primary btn-block" onclick="addQuestion()">+ Aggiungi</button>`;
      return;
    }
    return orig && orig(type);
  };
})();

// ─── 1. ESTENDE addQuestion ─────────────────────────────────
(function patchAddQuestion() {
  const orig = window.addQuestion;
  window.addQuestion = async function() {
    const type = S?.currentQType;
    if (type !== 'fill-in-blanks') return orig && orig();
    const text = (document.getElementById('qf-text')?.value || '').trim();
    const answers = (document.getElementById('qf-answers')?.value || '')
      .split('\n').map(s => s.trim()).filter(Boolean);
    const hint = (document.getElementById('qf-hint')?.value || '').trim();
    const pts = parseInt(document.getElementById('qf-points')?.value) || 10;
    if (!text) return alert('Inserisci il testo con gli spazi ___');
    const blanks = (text.match(/___/g) || []).length;
    if (blanks === 0) return alert('Inserisci almeno uno spazio ___ nel testo');
    if (answers.length !== blanks) return alert(`Hai ${blanks} spazi ma ${answers.length} risposte. Devono corrispondere.`);
    const q = { type: 'fill-in-blanks', text, answers, hint, points: pts };
    S.questions.push(q);
    window.renderQList && renderQList();
    document.getElementById('add-form').innerHTML = '';
    document.querySelectorAll('.q-type-btn').forEach(b => b.classList.remove('selected'));
    S.currentQType = null;
  };
})();

// ─── 1. AGGIUNGI BOTTONE fill-in-blanks alla griglia tipi ───
(function addFillInBlanksButton() {
  function tryAdd() {
    const grid = document.querySelector('.q-type-grid');
    if (!grid) return setTimeout(tryAdd, 300);
    // Evita duplicati
    if (grid.querySelector('[data-type="fill-in-blanks"]')) return;
    const btn = document.createElement('div');
    btn.className = 'q-type-btn';
    btn.setAttribute('data-type', 'fill-in-blanks');
    btn.textContent = '✍️ Fill in the blanks';
    btn.onclick = function() { selectQType('fill-in-blanks', btn); };
    // Inserisci dopo il pulsante "Cloze / Fill"
    const clozeBtn = Array.from(grid.querySelectorAll('.q-type-btn'))
      .find(b => b.textContent.includes('Cloze'));
    if (clozeBtn) {
      clozeBtn.after(btn);
    } else {
      grid.insertBefore(btn, grid.firstChild);
    }
  }
  tryAdd();
  // Re-prova quando si apre il builder
  document.addEventListener('click', function(e) {
    if (e.target.textContent?.includes('Nuova attività') || e.target.textContent?.includes('Modifica')) {
      setTimeout(tryAdd, 200);
    }
  });
})();

// ─── 1. ESTENDE getEditFormHTML per fill-in-blanks ──────────
(function patchGetEditFormHTML() {
  const orig = window.getEditFormHTML;
  window.getEditFormHTML = function(q) {
    if (q.type === 'fill-in-blanks') {
      const fg = '<div class="form-group">';
      return fg + '<label>Testo (usa ___ per ogni spazio)</label><textarea id="qf-text" rows="4">' + esc(q.text || '') + '</textarea></div>' +
        fg + '<label>Risposte corrette (una per riga)</label><textarea id="qf-answers" rows="3">' + (q.answers || []).join('\n') + '</textarea></div>' +
        fg + '<label>Suggerimento (opzionale)</label><input type="text" id="qf-hint" value="' + esc(q.hint || '') + '"></div>' +
        fg + '<label>⭐ Punti</label><input type="number" id="qf-points" value="' + (q.points || 10) + '" min="1" max="100" style="width:80px;"></div>';
    }
    return orig ? orig(q) : '';
  };
})();

// ─── 1. ESTENDE buildQFromCurrentForm per fill-in-blanks ────
(function patchBuildQFromCurrentForm() {
  const orig = window.buildQFromCurrentForm;
  window.buildQFromCurrentForm = async function(type) {
    if (type === 'fill-in-blanks') {
      const text = (document.getElementById('qf-text')?.value || '').trim();
      const answers = (document.getElementById('qf-answers')?.value || '')
        .split('\n').map(s => s.trim()).filter(Boolean);
      const hint = (document.getElementById('qf-hint')?.value || '').trim();
      const pts = parseInt(document.getElementById('qf-points')?.value) || 10;
      if (!text) { alert('Inserisci il testo'); return null; }
      return { type: 'fill-in-blanks', text, answers, hint, points: pts };
    }
    return orig ? orig(type) : null;
  };
})();

// ─── 1. FIX: fill-in-blanks nella vista studente "done" ─────
(function patchShowStudentDone() {
  const _orig = window.showStudentDone;
  window.showStudentDone = function() {
    _orig && _orig();
    // Dopo che la vista è renderizzata, aggiorna le card fill-in-blanks
    setTimeout(() => {
      const questions = S.activity?.questions || [];
      const answers = S.answers || [];
      questions.forEach((q, i) => {
        if (q.type === 'fill-in-blanks') {
          const r = evaluateAnswer(q, answers[i]);
          // Già gestito da evaluateAnswer, niente da fare extra
        }
      });
    }, 100);
  };
})();

// ─── 1. ESTENDE restoreAnswer per fill-in-blanks ────────────
(function patchRestoreAnswer() {
  const orig = window.restoreAnswer;
  window.restoreAnswer = function(i) {
    const q = S.activity?.questions?.[i];
    if (q && q.type === 'fill-in-blanks') {
      const a = S.answers[i];
      if (Array.isArray(a)) {
        a.forEach((val, bi) => {
          const el = document.getElementById('blank-' + bi);
          if (el) el.value = val;
        });
      }
      return;
    }
    return orig && orig(i);
  };
})();

// ─── 2. CORREZIONE AI RISPOSTA LIBERA ALLA CONSEGNA ─────────
async function gradeOpenAnswersWithAI(questions, answers) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) return null;

  const freeResponseItems = questions
    .map((q, i) => ({ q, a: answers[i], i }))
    .filter(({ q, a }) => q.type === 'free-response' && a && a.length > 2);

  if (!freeResponseItems.length) return null;

  const results = {};

  for (const { q, a, i } of freeResponseItems) {
    try {
      const maxPts = q.points || 10;
      const hint = q.hint ? `\nCriteri / suggerimento del docente: "${q.hint}"` : '';
      const prompt = `Sei un insegnante di inglese per la scuola media italiana.
Valuta questa risposta aperta assegnando un punteggio da 0 a ${maxPts}.

Domanda: "${q.text}"${hint}
Risposta dello studente: "${a}"
Punteggio massimo: ${maxPts}

Criteri di valutazione:
- Rispetto della consegna (ha risposto a quello che era chiesto?)
- Correttezza grammaticale (errori di verbo, spelling, struttura)
- Quantità e qualità del contenuto

Rispondi SOLO con un oggetto JSON valido, niente altro:
{"score": <numero intero da 0 a ${maxPts}>, "feedback": "<1-2 frasi in italiano, tono incoraggiante>"}`;

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const score = Math.max(0, Math.min(maxPts, Math.round(parsed.score || 0)));
      results[i] = { score, feedback: parsed.feedback || '' };
    } catch (e) {
      console.warn('AI grading error for Q' + i + ':', e.message);
      results[i] = { score: null, feedback: '' };
    }
  }
  return results;
}

// ─── 2. PATCH submitAnswers ─────────────────────────────────
(function patchSubmitAnswers() {
  const orig = window.submitAnswers;
  window.submitAnswers = async function(auto) {
    // Esegui prima tutta la logica originale (salvataggio Firebase incluso)
    // ma intercettiamo PRIMA del showStudentDone per iniettare punteggi AI

    if (!auto) {
      if (window.recordQuestionTime) recordQuestionTime(S.qIndex);
      if (window.saveCurrentAnswer) saveCurrentAnswer();
    }
    if (S.timerInterval) { clearInterval(S.timerInterval); S.timerInterval = null; }
    if (window.S) {
      S.skipped = S.skipped.filter(i => S.answers[i] === undefined || S.answers[i] === null);
      S.submitted = true;
    }

    const safeName = S.safeName || (S.studentName || 'Anonimo').replace(/[.#$\[\]/]/g, '_');
    const questionTimes = (S.questionStartTimes || []).map((start, i) => {
      if (!start) return null;
      const end = (S.questionEndTimes || [])[i] || Date.now();
      return Math.round((end - start) / 1000);
    });

    const questions = S.activity?.questions || [];
    const answers = S.answers || [];

    // ── Chiamata AI per free-response ──
    let aiGrades = null;
    const hasFreeResponse = questions.some((q, i) => q.type === 'free-response' && answers[i]);
    if (hasFreeResponse) {
      // Mostra "valutazione in corso" nell'interfaccia
      showView('student-done');
      document.getElementById('done-title').textContent = '⏳ Valutazione in corso…';
      document.getElementById('done-subtitle').textContent = "L'AI sta correggendo le risposte aperte…";
      document.getElementById('student-results-detail').innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">🤖 Analisi risposte in corso…</div>';

      aiGrades = await gradeOpenAnswersWithAI(questions, answers);
    }

    // ── Calcola punteggio totale (inclusi voti AI) ──
    let totalScore = 0;
    questions.forEach((q, i) => {
      if (q.type === 'free-response' && aiGrades && aiGrades[i] != null) {
        totalScore += aiGrades[i].score || 0;
      } else {
        const r = evaluateAnswer(q, answers[i]);
        if (r.scorable && r.correct) totalScore += r.points;
      }
    });

    const payload = {
      name: S.studentName,
      answers: answers.map(a => a === undefined ? null : a),
      score: totalScore,
      aiGrades: aiGrades || null,
      questionTimes,
      joinedAt: S.joinedAt,
      submittedAt: Date.now()
    };

    if (window.db && S.sessionCode) {
      try {
        await db.ref('livelearn/responses/' + S.sessionCode + '/' + safeName).set(payload);
      } catch (e) { console.warn('submitAnswers error:', e.message); }
    }

    // ── Mostra schermata done aggiornata ──
    _renderStudentDoneWithAI(questions, answers, aiGrades, totalScore);
  };
})();

function _renderStudentDoneWithAI(questions, answers, aiGrades, totalScore) {
  showView('student-done');
  const mode = S.sessionMode;

  let earnedPts = totalScore;
  let totalPts = 0;
  let hasPending = false;

  questions.forEach((q, i) => {
    const pts = q.points || 10;
    totalPts += pts;
    if (q.type === 'free-response') {
      if (aiGrades && aiGrades[i] != null && aiGrades[i].score != null) {
        // già conteggiato
      } else {
        hasPending = true;
      }
    }
  });

  const pct = totalPts > 0 ? Math.round(earnedPts / totalPts * 100) : null;
  const pctEl = document.getElementById('done-pct');
  if (pctEl) pctEl.textContent = pct !== null ? pct + '%' : '—';

  const titleEl = document.getElementById('done-title');
  if (titleEl) titleEl.textContent = mode === 'practice' ? '🎮 Fine esercitazione!' : '✅ Consegnato!';

  const subEl = document.getElementById('done-subtitle');
  if (subEl) subEl.textContent = totalPts > 0
    ? earnedPts + ' / ' + totalPts + ' punti (' + pct + '% accuracy)'
    : 'Il professore valuterà le tue risposte.';

  const icons = { 'multiple-choice': '📋', 'cloze': '✏️', 'fill-in-blanks': '✍️', 'matching': '🔗', 'free-response': '💬', 'listening': '🎧' };
  const detailEl = document.getElementById('student-results-detail');
  if (!detailEl) return;

  detailEl.innerHTML = questions.map((q, i) => {
    const a = answers[i];
    const pts = q.points || 10;
    let r;
    let aiFeedbackHtml = '';

    if (q.type === 'free-response') {
      const grade = aiGrades && aiGrades[i];
      if (grade && grade.score != null) {
        const isOk = grade.score >= pts * 0.6;
        r = { scorable: true, correct: isOk, points: grade.score, detail: '' };
        if (grade.feedback) {
          aiFeedbackHtml = `<div style="font-size:12px;color:#555;margin-top:6px;font-style:italic;">🤖 ${esc(grade.feedback)}</div>`;
        }
      } else {
        r = { scorable: false, correct: false, points: 0, detail: '' };
      }
    } else {
      r = evaluateAnswer(q, a);
    }

    let ans = '—';
    if (q.type === 'multiple-choice' && a !== undefined) ans = esc(q.options[a]);
    else if ((q.type === 'cloze' || q.type === 'fill-in-blanks') && Array.isArray(a)) ans = a.map(esc).join(', ');
    else if (q.type === 'free-response' && a) ans = '"' + esc(a) + '"';
    else if (q.type === 'matching') ans = 'Collegamento effettuato';

    const aiScore = (q.type === 'free-response' && aiGrades && aiGrades[i]?.score != null)
      ? aiGrades[i].score + '/' + pts + ' pt'
      : null;
    const si = q.type === 'free-response'
      ? (aiGrades && aiGrades[i]?.score != null ? (aiGrades[i].score >= pts * 0.5 ? '✅' : '⚠️') : '📝')
      : (r.scorable ? (r.correct ? '✅' : '❌') : '📝');
    const ptsLabel = q.type === 'free-response'
      ? (aiScore ? aiScore : '📝 valutato dal docente')
      : (r.scorable ? (r.correct ? '+' + pts + ' pt' : '0/' + pts + ' pt') : '');
    const bg = q.type === 'free-response'
      ? (aiGrades && aiGrades[i]?.score != null ? 'var(--primary-light)' : 'var(--surface2)')
      : (r.scorable ? (r.correct ? 'var(--success-light)' : 'var(--danger-light)') : 'var(--surface2)');
    const bdr = q.type === 'free-response'
      ? (aiGrades && aiGrades[i]?.score != null ? 'var(--primary)' : 'var(--border)')
      : (r.scorable ? (r.correct ? 'var(--success)' : 'var(--danger)') : 'var(--border)');

    return `<div style="padding:14px;border-radius:12px;border:2px solid ${bdr};background:${bg};margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:16px;">${si}</span>
        <span style="flex:1;font-size:11px;font-weight:800;color:var(--muted);">${icons[q.type] || ''} Dom.${i + 1} · ${typeLabel(q.type)}</span>
        <span style="font-size:11px;font-weight:800;color:var(--muted);">${ptsLabel}</span>
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:3px;color:var(--text);">${esc((q.text || '').substring(0, 80))}</div>
      <div style="font-size:12px;color:var(--muted);">Risposta: <em>${ans}</em>${r.scorable && !r.correct && r.detail ? ' · ' + r.detail : ''}</div>
      ${aiFeedbackHtml}
    </div>`;
  }).join('');

  // Analisi AI finale (se già presente)
  const apiKey = localStorage.getItem('gemini_api_key');
  if (apiKey) {
    const scorableCount = questions.filter(q => q.type !== 'free-response').length;
    if (scorableCount > 0) {
      setTimeout(() => {
        if (window.runAIAnalysis) runAIAnalysis(apiKey, questions, answers, pct, mode);
      }, 500);
    }
  }
}

// ─── 3. TEACHER SCORE OVERRIDE ──────────────────────────────
(function patchRenderStudentResultsTeacher() {
  const orig = window.renderStudentResultsTeacher;
  window.renderStudentResultsTeacher = function(name, response) {
    // Chiama originale per renderizzare tutto
    orig && orig(name, response);

    // Poi inietta i controlli di override dopo un tick
    setTimeout(() => _injectScoreOverrideUI(name, response), 100);
  };
})();

function _injectScoreOverrideUI(name, response) {
  const main = document.getElementById('live-main-content');
  if (!main) return;

  const questions = window.S?.liveActivity?.questions || [];
  const answers = response.answers || [];
  const overrides = response.scoreOverrides || {};
  const aiGrades = response.aiGrades || {};
  const safeName = (response.name || name).replace(/[.#$\[\]/]/g, '_');

  // Trova le answer-card già nel DOM
  const cards = main.querySelectorAll('.answer-card');
  if (!cards.length) return;

  // Aggiungi pannello override al fondo del main se non esiste già
  const existingPanel = main.querySelector('#teacher-override-panel');
  if (existingPanel) existingPanel.remove();

  const panel = document.createElement('div');
  panel.id = 'teacher-override-panel';
  panel.style.cssText = 'margin-top:24px;background:white;border-radius:14px;border:2px solid var(--border);padding:20px;';

  let html = `<div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:16px;">✏️ Modifica punteggi (docente)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" id="override-grid">`;

  questions.forEach((q, i) => {
    const pts = q.points || 10;
    const a = answers[i];
    const r = evaluateAnswer(q, a);
    const isOpen = q.type === 'free-response';
    const aiScore = aiGrades[i]?.score;
    const overrideVal = overrides[i] != null ? overrides[i] : (isOpen && aiScore != null ? aiScore : (r.scorable ? (r.correct ? pts : 0) : null));

    const bgColor = isOpen ? '#fdf6e3' : 'var(--surface2)';
    const aiLabel = isOpen && aiScore != null ? `<span style="font-size:10px;color:var(--primary);">AI: ${aiScore}/${pts}</span>` : '';

    html += `<div style="background:${bgColor};border-radius:10px;padding:10px 12px;border:1px solid var(--border);">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;">${isOpen ? '💬' : ''} Dom.${i + 1} · ${esc((q.text || '').substring(0, 40))}…</div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${aiLabel}
        <input type="number" id="override-${i}" min="0" max="${pts}" value="${overrideVal != null ? overrideVal : ''}"
          placeholder="—" style="width:60px;padding:4px 8px;border-radius:6px;border:1.5px solid var(--border);font-size:14px;font-weight:700;"
          ${overrides[i] != null ? 'style="border-color:var(--primary);"' : ''}>
        <span style="font-size:12px;color:var(--muted);">/ ${pts} pt</span>
      </div>
    </div>`;
  });

  html += `</div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px;">
      <button class="btn btn-primary" onclick="_saveTeacherOverrides('${safeName}')">💾 Salva modifiche punteggio</button>
      <span id="override-save-status" style="font-size:13px;color:var(--success);display:none;">✅ Salvato!</span>
    </div>`;

  panel.innerHTML = html;
  main.appendChild(panel);
}

async function _saveTeacherOverrides(safeName) {
  const questions = window.S?.liveActivity?.questions || [];
  const overrides = {};
  let totalOverride = 0;

  questions.forEach((q, i) => {
    const el = document.getElementById('override-' + i);
    if (!el) return;
    const val = el.value.trim();
    if (val !== '') {
      const n = Math.max(0, Math.min(q.points || 10, parseInt(val) || 0));
      overrides[i] = n;
      totalOverride += n;
    }
  });

  // Per le domande senza override, usa il punteggio automatico
  const response = (await db.ref('livelearn/responses/' + S.liveCode + '/' + safeName).get()).val() || {};
  const answers = response.answers || [];
  let finalScore = 0;
  questions.forEach((q, i) => {
    if (overrides[i] != null) {
      finalScore += overrides[i];
    } else {
      const r = evaluateAnswer(q, answers[i]);
      if (r.scorable && r.correct) finalScore += r.points;
    }
  });

  try {
    await db.ref('livelearn/responses/' + S.liveCode + '/' + safeName).update({
      scoreOverrides: overrides,
      score: finalScore
    });
    const statusEl = document.getElementById('override-save-status');
    if (statusEl) {
      statusEl.style.display = 'inline';
      setTimeout(() => { statusEl.style.display = 'none'; }, 2500);
    }
  } catch (e) {
    alert('Errore nel salvataggio: ' + e.message);
  }
}

// ─── 3. MOSTRA punteggi AI nella vista docente ───────────────
(function patchAnswerCardFreeResponse() {
  // Già gestito dal renderStudentResultsTeacher originale + _injectScoreOverrideUI
  // Qui aggiungiamo solo la patch della card free-response per mostrare punteggio AI
  const _origRender = window.renderStudentResultsTeacher;
  // già patchato sopra — niente da fare qui
})();

console.log('✅ LiveLearn patch v2.1 caricato: fill-in-blanks, AI grading, score override');
